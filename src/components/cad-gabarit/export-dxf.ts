// ============================================
// EXPORT DXF: Export au format AutoCAD R12
// Compatible Fusion 360, AutoCAD, LibreCAD
// VERSION: 2.6 - Ajout TextAnnotation
// ============================================

import { Sketch, Line, Circle as CircleType, Arc, Spline, Rectangle, Point, Bezier, TextAnnotation } from "./types";

/**
 * Exporte un sketch au format DXF (AutoCAD R12 - format le plus compatible)
 */
export function exportToDXF(sketch: Sketch): string {
  const scale = sketch.scaleFactor || 1;

  let dxf = "";

  // Section HEADER
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

  // Table LTYPE
  dxf += "0\nTABLE\n";
  dxf += "2\nLTYPE\n";
  dxf += "70\n2\n";

  dxf += "0\nLTYPE\n";
  dxf += "2\nCONTINUOUS\n";
  dxf += "70\n0\n";
  dxf += "3\nSolid line\n";
  dxf += "72\n65\n";
  dxf += "73\n0\n";
  dxf += "40\n0.0\n";

  dxf += "0\nLTYPE\n";
  dxf += "2\nDASHED\n";
  dxf += "70\n0\n";
  dxf += "3\nDashed line\n";
  dxf += "72\n65\n";
  dxf += "73\n2\n";
  dxf += "40\n10.0\n";
  dxf += "49\n5.0\n";
  dxf += "49\n-5.0\n";

  dxf += "0\nENDTAB\n";

  // Table LAYER
  dxf += "0\nTABLE\n";
  dxf += "2\nLAYER\n";
  dxf += "70\n2\n";

  dxf += "0\nLAYER\n";
  dxf += "2\n0\n";
  dxf += "70\n0\n";
  dxf += "62\n7\n";
  dxf += "6\nCONTINUOUS\n";

  dxf += "0\nLAYER\n";
  dxf += "2\nCONSTRUCTION\n";
  dxf += "70\n0\n";
  dxf += "62\n8\n";
  dxf += "6\nDASHED\n";

  dxf += "0\nENDTAB\n";
  dxf += "0\nENDSEC\n";

  // Section ENTITIES
  dxf += "0\nSECTION\n";
  dxf += "2\nENTITIES\n";

  sketch.geometries.forEach((geo) => {
    switch (geo.type) {
      case "line":
        dxf += exportLine(geo as Line, sketch, scale);
        break;
      case "circle":
        dxf += exportCircle(geo as CircleType, sketch, scale);
        break;
      case "arc":
        dxf += exportArc(geo as Arc, sketch, scale);
        break;
      case "spline":
        dxf += exportSpline(geo as Spline, sketch, scale);
        break;
      case "rectangle":
        dxf += exportRectangle(geo as Rectangle, sketch, scale);
        break;
      case "bezier":
        dxf += exportBezier(geo as Bezier, sketch, scale);
        break;
      case "text":
        dxf += exportText(geo as TextAnnotation, sketch, scale);
        break;
    }
  });

  dxf += "0\nENDSEC\n";
  dxf += "0\nEOF\n";

  return dxf;
}

function exportLine(line: Line, sketch: Sketch, scale: number): string {
  const p1 = sketch.points.get(line.p1);
  const p2 = sketch.points.get(line.p2);
  if (!p1 || !p2) return "";

  const layer = line.isConstruction ? "CONSTRUCTION" : "0";
  let dxf = "0\nLINE\n";
  dxf += "8\n" + layer + "\n";
  dxf += "10\n" + (p1.x / scale).toFixed(4) + "\n";
  dxf += "20\n" + (-p1.y / scale).toFixed(4) + "\n";
  dxf += "30\n0.0\n";
  dxf += "11\n" + (p2.x / scale).toFixed(4) + "\n";
  dxf += "21\n" + (-p2.y / scale).toFixed(4) + "\n";
  dxf += "31\n0.0\n";
  return dxf;
}

function exportCircle(circle: CircleType, sketch: Sketch, scale: number): string {
  const center = sketch.points.get(circle.center);
  if (!center) return "";

  let dxf = "0\nCIRCLE\n";
  dxf += "8\n0\n";
  dxf += "10\n" + (center.x / scale).toFixed(4) + "\n";
  dxf += "20\n" + (-center.y / scale).toFixed(4) + "\n";
  dxf += "30\n0.0\n";
  dxf += "40\n" + (circle.radius / scale).toFixed(4) + "\n";
  return dxf;
}

function exportArc(arc: Arc, sketch: Sketch, scale: number): string {
  const center = sketch.points.get(arc.center);
  const startPt = sketch.points.get(arc.startPoint);
  const endPt = sketch.points.get(arc.endPoint);
  if (!center || !startPt || !endPt) return "";

  let startAngle = (Math.atan2(-(startPt.y - center.y), startPt.x - center.x) * 180) / Math.PI;
  let endAngle = (Math.atan2(-(endPt.y - center.y), endPt.x - center.x) * 180) / Math.PI;

  if (arc.counterClockwise === false) {
    const temp = startAngle;
    startAngle = endAngle;
    endAngle = temp;
  }

  while (startAngle < 0) startAngle += 360;
  while (endAngle < 0) endAngle += 360;

  let dxf = "0\nARC\n";
  dxf += "8\n0\n";
  dxf += "10\n" + (center.x / scale).toFixed(4) + "\n";
  dxf += "20\n" + (-center.y / scale).toFixed(4) + "\n";
  dxf += "30\n0.0\n";
  dxf += "40\n" + (arc.radius / scale).toFixed(4) + "\n";
  dxf += "50\n" + startAngle.toFixed(4) + "\n";
  dxf += "51\n" + endAngle.toFixed(4) + "\n";
  return dxf;
}

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
    dxf += "0\nLINE\n";
    dxf += "8\n" + layer + "\n";
    dxf += "10\n" + (points[0].x / scale).toFixed(4) + "\n";
    dxf += "20\n" + (-points[0].y / scale).toFixed(4) + "\n";
    dxf += "30\n0.0\n";
    dxf += "11\n" + (points[1].x / scale).toFixed(4) + "\n";
    dxf += "21\n" + (-points[1].y / scale).toFixed(4) + "\n";
    dxf += "31\n0.0\n";
  } else {
    const steps = 10;
    const allPoints: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? (spline.closed ? points.length - 1 : 0) : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i === points.length - 2 ? (spline.closed ? 0 : i + 1) : i + 2];

      const cp1x = p1.x + ((p2.x - p0.x) * tension) / 3;
      const cp1y = p1.y + ((p2.y - p0.y) * tension) / 3;
      const cp2x = p2.x - ((p3.x - p1.x) * tension) / 3;
      const cp2y = p2.y - ((p3.y - p1.y) * tension) / 3;

      for (let t = 0; t <= steps; t++) {
        const tt = t / steps;
        if (i > 0 && t === 0) continue;
        const u = 1 - tt;
        allPoints.push({
          x: u * u * u * p1.x + 3 * u * u * tt * cp1x + 3 * u * tt * tt * cp2x + tt * tt * tt * p2.x,
          y: u * u * u * p1.y + 3 * u * u * tt * cp1y + 3 * u * tt * tt * cp2y + tt * tt * tt * p2.y,
        });
      }
    }

    if (spline.closed && points.length >= 3) {
      const p0 = points[points.length - 2];
      const p1 = points[points.length - 1];
      const p2 = points[0];
      const p3 = points[1];

      const cp1x = p1.x + ((p2.x - p0.x) * tension) / 3;
      const cp1y = p1.y + ((p2.y - p0.y) * tension) / 3;
      const cp2x = p2.x - ((p3.x - p1.x) * tension) / 3;
      const cp2y = p2.y - ((p3.y - p1.y) * tension) / 3;

      for (let t = 1; t <= steps; t++) {
        const tt = t / steps;
        const u = 1 - tt;
        allPoints.push({
          x: u * u * u * p1.x + 3 * u * u * tt * cp1x + 3 * u * tt * tt * cp2x + tt * tt * tt * p2.x,
          y: u * u * u * p1.y + 3 * u * u * tt * cp1y + 3 * u * tt * tt * cp2y + tt * tt * tt * p2.y,
        });
      }
    }

    for (let i = 0; i < allPoints.length - 1; i++) {
      const pt1 = allPoints[i];
      const pt2 = allPoints[i + 1];
      dxf += "0\nLINE\n";
      dxf += "8\n" + layer + "\n";
      dxf += "10\n" + (pt1.x / scale).toFixed(4) + "\n";
      dxf += "20\n" + (-pt1.y / scale).toFixed(4) + "\n";
      dxf += "30\n0.0\n";
      dxf += "11\n" + (pt2.x / scale).toFixed(4) + "\n";
      dxf += "21\n" + (-pt2.y / scale).toFixed(4) + "\n";
      dxf += "31\n0.0\n";
    }

    if (spline.closed && allPoints.length > 0) {
      const pt1 = allPoints[allPoints.length - 1];
      const pt2 = allPoints[0];
      dxf += "0\nLINE\n";
      dxf += "8\n" + layer + "\n";
      dxf += "10\n" + (pt1.x / scale).toFixed(4) + "\n";
      dxf += "20\n" + (-pt1.y / scale).toFixed(4) + "\n";
      dxf += "30\n0.0\n";
      dxf += "11\n" + (pt2.x / scale).toFixed(4) + "\n";
      dxf += "21\n" + (-pt2.y / scale).toFixed(4) + "\n";
      dxf += "31\n0.0\n";
    }
  }

  return dxf;
}

function exportRectangle(rect: Rectangle, sketch: Sketch, scale: number): string {
  const p1 = sketch.points.get(rect.p1);
  const p2 = sketch.points.get(rect.p2);
  const p3 = sketch.points.get(rect.p3);
  const p4 = sketch.points.get(rect.p4);
  if (!p1 || !p2 || !p3 || !p4) return "";

  const layer = (rect as any).isConstruction ? "CONSTRUCTION" : "0";
  const pts = [p1, p2, p3, p4].map((p) => ({
    x: (p.x / scale).toFixed(4),
    y: (-p.y / scale).toFixed(4),
  }));

  let dxf = "";
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ];
  for (const edge of edges) {
    const i = edge[0];
    const j = edge[1];
    dxf += "0\nLINE\n";
    dxf += "8\n" + layer + "\n";
    dxf += "10\n" + pts[i].x + "\n";
    dxf += "20\n" + pts[i].y + "\n";
    dxf += "30\n0.0\n";
    dxf += "11\n" + pts[j].x + "\n";
    dxf += "21\n" + pts[j].y + "\n";
    dxf += "31\n0.0\n";
  }

  return dxf;
}

function exportBezier(bezier: Bezier, sketch: Sketch, scale: number): string {
  const p1 = sketch.points.get(bezier.p1);
  const p2 = sketch.points.get(bezier.p2);
  const cp1 = sketch.points.get(bezier.cp1);
  const cp2 = sketch.points.get(bezier.cp2);
  if (!p1 || !p2 || !cp1 || !cp2) return "";

  const layer = bezier.isConstruction ? "CONSTRUCTION" : "0";
  const steps = 20;
  const allPoints: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    allPoints.push({
      x: u * u * u * p1.x + 3 * u * u * t * cp1.x + 3 * u * t * t * cp2.x + t * t * t * p2.x,
      y: u * u * u * p1.y + 3 * u * u * t * cp1.y + 3 * u * t * t * cp2.y + t * t * t * p2.y,
    });
  }

  let dxf = "";
  for (let i = 0; i < allPoints.length - 1; i++) {
    const pt1 = allPoints[i];
    const pt2 = allPoints[i + 1];
    dxf += "0\nLINE\n";
    dxf += "8\n" + layer + "\n";
    dxf += "10\n" + (pt1.x / scale).toFixed(4) + "\n";
    dxf += "20\n" + (-pt1.y / scale).toFixed(4) + "\n";
    dxf += "30\n0.0\n";
    dxf += "11\n" + (pt2.x / scale).toFixed(4) + "\n";
    dxf += "21\n" + (-pt2.y / scale).toFixed(4) + "\n";
    dxf += "31\n0.0\n";
  }

  return dxf;
}

function exportText(text: TextAnnotation, sketch: Sketch, scale: number): string {
  const position = sketch.points.get(text.position);
  if (!position) return "";

  const x = (position.x / scale).toFixed(4);
  const y = (-position.y / scale).toFixed(4);
  const height = (text.fontSize || 5).toFixed(4);
  const rotation = text.rotation || 0;

  let dxf = "0\nTEXT\n";
  dxf += "8\n0\n";
  dxf += "10\n" + x + "\n";
  dxf += "20\n" + y + "\n";
  dxf += "30\n0.0\n";
  dxf += "40\n" + height + "\n";
  dxf += "1\n" + text.content + "\n";
  if (rotation !== 0) {
    dxf += "50\n" + rotation + "\n";
  }
  const hAlign = text.alignment === "center" ? 1 : text.alignment === "right" ? 2 : 0;
  if (hAlign !== 0) {
    dxf += "72\n" + hAlign + "\n";
  }

  return dxf;
}

export default exportToDXF;
