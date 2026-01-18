// ============================================
// Hook useOffset - Gestion de l'offset de géométries
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Sketch, Line, Arc, Point, Circle as CircleType, Bezier } from "../types";
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
  setActiveTool: (tool: string) => void;
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
  const offsetLine = useCallback(
    (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      distancePx: number,
      direction: "outside" | "inside",
    ): { p1: { x: number; y: number }; p2: { x: number; y: number } } => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 0.001) return { p1, p2 };

      const sign = direction === "outside" ? 1 : -1;
      const nx = (sign * dy) / length;
      const ny = (sign * -dx) / length;

      return {
        p1: { x: p1.x + nx * distancePx, y: p1.y + ny * distancePx },
        p2: { x: p2.x + nx * distancePx, y: p2.y + ny * distancePx },
      };
    },
    [],
  );

  // Ouvrir la modale offset
  const openOffsetDialog = useCallback(() => {
    setActiveTool("offset");
    setOffsetDialog({
      open: true,
      selectedEntities: new Set(selectedEntities),
    });
  }, [selectedEntities, setActiveTool]);

  // Calculer la preview de l'offset pour toutes les entités sélectionnées
  const calculateOffsetPreviewForSelection = useCallback(
    (entities: Set<string>, dist: number, dir: "outside" | "inside"): OffsetPreviewItem[] => {
      const previews: OffsetPreviewItem[] = [];
      const distancePx = dist * sketch.scaleFactor;

      entities.forEach((entityId) => {
        const geo = sketch.geometries.get(entityId);
        if (!geo) return;

        if (geo.type === "line") {
          const line = geo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (!p1 || !p2) return;

          const offset = offsetLine(p1, p2, distancePx, dir);
          previews.push({
            type: "line",
            points: [offset.p1, offset.p2],
          });
        } else if (geo.type === "circle") {
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
    [sketch, offsetLine],
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

      // Calculer les lignes décalées
      const offsetLines: Array<{
        p1: { x: number; y: number };
        p2: { x: number; y: number };
        layerId?: string;
      }> = [];

      orderedSegs.forEach(({ seg, reversed }) => {
        const start = reversed ? seg.p2 : seg.p1;
        const end = reversed ? seg.p1 : seg.p2;
        const off = offsetLine(start, end, distancePx, offsetDirection === "outside" ? "inside" : "outside");
        offsetLines.push({ p1: off.p1, p2: off.p2, layerId: seg.layerId });
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
        for (let i = 0; i < offsetLines.length; i++) {
          const curr = offsetLines[i];
          const next = offsetLines[(i + 1) % offsetLines.length];
          const inter = computeIntersection(curr, next);
          const pt: Point = { id: generateId(), x: inter.x, y: inter.y };
          newSketch.points.set(pt.id, pt);
          newPtIds.push(pt.id);
        }

        for (let i = 0; i < offsetLines.length; i++) {
          const newLine: Line = {
            id: generateId(),
            type: "line",
            p1: newPtIds[i],
            p2: newPtIds[(i + 1) % newPtIds.length],
            layerId: offsetLines[i].layerId,
          };
          newSketch.geometries.set(newLine.id, newLine);
          createdCount++;
        }
      } else {
        const firstPt: Point = { id: generateId(), x: offsetLines[0].p1.x, y: offsetLines[0].p1.y };
        newSketch.points.set(firstPt.id, firstPt);
        newPtIds.push(firstPt.id);

        for (let i = 0; i < offsetLines.length - 1; i++) {
          const inter = computeIntersection(offsetLines[i], offsetLines[i + 1]);
          const pt: Point = { id: generateId(), x: inter.x, y: inter.y };
          newSketch.points.set(pt.id, pt);
          newPtIds.push(pt.id);
        }

        const lastLine = offsetLines[offsetLines.length - 1];
        const lastPt: Point = { id: generateId(), x: lastLine.p2.x, y: lastLine.p2.y };
        newSketch.points.set(lastPt.id, lastPt);
        newPtIds.push(lastPt.id);

        for (let i = 0; i < offsetLines.length; i++) {
          const newLine: Line = {
            id: generateId(),
            type: "line",
            p1: newPtIds[i],
            p2: newPtIds[i + 1],
            layerId: offsetLines[i].layerId,
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
  }, [offsetDialog, offsetDistance, offsetDirection, sketch, offsetLine, addToHistory, solveSketch, setSketch, setSelectedEntities]);

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
