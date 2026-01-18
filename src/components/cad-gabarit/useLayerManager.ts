// ============================================
// HOOK: useLayerManager
// Gestion complète des calques CAD
// VERSION: 2.0 - Solo, Guide, Groupes
// ============================================

import { useCallback, useMemo } from "react";
import { Layer, LayerGroup, Sketch, generateId } from "./types";
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

// Type pour représenter un élément dans la liste (calque ou groupe)
export interface LayerListItem {
  type: "layer" | "group";
  id: string;
  layer?: Layer;
  group?: LayerGroup;
  depth: number; // Niveau d'imbrication (0 = racine)
  children?: LayerListItem[]; // Pour les groupes
}

export function useLayerManager({ sketch, setSketch }: UseLayerManagerProps) {
  // ==========================================
  // GESTION DES CALQUES
  // ==========================================

  // Créer un nouveau calque
  const createLayer = useCallback(
    (name?: string, groupId?: string) => {
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
        solo: false,
        isGuide: false,
        groupId: groupId,
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

  // ==========================================
  // SOLO MODE - Isoler un calque
  // ==========================================

  const toggleSolo = useCallback(
    (layerId: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const layer = newLayers.get(layerId);
        if (!layer) return prev;

        const isCurrentlySolo = layer.solo;

        // Si on désactive le solo, on remet tout à false
        if (isCurrentlySolo) {
          newLayers.forEach((l, id) => {
            newLayers.set(id, { ...l, solo: false });
          });
        } else {
          // Sinon on active le solo uniquement pour ce calque
          newLayers.forEach((l, id) => {
            newLayers.set(id, { ...l, solo: id === layerId });
          });
        }

        return { ...prev, layers: newLayers };
      });
    },
    [setSketch]
  );

  // Vérifier si un calque en mode solo existe
  const hasSoloLayer = useMemo(() => {
    return Array.from(sketch.layers.values()).some((l) => l.solo);
  }, [sketch.layers]);

  // ==========================================
  // GUIDE MODE - Calque non exporté
  // ==========================================

  const toggleGuide = useCallback(
    (layerId: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const layer = newLayers.get(layerId);
        if (layer) {
          const newIsGuide = !layer.isGuide;
          newLayers.set(layerId, { ...layer, isGuide: newIsGuide });
          toast.success(newIsGuide ? `"${layer.name}" est maintenant un guide` : `"${layer.name}" n'est plus un guide`);
        }
        return { ...prev, layers: newLayers };
      });
    },
    [setSketch]
  );

  // ==========================================
  // GESTION DES GROUPES
  // ==========================================

  // Créer un nouveau groupe
  const createGroup = useCallback(
    (name?: string, parentGroupId?: string) => {
      const newGroupId = generateId();
      const groupCount = sketch.layerGroups?.size || 0;
      const newGroup: LayerGroup = {
        id: newGroupId,
        name: name || `Groupe ${groupCount + 1}`,
        color: LAYER_COLORS[(groupCount + 3) % LAYER_COLORS.length],
        visible: true,
        locked: false,
        opacity: 1,
        expanded: true,
        order: groupCount,
        parentGroupId: parentGroupId,
      };

      setSketch((prev) => {
        const newLayerGroups = new Map(prev.layerGroups || new Map());
        newLayerGroups.set(newGroupId, newGroup);
        return { ...prev, layerGroups: newLayerGroups };
      });

      toast.success(`Groupe "${newGroup.name}" créé`);
      return newGroupId;
    },
    [sketch.layerGroups, setSketch]
  );

  // Renommer un groupe
  const renameGroup = useCallback(
    (groupId: string, newName: string) => {
      if (!newName.trim()) return;

      setSketch((prev) => {
        const newLayerGroups = new Map(prev.layerGroups || new Map());
        const group = newLayerGroups.get(groupId);
        if (group) {
          newLayerGroups.set(groupId, { ...group, name: newName.trim() });
        }
        return { ...prev, layerGroups: newLayerGroups };
      });
    },
    [setSketch]
  );

  // Toggle expansion du groupe (plier/déplier)
  const toggleGroupExpanded = useCallback(
    (groupId: string) => {
      setSketch((prev) => {
        const newLayerGroups = new Map(prev.layerGroups || new Map());
        const group = newLayerGroups.get(groupId);
        if (group) {
          newLayerGroups.set(groupId, { ...group, expanded: !group.expanded });
        }
        return { ...prev, layerGroups: newLayerGroups };
      });
    },
    [setSketch]
  );

  // Toggle visibilité du groupe (affecte tous les calques du groupe)
  const toggleGroupVisibility = useCallback(
    (groupId: string) => {
      setSketch((prev) => {
        const newLayerGroups = new Map(prev.layerGroups || new Map());
        const group = newLayerGroups.get(groupId);
        if (!group) return prev;

        const newVisible = !group.visible;
        newLayerGroups.set(groupId, { ...group, visible: newVisible });

        // Appliquer aux calques du groupe
        const newLayers = new Map(prev.layers);
        newLayers.forEach((layer, id) => {
          if (layer.groupId === groupId) {
            newLayers.set(id, { ...layer, visible: newVisible });
          }
        });

        return { ...prev, layerGroups: newLayerGroups, layers: newLayers };
      });
    },
    [setSketch]
  );

  // Toggle verrouillage du groupe
  const toggleGroupLock = useCallback(
    (groupId: string) => {
      setSketch((prev) => {
        const newLayerGroups = new Map(prev.layerGroups || new Map());
        const group = newLayerGroups.get(groupId);
        if (!group) return prev;

        const newLocked = !group.locked;
        newLayerGroups.set(groupId, { ...group, locked: newLocked });

        // Appliquer aux calques du groupe
        const newLayers = new Map(prev.layers);
        newLayers.forEach((layer, id) => {
          if (layer.groupId === groupId) {
            newLayers.set(id, { ...layer, locked: newLocked });
          }
        });

        toast.success(newLocked ? `Groupe verrouillé` : `Groupe déverrouillé`);
        return { ...prev, layerGroups: newLayerGroups, layers: newLayers };
      });
    },
    [setSketch]
  );

  // Changer l'opacité du groupe
  const setGroupOpacity = useCallback(
    (groupId: string, opacity: number) => {
      setSketch((prev) => {
        const newLayerGroups = new Map(prev.layerGroups || new Map());
        const group = newLayerGroups.get(groupId);
        if (group) {
          newLayerGroups.set(groupId, { ...group, opacity: Math.max(0, Math.min(1, opacity)) });
        }
        return { ...prev, layerGroups: newLayerGroups };
      });
    },
    [setSketch]
  );

  // Changer la couleur du groupe
  const setGroupColor = useCallback(
    (groupId: string, color: string) => {
      setSketch((prev) => {
        const newLayerGroups = new Map(prev.layerGroups || new Map());
        const group = newLayerGroups.get(groupId);
        if (group) {
          newLayerGroups.set(groupId, { ...group, color });
        }
        return { ...prev, layerGroups: newLayerGroups };
      });
    },
    [setSketch]
  );

  // Supprimer un groupe (les calques reviennent à la racine)
  const deleteGroup = useCallback(
    (groupId: string) => {
      setSketch((prev) => {
        const newLayerGroups = new Map(prev.layerGroups || new Map());
        const group = newLayerGroups.get(groupId);
        if (!group) return prev;

        newLayerGroups.delete(groupId);

        // Remettre les calques du groupe à la racine
        const newLayers = new Map(prev.layers);
        newLayers.forEach((layer, id) => {
          if (layer.groupId === groupId) {
            newLayers.set(id, { ...layer, groupId: undefined });
          }
        });

        toast.success(`Groupe "${group.name}" supprimé`);
        return { ...prev, layerGroups: newLayerGroups, layers: newLayers };
      });
    },
    [setSketch]
  );

  // Ajouter un calque à un groupe
  const addLayerToGroup = useCallback(
    (layerId: string, groupId: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const layer = newLayers.get(layerId);
        if (layer) {
          newLayers.set(layerId, { ...layer, groupId });
        }
        return { ...prev, layers: newLayers };
      });
    },
    [setSketch]
  );

  // Retirer un calque d'un groupe
  const removeLayerFromGroup = useCallback(
    (layerId: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const layer = newLayers.get(layerId);
        if (layer) {
          newLayers.set(layerId, { ...layer, groupId: undefined });
        }
        return { ...prev, layers: newLayers };
      });
    },
    [setSketch]
  );

  // ==========================================
  // AUTRES FONCTIONS DE CALQUES
  // ==========================================

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

        let newActiveLayerId = prev.activeLayerId;
        if (prev.activeLayerId === layerId) {
          newActiveLayerId = Array.from(newLayers.keys())[0];
        }

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
        solo: false,
      };

      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        newLayers.set(newLayerId, newLayer);

        const newGeometries = new Map(prev.geometries);
        const newPoints = new Map(prev.points);
        const pointIdMap = new Map<string, string>();

        prev.geometries.forEach((geo) => {
          if (geo.layerId === layerId) {
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

        prev.geometries.forEach((geo) => {
          if (geo.layerId === layerId) {
            const newGeoId = generateId();
            const newGeo = { ...geo, id: newGeoId, layerId: newLayerId };

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

  // Déplacer un calque vers l'avant
  const moveLayerUp = useCallback(
    (layerId: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const sortedLayers = Array.from(newLayers.values()).sort((a, b) => a.order - b.order);
        const layerIndex = sortedLayers.findIndex((l) => l.id === layerId);

        if (layerIndex < sortedLayers.length - 1) {
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

  // Déplacer un calque vers l'arrière
  const moveLayerDown = useCallback(
    (layerId: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const sortedLayers = Array.from(newLayers.values()).sort((a, b) => a.order - b.order);
        const layerIndex = sortedLayers.findIndex((l) => l.id === layerId);

        if (layerIndex > 0) {
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

  // Premier plan
  const bringLayerToFront = useCallback(
    (layerId: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const sortedLayers = Array.from(newLayers.values()).sort((a, b) => a.order - b.order);
        const maxOrder = sortedLayers.length - 1;

        const layer = newLayers.get(layerId);
        if (layer && layer.order < maxOrder) {
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

  // Arrière-plan
  const sendLayerToBack = useCallback(
    (layerId: string) => {
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const sortedLayers = Array.from(newLayers.values()).sort((a, b) => a.order - b.order);

        const layer = newLayers.get(layerId);
        if (layer && layer.order > 0) {
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

  // Réordonner (drag & drop)
  const reorderLayers = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;

      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const sortedLayers = Array.from(newLayers.values()).sort((a, b) => a.order - b.order);

        const sourceIndex = sortedLayers.findIndex((l) => l.id === sourceId);
        const targetIndex = sortedLayers.findIndex((l) => l.id === targetId);

        if (sourceIndex === -1 || targetIndex === -1) return prev;

        const [movedLayer] = sortedLayers.splice(sourceIndex, 1);
        sortedLayers.splice(targetIndex, 0, movedLayer);

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
        const newGeometries = new Map(prev.geometries);
        newGeometries.forEach((geo, id) => {
          if (geo.layerId === sourceLayerId) {
            newGeometries.set(id, { ...geo, layerId: targetLayerId });
          }
        });

        const newLayers = new Map(prev.layers);
        newLayers.delete(sourceLayerId);

        const sortedLayers = Array.from(newLayers.values()).sort((a, b) => a.order - b.order);
        sortedLayers.forEach((l, index) => {
          newLayers.set(l.id, { ...l, order: index });
        });

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

  // ==========================================
  // HELPERS
  // ==========================================

  // Obtenir les calques triés
  const getSortedLayers = useCallback(() => {
    return Array.from(sketch.layers.values()).sort((a, b) => a.order - b.order);
  }, [sketch.layers]);

  // Obtenir les groupes triés
  const getSortedGroups = useCallback(() => {
    if (!sketch.layerGroups) return [];
    return Array.from(sketch.layerGroups.values()).sort((a, b) => a.order - b.order);
  }, [sketch.layerGroups]);

  // Obtenir les calques d'un groupe
  const getLayersInGroup = useCallback(
    (groupId: string) => {
      return Array.from(sketch.layers.values())
        .filter((l) => l.groupId === groupId)
        .sort((a, b) => a.order - b.order);
    },
    [sketch.layers]
  );

  // Obtenir les calques sans groupe (racine)
  const getRootLayers = useCallback(() => {
    return Array.from(sketch.layers.values())
      .filter((l) => !l.groupId)
      .sort((a, b) => a.order - b.order);
  }, [sketch.layers]);

  // Calculer l'opacité effective d'un calque (incluant l'opacité du groupe parent)
  const getEffectiveOpacity = useCallback(
    (layerId: string) => {
      const layer = sketch.layers.get(layerId);
      if (!layer) return 1;

      let opacity = layer.opacity ?? 1;

      if (layer.groupId && sketch.layerGroups) {
        const group = sketch.layerGroups.get(layer.groupId);
        if (group) {
          opacity *= group.opacity;
        }
      }

      return opacity;
    },
    [sketch.layers, sketch.layerGroups]
  );

  // Vérifier si un calque est effectivement visible (incluant groupe parent et solo)
  const isLayerEffectivelyVisible = useCallback(
    (layerId: string) => {
      const layer = sketch.layers.get(layerId);
      if (!layer) return false;

      // Si un calque est en solo, seul celui-ci est visible
      if (hasSoloLayer) {
        return layer.solo === true;
      }

      // Vérifier la visibilité du calque
      if (!layer.visible) return false;

      // Vérifier la visibilité du groupe parent
      if (layer.groupId && sketch.layerGroups) {
        const group = sketch.layerGroups.get(layer.groupId);
        if (group && !group.visible) return false;
      }

      return true;
    },
    [sketch.layers, sketch.layerGroups, hasSoloLayer]
  );

  // Construire la liste hiérarchique des calques et groupes
  const getLayerHierarchy = useCallback((): LayerListItem[] => {
    const result: LayerListItem[] = [];
    const groups = getSortedGroups();
    const rootLayers = getRootLayers();

    // Ajouter les groupes avec leurs calques
    groups.forEach((group) => {
      const groupItem: LayerListItem = {
        type: "group",
        id: group.id,
        group,
        depth: 0,
        children: [],
      };

      // Ajouter les calques du groupe
      const layersInGroup = getLayersInGroup(group.id);
      layersInGroup.forEach((layer) => {
        groupItem.children!.push({
          type: "layer",
          id: layer.id,
          layer,
          depth: 1,
        });
      });

      result.push(groupItem);
    });

    // Ajouter les calques sans groupe
    rootLayers.forEach((layer) => {
      result.push({
        type: "layer",
        id: layer.id,
        layer,
        depth: 0,
      });
    });

    return result;
  }, [getSortedGroups, getRootLayers, getLayersInGroup]);

  return {
    // Actions calques
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

    // Solo & Guide
    toggleSolo,
    toggleGuide,
    hasSoloLayer,

    // Actions groupes
    createGroup,
    renameGroup,
    toggleGroupExpanded,
    toggleGroupVisibility,
    toggleGroupLock,
    setGroupOpacity,
    setGroupColor,
    deleteGroup,
    addLayerToGroup,
    removeLayerFromGroup,

    // Helpers
    getSortedLayers,
    getSortedGroups,
    getLayersInGroup,
    getRootLayers,
    getEffectiveOpacity,
    isLayerEffectivelyVisible,
    getLayerHierarchy,

    // Constantes
    LAYER_COLORS,
  };
}
