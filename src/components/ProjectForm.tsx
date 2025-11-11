import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { toast } from "sonner";
import { Plus, Scan, RotateCcw } from "lucide-react";
import VehicleRegistrationScanner from "./VehicleRegistrationScanner";
import type { VehicleRegistrationData } from "@/lib/registrationCardParser";

interface VehicleCatalog {
  id: string;
  marque: string;
  modele: string;
  dimension?: string; // L1H1, L2H2, etc.
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
  const [selectedDimension, setSelectedDimension] = useState<string>("");
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

  // États pour les dialogues de création
  const [showCreateMarqueDialog, setShowCreateMarqueDialog] = useState(false);
  const [showCreateModeleDialog, setShowCreateModeleDialog] = useState(false);
  const [newMarqueToCreate, setNewMarqueToCreate] = useState<string>("");
  const [newModeleToCreate, setNewModeleToCreate] = useState<string>("");

  // Compute available options for cascade dropdowns
  const availableMarques = Array.from(new Set(vehicles.map((v) => v.marque))).sort();

  const availableModeles = selectedMarque
    ? Array.from(new Set(vehicles.filter((v) => v.marque === selectedMarque).map((v) => v.modele))).sort()
    : [];

  const availableDimensions =
    selectedMarque && selectedModele
      ? Array.from(
          new Set(
            vehicles
              .filter((v) => v.marque === selectedMarque && v.modele === selectedModele && v.dimension)
              .map((v) => v.dimension!),
          ),
        ).sort()
      : [];

  const matchingVehicle =
    selectedMarque && selectedModele && selectedDimension
      ? vehicles.find(
          (v) => v.marque === selectedMarque && v.modele === selectedModele && v.dimension === selectedDimension,
        )
      : null;

  useEffect(() => {
    loadVehicles();
  }, []);

  // ✅ useEffect pour remplir les champs avec les données scannées
  // IMPORTANT: On écrase TOUJOURS les champs avec les nouvelles données scannées
  // car l'utilisateur vient de confirmer ces données dans la modale
  useEffect(() => {
    if (scannedData) {
      console.log("🔄 useEffect : Remplissage des champs avec données scannées...");

      // Remplir TOUS les champs avec les données validées (on écrase les anciennes valeurs)
      if (scannedData.immatriculation) {
        console.log("  → Remplissage immatriculation:", scannedData.immatriculation);
        setManualImmatriculation(scannedData.immatriculation);
      }
      if (scannedData.numeroChassisVIN) {
        console.log("  → Remplissage VIN:", scannedData.numeroChassisVIN);
        setManualNumeroChassis(scannedData.numeroChassisVIN);
      }
      if (scannedData.datePremiereImmatriculation) {
        console.log("  → Remplissage date:", scannedData.datePremiereImmatriculation);
        setManualDateMiseCirculation(scannedData.datePremiereImmatriculation);
      }
      if (scannedData.genreNational) {
        console.log("  → Remplissage type mine:", scannedData.genreNational);
        setManualTypeMine(scannedData.genreNational);
      }
      if (scannedData.masseVide) {
        console.log("  → Remplissage poids vide:", scannedData.masseVide);
        setCustomPoidsVide(scannedData.masseVide.toString());
      }
      if (scannedData.masseEnChargeMax) {
        console.log("  → Remplissage PTAC:", scannedData.masseEnChargeMax);
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
    setSelectedDimension("");
    setSelectedVehicle(null);
  };

  const handleModeleChange = (modele: string) => {
    setSelectedModele(modele);
    setSelectedDimension("");
    setSelectedVehicle(null);
  };

  const handleDimensionChange = (dimension: string) => {
    setSelectedDimension(dimension);
    const vehicle = vehicles.find(
      (v) => v.marque === selectedMarque && v.modele === selectedModele && v.dimension === dimension,
    );
    setSelectedVehicle(vehicle || null);
    if (vehicle) {
      setCustomPoidsVide(vehicle.poids_vide_kg?.toString() || "");
      setCustomPtac(vehicle.ptac_kg?.toString() || "");
    }
  };

  // Utiliser matchingVehicle pour détecter quand un véhicule complet est sélectionné
  useEffect(() => {
    if (matchingVehicle && matchingVehicle !== selectedVehicle) {
      setSelectedVehicle(matchingVehicle);
    }
  }, [matchingVehicle, selectedVehicle]);

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

    // ✅ VÉRIFIER QUE VEHICLES EST CHARGÉ
    if (vehicles.length === 0) {
      console.warn("⚠️  vehicles_catalog pas encore chargé, rechargement...");
      loadVehicles().then(() => {
        handleScannedData(data);
      });
      return;
    }

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

      // ✅ CORRECTION : Extraire availableMarques MAINTENANT (pas au render)
      const currentAvailableMarques = Array.from(new Set(vehicles.map((v) => v.marque))).sort();
      console.log(`📊 ${currentAvailableMarques.length} marques disponibles:`, currentAvailableMarques);

      // Chercher avec différentes stratégies
      let foundMarque = currentAvailableMarques.find((m) => {
        const mNorm = normalize(m);
        console.log(`  🔎 Comparaison: "${m}" (${mNorm}) vs "${data.marque}" (${marqueNormalized})`);

        // Stratégie 1 : Match exact
        if (mNorm === marqueNormalized) {
          console.log(`    ✅ Match exact trouvé !`);
          return true;
        }

        // Stratégie 2 : L'un contient l'autre
        if (mNorm.includes(marqueNormalized) || marqueNormalized.includes(mNorm)) {
          console.log(`    ✅ Match partiel trouvé (inclusion) !`);
          return true;
        }

        // Stratégie 3 : Match partiel (au moins 80% de correspondance)
        const minLength = Math.min(mNorm.length, marqueNormalized.length);
        const maxLength = Math.max(mNorm.length, marqueNormalized.length);
        if (minLength / maxLength >= 0.8 && mNorm.startsWith(marqueNormalized.substring(0, 3))) {
          console.log(`    ✅ Match 80% trouvé !`);
          return true;
        }

        return false;
      });

      // Si pas trouvé, essayer avec juste les premiers caractères (PEUG → PEUGEOT)
      if (!foundMarque && marqueNormalized.length >= 4) {
        console.log(`  🔎 Tentative avec préfixe de 4 caractères: ${marqueNormalized.substring(0, 4)}`);
        foundMarque = currentAvailableMarques.find((m) => {
          const mNorm = normalize(m);
          const match = mNorm.startsWith(marqueNormalized.substring(0, 4));
          if (match) console.log(`    ✅ Match préfixe trouvé: ${m}`);
          return match;
        });
      }

      if (foundMarque) {
        console.log("✅✅✅ MARQUE TROUVÉE DANS LA BASE:", foundMarque);
        setSelectedMarque(foundMarque);

        // Essayer aussi de trouver le modèle
        if (data.denominationCommerciale) {
          const modeleNormalized = normalize(data.denominationCommerciale);
          console.log("🔍 Recherche modèle:", data.denominationCommerciale, "→ normalisé:", modeleNormalized);

          const availableModelesForMarque = vehicles
            .filter((v) => v.marque === foundMarque)
            .map((v) => v.modele);

          console.log(`📊 ${availableModelesForMarque.length} modèles pour ${foundMarque}:`, availableModelesForMarque);

          const foundModele = Array.from(new Set(availableModelesForMarque)).find((m) => {
            const mNorm = normalize(m);
            console.log(`  🔎 Comparaison modèle: "${m}" (${mNorm}) vs "${data.denominationCommerciale}" (${modeleNormalized})`);
            const match = mNorm.includes(modeleNormalized) || modeleNormalized.includes(mNorm);
            if (match) console.log(`    ✅ Match modèle trouvé !`);
            return match;
          });

          if (foundModele) {
            console.log("✅✅✅ MODÈLE TROUVÉ DANS LA BASE:", foundModele);
            setSelectedModele(foundModele);
            toast.success(`Marque et modèle trouvés : ${foundMarque} ${foundModele}`, {
              duration: 3000,
            });
          } else {
            console.log("❌ Modèle non trouvé, proposition de création");
            // Modèle non trouvé, proposer de le créer
            setNewModeleToCreate(data.denominationCommerciale);
            setShowCreateModeleDialog(true);
          }
        } else {
          toast.success(`Marque trouvée : ${foundMarque}. Sélectionnez le modèle manuellement.`, {
            duration: 4000,
          });
        }
      } else {
        // Marque non trouvée, proposer de la créer
        console.log("❌❌❌ MARQUE NON TROUVÉE:", data.marque);
        console.log("  Liste des marques dans vehicles:", currentAvailableMarques);
        setNewMarqueToCreate(data.marque);
        setShowCreateMarqueDialog(true);
      }
    }
  };

  const handleRescanMarque = () => {
    setShowScanner(true);
    toast.info("Scanner la carte grise pour extraire la marque", { duration: 2000 });
  };

  const handleRescanModele = () => {
    setShowScanner(true);
    toast.info("Scanner la carte grise pour extraire le modèle", { duration: 2000 });
  };

  const handleCreateMarque = async () => {
    if (!newMarqueToCreate.trim()) {
      toast.error("Veuillez entrer un nom de marque");
      return;
    }

    // Ajouter la marque temporairement à la liste locale
    setSelectedMarque(newMarqueToCreate.trim());
    setShowCreateMarqueDialog(false);
    toast.success(`Marque "${newMarqueToCreate}" ajoutée temporairement. Sélectionnez le modèle.`);

    // Note: La marque sera ajoutée à la BDD lors de la création du projet
  };

  const handleCreateModele = async () => {
    if (!newModeleToCreate.trim()) {
      toast.error("Veuillez entrer un nom de modèle");
      return;
    }

    // Ajouter le modèle temporairement à la liste locale
    setSelectedModele(newModeleToCreate.trim());
    setShowCreateModeleDialog(false);
    toast.success(`Modèle "${newModeleToCreate}" ajouté temporairement.`);

    // Note: Le modèle sera ajouté à la BDD lors de la création du projet
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

      // Use public URL (permanent, no expiration)
      const { data: publicUrlData } = supabase.storage.from("project-photos").getPublicUrl(filePath);

      if (!publicUrlData) {
        toast.error("Erreur lors de la création de l'URL de la photo");
        setIsLoading(false);
        return;
      }

      photoUrl = publicUrlData.publicUrl;
    }

    const projectData = {
      created_by: user.id,
      user_id: user.id,
      nom: (formData.get("nom_projet") as string) || "Nouveau projet",
      nom_proprietaire: formData.get("nom_proprietaire") as string,
      adresse_proprietaire: formData.get("adresse_proprietaire") as string,
      telephone_proprietaire: formData.get("telephone_proprietaire") as string,
      email_proprietaire: formData.get("email_proprietaire") as string,
      numero_chassis: manualNumeroChassis || null,
      immatriculation: manualImmatriculation || null,
      date_premiere_circulation: manualDateMiseCirculation || null,
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
    
    // Petit délai pour laisser la BDD persister les données
    setTimeout(() => {
      onProjectCreated();
    }, 200);
  };

  return (
    <>
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
                <Input
                  id="photo_projet"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  disabled={isLoading}
                />
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
                <div className="flex gap-2">
                  <Select value={selectedMarque} onValueChange={handleMarqueChange} required disabled={isLoading}>
                    <SelectTrigger className="flex-1">
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleRescanMarque}
                    disabled={isLoading}
                    title="Re-scanner la carte grise"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {selectedMarque && (
                <div className="space-y-2">
                  <Label htmlFor="modele">Modèle *</Label>
                  <div className="flex gap-2">
                    <Select value={selectedModele} onValueChange={handleModeleChange} required disabled={isLoading}>
                      <SelectTrigger className="flex-1">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleRescanModele}
                      disabled={isLoading}
                      title="Re-scanner la carte grise"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {selectedMarque && selectedModele && availableDimensions.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="dimension">Dimensions (L×H) *</Label>
                  <Select value={selectedDimension} onValueChange={handleDimensionChange} required disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez les dimensions" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDimensions.map((dimension) => (
                        <SelectItem key={dimension} value={dimension}>
                          {dimension}
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

              {matchingVehicle && (
                <div className="p-4 bg-muted/50 rounded-lg text-sm">
                  <div className="flex gap-6 justify-between">
                    {/* Dimensions totales */}
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2">Dimensions totales</h4>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">L :</span>
                          <span className="font-medium">{matchingVehicle.longueur_mm} mm</span>
                        </div>
                        {matchingVehicle.largeur_mm && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">l :</span>
                            <span className="font-medium">{matchingVehicle.largeur_mm} mm</span>
                          </div>
                        )}
                        {matchingVehicle.hauteur_mm && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">H :</span>
                            <span className="font-medium">{matchingVehicle.hauteur_mm} mm</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Surface utile */}
                    {(matchingVehicle.longueur_mm || matchingVehicle.largeur_mm) && (
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2 text-blue-600">Surface utile</h4>
                        <div className="space-y-1">
                          {matchingVehicle.longueur_mm && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">L utile :</span>
                              <span className="font-medium">{matchingVehicle.longueur_mm} mm</span>
                            </div>
                          )}
                          {matchingVehicle.largeur_mm && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">l utile :</span>
                              <span className="font-medium">{matchingVehicle.largeur_mm} mm</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Poids */}
                    {(matchingVehicle.poids_vide_kg || matchingVehicle.charge_utile_kg || matchingVehicle.ptac_kg) && (
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2">Poids</h4>
                        <div className="space-y-1">
                          {matchingVehicle.poids_vide_kg && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Vide :</span>
                              <span className="font-medium">{matchingVehicle.poids_vide_kg} kg</span>
                            </div>
                          )}
                          {matchingVehicle.charge_utile_kg && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Charge :</span>
                              <span className="font-medium">{matchingVehicle.charge_utile_kg} kg</span>
                            </div>
                          )}
                          {matchingVehicle.ptac_kg && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">PTAC :</span>
                              <span className="font-medium">{matchingVehicle.ptac_kg} kg</span>
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

      {/* Dialogue de création de marque */}
      <AlertDialog open={showCreateMarqueDialog} onOpenChange={setShowCreateMarqueDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marque non trouvée</AlertDialogTitle>
            <AlertDialogDescription>
              La marque "{newMarqueToCreate}" n'existe pas dans le catalogue. Voulez-vous l'ajouter ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="new_marque">Nom de la marque</Label>
            <Input
              id="new_marque"
              value={newMarqueToCreate}
              onChange={(e) => setNewMarqueToCreate(e.target.value)}
              placeholder="Ex: Peugeot"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateMarque}>Ajouter la marque</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogue de création de modèle */}
      <AlertDialog open={showCreateModeleDialog} onOpenChange={setShowCreateModeleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modèle non trouvé</AlertDialogTitle>
            <AlertDialogDescription>
              Le modèle "{newModeleToCreate}" n'existe pas dans le catalogue pour la marque {selectedMarque}.
              Voulez-vous l'ajouter ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="new_modele">Nom du modèle</Label>
            <Input
              id="new_modele"
              value={newModeleToCreate}
              onChange={(e) => setNewModeleToCreate(e.target.value)}
              placeholder="Ex: Boxer"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateModele}>Ajouter le modèle</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProjectForm;
