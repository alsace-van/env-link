// ============================================
// COMPONENT: ArucoCalibrationModal
// Modale de calibration automatique via ArUco markers
// VERSION: 2.2 - Layout horizontal + labels discrets
// ============================================
//
// CHANGELOG v2.2 (21/01/2026):
// - Layout horizontal: image grande à gauche, panneau contrôles à droite
// - Labels markers discrets: fond transparent, texte 11px, juste l'ID
// - Liste des markers avec confiance dans le panneau droit
// - Modale élargie (max-w-5xl)
//
// CHANGELOG v2.1 (21/01/2026):
// - FIX: Image trop grande - utilise ResizeObserver pour dimensions réelles
// - Zone de prévisualisation agrandie (400px au lieu de 350px)
// - Canvas se redimensionne dynamiquement
//
// CHANGELOG v2.0:
// - Debug visuel amélioré
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
  
  // v2.1: Dimensions du container (mis à jour par ResizeObserver)
  const [containerSize, setContainerSize] = useState({ width: 600, height: 400 });

  // v2.1: Observer les changements de taille du container
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [isOpen]);

  // Reset quand l'image change ou les dimensions du container
  useEffect(() => {
    if (image && isOpen && image.image) {
      setDetectedMarkers([]);
      setCalculatedScale(null);
      setDebugInfo([]);

      // v2.1: Calculer le scale avec les dimensions observées
      const containerWidth = containerSize.width || 600;
      const containerHeight = containerSize.height || 400;
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
  }, [image, isOpen, containerSize]);

  // Détecter automatiquement quand OpenCV est chargé
  useEffect(() => {
    if (!isOpen) return;
    if (!isLoaded || !image?.image) return;
    if (detectedMarkers.length > 0) return;
    
    // Petit délai pour laisser le render se faire
    const timer = setTimeout(() => {
      handleDetect();
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Afficher l'ID au centre - v2.2: plus discret
      const centerX = marker.center.x * scale + offsetX;
      const centerY = marker.center.y * scale + offsetY;

      // v2.2: Fond très transparent, texte plus petit
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Juste l'ID, pas le pourcentage (affiché dans le panneau)
      const text = `#${marker.id}`;
      const textWidth = ctx.measureText(text).width;
      
      // Fond semi-transparent discret
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(centerX - textWidth / 2 - 4, centerY - 8, textWidth + 8, 16);

      ctx.fillStyle = marker.confidence && marker.confidence < 1 ? "#ffff00" : "#00ff00";
      ctx.fillText(text, centerX, centerY);
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

  }, [image, previewViewport, detectedMarkers, containerSize]);

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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Calibration automatique ArUco v6.0
          </DialogTitle>
          <DialogDescription>
            Détection automatique des markers ArUco pour calibrer l'échelle de l'image
          </DialogDescription>
        </DialogHeader>

        {/* v2.2: Layout horizontal - image à gauche, panneau à droite */}
        <div className="flex gap-4">
          {/* Colonne gauche: Canvas de prévisualisation (plus grand) */}
          <div className="flex-1 min-w-0">
            {/* Status OpenCV */}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-2 rounded mb-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement d'OpenCV.js...
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded mb-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div
              ref={containerRef}
              className="relative border rounded-lg overflow-hidden bg-muted"
              style={{ height: 450 }}
            >
              <canvas
                ref={canvasRef}
                width={containerSize.width || 600}
                height={containerSize.height || 450}
                className="w-full h-full"
              />

              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="flex items-center gap-2 text-white bg-black/70 px-4 py-2 rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Analyse en cours...
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Colonne droite: Contrôles et résultats */}
          <div className="w-64 flex flex-col gap-3">
            {/* Paramètres */}
            <div className="space-y-2">
              <Label htmlFor="markerSize" className="text-sm font-medium">
                Taille markers (cm)
              </Label>
              <Input
                id="markerSize"
                type="number"
                value={markerSizeCm}
                onChange={(e) => setMarkerSizeCm(e.target.value)}
                min="1"
                max="100"
                step="0.5"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDetect}
                disabled={!isLoaded || isProcessing || !image}
                className="flex-1"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Camera className="h-4 w-4 mr-1" />
                )}
                Détecter
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDebug(!showDebug)}
                title="Debug"
              >
                <Bug className="h-4 w-4" />
              </Button>
            </div>

            {/* Markers détectés */}
            {detectedMarkers.length > 0 && (
              <div className="border rounded-lg p-2 bg-muted/50">
                <div className="text-xs font-medium text-green-600 mb-2">
                  ✓ {detectedMarkers.length} marker(s)
                </div>
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {detectedMarkers.map((m) => (
                    <div key={m.id} className="text-xs flex justify-between items-center px-1 py-0.5 rounded bg-background">
                      <span className="font-mono">#{m.id}</span>
                      <span className={`${m.confidence && m.confidence < 1 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {m.confidence ? `${(m.confidence * 100).toFixed(0)}%` : '100%'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Résultat calibration */}
            {calculatedScale && (
              <div className="border rounded-lg p-2 bg-green-50 dark:bg-green-950">
                <div className="flex items-center gap-1 text-green-700 dark:text-green-400 text-sm font-medium mb-1">
                  <Ruler className="h-3.5 w-3.5" />
                  Échelle calculée
                </div>
                <div className="text-lg font-bold text-green-800 dark:text-green-300">
                  {calculatedScale.toFixed(2)} px/cm
                </div>
              </div>
            )}

            {/* Aide */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(!showHelp)}
              className="text-xs justify-start"
            >
              <Info className="h-3.5 w-3.5 mr-1" />
              {showHelp ? "Masquer l'aide" : "Aide"}
            </Button>

            {showHelp && (
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded space-y-1">
                <p>• Utilisez des markers ArUco 4×4</p>
                <p>• Taille réelle = dimension imprimée</p>
                <p>• Minimum 1 marker requis</p>
              </div>
            )}
          </div>
        </div>

        {/* Debug info - pleine largeur */}
        {showDebug && debugInfo.length > 0 && (
          <div className="p-3 bg-gray-900 text-green-400 font-mono text-xs rounded-lg max-h-32 overflow-y-auto">
            {debugInfo.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

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
