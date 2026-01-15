// ============================================
// COMPOSANT: PrintPreviewModal
// Modale d'impression avec prévisualisation et duplication de motifs
// VERSION: 80.16 - Correction capture sans règles + option cadre
// ============================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Printer, Maximize2, Grid3X3, Scissors, Move, Square } from "lucide-react";

// Types pour les options d'impression
interface PrintOptions {
  format: "A4" | "A3" | "Letter" | "Legal";
  orientation: "portrait" | "landscape";
  margins: number; // mm
  enableDuplication: boolean;
  columns: number;
  rows: number;
  spacing: number; // mm
  includeGrid: boolean;
  includeDimensions: boolean;
  includeCutMarks: boolean;
  includeBorder: boolean; // MOD v80.16: Option pour afficher le cadre du motif
  printZone: "all" | "visible" | "selection";
  scale: "fit" | "100" | "custom";
  customScale: number; // pourcentage
}

// Dimensions des formats papier en mm
const PAPER_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
};

// MOD v80.16: Taille des règles en pixels (à exclure de la capture)
const RULER_SIZE = 40; // pixels

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  // Taille du contenu en mm (pour calcul de duplication)
  contentWidth: number;
  contentHeight: number;
  // Options de rendu
  showGrid: boolean;
  showDimensions: boolean;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  canvasRef,
  contentWidth,
  contentHeight,
  showGrid,
  showDimensions,
}) => {
  // État de la modale (position pour drag)
  const [position, setPosition] = useState({ x: 100, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Options d'impression
  const [options, setOptions] = useState<PrintOptions>({
    format: "A4",
    orientation: "landscape",
    margins: 10,
    enableDuplication: false,
    columns: 1,
    rows: 1,
    spacing: 5,
    includeGrid: showGrid,
    includeDimensions: showDimensions,
    includeCutMarks: false,
    includeBorder: true, // MOD v80.16: Cadre activé par défaut
    printZone: "visible",
    scale: "fit",
    customScale: 100,
  });

  // Calculer les dimensions de la page en mm
  const getPageDimensions = useCallback(() => {
    const paper = PAPER_SIZES[options.format];
    if (options.orientation === "landscape") {
      return { width: paper.height, height: paper.width };
    }
    return { width: paper.width, height: paper.height };
  }, [options.format, options.orientation]);

  // Calculer la zone imprimable (page - marges)
  const getPrintableArea = useCallback(() => {
    const page = getPageDimensions();
    return {
      width: page.width - options.margins * 2,
      height: page.height - options.margins * 2,
    };
  }, [getPageDimensions, options.margins]);

  // Calculer le nombre max de motifs qui tiennent sur la page
  const calculateMaxMotifs = useCallback(() => {
    const printable = getPrintableArea();
    const motifW = contentWidth > 0 ? contentWidth : 100;
    const motifH = contentHeight > 0 ? contentHeight : 100;

    const maxCols = Math.floor((printable.width + options.spacing) / (motifW + options.spacing));
    const maxRows = Math.floor((printable.height + options.spacing) / (motifH + options.spacing));

    return { maxCols: Math.max(1, maxCols), maxRows: Math.max(1, maxRows) };
  }, [getPrintableArea, contentWidth, contentHeight, options.spacing]);

  // Auto-remplir la page
  const autoFillPage = useCallback(() => {
    const { maxCols, maxRows } = calculateMaxMotifs();
    setOptions((prev) => ({
      ...prev,
      enableDuplication: true,
      columns: maxCols,
      rows: maxRows,
    }));
  }, [calculateMaxMotifs]);

  // MOD v80.16: Capturer le contenu du canvas SANS les règles
  const captureContentWithoutRulers = useCallback((): HTMLCanvasElement | null => {
    if (!canvasRef.current) return null;

    const sourceCanvas = canvasRef.current;
    const srcWidth = sourceCanvas.width;
    const srcHeight = sourceCanvas.height;

    // Créer un canvas temporaire pour le contenu sans règles
    const tempCanvas = document.createElement("canvas");
    const contentWidth = srcWidth - RULER_SIZE;
    const contentHeight = srcHeight - RULER_SIZE;

    if (contentWidth <= 0 || contentHeight <= 0) {
      // Si le canvas est trop petit, utiliser tout le canvas
      return sourceCanvas;
    }

    tempCanvas.width = contentWidth;
    tempCanvas.height = contentHeight;

    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return sourceCanvas;

    // Copier uniquement la partie sans les règles (règles en haut et à gauche)
    ctx.drawImage(
      sourceCanvas,
      RULER_SIZE, // sx: commencer après la règle gauche
      RULER_SIZE, // sy: commencer après la règle du haut
      contentWidth, // sWidth
      contentHeight, // sHeight
      0, // dx
      0, // dy
      contentWidth, // dWidth
      contentHeight, // dHeight
    );

    return tempCanvas;
  }, [canvasRef]);

  // Générer la prévisualisation
  const generatePreview = useCallback(() => {
    if (!previewCanvasRef.current || !canvasRef.current) return;

    const previewCanvas = previewCanvasRef.current;
    const ctx = previewCanvas.getContext("2d");
    if (!ctx) return;

    // Dimensions de la prévisualisation (scaled pour affichage)
    const page = getPageDimensions();
    const previewScale = 1.5; // pixels par mm pour l'affichage
    previewCanvas.width = page.width * previewScale;
    previewCanvas.height = page.height * previewScale;

    // Fond blanc (page)
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Bordure de page
    ctx.strokeStyle = "#CCCCCC";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Zone imprimable (marges) - ligne pointillée
    const marginPx = options.margins * previewScale;
    ctx.strokeStyle = "#E0E0E0";
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(marginPx, marginPx, previewCanvas.width - marginPx * 2, previewCanvas.height - marginPx * 2);
    ctx.setLineDash([]);

    // MOD v80.16: Capturer le canvas sans les règles
    const sourceCanvas = captureContentWithoutRulers();
    if (!sourceCanvas) return;

    // Calculer la taille du motif dans la préview
    const printable = getPrintableArea();
    const motifW = contentWidth > 0 ? contentWidth : 100;
    const motifH = contentHeight > 0 ? contentHeight : 100;

    // Calculer l'échelle du motif
    let motifScale = 1;
    if (options.scale === "fit") {
      const availableW = options.enableDuplication
        ? (printable.width - (options.columns - 1) * options.spacing) / options.columns
        : printable.width;
      const availableH = options.enableDuplication
        ? (printable.height - (options.rows - 1) * options.spacing) / options.rows
        : printable.height;
      const scaleX = availableW / motifW;
      const scaleY = availableH / motifH;
      motifScale = Math.min(scaleX, scaleY, 1);
    } else if (options.scale === "100") {
      motifScale = 1;
    } else {
      motifScale = options.customScale / 100;
    }

    const scaledMotifW = motifW * motifScale * previewScale;
    const scaledMotifH = motifH * motifScale * previewScale;

    // Nombre de répétitions
    const cols = options.enableDuplication ? options.columns : 1;
    const rows = options.enableDuplication ? options.rows : 1;
    const spacingPx = options.spacing * previewScale;

    // Calculer la position de départ pour centrer les motifs dans la zone imprimable
    const totalWidth = cols * scaledMotifW + (cols - 1) * spacingPx;
    const totalHeight = rows * scaledMotifH + (rows - 1) * spacingPx;
    const printableWidthPx = (previewCanvas.width - marginPx * 2);
    const printableHeightPx = (previewCanvas.height - marginPx * 2);
    const startX = marginPx + (printableWidthPx - totalWidth) / 2;
    const startY = marginPx + (printableHeightPx - totalHeight) / 2;

    // Dessiner les motifs
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * (scaledMotifW + spacingPx);
        const y = startY + row * (scaledMotifH + spacingPx);

        // Dessiner l'image du canvas (sans règles)
        ctx.drawImage(sourceCanvas, x, y, scaledMotifW, scaledMotifH);

        // MOD v80.16: Dessiner le cadre du motif si activé
        if (options.includeBorder) {
          ctx.strokeStyle = "#333333";
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.strokeRect(x, y, scaledMotifW, scaledMotifH);
        }

        // Traits de coupe si activés
        if (options.includeCutMarks && options.enableDuplication) {
          ctx.strokeStyle = "#999999";
          ctx.lineWidth = 0.5;
          ctx.setLineDash([2, 2]);

          // Trait vertical à droite (sauf dernière colonne)
          if (col < cols - 1) {
            const cutX = x + scaledMotifW + spacingPx / 2;
            ctx.beginPath();
            ctx.moveTo(cutX, y - 5);
            ctx.lineTo(cutX, y + scaledMotifH + 5);
            ctx.stroke();
          }

          // Trait horizontal en bas (sauf dernière ligne)
          if (row < rows - 1) {
            const cutY = y + scaledMotifH + spacingPx / 2;
            ctx.beginPath();
            ctx.moveTo(x - 5, cutY);
            ctx.lineTo(x + scaledMotifW + 5, cutY);
            ctx.stroke();
          }

          ctx.setLineDash([]);
        }
      }
    }

    // Ajouter info en bas
    ctx.fillStyle = "#666666";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    const infoText = options.enableDuplication
      ? `${cols} × ${rows} = ${cols * rows} motif(s) - ${options.format} ${options.orientation}`
      : `1 motif - ${options.format} ${options.orientation}`;
    ctx.fillText(infoText, previewCanvas.width / 2, previewCanvas.height - 5);
  }, [canvasRef, options, getPageDimensions, getPrintableArea, contentWidth, contentHeight, captureContentWithoutRulers]);

  // Mettre à jour la prévisualisation quand les options changent
  useEffect(() => {
    if (isOpen) {
      // Petit délai pour laisser le canvas se rendre
      const timer = setTimeout(generatePreview, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, options, generatePreview]);

  // Fonction d'impression
  const handlePrint = useCallback(() => {
    if (!canvasRef.current) return;

    const page = getPageDimensions();
    const printable = getPrintableArea();
    const motifW = contentWidth > 0 ? contentWidth : 100;
    const motifH = contentHeight > 0 ? contentHeight : 100;

    // Calculer l'échelle du motif
    let motifScale = 1;
    if (options.scale === "fit") {
      const availableW = options.enableDuplication
        ? (printable.width - (options.columns - 1) * options.spacing) / options.columns
        : printable.width;
      const availableH = options.enableDuplication
        ? (printable.height - (options.rows - 1) * options.spacing) / options.rows
        : printable.height;
      const scaleX = availableW / motifW;
      const scaleY = availableH / motifH;
      motifScale = Math.min(scaleX, scaleY, 1);
    } else if (options.scale === "100") {
      motifScale = 1;
    } else {
      motifScale = options.customScale / 100;
    }

    // Créer un canvas pour l'impression (haute résolution)
    const printDPI = 300; // DPI pour impression
    const mmToPx = printDPI / 25.4;

    const printCanvas = document.createElement("canvas");
    printCanvas.width = page.width * mmToPx;
    printCanvas.height = page.height * mmToPx;
    const ctx = printCanvas.getContext("2d");
    if (!ctx) return;

    // Fond blanc
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, printCanvas.width, printCanvas.height);

    // MOD v80.16: Source sans règles
    const sourceCanvas = captureContentWithoutRulers();
    if (!sourceCanvas) return;

    // Calculer les dimensions
    const marginPx = options.margins * mmToPx;
    const scaledMotifW = motifW * motifScale * mmToPx;
    const scaledMotifH = motifH * motifScale * mmToPx;
    const cols = options.enableDuplication ? options.columns : 1;
    const rows = options.enableDuplication ? options.rows : 1;
    const spacingPx = options.spacing * mmToPx;

    // Centrer
    const totalWidth = cols * scaledMotifW + (cols - 1) * spacingPx;
    const totalHeight = rows * scaledMotifH + (rows - 1) * spacingPx;
    const printableWidthPx = printCanvas.width - marginPx * 2;
    const printableHeightPx = printCanvas.height - marginPx * 2;
    const startX = marginPx + (printableWidthPx - totalWidth) / 2;
    const startY = marginPx + (printableHeightPx - totalHeight) / 2;

    // Dessiner les motifs
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * (scaledMotifW + spacingPx);
        const y = startY + row * (scaledMotifH + spacingPx);
        ctx.drawImage(sourceCanvas, x, y, scaledMotifW, scaledMotifH);

        // MOD v80.16: Cadre du motif
        if (options.includeBorder) {
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 1 * mmToPx / 25.4; // ~1pt
          ctx.setLineDash([]);
          ctx.strokeRect(x, y, scaledMotifW, scaledMotifH);
        }

        // Traits de coupe
        if (options.includeCutMarks && options.enableDuplication) {
          ctx.strokeStyle = "#AAAAAA";
          ctx.lineWidth = 0.5 * mmToPx / 25.4;
          ctx.setLineDash([5 * mmToPx / 25.4, 5 * mmToPx / 25.4]);

          if (col < cols - 1) {
            const cutX = x + scaledMotifW + spacingPx / 2;
            ctx.beginPath();
            ctx.moveTo(cutX, Math.max(0, y - 10 * mmToPx / 25.4));
            ctx.lineTo(cutX, Math.min(printCanvas.height, y + scaledMotifH + 10 * mmToPx / 25.4));
            ctx.stroke();
          }

          if (row < rows - 1) {
            const cutY = y + scaledMotifH + spacingPx / 2;
            ctx.beginPath();
            ctx.moveTo(Math.max(0, x - 10 * mmToPx / 25.4), cutY);
            ctx.lineTo(Math.min(printCanvas.width, x + scaledMotifW + 10 * mmToPx / 25.4), cutY);
            ctx.stroke();
          }

          ctx.setLineDash([]);
        }
      }
    }

    // Ouvrir la fenêtre d'impression
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez les popups.");
      return;
    }

    const imgData = printCanvas.toDataURL("image/png");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Impression - Van Project Buddy</title>
        <style>
          @page {
            size: ${options.format} ${options.orientation};
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            width: 100%;
            height: 100%;
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <img src="${imgData}" />
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 250);
          };
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  }, [canvasRef, options, getPageDimensions, getPrintableArea, contentWidth, contentHeight, captureContentWithoutRulers]);

  // Gestion du drag de la modale
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".modal-header")) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Calculer les infos de motif
  const motifInfo = useCallback(() => {
    const { maxCols, maxRows } = calculateMaxMotifs();
    const total = options.enableDuplication ? options.columns * options.rows : 1;
    return { maxCols, maxRows, total };
  }, [calculateMaxMotifs, options.enableDuplication, options.columns, options.rows]);

  if (!isOpen) return null;

  const info = motifInfo();

  return (
    <div
      ref={modalRef}
      className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-300"
      style={{
        left: position.x,
        top: position.y,
        width: "480px",
        maxHeight: "90vh",
        overflow: "hidden",
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header draggable */}
      <div className="modal-header flex items-center justify-between px-4 py-3 bg-gray-100 border-b cursor-move select-none">
        <div className="flex items-center gap-2">
          <Printer className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-gray-800">Imprimer</span>
          <Move className="h-4 w-4 text-gray-400" />
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Contenu scrollable */}
      <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(90vh - 120px)" }}>
        {/* Prévisualisation */}
        <div className="mb-4 border rounded-lg p-2 bg-gray-50 flex justify-center">
          <canvas
            ref={previewCanvasRef}
            className="border border-gray-300 shadow-sm"
            style={{ maxWidth: "100%", maxHeight: "250px" }}
          />
        </div>

        {/* Format et orientation */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-1">
            <Maximize2 className="h-4 w-4" /> Format
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600">Format papier</Label>
              <Select
                value={options.format}
                onValueChange={(v) => setOptions((prev) => ({ ...prev, format: v as PrintOptions["format"] }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                  <SelectItem value="A3">A3 (297 × 420 mm)</SelectItem>
                  <SelectItem value="Letter">Letter (216 × 279 mm)</SelectItem>
                  <SelectItem value="Legal">Legal (216 × 356 mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Orientation</Label>
              <Select
                value={options.orientation}
                onValueChange={(v) =>
                  setOptions((prev) => ({ ...prev, orientation: v as PrintOptions["orientation"] }))
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Paysage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-2">
            <Label className="text-xs text-gray-600">Marges (mm)</Label>
            <input
              type="number"
              min="0"
              max="50"
              value={options.margins}
              onChange={(e) => setOptions((prev) => ({ ...prev, margins: parseInt(e.target.value) || 0 }))}
              className="w-full h-8 px-2 text-sm border rounded mt-1"
            />
          </div>
        </div>

        {/* Duplication */}
        <div className="mb-4 p-3 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-green-800 flex items-center gap-1">
              <Grid3X3 className="h-4 w-4" /> Duplication
            </h3>
            <Switch
              checked={options.enableDuplication}
              onCheckedChange={(v) => setOptions((prev) => ({ ...prev, enableDuplication: v }))}
            />
          </div>

          {options.enableDuplication && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <Label className="text-xs text-gray-600">Colonnes</Label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={options.columns}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, columns: Math.max(1, parseInt(e.target.value) || 1) }))
                    }
                    className="w-full h-8 px-2 text-sm border rounded mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Lignes</Label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={options.rows}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, rows: Math.max(1, parseInt(e.target.value) || 1) }))
                    }
                    className="w-full h-8 px-2 text-sm border rounded mt-1"
                  />
                </div>
              </div>

              <div className="mb-2">
                <Label className="text-xs text-gray-600">Espacement (mm)</Label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={options.spacing}
                  onChange={(e) => setOptions((prev) => ({ ...prev, spacing: parseInt(e.target.value) || 0 }))}
                  className="w-full h-8 px-2 text-sm border rounded mt-1"
                />
              </div>

              <Button variant="outline" size="sm" className="w-full h-8 text-sm" onClick={autoFillPage}>
                <Maximize2 className="h-3 w-3 mr-1" /> Auto-remplir la page (max {info.maxCols}×{info.maxRows})
              </Button>

              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-green-200">
                <Switch
                  checked={options.includeCutMarks}
                  onCheckedChange={(v) => setOptions((prev) => ({ ...prev, includeCutMarks: v }))}
                />
                <Label className="text-xs text-gray-600 flex items-center gap-1">
                  <Scissors className="h-3 w-3" /> Traits de coupe
                </Label>
              </div>
            </>
          )}

          <div className="mt-2 text-xs text-green-700 bg-green-100 rounded px-2 py-1">
            {options.enableDuplication ? (
              <>
                <strong>{info.total}</strong> motif(s) sur la page
              </>
            ) : (
              "1 motif (duplication désactivée)"
            )}
          </div>
        </div>

        {/* MOD v80.16: Options d'affichage */}
        <div className="mb-4 p-3 bg-orange-50 rounded-lg">
          <h3 className="text-sm font-semibold text-orange-800 mb-2 flex items-center gap-1">
            <Square className="h-4 w-4" /> Affichage
          </h3>
          <div className="flex items-center gap-2">
            <Switch
              checked={options.includeBorder}
              onCheckedChange={(v) => setOptions((prev) => ({ ...prev, includeBorder: v }))}
            />
            <Label className="text-xs text-gray-600">Cadre autour du motif</Label>
          </div>
        </div>

        {/* Échelle */}
        <div className="mb-4 p-3 bg-purple-50 rounded-lg">
          <h3 className="text-sm font-semibold text-purple-800 mb-2">Échelle</h3>
          <Select
            value={options.scale}
            onValueChange={(v) => setOptions((prev) => ({ ...prev, scale: v as PrintOptions["scale"] }))}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fit">Ajuster à la page</SelectItem>
              <SelectItem value="100">100% (taille réelle)</SelectItem>
              <SelectItem value="custom">Personnalisée</SelectItem>
            </SelectContent>
          </Select>

          {options.scale === "custom" && (
            <div className="mt-2">
              <Label className="text-xs text-gray-600">Échelle personnalisée (%)</Label>
              <input
                type="number"
                min="10"
                max="500"
                value={options.customScale}
                onChange={(e) => setOptions((prev) => ({ ...prev, customScale: parseInt(e.target.value) || 100 }))}
                className="w-full h-8 px-2 text-sm border rounded mt-1"
              />
            </div>
          )}
        </div>

        {/* Info taille motif */}
        <div className="text-xs text-gray-500 text-center mb-2">
          Taille du motif : {contentWidth.toFixed(0)} × {contentHeight.toFixed(0)} mm
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 bg-gray-50 border-t">
        <Button variant="outline" size="sm" onClick={onClose}>
          Annuler
        </Button>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1" /> Imprimer
        </Button>
      </div>
    </div>
  );
};

export default PrintPreviewModal;
