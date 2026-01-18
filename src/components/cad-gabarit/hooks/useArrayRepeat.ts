// ============================================
// Hook useArrayRepeat - Gestion de la répétition/array de géométries
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  Sketch,
  Line,
  Arc,
  Point,
  Circle as CircleType,
  Rectangle,
  Bezier,
  TextAnnotation,
  Geometry,
} from "../types";
import { generateId } from "../types";

// Type pour le dialogue de répétition
export interface ArrayDialogType {
  open: boolean;
  type: "linear" | "grid" | "circular" | "checkerboard";
  // Linéaire
  linearCount: number;
  linearSpacing: string;
  linearSpacingMode: "spacing" | "distance";
  linearDirection: "x" | "y" | "custom";
  linearAngle: string;
  // Grille
  countX: number;
  spacingX: string;
  spacingModeX: "spacing" | "distance";
  countY: number;
  spacingY: string;
  spacingModeY: "spacing" | "distance";
  // Circulaire
  circularCount: number;
  circularAngle: string;
  circularCenter: { x: number; y: number } | null;
  // Damier
  checkerCountX: string;
  checkerCountY: string;
  checkerSize: string;
  checkerColor: string;
  // Général
  includeOriginal: boolean;
  createIntersections: boolean;
}

export interface ArrayPreviewType {
  transforms: Array<{ offsetX: number; offsetY: number; rotation: number }>;
  centerX: number;
  centerY: number;
  checkerboard?: {
    countX: number;
    countY: number;
    sizePx: number;
    color: string;
  };
}

interface UseArrayRepeatProps {
  sketch: Sketch;
  setSketch: (sketch: Sketch) => void;
  addToHistory: (sketch: Sketch, description?: string) => void;
  selectedEntities: Set<string>;
  createIntersectionPoints: (geoId: string, sketchToUse: Sketch) => void;
  defaultStrokeWidthRef: React.MutableRefObject<number>;
  defaultStrokeColorRef: React.MutableRefObject<string>;
}

export function useArrayRepeat({
  sketch,
  setSketch,
  addToHistory,
  selectedEntities,
  createIntersectionPoints,
  defaultStrokeWidthRef,
  defaultStrokeColorRef,
}: UseArrayRepeatProps) {
  // États du dialogue
  const [arrayDialog, setArrayDialog] = useState<ArrayDialogType | null>(null);

  // Prévisualisation de la répétition en temps réel
  const arrayPreviewData = useMemo(() => {
    if (!arrayDialog?.open) {
      return null;
    }

    // Le mode damier ne nécessite pas de sélection
    if (arrayDialog.type === "checkerboard") {
      return { centerX: 0, centerY: 0, scaleFactor: sketch.scaleFactor, isCheckerboard: true };
    }

    if (selectedEntities.size === 0) {
      return null;
    }

    // Extraire les points des entités sélectionnées une seule fois
    const selectedPoints: Array<{ x: number; y: number }> = [];
    selectedEntities.forEach((id) => {
      const geo = sketch.geometries.get(id);
      if (geo) {
        if (geo.type === "line") {
          const line = geo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (p1) selectedPoints.push({ x: p1.x, y: p1.y });
          if (p2) selectedPoints.push({ x: p2.x, y: p2.y });
        } else if (geo.type === "circle") {
          const center = sketch.points.get((geo as CircleType).center);
          if (center) selectedPoints.push({ x: center.x, y: center.y });
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          const center = sketch.points.get(arc.center);
          if (center) selectedPoints.push({ x: center.x, y: center.y });
        } else if (geo.type === "rectangle") {
          const rect = geo as Rectangle;
          [rect.p1, rect.p2, rect.p3, rect.p4].forEach((pid) => {
            const p = sketch.points.get(pid);
            if (p) selectedPoints.push({ x: p.x, y: p.y });
          });
        }
      }
    });

    if (selectedPoints.length === 0) return null;

    let centerX = 0,
      centerY = 0;
    selectedPoints.forEach((p) => {
      centerX += p.x;
      centerY += p.y;
    });
    centerX /= selectedPoints.length;
    centerY /= selectedPoints.length;

    return { centerX, centerY, scaleFactor: sketch.scaleFactor };
  }, [arrayDialog?.open, arrayDialog?.type, selectedEntities, sketch.geometries, sketch.points, sketch.scaleFactor]);

  // Calcul du preview séparé
  const arrayPreview = useMemo((): ArrayPreviewType | null => {
    if (!arrayDialog?.open || !arrayPreviewData) {
      return null;
    }

    const {
      type,
      linearCount,
      linearSpacing,
      linearSpacingMode,
      linearDirection,
      linearAngle,
      countX,
      spacingX,
      spacingModeX,
      countY,
      spacingY,
      spacingModeY,
      circularCount,
      circularAngle,
      circularCenter,
      includeOriginal,
    } = arrayDialog;

    const { centerX: baseCenterX, centerY: baseCenterY, scaleFactor } = arrayPreviewData;

    // Parser les valeurs
    const linearSpacingStr = typeof linearSpacing === "string" ? linearSpacing : String(linearSpacing || "50");
    const spacingXStr = typeof spacingX === "string" ? spacingX : String(spacingX || "50");
    const spacingYStr = typeof spacingY === "string" ? spacingY : String(spacingY || "50");
    const circularAngleStr = typeof circularAngle === "string" ? circularAngle : String(circularAngle || "360");
    const linearAngleStr = typeof linearAngle === "string" ? linearAngle : String(linearAngle || "0");

    const linearSpacingNum = parseFloat(linearSpacingStr.replace(",", ".")) || 0;
    const spacingXNum = parseFloat(spacingXStr.replace(",", ".")) || 0;
    const spacingYNum = parseFloat(spacingYStr.replace(",", ".")) || 0;
    const circularAngleNum = parseFloat(circularAngleStr.replace(",", ".")) || 360;
    const linearAngleNum = parseFloat(linearAngleStr.replace(",", ".")) || 0;

    // Calculer l'espacement réel selon le mode
    const realLinearSpacing =
      linearSpacingMode === "distance" && (linearCount || 3) > 1
        ? linearSpacingNum / ((linearCount || 3) - 1)
        : linearSpacingNum;
    const realSpacingX = spacingModeX === "distance" && countX > 1 ? spacingXNum / (countX - 1) : spacingXNum;
    const realSpacingY = spacingModeY === "distance" && countY > 1 ? spacingYNum / (countY - 1) : spacingYNum;

    // Utiliser le centre personnalisé pour circulaire
    let centerX = baseCenterX;
    let centerY = baseCenterY;
    if (type === "circular" && circularCenter) {
      centerX = circularCenter.x;
      centerY = circularCenter.y;
    }

    const transforms: Array<{ offsetX: number; offsetY: number; rotation: number }> = [];

    if (type === "linear") {
      let dirAngle = 0;
      if (linearDirection === "y") {
        dirAngle = Math.PI / 2;
      } else if (linearDirection === "custom") {
        dirAngle = (linearAngleNum * Math.PI) / 180;
      }

      const dirX = Math.cos(dirAngle);
      const dirY = Math.sin(dirAngle);

      const startIdx = includeOriginal ? 1 : 0;
      const count = linearCount || 3;
      for (let i = startIdx; i < count; i++) {
        const dist = i * realLinearSpacing * scaleFactor;
        transforms.push({
          offsetX: dist * dirX,
          offsetY: dist * dirY,
          rotation: 0,
        });
      }
    } else if (type === "grid") {
      for (let row = 0; row < countY; row++) {
        for (let col = 0; col < countX; col++) {
          if (row === 0 && col === 0) continue;
          transforms.push({
            offsetX: col * realSpacingX * scaleFactor,
            offsetY: row * realSpacingY * scaleFactor,
            rotation: 0,
          });
        }
      }
    } else if (type === "circular") {
      const angleStep = (circularAngleNum / circularCount) * (Math.PI / 180);
      const startIdx = includeOriginal ? 1 : 0;
      for (let i = startIdx; i < circularCount; i++) {
        const rotation = i * angleStep;
        transforms.push({ offsetX: 0, offsetY: 0, rotation });
      }
    } else if (type === "checkerboard") {
      const { checkerCountX, checkerCountY, checkerSize, checkerColor } = arrayDialog;
      const countXStr = typeof checkerCountX === "string" ? checkerCountX : String(checkerCountX || "8");
      const countYStr = typeof checkerCountY === "string" ? checkerCountY : String(checkerCountY || "6");
      const sizeStr = typeof checkerSize === "string" ? checkerSize : String(checkerSize || "20");

      const countXNum = parseInt(countXStr) || 8;
      const countYNum = parseInt(countYStr) || 6;
      const sizePx = (parseFloat(sizeStr.replace(",", ".")) || 20) * scaleFactor;

      return {
        transforms: [],
        centerX: 0,
        centerY: 0,
        checkerboard: {
          countX: Math.max(1, countXNum),
          countY: Math.max(1, countYNum),
          sizePx,
          color: checkerColor ?? "#000000",
        },
      };
    }

    return { transforms, centerX, centerY };
  }, [arrayDialog, arrayPreviewData]);

  // Ouvrir la modale de répétition
  const openArrayDialog = useCallback(
    (forceCheckerboard = false) => {
      const noSelection = selectedEntities.size === 0;
      const useCheckerboard = forceCheckerboard || noSelection;

      // Calculer le centre de la sélection pour le mode circulaire
      let sumX = 0,
        sumY = 0,
        count = 0;
      selectedEntities.forEach((id) => {
        const geo = sketch.geometries.get(id);
        if (geo) {
          if (geo.type === "line") {
            const line = geo as Line;
            const p1 = sketch.points.get(line.p1);
            const p2 = sketch.points.get(line.p2);
            if (p1 && p2) {
              sumX += (p1.x + p2.x) / 2;
              sumY += (p1.y + p2.y) / 2;
              count++;
            }
          } else if (geo.type === "circle") {
            const circle = geo as CircleType;
            const center = sketch.points.get(circle.center);
            if (center) {
              sumX += center.x;
              sumY += center.y;
              count++;
            }
          } else if (geo.type === "arc") {
            const arc = geo as Arc;
            const center = sketch.points.get(arc.center);
            if (center) {
              sumX += center.x;
              sumY += center.y;
              count++;
            }
          }
        }
      });

      const selectionCenter = count > 0 ? { x: sumX / count, y: sumY / count } : { x: 0, y: 0 };

      setArrayDialog({
        open: true,
        type: useCheckerboard ? "checkerboard" : "linear",
        // Linéaire
        linearCount: 3,
        linearSpacing: "50",
        linearSpacingMode: "spacing",
        linearDirection: "x",
        linearAngle: "0",
        // Grille
        countX: 3,
        spacingX: "50",
        spacingModeX: "spacing",
        countY: 3,
        spacingY: "50",
        spacingModeY: "spacing",
        // Circulaire
        circularCount: 6,
        circularAngle: "360",
        circularCenter: selectionCenter,
        // Damier
        checkerCountX: "8",
        checkerCountY: "6",
        checkerSize: "20",
        checkerColor: "#000000",
        // Général
        includeOriginal: true,
        createIntersections: true,
      });
    },
    [selectedEntities, sketch],
  );

  // Exécuter la répétition
  const executeArray = useCallback(() => {
    if (!arrayDialog) return;

    // Le mode checkerboard ne nécessite pas de sélection
    if (arrayDialog.type !== "checkerboard" && selectedEntities.size === 0) return;

    const {
      type,
      linearCount,
      linearSpacing,
      linearSpacingMode,
      linearDirection,
      linearAngle,
      countX,
      spacingX,
      spacingModeX,
      countY,
      spacingY,
      spacingModeY,
      circularCount,
      circularAngle,
      circularCenter,
      includeOriginal,
      createIntersections,
    } = arrayDialog;

    // Parser les valeurs
    const linearSpacingStr = typeof linearSpacing === "string" ? linearSpacing : String(linearSpacing || "50");
    const spacingXStr = typeof spacingX === "string" ? spacingX : String(spacingX || "50");
    const spacingYStr = typeof spacingY === "string" ? spacingY : String(spacingY || "50");
    const circularAngleStr = typeof circularAngle === "string" ? circularAngle : String(circularAngle || "360");
    const linearAngleStr = typeof linearAngle === "string" ? linearAngle : String(linearAngle || "0");

    const linearSpacingNum = parseFloat(linearSpacingStr.replace(",", ".")) || 0;
    const spacingXNum = parseFloat(spacingXStr.replace(",", ".")) || 0;
    const spacingYNum = parseFloat(spacingYStr.replace(",", ".")) || 0;
    const circularAngleNum = parseFloat(circularAngleStr.replace(",", ".")) || 360;
    const linearAngleNum = parseFloat(linearAngleStr.replace(",", ".")) || 0;

    // Calculer l'espacement réel selon le mode
    const count = linearCount || 3;
    const realLinearSpacing =
      linearSpacingMode === "distance" && count > 1 ? linearSpacingNum / (count - 1) : linearSpacingNum;
    const realSpacingX = spacingModeX === "distance" && countX > 1 ? spacingXNum / (countX - 1) : spacingXNum;
    const realSpacingY = spacingModeY === "distance" && countY > 1 ? spacingYNum / (countY - 1) : spacingYNum;

    // Collecter les points et géométries sélectionnés
    const copiedPoints = new Map<string, Point>();
    const copiedGeometries = new Map<string, Geometry>();
    const pointsUsed = new Set<string>();

    selectedEntities.forEach((id) => {
      const geo = sketch.geometries.get(id);
      if (geo) {
        copiedGeometries.set(id, { ...geo });
        if (geo.type === "line") {
          const line = geo as Line;
          pointsUsed.add(line.p1);
          pointsUsed.add(line.p2);
        } else if (geo.type === "circle") {
          pointsUsed.add((geo as CircleType).center);
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          pointsUsed.add(arc.center);
          pointsUsed.add(arc.startPoint);
          pointsUsed.add(arc.endPoint);
        } else if (geo.type === "rectangle") {
          const rect = geo as Rectangle;
          [rect.p1, rect.p2, rect.p3, rect.p4].forEach((pid) => pointsUsed.add(pid));
        } else if (geo.type === "bezier") {
          const bezier = geo as Bezier;
          [bezier.p1, bezier.p2, bezier.cp1, bezier.cp2].forEach((pid) => pointsUsed.add(pid));
        } else if (geo.type === "text") {
          const text = geo as TextAnnotation;
          pointsUsed.add(text.position);
        }
      }
    });

    pointsUsed.forEach((pointId) => {
      const point = sketch.points.get(pointId);
      if (point) {
        copiedPoints.set(pointId, { ...point });
      }
    });

    // Calculer le centre de la sélection pour la rotation
    let centerX = 0,
      centerY = 0;
    copiedPoints.forEach((p) => {
      centerX += p.x;
      centerY += p.y;
    });
    centerX /= copiedPoints.size || 1;
    centerY /= copiedPoints.size || 1;

    // Utiliser le centre personnalisé pour circulaire
    if (type === "circular" && circularCenter) {
      centerX = circularCenter.x;
      centerY = circularCenter.y;
    }

    const newSketch = { ...sketch };
    newSketch.points = new Map(sketch.points);
    newSketch.geometries = new Map(sketch.geometries);

    // Liste des nouvelles géométries créées (pour les intersections)
    const newGeometryIds: string[] = [];

    // Fonction pour créer une copie avec offset/rotation
    const createCopy = (offsetX: number, offsetY: number, rotation: number = 0) => {
      const pointIdMapping = new Map<string, string>();

      copiedPoints.forEach((point, oldId) => {
        const newId = generateId();
        pointIdMapping.set(oldId, newId);

        let newX = point.x;
        let newY = point.y;

        if (rotation !== 0) {
          // Rotation autour du centre
          const dx = point.x - centerX;
          const dy = point.y - centerY;
          const cos = Math.cos(rotation);
          const sin = Math.sin(rotation);
          newX = centerX + dx * cos - dy * sin;
          newY = centerY + dx * sin + dy * cos;
        }

        newSketch.points.set(newId, {
          ...point,
          id: newId,
          x: newX + offsetX,
          y: newY + offsetY,
          fixed: false,
        });
      });

      copiedGeometries.forEach((geo) => {
        const newId = generateId();
        newGeometryIds.push(newId);

        if (geo.type === "line") {
          const line = geo as Line;
          newSketch.geometries.set(newId, {
            ...line,
            id: newId,
            p1: pointIdMapping.get(line.p1) || line.p1,
            p2: pointIdMapping.get(line.p2) || line.p2,
          });
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          newSketch.geometries.set(newId, {
            ...circle,
            id: newId,
            center: pointIdMapping.get(circle.center) || circle.center,
          });
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          newSketch.geometries.set(newId, {
            ...arc,
            id: newId,
            center: pointIdMapping.get(arc.center) || arc.center,
            startPoint: pointIdMapping.get(arc.startPoint) || arc.startPoint,
            endPoint: pointIdMapping.get(arc.endPoint) || arc.endPoint,
          });
        } else if (geo.type === "rectangle") {
          const rect = geo as Rectangle;
          newSketch.geometries.set(newId, {
            ...rect,
            id: newId,
            p1: pointIdMapping.get(rect.p1) || rect.p1,
            p2: pointIdMapping.get(rect.p2) || rect.p2,
            p3: pointIdMapping.get(rect.p3) || rect.p3,
            p4: pointIdMapping.get(rect.p4) || rect.p4,
          });
        } else if (geo.type === "bezier") {
          const bezier = geo as Bezier;
          newSketch.geometries.set(newId, {
            ...bezier,
            id: newId,
            p1: pointIdMapping.get(bezier.p1) || bezier.p1,
            p2: pointIdMapping.get(bezier.p2) || bezier.p2,
            cp1: pointIdMapping.get(bezier.cp1) || bezier.cp1,
            cp2: pointIdMapping.get(bezier.cp2) || bezier.cp2,
          });
        } else if (geo.type === "text") {
          const text = geo as TextAnnotation;
          newSketch.geometries.set(newId, {
            ...text,
            id: newId,
            position: pointIdMapping.get(text.position) || text.position,
          });
        }
      });
    };

    let totalCopies = 0;

    if (type === "linear") {
      let dirAngle = 0;
      if (linearDirection === "y") {
        dirAngle = Math.PI / 2;
      } else if (linearDirection === "custom") {
        dirAngle = (linearAngleNum * Math.PI) / 180;
      }

      const dirX = Math.cos(dirAngle);
      const dirY = Math.sin(dirAngle);

      const startIdx = includeOriginal ? 1 : 0;
      for (let i = startIdx; i < count; i++) {
        const dist = i * realLinearSpacing * sketch.scaleFactor;
        createCopy(dist * dirX, dist * dirY);
        totalCopies++;
      }
    } else if (type === "grid") {
      for (let row = 0; row < countY; row++) {
        for (let col = 0; col < countX; col++) {
          if (row === 0 && col === 0 && includeOriginal) continue;
          createCopy(col * realSpacingX * sketch.scaleFactor, row * realSpacingY * sketch.scaleFactor);
          totalCopies++;
        }
      }
    } else if (type === "circular") {
      const angleStep = (circularAngleNum * Math.PI) / 180 / circularCount;
      const startIdx = includeOriginal ? 1 : 0;
      for (let i = startIdx; i < circularCount; i++) {
        const rotation = angleStep * i;
        createCopy(0, 0, rotation);
        totalCopies++;
      }
    } else if (type === "checkerboard") {
      const { checkerCountX, checkerCountY, checkerSize, checkerColor } = arrayDialog;

      const countXStr = typeof checkerCountX === "string" ? checkerCountX : String(checkerCountX || "8");
      const countYStr = typeof checkerCountY === "string" ? checkerCountY : String(checkerCountY || "6");
      const sizeStr = typeof checkerSize === "string" ? checkerSize : String(checkerSize || "20");

      const cX = Math.max(1, parseInt(countXStr) || 8);
      const cY = Math.max(1, parseInt(countYStr) || 6);
      const sizePx = (parseFloat(sizeStr.replace(",", ".")) || 20) * sketch.scaleFactor;

      const startX = 0;
      const startY = 0;

      // Créer les points de la grille
      const pointGrid: string[][] = [];
      for (let row = 0; row <= cY; row++) {
        pointGrid[row] = [];
        for (let col = 0; col <= cX; col++) {
          const pointId = generateId();
          newSketch.points.set(pointId, {
            id: pointId,
            x: startX + col * sizePx,
            y: startY + row * sizePx,
          });
          pointGrid[row][col] = pointId;
        }
      }

      // Créer les lignes horizontales
      for (let row = 0; row <= cY; row++) {
        for (let col = 0; col < cX; col++) {
          const lineId = generateId();
          newSketch.geometries.set(lineId, {
            id: lineId,
            type: "line",
            p1: pointGrid[row][col],
            p2: pointGrid[row][col + 1],
            layerId: sketch.activeLayerId,
            strokeWidth: defaultStrokeWidthRef.current,
            strokeColor: defaultStrokeColorRef.current,
          });
          newGeometryIds.push(lineId);
        }
      }

      // Créer les lignes verticales
      for (let col = 0; col <= cX; col++) {
        for (let row = 0; row < cY; row++) {
          const lineId = generateId();
          newSketch.geometries.set(lineId, {
            id: lineId,
            type: "line",
            p1: pointGrid[row][col],
            p2: pointGrid[row + 1][col],
            layerId: sketch.activeLayerId,
            strokeWidth: defaultStrokeWidthRef.current,
            strokeColor: defaultStrokeColorRef.current,
          });
          newGeometryIds.push(lineId);
        }
      }

      // Créer les remplissages pour les cases noires
      if (!newSketch.shapeFills) {
        newSketch.shapeFills = new Map();
      } else {
        newSketch.shapeFills = new Map(newSketch.shapeFills);
      }

      for (let row = 0; row < cY; row++) {
        for (let col = 0; col < cX; col++) {
          if ((row + col) % 2 === 0) {
            const topLineIdx = row * cX + col;
            const bottomLineIdx = (row + 1) * cX + col;
            const leftLineIdx = cX * (cY + 1) + col * cY + row;
            const rightLineIdx = cX * (cY + 1) + (col + 1) * cY + row;

            const geoIds = new Set<string>();
            if (newGeometryIds[topLineIdx]) geoIds.add(newGeometryIds[topLineIdx]);
            if (newGeometryIds[bottomLineIdx]) geoIds.add(newGeometryIds[bottomLineIdx]);
            if (newGeometryIds[leftLineIdx]) geoIds.add(newGeometryIds[leftLineIdx]);
            if (newGeometryIds[rightLineIdx]) geoIds.add(newGeometryIds[rightLineIdx]);

            if (geoIds.size === 4) {
              const fillId = generateId();
              newSketch.shapeFills.set(fillId, {
                id: fillId,
                geoIds: Array.from(geoIds),
                fillType: "solid",
                color: checkerColor || "#000000",
                opacity: 1,
              });
            }
          }
        }
      }

      totalCopies = cX * cY;
    }

    // Créer les points d'intersection si demandé
    if (createIntersections) {
      for (const geoId of newGeometryIds) {
        createIntersectionPoints(geoId, newSketch);
      }
    }

    setSketch(newSketch);
    addToHistory(newSketch, `Répétition ${type} (${totalCopies} copies)`);
    setArrayDialog(null);
    toast.success(`${totalCopies} copie(s) créée(s)`);
  }, [arrayDialog, selectedEntities, sketch, addToHistory, createIntersectionPoints, defaultStrokeWidthRef, defaultStrokeColorRef, setSketch]);

  // Fermer le dialogue
  const closeArrayDialog = useCallback(() => {
    setArrayDialog(null);
  }, []);

  return {
    arrayDialog,
    setArrayDialog,
    arrayPreview,
    arrayPreviewData,
    openArrayDialog,
    executeArray,
    closeArrayDialog,
  };
}
