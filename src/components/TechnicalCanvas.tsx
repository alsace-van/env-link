// ============================================
// TechnicalCanvas.tsx
// Schéma électrique interactif avec ReactFlow
// VERSION: 2.19 - Utilise les dimensions mesurées par ReactFlow pour l'alignement
// ============================================

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { toast } from "sonner";
import { AccessorySelector } from "./AccessorySelector";
import { SchemaLayersPanel, SchemaLayer, createDefaultLayer } from "./SchemaLayersPanel";
import paper from "paper";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/utils";

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
  tension_volts?: number | null;
  marque?: string | null;
  prix_unitaire?: number | null;
  layerId?: string; // ID du calque auquel appartient l'élément
}

// Configuration des handles par bloc
interface BlockHandles {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const DEFAULT_HANDLES: BlockHandles = { top: 2, bottom: 2, left: 2, right: 2 };

interface SchemaEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle?: string | null;
  target_handle?: string | null;
  color?: string;
  label?: string;
  strokeWidth?: number;
  section?: string; // Section de câble ex: "2.5mm²", "6mm²"
  bridge?: boolean; // Pont pour passer au-dessus des autres câbles
  layerId?: string; // ID du calque auquel appartient le câble
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
    category: "production" | "stockage" | "regulation" | "conversion" | "consommateur" | "distribution" | "neutre";
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
  const isLocked = data.isLocked as boolean | undefined;
  const onUpdateHandles = data.onUpdateHandles as ((nodeId: string, handles: BlockHandles) => void) | undefined;
  const onDeleteItem = data.onDeleteItem as ((nodeId: string) => void) | undefined;

  if (!item) return null;

  const typeConfig = ELECTRICAL_TYPES[item.type_electrique] || ELECTRICAL_TYPES.consommateur;
  const IconComponent = typeConfig.icon;

  // Générer les handles pour un côté
  const generateHandles = (
    side: "top" | "bottom" | "left" | "right",
    count: number,
    type: "source" | "target",
    position: Position,
  ) => {
    const isHorizontal = side === "top" || side === "bottom";
    const color = type === "source" ? "!bg-green-500" : "!bg-blue-500";

    return Array.from({ length: count }, (_, i) => {
      // Répartir les handles uniformément (éviter les bords)
      const percent = count === 1 ? 50 : 15 + i * (70 / Math.max(count - 1, 1));

      // Style avec centrage correct (translate pour compenser le décalage)
      const style = isHorizontal
        ? { left: `${percent}%`, transform: "translateX(-50%)" }
        : { top: `${percent}%`, transform: "translateY(-50%)" };

      return (
        <Handle
          key={`${side}-${i + 1}`}
          type={type}
          position={position}
          id={`${side}-${i + 1}`}
          className={`${color} !w-2 !h-2 !border-2 !border-white`}
          style={style}
        />
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

      {/* Bouton supprimer (visible quand sélectionné et non verrouillé) */}
      {selected && onDeleteItem && !isLocked && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteItem(item.id);
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md z-20 transition-colors"
          title="Supprimer du schéma"
        >
          ×
        </button>
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
        <IconComponent className={`h-5 w-5 ${typeConfig.color}`} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{decodeHtmlEntities(item.nom_accessoire)}</div>
          {item.marque && <div className="text-xs text-gray-500 truncate">{item.marque}</div>}
        </div>
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
        {item.capacite_ah && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Capacité</span>
            <span className="font-medium text-gray-900">{item.capacite_ah} Ah</span>
          </div>
        )}
        {item.tension_volts && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Tension</span>
            <span className="font-medium text-gray-900">{item.tension_volts} V</span>
          </div>
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

      <div className="px-3 pb-2">
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

  // État pour les handles personnalisés par bloc
  const [nodeHandles, setNodeHandles] = useState<Record<string, BlockHandles>>({});

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

  // Obtenir les nodes sélectionnés
  const selectedNodes = nodes.filter((n) => n.selected);

  // Obtenir la hauteur réelle d'un node (mesurée par ReactFlow)
  const getNodeHeight = (node: Node): number => {
    // ReactFlow v11+ stocke les dimensions mesurées dans node.measured
    // Les versions plus anciennes utilisent node.height directement
    const measuredHeight = (node as any).measured?.height || (node as any).height;
    if (measuredHeight) {
      console.log("[getNodeHeight]", node.id, "measured:", measuredHeight);
      return measuredHeight;
    }

    // Fallback: estimer la hauteur basée sur le contenu
    const item = items.find((i) => i.id === node.id);
    if (!item) return 120;

    let height = 60; // header
    height += 16; // padding top
    if (item.puissance_watts) height += 24;
    if (item.capacite_ah) height += 24;
    if (item.tension_volts) height += 24;
    if (item.intensite_amperes) height += 24;
    if (item.quantite > 1 && item.puissance_watts) height += 32;
    height += 40; // badge + padding

    console.log("[getNodeHeight]", node.id, "estimated:", height);
    return height;
  };

  // Obtenir la largeur réelle d'un node
  const getNodeWidth = (node: Node): number => {
    const measuredWidth = (node as any).measured?.width || (node as any).width;
    if (measuredWidth) {
      return measuredWidth;
    }
    return 240; // largeur par défaut
  };

  // Espacement entre les blocs
  const BLOCK_SPACING_H = 50;
  const BLOCK_SPACING_V = 30;

  // Fonction pour aligner les nodes sélectionnés horizontalement (centres alignés sur même Y)
  const alignNodesHorizontally = useCallback(() => {
    if (selectedNodes.length < 2) return;

    // Trouver le bloc le plus à gauche comme référence
    const referenceNode = [...selectedNodes].sort((a, b) => a.position.x - b.position.x)[0];
    const refHeight = getNodeHeight(referenceNode);
    const targetCenterY = referenceNode.position.y + refHeight / 2;

    console.log("[Align] Reference node:", referenceNode.id, "height:", refHeight, "centerY:", targetCenterY);

    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected) {
          // Vérifier si le bloc est sur un calque verrouillé
          const item = items.find((i) => i.id === n.id);
          const itemLayerId = item?.layerId || "layer-default";
          const layer = layers.find((l) => l.id === itemLayerId);
          if (layer?.locked) return n;

          // Calculer la nouvelle position Y pour aligner le centre
          const nodeHeight = getNodeHeight(n);
          const newY = targetCenterY - nodeHeight / 2;

          console.log("[Align] Node:", n.id, "height:", nodeHeight, "newY:", newY);

          return { ...n, position: { ...n.position, y: newY } };
        }
        return n;
      }),
    );
    toast.success(`${selectedNodes.length} blocs alignés horizontalement`);
  }, [selectedNodes, setNodes, items, layers]);

  // Fonction pour aligner les nodes sélectionnés verticalement (centres alignés sur même X)
  const alignNodesVertically = useCallback(() => {
    if (selectedNodes.length < 2) return;

    // Trouver le bloc le plus en haut comme référence
    const referenceNode = [...selectedNodes].sort((a, b) => a.position.y - b.position.y)[0];
    const refWidth = getNodeWidth(referenceNode);
    const targetCenterX = referenceNode.position.x + refWidth / 2;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected) {
          // Vérifier si le bloc est sur un calque verrouillé
          const item = items.find((i) => i.id === n.id);
          const itemLayerId = item?.layerId || "layer-default";
          const layer = layers.find((l) => l.id === itemLayerId);
          if (layer?.locked) return n;

          // Calculer la nouvelle position X pour aligner le centre
          const nodeWidth = getNodeWidth(n);
          const newX = targetCenterX - nodeWidth / 2;

          return { ...n, position: { ...n.position, x: newX } };
        }
        return n;
      }),
    );
    toast.success(`${selectedNodes.length} blocs alignés verticalement`);
  }, [selectedNodes, setNodes, items, layers]);

  // Fonction pour distribuer les nodes horizontalement (espacement égal)
  const distributeNodesHorizontally = useCallback(() => {
    if (selectedNodes.length < 3) return;

    // Trier par position X
    const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
    const startX = sorted[0].position.x;

    // Calculer l'espacement basé sur la largeur max des blocs
    const maxWidth = Math.max(...sorted.map((n) => getNodeWidth(n)));
    const spacing = maxWidth + BLOCK_SPACING_H;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected) {
          const item = items.find((i) => i.id === n.id);
          const itemLayerId = item?.layerId || "layer-default";
          const layer = layers.find((l) => l.id === itemLayerId);
          if (layer?.locked) return n;

          const sortIndex = sorted.findIndex((s) => s.id === n.id);
          return { ...n, position: { ...n.position, x: startX + sortIndex * spacing } };
        }
        return n;
      }),
    );
    toast.success(`${selectedNodes.length} blocs distribués horizontalement`);
  }, [selectedNodes, setNodes, items, layers]);

  // Fonction pour distribuer les nodes verticalement (espacement égal)
  const distributeNodesVertically = useCallback(() => {
    if (selectedNodes.length < 3) return;

    // Trier par position Y
    const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
    const startY = sorted[0].position.y;

    // Calculer l'espacement basé sur la hauteur max des blocs
    const maxHeight = Math.max(...sorted.map((n) => getNodeHeight(n)));
    const spacing = maxHeight + BLOCK_SPACING_V;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected) {
          const item = items.find((i) => i.id === n.id);
          const itemLayerId = item?.layerId || "layer-default";
          const layer = layers.find((l) => l.id === itemLayerId);
          if (layer?.locked) return n;

          const sortIndex = sorted.findIndex((s) => s.id === n.id);
          return { ...n, position: { ...n.position, y: startY + sortIndex * spacing } };
        }
        return n;
      }),
    );
    toast.success(`${selectedNodes.length} blocs distribués verticalement`);
  }, [selectedNodes, setNodes, items, layers]);

  // Fonction pour mettre à jour les handles d'un bloc
  const updateNodeHandles = useCallback((nodeId: string, handles: BlockHandles) => {
    setNodeHandles((prev) => ({ ...prev, [nodeId]: handles }));
  }, []);

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
        // Fallback sans scénario
        setLoading(false);
      }
    };

    loadPrincipalScenario();
  }, [projectId]);

  // Charger les items sauvegardés quand le scénario est chargé
  useEffect(() => {
    if (principalScenarioId) {
      loadSchemaData();
      setLoading(false);
    }
  }, [principalScenarioId]);

  // Charger les items sauvegardés dans le schéma (depuis localStorage)
  const loadSchemaData = async () => {
    const stored = localStorage.getItem(`electrical_schema_${projectId}`);
    console.log("[Schema] loadSchemaData - stored data exists:", !!stored);
    if (stored) {
      const parsed = JSON.parse(stored);
      setEdges(parsed.edges || []);
      setNodeHandles(parsed.nodeHandles || {});

      // Charger les calques sauvegardés
      if (parsed.layers && parsed.layers.length > 0) {
        setLayers(parsed.layers);
        // Activer le premier calque visible ou le premier calque
        const firstVisible = parsed.layers.find((l: SchemaLayer) => l.visible);
        setActiveLayerId(firstVisible?.id || parsed.layers[0].id);
      }

      // Charger les items sauvegardés
      if (parsed.items && parsed.items.length > 0) {
        console.log("[Schema] loadSchemaData - loading items from localStorage:", parsed.items.length);
        setItems(parsed.items);
      } else {
        console.log("[Schema] loadSchemaData - no items in localStorage, clearing items state");
        setItems([]); // S'assurer que items est vide si pas de données
      }
    } else {
      // Pas de données sauvegardées, s'assurer que items est vide
      console.log("[Schema] loadSchemaData - no localStorage data, clearing all state");
      setItems([]);
      setEdges([]);
      setNodeHandles({});
      setLayers([createDefaultLayer()]);
      setActiveLayerId("layer-default");
    }
  };

  // Charger les articles du catalogue avec type électrique
  const loadCatalogItems = async () => {
    setCatalogLoading(true);
    const { data } = await supabase
      .from("accessories_catalog")
      .select(
        "id, nom, marque, prix_vente_ttc, puissance_watts, capacite_ah, type_electrique, category_id, categories(nom)",
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
      marque: catalogItem.marque,
      prix_unitaire: catalogItem.prix_vente_ttc,
      layerId: activeLayerId, // Assigner au calque actif
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
        "id, nom_accessoire, marque, prix_unitaire, puissance_watts, capacite_ah, type_electrique, quantite, accessory_id",
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
        .select("id, type_electrique, puissance_watts, capacite_ah, marque")
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
        };
      })
      .filter((item: any) => item.type_electrique); // Filtrer ceux qui ont un type électrique

    console.log("[Schema] loadScenarioItems enriched:", {
      total: expenses.length,
      withType: enrichedData.length,
      items: enrichedData.map((i: any) => ({ nom: i.nom_accessoire, type: i.type_electrique })),
    });

    setScenarioItems(enrichedData);
    setScenarioLoading(false);
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
      marque: expense.marque,
      prix_unitaire: expense.prix_unitaire,
      layerId: activeLayerId, // Assigner au calque actif
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

        return {
          id: item.id,
          type: "electricalBlock",
          position,
          hidden: !isVisible, // Masquer si le calque n'est pas visible
          draggable: !isLocked, // Empêcher le déplacement si le calque est verrouillé
          data: {
            item,
            handles,
            isLocked, // Passer l'info de verrouillage au composant
            onUpdateHandles: updateNodeHandles,
            onDeleteItem: deleteItemFromSchema,
          },
        };
      }) as any;
    });
  }, [items, nodeHandles, updateNodeHandles, deleteItemFromSchema, layers]);

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

        return {
          id: edge.id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          sourceHandle: edge.source_handle || undefined,
          targetHandle: edge.target_handle || undefined,
          type: "smoothstep",
          pathOptions: { offset: offset, borderRadius: 10 },
          label: edge.section || undefined,
          labelStyle: { fill: edgeColor, fontWeight: 600, fontSize: 11 },
          labelBgStyle: { fill: "white", fillOpacity: 0.9 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          // Pas de flèche
          style: {
            strokeWidth: isSelected ? edgeWidth + 2 : edgeWidth,
            stroke: edgeColor,
            filter: isSelected ? "drop-shadow(0 0 4px rgba(59, 130, 246, 0.8))" : undefined,
          },
        };
      }) as any,
    );
  }, [edges, selectedEdgeId, layers]);

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
        items, // Sauvegarder aussi les items ajoutés au schéma
        layers, // Sauvegarder les calques
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
    <div className={`flex flex-col gap-3 ${isFullscreen ? "fixed inset-0 z-50 bg-white p-4" : "h-[600px]"}`}>
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

      {/* Canvas ReactFlow */}
      <div className="flex-1 border rounded-lg overflow-hidden bg-white">
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
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
            onEdgeDoubleClick={(_, edge) => {
              setEdges((prev) => prev.filter((e) => e.id !== edge.id));
              setSelectedEdgeId(null);
            }}
            onPaneClick={() => setSelectedEdgeId(null)}
            nodeTypes={blockNodeTypes}
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
              type: "smoothstep",
              markerEnd: { type: MarkerType.ArrowClosed },
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
            />
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
                <div className="bg-white rounded-lg shadow-lg p-3 border flex flex-wrap items-center gap-3">
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

                  {/* Section de câble */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600">Section:</span>
                    <select
                      value={selectedEdge.section || ""}
                      onChange={(e) => updateEdgeSection(e.target.value)}
                      className="h-7 px-2 text-xs border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Aucune</option>
                      {CABLE_SECTIONS.map((section) => (
                        <option key={section} value={section}>
                          {section}
                        </option>
                      ))}
                    </select>
                  </div>

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
              </Panel>
            )}
          </ReactFlow>
        )}
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap shrink-0">
        <span className="font-medium">Câbles:</span>
        {CABLE_COLORS.map((cable) => (
          <div key={cable.value} className="flex items-center gap-1">
            <div className="w-4 h-1 rounded" style={{ backgroundColor: cable.value }} />
            <span>{cable.label}</span>
          </div>
        ))}
      </div>
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
