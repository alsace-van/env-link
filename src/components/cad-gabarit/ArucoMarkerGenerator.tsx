// ============================================
// COMPONENT: ArucoMarkerGenerator
// Génère et télécharge des markers ArUco (PDF/PNG)
// VERSION: 1.0
// ============================================

import React, { useState, useCallback, useRef, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QrCode, Download, Loader2, Printer, Grid3X3 } from "lucide-react";
import { useOpenCVAruco } from "./useOpenCVAruco";
import { toast } from "sonner";

interface ArucoMarkerGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

type MarkerLayout = "single" | "grid-2x2" | "grid-3x3" | "grid-4x4" | "a4-sheet";

export function ArucoMarkerGenerator({ isOpen, onClose }: ArucoMarkerGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [markerSizeCm, setMarkerSizeCm] = useState<string>("10");
  const [startId, setStartId] = useState<string>("0");
  const [layout, setLayout] = useState<MarkerLayout>("grid-3x3");
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);

  const { isLoaded, isLoading } = useOpenCVAruco();

  // Générer les markers quand les paramètres changent
  useEffect(() => {
    if (isLoaded && isOpen) {
      generatePreview();
    }
  }, [isLoaded, isOpen, layout, startId, markerSizeCm]);

  // Générer un marker ArUco avec OpenCV
  const generateMarkerImage = useCallback((id: number, size: number): HTMLCanvasElement | null => {
    const cv = (window as any).cv;
    if (!cv) return null;

    try {
      // Créer le dictionnaire ArUco 4x4_50
      const dictionary = cv.aruco.getPredefinedDictionary(cv.aruco.DICT_4X4_50);

      // Générer le marker
      const markerImage = new cv.Mat();
      cv.aruco.generateImageMarker(dictionary, id, size, markerImage, 1);

      // Convertir en canvas
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      cv.imshow(canvas, markerImage);

      markerImage.delete();
      return canvas;
    } catch (err) {
      console.error("Erreur génération marker:", err);
      return null;
    }
  }, []);

  // Générer la prévisualisation
  const generatePreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isLoaded) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsGenerating(true);

    try {
      const markerSizePx = 100; // Taille pour la preview
      const margin = 20;
      const labelHeight = 25;

      let cols = 1, rows = 1;
      switch (layout) {
        case "single": cols = 1; rows = 1; break;
        case "grid-2x2": cols = 2; rows = 2; break;
        case "grid-3x3": cols = 3; rows = 3; break;
        case "grid-4x4": cols = 4; rows = 4; break;
        case "a4-sheet": cols = 3; rows = 4; break;
      }

      const canvasWidth = cols * (markerSizePx + margin) + margin;
      const canvasHeight = rows * (markerSizePx + margin + labelHeight) + margin + 40;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Fond blanc
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Titre
      ctx.fillStyle = "#333";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Markers ArUco 4x4_50 - ${markerSizeCm}cm`, canvasWidth / 2, 20);

      const start = parseInt(startId) || 0;
      let markerId = start;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (markerId >= 50) break; // Max 50 markers dans DICT_4X4_50

          const x = margin + col * (markerSizePx + margin);
          const y = 35 + row * (markerSizePx + margin + labelHeight);

          // Générer le marker
          const markerCanvas = generateMarkerImage(markerId, markerSizePx);

          if (markerCanvas) {
            // Bordure blanche autour du marker (important pour la détection)
            ctx.fillStyle = "white";
            ctx.fillRect(x - 5, y - 5, markerSizePx + 10, markerSizePx + 10);

            // Dessiner le marker
            ctx.drawImage(markerCanvas, x, y);

            // Cadre
            ctx.strokeStyle = "#ddd";
            ctx.lineWidth = 1;
            ctx.strokeRect(x - 5, y - 5, markerSizePx + 10, markerSizePx + 10);
          }

          // Label
          ctx.fillStyle = "#666";
          ctx.font = "12px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`ID: ${markerId}`, x + markerSizePx / 2, y + markerSizePx + 15);

          markerId++;
        }
      }

      // Note en bas
      ctx.fillStyle = "#999";
      ctx.font = "10px sans-serif";
      ctx.fillText(
        `Taille réelle: ${markerSizeCm}cm × ${markerSizeCm}cm | Imprimer à 100%`,
        canvasWidth / 2,
        canvasHeight - 8
      );

      setPreviewReady(true);
    } catch (err) {
      console.error("Erreur preview:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [isLoaded, layout, startId, markerSizeCm, generateMarkerImage]);

  // Télécharger en PNG haute résolution
  const handleDownloadPNG = useCallback(() => {
    if (!isLoaded) return;

    setIsGenerating(true);

    try {
      const sizeCm = parseFloat(markerSizeCm) || 10;
      const dpi = 300; // Haute résolution pour impression
      const markerSizePx = Math.round(sizeCm * dpi / 2.54); // cm to pixels at 300 DPI
      const margin = Math.round(1 * dpi / 2.54); // 1cm margin
      const labelHeight = Math.round(0.8 * dpi / 2.54);

      let cols = 1, rows = 1;
      switch (layout) {
        case "single": cols = 1; rows = 1; break;
        case "grid-2x2": cols = 2; rows = 2; break;
        case "grid-3x3": cols = 3; rows = 3; break;
        case "grid-4x4": cols = 4; rows = 4; break;
        case "a4-sheet": cols = 3; rows = 4; break;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const canvasWidth = cols * (markerSizePx + margin) + margin;
      const canvasHeight = rows * (markerSizePx + margin + labelHeight) + margin + Math.round(1.5 * dpi / 2.54);

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Fond blanc
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Titre
      ctx.fillStyle = "#333";
      ctx.font = `bold ${Math.round(0.5 * dpi / 2.54)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`Markers ArUco 4x4_50 - ${markerSizeCm}cm × ${markerSizeCm}cm`, canvasWidth / 2, margin);

      const start = parseInt(startId) || 0;
      let markerId = start;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (markerId >= 50) break;

          const x = margin + col * (markerSizePx + margin);
          const y = margin + Math.round(0.7 * dpi / 2.54) + row * (markerSizePx + margin + labelHeight);

          const markerCanvas = generateMarkerImage(markerId, markerSizePx);

          if (markerCanvas) {
            // Bordure blanche (10% de la taille)
            const border = Math.round(markerSizePx * 0.1);
            ctx.fillStyle = "white";
            ctx.fillRect(x - border, y - border, markerSizePx + border * 2, markerSizePx + border * 2);

            ctx.drawImage(markerCanvas, x, y);

            // Cadre léger
            ctx.strokeStyle = "#ccc";
            ctx.lineWidth = 2;
            ctx.strokeRect(x - border, y - border, markerSizePx + border * 2, markerSizePx + border * 2);
          }

          // Label
          ctx.fillStyle = "#666";
          ctx.font = `${Math.round(0.35 * dpi / 2.54)}px monospace`;
          ctx.textAlign = "center";
          ctx.fillText(`ID: ${markerId}`, x + markerSizePx / 2, y + markerSizePx + Math.round(0.5 * dpi / 2.54));

          markerId++;
        }
      }

      // Note
      ctx.fillStyle = "#999";
      ctx.font = `${Math.round(0.3 * dpi / 2.54)}px sans-serif`;
      ctx.fillText(
        `Imprimer à 100% sans mise à l'échelle | ${dpi} DPI`,
        canvasWidth / 2,
        canvasHeight - Math.round(0.3 * dpi / 2.54)
      );

      // Télécharger
      const link = document.createElement("a");
      link.download = `aruco_markers_${layout}_${sizeCm}cm.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast.success("Markers téléchargés ! Imprimez à 100% sans mise à l'échelle.");
    } catch (err) {
      console.error("Erreur download:", err);
      toast.error("Erreur lors de la génération");
    } finally {
      setIsGenerating(false);
    }
  }, [isLoaded, layout, startId, markerSizeCm, generateMarkerImage]);

  // Calculer le nombre de markers selon le layout
  const getMarkerCount = () => {
    switch (layout) {
      case "single": return 1;
      case "grid-2x2": return 4;
      case "grid-3x3": return 9;
      case "grid-4x4": return 16;
      case "a4-sheet": return 12;
      default: return 1;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Générateur de markers ArUco
          </DialogTitle>
          <DialogDescription>
            Créez des markers à imprimer pour calibrer automatiquement vos photos
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

          {/* Paramètres */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="markerSize" className="text-sm">
                Taille (cm)
              </Label>
              <Input
                id="markerSize"
                type="number"
                value={markerSizeCm}
                onChange={(e) => setMarkerSizeCm(e.target.value)}
                min="1"
                max="50"
                step="0.5"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="startId" className="text-sm">
                Premier ID
              </Label>
              <Input
                id="startId"
                type="number"
                value={startId}
                onChange={(e) => setStartId(e.target.value)}
                min="0"
                max="49"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm">Disposition</Label>
              <Select value={layout} onValueChange={(v) => setLayout(v as MarkerLayout)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">1 marker</SelectItem>
                  <SelectItem value="grid-2x2">Grille 2×2 (4)</SelectItem>
                  <SelectItem value="grid-3x3">Grille 3×3 (9)</SelectItem>
                  <SelectItem value="grid-4x4">Grille 4×4 (16)</SelectItem>
                  <SelectItem value="a4-sheet">Feuille A4 (12)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div className="border rounded-lg p-4 bg-white flex justify-center items-center min-h-[250px]">
            {isGenerating ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Génération...
              </div>
            ) : !isLoaded ? (
              <div className="text-muted-foreground text-center">
                <Grid3X3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>OpenCV.js en cours de chargement...</p>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-[300px] object-contain"
              />
            )}
          </div>

          {/* Info */}
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            <p className="font-medium mb-1">Instructions :</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Téléchargez les markers (PNG haute résolution)</li>
              <li>Imprimez à <strong>100%</strong> sans mise à l'échelle</li>
              <li>Découpez et placez sur la surface à photographier</li>
              <li>La taille réelle ({markerSizeCm}cm) sera utilisée pour calculer l'échelle</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button
            onClick={handleDownloadPNG}
            disabled={!isLoaded || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Télécharger PNG ({getMarkerCount()} markers)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ArucoMarkerGenerator;
