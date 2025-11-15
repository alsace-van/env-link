import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, Plus, Save, Mail, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { InspectionZoneCard } from "./InspectionZoneCard";
import { AddZoneDialog } from "./AddZoneDialog";
import { DamagesList } from "./DamagesList";
import { AddDamageDialog } from "./AddDamageDialog";
import { SignatureCanvasComponent } from "./SignatureCanvas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DEFAULT_ZONES = [
  { name: "Vue de face", order: 1 },
  { name: "Vue arrière", order: 2 },
  { name: "Côté gauche", order: 3 },
  { name: "Côté droit", order: 4 },
  { name: "Intérieur avant", order: 5 },
  { name: "Intérieur arrière", order: 6 },
];

interface VehicleInspectionTabProps {
  projectId: string;
}

export const VehicleInspectionTab = ({ projectId }: VehicleInspectionTabProps) => {
  const [loading, setLoading] = useState(true);
  const [inspection, setInspection] = useState<any>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [damages, setDamages] = useState<any[]>([]);
  
  const [mileage, setMileage] = useState("");
  const [fuelLevel, setFuelLevel] = useState("half");
  const [keysProvided, setKeysProvided] = useState(true);
  const [notes, setNotes] = useState("");
  const [signedBy, setSignedBy] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  
  const [addZoneDialogOpen, setAddZoneDialogOpen] = useState(false);
  const [addDamageDialogOpen, setAddDamageDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInspection();
  }, [projectId]);

  const loadInspection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: inspectionData, error: inspectionError } = await supabase
        .from("vehicle_inspections")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (inspectionError) throw inspectionError;

      if (inspectionData) {
        setInspection(inspectionData);
        setMileage(inspectionData.mileage?.toString() || "");
        setFuelLevel(inspectionData.fuel_level || "half");
        setKeysProvided(inspectionData.keys_provided);
        setNotes(inspectionData.notes || "");
        setSignedBy(inspectionData.signed_by || "");

        await loadZones(inspectionData.id);
        await loadDamages(inspectionData.id);
      }
    } catch (error: any) {
      console.error("Erreur chargement:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const loadZones = async (inspectionId: string) => {
    const { data, error } = await supabase
      .from("inspection_zones")
      .select(`
        *,
        photos:inspection_photos(*)
      `)
      .eq("inspection_id", inspectionId)
      .order("display_order");

    if (error) throw error;
    setZones(data || []);
  };

  const loadDamages = async (inspectionId: string) => {
    const { data, error } = await supabase
      .from("vehicle_damages")
      .select(`
        *,
        zone:inspection_zones(zone_name)
      `)
      .eq("inspection_id", inspectionId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    
    const damagesWithZoneName = (data || []).map(d => ({
      ...d,
      zone_name: d.zone?.zone_name
    }));
    
    setDamages(damagesWithZoneName);
  };

  const handleStartInspection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: newInspection, error: inspectionError } = await supabase
        .from("vehicle_inspections")
        .insert({
          project_id: projectId,
          user_id: user.id,
          inspection_date: new Date().toISOString(),
          mileage: null,
          fuel_level: "half",
          keys_provided: true,
        })
        .select()
        .single();

      if (inspectionError) throw inspectionError;

      // Create default zones
      const zonesToCreate = DEFAULT_ZONES.map((zone) => ({
        inspection_id: newInspection.id,
        zone_name: zone.name,
        zone_type: "default",
        display_order: zone.order,
      }));

      const { error: zonesError } = await supabase
        .from("inspection_zones")
        .insert(zonesToCreate);

      if (zonesError) throw zonesError;

      toast.success("Prise en main démarrée");
      await loadInspection();
    } catch (error: any) {
      console.error("Erreur démarrage:", error);
      toast.error("Erreur lors du démarrage");
    }
  };

  const handleAddZone = async (zoneName: string) => {
    if (!inspection) return;

    try {
      const maxOrder = Math.max(...zones.map((z) => z.display_order), 0);
      
      const { error } = await supabase
        .from("inspection_zones")
        .insert({
          inspection_id: inspection.id,
          zone_name: zoneName,
          zone_type: "custom",
          display_order: maxOrder + 1,
        });

      if (error) throw error;

      toast.success("Zone ajoutée");
      await loadZones(inspection.id);
    } catch (error: any) {
      console.error("Erreur ajout zone:", error);
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    try {
      const { error } = await supabase
        .from("inspection_zones")
        .delete()
        .eq("id", zoneId);

      if (error) throw error;

      toast.success("Zone supprimée");
      await loadZones(inspection.id);
    } catch (error: any) {
      console.error("Erreur suppression zone:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleSave = async () => {
    if (!inspection) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      let signatureUrl = inspection.client_signature_url;

      if (signatureData && signedBy.trim()) {
        const blob = await fetch(signatureData).then((r) => r.blob());
        const fileName = `${user.id}/${projectId}/signature.png`;

        const { error: uploadError } = await supabase.storage
          .from("vehicle-inspections")
          .upload(fileName, blob, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("vehicle-inspections")
          .getPublicUrl(fileName);

        signatureUrl = publicUrl;
      }

      const { error } = await supabase
        .from("vehicle_inspections")
        .update({
          mileage: mileage ? parseInt(mileage) : null,
          fuel_level: fuelLevel,
          keys_provided: keysProvided,
          notes,
          signed_by: signedBy.trim() || null,
          signed_at: signedBy.trim() ? new Date().toISOString() : null,
          client_signature_url: signatureUrl,
        })
        .eq("id", inspection.id);

      if (error) throw error;

      toast.success("✓ Prise en main enregistrée");
      await loadInspection();
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!inspection) return;

    try {
      const { error } = await supabase
        .from("vehicle_inspections")
        .delete()
        .eq("id", inspection.id);

      if (error) throw error;

      toast.success("Prise en main supprimée");
      setInspection(null);
      setZones([]);
      setDamages([]);
      setMileage("");
      setFuelLevel("half");
      setKeysProvided(true);
      setNotes("");
      setSignedBy("");
      setSignatureData(null);
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!inspection) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <Truck className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">Aucune prise en main</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Commencez par documenter l'état du véhicule à sa réception
              </p>
            </div>
            <Button onClick={handleStartInspection}>
              <Truck className="h-4 w-4 mr-2" />
              Commencer la prise en main
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
          <CardDescription>
            Date de prise en main : {new Date(inspection.inspection_date).toLocaleDateString("fr-FR")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mileage">Kilométrage</Label>
              <Input
                id="mileage"
                type="number"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                placeholder="Ex: 45000"
              />
            </div>

            <div>
              <Label htmlFor="fuelLevel">Niveau de carburant</Label>
              <Select value={fuelLevel} onValueChange={setFuelLevel}>
                <SelectTrigger id="fuelLevel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="empty">Vide</SelectItem>
                  <SelectItem value="quarter">1/4</SelectItem>
                  <SelectItem value="half">1/2</SelectItem>
                  <SelectItem value="three_quarters">3/4</SelectItem>
                  <SelectItem value="full">Plein</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="keysProvided"
              checked={keysProvided}
              onCheckedChange={(checked) => setKeysProvided(checked as boolean)}
            />
            <Label htmlFor="keysProvided" className="cursor-pointer">
              Clés remises
            </Label>
          </div>

          <div>
            <Label htmlFor="notes">Notes générales</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes sur l'état général du véhicule..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Photos par zone</h3>
          <Button onClick={() => setAddZoneDialogOpen(true)} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une zone
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {zones.map((zone) => (
            <InspectionZoneCard
              key={zone.id}
              zone={zone}
              projectId={projectId}
              onDelete={
                zone.zone_type === "custom"
                  ? () => handleDeleteZone(zone.id)
                  : undefined
              }
              onPhotoAdded={() => loadZones(inspection.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Dégâts constatés</h3>
          <Button onClick={() => setAddDamageDialogOpen(true)} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un dégât
          </Button>
        </div>
        <DamagesList
          damages={damages}
          onUpdate={() => loadDamages(inspection.id)}
        />
      </div>

      <SignatureCanvasComponent
        signedBy={signedBy}
        onSignedByChange={setSignedBy}
        onSignatureChange={setSignatureData}
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
        <Button variant="outline" disabled>
          <Mail className="h-4 w-4 mr-2" />
          Envoyer au client
        </Button>
        <Button variant="outline" disabled>
          <FileText className="h-4 w-4 mr-2" />
          Voir le PDF
        </Button>
        <Button
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Supprimer
        </Button>
      </div>

      <AddZoneDialog
        open={addZoneDialogOpen}
        onOpenChange={setAddZoneDialogOpen}
        onAdd={handleAddZone}
      />

      <AddDamageDialog
        open={addDamageDialogOpen}
        onOpenChange={setAddDamageDialogOpen}
        inspectionId={inspection.id}
        projectId={projectId}
        zones={zones}
        onAdded={() => loadDamages(inspection.id)}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette prise en main ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les photos et données seront supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
