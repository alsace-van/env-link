// ============================================
// COMPOSANT: ToolbarEditor
// Éditeur de toolbar drag & drop multi-lignes
// VERSION: 2.1 - Fix: synchronisation uniquement à l'ouverture (évite reset pendant drag)
// ============================================

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Edit3,
  ChevronDown,
  RotateCcw,
  Check,
  FolderPlus,
  Ungroup,
  Eye,
  EyeOff,
  Move,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  ToolbarConfig,
  ToolbarGroup,
  ToolbarItem,
  ToolbarLine,
  DragState,
  GROUP_COLORS,
  generateToolbarId,
  generateLineId,
} from "./toolbar-types";
import { createToolDefinitionsMap } from "./toolbar-defaults";

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

export function ToolbarEditor({ isOpen, onClose, config, onConfigChange }: ToolbarEditorProps) {
  // Map des définitions d'outils
  const toolDefs = useRef(createToolDefinitionsMap());

  // État local de la config (pour annuler les changements)
  const [localConfig, setLocalConfig] = useState<ToolbarConfig>(config);

  // État du drag & drop
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedId: null,
    draggedType: null,
    sourceLineIndex: null,
    sourceIndex: null,
    targetLineIndex: null,
    targetIndex: null,
  });

  // État pour la création de groupe
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState<string>(GROUP_COLORS[0]);

  // État pour l'édition de groupe
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  // État pour l'édition de nom de ligne
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editLineName, setEditLineName] = useState("");

  // État pour la modale draggable
  const [modalPosition, setModalPosition] = useState({ x: 100, y: 50 });
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Synchroniser avec la config parente UNIQUEMENT à l'ouverture
  // MODIFICATION v2.1: Utiliser un ref pour éviter la réinitialisation pendant le drag
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    // Ne synchroniser que quand on OUVRE la modale (passage de false à true)
    if (isOpen && !prevIsOpenRef.current) {
      setLocalConfig(JSON.parse(JSON.stringify(config)));
      setSelectedTools(new Set());
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, config]);

  // ============================================
  // DRAG & DROP MODAL
  // ============================================

  const handleModalMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".modal-header")) {
        setIsDraggingModal(true);
        setDragStartPos({
          x: e.clientX - modalPosition.x,
          y: e.clientY - modalPosition.y,
        });
      }
    },
    [modalPosition],
  );

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
  // DRAG & DROP OUTILS/GROUPES
  // ============================================

  const handleDragStart = useCallback(
    (
      e: React.DragEvent,
      itemId: string,
      itemType: "tool" | "group",
      lineIndex: number | "hidden",
      index: number,
      fromGroupId?: string,
    ) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify({ itemId, itemType, lineIndex, index, fromGroupId }));

      setDragState({
        isDragging: true,
        draggedId: itemId,
        draggedType: itemType,
        sourceLineIndex: lineIndex === "hidden" ? null : lineIndex,
        sourceIndex: index,
        targetLineIndex: null,
        targetIndex: null,
      });
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent, targetLineIndex: number | "hidden", targetIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    setDragState((prev) => ({
      ...prev,
      targetLineIndex,
      targetIndex,
    }));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedId: null,
      draggedType: null,
      sourceLineIndex: null,
      sourceIndex: null,
      targetLineIndex: null,
      targetIndex: null,
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetLineIndex: number | "hidden", targetIndex: number) => {
      e.preventDefault();

      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        const { itemId, itemType, lineIndex: sourceLineIndex, index: sourceIndex, fromGroupId } = data;

        setLocalConfig((prev) => {
          const newConfig = JSON.parse(JSON.stringify(prev)) as ToolbarConfig;

          // Retirer de la source
          if (fromGroupId) {
            // L'outil vient d'un groupe
            const sourceGroup = newConfig.groups.find((g) => g.id === fromGroupId);
            if (sourceGroup) {
              sourceGroup.items = sourceGroup.items.filter((id) => id !== itemId);
              if (sourceGroup.items.length === 0) {
                newConfig.groups = newConfig.groups.filter((g) => g.id !== fromGroupId);
                newConfig.lines.forEach((line) => {
                  line.items = line.items.filter((item) => !(item.type === "group" && item.id === fromGroupId));
                });
              }
            }
          } else if (typeof sourceLineIndex === "number") {
            newConfig.lines[sourceLineIndex].items.splice(sourceIndex, 1);
          } else if (sourceLineIndex === "hidden") {
            newConfig.hidden = newConfig.hidden.filter((id) => id !== itemId);
          }

          // Ajouter à la cible
          const item: ToolbarItem = { type: itemType, id: itemId };

          if (typeof targetLineIndex === "number") {
            let adjustedIndex = targetIndex;
            if (!fromGroupId && sourceLineIndex === targetLineIndex && sourceIndex < targetIndex) {
              adjustedIndex--;
            }
            newConfig.lines[targetLineIndex].items.splice(adjustedIndex, 0, item);
          } else if (targetLineIndex === "hidden") {
            if (itemType === "group") {
              const group = newConfig.groups.find((g) => g.id === itemId);
              if (group) {
                newConfig.hidden.push(...group.items);
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
    [handleDragEnd],
  );

  // Drop dans un groupe existant
  const handleDropInGroup = useCallback(
    (e: React.DragEvent, targetGroupId: string) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        const { itemId, itemType, fromGroupId } = data;

        if (itemType !== "tool") return;
        if (fromGroupId === targetGroupId) return;

        setLocalConfig((prev) => {
          const newConfig = JSON.parse(JSON.stringify(prev)) as ToolbarConfig;

          // Retirer de la source
          if (fromGroupId) {
            const sourceGroup = newConfig.groups.find((g) => g.id === fromGroupId);
            if (sourceGroup) {
              sourceGroup.items = sourceGroup.items.filter((id) => id !== itemId);
              if (sourceGroup.items.length === 0) {
                newConfig.groups = newConfig.groups.filter((g) => g.id !== fromGroupId);
                newConfig.lines.forEach((line) => {
                  line.items = line.items.filter((item) => !(item.type === "group" && item.id === fromGroupId));
                });
              }
            }
          } else {
            newConfig.lines.forEach((line) => {
              line.items = line.items.filter((item) => !(item.type === "tool" && item.id === itemId));
            });
            newConfig.hidden = newConfig.hidden.filter((id) => id !== itemId);
          }

          // Ajouter au groupe cible
          const targetGroup = newConfig.groups.find((g) => g.id === targetGroupId);
          if (targetGroup && !targetGroup.items.includes(itemId)) {
            targetGroup.items.push(itemId);
          }

          return newConfig;
        });

        handleDragEnd();
      } catch (error) {
        console.error("Drop in group error:", error);
      }
    },
    [handleDragEnd],
  );

  // ============================================
  // GESTION DES LIGNES
  // ============================================

  const addLine = useCallback(() => {
    setLocalConfig((prev) => ({
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
    toast.success("Nouvelle ligne ajoutée");
  }, []);

  const removeLine = useCallback((lineIndex: number) => {
    setLocalConfig((prev) => {
      if (prev.lines.length <= 1) {
        toast.error("Impossible de supprimer la dernière ligne");
        return prev;
      }

      const lineToRemove = prev.lines[lineIndex];
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

      toast.success(`Ligne "${lineToRemove.name || lineIndex + 1}" supprimée`);

      return {
        ...prev,
        lines: prev.lines.filter((_, idx) => idx !== lineIndex),
        hidden: [...new Set([...prev.hidden, ...toolsToHide])],
      };
    });
  }, []);

  const renameLine = useCallback((lineId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingLineId(null);
      return;
    }

    setLocalConfig((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => (line.id === lineId ? { ...line, name: newName.trim() } : line)),
    }));
    setEditingLineId(null);
  }, []);

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

      const newGroup: ToolbarGroup = {
        id: generateToolbarId(),
        name: newGroupName.trim(),
        color: newGroupColor,
        items: toolIds,
      };
      newConfig.groups.push(newGroup);

      let targetLineIndex = 0;
      let targetIndex = 0;
      let firstToolFound = false;

      // Trouver où placer le groupe et retirer les outils
      newConfig.lines.forEach((line, lineIdx) => {
        const newItems: ToolbarItem[] = [];
        line.items.forEach((item) => {
          if (item.type === "tool" && toolIds.includes(item.id)) {
            if (!firstToolFound) {
              targetLineIndex = lineIdx;
              targetIndex = newItems.length;
              firstToolFound = true;
            }
          } else if (item.type === "group") {
            const group = newConfig.groups.find((g) => g.id === item.id);
            if (group) {
              group.items = group.items.filter((id) => !toolIds.includes(id));
              if (group.items.length > 0) {
                newItems.push(item);
              }
            } else {
              newItems.push(item);
            }
          } else {
            newItems.push(item);
          }
        });
        line.items = newItems;
      });

      newConfig.hidden = newConfig.hidden.filter((id) => !toolIds.includes(id));
      newConfig.groups = newConfig.groups.filter((g) => g.items.length > 0);

      const groupItem: ToolbarItem = { type: "group", id: newGroup.id };
      newConfig.lines[targetLineIndex].items.splice(targetIndex, 0, groupItem);

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

      let targetLineIndex = 0;
      let targetIndex = 0;

      newConfig.lines.forEach((line, lineIdx) => {
        const idx = line.items.findIndex((item) => item.type === "group" && item.id === groupId);
        if (idx !== -1) {
          targetLineIndex = lineIdx;
          targetIndex = idx;
          line.items.splice(idx, 1);
        }
      });

      const toolItems: ToolbarItem[] = group.items.map((id) => ({
        type: "tool" as const,
        id,
      }));

      newConfig.lines[targetLineIndex].items.splice(targetIndex, 0, ...toolItems);
      newConfig.groups = newConfig.groups.filter((g) => g.id !== groupId);

      return newConfig;
    });

    toast.success("Groupe dissous");
  }, []);

  const renameGroup = useCallback((groupId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingGroupId(null);
      return;
    }

    setLocalConfig((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, name: newName.trim() } : g)),
    }));
    setEditingGroupId(null);
  }, []);

  const changeGroupColor = useCallback((groupId: string, color: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, color } : g)),
    }));
  }, []);

  // ============================================
  // AUTRES ACTIONS
  // ============================================

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
      // Ajouter à la dernière ligne
      if (newConfig.lines.length > 0) {
        newConfig.lines[newConfig.lines.length - 1].items.push({
          type: "tool",
          id: toolId,
        });
      }
      return newConfig;
    });
  }, []);

  const handleSave = useCallback(() => {
    onConfigChange(localConfig);
    toast.success("Configuration sauvegardée");
    onClose();
  }, [localConfig, onConfigChange, onClose]);

  const handleReset = useCallback(() => {
    if (confirm("Réinitialiser la toolbar à sa configuration par défaut ?")) {
      const { getDefaultToolbarConfig } = require("./toolbar-defaults");
      setLocalConfig(getDefaultToolbarConfig());
      toast.success("Configuration réinitialisée");
    }
  }, []);

  // ============================================
  // RENDU D'UN OUTIL
  // ============================================

  const renderTool = useCallback(
    (toolId: string, lineIndex: number | "hidden", index: number, inGroup = false, groupId?: string) => {
      const tool = toolDefs.current.get(toolId);
      if (!tool) return null;

      const isSelected = selectedTools.has(toolId);
      const isDragged = dragState.draggedId === toolId;

      return (
        <div
          key={toolId}
          draggable
          onDragStart={(e) => handleDragStart(e, toolId, "tool", lineIndex, index, groupId)}
          onDragEnd={handleDragEnd}
          onClick={() => isCreatingGroup && toggleToolSelection(toolId)}
          className={`
            flex items-center gap-2 px-2 py-1.5 rounded border transition-all
            ${isDragged ? "opacity-50 border-dashed" : ""}
            ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}
            ${isCreatingGroup ? "cursor-pointer hover:border-blue-300" : "cursor-grab hover:bg-gray-50"}
          `}
        >
          <GripVertical className="h-3 w-3 text-gray-400 flex-shrink-0" />
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
    [selectedTools, dragState, isCreatingGroup, handleDragStart, handleDragEnd, toggleToolSelection],
  );

  // ============================================
  // RENDU D'UN GROUPE
  // ============================================

  const renderGroup = useCallback(
    (groupId: string, lineIndex: number, index: number) => {
      const group = localConfig.groups.find((g) => g.id === groupId);
      if (!group) return null;

      const isDragged = dragState.draggedId === groupId;
      const isEditing = editingGroupId === groupId;

      return (
        <div
          key={groupId}
          draggable
          onDragStart={(e) => handleDragStart(e, groupId, "group", lineIndex, index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => handleDropInGroup(e, groupId)}
          className={`
            border-2 rounded-lg p-2 transition-all
            ${isDragged ? "opacity-50 border-dashed" : ""}
          `}
          style={{ borderColor: group.color || "#3B82F6" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
            {isEditing ? (
              <Input
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
                onBlur={() => renameGroup(groupId, editGroupName)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") renameGroup(groupId, editGroupName);
                  if (e.key === "Escape") setEditingGroupId(null);
                }}
                className="h-6 text-sm flex-1"
                autoFocus
              />
            ) : (
              <span className="text-sm font-medium flex-1 truncate">{group.name}</span>
            )}
            <Badge variant="secondary" className="text-xs">
              {group.items.length}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingGroupId(groupId);
                    setEditGroupName(group.name);
                  }}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Renommer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <Label className="text-xs text-gray-500">Couleur</Label>
                  <div className="flex gap-1 mt-1">
                    {GROUP_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => changeGroupColor(groupId, color)}
                        className={`w-5 h-5 rounded-full border-2 ${
                          group.color === color ? "border-gray-800" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => dissolveGroup(groupId)}>
                  <Ungroup className="h-4 w-4 mr-2" />
                  Dissoudre le groupe
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-1 pl-5">
            {group.items.map((toolId, idx) => renderTool(toolId, lineIndex, idx, true, groupId))}
          </div>
        </div>
      );
    },
    [
      localConfig.groups,
      dragState,
      editingGroupId,
      editGroupName,
      handleDragStart,
      handleDragEnd,
      handleDropInGroup,
      renameGroup,
      changeGroupColor,
      dissolveGroup,
      renderTool,
    ],
  );

  // ============================================
  // RENDU D'UNE LIGNE
  // ============================================

  const renderLine = useCallback(
    (line: ToolbarLine, lineIndex: number) => {
      const isDropTarget = dragState.targetLineIndex === lineIndex;
      const isEditingName = editingLineId === line.id;

      return (
        <div
          key={line.id}
          onDragOver={(e) => handleDragOver(e, lineIndex, line.items.length)}
          onDrop={(e) => handleDrop(e, lineIndex, line.items.length)}
          className={`
            min-h-[80px] p-3 rounded-lg border-2 border-dashed transition-all
            ${isDropTarget ? "border-blue-400 bg-blue-50" : "border-gray-200"}
          `}
        >
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="bg-white">
              {lineIndex + 1}
            </Badge>
            {isEditingName ? (
              <Input
                value={editLineName}
                onChange={(e) => setEditLineName(e.target.value)}
                onBlur={() => renameLine(line.id, editLineName)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") renameLine(line.id, editLineName);
                  if (e.key === "Escape") setEditingLineId(null);
                }}
                className="h-6 text-sm w-40"
                autoFocus
              />
            ) : (
              <span
                className="text-sm text-gray-600 cursor-pointer hover:text-blue-600"
                onClick={() => {
                  setEditingLineId(line.id);
                  setEditLineName(line.name || "");
                }}
              >
                {line.name || `Ligne ${lineIndex + 1}`}
              </span>
            )}
            <div className="flex-1" />
            {localConfig.lines.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => removeLine(lineIndex)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {line.items.map((item, index) => (
              <div
                key={item.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDragOver(e, lineIndex, index);
                }}
                onDrop={(e) => {
                  e.stopPropagation();
                  handleDrop(e, lineIndex, index);
                }}
                className={`
                  relative
                  ${
                    dragState.targetLineIndex === lineIndex && dragState.targetIndex === index
                      ? "before:absolute before:left-0 before:right-0 before:-top-1 before:h-0.5 before:bg-blue-500"
                      : ""
                  }
                `}
              >
                {item.type === "group" ? renderGroup(item.id, lineIndex, index) : renderTool(item.id, lineIndex, index)}
              </div>
            ))}

            {line.items.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm">Glissez des outils ou groupes ici</div>
            )}
          </div>
        </div>
      );
    },
    [
      localConfig.lines,
      dragState,
      editingLineId,
      editLineName,
      handleDragOver,
      handleDrop,
      renderGroup,
      renderTool,
      renameLine,
      removeLine,
    ],
  );

  // ============================================
  // RENDU ZONE MASQUÉE
  // ============================================

  const renderHiddenZone = useCallback(() => {
    const isDropTarget = dragState.targetLineIndex === "hidden";

    return (
      <div
        onDragOver={(e) => handleDragOver(e, "hidden", localConfig.hidden.length)}
        onDrop={(e) => handleDrop(e, "hidden", localConfig.hidden.length)}
        className={`
          min-h-[60px] p-3 rounded-lg border-2 border-dashed transition-all
          ${isDropTarget ? "border-red-400 bg-red-50" : "border-gray-300 bg-gray-50"}
        `}
      >
        <div className="flex items-center gap-2 mb-2">
          <EyeOff className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">Outils masqués</span>
          <Badge variant="secondary">{localConfig.hidden.length}</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {localConfig.hidden.map((toolId, index) => {
            const tool = toolDefs.current.get(toolId);
            if (!tool) return null;

            return (
              <div
                key={toolId}
                draggable
                onDragStart={(e) => handleDragStart(e, toolId, "tool", "hidden", index)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-gray-200 text-sm cursor-grab hover:bg-gray-50"
              >
                <span className="truncate max-w-[120px]">{tool.label}</span>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-1" onClick={() => showHiddenTool(toolId)}>
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            );
          })}

          {localConfig.hidden.length === 0 && (
            <span className="text-gray-400 text-sm">Glissez des outils ici pour les masquer</span>
          )}
        </div>
      </div>
    );
  }, [localConfig.hidden, dragState, handleDragOver, handleDrop, handleDragStart, handleDragEnd, showHiddenTool]);

  // ============================================
  // RENDU PRINCIPAL
  // ============================================

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-10">
      <div
        ref={modalRef}
        onMouseDown={handleModalMouseDown}
        style={{
          position: "absolute",
          left: modalPosition.x,
          top: modalPosition.y,
          maxHeight: "85vh",
        }}
        className="bg-white rounded-xl shadow-2xl w-[750px] flex flex-col overflow-hidden"
      >
        <div className="modal-header flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-xl cursor-move flex-shrink-0">
          <div className="flex items-center gap-3">
            <Move className="h-4 w-4 text-gray-400" />
            <h2 className="text-lg font-semibold">Configurer la Toolbar</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Création de groupe */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            {!isCreatingGroup ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700">
                  Glissez les groupes entre les lignes, ou créez de nouveaux groupes
                </span>
                <Button size="sm" onClick={() => setIsCreatingGroup(true)} className="gap-1">
                  <FolderPlus className="h-4 w-4" />
                  Nouveau groupe
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="default">{selectedTools.size} outils sélectionnés</Badge>
                  <span className="text-xs text-gray-500">Cliquez sur les outils pour les sélectionner</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Nom du groupe..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="flex-1"
                  />
                  <div className="flex gap-1">
                    {GROUP_COLORS.slice(0, 4).map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewGroupColor(color)}
                        className={`w-6 h-6 rounded-full border-2 ${
                          newGroupColor === color ? "border-gray-800" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={createGroup} disabled={selectedTools.size < 2}>
                    <Check className="h-4 w-4 mr-1" />
                    Créer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsCreatingGroup(false);
                      setSelectedTools(new Set());
                      setNewGroupName("");
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Bouton ajouter une ligne */}
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={addLine} className="gap-1">
              <Plus className="h-4 w-4" />
              Ajouter une ligne
            </Button>
          </div>

          {/* Toutes les lignes */}
          <div className="space-y-4">{localConfig.lines.map((line, index) => renderLine(line, index))}</div>

          {/* Zone masquée */}
          <div className="mt-4">{renderHiddenZone()}</div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t bg-gray-50 rounded-b-xl flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            <Check className="h-4 w-4 mr-1" />
            Sauvegarder
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ToolbarEditor;
