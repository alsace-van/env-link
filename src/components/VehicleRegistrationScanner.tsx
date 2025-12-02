import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Upload, Loader2, ChevronDown, ChevronUp, Scan } from "lucide-react";
import { useAIConfig } from "@/hooks/useAIConfig";

// ============================================
// PROMPT OCR CARTE GRISE
// ============================================

const VEHICLE_REGISTRATION_OCR_PROMPT = `
Analyse cette image de carte grise française et extrais les informations.

IMPORTANT: 
- Extrais EXACTEMENT ce qui est écrit
- Si un champ n'est pas visible, mets null
- Retourne UNIQUEMENT un JSON valide

{
  "registration_number": "AA-123-BB",
  "first_registration_date": "2020-01-15",
  "brand": "RENAULT",
  "type": "FG...",
  "commercial_name": "MASTER III",
  "vin": "VF1MA000012345678",
  "ptac": 3500,
  "empty_weight": 1850,
  "genre": "CTTE",
  "fuel_type": "GO",
  "original_seats": 3,
  "fiscal_power": 8,
  "owner_name": "DUPONT JEAN",
  "owner_address": "123 RUE DE LA PAIX",
  "owner_postal_code": "75001",
  "owner_city": "PARIS"
}

RÈGLES:
- VIN = 17 caractères
- Date en format YYYY-MM-DD
- PTAC et poids en kg (nombres)
`;

// ============================================
// TYPES
// ============================================

export interface VehicleRegistrationData {
  registration_number?: string | null;
  first_registration_date?: string | null;
  brand?: string | null;
  type?: string | null;
  commercial_name?: string | null;
  vin?: string | null;
  ptac?: number | null;
  empty_weight?: number | null;
  genre?: string | null;
  fuel_type?: string | null;
  original_seats?: number | null;
  fiscal_power?: number | null;
  owner_name?: string | null;
  owner_address?: string | null;
  owner_postal_code?: string | null;
  owner_city?: string | null;
}

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
    throw new Error(data.error.message || "Erreur API Gemini");
  }

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error("Pas de réponse de l'API");
  }

  const text = data.candidates[0].content.parts[0].text;

  // Extraire le JSON de la réponse
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Impossible d'extraire les données JSON");
  }

  const extracted = JSON.parse(jsonMatch[0]);

  if (extracted.error) {
    throw new Error(extracted.error);
  }

  return extracted as VehicleRegistrationData;
}

// ============================================
// MAPPING VERS LES COLONNES EXISTANTES
// ============================================

export function mapToExistingColumns(data: VehicleRegistrationData) {
  // Ne retourne que les colonnes qui existent déjà dans la table
  return {
    registration_number: data.registration_number || null,
    first_registration_date: data.first_registration_date || null,
    brand: data.brand || null,
    type: data.type || null,
    vin: data.vin || null,
    ptac: data.ptac || null,
    empty_weight: data.empty_weight || null,
    genre: data.genre || null,
    fuel_type: data.fuel_type || null,
  };
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

  // Synchroniser avec la config globale
  useEffect(() => {
    if (apiKey) {
      setLocalApiKey(apiKey);
    }
  }, [apiKey]);

  // Sauvegarder la clé si elle change
  const handleApiKeyChange = (newKey: string) => {
    setLocalApiKey(newKey);
  };

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

          // Log pour debug
          console.log("Données extraites:", data);

          onDataExtracted(data);
          toast.success("Carte grise scannée avec succès!");
          setIsOpen(false); // Fermer après succès
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

  const currentApiKey = localApiKey || apiKey;
  const hasApiKey = !!currentApiKey;

  return (
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
                  onChange={(e) => handleApiKeyChange(e.target.value)}
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
  );
}

export default VehicleRegistrationScanner;
