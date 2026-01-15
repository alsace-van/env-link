// ============================================
// EXPORT DXF: Export au format AutoCAD R12
// Compatible Fusion 360, AutoCAD, LibreCAD
// VERSION: 2.2 - Lignes de construction en pointillé
// ============================================

import { Sketch, Line, Circle as CircleType, Arc } from "./types";

/**
 * Exporte un sketch au format DXF (AutoCAD R12 - format le plus compatible)
 * MOD v7.12: Correction de l'échelle - scaleFactor est en px/mm
 * MOD v7.12b: Lignes de construction en pointillé
 */
export function exportToDXF(sketch: Sketch): string {
  // scaleFactor = px/mm (ex: 2.5 pixels par mm)
  // Pour convertir px en mm, on DIVISE par scaleFactor
  const scale = sketch.scaleFactor || 1;

  let dxf = "";

  // Section HEADER (minimale pour R12)
  dxf += "0\nSECTION\n";
  dxf += "2\nHEADER\n";
  dxf += "9\n$ACADVER\n";
  dxf += "1\nAC1009\n";
  dxf += "9\n$INSUNITS\n";
  dxf += "70\n4\n";
  dxf += "0\nENDSEC\n";

  // Section TABLES
  dxf += "0\nSECTION\n";
  dxf += "2\nTABLES\n";

  // Table LTYPE - Types de lignes
  dxf += "0\nTABLE\n";
  dxf += "2\nLTYPE\n";
  dxf += "70\n2\n"; // 2 types de lignes

  // Type CONTINUOUS (ligne continue)
  dxf += "0\nLTYPE\n";
  dxf += "2\nCONTINUOUS\n";
  dxf += "70\n0\n";
  dxf += "3\nSolid line\n";
  dxf += "72\n65\n";
  dxf += "73\n0\n";
  dxf += "40\n0.0\n";

  // Type DASHED (ligne pointillée pour construction)
  dxf += "0\nLTYPE\n";
  dxf += "2\nDASHED\n";
  dxf += "70\n0\n";
  dxf += "3\nDashed line\n";
  dxf += "72\n65\n";
  dxf += "73\n2\n"; // 2 éléments dans le motif
  dxf += "40\n10.0\n"; // Longueur totale du motif
  dxf += "49\n5.0\n"; // Trait (positif = visible)
  dxf += "49\n-5.0\n"; // Espace (négatif = invisible)

  dxf += "0\nENDTAB\n";

  // Table LAYER - Calques
  dxf += "0\nTABLE\n";
  dxf += "2\nLAYER\n";
  dxf += "70\n2\n"; // 2 calques

  // Calque 0 (défaut - lignes normales)
  dxf += "0\nLAYER\n";
  dxf += "2\n0\n";
  dxf += "70\n0\n";
  dxf += "62\n7\n"; // Couleur blanche
  dxf += "6\nCONTINUOUS\n";

  // Calque CONSTRUCTION (lignes de construction)
  dxf += "0\nLAYER\n";
  dxf += "2\nCONSTRUCTION\n";
  dxf += "70\n0\n";
  dxf += "62\n8\n"; // Couleur grise
  dxf += "6\nDASHED\n";

  dxf += "0\nENDTAB\n";

  dxf += "0\nENDSEC\n";

  // Section ENTITIES
  dxf += "0\nSECTION\n";
  dxf += "2\nENTITIES\n";

  // Exporter les géométries
  sketch.geometries.forEach((geo) => {
    switch (geo.type) {
      case "line": {
        const line = geo as Line;
        dxf += exportLine(line, sketch, scale);
        break;
      }
      case "circle": {
        dxf += exportCircle(geo as CircleType, sketch, scale);
        break;
      }
      case "arc": {
        dxf += exportArc(geo as Arc, sketch, scale);
        break;
      }
    }
  });

  dxf += "0\nENDSEC\n";

  // Fin du fichier
  dxf += "0\nEOF\n";

  return dxf;
}

function exportLine(line: Line, sketch: Sketch, scale: number): string {
  const p1 = sketch.points.get(line.p1);
  const p2 = sketch.points.get(line.p2);

  if (!p1 || !p2) return "";

  // Coordonnées en mm (diviser par scale car scale = px/mm)
  // Y inversé pour DXF (système de coordonnées différent)
  const x1 = p1.x / scale;
  const y1 = -p1.y / scale;
  const x2 = p2.x / scale;
  const y2 = -p2.y / scale;

  // MOD v7.12c: Si ligne de construction, dessiner en pointillé (segments)
  if (line.isConstruction) {
    return exportDashedLine(x1, y1, x2, y2);
  }

  // Ligne normale (continue)
  let dxf = "";
  dxf += "0\nLINE\n";
  dxf += "8\n0\n"; // Calque
  dxf += `10\n${x1.toFixed(4)}\n`;
  dxf += `20\n${y1.toFixed(4)}\n`;
  dxf += "30\n0.0\n";
  dxf += `11\n${x2.toFixed(4)}\n`;
  dxf += `21\n${y2.toFixed(4)}\n`;
  dxf += "31\n0.0\n";

  return dxf;
}

// MOD v7.12c: Dessiner une ligne en pointillé (segments de 5mm avec espaces de 3mm)
function exportDashedLine(x1: number, y1: number, x2: number, y2: number): string {
  const dashLength = 5; // mm - longueur du trait
  const gapLength = 3; // mm - longueur de l'espace
  const patternLength = dashLength + gapLength;

  // Calculer la longueur totale et la direction
  const dx = x2 - x1;
  const dy = y2 - y1;
  const totalLength = Math.sqrt(dx * dx + dy * dy);

  if (totalLength < 0.1) return ""; // Ligne trop courte

  // Vecteur unitaire
  const ux = dx / totalLength;
  const uy = dy / totalLength;

  let dxf = "";
  let currentPos = 0;

  while (currentPos < totalLength) {
    // Début du trait
    const startX = x1 + ux * currentPos;
    const startY = y1 + uy * currentPos;

    // Fin du trait (ne pas dépasser la fin de la ligne)
    const endPos = Math.min(currentPos + dashLength, totalLength);
    const endX = x1 + ux * endPos;
    const endY = y1 + uy * endPos;

    // Ajouter le segment
    dxf += "0\nLINE\n";
    dxf += "8\nCONSTRUCTION\n"; // Calque construction
    dxf += `10\n${startX.toFixed(4)}\n`;
    dxf += `20\n${startY.toFixed(4)}\n`;
    dxf += "30\n0.0\n";
    dxf += `11\n${endX.toFixed(4)}\n`;
    dxf += `21\n${endY.toFixed(4)}\n`;
    dxf += "31\n0.0\n";

    // Avancer au prochain trait (trait + espace)
    currentPos += patternLength;
  }

  return dxf;
}

function exportCircle(circle: CircleType, sketch: Sketch, scale: number): string {
  const center = sketch.points.get(circle.center);

  if (!center) return "";

  // Diviser par scale (px/mm) pour obtenir des mm
  const cx = (center.x / scale).toFixed(4);
  const cy = (-center.y / scale).toFixed(4);
  const r = (circle.radius / scale).toFixed(4);

  let dxf = "";
  dxf += "0\nCIRCLE\n";
  dxf += "8\n0\n";
  dxf += `10\n${cx}\n`;
  dxf += `20\n${cy}\n`;
  dxf += "30\n0.0\n";
  dxf += `40\n${r}\n`;

  return dxf;
}

function exportArc(arc: Arc, sketch: Sketch, scale: number): string {
  const center = sketch.points.get(arc.center);
  const startPt = sketch.points.get(arc.startPoint);
  const endPt = sketch.points.get(arc.endPoint);

  if (!center || !startPt || !endPt) return "";

  // Diviser par scale (px/mm) pour obtenir des mm
  const cx = (center.x / scale).toFixed(4);
  const cy = (-center.y / scale).toFixed(4);
  const r = (arc.radius / scale).toFixed(4);

  // Calculer les angles en degrés pour DXF
  // Note: Y est inversé, donc on inverse aussi le signe de Y dans atan2
  let startAngle = (Math.atan2(-(startPt.y - center.y), startPt.x - center.x) * 180) / Math.PI;
  let endAngle = (Math.atan2(-(endPt.y - center.y), endPt.x - center.x) * 180) / Math.PI;

  // Si counterClockwise est false, inverser les angles
  if (arc.counterClockwise === false) {
    const temp = startAngle;
    startAngle = endAngle;
    endAngle = temp;
  }

  // Normaliser les angles entre 0 et 360
  while (startAngle < 0) startAngle += 360;
  while (endAngle < 0) endAngle += 360;

  let dxf = "";
  dxf += "0\nARC\n";
  dxf += "8\n0\n";
  dxf += `10\n${cx}\n`;
  dxf += `20\n${cy}\n`;
  dxf += "30\n0.0\n";
  dxf += `40\n${r}\n`;
  dxf += `50\n${startAngle.toFixed(4)}\n`;
  dxf += `51\n${endAngle.toFixed(4)}\n`;

  return dxf;
}

export default exportToDXF;
