import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, X, CheckCircle2, AlertCircle, Loader2, RotateCw, Edit, Save } from "lucide-react";
import { toast } from "sonner";
import Tesseract from "tesseract.js";
import {
  parseRegistrationCardText,
  validateAndCorrectVIN,
  type VehicleRegistrationData,
} from "@/lib/registrationCardParser";

interface VehicleRegistrationScannerProps {
  onDataExtracted: (data: VehicleRegistrationData) => void;
}

interface FieldConfidence {
  field: string;
  value: any;
  confidence: number;
  needsReview: boolean;
}

const VehicleRegistrationScanner = ({ onDataExtracted }: VehicleRegistrationScannerProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<VehicleRegistrationData | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedData, setEditedData] = useState<VehicleRegistrationData>({});
  const [confidences, setConfidences] = useState<FieldConfidence[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Prétraitement STRATEGY 1: Haute résolution + niveaux de gris + contraste adaptatif
   * Meilleur pour: Photos bien éclairées avec texte net
   */
  const preprocessStrategy1 = (canvas: HTMLCanvasElement): void => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Conversion en niveaux de gris avec pondération
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    // Augmentation du contraste (normalisation adaptative)
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

    // Seuillage adaptatif
    const threshold = 140;
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i] > threshold ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  /**
   * Prétraitement STRATEGY 2: Seuillage OTSU + débruitage
   * Meilleur pour: Photos avec éclairage inégal ou légèrement floues
   */
  const preprocessStrategy2 = (canvas: HTMLCanvasElement): void => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Conversion en niveaux de gris
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    // Calcul du seuil OTSU (simplifié)
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      histogram[Math.floor(data[i])]++;
    }

    const total = canvas.width * canvas.height;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];

    let sumB = 0;
    let wB = 0;
    let maximum = 0;
    let threshold = 0;

    for (let i = 0; i < 256; i++) {
      wB += histogram[i];
      if (wB === 0) continue;

      const wF = total - wB;
      if (wF === 0) break;

      sumB += i * histogram[i];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;

      const between = wB * wF * (mB - mF) * (mB - mF);

      if (between > maximum) {
        maximum = between;
        threshold = i;
      }
    }

    // Application du seuil
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i] > threshold ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  /**
   * Prétraitement STRATEGY 3: Augmentation contraste agressive + sharpen
   * Meilleur pour: Photos de mauvaise qualité, floues ou sous-exposées
   */
  const preprocessStrategy3 = (canvas: HTMLCanvasElement): void => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Conversion en niveaux de gris
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    // Égalisation d'histogramme (améliore le contraste)
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      histogram[Math.floor(data[i])]++;
    }

    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }

    const total = canvas.width * canvas.height;
    const cdfMin = cdf.find((v) => v > 0) || 0;

    for (let i = 0; i < data.length; i += 4) {
      const oldValue = Math.floor(data[i]);
      const newValue = Math.round(((cdf[oldValue] - cdfMin) / (total - cdfMin)) * 255);
      data[i] = newValue;
      data[i + 1] = newValue;
      data[i + 2] = newValue;
    }

    // Seuillage agressif
    const threshold = 120;
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
    setConfidences([]);

    try {
      // Charger l'image
      const img = new Image();
      const imgUrl = URL.createObjectURL(file);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgUrl;
      });

      console.log("🔍 Démarrage OCR MULTI-PASSES (3 stratégies)...");

      // MULTI-PASSES: Tester 3 stratégies différentes
      const strategies = [
        { name: "Strategy 1 (Haute résolution)", fn: preprocessStrategy1, scale: 3 },
        { name: "Strategy 2 (OTSU)", fn: preprocessStrategy2, scale: 2.5 },
        { name: "Strategy 3 (Contraste agressif)", fn: preprocessStrategy3, scale: 2 },
      ];

      const results: Array<{ text: string; confidence: number; data: VehicleRegistrationData; strategyName: string }> =
        [];

      for (let i = 0; i < strategies.length; i++) {
        const strategy = strategies[i];
        setProgress(Math.round((i / strategies.length) * 90)); // 0-90% pour les passes

        console.log(`📸 Pass ${i + 1}/3: ${strategy.name}`);

        // Créer un canvas avec résolution augmentée
        const canvas = document.createElement("canvas");
        canvas.width = img.width * strategy.scale;
        canvas.height = img.height * strategy.scale;
        const ctx = canvas.getContext("2d");

        if (!ctx) continue;

        // Dessiner l'image avec interpolation de haute qualité
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Appliquer la stratégie de prétraitement
        strategy.fn(canvas);

        // Convertir le canvas en blob
        const preprocessedBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Conversion canvas vers blob échouée"));
          }, "image/png");
        });

        // Reconnaissance OCR avec Tesseract
        const result = await Tesseract.recognize(preprocessedBlob, "fra", {
          logger: (m) => {
            if (m.status === "recognizing text") {
              const baseProgress = (i / strategies.length) * 90;
              const stepProgress = (m.progress * 90) / strategies.length;
              setProgress(Math.round(baseProgress + stepProgress));
            }
          },
        });

        console.log(`  ✓ Pass ${i + 1} confiance: ${result.data.confidence.toFixed(1)}%`);

        // Parser les données
        const parsedData = parseRegistrationCardText(result.data.text);

        // Valider et corriger le VIN si détecté
        if (parsedData.numeroChassisVIN) {
          parsedData.numeroChassisVIN = validateAndCorrectVIN(parsedData.numeroChassisVIN);
        }

        results.push({
          text: result.data.text,
          confidence: result.data.confidence,
          data: parsedData,
          strategyName: strategy.name,
        });
      }

      URL.revokeObjectURL(imgUrl);

      setProgress(95);

      // Choisir le meilleur résultat (celui avec le plus de champs détectés ET bonne confiance)
      let bestResult = results[0];
      let bestScore = 0;

      for (const result of results) {
        const fieldsDetected = Object.values(result.data).filter(
          (v) => v !== undefined && v !== null && v !== "",
        ).length;
        // Score = nombre de champs * confiance OCR
        const score = fieldsDetected * (result.confidence / 100);

        console.log(
          `📊 ${result.strategyName}: ${fieldsDetected} champs, confiance ${result.confidence.toFixed(1)}% → score ${score.toFixed(2)}`,
        );

        if (score > bestScore) {
          bestScore = score;
          bestResult = result;
        }
      }

      console.log(`✅ Meilleur résultat: ${bestResult.strategyName}`);
      console.log("📄 Texte OCR:", bestResult.text);
      console.log("📦 Données extraites:", bestResult.data);

      setOcrText(bestResult.text);
      setExtractedData(bestResult.data);
      setEditedData(bestResult.data);

      // Calculer les confidences pour chaque champ
      const fieldConfidences: FieldConfidence[] = [
        {
          field: "immatriculation",
          value: bestResult.data.immatriculation,
          confidence: bestResult.confidence,
          needsReview: !bestResult.data.immatriculation,
        },
        {
          field: "numeroChassisVIN",
          value: bestResult.data.numeroChassisVIN,
          confidence: bestResult.confidence,
          needsReview: !bestResult.data.numeroChassisVIN || bestResult.data.numeroChassisVIN.length !== 17,
        },
        {
          field: "datePremiereImmatriculation",
          value: bestResult.data.datePremiereImmatriculation,
          confidence: bestResult.confidence,
          needsReview: !bestResult.data.datePremiereImmatriculation,
        },
        {
          field: "marque",
          value: bestResult.data.marque,
          confidence: bestResult.confidence,
          needsReview: !bestResult.data.marque,
        },
        {
          field: "denominationCommerciale",
          value: bestResult.data.denominationCommerciale,
          confidence: bestResult.confidence,
          needsReview: !bestResult.data.denominationCommerciale,
        },
        {
          field: "masseVide",
          value: bestResult.data.masseVide,
          confidence: bestResult.confidence,
          needsReview: !bestResult.data.masseVide,
        },
        {
          field: "masseEnChargeMax",
          value: bestResult.data.masseEnChargeMax,
          confidence: bestResult.confidence,
          needsReview: !bestResult.data.masseEnChargeMax,
        },
      ];

      setConfidences(fieldConfidences);

      // Notifier le parent avec les données extraites
      onDataExtracted(bestResult.data);

      setProgress(100);

      // Compter combien de champs ont été détectés
      const detectedFields = Object.values(bestResult.data).filter(
        (v) => v !== undefined && v !== null && v !== "",
      ).length;

      if (detectedFields === 0) {
        toast.error("Aucune donnée n'a pu être extraite après 3 tentatives.", {
          duration: 5000,
          description: "Essayez de prendre une nouvelle photo avec un meilleur éclairage et plus de netteté.",
        });
      } else if (detectedFields < 3) {
        toast.warning(`Seulement ${detectedFields} champ(s) détecté(s). Vérifiez et complétez manuellement.`, {
          duration: 4000,
          action: {
            label: "Corriger",
            onClick: () => setIsEditMode(true),
          },
        });
      } else {
        toast.success(`${detectedFields} champs détectés avec succès ! (${bestResult.strategyName})`, {
          duration: 3000,
          description: "Vérifiez les données avant de valider.",
        });
      }
    } catch (error) {
      console.error("❌ Erreur lors du traitement de l'image:", error);
      toast.error("Erreur lors de la lecture de la carte grise.", {
        duration: 5000,
        description: "Veuillez réessayer avec une photo bien éclairée et nette.",
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProgress(0), 500);
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

  const handleEditField = (field: keyof VehicleRegistrationData, value: any) => {
    setEditedData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveEdits = () => {
    // Valider le VIN si modifié
    if (editedData.numeroChassisVIN) {
      editedData.numeroChassisVIN = validateAndCorrectVIN(editedData.numeroChassisVIN);
    }

    setExtractedData(editedData);
    onDataExtracted(editedData);
    setIsEditMode(false);

    const detectedFields = Object.values(editedData).filter((v) => v !== undefined && v !== null && v !== "").length;
    toast.success(`Données mises à jour ! ${detectedFields} champs renseignés.`, {
      duration: 2000,
    });
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      immatriculation: "Immatriculation",
      numeroChassisVIN: "N° de châssis (VIN - 17 car.)",
      datePremiereImmatriculation: "Date 1ère immat.",
      marque: "Marque",
      denominationCommerciale: "Modèle",
      masseVide: "Masse à vide (kg)",
      masseEnChargeMax: "PTAC (kg)",
    };
    return labels[field] || field;
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
                {!isEditMode ? (
                  <>
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        Analyse terminée ! Les champs détectés ont été remplis automatiquement.{" "}
                        <Button
                          variant="link"
                          className="h-auto p-0 text-primary underline"
                          onClick={() => setIsEditMode(true)}
                        >
                          Corriger les données
                        </Button>
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
                            {extractedData.numeroChassisVIN && extractedData.numeroChassisVIN.length !== 17 && (
                              <Badge variant="destructive" className="ml-2 text-xs">
                                {extractedData.numeroChassisVIN.length}/17
                              </Badge>
                            )}
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
                  </>
                ) : (
                  <>
                    <Alert>
                      <Edit className="h-4 w-4" />
                      <AlertDescription>Mode correction : modifiez les champs détectés ci-dessous.</AlertDescription>
                    </Alert>

                    <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                      {confidences.map((field) => (
                        <div key={field.field} className="space-y-1">
                          <Label htmlFor={field.field} className="text-sm flex items-center justify-between">
                            <span>{getFieldLabel(field.field)}</span>
                            {field.needsReview && (
                              <Badge variant="outline" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />À vérifier
                              </Badge>
                            )}
                          </Label>
                          <Input
                            id={field.field}
                            type={field.field.includes("masse") || field.field.includes("Masse") ? "number" : "text"}
                            value={editedData[field.field as keyof VehicleRegistrationData] || ""}
                            onChange={(e) =>
                              handleEditField(
                                field.field as keyof VehicleRegistrationData,
                                field.field.includes("masse") || field.field.includes("Masse")
                                  ? parseInt(e.target.value) || undefined
                                  : e.target.value,
                              )
                            }
                            placeholder={`Entrez ${getFieldLabel(field.field).toLowerCase()}`}
                            className={field.needsReview ? "border-yellow-500" : ""}
                          />
                          {field.field === "numeroChassisVIN" && editedData.numeroChassisVIN && (
                            <p className="text-xs text-muted-foreground">
                              {editedData.numeroChassisVIN.length}/17 caractères
                              {editedData.numeroChassisVIN.length !== 17 && (
                                <span className="text-yellow-600 ml-2">⚠️ Le VIN doit faire 17 caractères</span>
                              )}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleSaveEdits} className="flex-1">
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer les modifications
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditMode(false)}>
                        Annuler
                      </Button>
                    </div>
                  </>
                )}

                {!isEditMode && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={handleRetry} className="flex-1">
                      <RotateCw className="h-4 w-4 mr-2" />
                      Réessayer le scan
                    </Button>
                    <Button type="button" variant="outline" onClick={handleReset} className="flex-1">
                      Scanner une autre carte
                    </Button>
                  </div>
                )}
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
