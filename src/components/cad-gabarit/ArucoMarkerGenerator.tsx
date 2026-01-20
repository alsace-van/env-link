// ============================================
// COMPONENT: ArucoMarkerGenerator
// Génère et télécharge des markers ArUco (PDF multi-pages)
// VERSION: 1.4 - Multi-pages avec ID début/fin
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
import { QrCode, Loader2, AlertTriangle, FileDown } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

interface ArucoMarkerGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

// Dimensions A4 en mm
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 10;
const GAP_MM = 8; // Augmenté pour plus d'espace

// ============================================
// Dictionnaire ArUco DICT_4X4_50
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

  const [markerSizeMm, setMarkerSizeMm] = useState<string>("50");
  const [startId, setStartId] = useState<string>("0");
  const [endId, setEndId] = useState<string>("49");
  const [isGenerating, setIsGenerating] = useState(false);

  // Calculer la grille et le nombre de pages
  const gridInfo = useMemo(() => {
    const size = parseFloat(markerSizeMm) || 50;
    const usableWidth = A4_WIDTH_MM - 2 * MARGIN_MM;
    const usableHeight = A4_HEIGHT_MM - 2 * MARGIN_MM - 20; // Espace titre + footer

    // Espace fixe pour le label (ne dépend pas de la taille du marker)
    const labelHeight = 12; // mm fixe
    const cellHeight = size + labelHeight + 3; // +3mm de marge supplémentaire
    const cellWidth = size + GAP_MM;

    const cols = Math.max(1, Math.floor((usableWidth + GAP_MM) / cellWidth));
    const rows = Math.max(1, Math.floor((usableHeight + GAP_MM) / cellHeight));

    const markersPerPage = cols * rows;
    const tooLarge = size > Math.min(usableWidth, usableHeight - 20);

    const start = Math.max(0, Math.min(49, parseInt(startId) || 0));
    const end = Math.max(start, Math.min(49, parseInt(endId) || 49));
    const totalMarkers = end - start + 1;
    const totalPages = Math.ceil(totalMarkers / markersPerPage);

    return { cols, rows, markersPerPage, tooLarge, size, start, end, totalMarkers, totalPages, labelHeight };
  }, [markerSizeMm, startId, endId]);

  // Dessiner un marker sur canvas (preview)
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

  // Dessiner un marker dans le PDF
  const drawMarkerPDF = useCallback((pdf: jsPDF, id: number, x: number, y: number, size: number) => {
    if (id < 0 || id >= 50) return;

    const pattern = ARUCO_DICT_4X4_50[id];
    const cellSize = size / 6;

    pdf.setFillColor(0, 0, 0);
    pdf.rect(x, y, size, size, "F");

    pdf.setFillColor(255, 255, 255);
    pdf.rect(x + cellSize, y + cellSize, cellSize * 4, cellSize * 4, "F");

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
  }, []);

  // Générer la preview
  const generatePreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

    const { cols, rows, size, tooLarge, start, totalPages, labelHeight } = gridInfo;

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
    const labelHeightPx = labelHeight * scale;

    // Titre
    ctx.fillStyle = "#333";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`ArUco 4x4_50 - ${size}mm - Page 1/${totalPages}`, canvasWidth / 2, marginPx * 0.8);

    let markerId = start;

    const cellWidth = markerSizePx + gapPx;
    const cellHeight = markerSizePx + labelHeightPx;
    const totalGridWidth = cols * cellWidth - gapPx;
    const totalGridHeight = rows * cellHeight - gapPx;
    const offsetX = (canvasWidth - totalGridWidth) / 2;
    const offsetY = marginPx + 5 + (canvasHeight - marginPx * 2 - 15 - totalGridHeight) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (markerId > gridInfo.end) break;

        const mx = offsetX + col * cellWidth;
        const my = offsetY + row * cellHeight;

        drawMarkerCanvas(ctx, markerId, mx, my, markerSizePx);

        // Label SOUS le marker - taille FIXE (ne grandit pas avec le marker)
        ctx.fillStyle = "#333";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`ID: ${markerId}`, mx + markerSizePx / 2, my + markerSizePx + 12);

        markerId++;
      }
    }

    // Règle de 5cm en bas
    const rulerY = canvasHeight - marginPx * 0.5;
    const rulerWidth = 50 * scale;
    const rulerX = (canvasWidth - rulerWidth) / 2;

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rulerX, rulerY - 2);
    ctx.lineTo(rulerX, rulerY + 2);
    ctx.moveTo(rulerX, rulerY);
    ctx.lineTo(rulerX + rulerWidth, rulerY);
    ctx.moveTo(rulerX + rulerWidth, rulerY - 2);
    ctx.lineTo(rulerX + rulerWidth, rulerY + 2);
    ctx.stroke();

    ctx.fillStyle = "#666";
    ctx.font = "7px sans-serif";
    ctx.fillText("← 5cm →", canvasWidth / 2, rulerY - 4);
  }, [gridInfo, drawMarkerCanvas]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => generatePreview(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, generatePreview]);

  // Générer le PDF multi-pages
  const handleDownloadPDF = useCallback(() => {
    setIsGenerating(true);

    try {
      const { cols, rows, size, tooLarge, start, end, markersPerPage, totalPages, labelHeight } = gridInfo;

      if (tooLarge) {
        toast.error("La taille du marker est trop grande pour A4");
        setIsGenerating(false);
        return;
      }

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      let markerId = start;
      let currentPage = 1;

      while (markerId <= end) {
        if (currentPage > 1) {
          pdf.addPage();
        }

        // Calculer les IDs de cette page
        const pageStartId = markerId;
        const pageEndId = Math.min(end, markerId + markersPerPage - 1);

        // Titre avec numéros de page et IDs
        pdf.setFontSize(12);
        pdf.setTextColor(51, 51, 51);
        pdf.text(
          `Markers ArUco 4x4_50 - ${size}mm × ${size}mm - IDs ${pageStartId}-${pageEndId} (Page ${currentPage}/${totalPages})`,
          A4_WIDTH_MM / 2,
          MARGIN_MM,
          { align: "center" },
        );

        // Calculer la grille centrée
        const cellWidth = size + GAP_MM;
        const cellHeight = size + labelHeight;
        const totalGridWidth = cols * cellWidth - GAP_MM;
        const totalGridHeight = rows * cellHeight - GAP_MM;
        const offsetX = (A4_WIDTH_MM - totalGridWidth) / 2;
        const offsetY = MARGIN_MM + 8 + (A4_HEIGHT_MM - MARGIN_MM * 2 - 25 - totalGridHeight) / 2;

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            if (markerId > end) break;

            const mx = offsetX + col * cellWidth;
            const my = offsetY + row * cellHeight;

            drawMarkerPDF(pdf, markerId, mx, my, size);

            // Label sous le marker - taille FIXE 10pt (ne grandit pas avec le marker)
            pdf.setFontSize(10);
            pdf.setTextColor(51, 51, 51);
            pdf.text(`ID: ${markerId}`, mx + size / 2, my + size + 8, { align: "center" });

            markerId++;
          }
        }

        // Règle de 5cm en bas
        const rulerY = A4_HEIGHT_MM - MARGIN_MM;
        const rulerWidth = 50;
        const rulerX = (A4_WIDTH_MM - rulerWidth) / 2;

        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.3);
        pdf.line(rulerX, rulerY, rulerX + rulerWidth, rulerY);
        pdf.line(rulerX, rulerY - 2, rulerX, rulerY + 2);
        pdf.line(rulerX + rulerWidth, rulerY - 2, rulerX + rulerWidth, rulerY + 2);
        for (let i = 10; i < rulerWidth; i += 10) {
          pdf.line(rulerX + i, rulerY - 1, rulerX + i, rulerY + 1);
        }

        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.text("← 5cm (vérifiez l'échelle) →", A4_WIDTH_MM / 2, rulerY - 3, { align: "center" });

        currentPage++;
      }

      // Nom du fichier avec la plage d'IDs
      pdf.save(`aruco_${size}mm_ID${start}-${end}_${totalPages}pages.pdf`);

      toast.success(`${gridInfo.totalMarkers} markers sur ${totalPages} page(s) !`);
    } catch (err) {
      console.error("Erreur PDF:", err);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setIsGenerating(false);
    }
  }, [gridInfo, drawMarkerPDF]);

  const sizeCm = (parseFloat(markerSizeMm) || 50) / 10;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Générateur de markers ArUco
          </DialogTitle>
          <DialogDescription>Génère un PDF A4 multi-pages avec les markers sélectionnés</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Paramètres */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="markerSize" className="text-sm">
                Taille (mm)
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
              <p className="text-xs text-muted-foreground mt-1">= {sizeCm}cm</p>
            </div>

            <div>
              <Label htmlFor="startId" className="text-sm">
                ID début
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
              <Label htmlFor="endId" className="text-sm">
                ID fin
              </Label>
              <Input
                id="endId"
                type="number"
                value={endId}
                onChange={(e) => setEndId(e.target.value)}
                min="0"
                max="49"
                className="mt-1"
              />
            </div>
          </div>

          {/* Résumé */}
          <div className="text-sm bg-muted p-2 rounded flex justify-between items-center">
            {gridInfo.tooLarge ? (
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Marker trop grand pour A4
              </span>
            ) : (
              <>
                <span>
                  <strong>{gridInfo.totalMarkers}</strong> markers (ID {gridInfo.start} → {gridInfo.end})
                </span>
                <span className="text-muted-foreground">
                  {gridInfo.markersPerPage}/page × <strong>{gridInfo.totalPages} page(s)</strong>
                </span>
              </>
            )}
          </div>

          {/* Preview */}
          <div className="border rounded-lg p-2 bg-gray-100 flex justify-center">
            <canvas ref={canvasRef} className="shadow-md bg-white" style={{ maxHeight: "280px", width: "auto" }} />
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded-lg">
            <ol className="list-decimal list-inside space-y-0.5">
              <li>
                Téléchargez le PDF ({gridInfo.totalPages} page{gridInfo.totalPages > 1 ? "s" : ""})
              </li>
              <li>
                Imprimez à <strong>100%</strong> - vérifiez la règle de 5cm
              </li>
              <li>Découpez et placez les markers sur la surface</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={handleDownloadPDF} disabled={isGenerating || gridInfo.tooLarge}>
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
            PDF ({gridInfo.totalMarkers} markers, {gridInfo.totalPages} page{gridInfo.totalPages > 1 ? "s" : ""})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ArucoMarkerGenerator;
