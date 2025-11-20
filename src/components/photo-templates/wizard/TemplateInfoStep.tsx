import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface TemplateInfoStepProps {
  projectId: string;
  originalImageUrl: string;
  correctedImageUrl: string;
  markersData: any;
  calibrationData: any;
  onSaved: () => void;
  onBack: () => void;
}

export function TemplateInfoStep({
  projectId,
  originalImageUrl,
  correctedImageUrl,
  markersData,
  calibrationData,
  onSaved,
  onBack,
}: TemplateInfoStepProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "Gabarit " + new Date().toLocaleDateString("fr-FR"),
    description: "",
    type: "panneau_plat",
    material: "",
    thickness_mm: "",
  });

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Le nom du gabarit est requis");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Pour le MVP, sauvegarder les URLs base64 directement
      // TODO: Uploader vers Supabase Storage pour version production
      const { data, error } = await supabase
        .from("photo_templates")
        .insert({
          project_id: projectId,
          user_id: user.id,
          name: formData.name,
          description: formData.description || null,
          type: formData.type,
          material: formData.material || null,
          thickness_mm: formData.thickness_mm ? parseFloat(formData.thickness_mm) : null,
          original_image_url: originalImageUrl,
          markers_image_url: markersData.markersImageUrl,
          corrected_image_url: correctedImageUrl,
          markers_detected: markersData.markerCount,
          marker_ids: markersData.detectedIds,
          scale_factor: calibrationData.scaleFactor,
          accuracy_mm: calibrationData.accuracyMm,
          calibration_data: {
            knownDistanceMm: calibrationData.knownDistanceMm,
            measuredDistancePx: calibrationData.measuredDistancePx,
            calibrationPoints: calibrationData.calibrationPoints,
          },
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Gabarit créé avec succès !");
      queryClient.invalidateQueries({ queryKey: ["photo-templates"] });
      onSaved();
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 py-6">
      <h3 className="text-lg font-semibold">Informations du gabarit</h3>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du gabarit *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Porte latérale droite"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Notes optionnelles..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              value={formData.type}
              onValueChange={(v) => setFormData({ ...formData, type: v })}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="panneau_plat">Panneau plat</SelectItem>
                <SelectItem value="carrosserie">Carrosserie</SelectItem>
                <SelectItem value="meuble">Meuble</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="material">Matériau</Label>
            <Input
              id="material"
              value={formData.material}
              onChange={(e) => setFormData({ ...formData, material: e.target.value })}
              placeholder="Ex: Contreplaqué 12mm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="thickness">Épaisseur (mm)</Label>
            <Input
              id="thickness"
              type="number"
              step="0.1"
              value={formData.thickness_mm}
              onChange={(e) => setFormData({ ...formData, thickness_mm: e.target.value })}
              placeholder="12"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Aperçu</Label>
            <div className="border rounded-lg overflow-hidden">
              <img
                src={correctedImageUrl}
                alt="Aperçu"
                className="w-full h-48 object-cover"
              />
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg space-y-3 text-sm">
            <p className="font-medium">Résumé technique</p>
            <div className="space-y-1">
              <p>
                <span className="text-muted-foreground">Marqueurs:</span>{" "}
                {markersData.markerCount}/9 détectés
              </p>
              <p>
                <span className="text-muted-foreground">Échelle:</span>{" "}
                1px = {(1 / calibrationData.scaleFactor).toFixed(3)}mm
              </p>
              <p>
                <span className="text-muted-foreground">Précision:</span>{" "}
                ±{calibrationData.accuracyMm}mm
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={saving}>
          Retour
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer le gabarit
        </Button>
      </div>
    </div>
  );
}
