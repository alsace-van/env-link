// ============================================
// EXPORT DXF: Export au format AutoCAD R12
// Compatible Fusion 360, AutoCAD, LibreCAD
// VERSION: 2.1 - Format R12 ultra-simplifié
// ============================================

import { Sketch, Line, Circle as CircleType, Arc } from "./types";

/**
 * Exporte un sketch au format DXF (AutoCAD R12 - format le plus compatible)
 * MOD v7.12: Correction de l'échelle - scaleFactor est en px/mm
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

  // Section TABLES (minimale)
  dxf += "0\nSECTION\n";
  dxf += "2\nTABLES\n";

  // Table LTYPE
  dxf += "0\nTABLE\n";
  dxf += "2\nLTYPE\n";
  dxf += "70\n1\n";
  dxf += "0\nLTYPE\n";
  dxf += "2\nCONTINUOUS\n";
  dxf += "70\n0\n";
  dxf += "3\nSolid line\n";
  dxf += "72\n65\n";
  dxf += "73\n0\n";
  dxf += "40\n0.0\n";
  dxf += "0\nENDTAB\n";

  // Table LAYER
  dxf += "0\nTABLE\n";
  dxf += "2\nLAYER\n";
  dxf += "70\n1\n";
  dxf += "0\nLAYER\n";
  dxf += "2\n0\n";
  dxf += "70\n0\n";
  dxf += "62\n7\n";
  dxf += "6\nCONTINUOUS\n";
  dxf += "0\nENDTAB\n";

  dxf += "0\nENDSEC\n";

  // Section ENTITIES
  dxf += "0\nSECTION\n";
  dxf += "2\nENTITIES\n";

  // Exporter les géométries (inclure les lignes de construction - MOD v7.12)
  sketch.geometries.forEach((geo) => {
    switch (geo.type) {
      case "line": {
        const line = geo as Line;
        // MOD v7.12: Inclure les lignes de construction
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

  // MOD v7.12: Coordonnées en mm (diviser par scale car scale = px/mm)
  // Y inversé pour DXF (système de coordonnées différent)
  const x1 = (p1.x / scale).toFixed(4);
  const y1 = (-p1.y / scale).toFixed(4);
  const x2 = (p2.x / scale).toFixed(4);
  const y2 = (-p2.y / scale).toFixed(4);

  let dxf = "";
  dxf += "0\nLINE\n";
  dxf += "8\n0\n";
  dxf += `10\n${x1}\n`;
  dxf += `20\n${y1}\n`;
  dxf += "30\n0.0\n";
  dxf += `11\n${x2}\n`;
  dxf += `21\n${y2}\n`;
  dxf += "31\n0.0\n";

  return dxf;
}

function exportCircle(circle: CircleType, sketch: Sketch, scale: number): string {
  const center = sketch.points.get(circle.center);

  if (!center) return "";

  // MOD v7.12: Diviser par scale (px/mm) pour obtenir des mm
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

  // MOD v7.12: Diviser par scale (px/mm) pour obtenir des mm
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
