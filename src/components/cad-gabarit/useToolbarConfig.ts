// ============================================
// HOOK: useToolbarConfig
// Gestion de la configuration de la toolbar
// VERSION: 1.0 - Création initiale
// ============================================

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ToolbarConfig,
  ToolbarItem,
  ToolbarGroup,
  ToolDefinition,
  TOOLBAR_CONFIG_KEY,
  isValidToolbarConfig,
} from "./toolbar-types";
import {
  DEFAULT_TOOLBAR_CONFIG,
  getDefaultToolbarConfig,
  createToolDefinitionsMap,
  mergeWithDefaults,
} from "./toolbar-defaults";

// ============================================
// TYPE DE RETOUR DU HOOK
// ============================================

export interface UseToolbarConfigReturn {
  // Configuration actuelle
  config: ToolbarConfig;

  // Map des définitions d'outils
  toolDefinitions: Map<string, ToolDefinition>;

  // Outils de la ligne 1 (résolus avec leurs définitions)
  line1Tools: ResolvedToolbarItem[];

  // Outils de la ligne 2 (résolus avec leurs définitions)
  line2Tools: ResolvedToolbarItem[];

  // Outils masqués
  hiddenTools: string[];

  // État de l'éditeur
  isEditorOpen: boolean;
  setEditorOpen: (open: boolean) => void;

  // Actions
  updateConfig: (newConfig: ToolbarConfig) => void;
  resetConfig: () => void;
  isToolVisible: (toolId: string) => boolean;
  isGroupVisible: (groupId: string) => boolean;
  getGroupForTool: (toolId: string) => ToolbarGroup | null;

  // Pour la migration depuis l'ancienne config
  migrateFromOldConfig: (oldConfig: OldToolbarConfig) => void;
}

// ============================================
// TYPES INTERNES
// ============================================

// Outil résolu avec sa définition et son groupe éventuel
export interface ResolvedToolbarItem {
  type: "tool" | "group";
  id: string;
  definition?: ToolDefinition;
  group?: ToolbarGroup;
  tools?: ResolvedTool[]; // Si c'est un groupe, les outils qu'il contient
}

export interface ResolvedTool {
  id: string;
  definition: ToolDefinition;
}

// Ancienne config (v1) pour migration
export interface OldToolbarConfig {
  line1: { [key: string]: boolean };
  line2: { [key: string]: boolean };
}

// Mapping ancien ID -> nouveau ID
const OLD_TO_NEW_ID_MAP: Record<string, string> = {
  save: "save",
  import: "import",
  photos: "photos",
  exportSvg: "exportSvg",
  exportPng: "exportPng",
  exportDxf: "exportDxf",
  exportPdf: "exportPdf",
  templates: "templates",
  help: "help",
  selectPan: "select", // Groupe contenant select + pan
  transform: "mirror", // Groupe contenant mirror + moveRotate
  drawBasic: "line", // Groupe contenant outils de dessin
  drawAdvanced: "spline", // Groupe contenant spline, polygon
  modifications: "fillet", // Groupe contenant fillet, chamfer, offset
  photoTools: "showBackground", // Groupe outils photos
  dimensions: "dimension", // Groupe cotations
  viewControls: "zoomIn", // Groupe vue
  history: "undo", // Groupe historique
  branches: "branchSelect", // Groupe branches
};

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useToolbarConfig(): UseToolbarConfigReturn {
  // Map des définitions d'outils (stable)
  const toolDefinitions = useMemo(() => createToolDefinitionsMap(), []);

  // Charger la config depuis localStorage
  const [config, setConfig] = useState<ToolbarConfig>(() => {
    try {
      const saved = localStorage.getItem(TOOLBAR_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isValidToolbarConfig(parsed)) {
          return mergeWithDefaults(parsed);
        }
      }
    } catch (error) {
      console.warn("[useToolbarConfig] Failed to load config:", error);
    }
    return getDefaultToolbarConfig();
  });

  // État de l'éditeur
  const [isEditorOpen, setEditorOpen] = useState(false);

  // Sauvegarder la config quand elle change
  useEffect(() => {
    try {
      localStorage.setItem(TOOLBAR_CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error("[useToolbarConfig] Failed to save config:", error);
    }
  }, [config]);

  // ============================================
  // RÉSOLUTION DES OUTILS
  // ============================================

  const resolveItems = useCallback(
    (items: ToolbarItem[]): ResolvedToolbarItem[] => {
      return items.map((item) => {
        if (item.type === "tool") {
          const def = toolDefinitions.get(item.id);
          return {
            type: "tool" as const,
            id: item.id,
            definition: def,
          };
        } else {
          // Groupe
          const group = config.groups.find((g) => g.id === item.id);
          if (!group) {
            return {
              type: "group" as const,
              id: item.id,
            };
          }

          const tools: ResolvedTool[] = group.items
            .map((toolId) => {
              const def = toolDefinitions.get(toolId);
              return def ? { id: toolId, definition: def } : null;
            })
            .filter((t): t is ResolvedTool => t !== null);

          return {
            type: "group" as const,
            id: item.id,
            group,
            tools,
          };
        }
      });
    },
    [config.groups, toolDefinitions]
  );

  const line1Tools = useMemo(() => resolveItems(config.line1), [config.line1, resolveItems]);
  const line2Tools = useMemo(() => resolveItems(config.line2), [config.line2, resolveItems]);

  // ============================================
  // ACTIONS
  // ============================================

  const updateConfig = useCallback((newConfig: ToolbarConfig) => {
    setConfig(newConfig);
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(getDefaultToolbarConfig());
  }, []);

  const isToolVisible = useCallback(
    (toolId: string): boolean => {
      // Vérifier si masqué
      if (config.hidden.includes(toolId)) return false;

      // Vérifier si présent dans une ligne (directement ou via groupe)
      const checkInItems = (items: ToolbarItem[]): boolean => {
        for (const item of items) {
          if (item.type === "tool" && item.id === toolId) return true;
          if (item.type === "group") {
            const group = config.groups.find((g) => g.id === item.id);
            if (group && group.items.includes(toolId)) return true;
          }
        }
        return false;
      };

      return checkInItems(config.line1) || checkInItems(config.line2);
    },
    [config]
  );

  const isGroupVisible = useCallback(
    (groupId: string): boolean => {
      const checkInItems = (items: ToolbarItem[]): boolean => {
        return items.some((item) => item.type === "group" && item.id === groupId);
      };
      return checkInItems(config.line1) || checkInItems(config.line2);
    },
    [config]
  );

  const getGroupForTool = useCallback(
    (toolId: string): ToolbarGroup | null => {
      for (const group of config.groups) {
        if (group.items.includes(toolId)) {
          return group;
        }
      }
      return null;
    },
    [config.groups]
  );

  // ============================================
  // MIGRATION DEPUIS L'ANCIENNE CONFIG
  // ============================================

  const migrateFromOldConfig = useCallback((oldConfig: OldToolbarConfig) => {
    console.log("[useToolbarConfig] Migrating from old config:", oldConfig);

    // Pour la migration, on va simplement masquer les outils qui étaient désactivés
    const hidden: string[] = [];

    // Ligne 1
    Object.entries(oldConfig.line1).forEach(([key, visible]) => {
      if (!visible) {
        const newId = OLD_TO_NEW_ID_MAP[key];
        if (newId) hidden.push(newId);
      }
    });

    // Ligne 2
    Object.entries(oldConfig.line2).forEach(([key, visible]) => {
      if (!visible) {
        const newId = OLD_TO_NEW_ID_MAP[key];
        if (newId) hidden.push(newId);
      }
    });

    // Mettre à jour la config avec les outils masqués
    setConfig((prev) => ({
      ...prev,
      hidden: [...new Set([...prev.hidden, ...hidden])],
    }));

    // Supprimer l'ancienne config
    try {
      localStorage.removeItem("cad-toolbar-config");
    } catch {
      // Ignore
    }
  }, []);

  // ============================================
  // RETOUR
  // ============================================

  return {
    config,
    toolDefinitions,
    line1Tools,
    line2Tools,
    hiddenTools: config.hidden,
    isEditorOpen,
    setEditorOpen,
    updateConfig,
    resetConfig,
    isToolVisible,
    isGroupVisible,
    getGroupForTool,
    migrateFromOldConfig,
  };
}

export default useToolbarConfig;
