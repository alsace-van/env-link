import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  type: "text" | "checklist" | "warning" | "tip" | "image" | "tools" | "icon" | "audio";
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

const MechanicalProcedures = () => {
  // États principaux
  const [gammes, setGammes] = useState<Gamme[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      const content = type === "checklist" ? "[] Étape 1\n[] Étape 2" : type === "icon" && iconName ? iconName : "";

      // Définir la taille selon le type
      let width = 300;
      let height = 150;

      if (type === "icon") {
        width = 80;
        height = 80;
      } else if (type === "image") {
        height = 200;
      } else if (type === "audio") {
        width = 400;
        height = 320;
      }

      const { data, error } = await (supabase as any)
        .from("mechanical_blocks")
        .insert({
          chapter_id: activeChapterId,
          type: type,
          content: content,
          position_x: 50 + Math.random() * 100,
          position_y: 50 + blocks.length * 20,
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
      toast.success("Bloc ajouté");
    } catch (error) {
      console.error("Erreur création bloc:", error);
      toast.error("Erreur lors de la création");
    }
  };

  // Mettre à jour un bloc
  const handleUpdateBlock = async (blockId: string, updates: Partial<ContentBlock>) => {
    try {
      const { error } = await (supabase as any).from("mechanical_blocks").update(updates).eq("id", blockId);

      if (error) throw error;

      setBlocks(blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b)));
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

  // Resize des blocs
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

  // Plus besoin de useEffect pour les listeners de drag - ils sont attachés dans mousedown

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
      toast.success("Audio uploadé - Vous pouvez maintenant le transcrire");
    } catch (error) {
      console.error("Erreur upload audio:", error);
      toast.error("Erreur lors de l'upload audio");
    }
  };

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
            </div>

            {/* Canvas des blocs */}
            <div
              ref={canvasRef}
              className="flex-1 relative overflow-auto bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAyMCAwIEwgMCAwIDAgMjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2UwZTBlMCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAyMCAwIEwgMCAwIDAgMjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzMzMzMzMyIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')]"
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
                <div
                  key={`blocks-${blocks.length}-${blocks.map((b) => b.id).join("-")}`}
                  className="relative min-h-full min-w-full"
                  style={{ minHeight: "1000px", minWidth: "1500px" }}
                >
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
