// ============================================
// HOOK: useSelection
// VERSION: 1.0
// Description: Gestion de la sélection d'entités et multi-sélection
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Sketch, Point, Line, Arc, Circle, Bezier, Geometry } from "./types";

// ============================================
// TYPES
// ============================================

export interface SelectionBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export interface SelectRectState {
  active: boolean;
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
  mode: "window" | "crossing"; // window = entièrement dedans, crossing = touche
}

export interface TransformGizmoState {
  active: boolean;
  mode: "translate" | "rotate" | "scale" | null;
  startPos: { x: number; y: number } | null;
  startAngle: number;
  startScale: number;
}

export interface UseSelectionProps {
  sketch: Sketch;
}

export interface UseSelectionReturn {
  // États de sélection
  selectedEntities: Set<string>;
  setSelectedEntities: React.Dispatch<React.SetStateAction<Set<string>>>;
  hoveredEntity: string | null;
  setHoveredEntity: React.Dispatch<React.SetStateAction<string | null>>;
  referenceHighlight: string | null;
  setReferenceHighlight: React.Dispatch<React.SetStateAction<string | null>>;
  
  // Rectangle de sélection
  selectRect: SelectRectState;
  setSelectRect: React.Dispatch<React.SetStateAction<SelectRectState>>;
  
  // Gizmo de transformation
  transformGizmo: TransformGizmoState;
  setTransformGizmo: React.Dispatch<React.SetStateAction<TransformGizmoState>>;
  showTransformGizmo: boolean;
  setShowTransformGizmo: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Données calculées
  selectionBounds: SelectionBounds | null;
  selectedGeometries: Geometry[];
  selectedPoints: Point[];
  
  // Fonctions de sélection
  selectEntity: (entityId: string, addToSelection?: boolean) => void;
  deselectEntity: (entityId: string) => void;
  toggleSelection: (entityId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectEntitiesInRect: (rect: { x1: number; y1: number; x2: number; y2: number }, mode: "window" | "crossing") => void;
  invertSelection: () => void;
  selectByType: (type: "line" | "circle" | "arc" | "bezier" | "text") => void;
  selectByLayer: (layerId: string) => void;
  selectConnected: (startEntityId: string) => void;
  
  // Helpers
  isEntitySelected: (entityId: string) => boolean;
  hasSelection: boolean;
  selectionCount: number;
}

// ============================================
// HOOK
// ============================================

export function useSelection({ sketch }: UseSelectionProps): UseSelectionReturn {
  
  // === États de sélection ===
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  const [referenceHighlight, setReferenceHighlight] = useState<string | null>(null);
  
  // === Rectangle de sélection ===
  const [selectRect, setSelectRect] = useState<SelectRectState>({
    active: false,
    start: null,
    end: null,
    mode: "window",
  });
  
  // === Gizmo de transformation ===
  const [transformGizmo, setTransformGizmo] = useState<TransformGizmoState>({
    active: false,
    mode: null,
    startPos: null,
    startAngle: 0,
    startScale: 1,
  });
  const [showTransformGizmo, setShowTransformGizmo] = useState(true);
  
  // === Données calculées ===
  
  const selectionBounds = useMemo((): SelectionBounds | null => {
    if (selectedEntities.size === 0) return null;
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    const processPoint = (x: number, y: number) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };
    
    selectedEntities.forEach((entityId) => {
      const geo = sketch.geometries.get(entityId);
      if (!geo) return;
      
      if (geo.type === "line") {
        const line = geo as Line;
        const p1 = sketch.points.get(line.p1);
        const p2 = sketch.points.get(line.p2);
        if (p1) processPoint(p1.x, p1.y);
        if (p2) processPoint(p2.x, p2.y);
      } else if (geo.type === "circle") {
        const circle = geo as Circle;
        const center = sketch.points.get(circle.center);
        if (center) {
          processPoint(center.x - circle.radius, center.y - circle.radius);
          processPoint(center.x + circle.radius, center.y + circle.radius);
        }
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        const startPt = sketch.points.get(arc.startPoint);
        const endPt = sketch.points.get(arc.endPoint);
        const centerPt = sketch.points.get(arc.center);
        if (startPt) processPoint(startPt.x, startPt.y);
        if (endPt) processPoint(endPt.x, endPt.y);
        if (centerPt) {
          // Include arc bounds (approximation)
          processPoint(centerPt.x - arc.radius, centerPt.y - arc.radius);
          processPoint(centerPt.x + arc.radius, centerPt.y + arc.radius);
        }
      } else if (geo.type === "bezier") {
        const bezier = geo as Bezier;
        const p1 = sketch.points.get(bezier.p1);
        const p2 = sketch.points.get(bezier.p2);
        const cp1 = sketch.points.get(bezier.cp1);
        const cp2 = sketch.points.get(bezier.cp2);
        if (p1) processPoint(p1.x, p1.y);
        if (p2) processPoint(p2.x, p2.y);
        if (cp1) processPoint(cp1.x, cp1.y);
        if (cp2) processPoint(cp2.x, cp2.y);
      }
    });
    
    if (minX === Infinity) return null;
    
    return {
      minX,
      minY,
      maxX,
      maxY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [selectedEntities, sketch.geometries, sketch.points]);
  
  const selectedGeometries = useMemo((): Geometry[] => {
    const result: Geometry[] = [];
    selectedEntities.forEach((id) => {
      const geo = sketch.geometries.get(id);
      if (geo) result.push(geo);
    });
    return result;
  }, [selectedEntities, sketch.geometries]);
  
  const selectedPoints = useMemo((): Point[] => {
    const pointIds = new Set<string>();
    
    selectedEntities.forEach((entityId) => {
      const geo = sketch.geometries.get(entityId);
      if (!geo) return;
      
      if (geo.type === "line") {
        const line = geo as Line;
        pointIds.add(line.p1);
        pointIds.add(line.p2);
      } else if (geo.type === "circle") {
        const circle = geo as Circle;
        pointIds.add(circle.center);
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        pointIds.add(arc.startPoint);
        pointIds.add(arc.endPoint);
        pointIds.add(arc.center);
      } else if (geo.type === "bezier") {
        const bezier = geo as Bezier;
        pointIds.add(bezier.p1);
        pointIds.add(bezier.p2);
        pointIds.add(bezier.cp1);
        pointIds.add(bezier.cp2);
      }
    });
    
    const result: Point[] = [];
    pointIds.forEach((id) => {
      const pt = sketch.points.get(id);
      if (pt) result.push(pt);
    });
    return result;
  }, [selectedEntities, sketch.geometries, sketch.points]);
  
  // === Helpers ===
  
  const isEntitySelected = useCallback((entityId: string): boolean => {
    return selectedEntities.has(entityId);
  }, [selectedEntities]);
  
  const hasSelection = useMemo(() => selectedEntities.size > 0, [selectedEntities]);
  const selectionCount = useMemo(() => selectedEntities.size, [selectedEntities]);
  
  // === Fonctions de sélection ===
  
  const selectEntity = useCallback((entityId: string, addToSelection: boolean = false) => {
    setSelectedEntities((prev) => {
      if (addToSelection) {
        const newSet = new Set(prev);
        newSet.add(entityId);
        return newSet;
      }
      return new Set([entityId]);
    });
  }, []);
  
  const deselectEntity = useCallback((entityId: string) => {
    setSelectedEntities((prev) => {
      const newSet = new Set(prev);
      newSet.delete(entityId);
      return newSet;
    });
  }, []);
  
  const toggleSelection = useCallback((entityId: string) => {
    setSelectedEntities((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entityId)) {
        newSet.delete(entityId);
      } else {
        newSet.add(entityId);
      }
      return newSet;
    });
  }, []);
  
  const selectAll = useCallback(() => {
    const allIds = new Set<string>();
    sketch.geometries.forEach((geo, id) => {
      // Exclure les lignes de construction si masquées
      if (geo.type === "line" && (geo as Line).isConstruction) {
        // Toujours inclure pour l'instant
      }
      allIds.add(id);
    });
    setSelectedEntities(allIds);
  }, [sketch.geometries]);
  
  const deselectAll = useCallback(() => {
    setSelectedEntities(new Set());
  }, []);
  
  const selectEntitiesInRect = useCallback((
    rect: { x1: number; y1: number; x2: number; y2: number },
    mode: "window" | "crossing"
  ) => {
    const minX = Math.min(rect.x1, rect.x2);
    const maxX = Math.max(rect.x1, rect.x2);
    const minY = Math.min(rect.y1, rect.y2);
    const maxY = Math.max(rect.y1, rect.y2);
    
    const isPointInRect = (x: number, y: number) => {
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    };
    
    const newSelection = new Set<string>();
    
    sketch.geometries.forEach((geo, id) => {
      let shouldSelect = false;
      
      if (geo.type === "line") {
        const line = geo as Line;
        const p1 = sketch.points.get(line.p1);
        const p2 = sketch.points.get(line.p2);
        
        if (p1 && p2) {
          const p1In = isPointInRect(p1.x, p1.y);
          const p2In = isPointInRect(p2.x, p2.y);
          
          if (mode === "window") {
            shouldSelect = p1In && p2In;
          } else {
            // Crossing: au moins un point dedans ou la ligne traverse le rect
            shouldSelect = p1In || p2In || lineIntersectsRect(p1, p2, minX, minY, maxX, maxY);
          }
        }
      } else if (geo.type === "circle") {
        const circle = geo as Circle;
        const center = sketch.points.get(circle.center);
        
        if (center) {
          if (mode === "window") {
            // Le cercle entier doit être dans le rect
            shouldSelect = 
              center.x - circle.radius >= minX &&
              center.x + circle.radius <= maxX &&
              center.y - circle.radius >= minY &&
              center.y + circle.radius <= maxY;
          } else {
            // Au moins une partie du cercle touche le rect
            shouldSelect = circleIntersectsRect(center.x, center.y, circle.radius, minX, minY, maxX, maxY);
          }
        }
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        const startPt = sketch.points.get(arc.startPoint);
        const endPt = sketch.points.get(arc.endPoint);
        
        if (startPt && endPt) {
          const startIn = isPointInRect(startPt.x, startPt.y);
          const endIn = isPointInRect(endPt.x, endPt.y);
          
          if (mode === "window") {
            shouldSelect = startIn && endIn;
          } else {
            shouldSelect = startIn || endIn;
          }
        }
      } else if (geo.type === "bezier") {
        const bezier = geo as Bezier;
        const p1 = sketch.points.get(bezier.p1);
        const p2 = sketch.points.get(bezier.p2);
        
        if (p1 && p2) {
          const p1In = isPointInRect(p1.x, p1.y);
          const p2In = isPointInRect(p2.x, p2.y);
          
          if (mode === "window") {
            shouldSelect = p1In && p2In;
          } else {
            shouldSelect = p1In || p2In;
          }
        }
      }
      
      if (shouldSelect) {
        newSelection.add(id);
      }
    });
    
    setSelectedEntities(newSelection);
  }, [sketch.geometries, sketch.points]);
  
  const invertSelection = useCallback(() => {
    const allIds = new Set<string>();
    sketch.geometries.forEach((_, id) => allIds.add(id));
    
    const inverted = new Set<string>();
    allIds.forEach((id) => {
      if (!selectedEntities.has(id)) {
        inverted.add(id);
      }
    });
    
    setSelectedEntities(inverted);
  }, [sketch.geometries, selectedEntities]);
  
  const selectByType = useCallback((type: "line" | "circle" | "arc" | "bezier" | "text") => {
    const matching = new Set<string>();
    sketch.geometries.forEach((geo, id) => {
      if (geo.type === type) {
        matching.add(id);
      }
    });
    setSelectedEntities(matching);
  }, [sketch.geometries]);
  
  const selectByLayer = useCallback((layerId: string) => {
    const matching = new Set<string>();
    sketch.geometries.forEach((geo, id) => {
      if (geo.layerId === layerId) {
        matching.add(id);
      }
    });
    setSelectedEntities(matching);
  }, [sketch.geometries]);
  
  const selectConnected = useCallback((startEntityId: string) => {
    const visited = new Set<string>();
    const queue = [startEntityId];
    
    const getPointsOfGeometry = (geo: Geometry): string[] => {
      if (geo.type === "line") {
        const line = geo as Line;
        return [line.p1, line.p2];
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        return [arc.startPoint, arc.endPoint];
      } else if (geo.type === "bezier") {
        const bezier = geo as Bezier;
        return [bezier.p1, bezier.p2];
      }
      return [];
    };
    
    const getGeometriesAtPoint = (pointId: string): string[] => {
      const result: string[] = [];
      sketch.geometries.forEach((geo, id) => {
        const points = getPointsOfGeometry(geo);
        if (points.includes(pointId)) {
          result.push(id);
        }
      });
      return result;
    };
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      const geo = sketch.geometries.get(currentId);
      if (!geo) continue;
      
      const points = getPointsOfGeometry(geo);
      for (const pointId of points) {
        const connected = getGeometriesAtPoint(pointId);
        for (const connectedId of connected) {
          if (!visited.has(connectedId)) {
            queue.push(connectedId);
          }
        }
      }
    }
    
    setSelectedEntities(visited);
  }, [sketch.geometries]);
  
  return {
    // États de sélection
    selectedEntities,
    setSelectedEntities,
    hoveredEntity,
    setHoveredEntity,
    referenceHighlight,
    setReferenceHighlight,
    
    // Rectangle de sélection
    selectRect,
    setSelectRect,
    
    // Gizmo de transformation
    transformGizmo,
    setTransformGizmo,
    showTransformGizmo,
    setShowTransformGizmo,
    
    // Données calculées
    selectionBounds,
    selectedGeometries,
    selectedPoints,
    
    // Fonctions de sélection
    selectEntity,
    deselectEntity,
    toggleSelection,
    selectAll,
    deselectAll,
    selectEntitiesInRect,
    invertSelection,
    selectByType,
    selectByLayer,
    selectConnected,
    
    // Helpers
    isEntitySelected,
    hasSelection,
    selectionCount,
  };
}

// ============================================
// HELPERS
// ============================================

function lineIntersectsRect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): boolean {
  // Check if line segment intersects rectangle
  // Using Cohen-Sutherland algorithm concepts
  
  const INSIDE = 0;
  const LEFT = 1;
  const RIGHT = 2;
  const BOTTOM = 4;
  const TOP = 8;
  
  const computeCode = (x: number, y: number): number => {
    let code = INSIDE;
    if (x < minX) code |= LEFT;
    else if (x > maxX) code |= RIGHT;
    if (y < minY) code |= BOTTOM;
    else if (y > maxY) code |= TOP;
    return code;
  };
  
  let code1 = computeCode(p1.x, p1.y);
  let code2 = computeCode(p2.x, p2.y);
  
  while (true) {
    if ((code1 | code2) === 0) return true; // Both inside
    if ((code1 & code2) !== 0) return false; // Both outside same region
    
    // Line needs clipping
    const codeOut = code1 !== 0 ? code1 : code2;
    let x: number, y: number;
    
    if (codeOut & TOP) {
      x = p1.x + (p2.x - p1.x) * (maxY - p1.y) / (p2.y - p1.y);
      y = maxY;
    } else if (codeOut & BOTTOM) {
      x = p1.x + (p2.x - p1.x) * (minY - p1.y) / (p2.y - p1.y);
      y = minY;
    } else if (codeOut & RIGHT) {
      y = p1.y + (p2.y - p1.y) * (maxX - p1.x) / (p2.x - p1.x);
      x = maxX;
    } else {
      y = p1.y + (p2.y - p1.y) * (minX - p1.x) / (p2.x - p1.x);
      x = minX;
    }
    
    if (codeOut === code1) {
      p1 = { x, y };
      code1 = computeCode(x, y);
    } else {
      p2 = { x, y };
      code2 = computeCode(x, y);
    }
  }
}

function circleIntersectsRect(
  cx: number,
  cy: number,
  radius: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): boolean {
  // Find closest point on rectangle to circle center
  const closestX = Math.max(minX, Math.min(cx, maxX));
  const closestY = Math.max(minY, Math.min(cy, maxY));
  
  // Calculate distance from closest point to circle center
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;
  
  return distSq <= radius * radius;
}

export default useSelection;
