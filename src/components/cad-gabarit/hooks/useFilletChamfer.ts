// ============================================
// Hook useFilletChamfer - Gestion des congés et chanfreins
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// VERSION: 1.2 - Support complet des congés entre ligne et Bézier
//   - findSharedPointGeneric: trouve le point commun entre 2 géométries filletables
//   - getDirectionFromPoint: calcule la direction/tangente à partir d'un point
//   - applyFilletToSketchGeneric: applique un congé entre ligne/Bézier
//   - calculateCornerParamsGeneric: calcule les paramètres d'un coin (angle, rayon max)
// ============================================

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Sketch, Line, Arc, Point, Dimension, Bezier, Geometry } from "../types";
import { generateId, distance } from "../types";

// Type union pour les géométries qui peuvent avoir des congés
type FilletableGeometry = Line | Bezier;

// Types pour les dialogues
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

export interface FilletDialog {
  open: boolean;
  corners: FilletCorner[];
  globalRadius: number;
  minMaxRadius: number;
  hoveredCornerIdx: number | null;
  asymmetric: boolean;
  addDimension: boolean;
  repeatMode: boolean;
}

export interface ChamferDialog {
  open: boolean;
  corners: ChamferCorner[];
  globalDistance: number;
  minMaxDistance: number;
  hoveredCornerIdx: number | null;
  asymmetric: boolean;
  addDimension: boolean;
  repeatMode: boolean;
}

export interface FilletPreview {
  type: "arc";
  center: { x: number; y: number };
  radius: number;
  startAngle: number;
  endAngle: number;
  counterClockwise: boolean;
  tan1: { x: number; y: number };
  tan2: { x: number; y: number };
}

export interface ChamferPreview {
  type: "line";
  p1: { x: number; y: number };
  p2: { x: number; y: number };
}

interface UseFilletChamferProps {
  sketch: Sketch;
  setSketch: (sketch: Sketch) => void;
  addToHistory: (sketch: Sketch, description?: string) => void;
  selectedEntities: Set<string>;
  setSelectedEntities: (entities: Set<string>) => void;
  closeAllEditPanels?: (except?: string) => void;
  defaultStrokeWidth?: number;
  defaultStrokeColor?: string;
}

/**
 * Calcule la tangente d'une courbe de Bézier cubique à un paramètre t donné
 * Pour t=0: tangente au point de départ (p1)
 * Pour t=1: tangente au point d'arrivée (p2)
 */
function bezierTangent(
  p1: { x: number; y: number },
  cp1: { x: number; y: number },
  cp2: { x: number; y: number },
  p2: { x: number; y: number },
  t: number
): { x: number; y: number } {
  // Dérivée de la courbe de Bézier cubique: B'(t) = 3(1-t)²(cp1-p1) + 6(1-t)t(cp2-cp1) + 3t²(p2-cp2)
  const u = 1 - t;
  const dx = 3 * u * u * (cp1.x - p1.x) + 6 * u * t * (cp2.x - cp1.x) + 3 * t * t * (p2.x - cp2.x);
  const dy = 3 * u * u * (cp1.y - p1.y) + 6 * u * t * (cp2.y - cp1.y) + 3 * t * t * (p2.y - cp2.y);
  return { x: dx, y: dy };
}

/**
 * Obtient le vecteur direction d'une géométrie à partir d'un point donné
 * Pour une ligne: direction vers l'autre extrémité
 * Pour une Bézier: tangente au point de connexion
 */
function getDirectionFromPoint(
  geo: FilletableGeometry,
  pointId: string,
  points: Map<string, Point>
): { x: number; y: number; otherPointId: string } | null {
  if (geo.type === "line") {
    const line = geo as Line;
    const isP1 = line.p1 === pointId;
    const otherPointId = isP1 ? line.p2 : line.p1;
    const cornerPt = points.get(pointId);
    const otherPt = points.get(otherPointId);
    if (!cornerPt || !otherPt) return null;

    return {
      x: otherPt.x - cornerPt.x,
      y: otherPt.y - cornerPt.y,
      otherPointId,
    };
  } else if (geo.type === "bezier") {
    const bezier = geo as Bezier;
    const isP1 = bezier.p1 === pointId;
    const otherPointId = isP1 ? bezier.p2 : bezier.p1;

    const p1 = points.get(bezier.p1);
    const p2 = points.get(bezier.p2);
    const cp1 = points.get(bezier.cp1);
    const cp2 = points.get(bezier.cp2);

    if (!p1 || !p2 || !cp1 || !cp2) return null;

    // Tangente à t=0 (point p1) ou t=1 (point p2)
    const t = isP1 ? 0 : 1;
    const tangent = bezierTangent(p1, cp1, cp2, p2, t);

    // Si on est à p1, la tangente pointe vers l'intérieur de la courbe (direction positive)
    // Si on est à p2, la tangente pointe vers l'extérieur, on doit l'inverser
    if (!isP1) {
      tangent.x = -tangent.x;
      tangent.y = -tangent.y;
    }

    return {
      x: tangent.x,
      y: tangent.y,
      otherPointId,
    };
  }

  return null;
}

/**
 * Vérifie si une géométrie est "filletable" (ligne ou Bézier)
 */
function isFilletableGeometry(geo: Geometry): geo is FilletableGeometry {
  return geo.type === "line" || geo.type === "bezier";
}

/**
 * Obtient les endpoints d'une géométrie filletable
 */
function getGeometryEndpoints(geo: FilletableGeometry): { p1: string; p2: string } {
  if (geo.type === "line") {
    return { p1: (geo as Line).p1, p2: (geo as Line).p2 };
  } else {
    return { p1: (geo as Bezier).p1, p2: (geo as Bezier).p2 };
  }
}

export function useFilletChamfer({
  sketch,
  setSketch,
  addToHistory,
  selectedEntities,
  setSelectedEntities,
  closeAllEditPanels,
  defaultStrokeWidth = 1,
  defaultStrokeColor = "#000000",
}: UseFilletChamferProps) {
  // États des dialogues
  const [filletDialog, setFilletDialog] = useState<FilletDialog | null>(null);
  const [chamferDialog, setChamferDialog] = useState<ChamferDialog | null>(null);

  // États des previews
  const [filletPreview, setFilletPreview] = useState<FilletPreview[]>([]);
  const [chamferPreview, setChamferPreview] = useState<ChamferPreview[]>([]);

  // Valeurs mémorisées
  const [filletRadius, setFilletRadius] = useState(5);
  const [chamferDistance, setChamferDistance] = useState(5);

  // Trouve le point commun entre deux géométries filletables (ligne ou Bézier)
  // Retourne le point partagé et les autres extrémités
  const findSharedPointGeneric = useCallback(
    (
      geo1: FilletableGeometry,
      geo2: FilletableGeometry,
    ): {
      sharedPointId: string;
      geo1OtherId: string;
      geo2OtherId: string;
      needsMerge?: { point1Id: string; point2Id: string };
    } | null => {
      const endpoints1 = getGeometryEndpoints(geo1);
      const endpoints2 = getGeometryEndpoints(geo2);

      // D'abord vérifier si les géométries partagent le même point (ID identique)
      if (endpoints1.p1 === endpoints2.p1) return { sharedPointId: endpoints1.p1, geo1OtherId: endpoints1.p2, geo2OtherId: endpoints2.p2 };
      if (endpoints1.p1 === endpoints2.p2) return { sharedPointId: endpoints1.p1, geo1OtherId: endpoints1.p2, geo2OtherId: endpoints2.p1 };
      if (endpoints1.p2 === endpoints2.p1) return { sharedPointId: endpoints1.p2, geo1OtherId: endpoints1.p1, geo2OtherId: endpoints2.p2 };
      if (endpoints1.p2 === endpoints2.p2) return { sharedPointId: endpoints1.p2, geo1OtherId: endpoints1.p1, geo2OtherId: endpoints2.p1 };

      // Sinon, vérifier si des extrémités sont aux mêmes coordonnées
      const tolerance = 0.5; // 0.5mm de tolérance
      const p1_1 = sketch.points.get(endpoints1.p1);
      const p1_2 = sketch.points.get(endpoints1.p2);
      const p2_1 = sketch.points.get(endpoints2.p1);
      const p2_2 = sketch.points.get(endpoints2.p2);

      if (!p1_1 || !p1_2 || !p2_1 || !p2_2) return null;

      const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

      // Vérifier toutes les combinaisons de points
      if (dist(p1_1, p2_1) < tolerance) {
        return {
          sharedPointId: endpoints1.p1,
          geo1OtherId: endpoints1.p2,
          geo2OtherId: endpoints2.p2,
          needsMerge: { point1Id: endpoints1.p1, point2Id: endpoints2.p1 },
        };
      }
      if (dist(p1_1, p2_2) < tolerance) {
        return {
          sharedPointId: endpoints1.p1,
          geo1OtherId: endpoints1.p2,
          geo2OtherId: endpoints2.p1,
          needsMerge: { point1Id: endpoints1.p1, point2Id: endpoints2.p2 },
        };
      }
      if (dist(p1_2, p2_1) < tolerance) {
        return {
          sharedPointId: endpoints1.p2,
          geo1OtherId: endpoints1.p1,
          geo2OtherId: endpoints2.p2,
          needsMerge: { point1Id: endpoints1.p2, point2Id: endpoints2.p1 },
        };
      }
      if (dist(p1_2, p2_2) < tolerance) {
        return {
          sharedPointId: endpoints1.p2,
          geo1OtherId: endpoints1.p1,
          geo2OtherId: endpoints2.p1,
          needsMerge: { point1Id: endpoints1.p2, point2Id: endpoints2.p2 },
        };
      }

      return null;
    },
    [sketch.points],
  );

  // Wrapper pour compatibilité avec le code existant (2 lignes)
  const findSharedPoint = useCallback(
    (
      line1: Line,
      line2: Line,
    ): {
      sharedPointId: string;
      line1OtherId: string;
      line2OtherId: string;
      needsMerge?: { point1Id: string; point2Id: string };
    } | null => {
      const result = findSharedPointGeneric(line1, line2);
      if (!result) return null;
      return {
        sharedPointId: result.sharedPointId,
        line1OtherId: result.geo1OtherId,
        line2OtherId: result.geo2OtherId,
        needsMerge: result.needsMerge,
      };
    },
    [findSharedPointGeneric],
  );

  // Fonction interne pour appliquer un congé sur un sketch donné (retourne le nouveau sketch ou null si erreur)
  // Supporte les géométries filletables (lignes ET Béziers)
  const applyFilletToSketchGeneric = useCallback(
    (inputSketch: Sketch, geo1Id: string, geo2Id: string, radius: number, silent: boolean = false): Sketch | null => {
      let geo1 = inputSketch.geometries.get(geo1Id) as FilletableGeometry | undefined;
      let geo2 = inputSketch.geometries.get(geo2Id) as FilletableGeometry | undefined;

      if (!geo1 || !geo2 || !isFilletableGeometry(geo1) || !isFilletableGeometry(geo2)) {
        if (!silent) toast.error("Sélectionnez deux lignes ou courbes de Bézier");
        return null;
      }

      const shared = findSharedPointGeneric(geo1, geo2);
      if (!shared) {
        if (!silent) toast.error("Les géométries doivent partager un point commun");
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
        const geo2Current = newSketch.geometries.get(geo2Id) as FilletableGeometry;
        if (geo2Current) {
          const endpoints2 = getGeometryEndpoints(geo2Current);
          if (endpoints2.p1 === point2Id) {
            if (geo2Current.type === "line") {
              newSketch.geometries.set(geo2Id, { ...geo2Current, p1: point1Id } as Line);
            } else {
              newSketch.geometries.set(geo2Id, { ...geo2Current, p1: point1Id } as Bezier);
            }
          } else if (endpoints2.p2 === point2Id) {
            if (geo2Current.type === "line") {
              newSketch.geometries.set(geo2Id, { ...geo2Current, p2: point1Id } as Line);
            } else {
              newSketch.geometries.set(geo2Id, { ...geo2Current, p2: point1Id } as Bezier);
            }
          }
        }
        newSketch.points.delete(point2Id);
        geo1 = newSketch.geometries.get(geo1Id) as FilletableGeometry;
        geo2 = newSketch.geometries.get(geo2Id) as FilletableGeometry;
      }

      const cornerPt = newSketch.points.get(shared.sharedPointId);
      if (!cornerPt) return null;

      // Utiliser getDirectionFromPoint pour obtenir les vecteurs direction (supporte lignes ET Béziers)
      const dir1 = getDirectionFromPoint(geo1, shared.sharedPointId, newSketch.points);
      const dir2 = getDirectionFromPoint(geo2, shared.sharedPointId, newSketch.points);

      if (!dir1 || !dir2) {
        if (!silent) toast.error("Impossible de calculer les directions");
        return null;
      }

      const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
      const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);

      if (len1 < 0.001 || len2 < 0.001) {
        if (!silent) toast.error("Géométries trop courtes ou tangentes nulles");
        return null;
      }

      const u1 = { x: dir1.x / len1, y: dir1.y / len1 };
      const u2 = { x: dir2.x / len2, y: dir2.y / len2 };

      const dot = u1.x * u2.x + u1.y * u2.y;
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));

      if (angleRad < 0.05 || angleRad > Math.PI - 0.05) {
        if (!silent) toast.error("Angle trop faible pour un congé");
        return null;
      }

      const halfAngle = angleRad / 2;
      const tangentDist = radius / Math.tan(halfAngle);

      // Pour les Béziers, on vérifie par rapport à la distance au point de contrôle
      // Pour les lignes, par rapport à la longueur de la ligne
      const maxDist1 = geo1.type === "line" ? distance(cornerPt, newSketch.points.get(dir1.otherPointId)!) : tangentDist * 2;
      const maxDist2 = geo2.type === "line" ? distance(cornerPt, newSketch.points.get(dir2.otherPointId)!) : tangentDist * 2;

      if (tangentDist > maxDist1 * 0.95 || tangentDist > maxDist2 * 0.95) {
        if (!silent) toast.error("Rayon trop grand");
        return null;
      }

      const tan1 = { x: cornerPt.x + u1.x * tangentDist, y: cornerPt.y + u1.y * tangentDist };
      const tan2 = { x: cornerPt.x + u2.x * tangentDist, y: cornerPt.y + u2.y * tangentDist };

      // Calculer le centre du congé sur la bissectrice
      const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
      const bisectorLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);

      if (bisectorLen < 0.001) {
        if (!silent) toast.error("Géométries parallèles");
        return null;
      }

      const bisectorNorm = { x: bisector.x / bisectorLen, y: bisector.y / bisectorLen };

      // Distance du coin au centre = radius / sin(halfAngle)
      const centerDist = radius / Math.sin(halfAngle);

      // Deux centres possibles sur la bissectrice (de part et d'autre du coin)
      const centerA = {
        x: cornerPt.x + bisectorNorm.x * centerDist,
        y: cornerPt.y + bisectorNorm.y * centerDist,
      };
      const centerB = {
        x: cornerPt.x - bisectorNorm.x * centerDist,
        y: cornerPt.y - bisectorNorm.y * centerDist,
      };

      // Le bon centre est celui qui est à distance R des deux points de tangence
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

      // Mettre à jour geo1 avec le nouveau point de tangence
      const endpoints1 = getGeometryEndpoints(geo1);
      if (geo1.type === "line") {
        const updatedLine1: Line = {
          ...(geo1 as Line),
          p1: endpoints1.p1 === shared.sharedPointId ? tan1Id : endpoints1.p1,
          p2: endpoints1.p2 === shared.sharedPointId ? tan1Id : endpoints1.p2,
        };
        newSketch.geometries.set(geo1Id, updatedLine1);
      } else {
        // Pour une Bézier, on met à jour p1 ou p2
        const updatedBezier: Bezier = {
          ...(geo1 as Bezier),
          p1: endpoints1.p1 === shared.sharedPointId ? tan1Id : (geo1 as Bezier).p1,
          p2: endpoints1.p2 === shared.sharedPointId ? tan1Id : (geo1 as Bezier).p2,
        };
        newSketch.geometries.set(geo1Id, updatedBezier);
      }

      // Mettre à jour geo2 avec le nouveau point de tangence
      const endpoints2 = getGeometryEndpoints(geo2);
      if (geo2.type === "line") {
        const updatedLine2: Line = {
          ...(geo2 as Line),
          p1: endpoints2.p1 === shared.sharedPointId ? tan2Id : endpoints2.p1,
          p2: endpoints2.p2 === shared.sharedPointId ? tan2Id : endpoints2.p2,
        };
        newSketch.geometries.set(geo2Id, updatedLine2);
      } else {
        // Pour une Bézier, on met à jour p1 ou p2
        const updatedBezier: Bezier = {
          ...(geo2 as Bezier),
          p1: endpoints2.p1 === shared.sharedPointId ? tan2Id : (geo2 as Bezier).p1,
          p2: endpoints2.p2 === shared.sharedPointId ? tan2Id : (geo2 as Bezier).p2,
        };
        newSketch.geometries.set(geo2Id, updatedBezier);
      }

      // Déterminer le sens de l'arc (counterClockwise)
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
        layerId: geo1.layerId || "trace",
        counterClockwise: counterClockwise,
        isFillet: true,
        strokeWidth: defaultStrokeWidth,
        strokeColor: defaultStrokeColor,
      };
      newSketch.geometries.set(arcId, arc);

      // Vérifier si le point de coin est encore utilisé
      let cornerStillUsed = false;
      newSketch.geometries.forEach((geo) => {
        if (isFilletableGeometry(geo)) {
          const eps = getGeometryEndpoints(geo);
          if (eps.p1 === shared.sharedPointId || eps.p2 === shared.sharedPointId) {
            cornerStillUsed = true;
          }
        }
      });
      if (!cornerStillUsed) {
        newSketch.points.delete(shared.sharedPointId);
      }

      return newSketch;
    },
    [findSharedPointGeneric, defaultStrokeWidth, defaultStrokeColor],
  );

  // Wrapper pour compatibilité avec le code existant (2 lignes uniquement)
  const applyFilletToSketch = useCallback(
    (inputSketch: Sketch, line1Id: string, line2Id: string, radius: number, silent: boolean = false): Sketch | null => {
      return applyFilletToSketchGeneric(inputSketch, line1Id, line2Id, radius, silent);
    },
    [applyFilletToSketchGeneric],
  );

  // Applique un congé (fillet) entre deux lignes
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

  // Fonction interne pour appliquer un chanfrein sur un sketch donné
  const applyChamferToSketch = useCallback(
    (inputSketch: Sketch, line1Id: string, line2Id: string, dist: number, silent: boolean = false): Sketch | null => {
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

      const sharedPt = newSketch.points.get(shared.sharedPointId);
      const other1 = newSketch.points.get(shared.line1OtherId);
      const other2 = newSketch.points.get(shared.line2OtherId);

      if (!sharedPt || !other1 || !other2) return null;

      const len1 = distance(sharedPt, other1);
      const len2 = distance(sharedPt, other2);

      if (len1 < dist || len2 < dist) {
        if (!silent) toast.error("Distance trop grande pour ces lignes");
        return null;
      }

      const dir1 = { x: (other1.x - sharedPt.x) / len1, y: (other1.y - sharedPt.y) / len1 };
      const dir2 = { x: (other2.x - sharedPt.x) / len2, y: (other2.y - sharedPt.y) / len2 };

      const cham1 = { x: sharedPt.x + dir1.x * dist, y: sharedPt.y + dir1.y * dist };
      const cham2 = { x: sharedPt.x + dir2.x * dist, y: sharedPt.y + dir2.y * dist };

      const cham1Id = generateId();
      const cham2Id = generateId();

      newSketch.points.set(cham1Id, { id: cham1Id, x: cham1.x, y: cham1.y });
      newSketch.points.set(cham2Id, { id: cham2Id, x: cham2.x, y: cham2.y });

      const newLine1: Line = { ...currentLine1 };
      const newLine2: Line = { ...currentLine2 };

      if (currentLine1.p1 === shared.sharedPointId) {
        newLine1.p1 = cham1Id;
      } else {
        newLine1.p2 = cham1Id;
      }

      if (currentLine2.p1 === shared.sharedPointId) {
        newLine2.p1 = cham2Id;
      } else {
        newLine2.p2 = cham2Id;
      }

      newSketch.geometries.set(line1Id, newLine1);
      newSketch.geometries.set(line2Id, newLine2);

      const chamferLineId = generateId();
      const chamferLine: Line = {
        id: chamferLineId,
        type: "line",
        p1: cham1Id,
        p2: cham2Id,
        layerId: currentLine1.layerId || "trace",
      };
      newSketch.geometries.set(chamferLineId, chamferLine);

      let pointStillUsed = false;
      newSketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const l = geo as Line;
          if (l.p1 === shared.sharedPointId || l.p2 === shared.sharedPointId) pointStillUsed = true;
        }
      });
      if (!pointStillUsed) {
        newSketch.points.delete(shared.sharedPointId);
      }

      return newSketch;
    },
    [findSharedPoint],
  );

  // Applique un chanfrein entre deux lignes
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

  // Trouver les lignes connectées à un point (pour compatibilité)
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

  // Trouver toutes les géométries filletables (lignes ET Béziers) connectées à un point
  const findFilletableGeometriesAtPoint = useCallback(
    (pointId: string, excludeConstruction: boolean = true): FilletableGeometry[] => {
      const geometries: FilletableGeometry[] = [];
      sketch.geometries.forEach((geo) => {
        if (!isFilletableGeometry(geo)) return;

        if (excludeConstruction && geo.isConstruction) return;

        const endpoints = getGeometryEndpoints(geo);
        if (endpoints.p1 === pointId || endpoints.p2 === pointId) {
          geometries.push(geo);
        }
      });
      return geometries;
    },
    [sketch.geometries],
  );

  // Calculer les paramètres géométriques d'un coin (angle, longueurs, rayon max)
  // Supporte les lignes ET les Béziers
  const calculateCornerParamsGeneric = useCallback(
    (
      geo1Id: string,
      geo2Id: string,
    ): {
      angleDeg: number;
      maxRadius: number;
      maxDistance: number;
      len1: number;
      len2: number;
      sharedPointId: string;
    } | null => {
      const geo1 = sketch.geometries.get(geo1Id) as FilletableGeometry | undefined;
      const geo2 = sketch.geometries.get(geo2Id) as FilletableGeometry | undefined;

      if (!geo1 || !geo2 || !isFilletableGeometry(geo1) || !isFilletableGeometry(geo2)) return null;

      const shared = findSharedPointGeneric(geo1, geo2);
      if (!shared) return null;

      const cornerPt = sketch.points.get(shared.sharedPointId);
      if (!cornerPt) return null;

      // Utiliser getDirectionFromPoint pour obtenir les vecteurs (supporte lignes ET Béziers)
      const dir1 = getDirectionFromPoint(geo1, shared.sharedPointId, sketch.points);
      const dir2 = getDirectionFromPoint(geo2, shared.sharedPointId, sketch.points);

      if (!dir1 || !dir2) return null;

      const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
      const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);

      if (len1 < 0.001 || len2 < 0.001) return null;

      const u1 = { x: dir1.x / len1, y: dir1.y / len1 };
      const u2 = { x: dir2.x / len2, y: dir2.y / len2 };

      const dot = u1.x * u2.x + u1.y * u2.y;
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
      const angleDeg = (angleRad * 180) / Math.PI;

      const halfAngle = angleRad / 2;

      // Pour les lignes, len est la distance au point opposé
      // Pour les Béziers, on utilise une distance estimée basée sur la tangente
      let effectiveLen1 = len1;
      let effectiveLen2 = len2;

      if (geo1.type === "line") {
        const otherPt = sketch.points.get(dir1.otherPointId);
        if (otherPt) effectiveLen1 = distance(cornerPt, otherPt);
      } else {
        // Pour Bézier, estimer la longueur disponible (distance au premier point de contrôle)
        const bezier = geo1 as Bezier;
        const isP1 = bezier.p1 === shared.sharedPointId;
        const cpId = isP1 ? bezier.cp1 : bezier.cp2;
        const cp = sketch.points.get(cpId);
        if (cp) effectiveLen1 = distance(cornerPt, cp) * 0.8; // 80% de la distance au point de contrôle
      }

      if (geo2.type === "line") {
        const otherPt = sketch.points.get(dir2.otherPointId);
        if (otherPt) effectiveLen2 = distance(cornerPt, otherPt);
      } else {
        // Pour Bézier, estimer la longueur disponible
        const bezier = geo2 as Bezier;
        const isP1 = bezier.p1 === shared.sharedPointId;
        const cpId = isP1 ? bezier.cp1 : bezier.cp2;
        const cp = sketch.points.get(cpId);
        if (cp) effectiveLen2 = distance(cornerPt, cp) * 0.8;
      }

      const minLen = Math.min(effectiveLen1, effectiveLen2);

      const maxRadius = minLen * 0.9 * Math.tan(halfAngle);
      const maxDistance = minLen * 0.9;

      return { angleDeg, maxRadius, maxDistance, len1: effectiveLen1, len2: effectiveLen2, sharedPointId: shared.sharedPointId };
    },
    [sketch.geometries, sketch.points, findSharedPointGeneric],
  );

  // Wrapper pour compatibilité (lignes uniquement)
  const calculateCornerParams = useCallback(
    (
      line1Id: string,
      line2Id: string,
    ): {
      angleDeg: number;
      maxRadius: number;
      maxDistance: number;
      len1: number;
      len2: number;
    } | null => {
      const result = calculateCornerParamsGeneric(line1Id, line2Id);
      if (!result) return null;
      return {
        angleDeg: result.angleDeg,
        maxRadius: result.maxRadius,
        maxDistance: result.maxDistance,
        len1: result.len1,
        len2: result.len2,
      };
    },
    [calculateCornerParamsGeneric],
  );

  // Calculer la géométrie d'un congé sans l'appliquer (pour preview)
  // Supporte les lignes ET les Béziers
  const calculateFilletGeometry = useCallback(
    (pointId: string, radiusMm: number): FilletPreview | null => {
      // Utiliser findFilletableGeometriesAtPoint pour trouver lignes ET Béziers
      const connectedGeometries = findFilletableGeometriesAtPoint(pointId);
      if (connectedGeometries.length !== 2) return null;

      const geo1 = connectedGeometries[0];
      const geo2 = connectedGeometries[1];

      const cornerPt = sketch.points.get(pointId);
      if (!cornerPt) return null;

      // Utiliser getDirectionFromPoint pour obtenir les vecteurs (supporte lignes ET Béziers)
      const dir1 = getDirectionFromPoint(geo1, pointId, sketch.points);
      const dir2 = getDirectionFromPoint(geo2, pointId, sketch.points);

      if (!dir1 || !dir2) return null;

      const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
      const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);

      if (len1 < 0.001 || len2 < 0.001) return null;

      const u1 = { x: dir1.x / len1, y: dir1.y / len1 };
      const u2 = { x: dir2.x / len2, y: dir2.y / len2 };

      const dot = u1.x * u2.x + u1.y * u2.y;
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));

      if (angleRad < 0.05 || angleRad > Math.PI - 0.05) return null;

      const radiusPx = radiusMm * sketch.scaleFactor;
      const halfAngle = angleRad / 2;
      const tangentDist = radiusPx / Math.tan(halfAngle);

      // Calculer les longueurs effectives selon le type de géométrie
      let effectiveLen1 = len1;
      let effectiveLen2 = len2;

      if (geo1.type === "line") {
        const otherPt = sketch.points.get(dir1.otherPointId);
        if (otherPt) effectiveLen1 = distance(cornerPt, otherPt);
      } else {
        const bezier = geo1 as Bezier;
        const isP1 = bezier.p1 === pointId;
        const cpId = isP1 ? bezier.cp1 : bezier.cp2;
        const cp = sketch.points.get(cpId);
        if (cp) effectiveLen1 = distance(cornerPt, cp) * 0.8;
      }

      if (geo2.type === "line") {
        const otherPt = sketch.points.get(dir2.otherPointId);
        if (otherPt) effectiveLen2 = distance(cornerPt, otherPt);
      } else {
        const bezier = geo2 as Bezier;
        const isP1 = bezier.p1 === pointId;
        const cpId = isP1 ? bezier.cp1 : bezier.cp2;
        const cp = sketch.points.get(cpId);
        if (cp) effectiveLen2 = distance(cornerPt, cp) * 0.8;
      }

      if (tangentDist > effectiveLen1 * 0.95 || tangentDist > effectiveLen2 * 0.95) return null;

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
        type: "arc",
        center,
        radius: radiusPx,
        startAngle,
        endAngle,
        counterClockwise,
        tan1,
        tan2,
      };
    },
    [sketch.points, sketch.scaleFactor, findFilletableGeometriesAtPoint],
  );

  // Calculer la géométrie d'un chanfrein sans l'appliquer (pour preview)
  const calculateChamferGeometry = useCallback(
    (pointId: string, distanceMm: number, dist1Mm?: number, dist2Mm?: number): ChamferPreview | null => {
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

      return { type: "line", p1, p2 };
    },
    [sketch.points, sketch.scaleFactor, findLinesConnectedToPoint],
  );

  // Mettre à jour la preview des congés en temps réel
  useEffect(() => {
    if (!filletDialog?.open) {
      setFilletPreview([]);
      return;
    }

    const previews: FilletPreview[] = [];
    for (const corner of filletDialog.corners) {
      if (corner.radius > 0 && corner.radius <= corner.maxRadius) {
        const geom = calculateFilletGeometry(corner.pointId, corner.radius);
        if (geom) {
          previews.push(geom);
        }
      }
    }
    setFilletPreview(previews);
  }, [filletDialog, calculateFilletGeometry]);

  // Mettre à jour la preview des chanfreins en temps réel
  useEffect(() => {
    if (!chamferDialog?.open) {
      setChamferPreview([]);
      return;
    }

    const previews: ChamferPreview[] = [];
    for (const corner of chamferDialog.corners) {
      if (chamferDialog.asymmetric) {
        const valid =
          corner.dist1 > 0 && corner.dist1 <= corner.maxDist1 && corner.dist2 > 0 && corner.dist2 <= corner.maxDist2;
        if (valid) {
          const geom = calculateChamferGeometry(corner.pointId, corner.distance, corner.dist1, corner.dist2);
          if (geom) {
            previews.push(geom);
          }
        }
      } else {
        if (corner.distance > 0 && corner.distance <= corner.maxDistance) {
          const geom = calculateChamferGeometry(corner.pointId, corner.distance);
          if (geom) {
            previews.push(geom);
          }
        }
      }
    }
    setChamferPreview(previews);
  }, [chamferDialog, calculateChamferGeometry]);

  // Ouvrir le dialogue de congé pour un point spécifique (double-clic sur coin)
  // Supporte les lignes ET les Béziers
  const openFilletDialogForPoint = useCallback(
    (pointId: string) => {
      // Utiliser findFilletableGeometriesAtPoint pour trouver lignes ET Béziers
      const connectedGeometries = findFilletableGeometriesAtPoint(pointId);
      if (connectedGeometries.length !== 2) {
        toast.warning("Ce point n'est pas un coin valide (nécessite exactement 2 lignes ou courbes)");
        return;
      }

      const params = calculateCornerParamsGeneric(connectedGeometries[0].id, connectedGeometries[1].id);
      if (!params) {
        toast.error("Impossible de calculer les paramètres du coin");
        return;
      }

      const maxRadiusMm = params.maxRadius / sketch.scaleFactor;
      const len1Mm = params.len1 / sketch.scaleFactor;
      const len2Mm = params.len2 / sketch.scaleFactor;
      const suggestedRadius = Math.min(filletRadius, Math.floor(maxRadiusMm));

      closeAllEditPanels?.("fillet");

      setFilletDialog({
        open: true,
        corners: [
          {
            pointId,
            maxRadius: maxRadiusMm,
            angleDeg: params.angleDeg,
            radius: suggestedRadius > 0 ? suggestedRadius : 1,
            dist1: suggestedRadius > 0 ? suggestedRadius : 1,
            dist2: suggestedRadius > 0 ? suggestedRadius : 1,
            maxDist1: len1Mm * 0.9,
            maxDist2: len2Mm * 0.9,
            line1Id: connectedGeometries[0].id,
            line2Id: connectedGeometries[1].id,
          },
        ],
        globalRadius: suggestedRadius > 0 ? suggestedRadius : 1,
        minMaxRadius: maxRadiusMm,
        hoveredCornerIdx: null,
        asymmetric: false,
        addDimension: false,
        repeatMode: false,
      });
    },
    [sketch.scaleFactor, filletRadius, findFilletableGeometriesAtPoint, calculateCornerParamsGeneric, closeAllEditPanels],
  );

  // Ouvrir le dialogue de congé si 2 géométries filletables OU 1+ points (coins) sont sélectionnés
  // Supporte les lignes ET les Béziers
  const openFilletDialog = useCallback(() => {
    const corners: FilletCorner[] = [];
    const selectedIds = Array.from(selectedEntities);

    // Vérifier si tous les IDs sélectionnés sont des points de coin valides
    let allAreCornerPoints = true;
    for (const id of selectedIds) {
      if (!sketch.points.has(id)) {
        allAreCornerPoints = false;
        break;
      }
      // Utiliser findFilletableGeometriesAtPoint pour trouver lignes ET Béziers
      const connectedGeometries = findFilletableGeometriesAtPoint(id);
      if (connectedGeometries.length !== 2) {
        allAreCornerPoints = false;
        break;
      }
    }

    const getSuggestedRadius = (maxRadiusMm: number) => {
      return Math.min(filletRadius, Math.floor(maxRadiusMm));
    };

    if (allAreCornerPoints && selectedIds.length >= 1) {
      for (const pointId of selectedIds) {
        const connectedGeometries = findFilletableGeometriesAtPoint(pointId);
        const params = calculateCornerParamsGeneric(connectedGeometries[0].id, connectedGeometries[1].id);
        if (params) {
          const maxRadiusMm = params.maxRadius / sketch.scaleFactor;
          const len1Mm = params.len1 / sketch.scaleFactor;
          const len2Mm = params.len2 / sketch.scaleFactor;
          const suggested = getSuggestedRadius(maxRadiusMm);
          corners.push({
            pointId,
            maxRadius: maxRadiusMm,
            angleDeg: params.angleDeg,
            radius: suggested,
            dist1: suggested,
            dist2: suggested,
            maxDist1: len1Mm * 0.9,
            maxDist2: len2Mm * 0.9,
            line1Id: connectedGeometries[0].id,
            line2Id: connectedGeometries[1].id,
          });
        }
      }
    } else if (selectedEntities.size === 2) {
      const geo1 = sketch.geometries.get(selectedIds[0]);
      const geo2 = sketch.geometries.get(selectedIds[1]);

      // Supporter lignes ET Béziers
      if (geo1 && geo2 && isFilletableGeometry(geo1) && isFilletableGeometry(geo2)) {
        const shared = findSharedPointGeneric(geo1, geo2);

        if (shared) {
          const params = calculateCornerParamsGeneric(selectedIds[0], selectedIds[1]);
          if (params) {
            const maxRadiusMm = params.maxRadius / sketch.scaleFactor;
            const len1Mm = params.len1 / sketch.scaleFactor;
            const len2Mm = params.len2 / sketch.scaleFactor;
            const suggested = getSuggestedRadius(maxRadiusMm);
            corners.push({
              pointId: shared.sharedPointId,
              maxRadius: maxRadiusMm,
              angleDeg: params.angleDeg,
              radius: suggested,
              dist1: suggested,
              dist2: suggested,
              maxDist1: len1Mm * 0.9,
              maxDist2: len2Mm * 0.9,
              line1Id: selectedIds[0],
              line2Id: selectedIds[1],
            });
          }
        } else {
          toast.warning("Les géométries doivent partager un point commun (un coin)");
          return;
        }
      } else {
        toast.warning("Sélectionnez 2 lignes/courbes ou des points (coins)");
        return;
      }
    } else if (selectedEntities.size > 2) {
      // Supporter lignes ET Béziers pour sélection multiple
      const selectedFilletables: FilletableGeometry[] = [];
      for (const id of selectedIds) {
        const geo = sketch.geometries.get(id);
        if (geo && isFilletableGeometry(geo)) {
          selectedFilletables.push(geo);
        }
      }

      if (selectedFilletables.length < 2) {
        toast.warning("Sélectionnez au moins 2 lignes/courbes pour créer des congés");
        return;
      }

      const pointUsage = new Map<string, string[]>();

      selectedFilletables.forEach((geo) => {
        const endpoints = getGeometryEndpoints(geo);
        [endpoints.p1, endpoints.p2].forEach((ptId) => {
          if (!pointUsage.has(ptId)) pointUsage.set(ptId, []);
          pointUsage.get(ptId)!.push(geo.id);
        });
      });

      const cornerPointIds: string[] = [];
      pointUsage.forEach((geoIds, pointId) => {
        if (geoIds.length === 2) {
          cornerPointIds.push(pointId);
        }
      });

      if (cornerPointIds.length === 0) {
        toast.warning("Aucun coin trouvé entre les géométries sélectionnées");
        return;
      }

      for (const pointId of cornerPointIds) {
        const geoIds = pointUsage.get(pointId)!;
        const params = calculateCornerParamsGeneric(geoIds[0], geoIds[1]);
        if (params) {
          const maxRadiusMm = params.maxRadius / sketch.scaleFactor;
          const len1Mm = params.len1 / sketch.scaleFactor;
          const len2Mm = params.len2 / sketch.scaleFactor;
          const suggested = getSuggestedRadius(maxRadiusMm);
          corners.push({
            pointId,
            maxRadius: maxRadiusMm,
            angleDeg: params.angleDeg,
            radius: suggested,
            dist1: suggested,
            dist2: suggested,
            maxDist1: len1Mm * 0.9,
            maxDist2: len2Mm * 0.9,
            line1Id: geoIds[0],
            line2Id: geoIds[1],
          });
        }
      }
    } else {
      toast.warning("Sélectionnez 2 lignes/courbes, des points (coins), ou une figure complète");
      return;
    }

    if (corners.length === 0) {
      toast.error("Aucun coin valide trouvé");
      return;
    }

    const minMaxRadius = Math.min(...corners.map((c) => c.maxRadius));
    const suggestedRadius = Math.min(filletRadius, Math.floor(minMaxRadius));

    setFilletDialog({
      open: true,
      corners,
      globalRadius: suggestedRadius > 0 ? suggestedRadius : 1,
      minMaxRadius,
      hoveredCornerIdx: null,
      asymmetric: false,
      addDimension: false,
      repeatMode: false,
    });
  }, [
    selectedEntities,
    sketch.geometries,
    sketch.points,
    sketch.scaleFactor,
    findSharedPointGeneric,
    findFilletableGeometriesAtPoint,
    filletRadius,
    calculateCornerParamsGeneric,
  ]);

  // Ouvrir le dialogue de chanfrein pour un point spécifique
  const openChamferDialogForPoint = useCallback(
    (pointId: string) => {
      const connectedLines = findLinesConnectedToPoint(pointId);
      if (connectedLines.length !== 2) {
        toast.warning("Ce point n'est pas un coin valide");
        return;
      }

      const params = calculateCornerParams(connectedLines[0].id, connectedLines[1].id);
      if (!params) {
        toast.error("Impossible de calculer les paramètres du coin");
        return;
      }

      const maxDistanceMm = params.maxDistance / sketch.scaleFactor;
      const len1Mm = params.len1 / sketch.scaleFactor;
      const len2Mm = params.len2 / sketch.scaleFactor;
      const suggestedDistance = Math.min(chamferDistance, Math.floor(maxDistanceMm));

      setChamferDialog({
        open: true,
        corners: [
          {
            pointId,
            maxDistance: maxDistanceMm,
            angleDeg: params.angleDeg,
            distance: suggestedDistance > 0 ? suggestedDistance : 1,
            dist1: suggestedDistance > 0 ? suggestedDistance : 1,
            dist2: suggestedDistance > 0 ? suggestedDistance : 1,
            maxDist1: len1Mm * 0.9,
            maxDist2: len2Mm * 0.9,
            line1Id: connectedLines[0].id,
            line2Id: connectedLines[1].id,
          },
        ],
        globalDistance: suggestedDistance > 0 ? suggestedDistance : 1,
        minMaxDistance: maxDistanceMm,
        hoveredCornerIdx: null,
        asymmetric: false,
        addDimension: false,
        repeatMode: false,
      });
    },
    [sketch.scaleFactor, chamferDistance, findLinesConnectedToPoint, calculateCornerParams],
  );

  // Ouvrir le dialogue de chanfrein
  const openChamferDialog = useCallback(() => {
    const corners: ChamferCorner[] = [];
    const selectedIds = Array.from(selectedEntities);

    const getSuggestedDistance = (maxDistanceMm: number) => {
      return Math.min(chamferDistance, Math.floor(maxDistanceMm));
    };

    let allAreCornerPoints = true;
    for (const id of selectedIds) {
      if (!sketch.points.has(id)) {
        allAreCornerPoints = false;
        break;
      }
      const connectedLines = findLinesConnectedToPoint(id);
      if (connectedLines.length !== 2) {
        allAreCornerPoints = false;
        break;
      }
    }

    if (allAreCornerPoints && selectedIds.length >= 1) {
      for (const pointId of selectedIds) {
        const connectedLines = findLinesConnectedToPoint(pointId);
        const params = calculateCornerParams(connectedLines[0].id, connectedLines[1].id);
        if (params) {
          const maxDistanceMm = params.maxDistance / sketch.scaleFactor;
          const len1Mm = params.len1 / sketch.scaleFactor;
          const len2Mm = params.len2 / sketch.scaleFactor;
          const suggested = getSuggestedDistance(maxDistanceMm);
          corners.push({
            pointId,
            maxDistance: maxDistanceMm,
            angleDeg: params.angleDeg,
            distance: suggested,
            dist1: suggested,
            dist2: suggested,
            maxDist1: len1Mm * 0.9,
            maxDist2: len2Mm * 0.9,
            line1Id: connectedLines[0].id,
            line2Id: connectedLines[1].id,
          });
        }
      }
    } else if (selectedEntities.size === 2) {
      const geo1 = sketch.geometries.get(selectedIds[0]);
      const geo2 = sketch.geometries.get(selectedIds[1]);

      if (geo1 && geo2 && geo1.type === "line" && geo2.type === "line") {
        const line1 = geo1 as Line;
        const line2 = geo2 as Line;
        const shared = findSharedPoint(line1, line2);

        if (shared) {
          const params = calculateCornerParams(selectedIds[0], selectedIds[1]);
          if (params) {
            const maxDistanceMm = params.maxDistance / sketch.scaleFactor;
            const len1Mm = params.len1 / sketch.scaleFactor;
            const len2Mm = params.len2 / sketch.scaleFactor;
            const suggested = getSuggestedDistance(maxDistanceMm);
            corners.push({
              pointId: shared.sharedPointId,
              maxDistance: maxDistanceMm,
              angleDeg: params.angleDeg,
              distance: suggested,
              dist1: suggested,
              dist2: suggested,
              maxDist1: len1Mm * 0.9,
              maxDist2: len2Mm * 0.9,
              line1Id: selectedIds[0],
              line2Id: selectedIds[1],
            });
          }
        } else {
          toast.warning("Les lignes doivent partager un point commun (un coin)");
          return;
        }
      } else {
        toast.warning("Sélectionnez 2 lignes ou des points (coins)");
        return;
      }
    } else if (selectedEntities.size > 2) {
      const selectedLines: Line[] = [];
      for (const id of selectedIds) {
        const geo = sketch.geometries.get(id);
        if (geo && geo.type === "line") {
          selectedLines.push(geo as Line);
        }
      }

      if (selectedLines.length < 2) {
        toast.warning("Sélectionnez au moins 2 lignes pour créer des chanfreins");
        return;
      }

      const pointUsage = new Map<string, string[]>();

      selectedLines.forEach((line) => {
        [line.p1, line.p2].forEach((ptId) => {
          if (!pointUsage.has(ptId)) pointUsage.set(ptId, []);
          pointUsage.get(ptId)!.push(line.id);
        });
      });

      const cornerPointIds: string[] = [];
      pointUsage.forEach((lineIds, pointId) => {
        if (lineIds.length === 2) {
          cornerPointIds.push(pointId);
        }
      });

      if (cornerPointIds.length === 0) {
        toast.warning("Aucun coin trouvé entre les lignes sélectionnées");
        return;
      }

      for (const pointId of cornerPointIds) {
        const lineIds = pointUsage.get(pointId)!;
        const params = calculateCornerParams(lineIds[0], lineIds[1]);
        if (params) {
          const maxDistanceMm = params.maxDistance / sketch.scaleFactor;
          const len1Mm = params.len1 / sketch.scaleFactor;
          const len2Mm = params.len2 / sketch.scaleFactor;
          const suggested = getSuggestedDistance(maxDistanceMm);
          corners.push({
            pointId,
            maxDistance: maxDistanceMm,
            angleDeg: params.angleDeg,
            distance: suggested,
            dist1: suggested,
            dist2: suggested,
            maxDist1: len1Mm * 0.9,
            maxDist2: len2Mm * 0.9,
            line1Id: lineIds[0],
            line2Id: lineIds[1],
          });
        }
      }
    } else {
      toast.warning("Sélectionnez 2 lignes, des points (coins), ou une figure complète");
      return;
    }

    if (corners.length === 0) {
      toast.error("Aucun coin valide trouvé");
      return;
    }

    const minMaxDistance = Math.min(...corners.map((c) => c.maxDistance));
    const suggestedDistance = Math.min(chamferDistance, Math.floor(minMaxDistance));

    setChamferDialog({
      open: true,
      corners,
      globalDistance: suggestedDistance > 0 ? suggestedDistance : 1,
      minMaxDistance,
      hoveredCornerIdx: null,
      asymmetric: false,
      addDimension: false,
      repeatMode: false,
    });
  }, [
    selectedEntities,
    sketch.geometries,
    sketch.points,
    sketch.scaleFactor,
    findSharedPoint,
    findLinesConnectedToPoint,
    chamferDistance,
    calculateCornerParams,
  ]);

  // Appliquer le congé depuis la modale (sur tous les coins)
  // Supporte les lignes ET les Béziers
  const applyFilletFromDialog = useCallback(() => {
    if (!filletDialog) return;

    let currentSketch: Sketch = {
      ...sketch,
      points: new Map(sketch.points),
      geometries: new Map(sketch.geometries),
      layers: new Map(sketch.layers),
      constraints: new Map(sketch.constraints),
    };
    let successCount = 0;

    for (const corner of filletDialog.corners) {
      // Trouver les géométries filletables (lignes ET Béziers) connectées au point
      const connectedGeometries: FilletableGeometry[] = [];
      currentSketch.geometries.forEach((geo) => {
        if (isFilletableGeometry(geo) && !geo.isConstruction) {
          const endpoints = getGeometryEndpoints(geo);
          if (endpoints.p1 === corner.pointId || endpoints.p2 === corner.pointId) {
            connectedGeometries.push(geo);
          }
        }
      });

      if (connectedGeometries.length !== 2) {
        continue;
      }

      if (corner.radius <= corner.maxRadius) {
        const radiusPx = corner.radius * sketch.scaleFactor;
        const newSketch = applyFilletToSketchGeneric(
          currentSketch,
          connectedGeometries[0].id,
          connectedGeometries[1].id,
          radiusPx,
          true,
        );
        if (newSketch) {
          currentSketch = newSketch;
          successCount++;
        }
      }
    }

    if (successCount > 0) {
      if (filletDialog.addDimension) {
        const newArcs: Arc[] = [];
        currentSketch.geometries.forEach((geo) => {
          if (geo.type === "arc") {
            newArcs.push(geo as Arc);
          }
        });
        const createdArcs = newArcs.slice(-successCount);
        for (const arc of createdArcs) {
          const center = currentSketch.points.get(arc.center);
          if (center) {
            const radiusMm = arc.radius / sketch.scaleFactor;
            const dimId = generateId();
            const dimension: Dimension = {
              id: dimId,
              type: "radius",
              entities: [arc.id],
              value: radiusMm,
              position: { x: center.x + arc.radius + 20, y: center.y },
            };
            if (!currentSketch.dimensions) {
              (currentSketch as any).dimensions = new Map();
            }
            (currentSketch as any).dimensions.set(dimId, dimension);
          }
        }
      }

      setSketch(currentSketch);
      addToHistory(currentSketch);
      if (successCount === 1) {
        toast.success(`Congé R${filletDialog.corners[0].radius}mm appliqué`);
      } else {
        toast.success(`${successCount} congés appliqués`);
      }
    } else {
      toast.error("Aucun congé n'a pu être appliqué");
    }

    setFilletRadius(filletDialog.globalRadius);

    if (filletDialog.repeatMode) {
      setFilletDialog(null);
    } else {
      setFilletDialog(null);
    }
    setSelectedEntities(new Set());
  }, [filletDialog, sketch, applyFilletToSketchGeneric, addToHistory, setSketch, setSelectedEntities]);

  // Appliquer le chanfrein depuis la modale (sur tous les coins)
  const applyChamferFromDialog = useCallback(() => {
    if (!chamferDialog) return;

    let currentSketch: Sketch = {
      ...sketch,
      points: new Map(sketch.points),
      geometries: new Map(sketch.geometries),
      layers: new Map(sketch.layers),
      constraints: new Map(sketch.constraints),
    };
    let successCount = 0;

    for (const corner of chamferDialog.corners) {
      const connectedLines: Line[] = [];
      currentSketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const line = geo as Line;
          if (!line.isConstruction && (line.p1 === corner.pointId || line.p2 === corner.pointId)) {
            connectedLines.push(line);
          }
        }
      });

      if (connectedLines.length !== 2) {
        continue;
      }

      if (corner.distance <= corner.maxDistance) {
        const distancePx = corner.distance * sketch.scaleFactor;
        const newSketch = applyChamferToSketch(
          currentSketch,
          connectedLines[0].id,
          connectedLines[1].id,
          distancePx,
          true,
        );
        if (newSketch) {
          currentSketch = newSketch;
          successCount++;
        }
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
    } else {
      toast.error("Aucun chanfrein n'a pu être appliqué");
    }

    setChamferDistance(chamferDialog.globalDistance);

    if (chamferDialog.repeatMode) {
      setChamferDialog(null);
    } else {
      setChamferDialog(null);
    }
    setSelectedEntities(new Set());
  }, [chamferDialog, sketch, applyChamferToSketch, addToHistory, setSketch, setSelectedEntities]);

  // Supprimer un congé (arc) et revenir au coin original
  const removeFilletFromArc = useCallback(
    (arcId: string) => {
      const arc = sketch.geometries.get(arcId) as Arc | undefined;
      if (!arc || arc.type !== "arc") {
        toast.error("Sélectionnez un arc (congé)");
        return;
      }

      const center = sketch.points.get(arc.center);
      const startPt = sketch.points.get(arc.startPoint);
      const endPt = sketch.points.get(arc.endPoint);

      if (!center || !startPt || !endPt) {
        toast.error("Points de l'arc introuvables");
        return;
      }

      const linesAtStart: Line[] = [];
      const linesAtEnd: Line[] = [];

      sketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const line = geo as Line;
          if (line.p1 === arc.startPoint || line.p2 === arc.startPoint) {
            linesAtStart.push(line);
          }
          if (line.p1 === arc.endPoint || line.p2 === arc.endPoint) {
            linesAtEnd.push(line);
          }
        }
      });

      if (linesAtStart.length !== 1 || linesAtEnd.length !== 1) {
        toast.error("Cet arc n'est pas un congé valide");
        return;
      }

      const line1 = linesAtStart[0];
      const line2 = linesAtEnd[0];

      const line1OtherId = line1.p1 === arc.startPoint ? line1.p2 : line1.p1;
      const line1Other = sketch.points.get(line1OtherId);

      const line2OtherId = line2.p1 === arc.endPoint ? line2.p2 : line2.p1;
      const line2Other = sketch.points.get(line2OtherId);

      if (!line1Other || !line2Other) {
        toast.error("Extrémités des lignes introuvables");
        return;
      }

      const d1 = { x: startPt.x - line1Other.x, y: startPt.y - line1Other.y };
      const d2 = { x: endPt.x - line2Other.x, y: endPt.y - line2Other.y };

      const cross = d1.x * d2.y - d1.y * d2.x;
      if (Math.abs(cross) < 0.0001) {
        toast.error("Les lignes sont parallèles");
        return;
      }

      const t = ((line2Other.x - line1Other.x) * d2.y - (line2Other.y - line1Other.y) * d2.x) / cross;

      const intersection = {
        x: line1Other.x + t * d1.x,
        y: line1Other.y + t * d1.y,
      };

      const newSketch = {
        ...sketch,
        points: new Map(sketch.points),
        geometries: new Map(sketch.geometries),
      };

      const cornerPointId = generateId();
      newSketch.points.set(cornerPointId, { id: cornerPointId, x: intersection.x, y: intersection.y });

      const newLine1: Line = {
        ...line1,
        [line1.p1 === arc.startPoint ? "p1" : "p2"]: cornerPointId,
      };
      newSketch.geometries.set(line1.id, newLine1);

      const newLine2: Line = {
        ...line2,
        [line2.p1 === arc.endPoint ? "p1" : "p2"]: cornerPointId,
      };
      newSketch.geometries.set(line2.id, newLine2);

      newSketch.geometries.delete(arcId);
      newSketch.points.delete(arc.startPoint);
      newSketch.points.delete(arc.endPoint);
      newSketch.points.delete(arc.center);

      setSketch(newSketch);
      addToHistory(newSketch);
      setSelectedEntities(new Set());
      toast.success("Congé supprimé, coin restauré");
    },
    [sketch, addToHistory, setSketch, setSelectedEntities],
  );

  // Switch du panneau congé vers chanfrein (et vice versa)
  const switchFilletToChamfer = useCallback(() => {
    if (!filletDialog) return;

    const chamferCorners: ChamferCorner[] = filletDialog.corners.map((c) => ({
      pointId: c.pointId,
      maxDistance: Math.min(c.maxDist1, c.maxDist2),
      angleDeg: c.angleDeg,
      distance: c.radius,
      dist1: c.dist1,
      dist2: c.dist2,
      maxDist1: c.maxDist1,
      maxDist2: c.maxDist2,
      line1Id: c.line1Id,
      line2Id: c.line2Id,
    }));

    setFilletDialog(null);
    setChamferDialog({
      open: true,
      corners: chamferCorners,
      globalDistance: filletDialog.globalRadius,
      minMaxDistance: Math.min(...chamferCorners.map((c) => c.maxDistance)),
      hoveredCornerIdx: null,
      asymmetric: filletDialog.asymmetric,
      addDimension: filletDialog.addDimension,
      repeatMode: filletDialog.repeatMode,
    });
  }, [filletDialog]);

  const switchChamferToFillet = useCallback(() => {
    if (!chamferDialog) return;

    const filletCorners: FilletCorner[] = chamferDialog.corners.map((c) => {
      const minDist = Math.min(c.maxDist1, c.maxDist2);
      const halfAngle = (c.angleDeg * Math.PI) / 180 / 2;
      const maxRadius = minDist * Math.tan(halfAngle);

      return {
        pointId: c.pointId,
        maxRadius: maxRadius,
        angleDeg: c.angleDeg,
        radius: c.distance,
        dist1: c.dist1,
        dist2: c.dist2,
        maxDist1: c.maxDist1,
        maxDist2: c.maxDist2,
        line1Id: c.line1Id,
        line2Id: c.line2Id,
      };
    });

    setChamferDialog(null);
    setFilletDialog({
      open: true,
      corners: filletCorners,
      globalRadius: chamferDialog.globalDistance,
      minMaxRadius: Math.min(...filletCorners.map((c) => c.maxRadius)),
      hoveredCornerIdx: null,
      asymmetric: chamferDialog.asymmetric,
      addDimension: chamferDialog.addDimension,
      repeatMode: chamferDialog.repeatMode,
    });
  }, [chamferDialog]);

  return {
    // États
    filletDialog,
    setFilletDialog,
    chamferDialog,
    setChamferDialog,
    filletPreview,
    chamferPreview,
    filletRadius,
    setFilletRadius,
    chamferDistance,
    setChamferDistance,

    // Fonctions
    findSharedPoint,
    findSharedPointGeneric,
    findLinesConnectedToPoint,
    findFilletableGeometriesAtPoint,
    applyFillet,
    applyChamfer,
    applyFilletToSketch,
    applyFilletToSketchGeneric,
    applyChamferToSketch,
    calculateCornerParams,
    calculateCornerParamsGeneric,
    calculateFilletGeometry,
    calculateChamferGeometry,
    openFilletDialog,
    openFilletDialogForPoint,
    openChamferDialog,
    openChamferDialogForPoint,
    applyFilletFromDialog,
    applyChamferFromDialog,
    removeFilletFromArc,
    switchFilletToChamfer,
    switchChamferToFillet,
  };
}
