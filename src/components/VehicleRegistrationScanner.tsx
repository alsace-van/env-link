import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, X, CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface VehicleRegistrationData {
  // ✅ CORRECTION: Utiliser les MÊMES noms que ScanConfirmationModal
  numeroChassisVIN?: string; // E - Numéro VIN (était "vin")
  immatriculation?: string; // A - Immatriculation
  marque?: string; // D1 - Marque
  modele?: string; // D2 - Type variante version
  denominationCommerciale?: string; // D3 - Dénomination commerciale (était "denomination")

  // Classification
  genreNational?: string; // J - Genre (était "genre")
  carrosserie?: string; // J1 - Carrosserie

  // Motorisation
  energie?: string; // P3 - Énergie
  puissanceFiscale?: number; // P6 - Puissance fiscale
  cylindree?: number; // P1 - Cylindrée

  // Masses
  masseVide?: number; // G - Masse en ordre de marche
  masseEnChargeMax?: number; // F1 - PTAC (était "ptac")
  ptra?: number; // F2 - PTRA

  // Dimensions
  longueur?: number; // L - Longueur
  largeur?: number; // B - Largeur
  hauteur?: number; // H - Hauteur

  // Autres
  nombrePlaces?: number; // S1 - Nombre de places
  datePremiereImmatriculation?: string; // B1 - Date première immat (était "datePremiereImmat")

  confidence?: number; // Niveau de confiance du scan
  [key: string]: any;
}

interface VehicleRegistrationScannerProps {
  onDataExtracted: (data: VehicleRegistrationData) => void;
}

export const VehicleRegistrationScanner = ({ onDataExtracted }: VehicleRegistrationScannerProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<VehicleRegistrationData | null>(null);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }

    // Afficher l'aperçu
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Lancer le scan
    await scanWithGemini(file);
  };

  const scanWithGemini = async (file: File) => {
    setIsProcessing(true);
    setProgress(10);

    try {
      // Convertir l'image en base64
      const base64 = await fileToBase64(file);
      setProgress(30);

      // Appeler l'Edge Function
      const { data, error } = await supabase.functions.invoke("scan-carte-grise", {
        body: { imageData: base64 },
      });

      setProgress(70);

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Erreur lors du scan");
      }

      // ✅ CORRECTION: Mapper avec les BONS noms de champs pour ScanConfirmationModal
      const scanData = data.data;
      const mappedData: VehicleRegistrationData = {
        // Champs critiques
        numeroChassisVIN: scanData.E, // ✅ Corrigé: était "vin"
        immatriculation: scanData.A,
        marque: scanData.D1,
        modele: scanData.D2,
        denominationCommerciale: scanData.D3, // ✅ Corrigé: était "denomination"

        // Classification
        genreNational: scanData.J, // ✅ Corrigé: était "genre"
        carrosserie: scanData.J1,

        // Motorisation
        energie: scanData.P3,
        puissanceFiscale: scanData.P6 ? parseInt(scanData.P6) : undefined,
        cylindree: scanData.P1 ? parseInt(scanData.P1) : undefined,

        // Masses
        masseVide: scanData.G ? parseInt(scanData.G) : undefined,
        masseEnChargeMax: scanData.F1 ? parseInt(scanData.F1) : undefined, // ✅ Corrigé: était "ptac"
        ptra: scanData.F2 ? parseInt(scanData.F2) : undefined,

        // Dimensions
        longueur: scanData.L ? parseInt(scanData.L) : undefined,
        largeur: scanData.B ? parseInt(scanData.B) : undefined,
        hauteur: scanData.H ? parseInt(scanData.H) : undefined,

        // Autres
        nombrePlaces: scanData.S1 ? parseInt(scanData.S1) : undefined,
        datePremiereImmatriculation: scanData.B1, // ✅ Corrigé: était "datePremiereImmat"

        confidence: scanData.confidence || 90,
      };

      console.log("✅ Données mappées pour ScanConfirmationModal:", mappedData);

      setProgress(100);
      setExtractedData(mappedData);
      setShowResults(true);

      toast.success(`Carte grise scannée avec ${mappedData.confidence}% de confiance`, {
        description: "Vérifiez les données avant de valider",
      });
    } catch (error: any) {
      console.error("Erreur scan Gemini:", error);
      toast.error("Erreur lors du scan", {
        description: error.message || "Impossible de lire la carte grise",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
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

  const handleConfirm = () => {
    if (extractedData) {
      onDataExtracted(extractedData);
      toast.success("Données de la carte grise enregistrées");
      resetScanner();
    }
  };

  const resetScanner = () => {
    setImagePreview(null);
    setExtractedData(null);
    setShowResults(false);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Scanner la carte grise
              <Badge variant="secondary" className="ml-2">
                <Sparkles className="h-3 w-3 mr-1" />
                IA Gemini
              </Badge>
            </CardTitle>
            <CardDescription>Scannez automatiquement la carte grise avec l'IA - Précision 95%</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!imagePreview && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <Label htmlFor="image-upload" className="cursor-pointer">
                <Button asChild variant="outline">
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Choisir une photo
                  </span>
                </Button>
              </Label>
              <Input
                id="image-upload"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={isProcessing}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Prenez une photo nette de la carte grise (recto)</p>
          </div>
        )}

        {imagePreview && (
          <div className="space-y-4">
            <div className="relative">
              <img src={imagePreview} alt="Carte grise" className="w-full rounded-lg border" />
              {!isProcessing && (
                <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={resetScanner}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyse en cours...
                  </span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            {showResults && extractedData && (
              <div className="space-y-4">
                <Alert className="border-green-500 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900">
                    Scan réussi avec {extractedData.confidence}% de confiance
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">VIN</Label>
                    <p className="font-mono font-bold">{extractedData.numeroChassisVIN || "Non détecté"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Immatriculation</Label>
                    <p className="font-bold">{extractedData.immatriculation || "Non détecté"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Marque</Label>
                    <p>{extractedData.marque || "Non détecté"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Modèle</Label>
                    <p>{extractedData.modele || "Non détecté"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Genre</Label>
                    <p>{extractedData.genreNational || "Non détecté"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">PTAC</Label>
                    <p>{extractedData.masseEnChargeMax ? `${extractedData.masseEnChargeMax} kg` : "Non détecté"}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleConfirm} className="flex-1">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmer les données
                  </Button>
                  <Button variant="outline" onClick={resetScanner}>
                    <X className="h-4 w-4 mr-2" />
                    Recommencer
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VehicleRegistrationScanner;
