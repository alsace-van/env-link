import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Upload, Loader2, ChevronDown, ChevronUp, Scan } from "lucide-react";
import { useAIConfig } from "@/hooks/useAIConfig";
import { ScanConfirmationModal } from "./ScanConfirmationModal";
import { type VehicleRegistrationData } from "@/lib/registrationCardParser";

// ============================================
// PROMPT OCR CARTE GRISE - FORMAT FRANÇAIS
// ============================================

const VEHICLE_REGISTRATION_OCR_PROMPT = `
Analyse cette image de carte grise française et extrais TOUTES les informations visibles.

IMPORTANT: 
- Extrais EXACTEMENT ce qui est écrit sur la carte grise
- Si un champ n'est pas visible ou lisible, mets null
- Retourne UNIQUEMENT un JSON valide, sans texte avant ou après

{
  "immatriculation": "AA-123-BB",
  "datePremiereImmatriculation": "15/01/2020",
  "numeroChassisVIN": "VF1MA000012345678",
  "marque": "RENAULT",
  "typeVariante": "ABCDE-12345",
  "denominationCommerciale": "MASTER III",
  "masseVide": 1850,
  "masseEnChargeMax": 3500,
  "ptra": 5500,
  "categorieInternational": "N1",
  "genreNational": "CTTE",
  "carrosserieCE": "BB",
  "carrosserieNationale": "FOURGON",
  "numeroReceptionCE": "e2*2007/46*0123*04",
  "cylindree": 2299,
  "puissanceKw": 120,
  "energie": "GO",
  "puissanceFiscale": 8,
  "placesAssises": 3,
  "co2": 189,
  "normeEuro": "EURO6"
}

CODES CARTE GRISE:
- A = immatriculation
- B = datePremiereImmatriculation (format JJ/MM/AAAA)
- D.1 = marque
- D.2 = typeVariante (type mine)
- D.3 = denominationCommerciale (modèle)
- E = numeroChassisVIN (17 caractères, pas de I, O, Q)
- F.1 = masseEnChargeMax (PTAC en kg)
- F.2 = ptra (en kg)
- G = masseVide (poids à vide en kg)
- J = categorieInternational (M1, N1, N2, etc.)
- J.1 = genreNational (VP, CTTE, CAM, VASP, etc.)
- J.2 = carrosserieCE (AA, AB, BB, BC, etc.)
- J.3 = carrosserieNationale (FOURGON, BREAK, etc.)
- K = numeroReceptionCE (commence par e2* ou e1*)
- P.1 = cylindree (en cm³)
- P.2 = puissanceKw (en kW)
- P.3 = energie (GO=gazole, ES=essence, EL=électrique, EH=hybride)
- P.6 = puissanceFiscale (en CV)
- S.1 = placesAssises (nombre)
- V.7 = co2 (en g/km)
- V.9 = normeEuro (extraire juste EURO5, EURO6, etc.)
`;

// ============================================
// FONCTION D'EXTRACTION
// ============================================

async function extractVehicleRegistration(imageBase64: string, apiKey: string): Promise<VehicleRegistrationData> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: VEHICLE_REGISTRATION_OCR_PROMPT },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2000,
        },
      }),
    },
  );

  const data = await response.json();

  if (data.error) {
    console.error("Erreur API Gemini:", data.error);
    throw new Error(data.error.message || "Erreur API Gemini");
  }

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error("Pas de réponse de l'API");
  }

  const text = data.candidates[0].content.parts[0].text;
  console.log("Réponse brute Gemini:", text);

  // Extraire le JSON de la réponse
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Impossible d'extraire les données JSON");
  }

  const extracted = JSON.parse(jsonMatch[0]);
  console.log("Données extraites:", extracted);

  if (extracted.error) {
    throw new Error(extracted.error);
  }

  return extracted as VehicleRegistrationData;
}

// ============================================
// COMPONENT
// ============================================

export interface VehicleRegistrationScannerProps {
  onDataExtracted: (data: VehicleRegistrationData) => void;
}

export function VehicleRegistrationScanner({ onDataExtracted }: VehicleRegistrationScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { apiKey, isConfigured, saveConfig } = useAIConfig();
  const [localApiKey, setLocalApiKey] = useState("");

  // État pour la modal de confirmation
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [scannedData, setScannedData] = useState<VehicleRegistrationData | null>(null);

  // Synchroniser avec la config globale
  useEffect(() => {
    if (apiKey) {
      setLocalApiKey(apiKey);
    }
  }, [apiKey]);

  const handleApiKeyBlur = () => {
    if (localApiKey && localApiKey !== apiKey) {
      saveConfig("gemini", localApiKey);
      toast.success("Clé API sauvegardée");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const keyToUse = localApiKey || apiKey;
    if (!keyToUse) {
      toast.error("Veuillez entrer votre clé API Gemini");
      return;
    }

    setIsScanning(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const data = await extractVehicleRegistration(base64, keyToUse);

          // Stocker les données et ouvrir la modal de confirmation
          setScannedData(data);
          setShowConfirmModal(true);
          toast.success("Carte grise scannée - Vérifiez les données");
        } catch (error) {
          console.error("Erreur lors du scan:", error);
          toast.error(error instanceof Error ? error.message : "Erreur lors du scan");
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement du fichier");
      setIsScanning(false);
    }

    // Reset input
    event.target.value = "";
  };

  const handleConfirmData = (confirmedData: VehicleRegistrationData) => {
    console.log("Données confirmées:", confirmedData);
    onDataExtracted(confirmedData);
    setShowConfirmModal(false);
    setScannedData(null);
    setIsOpen(false);
    toast.success("Données de la carte grise appliquées !");
  };

  const currentApiKey = localApiKey || apiKey;
  const hasApiKey = !!currentApiKey;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between mb-4">
            <span className="flex items-center gap-2">
              <Scan className="h-4 w-4" />
              {isOpen ? "Masquer le scanner" : "Scanner une carte grise"}
            </span>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Card className="p-4 mb-4">
            <div className="space-y-4">
              {/* Clé API - afficher seulement si pas configurée */}
              {!isConfigured && (
                <div>
                  <Label htmlFor="gemini-api-key">Clé API Gemini</Label>
                  <Input
                    id="gemini-api-key"
                    type="password"
                    placeholder="Entrez votre clé API Gemini"
                    value={localApiKey}
                    onChange={(e) => setLocalApiKey(e.target.value)}
                    onBlur={handleApiKeyBlur}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Obtenir une clé gratuite
                    </a>
                  </p>
                </div>
              )}

              {/* Zone upload */}
              <div>
                <Label htmlFor="carte-grise-upload">Photo de la carte grise</Label>
                <div className="mt-2">
                  <Input
                    id="carte-grise-upload"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    disabled={isScanning}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant={hasApiKey ? "default" : "outline"}
                    disabled={isScanning || !hasApiKey}
                    onClick={() => document.getElementById("carte-grise-upload")?.click()}
                    className="w-full"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Scan en cours...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {hasApiKey ? "Télécharger une photo" : "Entrez d'abord la clé API"}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Info clé configurée */}
              {isConfigured && <p className="text-xs text-muted-foreground">✓ Clé API Gemini configurée</p>}
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Modal de confirmation */}
      {scannedData && (
        <ScanConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false);
            setScannedData(null);
          }}
          scannedData={scannedData}
          onConfirm={handleConfirmData}
        />
      )}
    </>
  );
}

export default VehicleRegistrationScanner;
