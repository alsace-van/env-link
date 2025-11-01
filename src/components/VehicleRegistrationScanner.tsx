import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, X, CheckCircle2, AlertCircle, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import Tesseract from "tesseract.js";
import { parseRegistrationCardText, type VehicleRegistrationData } from "@/lib/registrationCardParser";

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

  /**
   * Prétraitement avancé de l'image pour améliorer l'OCR
   * - Augmentation de la résolution
   * - Conversion en niveaux de gris
   * - Augmentation du contraste
   * - Réduction du bruit
   */
  const preprocessImageAdvanced = (canvas: HTMLCanvasElement): void => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Étape 1 : Conversion en niveaux de gris avec pondération
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    // Étape 2 : Augmentation du contraste (normalisation)
    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }

    const range = max - min;
    if (range > 0) {
      for (let i = 0; i < data.length; i += 4) {
        const normalized = ((data[i] - min) / range) * 255;
        data[i] = normalized;
        data[i + 1] = normalized;
        data[i + 2] = normalized;
      }
    }

    // Étape 3 : Seuillage adaptatif (binarisation)
    // Calcul de la moyenne locale pour chaque pixel
    const threshold = 140; // Seuil ajustable
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i] > threshold ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }

    ctx.putImageData(imageData, 0, 0);
  };

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
      // Charger l'image
      const img = new Image();
      const imgUrl = URL.createObjectURL(file);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgUrl;
      });

      // Créer un canvas avec une résolution augmentée pour améliorer l'OCR
      const scaleFactor = 2; // Doubler la résolution
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scaleFactor;
      canvas.height = img.height * scaleFactor;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Impossible de créer le contexte canvas");
      }

      // Dessiner l'image avec interpolation de haute qualité
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Appliquer le prétraitement avancé
      preprocessImageAdvanced(canvas);

      // Convertir le canvas en blob
      const preprocessedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Conversion canvas vers blob échouée"));
        }, "image/png");
      });

      URL.revokeObjectURL(imgUrl);

      console.log("🔍 Lancement de l'OCR avec paramètres optimisés...");

      // Reconnaissance OCR avec Tesseract - Configuration optimisée
      const result = await Tesseract.recognize(
        preprocessedBlob,
        "fra", // Langue française
        {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setProgress(Math.round(m.progress * 100));
            }
          },
          // Paramètres Tesseract optimisés pour les cartes grises
          tessedit_pageseg_mode: Tesseract.PSM.AUTO, // Mode de segmentation automatique
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-./: éèêàâôîûù", // Caractères autorisés
        },
      );

      const text = result.data.text;
      setOcrText(text);
      console.log("📄 Texte OCR brut:", text);
      console.log("📊 Confiance OCR:", result.data.confidence);

      // Parser le texte pour extraire les données structurées
      const parsedData = parseRegistrationCardText(text);
      console.log("✅ Données extraites:", parsedData);

      setExtractedData(parsedData);

      // Notifier le parent avec les données extraites
      onDataExtracted(parsedData);

      // Compter combien de champs ont été détectés
      const detectedFields = Object.values(parsedData).filter((v) => v !== undefined).length;

      if (detectedFields === 0) {
        toast.error("Aucune donnée n'a pu être extraite. Vérifiez que la photo est nette et bien éclairée.", {
          duration: 5000,
          description: "Essayez de prendre une nouvelle photo avec un meilleur éclairage.",
        });
      } else if (detectedFields < 3) {
        toast.warning(`Seulement ${detectedFields} champ(s) détecté(s). Vous pouvez compléter manuellement.`, {
          duration: 4000,
        });
      } else {
        toast.success(`${detectedFields} champs détectés avec succès !`, {
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("❌ Erreur lors du traitement de l'image:", error);
      toast.error("Erreur lors de la lecture de la carte grise. Veuillez réessayer avec une autre photo.", {
        duration: 5000,
        description: "Assurez-vous que la photo est bien éclairée et que le texte est lisible.",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Veuillez sélectionner une image");
        return;
      }

      // Vérifier la taille du fichier (max 10 MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("L'image est trop volumineuse. Maximum 10 MB.", {
          duration: 4000,
        });
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
      fileInputRef.current.value = "";
    }
  };

  const handleRetry = () => {
    if (imagePreview && fileInputRef.current?.files?.[0]) {
      processImage(fileInputRef.current.files[0]);
    }
  };

  const getFieldStatus = (value: any) => {
    if (value === undefined || value === null) {
      return (
        <Badge variant="secondary" className="ml-2">
          <AlertCircle className="h-3 w-3 mr-1" />
          Non détecté
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="ml-2 bg-green-600">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Détecté
      </Badge>
    );
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
              <p className="text-sm text-muted-foreground">Prenez une photo claire de votre carte grise</p>
              <p className="text-xs text-muted-foreground">💡 Conseils : Bonne luminosité, carte à plat, texte net</p>
              <p className="text-xs text-muted-foreground">Formats acceptés: JPG, PNG, WEBP (max 10 MB)</p>
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
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Prévisualisation de l'image */}
            <div className="relative">
              <img src={imagePreview} alt="Carte grise" className="w-full rounded-lg border" />
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
                    Analyse en cours... (cela peut prendre 10-20 secondes)
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
                    Analyse terminée ! Les champs détectés ont été remplis automatiquement. Vous pouvez modifier
                    manuellement les valeurs si nécessaire.
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

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleRetry} className="flex-1">
                    <RotateCw className="h-4 w-4 mr-2" />
                    Réessayer le scan
                  </Button>
                  <Button type="button" variant="outline" onClick={handleReset} className="flex-1">
                    Scanner une autre carte
                  </Button>
                </div>
              </div>
            )}

            {/* Si aucune donnée détectée après le scan */}
            {extractedData &&
              !isProcessing &&
              Object.values(extractedData).filter((v) => v !== undefined).length === 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold mb-2">Aucune donnée détectée</p>
                    <p className="text-sm mb-2">Conseils pour améliorer la détection :</p>
                    <ul className="text-sm list-disc list-inside space-y-1">
                      <li>Assurez-vous que la photo est bien éclairée (lumière naturelle)</li>
                      <li>La carte grise doit être à plat (pas de pli)</li>
                      <li>Le texte doit être net et lisible</li>
                      <li>Évitez les reflets et les ombres</li>
                      <li>Prenez la photo de plus près</li>
                    </ul>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
                        <RotateCw className="h-4 w-4 mr-2" />
                        Réessayer
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                        Nouvelle photo
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
          </div>
        )}

        {/* Message d'information RGPD */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Confidentialité garantie :</strong> Toutes les données sont traitées localement dans votre
            navigateur. Aucune information n'est envoyée à un serveur tiers.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default VehicleRegistrationScanner;
