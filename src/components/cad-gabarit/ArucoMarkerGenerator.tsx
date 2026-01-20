// ============================================
// COMPONENT: ArucoMarkerGenerator
// Génère et télécharge des markers ArUco (PDF)
// VERSION: 1.3 - Export PDF pour impression à taille réelle
// ============================================

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
import { QrCode, Download, Loader2, AlertTriangle, FileDown } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

interface ArucoMarkerGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

// Dimensions A4 en mm
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 10; // Marge autour de la page
const GAP_MM = 5; // Espace entre markers

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

  const [markerSizeMm, setMarkerSizeMm] = useState<string>("50"); // en mm maintenant
  const [startId, setStartId] = useState<string>("0");
  const [isGenerating, setIsGenerating] = useState(false);

  // Calculer combien de markers tiennent sur une feuille A4
  const gridInfo = useMemo(() => {
    const size = parseFloat(markerSizeMm) || 50;
    const usableWidth = A4_WIDTH_MM - 2 * MARGIN_MM;
    const usableHeight = A4_HEIGHT_MM - 2 * MARGIN_MM - 15; // -15mm pour titre et footer

    // Combien de markers par ligne/colonne (avec espacement)
    const cols = Math.max(1, Math.floor((usableWidth + GAP_MM) / (size + GAP_MM)));
    const rows = Math.max(1, Math.floor((usableHeight + GAP_MM) / (size + GAP_MM + 8))); // +8mm pour le label

    const total = cols * rows;
    const tooLarge = size > Math.min(usableWidth, usableHeight - 10);

    return { cols, rows, total, tooLarge, size };
  }, [markerSizeMm]);

  // Générer un marker ArUco sur canvas (pour preview)
  const drawMarkerCanvas = useCallback(
    (ctx: CanvasRenderingContext2D, id: number, x: number, y: number, size: number) => {
      if (id < 0 || id >= 50) return;

      const pattern = ARUCO_DICT_4X4_50[id];
      const cellSize = size / 6;

      ctx.fillStyle = "black";
      ctx.fillRect(x, y, size, size);

      ctx.fillStyle = "white";
      ctx.fillRect(x + cellSize, y + cellSize, cellSize * 4, cellSize * 4);

      ctx.fillStyle = "black";
      for (let row = 0; row < 4; row++) {
        const rowData = pattern[row];
        for (let col = 0; col < 4; col++) {
          const bit = (rowData >> (3 - col)) & 1;
          if (bit === 1) {
            ctx.fillRect(x + cellSize * (col + 1), y + cellSize * (row + 1), cellSize, cellSize);
          }
        }
      }
    },
    [],
  );

  // Dessiner un marker ArUco dans un PDF (jsPDF)
  const drawMarkerPDF = useCallback(
    (
      pdf: jsPDF,
      id: number,
      x: number, // en mm
      y: number, // en mm
      size: number, // en mm
    ) => {
      if (id < 0 || id >= 50) return;

      const pattern = ARUCO_DICT_4X4_50[id];
      const cellSize = size / 6;

      // Bordure noire extérieure
      pdf.setFillColor(0, 0, 0);
      pdf.rect(x, y, size, size, "F");

      // Intérieur blanc
      pdf.setFillColor(255, 255, 255);
      pdf.rect(x + cellSize, y + cellSize, cellSize * 4, cellSize * 4, "F");

      // Dessiner les bits noirs
      pdf.setFillColor(0, 0, 0);
      for (let row = 0; row < 4; row++) {
        const rowData = pattern[row];
        for (let col = 0; col < 4; col++) {
          const bit = (rowData >> (3 - col)) & 1;
          if (bit === 1) {
            pdf.rect(x + cellSize * (col + 1), y + cellSize * (row + 1), cellSize, cellSize, "F");
          }
        }
      }
    },
    [],
  );

  // Générer la prévisualisation (proportionnelle à A4)
  const generatePreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Preview: 1mm = 1.2px
    const scale = 1.2;
    const canvasWidth = Math.round(A4_WIDTH_MM * scale);
    const canvasHeight = Math.round(A4_HEIGHT_MM * scale);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, canvasWidth - 1, canvasHeight - 1);

    const { cols, rows, size, tooLarge } = gridInfo;

    if (tooLarge) {
      ctx.fillStyle = "#999";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Marker trop grand pour A4", canvasWidth / 2, canvasHeight / 2);
      return;
    }

    const markerSizePx = size * scale;
    const marginPx = MARGIN_MM * scale;
    const gapPx = GAP_MM * scale;
    const labelHeightPx = 6 * scale;

    // Titre
    ctx.fillStyle = "#333";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`ArUco 4x4_50 - ${size}mm × ${size}mm`, canvasWidth / 2, marginPx * 0.7);

    const start = Math.min(49, Math.max(0, parseInt(startId) || 0));
    let markerId = start;

    const totalGridWidth = cols * markerSizePx + (cols - 1) * gapPx;
    const totalGridHeight = rows * (markerSizePx + labelHeightPx) + (rows - 1) * gapPx;
    const offsetX = (canvasWidth - totalGridWidth) / 2;
    const offsetY = marginPx + (canvasHeight - marginPx * 2 - totalGridHeight) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (markerId >= 50) break;

        const mx = offsetX + col * (markerSizePx + gapPx);
        const my = offsetY + row * (markerSizePx + gapPx + labelHeightPx);

        drawMarkerCanvas(ctx, markerId, mx, my, markerSizePx);

        ctx.fillStyle = "#666";
        ctx.font = `${Math.max(7, markerSizePx * 0.1)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(`ID: ${markerId}`, mx + markerSizePx / 2, my + markerSizePx + labelHeightPx * 0.8);

        markerId++;
      }
    }

    // Règle de référence (5cm)
    const rulerY = canvasHeight - marginPx * 0.6;
    const rulerWidth = 50 * scale; // 50mm = 5cm
    const rulerX = (canvasWidth - rulerWidth) / 2;

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rulerX, rulerY - 3);
    ctx.lineTo(rulerX, rulerY + 3);
    ctx.moveTo(rulerX, rulerY);
    ctx.lineTo(rulerX + rulerWidth, rulerY);
    ctx.moveTo(rulerX + rulerWidth, rulerY - 3);
    ctx.lineTo(rulerX + rulerWidth, rulerY + 3);
    ctx.stroke();

    ctx.fillStyle = "#333";
    ctx.font = "8px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("← 5cm →", canvasWidth / 2, rulerY - 5);
  }, [gridInfo, startId, drawMarkerCanvas]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => generatePreview(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, generatePreview]);

  // Télécharger en PDF (taille réelle garantie)
  const handleDownloadPDF = useCallback(() => {
    setIsGenerating(true);

    try {
      const { cols, rows, size, tooLarge } = gridInfo;

      if (tooLarge) {
        toast.error("La taille du marker est trop grande pour une feuille A4");
        setIsGenerating(false);
        return;
      }

      // Créer le PDF en format A4 portrait
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const labelHeight = 8; // mm

      // Titre
      pdf.setFontSize(14);
      pdf.setTextColor(51, 51, 51);
      pdf.text(`Markers ArUco 4x4_50 - ${size}mm × ${size}mm`, A4_WIDTH_MM / 2, MARGIN_MM, { align: "center" });

      const start = Math.min(49, Math.max(0, parseInt(startId) || 0));
      let markerId = start;

      // Centrer la grille
      const totalGridWidth = cols * size + (cols - 1) * GAP_MM;
      const totalGridHeight = rows * (size + labelHeight) + (rows - 1) * GAP_MM;
      const offsetX = (A4_WIDTH_MM - totalGridWidth) / 2;
      const offsetY = MARGIN_MM + 8 + (A4_HEIGHT_MM - MARGIN_MM * 2 - 20 - totalGridHeight) / 2;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (markerId >= 50) break;

          const mx = offsetX + col * (size + GAP_MM);
          const my = offsetY + row * (size + GAP_MM + labelHeight);

          // Dessiner le marker
          drawMarkerPDF(pdf, markerId, mx, my, size);

          // Label
          pdf.setFontSize(Math.max(6, size * 0.12));
          pdf.setTextColor(100, 100, 100);
          pdf.text(`ID: ${markerId}`, mx + size / 2, my + size + labelHeight * 0.7, { align: "center" });

          markerId++;
        }
      }

      // Règle de référence (5cm) en bas
      const rulerY = A4_HEIGHT_MM - MARGIN_MM;
      const rulerWidth = 50; // 50mm = 5cm
      const rulerX = (A4_WIDTH_MM - rulerWidth) / 2;

      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.3);

      // Ligne horizontale
      pdf.line(rulerX, rulerY, rulerX + rulerWidth, rulerY);
      // Ticks
      pdf.line(rulerX, rulerY - 2, rulerX, rulerY + 2);
      pdf.line(rulerX + rulerWidth, rulerY - 2, rulerX + rulerWidth, rulerY + 2);
      // Ticks intermédiaires (chaque cm)
      for (let i = 10; i < rulerWidth; i += 10) {
        pdf.line(rulerX + i, rulerY - 1, rulerX + i, rulerY + 1);
      }

      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      pdf.text("← 5cm (vérifiez l'échelle d'impression) →", A4_WIDTH_MM / 2, rulerY - 3, { align: "center" });

      // Télécharger
      pdf.save(`aruco_markers_${size}mm_x${gridInfo.total}.pdf`);

      toast.success(`${gridInfo.total} markers générés ! Imprimez le PDF à 100%.`);
    } catch (err) {
      console.error("Erreur PDF:", err);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setIsGenerating(false);
    }
  }, [gridInfo, startId, drawMarkerPDF]);

  const sizeCm = (parseFloat(markerSizeMm) || 50) / 10;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Générateur de markers ArUco
          </DialogTitle>
          <DialogDescription>Génère un PDF A4 de markers à imprimer pour calibrer vos photos</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Paramètres */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="markerSize" className="text-sm">
                Taille du marker (mm)
              </Label>
              <Input
                id="markerSize"
                type="number"
                value={markerSizeMm}
                onChange={(e) => setMarkerSizeMm(e.target.value)}
                min="10"
                max="180"
                step="5"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {gridInfo.tooLarge ? (
                  <span className="text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Trop grand pour A4
                  </span>
                ) : (
                  <>
                    = {sizeCm}cm → {gridInfo.cols}×{gridInfo.rows} = <strong>{gridInfo.total} markers</strong>
                  </>
                )}
              </p>
            </div>

            <div>
              <Label htmlFor="startId" className="text-sm">
                Premier ID (0-49)
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
              <p className="text-xs text-muted-foreground mt-1">
                IDs: {parseInt(startId) || 0} → {Math.min(49, (parseInt(startId) || 0) + gridInfo.total - 1)}
              </p>
            </div>
          </div>

          {/* Preview A4 */}
          <div className="border rounded-lg p-3 bg-gray-100 flex justify-center">
            <canvas ref={canvasRef} className="shadow-md bg-white" style={{ maxHeight: "320px", width: "auto" }} />
          </div>

          {/* Instructions */}
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            <p className="font-medium mb-1">Instructions :</p>
            <ol className="list-decimal list-inside space-y-0.5 text-xs">
              <li>
                Téléchargez le <strong>PDF</strong> (format A4, taille réelle)
              </li>
              <li>
                Imprimez à <strong>100%</strong> - vérifiez avec la règle de 5cm en bas
              </li>
              <li>Découpez et placez les markers sur la surface à photographier</li>
              <li>Importez la photo avec "Image avec markers ArUco"</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={handleDownloadPDF} disabled={isGenerating || gridInfo.tooLarge}>
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
            Télécharger PDF ({gridInfo.total} markers)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ArucoMarkerGenerator;
