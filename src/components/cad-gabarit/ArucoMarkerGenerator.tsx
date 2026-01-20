// ============================================
// COMPONENT: ArucoMarkerGenerator
// Génère et télécharge des markers ArUco (PNG)
// VERSION: 1.1 - Génération native sans OpenCV
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
import { QrCode, Download, Loader2, Grid3X3 } from "lucide-react";
import { toast } from "sonner";

interface ArucoMarkerGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

type MarkerLayout = "single" | "grid-2x2" | "grid-3x3" | "grid-4x4" | "a4-sheet";

// ============================================
// Dictionnaire ArUco DICT_4X4_50
// Chaque marker est une matrice 4x4 de bits
// Source: OpenCV ArUco module
// ============================================
const ARUCO_DICT_4X4_50: number[][] = [
  [0b0111, 0b1001, 0b0010, 0b1111], // ID 0
  [0b1010, 0b0011, 0b0111, 0b0100], // ID 1
  [0b1000, 0b1100, 0b0011, 0b1111], // ID 2
  [0b0010, 0b1101, 0b1000, 0b0110], // ID 3
  [0b0010, 0b0110, 0b1110, 0b0001], // ID 4
  [0b0010, 0b1111, 0b1100, 0b1100], // ID 5
  [0b1100, 0b1100, 0b1011, 0b0001], // ID 6
  [0b1101, 0b0010, 0b1100, 0b0111], // ID 7
  [0b0111, 0b0001, 0b1110, 0b0011], // ID 8
  [0b1011, 0b1011, 0b0100, 0b0110], // ID 9
  [0b0001, 0b0100, 0b0101, 0b1110], // ID 10
  [0b1010, 0b0100, 0b1100, 0b1001], // ID 11
  [0b0111, 0b1111, 0b0100, 0b0001], // ID 12
  [0b1100, 0b0101, 0b0001, 0b1110], // ID 13
  [0b0101, 0b0110, 0b0001, 0b0111], // ID 14
  [0b0110, 0b1010, 0b0011, 0b0010], // ID 15
  [0b1110, 0b0101, 0b1100, 0b0101], // ID 16
  [0b0100, 0b0100, 0b1111, 0b1011], // ID 17
  [0b1001, 0b0010, 0b0001, 0b0101], // ID 18
  [0b0001, 0b1011, 0b0010, 0b0011], // ID 19
  [0b1111, 0b1100, 0b1111, 0b0100], // ID 20
  [0b1010, 0b1111, 0b1001, 0b0010], // ID 21
  [0b0011, 0b0111, 0b1010, 0b1001], // ID 22
  [0b1000, 0b1101, 0b1111, 0b0011], // ID 23
  [0b1011, 0b0111, 0b1011, 0b0011], // ID 24
  [0b0000, 0b0100, 0b0010, 0b1000], // ID 25
  [0b1100, 0b0011, 0b1101, 0b1101], // ID 26
  [0b1110, 0b1001, 0b1010, 0b0001], // ID 27
  [0b1111, 0b0110, 0b1101, 0b1010], // ID 28
  [0b1101, 0b1001, 0b1001, 0b1111], // ID 29
  [0b0101, 0b1000, 0b0110, 0b1001], // ID 30
  [0b0011, 0b1110, 0b1110, 0b0110], // ID 31
  [0b0110, 0b0000, 0b1011, 0b1110], // ID 32
  [0b0101, 0b0001, 0b0100, 0b0000], // ID 33
  [0b1001, 0b1111, 0b0110, 0b0000], // ID 34
  [0b1001, 0b0110, 0b0000, 0b0111], // ID 35
  [0b0100, 0b1110, 0b1000, 0b0100], // ID 36
  [0b0000, 0b1001, 0b1100, 0b1110], // ID 37
  [0b1110, 0b0000, 0b0110, 0b1100], // ID 38
  [0b1100, 0b1000, 0b0101, 0b0110], // ID 39
  [0b1010, 0b1000, 0b1110, 0b1111], // ID 40
  [0b0100, 0b0010, 0b1010, 0b0110], // ID 41
  [0b1001, 0b1000, 0b1000, 0b1000], // ID 42
  [0b0110, 0b0101, 0b1111, 0b0000], // ID 43
  [0b0100, 0b1011, 0b0110, 0b1101], // ID 44
  [0b0000, 0b0000, 0b0100, 0b0101], // ID 45
  [0b1000, 0b0111, 0b0111, 0b1001], // ID 46
  [0b0011, 0b0010, 0b1000, 0b1100], // ID 47
  [0b1011, 0b0000, 0b0001, 0b1010], // ID 48
  [0b0001, 0b0111, 0b1101, 0b1000], // ID 49
];

export function ArucoMarkerGenerator({ isOpen, onClose }: ArucoMarkerGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [markerSizeCm, setMarkerSizeCm] = useState<string>("10");
  const [startId, setStartId] = useState<string>("1");
  const [layout, setLayout] = useState<MarkerLayout>("grid-3x3");
  const [isGenerating, setIsGenerating] = useState(false);

  // Générer un marker ArUco (natif)
  const drawMarker = useCallback((
    ctx: CanvasRenderingContext2D,
    id: number,
    x: number,
    y: number,
    size: number
  ) => {
    if (id < 0 || id >= 50) return;

    const pattern = ARUCO_DICT_4X4_50[id];
    const cellSize = size / 6; // 6x6: 1 bordure + 4 data + 1 bordure

    // Bordure noire extérieure (obligatoire pour ArUco)
    ctx.fillStyle = "black";
    ctx.fillRect(x, y, size, size);

    // Intérieur blanc puis les données
    ctx.fillStyle = "white";
    ctx.fillRect(x + cellSize, y + cellSize, cellSize * 4, cellSize * 4);

    // Dessiner les 4x4 bits de données
    ctx.fillStyle = "black";
    for (let row = 0; row < 4; row++) {
      const rowData = pattern[row];
      for (let col = 0; col < 4; col++) {
        // Bit de droite à gauche (MSB à gauche)
        const bit = (rowData >> (3 - col)) & 1;
        if (bit === 1) {
          ctx.fillRect(
            x + cellSize * (col + 1),
            y + cellSize * (row + 1),
            cellSize,
            cellSize
          );
        }
      }
    }
  }, []);

  // Générer la prévisualisation
  const generatePreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const markerSizePx = 80; // Taille preview
    const margin = 30;
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
    const canvasHeight = rows * (markerSizePx + margin + labelHeight) + margin + 50;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Fond blanc
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Titre
    ctx.fillStyle = "#333";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Markers ArUco 4x4_50 - ${markerSizeCm}cm × ${markerSizeCm}cm`, canvasWidth / 2, 22);

    const start = parseInt(startId) || 0;
    let markerId = start;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (markerId >= 50) break;

        const mx = margin + col * (markerSizePx + margin);
        const my = 40 + row * (markerSizePx + margin + labelHeight);

        // Zone blanche autour du marker (quiet zone)
        const quietZone = 8;
        ctx.fillStyle = "white";
        ctx.fillRect(mx - quietZone, my - quietZone, markerSizePx + quietZone * 2, markerSizePx + quietZone * 2);

        // Dessiner le marker
        drawMarker(ctx, markerId, mx, my, markerSizePx);

        // Label
        ctx.fillStyle = "#666";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`ID: ${markerId}`, mx + markerSizePx / 2, my + markerSizePx + 18);

        markerId++;
      }
    }

    // Note en bas
    ctx.fillStyle = "#999";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `Imprimer à 100% sans mise à l'échelle | 300 DPI`,
      canvasWidth / 2,
      canvasHeight - 10
    );
  }, [layout, startId, markerSizeCm, drawMarker]);

  // Générer la préview quand les paramètres changent
  useEffect(() => {
    if (isOpen) {
      // Petit délai pour s'assurer que le canvas est monté
      const timer = setTimeout(() => generatePreview(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, layout, startId, markerSizeCm, generatePreview]);

  // Télécharger en PNG haute résolution
  const handleDownloadPNG = useCallback(() => {
    setIsGenerating(true);

    try {
      const sizeCm = parseFloat(markerSizeCm) || 10;
      const dpi = 300;
      const markerSizePx = Math.round(sizeCm * dpi / 2.54);
      const margin = Math.round(1.5 * dpi / 2.54); // 1.5cm margin
      const labelHeight = Math.round(1 * dpi / 2.54);

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
      if (!ctx) {
        toast.error("Erreur: impossible de créer le canvas");
        return;
      }

      const canvasWidth = cols * (markerSizePx + margin) + margin;
      const canvasHeight = rows * (markerSizePx + margin + labelHeight) + margin + Math.round(2 * dpi / 2.54);

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

          const mx = margin + col * (markerSizePx + margin);
          const my = margin + Math.round(0.8 * dpi / 2.54) + row * (markerSizePx + margin + labelHeight);

          // Quiet zone blanche (10% de la taille)
          const quietZone = Math.round(markerSizePx * 0.12);
          ctx.fillStyle = "white";
          ctx.fillRect(mx - quietZone, my - quietZone, markerSizePx + quietZone * 2, markerSizePx + quietZone * 2);

          // Dessiner le marker
          drawMarker(ctx, markerId, mx, my, markerSizePx);

          // Label
          ctx.fillStyle = "#666";
          ctx.font = `${Math.round(0.4 * dpi / 2.54)}px monospace`;
          ctx.textAlign = "center";
          ctx.fillText(`ID: ${markerId}`, mx + markerSizePx / 2, my + markerSizePx + Math.round(0.6 * dpi / 2.54));

          markerId++;
        }
      }

      // Note en bas
      ctx.fillStyle = "#888";
      ctx.font = `${Math.round(0.35 * dpi / 2.54)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        `Imprimer à 100% sans mise à l'échelle | ${dpi} DPI`,
        canvasWidth / 2,
        canvasHeight - Math.round(0.5 * dpi / 2.54)
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
  }, [layout, startId, markerSizeCm, drawMarker]);

  // Calculer le nombre de markers
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
          <div className="border rounded-lg p-4 bg-gray-50 flex justify-center items-center min-h-[300px]">
            {isGenerating ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Génération...
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-[350px] object-contain bg-white shadow-sm rounded"
              />
            )}
          </div>

          {/* Info */}
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            <p className="font-medium mb-1">Instructions :</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Téléchargez les markers (PNG haute résolution 300 DPI)</li>
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
          <Button onClick={handleDownloadPNG} disabled={isGenerating}>
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
