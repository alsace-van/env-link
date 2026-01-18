// ============================================
// HOOK: useAutoDimensions
// Cotations automatiques lors de la création de géométries
// VERSION: 1.1
// ============================================
// CHANGELOG:
// v1.1 - Fix: passer le sketch en paramètre pour utiliser le bon contexte
// v1.0 - Cotations automatiques pour rectangles et lignes
// ============================================

import { useCallback, useRef } from "react";
import type { Sketch, Dimension, Point, Line, Rectangle } from "./types";
import { generateId, distance } from "./types";

interface UseAutoDimensionsOptions {
  enabled: boolean;
  sketchRef: React.MutableRefObject<Sketch>;
}

interface AutoDimensionResult {
  dimensions: Dimension[];
}

export function useAutoDimensions({ enabled, sketchRef }: UseAutoDimensionsOptions) {
  // Garder une trace des géométries déjà cotées pour éviter les doublons
  const dimensionedGeometriesRef = useRef<Set<string>>(new Set());

  /**
   * Créer une cotation linéaire entre deux points
   * v1.1: Le sketch peut être passé en paramètre pour utiliser un nouveau sketch
   */
  const createLinearDimension = useCallback(
    (
      p1Id: string,
      p2Id: string,
      type: "linear" | "horizontal" | "vertical" = "linear",
      sketchOverride?: Sketch,
    ): Dimension | null => {
      const sketch = sketchOverride || sketchRef.current;
      const p1 = sketch.points.get(p1Id);
      const p2 = sketch.points.get(p2Id);

      if (!p1 || !p2) {
        console.warn("[AutoDimensions] Points non trouvés:", p1Id, p2Id);
        return null;
      }

      // Calculer la distance en mm
      const dist = distance(p1, p2);
      const distMm = dist / sketch.scaleFactor;

      // Position du texte (au milieu, légèrement décalé)
      const position = {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2 - 20 / sketch.scaleFactor,
      };

      console.log("[AutoDimensions] Dimension créée:", type, distMm.toFixed(2), "mm");

      return {
        id: generateId(),
        type,
        entities: [p1Id, p2Id],
        value: distMm,
        position,
      };
    },
    [sketchRef],
  );

  /**
   * Ajouter des cotations automatiques pour un rectangle
   * Crée une cotation horizontale (largeur) et une verticale (hauteur)
   * v1.1: Le sketch peut être passé en paramètre
   */
  const addRectangleDimensions = useCallback(
    (
      corner1Id: string,
      corner2Id: string,
      corner3Id: string,
      corner4Id: string,
      sketchOverride?: Sketch,
    ): Dimension[] => {
      if (!enabled) {
        console.log("[AutoDimensions] Désactivé");
        return [];
      }

      const sketch = sketchOverride || sketchRef.current;
      const dimensions: Dimension[] = [];

      // Créer un ID unique pour ce rectangle basé sur ses coins
      const rectKey = [corner1Id, corner2Id, corner3Id, corner4Id].sort().join("-");

      // Éviter les doublons
      if (dimensionedGeometriesRef.current.has(rectKey)) {
        console.log("[AutoDimensions] Rectangle déjà coté");
        return [];
      }
      dimensionedGeometriesRef.current.add(rectKey);

      const c1 = sketch.points.get(corner1Id);
      const c2 = sketch.points.get(corner2Id);
      const c3 = sketch.points.get(corner3Id);
      const c4 = sketch.points.get(corner4Id);

      if (!c1 || !c2 || !c3 || !c4) {
        console.warn("[AutoDimensions] Coins non trouvés dans le sketch");
        return [];
      }

      console.log("[AutoDimensions] Création cotations pour rectangle");

      // Cotation horizontale (largeur) - entre c1 et c2
      const widthDim = createLinearDimension(corner1Id, corner2Id, "horizontal", sketch);
      if (widthDim) {
        dimensions.push(widthDim);
      }

      // Cotation verticale (hauteur) - entre c2 et c3
      const heightDim = createLinearDimension(corner2Id, corner3Id, "vertical", sketch);
      if (heightDim) {
        dimensions.push(heightDim);
      }

      console.log("[AutoDimensions] Dimensions créées:", dimensions.length);
      return dimensions;
    },
    [enabled, sketchRef, createLinearDimension],
  );

  /**
   * Ajouter une cotation automatique pour une ligne
   * v1.1: Le sketch peut être passé en paramètre
   */
  const addLineDimension = useCallback(
    (lineId: string, p1Id: string, p2Id: string, sketchOverride?: Sketch): Dimension | null => {
      if (!enabled) return null;

      // Éviter les doublons
      if (dimensionedGeometriesRef.current.has(lineId)) {
        return null;
      }
      dimensionedGeometriesRef.current.add(lineId);

      const sketch = sketchOverride || sketchRef.current;
      const p1 = sketch.points.get(p1Id);
      const p2 = sketch.points.get(p2Id);

      if (!p1 || !p2) return null;

      // Déterminer le type de cotation selon l'orientation de la ligne
      const dx = Math.abs(p2.x - p1.x);
      const dy = Math.abs(p2.y - p1.y);

      let dimType: "linear" | "horizontal" | "vertical" = "linear";

      // Si la ligne est quasi-horizontale (angle < 15°)
      if (dy < dx * 0.27) {
        dimType = "horizontal";
      }
      // Si la ligne est quasi-verticale (angle > 75°)
      else if (dx < dy * 0.27) {
        dimType = "vertical";
      }

      return createLinearDimension(p1Id, p2Id, dimType, sketch);
    },
    [enabled, sketchRef, createLinearDimension],
  );

  /**
   * Supprimer les cotations associées à une géométrie
   */
  const removeDimensionsForGeometry = useCallback((geometryId: string) => {
    dimensionedGeometriesRef.current.delete(geometryId);
  }, []);

  /**
   * Réinitialiser le suivi des géométries cotées
   */
  const reset = useCallback(() => {
    dimensionedGeometriesRef.current.clear();
  }, []);

  return {
    addRectangleDimensions,
    addLineDimension,
    removeDimensionsForGeometry,
    reset,
    createLinearDimension,
  };
}

export default useAutoDimensions;
