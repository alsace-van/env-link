// ============================================
// COMPOSANT: CropDialog
// VERSION: 1.0
// Description: Dialogue de recadrage d'image avec canvas interactif
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import React from "react";
import { X, Crop, Check, Maximize2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ============================================
// TYPES
// ============================================

export interface CropSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectedImageData {
  image: {
    id: string;
    image: HTMLImageElement;
  };
  adjustments: {
    contrast: number;
    brightness: number;
    sharpen: number;
    saturate: number;
    grayscale: boolean;
    invert: boolean;
  };
}

export interface CropDialogProps {
  // Visibility
  showCropDialog: boolean;
  setShowCropDialog: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Image data
  selectedImageData: SelectedImageData;
  
  // Crop selection
  cropSelection: CropSelection;
  setCropSelection: React.Dispatch<React.SetStateAction<CropSelection>>;
  
  // Position
  position: { x: number; y: number };
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  
  // Callbacks
  applyCrop: () => void;
  resetCrop: () => void;
}

// ============================================
// COMPOSANT
// ============================================

export function CropDialog({
  showCropDialog,
  setShowCropDialog,
  selectedImageData,
  cropSelection,
  setCropSelection,
  position,
  setPosition,
  applyCrop,
  resetCrop,
}: CropDialogProps) {
  // État local pour le drag du panneau
  const [isPanelDragging, setIsPanelDragging] = React.useState(false);
  const [panelDragStart, setPanelDragStart] = React.useState({ x: 0, y: 0 });
  
  // État local pour le drag de la zone de crop
  const [cropDragging, setCropDragging] = React.useState<string | null>(null);
  const [cropDragStart, setCropDragStart] = React.useState<{ x: number; y: number; crop: CropSelection }>({
    x: 0,
    y: 0,
    crop: { x: 0, y: 0, width: 100, height: 100 },
  });

  if (!showCropDialog || !selectedImageData) return null;

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
      style={{
        left: position.x,
        top: position.y,
        width: 400,
      }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest(".crop-canvas-container")) return;
        if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "BUTTON") return;
        setIsPanelDragging(true);
        setPanelDragStart({
          x: e.clientX - position.x,
          y: e.clientY - position.y,
        });
      }}
      onMouseMove={(e) => {
        if (isPanelDragging) {
          setPosition({
            x: e.clientX - panelDragStart.x,
            y: e.clientY - panelDragStart.y,
          });
        }
      }}
      onMouseUp={() => setIsPanelDragging(false)}
      onMouseLeave={() => setIsPanelDragging(false)}
    >
      {/* Header draggable - vert pour crop */}
      <div className="flex items-center justify-between px-3 py-2 bg-green-600 text-white rounded-t-lg cursor-move">
        <div className="flex items-center gap-2">
          <Crop className="h-3.5 w-3.5" />
          <span className="text-sm font-medium">Recadrer l'image</span>
        </div>
        <button className="text-white/80 hover:text-white" onClick={() => setShowCropDialog(false)}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Contenu */}
      <div className="p-3 space-y-3">
        {/* Canvas de preview avec zone de crop */}
        <div className="crop-canvas-container relative bg-gray-100 rounded overflow-hidden" style={{ height: 280 }}>
          <canvas
            ref={(canvas) => {
              if (!canvas || !selectedImageData) return;
              const ctx = canvas.getContext("2d");
              if (!ctx) return;

              const sourceImage = selectedImageData.image.image;
              if (!sourceImage || !sourceImage.complete || sourceImage.naturalWidth === 0) {
                console.warn("Image not loaded yet");
                return;
              }

              const aspectRatio = sourceImage.width / sourceImage.height;

              const maxWidth = 376;
              const maxHeight = 260;
              let canvasWidth, canvasHeight;

              if (aspectRatio > maxWidth / maxHeight) {
                canvasWidth = maxWidth;
                canvasHeight = maxWidth / aspectRatio;
              } else {
                canvasHeight = maxHeight;
                canvasWidth = maxHeight * aspectRatio;
              }

              canvas.width = canvasWidth;
              canvas.height = canvasHeight;

              ctx.drawImage(sourceImage, 0, 0, canvasWidth, canvasHeight);

              ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
              ctx.fillRect(0, 0, canvasWidth, canvasHeight);

              const cropX = (cropSelection.x / 100) * canvasWidth;
              const cropY = (cropSelection.y / 100) * canvasHeight;
              const cropW = (cropSelection.width / 100) * canvasWidth;
              const cropH = (cropSelection.height / 100) * canvasHeight;

              ctx.save();
              ctx.beginPath();
              ctx.rect(cropX, cropY, cropW, cropH);
              ctx.clip();
              ctx.drawImage(sourceImage, 0, 0, canvasWidth, canvasHeight);
              ctx.restore();

              ctx.strokeStyle = "#22c55e";
              ctx.lineWidth = 2;
              ctx.setLineDash([]);
              ctx.strokeRect(cropX, cropY, cropW, cropH);

              const handleSize = 8;
              ctx.fillStyle = "#22c55e";

              // Coins
              ctx.fillRect(cropX - handleSize / 2, cropY - handleSize / 2, handleSize, handleSize);
              ctx.fillRect(cropX + cropW - handleSize / 2, cropY - handleSize / 2, handleSize, handleSize);
              ctx.fillRect(cropX - handleSize / 2, cropY + cropH - handleSize / 2, handleSize, handleSize);
              ctx.fillRect(cropX + cropW - handleSize / 2, cropY + cropH - handleSize / 2, handleSize, handleSize);

              // Milieux
              ctx.fillRect(cropX + cropW / 2 - handleSize / 2, cropY - handleSize / 2, handleSize, handleSize);
              ctx.fillRect(cropX + cropW / 2 - handleSize / 2, cropY + cropH - handleSize / 2, handleSize, handleSize);
              ctx.fillRect(cropX - handleSize / 2, cropY + cropH / 2 - handleSize / 2, handleSize, handleSize);
              ctx.fillRect(cropX + cropW - handleSize / 2, cropY + cropH / 2 - handleSize / 2, handleSize, handleSize);
            }}
            onMouseDown={(e) => {
              const canvas = e.currentTarget;
              const rect = canvas.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const canvasWidth = canvas.width;
              const canvasHeight = canvas.height;

              const cropX = (cropSelection.x / 100) * canvasWidth;
              const cropY = (cropSelection.y / 100) * canvasHeight;
              const cropW = (cropSelection.width / 100) * canvasWidth;
              const cropH = (cropSelection.height / 100) * canvasHeight;

              const handleSize = 12;
              let handle: string | null = null;

              // Coins
              if (Math.abs(x - cropX) < handleSize && Math.abs(y - cropY) < handleSize) handle = "nw";
              else if (Math.abs(x - (cropX + cropW)) < handleSize && Math.abs(y - cropY) < handleSize) handle = "ne";
              else if (Math.abs(x - cropX) < handleSize && Math.abs(y - (cropY + cropH)) < handleSize) handle = "sw";
              else if (Math.abs(x - (cropX + cropW)) < handleSize && Math.abs(y - (cropY + cropH)) < handleSize)
                handle = "se";
              // Milieux
              else if (Math.abs(x - (cropX + cropW / 2)) < handleSize && Math.abs(y - cropY) < handleSize) handle = "n";
              else if (Math.abs(x - (cropX + cropW / 2)) < handleSize && Math.abs(y - (cropY + cropH)) < handleSize)
                handle = "s";
              else if (Math.abs(x - cropX) < handleSize && Math.abs(y - (cropY + cropH / 2)) < handleSize) handle = "w";
              else if (Math.abs(x - (cropX + cropW)) < handleSize && Math.abs(y - (cropY + cropH / 2)) < handleSize)
                handle = "e";
              // Déplacement
              else if (x >= cropX && x <= cropX + cropW && y >= cropY && y <= cropY + cropH) handle = "move";

              if (handle) {
                setCropDragging(handle);
                setCropDragStart({ x, y, crop: { ...cropSelection } });
              }
            }}
            onMouseMove={(e) => {
              if (!cropDragging) return;

              const canvas = e.currentTarget;
              const rect = canvas.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const canvasWidth = canvas.width;
              const canvasHeight = canvas.height;

              const dx = ((x - cropDragStart.x) / canvasWidth) * 100;
              const dy = ((y - cropDragStart.y) / canvasHeight) * 100;

              let newCrop = { ...cropDragStart.crop };

              switch (cropDragging) {
                case "move":
                  newCrop.x = Math.max(0, Math.min(100 - newCrop.width, cropDragStart.crop.x + dx));
                  newCrop.y = Math.max(0, Math.min(100 - newCrop.height, cropDragStart.crop.y + dy));
                  break;
                case "nw":
                  newCrop.x = Math.max(0, Math.min(cropDragStart.crop.x + cropDragStart.crop.width - 5, cropDragStart.crop.x + dx));
                  newCrop.y = Math.max(0, Math.min(cropDragStart.crop.y + cropDragStart.crop.height - 5, cropDragStart.crop.y + dy));
                  newCrop.width = cropDragStart.crop.width - (newCrop.x - cropDragStart.crop.x);
                  newCrop.height = cropDragStart.crop.height - (newCrop.y - cropDragStart.crop.y);
                  break;
                case "ne":
                  newCrop.y = Math.max(0, Math.min(cropDragStart.crop.y + cropDragStart.crop.height - 5, cropDragStart.crop.y + dy));
                  newCrop.width = Math.max(5, Math.min(100 - newCrop.x, cropDragStart.crop.width + dx));
                  newCrop.height = cropDragStart.crop.height - (newCrop.y - cropDragStart.crop.y);
                  break;
                case "sw":
                  newCrop.x = Math.max(0, Math.min(cropDragStart.crop.x + cropDragStart.crop.width - 5, cropDragStart.crop.x + dx));
                  newCrop.width = cropDragStart.crop.width - (newCrop.x - cropDragStart.crop.x);
                  newCrop.height = Math.max(5, Math.min(100 - newCrop.y, cropDragStart.crop.height + dy));
                  break;
                case "se":
                  newCrop.width = Math.max(5, Math.min(100 - newCrop.x, cropDragStart.crop.width + dx));
                  newCrop.height = Math.max(5, Math.min(100 - newCrop.y, cropDragStart.crop.height + dy));
                  break;
                case "n":
                  newCrop.y = Math.max(0, Math.min(cropDragStart.crop.y + cropDragStart.crop.height - 5, cropDragStart.crop.y + dy));
                  newCrop.height = cropDragStart.crop.height - (newCrop.y - cropDragStart.crop.y);
                  break;
                case "s":
                  newCrop.height = Math.max(5, Math.min(100 - newCrop.y, cropDragStart.crop.height + dy));
                  break;
                case "w":
                  newCrop.x = Math.max(0, Math.min(cropDragStart.crop.x + cropDragStart.crop.width - 5, cropDragStart.crop.x + dx));
                  newCrop.width = cropDragStart.crop.width - (newCrop.x - cropDragStart.crop.x);
                  break;
                case "e":
                  newCrop.width = Math.max(5, Math.min(100 - newCrop.x, cropDragStart.crop.width + dx));
                  break;
              }

              setCropSelection(newCrop);
            }}
            onMouseUp={() => setCropDragging(null)}
            onMouseLeave={() => setCropDragging(null)}
            style={{ display: "block", margin: "auto", cursor: cropDragging ? "grabbing" : "crosshair" }}
          />
        </div>

        {/* Valeurs numériques */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div>
            <Label className="text-xs text-muted-foreground">X</Label>
            <Input
              type="number"
              min="0"
              max="95"
              value={cropSelection.x.toFixed(0)}
              onChange={(e) => {
                const val = Math.max(0, Math.min(100 - cropSelection.width, parseFloat(e.target.value) || 0));
                setCropSelection((c) => ({ ...c, x: val }));
              }}
              className="h-7 text-xs"
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Y</Label>
            <Input
              type="number"
              min="0"
              max="95"
              value={cropSelection.y.toFixed(0)}
              onChange={(e) => {
                const val = Math.max(0, Math.min(100 - cropSelection.height, parseFloat(e.target.value) || 0));
                setCropSelection((c) => ({ ...c, y: val }));
              }}
              className="h-7 text-xs"
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Largeur %</Label>
            <Input
              type="number"
              min="5"
              max="100"
              value={cropSelection.width.toFixed(0)}
              onChange={(e) => {
                const val = Math.max(5, Math.min(100 - cropSelection.x, parseFloat(e.target.value) || 5));
                setCropSelection((c) => ({ ...c, width: val }));
              }}
              className="h-7 text-xs"
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Hauteur %</Label>
            <Input
              type="number"
              min="5"
              max="100"
              value={cropSelection.height.toFixed(0)}
              onChange={(e) => {
                const val = Math.max(5, Math.min(100 - cropSelection.y, parseFloat(e.target.value) || 5));
                setCropSelection((c) => ({ ...c, height: val }));
              }}
              className="h-7 text-xs"
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => setCropSelection({ x: 0, y: 0, width: 100, height: 100 })}
          >
            <Maximize2 className="h-3 w-3 mr-1" />
            100%
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={resetCrop}>
            <RotateCw className="h-3 w-3 mr-1" />
            Reset
          </Button>
          <Button size="sm" className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700" onClick={applyCrop}>
            <Check className="h-3 w-3 mr-1" />
            Appliquer
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CropDialog;
