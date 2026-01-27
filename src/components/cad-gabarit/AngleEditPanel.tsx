// ============================================
// COMPOSANT: AngleEditPanel
// VERSION: 1.0
// Description: Panneau flottant pour modifier l'angle entre deux lignes
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

export interface AngleEditDialogState {
  open: boolean;
  pointId: string;
  line1Id: string;
  line2Id: string;
  currentAngle: number;
  newAngle: string;
  anchorMode: "line1" | "line2" | "symmetric";
  originalSketch: Sketch | null;
}

export interface AngleEditPanelProps {
  // Dialog state
  angleEditDialog: AngleEditDialogState;
  setAngleEditDialog: React.Dispatch<React.SetStateAction<AngleEditDialogState | null>>;
  
  // Position
  position: { x: number; y: number };
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  
  // Sketch
  setSketch: React.Dispatch<React.SetStateAction<Sketch>>;
  sketchRef: React.MutableRefObject<Sketch>;
  
  // Callbacks
  applyAngleChange: (
    pointId: string,
    line1Id: string,
    line2Id: string,
    newAngle: number,
    anchorMode: "line1" | "line2" | "symmetric",
    addHistory: boolean
  ) => void;
  addToHistory: (sketch: Sketch, description?: string) => void;
}

// ============================================
// COMPOSANT
// ============================================

export function AngleEditPanel({
  angleEditDialog,
  setAngleEditDialog,
  position,
  setPosition,
  setSketch,
  sketchRef,
  applyAngleChange,
  addToHistory,
}: AngleEditPanelProps) {
  // État local pour le drag
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  const handleClose = () => {
    if (angleEditDialog.originalSketch) {
      setSketch(angleEditDialog.originalSketch);
    }
    setAngleEditDialog(null);
  };

  const handleValidate = () => {
    const value = parseFloat(angleEditDialog.newAngle);
    if (!isNaN(value) && value > 0 && value < 180) {
      addToHistory(sketchRef.current);
      toast.success(`Angle modifié: ${value.toFixed(1)}°`);
      setAngleEditDialog(null);
    }
  };

  const handleAnchorChange = (newMode: "line1" | "line2" | "symmetric") => {
    const value = parseFloat(angleEditDialog.newAngle);
    if (angleEditDialog.originalSketch) {
      setSketch(angleEditDialog.originalSketch);
      if (!isNaN(value) && value > 0 && value < 180) {
        setTimeout(() => {
          applyAngleChange(
            angleEditDialog.pointId,
            angleEditDialog.line1Id,
            angleEditDialog.line2Id,
            value,
            newMode,
            false
          );
        }, 0);
      }
    }
    setAngleEditDialog({ ...angleEditDialog, anchorMode: newMode });
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
      <div className="flex items-center justify-between px-3 py-1.5 bg-orange-500 text-white rounded-t-lg cursor-move">
        <span className="text-sm font-medium">📐 Angle</span>
        <button onClick={handleClose}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Contenu */}
      <div className="p-2 space-y-2">
        {/* Angle actuel */}
        <div className="text-xs text-gray-500">Actuel: {angleEditDialog.currentAngle.toFixed(1)}°</div>

        {/* Input nouvel angle */}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={angleEditDialog.newAngle}
            onChange={(e) => {
              const newValue = e.target.value;
              const value = parseFloat(newValue);
              if (!isNaN(value) && value > 0 && value < 180) {
                applyAngleChange(
                  angleEditDialog.pointId,
                  angleEditDialog.line1Id,
                  angleEditDialog.line2Id,
                  value,
                  angleEditDialog.anchorMode,
                  false
                );
              }
              setAngleEditDialog({ ...angleEditDialog, newAngle: newValue });
            }}
            className="h-8 flex-1 text-sm"
            min="1"
            max="179"
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
          <span className="text-xs text-gray-500">°</span>
        </div>

        {/* Boutons S1 / Sym / S2 */}
        <div className="flex gap-1">
          <Button
            variant={angleEditDialog.anchorMode === "line1" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-7 text-xs px-1"
            style={
              angleEditDialog.anchorMode === "line1"
                ? { backgroundColor: "#10B981", borderColor: "#10B981" }
                : { borderColor: "#10B981", color: "#10B981" }
            }
            onClick={() => handleAnchorChange("line1")}
          >
            S1 fixe
          </Button>
          <Button
            variant={angleEditDialog.anchorMode === "symmetric" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-7 text-xs px-1"
            onClick={() => handleAnchorChange("symmetric")}
          >
            Sym
          </Button>
          <Button
            variant={angleEditDialog.anchorMode === "line2" ? "default" : "outline"}
            size="sm"
            className="flex-1 h-7 text-xs px-1"
            style={
              angleEditDialog.anchorMode === "line2"
                ? { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" }
                : { borderColor: "#8B5CF6", color: "#8B5CF6" }
            }
            onClick={() => handleAnchorChange("line2")}
          >
            S2 fixe
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

export default AngleEditPanel;
