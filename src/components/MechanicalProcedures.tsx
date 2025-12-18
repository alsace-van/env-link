// ============================================
// MechanicalProcedures.tsx
// Gestion des procédures mécaniques avec canvas
// VERSION: 2.3 - Positionnement intelligent des blocs au centre + groupés
// ============================================

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeProps,
  Handle,
  Position,
  MarkerType,
  Panel,
  ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Wrench,
  FileText,
  Image,
  Pencil,
  Trash2,
  GripVertical,
  FolderPlus,
  X,
  Copy,
  BookOpen,
  Layers,
  StickyNote,
  Type,
  CheckSquare,
  AlertTriangle,
  Lightbulb,
  MoreHorizontal,
  Upload,
  Clock,
  Hammer,
  Scissors,
  Ruler,
  Zap,
  Thermometer,
  Droplets,
  Wind,
  Gauge,
  Cable,
  Plug,
  Battery,
  Cog,
  Settings,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Check,
  Ban,
  CircleAlert,
  Info,
  HelpCircle,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Star,
  Heart,
  Flag,
  Bookmark,
  Tag,
  Hash,
  AtSign,
  Phone,
  Mail,
  MapPin,
  Navigation,
  Compass,
  Target,
  Crosshair,
  Move,
  RotateCw,
  RefreshCw,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  Search,
  Filter,
  SortAsc,
  List,
  Grid3X3,
  LayoutGrid,
  Layers2,
  Box,
  Package,
  Truck,
  Car,
  Bike,
  Plane,
  Ship,
  Anchor,
  Key,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  XCircle,
  CheckCircle,
  PlusCircle,
  MinusCircle,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Volume2,
  VolumeX,
  Mic,
  Camera,
  Video,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Printer,
  Wifi,
  Bluetooth,
  Radio,
  Tv,
  Speaker,
  Headphones,
  Music,
  Film,
  Sticker,
  Loader2,
  FileAudio,
  Sparkles,
  Languages,
  GitFork,
  LayoutDashboard,
  Unlink,
  FileUp,
} from "lucide-react";
import { toast } from "sonner";

// Types
interface Gamme {
  id: string;
  title: string;
  description?: string;
  vehicle_brand: string;
  vehicle_model?: string;
  category: string;
  color: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface Chapter {
  id: string;
  gamme_id: string;
  title: string;
  order_index: number;
  is_expanded: boolean;
  parent_id?: string | null;
  children?: Chapter[];
}

interface ContentBlock {
  id: string;
  chapter_id: string;
  type: "text" | "checklist" | "list" | "warning" | "tip" | "image" | "tools" | "icon" | "audio";
  title?: string;
  content: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  color?: string;
  order_index: number;
  image_url?: string;
  audio_url?: string;
}

interface BlockEdge {
  id: string;
  chapter_id: string;
  source_block_id: string;
  target_block_id: string;
  source_handle?: string | null; // 🔥 Handle source (pour connexion par ligne)
  target_handle?: string | null; // 🔥 Handle target (pour connexion par ligne)
  label?: string;
  edge_type: string;
  animated: boolean;
}

// Couleurs pour les onglets
const TAB_COLORS = [
  {
    value: "blue",
    label: "Bleu",
    class: "bg-blue-500",
    border: "border-blue-500",
    light: "bg-blue-50",
    darkLight: "dark:bg-blue-950/30",
  },
  {
    value: "green",
    label: "Vert",
    class: "bg-green-500",
    border: "border-green-500",
    light: "bg-green-50",
    darkLight: "dark:bg-green-950/30",
  },
  {
    value: "orange",
    label: "Orange",
    class: "bg-orange-500",
    border: "border-orange-500",
    light: "bg-orange-50",
    darkLight: "dark:bg-orange-950/30",
  },
  {
    value: "purple",
    label: "Violet",
    class: "bg-purple-500",
    border: "border-purple-500",
    light: "bg-purple-50",
    darkLight: "dark:bg-purple-950/30",
  },
  {
    value: "red",
    label: "Rouge",
    class: "bg-red-500",
    border: "border-red-500",
    light: "bg-red-50",
    darkLight: "dark:bg-red-950/30",
  },
  {
    value: "yellow",
    label: "Jaune",
    class: "bg-yellow-500",
    border: "border-yellow-500",
    light: "bg-yellow-50",
    darkLight: "dark:bg-yellow-950/30",
  },
  {
    value: "pink",
    label: "Rose",
    class: "bg-pink-500",
    border: "border-pink-500",
    light: "bg-pink-50",
    darkLight: "dark:bg-pink-950/30",
  },
  {
    value: "cyan",
    label: "Cyan",
    class: "bg-cyan-500",
    border: "border-cyan-500",
    light: "bg-cyan-50",
    darkLight: "dark:bg-cyan-950/30",
  },
];

// Types de blocs
const BLOCK_TYPES = [
  {
    value: "text",
    label: "Texte",
    icon: Type,
    bgColor: "bg-white dark:bg-gray-800",
    borderColor: "border-gray-200 dark:border-gray-600",
  },
  {
    value: "checklist",
    label: "Checklist",
    icon: CheckSquare,
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-300 dark:border-green-700",
  },
  {
    value: "list",
    label: "Liste",
    icon: List,
    bgColor: "bg-slate-50 dark:bg-slate-950/30",
    borderColor: "border-slate-300 dark:border-slate-700",
  },
  {
    value: "warning",
    label: "Attention",
    icon: AlertTriangle,
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
    borderColor: "border-yellow-400 dark:border-yellow-600",
  },
  {
    value: "tip",
    label: "Astuce",
    icon: Lightbulb,
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-300 dark:border-blue-700",
  },
  {
    value: "tools",
    label: "Outils",
    icon: Wrench,
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-300 dark:border-orange-700",
  },
  {
    value: "image",
    label: "Image",
    icon: Image,
    bgColor: "bg-gray-50 dark:bg-gray-800",
    borderColor: "border-gray-300 dark:border-gray-600",
  },
  {
    value: "audio",
    label: "Audio",
    icon: Mic,
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-300 dark:border-purple-700",
  },
];

// Banque d'icônes métier
const ICON_LIBRARY = [
  {
    category: "Outils",
    icons: [
      { name: "wrench", icon: Wrench, label: "Clé" },
      { name: "hammer", icon: Hammer, label: "Marteau" },
      { name: "scissors", icon: Scissors, label: "Ciseaux" },
      { name: "ruler", icon: Ruler, label: "Règle" },
      { name: "cog", icon: Cog, label: "Engrenage" },
      { name: "settings", icon: Settings, label: "Réglages" },
    ],
  },
  {
    category: "Temps",
    icons: [
      { name: "clock", icon: Clock, label: "Horloge" },
      { name: "pause", icon: PauseCircle, label: "Pause" },
      { name: "play", icon: PlayCircle, label: "Lecture" },
      { name: "stop", icon: StopCircle, label: "Stop" },
      { name: "refresh", icon: RefreshCw, label: "Rafraîchir" },
      { name: "rotate", icon: RotateCw, label: "Rotation" },
    ],
  },
  {
    category: "Électrique",
    icons: [
      { name: "zap", icon: Zap, label: "Électricité" },
      { name: "plug", icon: Plug, label: "Prise" },
      { name: "battery", icon: Battery, label: "Batterie" },
      { name: "cable", icon: Cable, label: "Câble" },
      { name: "wifi", icon: Wifi, label: "WiFi" },
      { name: "bluetooth", icon: Bluetooth, label: "Bluetooth" },
    ],
  },
  {
    category: "Fluides",
    icons: [
      { name: "droplets", icon: Droplets, label: "Eau" },
      { name: "thermometer", icon: Thermometer, label: "Température" },
      { name: "wind", icon: Wind, label: "Ventilation" },
      { name: "gauge", icon: Gauge, label: "Pression" },
    ],
  },
  {
    category: "Véhicules",
    icons: [
      { name: "car", icon: Car, label: "Voiture" },
      { name: "truck", icon: Truck, label: "Camion" },
      { name: "bike", icon: Bike, label: "Vélo" },
      { name: "key", icon: Key, label: "Clé" },
    ],
  },
  {
    category: "Alertes",
    icons: [
      { name: "alert-triangle", icon: AlertTriangle, label: "Attention" },
      { name: "alert-circle", icon: AlertCircle, label: "Alerte" },
      { name: "info", icon: Info, label: "Info" },
      { name: "help", icon: HelpCircle, label: "Aide" },
      { name: "check-circle", icon: CheckCircle, label: "Validé" },
      { name: "x-circle", icon: XCircle, label: "Erreur" },
      { name: "ban", icon: Ban, label: "Interdit" },
      { name: "shield", icon: Shield, label: "Sécurité" },
    ],
  },
  {
    category: "Directions",
    icons: [
      { name: "arrow-right", icon: ArrowRight, label: "Droite" },
      { name: "arrow-down", icon: ArrowDown, label: "Bas" },
      { name: "arrow-up", icon: ArrowUp, label: "Haut" },
      { name: "move", icon: Move, label: "Déplacer" },
      { name: "target", icon: Target, label: "Cible" },
      { name: "crosshair", icon: Crosshair, label: "Viseur" },
      { name: "compass", icon: Compass, label: "Boussole" },
      { name: "navigation", icon: Navigation, label: "Navigation" },
    ],
  },
  {
    category: "Divers",
    icons: [
      { name: "eye", icon: Eye, label: "Voir" },
      { name: "eye-off", icon: EyeOff, label: "Cacher" },
      { name: "lock", icon: Lock, label: "Verrouillé" },
      { name: "unlock", icon: Unlock, label: "Déverrouillé" },
      { name: "star", icon: Star, label: "Étoile" },
      { name: "flag", icon: Flag, label: "Drapeau" },
      { name: "bookmark", icon: Bookmark, label: "Marque-page" },
      { name: "tag", icon: Tag, label: "Étiquette" },
      { name: "box", icon: Box, label: "Boîte" },
      { name: "package", icon: Package, label: "Colis" },
      { name: "camera", icon: Camera, label: "Photo" },
      { name: "search", icon: Search, label: "Recherche" },
    ],
  },
];

// Catégories
const PROCEDURE_CATEGORIES = [
  { value: "installation", label: "Installation" },
  { value: "demontage", label: "Démontage" },
  { value: "maintenance", label: "Maintenance" },
  { value: "reparation", label: "Réparation" },
  { value: "modification", label: "Modification" },
  { value: "controle", label: "Contrôle" },
  { value: "autre", label: "Autre" },
];

// ============================================
// CUSTOM BLOCK NODE POUR REACT FLOW
// ============================================

const CustomBlockNode = ({ data, selected }: NodeProps) => {
  const block = data.block as ContentBlock;
  const onUpdateBlock = data.onUpdateBlock as (id: string, updates: Partial<ContentBlock>) => void;
  const onDeleteBlock = data.onDeleteBlock as (id: string) => void;
  const onChecklistToggle = data.onChecklistToggle as (id: string, index: number) => void;
  const onAddChecklistItem = data.onAddChecklistItem as (id: string, afterIndex?: number) => void;
  const onAddListItem = data.onAddListItem as (id: string, afterIndex?: number) => void;
  const onResizeStart = data.onResizeStart as ((e: React.MouseEvent, id: string) => void) | undefined;

  if (!block) return null;

  const blockType = BLOCK_TYPES.find((t) => t.value === block.type) || BLOCK_TYPES[0];

  // Icône spéciale pour les blocs d'icônes
  const getIconComponent = (iconName: string) => {
    for (const category of ICON_LIBRARY) {
      const found = category.icons.find((i) => i.name === iconName);
      if (found) return found.icon;
    }
    return Sticker;
  };

  const IconComponent = block.type === "icon" ? getIconComponent(block.content) : blockType.icon;

  // Stopper le drag quand on interagit avec un input
  const stopDrag = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
  };

  // Rendu spécial pour les icônes
  if (block.type === "icon") {
    return (
      <div className={`p-2 ${selected ? "ring-2 ring-blue-500 ring-offset-2 rounded-full" : ""}`}>
        <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
        <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3 !h-3" />
        <div className="relative group">
          <IconComponent className="h-10 w-10 text-gray-700 dark:text-gray-300" />
          <button
            type="button"
            onPointerDown={stopDrag}
            onClick={() => onDeleteBlock(block.id)}
            className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
        <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3 !h-3" />
      </div>
    );
  }

  return (
    <div
      className={`content-block rounded-lg border-2 shadow-md ${selected ? "ring-2 ring-blue-500 shadow-lg" : ""} ${blockType.bgColor} ${blockType.borderColor}`}
      style={{
        width: block.width,
        minHeight: block.type === "image" && block.height ? block.height : 80,
        height: block.type === "image" && block.height ? block.height : "auto",
      }}
    >
      {/* Handles de connexion entrée */}
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      {/* Handle gauche seulement si pas list/checklist (ils ont des handles par ligne) */}
      {block.type !== "list" && block.type !== "checklist" && (
        <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3 !h-3" />
      )}

      {/* Header du bloc */}
      <div
        className={`flex items-center gap-2 px-3 py-2 border-b ${blockType.borderColor} bg-white/50 dark:bg-black/20 rounded-t-lg cursor-grab`}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <IconComponent className="h-4 w-4" />
        <input
          type="text"
          value={block.title !== undefined && block.title !== null ? block.title : blockType.label}
          onChange={(e) => onUpdateBlock(block.id, { title: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="text-xs font-medium flex-1 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 min-w-0 nodrag nopan"
          placeholder={blockType.label}
        />
        <button
          type="button"
          onPointerDown={stopDrag}
          onClick={() => onDeleteBlock(block.id)}
          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Contenu du bloc - ÉDITABLE */}
      <div className="p-3 nodrag relative" onPointerDown={stopDrag}>
        {block.type === "image" ? (
          <div className="relative" style={{ minHeight: block.height ? block.height - 60 : 120 }}>
            {block.image_url ? (
              <img
                src={block.image_url}
                alt="Illustration"
                className="rounded object-contain"
                style={{
                  width: "100%",
                  height: block.height ? block.height - 60 : "auto",
                  maxHeight: block.height ? block.height - 60 : 300,
                }}
              />
            ) : (
              <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded cursor-pointer hover:bg-muted/50">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Cliquez pour ajouter</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    const onImageUpload = data.onImageUpload as ((id: string, file: File) => void) | undefined;
                    if (file && onImageUpload) {
                      onImageUpload(block.id, file);
                    }
                  }}
                />
              </label>
            )}
            {/* Poignée de redimensionnement pour le bloc image */}
            {onResizeStart && (
              <div
                className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-10 nodrag"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onResizeStart(e, block.id);
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-gray-400 hover:border-blue-500 transition-colors" />
              </div>
            )}
          </div>
        ) : block.type === "audio" ? (
          <div className="space-y-2">
            {block.audio_url ? (
              <audio controls className="w-full h-8">
                <source src={block.audio_url} />
              </audio>
            ) : (
              <label className="flex flex-col items-center justify-center h-16 border-2 border-dashed rounded cursor-pointer hover:bg-muted/50">
                <Mic className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Ajouter un audio</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    const onAudioUpload = data.onAudioUpload as ((id: string, file: File) => void) | undefined;
                    if (file && onAudioUpload) {
                      onAudioUpload(block.id, file);
                    }
                  }}
                />
              </label>
            )}
            <textarea
              value={block.content}
              onChange={(e) => onUpdateBlock(block.id, { content: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="w-full min-h-[80px] bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800 rounded p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 nodrag nopan"
              placeholder="Transcription ou notes..."
            />
          </div>
        ) : block.type === "checklist" ? (
          <div className="space-y-1">
            {block.content.split("\n").map((line, index) => {
              const isChecked = line.startsWith("[x]");
              const text = line.replace(/^\[x?\]\s*/, "");

              return (
                <div key={index} className="flex items-center gap-2 group/item relative">
                  {/* 🔥 Handle target à gauche de chaque ligne */}
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={`checklist-target-${index}`}
                    className="!bg-blue-500 !w-2.5 !h-2.5 !border-2 !border-white !left-[-12px]"
                    style={{ top: "50%", transform: "translateY(-50%)" }}
                  />
                  <button
                    type="button"
                    onClick={() => onChecklistToggle(block.id, index)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isChecked ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"
                    }`}
                  >
                    {isChecked && <Check className="h-3 w-3" />}
                  </button>
                  <input
                    type="text"
                    value={text}
                    data-checklist-input={`${block.id}-${index}`}
                    onChange={(e) => {
                      const lines = block.content.split("\n");
                      const prefix = lines[index].startsWith("[x]") ? "[x] " : "[] ";
                      lines[index] = prefix + e.target.value;
                      onUpdateBlock(block.id, { content: lines.join("\n") });
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation(); // 🔥 Arrêter la propagation pour TOUTES les touches
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onAddChecklistItem(block.id, index);
                      } else if (e.key === "Backspace" && text === "") {
                        e.preventDefault();
                        const lines = block.content.split("\n");
                        lines.splice(index, 1);
                        if (lines.length > 0) {
                          onUpdateBlock(block.id, { content: lines.join("\n") });
                        }
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className={`flex-1 bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-sm nodrag nopan ${
                      isChecked ? "line-through text-muted-foreground" : ""
                    }`}
                    placeholder="Étape..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const lines = block.content.split("\n");
                      lines.splice(index, 1);
                      if (lines.length > 0) {
                        onUpdateBlock(block.id, { content: lines.join("\n") });
                      }
                    }}
                    className="opacity-0 group-hover/item:opacity-100 text-red-500 hover:text-red-700 p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {/* 🔥 Handle source à droite de chaque ligne */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`checklist-source-${index}`}
                    className="!bg-green-500 !w-2.5 !h-2.5 !border-2 !border-white !right-[-12px]"
                    style={{ top: "50%", transform: "translateY(-50%)" }}
                  />
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => onAddChecklistItem(block.id)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-2"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </button>
          </div>
        ) : block.type === "list" ? (
          <div className="space-y-1">
            {block.content.split("\n").map((line, index) => {
              const text = line.replace(/^[•\-]\s*/, "");

              return (
                <div key={index} className="flex items-center gap-2 group/item relative">
                  {/* 🔥 Handle target à gauche de chaque ligne */}
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={`list-target-${index}`}
                    className="!bg-blue-500 !w-2.5 !h-2.5 !border-2 !border-white !left-[-12px]"
                    style={{ top: "50%", transform: "translateY(-50%)" }}
                  />
                  <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={text}
                    data-list-input={`${block.id}-${index}`}
                    onChange={(e) => {
                      const lines = block.content.split("\n");
                      lines[index] = "• " + e.target.value;
                      onUpdateBlock(block.id, { content: lines.join("\n") });
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation(); // 🔥 Arrêter la propagation pour TOUTES les touches
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onAddListItem(block.id, index);
                      } else if (e.key === "Backspace" && text === "") {
                        e.preventDefault();
                        const lines = block.content.split("\n");
                        lines.splice(index, 1);
                        if (lines.length > 0) {
                          onUpdateBlock(block.id, { content: lines.join("\n") });
                        }
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-sm nodrag nopan"
                    placeholder="Élément..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const lines = block.content.split("\n");
                      lines.splice(index, 1);
                      if (lines.length > 0) {
                        onUpdateBlock(block.id, { content: lines.join("\n") });
                      }
                    }}
                    className="opacity-0 group-hover/item:opacity-100 text-red-500 hover:text-red-700 p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {/* 🔥 Handle source à droite de chaque ligne */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`list-source-${index}`}
                    className="!bg-green-500 !w-2.5 !h-2.5 !border-2 !border-white !right-[-12px]"
                    style={{ top: "50%", transform: "translateY(-50%)" }}
                  />
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => onAddListItem(block.id)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-2"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </button>
          </div>
        ) : (
          <textarea
            value={block.content}
            onChange={(e) => onUpdateBlock(block.id, { content: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="w-full min-h-[60px] bg-transparent border-none resize-none focus:outline-none focus:ring-0 p-0 text-sm nodrag nopan"
            placeholder={
              block.type === "warning"
                ? "⚠️ Point d'attention important..."
                : block.type === "tip"
                  ? "💡 Astuce utile..."
                  : block.type === "tools"
                    ? "🔧 Outils nécessaires..."
                    : "Saisissez votre texte..."
            }
          />
        )}
      </div>

      {/* Handles de connexion sortie */}
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
      {/* Handle droite seulement si pas list/checklist (ils ont des handles par ligne) */}
      {block.type !== "list" && block.type !== "checklist" && (
        <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3 !h-3" />
      )}
    </div>
  );
};

// CustomBlockNode.displayName = "CustomBlockNode"; // Plus nécessaire sans memo

// Types de nodes pour React Flow
const nodeTypes = {
  customBlock: CustomBlockNode,
};

const MechanicalProcedures = () => {
  // États principaux
  const [gammes, setGammes] = useState<Gamme[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [edges, setEdges] = useState<BlockEdge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mode React Flow
  const [isFlowMode, setIsFlowMode] = useState(true); // Activer React Flow par défaut

  // États de sélection
  const [activeGammeId, setActiveGammeId] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);

  // États des dialogues
  const [isGammeDialogOpen, setIsGammeDialogOpen] = useState(false);
  const [isChapterDialogOpen, setIsChapterDialogOpen] = useState(false);
  const [isDeleteGammeDialogOpen, setIsDeleteGammeDialogOpen] = useState(false);
  const [isDeleteChapterDialogOpen, setIsDeleteChapterDialogOpen] = useState(false);
  const [isEditGammeDialogOpen, setIsEditGammeDialogOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isSchemaImportDialogOpen, setIsSchemaImportDialogOpen] = useState(false);
  const [schemaImportImage, setSchemaImportImage] = useState<string | null>(null);
  const [schemaImportLoading, setSchemaImportLoading] = useState(false);
  const [generatedSvg, setGeneratedSvg] = useState<string | null>(null);
  const [isEditBlockDialogOpen, setIsEditBlockDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ContentBlock | null>(null);

  // Import PDF
  const [isPdfImportDialogOpen, setIsPdfImportDialogOpen] = useState(false);
  const [pdfImportFile, setPdfImportFile] = useState<File | null>(null);
  const [pdfImportLoading, setPdfImportLoading] = useState(false);
  const [pdfImportProgress, setPdfImportProgress] = useState("");

  // États pour la transcription audio
  const [transcribingBlockId, setTranscribingBlockId] = useState<string | null>(null);
  const [summarizingBlockId, setSummarizingBlockId] = useState<string | null>(null);
  const [translatingBlockId, setTranslatingBlockId] = useState<string | null>(null);

  // États des formulaires
  const [newGamme, setNewGamme] = useState({
    title: "",
    description: "",
    vehicle_brand: "",
    vehicle_model: "",
    category: "installation",
    color: "blue",
  });
  const [newChapter, setNewChapter] = useState({
    title: "",
    parent_id: null as string | null,
  });

  // État pour l'édition des gammes
  const [editingGamme, setEditingGamme] = useState<Gamme | null>(null);

  // États pour le drag des blocs - REFS ONLY pour performance
  const draggingBlockIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const dragElementRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // 🔥 Refs pour ReactFlow (pour positionner les nouveaux blocs au centre)
  const reactFlowContainerRef = useRef<HTMLDivElement>(null);
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);

  // États pour le resize des blocs
  const resizingBlockIdRef = useRef<string | null>(null);
  const resizeStartRef = useRef({ width: 0, height: 0, x: 0, y: 0 });

  // State juste pour le visuel de sélection
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // États pour le drag des chapitres
  const [draggingChapterId, setDraggingChapterId] = useState<string | null>(null);
  const [dropTargetChapterId, setDropTargetChapterId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | "inside" | null>(null);

  // Chapitres expansés
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // Charger les données au montage
  useEffect(() => {
    loadGammes();
  }, []);

  // Charger les chapitres quand une gamme est sélectionnée
  useEffect(() => {
    if (activeGammeId) {
      loadChapters(activeGammeId);
    } else {
      setChapters([]);
      setBlocks([]);
      setActiveChapterId(null);
    }
  }, [activeGammeId]);

  // Charger les blocs quand un chapitre est sélectionné
  useEffect(() => {
    if (activeChapterId) {
      loadBlocks(activeChapterId);
    } else {
      setBlocks([]);
    }
  }, [activeChapterId]);

  // Fonctions de chargement
  const loadGammes = async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await (supabase as any)
        .from("mechanical_gammes")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: true });

      if (error) {
        if (error.code === "42P01") {
          console.log("Table mechanical_gammes n'existe pas encore");
          setGammes([]);
        } else {
          console.error("Erreur chargement gammes:", error);
        }
      } else {
        setGammes(data || []);
        if (data && data.length > 0 && !activeGammeId) {
          setActiveGammeId(data[0].id);
        }
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadChapters = async (gammeId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from("mechanical_chapters")
        .select("*")
        .eq("gamme_id", gammeId)
        .order("order_index", { ascending: true });

      if (error) {
        if (error.code !== "42P01") {
          console.error("Erreur chargement chapitres:", error);
        }
        setChapters([]);
      } else {
        setChapters(data || []);
        if (data && data.length > 0) {
          setActiveChapterId(data[0].id);
          setExpandedChapters(new Set([data[0].id]));
        } else {
          setActiveChapterId(null);
        }
      }
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const loadBlocks = async (chapterId: string) => {
    try {
      // Charger les blocs
      const { data, error } = await (supabase as any)
        .from("mechanical_blocks")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("order_index", { ascending: true });

      if (error) {
        if (error.code !== "42P01") {
          console.error("Erreur chargement blocs:", error);
        }
        setBlocks([]);
      } else {
        setBlocks(data || []);
      }

      // Charger les edges
      const { data: edgesData, error: edgesError } = await (supabase as any)
        .from("mechanical_edges")
        .select("*")
        .eq("chapter_id", chapterId);

      if (edgesError) {
        if (edgesError.code !== "42P01") {
          console.error("Erreur chargement edges:", edgesError);
        }
        setEdges([]);
      } else {
        setEdges(edgesData || []);
      }
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  // 🔥 Helper: Calculer la prochaine position centrée pour un nouveau bloc
  const getNextBlockPosition = (existingBlocks: ContentBlock[], newWidth: number = 300, newHeight: number = 150) => {
    // Calculer le centre visible du canvas
    let centerX = 400;
    let centerY = 300;

    if (reactFlowInstanceRef.current && reactFlowContainerRef.current) {
      const viewport = reactFlowInstanceRef.current.getViewport();
      const containerRect = reactFlowContainerRef.current.getBoundingClientRect();

      centerX = (containerRect.width / 2 - viewport.x) / viewport.zoom;
      centerY = (containerRect.height / 2 - viewport.y) / viewport.zoom;
    }

    if (existingBlocks.length === 0) {
      return {
        x: Math.round(centerX - newWidth / 2),
        y: Math.round(centerY - newHeight / 2),
      };
    }

    const gapX = 20;
    const gapY = 20;

    // Trouver le bloc le plus proche du centre
    const closestBlock = existingBlocks.reduce((closest, block) => {
      const distCurrent = Math.hypot(block.position_x - centerX, block.position_y - centerY);
      const distClosest = Math.hypot(closest.position_x - centerX, closest.position_y - centerY);
      return distCurrent < distClosest ? block : closest;
    }, existingBlocks[0]);

    // Vérifier si une position est libre
    const isPositionFree = (x: number, y: number) => {
      return !existingBlocks.some((block) => {
        const blockRight = block.position_x + (block.width || 300);
        const blockBottom = block.position_y + (block.height || 150);
        const newRight = x + newWidth;
        const newBottom = y + newHeight;

        return !(
          x >= blockRight + gapX ||
          newRight <= block.position_x - gapX ||
          y >= blockBottom + gapY ||
          newBottom <= block.position_y - gapY
        );
      });
    };

    const stepX = (closestBlock.width || 300) + gapX;
    const stepY = (closestBlock.height || 150) + gapY;
    const baseX = closestBlock.position_x;
    const baseY = closestBlock.position_y;

    // Essayer à droite
    if (isPositionFree(baseX + stepX, baseY)) {
      return { x: Math.round(baseX + stepX), y: Math.round(baseY) };
    }

    // Essayer en dessous
    if (isPositionFree(baseX, baseY + stepY)) {
      return { x: Math.round(baseX), y: Math.round(baseY + stepY) };
    }

    // Chercher en spirale
    const directions = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: -1 },
    ];

    for (let radius = 1; radius <= 5; radius++) {
      for (const dir of directions) {
        const testX = baseX + dir.dx * stepX * radius;
        const testY = baseY + dir.dy * stepY * radius;
        if (isPositionFree(testX, testY)) {
          return { x: Math.round(testX), y: Math.round(testY) };
        }
      }
    }

    // Fallback : en dessous de tous les blocs
    const maxY = Math.max(...existingBlocks.map((b) => b.position_y + (b.height || 150)));
    return { x: Math.round(centerX - newWidth / 2), y: Math.round(maxY + gapY) };
  };

  // Créer une nouvelle gamme
  const handleCreateGamme = async () => {
    if (!newGamme.title) {
      toast.error("Le titre est obligatoire");
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Utilisateur non connecté");
        return;
      }

      const { data, error } = await (supabase as any)
        .from("mechanical_gammes")
        .insert({
          title: newGamme.title,
          description: newGamme.description || null,
          vehicle_brand: newGamme.vehicle_brand || null,
          vehicle_model: newGamme.vehicle_model || null,
          category: newGamme.category,
          color: newGamme.color,
          user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Erreur création gamme:", error);
        toast.error(`Erreur: ${error.message}`);
        return;
      }

      setGammes([...gammes, data]);
      setActiveGammeId(data.id);
      setIsGammeDialogOpen(false);
      setNewGamme({
        title: "",
        description: "",
        vehicle_brand: "",
        vehicle_model: "",
        category: "installation",
        color: "blue",
      });
      toast.success("Gamme créée");
    } catch (error: any) {
      console.error("Erreur création gamme:", error);
      toast.error("Erreur lors de la création");
    }
  };

  // Modifier une gamme
  const handleUpdateGamme = async () => {
    if (!editingGamme) return;

    try {
      const { error } = await (supabase as any)
        .from("mechanical_gammes")
        .update({
          title: editingGamme.title,
          description: editingGamme.description,
          vehicle_brand: editingGamme.vehicle_brand,
          vehicle_model: editingGamme.vehicle_model,
          category: editingGamme.category,
          color: editingGamme.color,
        })
        .eq("id", editingGamme.id);

      if (error) throw error;

      setGammes(gammes.map((g) => (g.id === editingGamme.id ? editingGamme : g)));
      setIsEditGammeDialogOpen(false);
      setEditingGamme(null);
      toast.success("Gamme modifiée");
    } catch (error) {
      console.error("Erreur modification gamme:", error);
      toast.error("Erreur lors de la modification");
    }
  };

  // Supprimer une gamme
  const handleDeleteGamme = async () => {
    if (!activeGammeId) return;

    try {
      const { error } = await (supabase as any).from("mechanical_gammes").delete().eq("id", activeGammeId);

      if (error) throw error;

      const newGammes = gammes.filter((g) => g.id !== activeGammeId);
      setGammes(newGammes);
      setActiveGammeId(newGammes.length > 0 ? newGammes[0].id : null);
      setIsDeleteGammeDialogOpen(false);
      toast.success("Gamme supprimée");
    } catch (error) {
      console.error("Erreur suppression gamme:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Créer un chapitre
  const handleCreateChapter = async () => {
    if (!newChapter.title || !activeGammeId) {
      toast.error("Le titre est obligatoire");
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from("mechanical_chapters")
        .insert({
          gamme_id: activeGammeId,
          title: newChapter.title,
          parent_id: newChapter.parent_id,
          order_index: chapters.length,
          is_expanded: true,
        })
        .select()
        .single();

      if (error) throw error;

      setChapters([...chapters, data]);
      setActiveChapterId(data.id);
      setExpandedChapters(new Set([...expandedChapters, data.id]));
      setIsChapterDialogOpen(false);
      setNewChapter({ title: "", parent_id: null });
      toast.success("Chapitre créé");
    } catch (error) {
      console.error("Erreur création chapitre:", error);
      toast.error("Erreur lors de la création");
    }
  };

  // Supprimer un chapitre
  const handleDeleteChapter = async () => {
    if (!activeChapterId) return;

    try {
      const { error } = await (supabase as any).from("mechanical_chapters").delete().eq("id", activeChapterId);

      if (error) throw error;

      const newChapters = chapters.filter((c) => c.id !== activeChapterId);
      setChapters(newChapters);
      setActiveChapterId(newChapters.length > 0 ? newChapters[0].id : null);
      setIsDeleteChapterDialogOpen(false);
      toast.success("Chapitre supprimé");
    } catch (error) {
      console.error("Erreur suppression chapitre:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Réordonner les chapitres après drag
  const handleChapterDrop = async (draggedId: string, targetId: string, position: "before" | "after" | "inside") => {
    if (draggedId === targetId) return;

    const draggedChapter = chapters.find((c) => c.id === draggedId);
    const targetChapter = chapters.find((c) => c.id === targetId);
    if (!draggedChapter || !targetChapter) return;

    let newChapters = [...chapters];
    const draggedIndex = newChapters.findIndex((c) => c.id === draggedId);

    // Retirer le chapitre de sa position actuelle
    newChapters.splice(draggedIndex, 1);

    // Trouver la nouvelle position
    let newIndex = newChapters.findIndex((c) => c.id === targetId);
    let newParentId = targetChapter.parent_id;

    if (position === "after") {
      newIndex += 1;
    } else if (position === "inside") {
      newParentId = targetId;
      // Ajouter à la fin des enfants
      const childrenCount = newChapters.filter((c) => c.parent_id === targetId).length;
      newIndex = newChapters.findIndex((c) => c.id === targetId) + childrenCount + 1;
    }

    // Insérer à la nouvelle position
    const updatedChapter = { ...draggedChapter, parent_id: newParentId };
    newChapters.splice(newIndex, 0, updatedChapter);

    // Mettre à jour les order_index
    newChapters = newChapters.map((c, idx) => ({ ...c, order_index: idx }));

    setChapters(newChapters);

    // Sauvegarder en base
    try {
      // Mettre à jour le parent_id du chapitre déplacé
      await (supabase as any)
        .from("mechanical_chapters")
        .update({ parent_id: newParentId, order_index: newIndex })
        .eq("id", draggedId);

      // Mettre à jour tous les order_index
      for (const chapter of newChapters) {
        await (supabase as any)
          .from("mechanical_chapters")
          .update({ order_index: chapter.order_index })
          .eq("id", chapter.id);
      }

      toast.success("Chapitre déplacé");
    } catch (error) {
      console.error("Erreur réorganisation:", error);
      loadChapters(activeGammeId!);
    }

    setDraggingChapterId(null);
    setDropTargetChapterId(null);
    setDropPosition(null);
  };

  // Créer un bloc
  const handleCreateBlock = async (type: string, iconName?: string) => {
    if (!activeChapterId) {
      toast.error("Sélectionnez un chapitre d'abord");
      return;
    }

    try {
      const content =
        type === "checklist"
          ? "[] Étape 1\n[] Étape 2"
          : type === "list"
            ? "• Élément 1\n• Élément 2"
            : type === "icon" && iconName
              ? iconName
              : "";

      // Définir la taille selon le type
      let width = 300;
      let height = 150;

      if (type === "icon") {
        width = 80;
        height = 80;
      } else if (type === "image") {
        width = 350;
        height = 280;
      } else if (type === "audio") {
        width = 400;
        height = 320;
      }

      // 🔥 Utiliser le helper pour la position centrée et groupée
      const { x: posX, y: posY } = getNextBlockPosition(blocks, width, height);

      const { data, error } = await (supabase as any)
        .from("mechanical_blocks")
        .insert({
          chapter_id: activeChapterId,
          type: type,
          content: content,
          position_x: posX,
          position_y: posY,
          width: width,
          height: height,
          order_index: blocks.length,
        })
        .select()
        .single();

      if (error) throw error;

      setBlocks([...blocks, data]);
      setSelectedBlockId(data.id);
      setIsIconPickerOpen(false);

      // 🔥 Centrer sur le nouveau bloc sans tout recadrer
      setTimeout(() => {
        if (reactFlowInstanceRef.current) {
          // Si c'est le premier bloc, faire un fitView
          if (blocks.length === 0) {
            reactFlowInstanceRef.current.fitView({
              padding: 0.5,
              duration: 300,
            });
          } else {
            // Sinon, centrer doucement sur le nouveau bloc
            reactFlowInstanceRef.current.setCenter(
              data.position_x + (data.width || 150),
              data.position_y + (data.height || 75),
              { duration: 300, zoom: reactFlowInstanceRef.current.getZoom() },
            );
          }
        }
      }, 100);

      toast.success("Bloc ajouté");
    } catch (error) {
      console.error("Erreur création bloc:", error);
      toast.error("Erreur lors de la création");
    }
  };

  // Mettre à jour un bloc
  const handleUpdateBlock = async (blockId: string, updates: Partial<ContentBlock>) => {
    // 🔥 Mettre à jour l'état local IMMÉDIATEMENT (avant l'appel API)
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...updates } : b)));

    try {
      const { error } = await (supabase as any).from("mechanical_blocks").update(updates).eq("id", blockId);

      if (error) {
        console.error("Erreur mise à jour bloc:", error);
        // Recharger les blocs en cas d'erreur pour resynchroniser
      }
    } catch (error) {
      console.error("Erreur mise à jour bloc:", error);
    }
  };

  // Supprimer un bloc - VERSION ROBUSTE
  const handleDeleteBlock = async (blockId: string) => {
    console.log("Suppression bloc:", blockId);

    // Supprimer immédiatement de l'état local
    setBlocks((prev) => {
      const newBlocks = prev.filter((b) => b.id !== blockId);
      console.log("Blocs restants:", newBlocks.length);
      return newBlocks;
    });
    setSelectedBlockId(null);

    // Supprimer en base
    try {
      const { error } = await (supabase as any).from("mechanical_blocks").delete().eq("id", blockId);

      if (error) {
        console.error("Erreur suppression:", error);
        toast.error("Erreur lors de la suppression");
        // Recharger si erreur
        if (activeChapterId) loadBlocks(activeChapterId);
      } else {
        toast.success("Bloc supprimé");
      }
    } catch (error) {
      console.error("Erreur suppression bloc:", error);
      if (activeChapterId) loadBlocks(activeChapterId);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Drag & Drop des blocs - VERSION 100% DOM (pas de state pendant le drag)
  const handleBlockMouseDown = (e: React.MouseEvent, blockId: string) => {
    // Ne pas déclencher le drag si on clique sur un élément interactif
    const target = e.target as HTMLElement;
    if (
      target.closest(".block-content") ||
      target.closest("button") ||
      target.closest("textarea") ||
      target.closest("input")
    ) {
      return;
    }

    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const element = (e.target as HTMLElement).closest(".content-block") as HTMLElement;
    if (!element) return;

    e.preventDefault();

    // Stocker les références
    draggingBlockIdRef.current = blockId;
    dragElementRef.current = element;
    dragStartPosRef.current = { x: block.position_x, y: block.position_y };
    dragOffsetRef.current = { x: e.clientX, y: e.clientY };

    setSelectedBlockId(blockId);

    // Style pendant le drag
    element.style.zIndex = "1000";
    element.style.cursor = "grabbing";
    element.style.pointerEvents = "none";

    // Attacher les listeners DIRECTEMENT (pas via useEffect)
    const handleMove = (moveEvent: MouseEvent) => {
      if (!dragElementRef.current) return;

      const deltaX = moveEvent.clientX - dragOffsetRef.current.x;
      const deltaY = moveEvent.clientY - dragOffsetRef.current.y;
      const newX = Math.max(0, dragStartPosRef.current.x + deltaX);
      const newY = Math.max(0, dragStartPosRef.current.y + deltaY);

      dragElementRef.current.style.left = `${newX}px`;
      dragElementRef.current.style.top = `${newY}px`;
    };

    const handleUp = (upEvent: MouseEvent) => {
      if (draggingBlockIdRef.current && dragElementRef.current) {
        const deltaX = upEvent.clientX - dragOffsetRef.current.x;
        const deltaY = upEvent.clientY - dragOffsetRef.current.y;
        const finalX = Math.max(0, dragStartPosRef.current.x + deltaX);
        const finalY = Math.max(0, dragStartPosRef.current.y + deltaY);

        // Reset le style
        dragElementRef.current.style.zIndex = "";
        dragElementRef.current.style.cursor = "";
        dragElementRef.current.style.pointerEvents = "";

        // Sauvegarder en base (le DOM est déjà à jour visuellement)
        handleUpdateBlock(draggingBlockIdRef.current, {
          position_x: finalX,
          position_y: finalY,
        });

        // Mettre à jour le state pour sync
        setBlocks((prev) =>
          prev.map((b) => (b.id === draggingBlockIdRef.current ? { ...b, position_x: finalX, position_y: finalY } : b)),
        );
      }

      // Cleanup
      draggingBlockIdRef.current = null;
      dragElementRef.current = null;

      // Retirer les listeners
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  // Toggle checkbox dans une checklist
  const handleChecklistToggle = async (blockId: string, lineIndex: number) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const lines = block.content.split("\n");
    if (lineIndex >= lines.length) return;

    const line = lines[lineIndex];

    // Toggle entre [] et [x]
    if (line.startsWith("[]")) {
      lines[lineIndex] = "[x]" + line.substring(2);
    } else if (line.startsWith("[x]")) {
      lines[lineIndex] = "[]" + line.substring(3);
    }

    const newContent = lines.join("\n");

    // Mettre à jour localement
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: newContent } : b)));

    // Sauvegarder en base
    await handleUpdateBlock(blockId, { content: newContent });
  };

  // Ajouter une nouvelle ligne à la checklist
  const handleAddChecklistItem = async (blockId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const newContent = block.content + "\n[] ";

    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: newContent } : b)));

    await handleUpdateBlock(blockId, { content: newContent });

    // Focus sur le nouvel élément
    setTimeout(() => {
      const lines = newContent.split("\n");
      const input = document.querySelector(
        `[data-checklist-input="${blockId}-${lines.length - 1}"]`,
      ) as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 100);
  };

  // Ajouter une ligne après un index spécifique (checklist)
  const handleAddChecklistItemAfter = async (blockId: string, afterIndex: number) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const lines = block.content.split("\n");
    lines.splice(afterIndex + 1, 0, "[] ");
    const newContent = lines.join("\n");

    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: newContent } : b)));

    await handleUpdateBlock(blockId, { content: newContent });

    // Focus sur le nouvel élément avec un délai suffisant pour le re-render
    setTimeout(() => {
      const input = document.querySelector(`[data-checklist-input="${blockId}-${afterIndex + 1}"]`) as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
  };

  // Modifier le texte d'une ligne de checklist
  const handleChecklistTextChange = async (blockId: string, lineIndex: number, newText: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const lines = block.content.split("\n");
    if (lineIndex >= lines.length) return;

    const line = lines[lineIndex];
    const prefix = line.startsWith("[x]") ? "[x] " : "[] ";
    lines[lineIndex] = prefix + newText;

    const newContent = lines.join("\n");

    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: newContent } : b)));

    await handleUpdateBlock(blockId, { content: newContent });
  };

  // Supprimer une ligne de checklist
  const handleDeleteChecklistItem = async (blockId: string, lineIndex: number) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const lines = block.content.split("\n");
    if (lineIndex >= lines.length) return;

    lines.splice(lineIndex, 1);
    const newContent = lines.join("\n");

    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: newContent } : b)));

    await handleUpdateBlock(blockId, { content: newContent });
  };

  // Ajouter un élément à une liste
  const handleAddListItem = async (blockId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const newContent = block.content + "\n• ";

    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: newContent } : b)));

    await handleUpdateBlock(blockId, { content: newContent });

    // Focus sur le nouvel élément
    setTimeout(() => {
      const lines = newContent.split("\n");
      const input = document.querySelector(`[data-list-input="${blockId}-${lines.length - 1}"]`) as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 100);
  };

  // Ajouter un élément après un index spécifique (liste)
  const handleAddListItemAfter = async (blockId: string, afterIndex: number) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const lines = block.content.split("\n");
    lines.splice(afterIndex + 1, 0, "• ");
    const newContent = lines.join("\n");

    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: newContent } : b)));

    await handleUpdateBlock(blockId, { content: newContent });

    // Focus sur le nouvel élément avec un délai suffisant pour le re-render
    setTimeout(() => {
      const input = document.querySelector(`[data-list-input="${blockId}-${afterIndex + 1}"]`) as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
  };

  // Modifier le texte d'une ligne de liste
  const handleListTextChange = async (blockId: string, lineIndex: number, newText: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const lines = block.content.split("\n");
    if (lineIndex >= lines.length) return;

    lines[lineIndex] = "• " + newText;

    const newContent = lines.join("\n");

    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: newContent } : b)));

    await handleUpdateBlock(blockId, { content: newContent });
  };

  // Supprimer une ligne de liste
  const handleDeleteListItem = async (blockId: string, lineIndex: number) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const lines = block.content.split("\n");
    if (lineIndex >= lines.length) return;

    lines.splice(lineIndex, 1);
    const newContent = lines.join("\n");

    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: newContent } : b)));

    await handleUpdateBlock(blockId, { content: newContent });
  };

  // Resize des blocs - DOIT être défini avant useMemo pour initialNodes
  const handleResizeMouseDown = (e: React.MouseEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const element = (e.target as HTMLElement).closest(".content-block") as HTMLElement;
    if (!element) return;

    resizingBlockIdRef.current = blockId;
    dragElementRef.current = element;
    resizeStartRef.current = {
      width: block.width,
      height: block.height,
      x: e.clientX,
      y: e.clientY,
    };

    const handleResizeMove = (moveEvent: MouseEvent) => {
      if (!resizingBlockIdRef.current || !dragElementRef.current) return;

      const deltaX = moveEvent.clientX - resizeStartRef.current.x;
      const deltaY = moveEvent.clientY - resizeStartRef.current.y;

      const newWidth = Math.max(150, resizeStartRef.current.width + deltaX);
      const newHeight = Math.max(100, resizeStartRef.current.height + deltaY);

      dragElementRef.current.style.width = `${newWidth}px`;
      dragElementRef.current.style.height = `${newHeight}px`;
      dragElementRef.current.style.minHeight = `${newHeight}px`;
    };

    const handleResizeUp = (upEvent: MouseEvent) => {
      if (resizingBlockIdRef.current && dragElementRef.current) {
        const deltaX = upEvent.clientX - resizeStartRef.current.x;
        const deltaY = upEvent.clientY - resizeStartRef.current.y;

        const finalWidth = Math.max(150, resizeStartRef.current.width + deltaX);
        const finalHeight = Math.max(100, resizeStartRef.current.height + deltaY);

        // Sauvegarder en base
        handleUpdateBlock(resizingBlockIdRef.current, {
          width: finalWidth,
          height: finalHeight,
        });

        // Mettre à jour le state
        setBlocks((prev) =>
          prev.map((b) => (b.id === resizingBlockIdRef.current ? { ...b, width: finalWidth, height: finalHeight } : b)),
        );
      }

      resizingBlockIdRef.current = null;
      dragElementRef.current = null;

      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeUp);
    };

    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeUp);
  };

  // Upload d'image pour un bloc
  const handleImageUpload = async (blockId: string, file: File) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `${userData.user.id}/${blockId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("mechanical-images").upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("mechanical-images").getPublicUrl(fileName);

      await handleUpdateBlock(blockId, { image_url: publicUrl, content: publicUrl });
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, image_url: publicUrl } : b)));
      toast.success("Image uploadée");
    } catch (error) {
      console.error("Erreur upload:", error);
      toast.error("Erreur lors de l'upload");
    }
  };

  // Upload d'audio pour un bloc
  const handleAudioUpload = async (blockId: string, file: File) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `${userData.user.id}/${blockId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("mechanical-audio").upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("mechanical-audio").getPublicUrl(fileName);

      await handleUpdateBlock(blockId, { audio_url: publicUrl });
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, audio_url: publicUrl } : b)));
      toast.success("Audio uploadé - Vous pouvez maintenant le transcrire");
    } catch (error) {
      console.error("Erreur upload audio:", error);
      toast.error("Erreur lors de l'upload audio");
    }
  };

  // ============================================
  // REACT FLOW - GESTION DES CONNEXIONS
  // ============================================

  // Convertir les blocs en nodes React Flow
  const initialNodes = useMemo(() => {
    return blocks.map((block) => ({
      id: block.id,
      type: "customBlock",
      position: { x: block.position_x, y: block.position_y },
      data: {
        block,
        onUpdateBlock: handleUpdateBlock,
        onDeleteBlock: handleDeleteBlock,
        onChecklistToggle: handleChecklistToggle,
        onAddChecklistItem: handleAddChecklistItemAfter,
        onAddListItem: handleAddListItemAfter,
        onImageUpload: handleImageUpload,
        onAudioUpload: handleAudioUpload,
        onResizeStart: handleResizeMouseDown,
      },
      style: { width: block.width, height: "auto" },
    }));
  }, [blocks]);

  // Utiliser les hooks optimisés de React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);

  // Référence pour tracker les IDs des blocs
  const blocksIdsRef = useRef<string>("");

  // Synchroniser les nodes quand les blocs changent (seulement si nécessaire)
  useEffect(() => {
    const currentIds = blocks
      .map((b) => `${b.id}-${b.title}-${b.content}-${b.width}-${b.height}-${b.image_url}-${b.audio_url}`)
      .join(",");
    if (currentIds !== blocksIdsRef.current) {
      blocksIdsRef.current = currentIds;
      setNodes(
        blocks.map((block) => ({
          id: block.id,
          type: "customBlock",
          position: { x: block.position_x, y: block.position_y },
          data: {
            block: { ...block }, // 🔥 Copie pour forcer la mise à jour du memo
            onUpdateBlock: handleUpdateBlock,
            onDeleteBlock: handleDeleteBlock,
            onChecklistToggle: handleChecklistToggle,
            onAddChecklistItem: handleAddChecklistItemAfter,
            onAddListItem: handleAddListItemAfter,
            onImageUpload: handleImageUpload,
            onAudioUpload: handleAudioUpload,
            onResizeStart: handleResizeMouseDown,
          },
          style: { width: block.width, height: "auto" },
        })),
      );
    }
  }, [blocks, setNodes]);

  // Synchroniser les edges
  useEffect(() => {
    setFlowEdges(
      edges.map((edge) => ({
        id: edge.id,
        source: edge.source_block_id,
        target: edge.target_block_id,
        sourceHandle: edge.source_handle || undefined, // 🔥 Utiliser le handle source
        targetHandle: edge.target_handle || undefined, // 🔥 Utiliser le handle target
        type: edge.edge_type || "smoothstep",
        animated: edge.animated,
        label: edge.label,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2, stroke: "#64748b" },
      })),
    );
  }, [edges, setFlowEdges]);

  // Gérer la création d'une nouvelle connexion
  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || !activeChapterId) return;

      try {
        const { data, error } = await (supabase as any)
          .from("mechanical_edges")
          .insert({
            chapter_id: activeChapterId,
            source_block_id: connection.source,
            target_block_id: connection.target,
            source_handle: connection.sourceHandle || null, // 🔥 Capturer le handle source
            target_handle: connection.targetHandle || null, // 🔥 Capturer le handle target
            edge_type: "smoothstep",
            animated: false,
          })
          .select()
          .single();

        if (error) throw error;

        setEdges((prev) => [...prev, data]);
        toast.success("Connexion créée");
      } catch (error: any) {
        console.error("Erreur création connexion:", error);
        if (error.code === "23505") {
          toast.error("Cette connexion existe déjà");
        } else {
          toast.error("Erreur lors de la création");
        }
      }
    },
    [activeChapterId],
  );

  // Supprimer une connexion
  const handleDeleteEdge = useCallback(async (edgeId: string) => {
    try {
      const { error } = await (supabase as any).from("mechanical_edges").delete().eq("id", edgeId);

      if (error) throw error;

      setEdges((prev) => prev.filter((e) => e.id !== edgeId));
      toast.success("Connexion supprimée");
    } catch (error) {
      console.error("Erreur suppression connexion:", error);
      toast.error("Erreur lors de la suppression");
    }
  }, []);

  // Mettre à jour la position d'un node après drag (sauvegarde uniquement à la fin)
  const handleNodeDragStop = useCallback(async (_: any, node: Node) => {
    // Sauvegarder en base uniquement à la fin du drag
    // On ne met pas à jour le state local car React Flow gère la position visuellement
    await (supabase as any)
      .from("mechanical_blocks")
      .update({
        position_x: Math.round(node.position.x),
        position_y: Math.round(node.position.y),
      })
      .eq("id", node.id);

    // Mettre à jour silencieusement le state des blocs (pour que les données soient cohérentes)
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === node.id
          ? { ...b, position_x: Math.round(node.position.x), position_y: Math.round(node.position.y) }
          : b,
      ),
    );
  }, []);

  // Auto-layout avec DAGRE
  const handleAutoLayout = useCallback(async () => {
    if (blocks.length === 0) return;

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 80 }); // TB = Top to Bottom

    // Ajouter les nodes
    blocks.forEach((block) => {
      dagreGraph.setNode(block.id, { width: block.width, height: block.height || 150 });
    });

    // Ajouter les edges
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source_block_id, edge.target_block_id);
    });

    // Calculer le layout
    dagre.layout(dagreGraph);

    // Appliquer les nouvelles positions
    const updates: Promise<void>[] = [];
    const newBlocks = blocks.map((block) => {
      const nodeWithPosition = dagreGraph.node(block.id);
      const newX = nodeWithPosition.x - block.width / 2;
      const newY = nodeWithPosition.y - (block.height || 150) / 2;

      updates.push(handleUpdateBlock(block.id, { position_x: newX, position_y: newY }));

      return { ...block, position_x: newX, position_y: newY };
    });

    setBlocks(newBlocks);
    await Promise.all(updates);

    toast.success("Blocs réorganisés automatiquement");
  }, [blocks, edges]);

  // Supprimer toutes les connexions
  const handleClearAllEdges = useCallback(async () => {
    if (!activeChapterId || edges.length === 0) return;

    try {
      const { error } = await (supabase as any).from("mechanical_edges").delete().eq("chapter_id", activeChapterId);

      if (error) throw error;

      setEdges([]);
      toast.success("Toutes les connexions supprimées");
    } catch (error) {
      console.error("Erreur suppression connexions:", error);
      toast.error("Erreur lors de la suppression");
    }
  }, [activeChapterId, edges]);

  // Double-clic pour éditer un bloc
  const handleNodeDoubleClick = useCallback(
    (_: any, node: Node) => {
      const block = blocks.find((b) => b.id === node.id);
      if (block) {
        setEditingBlock({ ...block });
        setIsEditBlockDialogOpen(true);
      }
    },
    [blocks],
  );

  // Sauvegarder les modifications du bloc
  const handleSaveBlockEdit = async () => {
    if (!editingBlock) return;

    try {
      await handleUpdateBlock(editingBlock.id, {
        content: editingBlock.content,
        width: editingBlock.width,
        height: editingBlock.height,
      });

      setBlocks((prev) => prev.map((b) => (b.id === editingBlock.id ? editingBlock : b)));

      setIsEditBlockDialogOpen(false);
      setEditingBlock(null);
      toast.success("Bloc mis à jour");
    } catch (error) {
      console.error("Erreur mise à jour bloc:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  // Supprimer le bloc depuis le dialog
  const handleDeleteBlockFromDialog = async () => {
    if (!editingBlock) return;

    await handleDeleteBlock(editingBlock.id);
    setIsEditBlockDialogOpen(false);
    setEditingBlock(null);
  };

  // Plus besoin de useEffect pour les listeners de drag - ils sont attachés dans mousedown

  // Récupérer la clé API Gemini depuis les paramètres utilisateur
  const getGeminiApiKey = async (): Promise<string | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const { data: settings } = await (supabase as any)
        .from("user_ai_settings")
        .select("gemini_api_key")
        .eq("user_id", userData.user.id)
        .single();

      return settings?.gemini_api_key || null;
    } catch (error) {
      console.error("Erreur récupération clé API:", error);
      return null;
    }
  };

  // Analyser un dessin/schéma avec Gemini Vision et créer les blocs
  const handleAnalyzeSchema = async (mode: "blocks" | "svg" | "dxf" = "blocks") => {
    if (!schemaImportImage) return;

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      toast.error("Clé API Gemini non configurée. Allez dans Mon Compte > IA pour l'ajouter.");
      return;
    }

    setSchemaImportLoading(true);

    try {
      // Extraire le base64 de l'image
      const base64Image = schemaImportImage.split(",")[1];
      const mimeType = schemaImportImage.split(";")[0].split(":")[1];

      let prompt = "";

      if (mode === "svg") {
        prompt = `Analyse ce dessin/croquis et recrée-le en SVG propre et professionnel.

RÈGLES IMPORTANTES :
- Redessine les formes de manière nette et alignée
- Utilise des lignes droites là où l'intention est une ligne droite
- Utilise des cercles/ellipses parfaits là où l'intention est un cercle
- Conserve les proportions et la disposition générale
- Ajoute des couleurs appropriées si le dessin en a, sinon utilise noir (#333)
- Utilise des épaisseurs de trait cohérentes (stroke-width)
- Pour les flèches, utilise des markers SVG
- Recopie tout texte visible de manière lisible (font-family: sans-serif)
- Dimensions du SVG : largeur 800px, hauteur proportionnelle

RÉPONDS UNIQUEMENT avec le code SVG complet, commençant par <svg et finissant par </svg>.
Pas de markdown, pas de backticks, pas d'explication.`;
      } else if (mode === "dxf") {
        prompt = `Analyse ce dessin/croquis et génère les instructions pour le recréer en DXF.

Retourne un JSON avec cette structure :
{
  "entities": [
    { "type": "LINE", "start": [x1, y1], "end": [x2, y2], "layer": "0" },
    { "type": "CIRCLE", "center": [x, y], "radius": r, "layer": "0" },
    { "type": "ARC", "center": [x, y], "radius": r, "startAngle": a1, "endAngle": a2, "layer": "0" },
    { "type": "TEXT", "position": [x, y], "text": "contenu", "height": 10, "layer": "0" },
    { "type": "POLYLINE", "points": [[x1,y1], [x2,y2], ...], "closed": false, "layer": "0" }
  ],
  "dimensions": { "width": 800, "height": 600 }
}

RÈGLES :
- Redessine les formes de manière nette et précise
- Utilise LINE pour les lignes droites
- Utilise CIRCLE pour les cercles
- Utilise ARC pour les arcs de cercle
- Utilise POLYLINE pour les formes complexes
- Utilise TEXT pour tout texte visible
- Coordonnées en millimètres, origine en bas à gauche
- Conserve les proportions du dessin original

RÉPONDS UNIQUEMENT avec le JSON, sans markdown, sans backticks.`;
      } else {
        // Mode blocs (existant)
        prompt = `Analyse ce dessin/schéma technique et extrais-en la structure.

Tu dois retourner un JSON avec exactement cette structure :
{
  "blocks": [
    {
      "type": "text" | "checklist" | "list" | "warning" | "tip" | "tools",
      "content": "contenu du bloc",
      "label": "étiquette courte pour identifier le bloc"
    }
  ],
  "connections": [
    {
      "from": "label du bloc source",
      "to": "label du bloc cible"
    }
  ]
}

Règles :
- Identifie chaque élément/boîte/étape du schéma comme un bloc
- Les flèches ou lignes de connexion deviennent des "connections"
- Utilise "checklist" pour les listes d'étapes à cocher
- Utilise "warning" pour les points d'attention/danger
- Utilise "tip" pour les astuces/conseils
- Utilise "tools" pour les listes d'outils/matériel
- Utilise "list" pour les listes simples
- Utilise "text" pour le reste

Réponds UNIQUEMENT avec le JSON, sans markdown, sans backticks, sans explication.`;
      }

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ inlineData: { mimeType, data: base64Image } }, { text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
            },
          }),
        },
      );

      const data = await geminiResponse.json();

      if (data.error) {
        throw new Error(data.error.message || "Erreur API Gemini");
      }

      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) {
        throw new Error("Réponse vide de Gemini");
      }

      if (mode === "svg") {
        // Extraire le SVG
        const svgMatch = responseText.match(/<svg[\s\S]*<\/svg>/i);
        if (!svgMatch) {
          throw new Error("Impossible d'extraire le SVG de la réponse");
        }

        const svgContent = svgMatch[0];

        // Stocker le SVG pour l'aperçu
        setGeneratedSvg(svgContent);

        // Si on a un chapitre actif, insérer comme bloc image
        if (activeChapterId) {
          try {
            // Convertir le SVG en blob et uploader sur Supabase
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) throw new Error("Non connecté");

            const svgBlob = new Blob([svgContent], { type: "image/svg+xml" });
            const fileName = `${userData.user.id}/${mode}-${Date.now()}.svg`;

            const { error: uploadError } = await supabase.storage
              .from("mechanical-images")
              .upload(fileName, svgBlob, { contentType: "image/svg+xml" });

            if (uploadError) throw uploadError;

            const {
              data: { publicUrl },
            } = supabase.storage.from("mechanical-images").getPublicUrl(fileName);

            // 🔥 Calculer la position centrée
            const { x: posX, y: posY } = getNextBlockPosition(blocks, 400, 300);

            // Créer un bloc image avec le SVG
            const { error: blockError } = await (supabase as any).from("mechanical_blocks").insert({
              chapter_id: activeChapterId,
              type: "image",
              content: "Schéma SVG généré par IA",
              image_url: publicUrl,
              position_x: posX,
              position_y: posY,
              width: 400,
              height: 300,
              order_index: blocks.length,
            });

            if (blockError) throw blockError;

            // Recharger les blocs
            await loadBlocks(activeChapterId);

            toast.success("SVG inséré dans le chapitre !");

            // Fermer le dialog
            setIsSchemaImportDialogOpen(false);
            setSchemaImportImage(null);
            setGeneratedSvg(null);
          } catch (uploadError: any) {
            console.error("Erreur insertion:", uploadError);
            // Fallback : proposer le téléchargement
            toast.error("Impossible d'insérer, téléchargement en cours...");
            const blob = new Blob([svgContent], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `schema-${Date.now()}.svg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        } else {
          // Pas de chapitre actif, télécharger
          const blob = new Blob([svgContent], { type: "image/svg+xml" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `schema-${Date.now()}.svg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          toast.success("SVG téléchargé (sélectionnez un chapitre pour l'insérer directement)");
        }
      } else if (mode === "dxf") {
        // Parser le JSON et générer le DXF
        const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, "").trim();
        const dxfData = JSON.parse(cleanedResponse);

        // Générer le fichier DXF
        const dxfContent = generateDXF(dxfData);

        const blob = new Blob([dxfContent], { type: "application/dxf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `schema-${Date.now()}.dxf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success("DXF généré et téléchargé !");
      } else {
        // Mode blocs - créer dans le chapitre
        if (!activeChapterId) {
          toast.error("Sélectionnez d'abord un chapitre");
          return;
        }

        const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, "").trim();
        const schema = JSON.parse(cleanedResponse);

        if (!schema.blocks || !Array.isArray(schema.blocks)) {
          throw new Error("Format de réponse invalide");
        }

        // Créer les blocs
        const createdBlocks: { label: string; id: string }[] = [];
        const blockWidth = 300;
        const blockHeight = 150;
        const gapX = 100;
        const gapY = 50;
        const blocksPerRow = 3;

        // 🔥 Calculer une grille centrée
        const totalRows = Math.ceil(schema.blocks.length / blocksPerRow);
        const centerX = 600;
        const centerY = 400;
        const gridWidth = blocksPerRow * blockWidth + (blocksPerRow - 1) * gapX;
        const gridHeight = totalRows * blockHeight + (totalRows - 1) * gapY;
        const startX = centerX - gridWidth / 2;
        const startY = centerY - gridHeight / 2;

        for (let i = 0; i < schema.blocks.length; i++) {
          const blockData = schema.blocks[i];
          const row = Math.floor(i / blocksPerRow);
          const col = i % blocksPerRow;

          const position_x = startX + col * (blockWidth + gapX);
          const position_y = startY + row * (blockHeight + gapY);

          let content = blockData.content;
          if (blockData.type === "checklist" && typeof content === "string") {
            const lines = content.split(/[\n,•\-]/);
            content = lines
              .map((line) => line.trim())
              .filter((line) => line)
              .map((line) => `[] ${line}`)
              .join("\n");
          } else if (blockData.type === "list" && typeof content === "string") {
            const lines = content.split(/[\n,]/);
            content = lines
              .map((line) => line.trim())
              .filter((line) => line)
              .map((line) => `• ${line.replace(/^[•\-]\s*/, "")}`)
              .join("\n");
          }

          const { data: newBlock, error } = await (supabase as any)
            .from("mechanical_blocks")
            .insert({
              chapter_id: activeChapterId,
              type: blockData.type || "text",
              content: content || "",
              position_x,
              position_y,
              width: blockWidth,
              height: blockHeight,
              order_index: blocks.length + i,
            })
            .select()
            .single();

          if (!error) {
            createdBlocks.push({ label: blockData.label || `Bloc ${i + 1}`, id: newBlock.id });
          }
        }

        // Créer les connexions
        if (schema.connections && Array.isArray(schema.connections)) {
          for (const conn of schema.connections) {
            const sourceBlock = createdBlocks.find((b) => b.label.toLowerCase() === conn.from?.toLowerCase());
            const targetBlock = createdBlocks.find((b) => b.label.toLowerCase() === conn.to?.toLowerCase());

            if (sourceBlock && targetBlock) {
              await (supabase as any).from("mechanical_edges").insert({
                chapter_id: activeChapterId,
                source_block_id: sourceBlock.id,
                target_block_id: targetBlock.id,
                edge_type: "smoothstep",
                animated: false,
              });
            }
          }
        }

        await loadBlocks(activeChapterId);
        toast.success(`${createdBlocks.length} blocs créés !`);
        setTimeout(() => handleAutoLayout(), 500);
      }

      if (mode !== "svg") {
        setIsSchemaImportDialogOpen(false);
        setSchemaImportImage(null);
      }
    } catch (error: any) {
      console.error("Erreur analyse schéma:", error);
      toast.error(error.message || "Erreur lors de l'analyse");
    } finally {
      setSchemaImportLoading(false);
    }
  };

  // Générer un fichier DXF à partir des entités
  const generateDXF = (data: { entities: any[]; dimensions: { width: number; height: number } }): string => {
    let dxf = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1014
9
$EXTMIN
10
0
20
0
9
$EXTMAX
10
${data.dimensions.width}
20
${data.dimensions.height}
0
ENDSEC
0
SECTION
2
ENTITIES
`;

    for (const entity of data.entities) {
      switch (entity.type) {
        case "LINE":
          dxf += `0
LINE
8
${entity.layer || "0"}
10
${entity.start[0]}
20
${entity.start[1]}
11
${entity.end[0]}
21
${entity.end[1]}
`;
          break;

        case "CIRCLE":
          dxf += `0
CIRCLE
8
${entity.layer || "0"}
10
${entity.center[0]}
20
${entity.center[1]}
40
${entity.radius}
`;
          break;

        case "ARC":
          dxf += `0
ARC
8
${entity.layer || "0"}
10
${entity.center[0]}
20
${entity.center[1]}
40
${entity.radius}
50
${entity.startAngle}
51
${entity.endAngle}
`;
          break;

        case "TEXT":
          dxf += `0
TEXT
8
${entity.layer || "0"}
10
${entity.position[0]}
20
${entity.position[1]}
40
${entity.height || 10}
1
${entity.text}
`;
          break;

        case "POLYLINE":
          dxf += `0
LWPOLYLINE
8
${entity.layer || "0"}
90
${entity.points.length}
70
${entity.closed ? 1 : 0}
`;
          for (const point of entity.points) {
            dxf += `10
${point[0]}
20
${point[1]}
`;
          }
          break;
      }
    }

    dxf += `0
ENDSEC
0
EOF`;

    return dxf;
  };

  // Importer un PDF et le transformer en gamme de montage
  const handleImportPdf = async () => {
    if (!pdfImportFile) return;

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      toast.error("Clé API Gemini non configurée. Allez dans Mon Compte > IA pour l'ajouter.");
      return;
    }

    setPdfImportLoading(true);
    setPdfImportProgress("Lecture du PDF...");

    try {
      // Convertir le PDF en base64
      const base64Pdf = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(pdfImportFile);
      });

      setPdfImportProgress("Analyse du document avec l'IA...");

      // Analyser le PDF avec Gemini (utiliser gemini-1.5-pro pour meilleure analyse PDF)
      const prompt = `Analyse ce document PDF qui est une gamme de montage / procédure technique / notice d'installation.

IMPORTANT: Tu DOIS extraire le contenu et le structurer en chapitres et blocs.

Retourne un JSON avec ce format EXACT :
{
  "title": "Titre du document",
  "description": "Description courte",
  "chapters": [
    {
      "title": "Titre du chapitre ou section",
      "blocks": [
        {
          "type": "text",
          "title": "Titre optionnel",
          "content": "Contenu textuel"
        }
      ]
    }
  ]
}

RÈGLES :
- S'il n'y a pas de sections claires, crée UN SEUL chapitre "Contenu principal"
- Chaque paragraphe important = un bloc "text"
- Les listes numérotées = bloc "checklist" avec format "[] Étape 1\\n[] Étape 2"
- Les listes à puces = bloc "list" avec format "• Item 1\\n• Item 2"
- Les avertissements/ATTENTION/DANGER = bloc "warning"
- Les notes/conseils/astuces = bloc "tip"
- Les listes d'outils/matériel nécessaire = bloc "tools"
- NE RÉSUME PAS, conserve tout le texte important
- Tu DOIS retourner au moins 1 chapitre avec au moins 1 bloc

RÉPONDS UNIQUEMENT avec le JSON valide, sans markdown, sans backticks, sans texte avant ou après.`;

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: "application/pdf",
                      data: base64Pdf,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 65536,
            },
          }),
        },
      );

      const data = await geminiResponse.json();

      if (data.error) {
        throw new Error(data.error.message || "Erreur API Gemini");
      }

      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) {
        throw new Error("Réponse vide de Gemini");
      }

      // Parser le JSON
      let cleanedResponse = responseText.replace(/```json\n?|\n?```/g, "").trim();

      // Essayer de trouver le JSON dans la réponse si elle contient du texte avant/après
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      console.log("Réponse Gemini nettoyée:", cleanedResponse.substring(0, 1000));

      let pdfStructure;
      try {
        pdfStructure = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error("Erreur parsing JSON:", parseError);
        console.log("Réponse complète:", cleanedResponse);
        throw new Error("L'IA n'a pas retourné un JSON valide. Vérifiez la console pour plus de détails.");
      }

      console.log("Structure PDF parsée:", pdfStructure);
      console.log("Nombre de chapitres:", pdfStructure.chapters?.length);

      // Si pas de chapitres, créer un chapitre par défaut avec le contenu brut
      if (!pdfStructure.chapters || !Array.isArray(pdfStructure.chapters) || pdfStructure.chapters.length === 0) {
        console.warn("Pas de chapitres détectés, création d'un chapitre par défaut");

        // Créer un chapitre par défaut
        pdfStructure.chapters = [
          {
            title: "Contenu importé",
            blocks: [
              {
                type: "text",
                title: "Contenu du PDF",
                content:
                  pdfStructure.content ||
                  pdfStructure.text ||
                  pdfStructure.description ||
                  "Contenu non extrait - veuillez éditer ce bloc manuellement",
              },
            ],
          },
        ];
      }

      setPdfImportProgress("Création de la gamme...");

      // Créer la gamme
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Non connecté");

      console.log("Création gamme avec:", {
        user_id: userData.user.id,
        title: pdfStructure.title || pdfImportFile.name.replace(".pdf", ""),
        description: pdfStructure.description || `Importé depuis ${pdfImportFile.name}`,
      });

      const { data: newGammeData, error: gammeError } = await (supabase as any)
        .from("mechanical_gammes")
        .insert({
          user_id: userData.user.id,
          title: pdfStructure.title || pdfImportFile.name.replace(".pdf", ""),
          description: pdfStructure.description || `Importé depuis ${pdfImportFile.name}`,
        })
        .select()
        .single();

      console.log("Résultat création gamme:", { newGammeData, gammeError });

      if (gammeError) {
        console.error("Erreur création gamme:", JSON.stringify(gammeError, null, 2));
        throw new Error(`Erreur création gamme: ${gammeError.message || JSON.stringify(gammeError)}`);
      }

      if (!newGammeData || !newGammeData.id) {
        throw new Error("Gamme créée mais pas d'ID retourné");
      }

      console.log("Gamme créée avec ID:", newGammeData.id);

      setPdfImportProgress("Création des chapitres et blocs...");

      // Créer les chapitres et blocs
      let createdChapters = 0;
      let createdBlocks = 0;

      for (let chapterIndex = 0; chapterIndex < pdfStructure.chapters.length; chapterIndex++) {
        const chapter = pdfStructure.chapters[chapterIndex];
        console.log(`Création chapitre ${chapterIndex + 1}:`, chapter.title);

        // Créer le chapitre
        const { data: newChapterData, error: chapterError } = await (supabase as any)
          .from("mechanical_chapters")
          .insert({
            gamme_id: newGammeData.id,
            title: chapter.title || `Chapitre ${chapterIndex + 1}`,
            order_index: chapterIndex,
          })
          .select()
          .single();

        if (chapterError) {
          console.error("Erreur création chapitre - détails:", JSON.stringify(chapterError, null, 2));
          toast.error(
            `Erreur: ${chapterError.message || chapterError.details || chapterError.hint || JSON.stringify(chapterError)}`,
          );
          continue;
        }

        createdChapters++;
        console.log("Chapitre créé avec ID:", newChapterData.id);

        // Créer les blocs du chapitre
        let blocksToCreate = chapter.blocks;

        // Si pas de blocs, créer un bloc texte par défaut
        if (!blocksToCreate || !Array.isArray(blocksToCreate) || blocksToCreate.length === 0) {
          blocksToCreate = [
            {
              type: "text",
              title: null,
              content: chapter.content || chapter.description || "Contenu à ajouter",
            },
          ];
        }

        console.log(`  - ${blocksToCreate.length} blocs à créer`);

        // 🔥 Calculer une grille centrée pour les blocs
        const blockWidth = 400;
        const blockHeight = 150;
        const gapX = 50;
        const gapY = 50;
        const blocksPerRow = 2;
        const totalRows = Math.ceil(blocksToCreate.length / blocksPerRow);

        // Centre du canvas (position par défaut)
        const centerX = 600;
        const centerY = 400;

        // Calculer l'offset pour centrer la grille
        const gridWidth = blocksPerRow * blockWidth + (blocksPerRow - 1) * gapX;
        const gridHeight = totalRows * blockHeight + (totalRows - 1) * gapY;
        const startX = centerX - gridWidth / 2;
        const startY = centerY - gridHeight / 2;

        for (let blockIndex = 0; blockIndex < blocksToCreate.length; blockIndex++) {
          const block = blocksToCreate[blockIndex];

          const row = Math.floor(blockIndex / blocksPerRow);
          const col = blockIndex % blocksPerRow;

          const { error: blockError } = await (supabase as any).from("mechanical_blocks").insert({
            chapter_id: newChapterData.id,
            type: block.type || "text",
            title: block.title || null,
            content: block.content || "",
            position_x: Math.round(startX + col * (blockWidth + gapX)),
            position_y: Math.round(startY + row * (blockHeight + gapY)),
            width: blockWidth,
            height: blockHeight,
            order_index: blockIndex,
          });

          if (blockError) {
            console.error("Erreur création bloc:", blockError);
          } else {
            createdBlocks++;
          }
        }

        setPdfImportProgress(`Chapitre ${chapterIndex + 1}/${pdfStructure.chapters.length} créé...`);
      }

      console.log(`Création terminée: ${createdChapters} chapitres, ${createdBlocks} blocs`);

      // Recharger les gammes
      await loadGammes();

      // Sélectionner la nouvelle gamme et charger ses chapitres
      setActiveGammeId(newGammeData.id);
      await loadChapters(newGammeData.id);

      setIsPdfImportDialogOpen(false);
      setPdfImportFile(null);
      setPdfImportProgress("");

      toast.success(`Gamme créée : ${createdChapters} chapitres, ${createdBlocks} blocs !`);
      console.log("Import terminé avec succès. Gamme ID:", newGammeData.id);
    } catch (error: any) {
      console.error("Erreur import PDF:", error);
      toast.error(error.message || "Erreur lors de l'import du PDF");
    } finally {
      setPdfImportLoading(false);
      setPdfImportProgress("");
    }
  };

  // Transcrire l'audio avec Gemini
  const handleTranscribeAudio = async (blockId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block?.audio_url) {
      toast.error("Aucun fichier audio à transcrire");
      return;
    }

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      toast.error("Clé API Gemini non configurée. Allez dans Paramètres > IA pour l'ajouter.");
      return;
    }

    setTranscribingBlockId(blockId);

    try {
      // Télécharger l'audio et le convertir en base64
      const response = await fetch(block.audio_url);
      const audioBlob = await response.blob();

      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // Déterminer le type MIME
      const mimeType = audioBlob.type || "audio/mpeg";

      // Appel à l'API Gemini
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Audio,
                    },
                  },
                  {
                    text: "Transcris fidèlement cet enregistrement audio. Détecte automatiquement la langue parlée et transcris dans cette même langue. Si tu détectes plusieurs interlocuteurs, indique les changements de locuteur avec [Locuteur 1], [Locuteur 2], etc.",
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!geminiResponse.ok) {
        const error = await geminiResponse.json();
        throw new Error(error.error?.message || "Erreur API Gemini");
      }

      const result = await geminiResponse.json();
      const transcription = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (transcription) {
        await handleUpdateBlock(blockId, { content: transcription });
        toast.success("Transcription terminée !");
      } else {
        toast.error("Aucune transcription générée");
      }
    } catch (error: any) {
      console.error("Erreur transcription:", error);
      toast.error(`Erreur: ${error.message || "Impossible de transcrire l'audio"}`);
    } finally {
      setTranscribingBlockId(null);
    }
  };

  // Résumer le contenu transcrit
  const handleSummarizeContent = async (blockId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block?.content) {
      toast.error("Aucun contenu à résumer");
      return;
    }

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      toast.error("Clé API Gemini non configurée");
      return;
    }

    setSummarizingBlockId(blockId);

    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Résume ce texte de manière concise dans la même langue que le texte original. Garde les points clés et les informations importantes. Utilise des puces pour les points principaux.

Texte à résumer :
${block.content}`,
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!geminiResponse.ok) {
        const error = await geminiResponse.json();
        throw new Error(error.error?.message || "Erreur API Gemini");
      }

      const result = await geminiResponse.json();
      const summary = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (summary) {
        // Ajouter le résumé au début du contenu
        const newContent = `📋 RÉSUMÉ:\n${summary}\n\n---\n\n📝 TRANSCRIPTION COMPLÈTE:\n${block.content}`;
        await handleUpdateBlock(blockId, { content: newContent });
        toast.success("Résumé généré !");
      } else {
        toast.error("Aucun résumé généré");
      }
    } catch (error: any) {
      console.error("Erreur résumé:", error);
      toast.error(`Erreur: ${error.message || "Impossible de résumer"}`);
    } finally {
      setSummarizingBlockId(null);
    }
  };

  // Traduire le contenu
  const handleTranslateContent = async (blockId: string, targetLanguage: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block?.content) {
      toast.error("Aucun contenu à traduire");
      return;
    }

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      toast.error("Clé API Gemini non configurée");
      return;
    }

    setTranslatingBlockId(blockId);

    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Traduis ce texte en ${targetLanguage}. Garde la mise en forme (puces, paragraphes, etc.) et le sens fidèle au texte original.

Texte à traduire :
${block.content}`,
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!geminiResponse.ok) {
        const error = await geminiResponse.json();
        throw new Error(error.error?.message || "Erreur API Gemini");
      }

      const result = await geminiResponse.json();
      const translation = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (translation) {
        await handleUpdateBlock(blockId, { content: translation });
        toast.success(`Traduit en ${targetLanguage} !`);
      } else {
        toast.error("Aucune traduction générée");
      }
    } catch (error: any) {
      console.error("Erreur traduction:", error);
      toast.error(`Erreur: ${error.message || "Impossible de traduire"}`);
    } finally {
      setTranslatingBlockId(null);
    }
  };

  // Toggle chapitre
  const toggleChapter = (chapterId: string) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterId)) {
      newExpanded.delete(chapterId);
    } else {
      newExpanded.add(chapterId);
    }
    setExpandedChapters(newExpanded);
  };

  // Obtenir la gamme active
  const activeGamme = gammes.find((g) => g.id === activeGammeId);
  const activeGammeColor = TAB_COLORS.find((c) => c.value === activeGamme?.color) || TAB_COLORS[0];

  // Construire l'arborescence des chapitres
  const buildChapterTree = (chapters: Chapter[], parentId: string | null = null): Chapter[] => {
    return chapters
      .filter((c) => c.parent_id === parentId)
      .map((c) => ({
        ...c,
        children: buildChapterTree(chapters, c.id),
      }));
  };

  const chapterTree = buildChapterTree(chapters);

  // Obtenir l'icône d'un bloc icon
  const getIconComponent = (iconName: string) => {
    for (const category of ICON_LIBRARY) {
      const found = category.icons.find((i) => i.name === iconName);
      if (found) return found.icon;
    }
    return HelpCircle;
  };

  // Rendu récursif des chapitres avec drag & drop
  const renderChapters = (chapterList: Chapter[], level: number = 0) => {
    return chapterList.map((chapter) => (
      <div key={chapter.id} className="group">
        <div
          draggable
          onDragStart={(e) => {
            setDraggingChapterId(chapter.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            setDraggingChapterId(null);
            setDropTargetChapterId(null);
            setDropPosition(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggingChapterId && draggingChapterId !== chapter.id) {
              const rect = e.currentTarget.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const height = rect.height;

              if (y < height * 0.25) {
                setDropPosition("before");
              } else if (y > height * 0.75) {
                setDropPosition("after");
              } else {
                setDropPosition("inside");
              }
              setDropTargetChapterId(chapter.id);
            }
          }}
          onDragLeave={() => {
            if (dropTargetChapterId === chapter.id) {
              setDropTargetChapterId(null);
              setDropPosition(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (draggingChapterId && dropPosition) {
              handleChapterDrop(draggingChapterId, chapter.id, dropPosition);
            }
          }}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-all ${
            activeChapterId === chapter.id
              ? `${activeGammeColor.light} ${activeGammeColor.darkLight} border-l-4 ${activeGammeColor.border}`
              : "hover:bg-muted"
          } ${draggingChapterId === chapter.id ? "opacity-50" : ""} ${
            dropTargetChapterId === chapter.id && dropPosition === "before"
              ? "border-t-2 border-blue-500"
              : dropTargetChapterId === chapter.id && dropPosition === "after"
                ? "border-b-2 border-blue-500"
                : dropTargetChapterId === chapter.id && dropPosition === "inside"
                  ? "bg-blue-100 dark:bg-blue-900/30"
                  : ""
          }`}
          style={{ paddingLeft: `${8 + level * 16}px` }}
          onClick={() => setActiveChapterId(chapter.id)}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100" />

          {chapter.children && chapter.children.length > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleChapter(chapter.id);
              }}
              className="p-0.5 hover:bg-muted rounded"
            >
              {expandedChapters.has(chapter.id) ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm truncate flex-1">{chapter.title}</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => {
                  setNewChapter({ title: "", parent_id: chapter.id });
                  setIsChapterDialogOpen(true);
                }}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                Ajouter sous-chapitre
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => {
                  setActiveChapterId(chapter.id);
                  setIsDeleteChapterDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {chapter.children && chapter.children.length > 0 && expandedChapters.has(chapter.id) && (
          <div>{renderChapters(chapter.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  // Rendu d'un bloc
  const renderBlock = (block: ContentBlock) => {
    const blockType = BLOCK_TYPES.find((t) => t.value === block.type) || BLOCK_TYPES[0];
    const IconComponent = block.type === "icon" ? getIconComponent(block.content) : blockType.icon;

    // Rendu spécial pour les icônes : juste l'icône sans cadre
    if (block.type === "icon") {
      return (
        <div
          key={block.id}
          className={`content-block absolute group ${
            selectedBlockId === block.id ? "ring-2 ring-blue-500 ring-offset-2 rounded-full" : ""
          }`}
          style={{
            left: block.position_x,
            top: block.position_y,
            cursor: "grab",
          }}
          onMouseDown={(e) => handleBlockMouseDown(e, block.id)}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedBlockId(block.id);
          }}
        >
          <IconComponent className="h-10 w-10 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors" />
          {/* Bouton supprimer au survol */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleDeleteBlock(block.id);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      );
    }

    return (
      <div
        key={block.id}
        className={`content-block absolute rounded-lg border-2 shadow-md transition-shadow ${
          selectedBlockId === block.id ? "ring-2 ring-blue-500 shadow-lg" : ""
        } ${blockType.bgColor} ${blockType.borderColor}`}
        style={{
          left: block.position_x,
          top: block.position_y,
          width: block.width,
          minHeight: block.height,
          cursor: "grab",
        }}
        onMouseDown={(e) => handleBlockMouseDown(e, block.id)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedBlockId(block.id);
        }}
      >
        {/* Header du bloc */}
        <div
          className={`flex items-center gap-2 px-3 py-2 border-b ${blockType.borderColor} bg-white/50 dark:bg-black/20 rounded-t-lg`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <IconComponent className="h-4 w-4" />
          <span className="text-xs font-medium flex-1">{blockType.label}</span>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleDeleteBlock(block.id);
            }}
            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 z-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenu du bloc */}
        <div className="block-content p-3">
          {block.type === "image" ? (
            <div>
              {block.image_url ? (
                <img src={block.image_url} alt="Illustration" className="max-w-full rounded" />
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded cursor-pointer hover:bg-muted/50">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Cliquer pour uploader</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(block.id, file);
                    }}
                  />
                </label>
              )}
            </div>
          ) : block.type === "audio" ? (
            <div className="space-y-3">
              {/* Zone upload audio */}
              {!block.audio_url ? (
                <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-purple-300 rounded cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/20">
                  <FileAudio className="h-8 w-8 text-purple-400 mb-2" />
                  <span className="text-sm text-muted-foreground">Cliquer pour uploader un audio</span>
                  <span className="text-xs text-muted-foreground">(mp3, wav, m4a, ogg...)</span>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAudioUpload(block.id, file);
                    }}
                  />
                </label>
              ) : (
                <div className="space-y-2">
                  {/* Lecteur audio */}
                  <audio controls className="w-full h-10" src={block.audio_url} />

                  {/* Boutons d'action */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-purple-600 border-purple-300 hover:bg-purple-50"
                      onClick={() => handleTranscribeAudio(block.id)}
                      disabled={transcribingBlockId === block.id}
                    >
                      {transcribingBlockId === block.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Transcription...
                        </>
                      ) : (
                        <>
                          <Mic className="h-4 w-4 mr-1" />
                          Transcrire
                        </>
                      )}
                    </Button>

                    {block.content && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                        onClick={() => handleSummarizeContent(block.id)}
                        disabled={summarizingBlockId === block.id}
                      >
                        {summarizingBlockId === block.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Résumé...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-1" />
                            Résumer
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Ligne traduction */}
                  {block.content && (
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-green-600 border-green-300 hover:bg-green-50"
                            disabled={translatingBlockId === block.id}
                          >
                            {translatingBlockId === block.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Traduction...
                              </>
                            ) : (
                              <>
                                <Languages className="h-4 w-4 mr-1" />
                                Traduire en...
                              </>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleTranslateContent(block.id, "français")}>
                            🇫🇷 Français
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTranslateContent(block.id, "anglais")}>
                            🇬🇧 Anglais
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTranslateContent(block.id, "allemand")}>
                            🇩🇪 Allemand
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTranslateContent(block.id, "espagnol")}>
                            🇪🇸 Espagnol
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTranslateContent(block.id, "italien")}>
                            🇮🇹 Italien
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTranslateContent(block.id, "portugais")}>
                            🇵🇹 Portugais
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTranslateContent(block.id, "néerlandais")}>
                            🇳🇱 Néerlandais
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTranslateContent(block.id, "polonais")}>
                            🇵🇱 Polonais
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              )}

              {/* Zone de texte pour la transcription */}
              {(block.content || block.audio_url) && (
                <Textarea
                  value={block.content}
                  onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                  className="min-h-[120px] bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800 resize-none"
                  placeholder="La transcription apparaîtra ici... Vous pouvez aussi écrire vos notes."
                />
              )}
            </div>
          ) : block.type === "checklist" ? (
            <div className="space-y-1">
              {block.content.split("\n").map((line, index) => {
                const isChecked = line.startsWith("[x]");
                const text = line.replace(/^\[x?\]\s*/, "");

                return (
                  <div key={index} className="flex items-center gap-2 group/item">
                    <button
                      type="button"
                      onClick={() => handleChecklistToggle(block.id, index)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isChecked
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-gray-300 hover:border-green-400"
                      }`}
                    >
                      {isChecked && <Check className="h-3 w-3" />}
                    </button>
                    <input
                      type="text"
                      value={text}
                      onChange={(e) => handleChecklistTextChange(block.id, index, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddChecklistItemAfter(block.id, index);
                        } else if (e.key === "Backspace" && text === "") {
                          e.preventDefault();
                          handleDeleteChecklistItem(block.id, index);
                        }
                      }}
                      className={`flex-1 bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-sm ${
                        isChecked ? "line-through text-muted-foreground" : ""
                      }`}
                      placeholder="Étape..."
                      data-checklist-input={`${block.id}-${index}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteChecklistItem(block.id, index)}
                      className="opacity-0 group-hover/item:opacity-100 text-red-500 hover:text-red-700 p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => handleAddChecklistItem(block.id)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-2"
              >
                <Plus className="h-4 w-4" />
                Ajouter une étape
              </button>
            </div>
          ) : block.type === "list" ? (
            <div className="space-y-1">
              {block.content.split("\n").map((line, index) => {
                const text = line.replace(/^[•\-]\s*/, "");

                return (
                  <div key={index} className="flex items-center gap-2 group/item">
                    <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={text}
                      onChange={(e) => handleListTextChange(block.id, index, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddListItemAfter(block.id, index);
                        } else if (e.key === "Backspace" && text === "") {
                          e.preventDefault();
                          handleDeleteListItem(block.id, index);
                        }
                      }}
                      className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-sm"
                      placeholder="Élément..."
                      data-list-input={`${block.id}-${index}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteListItem(block.id, index)}
                      className="opacity-0 group-hover/item:opacity-100 text-red-500 hover:text-red-700 p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => handleAddListItem(block.id)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-2"
              >
                <Plus className="h-4 w-4" />
                Ajouter un élément
              </button>
            </div>
          ) : (
            <Textarea
              value={block.content}
              onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
              className="min-h-[80px] bg-transparent border-none resize-none focus-visible:ring-0 p-0"
              placeholder={
                block.type === "warning"
                  ? "⚠️ Point d'attention important..."
                  : block.type === "tip"
                    ? "💡 Astuce utile..."
                    : block.type === "tools"
                      ? "🔧 Outils nécessaires..."
                      : "Saisissez votre texte..."
              }
            />
          )}
        </div>

        {/* Poignée de redimensionnement */}
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-10"
          onMouseDown={(e) => handleResizeMouseDown(e, block.id)}
        >
          <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-gray-400 hover:border-gray-600" />
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-300px)] min-h-[600px] border rounded-lg overflow-hidden bg-background">
      {/* Onglets des gammes en haut */}
      <div className="flex items-center border-b bg-muted/30 px-2">
        <ScrollArea className="flex-1">
          <div className="flex items-center gap-1 py-2">
            {gammes.map((gamme) => {
              const color = TAB_COLORS.find((c) => c.value === gamme.color) || TAB_COLORS[0];
              const isActive = gamme.id === activeGammeId;

              return (
                <ContextMenu key={gamme.id}>
                  <ContextMenuTrigger>
                    <button
                      onClick={() => setActiveGammeId(gamme.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-t-lg border-t border-l border-r transition-all ${
                        isActive
                          ? `${color.light} ${color.darkLight} border-gray-300 dark:border-gray-600 -mb-px`
                          : "bg-muted/50 border-transparent hover:bg-muted"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${color.class}`} />
                      <span className={`text-sm font-medium ${isActive ? "" : "text-muted-foreground"}`}>
                        {gamme.title}
                      </span>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => {
                        setEditingGamme(gamme);
                        setIsEditGammeDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Modifier
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => {
                        navigator.clipboard.writeText(gamme.title);
                        toast.success("Nom copié");
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copier le nom
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      className="text-red-600"
                      onClick={() => {
                        setActiveGammeId(gamme.id);
                        setIsDeleteGammeDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}

            {/* Bouton ajouter gamme */}
            <Button variant="ghost" size="sm" className="h-8 px-3" onClick={() => setIsGammeDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nouvelle gamme
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
              onClick={() => setIsPdfImportDialogOpen(true)}
            >
              <FileUp className="h-4 w-4 mr-1" />
              Importer PDF
            </Button>
          </div>
        </ScrollArea>
      </div>

      {/* Zone principale */}
      {activeGammeId ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar chapitres à gauche */}
          <div className="w-64 border-r flex flex-col bg-muted/10">
            {/* Header sidebar */}
            <div className="p-3 border-b flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span className="font-medium text-sm">Chapitres</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setNewChapter({ title: "", parent_id: null });
                  setIsChapterDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Liste des chapitres */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                {chapters.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FolderPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucun chapitre</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => {
                        setNewChapter({ title: "", parent_id: null });
                        setIsChapterDialogOpen(true);
                      }}
                    >
                      Créer un chapitre
                    </Button>
                  </div>
                ) : (
                  renderChapters(chapterTree)
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Zone de contenu centrale */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Barre d'outils */}
            <div className="flex items-center gap-2 p-2 border-b bg-muted/10 flex-wrap">
              <span className="text-sm text-muted-foreground mr-2">Ajouter :</span>
              {BLOCK_TYPES.map((type) => {
                const IconComp = type.icon;
                return (
                  <Button
                    key={type.value}
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => handleCreateBlock(type.value)}
                    disabled={!activeChapterId}
                  >
                    <IconComp className="h-4 w-4 mr-1" />
                    {type.label}
                  </Button>
                );
              })}

              {/* Bouton Icônes avec popover */}
              <Popover open={isIconPickerOpen} onOpenChange={setIsIconPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8" disabled={!activeChapterId}>
                    <Sticker className="h-4 w-4 mr-1" />
                    Icônes
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-3 border-b">
                    <h4 className="font-medium">Banque d'icônes</h4>
                    <p className="text-xs text-muted-foreground">Cliquez pour insérer</p>
                  </div>
                  <ScrollArea className="h-64">
                    <div className="p-2">
                      {ICON_LIBRARY.map((category) => (
                        <div key={category.category} className="mb-3">
                          <h5 className="text-xs font-medium text-muted-foreground mb-2 px-1">{category.category}</h5>
                          <div className="grid grid-cols-6 gap-1">
                            {category.icons.map((iconItem) => {
                              const IconComp = iconItem.icon;
                              return (
                                <button
                                  key={iconItem.name}
                                  onClick={() => handleCreateBlock("icon", iconItem.name)}
                                  className="p-2 rounded hover:bg-muted flex items-center justify-center"
                                  title={iconItem.label}
                                >
                                  <IconComp className="h-5 w-5" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {/* Séparateur */}
              <div className="h-6 w-px bg-border mx-2" />

              {/* Boutons de layout */}
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleAutoLayout}
                disabled={!activeChapterId || blocks.length === 0}
                title="Organiser automatiquement les blocs"
              >
                <LayoutDashboard className="h-4 w-4 mr-1" />
                Auto-layout
              </Button>

              {edges.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-red-600 hover:bg-red-50"
                  onClick={handleClearAllEdges}
                  disabled={!activeChapterId}
                  title="Supprimer toutes les connexions"
                >
                  <Unlink className="h-4 w-4 mr-1" />
                  Effacer connexions
                </Button>
              )}

              {/* Séparateur */}
              <div className="h-6 w-px bg-border mx-2" />

              {/* Bouton IA - Dessin vers SVG/DXF */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 border-purple-200"
                onClick={() => setIsSchemaImportDialogOpen(true)}
                disabled={!activeChapterId}
                title="Transformer un dessin en SVG/DXF propre"
              >
                <Sparkles className="h-4 w-4 mr-1 text-purple-500" />
                <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent font-medium">
                  Dessin → SVG/DXF
                </span>
              </Button>

              {activeChapterId && (
                <span className="text-xs text-muted-foreground ml-auto">
                  💡 Double-clic pour éditer • Tirez depuis les points pour connecter
                </span>
              )}
            </div>

            {/* Canvas React Flow */}
            <div className="flex-1 relative overflow-hidden" ref={reactFlowContainerRef}>
              {!activeChapterId ? (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-muted/5">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Sélectionnez ou créez un chapitre</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Message si aucun bloc */}
                  {blocks.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none z-10">
                      <div className="text-center">
                        <StickyNote className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Aucun bloc dans ce chapitre</p>
                        <p className="text-sm">Utilisez la barre d'outils pour ajouter du contenu</p>
                      </div>
                    </div>
                  )}
                  <ReactFlow
                    nodes={nodes}
                    edges={flowEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeDragStop={handleNodeDragStop}
                    onConnect={handleConnect}
                    onInit={(instance) => {
                      reactFlowInstanceRef.current = instance;
                    }}
                    onEdgeClick={(_, edge) => {
                      if (confirm("Supprimer cette connexion ?")) {
                        handleDeleteEdge(edge.id);
                      }
                    }}
                    nodeTypes={nodeTypes}
                    fitView
                    snapToGrid
                    snapGrid={[20, 20]}
                    connectionMode={"loose" as any}
                    deleteKeyCode={null}
                    selectionKeyCode={null}
                    multiSelectionKeyCode={null}
                    defaultEdgeOptions={{
                      type: "smoothstep",
                      markerEnd: { type: MarkerType.ArrowClosed },
                      style: { strokeWidth: 2, stroke: "#64748b" },
                    }}
                    proOptions={{ hideAttribution: true }}
                    nodesDraggable={true}
                    nodesConnectable={true}
                    elementsSelectable={true}
                    selectNodesOnDrag={false}
                    panOnDrag={[1, 2]}
                    zoomOnScroll={true}
                    zoomOnPinch={true}
                    minZoom={0.2}
                    maxZoom={2}
                  >
                    <Background gap={20} size={1} />
                    <Controls />
                    <MiniMap
                      nodeColor={(node) => {
                        const block = node.data?.block as ContentBlock;
                        if (!block) return "#e2e8f0";
                        switch (block.type) {
                          case "checklist":
                            return "#86efac";
                          case "warning":
                            return "#fde047";
                          case "tip":
                            return "#93c5fd";
                          case "tools":
                            return "#fdba74";
                          case "audio":
                            return "#c4b5fd";
                          default:
                            return "#e2e8f0";
                        }
                      }}
                      maskColor="rgba(0,0,0,0.1)"
                    />
                  </ReactFlow>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Layers className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">Aucune gamme de montage</h3>
            <p className="text-sm mb-4">Créez votre première gamme pour documenter vos procédures</p>
            <Button onClick={() => setIsGammeDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Créer une gamme
            </Button>
          </div>
        </div>
      )}

      {/* Dialog édition bloc */}
      <Dialog open={isEditBlockDialogOpen} onOpenChange={setIsEditBlockDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingBlock &&
                (() => {
                  const blockType = BLOCK_TYPES.find((t) => t.value === editingBlock.type) || BLOCK_TYPES[0];
                  const IconComp = blockType.icon;
                  return (
                    <>
                      <IconComp className="h-5 w-5" />
                      Éditer le bloc {blockType.label}
                    </>
                  );
                })()}
            </DialogTitle>
          </DialogHeader>

          {editingBlock && (
            <div className="space-y-4">
              {/* Contenu selon le type */}
              {editingBlock.type === "image" ? (
                <div>
                  {editingBlock.image_url ? (
                    <div className="space-y-2">
                      <img src={editingBlock.image_url} alt="Illustration" className="max-w-full rounded border" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // TODO: Upload nouvelle image
                        }}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Changer l'image
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Aucune image</p>
                    </div>
                  )}
                </div>
              ) : editingBlock.type === "audio" ? (
                <div className="space-y-4">
                  {editingBlock.audio_url && (
                    <audio controls className="w-full">
                      <source src={editingBlock.audio_url} />
                    </audio>
                  )}
                  <div>
                    <Label>Transcription / Notes</Label>
                    <Textarea
                      value={editingBlock.content}
                      onChange={(e) => setEditingBlock({ ...editingBlock, content: e.target.value })}
                      className="min-h-[200px] mt-1"
                      placeholder="Transcription ou notes..."
                    />
                  </div>
                </div>
              ) : editingBlock.type === "checklist" ? (
                <div className="space-y-3">
                  <Label>Éléments de la checklist</Label>
                  <div className="space-y-2">
                    {editingBlock.content.split("\n").map((line, index) => {
                      const isChecked = line.startsWith("[x]");
                      const text = line.replace(/^\[x?\]\s*/, "");

                      return (
                        <div key={index} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const lines = editingBlock.content.split("\n");
                              if (lines[index].startsWith("[x]")) {
                                lines[index] = "[] " + text;
                              } else {
                                lines[index] = "[x] " + text;
                              }
                              setEditingBlock({ ...editingBlock, content: lines.join("\n") });
                            }}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              isChecked
                                ? "bg-green-500 border-green-500 text-white"
                                : "border-gray-300 hover:border-green-400"
                            }`}
                          >
                            {isChecked && <Check className="h-3 w-3" />}
                          </button>
                          <Input
                            value={text}
                            onChange={(e) => {
                              const lines = editingBlock.content.split("\n");
                              const prefix = lines[index].startsWith("[x]") ? "[x] " : "[] ";
                              lines[index] = prefix + e.target.value;
                              setEditingBlock({ ...editingBlock, content: lines.join("\n") });
                            }}
                            className={isChecked ? "line-through text-muted-foreground" : ""}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const lines = editingBlock.content.split("\n");
                              lines.splice(index, 1);
                              setEditingBlock({ ...editingBlock, content: lines.join("\n") });
                            }}
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingBlock({
                        ...editingBlock,
                        content: editingBlock.content + "\n[] Nouvelle étape",
                      });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter une étape
                  </Button>
                </div>
              ) : editingBlock.type === "list" ? (
                <div className="space-y-3">
                  <Label>Éléments de la liste</Label>
                  <div className="space-y-2">
                    {editingBlock.content.split("\n").map((line, index) => {
                      const text = line.replace(/^[•\-]\s*/, "");

                      return (
                        <div key={index} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
                          <Input
                            value={text}
                            onChange={(e) => {
                              const lines = editingBlock.content.split("\n");
                              lines[index] = "• " + e.target.value;
                              setEditingBlock({ ...editingBlock, content: lines.join("\n") });
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const lines = editingBlock.content.split("\n");
                              lines.splice(index, 1);
                              setEditingBlock({ ...editingBlock, content: lines.join("\n") });
                            }}
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingBlock({
                        ...editingBlock,
                        content: editingBlock.content + "\n• Nouvel élément",
                      });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter un élément
                  </Button>
                </div>
              ) : editingBlock.type === "icon" ? (
                <div className="space-y-3">
                  <Label>Choisir une icône</Label>
                  <ScrollArea className="h-48 border rounded-lg p-2">
                    <div className="grid grid-cols-8 gap-2">
                      {ICON_LIBRARY.flatMap((cat) => cat.icons).map((iconItem) => {
                        const IconComp = iconItem.icon;
                        return (
                          <button
                            key={iconItem.name}
                            onClick={() => setEditingBlock({ ...editingBlock, content: iconItem.name })}
                            className={`p-2 rounded hover:bg-muted flex items-center justify-center ${
                              editingBlock.content === iconItem.name ? "bg-blue-100 ring-2 ring-blue-500" : ""
                            }`}
                            title={iconItem.label}
                          >
                            <IconComp className="h-6 w-6" />
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div>
                  <Label>Contenu</Label>
                  <Textarea
                    value={editingBlock.content}
                    onChange={(e) => setEditingBlock({ ...editingBlock, content: e.target.value })}
                    className="min-h-[150px] mt-1"
                    placeholder={
                      editingBlock.type === "warning"
                        ? "⚠️ Point d'attention important..."
                        : editingBlock.type === "tip"
                          ? "💡 Astuce utile..."
                          : editingBlock.type === "tools"
                            ? "🔧 Liste des outils nécessaires..."
                            : "Saisissez votre texte..."
                    }
                  />
                </div>
              )}

              {/* Dimensions */}
              {editingBlock.type !== "icon" && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <Label>Largeur (px)</Label>
                    <Input
                      type="number"
                      value={editingBlock.width}
                      onChange={(e) => setEditingBlock({ ...editingBlock, width: parseInt(e.target.value) || 300 })}
                      min={150}
                      max={800}
                    />
                  </div>
                  <div>
                    <Label>Hauteur min (px)</Label>
                    <Input
                      type="number"
                      value={editingBlock.height}
                      onChange={(e) => setEditingBlock({ ...editingBlock, height: parseInt(e.target.value) || 150 })}
                      min={80}
                      max={600}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button variant="destructive" onClick={handleDeleteBlockFromDialog}>
              <Trash2 className="h-4 w-4 mr-1" />
              Supprimer
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditBlockDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveBlockEdit}>Enregistrer</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog import schéma depuis image */}
      <Dialog
        open={isSchemaImportDialogOpen}
        onOpenChange={(open) => {
          setIsSchemaImportDialogOpen(open);
          if (!open) {
            setSchemaImportImage(null);
            setGeneratedSvg(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Dessin → SVG / DXF propre
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Uploadez un croquis papier ou un dessin iPad et l'IA le transformera en fichier vectoriel propre.
            </p>

            {!schemaImportImage ? (
              <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-purple-300 rounded-lg cursor-pointer hover:bg-purple-50/50 transition-colors">
                <Upload className="h-12 w-12 text-purple-400 mb-3" />
                <span className="text-sm font-medium text-purple-600">Cliquez pour uploader un dessin</span>
                <span className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP acceptés</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setSchemaImportImage(reader.result as string);
                        setGeneratedSvg(null);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            ) : (
              <div className="space-y-4">
                {/* Aperçu côte à côte */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Image originale */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Pencil className="h-4 w-4" />
                      Dessin original
                    </h4>
                    <div className="relative rounded-lg overflow-hidden border bg-muted/20 h-48">
                      <img src={schemaImportImage} alt="Image originale" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => {
                          setSchemaImportImage(null);
                          setGeneratedSvg(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Résultat */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      Résultat IA
                    </h4>
                    <div className="relative rounded-lg overflow-hidden border bg-white h-48 flex items-center justify-center">
                      {generatedSvg ? (
                        <div
                          className="w-full h-full flex items-center justify-center p-2"
                          dangerouslySetInnerHTML={{ __html: generatedSvg }}
                        />
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Cliquez sur un bouton ci-dessous</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Options de transformation */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-lg p-4">
                  <h4 className="font-medium mb-3">Choisissez le format de sortie :</h4>

                  <div className="grid grid-cols-3 gap-3">
                    {/* SVG */}
                    <button
                      type="button"
                      onClick={() => handleAnalyzeSchema("svg")}
                      disabled={schemaImportLoading}
                      className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-purple-200 hover:border-purple-400 hover:shadow-md transition-all disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-purple-600" />
                      </div>
                      <span className="font-medium text-sm">SVG</span>
                      <span className="text-xs text-muted-foreground text-center">Web, Illustrator</span>
                    </button>

                    {/* DXF */}
                    <button
                      type="button"
                      onClick={() => handleAnalyzeSchema("dxf")}
                      disabled={schemaImportLoading}
                      className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-200 hover:border-blue-400 hover:shadow-md transition-all disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Box className="h-5 w-5 text-blue-600" />
                      </div>
                      <span className="font-medium text-sm">DXF</span>
                      <span className="text-xs text-muted-foreground text-center">Fusion 360, CAO</span>
                    </button>

                    {/* Blocs */}
                    <button
                      type="button"
                      onClick={() => handleAnalyzeSchema("blocks")}
                      disabled={schemaImportLoading || !activeChapterId}
                      className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-green-200 hover:border-green-400 hover:shadow-md transition-all disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <LayoutGrid className="h-5 w-5 text-green-600" />
                      </div>
                      <span className="font-medium text-sm">Blocs</span>
                      <span className="text-xs text-muted-foreground text-center">Organigramme</span>
                    </button>
                  </div>

                  {schemaImportLoading && (
                    <div className="flex items-center justify-center gap-2 mt-4 text-purple-600">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Transformation en cours...</span>
                    </div>
                  )}

                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-3">
                    💡 SVG sera inséré dans le chapitre • DXF sera téléchargé • Blocs créeront un organigramme
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSchemaImportDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog import PDF */}
      <Dialog
        open={isPdfImportDialogOpen}
        onOpenChange={(open) => {
          setIsPdfImportDialogOpen(open);
          if (!open) {
            setPdfImportFile(null);
            setPdfImportProgress("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-purple-500" />
              Importer une gamme depuis un PDF
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Uploadez un PDF de gamme de montage ou procédure technique. L'IA va analyser le document et créer
              automatiquement les chapitres et blocs.
            </p>

            {!pdfImportFile ? (
              <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-purple-300 rounded-lg cursor-pointer hover:bg-purple-50/50 transition-colors">
                <FileUp className="h-12 w-12 text-purple-400 mb-3" />
                <span className="text-sm font-medium text-purple-600">Cliquez pour sélectionner un PDF</span>
                <span className="text-xs text-muted-foreground mt-1">Format PDF uniquement</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPdfImportFile(file);
                    }
                  }}
                />
              </label>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded">
                    <FileText className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{pdfImportFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(pdfImportFile.size / 1024 / 1024).toFixed(2)} Mo</p>
                  </div>
                  {!pdfImportLoading && (
                    <button
                      type="button"
                      onClick={() => setPdfImportFile(null)}
                      className="p-1.5 hover:bg-red-100 rounded text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {pdfImportProgress && (
                  <div className="flex items-center gap-2 text-sm text-purple-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{pdfImportProgress}</span>
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-sm">
                  <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">💡 Ce qui sera créé :</p>
                  <ul className="text-blue-600 dark:text-blue-400 text-xs space-y-1">
                    <li>• Une nouvelle gamme avec le titre du document</li>
                    <li>• Un chapitre par section principale</li>
                    <li>• Des blocs texte, checklist, warning selon le contenu</li>
                    <li>• Tout est éditable après l'import</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPdfImportDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleImportPdf}
              disabled={!pdfImportFile || pdfImportLoading}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              {pdfImportLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyser et importer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog création gamme */}
      <Dialog open={isGammeDialogOpen} onOpenChange={setIsGammeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle gamme de montage</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Titre *</Label>
              <Input
                value={newGamme.title}
                onChange={(e) => setNewGamme({ ...newGamme, title: e.target.value })}
                placeholder="Ex: Installation chauffage Webasto"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={newGamme.description}
                onChange={(e) => setNewGamme({ ...newGamme, description: e.target.value })}
                placeholder="Description de la gamme..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Marque véhicule</Label>
                <Input
                  value={newGamme.vehicle_brand}
                  onChange={(e) => setNewGamme({ ...newGamme, vehicle_brand: e.target.value })}
                  placeholder="Ex: Fiat"
                />
              </div>
              <div>
                <Label>Modèle véhicule</Label>
                <Input
                  value={newGamme.vehicle_model}
                  onChange={(e) => setNewGamme({ ...newGamme, vehicle_model: e.target.value })}
                  placeholder="Ex: Ducato"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Catégorie</Label>
                <Select value={newGamme.category} onValueChange={(v) => setNewGamme({ ...newGamme, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROCEDURE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Couleur de l'onglet</Label>
                <Select value={newGamme.color} onValueChange={(v) => setNewGamme({ ...newGamme, color: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAB_COLORS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full ${color.class}`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGammeDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateGamme}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog modification gamme */}
      <Dialog open={isEditGammeDialogOpen} onOpenChange={setIsEditGammeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la gamme</DialogTitle>
          </DialogHeader>

          {editingGamme && (
            <div className="space-y-4">
              <div>
                <Label>Titre *</Label>
                <Input
                  value={editingGamme.title}
                  onChange={(e) => setEditingGamme({ ...editingGamme, title: e.target.value })}
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={editingGamme.description || ""}
                  onChange={(e) => setEditingGamme({ ...editingGamme, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Marque véhicule</Label>
                  <Input
                    value={editingGamme.vehicle_brand || ""}
                    onChange={(e) => setEditingGamme({ ...editingGamme, vehicle_brand: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Modèle véhicule</Label>
                  <Input
                    value={editingGamme.vehicle_model || ""}
                    onChange={(e) => setEditingGamme({ ...editingGamme, vehicle_model: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Catégorie</Label>
                  <Select
                    value={editingGamme.category}
                    onValueChange={(v) => setEditingGamme({ ...editingGamme, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCEDURE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Couleur de l'onglet</Label>
                  <Select
                    value={editingGamme.color}
                    onValueChange={(v) => setEditingGamme({ ...editingGamme, color: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAB_COLORS.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full ${color.class}`} />
                            {color.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditGammeDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateGamme}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog création chapitre */}
      <Dialog open={isChapterDialogOpen} onOpenChange={setIsChapterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newChapter.parent_id ? "Nouveau sous-chapitre" : "Nouveau chapitre"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Titre *</Label>
              <Input
                value={newChapter.title}
                onChange={(e) => setNewChapter({ ...newChapter, title: e.target.value })}
                placeholder="Ex: Préparation du véhicule"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChapterDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateChapter}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog suppression gamme */}
      <AlertDialog open={isDeleteGammeDialogOpen} onOpenChange={setIsDeleteGammeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette gamme ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La gamme "{activeGamme?.title}" et tous ses chapitres seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGamme} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog suppression chapitre */}
      <AlertDialog open={isDeleteChapterDialogOpen} onOpenChange={setIsDeleteChapterDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce chapitre ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le chapitre et tout son contenu seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChapter} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MechanicalProcedures;
