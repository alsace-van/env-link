// ============================================
// COMPOSANT: LayerTabs
// Barre d'onglets des calques avec gestion complète
// VERSION: 1.0
// ============================================
//
// Fonctionnalités:
// - Sélection de calque (clic)
// - Renommage inline (double-clic)
// - Menu contextuel (clic droit)
// - Drag & drop pour réorganiser
// - Opacité par calque (slider)
// - Couleur personnalisable
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
  Copy,
  Trash2,
  Edit3,
  Palette,
  Layers,
  ArrowUpToLine,
  ArrowDownToLine,
  GitMerge,
} from "lucide-react";
import { Layer, Sketch } from "./types";
import { useLayerManager, LAYER_COLORS } from "./useLayerManager";
import { Slider } from "@/components/ui/slider";

interface LayerTabsProps {
  sketch: Sketch;
  setSketch: React.Dispatch<React.SetStateAction<Sketch>>;
}

interface LayerContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  layerId: string | null;
  showColorPicker?: boolean;
  showMergeMenu?: boolean;
  showOpacitySlider?: boolean;
}

export function LayerTabs({ sketch, setSketch }: LayerTabsProps) {
  const layerManager = useLayerManager({ sketch, setSketch });

  // État pour le renommage inline
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // État pour le menu contextuel
  const [contextMenu, setContextMenu] = useState<LayerContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    layerId: null,
  });

  // État pour le drag & drop
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);

  // Focus sur l'input quand on commence à éditer
  useEffect(() => {
    if (editingLayerId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingLayerId]);

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

  // Commencer le renommage (double-clic)
  const startEditing = useCallback((layer: Layer) => {
    setEditingLayerId(layer.id);
    setEditingName(layer.name);
  }, []);

  // Terminer le renommage
  const finishEditing = useCallback(() => {
    if (editingLayerId && editingName.trim()) {
      layerManager.renameLayer(editingLayerId, editingName);
    }
    setEditingLayerId(null);
    setEditingName("");
  }, [editingLayerId, editingName, layerManager]);

  // Annuler le renommage
  const cancelEditing = useCallback(() => {
    setEditingLayerId(null);
    setEditingName("");
  }, []);

  // Ouvrir le menu contextuel
  const handleContextMenu = useCallback((e: React.MouseEvent, layerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      layerId,
    });
  }, []);

  // Drag & Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, layerId: string) => {
    setDraggedLayerId(layerId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", layerId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, layerId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverLayerId(layerId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverLayerId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetLayerId: string) => {
      e.preventDefault();
      if (draggedLayerId && draggedLayerId !== targetLayerId) {
        layerManager.reorderLayers(draggedLayerId, targetLayerId);
      }
      setDraggedLayerId(null);
      setDragOverLayerId(null);
    },
    [draggedLayerId, layerManager]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedLayerId(null);
    setDragOverLayerId(null);
  }, []);

  // Calques triés par ordre
  const sortedLayers = layerManager.getSortedLayers();
  const contextLayer = contextMenu.layerId ? sketch.layers.get(contextMenu.layerId) : null;

  return (
    <>
      {/* Barre d'onglets */}
      <div className="h-8 border-b bg-gray-100 flex items-end px-1 gap-0.5 overflow-x-auto">
        {sortedLayers.map((layer) => (
          <div
            key={layer.id}
            draggable
            onDragStart={(e) => handleDragStart(e, layer.id)}
            onDragOver={(e) => handleDragOver(e, layer.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, layer.id)}
            onDragEnd={handleDragEnd}
            className={`
              flex items-center gap-1.5 px-2 h-7 rounded-t-md cursor-pointer select-none
              transition-all duration-150 text-xs font-medium border border-b-0
              ${
                layer.id === sketch.activeLayerId
                  ? "bg-white border-blue-400 text-blue-700 mb-[-1px] z-10 shadow-sm"
                  : "bg-gray-200 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
              }
              ${draggedLayerId === layer.id ? "opacity-50" : ""}
              ${dragOverLayerId === layer.id ? "border-blue-500 border-2" : ""}
            `}
            onClick={() => layerManager.selectLayer(layer.id)}
            onDoubleClick={() => startEditing(layer)}
            onContextMenu={(e) => handleContextMenu(e, layer.id)}
          >
            {/* Indicateur de couleur */}
            <div
              className="w-2.5 h-2.5 rounded-sm border border-gray-400/50 flex-shrink-0"
              style={{ backgroundColor: layer.color, opacity: layer.opacity ?? 1 }}
            />

            {/* Nom du calque (éditable ou non) */}
            {editingLayerId === layer.id ? (
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
                className="w-20 px-1 py-0 text-xs bg-white border border-blue-400 rounded outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="max-w-[80px] truncate" title={layer.name}>
                {layer.name}
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
        ))}

        {/* Bouton + pour ajouter un calque */}
        <button
          className="flex items-center justify-center w-7 h-7 rounded-t-md border border-b-0 border-dashed border-gray-300
                     text-gray-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all flex-shrink-0"
          onClick={() => layerManager.createLayer()}
          title="Ajouter un calque"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Menu contextuel */}
      {contextMenu.visible && contextLayer && (
        <div
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999] min-w-[200px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Renommer */}
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              startEditing(contextLayer);
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <Edit3 className="h-4 w-4" />
            Renommer
          </button>

          {/* Couleur - sous-menu */}
          <div className="relative group">
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
              <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-gray-200 p-2 grid grid-cols-5 gap-1">
                {LAYER_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`w-6 h-6 rounded border-2 hover:scale-110 transition-transform ${
                      contextLayer.color === color ? "border-blue-500" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      layerManager.setLayerColor(contextMenu.layerId!, color);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Opacité - slider */}
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
                    layerManager.setLayerOpacity(contextMenu.layerId!, val / 100);
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

          {/* Dupliquer */}
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              layerManager.duplicateLayer(contextMenu.layerId!);
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
                <ChevronDown className="h-3 w-3" />
              </button>
              {contextMenu.showMergeMenu && (
                <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[150px]">
                  {sortedLayers
                    .filter((l) => l.id !== contextMenu.layerId)
                    .map((layer) => (
                      <button
                        key={layer.id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => {
                          layerManager.mergeLayers(contextMenu.layerId!, layer.id);
                          setContextMenu((prev) => ({ ...prev, visible: false }));
                        }}
                      >
                        <div
                          className="w-3 h-3 rounded-sm border"
                          style={{ backgroundColor: layer.color }}
                        />
                        {layer.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          <div className="h-px bg-gray-200 my-1" />

          {/* Premier plan */}
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              layerManager.bringLayerToFront(contextMenu.layerId!);
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <ArrowUpToLine className="h-4 w-4" />
            Premier plan
          </button>

          {/* Arrière-plan */}
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              layerManager.sendLayerToBack(contextMenu.layerId!);
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
              onClick={() => {
                layerManager.moveLayerUp(contextMenu.layerId!);
              }}
              title="Monter d'un niveau"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              className="flex-1 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center justify-center gap-1"
              onClick={() => {
                layerManager.moveLayerDown(contextMenu.layerId!);
              }}
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
                layerManager.deleteLayer(contextMenu.layerId!);
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
          )}
        </div>
      )}
    </>
  );
}
