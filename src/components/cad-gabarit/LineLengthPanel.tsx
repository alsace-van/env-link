// ============================================
// COMPOSANT: LineLengthPanel
// VERSION: 1.0
// Description: Panneau flottant pour modifier la longueur d'une ligne
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import React from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Sketch } from "./types";

// ============================================
// TYPES
// ============================================

export interface LineLengthDialogState {
  open: boolean;
  lineId: string;
  currentLength: number;
  newLength: string;
  anchorMode: "p1" | "p2" | "center";
  originalSketch: Sketch | null;
}

export interface LineLengthPanelProps {
  // Dialog state
  lineLengthDialog: LineLengthDialogState;
  setLineLengthDialog: React.Dispatch<React.SetStateAction<LineLengthDialogState | null>>;
  
  // Position
  position: { x: number; y: number };
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  
  // Sketch
  setSketch: React.Dispatch<React.SetStateAction<Sketch>>;
  sketchRef: React.MutableRefObject<Sketch>;
  
  // Callbacks
  applyLineLengthChange: (lineId: string, newLength: number, anchorMode: "p1" | "p2" | "center", addHistory: boolean) => void;
  addToHistory: (sketch: Sketch, description?: string) => void;
}

// ============================================
// COMPOSANT
// ============================================

export function LineLengthPanel({
  lineLengthDialog,
  setLineLengthDialog,
  position,
  setPosition,
  setSketch,
  sketchRef,
  applyLineLengthChange,
  addToHistory,
}: LineLengthPanelProps) {
  // État local pour le drag
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  const handleClose = () => {
    if (lineLengthDialog.originalSketch) {
      setSketch(lineLengthDialog.originalSketch);
    }
    setLineLengthDialog(null);
  };

  const handleValidate = () => {
    const value = parseFloat(lineLengthDialog.newLength);
    if (!isNaN(value) && value > 0) {
      addToHistory(sketchRef.current);
      toast.success(`Longueur modifiée: ${value.toFixed(1)} mm`);
      setLineLengthDialog(null);
    }
  };

  const handleAnchorChange = (newMode: "p1" | "p2" | "center") => {
    const value = parseFloat(lineLengthDialog.newLength);
    if (lineLengthDialog.originalSketch) {
      setSketch(lineLengthDialog.originalSketch);
      if (!isNaN(value) && value > 0) {
        setTimeout(() => {
          applyLineLengthChange(lineLengthDialog.lineId, value, newMode, false);
        }, 0);
      }
    }
    setLineLengthDialog({ ...lineLengthDialog, anchorMode: newMode });
  };

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
      style={{
        left: position.x,
        top: position.y,
        width: 220,
      }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "BUTTON") return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
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
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-blue-500 text-white rounded-t-lg cursor-move">
        <span className="text-sm font-medium">📏 Longueur</span>
        <button onClick={handleClose}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Contenu */}
      <div className="p-2 space-y-2">
        {/* Longueur actuelle */}
        <div className="text-xs text-gray-500">Actuel: {lineLengthDialog.currentLength.toFixed(1)} mm</div>

        {/* Input nouvelle longueur */}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={lineLengthDialog.newLength}
            onChange={(e) => {
              const newValue = e.target.value;
              const value = parseFloat(newValue);
              if (!isNaN(value) && value > 0) {
                applyLineLengthChange(lineLengthDialog.lineId, value, lineLengthDialog.anchorMode, false);
              }
              setLineLengthDialog({ ...lineLengthDialog, newLength: newValue });
            }}
            className="h-8 flex-1 text-sm"
            min="0.1"
            step="0.1"
            autoFocus
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                handleValidate();
              }
              if (e.key === "Escape") {
                handleClose();
              }
            }}
          />
          <span className="text-xs text-gray-500">mm</span>
        </div>

        {/* Boutons P1 / Centre / P2 */}
        <div className="flex gap-1">
          <Button
            variant={lineLengthDialog.anchorMode === "p1" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-7 text-xs px-1"
            style={
              lineLengthDialog.anchorMode === "p1"
                ? { backgroundColor: "#10B981", borderColor: "#10B981" }
                : { borderColor: "#10B981", color: "#10B981" }
            }
            onClick={() => handleAnchorChange("p1")}
          >
            P1 fixe
          </Button>
          <Button
            variant={lineLengthDialog.anchorMode === "center" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-7 text-xs px-1"
            onClick={() => handleAnchorChange("center")}
          >
            Centre
          </Button>
          <Button
            variant={lineLengthDialog.anchorMode === "p2" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-7 text-xs px-1"
            style={
              lineLengthDialog.anchorMode === "p2"
                ? { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" }
                : { borderColor: "#8B5CF6", color: "#8B5CF6" }
            }
            onClick={() => handleAnchorChange("p2")}
          >
            P2 fixe
          </Button>
        </div>

        {/* Bouton valider */}
        <Button size="sm" className="w-full h-7" onClick={handleValidate}>
          <Check className="h-3 w-3 mr-1" />
          Appliquer
        </Button>
      </div>
    </div>
  );
}

export default LineLengthPanel;
