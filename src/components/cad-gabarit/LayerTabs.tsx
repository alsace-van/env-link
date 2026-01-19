// ============================================
// COMPOSANT: LayerTabs
// Barre d'onglets des calques avec gestion complète
// VERSION: 2.0 - Solo, Guide, Groupes
// ============================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  X,
  Plus,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Trash2,
  Edit3,
  Palette,
  Layers,
  ArrowUpToLine,
  ArrowDownToLine,
  GitMerge,
  Focus,
  Compass,
  FolderPlus,
  FolderOpen,
  FolderClosed,
  MoreHorizontal,
} from "lucide-react";
import { Layer, LayerGroup, Sketch } from "./types";
import { useLayerManager, LAYER_COLORS } from "./useLayerManager";
import { Slider } from "@/components/ui/slider";

interface LayerTabsProps {
  sketch: Sketch;
  setSketch: React.Dispatch<React.SetStateAction<Sketch>>;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: "layer" | "group" | null;
  id: string | null;
  showColorPicker?: boolean;
  showMergeMenu?: boolean;
  showOpacitySlider?: boolean;
  showMoveToGroup?: boolean;
}

export function LayerTabs({ sketch, setSketch }: LayerTabsProps) {
  const layerManager = useLayerManager({ sketch, setSketch });

  // État pour le renommage inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<"layer" | "group" | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // État pour le menu contextuel
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    type: null,
    id: null,
  });

  // État pour le drag & drop
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedType, setDraggedType] = useState<"layer" | "group" | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Focus sur l'input quand on commence à éditer
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Fermer le menu contextuel au clic ailleurs
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [contextMenu.visible]);

  // Commencer le renommage
  const startEditing = useCallback((id: string, type: "layer" | "group", name: string) => {
    setEditingId(id);
    setEditingType(type);
    setEditingName(name);
  }, []);

  // Terminer le renommage
  const finishEditing = useCallback(() => {
    if (editingId && editingName.trim()) {
      if (editingType === "layer") {
        layerManager.renameLayer(editingId, editingName);
      } else if (editingType === "group") {
        layerManager.renameGroup(editingId, editingName);
      }
    }
    setEditingId(null);
    setEditingType(null);
    setEditingName("");
  }, [editingId, editingType, editingName, layerManager]);

  // Annuler le renommage
  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditingType(null);
    setEditingName("");
  }, []);

  // Ouvrir le menu contextuel
  const handleContextMenu = useCallback((e: React.MouseEvent, type: "layer" | "group", id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      id,
    });
  }, []);

  // Drag & Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, id: string, type: "layer" | "group") => {
    setDraggedId(id);
    setDraggedType(type);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string, targetType: "layer" | "group") => {
      e.preventDefault();
      if (draggedId && draggedType === "layer" && targetType === "group") {
        // Ajouter le calque au groupe
        layerManager.addLayerToGroup(draggedId, targetId);
      } else if (draggedId && draggedType === "layer" && targetType === "layer" && draggedId !== targetId) {
        // Réordonner les calques
        layerManager.reorderLayers(draggedId, targetId);
      }
      setDraggedId(null);
      setDraggedType(null);
      setDragOverId(null);
    },
    [draggedId, draggedType, layerManager],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDraggedType(null);
    setDragOverId(null);
  }, []);

  // Données pour le rendu
  const hierarchy = layerManager.getLayerHierarchy();
  const sortedGroups = layerManager.getSortedGroups();
  const contextLayer = contextMenu.type === "layer" && contextMenu.id ? sketch.layers.get(contextMenu.id) : null;
  const contextGroup = contextMenu.type === "group" && contextMenu.id ? sketch.layerGroups?.get(contextMenu.id) : null;

  // Rendu d'un calque
  const renderLayer = (layer: Layer, depth: number = 0) => {
    const isActive = layer.id === sketch.activeLayerId;
    const isDragging = draggedId === layer.id;
    const isDragOver = dragOverId === layer.id;
    const effectivelyVisible = layerManager.isLayerEffectivelyVisible(layer.id);

    return (
      <div
        key={layer.id}
        draggable
        onDragStart={(e) => handleDragStart(e, layer.id, "layer")}
        onDragOver={(e) => handleDragOver(e, layer.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, layer.id, "layer")}
        onDragEnd={handleDragEnd}
        className={`
          flex items-center gap-1 px-2 h-7 rounded-t-md cursor-pointer select-none
          transition-all duration-150 text-xs font-medium border-2 border-b-0
          ${
            isActive
              ? "bg-white mb-[-1px] z-10 shadow-md"
              : "bg-gray-200 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
          }
          ${isDragging ? "opacity-50" : ""}
          ${isDragOver ? "border-blue-500 border-2" : ""}
          ${!effectivelyVisible && !layer.solo ? "opacity-50" : ""}
          ${depth > 0 ? "ml-4" : ""}
        `}
        style={{
          marginLeft: depth > 0 ? `${depth * 16}px` : undefined,
          // v7.35: Surbrillance avec la couleur du calque actif
          ...(isActive
            ? {
                borderColor: layer.color,
                boxShadow: `0 -2px 8px ${layer.color}40`,
              }
            : {}),
        }}
        onClick={() => layerManager.selectLayer(layer.id)}
        onDoubleClick={() => startEditing(layer.id, "layer", layer.name)}
        onContextMenu={(e) => handleContextMenu(e, "layer", layer.id)}
      >
        {/* Indicateur de couleur */}
        <div
          className="w-2.5 h-2.5 rounded-sm border border-gray-400/50 flex-shrink-0"
          style={{ backgroundColor: layer.color, opacity: layer.opacity ?? 1 }}
        />

        {/* Nom du calque (éditable ou non) */}
        {editingId === layer.id ? (
          <input
            ref={editInputRef}
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={finishEditing}
            onKeyDown={(e) => {
              if (e.key === "Enter") finishEditing();
              if (e.key === "Escape") cancelEditing();
            }}
            className="w-16 px-1 py-0 text-xs bg-white border border-blue-400 rounded outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="max-w-[60px] truncate" title={layer.name}>
            {layer.name}
          </span>
        )}

        {/* Icône Solo */}
        <button
          className={`p-0.5 rounded flex-shrink-0 ${
            layer.solo ? "bg-yellow-200 text-yellow-700" : "text-gray-400 hover:bg-gray-300"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            layerManager.toggleSolo(layer.id);
          }}
          title={layer.solo ? "Désactiver solo" : "Solo (isoler ce calque)"}
        >
          <Focus className="h-3 w-3" />
        </button>

        {/* Badge Guide */}
        {layer.isGuide && (
          <span className="text-[9px] bg-purple-100 text-purple-600 px-1 rounded" title="Calque guide (non exporté)">
            G
          </span>
        )}

        {/* Indicateur d'opacité si < 100% */}
        {(layer.opacity ?? 1) < 1 && (
          <span className="text-[9px] text-gray-400">{Math.round((layer.opacity ?? 1) * 100)}%</span>
        )}

        {/* Bouton visibilité */}
        <button
          className={`p-0.5 rounded hover:bg-blue-100 flex-shrink-0 ${!layer.visible ? "opacity-40" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            layerManager.toggleLayerVisibility(layer.id);
          }}
          title={layer.visible ? "Masquer" : "Afficher"}
        >
          {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </button>

        {/* Bouton verrouillage */}
        <button
          className={`p-0.5 rounded hover:bg-yellow-100 flex-shrink-0 ${
            layer.locked ? "text-yellow-600" : "text-gray-400"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            layerManager.toggleLayerLock(layer.id);
          }}
          title={layer.locked ? "Déverrouiller" : "Verrouiller"}
        >
          {layer.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
        </button>

        {/* Bouton supprimer */}
        {sketch.layers.size > 1 && (
          <button
            className="p-0.5 rounded hover:bg-red-100 hover:text-red-600 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              layerManager.deleteLayer(layer.id);
            }}
            title="Supprimer"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  };

  // Rendu d'un groupe
  const renderGroup = (group: LayerGroup) => {
    const layersInGroup = layerManager.getLayersInGroup(group.id);
    const isDragOver = dragOverId === group.id;

    return (
      <div key={group.id} className="flex flex-col">
        {/* En-tête du groupe */}
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, group.id, "group")}
          onDragOver={(e) => handleDragOver(e, group.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, group.id, "group")}
          onDragEnd={handleDragEnd}
          className={`
            flex items-center gap-1 px-2 h-7 rounded-t-md cursor-pointer select-none
            transition-all duration-150 text-xs font-medium border border-b-0
            bg-gray-300 border-gray-300 text-gray-700 hover:bg-gray-400
            ${isDragOver ? "border-blue-500 border-2 bg-blue-100" : ""}
          `}
          onClick={() => layerManager.toggleGroupExpanded(group.id)}
          onDoubleClick={() => startEditing(group.id, "group", group.name)}
          onContextMenu={(e) => handleContextMenu(e, "group", group.id)}
        >
          {/* Chevron plier/déplier */}
          <button className="p-0.5 flex-shrink-0">
            {group.expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>

          {/* Icône dossier */}
          <div className="flex-shrink-0">
            {group.expanded ? (
              <FolderOpen className="h-3.5 w-3.5" style={{ color: group.color }} />
            ) : (
              <FolderClosed className="h-3.5 w-3.5" style={{ color: group.color }} />
            )}
          </div>

          {/* Nom du groupe */}
          {editingId === group.id ? (
            <input
              ref={editInputRef}
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={finishEditing}
              onKeyDown={(e) => {
                if (e.key === "Enter") finishEditing();
                if (e.key === "Escape") cancelEditing();
              }}
              className="w-16 px-1 py-0 text-xs bg-white border border-blue-400 rounded outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="max-w-[60px] truncate" title={group.name}>
              {group.name}
            </span>
          )}

          {/* Nombre de calques */}
          <span className="text-[9px] text-gray-500">({layersInGroup.length})</span>

          {/* Opacité du groupe */}
          {group.opacity < 1 && <span className="text-[9px] text-gray-400">{Math.round(group.opacity * 100)}%</span>}

          {/* Bouton visibilité groupe */}
          <button
            className={`p-0.5 rounded hover:bg-gray-400 flex-shrink-0 ${!group.visible ? "opacity-40" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              layerManager.toggleGroupVisibility(group.id);
            }}
            title={group.visible ? "Masquer le groupe" : "Afficher le groupe"}
          >
            {group.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </button>

          {/* Bouton verrouillage groupe */}
          <button
            className={`p-0.5 rounded hover:bg-yellow-200 flex-shrink-0 ${
              group.locked ? "text-yellow-600" : "text-gray-500"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              layerManager.toggleGroupLock(group.id);
            }}
            title={group.locked ? "Déverrouiller le groupe" : "Verrouiller le groupe"}
          >
            {group.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </button>

          {/* Bouton supprimer groupe */}
          <button
            className="p-0.5 rounded hover:bg-red-200 hover:text-red-600 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              layerManager.deleteGroup(group.id);
            }}
            title="Supprimer le groupe"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Calques du groupe (si déplié) */}
        {group.expanded && layersInGroup.map((layer) => renderLayer(layer, 1))}
      </div>
    );
  };

  return (
    <>
      {/* Barre d'onglets */}
      <div className="h-auto min-h-8 border-b bg-gray-100 flex flex-wrap items-end px-1 gap-0.5 py-1">
        {/* Groupes */}
        {sortedGroups.map((group) => renderGroup(group))}

        {/* Calques sans groupe */}
        {layerManager.getRootLayers().map((layer) => renderLayer(layer, 0))}

        {/* Bouton + pour ajouter un calque */}
        <button
          className="flex items-center justify-center w-7 h-7 rounded-t-md border border-b-0 border-dashed border-gray-300
                     text-gray-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all flex-shrink-0"
          onClick={() => layerManager.createLayer()}
          title="Ajouter un calque"
        >
          <Plus className="h-4 w-4" />
        </button>

        {/* Bouton + pour ajouter un groupe */}
        <button
          className="flex items-center justify-center w-7 h-7 rounded-t-md border border-b-0 border-dashed border-gray-300
                     text-gray-400 hover:text-purple-600 hover:border-purple-400 hover:bg-purple-50 transition-all flex-shrink-0"
          onClick={() => layerManager.createGroup()}
          title="Ajouter un groupe"
        >
          <FolderPlus className="h-4 w-4" />
        </button>
      </div>

      {/* Menu contextuel */}
      {contextMenu.visible && (contextLayer || contextGroup) && (
        <div
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999] min-w-[200px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Menu pour les calques */}
          {contextMenu.type === "layer" && contextLayer && (
            <>
              {/* Renommer */}
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => {
                  startEditing(contextLayer.id, "layer", contextLayer.name);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Edit3 className="h-4 w-4" />
                Renommer
              </button>

              {/* Solo */}
              <button
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 ${
                  contextLayer.solo ? "bg-yellow-50" : ""
                }`}
                onClick={() => {
                  layerManager.toggleSolo(contextMenu.id!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Focus className="h-4 w-4" />
                {contextLayer.solo ? "Désactiver solo" : "Solo (isoler)"}
              </button>

              {/* Guide */}
              <button
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 ${
                  contextLayer.isGuide ? "bg-purple-50" : ""
                }`}
                onClick={() => {
                  layerManager.toggleGuide(contextMenu.id!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Compass className="h-4 w-4" />
                {contextLayer.isGuide ? "Retirer du mode guide" : "Calque guide (non exporté)"}
              </button>

              <div className="h-px bg-gray-200 my-1" />

              {/* Couleur */}
              <div className="relative">
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 justify-between"
                  onClick={() => setContextMenu((prev) => ({ ...prev, showColorPicker: !prev.showColorPicker }))}
                >
                  <span className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Couleur
                  </span>
                  <div
                    className="w-4 h-4 rounded border border-gray-300"
                    style={{ backgroundColor: contextLayer.color }}
                  />
                </button>
                {contextMenu.showColorPicker && (
                  <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-gray-200 p-2">
                    <div className="grid grid-cols-6 gap-1 mb-2">
                      {LAYER_COLORS.map((color) => (
                        <button
                          key={color}
                          className={`w-5 h-5 rounded border-2 hover:scale-110 transition-transform ${
                            contextLayer.color === color ? "border-blue-500 ring-1 ring-blue-300" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => {
                            layerManager.setLayerColor(contextMenu.id!, color);
                            setContextMenu((prev) => ({ ...prev, visible: false }));
                          }}
                        />
                      ))}
                    </div>
                    {/* Color picker personnalisé */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <input
                        type="color"
                        value={contextLayer.color}
                        onChange={(e) => {
                          layerManager.setLayerColor(contextMenu.id!, e.target.value);
                        }}
                        className="w-8 h-6 cursor-pointer border rounded"
                      />
                      <span className="text-xs text-gray-500">Personnalisé</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Opacité */}
              <div className="relative">
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 justify-between"
                  onClick={() => setContextMenu((prev) => ({ ...prev, showOpacitySlider: !prev.showOpacitySlider }))}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Opacité
                  </span>
                  <span className="text-xs text-gray-500">{Math.round((contextLayer.opacity ?? 1) * 100)}%</span>
                </button>
                {contextMenu.showOpacitySlider && (
                  <div className="px-3 py-2 border-t border-gray-100">
                    <Slider
                      value={[(contextLayer.opacity ?? 1) * 100]}
                      onValueChange={([val]) => {
                        layerManager.setLayerOpacity(contextMenu.id!, val / 100);
                      }}
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-200 my-1" />

              {/* Déplacer vers groupe */}
              {sortedGroups.length > 0 && (
                <div className="relative">
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 justify-between"
                    onClick={() => setContextMenu((prev) => ({ ...prev, showMoveToGroup: !prev.showMoveToGroup }))}
                  >
                    <span className="flex items-center gap-2">
                      <FolderPlus className="h-4 w-4" />
                      Déplacer vers groupe
                    </span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                  {contextMenu.showMoveToGroup && (
                    <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[150px]">
                      {contextLayer.groupId && (
                        <button
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-orange-600"
                          onClick={() => {
                            layerManager.removeLayerFromGroup(contextMenu.id!);
                            setContextMenu((prev) => ({ ...prev, visible: false }));
                          }}
                        >
                          <X className="h-3 w-3" />
                          Retirer du groupe
                        </button>
                      )}
                      {sortedGroups
                        .filter((g) => g.id !== contextLayer.groupId)
                        .map((group) => (
                          <button
                            key={group.id}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                            onClick={() => {
                              layerManager.addLayerToGroup(contextMenu.id!, group.id);
                              setContextMenu((prev) => ({ ...prev, visible: false }));
                            }}
                          >
                            <FolderOpen className="h-3 w-3" style={{ color: group.color }} />
                            {group.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Dupliquer */}
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => {
                  layerManager.duplicateLayer(contextMenu.id!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Copy className="h-4 w-4" />
                Dupliquer
              </button>

              {/* Fusionner avec... */}
              {sketch.layers.size > 1 && (
                <div className="relative">
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 justify-between"
                    onClick={() => setContextMenu((prev) => ({ ...prev, showMergeMenu: !prev.showMergeMenu }))}
                  >
                    <span className="flex items-center gap-2">
                      <GitMerge className="h-4 w-4" />
                      Fusionner avec...
                    </span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                  {contextMenu.showMergeMenu && (
                    <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[150px]">
                      {layerManager
                        .getSortedLayers()
                        .filter((l) => l.id !== contextMenu.id)
                        .map((layer) => (
                          <button
                            key={layer.id}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                            onClick={() => {
                              layerManager.mergeLayers(contextMenu.id!, layer.id);
                              setContextMenu((prev) => ({ ...prev, visible: false }));
                            }}
                          >
                            <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: layer.color }} />
                            {layer.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}

              <div className="h-px bg-gray-200 my-1" />

              {/* Premier plan / Arrière-plan */}
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => {
                  layerManager.bringLayerToFront(contextMenu.id!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <ArrowUpToLine className="h-4 w-4" />
                Premier plan
              </button>

              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => {
                  layerManager.sendLayerToBack(contextMenu.id!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <ArrowDownToLine className="h-4 w-4" />
                Arrière-plan
              </button>

              {/* Monter / Descendre */}
              <div className="flex px-3 py-1 gap-1">
                <button
                  className="flex-1 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center justify-center gap-1"
                  onClick={() => layerManager.moveLayerUp(contextMenu.id!)}
                  title="Monter d'un niveau"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  className="flex-1 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center justify-center gap-1"
                  onClick={() => layerManager.moveLayerDown(contextMenu.id!)}
                  title="Descendre d'un niveau"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              <div className="h-px bg-gray-200 my-1" />

              {/* Supprimer */}
              {sketch.layers.size > 1 && (
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                  onClick={() => {
                    layerManager.deleteLayer(contextMenu.id!);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              )}
            </>
          )}

          {/* Menu pour les groupes */}
          {contextMenu.type === "group" && contextGroup && (
            <>
              {/* Renommer */}
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => {
                  startEditing(contextGroup.id, "group", contextGroup.name);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Edit3 className="h-4 w-4" />
                Renommer
              </button>

              {/* Couleur */}
              <div className="relative">
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 justify-between"
                  onClick={() => setContextMenu((prev) => ({ ...prev, showColorPicker: !prev.showColorPicker }))}
                >
                  <span className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Couleur
                  </span>
                  <div
                    className="w-4 h-4 rounded border border-gray-300"
                    style={{ backgroundColor: contextGroup.color }}
                  />
                </button>
                {contextMenu.showColorPicker && (
                  <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-gray-200 p-2">
                    <div className="grid grid-cols-6 gap-1 mb-2">
                      {LAYER_COLORS.map((color) => (
                        <button
                          key={color}
                          className={`w-5 h-5 rounded border-2 hover:scale-110 transition-transform ${
                            contextGroup.color === color ? "border-blue-500 ring-1 ring-blue-300" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => {
                            layerManager.setGroupColor(contextMenu.id!, color);
                            setContextMenu((prev) => ({ ...prev, visible: false }));
                          }}
                        />
                      ))}
                    </div>
                    {/* Color picker personnalisé */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <input
                        type="color"
                        value={contextGroup.color}
                        onChange={(e) => {
                          layerManager.setGroupColor(contextMenu.id!, e.target.value);
                        }}
                        className="w-8 h-6 cursor-pointer border rounded"
                      />
                      <span className="text-xs text-gray-500">Personnalisé</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Opacité du groupe */}
              <div className="relative">
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 justify-between"
                  onClick={() => setContextMenu((prev) => ({ ...prev, showOpacitySlider: !prev.showOpacitySlider }))}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Opacité du groupe
                  </span>
                  <span className="text-xs text-gray-500">{Math.round(contextGroup.opacity * 100)}%</span>
                </button>
                {contextMenu.showOpacitySlider && (
                  <div className="px-3 py-2 border-t border-gray-100">
                    <Slider
                      value={[contextGroup.opacity * 100]}
                      onValueChange={([val]) => {
                        layerManager.setGroupOpacity(contextMenu.id!, val / 100);
                      }}
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-200 my-1" />

              {/* Ajouter un calque au groupe */}
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => {
                  layerManager.createLayer(undefined, contextMenu.id!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Plus className="h-4 w-4" />
                Ajouter un calque
              </button>

              <div className="h-px bg-gray-200 my-1" />

              {/* Supprimer groupe */}
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                onClick={() => {
                  layerManager.deleteGroup(contextMenu.id!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Trash2 className="h-4 w-4" />
                Supprimer le groupe
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
