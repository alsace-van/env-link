// ============================================
// COMPOSANT: ContextMenuCAD
// VERSION: 1.0
// Description: Menu contextuel pour le canvas CAD
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import React from "react";
import {
  Trash2,
  Settings,
  RotateCcw,
  MousePointer,
  Ruler,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Focus,
  ArrowUpToLine,
  ArrowDownToLine,
  SlidersHorizontal,
  Contrast,
  ExternalLink,
  Layers,
  ArrowRight,
  ChevronRight,
  Maximize2,
  GitMerge,
  Expand,
  Sliders,
  PaintBucket,
} from "lucide-react";
import { toast } from "sonner";
import type { Sketch, Line, Arc, Point } from "./types";
import type { BackgroundImage, MarkerLink } from "./useImageDragDrop";

// ============================================
// TYPES
// ============================================

export interface ContextMenuState {
  x: number;
  y: number;
  entityId: string;
  entityType: "line" | "arc" | "circle" | "bezier" | "image" | "point" | "corner" | "closedShape";
  shapeGeoIds?: Set<string>;
  shapePath?: { x: number; y: number }[];
}

export interface ContextMenuCADProps {
  // Menu state
  contextMenu: ContextMenuState;
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  
  // Sketch
  sketch: Sketch;
  setSketch: React.Dispatch<React.SetStateAction<Sketch>>;
  sketchRef: React.MutableRefObject<Sketch>;
  addToHistory: (sketch: Sketch, description?: string) => void;
  
  // Images
  backgroundImages: BackgroundImage[];
  setBackgroundImages: React.Dispatch<React.SetStateAction<BackgroundImage[]>>;
  selectedImageId: string | null;
  setSelectedImageId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedImageIds: Set<string>;
  setSelectedImageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  markerLinks: MarkerLink[];
  setMarkerLinks: React.Dispatch<React.SetStateAction<MarkerLink[]>>;
  addToImageHistory: (images: BackgroundImage[], links: MarkerLink[]) => void;
  
  // Selection
  selectedEntities: Set<string>;
  setSelectedEntities: React.Dispatch<React.SetStateAction<Set<string>>>;
  lockedPoints: Set<string>;
  setLockedPoints: React.Dispatch<React.SetStateAction<Set<string>>>;
  
  // Dialogs & Panels
  setArcEditDialog: React.Dispatch<React.SetStateAction<{ open: boolean; arcId: string; currentRadius: number } | null>>;
  setLineLengthDialog: React.Dispatch<React.SetStateAction<any>>;
  setLineLengthPanelPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setAngleEditDialog: React.Dispatch<React.SetStateAction<any>>;
  setAnglePanelPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setShowCalibrationPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setImageToolsModalPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setShowImageToolsModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowPhotoPreparationModal: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Mode
  stretchMode: boolean;
  setStretchMode: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Callbacks
  deleteSelectedEntities: () => void;
  removeFilletFromArc: (arcId: string) => void;
  closeAllEditPanels: (except?: string) => void;
  moveImageToNewLayer: (imageId: string) => void;
  handleStraightenImage: (imageId: string) => void;
  openFillDialog: (geoIds: Set<string>, path: { x: number; y: number }[]) => void;
  removeShapeFill: (geoIds: Set<string>) => void;
  
  // Utilities
  distance: (p1: Point, p2: Point) => number;
}

// ============================================
// COMPOSANT
// ============================================

export function ContextMenuCAD({
  contextMenu,
  setContextMenu,
  sketch,
  setSketch,
  sketchRef,
  addToHistory,
  backgroundImages,
  setBackgroundImages,
  selectedImageId,
  setSelectedImageId,
  selectedImageIds,
  setSelectedImageIds,
  markerLinks,
  setMarkerLinks,
  addToImageHistory,
  selectedEntities,
  setSelectedEntities,
  lockedPoints,
  setLockedPoints,
  setArcEditDialog,
  setLineLengthDialog,
  setLineLengthPanelPos,
  setAngleEditDialog,
  setAnglePanelPos,
  setShowCalibrationPanel,
  setImageToolsModalPos,
  setShowImageToolsModal,
  setShowPhotoPreparationModal,
  stretchMode,
  setStretchMode,
  deleteSelectedEntities,
  removeFilletFromArc,
  closeAllEditPanels,
  moveImageToNewLayer,
  handleStraightenImage,
  openFillDialog,
  removeShapeFill,
  distance,
}: ContextMenuCADProps) {
  // v7.35: Calculer la position ajustée pour éviter le débordement hors écran
  const menuWidth = 180;
  const menuHeight = contextMenu.entityType === "image" ? 280 : 150;
  const padding = 10;

  let adjustedX = contextMenu.x;
  let adjustedY = contextMenu.y;

  if (contextMenu.x + menuWidth > window.innerWidth - padding) {
    adjustedX = window.innerWidth - menuWidth - padding;
  }
  if (adjustedX < padding) {
    adjustedX = padding;
  }
  if (contextMenu.y + menuHeight > window.innerHeight - padding) {
    adjustedY = window.innerHeight - menuHeight - padding;
  }
  if (adjustedY < padding) {
    adjustedY = padding;
  }

  // Render arc menu
  const renderArcMenu = () => {
    const arc = sketch.geometries.get(contextMenu.entityId) as Arc | undefined;
    const isFillet = arc?.isFillet === true;
    return (
      <>
        {isFillet ? (
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              removeFilletFromArc(contextMenu.entityId);
              setContextMenu(null);
            }}
          >
            <RotateCcw className="h-4 w-4 text-red-500" />
            Supprimer le congé
          </button>
        ) : (
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              const newSketch: Sketch = {
                ...sketch,
                points: new Map(sketch.points),
                geometries: new Map(sketch.geometries),
                layers: new Map(sketch.layers),
                constraints: new Map(sketch.constraints),
              };
              newSketch.geometries.delete(contextMenu.entityId);
              setSketch(newSketch);
              addToHistory(newSketch);
              toast.success("Arc supprimé");
              setContextMenu(null);
            }}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
            Supprimer
          </button>
        )}
        <button
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          onClick={() => {
            setArcEditDialog({
              open: true,
              arcId: contextMenu.entityId,
              currentRadius: arc?.radius || 0,
            });
            setContextMenu(null);
          }}
        >
          <Settings className="h-4 w-4 text-blue-500" />
          Modifier le rayon
        </button>
      </>
    );
  };

  // Render line menu
  const renderLineMenu = () => {
    const currentSketch = sketchRef.current;
    const line = currentSketch.geometries.get(contextMenu.entityId) as Line | undefined;
    const p1 = line ? currentSketch.points.get(line.p1) : undefined;
    const p2 = line ? currentSketch.points.get(line.p2) : undefined;
    const currentLength = p1 && p2 ? distance(p1, p2) / currentSketch.scaleFactor : 0;

    return (
      <>
        <button
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          onClick={() => {
            setSelectedEntities(new Set([contextMenu.entityId]));
            setContextMenu(null);
          }}
        >
          <MousePointer className="h-3.5 w-3.5" />
          Sélectionner
        </button>
        <button
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          onClick={() => {
            closeAllEditPanels("lineLength");
            setLineLengthPanelPos({ x: contextMenu.x + 10, y: contextMenu.y });
            setLineLengthDialog({
              open: true,
              lineId: contextMenu.entityId,
              currentLength: currentLength,
              newLength: currentLength.toFixed(1),
              anchorMode: "center",
              originalSketch: {
                ...sketchRef.current,
                points: new Map(sketchRef.current.points),
                geometries: new Map(sketchRef.current.geometries),
                layers: new Map(sketchRef.current.layers),
                constraints: new Map(sketchRef.current.constraints),
              },
            });
            setContextMenu(null);
          }}
        >
          <Ruler className="h-4 w-4 text-blue-500" />
          Modifier la longueur
        </button>
        <button
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
          onClick={() => {
            setSelectedEntities(new Set([contextMenu.entityId]));
            deleteSelectedEntities();
            setContextMenu(null);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Supprimer
        </button>
      </>
    );
  };

  // Render image menu
  const renderImageMenu = () => {
    const image = backgroundImages.find((img) => img.id === contextMenu.entityId);
    if (!image) return null;
    
    const currentLayer = sketch.layers.get(image.layerId || "");
    const isClickedImageInSelection = selectedImageIds.has(contextMenu.entityId);
    const multiCount = isClickedImageInSelection && selectedImageIds.size > 1 ? selectedImageIds.size : 0;
    const imagesToUpdate = multiCount > 0 ? selectedImageIds : new Set([contextMenu.entityId]);

    return (
      <>
        {/* Bouton détacher en haut */}
        <button
          className="w-full px-2 py-1 text-left text-xs hover:bg-blue-50 flex items-center gap-1.5 text-blue-600 border-b"
          onClick={() => {
            setImageToolsModalPos({ x: contextMenu.x, y: contextMenu.y });
            setShowImageToolsModal(true);
            setContextMenu(null);
          }}
        >
          <ExternalLink className="h-3 w-3" />
          Détacher le menu
        </button>
        
        {/* Ligne d'actions rapides groupées */}
        <div className="flex items-center justify-around px-2 py-1 border-b">
          <button
            className="p-1.5 rounded hover:bg-gray-100"
            title={image.locked ? "Déverrouiller" : "Verrouiller"}
            onClick={() => {
              setBackgroundImages((prev) =>
                prev.map((img) =>
                  img.id === contextMenu.entityId ? { ...img, locked: !img.locked } : img
                )
              );
              toast.success(image.locked ? "Déverrouillée" : "Verrouillée");
              setContextMenu(null);
            }}
          >
            {image.locked ? (
              <Unlock className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-orange-500" />
            )}
          </button>
          <button
            className="p-1.5 rounded hover:bg-gray-100"
            title={image.visible ? "Masquer" : "Afficher"}
            onClick={() => {
              setBackgroundImages((prev) =>
                prev.map((img) =>
                  img.id === contextMenu.entityId ? { ...img, visible: !img.visible } : img
                )
              );
              toast.success(image.visible ? "Masquée" : "Affichée");
              setContextMenu(null);
            }}
          >
            {image.visible ? (
              <EyeOff className="h-3.5 w-3.5 text-gray-500" />
            ) : (
              <Eye className="h-3.5 w-3.5 text-blue-500" />
            )}
          </button>
          <button
            className={`p-1.5 rounded hover:bg-gray-100 ${currentLayer?.solo ? "bg-yellow-100" : ""}`}
            title={currentLayer?.solo ? "Désactiver solo" : "Isoler (Solo)"}
            onClick={() => {
              if (!currentLayer) return;
              setSketch((prev) => {
                const newLayers = new Map(prev.layers);
                const isCurrentlySolo = currentLayer.solo;
                newLayers.forEach((l, id) => {
                  newLayers.set(id, { ...l, solo: isCurrentlySolo ? false : id === currentLayer.id });
                });
                return { ...prev, layers: newLayers };
              });
              toast.success(currentLayer.solo ? "Solo désactivé" : `"${currentLayer.name}" isolé`);
              setContextMenu(null);
            }}
          >
            <Focus className={`h-3.5 w-3.5 ${currentLayer?.solo ? "text-yellow-600" : "text-yellow-500"}`} />
          </button>
          <button
            className="p-1.5 rounded hover:bg-gray-100"
            title="Premier plan"
            onClick={() => {
              setBackgroundImages((prev) => {
                const maxOrder = Math.max(...prev.map((img) => img.order), 0);
                let nextOrder = maxOrder + 1;
                return prev.map((img) =>
                  imagesToUpdate.has(img.id) ? { ...img, order: nextOrder++ } : img
                );
              });
              toast.success(multiCount > 0 ? `${multiCount} photos ↑` : "↑ Premier plan");
              setContextMenu(null);
            }}
          >
            <ArrowUpToLine className="h-3.5 w-3.5 text-blue-500" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-gray-100"
            title="Arrière-plan"
            onClick={() => {
              setBackgroundImages((prev) => {
                const minOrder = Math.min(...prev.map((img) => img.order), 0);
                let nextOrder = minOrder - imagesToUpdate.size;
                return prev.map((img) =>
                  imagesToUpdate.has(img.id) ? { ...img, order: nextOrder++ } : img
                );
              });
              toast.success(multiCount > 0 ? `${multiCount} photos ↓` : "↓ Arrière-plan");
              setContextMenu(null);
            }}
          >
            <ArrowDownToLine className="h-3.5 w-3.5 text-orange-500" />
          </button>
          <button
            className={`p-1.5 rounded hover:bg-gray-100 ${image.blendMode === "stripes" ? "bg-cyan-100" : ""}`}
            title={image.blendMode === "stripes" ? "Mode normal" : "Mode rayures (alignement)"}
            onClick={() => {
              setBackgroundImages((prev) =>
                prev.map((img) =>
                  imagesToUpdate.has(img.id)
                    ? { ...img, blendMode: img.blendMode === "stripes" ? "normal" : "stripes" }
                    : img
                )
              );
              toast.success(image.blendMode === "stripes" ? "Mode normal" : "Mode rayures");
              setContextMenu(null);
            }}
          >
            <SlidersHorizontal className={`h-3.5 w-3.5 ${image.blendMode === "stripes" ? "text-cyan-600" : "text-cyan-500"}`} />
          </button>
        </div>
        
        {/* Opacité compacte */}
        <div className="px-2 py-1 flex items-center gap-2">
          <Contrast className="h-3 w-3 text-purple-500 flex-shrink-0" />
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(image.opacity * 100)}
            onChange={(e) => {
              const newOpacity = parseInt(e.target.value) / 100;
              setBackgroundImages((prev) =>
                prev.map((img) => (imagesToUpdate.has(img.id) ? { ...img, opacity: newOpacity } : img))
              );
            }}
            className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="text-[10px] text-gray-500 w-7 text-right">
            {Math.round(image.opacity * 100)}%
          </span>
          <button
            className="p-0.5 rounded hover:bg-gray-200"
            title="Réinitialiser opacité"
            onClick={() => {
              setBackgroundImages((prev) =>
                prev.map((img) => (imagesToUpdate.has(img.id) ? { ...img, opacity: 1 } : img))
              );
              toast.success("Opacité: 100%");
              setContextMenu(null);
            }}
          >
            <RotateCcw className="h-3 w-3 text-gray-400" />
          </button>
        </div>
        
        <div className="border-t my-0.5" />
        
        {/* Actions principales */}
        <button
          className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 flex items-center gap-1.5"
          onClick={() => {
            setSelectedImageId(contextMenu.entityId);
            setSelectedImageIds(new Set([contextMenu.entityId]));
            setShowCalibrationPanel(true);
            setContextMenu(null);
          }}
        >
          <Ruler className="h-3 w-3 text-cyan-500" />
          Calibrer
        </button>
        <button
          className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 flex items-center gap-1.5"
          onClick={() => {
            moveImageToNewLayer(contextMenu.entityId);
            setContextMenu(null);
          }}
        >
          <Layers className="h-3 w-3 text-blue-500" />
          Nouveau calque
        </button>
        
        {/* Sous-menu calques */}
        {sketch.layers.size > 1 && (
          <div
            className="relative"
            onMouseEnter={(e) => {
              const submenu = e.currentTarget.querySelector("[data-submenu]") as HTMLElement;
              if (submenu) submenu.style.display = "block";
            }}
            onMouseLeave={(e) => {
              const submenu = e.currentTarget.querySelector("[data-submenu]") as HTMLElement;
              if (submenu) submenu.style.display = "none";
            }}
          >
            <button className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 flex items-center gap-1.5 justify-between">
              <span className="flex items-center gap-1.5">
                <ArrowRight className="h-3 w-3 text-gray-500" />
                Vers calque
              </span>
              <ChevronRight className="h-2.5 w-2.5" />
            </button>
            <div
              data-submenu
              className="fixed bg-white rounded shadow-xl border py-0.5 min-w-[100px] z-[10001]"
              style={{
                display: "none",
                left: contextMenu.x + 180,
                top: contextMenu.y + 80,
              }}
            >
              {Array.from(sketch.layers.values())
                .filter((layer) => layer.id !== image.layerId)
                .map((layer) => (
                  <button
                    key={layer.id}
                    className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 flex items-center gap-1.5 whitespace-nowrap"
                    onClick={() => {
                      setBackgroundImages((prev) =>
                        prev.map((img) =>
                          img.id === contextMenu.entityId ? { ...img, layerId: layer.id } : img
                        )
                      );
                      toast.success(`→ "${layer.name}"`);
                      setContextMenu(null);
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: layer.color }}
                    />
                    {layer.name}
                  </button>
                ))}
            </div>
          </div>
        )}
        
        <div className="border-t my-0.5" />
        
        {/* Options ArUco */}
        <button
          className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 flex items-center gap-1.5 text-purple-600"
          onClick={() => {
            handleStraightenImage(contextMenu.entityId);
            setContextMenu(null);
          }}
        >
          <Maximize2 className="h-3 w-3" />
          Redresser (ArUco)
        </button>
        <button
          className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 flex items-center gap-1.5 text-green-600"
          onClick={() => {
            setShowPhotoPreparationModal(true);
            setContextMenu(null);
          }}
        >
          <GitMerge className="h-3 w-3" />
          Préparer photos...
        </button>
        
        {/* Mode étiré */}
        <button
          className={`w-full px-2 py-1 text-left text-xs hover:bg-gray-100 flex items-center gap-1.5 ${stretchMode ? "text-orange-600 bg-orange-50" : "text-orange-600"}`}
          onClick={() => {
            setStretchMode(!stretchMode);
            setSelectedImageId(contextMenu.entityId);
            toast.info(stretchMode ? "Mode étiré désactivé" : "Mode étiré activé - Tirez sur les poignées");
            setContextMenu(null);
          }}
        >
          <Expand className="h-3 w-3" />
          {stretchMode ? "✓ Mode étiré" : "Mode étiré"}
        </button>
        
        <div className="border-t my-0.5" />
        
        <button
          className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 flex items-center gap-1.5 text-red-600"
          onClick={() => {
            addToImageHistory(backgroundImages, markerLinks);
            const imageIdToDelete = contextMenu.entityId;
            setBackgroundImages((prev) => prev.filter((img) => img.id !== imageIdToDelete));
            setMarkerLinks((links) =>
              links.filter(
                (link) =>
                  link.marker1.imageId !== imageIdToDelete && link.marker2.imageId !== imageIdToDelete
              )
            );
            if (selectedImageId === imageIdToDelete) setSelectedImageId(null);
            const newSelectedIds = new Set(selectedImageIds);
            newSelectedIds.delete(imageIdToDelete);
            setSelectedImageIds(newSelectedIds);
            toast.success("Supprimée");
            setContextMenu(null);
          }}
        >
          <Trash2 className="h-3 w-3" />
          Supprimer
        </button>
        
        {/* Info calque */}
        {currentLayer && (
          <div className="px-2 py-0.5 text-[10px] text-gray-400 border-t flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: currentLayer.color }} />
            {currentLayer.name}
          </div>
        )}
      </>
    );
  };

  // Render point menu
  const renderPointMenu = () => {
    const pointId = contextMenu.entityId;
    return (
      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
        onClick={() => {
          setLockedPoints((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(pointId)) {
              newSet.delete(pointId);
              toast.success("Point déverrouillé");
            } else {
              newSet.add(pointId);
              toast.success("Point verrouillé");
            }
            return newSet;
          });
          setContextMenu(null);
        }}
      >
        {lockedPoints.has(pointId) ? (
          <>
            <Unlock className="h-4 w-4 text-green-500" />
            Déverrouiller le point
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 text-orange-500" />
            Verrouiller le point
          </>
        )}
      </button>
    );
  };

  // Render corner menu
  const renderCornerMenu = () => {
    const currentSketch = sketchRef.current;
    const pointId = contextMenu.entityId;
    const point = currentSketch.points.get(pointId);
    const connectedLines: Line[] = [];
    currentSketch.geometries.forEach((geo) => {
      if (geo.type === "line") {
        const line = geo as Line;
        if (line.p1 === pointId || line.p2 === pointId) {
          connectedLines.push(line);
        }
      }
    });

    if (connectedLines.length < 2 || !point) return null;

    const line1 = connectedLines[0];
    const line2 = connectedLines[1];
    const other1Id = line1.p1 === pointId ? line1.p2 : line1.p1;
    const other2Id = line2.p1 === pointId ? line2.p2 : line2.p1;
    const other1 = currentSketch.points.get(other1Id);
    const other2 = currentSketch.points.get(other2Id);

    if (!other1 || !other2) return null;

    const dir1 = { x: other1.x - point.x, y: other1.y - point.y };
    const dir2 = { x: other2.x - point.x, y: other2.y - point.y };
    const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
    const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);
    const dot = (dir1.x * dir2.x + dir1.y * dir2.y) / (len1 * len2);
    const currentAngle = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;

    return (
      <>
        <button
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          onClick={() => {
            setLockedPoints((prev) => {
              const newSet = new Set(prev);
              if (newSet.has(pointId)) {
                newSet.delete(pointId);
                toast.success("Point déverrouillé");
              } else {
                newSet.add(pointId);
                toast.success("Point verrouillé");
              }
              return newSet;
            });
            setContextMenu(null);
          }}
        >
          {lockedPoints.has(pointId) ? (
            <>
              <Unlock className="h-4 w-4 text-green-500" />
              Déverrouiller le point
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 text-orange-500" />
              Verrouiller le point
            </>
          )}
        </button>
        <button
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          onClick={() => {
            closeAllEditPanels("angle");
            setAnglePanelPos({ x: contextMenu.x + 10, y: contextMenu.y });
            setAngleEditDialog({
              open: true,
              pointId: pointId,
              line1Id: line1.id,
              line2Id: line2.id,
              currentAngle: currentAngle,
              newAngle: currentAngle.toFixed(1),
              anchorMode: "symmetric",
              originalSketch: {
                ...sketchRef.current,
                points: new Map(sketchRef.current.points),
                geometries: new Map(sketchRef.current.geometries),
                layers: new Map(sketchRef.current.layers),
                constraints: new Map(sketchRef.current.constraints),
              },
            });
            setContextMenu(null);
          }}
        >
          <Sliders className="h-4 w-4 text-orange-500" />
          Modifier l'angle ({currentAngle.toFixed(1)}°)
        </button>
      </>
    );
  };

  // Render closed shape menu
  const renderClosedShapeMenu = () => {
    if (!contextMenu.shapeGeoIds || !contextMenu.shapePath) return null;
    
    const key = [...contextMenu.shapeGeoIds].sort().join("-");
    const existingFill = sketch.shapeFills.get(key);

    return (
      <>
        <button
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          onClick={() => {
            if (contextMenu.shapeGeoIds && contextMenu.shapePath) {
              openFillDialog(contextMenu.shapeGeoIds, contextMenu.shapePath);
            }
            setContextMenu(null);
          }}
        >
          <PaintBucket className="h-4 w-4 text-blue-500" />
          Remplir / Hachurer
        </button>
        {existingFill && (
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              if (contextMenu.shapeGeoIds) {
                removeShapeFill(contextMenu.shapeGeoIds);
              }
              setContextMenu(null);
            }}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
            Supprimer le remplissage
          </button>
        )}
      </>
    );
  };

  return (
    <>
      <div
        className="fixed bg-white rounded-lg shadow-xl border z-[100] py-1 min-w-[160px] max-h-[90vh] overflow-y-auto"
        style={{ left: adjustedX, top: adjustedY }}
        onClick={() => setContextMenu(null)}
      >
        {contextMenu.entityType === "arc" && renderArcMenu()}
        {contextMenu.entityType === "line" && renderLineMenu()}
        {(contextMenu.entityType === "circle" || contextMenu.entityType === "bezier") && (
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
            onClick={() => {
              setSelectedEntities(new Set([contextMenu.entityId]));
              deleteSelectedEntities();
              setContextMenu(null);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </button>
        )}
        {contextMenu.entityType === "image" && renderImageMenu()}
        {contextMenu.entityType === "point" && renderPointMenu()}
        {contextMenu.entityType === "corner" && renderCornerMenu()}
        {contextMenu.entityType === "closedShape" && renderClosedShapeMenu()}
      </div>
      {/* Overlay pour fermer le menu */}
      <div className="fixed inset-0 z-[99]" onClick={() => setContextMenu(null)} />
    </>
  );
}

export default ContextMenuCAD;
