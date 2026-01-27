// ============================================
// HOOK: useModificationTools
// VERSION: 1.0
// Description: Gestion des outils de modification (fillet, chamfer, offset)
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { Sketch, Point, Line, Arc, Geometry } from "./types";
import { generateId } from "./types";

// ============================================
// TYPES
// ============================================

export interface OffsetPreviewItem {
  type: "line" | "circle" | "arc";
  points?: Array<{ x: number; y: number }>;
  center?: { x: number; y: number };
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  counterClockwise?: boolean;
}

export interface FilletPreviewItem {
  type: "arc";
  center: { x: number; y: number };
  radius: number;
  startAngle: number;
  endAngle: number;
  counterClockwise: boolean;
  tan1: { x: number; y: number };
  tan2: { x: number; y: number };
}

export interface ChamferPreviewItem {
  type: "line";
  p1: { x: number; y: number };
  p2: { x: number; y: number };
}

export interface FilletCorner {
  pointId: string;
  maxRadius: number;
  angleDeg: number;
  radius: number;
  dist1: number;
  dist2: number;
  maxDist1: number;
  maxDist2: number;
  line1Id: string;
  line2Id: string;
}

export interface FilletDialogState {
  open: boolean;
  corners: FilletCorner[];
  globalRadius: number;
  minMaxRadius: number;
  hoveredCornerIdx: number | null;
  asymmetric: boolean;
  addDimension: boolean;
  repeatMode: boolean;
}

export interface ChamferCorner {
  pointId: string;
  maxDistance: number;
  angleDeg: number;
  distance: number;
  dist1: number;
  dist2: number;
  maxDist1: number;
  maxDist2: number;
  line1Id: string;
  line2Id: string;
}

export interface ChamferDialogState {
  open: boolean;
  corners: ChamferCorner[];
  globalDistance: number;
  minMaxDistance: number;
  hoveredCornerIdx: number | null;
  asymmetric: boolean;
  addDimension: boolean;
  repeatMode: boolean;
}

export interface OffsetDialogState {
  open: boolean;
  selectedEntities: Set<string>;
}

export interface SharedPointResult {
  sharedPointId: string;
  line1OtherId: string;
  line2OtherId: string;
  needsMerge?: { point1Id: string; point2Id: string };
}

export interface FilletGeometry {
  center: { x: number; y: number };
  radius: number;
  startAngle: number;
  endAngle: number;
  counterClockwise: boolean;
  tan1: { x: number; y: number };
  tan2: { x: number; y: number };
}

export interface ChamferGeometry {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
}

export interface UseModificationToolsProps {
  sketch: Sketch;
  setSketch: React.Dispatch<React.SetStateAction<Sketch>>;
  addToHistory: (newSketch: Sketch, description?: string) => void;
  defaultStrokeWidth: number;
  defaultStrokeColor: string;
  closeAllEditPanels?: () => void;
}

export interface UseModificationToolsReturn {
  // États offset
  offsetDialog: OffsetDialogState | null;
  setOffsetDialog: React.Dispatch<React.SetStateAction<OffsetDialogState | null>>;
  offsetPanelPos: { x: number; y: number };
  setOffsetPanelPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  offsetDistance: number;
  setOffsetDistance: React.Dispatch<React.SetStateAction<number>>;
  offsetDirection: "inside" | "outside";
  setOffsetDirection: React.Dispatch<React.SetStateAction<"inside" | "outside">>;
  offsetPreview: OffsetPreviewItem[];
  setOffsetPreview: React.Dispatch<React.SetStateAction<OffsetPreviewItem[]>>;

  // États fillet
  filletDialog: FilletDialogState | null;
  setFilletDialog: React.Dispatch<React.SetStateAction<FilletDialogState | null>>;
  filletPanelPos: { x: number; y: number };
  setFilletPanelPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  filletRadius: number;
  setFilletRadius: React.Dispatch<React.SetStateAction<number>>;
  filletFirstLine: string | null;
  setFilletFirstLine: React.Dispatch<React.SetStateAction<string | null>>;
  filletPreview: FilletPreviewItem[];
  setFilletPreview: React.Dispatch<React.SetStateAction<FilletPreviewItem[]>>;

  // États chamfer
  chamferDialog: ChamferDialogState | null;
  setChamferDialog: React.Dispatch<React.SetStateAction<ChamferDialogState | null>>;
  chamferPanelPos: { x: number; y: number };
  setChamferPanelPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  chamferDistance: number;
  setChamferDistance: React.Dispatch<React.SetStateAction<number>>;
  chamferFirstLine: string | null;
  setChamferFirstLine: React.Dispatch<React.SetStateAction<string | null>>;
  chamferPreview: ChamferPreviewItem[];
  setChamferPreview: React.Dispatch<React.SetStateAction<ChamferPreviewItem[]>>;

  // Fonctions helper
  findSharedPoint: (line1: Line, line2: Line) => SharedPointResult | null;
  findLinesConnectedToPoint: (pointId: string, excludeConstruction?: boolean) => Line[];

  // Fonctions de calcul géométrique
  calculateFilletGeometry: (pointId: string, radiusMm: number) => FilletGeometry | null;
  calculateChamferGeometry: (pointId: string, distanceMm: number, dist1Mm?: number, dist2Mm?: number) => ChamferGeometry | null;
  calculateCornerParams: (pointId: string) => { maxRadius: number; maxDist1: number; maxDist2: number; angleDeg: number; line1Id: string; line2Id: string } | null;

  // Fonctions d'application
  applyFilletToSketch: (inputSketch: Sketch, line1Id: string, line2Id: string, radius: number, silent?: boolean) => Sketch | null;
  applyChamferToSketch: (inputSketch: Sketch, line1Id: string, line2Id: string, dist: number, silent?: boolean, dist1?: number, dist2?: number) => Sketch | null;
  applyFillet: (line1Id: string, line2Id: string, radius: number) => void;
  applyChamfer: (line1Id: string, line2Id: string, dist: number) => void;
  applyFilletFromDialog: () => void;
  applyChamferFromDialog: () => void;
  applyOffset: () => void;

  // Fonctions d'ouverture des dialogs
  openFilletDialog: (pointIds: string | string[]) => void;
  openChamferDialog: (pointIds: string | string[]) => void;

  // Offset functions
  offsetLine: (p1: { x: number; y: number }, p2: { x: number; y: number }, distance: number, direction: "inside" | "outside") => { p1: { x: number; y: number }; p2: { x: number; y: number } };
}

// ============================================
// HOOK
// ============================================

export function useModificationTools({
  sketch,
  setSketch,
  addToHistory,
  defaultStrokeWidth,
  defaultStrokeColor,
  closeAllEditPanels,
}: UseModificationToolsProps): UseModificationToolsReturn {
  
  // === États Offset ===
  const [offsetDialog, setOffsetDialog] = useState<OffsetDialogState | null>(null);
  const [offsetPanelPos, setOffsetPanelPos] = useState({ x: 100, y: 100 });
  const [offsetDistance, setOffsetDistance] = useState(10);
  const [offsetDirection, setOffsetDirection] = useState<"inside" | "outside">("outside");
  const [offsetPreview, setOffsetPreview] = useState<OffsetPreviewItem[]>([]);

  // === États Fillet ===
  const [filletDialog, setFilletDialog] = useState<FilletDialogState | null>(null);
  const [filletPanelPos, setFilletPanelPos] = useState({ x: 100, y: 100 });
  const [filletRadius, setFilletRadius] = useState(5);
  const [filletFirstLine, setFilletFirstLine] = useState<string | null>(null);
  const [filletPreview, setFilletPreview] = useState<FilletPreviewItem[]>([]);

  // === États Chamfer ===
  const [chamferDialog, setChamferDialog] = useState<ChamferDialogState | null>(null);
  const [chamferPanelPos, setChamferPanelPos] = useState({ x: 100, y: 150 });
  const [chamferDistance, setChamferDistance] = useState(5);
  const [chamferFirstLine, setChamferFirstLine] = useState<string | null>(null);
  const [chamferPreview, setChamferPreview] = useState<ChamferPreviewItem[]>([]);

  // === Refs pour éviter les stale closures ===
  const sketchRef = useRef(sketch);
  useEffect(() => {
    sketchRef.current = sketch;
  }, [sketch]);

  // === Fonctions Helper ===

  const findLinesConnectedToPoint = useCallback(
    (pointId: string, excludeConstruction: boolean = true): Line[] => {
      const lines: Line[] = [];
      sketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const line = geo as Line;
          if (excludeConstruction && line.isConstruction) {
            return;
          }
          if (line.p1 === pointId || line.p2 === pointId) {
            lines.push(line);
          }
        }
      });
      return lines;
    },
    [sketch.geometries],
  );

  const findSharedPoint = useCallback(
    (line1: Line, line2: Line): SharedPointResult | null => {
      // D'abord vérifier si les lignes partagent le même point (ID identique)
      if (line1.p1 === line2.p1) return { sharedPointId: line1.p1, line1OtherId: line1.p2, line2OtherId: line2.p2 };
      if (line1.p1 === line2.p2) return { sharedPointId: line1.p1, line1OtherId: line1.p2, line2OtherId: line2.p1 };
      if (line1.p2 === line2.p1) return { sharedPointId: line1.p2, line1OtherId: line1.p1, line2OtherId: line2.p2 };
      if (line1.p2 === line2.p2) return { sharedPointId: line1.p2, line1OtherId: line1.p1, line2OtherId: line2.p1 };

      // Sinon, vérifier si des extrémités sont aux mêmes coordonnées
      const tolerance = 0.5;
      const p1_1 = sketch.points.get(line1.p1);
      const p1_2 = sketch.points.get(line1.p2);
      const p2_1 = sketch.points.get(line2.p1);
      const p2_2 = sketch.points.get(line2.p2);

      if (!p1_1 || !p1_2 || !p2_1 || !p2_2) return null;

      const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

      if (dist(p1_1, p2_1) < tolerance) {
        return {
          sharedPointId: line1.p1,
          line1OtherId: line1.p2,
          line2OtherId: line2.p2,
          needsMerge: { point1Id: line1.p1, point2Id: line2.p1 },
        };
      }
      if (dist(p1_1, p2_2) < tolerance) {
        return {
          sharedPointId: line1.p1,
          line1OtherId: line1.p2,
          line2OtherId: line2.p1,
          needsMerge: { point1Id: line1.p1, point2Id: line2.p2 },
        };
      }
      if (dist(p1_2, p2_1) < tolerance) {
        return {
          sharedPointId: line1.p2,
          line1OtherId: line1.p1,
          line2OtherId: line2.p2,
          needsMerge: { point1Id: line1.p2, point2Id: line2.p1 },
        };
      }
      if (dist(p1_2, p2_2) < tolerance) {
        return {
          sharedPointId: line1.p2,
          line1OtherId: line1.p1,
          line2OtherId: line2.p1,
          needsMerge: { point1Id: line1.p2, point2Id: line2.p2 },
        };
      }

      return null;
    },
    [sketch.points],
  );

  // === Fonctions de calcul géométrique ===

  const calculateCornerParams = useCallback(
    (pointId: string): { maxRadius: number; maxDist1: number; maxDist2: number; angleDeg: number; line1Id: string; line2Id: string } | null => {
      const connectedLines = findLinesConnectedToPoint(pointId);
      if (connectedLines.length !== 2) return null;

      const line1 = connectedLines[0];
      const line2 = connectedLines[1];

      const cornerPt = sketch.points.get(pointId);
      const endPt1 = sketch.points.get(line1.p1 === pointId ? line1.p2 : line1.p1);
      const endPt2 = sketch.points.get(line2.p1 === pointId ? line2.p2 : line2.p1);

      if (!cornerPt || !endPt1 || !endPt2) return null;

      const vec1 = { x: endPt1.x - cornerPt.x, y: endPt1.y - cornerPt.y };
      const vec2 = { x: endPt2.x - cornerPt.x, y: endPt2.y - cornerPt.y };

      const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

      if (len1 < 0.001 || len2 < 0.001) return null;

      const u1 = { x: vec1.x / len1, y: vec1.y / len1 };
      const u2 = { x: vec2.x / len2, y: vec2.y / len2 };

      const dot = u1.x * u2.x + u1.y * u2.y;
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
      const angleDeg = (angleRad * 180) / Math.PI;

      if (angleRad < 0.05 || angleRad > Math.PI - 0.05) return null;

      const halfAngle = angleRad / 2;
      const minLen = Math.min(len1, len2);

      // Max radius calculation
      const maxTangentDist = minLen * 0.95;
      const maxRadius = maxTangentDist * Math.tan(halfAngle) / sketch.scaleFactor;

      // Max distances for asymmetric
      const maxDist1 = (len1 * 0.95) / sketch.scaleFactor;
      const maxDist2 = (len2 * 0.95) / sketch.scaleFactor;

      return { maxRadius, maxDist1, maxDist2, angleDeg, line1Id: line1.id, line2Id: line2.id };
    },
    [sketch.points, sketch.scaleFactor, findLinesConnectedToPoint],
  );

  const calculateFilletGeometry = useCallback(
    (pointId: string, radiusMm: number): FilletGeometry | null => {
      const connectedLines = findLinesConnectedToPoint(pointId);
      if (connectedLines.length !== 2) return null;

      const line1 = connectedLines[0];
      const line2 = connectedLines[1];

      const cornerPt = sketch.points.get(pointId);
      const endPt1 = sketch.points.get(line1.p1 === pointId ? line1.p2 : line1.p1);
      const endPt2 = sketch.points.get(line2.p1 === pointId ? line2.p2 : line2.p1);

      if (!cornerPt || !endPt1 || !endPt2) return null;

      const vec1 = { x: endPt1.x - cornerPt.x, y: endPt1.y - cornerPt.y };
      const vec2 = { x: endPt2.x - cornerPt.x, y: endPt2.y - cornerPt.y };

      const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

      if (len1 < 0.001 || len2 < 0.001) return null;

      const u1 = { x: vec1.x / len1, y: vec1.y / len1 };
      const u2 = { x: vec2.x / len2, y: vec2.y / len2 };

      const dot = u1.x * u2.x + u1.y * u2.y;
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));

      if (angleRad < 0.05 || angleRad > Math.PI - 0.05) return null;

      const radiusPx = radiusMm * sketch.scaleFactor;
      const halfAngle = angleRad / 2;
      const tangentDist = radiusPx / Math.tan(halfAngle);

      if (tangentDist > len1 * 0.95 || tangentDist > len2 * 0.95) return null;

      const tan1 = { x: cornerPt.x + u1.x * tangentDist, y: cornerPt.y + u1.y * tangentDist };
      const tan2 = { x: cornerPt.x + u2.x * tangentDist, y: cornerPt.y + u2.y * tangentDist };

      const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
      const bisectorLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);

      if (bisectorLen < 0.001) return null;

      const bisectorUnit = { x: bisector.x / bisectorLen, y: bisector.y / bisectorLen };
      const centerDist = radiusPx / Math.sin(halfAngle);
      const center = {
        x: cornerPt.x + bisectorUnit.x * centerDist,
        y: cornerPt.y + bisectorUnit.y * centerDist,
      };

      const startAngle = Math.atan2(tan1.y - center.y, tan1.x - center.x);
      const endAngle = Math.atan2(tan2.y - center.y, tan2.x - center.x);

      const cross = u1.x * u2.y - u1.y * u2.x;
      const counterClockwise = cross > 0;

      return {
        center,
        radius: radiusPx,
        startAngle,
        endAngle,
        counterClockwise,
        tan1,
        tan2,
      };
    },
    [sketch.points, sketch.scaleFactor, findLinesConnectedToPoint],
  );

  const calculateChamferGeometry = useCallback(
    (pointId: string, distanceMm: number, dist1Mm?: number, dist2Mm?: number): ChamferGeometry | null => {
      const connectedLines = findLinesConnectedToPoint(pointId);
      if (connectedLines.length !== 2) return null;

      const line1 = connectedLines[0];
      const line2 = connectedLines[1];

      const cornerPt = sketch.points.get(pointId);
      const endPt1 = sketch.points.get(line1.p1 === pointId ? line1.p2 : line1.p1);
      const endPt2 = sketch.points.get(line2.p1 === pointId ? line2.p2 : line2.p1);

      if (!cornerPt || !endPt1 || !endPt2) return null;

      const vec1 = { x: endPt1.x - cornerPt.x, y: endPt1.y - cornerPt.y };
      const vec2 = { x: endPt2.x - cornerPt.x, y: endPt2.y - cornerPt.y };

      const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

      if (len1 < 0.001 || len2 < 0.001) return null;

      const d1Mm = dist1Mm !== undefined ? dist1Mm : distanceMm;
      const d2Mm = dist2Mm !== undefined ? dist2Mm : distanceMm;

      const dist1Px = d1Mm * sketch.scaleFactor;
      const dist2Px = d2Mm * sketch.scaleFactor;

      if (dist1Px > len1 * 0.95 || dist2Px > len2 * 0.95) return null;

      const u1 = { x: vec1.x / len1, y: vec1.y / len1 };
      const u2 = { x: vec2.x / len2, y: vec2.y / len2 };

      const p1 = { x: cornerPt.x + u1.x * dist1Px, y: cornerPt.y + u1.y * dist1Px };
      const p2 = { x: cornerPt.x + u2.x * dist2Px, y: cornerPt.y + u2.y * dist2Px };

      return { p1, p2 };
    },
    [sketch.points, sketch.scaleFactor, findLinesConnectedToPoint],
  );

  // === Offset function ===
  const offsetLine = useCallback(
    (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      distance: number,
      direction: "inside" | "outside"
    ): { p1: { x: number; y: number }; p2: { x: number; y: number } } => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      
      if (len < 0.001) {
        return { p1: { ...p1 }, p2: { ...p2 } };
      }

      // Perpendiculaire normalisée
      let nx = -dy / len;
      let ny = dx / len;

      // Inverser si direction = outside
      if (direction === "outside") {
        nx = -nx;
        ny = -ny;
      }

      return {
        p1: { x: p1.x + nx * distance, y: p1.y + ny * distance },
        p2: { x: p2.x + nx * distance, y: p2.y + ny * distance },
      };
    },
    [],
  );

  // === Fonctions d'application ===

  const applyFilletToSketch = useCallback(
    (inputSketch: Sketch, line1Id: string, line2Id: string, radius: number, silent: boolean = false): Sketch | null => {
      let currentLine1 = inputSketch.geometries.get(line1Id) as Line | undefined;
      let currentLine2 = inputSketch.geometries.get(line2Id) as Line | undefined;

      if (!currentLine1 || !currentLine2 || currentLine1.type !== "line" || currentLine2.type !== "line") {
        if (!silent) toast.error("Sélectionnez deux lignes");
        return null;
      }

      const shared = findSharedPoint(currentLine1, currentLine2);
      if (!shared) {
        if (!silent) toast.error("Les lignes doivent partager un point commun");
        return null;
      }

      const newSketch = {
        ...inputSketch,
        points: new Map(inputSketch.points),
        geometries: new Map(inputSketch.geometries),
      };

      // Si les points sont proches mais pas le même, fusionner
      if (shared.needsMerge) {
        const { point1Id, point2Id } = shared.needsMerge;
        const line2Geo = newSketch.geometries.get(line2Id) as Line;
        if (line2Geo) {
          if (line2Geo.p1 === point2Id) {
            newSketch.geometries.set(line2Id, { ...line2Geo, p1: point1Id });
          } else if (line2Geo.p2 === point2Id) {
            newSketch.geometries.set(line2Id, { ...line2Geo, p2: point1Id });
          }
        }
        newSketch.points.delete(point2Id);
        currentLine1 = newSketch.geometries.get(line1Id) as Line;
        currentLine2 = newSketch.geometries.get(line2Id) as Line;
      }

      const cornerPt = newSketch.points.get(shared.sharedPointId);
      const endPt1 = newSketch.points.get(shared.line1OtherId);
      const endPt2 = newSketch.points.get(shared.line2OtherId);

      if (!cornerPt || !endPt1 || !endPt2) return null;

      const vec1 = { x: endPt1.x - cornerPt.x, y: endPt1.y - cornerPt.y };
      const vec2 = { x: endPt2.x - cornerPt.x, y: endPt2.y - cornerPt.y };

      const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

      if (len1 < 0.001 || len2 < 0.001) {
        if (!silent) toast.error("Lignes trop courtes");
        return null;
      }

      const u1 = { x: vec1.x / len1, y: vec1.y / len1 };
      const u2 = { x: vec2.x / len2, y: vec2.y / len2 };

      const dot = u1.x * u2.x + u1.y * u2.y;
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));

      if (angleRad < 0.05 || angleRad > Math.PI - 0.05) {
        if (!silent) toast.error("Angle trop faible pour un congé");
        return null;
      }

      const halfAngle = angleRad / 2;
      const tangentDist = radius / Math.tan(halfAngle);

      if (tangentDist > len1 * 0.95 || tangentDist > len2 * 0.95) {
        if (!silent) toast.error("Rayon trop grand");
        return null;
      }

      const tan1 = { x: cornerPt.x + u1.x * tangentDist, y: cornerPt.y + u1.y * tangentDist };
      const tan2 = { x: cornerPt.x + u2.x * tangentDist, y: cornerPt.y + u2.y * tangentDist };

      const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
      const bisectorLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);

      if (bisectorLen < 0.001) {
        if (!silent) toast.error("Lignes parallèles");
        return null;
      }

      const bisectorNorm = { x: bisector.x / bisectorLen, y: bisector.y / bisectorLen };
      const centerDist = radius / Math.sin(halfAngle);

      const centerA = {
        x: cornerPt.x + bisectorNorm.x * centerDist,
        y: cornerPt.y + bisectorNorm.y * centerDist,
      };
      const centerB = {
        x: cornerPt.x - bisectorNorm.x * centerDist,
        y: cornerPt.y - bisectorNorm.y * centerDist,
      };

      const distAToTan1 = Math.sqrt((centerA.x - tan1.x) ** 2 + (centerA.y - tan1.y) ** 2);
      const distAToTan2 = Math.sqrt((centerA.x - tan2.x) ** 2 + (centerA.y - tan2.y) ** 2);
      const distBToTan1 = Math.sqrt((centerB.x - tan1.x) ** 2 + (centerB.y - tan1.y) ** 2);
      const distBToTan2 = Math.sqrt((centerB.x - tan2.x) ** 2 + (centerB.y - tan2.y) ** 2);

      const errorA = Math.abs(distAToTan1 - radius) + Math.abs(distAToTan2 - radius);
      const errorB = Math.abs(distBToTan1 - radius) + Math.abs(distBToTan2 - radius);

      const arcCenter = errorA < errorB ? centerA : centerB;

      const tan1Id = generateId();
      const tan2Id = generateId();
      const centerId = generateId();

      newSketch.points.set(tan1Id, { id: tan1Id, x: tan1.x, y: tan1.y });
      newSketch.points.set(tan2Id, { id: tan2Id, x: tan2.x, y: tan2.y });
      newSketch.points.set(centerId, { id: centerId, x: arcCenter.x, y: arcCenter.y });

      const updatedLine1: Line = {
        ...currentLine1,
        p1: currentLine1.p1 === shared.sharedPointId ? tan1Id : currentLine1.p1,
        p2: currentLine1.p2 === shared.sharedPointId ? tan1Id : currentLine1.p2,
      };

      const updatedLine2: Line = {
        ...currentLine2,
        p1: currentLine2.p1 === shared.sharedPointId ? tan2Id : currentLine2.p1,
        p2: currentLine2.p2 === shared.sharedPointId ? tan2Id : currentLine2.p2,
      };

      newSketch.geometries.set(line1Id, updatedLine1);
      newSketch.geometries.set(line2Id, updatedLine2);

      const cross = u1.x * u2.y - u1.y * u2.x;
      const counterClockwise = cross > 0;

      const arcId = generateId();
      const arc: Arc = {
        id: arcId,
        type: "arc",
        center: centerId,
        startPoint: tan1Id,
        endPoint: tan2Id,
        radius: radius,
        layerId: currentLine1.layerId || "trace",
        counterClockwise: counterClockwise,
        isFillet: true,
        strokeWidth: defaultStrokeWidth,
        strokeColor: defaultStrokeColor,
      };
      newSketch.geometries.set(arcId, arc);

      let cornerStillUsed = false;
      newSketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const l = geo as Line;
          if (l.p1 === shared.sharedPointId || l.p2 === shared.sharedPointId) {
            cornerStillUsed = true;
          }
        }
      });
      if (!cornerStillUsed) {
        newSketch.points.delete(shared.sharedPointId);
      }

      return newSketch;
    },
    [findSharedPoint, defaultStrokeWidth, defaultStrokeColor],
  );

  const applyChamferToSketch = useCallback(
    (inputSketch: Sketch, line1Id: string, line2Id: string, dist: number, silent: boolean = false, dist1?: number, dist2?: number): Sketch | null => {
      let currentLine1 = inputSketch.geometries.get(line1Id) as Line | undefined;
      let currentLine2 = inputSketch.geometries.get(line2Id) as Line | undefined;

      if (!currentLine1 || !currentLine2 || currentLine1.type !== "line" || currentLine2.type !== "line") {
        if (!silent) toast.error("Sélectionnez deux lignes");
        return null;
      }

      const shared = findSharedPoint(currentLine1, currentLine2);
      if (!shared) {
        if (!silent) toast.error("Les lignes doivent partager un point commun");
        return null;
      }

      const newSketch = {
        ...inputSketch,
        points: new Map(inputSketch.points),
        geometries: new Map(inputSketch.geometries),
      };

      if (shared.needsMerge) {
        const { point1Id, point2Id } = shared.needsMerge;
        const line2Geo = newSketch.geometries.get(line2Id) as Line;
        if (line2Geo) {
          if (line2Geo.p1 === point2Id) {
            newSketch.geometries.set(line2Id, { ...line2Geo, p1: point1Id });
          } else if (line2Geo.p2 === point2Id) {
            newSketch.geometries.set(line2Id, { ...line2Geo, p2: point1Id });
          }
        }
        newSketch.points.delete(point2Id);
        currentLine1 = newSketch.geometries.get(line1Id) as Line;
        currentLine2 = newSketch.geometries.get(line2Id) as Line;
      }

      const cornerPt = newSketch.points.get(shared.sharedPointId);
      const endPt1 = newSketch.points.get(shared.line1OtherId);
      const endPt2 = newSketch.points.get(shared.line2OtherId);

      if (!cornerPt || !endPt1 || !endPt2) return null;

      const vec1 = { x: endPt1.x - cornerPt.x, y: endPt1.y - cornerPt.y };
      const vec2 = { x: endPt2.x - cornerPt.x, y: endPt2.y - cornerPt.y };

      const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

      if (len1 < 0.001 || len2 < 0.001) {
        if (!silent) toast.error("Lignes trop courtes");
        return null;
      }

      // Utiliser les distances asymétriques si fournies
      const d1 = dist1 !== undefined ? dist1 : dist;
      const d2 = dist2 !== undefined ? dist2 : dist;

      if (d1 > len1 * 0.95 || d2 > len2 * 0.95) {
        if (!silent) toast.error("Distance trop grande");
        return null;
      }

      const u1 = { x: vec1.x / len1, y: vec1.y / len1 };
      const u2 = { x: vec2.x / len2, y: vec2.y / len2 };

      const chamferPt1 = { x: cornerPt.x + u1.x * d1, y: cornerPt.y + u1.y * d1 };
      const chamferPt2 = { x: cornerPt.x + u2.x * d2, y: cornerPt.y + u2.y * d2 };

      const pt1Id = generateId();
      const pt2Id = generateId();

      newSketch.points.set(pt1Id, { id: pt1Id, x: chamferPt1.x, y: chamferPt1.y });
      newSketch.points.set(pt2Id, { id: pt2Id, x: chamferPt2.x, y: chamferPt2.y });

      const updatedLine1: Line = {
        ...currentLine1,
        p1: currentLine1.p1 === shared.sharedPointId ? pt1Id : currentLine1.p1,
        p2: currentLine1.p2 === shared.sharedPointId ? pt1Id : currentLine1.p2,
      };

      const updatedLine2: Line = {
        ...currentLine2,
        p1: currentLine2.p1 === shared.sharedPointId ? pt2Id : currentLine2.p1,
        p2: currentLine2.p2 === shared.sharedPointId ? pt2Id : currentLine2.p2,
      };

      newSketch.geometries.set(line1Id, updatedLine1);
      newSketch.geometries.set(line2Id, updatedLine2);

      const chamferLineId = generateId();
      const chamferLine: Line = {
        id: chamferLineId,
        type: "line",
        p1: pt1Id,
        p2: pt2Id,
        layerId: currentLine1.layerId || "trace",
        isChamfer: true,
        strokeWidth: defaultStrokeWidth,
        strokeColor: defaultStrokeColor,
      };
      newSketch.geometries.set(chamferLineId, chamferLine);

      let cornerStillUsed = false;
      newSketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const l = geo as Line;
          if (l.p1 === shared.sharedPointId || l.p2 === shared.sharedPointId) {
            cornerStillUsed = true;
          }
        }
      });
      if (!cornerStillUsed) {
        newSketch.points.delete(shared.sharedPointId);
      }

      return newSketch;
    },
    [findSharedPoint, defaultStrokeWidth, defaultStrokeColor],
  );

  const applyFillet = useCallback(
    (line1Id: string, line2Id: string, radius: number) => {
      const newSketch = applyFilletToSketch(sketch, line1Id, line2Id, radius, false);
      if (newSketch) {
        setSketch(newSketch);
        addToHistory(newSketch, `Congé R${radius}mm`);
        toast.success(`Congé R${radius}mm appliqué`);
      }
    },
    [sketch, applyFilletToSketch, addToHistory, setSketch],
  );

  const applyChamfer = useCallback(
    (line1Id: string, line2Id: string, dist: number) => {
      const newSketch = applyChamferToSketch(sketch, line1Id, line2Id, dist, false);
      if (newSketch) {
        setSketch(newSketch);
        addToHistory(newSketch, `Chanfrein ${dist}mm`);
        toast.success(`Chanfrein ${dist}mm appliqué`);
      }
    },
    [sketch, applyChamferToSketch, addToHistory, setSketch],
  );

  // === Fonctions d'ouverture des dialogs ===

  const openFilletDialog = useCallback(
    (pointIds: string | string[]) => {
      const ids = Array.isArray(pointIds) ? pointIds : [pointIds];
      const corners: FilletCorner[] = [];

      for (const id of ids) {
        const params = calculateCornerParams(id);
        if (params) {
          const connectedLines = findLinesConnectedToPoint(id);
          if (connectedLines.length === 2) {
            corners.push({
              pointId: id,
              maxRadius: params.maxRadius,
              angleDeg: params.angleDeg,
              radius: Math.min(filletRadius, params.maxRadius),
              dist1: Math.min(filletRadius, params.maxDist1),
              dist2: Math.min(filletRadius, params.maxDist2),
              maxDist1: params.maxDist1,
              maxDist2: params.maxDist2,
              line1Id: params.line1Id,
              line2Id: params.line2Id,
            });
          }
        }
      }

      if (corners.length === 0) {
        toast.error("Aucun coin valide sélectionné");
        return;
      }

      const minMaxRadius = Math.min(...corners.map((c) => c.maxRadius));
      const globalRadius = Math.min(filletRadius, minMaxRadius);

      // Fermer les autres panneaux
      if (closeAllEditPanels) closeAllEditPanels();

      setFilletDialog({
        open: true,
        corners: corners.map((c) => ({ ...c, radius: globalRadius })),
        globalRadius,
        minMaxRadius,
        hoveredCornerIdx: null,
        asymmetric: false,
        addDimension: false,
        repeatMode: false,
      });
    },
    [filletRadius, calculateCornerParams, findLinesConnectedToPoint, closeAllEditPanels],
  );

  const openChamferDialog = useCallback(
    (pointIds: string | string[]) => {
      const ids = Array.isArray(pointIds) ? pointIds : [pointIds];
      const corners: ChamferCorner[] = [];

      for (const id of ids) {
        const params = calculateCornerParams(id);
        if (params) {
          const connectedLines = findLinesConnectedToPoint(id);
          if (connectedLines.length === 2) {
            corners.push({
              pointId: id,
              maxDistance: Math.min(params.maxDist1, params.maxDist2),
              angleDeg: params.angleDeg,
              distance: Math.min(chamferDistance, Math.min(params.maxDist1, params.maxDist2)),
              dist1: Math.min(chamferDistance, params.maxDist1),
              dist2: Math.min(chamferDistance, params.maxDist2),
              maxDist1: params.maxDist1,
              maxDist2: params.maxDist2,
              line1Id: params.line1Id,
              line2Id: params.line2Id,
            });
          }
        }
      }

      if (corners.length === 0) {
        toast.error("Aucun coin valide sélectionné");
        return;
      }

      const minMaxDistance = Math.min(...corners.map((c) => c.maxDistance));
      const globalDistance = Math.min(chamferDistance, minMaxDistance);

      if (closeAllEditPanels) closeAllEditPanels();

      setChamferDialog({
        open: true,
        corners: corners.map((c) => ({ ...c, distance: globalDistance })),
        globalDistance,
        minMaxDistance,
        hoveredCornerIdx: null,
        asymmetric: false,
        addDimension: false,
        repeatMode: false,
      });
    },
    [chamferDistance, calculateCornerParams, findLinesConnectedToPoint, closeAllEditPanels],
  );

  // === Apply from dialog functions ===

  const applyFilletFromDialog = useCallback(() => {
    if (!filletDialog) return;

    let currentSketch = { ...sketch, points: new Map(sketch.points), geometries: new Map(sketch.geometries) };
    let successCount = 0;

    for (const corner of filletDialog.corners) {
      const radiusPx = corner.radius * sketch.scaleFactor;
      const newSketch = applyFilletToSketch(currentSketch, corner.line1Id, corner.line2Id, radiusPx, true);
      if (newSketch) {
        currentSketch = newSketch;
        successCount++;
      }
    }

    if (successCount > 0) {
      setSketch(currentSketch);
      addToHistory(currentSketch);

      if (successCount === 1) {
        toast.success(`Congé R${filletDialog.corners[0].radius}mm appliqué`);
      } else {
        toast.success(`${successCount} congés appliqués`);
      }
    }

    setFilletRadius(filletDialog.globalRadius);

    if (filletDialog.repeatMode) {
      // Garder le dialog ouvert pour répétition
    } else {
      setFilletDialog(null);
    }
  }, [filletDialog, sketch, applyFilletToSketch, addToHistory, setSketch]);

  const applyChamferFromDialog = useCallback(() => {
    if (!chamferDialog) return;

    let currentSketch = { ...sketch, points: new Map(sketch.points), geometries: new Map(sketch.geometries) };
    let successCount = 0;

    for (const corner of chamferDialog.corners) {
      const distPx = corner.distance * sketch.scaleFactor;
      const dist1Px = chamferDialog.asymmetric ? corner.dist1 * sketch.scaleFactor : undefined;
      const dist2Px = chamferDialog.asymmetric ? corner.dist2 * sketch.scaleFactor : undefined;
      
      const newSketch = applyChamferToSketch(currentSketch, corner.line1Id, corner.line2Id, distPx, true, dist1Px, dist2Px);
      if (newSketch) {
        currentSketch = newSketch;
        successCount++;
      }
    }

    if (successCount > 0) {
      setSketch(currentSketch);
      addToHistory(currentSketch);

      if (successCount === 1) {
        toast.success(`Chanfrein ${chamferDialog.corners[0].distance}mm appliqué`);
      } else {
        toast.success(`${successCount} chanfreins appliqués`);
      }
    }

    setChamferDistance(chamferDialog.globalDistance);

    if (chamferDialog.repeatMode) {
      // Garder le dialog ouvert pour répétition
    } else {
      setChamferDialog(null);
    }
  }, [chamferDialog, sketch, applyChamferToSketch, addToHistory, setSketch]);

  const applyOffset = useCallback(() => {
    if (!offsetDialog) return;
    // TODO: Implement offset application
    toast.info("Offset application - à implémenter");
  }, [offsetDialog]);

  // === Effects pour les previews ===

  useEffect(() => {
    if (!filletDialog?.open) {
      setFilletPreview([]);
      return;
    }

    const previews: FilletPreviewItem[] = [];
    for (const corner of filletDialog.corners) {
      const geom = calculateFilletGeometry(corner.pointId, corner.radius);
      if (geom) {
        previews.push({
          type: "arc",
          ...geom,
        });
      }
    }
    setFilletPreview(previews);
  }, [filletDialog, calculateFilletGeometry]);

  useEffect(() => {
    if (!chamferDialog?.open) {
      setChamferPreview([]);
      return;
    }

    const previews: ChamferPreviewItem[] = [];
    for (const corner of chamferDialog.corners) {
      let geom: ChamferGeometry | null;
      if (chamferDialog.asymmetric) {
        geom = calculateChamferGeometry(corner.pointId, corner.distance, corner.dist1, corner.dist2);
      } else {
        geom = calculateChamferGeometry(corner.pointId, corner.distance);
      }
      if (geom) {
        previews.push({
          type: "line",
          ...geom,
        });
      }
    }
    setChamferPreview(previews);
  }, [chamferDialog, calculateChamferGeometry]);

  return {
    // États offset
    offsetDialog,
    setOffsetDialog,
    offsetPanelPos,
    setOffsetPanelPos,
    offsetDistance,
    setOffsetDistance,
    offsetDirection,
    setOffsetDirection,
    offsetPreview,
    setOffsetPreview,

    // États fillet
    filletDialog,
    setFilletDialog,
    filletPanelPos,
    setFilletPanelPos,
    filletRadius,
    setFilletRadius,
    filletFirstLine,
    setFilletFirstLine,
    filletPreview,
    setFilletPreview,

    // États chamfer
    chamferDialog,
    setChamferDialog,
    chamferPanelPos,
    setChamferPanelPos,
    chamferDistance,
    setChamferDistance,
    chamferFirstLine,
    setChamferFirstLine,
    chamferPreview,
    setChamferPreview,

    // Fonctions helper
    findSharedPoint,
    findLinesConnectedToPoint,

    // Fonctions de calcul géométrique
    calculateFilletGeometry,
    calculateChamferGeometry,
    calculateCornerParams,

    // Fonctions d'application
    applyFilletToSketch,
    applyChamferToSketch,
    applyFillet,
    applyChamfer,
    applyFilletFromDialog,
    applyChamferFromDialog,
    applyOffset,

    // Fonctions d'ouverture des dialogs
    openFilletDialog,
    openChamferDialog,

    // Offset function
    offsetLine,
  };
}

export default useModificationTools;
