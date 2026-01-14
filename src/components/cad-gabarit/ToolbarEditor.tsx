// ============================================
// COMPOSANT: ToolbarEditor
// Éditeur de toolbar drag & drop avec groupes
// VERSION: 1.1 - Corrections TypeScript
// ============================================

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { toast } from "sonner";

import { ToolbarConfig, ToolbarGroup, ToolbarItem, DragState, GROUP_COLORS, generateToolbarId } from "./toolbar-types";
import { getDefaultToolbarConfig, createToolDefinitionsMap } from "./toolbar-defaults";

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
    sourceLine: null,
    sourceIndex: null,
    targetLine: null,
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
  // DRAG & DROP OUTILS
  // ============================================

  const handleDragStart = useCallback(
    (e: React.DragEvent, itemId: string, itemType: "tool" | "group", line: 1 | 2 | "hidden", index: number) => {
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
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent, targetLine: 1 | 2 | "hidden", targetIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    setDragState((prev) => ({
      ...prev,
      targetLine,
      targetIndex,
    }));
  }, []);

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

      let targetLine: number = 2;
      let targetIndex = 0;
      let firstToolFound = false;

      const removeTools = (line: ToolbarItem[], lineNum: number) => {
        const newLine: ToolbarItem[] = [];
        line.forEach((item) => {
          if (item.type === "tool" && toolIds.includes(item.id)) {
            if (!firstToolFound) {
              targetLine = lineNum;
              targetIndex = newLine.length;
              firstToolFound = true;
            }
          } else if (item.type === "group") {
            const group = newConfig.groups.find((g) => g.id === item.id);
            if (group) {
              group.items = group.items.filter((id) => !toolIds.includes(id));
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
      newConfig.hidden = newConfig.hidden.filter((id) => !toolIds.includes(id));
      newConfig.groups = newConfig.groups.filter((g) => g.items.length > 0);

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

      let targetLine: number = 2;
      let targetIndex = 0;

      const findAndRemove = (line: ToolbarItem[], lineNum: number) => {
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

      const toolItems: ToolbarItem[] = group.items.map((id) => ({
        type: "tool" as const,
        id,
      }));

      if (targetLine === 1) {
        newConfig.line1.splice(targetIndex, 0, ...toolItems);
      } else {
        newConfig.line2.splice(targetIndex, 0, ...toolItems);
      }

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
          {!inGroup && <GripVertical className="h-3 w-3 text-gray-400 flex-shrink-0" />}
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
    (groupId: string, line: 1 | 2, index: number) => {
      const group = localConfig.groups.find((g) => g.id === groupId);
      if (!group) return null;

      const isDragged = dragState.draggedId === groupId;
      const isEditing = editingGroupId === groupId;

      return (
        <div
          key={groupId}
          draggable
          onDragStart={(e) => handleDragStart(e, groupId, "group", line, index)}
          onDragEnd={handleDragEnd}
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

          <div className="space-y-1 pl-5">{group.items.map((toolId, idx) => renderTool(toolId, line, idx, true))}</div>
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
    (lineNum: 1 | 2) => {
      const items = lineNum === 1 ? localConfig.line1 : localConfig.line2;
      const isDropTarget = dragState.targetLine === lineNum;

      return (
        <div
          onDragOver={(e) => handleDragOver(e, lineNum, items.length)}
          onDrop={(e) => handleDrop(e, lineNum, items.length)}
          className={`
            min-h-[100px] p-3 rounded-lg border-2 border-dashed transition-all
            ${isDropTarget ? "border-blue-400 bg-blue-50" : "border-gray-200"}
          `}
        >
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline">Ligne {lineNum}</Badge>
            <span className="text-xs text-gray-500">{lineNum === 1 ? "Fichiers & Export" : "Outils & Options"}</span>
          </div>

          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={item.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDragOver(e, lineNum, index);
                }}
                onDrop={(e) => {
                  e.stopPropagation();
                  handleDrop(e, lineNum, index);
                }}
                className={`
                  relative
                  ${
                    dragState.targetLine === lineNum && dragState.targetIndex === index
                      ? "before:absolute before:left-0 before:right-0 before:-top-1 before:h-0.5 before:bg-blue-500"
                      : ""
                  }
                `}
              >
                {item.type === "group" ? renderGroup(item.id, lineNum, index) : renderTool(item.id, lineNum, index)}
              </div>
            ))}

            {items.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">Glissez des outils ou groupes ici</div>
            )}
          </div>
        </div>
      );
    },
    [localConfig, dragState, handleDragOver, handleDrop, renderGroup, renderTool],
  );

  // ============================================
  // RENDU ZONE MASQUÉE
  // ============================================

  const renderHiddenZone = useCallback(() => {
    const isDropTarget = dragState.targetLine === "hidden";

    return (
      <div
        onDragOver={(e) => handleDragOver(e, "hidden", localConfig.hidden.length)}
        onDrop={(e) => handleDrop(e, "hidden", localConfig.hidden.length)}
        className={`
          min-h-[80px] p-3 rounded-lg border-2 border-dashed transition-all
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
        }}
        className="bg-white rounded-xl shadow-2xl w-[700px] max-h-[85vh] flex flex-col"
      >
        <div className="modal-header flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-xl cursor-move">
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

        <ScrollArea className="flex-1 p-4">
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            {!isCreatingGroup ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700">Sélectionnez des outils puis créez un groupe</span>
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

          <div className="space-y-4">
            {renderLine(1)}
            {renderLine(2)}
          </div>

          <div className="mt-4">{renderHiddenZone()}</div>
        </ScrollArea>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t bg-gray-50 rounded-b-xl">
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
