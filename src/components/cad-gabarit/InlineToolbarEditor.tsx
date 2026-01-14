// ============================================
// COMPOSANT: InlineToolbarEditor
// Système de drag & drop direct dans la toolbar
// VERSION: 1.0 - Création initiale
// ============================================

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MoreVertical,
  GripVertical,
  Plus,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  Check,
  X,
  Settings,
  Palette,
} from "lucide-react";
import { toast } from "sonner";

import {
  ToolbarConfig,
  ToolbarGroup,
  ToolbarItem,
  ToolbarLine,
  GROUP_COLORS,
  generateToolbarId,
} from "./toolbar-types";
import { createToolDefinitionsMap, ALL_TOOL_DEFINITIONS } from "./toolbar-defaults";

// ============================================
// TYPES
// ============================================

interface InlineToolbarEditorProps {
  config: ToolbarConfig;
  onConfigChange: (config: ToolbarConfig) => void;
  editMode: boolean;
  onEditModeChange: (mode: boolean) => void;
  // Fonction pour rendre un outil (fournie par CADGabaritCanvas)
  renderTool: (toolId: string) => React.ReactNode;
  // Index de la ligne à afficher
  lineIndex: number;
  // Conditions pour les outils conditionnels
  conditions?: { [key: string]: boolean };
}

interface DragData {
  type: "group" | "tool";
  id: string;
  sourceLineIndex: number;
  sourceIndex: number;
  fromGroupId?: string;
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function InlineToolbarEditor({
  config,
  onConfigChange,
  editMode,
  onEditModeChange,
  renderTool,
  lineIndex,
  conditions = {},
}: InlineToolbarEditorProps) {
  const toolDefs = useRef(createToolDefinitionsMap());
  
  // État du drag
  const [dragData, setDragData] = useState<DragData | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  
  // État pour création de groupe
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);
  
  // État pour édition de groupe
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  // Récupérer la ligne actuelle
  const currentLine = config.lines[lineIndex];
  if (!currentLine) return null;

  // ============================================
  // DRAG & DROP
  // ============================================

  const handleDragStart = useCallback((
    e: React.DragEvent,
    type: "group" | "tool",
    id: string,
    index: number,
    fromGroupId?: string
  ) => {
    const data: DragData = {
      type,
      id,
      sourceLineIndex: lineIndex,
      sourceIndex: index,
      fromGroupId,
    };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/json", JSON.stringify(data));
    setDragData(data);
  }, [lineIndex]);

  const handleDragOver = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetIndex(targetIndex);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetIndex(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragData(null);
    setDropTargetIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
    try {
      const data: DragData = JSON.parse(e.dataTransfer.getData("application/json"));
      
      onConfigChange((() => {
        const newConfig = JSON.parse(JSON.stringify(config)) as ToolbarConfig;
        
        // Retirer de la source
        if (data.fromGroupId) {
          // L'outil vient d'un groupe
          const sourceGroup = newConfig.groups.find(g => g.id === data.fromGroupId);
          if (sourceGroup) {
            sourceGroup.items = sourceGroup.items.filter(id => id !== data.id);
            // Si le groupe est vide, le supprimer
            if (sourceGroup.items.length === 0) {
              newConfig.groups = newConfig.groups.filter(g => g.id !== data.fromGroupId);
              newConfig.lines.forEach(line => {
                line.items = line.items.filter(item => !(item.type === "group" && item.id === data.fromGroupId));
              });
            }
          }
        } else if (data.sourceLineIndex === lineIndex) {
          // Même ligne, ajuster l'index
          newConfig.lines[lineIndex].items.splice(data.sourceIndex, 1);
        } else {
          // Ligne différente
          newConfig.lines[data.sourceLineIndex].items.splice(data.sourceIndex, 1);
        }
        
        // Ajouter à la cible
        const item: ToolbarItem = { type: data.type, id: data.id };
        let adjustedIndex = targetIndex;
        
        // Ajuster l'index si on déplace dans la même ligne
        if (data.sourceLineIndex === lineIndex && !data.fromGroupId && data.sourceIndex < targetIndex) {
          adjustedIndex--;
        }
        
        newConfig.lines[lineIndex].items.splice(adjustedIndex, 0, item);
        
        return newConfig;
      })());
      
      toast.success("Élément déplacé");
    } catch (error) {
      console.error("Drop error:", error);
    }
    
    handleDragEnd();
  }, [config, lineIndex, onConfigChange, handleDragEnd]);

  // ============================================
  // GESTION DES GROUPES
  // ============================================

  const createGroup = useCallback(() => {
    if (!newGroupName.trim()) {
      toast.error("Le nom du groupe est requis");
      return;
    }
    
    const newGroup: ToolbarGroup = {
      id: generateToolbarId(),
      name: newGroupName.trim(),
      color: newGroupColor,
      items: [],
    };
    
    onConfigChange({
      ...config,
      groups: [...config.groups, newGroup],
      lines: config.lines.map((line, idx) => {
        if (idx === lineIndex) {
          return {
            ...line,
            items: [...line.items, { type: "group" as const, id: newGroup.id }],
          };
        }
        return line;
      }),
    });
    
    setNewGroupName("");
    setShowCreateGroup(false);
    toast.success(`Groupe "${newGroup.name}" créé`);
  }, [newGroupName, newGroupColor, config, lineIndex, onConfigChange]);

  const deleteGroup = useCallback((groupId: string) => {
    const group = config.groups.find(g => g.id === groupId);
    if (!group) return;
    
    // Déplacer les outils du groupe vers les outils masqués
    onConfigChange({
      ...config,
      groups: config.groups.filter(g => g.id !== groupId),
      lines: config.lines.map(line => ({
        ...line,
        items: line.items.filter(item => !(item.type === "group" && item.id === groupId)),
      })),
      hidden: [...config.hidden, ...group.items],
    });
    
    toast.success(`Groupe "${group.name}" supprimé`);
  }, [config, onConfigChange]);

  const renameGroup = useCallback((groupId: string, newName: string) => {
    onConfigChange({
      ...config,
      groups: config.groups.map(g => 
        g.id === groupId ? { ...g, name: newName } : g
      ),
    });
    setEditingGroupId(null);
  }, [config, onConfigChange]);

  const changeGroupColor = useCallback((groupId: string, color: string) => {
    onConfigChange({
      ...config,
      groups: config.groups.map(g => 
        g.id === groupId ? { ...g, color } : g
      ),
    });
  }, [config, onConfigChange]);

  const toggleToolInGroup = useCallback((groupId: string, toolId: string) => {
    const group = config.groups.find(g => g.id === groupId);
    if (!group) return;
    
    const hasItem = group.items.includes(toolId);
    
    onConfigChange({
      ...config,
      groups: config.groups.map(g => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: hasItem 
            ? g.items.filter(id => id !== toolId)
            : [...g.items, toolId],
        };
      }),
      hidden: hasItem 
        ? [...config.hidden, toolId]
        : config.hidden.filter(id => id !== toolId),
    });
  }, [config, onConfigChange]);

  const addToolToGroup = useCallback((groupId: string, toolId: string) => {
    onConfigChange({
      ...config,
      groups: config.groups.map(g => {
        if (g.id !== groupId) return g;
        if (g.items.includes(toolId)) return g;
        return { ...g, items: [...g.items, toolId] };
      }),
      hidden: config.hidden.filter(id => id !== toolId),
    });
  }, [config, onConfigChange]);

  // ============================================
  // RENDU D'UN GROUPE
  // ============================================

  const renderGroup = useCallback((groupId: string, index: number) => {
    const group = config.groups.find(g => g.id === groupId);
    if (!group) return null;
    
    const isDragging = dragData?.id === groupId;
    const isDropTarget = dropTargetIndex === index;
    const isEditing = editingGroupId === groupId;

    // Filtrer les outils selon les conditions
    const visibleTools = group.items.filter(toolId => {
      const def = toolDefs.current.get(toolId);
      if (!def) return false;
      if (def.conditional && !conditions[def.conditional]) return false;
      return true;
    });

    // Ne pas afficher le groupe s'il n'a pas d'outils visibles (sauf en mode édition)
    if (!editMode && visibleTools.length === 0) return null;

    return (
      <div
        key={groupId}
        className={`
          relative flex items-center gap-1 bg-white rounded-md p-1 shadow-sm transition-all
          ${isDragging ? "opacity-50" : ""}
          ${isDropTarget ? "ring-2 ring-blue-500" : ""}
          ${editMode ? "pr-2" : ""}
        `}
        style={{
          borderLeft: `3px solid ${group.color || "#3B82F6"}`,
        }}
        draggable={editMode}
        onDragStart={(e) => editMode && handleDragStart(e, "group", groupId, index)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => editMode && handleDragOver(e, index)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => editMode && handleDrop(e, index)}
      >
        {/* Poignée de drag en mode édition */}
        {editMode && (
          <div className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-gray-100 rounded">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
        )}

        {/* Outils du groupe */}
        {visibleTools.map(toolId => (
          <React.Fragment key={toolId}>
            {renderTool(toolId)}
          </React.Fragment>
        ))}

        {/* Menu 3 points en mode édition */}
        {editMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 ml-1">
                <MoreVertical className="h-4 w-4 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: group.color }}
                />
                {isEditing ? (
                  <Input
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    onBlur={() => renameGroup(groupId, editGroupName)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameGroup(groupId, editGroupName);
                      if (e.key === "Escape") setEditingGroupId(null);
                    }}
                    className="h-6 text-sm"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span>{group.name}</span>
                )}
              </DropdownMenuLabel>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={() => {
                setEditingGroupId(groupId);
                setEditGroupName(group.name);
              }}>
                <Edit3 className="h-4 w-4 mr-2" />
                Renommer
              </DropdownMenuItem>
              
              {/* Couleurs */}
              <DropdownMenuLabel className="text-xs text-gray-500">Couleur</DropdownMenuLabel>
              <div className="flex gap-1 px-2 pb-2">
                {GROUP_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => changeGroupColor(groupId, color)}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      group.color === color ? "border-gray-800 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              
              <DropdownMenuSeparator />
              
              {/* Outils disponibles */}
              <DropdownMenuLabel className="text-xs text-gray-500">
                Outils ({group.items.length})
              </DropdownMenuLabel>
              
              <div className="max-h-48 overflow-y-auto">
                {group.items.map(toolId => {
                  const def = toolDefs.current.get(toolId);
                  if (!def) return null;
                  return (
                    <DropdownMenuCheckboxItem
                      key={toolId}
                      checked={true}
                      onCheckedChange={() => toggleToolInGroup(groupId, toolId)}
                    >
                      {def.label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </div>
              
              <DropdownMenuSeparator />
              
              {/* Ajouter des outils masqués */}
              {config.hidden.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs text-gray-500">
                    Ajouter depuis masqués
                  </DropdownMenuLabel>
                  <div className="max-h-32 overflow-y-auto">
                    {config.hidden.slice(0, 10).map(toolId => {
                      const def = toolDefs.current.get(toolId);
                      if (!def) return null;
                      return (
                        <DropdownMenuItem
                          key={toolId}
                          onClick={() => addToolToGroup(groupId, toolId)}
                        >
                          <Plus className="h-3 w-3 mr-2" />
                          {def.label}
                        </DropdownMenuItem>
                      );
                    })}
                    {config.hidden.length > 10 && (
                      <div className="px-2 py-1 text-xs text-gray-400">
                        +{config.hidden.length - 10} autres...
                      </div>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              
              <DropdownMenuItem
                onClick={() => deleteGroup(groupId)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer le groupe
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }, [
    config,
    dragData,
    dropTargetIndex,
    editMode,
    editingGroupId,
    editGroupName,
    conditions,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    renderTool,
    renameGroup,
    changeGroupColor,
    toggleToolInGroup,
    addToolToGroup,
    deleteGroup,
  ]);

  // ============================================
  // RENDU D'UN OUTIL SEUL
  // ============================================

  const renderSingleTool = useCallback((toolId: string, index: number) => {
    const def = toolDefs.current.get(toolId);
    if (!def) return null;
    
    // Vérifier les conditions
    if (def.conditional && !conditions[def.conditional]) return null;

    const isDragging = dragData?.id === toolId;
    const isDropTarget = dropTargetIndex === index;

    return (
      <div
        key={toolId}
        className={`
          relative flex items-center
          ${isDragging ? "opacity-50" : ""}
          ${isDropTarget ? "ring-2 ring-blue-500 rounded" : ""}
        `}
        draggable={editMode}
        onDragStart={(e) => editMode && handleDragStart(e, "tool", toolId, index)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => editMode && handleDragOver(e, index)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => editMode && handleDrop(e, index)}
      >
        {editMode && (
          <div className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-gray-200 rounded mr-1">
            <GripVertical className="h-3 w-3 text-gray-400" />
          </div>
        )}
        {renderTool(toolId)}
      </div>
    );
  }, [editMode, dragData, dropTargetIndex, conditions, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop, renderTool]);

  // ============================================
  // RENDU ZONE DE DROP FINALE
  // ============================================

  const renderDropZone = useCallback(() => {
    if (!editMode || !dragData) return null;
    
    const isDropTarget = dropTargetIndex === currentLine.items.length;
    
    return (
      <div
        className={`
          min-w-[40px] min-h-[36px] border-2 border-dashed rounded-md transition-all
          ${isDropTarget ? "border-blue-500 bg-blue-50" : "border-gray-300"}
        `}
        onDragOver={(e) => handleDragOver(e, currentLine.items.length)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, currentLine.items.length)}
      />
    );
  }, [editMode, dragData, dropTargetIndex, currentLine.items.length, handleDragOver, handleDragLeave, handleDrop]);

  // ============================================
  // RENDU PRINCIPAL
  // ============================================

  return (
    <>
      {/* Éléments de la ligne */}
      {currentLine.items.map((item, index) => (
        <React.Fragment key={item.id}>
          {/* Zone de drop avant l'élément */}
          {editMode && dragData && (
            <div
              className={`
                w-1 min-h-[36px] rounded transition-all
                ${dropTargetIndex === index ? "bg-blue-500 w-2" : "bg-transparent hover:bg-blue-200"}
              `}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
            />
          )}
          
          {item.type === "group" 
            ? renderGroup(item.id, index)
            : renderSingleTool(item.id, index)
          }
        </React.Fragment>
      ))}

      {/* Zone de drop finale */}
      {renderDropZone()}

      {/* Bouton créer groupe en mode édition */}
      {editMode && (
        <Popover open={showCreateGroup} onOpenChange={setShowCreateGroup}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1">
              <Plus className="h-4 w-4" />
              <span className="text-xs">Groupe</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Nouveau groupe</h4>
              <Input
                placeholder="Nom du groupe..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createGroup();
                }}
              />
              <div className="flex gap-1">
                {GROUP_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewGroupColor(color)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      newGroupColor === color ? "border-gray-800 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={createGroup} disabled={!newGroupName.trim()}>
                  <Check className="h-4 w-4 mr-1" />
                  Créer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreateGroup(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </>
  );
}

// ============================================
// BOUTON MODE ÉDITION
// ============================================

interface EditModeButtonProps {
  editMode: boolean;
  onEditModeChange: (mode: boolean) => void;
}

export function EditModeButton({ editMode, onEditModeChange }: EditModeButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={editMode ? "default" : "ghost"}
            size="sm"
            className={`h-9 w-9 p-0 ${editMode ? "bg-blue-600 hover:bg-blue-700" : ""}`}
            onClick={() => onEditModeChange(!editMode)}
          >
            <Settings className={`h-4 w-4 ${editMode ? "animate-spin-slow" : ""}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{editMode ? "Quitter le mode édition" : "Éditer la toolbar (drag & drop)"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================
// ZONE OUTILS MASQUÉS (pour afficher en bas)
// ============================================

interface HiddenToolsZoneProps {
  config: ToolbarConfig;
  onConfigChange: (config: ToolbarConfig) => void;
  editMode: boolean;
}

export function HiddenToolsZone({ config, onConfigChange, editMode }: HiddenToolsZoneProps) {
  const toolDefs = useRef(createToolDefinitionsMap());
  
  if (!editMode || config.hidden.length === 0) return null;

  const showTool = (toolId: string) => {
    // Ajouter à la première ligne
    onConfigChange({
      ...config,
      hidden: config.hidden.filter(id => id !== toolId),
      lines: config.lines.map((line, idx) => {
        if (idx === 0) {
          return {
            ...line,
            items: [...line.items, { type: "tool" as const, id: toolId }],
          };
        }
        return line;
      }),
    });
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-200 border-t">
      <EyeOff className="h-4 w-4 text-gray-500" />
      <span className="text-xs text-gray-600">Masqués ({config.hidden.length}):</span>
      <div className="flex flex-wrap gap-1">
        {config.hidden.slice(0, 15).map(toolId => {
          const def = toolDefs.current.get(toolId);
          if (!def) return null;
          return (
            <Button
              key={toolId}
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => showTool(toolId)}
            >
              {def.label}
              <Eye className="h-3 w-3 ml-1" />
            </Button>
          );
        })}
        {config.hidden.length > 15 && (
          <span className="text-xs text-gray-400 self-center">
            +{config.hidden.length - 15} autres
          </span>
        )}
      </div>
    </div>
  );
}

export default InlineToolbarEditor;
