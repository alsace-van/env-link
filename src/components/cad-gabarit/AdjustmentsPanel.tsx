// ============================================
// COMPOSANT: AdjustmentsPanel
// VERSION: 1.0
// Description: Panneau flottant pour les ajustements d'image
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import React from "react";
import { X, Sliders, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

// ============================================
// TYPES
// ============================================

export interface ImageAdjustments {
  contrast: number;
  brightness: number;
  sharpen: number;
  saturate: number;
  grayscale: boolean;
  invert: boolean;
}

export interface SelectedImageData {
  adjustments: ImageAdjustments;
  image: {
    id: string;
    image: HTMLImageElement;
  };
}

export interface AdjustmentsPanelProps {
  // Visibility
  showAdjustmentsDialog: boolean;
  setShowAdjustmentsDialog: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Image data
  selectedImageData: SelectedImageData;
  
  // Position
  position: { x: number; y: number };
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  
  // Callbacks
  updateSelectedImageAdjustments: (adjustments: Partial<ImageAdjustments>) => void;
  resetImageAdjustments: () => void;
}

// ============================================
// COMPOSANT
// ============================================

export function AdjustmentsPanel({
  showAdjustmentsDialog,
  setShowAdjustmentsDialog,
  selectedImageData,
  position,
  setPosition,
  updateSelectedImageAdjustments,
  resetImageAdjustments,
}: AdjustmentsPanelProps) {
  // État local pour le drag
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  if (!showAdjustmentsDialog || !selectedImageData) return null;

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
      style={{
        left: position.x,
        top: position.y,
        width: 280,
      }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "BUTTON") return;
        setIsDragging(true);
        setDragStart({
          x: e.clientX - position.x,
          y: e.clientY - position.y,
        });
      }}
      onMouseMove={(e) => {
        if (isDragging) {
          setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
          });
        }
      }}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    >
      {/* Header draggable - violet pour ajustements */}
      <div className="flex items-center justify-between px-3 py-2 bg-purple-500 text-white rounded-t-lg cursor-move">
        <div className="flex items-center gap-2">
          <Sliders className="h-3.5 w-3.5" />
          <span className="text-sm font-medium">Ajustements image</span>
        </div>
        <button className="text-white/80 hover:text-white" onClick={() => setShowAdjustmentsDialog(false)}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Contenu */}
      <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
        {/* Contraste */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Contraste</Label>
            <span className="text-xs text-muted-foreground">{selectedImageData.adjustments.contrast}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="200"
            value={selectedImageData.adjustments.contrast}
            onChange={(e) => updateSelectedImageAdjustments({ contrast: parseInt(e.target.value) })}
            className="w-full h-1.5 accent-purple-500"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>

        {/* Luminosité */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Luminosité</Label>
            <span className="text-xs text-muted-foreground">{selectedImageData.adjustments.brightness}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="200"
            value={selectedImageData.adjustments.brightness}
            onChange={(e) => updateSelectedImageAdjustments({ brightness: parseInt(e.target.value) })}
            className="w-full h-1.5 accent-purple-500"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>

        {/* Netteté */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Netteté</Label>
            <span className="text-xs text-muted-foreground">{selectedImageData.adjustments.sharpen}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={selectedImageData.adjustments.sharpen}
            onChange={(e) => updateSelectedImageAdjustments({ sharpen: parseInt(e.target.value) })}
            className="w-full h-1.5 accent-purple-500"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>

        {/* Saturation */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Saturation</Label>
            <span className="text-xs text-muted-foreground">{selectedImageData.adjustments.saturate}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            value={selectedImageData.adjustments.saturate}
            onChange={(e) => updateSelectedImageAdjustments({ saturate: parseInt(e.target.value) })}
            className="w-full h-1.5 accent-purple-500"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>

        <Separator className="my-2" />

        {/* Options binaires compactes */}
        <div className="flex items-center justify-between">
          <Label className="text-xs">Noir et blanc</Label>
          <Switch
            checked={selectedImageData.adjustments.grayscale}
            onCheckedChange={(checked) => updateSelectedImageAdjustments({ grayscale: checked })}
            className="scale-75"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Négatif</Label>
          <Switch
            checked={selectedImageData.adjustments.invert}
            onCheckedChange={(checked) => updateSelectedImageAdjustments({ invert: checked })}
            className="scale-75"
          />
        </div>

        <Separator className="my-2" />

        {/* Presets rapides */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Presets</Label>
          <div className="grid grid-cols-3 gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() =>
                updateSelectedImageAdjustments({
                  contrast: 140,
                  brightness: 110,
                  sharpen: 30,
                  saturate: 100,
                  grayscale: false,
                  invert: false,
                })
              }
            >
              Contours+
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() =>
                updateSelectedImageAdjustments({
                  contrast: 180,
                  brightness: 100,
                  sharpen: 50,
                  saturate: 0,
                  grayscale: true,
                  invert: false,
                })
              }
            >
              N&B
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() =>
                updateSelectedImageAdjustments({
                  contrast: 150,
                  brightness: 120,
                  sharpen: 40,
                  saturate: 100,
                  grayscale: false,
                  invert: true,
                })
              }
            >
              Négatif
            </Button>
          </div>
        </div>

        {/* Bouton reset */}
        <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={resetImageAdjustments}>
          <RotateCw className="h-3 w-3 mr-1" />
          Réinitialiser
        </Button>
      </div>
    </div>
  );
}

export default AdjustmentsPanel;
