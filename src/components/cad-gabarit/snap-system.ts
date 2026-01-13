// ============================================
// SNAP SYSTEM: Système de snap intelligent
// Détection automatique des points d'accroche
// VERSION: 1.3 - Support des points additionnels (markers image)
// ============================================

import {
  Point,
  Geometry,
  Line,
  Circle,
  Arc,
  SnapPoint,
  SnapType,
  SnapSettings,
  Sketch,
  Viewport,
  distance,
  midpoint,
} from "./types";

export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  enabled: true,
  types: new Set(["endpoint", "midpoint", "center", "intersection", "quadrant", "nearest", "grid"]),
  tolerance: 25, // pixels - augmenté pour meilleur accrochage
  gridSize: 10, // mm
  showGrid: true,
};

// Type pour les points additionnels (markers, etc.)
export interface AdditionalSnapPoint {
  x: number;
  y: number;
  type: SnapType;
  label?: string;
  entityId?: string;
  priority?: number;
}

export class SnapSystem {
  private settings: SnapSettings;

  constructor(settings: Partial<SnapSettings> = {}) {
    this.settings = { ...DEFAULT_SNAP_SETTINGS, ...settings };
  }

  updateSettings(settings: Partial<SnapSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  getSettings(): SnapSettings {
    return { ...this.settings };
  }

  /**
   * Trouve le meilleur point de snap pour une position donnée
   * @param additionalPoints - Points supplémentaires à considérer (markers, etc.)
   */
  findSnapPoint(
    mouseX: number,
    mouseY: number,
    sketch: Sketch,
    viewport: Viewport,
    excludeIds: string[] = [],
    additionalPoints: AdditionalSnapPoint[] = [],
    options: { activeLayerOnly?: boolean; activeLayerId?: string } = {},
  ): SnapPoint | null {
    if (!this.settings.enabled) return null;

    const { activeLayerOnly = false, activeLayerId } = options;

    // Convertir la position souris en coordonnées sketch
    const worldPos = this.screenToWorld(mouseX, mouseY, viewport);

    // Collecter tous les points de snap possibles
    const snapPoints: SnapPoint[] = [];

    // 0. Points additionnels (markers, etc.) - PRIORITÉ HAUTE
    for (const ap of additionalPoints) {
      snapPoints.push({
        x: ap.x,
        y: ap.y,
        type: ap.type,
        entityId: ap.entityId,
        priority: ap.priority ?? 0, // Priorité maximale par défaut
      });
    }

    // Collecter les IDs des points des géométries du calque actif (si filtrage activé)
    const activeLayerPointIds = new Set<string>();
    if (activeLayerOnly && activeLayerId) {
      sketch.geometries.forEach((geo) => {
        const layerId = geo.layerId || "trace";
        if (layerId === activeLayerId) {
          // Collecter les points de cette géométrie
          if (geo.type === "line") {
            activeLayerPointIds.add((geo as any).p1);
            activeLayerPointIds.add((geo as any).p2);
          } else if (geo.type === "circle") {
            activeLayerPointIds.add((geo as any).center);
          } else if (geo.type === "arc") {
            activeLayerPointIds.add((geo as any).center);
            activeLayerPointIds.add((geo as any).startPoint);
            activeLayerPointIds.add((geo as any).endPoint);
          } else if (geo.type === "bezier") {
            activeLayerPointIds.add((geo as any).p1);
            activeLayerPointIds.add((geo as any).p2);
            activeLayerPointIds.add((geo as any).cp1);
            activeLayerPointIds.add((geo as any).cp2);
          }
        }
      });
    }

    // 1. Points existants (endpoints)
    if (this.settings.types.has("endpoint")) {
      sketch.points.forEach((point, id) => {
        if (excludeIds.includes(id)) return;
        // Filtrer par calque si activé
        if (activeLayerOnly && activeLayerId && !activeLayerPointIds.has(id)) return;
        snapPoints.push({
          x: point.x,
          y: point.y,
          type: "endpoint",
          entityId: id,
          priority: 1,
        });
      });
    }

    // 2. Points sur les géométries
    sketch.geometries.forEach((geo, id) => {
      if (excludeIds.includes(id)) return;
      // Filtrer par calque si activé
      if (activeLayerOnly && activeLayerId) {
        const layerId = geo.layerId || "trace";
        if (layerId !== activeLayerId) return;
      }

      const geoSnapPoints = this.getGeometrySnapPoints(geo, sketch, worldPos);
      snapPoints.push(...geoSnapPoints);
    });

    // 3. Intersections (plus coûteux, calculé à la demande)
    if (this.settings.types.has("intersection")) {
      const intersections = this.findIntersections(sketch, excludeIds);
      snapPoints.push(...intersections);
    }

    // 4. Grille
    if (this.settings.types.has("grid") && this.settings.showGrid) {
      const gridPoint = this.snapToGrid(worldPos.x, worldPos.y, sketch.scaleFactor);
      snapPoints.push({
        x: gridPoint.x,
        y: gridPoint.y,
        type: "grid",
        priority: 10,
      });
    }

    // Trouver le point le plus proche dans la tolérance
    const tolerance = this.settings.tolerance / viewport.scale;
    let bestPoint: SnapPoint | null = null;
    let bestDistance = tolerance;

    for (const sp of snapPoints) {
      const d = distance(worldPos, sp);
      // Prioriser par type (priority plus bas = meilleur)
      const effectiveDistance = d + sp.priority * 0.1;

      if (d <= tolerance && effectiveDistance < bestDistance + (bestPoint?.priority ?? 0) * 0.1) {
        bestDistance = d;
        bestPoint = sp;
      }
    }

    return bestPoint;
  }

  /**
   * Obtient les points de snap pour une géométrie
   */
  private getGeometrySnapPoints(geo: Geometry, sketch: Sketch, cursorPos: { x: number; y: number }): SnapPoint[] {
    const points: SnapPoint[] = [];

    switch (geo.type) {
      case "line": {
        const line = geo as Line;
        const p1 = sketch.points.get(line.p1);
        const p2 = sketch.points.get(line.p2);
        if (!p1 || !p2) break;

        // Midpoint
        if (this.settings.types.has("midpoint")) {
          const mid = midpoint(p1, p2);
          points.push({
            x: mid.x,
            y: mid.y,
            type: "midpoint",
            entityId: geo.id,
            priority: 2,
          });
        }

        // Nearest point on line (priorité améliorée pour meilleur accrochage)
        if (this.settings.types.has("nearest")) {
          const nearest = this.nearestPointOnLine(p1, p2, cursorPos);
          points.push({
            x: nearest.x,
            y: nearest.y,
            type: "nearest",
            entityId: geo.id,
            priority: 3, // Priorité améliorée (était 5)
          });
        }
        break;
      }

      case "circle": {
        const circle = geo as Circle;
        const center = sketch.points.get(circle.center);
        if (!center) break;

        // Center - utiliser l'ID du point centre pour permettre la réutilisation
        if (this.settings.types.has("center")) {
          points.push({
            x: center.x,
            y: center.y,
            type: "center",
            entityId: circle.center, // ID du point, pas du cercle
            priority: 1,
          });
        }

        // Quadrants (0°, 90°, 180°, 270°)
        if (this.settings.types.has("quadrant")) {
          const quadrants = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
          for (const angle of quadrants) {
            points.push({
              x: center.x + Math.cos(angle) * circle.radius,
              y: center.y + Math.sin(angle) * circle.radius,
              type: "quadrant",
              entityId: geo.id,
              priority: 3,
            });
          }
        }

        // Nearest point on circle
        if (this.settings.types.has("nearest")) {
          const angle = Math.atan2(cursorPos.y - center.y, cursorPos.x - center.x);
          points.push({
            x: center.x + Math.cos(angle) * circle.radius,
            y: center.y + Math.sin(angle) * circle.radius,
            type: "nearest",
            entityId: geo.id,
            priority: 5,
          });
        }
        break;
      }

      case "arc": {
        const arc = geo as Arc;
        const center = sketch.points.get(arc.center);
        const startPt = sketch.points.get(arc.startPoint);
        const endPt = sketch.points.get(arc.endPoint);
        if (!center) break;

        // Center - utiliser l'ID du point centre pour permettre la réutilisation
        if (this.settings.types.has("center")) {
          points.push({
            x: center.x,
            y: center.y,
            type: "center",
            entityId: arc.center, // ID du point, pas de l'arc
            priority: 1,
          });
        }

        // Midpoint of arc
        if (this.settings.types.has("midpoint") && startPt && endPt) {
          const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
          const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);
          const midAngle = (startAngle + endAngle) / 2;
          points.push({
            x: center.x + Math.cos(midAngle) * arc.radius,
            y: center.y + Math.sin(midAngle) * arc.radius,
            type: "midpoint",
            entityId: geo.id,
            priority: 2,
          });
        }
        break;
      }

      case "rectangle": {
        // Les endpoints sont déjà gérés par les points
        // Ajouter les midpoints des côtés
        const rect = geo;
        const corners = [rect.p1, rect.p2, rect.p3, rect.p4]
          .map((id) => sketch.points.get(id))
          .filter(Boolean) as Point[];

        if (this.settings.types.has("midpoint") && corners.length === 4) {
          for (let i = 0; i < 4; i++) {
            const mid = midpoint(corners[i], corners[(i + 1) % 4]);
            points.push({
              x: mid.x,
              y: mid.y,
              type: "midpoint",
              entityId: geo.id,
              priority: 2,
            });
          }
        }

        // Center du rectangle
        if (this.settings.types.has("center") && corners.length === 4) {
          const centerX = (corners[0].x + corners[2].x) / 2;
          const centerY = (corners[0].y + corners[2].y) / 2;
          points.push({
            x: centerX,
            y: centerY,
            type: "center",
            entityId: geo.id,
            priority: 2,
          });
        }
        break;
      }
    }

    return points;
  }

  /**
   * Trouve les intersections entre géométries
   */
  private findIntersections(sketch: Sketch, excludeIds: string[]): SnapPoint[] {
    const intersections: SnapPoint[] = [];
    const geometries = Array.from(sketch.geometries.values()).filter((g) => !excludeIds.includes(g.id));

    for (let i = 0; i < geometries.length; i++) {
      for (let j = i + 1; j < geometries.length; j++) {
        const points = this.intersect(geometries[i], geometries[j], sketch);
        for (const p of points) {
          intersections.push({
            x: p.x,
            y: p.y,
            type: "intersection",
            priority: 1,
          });
        }
      }
    }

    return intersections;
  }

  /**
   * Calcule l'intersection entre deux géométries
   */
  private intersect(geo1: Geometry, geo2: Geometry, sketch: Sketch): { x: number; y: number }[] {
    // Line-Line intersection
    if (geo1.type === "line" && geo2.type === "line") {
      return this.lineLineIntersection(geo1, geo2, sketch);
    }

    // Line-Circle intersection
    if ((geo1.type === "line" && geo2.type === "circle") || (geo1.type === "circle" && geo2.type === "line")) {
      const line = (geo1.type === "line" ? geo1 : geo2) as Line;
      const circle = (geo1.type === "circle" ? geo1 : geo2) as Circle;
      return this.lineCircleIntersection(line, circle, sketch);
    }

    // Circle-Circle intersection
    if (geo1.type === "circle" && geo2.type === "circle") {
      return this.circleCircleIntersection(geo1 as Circle, geo2 as Circle, sketch);
    }

    return [];
  }

  private lineLineIntersection(line1: Line, line2: Line, sketch: Sketch): { x: number; y: number }[] {
    const p1 = sketch.points.get(line1.p1);
    const p2 = sketch.points.get(line1.p2);
    const p3 = sketch.points.get(line2.p1);
    const p4 = sketch.points.get(line2.p2);

    if (!p1 || !p2 || !p3 || !p4) return [];

    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(denom) < 1e-10) return []; // Parallel

    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

    // Check if intersection is within both line segments
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
      return [
        {
          x: p1.x + ua * (p2.x - p1.x),
          y: p1.y + ua * (p2.y - p1.y),
        },
      ];
    }

    return [];
  }

  private lineCircleIntersection(line: Line, circle: Circle, sketch: Sketch): { x: number; y: number }[] {
    const p1 = sketch.points.get(line.p1);
    const p2 = sketch.points.get(line.p2);
    const center = sketch.points.get(circle.center);

    if (!p1 || !p2 || !center) return [];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const fx = p1.x - center.x;
    const fy = p1.y - center.y;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - circle.radius * circle.radius;

    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return [];

    const results: { x: number; y: number }[] = [];
    const sqrtDisc = Math.sqrt(discriminant);

    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);

    if (t1 >= 0 && t1 <= 1) {
      results.push({ x: p1.x + t1 * dx, y: p1.y + t1 * dy });
    }
    if (t2 >= 0 && t2 <= 1 && Math.abs(t1 - t2) > 1e-10) {
      results.push({ x: p1.x + t2 * dx, y: p1.y + t2 * dy });
    }

    return results;
  }

  private circleCircleIntersection(c1: Circle, c2: Circle, sketch: Sketch): { x: number; y: number }[] {
    const center1 = sketch.points.get(c1.center);
    const center2 = sketch.points.get(c2.center);

    if (!center1 || !center2) return [];

    const d = distance(center1, center2);

    // Too far apart or one contains the other
    if (d > c1.radius + c2.radius || d < Math.abs(c1.radius - c2.radius)) {
      return [];
    }

    // Same circle
    if (d < 1e-10 && Math.abs(c1.radius - c2.radius) < 1e-10) {
      return [];
    }

    const a = (c1.radius * c1.radius - c2.radius * c2.radius + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, c1.radius * c1.radius - a * a));

    const px = center1.x + (a * (center2.x - center1.x)) / d;
    const py = center1.y + (a * (center2.y - center1.y)) / d;

    const results: { x: number; y: number }[] = [];

    results.push({
      x: px + (h * (center2.y - center1.y)) / d,
      y: py - (h * (center2.x - center1.x)) / d,
    });

    if (h > 1e-10) {
      results.push({
        x: px - (h * (center2.y - center1.y)) / d,
        y: py + (h * (center2.x - center1.x)) / d,
      });
    }

    return results;
  }

  /**
   * Point le plus proche sur une ligne
   */
  private nearestPointOnLine(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p: { x: number; y: number },
  ): { x: number; y: number } {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len2 = dx * dx + dy * dy;

    if (len2 < 1e-10) return { x: p1.x, y: p1.y };

    let t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));

    return {
      x: p1.x + t * dx,
      y: p1.y + t * dy,
    };
  }

  /**
   * Snap à la grille
   */
  private snapToGrid(x: number, y: number, scaleFactor: number): { x: number; y: number } {
    const gridSize = this.settings.gridSize * scaleFactor; // Convert mm to px
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    };
  }

  /**
   * Conversion coordonnées écran -> monde
   */
  screenToWorld(screenX: number, screenY: number, viewport: Viewport): { x: number; y: number } {
    return {
      x: (screenX - viewport.offsetX) / viewport.scale,
      y: (screenY - viewport.offsetY) / viewport.scale,
    };
  }

  /**
   * Conversion coordonnées monde -> écran
   */
  worldToScreen(worldX: number, worldY: number, viewport: Viewport): { x: number; y: number } {
    return {
      x: worldX * viewport.scale + viewport.offsetX,
      y: worldY * viewport.scale + viewport.offsetY,
    };
  }

  /**
   * Obtient l'icône pour un type de snap
   */
  static getSnapIcon(type: SnapType): string {
    const icons: Record<SnapType, string> = {
      endpoint: "●",
      midpoint: "◆",
      center: "⊕",
      intersection: "✕",
      quadrant: "◇",
      tangent: "○",
      perpendicular: "⊥",
      nearest: "~",
      grid: "#",
      marker: "📍",
    };
    return icons[type] || "•";
  }

  /**
   * Obtient le nom pour un type de snap
   */
  static getSnapName(type: SnapType): string {
    const names: Record<SnapType, string> = {
      endpoint: "Extrémité",
      midpoint: "Milieu",
      center: "Centre",
      intersection: "Intersection",
      quadrant: "Quadrant",
      tangent: "Tangent",
      perpendicular: "Perpendiculaire",
      nearest: "Plus proche",
      grid: "Grille",
      marker: "Marqueur",
    };
    return names[type] || type;
  }
}

export default SnapSystem;
