// ============================================
// COMPOSANT: ToolbarRenderer
// Rendu dynamique de la toolbar selon la config
// VERSION: 1.0 - Création initiale
// ============================================

import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Settings } from "lucide-react";

import { ResolvedToolbarItem, ResolvedTool } from "./useToolbarConfig";
import { ToolbarGroup } from "./toolbar-types";

// ============================================
// PROPS
// ============================================

interface ToolbarRendererProps {
  // Outils résolus à afficher
  items: ResolvedToolbarItem[];

  // Fonction de rendu pour chaque outil (fournie par CADGabaritCanvas)
  renderTool: (toolId: string) => React.ReactNode;

  // Bouton pour ouvrir l'éditeur
  onOpenEditor?: () => void;

  // Afficher le bouton d'édition
  showEditButton?: boolean;

  // Classes CSS additionnelles
  className?: string;
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function ToolbarRenderer({
  items,
  renderTool,
  onOpenEditor,
  showEditButton = true,
  className = "",
}: ToolbarRendererProps) {
  // Rendu d'un groupe
  const renderGroup = useCallback(
    (item: ResolvedToolbarItem) => {
      if (!item.group || !item.tools) return null;

      return (
        <div
          key={item.id}
          className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm"
          style={{
            borderLeft: `3px solid ${item.group.color || "#3B82F6"}`,
          }}
        >
          {item.tools.map((tool) => (
            <React.Fragment key={tool.id}>{renderTool(tool.id)}</React.Fragment>
          ))}
        </div>
      );
    },
    [renderTool]
  );

  // Rendu d'un outil individuel
  const renderSingleTool = useCallback(
    (item: ResolvedToolbarItem) => {
      return (
        <div key={item.id} className="flex items-center">
          {renderTool(item.id)}
        </div>
      );
    },
    [renderTool]
  );

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          {item.type === "group" ? renderGroup(item) : renderSingleTool(item)}
          {/* Séparateur entre les groupes/outils (sauf le dernier) */}
          {index < items.length - 1 && item.type === "group" && (
            <Separator orientation="vertical" className="h-6" />
          )}
        </React.Fragment>
      ))}

      {/* Bouton pour ouvrir l'éditeur */}
      {showEditButton && onOpenEditor && (
        <>
          <div className="flex-1" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onOpenEditor}
                  className="h-8 w-8 p-0"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Configurer la toolbar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </>
      )}
    </div>
  );
}

// ============================================
// COMPOSANT: ToolbarGroupBadge
// Badge affichant le nom du groupe (optionnel)
// ============================================

interface ToolbarGroupBadgeProps {
  group: ToolbarGroup;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ToolbarGroupBadge({
  group,
  collapsed = false,
  onToggleCollapse,
}: ToolbarGroupBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="cursor-pointer text-xs px-1.5 py-0"
            style={{
              borderColor: group.color,
              color: group.color,
            }}
            onClick={onToggleCollapse}
          >
            {collapsed ? `${group.name} (${group.items.length})` : group.name}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{collapsed ? "Déplier le groupe" : "Replier le groupe"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ToolbarRenderer;
