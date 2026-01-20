// ============================================
// COMPONENT: ArucoCalibrationModal
// Modale de calibration automatique via ArUco markers
// VERSION: 2.0 - Debug visuel amélioré
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
  Info,
  Bug,
  Eye
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
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [markerSizeCm, setMarkerSizeCm] = useState<string>("10");
  const [detectedMarkers, setDetectedMarkers] = useState<ArucoMarker[]>([]);
  const [calculatedScale, setCalculatedScale] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

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
      setDebugInfo([]);

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
      // Petit délai pour laisser le render se faire
      const timer = setTimeout(() => {
        handleDetect();
      }, 100);
      return () => clearTimeout(timer);
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
    detectedMarkers.forEach((marker, idx) => {
      // Dessiner le contour du marker
      ctx.beginPath();
      ctx.strokeStyle = marker.confidence && marker.confidence < 1 ? "#ffff00" : "#00ff00";
      ctx.lineWidth = 3;

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
      ctx.fillStyle = marker.confidence && marker.confidence < 1
        ? "rgba(255, 255, 0, 0.2)"
        : "rgba(0, 255, 0, 0.2)";
      ctx.fill();

      // Numéroter les coins
      corners.forEach((c, cornerIdx) => {
        ctx.fillStyle = ["#ff0000", "#00ff00", "#0000ff", "#ff00ff"][cornerIdx];
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Afficher l'ID au centre
      const centerX = marker.center.x * scale + offsetX;
      const centerY = marker.center.y * scale + offsetY;

      ctx.fillStyle = "#00ff00";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Fond pour le texte
      const text = `#${marker.id}`;
      const confText = marker.confidence ? ` (${(marker.confidence * 100).toFixed(0)}%)` : "";
      const fullText = text + confText;
      const textWidth = ctx.measureText(fullText).width;
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(centerX - textWidth / 2 - 6, centerY - 12, textWidth + 12, 24);

      ctx.fillStyle = marker.confidence && marker.confidence < 1 ? "#ffff00" : "#00ff00";
      ctx.fillText(fullText, centerX, centerY);
    });

    // Afficher le statut
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = detectedMarkers.length > 0 ? "#00ff00" : "#ff6b6b";

    const statusBg = "rgba(0, 0, 0, 0.7)";
    const statusText = detectedMarkers.length > 0
      ? `✓ ${detectedMarkers.length} marker(s) détecté(s)`
      : "✗ Aucun marker détecté";

    const statusWidth = ctx.measureText(statusText).width;
    ctx.fillStyle = statusBg;
    ctx.fillRect(5, canvas.height - 30, statusWidth + 20, 25);

    ctx.fillStyle = detectedMarkers.length > 0 ? "#00ff00" : "#ff6b6b";
    ctx.fillText(statusText, 15, canvas.height - 13);

  }, [image, previewViewport, detectedMarkers]);

  // Lancer la détection
  const handleDetect = useCallback(async () => {
    if (!image?.image || !isLoaded) return;

    setIsProcessing(true);
    setDebugInfo(["Démarrage de la détection..."]);

    try {
      const startTime = performance.now();
      const markers = await detectMarkers(image.image);
      const elapsed = performance.now() - startTime;

      setDetectedMarkers(markers);

      const newDebugInfo = [
        `Temps de détection: ${elapsed.toFixed(0)}ms`,
        `Image: ${image.image.width}x${image.image.height}px`,
        `Markers trouvés: ${markers.length}`,
      ];

      markers.forEach(m => {
        newDebugInfo.push(
          `  → ID ${m.id}: pos(${m.center.x.toFixed(0)}, ${m.center.y.toFixed(0)}) ` +
          `taille(${m.size.width.toFixed(0)}x${m.size.height.toFixed(0)}) ` +
          `conf:${((m.confidence || 1) * 100).toFixed(0)}%`
        );
      });

      setDebugInfo(newDebugInfo);

      if (markers.length > 0) {
        const size = parseFloat(markerSizeCm) || 10;
        const scale = calculateScale(markers, size);
        setCalculatedScale(scale);

        if (scale) {
          toast.success(`${markers.length} marker(s) détecté(s) - Échelle: ${scale.toFixed(2)} px/cm`);
        }
      } else {
        toast.warning("Aucun marker ArUco détecté. Vérifiez que les markers sont visibles et bien éclairés.");
        setCalculatedScale(null);
      }
    } catch (err) {
      console.error("Erreur détection:", err);
      setDebugInfo(prev => [...prev, `ERREUR: ${err}`]);
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
  const handleApply = useCallback(() => {
    if (calculatedScale && detectedMarkers.length > 0) {
      onCalibrated(calculatedScale, detectedMarkers);
      toast.success("Calibration ArUco appliquée");
    }
  }, [calculatedScale, detectedMarkers, onCalibrated]);

  // Télécharger la planche de markers
  const handleDownloadMarkers = useCallback(() => {
    // Ouvrir le générateur de markers ArUco
    window.open("https://chev.me/arucogen/", "_blank");
    toast.info("Sélectionnez: Dictionary=4x4 (50 markers), Marker ID=0-11, puis téléchargez");
  }, []);

  // Générer une image de test avec des markers
  const handleGenerateTestImage = useCallback(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;

    // Fond
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dessiner quelques markers 4x4 simplifiés
    const drawMarker = (x: number, y: number, size: number, id: number) => {
      const cellSize = size / 6;

      // Bordure noire
      ctx.fillStyle = "#000";
      ctx.fillRect(x, y, size, size);

      // Pattern intérieur (simplifié)
      ctx.fillStyle = "#fff";
      const patterns: number[][] = [
        [1,0,1,0, 1,1,1,0, 1,1,1,1, 0,1,1,0], // ID 0 approx
        [1,1,0,1, 0,1,1,0, 1,0,1,1, 0,1,1,0], // ID 1 approx
        [0,1,1,0, 1,1,0,1, 1,0,1,0, 0,1,1,1], // ID 2 approx
        [0,0,0,1, 1,0,0,1, 1,1,0,1, 0,1,0,1], // ID 3 approx
      ];

      const pattern = patterns[id % patterns.length];
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          if (pattern[row * 4 + col] === 1) {
            ctx.fillRect(
              x + (col + 1) * cellSize,
              y + (row + 1) * cellSize,
              cellSize,
              cellSize
            );
          }
        }
      }
    };

    // Placer 4 markers
    drawMarker(50, 50, 100, 0);
    drawMarker(650, 50, 100, 1);
    drawMarker(50, 450, 100, 2);
    drawMarker(650, 450, 100, 3);

    // Texte
    ctx.fillStyle = "#333";
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Image de test ArUco - 4 markers", canvas.width / 2, canvas.height / 2);

    // Télécharger
    const link = document.createElement("a");
    link.download = "aruco_test_image.png";
    link.href = canvas.toDataURL("image/png");
    link.click();

    toast.success("Image de test téléchargée - utilisez-la pour tester la détection");
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Calibration automatique ArUco v6.0
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
                <div className="flex items-center gap-2 text-white bg-black/70 px-4 py-2 rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analyse multi-pass en cours...
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

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDebug(!showDebug)}
              title="Debug"
            >
              <Bug className={`h-4 w-4 ${showDebug ? "text-yellow-500" : ""}`} />
            </Button>
          </div>

          {/* Debug info */}
          {showDebug && debugInfo.length > 0 && (
            <div className="p-3 bg-gray-900 text-green-400 font-mono text-xs rounded-lg max-h-32 overflow-y-auto">
              {debugInfo.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}

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
                  <strong>1.</strong> Imprimez des markers ArUco (dictionnaire 4x4_50) à une taille connue (ex: 10cm)
                </p>
                <p>
                  <strong>2.</strong> Placez-les sur la surface à photographier (au moins 2 visibles)
                </p>
                <p>
                  <strong>3.</strong> Prenez votre photo avec les markers visibles et bien éclairés
                </p>
                <p>
                  <strong>4.</strong> L'échelle est calculée automatiquement
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadMarkers}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Obtenir des markers
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateTestImage}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Image de test
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Sur chev.me/arucogen: Dictionary = "4x4 (50 markers)", taille = votre taille souhaitée
                </p>
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
