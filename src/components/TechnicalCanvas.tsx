// ============================================
// TechnicalCanvas.tsx
// Schéma électrique interactif avec ReactFlow
// VERSION: 3.65 - Badge de section sur chaque câble du circuit survolé
// ============================================

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  NodeProps,
  Handle,
  Position,
  MarkerType,
  Panel,
  ConnectionMode,
  EdgeProps,
  getSmoothStepPath,
  BaseEdge,
  EdgeLabelRenderer,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Pencil,
  Square,
  Circle as CircleIcon,
  Type,
  Minus,
  ArrowRight,
  Trash2,
  Undo,
  Redo,
  Download,
  Save,
  X,
  Maximize2,
  Minimize2,
  Sun,
  Battery,
  Zap,
  Plug,
  Cable,
  Gauge,
  Lightbulb,
  Fan,
  Refrigerator,
  Waves,
  Loader2,
  Boxes,
  PenTool,
  Plus,
  Search,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  AlignCenterHorizontal,
  AlignCenterVertical,
  Copy,
  Clipboard,
  Grid3X3,
  StickyNote,
  LayoutTemplate,
  FileDown,
  Shield,
  Ruler,
  Calculator,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { AccessorySelector } from "./AccessorySelector";
import { SchemaLayersPanel, SchemaLayer, createDefaultLayer } from "./SchemaLayersPanel";
import paper from "paper";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/utils";

// Nouveaux composants
import { SchemaExport } from "./SchemaExport";
import { SchemaValidation, useSchemaValidation } from "./SchemaValidation";
import { SchemaLegend } from "./SchemaLegend";
import { SchemaTemplates } from "./SchemaTemplates";
import { SchemaAnnotationsLayer, Annotation, createAnnotation } from "./SchemaAnnotations";
import { useSchemaHistory, SchemaState } from "@/hooks/useSchemaHistory";
import { useCableCalculator, quickCableSection, STANDARD_SECTIONS } from "@/hooks/useCableCalculator";

// Utilitaire debounce
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 🔥 Fonction pour décoder les entités HTML
const decodeHtmlEntities = (text: string | null | undefined): string => {
  if (!text) return "";
  const doc = new DOMParser().parseFromString(text, "text/html");
  return doc.documentElement.textContent || text;
};

interface TechnicalCanvasProps {
  projectId: string;
  onExpenseAdded?: () => void;
}

interface CanvasInstanceProps {
  projectId: string;
  schemaNumber: number;
  onExpenseAdded?: () => void;
  onSchemaDeleted?: () => void;
}

// ============================================
// TYPES POUR LE MODE BLOCS
// ============================================

interface ElectricalItem {
  id: string;
  nom_accessoire: string;
  type_electrique: string;
  quantite: number;
  puissance_watts?: number | null;
  intensite_amperes?: number | null;
  capacite_ah?: number | null;
  tension_volts?: number | null; // Tension unique (ancien champ, pour rétrocompatibilité)
  tension_entree_volts?: number | null; // Tension d'entrée (ex: 24V côté panneau du MPPT)
  tension_sortie_volts?: number | null; // Tension de sortie (ex: 12V côté batterie du MPPT)
  marque?: string | null;
  prix_unitaire?: number | null;
  image_url?: string | null; // URL de l'image du produit
  layerId?: string; // ID du calque auquel appartient l'élément
  accessory_id?: string | null; // ID de l'accessoire du catalogue (pour rafraîchir les données)
  distributeur_pair_id?: string | null; // ID du distributeur couplé (ex: Busbar+ ↔ Busbar-)
  distributeur_polarite?: string | null; // Polarité du distributeur (+, -)
}

// Configuration des handles par bloc
interface BlockHandles {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// Numéros de circuit par handle (ex: {"top-1": 1, "bottom-2": 2})
interface HandleCircuits {
  [handleId: string]: number | undefined;
}

// Type de flux sur un handle
type HandleFluxType = "production" | "consommation" | "stockage" | "neutre";

// Types de flux par handle (ex: {"top-1": "production", "bottom-2": "consommation"})
interface HandleFluxTypes {
  [handleId: string]: HandleFluxType | undefined;
}

const DEFAULT_HANDLES: BlockHandles = { top: 2, bottom: 2, left: 2, right: 2 };

// Types considérés comme points de distribution (somme des puissances connectées)
const DISTRIBUTION_POINT_TYPES = [
  "busbar",
  "bus_bar",
  "bus-bar",
  "repartiteur",
  "répartiteur",
  "repartiteur_dc",
  "bornier",
  "terminal_block",
  "distribution",
  "panneau_distribution",
];

// Types "transparents" - on traverse sans s'arrêter pour le calcul de longueur
// Ces éléments ne coupent pas le circuit, ils sont juste des protections en série
const TRANSPARENT_TYPES = [
  "fusible",
  "fuse",
  "porte_fusible",
  "porte-fusible",
  "porte fusible",
  "fuse_holder",
  "coupe_circuit",
  "coupe-circuit",
  "coupe circuit",
  "disjoncteur",
  "breaker",
  "interrupteur",
  "switch",
  "sectionneur",
  "boitier_fusible",
  "boitier-fusible",
  "boîtier_fusible",
  "boitier fusible",
  "fuse_box",
  "fusebox",
];

// Types qui convertissent la tension (ont une tension entrée différente de sortie)
const VOLTAGE_CONVERTER_TYPES = [
  "mppt",
  "regulateur_mppt",
  "regulateur",
  "convertisseur",
  "dc_dc",
  "dcdc",
  "dc-dc",
  "onduleur",
  "inverter",
  "chargeur",
  "charger",
  "combi",
  "combiné",
  "multiplus",
];

interface SchemaEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle?: string | null;
  target_handle?: string | null;
  color?: string;
  label?: string;
  strokeWidth?: number;
  section?: string; // Section de câble ex: "2.5mm²", "6mm²" (texte affiché)
  length_m?: number; // Longueur du câble en mètres
  section_mm2?: number; // Section calculée en mm²
  bridge?: boolean; // Pont pour passer au-dessus des autres câbles
  layerId?: string; // ID du calque auquel appartient le câble
  circuitId?: string; // ID du circuit auquel appartient le câble
}

// Interface pour les circuits définis
interface ElectricalCircuit {
  id: string;
  name: string;
  sourceNodeId: string;
  destNodeId: string;
  edgeIds: string[];
  power: number;
}

// Sections de câble courantes
const CABLE_SECTIONS = [
  "0.5mm²",
  "0.75mm²",
  "1mm²",
  "1.5mm²",
  "2.5mm²",
  "4mm²",
  "6mm²",
  "10mm²",
  "16mm²",
  "25mm²",
  "35mm²",
  "50mm²",
];

// Épaisseurs de trait
const STROKE_WIDTHS = [
  { value: 1, label: "Fin" },
  { value: 2, label: "Normal" },
  { value: 3, label: "Moyen" },
  { value: 4, label: "Épais" },
  { value: 6, label: "Très épais" },
];

// Configuration des types électriques
const ELECTRICAL_TYPES: Record<
  string,
  {
    label: string;
    icon: any;
    color: string;
    bgColor: string;
    borderColor: string;
    category:
      | "production"
      | "stockage"
      | "regulation"
      | "conversion"
      | "consommateur"
      | "distribution"
      | "protection"
      | "distributeur"
      | "neutre";
  }
> = {
  // Types principaux
  panneau: {
    label: "Panneau solaire",
    icon: Sun,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-400",
    category: "production",
  },
  batterie: {
    label: "Batterie",
    icon: Battery,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-400",
    category: "stockage",
  },
  regulateur: {
    label: "Régulateur MPPT",
    icon: Gauge,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-400",
    category: "regulation",
  },
  convertisseur: {
    label: "Convertisseur",
    icon: Zap,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-400",
    category: "conversion",
  },
  chargeur: {
    label: "Chargeur 230V",
    icon: Plug,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-400",
    category: "production",
  },
  consommateur: {
    label: "Consommateur",
    icon: Lightbulb,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-400",
    category: "consommateur",
  },
  eclairage: {
    label: "Éclairage",
    icon: Lightbulb,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-400",
    category: "consommateur",
  },
  ventilation: {
    label: "Ventilation",
    icon: Fan,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-400",
    category: "consommateur",
  },
  refrigeration: {
    label: "Réfrigération",
    icon: Refrigerator,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-400",
    category: "consommateur",
  },
  pompe: {
    label: "Pompe à eau",
    icon: Waves,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-400",
    category: "consommateur",
  },
  distribution: {
    label: "Distribution",
    icon: Cable,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-400",
    category: "distribution",
  },
  // Type neutre (porte-fusibles, borniers, etc.)
  neutre: {
    label: "Accessoire",
    icon: Cable,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-300",
    category: "neutre",
  },
  accessoire: {
    label: "Accessoire",
    icon: Cable,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-300",
    category: "neutre",
  },
  fusible: {
    label: "Fusible",
    icon: Cable,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-300",
    category: "neutre",
  },
  // ========== PROTECTIONS (transparentes dans le calcul) ==========
  protection: {
    label: "Protection",
    icon: Shield,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-400",
    category: "protection",
  },
  coupe_circuit: {
    label: "Coupe-circuit",
    icon: Shield,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-400",
    category: "protection",
  },
  disjoncteur: {
    label: "Disjoncteur",
    icon: Shield,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-400",
    category: "protection",
  },
  porte_fusible: {
    label: "Porte-fusible",
    icon: Shield,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-400",
    category: "protection",
  },
  interrupteur: {
    label: "Interrupteur",
    icon: Shield,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-400",
    category: "protection",
  },
  sectionneur: {
    label: "Sectionneur",
    icon: Shield,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-400",
    category: "protection",
  },
  // ========== DISTRIBUTEURS (points clés + couplage +/-) ==========
  distributeur: {
    label: "Distributeur",
    icon: Boxes,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-400",
    category: "distributeur",
  },
  busbar: {
    label: "Busbar",
    icon: Boxes,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-400",
    category: "distributeur",
  },
  repartiteur: {
    label: "Répartiteur",
    icon: Boxes,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-400",
    category: "distributeur",
  },
  bornier: {
    label: "Bornier",
    icon: Boxes,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-400",
    category: "distributeur",
  },
  boitier_fusible: {
    label: "Boîtier fusibles",
    icon: Boxes,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-400",
    category: "distributeur",
  },
  // Alias (pour compatibilité avec les valeurs existantes en base)
  producteur: {
    label: "Producteur",
    icon: Sun,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-400",
    category: "production",
  },
  stockage: {
    label: "Stockage",
    icon: Battery,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-400",
    category: "stockage",
  },
};

// Couleurs des câbles
const CABLE_COLORS = [
  { value: "#ef4444", label: "Rouge (+)" },
  { value: "#3b82f6", label: "Bleu (-)" },
  { value: "#000000", label: "Noir (masse)" },
  { value: "#22c55e", label: "Vert (terre)" },
  { value: "#f97316", label: "Orange" },
  { value: "#a855f7", label: "Violet" },
];

// ============================================
// COMPOSANT BLOC ÉLECTRIQUE (pour ReactFlow)
// ============================================

const ElectricalBlockNode = ({ data, selected }: NodeProps) => {
  const item = data.item as ElectricalItem;
  const handles = (data.handles as BlockHandles) || DEFAULT_HANDLES;
  const handleCircuits = (data.handleCircuits as HandleCircuits) || {};
  const handleFluxTypes = (data.handleFluxTypes as HandleFluxTypes) || {};
  const isLocked = data.isLocked as boolean | undefined;
  const onUpdateHandles = data.onUpdateHandles as ((nodeId: string, handles: BlockHandles) => void) | undefined;
  const onUpdateHandleCircuit = data.onUpdateHandleCircuit as
    | ((nodeId: string, handleId: string, circuitNum: number | undefined) => void)
    | undefined;
  const onUpdateHandleFluxType = data.onUpdateHandleFluxType as
    | ((nodeId: string, handleId: string, fluxType: HandleFluxType | undefined) => void)
    | undefined;
  const onDeleteItem = data.onDeleteItem as ((nodeId: string) => void) | undefined;
  const onEditItem = data.onEditItem as ((item: ElectricalItem) => void) | undefined;

  // State pour l'édition du numéro de circuit et du type de flux
  const [editingHandle, setEditingHandle] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editFluxType, setEditFluxType] = useState<HandleFluxType>("neutre");

  if (!item) return null;

  const typeConfig = ELECTRICAL_TYPES[item.type_electrique] || ELECTRICAL_TYPES.consommateur;
  const IconComponent = typeConfig.icon;

  // Gérer le double-clic sur un handle pour éditer le numéro
  const handleDoubleClick = (handleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    setEditingHandle(handleId);
    setEditValue(handleCircuits[handleId]?.toString() || "");
    setEditFluxType(handleFluxTypes[handleId] || "neutre");
  };

  // Sauvegarder le numéro de circuit et le type de flux
  const saveCircuitNumber = () => {
    if (editingHandle) {
      if (onUpdateHandleCircuit) {
        const num = editValue ? parseInt(editValue, 10) : undefined;
        onUpdateHandleCircuit(item.id, editingHandle, isNaN(num as number) ? undefined : num);
      }
      if (onUpdateHandleFluxType) {
        onUpdateHandleFluxType(item.id, editingHandle, editFluxType === "neutre" ? undefined : editFluxType);
      }
    }
    setEditingHandle(null);
    setEditValue("");
    setEditFluxType("neutre");
  };

  // Générer les handles pour un côté
  const generateHandles = (
    side: "top" | "bottom" | "left" | "right",
    count: number,
    type: "source" | "target",
    position: Position,
  ) => {
    const isHorizontal = side === "top" || side === "bottom";

    return Array.from({ length: count }, (_, i) => {
      const handleId = `${side}-${i + 1}`;
      const circuitNum = handleCircuits[handleId];
      const fluxType = handleFluxTypes[handleId];

      // Couleur basée sur le type de flux (si défini)
      let handleColor = type === "source" ? "!bg-green-500" : "!bg-blue-500";
      if (fluxType === "production") handleColor = "!bg-emerald-500";
      else if (fluxType === "consommation") handleColor = "!bg-red-500";
      else if (fluxType === "stockage") handleColor = "!bg-amber-500";

      // Répartir les handles uniformément (éviter les bords)
      const percent = count === 1 ? 50 : 15 + i * (70 / Math.max(count - 1, 1));

      // Style avec centrage correct (translate pour compenser le décalage)
      const style = isHorizontal
        ? { left: `${percent}%`, transform: "translateX(-50%)" }
        : { top: `${percent}%`, transform: "translateY(-50%)" };

      // Position du badge/popover
      const badgeStyle: React.CSSProperties = isHorizontal
        ? {
            left: `${percent}%`,
            transform: "translateX(-50%)",
            ...(side === "top" ? { top: "-18px" } : { bottom: "-18px" }),
          }
        : {
            top: `${percent}%`,
            transform: "translateY(-50%)",
            ...(side === "left" ? { left: "-18px" } : { right: "-18px" }),
          };

      // Position du popover étendu (plus bas pour avoir la place)
      const popoverStyle: React.CSSProperties = isHorizontal
        ? {
            left: `${percent}%`,
            transform: "translateX(-50%)",
            ...(side === "top" ? { top: "-85px" } : { bottom: "-85px" }),
          }
        : {
            top: `${percent}%`,
            transform: "translateY(-50%)",
            ...(side === "left" ? { left: "-120px" } : { right: "-120px" }),
          };

      // Icône pour le type de flux
      const getFluxIcon = (ft: HandleFluxType | undefined) => {
        if (ft === "production") return "🔋";
        if (ft === "consommation") return "💡";
        if (ft === "stockage") return "🔌";
        return "";
      };

      return (
        <React.Fragment key={handleId}>
          <Handle
            type={type}
            position={position}
            id={handleId}
            className={`${handleColor} !w-2 !h-2 !border-2 !border-white`}
            style={style}
            onDoubleClick={(e) => handleDoubleClick(handleId, e)}
          />
          {/* Popover d'édition étendu */}
          {editingHandle === handleId ? (
            <div
              className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[110px]"
              style={popoverStyle}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Numéro de circuit */}
              <div className="flex items-center gap-1 mb-2">
                <span className="text-[10px] text-gray-500">N°:</span>
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveCircuitNumber();
                    if (e.key === "Escape") {
                      setEditingHandle(null);
                      setEditValue("");
                      setEditFluxType("neutre");
                    }
                  }}
                  autoFocus
                  className="w-10 h-5 text-[10px] text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min="1"
                  max="99"
                />
              </div>
              {/* Type de flux */}
              <div className="space-y-0.5">
                <div className="text-[9px] text-gray-500 mb-1">Type de flux:</div>
                {(["production", "consommation", "stockage", "neutre"] as HandleFluxType[]).map((ft) => (
                  <label key={ft} className="flex items-center gap-1 cursor-pointer hover:bg-gray-50 rounded px-1">
                    <input
                      type="radio"
                      name={`flux-${handleId}`}
                      checked={editFluxType === ft}
                      onChange={() => setEditFluxType(ft)}
                      className="w-2.5 h-2.5"
                    />
                    <span className="text-[9px]">
                      {ft === "production" && "🔋 Prod."}
                      {ft === "consommation" && "💡 Conso."}
                      {ft === "stockage" && "🔌 Stock."}
                      {ft === "neutre" && "⚪ Neutre"}
                    </span>
                  </label>
                ))}
              </div>
              {/* Bouton OK */}
              <button
                onClick={saveCircuitNumber}
                className="mt-2 w-full text-[10px] bg-blue-500 text-white rounded py-0.5 hover:bg-blue-600"
              >
                OK
              </button>
            </div>
          ) : circuitNum !== undefined || fluxType ? (
            <div
              className={`absolute z-20 flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-bold rounded-full cursor-pointer hover:opacity-80 ${
                fluxType === "production"
                  ? "bg-emerald-100 border border-emerald-400 text-emerald-700"
                  : fluxType === "consommation"
                    ? "bg-red-100 border border-red-400 text-red-700"
                    : fluxType === "stockage"
                      ? "bg-amber-100 border border-amber-400 text-amber-700"
                      : "bg-gray-100 border border-gray-400 text-gray-700"
              }`}
              style={badgeStyle}
              onDoubleClick={(e) => handleDoubleClick(handleId, e)}
              title={`${circuitNum ? `Circuit ${circuitNum}` : ""} ${fluxType ? `(${fluxType})` : ""} - Double-clic pour modifier`}
            >
              {getFluxIcon(fluxType)}
              {circuitNum !== undefined && <span>{circuitNum}</span>}
            </div>
          ) : null}
        </React.Fragment>
      );
    });
  };

  // Contrôle discret pour ajuster les handles (petit badge avec compteur)
  const HandleControl = ({ side }: { side: "top" | "bottom" | "left" | "right" }) => {
    if (!selected || !onUpdateHandles || isLocked) return null;

    const currentCount = handles[side];
    const isHorizontal = side === "top" || side === "bottom";

    const positionClasses: Record<string, string> = {
      top: "-top-6 left-1/2 -translate-x-1/2",
      bottom: "-bottom-6 left-1/2 -translate-x-1/2",
      left: "top-1/2 -left-6 -translate-y-1/2",
      right: "top-1/2 -right-6 -translate-y-1/2",
    };

    return (
      <div
        className={`absolute ${positionClasses[side]} flex ${isHorizontal ? "flex-row" : "flex-col"} items-center bg-white/95 rounded-full shadow-sm border border-gray-200 text-[10px] z-10`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
          onClick={(e) => {
            e.stopPropagation();
            if (currentCount > 1) onUpdateHandles(item.id, { ...handles, [side]: currentCount - 1 });
          }}
          disabled={currentCount <= 1}
        >
          −
        </button>
        <span className="w-3 text-center font-medium text-gray-600">{currentCount}</span>
        <button
          className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
          onClick={(e) => {
            e.stopPropagation();
            if (currentCount < 8) onUpdateHandles(item.id, { ...handles, [side]: currentCount + 1 });
          }}
          disabled={currentCount >= 8}
        >
          +
        </button>
      </div>
    );
  };

  return (
    <div
      className={`rounded-lg border-2 shadow-lg group relative ${selected ? "ring-2 ring-blue-500 shadow-xl" : ""} ${typeConfig.bgColor} ${typeConfig.borderColor}`}
      style={{ minWidth: 200, maxWidth: 280 }}
    >
      {/* Handles d'entrée (bleus) - top et left */}
      {generateHandles("top", handles.top, "target", Position.Top)}
      {generateHandles("left", handles.left, "target", Position.Left)}

      {/* Contrôles pour ajuster les handles (visibles quand sélectionné) */}
      <HandleControl side="top" />
      <HandleControl side="bottom" />
      <HandleControl side="left" />
      <HandleControl side="right" />

      {/* Boutons d'action (visibles quand sélectionné et non verrouillé) */}
      {selected && !isLocked && (
        <div className="absolute -top-2 -right-2 flex gap-1 z-20">
          {/* Bouton éditer */}
          {onEditItem && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditItem(item);
              }}
              className="w-5 h-5 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
              title="Modifier les propriétés"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>
          )}
          {/* Bouton supprimer */}
          {onDeleteItem && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteItem(item.id);
              }}
              className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md transition-colors"
              title="Supprimer du schéma"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Indicateur de verrouillage */}
      {isLocked && (
        <div
          className="absolute -top-2 -left-2 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-md z-20"
          title="Calque verrouillé"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}

      <div className={`flex items-center gap-2 px-3 py-2 border-b ${typeConfig.borderColor} bg-white/60 rounded-t-lg`}>
        <IconComponent className={`h-5 w-5 ${typeConfig.color} shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{decodeHtmlEntities(item.nom_accessoire)}</div>
          {item.marque && <div className="text-xs text-gray-500 truncate">{item.marque}</div>}
        </div>
        {/* Miniature de l'image si disponible */}
        {item.image_url && (
          <img
            src={item.image_url}
            alt=""
            className="w-9 h-9 rounded-md object-cover border border-gray-200 shrink-0"
            onError={(e) => {
              // Masquer l'image si elle ne charge pas
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <Badge variant="outline" className={`text-xs ${typeConfig.color} border-current shrink-0`}>
          x{item.quantite}
        </Badge>
      </div>

      <div className="p-3 space-y-1.5">
        {item.puissance_watts && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Puissance</span>
            <span className="font-medium text-gray-900">{item.puissance_watts} W</span>
          </div>
        )}
        {/* Capacité uniquement pour les batteries/stockage */}
        {item.capacite_ah && ["stockage", "batterie"].includes(item.type_electrique?.toLowerCase() || "") && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Capacité</span>
            <span className="font-medium text-gray-900">{item.capacite_ah} Ah</span>
          </div>
        )}
        {/* Affichage tension entrée/sortie pour les convertisseurs */}
        {item.tension_entree_volts || item.tension_sortie_volts ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Tension</span>
            <span className="font-medium text-gray-900">
              {item.tension_entree_volts &&
              item.tension_sortie_volts &&
              item.tension_entree_volts !== item.tension_sortie_volts ? (
                <>
                  {item.tension_entree_volts}V → {item.tension_sortie_volts}V
                </>
              ) : (
                <>{item.tension_entree_volts || item.tension_sortie_volts} V</>
              )}
            </span>
          </div>
        ) : (
          item.tension_volts && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Tension</span>
              <span className="font-medium text-gray-900">{item.tension_volts} V</span>
            </div>
          )
        )}
        {item.intensite_amperes && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Intensité</span>
            <span className="font-medium text-gray-900">{item.intensite_amperes} A</span>
          </div>
        )}
        {item.quantite > 1 && item.puissance_watts && (
          <div className="flex items-center justify-between text-xs bg-white/50 rounded px-2 py-1 mt-2">
            <span className="text-gray-600">Total</span>
            <span className="font-bold text-gray-900">{item.puissance_watts * item.quantite} W</span>
          </div>
        )}
      </div>

      <div className="px-3 pb-2 flex items-center gap-1">
        <Badge className={`text-xs ${typeConfig.bgColor} ${typeConfig.color} border ${typeConfig.borderColor}`}>
          {typeConfig.label}
        </Badge>
      </div>

      {/* Handles de sortie (verts) - bottom et right */}
      {generateHandles("bottom", handles.bottom, "source", Position.Bottom)}
      {generateHandles("right", handles.right, "source", Position.Right)}
    </div>
  );
};

const blockNodeTypes = { electricalBlock: ElectricalBlockNode };

// ============================================
// EDGE PERSONNALISÉ - Virage près du bloc le plus petit (corrigé)
// ============================================

const CustomSmoothEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  label,
  labelStyle,
  labelBgStyle,
  data,
}: EdgeProps) => {
  // Récupérer si on doit faire le virage près de la target (bloc plus petit)
  const turnNearTarget = (data as any)?.turnNearTarget ?? false;
  // Récupérer les autres nodes pour le contournement
  const allNodes = (data as any)?.allNodes || [];
  // Récupérer si ce câble est survolé dans le popover
  const isHovered = (data as any)?.isHovered ?? false;
  // Récupérer la section du câble
  const section = (data as any)?.section ?? null;

  // Distance minimale avant le premier virage (sortie perpendiculaire)
  const minExitDistance = 40; // Distance avant le premier coude
  const cornerRadius = 8;
  const nodeMargin = 30; // Marge autour des blocs pour le contournement

  // Calculer les distances
  const deltaX = Math.abs(targetX - sourceX);
  const deltaY = Math.abs(targetY - sourceY);

  // Seuil pour considérer les points comme alignés
  const alignmentThreshold = 5;

  // Fonction pour obtenir la bounding box d'un node avec marge
  const getNodeBounds = (node: any) => {
    const width = node.width || 200;
    const height = node.height || 150;
    return {
      left: node.position.x - nodeMargin,
      right: node.position.x + width + nodeMargin,
      top: node.position.y - nodeMargin,
      bottom: node.position.y + height + nodeMargin,
      centerY: node.position.y + height / 2,
      centerX: node.position.x + width / 2,
    };
  };

  // Fonction pour vérifier si un point est dans une bounding box
  const isPointInBounds = (x: number, y: number, bounds: any) => {
    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  };

  // Fonction pour trouver les obstacles sur le chemin horizontal
  const findObstaclesOnHorizontalPath = (y: number, fromX: number, toX: number) => {
    const minX = Math.min(fromX, toX);
    const maxX = Math.max(fromX, toX);

    return allNodes
      .filter((node: any) => {
        if (node.hidden) return false;
        const bounds = getNodeBounds(node);
        // Le chemin horizontal à y traverse-t-il ce bloc ?
        return y >= bounds.top && y <= bounds.bottom && bounds.right > minX && bounds.left < maxX;
      })
      .map((node: any) => getNodeBounds(node));
  };

  // Fonction pour trouver les obstacles sur le chemin vertical
  const findObstaclesOnVerticalPath = (x: number, fromY: number, toY: number) => {
    const minY = Math.min(fromY, toY);
    const maxY = Math.max(fromY, toY);

    return allNodes
      .filter((node: any) => {
        if (node.hidden) return false;
        const bounds = getNodeBounds(node);
        // Le chemin vertical à x traverse-t-il ce bloc ?
        return x >= bounds.left && x <= bounds.right && bounds.bottom > minY && bounds.top < maxY;
      })
      .map((node: any) => getNodeBounds(node));
  };

  // Fonction pour calculer le meilleur Y de contournement
  const findBypassY = (obstacles: any[], preferredY: number, sourceY: number, targetY: number) => {
    if (obstacles.length === 0) return preferredY;

    // Trouver le bloc le plus problématique
    let topmost = Math.min(...obstacles.map((o: any) => o.top));
    let bottommost = Math.max(...obstacles.map((o: any) => o.bottom));

    // Décider si contourner par le haut ou le bas
    const goAbove = Math.abs(topmost - preferredY) < Math.abs(bottommost - preferredY);

    if (goAbove) {
      return topmost - 10; // Passer au-dessus
    } else {
      return bottommost + 10; // Passer en-dessous
    }
  };

  // Fonction pour calculer le meilleur X de contournement
  const findBypassX = (obstacles: any[], preferredX: number, sourceX: number, targetX: number) => {
    if (obstacles.length === 0) return preferredX;

    let leftmost = Math.min(...obstacles.map((o: any) => o.left));
    let rightmost = Math.max(...obstacles.map((o: any) => o.right));

    const goLeft = Math.abs(leftmost - preferredX) < Math.abs(rightmost - preferredX);

    if (goLeft) {
      return leftmost - 10;
    } else {
      return rightmost + 10;
    }
  };

  let edgePath: string;
  // Position du label - sera calculée pour être au milieu du câble
  let labelX: number = (sourceX + targetX) / 2;
  let labelY: number = (sourceY + targetY) / 2;

  // Helper pour calculer le milieu d'un chemin en 3 segments
  const calcMidpoint3Segments = (
    seg1: number,
    seg2: number,
    seg3: number,
    startX: number,
    startY: number,
    midX: number,
    midY: number,
    endX: number,
    endY: number,
    isFirstHorizontal: boolean,
  ) => {
    const totalLength = seg1 + seg2 + seg3;
    const halfLength = totalLength / 2;

    if (halfLength <= seg1) {
      if (isFirstHorizontal) {
        return { x: startX + (startX < midX ? halfLength : -halfLength), y: startY };
      } else {
        return { x: startX, y: startY + (startY < midY ? halfLength : -halfLength) };
      }
    } else if (halfLength <= seg1 + seg2) {
      const dist = halfLength - seg1;
      if (isFirstHorizontal) {
        return { x: midX, y: midY + (midY < endY ? dist : -dist) };
      } else {
        return { x: midX + (midX < endX ? dist : -dist), y: midY };
      }
    } else {
      const dist = halfLength - seg1 - seg2;
      if (isFirstHorizontal) {
        return { x: midX + (midX < endX ? dist : -dist), y: endY };
      } else {
        return { x: endX, y: midY + (midY < endY ? dist : -dist) };
      }
    }
  };

  // Si presque aligné horizontalement → ligne droite (mais vérifier obstacles)
  if (deltaY < alignmentThreshold) {
    // Vérifier s'il y a des obstacles sur le chemin horizontal direct
    const obstacles = findObstaclesOnHorizontalPath(sourceY, sourceX, targetX);
    if (obstacles.length === 0) {
      edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
      labelX = (sourceX + targetX) / 2;
      labelY = sourceY;
    } else {
      // Contourner par le haut ou le bas
      const bypassY = findBypassY(obstacles, sourceY, sourceY, targetY);
      const r = cornerRadius;
      const goingDown = bypassY > sourceY;
      edgePath = `M ${sourceX} ${sourceY} 
                  L ${sourceX + minExitDistance - r} ${sourceY}
                  Q ${sourceX + minExitDistance} ${sourceY} ${sourceX + minExitDistance} ${sourceY + (goingDown ? r : -r)}
                  L ${sourceX + minExitDistance} ${bypassY + (goingDown ? -r : r)}
                  Q ${sourceX + minExitDistance} ${bypassY} ${sourceX + minExitDistance + r} ${bypassY}
                  L ${targetX - minExitDistance - r} ${bypassY}
                  Q ${targetX - minExitDistance} ${bypassY} ${targetX - minExitDistance} ${bypassY + (goingDown ? -r : r)}
                  L ${targetX - minExitDistance} ${targetY + (goingDown ? -r : r)}
                  Q ${targetX - minExitDistance} ${targetY} ${targetX - minExitDistance + r} ${targetY}
                  L ${targetX} ${targetY}`;
      labelX = (sourceX + targetX) / 2;
      labelY = bypassY;
    }
  }
  // Si presque aligné verticalement → ligne droite (mais vérifier obstacles)
  else if (deltaX < alignmentThreshold) {
    const obstacles = findObstaclesOnVerticalPath(sourceX, sourceY, targetY);
    if (obstacles.length === 0) {
      edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
      labelX = sourceX;
      labelY = (sourceY + targetY) / 2;
    } else {
      // Contourner par la gauche ou la droite
      const bypassX = findBypassX(obstacles, sourceX, sourceX, targetX);
      const r = cornerRadius;
      const goingRight = bypassX > sourceX;
      edgePath = `M ${sourceX} ${sourceY} 
                  L ${sourceX} ${sourceY + minExitDistance - r}
                  Q ${sourceX} ${sourceY + minExitDistance} ${sourceX + (goingRight ? r : -r)} ${sourceY + minExitDistance}
                  L ${bypassX + (goingRight ? -r : r)} ${sourceY + minExitDistance}
                  Q ${bypassX} ${sourceY + minExitDistance} ${bypassX} ${sourceY + minExitDistance + r}
                  L ${bypassX} ${targetY - minExitDistance - r}
                  Q ${bypassX} ${targetY - minExitDistance} ${bypassX + (goingRight ? -r : r)} ${targetY - minExitDistance}
                  L ${targetX + (goingRight ? -r : r)} ${targetY - minExitDistance}
                  Q ${targetX} ${targetY - minExitDistance} ${targetX} ${targetY - minExitDistance + r}
                  L ${targetX} ${targetY}`;
      labelX = bypassX;
      labelY = (sourceY + targetY) / 2;
    }
  }
  // Connexion horizontale RIGHT → LEFT
  else if (sourcePosition === Position.Right && (targetPosition === Position.Left || !targetPosition)) {
    // Calculer la distance de sortie (au moins minExitDistance, ou mi-chemin si proche)
    const availableSpace = targetX - sourceX;
    const exitDist = Math.min(minExitDistance, availableSpace / 3);
    const entryDist = Math.min(minExitDistance, availableSpace / 3);

    // Point de virage au milieu ou selon turnNearTarget
    let midX = turnNearTarget ? targetX - entryDist : sourceX + exitDist;

    // Vérifier s'il y a des obstacles sur le segment vertical
    const obstaclesOnVertical = findObstaclesOnVerticalPath(
      midX,
      Math.min(sourceY, targetY),
      Math.max(sourceY, targetY),
    );

    if (obstaclesOnVertical.length > 0) {
      // Trouver un X qui contourne les obstacles
      midX = findBypassX(obstaclesOnVertical, midX, sourceX, targetX);
    }

    const goingDown = targetY > sourceY;
    const r = Math.min(cornerRadius, deltaY / 4, exitDist / 2);

    edgePath = `M ${sourceX} ${sourceY} 
                L ${midX - r} ${sourceY}
                Q ${midX} ${sourceY} ${midX} ${sourceY + (goingDown ? r : -r)}
                L ${midX} ${targetY + (goingDown ? -r : r)}
                Q ${midX} ${targetY} ${midX + r} ${targetY}
                L ${targetX} ${targetY}`;

    const seg1 = Math.abs(midX - sourceX);
    const seg2 = Math.abs(targetY - sourceY);
    const seg3 = Math.abs(targetX - midX);
    const mid = calcMidpoint3Segments(seg1, seg2, seg3, sourceX, sourceY, midX, sourceY, targetX, targetY, true);
    labelX = mid.x;
    labelY = mid.y;
  }
  // Connexion verticale BOTTOM → TOP
  else if (sourcePosition === Position.Bottom && (targetPosition === Position.Top || !targetPosition)) {
    const availableSpace = targetY - sourceY;
    const exitDist = Math.min(minExitDistance, availableSpace / 3);
    const entryDist = Math.min(minExitDistance, availableSpace / 3);

    let midY = turnNearTarget ? targetY - entryDist : sourceY + exitDist;

    // Vérifier s'il y a des obstacles sur le segment horizontal
    const obstaclesOnHorizontal = findObstaclesOnHorizontalPath(
      midY,
      Math.min(sourceX, targetX),
      Math.max(sourceX, targetX),
    );

    if (obstaclesOnHorizontal.length > 0) {
      // Trouver un Y qui contourne les obstacles
      midY = findBypassY(obstaclesOnHorizontal, midY, sourceY, targetY);
    }

    const goingRight = targetX > sourceX;
    const r = Math.min(cornerRadius, deltaX / 4, exitDist / 2);

    edgePath = `M ${sourceX} ${sourceY} 
                L ${sourceX} ${midY - r}
                Q ${sourceX} ${midY} ${sourceX + (goingRight ? r : -r)} ${midY}
                L ${targetX + (goingRight ? -r : r)} ${midY}
                Q ${targetX} ${midY} ${targetX} ${midY + r}
                L ${targetX} ${targetY}`;

    const seg1 = Math.abs(midY - sourceY);
    const seg2 = Math.abs(targetX - sourceX);
    const seg3 = Math.abs(targetY - midY);
    const mid = calcMidpoint3Segments(seg1, seg2, seg3, sourceX, sourceY, sourceX, midY, targetX, targetY, false);
    labelX = mid.x;
    labelY = mid.y;
  }
  // Connexion BOTTOM → LEFT (coude en L)
  else if (sourcePosition === Position.Bottom && targetPosition === Position.Left) {
    // Sortir d'abord vers le bas, puis tourner vers la gauche
    const exitDist = Math.min(minExitDistance, Math.abs(targetY - sourceY) / 2);
    const midY = Math.max(sourceY + exitDist, targetY);

    const r = Math.min(cornerRadius, Math.abs(targetX - sourceX) / 4, exitDist / 2);

    if (midY >= targetY - r) {
      // Simple L : descendre puis aller à gauche
      edgePath = `M ${sourceX} ${sourceY} 
                  L ${sourceX} ${targetY - r}
                  Q ${sourceX} ${targetY} ${sourceX + (targetX > sourceX ? r : -r)} ${targetY}
                  L ${targetX} ${targetY}`;

      const seg1 = Math.abs(targetY - sourceY);
      const seg2 = Math.abs(targetX - sourceX);
      const halfLength = (seg1 + seg2) / 2;
      if (halfLength <= seg1) {
        labelX = sourceX;
        labelY = sourceY + halfLength;
      } else {
        labelX = sourceX + (targetX > sourceX ? 1 : -1) * (halfLength - seg1);
        labelY = targetY;
      }
    } else {
      // S inversé : descendre, aller horizontalement, puis remonter/descendre
      edgePath = `M ${sourceX} ${sourceY} 
                  L ${sourceX} ${midY - r}
                  Q ${sourceX} ${midY} ${sourceX + (targetX > sourceX ? r : -r)} ${midY}
                  L ${targetX - r} ${midY}
                  Q ${targetX} ${midY} ${targetX} ${midY + (targetY > midY ? r : -r)}
                  L ${targetX} ${targetY}`;

      const seg1 = midY - sourceY;
      const seg2 = Math.abs(targetX - sourceX);
      const seg3 = Math.abs(targetY - midY);
      const mid = calcMidpoint3Segments(seg1, seg2, seg3, sourceX, sourceY, sourceX, midY, targetX, targetY, false);
      labelX = mid.x;
      labelY = mid.y;
    }
  }
  // Connexion RIGHT → TOP
  else if (sourcePosition === Position.Right && targetPosition === Position.Top) {
    const exitDist = Math.min(minExitDistance, Math.abs(targetX - sourceX) / 2);
    const midX = Math.max(sourceX + exitDist, targetX);

    const r = Math.min(cornerRadius, Math.abs(targetY - sourceY) / 4, exitDist / 2);

    if (midX >= targetX - r) {
      // Simple L : aller à droite puis descendre/monter
      edgePath = `M ${sourceX} ${sourceY} 
                  L ${targetX - r} ${sourceY}
                  Q ${targetX} ${sourceY} ${targetX} ${sourceY + (targetY > sourceY ? r : -r)}
                  L ${targetX} ${targetY}`;

      const seg1 = Math.abs(targetX - sourceX);
      const seg2 = Math.abs(targetY - sourceY);
      const halfLength = (seg1 + seg2) / 2;
      if (halfLength <= seg1) {
        labelX = sourceX + halfLength;
        labelY = sourceY;
      } else {
        labelX = targetX;
        labelY = sourceY + (targetY > sourceY ? 1 : -1) * (halfLength - seg1);
      }
    } else {
      edgePath = `M ${sourceX} ${sourceY} 
                  L ${midX - r} ${sourceY}
                  Q ${midX} ${sourceY} ${midX} ${sourceY + (targetY > sourceY ? r : -r)}
                  L ${midX} ${targetY - r}
                  Q ${midX} ${targetY} ${midX + (targetX > midX ? r : -r)} ${targetY}
                  L ${targetX} ${targetY}`;

      const seg1 = midX - sourceX;
      const seg2 = Math.abs(targetY - sourceY);
      const seg3 = Math.abs(targetX - midX);
      const mid = calcMidpoint3Segments(seg1, seg2, seg3, sourceX, sourceY, midX, sourceY, targetX, targetY, true);
      labelX = mid.x;
      labelY = mid.y;
    }
  }
  // Connexion RIGHT → BOTTOM (source droite, target en bas)
  else if (sourcePosition === Position.Right && targetPosition === Position.Bottom) {
    const exitDist = Math.min(minExitDistance, deltaX / 2);
    const r = Math.min(cornerRadius, deltaY / 4, exitDist / 2);

    // Aller à droite, puis descendre vers la target
    const midX = sourceX + exitDist;

    edgePath = `M ${sourceX} ${sourceY} 
                L ${midX - r} ${sourceY}
                Q ${midX} ${sourceY} ${midX} ${sourceY + (targetY > sourceY ? r : -r)}
                L ${midX} ${targetY + (targetY > sourceY ? -r : r)}
                Q ${midX} ${targetY} ${midX + r} ${targetY}
                L ${targetX} ${targetY}`;

    const seg1 = midX - sourceX;
    const seg2 = Math.abs(targetY - sourceY);
    const seg3 = targetX - midX;
    const mid = calcMidpoint3Segments(seg1, seg2, seg3, sourceX, sourceY, midX, sourceY, targetX, targetY, true);
    labelX = mid.x;
    labelY = mid.y;
  }
  // Connexion LEFT → RIGHT
  else if (sourcePosition === Position.Left && targetPosition === Position.Right) {
    // Source à gauche, target à droite - le câble doit contourner
    const exitDist = minExitDistance;
    const r = Math.min(cornerRadius, deltaY / 4);

    // Sortir vers la gauche de la source
    const leftX = Math.min(sourceX - exitDist, targetX + exitDist);
    const goingDown = targetY > sourceY;

    edgePath = `M ${sourceX} ${sourceY}
                L ${leftX + r} ${sourceY}
                Q ${leftX} ${sourceY} ${leftX} ${sourceY + (goingDown ? r : -r)}
                L ${leftX} ${targetY + (goingDown ? -r : r)}
                Q ${leftX} ${targetY} ${leftX + r} ${targetY}
                L ${targetX} ${targetY}`;

    const seg1 = sourceX - leftX;
    const seg2 = Math.abs(targetY - sourceY);
    const seg3 = targetX - leftX;
    const totalLength = seg1 + seg2 + seg3;
    const halfLength = totalLength / 2;

    if (halfLength <= seg1) {
      labelX = sourceX - halfLength;
      labelY = sourceY;
    } else if (halfLength <= seg1 + seg2) {
      labelX = leftX;
      labelY = goingDown ? sourceY + (halfLength - seg1) : sourceY - (halfLength - seg1);
    } else {
      labelX = leftX + (halfLength - seg1 - seg2);
      labelY = targetY;
    }
  }
  // Connexion TOP → BOTTOM
  else if (sourcePosition === Position.Top && targetPosition === Position.Bottom) {
    const exitDist = minExitDistance;
    const r = Math.min(cornerRadius, deltaX / 4);

    const topY = Math.min(sourceY - exitDist, targetY + exitDist);
    const goingRight = targetX > sourceX;

    edgePath = `M ${sourceX} ${sourceY}
                L ${sourceX} ${topY + r}
                Q ${sourceX} ${topY} ${sourceX + (goingRight ? r : -r)} ${topY}
                L ${targetX + (goingRight ? -r : r)} ${topY}
                Q ${targetX} ${topY} ${targetX} ${topY + r}
                L ${targetX} ${targetY}`;

    const seg1 = sourceY - topY;
    const seg2 = Math.abs(targetX - sourceX);
    const seg3 = targetY - topY;
    const totalLength = seg1 + seg2 + seg3;
    const halfLength = totalLength / 2;

    if (halfLength <= seg1) {
      labelX = sourceX;
      labelY = sourceY - halfLength;
    } else if (halfLength <= seg1 + seg2) {
      labelX = goingRight ? sourceX + (halfLength - seg1) : sourceX - (halfLength - seg1);
      labelY = topY;
    } else {
      labelX = targetX;
      labelY = topY + (halfLength - seg1 - seg2);
    }
  }
  // Autres cas → utiliser getSmoothStepPath natif avec offset
  else {
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: cornerRadius,
      offset: minExitDistance, // Ajouter un offset pour sortir perpendiculairement
    });
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      {/* Badge de section au survol */}
      {isHovered && section && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
              padding: "6px 12px",
              borderRadius: 20,
              fontSize: 14,
              fontWeight: 800,
              backgroundColor: "#10b981",
              color: "white",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.5)",
              border: "3px solid white",
              zIndex: 1001,
            }}
            className="nodrag nopan"
          >
            {section}mm²
          </div>
        </EdgeLabelRenderer>
      )}
      {/* Label normal (masqué au survol pour éviter superposition) */}
      {label && !isHovered && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              // Décaler le label au-dessus du trait (-15px vertical)
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 8}px)`,
              pointerEvents: "all",
              ...labelBgStyle,
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              zIndex: 1,
              ...(labelStyle as React.CSSProperties),
            }}
            className="nodrag nopan"
          >
            {label as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const edgeTypes = { customSmooth: CustomSmoothEdge };

// ============================================
// COMPOSANT MODE BLOCS
// ============================================

interface BlocksInstanceProps {
  projectId: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const BlocksInstance = ({ projectId, isFullscreen, onToggleFullscreen }: BlocksInstanceProps) => {
  const [items, setItems] = useState<ElectricalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [principalScenarioId, setPrincipalScenarioId] = useState<string | null>(null);
  const [edges, setEdges] = useState<SchemaEdge[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredCircuitEdgeIds, setHoveredCircuitEdgeIds] = useState<string[]>([]); // Pour grossir tout le circuit au survol dans le popover

  // État pour les handles personnalisés par bloc
  const [nodeHandles, setNodeHandles] = useState<Record<string, BlockHandles>>({});

  // État pour les numéros de circuit par handle (ex: {"node1": {"top-1": 1, "bottom-2": 2}})
  const [nodeHandleCircuits, setNodeHandleCircuits] = useState<Record<string, HandleCircuits>>({});

  // État pour les types de flux par handle (ex: {"node1": {"top-1": "production", "bottom-2": "consommation"}})
  const [nodeHandleFluxTypes, setNodeHandleFluxTypes] = useState<Record<string, HandleFluxTypes>>({});

  // États pour les calques
  const [layers, setLayers] = useState<SchemaLayer[]>([createDefaultLayer()]);
  const [activeLayerId, setActiveLayerId] = useState<string>("layer-default");
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);

  // Gérer le changement de calques (avec déplacement des éléments si suppression)
  const handleLayersChange = useCallback(
    (newLayers: SchemaLayer[]) => {
      // Trouver les calques supprimés
      const removedLayerIds = layers.filter((l) => !newLayers.find((nl) => nl.id === l.id)).map((l) => l.id);

      if (removedLayerIds.length > 0) {
        // Trouver le premier calque restant pour y déplacer les éléments
        const targetLayerId = newLayers[0]?.id || "layer-default";

        // Déplacer les items des calques supprimés
        setItems((prev) =>
          prev.map((item) => {
            if (item.layerId && removedLayerIds.includes(item.layerId)) {
              return { ...item, layerId: targetLayerId };
            }
            return item;
          }),
        );

        // Déplacer les edges des calques supprimés
        setEdges((prev) =>
          prev.map((edge) => {
            if (edge.layerId && removedLayerIds.includes(edge.layerId)) {
              return { ...edge, layerId: targetLayerId };
            }
            return edge;
          }),
        );
      }

      setLayers(newLayers);
    },
    [layers],
  );

  // États pour le sélecteur catalogue
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);

  // États pour le sélecteur scénario
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [scenarioItems, setScenarioItems] = useState<any[]>([]);
  const [scenarioSearch, setScenarioSearch] = useState("");
  const [scenarioLoading, setScenarioLoading] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);

  // Ref pour ReactFlow (export, etc.)
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // === NOUVEAUX ÉTATS ===

  // Export
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Templates
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [templatesMode, setTemplatesMode] = useState<"save" | "load">("load");

  // Annotations
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);

  // Grille magnétique
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);

  // Légende
  const [showLegend, setShowLegend] = useState(true);

  // Validation
  const [showValidation, setShowValidation] = useState(false);

  // Copier/Coller
  const [clipboard, setClipboard] = useState<{
    nodes: any[];
    edges: SchemaEdge[];
  } | null>(null);

  // Viewport actuel (pour les annotations et calculs de position)
  const [currentViewport, setCurrentViewport] = useState({ x: 0, y: 0, zoom: 1 });

  // Mode définition de circuit
  const [isDefiningCircuit, setIsDefiningCircuit] = useState(false);
  const [circuitSource, setCircuitSource] = useState<string | null>(null);
  const [circuitDest, setCircuitDest] = useState<string | null>(null);

  // Circuits définis (stocke les associations câbles → circuit)
  const [circuits, setCircuits] = useState<Record<string, ElectricalCircuit>>({});

  // Hook calcul câble
  const { calculateCable, quickCalculate } = useCableCalculator({ defaultVoltage: 12 });

  // ============================================
  // UNDO/REDO - Historique des modifications
  // ============================================
  const [historyStack, setHistoryStack] = useState<SchemaState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedoAction, setIsUndoRedoAction] = useState(false);
  const maxHistorySize = 50;

  // Sauvegarder l'état actuel dans l'historique
  const saveToHistory = useCallback(
    (action: string = "edit") => {
      if (isUndoRedoAction) return; // Ne pas sauvegarder pendant un undo/redo

      const currentState: SchemaState = {
        items: JSON.parse(JSON.stringify(items)),
        edges: JSON.parse(JSON.stringify(edges)),
        positions: nodes.reduce(
          (acc, node) => {
            acc[node.id] = { x: node.position.x, y: node.position.y };
            return acc;
          },
          {} as Record<string, { x: number; y: number }>,
        ),
        nodeHandles: JSON.parse(JSON.stringify(nodeHandles)),
        annotations: JSON.parse(JSON.stringify(annotations)),
      };

      setHistoryStack((prev) => {
        // Si on n'est pas à la fin de l'historique, supprimer les états futurs
        const newStack = prev.slice(0, historyIndex + 1);
        newStack.push(currentState);

        // Limiter la taille de l'historique
        if (newStack.length > maxHistorySize) {
          return newStack.slice(-maxHistorySize);
        }
        return newStack;
      });

      setHistoryIndex((prev) => Math.min(prev + 1, maxHistorySize - 1));
    },
    [items, edges, nodes, nodeHandles, annotations, historyIndex, isUndoRedoAction],
  );

  // Debounce pour éviter trop de sauvegardes
  const saveToHistoryRef = useRef(saveToHistory);
  saveToHistoryRef.current = saveToHistory;

  const debouncedSaveToHistory = useCallback(
    debounce((action: string) => saveToHistoryRef.current(action), 500),
    [],
  );

  // Initialiser l'historique quand le chargement est terminé
  useEffect(() => {
    if (!loading && (items.length > 0 || edges.length > 0) && historyIndex === -1) {
      // Premier état après chargement
      const initialState: SchemaState = {
        items: JSON.parse(JSON.stringify(items)),
        edges: JSON.parse(JSON.stringify(edges)),
        positions: nodes.reduce(
          (acc, node) => {
            acc[node.id] = { x: node.position.x, y: node.position.y };
            return acc;
          },
          {} as Record<string, { x: number; y: number }>,
        ),
        nodeHandles: JSON.parse(JSON.stringify(nodeHandles)),
        annotations: JSON.parse(JSON.stringify(annotations)),
      };
      setHistoryStack([initialState]);
      setHistoryIndex(0);
      console.log("[History] Historique initialisé avec l'état actuel");
    }
  }, [loading, items.length, edges.length]);

  // Sauvegarder quand items ou edges changent (après initialisation)
  useEffect(() => {
    // Ne pas sauvegarder pendant le chargement ou si historique pas initialisé
    if (loading || historyIndex === -1) return;
    if (isUndoRedoAction) return;

    if (items.length > 0 || edges.length > 0) {
      debouncedSaveToHistory("edit");
    }
  }, [items, edges, loading, historyIndex, isUndoRedoAction]);

  // Undo - Annuler
  const handleUndoBlocs = useCallback(() => {
    if (historyIndex <= 0) {
      toast.info("Rien à annuler");
      return;
    }

    setIsUndoRedoAction(true);
    const prevState = historyStack[historyIndex - 1];

    if (prevState) {
      setItems(prevState.items);
      setEdges(prevState.edges);
      setNodeHandles(prevState.nodeHandles);
      if (prevState.annotations) setAnnotations(prevState.annotations);

      // Restaurer les positions des nodes
      setNodes((prev) =>
        prev.map((node) => {
          const pos = prevState.positions[node.id];
          if (pos) {
            return { ...node, position: pos };
          }
          return node;
        }),
      );

      setHistoryIndex((prev) => prev - 1);
      toast.success("Action annulée");
    }

    setTimeout(() => setIsUndoRedoAction(false), 100);
  }, [historyIndex, historyStack, setNodes]);

  // Redo - Refaire
  const handleRedoBlocs = useCallback(() => {
    if (historyIndex >= historyStack.length - 1) {
      toast.info("Rien à refaire");
      return;
    }

    setIsUndoRedoAction(true);
    const nextState = historyStack[historyIndex + 1];

    if (nextState) {
      setItems(nextState.items);
      setEdges(nextState.edges);
      setNodeHandles(nextState.nodeHandles);
      if (nextState.annotations) setAnnotations(nextState.annotations);

      // Restaurer les positions des nodes
      setNodes((prev) =>
        prev.map((node) => {
          const pos = nextState.positions[node.id];
          if (pos) {
            return { ...node, position: pos };
          }
          return node;
        }),
      );

      setHistoryIndex((prev) => prev + 1);
      toast.success("Action refaite");
    }

    setTimeout(() => setIsUndoRedoAction(false), 100);
  }, [historyIndex, historyStack, setNodes]);

  // Raccourcis clavier Ctrl+Z / Ctrl+Y pour le mode Blocs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on est dans un input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndoBlocs();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")
      ) {
        e.preventDefault();
        handleRedoBlocs();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndoBlocs, handleRedoBlocs]);

  // Peut-on undo/redo ?
  const canUndoBlocs = historyIndex > 0;
  const canRedoBlocs = historyIndex < historyStack.length - 1;

  // ============================================

  // Obtenir les nodes sélectionnés
  const selectedNodes = nodes.filter((n) => n.selected);

  // Obtenir la hauteur réelle d'un node (mesurée par ReactFlow ou via DOM)
  const getNodeHeight = useCallback(
    (node: Node): number => {
      // Méthode 1: ReactFlow v11+ mesure les dimensions dans node.measured
      const measured = (node as any).measured;
      if (measured?.height) {
        return measured.height;
      }

      // Méthode 2: Certaines versions stockent dans node.height directement
      if ((node as any).height) {
        return (node as any).height;
      }

      // Méthode 3: Essayer de lire depuis le DOM
      const domNode = document.querySelector(`[data-id="${node.id}"]`);
      if (domNode) {
        const rect = domNode.getBoundingClientRect();
        if (rect.height > 0) {
          return rect.height;
        }
      }

      // Fallback: estimer la hauteur basée sur le contenu
      const item = items.find((i) => i.id === node.id);
      if (!item) return 130; // hauteur par défaut plus réaliste

      let height = 52; // header minimal
      if (item.puissance_watts) height += 24;
      if (item.capacite_ah) height += 24;
      if (item.tension_volts) height += 24;
      if (item.intensite_amperes) height += 24;
      if (item.quantite > 1 && item.puissance_watts) height += 28;
      height += 44; // badge + padding

      return height;
    },
    [items],
  );

  // Obtenir la largeur réelle d'un node
  const getNodeWidth = useCallback((node: Node): number => {
    const measured = (node as any).measured;
    if (measured?.width) {
      return measured.width;
    }
    if ((node as any).width) {
      return (node as any).width;
    }
    const domNode = document.querySelector(`[data-id="${node.id}"]`);
    if (domNode) {
      const rect = domNode.getBoundingClientRect();
      if (rect.width > 0) {
        return rect.width;
      }
    }
    return 240;
  }, []);

  // Espacement entre les blocs
  const BLOCK_SPACING_H = 50;
  const BLOCK_SPACING_V = 30;
  const CABLE_CLEARANCE = 40; // Espace minimum entre un bloc et un câble

  // Fonction pour calculer la bounding box approximative d'un câble
  const getCableBoundingBox = (edge: SchemaEdge): { minY: number; maxY: number; minX: number; maxX: number } | null => {
    const sourceNode = nodes.find((n) => n.id === edge.source_node_id);
    const targetNode = nodes.find((n) => n.id === edge.target_node_id);

    if (!sourceNode || !targetNode) return null;

    const sourceHeight = getNodeHeight(sourceNode);
    const sourceWidth = getNodeWidth(sourceNode);
    const targetHeight = getNodeHeight(targetNode);
    const targetWidth = getNodeWidth(targetNode);

    // Calculer les positions des handles
    let sourceY = sourceNode.position.y + sourceHeight / 2;
    let sourceX = sourceNode.position.x + sourceWidth;
    let targetY = targetNode.position.y + targetHeight / 2;
    let targetX = targetNode.position.x;

    // Ajuster selon le handle source
    if (edge.source_handle) {
      const match = edge.source_handle.match(/^(top|bottom|left|right)-(\d+)$/);
      if (match) {
        const side = match[1];
        const handleIndex = parseInt(match[2], 10);
        const handles = nodeHandles[sourceNode.id] || DEFAULT_HANDLES;
        const count = handles[side as keyof BlockHandles] || 1;
        const percent = count === 1 ? 50 : 15 + (handleIndex - 1) * (70 / Math.max(count - 1, 1));

        if (side === "right") {
          sourceY = sourceNode.position.y + (percent / 100) * sourceHeight;
          sourceX = sourceNode.position.x + sourceWidth;
        } else if (side === "left") {
          sourceY = sourceNode.position.y + (percent / 100) * sourceHeight;
          sourceX = sourceNode.position.x;
        } else if (side === "bottom") {
          sourceX = sourceNode.position.x + (percent / 100) * sourceWidth;
          sourceY = sourceNode.position.y + sourceHeight;
        } else if (side === "top") {
          sourceX = sourceNode.position.x + (percent / 100) * sourceWidth;
          sourceY = sourceNode.position.y;
        }
      }
    }

    // Ajuster selon le handle target
    if (edge.target_handle) {
      const match = edge.target_handle.match(/^(top|bottom|left|right)-(\d+)$/);
      if (match) {
        const side = match[1];
        const handleIndex = parseInt(match[2], 10);
        const handles = nodeHandles[targetNode.id] || DEFAULT_HANDLES;
        const count = handles[side as keyof BlockHandles] || 1;
        const percent = count === 1 ? 50 : 15 + (handleIndex - 1) * (70 / Math.max(count - 1, 1));

        if (side === "left") {
          targetY = targetNode.position.y + (percent / 100) * targetHeight;
          targetX = targetNode.position.x;
        } else if (side === "right") {
          targetY = targetNode.position.y + (percent / 100) * targetHeight;
          targetX = targetNode.position.x + targetWidth;
        } else if (side === "top") {
          targetX = targetNode.position.x + (percent / 100) * targetWidth;
          targetY = targetNode.position.y;
        } else if (side === "bottom") {
          targetX = targetNode.position.x + (percent / 100) * targetWidth;
          targetY = targetNode.position.y + targetHeight;
        }
      }
    }

    return {
      minY: Math.min(sourceY, targetY) - CABLE_CLEARANCE,
      maxY: Math.max(sourceY, targetY) + CABLE_CLEARANCE,
      minX: Math.min(sourceX, targetX),
      maxX: Math.max(sourceX, targetX),
    };
  };

  // Fonction pour aligner les nodes sélectionnés horizontalement
  const alignNodesHorizontally = useCallback(() => {
    if (selectedNodes.length < 2) return;

    // Trier par position X (gauche à droite)
    const sortedNodes = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
    const selectedIds = new Set(selectedNodes.map((n) => n.id));

    // Trouver les connexions entre les blocs sélectionnés
    const connectionsBetweenSelected = edges.filter(
      (e) => selectedIds.has(e.source_node_id) && selectedIds.has(e.target_node_id),
    );

    // Trouver les câbles "obstacles" (câbles qui ne sont pas entre blocs sélectionnés mais qui passent dans la zone)
    const obstacleCables = edges.filter((e) => {
      // Exclure les câbles entre blocs sélectionnés
      if (selectedIds.has(e.source_node_id) && selectedIds.has(e.target_node_id)) return false;
      // Garder les câbles qui ont au moins un endpoint dans un bloc non-sélectionné
      return !selectedIds.has(e.source_node_id) || !selectedIds.has(e.target_node_id);
    });

    // Construire un graphe des connexions pour aligner en chaîne
    const newPositions: Record<string, number> = {};

    // Le premier bloc (le plus à gauche) garde sa position Y
    const firstNode = sortedNodes[0];
    newPositions[firstNode.id] = firstNode.position.y;

    // Fonction pour calculer la position Y absolue d'un handle
    const getHandleAbsoluteY = (nodeId: string, handleId: string | null, nodeY: number): number => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return nodeY;

      const nodeHeight = getNodeHeight(node);

      if (!handleId) {
        return nodeY + nodeHeight / 2;
      }

      const match = handleId.match(/^(top|bottom|left|right)-(\d+)$/);
      if (!match) {
        return nodeY + nodeHeight / 2;
      }

      const side = match[1];
      const handleIndex = parseInt(match[2], 10);

      if (side === "top" || side === "bottom") {
        return nodeY + nodeHeight / 2;
      }

      const handles = nodeHandles[nodeId] || DEFAULT_HANDLES;
      const count = handles[side as keyof BlockHandles] || 1;
      const percent = count === 1 ? 50 : 15 + (handleIndex - 1) * (70 / Math.max(count - 1, 1));

      return nodeY + (percent / 100) * nodeHeight;
    };

    // Parcourir les blocs de gauche à droite et aligner en chaîne
    for (let i = 1; i < sortedNodes.length; i++) {
      const currentNode = sortedNodes[i];

      // Chercher une connexion entrante depuis un bloc déjà positionné
      const incomingConnection = connectionsBetweenSelected.find(
        (e) => e.target_node_id === currentNode.id && newPositions[e.source_node_id] !== undefined,
      );

      let targetY: number;

      if (incomingConnection) {
        // Aligner sur le handle de la connexion
        const sourceNode = nodes.find((n) => n.id === incomingConnection.source_node_id);
        if (sourceNode) {
          const sourceY = newPositions[incomingConnection.source_node_id];
          const sourceHandleY = getHandleAbsoluteY(
            incomingConnection.source_node_id,
            incomingConnection.source_handle,
            sourceY,
          );

          // Calculer où doit être le nœud courant pour que son handle target soit aligné
          const currentHeight = getNodeHeight(currentNode);
          const targetHandleId = incomingConnection.target_handle;

          let targetHandlePercent = 50;
          if (targetHandleId) {
            const match = targetHandleId.match(/^(top|bottom|left|right)-(\d+)$/);
            if (match && (match[1] === "left" || match[1] === "right")) {
              const side = match[1];
              const handleIndex = parseInt(match[2], 10);
              const handles = nodeHandles[currentNode.id] || DEFAULT_HANDLES;
              const count = handles[side as keyof BlockHandles] || 1;
              targetHandlePercent = count === 1 ? 50 : 15 + (handleIndex - 1) * (70 / Math.max(count - 1, 1));
            }
          }

          const targetHandleOffset = (targetHandlePercent / 100) * currentHeight;
          targetY = sourceHandleY - targetHandleOffset;
        } else {
          // Fallback: utiliser le centre
          const prevNode = sortedNodes[i - 1];
          const prevY = newPositions[prevNode.id] ?? prevNode.position.y;
          const prevHeight = getNodeHeight(prevNode);
          const currentHeight = getNodeHeight(currentNode);
          targetY = prevY + (prevHeight - currentHeight) / 2;
        }
      } else {
        // Pas de connexion directe, aligner sur le centre du bloc précédent
        const prevNode = sortedNodes[i - 1];
        const prevY = newPositions[prevNode.id] ?? prevNode.position.y;
        const prevHeight = getNodeHeight(prevNode);
        const currentHeight = getNodeHeight(currentNode);
        targetY = prevY + (prevHeight - currentHeight) / 2;
      }

      // Vérifier si cette position entre en collision avec des câbles obstacles
      const currentHeight = getNodeHeight(currentNode);
      const currentWidth = getNodeWidth(currentNode);
      const blockMinY = targetY;
      const blockMaxY = targetY + currentHeight;
      const blockMinX = currentNode.position.x;
      const blockMaxX = currentNode.position.x + currentWidth;

      for (const cable of obstacleCables) {
        const cableBbox = getCableBoundingBox(cable);
        if (!cableBbox) continue;

        // Vérifier si le câble passe dans la zone horizontale du bloc
        const horizontalOverlap = blockMinX < cableBbox.maxX && blockMaxX > cableBbox.minX;

        if (horizontalOverlap) {
          // Vérifier si le bloc va croiser le câble
          const verticalOverlap = blockMinY < cableBbox.maxY && blockMaxY > cableBbox.minY;

          if (verticalOverlap) {
            // Collision détectée ! Déplacer le bloc au-dessus ou en-dessous du câble
            const distanceToGoAbove = cableBbox.minY - blockMaxY;
            const distanceToGoBelow = cableBbox.maxY - blockMinY;

            if (Math.abs(distanceToGoAbove) < Math.abs(distanceToGoBelow)) {
              // Aller au-dessus
              targetY = cableBbox.minY - currentHeight - CABLE_CLEARANCE;
            } else {
              // Aller en-dessous
              targetY = cableBbox.maxY + CABLE_CLEARANCE;
            }
          }
        }
      }

      newPositions[currentNode.id] = targetY;
    }

    // Appliquer les nouvelles positions
    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected && newPositions[n.id] !== undefined) {
          const item = items.find((i) => i.id === n.id);
          const itemLayerId = item?.layerId || "layer-default";
          const layer = layers.find((l) => l.id === itemLayerId);
          if (layer?.locked) return n;

          return { ...n, position: { ...n.position, y: newPositions[n.id] } };
        }
        return n;
      }),
    );

    toast.success(`${selectedNodes.length} blocs alignés horizontalement`);
  }, [selectedNodes, setNodes, items, layers, edges, nodeHandles, nodes, getNodeHeight]);

  // Fonction pour aligner les nodes sélectionnés verticalement (sur les handles connectés)
  const alignNodesVertically = useCallback(() => {
    if (selectedNodes.length < 2) return;

    // Trier par position Y (haut en bas)
    const sortedNodes = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
    const selectedIds = new Set(selectedNodes.map((n) => n.id));

    // Trouver les connexions entre les blocs sélectionnés
    const connectionsBetweenSelected = edges.filter(
      (e) => selectedIds.has(e.source_node_id) && selectedIds.has(e.target_node_id),
    );

    // Construire les nouvelles positions X
    const newPositions: Record<string, number> = {};

    // Le premier bloc (le plus en haut) garde sa position X
    const firstNode = sortedNodes[0];
    newPositions[firstNode.id] = firstNode.position.x;

    // Fonction pour calculer la position X absolue d'un handle
    const getHandleAbsoluteX = (nodeId: string, handleId: string | null, nodeX: number): number => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return nodeX;

      const nodeWidth = getNodeWidth(node);

      if (!handleId) {
        return nodeX + nodeWidth / 2;
      }

      const match = handleId.match(/^(top|bottom|left|right)-(\d+)$/);
      if (!match) {
        return nodeX + nodeWidth / 2;
      }

      const side = match[1];
      const handleIndex = parseInt(match[2], 10);

      // Pour les handles verticaux (left/right), on utilise le centre horizontal
      if (side === "left" || side === "right") {
        return nodeX + nodeWidth / 2;
      }

      // Pour les handles horizontaux (top/bottom), calculer la position X
      const handles = nodeHandles[nodeId] || DEFAULT_HANDLES;
      const count = handles[side as keyof BlockHandles] || 1;
      const percent = count === 1 ? 50 : 15 + (handleIndex - 1) * (70 / Math.max(count - 1, 1));

      return nodeX + (percent / 100) * nodeWidth;
    };

    // Parcourir les blocs de haut en bas et aligner en chaîne
    for (let i = 1; i < sortedNodes.length; i++) {
      const currentNode = sortedNodes[i];

      // Chercher une connexion entrante depuis un bloc déjà positionné
      const incomingConnection = connectionsBetweenSelected.find(
        (e) => e.target_node_id === currentNode.id && newPositions[e.source_node_id] !== undefined,
      );

      let targetX: number;

      if (incomingConnection) {
        // Aligner sur le handle de la connexion
        const sourceNode = nodes.find((n) => n.id === incomingConnection.source_node_id);
        if (sourceNode) {
          const sourceX = newPositions[incomingConnection.source_node_id];
          const sourceHandleX = getHandleAbsoluteX(
            incomingConnection.source_node_id,
            incomingConnection.source_handle,
            sourceX,
          );

          // Calculer où doit être le nœud courant pour que son handle target soit aligné
          const currentWidth = getNodeWidth(currentNode);
          const targetHandleId = incomingConnection.target_handle;

          let targetHandlePercent = 50;
          if (targetHandleId) {
            const match = targetHandleId.match(/^(top|bottom|left|right)-(\d+)$/);
            if (match && (match[1] === "top" || match[1] === "bottom")) {
              const side = match[1];
              const handleIndex = parseInt(match[2], 10);
              const handles = nodeHandles[currentNode.id] || DEFAULT_HANDLES;
              const count = handles[side as keyof BlockHandles] || 1;
              targetHandlePercent = count === 1 ? 50 : 15 + (handleIndex - 1) * (70 / Math.max(count - 1, 1));
            }
          }

          const targetHandleOffset = (targetHandlePercent / 100) * currentWidth;
          targetX = sourceHandleX - targetHandleOffset;
        } else {
          // Fallback: utiliser le centre
          const prevNode = sortedNodes[i - 1];
          const prevX = newPositions[prevNode.id] ?? prevNode.position.x;
          const prevWidth = getNodeWidth(prevNode);
          const currentWidth = getNodeWidth(currentNode);
          targetX = prevX + (prevWidth - currentWidth) / 2;
        }
      } else {
        // Pas de connexion directe, aligner sur le centre du bloc précédent
        const prevNode = sortedNodes[i - 1];
        const prevX = newPositions[prevNode.id] ?? prevNode.position.x;
        const prevWidth = getNodeWidth(prevNode);
        const currentWidth = getNodeWidth(currentNode);
        targetX = prevX + (prevWidth - currentWidth) / 2;
      }

      newPositions[currentNode.id] = targetX;
    }

    // Appliquer les nouvelles positions
    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected && newPositions[n.id] !== undefined) {
          const item = items.find((i) => i.id === n.id);
          const itemLayerId = item?.layerId || "layer-default";
          const layer = layers.find((l) => l.id === itemLayerId);
          if (layer?.locked) return n;

          return { ...n, position: { ...n.position, x: newPositions[n.id] } };
        }
        return n;
      }),
    );

    toast.success(`${selectedNodes.length} blocs alignés verticalement`);
  }, [selectedNodes, setNodes, items, layers, edges, nodeHandles, nodes, getNodeWidth]);

  // Fonction pour distribuer les nodes horizontalement (espacement égal)
  const distributeNodesHorizontally = useCallback(() => {
    if (selectedNodes.length < 3) return;

    // Trier par position X
    const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);

    // Le premier et le dernier bloc restent en place
    const firstNode = sorted[0];
    const lastNode = sorted[sorted.length - 1];
    const firstWidth = getNodeWidth(firstNode);

    // Position de départ (bord droit du premier bloc) et position de fin (bord gauche du dernier)
    const startX = firstNode.position.x + firstWidth;
    const endX = lastNode.position.x;

    // Calculer la largeur totale des blocs intermédiaires
    let totalMiddleWidth = 0;
    for (let i = 1; i < sorted.length - 1; i++) {
      totalMiddleWidth += getNodeWidth(sorted[i]);
    }

    // Espace total disponible pour les gaps (entre les blocs)
    // Il y a (n-1) gaps pour n blocs
    const totalSpace = endX - startX;
    const numGaps = sorted.length - 1;
    const totalGapSpace = totalSpace - totalMiddleWidth;
    const gapSize = totalGapSpace / numGaps;

    // Pré-calculer toutes les nouvelles positions X
    const newPositionsX: Record<string, number> = {};
    let currentX = startX + gapSize;

    for (let i = 1; i < sorted.length - 1; i++) {
      newPositionsX[sorted[i].id] = currentX;
      currentX += getNodeWidth(sorted[i]) + gapSize;
    }

    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected && newPositionsX[n.id] !== undefined) {
          const item = items.find((i) => i.id === n.id);
          const itemLayerId = item?.layerId || "layer-default";
          const layer = layers.find((l) => l.id === itemLayerId);
          if (layer?.locked) return n;

          return { ...n, position: { ...n.position, x: newPositionsX[n.id] } };
        }
        return n;
      }),
    );
    toast.success(`${selectedNodes.length} blocs distribués horizontalement`);
  }, [selectedNodes, setNodes, items, layers, getNodeWidth]);

  // Fonction pour distribuer les nodes verticalement (espacement égal)
  const distributeNodesVertically = useCallback(() => {
    if (selectedNodes.length < 3) return;

    // Trier par position Y
    const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);

    // Le premier et le dernier bloc restent en place
    const firstNode = sorted[0];
    const lastNode = sorted[sorted.length - 1];
    const firstHeight = getNodeHeight(firstNode);

    // Position de départ (bord bas du premier bloc) et position de fin (bord haut du dernier)
    const startY = firstNode.position.y + firstHeight;
    const endY = lastNode.position.y;

    // Calculer la hauteur totale des blocs intermédiaires
    let totalMiddleHeight = 0;
    for (let i = 1; i < sorted.length - 1; i++) {
      totalMiddleHeight += getNodeHeight(sorted[i]);
    }

    // Espace total disponible pour les gaps
    const totalSpace = endY - startY;
    const numGaps = sorted.length - 1;
    const totalGapSpace = totalSpace - totalMiddleHeight;
    const gapSize = totalGapSpace / numGaps;

    // Pré-calculer toutes les nouvelles positions Y
    const newPositionsY: Record<string, number> = {};
    let currentY = startY + gapSize;

    for (let i = 1; i < sorted.length - 1; i++) {
      newPositionsY[sorted[i].id] = currentY;
      currentY += getNodeHeight(sorted[i]) + gapSize;
    }

    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected && newPositionsY[n.id] !== undefined) {
          const item = items.find((i) => i.id === n.id);
          const itemLayerId = item?.layerId || "layer-default";
          const layer = layers.find((l) => l.id === itemLayerId);
          if (layer?.locked) return n;

          return { ...n, position: { ...n.position, y: newPositionsY[n.id] } };
        }
        return n;
      }),
    );
    toast.success(`${selectedNodes.length} blocs distribués verticalement`);
  }, [selectedNodes, setNodes, items, layers, getNodeHeight]);

  // Fonction pour mettre à jour les handles d'un bloc
  const updateNodeHandles = useCallback((nodeId: string, handles: BlockHandles) => {
    setNodeHandles((prev) => ({ ...prev, [nodeId]: handles }));
  }, []);

  // Fonction pour mettre à jour le numéro de circuit d'un handle
  const updateHandleCircuit = useCallback((nodeId: string, handleId: string, circuitNum: number | undefined) => {
    setNodeHandleCircuits((prev) => {
      const nodeCircuits = prev[nodeId] || {};
      if (circuitNum === undefined) {
        // Supprimer le numéro
        const { [handleId]: _, ...rest } = nodeCircuits;
        return { ...prev, [nodeId]: rest };
      }
      return { ...prev, [nodeId]: { ...nodeCircuits, [handleId]: circuitNum } };
    });
  }, []);

  // Mettre à jour le type de flux d'un handle
  const updateHandleFluxType = useCallback((nodeId: string, handleId: string, fluxType: HandleFluxType | undefined) => {
    setNodeHandleFluxTypes((prev) => {
      const nodeFluxTypes = prev[nodeId] || {};
      if (fluxType === undefined || fluxType === "neutre") {
        // Supprimer le type (neutre = pas de type défini)
        const { [handleId]: _, ...rest } = nodeFluxTypes;
        return { ...prev, [nodeId]: rest };
      }
      return { ...prev, [nodeId]: { ...nodeFluxTypes, [handleId]: fluxType } };
    });
  }, []);

  // === NOUVELLES FONCTIONS ===

  // Copier les blocs sélectionnés
  const copySelectedNodes = useCallback(() => {
    if (selectedNodes.length === 0) {
      toast.error("Aucun bloc sélectionné");
      return;
    }

    const selectedIds = new Set(selectedNodes.map((n) => n.id));

    // Copier les items correspondants
    const copiedItems = items.filter((item) => selectedIds.has(item.id));

    // Copier les positions et handles
    const copiedNodes = selectedNodes.map((n) => ({
      id: n.id,
      position: { ...n.position },
      item: copiedItems.find((item) => item.id === n.id),
      handles: nodeHandles[n.id] || DEFAULT_HANDLES,
    }));

    // Copier les câbles entre les blocs sélectionnés
    const copiedEdges = edges.filter((e) => selectedIds.has(e.source_node_id) && selectedIds.has(e.target_node_id));

    setClipboard({
      nodes: copiedNodes,
      edges: copiedEdges,
    });

    toast.success(`${selectedNodes.length} bloc(s) copié(s)`);
  }, [selectedNodes, items, edges, nodeHandles]);

  // Coller les blocs copiés
  const pasteNodes = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) {
      toast.error("Rien à coller");
      return;
    }

    // Vérifier si le calque actif est verrouillé
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (activeLayer?.locked) {
      toast.error(`Le calque "${activeLayer.name}" est verrouillé`);
      return;
    }

    // Décalage pour ne pas superposer
    const offset = { x: 50, y: 50 };

    // Mapping ancien ID → nouvel ID
    const idMapping: Record<string, string> = {};

    // Créer les nouveaux items
    const newItems: ElectricalItem[] = [];
    const newPositions: Record<string, { x: number; y: number }> = {};
    const newHandles: Record<string, BlockHandles> = {};

    clipboard.nodes.forEach((copiedNode, index) => {
      const newId = `${copiedNode.item?.id || "block"}-paste-${Date.now()}-${index}`;
      idMapping[copiedNode.id] = newId;

      if (copiedNode.item) {
        newItems.push({
          ...copiedNode.item,
          id: newId,
          layerId: activeLayerId,
        });
      }

      newPositions[newId] = {
        x: copiedNode.position.x + offset.x,
        y: copiedNode.position.y + offset.y,
      };

      newHandles[newId] = copiedNode.handles;
    });

    // Créer les nouveaux câbles
    const newEdges: SchemaEdge[] = clipboard.edges.map((edge, index) => ({
      ...edge,
      id: `edge-paste-${Date.now()}-${index}`,
      source_node_id: idMapping[edge.source_node_id],
      target_node_id: idMapping[edge.target_node_id],
      layerId: activeLayerId,
    }));

    // Ajouter les items et edges
    setItems((prev) => [...prev, ...newItems]);
    setEdges((prev) => [...prev, ...newEdges]);
    setNodeHandles((prev) => ({ ...prev, ...newHandles }));

    // Mettre à jour les positions des nouveaux nodes dans le prochain cycle
    setTimeout(() => {
      setNodes((prev) =>
        prev.map((n) => {
          if (newPositions[n.id]) {
            return { ...n, position: newPositions[n.id] };
          }
          return n;
        }),
      );
    }, 100);

    toast.success(`${newItems.length} bloc(s) collé(s)`);
  }, [clipboard, layers, activeLayerId, setItems, setEdges, setNodes, setNodeHandles]);

  // Raccourcis clavier pour copier/coller
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on est dans un input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        copySelectedNodes();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        pasteNodes();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copySelectedNodes, pasteNodes]);

  // Ajouter une annotation
  const addAnnotation = useCallback(
    (position: { x: number; y: number }) => {
      const newAnnotation = createAnnotation(position, activeLayerId);
      setAnnotations((prev) => [...prev, newAnnotation]);
      setSelectedAnnotationId(newAnnotation.id);
      setIsAnnotationMode(false);
    },
    [activeLayerId],
  );

  // Mettre à jour une annotation
  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  }, []);

  // Supprimer une annotation
  const deleteAnnotation = useCallback(
    (id: string) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      if (selectedAnnotationId === id) {
        setSelectedAnnotationId(null);
      }
    },
    [selectedAnnotationId],
  );

  // Types d'équipements à ignorer (pas de puissance propre, juste traversée)
  const PASSTHROUGH_TYPES = [
    "fusible",
    "protection",
    "coupe_circuit",
    "interrupteur",
    "distribution",
    "bornier",
    "repartiteur",
    "accessoire",
    "porte_fusible",
    "disjoncteur",
    "relais",
    "shunt",
  ];

  // Vérifier si un équipement est un passthrough (peut être traversé)
  const isPassthroughType = useCallback(
    (nodeId: string): boolean => {
      const item = items.find((i) => i.id === nodeId);
      if (!item) return false;

      const typeElec = item.type_electrique?.toLowerCase() || "";
      const nom = item.nom_accessoire?.toLowerCase() || "";

      // Vérifier dans le type_electrique
      const isPassthroughByType = PASSTHROUGH_TYPES.some((t) => typeElec.includes(t));

      // Vérifier aussi dans le nom (pour les accessoires génériques)
      const isPassthroughByName = PASSTHROUGH_TYPES.some((t) => nom.includes(t));

      // Si c'est un "accessoire" générique sans puissance, c'est probablement un passthrough
      const isGenericAccessory = typeElec === "accessoire" && !item.puissance_watts;

      return isPassthroughByType || isPassthroughByName || isGenericAccessory;
    },
    [items],
  );

  // Trouver tous les câbles entre deux blocs (source et destination)
  // en traversant TOUS les noeuds intermédiaires
  const findEdgesBetweenNodes = useCallback(
    (sourceId: string, destId: string): string[] => {
      const foundEdgeIds = new Set<string>();
      const allPaths: string[][] = [];

      const sourceItem = items.find((i) => i.id === sourceId);
      const destItem = items.find((i) => i.id === destId);

      console.log("=== RECHERCHE CIRCUIT ===");
      console.log("Source:", sourceId.substring(0, 15), "→", sourceItem?.nom_accessoire);
      console.log("Destination:", destId.substring(0, 15), "→", destItem?.nom_accessoire);
      console.log("Nombre total de câbles:", edges.length);
      console.log("Nombre total de blocs:", items.length);

      // Construire un graphe des connexions
      const graph: Map<string, { edgeId: string; targetNode: string }[]> = new Map();

      edges.forEach((edge) => {
        // Ajouter connexion source -> target
        if (!graph.has(edge.source_node_id)) graph.set(edge.source_node_id, []);
        graph.get(edge.source_node_id)!.push({ edgeId: edge.id, targetNode: edge.target_node_id });

        // Ajouter connexion target -> source (bidirectionnel)
        if (!graph.has(edge.target_node_id)) graph.set(edge.target_node_id, []);
        graph.get(edge.target_node_id)!.push({ edgeId: edge.id, targetNode: edge.source_node_id });
      });

      console.log("Graphe construit avec", graph.size, "noeuds connectés");

      // Debug: afficher les connexions de la source
      const sourceConnections = graph.get(sourceId) || [];
      console.log(`\nConnexions depuis la SOURCE (${sourceItem?.nom_accessoire?.substring(0, 20)}):`);
      sourceConnections.forEach((conn) => {
        const targetItem = items.find((i) => i.id === conn.targetNode);
        const edge = edges.find((e) => e.id === conn.edgeId);
        console.log(
          `  → ${targetItem?.nom_accessoire?.substring(0, 25) || conn.targetNode.substring(0, 15)} (câble: ${edge?.length_m || "?"}m, couleur: ${edge?.color})`,
        );
      });

      // Debug: afficher les connexions vers la destination
      const destConnections = graph.get(destId) || [];
      console.log(`\nConnexions vers la DESTINATION (${destItem?.nom_accessoire?.substring(0, 20)}):`);
      destConnections.forEach((conn) => {
        const targetItem = items.find((i) => i.id === conn.targetNode);
        const edge = edges.find((e) => e.id === conn.edgeId);
        console.log(
          `  ← ${targetItem?.nom_accessoire?.substring(0, 25) || conn.targetNode.substring(0, 15)} (câble: ${edge?.length_m || "?"}m, couleur: ${edge?.color})`,
        );
      });

      // BFS pour trouver TOUS les chemins
      const findAllPaths = (
        currentNodeId: string,
        targetId: string,
        visitedNodes: Set<string>,
        path: string[],
        maxDepth: number = 10,
      ): void => {
        // Protection contre les chemins trop longs
        if (path.length > maxDepth) return;

        if (currentNodeId === targetId && path.length > 0) {
          // Chemin trouvé !
          const pathDetails = path
            .map((edgeId) => {
              const edge = edges.find((e) => e.id === edgeId);
              return `${edge?.length_m || "?"}m`;
            })
            .join(" → ");
          console.log(`✅ Chemin trouvé: ${path.length} câbles (${pathDetails})`);
          allPaths.push([...path]);
          path.forEach((id) => foundEdgeIds.add(id));
          return;
        }

        const connections = graph.get(currentNodeId) || [];

        for (const conn of connections) {
          // Ne pas revisiter un noeud déjà dans le chemin
          if (visitedNodes.has(conn.targetNode)) continue;

          // Ne pas réutiliser un câble déjà dans le chemin
          if (path.includes(conn.edgeId)) continue;

          const nextItem = items.find((i) => i.id === conn.targetNode);
          const isTarget = conn.targetNode === targetId;
          const isIntermediate = nextItem && nextItem.id !== sourceId;

          // On peut traverser si c'est la destination OU n'importe quel noeud intermédiaire
          if (isTarget || isIntermediate) {
            const newVisited = new Set(visitedNodes);
            newVisited.add(conn.targetNode);
            findAllPaths(conn.targetNode, targetId, newVisited, [...path, conn.edgeId], maxDepth);
          }
        }
      };

      // Démarrer la recherche
      console.log("\n--- Début de la recherche de chemins ---");
      const initialVisited = new Set<string>();
      initialVisited.add(sourceId);
      findAllPaths(sourceId, destId, initialVisited, []);

      console.log("\n=== RÉSULTAT FINAL ===");
      console.log("Chemins trouvés:", allPaths.length);
      if (allPaths.length > 0) {
        allPaths.forEach((p, i) => {
          const totalLength = p.reduce((sum, edgeId) => {
            const edge = edges.find((e) => e.id === edgeId);
            return sum + (edge?.length_m || 0);
          }, 0);
          console.log(`  Chemin ${i + 1}: ${p.length} câbles, ${totalLength}m total`);
        });
      }
      console.log("Câbles uniques inclus:", foundEdgeIds.size);

      return Array.from(foundEdgeIds);
    },
    [edges, items],
  );

  // Types qui transmettent le courant sans avoir de puissance propre (convertisseurs, régulateurs)
  const PASSTHROUGH_POWER_TYPES = [
    "regulateur",
    "regulateur_mppt",
    "mppt",
    "regulation",
    "convertisseur",
    "onduleur",
    "chargeur",
    "fusible",
    "disjoncteur",
    "protection",
    "coupe_circuit",
    "distribution",
    "bornier",
    "repartiteur",
    "accessoire",
  ];

  // Helper: Vérifier si un item est un point de distribution
  const isDistributionPoint = useCallback((item: ElectricalItem): boolean => {
    const typeElec = item.type_electrique?.toLowerCase() || "";
    const nom = item.nom_accessoire?.toLowerCase() || "";

    // 1. Vérifier par type_electrique direct (catégorie "distributeur" ou "distribution")
    const typeConfig = ELECTRICAL_TYPES[typeElec];
    if (typeConfig?.category === "distributeur" || typeConfig?.category === "distribution") {
      return true;
    }

    // 2. Vérifier par nom ou type dans la liste (fallback)
    return DISTRIBUTION_POINT_TYPES.some((t) => typeElec.includes(t) || nom.includes(t));
  }, []);

  // Helper: Extraire la tension depuis le nom de l'accessoire (fallback)
  const extractVoltageFromName = useCallback((name: string): number | null => {
    if (!name) return null;
    // Patterns: "12V", "12 V", "24V", "24 V", "48V", "48 V"
    const match = name.match(/(\d+)\s*V(?:\s|$|[^a-zA-Z])/i);
    if (match) {
      const voltage = parseInt(match[1]);
      // Valeurs de tension courantes : 12, 24, 36, 48, 230
      if ([12, 24, 36, 48, 230].includes(voltage)) {
        return voltage;
      }
    }
    return null;
  }, []);

  // Helper: Obtenir la tension de sortie d'un item (pour calcul I = P/U)
  const getOutputVoltage = useCallback(
    (item: ElectricalItem): number => {
      // Priorité: tension_sortie > tension_volts > extraction depuis nom > 12V par défaut
      if (item.tension_sortie_volts) return item.tension_sortie_volts;
      if (item.tension_volts) return item.tension_volts;
      const fromName = extractVoltageFromName(item.nom_accessoire);
      if (fromName) return fromName;
      return 12;
    },
    [extractVoltageFromName],
  );

  // Helper: Obtenir la tension d'entrée d'un item
  const getInputVoltage = useCallback(
    (item: ElectricalItem): number => {
      if (item.tension_entree_volts) return item.tension_entree_volts;
      if (item.tension_volts) return item.tension_volts;
      const fromName = extractVoltageFromName(item.nom_accessoire);
      if (fromName) return fromName;
      return 12;
    },
    [extractVoltageFromName],
  );

  // Fonction pour SOMMER toutes les puissances en amont (pour points de distribution côté production)
  const sumUpstreamPowers = useCallback(
    (startNodeId: string, visited: Set<string> = new Set()): number => {
      if (visited.has(startNodeId)) return 0;
      visited.add(startNodeId);

      const item = items.find((i) => i.id === startNodeId);
      if (!item) return 0;

      // Si cet item a une puissance, la retourner (c'est une source)
      if (item.puissance_watts && item.puissance_watts > 0) {
        const totalPower = item.puissance_watts * (item.quantite || 1);
        console.log(
          `[sumUpstreamPowers] Source "${item.nom_accessoire}": ${totalPower}W (${item.puissance_watts}W x ${item.quantite || 1})`,
        );
        return totalPower;
      }

      // Sinon, sommer TOUTES les connexions entrantes (upstream)
      const incomingEdges = edges.filter((e) => e.target_node_id === startNodeId);
      let totalPower = 0;

      for (const edge of incomingEdges) {
        totalPower += sumUpstreamPowers(edge.source_node_id, visited);
      }

      if (totalPower > 0) {
        console.log(`[sumUpstreamPowers] Via "${item.nom_accessoire}": ${totalPower}W (somme)`);
      }

      return totalPower;
    },
    [edges, items],
  );

  // Interface pour le détail des puissances
  interface PowerDetail {
    id: string;
    nom: string;
    puissance: number;
    quantite: number;
    total: number;
  }

  // Version avec détails pour affichage
  const sumUpstreamPowersWithDetails = useCallback(
    (startNodeId: string, visited: Set<string> = new Set()): { total: number; details: PowerDetail[] } => {
      if (visited.has(startNodeId)) return { total: 0, details: [] };
      visited.add(startNodeId);

      const item = items.find((i) => i.id === startNodeId);
      if (!item) return { total: 0, details: [] };

      // Déterminer la catégorie de l'item
      const typeConfig = ELECTRICAL_TYPES[item.type_electrique];
      const category = typeConfig?.category || "consommateur";

      // Les transmetteurs (régulation, conversion, distribution, protection) doivent propager
      // la puissance d'amont, pas utiliser leur propre capacité
      const isTransmitter = ["regulation", "conversion", "distribution", "protection", "distributeur"].includes(
        category,
      );

      // Si cet item est un vrai producteur (production) avec puissance, c'est une source
      if (item.puissance_watts && item.puissance_watts > 0 && !isTransmitter) {
        const totalPower = item.puissance_watts * (item.quantite || 1);
        return {
          total: totalPower,
          details: [
            {
              id: item.id,
              nom: item.nom_accessoire,
              puissance: item.puissance_watts,
              quantite: item.quantite || 1,
              total: totalPower,
            },
          ],
        };
      }

      // Sinon, sommer les connexions entrantes (propager la puissance d'amont)
      const incomingEdges = edges.filter((e) => e.target_node_id === startNodeId);
      let totalPower = 0;
      let allDetails: PowerDetail[] = [];

      for (const edge of incomingEdges) {
        const result = sumUpstreamPowersWithDetails(edge.source_node_id, visited);
        totalPower += result.total;
        allDetails = [...allDetails, ...result.details];
      }

      return { total: totalPower, details: allDetails };
    },
    [edges, items],
  );

  // Fonction pour SOMMER toutes les puissances en aval (pour points de distribution côté consommation)
  const sumDownstreamPowers = useCallback(
    (startNodeId: string, visited: Set<string> = new Set()): number => {
      if (visited.has(startNodeId)) return 0;
      visited.add(startNodeId);

      const item = items.find((i) => i.id === startNodeId);
      if (!item) return 0;

      // Déterminer la catégorie de l'item
      const typeConfig = ELECTRICAL_TYPES[item.type_electrique];
      const category = typeConfig?.category || "consommateur";

      // Les transmetteurs doivent propager, pas utiliser leur propre capacité
      const isTransmitter = ["regulation", "conversion", "distribution", "protection", "distributeur"].includes(
        category,
      );

      // Si cet item est un vrai consommateur avec puissance, la retourner
      if (item.puissance_watts && item.puissance_watts > 0 && !isTransmitter) {
        const totalPower = item.puissance_watts * (item.quantite || 1);
        console.log(
          `[sumDownstreamPowers] Consommateur "${item.nom_accessoire}": ${totalPower}W (${item.puissance_watts}W x ${item.quantite || 1})`,
        );
        return totalPower;
      }

      // Sinon, sommer TOUTES les connexions sortantes (downstream)
      const outgoingEdges = edges.filter((e) => e.source_node_id === startNodeId);
      let totalPower = 0;

      for (const edge of outgoingEdges) {
        totalPower += sumDownstreamPowers(edge.target_node_id, visited);
      }

      if (totalPower > 0) {
        console.log(`[sumDownstreamPowers] Via "${item.nom_accessoire}": ${totalPower}W (somme)`);
      }

      return totalPower;
    },
    [edges, items],
  );

  // Version avec détails pour affichage
  const sumDownstreamPowersWithDetails = useCallback(
    (startNodeId: string, visited: Set<string> = new Set()): { total: number; details: PowerDetail[] } => {
      if (visited.has(startNodeId)) return { total: 0, details: [] };
      visited.add(startNodeId);

      const item = items.find((i) => i.id === startNodeId);
      if (!item) return { total: 0, details: [] };

      // Déterminer la catégorie de l'item
      const typeConfig = ELECTRICAL_TYPES[item.type_electrique];
      const category = typeConfig?.category || "consommateur";

      // Les transmetteurs doivent propager, pas utiliser leur propre capacité
      const isTransmitter = ["regulation", "conversion", "distribution", "protection", "distributeur"].includes(
        category,
      );

      // Si cet item est un vrai consommateur avec puissance, le compter
      if (item.puissance_watts && item.puissance_watts > 0 && !isTransmitter) {
        const totalPower = item.puissance_watts * (item.quantite || 1);
        return {
          total: totalPower,
          details: [
            {
              id: item.id,
              nom: item.nom_accessoire,
              puissance: item.puissance_watts,
              quantite: item.quantite || 1,
              total: totalPower,
            },
          ],
        };
      }

      // Sinon, sommer les connexions sortantes (propager vers l'aval)
      const outgoingEdges = edges.filter((e) => e.source_node_id === startNodeId);
      let totalPower = 0;
      let allDetails: PowerDetail[] = [];

      for (const edge of outgoingEdges) {
        const result = sumDownstreamPowersWithDetails(edge.target_node_id, visited);
        totalPower += result.total;
        allDetails = [...allDetails, ...result.details];
      }

      return { total: totalPower, details: allDetails };
    },
    [edges, items],
  );

  // Fonction pour remonter le graphe et trouver UNE puissance du producteur en amont (ancien comportement)
  const findUpstreamPower = useCallback(
    (startNodeId: string, visited: Set<string> = new Set()): number => {
      if (visited.has(startNodeId)) return 0;
      visited.add(startNodeId);

      const item = items.find((i) => i.id === startNodeId);
      if (!item) return 0;

      // Déterminer la catégorie de l'item
      const typeConfig = ELECTRICAL_TYPES[item.type_electrique];
      const category = typeConfig?.category || "consommateur";

      // Les transmetteurs doivent propager, pas utiliser leur propre capacité
      const isTransmitter = ["regulation", "conversion", "distribution", "protection", "distributeur"].includes(
        category,
      );

      // Si cet item est un vrai producteur avec puissance, la retourner
      if (item.puissance_watts && item.puissance_watts > 0 && !isTransmitter) {
        console.log(`[findUpstreamPower] Puissance trouvée sur "${item.nom_accessoire}": ${item.puissance_watts}W`);
        return item.puissance_watts * (item.quantite || 1);
      }

      // Sinon, chercher dans les connexions entrantes (upstream)
      const incomingEdges = edges.filter((e) => e.target_node_id === startNodeId);

      for (const edge of incomingEdges) {
        const upstreamPower = findUpstreamPower(edge.source_node_id, visited);
        if (upstreamPower > 0) {
          return upstreamPower;
        }
      }

      return 0;
    },
    [edges, items],
  );

  // Fonction pour descendre le graphe et trouver UNE puissance du consommateur en aval
  const findDownstreamPower = useCallback(
    (startNodeId: string, visited: Set<string> = new Set()): number => {
      if (visited.has(startNodeId)) return 0;
      visited.add(startNodeId);

      const item = items.find((i) => i.id === startNodeId);
      if (!item) return 0;

      // Déterminer la catégorie de l'item
      const typeConfig = ELECTRICAL_TYPES[item.type_electrique];
      const category = typeConfig?.category || "consommateur";

      // Les transmetteurs doivent propager, pas utiliser leur propre capacité
      const isTransmitter = ["regulation", "conversion", "distribution", "protection", "distributeur"].includes(
        category,
      );

      // Si cet item est un vrai consommateur avec puissance, la retourner
      if (item.puissance_watts && item.puissance_watts > 0 && !isTransmitter) {
        console.log(`[findDownstreamPower] Puissance trouvée sur "${item.nom_accessoire}": ${item.puissance_watts}W`);
        return item.puissance_watts * (item.quantite || 1);
      }

      // Sinon, chercher dans les connexions sortantes (downstream)
      const outgoingEdges = edges.filter((e) => e.source_node_id === startNodeId);

      for (const edge of outgoingEdges) {
        const downstreamPower = findDownstreamPower(edge.target_node_id, visited);
        if (downstreamPower > 0) {
          return downstreamPower;
        }
      }

      return 0;
    },
    [edges, items],
  );

  // ============================================
  // CALCUL AUTOMATIQUE DES SECTIONS PAR FLUX
  // ============================================

  // Vérifier si un item est un point "transparent" (on traverse sans s'arrêter)
  const isTransparentNode = useCallback((item: ElectricalItem): boolean => {
    const typeElec = item.type_electrique?.toLowerCase() || "";
    const nom = item.nom_accessoire?.toLowerCase() || "";

    // 1. Vérifier par type_electrique direct (catégorie "protection")
    const typeConfig = ELECTRICAL_TYPES[typeElec];
    if (typeConfig?.category === "protection") {
      return true;
    }

    // 2. Vérifier par nom ou type dans la liste des types transparents (fallback)
    return TRANSPARENT_TYPES.some((t) => typeElec.includes(t) || nom.includes(t));
  }, []);

  // Vérifier si un item est un "point clé" (où on s'arrête et on cumule)
  const isKeyPoint = useCallback(
    (item: ElectricalItem): boolean => {
      // Un point clé est :
      // 1. Un point de distribution (busbar, bornier...)
      // 2. Un équipement avec puissance (panneau, batterie, consommateur...)
      // 3. Un convertisseur de tension (MPPT, onduleur...)
      // 4. Tout ce qui n'est PAS transparent
      return !isTransparentNode(item);
    },
    [isTransparentNode],
  );

  // Obtenir la longueur d'un câble (définie uniquement)
  const getEdgeLength = useCallback((edge: SchemaEdge): { length: number; isDefined: boolean } => {
    // Si longueur définie, la retourner
    if (edge.length_m && edge.length_m > 0) {
      return { length: edge.length_m, isDefined: true };
    }
    // Pas de longueur définie - retourner 0 avec isDefined=false
    return { length: 0, isDefined: false };
  }, []);

  // Trouver le prochain point clé en traversant les nœuds transparents
  // Retourne { keyPointId, totalLength, traversedEdgeIds }
  const findNextKeyPoint = useCallback(
    (
      startNodeId: string,
      direction: "downstream" | "upstream",
      visited: Set<string> = new Set(),
    ): { keyPointId: string | null; totalLength: number; traversedEdgeIds: string[] } => {
      if (visited.has(startNodeId)) {
        return { keyPointId: null, totalLength: 0, traversedEdgeIds: [] };
      }
      visited.add(startNodeId);

      const startItem = items.find((i) => i.id === startNodeId);
      if (!startItem) {
        return { keyPointId: null, totalLength: 0, traversedEdgeIds: [] };
      }

      // Si c'est un point clé, on s'arrête
      if (isKeyPoint(startItem)) {
        return { keyPointId: startNodeId, totalLength: 0, traversedEdgeIds: [] };
      }

      // Sinon c'est transparent, on continue
      const nextEdges =
        direction === "downstream"
          ? edges.filter((e) => e.source_node_id === startNodeId)
          : edges.filter((e) => e.target_node_id === startNodeId);

      if (nextEdges.length === 0) {
        return { keyPointId: null, totalLength: 0, traversedEdgeIds: [] };
      }

      // Prendre le premier chemin (simplification - on suppose un seul chemin à travers les protections)
      const nextEdge = nextEdges[0];
      const nextNodeId = direction === "downstream" ? nextEdge.target_node_id : nextEdge.source_node_id;

      // Longueur définie ou estimation
      const { length: edgeLength } = getEdgeLength(nextEdge);

      const result = findNextKeyPoint(nextNodeId, direction, visited);

      return {
        keyPointId: result.keyPointId,
        totalLength: edgeLength + result.totalLength,
        traversedEdgeIds: [nextEdge.id, ...result.traversedEdgeIds],
      };
    },
    [edges, items, isKeyPoint, getEdgeLength],
  );

  // Calculer la longueur totale d'un segment (en traversant les nœuds transparents)
  // Si pas de longueur définie, essayer d'estimer depuis la position des blocs
  const calculateSegmentLength = useCallback(
    (
      edge: SchemaEdge,
    ): {
      totalLength: number;
      realTargetId: string | null;
      allEdgeIds: string[];
      hasDefinedLength: boolean; // True si au moins une longueur est définie
    } => {
      const targetItem = items.find((i) => i.id === edge.target_node_id);

      // Longueur définie ou estimation
      const { length: edgeLength, isDefined } = getEdgeLength(edge);
      let hasDefinedLength = isDefined;

      if (!targetItem) {
        return { totalLength: edgeLength, realTargetId: null, allEdgeIds: [edge.id], hasDefinedLength };
      }

      // Si la destination est un point clé, on s'arrête
      if (isKeyPoint(targetItem)) {
        return { totalLength: edgeLength, realTargetId: edge.target_node_id, allEdgeIds: [edge.id], hasDefinedLength };
      }

      // Sinon, continuer à traverser
      const { keyPointId, totalLength, traversedEdgeIds } = findNextKeyPoint(edge.target_node_id, "downstream");

      // Vérifier si les câbles traversés ont des longueurs définies
      for (const eid of traversedEdgeIds) {
        const e = edges.find((x) => x.id === eid);
        if (e?.length_m && e.length_m > 0) hasDefinedLength = true;
      }

      return {
        totalLength: edgeLength + totalLength,
        realTargetId: keyPointId,
        allEdgeIds: [edge.id, ...traversedEdgeIds],
        hasDefinedLength,
      };
    },
    [items, edges, isKeyPoint, findNextKeyPoint, getEdgeLength],
  );

  // Déterminer la tension pour un segment de câble (source → target)
  const getSegmentVoltage = useCallback(
    (sourceItem: ElectricalItem, targetItem: ElectricalItem): number => {
      // Priorité 1: tension de sortie de la source (ex: MPPT vers batterie = 12V)
      if (sourceItem.tension_sortie_volts) {
        return sourceItem.tension_sortie_volts;
      }
      // Priorité 2: tension unique de la source
      if (sourceItem.tension_volts) {
        return sourceItem.tension_volts;
      }
      // Priorité 3: tension d'entrée de la destination (ex: vers onduleur = 12V DC)
      if (targetItem.tension_entree_volts) {
        return targetItem.tension_entree_volts;
      }
      // Priorité 4: tension unique de la destination
      if (targetItem.tension_volts) {
        return targetItem.tension_volts;
      }
      // Priorité 5: extraire du nom de la source
      const fromSourceName = extractVoltageFromName(sourceItem.nom_accessoire);
      if (fromSourceName) {
        return fromSourceName;
      }
      // Priorité 6: extraire du nom de la destination
      const fromTargetName = extractVoltageFromName(targetItem.nom_accessoire);
      if (fromTargetName) {
        return fromTargetName;
      }
      // Défaut: 12V
      return 12;
    },
    [extractVoltageFromName],
  );

  // Fonction pour remonter la chaîne depuis un équipement connecté au busbar
  // et trouver la puissance source (traverse les protections et régulateurs)
  // Ne cherche que dans UN sens pour éviter les doubles comptages
  const sumUpstreamPowersFromBusbar = useCallback(
    (startNodeId: string, excludeNodeIds: Set<string> = new Set()): { total: number; details: PowerDetail[] } => {
      const visited = new Set<string>();

      const traverse = (nodeId: string): { total: number; details: PowerDetail[] } => {
        if (visited.has(nodeId) || excludeNodeIds.has(nodeId)) {
          return { total: 0, details: [] };
        }
        visited.add(nodeId);

        const item = items.find((i) => i.id === nodeId);
        if (!item) return { total: 0, details: [] };

        // Déterminer la catégorie de l'item
        const typeConfig = ELECTRICAL_TYPES[item.type_electrique];
        const category = typeConfig?.category || "consommateur";

        // Les transmetteurs (régulation, conversion, protection) doivent propager
        const isTransmitter = ["regulation", "conversion", "protection", "distributeur"].includes(category);

        // Si c'est un point de distribution (busbar), on s'arrête ici
        if (category === "distribution") {
          return { total: 0, details: [] };
        }

        // Si cet item est un vrai producteur avec puissance, c'est une source
        if (item.puissance_watts && item.puissance_watts > 0 && !isTransmitter) {
          const totalPower = item.puissance_watts * (item.quantite || 1);
          return {
            total: totalPower,
            details: [
              {
                id: item.id,
                nom: item.nom_accessoire,
                puissance: item.puissance_watts,
                quantite: item.quantite || 1,
                total: totalPower,
              },
            ],
          };
        }

        // Sinon, chercher les connexions ENTRANTES uniquement (pour remonter vers la source)
        const incomingEdges = edges.filter((e) => e.target_node_id === nodeId);

        let totalPower = 0;
        let allDetails: PowerDetail[] = [];

        for (const edge of incomingEdges) {
          const result = traverse(edge.source_node_id);
          totalPower += result.total;
          allDetails = [...allDetails, ...result.details];
        }

        // Si rien trouvé en entrée, chercher aussi en sortie (cas où le câble est tracé dans l'autre sens)
        // mais seulement si c'est un transmetteur (fusible, protection)
        if (totalPower === 0 && isTransmitter) {
          const outgoingEdges = edges.filter((e) => e.source_node_id === nodeId);
          for (const edge of outgoingEdges) {
            const result = traverse(edge.target_node_id);
            totalPower += result.total;
            allDetails = [...allDetails, ...result.details];
          }
        }

        return { total: totalPower, details: allDetails };
      };

      return traverse(startNodeId);
    },
    [edges, items],
  );

  // Calculer la puissance qui traverse un câble spécifique
  const calculateEdgePower = useCallback(
    (edge: SchemaEdge): { power: number; details: PowerDetail[] } => {
      const sourceItem = items.find((i) => i.id === edge.source_node_id);
      const targetItem = items.find((i) => i.id === edge.target_node_id);

      if (!sourceItem || !targetItem) {
        return { power: 0, details: [] };
      }

      const sourceIsDistribution = isDistributionPoint(sourceItem);
      const sourceIsTransparent = isTransparentNode(sourceItem);

      // CAS 1: La source a une puissance propre (producteur, consommateur)
      if (sourceItem.puissance_watts && sourceItem.puissance_watts > 0) {
        const power = sourceItem.puissance_watts * (sourceItem.quantite || 1);
        return {
          power,
          details: [
            {
              id: sourceItem.id,
              nom: sourceItem.nom_accessoire,
              puissance: sourceItem.puissance_watts,
              quantite: sourceItem.quantite || 1,
              total: power,
            },
          ],
        };
      }

      // CAS 2: La source est un point de distribution (busbar)
      // → Utiliser les types de flux définis sur les handles pour calculer la puissance
      if (sourceIsDistribution) {
        const busbarFluxTypes = nodeHandleFluxTypes[edge.source_node_id] || {};
        const sourceHandleFlux = edge.source_handle ? busbarFluxTypes[edge.source_handle] : undefined;

        // Si le handle source a un type de flux défini, calculer la puissance totale
        // des producteurs connectés au busbar (via handles marqués "production")
        if (sourceHandleFlux === "production" || sourceHandleFlux === "stockage") {
          // Trouver tous les câbles connectés au busbar
          const busbarEdges = edges.filter(
            (e) => e.source_node_id === edge.source_node_id || e.target_node_id === edge.source_node_id,
          );

          let totalPower = 0;
          const allDetails: PowerDetail[] = [];
          const processedItems = new Set<string>();

          // Pour chaque câble connecté au busbar
          for (const be of busbarEdges) {
            // Quel handle du busbar est utilisé ?
            const busbarHandle = be.source_node_id === edge.source_node_id ? be.source_handle : be.target_handle;

            // Quel est le type de flux de ce handle ?
            const handleFlux = busbarHandle ? busbarFluxTypes[busbarHandle] : undefined;

            // Si ce handle est marqué "production", récupérer la puissance de l'équipement connecté
            if (handleFlux === "production") {
              const connectedNodeId = be.source_node_id === edge.source_node_id ? be.target_node_id : be.source_node_id;

              // Éviter de compter plusieurs fois le même équipement
              if (processedItems.has(connectedNodeId)) continue;
              processedItems.add(connectedNodeId);

              // Remonter la chaîne pour trouver la vraie source de puissance
              const result = sumUpstreamPowersFromBusbar(connectedNodeId, new Set([edge.source_node_id]));
              totalPower += result.total;
              allDetails.push(...result.details);
            }
          }

          if (totalPower > 0) {
            return { power: totalPower, details: allDetails };
          }
        }

        // Fallback: utiliser l'ancienne méthode
        const result = sumUpstreamPowersWithDetails(edge.source_node_id, new Set([edge.target_node_id]));
        return { power: result.total, details: result.details };
      }

      // CAS 3: La source est transparente → propager ce qui vient d'amont
      if (sourceIsTransparent) {
        const result = sumUpstreamPowersWithDetails(edge.source_node_id, new Set([edge.target_node_id]));
        return { power: result.total, details: result.details };
      }

      // CAS 4: La source est un convertisseur/régulateur → propager la puissance d'amont
      // La puissance se conserve, seule la tension change
      const result = sumUpstreamPowersWithDetails(edge.source_node_id, new Set([edge.target_node_id]));
      return { power: result.total, details: result.details };
    },
    [items, isDistributionPoint, isTransparentNode, sumUpstreamPowersWithDetails, edges, nodeHandleFluxTypes],
  );

  // Interface pour les résultats de calcul
  interface EdgeCalculation {
    edgeId: string;
    power: number;
    voltage: number;
    intensity: number;
    length: number;
    totalLength: number; // Longueur totale jusqu'au prochain point clé (aller seulement)
    circuitNumber?: number; // Numéro du circuit
    circuitTotalLength: number; // Longueur totale du circuit (aller + retour)
    section: number;
    details: PowerDetail[];
    sourceNom: string;
    targetNom: string;
    realTargetNom: string; // Nom du vrai point clé de destination
    isPartOfSegment: boolean; // True si ce câble fait partie d'un segment plus long
    allEdgeIdsInSegment: string[]; // Tous les câbles du segment
    allEdgeIdsInCircuit: string[]; // Tous les câbles du même circuit
    hasDefinedLength: boolean; // True si longueur définie, false si estimée
  }

  // Obtenir le numéro de circuit d'un câble via ses handles
  const getEdgeCircuitNumber = useCallback(
    (edge: SchemaEdge): number | undefined => {
      const sourceHandleCircuits = nodeHandleCircuits[edge.source_node_id] || {};
      const targetHandleCircuits = nodeHandleCircuits[edge.target_node_id] || {};

      // Récupérer le numéro du handle source
      const sourceCircuit = edge.source_handle ? sourceHandleCircuits[edge.source_handle] : undefined;
      // Récupérer le numéro du handle cible
      const targetCircuit = edge.target_handle ? targetHandleCircuits[edge.target_handle] : undefined;

      // Si les deux ont le même numéro, c'est le circuit
      if (sourceCircuit !== undefined && sourceCircuit === targetCircuit) {
        return sourceCircuit;
      }
      // Sinon, prendre celui qui est défini (source en priorité)
      return sourceCircuit ?? targetCircuit;
    },
    [nodeHandleCircuits],
  );

  // Calculer automatiquement toutes les sections de câbles
  const calculateAllEdgeSections = useCallback((): EdgeCalculation[] => {
    const calculations: EdgeCalculation[] = [];
    const processedEdges = new Set<string>(); // Éviter de traiter deux fois les mêmes segments

    // 1. D'abord, grouper les câbles par numéro de circuit
    const edgesByCircuit = new Map<number, SchemaEdge[]>();
    for (const edge of edges) {
      const circuitNum = getEdgeCircuitNumber(edge);
      if (circuitNum !== undefined) {
        const existing = edgesByCircuit.get(circuitNum) || [];
        existing.push(edge);
        edgesByCircuit.set(circuitNum, existing);
      }
    }

    // 2. Calculer la longueur totale ET la puissance max de chaque circuit
    const circuitLengths = new Map<number, number>();
    const circuitEdgeIds = new Map<number, string[]>();
    const circuitPowers = new Map<number, { power: number; details: PowerDetail[] }>();

    edgesByCircuit.forEach((circuitEdges, circuitNum) => {
      let totalLen = 0;
      const edgeIds: string[] = [];
      let maxPower = 0;
      let maxPowerDetails: PowerDetail[] = [];

      for (const edge of circuitEdges) {
        totalLen += edge.length_m || 1; // 1m par défaut si non défini
        edgeIds.push(edge.id);

        // Calculer la puissance de chaque câble du circuit et garder la max
        const { power, details } = calculateEdgePower(edge);
        if (power > maxPower) {
          maxPower = power;
          maxPowerDetails = details;
        }
      }

      circuitLengths.set(circuitNum, totalLen);
      circuitEdgeIds.set(circuitNum, edgeIds);
      circuitPowers.set(circuitNum, { power: maxPower, details: maxPowerDetails });
    });

    for (const edge of edges) {
      // Si déjà traité dans un segment, passer
      if (processedEdges.has(edge.id)) continue;

      const sourceItem = items.find((i) => i.id === edge.source_node_id);
      const targetItem = items.find((i) => i.id === edge.target_node_id);

      if (!sourceItem || !targetItem) continue;

      // Ignorer les câbles qui partent d'un point transparent (ils seront traités via le segment)
      if (isTransparentNode(sourceItem)) {
        continue;
      }

      // 1. Calculer la longueur du segment (en traversant les nœuds transparents)
      const segmentInfo = calculateSegmentLength(edge);
      const realTarget = segmentInfo.realTargetId ? items.find((i) => i.id === segmentInfo.realTargetId) : targetItem;

      // Marquer tous les câbles du segment comme traités
      segmentInfo.allEdgeIds.forEach((id) => processedEdges.add(id));

      // 2. Obtenir le numéro de circuit
      const circuitNumber = getEdgeCircuitNumber(edge);

      // 3. Calculer la puissance - utiliser la puissance MAX du circuit si défini
      let power: number;
      let details: PowerDetail[];

      if (circuitNumber !== undefined && circuitPowers.has(circuitNumber)) {
        // Utiliser la puissance max calculée pour tout le circuit
        const circuitPowerData = circuitPowers.get(circuitNumber)!;
        power = circuitPowerData.power;
        details = circuitPowerData.details;
      } else {
        // Sinon, calculer la puissance de ce câble uniquement
        const edgePower = calculateEdgePower(edge);
        power = edgePower.power;
        details = edgePower.details;
      }

      // 4. Déterminer la tension du segment (utiliser la vraie destination)
      const voltage = getSegmentVoltage(sourceItem, realTarget || targetItem);

      // 5. Calculer l'intensité
      const intensity = power > 0 && voltage > 0 ? power / voltage : 0;

      // 6. Obtenir la longueur totale du circuit
      const circuitTotalLength =
        circuitNumber !== undefined
          ? circuitLengths.get(circuitNumber) || segmentInfo.totalLength
          : segmentInfo.totalLength;
      const allEdgeIdsInCircuit =
        circuitNumber !== undefined
          ? circuitEdgeIds.get(circuitNumber) || segmentInfo.allEdgeIds
          : segmentInfo.allEdgeIds;

      // 7. Calculer la section recommandée avec la longueur TOTALE du CIRCUIT
      let section = 0;
      if (power > 0 && circuitTotalLength > 0) {
        section = quickCalculate(power, circuitTotalLength, voltage);
      }

      // Ajouter un calcul pour CHAQUE câble du segment (tous avec la même section)
      for (const segmentEdgeId of segmentInfo.allEdgeIds) {
        const segEdge = edges.find((e) => e.id === segmentEdgeId);
        const segTarget = segEdge ? items.find((i) => i.id === segEdge.target_node_id) : null;

        calculations.push({
          edgeId: segmentEdgeId,
          power,
          voltage,
          intensity,
          length: segEdge ? getEdgeLength(segEdge).length : 0,
          totalLength: segmentInfo.totalLength,
          circuitNumber,
          circuitTotalLength,
          section,
          details,
          // Pour l'affichage du segment, utiliser la VRAIE source (premier câble) et VRAIE destination
          sourceNom: sourceItem.nom_accessoire, // Vraie source du segment
          targetNom: segTarget?.nom_accessoire || targetItem.nom_accessoire,
          realTargetNom: realTarget?.nom_accessoire || targetItem.nom_accessoire, // Vraie destination du segment
          isPartOfSegment: segmentInfo.allEdgeIds.length > 1,
          allEdgeIdsInSegment: segmentInfo.allEdgeIds,
          allEdgeIdsInCircuit,
          hasDefinedLength: segmentInfo.hasDefinedLength,
        });
      }
    }

    return calculations;
  }, [
    edges,
    items,
    isTransparentNode,
    calculateSegmentLength,
    calculateEdgePower,
    getSegmentVoltage,
    quickCalculate,
    getEdgeLength,
    getEdgeCircuitNumber,
  ]);

  // Appliquer les sections calculées à tous les câbles
  const applyCalculatedSections = useCallback(() => {
    const calculations = calculateAllEdgeSections();

    if (calculations.length === 0) {
      toast.error("Aucun câble à calculer");
      return;
    }

    // Sauvegarder l'état actuel pour Undo
    saveToHistory();

    // Compter les longueurs estimées
    const estimatedLengths = calculations.filter((c) => !c.hasDefinedLength && c.totalLength > 0);

    // Mettre à jour les edges avec les nouvelles sections ET les longueurs estimées
    setEdges((prevEdges) => {
      return prevEdges.map((edge) => {
        const calc = calculations.find((c) => c.edgeId === edge.id);
        if (calc) {
          const updates: Partial<SchemaEdge> = {};

          // Mettre à jour la section si calculée
          if (calc.section > 0) {
            updates.section_mm2 = calc.section;
            updates.section = `${calc.section}mm²`;
          }

          // Sauvegarder la longueur estimée si pas de longueur définie
          if (!edge.length_m && calc.length > 0) {
            updates.length_m = calc.length;
          }

          if (Object.keys(updates).length > 0) {
            return { ...edge, ...updates };
          }
        }
        return edge;
      });
    });

    // Afficher un résumé
    const updated = calculations.filter((c) => c.section > 0).length;
    const skipped = calculations.filter((c) => c.section === 0).length;

    if (updated > 0) {
      toast.success(`${updated} câble(s) mis à jour`);
      if (estimatedLengths.length > 0) {
        toast.info(`${estimatedLengths.length} longueur(s) estimée(s) depuis les positions`);
      }
      if (skipped > 0) {
        toast.info(`${skipped} câble(s) sans puissance définie`);
      }
    } else {
      toast.warning("Aucune section calculée (vérifiez les puissances des équipements)");
    }
  }, [calculateAllEdgeSections, saveToHistory]);

  // Définir un nouveau circuit
  const defineCircuit = useCallback(
    (sourceNodeId: string, destNodeId: string) => {
      const sourceItem = items.find((i) => i.id === sourceNodeId);
      const destItem = items.find((i) => i.id === destNodeId);

      if (!sourceItem || !destItem) {
        toast.error("Blocs non trouvés");
        return;
      }

      // Trouver tous les câbles entre source et destination
      const edgeIds = findEdgesBetweenNodes(sourceNodeId, destNodeId);

      if (edgeIds.length === 0) {
        toast.error("Aucun câble trouvé entre ces deux blocs");
        return;
      }

      // Générer un ID unique et un nom
      const circuitId = `circuit-${Date.now()}`;
      const sourceName = sourceItem.nom_accessoire?.split(" ").slice(0, 2).join(" ") || "Source";
      const destName = destItem.nom_accessoire?.split(" ").slice(0, 2).join(" ") || "Dest";
      const circuitName = `${sourceName} → ${destName}`;

      // Déterminer si on a des points de distribution
      const sourceIsDistribution = isDistributionPoint(sourceItem);
      const destIsDistribution = isDistributionPoint(destItem);

      console.log("=== ANALYSE CIRCUIT ===");
      console.log(`Source: "${sourceItem.nom_accessoire}" (distribution: ${sourceIsDistribution})`);
      console.log(`Destination: "${destItem.nom_accessoire}" (distribution: ${destIsDistribution})`);

      // Trouver la puissance - logique améliorée avec somme pour distribution
      let power = 0;
      let voltage = 12; // Tension par défaut

      // CAS 1: Source est un point de distribution (ex: Busbar → Batterie)
      // → Sommer toutes les puissances EN AMONT du busbar
      if (sourceIsDistribution) {
        console.log(`[Circuit] Source "${sourceItem.nom_accessoire}" est un point de distribution`);
        console.log(`[Circuit] Somme des puissances en amont...`);
        power = sumUpstreamPowers(sourceNodeId, new Set([destNodeId])); // Exclure la destination
        voltage = getOutputVoltage(sourceItem);
        console.log(`[Circuit] Puissance totale amont: ${power}W, Tension: ${voltage}V`);
      }
      // CAS 2: Destination est un point de distribution (ex: Batterie → Boîtier fusible)
      // → Sommer toutes les puissances EN AVAL du boîtier
      else if (destIsDistribution) {
        console.log(`[Circuit] Destination "${destItem.nom_accessoire}" est un point de distribution`);
        console.log(`[Circuit] Somme des puissances en aval...`);
        power = sumDownstreamPowers(destNodeId, new Set([sourceNodeId])); // Exclure la source
        voltage = getInputVoltage(destItem);
        console.log(`[Circuit] Puissance totale aval: ${power}W, Tension: ${voltage}V`);
      }
      // CAS 3: Pas de point de distribution - logique standard
      else {
        // Essayer sur la source directe
        if (sourceItem.puissance_watts && sourceItem.puissance_watts > 0) {
          power = sourceItem.puissance_watts * (sourceItem.quantite || 1);
          voltage = getOutputVoltage(sourceItem);
          console.log(`[Circuit] Puissance depuis source directe: ${power}W @ ${voltage}V`);
        }
        // Sinon essayer sur la destination directe
        else if (destItem.puissance_watts && destItem.puissance_watts > 0) {
          power = destItem.puissance_watts * (destItem.quantite || 1);
          voltage = getInputVoltage(destItem);
          console.log(`[Circuit] Puissance depuis destination directe: ${power}W @ ${voltage}V`);
        }
        // Sinon remonter le graphe depuis la source pour trouver le producteur
        else {
          console.log(`[Circuit] Pas de puissance directe, recherche en amont de "${sourceItem.nom_accessoire}"...`);
          power = findUpstreamPower(sourceNodeId, new Set());
          voltage = getOutputVoltage(sourceItem);

          // Si toujours rien, descendre depuis la destination
          if (power === 0) {
            console.log(`[Circuit] Pas de puissance en amont, recherche en aval de "${destItem.nom_accessoire}"...`);
            power = findDownstreamPower(destNodeId, new Set());
            voltage = getInputVoltage(destItem);
          }
        }
      }

      // Calculer la longueur totale du circuit
      let totalLength = 0;
      edgeIds.forEach((edgeId) => {
        const edge = edges.find((e) => e.id === edgeId);
        if (edge?.length_m) {
          totalLength += edge.length_m;
        }
      });

      // Calculer l'intensité et la section recommandée
      let calculatedSection: number | null = null;
      let intensity = 0;

      if (power > 0 && voltage > 0) {
        intensity = power / voltage;
        console.log(`[Circuit] Intensité calculée: I = ${power}W / ${voltage}V = ${intensity.toFixed(2)}A`);
      }

      if (power > 0 && totalLength > 0) {
        // Le quickCalculate utilise 12V par défaut, on ajuste si nécessaire
        calculatedSection = quickCalculate(power, totalLength, voltage);
      }

      console.log("=== CRÉATION CIRCUIT ===");
      console.log("Nom:", circuitName);
      console.log("Câbles:", edgeIds.length);
      console.log("Longueur totale:", totalLength, "m");
      console.log("Puissance:", power, "W", power === 0 ? "(non trouvée)" : "");
      console.log("Tension:", voltage, "V");
      console.log("Intensité:", intensity.toFixed(2), "A");
      console.log("Section calculée:", calculatedSection, "mm²");

      // Sauvegarder le circuit
      setCircuits((prev) => ({
        ...prev,
        [circuitId]: {
          id: circuitId,
          name: circuitName,
          sourceNodeId,
          destNodeId,
          edgeIds,
          power,
          voltage,
          intensity,
          totalLength,
          calculatedSection,
        },
      }));

      // Assigner le circuit ET la section calculée à tous les câbles trouvés
      setEdges((prev) =>
        prev.map((edge) => {
          if (edgeIds.includes(edge.id)) {
            return {
              ...edge,
              circuitId,
              // Appliquer la section calculée si pas déjà définie manuellement
              section_mm2: edge.section_mm2 || calculatedSection || undefined,
            };
          }
          return edge;
        }),
      );

      const sectionMsg = calculatedSection ? ` • Section: ${calculatedSection}mm²` : "";
      const powerMsg = power > 0 ? ` • ${power}W` : " • Puissance non trouvée";
      toast.success(`Circuit créé avec ${edgeIds.length} câbles${powerMsg}${sectionMsg}`);

      // Réinitialiser la sélection
      setCircuitSource(null);
      setCircuitDest(null);
    },
    [
      items,
      edges,
      findEdgesBetweenNodes,
      quickCalculate,
      findUpstreamPower,
      findDownstreamPower,
      sumUpstreamPowers,
      sumDownstreamPowers,
      isDistributionPoint,
      getOutputVoltage,
      getInputVoltage,
    ],
  );

  // Calculer la section pour un circuit entier
  const calculateCircuitSection = useCallback(
    (circuitId: string) => {
      const circuit = circuits[circuitId];
      if (!circuit) return;

      // Calculer la longueur totale du circuit
      let totalLength = 0;
      circuit.edgeIds.forEach((edgeId) => {
        const edge = edges.find((e) => e.id === edgeId);
        if (edge?.length_m) {
          totalLength += edge.length_m;
        }
      });

      if (totalLength === 0 || !circuit.power) return;

      // Calculer la section
      const section_mm2 = quickCalculate(circuit.power, totalLength);

      // Appliquer à tous les câbles du circuit
      setEdges((prev) =>
        prev.map((edge) => {
          if (circuit.edgeIds.includes(edge.id)) {
            return {
              ...edge,
              section_mm2,
              section: `${section_mm2} mm²`,
            };
          }
          return edge;
        }),
      );

      toast.success(`Section calculée: ${section_mm2} mm² (${totalLength}m, ${circuit.power}W)`);
    },
    [circuits, edges, quickCalculate],
  );

  // Mettre à jour la longueur d'un câble et recalculer son circuit
  const updateCableLength = useCallback(
    (edgeId: string, length_m: number) => {
      setEdges((prev) => {
        const updatedEdges = prev.map((edge) => {
          if (edge.id === edgeId) {
            return { ...edge, length_m };
          }
          return edge;
        });

        // Trouver si ce câble appartient à un circuit
        const edge = updatedEdges.find((e) => e.id === edgeId);
        const circuitId = edge?.circuitId;

        if (circuitId && circuits[circuitId]) {
          const circuit = circuits[circuitId];

          // Calculer la longueur totale du circuit
          let totalLength = 0;
          circuit.edgeIds.forEach((cableId) => {
            const cable = updatedEdges.find((e) => e.id === cableId);
            if (cable?.length_m) {
              totalLength += cable.length_m;
            }
          });

          // Si on a toutes les longueurs et une puissance, calculer la section
          if (totalLength > 0 && circuit.power) {
            const section_mm2 = quickCalculate(circuit.power, totalLength);

            // Appliquer à tous les câbles du circuit
            return updatedEdges.map((e) => {
              if (circuit.edgeIds.includes(e.id)) {
                return {
                  ...e,
                  section_mm2,
                  section: `${section_mm2} mm²`,
                };
              }
              return e;
            });
          }
        }

        return updatedEdges;
      });
    },
    [circuits, quickCalculate],
  );

  // Supprimer un circuit
  const deleteCircuit = useCallback((circuitId: string) => {
    // Retirer le circuitId des câbles
    setEdges((prev) =>
      prev.map((edge) => {
        if (edge.circuitId === circuitId) {
          const { circuitId: _, section_mm2: __, section: ___, ...rest } = edge;
          return rest as SchemaEdge;
        }
        return edge;
      }),
    );

    // Supprimer le circuit
    setCircuits((prev) => {
      const { [circuitId]: removed, ...rest } = prev;
      return rest;
    });

    toast.success("Circuit supprimé");
  }, []);

  // Insérer un template
  const handleInsertTemplate = useCallback(
    (
      blocks: Array<{ item: any; position: { x: number; y: number }; handles: BlockHandles; layerId: string }>,
      cables: Array<Omit<SchemaEdge, "id">>,
      newLayers: SchemaLayer[],
    ) => {
      // Ajouter les nouveaux calques (en évitant les doublons)
      if (newLayers.length > 0) {
        setLayers((prev) => {
          const existingIds = new Set(prev.map((l) => l.id));
          const layersToAdd = newLayers.filter((l) => !existingIds.has(l.id));
          return [...prev, ...layersToAdd];
        });
      }

      // Ajouter les items
      const newItems = blocks.map((b) => ({
        ...b.item,
        layerId: b.layerId,
      }));
      setItems((prev) => [...prev, ...newItems]);

      // Ajouter les handles
      const newHandles: Record<string, BlockHandles> = {};
      blocks.forEach((b) => {
        newHandles[b.item.id] = b.handles;
      });
      setNodeHandles((prev) => ({ ...prev, ...newHandles }));

      // Ajouter les câbles
      const newEdges = cables.map((cable, index) => ({
        ...cable,
        id: `edge-template-${Date.now()}-${index}`,
      }));
      setEdges((prev) => [...prev, ...newEdges]);

      // Mettre à jour les positions
      setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) => {
            const block = blocks.find((b) => b.item.id === n.id);
            if (block) {
              return { ...n, position: block.position };
            }
            return n;
          }),
        );
      }, 100);
    },
    [setLayers, setItems, setNodeHandles, setEdges, setNodes],
  );

  // Snap to grid
  const snapPosition = useCallback(
    (position: { x: number; y: number }) => {
      if (!snapToGrid) return position;
      return {
        x: Math.round(position.x / gridSize) * gridSize,
        y: Math.round(position.y / gridSize) * gridSize,
      };
    },
    [snapToGrid, gridSize],
  );

  // Gérer les changements de nodes avec snap to grid
  const handleNodesChange = useCallback(
    (changes: any[]) => {
      if (snapToGrid) {
        const snappedChanges = changes.map((change) => {
          if (change.type === "position" && change.position) {
            return {
              ...change,
              position: snapPosition(change.position),
            };
          }
          return change;
        });
        onNodesChange(snappedChanges);
      } else {
        onNodesChange(changes);
      }
    },
    [snapToGrid, snapPosition, onNodesChange],
  );

  // Charger les items sauvegardés dans le schéma (depuis localStorage)
  const loadSchemaData = useCallback(() => {
    if (!projectId) {
      console.log("[Schema] loadSchemaData - no projectId, skipping");
      return;
    }

    try {
      const storageKey = `electrical_schema_${projectId}`;
      const stored = localStorage.getItem(storageKey);
      console.log("[Schema] loadSchemaData - key:", storageKey);
      console.log("[Schema] loadSchemaData - stored data exists:", !!stored);

      if (stored) {
        const parsed = JSON.parse(stored);
        console.log("[Schema] loadSchemaData - parsed data:", {
          edges: parsed.edges?.length || 0,
          items: parsed.items?.length || 0,
          layers: parsed.layers?.length || 0,
          annotations: parsed.annotations?.length || 0,
          circuits: Object.keys(parsed.circuits || {}).length,
        });

        // Charger les edges
        if (parsed.edges) {
          setEdges(parsed.edges);
        }

        // Charger les handles
        if (parsed.nodeHandles) {
          setNodeHandles(parsed.nodeHandles);
        }

        // Charger les numéros de circuit par handle
        if (parsed.nodeHandleCircuits) {
          setNodeHandleCircuits(parsed.nodeHandleCircuits);
        }

        // Charger les types de flux par handle
        if (parsed.nodeHandleFluxTypes) {
          setNodeHandleFluxTypes(parsed.nodeHandleFluxTypes);
        }

        // Charger les calques sauvegardés
        if (parsed.layers && parsed.layers.length > 0) {
          setLayers(parsed.layers);
          const firstVisible = parsed.layers.find((l: SchemaLayer) => l.visible);
          setActiveLayerId(firstVisible?.id || parsed.layers[0].id);
        }

        // Charger les items sauvegardés
        if (parsed.items && parsed.items.length > 0) {
          console.log("[Schema] loadSchemaData - setting items:", parsed.items.length);
          setItems(parsed.items);
        } else {
          console.log("[Schema] loadSchemaData - no items in localStorage");
          setItems([]);
        }

        // Charger les annotations sauvegardées
        if (parsed.annotations && parsed.annotations.length > 0) {
          setAnnotations(parsed.annotations);
        }

        // Charger les circuits sauvegardés
        if (parsed.circuits) {
          setCircuits(parsed.circuits);
        }

        console.log("[Schema] loadSchemaData - DONE loading from localStorage");
      } else {
        console.log("[Schema] loadSchemaData - no localStorage data found");
        setItems([]);
        setEdges([]);
        setNodeHandles({});
        setLayers([createDefaultLayer()]);
        setActiveLayerId("layer-default");
        setAnnotations([]);
        setCircuits({});
      }
    } catch (error) {
      console.error("[Schema] loadSchemaData - ERROR:", error);
      toast.error("Erreur lors du chargement du schéma");
      setItems([]);
      setEdges([]);
      setNodeHandles({});
      setLayers([createDefaultLayer()]);
      setActiveLayerId("layer-default");
    }
  }, [projectId]);

  // Charger le scénario principal
  useEffect(() => {
    const loadPrincipalScenario = async () => {
      console.log("[Schema] Recherche scénario principal pour projet:", projectId);
      const { data, error } = await (supabase as any)
        .from("project_scenarios")
        .select("id")
        .eq("project_id", projectId)
        .eq("est_principal", true)
        .single();

      console.log("[Schema] Scénario principal:", { data, error });

      if (!error && data) {
        setPrincipalScenarioId(data.id);
      } else {
        // Fallback sans scénario - charger quand même le schéma local
        console.log("[Schema] Pas de scénario principal, chargement du schéma local");
        loadSchemaData();
        setLoading(false);
      }
    };

    loadPrincipalScenario();
  }, [projectId, loadSchemaData]);

  // Charger les items sauvegardés quand le scénario est chargé
  useEffect(() => {
    if (principalScenarioId) {
      console.log("[Schema] principalScenarioId set, loading schema data");
      loadSchemaData();
      setLoading(false);
    }
  }, [principalScenarioId, loadSchemaData]);

  // Charger les articles du catalogue avec type électrique
  const loadCatalogItems = async () => {
    setCatalogLoading(true);
    const { data } = await supabase
      .from("accessories_catalog")
      .select(
        "id, nom, marque, prix_vente_ttc, puissance_watts, capacite_ah, type_electrique, category_id, image_url, categories(nom)",
      )
      .not("type_electrique", "is", null)
      .order("nom");
    if (data) setCatalogItems(data);
    setCatalogLoading(false);
  };

  // Ajouter un article du catalogue au schéma
  const addFromCatalog = (catalogItem: any) => {
    // Vérifier si le calque actif est verrouillé
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (activeLayer?.locked) {
      toast.error(`Le calque "${activeLayer.name}" est verrouillé`);
      return;
    }

    const decodedName = decodeHtmlEntities(catalogItem.nom);
    const newItem: ElectricalItem = {
      id: `catalog-${catalogItem.id}-${Date.now()}`,
      nom_accessoire: decodedName,
      type_electrique: catalogItem.type_electrique,
      quantite: 1,
      puissance_watts: catalogItem.puissance_watts,
      capacite_ah: catalogItem.capacite_ah,
      tension_volts: catalogItem.tension_volts,
      marque: catalogItem.marque,
      prix_unitaire: catalogItem.prix_vente_ttc,
      image_url: catalogItem.image_url, // Miniature du produit
      layerId: activeLayerId, // Assigner au calque actif
      accessory_id: catalogItem.id, // ID du catalogue pour rafraîchir
    };
    setItems((prev) => [...prev, newItem]);
    setCatalogOpen(false);
    setCatalogSearch("");
    toast.success(`${decodedName} ajouté au schéma`);
  };

  // Filtrer le catalogue
  const filteredCatalog = catalogItems.filter(
    (item) =>
      item.nom?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      item.marque?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      item.type_electrique?.toLowerCase().includes(catalogSearch.toLowerCase()),
  );

  // Charger les articles du scénario principal
  const loadScenarioItems = async () => {
    console.log("[Schema] loadScenarioItems - principalScenarioId:", principalScenarioId);
    if (!principalScenarioId) return;
    setScenarioLoading(true);

    // Récupérer les expenses du scénario
    const { data: expenses, error } = await (supabase as any)
      .from("project_expenses")
      .select(
        "id, nom_accessoire, marque, prix_unitaire, puissance_watts, capacite_ah, tension_volts, type_electrique, quantite, accessory_id",
      )
      .eq("scenario_id", principalScenarioId)
      .order("nom_accessoire");

    console.log("[Schema] loadScenarioItems expenses:", { count: expenses?.length, error });

    if (error || !expenses) {
      console.error("[Schema] Erreur chargement expenses:", error);
      setScenarioLoading(false);
      return;
    }

    // Récupérer les accessory_ids non nulls pour enrichir depuis le catalogue
    const accessoryIds = expenses.filter((e: any) => e.accessory_id).map((e: any) => e.accessory_id);

    let catalogMap: Record<string, any> = {};

    if (accessoryIds.length > 0) {
      const { data: catalogItems } = await (supabase as any)
        .from("accessories_catalog")
        .select("id, type_electrique, puissance_watts, capacite_ah, tension_volts, marque, image_url")
        .in("id", accessoryIds);

      if (catalogItems) {
        catalogItems.forEach((item: any) => {
          catalogMap[item.id] = item;
        });
      }
      console.log("[Schema] Catalogue items loaded:", Object.keys(catalogMap).length);
    }

    // Fusionner les données: priorité aux données de l'expense, sinon prendre du catalogue
    const enrichedData = expenses
      .map((expense: any) => {
        const catalog = catalogMap[expense.accessory_id];
        return {
          id: expense.id,
          nom_accessoire: expense.nom_accessoire,
          marque: expense.marque || catalog?.marque,
          prix_unitaire: expense.prix_unitaire,
          quantite: expense.quantite,
          // Prendre du catalogue si pas défini sur l'expense
          type_electrique: expense.type_electrique || catalog?.type_electrique,
          puissance_watts: expense.puissance_watts ?? catalog?.puissance_watts,
          capacite_ah: expense.capacite_ah ?? catalog?.capacite_ah,
          tension_volts: expense.tension_volts ?? catalog?.tension_volts,
          image_url: catalog?.image_url, // Miniature du produit depuis le catalogue
        };
      })
      .filter((item: any) => item.type_electrique); // Filtrer ceux qui ont un type électrique

    console.log("[Schema] loadScenarioItems enriched:", {
      total: expenses.length,
      withType: enrichedData.length,
      items: enrichedData.map((i: any) => ({
        nom: i.nom_accessoire,
        type: i.type_electrique,
        tension: i.tension_volts,
      })),
    });

    setScenarioItems(enrichedData);
    setScenarioLoading(false);
  };

  // Rafraîchir les items du canvas depuis le catalogue (mise à jour des types électriques)
  const refreshItemsFromCatalog = async () => {
    if (items.length === 0) {
      toast.info("Aucun bloc sur le schéma");
      return;
    }

    try {
      // Récupérer tous les accessoires du catalogue
      const { data: catalogItems, error } = await supabase
        .from("accessories_catalog")
        .select("id, nom, type_electrique, puissance_watts, capacite_ah, tension_volts");

      if (error) {
        console.error("[Refresh] Erreur catalogue:", error);
        toast.error("Erreur lors du chargement du catalogue");
        return;
      }

      if (!catalogItems || catalogItems.length === 0) {
        toast.info("Catalogue vide");
        return;
      }

      console.log("[Refresh] Catalogue chargé:", catalogItems.length, "articles");

      // Créer un index par ID pour recherche rapide
      const catalogById: Record<string, any> = {};
      catalogItems.forEach((c) => {
        catalogById[c.id] = c;
      });

      // Sauvegarder l'état pour Undo
      saveToHistory();

      // Mettre à jour les items
      let updatedCount = 0;
      const updatedItems = items.map((item) => {
        let catalogMatch: any = null;

        // 1. Chercher par accessory_id si disponible
        if (item.accessory_id && catalogById[item.accessory_id]) {
          catalogMatch = catalogById[item.accessory_id];
        }

        // 2. Sinon chercher par nom exact
        if (!catalogMatch) {
          catalogMatch = catalogItems.find((c) => c.nom?.toLowerCase() === item.nom_accessoire?.toLowerCase());
        }

        // 3. Sinon chercher par nom contenu
        if (!catalogMatch) {
          catalogMatch = catalogItems.find(
            (c) =>
              c.nom &&
              item.nom_accessoire &&
              (item.nom_accessoire.toLowerCase().includes(c.nom.toLowerCase()) ||
                c.nom.toLowerCase().includes(item.nom_accessoire.toLowerCase())),
          );
        }

        if (catalogMatch && catalogMatch.type_electrique) {
          const hasChanges =
            item.type_electrique !== catalogMatch.type_electrique ||
            item.puissance_watts !== catalogMatch.puissance_watts ||
            item.tension_volts !== catalogMatch.tension_volts;

          if (hasChanges) {
            updatedCount++;
            console.log(`[Refresh] ${item.nom_accessoire}: ${item.type_electrique} → ${catalogMatch.type_electrique}`);
          }

          return {
            ...item,
            type_electrique: catalogMatch.type_electrique,
            puissance_watts: catalogMatch.puissance_watts ?? item.puissance_watts,
            tension_volts: catalogMatch.tension_volts ?? item.tension_volts,
            accessory_id: catalogMatch.id,
          };
        }

        return item;
      });

      setItems(updatedItems);

      if (updatedCount > 0) {
        toast.success(`${updatedCount} bloc(s) mis à jour depuis le catalogue`);
      } else {
        toast.info("Aucune mise à jour nécessaire");
      }
    } catch (err) {
      console.error("[Refresh] Erreur:", err);
      toast.error("Erreur lors du rafraîchissement");
    }
  };

  // Compter combien d'items d'un expense sont déjà dans le schéma
  const getUsedQuantity = (expenseId: string) => {
    return items
      .filter((i) => i.id === expenseId || i.id.startsWith(`${expenseId}-`))
      .reduce((sum, i) => sum + i.quantite, 0);
  };

  // Ajouter un article du scénario au schéma (1 à la fois)
  const addFromScenario = (expense: any, quantity: number = 1) => {
    // Vérifier si le calque actif est verrouillé
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (activeLayer?.locked) {
      toast.error(`Le calque "${activeLayer.name}" est verrouillé`);
      return;
    }

    console.log("[Schema] addFromScenario called:", { expense: expense.nom_accessoire, quantity });
    const decodedName = decodeHtmlEntities(expense.nom_accessoire);
    const usedQty = getUsedQuantity(expense.id);
    const availableQty = (expense.quantite || 1) - usedQty;

    if (quantity > availableQty) {
      toast.error(`Seulement ${availableQty} disponible(s)`);
      return;
    }

    // Créer un ID unique pour chaque instance
    const instanceId =
      usedQty === 0 && quantity === (expense.quantite || 1)
        ? expense.id // Si on prend tout d'un coup, garder l'ID original
        : `${expense.id}-${Date.now()}`; // Sinon créer un ID unique

    const newItem: ElectricalItem = {
      id: instanceId,
      nom_accessoire: decodedName,
      type_electrique: expense.type_electrique || "consommateur",
      quantite: quantity,
      puissance_watts: expense.puissance_watts,
      capacite_ah: expense.capacite_ah,
      tension_volts: expense.tension_volts,
      marque: expense.marque,
      prix_unitaire: expense.prix_unitaire,
      image_url: expense.image_url, // Miniature du produit
      layerId: activeLayerId, // Assigner au calque actif
      accessory_id: expense.accessory_id, // ID du catalogue pour rafraîchir
    };
    setItems((prev) => [...prev, newItem]);
    toast.success(`${quantity}x ${decodedName} ajouté au schéma`);
  };

  // Supprimer un item du schéma (mais pas de la base)
  const deleteItemFromSchema = useCallback(
    (itemId: string) => {
      // Vérifier si l'item est sur un calque verrouillé
      const item = items.find((i) => i.id === itemId);
      if (item) {
        const itemLayerId = item.layerId || "layer-default";
        const layer = layers.find((l) => l.id === itemLayerId);
        if (layer?.locked) {
          toast.error(`Le calque "${layer.name}" est verrouillé`);
          return;
        }
      }

      setItems((prev) => prev.filter((i) => i.id !== itemId));
      // Supprimer aussi les edges liés à cet item
      setEdges((prev) => prev.filter((e) => e.source_node_id !== itemId && e.target_node_id !== itemId));
      // Supprimer les handles sauvegardés
      setNodeHandles((prev) => {
        const newHandles = { ...prev };
        delete newHandles[itemId];
        return newHandles;
      });
      toast.success("Accessoire retiré du schéma");
    },
    [items, layers],
  );

  // Modifier un item dans le schéma
  const updateItemInSchema = useCallback((itemId: string, updates: Partial<ElectricalItem>) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
    toast.success("Accessoire modifié");
  }, []);

  // État pour la modale d'édition
  const [editingItem, setEditingItem] = useState<ElectricalItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    puissance_watts: "",
    tension_entree_volts: "",
    tension_sortie_volts: "",
    capacite_ah: "",
    intensite_amperes: "",
  });

  // Ouvrir la modale d'édition
  const openEditModal = useCallback((item: ElectricalItem) => {
    setEditingItem(item);
    setEditFormData({
      puissance_watts: item.puissance_watts?.toString() || "",
      tension_entree_volts: item.tension_entree_volts?.toString() || item.tension_volts?.toString() || "",
      tension_sortie_volts: item.tension_sortie_volts?.toString() || item.tension_volts?.toString() || "",
      capacite_ah: item.capacite_ah?.toString() || "",
      intensite_amperes: item.intensite_amperes?.toString() || "",
    });
  }, []);

  // Sauvegarder les modifications
  const saveEditedItem = useCallback(() => {
    if (!editingItem) return;

    const updates: Partial<ElectricalItem> = {};

    if (editFormData.puissance_watts) {
      updates.puissance_watts = parseFloat(editFormData.puissance_watts);
    }
    if (editFormData.tension_entree_volts) {
      updates.tension_entree_volts = parseFloat(editFormData.tension_entree_volts);
    }
    if (editFormData.tension_sortie_volts) {
      updates.tension_sortie_volts = parseFloat(editFormData.tension_sortie_volts);
    }
    if (editFormData.capacite_ah) {
      updates.capacite_ah = parseFloat(editFormData.capacite_ah);
    }
    if (editFormData.intensite_amperes) {
      updates.intensite_amperes = parseFloat(editFormData.intensite_amperes);
    }

    // Si tensions entrée et sortie sont identiques, utiliser tension_volts
    if (updates.tension_entree_volts === updates.tension_sortie_volts) {
      updates.tension_volts = updates.tension_entree_volts;
    }

    updateItemInSchema(editingItem.id, updates);
    setEditingItem(null);
    toast.success("Modifications enregistrées");
  }, [editingItem, editFormData, updateItemInSchema]);

  // Filtrer le scénario (exclure les items entièrement utilisés)
  const filteredScenario = scenarioItems.filter((item) => {
    const usedQty = getUsedQuantity(item.id);
    const totalQty = item.quantite || 1;
    const hasAvailable = usedQty < totalQty;
    const matchesSearch =
      item.nom_accessoire?.toLowerCase().includes(scenarioSearch.toLowerCase()) ||
      item.marque?.toLowerCase().includes(scenarioSearch.toLowerCase()) ||
      item.type_electrique?.toLowerCase().includes(scenarioSearch.toLowerCase());
    return hasAvailable && matchesSearch;
  });

  // Debug: log quand le popover s'ouvre et qu'il n'y a pas d'articles disponibles
  useEffect(() => {
    if (scenarioOpen && scenarioItems.length > 0 && filteredScenario.length === 0 && !scenarioSearch) {
      console.log("[Schema DEBUG] Tous les articles filtrés - items dans schéma:", items.length);
      console.log(
        "[Schema DEBUG] Items du schéma:",
        items.map((i) => ({ id: i.id, nom: i.nom_accessoire, qty: i.quantite })),
      );
      console.log(
        "[Schema DEBUG] Articles du scénario:",
        scenarioItems.map((s) => ({
          id: s.id,
          nom: s.nom_accessoire,
          qty: s.quantite,
          usedQty: getUsedQuantity(s.id),
        })),
      );
    }
  }, [scenarioOpen, scenarioItems, filteredScenario, scenarioSearch, items]);

  // Synchroniser les nodes avec les items (filtrage par calques visibles)
  useEffect(() => {
    const stored = localStorage.getItem(`electrical_schema_${projectId}`);
    const savedNodes = stored ? JSON.parse(stored).nodes || [] : [];

    // IDs des calques visibles
    const visibleLayerIds = new Set(layers.filter((l) => l.visible).map((l) => l.id));
    // IDs des calques verrouillés
    const lockedLayerIds = new Set(layers.filter((l) => l.locked).map((l) => l.id));

    setNodes((currentNodes) => {
      return items.map((item, index) => {
        // Chercher d'abord dans les nodes actuels (position en temps réel)
        const currentNode = currentNodes.find((n) => n.id === item.id);
        // Sinon chercher dans le localStorage
        const savedNode = savedNodes.find((n: any) => n.expense_id === item.id);
        const handles = nodeHandles[item.id] || DEFAULT_HANDLES;

        // Priorité: position actuelle > position sauvegardée > position par défaut
        const position = currentNode?.position ??
          (savedNode ? { x: savedNode.position_x, y: savedNode.position_y } : null) ?? {
            x: 100 + (index % 4) * 300,
            y: 100 + Math.floor(index / 4) * 250,
          };

        // Vérifier si le calque de l'item est visible
        const itemLayerId = item.layerId || "layer-default";
        const isVisible = visibleLayerIds.has(itemLayerId);
        const isLocked = lockedLayerIds.has(itemLayerId);
        const handleCircuits = nodeHandleCircuits[item.id] || {};
        const handleFluxTypes = nodeHandleFluxTypes[item.id] || {};

        return {
          id: item.id,
          type: "electricalBlock",
          position,
          hidden: !isVisible, // Masquer si le calque n'est pas visible
          draggable: !isLocked, // Empêcher le déplacement si le calque est verrouillé
          data: {
            item,
            handles,
            handleCircuits,
            handleFluxTypes,
            isLocked, // Passer l'info de verrouillage au composant
            onUpdateHandles: updateNodeHandles,
            onUpdateHandleCircuit: updateHandleCircuit,
            onUpdateHandleFluxType: updateHandleFluxType,
            onDeleteItem: deleteItemFromSchema,
            onEditItem: openEditModal,
          },
        };
      }) as any;
    });
  }, [
    items,
    nodeHandles,
    nodeHandleCircuits,
    nodeHandleFluxTypes,
    updateNodeHandles,
    updateHandleCircuit,
    updateHandleFluxType,
    deleteItemFromSchema,
    openEditModal,
    layers,
  ]);

  // Fonction pour extraire le côté du handle (right, left, top, bottom)
  const getSideFromHandle = (handle: string | null | undefined): string => {
    if (!handle) return "default";
    if (handle.startsWith("right")) return "right";
    if (handle.startsWith("left")) return "left";
    if (handle.startsWith("top")) return "top";
    if (handle.startsWith("bottom")) return "bottom";
    return handle;
  };

  // Synchroniser les edges avec offset pour éviter la superposition
  useEffect(() => {
    // IDs des calques visibles
    const visibleLayerIds = new Set(layers.filter((l) => l.visible).map((l) => l.id));

    // Filtrer les edges selon les calques visibles
    const visibleEdges = edges.filter((edge) => {
      // Si pas de layerId, l'edge est toujours visible
      if (!edge.layerId) return true;
      return visibleLayerIds.has(edge.layerId);
    });

    // Grouper les edges par CÔTÉ source (pas par handle exact)
    const edgesBySourceSide: Record<string, SchemaEdge[]> = {};
    visibleEdges.forEach((edge) => {
      const side = getSideFromHandle(edge.source_handle);
      const key = `${edge.source_node_id}-${side}`;
      if (!edgesBySourceSide[key]) edgesBySourceSide[key] = [];
      edgesBySourceSide[key].push(edge);
    });

    // Grouper aussi par CÔTÉ target
    const edgesByTargetSide: Record<string, SchemaEdge[]> = {};
    visibleEdges.forEach((edge) => {
      const side = getSideFromHandle(edge.target_handle);
      const key = `${edge.target_node_id}-${side}`;
      if (!edgesByTargetSide[key]) edgesByTargetSide[key] = [];
      edgesByTargetSide[key].push(edge);
    });

    setFlowEdges(
      visibleEdges.map((edge, index) => {
        const isSelected = edge.id === selectedEdgeId;
        const edgeColor = edge.color || "#64748b";
        const edgeWidth = edge.strokeWidth || 2;

        // Calculer l'offset basé sur la position dans le groupe du côté
        const sourceSide = getSideFromHandle(edge.source_handle);
        const targetSide = getSideFromHandle(edge.target_handle);
        const sourceKey = `${edge.source_node_id}-${sourceSide}`;
        const targetKey = `${edge.target_node_id}-${targetSide}`;

        const sourceGroup = edgesBySourceSide[sourceKey] || [];
        const targetGroup = edgesByTargetSide[targetKey] || [];

        const sourceIndex = sourceGroup.findIndex((e) => e.id === edge.id);
        const targetIndex = targetGroup.findIndex((e) => e.id === edge.id);

        // Offset de 25px par edge supplémentaire, centré autour de 0
        const groupSize = Math.max(sourceGroup.length, targetGroup.length);
        const edgeIndex = Math.max(sourceIndex, targetIndex);
        let offset = (edgeIndex - (groupSize - 1) / 2) * 25;

        // Ajouter un offset supplémentaire pour les ponts
        if (edge.bridge) {
          offset += 50;
        }

        // Calculer les hauteurs des blocs source et target pour le virage intelligent
        const sourceNode = nodes.find((n) => n.id === edge.source_node_id);
        const targetNode = nodes.find((n) => n.id === edge.target_node_id);
        const sourceHeight = sourceNode ? getNodeHeight(sourceNode) : 100;
        const targetHeight = targetNode ? getNodeHeight(targetNode) : 100;

        // Construire le label du câble (longueur + section)
        let cableLabel: string | undefined = undefined;
        if (edge.length_m || edge.section_mm2 || edge.section) {
          const parts: string[] = [];
          if (edge.length_m) parts.push(`${edge.length_m}m`);
          if (edge.section_mm2) parts.push(`${edge.section_mm2}mm²`);
          else if (edge.section) parts.push(edge.section);
          cableLabel = parts.join(" • ");
        }

        const isHovered = hoveredCircuitEdgeIds.includes(edge.id);

        return {
          id: edge.id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          sourceHandle: edge.source_handle || undefined,
          targetHandle: edge.target_handle || undefined,
          type: "customSmooth",
          data: {
            offset,
            sourceHeight,
            targetHeight,
            // Indiquer de quel côté faire le virage (près du plus petit bloc)
            turnNearTarget: targetHeight < sourceHeight,
            // Passer tous les nodes pour le contournement des obstacles
            allNodes: nodes.filter((n) => n.id !== edge.source_node_id && n.id !== edge.target_node_id),
            isHovered, // Pour grossir le label au survol dans le popover
            section: edge.section_mm2 || edge.section?.replace("mm²", "") || null, // Section pour le badge
          },
          label: cableLabel,
          labelStyle: {
            fill: edgeColor,
            fontWeight: isHovered ? 700 : 600,
            fontSize: isHovered ? 14 : 11,
            transition: "all 0.2s ease",
          },
          labelBgStyle: {
            fill: isHovered ? "#ecfdf5" : "white",
            fillOpacity: 0.95,
            stroke: isHovered ? "#10b981" : undefined,
            strokeWidth: isHovered ? 2 : 0,
          },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          style: {
            strokeWidth: isHovered ? edgeWidth + 3 : isSelected ? edgeWidth + 2 : edgeWidth,
            stroke: isHovered ? "#10b981" : edgeColor,
            filter: isHovered
              ? "drop-shadow(0 0 6px rgba(16, 185, 129, 0.8))"
              : isSelected
                ? "drop-shadow(0 0 4px rgba(59, 130, 246, 0.8))"
                : undefined,
            transition: "all 0.2s ease",
          },
        };
      }) as any,
    );
  }, [edges, selectedEdgeId, hoveredCircuitEdgeIds, layers, nodes, getNodeHeight]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // Vérifier si le calque actif est verrouillé (pour le câble lui-même)
      const activeLayer = layers.find((l) => l.id === activeLayerId);
      if (activeLayer?.locked) {
        toast.error(`Le calque "${activeLayer.name}" est verrouillé`);
        return;
      }

      const newEdge: SchemaEdge = {
        id: `edge-${Date.now()}`,
        source_node_id: connection.source,
        target_node_id: connection.target,
        source_handle: connection.sourceHandle || null,
        target_handle: connection.targetHandle || null,
        color: "#ef4444",
        strokeWidth: 2,
        layerId: activeLayerId, // Assigner au calque actif
      };
      setEdges((prev) => [...prev, newEdge]);
    },
    [activeLayerId, layers],
  );

  const updateEdgeColor = useCallback(
    (color: string) => {
      if (!selectedEdgeId) return;
      setEdges((prev) => prev.map((e) => (e.id === selectedEdgeId ? { ...e, color } : e)));
    },
    [selectedEdgeId],
  );

  const updateEdgeStrokeWidth = useCallback(
    (strokeWidth: number) => {
      if (!selectedEdgeId) return;
      setEdges((prev) => prev.map((e) => (e.id === selectedEdgeId ? { ...e, strokeWidth } : e)));
    },
    [selectedEdgeId],
  );

  const updateEdgeSection = useCallback(
    (section: string) => {
      if (!selectedEdgeId) return;
      setEdges((prev) => prev.map((e) => (e.id === selectedEdgeId ? { ...e, section: section || undefined } : e)));
    },
    [selectedEdgeId],
  );

  const toggleEdgeBridge = useCallback(() => {
    if (!selectedEdgeId) return;
    setEdges((prev) => prev.map((e) => (e.id === selectedEdgeId ? { ...e, bridge: !e.bridge } : e)));
  }, [selectedEdgeId]);

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  // Calculer les infos du circuit sélectionné
  const selectedCircuitInfo = useMemo(() => {
    if (!selectedEdgeId || !selectedEdge) return null;

    // Vérifier si ce câble appartient à un circuit défini
    const circuitId = selectedEdge.circuitId;

    if (circuitId && circuits[circuitId]) {
      const circuit = circuits[circuitId];

      // Calculer la longueur totale
      let totalLength = 0;
      circuit.edgeIds.forEach((id) => {
        const edge = edges.find((e) => e.id === id);
        if (edge?.length_m) {
          totalLength += edge.length_m;
        }
      });

      // Calculer la section si pas déjà définie
      const calculatedSection =
        circuit.power > 0 && totalLength > 0 ? quickCalculate(circuit.power, totalLength) : null;

      return {
        circuitId,
        circuitName: circuit.name,
        power: circuit.power || 0,
        totalLength,
        cableCount: circuit.edgeIds.length,
        sourceNodeId: circuit.sourceNodeId,
        destNodeId: circuit.destNodeId,
        calculatedSection,
      };
    }

    // Pas de circuit défini
    return {
      circuitId: null,
      circuitName: null,
      power: 0,
      totalLength: selectedEdge.length_m || 0,
      cableCount: 1,
      sourceNodeId: selectedEdge.source_node_id,
      destNodeId: selectedEdge.target_node_id,
      calculatedSection: null,
    };
  }, [selectedEdgeId, selectedEdge, edges, circuits, quickCalculate]);

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    setEdges((prev) => prev.filter((e) => e.id !== selectedEdgeId));
    setSelectedEdgeId(null);
  }, [selectedEdgeId]);

  const saveSchema = async () => {
    setSaving(true);
    try {
      const schemaToSave = {
        nodes: nodes.map((node) => ({
          id: node.id,
          expense_id: node.id,
          position_x: node.position.x,
          position_y: node.position.y,
        })),
        edges,
        nodeHandles,
        nodeHandleCircuits, // Sauvegarder les numéros de circuit par handle
        nodeHandleFluxTypes, // Sauvegarder les types de flux par handle
        items, // Sauvegarder aussi les items ajoutés au schéma
        layers, // Sauvegarder les calques
        annotations, // Sauvegarder les annotations
        circuits, // Sauvegarder les circuits définis
      };
      localStorage.setItem(`electrical_schema_${projectId}`, JSON.stringify(schemaToSave));
      toast.success("Schéma sauvegardé");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    }
    setSaving(false);
  };

  const resetSchema = () => {
    if (!confirm("Réinitialiser le schéma ? Tous les blocs et câbles seront supprimés.")) return;
    localStorage.removeItem(`electrical_schema_${projectId}`);
    setItems([]);
    setEdges([]);
    setNodeHandles({});
    setNodeHandleCircuits({});
    setNodeHandleFluxTypes({});
    toast.success("Schéma réinitialisé");
  };

  // Calculs résumé
  const totalProduction = items
    .filter((i) => ELECTRICAL_TYPES[i.type_electrique]?.category === "production")
    .reduce((sum, i) => sum + (i.puissance_watts || 0) * i.quantite, 0);
  const totalConsommation = items
    .filter((i) => ELECTRICAL_TYPES[i.type_electrique]?.category === "consommateur")
    .reduce((sum, i) => sum + (i.puissance_watts || 0) * i.quantite, 0);
  const totalStockage = items
    .filter((i) => ELECTRICAL_TYPES[i.type_electrique]?.category === "stockage")
    .reduce((sum, i) => sum + (i.capacite_ah || 0) * i.quantite, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-3 mb-16 ${isFullscreen ? "fixed inset-0 z-50 bg-white p-4" : "min-h-[900px] h-[calc(100vh-180px)]"}`}
    >
      {/* Barre d'outils - Ligne 1 : Indicateurs + Boutons */}
      <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-lg border border-yellow-200">
            <Sun className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium">{totalProduction} W</span>
            <span className="text-xs text-yellow-600">prod.</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
            <Battery className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium">{totalStockage} Ah</span>
            <span className="text-xs text-green-600">stock.</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg border border-red-200">
            <Zap className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium">{totalConsommation} W</span>
            <span className="text-xs text-red-600">conso.</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 🔥 Bouton ajouter depuis le scénario */}
          <Popover
            open={scenarioOpen}
            onOpenChange={(open) => {
              setScenarioOpen(open);
              if (open) loadScenarioItems();
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Scénario
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0 z-[9999]" align="end">
              <div className="p-3 border-b bg-blue-50">
                <div className="text-xs text-blue-600 font-medium mb-2">Articles du scénario principal</div>
                <Input
                  placeholder="Rechercher..."
                  value={scenarioSearch}
                  onChange={(e) => setScenarioSearch(e.target.value)}
                  className="h-8"
                />
              </div>
              <ScrollArea className="h-72">
                {scenarioLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : !principalScenarioId ? (
                  <div className="text-center text-sm text-gray-500 py-8">Aucun scénario principal défini</div>
                ) : filteredScenario.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 py-8">
                    {scenarioSearch
                      ? "Aucun article trouvé"
                      : scenarioItems.length === 0
                        ? "Aucun article avec type électrique dans le scénario"
                        : "Tous les articles sont déjà dans le schéma"}
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredScenario.map((item) => {
                      const typeConfig = item.type_electrique
                        ? ELECTRICAL_TYPES[item.type_electrique] || ELECTRICAL_TYPES.consommateur
                        : { icon: Lightbulb, color: "text-gray-400" };
                      const IconComponent = typeConfig.icon;
                      const usedQty = getUsedQuantity(item.id);
                      const totalQty = item.quantite || 1;
                      const availableQty = totalQty - usedQty;

                      return (
                        <button
                          key={item.id}
                          onClick={() => addFromScenario(item, 1)}
                          className="w-full flex items-start gap-2 p-2 rounded hover:bg-gray-100 text-left transition-colors"
                        >
                          <IconComponent className={`h-4 w-4 shrink-0 mt-0.5 ${typeConfig.color}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium leading-tight">
                              {decodeHtmlEntities(item.nom_accessoire)}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                              {item.marque && <span>{item.marque}</span>}
                              {item.puissance_watts && <span>{item.puissance_watts}W</span>}
                              {!item.type_electrique && <span className="text-orange-500">(sans type)</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                availableQty > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {availableQty}/{totalQty}
                            </span>
                            <Plus className="h-4 w-4 text-gray-400" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* 🔥 Bouton ajouter depuis le catalogue */}
          <Popover
            open={catalogOpen}
            onOpenChange={(open) => {
              setCatalogOpen(open);
              if (open) loadCatalogItems();
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Catalogue
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="end">
              <div className="p-3 border-b">
                <Input
                  placeholder="Rechercher..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="h-8"
                />
              </div>
              <ScrollArea className="h-72">
                {catalogLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : filteredCatalog.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 py-8">Aucun article électrique trouvé</div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredCatalog.map((item) => {
                      const typeConfig = ELECTRICAL_TYPES[item.type_electrique] || ELECTRICAL_TYPES.consommateur;
                      const IconComponent = typeConfig.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => addFromCatalog(item)}
                          className="w-full flex items-start gap-2 p-2 rounded hover:bg-gray-100 text-left transition-colors"
                        >
                          <IconComponent className={`h-4 w-4 shrink-0 mt-0.5 ${typeConfig.color}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium leading-tight">{decodeHtmlEntities(item.nom)}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                              {item.marque && <span>{item.marque}</span>}
                              {item.puissance_watts && <span>{item.puissance_watts}W</span>}
                              {item.capacite_ah && <span>{item.capacite_ah}Ah</span>}
                            </div>
                          </div>
                          <Plus className="h-4 w-4 text-gray-400 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* Boutons Undo/Redo */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleUndoBlocs} disabled={!canUndoBlocs} className="px-2">
                  <Undo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Annuler (Ctrl+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleRedoBlocs} disabled={!canRedoBlocs} className="px-2">
                  <Redo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refaire (Ctrl+Y)</TooltipContent>
            </Tooltip>
          </div>

          <Button variant="outline" size="sm" onClick={resetSchema}>
            <Trash2 className="h-4 w-4 mr-1" />
            Réinitialiser
          </Button>

          {/* Bouton Calques */}
          <SchemaLayersPanel
            layers={layers}
            activeLayerId={activeLayerId}
            onLayersChange={handleLayersChange}
            onActiveLayerChange={setActiveLayerId}
            itemCountByLayer={(() => {
              const counts: Record<string, number> = {};
              items.forEach((item) => {
                const lid = item.layerId || "layer-default";
                counts[lid] = (counts[lid] || 0) + 1;
              });
              edges.forEach((edge) => {
                const lid = edge.layerId || "layer-default";
                counts[lid] = (counts[lid] || 0) + 1;
              });
              return counts;
            })()}
          />

          <Button size="sm" onClick={saveSchema} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Sauvegarder
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Quitter plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Ligne 2 : Onglets des calques */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg shrink-0 overflow-x-auto">
        {layers
          .sort((a, b) => a.order - b.order)
          .map((layer) => {
            const isActive = layer.id === activeLayerId;
            const isEditing = editingLayerId === layer.id;
            const itemCount =
              items.filter((i) => (i.layerId || "layer-default") === layer.id).length +
              edges.filter((e) => (e.layerId || "layer-default") === layer.id).length;
            return (
              <div
                key={layer.id}
                className={`
                  flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-md text-sm font-medium transition-all flex-shrink-0
                  ${isActive ? "bg-white shadow-sm" : "hover:bg-white/50"}
                  ${!layer.visible ? "opacity-50" : ""}
                `}
                style={{
                  borderLeft: `3px solid ${layer.color}`,
                }}
              >
                {isEditing ? (
                  <input
                    type="text"
                    defaultValue={layer.name}
                    autoFocus
                    className="w-28 px-1 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onBlur={(e) => {
                      const newName = e.target.value.trim();
                      if (newName && newName !== layer.name) {
                        handleLayersChange(layers.map((l) => (l.id === layer.id ? { ...l, name: newName } : l)));
                      }
                      setEditingLayerId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const newName = (e.target as HTMLInputElement).value.trim();
                        if (newName && newName !== layer.name) {
                          handleLayersChange(layers.map((l) => (l.id === layer.id ? { ...l, name: newName } : l)));
                        }
                        setEditingLayerId(null);
                      }
                      if (e.key === "Escape") {
                        setEditingLayerId(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <button
                    onClick={() => setActiveLayerId(layer.id)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingLayerId(layer.id);
                    }}
                    className="flex items-center gap-1.5"
                    style={{
                      color: isActive ? layer.color : undefined,
                    }}
                    title="Double-clic pour renommer"
                  >
                    <span className="max-w-32 truncate">{layer.name}</span>
                    {itemCount > 0 && <span className="text-xs text-slate-400">({itemCount})</span>}
                  </button>
                )}
                {/* Bouton verrouillage */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLayersChange(layers.map((l) => (l.id === layer.id ? { ...l, locked: !l.locked } : l)));
                  }}
                  className={`p-1 rounded hover:bg-slate-200 transition-colors ${layer.locked ? "bg-amber-100" : ""}`}
                  title={layer.locked ? "Déverrouiller ce calque" : "Verrouiller ce calque"}
                >
                  {layer.locked ? (
                    <Lock className="h-3.5 w-3.5 text-amber-600" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5 text-slate-400" />
                  )}
                </button>
                {/* Bouton œil pour afficher/masquer */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLayersChange(layers.map((l) => (l.id === layer.id ? { ...l, visible: !l.visible } : l)));
                  }}
                  className="p-1 rounded hover:bg-slate-200 transition-colors"
                  title={layer.visible ? "Masquer ce calque" : "Afficher ce calque"}
                >
                  {layer.visible ? (
                    <Eye className="h-3.5 w-3.5 text-slate-500" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                  )}
                </button>
              </div>
            );
          })}

        {/* Bouton + pour ajouter un calque */}
        <button
          onClick={() => {
            const newLayer: SchemaLayer = {
              id: `layer-${Date.now()}`,
              name: `Calque ${layers.length + 1}`,
              color: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"][
                layers.length % 8
              ],
              visible: true,
              locked: false,
              order: Math.max(...layers.map((l) => l.order), -1) + 1,
            };
            handleLayersChange([...layers, newLayer]);
            setActiveLayerId(newLayer.id);
            setEditingLayerId(newLayer.id); // Passer en mode édition directement
          }}
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-white/70 transition-colors flex-shrink-0"
          title="Ajouter un calque"
        >
          <Plus className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Ligne 3 : Barre d'outils avancée */}
      <TooltipProvider>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-slate-50 rounded-lg shrink-0">
          <div className="flex items-center gap-1">
            {/* Copier/Coller */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copySelectedNodes}
                  disabled={selectedNodes.length === 0}
                  className="h-8 px-2"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copier (Ctrl+C)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={pasteNodes} disabled={!clipboard} className="h-8 px-2">
                  <Clipboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Coller (Ctrl+V)</TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-gray-300 mx-1" />

            {/* Grille magnétique */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={snapToGrid ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSnapToGrid(!snapToGrid)}
                  className="h-8 px-2"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Grille magnétique ({snapToGrid ? "activée" : "désactivée"})</TooltipContent>
            </Tooltip>

            {/* Annotations */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isAnnotationMode ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setIsAnnotationMode(!isAnnotationMode)}
                  className="h-8 px-2"
                >
                  <StickyNote className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mode annotation (clic pour ajouter une note)</TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-gray-300 mx-1" />

            {/* Validation */}
            <SchemaValidation
              items={items}
              edges={edges}
              isExpanded={showValidation}
              onToggleExpand={() => setShowValidation(!showValidation)}
            />
          </div>

          <div className="flex items-center gap-1">
            {/* Templates */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTemplatesMode("load");
                    setShowTemplatesDialog(true);
                  }}
                  className="h-8 gap-1"
                >
                  <LayoutTemplate className="h-4 w-4" />
                  <span className="text-xs hidden sm:inline">Templates</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bibliothèque de templates</TooltipContent>
            </Tooltip>

            {selectedNodes.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTemplatesMode("save");
                      setShowTemplatesDialog(true);
                    }}
                    className="h-8 gap-1"
                  >
                    <Save className="h-4 w-4" />
                    <span className="text-xs">Sauver template</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sauvegarder la sélection comme template</TooltipContent>
              </Tooltip>
            )}

            <div className="w-px h-5 bg-gray-300 mx-1" />

            {/* Légende */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showLegend ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setShowLegend(!showLegend)}
                  className="h-8 px-2"
                >
                  <Ruler className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Légende ({showLegend ? "visible" : "masquée"})</TooltipContent>
            </Tooltip>

            {/* Export */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)} className="h-8 gap-1">
                  <FileDown className="h-4 w-4" />
                  <span className="text-xs hidden sm:inline">Exporter</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exporter en PNG/PDF</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>

      {/* Canvas ReactFlow */}
      <div ref={reactFlowWrapper} className="flex-1 border rounded-lg overflow-hidden bg-white relative">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Cable className="h-16 w-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium">Aucun équipement électrique</p>
            <p className="text-sm mt-1 mb-4">Ajoutez des articles depuis le scénario ou le catalogue</p>
            <div className="flex items-center gap-3">
              <Button
                variant="default"
                onClick={() => {
                  setScenarioOpen(true);
                  loadScenarioItems();
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Depuis le scénario
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCatalogOpen(true);
                  loadCatalogItems();
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Depuis le catalogue
              </Button>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={flowEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
            onEdgeDoubleClick={(_, edge) => {
              setEdges((prev) => prev.filter((e) => e.id !== edge.id));
              setSelectedEdgeId(null);
            }}
            onNodeClick={(_, node) => {
              console.log("=== NODE CLICK ===");
              console.log("Node ID:", node.id);
              console.log("isDefiningCircuit:", isDefiningCircuit);
              console.log("circuitSource:", circuitSource);
              console.log("circuitDest:", circuitDest);

              // Mode définition de circuit
              if (isDefiningCircuit) {
                if (!circuitSource) {
                  // Premier clic = source
                  console.log("Définition SOURCE:", node.id);
                  setCircuitSource(node.id);
                  setCircuitDest(null);
                } else if (node.id !== circuitSource) {
                  // Deuxième clic = destination (on stocke, on ne crée pas encore)
                  console.log("Définition DESTINATION:", node.id);
                  setCircuitDest(node.id);
                }
              }
            }}
            onPaneClick={(event) => {
              setSelectedEdgeId(null);
              setSelectedAnnotationId(null);

              // Annuler le mode définition de circuit si on clique dans le vide
              if (isDefiningCircuit) {
                setIsDefiningCircuit(false);
                setCircuitSource(null);
                setCircuitDest(null);
              }

              // Mode annotation : ajouter une note au clic
              if (isAnnotationMode) {
                // Calculer la position dans le flow à partir des coordonnées écran
                const bounds = reactFlowWrapper.current?.getBoundingClientRect();
                if (bounds) {
                  const flowX = (event.clientX - bounds.left - currentViewport.x) / currentViewport.zoom;
                  const flowY = (event.clientY - bounds.top - currentViewport.y) / currentViewport.zoom;
                  addAnnotation({ x: flowX, y: flowY });
                }
              }
            }}
            onMove={(_, viewport) => setCurrentViewport(viewport)}
            nodeTypes={blockNodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            deleteKeyCode={null}
            selectionKeyCode="Shift"
            multiSelectionKeyCode="Shift"
            selectionOnDrag
            selectNodesOnDrag={false}
            panOnDrag={[1, 2]}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            defaultEdgeOptions={{
              type: "customSmooth",
              style: { strokeWidth: 2 },
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                const item = (node.data as any)?.item as ElectricalItem;
                if (!item) return "#e2e8f0";
                const config = ELECTRICAL_TYPES[item.type_electrique];
                if (!config) return "#e2e8f0";
                switch (config.category) {
                  case "production":
                    return "#fef08a";
                  case "stockage":
                    return "#bbf7d0";
                  case "consommateur":
                    return "#fecaca";
                  case "regulation":
                    return "#bfdbfe";
                  case "conversion":
                    return "#e9d5ff";
                  default:
                    return "#e2e8f0";
                }
              }}
              maskColor="rgba(0,0,0,0.1)"
              style={{ bottom: 60 }}
            />
            {/* Panel Calcul automatique des sections */}
            <Panel position="top-left">
              <div className="flex flex-col gap-2">
                {/* Bouton Rafraîchir depuis catalogue */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-white/95 hover:bg-blue-50 border-blue-300 text-blue-700"
                  onClick={refreshItemsFromCatalog}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Rafraîchir types
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-white/95 hover:bg-emerald-50 border-emerald-300 text-emerald-700"
                    >
                      <Calculator className="h-3.5 w-3.5" />
                      Auto-sections
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <div className="p-3 border-b bg-gradient-to-r from-emerald-50 to-green-50">
                      <h4 className="font-semibold text-emerald-800 flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Calcul automatique des sections
                      </h4>
                      <p className="text-xs text-emerald-600 mt-1">
                        Calcule la section de chaque câble selon le flux de puissance qui le traverse
                      </p>
                    </div>

                    <div className="p-3 space-y-3">
                      {/* Aperçu des calculs */}
                      {(() => {
                        const calculations = calculateAllEdgeSections();
                        const withPower = calculations.filter((c) => c.power > 0);
                        const withoutPower = calculations.filter((c) => c.power === 0);

                        // Grouper par circuit (si défini) ou par segment
                        const uniqueSegments = withPower.filter((calc, index) => {
                          // Si circuit défini, grouper par circuit
                          if (calc.circuitNumber !== undefined) {
                            const firstIndex = withPower.findIndex((c) => c.circuitNumber === calc.circuitNumber);
                            return firstIndex === index;
                          }
                          // Sinon grouper par segment
                          const firstIndex = withPower.findIndex(
                            (c) =>
                              c.allEdgeIdsInSegment &&
                              calc.allEdgeIdsInSegment &&
                              c.allEdgeIdsInSegment[0] === calc.allEdgeIdsInSegment[0],
                          );
                          return firstIndex === index;
                        });

                        return (
                          <>
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="bg-emerald-50 rounded p-2 text-center">
                                <div className="text-emerald-600">Circuits</div>
                                <div className="font-bold text-lg text-emerald-800">{uniqueSegments.length}</div>
                              </div>
                              <div className="bg-blue-50 rounded p-2 text-center">
                                <div className="text-blue-600">Câbles</div>
                                <div className="font-bold text-lg text-blue-800">{withPower.length}</div>
                              </div>
                              <div className="bg-gray-50 rounded p-2 text-center">
                                <div className="text-gray-500">Sans puissance</div>
                                <div className="font-bold text-lg text-gray-600">{withoutPower.length}</div>
                              </div>
                            </div>

                            {/* Liste des circuits/segments */}
                            {uniqueSegments.length > 0 && (
                              <div className="max-h-64 overflow-y-auto space-y-1.5 border rounded p-2 bg-gray-50">
                                {uniqueSegments.map((calc) => (
                                  <div
                                    key={calc.edgeId}
                                    className={`text-xs bg-white rounded p-2 border cursor-pointer transition-all ${
                                      calc.circuitNumber !== undefined ? "border-l-4 border-l-amber-400" : ""
                                    } ${
                                      hoveredCircuitEdgeIds.length > 0 &&
                                      calc.allEdgeIdsInCircuit.some((id) => hoveredCircuitEdgeIds.includes(id))
                                        ? "ring-2 ring-emerald-400 bg-emerald-50"
                                        : ""
                                    }`}
                                    onMouseEnter={() =>
                                      setHoveredCircuitEdgeIds(
                                        calc.allEdgeIdsInCircuit.length > 0 ? calc.allEdgeIdsInCircuit : [calc.edgeId],
                                      )
                                    }
                                    onMouseLeave={() => setHoveredCircuitEdgeIds([])}
                                  >
                                    <div className="flex justify-between items-center">
                                      <span
                                        className="text-gray-700 truncate flex-1"
                                        title={`${calc.sourceNom} → ${calc.realTargetNom}`}
                                      >
                                        {calc.circuitNumber !== undefined && (
                                          <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-amber-100 border border-amber-400 text-amber-700 rounded-full mr-1.5">
                                            {calc.circuitNumber}
                                          </span>
                                        )}
                                        {calc.sourceNom.length > 18
                                          ? calc.sourceNom.substring(0, 18) + "..."
                                          : calc.sourceNom}
                                        <span className="text-gray-400 mx-1">→</span>
                                        {calc.realTargetNom.length > 18
                                          ? calc.realTargetNom.substring(0, 18) + "..."
                                          : calc.realTargetNom}
                                      </span>
                                      <span className="font-bold text-emerald-700 ml-2 bg-emerald-50 px-1.5 py-0.5 rounded">
                                        {calc.section}mm²
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-1 flex flex-wrap gap-x-2">
                                      <span>⚡ {calc.power}W</span>
                                      <span>@ {calc.voltage}V</span>
                                      <span>= {calc.intensity.toFixed(1)}A</span>
                                      <span className={calc.hasDefinedLength ? "text-blue-600" : "text-amber-500"}>
                                        📏 {calc.circuitTotalLength > 0 ? calc.circuitTotalLength.toFixed(1) : "?"}m
                                        {calc.circuitNumber !== undefined &&
                                          ` (circuit ${calc.allEdgeIdsInCircuit.length} câbles)`}
                                        {!calc.hasDefinedLength &&
                                          calc.circuitTotalLength > 0 &&
                                          !calc.circuitNumber &&
                                          " (estimé)"}
                                      </span>
                                    </div>
                                    {calc.details.length > 1 && (
                                      <div className="text-[10px] text-purple-600 mt-0.5 bg-purple-50 rounded px-1 py-0.5">
                                        📋{" "}
                                        {calc.details
                                          .map(
                                            (d) => `${d.nom.substring(0, 12)}${d.quantite > 1 ? `×${d.quantite}` : ""}`,
                                          )
                                          .join(" + ")}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {uniqueSegments.length === 0 && (
                              <div className="text-xs text-amber-600 bg-amber-50 rounded p-2">
                                ⚠️ Aucun circuit ne peut être calculé. Vérifiez que les équipements ont une puissance
                                définie et que les numéros de circuit sont assignés aux handles.
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Bouton appliquer */}
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          applyCalculatedSections();
                        }}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Appliquer les sections calculées
                      </Button>

                      {/* Note */}
                      <p className="text-[10px] text-gray-500 leading-tight">
                        💡 Les tensions d'entrée/sortie des convertisseurs (MPPT, onduleur...) sont utilisées pour
                        calculer l'intensité correcte sur chaque segment.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </Panel>

            <Panel position="top-right">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-7 h-7 bg-white/90 hover:bg-white rounded-full shadow border flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
                    <span className="text-sm font-semibold">?</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3 text-xs text-gray-600 space-y-1.5" align="end">
                  <div>
                    💡 Glissez depuis les points <span className="text-green-600 font-semibold">verts</span> vers les{" "}
                    <span className="text-blue-600 font-semibold">bleus</span>
                  </div>
                  <div>
                    🖱️ <span className="font-semibold">Shift+clic</span> = sélection multiple
                  </div>
                  <div>
                    ✋ <span className="font-semibold">Molette/clic droit</span> = naviguer
                  </div>
                  <div>
                    🔍 <span className="font-semibold">Double-clic câble</span> = supprimer
                  </div>
                </PopoverContent>
              </Popover>
            </Panel>

            {/* Panel d'alignement - visible quand plusieurs nodes sont sélectionnés */}
            {selectedNodes.length >= 2 && (
              <Panel position="top-center">
                <div className="bg-white rounded-lg shadow-lg border px-3 py-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">{selectedNodes.length} sélectionnés</span>
                  <div className="w-px h-5 bg-gray-200" />
                  <button
                    onClick={alignNodesHorizontally}
                    className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                    title="Aligner horizontalement (même ligne)"
                  >
                    <AlignCenterVertical className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    onClick={alignNodesVertically}
                    className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                    title="Aligner verticalement (même colonne)"
                  >
                    <AlignCenterHorizontal className="h-4 w-4 text-gray-600" />
                  </button>
                  {selectedNodes.length >= 3 && (
                    <>
                      <div className="w-px h-5 bg-gray-200" />
                      <button
                        onClick={distributeNodesHorizontally}
                        className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                        title="Distribuer horizontalement (espacement égal)"
                      >
                        <AlignHorizontalSpaceAround className="h-4 w-4 text-gray-600" />
                      </button>
                      <button
                        onClick={distributeNodesVertically}
                        className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                        title="Distribuer verticalement (espacement égal)"
                      >
                        <AlignVerticalSpaceAround className="h-4 w-4 text-gray-600" />
                      </button>
                    </>
                  )}
                </div>
              </Panel>
            )}

            {selectedEdgeId && selectedEdge && (
              <Panel position="bottom-center">
                <div className="bg-white rounded-lg shadow-lg p-3 border space-y-2 max-w-2xl">
                  {/* Ligne 1 : Circuit */}
                  <div className="flex items-center gap-3 px-2 py-1.5 bg-slate-50 rounded border border-slate-200 text-xs">
                    <div className="flex items-center gap-1">
                      <Cable className="h-3 w-3 text-slate-600" />
                      <span className="text-slate-700 font-medium">Circuit:</span>
                    </div>

                    {selectedCircuitInfo?.circuitId ? (
                      <>
                        <span className="font-medium text-slate-800 bg-white px-2 py-0.5 rounded border">
                          {selectedCircuitInfo.circuitName}
                        </span>
                        {selectedCircuitInfo.power > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {selectedCircuitInfo.power} W
                          </Badge>
                        )}
                        {selectedCircuitInfo.totalLength > 0 && (
                          <span className="text-slate-600">
                            {selectedCircuitInfo.totalLength.toFixed(1)}m ({selectedCircuitInfo.cableCount} câbles)
                          </span>
                        )}
                        {/* Afficher la section (sauvegardée ou calculée) */}
                        {(selectedEdge.section_mm2 || selectedCircuitInfo.calculatedSection) && (
                          <span className="font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                            → {selectedEdge.section_mm2 || selectedCircuitInfo.calculatedSection} mm²
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 text-red-500 hover:text-red-600"
                          onClick={() => deleteCircuit(selectedCircuitInfo.circuitId!)}
                          title="Supprimer ce circuit"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-500 italic">Non défini</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs gap-1"
                          onClick={() => {
                            setIsDefiningCircuit(true);
                            setCircuitSource(null);
                            setCircuitDest(null);
                          }}
                        >
                          <Zap className="h-3 w-3" />
                          Définir circuit
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Mode définition de circuit - Nouvelle UI complète */}
                  {isDefiningCircuit && (
                    <div className="space-y-2 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-300">
                      {/* Titre */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          Définition du circuit
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-gray-500 hover:text-red-500"
                          onClick={() => {
                            setIsDefiningCircuit(false);
                            setCircuitSource(null);
                            setCircuitDest(null);
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Annuler
                        </Button>
                      </div>

                      {/* Source et Destination côte à côte */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Source */}
                        <div
                          className={`p-2 rounded border ${circuitSource ? "bg-green-50 border-green-300" : "bg-white border-dashed border-gray-300"}`}
                        >
                          <div className="text-xs font-medium text-gray-500 mb-1">Source</div>
                          {circuitSource ? (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="text-sm font-medium text-gray-800 truncate">
                                {items.find((i) => i.id === circuitSource)?.nom_accessoire || "Inconnu"}
                              </span>
                            </div>
                          ) : (
                            <div className="text-sm text-amber-600 flex items-center gap-1">
                              <span className="animate-pulse">👆</span>
                              Cliquez sur un bloc
                            </div>
                          )}
                        </div>

                        {/* Destination */}
                        <div
                          className={`p-2 rounded border ${circuitDest ? "bg-blue-50 border-blue-300" : circuitSource ? "bg-white border-dashed border-amber-300" : "bg-gray-50 border-gray-200"}`}
                        >
                          <div className="text-xs font-medium text-gray-500 mb-1">Destination</div>
                          {circuitDest ? (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              <span className="text-sm font-medium text-gray-800 truncate">
                                {items.find((i) => i.id === circuitDest)?.nom_accessoire || "Inconnu"}
                              </span>
                            </div>
                          ) : circuitSource ? (
                            <div className="text-sm text-amber-600 flex items-center gap-1">
                              <span className="animate-pulse">👆</span>
                              Cliquez sur un bloc
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">En attente...</div>
                          )}
                        </div>
                      </div>

                      {/* Calcul de section (affiché quand source et dest sont définis) */}
                      {circuitSource &&
                        circuitDest &&
                        (() => {
                          // Calculer les infos du circuit
                          const sourceItem = items.find((i) => i.id === circuitSource);
                          const destItem = items.find((i) => i.id === circuitDest);
                          const edgeIds = findEdgesBetweenNodes(circuitSource, circuitDest);

                          // Calculer la longueur totale
                          let totalLength = 0;
                          edgeIds.forEach((edgeId) => {
                            const edge = edges.find((e) => e.id === edgeId);
                            if (edge?.length_m) totalLength += edge.length_m;
                          });

                          // Détecter si points de distribution
                          const sourceIsDistribution = sourceItem ? isDistributionPoint(sourceItem) : false;
                          const destIsDistribution = destItem ? isDistributionPoint(destItem) : false;

                          // Puissance et tension du circuit - logique améliorée
                          let power = 0;
                          let voltage = 12; // Défaut
                          let powerSource = "";
                          let powerDetails: {
                            id: string;
                            nom: string;
                            puissance: number;
                            quantite: number;
                            total: number;
                          }[] = [];

                          // CAS 1: Source est un point de distribution
                          if (sourceIsDistribution && sourceItem) {
                            const result = sumUpstreamPowersWithDetails(circuitSource, new Set([circuitDest]));
                            power = result.total;
                            powerDetails = result.details;
                            voltage = getOutputVoltage(sourceItem);
                            powerSource = "somme amont";
                          }
                          // CAS 2: Destination est un point de distribution
                          else if (destIsDistribution && destItem) {
                            const result = sumDownstreamPowersWithDetails(circuitDest, new Set([circuitSource]));
                            power = result.total;
                            powerDetails = result.details;
                            voltage = getInputVoltage(destItem);
                            powerSource = "somme aval";
                          }
                          // CAS 3: Pas de distribution - logique standard
                          else {
                            // 1. D'abord essayer sur la source directe
                            if (sourceItem?.puissance_watts && sourceItem.puissance_watts > 0) {
                              power = sourceItem.puissance_watts * (sourceItem.quantite || 1);
                              voltage = getOutputVoltage(sourceItem);
                              powerSource = "source";
                            }
                            // 2. Sinon essayer sur la destination directe
                            else if (destItem?.puissance_watts && destItem.puissance_watts > 0) {
                              power = destItem.puissance_watts * (destItem.quantite || 1);
                              voltage = getInputVoltage(destItem);
                              powerSource = "destination";
                            }
                            // 3. Sinon remonter le graphe depuis la source
                            else {
                              power = findUpstreamPower(circuitSource, new Set());
                              voltage = sourceItem ? getOutputVoltage(sourceItem) : 12;
                              if (power > 0) {
                                powerSource = "amont";
                              } else {
                                // 4. Sinon descendre depuis la destination
                                power = findDownstreamPower(circuitDest, new Set());
                                voltage = destItem ? getInputVoltage(destItem) : 12;
                                if (power > 0) {
                                  powerSource = "aval";
                                }
                              }
                            }
                          }

                          // Calculer l'intensité
                          const intensity = power > 0 && voltage > 0 ? power / voltage : 0;

                          // Section recommandée - AVEC LA BONNE TENSION !
                          const section =
                            power > 0 && totalLength > 0 ? quickCalculate(power, totalLength, voltage) : null;

                          return (
                            <div className="space-y-2 pt-2 border-t border-amber-200">
                              {/* Infos du circuit */}
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="bg-white rounded p-2 text-center">
                                  <div className="text-gray-500">Câbles</div>
                                  <div className="font-bold text-lg text-gray-800">{edgeIds.length}</div>
                                </div>
                                <div className="bg-white rounded p-2 text-center">
                                  <div className="text-gray-500">Longueur</div>
                                  <div className="font-bold text-lg text-gray-800">{totalLength.toFixed(1)}m</div>
                                </div>
                                <div className="bg-white rounded p-2 text-center">
                                  <div className="text-gray-500">Puissance</div>
                                  <div className="font-bold text-lg text-gray-800">{power > 0 ? `${power}W` : "?"}</div>
                                  {powerSource && !["source", "destination"].includes(powerSource) && (
                                    <div className="text-[10px] text-blue-600">({powerSource})</div>
                                  )}
                                </div>
                              </div>

                              {/* Détail des équipements si point de distribution */}
                              {powerDetails.length > 0 && (
                                <div className="bg-amber-50 rounded p-2 text-xs border border-amber-200">
                                  <div className="font-medium text-amber-800 mb-1 flex items-center gap-1">
                                    📋 Équipements pris en compte ({powerDetails.length})
                                  </div>
                                  <div className="space-y-0.5 max-h-24 overflow-y-auto">
                                    {powerDetails.map((detail, idx) => (
                                      <div
                                        key={detail.id}
                                        className="flex justify-between items-center text-amber-700 bg-white/50 rounded px-1.5 py-0.5"
                                      >
                                        <span className="truncate flex-1" title={detail.nom}>
                                          {detail.quantite > 1 && (
                                            <span className="font-medium">{detail.quantite}× </span>
                                          )}
                                          {detail.nom.length > 30 ? detail.nom.substring(0, 30) + "..." : detail.nom}
                                        </span>
                                        <span className="font-medium ml-2 whitespace-nowrap">
                                          {detail.total}W
                                          {detail.quantite > 1 && (
                                            <span className="text-amber-500 text-[10px] ml-1">
                                              ({detail.puissance}W×{detail.quantite})
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="border-t border-amber-200 mt-1 pt-1 flex justify-between font-medium text-amber-800">
                                    <span>Total</span>
                                    <span>{power}W</span>
                                  </div>
                                </div>
                              )}

                              {/* Détail calcul : Tension et Intensité */}
                              {power > 0 && (
                                <div className="bg-blue-50 rounded p-2 text-xs text-blue-700 flex items-center justify-between">
                                  <span>
                                    💡 {power}W ÷ <strong>{voltage}V</strong> = <strong>{intensity.toFixed(2)}A</strong>
                                  </span>
                                  {(() => {
                                    // Déterminer la source de la tension
                                    const hasTensionVolts =
                                      sourceItem?.tension_volts ||
                                      sourceItem?.tension_sortie_volts ||
                                      sourceItem?.tension_entree_volts;
                                    const extractedFromName =
                                      !hasTensionVolts && extractVoltageFromName(sourceItem?.nom_accessoire || "");

                                    if (hasTensionVolts) {
                                      return null; // Pas de message, tension définie
                                    } else if (extractedFromName) {
                                      return <span className="text-blue-600">(extrait du nom)</span>;
                                    } else {
                                      return (
                                        <span className="text-amber-600 font-medium">
                                          ⚠️ 12V par défaut - cliquer sur ✏️ pour modifier
                                        </span>
                                      );
                                    }
                                  })()}
                                </div>
                              )}

                              {/* Section recommandée */}
                              {section && (
                                <div className="bg-green-100 rounded p-2 flex items-center justify-between">
                                  <span className="text-sm text-green-800">Section recommandée:</span>
                                  <Badge className="bg-green-600 text-white font-bold">{section} mm²</Badge>
                                </div>
                              )}

                              {!section && power === 0 && (
                                <div className="bg-amber-50 rounded p-2 text-center text-amber-700 text-sm">
                                  ⚠️ Puissance non trouvée - section non calculable
                                </div>
                              )}

                              {edgeIds.length === 0 && (
                                <div className="bg-red-100 rounded p-2 text-center text-red-700 text-sm">
                                  ⚠️ Aucun câble trouvé entre ces blocs
                                </div>
                              )}

                              {/* Bouton créer circuit */}
                              {edgeIds.length > 0 && (
                                <Button
                                  className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                                  onClick={() => {
                                    defineCircuit(circuitSource, circuitDest);
                                  }}
                                >
                                  <Zap className="h-4 w-4 mr-2" />
                                  Créer le circuit ({edgeIds.length} câble{edgeIds.length > 1 ? "s" : ""})
                                </Button>
                              )}
                            </div>
                          );
                        })()}
                    </div>
                  )}

                  {/* Ligne 2 : Contrôles */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Couleur */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600">Couleur:</span>
                      <div className="flex gap-1">
                        {CABLE_COLORS.map((cable) => (
                          <button
                            key={cable.value}
                            className={`w-5 h-5 rounded-full border-2 transition-all ${selectedEdge.color === cable.value ? "border-blue-500 scale-110" : "border-gray-300"}`}
                            style={{ backgroundColor: cable.value }}
                            onClick={() => updateEdgeColor(cable.value)}
                            title={cable.label}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="w-px h-6 bg-gray-200" />

                    {/* Épaisseur */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600">Épaisseur:</span>
                      <div className="flex gap-1">
                        {STROKE_WIDTHS.map((sw) => (
                          <button
                            key={sw.value}
                            className={`px-2 py-1 text-xs rounded border transition-all ${(selectedEdge.strokeWidth || 2) === sw.value ? "bg-blue-500 text-white border-blue-500" : "bg-white border-gray-300 hover:border-gray-400"}`}
                            onClick={() => updateEdgeStrokeWidth(sw.value)}
                            title={sw.label}
                          >
                            {sw.value}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="w-px h-6 bg-gray-200" />

                    {/* Longueur du câble */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600">Ce câble:</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={selectedEdge.length_m || ""}
                        onChange={(e) => {
                          const length = parseFloat(e.target.value) || 0;
                          updateCableLength(selectedEdgeId, length);
                        }}
                        placeholder="0"
                        className="w-14 h-7 px-2 text-xs border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-400">m</span>
                    </div>

                    {/* Section manuelle (si pas de circuit défini) */}
                    {!selectedCircuitInfo?.circuitId && (
                      <>
                        <div className="w-px h-6 bg-gray-200" />
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600">Section:</span>
                          <select
                            value={selectedEdge.section || ""}
                            onChange={(e) => updateEdgeSection(e.target.value)}
                            className="h-7 px-2 text-xs border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Manuel</option>
                            {CABLE_SECTIONS.map((section) => (
                              <option key={section} value={section}>
                                {section}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    <div className="w-px h-6 bg-gray-200" />

                    {/* Pont (passer au-dessus) */}
                    <button
                      onClick={toggleEdgeBridge}
                      className={`px-2 py-1 text-xs rounded border transition-all flex items-center gap-1 ${selectedEdge.bridge ? "bg-amber-500 text-white border-amber-500" : "bg-white border-gray-300 hover:border-gray-400"}`}
                      title="Faire passer le câble au-dessus des autres"
                    >
                      <span className="text-sm">⌒</span>
                      Pont
                    </button>

                    <div className="w-px h-6 bg-gray-200" />

                    {/* Supprimer */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={deleteSelectedEdge}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Panel>
            )}
            {/* Layer annotations - à l'intérieur de ReactFlow pour suivre le viewport */}
            <SchemaAnnotationsLayer
              annotations={annotations}
              zoom={currentViewport.zoom}
              viewport={currentViewport}
              selectedAnnotationId={selectedAnnotationId}
              onSelectAnnotation={setSelectedAnnotationId}
              onUpdateAnnotation={updateAnnotation}
              onDeleteAnnotation={deleteAnnotation}
              onAddAnnotation={addAnnotation}
            />
          </ReactFlow>
        )}

        {/* Légende améliorée */}
        {items.length > 0 && (
          <SchemaLegend
            items={items}
            edges={edges}
            layers={layers}
            isVisible={showLegend}
            onToggleVisibility={() => setShowLegend(!showLegend)}
            position="bottom-right"
          />
        )}
      </div>

      {/* Dialog Export */}
      <SchemaExport
        reactFlowWrapper={reactFlowWrapper}
        projectName={projectId}
        schemaName="Schéma électrique"
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />

      {/* Dialog Templates */}
      <SchemaTemplates
        items={items}
        edges={edges}
        layers={layers}
        positions={nodes.reduce((acc, n) => ({ ...acc, [n.id]: n.position }), {})}
        nodeHandles={nodeHandles}
        scenarioItems={scenarioItems}
        onInsertTemplate={handleInsertTemplate}
        isOpen={showTemplatesDialog}
        onClose={() => setShowTemplatesDialog(false)}
        mode={templatesMode}
      />

      {/* Dialog Édition Item */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent
          className={(() => {
            if (!editingItem) return "sm:max-w-[425px]";
            const typeConfig = ELECTRICAL_TYPES[editingItem.type_electrique];
            const isDistribution = typeConfig?.category === "distribution" || typeConfig?.category === "distributeur";
            return isDistribution ? "sm:max-w-[600px]" : "sm:max-w-[425px]";
          })()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Modifier {editingItem?.nom_accessoire?.slice(0, 30)}...
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto">
            {/* Puissance - différent pour les points de distribution */}
            {(() => {
              const typeConfig = editingItem ? ELECTRICAL_TYPES[editingItem.type_electrique] : null;
              const isDistribution = typeConfig?.category === "distribution" || typeConfig?.category === "distributeur";

              if (isDistribution && editingItem) {
                // Pour les busbars: utiliser les types de flux définis sur chaque handle
                // C'est l'utilisateur qui définit si un handle est une entrée de production,
                // une sortie de consommation, etc.

                const busbarFluxTypes = nodeHandleFluxTypes[editingItem.id] || {};

                // Fonction locale pour trouver la puissance en traversant les fusibles/protections
                const findPowerThroughChain = (startNodeId: string, busbarId: string): number => {
                  const visited = new Set<string>([busbarId]);

                  const traverse = (nodeId: string): number => {
                    if (visited.has(nodeId)) return 0;
                    visited.add(nodeId);

                    const item = items.find((i) => i.id === nodeId);
                    if (!item) return 0;

                    const typeConfig = ELECTRICAL_TYPES[item.type_electrique];
                    const category = typeConfig?.category || "autre";

                    // Si c'est un autre busbar, on s'arrête
                    if (category === "distribution" || category === "distributeur") return 0;

                    // Si cet item a une puissance propre (producteur ou consommateur), la retourner
                    const isTransmitter = ["regulation", "conversion", "protection"].includes(category);
                    if (item.puissance_watts && item.puissance_watts > 0 && !isTransmitter) {
                      return item.puissance_watts * (item.quantite || 1);
                    }

                    // Sinon, traverser les connexions pour trouver la source
                    let power = 0;

                    // Connexions entrantes
                    const incomingEdges = edges.filter((e) => e.target_node_id === nodeId);
                    for (const e of incomingEdges) {
                      power += traverse(e.source_node_id);
                    }

                    // Si rien trouvé et c'est un transmetteur, chercher aussi en sortie
                    if (power === 0 && isTransmitter) {
                      const outgoingEdges = edges.filter((e) => e.source_node_id === nodeId);
                      for (const e of outgoingEdges) {
                        power += traverse(e.target_node_id);
                      }
                    }

                    return power;
                  };

                  return traverse(startNodeId);
                };

                // Trouver TOUS les câbles connectés au busbar
                const connectedEdges = edges.filter(
                  (e) => e.source_node_id === editingItem.id || e.target_node_id === editingItem.id,
                );

                let totalProduction = 0;
                let totalConsumption = 0;
                let totalStockage = 0;
                const processedHandles = new Set<string>();

                // Pour chaque câble, regarder le type de flux du handle côté busbar
                connectedEdges.forEach((e) => {
                  // Quel handle du busbar est utilisé ?
                  const busbarHandle = e.source_node_id === editingItem.id ? e.source_handle : e.target_handle;

                  // Éviter de compter plusieurs fois le même handle
                  if (busbarHandle && processedHandles.has(busbarHandle)) return;
                  if (busbarHandle) processedHandles.add(busbarHandle);

                  // Quel équipement est de l'autre côté ?
                  const otherNodeId = e.source_node_id === editingItem.id ? e.target_node_id : e.source_node_id;

                  // Trouver la puissance en traversant la chaîne (fusibles, etc.)
                  const power = findPowerThroughChain(otherNodeId, editingItem.id);

                  // Utiliser le type de flux défini sur le handle du busbar
                  const fluxType = busbarHandle ? busbarFluxTypes[busbarHandle] : undefined;

                  if (fluxType === "production") {
                    totalProduction += power;
                  } else if (fluxType === "consommation") {
                    totalConsumption += power;
                  } else if (fluxType === "stockage") {
                    totalStockage += power;
                  }
                  // "neutre" ou undefined = pas comptabilisé
                });

                const hasValues = totalProduction > 0 || totalConsumption > 0 || totalStockage > 0;

                return (
                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-3 border border-emerald-200">
                    <div className="text-sm font-medium text-emerald-800 mb-2">
                      ⚡ Puissance calculée automatiquement
                    </div>
                    {hasValues ? (
                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                        {totalProduction > 0 && (
                          <div className="text-center">
                            <div className="text-2xl font-bold text-emerald-700">{totalProduction}W</div>
                            <div className="text-xs text-emerald-600">🔋 Production</div>
                          </div>
                        )}
                        {totalConsumption > 0 && (
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">{totalConsumption}W</div>
                            <div className="text-xs text-red-500">💡 Consommation</div>
                          </div>
                        )}
                        {totalStockage > 0 && (
                          <div className="text-center">
                            <div className="text-2xl font-bold text-amber-600">{totalStockage}W</div>
                            <div className="text-xs text-amber-500">🔌 Stockage</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 text-sm">
                        <p>Définissez le type de flux sur chaque handle</p>
                        <p className="text-xs mt-1">(double-clic sur un point de connexion)</p>
                      </div>
                    )}
                  </div>
                );
              }

              // Pour les autres types: champ éditable normal
              return (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-power" className="text-right">
                    Puissance
                  </Label>
                  <div className="col-span-3 flex items-center gap-2">
                    <Input
                      id="edit-power"
                      type="number"
                      value={editFormData.puissance_watts}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, puissance_watts: e.target.value }))}
                      placeholder="Ex: 190"
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-500 w-8">W</span>
                  </div>
                </div>
              );
            })()}

            {/* Tension entrée */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-voltage-in" className="text-right">
                Tension entrée
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="edit-voltage-in"
                  type="number"
                  value={editFormData.tension_entree_volts}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, tension_entree_volts: e.target.value }))}
                  placeholder="Ex: 24"
                  className="flex-1"
                />
                <span className="text-sm text-gray-500 w-8">V</span>
              </div>
            </div>

            {/* Tension sortie */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-voltage-out" className="text-right">
                Tension sortie
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="edit-voltage-out"
                  type="number"
                  value={editFormData.tension_sortie_volts}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, tension_sortie_volts: e.target.value }))}
                  placeholder="Ex: 12"
                  className="flex-1"
                />
                <span className="text-sm text-gray-500 w-8">V</span>
              </div>
            </div>

            {/* Capacité (pour batteries) */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-capacity" className="text-right">
                Capacité
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="edit-capacity"
                  type="number"
                  value={editFormData.capacite_ah}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, capacite_ah: e.target.value }))}
                  placeholder="Ex: 100"
                  className="flex-1"
                />
                <span className="text-sm text-gray-500 w-8">Ah</span>
              </div>
            </div>

            {/* Intensité max */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-current" className="text-right">
                Intensité max
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="edit-current"
                  type="number"
                  value={editFormData.intensite_amperes}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, intensite_amperes: e.target.value }))}
                  placeholder="Ex: 30"
                  className="flex-1"
                />
                <span className="text-sm text-gray-500 w-8">A</span>
              </div>
            </div>

            {/* Section connexions pour les points de distribution */}
            {editingItem &&
              (() => {
                const typeConfig = ELECTRICAL_TYPES[editingItem.type_electrique];
                const isDistribution =
                  typeConfig?.category === "distribution" || typeConfig?.category === "distributeur";

                if (!isDistribution) return null;

                // Fonction locale pour trouver la puissance en traversant les fusibles/protections
                const findPowerThroughChain = (startNodeId: string, busbarId: string): number => {
                  const visited = new Set<string>([busbarId]);

                  const traverse = (nodeId: string): number => {
                    if (visited.has(nodeId)) return 0;
                    visited.add(nodeId);

                    const item = items.find((i) => i.id === nodeId);
                    if (!item) return 0;

                    const typeConfig = ELECTRICAL_TYPES[item.type_electrique];
                    const category = typeConfig?.category || "autre";

                    // Si c'est un autre busbar, on s'arrête
                    if (category === "distribution" || category === "distributeur") return 0;

                    // Si cet item a une puissance propre, la retourner
                    const isTransmitter = ["regulation", "conversion", "protection"].includes(category);
                    if (item.puissance_watts && item.puissance_watts > 0 && !isTransmitter) {
                      return item.puissance_watts * (item.quantite || 1);
                    }

                    // Sinon, traverser les connexions pour trouver la source
                    let power = 0;

                    // Connexions entrantes
                    const incomingEdges = edges.filter((e) => e.target_node_id === nodeId);
                    for (const e of incomingEdges) {
                      power += traverse(e.source_node_id);
                    }

                    // Si rien trouvé et c'est un transmetteur, chercher aussi en sortie
                    if (power === 0 && isTransmitter) {
                      const outgoingEdges = edges.filter((e) => e.source_node_id === nodeId);
                      for (const e of outgoingEdges) {
                        power += traverse(e.target_node_id);
                      }
                    }

                    return power;
                  };

                  return traverse(startNodeId);
                };

                const busbarFluxTypes = nodeHandleFluxTypes[editingItem.id] || {};

                const connectedEdges = edges.filter(
                  (e) => e.source_node_id === editingItem.id || e.target_node_id === editingItem.id,
                );

                // Récupérer les équipements connectés avec leur handle et type de flux
                const connectedItems: {
                  item: ElectricalItem;
                  power: number;
                  handleId: string | undefined;
                  fluxType: HandleFluxType | undefined;
                }[] = [];

                connectedEdges.forEach((e) => {
                  const connectedId = e.source_node_id === editingItem.id ? e.target_node_id : e.source_node_id;
                  const busbarHandle = e.source_node_id === editingItem.id ? e.source_handle : e.target_handle;

                  const item = items.find((i) => i.id === connectedId);
                  if (!item) return;

                  // Trouver la puissance en traversant la chaîne (fusibles, etc.)
                  const power = findPowerThroughChain(connectedId, editingItem.id);
                  const fluxType = busbarHandle ? busbarFluxTypes[busbarHandle] : undefined;

                  connectedItems.push({ item, power, handleId: busbarHandle || undefined, fluxType });
                });

                // Grouper par type de flux défini sur le handle
                const productionItems = connectedItems.filter((i) => i.fluxType === "production");
                const consumptionItems = connectedItems.filter((i) => i.fluxType === "consommation");
                const storageItems = connectedItems.filter((i) => i.fluxType === "stockage");
                const neutralItems = connectedItems.filter((i) => !i.fluxType || i.fluxType === "neutre");

                const totalProduction = productionItems.reduce((sum, i) => sum + i.power, 0);
                const totalConsumption = consumptionItems.reduce((sum, i) => sum + i.power, 0);

                return (
                  <div className="border-t pt-4 mt-2">
                    <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Cable className="h-4 w-4" />
                      Connexions par handle
                    </div>

                    {/* Production */}
                    {productionItems.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-emerald-700 mb-1">
                          🔋 Production ({totalProduction}W)
                        </div>
                        <div className="space-y-1">
                          {productionItems.map(({ item, power, handleId }) => {
                            const config = ELECTRICAL_TYPES[item.type_electrique];
                            return (
                              <div
                                key={`${item.id}-${handleId}`}
                                className="text-xs bg-emerald-50 rounded px-2 py-1.5 border border-emerald-200"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`font-medium whitespace-nowrap ${config?.color || "text-gray-600"}`}>
                                    {config?.label || item.type_electrique}
                                    {handleId && <span className="text-gray-400 ml-1">({handleId})</span>}
                                  </span>
                                  <span className="font-bold text-emerald-700 whitespace-nowrap">{power}W</span>
                                </div>
                                <div className="text-gray-600 mt-0.5 break-words">{item.nom_accessoire}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Consommation */}
                    {consumptionItems.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-red-700 mb-1">
                          💡 Consommation ({totalConsumption}W)
                        </div>
                        <div className="space-y-1">
                          {consumptionItems.map(({ item, power, handleId }) => {
                            const config = ELECTRICAL_TYPES[item.type_electrique];
                            return (
                              <div
                                key={`${item.id}-${handleId}`}
                                className="text-xs bg-red-50 rounded px-2 py-1.5 border border-red-200"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`font-medium whitespace-nowrap ${config?.color || "text-gray-600"}`}>
                                    {config?.label || item.type_electrique}
                                    {handleId && <span className="text-gray-400 ml-1">({handleId})</span>}
                                  </span>
                                  <span className="font-bold text-red-700 whitespace-nowrap">{power}W</span>
                                </div>
                                <div className="text-gray-600 mt-0.5 break-words">{item.nom_accessoire}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Stockage */}
                    {storageItems.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-amber-700 mb-1">🔌 Stockage</div>
                        <div className="space-y-1">
                          {storageItems.map(({ item, power, handleId }) => {
                            const config = ELECTRICAL_TYPES[item.type_electrique];
                            return (
                              <div
                                key={`${item.id}-${handleId}`}
                                className="text-xs bg-amber-50 rounded px-2 py-1.5 border border-amber-200"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`font-medium whitespace-nowrap ${config?.color || "text-gray-600"}`}>
                                    {config?.label || item.type_electrique}
                                    {handleId && <span className="text-gray-400 ml-1">({handleId})</span>}
                                  </span>
                                  {power > 0 && (
                                    <span className="font-bold text-amber-700 whitespace-nowrap">{power}W</span>
                                  )}
                                </div>
                                <div className="text-gray-600 mt-0.5 break-words">{item.nom_accessoire}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Non définis */}
                    {neutralItems.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          ⚪ Non défini (double-clic sur le handle pour définir)
                        </div>
                        <div className="space-y-1">
                          {neutralItems.map(({ item, power, handleId }) => {
                            const config = ELECTRICAL_TYPES[item.type_electrique];
                            return (
                              <div
                                key={`${item.id}-${handleId}`}
                                className="text-xs bg-gray-50 rounded px-2 py-1.5 border border-gray-200"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`font-medium whitespace-nowrap ${config?.color || "text-gray-600"}`}>
                                    {config?.label || item.type_electrique}
                                    {handleId && <span className="text-gray-400 ml-1">({handleId})</span>}
                                  </span>
                                  {power > 0 && (
                                    <span className="font-bold text-gray-600 whitespace-nowrap">{power}W</span>
                                  )}
                                </div>
                                <div className="text-gray-600 mt-0.5 break-words">{item.nom_accessoire}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {connectedItems.length === 0 && (
                      <div className="text-xs text-gray-500 italic">
                        Aucune connexion détectée. Reliez ce point de distribution à d'autres éléments.
                      </div>
                    )}
                  </div>
                );
              })()}

            {/* TODO: Couplage Distributeur - désactivé temporairement pour debug */}

            {/* Info aide */}
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              <strong>💡 Astuce :</strong> Pour les convertisseurs (MPPT, DC/DC), indiquez la tension d'entrée et de
              sortie séparément. Le calcul de section de câble utilisera la bonne tension selon le segment du circuit.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Annuler
            </Button>
            <Button onClick={saveEditedItem}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============================================
// MODE DESSIN (existant)
// ============================================

// Constantes pour le snapping
const SNAP_ANGLE_THRESHOLD = 15;
const SNAP_DISTANCE = 10;

const CanvasInstance = ({ projectId, schemaNumber, onExpenseAdded, onSchemaDeleted }: CanvasInstanceProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const paperScopeRef = useRef<paper.PaperScope | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "draw" | "rectangle" | "circle" | "text" | "line" | "arrow">(
    "select",
  );
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isEditingText, setIsEditingText] = useState(false);
  const [textInputPosition, setTextInputPosition] = useState({ x: 0, y: 0 });
  const [editingTextItem, setEditingTextItem] = useState<any | null>(null);
  const [schemaId, setSchemaId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });

  // Refs pour éviter la réinitialisation du canvas
  const activeToolRef = useRef(activeTool);
  const colorRef = useRef(color);
  const strokeWidthRef = useRef(strokeWidth);

  // Mettre à jour les refs quand les états changent
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);

  // Gestion de la touche Suppr/Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && !isEditingText) {
        e.preventDefault();
        handleDelete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditingText]);

  // Ajuster la taille du canvas à la taille de l'écran
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = Math.min(window.innerHeight - 300, containerWidth * 0.6); // Ratio 16:10 max
        setCanvasSize({
          width: Math.max(800, containerWidth - 32), // Min 800px, -32px pour le padding
          height: Math.max(500, containerHeight),
        });
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Créer un PaperScope unique pour ce canvas
    const scope = new paper.PaperScope();
    scope.setup(canvasRef.current);
    paperScopeRef.current = scope;

    // Redimensionner le view pour correspondre au canvas
    scope.view.viewSize = new scope.Size(canvasSize.width, canvasSize.height);

    console.log("Paper.js initialized", scope.project, "Schema:", schemaNumber);

    // Charger les dessins depuis la base de données
    const loadDrawings = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("technical_schemas")
          .select("*")
          .eq("project_id", projectId)
          .eq("schema_number", schemaNumber)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setSchemaId((data as any).id);
          if ((data as any).schema_data) {
            scope.project.activeLayer.importJSON((data as any).schema_data);
            scope.view.update();
            console.log("Dessins chargés pour schéma", schemaNumber);
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement des dessins:", error);
      }
    };

    loadDrawings();

    // Variables pour le dessin
    let currentPath: any = null;
    let selectedItem: any = null;
    let handles: any[] = [];
    let draggedHandle: any = null;
    let lastClickTime = 0;
    let lastClickItem: any = null;

    // Fonction pour créer des poignées
    const createHandles = (item: any) => {
      // Supprimer les anciennes poignées
      handles.forEach((h) => h.remove());
      handles = [];

      if (item instanceof scope.Path && item.segments.length === 2) {
        // Poignées pour les lignes/flèches
        item.segments.forEach((segment: any, index: number) => {
          const handle = new scope.Path.Circle({
            center: segment.point,
            radius: 8, // Augmenté de 5 à 8 pour une meilleure prise
            fillColor: item.strokeColor,
            strokeColor: "white",
            strokeWidth: 3, // Augmenté pour plus de visibilité
          });
          handle.data.isHandle = true;
          handle.data.segmentIndex = index;
          handle.data.parentPath = item;
          handle.data.handleType = "line";
          handles.push(handle);
        });
      } else if (item instanceof scope.Path || item instanceof scope.Shape) {
        // Poignées pour les rectangles et cercles (4 coins + 4 bords)
        const bounds = item.bounds;
        const corners = [bounds.topLeft, bounds.topRight, bounds.bottomRight, bounds.bottomLeft];

        corners.forEach((corner: any, index: number) => {
          const handle = new scope.Path.Circle({
            center: corner,
            radius: 10, // Augmenté de 6 à 10 pour une meilleure prise
            fillColor: "#2196F3",
            strokeColor: "white",
            strokeWidth: 3, // Augmenté pour plus de visibilité
          });
          handle.data.isHandle = true;
          handle.data.cornerIndex = index;
          handle.data.parentItem = item;
          handle.data.handleType = "corner";
          handles.push(handle);
        });
      }
    };

    // Fonction pour mettre à jour les poignées
    const updateHandles = (item: any) => {
      if (item instanceof scope.Path && item.segments.length === 2 && handles.length === 2) {
        // Poignées de ligne
        handles[0].position = item.segments[0].point;
        handles[1].position = item.segments[1].point;
      } else if (handles.length === 4 && (item instanceof scope.Path || item instanceof scope.Shape)) {
        // Poignées de rectangle/cercle
        const bounds = item.bounds;
        handles[0].position = bounds.topLeft;
        handles[1].position = bounds.topRight;
        handles[2].position = bounds.bottomRight;
        handles[3].position = bounds.bottomLeft;
      }
    };

    // Fonction pour supprimer les poignées
    const removeHandles = () => {
      handles.forEach((h) => h.remove());
      handles = [];
    };

    // Fonction pour snapper horizontal/vertical
    const snapToHV = (from: any, to: any): any => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);

      if (angle < SNAP_ANGLE_THRESHOLD || angle > 180 - SNAP_ANGLE_THRESHOLD) {
        return new scope.Point(to.x, from.y);
      }
      if (Math.abs(angle - 90) < SNAP_ANGLE_THRESHOLD) {
        return new scope.Point(from.x, to.y);
      }
      return to;
    };

    // Fonction pour créer une tête de flèche
    const createArrowHead = (path: any): any => {
      if (path.segments.length < 2) return path;

      const lastPoint = path.segments[1].point;
      const firstPoint = path.segments[0].point;
      const vector = lastPoint.subtract(firstPoint);
      const angle = vector.angle;
      const headLength = 15;

      const arrowHead = new scope.Path([
        lastPoint.add(new scope.Point({ angle: angle + 150, length: headLength })),
        lastPoint,
        lastPoint.add(new scope.Point({ angle: angle - 150, length: headLength })),
      ]);

      arrowHead.strokeColor = path.strokeColor;
      arrowHead.strokeWidth = path.strokeWidth;
      arrowHead.fillColor = path.strokeColor;
      arrowHead.closed = true;
      arrowHead.data.isArrowHead = true;
      arrowHead.data.parentId = path.id;

      return arrowHead;
    };

    // Fonction pour mettre à jour la tête de flèche
    const updateArrowHead = (path: any) => {
      if (path.segments.length < 2) return;

      // Trouver et supprimer l'ancienne tête
      scope.project.activeLayer.children.forEach((item: any) => {
        if (item.data.isArrowHead && item.data.parentId === path.id) {
          item.remove();
        }
      });

      // Créer une nouvelle tête
      createArrowHead(path);
    };

    // Créer le tool
    const tool = new scope.Tool();

    tool.onMouseDown = (event: any) => {
      console.log("Mouse down", activeToolRef.current, event.point);

      // Vérifier si on clique sur une poignée avec une tolérance élargie
      const hitHandle = handles.find((h) => {
        const distance = h.position.getDistance(event.point);
        return distance <= 15; // Tolérance de 15 pixels pour faciliter la saisie
      });
      if (hitHandle) {
        draggedHandle = hitHandle;
        return;
      }

      // Vérifier si on clique sur un objet
      const hitResult = scope.project.activeLayer.hitTest(event.point, {
        fill: true,
        stroke: true,
        tolerance: 5,
      });

      // Détecter le double-clic manuellement
      const currentTime = Date.now();
      const isDoubleClick = hitResult && lastClickItem === hitResult.item && currentTime - lastClickTime < 300;

      lastClickTime = currentTime;
      lastClickItem = hitResult?.item || null;

      // Double-clic sur un texte = édition
      if (isDoubleClick && hitResult && hitResult.item instanceof scope.PointText) {
        const textItem = hitResult.item;
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        if (canvasRect) {
          setTextInputPosition({ x: textItem.point.x, y: textItem.point.y });
          setEditingTextItem(textItem);
          setIsEditingText(true);

          // Focus sur l'input au prochain render
          setTimeout(() => {
            if (textInputRef.current) {
              textInputRef.current.value = textItem.content;
              textInputRef.current.focus();
              textInputRef.current.select();
            }
          }, 0);
        }
        return;
      }

      if (activeToolRef.current === "select") {
        // Désélectionner l'ancien
        if (selectedItem) {
          selectedItem.selected = false;
        }
        removeHandles();

        // Sélectionner le nouveau (sauf les poignées et têtes de flèches)
        if (hitResult && !hitResult.item.data.isHandle && !hitResult.item.data.isArrowHead) {
          // Si l'élément fait partie d'un groupe, sélectionner le groupe entier
          if (hitResult.item.parent instanceof scope.Group && hitResult.item.parent.data.isAccessory) {
            selectedItem = hitResult.item.parent;
          } else {
            selectedItem = hitResult.item;
          }

          selectedItem.selected = true;

          // Créer des poignées pour les lignes/flèches
          if (selectedItem instanceof scope.Path && selectedItem.segments.length === 2) {
            createHandles(selectedItem);
          }
          // Créer des poignées pour les rectangles et cercles
          else if (selectedItem instanceof scope.Path || selectedItem instanceof scope.Shape) {
            createHandles(selectedItem);
          }
        } else {
          selectedItem = null;
        }
      } else if (activeToolRef.current === "text") {
        // Mode texte : créer un input temporaire
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        if (canvasRect) {
          setTextInputPosition({ x: event.point.x, y: event.point.y });
          setEditingTextItem(null);
          setIsEditingText(true);

          // Focus sur l'input au prochain render
          setTimeout(() => {
            textInputRef.current?.focus();
          }, 0);
        }
      } else if (activeToolRef.current === "line" || activeToolRef.current === "arrow") {
        currentPath = new scope.Path({
          segments: [event.point, event.point],
          strokeColor: colorRef.current,
          strokeWidth: strokeWidthRef.current,
          strokeCap: "round",
        });
        currentPath.data.type = activeToolRef.current;
        console.log("Created path", currentPath);
      } else if (activeToolRef.current === "draw") {
        currentPath = new scope.Path({
          strokeColor: colorRef.current,
          strokeWidth: strokeWidthRef.current,
          strokeCap: "round",
          strokeJoin: "round",
        });
        currentPath.add(event.point);
      }
    };

    tool.onMouseDrag = (event: any) => {
      // Déplacer une poignée
      if (draggedHandle) {
        if (draggedHandle.data.handleType === "line" && draggedHandle.data.parentPath) {
          // Poignée de ligne/flèche
          const path = draggedHandle.data.parentPath;
          const index = draggedHandle.data.segmentIndex;

          let newPoint = event.point;

          // Snapping horizontal/vertical
          if (!event.modifiers.shift) {
            const otherIndex = index === 0 ? 1 : 0;
            newPoint = snapToHV(path.segments[otherIndex].point, newPoint);
          }

          path.segments[index].point = newPoint;

          // Mettre à jour la tête de flèche si nécessaire
          if (path.data.type === "arrow") {
            updateArrowHead(path);
          }

          updateHandles(path);
        } else if (draggedHandle.data.handleType === "corner" && draggedHandle.data.parentItem) {
          // Poignée de rectangle/cercle
          const item = draggedHandle.data.parentItem;
          const cornerIndex = draggedHandle.data.cornerIndex;
          const bounds = item.bounds;

          // Calculer les nouvelles dimensions selon le coin déplacé
          let newBounds;
          if (cornerIndex === 0) {
            // Top Left
            newBounds = new scope.Rectangle(event.point, bounds.bottomRight);
          } else if (cornerIndex === 1) {
            // Top Right
            newBounds = new scope.Rectangle(
              new scope.Point(bounds.left, event.point.y),
              new scope.Point(event.point.x, bounds.bottom),
            );
          } else if (cornerIndex === 2) {
            // Bottom Right
            newBounds = new scope.Rectangle(bounds.topLeft, event.point);
          } else {
            // Bottom Left
            newBounds = new scope.Rectangle(
              new scope.Point(event.point.x, bounds.top),
              new scope.Point(bounds.right, event.point.y),
            );
          }

          // Appliquer les nouvelles dimensions
          if (item instanceof scope.Shape.Circle) {
            // Pour un cercle, garder le ratio et utiliser le plus grand côté
            const width = Math.abs(newBounds.width);
            const height = Math.abs(newBounds.height);
            const size = Math.max(width, height);
            const squareBounds = new scope.Rectangle(
              newBounds.center.subtract(new scope.Point(size / 2, size / 2)),
              new scope.Size(size, size),
            );
            item.bounds = squareBounds;
          } else {
            // Pour un rectangle
            item.bounds = newBounds;
          }

          updateHandles(item);
        }
        return;
      }

      // Dessiner
      if (currentPath) {
        if (activeToolRef.current === "draw") {
          currentPath.add(event.point);
        } else if (activeToolRef.current === "line" || activeToolRef.current === "arrow") {
          let newPoint = event.point;

          // Snapping
          if (!event.modifiers.shift) {
            newPoint = snapToHV(currentPath.segments[0].point, newPoint);
          }

          currentPath.segments[1].point = newPoint;
        }
      }

      // Déplacer un objet sélectionné
      if (selectedItem && activeToolRef.current === "select" && !draggedHandle) {
        selectedItem.position = selectedItem.position.add(event.delta);

        // Mettre à jour la tête de flèche si c'est une flèche (uniquement pour les Path)
        if (selectedItem instanceof scope.Path && selectedItem.data.type === "arrow") {
          updateArrowHead(selectedItem);
        }

        // Mettre à jour les handles pour tous les types d'objets
        updateHandles(selectedItem);
      }
    };

    tool.onMouseUp = (event: any) => {
      console.log("Mouse up", currentPath);

      draggedHandle = null;

      if (currentPath) {
        if (activeToolRef.current === "draw") {
          currentPath.simplify(10);
        } else if (activeToolRef.current === "arrow") {
          createArrowHead(currentPath);
        }

        // Sélectionner le path créé
        if (selectedItem) {
          selectedItem.selected = false;
        }
        removeHandles();

        selectedItem = currentPath;
        selectedItem.selected = true;

        if (selectedItem instanceof scope.Path && selectedItem.segments.length === 2) {
          createHandles(selectedItem);
        }

        currentPath = null;

        console.log("Active layer children:", scope.project.activeLayer.children.length);

        // Forcer le rendu du canvas
        scope.view.update();
      }
    };

    // Cleanup
    return () => {
      tool.remove();
    };
  }, [projectId, schemaNumber, canvasSize]); // Ajouter canvasSize pour recréer le canvas quand la taille change

  const handleTextSubmit = () => {
    if (!textInputRef.current || !paperScopeRef.current) return;

    const scope = paperScopeRef.current;

    const text = textInputRef.current.value.trim();

    if (text) {
      if (editingTextItem) {
        // Modifier le texte existant
        editingTextItem.content = text;
      } else {
        // Créer un nouveau texte
        new scope.PointText({
          point: [textInputPosition.x, textInputPosition.y],
          content: text,
          fillColor: colorRef.current,
          fontSize: 20,
        });
      }
      scope.view.update();
    } else if (editingTextItem && !text) {
      // Si le texte est vide lors de l'édition, supprimer l'élément
      editingTextItem.remove();
      scope.view.update();
    }

    setIsEditingText(false);
    setEditingTextItem(null);
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleTextSubmit();
    } else if (e.key === "Escape") {
      setIsEditingText(false);
      setEditingTextItem(null);
    }
  };

  const handleDelete = () => {
    if (!paperScopeRef.current) return;

    const scope = paperScopeRef.current;

    // Trouver l'élément sélectionné
    let itemToDelete: any = null;

    scope.project.activeLayer.children.forEach((item: any) => {
      if (item.selected && !item.data.isHandle) {
        itemToDelete = item;
      }
    });

    if (itemToDelete) {
      // Si c'est une flèche, supprimer aussi sa tête
      if (itemToDelete.data.type === "arrow") {
        scope.project.activeLayer.children.forEach((item: any) => {
          if (item.data.isArrowHead && item.data.parentId === itemToDelete.id) {
            item.remove();
          }
        });
      }

      // Si c'est un groupe (comme un accessoire), supprimer tout le groupe
      if (itemToDelete instanceof scope.Group) {
        itemToDelete.removeChildren();
      }

      // Supprimer l'élément
      itemToDelete.remove();

      // Supprimer les poignées
      scope.project.activeLayer.children.forEach((item: any) => {
        if (item.data.isHandle) {
          item.remove();
        }
      });

      scope.view.update();
      toast.success("Élément supprimé");
    } else {
      toast.info("Aucun élément sélectionné");
    }
  };

  const handleUndo = () => {
    console.log("Undo");
  };

  const handleRedo = () => {
    console.log("Redo");
  };

  const handleClear = () => {
    if (!paperScopeRef.current) return;
    const scope = paperScopeRef.current;
    scope.project.activeLayer.removeChildren();
    scope.view.update();
    toast.success("Canevas effacé");
  };

  const handleSave = async () => {
    if (!paperScopeRef.current) return;

    const scope = paperScopeRef.current;

    try {
      const json = scope.project.activeLayer.exportJSON();

      if (schemaId) {
        // Update existing schema
        const { error } = await (supabase as any)
          .from("technical_schemas")
          .update({ schema_data: json })
          .eq("id", schemaId);

        if (error) throw error;
      } else {
        // Create new schema
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Non authentifié");

        const { data, error } = await (supabase as any)
          .from("technical_schemas")
          .insert({
            project_id: projectId,
            user_id: user.id,
            schema_number: schemaNumber,
            schema_name: `Schéma ${schemaNumber}`,
            schema_data: json,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setSchemaId((data as any).id);
      }

      toast.success("Schéma sauvegardé");
    } catch (error: any) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error(`Erreur lors de la sauvegarde: ${getErrorMessage(error)}`);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const dataURL = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = `schema-technique-${schemaNumber}-${Date.now()}.png`;
    link.click();
    toast.success("Schéma téléchargé");
  };

  const handleToolClick = (tool: typeof activeTool) => {
    setActiveTool(tool);

    if (!paperScopeRef.current) return;
    const scope = paperScopeRef.current;

    if (tool === "rectangle") {
      new scope.Shape.Rectangle({
        point: [100, 100],
        size: [150, 100],
        strokeColor: colorRef.current,
        strokeWidth: strokeWidthRef.current,
      });
      scope.view.update();
    } else if (tool === "circle") {
      new scope.Shape.Circle({
        center: [150, 150],
        radius: 50,
        strokeColor: colorRef.current,
        strokeWidth: strokeWidthRef.current,
      });
      scope.view.update();
    }
    // Note: le texte est maintenant créé via un clic sur le canvas
  };

  const handleSelectAccessory = (accessory: any, source: "expense" | "catalog") => {
    if (!paperScopeRef.current) {
      toast.error("Le canvas n'est pas prêt. Veuillez patienter ou actualiser la page.");
      return;
    }

    const scope = paperScopeRef.current;

    const rawName = accessory.nom_accessoire || accessory.nom || "Accessoire";
    const name = decodeHtmlEntities(rawName);
    const details = [accessory.marque, accessory.categorie || accessory.categories?.nom, accessory.type_electrique]
      .filter(Boolean)
      .join(" | ");

    // Créer le texte
    const text = new scope.PointText({
      point: [100, 100],
      content: `📦 ${name}\n${details}`,
      fillColor: colorRef.current,
      fontSize: 14,
    });

    // Créer le cadre qui entoure le texte
    const background = new scope.Path.Rectangle({
      rectangle: text.bounds.expand(8),
      fillColor: "white",
      strokeColor: colorRef.current,
      strokeWidth: 1,
    });

    // Créer un groupe avec le cadre d'abord, puis le texte (ordre important pour le z-index)
    const group = new scope.Group([background, text]);

    // Marquer le groupe comme un accessoire pour le déplacement unifié
    group.data.isAccessory = true;
    group.data.accessoryName = name;

    scope.view.update();
    toast.success(`${name} ajouté au schéma`);
  };

  return (
    <div className="space-y-4" key={`canvas-${schemaNumber}`}>
      <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/50 rounded-lg">
        <Button
          variant={activeTool === "select" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTool("select")}
        >
          Sélectionner
        </Button>
        <Button variant={activeTool === "draw" ? "default" : "outline"} size="sm" onClick={() => setActiveTool("draw")}>
          <Pencil className="h-4 w-4 mr-2" />
          Dessiner
        </Button>
        <Button
          variant={activeTool === "line" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTool("line")}
          title="Ligne (se snape automatiquement à l'horizontal/vertical, maintenez Shift pour désactiver)"
        >
          <Minus className="h-4 w-4 mr-2" />
          Ligne
        </Button>
        <Button
          variant={activeTool === "arrow" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTool("arrow")}
          title="Flèche (se snape automatiquement à l'horizontal/vertical, maintenez Shift pour désactiver)"
        >
          <ArrowRight className="h-4 w-4 mr-2" />
          Flèche
        </Button>
        <Button
          variant={activeTool === "rectangle" ? "default" : "outline"}
          size="sm"
          onClick={() => handleToolClick("rectangle")}
        >
          <Square className="h-4 w-4 mr-2" />
          Rectangle
        </Button>
        <Button
          variant={activeTool === "circle" ? "default" : "outline"}
          size="sm"
          onClick={() => handleToolClick("circle")}
        >
          <CircleIcon className="h-4 w-4 mr-2" />
          Cercle
        </Button>
        <Button
          variant={activeTool === "text" ? "default" : "outline"}
          size="sm"
          onClick={() => handleToolClick("text")}
        >
          <Type className="h-4 w-4 mr-2" />
          Texte
        </Button>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Couleur :</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Épaisseur :</label>
          <input
            type="range"
            min="1"
            max="10"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-sm w-8">{strokeWidth}px</span>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <Button variant="outline" size="sm" onClick={handleUndo} disabled={true}>
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleRedo} disabled={true}>
          <Redo className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete} title="Supprimer l'élément sélectionné (Suppr)">
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleClear}>
          Effacer tout
        </Button>

        <Separator orientation="vertical" className="h-8" />

        <AccessorySelector
          projectId={projectId}
          onSelectAccessory={handleSelectAccessory}
          onAddToCatalog={onExpenseAdded}
        />

        <Button variant="default" size="sm" onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Sauvegarder
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Télécharger
        </Button>
      </div>

      {(activeTool === "line" || activeTool === "arrow") && (
        <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <strong>💡 Aide :</strong> Les traits se positionnent automatiquement à l'horizontal ou à la vertical.
          <strong> Maintenez Shift</strong> pour désactiver temporairement le snapping.
        </div>
      )}

      {activeTool === "text" && (
        <div className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
          <strong>💡 Aide :</strong> Cliquez sur le canvas pour ajouter du texte. Pour modifier un texte : passez en
          mode <strong>Sélection</strong> puis double-cliquez sur le texte.
        </div>
      )}

      <div ref={containerRef} className="border border-border rounded-lg overflow-hidden shadow-lg bg-white relative">
        {isEditingText && (
          <input
            ref={textInputRef}
            type="text"
            className="absolute z-10 px-2 py-1 border-2 border-blue-500 rounded bg-white text-black"
            style={{
              left: `${textInputPosition.x}px`,
              top: `${textInputPosition.y}px`,
              fontSize: "20px",
              minWidth: "200px",
            }}
            onKeyDown={handleTextKeyDown}
            onBlur={handleTextSubmit}
            autoFocus
          />
        )}
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="w-full"
          style={{ display: "block" }}
        />
      </div>
    </div>
  );
};

export const TechnicalCanvas = ({ projectId, onExpenseAdded }: TechnicalCanvasProps) => {
  const [schemas, setSchemas] = useState<number[]>([1]);
  const [activeTab, setActiveTab] = useState("canvas1");
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"blocks" | "drawing">("blocks");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Charger les schémas existants
  useEffect(() => {
    const loadSchemas = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("technical_schemas")
          .select("schema_number")
          .eq("project_id", projectId)
          .order("schema_number");

        if (error) throw error;

        if (data && data.length > 0) {
          const schemaNumbers = (data as any).map((s: any) => s.schema_number);
          setSchemas(schemaNumbers);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des schémas:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSchemas();
  }, [projectId]);

  const handleAddCanvas = () => {
    const nextNumber = Math.max(...schemas) + 1;
    setSchemas((prev) => [...prev, nextNumber]);
    setActiveTab(`canvas${nextNumber}`);
    toast.success(`Schéma ${nextNumber} ajouté`);
  };

  const handleRemoveCanvas = async (schemaNumber: number) => {
    if (schemaNumber === 1 && schemas.length === 1) {
      toast.error("Impossible de supprimer le dernier schéma");
      return;
    }

    try {
      const result: any = supabase
        .from("technical_schemas")
        .delete()
        .eq("project_id", projectId)
        .eq("schema_number", schemaNumber);
      await result;

      setSchemas((prev) => prev.filter((s) => s !== schemaNumber));

      // Revenir au premier schéma si on supprime le schéma actif
      if (activeTab === `canvas${schemaNumber}`) {
        const remainingSchemas = schemas.filter((s) => s !== schemaNumber);
        setActiveTab(`canvas${remainingSchemas[0]}`);
      }

      toast.success(`Schéma ${schemaNumber} supprimé`);
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression du schéma");
    }
  };

  // Gérer Escape pour quitter le plein écran
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Chargement des schémas...</div>;
  }

  return (
    <div className={`${isFullscreen ? "fixed inset-0 z-50 bg-white p-4" : "space-y-4"}`}>
      {/* Toggle Mode Blocs / Dessin */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
          <Button
            variant={viewMode === "blocks" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("blocks")}
            className="gap-2"
          >
            <Boxes className="h-4 w-4" />
            Mode Blocs
          </Button>
          <Button
            variant={viewMode === "drawing" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("drawing")}
            className="gap-2"
          >
            <PenTool className="h-4 w-4" />
            Mode Dessin
          </Button>
        </div>

        {viewMode === "drawing" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Quitter plein écran (Échap)" : "Plein écran"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Contenu selon le mode */}
      {viewMode === "blocks" ? (
        <BlocksInstance
          projectId={projectId}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />
      ) : (
        <div className={isFullscreen ? "h-[calc(100vh-80px)]" : ""}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center gap-2 mb-4">
              <TabsList className="flex-1">
                {schemas.map((schemaNum) => (
                  <div key={schemaNum} className="relative inline-flex items-center">
                    <TabsTrigger value={`canvas${schemaNum}`} className="pr-8">
                      Schéma {schemaNum}
                    </TabsTrigger>
                    {schemas.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 h-5 w-5 p-0 hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCanvas(schemaNum);
                        }}
                      >
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </TabsList>
              <Button onClick={handleAddCanvas} size="sm" variant="outline">
                + Ajouter un schéma
              </Button>
            </div>
            {schemas.map((schemaNum) => (
              <TabsContent key={schemaNum} value={`canvas${schemaNum}`}>
                <CanvasInstance
                  projectId={projectId}
                  schemaNumber={schemaNum}
                  onExpenseAdded={onExpenseAdded}
                  onSchemaDeleted={() => handleRemoveCanvas(schemaNum)}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  );
};
