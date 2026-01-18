// ============================================
// HOOK: useLayerManager
// Gestion complète des calques CAD
// VERSION: 1.0
// ============================================

import { useCallback } from "react";
import { Layer, Sketch, generateId } from "./types";
import { toast } from "sonner";

// Couleurs disponibles pour les calques
export const LAYER_COLORS = [
  "#3B82F6", // Bleu
  "#10B981", // Vert
  "#F59E0B", // Orange
  "#8B5CF6", // Violet
  "#EC4899", // Rose
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#EF4444", // Rouge
  "#6366F1", // Indigo
  "#14B8A6", // Teal
];

interface UseLayerManagerProps {
  sketch: Sketch;
  setSketch: React.Dispatch<React.SetStateAction<Sketch>>;
}

export function useLayerManager({ sketch, setSketch }: UseLayerManagerProps) {
  // Créer un nouveau calque
  const createLayer = useCallback(
    (name?: string) => {
      const newLayerId = generateId();
      const layerCount = sketch.layers.size;
      const newLayer: Layer = {
        id: newLayerId,
        name: name || `Calque ${layerCount + 1}`,
        color: LAYER_COLORS[layerCount % LAYER_COLORS.length],
        visible: true,
        locked: false,
        order: layerCount,
        opacity: 1,
      };

      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        newLayers.set(newLayerId, newLayer);
        return { ...prev, layers: newLayers, activeLayerId: newLayerId };
      });

      toast.success(`Calque "${newLayer.name}" créé`);
      return newLayerId;
    },
    [sketch.layers.size, setSketch]
  );

  // Renommer un calque
  const renameLayer = useCallback(
    (layerId: string, newName: string) => {
      if (!newName.trim()) return;

      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const layer = newLayers.get(layerId);
        if (layer) {
          newLayers.set(layerId, { ...layer, name: newName.trim() });
        }
        return { ...prev, layers: newLayers };
      });
    },
    [setSketch]
  );

  // Changer la couleur d'un calque
  const setLayerColor = useCallback(
    (layerId: string, color: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const layer = newLayers.get(layerId);
        if (layer) {
          newLayers.set(layerId, { ...layer, color });
        }
        return { ...prev, layers: newLayers };
      });
    },
    [setSketch]
  );

  // Changer l'opacité d'un calque
  const setLayerOpacity = useCallback(
    (layerId: string, opacity: number) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const layer = newLayers.get(layerId);
        if (layer) {
          newLayers.set(layerId, { ...layer, opacity: Math.max(0, Math.min(1, opacity)) });
        }
        return { ...prev, layers: newLayers };
      });
    },
    [setSketch]
  );

  // Toggle visibilité
  const toggleLayerVisibility = useCallback(
    (layerId: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const layer = newLayers.get(layerId);
        if (layer) {
          newLayers.set(layerId, { ...layer, visible: !layer.visible });
        }
        return { ...prev, layers: newLayers };
      });
    },
    [setSketch]
  );

  // Toggle verrouillage
  const toggleLayerLock = useCallback(
    (layerId: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const layer = newLayers.get(layerId);
        if (layer) {
          newLayers.set(layerId, { ...layer, locked: !layer.locked });
          toast.success(layer.locked ? `"${layer.name}" déverrouillé` : `"${layer.name}" verrouillé`);
        }
        return { ...prev, layers: newLayers };
      });
    },
    [setSketch]
  );

  // Supprimer un calque
  const deleteLayer = useCallback(
    (layerId: string) => {
      if (sketch.layers.size <= 1) {
        toast.error("Impossible de supprimer le dernier calque");
        return;
      }

      const layer = sketch.layers.get(layerId);
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        newLayers.delete(layerId);

        // Si on supprime le calque actif, sélectionner le premier restant
        let newActiveLayerId = prev.activeLayerId;
        if (prev.activeLayerId === layerId) {
          newActiveLayerId = Array.from(newLayers.keys())[0];
        }

        // Réorganiser les orders
        const sortedLayers = Array.from(newLayers.values()).sort((a, b) => a.order - b.order);
        sortedLayers.forEach((l, index) => {
          newLayers.set(l.id, { ...l, order: index });
        });

        return { ...prev, layers: newLayers, activeLayerId: newActiveLayerId };
      });

      if (layer) {
        toast.success(`Calque "${layer.name}" supprimé`);
      }
    },
    [sketch.layers, setSketch]
  );

  // Dupliquer un calque
  const duplicateLayer = useCallback(
    (layerId: string) => {
      const sourceLayer = sketch.layers.get(layerId);
      if (!sourceLayer) return;

      const newLayerId = generateId();
      const newLayer: Layer = {
        ...sourceLayer,
        id: newLayerId,
        name: `${sourceLayer.name} (copie)`,
        order: sketch.layers.size,
      };

      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        newLayers.set(newLayerId, newLayer);

        // Dupliquer aussi les géométries et points de ce calque
        const newGeometries = new Map(prev.geometries);
        const newPoints = new Map(prev.points);
        const pointIdMap = new Map<string, string>(); // ancien ID -> nouveau ID

        // D'abord dupliquer les points associés aux géométries du calque
        prev.geometries.forEach((geo) => {
          if (geo.layerId === layerId) {
            // Trouver tous les points de cette géométrie
            const pointIds: string[] = [];
            if ("p1" in geo && geo.p1) pointIds.push(geo.p1);
            if ("p2" in geo && geo.p2) pointIds.push(geo.p2);
            if ("p3" in geo && geo.p3) pointIds.push(geo.p3 as string);
            if ("p4" in geo && geo.p4) pointIds.push(geo.p4 as string);
            if ("center" in geo && geo.center) pointIds.push(geo.center);
            if ("startPoint" in geo && geo.startPoint) pointIds.push(geo.startPoint as string);
            if ("endPoint" in geo && geo.endPoint) pointIds.push(geo.endPoint as string);
            if ("cp1" in geo && geo.cp1) pointIds.push(geo.cp1 as string);
            if ("cp2" in geo && geo.cp2) pointIds.push(geo.cp2 as string);
            if ("position" in geo && geo.position) pointIds.push(geo.position as string);
            if ("points" in geo && Array.isArray(geo.points)) pointIds.push(...geo.points);

            pointIds.forEach((pid) => {
              if (!pointIdMap.has(pid)) {
                const point = prev.points.get(pid);
                if (point) {
                  const newPointId = generateId();
                  pointIdMap.set(pid, newPointId);
                  newPoints.set(newPointId, { ...point, id: newPointId });
                }
              }
            });
          }
        });

        // Ensuite dupliquer les géométries avec les nouveaux IDs de points
        prev.geometries.forEach((geo) => {
          if (geo.layerId === layerId) {
            const newGeoId = generateId();
            const newGeo = { ...geo, id: newGeoId, layerId: newLayerId };

            // Remplacer les IDs de points
            if ("p1" in newGeo && newGeo.p1) newGeo.p1 = pointIdMap.get(newGeo.p1) || newGeo.p1;
            if ("p2" in newGeo && newGeo.p2) newGeo.p2 = pointIdMap.get(newGeo.p2) || newGeo.p2;
            if ("p3" in newGeo && newGeo.p3) (newGeo as any).p3 = pointIdMap.get(newGeo.p3 as string) || newGeo.p3;
            if ("p4" in newGeo && newGeo.p4) (newGeo as any).p4 = pointIdMap.get(newGeo.p4 as string) || newGeo.p4;
            if ("center" in newGeo && newGeo.center) (newGeo as any).center = pointIdMap.get(newGeo.center) || newGeo.center;
            if ("startPoint" in newGeo && newGeo.startPoint) (newGeo as any).startPoint = pointIdMap.get(newGeo.startPoint as string) || newGeo.startPoint;
            if ("endPoint" in newGeo && newGeo.endPoint) (newGeo as any).endPoint = pointIdMap.get(newGeo.endPoint as string) || newGeo.endPoint;
            if ("cp1" in newGeo && newGeo.cp1) (newGeo as any).cp1 = pointIdMap.get(newGeo.cp1 as string) || newGeo.cp1;
            if ("cp2" in newGeo && newGeo.cp2) (newGeo as any).cp2 = pointIdMap.get(newGeo.cp2 as string) || newGeo.cp2;
            if ("position" in newGeo && newGeo.position) (newGeo as any).position = pointIdMap.get(newGeo.position as string) || newGeo.position;
            if ("points" in newGeo && Array.isArray(newGeo.points)) {
              (newGeo as any).points = newGeo.points.map((pid: string) => pointIdMap.get(pid) || pid);
            }

            newGeometries.set(newGeoId, newGeo);
          }
        });

        return {
          ...prev,
          layers: newLayers,
          geometries: newGeometries,
          points: newPoints,
          activeLayerId: newLayerId,
        };
      });

      toast.success(`Calque "${sourceLayer.name}" dupliqué`);
      return newLayerId;
    },
    [sketch.layers, setSketch]
  );

  // Déplacer un calque vers l'avant (order +1)
  const moveLayerUp = useCallback(
    (layerId: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const sortedLayers = Array.from(newLayers.values()).sort((a, b) => a.order - b.order);
        const layerIndex = sortedLayers.findIndex((l) => l.id === layerId);

        if (layerIndex < sortedLayers.length - 1) {
          // Échanger avec le calque suivant
          const currentLayer = sortedLayers[layerIndex];
          const nextLayer = sortedLayers[layerIndex + 1];

          newLayers.set(currentLayer.id, { ...currentLayer, order: nextLayer.order });
          newLayers.set(nextLayer.id, { ...nextLayer, order: currentLayer.order });
        }

        return { ...prev, layers: newLayers };
      });
    },
    [setSketch]
  );

  // Déplacer un calque vers l'arrière (order -1)
  const moveLayerDown = useCallback(
    (layerId: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const sortedLayers = Array.from(newLayers.values()).sort((a, b) => a.order - b.order);
        const layerIndex = sortedLayers.findIndex((l) => l.id === layerId);

        if (layerIndex > 0) {
          // Échanger avec le calque précédent
          const currentLayer = sortedLayers[layerIndex];
          const prevLayer = sortedLayers[layerIndex - 1];

          newLayers.set(currentLayer.id, { ...currentLayer, order: prevLayer.order });
          newLayers.set(prevLayer.id, { ...prevLayer, order: currentLayer.order });
        }

        return { ...prev, layers: newLayers };
      });
    },
    [setSketch]
  );

  // Mettre un calque au premier plan
  const bringLayerToFront = useCallback(
    (layerId: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const sortedLayers = Array.from(newLayers.values()).sort((a, b) => a.order - b.order);
        const maxOrder = sortedLayers.length - 1;

        const layer = newLayers.get(layerId);
        if (layer && layer.order < maxOrder) {
          // Décaler tous les calques au-dessus
          sortedLayers.forEach((l) => {
            if (l.order > layer.order) {
              newLayers.set(l.id, { ...l, order: l.order - 1 });
            }
          });
          newLayers.set(layerId, { ...layer, order: maxOrder });
        }

        return { ...prev, layers: newLayers };
      });
      toast.success("Calque mis au premier plan");
    },
    [setSketch]
  );

  // Mettre un calque en arrière-plan
  const sendLayerToBack = useCallback(
    (layerId: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const sortedLayers = Array.from(newLayers.values()).sort((a, b) => a.order - b.order);

        const layer = newLayers.get(layerId);
        if (layer && layer.order > 0) {
          // Décaler tous les calques en-dessous
          sortedLayers.forEach((l) => {
            if (l.order < layer.order) {
              newLayers.set(l.id, { ...l, order: l.order + 1 });
            }
          });
          newLayers.set(layerId, { ...layer, order: 0 });
        }

        return { ...prev, layers: newLayers };
      });
      toast.success("Calque mis en arrière-plan");
    },
    [setSketch]
  );

  // Réordonner les calques (pour drag & drop)
  const reorderLayers = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;

      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const sortedLayers = Array.from(newLayers.values()).sort((a, b) => a.order - b.order);

        const sourceIndex = sortedLayers.findIndex((l) => l.id === sourceId);
        const targetIndex = sortedLayers.findIndex((l) => l.id === targetId);

        if (sourceIndex === -1 || targetIndex === -1) return prev;

        // Retirer le calque source
        const [movedLayer] = sortedLayers.splice(sourceIndex, 1);
        // L'insérer à la position cible
        sortedLayers.splice(targetIndex, 0, movedLayer);

        // Réassigner les orders
        sortedLayers.forEach((layer, index) => {
          newLayers.set(layer.id, { ...layer, order: index });
        });

        return { ...prev, layers: newLayers };
      });
    },
    [setSketch]
  );

  // Fusionner deux calques
  const mergeLayers = useCallback(
    (sourceLayerId: string, targetLayerId: string) => {
      if (sourceLayerId === targetLayerId) return;

      const sourceLayer = sketch.layers.get(sourceLayerId);
      const targetLayer = sketch.layers.get(targetLayerId);
      if (!sourceLayer || !targetLayer) return;

      setSketch((prev) => {
        // Déplacer toutes les géométries du calque source vers le calque cible
        const newGeometries = new Map(prev.geometries);
        newGeometries.forEach((geo, id) => {
          if (geo.layerId === sourceLayerId) {
            newGeometries.set(id, { ...geo, layerId: targetLayerId });
          }
        });

        // Supprimer le calque source
        const newLayers = new Map(prev.layers);
        newLayers.delete(sourceLayerId);

        // Réorganiser les orders
        const sortedLayers = Array.from(newLayers.values()).sort((a, b) => a.order - b.order);
        sortedLayers.forEach((l, index) => {
          newLayers.set(l.id, { ...l, order: index });
        });

        // Si le calque actif était le source, passer au target
        const newActiveLayerId = prev.activeLayerId === sourceLayerId ? targetLayerId : prev.activeLayerId;

        return {
          ...prev,
          layers: newLayers,
          geometries: newGeometries,
          activeLayerId: newActiveLayerId,
        };
      });

      toast.success(`"${sourceLayer.name}" fusionné dans "${targetLayer.name}"`);
    },
    [sketch.layers, setSketch]
  );

  // Sélectionner un calque
  const selectLayer = useCallback(
    (layerId: string) => {
      setSketch((prev) => ({ ...prev, activeLayerId: layerId }));
    },
    [setSketch]
  );

  // Obtenir les calques triés
  const getSortedLayers = useCallback(() => {
    return Array.from(sketch.layers.values()).sort((a, b) => a.order - b.order);
  }, [sketch.layers]);

  return {
    // Actions
    createLayer,
    renameLayer,
    setLayerColor,
    setLayerOpacity,
    toggleLayerVisibility,
    toggleLayerLock,
    deleteLayer,
    duplicateLayer,
    moveLayerUp,
    moveLayerDown,
    bringLayerToFront,
    sendLayerToBack,
    reorderLayers,
    mergeLayers,
    selectLayer,
    // Helpers
    getSortedLayers,
    // Constantes
    LAYER_COLORS,
  };
}
