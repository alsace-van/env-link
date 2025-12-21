// ============================================
// SchemaExport.tsx
// Composant pour exporter le schéma en PNG/PDF
// VERSION: 1.0
// ============================================

import React, { useState, useCallback } from "react";
import { toPng, toSvg } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  Download,
  FileImage,
  FileText,
  Printer,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface SchemaExportProps {
  reactFlowWrapper: React.RefObject<HTMLDivElement>;
  projectName?: string;
  schemaName?: string;
  onClose?: () => void;
  isOpen: boolean;
}

type ExportFormat = "png" | "svg" | "pdf";
type PaperSize = "a4" | "a3" | "letter";
type Orientation = "portrait" | "landscape";

const PAPER_SIZES: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
  letter: { width: 216, height: 279 },
};

export function SchemaExport({
  reactFlowWrapper,
  projectName = "Projet",
  schemaName = "Schéma électrique",
  onClose,
  isOpen,
}: SchemaExportProps) {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [paperSize, setPaperSize] = useState<PaperSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [includeCartouche, setIncludeCartouche] = useState(true);
  const [includeLegend, setIncludeLegend] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [scale, setScale] = useState(2);
  const [isExporting, setIsExporting] = useState(false);
  const [customTitle, setCustomTitle] = useState(schemaName);

  // Trouver l'élément ReactFlow viewport
  const getReactFlowElement = useCallback((): HTMLElement | null => {
    if (!reactFlowWrapper.current) return null;
    // Chercher le viewport ReactFlow
    const viewport = reactFlowWrapper.current.querySelector(
      ".react-flow__viewport"
    ) as HTMLElement;
    return viewport || reactFlowWrapper.current;
  }, [reactFlowWrapper]);

  // Export en PNG
  const exportToPng = useCallback(async () => {
    const element = getReactFlowElement();
    if (!element) {
      toast.error("Impossible de trouver le schéma");
      return;
    }

    try {
      // Masquer temporairement les contrôles
      const controls = reactFlowWrapper.current?.querySelector(".react-flow__controls");
      const minimap = reactFlowWrapper.current?.querySelector(".react-flow__minimap");
      const panel = reactFlowWrapper.current?.querySelector(".react-flow__panel");
      
      if (controls) (controls as HTMLElement).style.display = "none";
      if (minimap) (minimap as HTMLElement).style.display = "none";
      if (panel) (panel as HTMLElement).style.display = "none";

      const dataUrl = await toPng(reactFlowWrapper.current!, {
        backgroundColor,
        pixelRatio: scale,
        filter: (node) => {
          // Exclure certains éléments
          const className = node.className?.toString() || "";
          if (className.includes("react-flow__controls")) return false;
          if (className.includes("react-flow__minimap")) return false;
          if (className.includes("absolute") && className.includes("top-")) return false;
          return true;
        },
      });

      // Restaurer les contrôles
      if (controls) (controls as HTMLElement).style.display = "";
      if (minimap) (minimap as HTMLElement).style.display = "";
      if (panel) (panel as HTMLElement).style.display = "";

      // Créer et télécharger le fichier
      const link = document.createElement("a");
      link.download = `${customTitle.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();

      toast.success("PNG exporté avec succès");
    } catch (error) {
      console.error("Erreur export PNG:", error);
      toast.error("Erreur lors de l'export PNG");
    }
  }, [getReactFlowElement, reactFlowWrapper, backgroundColor, scale, customTitle]);

  // Export en SVG
  const exportToSvg = useCallback(async () => {
    const element = getReactFlowElement();
    if (!element) {
      toast.error("Impossible de trouver le schéma");
      return;
    }

    try {
      const dataUrl = await toSvg(reactFlowWrapper.current!, {
        backgroundColor,
        filter: (node) => {
          const className = node.className?.toString() || "";
          if (className.includes("react-flow__controls")) return false;
          if (className.includes("react-flow__minimap")) return false;
          return true;
        },
      });

      const link = document.createElement("a");
      link.download = `${customTitle.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.svg`;
      link.href = dataUrl;
      link.click();

      toast.success("SVG exporté avec succès");
    } catch (error) {
      console.error("Erreur export SVG:", error);
      toast.error("Erreur lors de l'export SVG");
    }
  }, [getReactFlowElement, reactFlowWrapper, backgroundColor, customTitle]);

  // Export en PDF
  const exportToPdf = useCallback(async () => {
    const element = getReactFlowElement();
    if (!element) {
      toast.error("Impossible de trouver le schéma");
      return;
    }

    try {
      // Masquer les contrôles
      const controls = reactFlowWrapper.current?.querySelector(".react-flow__controls");
      const minimap = reactFlowWrapper.current?.querySelector(".react-flow__minimap");
      
      if (controls) (controls as HTMLElement).style.display = "none";
      if (minimap) (minimap as HTMLElement).style.display = "none";

      const dataUrl = await toPng(reactFlowWrapper.current!, {
        backgroundColor,
        pixelRatio: scale,
        filter: (node) => {
          const className = node.className?.toString() || "";
          if (className.includes("react-flow__controls")) return false;
          if (className.includes("react-flow__minimap")) return false;
          return true;
        },
      });

      // Restaurer les contrôles
      if (controls) (controls as HTMLElement).style.display = "";
      if (minimap) (minimap as HTMLElement).style.display = "";

      // Créer le PDF
      const paper = PAPER_SIZES[paperSize];
      const pdfWidth = orientation === "landscape" ? paper.height : paper.width;
      const pdfHeight = orientation === "landscape" ? paper.width : paper.height;

      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: paperSize,
      });

      // Ajouter le cartouche si demandé
      let contentY = 10;
      if (includeCartouche) {
        // Bordure du cartouche
        pdf.setDrawColor(0);
        pdf.setLineWidth(0.5);
        pdf.rect(10, 10, pdfWidth - 20, 25);

        // Titre
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text(customTitle, 15, 22);

        // Infos
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Projet: ${projectName}`, 15, 30);
        pdf.text(`Date: ${new Date().toLocaleDateString("fr-FR")}`, pdfWidth - 60, 22);
        pdf.text(`Échelle: ${scale}x`, pdfWidth - 60, 30);

        contentY = 40;
      }

      // Calculer les dimensions de l'image
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => (img.onload = resolve));

      const imgWidth = pdfWidth - 20;
      const imgHeight = (img.height * imgWidth) / img.width;
      const maxImgHeight = pdfHeight - contentY - 10;
      
      let finalWidth = imgWidth;
      let finalHeight = imgHeight;
      
      if (imgHeight > maxImgHeight) {
        finalHeight = maxImgHeight;
        finalWidth = (img.width * finalHeight) / img.height;
      }

      // Centrer l'image
      const imgX = (pdfWidth - finalWidth) / 2;

      pdf.addImage(dataUrl, "PNG", imgX, contentY, finalWidth, finalHeight);

      // Sauvegarder
      pdf.save(
        `${customTitle.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`
      );

      toast.success("PDF exporté avec succès");
    } catch (error) {
      console.error("Erreur export PDF:", error);
      toast.error("Erreur lors de l'export PDF");
    }
  }, [
    getReactFlowElement,
    reactFlowWrapper,
    backgroundColor,
    scale,
    paperSize,
    orientation,
    includeCartouche,
    customTitle,
    projectName,
  ]);

  // Imprimer directement
  const printSchema = useCallback(async () => {
    const element = getReactFlowElement();
    if (!element) {
      toast.error("Impossible de trouver le schéma");
      return;
    }

    try {
      const dataUrl = await toPng(reactFlowWrapper.current!, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        filter: (node) => {
          const className = node.className?.toString() || "";
          if (className.includes("react-flow__controls")) return false;
          if (className.includes("react-flow__minimap")) return false;
          return true;
        },
      });

      // Ouvrir une fenêtre d'impression
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${customTitle}</title>
            <style>
              body { margin: 0; padding: 20px; }
              .header { 
                border: 1px solid #000; 
                padding: 10px; 
                margin-bottom: 20px;
                display: flex;
                justify-content: space-between;
              }
              .title { font-size: 18px; font-weight: bold; }
              .info { font-size: 12px; color: #666; }
              img { max-width: 100%; height: auto; }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            ${
              includeCartouche
                ? `
            <div class="header">
              <div>
                <div class="title">${customTitle}</div>
                <div class="info">Projet: ${projectName}</div>
              </div>
              <div class="info">
                <div>Date: ${new Date().toLocaleDateString("fr-FR")}</div>
              </div>
            </div>
            `
                : ""
            }
            <img src="${dataUrl}" />
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } catch (error) {
      console.error("Erreur impression:", error);
      toast.error("Erreur lors de l'impression");
    }
  }, [getReactFlowElement, reactFlowWrapper, customTitle, projectName, includeCartouche]);

  // Lancer l'export
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      switch (format) {
        case "png":
          await exportToPng();
          break;
        case "svg":
          await exportToSvg();
          break;
        case "pdf":
          await exportToPdf();
          break;
      }
      onClose?.();
    } finally {
      setIsExporting(false);
    }
  }, [format, exportToPng, exportToSvg, exportToPdf, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Exporter le schéma
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Titre personnalisé */}
          <div className="space-y-2">
            <Label>Titre du document</Label>
            <Input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Nom du schéma"
            />
          </div>

          {/* Format d'export */}
          <div className="space-y-2">
            <Label>Format</Label>
            <div className="flex gap-2">
              <Button
                variant={format === "png" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormat("png")}
                className="flex-1"
              >
                <FileImage className="w-4 h-4 mr-1" />
                PNG
              </Button>
              <Button
                variant={format === "svg" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormat("svg")}
                className="flex-1"
              >
                <FileImage className="w-4 h-4 mr-1" />
                SVG
              </Button>
              <Button
                variant={format === "pdf" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormat("pdf")}
                className="flex-1"
              >
                <FileText className="w-4 h-4 mr-1" />
                PDF
              </Button>
            </div>
          </div>

          {/* Options PDF */}
          {format === "pdf" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Format papier</Label>
                  <Select
                    value={paperSize}
                    onValueChange={(v) => setPaperSize(v as PaperSize)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4</SelectItem>
                      <SelectItem value="a3">A3</SelectItem>
                      <SelectItem value="letter">Letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Orientation</Label>
                  <Select
                    value={orientation}
                    onValueChange={(v) => setOrientation(v as Orientation)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="landscape">Paysage</SelectItem>
                      <SelectItem value="portrait">Portrait</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* Options communes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="cartouche"
                checked={includeCartouche}
                onCheckedChange={(c) => setIncludeCartouche(!!c)}
              />
              <Label htmlFor="cartouche" className="cursor-pointer">
                Inclure le cartouche (titre, date, projet)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="legend"
                checked={includeLegend}
                onCheckedChange={(c) => setIncludeLegend(!!c)}
              />
              <Label htmlFor="legend" className="cursor-pointer">
                Inclure la légende
              </Label>
            </div>
          </div>

          {/* Qualité (PNG) */}
          {format === "png" && (
            <div className="space-y-2">
              <Label>Qualité (échelle)</Label>
              <Select
                value={scale.toString()}
                onValueChange={(v) => setScale(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Standard (1x)</SelectItem>
                  <SelectItem value="2">Haute (2x)</SelectItem>
                  <SelectItem value="3">Très haute (3x)</SelectItem>
                  <SelectItem value="4">Maximum (4x)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Couleur de fond */}
          <div className="space-y-2">
            <Label>Couleur de fond</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <Input
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={printSchema} disabled={isExporting}>
            <Printer className="w-4 h-4 mr-1" />
            Imprimer
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isExporting}>
              Annuler
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1" />
              )}
              Exporter
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
