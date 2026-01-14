// ============================================
// COMPOSANT: CADToolbar
// Wrapper pour la toolbar CAD avec configuration drag & drop
// VERSION: 1.0 - Création initiale
// ============================================

import React, { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Settings, GripVertical } from "lucide-react";

import { useToolbarConfig, ResolvedToolbarItem } from "./useToolbarConfig";
import { ToolbarEditor } from "./ToolbarEditor";
import { ToolbarConfig } from "./toolbar-types";

// ============================================
// TYPES
// ============================================

// Mapping des IDs d'outils vers les clés de l'ancien système
// Permet la rétrocompatibilité
export const TOOL_ID_TO_OLD_KEY: Record<string, { line: "line1" | "line2"; key: string }> = {
  // Ligne 1
  save: { line: "line1", key: "save" },
  import: { line: "line1", key: "import" },
  photos: { line: "line1", key: "photos" },
  exportSvg: { line: "line1", key: "exportSvg" },
  exportPng: { line: "line1", key: "exportPng" },
  exportDxf: { line: "line1", key: "exportDxf" },
  exportPdf: { line: "line1", key: "exportPdf" },
  templates: { line: "line1", key: "templates" },
  help: { line: "line1", key: "help" },
  // Ligne 2 - Groupes
  select: { line: "line2", key: "selectPan" },
  pan: { line: "line2", key: "selectPan" },
  mirror: { line: "line2", key: "transform" },
  moveRotate: { line: "line2", key: "transform" },
  line: { line: "line2", key: "drawBasic" },
  circle: { line: "line2", key: "drawBasic" },
  arc3points: { line: "line2", key: "drawBasic" },
  rectangle: { line: "line2", key: "drawBasic" },
  bezier: { line: "line2", key: "drawBasic" },
  spline: { line: "line2", key: "drawBasic" },
  polygon: { line: "line2", key: "drawBasic" },
  text: { line: "line2", key: "drawBasic" },
  fillet: { line: "line2", key: "modifications" },
  chamfer: { line: "line2", key: "modifications" },
  offset: { line: "line2", key: "modifications" },
  trim: { line: "line2", key: "modifications" },
  extend: { line: "line2", key: "modifications" },
  showBackground: { line: "line2", key: "photoTools" },
  imageOpacity: { line: "line2", key: "photoTools" },
  addMarker: { line: "line2", key: "photoTools" },
  linkMarkers: { line: "line2", key: "photoTools" },
  calibrate: { line: "line2", key: "photoTools" },
  imageAdjustments: { line: "line2", key: "photoTools" },
  dimension: { line: "line2", key: "dimensions" },
  constraint: { line: "line2", key: "dimensions" },
  measure: { line: "line2", key: "dimensions" },
  zoomIn: { line: "line2", key: "viewControls" },
  zoomOut: { line: "line2", key: "viewControls" },
  zoomFit: { line: "line2", key: "viewControls" },
  zoomReset: { line: "line2", key: "viewControls" },
  toggleGrid: { line: "line2", key: "viewControls" },
  toggleSnap: { line: "line2", key: "viewControls" },
  undo: { line: "line2", key: "history" },
  redo: { line: "line2", key: "history" },
  branchSelect: { line: "line2", key: "branches" },
  branchCreate: { line: "line2", key: "branches" },
};

// Props pour CADToolbar
export interface CADToolbarProps {
  // Ligne à afficher (1 ou 2)
  line: 1 | 2;

  // Fonction de rendu pour chaque groupe de l'ancien système
  // La clé est l'ancien nom du groupe (ex: "save", "selectPan", etc.)
  renderGroup: (groupKey: string) => React.ReactNode;

  // Contenu additionnel à droite de la toolbar
  rightContent?: React.ReactNode;

  // Classes CSS additionnelles
  className?: string;
}

// ============================================
// HOOK POUR GÉRER LA VISIBILITÉ
// ============================================

export function useToolbarVisibility() {
  const {
    config,
    toolDefinitions,
    line1Tools,
    line2Tools,
    isEditorOpen,
    setEditorOpen,
    updateConfig,
    resetConfig,
    isToolVisible,
  } = useToolbarConfig();

  // Convertir la nouvelle config vers l'ancien format booléen
  // pour compatibilité avec le rendu existant de CADGabaritCanvas
  const oldStyleConfig = useMemo(() => {
    const result: {
      line1: { [key: string]: boolean };
      line2: { [key: string]: boolean };
    } = {
      line1: {
        save: false,
        import: false,
        photos: false,
        exportSvg: false,
        exportPng: false,
        exportDxf: false,
        exportPdf: false,
        templates: false,
        help: false,
      },
      line2: {
        selectPan: false,
        transform: false,
        drawBasic: false,
        drawAdvanced: false,
        modifications: false,
        photoTools: false,
        dimensions: false,
        viewControls: false,
        history: false,
        branches: false,
      },
    };

    // Marquer comme visible si au moins un outil du groupe est visible
    Object.entries(TOOL_ID_TO_OLD_KEY).forEach(([toolId, { line, key }]) => {
      if (isToolVisible(toolId)) {
        result[line][key] = true;
      }
    });

    return result;
  }, [isToolVisible]);

  // Fonction pour vérifier si un groupe de l'ancien système est visible
  const isOldGroupVisible = useCallback(
    (line: "line1" | "line2", groupKey: string): boolean => {
      return oldStyleConfig[line][groupKey] ?? false;
    },
    [oldStyleConfig]
  );

  return {
    config,
    toolDefinitions,
    line1Tools,
    line2Tools,
    isEditorOpen,
    setEditorOpen,
    updateConfig,
    resetConfig,
    isToolVisible,
    isOldGroupVisible,
    oldStyleConfig,
  };
}

// ============================================
// COMPOSANT: ToolbarConfigButton
// Bouton pour ouvrir l'éditeur de configuration
// ============================================

interface ToolbarConfigButtonProps {
  onClick: () => void;
  className?: string;
}

export function ToolbarConfigButton({ onClick, className = "" }: ToolbarConfigButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            className={`h-8 w-8 p-0 ${className}`}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Configurer la toolbar (drag & drop)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================
// COMPOSANT: ToolbarEditorWrapper
// Wrapper pour l'éditeur qui gère son état
// ============================================

interface ToolbarEditorWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  config: ToolbarConfig;
  onConfigChange: (config: ToolbarConfig) => void;
  toolDefinitions: Map<string, import("./toolbar-types").ToolDefinition>;
}

export function ToolbarEditorWrapper({
  isOpen,
  onClose,
  config,
  onConfigChange,
  toolDefinitions,
}: ToolbarEditorWrapperProps) {
  if (!isOpen) return null;

  return (
    <ToolbarEditor
      isOpen={isOpen}
      onClose={onClose}
      config={config}
      onConfigChange={onConfigChange}
      toolDefinitions={toolDefinitions}
    />
  );
}

// ============================================
// EXPORT PAR DÉFAUT
// ============================================

export default {
  useToolbarVisibility,
  ToolbarConfigButton,
  ToolbarEditorWrapper,
  TOOL_ID_TO_OLD_KEY,
};
