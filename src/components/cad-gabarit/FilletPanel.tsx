// ============================================
// COMPOSANT: FilletPanel
// VERSION: 1.0
// Description: Panneau flottant pour les congés (fillets)
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import React, { useCallback } from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Sketch, Line } from "./types";

// ============================================
// TYPES
// ============================================

export interface FilletCorner {
  pointId: string;
  maxRadius: number;
  angleDeg: number;
  radius: number;
  dist1: number;
  dist2: number;
  maxDist1: number;
  maxDist2: number;
  line1Id: string;
  line2Id: string;
}

export interface FilletDialogState {
  open: boolean;
  corners: FilletCorner[];
  globalRadius: number;
  minMaxRadius: number;
  hoveredCornerIdx: number | null;
  asymmetric: boolean;
  addDimension: boolean;
  repeatMode: boolean;
}

export interface FilletPanelProps {
  // Dialog state
  filletDialog: FilletDialogState;
  setFilletDialog: React.Dispatch<React.SetStateAction<FilletDialogState | null>>;
  
  // Position et drag
  position: { x: number; y: number };
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  
  // Sketch pour les opérations
  sketch: Sketch;
  setSketch: React.Dispatch<React.SetStateAction<Sketch>>;
  
  // Callbacks
  applyFilletToSketch: (inputSketch: Sketch, line1Id: string, line2Id: string, radius: number, silent?: boolean) => Sketch | null;
  addToHistory: (newSketch: Sketch, description?: string) => void;
  setFilletRadius: React.Dispatch<React.SetStateAction<number>>;
  setSelectedEntities: React.Dispatch<React.SetStateAction<Set<string>>>;
  switchFilletToChamfer: () => void;
  applyFilletFromDialog: () => void;
}

// ============================================
// COMPOSANT
// ============================================

export function FilletPanel({
  filletDialog,
  setFilletDialog,
  position,
  setPosition,
  sketch,
  setSketch,
  applyFilletToSketch,
  addToHistory,
  setFilletRadius,
  setSelectedEntities,
  switchFilletToChamfer,
  applyFilletFromDialog,
}: FilletPanelProps) {
  // État local pour le drag
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  const cornerCount = filletDialog.corners.length;
  const allValid = filletDialog.corners.every((c) => c.radius > 0 && c.radius <= c.maxRadius);

  // Appliquer les congés directement (pour Enter dans les inputs)
  const applyFilletsDirectly = useCallback((updatedCorners: FilletCorner[], updatedDialog: FilletDialogState) => {
    let currentSketch: Sketch = {
      ...sketch,
      points: new Map(sketch.points),
      geometries: new Map(sketch.geometries),
      layers: new Map(sketch.layers),
      constraints: new Map(sketch.constraints),
    };
    let successCount = 0;

    for (const corner of updatedCorners) {
      const connectedLines: Line[] = [];
      currentSketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const line = geo as Line;
          if (!line.isConstruction && (line.p1 === corner.pointId || line.p2 === corner.pointId)) {
            connectedLines.push(line);
          }
        }
      });

      if (connectedLines.length === 2 && corner.radius <= corner.maxRadius) {
        const radiusPx = corner.radius * sketch.scaleFactor;
        const newSketch = applyFilletToSketch(currentSketch, connectedLines[0].id, connectedLines[1].id, radiusPx, true);
        if (newSketch) {
          currentSketch = newSketch;
          successCount++;
        }
      }
    }

    if (successCount > 0) {
      setSketch(currentSketch);
      addToHistory(currentSketch);
      const radius = updatedCorners[0]?.radius || updatedDialog.globalRadius;
      toast.success(successCount === 1 ? `Congé R${radius}mm appliqué` : `${successCount} congés appliqués`);
    }

    setFilletRadius(updatedDialog.globalRadius);
    if (!updatedDialog.repeatMode) {
      setFilletDialog(null);
    }
    setSelectedEntities(new Set());
  }, [sketch, applyFilletToSketch, setSketch, addToHistory, setFilletRadius, setFilletDialog, setSelectedEntities]);

  // Handler pour le rayon global (tous les coins)
  const handleGlobalRadiusChange = useCallback((value: string, applyNow: boolean) => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0.1) return;

    const newRadius = parsed;
    const updatedCorners = filletDialog.corners.map((c) => ({
      ...c,
      radius: Math.min(newRadius, c.maxRadius),
      dist1: Math.min(newRadius, c.maxDist1),
      dist2: Math.min(newRadius, c.maxDist2),
    }));

    const updatedDialog = {
      ...filletDialog,
      globalRadius: newRadius,
      corners: updatedCorners,
    };
    setFilletDialog(updatedDialog);

    if (applyNow) {
      applyFilletsDirectly(updatedCorners, updatedDialog);
    }
  }, [filletDialog, setFilletDialog, applyFilletsDirectly]);

  // Handler pour un coin individuel
  const handleCornerRadiusChange = useCallback((idx: number, value: string, applyNow: boolean) => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0.1) return;

    const updatedCorners = [...filletDialog.corners];
    updatedCorners[idx] = { ...updatedCorners[idx], radius: parsed };

    const updatedDialog = { ...filletDialog, corners: updatedCorners };
    setFilletDialog(updatedDialog);

    if (applyNow) {
      applyFilletsDirectly(updatedCorners, updatedDialog);
    }
  }, [filletDialog, setFilletDialog, applyFilletsDirectly]);

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
      style={{
        left: position.x,
        top: position.y,
        width: 240,
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
      {/* Header avec switch */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-t-lg cursor-move border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Congé {cornerCount > 1 ? `(${cornerCount})` : ""}</span>
          <button
            className="text-xs px-1.5 py-0.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded"
            onClick={switchFilletToChamfer}
            title="Passer en chanfrein"
          >
            → Chanfrein
          </button>
        </div>
        <button className="text-gray-500 hover:text-gray-700" onClick={() => setFilletDialog(null)}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Options */}
      <div className="px-2 py-1.5 border-b flex items-center gap-3 text-[10px]">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={filletDialog.addDimension}
            onChange={(e) => setFilletDialog({ ...filletDialog, addDimension: e.target.checked })}
            className="h-3 w-3"
          />
          Cotation
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={filletDialog.repeatMode}
            onChange={(e) => setFilletDialog({ ...filletDialog, repeatMode: e.target.checked })}
            className="h-3 w-3"
          />
          Répéter
        </label>
      </div>

      {/* Contenu */}
      <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto">
        {/* Rayon global si plusieurs coins */}
        {cornerCount > 1 && (
          <div className="flex items-center gap-2 pb-2 border-b">
            <span className="text-xs">Tous:</span>
            <Input
              type="number"
              key={`global-${filletDialog.globalRadius}`}
              defaultValue={filletDialog.globalRadius}
              autoFocus
              onFocus={(e) => e.target.select()}
              onBlur={(e) => handleGlobalRadiusChange(e.target.value, false)}
              className="h-7 w-16 text-xs"
              min="0.1"
              step="1"
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  handleGlobalRadiusChange((e.target as HTMLInputElement).value, true);
                }
              }}
            />
            <span className="text-xs text-gray-500">mm</span>
          </div>
        )}

        {/* Liste des coins */}
        {filletDialog.corners.map((corner, idx) => {
          const isValid = corner.radius > 0 && corner.radius <= corner.maxRadius;
          const isHovered = filletDialog.hoveredCornerIdx === idx;
          return (
            <div
              key={corner.pointId}
              className={`p-1.5 rounded text-xs transition-colors ${
                isHovered ? "bg-blue-100 ring-1 ring-blue-400" : "bg-gray-50 hover:bg-gray-100"
              }`}
              onMouseEnter={() => setFilletDialog({ ...filletDialog, hoveredCornerIdx: idx })}
              onMouseLeave={() => setFilletDialog({ ...filletDialog, hoveredCornerIdx: null })}
            >
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  <span className="font-medium">#{idx + 1}</span>
                  <span className="text-gray-500 ml-1">({corner.angleDeg.toFixed(0)}°)</span>
                </div>
                <div className="flex items-center gap-1 flex-1 justify-end">
                  <Input
                    type="number"
                    key={`corner-${idx}-${corner.radius}`}
                    defaultValue={corner.radius}
                    autoFocus={cornerCount === 1 && idx === 0}
                    onFocus={(e) => e.target.select()}
                    onBlur={(e) => handleCornerRadiusChange(idx, e.target.value, false)}
                    className={`h-6 w-14 text-xs ${!isValid ? "border-red-500" : ""}`}
                    min="0.1"
                    step="1"
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        handleCornerRadiusChange(idx, (e.target as HTMLInputElement).value, true);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-[10px] text-gray-400">/{corner.maxRadius.toFixed(0)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-2 border-t">
        <Button size="sm" className="w-full h-7 text-xs" onClick={applyFilletFromDialog} disabled={!allValid}>
          <Check className="h-3 w-3 mr-1" />
          Appliquer
        </Button>
      </div>
    </div>
  );
}

export default FilletPanel;
