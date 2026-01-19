// ============================================
// COMPOSANT: CalibrationRulerGenerator
// Génère une équerre de calibration en L imprimable sur A4
// VERSION: 1.0
// ============================================

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ruler, Download, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

interface CalibrationRulerGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalibrationRulerGenerator({ open, onOpenChange }: CalibrationRulerGeneratorProps) {
  // Paramètres de l'équerre
  const [rulerLengthX, setRulerLengthX] = useState("200"); // Longueur axe X en mm
  const [rulerLengthY, setRulerLengthY] = useState("150"); // Longueur axe Y en mm
  const [rulerWidth, setRulerWidth] = useState("20"); // Largeur de la règle en mm
  const [majorTickInterval, setMajorTickInterval] = useState("10"); // Graduation principale tous les X mm
  const [minorTickInterval, setMinorTickInterval] = useState("1"); // Graduation secondaire tous les X mm
  const [showNumbers, setShowNumbers] = useState(true); // Afficher les numéros
  const [numberInterval, setNumberInterval] = useState("10"); // Numéro tous les X mm
  const [lineWidth, setLineWidth] = useState("0.3"); // Épaisseur des lignes en mm
  const [rulerColor, setRulerColor] = useState("black"); // Couleur
  const [includeCheckerCorners, setIncludeCheckerCorners] = useState(true); // Points de repère aux coins

  const generatePDF = useCallback(() => {
    const lengthX = parseFloat(rulerLengthX) || 200;
    const lengthY = parseFloat(rulerLengthY) || 150;
    const width = parseFloat(rulerWidth) || 20;
    const majorTick = parseFloat(majorTickInterval) || 10;
    const minorTick = parseFloat(minorTickInterval) || 1;
    const numInterval = parseFloat(numberInterval) || 10;
    const lineW = parseFloat(lineWidth) || 0.3;

    // Vérifier que ça rentre sur A4 (210x297mm avec marges)
    const maxX = 190; // 210 - 2*10mm de marge
    const maxY = 277; // 297 - 2*10mm de marge

    if (lengthX > maxX || lengthY > maxY) {
      toast.error(`Dimensions trop grandes pour A4. Max: ${maxX}x${maxY}mm`);
      return;
    }

    // Créer le PDF A4
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Marges
    const marginLeft = 10;
    const marginTop = 15;

    // Position de l'équerre (coin intérieur)
    const originX = marginLeft + width;
    const originY = marginTop + width;

    // Couleur
    const color = rulerColor === "black" ? "#000000" : rulerColor === "blue" ? "#0066CC" : "#333333";
    doc.setDrawColor(color);
    doc.setTextColor(color);

    // Épaisseur de ligne
    doc.setLineWidth(lineW);

    // === DESSINER L'ÉQUERRE EN L ===

    // Branche horizontale (axe X)
    doc.rect(originX, originY - width, lengthX, width);

    // Branche verticale (axe Y)
    doc.rect(originX - width, originY, width, lengthY);

    // Coin (carré de jonction)
    doc.rect(originX - width, originY - width, width, width);

    // === GRADUATIONS AXE X ===
    doc.setLineWidth(lineW * 0.5); // Lignes plus fines pour les graduations

    for (let x = 0; x <= lengthX; x += minorTick) {
      const posX = originX + x;
      const isMajor = x % majorTick === 0;
      const tickHeight = isMajor ? width * 0.6 : width * 0.3;

      // Graduation du haut (vers le bas)
      doc.line(posX, originY - width, posX, originY - width + tickHeight);
      // Graduation du bas (vers le haut)
      doc.line(posX, originY, posX, originY - tickHeight);

      // Numéros
      if (showNumbers && x % numInterval === 0 && x > 0) {
        doc.setFontSize(7);
        doc.text(x.toString(), posX, originY - width / 2, { align: "center", baseline: "middle" });
      }
    }

    // === GRADUATIONS AXE Y ===
    for (let y = 0; y <= lengthY; y += minorTick) {
      const posY = originY + y;
      const isMajor = y % majorTick === 0;
      const tickWidth = isMajor ? width * 0.6 : width * 0.3;

      // Graduation de gauche (vers la droite)
      doc.line(originX - width, posY, originX - width + tickWidth, posY);
      // Graduation de droite (vers la gauche)
      doc.line(originX, posY, originX - tickWidth, posY);

      // Numéros
      if (showNumbers && y % numInterval === 0 && y > 0) {
        doc.setFontSize(7);
        doc.text(y.toString(), originX - width / 2, posY, { align: "center", baseline: "middle" });
      }
    }

    // === POINTS DE REPÈRE (CROIX) AUX POSITIONS CLÉS ===
    if (includeCheckerCorners) {
      doc.setLineWidth(lineW);
      const crossSize = 3;

      // Fonction pour dessiner une croix de visée
      const drawCross = (cx: number, cy: number, label?: string) => {
        // Croix
        doc.line(cx - crossSize, cy, cx + crossSize, cy);
        doc.line(cx, cy - crossSize, cx, cy + crossSize);
        // Cercle
        doc.circle(cx, cy, crossSize * 0.8);
        // Label
        if (label) {
          doc.setFontSize(5);
          doc.text(label, cx + crossSize + 1, cy + 1);
        }
      };

      // Point d'origine (0,0)
      drawCross(originX, originY, "0,0");

      // Points sur l'axe X (tous les 50mm ou à la fin)
      const xPoints = [50, 100, 150, 200].filter(x => x <= lengthX);
      if (!xPoints.includes(lengthX)) xPoints.push(lengthX);
      xPoints.forEach(x => {
        if (x > 0) drawCross(originX + x, originY, `${x},0`);
      });

      // Points sur l'axe Y (tous les 50mm ou à la fin)
      const yPoints = [50, 100, 150, 200].filter(y => y <= lengthY);
      if (!yPoints.includes(lengthY)) yPoints.push(lengthY);
      yPoints.forEach(y => {
        if (y > 0) drawCross(originX, originY + y, `0,${y}`);
      });
    }

    // === TITRE ET INFORMATIONS ===
    doc.setFontSize(10);
    doc.setTextColor("#666666");
    doc.text("Équerre de calibration - Env-Link CAD", marginLeft, marginTop - 5);
    doc.setFontSize(7);
    doc.text(`Dimensions: ${lengthX}mm × ${lengthY}mm | Graduations: ${minorTick}mm / ${majorTick}mm`, marginLeft, marginTop - 1);

    // Instructions en bas
    doc.setFontSize(6);
    doc.setTextColor("#999999");
    const instructions = [
      "Instructions: Imprimer à 100% (sans mise à l'échelle). Vérifier avec une règle que les dimensions sont exactes.",
      "Placer l'équerre sur la photo à calibrer avec le coin intérieur sur un point de référence connu.",
    ];
    instructions.forEach((text, i) => {
      doc.text(text, marginLeft, 290 - (instructions.length - i - 1) * 4);
    });

    // Télécharger le PDF
    doc.save(`equerre-calibration-${lengthX}x${lengthY}mm.pdf`);
    toast.success("PDF généré avec succès !");
    onOpenChange(false);
  }, [
    rulerLengthX,
    rulerLengthY,
    rulerWidth,
    majorTickInterval,
    minorTickInterval,
    showNumbers,
    numberInterval,
    lineWidth,
    rulerColor,
    includeCheckerCorners,
    onOpenChange,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Générer une équerre de calibration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lengthX" className="text-xs">Longueur X (mm)</Label>
              <Input
                id="lengthX"
                type="number"
                value={rulerLengthX}
                onChange={(e) => setRulerLengthX(e.target.value)}
                min="50"
                max="190"
                className="h-8"
              />
            </div>
            <div>
              <Label htmlFor="lengthY" className="text-xs">Longueur Y (mm)</Label>
              <Input
                id="lengthY"
                type="number"
                value={rulerLengthY}
                onChange={(e) => setRulerLengthY(e.target.value)}
                min="50"
                max="277"
                className="h-8"
              />
            </div>
          </div>

          {/* Largeur de la règle */}
          <div>
            <Label htmlFor="width" className="text-xs">Largeur de la règle (mm)</Label>
            <Input
              id="width"
              type="number"
              value={rulerWidth}
              onChange={(e) => setRulerWidth(e.target.value)}
              min="10"
              max="30"
              className="h-8"
            />
          </div>

          {/* Graduations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="majorTick" className="text-xs">Graduation principale (mm)</Label>
              <Select value={majorTickInterval} onValueChange={setMajorTickInterval}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 mm</SelectItem>
                  <SelectItem value="10">10 mm</SelectItem>
                  <SelectItem value="20">20 mm</SelectItem>
                  <SelectItem value="50">50 mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="minorTick" className="text-xs">Graduation secondaire (mm)</Label>
              <Select value={minorTickInterval} onValueChange={setMinorTickInterval}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 mm</SelectItem>
                  <SelectItem value="2">2 mm</SelectItem>
                  <SelectItem value="5">5 mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="showNumbers" className="text-xs">Afficher les numéros</Label>
              <Switch
                id="showNumbers"
                checked={showNumbers}
                onCheckedChange={setShowNumbers}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="crossMarks" className="text-xs">Points de repère (croix)</Label>
              <Switch
                id="crossMarks"
                checked={includeCheckerCorners}
                onCheckedChange={setIncludeCheckerCorners}
              />
            </div>
          </div>

          {/* Couleur */}
          <div>
            <Label className="text-xs">Couleur</Label>
            <Select value={rulerColor} onValueChange={setRulerColor}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="black">Noir</SelectItem>
                <SelectItem value="blue">Bleu</SelectItem>
                <SelectItem value="gray">Gris foncé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Prévisualisation des dimensions */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
            <p className="font-medium mb-1">Aperçu:</p>
            <p>Équerre en L de {rulerLengthX}mm × {rulerLengthY}mm</p>
            <p>Graduations: {minorTickInterval}mm (fin) / {majorTickInterval}mm (épais)</p>
            <p className="text-orange-600 mt-1">⚠️ Imprimer à 100% sans mise à l'échelle</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={generatePDF} className="gap-2">
            <Download className="h-4 w-4" />
            Générer PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CalibrationRulerGenerator;
