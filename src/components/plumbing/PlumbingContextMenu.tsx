// ============================================
// COMPOSANT: PlumbingContextMenu
// Menu contextuel pour edges et nœuds
// VERSION: 1.0
// ============================================

import React from "react";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  Trash2,
  Ungroup,
  Group,
  Scissors,
  CircleDot,
  Cable,
} from "lucide-react";
import {
  ElectricalConnectorType,
  ELECTRICAL_CONNECTOR_LABELS,
  ELECTRICAL_CONNECTOR_COLORS,
  WaterType,
  WATER_TYPE_LABELS,
  WATER_COLORS,
} from "./types";

export type ContextMenuType = "edge" | "node" | "junction" | "grouped-edge" | "canvas";

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface PlumbingContextMenuProps {
  type: ContextMenuType;
  position: ContextMenuPosition;
  onClose: () => void;
  // Actions pour edges
  onAddDerivation?: (connectorType: ElectricalConnectorType | WaterType) => void;
  onDeleteEdge?: () => void;
  onGroupEdges?: () => void;
  onUngroupEdge?: () => void;
  // Actions pour jonctions
  onDeleteJunction?: () => void;
  // Infos contextuelles
  edgeType?: "electrical" | "water";
  availableConnectorTypes?: (ElectricalConnectorType | WaterType)[];
  canGroup?: boolean;
  isGrouped?: boolean;
}

export function PlumbingContextMenu({
  type,
  position,
  onClose,
  onAddDerivation,
  onDeleteEdge,
  onGroupEdges,
  onUngroupEdge,
  onDeleteJunction,
  edgeType,
  availableConnectorTypes = [],
  canGroup = false,
  isGrouped = false,
}: PlumbingContextMenuProps) {
  const [showDerivationSubmenu, setShowDerivationSubmenu] = React.useState(false);

  // Fermer le menu quand on clique ailleurs
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      onClose();
    };
    // Petit délai pour éviter de fermer immédiatement
    const timeout = setTimeout(() => {
      window.addEventListener("click", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [onClose]);

  // Fermer avec Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    position: "absolute",
    left: position.x,
    top: position.y,
    zIndex: 100,
    minWidth: "200px",
  };

  // Menu pour un edge (câble/tuyau)
  if (type === "edge") {
    return (
      <div
        style={menuStyle}
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ajouter dérivation */}
        <div className="relative">
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            onMouseEnter={() => setShowDerivationSubmenu(true)}
            onMouseLeave={() => setShowDerivationSubmenu(false)}
          >
            <GitBranch className="h-4 w-4" />
            Ajouter point de dérivation
            <span className="ml-auto text-slate-400">▶</span>
          </button>

          {/* Sous-menu types de connecteurs */}
          {showDerivationSubmenu && (
            <div
              className="absolute left-full top-0 ml-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[180px]"
              onMouseEnter={() => setShowDerivationSubmenu(true)}
              onMouseLeave={() => setShowDerivationSubmenu(false)}
            >
              {edgeType === "electrical" ? (
                <>
                  <div className="px-3 py-1 text-xs text-slate-500 font-medium">Type de fil</div>
                  {(Object.keys(ELECTRICAL_CONNECTOR_LABELS) as ElectricalConnectorType[]).map((connType) => (
                    <button
                      key={connType}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                      onClick={() => {
                        onAddDerivation?.(connType);
                        onClose();
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: ELECTRICAL_CONNECTOR_COLORS[connType] }}
                      />
                      {ELECTRICAL_CONNECTOR_LABELS[connType]}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <div className="px-3 py-1 text-xs text-slate-500 font-medium">Type d'eau</div>
                  {(Object.keys(WATER_TYPE_LABELS) as WaterType[]).map((waterType) => (
                    <button
                      key={waterType}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                      onClick={() => {
                        onAddDerivation?.(waterType);
                        onClose();
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: WATER_COLORS[waterType] }}
                      />
                      {WATER_TYPE_LABELS[waterType]}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Séparateur */}
        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

        {/* Regrouper (si plusieurs edges sélectionnés) */}
        {canGroup && (
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            onClick={() => {
              onGroupEdges?.();
              onClose();
            }}
          >
            <Group className="h-4 w-4" />
            Regrouper en câble
          </button>
        )}

        {/* Dégrouper (si edge groupé) */}
        {isGrouped && (
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            onClick={() => {
              onUngroupEdge?.();
              onClose();
            }}
          >
            <Ungroup className="h-4 w-4" />
            Dégrouper le câble
          </button>
        )}

        {/* Supprimer */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2"
          onClick={() => {
            onDeleteEdge?.();
            onClose();
          }}
        >
          <Trash2 className="h-4 w-4" />
          Supprimer
        </button>
      </div>
    );
  }

  // Menu pour une jonction
  if (type === "junction") {
    return (
      <div
        style={menuStyle}
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2"
          onClick={() => {
            onDeleteJunction?.();
            onClose();
          }}
        >
          <Trash2 className="h-4 w-4" />
          Supprimer la jonction
        </button>
      </div>
    );
  }

  // Menu pour edge groupé
  if (type === "grouped-edge") {
    return (
      <div
        style={menuStyle}
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          onClick={() => {
            onUngroupEdge?.();
            onClose();
          }}
        >
          <Ungroup className="h-4 w-4" />
          Dégrouper le câble
        </button>

        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2"
          onClick={() => {
            onDeleteEdge?.();
            onClose();
          }}
        >
          <Trash2 className="h-4 w-4" />
          Supprimer le câble
        </button>
      </div>
    );
  }

  return null;
}

export default PlumbingContextMenu;
