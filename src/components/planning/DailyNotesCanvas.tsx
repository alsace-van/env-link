// ============================================
// COMPOSANT: DailyNotesCanvas
// Outil de prise de notes journalières complet
// ReactFlow pour les blocs et connexions + Paper.js pour le dessin libre
// VERSION: 3.2a - Fix perte de focus inputs (refs stables + anti-blur)
// ============================================

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import paper from "paper";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ConnectionMode,
  Edge,
  Node,
  NodeProps,
  Handle,
  Position,
  MarkerType,
  Panel,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarDays,
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  MousePointer2,
  Type,
  Minus,
  Square,
  Circle,
  ArrowRight,
  Eraser,
  Undo,
  Redo,
  Download,
  Save,
  Trash2,
  Image as ImageIcon,
  CheckSquare,
  List,
  Table,
  Palette,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2,
  GripVertical,
  X,
  Move,
  Link2,
  Send,
  Calendar as CalendarIcon,
  FolderOpen,
  Unlink,
  Copy,
  MapPin,
  Wrench,
  Clock,
  Search,
  Play,
  Check,
  CircleDot,
  ExternalLink,
  StickyNote,
  Package,
  Truck,
  ShoppingCart,
  Store,
  LayoutGrid,
  Lock,
  Unlock,
  Maximize2,
  Layers,
  Scissors,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, addDays, subDays, isToday, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { useProjectData } from "@/contexts/ProjectDataContext";

// ============================================
// TYPES
// ============================================

interface DailyNote {
  id: string;
  project_id: string;
  user_id: string;
  note_date: string;
  canvas_data?: string;
  blocks_data?: string;
  connections_data?: string;
  created_at: string;
  updated_at: string;
}

// Interface pour une tâche de travaux liée
interface LinkedTask {
  id: string;
  title: string;
  description?: string;
  estimated_hours?: number;
  actual_hours?: number;
  completed: boolean;
  scheduled_date?: string;
  forfait_ttc?: number;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  project_id: string;
  project_name?: string;
}

// 🔥 Interface pour les dépenses/commandes liées
interface LinkedExpense {
  id: string;
  nom: string;
  marque?: string;
  prix: number;
  quantite: number; // Quantité totale disponible
  quantiteBloc?: number; // Quantité utilisée dans ce bloc (par défaut = quantite)
  categorie?: string;
  fournisseur?: string;
  statut_livraison: "commande" | "en_livraison" | "livre" | "a_commander";
  date_achat?: string;
  expected_delivery_date?: string;
  project_id: string;
  project_name?: string;
}

// Couleurs pour les zones de travail
const ZONE_COLORS = [
  { name: "Gris", value: "#f3f4f6", border: "#d1d5db" },
  { name: "Bleu", value: "#eff6ff", border: "#bfdbfe" },
  { name: "Vert", value: "#f0fdf4", border: "#bbf7d0" },
  { name: "Jaune", value: "#fefce8", border: "#fef08a" },
  { name: "Rose", value: "#fdf2f8", border: "#fbcfe8" },
  { name: "Violet", value: "#faf5ff", border: "#e9d5ff" },
  { name: "Orange", value: "#fff7ed", border: "#fed7aa" },
];

// 🔥 Couleurs pour les blocs (plus saturées)
const BLOCK_COLORS = [
  { name: "Blanc", value: "#ffffff" },
  { name: "Gris", value: "#f3f4f6" },
  { name: "Bleu clair", value: "#dbeafe" },
  { name: "Bleu", value: "#bfdbfe" },
  { name: "Vert clair", value: "#dcfce7" },
  { name: "Vert", value: "#bbf7d0" },
  { name: "Jaune clair", value: "#fef9c3" },
  { name: "Jaune", value: "#fef08a" },
  { name: "Orange clair", value: "#fed7aa" },
  { name: "Orange", value: "#fdba74" },
  { name: "Rose clair", value: "#fce7f3" },
  { name: "Rose", value: "#fbcfe8" },
  { name: "Violet clair", value: "#f3e8ff" },
  { name: "Violet", value: "#e9d5ff" },
  { name: "Rouge clair", value: "#fecaca" },
  { name: "Cyan", value: "#a5f3fc" },
];

interface NoteBlock {
  id: string;
  type: "text" | "checklist" | "list" | "table" | "image" | "task" | "order" | "zone" | "supplier";
  x: number;
  y: number;
  width: number;
  height: number;
  content: any;
  targetDate?: string; // Date cible pour export vers un autre jour (format yyyy-MM-dd)
  sourceDate?: string; // Date d'origine (pour les blocs copiés depuis une roadmap)
  sourceBlockId?: string; // ID du bloc original (pour synchronisation)
  rescheduledTo?: string; // Date vers laquelle ce bloc a été reporté (yyyy-MM-dd)
  linkedProjectId?: string; // ID du projet lié
  linkedProjectName?: string; // Nom du projet lié (pour affichage)
  // Champs spécifiques au type "task"
  linkedTasks?: LinkedTask[]; // Tâches de travaux liées (plusieurs possibles)
  linkedTask?: LinkedTask; // DEPRECATED: pour compatibilité ascendante
  taskStatus?: "pending" | "in_progress" | "completed"; // Statut local du bloc
  // 🔥 Champs spécifiques au type "order"
  linkedExpenses?: LinkedExpense[]; // Dépenses/commandes liées
  // 🔥 Champs spécifiques au type "supplier"
  linkedSuppliers?: string[]; // Liste des fournisseurs sélectionnés
  // 🔥 Champs spécifiques au type "zone"
  zoneColor?: string; // Couleur de fond de la zone
  zoneBorderColor?: string; // Couleur de bordure de la zone
  zoneLinkedProjectId?: string; // ID du projet lié à cette zone
  zoneLinkedProjectName?: string; // Nom du projet lié à cette zone
  isLocked?: boolean; // Zone verrouillée (ne peut pas être déplacée)
  isContentLocked?: boolean; // Contenu figé (blocs internes bougent avec la zone)
  style?: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: "left" | "center" | "right";
  };
}

interface BlockEdge {
  id: string;
  source_block_id: string;
  target_block_id: string;
  source_handle?: string | null;
  target_handle?: string | null;
  edge_type?: string;
  animated?: boolean;
  label?: string;
  color?: string; // 🔥 Couleur du trait
}

type DrawTool = "select" | "pencil" | "line" | "arrow" | "rectangle" | "circle" | "eraser" | "text";

// Couleurs disponibles
const COLORS = [
  "#000000",
  "#374151",
  "#6B7280",
  "#9CA3AF",
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#14B8A6",
  "#3B82F6",
  "#6366F1",
  "#A855F7",
  "#EC4899",
  "#F43F5E",
  "#FFFFFF",
];

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const STROKE_WIDTHS = [1, 2, 3, 4, 6, 8, 10, 12];

// Google Fonts
const FONTS = [
  { name: "Sans-serif", value: "system-ui, -apple-system, sans-serif", category: "Sans" },
  { name: "Roboto", value: "'Roboto', sans-serif", category: "Sans" },
  { name: "Open Sans", value: "'Open Sans', sans-serif", category: "Sans" },
  { name: "Lato", value: "'Lato', sans-serif", category: "Sans" },
  { name: "Montserrat", value: "'Montserrat', sans-serif", category: "Sans" },
  { name: "Poppins", value: "'Poppins', sans-serif", category: "Sans" },
  { name: "Inter", value: "'Inter', sans-serif", category: "Sans" },
  { name: "Nunito", value: "'Nunito', sans-serif", category: "Sans" },
  { name: "Raleway", value: "'Raleway', sans-serif", category: "Sans" },
  { name: "Ubuntu", value: "'Ubuntu', sans-serif", category: "Sans" },
  { name: "Oswald", value: "'Oswald', sans-serif", category: "Display" },
  { name: "Playfair Display", value: "'Playfair Display', serif", category: "Serif" },
  { name: "Merriweather", value: "'Merriweather', serif", category: "Serif" },
  { name: "Lora", value: "'Lora', serif", category: "Serif" },
  { name: "PT Serif", value: "'PT Serif', serif", category: "Serif" },
  { name: "Libre Baskerville", value: "'Libre Baskerville', serif", category: "Serif" },
  { name: "Source Code Pro", value: "'Source Code Pro', monospace", category: "Mono" },
  { name: "Fira Code", value: "'Fira Code', monospace", category: "Mono" },
  { name: "JetBrains Mono", value: "'JetBrains Mono', monospace", category: "Mono" },
  { name: "Dancing Script", value: "'Dancing Script', cursive", category: "Script" },
  { name: "Pacifico", value: "'Pacifico', cursive", category: "Script" },
  { name: "Caveat", value: "'Caveat', cursive", category: "Script" },
  { name: "Indie Flower", value: "'Indie Flower', cursive", category: "Script" },
  { name: "Shadows Into Light", value: "'Shadows Into Light', cursive", category: "Script" },
  { name: "Patrick Hand", value: "'Patrick Hand', cursive", category: "Script" },
  { name: "Permanent Marker", value: "'Permanent Marker', cursive", category: "Display" },
  { name: "Bebas Neue", value: "'Bebas Neue', sans-serif", category: "Display" },
  { name: "Archivo Black", value: "'Archivo Black', sans-serif", category: "Display" },
];

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&family=Caveat:wght@400;700&family=Dancing+Script:wght@400;700&family=Fira+Code:wght@400;700&family=Indie+Flower&family=Inter:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Lato:wght@400;700&family=Libre+Baskerville:wght@400;700&family=Lora:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;700&family=Nunito:wght@400;700&family=Open+Sans:wght@400;700&family=Oswald:wght@400;700&family=PT+Serif:wght@400;700&family=Pacifico&family=Patrick+Hand&family=Permanent+Marker&family=Playfair+Display:wght@400;700&family=Poppins:wght@400;700&family=Raleway:wght@400;700&family=Roboto:wght@400;700&family=Shadows+Into+Light&family=Source+Code+Pro:wght@400;700&family=Ubuntu:wght@400;700&display=swap";

// Interface pour les projets
interface ProjectItem {
  id: string;
  name: string;
}

// Interface pour les tâches disponibles (résultats de recherche)
interface AvailableTask {
  id: string;
  title: string;
  description?: string;
  estimated_hours?: number;
  actual_hours?: number;
  completed: boolean;
  scheduled_date?: string;
  forfait_ttc?: number;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  project_id: string;
  project_name: string;
}

// ============================================
// CUSTOM NODE COMPONENT (comme MechanicalProcedures)
// ============================================

interface CustomBlockData {
  block: NoteBlock;
  onUpdate: (updates: Partial<NoteBlock>) => void;
  onDelete: () => void;
  onImageUpload: (file: File) => void;
  onMoveToDate: (targetDate: string) => void;
  onMoveTaskToDate: (task: LinkedTask, targetDate: string) => void; // 🔥 Planifier une tâche individuelle
  onNavigateToDate: (date: string) => void;
  onSearchTasks: (query: string, linkedProjectId?: string) => Promise<AvailableTask[]>;
  onLinkTask: (task: AvailableTask) => void;
  onUpdateTaskStatus: (taskId: string, status: "pending" | "in_progress" | "completed", actualHours?: number) => void;
  onSendToSidebarTask: () => void;
  onSendToSidebarNote: () => void;
  // 🔥 Props pour les dépenses/commandes
  onSearchExpenses: (query: string, linkedProjectId?: string) => Promise<LinkedExpense[]>;
  onLinkExpense: (expense: LinkedExpense) => void;
  onUpdateExpense: (expenseId: string, updates: Partial<LinkedExpense>) => void;
  globalUsedQuantities: Map<string, number>; // 🔥 Quantités utilisées globalement sur TOUS les blocs
  suppliers: string[]; // 🔥 Liste des fournisseurs enregistrés
  projects: ProjectItem[];
  currentProjectId: string;
  [key: string]: unknown;
}

const CustomBlockNode = ({ data, selected }: NodeProps) => {
  const {
    block,
    onUpdate,
    onDelete,
    onImageUpload,
    onMoveToDate,
    onMoveTaskToDate,
    onNavigateToDate,
    onSearchTasks,
    onLinkTask,
    onUpdateTaskStatus,
    onSendToSidebarTask,
    onSendToSidebarNote,
    onSearchExpenses,
    onLinkExpense,
    onUpdateExpense,
    globalUsedQuantities,
    suppliers,
    projects,
    currentProjectId,
  } = data as CustomBlockData;

  const [isEditing, setIsEditing] = useState(false);
  // 🔥 v3.2a - Ref pour protéger contre les faux blur causés par re-render ReactFlow
  const isEditingRef = useRef(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showTaskSearch, setShowTaskSearch] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [taskSearchResults, setTaskSearchResults] = useState<AvailableTask[]>([]);
  const [isSearchingTasks, setIsSearchingTasks] = useState(false);
  const [taskDatePickerIndex, setTaskDatePickerIndex] = useState<number | null>(null); // 🔥 Index de la tâche avec date picker ouvert
  // 🔥 États pour la recherche de dépenses
  const [showExpenseSearch, setShowExpenseSearch] = useState(false);
  const [expenseSearchQuery, setExpenseSearchQuery] = useState("");
  const [expenseSearchResults, setExpenseSearchResults] = useState<LinkedExpense[]>([]);
  const [isSearchingExpenses, setIsSearchingExpenses] = useState(false);
  // 🔥 États pour les popovers des dépenses (date commande, date livraison, fournisseur)
  const [openPopover, setOpenPopover] = useState<{
    expenseId: string;
    type: "orderDate" | "deliveryDate" | "supplier";
  } | null>(null);
  // 🔥 État pour le filtre de fournisseurs
  const [supplierFilter, setSupplierFilter] = useState("");

  const stopPropagation = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
  };

  const renderContent = () => {
    switch (block.type) {
      case "text":
        return isEditing ? (
          <Textarea
            value={block.content || ""}
            onChange={(e) => onUpdate({ content: e.target.value })}
            onFocus={() => {
              // v3.2a - Annuler tout blur en attente quand on récupère le focus
              if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
                blurTimeoutRef.current = null;
              }
              isEditingRef.current = true;
            }}
            onBlur={() => {
              // v3.2a - Délai pour distinguer un vrai blur d'un re-render ReactFlow
              blurTimeoutRef.current = setTimeout(() => {
                isEditingRef.current = false;
                setIsEditing(false);
              }, 200);
            }}
            autoFocus
            className="w-full min-h-[60px] border-0 focus:ring-0 resize-none p-2"
            style={{
              fontFamily: block.style?.fontFamily,
              fontSize: block.style?.fontSize || 14,
              color: block.style?.color || "#000",
              fontWeight: block.style?.bold ? "bold" : "normal",
              fontStyle: block.style?.italic ? "italic" : "normal",
              textDecoration: block.style?.underline ? "underline" : "none",
              textAlign: block.style?.align || "left",
            }}
            onClick={stopPropagation}
            onPointerDown={stopPropagation}
          />
        ) : (
          <div
            className="w-full min-h-[60px] p-2 whitespace-pre-wrap cursor-text"
            style={{
              fontFamily: block.style?.fontFamily,
              fontSize: block.style?.fontSize || 14,
              color: block.style?.color || "#000",
              fontWeight: block.style?.bold ? "bold" : "normal",
              fontStyle: block.style?.italic ? "italic" : "normal",
              textDecoration: block.style?.underline ? "underline" : "none",
              textAlign: block.style?.align || "left",
            }}
            onDoubleClick={() => setIsEditing(true)}
          >
            {block.content || "Double-cliquez pour éditer..."}
          </div>
        );

      case "checklist":
        const checklistItems: Array<{ id: string; text: string; checked: boolean }> = block.content || [];
        return (
          <div className="p-2 space-y-1">
            {checklistItems.map((item, index) => (
              <div key={item.id} className="flex items-center gap-2">
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={(checked) => {
                    const newItems = checklistItems.map((i) => (i.id === item.id ? { ...i, checked: !!checked } : i));
                    onUpdate({ content: newItems });
                  }}
                  onClick={stopPropagation}
                />
                <Input
                  value={item.text}
                  onChange={(e) => {
                    const newItems = checklistItems.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i));
                    onUpdate({ content: newItems });
                  }}
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-0 p-0 flex-1"
                  style={{
                    fontFamily: block.style?.fontFamily,
                    textDecoration: item.checked ? "line-through" : "none",
                    opacity: item.checked ? 0.5 : 1,
                  }}
                  onClick={stopPropagation}
                  onPointerDown={stopPropagation}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newItems = checklistItems.filter((i) => i.id !== item.id);
                    onUpdate({ content: newItems });
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-gray-400 hover:text-gray-600"
              onClick={(e) => {
                e.stopPropagation();
                const newItems = [...checklistItems, { id: crypto.randomUUID(), text: "", checked: false }];
                onUpdate({ content: newItems });
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Ajouter
            </Button>
          </div>
        );

      case "list":
        const listItems: string[] = block.content || [];
        return (
          <div className="p-2 space-y-1">
            {listItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-gray-400">•</span>
                <Input
                  value={item}
                  onChange={(e) => {
                    const newItems = [...listItems];
                    newItems[index] = e.target.value;
                    onUpdate({ content: newItems });
                  }}
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-0 p-0 flex-1"
                  style={{ fontFamily: block.style?.fontFamily }}
                  onClick={stopPropagation}
                  onPointerDown={stopPropagation}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newItems = listItems.filter((_, i) => i !== index);
                    onUpdate({ content: newItems });
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-gray-400 hover:text-gray-600"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ content: [...listItems, ""] });
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Ajouter
            </Button>
          </div>
        );

      case "table":
        const tableData: string[][] = block.content || [
          ["", ""],
          ["", ""],
        ];
        return (
          <div className="p-2 overflow-auto">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {tableData.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, colIndex) => (
                      <td key={colIndex} className="border border-gray-200 p-0">
                        <Input
                          value={cell}
                          onChange={(e) => {
                            const newData = tableData.map((r, ri) =>
                              ri === rowIndex ? r.map((c, ci) => (ci === colIndex ? e.target.value : c)) : r,
                            );
                            onUpdate({ content: newData });
                          }}
                          className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 rounded-none"
                          onClick={stopPropagation}
                          onPointerDown={stopPropagation}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-1 mt-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  const newData = [...tableData, Array(tableData[0]?.length || 2).fill("")];
                  onUpdate({ content: newData });
                }}
              >
                + Ligne
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  const newData = tableData.map((row) => [...row, ""]);
                  onUpdate({ content: newData });
                }}
              >
                + Colonne
              </Button>
            </div>
          </div>
        );

      case "image":
        return block.content ? (
          <div className="p-2">
            <img src={block.content} alt="Image" className="max-w-full max-h-[300px] object-contain rounded" />
          </div>
        ) : (
          <div className="p-4 flex flex-col items-center justify-center text-gray-400">
            <ImageIcon className="h-8 w-8 mb-2" />
            <span className="text-xs">Cliquez pour ajouter une image</span>
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImageUpload(file);
              }}
              onClick={stopPropagation}
            />
          </div>
        );

      case "task":
        // Récupérer les tâches (nouveau format linkedTasks[] ou ancien format linkedTask)
        const tasks = block.linkedTasks || (block.linkedTask ? [block.linkedTask] : []);
        const hasTasks = tasks.length > 0;

        // Calculs totaux
        const totalHours = tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
        const totalForfait = tasks.reduce((sum, t) => sum + (t.forfait_ttc || 0), 0);
        const completedCount = tasks.filter((t) => t.completed).length;

        // Fonction pour supprimer une tâche du bloc
        const removeTaskFromBlock = (taskId: string) => {
          const newTasks = tasks.filter((t) => t.id !== taskId);
          onUpdate({ linkedTasks: newTasks, linkedTask: undefined });
        };

        return (
          <div className="p-3 space-y-2">
            {/* Liste des tâches liées */}
            {hasTasks && (
              <div className="space-y-2" onClick={stopPropagation} onPointerDown={stopPropagation}>
                {tasks.map((task, index) => {
                  const status = task.completed ? "completed" : "pending";
                  return (
                    <div
                      key={task.id}
                      className={`p-2 rounded-lg border relative ${task.completed ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}
                    >
                      {/* 🔥 Handle source pour cette tâche - positionné à droite au centre */}
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={`task-item-${index}`}
                        className="!bg-green-500 !w-2.5 !h-2.5 !border-2 !border-white !right-[-8px]"
                        style={{ top: "50%", transform: "translateY(-50%)" }}
                      />
                      {/* 🔥 Handle cible pour cette tâche - positionné à gauche au centre */}
                      <Handle
                        type="target"
                        position={Position.Left}
                        id={`task-target-${index}`}
                        className="!bg-blue-500 !w-2.5 !h-2.5 !border-2 !border-white !left-[-8px]"
                        style={{ top: "50%", transform: "translateY(-50%)" }}
                      />

                      <div className="flex items-start gap-2">
                        {/* Checkbox */}
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={(checked) => {
                            // Mettre à jour le statut dans le bloc
                            const newTasks = tasks.map((t) => (t.id === task.id ? { ...t, completed: !!checked } : t));
                            onUpdate({ linkedTasks: newTasks, linkedTask: undefined });
                            // Synchro avec Supabase
                            if (onUpdateTaskStatus) {
                              onUpdateTaskStatus(task.id, checked ? "completed" : "pending", task.estimated_hours);
                            }
                          }}
                          onClick={stopPropagation}
                          onPointerDown={stopPropagation}
                          className="mt-0.5 cursor-pointer"
                        />

                        {/* Contenu */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {task.category_color && (
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: task.category_color }}
                                title={task.category_name}
                              />
                            )}
                            <span
                              className={`text-sm font-medium truncate ${task.completed ? "line-through text-gray-500" : ""}`}
                            >
                              {task.title}
                            </span>
                          </div>

                          {/* Infos compactes */}
                          <div className="flex flex-wrap gap-1.5 mt-1 text-xs">
                            {task.estimated_hours && <span className="text-blue-600">{task.estimated_hours}h</span>}
                            {task.forfait_ttc && <span className="text-emerald-600">{task.forfait_ttc}€</span>}
                            {task.project_name && task.project_id !== currentProjectId && (
                              <span className="text-gray-400">{task.project_name}</span>
                            )}
                          </div>
                        </div>

                        {/* Bouton planifier pour une autre date */}
                        <Popover
                          open={taskDatePickerIndex === index}
                          onOpenChange={(open) => setTaskDatePickerIndex(open ? index : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-6 w-6 p-0 ${task.scheduled_date ? "text-blue-600" : "text-gray-400"} hover:text-blue-600 cursor-pointer`}
                              onClick={stopPropagation}
                              onPointerDown={stopPropagation}
                              title="Planifier pour une autre date"
                            >
                              <CalendarIcon className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-0"
                            align="end"
                            onClick={stopPropagation}
                            onPointerDown={stopPropagation}
                          >
                            <div className="p-2 border-b bg-gray-50">
                              <p className="text-xs text-gray-600 font-medium">📅 Planifier cette tâche pour :</p>
                            </div>
                            <Calendar
                              mode="single"
                              selected={task.scheduled_date ? parseISO(task.scheduled_date) : undefined}
                              onSelect={(date) => {
                                if (date && onMoveTaskToDate) {
                                  setTaskDatePickerIndex(null);
                                  setTimeout(() => {
                                    const targetDate = format(date, "yyyy-MM-dd");
                                    onMoveTaskToDate(task, targetDate);
                                  }, 100);
                                }
                              }}
                              locale={fr}
                            />
                          </PopoverContent>
                        </Popover>

                        {/* Bouton supprimer */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            removeTaskFromBlock(task.id);
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Résumé si plusieurs tâches */}
                {tasks.length > 1 && (
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t">
                    <span>
                      {completedCount}/{tasks.length} terminées
                    </span>
                    <div className="flex gap-2">
                      {totalHours > 0 && <span className="text-blue-600">{totalHours}h total</span>}
                      {totalForfait > 0 && <span className="text-emerald-600">{totalForfait}€ total</span>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bouton pour ajouter des tâches */}
            <Popover
              open={showTaskSearch}
              onOpenChange={async (open) => {
                setShowTaskSearch(open);
                // Recharger les travaux à chaque ouverture
                if (open && onSearchTasks) {
                  setIsSearchingTasks(true);
                  try {
                    // 🔥 Passer le linkedProjectId du bloc pour filtrer les tâches
                    const results = await onSearchTasks("", block.linkedProjectId);
                    // Filtrer les tâches déjà ajoutées dans le bloc
                    const existingIds = tasks.map((t) => t.id);
                    setTaskSearchResults(results.filter((r) => !existingIds.includes(r.id)));
                  } catch (error) {
                    console.error("Erreur chargement initial:", error);
                  }
                  setIsSearchingTasks(false);
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant={hasTasks ? "ghost" : "outline"}
                  size={hasTasks ? "sm" : "default"}
                  className={hasTasks ? "w-full h-7 text-xs text-gray-500" : "w-full justify-start text-gray-500"}
                  onClick={stopPropagation}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {hasTasks ? "Ajouter un travail" : "Rechercher des travaux..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80 p-0"
                align="start"
                onPointerDown={stopPropagation}
                onClick={stopPropagation}
                onWheelCapture={(e) => e.stopPropagation()}
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Rechercher dans les fiches de travaux..."
                    value={taskSearchQuery}
                    onValueChange={async (value) => {
                      setTaskSearchQuery(value);
                      if (onSearchTasks) {
                        setIsSearchingTasks(true);
                        try {
                          // 🔥 Passer le linkedProjectId du bloc pour filtrer les tâches
                          const results = await onSearchTasks(value, block.linkedProjectId);
                          // Filtrer les tâches déjà ajoutées
                          const existingIds = tasks.map((t) => t.id);
                          setTaskSearchResults(results.filter((r) => !existingIds.includes(r.id)));
                        } catch (error) {
                          console.error("Erreur recherche:", error);
                        }
                        setIsSearchingTasks(false);
                      }
                    }}
                  />
                  <CommandList className="max-h-[300px] overflow-y-auto" onWheelCapture={(e) => e.stopPropagation()}>
                    {isSearchingTasks && (
                      <div className="p-4 text-center text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      </div>
                    )}
                    {!isSearchingTasks && taskSearchResults.length === 0 && (
                      <div className="p-4 text-center text-sm text-gray-500">
                        <p>Aucun travaux trouvé</p>
                        <p className="text-xs mt-1">Ajoutez des travaux dans l'onglet "Travaux" de votre projet</p>
                      </div>
                    )}
                    {taskSearchResults.length > 0 && (
                      <CommandGroup heading={`Travaux disponibles (${taskSearchResults.length})`}>
                        {taskSearchResults.map((task) => (
                          <CommandItem
                            key={task.id}
                            value={task.title}
                            onSelect={() => {
                              if (onLinkTask) {
                                onLinkTask(task);
                                // Ne pas fermer pour permettre d'ajouter plusieurs
                                setTaskSearchQuery("");
                                // Retirer de la liste des résultats
                                setTaskSearchResults((prev) => prev.filter((t) => t.id !== task.id));
                              }
                            }}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-2 w-full">
                              {task.category_color && (
                                <div
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: task.category_color }}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{task.title}</div>
                                <div className="text-xs text-gray-500 flex flex-wrap gap-x-2 gap-y-0.5">
                                  <span className="font-medium">{task.project_name}</span>
                                  {task.estimated_hours && (
                                    <span className="text-blue-600">{task.estimated_hours}h</span>
                                  )}
                                  {task.forfait_ttc && <span className="text-emerald-600">{task.forfait_ttc}€</span>}
                                </div>
                              </div>
                              <Plus className="h-4 w-4 text-gray-400" />
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {!hasTasks && (
              <p className="text-xs text-gray-400 text-center">Ajoutez des travaux depuis vos fiches de travaux</p>
            )}
          </div>
        );

      case "order":
        // Récupérer les dépenses liées
        const expenses = block.linkedExpenses || [];
        const hasExpenses = expenses.length > 0;

        // Calculs totaux
        const totalAmount = expenses.reduce((sum, e) => sum + e.prix * (e.quantiteBloc ?? e.quantite), 0);
        const deliveredCount = expenses.filter((e) => e.statut_livraison === "livre").length;
        const orderedCount = expenses.filter(
          (e) => e.statut_livraison === "commande" || e.statut_livraison === "en_livraison",
        ).length;

        // Fonction pour supprimer une dépense du bloc
        const removeExpenseFromBlock = (expenseId: string) => {
          const newExpenses = expenses.filter((e) => e.id !== expenseId);
          onUpdate({ linkedExpenses: newExpenses });
        };

        // Couleur selon statut
        const getStatusColor = (status: string) => {
          switch (status) {
            case "livre":
              return "bg-green-100 text-green-700 border-green-200";
            case "en_livraison":
              return "bg-blue-100 text-blue-700 border-blue-200";
            case "commande":
              return "bg-orange-100 text-orange-700 border-orange-200";
            default:
              return "bg-gray-100 text-gray-700 border-gray-200";
          }
        };

        const getStatusLabel = (status: string) => {
          switch (status) {
            case "livre":
              return "Livré";
            case "en_livraison":
              return "En livraison";
            case "commande":
              return "Commandé";
            case "a_commander":
              return "À commander";
            default:
              return status;
          }
        };

        // Helper pour mettre à jour une dépense
        const updateExpenseField = (expenseId: string, field: keyof LinkedExpense, value: any) => {
          const newExpenses = expenses.map((e) => (e.id === expenseId ? { ...e, [field]: value } : e));
          onUpdate({ linkedExpenses: newExpenses });
          if (onUpdateExpense) {
            onUpdateExpense(expenseId, { [field]: value });
          }
        };

        return (
          <div className="p-3 space-y-2" style={{ maxWidth: block.width || 320 }}>
            {/* Liste des dépenses liées */}
            {hasExpenses && (
              <div className="space-y-2" onClick={stopPropagation} onPointerDown={stopPropagation}>
                {expenses.map((expense, index) => (
                  <div
                    key={expense.id}
                    className={`p-2 rounded-lg border relative ${getStatusColor(expense.statut_livraison)}`}
                  >
                    {/* 🔥 Handle source pour cet article - positionné à droite au centre */}
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`order-item-${index}`}
                      className="!bg-green-500 !w-2.5 !h-2.5 !border-2 !border-white !right-[-8px]"
                      style={{ top: "50%", transform: "translateY(-50%)" }}
                    />
                    {/* 🔥 Handle target pour cet article - positionné à gauche au centre */}
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={`order-target-${index}`}
                      className="!bg-blue-500 !w-2.5 !h-2.5 !border-2 !border-white !left-[-8px]"
                      style={{ top: "50%", transform: "translateY(-50%)" }}
                    />

                    <div className="flex items-start gap-2">
                      {/* Icône statut cliquable */}
                      <Select
                        value={expense.statut_livraison}
                        onValueChange={(value) => updateExpenseField(expense.id, "statut_livraison", value)}
                      >
                        <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent">
                          <div className="mt-0.5">
                            {expense.statut_livraison === "livre" ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : expense.statut_livraison === "en_livraison" ? (
                              <Truck className="h-4 w-4 text-blue-600" />
                            ) : expense.statut_livraison === "commande" ? (
                              <ShoppingCart className="h-4 w-4 text-orange-600" />
                            ) : (
                              <Package className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a_commander">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-gray-400" />À commander
                            </div>
                          </SelectItem>
                          <SelectItem value="commande">
                            <div className="flex items-center gap-2">
                              <ShoppingCart className="h-4 w-4 text-orange-600" />
                              Commandé
                            </div>
                          </SelectItem>
                          <SelectItem value="en_livraison">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-blue-600" />
                              En livraison
                            </div>
                          </SelectItem>
                          <SelectItem value="livre">
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-600" />
                              Livré
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Contenu */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm leading-tight break-words">{expense.nom}</div>
                        <div className="text-xs space-y-1 mt-1">
                          {expense.marque && <span className="text-gray-600">{expense.marque}</span>}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-medium">{expense.prix.toFixed(2)}€</span>
                            {/* Sélecteur de quantité éditable */}
                            {(() => {
                              // 🔥 Calculer la quantité max disponible pour CE bloc
                              // = quantité totale - quantité utilisée dans les AUTRES blocs
                              const currentQtyInThisBlock = expense.quantiteBloc ?? expense.quantite;
                              const globalUsed = globalUsedQuantities.get(expense.id) || 0;
                              const usedInOtherBlocks = globalUsed - currentQtyInThisBlock;
                              const maxAvailable = expense.quantite - usedInOtherBlocks;

                              return (
                                <div className="flex items-center gap-0.5 bg-gray-100 rounded px-1">
                                  <span className="text-gray-500">×</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max={maxAvailable}
                                    value={currentQtyInThisBlock}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const newQty = Math.max(1, Math.min(maxAvailable, parseInt(e.target.value) || 1));
                                      const newExpenses = expenses.map((exp) =>
                                        exp.id === expense.id ? { ...exp, quantiteBloc: newQty } : exp,
                                      );
                                      onUpdate({ linkedExpenses: newExpenses });
                                    }}
                                    onClick={stopPropagation}
                                    onPointerDown={stopPropagation}
                                    className="w-8 h-5 text-center text-sm font-medium bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  {expense.quantite > 1 && (
                                    <span className="text-gray-400 text-[10px]">/{maxAvailable}</span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Icônes d'actions */}
                        <div className="flex items-center gap-1 mt-2">
                          {/* 🏪 Fournisseur */}
                          <Popover
                            open={openPopover?.expenseId === expense.id && openPopover?.type === "supplier"}
                            onOpenChange={(open) =>
                              setOpenPopover(open ? { expenseId: expense.id, type: "supplier" } : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 px-2 text-xs ${expense.fournisseur ? "text-purple-600" : "text-gray-400"}`}
                                onClick={stopPropagation}
                              >
                                <Store className="h-3.5 w-3.5 mr-1" />
                                {expense.fournisseur || "Fournisseur"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2" align="start" onClick={stopPropagation}>
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-600">Fournisseur</p>
                                <Input
                                  placeholder="Nom du fournisseur..."
                                  value={expense.fournisseur || ""}
                                  onChange={(e) => {
                                    const newExpenses = expenses.map((exp) =>
                                      exp.id === expense.id ? { ...exp, fournisseur: e.target.value } : exp,
                                    );
                                    onUpdate({ linkedExpenses: newExpenses });
                                  }}
                                  onBlur={() => {
                                    if (onUpdateExpense) {
                                      onUpdateExpense(expense.id, { fournisseur: expense.fournisseur });
                                    }
                                  }}
                                  className="h-8 text-sm"
                                  autoFocus
                                />
                                {suppliers && suppliers.length > 0 && (
                                  <div className="border-t pt-2 mt-2">
                                    <p className="text-xs text-gray-500 mb-1">Fournisseurs récents</p>
                                    <div className="flex flex-wrap gap-1">
                                      {suppliers.slice(0, 6).map((supplier) => (
                                        <Button
                                          key={supplier}
                                          variant="outline"
                                          size="sm"
                                          className="h-6 text-xs"
                                          onClick={() => {
                                            updateExpenseField(expense.id, "fournisseur", supplier);
                                            setOpenPopover(null);
                                          }}
                                        >
                                          {supplier}
                                        </Button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>

                          {/* 📅 Date de commande */}
                          <Popover
                            open={openPopover?.expenseId === expense.id && openPopover?.type === "orderDate"}
                            onOpenChange={(open) =>
                              setOpenPopover(open ? { expenseId: expense.id, type: "orderDate" } : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 px-2 text-xs ${expense.date_achat ? "text-orange-600" : "text-gray-400"}`}
                                onClick={stopPropagation}
                              >
                                <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                                {expense.date_achat ? format(parseISO(expense.date_achat), "dd/MM") : "Cmd"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" onClick={stopPropagation}>
                              <div className="p-2 border-b">
                                <p className="text-xs font-medium text-gray-600">Date de commande</p>
                              </div>
                              <Calendar
                                mode="single"
                                selected={expense.date_achat ? parseISO(expense.date_achat) : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    updateExpenseField(expense.id, "date_achat", format(date, "yyyy-MM-dd"));
                                    setOpenPopover(null);
                                  }
                                }}
                                locale={fr}
                              />
                              {expense.date_achat && (
                                <div className="p-2 border-t">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-xs text-red-500"
                                    onClick={() => {
                                      updateExpenseField(expense.id, "date_achat", null);
                                      setOpenPopover(null);
                                    }}
                                  >
                                    Effacer la date
                                  </Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>

                          {/* 🚚 Date de livraison */}
                          <Popover
                            open={openPopover?.expenseId === expense.id && openPopover?.type === "deliveryDate"}
                            onOpenChange={(open) =>
                              setOpenPopover(open ? { expenseId: expense.id, type: "deliveryDate" } : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 px-2 text-xs ${expense.expected_delivery_date ? "text-blue-600" : "text-gray-400"}`}
                                onClick={stopPropagation}
                              >
                                <Truck className="h-3.5 w-3.5 mr-1" />
                                {expense.expected_delivery_date
                                  ? format(parseISO(expense.expected_delivery_date), "dd/MM")
                                  : "Liv"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" onClick={stopPropagation}>
                              <div className="p-2 border-b">
                                <p className="text-xs font-medium text-gray-600">Date de livraison prévue</p>
                              </div>
                              <Calendar
                                mode="single"
                                selected={
                                  expense.expected_delivery_date ? parseISO(expense.expected_delivery_date) : undefined
                                }
                                onSelect={(date) => {
                                  if (date) {
                                    updateExpenseField(
                                      expense.id,
                                      "expected_delivery_date",
                                      format(date, "yyyy-MM-dd"),
                                    );
                                    setOpenPopover(null);
                                  }
                                }}
                                locale={fr}
                              />
                              {expense.expected_delivery_date && (
                                <div className="p-2 border-t">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-xs text-red-500"
                                    onClick={() => {
                                      updateExpenseField(expense.id, "expected_delivery_date", null);
                                      setOpenPopover(null);
                                    }}
                                  >
                                    Effacer la date
                                  </Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      {/* Bouton supprimer */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-gray-400 hover:text-red-500 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeExpenseFromBlock(expense.id);
                        }}
                        onPointerDown={stopPropagation}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Résumé */}
                {expenses.length > 1 && (
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t">
                    <span>
                      {deliveredCount}/{expenses.length} livrés
                    </span>
                    <span className="text-emerald-600 font-medium">{totalAmount.toFixed(2)}€ total</span>
                  </div>
                )}
              </div>
            )}

            {/* Bouton pour ajouter des dépenses */}
            <Popover
              open={showExpenseSearch}
              onOpenChange={async (open) => {
                setShowExpenseSearch(open);
                if (open && onSearchExpenses) {
                  setIsSearchingExpenses(true);
                  try {
                    // 🔥 Passer le linkedProjectId du bloc pour filtrer les dépenses
                    const results = await onSearchExpenses("", block.linkedProjectId);

                    // 🔥 Utiliser les quantités GLOBALES (tous les blocs) pour filtrer
                    const availableResults = results
                      .map((r) => {
                        const globalUsed = globalUsedQuantities.get(r.id) || 0;
                        const remaining = r.quantite - globalUsed;
                        return { ...r, quantiteRestante: remaining };
                      })
                      .filter((r) => r.quantiteRestante > 0);
                    setExpenseSearchResults(availableResults);
                  } catch (error) {
                    console.error("Erreur chargement dépenses:", error);
                  }
                  setIsSearchingExpenses(false);
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant={hasExpenses ? "ghost" : "outline"}
                  size={hasExpenses ? "sm" : "default"}
                  className={hasExpenses ? "w-full h-7 text-xs text-gray-500" : "w-full justify-start text-gray-500"}
                  onClick={stopPropagation}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {hasExpenses ? "Ajouter un article" : "Rechercher des articles..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80 p-0"
                align="start"
                onPointerDown={stopPropagation}
                onClick={stopPropagation}
                onWheelCapture={(e) => e.stopPropagation()}
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Rechercher dans les dépenses du projet..."
                    value={expenseSearchQuery}
                    onValueChange={async (value) => {
                      setExpenseSearchQuery(value);
                      if (onSearchExpenses) {
                        setIsSearchingExpenses(true);
                        try {
                          // 🔥 Passer le linkedProjectId du bloc pour filtrer les dépenses
                          const results = await onSearchExpenses(value, block.linkedProjectId);
                          // 🔥 Utiliser les quantités GLOBALES (tous les blocs) pour filtrer
                          const availableResults = results
                            .map((r) => {
                              const globalUsed = globalUsedQuantities.get(r.id) || 0;
                              const remaining = r.quantite - globalUsed;
                              return { ...r, quantiteRestante: remaining };
                            })
                            .filter((r) => r.quantiteRestante > 0);
                          setExpenseSearchResults(availableResults);
                        } catch (error) {
                          console.error("Erreur recherche:", error);
                        }
                        setIsSearchingExpenses(false);
                      }
                    }}
                  />
                  <CommandList className="max-h-[300px] overflow-y-auto" onWheelCapture={(e) => e.stopPropagation()}>
                    {isSearchingExpenses && (
                      <div className="p-4 text-center text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      </div>
                    )}
                    {!isSearchingExpenses && expenseSearchResults.length === 0 && (
                      <div className="p-4 text-center text-sm text-gray-500">
                        <p>Aucun article trouvé</p>
                        <p className="text-xs mt-1">Ajoutez des dépenses dans le scénario de votre projet</p>
                      </div>
                    )}
                    {expenseSearchResults.length > 0 && (
                      <CommandGroup heading={`Articles disponibles (${expenseSearchResults.length})`}>
                        {expenseSearchResults.map((expense: any) => (
                          <CommandItem
                            key={expense.id}
                            value={expense.nom}
                            onSelect={() => {
                              // 🔥 Vérifier si l'article est déjà dans le bloc
                              const existingExpense = expenses.find((e) => e.id === expense.id);

                              if (existingExpense) {
                                // L'article existe déjà → augmenter quantiteBloc de 1
                                const currentQty =
                                  existingExpense.quantiteBloc !== undefined
                                    ? existingExpense.quantiteBloc
                                    : existingExpense.quantite;
                                const newExpenses = expenses.map((exp) =>
                                  exp.id === expense.id ? { ...exp, quantiteBloc: currentQty + 1 } : exp,
                                );
                                onUpdate({ linkedExpenses: newExpenses });
                              } else {
                                // Nouvel article → l'ajouter avec quantiteBloc = 1
                                if (onLinkExpense) {
                                  onLinkExpense({ ...expense, quantiteBloc: 1 });
                                }
                              }

                              setExpenseSearchQuery("");
                              // 🔥 La quantité restante GLOBALE diminue de 1
                              // expense.quantiteRestante est déjà calculé globalement
                              const newRemaining = (expense.quantiteRestante || 0) - 1;
                              if (newRemaining <= 0) {
                                setExpenseSearchResults((prev) => prev.filter((e) => e.id !== expense.id));
                              } else {
                                setExpenseSearchResults((prev) =>
                                  prev.map((e) => (e.id === expense.id ? { ...e, quantiteRestante: newRemaining } : e)),
                                );
                              }
                            }}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-2 w-full">
                              <Package className="h-4 w-4 text-blue-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{expense.nom}</div>
                                <div className="text-xs text-gray-500 flex flex-wrap gap-x-2">
                                  {expense.marque && <span>{expense.marque}</span>}
                                  <span className="text-emerald-600">{expense.prix.toFixed(2)}€</span>
                                  {/* 🔥 Afficher quantité restante / totale */}
                                  <span
                                    className={
                                      expense.quantiteRestante < expense.quantite ? "text-orange-500 font-medium" : ""
                                    }
                                  >
                                    {expense.quantiteRestante !== undefined &&
                                    expense.quantiteRestante < expense.quantite
                                      ? `${expense.quantiteRestante}/${expense.quantite} dispo`
                                      : `x${expense.quantite}`}
                                  </span>
                                </div>
                              </div>
                              <Plus className="h-4 w-4 text-gray-400" />
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {!hasExpenses && (
              <p className="text-xs text-gray-400 text-center">Ajoutez des articles depuis le scénario du projet</p>
            )}
          </div>
        );

      case "supplier":
        // Bloc fournisseur - affiche la liste des fournisseurs
        const selectedSuppliers = block.linkedSuppliers || [];
        const hasSuppliers = selectedSuppliers.length > 0;
        const availableSuppliers = suppliers.filter((s) => !selectedSuppliers.includes(s));

        return (
          <div className="p-3 space-y-2">
            {/* Liste des fournisseurs sélectionnés */}
            {hasSuppliers && (
              <div className="space-y-1" onClick={stopPropagation} onPointerDown={stopPropagation}>
                {selectedSuppliers.map((supplier, index) => (
                  <div
                    key={`${supplier}-${index}`}
                    className="p-2 rounded-lg border bg-white border-gray-200 relative flex items-center justify-between"
                  >
                    {/* 🔥 Handle source pour ce fournisseur */}
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`supplier-item-${index}`}
                      className="!bg-green-500 !w-2.5 !h-2.5 !border-2 !border-white !right-[-8px]"
                      style={{ top: "50%", transform: "translateY(-50%)" }}
                    />
                    {/* 🔥 Handle cible pour ce fournisseur */}
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={`supplier-target-${index}`}
                      className="!bg-blue-500 !w-2.5 !h-2.5 !border-2 !border-white !left-[-8px]"
                      style={{ top: "50%", transform: "translateY(-50%)" }}
                    />

                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">{supplier}</span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newSuppliers = selectedSuppliers.filter((_, i) => i !== index);
                        onUpdate({ linkedSuppliers: newSuppliers });
                      }}
                      onPointerDown={stopPropagation}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Sélecteur pour ajouter des fournisseurs avec recherche */}
            {availableSuppliers.length > 0 && (
              <Popover
                onOpenChange={(open) => {
                  if (!open) setSupplierFilter("");
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant={hasSuppliers ? "ghost" : "outline"}
                    size={hasSuppliers ? "sm" : "default"}
                    className={hasSuppliers ? "w-full h-7 text-xs text-gray-500" : "w-full justify-start text-gray-500"}
                    onClick={stopPropagation}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {hasSuppliers ? "Ajouter un fournisseur" : "Sélectionner des fournisseurs..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-72 p-0"
                  align="start"
                  onClick={stopPropagation}
                  onPointerDown={stopPropagation}
                >
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        placeholder="Rechercher un fournisseur..."
                        value={supplierFilter}
                        onChange={(e) => setSupplierFilter(e.target.value)}
                        className="h-8 pl-8 text-sm"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-[250px] overflow-auto p-1">
                    {(() => {
                      const filter = supplierFilter.toLowerCase().trim();
                      if (!filter) {
                        // Pas de filtre → afficher tous triés alphabétiquement
                        return availableSuppliers.map((supplier) => (
                          <button
                            key={supplier}
                            className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 flex items-center gap-2"
                            onClick={() => {
                              const newSuppliers = [...selectedSuppliers, supplier];
                              onUpdate({ linkedSuppliers: newSuppliers });
                              setSupplierFilter("");
                            }}
                          >
                            <Store className="h-4 w-4 text-purple-500" />
                            {supplier}
                          </button>
                        ));
                      }

                      // 🔥 Filtrer et trier par pertinence
                      const startsWithFilter: string[] = [];
                      const containsFilter: string[] = [];

                      availableSuppliers.forEach((s) => {
                        const lower = s.toLowerCase();
                        if (lower.startsWith(filter)) {
                          startsWithFilter.push(s);
                        } else if (lower.includes(filter)) {
                          containsFilter.push(s);
                        }
                      });

                      const sortedResults = [...startsWithFilter, ...containsFilter];

                      if (sortedResults.length === 0) {
                        return <p className="text-xs text-gray-400 text-center py-2">Aucun fournisseur trouvé</p>;
                      }

                      return sortedResults.map((supplier) => (
                        <button
                          key={supplier}
                          className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 flex items-center gap-2"
                          onClick={() => {
                            const newSuppliers = [...selectedSuppliers, supplier];
                            onUpdate({ linkedSuppliers: newSuppliers });
                            setSupplierFilter("");
                          }}
                        >
                          <Store className="h-4 w-4 text-purple-500" />
                          {supplier}
                        </button>
                      ));
                    })()}
                  </div>
                  <div className="p-2 border-t text-xs text-gray-400 text-center">
                    {availableSuppliers.length} fournisseur{availableSuppliers.length > 1 ? "s" : ""} disponible
                    {availableSuppliers.length > 1 ? "s" : ""}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Message si aucun fournisseur disponible */}
            {!hasSuppliers && availableSuppliers.length === 0 && (
              <p className="text-xs text-gray-400 text-center">Aucun fournisseur enregistré</p>
            )}

            {/* Résumé */}
            {hasSuppliers && (
              <div className="text-xs text-gray-500 pt-1 border-t text-center">
                {selectedSuppliers.length} fournisseur{selectedSuppliers.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
        );

      case "zone":
        // Zone de travail - grande zone colorée avec titre
        // Le corps est pointer-events-none pour laisser passer les clics aux blocs au-dessus
        return (
          <div
            className="w-full h-full p-0"
            style={{
              backgroundColor: "transparent",
            }}
          >
            {/* Titre de la zone - interactif pour édition */}
            <div
              className={`px-3 py-2 border-b flex items-center justify-between ${block.isLocked ? "cursor-default" : "cursor-move"}`}
              style={{
                backgroundColor: block.zoneBorderColor || "#d1d5db",
                borderColor: block.zoneBorderColor || "#d1d5db",
              }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Indicateurs d'état */}
                {block.isLocked && (
                  <span title="Zone verrouillée">
                    <Lock className="h-3 w-3 text-amber-600 flex-shrink-0" />
                  </span>
                )}
                {block.isContentLocked && (
                  <span title="Contenu figé">
                    <Move className="h-3 w-3 text-purple-600 flex-shrink-0" />
                  </span>
                )}

                {isEditing ? (
                  <Input
                    value={block.content?.title || ""}
                    onChange={(e) => onUpdate({ content: { ...block.content, title: e.target.value } })}
                    onFocus={() => {
                      // v3.2a - Annuler blur en attente
                      if (blurTimeoutRef.current) {
                        clearTimeout(blurTimeoutRef.current);
                        blurTimeoutRef.current = null;
                      }
                    }}
                    onBlur={() => {
                      // v3.2a - Délai anti-rerender
                      blurTimeoutRef.current = setTimeout(() => setIsEditing(false), 200);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setIsEditing(false);
                    }}
                    autoFocus
                    className="h-6 text-sm font-semibold border-0 bg-white/50 focus-visible:ring-0 nodrag"
                    onClick={stopPropagation}
                    onPointerDown={stopPropagation}
                  />
                ) : (
                  <span
                    className="text-sm font-semibold text-gray-700 cursor-text nodrag truncate"
                    onDoubleClick={() => setIsEditing(true)}
                  >
                    {block.content?.title || "Zone de travail"}
                  </span>
                )}

                {/* Badge projet lié */}
                {block.zoneLinkedProjectName && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex-shrink-0">
                    {block.zoneLinkedProjectName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Bouton verrouiller zone (position) */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 nodrag"
                  onClick={(e) => {
                    stopPropagation(e);
                    onUpdate({ isLocked: !block.isLocked });
                  }}
                  title={block.isLocked ? "Déverrouiller la zone" : "Verrouiller la zone en place"}
                >
                  {block.isLocked ? (
                    <Lock className="h-3 w-3 text-amber-600" />
                  ) : (
                    <Unlock className="h-3 w-3 text-gray-500" />
                  )}
                </Button>

                {/* Bouton figer contenu (déplacer zone + blocs ensemble) */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-6 w-6 p-0 nodrag ${block.isContentLocked ? "text-purple-600" : "text-gray-500"}`}
                  onClick={(e) => {
                    stopPropagation(e);
                    onUpdate({ isContentLocked: !block.isContentLocked });
                    if (!block.isContentLocked) {
                      toast.success("Contenu figé - la zone et ses blocs bougent ensemble");
                    }
                  }}
                  title={block.isContentLocked ? "Libérer le contenu" : "Figer le contenu (déplacer tout ensemble)"}
                >
                  <Move className="h-3 w-3" />
                </Button>

                {/* Popover redimensionnement manuel */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 nodrag"
                      onClick={stopPropagation}
                      title="Redimensionner"
                    >
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" onClick={stopPropagation}>
                    <ZoneDimensionsPopover
                      currentWidth={block.width || 400}
                      currentHeight={block.height || 300}
                      onApply={(width, height) => onUpdate({ width, height })}
                    />
                  </PopoverContent>
                </Popover>

                {/* Sélecteur de projet */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 w-6 p-0 nodrag ${block.zoneLinkedProjectId ? "text-blue-600" : ""}`}
                      onClick={stopPropagation}
                      title="Lier à un projet"
                    >
                      <FolderOpen className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" onClick={stopPropagation}>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600">Lier à un projet</p>
                      <p className="text-xs text-gray-400">Les blocs de ce projet seront contenus dans cette zone</p>

                      {/* Option aucun projet */}
                      <button
                        className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${
                          !block.zoneLinkedProjectId ? "bg-gray-100 font-medium" : ""
                        }`}
                        onClick={() =>
                          onUpdate({
                            zoneLinkedProjectId: undefined,
                            zoneLinkedProjectName: undefined,
                          })
                        }
                      >
                        <span className="text-gray-500">Aucun projet</span>
                      </button>

                      {/* Liste des projets */}
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {projects.map((project) => (
                          <button
                            key={project.id}
                            className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-blue-50 ${
                              block.zoneLinkedProjectId === project.id ? "bg-blue-100 text-blue-700 font-medium" : ""
                            }`}
                            onClick={() =>
                              onUpdate({
                                zoneLinkedProjectId: project.id,
                                zoneLinkedProjectName: project.name,
                              })
                            }
                          >
                            {project.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Sélecteur de couleur */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 nodrag" onClick={stopPropagation}>
                      <Palette className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" onClick={stopPropagation}>
                    <div className="grid grid-cols-4 gap-1">
                      {ZONE_COLORS.map((color) => (
                        <button
                          key={color.value}
                          className={`w-6 h-6 rounded border-2 ${
                            block.zoneColor === color.value ? "border-blue-500" : "border-gray-200"
                          }`}
                          style={{ backgroundColor: color.value }}
                          onClick={() =>
                            onUpdate({
                              zoneColor: color.value,
                              zoneBorderColor: color.border,
                            })
                          }
                          title={color.name}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Corps de la zone - pointer-events-none pour laisser passer les clics */}
            <div
              className="p-2 min-h-[100px] pointer-events-none"
              style={{
                backgroundColor: block.zoneColor || "#f3f4f6",
              }}
            >
              <p className="text-xs text-gray-400 italic text-center select-none">
                {block.zoneLinkedProjectId
                  ? `Zone réservée pour ${block.zoneLinkedProjectName}`
                  : block.content?.description || "Glissez des blocs ici pour les organiser"}
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getBlockIcon = () => {
    switch (block.type) {
      case "text":
        return <Type className="h-3 w-3" />;
      case "checklist":
        return <CheckSquare className="h-3 w-3" />;
      case "list":
        return <List className="h-3 w-3" />;
      case "table":
        return <Table className="h-3 w-3" />;
      case "image":
        return <ImageIcon className="h-3 w-3" />;
      case "task":
        return <Wrench className="h-3 w-3" />;
      case "order":
        return <Package className="h-3 w-3" />;
      case "zone":
        return <LayoutGrid className="h-3 w-3" />;
      case "supplier":
        return <Store className="h-3 w-3" />;
    }
  };

  // Déterminer la couleur de bordure selon le statut
  const getBorderClass = () => {
    if (selected) return "border-blue-500 shadow-lg";
    if (block.sourceDate) return "border-purple-400 border-2"; // Copie
    if (block.rescheduledTo) return "border-orange-400 border-2"; // Original replanifié
    return "border-gray-200 hover:border-gray-300";
  };

  // Pour les zones, style spécial
  if (block.type === "zone") {
    // Déterminer les classes de ring
    let ringClass = "";
    if (selected) ringClass = "ring-2 ring-blue-500";
    else if (block.isContentLocked) ringClass = "ring-2 ring-purple-400";
    else if (block.isLocked) ringClass = "ring-1 ring-amber-400";

    return (
      <div
        className={`rounded-lg group relative ${ringClass}`}
        style={{
          backgroundColor: block.zoneColor || "#f3f4f6",
          width: block.width || 400,
          height: block.height || 300,
          minWidth: 200,
          minHeight: 150,
          border: block.isLocked
            ? `3px solid ${block.zoneBorderColor || "#d1d5db"}`
            : block.isContentLocked
              ? `3px solid ${block.zoneBorderColor || "#d1d5db"}`
              : `2px dashed ${block.zoneBorderColor || "#d1d5db"}`,
        }}
      >
        {/* Handles de connexion */}
        <Handle type="target" position={Position.Top} id="zone-top" className="!bg-blue-500 !w-3 !h-3" />
        <Handle type="target" position={Position.Left} id="zone-left" className="!bg-blue-500 !w-3 !h-3" />
        <Handle type="source" position={Position.Bottom} id="zone-bottom" className="!bg-green-500 !w-3 !h-3" />
        <Handle type="source" position={Position.Right} id="zone-right" className="!bg-green-500 !w-3 !h-3" />

        {renderContent()}

        {/* Handle de redimensionnement - caché si verrouillé */}
        {!block.isLocked && (
          <div
            className="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize opacity-30 group-hover:opacity-100 transition-opacity nodrag nopan"
            style={{
              background: "linear-gradient(135deg, transparent 40%, #6b7280 40%, #6b7280 60%, #4b5563 60%)",
              borderTopLeftRadius: "4px",
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const startX = e.clientX;
              const startY = e.clientY;
              const startWidth = block.width || 400;
              const startHeight = block.height || 300;

              const onMouseMove = (moveEvent: MouseEvent) => {
                moveEvent.preventDefault();
                const newWidth = Math.max(200, startWidth + (moveEvent.clientX - startX));
                const newHeight = Math.max(150, startHeight + (moveEvent.clientY - startY));
                onUpdate({ width: newWidth, height: newHeight });
              };

              const onMouseUp = () => {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
              };

              document.addEventListener("mousemove", onMouseMove);
              document.addEventListener("mouseup", onMouseUp);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
          />
        )}

        {/* Bouton supprimer - positionné à l'extérieur en haut à droite */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 bg-white hover:bg-red-100 rounded-full shadow-md border border-gray-200"
          onClick={(e) => {
            e.stopPropagation();
            console.log("🔴 Clic sur bouton supprimer zone, onDelete:", typeof onDelete);
            if (onDelete) {
              onDelete();
            } else {
              console.error("❌ onDelete n'est pas défini!");
            }
          }}
        >
          <X className="h-3 w-3 text-red-500" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-lg shadow-md group relative ${getBorderClass()}`}
      style={{
        backgroundColor: block.style?.backgroundColor || "#fff",
        minWidth: block.width || 200,
        minHeight: 80,
        height: "auto",
        borderWidth: block.sourceDate || block.rescheduledTo ? 3 : 2,
      }}
    >
      {/* Handles de connexion */}
      {block.type === "list" || block.type === "checklist" ? (
        <>
          {/* Handle cible en haut */}
          <Handle type="target" position={Position.Top} id="top-main" className="!bg-blue-500 !w-3 !h-3" />
          <Handle type="target" position={Position.Left} id="left-main" className="!bg-blue-500 !w-3 !h-3" />

          {/* 🔥 Handles dynamiques pour chaque ligne - source à droite */}
          {(Array.isArray(block.content) ? block.content : []).map((_, index) => (
            <Handle
              key={`list-source-${index}`}
              type="source"
              position={Position.Right}
              id={`list-item-${index}`}
              className="!bg-green-500 !w-2.5 !h-2.5 !border-2 !border-white"
              style={{
                top: `${44 + index * 32 + 16}px`, // 44px header + 32px par ligne + centrage
              }}
            />
          ))}
          {/* 🔥 Handles dynamiques pour chaque ligne - target à gauche */}
          {(Array.isArray(block.content) ? block.content : []).map((_, index) => (
            <Handle
              key={`list-target-${index}`}
              type="target"
              position={Position.Left}
              id={`list-target-${index}`}
              className="!bg-blue-500 !w-2.5 !h-2.5 !border-2 !border-white"
              style={{
                top: `${44 + index * 32 + 16}px`, // 44px header + 32px par ligne + centrage
              }}
            />
          ))}

          {/* Handle source en bas */}
          <Handle type="source" position={Position.Bottom} id="bottom-main" className="!bg-green-500 !w-3 !h-3" />
        </>
      ) : block.type === "task" ? (
        <>
          {/* Handle cible en haut */}
          <Handle type="target" position={Position.Top} id="top-main" className="!bg-blue-500 !w-3 !h-3" />
          <Handle type="target" position={Position.Left} id="left-main" className="!bg-blue-500 !w-3 !h-3" />

          {/* Les handles pour chaque tâche sont rendus DANS le contenu, pas ici */}

          {/* Handle source en bas */}
          <Handle type="source" position={Position.Bottom} id="bottom-main" className="!bg-green-500 !w-3 !h-3" />
          <Handle type="source" position={Position.Right} id="right-main" className="!bg-green-500 !w-3 !h-3" />
        </>
      ) : block.type === "order" ? (
        <>
          {/* Handle cible en haut et gauche */}
          <Handle type="target" position={Position.Top} id="top-main" className="!bg-blue-500 !w-3 !h-3" />
          <Handle type="target" position={Position.Left} id="left-main" className="!bg-blue-500 !w-3 !h-3" />

          {/* Les handles pour chaque article sont rendus DANS le contenu, pas ici */}

          {/* Handle source en bas */}
          <Handle type="source" position={Position.Bottom} id="bottom-main" className="!bg-green-500 !w-3 !h-3" />
          <Handle type="source" position={Position.Right} id="right-main" className="!bg-green-500 !w-3 !h-3" />
        </>
      ) : block.type === "supplier" ? (
        <>
          {/* Handle cible en haut */}
          <Handle type="target" position={Position.Top} id="top-main" className="!bg-blue-500 !w-3 !h-3" />
          <Handle type="target" position={Position.Left} id="left-main" className="!bg-blue-500 !w-3 !h-3" />

          {/* Les handles pour chaque fournisseur sont rendus DANS le contenu, pas ici */}

          {/* Handle source en bas */}
          <Handle type="source" position={Position.Bottom} id="bottom-main" className="!bg-green-500 !w-3 !h-3" />
          <Handle type="source" position={Position.Right} id="right-main" className="!bg-green-500 !w-3 !h-3" />
        </>
      ) : (
        <>
          {/* Handles standard pour les autres types */}
          <Handle type="target" position={Position.Top} id="top-main" className="!bg-blue-500 !w-3 !h-3" />
          <Handle type="target" position={Position.Left} id="left-main" className="!bg-blue-500 !w-3 !h-3" />
          <Handle type="source" position={Position.Bottom} id="bottom-main" className="!bg-green-500 !w-3 !h-3" />
          <Handle type="source" position={Position.Right} id="right-main" className="!bg-green-500 !w-3 !h-3" />
        </>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-50 rounded-t-md border-b cursor-move">
        <div className="flex items-center gap-1 flex-1">
          <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
          {getBlockIcon()}
          <span className="text-xs text-gray-500 capitalize flex-shrink-0">{block.type}</span>

          {/* Indicateur simple : copie ou replanifié */}
          {block.sourceDate && (
            <button
              className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded ml-1 hover:bg-purple-200 flex items-center gap-0.5 whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToDate(block.sourceDate!);
              }}
              title="Aller à l'original"
            >
              ← {format(parseISO(block.sourceDate), "d/MM", { locale: fr })}
            </button>
          )}
          {block.rescheduledTo && !block.sourceDate && (
            <button
              className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded ml-1 hover:bg-orange-200 flex items-center gap-0.5 whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToDate(block.rescheduledTo!);
              }}
              title="Aller à la copie"
            >
              → {format(parseISO(block.rescheduledTo), "d/MM", { locale: fr })}
            </button>
          )}

          {/* Badge projet lié */}
          {block.linkedProjectName && (
            <span
              className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded ml-1 whitespace-nowrap"
              title={block.linkedProjectName}
            >
              {block.linkedProjectName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Project picker */}
          <Popover open={showProjectPicker} onOpenChange={setShowProjectPicker}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-5 w-5 ${block.linkedProjectId ? "text-green-600" : "text-gray-400"}`}
                onClick={stopPropagation}
                title="Lier à un projet"
              >
                <FolderOpen className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end" onClick={stopPropagation} onPointerDown={stopPropagation}>
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">Lier à un projet</p>
                <div className="max-h-48 overflow-auto space-y-1">
                  {projects.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">Aucun projet disponible</p>
                  )}
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 flex items-center gap-2 ${
                        block.linkedProjectId === project.id ? "bg-green-50 text-green-700" : ""
                      }`}
                      onClick={() => {
                        onUpdate({
                          linkedProjectId: project.id,
                          linkedProjectName: project.name,
                        });
                        setShowProjectPicker(false);
                      }}
                    >
                      <FolderOpen className="h-3 w-3" />
                      {project.name}
                      {project.id === currentProjectId && (
                        <span className="text-xs text-gray-400 ml-auto">(actuel)</span>
                      )}
                    </button>
                  ))}
                </div>
                {block.linkedProjectId && (
                  <>
                    <hr className="my-1 border-gray-200" />
                    <button
                      className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-red-50 text-red-600 flex items-center gap-2"
                      onClick={() => {
                        onUpdate({ linkedProjectId: undefined, linkedProjectName: undefined });
                        setShowProjectPicker(false);
                      }}
                    >
                      <Unlink className="h-3 w-3" />
                      Délier du projet
                    </button>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Date picker pour export */}
          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-5 w-5 ${block.targetDate ? "text-blue-600" : "text-gray-400"}`}
                onClick={stopPropagation}
                title="Planifier pour une autre date"
              >
                <CalendarIcon className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0"
              align="end"
              onClick={stopPropagation}
              onPointerDown={stopPropagation}
            >
              <div className="p-2 border-b bg-gray-50">
                <p className="text-xs text-gray-600 font-medium">📅 Planifier ce bloc pour :</p>
              </div>
              <Calendar
                mode="single"
                selected={block.targetDate ? parseISO(block.targetDate) : undefined}
                onSelect={(date) => {
                  if (date) {
                    // Fermer le popover AVANT d'appeler la fonction
                    setShowDatePicker(false);
                    // Petit délai pour éviter les problèmes de double-clic
                    setTimeout(() => {
                      const targetDate = format(date, "yyyy-MM-dd");
                      onMoveToDate(targetDate);
                    }, 100);
                  }
                }}
                locale={fr}
                // 🔥 Permettre les dates passées pour documenter le travail déjà fait
              />
            </PopoverContent>
          </Popover>

          {/* 🔥 Sélecteur de couleur du bloc */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={stopPropagation} title="Couleur du bloc">
                <Palette
                  className="h-3 w-3"
                  style={{
                    color:
                      block.style?.backgroundColor !== "#ffffff" && block.style?.backgroundColor !== "#fff"
                        ? block.style?.backgroundColor
                        : "#9ca3af",
                  }}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end" onClick={stopPropagation}>
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">Couleur du bloc</p>
                <div className="grid grid-cols-4 gap-1">
                  {BLOCK_COLORS.map((color) => (
                    <button
                      key={color.value}
                      className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${
                        block.style?.backgroundColor === color.value
                          ? "border-blue-500 ring-1 ring-blue-300"
                          : "border-gray-300"
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() =>
                        onUpdate({
                          style: { ...block.style, backgroundColor: color.value },
                        })
                      }
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* 🔥 Bouton supprimer (croix) */}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-gray-400 hover:text-red-500 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Supprimer"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="nodrag">{renderContent()}</div>

      {/* Footer avec date cible et/ou projet */}
      {(block.targetDate || block.linkedProjectId) && (
        <div className="border-t rounded-b-md overflow-hidden">
          {/* Ligne projet */}
          {block.linkedProjectId && (
            <div className="flex items-center justify-between px-2 py-1 bg-green-50">
              <div className="flex items-center gap-1 text-xs text-green-600">
                <FolderOpen className="h-3 w-3" />
                <span>{block.linkedProjectName}</span>
              </div>
            </div>
          )}
          {/* Ligne date cible */}
          {block.targetDate && (
            <div
              className={`flex items-center justify-between px-2 py-1 bg-blue-50 ${block.linkedProjectId ? "border-t border-blue-100" : ""}`}
            >
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <CalendarIcon className="h-3 w-3" />
                <span>→ {format(parseISO(block.targetDate), "EEEE d MMMM", { locale: fr })}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToDate(block.targetDate!);
                }}
                title="Copier vers cette date"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copier
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// COMPOSANT POUR LES DIMENSIONS DE ZONE
// ============================================

interface ZoneDimensionsPopoverProps {
  currentWidth: number;
  currentHeight: number;
  onApply: (width: number, height: number) => void;
}

function ZoneDimensionsPopover({ currentWidth, currentHeight, onApply }: ZoneDimensionsPopoverProps) {
  const [tempWidth, setTempWidth] = useState(currentWidth);
  const [tempHeight, setTempHeight] = useState(currentHeight);

  // Sync quand les props changent
  useEffect(() => {
    setTempWidth(currentWidth);
    setTempHeight(currentHeight);
  }, [currentWidth, currentHeight]);

  const hasChanges = tempWidth !== currentWidth || tempHeight !== currentHeight;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-600">Dimensions</p>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-14">Largeur</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="200"
              step="50"
              value={tempWidth}
              onChange={(e) => setTempWidth(Math.max(200, parseInt(e.target.value) || 200))}
              className="w-20 h-7 text-xs text-center border rounded px-1 nodrag"
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-xs text-gray-400">px</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-14">Hauteur</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="150"
              step="50"
              value={tempHeight}
              onChange={(e) => setTempHeight(Math.max(150, parseInt(e.target.value) || 150))}
              className="w-20 h-7 text-xs text-center border rounded px-1 nodrag"
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-xs text-gray-400">px</span>
          </div>
        </div>
      </div>

      {/* Bouton Appliquer - visible seulement si changements */}
      {hasChanges && (
        <Button
          variant="default"
          size="sm"
          className="w-full text-xs h-7"
          onClick={() => onApply(tempWidth, tempHeight)}
        >
          ✓ Appliquer
        </Button>
      )}

      <div className="flex gap-1 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs h-7"
          onClick={() => {
            setTempWidth(600);
            setTempHeight(400);
            onApply(600, 400);
          }}
        >
          Grand
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs h-7"
          onClick={() => {
            setTempWidth(1200);
            setTempHeight(800);
            onApply(1200, 800);
          }}
        >
          Très grand
        </Button>
      </div>
    </div>
  );
}

// ============================================
// COMPOSANT DE NAVIGATION DES ZONES - SIDEBAR OVERLAY
// ============================================

interface ZonesNavigationBarProps {
  zones: NoteBlock[];
  focusZoneId?: string | null; // Zone sur laquelle centrer automatiquement
  onFocusComplete?: () => void; // Callback quand le focus est terminé
}

function ZonesNavigationBar({ zones, focusZoneId, onFocusComplete }: ZonesNavigationBarProps) {
  const { setCenter, getZoom } = useReactFlow();
  const hasFocusedRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  const navigateToZone = useCallback(
    (zone: NoteBlock) => {
      const zoneWidth = zone.width || 400;
      const zoneHeight = zone.height || 300;
      const centerX = zone.x + zoneWidth / 2;
      const centerY = zone.y + zoneHeight / 2;

      // Centrer la vue sur la zone avec une animation
      setCenter(centerX, centerY, { zoom: getZoom(), duration: 500 });
    },
    [setCenter, getZoom],
  );

  // 🔥 Centrer automatiquement sur la zone focusée
  useEffect(() => {
    if (focusZoneId && !hasFocusedRef.current) {
      const zoneToFocus = zones.find((z) => z.id === focusZoneId);
      if (zoneToFocus) {
        console.log("🎯 Centrage sur la zone:", zoneToFocus.content?.title || zoneToFocus.id);
        // Petit délai pour laisser le temps au canvas de se charger
        setTimeout(() => {
          navigateToZone(zoneToFocus);
          hasFocusedRef.current = true;
          onFocusComplete?.();
        }, 300);
      }
    }
  }, [focusZoneId, zones, navigateToZone, onFocusComplete]);

  // Reset le flag quand focusZoneId change
  useEffect(() => {
    if (!focusZoneId) {
      hasFocusedRef.current = false;
    }
  }, [focusZoneId]);

  // Fonction pour obtenir le nom d'affichage de la zone
  const getZoneDisplayName = (zone: NoteBlock) => {
    // Priorité : nom du projet lié > titre de la zone > "Zone"
    if (zone.zoneLinkedProjectName) return zone.zoneLinkedProjectName;
    if (zone.content?.title && zone.content.title !== "Zone de travail") return zone.content.title;
    return "Zone";
  };

  if (zones.length === 0) return null;

  return (
    <>
      {/* Bouton toggle pour ouvrir la sidebar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-all shadow-sm"
        title="Afficher les zones"
      >
        <Layers className="h-3.5 w-3.5" />
        <span>Zones</span>
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {zones.length}
        </Badge>
        <ChevronRight className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Sidebar overlay */}
      {isOpen && (
        <>
          {/* Backdrop transparent - ferme la sidebar au clic */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Sidebar */}
          <div className="absolute left-0 top-12 z-50 w-64 max-h-[60vh] overflow-hidden rounded-r-xl shadow-xl animate-in slide-in-from-left-2 duration-200">
            {/* Header */}
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-500" />
                <span className="font-semibold text-sm">Zones de travail</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Liste des zones */}
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md overflow-y-auto max-h-[calc(60vh-50px)]">
              {zones.map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => {
                    navigateToZone(zone);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-all border-b border-gray-100 dark:border-gray-800 last:border-0 group"
                >
                  {/* Indicateur couleur */}
                  <div
                    className="w-3 h-3 rounded-full ring-2 ring-white shadow-sm flex-shrink-0"
                    style={{ backgroundColor: zone.zoneBorderColor || "#9ca3af" }}
                  />

                  {/* Nom de la zone */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {getZoneDisplayName(zone)}
                    </p>
                    {zone.zoneLinkedProjectName && zone.content?.title && zone.content.title !== "Zone de travail" && (
                      <p className="text-xs text-gray-500 truncate">{zone.content.title}</p>
                    )}
                  </div>

                  {/* Icônes de statut */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {zone.isLocked && (
                      <span title="Zone verrouillée">
                        <Lock className="h-3.5 w-3.5 text-amber-500" />
                      </span>
                    )}
                    {zone.isContentLocked && (
                      <span title="Contenu verrouillé">
                        <Move className="h-3.5 w-3.5 text-purple-500" />
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

// Node types pour ReactFlow
const nodeTypes = {
  customBlock: CustomBlockNode,
};

// ============================================
// MAIN COMPONENT
// ============================================

interface DailyNotesCanvasProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date; // Date initiale pour ouvrir le planning
  focusZoneId?: string; // ID de la zone sur laquelle centrer la vue
}

export default function DailyNotesCanvas({
  projectId,
  open,
  onOpenChange,
  initialDate,
  focusZoneId,
}: DailyNotesCanvasProps) {
  // États principaux
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [userId, setUserId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<NoteBlock[]>([]);
  const [edges, setEdges] = useState<BlockEdge[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]); // Multi-sélection
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null); // 🔥 Edge sélectionné
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 🔥 Zone à focaliser après chargement
  const [pendingFocusZoneId, setPendingFocusZoneId] = useState<string | null>(null);

  // Hook pour rafraîchir les données du contexte (calendrier mensuel)
  const { refreshData } = useProjectData();

  // Liste des projets pour le sélecteur
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  // 🔥 Liste des fournisseurs enregistrés
  const [suppliers, setSuppliers] = useState<string[]>([]);

  // Dates avec des blocs roadmap (pour indicateurs dans l'agenda)
  const [roadmapDates, setRoadmapDates] = useState<Set<string>>(new Set());

  // 🔥 Dates avec des livraisons prévues
  const [deliveryDates, setDeliveryDates] = useState<Set<string>>(new Set());

  // Ref pour détecter les changements de blocs (ReactFlow sync)
  const blocksIdsRef = useRef<string>("");

  // 🔥 Refs pour toujours avoir la dernière valeur (éviter closures obsolètes)
  const blocksRef = useRef<NoteBlock[]>([]);
  const edgesRef = useRef<BlockEdge[]>([]);

  // Sync les refs avec les états
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // 🔥 Ref pour tracker les positions des zones pendant le drag (éviter le décalage)
  const lastZonePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // 🔥 Ref pour stocker le viewport actuel (pour centrer les nouveaux blocs)
  const viewportRef = useRef<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });

  // 🔥 v3.2a - Refs stables pour tous les callbacks passés aux nodes
  // Empêche la re-création des nodes ReactFlow à chaque frappe de clavier
  const stableCallbacksRef = useRef<{
    updateBlockWithSync: (blockId: string, updates: Partial<NoteBlock>) => void;
    deleteBlock: (blockId: string) => void;
    handleImageUpload: (blockId: string, file: File) => void;
    moveBlockToDate: (blockId: string, targetDate: string) => void;
    moveTaskToDate: (task: LinkedTask, targetDate: string) => void;
    searchTasks: (query: string, linkedProjectId?: string) => Promise<AvailableTask[]>;
    linkTask: (blockId: string, task: AvailableTask) => void;
    updateTaskStatus: (taskId: string, status: "pending" | "in_progress" | "completed", actualHours?: number) => void;
    sendToSidebarTask: (blockId: string) => void;
    sendToSidebarNote: (blockId: string) => void;
    searchExpenses: (query: string, linkedProjectId?: string) => Promise<LinkedExpense[]>;
    linkExpense: (blockId: string, expense: LinkedExpense) => void;
    updateExpense: (expenseId: string, updates: Partial<LinkedExpense>) => void;
    setSelectedDate: (date: Date) => void;
  }>({} as any);

  // États dessin Paper.js
  const [activeTool, setActiveTool] = useState<DrawTool>("select");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // 🔥 Calculer les zones pour la barre de navigation
  const zones = useMemo(() => {
    const zoneBlocks = blocks.filter((b) => b.type === "zone");
    console.log(
      "📂 Zones recalculées:",
      zoneBlocks.length,
      zoneBlocks.map((z) => z.id),
    );
    return zoneBlocks;
  }, [blocks]);

  // État pour la note rapide (sidebar)
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [quickNoteTitle, setQuickNoteTitle] = useState("");
  const [quickNoteContent, setQuickNoteContent] = useState("");

  // 🔥 État pour l'achat rapide
  const [showQuickPurchase, setShowQuickPurchase] = useState(false);
  const [quickPurchaseName, setQuickPurchaseName] = useState("");
  const [quickPurchaseBrand, setQuickPurchaseBrand] = useState("");
  const [quickPurchasePrice, setQuickPurchasePrice] = useState("");
  const [quickPurchaseQuantity, setQuickPurchaseQuantity] = useState("1");
  const [quickPurchaseSupplier, setQuickPurchaseSupplier] = useState("");
  const [quickPurchaseCategory, setQuickPurchaseCategory] = useState("Fournitures");
  const [isAddingPurchase, setIsAddingPurchase] = useState(false);
  const [availableProjectsForPurchase, setAvailableProjectsForPurchase] = useState<
    { id: string; name: string; scenarioId: string }[]
  >([]);
  const [selectedProjectForPurchase, setSelectedProjectForPurchase] = useState<string>("");

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperScopeRef = useRef<paper.PaperScope | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const reactFlowContainerRef = useRef<HTMLDivElement>(null); // 🔥 Ref pour le conteneur ReactFlow
  const reactFlowInstanceRef = useRef<any>(null); // 🔥 Instance ReactFlow pour screenToFlowPosition

  // Refs pour les valeurs dans les handlers
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);
  const activeToolRef = useRef(activeTool);

  useEffect(() => {
    strokeColorRef.current = strokeColor;
  }, [strokeColor]);
  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // 🔥 Ref pour forcer le rechargement quand initialDate change
  const lastInitialDateRef = useRef<string | null>(null);

  // Mettre à jour selectedDate quand initialDate change et le dialog s'ouvre
  // ET déclencher le rechargement
  useEffect(() => {
    if (!open) {
      lastInitialDateRef.current = null;
      return;
    }

    if (initialDate) {
      const newDateStr = format(initialDate, "yyyy-MM-dd");
      // Si la date initiale a changé ou si c'est la première ouverture
      if (lastInitialDateRef.current !== newDateStr) {
        console.log("📅 initialDate changée:", lastInitialDateRef.current, "->", newDateStr);
        lastInitialDateRef.current = newDateStr;
        setSelectedDate(initialDate);
      }
    }
  }, [open, initialDate]);

  // 🔥 Mettre à jour pendingFocusZoneId quand focusZoneId change
  useEffect(() => {
    if (open && focusZoneId) {
      console.log("🎯 Zone à focaliser:", focusZoneId);
      setPendingFocusZoneId(focusZoneId);
    }
    if (!open) {
      setPendingFocusZoneId(null);
    }
  }, [open, focusZoneId]);

  // 🔥 Rafraîchir le calendrier mensuel quand on ferme le planning
  const wasOpenRef = useRef(open);
  useEffect(() => {
    // Détecter la fermeture (open passe de true à false)
    if (wasOpenRef.current && !open) {
      console.log("📅 Planning fermé - rafraîchissement du calendrier");
      refreshData();
    }
    wasOpenRef.current = open;
  }, [open, refreshData]);

  // ReactFlow states
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);

  // Charger Google Fonts
  useEffect(() => {
    if (!document.querySelector(`link[href*="fonts.googleapis.com"]`)) {
      const link = document.createElement("link");
      link.href = GOOGLE_FONTS_URL;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
  }, []);

  // ============================================
  // BLOCK HANDLERS
  // ============================================

  const updateBlock = useCallback((blockId: string, updates: Partial<NoteBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...updates } : b)));
    setHasUnsavedChanges(true);
  }, []);

  // Synchroniser les modifications vers le bloc source (original)
  const syncBlockToSource = useCallback(
    async (blockId: string, updates: Partial<NoteBlock>) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block?.sourceBlockId || !block?.sourceDate || !userId) return;

      try {
        // Charger la note de la date source (GLOBAL)
        const { data: sourceNote, error } = await (supabase as any)
          .from("daily_notes")
          .select("*")
          .eq("user_id", userId)
          .eq("note_date", block.sourceDate)
          .maybeSingle();

        if (error || !sourceNote?.blocks_data) return;

        // Trouver et mettre à jour le bloc source
        let sourceBlocks: NoteBlock[] = JSON.parse(sourceNote.blocks_data);
        const sourceBlockIndex = sourceBlocks.findIndex((b) => b.id === block.sourceBlockId);

        if (sourceBlockIndex === -1) return;

        // Appliquer les mêmes modifications au bloc source (sauf position et dates)
        const { x, y, targetDate, sourceDate, sourceBlockId, ...contentUpdates } = updates;
        sourceBlocks[sourceBlockIndex] = {
          ...sourceBlocks[sourceBlockIndex],
          ...contentUpdates,
        };

        // Sauvegarder
        await (supabase as any)
          .from("daily_notes")
          .update({
            blocks_data: JSON.stringify(sourceBlocks),
            updated_at: new Date().toISOString(),
          })
          .eq("id", sourceNote.id);

        // Bloc source synchronisé
      } catch (error) {
        console.error("Erreur sync bloc source:", error);
      }
    },
    [blocks, userId, projectId],
  );

  // Wrapper updateBlock avec sync automatique
  const updateBlockWithSync = useCallback(
    (blockId: string, updates: Partial<NoteBlock>) => {
      // Mise à jour locale immédiate avec callback pour avoir la valeur actuelle
      setBlocks((prev) => {
        const block = prev.find((b) => b.id === blockId);
        if (!block) return prev;

        const updatedBlock = { ...block, ...updates };
        let updatedBlocks = prev.map((b) => (b.id === blockId ? updatedBlock : b));

        // 🔥 Si c'est une zone qui change de taille, écarter les autres zones
        if (block.type === "zone" && (updates.width || updates.height)) {
          const newWidth = updates.width || block.width || 400;
          const newHeight = updates.height || block.height || 300;
          const zoneX = block.x;
          const zoneY = block.y;
          const margin = 20; // Marge entre les zones

          updatedBlocks = updatedBlocks.map((otherBlock) => {
            // Ne pas déplacer la zone elle-même ni les non-zones
            if (otherBlock.id === blockId || otherBlock.type !== "zone") return otherBlock;

            const otherX = otherBlock.x;
            const otherY = otherBlock.y;
            const otherWidth = otherBlock.width || 400;
            const otherHeight = otherBlock.height || 300;

            // Vérifier le chevauchement
            const overlapX = zoneX < otherX + otherWidth && zoneX + newWidth > otherX;
            const overlapY = zoneY < otherY + otherHeight && zoneY + newHeight > otherY;

            if (overlapX && overlapY) {
              // Calculer dans quelle direction pousser
              const pushRight = zoneX + newWidth + margin - otherX;
              const pushLeft = otherX + otherWidth - (zoneX - margin);
              const pushDown = zoneY + newHeight + margin - otherY;
              const pushUp = otherY + otherHeight - (zoneY - margin);

              // Choisir la direction avec le plus petit déplacement
              const minPush = Math.min(pushRight, pushLeft, pushDown, pushUp);

              if (minPush === pushRight && pushRight > 0) {
                return { ...otherBlock, x: zoneX + newWidth + margin };
              } else if (minPush === pushLeft && pushLeft > 0) {
                return { ...otherBlock, x: zoneX - otherWidth - margin };
              } else if (minPush === pushDown && pushDown > 0) {
                return { ...otherBlock, y: zoneY + newHeight + margin };
              } else if (minPush === pushUp && pushUp > 0) {
                return { ...otherBlock, y: zoneY - otherHeight - margin };
              }
            }

            return otherBlock;
          });
        }

        // Sync vers le bloc source si c'est une copie
        if (block?.sourceBlockId && block?.sourceDate) {
          const { x, y, ...contentUpdates } = updates;
          if (Object.keys(contentUpdates).length > 0) {
            // Appeler la sync de manière asynchrone pour éviter les problèmes
            setTimeout(() => syncBlockToSource(blockId, contentUpdates), 0);
          }
        }

        return updatedBlocks;
      });
      setHasUnsavedChanges(true);
    },
    [syncBlockToSource],
  );

  const deleteBlock = useCallback(
    async (blockId: string) => {
      // 🔥 Variables pour stocker les valeurs après le setState
      let blockToDelete: NoteBlock | undefined;
      let newBlocks: NoteBlock[] = [];
      let newEdges: BlockEdge[] = [];

      // 🔥 Utiliser le setter fonctionnel pour avoir la valeur la plus récente
      setBlocks((prevBlocks) => {
        blockToDelete = prevBlocks.find((b) => b.id === blockId);
        if (!blockToDelete) {
          return prevBlocks; // Pas de changement
        }
        newBlocks = prevBlocks.filter((b) => b.id !== blockId);
        console.log("🗑️ Suppression du bloc:", blockId, "Type:", blockToDelete.type);
        console.log("📦 Blocs après suppression:", newBlocks.length);
        return newBlocks;
      });

      setEdges((prevEdges) => {
        newEdges = prevEdges.filter((e) => e.source_block_id !== blockId && e.target_block_id !== blockId);
        return newEdges;
      });

      // Attendre un tick pour que les states soient mis à jour
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (!blockToDelete) return;

      // 🔥 Récupérer toutes les tâches liées
      const linkedTasks = blockToDelete.linkedTasks || (blockToDelete.linkedTask ? [blockToDelete.linkedTask] : []);
      const taskIds = linkedTasks.map((t) => t.id);

      // 🔥 Remettre les tâches à l'état initial (non planifiées, non complétées)
      if (taskIds.length > 0) {
        try {
          await (supabase as any)
            .from("project_todos")
            .update({
              scheduled_date: null,
              completed: false,
              completed_at: null,
            })
            .in("id", taskIds);
          console.log("🔄 Tâches réinitialisées:", taskIds);
        } catch (error) {
          console.error("Erreur réinitialisation tâches:", error);
        }
      }

      if (selectedBlockId === blockId) setSelectedBlockId(null);

      // 🔥 SAUVEGARDER IMMÉDIATEMENT dans la base de données
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      try {
        const { data: currentNote } = await (supabase as any)
          .from("daily_notes")
          .select("id")
          .eq("user_id", userId)
          .eq("note_date", dateStr)
          .maybeSingle();

        if (currentNote) {
          const result = await (supabase as any)
            .from("daily_notes")
            .update({
              blocks_data: JSON.stringify(newBlocks),
              connections_data: JSON.stringify(newEdges),
              updated_at: new Date().toISOString(),
            })
            .eq("id", currentNote.id);
          console.log("💾 Bloc supprimé et sauvegardé, résultat:", result);
        }
      } catch (error) {
        console.error("Erreur sauvegarde après suppression:", error);
      }

      setHasUnsavedChanges(false);

      // 🔥 Si c'est un ORIGINAL avec une copie (rescheduledTo), supprimer aussi la copie
      if (blockToDelete.rescheduledTo && userId) {
        try {
          const { data: targetNote } = await (supabase as any)
            .from("daily_notes")
            .select("id, blocks_data")
            .eq("user_id", userId)
            .eq("note_date", blockToDelete.rescheduledTo)
            .maybeSingle();

          if (targetNote?.blocks_data) {
            const targetBlocks: NoteBlock[] = JSON.parse(targetNote.blocks_data);
            // Supprimer le bloc copié (celui qui a sourceBlockId = blockId)
            const updatedTargetBlocks = targetBlocks.filter((b) => b.sourceBlockId !== blockId);

            await (supabase as any)
              .from("daily_notes")
              .update({
                blocks_data: JSON.stringify(updatedTargetBlocks),
                updated_at: new Date().toISOString(),
              })
              .eq("id", targetNote.id);

            console.log("🗑️ Copie supprimée de la date:", blockToDelete.rescheduledTo);
            toast.success("Bloc et sa copie supprimés");
          }
        } catch (error) {
          console.error("Erreur suppression copie:", error);
        }
      }

      // 🔥 Si c'était une COPIE, nettoyer le rescheduledTo de l'original
      if (blockToDelete.sourceDate && blockToDelete.sourceBlockId && userId) {
        try {
          const { data: sourceNote } = await (supabase as any)
            .from("daily_notes")
            .select("id, blocks_data")
            .eq("user_id", userId)
            .eq("note_date", blockToDelete.sourceDate)
            .maybeSingle();

          if (sourceNote?.blocks_data) {
            const sourceBlocks: NoteBlock[] = JSON.parse(sourceNote.blocks_data);
            // Remettre l'original à l'état initial (pas de rescheduledTo, pas completed)
            const updatedBlocks = sourceBlocks.map((b) =>
              b.id === blockToDelete.sourceBlockId
                ? {
                    ...b,
                    rescheduledTo: undefined,
                    taskStatus: "pending" as const,
                    linkedTasks: b.linkedTasks?.map((t) => ({ ...t, completed: false })),
                    linkedTask: b.linkedTask ? { ...b.linkedTask, completed: false } : undefined,
                  }
                : b,
            );

            await (supabase as any)
              .from("daily_notes")
              .update({
                blocks_data: JSON.stringify(updatedBlocks),
                updated_at: new Date().toISOString(),
              })
              .eq("id", sourceNote.id);

            toast.success("Lien avec l'original supprimé");
          }
        } catch (error) {
          console.error("Erreur nettoyage original:", error);
        }
      }

      // 🔥 Rafraîchir le contexte pour mettre à jour le calendrier et la fiche travaux
      refreshData();
    },
    [selectedBlockId, userId, projectId, selectedDate, refreshData], // 🔥 Plus de blocks/edges car on utilise les refs
  );

  const addBlock = useCallback((type: NoteBlock["type"]) => {
    // 🔥 Toujours calculer la position au centre de la vue visible
    let posX = 100;
    let posY = 100;

    const container = reactFlowContainerRef.current;
    const rfInstance = reactFlowInstanceRef.current;

    if (rfInstance && container) {
      // Utiliser screenToFlowPosition pour convertir le centre de l'écran
      const centerScreen = {
        x: container.clientWidth / 2,
        y: container.clientHeight / 2,
      };
      const flowPosition = rfInstance.screenToFlowPosition(centerScreen);
      // Petit offset aléatoire pour éviter l'empilement exact
      posX = flowPosition.x - 100 + Math.random() * 50;
      posY = flowPosition.y - 50 + Math.random() * 50;
    }

    const newBlock: NoteBlock = {
      id: crypto.randomUUID(),
      type,
      x: posX,
      y: posY,
      width:
        type === "zone"
          ? 2500
          : type === "table"
            ? 300
            : type === "task"
              ? 280
              : type === "order"
                ? 320
                : type === "supplier"
                  ? 250
                  : 200,
      height: type === "zone" ? 2500 : type === "order" ? 150 : type === "supplier" ? 120 : 100,
      content:
        type === "checklist"
          ? [{ id: crypto.randomUUID(), text: "", checked: false }]
          : type === "list"
            ? [""]
            : type === "table"
              ? [
                  ["", ""],
                  ["", ""],
                ]
              : type === "task"
                ? null // Le contenu sera la tâche liée
                : type === "order"
                  ? null // Le contenu sera les dépenses liées
                  : type === "supplier"
                    ? null // Le contenu sera les fournisseurs liés
                    : type === "zone"
                      ? { title: "Zone de travail", description: "" }
                      : "",
      style: {
        fontFamily: FONTS[0].value,
        fontSize: 14,
        color: "#000000",
        backgroundColor: type === "zone" ? "transparent" : "#ffffff",
      },
      // 🔥 Blocs créés sans lien projet - l'utilisateur lie manuellement
      linkedProjectId: undefined,
      linkedProjectName: undefined,
      // Initialiser linkedExpenses pour le type order
      linkedExpenses: type === "order" ? [] : undefined,
      // Initialiser linkedSuppliers pour le type supplier
      linkedSuppliers: type === "supplier" ? [] : undefined,
      // Initialiser les couleurs pour le type zone
      zoneColor: type === "zone" ? "#f3f4f6" : undefined,
      zoneBorderColor: type === "zone" ? "#d1d5db" : undefined,
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
    setHasUnsavedChanges(true);
  }, []);

  const handleImageUpload = useCallback(
    async (blockId: string, file: File) => {
      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `daily-notes/${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from("project-files").upload(filePath, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("project-files").getPublicUrl(filePath);

        updateBlockWithSync(blockId, { content: publicUrl });
        toast.success("Image ajoutée");
      } catch (error) {
        console.error("Erreur upload:", error);
        toast.error("Erreur lors de l'upload");
      }
    },
    [userId, updateBlockWithSync],
  );

  // Rechercher des tâches dans les fiches de travaux
  const searchTasks = useCallback(
    async (query: string, linkedProjectId?: string): Promise<AvailableTask[]> => {
      if (!userId) return [];

      // Fonction pour nettoyer les entités HTML
      const cleanHtmlEntities = (str: string | null | undefined): string => {
        if (!str) return "";
        return str
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'")
          .replace(/\s+/g, " ") // Normaliser les espaces multiples
          .trim();
      };

      // 🔥 Récupérer les IDs des tâches déjà liées aux blocs
      const linkedTaskIds: string[] = [];
      blocks.forEach((block) => {
        const tasks = block.linkedTasks || (block.linkedTask ? [block.linkedTask] : []);
        tasks.forEach((task) => {
          if (task.id && !linkedTaskIds.includes(task.id)) {
            linkedTaskIds.push(task.id);
          }
        });
      });

      // Si query vide ou trop court, retourner les travaux récents
      const minQueryLength = query.length >= 2;

      try {
        // 🔥 Si le bloc est lié à un projet, filtrer uniquement sur ce projet
        let targetProjectIds: string[];

        if (linkedProjectId) {
          // Bloc lié à un projet spécifique → filtrer sur ce projet
          targetProjectIds = [linkedProjectId];
        } else {
          // Pas de projet lié → tous les projets de l'utilisateur
          const { data: userProjects } = await (supabase as any).from("projects").select("id").eq("user_id", userId);
          if (!userProjects || userProjects.length === 0) return [];
          targetProjectIds = userProjects.map((p: any) => p.id);
        }

        // Construire la requête de base
        let queryBuilder = (supabase as any)
          .from("project_todos")
          .select(
            `
          id,
          title,
          description,
          estimated_hours,
          actual_hours,
          completed,
          scheduled_date,
          forfait_ttc,
          category_id,
          project_id,
          work_categories (
            name,
            color,
            icon
          ),
          projects (
            name,
            nom
          )
        `,
          )
          .in("project_id", targetProjectIds)
          .not("category_id", "is", null) // Seulement les travaux (avec catégorie)
          .eq("completed", false) // Seulement les tâches non terminées
          .is("scheduled_date", null); // 🔥 Seulement les tâches NON planifiées

        // Si recherche active, filtrer par titre
        if (minQueryLength) {
          queryBuilder = queryBuilder.ilike("title", `%${query}%`);
        }

        const { data: tasks, error } = await queryBuilder
          .order("created_at", { ascending: false }) // 🔥 Trier par date de création
          .limit(20);

        if (error) throw error;

        // 🔥 Filtrer aussi les tâches déjà liées aux blocs du jour actuel (double sécurité)
        const filteredTasks = (tasks || []).filter((task: any) => !linkedTaskIds.includes(task.id));

        return filteredTasks.map((task: any) => ({
          id: task.id,
          title: cleanHtmlEntities(task.title),
          description: cleanHtmlEntities(task.description),
          estimated_hours: task.estimated_hours,
          actual_hours: task.actual_hours,
          completed: task.completed || false,
          scheduled_date: task.scheduled_date,
          forfait_ttc: task.forfait_ttc,
          category_name: cleanHtmlEntities(task.work_categories?.name),
          category_color: task.work_categories?.color,
          category_icon: task.work_categories?.icon,
          project_id: task.project_id,
          project_name: cleanHtmlEntities(task.projects?.name || task.projects?.nom) || "Projet inconnu",
        }));
      } catch (error) {
        console.error("Erreur recherche tâches:", error);
        return [];
      }
    },
    [userId, blocks],
  );

  // Lier une tâche à un bloc (ajoute à la liste existante)
  const linkTask = useCallback((blockId: string, task: AvailableTask) => {
    const linkedTask: LinkedTask = {
      id: task.id,
      title: task.title,
      description: task.description,
      estimated_hours: task.estimated_hours,
      actual_hours: task.actual_hours,
      completed: task.completed,
      scheduled_date: task.scheduled_date,
      forfait_ttc: task.forfait_ttc,
      category_name: task.category_name,
      category_color: task.category_color,
      category_icon: task.category_icon,
      project_id: task.project_id,
      project_name: task.project_name,
    };

    // Utiliser setBlocks avec callback pour avoir la valeur la plus récente
    setBlocks((prevBlocks) => {
      const currentBlock = prevBlocks.find((b) => b.id === blockId);
      if (!currentBlock) return prevBlocks;

      const existingTasks = currentBlock.linkedTasks || (currentBlock.linkedTask ? [currentBlock.linkedTask] : []);

      // Vérifier si la tâche n'est pas déjà dans la liste
      if (existingTasks.some((t) => t.id === task.id)) {
        toast.error("Cette tâche est déjà dans la liste");
        return prevBlocks;
      }

      // Ajouter la nouvelle tâche à la liste
      const newLinkedTasks = [...existingTasks, linkedTask];

      return prevBlocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              linkedTasks: newLinkedTasks,
              linkedTask: undefined,
              linkedProjectId: task.project_id,
              linkedProjectName: task.project_name,
            }
          : b,
      );
    });

    setHasUnsavedChanges(true);
    toast.success(`"${task.title}" ajouté`);
  }, []);

  // Mettre à jour le statut d'une tâche dans Supabase
  const updateTaskStatus = useCallback(
    async (taskId: string, status: "pending" | "in_progress" | "completed", actualHours?: number) => {
      try {
        if (!userId) return;

        const newCompleted = status === "completed";

        // 🔥 Utiliser la fonction de synchronisation globale
        const { syncTaskCompleted } = await import("@/utils/taskSync");
        const success = await syncTaskCompleted(taskId, newCompleted, userId);

        if (!success) {
          throw new Error("Échec de la synchronisation");
        }

        // Mettre à jour les heures réelles si fournies
        if (status === "completed" && actualHours) {
          await (supabase as any).from("project_todos").update({ actual_hours: actualHours }).eq("id", taskId);
        }

        // Rafraîchir le calendrier
        refreshData();

        if (status === "completed") {
          toast.success("Tâche marquée comme terminée !");
        } else {
          toast.success("Tâche réactivée");
        }
      } catch (error) {
        console.error("Erreur mise à jour tâche:", error);
        toast.error("Erreur lors de la mise à jour");
      }
    },
    [userId, refreshData],
  );

  // 🔥 Rechercher des dépenses du projet pour les blocs order
  const searchExpenses = useCallback(
    async (query: string, linkedProjectId?: string): Promise<LinkedExpense[]> => {
      if (!userId) return [];

      // 🔥 Utiliser le projet lié au bloc, sinon le projet actuel
      const targetProjectId = linkedProjectId || projectId;
      if (!targetProjectId) return [];

      // Fonction pour nettoyer les entités HTML
      const cleanHtmlEntities = (str: string | null | undefined): string => {
        if (!str) return "";
        return str
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'")
          .replace(/\s+/g, " ")
          .trim();
      };

      // 🔥 NE PLUS FILTRER ICI - le filtrage par quantité se fait dans le composant
      // Les articles peuvent être réutilisés dans plusieurs blocs tant qu'il reste de la quantité

      try {
        // 🔥 D'abord récupérer le scénario principal (est_principal) du projet ciblé
        let scenarioId: string | null = null;

        // Essayer le scénario principal
        const { data: principalScenario } = await (supabase as any)
          .from("project_scenarios")
          .select("id")
          .eq("project_id", targetProjectId)
          .eq("est_principal", true)
          .maybeSingle();

        if (principalScenario) {
          scenarioId = principalScenario.id;
          console.log("✅ Scénario principal trouvé:", scenarioId);
        } else {
          // Sinon prendre le premier scénario du projet
          const { data: anyScenario } = await (supabase as any)
            .from("project_scenarios")
            .select("id")
            .eq("project_id", targetProjectId)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (anyScenario) {
            scenarioId = anyScenario.id;
            console.log("⚠️ Pas de scénario principal, utilisation du premier:", scenarioId);
          }
        }

        if (!scenarioId) {
          console.log("❌ Aucun scénario trouvé pour le projet", targetProjectId);
          return [];
        }

        console.log("🔍 Recherche dépenses dans scénario:", scenarioId);

        // 🔥 Construire la requête en filtrant par scenario_id
        let queryBuilder = (supabase as any)
          .from("project_expenses")
          .select(
            `
            id,
            nom_accessoire,
            marque,
            prix,
            quantite,
            categorie,
            fournisseur,
            statut_livraison,
            date_achat,
            expected_delivery_date,
            project_id,
            scenario_id,
            projects (
              name,
              nom
            )
          `,
          )
          .eq("scenario_id", scenarioId); // 🔥 Filtrer par scenario_id !

        // Si recherche active, filtrer par nom
        if (query.length >= 2) {
          queryBuilder = queryBuilder.ilike("nom_accessoire", `%${query}%`);
        }

        const { data: expenses, error } = await queryBuilder.order("created_at", { ascending: false }).limit(50);

        if (error) {
          console.error("Erreur requête dépenses:", error);
          throw error;
        }

        console.log("📦 Dépenses trouvées:", expenses?.length || 0);

        // 🔥 Retourner TOUS les articles - le filtrage par quantité restante se fait dans le composant
        return (expenses || []).map((expense: any) => ({
          id: expense.id,
          nom: cleanHtmlEntities(expense.nom_accessoire),
          marque: cleanHtmlEntities(expense.marque),
          prix: expense.prix || 0,
          quantite: expense.quantite || 1,
          categorie: expense.categorie,
          fournisseur: expense.fournisseur,
          statut_livraison: expense.statut_livraison || "a_commander",
          date_achat: expense.date_achat,
          expected_delivery_date: expense.expected_delivery_date,
          project_id: expense.project_id,
          project_name: cleanHtmlEntities(expense.projects?.name || expense.projects?.nom),
        }));
      } catch (error) {
        console.error("Erreur recherche dépenses:", error);
        return [];
      }
    },
    [userId, projectId, blocks],
  );

  // Lier une dépense à un bloc order
  const linkExpense = useCallback(async (blockId: string, expense: LinkedExpense) => {
    setBlocks((prevBlocks) => {
      const currentBlock = prevBlocks.find((b) => b.id === blockId);
      if (!currentBlock) return prevBlocks;

      const existingExpenses = currentBlock.linkedExpenses || [];

      // Vérifier si la dépense n'est pas déjà dans la liste
      if (existingExpenses.some((e) => e.id === expense.id)) {
        toast.error("Cet article est déjà dans la liste");
        return prevBlocks;
      }

      const newLinkedExpenses = [...existingExpenses, expense];

      return prevBlocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              linkedExpenses: newLinkedExpenses,
              linkedProjectId: expense.project_id,
              linkedProjectName: expense.project_name,
            }
          : b,
      );
    });

    // 🔥 Marquer l'article comme "en suivi de commande" dans Supabase
    if (expense.id) {
      await (supabase as any)
        .from("project_expenses")
        .update({
          in_order_tracking: true,
          statut_livraison: expense.statut_livraison || "a_commander",
        })
        .eq("id", expense.id);
    }

    setHasUnsavedChanges(true);
    toast.success(`"${expense.nom}" ajouté au suivi`);
  }, []);

  // Mettre à jour une dépense dans Supabase
  const updateExpense = useCallback(
    async (expenseId: string, updates: Partial<LinkedExpense>) => {
      try {
        // Préparer les champs à mettre à jour dans Supabase
        const supabaseUpdates: Record<string, any> = {};

        if (updates.fournisseur !== undefined) supabaseUpdates.fournisseur = updates.fournisseur;
        if (updates.statut_livraison !== undefined) supabaseUpdates.statut_livraison = updates.statut_livraison;
        if (updates.date_achat !== undefined) supabaseUpdates.date_achat = updates.date_achat || null;
        if (updates.expected_delivery_date !== undefined)
          supabaseUpdates.expected_delivery_date = updates.expected_delivery_date || null;

        if (Object.keys(supabaseUpdates).length > 0) {
          const { error } = await (supabase as any)
            .from("project_expenses")
            .update(supabaseUpdates)
            .eq("id", expenseId);

          if (error) throw error;
        }

        // Rafraîchir pour la sidebar
        refreshData();
      } catch (error) {
        console.error("Erreur mise à jour dépense:", error);
        toast.error("Erreur lors de la mise à jour");
      }
    },
    [refreshData],
  );

  // Envoyer un bloc task vers la sidebar Tâches (crée une tâche SANS catégorie)
  const sendToSidebarTask = useCallback(
    async (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId);
      const tasks = block?.linkedTasks || (block?.linkedTask ? [block.linkedTask] : []);

      if (!block || block.type !== "task" || tasks.length === 0 || !userId || !projectId) {
        toast.error("Impossible d'envoyer ces tâches");
        return;
      }

      try {
        // Créer une tâche pour chaque tâche liée
        for (const task of tasks) {
          const { error } = await (supabase as any).from("project_todos").insert({
            project_id: projectId,
            user_id: userId,
            title: task.title,
            description: task.description || null,
            completed: false,
            due_date: block.targetDate || null, // Utilise la date cible si définie
            // PAS de category_id → apparaît dans la sidebar
          });

          if (error) throw error;
        }

        toast.success(`${tasks.length} tâche(s) ajoutée(s) à la sidebar`);
      } catch (error) {
        console.error("Erreur envoi vers sidebar:", error);
        toast.error("Erreur lors de l'envoi");
      }
    },
    [blocks, userId, projectId],
  );

  // Envoyer un bloc texte vers la sidebar Notes
  const sendToSidebarNote = useCallback(
    async (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block || block.type !== "text" || !block.content || !userId || !projectId) {
        toast.error("Impossible d'envoyer cette note");
        return;
      }

      try {
        // Extraire un titre depuis le contenu (première ligne ou premiers mots)
        const content = block.content as string;
        const lines = content.split("\n").filter((l) => l.trim());
        const title = lines[0]?.substring(0, 100) || `Note du ${format(selectedDate, "d MMMM yyyy", { locale: fr })}`;
        const noteContent = lines.slice(1).join("\n") || content;

        // Créer une note dans project_notes
        const { error } = await (supabase as any).from("project_notes").insert({
          project_id: projectId,
          user_id: userId,
          title: title,
          content: noteContent,
          archived: false,
        });

        if (error) throw error;

        toast.success(`Note "${title.substring(0, 30)}..." ajoutée à la sidebar`);
      } catch (error) {
        console.error("Erreur envoi vers sidebar:", error);
        toast.error("Erreur lors de l'envoi");
      }
    },
    [blocks, userId, projectId, selectedDate],
  );

  // Créer une note rapide directement dans la sidebar
  const createQuickNote = useCallback(async () => {
    if (!quickNoteTitle.trim() || !userId || !projectId) {
      toast.error("Le titre est requis");
      return;
    }

    try {
      const { error } = await (supabase as any).from("project_notes").insert({
        project_id: projectId,
        user_id: userId,
        title: quickNoteTitle.trim(),
        content: quickNoteContent.trim() || null,
        archived: false,
      });

      if (error) throw error;

      toast.success(`Note "${quickNoteTitle.substring(0, 30)}${quickNoteTitle.length > 30 ? "..." : ""}" créée`);
      setQuickNoteTitle("");
      setQuickNoteContent("");
      setShowQuickNote(false);
    } catch (error) {
      console.error("Erreur création note:", error);
      toast.error("Erreur lors de la création");
    }
  }, [quickNoteTitle, quickNoteContent, userId, projectId]);

  // 🔥 Charger les projets disponibles avec scénario principal
  const loadAvailableProjectsForPurchase = useCallback(async () => {
    if (!userId) return;

    const { data: projects } = await supabase
      .from("projects")
      .select("id, nom_projet, nom_proprietaire")
      .eq("user_id", userId);

    if (!projects) return;

    const projectsWithScenario: { id: string; name: string; scenarioId: string }[] = [];

    for (const project of projects) {
      const { data: scenario } = await (supabase as any)
        .from("project_scenarios")
        .select("id")
        .eq("project_id", project.id)
        .eq("est_principal", true)
        .maybeSingle();

      if (scenario) {
        projectsWithScenario.push({
          id: project.id,
          name: project.nom_projet || project.nom_proprietaire || "Projet sans nom",
          scenarioId: scenario.id,
        });
      }
    }

    setAvailableProjectsForPurchase(projectsWithScenario);

    // Sélectionner le projet actuel par défaut s'il est dans la liste
    const currentInList = projectsWithScenario.find((p) => p.id === projectId);
    if (currentInList) {
      setSelectedProjectForPurchase(currentInList.id);
    } else if (projectsWithScenario.length > 0) {
      setSelectedProjectForPurchase(projectsWithScenario[0].id);
    }
  }, [userId, projectId]);

  // Charger les projets quand le dialog d'achat s'ouvre
  useEffect(() => {
    if (showQuickPurchase) {
      loadAvailableProjectsForPurchase();
    }
  }, [showQuickPurchase, loadAvailableProjectsForPurchase]);

  // 🔥 Ajouter un achat rapide au projet sélectionné + créer un bloc
  const addQuickPurchase = useCallback(async () => {
    if (!quickPurchaseName.trim()) {
      toast.error("Veuillez saisir un nom d'article");
      return;
    }

    if (!userId) {
      toast.error("Non connecté");
      return;
    }

    // Trouver le projet et scénario sélectionnés
    const selectedProject = availableProjectsForPurchase.find((p) => p.id === selectedProjectForPurchase);
    if (!selectedProject) {
      toast.error("Veuillez sélectionner un projet");
      return;
    }

    setIsAddingPurchase(true);

    try {
      // Créer la dépense dans le projet sélectionné
      const { data: newExpense, error } = await (supabase as any)
        .from("project_expenses")
        .insert({
          project_id: selectedProject.id,
          scenario_id: selectedProject.scenarioId,
          user_id: userId,
          nom_accessoire: quickPurchaseName.trim(),
          marque: quickPurchaseBrand.trim() || null,
          prix: parseFloat(quickPurchasePrice) || 0,
          quantite: parseInt(quickPurchaseQuantity) || 1,
          fournisseur: quickPurchaseSupplier.trim() || null,
          categorie: quickPurchaseCategory || "Achats généraux",
          statut_livraison: "a_commander",
          in_order_tracking: true, // 🔥 Marquer comme en suivi
          date_achat: format(new Date(), "yyyy-MM-dd"),
        })
        .select("id")
        .single();

      if (error) throw error;

      // 🔥 Créer un bloc "order" avec cette dépense liée
      const newBlock: NoteBlock = {
        id: crypto.randomUUID(),
        type: "order",
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 100,
        width: 350,
        height: 150,
        content: {
          title: quickPurchaseCategory || "Nouvel achat",
        },
        linkedExpenses: [
          {
            id: newExpense.id,
            nom: quickPurchaseName.trim(),
            marque: quickPurchaseBrand.trim() || undefined,
            prix: parseFloat(quickPurchasePrice) || 0,
            quantite: parseInt(quickPurchaseQuantity) || 1,
            categorie: quickPurchaseCategory || "Achats généraux",
            fournisseur: quickPurchaseSupplier.trim() || undefined,
            statut_livraison: "a_commander",
            date_achat: format(new Date(), "yyyy-MM-dd"),
            project_id: selectedProject.id,
            project_name: selectedProject.name,
          },
        ],
        linkedProjectId: selectedProject.id,
        linkedProjectName: selectedProject.name,
      };

      setBlocks((prev) => [...prev, newBlock]);

      toast.success(`Article ajouté au projet "${selectedProject.name}"`);

      // Réinitialiser le formulaire
      setQuickPurchaseName("");
      setQuickPurchaseBrand("");
      setQuickPurchasePrice("");
      setQuickPurchaseQuantity("1");
      setQuickPurchaseSupplier("");
      setQuickPurchaseCategory("Fournitures");
      setShowQuickPurchase(false);

      // Rafraîchir
      refreshData();
    } catch (error) {
      console.error("Erreur ajout achat:", error);
      toast.error("Erreur lors de l'ajout");
    } finally {
      setIsAddingPurchase(false);
    }
  }, [
    quickPurchaseName,
    quickPurchaseBrand,
    quickPurchasePrice,
    quickPurchaseQuantity,
    quickPurchaseSupplier,
    quickPurchaseCategory,
    userId,
    availableProjectsForPurchase,
    selectedProjectForPurchase,
    refreshData,
  ]);

  // Copier un bloc vers une autre date (roadmap)
  const [isMovingBlock, setIsMovingBlock] = useState(false);

  const moveBlockToDate = useCallback(
    async (blockId: string, targetDate: string) => {
      // Protection contre les doubles appels
      if (isMovingBlock) {
        return;
      }

      const block = blocks.find((b) => b.id === blockId);
      if (!block || !userId) return;

      // Vérifier si le bloc a déjà été replanifié vers cette date
      if (block.rescheduledTo === targetDate) {
        toast.info("Ce bloc est déjà planifié pour cette date");
        return;
      }

      setIsMovingBlock(true);
      const currentDateStr = format(selectedDate, "yyyy-MM-dd");

      try {
        // 1. Charger ou créer la note de la date cible (GLOBAL)
        const { data: targetNote, error: fetchError } = await (supabase as any)
          .from("daily_notes")
          .select("*")
          .eq("user_id", userId)
          .eq("note_date", targetDate)
          .maybeSingle();

        if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

        // 2. Préparer le bloc pour la nouvelle date AVEC les tâches liées
        const blockForTarget: NoteBlock = {
          ...block,
          id: crypto.randomUUID(), // Nouveau ID
          x: 100 + Math.random() * 100,
          y: 100 + Math.random() * 100,
          targetDate: undefined, // Retirer la date cible
          rescheduledTo: undefined, // La copie n'est pas reportée
          sourceDate: currentDateStr, // Marquer la date d'origine (roadmap)
          sourceBlockId: block.id, // Référence vers le bloc original pour sync
          // 🔥 GARDER les tâches liées dans la copie
          linkedTasks: block.linkedTasks,
          linkedTask: block.linkedTask,
        };

        // 2b. Mettre à jour scheduled_date des tâches vers la NOUVELLE date
        const linkedTasks = block.linkedTasks || (block.linkedTask ? [block.linkedTask] : []);
        if (linkedTasks.length > 0) {
          const taskIds = linkedTasks.map((t) => t.id);

          // 🔥 Vérifier si la date cible est dans le passé (avant aujourd'hui)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const targetDateObj = parseISO(targetDate);
          const isPastDate = targetDateObj < today;

          if (isPastDate) {
            // 🔥 Date passée → Marquer les tâches comme complétées
            await (supabase as any)
              .from("project_todos")
              .update({
                scheduled_date: targetDate,
                completed: true,
                completed_at: new Date().toISOString(),
              })
              .in("id", taskIds);

            // Mettre à jour aussi dans le bloc copié
            blockForTarget.taskStatus = "completed";
            if (blockForTarget.linkedTasks) {
              blockForTarget.linkedTasks = blockForTarget.linkedTasks.map((t) => ({ ...t, completed: true }));
            }
            if (blockForTarget.linkedTask) {
              blockForTarget.linkedTask = { ...blockForTarget.linkedTask, completed: true };
            }

            console.log("✅ Tâches auto-complétées (date passée:", targetDate, ") pour", taskIds.length, "tâches");
            toast.info("Tâches marquées comme terminées (date passée)");
          } else {
            // Date future ou aujourd'hui → juste mettre à jour scheduled_date
            await (supabase as any).from("project_todos").update({ scheduled_date: targetDate }).in("id", taskIds);
            console.log("📅 scheduled_date mis à jour vers", targetDate, "pour", taskIds.length, "tâches");
          }
        }

        // 3. Récupérer les blocs existants de la date cible
        let targetBlocks: NoteBlock[] = [];
        if (targetNote?.blocks_data) {
          try {
            targetBlocks = JSON.parse(targetNote.blocks_data);
          } catch {}
        }

        // Vérifier qu'on n'a pas déjà copié ce bloc vers cette date
        const alreadyCopied = targetBlocks.some((b) => b.sourceBlockId === block.id);
        if (alreadyCopied) {
          toast.info("Ce bloc existe déjà à cette date");
          setIsMovingBlock(false);
          return;
        }

        targetBlocks.push(blockForTarget);

        // 4. Sauvegarder dans la date cible
        if (targetNote) {
          await (supabase as any)
            .from("daily_notes")
            .update({
              blocks_data: JSON.stringify(targetBlocks),
              updated_at: new Date().toISOString(),
            })
            .eq("id", targetNote.id);
        } else {
          await (supabase as any).from("daily_notes").insert({
            project_id: projectId,
            user_id: userId,
            note_date: targetDate,
            blocks_data: JSON.stringify(targetBlocks),
          });
        }

        // 5. Marquer le bloc original comme "reporté" et SAUVEGARDER IMMÉDIATEMENT

        // 🔥 Vérifier si la date cible est dans le passé
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDateObj = parseISO(targetDate);
        const isPastDate = targetDateObj < today;

        // Mettre à jour le state local - inclure le statut completed si date passée
        const updatedOriginalBlocks = blocks.map((b) => {
          if (b.id === blockId) {
            const updatedBlock: NoteBlock = { ...b, rescheduledTo: targetDate };

            // 🔥 Si date passée, marquer aussi le bloc original comme complété
            if (isPastDate) {
              updatedBlock.taskStatus = "completed";
              if (updatedBlock.linkedTasks) {
                updatedBlock.linkedTasks = updatedBlock.linkedTasks.map((t) => ({ ...t, completed: true }));
              }
              if (updatedBlock.linkedTask) {
                updatedBlock.linkedTask = { ...updatedBlock.linkedTask, completed: true };
              }
            }

            return updatedBlock;
          }
          return b;
        });
        setBlocks(updatedOriginalBlocks);

        // Sauvegarder immédiatement dans Supabase (ne pas attendre l'auto-save)
        const { data: currentNote } = await (supabase as any)
          .from("daily_notes")
          .select("id")
          .eq("user_id", userId)
          .eq("note_date", currentDateStr)
          .maybeSingle();

        if (currentNote) {
          // Mettre à jour la note existante
          await (supabase as any)
            .from("daily_notes")
            .update({
              blocks_data: JSON.stringify(updatedOriginalBlocks),
              updated_at: new Date().toISOString(),
            })
            .eq("id", currentNote.id);
        } else {
          // Créer la note si elle n'existe pas encore (avec project_id pour rétrocompat)
          await (supabase as any).from("daily_notes").insert({
            project_id: projectId,
            user_id: userId,
            note_date: currentDateStr,
            blocks_data: JSON.stringify(updatedOriginalBlocks),
          });
        }

        // Forcer ReactFlow à recalculer
        blocksIdsRef.current = "";

        // 6. Mettre à jour les roadmapDates pour les deux dates (origine et cible)
        setRoadmapDates((prev) => {
          const newSet = new Set(prev);
          newSet.add(currentDateStr); // Date d'origine (a un bloc replanifié)
          newSet.add(targetDate); // Date cible (a une copie)
          return newSet;
        });

        toast.success(`Bloc copié vers le ${format(parseISO(targetDate), "d MMMM", { locale: fr })}`, {
          description: "Cliquez sur le rappel pour revenir à l'original",
        });

        // 🔥 Rafraîchir le calendrier mensuel
        refreshData();
      } catch (error) {
        console.error("Erreur copie bloc:", error);
        toast.error("Erreur lors de la copie");
      } finally {
        setIsMovingBlock(false);
      }
    },
    [blocks, userId, projectId, selectedDate, updateBlockWithSync, isMovingBlock, refreshData],
  );

  // 🔥 Planifier une tâche individuelle pour une autre date
  const moveTaskToDate = useCallback(
    async (task: LinkedTask, targetDate: string) => {
      if (!userId) return;

      try {
        // 1. Charger ou créer la note de la date cible
        const { data: targetNote, error: fetchError } = await (supabase as any)
          .from("daily_notes")
          .select("*")
          .eq("user_id", userId)
          .eq("note_date", targetDate)
          .maybeSingle();

        if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

        // 2. Créer un nouveau bloc task avec juste cette tâche
        const newBlock: NoteBlock = {
          id: crypto.randomUUID(),
          type: "task",
          x: 100 + Math.random() * 100,
          y: 100 + Math.random() * 100,
          width: 280,
          height: 100,
          content: "",
          style: { backgroundColor: "#ffffff" },
          linkedTasks: [{ ...task, scheduled_date: targetDate }],
          linkedProjectId: task.project_id,
          linkedProjectName: task.project_name,
        };

        // 3. Vérifier si c'est une date passée
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDateObj = parseISO(targetDate);
        const isPastDate = targetDateObj < today;

        // 4. Mettre à jour scheduled_date de la tâche dans Supabase
        if (isPastDate) {
          await (supabase as any)
            .from("project_todos")
            .update({
              scheduled_date: targetDate,
              completed: true,
              completed_at: new Date().toISOString(),
            })
            .eq("id", task.id);

          newBlock.linkedTasks = [{ ...task, scheduled_date: targetDate, completed: true }];
          toast.info("Tâche marquée comme terminée (date passée)");
        } else {
          await (supabase as any).from("project_todos").update({ scheduled_date: targetDate }).eq("id", task.id);
        }

        // 5. Récupérer les blocs existants de la date cible
        let targetBlocks: NoteBlock[] = [];
        if (targetNote?.blocks_data) {
          try {
            targetBlocks = JSON.parse(targetNote.blocks_data);
          } catch {}
        }

        targetBlocks.push(newBlock);

        // 6. Sauvegarder dans la date cible
        if (targetNote) {
          await (supabase as any)
            .from("daily_notes")
            .update({
              blocks_data: JSON.stringify(targetBlocks),
              updated_at: new Date().toISOString(),
            })
            .eq("id", targetNote.id);
        } else {
          await (supabase as any).from("daily_notes").insert({
            project_id: projectId,
            user_id: userId,
            note_date: targetDate,
            blocks_data: JSON.stringify(targetBlocks),
          });
        }

        // 7. Mettre à jour roadmapDates
        setRoadmapDates((prev) => {
          const newSet = new Set(prev);
          newSet.add(targetDate);
          return newSet;
        });

        toast.success(`Tâche planifiée pour le ${format(parseISO(targetDate), "d MMMM", { locale: fr })}`);
        refreshData();
      } catch (error) {
        console.error("Erreur planification tâche:", error);
        toast.error("Erreur lors de la planification");
      }
    },
    [userId, projectId, refreshData],
  );

  // ============================================
  // SYNC REACTFLOW NODES
  // ============================================

  // Mettre à jour les indicateurs roadmap quand les blocs changent
  useEffect(() => {
    // Vérifier si la date actuelle a des blocs avec des liens (copie ou original)
    const hasLinkedBlocks = blocks.some((b) => b.sourceDate || b.rescheduledTo);
    const currentDateStr = format(selectedDate, "yyyy-MM-dd");

    setRoadmapDates((prev) => {
      const newSet = new Set(prev);
      if (hasLinkedBlocks) {
        newSet.add(currentDateStr);
      }
      // Ne PAS supprimer - loadRoadmapDates gère la liste complète
      return newSet;
    });
  }, [blocks, selectedDate]);

  // 🔥 Calculer les quantités utilisées globalement sur TOUS les blocs
  const globalUsedQuantities = useMemo(() => {
    const used = new Map<string, number>();
    blocks.forEach((block) => {
      if (block.linkedExpenses) {
        block.linkedExpenses.forEach((expense) => {
          const qty = expense.quantiteBloc !== undefined ? expense.quantiteBloc : expense.quantite;
          const current = used.get(expense.id) || 0;
          used.set(expense.id, current + qty);
        });
      }
    });
    return used;
  }, [blocks]);

  // 🔥 v3.2a - Sync refs stables avec les callbacks actuels (à chaque render)
  // Ceci ne déclenche PAS de re-render, les refs sont synchrones
  stableCallbacksRef.current = {
    updateBlockWithSync,
    deleteBlock,
    handleImageUpload,
    moveBlockToDate,
    moveTaskToDate,
    searchTasks,
    linkTask,
    updateTaskStatus,
    sendToSidebarTask,
    sendToSidebarNote,
    searchExpenses,
    linkExpense,
    updateExpense,
    setSelectedDate,
  };

  // 🔥 v3.2a - Recréer les nodes UNIQUEMENT quand blocks/données changent
  // Les callbacks sont accédés via stableCallbacksRef pour ne PAS être des dépendances
  useEffect(() => {
    console.log("[DailyNotesCanvas v3.2a] Sync nodes:", blocks.length, "blocs");
    const cbs = stableCallbacksRef.current;

    const newNodes = blocks.map((block) => ({
      id: block.id,
      type: "customBlock",
      position: { x: block.x, y: block.y },
      data: {
        block: { ...block },
        onUpdate: (updates: Partial<NoteBlock>) => cbs.updateBlockWithSync(block.id, updates),
        onDelete: () => cbs.deleteBlock(block.id),
        onImageUpload: (file: File) => cbs.handleImageUpload(block.id, file),
        onMoveToDate: (targetDate: string) => cbs.moveBlockToDate(block.id, targetDate),
        onMoveTaskToDate: (task: LinkedTask, targetDate: string) => cbs.moveTaskToDate(task, targetDate),
        onNavigateToDate: (date: string) => cbs.setSelectedDate(parseISO(date)),
        onSearchTasks: (query: string, linkedProjectId?: string) => cbs.searchTasks(query, linkedProjectId),
        onLinkTask: (task: AvailableTask) => cbs.linkTask(block.id, task),
        onUpdateTaskStatus: (taskId: string, status: "pending" | "in_progress" | "completed", actualHours?: number) =>
          cbs.updateTaskStatus(taskId, status, actualHours),
        onSendToSidebarTask: () => cbs.sendToSidebarTask(block.id),
        onSendToSidebarNote: () => cbs.sendToSidebarNote(block.id),
        // 🔥 Props pour les dépenses/commandes
        onSearchExpenses: (query: string, linkedProjectId?: string) => cbs.searchExpenses(query, linkedProjectId),
        onLinkExpense: (expense: LinkedExpense) => cbs.linkExpense(block.id, expense),
        onUpdateExpense: (expenseId: string, updates: Partial<LinkedExpense>) =>
          cbs.updateExpense(expenseId, updates),
        globalUsedQuantities, // 🔥 Passer les quantités globales
        suppliers,
        projects,
        currentProjectId: projectId,
      } as CustomBlockData,
      // 🔥 Zone de travail TOUJOURS en arrière-plan (zIndex: -1), autres blocs au-dessus (zIndex: 10)
      style: {
        // Pour les zones: width fixe. Pour order: width fixe pour wrap le texte. Pour les autres: minWidth
        ...(block.type === "zone"
          ? { width: block.width, height: block.height }
          : block.type === "order"
            ? { width: block.width || 320 } // Largeur fixe pour order
            : { minWidth: block.width || 200 }),
        // Forcer la zone à rester derrière même quand sélectionnée
        zIndex: block.type === "zone" ? -1 : undefined,
      },
      zIndex: block.type === "zone" ? -1 : 10,
      // 🔥 Zones verrouillées ne peuvent pas être déplacées
      draggable: block.type === "zone" && block.isLocked ? false : true,
    })) as any;

    setNodes(newNodes);
  }, [
    blocks,
    setNodes,
    globalUsedQuantities,
    suppliers,
    projects,
    projectId,
  ]);

  // Sync edges
  useEffect(() => {
    setFlowEdges(
      edges.map((edge) => {
        const isSelected = edge.id === selectedEdgeId;
        const edgeColor = edge.color || "#64748b";
        return {
          id: edge.id,
          source: edge.source_block_id,
          target: edge.target_block_id,
          sourceHandle: edge.source_handle || undefined,
          targetHandle: edge.target_handle || undefined,
          type: "smoothstep",
          animated: edge.animated || false,
          label: edge.label,
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
          style: {
            strokeWidth: isSelected ? 4 : 2,
            stroke: edgeColor,
            filter: isSelected ? "drop-shadow(0 0 4px rgba(59, 130, 246, 0.8))" : undefined,
          },
          selected: isSelected,
        };
      }) as any,
    );
  }, [edges, setFlowEdges, selectedEdgeId]);

  // Handle node position changes
  const handleNodesChange = useCallback(
    (changes: any) => {
      // 🔥 Détecter si une zone avec contenu figé est déplacée
      const zoneMovements: { zoneId: string; deltaX: number; deltaY: number; zone: NoteBlock }[] = [];

      changes.forEach((change: any) => {
        if (change.type === "position" && change.position) {
          const movingBlock = blocks.find((b) => b.id === change.id);

          if (movingBlock?.type === "zone" && movingBlock.isContentLocked) {
            if (change.dragging) {
              // 🔥 Utiliser la ref pour tracker la dernière position (évite le décalage)
              const lastPos = lastZonePositionsRef.current.get(change.id) || { x: movingBlock.x, y: movingBlock.y };

              const deltaX = change.position.x - lastPos.x;
              const deltaY = change.position.y - lastPos.y;

              // Mettre à jour la ref avec la nouvelle position
              lastZonePositionsRef.current.set(change.id, { x: change.position.x, y: change.position.y });

              if (deltaX !== 0 || deltaY !== 0) {
                zoneMovements.push({ zoneId: movingBlock.id, deltaX, deltaY, zone: movingBlock });
              }
            } else {
              // Drag terminé - nettoyer la ref
              lastZonePositionsRef.current.delete(change.id);
            }
          }
        }
      });

      // 🔥 Filtrer les changements de position pour contraindre les blocs aux zones
      const constrainedChanges = changes.map((change: any) => {
        if (change.type === "position" && change.position) {
          // Trouver le bloc qui est déplacé
          const movingBlock = blocks.find((b) => b.id === change.id);
          if (!movingBlock) return change;

          // Si c'est une zone, on ne contraint pas
          if (movingBlock.type === "zone") return change;

          // Si le bloc est lié à un projet, vérifier s'il y a une zone pour ce projet
          if (movingBlock.linkedProjectId) {
            const targetZone = blocks.find(
              (b) => b.type === "zone" && b.zoneLinkedProjectId === movingBlock.linkedProjectId,
            );

            if (targetZone) {
              // Contraindre le bloc à rester dans la zone
              const zoneX = targetZone.x;
              const zoneY = targetZone.y + 40; // +40 pour le header
              const zoneWidth = targetZone.width || 400;
              const zoneHeight = (targetZone.height || 300) - 40;
              const blockWidth = movingBlock.width || 200;
              const blockHeight = movingBlock.height || 100;

              // Marges intérieures
              const margin = 10;

              // Contraindre la position
              const constrainedX = Math.max(
                zoneX + margin,
                Math.min(change.position.x, zoneX + zoneWidth - blockWidth - margin),
              );
              const constrainedY = Math.max(
                zoneY + margin,
                Math.min(change.position.y, zoneY + zoneHeight - blockHeight - margin),
              );

              return {
                ...change,
                position: { x: constrainedX, y: constrainedY },
              };
            }
          }
        }
        return change;
      });

      onNodesChange(constrainedChanges);

      // Mettre à jour les positions des blocs ET gérer la liaison aux zones
      constrainedChanges.forEach((change: any) => {
        if (change.type === "position" && change.position) {
          setBlocks((prev) => {
            let updatedBlocks = prev.map((b) => {
              if (b.id !== change.id) return b;

              const updatedBlock = { ...b, x: change.position.x, y: change.position.y };

              // 🔥 Si le bloc n'est pas déjà lié à un projet, vérifier s'il est dans une zone
              if (!b.linkedProjectId && b.type !== "zone") {
                // Trouver si le bloc est maintenant dans une zone liée à un projet
                const targetZone = prev.find((zone) => {
                  if (zone.type !== "zone" || !zone.zoneLinkedProjectId) return false;

                  const zoneX = zone.x;
                  const zoneY = zone.y;
                  const zoneWidth = zone.width || 400;
                  const zoneHeight = zone.height || 300;

                  // Vérifier si le centre du bloc est dans la zone
                  const blockCenterX = change.position.x + (b.width || 200) / 2;
                  const blockCenterY = change.position.y + (b.height || 100) / 2;

                  return (
                    blockCenterX >= zoneX &&
                    blockCenterX <= zoneX + zoneWidth &&
                    blockCenterY >= zoneY &&
                    blockCenterY <= zoneY + zoneHeight
                  );
                });

                if (targetZone && targetZone.zoneLinkedProjectId) {
                  // Lier le bloc au projet de la zone
                  updatedBlock.linkedProjectId = targetZone.zoneLinkedProjectId;
                  updatedBlock.linkedProjectName = targetZone.zoneLinkedProjectName;
                  toast.success(`Bloc lié au projet ${targetZone.zoneLinkedProjectName}`);
                }
              }

              return updatedBlock;
            });

            // 🔥 Si une zone avec contenu figé a bougé, déplacer les blocs internes
            zoneMovements.forEach(({ zoneId, deltaX, deltaY }) => {
              // Trouver la zone dans l'état actuel pour avoir ses dimensions
              const currentZone = updatedBlocks.find((b) => b.id === zoneId);
              if (!currentZone) return;

              const zoneX = currentZone.x - deltaX; // Position AVANT le déplacement
              const zoneY = currentZone.y - deltaY;
              const zoneWidth = currentZone.width || 400;
              const zoneHeight = currentZone.height || 300;

              updatedBlocks = updatedBlocks.map((block) => {
                // Ne pas déplacer la zone elle-même ni les autres zones
                if (block.id === zoneId || block.type === "zone") return block;

                // Vérifier si le bloc est à l'intérieur de la zone (avant le déplacement)
                const blockCenterX = block.x + (block.width || 200) / 2;
                const blockCenterY = block.y + (block.height || 100) / 2;

                const isInside =
                  blockCenterX >= zoneX &&
                  blockCenterX <= zoneX + zoneWidth &&
                  blockCenterY >= zoneY &&
                  blockCenterY <= zoneY + zoneHeight;

                if (isInside) {
                  // Déplacer le bloc avec la zone
                  return {
                    ...block,
                    x: block.x + deltaX,
                    y: block.y + deltaY,
                  };
                }

                return block;
              });
            });

            return updatedBlocks;
          });
          setHasUnsavedChanges(true);
        }
      });
    },
    [onNodesChange, blocks],
  );

  // Handle new connection
  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;

    const newEdge: BlockEdge = {
      id: crypto.randomUUID(),
      source_block_id: connection.source,
      target_block_id: connection.target,
      source_handle: connection.sourceHandle || null,
      target_handle: connection.targetHandle || null,
      edge_type: "smoothstep",
      animated: false,
    };

    setEdges((prev) => [...prev, newEdge]);
    setHasUnsavedChanges(true);
    toast.success("Connexion créée");
  }, []);

  // Delete edge on click
  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    // 🔥 Sélectionner l'edge (double-clic pour supprimer)
    setSelectedEdgeId(edge.id);
    setSelectedBlockId(null); // Désélectionner le bloc
  }, []);

  // 🔥 Double-clic sur un edge pour le supprimer
  const handleEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setEdges((prev) => prev.filter((e) => e.id !== edge.id));
    setSelectedEdgeId(null);
    setHasUnsavedChanges(true);
    toast.success("Connexion supprimée");
  }, []);

  // 🔥 Changer la couleur de l'edge sélectionné
  const updateEdgeColor = useCallback(
    (color: string) => {
      if (!selectedEdgeId) return;
      setEdges((prev) => prev.map((e) => (e.id === selectedEdgeId ? { ...e, color } : e)));
      setHasUnsavedChanges(true);
    },
    [selectedEdgeId],
  );

  // 🔥 Supprimer l'edge sélectionné
  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    setEdges((prev) => prev.filter((e) => e.id !== selectedEdgeId));
    setSelectedEdgeId(null);
    setHasUnsavedChanges(true);
    toast.success("Connexion supprimée");
  }, [selectedEdgeId]);

  // 🔥 Supprimer l'edge sélectionné avec Delete/Backspace + Ctrl+A pour tout sélectionner
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ne pas déclencher si on est dans un input
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      // Ctrl+A : Sélectionner tous les blocs
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        const allBlockIds = blocks.map((b) => b.id);
        setSelectedBlockIds(allBlockIds);
        return;
      }

      // Ctrl+Shift+Backspace/Delete : Tout supprimer (blocs et connexions)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        if (window.confirm("Supprimer TOUS les blocs et connexions du canvas ?")) {
          setBlocks([]);
          setEdges([]);
          setSelectedBlockIds([]);
          setSelectedEdgeId(null);
        }
        return;
      }

      // Delete/Backspace : Supprimer l'edge sélectionné ou les blocs sélectionnés
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();

        // Supprimer les blocs sélectionnés
        if (selectedBlockIds.length > 0) {
          setBlocks((prev) => prev.filter((b) => !selectedBlockIds.includes(b.id)));
          setEdges((prev) =>
            prev.filter(
              (edge) =>
                !selectedBlockIds.includes(edge.source_block_id) && !selectedBlockIds.includes(edge.target_block_id),
            ),
          );
          setSelectedBlockIds([]);
          return;
        }

        // Supprimer l'edge sélectionné
        if (selectedEdgeId) {
          deleteSelectedEdge();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEdgeId, deleteSelectedEdge, blocks, selectedBlockIds]);

  // ============================================
  // PAPER.JS DRAWING
  // ============================================

  useEffect(() => {
    if (!open || !canvasRef.current) return;

    const canvas = canvasRef.current;

    // 🔥 Définir les dimensions du canvas HTML basées sur le conteneur
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        // Mettre à jour la vue Paper.js si elle existe
        if (paperScopeRef.current?.view) {
          paperScopeRef.current.view.viewSize = new paperScopeRef.current.Size(rect.width, rect.height);
        }
      }
    };

    // Initialiser les dimensions
    resizeCanvas();

    const scope = new paper.PaperScope();
    scope.setup(canvas);
    paperScopeRef.current = scope;

    // Fond transparent
    scope.view.element.style.background = "transparent";

    // Resynchroniser les dimensions après setup
    resizeCanvas();

    console.log("🎨 Paper.js initialisé - Canvas:", canvas.width, "x", canvas.height);

    // Observer les changements de taille
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    const tool = new scope.Tool();
    let currentPath: paper.Path | null = null;
    let startPoint: paper.Point | null = null;

    const saveToHistory = () => {
      const json = scope.project.exportJSON();
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(json);
      historyIndexRef.current = historyRef.current.length - 1;
      setHasUnsavedChanges(true);
    };

    tool.onMouseDown = (event: paper.ToolEvent) => {
      const toolType = activeToolRef.current;
      console.log("🖱️ Mouse down - Tool:", toolType, "Point:", event.point.x, event.point.y);
      if (toolType === "select") return;

      startPoint = event.point;

      if (toolType === "eraser") {
        const hitResult = scope.project.hitTest(event.point, {
          stroke: true,
          fill: true,
          tolerance: 10,
        });
        if (hitResult?.item) {
          hitResult.item.remove();
          saveToHistory();
        }
        return;
      }

      if (toolType === "pencil" || toolType === "line" || toolType === "arrow") {
        currentPath = new scope.Path({
          strokeColor: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
          strokeCap: "round",
        });
        currentPath.add(event.point);
      } else if (toolType === "rectangle") {
        currentPath = new scope.Path.Rectangle({
          from: event.point,
          to: event.point,
          strokeColor: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
        });
      } else if (toolType === "circle") {
        currentPath = new scope.Path.Circle({
          center: event.point,
          radius: 1,
          strokeColor: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
        });
      }
    };

    tool.onMouseDrag = (event: paper.ToolEvent) => {
      const toolType = activeToolRef.current;
      if (!currentPath || !startPoint) return;

      if (toolType === "pencil") {
        currentPath.add(event.point);
      } else if (toolType === "line" || toolType === "arrow") {
        if (currentPath.segments.length > 1) {
          currentPath.lastSegment.point = event.point;
        } else {
          currentPath.add(event.point);
        }
      } else if (toolType === "rectangle") {
        currentPath.remove();
        currentPath = new scope.Path.Rectangle({
          from: startPoint,
          to: event.point,
          strokeColor: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
        });
      } else if (toolType === "circle") {
        currentPath.remove();
        const radius = startPoint.getDistance(event.point);
        currentPath = new scope.Path.Circle({
          center: startPoint,
          radius,
          strokeColor: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
        });
      }
    };

    tool.onMouseUp = () => {
      const toolType = activeToolRef.current;

      if (toolType === "pencil" && currentPath) {
        currentPath.simplify(5);
      }

      if (toolType === "arrow" && currentPath && currentPath.segments.length === 2) {
        const start = currentPath.firstSegment.point;
        const end = currentPath.lastSegment.point;
        const vector = end.subtract(start).normalize(15);
        const center = new scope.Point(0, 0);

        const arrowHead = new scope.Path({
          strokeColor: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
          strokeCap: "round",
        });

        arrowHead.add(end.subtract(vector.rotate(30, center)));
        arrowHead.add(end);
        arrowHead.add(end.subtract(vector.rotate(-30, center)));
      }

      currentPath = null;
      saveToHistory();
    };

    tool.activate();

    return () => {
      resizeObserver.disconnect();
      if (scope.project) {
        scope.project.clear();
      }
      paperScopeRef.current = null;
    };
  }, [open]);

  // ============================================
  // LOAD / SAVE DATA
  // ============================================

  // Charger la liste des projets
  const loadProjects = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await (supabase as any)
      .from("projects")
      .select("id, nom")
      .eq("user_id", userData.user.id)
      .order("nom");

    if (!error && data) {
      // Mapper nom vers name pour l'interface
      setProjects(data.map((p: any) => ({ id: p.id, name: p.nom })));
    }
  }, []);

  // 🔥 Charger la liste des fournisseurs depuis la table suppliers
  const loadSuppliers = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Charger les fournisseurs actifs de l'utilisateur
    const { data, error } = await (supabase as any)
      .from("suppliers")
      .select("name")
      .eq("user_id", userData.user.id)
      .eq("enabled", true)
      .order("name");

    if (!error && data) {
      const supplierNames = data.map((s: any) => s.name).filter(Boolean);
      setSuppliers(supplierNames as string[]);
    }
  }, []);

  // Charger les dates qui ont des blocs avec targetDate (roadmap) et les livraisons prévues
  const loadRoadmapDates = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const dates = new Set<string>();

    // 1. Récupérer toutes les notes de l'utilisateur (GLOBAL, tous projets)
    const { data, error } = await (supabase as any)
      .from("daily_notes")
      .select("note_date, blocks_data")
      .eq("user_id", userData.user.id);

    if (!error && data) {
      data.forEach((note: any) => {
        if (note.blocks_data) {
          try {
            const blocks: NoteBlock[] = JSON.parse(note.blocks_data);
            blocks.forEach((block) => {
              // Ajouter la date cible si définie (bloc original planifié)
              if (block.rescheduledTo) {
                dates.add(block.rescheduledTo);
              }
              // Ajouter la date d'origine si c'est une copie (pour navigation inverse)
              if (block.sourceDate) {
                dates.add(block.sourceDate);
              }
              // Ajouter la date de la note si elle contient des tâches liées
              if (block.type === "task" && (block.linkedTasks?.length || block.linkedTask)) {
                dates.add(note.note_date);
              }
            });
          } catch {}
        }
      });
    }

    // 🔥 2. Récupérer les dates de livraison prévues (de TOUS les projets)
    const deliveryDatesSet = new Set<string>();

    // Récupérer tous les projets de l'utilisateur
    const { data: userProjects } = await (supabase as any)
      .from("projects")
      .select("id")
      .eq("user_id", userData.user.id);

    const projectIds = userProjects?.map((p: any) => p.id) || [];

    if (projectIds.length > 0) {
      // Récupérer tous les scénarios principaux
      const { data: scenarios } = await (supabase as any)
        .from("project_scenarios")
        .select("id")
        .in("project_id", projectIds)
        .eq("est_principal", true);

      const scenarioIds = scenarios?.map((s: any) => s.id) || [];

      if (scenarioIds.length > 0) {
        const { data: deliveries } = await (supabase as any)
          .from("project_expenses")
          .select("expected_delivery_date")
          .in("scenario_id", scenarioIds)
          .not("expected_delivery_date", "is", null);

        if (deliveries) {
          deliveries.forEach((d: any) => {
            if (d.expected_delivery_date) {
              deliveryDatesSet.add(d.expected_delivery_date);
            }
          });
        }
      }
    }

    setRoadmapDates(dates);
    setDeliveryDates(deliveryDatesSet);
  }, []); // Plus de dépendance à projectId

  // Charger les projets et fournisseurs au montage
  useEffect(() => {
    if (open) {
      loadProjects();
      loadSuppliers();
      loadRoadmapDates();
    }
  }, [open, loadProjects, loadSuppliers, loadRoadmapDates]);

  const loadDayData = useCallback(
    async (dateToLoad?: Date) => {
      setIsLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      setUserId(userData.user.id);

      // 🔥 Utiliser la date passée en paramètre ou selectedDate
      const targetDate = dateToLoad || selectedDate;
      const dateStr = format(targetDate, "yyyy-MM-dd");
      console.log("📅 loadDayData pour:", dateStr);

      try {
        // 🔥 1. Charger les notes du jour (GLOBAL à l'utilisateur, pas par projet)
        const { data, error } = await (supabase as any)
          .from("daily_notes")
          .select("*")
          .eq("user_id", userData.user.id)
          .eq("note_date", dateStr)
          .maybeSingle();

        if (error && error.code !== "PGRST116") throw error;

        let loadedBlocks: NoteBlock[] = [];

        if (data) {
          // Charger le canvas Paper.js
          if (data.canvas_data && paperScopeRef.current) {
            try {
              paperScopeRef.current.project.clear();
              paperScopeRef.current.project.importJSON(data.canvas_data);
            } catch (e) {
              console.error("Erreur chargement canvas:", e);
            }
          }

          // Charger les blocs
          if (data.blocks_data) {
            try {
              loadedBlocks = JSON.parse(data.blocks_data);
            } catch {
              loadedBlocks = [];
            }
          }

          // Charger les connexions
          if (data.connections_data) {
            try {
              setEdges(JSON.parse(data.connections_data));
            } catch {
              setEdges([]);
            }
          } else {
            setEdges([]);
          }
        } else {
          // Nouveau jour
          if (paperScopeRef.current) {
            paperScopeRef.current.project.clear();
          }
          setEdges([]);
        }

        // 🔥 2. Charger les livraisons prévues pour ce jour (de TOUS les projets)
        // Récupérer tous les scénarios principaux de l'utilisateur
        const { data: userProjects } = await (supabase as any)
          .from("projects")
          .select("id")
          .eq("user_id", userData.user.id);

        const projectIds = userProjects?.map((p: any) => p.id) || [];

        let principalScenarioIds: string[] = [];
        if (projectIds.length > 0) {
          const { data: scenarios } = await (supabase as any)
            .from("project_scenarios")
            .select("id")
            .in("project_id", projectIds)
            .eq("est_principal", true);

          principalScenarioIds = scenarios?.map((s: any) => s.id) || [];
        }

        if (principalScenarioIds.length > 0) {
          const { data: deliveries } = await (supabase as any)
            .from("project_expenses")
            .select(
              `
            id,
            nom_accessoire,
            marque,
            prix,
            quantite,
            categorie,
            fournisseur,
            statut_livraison,
            date_achat,
            expected_delivery_date,
            project_id
          `,
            )
            .in("scenario_id", principalScenarioIds)
            .eq("expected_delivery_date", dateStr);

          if (deliveries && deliveries.length > 0) {
            console.log(`📦 ${deliveries.length} livraison(s) prévue(s) pour ${dateStr}`);

            // Fonction pour nettoyer les entités HTML
            const cleanHtmlEntities = (str: string | null | undefined): string => {
              if (!str) return "";
              return str
                .replace(/&nbsp;/g, " ")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&apos;/g, "'")
                .replace(/\s+/g, " ")
                .trim();
            };

            // Récupérer les IDs des dépenses déjà dans les blocs existants
            const existingExpenseIds = new Set<string>();
            loadedBlocks.forEach((block) => {
              if (block.linkedExpenses) {
                block.linkedExpenses.forEach((exp) => {
                  if (exp.id) existingExpenseIds.add(exp.id);
                });
              }
            });

            // Filtrer les livraisons qui ne sont pas déjà dans un bloc
            const newDeliveries: LinkedExpense[] = deliveries
              .filter((d: any) => !existingExpenseIds.has(d.id))
              .map((d: any) => ({
                id: d.id,
                nom: cleanHtmlEntities(d.nom_accessoire),
                marque: cleanHtmlEntities(d.marque),
                prix: d.prix || 0,
                quantite: d.quantite || 1,
                categorie: d.categorie,
                fournisseur: d.fournisseur,
                statut_livraison: d.statut_livraison || "en_livraison",
                date_achat: d.date_achat,
                expected_delivery_date: d.expected_delivery_date,
                project_id: d.project_id,
              }));

            // S'il y a des nouvelles livraisons, chercher ou créer un bloc "Livraisons du jour"
            if (newDeliveries.length > 0) {
              // Chercher un bloc existant nommé "Livraisons du jour" ou "🚚 Livraisons"
              let deliveryBlockIndex = loadedBlocks.findIndex(
                (b) =>
                  b.type === "order" &&
                  (b.content?.title === "🚚 Livraisons du jour" || b.content?.title === "Livraisons du jour"),
              );

              if (deliveryBlockIndex >= 0) {
                // Ajouter au bloc existant
                const existingExpenses = loadedBlocks[deliveryBlockIndex].linkedExpenses || [];
                loadedBlocks[deliveryBlockIndex].linkedExpenses = [...existingExpenses, ...newDeliveries];
              } else {
                // Créer un nouveau bloc pour les livraisons
                const deliveryBlock: NoteBlock = {
                  id: `delivery-${Date.now()}`,
                  type: "order",
                  x: 50,
                  y: 50,
                  width: 350,
                  height: 200,
                  content: {
                    title: "🚚 Livraisons du jour",
                  },
                  linkedExpenses: newDeliveries,
                  linkedProjectId: projectId,
                };
                loadedBlocks = [deliveryBlock, ...loadedBlocks];
              }
            }
          }
        }

        setBlocks(loadedBlocks);
        blocksRef.current = loadedBlocks; // 🔥 Sync immédiat de la ref
        blocksIdsRef.current = "";
      } catch (error) {
        console.error("Erreur chargement:", error);
        toast.error("Erreur lors du chargement");
      } finally {
        setIsLoading(false);
        setHasUnsavedChanges(false);
      }
    },
    [selectedDate, projectId],
  );

  // Charger les données quand la date ou le dialog change
  const previousDateRef = useRef<string | null>(null);

  // 🔥 Ref pour détecter la première ouverture du chargement
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      previousDateRef.current = null;
      hasLoadedRef.current = false;
      return;
    }

    // 🔥 Utiliser initialDate lors de l'ouverture, sinon selectedDate
    const dateToUse = !hasLoadedRef.current && initialDate ? initialDate : selectedDate;
    const currentDateStr = format(dateToUse, "yyyy-MM-dd");

    // 🔥 Charger si:
    // 1. C'est la première ouverture (hasLoadedRef.current était false)
    // 2. Ou si la date a changé
    if (!hasLoadedRef.current || !previousDateRef.current || previousDateRef.current !== currentDateStr) {
      console.log("📅 Chargement des données pour:", currentDateStr, "hasLoaded:", hasLoadedRef.current);
      loadDayData(dateToUse);
      previousDateRef.current = currentDateStr;
      hasLoadedRef.current = true;
    }
  }, [selectedDate, open, initialDate, loadDayData]);

  const saveNote = useCallback(async () => {
    if (!userId) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const canvasData = paperScopeRef.current?.project.exportJSON() || null;

    // 🔥 Utiliser directement blocks et edges (pas les refs)
    const blocksData = JSON.stringify(blocks);
    const connectionsData = JSON.stringify(edges);

    const zoneCount = blocks.filter((b) => b.type === "zone").length;
    console.log("💾 Sauvegarde avec", blocks.length, "blocs dont", zoneCount, "zones");
    console.log(
      "💾 IDs des blocs:",
      blocks.map((b) => `${b.type}:${b.id.slice(0, 8)}`),
    );

    try {
      // 🔥 NOUVEAU: Mettre à jour scheduled_date des tâches liées aux blocs
      const allLinkedTaskIds: string[] = [];
      blocks.forEach((block) => {
        const tasks = block.linkedTasks || (block.linkedTask ? [block.linkedTask] : []);
        tasks.forEach((task) => {
          if (task.id && !allLinkedTaskIds.includes(task.id)) {
            allLinkedTaskIds.push(task.id);
          }
        });
      });

      if (allLinkedTaskIds.length > 0) {
        await (supabase as any).from("project_todos").update({ scheduled_date: dateStr }).in("id", allLinkedTaskIds);
        console.log("📅 scheduled_date mis à jour pour", allLinkedTaskIds.length, "tâches");
      }

      // 🔥 Mettre à jour in_order_tracking pour tous les articles des blocs order
      const allLinkedExpenseIds: string[] = [];
      blocks.forEach((block) => {
        if (block.type === "order" && block.linkedExpenses) {
          block.linkedExpenses.forEach((expense) => {
            if (expense.id && !allLinkedExpenseIds.includes(expense.id)) {
              allLinkedExpenseIds.push(expense.id);
            }
          });
        }
      });

      if (allLinkedExpenseIds.length > 0) {
        await (supabase as any)
          .from("project_expenses")
          .update({ in_order_tracking: true })
          .in("id", allLinkedExpenseIds);
        console.log("📦 in_order_tracking mis à jour pour", allLinkedExpenseIds.length, "articles");
      }

      // 🔥 Chercher une note existante par user_id + note_date (GLOBAL)
      const { data: existing } = await (supabase as any)
        .from("daily_notes")
        .select("id")
        .eq("user_id", userId)
        .eq("note_date", dateStr)
        .maybeSingle();

      if (existing) {
        await (supabase as any)
          .from("daily_notes")
          .update({
            canvas_data: canvasData,
            blocks_data: blocksData,
            connections_data: connectionsData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        // Créer avec project_id pour rétrocompatibilité
        await (supabase as any).from("daily_notes").insert({
          project_id: projectId,
          user_id: userId,
          note_date: dateStr,
          canvas_data: canvasData,
          blocks_data: blocksData,
          connections_data: connectionsData,
        });
      }

      setHasUnsavedChanges(false);
      toast.success("Notes sauvegardées");

      // 🔥 Rafraîchir le contexte pour mettre à jour le calendrier mensuel
      refreshData();
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    }
  }, [userId, selectedDate, projectId, blocks, edges, refreshData]); // 🔥 blocks et edges dans les dépendances

  // Auto-save
  useEffect(() => {
    if (!open || !hasUnsavedChanges) return;

    const timeout = setTimeout(() => {
      saveNote();
    }, 30000);

    return () => clearTimeout(timeout);
  }, [open, hasUnsavedChanges, saveNote]);

  // Undo/Redo
  const undo = useCallback(() => {
    if (historyIndexRef.current > 0 && paperScopeRef.current) {
      historyIndexRef.current--;
      paperScopeRef.current.project.clear();
      paperScopeRef.current.project.importJSON(historyRef.current[historyIndexRef.current]);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1 && paperScopeRef.current) {
      historyIndexRef.current++;
      paperScopeRef.current.project.clear();
      paperScopeRef.current.project.importJSON(historyRef.current[historyIndexRef.current]);
    }
  }, []);

  const clearCanvas = useCallback(() => {
    if (paperScopeRef.current) {
      paperScopeRef.current.project.clear();
      historyRef.current = [];
      historyIndexRef.current = -1;
      setHasUnsavedChanges(true);
    }
  }, []);

  // Navigation dates
  const goToPreviousDay = () => setSelectedDate((d) => subDays(d, 1));
  const goToNextDay = () => setSelectedDate((d) => addDays(d, 1));
  const goToToday = () => setSelectedDate(new Date());

  // Days to display (2 weeks centered on selected date)
  const visibleDays = useMemo(() => {
    // Afficher 14 jours : 7 avant et 6 après la date sélectionnée
    return Array.from({ length: 14 }, (_, i) => addDays(selectedDate, i - 7));
  }, [selectedDate]);

  // Export
  const exportAsImage = useCallback(() => {
    if (canvasRef.current) {
      const link = document.createElement("a");
      link.download = `notes-${format(selectedDate, "yyyy-MM-dd")}.png`;
      link.href = canvasRef.current.toDataURL("image/png");
      link.click();
    }
  }, [selectedDate]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-4 py-2 border-b shrink-0 pr-12">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Notes du {format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
                {hasUnsavedChanges && (
                  <Badge variant="outline" className="text-orange-500">
                    Non sauvegardé
                  </Badge>
                )}
              </DialogTitle>

              {/* Navigation */}
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPreviousDay}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      {format(selectedDate, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setIsCalendarOpen(false);
                        }
                      }}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>

                <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextDay}>
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Button variant="outline" size="sm" className="h-8" onClick={goToToday}>
                  Aujourd'hui
                </Button>
              </div>
            </div>

            {/* Jours - 2 semaines centrées */}
            <div className="flex gap-0.5 mt-2 max-w-5xl mx-auto w-full">
              {visibleDays.map((day) => {
                const dayStr = format(day, "yyyy-MM-dd");
                const hasRoadmap = roadmapDates.has(dayStr);
                const hasDelivery = deliveryDates.has(dayStr);
                const isSelected = isSameDay(day, selectedDate);
                const isMonday = day.getDay() === 1;

                return (
                  <Button
                    key={day.toISOString()}
                    variant={isSelected ? "default" : "ghost"}
                    size="sm"
                    className={`flex-1 relative px-1 h-10 min-w-0 ${isToday(day) ? "ring-2 ring-blue-300" : ""} ${isMonday && !isSelected ? "border-l-2 border-gray-300" : ""}`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <span className="text-xs leading-tight">
                      <span className={isMonday ? "font-semibold" : "text-gray-500"}>
                        {format(day, "EEEEE", { locale: fr })}
                      </span>
                      <br />
                      {format(day, "d")}
                    </span>
                    {/* Indicateur roadmap */}
                    {hasRoadmap && (
                      <div
                        className={`absolute -top-1 -right-0.5 w-2.5 h-2.5 rounded-full flex items-center justify-center ${
                          isSelected ? "bg-white" : "bg-purple-500"
                        }`}
                      >
                        <MapPin className={`h-1.5 w-1.5 ${isSelected ? "text-purple-600" : "text-white"}`} />
                      </div>
                    )}
                    {/* 🔥 Indicateur livraison prévue */}
                    {hasDelivery && (
                      <div
                        className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 ${
                          isSelected ? "text-white" : "text-orange-500"
                        }`}
                        title="Livraison prévue"
                      >
                        <Truck className="h-2.5 w-2.5" />
                      </div>
                    )}
                  </Button>
                );
              })}
            </div>
          </DialogHeader>

          {/* Toolbar */}
          <div className="px-4 py-2 border-b flex items-center gap-2 flex-wrap shrink-0 bg-gray-50">
            {/* Outils dessin */}
            <div className="flex items-center gap-1 border-r pr-2">
              <Button
                variant={activeTool === "select" ? "default" : "ghost"}
                size="icon"
                onClick={() => setActiveTool("select")}
                title="Sélection"
              >
                <MousePointer2 className="h-4 w-4" />
              </Button>
              <Button
                variant={activeTool === "pencil" ? "default" : "ghost"}
                size="icon"
                onClick={() => setActiveTool("pencil")}
                title="Crayon"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant={activeTool === "line" ? "default" : "ghost"}
                size="icon"
                onClick={() => setActiveTool("line")}
                title="Ligne"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant={activeTool === "arrow" ? "default" : "ghost"}
                size="icon"
                onClick={() => setActiveTool("arrow")}
                title="Flèche"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant={activeTool === "rectangle" ? "default" : "ghost"}
                size="icon"
                onClick={() => setActiveTool("rectangle")}
                title="Rectangle"
              >
                <Square className="h-4 w-4" />
              </Button>
              <Button
                variant={activeTool === "circle" ? "default" : "ghost"}
                size="icon"
                onClick={() => setActiveTool("circle")}
                title="Cercle"
              >
                <Circle className="h-4 w-4" />
              </Button>
              <Button
                variant={activeTool === "eraser" ? "default" : "ghost"}
                size="icon"
                onClick={() => setActiveTool("eraser")}
                title="Gomme"
              >
                <Eraser className="h-4 w-4" />
              </Button>
            </div>

            {/* Couleur */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" title="Couleur">
                  <div className="w-4 h-4 rounded border" style={{ backgroundColor: strokeColor }} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto">
                <div className="grid grid-cols-5 gap-1">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      className={`w-6 h-6 rounded border-2 ${
                        strokeColor === color ? "border-blue-500" : "border-gray-200"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setStrokeColor(color)}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Épaisseur */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  {strokeWidth}px
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48">
                <div className="space-y-2">
                  <span className="text-sm">Épaisseur: {strokeWidth}px</span>
                  <Slider value={[strokeWidth]} onValueChange={([v]) => setStrokeWidth(v)} min={1} max={12} step={1} />
                </div>
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="h-6" />

            {/* Ajouter blocs - Boutons individuels */}
            <div className="flex items-center gap-1 border-r pr-2">
              <Button variant="outline" size="icon" onClick={() => addBlock("text")} title="Bloc Texte">
                <Type className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => addBlock("checklist")} title="Checklist">
                <CheckSquare className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => addBlock("list")} title="Liste">
                <List className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => addBlock("table")} title="Tableau">
                <Table className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => addBlock("image")} title="Image">
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => addBlock("task")}
                title="Tâche de travaux"
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              >
                <Wrench className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => addBlock("order")}
                title="Suivi commandes"
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                <Package className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => addBlock("supplier")}
                title="Fournisseurs"
                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
              >
                <Store className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => addBlock("zone")}
                title="Zone de travail (pour regrouper des blocs)"
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              {/* 🔥 Bouton ajout achat rapide */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowQuickPurchase(true)}
                title="Ajouter un achat (fournitures, consommables...)"
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <Plus className="h-4 w-4" />
              </Button>

              {/* Note rapide → Sidebar */}
              <Popover open={showQuickNote} onOpenChange={setShowQuickNote}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Note rapide (sidebar)"
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <StickyNote className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <div className="space-y-3">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <StickyNote className="h-4 w-4 text-green-600" />
                      Nouvelle note (sidebar)
                    </div>
                    <Input
                      placeholder="Titre de la note..."
                      value={quickNoteTitle}
                      onChange={(e) => setQuickNoteTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && quickNoteTitle.trim()) {
                          createQuickNote();
                        }
                      }}
                      autoFocus
                    />
                    <Textarea
                      placeholder="Contenu (optionnel)..."
                      value={quickNoteContent}
                      onChange={(e) => setQuickNoteContent(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={createQuickNote} disabled={!quickNoteTitle.trim()} className="flex-1">
                        <StickyNote className="h-4 w-4 mr-1" />
                        Créer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowQuickNote(false);
                          setQuickNoteTitle("");
                          setQuickNoteContent("");
                        }}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Actions */}
            <Button variant="ghost" size="icon" onClick={undo} title="Annuler">
              <Undo className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={redo} title="Rétablir">
              <Redo className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={clearCanvas} title="Effacer dessin">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (blocks.length === 0 && edges.length === 0) {
                  toast.info("Le canvas est déjà vide");
                  return;
                }
                if (window.confirm(`Supprimer tous les blocs (${blocks.length}) et connexions (${edges.length}) ?`)) {
                  setBlocks([]);
                  setEdges([]);
                  setSelectedBlockIds([]);
                  setSelectedEdgeId(null);
                  clearCanvas(); // Aussi effacer le dessin
                  toast.success("Canvas vidé");
                }
              }}
              title="Tout supprimer (Ctrl+Shift+Suppr)"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <XCircle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={exportAsImage} title="Exporter">
              <Download className="h-4 w-4" />
            </Button>

            <div className="flex-1" />

            <Button onClick={saveNote} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Sauvegarder
            </Button>
          </div>

          {/* Canvas + ReactFlow */}
          <div className="flex-1 relative overflow-hidden">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-white">
                {/* ReactFlow (base - toujours visible) */}
                <div className="absolute inset-0" style={{ zIndex: 1 }} ref={reactFlowContainerRef}>
                  <ReactFlow
                    nodes={nodes}
                    edges={flowEdges}
                    onNodesChange={handleNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={handleConnect}
                    onEdgeClick={handleEdgeClick}
                    onEdgeDoubleClick={handleEdgeDoubleClick}
                    onPaneClick={() => setSelectedEdgeId(null)} // 🔥 Clic sur le fond désélectionne
                    nodeTypes={nodeTypes}
                    connectionMode={ConnectionMode.Loose}
                    deleteKeyCode={["Backspace", "Delete"]}
                    onNodesDelete={(deletedNodes) => {
                      console.log(
                        "🗑️ Nodes supprimés via clavier:",
                        deletedNodes.map((n) => n.id),
                      );
                      deletedNodes.forEach((node) => {
                        deleteBlock(node.id);
                      });
                    }}
                    fitView
                    fitViewOptions={{
                      padding: 0.2,
                      minZoom: 0.5,
                      maxZoom: 1.5,
                    }}
                    defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                    minZoom={0.2}
                    maxZoom={2}
                    onMove={(_, viewport) => {
                      viewportRef.current = viewport;
                    }}
                    onInit={(instance) => {
                      reactFlowInstanceRef.current = instance;
                    }}
                    defaultEdgeOptions={{
                      type: "smoothstep",
                      markerEnd: { type: MarkerType.ArrowClosed },
                      style: { strokeWidth: 2, stroke: "#64748b" },
                    }}
                    proOptions={{ hideAttribution: true }}
                    style={{
                      pointerEvents: activeTool === "select" ? "auto" : "none",
                    }}
                  >
                    <Background />
                    <Controls style={{ zIndex: 100 }} />
                    <MiniMap style={{ zIndex: 100 }} pannable zoomable nodeStrokeWidth={3} />

                    {/* Barre de navigation des zones */}
                    {zones.length > 0 && (
                      <Panel
                        position="top-left"
                        style={{ zIndex: 100 }}
                        key={`zones-panel-${zones.map((z) => z.id).join("-")}`}
                      >
                        <div className="bg-white/95 rounded-lg shadow-md p-2 border max-w-md">
                          <ZonesNavigationBar
                            zones={zones}
                            focusZoneId={pendingFocusZoneId}
                            onFocusComplete={() => setPendingFocusZoneId(null)}
                          />
                        </div>
                      </Panel>
                    )}

                    <Panel position="top-right" style={{ zIndex: 100 }}>
                      <div className="bg-white/90 rounded-lg shadow p-2 text-xs text-gray-600 border">
                        💡 Glissez depuis les points <span className="text-green-600 font-semibold">verts</span> vers
                        les points <span className="text-blue-600 font-semibold">bleus</span>
                      </div>
                    </Panel>

                    {/* 🔥 Panel couleur pour edge sélectionné */}
                    {selectedEdgeId && (
                      <Panel position="bottom-center" style={{ zIndex: 100 }}>
                        <div className="bg-white rounded-lg shadow-lg p-3 border flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-700">Couleur du trait:</span>
                          <div className="flex gap-1">
                            {[
                              "#64748b",
                              "#EF4444",
                              "#F97316",
                              "#EAB308",
                              "#22C55E",
                              "#3B82F6",
                              "#A855F7",
                              "#EC4899",
                              "#000000",
                            ].map((color) => (
                              <button
                                key={color}
                                className={`w-6 h-6 rounded-full border-2 transition-all ${
                                  edges.find((e) => e.id === selectedEdgeId)?.color === color ||
                                  (!edges.find((e) => e.id === selectedEdgeId)?.color && color === "#64748b")
                                    ? "border-blue-500 scale-110"
                                    : "border-gray-300 hover:scale-105"
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => updateEdgeColor(color)}
                                title={color}
                              />
                            ))}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={deleteSelectedEdge}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Supprimer
                          </Button>
                        </div>
                      </Panel>
                    )}
                  </ReactFlow>
                </div>

                {/* Paper.js Canvas (par-dessus quand on dessine) */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0"
                  style={{
                    width: "100%",
                    height: "100%",
                    touchAction: "none",
                    pointerEvents: activeTool !== "select" ? "auto" : "none",
                    zIndex: activeTool !== "select" ? 20 : 0,
                    background: "transparent",
                    cursor:
                      activeTool === "pencil"
                        ? "crosshair"
                        : activeTool === "eraser"
                          ? "not-allowed"
                          : activeTool === "select"
                            ? "default"
                            : "crosshair",
                  }}
                />

                {/* Indicateur outil actif */}
                {activeTool !== "select" && (
                  <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs shadow z-30">
                    🎨 Mode dessin:{" "}
                    {activeTool === "pencil"
                      ? "Crayon"
                      : activeTool === "line"
                        ? "Ligne"
                        : activeTool === "arrow"
                          ? "Flèche"
                          : activeTool === "rectangle"
                            ? "Rectangle"
                            : activeTool === "circle"
                              ? "Cercle"
                              : activeTool === "eraser"
                                ? "Gomme"
                                : activeTool}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Barre de style pour bloc texte */}
          {selectedBlockId && blocks.find((b) => b.id === selectedBlockId)?.type === "text" && (
            <div className="px-4 py-2 border-t bg-gray-50 flex items-center gap-4 shrink-0 flex-wrap">
              {/* Police */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Police:</span>
                <Select
                  value={blocks.find((b) => b.id === selectedBlockId)?.style?.fontFamily || FONTS[0].value}
                  onValueChange={(value) =>
                    updateBlockWithSync(selectedBlockId, {
                      style: { ...blocks.find((b) => b.id === selectedBlockId)?.style, fontFamily: value },
                    })
                  }
                >
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(
                      FONTS.reduce(
                        (acc, font) => {
                          if (!acc[font.category]) acc[font.category] = [];
                          acc[font.category].push(font);
                          return acc;
                        },
                        {} as Record<string, typeof FONTS>,
                      ),
                    ).map(([category, fonts]) => (
                      <div key={category}>
                        <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-50">{category}</div>
                        {fonts.map((font) => (
                          <SelectItem key={font.value} value={font.value}>
                            <span style={{ fontFamily: font.value }}>{font.name}</span>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Taille */}
              <Select
                value={String(blocks.find((b) => b.id === selectedBlockId)?.style?.fontSize || 14)}
                onValueChange={(value) =>
                  updateBlockWithSync(selectedBlockId, {
                    style: { ...blocks.find((b) => b.id === selectedBlockId)?.style, fontSize: parseInt(value) },
                  })
                }
              >
                <SelectTrigger className="w-16 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Separator orientation="vertical" className="h-6" />

              {/* Style */}
              <Button
                variant={blocks.find((b) => b.id === selectedBlockId)?.style?.bold ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const block = blocks.find((b) => b.id === selectedBlockId);
                  if (block)
                    updateBlockWithSync(selectedBlockId, { style: { ...block.style, bold: !block.style?.bold } });
                }}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant={blocks.find((b) => b.id === selectedBlockId)?.style?.italic ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const block = blocks.find((b) => b.id === selectedBlockId);
                  if (block)
                    updateBlockWithSync(selectedBlockId, { style: { ...block.style, italic: !block.style?.italic } });
                }}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant={blocks.find((b) => b.id === selectedBlockId)?.style?.underline ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const block = blocks.find((b) => b.id === selectedBlockId);
                  if (block)
                    updateBlockWithSync(selectedBlockId, {
                      style: { ...block.style, underline: !block.style?.underline },
                    });
                }}
              >
                <Underline className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-6" />

              {/* Alignement */}
              <Button
                variant={blocks.find((b) => b.id === selectedBlockId)?.style?.align === "left" ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const block = blocks.find((b) => b.id === selectedBlockId);
                  if (block) updateBlockWithSync(selectedBlockId, { style: { ...block.style, align: "left" } });
                }}
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={blocks.find((b) => b.id === selectedBlockId)?.style?.align === "center" ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const block = blocks.find((b) => b.id === selectedBlockId);
                  if (block) updateBlockWithSync(selectedBlockId, { style: { ...block.style, align: "center" } });
                }}
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                variant={blocks.find((b) => b.id === selectedBlockId)?.style?.align === "right" ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const block = blocks.find((b) => b.id === selectedBlockId);
                  if (block) updateBlockWithSync(selectedBlockId, { style: { ...block.style, align: "right" } });
                }}
              >
                <AlignRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 🔥 Dialog d'ajout d'achat rapide */}
      <Dialog open={showQuickPurchase} onOpenChange={setShowQuickPurchase}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-600" />
              Ajouter un achat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {availableProjectsForPurchase.length === 0 ? (
              <div className="text-center py-4">
                <Package className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucun projet avec scénario principal.
                  <br />
                  Créez d'abord un scénario dans un projet.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {/* 🔥 Sélection du projet */}
                  <div>
                    <Label htmlFor="projectSelect">Projet *</Label>
                    <select
                      id="projectSelect"
                      value={selectedProjectForPurchase}
                      onChange={(e) => setSelectedProjectForPurchase(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      {availableProjectsForPurchase.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Seuls les projets avec scénario principal sont disponibles
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="purchaseName">Nom de l'article *</Label>
                    <Input
                      id="purchaseName"
                      value={quickPurchaseName}
                      onChange={(e) => setQuickPurchaseName(e.target.value)}
                      placeholder="ex: Ruban adhésif, Gants, Vis..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="purchaseBrand">Marque</Label>
                      <Input
                        id="purchaseBrand"
                        value={quickPurchaseBrand}
                        onChange={(e) => setQuickPurchaseBrand(e.target.value)}
                        placeholder="ex: 3M, Bosch..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="purchaseCategory">Catégorie</Label>
                      <Input
                        id="purchaseCategory"
                        value={quickPurchaseCategory}
                        onChange={(e) => setQuickPurchaseCategory(e.target.value)}
                        placeholder="ex: Fournitures"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="purchasePrice">Prix unitaire (€)</Label>
                      <Input
                        id="purchasePrice"
                        type="number"
                        step="0.01"
                        value={quickPurchasePrice}
                        onChange={(e) => setQuickPurchasePrice(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="purchaseQuantity">Quantité</Label>
                      <Input
                        id="purchaseQuantity"
                        type="number"
                        min="1"
                        value={quickPurchaseQuantity}
                        onChange={(e) => setQuickPurchaseQuantity(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="purchaseSupplier">Fournisseur</Label>
                    <Input
                      id="purchaseSupplier"
                      value={quickPurchaseSupplier}
                      onChange={(e) => setQuickPurchaseSupplier(e.target.value)}
                      placeholder="ex: Amazon, Leroy Merlin..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowQuickPurchase(false)}>
                    Annuler
                  </Button>
                  <Button
                    onClick={addQuickPurchase}
                    disabled={isAddingPurchase || !quickPurchaseName.trim() || !selectedProjectForPurchase}
                  >
                    {isAddingPurchase ? "Ajout..." : "Ajouter"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
