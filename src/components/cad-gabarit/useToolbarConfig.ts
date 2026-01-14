// ============================================
// HOOK: useToolbarConfig
// Gestion de la configuration de la toolbar
// VERSION: 2.0 - Support multi-lignes dynamiques
// ============================================

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ToolbarConfig,
  ToolbarItem,
  ToolbarGroup,
  ToolbarLine,
  ToolDefinition,
  TOOLBAR_CONFIG_KEY,
  isValidToolbarConfig,
  generateLineId,
} from "./toolbar-types";
import { getDefaultToolbarConfig, createToolDefinitionsMap, mergeWithDefaults } from "./toolbar-defaults";

// ============================================
// TYPE DE RETOUR DU HOOK
// ============================================

export interface UseToolbarConfigReturn {
  // Configuration actuelle
  config: ToolbarConfig;

  // Map des définitions d'outils
  toolDefinitions: Map<string, ToolDefinition>;

  // Toutes les lignes résolues
  resolvedLines: ResolvedLine[];

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
  addLine: () => void;
  removeLine: (lineIndex: number) => void;
}

// ============================================
// TYPES INTERNES
// ============================================

// Une ligne résolue avec ses outils
export interface ResolvedLine {
  id: string;
  name?: string;
  items: ResolvedToolbarItem[];
}

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
    [config.groups, toolDefinitions],
  );

  // Résoudre toutes les lignes
  const resolvedLines = useMemo((): ResolvedLine[] => {
    return config.lines.map((line) => ({
      id: line.id,
      name: line.name,
      items: resolveItems(line.items),
    }));
  }, [config.lines, resolveItems]);

  // ============================================
  // ACTIONS
  // ============================================

  const updateConfig = useCallback((newConfig: ToolbarConfig) => {
    setConfig(newConfig);
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(getDefaultToolbarConfig());
  }, []);

  const addLine = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          id: generateLineId(),
          name: `Ligne ${prev.lines.length + 1}`,
          items: [],
        },
      ],
    }));
  }, []);

  const removeLine = useCallback((lineIndex: number) => {
    setConfig((prev) => {
      if (prev.lines.length <= 1) return prev; // Garder au moins une ligne

      const lineToRemove = prev.lines[lineIndex];
      if (!lineToRemove) return prev;

      // Récupérer tous les outils de la ligne à supprimer et les masquer
      const toolsToHide: string[] = [];
      lineToRemove.items.forEach((item) => {
        if (item.type === "tool") {
          toolsToHide.push(item.id);
        } else {
          const group = prev.groups.find((g) => g.id === item.id);
          if (group) {
            toolsToHide.push(...group.items);
          }
        }
      });

      return {
        ...prev,
        lines: prev.lines.filter((_, idx) => idx !== lineIndex),
        hidden: [...new Set([...prev.hidden, ...toolsToHide])],
      };
    });
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

      return config.lines.some((line) => checkInItems(line.items));
    },
    [config],
  );

  const isGroupVisible = useCallback(
    (groupId: string): boolean => {
      return config.lines.some((line) => line.items.some((item) => item.type === "group" && item.id === groupId));
    },
    [config],
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
    [config.groups],
  );

  // ============================================
  // RETOUR
  // ============================================

  return {
    config,
    toolDefinitions,
    resolvedLines,
    hiddenTools: config.hidden,
    isEditorOpen,
    setEditorOpen,
    updateConfig,
    resetConfig,
    isToolVisible,
    isGroupVisible,
    getGroupForTool,
    addLine,
    removeLine,
  };
}

export default useToolbarConfig;
