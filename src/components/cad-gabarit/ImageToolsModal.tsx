// ============================================
// COMPOSANT: ImageToolsModal
// Modale flottante détachable pour les outils photo
// VERSION: 1.1 - Tous les outils (rotation, recadrage, ajustements, etc.)
// ============================================

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Focus,
  ArrowUpToLine,
  ArrowDownToLine,
  SlidersHorizontal,
  Contrast,
  RotateCcw,
  RotateCw,
  Ruler,
  Layers,
  Trash2,
  X,
  GripVertical,
  Pin,
  PinOff,
  Crop,
  MapPin,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { BackgroundImage, Layer } from "./types";
import { Button } from "@/components/ui/button";

interface ImageToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Image(s) sélectionnée(s)
  selectedImageId: string | null;
  selectedImageIds: Set<string>;
  backgroundImages: BackgroundImage[];
  setBackgroundImages: React.Dispatch<React.SetStateAction<BackgroundImage[]>>;
  // Calques
  layers: Map<string, Layer>;
  setSketch: React.Dispatch<React.SetStateAction<any>>;
  // Actions
  onCalibrate: (imageId: string) => void;
  onMoveToNewLayer: (imageId: string) => void;
  onMoveToLayer: (imageId: string, layerId: string) => void;
  onDelete: (imageId: string) => void;
  onAdjustContours: () => void;
  onCrop: () => void;
  onAddMarker: () => void;
  onLinkMarkers: () => void;
  // Rotation
  getSelectedImageRotation: () => number;
  updateSelectedImageRotation: (rotation: number) => void;
  // Position initiale (là où était le menu contextuel)
  initialPosition?: { x: number; y: number };
}

export const ImageToolsModal: React.FC<ImageToolsModalProps> = ({
  isOpen,
  onClose,
  selectedImageId,
  selectedImageIds,
  backgroundImages,
  setBackgroundImages,
  layers,
  setSketch,
  onCalibrate,
  onMoveToNewLayer,
  onMoveToLayer,
  onDelete,
  onAdjustContours,
  onCrop,
  onAddMarker,
  onLinkMarkers,
  getSelectedImageRotation,
  updateSelectedImageRotation,
  initialPosition,
}) => {
  // Position de la modale
  const [position, setPosition] = useState({ x: initialPosition?.x || 100, y: initialPosition?.y || 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPinned, setIsPinned] = useState(true); // Épinglé par défaut
  const modalRef = useRef<HTMLDivElement>(null);

  // Mettre à jour la position si initialPosition change
  useEffect(() => {
    if (initialPosition && !isDragging) {
      setPosition({ x: initialPosition.x, y: initialPosition.y });
    }
  }, [initialPosition]);

  // Image principale sélectionnée
  const image = backgroundImages.find((img) => img.id === selectedImageId);
  const currentLayer = image ? layers.get(image.layerId || "") : undefined;
  const multiCount = selectedImageIds.size > 1 ? selectedImageIds.size : 0;
  const imagesToUpdate = multiCount > 0 ? selectedImageIds : new Set(selectedImageId ? [selectedImageId] : []);
  const hasSelection = selectedImageId || selectedImageIds.size > 0;

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    setIsDragging(true);
    const rect = modalRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Actions
  const toggleLock = useCallback(() => {
    if (!selectedImageId) return;
    setBackgroundImages((prev) =>
      prev.map((img) =>
        img.id === selectedImageId ? { ...img, locked: !img.locked } : img
      )
    );
    toast.success(image?.locked ? "Déverrouillée" : "Verrouillée", { duration: 1500 });
  }, [selectedImageId, image, setBackgroundImages]);

  const toggleVisible = useCallback(() => {
    if (!selectedImageId) return;
    setBackgroundImages((prev) =>
      prev.map((img) =>
        img.id === selectedImageId ? { ...img, visible: !img.visible } : img
      )
    );
    toast.success(image?.visible ? "Masquée" : "Affichée", { duration: 1500 });
  }, [selectedImageId, image, setBackgroundImages]);

  const toggleSolo = useCallback(() => {
    if (!currentLayer) return;
    setSketch((prev: any) => {
      const newLayers = new Map(prev.layers);
      const isCurrentlySolo = currentLayer.solo;
      newLayers.forEach((l: Layer, id: string) => {
        newLayers.set(id, { ...l, solo: isCurrentlySolo ? false : id === currentLayer.id });
      });
      return { ...prev, layers: newLayers };
    });
    toast.success(currentLayer.solo ? "Solo désactivé" : `"${currentLayer.name}" isolé`, { duration: 1500 });
  }, [currentLayer, setSketch]);

  const bringToFront = useCallback(() => {
    setBackgroundImages((prev) => {
      const maxOrder = Math.max(...prev.map((img) => img.order), 0);
      let nextOrder = maxOrder + 1;
      return prev.map((img) => imagesToUpdate.has(img.id) ? { ...img, order: nextOrder++ } : img);
    });
    toast.success(multiCount > 0 ? `${multiCount} photos ↑` : "↑ Premier plan", { duration: 1500 });
  }, [imagesToUpdate, multiCount, setBackgroundImages]);

  const sendToBack = useCallback(() => {
    setBackgroundImages((prev) => {
      const minOrder = Math.min(...prev.map((img) => img.order), 0);
      let nextOrder = minOrder - imagesToUpdate.size;
      return prev.map((img) => imagesToUpdate.has(img.id) ? { ...img, order: nextOrder++ } : img);
    });
    toast.success(multiCount > 0 ? `${multiCount} photos ↓` : "↓ Arrière-plan", { duration: 1500 });
  }, [imagesToUpdate, multiCount, setBackgroundImages]);

  const toggleStripes = useCallback(() => {
    setBackgroundImages((prev) =>
      prev.map((img) =>
        imagesToUpdate.has(img.id)
          ? { ...img, blendMode: img.blendMode === "stripes" ? "normal" : "stripes" }
          : img
      )
    );
    toast.success(image?.blendMode === "stripes" ? "Mode normal" : "Mode damier", { duration: 1500 });
  }, [imagesToUpdate, image, setBackgroundImages]);

  const setOpacity = useCallback((opacity: number) => {
    setBackgroundImages((prev) =>
      prev.map((img) => imagesToUpdate.has(img.id) ? { ...img, opacity } : img)
    );
  }, [imagesToUpdate, setBackgroundImages]);

  const resetOpacity = useCallback(() => {
    setBackgroundImages((prev) =>
      prev.map((img) => imagesToUpdate.has(img.id) ? { ...img, opacity: 1 } : img)
    );
    toast.success("Opacité: 100%", { duration: 1500 });
  }, [imagesToUpdate, setBackgroundImages]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed bg-white rounded-lg shadow-2xl border border-gray-300 z-[10000] select-none"
      style={{
        left: position.x,
        top: position.y,
        minWidth: 260,
        maxWidth: 300,
        cursor: isDragging ? "grabbing" : "default",
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header avec titre et boutons */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-100 rounded-t-lg border-b cursor-grab">
        <div className="flex items-center gap-1.5">
          <GripVertical className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-700">
            Outils photo {multiCount > 0 && `(${multiCount})`}
          </span>
        </div>
        <div className="flex items-center gap-1" data-no-drag>
          <button
            className={`p-1 rounded hover:bg-gray-200 ${isPinned ? "bg-blue-100" : ""}`}
            title={isPinned ? "Fermer après action" : "Garder ouvert"}
            onClick={() => setIsPinned(!isPinned)}
          >
            {isPinned ? <Pin className="h-3 w-3 text-blue-500" /> : <PinOff className="h-3 w-3 text-gray-400" />}
          </button>
          <button
            className="p-1 rounded hover:bg-gray-200"
            title="Fermer"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-2 max-h-[70vh] overflow-y-auto" data-no-drag>
        {/* Opacité */}
        <div className="mb-3">
          <label className="text-[10px] text-gray-500 mb-1 block">
            Opacité {hasSelection ? (multiCount > 0 ? `(${multiCount} photos)` : "") : "(par défaut)"}
          </label>
          <div className="flex items-center gap-2">
            <Contrast className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
            <input
              type="range"
              min="10"
              max="100"
              value={Math.round((image?.opacity ?? 1) * 100)}
              onChange={(e) => setOpacity(parseInt(e.target.value) / 100)}
              className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <span className="text-xs text-gray-600 w-8 text-right">{Math.round((image?.opacity ?? 1) * 100)}%</span>
            <button
              className="p-1 rounded hover:bg-gray-200"
              title="Réinitialiser opacité"
              onClick={resetOpacity}
            >
              <RotateCcw className="h-3 w-3 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Rotation (si image sélectionnée) */}
        {hasSelection && (
          <div className="mb-3">
            <label className="text-[10px] text-gray-500 mb-1 block">
              Rotation {multiCount > 0 && `(${multiCount} photos)`}
            </label>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => updateSelectedImageRotation(getSelectedImageRotation() - 90)}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-1"
                onClick={() => updateSelectedImageRotation(getSelectedImageRotation() - 1)}
              >
                <span className="text-xs">-1°</span>
              </Button>
              <input
                type="number"
                value={Math.round(getSelectedImageRotation() * 10) / 10}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) updateSelectedImageRotation(val);
                }}
                className="h-7 w-14 text-xs text-center border rounded"
                step="0.1"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-1"
                onClick={() => updateSelectedImageRotation(getSelectedImageRotation() + 1)}
              >
                <span className="text-xs">+1°</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => updateSelectedImageRotation(getSelectedImageRotation() + 90)}
              >
                <RotateCw className="h-3 w-3" />
              </Button>
              {getSelectedImageRotation() !== 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-500"
                  onClick={() => updateSelectedImageRotation(0)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Actions rapides - icônes */}
        {hasSelection && (
          <div className="flex items-center justify-around py-1.5 border-y mb-2">
            <button
              className={`p-1.5 rounded hover:bg-gray-100 ${image?.locked ? "bg-green-50" : ""}`}
              title={image?.locked ? "Déverrouiller" : "Verrouiller"}
              onClick={toggleLock}
            >
              {image?.locked ? <Unlock className="h-4 w-4 text-green-500" /> : <Lock className="h-4 w-4 text-orange-500" />}
            </button>
            <button
              className={`p-1.5 rounded hover:bg-gray-100 ${!image?.visible ? "bg-blue-50" : ""}`}
              title={image?.visible ? "Masquer" : "Afficher"}
              onClick={toggleVisible}
            >
              {image?.visible ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-blue-500" />}
            </button>
            <button
              className={`p-1.5 rounded hover:bg-gray-100 ${currentLayer?.solo ? "bg-yellow-100" : ""}`}
              title={currentLayer?.solo ? "Désactiver solo" : "Isoler (Solo)"}
              onClick={toggleSolo}
            >
              <Focus className={`h-4 w-4 ${currentLayer?.solo ? "text-yellow-600" : "text-yellow-500"}`} />
            </button>
            <button
              className="p-1.5 rounded hover:bg-gray-100"
              title="Premier plan"
              onClick={bringToFront}
            >
              <ArrowUpToLine className="h-4 w-4 text-blue-500" />
            </button>
            <button
              className="p-1.5 rounded hover:bg-gray-100"
              title="Arrière-plan"
              onClick={sendToBack}
            >
              <ArrowDownToLine className="h-4 w-4 text-orange-500" />
            </button>
            <button
              className={`p-1.5 rounded hover:bg-gray-100 ${image?.blendMode === "stripes" ? "bg-cyan-100" : ""}`}
              title={image?.blendMode === "stripes" ? "Mode normal" : "Mode damier (alignement)"}
              onClick={toggleStripes}
            >
              <SlidersHorizontal className={`h-4 w-4 ${image?.blendMode === "stripes" ? "text-cyan-600" : "text-cyan-500"}`} />
            </button>
          </div>
        )}

        {/* Actions principales */}
        <div className="space-y-0.5">
          <button
            className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-100 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              onAdjustContours();
              if (!isPinned) onClose();
            }}
            disabled={!selectedImageId}
          >
            <Contrast className="h-3.5 w-3.5 text-purple-500" />
            Ajuster les contours
          </button>

          <button
            className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-100 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              onCrop();
              if (!isPinned) onClose();
            }}
            disabled={!selectedImageId}
          >
            <Crop className="h-3.5 w-3.5 text-green-500" />
            Recadrer
          </button>

          <button
            className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-100 rounded flex items-center gap-2"
            onClick={() => {
              if (selectedImageId) {
                onCalibrate(selectedImageId);
              }
              if (!isPinned) onClose();
            }}
            disabled={!selectedImageId}
          >
            <Ruler className="h-3.5 w-3.5 text-cyan-500" />
            Calibration
          </button>

          <div className="border-t my-1.5" />

          <button
            className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-100 rounded flex items-center gap-2"
            onClick={() => {
              onAddMarker();
              if (!isPinned) onClose();
            }}
          >
            <MapPin className="h-3.5 w-3.5 text-pink-500" />
            Ajouter un marqueur
          </button>

          <button
            className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-100 rounded flex items-center gap-2"
            onClick={() => {
              onLinkMarkers();
              if (!isPinned) onClose();
            }}
          >
            <Link2 className="h-3.5 w-3.5 text-indigo-500" />
            Lier deux marqueurs
          </button>

          <div className="border-t my-1.5" />

          <button
            className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-100 rounded flex items-center gap-2"
            onClick={() => {
              if (selectedImageId) {
                onMoveToNewLayer(selectedImageId);
              }
              if (!isPinned) onClose();
            }}
            disabled={!selectedImageId}
          >
            <Layers className="h-3.5 w-3.5 text-blue-500" />
            Nouveau calque
          </button>

          {/* Liste des calques */}
          {layers.size > 1 && selectedImageId && (
            <div className="pl-5 space-y-0.5 max-h-24 overflow-y-auto">
              {Array.from(layers.values())
                .filter((layer) => layer.id !== image?.layerId)
                .map((layer) => (
                  <button
                    key={layer.id}
                    className="w-full px-2 py-1 text-left text-[11px] hover:bg-gray-100 rounded flex items-center gap-2"
                    onClick={() => {
                      onMoveToLayer(selectedImageId, layer.id);
                      if (!isPinned) onClose();
                    }}
                  >
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: layer.color }} />
                    <span className="truncate">→ {layer.name}</span>
                  </button>
                ))}
            </div>
          )}

          <div className="border-t my-1.5" />

          <button
            className="w-full px-2 py-1.5 text-left text-xs hover:bg-red-50 rounded flex items-center gap-2 text-red-600 disabled:opacity-50"
            onClick={() => {
              if (selectedImageId) {
                onDelete(selectedImageId);
              }
              if (!isPinned) onClose();
            }}
            disabled={!selectedImageId}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer la photo
          </button>
        </div>

        {/* Info calque */}
        {currentLayer && (
          <div className="mt-2 pt-1.5 border-t flex items-center gap-1.5 text-[10px] text-gray-400">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: currentLayer.color }} />
            {currentLayer.name}
          </div>
        )}
      </div>
    </div>
  );
};
