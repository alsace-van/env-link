import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface VehicleCatalog {
  id: string;
  marque: string;
  modele: string;
  longueur_mm: number;
  largeur_mm?: number;
  hauteur_mm?: number;
  poids_vide_kg?: number;
  charge_utile_kg?: number;
  ptac_kg?: number;
}

interface ProjectFormProps {
  onProjectCreated: () => void;
}

const ProjectForm = ({ onProjectCreated }: ProjectFormProps) => {
  const [vehicles, setVehicles] = useState<VehicleCatalog[]>([]);
  const [selectedMarque, setSelectedMarque] = useState<string>("");
  const [selectedModele, setSelectedModele] = useState<string>("");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleCatalog | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Compute available options for cascade dropdowns
  const availableMarques = Array.from(new Set(vehicles.map(v => v.marque))).sort();
  
  const availableModeles = selectedMarque
    ? Array.from(new Set(
        vehicles
          .filter(v => v.marque === selectedMarque)
          .map(v => v.modele)
      )).sort()
    : [];
  
  const availableDimensions = (selectedMarque && selectedModele)
    ? vehicles.filter(v => v.marque === selectedMarque && v.modele === selectedModele)
    : [];

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
      toast.error("Erreur lors du chargement des véhicules");
      return;
    }

    setVehicles(data || []);
  };

  const handleMarqueChange = (marque: string) => {
    setSelectedMarque(marque);
    setSelectedModele("");
    setSelectedVehicle(null);
  };

  const handleModeleChange = (modele: string) => {
    setSelectedModele(modele);
    setSelectedVehicle(null);
  };

  const handleDimensionChange = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    setSelectedVehicle(vehicle || null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Vous devez être connecté");
      setIsLoading(false);
      return;
    }

    const projectData = {
      user_id: user.id,
      nom_proprietaire: formData.get("nom_proprietaire") as string,
      adresse_proprietaire: formData.get("adresse_proprietaire") as string,
      telephone_proprietaire: formData.get("telephone_proprietaire") as string,
      email_proprietaire: formData.get("email_proprietaire") as string,
      vehicle_catalog_id: selectedVehicle?.id || null,
      longueur_mm: selectedVehicle?.longueur_mm || null,
      largeur_mm: selectedVehicle?.largeur_mm || null,
      hauteur_mm: selectedVehicle?.hauteur_mm || null,
      poids_vide_kg: selectedVehicle?.poids_vide_kg || null,
      charge_utile_kg: selectedVehicle?.charge_utile_kg || null,
      ptac_kg: selectedVehicle?.ptac_kg || null,
    };

    const { error } = await supabase.from("projects").insert(projectData);

    setIsLoading(false);

    if (error) {
      toast.error("Erreur lors de la création du projet");
      console.error(error);
      return;
    }

    toast.success("Projet créé avec succès !");
    e.currentTarget.reset();
    setSelectedMarque("");
    setSelectedModele("");
    setSelectedVehicle(null);
    onProjectCreated();
  };

  return (
    <Card className="h-fit sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Nouveau Projet
        </CardTitle>
        <CardDescription>Créez un nouveau projet d'aménagement</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Informations Propriétaire</h3>
            
            <div className="space-y-2">
              <Label htmlFor="nom_proprietaire">Nom du propriétaire *</Label>
              <Input
                id="nom_proprietaire"
                name="nom_proprietaire"
                required
                disabled={isLoading}
                placeholder="Jean Dupont"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adresse_proprietaire">Adresse</Label>
              <Input
                id="adresse_proprietaire"
                name="adresse_proprietaire"
                disabled={isLoading}
                placeholder="123 rue de la Paix, 75000 Paris"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telephone_proprietaire">Téléphone</Label>
              <Input
                id="telephone_proprietaire"
                name="telephone_proprietaire"
                type="tel"
                disabled={isLoading}
                placeholder="06 12 34 56 78"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_proprietaire">Email</Label>
              <Input
                id="email_proprietaire"
                name="email_proprietaire"
                type="email"
                disabled={isLoading}
                placeholder="contact@example.com"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-muted-foreground">Informations Véhicule</h3>
            
            <div className="space-y-2">
              <Label htmlFor="marque">Marque *</Label>
              <Select value={selectedMarque} onValueChange={handleMarqueChange} required disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez une marque" />
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

            {selectedMarque && (
              <div className="space-y-2">
                <Label htmlFor="modele">Modèle *</Label>
                <Select value={selectedModele} onValueChange={handleModeleChange} required disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un modèle" />
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
            )}

            {selectedMarque && selectedModele && availableDimensions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="dimension">Dimensions *</Label>
                <Select value={selectedVehicle?.id} onValueChange={handleDimensionChange} required disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez les dimensions" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDimensions.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        L: {vehicle.longueur_mm}mm × l: {vehicle.largeur_mm}mm × H: {vehicle.hauteur_mm}mm
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedVehicle && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Longueur:</span>
                    <span className="ml-2 font-medium">{selectedVehicle.longueur_mm} mm</span>
                  </div>
                  {selectedVehicle.largeur_mm && (
                    <div>
                      <span className="text-muted-foreground">Largeur:</span>
                      <span className="ml-2 font-medium">{selectedVehicle.largeur_mm} mm</span>
                    </div>
                  )}
                  {selectedVehicle.hauteur_mm && (
                    <div>
                      <span className="text-muted-foreground">Hauteur:</span>
                      <span className="ml-2 font-medium">{selectedVehicle.hauteur_mm} mm</span>
                    </div>
                  )}
                  {selectedVehicle.poids_vide_kg && (
                    <div>
                      <span className="text-muted-foreground">Poids vide:</span>
                      <span className="ml-2 font-medium">{selectedVehicle.poids_vide_kg} kg</span>
                    </div>
                  )}
                  {selectedVehicle.charge_utile_kg && (
                    <div>
                      <span className="text-muted-foreground">Charge utile:</span>
                      <span className="ml-2 font-medium">{selectedVehicle.charge_utile_kg} kg</span>
                    </div>
                  )}
                  {selectedVehicle.ptac_kg && (
                    <div>
                      <span className="text-muted-foreground">PTAC:</span>
                      <span className="ml-2 font-medium">{selectedVehicle.ptac_kg} kg</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Création..." : "Créer le projet"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProjectForm;
