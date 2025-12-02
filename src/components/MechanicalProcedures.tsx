import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  type: "text" | "checklist" | "warning" | "tip" | "image" | "tools";
  content: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  color?: string;
  order_index: number;
  image_url?: string;
}

// Couleurs pour les onglets
const TAB_COLORS = [
  { value: "blue", label: "Bleu", class: "bg-blue-500", border: "border-blue-500", light: "bg-blue-50" },
  { value: "green", label: "Vert", class: "bg-green-500", border: "border-green-500", light: "bg-green-50" },
  { value: "orange", label: "Orange", class: "bg-orange-500", border: "border-orange-500", light: "bg-orange-50" },
  { value: "purple", label: "Violet", class: "bg-purple-500", border: "border-purple-500", light: "bg-purple-50" },
  { value: "red", label: "Rouge", class: "bg-red-500", border: "border-red-500", light: "bg-red-50" },
  { value: "yellow", label: "Jaune", class: "bg-yellow-500", border: "border-yellow-500", light: "bg-yellow-50" },
  { value: "pink", label: "Rose", class: "bg-pink-500", border: "border-pink-500", light: "bg-pink-50" },
  { value: "cyan", label: "Cyan", class: "bg-cyan-500", border: "border-cyan-500", light: "bg-cyan-50" },
];

// Types de blocs
const BLOCK_TYPES = [
  { value: "text", label: "Texte", icon: Type, bgColor: "bg-white", borderColor: "border-gray-200" },
  {
    value: "checklist",
    label: "Checklist",
    icon: CheckSquare,
    bgColor: "bg-green-50",
    borderColor: "border-green-300",
  },
  {
    value: "warning",
    label: "Attention",
    icon: AlertTriangle,
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-400",
  },
  { value: "tip", label: "Astuce", icon: Lightbulb, bgColor: "bg-blue-50", borderColor: "border-blue-300" },
  { value: "tools", label: "Outils", icon: Wrench, bgColor: "bg-orange-50", borderColor: "border-orange-300" },
  { value: "image", label: "Image", icon: Image, bgColor: "bg-gray-50", borderColor: "border-gray-300" },
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

const MechanicalProcedures = () => {
  // États principaux
  const [gammes, setGammes] = useState<Gamme[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // États de sélection
  const [activeGammeId, setActiveGammeId] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // États des dialogues
  const [isGammeDialogOpen, setIsGammeDialogOpen] = useState(false);
  const [isChapterDialogOpen, setIsChapterDialogOpen] = useState(false);
  const [isDeleteGammeDialogOpen, setIsDeleteGammeDialogOpen] = useState(false);
  const [isDeleteChapterDialogOpen, setIsDeleteChapterDialogOpen] = useState(false);
  const [isEditGammeDialogOpen, setIsEditGammeDialogOpen] = useState(false);

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

  // États pour le drag des blocs
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

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

      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  // Créer une nouvelle gamme
  const handleCreateGamme = async () => {
    if (!newGamme.title) {
      toast.error("Le titre est obligatoire");
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
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

      if (error) throw error;

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
      const { error } = await supabase
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
      const { error } = await supabase.from("mechanical_gammes").delete().eq("id", activeGammeId);

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
      const { data, error } = await supabase
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
      const { error } = await supabase.from("mechanical_chapters").delete().eq("id", activeChapterId);

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

  // Créer un bloc
  const handleCreateBlock = async (type: string) => {
    if (!activeChapterId) {
      toast.error("Sélectionnez un chapitre d'abord");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("mechanical_blocks")
        .insert({
          chapter_id: activeChapterId,
          type: type,
          content: type === "checklist" ? "[] Étape 1\n[] Étape 2" : "",
          position_x: 50 + Math.random() * 100,
          position_y: 50 + blocks.length * 20,
          width: 300,
          height: type === "image" ? 200 : 150,
          order_index: blocks.length,
        })
        .select()
        .single();

      if (error) throw error;

      setBlocks([...blocks, data]);
      setSelectedBlockId(data.id);
      toast.success("Bloc ajouté");
    } catch (error) {
      console.error("Erreur création bloc:", error);
      toast.error("Erreur lors de la création");
    }
  };

  // Mettre à jour un bloc
  const handleUpdateBlock = async (blockId: string, updates: Partial<ContentBlock>) => {
    try {
      const { error } = await supabase.from("mechanical_blocks").update(updates).eq("id", blockId);

      if (error) throw error;

      setBlocks(blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b)));
    } catch (error) {
      console.error("Erreur mise à jour bloc:", error);
    }
  };

  // Supprimer un bloc
  const handleDeleteBlock = async (blockId: string) => {
    try {
      const { error } = await supabase.from("mechanical_blocks").delete().eq("id", blockId);

      if (error) throw error;

      setBlocks(blocks.filter((b) => b.id !== blockId));
      setSelectedBlockId(null);
      toast.success("Bloc supprimé");
    } catch (error) {
      console.error("Erreur suppression bloc:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Drag & Drop des blocs
  const handleBlockMouseDown = (e: React.MouseEvent, blockId: string) => {
    if ((e.target as HTMLElement).closest(".block-content")) return;

    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    setDraggingBlockId(blockId);
    setSelectedBlockId(blockId);

    const rect = (e.target as HTMLElement).closest(".content-block")?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingBlockId || !canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const newX = e.clientX - canvasRect.left - dragOffset.x;
      const newY = e.clientY - canvasRect.top - dragOffset.y;

      setBlocks(
        blocks.map((b) =>
          b.id === draggingBlockId ? { ...b, position_x: Math.max(0, newX), position_y: Math.max(0, newY) } : b,
        ),
      );
    },
    [draggingBlockId, dragOffset, blocks],
  );

  const handleMouseUp = useCallback(() => {
    if (draggingBlockId) {
      const block = blocks.find((b) => b.id === draggingBlockId);
      if (block) {
        handleUpdateBlock(draggingBlockId, {
          position_x: block.position_x,
          position_y: block.position_y,
        });
      }
      setDraggingBlockId(null);
    }
  }, [draggingBlockId, blocks]);

  useEffect(() => {
    if (draggingBlockId) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggingBlockId, handleMouseMove, handleMouseUp]);

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
      toast.success("Image uploadée");
    } catch (error) {
      console.error("Erreur upload:", error);
      toast.error("Erreur lors de l'upload");
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

  // Rendu récursif des chapitres
  const renderChapters = (chapterList: Chapter[], level: number = 0) => {
    return chapterList.map((chapter) => (
      <div key={chapter.id} className="group">
        <div
          className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
            activeChapterId === chapter.id
              ? `${activeGammeColor.light} border-l-4 ${activeGammeColor.border}`
              : "hover:bg-muted"
          }`}
          style={{ paddingLeft: `${8 + level * 16}px` }}
          onClick={() => setActiveChapterId(chapter.id)}
        >
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
    const IconComponent = blockType.icon;

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
          cursor: draggingBlockId === block.id ? "grabbing" : "grab",
        }}
        onMouseDown={(e) => handleBlockMouseDown(e, block.id)}
        onClick={() => setSelectedBlockId(block.id)}
      >
        {/* Header du bloc */}
        <div className={`flex items-center gap-2 px-3 py-2 border-b ${blockType.borderColor} bg-white/50 rounded-t-lg`}>
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <IconComponent className="h-4 w-4" />
          <span className="text-xs font-medium flex-1">{blockType.label}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteBlock(block.id);
            }}
            className="p-1 hover:bg-red-100 rounded text-red-500"
          >
            <X className="h-3 w-3" />
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
          ) : (
            <Textarea
              value={block.content}
              onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
              className="min-h-[80px] bg-transparent border-none resize-none focus-visible:ring-0 p-0"
              placeholder={
                block.type === "checklist"
                  ? "[] Étape 1\n[] Étape 2\n[] Étape 3"
                  : block.type === "warning"
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
        <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize">
          <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-gray-400" />
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
                          ? `${color.light} border-${color.value}-300 bg-white -mb-px`
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
            <div className="flex items-center gap-2 p-2 border-b bg-muted/10">
              <span className="text-sm text-muted-foreground mr-2">Ajouter :</span>
              {BLOCK_TYPES.map((type) => {
                const IconComponent = type.icon;
                return (
                  <Button
                    key={type.value}
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => handleCreateBlock(type.value)}
                    disabled={!activeChapterId}
                  >
                    <IconComponent className="h-4 w-4 mr-1" />
                    {type.label}
                  </Button>
                );
              })}
            </div>

            {/* Canvas des blocs */}
            <div
              ref={canvasRef}
              className="flex-1 relative overflow-auto bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAyMCAwIEwgMCAwIDAgMjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2UwZTBlMCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')]"
              onClick={() => setSelectedBlockId(null)}
            >
              {!activeChapterId ? (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Sélectionnez ou créez un chapitre</p>
                  </div>
                </div>
              ) : blocks.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <StickyNote className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Aucun bloc dans ce chapitre</p>
                    <p className="text-sm">Utilisez la barre d'outils pour ajouter du contenu</p>
                  </div>
                </div>
              ) : (
                <div className="relative min-h-full min-w-full" style={{ minHeight: "1000px", minWidth: "1500px" }}>
                  {blocks.map(renderBlock)}
                </div>
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
