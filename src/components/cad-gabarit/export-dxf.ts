// ============================================
// EXPORT DXF: Export au format AutoCAD R12
// Compatible Fusion 360, AutoCAD, LibreCAD
// VERSION: 2.3 - Ajout splines et rectangles
// ============================================

import { Sketch, Line, Circle as CircleType, Arc, Spline, Rectangle, Point } from "./types";

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
      case "spline": {
        // v2.3: Export des splines comme polylignes (approximation)
        dxf += exportSpline(geo as Spline, sketch, scale);
        break;
      }
      case "rectangle": {
        // v2.3: Export des rectangles comme 4 lignes
        dxf += exportRectangle(geo as Rectangle, sketch, scale);
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
  const x1 = (p1.x / scale).toFixed(4);
  const y1 = (-p1.y / scale).toFixed(4);
  const x2 = (p2.x / scale).toFixed(4);
  const y2 = (-p2.y / scale).toFixed(4);

  // MOD v7.12d: Lignes de construction sur calque séparé
  const layer = line.isConstruction ? "CONSTRUCTION" : "0";

  let dxf = "";
  dxf += "0\nLINE\n";
  dxf += `8\n${layer}\n`; // Calque
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

/**
 * v2.4: Exporte une spline comme une série de LINE (meilleure compatibilité Fusion 360)
 * Utiliser des LINE au lieu de POLYLINE pour une compatibilité maximale
 */
function exportSpline(spline: Spline, sketch: Sketch, scale: number): string {
  const points: Point[] = [];
  for (const pointId of spline.points) {
    const pt = sketch.points.get(pointId);
    if (pt) points.push(pt);
  }

  if (points.length < 2) return "";

  const tension = spline.tension ?? 0.5;
  const layer = spline.isConstruction ? "CONSTRUCTION" : "0";

  let dxf = "";

  if (points.length === 2) {
    // Juste 2 points - une seule ligne
    const x1 = (points[0].x / scale).toFixed(4);
    const y1 = (-points[0].y / scale).toFixed(4);
    const x2 = (points[1].x / scale).toFixed(4);
    const y2 = (-points[1].y / scale).toFixed(4);

    dxf += "0\nLINE\n";
    dxf += `8\n${layer}\n`;
    dxf += `10\n${x1}\n`;
    dxf += `20\n${y1}\n`;
    dxf += "30\n0.0\n";
    dxf += `11\n${x2}\n`;
    dxf += `21\n${y2}\n`;
    dxf += "31\n0.0\n";
  } else {
    // Courbe Catmull-Rom approximée par des segments LINE
    const steps = 10; // Segments par section de courbe
    const allPoints: { x: number; y: number }[] = [];

    // Générer tous les points de la courbe
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? (spline.closed ? points.length - 1 : 0) : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i === points.length - 2 ? (spline.closed ? 0 : i + 1) : i + 2];

      // Points de contrôle Bézier
      const cp1x = p1.x + ((p2.x - p0.x) * tension) / 3;
      const cp1y = p1.y + ((p2.y - p0.y) * tension) / 3;
      const cp2x = p2.x - ((p3.x - p1.x) * tension) / 3;
      const cp2y = p2.y - ((p3.y - p1.y) * tension) / 3;

      // Évaluation de Bézier cubique
      const bezier = (t: number, v0: number, v1: number, v2: number, v3: number) => {
        const u = 1 - t;
        return u * u * u * v0 + 3 * u * u * t * v1 + 3 * u * t * t * v2 + t * t * t * v3;
      };

      for (let t = 0; t <= steps; t++) {
        const tt = t / steps;
        // Ne pas ajouter le premier point des segments suivants (déjà ajouté)
        if (i > 0 && t === 0) continue;

        allPoints.push({
          x: bezier(tt, p1.x, cp1x, cp2x, p2.x),
          y: bezier(tt, p1.y, cp1y, cp2y, p2.y),
        });
      }
    }

    // Si fermé, ajouter le dernier segment de fermeture
    if (spline.closed && points.length >= 3) {
      const p0 = points[points.length - 2];
      const p1 = points[points.length - 1];
      const p2 = points[0];
      const p3 = points[1];

      const cp1x = p1.x + ((p2.x - p0.x) * tension) / 3;
      const cp1y = p1.y + ((p2.y - p0.y) * tension) / 3;
      const cp2x = p2.x - ((p3.x - p1.x) * tension) / 3;
      const cp2y = p2.y - ((p3.y - p1.y) * tension) / 3;

      const bezier = (t: number, v0: number, v1: number, v2: number, v3: number) => {
        const u = 1 - t;
        return u * u * u * v0 + 3 * u * u * t * v1 + 3 * u * t * t * v2 + t * t * t * v3;
      };

      for (let t = 1; t <= steps; t++) {
        const tt = t / steps;
        allPoints.push({
          x: bezier(tt, p1.x, cp1x, cp2x, p2.x),
          y: bezier(tt, p1.y, cp1y, cp2y, p2.y),
        });
      }
    }

    // Créer des LINE entre chaque paire de points consécutifs
    for (let i = 0; i < allPoints.length - 1; i++) {
      const pt1 = allPoints[i];
      const pt2 = allPoints[i + 1];

      const x1 = (pt1.x / scale).toFixed(4);
      const y1 = (-pt1.y / scale).toFixed(4);
      const x2 = (pt2.x / scale).toFixed(4);
      const y2 = (-pt2.y / scale).toFixed(4);

      dxf += "0\nLINE\n";
      dxf += `8\n${layer}\n`;
      dxf += `10\n${x1}\n`;
      dxf += `20\n${y1}\n`;
      dxf += "30\n0.0\n";
      dxf += `11\n${x2}\n`;
      dxf += `21\n${y2}\n`;
      dxf += "31\n0.0\n";
    }

    // Si fermé, ajouter une ligne de fermeture
    if (spline.closed && allPoints.length > 0) {
      const pt1 = allPoints[allPoints.length - 1];
      const pt2 = allPoints[0];

      const x1 = (pt1.x / scale).toFixed(4);
      const y1 = (-pt1.y / scale).toFixed(4);
      const x2 = (pt2.x / scale).toFixed(4);
      const y2 = (-pt2.y / scale).toFixed(4);

      dxf += "0\nLINE\n";
      dxf += `8\n${layer}\n`;
      dxf += `10\n${x1}\n`;
      dxf += `20\n${y1}\n`;
      dxf += "30\n0.0\n";
      dxf += `11\n${x2}\n`;
      dxf += `21\n${y2}\n`;
      dxf += "31\n0.0\n";
    }
  }

  return dxf;
}

/**
 * v2.3: Exporte un rectangle comme 4 lignes
 */
function exportRectangle(rect: Rectangle, sketch: Sketch, scale: number): string {
  const p1 = sketch.points.get(rect.p1);
  const p2 = sketch.points.get(rect.p2);
  const p3 = sketch.points.get(rect.p3);
  const p4 = sketch.points.get(rect.p4);

  if (!p1 || !p2 || !p3 || !p4) return "";

  const layer = (rect as any).isConstruction ? "CONSTRUCTION" : "0";

  // Convertir les 4 coins en mm
  const pts = [p1, p2, p3, p4].map(p => ({
    x: (p.x / scale).toFixed(4),
    y: (-p.y / scale).toFixed(4),
  }));

  let dxf = "";

  // 4 lignes: p1-p2, p2-p3, p3-p4, p4-p1
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0]];
  for (const [i, j] of edges) {
    dxf += "0\nLINE\n";
    dxf += `8\n${layer}\n`;
    dxf += `10\n${pts[i].x}\n`;
    dxf += `20\n${pts[i].y}\n`;
    dxf += "30\n0.0\n";
    dxf += `11\n${pts[j].x}\n`;
    dxf += `21\n${pts[j].y}\n`;
    dxf += "31\n0.0\n";
  }

  return dxf;
}

export default exportToDXF;
