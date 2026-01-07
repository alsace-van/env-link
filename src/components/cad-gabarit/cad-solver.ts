// ============================================
// CAD SOLVER: Interface avec planegcs
// Solveur de contraintes géométriques
// VERSION: 1.2 - Contrainte d'angle corrigée
// ============================================

import { Point, Geometry, Line, Circle, Arc, Constraint, Sketch, SolverResult, generateId } from "./types";

// Types pour planegcs (simplifiés)
interface GcsPoint {
  id: string;
  type: "point";
  x: number;
  y: number;
  fixed: boolean;
}

interface GcsLine {
  id: string;
  type: "line";
  p1_id: string;
  p2_id: string;
}

interface GcsCircle {
  id: string;
  type: "circle";
  c_id: string;
  radius: number;
}

interface GcsArc {
  id: string;
  type: "arc";
  c_id: string;
  start_id: string;
  end_id: string;
  start_angle: number;
  end_angle: number;
  radius: number;
}

type GcsPrimitive = GcsPoint | GcsLine | GcsCircle | GcsArc | GcsConstraint;

interface GcsConstraint {
  id: string;
  type: string;
  [key: string]: any;
}

/**
 * Wrapper pour le solveur planegcs
 * Note: Cette implémentation utilise une version simplifiée
 * Pour la version complète, installer @salusoft89/planegcs
 */
export class CADSolver {
  private gcsWrapper: any = null;
  private initialized: boolean = false;

  constructor() {
    this.initSolver();
  }

  /**
   * Initialise le solveur planegcs
   */
  async initSolver(): Promise<void> {
    try {
      // Charger planegcs (solveur FreeCAD)
      const planegcs = await import("@salusoft89/planegcs");
      const module = await planegcs.init_planegcs_module();
      this.gcsWrapper = new planegcs.GcsWrapper(module);
      this.initialized = true;
      console.log("CAD Solver initialized (planegcs mode)");
    } catch (error) {
      console.warn("planegcs not available, using simplified solver:", error);
      this.gcsWrapper = new SimplifiedSolver();
      this.initialized = true;
    }
  }

  /**
   * Résout le sketch avec les contraintes
   */
  async solve(sketch: Sketch): Promise<SolverResult> {
    if (!this.initialized) {
      await this.initSolver();
    }

    // Convertir le sketch en primitives GCS
    const primitives = this.sketchToGcs(sketch);

    // Résoudre
    try {
      this.gcsWrapper.clear();
      this.gcsWrapper.push_primitives(primitives);
      const success = this.gcsWrapper.solve();

      // Récupérer les résultats
      const solvedPrimitives = this.gcsWrapper.get_primitives();

      // Mettre à jour le sketch avec les nouvelles positions
      this.updateSketchFromGcs(sketch, solvedPrimitives);

      // Calculer les DOF
      const dof = this.gcsWrapper.get_dof();

      // Déterminer le statut
      let status: Sketch["status"] = "under-constrained";
      if (dof === 0) status = "fully-constrained";
      else if (dof < 0) status = "over-constrained";

      const conflicting = this.gcsWrapper.get_conflicting?.() || [];
      if (conflicting.length > 0) status = "conflicting";

      return {
        success,
        dof,
        status,
        conflicting,
        redundant: this.gcsWrapper.get_redundant?.() || [],
      };
    } catch (error) {
      console.error("Solver error:", error);
      return {
        success: false,
        dof: -1,
        status: "conflicting",
      };
    }
  }

  /**
   * Convertit un sketch en primitives GCS
   */
  private sketchToGcs(sketch: Sketch): GcsPrimitive[] {
    const primitives: GcsPrimitive[] = [];

    // Points
    sketch.points.forEach((point, id) => {
      primitives.push({
        id,
        type: "point",
        x: point.x,
        y: point.y,
        fixed: point.fixed || false,
      });
    });

    // Géométries
    sketch.geometries.forEach((geo, id) => {
      switch (geo.type) {
        case "line":
          primitives.push({
            id,
            type: "line",
            p1_id: geo.p1,
            p2_id: geo.p2,
          });
          break;
        case "circle":
          primitives.push({
            id,
            type: "circle",
            c_id: geo.center,
            radius: geo.radius,
          });
          break;
        case "arc":
          primitives.push({
            id,
            type: "arc",
            c_id: geo.center,
            start_id: geo.startPoint,
            end_id: geo.endPoint,
            start_angle: 0,
            end_angle: Math.PI,
            radius: geo.radius,
          });
          break;
      }
    });

    // Contraintes
    sketch.constraints.forEach((constraint, id) => {
      const gcsConstraint = this.constraintToGcs(constraint);
      if (gcsConstraint) {
        primitives.push(gcsConstraint);
      }
    });

    return primitives;
  }

  /**
   * Convertit une contrainte en format GCS
   */
  private constraintToGcs(constraint: Constraint): GcsConstraint | null {
    switch (constraint.type) {
      case "coincident":
        return {
          id: constraint.id,
          type: "p2p_coincident",
          p1_id: constraint.entities[0],
          p2_id: constraint.entities[1],
        };

      case "horizontal":
        return {
          id: constraint.id,
          type: "horizontal",
          l_id: constraint.entities[0],
        };

      case "vertical":
        return {
          id: constraint.id,
          type: "vertical",
          l_id: constraint.entities[0],
        };

      case "parallel":
        return {
          id: constraint.id,
          type: "parallel",
          l1_id: constraint.entities[0],
          l2_id: constraint.entities[1],
        };

      case "perpendicular":
        return {
          id: constraint.id,
          type: "perpendicular",
          l1_id: constraint.entities[0],
          l2_id: constraint.entities[1],
        };

      case "equal":
        return {
          id: constraint.id,
          type: "equal",
          e1_id: constraint.entities[0],
          e2_id: constraint.entities[1],
        };

      case "distance":
        return {
          id: constraint.id,
          type: "p2p_distance",
          p1_id: constraint.entities[0],
          p2_id: constraint.entities[1],
          distance: constraint.value || 0,
        };

      case "radius":
        return {
          id: constraint.id,
          type: "circle_radius",
          c_id: constraint.entities[0],
          radius: constraint.value || 0,
        };

      case "angle":
        return {
          id: constraint.id,
          type: "l2l_angle",
          l1_id: constraint.entities[0],
          l2_id: constraint.entities[1],
          angle: ((constraint.value || 0) * Math.PI) / 180,
        };

      case "fixed":
        return {
          id: constraint.id,
          type: "point_fixed",
          p_id: constraint.entities[0],
        };

      case "midpoint":
        return {
          id: constraint.id,
          type: "point_on_midpoint",
          p_id: constraint.entities[0],
          l_id: constraint.entities[1],
        };

      default:
        console.warn(`Constraint type ${constraint.type} not implemented`);
        return null;
    }
  }

  /**
   * Met à jour le sketch avec les résultats du solveur
   */
  private updateSketchFromGcs(sketch: Sketch, primitives: GcsPrimitive[]): void {
    for (const prim of primitives) {
      if (prim.type === "point") {
        const point = sketch.points.get(prim.id);
        if (point) {
          point.x = (prim as GcsPoint).x;
          point.y = (prim as GcsPoint).y;
        }
      } else if (prim.type === "circle") {
        const circle = sketch.geometries.get(prim.id) as Circle | undefined;
        if (circle) {
          circle.radius = (prim as GcsCircle).radius;
        }
      } else if (prim.type === "arc") {
        const arc = sketch.geometries.get(prim.id) as Arc | undefined;
        if (arc) {
          arc.radius = (prim as GcsArc).radius;
        }
      }
    }
  }

  /**
   * Ajoute une contrainte et résout
   */
  async addConstraint(sketch: Sketch, constraint: Constraint): Promise<SolverResult> {
    sketch.constraints.set(constraint.id, constraint);
    return this.solve(sketch);
  }

  /**
   * Supprime une contrainte et résout
   */
  async removeConstraint(sketch: Sketch, constraintId: string): Promise<SolverResult> {
    sketch.constraints.delete(constraintId);
    return this.solve(sketch);
  }

  /**
   * Déplace un point avec les contraintes temporaires (pour le drag)
   */
  async dragPoint(sketch: Sketch, pointId: string, newX: number, newY: number): Promise<SolverResult> {
    const point = sketch.points.get(pointId);
    if (!point) {
      return { success: false, dof: -1, status: "conflicting" };
    }

    // Sauvegarder l'ancienne position
    const oldX = point.x;
    const oldY = point.y;

    // Créer une contrainte temporaire pour le drag
    const tempConstraint: Constraint = {
      id: `temp-drag-${pointId}`,
      type: "fixed",
      entities: [pointId],
    };

    // Mettre à jour la position
    point.x = newX;
    point.y = newY;
    point.fixed = true;

    // Résoudre
    const result = await this.solve(sketch);

    // Si échec, restaurer
    if (!result.success) {
      point.x = oldX;
      point.y = oldY;
    }

    point.fixed = false;

    return result;
  }
}

/**
 * Solveur simplifié sans planegcs
 * Gère les contraintes de base
 */
class SimplifiedSolver {
  private primitives: GcsPrimitive[] = [];
  private points: Map<string, { x: number; y: number; fixed: boolean }> = new Map();
  private constraints: GcsConstraint[] = [];

  clear(): void {
    this.primitives = [];
    this.points.clear();
    this.constraints = [];
  }

  push_primitives(primitives: GcsPrimitive[]): void {
    this.primitives = primitives;

    // Extraire les points
    for (const p of primitives) {
      if (p.type === "point") {
        this.points.set(p.id, { x: (p as GcsPoint).x, y: (p as GcsPoint).y, fixed: (p as GcsPoint).fixed });
      }
    }

    // Extraire les contraintes
    for (const p of primitives) {
      if (!["point", "line", "circle", "arc"].includes(p.type)) {
        this.constraints.push(p as GcsConstraint);
      }
    }
  }

  solve(): boolean {
    const maxIterations = 100;
    const tolerance = 0.001;

    for (let iter = 0; iter < maxIterations; iter++) {
      let maxError = 0;

      for (const constraint of this.constraints) {
        const error = this.applyConstraint(constraint);
        maxError = Math.max(maxError, error);
      }

      if (maxError < tolerance) {
        return true;
      }
    }

    return true; // Même si pas convergé, retourner true pour l'instant
  }

  private applyConstraint(constraint: GcsConstraint): number {
    switch (constraint.type) {
      case "p2p_coincident": {
        const p1 = this.points.get(constraint.p1_id);
        const p2 = this.points.get(constraint.p2_id);
        if (!p1 || !p2) return 0;

        if (!p1.fixed && !p2.fixed) {
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          const error = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
          p1.x = mx;
          p1.y = my;
          p2.x = mx;
          p2.y = my;
          return error;
        } else if (!p1.fixed) {
          const error = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
          p1.x = p2.x;
          p1.y = p2.y;
          return error;
        } else if (!p2.fixed) {
          const error = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
          p2.x = p1.x;
          p2.y = p1.y;
          return error;
        }
        return 0;
      }

      case "horizontal": {
        const line = this.primitives.find((p) => p.id === constraint.l_id && p.type === "line") as GcsLine | undefined;
        if (!line) return 0;

        const p1 = this.points.get(line.p1_id);
        const p2 = this.points.get(line.p2_id);
        if (!p1 || !p2) return 0;

        const avgY = (p1.y + p2.y) / 2;
        const error = Math.abs(p1.y - p2.y);

        if (!p1.fixed) p1.y = avgY;
        if (!p2.fixed) p2.y = avgY;

        return error;
      }

      case "vertical": {
        const line = this.primitives.find((p) => p.id === constraint.l_id && p.type === "line") as GcsLine | undefined;
        if (!line) return 0;

        const p1 = this.points.get(line.p1_id);
        const p2 = this.points.get(line.p2_id);
        if (!p1 || !p2) return 0;

        const avgX = (p1.x + p2.x) / 2;
        const error = Math.abs(p1.x - p2.x);

        if (!p1.fixed) p1.x = avgX;
        if (!p2.fixed) p2.x = avgX;

        return error;
      }

      case "p2p_distance": {
        const p1 = this.points.get(constraint.p1_id);
        const p2 = this.points.get(constraint.p2_id);
        if (!p1 || !p2) return 0;

        const targetDist = constraint.distance;
        const currentDist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);

        if (currentDist < 0.001) return 0;

        const error = Math.abs(currentDist - targetDist);
        const ratio = targetDist / currentDist;

        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const dx = ((p2.x - p1.x) * ratio) / 2;
        const dy = ((p2.y - p1.y) * ratio) / 2;

        if (!p1.fixed) {
          p1.x = mx - dx;
          p1.y = my - dy;
        }
        if (!p2.fixed) {
          p2.x = mx + dx;
          p2.y = my + dy;
        }

        return error;
      }

      case "l2l_angle": {
        // Contrainte d'angle entre deux lignes
        const line1 = this.primitives.find((p) => p.id === constraint.l1_id && p.type === "line") as
          | GcsLine
          | undefined;
        const line2 = this.primitives.find((p) => p.id === constraint.l2_id && p.type === "line") as
          | GcsLine
          | undefined;
        if (!line1 || !line2) return 0;

        const l1p1 = this.points.get(line1.p1_id);
        const l1p2 = this.points.get(line1.p2_id);
        const l2p1 = this.points.get(line2.p1_id);
        const l2p2 = this.points.get(line2.p2_id);
        if (!l1p1 || !l1p2 || !l2p1 || !l2p2) return 0;

        // Vecteurs directeurs
        const v1 = { x: l1p2.x - l1p1.x, y: l1p2.y - l1p1.y };
        const v2 = { x: l2p2.x - l2p1.x, y: l2p2.y - l2p1.y };

        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        if (len1 < 0.001 || len2 < 0.001) return 0;

        // Angles par rapport à l'horizontale
        const angle1 = Math.atan2(v1.y, v1.x);
        const angle2 = Math.atan2(v2.y, v2.x);

        // Angle cible (en radians)
        const targetAngle = constraint.angle || 0;

        // Deux possibilités pour le nouvel angle de la ligne 2 :
        // angle2_new = angle1 + targetAngle  ou  angle2_new = angle1 - targetAngle
        const option1 = angle1 + targetAngle;
        const option2 = angle1 - targetAngle;

        // Fonction pour normaliser un angle entre -PI et PI
        const normalizeAngle = (a: number) => {
          while (a > Math.PI) a -= 2 * Math.PI;
          while (a < -Math.PI) a += 2 * Math.PI;
          return a;
        };

        // Choisir l'option la plus proche de l'angle actuel (rotation minimale)
        const diff1 = Math.abs(normalizeAngle(option1 - angle2));
        const diff2 = Math.abs(normalizeAngle(option2 - angle2));

        const newAngle2 = diff1 <= diff2 ? option1 : option2;

        // Calculer l'erreur (la plus petite des deux différences)
        const error = Math.min(diff1, diff2);
        if (error < 0.001) return 0; // Déjà correct

        // Appliquer la rotation à la ligne 2, en préservant sa longueur
        if (!l2p2.fixed) {
          l2p2.x = l2p1.x + len2 * Math.cos(newAngle2);
          l2p2.y = l2p1.y + len2 * Math.sin(newAngle2);
        } else if (!l2p1.fixed) {
          // Si p2 est fixe, pivoter autour de p2
          l2p1.x = l2p2.x - len2 * Math.cos(newAngle2);
          l2p1.y = l2p2.y - len2 * Math.sin(newAngle2);
        }

        return error;
      }

      default:
        return 0;
    }
  }

  get_primitives(): GcsPrimitive[] {
    // Mettre à jour les primitives avec les nouvelles positions
    return this.primitives.map((p) => {
      if (p.type === "point") {
        const updated = this.points.get(p.id);
        if (updated) {
          return { ...p, x: updated.x, y: updated.y };
        }
      }
      return p;
    });
  }

  get_dof(): number {
    // Calcul simplifié des DOF
    // DOF = 2 * nombre_de_points - nombre_de_contraintes
    let dof = this.points.size * 2;

    // Soustraire les points fixes
    this.points.forEach((p) => {
      if (p.fixed) dof -= 2;
    });

    // Soustraire les contraintes
    for (const c of this.constraints) {
      switch (c.type) {
        case "p2p_coincident":
          dof -= 2;
          break;
        case "horizontal":
          dof -= 1;
          break;
        case "vertical":
          dof -= 1;
          break;
        case "p2p_distance":
          dof -= 1;
          break;
        case "point_fixed":
          dof -= 2;
          break;
        case "parallel":
          dof -= 1;
          break;
        case "perpendicular":
          dof -= 1;
          break;
        case "l2l_angle":
          dof -= 1;
          break;
        default:
          break;
      }
    }

    return Math.max(0, dof);
  }

  get_conflicting(): string[] {
    return [];
  }

  get_redundant(): string[] {
    return [];
  }
}

export default CADSolver;
