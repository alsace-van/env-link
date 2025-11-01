import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Scan } from "lucide-react";
import VehicleRegistrationScanner from "./VehicleRegistrationScanner";
import type { VehicleRegistrationData } from "@/lib/registrationCardParser";

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
  const [customPoidsVide, setCustomPoidsVide] = useState<string>("");
  const [customPtac, setCustomPtac] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // États pour les données du scanner OCR
  const [showScanner, setShowScanner] = useState(false);
  const [scannedData, setScannedData] = useState<VehicleRegistrationData | null>(null);
  const [manualImmatriculation, setManualImmatriculation] = useState<string>("");
  const [manualNumeroChassis, setManualNumeroChassis] = useState<string>("");
  const [manualDateMiseCirculation, setManualDateMiseCirculation] = useState<string>("");
  const [manualTypeMine, setManualTypeMine] = useState<string>("");

  // Compute available options for cascade dropdowns
  const availableMarques = Array.from(new Set(vehicles.map((v) => v.marque))).sort();

  const availableModeles = selectedMarque
    ? Array.from(new Set(vehicles.filter((v) => v.marque === selectedMarque).map((v) => v.modele))).sort()
    : [];

  const availableDimensions =
    selectedMarque && selectedModele
      ? vehicles.filter((v) => v.marque === selectedMarque && v.modele === selectedModele)
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
    if (vehicle) {
      setCustomPoidsVide(vehicle.poids_vide_kg?.toString() || "");
      setCustomPtac(vehicle.ptac_kg?.toString() || "");
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScannedData = (data: VehicleRegistrationData) => {
    setScannedData(data);
    
    // Pré-remplir les champs avec les données extraites
    if (data.immatriculation) {
      setManualImmatriculation(data.immatriculation);
    }
    if (data.numeroChassisVIN) {
      setManualNumeroChassis(data.numeroChassisVIN);
    }
    if (data.datePremiereImmatriculation) {
      setManualDateMiseCirculation(data.datePremiereImmatriculation);
    }
    if (data.genreNational) {
      setManualTypeMine(data.genreNational);
    }
    if (data.masseVide) {
      setCustomPoidsVide(data.masseVide.toString());
    }
    if (data.masseEnChargeMax) {
      setCustomPtac(data.masseEnChargeMax.toString());
    }
    
    // Essayer de trouver la marque dans le catalogue
    if (data.marque) {
      const marqueNormalized = data.marque.toUpperCase();
      const foundMarque = availableMarques.find(m => 
        m.toUpperCase().includes(marqueNormalized) || marqueNormalized.includes(m.toUpperCase())
      );
      if (foundMarque) {
        setSelectedMarque(foundMarque);
      }
    }
    
    // Masquer le scanner après extraction réussie
    setShowScanner(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Vous devez être connecté");
      setIsLoading(false);
      return;
    }

    let photoUrl = null;

    // Upload photo if selected
    if (photoFile) {
      const fileExt = photoFile.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from("project-photos").upload(filePath, photoFile);

      if (uploadError) {
        toast.error("Erreur lors de l'upload de la photo");
        console.error(uploadError);
        setIsLoading(false);
        return;
      }

      // Use signed URL with 24 hour expiration for project photos
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from("project-photos")
        .createSignedUrl(filePath, 86400); // 24 hours

      if (urlError || !signedUrlData) {
        toast.error("Erreur lors de la création de l'URL de la photo");
        console.error(urlError);
        setIsLoading(false);
        return;
      }

      photoUrl = signedUrlData.signedUrl;
    }

    const projectData = {
      user_id: user.id,
      nom_projet: (formData.get("nom_projet") as string) || null,
      nom_proprietaire: formData.get("nom_proprietaire") as string,
      adresse_proprietaire: formData.get("adresse_proprietaire") as string,
      telephone_proprietaire: formData.get("telephone_proprietaire") as string,
      email_proprietaire: formData.get("email_proprietaire") as string,
      numero_chassis: manualNumeroChassis || null,
      immatriculation: manualImmatriculation || null,
      date_mise_circulation: manualDateMiseCirculation || null,
      type_mine: manualTypeMine || null,
      photo_url: photoUrl,
      vehicle_catalog_id: selectedVehicle?.id || null,
      longueur_mm: selectedVehicle?.longueur_mm || null,
      largeur_mm: selectedVehicle?.largeur_mm || null,
      hauteur_mm: selectedVehicle?.hauteur_mm || null,
      poids_vide_kg: customPoidsVide ? parseInt(customPoidsVide) : selectedVehicle?.poids_vide_kg || null,
      charge_utile_kg: selectedVehicle?.charge_utile_kg || null,
      ptac_kg: customPtac ? parseInt(customPtac) : selectedVehicle?.ptac_kg || null,
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
    setCustomPoidsVide("");
    setCustomPtac("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setScannedData(null);
    setManualImmatriculation("");
    setManualNumeroChassis("");
    setManualDateMiseCirculation("");
    setManualTypeMine("");
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
        <Button
          type="button"
          variant={showScanner ? "outline" : "default"}
          onClick={() => setShowScanner(!showScanner)}
          className="w-full mt-4"
        >
          <Scan className="h-4 w-4 mr-2" />
          {showScanner ? "Masquer le scanner" : "Scanner une carte grise"}
        </Button>
      </CardHeader>
      <CardContent>
        {showScanner && <VehicleRegistrationScanner onDataExtracted={handleScannedData} />}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Informations Projet</h3>

            <div className="space-y-2">
              <Label htmlFor="nom_projet">Nom du projet</Label>
              <Input id="nom_projet" name="nom_projet" disabled={isLoading} placeholder="Aménagement camping-car" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo_projet">Photo du projet</Label>
              <Input id="photo_projet" type="file" accept="image/*" onChange={handlePhotoChange} disabled={isLoading} />
              {photoPreview && (
                <div className="mt-2">
                  <img src={photoPreview} alt="Aperçu" className="w-full h-32 object-cover rounded-lg" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
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
              <>
                <div className="space-y-2">
                  <Label htmlFor="numero_chassis">Numéro de chassis</Label>
                  <Input
                    id="numero_chassis"
                    name="numero_chassis"
                    value={manualNumeroChassis}
                    onChange={(e) => setManualNumeroChassis(e.target.value)}
                    disabled={isLoading}
                    placeholder="VF1234567890ABCDE"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="immatriculation">Immatriculation</Label>
                  <Input 
                    id="immatriculation" 
                    name="immatriculation" 
                    value={manualImmatriculation}
                    onChange={(e) => setManualImmatriculation(e.target.value)}
                    disabled={isLoading} 
                    placeholder="AB-123-CD" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_mise_circulation">Date de mise en circulation</Label>
                  <Input 
                    id="date_mise_circulation" 
                    name="date_mise_circulation" 
                    type="date" 
                    value={manualDateMiseCirculation}
                    onChange={(e) => setManualDateMiseCirculation(e.target.value)}
                    disabled={isLoading} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type_mine">Type mine</Label>
                  <Input 
                    id="type_mine" 
                    name="type_mine" 
                    value={manualTypeMine}
                    onChange={(e) => setManualTypeMine(e.target.value)}
                    disabled={isLoading} 
                    placeholder="CTTE, VASP, Ambulance..." 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="custom_poids_vide">Poids à vide (kg)</Label>
                    <Input
                      id="custom_poids_vide"
                      type="number"
                      value={customPoidsVide}
                      onChange={(e) => setCustomPoidsVide(e.target.value)}
                      disabled={isLoading}
                      placeholder="1800"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom_ptac">PTAC (kg)</Label>
                    <Input
                      id="custom_ptac"
                      type="number"
                      value={customPtac}
                      onChange={(e) => setCustomPtac(e.target.value)}
                      disabled={isLoading}
                      placeholder="3000"
                    />
                  </div>
                </div>
              </>
            )}

            {selectedVehicle && (
              <div className="p-4 bg-muted/50 rounded-lg text-sm">
                <div className="flex gap-6 justify-between">
                  {/* Dimensions totales */}
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2">Dimensions totales</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">L :</span>
                        <span className="font-medium">{selectedVehicle.longueur_mm} mm</span>
                      </div>
                      {selectedVehicle.largeur_mm && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">l :</span>
                          <span className="font-medium">{selectedVehicle.largeur_mm} mm</span>
                        </div>
                      )}
                      {selectedVehicle.hauteur_mm && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">H :</span>
                          <span className="font-medium">{selectedVehicle.hauteur_mm} mm</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Surface utile */}
                  {(selectedVehicle.longueur_mm || selectedVehicle.largeur_mm) && (
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2 text-blue-600">Surface utile</h4>
                      <div className="space-y-1">
                        {selectedVehicle.longueur_mm && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">L utile :</span>
                            <span className="font-medium">{selectedVehicle.longueur_mm} mm</span>
                          </div>
                        )}
                        {selectedVehicle.largeur_mm && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">l utile :</span>
                            <span className="font-medium">{selectedVehicle.largeur_mm} mm</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Poids */}
                  {(selectedVehicle.poids_vide_kg || selectedVehicle.charge_utile_kg || selectedVehicle.ptac_kg) && (
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2">Poids</h4>
                      <div className="space-y-1">
                        {selectedVehicle.poids_vide_kg && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Vide :</span>
                            <span className="font-medium">{selectedVehicle.poids_vide_kg} kg</span>
                          </div>
                        )}
                        {selectedVehicle.charge_utile_kg && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Charge :</span>
                            <span className="font-medium">{selectedVehicle.charge_utile_kg} kg</span>
                          </div>
                        )}
                        {selectedVehicle.ptac_kg && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">PTAC :</span>
                            <span className="font-medium">{selectedVehicle.ptac_kg} kg</span>
                          </div>
                        )}
                      </div>
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
