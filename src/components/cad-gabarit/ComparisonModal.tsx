// ============================================
// COMPOSANT: ComparisonModal
// VERSION: 1.0
// Description: Modale flottante de paramétrage de comparaison de branches
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import React from "react";
import { X, Layers, SplitSquareVertical } from "lucide-react";

// ============================================
// TYPES
// ============================================

export interface Branch {
  id: string;
  name: string;
  color: string;
  history: unknown[];
}

export interface ComparisonModalProps {
  // Visibility
  showComparisonModal: boolean;
  setShowComparisonModal: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Position
  position: { x: number; y: number };
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  
  // Comparison settings
  comparisonStyle: "overlay" | "reveal";
  setComparisonStyle: React.Dispatch<React.SetStateAction<"overlay" | "reveal">>;
  comparisonOpacity: number;
  setComparisonOpacity: React.Dispatch<React.SetStateAction<number>>;
  setComparisonMode: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Branches
  branches: Branch[];
  activeBranchId: string;
  activeBranchColor: string;
  visibleBranches: Set<string>;
  setVisibleBranches: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleBranchVisibility: (branchId: string) => void;
  
  // Reveal mode
  revealBranchId: string | null;
  setRevealBranchId: React.Dispatch<React.SetStateAction<string | null>>;
  revealBranchData: Branch | null;
  revealPosition: number;
  setRevealPosition: React.Dispatch<React.SetStateAction<number>>;
}

// ============================================
// COMPOSANT
// ============================================

export function ComparisonModal({
  showComparisonModal,
  setShowComparisonModal,
  position,
  setPosition,
  comparisonStyle,
  setComparisonStyle,
  comparisonOpacity,
  setComparisonOpacity,
  setComparisonMode,
  branches,
  activeBranchId,
  activeBranchColor,
  visibleBranches,
  setVisibleBranches,
  toggleBranchVisibility,
  revealBranchId,
  setRevealBranchId,
  revealBranchData,
  revealPosition,
  setRevealPosition,
}: ComparisonModalProps) {
  if (!showComparisonModal) return null;

  return (
    <div
      className="fixed z-[200] bg-white rounded-lg shadow-xl border"
      style={{
        left: position.x,
        top: position.y,
        width: 280,
      }}
    >
      {/* Header draggable */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg cursor-move select-none"
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          const startX = e.clientX - position.x;
          const startY = e.clientY - position.y;

          const handleMouseMove = (moveEvent: MouseEvent) => {
            setPosition({
              x: Math.max(0, Math.min(moveEvent.clientX - startX, window.innerWidth - 280)),
              y: Math.max(0, Math.min(moveEvent.clientY - startY, window.innerHeight - 200)),
            });
          };

          const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
          };

          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        }}
      >
        <div className="flex items-center gap-2">
          {comparisonStyle === "overlay" ? (
            <Layers className="h-3.5 w-3.5" />
          ) : (
            <SplitSquareVertical className="h-3.5 w-3.5" />
          )}
          <span className="font-medium text-sm">
            {comparisonStyle === "overlay" ? "Superposition" : "Rideau"}
          </span>
        </div>
        <button className="p-1 hover:bg-white/20 rounded" onClick={() => setShowComparisonModal(false)}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Contenu */}
      <div className="p-3 space-y-3">
        {/* Toggle mode */}
        <div className="flex gap-1">
          <button
            className={`flex-1 px-2 py-1.5 text-xs rounded flex items-center justify-center gap-1 ${
              comparisonStyle === "overlay" ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
            onClick={() => {
              setComparisonStyle("overlay");
              setVisibleBranches(new Set(branches.map((b) => b.id)));
            }}
          >
            <Layers className="h-3.5 w-3.5" />
            Superpos.
          </button>
          <button
            className={`flex-1 px-2 py-1.5 text-xs rounded flex items-center justify-center gap-1 ${
              comparisonStyle === "reveal" ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
            onClick={() => {
              setComparisonStyle("reveal");
              const otherBranch = branches.find((b) => b.id !== activeBranchId);
              if (otherBranch) setRevealBranchId(otherBranch.id);
            }}
          >
            <SplitSquareVertical className="h-3.5 w-3.5" />
            Rideau
          </button>
        </div>

        {/* Options Superposition */}
        {comparisonStyle === "overlay" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-14">Opacité</span>
              <input
                type="range"
                min="10"
                max="100"
                value={comparisonOpacity}
                onChange={(e) => setComparisonOpacity(parseInt(e.target.value))}
                className="flex-1 h-1.5"
              />
              <span className="text-xs w-10 text-right">{comparisonOpacity}%</span>
            </div>

            <div className="border rounded p-2 space-y-1 max-h-32 overflow-y-auto bg-gray-50">
              {branches.map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleBranches.has(branch.id)}
                    onChange={() => toggleBranchVisibility(branch.id)}
                    disabled={branch.id === activeBranchId}
                    className="rounded w-3 h-3"
                  />
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: branch.color }} />
                  <span className={`truncate ${branch.id === activeBranchId ? "font-medium" : ""}`}>
                    {branch.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Options Rideau */}
        {comparisonStyle === "reveal" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-14">Branche</span>
              <select
                className="flex-1 text-xs border rounded px-2 py-1 bg-white"
                value={revealBranchId || ""}
                onChange={(e) => setRevealBranchId(e.target.value)}
              >
                {branches
                  .filter((b) => b.id !== activeBranchId)
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs py-1 bg-gray-50 rounded">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activeBranchColor }} />
                <span>◀</span>
              </div>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-1">
                <span>▶</span>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: revealBranchData?.color || "#888" }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-14">Position</span>
              <input
                type="range"
                min="0"
                max="100"
                value={revealPosition}
                onChange={(e) => setRevealPosition(parseInt(e.target.value))}
                className="flex-1 h-1.5"
              />
              <span className="text-xs w-10 text-right">{Math.round(revealPosition)}%</span>
            </div>
          </div>
        )}

        {/* Bouton désactiver */}
        <button
          className="w-full px-3 py-1.5 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-600"
          onClick={() => {
            setComparisonMode(false);
            setShowComparisonModal(false);
          }}
        >
          Désactiver la comparaison
        </button>
      </div>
    </div>
  );
}

export default ComparisonModal;
