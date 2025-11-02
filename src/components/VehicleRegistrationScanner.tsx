import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, X, CheckCircle2, AlertCircle, Loader2, RotateCw, Edit, Save, ScanLine } from "lucide-react";
import { toast } from "sonner";
import Tesseract from "tesseract.js";
import {
  parseRegistrationCardText,
  validateAndCorrectVIN,
  extractNumeroChassisVIN,
  extractImmatriculation,
  isValidVINFormat,
  isValidImmatriculation,
  type VehicleRegistrationData,
} from "@/lib/registrationCardParser";
import { ImageZoneSelector } from "./ImageZoneSelector";
import { ScanConfirmationModal } from "./ScanConfirmationModal";

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
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRescanningVIN, setIsRescanningVIN] = useState(false);
  const [isRescanningImmat, setIsRescanningImmat] = useState(false);
  const [isRescanningMarque, setIsRescanningMarque] = useState(false);
  const [isRescanningModele, setIsRescanningModele] = useState(false);
  const [lastImageFile, setLastImageFile] = useState<File | null>(null);
  const [showVINZoneSelector, setShowVINZoneSelector] = useState(false);
  const [showImmatZoneSelector, setShowImmatZoneSelector] = useState(false);
  const [showMarqueZoneSelector, setShowMarqueZoneSelector] = useState(false);
  const [showModeleZoneSelector, setShowModeleZoneSelector] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  /**
   * Prétraitement RAPIDE 1: Contraste simple + binarisation
   */
  const preprocessStrategy1 = (canvas: HTMLCanvasElement): void => {
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

    // Contraste simple
    let min = 255,
      max = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
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

    // Binarisation simple
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i] > 130 ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  /**
   * Prétraitement PRÉCIS 2: OTSU simplifié
   */
  const preprocessStrategy2 = (canvas: HTMLCanvasElement): void => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Niveaux de gris
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    // OTSU simplifié
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      histogram[Math.floor(data[i])]++;
    }

    const total = canvas.width * canvas.height;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];

    let sumB = 0,
      wB = 0,
      maximum = 0,
      threshold = 0;
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
   * Prétraitement ULTRA-PRÉCIS pour VIN : optimisé pour codes alphanumériques
   * Combine plusieurs techniques pour maximiser la lisibilité
   */
  const preprocessForVIN = (canvas: HTMLCanvasElement): void => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // ÉTAPE 1: Conversion en niveaux de gris
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    // ÉTAPE 2: Débruitage avec filtre médian (3x3)
    const tempData = new Uint8ClampedArray(data);
    const width = canvas.width;
    const height = canvas.height;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const neighbors = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            neighbors.push(tempData[idx]);
          }
        }
        neighbors.sort((a, b) => a - b);
        const median = neighbors[4]; // milieu du tableau trié
        const idx = (y * width + x) * 4;
        data[idx] = median;
        data[idx + 1] = median;
        data[idx + 2] = median;
      }
    }

    // ÉTAPE 3: Augmentation drastique du contraste
    let min = 255,
      max = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }

    const range = max - min;
    if (range > 0) {
      for (let i = 0; i < data.length; i += 4) {
        const normalized = ((data[i] - min) / range) * 255;
        // Augmenter encore plus le contraste avec une fonction gamma
        const enhanced = Math.pow(normalized / 255, 0.7) * 255;
        data[i] = enhanced;
        data[i + 1] = enhanced;
        data[i + 2] = enhanced;
      }
    }

    // ÉTAPE 4: Binarisation adaptative (plus agressive qu'OTSU)
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      histogram[Math.floor(data[i])]++;
    }

    const total = width * height;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];

    let sumB = 0,
      wB = 0,
      maximum = 0,
      threshold = 0;
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

    // Application du seuil avec une légère augmentation pour éviter le bruit
    threshold = Math.min(threshold + 10, 255);
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i] > threshold ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  /**
   * NOUVEAU v3.4: Ouvrir le sélecteur de zone pour le VIN
   */
  const startVINZoneSelection = () => {
    console.log("🔍 Clic sur bouton VIN rescan");
    console.log("imagePreview existe ?", !!imagePreview);
    console.log("imagePreview:", imagePreview?.substring(0, 50));

    if (!imagePreview) {
      toast.error("Image originale non disponible");
      return;
    }

    console.log("✅ Affichage du sélecteur VIN");
    setShowVINZoneSelector(true);
  };

  /**
   * NOUVEAU v3.5: Scan ultra-précis du VIN sur la zone sélectionnée
   * Améliorations: Zoom x4, prétraitement optimisé VIN, paramètres OCR améliorés
   */
  const processVINZone = async (zoneCanvas: HTMLCanvasElement) => {
    setShowVINZoneSelector(false);
    setIsRescanningVIN(true);
    setProgress(0);

    try {
      console.log("🔍 Rescan VIN sur zone sélectionnée (ultra-précis v3.5)...");

      setProgress(10);

      // ÉTAPE 1: Agrandir la zone x4 pour améliorer la précision
      const zoomedCanvas = document.createElement("canvas");
      zoomedCanvas.width = zoneCanvas.width * 4.0;
      zoomedCanvas.height = zoneCanvas.height * 4.0;
      const zoomedCtx = zoomedCanvas.getContext("2d");

      if (!zoomedCtx) throw new Error("Canvas context error");

      zoomedCtx.imageSmoothingEnabled = true;
      zoomedCtx.imageSmoothingQuality = "high";
      zoomedCtx.drawImage(zoneCanvas, 0, 0, zoomedCanvas.width, zoomedCanvas.height);

      console.log("✅ Zone agrandie x4:", zoomedCanvas.width, "x", zoomedCanvas.height);

      setProgress(20);

      // ÉTAPE 2: Appliquer le prétraitement optimisé pour VIN
      console.log("🎨 Application du prétraitement optimisé VIN...");
      preprocessForVIN(zoomedCanvas);

      setProgress(40);

      // ÉTAPE 3: Convertir le canvas prétraité en blob
      const zoneBlob = await new Promise<Blob>((resolve, reject) => {
        zoomedCanvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Conversion échouée"));
        }, "image/png");
      });

      setProgress(50);

      // ÉTAPE 4: OCR avec paramètres optimisés pour codes alphanumériques
      console.log("📖 OCR en cours avec paramètres optimisés...");
      const result = await Tesseract.recognize(zoneBlob, "eng", {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setProgress(50 + Math.round(m.progress * 40));
          }
        },
      });

      console.log("📄 Texte OCR brut:", result.data.text);

      // ÉTAPE 5: Extraire et corriger le VIN
      let detectedVIN = extractNumeroChassisVIN(result.data.text);

      // Correction post-OCR spécifique au VIN
      if (detectedVIN) {
        console.log("🔧 VIN avant correction:", detectedVIN);

        // Appliquer les corrections courantes
        detectedVIN = detectedVIN
          .replace(/[IOQ]/g, (char) => {
            // I, O, Q n'existent jamais dans un VIN
            if (char === "I") return "1";
            if (char === "O") return "0";
            if (char === "Q") return "0";
            return char;
          })
          .toUpperCase()
          .replace(/\s/g, ""); // Supprimer espaces

        console.log("🔧 VIN après correction:", detectedVIN);
      }

      if (detectedVIN && detectedVIN.length === 17) {
        console.log("✅ VIN rescanné avec succès:", detectedVIN);

        // Mettre à jour uniquement le VIN
        setExtractedData((prev) => ({
          ...prev,
          numeroChassisVIN: detectedVIN,
        }));

        setEditedData((prev) => ({
          ...prev,
          numeroChassisVIN: detectedVIN,
        }));

        toast.success(`VIN détecté: ${detectedVIN}`, { duration: 3000 });

        // ✅ Rouvrir la modale de confirmation pour voir la mise à jour
        setShowConfirmationModal(true);
      } else {
        console.warn("⚠️ VIN toujours invalide après rescan");
        console.warn("Texte détecté:", result.data.text);
        console.warn("VIN extrait:", detectedVIN);
        toast.warning("VIN non détecté ou incorrect. Sélectionnez précisément la ligne E. (17 caractères)", {
          duration: 4000,
        });
        // Rouvrir quand même la modale pour permettre une nouvelle tentative
        setShowConfirmationModal(true);
      }

      setProgress(100);
    } catch (error) {
      console.error("Erreur rescan VIN:", error);
      toast.error("Erreur lors du rescan du VIN");
      // Rouvrir la modale même en cas d'erreur
      setShowConfirmationModal(true);
    } finally {
      setIsRescanningVIN(false);
      setProgress(0);
    }
  };

  /**
   * NOUVEAU v3.4: Ouvrir le sélecteur de zone pour l'immatriculation
   */
  const startImmatZoneSelection = () => {
    if (!imagePreview) {
      toast.error("Image originale non disponible");
      return;
    }
    setShowImmatZoneSelector(true);
  };

  /**
   * NOUVEAU v3.5: Scan ultra-précis de l'immatriculation sur la zone sélectionnée
   * Améliorations: Zoom x4, paramètres OCR améliorés
   */
  const processImmatZone = async (zoneCanvas: HTMLCanvasElement) => {
    setShowImmatZoneSelector(false);
    setIsRescanningImmat(true);
    setProgress(0);

    try {
      console.log("🔍 Rescan immatriculation sur zone sélectionnée (ultra-précis v3.5)...");

      setProgress(10);

      // ÉTAPE 1: Agrandir la zone x4 pour améliorer la précision
      const zoomedCanvas = document.createElement("canvas");
      zoomedCanvas.width = zoneCanvas.width * 4.0;
      zoomedCanvas.height = zoneCanvas.height * 4.0;
      const zoomedCtx = zoomedCanvas.getContext("2d");

      if (!zoomedCtx) throw new Error("Canvas context error");

      zoomedCtx.imageSmoothingEnabled = true;
      zoomedCtx.imageSmoothingQuality = "high";
      zoomedCtx.drawImage(zoneCanvas, 0, 0, zoomedCanvas.width, zoomedCanvas.height);

      console.log("✅ Zone agrandie x4:", zoomedCanvas.width, "x", zoomedCanvas.height);

      setProgress(20);

      // ÉTAPE 2: Appliquer le prétraitement optimisé
      console.log("🎨 Application du prétraitement optimisé...");
      preprocessForVIN(zoomedCanvas); // Utiliser le même prétraitement amélioré

      setProgress(40);

      // ÉTAPE 3: Convertir le canvas prétraité en blob
      const zoneBlob = await new Promise<Blob>((resolve, reject) => {
        zoomedCanvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Conversion échouée"));
        }, "image/png");
      });

      setProgress(50);

      // ÉTAPE 4: OCR avec paramètres optimisés pour immatriculation
      console.log("📖 OCR en cours avec paramètres optimisés...");
      const result = await Tesseract.recognize(zoneBlob, "fra", {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setProgress(50 + Math.round(m.progress * 40));
          }
        },
      });

      console.log("📄 Texte OCR brut:", result.data.text);

      // ÉTAPE 5: Extraire l'immatriculation
      const detectedImmat = extractImmatriculation(result.data.text);

      if (detectedImmat && isValidImmatriculation(detectedImmat)) {
        console.log("✅ Immatriculation rescannée avec succès:", detectedImmat);

        // Mettre à jour uniquement l'immatriculation
        setExtractedData((prev) => ({
          ...prev,
          immatriculation: detectedImmat,
        }));

        setEditedData((prev) => ({
          ...prev,
          immatriculation: detectedImmat,
        }));

        toast.success(`Immatriculation détectée: ${detectedImmat}`, { duration: 3000 });

        // ✅ Rouvrir la modale de confirmation pour voir la mise à jour
        setShowConfirmationModal(true);
      } else {
        console.warn("⚠️ Immatriculation toujours invalide après rescan");
        console.warn("Texte détecté:", result.data.text);
        toast.warning("Immatriculation non détectée. Sélectionnez précisément le champ A (format AA-123-AA)", {
          duration: 4000,
        });
        // Rouvrir quand même la modale pour permettre une nouvelle tentative
        setShowConfirmationModal(true);
      }

      setProgress(100);
    } catch (error) {
      console.error("Erreur rescan immatriculation:", error);
      toast.error("Erreur lors du rescan de l'immatriculation");
      // Rouvrir la modale même en cas d'erreur
      setShowConfirmationModal(true);
    } finally {
      setIsRescanningImmat(false);
      setProgress(0);
    }
  };

  /**
   * Ouvrir le sélecteur de zone pour la marque
   */
  const startMarqueZoneSelection = () => {
    if (!imagePreview) {
      toast.error("Image originale non disponible");
      return;
    }
    setShowMarqueZoneSelector(true);
  };

  /**
   * Scan de la marque sur la zone sélectionnée - v3.5
   */
  const processMarqueZone = async (zoneCanvas: HTMLCanvasElement) => {
    setShowMarqueZoneSelector(false);
    setIsRescanningMarque(true);
    setProgress(0);

    try {
      console.log("🔍 Rescan marque sur zone sélectionnée (v3.5)...");
      setProgress(10);

      // Agrandir la zone x4
      const zoomedCanvas = document.createElement("canvas");
      zoomedCanvas.width = zoneCanvas.width * 4.0;
      zoomedCanvas.height = zoneCanvas.height * 4.0;
      const zoomedCtx = zoomedCanvas.getContext("2d");

      if (!zoomedCtx) throw new Error("Canvas context error");

      zoomedCtx.imageSmoothingEnabled = true;
      zoomedCtx.imageSmoothingQuality = "high";
      zoomedCtx.drawImage(zoneCanvas, 0, 0, zoomedCanvas.width, zoomedCanvas.height);

      setProgress(20);

      // Prétraitement optimisé
      preprocessForVIN(zoomedCanvas);
      setProgress(40);

      // Convertir en blob
      const zoneBlob = await new Promise<Blob>((resolve, reject) => {
        zoomedCanvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Conversion échouée"));
        }, "image/png");
      });

      setProgress(50);

      // OCR avec paramètres optimisés
      const result = await Tesseract.recognize(zoneBlob, "fra", {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setProgress(50 + Math.round(m.progress * 40));
          }
        },
      });

      console.log("📄 Texte OCR détecté pour marque:", result.data.text);

      // Extraire la marque (prendre le texte le plus significatif)
      const lines = result.data.text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 2)
        .filter((line) => /^[A-Z]/i.test(line)); // Ligne commençant par une majuscule

      const detectedMarque = lines[0]; // Prendre la première ligne significative

      if (detectedMarque) {
        console.log("✅ Marque rescannée:", detectedMarque);

        setExtractedData((prev) => ({
          ...prev,
          marque: detectedMarque.toUpperCase(),
        }));

        setEditedData((prev) => ({
          ...prev,
          marque: detectedMarque.toUpperCase(),
        }));

        toast.success(`Marque détectée: ${detectedMarque}`, { duration: 3000 });
        setShowConfirmationModal(true);
      } else {
        console.warn("⚠️ Marque non détectée après rescan");
        toast.warning("Marque non détectée. Sélectionnez la zone du champ D.1", { duration: 4000 });
        setShowConfirmationModal(true);
      }

      setProgress(100);
    } catch (error) {
      console.error("Erreur rescan marque:", error);
      toast.error("Erreur lors du rescan de la marque");
      setShowConfirmationModal(true);
    } finally {
      setIsRescanningMarque(false);
      setProgress(0);
    }
  };

  /**
   * Ouvrir le sélecteur de zone pour le modèle
   */
  const startModeleZoneSelection = () => {
    if (!imagePreview) {
      toast.error("Image originale non disponible");
      return;
    }
    setShowModeleZoneSelector(true);
  };

  /**
   * Scan du modèle sur la zone sélectionnée - v3.5
   */
  const processModeleZone = async (zoneCanvas: HTMLCanvasElement) => {
    setShowModeleZoneSelector(false);
    setIsRescanningModele(true);
    setProgress(0);

    try {
      console.log("🔍 Rescan modèle sur zone sélectionnée (v3.5)...");
      setProgress(10);

      // Agrandir la zone x4
      const zoomedCanvas = document.createElement("canvas");
      zoomedCanvas.width = zoneCanvas.width * 4.0;
      zoomedCanvas.height = zoneCanvas.height * 4.0;
      const zoomedCtx = zoomedCanvas.getContext("2d");

      if (!zoomedCtx) throw new Error("Canvas context error");

      zoomedCtx.imageSmoothingEnabled = true;
      zoomedCtx.imageSmoothingQuality = "high";
      zoomedCtx.drawImage(zoneCanvas, 0, 0, zoomedCanvas.width, zoomedCanvas.height);

      setProgress(20);

      // Prétraitement optimisé
      preprocessForVIN(zoomedCanvas);
      setProgress(40);

      // Convertir en blob
      const zoneBlob = await new Promise<Blob>((resolve, reject) => {
        zoomedCanvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Conversion échouée"));
        }, "image/png");
      });

      setProgress(50);

      // OCR avec paramètres optimisés
      const result = await Tesseract.recognize(zoneBlob, "fra", {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setProgress(50 + Math.round(m.progress * 40));
          }
        },
      });

      console.log("📄 Texte OCR détecté pour modèle:", result.data.text);

      // Extraire le modèle (prendre le texte le plus significatif)
      const lines = result.data.text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 2)
        .filter((line) => /^[A-Z0-9]/i.test(line)); // Ligne commençant par une majuscule ou chiffre

      const detectedModele = lines[0]; // Prendre la première ligne significative

      if (detectedModele) {
        console.log("✅ Modèle rescanné:", detectedModele);

        setExtractedData((prev) => ({
          ...prev,
          denominationCommerciale: detectedModele,
        }));

        setEditedData((prev) => ({
          ...prev,
          denominationCommerciale: detectedModele,
        }));

        toast.success(`Modèle détecté: ${detectedModele}`, { duration: 3000 });
        setShowConfirmationModal(true);
      } else {
        console.warn("⚠️ Modèle non détecté après rescan");
        toast.warning("Modèle non détecté. Sélectionnez la zone du champ D.3", { duration: 4000 });
        setShowConfirmationModal(true);
      }

      setProgress(100);
    } catch (error) {
      console.error("Erreur rescan modèle:", error);
      toast.error("Erreur lors du rescan du modèle");
      setShowConfirmationModal(true);
    } finally {
      setIsRescanningModele(false);
      setProgress(0);
    }
  };

  const handleImageSelect = async (file: File) => {
    setLastImageFile(file); // Sauvegarder pour les rescans

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
    cancelRef.current = false;
    setIsCancelling(false);

    try {
      // Charger l'image
      const img = new Image();
      const imgUrl = URL.createObjectURL(file);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgUrl;
      });

      console.log("🔍 Démarrage OCR v3.4 (2 passes + rescan intelligent)...");

      const strategies = [
        { name: "Passe globale (OTSU adaptatif)", fn: preprocessStrategy2, scale: 1.8, type: "global" },
        { name: "Passe VIN dédiée (haute résolution)", fn: preprocessStrategy2, scale: 2.5, type: "vin" },
      ];

      const results: Array<{ text: string; confidence: number; data: VehicleRegistrationData; strategyName: string }> =
        [];

      for (let i = 0; i < strategies.length; i++) {
        if (cancelRef.current) {
          console.log("🛑 Scan annulé par l'utilisateur");
          URL.revokeObjectURL(imgUrl);
          toast.info("Scan annulé", { duration: 2000 });
          return;
        }

        const strategy = strategies[i];
        setProgress(Math.round((i / strategies.length) * 85));

        console.log(`📸 ${strategy.name} en cours...`);

        const canvas = document.createElement("canvas");
        canvas.width = img.width * strategy.scale;
        canvas.height = img.height * strategy.scale;
        const ctx = canvas.getContext("2d");

        if (!ctx) continue;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        strategy.fn(canvas);

        const preprocessedBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Conversion canvas vers blob échouée"));
          }, "image/png");
        });

        const ocrConfig =
          strategy.type === "vin"
            ? {
                logger: (m: any) => {
                  if (m.status === "recognizing text") {
                    const baseProgress = (i / strategies.length) * 85;
                    const stepProgress = (m.progress * 85) / strategies.length;
                    setProgress(Math.round(baseProgress + stepProgress));
                  }
                },
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
                tessedit_char_whitelist: "ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
                load_system_dawg: "0",
                load_freq_dawg: "0",
                preserve_interword_spaces: "0",
                classify_bln_numeric_mode: "1",
                tessedit_char_blacklist: "IOQ",
              }
            : {
                logger: (m: any) => {
                  if (m.status === "recognizing text") {
                    const baseProgress = (i / strategies.length) * 85;
                    const stepProgress = (m.progress * 85) / strategies.length;
                    setProgress(Math.round(baseProgress + stepProgress));
                  }
                },
                tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
                tessedit_char_whitelist: "ABCDEFGHJKLMNPRSTUVWXYZ0123456789-./: éèêàâôîûù",
                load_system_dawg: "0",
                load_freq_dawg: "0",
                preserve_interword_spaces: "1",
                classify_bln_numeric_mode: "1",
              };

        const result = await Tesseract.recognize(preprocessedBlob, "fra", ocrConfig);

        console.log(`  ✓ Pass ${i + 1} confiance: ${result.data.confidence.toFixed(1)}%`);

        const parsedData = parseRegistrationCardText(result.data.text);

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

      if (cancelRef.current) {
        console.log("🛑 Scan annulé par l'utilisateur");
        toast.info("Scan annulé", { duration: 2000 });
        return;
      }

      setProgress(90);

      console.log("🔄 Fusion intelligente des résultats des 2 passes...");

      let bestResult = results[0];
      let bestScore = 0;

      const fieldsDetected = Object.values(bestResult.data).filter(
        (v) => v !== undefined && v !== null && v !== "",
      ).length;
      bestScore = fieldsDetected * (bestResult.confidence / 100);

      console.log(
        `📊 Passe globale: ${fieldsDetected} champs, confiance ${bestResult.confidence.toFixed(1)}% → score ${bestScore.toFixed(2)}`,
      );

      if (results.length > 1) {
        const globalVIN = results[0].data.numeroChassisVIN;
        const vinPassVIN = results[1].data.numeroChassisVIN;

        console.log(`🔍 VIN passe globale: ${globalVIN || "non détecté"} (${globalVIN?.length || 0} car.)`);
        console.log(`🔍 VIN passe dédiée: ${vinPassVIN || "non détecté"} (${vinPassVIN?.length || 0} car.)`);

        if (vinPassVIN && vinPassVIN.length === 17 && (!globalVIN || globalVIN.length !== 17)) {
          console.log("✅ Utilisation du VIN de la passe dédiée (meilleur)");
          bestResult.data.numeroChassisVIN = vinPassVIN;
        } else if (
          globalVIN &&
          vinPassVIN &&
          globalVIN.length === 17 &&
          vinPassVIN.length === 17 &&
          globalVIN !== vinPassVIN
        ) {
          console.log("⚠️ Deux VIN différents détectés, priorité à la passe globale");
        }
      }

      setProgress(95);

      const finalData = bestResult.data;
      console.log("✅ Données finales extraites:", finalData);
      console.log(
        `📊 Total: ${Object.values(finalData).filter((v) => v !== undefined && v !== null && v !== "").length}/8 champs détectés`,
      );

      const rawOcrText = results.map((r) => r.text).join("\n\n--- NEXT PASS ---\n\n");
      setOcrText(rawOcrText);

      setExtractedData(finalData);
      setEditedData(finalData);

      // Ouvrir automatiquement le modal de vérification après le scan
      setShowConfirmationModal(true);

      const confidenceFields: FieldConfidence[] = Object.entries(finalData)
        .filter(([_, value]) => value !== undefined && value !== null && value !== "")
        .map(([field, value]) => ({
          field,
          value,
          confidence: 100,
          needsReview: field === "numeroChassisVIN" && typeof value === "string" && value.length !== 17,
        }));

      setConfidences(confidenceFields);

      setProgress(100);

      // Ne pas appeler onDataExtracted automatiquement - l'utilisateur doit valider
      // onDataExtracted(finalData);

      const detectedCount = Object.values(finalData).filter((v) => v !== undefined && v !== null && v !== "").length;
      toast.success(`${detectedCount}/8 champs détectés avec succès`, { duration: 3000 });
    } catch (error) {
      console.error("Erreur OCR:", error);
      toast.error("Erreur lors du traitement de l'image. Veuillez réessayer.", { duration: 5000 });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      cancelRef.current = false;
      setIsCancelling(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const handleRetry = () => {
    if (lastImageFile) {
      processImage(lastImageFile);
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setExtractedData(null);
    setOcrText("");
    setConfidences([]);
    setIsEditMode(false);
    setEditedData({});
    setLastImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCancel = () => {
    console.log("🛑 Demande d'annulation du scan...");
    cancelRef.current = true;
    setIsCancelling(true);
  };

  const handleEditField = (field: keyof VehicleRegistrationData, value: any) => {
    setEditedData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveEdits = () => {
    console.log("💾 Sauvegarde des modifications:", editedData);

    // Filtrer les valeurs undefined avant de passer au formulaire
    const cleanedData: Partial<VehicleRegistrationData> = {};
    Object.entries(editedData).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        (cleanedData as any)[key] = value;
      }
    });

    setExtractedData(editedData);
    setIsEditMode(false);
    onDataExtracted(cleanedData);
    toast.success("Modifications enregistrées", { duration: 2000 });
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      immatriculation: "Immatriculation (A)",
      datePremiereImmatriculation: "Date 1ère immatriculation (B)",
      numeroChassisVIN: "N° de châssis VIN (E)",
      marque: "Marque (D.1)",
      denominationCommerciale: "Modèle (D.3)",
      masseVide: "Masse à vide / G.1 (kg)",
      masseEnChargeMax: "PTAC / F.1 (kg)",
      genreNational: "Genre national (J.1)",
    };
    return labels[field] || field;
  };

  const getFieldStatus = (value: any) => {
    if (value === undefined || value === null || value === "") {
      return <Badge variant="outline">Non détecté</Badge>;
    }
    return (
      <span className="text-green-600 font-medium flex items-center gap-1">
        <CheckCircle2 className="h-4 w-4" />
        Détecté
      </span>
    );
  };

  /**
   * NOUVEAU v3.4: Déterminer le message pour le VIN
   */
  const getVINStatus = (): string => {
    if (!extractedData) return "";
    const vin = extractedData.numeroChassisVIN;
    if (!vin) return "VIN non détecté";
    if (vin.length !== 17) return `VIN incomplet (${vin.length}/17 car.)`;
    if (!isValidVINFormat(vin)) return "VIN invalide";
    return "VIN détecté";
  };

  /**
   * NOUVEAU v3.4: Déterminer le message pour l'immatriculation
   */
  const getImmatStatus = (): string => {
    if (!extractedData) return "";
    const immat = extractedData.immatriculation;
    if (!immat) return "Immatriculation non détectée";
    if (!isValidImmatriculation(immat)) return "Immatriculation invalide";
    return "Immatriculation détectée";
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scanner une carte grise
          </CardTitle>
          <CardDescription>
            Prenez une photo de la carte grise pour extraire automatiquement les informations du véhicule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!imagePreview ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <Button onClick={() => fileInputRef.current?.click()} className="w-full h-24">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6" />
                    <span>Choisir une photo de la carte grise</span>
                  </div>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  capture="environment"
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Conseils pour une meilleure détection :</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Utilisez un éclairage naturel (lumière du jour)</li>
                    <li>Posez la carte grise à plat sur une surface</li>
                    <li>Évitez les reflets et les ombres</li>
                    <li>Assurez-vous que le texte est net et lisible</li>
                    <li>Centrez la carte dans le cadre de la photo</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <img src={imagePreview} alt="Carte grise" className="w-full rounded-lg border" />
                {!isProcessing && !extractedData && (
                  <Button variant="outline" size="sm" onClick={handleReset} className="absolute top-2 right-2">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {isProcessing && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Analyse en cours...</span>
                    <span className="text-muted-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      {progress < 45
                        ? "Scan global de la carte..."
                        : progress < 90
                          ? "Scan précis du VIN..."
                          : "Finalisation..."}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={isCancelling} className="w-full">
                    {isCancelling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Annulation...
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Annuler le scan
                      </>
                    )}
                  </Button>
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
                            {/* Immatriculation avec bouton rescan */}
                            <li className="flex items-center justify-between gap-2">
                              <span>Immatriculation:</span>
                              <div className="flex items-center gap-2">
                                {getFieldStatus(extractedData.immatriculation)}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={startImmatZoneSelection}
                                  disabled={isRescanningImmat}
                                  className="h-8 px-3 text-xs"
                                  title="Rescanner l'immatriculation"
                                >
                                  {isRescanningImmat ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Scan...
                                    </>
                                  ) : (
                                    <>
                                      <ScanLine className="h-3 w-3 mr-1" />
                                      Rescan
                                    </>
                                  )}
                                </Button>
                              </div>
                            </li>
                            <li className="flex items-center justify-between">
                              <span>Date 1ère immat.:</span>
                              {getFieldStatus(extractedData.datePremiereImmatriculation)}
                            </li>
                            {/* VIN avec bouton rescan */}
                            <li className="flex items-center justify-between gap-2">
                              <span>N° de châssis:</span>
                              <div className="flex items-center gap-2">
                                {getFieldStatus(extractedData.numeroChassisVIN)}
                                {extractedData.numeroChassisVIN && extractedData.numeroChassisVIN.length !== 17 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {extractedData.numeroChassisVIN.length}/17
                                  </Badge>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={startVINZoneSelection}
                                  disabled={isRescanningVIN}
                                  className="h-8 px-3 text-xs"
                                  title="Rescanner le VIN"
                                >
                                  {isRescanningVIN ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Scan...
                                    </>
                                  ) : (
                                    <>
                                      <ScanLine className="h-3 w-3 mr-1" />
                                      Rescan
                                    </>
                                  )}
                                </Button>
                              </div>
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

                      {/* Message d'aide pour les boutons de rescan */}
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                        <ScanLine className="h-3 w-3" />
                        Cliquez sur "Rescan" pour sélectionner une zone précise (agrandie x3 automatiquement)
                      </p>
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
                      <Button
                        type="button"
                        onClick={() => {
                          // Ouvrir le modal de confirmation au lieu de passer directement les données
                          setShowConfirmationModal(true);
                        }}
                        className="flex-1"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Utiliser ces données
                      </Button>
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

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Confidentialité garantie :</strong> Toutes les données sont traitées localement dans votre
              navigateur. Aucune information n'est envoyée à un serveur tiers.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Modal de confirmation des données scannées */}
      {extractedData && (
        <ScanConfirmationModal
          isOpen={showConfirmationModal}
          onClose={() => setShowConfirmationModal(false)}
          scannedData={extractedData}
          onConfirm={(confirmedData) => {
            // Filtrer les valeurs undefined avant de passer au formulaire
            const cleanedData: Partial<VehicleRegistrationData> = {};
            Object.entries(confirmedData).forEach(([key, value]) => {
              if (value !== undefined && value !== null && value !== "") {
                (cleanedData as any)[key] = value;
              }
            });
            onDataExtracted(cleanedData as VehicleRegistrationData);
            toast.success("Données vérifiées et utilisées dans le formulaire ✓", { duration: 2000 });
            setShowConfirmationModal(false);
          }}
          onRescanVIN={startVINZoneSelection}
          onRescanImmat={startImmatZoneSelection}
          onRescanMarque={startMarqueZoneSelection}
          onRescanModele={startModeleZoneSelection}
        />
      )}

      {/* Sélecteur de zone pour le VIN */}
      {showVINZoneSelector && imagePreview && (
        <ImageZoneSelector
          imageUrl={imagePreview}
          onZoneSelected={processVINZone}
          onCancel={() => setShowVINZoneSelector(false)}
          title="Sélectionner la zone du VIN"
          hint="Dessinez un rectangle autour de la ligne E. (VIN)"
        />
      )}

      {/* Sélecteur de zone pour l'immatriculation */}
      {showImmatZoneSelector && imagePreview && (
        <ImageZoneSelector
          imageUrl={imagePreview}
          onZoneSelected={processImmatZone}
          onCancel={() => setShowImmatZoneSelector(false)}
          title="Sélectionner la zone de l'immatriculation"
          hint="Dessinez un rectangle autour du champ A (immatriculation)"
        />
      )}

      {/* Sélecteur de zone pour la marque */}
      {showMarqueZoneSelector && imagePreview && (
        <ImageZoneSelector
          imageUrl={imagePreview}
          onZoneSelected={processMarqueZone}
          onCancel={() => setShowMarqueZoneSelector(false)}
          title="Sélectionner la zone de la marque"
          hint="Dessinez un rectangle autour du champ D.1 (Marque)"
        />
      )}

      {/* Sélecteur de zone pour le modèle */}
      {showModeleZoneSelector && imagePreview && (
        <ImageZoneSelector
          imageUrl={imagePreview}
          onZoneSelected={processModeleZone}
          onCancel={() => setShowModeleZoneSelector(false)}
          title="Sélectionner la zone du modèle"
          hint="Dessinez un rectangle autour du champ D.3 (Dénomination commerciale)"
        />
      )}
    </>
  );
};

export default VehicleRegistrationScanner;
