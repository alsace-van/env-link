/**
 * SchemaLayersPanel.tsx
 * Version: 1.0
 * Date: 2025-12-21
 * Description: Panneau de gestion des calques libres pour le schéma électrique
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Layers,
  Plus,
  Trash2,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

export interface SchemaLayer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  order: number;
}

// Couleurs disponibles pour les calques
const LAYER_COLORS = [
  { value: "#ef4444", label: "Rouge" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Jaune" },
  { value: "#22c55e", label: "Vert" },
  { value: "#14b8a6", label: "Turquoise" },
  { value: "#3b82f6", label: "Bleu" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#ec4899", label: "Rose" },
  { value: "#64748b", label: "Gris" },
  { value: "#1e293b", label: "Noir" },
];

// Calque par défaut
export const createDefaultLayer = (): SchemaLayer => ({
  id: "layer-default",
  name: "Général",
  color: "#3b82f6",
  visible: true,
  locked: false,
  order: 0,
});

// ============================================
// PROPS
// ============================================

interface SchemaLayersPanelProps {
  layers: SchemaLayer[];
  activeLayerId: string | null;
  onLayersChange: (layers: SchemaLayer[]) => void;
  onActiveLayerChange: (layerId: string) => void;
  itemCountByLayer?: Record<string, number>;
}

// ============================================
// SOUS-COMPOSANT: Item de calque
// ============================================

interface LayerItemProps {
  layer: SchemaLayer;
  isActive: boolean;
  itemCount: number;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onChangeColor: (color: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
}

const LayerItem = ({
  layer,
  isActive,
  itemCount,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onChangeColor,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  canDelete,
}: LayerItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(layer.name);

  const handleRename = () => {
    if (editName.trim() && editName !== layer.name) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <div
      className={`
        flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors
        ${isActive ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"}
        ${!layer.visible ? "opacity-50" : ""}
      `}
      onClick={onSelect}
    >
      {/* Indicateur couleur */}
      <Popover>
        <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button
            className="w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0 hover:scale-110 transition-transform"
            style={{ backgroundColor: layer.color }}
            title="Changer la couleur"
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-5 gap-1">
            {LAYER_COLORS.map((c) => (
              <button
                key={c.value}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  layer.color === c.value ? "border-slate-800" : "border-white"
                }`}
                style={{ backgroundColor: c.value }}
                onClick={() => onChangeColor(c.value)}
                title={c.label}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Nom du calque */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setIsEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-6 text-sm py-0"
            autoFocus
          />
        ) : (
          <span
            className="text-sm font-medium truncate block"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setEditName(layer.name);
            }}
            title="Double-clic pour renommer"
          >
            {layer.name}
          </span>
        )}
      </div>

      {/* Compteur d'éléments */}
      {itemCount > 0 && (
        <Badge variant="secondary" className="h-5 px-1.5 text-xs flex-shrink-0">
          {itemCount}
        </Badge>
      )}

      {/* Boutons d'action */}
      <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Visibilité */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggleVisibility}
          title={layer.visible ? "Masquer" : "Afficher"}
        >
          {layer.visible ? (
            <Eye className="h-3.5 w-3.5 text-slate-600" />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-slate-400" />
          )}
        </Button>

        {/* Verrouillage */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggleLock}
          title={layer.locked ? "Déverrouiller" : "Verrouiller"}
        >
          {layer.locked ? (
            <Lock className="h-3.5 w-3.5 text-amber-600" />
          ) : (
            <Unlock className="h-3.5 w-3.5 text-slate-400" />
          )}
        </Button>

        {/* Menu plus d'options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setIsEditing(true);
                setEditName(layer.name);
              }}
            >
              Renommer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onMoveUp} disabled={!canMoveUp}>
              <ChevronUp className="h-4 w-4 mr-2" />
              Monter
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveDown} disabled={!canMoveDown}>
              <ChevronDown className="h-4 w-4 mr-2" />
              Descendre
            </DropdownMenuItem>
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export const SchemaLayersPanel = ({
  layers,
  activeLayerId,
  onLayersChange,
  onActiveLayerChange,
  itemCountByLayer = {},
}: SchemaLayersPanelProps) => {
  const [newLayerName, setNewLayerName] = useState("");

  // Trier les calques par ordre
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

  // Toggle visibilité d'un calque
  const toggleVisibility = (layerId: string) => {
    onLayersChange(layers.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)));
  };

  // Toggle verrouillage d'un calque
  const toggleLock = (layerId: string) => {
    onLayersChange(layers.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l)));
  };

  // Changer la couleur d'un calque
  const changeColor = (layerId: string, color: string) => {
    onLayersChange(layers.map((l) => (l.id === layerId ? { ...l, color } : l)));
  };

  // Renommer un calque
  const renameLayer = (layerId: string, name: string) => {
    onLayersChange(layers.map((l) => (l.id === layerId ? { ...l, name } : l)));
  };

  // Ajouter un nouveau calque
  const addLayer = () => {
    const name = newLayerName.trim() || `Calque ${layers.length + 1}`;
    const newLayer: SchemaLayer = {
      id: `layer-${Date.now()}`,
      name,
      color: LAYER_COLORS[layers.length % LAYER_COLORS.length].value,
      visible: true,
      locked: false,
      order: Math.max(...layers.map((l) => l.order), -1) + 1,
    };
    onLayersChange([...layers, newLayer]);
    onActiveLayerChange(newLayer.id);
    setNewLayerName("");
    toast.success(`Calque "${name}" créé`);
  };

  // Supprimer un calque
  const deleteLayer = (layerId: string) => {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;

    const count = itemCountByLayer[layerId] || 0;
    if (count > 0) {
      const defaultLayer = layers.find((l) => l.id !== layerId);
      if (
        !confirm(
          `Ce calque contient ${count} élément(s). Les éléments seront déplacés vers "${defaultLayer?.name || "un autre calque"}". Continuer ?`,
        )
      ) {
        return;
      }
    }

    const newLayers = layers.filter((l) => l.id !== layerId);
    onLayersChange(newLayers);

    // Si on supprime le calque actif, sélectionner le premier restant
    if (activeLayerId === layerId && newLayers.length > 0) {
      onActiveLayerChange(newLayers[0].id);
    }

    toast.success(`Calque "${layer.name}" supprimé`);
  };

  // Déplacer un calque vers le haut
  const moveUp = (layerId: string) => {
    const index = sortedLayers.findIndex((l) => l.id === layerId);
    if (index <= 0) return;

    const newLayers = layers.map((l) => {
      if (l.id === layerId) return { ...l, order: l.order - 1.5 };
      return l;
    });
    // Réordonner proprement
    const reordered = newLayers.sort((a, b) => a.order - b.order).map((l, i) => ({ ...l, order: i }));
    onLayersChange(reordered);
  };

  // Déplacer un calque vers le bas
  const moveDown = (layerId: string) => {
    const index = sortedLayers.findIndex((l) => l.id === layerId);
    if (index >= sortedLayers.length - 1) return;

    const newLayers = layers.map((l) => {
      if (l.id === layerId) return { ...l, order: l.order + 1.5 };
      return l;
    });
    // Réordonner proprement
    const reordered = newLayers.sort((a, b) => a.order - b.order).map((l, i) => ({ ...l, order: i }));
    onLayersChange(reordered);
  };

  // Afficher/masquer tous les calques
  const toggleAllVisibility = (visible: boolean) => {
    onLayersChange(layers.map((l) => ({ ...l, visible })));
  };

  // Nombre de calques visibles
  const visibleCount = layers.filter((l) => l.visible).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Layers className="h-4 w-4" />
          Calques
          {visibleCount < layers.length && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {visibleCount}/{layers.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {/* Header */}
        <div className="p-3 border-b bg-slate-50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Calques</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => toggleAllVisibility(true)}
                title="Tout afficher"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => toggleAllVisibility(false)}
                title="Tout masquer"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Liste des calques */}
        <ScrollArea className="max-h-72">
          <div className="p-2 space-y-1">
            {sortedLayers.map((layer, index) => (
              <LayerItem
                key={layer.id}
                layer={layer}
                isActive={activeLayerId === layer.id}
                itemCount={itemCountByLayer[layer.id] || 0}
                onSelect={() => onActiveLayerChange(layer.id)}
                onToggleVisibility={() => toggleVisibility(layer.id)}
                onToggleLock={() => toggleLock(layer.id)}
                onChangeColor={(color) => changeColor(layer.id, color)}
                onRename={(name) => renameLayer(layer.id, name)}
                onDelete={() => deleteLayer(layer.id)}
                onMoveUp={() => moveUp(layer.id)}
                onMoveDown={() => moveDown(layer.id)}
                canMoveUp={index > 0}
                canMoveDown={index < sortedLayers.length - 1}
                canDelete={layers.length > 1}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Ajouter un calque */}
        <div className="p-2 border-t bg-slate-50">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nouveau calque..."
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLayer()}
              className="h-8 text-sm"
            />
            <Button size="sm" onClick={addLayer} className="h-8 px-3">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Info calque actif */}
        {activeLayerId && (
          <div className="px-3 py-2 border-t text-xs text-slate-500 bg-blue-50/50">
            <span className="flex items-center gap-1.5">
              <Check className="h-3 w-3 text-blue-500" />
              Calque actif : <strong>{layers.find((l) => l.id === activeLayerId)?.name}</strong>
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default SchemaLayersPanel;
