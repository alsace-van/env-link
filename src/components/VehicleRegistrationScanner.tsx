import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Upload, X, Sparkles, Loader2, Settings2, FileText, PenLine } from "lucide-react";
import { toast } from "sonner";
import { ScanConfirmationModal } from "./ScanConfirmationModal";
import { useAIConfig } from "@/hooks/useAIConfig";
import { AIConfigDialog } from "@/components/AIConfigDialog";
import { callAI, parseAIJsonResponse } from "@/services/aiService";
import type { VehicleRegistrationData } from "@/lib/registrationCardParser";

interface VehicleRegistrationScannerProps {
  onDataExtracted: (data: VehicleRegistrationData) => void;
}

/**
 * VehicleRegistrationScanner - VERSION MULTI-IA + SAISIE MANUELLE
 *
 * 2 modes :
 * - Scan IA : L'utilisateur configure sa propre clé API
 * - Saisie manuelle : L'utilisateur entre les données à la main
 */
export const VehicleRegistrationScanner = ({ onDataExtracted }: VehicleRegistrationScannerProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<VehicleRegistrationData | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("scan");

  // Formulaire manuel
  const [manualData, setManualData] = useState<VehicleRegistrationData>({
    vin: "",
    immatriculation: "",
    marque: "",
    modele: "",
    typeVariante: "",
    datePremiereImmatriculation: "",
    dateImmatriculation: "",
    genre: "",
    carrosserie: "",
    couleur: "",
    placesAssises: null,
    placesDebout: null,
    ptac: null,
    ptra: null,
    poidsVide: null,
    puissanceFiscale: null,
    puissanceKw: null,
    cylindree: null,
    energie: "",
    co2: null,
    nomProprietaire: "",
    prenomProprietaire: "",
    adresse: "",
    codePostal: "",
    ville: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentImageBase64Ref = useRef<string | null>(null);

  // Configuration IA centralisée
  const { config: aiConfig, isConfigured: aiIsConfigured, providerInfo: aiProviderInfo } = useAIConfig();

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }

    // Vérifier que l'IA est configurée
    if (!aiIsConfigured) {
      setShowAiConfig(true);
      toast.error("Veuillez d'abord configurer votre clé API IA");
      return;
    }

    // Afficher l'aperçu
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Lancer le scan
    await scanWithAI(file);
  };

  const scanWithAI = async (file: File) => {
    setIsProcessing(true);
    setProgress(10);

    try {
      console.log(`🚀 Scan avec ${aiProviderInfo.name}...`);
      toast.info(`Analyse avec ${aiProviderInfo.name}...`);

      const base64 = await fileToBase64(file);
      currentImageBase64Ref.current = base64;
      setProgress(30);

      const prompt = `Analyse cette image de carte grise française et extrait toutes les informations.

Retourne UNIQUEMENT un JSON valide avec ces champs (utilise null si non trouvé):
{
  "vin": "numéro VIN (champ E)",
  "immatriculation": "plaque d'immatriculation (champ A)",
  "marque": "marque du véhicule (champ D.1)",
  "modele": "modèle/variante (champ D.2)",
  "type_variante": "type variante version (champ D.2)",
  "date_premiere_immatriculation": "date format JJ/MM/AAAA (champ B)",
  "date_immatriculation": "date carte grise (champ I)",
  "genre": "genre national (champ J.1)",
  "carrosserie": "carrosserie CE (champ J.2)", 
  "couleur": "couleur",
  "places_assises": nombre de places (champ S.1),
  "places_debout": nombre places debout (champ S.2),
  "ptac": poids PTAC en kg (champ F.2),
  "ptra": poids PTRA en kg (champ F.3),
  "poids_vide": poids à vide en kg (champ G),
  "puissance_fiscale": puissance fiscale CV (champ P.6),
  "puissance_kw": puissance en kW (champ P.2),
  "cylindree": cylindrée en cm3 (champ P.1),
  "energie": "type énergie/carburant (champ P.3)",
  "co2": émission CO2 g/km (champ V.7),
  "nom_proprietaire": "nom du titulaire (champ C.1)",
  "prenom_proprietaire": "prénom du titulaire",
  "adresse": "adresse complète (champ C.3)",
  "code_postal": "code postal",
  "ville": "ville"
}

IMPORTANT: Retourne UNIQUEMENT le JSON, sans markdown ni texte.`;

      const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
      const mimeType = base64.includes("data:") ? base64.split(";")[0].split(":")[1] : "image/jpeg";

      const response = await callAI({
        provider: aiConfig.provider,
        apiKey: aiConfig.apiKey,
        prompt,
        imageBase64: base64Data,
        imageMimeType: mimeType,
      });

      setProgress(70);

      if (!response.success || !response.text) {
        throw new Error(response.error || "Erreur lors du scan");
      }

      const parsedData = parseAIJsonResponse<any>(response.text);
      if (!parsedData) {
        throw new Error("Format de réponse invalide");
      }

      const scanResult = mapAIResponseToVehicleData(parsedData);

      setProgress(90);
      setExtractedData(scanResult);
      setShowConfirmModal(true);
      setProgress(100);

      toast.success("Carte grise analysée avec succès !");

    } catch (error: any) {
      console.error("❌ Erreur:", error);
      toast.error(error.message || "Erreur lors du scan de la carte grise");
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const mapAIResponseToVehicleData = (data: any): VehicleRegistrationData => {
    return {
      vin: data.vin || "",
      immatriculation: data.immatriculation || "",
      marque: data.marque || "",
      modele: data.modele || "",
      typeVariante: data.type_variante || data.typeVariante || "",
      datePremiereImmatriculation: data.date_premiere_immatriculation || data.datePremiereImmatriculation || "",
      dateImmatriculation: data.date_immatriculation || data.dateImmatriculation || "",
      genre: data.genre || "",
      carrosserie: data.carrosserie || "",
      couleur: data.couleur || "",
      placesAssises: data.places_assises || data.placesAssises || null,
      placesDebout: data.places_debout || data.placesDebout || null,
      ptac: data.ptac || null,
      ptra: data.ptra || null,
      poidsVide: data.poids_vide || data.poidsVide || null,
      puissanceFiscale: data.puissance_fiscale || data.puissanceFiscale || null,
      puissanceKw: data.puissance_kw || data.puissanceKw || null,
      cylindree: data.cylindree || null,
      energie: data.energie || "",
      co2: data.co2 || null,
      nomProprietaire: data.nom_proprietaire || data.nomProprietaire || "",
      prenomProprietaire: data.prenom_proprietaire || data.prenomProprietaire || "",
      adresse: data.adresse || "",
      codePostal: data.code_postal || data.codePostal || "",
      ville: data.ville || "",
    };
  };

  const handleConfirmData = (confirmedData: VehicleRegistrationData) => {
    onDataExtracted(confirmedData);
    setShowConfirmModal(false);
    setImagePreview(null);
    setExtractedData(null);
    toast.success("Données du véhicule importées !");
  };

  const handleRescan = async () => {
    if (currentImageBase64Ref.current) {
      setShowConfirmModal(false);
      const response = await fetch(currentImageBase64Ref.current);
      const blob = await response.blob();
      const file = new File([blob], "rescan.jpg", { type: blob.type });
      await scanWithAI(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const clearImage = () => {
    setImagePreview(null);
    setExtractedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Saisie manuelle
  const handleManualChange = (field: keyof VehicleRegistrationData, value: string | number | null) => {
    setManualData(prev => ({ ...prev, [field]: value }));
  };

  const handleManualSubmit = () => {
    if (!manualData.immatriculation && !manualData.vin) {
      toast.error("Veuillez renseigner au moins l'immatriculation ou le VIN");
      return;
    }
    onDataExtracted(manualData);
    toast.success("Données du véhicule enregistrées !");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Importer les données du véhicule
          </CardTitle>
          <CardDescription>
            Scannez la carte grise avec l'IA ou saisissez les données manuellement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="scan" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Scan IA
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <PenLine className="h-4 w-4" />
                Saisie manuelle
              </TabsTrigger>
            </TabsList>

            {/* Onglet Scan IA */}
            <TabsContent value="scan" className="space-y-4">
              {/* Config IA */}
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">
                    {aiIsConfigured ? `IA : ${aiProviderInfo.name}` : "IA non configurée"}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowAiConfig(true)}>
                  <Settings2 className="h-4 w-4 mr-1" />
                  {aiIsConfigured ? "Modifier" : "Configurer"}
                </Button>
              </div>

              {/* Zone d'upload */}
              {!imagePreview ? (
                <div className={`border-2 border-dashed rounded-lg p-8 text-center ${!aiIsConfigured ? 'opacity-50' : ''}`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                    id="carte-grise-upload"
                    disabled={!aiIsConfigured}
                  />
                  <label htmlFor="carte-grise-upload" className={aiIsConfigured ? "cursor-pointer" : "cursor-not-allowed"}>
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">Cliquez pour sélectionner une image</p>
                    <p className="text-sm text-muted-foreground">ou prenez une photo de la carte grise</p>
                  </label>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Aperçu carte grise"
                    className="w-full rounded-lg max-h-64 object-contain bg-muted"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={clearImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Barre de progression */}
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Analyse en cours avec {aiProviderInfo.name}...</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              {!aiIsConfigured && (
                <p className="text-sm text-muted-foreground text-center">
                  Configurez votre clé IA pour utiliser le scan automatique, ou passez en saisie manuelle.
                </p>
              )}
            </TabsContent>

            {/* Onglet Saisie manuelle */}
            <TabsContent value="manual" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Identification */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground">Identification</h4>
                  <div className="space-y-2">
                    <Label htmlFor="immat">Immatriculation (A)</Label>
                    <Input
                      id="immat"
                      placeholder="AA-123-BB"
                      value={manualData.immatriculation}
                      onChange={(e) => handleManualChange("immatriculation", e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vin">N° VIN (E)</Label>
                    <Input
                      id="vin"
                      placeholder="VF7..."
                      value={manualData.vin}
                      onChange={(e) => handleManualChange("vin", e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date1">1ère immat. (B)</Label>
                    <Input
                      id="date1"
                      placeholder="JJ/MM/AAAA"
                      value={manualData.datePremiereImmatriculation}
                      onChange={(e) => handleManualChange("datePremiereImmatriculation", e.target.value)}
                    />
                  </div>
                </div>

                {/* Véhicule */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground">Véhicule</h4>
                  <div className="space-y-2">
                    <Label htmlFor="marque">Marque (D.1)</Label>
                    <Input
                      id="marque"
                      placeholder="FIAT, RENAULT..."
                      value={manualData.marque}
                      onChange={(e) => handleManualChange("marque", e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modele">Modèle (D.2)</Label>
                    <Input
                      id="modele"
                      placeholder="DUCATO, MASTER..."
                      value={manualData.modele}
                      onChange={(e) => handleManualChange("modele", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="genre">Genre (J.1)</Label>
                    <Input
                      id="genre"
                      placeholder="CTTE, VP, VASP..."
                      value={manualData.genre}
                      onChange={(e) => handleManualChange("genre", e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                {/* Poids */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground">Poids (kg)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="ptac">PTAC (F.2)</Label>
                      <Input
                        id="ptac"
                        type="number"
                        placeholder="3500"
                        value={manualData.ptac || ""}
                        onChange={(e) => handleManualChange("ptac", e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ptra">PTRA (F.3)</Label>
                      <Input
                        id="ptra"
                        type="number"
                        placeholder="5500"
                        value={manualData.ptra || ""}
                        onChange={(e) => handleManualChange("ptra", e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="poidsVide">Poids à vide (G)</Label>
                    <Input
                      id="poidsVide"
                      type="number"
                      placeholder="2000"
                      value={manualData.poidsVide || ""}
                      onChange={(e) => handleManualChange("poidsVide", e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </div>
                </div>

                {/* Places */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground">Places</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="placesAssises">Assises (S.1)</Label>
                      <Input
                        id="placesAssises"
                        type="number"
                        placeholder="3"
                        value={manualData.placesAssises || ""}
                        onChange={(e) => handleManualChange("placesAssises", e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="placesDebout">Debout (S.2)</Label>
                      <Input
                        id="placesDebout"
                        type="number"
                        placeholder="0"
                        value={manualData.placesDebout || ""}
                        onChange={(e) => handleManualChange("placesDebout", e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="energie">Énergie (P.3)</Label>
                    <Input
                      id="energie"
                      placeholder="GAZOLE, ESSENCE..."
                      value={manualData.energie}
                      onChange={(e) => handleManualChange("energie", e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleManualSubmit} className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                Valider les données
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog Configuration IA */}
      <AIConfigDialog open={showAiConfig} onOpenChange={setShowAiConfig} />

      {/* Modal de confirmation */}
      {extractedData && (
        <ScanConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          scannedData={extractedData}
          onConfirm={handleConfirmData}
          onRescanVIN={handleRescan}
          onRescanImmat={handleRescan}
          onRescanMarque={handleRescan}
          onRescanModele={handleRescan}
        />
      )}
    </>
  );
};
