// ============================================
// EXPORT DXF: Export au format AutoCAD R12
// Compatible Fusion 360, AutoCAD, LibreCAD
// VERSION: 3.2 - FIX sens des arcs (congés)
// ============================================
//
// CHANGELOG v3.2:
// - FIX: Sens des arcs inversé lors de l'export
// - Quand Y est inversé, le sens de l'arc doit être inversé aussi
// - Les congés s'affichent maintenant correctement dans les logiciels CAD
//
// CHANGELOG v3.1:
// - Détection des connexions par proximité (tolérance 0.5px)
// - Fusionne les points proches même s'ils ont des IDs différents
// - Résout le problème des Béziers qui se touchent sans partager de point
//
// CHANGELOG v3.0:
// - Détection automatique des contours fermés
// - Export en POLYLINE R12 pour continuité parfaite (plus compatible que LWPOLYLINE)
// - Les courbes de Bézier sont discrétisées avec points exacts
// - Fusion 360 peut maintenant extruder les contours
//
// CHANGELOG v2.6:
// - Ajout TextAnnotation
// ============================================

import { Sketch, Line, Circle as CircleType, Arc, Spline, Rectangle, Point, Bezier, TextAnnotation, Geometry } from "./types";

// Tolérance pour considérer deux points comme identiques (en pixels)
const PROXIMITY_TOLERANCE = 0.5;

// Type pour un point avec coordonnées
interface Vertex {
  x: number;
  y: number;
}

// Type pour un segment de contour (ligne ou courbe discrétisée)
interface ContourSegment {
  startPointId: string;
  endPointId: string;
  vertices: Vertex[]; // Points intermédiaires (pour Bézier/Spline)
  geometryId: string;
  isConstruction: boolean;
}

/**
 * Trouve les endpoints d'une géométrie
 */
function getGeometryEndpoints(geo: Geometry, sketch: Sketch): { startId: string; endId: string } | null {
  switch (geo.type) {
    case "line":
      return { startId: (geo as Line).p1, endId: (geo as Line).p2 };
    case "bezier":
      return { startId: (geo as Bezier).p1, endId: (geo as Bezier).p2 };
    case "arc":
      return { startId: (geo as Arc).startPoint, endId: (geo as Arc).endPoint };
    case "spline": {
      const spline = geo as Spline;
      if (spline.points.length < 2) return null;
      if (spline.closed) return null; // Spline fermée = pas d'endpoints
      return { startId: spline.points[0], endId: spline.points[spline.points.length - 1] };
    }
    default:
      return null;
  }
}

/**
 * Génère les vertices intermédiaires pour une courbe de Bézier
 */
function bezierToVertices(bezier: Bezier, sketch: Sketch, steps: number = 20): Vertex[] {
  const p1 = sketch.points.get(bezier.p1);
  const p2 = sketch.points.get(bezier.p2);
  const cp1 = sketch.points.get(bezier.cp1);
  const cp2 = sketch.points.get(bezier.cp2);
  if (!p1 || !p2 || !cp1 || !cp2) return [];

  const vertices: Vertex[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    vertices.push({
      x: u*u*u*p1.x + 3*u*u*t*cp1.x + 3*u*t*t*cp2.x + t*t*t*p2.x,
      y: u*u*u*p1.y + 3*u*u*t*cp1.y + 3*u*t*t*cp2.y + t*t*t*p2.y,
    });
  }
  return vertices;
}

/**
 * Génère les vertices intermédiaires pour une spline
 */
function splineToVertices(spline: Spline, sketch: Sketch, stepsPerSegment: number = 10): Vertex[] {
  const points: Point[] = [];
  for (const pointId of spline.points) {
    const pt = sketch.points.get(pointId);
    if (pt) points.push(pt);
  }
  if (points.length < 2) return [];

  const tension = spline.tension ?? 0.5;
  const vertices: Vertex[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? (spline.closed ? points.length - 1 : 0) : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i === points.length - 2 ? (spline.closed ? 0 : i + 1) : i + 2];

    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 3;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 3;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 3;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 3;

    for (let t = 0; t <= stepsPerSegment; t++) {
      const tt = t / stepsPerSegment;
      if (i > 0 && t === 0) continue;
      const u = 1 - tt;
      vertices.push({
        x: u*u*u*p1.x + 3*u*u*tt*cp1x + 3*u*tt*tt*cp2x + tt*tt*tt*p2.x,
        y: u*u*u*p1.y + 3*u*u*tt*cp1y + 3*u*tt*tt*cp2y + tt*tt*tt*p2.y,
      });
    }
  }

  return vertices;
}

/**
 * Génère les vertices pour un arc
 */
function arcToVertices(arc: Arc, sketch: Sketch, steps: number = 16): Vertex[] {
  const center = sketch.points.get(arc.center);
  const startPt = sketch.points.get(arc.startPoint);
  const endPt = sketch.points.get(arc.endPoint);
  if (!center || !startPt || !endPt) return [];

  let startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
  let endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);

  // Normaliser les angles
  while (startAngle < 0) startAngle += Math.PI * 2;
  while (endAngle < 0) endAngle += Math.PI * 2;

  // Déterminer le sens de parcours
  let sweep = endAngle - startAngle;
  if (arc.counterClockwise !== false) {
    // Sens anti-horaire (par défaut)
    if (sweep <= 0) sweep += Math.PI * 2;
  } else {
    // Sens horaire
    if (sweep >= 0) sweep -= Math.PI * 2;
  }

  const vertices: Vertex[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = startAngle + sweep * t;
    vertices.push({
      x: center.x + arc.radius * Math.cos(angle),
      y: center.y + arc.radius * Math.sin(angle),
    });
  }

  return vertices;
}

/**
 * Convertit une géométrie en segment de contour
 */
function geometryToSegment(geo: Geometry, sketch: Sketch): ContourSegment | null {
  const endpoints = getGeometryEndpoints(geo, sketch);
  if (!endpoints) return null;

  let vertices: Vertex[] = [];
  let isConstruction = false;

  switch (geo.type) {
    case "line": {
      const line = geo as Line;
      const p1 = sketch.points.get(line.p1);
      const p2 = sketch.points.get(line.p2);
      if (!p1 || !p2) return null;
      vertices = [{ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y }];
      isConstruction = line.isConstruction || false;
      break;
    }
    case "bezier": {
      const bezier = geo as Bezier;
      vertices = bezierToVertices(bezier, sketch, 20);
      isConstruction = bezier.isConstruction || false;
      break;
    }
    case "arc": {
      const arc = geo as Arc;
      vertices = arcToVertices(arc, sketch, 16);
      isConstruction = arc.isConstruction || false;
      break;
    }
    case "spline": {
      const spline = geo as Spline;
      vertices = splineToVertices(spline, sketch, 10);
      isConstruction = spline.isConstruction || false;
      break;
    }
    default:
      return null;
  }

  if (vertices.length < 2) return null;

  return {
    startPointId: endpoints.startId,
    endPointId: endpoints.endId,
    vertices,
    geometryId: geo.id,
    isConstruction,
  };
}

/**
 * Calcule la distance entre deux points
 */
function pointDistance(p1: Vertex, p2: Vertex): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Vérifie si deux points sont proches (même coordonnées ou presque)
 */
function arePointsClose(p1: Vertex, p2: Vertex, tolerance: number = PROXIMITY_TOLERANCE): boolean {
  return pointDistance(p1, p2) <= tolerance;
}

/**
 * Récupère les coordonnées d'un point par son ID
 */
function getPointCoords(pointId: string, sketch: Sketch): Vertex | null {
  const pt = sketch.points.get(pointId);
  return pt ? { x: pt.x, y: pt.y } : null;
}

/**
 * Détecte les contours fermés en suivant les connexions entre géométries
 * Version 3.1: Utilise la proximité des coordonnées en plus des IDs de points
 */
function detectClosedContours(sketch: Sketch): ContourSegment[][] {
  const contours: ContourSegment[][] = [];
  const usedGeoIds = new Set<string>();

  // Construire un index des géométries par point ET par coordonnées
  const geoByPoint = new Map<string, ContourSegment[]>();
  const allSegments: ContourSegment[] = [];

  // Stocker les coordonnées des endpoints pour chaque segment
  const segmentEndpoints = new Map<string, { start: Vertex; end: Vertex }>();

  sketch.geometries.forEach((geo) => {
    // Ignorer les cercles, rectangles, textes (pas de contours chaînés)
    if (geo.type === "circle" || geo.type === "rectangle" || geo.type === "text") return;
    // Ignorer les splines fermées (elles forment leur propre contour)
    if (geo.type === "spline" && (geo as Spline).closed) return;

    const segment = geometryToSegment(geo, sketch);
    if (!segment) return;

    allSegments.push(segment);

    // Stocker les coordonnées des endpoints
    const startCoords = getPointCoords(segment.startPointId, sketch);
    const endCoords = getPointCoords(segment.endPointId, sketch);
    if (startCoords && endCoords) {
      segmentEndpoints.set(segment.geometryId, { start: startCoords, end: endCoords });
    }

    // Indexer par les deux endpoints (par ID)
    if (!geoByPoint.has(segment.startPointId)) {
      geoByPoint.set(segment.startPointId, []);
    }
    geoByPoint.get(segment.startPointId)!.push(segment);

    if (!geoByPoint.has(segment.endPointId)) {
      geoByPoint.set(segment.endPointId, []);
    }
    geoByPoint.get(segment.endPointId)!.push(segment);
  });

  /**
   * Trouve les segments connectés à un point donné
   * Cherche par ID ET par proximité de coordonnées
   */
  function findConnectedSegments(pointId: string, excludeGeoId: string): Array<{ segment: ContourSegment; connectsAtStart: boolean }> {
    const results: Array<{ segment: ContourSegment; connectsAtStart: boolean }> = [];
    const currentCoords = getPointCoords(pointId, sketch);

    // 1. Chercher par ID de point (méthode originale)
    const byId = geoByPoint.get(pointId) || [];
    for (const seg of byId) {
      if (seg.geometryId === excludeGeoId || usedGeoIds.has(seg.geometryId)) continue;

      if (seg.startPointId === pointId) {
        results.push({ segment: seg, connectsAtStart: true });
      } else if (seg.endPointId === pointId) {
        results.push({ segment: seg, connectsAtStart: false });
      }
    }

    // 2. Chercher par proximité de coordonnées (nouveau)
    if (currentCoords) {
      for (const seg of allSegments) {
        if (seg.geometryId === excludeGeoId || usedGeoIds.has(seg.geometryId)) continue;
        // Éviter les doublons (déjà trouvés par ID)
        if (results.some(r => r.segment.geometryId === seg.geometryId)) continue;

        const endpoints = segmentEndpoints.get(seg.geometryId);
        if (!endpoints) continue;

        // Vérifier si le start ou end de ce segment est proche de notre point
        if (arePointsClose(currentCoords, endpoints.start)) {
          results.push({ segment: seg, connectsAtStart: true });
        } else if (arePointsClose(currentCoords, endpoints.end)) {
          results.push({ segment: seg, connectsAtStart: false });
        }
      }
    }

    return results;
  }

  /**
   * Vérifie si deux points sont connectés (par ID ou par proximité)
   */
  function arePointsConnected(pointId1: string, pointId2: string): boolean {
    if (pointId1 === pointId2) return true;

    const coords1 = getPointCoords(pointId1, sketch);
    const coords2 = getPointCoords(pointId2, sketch);

    if (coords1 && coords2) {
      return arePointsClose(coords1, coords2);
    }

    return false;
  }

  // Pour chaque segment non utilisé, essayer de construire un contour fermé
  for (const startSegment of allSegments) {
    if (usedGeoIds.has(startSegment.geometryId)) continue;

    const contour: ContourSegment[] = [startSegment];
    usedGeoIds.add(startSegment.geometryId);

    let currentPointId = startSegment.endPointId;
    const startPointId = startSegment.startPointId;
    let maxIterations = 1000;
    let lastGeoId = startSegment.geometryId;

    while (!arePointsConnected(currentPointId, startPointId) && maxIterations-- > 0) {
      // Chercher le prochain segment connecté (par ID ou proximité)
      const candidates = findConnectedSegments(currentPointId, lastGeoId);
      let foundNext = false;

      for (const { segment: candidate, connectsAtStart } of candidates) {
        if (usedGeoIds.has(candidate.geometryId)) continue;

        if (connectsAtStart) {
          // Le segment se connecte par son start
          contour.push(candidate);
          usedGeoIds.add(candidate.geometryId);
          currentPointId = candidate.endPointId;
          lastGeoId = candidate.geometryId;
          foundNext = true;
          break;
        } else {
          // Le segment se connecte par son end, il faut l'inverser
          const reversed: ContourSegment = {
            ...candidate,
            startPointId: candidate.endPointId,
            endPointId: candidate.startPointId,
            vertices: [...candidate.vertices].reverse(),
          };
          contour.push(reversed);
          usedGeoIds.add(candidate.geometryId);
          currentPointId = reversed.endPointId;
          lastGeoId = candidate.geometryId;
          foundNext = true;
          break;
        }
      }

      if (!foundNext) break; // Pas de suite, contour ouvert
    }

    // Vérifier si le contour est fermé (par ID ou par proximité)
    if (arePointsConnected(currentPointId, startPointId) && contour.length >= 2) {
      contours.push(contour);
    } else {
      // Contour non fermé, remettre les segments comme non utilisés
      // pour qu'ils soient exportés individuellement
      for (const seg of contour) {
        usedGeoIds.delete(seg.geometryId);
      }
    }
  }

  return contours;
}

/**
 * Fusionne les vertices d'un contour en assurant la continuité parfaite
 * Version 3.1: Utilise le point de connexion exact entre segments adjacents
 */
function mergeContourVertices(contour: ContourSegment[], sketch: Sketch): Vertex[] {
  if (contour.length === 0) return [];

  const allVertices: Vertex[] = [];

  for (let i = 0; i < contour.length; i++) {
    const segment = contour[i];
    const nextSegment = contour[(i + 1) % contour.length];

    // Ajouter tous les vertices sauf le dernier
    for (let j = 0; j < segment.vertices.length - 1; j++) {
      allVertices.push(segment.vertices[j]);
    }

    // Pour le point de connexion, calculer le point moyen entre:
    // - Le dernier vertex du segment courant
    // - Le premier vertex du segment suivant
    // Cela garantit la continuité même si les points ne sont pas exactement identiques
    const lastVertex = segment.vertices[segment.vertices.length - 1];
    const firstNextVertex = nextSegment.vertices[0];

    // Utiliser le point moyen pour une connexion parfaite
    const connectionPoint: Vertex = {
      x: (lastVertex.x + firstNextVertex.x) / 2,
      y: (lastVertex.y + firstNextVertex.y) / 2,
    };

    // Si les points sont très proches, utiliser directement le point du sketch
    const connectionPointFromSketch = sketch.points.get(segment.endPointId);
    if (connectionPointFromSketch) {
      const sketchVertex = { x: connectionPointFromSketch.x, y: connectionPointFromSketch.y };
      // Vérifier si le point du sketch est proche du point calculé
      if (arePointsClose(sketchVertex, lastVertex, 1.0)) {
        allVertices.push(sketchVertex);
      } else {
        // Sinon utiliser le point moyen
        allVertices.push(connectionPoint);
      }
    } else {
      allVertices.push(connectionPoint);
    }
  }

  // Retirer le dernier vertex car il est identique au premier (contour fermé)
  if (allVertices.length > 1) {
    allVertices.pop();
  }

  return allVertices;
}

/**
 * Exporte un contour fermé en POLYLINE (format R12 - plus compatible que LWPOLYLINE)
 */
function exportClosedContour(vertices: Vertex[], scale: number, layer: string): string {
  if (vertices.length < 3) return "";

  let dxf = "";

  // Entité POLYLINE (début)
  dxf += "0\nPOLYLINE\n";
  dxf += "8\n" + layer + "\n";
  dxf += "66\n1\n"; // Vertices follow flag
  dxf += "70\n1\n"; // Flag: 1 = closed polyline
  dxf += "10\n0.0\n"; // Dummy point (required)
  dxf += "20\n0.0\n";
  dxf += "30\n0.0\n";

  // Vertices
  for (const v of vertices) {
    dxf += "0\nVERTEX\n";
    dxf += "8\n" + layer + "\n";
    dxf += "10\n" + (v.x / scale).toFixed(6) + "\n";
    dxf += "20\n" + (-v.y / scale).toFixed(6) + "\n";
    dxf += "30\n0.0\n";
  }

  // Fin de la polyline
  dxf += "0\nSEQEND\n";
  dxf += "8\n" + layer + "\n";

  return dxf;
}

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
  dxf += "1\nAC1009\n"; // AutoCAD R12 - format le plus compatible
  dxf += "9\n$INSUNITS\n";
  dxf += "70\n4\n"; // 4 = millimètres
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
  dxf += "70\n3\n";

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

  dxf += "0\nLAYER\n";
  dxf += "2\nCONTOUR\n";
  dxf += "70\n0\n";
  dxf += "62\n5\n"; // Bleu
  dxf += "6\nCONTINUOUS\n";

  dxf += "0\nENDTAB\n";
  dxf += "0\nENDSEC\n";

  // Section ENTITIES
  dxf += "0\nSECTION\n";
  dxf += "2\nENTITIES\n";

  // 1. Détecter et exporter les contours fermés
  const closedContours = detectClosedContours(sketch);
  const usedGeoIds = new Set<string>();

  for (const contour of closedContours) {
    // Vérifier si le contour contient des lignes de construction
    const isConstruction = contour.some(seg => seg.isConstruction);
    const layer = isConstruction ? "CONSTRUCTION" : "CONTOUR";

    const vertices = mergeContourVertices(contour, sketch);
    dxf += exportClosedContour(vertices, scale, layer);

    // Marquer les géométries comme utilisées
    for (const seg of contour) {
      usedGeoIds.add(seg.geometryId);
    }
  }

  // 2. Exporter les géométries non incluses dans les contours fermés
  sketch.geometries.forEach((geo) => {
    if (usedGeoIds.has(geo.id)) return; // Déjà exporté dans un contour

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
  dxf += "10\n" + (p1.x / scale).toFixed(6) + "\n";
  dxf += "20\n" + (-p1.y / scale).toFixed(6) + "\n";
  dxf += "30\n0.0\n";
  dxf += "11\n" + (p2.x / scale).toFixed(6) + "\n";
  dxf += "21\n" + (-p2.y / scale).toFixed(6) + "\n";
  dxf += "31\n0.0\n";
  return dxf;
}

function exportCircle(circle: CircleType, sketch: Sketch, scale: number): string {
  const center = sketch.points.get(circle.center);
  if (!center) return "";

  let dxf = "0\nCIRCLE\n";
  dxf += "8\n0\n";
  dxf += "10\n" + (center.x / scale).toFixed(6) + "\n";
  dxf += "20\n" + (-center.y / scale).toFixed(6) + "\n";
  dxf += "30\n0.0\n";
  dxf += "40\n" + (circle.radius / scale).toFixed(6) + "\n";
  return dxf;
}

function exportArc(arc: Arc, sketch: Sketch, scale: number): string {
  const center = sketch.points.get(arc.center);
  const startPt = sketch.points.get(arc.startPoint);
  const endPt = sketch.points.get(arc.endPoint);
  if (!center || !startPt || !endPt) return "";

  // v3.2: FIX - Calculer les angles dans le système DXF (Y inversé)
  let startAngle = (Math.atan2(-(startPt.y - center.y), startPt.x - center.x) * 180) / Math.PI;
  let endAngle = (Math.atan2(-(endPt.y - center.y), endPt.x - center.x) * 180) / Math.PI;

  // v3.2: FIX - Quand on inverse Y pour le DXF, le sens de l'arc est automatiquement inversé
  // Donc si l'arc était counterClockwise dans le canvas, il faut swap les angles
  // pour qu'il reste dans le bon sens dans le DXF
  if (arc.counterClockwise !== false) {
    // Arc anti-horaire dans le canvas → swap pour corriger l'inversion Y
    const temp = startAngle;
    startAngle = endAngle;
    endAngle = temp;
  }

  while (startAngle < 0) startAngle += 360;
  while (endAngle < 0) endAngle += 360;

  const layer = arc.isConstruction ? "CONSTRUCTION" : "0";
  let dxf = "0\nARC\n";
  dxf += "8\n" + layer + "\n";
  dxf += "10\n" + (center.x / scale).toFixed(6) + "\n";
  dxf += "20\n" + (-center.y / scale).toFixed(6) + "\n";
  dxf += "30\n0.0\n";
  dxf += "40\n" + (arc.radius / scale).toFixed(6) + "\n";
  dxf += "50\n" + startAngle.toFixed(6) + "\n";
  dxf += "51\n" + endAngle.toFixed(6) + "\n";
  return dxf;
}

function exportSpline(spline: Spline, sketch: Sketch, scale: number): string {
  const points: Point[] = [];
  for (const pointId of spline.points) {
    const pt = sketch.points.get(pointId);
    if (pt) points.push(pt);
  }
  if (points.length < 2) return "";

  const layer = spline.isConstruction ? "CONSTRUCTION" : "0";

  // Pour les splines fermées, exporter en POLYLINE
  if (spline.closed) {
    const vertices = splineToVertices(spline, sketch, 10);

    // Ajouter le segment de fermeture
    const tension = spline.tension ?? 0.5;
    const p0 = points[points.length - 2];
    const p1 = points[points.length - 1];
    const p2 = points[0];
    const p3 = points[1];

    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 3;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 3;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 3;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 3;

    for (let t = 1; t <= 10; t++) {
      const tt = t / 10;
      const u = 1 - tt;
      vertices.push({
        x: u*u*u*p1.x + 3*u*u*tt*cp1x + 3*u*tt*tt*cp2x + tt*tt*tt*p2.x,
        y: u*u*u*p1.y + 3*u*u*tt*cp1y + 3*u*tt*tt*cp2y + tt*tt*tt*p2.y,
      });
    }

    return exportClosedContour(vertices, scale, layer);
  }

  // Spline ouverte: exporter en segments
  const vertices = splineToVertices(spline, sketch, 10);
  let dxf = "";

  for (let i = 0; i < vertices.length - 1; i++) {
    const pt1 = vertices[i];
    const pt2 = vertices[i + 1];
    dxf += "0\nLINE\n";
    dxf += "8\n" + layer + "\n";
    dxf += "10\n" + (pt1.x / scale).toFixed(6) + "\n";
    dxf += "20\n" + (-pt1.y / scale).toFixed(6) + "\n";
    dxf += "30\n0.0\n";
    dxf += "11\n" + (pt2.x / scale).toFixed(6) + "\n";
    dxf += "21\n" + (-pt2.y / scale).toFixed(6) + "\n";
    dxf += "31\n0.0\n";
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
  const vertices = [p1, p2, p3, p4];

  // Exporter en POLYLINE fermée (format R12)
  return exportClosedContour(vertices, scale, layer);
}

function exportBezier(bezier: Bezier, sketch: Sketch, scale: number): string {
  const vertices = bezierToVertices(bezier, sketch, 20);
  if (vertices.length < 2) return "";

  const layer = bezier.isConstruction ? "CONSTRUCTION" : "0";
  let dxf = "";

  for (let i = 0; i < vertices.length - 1; i++) {
    const pt1 = vertices[i];
    const pt2 = vertices[i + 1];
    dxf += "0\nLINE\n";
    dxf += "8\n" + layer + "\n";
    dxf += "10\n" + (pt1.x / scale).toFixed(6) + "\n";
    dxf += "20\n" + (-pt1.y / scale).toFixed(6) + "\n";
    dxf += "30\n0.0\n";
    dxf += "11\n" + (pt2.x / scale).toFixed(6) + "\n";
    dxf += "21\n" + (-pt2.y / scale).toFixed(6) + "\n";
    dxf += "31\n0.0\n";
  }

  return dxf;
}

function exportText(text: TextAnnotation, sketch: Sketch, scale: number): string {
  const position = sketch.points.get(text.position);
  if (!position) return "";

  const x = (position.x / scale).toFixed(6);
  const y = (-position.y / scale).toFixed(6);
  const height = (text.fontSize || 5).toFixed(6);
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
