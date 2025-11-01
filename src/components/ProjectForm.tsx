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

  // ✅ SOLUTION DE SECOURS : useEffect pour remplir les champs
  // Se déclenche dès que scannedData existe (même si marque/modèle pas trouvés dans catalogue)
  useEffect(() => {
    if (scannedData) {
      console.log("🔄 useEffect : Remplissage des champs avec données scannées...");

      // Remplir uniquement si les champs sont vides (éviter d'écraser une modification manuelle)
      if (!manualImmatriculation && scannedData.immatriculation) {
        console.log("  → Remplissage immatriculation via useEffect");
        setManualImmatriculation(scannedData.immatriculation);
      }
      if (!manualNumeroChassis && scannedData.numeroChassisVIN) {
        console.log("  → Remplissage VIN via useEffect");
        setManualNumeroChassis(scannedData.numeroChassisVIN);
      }
      if (!manualDateMiseCirculation && scannedData.datePremiereImmatriculation) {
        console.log("  → Remplissage date via useEffect");
        setManualDateMiseCirculation(scannedData.datePremiereImmatriculation);
      }
      if (!manualTypeMine && scannedData.genreNational) {
        console.log("  → Remplissage type mine via useEffect");
        setManualTypeMine(scannedData.genreNational);
      }
      if (!customPoidsVide && scannedData.masseVide) {
        console.log("  → Remplissage poids vide via useEffect");
        setCustomPoidsVide(scannedData.masseVide.toString());
      }
      if (!customPtac && scannedData.masseEnChargeMax) {
        console.log("  → Remplissage PTAC via useEffect");
        setCustomPtac(scannedData.masseEnChargeMax.toString());
      }
    }
  }, [scannedData]); // Déclenché dès que scannedData change

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
    console.log("📥 Données reçues du scanner OCR:", data);
    setScannedData(data);

    // IMPORTANT : D'abord sélectionner la marque ET le modèle
    // pour que les champs deviennent visibles
    let marqueFound = false;
    let modeleFound = false;

    // Fonction de normalisation ultra-tolérante
    const normalize = (str: string): string => {
      return str
        .normalize("NFD") // Décompose les caractères accentués
        .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
        .replace(/[^a-z0-9]/gi, "") // Garde seulement lettres et chiffres
        .toUpperCase();
    };

    if (data.marque) {
      const marqueNormalized = normalize(data.marque);
      console.log("🔍 Recherche marque:", data.marque, "→ normalisé:", marqueNormalized);

      // Chercher avec différentes stratégies
      let foundMarque = availableMarques.find((m) => {
        const mNorm = normalize(m);
        // Stratégie 1 : Match exact
        if (mNorm === marqueNormalized) return true;
        // Stratégie 2 : L'un contient l'autre
        if (mNorm.includes(marqueNormalized) || marqueNormalized.includes(mNorm)) return true;
        // Stratégie 3 : Match partiel (au moins 80% de correspondance)
        const minLength = Math.min(mNorm.length, marqueNormalized.length);
        const maxLength = Math.max(mNorm.length, marqueNormalized.length);
        if (minLength / maxLength >= 0.8 && mNorm.startsWith(marqueNormalized.substring(0, 3))) return true;
        return false;
      });

      // Si pas trouvé, essayer avec juste les premiers caractères (PEUG → PEUGEOT)
      if (!foundMarque && marqueNormalized.length >= 4) {
        foundMarque = availableMarques.find((m) => {
          const mNorm = normalize(m);
          return mNorm.startsWith(marqueNormalized.substring(0, 4));
        });
      }

      if (foundMarque) {
        console.log("✅ Marque trouvée:", foundMarque);
        setSelectedMarque(foundMarque);
        marqueFound = true;

        // Essayer aussi de trouver le modèle
        if (data.denominationCommerciale) {
          const modeleNormalized = normalize(data.denominationCommerciale);
          console.log("🔍 Recherche modèle:", data.denominationCommerciale, "→ normalisé:", modeleNormalized);

          const availableModelesForMarque = vehicles.filter((v) => v.marque === foundMarque).map((v) => v.modele);

          let foundModele = availableModelesForMarque.find((m) => {
            const mNorm = normalize(m);
            // Stratégie 1 : Match exact
            if (mNorm === modeleNormalized) return true;
            // Stratégie 2 : L'un contient l'autre
            if (mNorm.includes(modeleNormalized) || modeleNormalized.includes(mNorm)) return true;
            // Stratégie 3 : Match partiel
            const minLength = Math.min(mNorm.length, modeleNormalized.length);
            const maxLength = Math.max(mNorm.length, modeleNormalized.length);
            if (minLength / maxLength >= 0.7 && mNorm.startsWith(modeleNormalized.substring(0, 3))) return true;
            return false;
          });

          // Si pas trouvé, essayer avec juste les premiers caractères
          if (!foundModele && modeleNormalized.length >= 3) {
            foundModele = availableModelesForMarque.find((m) => {
              const mNorm = normalize(m);
              return mNorm.startsWith(modeleNormalized.substring(0, 3));
            });
          }

          if (foundModele) {
            console.log("✅ Modèle trouvé:", foundModele);
            setSelectedModele(foundModele);
            modeleFound = true;
          } else {
            console.log("❌ Modèle non trouvé. Modèles disponibles:", availableModelesForMarque);
          }
        }
      } else {
        console.log("❌ Marque non trouvée. Marques disponibles:", availableMarques);
      }
    }

    // Utiliser setTimeout pour s'assurer que marque/modèle sont définis
    // et que les champs sont rendus AVANT de les remplir
    setTimeout(() => {
      console.log("📝 Remplissage des champs...");

      // Pré-remplir les champs avec les données extraites
      if (data.immatriculation) {
        console.log("  → Immatriculation:", data.immatriculation);
        setManualImmatriculation(data.immatriculation);
      }
      if (data.numeroChassisVIN) {
        console.log("  → VIN:", data.numeroChassisVIN);
        setManualNumeroChassis(data.numeroChassisVIN);
      }
      if (data.datePremiereImmatriculation) {
        console.log("  → Date:", data.datePremiereImmatriculation);
        setManualDateMiseCirculation(data.datePremiereImmatriculation);
      }
      if (data.genreNational) {
        console.log("  → Type mine:", data.genreNational);
        setManualTypeMine(data.genreNational);
      }
      if (data.masseVide) {
        console.log("  → Poids vide:", data.masseVide);
        setCustomPoidsVide(data.masseVide.toString());
      }
      if (data.masseEnChargeMax) {
        console.log("  → PTAC:", data.masseEnChargeMax);
        setCustomPtac(data.masseEnChargeMax.toString());
      }

      // Toast informatif
      if (marqueFound && modeleFound) {
        toast.success(`✅ Données remplies automatiquement !`, {
          duration: 3000,
          description: `Marque: ${data.marque} | Modèle: ${data.denominationCommerciale}`,
        });
      } else if (marqueFound) {
        toast.warning(`⚠️ Marque trouvée : ${data.marque}`, {
          duration: 4000,
          description: "Sélectionnez le modèle manuellement. Les autres champs sont remplis.",
        });
      } else {
        toast.warning(`⚠️ Marque "${data.marque}" non trouvée dans le catalogue`, {
          duration: 4000,
          description: "Sélectionnez marque et modèle manuellement. Les autres champs sont remplis.",
        });
      }
    }, 100); // Petit délai pour laisser React mettre à jour le DOM

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

            {/* Champs de carte grise - TOUJOURS VISIBLES si des données OCR ont été scannées OU si marque+modèle sélectionnés */}
            {(scannedData || (selectedMarque && selectedModele)) && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="numero_chassis">Numéro de chassis (VIN - 17 car.)</Label>
                  <Input
                    id="numero_chassis"
                    name="numero_chassis"
                    value={manualNumeroChassis}
                    onChange={(e) => setManualNumeroChassis(e.target.value)}
                    disabled={isLoading}
                    placeholder="VF1234567890ABCDE"
                    maxLength={17}
                  />
                  {manualNumeroChassis && manualNumeroChassis.length > 0 && manualNumeroChassis.length !== 17 && (
                    <p className="text-xs text-yellow-600">
                      ⚠️ Le VIN doit faire 17 caractères ({manualNumeroChassis.length}/17)
                    </p>
                  )}
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
