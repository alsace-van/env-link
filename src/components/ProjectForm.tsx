import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

interface ProjectFormProps {
  onProjectCreated: () => void;
}

interface VehicleCatalog {
  id: string;
  marque: string;
  modele: string;
  longueur_mm?: number;
  largeur_mm?: number;
  hauteur_mm?: number;
  poids_vide_kg?: number;
  ptac_kg?: number;
}

const ProjectForm = ({ onProjectCreated }: ProjectFormProps) => {
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleCatalog[]>([]);
  const [formData, setFormData] = useState({
    nom: "",
    client_name: "",
    marque: "",
    modele: "",
    immatriculation: "",
    numero_chassis_vin: "",
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    const { data, error } = await supabase
      .from("vehicles_catalog")
      .select("*")
      .order("marque", { ascending: true })
      .order("modele", { ascending: true });

    if (error) {
      console.error("Erreur chargement véhicules:", error);
      return;
    }

    setVehicles(data || []);
  };

  const availableMarques = Array.from(new Set(vehicles.map((v) => v.marque))).sort();

  const availableModeles = formData.marque
    ? Array.from(new Set(vehicles.filter((v) => v.marque === formData.marque).map((v) => v.modele))).sort()
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nom) {
      toast.error("Le nom du projet est requis");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      const selectedVehicle = vehicles.find(
        (v) => v.marque === formData.marque && v.modele === formData.modele
      );

      const { error } = await supabase.from("projects").insert({
        nom: formData.nom,
        client_name: formData.client_name || null,
        marque: formData.marque || null,
        modele: formData.modele || null,
        immatriculation: formData.immatriculation || null,
        numero_chassis_vin: formData.numero_chassis_vin || null,
        longueur: selectedVehicle?.longueur_mm || null,
        largeur: selectedVehicle?.largeur_mm || null,
        hauteur: selectedVehicle?.hauteur_mm || null,
        masse_vide: selectedVehicle?.poids_vide_kg || null,
        ptra: selectedVehicle?.ptac_kg || null,
        user_id: user.id,
        statut: "En cours",
      });

      if (error) throw error;

      toast.success("Projet créé avec succès");
      
      // Reset form
      setFormData({
        nom: "",
        client_name: "",
        marque: "",
        modele: "",
        immatriculation: "",
        numero_chassis_vin: "",
      });

      onProjectCreated();
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la création du projet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Nouveau Projet
        </CardTitle>
        <CardDescription>
          Créez un nouveau projet de conversion
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom du projet *</Label>
              <Input
                id="nom"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                placeholder="Ex: Conversion Ford Transit"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_name">Nom du client</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="Nom du propriétaire"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="marque">Marque</Label>
              <Select
                value={formData.marque}
                onValueChange={(value) => setFormData({ ...formData, marque: value, modele: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une marque" />
                </SelectTrigger>
                <SelectContent>
                  {availableMarques.map((marque) => (
                    <SelectItem key={marque} value={marque}>
                      {marque}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modele">Modèle</Label>
              <Select
                value={formData.modele}
                onValueChange={(value) => setFormData({ ...formData, modele: value })}
                disabled={!formData.marque}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un modèle" />
                </SelectTrigger>
                <SelectContent>
                  {availableModeles.map((modele) => (
                    <SelectItem key={modele} value={modele}>
                      {modele}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="immatriculation">Immatriculation</Label>
              <Input
                id="immatriculation"
                value={formData.immatriculation}
                onChange={(e) => setFormData({ ...formData, immatriculation: e.target.value })}
                placeholder="Ex: AB-123-CD"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero_chassis_vin">N° de châssis (VIN)</Label>
              <Input
                id="numero_chassis_vin"
                value={formData.numero_chassis_vin}
                onChange={(e) => setFormData({ ...formData, numero_chassis_vin: e.target.value })}
                placeholder="17 caractères"
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création en cours...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Créer le projet
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProjectForm;
