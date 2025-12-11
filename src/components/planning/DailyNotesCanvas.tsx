// components/planning/DailyNotesCanvas.tsx
// Outil de prise de notes journalières complet
// Dessin libre (Paper.js) + Blocs structurés + Support tactile iPad

import { useState, useEffect, useCallback, useRef, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import paper from "paper";
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
  canvas_data?: string; // JSON Paper.js
  blocks_data?: string; // JSON des blocs
  connections_data?: string; // JSON des connexions
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

// Connexion entre deux blocs
interface BlockConnection {
  id: string;
  sourceBlockId: string;
  sourceAnchor: "top" | "right" | "bottom" | "left";
  targetBlockId: string;
  targetAnchor: "top" | "right" | "bottom" | "left";
  color?: string;
  strokeWidth?: number;
  label?: string;
}

type DrawTool = "select" | "pencil" | "line" | "arrow" | "rectangle" | "circle" | "eraser" | "text" | "connect";

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

// Google Fonts libres de droit (Open Font License)
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

// URL Google Fonts à charger
const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&family=Caveat:wght@400;700&family=Dancing+Script:wght@400;700&family=Fira+Code:wght@400;700&family=Indie+Flower&family=Inter:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Lato:wght@400;700&family=Libre+Baskerville:wght@400;700&family=Lora:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;700&family=Nunito:wght@400;700&family=Open+Sans:wght@400;700&family=Oswald:wght@400;700&family=PT+Serif:wght@400;700&family=Pacifico&family=Patrick+Hand&family=Permanent+Marker&family=Playfair+Display:wght@400;700&family=Poppins:wght@400;700&family=Raleway:wght@400;700&family=Roboto:wght@400;700&family=Shadows+Into+Light&family=Source+Code+Pro:wght@400;700&family=Ubuntu:wght@400;700&display=swap";

// ============================================
// BLOCK COMPONENT
// ============================================

interface BlockProps {
  block: NoteBlock;
  isSelected: boolean;
  isConnectMode: boolean;
  isPendingConnection: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<NoteBlock>) => void;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onAnchorDragStart: (blockId: string, anchor: "top" | "right" | "bottom" | "left", e: React.PointerEvent) => void;
}

// Composant pour les points d'ancrage
const AnchorPoint = memo(
  ({
    position,
    blockId,
    anchor,
    isConnectMode,
    isPendingConnection,
    onDragStart,
  }: {
    position: { top?: string; right?: string; bottom?: string; left?: string; transform: string };
    blockId: string;
    anchor: "top" | "right" | "bottom" | "left";
    isConnectMode: boolean;
    isPendingConnection: boolean;
    onDragStart: (blockId: string, anchor: "top" | "right" | "bottom" | "left", e: React.PointerEvent) => void;
  }) => (
    <div
      className={`absolute w-5 h-5 rounded-full border-2 cursor-crosshair transition-all z-20
      ${
        isConnectMode || isPendingConnection
          ? "bg-blue-500 border-blue-600 opacity-100 scale-110"
          : "bg-white border-gray-400 opacity-0 group-hover:opacity-100 hover:bg-blue-100 hover:border-blue-500 hover:scale-125"
      }`}
      style={position}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("Anchor drag start:", blockId, anchor);
        onDragStart(blockId, anchor, e);
      }}
    />
  ),
);

AnchorPoint.displayName = "AnchorPoint";

const Block = memo(
  ({
    block,
    isSelected,
    isConnectMode,
    isPendingConnection,
    onSelect,
    onUpdate,
    onDelete,
    onDragStart,
    onAnchorDragStart,
  }: BlockProps) => {
    const [isEditing, setIsEditing] = useState(false);

    const handleDoubleClick = () => {
      setIsEditing(true);
    };

    const stopPropagation = (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
    };

    // Positions des ancres (plus grandes pour faciliter le clic)
    const anchorPositions = {
      top: { top: "-10px", left: "50%", transform: "translateX(-50%)" },
      right: { top: "50%", right: "-10px", transform: "translateY(-50%)" },
      bottom: { bottom: "-10px", left: "50%", transform: "translateX(-50%)" },
      left: { top: "50%", left: "-10px", transform: "translateY(-50%)" },
    };

    const renderContent = () => {
      switch (block.type) {
        case "text":
          return isEditing ? (
            <Textarea
              autoFocus
              value={block.content.text || ""}
              onChange={(e) => onUpdate({ content: { ...block.content, text: e.target.value } })}
              onBlur={() => setIsEditing(false)}
              onClick={stopPropagation}
              className="w-full h-full resize-none border-0 focus:ring-0 bg-transparent"
              style={{
                fontSize: block.style?.fontSize || 14,
                fontFamily: block.style?.fontFamily || "system-ui, -apple-system, sans-serif",
                fontWeight: block.style?.bold ? "bold" : "normal",
                fontStyle: block.style?.italic ? "italic" : "normal",
                textDecoration: block.style?.underline ? "underline" : "none",
                textAlign: block.style?.align || "left",
                color: block.style?.color || "#000",
              }}
            />
          ) : (
            <div
              className="w-full h-full p-2 whitespace-pre-wrap overflow-auto"
              style={{
                fontSize: block.style?.fontSize || 14,
                fontFamily: block.style?.fontFamily || "system-ui, -apple-system, sans-serif",
                fontWeight: block.style?.bold ? "bold" : "normal",
                fontStyle: block.style?.italic ? "italic" : "normal",
                textDecoration: block.style?.underline ? "underline" : "none",
                textAlign: block.style?.align || "left",
                color: block.style?.color || "#000",
              }}
            >
              {block.content.text || "Double-clic pour éditer..."}
            </div>
          );

        case "checklist":
          const items = block.content.items || [{ id: "1", text: "", checked: false }];
          return (
            <div className="p-2 space-y-1">
              {items.map((item: any, index: number) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={(checked) => {
                      const newItems = [...items];
                      newItems[index] = { ...item, checked };
                      onUpdate({ content: { items: newItems } });
                    }}
                    onClick={stopPropagation}
                  />
                  <Input
                    value={item.text}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[index] = { ...item, text: e.target.value };
                      onUpdate({ content: { items: newItems } });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const newItems = [...items];
                        newItems.splice(index + 1, 0, { id: crypto.randomUUID(), text: "", checked: false });
                        onUpdate({ content: { items: newItems } });
                      }
                      if (e.key === "Backspace" && item.text === "" && items.length > 1) {
                        e.preventDefault();
                        const newItems = items.filter((_: any, i: number) => i !== index);
                        onUpdate({ content: { items: newItems } });
                      }
                    }}
                    onClick={stopPropagation}
                    className={`flex-1 h-7 text-sm border-0 focus:ring-0 ${item.checked ? "line-through text-gray-400" : ""}`}
                    style={{ fontFamily: block.style?.fontFamily || "system-ui, -apple-system, sans-serif" }}
                    placeholder="Nouvel élément..."
                  />
                </div>
              ))}
            </div>
          );

        case "list":
          const listItems = block.content.items || [{ id: "1", text: "" }];
          return (
            <div className="p-2 space-y-1">
              {listItems.map((item: any, index: number) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="text-gray-500">•</span>
                  <Input
                    value={item.text}
                    onChange={(e) => {
                      const newItems = [...listItems];
                      newItems[index] = { ...item, text: e.target.value };
                      onUpdate({ content: { items: newItems } });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const newItems = [...listItems];
                        newItems.splice(index + 1, 0, { id: crypto.randomUUID(), text: "" });
                        onUpdate({ content: { items: newItems } });
                      }
                      if (e.key === "Backspace" && item.text === "" && listItems.length > 1) {
                        e.preventDefault();
                        const newItems = listItems.filter((_: any, i: number) => i !== index);
                        onUpdate({ content: { items: newItems } });
                      }
                    }}
                    onClick={stopPropagation}
                    className="flex-1 h-7 text-sm border-0 focus:ring-0"
                    style={{ fontFamily: block.style?.fontFamily || "system-ui, -apple-system, sans-serif" }}
                    placeholder="Nouvel élément..."
                  />
                </div>
              ))}
            </div>
          );

        case "table":
          const rows = block.content.rows || 3;
          const cols = block.content.cols || 3;
          const cells =
            block.content.cells ||
            Array(rows)
              .fill(null)
              .map(() => Array(cols).fill(""));
          return (
            <div className="p-2 overflow-auto">
              <table className="w-full border-collapse">
                <tbody>
                  {cells.map((row: string[], rowIndex: number) => (
                    <tr key={rowIndex}>
                      {row.map((cell: string, colIndex: number) => (
                        <td key={colIndex} className="border border-gray-300 p-0">
                          <Input
                            value={cell}
                            onChange={(e) => {
                              const newCells = cells.map((r: string[], ri: number) =>
                                ri === rowIndex
                                  ? r.map((c: string, ci: number) => (ci === colIndex ? e.target.value : c))
                                  : r,
                              );
                              onUpdate({ content: { ...block.content, cells: newCells } });
                            }}
                            onClick={stopPropagation}
                            className="w-full h-8 text-xs border-0 rounded-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );

        case "image":
          return block.content.url ? (
            <img src={block.content.url} alt="Note image" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
              <ImageIcon className="h-8 w-8" />
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <div
        data-block-id={block.id}
        className={`absolute bg-white rounded-lg shadow-md border-2 transition-all group ${
          isSelected ? "border-blue-500 shadow-lg" : "border-gray-200 hover:border-gray-300"
        } ${isConnectMode ? "ring-2 ring-blue-200" : ""}`}
        style={{
          left: block.x,
          top: block.y,
          width: block.width,
          height: block.height,
          backgroundColor: block.style?.backgroundColor || "#fff",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onDoubleClick={handleDoubleClick}
      >
        {/* Points d'ancrage pour les connexions */}
        {(Object.entries(anchorPositions) as [keyof typeof anchorPositions, typeof anchorPositions.top][]).map(
          ([anchor, position]) => (
            <AnchorPoint
              key={anchor}
              position={position}
              blockId={block.id}
              anchor={anchor}
              isConnectMode={isConnectMode}
              isPendingConnection={isPendingConnection}
              onDragStart={onAnchorDragStart}
            />
          ),
        )}

        {/* Header avec drag handle */}
        <div
          className="flex items-center justify-between px-2 py-1 bg-gray-50 rounded-t-md cursor-move border-b"
          onPointerDown={onDragStart}
        >
          <div className="flex items-center gap-1">
            <GripVertical className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-500 capitalize">{block.type}</span>
          </div>
          {isSelected && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden" style={{ height: block.height - 32 }}>
          {renderContent()}
        </div>

        {/* Resize handle */}
        {isSelected && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            style={{
              background: "linear-gradient(135deg, transparent 50%, #3B82F6 50%)",
              borderBottomRightRadius: "0.5rem",
            }}
          />
        )}
      </div>
    );
  },
);

Block.displayName = "Block";

// ============================================
// MAIN COMPONENT
// ============================================

interface DailyNotesCanvasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const DailyNotesCanvas = ({ open, onOpenChange, projectId }: DailyNotesCanvasProps) => {
  // États
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentNote, setCurrentNote] = useState<DailyNote | null>(null);
  const [blocks, setBlocks] = useState<NoteBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Connexions entre blocs
  const [connections, setConnections] = useState<BlockConnection[]>([]);
  const [pendingConnection, setPendingConnection] = useState<{
    sourceBlockId: string;
    sourceAnchor: "top" | "right" | "bottom" | "left";
    mouseX: number;
    mouseY: number;
  } | null>(null);

  // Outils de dessin
  const [activeTool, setActiveTool] = useState<DrawTool>("select");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize] = useState(14);

  // Paper.js refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperScopeRef = useRef<paper.PaperScope | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refs pour les outils
  const activeToolRef = useRef(activeTool);
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);

  // Undo/Redo
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Charger les Google Fonts
  useEffect(() => {
    // Vérifier si le lien existe déjà
    const existingLink = document.querySelector(`link[href*="fonts.googleapis.com"]`);
    if (existingLink) return;

    const link = document.createElement("link");
    link.href = GOOGLE_FONTS_URL;
    link.rel = "stylesheet";
    document.head.appendChild(link);

    return () => {
      // Ne pas supprimer car d'autres composants pourraient l'utiliser
    };
  }, []);

  // Mettre à jour les refs
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    strokeColorRef.current = strokeColor;
  }, [strokeColor]);

  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);

  // Initialiser Paper.js
  useEffect(() => {
    if (!open || !canvasRef.current) return;

    const scope = new paper.PaperScope();
    scope.setup(canvasRef.current);
    paperScopeRef.current = scope;

    // Variables pour le dessin
    let currentPath: paper.Path | null = null;
    let selectedItem: paper.Item | null = null;

    // Tool pour le dessin
    const tool = new scope.Tool();

    tool.onMouseDown = (event: paper.ToolEvent) => {
      const tool = activeToolRef.current;

      if (tool === "select") {
        // Sélectionner un élément
        const hitResult = scope.project.hitTest(event.point, {
          segments: true,
          stroke: true,
          fill: true,
          tolerance: 5,
        });

        if (hitResult && hitResult.item && !hitResult.item.data?.isHandle) {
          selectedItem = hitResult.item;
          selectedItem.selected = true;
        } else {
          if (selectedItem) {
            selectedItem.selected = false;
            selectedItem = null;
          }
        }
      } else if (tool === "pencil") {
        currentPath = new scope.Path({
          strokeColor: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
          strokeCap: "round",
          strokeJoin: "round",
        });
        currentPath.add(event.point);
      } else if (tool === "line" || tool === "arrow") {
        currentPath = new scope.Path({
          strokeColor: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
          strokeCap: "round",
        });
        currentPath.add(event.point);
        currentPath.add(event.point);
      } else if (tool === "rectangle") {
        currentPath = new scope.Path.Rectangle({
          from: event.point,
          to: event.point,
          strokeColor: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
        });
      } else if (tool === "circle") {
        currentPath = new scope.Path.Circle({
          center: event.point,
          radius: 1,
          strokeColor: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
        });
        (currentPath as any).data = { center: event.point.clone() };
      } else if (tool === "eraser") {
        const hitResult = scope.project.hitTest(event.point, {
          stroke: true,
          tolerance: 10,
        });
        if (hitResult && hitResult.item) {
          hitResult.item.remove();
        }
      }
    };

    tool.onMouseDrag = (event: paper.ToolEvent) => {
      const tool = activeToolRef.current;

      if (tool === "select" && selectedItem) {
        selectedItem.position = selectedItem.position.add(event.delta);
      } else if (tool === "pencil" && currentPath) {
        currentPath.add(event.point);
      } else if ((tool === "line" || tool === "arrow") && currentPath) {
        currentPath.lastSegment.point = event.point;
      } else if (tool === "rectangle" && currentPath) {
        currentPath.remove();
        currentPath = new scope.Path.Rectangle({
          from: event.downPoint,
          to: event.point,
          strokeColor: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
        });
      } else if (tool === "circle" && currentPath) {
        const center = (currentPath as any).data?.center || event.downPoint;
        const radius = center.getDistance(event.point);
        currentPath.remove();
        currentPath = new scope.Path.Circle({
          center: center,
          radius: radius,
          strokeColor: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
        });
        (currentPath as any).data = { center: center };
      } else if (tool === "eraser") {
        const hitResult = scope.project.hitTest(event.point, {
          stroke: true,
          tolerance: 10,
        });
        if (hitResult && hitResult.item) {
          hitResult.item.remove();
        }
      }
    };

    tool.onMouseUp = (event: paper.ToolEvent) => {
      const toolType = activeToolRef.current;

      if (toolType === "pencil" && currentPath) {
        currentPath.simplify(5);
      }

      if (toolType === "arrow" && currentPath && currentPath.segments.length === 2) {
        // Ajouter la tête de flèche
        const start = currentPath.firstSegment.point;
        const end = currentPath.lastSegment.point;
        const vector = end.subtract(start).normalize(15);

        const arrowHead = new scope.Path({
          strokeColor: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
          strokeCap: "round",
        });

        // rotate() avec center point pour TypeScript
        const center = new scope.Point(0, 0);
        arrowHead.add(end.subtract(vector.rotate(30, center)));
        arrowHead.add(end);
        arrowHead.add(end.subtract(vector.rotate(-30, center)));
      }

      currentPath = null;
      saveToHistory();
    };

    tool.activate();

    return () => {
      // Cleanup Paper.js
      if (scope.project) {
        scope.project.clear();
      }
      paperScopeRef.current = null;
    };
  }, [open]);

  // Charger les données du jour
  const loadDayData = useCallback(async () => {
    setIsLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setUserId(userData.user.id);

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    const { data, error } = await (supabase
      .from("daily_notes" as any)
      .select("*")
      .eq("project_id", projectId)
      .eq("note_date", dateStr)
      .maybeSingle() as any);

    if (data) {
      setCurrentNote(data as DailyNote);

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
          setConnections(JSON.parse(data.connections_data));
        } catch {
          setConnections([]);
        }
      } else {
        setConnections([]);
      }

      // Charger le canvas Paper.js
      if (data.canvas_data && paperScopeRef.current) {
        try {
          paperScopeRef.current.project.activeLayer.removeChildren();
          paperScopeRef.current.project.activeLayer.importJSON(data.canvas_data);
        } catch {
          console.error("Erreur chargement canvas");
        }
      }
    } else {
      setCurrentNote(null);
      setBlocks([]);
      setConnections([]);
      if (paperScopeRef.current) {
        paperScopeRef.current.project.activeLayer.removeChildren();
      }
    }

    setIsLoading(false);
  }, [selectedDate, projectId]);

  useEffect(() => {
    if (open) {
      loadDayData();
    }
  }, [open, loadDayData]);

  // Sauvegarder
  const saveNote = useCallback(async () => {
    if (!userId) return;

    setIsSaving(true);

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const canvasData = paperScopeRef.current?.project.activeLayer.exportJSON() || null;
    const blocksData = JSON.stringify(blocks);
    const connectionsData = JSON.stringify(connections);

    if (currentNote) {
      // Mettre à jour
      await (supabase
        .from("daily_notes" as any)
        .update({
          canvas_data: canvasData,
          blocks_data: blocksData,
          connections_data: connectionsData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentNote.id) as any);
    } else {
      // Créer
      const { data } = await (supabase
        .from("daily_notes" as any)
        .insert({
          user_id: userId,
          project_id: projectId,
          note_date: dateStr,
          canvas_data: canvasData,
          blocks_data: blocksData,
          connections_data: connectionsData,
        })
        .select()
        .single() as any);

      if (data) {
        setCurrentNote(data as DailyNote);
      }
    }

    setIsSaving(false);
    toast.success("Note sauvegardée");
  }, [userId, selectedDate, projectId, currentNote, blocks, connections]);

  // Auto-save toutes les 30 secondes
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(saveNote, 30000);
    return () => clearInterval(interval);
  }, [open, saveNote]);

  // Historique pour Undo/Redo
  const saveToHistory = useCallback(() => {
    if (!paperScopeRef.current) return;
    const json = paperScopeRef.current.project.activeLayer.exportJSON();
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(json);
      return newHistory.slice(-50); // Garder les 50 derniers états
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0 || !paperScopeRef.current) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    paperScopeRef.current.project.activeLayer.removeChildren();
    paperScopeRef.current.project.activeLayer.importJSON(history[newIndex]);
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1 || !paperScopeRef.current) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    paperScopeRef.current.project.activeLayer.removeChildren();
    paperScopeRef.current.project.activeLayer.importJSON(history[newIndex]);
  }, [historyIndex, history]);

  // Ajouter un bloc
  const addBlock = useCallback(
    (type: NoteBlock["type"]) => {
      const newBlock: NoteBlock = {
        id: crypto.randomUUID(),
        type,
        x: 50 + blocks.length * 20,
        y: 50 + blocks.length * 20,
        width: type === "table" ? 400 : 250,
        height: type === "table" ? 200 : type === "text" ? 150 : 180,
        content:
          type === "checklist" || type === "list"
            ? { items: [{ id: "1", text: "", checked: false }] }
            : type === "table"
              ? {
                  rows: 3,
                  cols: 3,
                  cells: Array(3)
                    .fill(null)
                    .map(() => Array(3).fill("")),
                }
              : type === "image"
                ? { url: "" }
                : { text: "" },
        style: {
          fontSize: 14,
          color: "#000000",
          backgroundColor: "#ffffff",
        },
      };

      setBlocks((prev) => [...prev, newBlock]);
      setSelectedBlockId(newBlock.id);
    },
    [blocks],
  );

  // Mettre à jour un bloc
  const updateBlock = useCallback((id: string, updates: Partial<NoteBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  }, []);

  // Supprimer un bloc
  const deleteBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setSelectedBlockId(null);
  }, []);

  // Drag block
  const handleBlockDragStart = useCallback(
    (blockId: string, e: React.PointerEvent) => {
      e.preventDefault();
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;

      // Récupérer l'élément DOM directement
      const element = (e.target as HTMLElement).closest("[data-block-id]") as HTMLElement;
      if (!element) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startBlockX = block.x;
      const startBlockY = block.y;

      // Stocker la position finale
      let finalX = startBlockX;
      let finalY = startBlockY;

      // Ajouter une classe pour désactiver les transitions pendant le drag
      element.style.transition = "none";
      element.style.zIndex = "1000";

      const handleMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        finalX = Math.max(0, startBlockX + dx);
        finalY = Math.max(0, startBlockY + dy);

        // Manipuler directement le DOM pour un déplacement fluide
        element.style.left = `${finalX}px`;
        element.style.top = `${finalY}px`;
      };

      const handleUp = () => {
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);

        // Restaurer le style
        element.style.transition = "";
        element.style.zIndex = "";

        // Mettre à jour le state React seulement à la fin
        updateBlock(blockId, { x: finalX, y: finalY });
      };

      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    },
    [blocks, updateBlock],
  );

  // === CONNEXIONS ENTRE BLOCS ===

  // Calculer la position d'un ancrage
  const getAnchorPosition = useCallback((block: NoteBlock, anchor: "top" | "right" | "bottom" | "left") => {
    switch (anchor) {
      case "top":
        return { x: block.x + block.width / 2, y: block.y };
      case "right":
        return { x: block.x + block.width, y: block.y + block.height / 2 };
      case "bottom":
        return { x: block.x + block.width / 2, y: block.y + block.height };
      case "left":
        return { x: block.x, y: block.y + block.height / 2 };
    }
  }, []);

  // Trouver l'ancrage le plus proche d'une position
  const findNearestAnchor = useCallback(
    (mouseX: number, mouseY: number, excludeBlockId?: string) => {
      const SNAP_DISTANCE = 25; // Distance de snap en pixels
      let nearest: { blockId: string; anchor: "top" | "right" | "bottom" | "left"; distance: number } | null = null;

      for (const block of blocks) {
        if (block.id === excludeBlockId) continue;

        const anchors: Array<"top" | "right" | "bottom" | "left"> = ["top", "right", "bottom", "left"];
        for (const anchor of anchors) {
          const pos = getAnchorPosition(block, anchor);
          const distance = Math.sqrt(Math.pow(pos.x - mouseX, 2) + Math.pow(pos.y - mouseY, 2));

          if (distance < SNAP_DISTANCE && (!nearest || distance < nearest.distance)) {
            nearest = { blockId: block.id, anchor, distance };
          }
        }
      }

      return nearest;
    },
    [blocks, getAnchorPosition],
  );

  // Démarrer une connexion depuis un ancrage
  const handleAnchorDragStart = useCallback(
    (blockId: string, anchor: "top" | "right" | "bottom" | "left", e: React.PointerEvent) => {
      console.log("handleAnchorDragStart called:", blockId, anchor);

      const block = blocks.find((b) => b.id === blockId);
      if (!block) {
        console.log("Block not found");
        return;
      }
      if (!containerRef.current) {
        console.log("Container ref is null");
        return;
      }

      e.stopPropagation();
      e.preventDefault();

      const rect = containerRef.current.getBoundingClientRect();
      const scrollLeft = containerRef.current.scrollLeft;
      const scrollTop = containerRef.current.scrollTop;

      const getMousePos = (event: PointerEvent | React.PointerEvent) => ({
        x: event.clientX - rect.left + scrollLeft,
        y: event.clientY - rect.top + scrollTop,
      });

      const initialPos = getMousePos(e);
      console.log("Initial position:", initialPos);

      setPendingConnection({
        sourceBlockId: blockId,
        sourceAnchor: anchor,
        mouseX: initialPos.x,
        mouseY: initialPos.y,
      });

      const handleMove = (moveEvent: PointerEvent) => {
        const pos = getMousePos(moveEvent);
        setPendingConnection((prev) =>
          prev
            ? {
                ...prev,
                mouseX: pos.x,
                mouseY: pos.y,
              }
            : null,
        );
      };

      const handleUp = (upEvent: PointerEvent) => {
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);

        const pos = getMousePos(upEvent);
        console.log("Mouse up at:", pos);

        const nearestAnchor = findNearestAnchor(pos.x, pos.y, blockId);
        console.log("Nearest anchor:", nearestAnchor);

        if (nearestAnchor) {
          // Créer la connexion
          const exists = connections.some(
            (c) => c.sourceBlockId === blockId && c.targetBlockId === nearestAnchor.blockId,
          );

          if (!exists) {
            const newConnection: BlockConnection = {
              id: crypto.randomUUID(),
              sourceBlockId: blockId,
              sourceAnchor: anchor,
              targetBlockId: nearestAnchor.blockId,
              targetAnchor: nearestAnchor.anchor,
              color: strokeColor,
              strokeWidth: 2,
            };

            console.log("Creating connection:", newConnection);
            setConnections((prev) => [...prev, newConnection]);
            toast.success("Connexion créée");
          } else {
            console.log("Connection already exists");
          }
        } else {
          console.log("No anchor found nearby");
        }

        setPendingConnection(null);
      };

      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    },
    [blocks, connections, strokeColor, findNearestAnchor],
  );

  // Supprimer une connexion
  const deleteConnection = useCallback((connectionId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
  }, []);

  // Upload image
  const handleImageUpload = useCallback(
    async (blockId: string, file: File) => {
      const timestamp = Date.now();
      const filePath = `daily-notes/${userId}/${timestamp}-${file.name}`;

      const { error } = await supabase.storage.from("project-photos").upload(filePath, file);

      if (error) {
        toast.error("Erreur upload image");
        return;
      }

      const { data: urlData } = supabase.storage.from("project-photos").getPublicUrl(filePath);

      updateBlock(blockId, { content: { url: urlData.publicUrl } });
    },
    [userId, updateBlock],
  );

  // Navigation dates
  const goToPreviousDay = () => setSelectedDate((prev) => subDays(prev, 1));
  const goToNextDay = () => setSelectedDate((prev) => addDays(prev, 1));
  const goToToday = () => setSelectedDate(new Date());

  // Effacer le canvas
  const clearCanvas = useCallback(() => {
    if (paperScopeRef.current) {
      paperScopeRef.current.project.activeLayer.removeChildren();
      saveToHistory();
    }
  }, [saveToHistory]);

  // Exporter en PNG
  const exportToPNG = useCallback(() => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `note-${format(selectedDate, "yyyy-MM-dd")}.png`;
    link.href = dataUrl;
    link.click();
  }, [selectedDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] h-[95vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-blue-500" />
              <DialogTitle>Notes du jour</DialogTitle>
            </div>

            {/* Navigation dates */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToPreviousDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-[180px]">
                    {format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>

              <Button variant="outline" size="sm" onClick={goToNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>

              {!isToday(selectedDate) && (
                <Button variant="ghost" size="sm" onClick={goToToday}>
                  Aujourd'hui
                </Button>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportToPNG}>
                <Download className="h-4 w-4 mr-1" />
                Exporter
              </Button>
              <Button size="sm" onClick={saveNote} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Sauvegarder
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-4 flex-wrap shrink-0">
          {/* Outils de dessin */}
          <div className="flex items-center gap-1">
            <Button
              variant={activeTool === "select" ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setActiveTool("select")}
              title="Sélection"
            >
              <MousePointer2 className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTool === "pencil" ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setActiveTool("pencil")}
              title="Crayon"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTool === "line" ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setActiveTool("line")}
              title="Ligne"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTool === "arrow" ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setActiveTool("arrow")}
              title="Flèche"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTool === "rectangle" ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setActiveTool("rectangle")}
              title="Rectangle"
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTool === "circle" ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setActiveTool("circle")}
              title="Cercle"
            >
              <Circle className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTool === "eraser" ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setActiveTool("eraser")}
              title="Gomme"
            >
              <Eraser className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTool === "connect" ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setActiveTool("connect")}
              title="Connecter des blocs"
            >
              <Link2 className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-8" />

          {/* Couleur */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <div className="w-4 h-4 rounded border" style={{ backgroundColor: strokeColor }} />
                Couleur
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Épaisseur:</span>
            <Select value={strokeWidth.toString()} onValueChange={(v) => setStrokeWidth(parseInt(v))}>
              <SelectTrigger className="w-16 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STROKE_WIDTHS.map((w) => (
                  <SelectItem key={w} value={w.toString()}>
                    {w}px
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-8" />

          {/* Blocs */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8" onClick={() => addBlock("text")}>
              <Type className="h-4 w-4 mr-1" />
              Texte
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => addBlock("checklist")}>
              <CheckSquare className="h-4 w-4 mr-1" />
              Checklist
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => addBlock("list")}>
              <List className="h-4 w-4 mr-1" />
              Liste
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => addBlock("table")}>
              <Table className="h-4 w-4 mr-1" />
              Tableau
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => addBlock("image")}>
              <ImageIcon className="h-4 w-4 mr-1" />
              Image
            </Button>
          </div>

          <Separator orientation="vertical" className="h-8" />

          {/* Undo/Redo/Clear */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={undo}
              disabled={historyIndex <= 0}
              title="Annuler"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              title="Rétablir"
            >
              <Redo className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={clearCanvas} title="Effacer le dessin">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Canvas + Blocs */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-auto bg-gray-100"
          onClick={() => setSelectedBlockId(null)}
        >
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              {/* Canvas Paper.js */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 bg-white"
                style={{
                  width: "100%",
                  height: "100%",
                  touchAction: "none", // Pour iPad
                }}
              />

              {/* SVG pour les connexions */}
              <svg
                className="absolute inset-0 pointer-events-none"
                style={{ width: "100%", height: "100%", overflow: "visible" }}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                    fill={strokeColor}
                  >
                    <polygon points="0 0, 10 3.5, 0 7" />
                  </marker>
                </defs>

                {/* Connexions existantes */}
                {connections.map((conn) => {
                  const sourceBlock = blocks.find((b) => b.id === conn.sourceBlockId);
                  const targetBlock = blocks.find((b) => b.id === conn.targetBlockId);
                  if (!sourceBlock || !targetBlock) return null;

                  const start = getAnchorPosition(sourceBlock, conn.sourceAnchor);
                  const end = getAnchorPosition(targetBlock, conn.targetAnchor);

                  // Calcul des points de contrôle pour une courbe de Bézier
                  const dx = end.x - start.x;
                  const dy = end.y - start.y;
                  const controlOffset = Math.min(Math.abs(dx), Math.abs(dy), 100) / 2 + 50;

                  let ctrl1 = { x: start.x, y: start.y };
                  let ctrl2 = { x: end.x, y: end.y };

                  // Ajuster les points de contrôle selon les ancrages
                  switch (conn.sourceAnchor) {
                    case "top":
                      ctrl1 = { x: start.x, y: start.y - controlOffset };
                      break;
                    case "bottom":
                      ctrl1 = { x: start.x, y: start.y + controlOffset };
                      break;
                    case "left":
                      ctrl1 = { x: start.x - controlOffset, y: start.y };
                      break;
                    case "right":
                      ctrl1 = { x: start.x + controlOffset, y: start.y };
                      break;
                  }
                  switch (conn.targetAnchor) {
                    case "top":
                      ctrl2 = { x: end.x, y: end.y - controlOffset };
                      break;
                    case "bottom":
                      ctrl2 = { x: end.x, y: end.y + controlOffset };
                      break;
                    case "left":
                      ctrl2 = { x: end.x - controlOffset, y: end.y };
                      break;
                    case "right":
                      ctrl2 = { x: end.x + controlOffset, y: end.y };
                      break;
                  }

                  return (
                    <g
                      key={conn.id}
                      className="pointer-events-auto cursor-pointer"
                      onClick={() => deleteConnection(conn.id)}
                    >
                      {/* Zone de clic plus large */}
                      <path
                        d={`M ${start.x} ${start.y} C ${ctrl1.x} ${ctrl1.y}, ${ctrl2.x} ${ctrl2.y}, ${end.x} ${end.y}`}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="15"
                      />
                      {/* Ligne visible */}
                      <path
                        d={`M ${start.x} ${start.y} C ${ctrl1.x} ${ctrl1.y}, ${ctrl2.x} ${ctrl2.y}, ${end.x} ${end.y}`}
                        fill="none"
                        stroke={conn.color || "#3B82F6"}
                        strokeWidth={conn.strokeWidth || 2}
                        markerEnd="url(#arrowhead)"
                        className="transition-all hover:stroke-red-500"
                      />
                    </g>
                  );
                })}

                {/* Connexion en cours de création */}
                {pendingConnection &&
                  (() => {
                    const sourceBlock = blocks.find((b) => b.id === pendingConnection.sourceBlockId);
                    if (!sourceBlock) return null;

                    const start = getAnchorPosition(sourceBlock, pendingConnection.sourceAnchor);
                    const nearestAnchor = findNearestAnchor(
                      pendingConnection.mouseX,
                      pendingConnection.mouseY,
                      pendingConnection.sourceBlockId,
                    );

                    // Si on est proche d'un ancrage, snap vers lui
                    let endX = pendingConnection.mouseX;
                    let endY = pendingConnection.mouseY;

                    if (nearestAnchor) {
                      const targetBlock = blocks.find((b) => b.id === nearestAnchor.blockId);
                      if (targetBlock) {
                        const targetPos = getAnchorPosition(targetBlock, nearestAnchor.anchor);
                        endX = targetPos.x;
                        endY = targetPos.y;
                      }
                    }

                    return (
                      <>
                        {/* Ligne de connexion */}
                        <line
                          x1={start.x}
                          y1={start.y}
                          x2={endX}
                          y2={endY}
                          stroke={nearestAnchor ? "#22C55E" : strokeColor}
                          strokeWidth={nearestAnchor ? 3 : 2}
                          strokeDasharray={nearestAnchor ? "0" : "5,5"}
                        />
                        {/* Cercle sur l'ancrage cible */}
                        {nearestAnchor && (
                          <circle cx={endX} cy={endY} r="8" fill="#22C55E" stroke="white" strokeWidth="2" />
                        )}
                        {/* Cercle sur la position de la souris si pas de snap */}
                        {!nearestAnchor && (
                          <circle
                            cx={pendingConnection.mouseX}
                            cy={pendingConnection.mouseY}
                            r="5"
                            fill={strokeColor}
                            opacity="0.5"
                          />
                        )}
                      </>
                    );
                  })()}
              </svg>

              {/* Blocs */}
              {blocks.map((block) => (
                <Block
                  key={block.id}
                  block={block}
                  isSelected={selectedBlockId === block.id}
                  isConnectMode={activeTool === "connect"}
                  isPendingConnection={!!pendingConnection}
                  onSelect={() => setSelectedBlockId(block.id)}
                  onUpdate={(updates) => updateBlock(block.id, updates)}
                  onDelete={() => deleteBlock(block.id)}
                  onDragStart={(e) => handleBlockDragStart(block.id, e)}
                  onAnchorDragStart={handleAnchorDragStart}
                />
              ))}
            </>
          )}
        </div>

        {/* Barre de style bloc sélectionné */}
        {selectedBlockId && blocks.find((b) => b.id === selectedBlockId)?.type === "text" && (
          <div className="px-4 py-2 border-t bg-gray-50 flex items-center gap-4 shrink-0 flex-wrap">
            {/* Sélecteur de police */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Police:</span>
              <Select
                value={
                  blocks.find((b) => b.id === selectedBlockId)?.style?.fontFamily ||
                  "system-ui, -apple-system, sans-serif"
                }
                onValueChange={(v) => {
                  const block = blocks.find((b) => b.id === selectedBlockId);
                  if (block) {
                    updateBlock(block.id, {
                      style: { ...block.style, fontFamily: v },
                    });
                  }
                }}
              >
                <SelectTrigger className="w-44 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {/* Grouper par catégorie */}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">Sans-serif</div>
                  {FONTS.filter((f) => f.category === "Sans").map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.value }}>{font.name}</span>
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">Serif</div>
                  {FONTS.filter((f) => f.category === "Serif").map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.value }}>{font.name}</span>
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">Monospace</div>
                  {FONTS.filter((f) => f.category === "Mono").map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.value }}>{font.name}</span>
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">Script / Manuscrit</div>
                  {FONTS.filter((f) => f.category === "Script").map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.value }}>{font.name}</span>
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">Display / Titrage</div>
                  {FONTS.filter((f) => f.category === "Display").map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.value }}>{font.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Taille:</span>
              <Select
                value={(blocks.find((b) => b.id === selectedBlockId)?.style?.fontSize || 14).toString()}
                onValueChange={(v) => {
                  const block = blocks.find((b) => b.id === selectedBlockId);
                  if (block) {
                    updateBlock(block.id, {
                      style: { ...block.style, fontSize: parseInt(v) },
                    });
                  }
                }}
              >
                <SelectTrigger className="w-16 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZES.map((s) => (
                    <SelectItem key={s} value={s.toString()}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-1">
              <Button
                variant={blocks.find((b) => b.id === selectedBlockId)?.style?.bold ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const block = blocks.find((b) => b.id === selectedBlockId);
                  if (block) {
                    updateBlock(block.id, {
                      style: { ...block.style, bold: !block.style?.bold },
                    });
                  }
                }}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant={blocks.find((b) => b.id === selectedBlockId)?.style?.italic ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const block = blocks.find((b) => b.id === selectedBlockId);
                  if (block) {
                    updateBlock(block.id, {
                      style: { ...block.style, italic: !block.style?.italic },
                    });
                  }
                }}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant={blocks.find((b) => b.id === selectedBlockId)?.style?.underline ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const block = blocks.find((b) => b.id === selectedBlockId);
                  if (block) {
                    updateBlock(block.id, {
                      style: { ...block.style, underline: !block.style?.underline },
                    });
                  }
                }}
              >
                <Underline className="h-4 w-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-1">
              <Button
                variant={blocks.find((b) => b.id === selectedBlockId)?.style?.align === "left" ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const block = blocks.find((b) => b.id === selectedBlockId);
                  if (block) {
                    updateBlock(block.id, {
                      style: { ...block.style, align: "left" },
                    });
                  }
                }}
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={
                  blocks.find((b) => b.id === selectedBlockId)?.style?.align === "center" ? "default" : "outline"
                }
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const block = blocks.find((b) => b.id === selectedBlockId);
                  if (block) {
                    updateBlock(block.id, {
                      style: { ...block.style, align: "center" },
                    });
                  }
                }}
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                variant={blocks.find((b) => b.id === selectedBlockId)?.style?.align === "right" ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const block = blocks.find((b) => b.id === selectedBlockId);
                  if (block) {
                    updateBlock(block.id, {
                      style: { ...block.style, align: "right" },
                    });
                  }
                }}
              >
                <AlignRight className="h-4 w-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Couleur texte */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2">
                  <div
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: blocks.find((b) => b.id === selectedBlockId)?.style?.color || "#000" }}
                  />
                  Texte
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="grid grid-cols-5 gap-1">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      className={`w-6 h-6 rounded border-2 border-gray-200`}
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        const block = blocks.find((b) => b.id === selectedBlockId);
                        if (block) {
                          updateBlock(block.id, {
                            style: { ...block.style, color },
                          });
                        }
                      }}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Couleur fond */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2">
                  <div
                    className="w-4 h-4 rounded border"
                    style={{
                      backgroundColor: blocks.find((b) => b.id === selectedBlockId)?.style?.backgroundColor || "#fff",
                    }}
                  />
                  Fond
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="grid grid-cols-5 gap-1">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      className={`w-6 h-6 rounded border-2 border-gray-200`}
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        const block = blocks.find((b) => b.id === selectedBlockId);
                        if (block) {
                          updateBlock(block.id, {
                            style: { ...block.style, backgroundColor: color },
                          });
                        }
                      }}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Barre de style pour checklist et liste */}
        {selectedBlockId &&
          (blocks.find((b) => b.id === selectedBlockId)?.type === "checklist" ||
            blocks.find((b) => b.id === selectedBlockId)?.type === "list") && (
            <div className="px-4 py-2 border-t bg-gray-50 flex items-center gap-4 shrink-0">
              {/* Sélecteur de police */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Police:</span>
                <Select
                  value={
                    blocks.find((b) => b.id === selectedBlockId)?.style?.fontFamily ||
                    "system-ui, -apple-system, sans-serif"
                  }
                  onValueChange={(v) => {
                    const block = blocks.find((b) => b.id === selectedBlockId);
                    if (block) {
                      updateBlock(block.id, {
                        style: { ...block.style, fontFamily: v },
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-44 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">Sans-serif</div>
                    {FONTS.filter((f) => f.category === "Sans").map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        <span style={{ fontFamily: font.value }}>{font.name}</span>
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">Serif</div>
                    {FONTS.filter((f) => f.category === "Serif").map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        <span style={{ fontFamily: font.value }}>{font.name}</span>
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">Monospace</div>
                    {FONTS.filter((f) => f.category === "Mono").map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        <span style={{ fontFamily: font.value }}>{font.name}</span>
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">Script / Manuscrit</div>
                    {FONTS.filter((f) => f.category === "Script").map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        <span style={{ fontFamily: font.value }}>{font.name}</span>
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">Display / Titrage</div>
                    {FONTS.filter((f) => f.category === "Display").map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        <span style={{ fontFamily: font.value }}>{font.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
};

export default DailyNotesCanvas;
