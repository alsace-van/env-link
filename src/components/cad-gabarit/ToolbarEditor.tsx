// ============================================
// COMPOSANT: ToolbarEditor
// Éditeur de toolbar drag & drop avec groupes
// VERSION: 1.0 - Création initiale
// ============================================

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  X,
  GripVertical,
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  RotateCcw,
  Check,
  FolderPlus,
  Ungroup,
  Eye,
  EyeOff,
  Move,
} from "lucide-react";
import { toast } from "sonner";

import {
  ToolbarConfig,
  ToolbarGroup,
  ToolbarItem,
  ToolDefinition,
  DragState,
  GROUP_COLORS,
  generateToolbarId,
} from "./toolbar-types";
import {
  getDefaultToolbarConfig,
  createToolDefinitionsMap,
} from "./toolbar-defaults";

// ============================================
// PROPS
// ============================================

interface ToolbarEditorProps {
  isOpen: boolean;
  onClose: () => void;
  config: ToolbarConfig;
  onConfigChange: (config: ToolbarConfig) => void;
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function ToolbarEditor({
  isOpen,
  onClose,
  config,
  onConfigChange,
}: ToolbarEditorProps) {
  // Map des définitions d'outils
  const toolDefs = useRef(createToolDefinitionsMap());

  // État local de la config (pour annuler les changements)
  const [localConfig, setLocalConfig] = useState<ToolbarConfig>(config);

  // État du drag & drop
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedId: null,
    draggedType: null,
    sourceLine: null,
    sourceIndex: null,
    targetLine: null,
    targetIndex: null,
  });

  // État pour la création de groupe
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);

  // État pour l'édition de groupe
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  // État pour la modale draggable
  const [modalPosition, setModalPosition] = useState({ x: 100, y: 50 });
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Synchroniser avec la config parente
  useEffect(() => {
    if (isOpen) {
      setLocalConfig(JSON.parse(JSON.stringify(config)));
      setSelectedTools(new Set());
    }
  }, [isOpen, config]);

  // ============================================
  // DRAG & DROP MODAL
  // ============================================

  const handleModalMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".modal-header")) {
      setIsDraggingModal(true);
      setDragStartPos({
        x: e.clientX - modalPosition.x,
        y: e.clientY - modalPosition.y,
      });
    }
  }, [modalPosition]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingModal) {
        setModalPosition({
          x: Math.max(0, e.clientX - dragStartPos.x),
          y: Math.max(0, e.clientY - dragStartPos.y),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingModal(false);
    };

    if (isDraggingModal) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingModal, dragStartPos]);

  // ============================================
  // DRAG & DROP OUTILS
  // ============================================

  const handleDragStart = useCallback(
    (
      e: React.DragEvent,
      itemId: string,
      itemType: "tool" | "group",
      line: 1 | 2 | "hidden",
      index: number
    ) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify({ itemId, itemType, line, index }));

      setDragState({
        isDragging: true,
        draggedId: itemId,
        draggedType: itemType,
        sourceLine: line === "hidden" ? null : line,
        sourceIndex: index,
        targetLine: null,
        targetIndex: null,
      });
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetLine: 1 | 2 | "hidden", targetIndex: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      setDragState((prev) => ({
        ...prev,
        targetLine,
        targetIndex,
      }));
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedId: null,
      draggedType: null,
      sourceLine: null,
      sourceIndex: null,
      targetLine: null,
      targetIndex: null,
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetLine: 1 | 2 | "hidden", targetIndex: number) => {
      e.preventDefault();

      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        const { itemId, itemType, line: sourceLine, index: sourceIndex } = data;

        setLocalConfig((prev) => {
          const newConfig = JSON.parse(JSON.stringify(prev)) as ToolbarConfig;

          // Retirer de la source
          if (sourceLine === 1) {
            newConfig.line1.splice(sourceIndex, 1);
          } else if (sourceLine === 2) {
            newConfig.line2.splice(sourceIndex, 1);
          } else if (sourceLine === "hidden") {
            newConfig.hidden = newConfig.hidden.filter((id) => id !== itemId);
          }

          // Ajouter à la cible
          const item: ToolbarItem = { type: itemType, id: itemId };

          if (targetLine === 1) {
            // Ajuster l'index si on déplace dans la même ligne
            let adjustedIndex = targetIndex;
            if (sourceLine === 1 && sourceIndex < targetIndex) {
              adjustedIndex--;
            }
            newConfig.line1.splice(adjustedIndex, 0, item);
          } else if (targetLine === 2) {
            let adjustedIndex = targetIndex;
            if (sourceLine === 2 && sourceIndex < targetIndex) {
              adjustedIndex--;
            }
            newConfig.line2.splice(adjustedIndex, 0, item);
          } else if (targetLine === "hidden") {
            // Si c'est un groupe, extraire les outils et les masquer
            if (itemType === "group") {
              const group = newConfig.groups.find((g) => g.id === itemId);
              if (group) {
                newConfig.hidden.push(...group.items);
                // Supprimer le groupe
                newConfig.groups = newConfig.groups.filter((g) => g.id !== itemId);
              }
            } else {
              newConfig.hidden.push(itemId);
            }
          }

          return newConfig;
        });
      } catch (error) {
        console.error("Drop error:", error);
      }

      handleDragEnd();
    },
    [handleDragEnd]
  );

  // ============================================
  // GESTION DES GROUPES
  // ============================================

  const createGroup = useCallback(() => {
    if (selectedTools.size < 2) {
      toast.error("Sélectionnez au moins 2 outils pour créer un groupe");
      return;
    }

    if (!newGroupName.trim()) {
      toast.error("Donnez un nom au groupe");
      return;
    }

    setLocalConfig((prev) => {
      const newConfig = JSON.parse(JSON.stringify(prev)) as ToolbarConfig;
      const toolIds = Array.from(selectedTools);

      // Créer le nouveau groupe
      const newGroup: ToolbarGroup = {
        id: generateToolbarId(),
        name: newGroupName.trim(),
        color: newGroupColor,
        items: toolIds,
      };
      newConfig.groups.push(newGroup);

      // Trouver où insérer le groupe (position du premier outil sélectionné)
      let targetLine: 1 | 2 = 2;
      let targetIndex = 0;
      let firstToolFound = false;

      // Retirer les outils des lignes et trouver la position
      const removeTools = (line: ToolbarItem[], lineNum: 1 | 2) => {
        const newLine: ToolbarItem[] = [];
        line.forEach((item, idx) => {
          if (item.type === "tool" && toolIds.includes(item.id)) {
            if (!firstToolFound) {
              targetLine = lineNum;
              targetIndex = newLine.length;
              firstToolFound = true;
            }
          } else if (item.type === "group") {
            const group = newConfig.groups.find((g) => g.id === item.id);
            if (group) {
              // Retirer les outils du groupe existant s'ils sont sélectionnés
              group.items = group.items.filter((id) => !toolIds.includes(id));
              // Garder le groupe seulement s'il a encore des outils
              if (group.items.length > 0) {
                newLine.push(item);
              }
            } else {
              newLine.push(item);
            }
          } else {
            newLine.push(item);
          }
        });
        return newLine;
      };

      newConfig.line1 = removeTools(newConfig.line1, 1);
      newConfig.line2 = removeTools(newConfig.line2, 2);

      // Retirer des masqués aussi
      newConfig.hidden = newConfig.hidden.filter((id) => !toolIds.includes(id));

      // Nettoyer les groupes vides
      newConfig.groups = newConfig.groups.filter((g) => g.items.length > 0);

      // Insérer le nouveau groupe
      const groupItem: ToolbarItem = { type: "group", id: newGroup.id };
      if (targetLine === 1) {
        newConfig.line1.splice(targetIndex, 0, groupItem);
      } else {
        newConfig.line2.splice(targetIndex, 0, groupItem);
      }

      return newConfig;
    });

    setSelectedTools(new Set());
    setIsCreatingGroup(false);
    setNewGroupName("");
    toast.success(`Groupe "${newGroupName}" créé`);
  }, [selectedTools, newGroupName, newGroupColor]);

  const dissolveGroup = useCallback((groupId: string) => {
    setLocalConfig((prev) => {
      const newConfig = JSON.parse(JSON.stringify(prev)) as ToolbarConfig;
      const group = newConfig.groups.find((g) => g.id === groupId);

      if (!group) return prev;

      // Trouver où est le groupe
      let targetLine: 1 | 2 = 2;
      let targetIndex = 0;

      const findAndRemove = (line: ToolbarItem[], lineNum: 1 | 2) => {
        const idx = line.findIndex((item) => item.type === "group" && item.id === groupId);
        if (idx !== -1) {
          targetLine = lineNum;
          targetIndex = idx;
          line.splice(idx, 1);
          return true;
        }
        return false;
      };

      if (!findAndRemove(newConfig.line1, 1)) {
        findAndRemove(newConfig.line2, 2);
      }

      // Insérer les outils individuels à la place
      const toolItems: ToolbarItem[] = group.items.map((id) => ({
        type: "tool" as const,
        id,
      }));

      if (targetLine === 1) {
        newConfig.line1.splice(targetIndex, 0, ...toolItems);
      } else {
        newConfig.line2.splice(targetIndex, 0, ...toolItems);
      }

      // Supprimer le groupe
      newConfig.groups = newConfig.groups.filter((g) => g.id !== groupId);

      return newConfig;
    });

    toast.success("Groupe dissous");
  }, []);

  const renameGroup = useCallback((groupId: string, newName: string) => {
    setLocalConfig((prev) => {
      const newConfig = JSON.parse(JSON.stringify(prev)) as ToolbarConfig;
      const group = newConfig.groups.find((g) => g.id === groupId);
      if (group) {
        group.name = newName;
      }
      return newConfig;
    });
    setEditingGroupId(null);
  }, []);

  const changeGroupColor = useCallback((groupId: string, color: string) => {
    setLocalConfig((prev) => {
      const newConfig = JSON.parse(JSON.stringify(prev)) as ToolbarConfig;
      const group = newConfig.groups.find((g) => g.id === groupId);
      if (group) {
        group.color = color;
      }
      return newConfig;
    });
  }, []);
// ============================================
  // ACTIONS
  // ============================================

  const handleSave = useCallback(() => {
    onConfigChange(localConfig);
    toast.success("Configuration sauvegardée");
    onClose();
  }, [localConfig, onConfigChange, onClose]);

  const handleReset = useCallback(() => {
    const defaultConfig = getDefaultToolbarConfig();
    setLocalConfig(defaultConfig);
    toast.info("Configuration réinitialisée");
  }, []);

  const toggleToolSelection = useCallback((toolId: string) => {
    setSelectedTools((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(toolId)) {
        newSet.delete(toolId);
      } else {
        newSet.add(toolId);
      }
      return newSet;
    });
  }, []);

  const showHiddenTool = useCallback((toolId: string) => {
    setLocalConfig((prev) => {
      const newConfig = JSON.parse(JSON.stringify(prev)) as ToolbarConfig;
      newConfig.hidden = newConfig.hidden.filter((id) => id !== toolId);
      newConfig.line2.push({ type: "tool", id: toolId });
      return newConfig;
    });
  }, []);

  // ============================================
  // RENDU D'UN OUTIL
  // ============================================

  const renderTool = useCallback(
    (toolId: string, line: 1 | 2 | "hidden", index: number, inGroup = false) => {
      const tool = toolDefs.current.get(toolId);
      if (!tool) return null;

      const isSelected = selectedTools.has(toolId);
      const isDragged = dragState.draggedId === toolId;

      return (
        <div
          key={toolId}
          draggable={!inGroup}
          onDragStart={(e) => !inGroup && handleDragStart(e, toolId, "tool", line, index)}
          onDragEnd={handleDragEnd}
          onClick={() => isCreatingGroup && toggleToolSelection(toolId)}
          className={`
            flex items-center gap-2 px-2 py-1.5 rounded border transition-all
            ${isDragged ? "opacity-50 border-dashed" : ""}
            ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}
            ${isCreatingGroup ? "cursor-pointer hover:border-blue-300" : "cursor-grab hover:bg-gray-50"}
            ${inGroup ? "cursor-default" : ""}
          `}
        >
          {!inGroup && (
            <GripVertical className="h-3 w-3 text-gray-400 flex-shrink-0" />
          )}
          <span className="text-sm truncate flex-1">{tool.label}</span>
          {tool.shortcut && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {tool.shortcut}
            </Badge>
          )}
          {isSelected && <Check className="h-3 w-3 text-blue-500" />}
        </div>
      );
    },
    [
      selectedTools,
      dragState,
      isCreatingGroup,
      handleDragStart,
      handleDragEnd,
      toggleToolSelection,
    ]
  );

  // ============================================
  // RENDU D'UN GROUPE
  // ============================================

  const renderGroup = useCallback(
    (groupId: string, line: 1 | 2, index: number) => {
      const group = localConfig.groups.find((g) => g.id === groupId);
      if (!group) return null;

      const isDragged = dragState.draggedId === groupId;
      const isEditing = editingGroupId === groupId;

      return (
        <div
          key={groupId}
          draggable
          onDragStart={(e)
