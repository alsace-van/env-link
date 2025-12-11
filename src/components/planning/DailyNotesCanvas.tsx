// components/planning/DailyNotesCanvas.tsx
// Outil de prise de notes journalières complet
// ReactFlow pour les blocs et connexions + Paper.js pour le dessin libre

import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
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
  Edge,
  Node,
  NodeProps,
  Handle,
  Position,
  MarkerType,
  Panel,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  MoreHorizontal,
  Move,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, addDays, subDays, startOfWeek, endOfWeek, isToday, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

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

interface NoteBlock {
  id: string;
  type: "text" | "checklist" | "list" | "table" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  content: any;
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
  edge_type?: string;
  animated?: boolean;
  label?: string;
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

// ============================================
// CUSTOM NODE COMPONENT (comme MechanicalProcedures)
// ============================================

interface CustomBlockData {
  block: NoteBlock;
  onUpdate: (updates: Partial<NoteBlock>) => void;
  onDelete: () => void;
  onImageUpload: (file: File) => void;
  [key: string]: unknown;
}

const CustomBlockNode = memo(({ data, selected }: NodeProps) => {
  const { block, onUpdate, onDelete, onImageUpload } = data as CustomBlockData;
  const [isEditing, setIsEditing] = useState(false);

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
            onBlur={() => setIsEditing(false)}
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
            {checklistItems.map((item) => (
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
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-0 p-0"
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
                  className="h-7 text-sm border-0 shadow-none focus-visible:ring-0 p-0"
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
    }
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-md border-2 group ${
        selected ? "border-blue-500 shadow-lg" : "border-gray-200 hover:border-gray-300"
      }`}
      style={{
        backgroundColor: block.style?.backgroundColor || "#fff",
        minWidth: block.width || 200,
        minHeight: 80,
      }}
    >
      {/* Handles de connexion - comme MechanicalProcedures */}
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3 !h-3" />

      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-50 rounded-t-md border-b cursor-move">
        <div className="flex items-center gap-1">
          <GripVertical className="h-4 w-4 text-gray-400" />
          {getBlockIcon()}
          <span className="text-xs text-gray-500 capitalize">{block.type}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={stopPropagation}>
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="nodrag">{renderContent()}</div>
    </div>
  );
});

CustomBlockNode.displayName = "CustomBlockNode";

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
}

export default function DailyNotesCanvas({ projectId, open, onOpenChange }: DailyNotesCanvasProps) {
  // États principaux
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [userId, setUserId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<NoteBlock[]>([]);
  const [edges, setEdges] = useState<BlockEdge[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // États dessin Paper.js
  const [activeTool, setActiveTool] = useState<DrawTool>("select");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperScopeRef = useRef<paper.PaperScope | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);

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

  const deleteBlock = useCallback(
    (blockId: string) => {
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      // Supprimer les edges liées
      setEdges((prev) => prev.filter((e) => e.source_block_id !== blockId && e.target_block_id !== blockId));
      if (selectedBlockId === blockId) setSelectedBlockId(null);
      setHasUnsavedChanges(true);
    },
    [selectedBlockId],
  );

  const addBlock = useCallback((type: NoteBlock["type"]) => {
    const newBlock: NoteBlock = {
      id: crypto.randomUUID(),
      type,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: type === "table" ? 300 : 200,
      height: 100,
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
              : "",
      style: {
        fontFamily: FONTS[0].value,
        fontSize: 14,
        color: "#000000",
        backgroundColor: "#ffffff",
      },
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

        updateBlock(blockId, { content: publicUrl });
        toast.success("Image ajoutée");
      } catch (error) {
        console.error("Erreur upload:", error);
        toast.error("Erreur lors de l'upload");
      }
    },
    [userId, updateBlock],
  );

  // ============================================
  // SYNC REACTFLOW NODES
  // ============================================

  const blocksIdsRef = useRef<string>("");

  useEffect(() => {
    const currentIds = blocks.map((b) => `${b.id}-${b.type}-${JSON.stringify(b.content).slice(0, 50)}`).join(",");
    if (currentIds !== blocksIdsRef.current) {
      blocksIdsRef.current = currentIds;
      setNodes(
        blocks.map((block) => ({
          id: block.id,
          type: "customBlock",
          position: { x: block.x, y: block.y },
          data: {
            block,
            onUpdate: (updates: Partial<NoteBlock>) => updateBlock(block.id, updates),
            onDelete: () => deleteBlock(block.id),
            onImageUpload: (file: File) => handleImageUpload(block.id, file),
          } as CustomBlockData,
          style: { width: block.width },
        })) as any,
      );
    }
  }, [blocks, setNodes, updateBlock, deleteBlock, handleImageUpload, selectedBlockId]);

  // Sync edges
  useEffect(() => {
    setFlowEdges(
      edges.map((edge) => ({
        id: edge.id,
        source: edge.source_block_id,
        target: edge.target_block_id,
        type: "smoothstep",
        animated: edge.animated || false,
        label: edge.label,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2, stroke: "#64748b" },
      })) as any,
    );
  }, [edges, setFlowEdges]);

  // Handle node position changes
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);

      // Mettre à jour les positions des blocs
      changes.forEach((change: any) => {
        if (change.type === "position" && change.position) {
          setBlocks((prev) =>
            prev.map((b) => (b.id === change.id ? { ...b, x: change.position.x, y: change.position.y } : b)),
          );
          setHasUnsavedChanges(true);
        }
      });
    },
    [onNodesChange],
  );

  // Handle new connection
  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;

    const newEdge: BlockEdge = {
      id: crypto.randomUUID(),
      source_block_id: connection.source,
      target_block_id: connection.target,
      edge_type: "smoothstep",
      animated: false,
    };

    setEdges((prev) => [...prev, newEdge]);
    setHasUnsavedChanges(true);
    toast.success("Connexion créée");
  }, []);

  // Delete edge on click
  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setEdges((prev) => prev.filter((e) => e.id !== edge.id));
    setHasUnsavedChanges(true);
    toast.success("Connexion supprimée");
  }, []);

  // ============================================
  // PAPER.JS DRAWING
  // ============================================

  useEffect(() => {
    if (!open || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const scope = new paper.PaperScope();
    scope.setup(canvas);
    paperScopeRef.current = scope;

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
      if (scope.project) {
        scope.project.clear();
      }
      paperScopeRef.current = null;
    };
  }, [open]);

  // ============================================
  // LOAD / SAVE DATA
  // ============================================

  const loadDayData = useCallback(async () => {
    setIsLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setUserId(userData.user.id);

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      const { data, error } = await (supabase as any)
        .from("daily_notes")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", userData.user.id)
        .eq("note_date", dateStr)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

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
            setBlocks(JSON.parse(data.blocks_data));
          } catch {
            setBlocks([]);
          }
        } else {
          setBlocks([]);
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
        setBlocks([]);
        setEdges([]);
      }
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setIsLoading(false);
      setHasUnsavedChanges(false);
    }
  }, [selectedDate, projectId]);

  useEffect(() => {
    if (open) {
      loadDayData();
    }
  }, [open, loadDayData]);

  const saveNote = useCallback(async () => {
    if (!userId) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const canvasData = paperScopeRef.current?.project.exportJSON() || null;
    const blocksData = JSON.stringify(blocks);
    const connectionsData = JSON.stringify(edges);

    try {
      const { data: existing } = await (supabase as any)
        .from("daily_notes")
        .select("id")
        .eq("project_id", projectId)
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
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    }
  }, [userId, selectedDate, projectId, blocks, edges]);

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

  // Week days
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-4 py-2 border-b shrink-0">
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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
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

              <Button variant="outline" size="icon" onClick={goToNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button variant="outline" size="sm" onClick={goToToday}>
                Aujourd'hui
              </Button>
            </div>
          </div>

          {/* Semaine */}
          <div className="flex gap-1 mt-2">
            {weekDays.map((day) => (
              <Button
                key={day.toISOString()}
                variant={isSameDay(day, selectedDate) ? "default" : "ghost"}
                size="sm"
                className={`flex-1 ${isToday(day) ? "ring-2 ring-blue-300" : ""}`}
                onClick={() => setSelectedDate(day)}
              >
                <span className="text-xs">
                  {format(day, "EEE", { locale: fr })}
                  <br />
                  {format(day, "d")}
                </span>
              </Button>
            ))}
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

          {/* Ajouter blocs */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Bloc
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => addBlock("text")}>
                <Type className="h-4 w-4 mr-2" />
                Texte
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addBlock("checklist")}>
                <CheckSquare className="h-4 w-4 mr-2" />
                Checklist
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addBlock("list")}>
                <List className="h-4 w-4 mr-2" />
                Liste
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addBlock("table")}>
                <Table className="h-4 w-4 mr-2" />
                Tableau
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addBlock("image")}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
            <>
              {/* Paper.js Canvas (en arrière-plan) */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 bg-white"
                style={{
                  width: "100%",
                  height: "100%",
                  touchAction: "none",
                  pointerEvents: activeTool !== "select" ? "auto" : "none",
                  zIndex: activeTool !== "select" ? 10 : 0,
                }}
              />

              {/* ReactFlow (par-dessus pour les blocs) */}
              <div
                className="absolute inset-0"
                style={{
                  pointerEvents: activeTool === "select" ? "auto" : "none",
                  zIndex: activeTool === "select" ? 10 : 0,
                }}
              >
                <ReactFlow
                  nodes={nodes}
                  edges={flowEdges}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={handleConnect}
                  onEdgeClick={handleEdgeClick}
                  nodeTypes={nodeTypes}
                  fitView
                  defaultEdgeOptions={{
                    type: "smoothstep",
                    markerEnd: { type: MarkerType.ArrowClosed },
                    style: { strokeWidth: 2, stroke: "#64748b" },
                  }}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background />
                  <Controls />
                  <MiniMap />
                  <Panel position="top-right">
                    <div className="bg-white/80 rounded p-2 text-xs text-gray-500">
                      Glissez depuis les points bleus/verts pour connecter
                    </div>
                  </Panel>
                </ReactFlow>
              </div>
            </>
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
                  updateBlock(selectedBlockId, {
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
                updateBlock(selectedBlockId, {
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
                if (block) updateBlock(selectedBlockId, { style: { ...block.style, bold: !block.style?.bold } });
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
                if (block) updateBlock(selectedBlockId, { style: { ...block.style, italic: !block.style?.italic } });
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
                  updateBlock(selectedBlockId, { style: { ...block.style, underline: !block.style?.underline } });
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
                if (block) updateBlock(selectedBlockId, { style: { ...block.style, align: "left" } });
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
                if (block) updateBlock(selectedBlockId, { style: { ...block.style, align: "center" } });
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
                if (block) updateBlock(selectedBlockId, { style: { ...block.style, align: "right" } });
              }}
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
