// ============================================
// COMPOSANT: HistorySidebar
// VERSION: 1.0
// Description: Sidebar de gestion de l'historique et des branches
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import React from "react";
import { 
  X, 
  History, 
  GitBranch, 
  Plus, 
  Layers, 
  SplitSquareVertical, 
  Clock, 
  Scissors,
  Trash2 as TrashIcon 
} from "lucide-react";

// ============================================
// TYPES
// ============================================

export interface HistoryEntry {
  timestamp: number;
  description: string;
  sketch: unknown;
}

export interface Branch {
  id: string;
  name: string;
  color: string;
  history: HistoryEntry[];
}

export interface HistorySidebarProps {
  // Visibility
  showHistoryPanel: boolean;
  setShowHistoryPanel: React.Dispatch<React.SetStateAction<boolean>>;
  
  // History data
  history: HistoryEntry[];
  historyIndex: number;
  goToHistoryIndex: (index: number) => void;
  previewHistoryIndex: number | null;
  previewHistoryEntry: (index: number | null) => void;
  truncateHistoryAtIndex: (index: number) => void;
  
  // Branches
  branches: Branch[];
  activeBranchId: string;
  switchToBranch: (branchId: string) => void;
  createBranchFromHistoryIndex: (index: number) => void;
  deleteBranch: (branchId: string) => void;
  
  // Comparison mode
  comparisonMode: boolean;
  setComparisonMode: React.Dispatch<React.SetStateAction<boolean>>;
  comparisonStyle: "overlay" | "reveal";
  setComparisonStyle: React.Dispatch<React.SetStateAction<"overlay" | "reveal">>;
  setShowComparisonModal: React.Dispatch<React.SetStateAction<boolean>>;
  setVisibleBranches: React.Dispatch<React.SetStateAction<Set<string>>>;
  setRevealBranchId: React.Dispatch<React.SetStateAction<string | null>>;
  setShowOverviewModal: React.Dispatch<React.SetStateAction<boolean>>;
}

// ============================================
// COMPOSANT
// ============================================

export function HistorySidebar({
  showHistoryPanel,
  setShowHistoryPanel,
  history,
  historyIndex,
  goToHistoryIndex,
  previewHistoryIndex,
  previewHistoryEntry,
  truncateHistoryAtIndex,
  branches,
  activeBranchId,
  switchToBranch,
  createBranchFromHistoryIndex,
  deleteBranch,
  comparisonMode,
  setComparisonMode,
  comparisonStyle,
  setComparisonStyle,
  setShowComparisonModal,
  setVisibleBranches,
  setRevealBranchId,
  setShowOverviewModal,
}: HistorySidebarProps) {
  const activeBranch = branches.find((b) => b.id === activeBranchId);

  return (
    <div
      className={`fixed inset-0 z-[100] pointer-events-none transition-opacity duration-150 ${
        showHistoryPanel ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{ visibility: showHistoryPanel ? "visible" : "hidden" }}
    >
      <div
        className={`absolute right-0 top-[88px] bottom-0 w-72 flex flex-col transition-transform duration-150 ${
          showHistoryPanel ? "translate-x-0 pointer-events-auto" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-l rounded-tl-lg shadow-sm">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium">Historique</span>
          </div>
          <button
            className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded"
            onClick={() => {
              setShowHistoryPanel(false);
              setComparisonMode(false);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Barre d'outils branches */}
        <div className="px-2 py-2 bg-gray-50 border-l border-b space-y-2">
          {/* Sélecteur de branche active */}
          <div className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-gray-500" />
            <select
              className="flex-1 text-xs border rounded px-2 py-1 bg-white"
              value={activeBranchId}
              onChange={(e) => switchToBranch(e.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.history.length})
                </option>
              ))}
            </select>
            <button
              className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-green-600"
              title="Nouvelle branche depuis l'état actuel"
              onClick={() => createBranchFromHistoryIndex(historyIndex)}
              disabled={branches.length >= 10}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Boutons rapides */}
          <div className="flex items-center gap-1">
            <button
              className={`flex-1 px-2 py-1 text-xs rounded flex items-center justify-center gap-1 ${
                comparisonMode && comparisonStyle === "overlay"
                  ? "bg-blue-500 text-white"
                  : "bg-white border hover:bg-gray-100"
              }`}
              onClick={() => {
                if (branches.length > 1) {
                  setComparisonMode(true);
                  setComparisonStyle("overlay");
                  setVisibleBranches(new Set(branches.map((b) => b.id)));
                  setShowComparisonModal(true);
                }
              }}
              disabled={branches.length <= 1}
              title="Mode superposition"
            >
              <Layers className="h-3 w-3" />
            </button>
            <button
              className={`flex-1 px-2 py-1 text-xs rounded flex items-center justify-center gap-1 ${
                comparisonMode && comparisonStyle === "reveal"
                  ? "bg-blue-500 text-white"
                  : "bg-white border hover:bg-gray-100"
              }`}
              onClick={() => {
                if (branches.length > 1) {
                  setComparisonMode(true);
                  setComparisonStyle("reveal");
                  const otherBranch = branches.find((b) => b.id !== activeBranchId);
                  if (otherBranch) setRevealBranchId(otherBranch.id);
                  setShowComparisonModal(true);
                }
              }}
              disabled={branches.length <= 1}
              title="Mode rideau"
            >
              <SplitSquareVertical className="h-3 w-3" />
            </button>
            <button
              className="flex-1 px-2 py-1 text-xs rounded bg-white border hover:bg-gray-100 flex items-center justify-center gap-1"
              onClick={() => setShowOverviewModal(true)}
              title="Vue d'ensemble"
            >
              <GitBranch className="h-3 w-3" />
            </button>
            {comparisonMode && (
              <button
                className="px-2 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                onClick={() => setComparisonMode(false)}
                title="Désactiver comparaison"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Info branche active */}
        {activeBranch && (
          <div className="px-2 py-1.5 bg-white border-l border-b flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activeBranch.color }} />
            <span className="font-medium truncate">{activeBranch.name}</span>
            <span className="text-gray-400">({activeBranch.history.length} états)</span>
            {branches.length > 1 && (
              <button
                className="ml-auto p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                title="Supprimer cette branche"
                onClick={() => deleteBranch(activeBranchId)}
              >
                <TrashIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Liste historique */}
        <div className="flex-1 overflow-y-auto border-l bg-transparent">
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 italic p-3 bg-white/80">Aucun historique</p>
          ) : (
            <div className="space-y-1 p-1">
              {[...history].reverse().map((entry, reverseIdx) => {
                const idx = history.length - 1 - reverseIdx;
                const isActive = idx === historyIndex;
                const isPreviewing = idx === previewHistoryIndex;
                const isFuture = idx > historyIndex;
                const date = new Date(entry.timestamp);
                const timeStr = date.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
                const branchColor = activeBranch?.color || "#3B82F6";

                return (
                  <div
                    key={idx}
                    className={`
                      px-2 py-1.5 cursor-pointer transition-all text-xs rounded
                      ${
                        isActive
                          ? "text-white shadow-md"
                          : isPreviewing
                            ? "bg-yellow-400 text-gray-900 shadow-md"
                            : isFuture
                              ? "bg-white/60 text-gray-400"
                              : "bg-white/90 hover:bg-white hover:shadow-sm text-gray-700"
                      }
                    `}
                    style={isActive ? { backgroundColor: branchColor } : undefined}
                    onClick={() => goToHistoryIndex(idx)}
                    onMouseEnter={() => {
                      if (idx !== historyIndex) {
                        previewHistoryEntry(idx);
                      }
                    }}
                    onMouseLeave={() => {
                      if (previewHistoryIndex !== null) {
                        previewHistoryEntry(null);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-medium truncate ${isActive ? "text-white" : ""}`}>
                        {entry.description}
                      </span>
                      <span className={`text-[10px] ml-1 ${isActive ? "opacity-70" : "text-gray-400"}`}>
                        #{idx + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className={`h-2.5 w-2.5 ${isActive ? "opacity-70" : "text-gray-400"}`} />
                      <span className={`text-[10px] ${isActive ? "opacity-70" : "text-gray-400"}`}>{timeStr}</span>
                      {isActive && <span className="text-[10px] opacity-80">● actuel</span>}
                      {isPreviewing && <span className="text-[10px] text-gray-900">● aperçu</span>}

                      {/* Boutons d'action */}
                      {idx < history.length - 1 && (
                        <div className="ml-auto flex items-center gap-0.5">
                          <button
                            className={`p-0.5 rounded transition-colors ${
                              isActive
                                ? "opacity-70 hover:opacity-100 hover:bg-white/20"
                                : isPreviewing
                                  ? "text-yellow-700 hover:text-green-700 hover:bg-yellow-300"
                                  : "text-gray-400 hover:text-green-600 hover:bg-green-100"
                            }`}
                            title="Créer une branche ici"
                            onClick={(e) => {
                              e.stopPropagation();
                              createBranchFromHistoryIndex(idx);
                            }}
                            disabled={branches.length >= 10}
                          >
                            <GitBranch className="h-3 w-3" />
                          </button>
                          <button
                            className={`p-0.5 rounded transition-colors ${
                              isActive
                                ? "opacity-70 hover:opacity-100 hover:bg-white/20"
                                : isPreviewing
                                  ? "text-yellow-700 hover:text-red-700 hover:bg-yellow-300"
                                  : "text-gray-400 hover:text-red-600 hover:bg-red-100"
                            }`}
                            title="Tronquer l'historique ici"
                            onClick={(e) => {
                              e.stopPropagation();
                              truncateHistoryAtIndex(idx);
                            }}
                          >
                            <Scissors className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer légende */}
        <div className="px-2 py-1.5 bg-white border-l border-t rounded-bl-lg text-[10px] text-gray-500 flex flex-col gap-0.5">
          <span>👆 Survoler = aperçu | Cliquer = revenir</span>
          <span>🔀 Branche | ✂️ Tronquer</span>
        </div>
      </div>
    </div>
  );
}

export default HistorySidebar;
