// ============================================
// Hook useOffset - Gestion de l'offset de géométries
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import { useCallback, useEffect, useState, Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import type { Sketch, Line, Arc, Point, Circle as CircleType, Bezier, ToolType } from "../types";
import { generateId } from "../types";

// Types pour le dialogue offset
export interface OffsetDialog {
  open: boolean;
  selectedEntities: Set<string>;
}

export interface OffsetPreviewItem {
  type: "line" | "circle" | "arc";
  points?: Array<{ x: number; y: number }>;
  center?: { x: number; y: number };
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  counterClockwise?: boolean;
}

interface UseOffsetProps {
  sketch: Sketch;
  setSketch: (sketch: Sketch) => void;
  addToHistory: (sketch: Sketch, description?: string) => void;
  selectedEntities: Set<string>;
  setSelectedEntities: (entities: Set<string>) => void;
  solveSketch: (sketch: Sketch) => void;
  setActiveTool: Dispatch<SetStateAction<ToolType>>;
  offsetDistance: number;
  offsetDirection: "outside" | "inside";
}

export function useOffset({
  sketch,
  setSketch,
  addToHistory,
  selectedEntities,
  setSelectedEntities,
  solveSketch,
  setActiveTool,
  offsetDistance,
  offsetDirection,
}: UseOffsetProps) {
  // États du dialogue
  const [offsetDialog, setOffsetDialog] = useState<OffsetDialog | null>(null);
  const [offsetPreview, setOffsetPreview] = useState<OffsetPreviewItem[]>([]);

  // Trouver toutes les géométries connectées à partir d'une géométrie (BFS)
  const findConnectedGeometries = useCallback(
    (startGeoId: string): Set<string> => {
      const visited = new Set<string>();
      const queue: string[] = [startGeoId];

      // Fonction helper pour obtenir les points d'une géométrie
      const getPointsOfGeometry = (geoId: string): string[] => {
        const geo = sketch.geometries.get(geoId);
        if (!geo) return [];

        if (geo.type === "line") {
          const line = geo as Line;
          return [line.p1, line.p2];
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          return [arc.startPoint, arc.endPoint];
        } else if (geo.type === "circle") {
          return [];
        } else if (geo.type === "bezier") {
          const bezier = geo as Bezier;
          return [bezier.p1, bezier.p2];
        }
        return [];
      };

      // Fonction helper pour trouver les géométries connectées à un point
      const getGeometriesAtPoint = (pointId: string): string[] => {
        const result: string[] = [];
        sketch.geometries.forEach((geo, id) => {
          if (geo.type === "line") {
            const line = geo as Line;
            if (line.p1 === pointId || line.p2 === pointId) {
              result.push(id);
            }
          } else if (geo.type === "arc") {
            const arc = geo as Arc;
            if (arc.startPoint === pointId || arc.endPoint === pointId) {
              result.push(id);
            }
          } else if (geo.type === "bezier") {
            const bezier = geo as Bezier;
            if (bezier.p1 === pointId || bezier.p2 === pointId) {
              result.push(id);
            }
          }
        });
        return result;
      };

      // BFS pour trouver toutes les géométries connectées
      while (queue.length > 0) {
        const currentGeoId = queue.shift()!;
        if (visited.has(currentGeoId)) continue;
        visited.add(currentGeoId);

        const points = getPointsOfGeometry(currentGeoId);

        for (const pointId of points) {
          const connectedGeos = getGeometriesAtPoint(pointId);
          for (const geoId of connectedGeos) {
            if (!visited.has(geoId)) {
              queue.push(geoId);
            }
          }
        }
      }

      return visited;
    },
    [sketch.geometries],
  );

  // Calculer l'offset d'une ligne (retourne les deux points décalés)
  // Le paramètre isClockwise indique si le contour est orienté dans le sens horaire
  const offsetLineWithOrientation = useCallback(
    (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      distancePx: number,
      direction: "outside" | "inside",
      isClockwise: boolean = true,
    ): { p1: { x: number; y: number }; p2: { x: number; y: number } } => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 0.001) return { p1, p2 };

      // Pour un contour horaire: normale à droite = extérieur
      // Pour un contour anti-horaire: normale à gauche = extérieur
      let sign = direction === "outside" ? 1 : -1;
      if (!isClockwise) sign = -sign;

      // Normale perpendiculaire (à droite du vecteur direction)
      const nx = (sign * dy) / length;
      const ny = (sign * -dx) / length;

      return {
        p1: { x: p1.x + nx * distancePx, y: p1.y + ny * distancePx },
        p2: { x: p2.x + nx * distancePx, y: p2.y + ny * distancePx },
      };
    },
    [],
  );

  // Version simple sans orientation (pour compatibilité)
  const offsetLine = useCallback(
    (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      distancePx: number,
      direction: "outside" | "inside",
    ): { p1: { x: number; y: number }; p2: { x: number; y: number } } => {
      return offsetLineWithOrientation(p1, p2, distancePx, direction, true);
    },
    [offsetLineWithOrientation],
  );

  // Calculer l'orientation d'un contour (sens horaire ou anti-horaire)
  // Utilise la formule de l'aire signée (Shoelace formula)
  const isContourClockwise = useCallback((points: Array<{ x: number; y: number }>): boolean => {
    if (points.length < 3) return true;

    let signedArea = 0;
    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const next = points[(i + 1) % points.length];
      signedArea += (next.x - current.x) * (next.y + current.y);
    }

    // Aire positive = sens horaire (en coordonnées écran où Y augmente vers le bas)
    return signedArea > 0;
  }, []);

  // Ouvrir la modale offset
  const openOffsetDialog = useCallback(() => {
    setActiveTool("offset");
    setOffsetDialog({
      open: true,
      selectedEntities: new Set(selectedEntities),
    });
  }, [selectedEntities, setActiveTool]);

  // Helper: calculer l'intersection de deux lignes infinies
  const lineLineIntersection = useCallback(
    (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number },
      p4: { x: number; y: number },
    ): { x: number; y: number } | null => {
      const d1x = p2.x - p1.x;
      const d1y = p2.y - p1.y;
      const d2x = p4.x - p3.x;
      const d2y = p4.y - p3.y;

      const cross = d1x * d2y - d1y * d2x;
      if (Math.abs(cross) < 0.0001) return null; // Lignes parallèles

      const dx = p3.x - p1.x;
      const dy = p3.y - p1.y;
      const t = (dx * d2y - dy * d2x) / cross;

      return {
        x: p1.x + t * d1x,
        y: p1.y + t * d1y,
      };
    },
    [],
  );

  // Helper: ordonner les lignes en suivant le contour
  const orderLinesInContour = useCallback(
    (
      lineIds: string[],
    ): Array<{
      id: string;
      p1: { x: number; y: number };
      p2: { x: number; y: number };
      p1Id: string;
      p2Id: string;
    }> => {
      if (lineIds.length === 0) return [];

      const orderedLines: Array<{
        id: string;
        p1: { x: number; y: number };
        p2: { x: number; y: number };
        p1Id: string;
        p2Id: string;
      }> = [];
      const remaining = new Set(lineIds);

      // Commencer par la première ligne
      const firstId = lineIds[0];
      const firstGeo = sketch.geometries.get(firstId) as Line;
      if (!firstGeo) return [];

      const firstP1 = sketch.points.get(firstGeo.p1);
      const firstP2 = sketch.points.get(firstGeo.p2);
      if (!firstP1 || !firstP2) return [];

      orderedLines.push({ id: firstId, p1: firstP1, p2: firstP2, p1Id: firstGeo.p1, p2Id: firstGeo.p2 });
      remaining.delete(firstId);

      // Suivre le contour
      let currentEndPointId = firstGeo.p2;
      let iterations = 0;
      const maxIterations = lineIds.length * 2;

      while (remaining.size > 0 && iterations < maxIterations) {
        iterations++;
        let found = false;

        for (const lineId of remaining) {
          const geo = sketch.geometries.get(lineId) as Line;
          if (!geo) continue;

          const geoP1 = sketch.points.get(geo.p1);
          const geoP2 = sketch.points.get(geo.p2);
          if (!geoP1 || !geoP2) continue;

          // Vérifier si cette ligne est connectée
          if (geo.p1 === currentEndPointId) {
            orderedLines.push({ id: lineId, p1: geoP1, p2: geoP2, p1Id: geo.p1, p2Id: geo.p2 });
            currentEndPointId = geo.p2;
            remaining.delete(lineId);
            found = true;
            break;
          } else if (geo.p2 === currentEndPointId) {
            // Inverser la direction
            orderedLines.push({ id: lineId, p1: geoP2, p2: geoP1, p1Id: geo.p2, p2Id: geo.p1 });
            currentEndPointId = geo.p1;
            remaining.delete(lineId);
            found = true;
            break;
          }
        }

        if (!found) break;
      }

      return orderedLines;
    },
    [sketch.geometries, sketch.points],
  );

  // Calculer la preview de l'offset pour toutes les entités sélectionnées
  // AMÉLIORATION: Les segments se rejoignent maintenant aux coins via intersection
  const calculateOffsetPreviewForSelection = useCallback(
    (entities: Set<string>, dist: number, dir: "outside" | "inside"): OffsetPreviewItem[] => {
      const previews: OffsetPreviewItem[] = [];
      const distancePx = dist * sketch.scaleFactor;

      // Séparer les lignes des autres géométries
      const lineIds: string[] = [];
      const otherEntities: string[] = [];

      entities.forEach((entityId) => {
        const geo = sketch.geometries.get(entityId);
        if (!geo) return;
        if (geo.type === "line") {
          lineIds.push(entityId);
        } else {
          otherEntities.push(entityId);
        }
      });

      // Traiter les lignes avec intersection aux coins
      if (lineIds.length > 1) {
        const orderedLines = orderLinesInContour(lineIds);

        if (orderedLines.length > 1) {
          // Extraire les points du contour pour déterminer l'orientation
          const contourPoints = orderedLines.map((line) => line.p1);
          const clockwise = isContourClockwise(contourPoints);

          // Calculer l'offset de chaque ligne avec l'orientation correcte
          const offsetLines = orderedLines.map((line) => ({
            ...line,
            offset: offsetLineWithOrientation(line.p1, line.p2, distancePx, dir, clockwise),
          }));

          const n = offsetLines.length;

          // Calculer TOUTES les intersections d'abord
          const intersections: Array<{ x: number; y: number }> = [];
          for (let i = 0; i < n; i++) {
            const current = offsetLines[i];
            const next = offsetLines[(i + 1) % n];

            const intersection = lineLineIntersection(
              current.offset.p1,
              current.offset.p2,
              next.offset.p1,
              next.offset.p2,
            );

            // Si pas d'intersection (lignes parallèles), utiliser le point de fin
            intersections.push(intersection || current.offset.p2);
          }

          // Construire les segments en utilisant les intersections
          for (let i = 0; i < n; i++) {
            const startPoint = intersections[(i - 1 + n) % n]; // Intersection avec segment précédent
            const endPoint = intersections[i]; // Intersection avec segment suivant

            previews.push({
              type: "line",
              points: [startPoint, endPoint],
            });
          }
        } else {
          // Une seule ligne ordonnée, traiter normalement
          lineIds.forEach((entityId) => {
            const geo = sketch.geometries.get(entityId) as Line;
            const p1 = sketch.points.get(geo.p1);
            const p2 = sketch.points.get(geo.p2);
            if (!p1 || !p2) return;

            const offset = offsetLine(p1, p2, distancePx, dir);
            previews.push({
              type: "line",
              points: [offset.p1, offset.p2],
            });
          });
        }
      } else if (lineIds.length === 1) {
        // Une seule ligne
        const entityId = lineIds[0];
        const geo = sketch.geometries.get(entityId) as Line;
        const p1 = sketch.points.get(geo.p1);
        const p2 = sketch.points.get(geo.p2);
        if (p1 && p2) {
          const offset = offsetLine(p1, p2, distancePx, dir);
          previews.push({
            type: "line",
            points: [offset.p1, offset.p2],
          });
        }
      }

      // Traiter les autres géométries (cercles, arcs)
      otherEntities.forEach((entityId) => {
        const geo = sketch.geometries.get(entityId);
        if (!geo) return;

        if (geo.type === "circle") {
          const circle = geo as CircleType;
          const center = sketch.points.get(circle.center);
          if (!center) return;

          const newRadius = dir === "outside" ? circle.radius + distancePx : Math.max(1, circle.radius - distancePx);

          previews.push({
            type: "circle",
            center,
            radius: newRadius,
          });
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          const center = sketch.points.get(arc.center);
          const startPt = sketch.points.get(arc.startPoint);
          const endPt = sketch.points.get(arc.endPoint);
          if (!center || !startPt || !endPt) return;

          const newRadius = dir === "outside" ? arc.radius + distancePx : Math.max(1, arc.radius - distancePx);

          const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
          const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);

          previews.push({
            type: "arc",
            center,
            radius: newRadius,
            startAngle,
            endAngle,
            counterClockwise: arc.counterClockwise,
          });
        }
      });

      return previews;
    },
    [sketch, offsetLine, offsetLineWithOrientation, orderLinesInContour, lineLineIntersection, isContourClockwise],
  );

  // Mettre à jour la preview quand les paramètres changent
  useEffect(() => {
    if (offsetDialog?.open && offsetDialog.selectedEntities.size > 0) {
      const preview = calculateOffsetPreviewForSelection(
        offsetDialog.selectedEntities,
        offsetDistance,
        offsetDirection,
      );
      setOffsetPreview(preview);
    } else {
      setOffsetPreview([]);
    }
  }, [offsetDialog, offsetDistance, offsetDirection, calculateOffsetPreviewForSelection]);

  // Appliquer l'offset à la sélection
  const applyOffsetToSelection = useCallback(() => {
    if (!offsetDialog || offsetDialog.selectedEntities.size === 0) {
      toast.error("Sélectionnez au moins une entité");
      return;
    }

    const distancePx = offsetDistance * sketch.scaleFactor;
    const newSketch = { ...sketch };
    newSketch.points = new Map(sketch.points);
    newSketch.geometries = new Map(sketch.geometries);

    const lineIds: string[] = [];
    const circleIds: string[] = [];
    const arcIds: string[] = [];

    offsetDialog.selectedEntities.forEach((entityId) => {
      const geo = sketch.geometries.get(entityId);
      if (geo?.type === "line") lineIds.push(entityId);
      else if (geo?.type === "circle") circleIds.push(entityId);
      else if (geo?.type === "arc") arcIds.push(entityId);
    });

    let createdCount = 0;

    // Traiter les cercles
    circleIds.forEach((entityId) => {
      const circle = sketch.geometries.get(entityId) as CircleType;
      const center = sketch.points.get(circle.center);
      if (!center) return;

      const newRadius =
        offsetDirection === "outside" ? Math.max(1, circle.radius - distancePx) : circle.radius + distancePx;

      const newCircle: CircleType = {
        id: generateId(),
        type: "circle",
        center: circle.center,
        radius: newRadius,
        layerId: circle.layerId,
      };
      newSketch.geometries.set(newCircle.id, newCircle);
      createdCount++;
    });

    // Traiter les arcs
    arcIds.forEach((entityId) => {
      const arc = sketch.geometries.get(entityId) as Arc;
      const center = sketch.points.get(arc.center);
      const startPt = sketch.points.get(arc.startPoint);
      const endPt = sketch.points.get(arc.endPoint);
      if (!center || !startPt || !endPt) return;

      const newRadius = offsetDirection === "outside" ? Math.max(1, arc.radius - distancePx) : arc.radius + distancePx;

      const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
      const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);

      const newStartPt: Point = {
        id: generateId(),
        x: center.x + Math.cos(startAngle) * newRadius,
        y: center.y + Math.sin(startAngle) * newRadius,
      };
      const newEndPt: Point = {
        id: generateId(),
        x: center.x + Math.cos(endAngle) * newRadius,
        y: center.y + Math.sin(endAngle) * newRadius,
      };
      newSketch.points.set(newStartPt.id, newStartPt);
      newSketch.points.set(newEndPt.id, newEndPt);

      const newArc: Arc = {
        id: generateId(),
        type: "arc",
        center: arc.center,
        startPoint: newStartPt.id,
        endPoint: newEndPt.id,
        radius: newRadius,
        layerId: arc.layerId,
        counterClockwise: arc.counterClockwise,
      };
      newSketch.geometries.set(newArc.id, newArc);
      createdCount++;
    });

    // Traiter les lignes - avec calcul des intersections
    if (lineIds.length > 0) {
      type SegInfo = {
        id: string;
        p1Id: string;
        p2Id: string;
        p1: { x: number; y: number };
        p2: { x: number; y: number };
        layerId?: string;
      };

      const segments: SegInfo[] = [];
      lineIds.forEach((lineId) => {
        const line = sketch.geometries.get(lineId) as Line;
        const p1 = sketch.points.get(line.p1);
        const p2 = sketch.points.get(line.p2);
        if (p1 && p2) {
          segments.push({
            id: lineId,
            p1Id: line.p1,
            p2Id: line.p2,
            p1: { x: p1.x, y: p1.y },
            p2: { x: p2.x, y: p2.y },
            layerId: line.layerId,
          });
        }
      });

      // Construire un graphe point -> segments
      const pointToSegs = new Map<string, number[]>();
      segments.forEach((seg, idx) => {
        if (!pointToSegs.has(seg.p1Id)) pointToSegs.set(seg.p1Id, []);
        if (!pointToSegs.has(seg.p2Id)) pointToSegs.set(seg.p2Id, []);
        pointToSegs.get(seg.p1Id)!.push(idx);
        pointToSegs.get(seg.p2Id)!.push(idx);
      });

      // Ordonner les segments en suivant le contour
      const orderedSegs: Array<{ seg: SegInfo; reversed: boolean }> = [];
      const used = new Set<number>();

      // Trouver un point de départ
      let startIdx = 0;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const count1 = pointToSegs.get(seg.p1Id)?.length || 0;
        const count2 = pointToSegs.get(seg.p2Id)?.length || 0;
        if (count1 === 1 || count2 === 1) {
          startIdx = i;
          break;
        }
      }

      const firstSeg = segments[startIdx];
      const firstP1Count = pointToSegs.get(firstSeg.p1Id)?.length || 0;
      const startReversed = firstP1Count !== 1;
      orderedSegs.push({ seg: firstSeg, reversed: startReversed });
      used.add(startIdx);

      let currentEndPtId = startReversed ? firstSeg.p1Id : firstSeg.p2Id;

      // Suivre la chaîne
      while (orderedSegs.length < segments.length) {
        const connectedIdxs = pointToSegs.get(currentEndPtId) || [];
        let found = false;

        for (const idx of connectedIdxs) {
          if (used.has(idx)) continue;

          const seg = segments[idx];
          if (seg.p1Id === currentEndPtId) {
            orderedSegs.push({ seg, reversed: false });
            currentEndPtId = seg.p2Id;
            found = true;
          } else if (seg.p2Id === currentEndPtId) {
            orderedSegs.push({ seg, reversed: true });
            currentEndPtId = seg.p1Id;
            found = true;
          }

          if (found) {
            used.add(idx);
            break;
          }
        }

        if (!found) break;
      }

      // Extraire les points du contour pour déterminer l'orientation
      const contourPoints = orderedSegs.map(({ seg, reversed }) => (reversed ? seg.p2 : seg.p1));
      const clockwise = isContourClockwise(contourPoints);

      // Calculer les lignes décalées avec la bonne orientation
      const offsetLinesArr: Array<{
        p1: { x: number; y: number };
        p2: { x: number; y: number };
        layerId?: string;
      }> = [];

      orderedSegs.forEach(({ seg, reversed }) => {
        const start = reversed ? seg.p2 : seg.p1;
        const end = reversed ? seg.p1 : seg.p2;
        const off = offsetLineWithOrientation(start, end, distancePx, offsetDirection, clockwise);
        offsetLinesArr.push({ p1: off.p1, p2: off.p2, layerId: seg.layerId });
      });

      // Vérifier si fermé
      const firstOs = orderedSegs[0];
      const lastOs = orderedSegs[orderedSegs.length - 1];
      const startPtId = firstOs.reversed ? firstOs.seg.p2Id : firstOs.seg.p1Id;
      const endPtId = lastOs.reversed ? lastOs.seg.p1Id : lastOs.seg.p2Id;
      const isClosed = startPtId === endPtId;

      // Calculer les points d'intersection entre segments adjacents
      const computeIntersection = (
        l1: { p1: { x: number; y: number }; p2: { x: number; y: number } },
        l2: { p1: { x: number; y: number }; p2: { x: number; y: number } },
      ): { x: number; y: number } => {
        const d1x = l1.p2.x - l1.p1.x;
        const d1y = l1.p2.y - l1.p1.y;
        const d2x = l2.p2.x - l2.p1.x;
        const d2y = l2.p2.y - l2.p1.y;

        const cross = d1x * d2y - d1y * d2x;
        if (Math.abs(cross) < 0.0001) {
          return {
            x: (l1.p2.x + l2.p1.x) / 2,
            y: (l1.p2.y + l2.p1.y) / 2,
          };
        }

        const t = ((l2.p1.x - l1.p1.x) * d2y - (l2.p1.y - l1.p1.y) * d2x) / cross;
        return {
          x: l1.p1.x + t * d1x,
          y: l1.p1.y + t * d1y,
        };
      };

      // Créer les nouveaux points et lignes
      const newPtIds: string[] = [];

      if (isClosed) {
        for (let i = 0; i < offsetLinesArr.length; i++) {
          const curr = offsetLinesArr[i];
          const next = offsetLinesArr[(i + 1) % offsetLinesArr.length];
          const inter = computeIntersection(curr, next);
          const pt: Point = { id: generateId(), x: inter.x, y: inter.y };
          newSketch.points.set(pt.id, pt);
          newPtIds.push(pt.id);
        }

        for (let i = 0; i < offsetLinesArr.length; i++) {
          const newLine: Line = {
            id: generateId(),
            type: "line",
            p1: newPtIds[i],
            p2: newPtIds[(i + 1) % newPtIds.length],
            layerId: offsetLinesArr[i].layerId,
          };
          newSketch.geometries.set(newLine.id, newLine);
          createdCount++;
        }
      } else {
        const firstPt: Point = { id: generateId(), x: offsetLinesArr[0].p1.x, y: offsetLinesArr[0].p1.y };
        newSketch.points.set(firstPt.id, firstPt);
        newPtIds.push(firstPt.id);

        for (let i = 0; i < offsetLinesArr.length - 1; i++) {
          const inter = computeIntersection(offsetLinesArr[i], offsetLinesArr[i + 1]);
          const pt: Point = { id: generateId(), x: inter.x, y: inter.y };
          newSketch.points.set(pt.id, pt);
          newPtIds.push(pt.id);
        }

        const lastLine = offsetLinesArr[offsetLinesArr.length - 1];
        const lastPt: Point = { id: generateId(), x: lastLine.p2.x, y: lastLine.p2.y };
        newSketch.points.set(lastPt.id, lastPt);
        newPtIds.push(lastPt.id);

        for (let i = 0; i < offsetLinesArr.length; i++) {
          const newLine: Line = {
            id: generateId(),
            type: "line",
            p1: newPtIds[i],
            p2: newPtIds[i + 1],
            layerId: offsetLinesArr[i].layerId,
          };
          newSketch.geometries.set(newLine.id, newLine);
          createdCount++;
        }
      }
    }

    if (createdCount > 0) {
      setSketch(newSketch);
      solveSketch(newSketch);
      addToHistory(newSketch, `Offset ${offsetDistance}mm`);
      toast.success(`Offset ${offsetDistance}mm créé (${createdCount} élément${createdCount > 1 ? "s" : ""})`);
    }

    setOffsetDialog(null);
    setOffsetPreview([]);
    setSelectedEntities(new Set());
  }, [
    offsetDialog,
    offsetDistance,
    offsetDirection,
    sketch,
    offsetLineWithOrientation,
    isContourClockwise,
    addToHistory,
    solveSketch,
    setSketch,
    setSelectedEntities,
  ]);

  // Ajouter/retirer une entité de la sélection offset
  const toggleOffsetSelection = useCallback(
    (entityId: string) => {
      if (!offsetDialog) return;

      const newSelection = new Set(offsetDialog.selectedEntities);
      if (newSelection.has(entityId)) {
        newSelection.delete(entityId);
      } else {
        newSelection.add(entityId);
      }

      setOffsetDialog({
        ...offsetDialog,
        selectedEntities: newSelection,
      });
      setSelectedEntities(newSelection);
    },
    [offsetDialog, setSelectedEntities],
  );

  // Sélectionner tout le contour connecté pour l'offset
  const selectContourForOffset = useCallback(
    (startEntityId: string) => {
      const connectedGeos = findConnectedGeometries(startEntityId);

      if (offsetDialog) {
        setOffsetDialog({
          ...offsetDialog,
          selectedEntities: connectedGeos,
        });
      }
      setSelectedEntities(connectedGeos);
    },
    [offsetDialog, findConnectedGeometries, setSelectedEntities],
  );

  return {
    // États
    offsetDialog,
    setOffsetDialog,
    offsetPreview,
    setOffsetPreview,

    // Fonctions
    findConnectedGeometries,
    offsetLine,
    openOffsetDialog,
    calculateOffsetPreviewForSelection,
    applyOffsetToSelection,
    toggleOffsetSelection,
    selectContourForOffset,
  };
}
