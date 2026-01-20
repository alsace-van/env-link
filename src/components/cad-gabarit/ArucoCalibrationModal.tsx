// ============================================
// COMPONENT: ArucoCalibrationModal
// Modale de calibration automatique via ArUco markers
// VERSION: 1.0
// ============================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  QrCode,
  Loader2,
  Check,
  AlertCircle,
  Download,
  Camera,
  Ruler,
  Info
} from "lucide-react";
import { useOpenCVAruco, ArucoMarker } from "./useOpenCVAruco";
import type { BackgroundImage } from "./types";
import { toast } from "sonner";

interface ArucoCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: BackgroundImage | null;
  onCalibrated: (pixelsPerCm: number, markers: ArucoMarker[]) => void;
  onSkip: () => void;
}

export function ArucoCalibrationModal({
  isOpen,
  onClose,
  image,
  onCalibrated,
  onSkip,
}: ArucoCalibrationModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [markerSizeCm, setMarkerSizeCm] = useState<string>("10");
  const [detectedMarkers, setDetectedMarkers] = useState<ArucoMarker[]>([]);
  const [calculatedScale, setCalculatedScale] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const {
    isLoaded,
    isLoading,
    error,
    detectMarkers,
    calculateScale,
  } = useOpenCVAruco();

  // Viewport pour prévisualisation
  const [previewViewport, setPreviewViewport] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  // Reset quand l'image change
  useEffect(() => {
    if (image && isOpen) {
      setDetectedMarkers([]);
      setCalculatedScale(null);

      // Calculer le scale pour que l'image rentre
      if (image.image && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth || 600;
        const containerHeight = 350;
        const imgWidth = image.image.width;
        const imgHeight = image.image.height;

        const scaleX = (containerWidth - 40) / imgWidth;
        const scaleY = (containerHeight - 40) / imgHeight;
        const scale = Math.min(scaleX, scaleY, 1);

        setPreviewViewport({
          scale,
          offsetX: (containerWidth - imgWidth * scale) / 2,
          offsetY: (containerHeight - imgHeight * scale) / 2,
        });
      }
    }
  }, [image, isOpen]);

  // Détecter automatiquement quand OpenCV est chargé
  useEffect(() => {
    if (isLoaded && image?.image && isOpen && detectedMarkers.length === 0) {
      handleDetect();
    }
  }, [isLoaded, image, isOpen]);

  // Dessiner le canvas avec les markers détectés
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image?.image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { scale, offsetX, offsetY } = previewViewport;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(image.image, 0, 0);
    ctx.restore();

    // Draw detected markers
    detectedMarkers.forEach((marker) => {
      // Dessiner le contour du marker
      ctx.beginPath();
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 2;

      const corners = marker.corners.map((c) => ({
        x: c.x * scale + offsetX,
        y: c.y * scale + offsetY,
      }));

      ctx.moveTo(corners[0].x, corners[0].y);
      corners.forEach((c, i) => {
        if (i > 0) ctx.lineTo(c.x, c.y);
      });
      ctx.closePath();
      ctx.stroke();

      // Remplissage semi-transparent
      ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
      ctx.fill();

      // Afficher l'ID au centre
      const centerX = marker.center.x * scale + offsetX;
      const centerY = marker.center.y * scale + offsetY;

      ctx.fillStyle = "#00ff00";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Fond pour le texte
      const text = `#${marker.id}`;
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(centerX - textWidth / 2 - 4, centerY - 10, textWidth + 8, 20);

      ctx.fillStyle = "#00ff00";
      ctx.fillText(text, centerX, centerY);
    });

    // Afficher le statut
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = detectedMarkers.length > 0 ? "#00ff00" : "#ff6b6b";
    ctx.fillText(
      detectedMarkers.length > 0
        ? `${detectedMarkers.length} marker(s) détecté(s)`
        : "Aucun marker détecté",
      10,
      canvas.height - 10
    );
  }, [image, previewViewport, detectedMarkers]);

  // Lancer la détection
  const handleDetect = useCallback(async () => {
    if (!image?.image || !isLoaded) return;

    setIsProcessing(true);
    try {
      const markers = await detectMarkers(image.image);
      setDetectedMarkers(markers);

      if (markers.length > 0) {
        const size = parseFloat(markerSizeCm) || 10;
        const scale = calculateScale(markers, size);
        setCalculatedScale(scale);

        if (scale) {
          toast.success(`${markers.length} marker(s) détecté(s) - Échelle: ${scale.toFixed(2)} px/cm`);
        }
      } else {
        toast.warning("Aucun marker ArUco détecté dans l'image");
        setCalculatedScale(null);
      }
    } catch (err) {
      console.error("Erreur détection:", err);
      toast.error("Erreur lors de la détection des markers");
    } finally {
      setIsProcessing(false);
    }
  }, [image, isLoaded, detectMarkers, calculateScale, markerSizeCm]);

  // Recalculer l'échelle quand la taille du marker change
  useEffect(() => {
    if (detectedMarkers.length > 0) {
      const size = parseFloat(markerSizeCm) || 10;
      const scale = calculateScale(detectedMarkers, size);
      setCalculatedScale(scale);
    }
  }, [markerSizeCm, detectedMarkers, calculateScale]);

  // Appliquer la calibration
  const handleApply = () => {
    if (calculatedScale && detectedMarkers.length > 0) {
      onCalibrated(calculatedScale, detectedMarkers);
      toast.success("Calibration ArUco appliquée");
    }
  };

  // Télécharger la planche de markers
  const handleDownloadMarkers = () => {
    // Générer une planche de markers ArUco
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const markerSize = 150;
    const margin = 30;
    const cols = 4;
    const rows = 3;

    canvas.width = cols * (markerSize + margin) + margin;
    canvas.height = rows * (markerSize + margin) + margin + 60;

    // Fond blanc
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Titre
    ctx.fillStyle = "black";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Markers ArUco - Imprimez et découpez", canvas.width / 2, 25);
    ctx.font = "12px sans-serif";
    ctx.fillText(`Taille réelle recommandée: ${markerSizeCm} cm × ${markerSizeCm} cm`, canvas.width / 2, 45);

    // Dessiner des placeholders (les vrais markers nécessitent OpenCV)
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = margin + col * (markerSize + margin);
        const y = 60 + margin + row * (markerSize + margin);
        const id = row * cols + col;

        // Cadre
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, markerSize, markerSize);

        // ID
        ctx.fillStyle = "#666";
        ctx.fillText(`ID: ${id}`, x + markerSize / 2, y + markerSize / 2);

        // Note
        ctx.font = "10px sans-serif";
        ctx.fillText("(ArUco 4x4)", x + markerSize / 2, y + markerSize / 2 + 20);
        ctx.font = "bold 24px monospace";
      }
    }

    // Note en bas
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#666";
    ctx.fillText(
      "Téléchargez les vrais markers sur: https://chev.me/arucogen/",
      canvas.width / 2,
      canvas.height - 10
    );

    // Télécharger
    const link = document.createElement("a");
    link.download = "aruco_markers_template.png";
    link.href = canvas.toDataURL("image/png");
    link.click();

    toast.info("Pour de vrais markers, visitez chev.me/arucogen (Dictionary: 4x4_50)");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Calibration automatique ArUco
          </DialogTitle>
          <DialogDescription>
            Détection automatique des markers ArUco pour calibrer l'échelle de l'image
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status OpenCV */}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-2 rounded">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement d'OpenCV.js...
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Canvas de prévisualisation */}
          <div
            ref={containerRef}
            className="relative border rounded-lg overflow-hidden bg-muted"
            style={{ height: 350 }}
          >
            <canvas
              ref={canvasRef}
              width={600}
              height={350}
              className="w-full h-full"
            />

            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="flex items-center gap-2 text-white">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Détection en cours...
                </div>
              </div>
            )}
          </div>

          {/* Paramètres */}
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="markerSize" className="text-sm">
                Taille réelle des markers (cm)
              </Label>
              <Input
                id="markerSize"
                type="number"
                value={markerSizeCm}
                onChange={(e) => setMarkerSizeCm(e.target.value)}
                min="1"
                max="100"
                step="0.5"
                className="mt-1"
              />
            </div>

            <Button
              variant="outline"
              onClick={handleDetect}
              disabled={!isLoaded || isProcessing || !image}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              Détecter
            </Button>
          </div>

          {/* Résultat */}
          {calculatedScale !== null && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <Check className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <div className="font-medium text-green-700 dark:text-green-400">
                  Calibration réussie
                </div>
                <div className="text-sm text-muted-foreground">
                  Échelle: <strong>{calculatedScale.toFixed(2)} pixels/cm</strong>
                  {" "}({(1 / calculatedScale * 10).toFixed(2)} mm/pixel)
                </div>
              </div>
              <Ruler className="h-5 w-5 text-green-500" />
            </div>
          )}

          {/* Aide */}
          <div className="text-sm text-muted-foreground space-y-2">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Info className="h-4 w-4" />
              {showHelp ? "Masquer l'aide" : "Comment ça marche ?"}
            </button>

            {showHelp && (
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <p>
                  <strong>1.</strong> Imprimez des markers ArUco (dictionnaire 4x4_50) à une taille connue
                </p>
                <p>
                  <strong>2.</strong> Placez-les sur la surface à photographier
                </p>
                <p>
                  <strong>3.</strong> Prenez votre photo avec les markers visibles
                </p>
                <p>
                  <strong>4.</strong> L'échelle est calculée automatiquement
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto"
                  onClick={handleDownloadMarkers}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Télécharger un template de markers
                </Button>
                {" ou visitez "}
                <a
                  href="https://chev.me/arucogen/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  chev.me/arucogen
                </a>
                {" (4x4_50)"}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onSkip}>
            Passer
          </Button>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleApply}
            disabled={calculatedScale === null}
          >
            <Check className="h-4 w-4 mr-2" />
            Appliquer ({detectedMarkers.length} markers)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ArucoCalibrationModal;
