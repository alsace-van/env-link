// ============================================
// COMPOSANT: OffsetPanel
// VERSION: 1.0
// Description: Panneau flottant pour l'offset de géométries
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import React from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ============================================
// TYPES
// ============================================

export interface OffsetDialogState {
  open: boolean;
  selectedEntities: Set<string>;
}

export interface OffsetPanelProps {
  // Dialog state
  offsetDialog: OffsetDialogState;
  setOffsetDialog: React.Dispatch<React.SetStateAction<OffsetDialogState | null>>;
  
  // Position et drag
  position: { x: number; y: number };
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  
  // Valeurs
  offsetDistance: number;
  setOffsetDistance: React.Dispatch<React.SetStateAction<number>>;
  offsetDirection: "outside" | "inside";
  setOffsetDirection: React.Dispatch<React.SetStateAction<"outside" | "inside">>;
  
  // Callbacks
  applyOffsetToSelection: () => void;
  setOffsetPreview: React.Dispatch<React.SetStateAction<any[]>>;
  setActiveTool: React.Dispatch<React.SetStateAction<any>>;
}

// ============================================
// COMPOSANT
// ============================================

export function OffsetPanel({
  offsetDialog,
  setOffsetDialog,
  position,
  setPosition,
  offsetDistance,
  setOffsetDistance,
  offsetDirection,
  setOffsetDirection,
  applyOffsetToSelection,
  setOffsetPreview,
  setActiveTool,
}: OffsetPanelProps) {
  // État local pour le drag
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  const handleClose = () => {
    setOffsetDialog(null);
    setOffsetPreview([]);
    setActiveTool("select");
  };

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
      style={{
        left: position.x,
        top: position.y,
        width: 200,
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
      {/* Header draggable */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 rounded-t-lg cursor-move border-b">
        <span className="text-sm font-medium">Offset</span>
        <button className="text-gray-500 hover:text-gray-700" onClick={handleClose}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Contenu */}
      <div className="p-3 space-y-3">
        {/* Distance + Direction sur une ligne */}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={offsetDistance}
            onChange={(e) => setOffsetDistance(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
            className="h-8 w-20 text-sm"
            min="0.1"
            step="1"
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && offsetDialog.selectedEntities.size > 0) {
                applyOffsetToSelection();
              }
            }}
          />
          <span className="text-xs text-gray-500">mm</span>

          {/* Toggle direction avec flèches */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-1.5 ml-auto"
            onClick={() => setOffsetDirection(offsetDirection === "outside" ? "inside" : "outside")}
            title={offsetDirection === "outside" ? "Extérieur" : "Intérieur"}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {offsetDirection === "outside" ? (
                <>
                  <path d="M7 12 L4 12 M4 9 L4 15" strokeLinecap="round" />
                  <path d="M4 12 L1 9 M4 12 L1 15" strokeLinecap="round" />
                  <path d="M17 12 L20 12 M20 9 L20 15" strokeLinecap="round" />
                  <path d="M20 12 L23 9 M20 12 L23 15" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <path d="M1 12 L4 12 M4 9 L4 15" strokeLinecap="round" />
                  <path d="M4 12 L7 9 M4 12 L7 15" strokeLinecap="round" />
                  <path d="M23 12 L20 12 M20 9 L20 15" strokeLinecap="round" />
                  <path d="M20 12 L17 9 M20 12 L17 15" strokeLinecap="round" />
                </>
              )}
            </svg>
          </Button>
        </div>

        {/* Compteur sélection */}
        <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
          {offsetDialog.selectedEntities.size} sélectionné(s)
        </div>

        {/* Bouton valider */}
        <Button
          size="sm"
          className="w-full h-8"
          onClick={applyOffsetToSelection}
          disabled={offsetDialog.selectedEntities.size === 0}
        >
          <Check className="h-3 w-3 mr-1" />
          Valider
        </Button>
      </div>
    </div>
  );
}

export default OffsetPanel;
