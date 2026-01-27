// ============================================
// COMPOSANT: ChamferPanel
// VERSION: 1.0
// Description: Panneau flottant pour les chanfreins
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import React from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ============================================
// TYPES
// ============================================

export interface ChamferCorner {
  pointId: string;
  maxDistance: number;
  maxDist1: number;
  maxDist2: number;
  angleDeg: number;
  distance: number;
  dist1: number;
  dist2: number;
  line1Id: string;
  line2Id: string;
}

export interface ChamferDialogState {
  open: boolean;
  corners: ChamferCorner[];
  globalDistance: number;
  hoveredCornerIdx: number | null;
  asymmetric: boolean;
  repeatMode: boolean;
}

export interface ChamferPanelProps {
  // Dialog state
  chamferDialog: ChamferDialogState;
  setChamferDialog: React.Dispatch<React.SetStateAction<ChamferDialogState | null>>;
  
  // Position et drag
  position: { x: number; y: number };
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  
  // Callbacks
  switchChamferToFillet: () => void;
  applyChamferFromDialog: () => void;
}

// ============================================
// COMPOSANT
// ============================================

export function ChamferPanel({
  chamferDialog,
  setChamferDialog,
  position,
  setPosition,
  switchChamferToFillet,
  applyChamferFromDialog,
}: ChamferPanelProps) {
  // État local pour le drag
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  const cornerCount = chamferDialog.corners.length;
  const allValid = chamferDialog.asymmetric
    ? chamferDialog.corners.every(
        (c) => c.dist1 > 0 && c.dist1 <= c.maxDist1 && c.dist2 > 0 && c.dist2 <= c.maxDist2,
      )
    : chamferDialog.corners.every((c) => c.distance > 0 && c.distance <= c.maxDistance);

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
      style={{
        left: position.x,
        top: position.y,
        width: chamferDialog.asymmetric ? 320 : 240,
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
      <div className="flex items-center justify-between px-3 py-2 bg-orange-50 rounded-t-lg cursor-move border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Chanfrein {cornerCount > 1 ? `(${cornerCount})` : ""}</span>
          <button
            className="text-xs px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
            onClick={switchChamferToFillet}
            title="Passer en congé"
          >
            → Congé
          </button>
        </div>
        <button className="text-gray-500 hover:text-gray-700" onClick={() => setChamferDialog(null)}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Options */}
      <div className="px-2 py-1.5 border-b flex items-center gap-3 text-[10px]">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={chamferDialog.asymmetric}
            onChange={(e) => setChamferDialog({ ...chamferDialog, asymmetric: e.target.checked })}
            className="h-3 w-3"
          />
          Asymétrique
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={chamferDialog.repeatMode}
            onChange={(e) => setChamferDialog({ ...chamferDialog, repeatMode: e.target.checked })}
            className="h-3 w-3"
          />
          Répéter
        </label>
      </div>

      {/* Contenu */}
      <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto">
        {/* Distance globale si plusieurs coins et mode symétrique */}
        {cornerCount > 1 && !chamferDialog.asymmetric && (
          <div className="flex items-center gap-2 pb-2 border-b">
            <span className="text-xs">Tous:</span>
            <Input
              type="number"
              value={chamferDialog.globalDistance}
              onChange={(e) => {
                const newDistance = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                setChamferDialog({
                  ...chamferDialog,
                  globalDistance: newDistance,
                  corners: chamferDialog.corners.map((c) => ({
                    ...c,
                    distance: Math.min(newDistance, c.maxDistance),
                    dist1: Math.min(newDistance, c.maxDist1),
                    dist2: Math.min(newDistance, c.maxDist2),
                  })),
                });
              }}
              className="h-7 w-16 text-xs"
              min="0.1"
              step="1"
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && allValid) applyChamferFromDialog();
              }}
            />
            <span className="text-xs text-gray-500">mm</span>
          </div>
        )}

        {/* Liste des coins */}
        {chamferDialog.corners.map((corner, idx) => {
          const isValid = chamferDialog.asymmetric
            ? corner.dist1 > 0 &&
              corner.dist1 <= corner.maxDist1 &&
              corner.dist2 > 0 &&
              corner.dist2 <= corner.maxDist2
            : corner.distance > 0 && corner.distance <= corner.maxDistance;
          const isHovered = chamferDialog.hoveredCornerIdx === idx;
          return (
            <div
              key={corner.pointId}
              className={`p-1.5 rounded text-xs transition-colors ${
                isHovered ? "bg-orange-100 ring-1 ring-orange-400" : "bg-gray-50 hover:bg-gray-100"
              }`}
              onMouseEnter={() => setChamferDialog({ ...chamferDialog, hoveredCornerIdx: idx })}
              onMouseLeave={() => setChamferDialog({ ...chamferDialog, hoveredCornerIdx: null })}
            >
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  <span className="font-medium">#{idx + 1}</span>
                  <span className="text-gray-500 ml-1">({corner.angleDeg.toFixed(0)}°)</span>
                </div>
                {chamferDialog.asymmetric ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      type="number"
                      value={corner.dist1}
                      onChange={(e) => {
                        const newDist = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                        const newCorners = [...chamferDialog.corners];
                        newCorners[idx] = { ...corner, dist1: newDist };
                        setChamferDialog({ ...chamferDialog, corners: newCorners });
                      }}
                      className={`h-6 w-16 text-xs ${corner.dist1 > corner.maxDist1 ? "border-red-500" : ""}`}
                      min="0.1"
                      step="1"
                      onKeyDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-gray-400">×</span>
                    <Input
                      type="number"
                      value={corner.dist2}
                      onChange={(e) => {
                        const newDist = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                        const newCorners = [...chamferDialog.corners];
                        newCorners[idx] = { ...corner, dist2: newDist };
                        setChamferDialog({ ...chamferDialog, corners: newCorners });
                      }}
                      className={`h-6 w-16 text-xs ${corner.dist2 > corner.maxDist2 ? "border-red-500" : ""}`}
                      min="0.1"
                      step="1"
                      onKeyDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-[10px] text-gray-400">mm</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-1 justify-end">
                    <Input
                      type="number"
                      value={corner.distance}
                      onChange={(e) => {
                        const newDistance = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                        const newCorners = [...chamferDialog.corners];
                        newCorners[idx] = {
                          ...corner,
                          distance: newDistance,
                          dist1: newDistance,
                          dist2: newDistance,
                        };
                        setChamferDialog({ ...chamferDialog, corners: newCorners });
                      }}
                      className={`h-6 w-14 text-xs ${!isValid ? "border-red-500" : ""}`}
                      min="0.1"
                      step="1"
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter" && allValid) applyChamferFromDialog();
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-[10px] text-gray-400">/{corner.maxDistance.toFixed(0)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-2 border-t">
        <Button size="sm" className="w-full h-7 text-xs" onClick={applyChamferFromDialog} disabled={!allValid}>
          <Check className="h-3 w-3 mr-1" />
          Appliquer
        </Button>
      </div>
    </div>
  );
}

export default ChamferPanel;
