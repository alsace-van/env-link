import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Tesseract from "tesseract.js";
import { parseRegistrationCardText, preprocessImageForOCR, type VehicleRegistrationData } from "@/lib/registrationCardParser";

interface VehicleRegistrationScannerProps {
  onDataExtracted: (data: VehicleRegistrationData) => void;
}

const VehicleRegistrationScanner = ({ onDataExtracted }: VehicleRegistrationScannerProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<VehicleRegistrationData | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (file: File) => {
    // Prévisualisation
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Lancer l'OCR
    await processImage(file);
  };

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    setExtractedData(null);
    setOcrText("");

    try {
      // Prétraitement de l'image
      const img = new Image();
      const imgUrl = URL.createObjectURL(file);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgUrl;
      });

      // Créer un canvas pour le prétraitement
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error("Impossible de créer le contexte canvas");
      }

      ctx.drawImage(img, 0, 0);
      
      // Appliquer le prétraitement pour améliorer l'OCR
      preprocessImageForOCR(canvas);

      // Convertir le canvas en blob
      const preprocessedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Conversion canvas vers blob échouée"));
        }, 'image/png');
      });

      URL.revokeObjectURL(imgUrl);

      // Reconnaissance OCR avec Tesseract
      const result = await Tesseract.recognize(
        preprocessedBlob,
        'fra', // Langue française
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          },
        }
      );

      const text = result.data.text;
      setOcrText(text);
      console.log("Texte OCR brut:", text);

      // Parser le texte pour extraire les données structurées
      const parsedData = parseRegistrationCardText(text);
      console.log("Données extraites:", parsedData);
      
      setExtractedData(parsedData);
      
      // Notifier le parent avec les données extraites
      onDataExtracted(parsedData);

      // Compter combien de champs ont été détectés
      const detectedFields = Object.values(parsedData).filter(v => v !== undefined).length;
      
      if (detectedFields === 0) {
        toast.error("Aucune donnée n'a pu être extraite. Veuillez réessayer avec une meilleure qualité d'image.");
      } else if (detectedFields < 3) {
        toast.warning(`Seulement ${detectedFields} champ(s) détecté(s). Vous pouvez compléter manuellement.`);
      } else {
        toast.success(`${detectedFields} champs détectés avec succès !`);
      }

    } catch (error) {
      console.error("Erreur lors du traitement de l'image:", error);
      toast.error("Erreur lors de la lecture de la carte grise. Veuillez réessayer.");
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Veuillez sélectionner une image");
        return;
      }
      handleImageSelect(file);
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setExtractedData(null);
    setOcrText("");
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFieldStatus = (value: any) => {
    if (value === undefined || value === null) {
      return <Badge variant="secondary" className="ml-2"><AlertCircle className="h-3 w-3 mr-1" />Non détecté</Badge>;
    }
    return <Badge variant="default" className="ml-2 bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Détecté</Badge>;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Scanner la Carte Grise
        </CardTitle>
        <CardDescription>
          Scannez votre carte grise pour remplir automatiquement les informations du véhicule (traitement 100% local)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!imagePreview ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-lg p-8 space-y-4">
            <Camera className="h-12 w-12 text-muted-foreground" />
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Prenez une photo claire de votre carte grise
              </p>
              <p className="text-xs text-muted-foreground">
                Formats acceptés: JPG, PNG, WEBP
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                <Upload className="h-4 w-4 mr-2" />
                Télécharger une image
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Prévisualisation de l'image */}
            <div className="relative">
              <img
                src={imagePreview}
                alt="Carte grise"
                className="w-full rounded-lg border"
              />
              {!isProcessing && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleReset}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Barre de progression */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyse en cours...
                  </span>
                  <span className="text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            {/* Résultats de l'extraction */}
            {extractedData && !isProcessing && (
              <div className="space-y-3">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Analyse terminée ! Les champs détectés ont été remplis automatiquement. 
                    Vous pouvez modifier manuellement les valeurs si nécessaire.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Champs détectés :</h4>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center justify-between">
                        <span>Immatriculation:</span>
                        {getFieldStatus(extractedData.immatriculation)}
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Date 1ère immat.:</span>
                        {getFieldStatus(extractedData.datePremiereImmatriculation)}
                      </li>
                      <li className="flex items-center justify-between">
                        <span>N° de châssis:</span>
                        {getFieldStatus(extractedData.numeroChassisVIN)}
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Marque:</span>
                        {getFieldStatus(extractedData.marque)}
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Poids & dimensions :</h4>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center justify-between">
                        <span>Modèle:</span>
                        {getFieldStatus(extractedData.denominationCommerciale)}
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Masse à vide:</span>
                        {getFieldStatus(extractedData.masseVide)}
                      </li>
                      <li className="flex items-center justify-between">
                        <span>PTAC:</span>
                        {getFieldStatus(extractedData.masseEnChargeMax)}
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Genre:</span>
                        {getFieldStatus(extractedData.genreNational)}
                      </li>
                    </ul>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  className="w-full"
                >
                  Scanner une autre carte grise
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Message d'information RGPD */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Confidentialité garantie :</strong> Toutes les données sont traitées localement dans votre navigateur. 
            Aucune information n'est envoyée à un serveur tiers.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default VehicleRegistrationScanner;
