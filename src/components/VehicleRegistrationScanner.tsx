import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

// ============================================
// PROMPT OCR CARTE GRISE - VERSION COMPLÈTE
// Pour extraction via Gemini Vision API
// ============================================

export const VEHICLE_REGISTRATION_OCR_PROMPT = `
Analyse cette image de carte grise française (certificat d'immatriculation) et extrais TOUTES les informations visibles.

IMPORTANT: 
- Extrais EXACTEMENT ce qui est écrit, sans inventer
- Si un champ n'est pas visible ou lisible, mets null
- Les codes entre parenthèses correspondent aux repères sur la carte grise

Retourne un JSON avec cette structure:

{
  "registration_number": "AA-123-BB",           // (A) Numéro d'immatriculation
  "first_registration_date": "2020-01-15",      // (B) Date 1ère immatriculation (format YYYY-MM-DD)
  "brand": "RENAULT",                           // (D.1) Marque
  "type": "FG...",                              // (D.2) Type / Variante / Version
  "commercial_name": "MASTER III",              // (D.3) Appellation commerciale
  "vin": "VF1MA000012345678",                   // (E) Numéro d'identification (VIN)
  
  "ptac": 3500,                                 // (F.1) PTAC en kg
  "ptra": 6000,                                 // (F.2) PTRA en kg (si applicable)
  "max_braked_trailer": 2500,                   // (F.3) Poids max remorque freinée
  
  "empty_weight": 1850,                         // (G) Poids à vide en kg
  "max_weight_axle1": 1800,                     // (G1) Charge max essieu 1
  "max_weight_axle2": 2100,                     // (G) ou autre - Charge max essieu 2
  
  "international_category": "N1",               // (J) Catégorie internationale
  "body_type": "FOURGON",                       // (J.1) ou (J.2) Carrosserie
  "genre": "CTTE",                              // (J.1) Genre national
  
  "engine_capacity": 2299,                      // (P.1) Cylindrée en cm³
  "max_power_kw": 120,                          // (P.2) Puissance max en kW
  "fuel_type": "GO",                            // (P.3) Type carburant (ES, GO, EL, etc.)
  "fiscal_power": 8,                            // (P.6) Puissance fiscale CV
  
  "original_seats": 3,                          // (S.1) Nombre de places assises
  "standing_places": 0,                         // (S.2) Nombre de places debout
  
  "co2_emission": 189,                          // (V.7) CO2 en g/km
  "environmental_class": "EURO 6",              // (V.9) Classe environnementale
  
  "owner_name": "DUPONT JEAN",                  // (C.1) Nom du titulaire
  "owner_address": "123 RUE DE LA PAIX",        // (C.3) Adresse
  "owner_postal_code": "75001",                 // Extrait de l'adresse
  "owner_city": "PARIS"                         // Extrait de l'adresse
}

RÈGLES D'EXTRACTION:
1. Le VIN fait toujours 17 caractères (lettres et chiffres)
2. L'immatriculation française actuelle: AA-123-BB (avec tirets)
3. Le PTAC (F.1) est le poids total autorisé en charge
4. Le poids à vide (G) est le poids du véhicule sans chargement
5. La catégorie (J) est généralement M1 (voiture), N1 (utilitaire léger), N2, etc.
6. Le genre (J.1) peut être: VP (voiture particulière), CTTE (camionnette), CAM, etc.
7. Le carburant (P.3): ES=essence, GO=gazole, EL=électrique, EH=hybride, GPL, GNV
8. La date doit être convertie en format ISO (YYYY-MM-DD)

Si l'image n'est pas une carte grise ou est illisible, retourne:
{
  "error": "Description du problème"
}
`;

// ============================================
// TYPES
// ============================================

export interface VehicleRegistrationData {
  registration_number: string | null;
  first_registration_date: string | null;
  brand: string | null;
  type: string | null;
  commercial_name: string | null;
  vin: string | null;
  ptac: number | null;
  ptra: number | null;
  max_braked_trailer: number | null;
  empty_weight: number | null;
  max_weight_axle1: number | null;
  max_weight_axle2: number | null;
  international_category: string | null;
  body_type: string | null;
  genre: string | null;
  engine_capacity: number | null;
  max_power_kw: number | null;
  fuel_type: string | null;
  fiscal_power: number | null;
  original_seats: number | null;
  standing_places: number | null;
  co2_emission: number | null;
  environmental_class: string | null;
  owner_name: string | null;
  owner_address: string | null;
  owner_postal_code: string | null;
  owner_city: string | null;
}

// ============================================
// FONCTION D'EXTRACTION
// ============================================

export async function extractVehicleRegistration(
  imageBase64: string,
  apiKey: string,
): Promise<VehicleRegistrationData> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
// MAPPING VERS LA TABLE SUPABASE
// ============================================

export function mapToSupabaseColumns(data: VehicleRegistrationData) {
  return {
    registration_number: data.registration_number,
    first_registration_date: data.first_registration_date,
    brand: data.brand,
    type: data.type,
    commercial_name: data.commercial_name,
    vin: data.vin,
    ptac: data.ptac,
    ptra: data.ptra,
    max_braked_trailer: data.max_braked_trailer,
    empty_weight: data.empty_weight,
    max_weight_axle1: data.max_weight_axle1,
    max_weight_axle2: data.max_weight_axle2,
    international_category: data.international_category,
    body_type: data.body_type,
    genre: data.genre,
    engine_capacity: data.engine_capacity,
    max_power_kw: data.max_power_kw,
    fuel_type: data.fuel_type,
    fiscal_power: data.fiscal_power,
    original_seats: data.original_seats,
    standing_places: data.standing_places,
    co2_emission: data.co2_emission,
    environmental_class: data.environmental_class,
    // Note: owner_* va dans la table clients, pas vehicle_registration
  };
}

// ============================================
// COMPONENT
// ============================================

interface VehicleRegistrationScannerProps {
  onDataExtracted: (data: VehicleRegistrationData) => void;
}

export function VehicleRegistrationScanner({ onDataExtracted }: VehicleRegistrationScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [apiKey, setApiKey] = useState("");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!apiKey) {
      toast.error("Veuillez entrer votre clé API Gemini");
      return;
    }

    setIsScanning(true);

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const data = await extractVehicleRegistration(base64, apiKey);
          onDataExtracted(data);
          toast.success("Carte grise scannée avec succès!");
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
  };

  return (
    <Card className="p-4 mb-4">
      <div className="space-y-4">
        <div>
          <Label htmlFor="gemini-api-key">Clé API Gemini</Label>
          <Input
            id="gemini-api-key"
            type="password"
            placeholder="Entrez votre clé API Gemini"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="carte-grise-upload">Photo de la carte grise</Label>
          <div className="mt-2">
            <Input
              id="carte-grise-upload"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={isScanning || !apiKey}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              disabled={isScanning || !apiKey}
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
                  Télécharger une photo
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
