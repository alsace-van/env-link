// ============================================
// COMPOSANT: CADGabaritCanvas
// Canvas CAO professionnel pour gabarits CNC
// VERSION: 7.36 - Mode rayures pour alignement de photos
// ============================================
//
// CHANGELOG v7.36 (19/01/2026):
// - Mode "damier" pour les photos: permet de voir à travers pour aligner
// - Modale flottante "Outils photo" détachable (bouton dans menu Outils + menu contextuel)
// - Modale inclut: opacité, rotation, ajustements, recadrage, calibration, marqueurs, calques
// - Modale draggable avec option épingler (reste ouverte après actions)
// - Solution au problème de mélange d'opacité quand 2 photos se superposent
//
// CHANGELOG v7.35 (19/01/2026):
// - Ajout bouton "Isoler (Solo)" dans le menu contextuel des photos
// - Contour de sélection de la photo utilise la couleur du calque correspondant
// - Fix suppression point de calibration: utilisait calibrationData au lieu de backgroundImages[].calibrationData
// - Sélection de photo change automatiquement vers le calque correspondant
// - Surbrillance du calque actif avec sa propre couleur (bordure + ombre)
// - Slider d'opacité dans le menu contextuel des photos (supporte multi-sélection)
// - Bouton "Réinitialiser opacité" dans le menu contextuel des photos
// - Boutons "Premier plan" et "Arrière-plan" dans le menu contextuel (supporte multi-sélection)
// - Fix menu contextuel: repositionnement automatique si proche des bords de l'écran
// - Menu contextuel compact pour les photos (icônes groupées, texte réduit)
// - Fix: menu contextuel accessible sur photos verrouillées (pour déverrouiller)
//
// CHANGELOG v7.34 (19/01/2026):
// - Fix calibration: empêche l'application multiple (décalage cumulatif des points)
// - Fix crop: la position de l'image reste stable après le recadrage
// - Fix opacité calque: l'opacité du calque est maintenant appliquée aux photos
// - Fix opacité photo: le slider modifie uniquement les photos sélectionnées
// - Fix CPU Supabase: intervalMs passé de 30s à 2min
// - Ajout bouton "Calibrer" dans le menu contextuel des photos
//
// CHANGELOG v7.33 (19/01/2026):
// - Fix restauration Supabase: loadSketchData restaure maintenant layers, groups, shapeFills, activeLayerId
// - Fix saveSketch: sauvegarde maintenant layers, groups, shapeFills, activeLayerId
// - Fix menu contextuel Supprimer photo: sauvegarde historique + suppression liens markers
//
// CHANGELOG v7.31 (18/01/2026):
// - Restauration des cotations automatiques (useAutoDimensions.ts)
// - Affiche automatiquement largeur et hauteur en mm lors de la création de rectangles
// - État autoDimensionsEnabled pour activer/désactiver (actif par défaut)
//
// CHANGELOG v7.30 (18/01/2026):
// - Mode Solo: icône pour isoler un calque (masque les autres temporairement)
// - Mode Guide: calques visibles mais non exportés (pour repères)
// - Groupes de calques (dossiers) avec pliage/dépliage
// - Opacité et visibilité appliquées au groupe entier
// - Drag & drop de calques vers les groupes
// - Menu contextuel pour les groupes
//
// CHANGELOG v7.29 (18/01/2026):
// - Nouveau composant LayerTabs avec gestion complète des calques
// - Double-clic pour renommer un calque
// - Menu contextuel (clic droit) sur les calques
// - Couleur personnalisable par calque
// - Opacité par calque (0-100%)
// - Drag & drop pour réorganiser les calques
// - Dupliquer un calque (avec ses géométries)
// - Fusionner deux calques
// - Premier plan / Arrière-plan
//
// CHANGELOG v7.28 (18/01/2026):
// - Menu contextuel (clic droit) sur les images
// - Option "Envoyer vers nouveau calque" pour les images
// - Option "Déplacer vers calque existant" pour les images
// - Optimisations autobackup (fréquence réduite, nettoyage auto)
// - Fix sauvegarde des images en base64 dans les backups
//
// CHANGELOG v7.16 (17/01/2026):
// - Ajout du panneau d'historique des mesures (MeasurePanel.tsx)
// - Ouverture automatique du panneau quand outil mesure activé
// - Bouton compteur à côté de l'outil mesure
// - Import type Measurement depuis MeasurePanel.tsx
// - Sauvegarde des mesures avec le template (saveSketch)
// - Chargement des mesures (loadSketchData)
// - Affichage conditionnel: mesures visibles si panneau ouvert OU outil actif
// - Filtrage des mesures masquées (visible !== false)
// - Noms auto-générés (M1, M2, M3...)
//
// CHANGELOG v7.15 (17/01/2026):
// - Extraction du panneau de calibration dans CalibrationPanel.tsx (~1000 lignes)
// - Panneau de calibration flottant et draggable (position: fixed)
// - Réduction du fichier de 23186 à 22257 lignes (-929 lignes)
// - Import du nouveau composant CalibrationPanel
// - Suppression des états isDraggingCalibPanel et calibPanelDragStart (gérés dans CalibrationPanel)
//
// CHANGELOG v7.14:
// - Auto-backup Supabase pour protection contre les pertes de données
// ============================================

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  MousePointer,
  Hand,
  Minus,
  Circle,
  Square,
  Ruler,
  Link,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  Download,
  FileDown,
  FileUp,
  Maximize,
  Minimize,
  Grid3X3,
  Magnet,
  Settings,
  Undo,
  Redo,
  Trash2,
  Eye,
  EyeOff,
  Image,
  Spline,
  Move,
  Sliders,
  Target,
  Plus,
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Link2,
  Contrast,
  RotateCw,
  Lock,
  Unlock,
  FlipHorizontal2,
  CircleDot,
  History,
  Clock,
  Scissors,
  GitBranch,
  Trash2 as TrashIcon,
  Edit3,
  Eye as EyeIcon2,
  EyeOff as EyeOffIcon2,
  Layers,
  GitMerge,
  ChevronDown,
  SplitSquareVertical,
  Library,
  Scan,
  HelpCircle,
  Palette,
  FileImage,
  Group,
  Ungroup,
  Type,
  PaintBucket,
  MoreVertical,
  Crop,
  Maximize2,
  GripVertical,
  ArrowRight,
  Printer,
  Cloud,
  CloudOff,
  RefreshCw,
  Focus,
  ArrowUpToLine,
  ArrowDownToLine,
  SlidersHorizontal,
  ExternalLink,
  Upload,
} from "lucide-react";

import {
  Point,
  Geometry,
  Line,
  Circle as CircleType,
  Arc,
  Rectangle,
  Bezier,
  Spline as SplineType,
  TextAnnotation,
  Constraint,
  Dimension,
  Sketch,
  Viewport,
  SnapPoint,
  SnapType,
  ToolType,
  Layer,
  LayerGroup,
  GeometryGroup,
  ShapeFill,
  HatchPattern,
  DEFAULT_LAYERS,
  CalibrationData,
  CalibrationPoint,
  CalibrationPair,
  ReferenceRectangle,
  HomographyMatrix,
  DistortionCoefficients,
  BackgroundImage,
  ImageMarker,
  ImageMarkerLink,
  ImageAdjustments,
  CALIBRATION_COLORS,
  MARKER_COLORS,
  DEFAULT_IMAGE_ADJUSTMENTS,
  generateId,
  distance,
  midpoint,
} from "./types";

// Type pour le crop d'image (si absent de types.ts)
interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}
import { CADRenderer } from "./cad-renderer";
import { SnapSystem, DEFAULT_SNAP_SETTINGS, AdditionalSnapPoint } from "./snap-system";
import { computeAffineTransform, warpImageAffine, decomposeAffine, type AffineResult } from "./homography";
import { CADSolver } from "./cad-solver";
import {
  createRectifyingHomography,
  transformPoint,
  warpImage,
  computeTransformedBounds,
  calibrateWithCheckerboard,
  undistortImage,
  undistortPoint,
} from "./homography";

// Export DXF
import { exportToDXF } from "./export-dxf";
import PDFPlanEditor from "./PDFPlanEditor";

// Export PDF
import { jsPDF } from "jspdf";

// Import DXF
import { loadDXFFile, DXFParseResult } from "./dxf-parser";

// Bibliothèque de templates
import { TemplateLibrary } from "./TemplateLibrary";

// Système de toolbar configurable (drag & drop)
import { useToolbarConfig } from "./useToolbarConfig";
import { ToolbarEditor } from "./ToolbarEditor";
// Note: InlineToolbarEditor n'est plus utilisé - le drag & drop est intégré directement

// MOD v80.12: Modale d'impression avec duplication
import { PrintPreviewModal } from "./PrintPreviewModal";

// MOD v7.14: Auto-backup sur Supabase pour protection contre les pertes
import { useCADAutoBackup } from "./useCADAutoBackup";
import { useCalibration } from "./useCalibration";
// MOD v7.32: Drag & drop d'images sur le canvas
import { useImageDragDrop } from "./useImageDragDrop";
import { CalibrationPanel } from "./CalibrationPanel";
import { MeasurePanel, type Measurement } from "./MeasurePanel";
// v7.34: Générateur d'équerre de calibration
import { CalibrationRulerGenerator } from "./CalibrationRulerGenerator";

// MOD v7.15: Contrôles d'étirement manuel
import { ManualStretchControls } from "./ManualStretchControls";

// MOD v7.29: Gestion avancée des calques
import { LayerTabs } from "./LayerTabs";

// MOD v7.36: Modale flottante pour outils photo
import { ImageToolsModal } from "./ImageToolsModal";

// MOD v7.37: Modale de calibration au drop d'image
import { ImageCalibrationModal } from "./ImageCalibrationModal";

// MOD v7.31: Cotations automatiques lors de la création de géométries
import { useAutoDimensions } from "./useAutoDimensions";

// FIX #92: Cache global pour persister l'état pendant le HMR (Hot Module Replacement)
// Cette variable survit aux rechargements de module en dev
declare global {
  interface Window {
    __CAD_HMR_STATE__?: {
      sketch: any;
      backgroundImages: any[];
      markerLinks: any[];
      timestamp: number;
    };
  }
}

interface CADGabaritCanvasProps {
  imageUrl?: string;
  scaleFactor?: number;
  templateId?: string;
  initialData?: any;
  onSave?: (data: any) => void;
}

// Créer un sketch vide
function createEmptySketch(scaleFactor: number = 1): Sketch {
  // Créer les calques par défaut
  const layers = new Map<string, Layer>();
  DEFAULT_LAYERS.forEach((layer) => {
    layers.set(layer.id, { ...layer });
  });

  return {
    id: generateId(),
    name: "Nouveau gabarit",
    points: new Map(),
    geometries: new Map(),
    constraints: new Map(),
    dimensions: new Map(),
    layers,
    layerGroups: new Map(), // Groupes/dossiers de calques
    groups: new Map(), // Groupes de géométries
    shapeFills: new Map(), // Remplissages des formes fermées
    activeLayerId: "trace",
    scaleFactor,
    dof: 0,
    status: "fully-constrained",
  };
}

export function CADGabaritCanvas({
  imageUrl,
  scaleFactor = 2.5, // px per mm par défaut
  templateId = "default",
  initialData,
  onSave,
}: CADGabaritCanvasProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CADRenderer | null>(null);
  // FIX: Lazy initialization pour éviter de recréer à chaque render
  const snapSystemRef = useRef<SnapSystem | null>(null);
  if (!snapSystemRef.current) {
    snapSystemRef.current = new SnapSystem();
  }
  // FIX: Lazy initialization du solveur pour éviter les appels WASM répétés
  const solverRef = useRef<CADSolver | null>(null);
  if (!solverRef.current) {
    solverRef.current = new CADSolver();
  }
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dxfInputRef = useRef<HTMLInputElement>(null);
  const lastMiddleClickRef = useRef<number>(0); // Pour détecter le double-clic molette
  const renderRequestRef = useRef<number | null>(null); // Pour throttler le rendu avec RAF
  const renderDebugTimeRef = useRef<number>(0); // Pour limiter les logs debug
  const isLoadingDataRef = useRef<boolean>(false); // FIX #92: Empêche la suppression d'images pendant loadSketchData

  // State
  const [sketch, setSketch] = useState<Sketch>(() => createEmptySketch(scaleFactor));

  // Ref pour toujours avoir la dernière valeur du sketch (évite les closures stales)
  const sketchRef = useRef<Sketch>(sketch);
  useEffect(() => {
    sketchRef.current = sketch;
  }, [sketch]);

  const [viewport, setViewport] = useState<Viewport>({
    offsetX: 32, // rulerSize
    offsetY: 575, // Sera mis à jour avec la vraie hauteur - rulerSize
    scale: 4, // ~1mm = 4px, proche de la taille réelle sur écran
    width: 800,
    height: 600,
  });

  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [rectangleMode, setRectangleMode] = useState<"corner" | "center">("corner");
  const [polygonSides, setPolygonSides] = useState<number>(6); // Nombre de côtés pour polygone régulier
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  const [referenceHighlight, setReferenceHighlight] = useState<string | null>(null); // Géométrie de référence (vert)
  const [currentSnapPoint, setCurrentSnapPoint] = useState<SnapPoint | null>(null);

  // Épaisseur de trait par défaut pour les nouvelles figures
  const [defaultStrokeWidth, setDefaultStrokeWidth] = useState<number>(1);
  const defaultStrokeWidthRef = useRef<number>(1);
  const STROKE_WIDTH_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

  // Couleur de trait par défaut
  const [defaultStrokeColor, setDefaultStrokeColor] = useState("#000000");
  const defaultStrokeColorRef = useRef<string>("#000000");

  // Synchroniser la ref avec l'état
  useEffect(() => {
    defaultStrokeWidthRef.current = defaultStrokeWidth;
  }, [defaultStrokeWidth]);

  // Synchroniser la ref couleur avec l'état
  useEffect(() => {
    defaultStrokeColorRef.current = defaultStrokeColor;
  }, [defaultStrokeColor]);

  // === États v6.80 - construction et snap calque ===
  const [isConstructionMode, setIsConstructionMode] = useState(false); // Mode lignes de construction
  const [showConstruction, setShowConstruction] = useState(true); // Afficher les lignes de construction
  const [snapToActiveLayerOnly, setSnapToActiveLayerOnly] = useState(false); // Snap uniquement calque actif

  // Ref pour le mode construction (évite stale closure)
  const isConstructionModeRef = useRef(false);
  useEffect(() => {
    isConstructionModeRef.current = isConstructionMode;
  }, [isConstructionMode]);

  // === États v6.87 - Remplissages/Hachures ===
  const [fillDialogOpen, setFillDialogOpen] = useState(false);
  const [fillDialogTarget, setFillDialogTarget] = useState<{
    geoIds: string[];
    path: Path2D;
  } | null>(null);
  const [fillColor, setFillColor] = useState("#3B82F6");
  const [fillOpacity, setFillOpacity] = useState(0.3);
  const [fillType, setFillType] = useState<"solid" | "hatch">("solid");
  const [hatchPattern, setHatchPattern] = useState<HatchPattern>("lines");
  const [hatchAngle, setHatchAngle] = useState(45);
  const [hatchSpacing, setHatchSpacing] = useState(5);

  const [tempGeometry, setTempGeometry] = useState<any>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);

  // Saisie des dimensions du rectangle (style Fusion 360)
  const [rectInputs, setRectInputs] = useState<{
    active: boolean;
    widthValue: string;
    heightValue: string;
    activeField: "width" | "height";
    // v7.32: Flags pour savoir si l'utilisateur est en train d'éditer (pour éviter que la valeur temps réel reprenne)
    editingWidth: boolean;
    editingHeight: boolean;
    // Position écran pour afficher les inputs
    widthInputPos: { x: number; y: number };
    heightInputPos: { x: number; y: number };
  }>({
    active: false,
    widthValue: "",
    heightValue: "",
    activeField: "width",
    editingWidth: false,
    editingHeight: false,
    widthInputPos: { x: 0, y: 0 },
    heightInputPos: { x: 0, y: 0 },
  });
  const widthInputRef = useRef<HTMLInputElement>(null);
  const heightInputRef = useRef<HTMLInputElement>(null);

  // Détection de perpendicularité pendant le tracé
  const [perpendicularInfo, setPerpendicularInfo] = useState<{
    isActive: boolean;
    lineId: string;
    intersectionPoint: { x: number; y: number };
    snappedCursor: { x: number; y: number };
  } | null>(null);

  // État pour l'outil Arc 3 points
  const [arc3Points, setArc3Points] = useState<Point[]>([]); // 3 points temporaires

  // État pour l'outil Symétrie (miroir)
  const [mirrorState, setMirrorState] = useState<{
    phase: "idle" | "waitingAxis1" | "waitingAxis2" | "confirmOffset";
    axisPoint1?: Point;
    axisPoint2?: Point;
    entitiesToMirror: Set<string>;
    axisFromSegment?: string; // ID du segment utilisé comme axe
    offset: number; // Décalage en mm
  }>({
    phase: "idle",
    entitiesToMirror: new Set(),
    offset: 0,
  });

  // État pour le gizmo de transformation (translation/rotation)
  const [showTransformGizmo, setShowTransformGizmo] = useState(false);
  const [transformGizmo, setTransformGizmo] = useState<{
    active: boolean;
    mode: "idle" | "translateX" | "translateY" | "rotate";
    inputValue: string;
    // Position initiale pour annulation
    initialPositions: Map<string, { x: number; y: number }>;
    // Centre du gizmo (en coordonnées monde)
    center: { x: number; y: number };
  }>({
    active: false,
    mode: "idle",
    inputValue: "",
    initialPositions: new Map(),
    center: { x: 0, y: 0 },
  });
  const transformInputRef = useRef<HTMLInputElement>(null);

  // État pour le drag du gizmo
  const [gizmoDrag, setGizmoDrag] = useState<{
    active: boolean;
    mode: "translateX" | "translateY" | "rotate";
    startPos: { x: number; y: number };
    startAngle: number; // Pour la rotation
    currentValue: number; // Valeur actuelle en mm ou degrés
    initialPositions: Map<string, { x: number; y: number }>;
    center: { x: number; y: number };
  } | null>(null);

  // Ref pour gizmoDrag (éviter stale closure dans handleKeyDown)
  const gizmoDragRef = useRef(gizmoDrag);
  useEffect(() => {
    gizmoDragRef.current = gizmoDrag;
  }, [gizmoDrag]);

  // Ref pour throttle du gizmoDrag (fluidité)
  const gizmoDragRAFRef = useRef<number | null>(null);
  const pendingGizmoDragPosRef = useRef<{ x: number; y: number } | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showConstraints, setShowConstraints] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showBackgroundImage, setShowBackgroundImage] = useState(true);
  const [imageOpacity, setImageOpacity] = useState(0.5);

  // MOD v7.31: Cotations automatiques
  const [autoDimensionsEnabled, setAutoDimensionsEnabled] = useState(true);

  // === Grille A4 pour export panoramique ===
  const [showA4Grid, setShowA4Grid] = useState(false);
  const [a4GridOrigin, setA4GridOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [a4GridOrientation, setA4GridOrientation] = useState<"portrait" | "landscape">("portrait");
  const [selectedA4Cells, setSelectedA4Cells] = useState<Set<string>>(new Set()); // Format: "row-col"
  const [a4GridRows, setA4GridRows] = useState(3);
  const [a4GridCols, setA4GridCols] = useState(4);
  const [isDraggingA4Origin, setIsDraggingA4Origin] = useState(false);
  const [a4OverlapMm, setA4OverlapMm] = useState(0); // Chevauchement en mm (0-20)
  const [a4CutMode, setA4CutMode] = useState(false); // Mode plan de coupe (sans images)
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;

  // === Nouveaux états v6.79 ===
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);
  const [lockedPoints, setLockedPoints] = useState<Set<string>>(new Set());
  const [showExportDialog, setShowExportDialog] = useState<"png" | "pdf" | null>(null);

  // MOD v7.12: Modale d'export DXF avec nom de fichier personnalisé
  const [dxfExportDialog, setDxfExportDialog] = useState<{
    open: boolean;
    filename: string;
    position: { x: number; y: number };
  } | null>(null);

  // === Multi-photos ===
  const [backgroundImages, setBackgroundImages] = useState<BackgroundImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  // MOD v80.1: Multi-sélection d'images avec Ctrl+clic pour rotation par lot
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [imageDragStart, setImageDragStart] = useState<{ x: number; y: number; imgX: number; imgY: number } | null>(
    null,
  );
  // Refs pour accéder aux images depuis les event handlers (évite stale closures)
  const backgroundImagesRef = useRef<BackgroundImage[]>([]);
  const markerLinksRef = useRef<ImageMarkerLink[]>([]);

  // === Marqueurs inter-photos ===
  const [markerLinks, setMarkerLinks] = useState<ImageMarkerLink[]>([]);
  const [markerMode, setMarkerMode] = useState<"idle" | "addMarker" | "linkMarker1" | "linkMarker2">("idle");
  const [pendingLink, setPendingLink] = useState<{ imageId: string; markerId: string } | null>(null);
  const [linkDistanceDialog, setLinkDistanceDialog] = useState<{
    open: boolean;
    marker1: { imageId: string; markerId: string };
    marker2: { imageId: string; markerId: string };
    distance: string;
  } | null>(null);
  // Sélection et drag des markers
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null); // Format: "imageId:markerId"
  const [draggingMarker, setDraggingMarker] = useState<{
    imageId: string;
    markerId: string;
    startPos: { x: number; y: number };
  } | null>(null);

  // === Crop d'images ===
  const [cropMode, setCropMode] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  // v7.34: Générateur d'équerre de calibration
  const [showCalibrationRulerGenerator, setShowCalibrationRulerGenerator] = useState(false);
  const [cropSelection, setCropSelection] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const [cropPanelPos, setCropPanelPos] = useState({ x: 100, y: 100 });
  const [cropPanelDragging, setCropPanelDragging] = useState(false);
  const [cropPanelDragStart, setCropPanelDragStart] = useState({ x: 0, y: 0 });
  const [cropDragging, setCropDragging] = useState<"move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | null>(
    null,
  );
  const [cropDragStart, setCropDragStart] = useState<{
    x: number;
    y: number;
    crop: { x: number; y: number; width: number; height: number };
  }>({
    x: 0,
    y: 0,
    crop: { x: 0, y: 0, width: 100, height: 100 },
  });

  // Panneau d'ajustements d'image (draggable)
  const [adjustmentsPanelPos, setAdjustmentsPanelPos] = useState({ x: 100, y: 200 });
  const [adjustmentsPanelDragging, setAdjustmentsPanelDragging] = useState(false);
  const [adjustmentsPanelDragStart, setAdjustmentsPanelDragStart] = useState({ x: 0, y: 0 });

  // Synchroniser les refs avec les états
  useEffect(() => {
    backgroundImagesRef.current = backgroundImages;
  }, [backgroundImages]);

  useEffect(() => {
    markerLinksRef.current = markerLinks;
  }, [markerLinks]);

  // Surbrillance des formes fermées
  const [highlightOpacity, setHighlightOpacity] = useState(0.12);
  const [mouseWorldPos, setMouseWorldPos] = useState<{ x: number; y: number } | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Drag des poignées
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<{ type: "point" | "handle"; id: string; handleType?: string } | null>(
    null,
  );
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastDragPos, setLastDragPos] = useState({ x: 0, y: 0 });

  // Drag de sélection (déplacement de formes entières)
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [selectionDragStart, setSelectionDragStart] = useState({ x: 0, y: 0 });
  const [potentialSelectionDrag, setPotentialSelectionDrag] = useState(false);

  // Sélection rectangulaire (box selection)
  const [selectionBox, setSelectionBox] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null>(null);

  const [dimensionDialog, setDimensionDialog] = useState<{
    open: boolean;
    type: "distance" | "radius" | "angle";
    entities: string[];
    initialValue: number;
  } | null>(null);

  // Dialog pour contrainte d'angle
  const [angleConstraintDialog, setAngleConstraintDialog] = useState<{
    open: boolean;
    entities: string[]; // IDs des 2 lignes
    currentAngle: number; // Angle actuel en degrés
  } | null>(null);

  // v7.31: État pour édition inline d'une dimension (double-clic sur cotation)
  const [editingDimension, setEditingDimension] = useState<{
    dimensionId: string;
    entityId: string; // ID de la géométrie à modifier
    type: "line" | "circle";
    currentValue: number; // Valeur actuelle en mm
    screenPos: { x: number; y: number };
  } | null>(null);

  // Interface pour les entrées d'historique avec description
  interface HistoryEntry {
    sketch: any; // Sketch sérialisé
    backgroundImages?: any[]; // Images de fond sérialisées (sans l'objet Image)
    description: string;
    timestamp: number;
  }

  // === SYSTÈME DE BRANCHES ===
  // Couleurs disponibles pour les branches (max 10)
  const BRANCH_COLORS = [
    "#3B82F6", // Bleu
    "#F97316", // Orange
    "#22C55E", // Vert
    "#A855F7", // Violet
    "#EC4899", // Rose
    "#06B6D4", // Cyan
    "#EAB308", // Jaune
    "#EF4444", // Rouge
    "#6366F1", // Indigo
    "#14B8A6", // Teal
  ];

  interface Branch {
    id: string;
    name: string;
    color: string;
    history: HistoryEntry[];
    historyIndex: number;
    parentBranchId?: string;
    parentHistoryIndex?: number;
    createdAt: number;
  }

  // États des branches
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>("");
  const branchesRef = useRef<{ branches: Branch[]; activeBranchId: string }>({ branches: [], activeBranchId: "" });

  // Mode comparaison
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonStyle, setComparisonStyle] = useState<"overlay" | "reveal">("overlay"); // overlay = superposition, reveal = rideau
  const [visibleBranches, setVisibleBranches] = useState<Set<string>>(new Set());
  const [comparisonOpacity, setComparisonOpacity] = useState(70); // 0-100 pour mode overlay
  const [revealPosition, setRevealPosition] = useState(50); // 0-100 position du diviseur pour mode reveal
  const [revealBranchId, setRevealBranchId] = useState<string | null>(null); // Branche à comparer en mode reveal
  const [isDraggingReveal, setIsDraggingReveal] = useState(false); // Drag du diviseur
  const isDraggingRevealRef = useRef(false); // Ref pour éviter stale closure

  // Sync ref avec state
  useEffect(() => {
    isDraggingRevealRef.current = isDraggingReveal;
  }, [isDraggingReveal]);

  // Maintenir la cohérence de revealBranchId quand la branche active change
  useEffect(() => {
    // Vérifier si la branche reveal actuelle est valide
    const currentRevealBranch = branches.find((b) => b.id === revealBranchId);
    const isInvalid = !revealBranchId || revealBranchId === activeBranchId || !currentRevealBranch;

    if (isInvalid && branches.length > 1) {
      // Sélectionner la première branche qui n'est pas la branche active
      const otherBranch = branches.find((b) => b.id !== activeBranchId);
      if (otherBranch) {
        setRevealBranchId(otherBranch.id);
      }
    }
  }, [activeBranchId, branches, revealBranchId]);

  // Helper pour obtenir la branche active
  const getActiveBranch = useCallback((): Branch | null => {
    return branches.find((b) => b.id === activeBranchId) || null;
  }, [branches, activeBranchId]);

  // Helper pour obtenir l'historique et l'index actuels (pour compatibilité)
  const history = useMemo(() => {
    const branch = branches.find((b) => b.id === activeBranchId);
    return branch?.history || [];
  }, [branches, activeBranchId]);

  const historyIndex = useMemo(() => {
    const branch = branches.find((b) => b.id === activeBranchId);
    return branch?.historyIndex ?? -1;
  }, [branches, activeBranchId]);

  // Ref pour compatibilité avec le code existant
  const historyRef = useRef<{ history: HistoryEntry[]; index: number }>({ history: [], index: -1 });

  // Panneau d'historique (sidebar)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [previewHistoryIndex, setPreviewHistoryIndex] = useState<number | null>(null);

  // Modales de gestion des branches
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [comparisonModalPos, setComparisonModalPos] = useState({ x: window.innerWidth - 320, y: 100 });
  const [renamingBranchId, setRenamingBranchId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [mergeBranchIds, setMergeBranchIds] = useState<{ source: string | null; target: string | null }>({
    source: null,
    target: null,
  });

  // Panning pour le flowchart de vue d'ensemble
  const flowchartContainerRef = useRef<HTMLDivElement>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [grabStart, setGrabStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Historique séparé pour les images (car HTMLImageElement ne peut pas être sérialisé)
  // Fonctionne comme une PILE : on empile avant suppression, on dépile pour restaurer
  // MOD v7.12: Ajout timestamp pour synchroniser avec l'historique du sketch
  interface ImageHistoryState {
    backgroundImages: BackgroundImage[];
    markerLinks: ImageMarkerLink[];
    timestamp: number; // Pour comparer avec HistoryEntry.timestamp
  }
  const [imageHistory, setImageHistory] = useState<ImageHistoryState[]>([]);
  const imageHistoryRef = useRef<ImageHistoryState[]>([]);

  // Synchroniser les refs
  useEffect(() => {
    const branch = branches.find((b) => b.id === activeBranchId);
    if (branch) {
      historyRef.current = { history: branch.history, index: branch.historyIndex };
    }
    branchesRef.current = { branches, activeBranchId };
  }, [branches, activeBranchId]);

  useEffect(() => {
    imageHistoryRef.current = imageHistory;
  }, [imageHistory]);

  // Initialiser avec une branche par défaut au montage
  const historyInitializedRef = useRef(false);
  useEffect(() => {
    if (!historyInitializedRef.current) {
      historyInitializedRef.current = true;
      const initialEntry: HistoryEntry = {
        sketch: serializeSketch(sketch),
        description: "État initial",
        timestamp: Date.now(),
      };
      const mainBranch: Branch = {
        id: generateId(),
        name: "Principal",
        color: BRANCH_COLORS[0],
        history: [initialEntry],
        historyIndex: 0,
        createdAt: Date.now(),
      };
      setBranches([mainBranch]);
      setActiveBranchId(mainBranch.id);
      setVisibleBranches(new Set([mainBranch.id]));
      branchesRef.current = { branches: [mainBranch], activeBranchId: mainBranch.id };
      historyRef.current = { history: [initialEntry], index: 0 };
    }
  }, []);

  // Calibration
  const [calibrationData, setCalibrationData] = useState<CalibrationData>({
    points: new Map(),
    pairs: new Map(),
    applied: false,
    mode: "simple",
  });
  const [showCalibrationPanel, setShowCalibrationPanel] = useState(false);
  // MOD UX: Position du panneau de calibration flottant
  const [calibrationPanelPos, setCalibrationPanelPos] = useState({ x: window.innerWidth - 320, y: 100 });
  // MOD v7.16: Panneau d'historique des mesures flottant
  const [showMeasurePanel, setShowMeasurePanel] = useState(false);
  const [measurePanelPos, setMeasurePanelPos] = useState({ x: window.innerWidth - 320, y: 400 });
  const [showAdjustmentsDialog, setShowAdjustmentsDialog] = useState(false);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  // MOD v80.13: Modale d'impression avec duplication
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  // MOD v7.36: Modale flottante pour outils photo
  const [showImageToolsModal, setShowImageToolsModal] = useState(false);
  const [imageToolsModalPos, setImageToolsModalPos] = useState({ x: 100, y: 100 });
  const [highlightedPairId, setHighlightedPairId] = useState<string | null>(null);
  // MOD v7.37: Modale de calibration au drop d'image
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [pendingCalibrationImage, setPendingCalibrationImage] = useState<BackgroundImage | null>(null);

  // ============================================
  // NOUVEAU SYSTÈME DE TOOLBAR CONFIGURABLE (v7.11)
  // Remplace l'ancien système de booléens par drag & drop
  // ============================================
  const {
    config: newToolbarConfig,
    toolDefinitions,
    isEditorOpen: isToolbarEditorOpen,
    setEditorOpen: setToolbarEditorOpen,
    updateConfig: updateToolbarConfig,
    isToolVisible,
  } = useToolbarConfig();

  // Mode édition inline de la toolbar (drag & drop direct)
  const [toolbarEditMode, setToolbarEditMode] = useState(false);

  // Compatibilité avec l'ancien code - convertir la nouvelle config vers l'ancien format
  const toolbarConfig = useMemo(() => {
    const result: {
      line1: { [key: string]: boolean };
      line2: { [key: string]: boolean };
    } = {
      line1: {
        save: isToolVisible("save"),
        import: isToolVisible("import"),
        photos: isToolVisible("photos"),
        exportSvg: isToolVisible("exportSvg"),
        exportPng: isToolVisible("exportPng"),
        exportDxf: isToolVisible("exportDxf"),
        exportPdf: isToolVisible("exportPdf"),
        templates: isToolVisible("templates"),
        help: isToolVisible("help"),
      },
      line2: {
        selectPan: isToolVisible("select") || isToolVisible("pan"),
        transform: isToolVisible("mirror") || isToolVisible("moveRotate"),
        drawBasic: isToolVisible("line") || isToolVisible("circle") || isToolVisible("rectangle"),
        drawAdvanced: isToolVisible("spline") || isToolVisible("polygon"),
        modifications: isToolVisible("fillet") || isToolVisible("chamfer") || isToolVisible("offset"),
        photoTools: isToolVisible("showBackground") || isToolVisible("addMarker"),
        dimensions: isToolVisible("dimension") || isToolVisible("measure"),
        viewControls: isToolVisible("zoomIn") || isToolVisible("toggleGrid"),
        history: isToolVisible("undo") || isToolVisible("redo"),
        branches: isToolVisible("branchSelect") || isToolVisible("branchCreate"),
      },
    };
    return result;
  }, [isToolVisible]);

  // Fonction de compatibilité - ne fait plus rien car géré par le nouveau système
  const toggleToolbarItem = useCallback(
    (line: "line1" | "line2", item: string) => {
      // Ouvrir l'éditeur de toolbar à la place
      setToolbarEditorOpen(true);
    },
    [setToolbarEditorOpen],
  );

  // Calibration
  const [calibrationMode, setCalibrationMode] = useState<
    "idle" | "addPoint" | "selectPair1" | "selectPair2" | "selectRect"
  >("idle");
  const [selectedCalibrationPoint, setSelectedCalibrationPoint] = useState<string | null>(null);
  const [newPairDistance, setNewPairDistance] = useState<string>("");
  const [newPairColor, setNewPairColor] = useState<string>(CALIBRATION_COLORS[0]);
  const [draggingCalibrationPoint, setDraggingCalibrationPoint] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState<number>(1);

  // Mode perspective
  const [rectPoints, setRectPoints] = useState<string[]>([]); // IDs des 4 points du rectangle
  const [rectWidth, setRectWidth] = useState<string>(""); // Largeur en mm
  const [rectHeight, setRectHeight] = useState<string>(""); // Hauteur en mm
  const [transformedImage, setTransformedImage] = useState<HTMLCanvasElement | null>(null);
  const [perspectiveMethod, setPerspectiveMethod] = useState<"rectangle" | "checkerboard">("rectangle");

  // Mode damier
  const [checkerCornersX, setCheckerCornersX] = useState<string>("7"); // Coins intérieurs en X (8 cases = 7 coins)
  const [checkerCornersY, setCheckerCornersY] = useState<string>("5"); // Coins intérieurs en Y (6 cases = 5 coins)
  const [checkerSquareSize, setCheckerSquareSize] = useState<string>("30"); // Taille d'une case en mm

  // === HOOK DE CALIBRATION ===
  // MOD: Extraction des fonctions de calibration dans useCalibration.ts
  const {
    getSelectedImage,
    getSelectedImageCalibration,
    updateSelectedImageCalibration,
    calculateCalibration,
    applyCalibration,
    resetCalibration,
    addCalibrationPoint,
    removeCalibrationPoint,
    addCalibrationPair,
    removeCalibrationPair,
    updatePairDistance,
  } = useCalibration({
    selectedImageId,
    backgroundImages,
    calibrationData,
    sketch,
    sketchRef,
    backgroundImageRef,
    rectPoints,
    rectWidth,
    rectHeight,
    perspectiveMethod,
    checkerCornersX,
    checkerCornersY,
    checkerSquareSize,
    setBackgroundImages,
    setCalibrationData,
    setSketch,
    setCalibrationMode,
    setSelectedCalibrationPoint,
    setRectPoints,
    setRectWidth,
    setRectHeight,
    setImageScale,
    setTransformedImage,
  });

  // MOD v7.31: Cotations automatiques lors de la création de géométries
  const { addRectangleDimensions, addLineDimension } = useAutoDimensions({
    enabled: autoDimensionsEnabled,
    sketchRef,
  });

  // Mesure - utiliser un seul état pour éviter les problèmes de synchronisation
  const [measureState, setMeasureState] = useState<{
    phase: "idle" | "waitingSecond" | "complete";
    start: { x: number; y: number } | null;
    end: { x: number; y: number } | null;
    result: { px: number; mm: number } | null;
    segment1Id?: string | null; // ID du segment cliqué au premier point
  }>({
    phase: "idle",
    start: null,
    end: null,
    result: null,
    segment1Id: null,
  });
  const [measurePreviewEnd, setMeasurePreviewEnd] = useState<{ x: number; y: number } | null>(null);

  // Tableau des mesures persistantes - MOD v7.16: Type importé depuis MeasurePanel
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  // État pour le déplacement d'un point de mesure
  const [draggingMeasurePoint, setDraggingMeasurePoint] = useState<{
    measureId: string;
    pointType: "start" | "end";
  } | null>(null);

  // Presse-papier pour copier/coller
  const [clipboard, setClipboard] = useState<{
    points: Map<string, Point>;
    geometries: Map<string, Geometry>;
    center: { x: number; y: number };
  } | null>(null);

  // Fillet et Chamfer
  const [filletRadius, setFilletRadius] = useState<number>(5); // Rayon en mm
  const [chamferDistance, setChamferDistance] = useState<number>(5); // Distance en mm
  const [filletFirstLine, setFilletFirstLine] = useState<string | null>(null); // ID de la première ligne sélectionnée

  // Offset
  const [offsetDistance, setOffsetDistance] = useState<number>(10); // Distance en mm
  const [offsetDirection, setOffsetDirection] = useState<"outside" | "inside">("outside");
  const [offsetDialog, setOffsetDialog] = useState<{
    open: boolean;
    selectedEntities: Set<string>;
  } | null>(null);
  const [offsetPanelPos, setOffsetPanelPos] = useState({ x: 100, y: 100 });
  const [offsetPanelDragging, setOffsetPanelDragging] = useState(false);
  const [offsetPanelDragStart, setOffsetPanelDragStart] = useState({ x: 0, y: 0 });
  const [offsetPreview, setOffsetPreview] = useState<
    Array<{
      type: "line" | "circle" | "arc";
      points?: Array<{ x: number; y: number }>;
      center?: { x: number; y: number };
      radius?: number;
      startAngle?: number;
      endAngle?: number;
      counterClockwise?: boolean;
    }>
  >([]);

  // Preview pour congé/chanfrein (temps réel)
  const [filletPreview, setFilletPreview] = useState<
    Array<{
      type: "arc";
      center: { x: number; y: number };
      radius: number;
      startAngle: number;
      endAngle: number;
      counterClockwise: boolean;
      tan1: { x: number; y: number };
      tan2: { x: number; y: number };
    }>
  >([]);
  const [chamferPreview, setChamferPreview] = useState<
    Array<{
      type: "line";
      p1: { x: number; y: number };
      p2: { x: number; y: number };
    }>
  >([]);

  // Modale pour congé
  const [filletDialog, setFilletDialog] = useState<{
    open: boolean;
    corners: Array<{
      pointId: string;
      maxRadius: number;
      angleDeg: number;
      radius: number;
      // Pour congé asymétrique: distances sur chaque branche (en mm)
      dist1: number;
      dist2: number;
      maxDist1: number;
      maxDist2: number;
      line1Id: string;
      line2Id: string;
    }>;
    globalRadius: number;
    minMaxRadius: number;
    hoveredCornerIdx: number | null;
    asymmetric: boolean; // Mode asymétrique
    addDimension: boolean; // Ajouter cotation auto
    repeatMode: boolean; // Mode répétition
  } | null>(null);
  const [filletPanelPos, setFilletPanelPos] = useState({ x: 100, y: 100 });
  const [filletPanelDragging, setFilletPanelDragging] = useState(false);
  const [filletPanelDragStart, setFilletPanelDragStart] = useState({ x: 0, y: 0 });

  // Modale pour chanfrein
  const [chamferDialog, setChamferDialog] = useState<{
    open: boolean;
    corners: Array<{
      pointId: string;
      maxDistance: number;
      angleDeg: number;
      distance: number;
      // Pour chanfrein asymétrique
      dist1: number;
      dist2: number;
      maxDist1: number;
      maxDist2: number;
      line1Id: string;
      line2Id: string;
    }>;
    globalDistance: number;
    minMaxDistance: number;
    hoveredCornerIdx: number | null;
    asymmetric: boolean;
    addDimension: boolean;
    repeatMode: boolean;
  } | null>(null);
  const [chamferPanelPos, setChamferPanelPos] = useState({ x: 100, y: 150 });
  const [chamferPanelDragging, setChamferPanelDragging] = useState(false);
  const [chamferPanelDragStart, setChamferPanelDragStart] = useState({ x: 0, y: 0 });

  // Menu contextuel (clic droit)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entityId: string;
    entityType: string;
    shapeGeoIds?: string[]; // Pour les formes fermées (remplissage)
    shapePath?: Path2D; // Path de la forme pour le fill
  } | null>(null);

  // Modale pour modifier le rayon d'un arc existant
  const [arcEditDialog, setArcEditDialog] = useState<{
    open: boolean;
    arcId: string;
    currentRadius: number;
  } | null>(null);

  // Modale pour modifier la longueur d'une ligne
  const [lineLengthDialog, setLineLengthDialog] = useState<{
    open: boolean;
    lineId: string;
    currentLength: number; // en mm
    newLength: string;
    anchorMode: "p1" | "p2" | "center"; // Point d'ancrage
    originalSketch: Sketch | null; // Sketch original pour annulation
  } | null>(null);
  const [lineLengthPanelPos, setLineLengthPanelPos] = useState({ x: 100, y: 100 });
  const [lineLengthPanelDragging, setLineLengthPanelDragging] = useState(false);
  const [lineLengthPanelDragStart, setLineLengthPanelDragStart] = useState({ x: 0, y: 0 });

  // Modale pour modifier un angle
  const [angleEditDialog, setAngleEditDialog] = useState<{
    open: boolean;
    pointId: string; // Le point du coin
    line1Id: string;
    line2Id: string;
    currentAngle: number; // en degrés
    newAngle: string;
    anchorMode: "line1" | "line2" | "symmetric"; // Quelle ligne reste fixe
    originalSketch: Sketch | null; // Sketch original pour annulation
  } | null>(null);
  const [anglePanelPos, setAnglePanelPos] = useState({ x: 100, y: 100 });
  const [anglePanelDragging, setAnglePanelDragging] = useState(false);
  const [anglePanelDragStart, setAnglePanelDragStart] = useState({ x: 0, y: 0 });

  // === FONCTION POUR FERMER TOUS LES PANNEAUX D'ÉDITION ===
  // Évite la confusion quand plusieurs panneaux sont ouverts
  const closeAllEditPanels = useCallback(
    (except?: string) => {
      if (except !== "fillet") setFilletDialog(null);
      if (except !== "chamfer") setChamferDialog(null);
      if (except !== "arcEdit") setArcEditDialog(null);
      if (except !== "lineLength") {
        // Si on ferme le panneau longueur, restaurer le sketch original si nécessaire
        if (lineLengthDialog?.originalSketch) {
          setSketch(lineLengthDialog.originalSketch);
        }
        setLineLengthDialog(null);
      }
      if (except !== "angle") {
        // Si on ferme le panneau angle, restaurer le sketch original si nécessaire
        if (angleEditDialog?.originalSketch) {
          setSketch(angleEditDialog.originalSketch);
        }
        setAngleEditDialog(null);
      }
      if (except !== "fill") {
        setFillDialogOpen(false);
        setFillDialogTarget(null);
      }
      if (except !== "text") setTextInput(null);
      if (except !== "context") setContextMenu(null);
    },
    [lineLengthDialog, angleEditDialog],
  );

  // Modale pour répétition/array
  const [arrayDialog, setArrayDialog] = useState<{
    open: boolean;
    type: "linear" | "grid" | "circular" | "checkerboard";
    // Linéaire
    linearCount: number;
    linearSpacing: string; // mm - string pour permettre la saisie
    linearSpacingMode: "spacing" | "distance";
    linearDirection: "x" | "y" | "custom"; // Direction de la répétition
    linearAngle: string; // Angle personnalisé en degrés
    // Grille
    countX: number;
    spacingX: string; // mm - string pour permettre la saisie
    spacingModeX: "spacing" | "distance";
    countY: number;
    spacingY: string; // mm - string pour permettre la saisie
    spacingModeY: "spacing" | "distance";
    // Circulaire
    circularCount: number;
    circularAngle: string; // angle total en degrés (360 = cercle complet) - string
    circularCenter: { x: number; y: number } | null;
    // Damier (checkerboard)
    checkerCountX: string; // Nombre de cases en X (string pour saisie fluide)
    checkerCountY: string; // Nombre de cases en Y (string pour saisie fluide)
    checkerSize: string; // Taille d'une case en mm
    checkerColor: string; // Couleur des cases noires
    // Général
    includeOriginal: boolean;
    createIntersections: boolean; // Créer les points d'intersection
  } | null>(null);
  const [arrayPanelPos, setArrayPanelPos] = useState({ x: 100, y: 100 });
  const [arrayPanelDragging, setArrayPanelDragging] = useState(false);
  const [arrayPanelDragStart, setArrayPanelDragStart] = useState({ x: 0, y: 0 });

  // Prévisualisation de la répétition en temps réel (useMemo pour performance)
  // Extraire uniquement les valeurs nécessaires pour éviter les recalculs inutiles
  const arrayPreviewData = useMemo(() => {
    if (!arrayDialog?.open) {
      return null;
    }

    // Le mode damier ne nécessite pas de sélection
    if (arrayDialog.type === "checkerboard") {
      return { centerX: 0, centerY: 0, scaleFactor: sketch.scaleFactor, isCheckerboard: true };
    }

    if (selectedEntities.size === 0) {
      return null;
    }

    // Extraire les points des entités sélectionnées une seule fois
    const selectedPoints: Array<{ x: number; y: number }> = [];
    selectedEntities.forEach((id) => {
      const geo = sketch.geometries.get(id);
      if (geo) {
        if (geo.type === "line") {
          const line = geo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (p1) selectedPoints.push({ x: p1.x, y: p1.y });
          if (p2) selectedPoints.push({ x: p2.x, y: p2.y });
        } else if (geo.type === "circle") {
          const center = sketch.points.get((geo as CircleType).center);
          if (center) selectedPoints.push({ x: center.x, y: center.y });
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          const center = sketch.points.get(arc.center);
          if (center) selectedPoints.push({ x: center.x, y: center.y });
        } else if (geo.type === "rectangle") {
          const rect = geo as Rectangle;
          [rect.p1, rect.p2, rect.p3, rect.p4].forEach((pid) => {
            const p = sketch.points.get(pid);
            if (p) selectedPoints.push({ x: p.x, y: p.y });
          });
        }
      }
    });

    if (selectedPoints.length === 0) return null;

    let centerX = 0,
      centerY = 0;
    selectedPoints.forEach((p) => {
      centerX += p.x;
      centerY += p.y;
    });
    centerX /= selectedPoints.length;
    centerY /= selectedPoints.length;

    return { centerX, centerY, scaleFactor: sketch.scaleFactor };
  }, [arrayDialog?.open, selectedEntities, sketch.geometries, sketch.points, sketch.scaleFactor]);

  // Calcul du preview séparé (ne dépend que de arrayDialog et des données extraites)
  const arrayPreview = useMemo(() => {
    if (!arrayDialog?.open || !arrayPreviewData) {
      return null;
    }

    const {
      type,
      linearCount,
      linearSpacing,
      linearSpacingMode,
      linearDirection,
      linearAngle,
      countX,
      spacingX,
      spacingModeX,
      countY,
      spacingY,
      spacingModeY,
      circularCount,
      circularAngle,
      circularCenter,
      includeOriginal,
    } = arrayDialog;

    const { centerX: baseCenterX, centerY: baseCenterY, scaleFactor } = arrayPreviewData;

    // Parser les valeurs (peuvent être string ou number pour compatibilité)
    const linearSpacingStr = typeof linearSpacing === "string" ? linearSpacing : String(linearSpacing || "50");
    const spacingXStr = typeof spacingX === "string" ? spacingX : String(spacingX || "50");
    const spacingYStr = typeof spacingY === "string" ? spacingY : String(spacingY || "50");
    const circularAngleStr = typeof circularAngle === "string" ? circularAngle : String(circularAngle || "360");
    const linearAngleStr = typeof linearAngle === "string" ? linearAngle : String(linearAngle || "0");

    const linearSpacingNum = parseFloat(linearSpacingStr.replace(",", ".")) || 0;
    const spacingXNum = parseFloat(spacingXStr.replace(",", ".")) || 0;
    const spacingYNum = parseFloat(spacingYStr.replace(",", ".")) || 0;
    const circularAngleNum = parseFloat(circularAngleStr.replace(",", ".")) || 360;
    const linearAngleNum = parseFloat(linearAngleStr.replace(",", ".")) || 0;

    // Calculer l'espacement réel selon le mode
    const realLinearSpacing =
      linearSpacingMode === "distance" && (linearCount || 3) > 1
        ? linearSpacingNum / ((linearCount || 3) - 1)
        : linearSpacingNum;
    const realSpacingX = spacingModeX === "distance" && countX > 1 ? spacingXNum / (countX - 1) : spacingXNum;
    const realSpacingY = spacingModeY === "distance" && countY > 1 ? spacingYNum / (countY - 1) : spacingYNum;

    // Utiliser le centre personnalisé pour circulaire
    let centerX = baseCenterX;
    let centerY = baseCenterY;
    if (type === "circular" && circularCenter) {
      centerX = circularCenter.x;
      centerY = circularCenter.y;
    }

    const transforms: Array<{ offsetX: number; offsetY: number; rotation: number }> = [];

    if (type === "linear") {
      // Calculer la direction en radians
      let dirAngle = 0; // Par défaut X (0°)
      if (linearDirection === "y") {
        dirAngle = Math.PI / 2; // 90°
      } else if (linearDirection === "custom") {
        dirAngle = (linearAngleNum * Math.PI) / 180;
      }

      const dirX = Math.cos(dirAngle);
      const dirY = Math.sin(dirAngle);

      const startIdx = includeOriginal ? 1 : 0;
      const count = linearCount || 3;
      for (let i = startIdx; i < count; i++) {
        const dist = i * realLinearSpacing * scaleFactor;
        transforms.push({
          offsetX: dist * dirX,
          offsetY: dist * dirY,
          rotation: 0,
        });
      }
    } else if (type === "grid") {
      for (let row = 0; row < countY; row++) {
        for (let col = 0; col < countX; col++) {
          if (row === 0 && col === 0) continue; // Ne pas afficher l'original en preview
          transforms.push({
            offsetX: col * realSpacingX * scaleFactor,
            offsetY: row * realSpacingY * scaleFactor,
            rotation: 0,
          });
        }
      }
    } else if (type === "circular") {
      const angleStep = (circularAngleNum / circularCount) * (Math.PI / 180);
      const startIdx = includeOriginal ? 1 : 0;
      for (let i = startIdx; i < circularCount; i++) {
        const rotation = i * angleStep;
        transforms.push({ offsetX: 0, offsetY: 0, rotation });
      }
    } else if (type === "checkerboard") {
      // Mode damier - retourner les données du damier pour le preview
      const { checkerCountX, checkerCountY, checkerSize, checkerColor } = arrayDialog;
      const countXStr = typeof checkerCountX === "string" ? checkerCountX : String(checkerCountX || "8");
      const countYStr = typeof checkerCountY === "string" ? checkerCountY : String(checkerCountY || "6");
      const sizeStr = typeof checkerSize === "string" ? checkerSize : String(checkerSize || "20");

      const countXNum = parseInt(countXStr) || 8;
      const countYNum = parseInt(countYStr) || 6;
      const sizePx = (parseFloat(sizeStr.replace(",", ".")) || 20) * scaleFactor;

      return {
        transforms: [],
        centerX: 0,
        centerY: 0,
        checkerboard: {
          countX: Math.max(1, countXNum),
          countY: Math.max(1, countYNum),
          sizePx,
          color: checkerColor ?? "#000000",
        },
      };
    }

    return { transforms, centerX, centerY };
  }, [arrayDialog, arrayPreviewData]);

  // Dialogue pour export PDF professionnel (éditeur plein écran)
  const [pdfPlanEditorOpen, setPdfPlanEditorOpen] = useState(false);

  // Modale pour texte/annotation - Input inline sur le canvas
  const [textInput, setTextInput] = useState<{
    active: boolean;
    position: { x: number; y: number }; // Position monde
    screenPos: { x: number; y: number }; // Position écran pour l'input
    content: string;
    editingId: string | null; // Si on édite un texte existant
  } | null>(null);
  // Paramètres de texte (dans la toolbar)
  const [textFontSize, setTextFontSize] = useState(5); // mm
  const [textColor, setTextColor] = useState("#000000");
  const [textAlignment, setTextAlignment] = useState<"left" | "center" | "right">("left");
  const textInputRef = useRef<HTMLInputElement>(null);

  // Fermer l'input texte quand on change d'outil
  useEffect(() => {
    if (activeTool !== "text" && textInput?.active) {
      setTextInput(null);
    }
  }, [activeTool]);

  // Aliases pour compatibilité avec le rendu
  const measureStart = measureState.start;
  const measureEnd = measureState.phase === "complete" ? measureState.end : measurePreviewEnd;
  const measureResult = measureState.result;

  // Initialisation
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Créer le renderer
    rendererRef.current = new CADRenderer(canvas);

    // Taille initiale
    const rect = container.getBoundingClientRect();
    rendererRef.current.resize(rect.width, rect.height);
    const rulerSize = 32; // Doit correspondre à la taille dans cad-renderer
    setViewport((v) => ({
      ...v,
      width: rect.width,
      height: rect.height,
      // Origine (0,0) au coin inférieur gauche (après les règles)
      offsetX: rulerSize,
      offsetY: rect.height - rulerSize,
    }));

    // Charger l'image de fond
    if (imageUrl) {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        backgroundImageRef.current = img;
        render();
      };
      img.src = imageUrl;
    }

    // Charger les données initiales
    if (initialData) {
      loadSketchData(initialData);
    }

    // Observer de resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (rendererRef.current) {
          rendererRef.current.resize(width, height);
          const rulerSz = 32;
          setViewport((v) => ({
            ...v,
            width,
            height,
            // Garder l'origine en bas à gauche après resize
            offsetY: v.offsetY + (height - v.height), // Ajuster offsetY si la hauteur change
          }));
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [imageUrl]);

  // Données des branches visibles pour le mode comparaison
  const comparisonBranchesData = useMemo(() => {
    // Désactivé si pas en mode comparaison ou s'il n'y a qu'une branche
    if (!comparisonMode || branches.length <= 1) {
      return [];
    }

    const result: Array<{
      branchId: string;
      branchName: string;
      color: string;
      sketch: Sketch;
    }> = [];

    branches.forEach((branch) => {
      // Ne pas inclure la branche active (elle est dessinée normalement)
      if (branch.id === activeBranchId) return;
      // Ne pas inclure les branches non visibles
      if (!visibleBranches.has(branch.id)) return;

      // Charger le sketch de l'état actuel de la branche
      const entry = branch.history[branch.historyIndex];
      if (entry) {
        try {
          const branchSketch = deserializeSketch(entry.sketch);
          result.push({
            branchId: branch.id,
            branchName: branch.name,
            color: branch.color,
            sketch: branchSketch,
          });
        } catch (e) {
          console.error("Erreur lors du chargement de la branche pour comparaison:", e);
        }
      }
    });

    return result;
  }, [comparisonMode, comparisonStyle, visibleBranches, branches, activeBranchId]);

  // Couleur de la branche active pour le rendu
  const activeBranchColor = useMemo(() => {
    const branch = branches.find((b) => b.id === activeBranchId);
    return branch?.color || "#3B82F6";
  }, [branches, activeBranchId]);

  // Données de la branche pour le mode reveal
  const revealBranchData = useMemo(() => {
    if (!comparisonMode || comparisonStyle !== "reveal" || !revealBranchId) {
      return null;
    }

    const branch = branches.find((b) => b.id === revealBranchId);
    if (!branch) {
      return null;
    }
    if (branch.id === activeBranchId) {
      return null;
    }

    const entry = branch.history[branch.historyIndex];
    if (!entry) {
      return null;
    }

    try {
      const branchSketch = deserializeSketch(entry.sketch);
      return {
        branchId: branch.id,
        branchName: branch.name,
        color: branch.color,
        sketch: branchSketch,
      };
    } catch (e) {
      console.error("Erreur lors du chargement de la branche reveal:", e);
      return null;
    }
  }, [comparisonMode, comparisonStyle, revealBranchId, branches, activeBranchId]);

  // Calcul de la longueur totale des segments sélectionnés (en mm) + angle interne si 2 segments
  const selectedLength = useMemo(() => {
    if (selectedEntities.size === 0) return null;

    let totalPx = 0;
    let count = 0;
    const lines: Array<{ id: string; p1: Point; p2: Point }> = [];

    selectedEntities.forEach((entityId) => {
      const geo = sketch.geometries.get(entityId);
      if (geo) {
        if (geo.type === "line") {
          const line = geo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (p1 && p2) {
            totalPx += distance(p1, p2);
            count++;
            lines.push({ id: entityId, p1, p2 });
          }
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          const center = sketch.points.get(arc.center);
          const startPt = sketch.points.get(arc.startPoint);
          const endPt = sketch.points.get(arc.endPoint);
          if (center && startPt && endPt) {
            // Longueur d'arc = rayon * angle
            const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
            const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);
            let deltaAngle = endAngle - startAngle;
            while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
            while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
            totalPx += Math.abs(deltaAngle) * arc.radius;
            count++;
          }
        }
      }
    });

    if (count === 0) return null;

    const totalMm = totalPx / sketch.scaleFactor;

    // Calcul de l'angle interne si exactement 2 lignes sont sélectionnées
    let internalAngle: number | null = null;
    if (lines.length === 2) {
      const [line1, line2] = lines;

      // Trouver le point commun entre les 2 lignes
      let commonPoint: Point | null = null;
      let otherPoint1: Point | null = null;
      let otherPoint2: Point | null = null;

      const tolerance = 0.5; // Tolérance pour considérer 2 points comme identiques

      // Tester toutes les combinaisons pour trouver un point commun
      if (distance(line1.p1, line2.p1) < tolerance) {
        commonPoint = line1.p1;
        otherPoint1 = line1.p2;
        otherPoint2 = line2.p2;
      } else if (distance(line1.p1, line2.p2) < tolerance) {
        commonPoint = line1.p1;
        otherPoint1 = line1.p2;
        otherPoint2 = line2.p1;
      } else if (distance(line1.p2, line2.p1) < tolerance) {
        commonPoint = line1.p2;
        otherPoint1 = line1.p1;
        otherPoint2 = line2.p2;
      } else if (distance(line1.p2, line2.p2) < tolerance) {
        commonPoint = line1.p2;
        otherPoint1 = line1.p1;
        otherPoint2 = line2.p1;
      }

      if (commonPoint && otherPoint1 && otherPoint2) {
        // Vecteurs depuis le point commun vers les autres extrémités
        const v1 = { x: otherPoint1.x - commonPoint.x, y: otherPoint1.y - commonPoint.y };
        const v2 = { x: otherPoint2.x - commonPoint.x, y: otherPoint2.y - commonPoint.y };

        // Longueurs des vecteurs
        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        if (len1 > 0 && len2 > 0) {
          // Produit scalaire
          const dot = v1.x * v2.x + v1.y * v2.y;
          // Angle en radians
          const cosAngle = Math.max(-1, Math.min(1, dot / (len1 * len2)));
          const angleRad = Math.acos(cosAngle);
          // Convertir en degrés
          internalAngle = angleRad * (180 / Math.PI);
        }
      }
    }

    return { mm: totalMm, count, internalAngle };
  }, [selectedEntities, sketch]);

  // Calculer le centre et les points de la sélection pour le gizmo
  const selectionGizmoData = useMemo(() => {
    if (selectedEntities.size === 0) return null;

    // Collecter tous les points concernés par la sélection
    const pointIds = new Set<string>();

    for (const entityId of selectedEntities) {
      // Vérifier si c'est un point directement
      if (sketch.points.has(entityId)) {
        pointIds.add(entityId);
        continue;
      }

      // Sinon c'est une géométrie - collecter ses points
      const geo = sketch.geometries.get(entityId);
      if (geo) {
        if (geo.type === "line") {
          const line = geo as Line;
          pointIds.add(line.p1);
          pointIds.add(line.p2);
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          pointIds.add(circle.center);
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          pointIds.add(arc.center);
          pointIds.add(arc.startPoint);
          pointIds.add(arc.endPoint);
        } else if (geo.type === "bezier") {
          const bezier = geo as Bezier;
          pointIds.add(bezier.p1);
          pointIds.add(bezier.p2);
          pointIds.add(bezier.cp1);
          pointIds.add(bezier.cp2);
        } else if (geo.type === "text") {
          const text = geo as TextAnnotation;
          pointIds.add(text.position);
        }
      }
    }

    if (pointIds.size === 0) return null;

    // Calculer le centre (barycentre)
    let sumX = 0,
      sumY = 0;
    const points: Array<{ id: string; x: number; y: number }> = [];

    for (const pointId of pointIds) {
      const pt = sketch.points.get(pointId);
      if (pt) {
        sumX += pt.x;
        sumY += pt.y;
        points.push({ id: pointId, x: pt.x, y: pt.y });
      }
    }

    const center = {
      x: sumX / points.length,
      y: sumY / points.length,
    };

    return { center, points, pointIds };
  }, [selectedEntities, sketch.points, sketch.geometries]);

  // Données pour l'outil symétrie - centre des entités sélectionnées
  const mirrorSelectionData = useMemo(() => {
    if (mirrorState.entitiesToMirror.size === 0) return null;

    // Collecter tous les points concernés
    const points: Array<{ x: number; y: number }> = [];

    for (const entityId of mirrorState.entitiesToMirror) {
      const geo = sketch.geometries.get(entityId);
      if (geo) {
        if (geo.type === "line") {
          const line = geo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (p1) points.push({ x: p1.x, y: p1.y });
          if (p2) points.push({ x: p2.x, y: p2.y });
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          const center = sketch.points.get(circle.center);
          if (center) points.push({ x: center.x, y: center.y });
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          const center = sketch.points.get(arc.center);
          const startPt = sketch.points.get(arc.startPoint);
          const endPt = sketch.points.get(arc.endPoint);
          if (center) points.push({ x: center.x, y: center.y });
          if (startPt) points.push({ x: startPt.x, y: startPt.y });
          if (endPt) points.push({ x: endPt.x, y: endPt.y });
        } else if (geo.type === "text") {
          const text = geo as TextAnnotation;
          const position = sketch.points.get(text.position);
          if (position) points.push({ x: position.x, y: position.y });
        }
      }
    }

    if (points.length === 0) return null;

    // Calculer le centre (barycentre)
    let sumX = 0,
      sumY = 0;
    for (const pt of points) {
      sumX += pt.x;
      sumY += pt.y;
    }
    return {
      center: { x: sumX / points.length, y: sumY / points.length },
    };
  }, [mirrorState.entitiesToMirror, sketch.geometries, sketch.points]);

  // Fonction pour calculer la preview des entités miroir
  const calculateMirrorPreview = useCallback(
    (axis1: { x: number; y: number }, axis2: { x: number; y: number }) => {
      if (mirrorState.entitiesToMirror.size === 0) return [];

      const dx = axis2.x - axis1.x;
      const dy = axis2.y - axis1.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return [];

      // Fonction de réflexion d'un point par rapport à l'axe
      const reflectPoint = (p: { x: number; y: number }) => {
        const t = ((p.x - axis1.x) * dx + (p.y - axis1.y) * dy) / lenSq;
        const projX = axis1.x + t * dx;
        const projY = axis1.y + t * dy;
        return { x: 2 * projX - p.x, y: 2 * projY - p.y };
      };

      const preview: Array<any> = [];

      for (const entityId of mirrorState.entitiesToMirror) {
        const geo = sketch.geometries.get(entityId);
        if (geo) {
          if (geo.type === "line") {
            const line = geo as Line;
            const p1 = sketch.points.get(line.p1);
            const p2 = sketch.points.get(line.p2);
            if (p1 && p2) {
              preview.push({
                type: "line",
                p1: reflectPoint(p1),
                p2: reflectPoint(p2),
              });
            }
          } else if (geo.type === "circle") {
            const circle = geo as CircleType;
            const center = sketch.points.get(circle.center);
            if (center) {
              preview.push({
                type: "circle",
                center: reflectPoint(center),
                radius: circle.radius,
              });
            }
          } else if (geo.type === "arc") {
            const arc = geo as Arc;
            const center = sketch.points.get(arc.center);
            const startPt = sketch.points.get(arc.startPoint);
            const endPt = sketch.points.get(arc.endPoint);
            if (center && startPt && endPt) {
              preview.push({
                type: "arc",
                center: reflectPoint(center),
                // Inverser start et end pour la symétrie
                startPoint: reflectPoint(endPt),
                endPoint: reflectPoint(startPt),
                radius: arc.radius,
                counterClockwise: !arc.counterClockwise,
              });
            }
          }
        }
      }

      return preview;
    },
    [mirrorState.entitiesToMirror, sketch.geometries, sketch.points],
  );

  // Rendu
  const render = useCallback(() => {
    if (!rendererRef.current) return;

    // DEBUG: Vérifier les strokeWidth avant rendu (désactivé par défaut)
    // Activer manuellement via: (window as any).__CAD_DEBUG_RENDER = true
    const now = Date.now();
    if (import.meta.env.DEV && (window as any).__CAD_DEBUG_RENDER) {
      if (!renderDebugTimeRef.current || now - renderDebugTimeRef.current > 2000) {
        renderDebugTimeRef.current = now;
        sketch.geometries.forEach((geo, id) => {
          if ((geo as any).strokeWidth !== undefined) {
            console.log(
              `[RENDER] Before render - geo ${id.slice(0, 8)} type=${geo.type} strokeWidth=${(geo as any).strokeWidth}`,
            );
          }
        });
      }
    }

    rendererRef.current.setViewport(viewport);
    rendererRef.current.render(sketch, {
      selectedEntities,
      hoveredEntity,
      referenceHighlight, // Géométrie de référence en vert
      currentSnapPoint,
      tempGeometry,
      showGrid,
      showConstraints,
      showDimensions,
      // Multi-photos (filtrer selon la visibilité du calque)
      backgroundImages: showBackgroundImage
        ? backgroundImages.filter((img) => {
            // Si l'image n'a pas de layerId, elle est toujours visible
            if (!img.layerId) return true;
            // Sinon, vérifier si son calque est visible
            const layer = sketch.layers.get(img.layerId);
            return layer ? layer.visible : true;
          })
        : [],
      selectedImageId,
      // MOD v80.4: Passer la multi-sélection au renderer
      selectedImageIds,
      markerLinks,
      selectedMarkerId,
      // Legacy single image (rétrocompatibilité)
      backgroundImage: showBackgroundImage && backgroundImages.length === 0 ? backgroundImageRef.current : null,
      transformedImage: showBackgroundImage && backgroundImages.length === 0 ? transformedImage : null,
      imageOpacity,
      imageScale,
      calibrationData,
      showCalibration: showCalibrationPanel, // Afficher uniquement si panneau ouvert
      highlightedPairId, // Paire de calibration en surbrillance
      // Mesure en cours (preview)
      measureData: measureStart
        ? {
            start: measureStart,
            end: measureEnd,
            // calibrationData.scale est en mm/px, sketch.scaleFactor est en px/mm (inverser)
            scale: calibrationData.scale || 1 / sketch.scaleFactor,
          }
        : null,
      // Tableau des mesures terminées - MOD v7.16: Afficher seulement si panneau ouvert ou outil actif
      measurements: showMeasurePanel || activeTool === "measure" ? measurements.filter((m) => m.visible !== false) : [],
      // measureScale en mm/px pour le renderer
      measureScale: calibrationData.scale || 1 / sketch.scaleFactor,
      // scaleFactor en px/mm pour les règles
      scaleFactor: sketch.scaleFactor,
      // Surbrillance des formes fermées
      highlightOpacity,
      mouseWorldPos,
      // Gizmo de transformation (seulement si activé)
      transformGizmo: transformGizmo.active ? transformGizmo : null,
      selectionCenter: showTransformGizmo ? selectionGizmoData?.center || null : null,
      // Drag du gizmo (pour affichage temps réel et fantôme)
      gizmoDrag,
      // Entités sélectionnées (pour dessiner le fantôme)
      selectedEntitiesForGhost: gizmoDrag ? selectedEntities : new Set<string>(),
      // Mode comparaison de branches
      comparisonMode,
      comparisonStyle,
      comparisonBranches: comparisonBranchesData,
      comparisonOpacity,
      activeBranchColor,
      // Mode reveal (rideau)
      revealBranch: revealBranchData,
      revealPosition,
      // Lignes de construction
      showConstruction,
      // v7.31: Masquer le texte mesure temporaire quand les inputs HTML sont affichés
      hideTempMeasure: rectInputs.active && tempGeometry?.type === "rectangle",
    });

    // Dessiner les indicateurs de points verrouillés
    if (lockedPoints.size > 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.save();
        lockedPoints.forEach((pointId) => {
          const point = sketch.points.get(pointId);
          if (point) {
            const screenX = point.x * viewport.scale + viewport.offsetX;
            const screenY = point.y * viewport.scale + viewport.offsetY;

            // Dessiner un cadenas autour du point
            ctx.strokeStyle = "#F97316"; // Orange
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
            ctx.stroke();

            // Petit verrou au centre
            ctx.fillStyle = "#F97316";
            ctx.beginPath();
            ctx.arc(screenX, screenY - 2, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(screenX - 4, screenY, 8, 5);
          }
        });
        ctx.restore();
      }
    }

    // Dessiner le rectangle de sélection (après le render du sketch)
    if (selectionBox && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        // Convertir les coordonnées monde en coordonnées écran
        const startScreen = {
          x: selectionBox.start.x * viewport.scale + viewport.offsetX,
          y: selectionBox.start.y * viewport.scale + viewport.offsetY,
        };
        const endScreen = {
          x: selectionBox.end.x * viewport.scale + viewport.offsetX,
          y: selectionBox.end.y * viewport.scale + viewport.offsetY,
        };

        const x = Math.min(startScreen.x, endScreen.x);
        const y = Math.min(startScreen.y, endScreen.y);
        const width = Math.abs(endScreen.x - startScreen.x);
        const height = Math.abs(endScreen.y - startScreen.y);

        // Détecter le mode de sélection
        // Gauche → Droite = mode "fenêtre" (bleu, contenu uniquement)
        // Droite → Gauche = mode "capture" (vert, intersection)
        const isWindowMode = endScreen.x >= startScreen.x;

        // Ne dessiner que si la zone est significative (> 5px)
        if (width > 5 || height > 5) {
          if (isWindowMode) {
            // Mode Fenêtre : fond bleu, bordure bleue continue
            ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
            ctx.fillRect(x, y, width, height);
            ctx.strokeStyle = "#3B82F6";
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
            ctx.strokeRect(x, y, width, height);
          } else {
            // Mode Capture : fond vert, bordure verte pointillée
            ctx.fillStyle = "rgba(34, 197, 94, 0.15)";
            ctx.fillRect(x, y, width, height);
            ctx.strokeStyle = "#22C55E";
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 3]);
            ctx.strokeRect(x, y, width, height);
            ctx.setLineDash([]);
          }
        }
      }
    }

    // Dessiner la preview de l'offset (après le render du sketch)
    if (offsetPreview.length > 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.save();
        ctx.strokeStyle = "#10B981"; // Vert
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);

        offsetPreview.forEach((preview) => {
          if (preview.type === "line" && preview.points) {
            const points = preview.points;
            const p1Screen = {
              x: points[0].x * viewport.scale + viewport.offsetX,
              y: points[0].y * viewport.scale + viewport.offsetY,
            };
            const p2Screen = {
              x: points[1].x * viewport.scale + viewport.offsetX,
              y: points[1].y * viewport.scale + viewport.offsetY,
            };
            ctx.beginPath();
            ctx.moveTo(p1Screen.x, p1Screen.y);
            ctx.lineTo(p2Screen.x, p2Screen.y);
            ctx.stroke();
          } else if (preview.type === "circle" && preview.center && preview.radius) {
            const centerScreen = {
              x: preview.center.x * viewport.scale + viewport.offsetX,
              y: preview.center.y * viewport.scale + viewport.offsetY,
            };
            const radiusScreen = preview.radius * viewport.scale;
            ctx.beginPath();
            ctx.arc(centerScreen.x, centerScreen.y, radiusScreen, 0, Math.PI * 2);
            ctx.stroke();
          } else if (preview.type === "arc" && preview.center && preview.radius) {
            const centerScreen = {
              x: preview.center.x * viewport.scale + viewport.offsetX,
              y: preview.center.y * viewport.scale + viewport.offsetY,
            };
            const radiusScreen = preview.radius * viewport.scale;
            ctx.beginPath();
            ctx.arc(
              centerScreen.x,
              centerScreen.y,
              radiusScreen,
              preview.startAngle ?? 0,
              preview.endAngle ?? Math.PI * 2,
              preview.counterClockwise ?? false,
            );
            ctx.stroke();
          }
        });

        ctx.restore();
      }
    }

    // Dessiner la prévisualisation de répétition (array)
    if (arrayPreview && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.save();

        // Mode damier - preview spécial (optimisé)
        if (arrayPreview.checkerboard) {
          const { countX, countY, sizePx, color } = arrayPreview.checkerboard;

          // Limiter le preview pour la performance
          const maxPreviewCells = 20;
          const previewCountX = Math.min(countX, maxPreviewCells);
          const previewCountY = Math.min(countY, maxPreviewCells);
          const isLimited = countX > maxPreviewCells || countY > maxPreviewCells;

          const screenSize = sizePx * viewport.scale;

          // Dessiner toutes les cases colorées d'un coup (un seul path)
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          for (let row = 0; row < previewCountY; row++) {
            for (let col = 0; col < previewCountX; col++) {
              if ((row + col) % 2 === 0) {
                const screenX = col * sizePx * viewport.scale + viewport.offsetX;
                const screenY = row * sizePx * viewport.scale + viewport.offsetY;
                ctx.rect(screenX, screenY, screenSize, screenSize);
              }
            }
          }
          ctx.fill();

          // Dessiner la grille (lignes uniquement, pas de strokeRect)
          ctx.strokeStyle = "#A855F7";
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();

          // Lignes horizontales
          for (let row = 0; row <= previewCountY; row++) {
            const y = row * sizePx * viewport.scale + viewport.offsetY;
            ctx.moveTo(viewport.offsetX, y);
            ctx.lineTo(previewCountX * sizePx * viewport.scale + viewport.offsetX, y);
          }

          // Lignes verticales
          for (let col = 0; col <= previewCountX; col++) {
            const x = col * sizePx * viewport.scale + viewport.offsetX;
            ctx.moveTo(x, viewport.offsetY);
            ctx.lineTo(x, previewCountY * sizePx * viewport.scale + viewport.offsetY);
          }
          ctx.stroke();

          // Afficher les dimensions totales
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#A855F7";
          ctx.font = "12px sans-serif";
          const labelY = previewCountY * sizePx * viewport.scale + viewport.offsetY + 20;
          const labelX = (previewCountX * sizePx * viewport.scale) / 2 + viewport.offsetX - 30;
          ctx.fillText(`${countX}×${countY} cases`, labelX, labelY);

          if (isLimited) {
            ctx.fillStyle = "#F97316"; // Orange
            ctx.fillText(`(preview limité à ${maxPreviewCells}×${maxPreviewCells})`, labelX - 20, labelY + 15);
          }
        } else if (arrayPreview.transforms.length > 0) {
          // Mode normal (linéaire, grille, circulaire)
          ctx.strokeStyle = "#A855F7"; // Violet
          ctx.fillStyle = "rgba(168, 85, 247, 0.1)"; // Violet transparent
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.globalAlpha = 0.7;

          const { transforms, centerX, centerY } = arrayPreview;

          // Pour chaque transformation, dessiner une copie fantôme des éléments sélectionnés
          transforms.forEach((transform) => {
            selectedEntities.forEach((id) => {
              const geo = sketch.geometries.get(id);
              if (!geo) return;

              if (geo.type === "line") {
                const line = geo as Line;
                const p1 = sketch.points.get(line.p1);
                const p2 = sketch.points.get(line.p2);
                if (p1 && p2) {
                  // Appliquer la transformation
                  let newP1 = { x: p1.x, y: p1.y };
                  let newP2 = { x: p2.x, y: p2.y };

                  if (transform.rotation !== 0) {
                    // Rotation autour du centre
                    const cos = Math.cos(transform.rotation);
                    const sin = Math.sin(transform.rotation);
                    const dx1 = p1.x - centerX;
                    const dy1 = p1.y - centerY;
                    const dx2 = p2.x - centerX;
                    const dy2 = p2.y - centerY;
                    newP1 = {
                      x: centerX + dx1 * cos - dy1 * sin,
                      y: centerY + dx1 * sin + dy1 * cos,
                    };
                    newP2 = {
                      x: centerX + dx2 * cos - dy2 * sin,
                      y: centerY + dx2 * sin + dy2 * cos,
                    };
                  }

                  // Appliquer l'offset
                  newP1.x += transform.offsetX;
                  newP1.y += transform.offsetY;
                  newP2.x += transform.offsetX;
                  newP2.y += transform.offsetY;

                  // Convertir en coordonnées écran
                  const screenP1 = {
                    x: newP1.x * viewport.scale + viewport.offsetX,
                    y: newP1.y * viewport.scale + viewport.offsetY,
                  };
                  const screenP2 = {
                    x: newP2.x * viewport.scale + viewport.offsetX,
                    y: newP2.y * viewport.scale + viewport.offsetY,
                  };

                  ctx.beginPath();
                  ctx.moveTo(screenP1.x, screenP1.y);
                  ctx.lineTo(screenP2.x, screenP2.y);
                  ctx.stroke();
                }
              } else if (geo.type === "circle") {
                const circle = geo as CircleType;
                const center = sketch.points.get(circle.center);
                if (center) {
                  let newCenter = { x: center.x, y: center.y };

                  if (transform.rotation !== 0) {
                    const cos = Math.cos(transform.rotation);
                    const sin = Math.sin(transform.rotation);
                    const dx = center.x - centerX;
                    const dy = center.y - centerY;
                    newCenter = {
                      x: centerX + dx * cos - dy * sin,
                      y: centerY + dx * sin + dy * cos,
                    };
                  }

                  newCenter.x += transform.offsetX;
                  newCenter.y += transform.offsetY;

                  const screenCenter = {
                    x: newCenter.x * viewport.scale + viewport.offsetX,
                    y: newCenter.y * viewport.scale + viewport.offsetY,
                  };
                  const screenRadius = circle.radius * viewport.scale;

                  ctx.beginPath();
                  ctx.arc(screenCenter.x, screenCenter.y, screenRadius, 0, Math.PI * 2);
                  ctx.stroke();
                }
              } else if (geo.type === "arc") {
                const arc = geo as Arc;
                const arcCenter = sketch.points.get(arc.center);
                const startPt = sketch.points.get(arc.startPoint);
                const endPt = sketch.points.get(arc.endPoint);
                if (arcCenter && startPt && endPt) {
                  let newCenter = { x: arcCenter.x, y: arcCenter.y };

                  if (transform.rotation !== 0) {
                    const cos = Math.cos(transform.rotation);
                    const sin = Math.sin(transform.rotation);
                    const dx = arcCenter.x - centerX;
                    const dy = arcCenter.y - centerY;
                    newCenter = {
                      x: centerX + dx * cos - dy * sin,
                      y: centerY + dx * sin + dy * cos,
                    };
                  }

                  newCenter.x += transform.offsetX;
                  newCenter.y += transform.offsetY;

                  const screenCenter = {
                    x: newCenter.x * viewport.scale + viewport.offsetX,
                    y: newCenter.y * viewport.scale + viewport.offsetY,
                  };
                  const screenRadius = arc.radius * viewport.scale;

                  // Calculer les angles transformés
                  let startAngle = Math.atan2(startPt.y - arcCenter.y, startPt.x - arcCenter.x);
                  let endAngle = Math.atan2(endPt.y - arcCenter.y, endPt.x - arcCenter.x);
                  startAngle += transform.rotation;
                  endAngle += transform.rotation;

                  ctx.beginPath();
                  ctx.arc(screenCenter.x, screenCenter.y, screenRadius, startAngle, endAngle, arc.counterClockwise);
                  ctx.stroke();
                }
              } else if (geo.type === "rectangle") {
                const rect = geo as Rectangle;
                const points = [rect.p1, rect.p2, rect.p3, rect.p4]
                  .map((pid) => sketch.points.get(pid))
                  .filter(Boolean) as Point[];
                if (points.length === 4) {
                  const transformedPoints = points.map((p) => {
                    let newP = { x: p.x, y: p.y };
                    if (transform.rotation !== 0) {
                      const cos = Math.cos(transform.rotation);
                      const sin = Math.sin(transform.rotation);
                      const dx = p.x - centerX;
                      const dy = p.y - centerY;
                      newP = {
                        x: centerX + dx * cos - dy * sin,
                        y: centerY + dx * sin + dy * cos,
                      };
                    }
                    newP.x += transform.offsetX;
                    newP.y += transform.offsetY;
                    return {
                      x: newP.x * viewport.scale + viewport.offsetX,
                      y: newP.y * viewport.scale + viewport.offsetY,
                    };
                  });

                  ctx.beginPath();
                  ctx.moveTo(transformedPoints[0].x, transformedPoints[0].y);
                  ctx.lineTo(transformedPoints[1].x, transformedPoints[1].y);
                  ctx.lineTo(transformedPoints[2].x, transformedPoints[2].y);
                  ctx.lineTo(transformedPoints[3].x, transformedPoints[3].y);
                  ctx.closePath();
                  ctx.stroke();
                }
              }
            });
          });

          // Dessiner le centre de rotation pour le mode circulaire
          if (arrayDialog?.type === "circular") {
            const screenCenterX = centerX * viewport.scale + viewport.offsetX;
            const screenCenterY = centerY * viewport.scale + viewport.offsetY;

            ctx.setLineDash([]);
            ctx.strokeStyle = "#A855F7";
            ctx.lineWidth = 2;

            // Croix au centre
            ctx.beginPath();
            ctx.moveTo(screenCenterX - 10, screenCenterY);
            ctx.lineTo(screenCenterX + 10, screenCenterY);
            ctx.moveTo(screenCenterX, screenCenterY - 10);
            ctx.lineTo(screenCenterX, screenCenterY + 10);
            ctx.stroke();

            // Cercle autour du centre
            ctx.beginPath();
            ctx.arc(screenCenterX, screenCenterY, 5, 0, Math.PI * 2);
            ctx.stroke();
          }
        } // Fin du else if (arrayPreview.transforms.length > 0)

        ctx.restore();
      }
    }

    // Dessiner la surbrillance des points pour congé/chanfrein
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        // Dessiner les previews de congé (arcs verts)
        if (filletPreview.length > 0) {
          ctx.save();
          ctx.strokeStyle = "#10B981"; // Vert
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);

          for (const preview of filletPreview) {
            const centerScreen = {
              x: preview.center.x * viewport.scale + viewport.offsetX,
              y: preview.center.y * viewport.scale + viewport.offsetY,
            };
            const radiusScreen = preview.radius * viewport.scale;

            ctx.beginPath();
            ctx.arc(
              centerScreen.x,
              centerScreen.y,
              radiusScreen,
              preview.startAngle,
              preview.endAngle,
              preview.counterClockwise,
            );
            ctx.stroke();

            // Dessiner les points de tangence
            const tan1Screen = {
              x: preview.tan1.x * viewport.scale + viewport.offsetX,
              y: preview.tan1.y * viewport.scale + viewport.offsetY,
            };
            const tan2Screen = {
              x: preview.tan2.x * viewport.scale + viewport.offsetX,
              y: preview.tan2.y * viewport.scale + viewport.offsetY,
            };
            ctx.fillStyle = "#10B981";
            ctx.beginPath();
            ctx.arc(tan1Screen.x, tan1Screen.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(tan2Screen.x, tan2Screen.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }

        // Dessiner les previews de chanfrein (lignes oranges)
        if (chamferPreview.length > 0) {
          ctx.save();
          ctx.strokeStyle = "#F97316"; // Orange
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);

          for (const preview of chamferPreview) {
            const p1Screen = {
              x: preview.p1.x * viewport.scale + viewport.offsetX,
              y: preview.p1.y * viewport.scale + viewport.offsetY,
            };
            const p2Screen = {
              x: preview.p2.x * viewport.scale + viewport.offsetX,
              y: preview.p2.y * viewport.scale + viewport.offsetY,
            };

            ctx.beginPath();
            ctx.moveTo(p1Screen.x, p1Screen.y);
            ctx.lineTo(p2Screen.x, p2Screen.y);
            ctx.stroke();

            // Dessiner les points
            ctx.fillStyle = "#F97316";
            ctx.beginPath();
            ctx.arc(p1Screen.x, p1Screen.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p2Screen.x, p2Screen.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }

        // Points survolés dans la modale congé
        if (filletDialog?.hoveredCornerIdx !== null && filletDialog?.hoveredCornerIdx !== undefined) {
          const corner = filletDialog.corners[filletDialog.hoveredCornerIdx];
          const pt = sketch.points.get(corner?.pointId);
          if (pt) {
            const screenX = pt.x * viewport.scale + viewport.offsetX;
            const screenY = pt.y * viewport.scale + viewport.offsetY;

            // Cercle extérieur pulsant
            ctx.save();
            ctx.strokeStyle = "#3B82F6";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 12, 0, Math.PI * 2);
            ctx.stroke();

            // Cercle intérieur plein
            ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
            ctx.beginPath();
            ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        // Points survolés dans la modale chanfrein
        if (chamferDialog?.hoveredCornerIdx !== null && chamferDialog?.hoveredCornerIdx !== undefined) {
          const corner = chamferDialog.corners[chamferDialog.hoveredCornerIdx];
          const pt = sketch.points.get(corner?.pointId);
          if (pt) {
            const screenX = pt.x * viewport.scale + viewport.offsetX;
            const screenY = pt.y * viewport.scale + viewport.offsetY;

            // Cercle extérieur pulsant
            ctx.save();
            ctx.strokeStyle = "#F97316"; // Orange pour chanfrein
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 12, 0, Math.PI * 2);
            ctx.stroke();

            // Cercle intérieur plein
            ctx.fillStyle = "rgba(249, 115, 22, 0.3)";
            ctx.beginPath();
            ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        // Indicateurs P1/P2 pour le panneau de longueur
        if (lineLengthDialog?.open) {
          const line = sketch.geometries.get(lineLengthDialog.lineId) as Line | undefined;
          if (line) {
            const p1 = sketch.points.get(line.p1);
            const p2 = sketch.points.get(line.p2);

            if (p1) {
              const p1Screen = {
                x: p1.x * viewport.scale + viewport.offsetX,
                y: p1.y * viewport.scale + viewport.offsetY,
              };
              // P1 en vert
              ctx.save();
              ctx.fillStyle = "#10B981";
              ctx.strokeStyle = "#059669";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(p1Screen.x, p1Screen.y, 10, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              // Label P1
              ctx.fillStyle = "white";
              ctx.font = "bold 10px Arial";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("P1", p1Screen.x, p1Screen.y);
              ctx.restore();
            }

            if (p2) {
              const p2Screen = {
                x: p2.x * viewport.scale + viewport.offsetX,
                y: p2.y * viewport.scale + viewport.offsetY,
              };
              // P2 en violet
              ctx.save();
              ctx.fillStyle = "#8B5CF6";
              ctx.strokeStyle = "#7C3AED";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(p2Screen.x, p2Screen.y, 10, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              // Label P2
              ctx.fillStyle = "white";
              ctx.font = "bold 10px Arial";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("P2", p2Screen.x, p2Screen.y);
              ctx.restore();
            }
          }
        }

        // Indicateurs S1/S2 pour le panneau d'angle
        if (angleEditDialog?.open) {
          const line1 = sketch.geometries.get(angleEditDialog.line1Id) as Line | undefined;
          const line2 = sketch.geometries.get(angleEditDialog.line2Id) as Line | undefined;
          const cornerPoint = sketch.points.get(angleEditDialog.pointId);

          if (line1 && cornerPoint) {
            const other1Id = line1.p1 === angleEditDialog.pointId ? line1.p2 : line1.p1;
            const other1 = sketch.points.get(other1Id);
            if (other1) {
              // Segment 1 en vert
              ctx.save();
              ctx.strokeStyle = "#10B981";
              ctx.lineWidth = 4;
              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.moveTo(
                cornerPoint.x * viewport.scale + viewport.offsetX,
                cornerPoint.y * viewport.scale + viewport.offsetY,
              );
              ctx.lineTo(other1.x * viewport.scale + viewport.offsetX, other1.y * viewport.scale + viewport.offsetY);
              ctx.stroke();
              // Label S1 au milieu
              const midX = ((cornerPoint.x + other1.x) / 2) * viewport.scale + viewport.offsetX;
              const midY = ((cornerPoint.y + other1.y) / 2) * viewport.scale + viewport.offsetY;
              ctx.fillStyle = "#10B981";
              ctx.beginPath();
              ctx.arc(midX, midY, 12, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "white";
              ctx.font = "bold 10px Arial";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("S1", midX, midY);
              ctx.restore();
            }
          }

          if (line2 && cornerPoint) {
            const other2Id = line2.p1 === angleEditDialog.pointId ? line2.p2 : line2.p1;
            const other2 = sketch.points.get(other2Id);
            if (other2) {
              // Segment 2 en violet
              ctx.save();
              ctx.strokeStyle = "#8B5CF6";
              ctx.lineWidth = 4;
              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.moveTo(
                cornerPoint.x * viewport.scale + viewport.offsetX,
                cornerPoint.y * viewport.scale + viewport.offsetY,
              );
              ctx.lineTo(other2.x * viewport.scale + viewport.offsetX, other2.y * viewport.scale + viewport.offsetY);
              ctx.stroke();
              // Label S2 au milieu
              const midX = ((cornerPoint.x + other2.x) / 2) * viewport.scale + viewport.offsetX;
              const midY = ((cornerPoint.y + other2.y) / 2) * viewport.scale + viewport.offsetY;
              ctx.fillStyle = "#8B5CF6";
              ctx.beginPath();
              ctx.arc(midX, midY, 12, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "white";
              ctx.font = "bold 10px Arial";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("S2", midX, midY);
              ctx.restore();
            }
          }

          // Marqueur au coin
          if (cornerPoint) {
            const cornerScreen = {
              x: cornerPoint.x * viewport.scale + viewport.offsetX,
              y: cornerPoint.y * viewport.scale + viewport.offsetY,
            };
            ctx.save();
            ctx.fillStyle = "#F97316";
            ctx.strokeStyle = "#EA580C";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cornerScreen.x, cornerScreen.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }

        // Fonction helper pour dessiner l'angle avec sa valeur
        const drawAngleIndicatorForPanel = (
          corner: { x: number; y: number },
          dir1: { x: number; y: number },
          dir2: { x: number; y: number },
        ) => {
          const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
          const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);
          if (len1 === 0 || len2 === 0) return;

          const u1 = { x: dir1.x / len1, y: dir1.y / len1 };
          const u2 = { x: dir2.x / len2, y: dir2.y / len2 };

          const dot = u1.x * u2.x + u1.y * u2.y;
          const angleDeg = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;

          const cornerScreen = {
            x: corner.x * viewport.scale + viewport.offsetX,
            y: corner.y * viewport.scale + viewport.offsetY,
          };

          ctx.save();

          // Si angle droit (90° exact, tolérance ±0.1°), dessiner le petit carré vert
          const isRightAngle = Math.abs(angleDeg - 90) < 0.1;

          if (isRightAngle) {
            const size = 14;
            const p1 = {
              x: cornerScreen.x + u1.x * size,
              y: cornerScreen.y + u1.y * size,
            };
            const p2 = {
              x: cornerScreen.x + u1.x * size + u2.x * size,
              y: cornerScreen.y + u1.y * size + u2.y * size,
            };
            const p3 = {
              x: cornerScreen.x + u2.x * size,
              y: cornerScreen.y + u2.y * size,
            };

            ctx.strokeStyle = "#10B981";
            ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.stroke();
            // Remplir le carré pour mieux le voir
            ctx.beginPath();
            ctx.moveTo(cornerScreen.x, cornerScreen.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.closePath();
            ctx.fill();
          } else {
            // Dessiner un arc orange
            const arcRadius = 22;
            const startAngle = Math.atan2(u1.y, u1.x);
            const endAngle = Math.atan2(u2.y, u2.x);

            ctx.strokeStyle = "#F97316";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([]);
            ctx.beginPath();

            // Calculer le delta angle et normaliser entre -π et +π
            let deltaAngle = endAngle - startAngle;
            while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
            while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

            // Pour dessiner le PETIT arc (angle mesuré):
            const counterClockwise = deltaAngle < 0;

            ctx.arc(cornerScreen.x, cornerScreen.y, arcRadius, startAngle, endAngle, counterClockwise);
            ctx.stroke();
          }

          // Afficher la valeur de l'angle
          const bisectorAngle = Math.atan2(u1.y + u2.y, u1.x + u2.x);
          const textDistance = 38;
          const textX = cornerScreen.x + Math.cos(bisectorAngle) * textDistance;
          const textY = cornerScreen.y + Math.sin(bisectorAngle) * textDistance;

          ctx.font = "bold 12px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const angleText = `${angleDeg.toFixed(1)}°`;
          const textWidth = ctx.measureText(angleText).width;

          // Fond avec bordure
          ctx.fillStyle = isRightAngle ? "rgba(16, 185, 129, 0.15)" : "rgba(249, 115, 22, 0.15)";
          ctx.strokeStyle = isRightAngle ? "#10B981" : "#F97316";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(textX - textWidth / 2 - 5, textY - 10, textWidth + 10, 20, 4);
          ctx.fill();
          ctx.stroke();

          // Texte
          ctx.fillStyle = isRightAngle ? "#059669" : "#EA580C";
          ctx.fillText(angleText, textX, textY);

          ctx.restore();
        };

        // Fonction pour dessiner tous les angles d'une figure connectée
        const drawAllFigureAngles = (startLineId: string) => {
          // Collecter tous les points et lignes de la figure
          const visitedLines = new Set<string>();
          const linesToVisit: string[] = [startLineId];
          const allLines: Line[] = [];

          while (linesToVisit.length > 0) {
            const lineId = linesToVisit.pop()!;
            if (visitedLines.has(lineId)) continue;
            visitedLines.add(lineId);

            const line = sketch.geometries.get(lineId) as Line | undefined;
            if (!line || line.type !== "line") continue;

            allLines.push(line);

            // Trouver les lignes connectées via les points
            [line.p1, line.p2].forEach((pointId) => {
              sketch.geometries.forEach((geo, geoId) => {
                if (geo.type === "line" && !visitedLines.has(geoId)) {
                  const l = geo as Line;
                  if (l.p1 === pointId || l.p2 === pointId) {
                    linesToVisit.push(geoId);
                  }
                }
              });
            });
          }

          // Pour chaque point, trouver les lignes connectées et dessiner l'angle
          const processedCorners = new Set<string>();

          allLines.forEach((line) => {
            [line.p1, line.p2].forEach((pointId) => {
              if (processedCorners.has(pointId)) return;

              const point = sketch.points.get(pointId);
              if (!point) return;

              // Trouver toutes les lignes connectées à ce point
              const connectedLines: Line[] = [];
              allLines.forEach((l) => {
                if (l.p1 === pointId || l.p2 === pointId) {
                  connectedLines.push(l);
                }
              });

              // Si au moins 2 lignes, c'est un coin
              if (connectedLines.length >= 2) {
                processedCorners.add(pointId);

                // Dessiner l'angle entre chaque paire de lignes
                for (let i = 0; i < connectedLines.length; i++) {
                  for (let j = i + 1; j < connectedLines.length; j++) {
                    const l1 = connectedLines[i];
                    const l2 = connectedLines[j];

                    const other1Id = l1.p1 === pointId ? l1.p2 : l1.p1;
                    const other2Id = l2.p1 === pointId ? l2.p2 : l2.p1;

                    const other1 = sketch.points.get(other1Id);
                    const other2 = sketch.points.get(other2Id);

                    if (other1 && other2) {
                      const dir1 = { x: other1.x - point.x, y: other1.y - point.y };
                      const dir2 = { x: other2.x - point.x, y: other2.y - point.y };
                      drawAngleIndicatorForPanel(point, dir1, dir2);
                    }
                  }
                }
              }
            });
          });
        };

        // Fonction pour dessiner la longueur d'un segment
        const drawSegmentLength = (
          p1: { x: number; y: number },
          p2: { x: number; y: number },
          isMainLine: boolean = false,
          originalLength?: number,
        ) => {
          const lengthPx = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
          const lengthMm = lengthPx / sketch.scaleFactor;

          // Position au milieu du segment
          const midX = ((p1.x + p2.x) / 2) * viewport.scale + viewport.offsetX;
          const midY = ((p1.y + p2.y) / 2) * viewport.scale + viewport.offsetY;

          // Direction perpendiculaire pour offset du texte
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return;

          // Perpendiculaire normalisée
          const perpX = -dy / len;
          const perpY = dx / len;

          // Offset vers le haut/gauche
          const offset = isMainLine ? 25 : 18;
          const textX = midX + perpX * offset;
          const textY = midY + perpY * offset;

          ctx.save();
          ctx.font = isMainLine ? "bold 13px Arial" : "bold 11px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const lengthText = `${lengthMm.toFixed(1)} mm`;
          const textWidth = ctx.measureText(lengthText).width;

          // Fond
          if (isMainLine) {
            ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
            ctx.strokeStyle = "#3B82F6";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(textX - textWidth / 2 - 6, textY - 11, textWidth + 12, 22, 4);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#1D4ED8";
          } else {
            ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            ctx.fillRect(textX - textWidth / 2 - 4, textY - 9, textWidth + 8, 18);
            ctx.fillStyle = "#374151";
          }

          ctx.fillText(lengthText, textX, textY);

          // Afficher le delta si on a la longueur originale
          if (originalLength !== undefined && isMainLine) {
            const deltaMm = lengthMm - originalLength;
            if (Math.abs(deltaMm) > 0.05) {
              const deltaText = deltaMm > 0 ? `+${deltaMm.toFixed(1)}` : `${deltaMm.toFixed(1)}`;
              const deltaWidth = ctx.measureText(deltaText).width;

              const deltaX = textX;
              const deltaY = textY + 20;

              ctx.font = "bold 11px Arial";
              ctx.fillStyle = deltaMm > 0 ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";
              ctx.strokeStyle = deltaMm > 0 ? "#10B981" : "#EF4444";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.roundRect(deltaX - deltaWidth / 2 - 4, deltaY - 8, deltaWidth + 8, 16, 3);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = deltaMm > 0 ? "#059669" : "#DC2626";
              ctx.fillText(deltaText, deltaX, deltaY);
            }
          }

          ctx.restore();
        };

        // Fonction pour dessiner les longueurs de tous les segments d'une figure
        const drawAllFigureLengths = (startLineId: string, originalSketch: Sketch | null) => {
          // Collecter toutes les lignes de la figure
          const visitedLines = new Set<string>();
          const linesToVisit: string[] = [startLineId];

          while (linesToVisit.length > 0) {
            const lineId = linesToVisit.pop()!;
            if (visitedLines.has(lineId)) continue;
            visitedLines.add(lineId);

            const line = sketch.geometries.get(lineId) as Line | undefined;
            if (!line || line.type !== "line") continue;

            const p1 = sketch.points.get(line.p1);
            const p2 = sketch.points.get(line.p2);

            if (p1 && p2) {
              // Calculer la longueur originale si disponible
              let originalLength: number | undefined;
              if (originalSketch) {
                const origP1 = originalSketch.points.get(line.p1);
                const origP2 = originalSketch.points.get(line.p2);
                if (origP1 && origP2) {
                  const origLenPx = Math.sqrt((origP2.x - origP1.x) ** 2 + (origP2.y - origP1.y) ** 2);
                  originalLength = origLenPx / sketch.scaleFactor;
                }
              }

              const isMainLine = lineId === startLineId;
              drawSegmentLength(p1, p2, isMainLine, isMainLine ? originalLength : undefined);
            }

            // Trouver les lignes connectées
            [line.p1, line.p2].forEach((pointId) => {
              sketch.geometries.forEach((geo, geoId) => {
                if (geo.type === "line" && !visitedLines.has(geoId)) {
                  const l = geo as Line;
                  if (l.p1 === pointId || l.p2 === pointId) {
                    linesToVisit.push(geoId);
                  }
                }
              });
            });
          }
        };

        // Fonction pour dessiner les indicateurs de déplacement P1/P2
        const drawDisplacementIndicators = (lineId: string, originalSketch: Sketch | null, anchorMode: string) => {
          if (!originalSketch) return;

          const line = sketch.geometries.get(lineId) as Line | undefined;
          const origLine = originalSketch.geometries.get(lineId) as Line | undefined;
          if (!line || !origLine) return;

          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          const origP1 = originalSketch.points.get(line.p1);
          const origP2 = originalSketch.points.get(line.p2);

          if (!p1 || !p2 || !origP1 || !origP2) return;

          // Calculer le centre original
          const origCenterX = (origP1.x + origP2.x) / 2;
          const origCenterY = (origP1.y + origP2.y) / 2;

          // Dessiner le point central original (fantôme)
          const centerScreen = {
            x: origCenterX * viewport.scale + viewport.offsetX,
            y: origCenterY * viewport.scale + viewport.offsetY,
          };

          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = "#9CA3AF";
          ctx.lineWidth = 1;

          // Dessiner la ligne originale en pointillés
          ctx.beginPath();
          ctx.moveTo(origP1.x * viewport.scale + viewport.offsetX, origP1.y * viewport.scale + viewport.offsetY);
          ctx.lineTo(origP2.x * viewport.scale + viewport.offsetX, origP2.y * viewport.scale + viewport.offsetY);
          ctx.stroke();

          // Marquer le centre original
          ctx.setLineDash([]);
          ctx.fillStyle = "#9CA3AF";
          ctx.beginPath();
          ctx.arc(centerScreen.x, centerScreen.y, 4, 0, Math.PI * 2);
          ctx.fill();

          // Calculer et afficher les déplacements depuis le centre
          const p1Screen = { x: p1.x * viewport.scale + viewport.offsetX, y: p1.y * viewport.scale + viewport.offsetY };
          const p2Screen = { x: p2.x * viewport.scale + viewport.offsetX, y: p2.y * viewport.scale + viewport.offsetY };
          const origP1Screen = {
            x: origP1.x * viewport.scale + viewport.offsetX,
            y: origP1.y * viewport.scale + viewport.offsetY,
          };
          const origP2Screen = {
            x: origP2.x * viewport.scale + viewport.offsetX,
            y: origP2.y * viewport.scale + viewport.offsetY,
          };

          // Déplacement de P1
          const deltaP1Px = Math.sqrt((p1.x - origP1.x) ** 2 + (p1.y - origP1.y) ** 2);
          const deltaP1Mm = deltaP1Px / sketch.scaleFactor;

          // Déplacement de P2
          const deltaP2Px = Math.sqrt((p2.x - origP2.x) ** 2 + (p2.y - origP2.y) ** 2);
          const deltaP2Mm = deltaP2Px / sketch.scaleFactor;

          ctx.font = "bold 10px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          // Afficher delta P1 si significatif
          if (deltaP1Mm > 0.1) {
            // Flèche de P1 original vers P1 actuel
            ctx.strokeStyle = "#10B981";
            ctx.fillStyle = "#10B981";
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(origP1Screen.x, origP1Screen.y);
            ctx.lineTo(p1Screen.x, p1Screen.y);
            ctx.stroke();

            // Texte du déplacement
            const midDeltaP1X = (origP1Screen.x + p1Screen.x) / 2;
            const midDeltaP1Y = (origP1Screen.y + p1Screen.y) / 2 - 12;
            const deltaP1Text = `Δ ${deltaP1Mm.toFixed(1)}`;
            const deltaP1Width = ctx.measureText(deltaP1Text).width;

            ctx.setLineDash([]);
            ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
            ctx.beginPath();
            ctx.roundRect(midDeltaP1X - deltaP1Width / 2 - 3, midDeltaP1Y - 7, deltaP1Width + 6, 14, 3);
            ctx.fill();
            ctx.fillStyle = "white";
            ctx.fillText(deltaP1Text, midDeltaP1X, midDeltaP1Y);
          }

          // Afficher delta P2 si significatif
          if (deltaP2Mm > 0.1) {
            ctx.strokeStyle = "#8B5CF6";
            ctx.fillStyle = "#8B5CF6";
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(origP2Screen.x, origP2Screen.y);
            ctx.lineTo(p2Screen.x, p2Screen.y);
            ctx.stroke();

            // Texte du déplacement
            const midDeltaP2X = (origP2Screen.x + p2Screen.x) / 2;
            const midDeltaP2Y = (origP2Screen.y + p2Screen.y) / 2 - 12;
            const deltaP2Text = `Δ ${deltaP2Mm.toFixed(1)}`;
            const deltaP2Width = ctx.measureText(deltaP2Text).width;

            ctx.setLineDash([]);
            ctx.fillStyle = "rgba(139, 92, 246, 0.9)";
            ctx.beginPath();
            ctx.roundRect(midDeltaP2X - deltaP2Width / 2 - 3, midDeltaP2Y - 7, deltaP2Width + 6, 14, 3);
            ctx.fill();
            ctx.fillStyle = "white";
            ctx.fillText(deltaP2Text, midDeltaP2X, midDeltaP2Y);
          }

          ctx.restore();
        };

        // Afficher quand le panneau longueur est ouvert
        if (lineLengthDialog?.open) {
          // D'abord les indicateurs de déplacement (en arrière-plan)
          drawDisplacementIndicators(
            lineLengthDialog.lineId,
            lineLengthDialog.originalSketch,
            lineLengthDialog.anchorMode,
          );
          // Puis les longueurs
          drawAllFigureLengths(lineLengthDialog.lineId, lineLengthDialog.originalSketch);
          // Enfin les angles
          drawAllFigureAngles(lineLengthDialog.lineId);
        }

        // Afficher quand le panneau angle est ouvert
        if (angleEditDialog?.open) {
          drawAllFigureLengths(angleEditDialog.line1Id, angleEditDialog.originalSketch);
          drawAllFigureAngles(angleEditDialog.line1Id);
        }

        // Afficher l'indicateur de perpendicularité pendant le tracé
        if (perpendicularInfo?.isActive && tempGeometry?.type === "line" && tempPoints.length > 0) {
          const startPoint = tempPoints[0];
          const startScreen = {
            x: startPoint.x * viewport.scale + viewport.offsetX,
            y: startPoint.y * viewport.scale + viewport.offsetY,
          };
          const intersectionScreen = {
            x: perpendicularInfo.intersectionPoint.x * viewport.scale + viewport.offsetX,
            y: perpendicularInfo.intersectionPoint.y * viewport.scale + viewport.offsetY,
          };
          const snappedScreen = {
            x: perpendicularInfo.snappedCursor.x * viewport.scale + viewport.offsetX,
            y: perpendicularInfo.snappedCursor.y * viewport.scale + viewport.offsetY,
          };

          // Dessiner le symbole perpendiculaire (petit carré)
          const line = sketch.geometries.get(perpendicularInfo.lineId) as Line | undefined;
          if (line) {
            const p1 = sketch.points.get(line.p1);
            const p2 = sketch.points.get(line.p2);
            if (p1 && p2) {
              // Direction du segment
              const segDir = { x: p2.x - p1.x, y: p2.y - p1.y };
              const segLen = Math.sqrt(segDir.x * segDir.x + segDir.y * segDir.y);
              const segNorm = { x: segDir.x / segLen, y: segDir.y / segLen };

              // Direction de la ligne tracée (du start vers intersection)
              const lineDir = {
                x: perpendicularInfo.intersectionPoint.x - startPoint.x,
                y: perpendicularInfo.intersectionPoint.y - startPoint.y,
              };
              const lineLen = Math.sqrt(lineDir.x * lineDir.x + lineDir.y * lineDir.y);
              const lineNorm = lineLen > 0 ? { x: lineDir.x / lineLen, y: lineDir.y / lineLen } : { x: 0, y: 0 };

              // Dessiner le symbole perpendiculaire (⊥) au point d'intersection
              const size = 14;
              const corner1 = {
                x: intersectionScreen.x + segNorm.x * size,
                y: intersectionScreen.y + segNorm.y * size,
              };
              const corner2 = {
                x: intersectionScreen.x + segNorm.x * size + lineNorm.x * size,
                y: intersectionScreen.y + segNorm.y * size + lineNorm.y * size,
              };
              const corner3 = {
                x: intersectionScreen.x + lineNorm.x * size,
                y: intersectionScreen.y + lineNorm.y * size,
              };

              ctx.save();
              // Remplissage vert semi-transparent
              ctx.fillStyle = "rgba(16, 185, 129, 0.3)";
              ctx.beginPath();
              ctx.moveTo(intersectionScreen.x, intersectionScreen.y);
              ctx.lineTo(corner1.x, corner1.y);
              ctx.lineTo(corner2.x, corner2.y);
              ctx.lineTo(corner3.x, corner3.y);
              ctx.closePath();
              ctx.fill();

              // Bordure verte
              ctx.strokeStyle = "#10B981";
              ctx.lineWidth = 2.5;
              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.moveTo(corner1.x, corner1.y);
              ctx.lineTo(corner2.x, corner2.y);
              ctx.lineTo(corner3.x, corner3.y);
              ctx.stroke();

              // Point d'intersection
              ctx.fillStyle = "#10B981";
              ctx.beginPath();
              ctx.arc(intersectionScreen.x, intersectionScreen.y, 5, 0, Math.PI * 2);
              ctx.fill();

              // Label "90°"
              ctx.font = "bold 12px Arial";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";

              const labelX = intersectionScreen.x + (segNorm.x + lineNorm.x) * 25;
              const labelY = intersectionScreen.y + (segNorm.y + lineNorm.y) * 25;

              ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
              ctx.beginPath();
              ctx.roundRect(labelX - 18, labelY - 10, 36, 20, 4);
              ctx.fill();
              ctx.fillStyle = "white";
              ctx.fillText("90°", labelX, labelY);

              ctx.restore();
            }
          }
        }
      }
    }

    // Dessiner les dimensions pendant le drag (modification de figure)
    if (isDragging && dragTarget && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.save();
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Fonction helper pour dessiner l'angle avec sa valeur en degrés
        const drawAngleAtCorner = (
          corner: { x: number; y: number },
          dir1: { x: number; y: number },
          dir2: { x: number; y: number },
        ) => {
          // Normaliser les directions
          const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
          const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);
          if (len1 === 0 || len2 === 0) return;

          const u1 = { x: dir1.x / len1, y: dir1.y / len1 };
          const u2 = { x: dir2.x / len2, y: dir2.y / len2 };

          // Calculer l'angle entre les deux directions
          const dot = u1.x * u2.x + u1.y * u2.y;
          const angleDeg = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;

          const cornerScreen = {
            x: corner.x * viewport.scale + viewport.offsetX,
            y: corner.y * viewport.scale + viewport.offsetY,
          };

          // Si angle droit (90° exact, tolérance ±0.1°), dessiner le petit carré
          if (Math.abs(angleDeg - 90) < 0.1) {
            const size = 12;
            const p1 = {
              x: cornerScreen.x + u1.x * size,
              y: cornerScreen.y + u1.y * size,
            };
            const p2 = {
              x: cornerScreen.x + u1.x * size + u2.x * size,
              y: cornerScreen.y + u1.y * size + u2.y * size,
            };
            const p3 = {
              x: cornerScreen.x + u2.x * size,
              y: cornerScreen.y + u2.y * size,
            };

            ctx.save();
            ctx.strokeStyle = "#10B981";
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.stroke();
            ctx.restore();
          } else {
            // Dessiner un arc pour montrer l'angle
            const arcRadius = 20;
            const startAngle = Math.atan2(u1.y, u1.x);
            const endAngle = Math.atan2(u2.y, u2.x);

            ctx.save();
            ctx.strokeStyle = "#F97316"; // Orange
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.beginPath();

            // Déterminer le sens de l'arc (prendre le plus court)
            let deltaAngle = endAngle - startAngle;
            while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
            while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
            const counterClockwise = deltaAngle < 0;

            ctx.arc(cornerScreen.x, cornerScreen.y, arcRadius, startAngle, endAngle, counterClockwise);
            ctx.stroke();
            ctx.restore();
          }

          // Afficher la valeur de l'angle
          const bisectorAngle = Math.atan2(u1.y + u2.y, u1.x + u2.x);
          const textDistance = 35;
          const textX = cornerScreen.x + Math.cos(bisectorAngle) * textDistance;
          const textY = cornerScreen.y + Math.sin(bisectorAngle) * textDistance;

          const angleText = `${angleDeg.toFixed(1)}°`;
          const textWidth = ctx.measureText(angleText).width;

          // Fond
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.fillRect(textX - textWidth / 2 - 3, textY - 8, textWidth + 6, 16);

          // Texte (vert si 90° exact, orange sinon)
          ctx.fillStyle = Math.abs(angleDeg - 90) < 0.1 ? "#10B981" : "#F97316";
          ctx.fillText(angleText, textX, textY);
        };

        // Fonction helper pour trouver les lignes connectées à un point
        const findConnectedLines = (pointId: string): Line[] => {
          const lines: Line[] = [];
          sketch.geometries.forEach((geo) => {
            if (geo.type === "line") {
              const line = geo as Line;
              if (line.p1 === pointId || line.p2 === pointId) {
                lines.push(line);
              }
            }
          });
          return lines;
        };

        // Fonction helper pour dessiner les angles à un point
        const drawAnglesAtPoint = (pointId: string) => {
          const point = sketch.points.get(pointId);
          if (!point) return;

          const connectedLines = findConnectedLines(pointId);

          // Pour chaque paire de lignes connectées, afficher l'angle
          for (let i = 0; i < connectedLines.length; i++) {
            for (let j = i + 1; j < connectedLines.length; j++) {
              const line1 = connectedLines[i];
              const line2 = connectedLines[j];

              const other1Id = line1.p1 === pointId ? line1.p2 : line1.p1;
              const other2Id = line2.p1 === pointId ? line2.p2 : line2.p1;

              const other1 = sketch.points.get(other1Id);
              const other2 = sketch.points.get(other2Id);

              if (other1 && other2) {
                const dir1 = { x: other1.x - point.x, y: other1.y - point.y };
                const dir2 = { x: other2.x - point.x, y: other2.y - point.y };
                drawAngleAtCorner(point, dir1, dir2);
              }
            }
          }
        };

        // Fonction helper pour dessiner la dimension d'une ligne
        const drawLineDimension = (line: Line) => {
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (!p1 || !p2) return;

          const lengthPx = distance(p1, p2);
          const lengthMm = lengthPx / sketch.scaleFactor;

          const midScreen = {
            x: ((p1.x + p2.x) / 2) * viewport.scale + viewport.offsetX,
            y: ((p1.y + p2.y) / 2) * viewport.scale + viewport.offsetY,
          };

          // Offset perpendiculaire
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const offsetX = len > 0 ? (-dy / len) * 15 : 0;
          const offsetY = len > 0 ? (dx / len) * 15 : 15;

          const text = `${lengthMm.toFixed(1)} mm`;
          const textX = midScreen.x + offsetX;
          const textY = midScreen.y + offsetY;
          const textWidth = ctx.measureText(text).width;

          // Fond blanc
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.fillRect(textX - textWidth / 2 - 4, textY - 8, textWidth + 8, 18);

          // Texte
          ctx.fillStyle = "#3B82F6";
          ctx.fillText(text, textX, textY);
        };

        if (dragTarget.type === "handle" && dragTarget.handleType === "circleResize") {
          // Afficher le rayon du cercle
          const circle = sketch.geometries.get(dragTarget.id) as CircleType | undefined;
          if (circle && circle.type === "circle") {
            const center = sketch.points.get(circle.center);
            if (center) {
              const radiusMm = circle.radius / sketch.scaleFactor;
              const centerScreen = {
                x: center.x * viewport.scale + viewport.offsetX,
                y: center.y * viewport.scale + viewport.offsetY,
              };

              const text = `R ${radiusMm.toFixed(1)} mm`;
              const textX = centerScreen.x;
              const textY = centerScreen.y - 20;
              const textWidth = ctx.measureText(text).width;

              // Fond blanc
              ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
              ctx.fillRect(textX - textWidth / 2 - 4, textY - 8, textWidth + 8, 18);

              // Texte
              ctx.fillStyle = "#3B82F6";
              ctx.fillText(text, textX, textY);
            }
          }
        } else if (dragTarget.type === "handle" && dragTarget.handleType === "lineMove") {
          // Afficher la dimension de la ligne qu'on déplace
          const line = sketch.geometries.get(dragTarget.id) as Line | undefined;
          if (line && line.type === "line") {
            drawLineDimension(line);

            // Afficher aussi les dimensions des lignes connectées (côtés adjacents)
            const connectedToP1 = findConnectedLines(line.p1);
            const connectedToP2 = findConnectedLines(line.p2);

            // Dessiner les dimensions des lignes adjacentes (exclure la ligne elle-même)
            connectedToP1.forEach((connectedLine) => {
              if (connectedLine.id !== line.id) {
                drawLineDimension(connectedLine);
              }
            });
            connectedToP2.forEach((connectedLine) => {
              if (connectedLine.id !== line.id) {
                drawLineDimension(connectedLine);
              }
            });

            // Afficher les angles droits aux deux extrémités
            drawAnglesAtPoint(line.p1);
            drawAnglesAtPoint(line.p2);
          }
        } else if (dragTarget.type === "point") {
          // Afficher les dimensions des lignes connectées à ce point
          const pointId = dragTarget.id;
          const point = sketch.points.get(pointId);
          if (point) {
            // Chercher les géométries connectées
            sketch.geometries.forEach((geo) => {
              if (geo.type === "line") {
                const line = geo as Line;
                if (line.p1 === pointId || line.p2 === pointId) {
                  drawLineDimension(line);
                }
              } else if (geo.type === "circle") {
                const circle = geo as CircleType;
                if (circle.center === pointId) {
                  const center = sketch.points.get(circle.center);
                  if (center) {
                    const radiusMm = circle.radius / sketch.scaleFactor;
                    const centerScreen = {
                      x: center.x * viewport.scale + viewport.offsetX,
                      y: center.y * viewport.scale + viewport.offsetY,
                    };

                    const text = `R ${radiusMm.toFixed(1)} mm`;
                    const textX = centerScreen.x;
                    const textY = centerScreen.y - 20;
                    const textWidth = ctx.measureText(text).width;

                    // Fond blanc
                    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                    ctx.fillRect(textX - textWidth / 2 - 4, textY - 8, textWidth + 8, 18);

                    // Texte
                    ctx.fillStyle = "#3B82F6";
                    ctx.fillText(text, textX, textY);
                  }
                }
              }
            });

            // Afficher les indicateurs d'angle droit au point qu'on déplace
            drawAnglesAtPoint(pointId);
          }
        }
        ctx.restore();
      }
    }

    // ===== DESSINER LA GRILLE A4 =====
    if (showA4Grid && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.save();

        // Dimensions A4 en pixels (basé sur scaleFactor du sketch)
        const fullCellWidthMm = a4GridOrientation === "portrait" ? A4_WIDTH_MM : A4_HEIGHT_MM;
        const fullCellHeightMm = a4GridOrientation === "portrait" ? A4_HEIGHT_MM : A4_WIDTH_MM;

        // Avec chevauchement, les cellules se déplacent moins
        const contentWidthMm = fullCellWidthMm - a4OverlapMm;
        const contentHeightMm = fullCellHeightMm - a4OverlapMm;

        const contentWidthPx = contentWidthMm * sketch.scaleFactor;
        const contentHeightPx = contentHeightMm * sketch.scaleFactor;
        const fullCellWidthPx = fullCellWidthMm * sketch.scaleFactor;
        const fullCellHeightPx = fullCellHeightMm * sketch.scaleFactor;

        // Convertir l'origine de la grille en coordonnées écran
        const originScreenX = a4GridOrigin.x * viewport.scale + viewport.offsetX;
        const originScreenY = a4GridOrigin.y * viewport.scale + viewport.offsetY;

        // Taille des cellules en pixels écran
        const contentWidthScreen = contentWidthPx * viewport.scale;
        const contentHeightScreen = contentHeightPx * viewport.scale;
        const fullCellWidthScreen = fullCellWidthPx * viewport.scale;
        const fullCellHeightScreen = fullCellHeightPx * viewport.scale;
        const overlapScreen = a4OverlapMm * sketch.scaleFactor * viewport.scale;

        // Dessiner les cellules
        for (let row = 0; row < a4GridRows; row++) {
          for (let col = 0; col < a4GridCols; col++) {
            const cellKey = `${row}-${col}`;
            const isSelected = selectedA4Cells.has(cellKey);

            // Position basée sur le contenu (sans chevauchement)
            const x = originScreenX + col * contentWidthScreen;
            const y = originScreenY + row * contentHeightScreen;

            // La cellule réelle est plus grande (inclut le chevauchement)
            const cellX = col > 0 ? x - overlapScreen : x;
            const cellY = row > 0 ? y - overlapScreen : y;
            const cellW = col > 0 ? fullCellWidthScreen : contentWidthScreen + overlapScreen;
            const cellH = row > 0 ? fullCellHeightScreen : contentHeightScreen + overlapScreen;

            // Fond si sélectionnée
            if (isSelected) {
              ctx.fillStyle = a4CutMode ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.2)";
              ctx.fillRect(x, y, contentWidthScreen, contentHeightScreen);

              // Zone de chevauchement (plus transparente)
              if (a4OverlapMm > 0) {
                ctx.fillStyle = "rgba(251, 191, 36, 0.15)"; // Jaune
                if (col > 0) {
                  ctx.fillRect(x - overlapScreen, y, overlapScreen, contentHeightScreen);
                }
                if (row > 0) {
                  ctx.fillRect(x, y - overlapScreen, contentWidthScreen, overlapScreen);
                }
                if (col > 0 && row > 0) {
                  ctx.fillRect(x - overlapScreen, y - overlapScreen, overlapScreen, overlapScreen);
                }
              }
            }

            // Bordure de la zone de contenu
            ctx.strokeStyle = isSelected ? (a4CutMode ? "#EF4444" : "#3B82F6") : "#9CA3AF";
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.setLineDash(isSelected ? [] : [5, 5]);
            ctx.strokeRect(x, y, contentWidthScreen, contentHeightScreen);

            // Bordure de chevauchement (pointillés orange)
            if (a4OverlapMm > 0 && isSelected) {
              ctx.strokeStyle = "#F59E0B";
              ctx.lineWidth = 1;
              ctx.setLineDash([3, 3]);
              if (col > 0) {
                ctx.beginPath();
                ctx.moveTo(x - overlapScreen, y);
                ctx.lineTo(x - overlapScreen, y + contentHeightScreen);
                ctx.stroke();
              }
              if (row > 0) {
                ctx.beginPath();
                ctx.moveTo(x, y - overlapScreen);
                ctx.lineTo(x + contentWidthScreen, y - overlapScreen);
                ctx.stroke();
              }
            }

            // Numéro de cellule en haut à droite (comme dans le PDF)
            ctx.setLineDash([]);
            const labelX = x + contentWidthScreen - 15;
            const labelY = y + 12;

            // Fond du label
            ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            ctx.fillRect(labelX - 10, labelY - 8, 22, 14);
            ctx.strokeStyle = isSelected ? (a4CutMode ? "#EF4444" : "#3B82F6") : "#9CA3AF";
            ctx.lineWidth = 1;
            ctx.strokeRect(labelX - 10, labelY - 8, 22, 14);

            // Texte du label
            ctx.fillStyle = isSelected ? (a4CutMode ? "#EF4444" : "#3B82F6") : "#6B7280";
            ctx.font = "bold 10px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${row + 1}-${col + 1}`, labelX + 1, labelY);
          }
        }

        // Dessiner l'indicateur d'origine (coin déplaçable)
        ctx.setLineDash([]);
        ctx.fillStyle = "#EF4444";
        ctx.beginPath();
        ctx.arc(originScreenX, originScreenY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Flèches pour montrer l'orientation
        ctx.strokeStyle = "#EF4444";
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        // Flèche X
        ctx.beginPath();
        ctx.moveTo(originScreenX, originScreenY);
        ctx.lineTo(originScreenX + 30, originScreenY);
        ctx.lineTo(originScreenX + 25, originScreenY - 5);
        ctx.moveTo(originScreenX + 30, originScreenY);
        ctx.lineTo(originScreenX + 25, originScreenY + 5);
        ctx.stroke();
        // Flèche Y
        ctx.beginPath();
        ctx.moveTo(originScreenX, originScreenY);
        ctx.lineTo(originScreenX, originScreenY + 30);
        ctx.lineTo(originScreenX - 5, originScreenY + 25);
        ctx.moveTo(originScreenX, originScreenY + 30);
        ctx.lineTo(originScreenX + 5, originScreenY + 25);
        ctx.stroke();

        // Dimensions de la grille totale (avec chevauchement pris en compte)
        const totalWidthMm = a4GridCols * contentWidthMm + a4OverlapMm;
        const totalHeightMm = a4GridRows * contentHeightMm + a4OverlapMm;
        ctx.fillStyle = "#374151";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        const overlapText = a4OverlapMm > 0 ? ` (chevauche. ${a4OverlapMm}mm)` : "";
        const modeText = a4CutMode ? " [DÉCOUPE]" : "";
        ctx.fillText(
          `Grille: ${a4GridCols}×${a4GridRows} = ${Math.round(totalWidthMm)}×${Math.round(totalHeightMm)} mm${overlapText}${modeText}`,
          originScreenX + 5,
          originScreenY - 15,
        );

        ctx.restore();
      }
    }
  }, [
    sketch,
    viewport,
    selectedEntities,
    hoveredEntity,
    referenceHighlight,
    currentSnapPoint,
    tempGeometry,
    showGrid,
    showConstraints,
    showDimensions,
    showBackgroundImage,
    imageOpacity,
    imageScale,
    calibrationData,
    showCalibrationPanel,
    measureStart,
    measureEnd,
    measurePreviewEnd,
    transformedImage,
    measurements,
    selectionBox,
    offsetPreview,
    filletDialog,
    chamferDialog,
    filletPreview,
    chamferPreview,
    isDragging,
    dragTarget,
    lineLengthDialog,
    angleEditDialog,
    perpendicularInfo,
    tempGeometry,
    tempPoints,
    highlightOpacity,
    mouseWorldPos,
    // Multi-photos
    backgroundImages,
    selectedImageId,
    markerLinks,
    selectedMarkerId,
    // Gizmo de transformation
    transformGizmo,
    selectionGizmoData,
    showTransformGizmo,
    gizmoDrag,
    // Mode comparaison branches
    comparisonMode,
    comparisonStyle,
    comparisonBranchesData,
    comparisonOpacity,
    activeBranchColor,
    revealBranchData,
    revealPosition,
    // Grille A4
    showA4Grid,
    a4GridOrigin,
    a4GridOrientation,
    a4GridRows,
    a4GridCols,
    selectedA4Cells,
    a4OverlapMm,
    a4CutMode,
  ]);

  useEffect(() => {
    // Utiliser requestAnimationFrame pour throttler le rendu
    // Cela évite les rendus trop fréquents pendant le tracé
    if (renderRequestRef.current !== null) {
      cancelAnimationFrame(renderRequestRef.current);
    }
    renderRequestRef.current = requestAnimationFrame(() => {
      render();
      renderRequestRef.current = null;
    });

    return () => {
      if (renderRequestRef.current !== null) {
        cancelAnimationFrame(renderRequestRef.current);
      }
    };
  }, [render]);

  // Vider la sélection quand on change d'outil (sauf pour select et mirror)
  useEffect(() => {
    // Pour l'outil mirror, capturer la sélection et passer en mode waitingAxis1
    // Note: cast en string pour éviter erreur TS si types.ts pas à jour
    if ((activeTool as string) === "mirror") {
      if (selectedEntities.size > 0) {
        setMirrorState({
          phase: "waitingAxis1",
          entitiesToMirror: new Set(selectedEntities),
          offset: 0,
        });
        toast.info("Cliquez sur un segment (axe) ou tracez l'axe librement");
      }
      // Ne PAS vider la sélection pour mirror - on garde la visualisation
      setMarkerMode("idle");
      setPendingLink(null);
      setSelectedMarkerId(null);
      setShowTransformGizmo(false);
      return; // Sortir tôt pour ne pas vider la sélection
    }

    if (activeTool !== "select") {
      setSelectedEntities(new Set());
      // Désactiver le mode marqueur quand on change d'outil
      setMarkerMode("idle");
      setPendingLink(null);
      setSelectedMarkerId(null);
      // Désactiver le gizmo de transformation quand on change d'outil
      setShowTransformGizmo(false);
    }
    // Réinitialiser la mesure quand on change d'outil
    if (activeTool !== "measure") {
      setMeasureState({
        phase: "idle",
        start: null,
        end: null,
        result: null,
        segment1Id: null,
      });
      setMeasurePreviewEnd(null);
      // Effacer toutes les mesures quand on quitte l'outil
      setMeasurements([]);
    }
    // Réinitialiser l'offset quand on change d'outil
    if (activeTool !== "offset") {
      setOffsetDialog(null);
      setOffsetPreview([]);
    }
    // Réinitialiser les inputs rectangle quand on change d'outil
    if (activeTool !== "rectangle") {
      setRectInputs({
        active: false,
        widthValue: "",
        heightValue: "",
        activeField: "width",
        editingWidth: false,
        editingHeight: false,
        widthInputPos: { x: 0, y: 0 },
        heightInputPos: { x: 0, y: 0 },
      });
    }
    // Réinitialiser arc 3 points quand on change d'outil
    if (activeTool !== "arc3points") {
      setArc3Points([]);
    }
    // Réinitialiser symétrie quand on change d'outil
    // Note: cast en string pour éviter erreur TS si types.ts pas à jour
    if ((activeTool as string) !== "mirror") {
      setMirrorState({
        phase: "idle",
        entitiesToMirror: new Set(),
        offset: 0,
      });
    }
  }, [activeTool]);

  // Focus sur l'input largeur quand on commence à tracer un rectangle
  useEffect(() => {
    if (rectInputs.active && widthInputRef.current) {
      // Petit délai pour s'assurer que le DOM est prêt
      setTimeout(() => {
        widthInputRef.current?.focus();
        widthInputRef.current?.select();
      }, 50);
    }
  }, [rectInputs.active]);

  // Mettre à jour le rectangle preview en temps réel quand on tape les dimensions
  useEffect(() => {
    if (!rectInputs.active || !tempGeometry?.type || tempGeometry.type !== "rectangle" || !tempGeometry.p1) return;
    if (tempPoints.length === 0) return;

    const p1 = tempPoints[0];
    const inputWidth = parseFloat(rectInputs.widthValue);
    const inputHeight = parseFloat(rectInputs.heightValue);

    // Si au moins une valeur est saisie, mettre à jour le cursor
    if ((!isNaN(inputWidth) && inputWidth > 0) || (!isNaN(inputHeight) && inputHeight > 0)) {
      const currentCursor = tempGeometry.cursor || { x: p1.x + 50, y: p1.y + 50 };

      // Déterminer la direction actuelle (ou par défaut bas-droite)
      const dirX = currentCursor.x >= p1.x ? 1 : -1;
      const dirY = currentCursor.y >= p1.y ? 1 : -1;

      // Calculer les nouvelles coordonnées du cursor
      let newX = currentCursor.x;
      let newY = currentCursor.y;

      if (!isNaN(inputWidth) && inputWidth > 0) {
        const widthPx = inputWidth * sketch.scaleFactor;
        newX = p1.x + widthPx * dirX;
      }

      if (!isNaN(inputHeight) && inputHeight > 0) {
        const heightPx = inputHeight * sketch.scaleFactor;
        newY = p1.y + heightPx * dirY;
      }

      // Ne mettre à jour que si les valeurs ont changé
      if (Math.abs(newX - currentCursor.x) > 0.01 || Math.abs(newY - currentCursor.y) > 0.01) {
        setTempGeometry({
          ...tempGeometry,
          cursor: { x: newX, y: newY },
        });
      }
    }
  }, [
    rectInputs.widthValue,
    rectInputs.heightValue,
    rectInputs.active,
    tempGeometry?.p1,
    tempPoints,
    sketch.scaleFactor,
  ]);

  // Charger les données
  const loadSketchData = useCallback(
    (data: any) => {
      if (!data) return;

      // FIX #92: Marquer qu'on est en train de charger pour éviter la suppression d'images orphelines
      isLoadingDataRef.current = true;

      const newSketch = createEmptySketch(scaleFactor);

      if (data.points) {
        for (const [id, point] of Object.entries(data.points)) {
          newSketch.points.set(id, point as Point);
        }
      }

      if (data.geometries) {
        for (const [id, geo] of Object.entries(data.geometries)) {
          newSketch.geometries.set(id, geo as Geometry);
        }
      }

      if (data.constraints) {
        for (const [id, constraint] of Object.entries(data.constraints)) {
          newSketch.constraints.set(id, constraint as Constraint);
        }
      }

      if (data.dimensions) {
        for (const [id, dim] of Object.entries(data.dimensions)) {
          newSketch.dimensions.set(id, dim as Dimension);
        }
      }

      // FIX v7.33: Restaurer les calques (layers)
      if (data.layers) {
        newSketch.layers = new Map();
        for (const [id, layer] of Object.entries(data.layers)) {
          newSketch.layers.set(id, layer as Layer);
        }
      }

      // FIX v7.33: Restaurer les groupes de géométries
      if (data.groups) {
        newSketch.groups = new Map();
        for (const [id, group] of Object.entries(data.groups)) {
          newSketch.groups.set(id, group as GeometryGroup);
        }
      }

      // FIX v7.33: Restaurer les groupes de calques (dossiers)
      if (data.layerGroups) {
        newSketch.layerGroups = new Map();
        for (const [id, layerGroup] of Object.entries(data.layerGroups)) {
          newSketch.layerGroups.set(id, layerGroup as LayerGroup);
        }
      }

      // FIX v7.33: Restaurer les remplissages de formes
      if (data.shapeFills) {
        newSketch.shapeFills = new Map();
        for (const [id, fill] of Object.entries(data.shapeFills)) {
          newSketch.shapeFills.set(id, fill as ShapeFill);
        }
      }

      // FIX v7.33: Restaurer le calque actif
      if (data.activeLayerId) {
        newSketch.activeLayerId = data.activeLayerId;
      }

      // FIX v7.33: Restaurer le scale factor si présent
      if (data.scaleFactor !== undefined) {
        newSketch.scaleFactor = data.scaleFactor;
      }

      setSketch(newSketch);

      // Charger les données de la grille A4 si présentes
      if (data.a4Grid) {
        if (data.a4Grid.origin) setA4GridOrigin(data.a4Grid.origin);
        if (data.a4Grid.orientation) setA4GridOrientation(data.a4Grid.orientation);
        if (data.a4Grid.rows) setA4GridRows(data.a4Grid.rows);
        if (data.a4Grid.cols) setA4GridCols(data.a4Grid.cols);
        if (data.a4Grid.overlapMm !== undefined) setA4OverlapMm(data.a4Grid.overlapMm);
        if (data.a4Grid.cutMode !== undefined) setA4CutMode(data.a4Grid.cutMode);
      }

      // MOD v7.16: Charger les mesures si présentes
      if (data.measurements && Array.isArray(data.measurements)) {
        setMeasurements(data.measurements);
      }

      // NE PAS appeler solveSketch ici - on veut restaurer l'état exact de l'historique
      // sans que le solver "corrige" les contraintes H/V
      // solveSketch(newSketch);

      // FIX #92: Délai pour laisser les effets se stabiliser avant de débloquer la suppression d'images
      setTimeout(() => {
        isLoadingDataRef.current = false;
      }, 100);
    },
    [scaleFactor],
  );

  // Sauvegarder
  const saveSketch = useCallback(() => {
    const data = {
      points: Object.fromEntries(sketch.points),
      geometries: Object.fromEntries(sketch.geometries),
      constraints: Object.fromEntries(sketch.constraints),
      dimensions: Object.fromEntries(sketch.dimensions),
      scaleFactor: sketch.scaleFactor,
      savedAt: new Date().toISOString(),
      // FIX v7.33: Sauvegarder les calques et groupes
      layers: sketch.layers ? Object.fromEntries(sketch.layers) : undefined,
      layerGroups: sketch.layerGroups ? Object.fromEntries(sketch.layerGroups) : undefined,
      groups: sketch.groups ? Object.fromEntries(sketch.groups) : undefined,
      shapeFills: sketch.shapeFills ? Object.fromEntries(sketch.shapeFills) : undefined,
      activeLayerId: sketch.activeLayerId,
      // Données de la grille A4
      a4Grid: {
        origin: a4GridOrigin,
        orientation: a4GridOrientation,
        rows: a4GridRows,
        cols: a4GridCols,
        overlapMm: a4OverlapMm,
        cutMode: a4CutMode,
      },
      // MOD v7.16: Sauvegarder les mesures avec le template
      measurements: measurements,
    };

    if (onSave) {
      onSave(data);
      toast.success("Gabarit sauvegardé !");
    }

    return data;
  }, [sketch, onSave, a4GridOrigin, a4GridOrientation, a4GridRows, a4GridCols, a4OverlapMm, a4CutMode, measurements]);

  // v7.37: Sauvegarder localement (téléchargement fichier JSON avec images)
  const saveLocalBackup = useCallback(() => {
    const toastId = toast.loading("Préparation de la sauvegarde locale...");

    try {
      // Sérialiser les images avec leurs data URLs
      const serializedImages = backgroundImages.map((img) => ({
        id: img.id,
        name: img.name,
        src: img.src || img.image?.src || null,
        x: img.x,
        y: img.y,
        scale: img.scale,
        rotation: img.rotation,
        opacity: img.opacity,
        visible: img.visible,
        locked: img.locked,
        markers: img.markers,
        adjustments: img.adjustments,
        layerId: img.layerId,
        order: img.order,
        crop: img.crop,
        blendMode: img.blendMode,
        calibrationData: img.calibrationData
          ? {
              mode: img.calibrationData.mode,
              scale: img.calibrationData.scale,
              scaleX: img.calibrationData.scaleX,
              scaleY: img.calibrationData.scaleY,
              error: img.calibrationData.error,
              errorX: img.calibrationData.errorX,
              errorY: img.calibrationData.errorY,
              applied: img.calibrationData.applied,
              points: img.calibrationData.points ? Array.from(img.calibrationData.points.entries()) : [],
              pairs: img.calibrationData.pairs ? Array.from(img.calibrationData.pairs.entries()) : [],
            }
          : undefined,
      }));

      const localBackupData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        sketch: {
          id: sketch.id,
          name: sketch.name,
          points: Object.fromEntries(sketch.points),
          geometries: Object.fromEntries(sketch.geometries),
          constraints: Object.fromEntries(sketch.constraints),
          dimensions: Object.fromEntries(sketch.dimensions),
          scaleFactor: sketch.scaleFactor,
          layers: sketch.layers ? Object.fromEntries(sketch.layers) : undefined,
          layerGroups: sketch.layerGroups ? Object.fromEntries(sketch.layerGroups) : undefined,
          groups: sketch.groups ? Object.fromEntries(sketch.groups) : undefined,
          shapeFills: sketch.shapeFills ? Object.fromEntries(sketch.shapeFills) : undefined,
          activeLayerId: sketch.activeLayerId,
        },
        backgroundImages: serializedImages,
        markerLinks: markerLinks,
        a4Grid: {
          origin: a4GridOrigin,
          orientation: a4GridOrientation,
          rows: a4GridRows,
          cols: a4GridCols,
          overlapMm: a4OverlapMm,
          cutMode: a4CutMode,
        },
        measurements: measurements,
      };

      // Créer et télécharger le fichier
      const jsonStr = JSON.stringify(localBackupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      link.download = `cad-backup-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Sauvegarde locale téléchargée ! (${backgroundImages.length} photos)`, { id: toastId });
    } catch (error) {
      console.error("[LocalBackup] Error:", error);
      toast.error("Erreur lors de la sauvegarde locale", { id: toastId });
    }
  }, [
    sketch,
    backgroundImages,
    markerLinks,
    a4GridOrigin,
    a4GridOrientation,
    a4GridRows,
    a4GridCols,
    a4OverlapMm,
    a4CutMode,
    measurements,
  ]);

  // v7.37: Charger une sauvegarde locale
  const loadLocalBackup = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const toastId = toast.loading("Chargement de la sauvegarde...");

        try {
          const jsonStr = event.target?.result as string;
          const data = JSON.parse(jsonStr);

          if (!data.version || !data.sketch) {
            throw new Error("Format de fichier invalide");
          }

          // Charger le sketch
          loadSketchData(data.sketch);

          // Charger les images
          if (data.backgroundImages && data.backgroundImages.length > 0) {
            const loadedImages: BackgroundImage[] = [];

            for (const imgData of data.backgroundImages) {
              if (!imgData.src) continue;

              try {
                // Charger l'image
                const htmlImage = await new Promise<HTMLImageElement>((resolve, reject) => {
                  const img = new Image();
                  img.onload = () => resolve(img);
                  img.onerror = () => reject(new Error(`Échec du chargement: ${imgData.name}`));
                  img.src = imgData.src;
                });

                // Reconvertir calibrationData si présent
                const calibData = imgData.calibrationData;
                loadedImages.push({
                  ...imgData,
                  image: htmlImage,
                  calibrationData: calibData
                    ? {
                        ...calibData,
                        points:
                          calibData.points && Array.isArray(calibData.points) ? new Map(calibData.points) : new Map(),
                        pairs: calibData.pairs && Array.isArray(calibData.pairs) ? new Map(calibData.pairs) : new Map(),
                      }
                    : undefined,
                });
              } catch (err) {
                console.warn("[LocalBackup] Skipping image:", imgData.name, err);
              }
            }

            if (loadedImages.length > 0) {
              setBackgroundImages(loadedImages);
              setShowBackgroundImage(true);
            }
          }

          // Charger les markerLinks
          if (data.markerLinks) {
            setMarkerLinks(data.markerLinks);
          }

          // Charger les mesures
          if (data.measurements) {
            setMeasurements(data.measurements);
          }

          toast.success(`Sauvegarde chargée ! (${data.backgroundImages?.length || 0} photos)`, { id: toastId });
        } catch (error) {
          console.error("[LocalBackup] Error loading:", error);
          toast.error("Erreur lors du chargement", { id: toastId });
        }
      };

      reader.readAsText(file);
      e.target.value = ""; // Reset pour permettre de re-sélectionner le même fichier
    },
    [loadSketchData, setBackgroundImages, setMarkerLinks, setMeasurements, setShowBackgroundImage],
  );

  // ============================================
  // MOD v7.14: AUTO-BACKUP SUPABASE
  // Protection contre les pertes de données spontanées
  // ============================================
  const {
    lastBackupTime: autoBackupLastTime,
    backupCount: autoBackupCount,
    isRestoring: autoBackupIsRestoring,
    saveBackup: autoBackupSave,
    restoreFromBackup: autoBackupRestore,
    formattedLastBackup: autoBackupFormatted,
  } = useCADAutoBackup(sketch, backgroundImages, markerLinks, loadSketchData, setBackgroundImages, setMarkerLinks, {
    enabled: true,
    intervalMs: 120000, // FIX CPU: Sauvegarde toutes les 2 minutes (était 30s - trop fréquent)
    minGeometryCount: 1, // Sauvegarder dès qu'il y a au moins 1 géométrie
    templateId,
  });

  // v7.37: Fonction pour ajouter une image avec son calque
  const addImageWithLayer = useCallback(
    (img: BackgroundImage) => {
      const layerColors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#EF4444"];

      setSketch((prevSketch) => {
        const updatedLayers = new Map(prevSketch.layers);
        const layerCount = prevSketch.layers.size + 1;
        const layerId = `photo_${img.id}`;

        const newLayer: Layer = {
          id: layerId,
          name: `Calque ${layerCount}`,
          color: layerColors[(layerCount - 1) % layerColors.length],
          visible: true,
          locked: false,
          order: layerCount,
          opacity: 1,
        };

        updatedLayers.set(layerId, newLayer);

        // Ajouter l'image en dehors du setSketch
        setTimeout(() => {
          setBackgroundImages((prev) => [...prev, { ...img, layerId }]);
          setShowBackgroundImage(true);
        }, 0);

        return { ...prevSketch, layers: updatedLayers };
      });
    },
    [setShowBackgroundImage],
  );

  // v7.32: Hook pour le drag & drop d'images sur le canvas
  useImageDragDrop({
    containerRef,
    viewport,
    imageOpacity,
    activeLayerId: sketch.activeLayerId,
    onImagesAdded: useCallback((newImages: BackgroundImage[]) => {
      // v7.32: Créer un calque pour chaque photo avec nom simple "Calque N"
      const layerColors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#EF4444"];

      setSketch((prevSketch) => {
        const imagesWithLayers: BackgroundImage[] = [];
        const updatedLayers = new Map(prevSketch.layers);
        let layerCount = prevSketch.layers.size;

        newImages.forEach((img, index) => {
          // Créer un nouveau calque pour cette photo
          const layerId = `photo_${img.id}`;
          layerCount++;

          const newLayer: Layer = {
            id: layerId,
            name: `Calque ${layerCount}`,
            color: layerColors[(layerCount - 1) % layerColors.length],
            visible: true,
            locked: false,
            order: layerCount,
            opacity: 1,
          };

          updatedLayers.set(layerId, newLayer);
          imagesWithLayers.push({ ...img, layerId });
        });

        // Ajouter les images en dehors du setSketch
        setTimeout(() => {
          setBackgroundImages((prev) => [...prev, ...imagesWithLayers]);
        }, 0);

        return { ...prevSketch, layers: updatedLayers };
      });

      toast.success(`${newImages.length} photo(s) ajoutée(s) avec calque(s)`);
    }, []),
    setShowBackgroundImage,
    // v7.37: Callback pour demander si calibrer l'image au drop
    onAskCalibration: useCallback((image: BackgroundImage) => {
      // Stocker l'image en attente et ouvrir la modale de choix
      setPendingCalibrationImage(image);
      setShowCalibrationModal(true);
    }, []),
  });

  // v7.32: Supprimer les photos dont le calque a été supprimé
  // FIX #92: Ne pas supprimer pendant le chargement de données (évite le vidage accidentel)
  useEffect(() => {
    // FIX #92: Skip si on est en train de charger des données (loadSketchData, undo/redo, restore)
    if (isLoadingDataRef.current) {
      console.log("[FIX #92] Suppression images orphelines skippée (chargement en cours)");
      return;
    }

    if (backgroundImages.length === 0) return;

    const layerIds = new Set(sketch.layers.keys());
    const orphanedImages = backgroundImages.filter((img) => {
      // Si l'image a un layerId qui commence par "photo_" (calque créé pour elle)
      // et que ce calque n'existe plus, alors l'image est orpheline
      if (img.layerId && img.layerId.startsWith("photo_") && !layerIds.has(img.layerId)) {
        return true;
      }
      return false;
    });

    if (orphanedImages.length > 0) {
      // FIX #92: Vérification supplémentaire - ne pas supprimer si ça vide tout
      if (orphanedImages.length === backgroundImages.length) {
        console.warn("[FIX #92] ⚠️ Suppression de TOUTES les images orphelines bloquée (probable reset accidentel)");
        return;
      }

      // Supprimer les images orphelines
      const orphanedIds = new Set(orphanedImages.map((img) => img.id));
      setBackgroundImages((prev) => prev.filter((img) => !orphanedIds.has(img.id)));

      // Supprimer aussi les liens de markers associés
      setMarkerLinks((links) =>
        links.filter((link) => !orphanedIds.has(link.marker1.imageId) && !orphanedIds.has(link.marker2.imageId)),
      );

      toast.success(`${orphanedImages.length} photo(s) supprimée(s) avec le(s) calque(s)`);
    }
  }, [sketch.layers, backgroundImages.length]);

  // Résoudre le sketch
  const solveSketch = useCallback(async (sketchToSolve: Sketch) => {
    const result = await solverRef.current.solve(sketchToSolve);

    // Le solveur modifie sketchToSolve en place, on doit propager ces modifications
    // On crée une nouvelle Map pour déclencher le re-render
    const updatedPoints = new Map(sketchToSolve.points);
    const updatedGeometries = new Map(sketchToSolve.geometries);

    setSketch((s) => ({
      ...s,
      points: updatedPoints,
      geometries: updatedGeometries,
      constraints: sketchToSolve.constraints,
      dof: result.dof,
      status: result.status,
    }));
  }, []);

  // Historique - défini tôt car utilisé par plusieurs callbacks
  const addToHistory = useCallback((newSketch: Sketch, description: string = "Modification") => {
    const { branches: currentBranches, activeBranchId: currentActiveBranchId } = branchesRef.current;
    const branchIndex = currentBranches.findIndex((b) => b.id === currentActiveBranchId);
    if (branchIndex === -1) return;

    const branch = currentBranches[branchIndex];
    const newEntry: HistoryEntry = {
      sketch: serializeSketch(newSketch),
      description,
      timestamp: Date.now(),
    };

    // Couper l'historique au point actuel et ajouter le nouvel état
    const newHistory = [...branch.history.slice(0, branch.historyIndex + 1), newEntry];
    const newIndex = branch.historyIndex + 1;

    const updatedBranch = { ...branch, history: newHistory, historyIndex: newIndex };
    const newBranches = [...currentBranches];
    newBranches[branchIndex] = updatedBranch;

    setBranches(newBranches);
    branchesRef.current = { branches: newBranches, activeBranchId: currentActiveBranchId };
    historyRef.current = { history: newHistory, index: newIndex };
  }, []);

  // Appliquer la symétrie avec un axe donné (2 points)
  const applyMirrorWithAxis = useCallback(
    (axis1: Point, axis2: Point) => {
      if (mirrorState.entitiesToMirror.size === 0) return;

      // Fonction de réflexion d'un point par rapport à l'axe
      const reflectPoint = (p: Point): Point => {
        const dx = axis2.x - axis1.x;
        const dy = axis2.y - axis1.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return { ...p };

        const t = ((p.x - axis1.x) * dx + (p.y - axis1.y) * dy) / lenSq;
        const projX = axis1.x + t * dx;
        const projY = axis1.y + t * dy;

        return {
          id: generateId(),
          x: 2 * projX - p.x,
          y: 2 * projY - p.y,
        };
      };

      const currentSketch = sketchRef.current;
      const newSketch = { ...currentSketch };
      newSketch.points = new Map(currentSketch.points);
      newSketch.geometries = new Map(currentSketch.geometries);

      const pointMapping = new Map<string, string>();

      // Créer les points miroir
      for (const entityId of mirrorState.entitiesToMirror) {
        const geo = currentSketch.geometries.get(entityId);
        if (geo) {
          if (geo.type === "line") {
            const line = geo as Line;
            const p1 = currentSketch.points.get(line.p1);
            const p2 = currentSketch.points.get(line.p2);
            if (p1 && p2) {
              if (!pointMapping.has(line.p1)) {
                const newP1 = reflectPoint(p1);
                newSketch.points.set(newP1.id, newP1);
                pointMapping.set(line.p1, newP1.id);
              }
              if (!pointMapping.has(line.p2)) {
                const newP2 = reflectPoint(p2);
                newSketch.points.set(newP2.id, newP2);
                pointMapping.set(line.p2, newP2.id);
              }
            }
          } else if (geo.type === "circle") {
            const circle = geo as CircleType;
            const center = currentSketch.points.get(circle.center);
            if (center && !pointMapping.has(circle.center)) {
              const newCenter = reflectPoint(center);
              newSketch.points.set(newCenter.id, newCenter);
              pointMapping.set(circle.center, newCenter.id);
            }
          } else if (geo.type === "arc") {
            const arc = geo as Arc;
            const center = currentSketch.points.get(arc.center);
            const startPt = currentSketch.points.get(arc.startPoint);
            const endPt = currentSketch.points.get(arc.endPoint);
            if (center && !pointMapping.has(arc.center)) {
              const newCenter = reflectPoint(center);
              newSketch.points.set(newCenter.id, newCenter);
              pointMapping.set(arc.center, newCenter.id);
            }
            if (startPt && !pointMapping.has(arc.startPoint)) {
              const newStart = reflectPoint(startPt);
              newSketch.points.set(newStart.id, newStart);
              pointMapping.set(arc.startPoint, newStart.id);
            }
            if (endPt && !pointMapping.has(arc.endPoint)) {
              const newEnd = reflectPoint(endPt);
              newSketch.points.set(newEnd.id, newEnd);
              pointMapping.set(arc.endPoint, newEnd.id);
            }
          }
        }
      }

      // Créer les géométries miroir
      for (const entityId of mirrorState.entitiesToMirror) {
        const geo = currentSketch.geometries.get(entityId);
        if (geo) {
          if (geo.type === "line") {
            const line = geo as Line;
            const newLine: Line = {
              id: generateId(),
              type: "line",
              p1: pointMapping.get(line.p1) || line.p1,
              p2: pointMapping.get(line.p2) || line.p2,
              layerId: line.layerId,
              strokeWidth: (line as any).strokeWidth,
            };
            newSketch.geometries.set(newLine.id, newLine);
          } else if (geo.type === "circle") {
            const circle = geo as CircleType;
            const newCircle: CircleType = {
              id: generateId(),
              type: "circle",
              center: pointMapping.get(circle.center) || circle.center,
              radius: circle.radius,
              layerId: circle.layerId,
            };
            newSketch.geometries.set(newCircle.id, newCircle);
          } else if (geo.type === "arc") {
            const arc = geo as Arc;
            const newArc: Arc = {
              id: generateId(),
              type: "arc",
              center: pointMapping.get(arc.center) || arc.center,
              startPoint: pointMapping.get(arc.endPoint) || arc.endPoint,
              endPoint: pointMapping.get(arc.startPoint) || arc.startPoint,
              radius: arc.radius,
              counterClockwise: !arc.counterClockwise,
              layerId: arc.layerId,
            };
            newSketch.geometries.set(newArc.id, newArc);
          }
        }
      }

      setSketch(newSketch);
      addToHistory(newSketch, "Symétrie");
      setMirrorState({ phase: "idle", entitiesToMirror: new Set(), offset: 0 });
      setTempGeometry(null);
      setSelectedEntities(new Set());
      toast.success("Symétrie appliquée");
    },
    [mirrorState.entitiesToMirror, addToHistory],
  );

  // Historique des images - empiler l'état avant suppression
  const addToImageHistory = useCallback((images: BackgroundImage[], links: ImageMarkerLink[]) => {
    // Créer une copie profonde des images (sans les HTMLElement qui sont partagés par référence)
    const imagesCopy = images.map((img) => ({
      ...img,
      markers: [...img.markers.map((m) => ({ ...m }))],
    }));
    const linksCopy = links.map((l) => ({
      ...l,
      marker1: { ...l.marker1 },
      marker2: { ...l.marker2 },
    }));

    // MOD v7.12: Ajout timestamp pour synchronisation chronologique
    const newState: ImageHistoryState = {
      backgroundImages: imagesCopy,
      markerLinks: linksCopy,
      timestamp: Date.now(),
    };
    setImageHistory((prev) => [...prev, newState]);
  }, []);

  // Ref pour addToImageHistory (évite stale closures dans event handlers)
  const addToImageHistoryRef = useRef(addToImageHistory);
  useEffect(() => {
    addToImageHistoryRef.current = addToImageHistory;
  }, [addToImageHistory]);

  // Conversion coordonnées (système standard: Y vers le bas)
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      return {
        x: (screenX - viewport.offsetX) / viewport.scale,
        y: (screenY - viewport.offsetY) / viewport.scale,
      };
    },
    [viewport],
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number) => {
      return {
        x: worldX * viewport.scale + viewport.offsetX,
        y: worldY * viewport.scale + viewport.offsetY,
      };
    },
    [viewport],
  );

  // Helper: vérifie si une ligne intersecte une boîte
  const lineIntersectsBox = useCallback(
    (p1: Point, p2: Point, minX: number, minY: number, maxX: number, maxY: number): boolean => {
      // Algorithme de Cohen-Sutherland simplifié
      // Vérifie si le segment [p1, p2] traverse le rectangle [minX, minY, maxX, maxY]

      const INSIDE = 0,
        LEFT = 1,
        RIGHT = 2,
        BOTTOM = 4,
        TOP = 8;

      const computeCode = (x: number, y: number): number => {
        let code = INSIDE;
        if (x < minX) code |= LEFT;
        else if (x > maxX) code |= RIGHT;
        if (y < minY) code |= BOTTOM;
        else if (y > maxY) code |= TOP;
        return code;
      };

      let x1 = p1.x,
        y1 = p1.y,
        x2 = p2.x,
        y2 = p2.y;
      let code1 = computeCode(x1, y1);
      let code2 = computeCode(x2, y2);

      while (true) {
        if ((code1 | code2) === 0) return true; // Complètement à l'intérieur
        if ((code1 & code2) !== 0) return false; // Complètement à l'extérieur

        // La ligne traverse potentiellement, on calcule l'intersection
        const codeOut = code1 !== 0 ? code1 : code2;
        let x = 0,
          y = 0;

        if (codeOut & TOP) {
          x = x1 + ((x2 - x1) * (maxY - y1)) / (y2 - y1);
          y = maxY;
        } else if (codeOut & BOTTOM) {
          x = x1 + ((x2 - x1) * (minY - y1)) / (y2 - y1);
          y = minY;
        } else if (codeOut & RIGHT) {
          y = y1 + ((y2 - y1) * (maxX - x1)) / (x2 - x1);
          x = maxX;
        } else if (codeOut & LEFT) {
          y = y1 + ((y2 - y1) * (minX - x1)) / (x2 - x1);
          x = minX;
        }

        if (codeOut === code1) {
          x1 = x;
          y1 = y;
          code1 = computeCode(x1, y1);
        } else {
          x2 = x;
          y2 = y;
          code2 = computeCode(x2, y2);
        }
      }
    },
    [],
  );

  // Helper: vérifie si un cercle intersecte une boîte
  const circleIntersectsBox = useCallback(
    (center: Point, radius: number, minX: number, minY: number, maxX: number, maxY: number): boolean => {
      // Trouver le point le plus proche du centre sur le rectangle
      const closestX = Math.max(minX, Math.min(center.x, maxX));
      const closestY = Math.max(minY, Math.min(center.y, maxY));

      // Calculer la distance entre le centre et ce point
      const dx = center.x - closestX;
      const dy = center.y - closestY;
      const distanceSquared = dx * dx + dy * dy;

      return distanceSquared <= radius * radius;
    },
    [],
  );

  // Vérifier si un arc intersecte une boîte de sélection
  const arcIntersectsBox = useCallback(
    (
      center: Point,
      radius: number,
      startPt: Point,
      endPt: Point,
      minX: number,
      minY: number,
      maxX: number,
      maxY: number,
    ): boolean => {
      // Calculer les angles de l'arc
      const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
      const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);

      // Normaliser les angles
      const normalizeAngle = (a: number) => {
        while (a < 0) a += 2 * Math.PI;
        while (a >= 2 * Math.PI) a -= 2 * Math.PI;
        return a;
      };

      const start = normalizeAngle(startAngle);
      const end = normalizeAngle(endAngle);

      // Fonction pour vérifier si un angle est dans l'arc
      const angleInArc = (angle: number) => {
        const a = normalizeAngle(angle);
        if (start <= end) {
          return a >= start && a <= end;
        } else {
          return a >= start || a <= end;
        }
      };

      // Vérifier les 4 points cardinaux de l'arc (si dans l'arc)
      const cardinalPoints = [
        { angle: 0, x: center.x + radius, y: center.y }, // Droite
        { angle: Math.PI / 2, x: center.x, y: center.y + radius }, // Bas
        { angle: Math.PI, x: center.x - radius, y: center.y }, // Gauche
        { angle: (3 * Math.PI) / 2, x: center.x, y: center.y - radius }, // Haut
      ];

      for (const cp of cardinalPoints) {
        if (angleInArc(cp.angle)) {
          if (cp.x >= minX && cp.x <= maxX && cp.y >= minY && cp.y <= maxY) {
            return true;
          }
        }
      }

      // Vérifier si le centre est proche de la boîte et si l'arc touche un bord
      const closestX = Math.max(minX, Math.min(center.x, maxX));
      const closestY = Math.max(minY, Math.min(center.y, maxY));
      const dx = center.x - closestX;
      const dy = center.y - closestY;
      const distSq = dx * dx + dy * dy;

      if (distSq <= radius * radius) {
        // Le cercle complet intersecte la boîte, vérifier si l'angle de l'intersection est dans l'arc
        const angleToClosest = Math.atan2(closestY - center.y, closestX - center.x);
        if (angleInArc(angleToClosest)) {
          return true;
        }
      }

      return false;
    },
    [],
  );

  // Trouver l'entité sous le curseur
  const findEntityAtPosition = useCallback(
    (worldX: number, worldY: number): string | null => {
      const tolerance = 15 / viewport.scale; // Augmenté de 10 à 15 pour meilleure détection
      const pointTolerance = 10 / viewport.scale; // Augmenté de 8 à 10

      // PRIORITÉ 1: Vérifier les points de COIN en premier (pour congé/chanfrein)
      // Un coin est un point connecté à exactement 2 lignes (hors lignes de construction)
      for (const [id, point] of sketch.points) {
        if (distance({ x: worldX, y: worldY }, point) < pointTolerance) {
          // Compter les lignes connectées à ce point (exclure les lignes de construction)
          let connectedLines = 0;
          for (const geo of sketch.geometries.values()) {
            if (geo.type === "line") {
              const line = geo as Line;
              // Exclure les lignes de construction (ex: diagonales des rectangles par le centre)
              if (!line.isConstruction && (line.p1 === id || line.p2 === id)) {
                connectedLines++;
              }
            }
          }
          // Si c'est un coin (2 lignes connectées), le retourner en priorité
          if (connectedLines === 2) {
            return id;
          }
        }
      }

      // PRIORITÉ 2: Vérifier les géométries (lignes, cercles, etc.)
      for (const [id, geo] of sketch.geometries) {
        if (geo.type === "line") {
          const line = geo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (p1 && p2) {
            const d = distanceToLine({ x: worldX, y: worldY }, p1, p2);
            if (d < tolerance) return id;
          }
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          const center = sketch.points.get(circle.center);
          if (center) {
            const d = Math.abs(distance({ x: worldX, y: worldY }, center) - circle.radius);
            if (d < tolerance) return id;
          }
        } else if (geo.type === "bezier") {
          const bezier = geo as Bezier;
          const p1 = sketch.points.get(bezier.p1);
          const p2 = sketch.points.get(bezier.p2);
          const cp1 = sketch.points.get(bezier.cp1);
          const cp2 = sketch.points.get(bezier.cp2);
          if (p1 && p2 && cp1 && cp2) {
            // Vérifier la proximité à la courbe en échantillonnant des points
            const d = distanceToBezier({ x: worldX, y: worldY }, p1, p2, cp1, cp2);
            if (d < tolerance) return id;
          }
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          const center = sketch.points.get(arc.center);
          const startPt = sketch.points.get(arc.startPoint);
          const endPt = sketch.points.get(arc.endPoint);
          if (center && startPt && endPt) {
            // Vérifier si le point est proche du cercle à distance arc.radius
            const distToCenter = distance({ x: worldX, y: worldY }, center);
            if (Math.abs(distToCenter - arc.radius) < tolerance) {
              const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
              const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);

              // Calculer l'angle balayé selon la direction de l'arc
              // ctx.arc: counterClockwise=false = sens horaire = angles croissants
              //          counterClockwise=true = sens anti-horaire = angles décroissants
              let sweepAngle: number;
              if (arc.counterClockwise !== undefined) {
                sweepAngle = endAngle - startAngle;
                if (arc.counterClockwise) {
                  // Sens anti-horaire = angles décroissants, donc sweepAngle doit être négatif
                  if (sweepAngle > 0) sweepAngle -= 2 * Math.PI;
                } else {
                  // Sens horaire = angles croissants, donc sweepAngle doit être positif
                  if (sweepAngle < 0) sweepAngle += 2 * Math.PI;
                }
              } else {
                // Pas de counterClockwise défini: utiliser le petit arc (< 180°)
                sweepAngle = endAngle - startAngle;
                while (sweepAngle > Math.PI) sweepAngle -= 2 * Math.PI;
                while (sweepAngle < -Math.PI) sweepAngle += 2 * Math.PI;
              }

              // Échantillonner l'arc
              const numSamples = 20;
              let onArc = false;
              for (let i = 0; i <= numSamples; i++) {
                const t = i / numSamples;
                const angle = startAngle + sweepAngle * t;
                const sampleX = center.x + arc.radius * Math.cos(angle);
                const sampleY = center.y + arc.radius * Math.sin(angle);
                const dist = Math.sqrt((worldX - sampleX) ** 2 + (worldY - sampleY) ** 2);
                if (dist < tolerance) {
                  onArc = true;
                  break;
                }
              }

              if (onArc) return id;
            }
          }
        } else if (geo.type === "text") {
          // Texte : vérifier si on clique dans la zone du texte
          const text = geo as TextAnnotation;
          const position = sketch.points.get(text.position);
          if (position) {
            // Estimer la taille du texte (approximation)
            const charWidth = text.fontSize * 0.6; // Largeur moyenne d'un caractère
            const textWidth = text.content.length * charWidth;
            const textHeight = text.fontSize * 1.2;

            // Zone de détection basée sur l'alignement
            let minX: number, maxX: number;
            if (text.alignment === "center") {
              minX = position.x - textWidth / 2;
              maxX = position.x + textWidth / 2;
            } else if (text.alignment === "right") {
              minX = position.x - textWidth;
              maxX = position.x;
            } else {
              // left
              minX = position.x;
              maxX = position.x + textWidth;
            }
            const minY = position.y - textHeight;
            const maxY = position.y + textHeight / 2;

            // Vérifier si le clic est dans la bounding box (avec tolérance)
            const expandedTolerance = tolerance / 2;
            if (
              worldX >= minX - expandedTolerance &&
              worldX <= maxX + expandedTolerance &&
              worldY >= minY - expandedTolerance &&
              worldY <= maxY + expandedTolerance
            ) {
              return id;
            }
          }
        }
      }

      // PRIORITÉ 3: Vérifier les points isolés (pas liés à une géométrie)
      for (const [id, point] of sketch.points) {
        if (distance({ x: worldX, y: worldY }, point) < tolerance) {
          // Vérifier si ce point est utilisé par une géométrie
          let isUsedByGeometry = false;
          for (const geo of sketch.geometries.values()) {
            if (geo.type === "line") {
              const line = geo as Line;
              if (line.p1 === id || line.p2 === id) {
                isUsedByGeometry = true;
                break;
              }
            } else if (geo.type === "circle") {
              const circle = geo as CircleType;
              if (circle.center === id) {
                isUsedByGeometry = true;
                break;
              }
            } else if (geo.type === "bezier") {
              const bezier = geo as Bezier;
              if (bezier.p1 === id || bezier.p2 === id || bezier.cp1 === id || bezier.cp2 === id) {
                isUsedByGeometry = true;
                break;
              }
            } else if (geo.type === "arc") {
              const arc = geo as Arc;
              if (arc.center === id || arc.startPoint === id || arc.endPoint === id) {
                isUsedByGeometry = true;
                break;
              }
            } else if (geo.type === "text") {
              const text = geo as TextAnnotation;
              if (text.position === id) {
                isUsedByGeometry = true;
                break;
              }
            }
          }
          // Sélectionner le point s'il n'est pas utilisé par une géométrie
          if (!isUsedByGeometry) {
            return id;
          }
        }
      }

      return null;
    },
    [sketch, viewport.scale],
  );

  // Trouver une forme fermée à une position donnée (pour remplissage)
  const findClosedShapeAtPosition = useCallback(
    (worldX: number, worldY: number): { geoIds: string[]; path: Path2D } | null => {
      // Collecter les formes fermées (cercles et polygones)
      const closedShapes: Array<{
        geoIds: string[];
        path: Path2D;
        area: number;
      }> = [];

      // 1. Cercles
      sketch.geometries.forEach((geo, geoId) => {
        if (geo.type !== "circle") return;
        const circle = geo as CircleType;
        const center = sketch.points.get(circle.center);
        if (!center) return;

        const path = new Path2D();
        path.arc(center.x, center.y, circle.radius, 0, Math.PI * 2);
        path.closePath();

        closedShapes.push({
          geoIds: [geoId],
          path,
          area: Math.PI * circle.radius * circle.radius,
        });
      });

      // 2. Polygones (formes fermées par des lignes/arcs)
      const pointToGeos = new Map<string, Array<{ geoId: string; otherPointId: string }>>();

      sketch.geometries.forEach((geo, geoId) => {
        let p1Id: string | null = null;
        let p2Id: string | null = null;

        if (geo.type === "line") {
          const line = geo as Line;
          p1Id = line.p1;
          p2Id = line.p2;
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          p1Id = arc.startPoint;
          p2Id = arc.endPoint;
        }

        if (p1Id && p2Id) {
          if (!pointToGeos.has(p1Id)) pointToGeos.set(p1Id, []);
          if (!pointToGeos.has(p2Id)) pointToGeos.set(p2Id, []);
          pointToGeos.get(p1Id)!.push({ geoId, otherPointId: p2Id });
          pointToGeos.get(p2Id)!.push({ geoId, otherPointId: p1Id });
        }
      });

      // DFS pour trouver les cycles (polygones fermés)
      const foundCycles = new Set<string>();

      const findCycle = (
        startPoint: string,
        currentPoint: string,
        visited: Set<string>,
        pathGeoIds: string[],
        depth: number,
      ): string[] | null => {
        if (depth > 20) return null; // Limite de profondeur

        const connections = pointToGeos.get(currentPoint);
        if (!connections) return null;

        for (const { geoId, otherPointId } of connections) {
          if (pathGeoIds.includes(geoId)) continue;

          if (otherPointId === startPoint && pathGeoIds.length >= 3) {
            return [...pathGeoIds, geoId];
          }

          if (!visited.has(otherPointId)) {
            const newVisited = new Set(visited);
            newVisited.add(otherPointId);
            const result = findCycle(startPoint, otherPointId, newVisited, [...pathGeoIds, geoId], depth + 1);
            if (result) return result;
          }
        }
        return null;
      };

      // Trouver tous les cycles
      for (const startPoint of pointToGeos.keys()) {
        const cycle = findCycle(startPoint, startPoint, new Set([startPoint]), [], 0);
        if (cycle) {
          const cycleKey = [...cycle].sort().join("-");
          if (!foundCycles.has(cycleKey)) {
            foundCycles.add(cycleKey);

            // Construire le path pour ce polygone
            const path = new Path2D();
            const orderedPoints: { x: number; y: number }[] = [];

            let currentPointId = startPoint;
            for (const geoId of cycle) {
              const geo = sketch.geometries.get(geoId);
              const pt = sketch.points.get(currentPointId);
              if (pt) orderedPoints.push({ x: pt.x, y: pt.y });

              if (geo?.type === "line") {
                const line = geo as Line;
                currentPointId = line.p1 === currentPointId ? line.p2 : line.p1;
              } else if (geo?.type === "arc") {
                const arc = geo as Arc;
                currentPointId = arc.startPoint === currentPointId ? arc.endPoint : arc.startPoint;
              }
            }

            if (orderedPoints.length >= 3) {
              path.moveTo(orderedPoints[0].x, orderedPoints[0].y);
              for (let i = 1; i < orderedPoints.length; i++) {
                path.lineTo(orderedPoints[i].x, orderedPoints[i].y);
              }
              path.closePath();

              // Calculer l'aire
              let area = 0;
              for (let i = 0; i < orderedPoints.length; i++) {
                const j = (i + 1) % orderedPoints.length;
                area += orderedPoints[i].x * orderedPoints[j].y;
                area -= orderedPoints[j].x * orderedPoints[i].y;
              }
              area = Math.abs(area) / 2;

              closedShapes.push({ geoIds: cycle, path, area });
            }
          }
        }
      }

      // Trier par aire croissante (petites formes d'abord pour priorité)
      closedShapes.sort((a, b) => a.area - b.area);

      // Créer un canvas temporaire pour tester isPointInPath
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return null;

      // Trouver la forme la plus petite qui contient le point
      for (const shape of closedShapes) {
        if (tempCtx.isPointInPath(shape.path, worldX, worldY)) {
          return { geoIds: shape.geoIds, path: shape.path };
        }
      }

      return null;
    },
    [sketch],
  );

  // Vérifier si une entité (géométrie ou point) est sur un calque verrouillé
  const isEntityOnLockedLayer = useCallback(
    (entityId: string): boolean => {
      // D'abord vérifier si c'est une géométrie
      const geo = sketch.geometries.get(entityId);
      if (geo) {
        const layerId = geo.layerId || "trace";
        const layer = sketch.layers.get(layerId);
        return layer?.locked ?? false;
      }

      // Sinon c'est peut-être un point - vérifier les géométries qui l'utilisent
      for (const g of sketch.geometries.values()) {
        let usesPoint = false;
        if (g.type === "line") {
          const line = g as Line;
          usesPoint = line.p1 === entityId || line.p2 === entityId;
        } else if (g.type === "circle") {
          const circle = g as CircleType;
          usesPoint = circle.center === entityId;
        } else if (g.type === "arc") {
          const arc = g as Arc;
          usesPoint = arc.center === entityId || arc.startPoint === entityId || arc.endPoint === entityId;
        } else if (g.type === "bezier") {
          const bezier = g as Bezier;
          usesPoint =
            bezier.p1 === entityId || bezier.p2 === entityId || bezier.cp1 === entityId || bezier.cp2 === entityId;
        }

        if (usesPoint) {
          const layerId = g.layerId || "trace";
          const layer = sketch.layers.get(layerId);
          if (layer?.locked) return true;
        }
      }

      return false;
    },
    [sketch],
  );

  // Trouver un point (coin) sous le curseur
  const findPointAtPosition = useCallback(
    (worldX: number, worldY: number): string | null => {
      const pointTolerance = 8 / viewport.scale;

      for (const [id, point] of sketch.points) {
        if (distance({ x: worldX, y: worldY }, point) < pointTolerance) {
          return id;
        }
      }
      return null;
    },
    [sketch.points, viewport.scale],
  );

  // Trouver une poignée sous le curseur pour les entités sélectionnées
  const findHandleAtPosition = useCallback(
    (worldX: number, worldY: number): { type: "point" | "handle"; id: string; handleType?: string } | null => {
      const tolerance = 10 / viewport.scale;

      for (const entityId of selectedEntities) {
        // Vérifier les points de la géométrie sélectionnée
        const geo = sketch.geometries.get(entityId);
        if (geo) {
          if (geo.type === "line") {
            const line = geo as Line;
            const p1 = sketch.points.get(line.p1);
            const p2 = sketch.points.get(line.p2);
            if (p1 && p2) {
              // Poignées aux extrémités
              if (distance({ x: worldX, y: worldY }, p1) < tolerance) {
                return { type: "point", id: line.p1 };
              }
              if (distance({ x: worldX, y: worldY }, p2) < tolerance) {
                return { type: "point", id: line.p2 };
              }
              // Poignée au milieu pour déplacer la ligne
              const mid = midpoint(p1, p2);
              if (distance({ x: worldX, y: worldY }, mid) < tolerance) {
                return { type: "handle", id: entityId, handleType: "lineMove" };
              }
            }
          } else if (geo.type === "circle") {
            const circle = geo as CircleType;
            const center = sketch.points.get(circle.center);
            if (center) {
              // Poignée de redimensionnement sur le bord droit
              const resizeHandle = { x: center.x + circle.radius, y: center.y };
              if (distance({ x: worldX, y: worldY }, resizeHandle) < tolerance) {
                return { type: "handle", id: entityId, handleType: "circleResize" };
              }
              // Centre pour déplacer
              if (distance({ x: worldX, y: worldY }, center) < tolerance) {
                return { type: "point", id: circle.center };
              }
            }
          } else if (geo.type === "bezier") {
            const bezier = geo as Bezier;
            const p1 = sketch.points.get(bezier.p1);
            const p2 = sketch.points.get(bezier.p2);
            const cp1 = sketch.points.get(bezier.cp1);
            const cp2 = sketch.points.get(bezier.cp2);
            if (p1 && distance({ x: worldX, y: worldY }, p1) < tolerance) {
              return { type: "point", id: bezier.p1 };
            }
            if (p2 && distance({ x: worldX, y: worldY }, p2) < tolerance) {
              return { type: "point", id: bezier.p2 };
            }
            if (cp1 && distance({ x: worldX, y: worldY }, cp1) < tolerance) {
              return { type: "point", id: bezier.cp1, handleType: "control" };
            }
            if (cp2 && distance({ x: worldX, y: worldY }, cp2) < tolerance) {
              return { type: "point", id: bezier.cp2, handleType: "control" };
            }
          } else if (geo.type === "text") {
            // Texte : poignée sur toute la zone du texte pour déplacer
            const text = geo as TextAnnotation;
            const position = sketch.points.get(text.position);
            if (position) {
              // Estimer la taille du texte (approximation)
              const charWidth = text.fontSize * 0.6;
              const textWidth = text.content.length * charWidth;
              const textHeight = text.fontSize * 1.2;

              // Zone de détection basée sur l'alignement
              let minX: number, maxX: number;
              if (text.alignment === "center") {
                minX = position.x - textWidth / 2;
                maxX = position.x + textWidth / 2;
              } else if (text.alignment === "right") {
                minX = position.x - textWidth;
                maxX = position.x;
              } else {
                // left
                minX = position.x;
                maxX = position.x + textWidth;
              }
              const minY = position.y - textHeight;
              const maxY = position.y + textHeight / 2;

              // Vérifier si le clic est dans la bounding box
              if (
                worldX >= minX - tolerance &&
                worldX <= maxX + tolerance &&
                worldY >= minY - tolerance &&
                worldY <= maxY + tolerance
              ) {
                return { type: "point", id: text.position };
              }
            }
          }
        }
      }

      return null;
    },
    [sketch, viewport.scale, selectedEntities],
  );

  // Charger une ou plusieurs images de fond (multi-photos)
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      let loadedCount = 0;

      // Calculer le centre visible du canvas en coordonnées monde (capturé une seule fois)
      const centerX = (viewport.width / 2 - viewport.offsetX) / viewport.scale;
      const centerY = (viewport.height / 2 - viewport.offsetY) / viewport.scale;

      // Calculer la position de départ pour les nouvelles images
      const getNextPosition = (totalIndex: number) => {
        // Décalage en spirale pour éviter superposition
        const offset = 150; // 150 unités entre chaque image
        const angle = (totalIndex * 60 * Math.PI) / 180; // 60° entre chaque
        const radius = offset * (Math.floor(totalIndex / 6) + 1); // Spirale

        return {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        };
      };

      fileArray.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new window.Image();
          img.onload = () => {
            // Utiliser la forme fonctionnelle pour obtenir la longueur actuelle
            setBackgroundImages((prev) => {
              const currentLength = prev.length;
              const position = getNextPosition(currentLength + index);

              const newImage: BackgroundImage = {
                id: generateId(),
                name: file.name,
                image: img,
                // FIX #86b: Stocker le src pour permettre la restauration depuis AutoBackup
                src: img.src,
                x: position.x,
                y: position.y,
                scale: 1,
                opacity: imageOpacity,
                visible: true,
                locked: false,
                order: currentLength + index,
                markers: [],
                layerId: sketchRef.current.activeLayerId, // Assigner au calque actif
              };

              return [...prev, newImage];
            });

            loadedCount++;

            if (loadedCount === fileArray.length) {
              setShowBackgroundImage(true);
              toast.success(fileArray.length === 1 ? "Photo chargée !" : `${fileArray.length} photos chargées !`);
              // FIX #89: Forcer une sauvegarde après ajout d'images (délai pour laisser le state se mettre à jour)
              setTimeout(() => {
                console.log("[CAD] Images loaded, triggering backup...");
                autoBackupSave(true); // Force backup
              }, 2000);
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      });

      // Reset l'input pour permettre de re-sélectionner les mêmes fichiers
      e.target.value = "";
    },
    [imageOpacity, viewport, autoBackupSave],
  );

  // FIX #90: Envoyer une image vers un nouveau calque
  const moveImageToNewLayer = useCallback(
    (imageId: string) => {
      const image = backgroundImages.find((img) => img.id === imageId);
      if (!image) return;

      const layerColors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#EF4444"];
      const newLayerId = generateId();

      // Créer le nouveau calque avec nom simple "Calque N"
      setSketch((prev) => {
        const newLayers = new Map(prev.layers);
        const layerNumber = prev.layers.size + 1;
        const newLayer: Layer = {
          id: newLayerId,
          name: `Calque ${layerNumber}`,
          color: layerColors[prev.layers.size % layerColors.length],
          visible: true,
          locked: false,
          order: prev.layers.size,
        };
        newLayers.set(newLayerId, newLayer);
        return { ...prev, layers: newLayers };
      });

      // Déplacer l'image vers ce calque
      setBackgroundImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, layerId: newLayerId } : img)));

      toast.success(`Image déplacée vers nouveau calque`);
    },
    [backgroundImages],
  );

  // Import DXF
  const handleDXFImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        toast.loading("Import DXF en cours...", { id: "dxf-import" });

        const result = await loadDXFFile(file);

        if (result.entityCount === 0) {
          toast.error("Aucune entité trouvée dans le fichier DXF", { id: "dxf-import" });
          return;
        }

        // Fusionner les entités importées avec le sketch actuel
        setSketch((prev) => {
          const newPoints = new Map(prev.points);
          const newGeometries = new Map(prev.geometries);

          // Ajouter les points
          result.points.forEach((point, id) => {
            newPoints.set(id, point);
          });

          // Ajouter les géométries (avec le calque actif)
          result.geometries.forEach((geo, id) => {
            // Assigner au calque actif si le calque DXF n'existe pas
            const geoWithLayer = { ...geo, layerId: prev.activeLayerId };
            newGeometries.set(id, geoWithLayer);
          });

          return {
            ...prev,
            points: newPoints,
            geometries: newGeometries,
          };
        });

        // Auto-fit : centrer et zoomer pour que le contenu soit visible
        const bounds = result.bounds;
        const contentWidth = bounds.maxX - bounds.minX;
        const contentHeight = bounds.maxY - bounds.minY;
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;

        console.log("DXF Import bounds:", { contentWidth, contentHeight, centerX, centerY });

        setViewport((prev) => {
          // Calculer le scale optimal pour voir tout le contenu avec une marge de 20%
          const margin = 0.8; // 80% de l'écran utilisé
          const scaleX = (prev.width * margin) / contentWidth;
          const scaleY = (prev.height * margin) / contentHeight;
          const optimalScale = Math.min(scaleX, scaleY);

          // Scale minimum de 3 pour que les petits dessins soient visibles
          // (approxime 1mm = 3 pixels, proche de la taille réelle sur écran)
          const minScale = 3;
          const newScale = Math.max(minScale, Math.min(5000, optimalScale));

          console.log("DXF Import scale:", { scaleX, scaleY, optimalScale, newScale });

          return {
            ...prev,
            scale: newScale,
            offsetX: prev.width / 2 - centerX * newScale,
            offsetY: prev.height / 2 - centerY * newScale,
          };
        });

        toast.success(`Import réussi : ${result.entityCount} entités, ${result.points.size} points`, {
          id: "dxf-import",
        });

        // Reset l'input pour permettre de réimporter le même fichier
        if (dxfInputRef.current) {
          dxfInputRef.current.value = "";
        }
      } catch (error) {
        console.error("Erreur import DXF:", error);
        toast.error(`Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`, { id: "dxf-import" });
      }
    },
    [render],
  );

  // Helper: récupère un point existant si snap endpoint, sinon crée un nouveau point
  const getOrCreatePoint = useCallback((targetPos: { x: number; y: number }, snapPoint: SnapPoint | null): Point => {
    // Si on snappe sur un endpoint ou center existant, réutiliser ce point
    // Utiliser sketchRef.current pour éviter les closures stales
    if (snapPoint && (snapPoint.type === "endpoint" || snapPoint.type === "center") && snapPoint.entityId) {
      const existingPoint = sketchRef.current.points.get(snapPoint.entityId);
      if (existingPoint) {
        return existingPoint;
      }
    }
    // Sinon créer un nouveau point
    return { id: generateId(), x: targetPos.x, y: targetPos.y };
  }, []);

  // Helper: coupe une ligne en deux à une position donnée et retourne le point de coupure
  const splitLineAtPoint = useCallback(
    (
      lineId: string,
      position: { x: number; y: number },
      sketchToModify: { points: Map<string, Point>; geometries: Map<string, Geometry> },
    ): Point | null => {
      const line = sketchToModify.geometries.get(lineId) as Line | undefined;
      if (!line || line.type !== "line") return null;

      const p1 = sketchToModify.points.get(line.p1);
      const p2 = sketchToModify.points.get(line.p2);
      if (!p1 || !p2) return null;

      // Créer le nouveau point au milieu
      const newPoint: Point = { id: generateId(), x: position.x, y: position.y };
      sketchToModify.points.set(newPoint.id, newPoint);

      // Créer la deuxième ligne (du nouveau point vers p2)
      // IMPORTANT: Copier toutes les propriétés de la ligne originale
      const newLine: Line = {
        id: generateId(),
        type: "line",
        p1: newPoint.id,
        p2: line.p2,
        layerId: line.layerId,
        strokeWidth: line.strokeWidth,
        strokeColor: line.strokeColor,
        isConstruction: line.isConstruction,
      };
      sketchToModify.geometries.set(newLine.id, newLine);

      // Modifier la ligne originale (p1 vers le nouveau point)
      const updatedLine: Line = {
        ...line,
        p2: newPoint.id,
      };
      sketchToModify.geometries.set(lineId, updatedLine);

      return newPoint;
    },
    [],
  );

  // === FILLET ET CHAMFER ===

  // Trouve le point commun entre deux lignes (même ID ou mêmes coordonnées)
  const findSharedPoint = useCallback(
    (
      line1: Line,
      line2: Line,
    ): {
      sharedPointId: string;
      line1OtherId: string;
      line2OtherId: string;
      needsMerge?: { point1Id: string; point2Id: string };
    } | null => {
      // D'abord vérifier si les lignes partagent le même point (ID identique)
      if (line1.p1 === line2.p1) return { sharedPointId: line1.p1, line1OtherId: line1.p2, line2OtherId: line2.p2 };
      if (line1.p1 === line2.p2) return { sharedPointId: line1.p1, line1OtherId: line1.p2, line2OtherId: line2.p1 };
      if (line1.p2 === line2.p1) return { sharedPointId: line1.p2, line1OtherId: line1.p1, line2OtherId: line2.p2 };
      if (line1.p2 === line2.p2) return { sharedPointId: line1.p2, line1OtherId: line1.p1, line2OtherId: line2.p1 };

      // Sinon, vérifier si des extrémités sont aux mêmes coordonnées
      const tolerance = 0.5; // 0.5mm de tolérance
      const p1_1 = sketch.points.get(line1.p1);
      const p1_2 = sketch.points.get(line1.p2);
      const p2_1 = sketch.points.get(line2.p1);
      const p2_2 = sketch.points.get(line2.p2);

      if (!p1_1 || !p1_2 || !p2_1 || !p2_2) return null;

      const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

      // Vérifier toutes les combinaisons de points
      if (dist(p1_1, p2_1) < tolerance) {
        return {
          sharedPointId: line1.p1,
          line1OtherId: line1.p2,
          line2OtherId: line2.p2,
          needsMerge: { point1Id: line1.p1, point2Id: line2.p1 },
        };
      }
      if (dist(p1_1, p2_2) < tolerance) {
        return {
          sharedPointId: line1.p1,
          line1OtherId: line1.p2,
          line2OtherId: line2.p1,
          needsMerge: { point1Id: line1.p1, point2Id: line2.p2 },
        };
      }
      if (dist(p1_2, p2_1) < tolerance) {
        return {
          sharedPointId: line1.p2,
          line1OtherId: line1.p1,
          line2OtherId: line2.p2,
          needsMerge: { point1Id: line1.p2, point2Id: line2.p1 },
        };
      }
      if (dist(p1_2, p2_2) < tolerance) {
        return {
          sharedPointId: line1.p2,
          line1OtherId: line1.p1,
          line2OtherId: line2.p1,
          needsMerge: { point1Id: line1.p2, point2Id: line2.p2 },
        };
      }

      return null;
    },
    [sketch.points],
  );

  // Fonction interne pour appliquer un congé sur un sketch donné (retourne le nouveau sketch ou null si erreur)
  const applyFilletToSketch = useCallback(
    (inputSketch: Sketch, line1Id: string, line2Id: string, radius: number, silent: boolean = false): Sketch | null => {
      let currentLine1 = inputSketch.geometries.get(line1Id) as Line | undefined;
      let currentLine2 = inputSketch.geometries.get(line2Id) as Line | undefined;

      if (!currentLine1 || !currentLine2 || currentLine1.type !== "line" || currentLine2.type !== "line") {
        if (!silent) toast.error("Sélectionnez deux lignes");
        return null;
      }

      const shared = findSharedPoint(currentLine1, currentLine2);
      if (!shared) {
        if (!silent) toast.error("Les lignes doivent partager un point commun");
        return null;
      }

      const newSketch = {
        ...inputSketch,
        points: new Map(inputSketch.points),
        geometries: new Map(inputSketch.geometries),
      };

      // Si les points sont proches mais pas le même, fusionner
      if (shared.needsMerge) {
        const { point1Id, point2Id } = shared.needsMerge;
        const line2Geo = newSketch.geometries.get(line2Id) as Line;
        if (line2Geo) {
          if (line2Geo.p1 === point2Id) {
            newSketch.geometries.set(line2Id, { ...line2Geo, p1: point1Id });
          } else if (line2Geo.p2 === point2Id) {
            newSketch.geometries.set(line2Id, { ...line2Geo, p2: point1Id });
          }
        }
        newSketch.points.delete(point2Id);
        currentLine1 = newSketch.geometries.get(line1Id) as Line;
        currentLine2 = newSketch.geometries.get(line2Id) as Line;
      }

      const cornerPt = newSketch.points.get(shared.sharedPointId);
      const endPt1 = newSketch.points.get(shared.line1OtherId);
      const endPt2 = newSketch.points.get(shared.line2OtherId);

      if (!cornerPt || !endPt1 || !endPt2) return null;

      const vec1 = { x: endPt1.x - cornerPt.x, y: endPt1.y - cornerPt.y };
      const vec2 = { x: endPt2.x - cornerPt.x, y: endPt2.y - cornerPt.y };

      const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

      if (len1 < 0.001 || len2 < 0.001) {
        if (!silent) toast.error(`Lignes trop courtes`);
        return null;
      }

      const u1 = { x: vec1.x / len1, y: vec1.y / len1 };
      const u2 = { x: vec2.x / len2, y: vec2.y / len2 };

      const dot = u1.x * u2.x + u1.y * u2.y;
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));

      if (angleRad < 0.05 || angleRad > Math.PI - 0.05) {
        if (!silent) toast.error(`Angle trop faible pour un congé`);
        return null;
      }

      const halfAngle = angleRad / 2;
      const tangentDist = radius / Math.tan(halfAngle);

      if (tangentDist > len1 * 0.95 || tangentDist > len2 * 0.95) {
        if (!silent) toast.error(`Rayon trop grand`);
        return null;
      }

      const tan1 = { x: cornerPt.x + u1.x * tangentDist, y: cornerPt.y + u1.y * tangentDist };
      const tan2 = { x: cornerPt.x + u2.x * tangentDist, y: cornerPt.y + u2.y * tangentDist };

      // Calculer le centre du congé sur la bissectrice
      // La bissectrice de l'angle est u1 + u2 normalisé
      const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
      const bisectorLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);

      if (bisectorLen < 0.001) {
        if (!silent) toast.error("Lignes parallèles");
        return null;
      }

      const bisectorNorm = { x: bisector.x / bisectorLen, y: bisector.y / bisectorLen };

      // Distance du coin au centre = radius / sin(halfAngle)
      const centerDist = radius / Math.sin(halfAngle);

      // Deux centres possibles sur la bissectrice (de part et d'autre du coin)
      const centerA = {
        x: cornerPt.x + bisectorNorm.x * centerDist,
        y: cornerPt.y + bisectorNorm.y * centerDist,
      };
      const centerB = {
        x: cornerPt.x - bisectorNorm.x * centerDist,
        y: cornerPt.y - bisectorNorm.y * centerDist,
      };

      // Le bon centre est celui qui est à distance R des deux points de tangence
      const distAToTan1 = Math.sqrt((centerA.x - tan1.x) ** 2 + (centerA.y - tan1.y) ** 2);
      const distAToTan2 = Math.sqrt((centerA.x - tan2.x) ** 2 + (centerA.y - tan2.y) ** 2);
      const distBToTan1 = Math.sqrt((centerB.x - tan1.x) ** 2 + (centerB.y - tan1.y) ** 2);
      const distBToTan2 = Math.sqrt((centerB.x - tan2.x) ** 2 + (centerB.y - tan2.y) ** 2);

      const errorA = Math.abs(distAToTan1 - radius) + Math.abs(distAToTan2 - radius);
      const errorB = Math.abs(distBToTan1 - radius) + Math.abs(distBToTan2 - radius);

      const arcCenter = errorA < errorB ? centerA : centerB;

      const tan1Id = generateId();
      const tan2Id = generateId();
      const centerId = generateId();

      newSketch.points.set(tan1Id, { id: tan1Id, x: tan1.x, y: tan1.y });
      newSketch.points.set(tan2Id, { id: tan2Id, x: tan2.x, y: tan2.y });
      newSketch.points.set(centerId, { id: centerId, x: arcCenter.x, y: arcCenter.y });

      const updatedLine1: Line = {
        ...currentLine1,
        p1: currentLine1.p1 === shared.sharedPointId ? tan1Id : currentLine1.p1,
        p2: currentLine1.p2 === shared.sharedPointId ? tan1Id : currentLine1.p2,
      };

      const updatedLine2: Line = {
        ...currentLine2,
        p1: currentLine2.p1 === shared.sharedPointId ? tan2Id : currentLine2.p1,
        p2: currentLine2.p2 === shared.sharedPointId ? tan2Id : currentLine2.p2,
      };

      newSketch.geometries.set(line1Id, updatedLine1);
      newSketch.geometries.set(line2Id, updatedLine2);

      // Déterminer le sens de l'arc (counterClockwise)
      const cross = u1.x * u2.y - u1.y * u2.x;
      const counterClockwise = cross > 0;

      const arcId = generateId();
      const arc: Arc = {
        id: arcId,
        type: "arc",
        center: centerId,
        startPoint: tan1Id,
        endPoint: tan2Id,
        radius: radius,
        layerId: currentLine1.layerId || "trace",
        counterClockwise: counterClockwise,
        isFillet: true, // Marquer comme congé pour permettre la restauration du coin
      };
      newSketch.geometries.set(arcId, arc);

      let cornerStillUsed = false;
      newSketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const l = geo as Line;
          if (l.p1 === shared.sharedPointId || l.p2 === shared.sharedPointId) {
            cornerStillUsed = true;
          }
        }
      });
      if (!cornerStillUsed) {
        newSketch.points.delete(shared.sharedPointId);
      }

      return newSketch;
    },
    [findSharedPoint],
  );

  // Applique un congé (fillet) entre deux lignes
  const applyFillet = useCallback(
    (line1Id: string, line2Id: string, radius: number) => {
      const newSketch = applyFilletToSketch(sketch, line1Id, line2Id, radius, false);
      if (newSketch) {
        setSketch(newSketch);
        addToHistory(newSketch, `Congé R${radius}mm`);
        toast.success(`Congé R${radius}mm appliqué`);
      }
    },
    [sketch, applyFilletToSketch, addToHistory],
  );

  // Fonction interne pour appliquer un chanfrein sur un sketch donné
  const applyChamferToSketch = useCallback(
    (inputSketch: Sketch, line1Id: string, line2Id: string, dist: number, silent: boolean = false): Sketch | null => {
      let currentLine1 = inputSketch.geometries.get(line1Id) as Line | undefined;
      let currentLine2 = inputSketch.geometries.get(line2Id) as Line | undefined;

      if (!currentLine1 || !currentLine2 || currentLine1.type !== "line" || currentLine2.type !== "line") {
        if (!silent) toast.error("Sélectionnez deux lignes");
        return null;
      }

      const shared = findSharedPoint(currentLine1, currentLine2);
      if (!shared) {
        if (!silent) toast.error("Les lignes doivent partager un point commun");
        return null;
      }

      const newSketch = {
        ...inputSketch,
        points: new Map(inputSketch.points),
        geometries: new Map(inputSketch.geometries),
      };

      if (shared.needsMerge) {
        const { point1Id, point2Id } = shared.needsMerge;
        const line2Geo = newSketch.geometries.get(line2Id) as Line;
        if (line2Geo) {
          if (line2Geo.p1 === point2Id) {
            newSketch.geometries.set(line2Id, { ...line2Geo, p1: point1Id });
          } else if (line2Geo.p2 === point2Id) {
            newSketch.geometries.set(line2Id, { ...line2Geo, p2: point1Id });
          }
        }
        newSketch.points.delete(point2Id);
        currentLine1 = newSketch.geometries.get(line1Id) as Line;
        currentLine2 = newSketch.geometries.get(line2Id) as Line;
      }

      const sharedPt = newSketch.points.get(shared.sharedPointId);
      const other1 = newSketch.points.get(shared.line1OtherId);
      const other2 = newSketch.points.get(shared.line2OtherId);

      if (!sharedPt || !other1 || !other2) return null;

      const len1 = distance(sharedPt, other1);
      const len2 = distance(sharedPt, other2);

      if (len1 < dist || len2 < dist) {
        if (!silent) toast.error("Distance trop grande pour ces lignes");
        return null;
      }

      const dir1 = { x: (other1.x - sharedPt.x) / len1, y: (other1.y - sharedPt.y) / len1 };
      const dir2 = { x: (other2.x - sharedPt.x) / len2, y: (other2.y - sharedPt.y) / len2 };

      const cham1 = { x: sharedPt.x + dir1.x * dist, y: sharedPt.y + dir1.y * dist };
      const cham2 = { x: sharedPt.x + dir2.x * dist, y: sharedPt.y + dir2.y * dist };

      const cham1Id = generateId();
      const cham2Id = generateId();

      newSketch.points.set(cham1Id, { id: cham1Id, x: cham1.x, y: cham1.y });
      newSketch.points.set(cham2Id, { id: cham2Id, x: cham2.x, y: cham2.y });

      const newLine1: Line = { ...currentLine1 };
      const newLine2: Line = { ...currentLine2 };

      if (currentLine1.p1 === shared.sharedPointId) {
        newLine1.p1 = cham1Id;
      } else {
        newLine1.p2 = cham1Id;
      }

      if (currentLine2.p1 === shared.sharedPointId) {
        newLine2.p1 = cham2Id;
      } else {
        newLine2.p2 = cham2Id;
      }

      newSketch.geometries.set(line1Id, newLine1);
      newSketch.geometries.set(line2Id, newLine2);

      const chamferLineId = generateId();
      const chamferLine: Line = {
        id: chamferLineId,
        type: "line",
        p1: cham1Id,
        p2: cham2Id,
        layerId: currentLine1.layerId || "trace",
      };
      newSketch.geometries.set(chamferLineId, chamferLine);

      let pointStillUsed = false;
      newSketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const l = geo as Line;
          if (l.p1 === shared.sharedPointId || l.p2 === shared.sharedPointId) pointStillUsed = true;
        }
      });
      if (!pointStillUsed) {
        newSketch.points.delete(shared.sharedPointId);
      }

      return newSketch;
    },
    [findSharedPoint],
  );

  // Applique un chanfrein entre deux lignes
  const applyChamfer = useCallback(
    (line1Id: string, line2Id: string, dist: number) => {
      const newSketch = applyChamferToSketch(sketch, line1Id, line2Id, dist, false);
      if (newSketch) {
        setSketch(newSketch);
        addToHistory(newSketch, `Chanfrein ${dist}mm`);
        toast.success(`Chanfrein ${dist}mm appliqué`);
      }
    },
    [sketch, applyChamferToSketch, addToHistory],
  );

  // Trouver les lignes connectées à un point
  const findLinesConnectedToPoint = useCallback(
    (pointId: string, excludeConstruction: boolean = true): Line[] => {
      const lines: Line[] = [];
      sketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const line = geo as Line;
          // Exclure les lignes de construction si demandé (pour les congés/chanfreins)
          if (excludeConstruction && line.isConstruction) {
            return;
          }
          if (line.p1 === pointId || line.p2 === pointId) {
            lines.push(line);
          }
        }
      });
      return lines;
    },
    [sketch.geometries],
  );

  // Trouver toutes les géométries connectées à une géométrie (pour sélection de figure)
  const findConnectedGeometries = useCallback(
    (startGeoId: string): Set<string> => {
      const visited = new Set<string>();
      const queue: string[] = [startGeoId];

      // Fonction helper pour obtenir les points d'une géométrie
      const getPointsOfGeometry = (geoId: string): string[] => {
        const geo = sketch.geometries.get(geoId);
        if (!geo) return [];

        if (geo.type === "line") {
          const line = geo as Line;
          return [line.p1, line.p2];
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          return [arc.startPoint, arc.endPoint]; // Ne pas inclure le centre
        } else if (geo.type === "circle") {
          return []; // Les cercles ne sont pas connectés
        } else if (geo.type === "bezier") {
          const bezier = geo as Bezier;
          return [bezier.p1, bezier.p2]; // Points d'ancrage uniquement
        }
        return [];
      };

      // Fonction helper pour trouver les géométries connectées à un point
      const getGeometriesAtPoint = (pointId: string): string[] => {
        const result: string[] = [];
        sketch.geometries.forEach((geo, id) => {
          if (geo.type === "line") {
            const line = geo as Line;
            if (line.p1 === pointId || line.p2 === pointId) {
              result.push(id);
            }
          } else if (geo.type === "arc") {
            const arc = geo as Arc;
            if (arc.startPoint === pointId || arc.endPoint === pointId) {
              result.push(id);
            }
          } else if (geo.type === "bezier") {
            const bezier = geo as Bezier;
            if (bezier.p1 === pointId || bezier.p2 === pointId) {
              result.push(id);
            }
          }
        });
        return result;
      };

      // BFS pour trouver toutes les géométries connectées
      while (queue.length > 0) {
        const currentGeoId = queue.shift()!;
        if (visited.has(currentGeoId)) continue;
        visited.add(currentGeoId);

        // Obtenir les points de cette géométrie
        const points = getPointsOfGeometry(currentGeoId);

        // Pour chaque point, trouver les géométries connectées
        for (const pointId of points) {
          const connectedGeos = getGeometriesAtPoint(pointId);
          for (const geoId of connectedGeos) {
            if (!visited.has(geoId)) {
              queue.push(geoId);
            }
          }
        }
      }

      return visited;
    },
    [sketch.geometries],
  );

  // Calculer les paramètres géométriques d'un coin (angle, longueurs, rayon max)
  const calculateCornerParams = useCallback(
    (
      line1Id: string,
      line2Id: string,
    ): {
      angleDeg: number;
      maxRadius: number;
      maxDistance: number;
      len1: number;
      len2: number;
    } | null => {
      const line1 = sketch.geometries.get(line1Id) as Line | undefined;
      const line2 = sketch.geometries.get(line2Id) as Line | undefined;

      if (!line1 || !line2) return null;

      const shared = findSharedPoint(line1, line2);
      if (!shared) return null;

      const cornerPt = sketch.points.get(shared.sharedPointId);
      const endPt1 = sketch.points.get(shared.line1OtherId);
      const endPt2 = sketch.points.get(shared.line2OtherId);

      if (!cornerPt || !endPt1 || !endPt2) return null;

      const vec1 = { x: endPt1.x - cornerPt.x, y: endPt1.y - cornerPt.y };
      const vec2 = { x: endPt2.x - cornerPt.x, y: endPt2.y - cornerPt.y };

      const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

      if (len1 < 0.001 || len2 < 0.001) return null;

      const u1 = { x: vec1.x / len1, y: vec1.y / len1 };
      const u2 = { x: vec2.x / len2, y: vec2.y / len2 };

      const dot = u1.x * u2.x + u1.y * u2.y;
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
      const angleDeg = (angleRad * 180) / Math.PI;

      const halfAngle = angleRad / 2;
      const minLen = Math.min(len1, len2);

      // Rayon max: tangentDist <= minLen * 0.9, donc R <= minLen * 0.9 * tan(halfAngle)
      const maxRadius = minLen * 0.9 * Math.tan(halfAngle);

      // Distance max chanfrein: simplement la longueur min * 0.9
      const maxDistance = minLen * 0.9;

      return { angleDeg, maxRadius, maxDistance, len1, len2 };
    },
    [sketch.geometries, sketch.points, findSharedPoint],
  );

  // Calculer la géométrie d'un congé sans l'appliquer (pour preview)
  const calculateFilletGeometry = useCallback(
    (
      pointId: string,
      radiusMm: number,
    ): {
      center: { x: number; y: number };
      radius: number;
      startAngle: number;
      endAngle: number;
      counterClockwise: boolean;
      tan1: { x: number; y: number };
      tan2: { x: number; y: number };
    } | null => {
      // Trouver les lignes connectées à ce point
      const connectedLines = findLinesConnectedToPoint(pointId);
      if (connectedLines.length !== 2) return null;

      const line1 = connectedLines[0];
      const line2 = connectedLines[1];

      const cornerPt = sketch.points.get(pointId);
      const endPt1 = sketch.points.get(line1.p1 === pointId ? line1.p2 : line1.p1);
      const endPt2 = sketch.points.get(line2.p1 === pointId ? line2.p2 : line2.p1);

      if (!cornerPt || !endPt1 || !endPt2) return null;

      const vec1 = { x: endPt1.x - cornerPt.x, y: endPt1.y - cornerPt.y };
      const vec2 = { x: endPt2.x - cornerPt.x, y: endPt2.y - cornerPt.y };

      const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

      if (len1 < 0.001 || len2 < 0.001) return null;

      const u1 = { x: vec1.x / len1, y: vec1.y / len1 };
      const u2 = { x: vec2.x / len2, y: vec2.y / len2 };

      const dot = u1.x * u2.x + u1.y * u2.y;
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));

      if (angleRad < 0.05 || angleRad > Math.PI - 0.05) return null;

      // Convertir rayon mm en px
      const radiusPx = radiusMm * sketch.scaleFactor;
      const halfAngle = angleRad / 2;
      const tangentDist = radiusPx / Math.tan(halfAngle);

      if (tangentDist > len1 * 0.95 || tangentDist > len2 * 0.95) return null;

      const tan1 = { x: cornerPt.x + u1.x * tangentDist, y: cornerPt.y + u1.y * tangentDist };
      const tan2 = { x: cornerPt.x + u2.x * tangentDist, y: cornerPt.y + u2.y * tangentDist };

      // Calculer le centre du congé sur la bissectrice
      const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
      const bisectorLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);

      if (bisectorLen < 0.001) return null;

      const bisectorUnit = { x: bisector.x / bisectorLen, y: bisector.y / bisectorLen };
      const centerDist = radiusPx / Math.sin(halfAngle);
      const center = {
        x: cornerPt.x + bisectorUnit.x * centerDist,
        y: cornerPt.y + bisectorUnit.y * centerDist,
      };

      // Calculer les angles de début et fin
      const startAngle = Math.atan2(tan1.y - center.y, tan1.x - center.x);
      const endAngle = Math.atan2(tan2.y - center.y, tan2.x - center.x);

      // Déterminer si counterClockwise
      const cross = u1.x * u2.y - u1.y * u2.x;
      const counterClockwise = cross > 0;

      return {
        center,
        radius: radiusPx,
        startAngle,
        endAngle,
        counterClockwise,
        tan1,
        tan2,
      };
    },
    [sketch.points, sketch.scaleFactor, findLinesConnectedToPoint],
  );

  // Calculer la géométrie d'un chanfrein sans l'appliquer (pour preview)
  // Supporte le mode asymétrique avec dist1Mm et dist2Mm différents
  const calculateChamferGeometry = useCallback(
    (
      pointId: string,
      distanceMm: number,
      dist1Mm?: number,
      dist2Mm?: number,
    ): {
      p1: { x: number; y: number };
      p2: { x: number; y: number };
    } | null => {
      const connectedLines = findLinesConnectedToPoint(pointId);
      if (connectedLines.length !== 2) return null;

      const line1 = connectedLines[0];
      const line2 = connectedLines[1];

      const cornerPt = sketch.points.get(pointId);
      const endPt1 = sketch.points.get(line1.p1 === pointId ? line1.p2 : line1.p1);
      const endPt2 = sketch.points.get(line2.p1 === pointId ? line2.p2 : line2.p1);

      if (!cornerPt || !endPt1 || !endPt2) return null;

      const vec1 = { x: endPt1.x - cornerPt.x, y: endPt1.y - cornerPt.y };
      const vec2 = { x: endPt2.x - cornerPt.x, y: endPt2.y - cornerPt.y };

      const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

      if (len1 < 0.001 || len2 < 0.001) return null;

      // Utiliser les distances asymétriques si fournies, sinon la distance symétrique
      const d1Mm = dist1Mm !== undefined ? dist1Mm : distanceMm;
      const d2Mm = dist2Mm !== undefined ? dist2Mm : distanceMm;

      // Convertir distances mm en px
      const dist1Px = d1Mm * sketch.scaleFactor;
      const dist2Px = d2Mm * sketch.scaleFactor;

      if (dist1Px > len1 * 0.95 || dist2Px > len2 * 0.95) return null;

      const u1 = { x: vec1.x / len1, y: vec1.y / len1 };
      const u2 = { x: vec2.x / len2, y: vec2.y / len2 };

      const p1 = { x: cornerPt.x + u1.x * dist1Px, y: cornerPt.y + u1.y * dist1Px };
      const p2 = { x: cornerPt.x + u2.x * dist2Px, y: cornerPt.y + u2.y * dist2Px };

      return { p1, p2 };
    },
    [sketch.points, sketch.scaleFactor, findLinesConnectedToPoint],
  );

  // Mettre à jour la preview des congés en temps réel
  useEffect(() => {
    if (!filletDialog?.open) {
      setFilletPreview([]);
      return;
    }

    const previews: typeof filletPreview = [];
    for (const corner of filletDialog.corners) {
      if (corner.radius > 0 && corner.radius <= corner.maxRadius) {
        const geom = calculateFilletGeometry(corner.pointId, corner.radius);
        if (geom) {
          previews.push({
            type: "arc",
            ...geom,
          });
        }
      }
    }
    setFilletPreview(previews);
  }, [filletDialog, calculateFilletGeometry]);

  // Mettre à jour la preview des chanfreins en temps réel
  useEffect(() => {
    if (!chamferDialog?.open) {
      setChamferPreview([]);
      return;
    }

    const previews: typeof chamferPreview = [];
    for (const corner of chamferDialog.corners) {
      // En mode asymétrique, utiliser dist1 et dist2
      if (chamferDialog.asymmetric) {
        const valid =
          corner.dist1 > 0 && corner.dist1 <= corner.maxDist1 && corner.dist2 > 0 && corner.dist2 <= corner.maxDist2;
        if (valid) {
          const geom = calculateChamferGeometry(corner.pointId, corner.distance, corner.dist1, corner.dist2);
          if (geom) {
            previews.push({
              type: "line",
              ...geom,
            });
          }
        }
      } else {
        if (corner.distance > 0 && corner.distance <= corner.maxDistance) {
          const geom = calculateChamferGeometry(corner.pointId, corner.distance);
          if (geom) {
            previews.push({
              type: "line",
              ...geom,
            });
          }
        }
      }
    }
    setChamferPreview(previews);
  }, [chamferDialog, calculateChamferGeometry]);

  // Ouvrir le dialogue de congé si 2 lignes OU 1+ points (coins) sont sélectionnés
  // Ouvrir le dialogue de congé pour un point spécifique (double-clic sur coin)
  const openFilletDialogForPoint = useCallback(
    (pointId: string) => {
      const connectedLines = findLinesConnectedToPoint(pointId);
      if (connectedLines.length !== 2) {
        toast.warning("Ce point n'est pas un coin valide");
        return;
      }

      const params = calculateCornerParams(connectedLines[0].id, connectedLines[1].id);
      if (!params) {
        toast.error("Impossible de calculer les paramètres du coin");
        return;
      }

      const maxRadiusMm = params.maxRadius / sketch.scaleFactor;
      const len1Mm = params.len1 / sketch.scaleFactor;
      const len2Mm = params.len2 / sketch.scaleFactor;
      const suggestedRadius = Math.min(filletRadius, Math.floor(maxRadiusMm));

      // Fermer les autres panneaux d'édition avant d'ouvrir celui-ci
      closeAllEditPanels("fillet");

      setFilletDialog({
        open: true,
        corners: [
          {
            pointId,
            maxRadius: maxRadiusMm,
            angleDeg: params.angleDeg,
            radius: suggestedRadius > 0 ? suggestedRadius : 1,
            dist1: suggestedRadius > 0 ? suggestedRadius : 1,
            dist2: suggestedRadius > 0 ? suggestedRadius : 1,
            maxDist1: len1Mm * 0.9,
            maxDist2: len2Mm * 0.9,
            line1Id: connectedLines[0].id,
            line2Id: connectedLines[1].id,
          },
        ],
        globalRadius: suggestedRadius > 0 ? suggestedRadius : 1,
        minMaxRadius: maxRadiusMm,
        hoveredCornerIdx: null,
        asymmetric: false,
        addDimension: false,
        repeatMode: false,
      });
    },
    [sketch.scaleFactor, filletRadius, findLinesConnectedToPoint, calculateCornerParams, closeAllEditPanels],
  );

  const openFilletDialog = useCallback(() => {
    const corners: Array<{
      pointId: string;
      maxRadius: number;
      angleDeg: number;
      radius: number;
      dist1: number;
      dist2: number;
      maxDist1: number;
      maxDist2: number;
      line1Id: string;
      line2Id: string;
    }> = [];

    // Collecter tous les coins valides
    const selectedIds = Array.from(selectedEntities);

    // Vérifier si ce sont des points (coins)
    let allAreCornerPoints = true;
    for (const id of selectedIds) {
      if (!sketch.points.has(id)) {
        allAreCornerPoints = false;
        break;
      }
      const connectedLines = findLinesConnectedToPoint(id);
      if (connectedLines.length !== 2) {
        allAreCornerPoints = false;
        break;
      }
    }

    // Calculer le rayon suggéré (en mm)
    const getSuggestedRadius = (maxRadiusMm: number) => {
      return Math.min(filletRadius, Math.floor(maxRadiusMm));
    };

    if (allAreCornerPoints && selectedIds.length >= 1) {
      // Tous sont des points de coin valides
      for (const pointId of selectedIds) {
        const connectedLines = findLinesConnectedToPoint(pointId);
        const params = calculateCornerParams(connectedLines[0].id, connectedLines[1].id);
        if (params) {
          const maxRadiusMm = params.maxRadius / sketch.scaleFactor;
          const len1Mm = params.len1 / sketch.scaleFactor;
          const len2Mm = params.len2 / sketch.scaleFactor;
          const suggested = getSuggestedRadius(maxRadiusMm);
          corners.push({
            pointId,
            maxRadius: maxRadiusMm,
            angleDeg: params.angleDeg,
            radius: suggested,
            dist1: suggested,
            dist2: suggested,
            maxDist1: len1Mm * 0.9,
            maxDist2: len2Mm * 0.9,
            line1Id: connectedLines[0].id,
            line2Id: connectedLines[1].id,
          });
        }
      }
    } else if (selectedEntities.size === 2) {
      // Deux éléments - vérifier que ce sont des lignes
      const geo1 = sketch.geometries.get(selectedIds[0]);
      const geo2 = sketch.geometries.get(selectedIds[1]);

      if (geo1 && geo2 && geo1.type === "line" && geo2.type === "line") {
        const line1 = geo1 as Line;
        const line2 = geo2 as Line;
        const shared = findSharedPoint(line1, line2);

        if (shared) {
          const params = calculateCornerParams(selectedIds[0], selectedIds[1]);
          if (params) {
            const maxRadiusMm = params.maxRadius / sketch.scaleFactor;
            const len1Mm = params.len1 / sketch.scaleFactor;
            const len2Mm = params.len2 / sketch.scaleFactor;
            const suggested = getSuggestedRadius(maxRadiusMm);
            corners.push({
              pointId: shared.sharedPointId,
              maxRadius: maxRadiusMm,
              angleDeg: params.angleDeg,
              radius: suggested,
              dist1: suggested,
              dist2: suggested,
              maxDist1: len1Mm * 0.9,
              maxDist2: len2Mm * 0.9,
              line1Id: selectedIds[0],
              line2Id: selectedIds[1],
            });
          }
        } else {
          toast.warning("Les lignes doivent partager un point commun (un coin)");
          return;
        }
      } else {
        toast.warning("Sélectionnez 2 lignes ou des points (coins)");
        return;
      }
    } else if (selectedEntities.size > 2) {
      // Plus de 2 éléments - chercher tous les coins partagés entre les lignes sélectionnées
      const selectedLines: Line[] = [];
      for (const id of selectedIds) {
        const geo = sketch.geometries.get(id);
        if (geo && geo.type === "line") {
          selectedLines.push(geo as Line);
        }
      }

      if (selectedLines.length < 2) {
        toast.warning("Sélectionnez au moins 2 lignes pour créer des congés");
        return;
      }

      // Trouver tous les points partagés entre les lignes sélectionnées
      const pointUsage = new Map<string, string[]>(); // pointId -> [lineIds]

      selectedLines.forEach((line) => {
        [line.p1, line.p2].forEach((ptId) => {
          if (!pointUsage.has(ptId)) pointUsage.set(ptId, []);
          pointUsage.get(ptId)!.push(line.id);
        });
      });

      // Les coins sont les points utilisés par exactement 2 lignes sélectionnées
      const cornerPointIds: string[] = [];
      pointUsage.forEach((lineIds, pointId) => {
        if (lineIds.length === 2) {
          cornerPointIds.push(pointId);
        }
      });

      if (cornerPointIds.length === 0) {
        toast.warning("Aucun coin trouvé entre les lignes sélectionnées");
        return;
      }

      // Calculer les paramètres pour chaque coin
      for (const pointId of cornerPointIds) {
        const lineIds = pointUsage.get(pointId)!;
        const params = calculateCornerParams(lineIds[0], lineIds[1]);
        if (params) {
          const maxRadiusMm = params.maxRadius / sketch.scaleFactor;
          const len1Mm = params.len1 / sketch.scaleFactor;
          const len2Mm = params.len2 / sketch.scaleFactor;
          const suggested = getSuggestedRadius(maxRadiusMm);
          corners.push({
            pointId,
            maxRadius: maxRadiusMm,
            angleDeg: params.angleDeg,
            radius: suggested,
            dist1: suggested,
            dist2: suggested,
            maxDist1: len1Mm * 0.9,
            maxDist2: len2Mm * 0.9,
            line1Id: lineIds[0],
            line2Id: lineIds[1],
          });
        }
      }
    } else {
      toast.warning("Sélectionnez 2 lignes, des points (coins), ou une figure complète");
      return;
    }

    if (corners.length === 0) {
      toast.error("Aucun coin valide trouvé");
      return;
    }

    // Trouver le plus petit maxRadius parmi tous les coins (déjà en mm)
    const minMaxRadius = Math.min(...corners.map((c) => c.maxRadius));
    const suggestedRadius = Math.min(filletRadius, Math.floor(minMaxRadius));

    setFilletDialog({
      open: true,
      corners,
      globalRadius: suggestedRadius > 0 ? suggestedRadius : 1,
      minMaxRadius,
      hoveredCornerIdx: null,
      asymmetric: false,
      addDimension: false,
      repeatMode: false,
    });
  }, [
    selectedEntities,
    sketch.geometries,
    sketch.points,
    sketch.scaleFactor,
    findSharedPoint,
    findLinesConnectedToPoint,
    filletRadius,
    calculateCornerParams,
  ]);

  // Ouvrir le dialogue de chanfrein si 2 lignes OU 1+ points (coins) sont sélectionnés
  // Ouvrir le dialogue de chanfrein pour un point spécifique (double-clic sur coin)
  const openChamferDialogForPoint = useCallback(
    (pointId: string) => {
      const connectedLines = findLinesConnectedToPoint(pointId);
      if (connectedLines.length !== 2) {
        toast.warning("Ce point n'est pas un coin valide");
        return;
      }

      const params = calculateCornerParams(connectedLines[0].id, connectedLines[1].id);
      if (!params) {
        toast.error("Impossible de calculer les paramètres du coin");
        return;
      }

      const maxDistanceMm = params.maxDistance / sketch.scaleFactor;
      const len1Mm = params.len1 / sketch.scaleFactor;
      const len2Mm = params.len2 / sketch.scaleFactor;
      const suggestedDistance = Math.min(chamferDistance, Math.floor(maxDistanceMm));

      setChamferDialog({
        open: true,
        corners: [
          {
            pointId,
            maxDistance: maxDistanceMm,
            angleDeg: params.angleDeg,
            distance: suggestedDistance > 0 ? suggestedDistance : 1,
            dist1: suggestedDistance > 0 ? suggestedDistance : 1,
            dist2: suggestedDistance > 0 ? suggestedDistance : 1,
            maxDist1: len1Mm * 0.9,
            maxDist2: len2Mm * 0.9,
            line1Id: connectedLines[0].id,
            line2Id: connectedLines[1].id,
          },
        ],
        globalDistance: suggestedDistance > 0 ? suggestedDistance : 1,
        minMaxDistance: maxDistanceMm,
        hoveredCornerIdx: null,
        asymmetric: false,
        addDimension: false,
        repeatMode: false,
      });
    },
    [sketch.scaleFactor, chamferDistance, findLinesConnectedToPoint, calculateCornerParams],
  );

  const openChamferDialog = useCallback(() => {
    const corners: Array<{
      pointId: string;
      maxDistance: number;
      angleDeg: number;
      distance: number;
      dist1: number;
      dist2: number;
      maxDist1: number;
      maxDist2: number;
      line1Id: string;
      line2Id: string;
    }> = [];

    // Collecter tous les coins valides
    const selectedIds = Array.from(selectedEntities);

    // Calculer la distance suggérée (en mm)
    const getSuggestedDistance = (maxDistanceMm: number) => {
      return Math.min(chamferDistance, Math.floor(maxDistanceMm));
    };

    // Vérifier si ce sont des points (coins)
    let allAreCornerPoints = true;
    for (const id of selectedIds) {
      if (!sketch.points.has(id)) {
        allAreCornerPoints = false;
        break;
      }
      const connectedLines = findLinesConnectedToPoint(id);
      if (connectedLines.length !== 2) {
        allAreCornerPoints = false;
        break;
      }
    }

    if (allAreCornerPoints && selectedIds.length >= 1) {
      // Tous sont des points de coin valides
      for (const pointId of selectedIds) {
        const connectedLines = findLinesConnectedToPoint(pointId);
        const params = calculateCornerParams(connectedLines[0].id, connectedLines[1].id);
        if (params) {
          const maxDistanceMm = params.maxDistance / sketch.scaleFactor;
          const len1Mm = params.len1 / sketch.scaleFactor;
          const len2Mm = params.len2 / sketch.scaleFactor;
          const suggested = getSuggestedDistance(maxDistanceMm);
          corners.push({
            pointId,
            maxDistance: maxDistanceMm,
            angleDeg: params.angleDeg,
            distance: suggested,
            dist1: suggested,
            dist2: suggested,
            maxDist1: len1Mm * 0.9,
            maxDist2: len2Mm * 0.9,
            line1Id: connectedLines[0].id,
            line2Id: connectedLines[1].id,
          });
        }
      }
    } else if (selectedEntities.size === 2) {
      // Deux éléments - vérifier que ce sont des lignes
      const geo1 = sketch.geometries.get(selectedIds[0]);
      const geo2 = sketch.geometries.get(selectedIds[1]);

      if (geo1 && geo2 && geo1.type === "line" && geo2.type === "line") {
        const line1 = geo1 as Line;
        const line2 = geo2 as Line;
        const shared = findSharedPoint(line1, line2);

        if (shared) {
          const params = calculateCornerParams(selectedIds[0], selectedIds[1]);
          if (params) {
            const maxDistanceMm = params.maxDistance / sketch.scaleFactor;
            const len1Mm = params.len1 / sketch.scaleFactor;
            const len2Mm = params.len2 / sketch.scaleFactor;
            const suggested = getSuggestedDistance(maxDistanceMm);
            corners.push({
              pointId: shared.sharedPointId,
              maxDistance: maxDistanceMm,
              angleDeg: params.angleDeg,
              distance: suggested,
              dist1: suggested,
              dist2: suggested,
              maxDist1: len1Mm * 0.9,
              maxDist2: len2Mm * 0.9,
              line1Id: selectedIds[0],
              line2Id: selectedIds[1],
            });
          }
        } else {
          toast.warning("Les lignes doivent partager un point commun (un coin)");
          return;
        }
      } else {
        toast.warning("Sélectionnez 2 lignes ou des points (coins)");
        return;
      }
    } else if (selectedEntities.size > 2) {
      // Plus de 2 éléments - chercher tous les coins partagés entre les lignes sélectionnées
      const selectedLines: Line[] = [];
      for (const id of selectedIds) {
        const geo = sketch.geometries.get(id);
        if (geo && geo.type === "line") {
          selectedLines.push(geo as Line);
        }
      }

      if (selectedLines.length < 2) {
        toast.warning("Sélectionnez au moins 2 lignes pour créer des chanfreins");
        return;
      }

      // Trouver tous les points partagés entre les lignes sélectionnées
      const pointUsage = new Map<string, string[]>(); // pointId -> [lineIds]

      selectedLines.forEach((line) => {
        [line.p1, line.p2].forEach((ptId) => {
          if (!pointUsage.has(ptId)) pointUsage.set(ptId, []);
          pointUsage.get(ptId)!.push(line.id);
        });
      });

      // Les coins sont les points utilisés par exactement 2 lignes sélectionnées
      const cornerPointIds: string[] = [];
      pointUsage.forEach((lineIds, pointId) => {
        if (lineIds.length === 2) {
          cornerPointIds.push(pointId);
        }
      });

      if (cornerPointIds.length === 0) {
        toast.warning("Aucun coin trouvé entre les lignes sélectionnées");
        return;
      }

      // Calculer les paramètres pour chaque coin
      for (const pointId of cornerPointIds) {
        const lineIds = pointUsage.get(pointId)!;
        const params = calculateCornerParams(lineIds[0], lineIds[1]);
        if (params) {
          const maxDistanceMm = params.maxDistance / sketch.scaleFactor;
          const len1Mm = params.len1 / sketch.scaleFactor;
          const len2Mm = params.len2 / sketch.scaleFactor;
          const suggested = getSuggestedDistance(maxDistanceMm);
          corners.push({
            pointId,
            maxDistance: maxDistanceMm,
            angleDeg: params.angleDeg,
            distance: suggested,
            dist1: suggested,
            dist2: suggested,
            maxDist1: len1Mm * 0.9,
            maxDist2: len2Mm * 0.9,
            line1Id: lineIds[0],
            line2Id: lineIds[1],
          });
        }
      }
    } else {
      toast.warning("Sélectionnez 2 lignes, des points (coins), ou une figure complète");
      return;
    }

    if (corners.length === 0) {
      toast.error("Aucun coin valide trouvé");
      return;
    }

    // Trouver le plus petit maxDistance parmi tous les coins (déjà en mm)
    const minMaxDistance = Math.min(...corners.map((c) => c.maxDistance));
    const suggestedDistance = Math.min(chamferDistance, Math.floor(minMaxDistance));

    setChamferDialog({
      open: true,
      corners,
      globalDistance: suggestedDistance > 0 ? suggestedDistance : 1,
      minMaxDistance,
      hoveredCornerIdx: null,
      asymmetric: false,
      addDimension: false,
      repeatMode: false,
    });
  }, [
    selectedEntities,
    sketch.geometries,
    sketch.points,
    sketch.scaleFactor,
    findSharedPoint,
    findLinesConnectedToPoint,
    chamferDistance,
    calculateCornerParams,
  ]);

  // Appliquer le congé depuis la modale (sur tous les coins)
  const applyFilletFromDialog = useCallback(() => {
    if (!filletDialog) return;

    // Accumuler les changements dans un seul sketch
    let currentSketch: Sketch = {
      ...sketch,
      points: new Map(sketch.points),
      geometries: new Map(sketch.geometries),
      layers: new Map(sketch.layers),
      constraints: new Map(sketch.constraints),
    };
    let successCount = 0;

    for (const corner of filletDialog.corners) {
      // Retrouver les lignes connectées à ce point dans le sketch COURANT
      // IMPORTANT: Exclure les lignes de construction (ex: diagonales des rectangles par le centre)
      const connectedLines: Line[] = [];
      currentSketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const line = geo as Line;
          // Exclure les lignes de construction pour ne garder que les 2 côtés du coin
          if (!line.isConstruction && (line.p1 === corner.pointId || line.p2 === corner.pointId)) {
            connectedLines.push(line);
          }
        }
      });

      if (connectedLines.length !== 2) {
        continue;
      }

      // Vérifier que le rayon ne dépasse pas le max de ce coin (tout en mm)
      if (corner.radius <= corner.maxRadius) {
        // Convertir le rayon de mm en px pour applyFilletToSketch
        const radiusPx = corner.radius * sketch.scaleFactor;
        const newSketch = applyFilletToSketch(
          currentSketch,
          connectedLines[0].id,
          connectedLines[1].id,
          radiusPx,
          true,
        );
        if (newSketch) {
          currentSketch = newSketch;
          successCount++;
        }
      }
    }

    if (successCount > 0) {
      // Ajouter les cotations si demandé
      if (filletDialog.addDimension) {
        // Trouver les arcs créés (les derniers ajoutés)
        const newArcs: Arc[] = [];
        currentSketch.geometries.forEach((geo) => {
          if (geo.type === "arc") {
            newArcs.push(geo as Arc);
          }
        });
        // Prendre les N derniers arcs (N = successCount)
        const createdArcs = newArcs.slice(-successCount);
        for (const arc of createdArcs) {
          const center = currentSketch.points.get(arc.center);
          if (center) {
            const radiusMm = arc.radius / sketch.scaleFactor;
            // Ajouter une dimension de type "radius" pour cet arc
            const dimId = generateId();
            const dimension: Dimension = {
              id: dimId,
              type: "radius",
              entities: [arc.id],
              value: radiusMm,
              position: { x: center.x + arc.radius + 20, y: center.y },
            };
            if (!currentSketch.dimensions) {
              (currentSketch as any).dimensions = new Map();
            }
            (currentSketch as any).dimensions.set(dimId, dimension);
          }
        }
      }

      setSketch(currentSketch);
      addToHistory(currentSketch);
      if (successCount === 1) {
        toast.success(`Congé R${filletDialog.corners[0].radius}mm appliqué`);
      } else {
        toast.success(`${successCount} congés appliqués`);
      }
    } else {
      toast.error("Aucun congé n'a pu être appliqué");
    }

    setFilletRadius(filletDialog.globalRadius);

    // Mode répétition : ne pas fermer le panneau, juste vider la sélection
    if (filletDialog.repeatMode) {
      setFilletDialog(null);
      // Le panneau sera réouvert au prochain double-clic
    } else {
      setFilletDialog(null);
    }
    setSelectedEntities(new Set());
  }, [filletDialog, sketch, applyFilletToSketch, addToHistory]);

  // Appliquer le chanfrein depuis la modale (sur tous les coins)
  const applyChamferFromDialog = useCallback(() => {
    if (!chamferDialog) return;

    // Accumuler les changements dans un seul sketch
    let currentSketch: Sketch = {
      ...sketch,
      points: new Map(sketch.points),
      geometries: new Map(sketch.geometries),
      layers: new Map(sketch.layers),
      constraints: new Map(sketch.constraints),
    };
    let successCount = 0;

    for (const corner of chamferDialog.corners) {
      // Retrouver les lignes connectées à ce point dans le sketch COURANT
      // IMPORTANT: Exclure les lignes de construction (ex: diagonales des rectangles par le centre)
      const connectedLines: Line[] = [];
      currentSketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const line = geo as Line;
          // Exclure les lignes de construction pour ne garder que les 2 côtés du coin
          if (!line.isConstruction && (line.p1 === corner.pointId || line.p2 === corner.pointId)) {
            connectedLines.push(line);
          }
        }
      });

      if (connectedLines.length !== 2) {
        console.log(`Point ${corner.pointId} n'a plus exactement 2 lignes connectées (${connectedLines.length})`);
        continue;
      }

      // Vérifier que la distance ne dépasse pas le max de ce coin (tout en mm)
      if (corner.distance <= corner.maxDistance) {
        // Convertir la distance de mm en px pour applyChamferToSketch
        const distancePx = corner.distance * sketch.scaleFactor;
        const newSketch = applyChamferToSketch(
          currentSketch,
          connectedLines[0].id,
          connectedLines[1].id,
          distancePx,
          true,
        );
        if (newSketch) {
          currentSketch = newSketch;
          successCount++;
        }
      }
    }

    if (successCount > 0) {
      setSketch(currentSketch);
      addToHistory(currentSketch);
      if (successCount === 1) {
        toast.success(`Chanfrein ${chamferDialog.corners[0].distance}mm appliqué`);
      } else {
        toast.success(`${successCount} chanfreins appliqués`);
      }
    } else {
      toast.error("Aucun chanfrein n'a pu être appliqué");
    }

    setChamferDistance(chamferDialog.globalDistance);

    // Mode répétition : ne pas fermer le panneau
    if (chamferDialog.repeatMode) {
      setChamferDialog(null);
    } else {
      setChamferDialog(null);
    }
    setSelectedEntities(new Set());
  }, [chamferDialog, sketch, applyChamferToSketch, addToHistory]);

  // Supprimer un congé (arc) et revenir au coin original
  const removeFilletFromArc = useCallback(
    (arcId: string) => {
      const arc = sketch.geometries.get(arcId) as Arc | undefined;
      if (!arc || arc.type !== "arc") {
        toast.error("Sélectionnez un arc (congé)");
        return;
      }

      const center = sketch.points.get(arc.center);
      const startPt = sketch.points.get(arc.startPoint);
      const endPt = sketch.points.get(arc.endPoint);

      if (!center || !startPt || !endPt) {
        toast.error("Points de l'arc introuvables");
        return;
      }

      // Trouver les lignes connectées aux points de début et fin de l'arc
      const linesAtStart: Line[] = [];
      const linesAtEnd: Line[] = [];

      sketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const line = geo as Line;
          if (line.p1 === arc.startPoint || line.p2 === arc.startPoint) {
            linesAtStart.push(line);
          }
          if (line.p1 === arc.endPoint || line.p2 === arc.endPoint) {
            linesAtEnd.push(line);
          }
        }
      });

      if (linesAtStart.length !== 1 || linesAtEnd.length !== 1) {
        toast.error("Cet arc n'est pas un congé valide");
        return;
      }

      const line1 = linesAtStart[0];
      const line2 = linesAtEnd[0];

      // Calculer le point d'intersection des deux lignes prolongées
      // Ligne 1: passe par startPt et son autre extrémité
      const line1OtherId = line1.p1 === arc.startPoint ? line1.p2 : line1.p1;
      const line1Other = sketch.points.get(line1OtherId);

      // Ligne 2: passe par endPt et son autre extrémité
      const line2OtherId = line2.p1 === arc.endPoint ? line2.p2 : line2.p1;
      const line2Other = sketch.points.get(line2OtherId);

      if (!line1Other || !line2Other) {
        toast.error("Extrémités des lignes introuvables");
        return;
      }

      // Calculer l'intersection
      const d1 = { x: startPt.x - line1Other.x, y: startPt.y - line1Other.y };
      const d2 = { x: endPt.x - line2Other.x, y: endPt.y - line2Other.y };

      const cross = d1.x * d2.y - d1.y * d2.x;
      if (Math.abs(cross) < 0.0001) {
        toast.error("Les lignes sont parallèles");
        return;
      }

      // Paramètre t pour la ligne 1
      const t = ((line2Other.x - line1Other.x) * d2.y - (line2Other.y - line1Other.y) * d2.x) / cross;

      const intersection = {
        x: line1Other.x + t * d1.x,
        y: line1Other.y + t * d1.y,
      };

      // Créer le nouveau sketch
      const newSketch = {
        ...sketch,
        points: new Map(sketch.points),
        geometries: new Map(sketch.geometries),
      };

      // Créer le nouveau point de coin
      const cornerPointId = generateId();
      newSketch.points.set(cornerPointId, { id: cornerPointId, x: intersection.x, y: intersection.y });

      // Modifier la ligne 1 pour pointer vers le nouveau coin
      const newLine1: Line = {
        ...line1,
        [line1.p1 === arc.startPoint ? "p1" : "p2"]: cornerPointId,
      };
      newSketch.geometries.set(line1.id, newLine1);

      // Modifier la ligne 2 pour pointer vers le nouveau coin
      const newLine2: Line = {
        ...line2,
        [line2.p1 === arc.endPoint ? "p1" : "p2"]: cornerPointId,
      };
      newSketch.geometries.set(line2.id, newLine2);

      // Supprimer l'arc et ses points
      newSketch.geometries.delete(arcId);
      newSketch.points.delete(arc.startPoint);
      newSketch.points.delete(arc.endPoint);
      newSketch.points.delete(arc.center);

      setSketch(newSketch);
      addToHistory(newSketch);
      setSelectedEntities(new Set());
      toast.success("Congé supprimé, coin restauré");
    },
    [sketch, addToHistory],
  );

  // Switch du panneau congé vers chanfrein (et vice versa)
  const switchFilletToChamfer = useCallback(() => {
    if (!filletDialog) return;

    // Convertir les corners de fillet en chamfer
    const chamferCorners = filletDialog.corners.map((c) => ({
      pointId: c.pointId,
      maxDistance: Math.min(c.maxDist1, c.maxDist2),
      angleDeg: c.angleDeg,
      distance: c.radius,
      dist1: c.dist1,
      dist2: c.dist2,
      maxDist1: c.maxDist1,
      maxDist2: c.maxDist2,
      line1Id: c.line1Id,
      line2Id: c.line2Id,
    }));

    setFilletDialog(null);
    setChamferDialog({
      open: true,
      corners: chamferCorners,
      globalDistance: filletDialog.globalRadius,
      minMaxDistance: Math.min(...chamferCorners.map((c) => c.maxDistance)),
      hoveredCornerIdx: null,
      asymmetric: filletDialog.asymmetric,
      addDimension: filletDialog.addDimension,
      repeatMode: filletDialog.repeatMode,
    });
  }, [filletDialog]);

  const switchChamferToFillet = useCallback(() => {
    if (!chamferDialog) return;

    // Convertir les corners de chamfer en fillet
    const filletCorners = chamferDialog.corners.map((c) => {
      // Calculer le rayon max à partir des distances
      const minDist = Math.min(c.maxDist1, c.maxDist2);
      const halfAngle = (c.angleDeg * Math.PI) / 180 / 2;
      const maxRadius = minDist * Math.tan(halfAngle);

      return {
        pointId: c.pointId,
        maxRadius: maxRadius,
        angleDeg: c.angleDeg,
        radius: c.distance,
        dist1: c.dist1,
        dist2: c.dist2,
        maxDist1: c.maxDist1,
        maxDist2: c.maxDist2,
        line1Id: c.line1Id,
        line2Id: c.line2Id,
      };
    });

    setChamferDialog(null);
    setFilletDialog({
      open: true,
      corners: filletCorners,
      globalRadius: chamferDialog.globalDistance,
      minMaxRadius: Math.min(...filletCorners.map((c) => c.maxRadius)),
      hoveredCornerIdx: null,
      asymmetric: chamferDialog.asymmetric,
      addDimension: chamferDialog.addDimension,
      repeatMode: chamferDialog.repeatMode,
    });
  }, [chamferDialog]);

  // ============ OFFSET FUNCTIONS ============

  // Calculer l'offset d'une ligne (retourne les deux points décalés)
  const offsetLine = useCallback(
    (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      distancePx: number,
      direction: "outside" | "inside", // outside = vers l'extérieur du contour
    ): { p1: { x: number; y: number }; p2: { x: number; y: number } } => {
      // Vecteur direction de la ligne
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 0.001) return { p1, p2 };

      // Vecteur normal (perpendiculaire) - outside = vers la droite en regardant de p1 vers p2
      const sign = direction === "outside" ? 1 : -1;
      const nx = (sign * dy) / length;
      const ny = (sign * -dx) / length;

      return {
        p1: { x: p1.x + nx * distancePx, y: p1.y + ny * distancePx },
        p2: { x: p2.x + nx * distancePx, y: p2.y + ny * distancePx },
      };
    },
    [],
  );

  // Ouvrir la modale offset
  const openOffsetDialog = useCallback(() => {
    setActiveTool("offset");
    setOffsetDialog({
      open: true,
      selectedEntities: new Set(selectedEntities),
    });
  }, [selectedEntities]);

  // Calculer la preview de l'offset pour toutes les entités sélectionnées
  const calculateOffsetPreviewForSelection = useCallback(
    (entities: Set<string>, dist: number, dir: "outside" | "inside"): typeof offsetPreview => {
      const previews: typeof offsetPreview = [];
      const distancePx = dist * sketch.scaleFactor;

      entities.forEach((entityId) => {
        const geo = sketch.geometries.get(entityId);
        if (!geo) return;

        if (geo.type === "line") {
          const line = geo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (!p1 || !p2) return;

          const offset = offsetLine(p1, p2, distancePx, dir);
          previews.push({
            type: "line",
            points: [offset.p1, offset.p2],
          });
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          const center = sketch.points.get(circle.center);
          if (!center) return;

          const newRadius = dir === "outside" ? circle.radius + distancePx : Math.max(1, circle.radius - distancePx);

          previews.push({
            type: "circle",
            center,
            radius: newRadius,
          });
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          const center = sketch.points.get(arc.center);
          const startPt = sketch.points.get(arc.startPoint);
          const endPt = sketch.points.get(arc.endPoint);
          if (!center || !startPt || !endPt) return;

          const newRadius = dir === "outside" ? arc.radius + distancePx : Math.max(1, arc.radius - distancePx);

          const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
          const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);

          previews.push({
            type: "arc",
            center,
            radius: newRadius,
            startAngle,
            endAngle,
            counterClockwise: arc.counterClockwise,
          });
        }
      });

      return previews;
    },
    [sketch, offsetLine],
  );

  // Mettre à jour la preview quand les paramètres changent
  useEffect(() => {
    if (offsetDialog?.open && offsetDialog.selectedEntities.size > 0) {
      const preview = calculateOffsetPreviewForSelection(
        offsetDialog.selectedEntities,
        offsetDistance,
        offsetDirection,
      );
      setOffsetPreview(preview);
    } else {
      setOffsetPreview([]);
    }
  }, [offsetDialog, offsetDistance, offsetDirection, calculateOffsetPreviewForSelection]);

  // Appliquer l'offset à la sélection
  const applyOffsetToSelection = useCallback(() => {
    if (!offsetDialog || offsetDialog.selectedEntities.size === 0) {
      toast.error("Sélectionnez au moins une entité");
      return;
    }

    const distancePx = offsetDistance * sketch.scaleFactor;
    const newSketch = { ...sketch };
    newSketch.points = new Map(sketch.points);
    newSketch.geometries = new Map(sketch.geometries);

    // Séparer les lignes des autres types
    const lineIds: string[] = [];
    const circleIds: string[] = [];
    const arcIds: string[] = [];

    offsetDialog.selectedEntities.forEach((entityId) => {
      const geo = sketch.geometries.get(entityId);
      if (geo?.type === "line") lineIds.push(entityId);
      else if (geo?.type === "circle") circleIds.push(entityId);
      else if (geo?.type === "arc") arcIds.push(entityId);
    });

    let createdCount = 0;

    // Traiter les cercles
    circleIds.forEach((entityId) => {
      const circle = sketch.geometries.get(entityId) as CircleType;
      const center = sketch.points.get(circle.center);
      if (!center) return;

      const newRadius =
        offsetDirection === "outside" ? Math.max(1, circle.radius - distancePx) : circle.radius + distancePx;

      const newCircle: CircleType = {
        id: generateId(),
        type: "circle",
        center: circle.center,
        radius: newRadius,
        layerId: circle.layerId,
      };
      newSketch.geometries.set(newCircle.id, newCircle);
      createdCount++;
    });

    // Traiter les arcs
    arcIds.forEach((entityId) => {
      const arc = sketch.geometries.get(entityId) as Arc;
      const center = sketch.points.get(arc.center);
      const startPt = sketch.points.get(arc.startPoint);
      const endPt = sketch.points.get(arc.endPoint);
      if (!center || !startPt || !endPt) return;

      const newRadius = offsetDirection === "outside" ? Math.max(1, arc.radius - distancePx) : arc.radius + distancePx;

      const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
      const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);

      const newStartPt: Point = {
        id: generateId(),
        x: center.x + Math.cos(startAngle) * newRadius,
        y: center.y + Math.sin(startAngle) * newRadius,
      };
      const newEndPt: Point = {
        id: generateId(),
        x: center.x + Math.cos(endAngle) * newRadius,
        y: center.y + Math.sin(endAngle) * newRadius,
      };
      newSketch.points.set(newStartPt.id, newStartPt);
      newSketch.points.set(newEndPt.id, newEndPt);

      const newArc: Arc = {
        id: generateId(),
        type: "arc",
        center: arc.center,
        startPoint: newStartPt.id,
        endPoint: newEndPt.id,
        radius: newRadius,
        layerId: arc.layerId,
        counterClockwise: arc.counterClockwise,
      };
      newSketch.geometries.set(newArc.id, newArc);
      createdCount++;
    });

    // Traiter les lignes - avec calcul des intersections
    if (lineIds.length > 0) {
      // Récupérer les infos des segments
      type SegInfo = {
        id: string;
        p1Id: string;
        p2Id: string;
        p1: { x: number; y: number };
        p2: { x: number; y: number };
        layerId?: string;
      };

      const segments: SegInfo[] = [];
      lineIds.forEach((lineId) => {
        const line = sketch.geometries.get(lineId) as Line;
        const p1 = sketch.points.get(line.p1);
        const p2 = sketch.points.get(line.p2);
        if (p1 && p2) {
          segments.push({
            id: lineId,
            p1Id: line.p1,
            p2Id: line.p2,
            p1: { x: p1.x, y: p1.y },
            p2: { x: p2.x, y: p2.y },
            layerId: line.layerId,
          });
        }
      });

      // Construire un graphe point -> segments
      const pointToSegs = new Map<string, number[]>();
      segments.forEach((seg, idx) => {
        if (!pointToSegs.has(seg.p1Id)) pointToSegs.set(seg.p1Id, []);
        if (!pointToSegs.has(seg.p2Id)) pointToSegs.set(seg.p2Id, []);
        pointToSegs.get(seg.p1Id)!.push(idx);
        pointToSegs.get(seg.p2Id)!.push(idx);
      });

      // Ordonner les segments en suivant le contour
      const orderedSegs: Array<{ seg: SegInfo; reversed: boolean }> = [];
      const used = new Set<number>();

      // Trouver un point de départ (point avec un seul segment = extrémité, sinon n'importe lequel)
      let startIdx = 0;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const count1 = pointToSegs.get(seg.p1Id)?.length || 0;
        const count2 = pointToSegs.get(seg.p2Id)?.length || 0;
        if (count1 === 1 || count2 === 1) {
          startIdx = i;
          break;
        }
      }

      // Commencer par le premier segment
      const firstSeg = segments[startIdx];
      const firstP1Count = pointToSegs.get(firstSeg.p1Id)?.length || 0;
      // Si p1 est une extrémité (1 seul segment), on commence par p1
      const startReversed = firstP1Count !== 1;
      orderedSegs.push({ seg: firstSeg, reversed: startReversed });
      used.add(startIdx);

      let currentEndPtId = startReversed ? firstSeg.p1Id : firstSeg.p2Id;

      // Suivre la chaîne
      while (orderedSegs.length < segments.length) {
        const connectedIdxs = pointToSegs.get(currentEndPtId) || [];
        let found = false;

        for (const idx of connectedIdxs) {
          if (used.has(idx)) continue;

          const seg = segments[idx];
          if (seg.p1Id === currentEndPtId) {
            orderedSegs.push({ seg, reversed: false });
            currentEndPtId = seg.p2Id;
            found = true;
          } else if (seg.p2Id === currentEndPtId) {
            orderedSegs.push({ seg, reversed: true });
            currentEndPtId = seg.p1Id;
            found = true;
          }

          if (found) {
            used.add(idx);
            break;
          }
        }

        if (!found) break;
      }

      // Calculer les lignes décalées
      const offsetLines: Array<{
        p1: { x: number; y: number };
        p2: { x: number; y: number };
        layerId?: string;
      }> = [];

      orderedSegs.forEach(({ seg, reversed }) => {
        const start = reversed ? seg.p2 : seg.p1;
        const end = reversed ? seg.p1 : seg.p2;
        const off = offsetLine(start, end, distancePx, offsetDirection === "outside" ? "inside" : "outside");
        offsetLines.push({ p1: off.p1, p2: off.p2, layerId: seg.layerId });
      });

      // Vérifier si fermé
      const firstOs = orderedSegs[0];
      const lastOs = orderedSegs[orderedSegs.length - 1];
      const startPtId = firstOs.reversed ? firstOs.seg.p2Id : firstOs.seg.p1Id;
      const endPtId = lastOs.reversed ? lastOs.seg.p1Id : lastOs.seg.p2Id;
      const isClosed = startPtId === endPtId;

      // Calculer les points d'intersection entre segments adjacents
      const computeIntersection = (
        l1: { p1: { x: number; y: number }; p2: { x: number; y: number } },
        l2: { p1: { x: number; y: number }; p2: { x: number; y: number } },
      ): { x: number; y: number } => {
        const d1x = l1.p2.x - l1.p1.x;
        const d1y = l1.p2.y - l1.p1.y;
        const d2x = l2.p2.x - l2.p1.x;
        const d2y = l2.p2.y - l2.p1.y;

        const cross = d1x * d2y - d1y * d2x;
        if (Math.abs(cross) < 0.0001) {
          // Parallèles - utiliser le milieu entre les deux points adjacents
          return {
            x: (l1.p2.x + l2.p1.x) / 2,
            y: (l1.p2.y + l2.p1.y) / 2,
          };
        }

        const t = ((l2.p1.x - l1.p1.x) * d2y - (l2.p1.y - l1.p1.y) * d2x) / cross;
        return {
          x: l1.p1.x + t * d1x,
          y: l1.p1.y + t * d1y,
        };
      };

      // Créer les nouveaux points et lignes
      const newPtIds: string[] = [];

      if (isClosed) {
        // Contour fermé - tous les sommets sont des intersections
        for (let i = 0; i < offsetLines.length; i++) {
          const curr = offsetLines[i];
          const next = offsetLines[(i + 1) % offsetLines.length];
          const inter = computeIntersection(curr, next);
          const pt: Point = { id: generateId(), x: inter.x, y: inter.y };
          newSketch.points.set(pt.id, pt);
          newPtIds.push(pt.id);
        }

        // Créer les lignes
        for (let i = 0; i < offsetLines.length; i++) {
          const newLine: Line = {
            id: generateId(),
            type: "line",
            p1: newPtIds[i],
            p2: newPtIds[(i + 1) % newPtIds.length],
            layerId: offsetLines[i].layerId,
          };
          newSketch.geometries.set(newLine.id, newLine);
          createdCount++;
        }
      } else {
        // Contour ouvert
        // Premier point = début du premier segment décalé
        const firstPt: Point = { id: generateId(), x: offsetLines[0].p1.x, y: offsetLines[0].p1.y };
        newSketch.points.set(firstPt.id, firstPt);
        newPtIds.push(firstPt.id);

        // Points intermédiaires = intersections
        for (let i = 0; i < offsetLines.length - 1; i++) {
          const inter = computeIntersection(offsetLines[i], offsetLines[i + 1]);
          const pt: Point = { id: generateId(), x: inter.x, y: inter.y };
          newSketch.points.set(pt.id, pt);
          newPtIds.push(pt.id);
        }

        // Dernier point = fin du dernier segment décalé
        const lastLine = offsetLines[offsetLines.length - 1];
        const lastPt: Point = { id: generateId(), x: lastLine.p2.x, y: lastLine.p2.y };
        newSketch.points.set(lastPt.id, lastPt);
        newPtIds.push(lastPt.id);

        // Créer les lignes
        for (let i = 0; i < offsetLines.length; i++) {
          const newLine: Line = {
            id: generateId(),
            type: "line",
            p1: newPtIds[i],
            p2: newPtIds[i + 1],
            layerId: offsetLines[i].layerId,
          };
          newSketch.geometries.set(newLine.id, newLine);
          createdCount++;
        }
      }
    }

    if (createdCount > 0) {
      setSketch(newSketch);
      solveSketch(newSketch);
      addToHistory(newSketch);
      toast.success(`Offset ${offsetDistance}mm créé (${createdCount} élément${createdCount > 1 ? "s" : ""})`);
    }

    setOffsetDialog(null);
    setOffsetPreview([]);
    setSelectedEntities(new Set());
  }, [offsetDialog, offsetDistance, offsetDirection, sketch, offsetLine, addToHistory, solveSketch]);

  // Ajouter/retirer une entité de la sélection offset
  const toggleOffsetSelection = useCallback(
    (entityId: string) => {
      if (!offsetDialog) return;

      const newSelection = new Set(offsetDialog.selectedEntities);
      if (newSelection.has(entityId)) {
        newSelection.delete(entityId);
      } else {
        newSelection.add(entityId);
      }

      setOffsetDialog({
        ...offsetDialog,
        selectedEntities: newSelection,
      });
      setSelectedEntities(newSelection);
    },
    [offsetDialog],
  );

  // Sélectionner tout le contour connecté pour l'offset
  const selectContourForOffset = useCallback(
    (startEntityId: string) => {
      const connectedGeos = findConnectedGeometries(startEntityId);

      if (offsetDialog) {
        setOffsetDialog({
          ...offsetDialog,
          selectedEntities: connectedGeos,
        });
      }
      setSelectedEntities(connectedGeos);
    },
    [offsetDialog, findConnectedGeometries],
  );

  // Calculer l'intersection de deux lignes (prolongées)
  const lineIntersection = useCallback(
    (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number },
      p4: { x: number; y: number },
    ): { x: number; y: number } | null => {
      const d1x = p2.x - p1.x;
      const d1y = p2.y - p1.y;
      const d2x = p4.x - p3.x;
      const d2y = p4.y - p3.y;

      const cross = d1x * d2y - d1y * d2x;
      if (Math.abs(cross) < 0.0001) return null; // Lignes parallèles

      const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / cross;

      return {
        x: p1.x + t * d1x,
        y: p1.y + t * d1y,
      };
    },
    [],
  );

  // Intersection cercle-segment (peut retourner 0, 1 ou 2 points)
  const circleSegmentIntersection = useCallback(
    (
      center: { x: number; y: number },
      radius: number,
      p1: { x: number; y: number },
      p2: { x: number; y: number },
    ): Array<{ x: number; y: number }> => {
      const results: Array<{ x: number; y: number }> = [];

      // Direction du segment
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;

      // Vecteur du centre vers p1
      const fx = p1.x - center.x;
      const fy = p1.y - center.y;

      // Coefficients de l'équation quadratique at² + bt + c = 0
      const a = dx * dx + dy * dy;
      const b = 2 * (fx * dx + fy * dy);
      const c = fx * fx + fy * fy - radius * radius;

      const discriminant = b * b - 4 * a * c;

      if (discriminant < 0 || a < 0.0001) {
        return results; // Pas d'intersection
      }

      const sqrtDisc = Math.sqrt(discriminant);
      const epsilon = 0.01; // Marge pour éviter les extrémités

      // Première solution
      const t1 = (-b - sqrtDisc) / (2 * a);
      if (t1 > epsilon && t1 < 1 - epsilon) {
        results.push({
          x: p1.x + t1 * dx,
          y: p1.y + t1 * dy,
        });
      }

      // Deuxième solution (si discriminant > 0)
      if (discriminant > 0.0001) {
        const t2 = (-b + sqrtDisc) / (2 * a);
        if (t2 > epsilon && t2 < 1 - epsilon) {
          results.push({
            x: p1.x + t2 * dx,
            y: p1.y + t2 * dy,
          });
        }
      }

      return results;
    },
    [],
  );

  // Créer les intersections entre un cercle et tous les segments existants
  const createCircleIntersections = useCallback(
    (
      circleId: string,
      circleCenter: { x: number; y: number },
      circleCenterId: string,
      circleRadius: number,
      layerId: string | undefined,
      sketchToModify: { points: Map<string, Point>; geometries: Map<string, Geometry> },
    ): void => {
      // Collecter toutes les intersections avec les segments
      const allIntersectionPoints: Array<{ x: number; y: number; angle: number; pointId?: string }> = [];
      const lineIntersections: Array<{ lineId: string; points: Array<{ x: number; y: number }> }> = [];

      sketchToModify.geometries.forEach((geo, lineId) => {
        if (geo.type !== "line") return;

        const line = geo as Line;
        const p1 = sketchToModify.points.get(line.p1);
        const p2 = sketchToModify.points.get(line.p2);
        if (!p1 || !p2) return;

        const pts = circleSegmentIntersection(circleCenter, circleRadius, p1, p2);
        if (pts.length > 0) {
          lineIntersections.push({ lineId, points: pts });
          // Ajouter à la liste globale pour couper le cercle
          for (const pt of pts) {
            const angle = Math.atan2(pt.y - circleCenter.y, pt.x - circleCenter.x);
            allIntersectionPoints.push({ ...pt, angle });
          }
        }
      });

      // Si pas d'intersection, ne rien faire
      if (allIntersectionPoints.length === 0) return;

      // 1. Couper les segments
      for (const { lineId, points } of lineIntersections) {
        const line = sketchToModify.geometries.get(lineId) as Line;
        if (!line) continue;

        const p1 = sketchToModify.points.get(line.p1);
        if (!p1) continue;

        const sortedPoints = points.sort((a, b) => {
          const distA = (a.x - p1.x) ** 2 + (a.y - p1.y) ** 2;
          const distB = (b.x - p1.x) ** 2 + (b.y - p1.y) ** 2;
          return distA - distB;
        });

        let currentLineId = lineId;
        for (const pt of sortedPoints) {
          const currentLine = sketchToModify.geometries.get(currentLineId) as Line;
          if (!currentLine) continue;

          // Chercher si ce point existe déjà
          let intersectPoint: Point | undefined;
          for (const ip of allIntersectionPoints) {
            if (Math.abs(ip.x - pt.x) < 0.01 && Math.abs(ip.y - pt.y) < 0.01 && ip.pointId) {
              intersectPoint = sketchToModify.points.get(ip.pointId);
              break;
            }
          }

          if (!intersectPoint) {
            intersectPoint = { id: generateId(), x: pt.x, y: pt.y };
            sketchToModify.points.set(intersectPoint.id, intersectPoint);
            // Mettre à jour le pointId dans allIntersectionPoints
            for (const ip of allIntersectionPoints) {
              if (Math.abs(ip.x - pt.x) < 0.01 && Math.abs(ip.y - pt.y) < 0.01) {
                ip.pointId = intersectPoint.id;
                break;
              }
            }
          }

          const newLine: Line = {
            id: generateId(),
            type: "line",
            p1: intersectPoint.id,
            p2: currentLine.p2,
            layerId: currentLine.layerId,
          };
          sketchToModify.geometries.set(newLine.id, newLine);

          sketchToModify.geometries.set(currentLineId, {
            ...currentLine,
            p2: intersectPoint.id,
          });

          currentLineId = newLine.id;
        }
      }

      // 2. Couper le cercle en arcs
      // S'assurer que tous les points d'intersection ont un pointId
      for (const ip of allIntersectionPoints) {
        if (!ip.pointId) {
          const pt: Point = { id: generateId(), x: ip.x, y: ip.y };
          sketchToModify.points.set(pt.id, pt);
          ip.pointId = pt.id;
        }
      }

      // Trier les points par angle
      allIntersectionPoints.sort((a, b) => a.angle - b.angle);

      // Supprimer le cercle original
      sketchToModify.geometries.delete(circleId);

      // Créer des arcs entre chaque paire de points consécutifs
      // Les arcs vont dans le sens des angles croissants (sens horaire dans canvas = counterClockwise: false)
      for (let i = 0; i < allIntersectionPoints.length; i++) {
        const startPt = allIntersectionPoints[i];
        const endPt = allIntersectionPoints[(i + 1) % allIntersectionPoints.length];

        if (!startPt.pointId || !endPt.pointId) continue;

        const arc: Arc = {
          id: generateId(),
          type: "arc",
          center: circleCenterId,
          startPoint: startPt.pointId,
          endPoint: endPt.pointId,
          radius: circleRadius,
          layerId: layerId,
          counterClockwise: false, // Sens horaire pour dessiner l'arc "direct" entre les deux points
        };
        sketchToModify.geometries.set(arc.id, arc);
      }
    },
    [circleSegmentIntersection],
  );

  // Intersection de deux segments (retourne le point si les segments se croisent vraiment)
  const segmentIntersection = useCallback(
    (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number },
      p4: { x: number; y: number },
    ): { x: number; y: number } | null => {
      const d1x = p2.x - p1.x;
      const d1y = p2.y - p1.y;
      const d2x = p4.x - p3.x;
      const d2y = p4.y - p3.y;

      const cross = d1x * d2y - d1y * d2x;
      if (Math.abs(cross) < 0.0001) return null; // Segments parallèles

      const t1 = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / cross;
      const t2 = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / cross;

      // Vérifier que l'intersection est dans les deux segments (pas aux extrémités)
      const epsilon = 0.01; // Marge pour éviter les extrémités
      if (t1 > epsilon && t1 < 1 - epsilon && t2 > epsilon && t2 < 1 - epsilon) {
        return {
          x: p1.x + t1 * d1x,
          y: p1.y + t1 * d1y,
        };
      }
      return null;
    },
    [],
  );

  // Trouver et créer les intersections entre un nouveau segment et tous les segments existants
  const createIntersectionPoints = useCallback(
    (newLineId: string, sketchToModify: { points: Map<string, Point>; geometries: Map<string, Geometry> }): void => {
      const newLine = sketchToModify.geometries.get(newLineId) as Line | undefined;
      if (!newLine || newLine.type !== "line") return;

      const newP1 = sketchToModify.points.get(newLine.p1);
      const newP2 = sketchToModify.points.get(newLine.p2);
      if (!newP1 || !newP2) return;

      // Collecter les intersections avec tous les autres segments
      const intersections: { lineId: string; point: { x: number; y: number } }[] = [];

      sketchToModify.geometries.forEach((geo, lineId) => {
        if (lineId === newLineId) return; // Ne pas tester avec soi-même
        if (geo.type !== "line") return;

        const line = geo as Line;
        const p1 = sketchToModify.points.get(line.p1);
        const p2 = sketchToModify.points.get(line.p2);
        if (!p1 || !p2) return;

        // Vérifier si les segments partagent déjà un point
        if (newLine.p1 === line.p1 || newLine.p1 === line.p2 || newLine.p2 === line.p1 || newLine.p2 === line.p2) {
          return; // Déjà connectés
        }

        const intersection = segmentIntersection(newP1, newP2, p1, p2);
        if (intersection) {
          intersections.push({ lineId, point: intersection });
        }
      });

      // Pour chaque intersection, couper les deux segments
      for (const { lineId, point } of intersections) {
        // Créer le point d'intersection
        const intersectPoint: Point = { id: generateId(), x: point.x, y: point.y };
        sketchToModify.points.set(intersectPoint.id, intersectPoint);

        // Couper le segment existant
        const existingLine = sketchToModify.geometries.get(lineId) as Line;
        if (existingLine) {
          // Créer la deuxième partie du segment existant
          // IMPORTANT: Copier toutes les propriétés
          const newExistingLine: Line = {
            id: generateId(),
            type: "line",
            p1: intersectPoint.id,
            p2: existingLine.p2,
            layerId: existingLine.layerId,
            strokeWidth: existingLine.strokeWidth,
            strokeColor: existingLine.strokeColor,
            isConstruction: existingLine.isConstruction,
          };
          sketchToModify.geometries.set(newExistingLine.id, newExistingLine);

          // Modifier le segment existant pour finir au point d'intersection
          sketchToModify.geometries.set(lineId, {
            ...existingLine,
            p2: intersectPoint.id,
          });
        }

        // Couper le nouveau segment
        const currentNewLine = sketchToModify.geometries.get(newLineId) as Line;
        if (currentNewLine) {
          // Créer la deuxième partie du nouveau segment
          // IMPORTANT: Copier toutes les propriétés
          const newNewLine: Line = {
            id: generateId(),
            type: "line",
            p1: intersectPoint.id,
            p2: currentNewLine.p2,
            layerId: currentNewLine.layerId,
            strokeWidth: currentNewLine.strokeWidth,
            strokeColor: currentNewLine.strokeColor,
            isConstruction: currentNewLine.isConstruction,
          };
          sketchToModify.geometries.set(newNewLine.id, newNewLine);

          // Modifier le nouveau segment pour finir au point d'intersection
          sketchToModify.geometries.set(newLineId, {
            ...currentNewLine,
            p2: intersectPoint.id,
          });
        }
      }
    },
    [segmentIntersection],
  );

  // Modifier le rayon d'un arc existant (recalcul complet du congé)
  const updateArcRadius = useCallback(
    (arcId: string, newRadius: number) => {
      const arc = sketch.geometries.get(arcId) as Arc | undefined;
      if (!arc || arc.type !== "arc") return;

      const centerPt = sketch.points.get(arc.center);
      const startPt = sketch.points.get(arc.startPoint);
      const endPt = sketch.points.get(arc.endPoint);

      if (!centerPt || !startPt || !endPt) return;

      // Trouver les lignes connectées aux points de tangence
      const linesAtStart = findLinesConnectedToPoint(arc.startPoint);
      const linesAtEnd = findLinesConnectedToPoint(arc.endPoint);

      if (linesAtStart.length !== 1 || linesAtEnd.length !== 1) {
        toast.error("Impossible de modifier: structure de congé invalide");
        return;
      }

      const line1 = linesAtStart[0];
      const line2 = linesAtEnd[0];

      // Trouver les autres extrémités des lignes
      const other1Id = line1.p1 === arc.startPoint ? line1.p2 : line1.p1;
      const other2Id = line2.p1 === arc.endPoint ? line2.p2 : line2.p1;

      const other1 = sketch.points.get(other1Id);
      const other2 = sketch.points.get(other2Id);

      if (!other1 || !other2) return;

      // Calculer le coin original (intersection des lignes prolongées)
      const corner = lineIntersection(startPt, other1, endPt, other2);
      if (!corner) {
        toast.error("Lignes parallèles, impossible de recalculer");
        return;
      }

      // Recalculer le congé avec le nouveau rayon
      const vec1 = { x: other1.x - corner.x, y: other1.y - corner.y };
      const vec2 = { x: other2.x - corner.x, y: other2.y - corner.y };

      const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

      const u1 = { x: vec1.x / len1, y: vec1.y / len1 };
      const u2 = { x: vec2.x / len2, y: vec2.y / len2 };

      // Angle entre les lignes
      const dot = u1.x * u2.x + u1.y * u2.y;
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
      const halfAngle = angleRad / 2;

      // Distance du coin aux nouveaux points de tangence
      const tangentDist = newRadius / Math.tan(halfAngle);

      // Vérifier que le rayon n'est pas trop grand
      const distToOther1 = distance(corner, other1);
      const distToOther2 = distance(corner, other2);

      if (tangentDist > distToOther1 * 0.9 || tangentDist > distToOther2 * 0.9) {
        toast.error("Rayon trop grand pour ces lignes");
        return;
      }

      // Nouveaux points de tangence
      const newTan1 = { x: corner.x + u1.x * tangentDist, y: corner.y + u1.y * tangentDist };
      const newTan2 = { x: corner.x + u2.x * tangentDist, y: corner.y + u2.y * tangentDist };

      // Calculer le centre sur la bissectrice
      const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
      const bisectorLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);

      if (bisectorLen < 0.001) {
        toast.error("Lignes parallèles");
        return;
      }

      const bisectorNorm = { x: bisector.x / bisectorLen, y: bisector.y / bisectorLen };
      const centerDist = newRadius / Math.sin(halfAngle);

      // Deux centres possibles
      const centerA = {
        x: corner.x + bisectorNorm.x * centerDist,
        y: corner.y + bisectorNorm.y * centerDist,
      };
      const centerB = {
        x: corner.x - bisectorNorm.x * centerDist,
        y: corner.y - bisectorNorm.y * centerDist,
      };

      // Choisir le centre qui est à distance R des deux tangentes
      const distAToTan1 = Math.sqrt((centerA.x - newTan1.x) ** 2 + (centerA.y - newTan1.y) ** 2);
      const distAToTan2 = Math.sqrt((centerA.x - newTan2.x) ** 2 + (centerA.y - newTan2.y) ** 2);
      const distBToTan1 = Math.sqrt((centerB.x - newTan1.x) ** 2 + (centerB.y - newTan1.y) ** 2);
      const distBToTan2 = Math.sqrt((centerB.x - newTan2.x) ** 2 + (centerB.y - newTan2.y) ** 2);

      const errorA = Math.abs(distAToTan1 - newRadius) + Math.abs(distAToTan2 - newRadius);
      const errorB = Math.abs(distBToTan1 - newRadius) + Math.abs(distBToTan2 - newRadius);

      const newCenter = errorA < errorB ? centerA : centerB;

      // Mettre à jour le sketch
      const newSketch = { ...sketch };
      newSketch.points = new Map(sketch.points);
      newSketch.geometries = new Map(sketch.geometries);

      // Mettre à jour les points
      newSketch.points.set(arc.startPoint, { ...startPt, x: newTan1.x, y: newTan1.y });
      newSketch.points.set(arc.endPoint, { ...endPt, x: newTan2.x, y: newTan2.y });
      newSketch.points.set(arc.center, { ...centerPt, x: newCenter.x, y: newCenter.y });

      // Mettre à jour l'arc
      newSketch.geometries.set(arcId, { ...arc, radius: newRadius });

      setSketch(newSketch);
      addToHistory(newSketch);
      toast.success(`Rayon modifié: R${newRadius}mm`);
    },
    [sketch, findLinesConnectedToPoint, lineIntersection, addToHistory],
  );

  // Modifier la longueur d'une ligne
  const applyLineLengthChange = useCallback(
    (lineId: string, newLengthMm: number, anchorMode: "p1" | "p2" | "center", saveToHistory: boolean = true) => {
      // Utiliser sketchRef.current pour éviter les closures stales
      const currentSketch = sketchRef.current;
      const line = currentSketch.geometries.get(lineId) as Line | undefined;
      if (!line || line.type !== "line") return;

      const p1 = currentSketch.points.get(line.p1);
      const p2 = currentSketch.points.get(line.p2);
      if (!p1 || !p2) return;

      const newLengthPx = newLengthMm * currentSketch.scaleFactor;
      const currentLength = distance(p1, p2);

      if (currentLength < 0.001) return;

      // Vecteur direction normalisé
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const ux = dx / currentLength;
      const uy = dy / currentLength;

      const newSketch = { ...currentSketch };
      newSketch.points = new Map(currentSketch.points);

      if (anchorMode === "p1") {
        // P1 fixe, P2 bouge
        const newP2 = {
          ...p2,
          x: p1.x + ux * newLengthPx,
          y: p1.y + uy * newLengthPx,
        };
        newSketch.points.set(line.p2, newP2);
      } else if (anchorMode === "p2") {
        // P2 fixe, P1 bouge
        const newP1 = {
          ...p1,
          x: p2.x - ux * newLengthPx,
          y: p2.y - uy * newLengthPx,
        };
        newSketch.points.set(line.p1, newP1);
      } else {
        // Symétrique depuis le centre
        const centerX = (p1.x + p2.x) / 2;
        const centerY = (p1.y + p2.y) / 2;
        const halfLength = newLengthPx / 2;

        const newP1 = {
          ...p1,
          x: centerX - ux * halfLength,
          y: centerY - uy * halfLength,
        };
        const newP2 = {
          ...p2,
          x: centerX + ux * halfLength,
          y: centerY + uy * halfLength,
        };
        newSketch.points.set(line.p1, newP1);
        newSketch.points.set(line.p2, newP2);
      }

      setSketch(newSketch);
      if (saveToHistory) {
        addToHistory(newSketch);
        toast.success(`Longueur modifiée: ${newLengthMm.toFixed(1)} mm`);
      }
    },
    [addToHistory],
  );

  // Modifier un angle entre deux lignes
  const applyAngleChange = useCallback(
    (
      pointId: string,
      line1Id: string,
      line2Id: string,
      newAngleDeg: number,
      anchorMode: "line1" | "line2" | "symmetric",
      saveToHistory: boolean = true,
    ) => {
      // Utiliser sketchRef.current pour éviter les closures stales
      const currentSketch = sketchRef.current;
      const point = currentSketch.points.get(pointId);
      const line1 = currentSketch.geometries.get(line1Id) as Line | undefined;
      const line2 = currentSketch.geometries.get(line2Id) as Line | undefined;

      if (!point || !line1 || !line2) return;

      // Trouver les autres extrémités
      const other1Id = line1.p1 === pointId ? line1.p2 : line1.p1;
      const other2Id = line2.p1 === pointId ? line2.p2 : line2.p1;
      const other1 = currentSketch.points.get(other1Id);
      const other2 = currentSketch.points.get(other2Id);

      if (!other1 || !other2) return;

      // Longueurs actuelles
      const len1 = distance(point, other1);
      const len2 = distance(point, other2);

      if (len1 < 0.001 || len2 < 0.001) return;

      // Angles actuels
      const angle1 = Math.atan2(other1.y - point.y, other1.x - point.x);
      const angle2 = Math.atan2(other2.y - point.y, other2.x - point.x);

      // Angle actuel entre les deux lignes
      let currentDelta = angle2 - angle1;
      while (currentDelta > Math.PI) currentDelta -= 2 * Math.PI;
      while (currentDelta < -Math.PI) currentDelta += 2 * Math.PI;

      const newAngleRad = (newAngleDeg * Math.PI) / 180;
      // Garder le même signe que l'angle actuel
      const signedNewAngle = currentDelta >= 0 ? newAngleRad : -newAngleRad;
      const angleDiff = signedNewAngle - currentDelta;

      const newSketch = { ...currentSketch };
      newSketch.points = new Map(currentSketch.points);

      if (anchorMode === "line1") {
        // Line1 fixe, on tourne line2
        const newAngle2 = angle1 + signedNewAngle;
        const newOther2 = {
          ...other2,
          x: point.x + Math.cos(newAngle2) * len2,
          y: point.y + Math.sin(newAngle2) * len2,
        };
        newSketch.points.set(other2Id, newOther2);
      } else if (anchorMode === "line2") {
        // Line2 fixe, on tourne line1
        const newAngle1 = angle2 - signedNewAngle;
        const newOther1 = {
          ...other1,
          x: point.x + Math.cos(newAngle1) * len1,
          y: point.y + Math.sin(newAngle1) * len1,
        };
        newSketch.points.set(other1Id, newOther1);
      } else {
        // Symétrique: les deux lignes bougent de la même quantité
        const halfDiff = angleDiff / 2;

        const newAngle1 = angle1 - halfDiff;
        const newAngle2 = angle2 + halfDiff;

        const newOther1 = {
          ...other1,
          x: point.x + Math.cos(newAngle1) * len1,
          y: point.y + Math.sin(newAngle1) * len1,
        };
        const newOther2 = {
          ...other2,
          x: point.x + Math.cos(newAngle2) * len2,
          y: point.y + Math.sin(newAngle2) * len2,
        };

        newSketch.points.set(other1Id, newOther1);
        newSketch.points.set(other2Id, newOther2);
      }

      setSketch(newSketch);
      if (saveToHistory) {
        addToHistory(newSketch);
        toast.success(`Angle modifié: ${newAngleDeg.toFixed(1)}°`);
      }
    },
    [addToHistory],
  );

  // Supprimer un congé et restaurer le coin
  const removeFilletAndRestoreCorner = useCallback(
    (arcId: string) => {
      const arc = sketch.geometries.get(arcId) as Arc | undefined;
      if (!arc || arc.type !== "arc") return;

      const startPt = sketch.points.get(arc.startPoint);
      const endPt = sketch.points.get(arc.endPoint);

      if (!startPt || !endPt) return;

      // Trouver les lignes connectées
      const linesAtStart = findLinesConnectedToPoint(arc.startPoint);
      const linesAtEnd = findLinesConnectedToPoint(arc.endPoint);

      if (linesAtStart.length !== 1 || linesAtEnd.length !== 1) {
        // Pas un congé standard, supprimer simplement l'arc
        const newSketch = { ...sketch };
        newSketch.geometries = new Map(sketch.geometries);
        newSketch.geometries.delete(arcId);
        setSketch(newSketch);
        addToHistory(newSketch);
        return;
      }

      const line1 = linesAtStart[0];
      const line2 = linesAtEnd[0];

      // Trouver les autres extrémités
      const other1Id = line1.p1 === arc.startPoint ? line1.p2 : line1.p1;
      const other2Id = line2.p1 === arc.endPoint ? line2.p2 : line2.p1;

      const other1 = sketch.points.get(other1Id);
      const other2 = sketch.points.get(other2Id);

      if (!other1 || !other2) return;

      // Calculer le coin (intersection des lignes prolongées)
      const corner = lineIntersection(startPt, other1, endPt, other2);
      if (!corner) {
        toast.error("Impossible de restaurer le coin");
        return;
      }

      const newSketch = { ...sketch };
      newSketch.points = new Map(sketch.points);
      newSketch.geometries = new Map(sketch.geometries);

      // Créer le point de coin
      const cornerId = generateId();
      newSketch.points.set(cornerId, { id: cornerId, x: corner.x, y: corner.y });

      // Modifier les lignes pour pointer vers le coin
      const updatedLine1: Line = {
        ...line1,
        p1: line1.p1 === arc.startPoint ? cornerId : line1.p1,
        p2: line1.p2 === arc.startPoint ? cornerId : line1.p2,
      };
      const updatedLine2: Line = {
        ...line2,
        p1: line2.p1 === arc.endPoint ? cornerId : line2.p1,
        p2: line2.p2 === arc.endPoint ? cornerId : line2.p2,
      };

      newSketch.geometries.set(line1.id, updatedLine1);
      newSketch.geometries.set(line2.id, updatedLine2);

      // Supprimer l'arc et ses points
      newSketch.geometries.delete(arcId);
      newSketch.points.delete(arc.startPoint);
      newSketch.points.delete(arc.endPoint);
      newSketch.points.delete(arc.center);

      setSketch(newSketch);
      addToHistory(newSketch);
      toast.success("Congé supprimé, coin restauré");
    },
    [sketch, findLinesConnectedToPoint, lineIntersection, addToHistory],
  );

  // Création du rectangle avec les dimensions saisies ou le curseur
  const createRectangleFromInputs = useCallback(
    (clickPos?: { x: number; y: number }, inputValues?: { width: string; height: string }) => {
      if (tempPoints.length === 0 || !tempGeometry?.p1) return;

      const p1 = tempPoints[0];
      const currentSketch = sketchRef.current;
      const isCenter = tempGeometry.mode === "center";

      // Utiliser la position du clic si fournie, sinon le curseur stocké
      const cursorPos = clickPos || tempGeometry.cursor;

      // Déterminer les dimensions
      let width: number;
      let height: number;

      // Si des valeurs sont passées en paramètre, les utiliser, sinon lire le state
      const widthStr = inputValues?.width ?? rectInputs.widthValue;
      const heightStr = inputValues?.height ?? rectInputs.heightValue;

      const inputWidth = parseFloat(widthStr.replace(",", "."));
      const inputHeight = parseFloat(heightStr.replace(",", "."));

      if (!isNaN(inputWidth) && inputWidth > 0) {
        width = inputWidth * currentSketch.scaleFactor; // Convertir mm en px
      } else if (cursorPos) {
        if (isCenter) {
          // Mode centre: width = 2 * distance horizontale au curseur
          width = Math.abs(cursorPos.x - p1.x) * 2;
        } else {
          width = Math.abs(cursorPos.x - p1.x);
        }
      } else {
        return; // Pas de dimension valide
      }

      if (!isNaN(inputHeight) && inputHeight > 0) {
        height = inputHeight * currentSketch.scaleFactor; // Convertir mm en px
      } else if (cursorPos) {
        if (isCenter) {
          // Mode centre: height = 2 * distance verticale au curseur
          height = Math.abs(cursorPos.y - p1.y) * 2;
        } else {
          height = Math.abs(cursorPos.y - p1.y);
        }
      } else {
        return; // Pas de dimension valide
      }

      // Calculer les 4 coins selon le mode
      let corner1: Point, corner2: Point, corner3: Point, corner4: Point;

      if (isCenter) {
        // Mode centre: p1 est le centre du rectangle
        const halfW = width / 2;
        const halfH = height / 2;

        // Déterminer la direction (basée sur le curseur)
        let dirX = 1;
        let dirY = 1;
        if (cursorPos) {
          dirX = cursorPos.x >= p1.x ? 1 : -1;
          dirY = cursorPos.y >= p1.y ? 1 : -1;
        }

        // Coins dans l'ordre: haut-gauche, haut-droite, bas-droite, bas-gauche
        corner1 = { id: generateId(), x: p1.x - halfW, y: p1.y - halfH };
        corner2 = { id: generateId(), x: p1.x + halfW, y: p1.y - halfH };
        corner3 = { id: generateId(), x: p1.x + halfW, y: p1.y + halfH };
        corner4 = { id: generateId(), x: p1.x - halfW, y: p1.y + halfH };
      } else {
        // Mode coin: p1 est un coin
        // Déterminer la direction (basée sur le curseur ou par défaut vers le bas-droite)
        let dirX = 1;
        let dirY = 1;
        if (cursorPos) {
          dirX = cursorPos.x >= p1.x ? 1 : -1;
          dirY = cursorPos.y >= p1.y ? 1 : -1;
        }

        // Calculer les 4 coins
        const p3 = { x: p1.x + width * dirX, y: p1.y + height * dirY };
        corner1 = p1;
        corner2 = { id: generateId(), x: p3.x, y: p1.y };
        corner3 = { id: generateId(), x: p3.x, y: p3.y };
        corner4 = { id: generateId(), x: p1.x, y: p3.y };
      }

      // Créer le sketch
      const newSketch = { ...currentSketch };
      newSketch.points = new Map(currentSketch.points);
      newSketch.geometries = new Map(currentSketch.geometries);
      newSketch.constraints = new Map(currentSketch.constraints);

      newSketch.points.set(corner1.id, corner1);
      newSketch.points.set(corner2.id, corner2);
      newSketch.points.set(corner3.id, corner3);
      newSketch.points.set(corner4.id, corner4);

      // Créer les 4 lignes avec le calque actif et l'épaisseur de trait
      console.log("[CAD] Creating rectangle with strokeWidth:", defaultStrokeWidthRef.current);
      const lines = [
        {
          id: generateId(),
          type: "line" as const,
          p1: corner1.id,
          p2: corner2.id,
          layerId: currentSketch.activeLayerId,
          strokeWidth: defaultStrokeWidthRef.current,
          strokeColor: defaultStrokeColorRef.current,
          isConstruction: isConstructionModeRef.current,
        },
        {
          id: generateId(),
          type: "line" as const,
          p1: corner2.id,
          p2: corner3.id,
          layerId: currentSketch.activeLayerId,
          strokeWidth: defaultStrokeWidthRef.current,
          strokeColor: defaultStrokeColorRef.current,
          isConstruction: isConstructionModeRef.current,
        },
        {
          id: generateId(),
          type: "line" as const,
          p1: corner3.id,
          p2: corner4.id,
          layerId: currentSketch.activeLayerId,
          strokeWidth: defaultStrokeWidthRef.current,
          strokeColor: defaultStrokeColorRef.current,
          isConstruction: isConstructionModeRef.current,
        },
        {
          id: generateId(),
          type: "line" as const,
          p1: corner4.id,
          p2: corner1.id,
          layerId: currentSketch.activeLayerId,
          strokeWidth: defaultStrokeWidthRef.current,
          strokeColor: defaultStrokeColorRef.current,
          isConstruction: isConstructionModeRef.current,
        },
      ];

      console.log(
        "[CAD] Lines created:",
        lines.map((l) => ({ id: l.id.slice(0, 8), strokeWidth: l.strokeWidth })),
      );

      lines.forEach((l) => newSketch.geometries.set(l.id, l));

      // Mode centre: ajouter le point central et les diagonales de construction
      if (isCenter) {
        // Calculer le centre exact à partir des 4 coins
        const centerX = (corner1.x + corner2.x + corner3.x + corner4.x) / 4;
        const centerY = (corner1.y + corner2.y + corner3.y + corner4.y) / 4;

        // Créer le point central explicitement (pour le snap)
        const centerPointId = generateId();
        const centerPoint: Point = {
          id: centerPointId,
          x: centerX,
          y: centerY,
        };
        newSketch.points.set(centerPointId, centerPoint);

        // Créer les 4 demi-diagonales (connectées au centre)
        const diagonal1a: Line = {
          id: generateId(),
          type: "line",
          p1: corner1.id,
          p2: centerPointId,
          layerId: currentSketch.activeLayerId,
          strokeWidth: defaultStrokeWidthRef.current,
          strokeColor: "#888888",
          isConstruction: true,
        };
        const diagonal1b: Line = {
          id: generateId(),
          type: "line",
          p1: centerPointId,
          p2: corner3.id,
          layerId: currentSketch.activeLayerId,
          strokeWidth: defaultStrokeWidthRef.current,
          strokeColor: "#888888",
          isConstruction: true,
        };
        const diagonal2a: Line = {
          id: generateId(),
          type: "line",
          p1: corner2.id,
          p2: centerPointId,
          layerId: currentSketch.activeLayerId,
          strokeWidth: defaultStrokeWidthRef.current,
          strokeColor: "#888888",
          isConstruction: true,
        };
        const diagonal2b: Line = {
          id: generateId(),
          type: "line",
          p1: centerPointId,
          p2: corner4.id,
          layerId: currentSketch.activeLayerId,
          strokeWidth: defaultStrokeWidthRef.current,
          strokeColor: "#888888",
          isConstruction: true,
        };

        newSketch.geometries.set(diagonal1a.id, diagonal1a);
        newSketch.geometries.set(diagonal1b.id, diagonal1b);
        newSketch.geometries.set(diagonal2a.id, diagonal2a);
        newSketch.geometries.set(diagonal2b.id, diagonal2b);
      }

      // Détecter et créer les points d'intersection pour les côtés
      for (const line of lines) {
        createIntersectionPoints(line.id, newSketch);
      }

      // Ajouter contraintes horizontales/verticales
      newSketch.constraints.set(generateId(), { id: generateId(), type: "horizontal", entities: [lines[0].id] });
      newSketch.constraints.set(generateId(), { id: generateId(), type: "horizontal", entities: [lines[2].id] });
      newSketch.constraints.set(generateId(), { id: generateId(), type: "vertical", entities: [lines[1].id] });
      newSketch.constraints.set(generateId(), { id: generateId(), type: "vertical", entities: [lines[3].id] });

      // MOD v7.31: Ajouter cotations automatiques pour le rectangle (avec contraintes pour l'interactivité)
      newSketch.dimensions = new Map(currentSketch.dimensions);
      const autoDimsResults = addRectangleDimensions(corner1.id, corner2.id, corner3.id, corner4.id, newSketch);
      autoDimsResults.forEach(({ dimension, constraint }) => {
        newSketch.dimensions.set(dimension.id, dimension);
        newSketch.constraints.set(constraint.id, constraint);
      });

      const wMm = width / currentSketch.scaleFactor;
      const hMm = height / currentSketch.scaleFactor;
      const modeLabel = isCenter ? " (centre)" : "";

      setSketch(newSketch);
      solveSketch(newSketch);
      addToHistory(newSketch, `Rectangle ${wMm.toFixed(1)}×${hMm.toFixed(1)}mm${modeLabel}`);

      // Reset
      setTempPoints([]);
      setTempGeometry(null);
      setRectInputs({
        active: false,
        widthValue: "",
        heightValue: "",
        activeField: "width",
        editingWidth: false,
        editingHeight: false,
        widthInputPos: { x: 0, y: 0 },
        heightInputPos: { x: 0, y: 0 },
      });

      toast.success(`Rectangle ${wMm.toFixed(1)} × ${hMm.toFixed(1)} mm${modeLabel}`);
    },
    [tempPoints, tempGeometry, rectInputs, createIntersectionPoints, solveSketch, addToHistory, addRectangleDimensions],
  );

  // === Multi-photos: détection de clic sur une image ===
  // v7.35: Ajout paramètre includeLocked pour permettre le menu contextuel sur images verrouillées
  const findImageAtPosition = useCallback(
    (worldX: number, worldY: number, includeLocked: boolean = false): BackgroundImage | null => {
      // Chercher dans l'ordre inverse (les images du dessus d'abord)
      const sortedImages = [...backgroundImages]
        .filter((img) => {
          // Vérifier que l'image est visible
          if (!img.visible) return false;
          // Vérifier le verrouillage (sauf si includeLocked est true)
          if (!includeLocked && img.locked) return false;
          // Vérifier que le calque de l'image est visible
          if (img.layerId) {
            const layer = sketch.layers.get(img.layerId);
            if (layer && !layer.visible) return false;
          }
          return true;
        })
        .sort((a, b) => b.order - a.order);

      for (const bgImage of sortedImages) {
        const imageToDraw = bgImage.transformedCanvas || bgImage.image;
        // FIX #85c: Vérifier que l'image existe
        if (!imageToDraw) continue;

        const width = imageToDraw instanceof HTMLCanvasElement ? imageToDraw.width : imageToDraw.width;
        const height = imageToDraw instanceof HTMLCanvasElement ? imageToDraw.height : imageToDraw.height;
        const scaledWidth = width * bgImage.scale;
        const scaledHeight = height * bgImage.scale;

        // Vérifier si le point est dans le rectangle de l'image
        const left = bgImage.x - scaledWidth / 2;
        const right = bgImage.x + scaledWidth / 2;
        const top = bgImage.y - scaledHeight / 2;
        const bottom = bgImage.y + scaledHeight / 2;

        if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
          return bgImage;
        }
      }
      return null;
    },
    [backgroundImages, sketch.layers],
  );

  // v7.35: Sélectionner une image ET changer automatiquement vers son calque
  const selectImageAndSwitchLayer = useCallback(
    (imageId: string | null) => {
      setSelectedImageId(imageId);

      // Si on sélectionne une image, changer vers son calque
      if (imageId) {
        const image = backgroundImages.find((img) => img.id === imageId);
        if (image?.layerId && sketch.layers.has(image.layerId)) {
          setSketch((prev) => ({ ...prev, activeLayerId: image.layerId! }));
        }
      }
    },
    [backgroundImages, sketch.layers, setSketch],
  );

  // Mémoriser l'image sélectionnée et ses ajustements pour le panneau
  const selectedImageData = useMemo(() => {
    if (!selectedImageId) return null;
    const img = backgroundImages.find((img) => img.id === selectedImageId);
    if (!img) return null;
    return {
      image: img,
      adjustments: img.adjustments || DEFAULT_IMAGE_ADJUSTMENTS,
    };
  }, [backgroundImages, selectedImageId]);

  // Collecter tous les markers de toutes les images comme points de snap additionnels
  const markerSnapPoints = useMemo((): AdditionalSnapPoint[] => {
    const points: AdditionalSnapPoint[] = [];
    for (const img of backgroundImages) {
      if (!img.markers) continue;
      for (const marker of img.markers) {
        // Convertir en coordonnées monde
        const worldX = img.x + marker.relativeX;
        const worldY = img.y + marker.relativeY;
        points.push({
          x: worldX,
          y: worldY,
          type: "marker",
          label: `${marker.label} (${img.name})`,
          entityId: `marker-${img.id}-${marker.id}`,
          priority: 0, // Priorité maximale
        });
      }
    }
    return points;
  }, [backgroundImages]);

  // Appliquer les ajustements d'image (contraste, luminosité, etc.) via manipulation de pixels
  const applyImageAdjustments = useCallback(
    (sourceImage: HTMLImageElement | HTMLCanvasElement, adjustments: ImageAdjustments): HTMLCanvasElement => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        console.error("Impossible de créer le contexte 2D");
        return canvas;
      }

      const width = sourceImage.width;
      const height = sourceImage.height;
      canvas.width = width;
      canvas.height = height;

      // Dessiner l'image source d'abord
      ctx.drawImage(sourceImage, 0, 0, width, height);

      // Récupérer les données de pixels
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Précalculer les facteurs
      const contrastFactor = adjustments.contrast / 100;
      const brightnessFactor = adjustments.brightness / 100;
      const saturateFactor = adjustments.saturate / 100;
      const sharpenFactor = adjustments.sharpen / 100;
      const doGrayscale = adjustments.grayscale;
      const doInvert = adjustments.invert;

      // Appliquer les transformations pixel par pixel
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        // Alpha reste inchangé: data[i + 3]

        // 1. Luminosité
        if (brightnessFactor !== 1) {
          r = r * brightnessFactor;
          g = g * brightnessFactor;
          b = b * brightnessFactor;
        }

        // 2. Contraste (autour de 128)
        if (contrastFactor !== 1) {
          r = (r - 128) * contrastFactor + 128;
          g = (g - 128) * contrastFactor + 128;
          b = (b - 128) * contrastFactor + 128;
        }

        // 3. Saturation
        if (saturateFactor !== 1) {
          const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
          r = gray + saturateFactor * (r - gray);
          g = gray + saturateFactor * (g - gray);
          b = gray + saturateFactor * (b - gray);
        }

        // 4. Noir et blanc
        if (doGrayscale) {
          const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
          r = g = b = gray;
        }

        // 5. Inversion
        if (doInvert) {
          r = 255 - r;
          g = 255 - g;
          b = 255 - b;
        }

        // Clamper les valeurs
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
      }

      // Appliquer le sharpen si nécessaire (kernel convolution)
      if (sharpenFactor > 0 && width > 2 && height > 2) {
        const tempData = new Uint8ClampedArray(data);
        const kernel = [
          0,
          -sharpenFactor,
          0,
          -sharpenFactor,
          1 + 4 * sharpenFactor,
          -sharpenFactor,
          0,
          -sharpenFactor,
          0,
        ];

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            for (let c = 0; c < 3; c++) {
              let sum = 0;
              for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                  const kidx = ((y + ky) * width + (x + kx)) * 4 + c;
                  sum += tempData[kidx] * kernel[(ky + 1) * 3 + (kx + 1)];
                }
              }
              data[idx + c] = Math.max(0, Math.min(255, sum));
            }
          }
        }
      }

      // Remettre les données modifiées
      ctx.putImageData(imageData, 0, 0);

      return canvas;
    },
    [],
  );

  // Mettre à jour les ajustements de l'image sélectionnée
  const updateSelectedImageAdjustments = useCallback(
    (adjustments: Partial<ImageAdjustments>) => {
      if (!selectedImageId) return;

      setBackgroundImages((prev) =>
        prev.map((img) => {
          if (img.id !== selectedImageId) return img;

          const currentAdjustments = img.adjustments || { ...DEFAULT_IMAGE_ADJUSTMENTS };
          const newAdjustments = { ...currentAdjustments, ...adjustments };

          // MOD v80.17: Utiliser le canvas le plus récent comme source
          // Priorité : croppedCanvas > transformedCanvas > image
          const sourceImage = img.croppedCanvas || img.transformedCanvas || img.image;

          // Vérifier que l'image source est valide
          if (!sourceImage || (sourceImage instanceof HTMLImageElement && !sourceImage.complete)) {
            return img;
          }

          // Générer le canvas ajusté
          const adjustedCanvas = applyImageAdjustments(sourceImage, newAdjustments);

          return {
            ...img,
            adjustments: newAdjustments,
            adjustedCanvas,
          };
        }),
      );
    },
    [selectedImageId, applyImageAdjustments],
  );

  // Réinitialiser les ajustements de l'image sélectionnée
  const resetImageAdjustments = useCallback(() => {
    if (!selectedImageId) return;

    setBackgroundImages((prev) =>
      prev.map((img) => {
        if (img.id !== selectedImageId) return img;
        return {
          ...img,
          adjustments: { ...DEFAULT_IMAGE_ADJUSTMENTS },
          adjustedCanvas: undefined,
        };
      }),
    );
    toast.success("Ajustements réinitialisés");
  }, [selectedImageId]);

  // Mettre à jour la rotation de l'image sélectionnée (ou des images multi-sélectionnées)
  // MOD v80.3: Support de la multi-sélection pour rotation par lot
  const updateSelectedImageRotation = useCallback(
    (rotation: number) => {
      // Si multi-sélection active, appliquer le delta à toutes les images
      if (selectedImageIds.size > 0) {
        // Calculer le delta par rapport à la première image sélectionnée
        const firstSelectedId = Array.from(selectedImageIds)[0];
        const firstImg = backgroundImages.find((i) => i.id === firstSelectedId);
        const currentRotation = firstImg?.rotation || 0;
        const delta = rotation - currentRotation;

        // Normaliser le delta
        let normalizedDelta = delta % 360;
        if (normalizedDelta > 180) normalizedDelta -= 360;
        if (normalizedDelta < -180) normalizedDelta += 360;

        // Sauvegarder l'état actuel pour undo
        addToImageHistoryRef.current(backgroundImagesRef.current, markerLinksRef.current);

        setBackgroundImages((prev) =>
          prev.map((img) => {
            if (!selectedImageIds.has(img.id)) return img;
            let newRotation = (img.rotation || 0) + normalizedDelta;
            // Normaliser entre -180 et 180
            newRotation = newRotation % 360;
            if (newRotation > 180) newRotation -= 360;
            if (newRotation < -180) newRotation += 360;
            return {
              ...img,
              rotation: newRotation,
            };
          }),
        );
        return;
      }

      // Sélection unique (comportement original)
      if (!selectedImageId) return;

      // Normaliser la rotation entre -180 et 180
      let normalizedRotation = rotation % 360;
      if (normalizedRotation > 180) normalizedRotation -= 360;
      if (normalizedRotation < -180) normalizedRotation += 360;

      // Sauvegarder l'état actuel pour undo AVANT la modification
      addToImageHistoryRef.current(backgroundImagesRef.current, markerLinksRef.current);

      setBackgroundImages((prev) =>
        prev.map((img) => {
          if (img.id !== selectedImageId) return img;
          return {
            ...img,
            rotation: normalizedRotation,
          };
        }),
      );
    },
    [selectedImageId, selectedImageIds, backgroundImages],
  );

  // Obtenir la rotation de l'image sélectionnée (ou de la première image multi-sélectionnée)
  // MOD v80.3: Support de la multi-sélection
  const getSelectedImageRotation = useCallback(() => {
    // Si multi-sélection, retourner la rotation de la première image
    if (selectedImageIds.size > 0) {
      const firstSelectedId = Array.from(selectedImageIds)[0];
      const img = backgroundImages.find((i) => i.id === firstSelectedId);
      return img?.rotation || 0;
    }
    // Sélection unique
    if (!selectedImageId) return 0;
    const img = backgroundImages.find((i) => i.id === selectedImageId);
    return img?.rotation || 0;
  }, [selectedImageId, selectedImageIds, backgroundImages]);

  // Ouvrir le dialogue de crop pour l'image sélectionnée
  const openCropDialog = useCallback(() => {
    if (!selectedImageId) return;

    const img = backgroundImages.find((i) => i.id === selectedImageId);
    if (!img) return;

    // Initialiser la sélection avec le crop existant ou 100%
    if (img.crop) {
      setCropSelection({ ...img.crop });
    } else {
      setCropSelection({ x: 0, y: 0, width: 100, height: 100 });
    }

    setShowCropDialog(true);
  }, [selectedImageId, backgroundImages]);

  // Appliquer le crop à l'image sélectionnée
  const applyCrop = useCallback(() => {
    if (!selectedImageId) {
      console.error("[CROP] No image selected");
      return;
    }

    console.log("[CROP] Applying crop to image:", selectedImageId);
    console.log("[CROP] Crop selection:", cropSelection);

    setBackgroundImages((prev) => {
      const newImages = prev.map((img) => {
        if (img.id !== selectedImageId) return img;

        // Créer le canvas croppé - utiliser l'image originale pour le crop
        const sourceImage = img.adjustedCanvas || img.image;
        const srcWidth = sourceImage.width;
        const srcHeight = sourceImage.height;

        console.log("[CROP] Source image size:", srcWidth, "x", srcHeight);

        // Calculer les coordonnées en pixels
        const cropX = Math.round((cropSelection.x / 100) * srcWidth);
        const cropY = Math.round((cropSelection.y / 100) * srcHeight);
        const cropW = Math.round((cropSelection.width / 100) * srcWidth);
        const cropH = Math.round((cropSelection.height / 100) * srcHeight);

        console.log("[CROP] Crop coords:", { cropX, cropY, cropW, cropH });

        if (cropW <= 0 || cropH <= 0) {
          console.error("[CROP] Invalid crop dimensions");
          return img;
        }

        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = cropW;
        croppedCanvas.height = cropH;
        const ctx = croppedCanvas.getContext("2d");
        if (!ctx) {
          console.error("[CROP] Could not get canvas context");
          return img;
        }

        ctx.drawImage(sourceImage, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        // FIX v7.33: Calculer le décalage pour garder la position visuelle
        // Le centre de l'image originale était à (0, 0) en coordonnées locales
        // Le centre de la zone croppée est à (cropX + cropW/2, cropY + cropH/2) dans l'image originale
        // Le décalage en coordonnées monde = (centre crop - centre original) * scale
        const originalCenterX = srcWidth / 2;
        const originalCenterY = srcHeight / 2;
        const cropCenterX = cropX + cropW / 2;
        const cropCenterY = cropY + cropH / 2;

        // Décalage en pixels de l'image source, puis converti en coordonnées monde via le scale
        const offsetX = (cropCenterX - originalCenterX) * img.scale;
        const offsetY = (cropCenterY - originalCenterY) * img.scale;

        console.log("[CROP] Position adjustment:", { offsetX, offsetY });
        console.log("[CROP] Old position:", { x: img.x, y: img.y });
        console.log("[CROP] New position:", { x: img.x + offsetX, y: img.y + offsetY });

        // Retourner un nouvel objet avec le croppedCanvas et la position ajustée
        const newImg = {
          ...img,
          x: img.x + offsetX,
          y: img.y + offsetY,
          crop: { ...cropSelection },
          croppedCanvas: croppedCanvas,
        };

        console.log("[CROP] New image has croppedCanvas:", !!newImg.croppedCanvas);

        return newImg;
      });

      console.log("[CROP] Updated images array, length:", newImages.length);
      return newImages;
    });

    setShowCropDialog(false);
    toast.success("Recadrage appliqué");
  }, [selectedImageId, cropSelection]);

  // Réinitialiser le crop
  const resetCrop = useCallback(() => {
    if (!selectedImageId) return;

    setBackgroundImages((prev) =>
      prev.map((img) => {
        if (img.id !== selectedImageId) return img;
        return {
          ...img,
          crop: undefined,
          croppedCanvas: undefined,
        };
      }),
    );

    setCropSelection({ x: 0, y: 0, width: 100, height: 100 });
    toast.success("Recadrage réinitialisé");
  }, [selectedImageId]);

  // === GIZMO DE TRANSFORMATION ===

  // Démarrer une transformation (appelé quand on clique sur une flèche du gizmo)
  const startGizmoTransform = useCallback(
    (mode: "translateX" | "translateY" | "rotate") => {
      if (!selectionGizmoData) return;

      // Sauvegarder les positions initiales de tous les points
      const initialPositions = new Map<string, { x: number; y: number }>();
      for (const pointId of selectionGizmoData.pointIds) {
        const pt = sketch.points.get(pointId);
        if (pt) {
          initialPositions.set(pointId, { x: pt.x, y: pt.y });
        }
      }

      setTransformGizmo({
        active: true,
        mode,
        inputValue: "0",
        initialPositions,
        center: selectionGizmoData.center,
      });

      // Focus sur l'input après un court délai
      setTimeout(() => {
        transformInputRef.current?.focus();
        transformInputRef.current?.select();
      }, 50);
    },
    [selectionGizmoData, sketch.points],
  );

  // Appliquer la transformation en temps réel (appelé à chaque changement de l'input)
  const applyGizmoTransform = useCallback(
    (value: string) => {
      if (!transformGizmo.active || transformGizmo.mode === "idle") return;

      const numValue = parseFloat(value) || 0;
      const scaleFactor = sketch.scaleFactor || 1; // px/mm

      setSketch((prev) => {
        const newSketch = { ...prev };
        newSketch.points = new Map(prev.points);

        if (transformGizmo.mode === "translateX" || transformGizmo.mode === "translateY") {
          // Translation en mm → convertir en px
          const deltaPx = numValue * scaleFactor;

          for (const [pointId, initialPos] of transformGizmo.initialPositions) {
            const newX = transformGizmo.mode === "translateX" ? initialPos.x + deltaPx : initialPos.x;
            const newY = transformGizmo.mode === "translateY" ? initialPos.y + deltaPx : initialPos.y;
            newSketch.points.set(pointId, { id: pointId, x: newX, y: newY });
          }
        } else if (transformGizmo.mode === "rotate") {
          // Rotation en degrés autour du centre
          const angleRad = (numValue * Math.PI) / 180;
          const cos = Math.cos(angleRad);
          const sin = Math.sin(angleRad);
          const cx = transformGizmo.center.x;
          const cy = transformGizmo.center.y;

          for (const [pointId, initialPos] of transformGizmo.initialPositions) {
            // Rotation autour du centre
            const dx = initialPos.x - cx;
            const dy = initialPos.y - cy;
            const newX = cx + dx * cos - dy * sin;
            const newY = cy + dx * sin + dy * cos;
            newSketch.points.set(pointId, { id: pointId, x: newX, y: newY });
          }
        }

        return newSketch;
      });

      setTransformGizmo((prev) => ({ ...prev, inputValue: value }));
    },
    [transformGizmo, sketch.scaleFactor],
  );

  // Valider la transformation (Entrée)
  const confirmGizmoTransform = useCallback(() => {
    if (!transformGizmo.active) return;

    const modeLabel =
      transformGizmo.mode === "translateX"
        ? "Déplacement X"
        : transformGizmo.mode === "translateY"
          ? "Déplacement Y"
          : "Rotation";
    addToHistory(sketch, `${modeLabel} (clavier)`);
    setTransformGizmo({
      active: false,
      mode: "idle",
      inputValue: "",
      initialPositions: new Map(),
      center: { x: 0, y: 0 },
    });

    toast.success(`Transformation ${modeLabel} appliquée`);
  }, [transformGizmo, sketch, addToHistory]);

  // Annuler la transformation (Échap)
  const cancelGizmoTransform = useCallback(() => {
    if (!transformGizmo.active) return;

    // Restaurer les positions initiales
    setSketch((prev) => {
      const newSketch = { ...prev };
      newSketch.points = new Map(prev.points);

      for (const [pointId, initialPos] of transformGizmo.initialPositions) {
        newSketch.points.set(pointId, { id: pointId, x: initialPos.x, y: initialPos.y });
      }

      return newSketch;
    });

    setTransformGizmo({
      active: false,
      mode: "idle",
      inputValue: "",
      initialPositions: new Map(),
      center: { x: 0, y: 0 },
    });

    toast.info("Transformation annulée");
  }, [transformGizmo]);

  // === DRAG DU GIZMO ===

  // Démarrer le drag du gizmo
  const startGizmoDrag = useCallback(
    (mode: "translateX" | "translateY" | "rotate", worldPos: { x: number; y: number }) => {
      if (!selectionGizmoData) return;

      // Sauvegarder les positions initiales
      const initialPositions = new Map<string, { x: number; y: number }>();
      for (const pointId of selectionGizmoData.pointIds) {
        const pt = sketch.points.get(pointId);
        if (pt) {
          initialPositions.set(pointId, { x: pt.x, y: pt.y });
        }
      }

      // Pour la rotation, calculer l'angle initial
      const startAngle =
        mode === "rotate"
          ? Math.atan2(worldPos.y - selectionGizmoData.center.y, worldPos.x - selectionGizmoData.center.x)
          : 0;

      setGizmoDrag({
        active: true,
        mode,
        startPos: worldPos,
        startAngle,
        currentValue: 0,
        initialPositions,
        center: selectionGizmoData.center,
      });

      // Note: l'historique sera sauvegardé à la fin du drag (endGizmoDrag)
    },
    [selectionGizmoData, sketch],
  );

  // Mettre à jour pendant le drag (avec throttle pour fluidité)
  const updateGizmoDrag = useCallback(
    (worldPos: { x: number; y: number }) => {
      if (!gizmoDrag) return;

      // Stocker la position en attente
      pendingGizmoDragPosRef.current = worldPos;

      // Si une frame est déjà planifiée, ne rien faire
      if (gizmoDragRAFRef.current !== null) return;

      // Planifier la mise à jour sur la prochaine frame
      gizmoDragRAFRef.current = requestAnimationFrame(() => {
        gizmoDragRAFRef.current = null;
        const pos = pendingGizmoDragPosRef.current;
        if (!pos || !gizmoDragRef.current) return;

        const currentGizmoDrag = gizmoDragRef.current;
        const scaleFactor = sketchRef.current.scaleFactor || 1;
        let currentValue = 0;

        setSketch((prev) => {
          const newSketch = { ...prev };
          newSketch.points = new Map(prev.points);

          if (currentGizmoDrag.mode === "translateX") {
            const deltaPx = pos.x - currentGizmoDrag.startPos.x;
            currentValue = deltaPx / scaleFactor;
            for (const [pointId, initialPos] of currentGizmoDrag.initialPositions) {
              newSketch.points.set(pointId, { id: pointId, x: initialPos.x + deltaPx, y: initialPos.y });
            }
          } else if (currentGizmoDrag.mode === "translateY") {
            const deltaPx = currentGizmoDrag.startPos.y - pos.y;
            currentValue = deltaPx / scaleFactor;
            for (const [pointId, initialPos] of currentGizmoDrag.initialPositions) {
              newSketch.points.set(pointId, { id: pointId, x: initialPos.x, y: initialPos.y - deltaPx });
            }
          } else if (currentGizmoDrag.mode === "rotate") {
            const currentAngle = Math.atan2(pos.y - currentGizmoDrag.center.y, pos.x - currentGizmoDrag.center.x);
            const deltaAngle = currentAngle - currentGizmoDrag.startAngle;
            currentValue = (deltaAngle * 180) / Math.PI;

            const cos = Math.cos(deltaAngle);
            const sin = Math.sin(deltaAngle);
            const cx = currentGizmoDrag.center.x;
            const cy = currentGizmoDrag.center.y;

            for (const [pointId, initialPos] of currentGizmoDrag.initialPositions) {
              const dx = initialPos.x - cx;
              const dy = initialPos.y - cy;
              const newX = cx + dx * cos - dy * sin;
              const newY = cy + dx * sin + dy * cos;
              newSketch.points.set(pointId, { id: pointId, x: newX, y: newY });
            }
          }

          return newSketch;
        });

        setGizmoDrag((prev) => (prev ? { ...prev, currentValue } : null));
      });
    },
    [gizmoDrag],
  );

  // Terminer le drag
  const endGizmoDrag = useCallback(() => {
    if (!gizmoDrag) return;

    // Sauvegarder l'état AVANT le drag dans l'historique
    // (pour que Ctrl+Z restaure l'état d'avant le déplacement)
    const sketchBeforeDrag = { ...sketchRef.current };
    sketchBeforeDrag.points = new Map(sketchRef.current.points);
    // Restaurer les positions initiales dans la copie
    for (const [pointId, initialPos] of gizmoDrag.initialPositions) {
      sketchBeforeDrag.points.set(pointId, { id: pointId, x: initialPos.x, y: initialPos.y });
    }

    const modeLabel =
      gizmoDrag.mode === "translateX"
        ? "Déplacement X"
        : gizmoDrag.mode === "translateY"
          ? "Déplacement Y"
          : "Rotation";
    const value =
      gizmoDrag.mode === "rotate" ? `${gizmoDrag.currentValue.toFixed(1)}°` : `${gizmoDrag.currentValue.toFixed(1)} mm`;

    addToHistory(sketchBeforeDrag, `${modeLabel} ${value}`);

    toast.success(`${modeLabel}: ${value}`);
    // Cleanup RAF
    if (gizmoDragRAFRef.current !== null) {
      cancelAnimationFrame(gizmoDragRAFRef.current);
      gizmoDragRAFRef.current = null;
    }
    pendingGizmoDragPosRef.current = null;
    setGizmoDrag(null);
  }, [gizmoDrag, addToHistory]);

  // Annuler le drag (Échap)
  const cancelGizmoDrag = useCallback(() => {
    if (!gizmoDrag) return;

    // Restaurer les positions initiales
    setSketch((prev) => {
      const newSketch = { ...prev };
      newSketch.points = new Map(prev.points);

      for (const [pointId, initialPos] of gizmoDrag.initialPositions) {
        newSketch.points.set(pointId, { id: pointId, x: initialPos.x, y: initialPos.y });
      }

      return newSketch;
    });

    // Cleanup RAF
    if (gizmoDragRAFRef.current !== null) {
      cancelAnimationFrame(gizmoDragRAFRef.current);
      gizmoDragRAFRef.current = null;
    }
    pendingGizmoDragPosRef.current = null;
    setGizmoDrag(null);
    toast.info("Déplacement annulé");
  }, [gizmoDrag]);

  // Gestion de la souris
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Ignorer si on est en train de drag le rideau reveal (utiliser ref pour éviter stale closure)
      if (isDraggingRevealRef.current) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = screenToWorld(screenX, screenY);

      // === PRIORITÉ ABSOLUE: Mode selectRect pour calibration ===
      // Ce mode doit être traité en premier, avant tout le reste
      if (calibrationMode === "selectRect") {
        const tolerance = 20 / viewport.scale; // Tolérance plus grande pour faciliter la sélection
        let closestPoint: CalibrationPoint | null = null;
        let closestDist = Infinity;

        // Utiliser les points de l'image sélectionnée (multi-photos) ou les points globaux
        const imageCalib = getSelectedImageCalibration();
        const pointsToCheck = imageCalib.points.size > 0 ? imageCalib.points : calibrationData.points;

        pointsToCheck.forEach((point) => {
          // Convertir en coordonnées monde si c'est un point d'image (relatif)
          let worldPtX = point.x;
          let worldPtY = point.y;

          // FIX #85d: Si on utilise les points de l'image, ils sont relatifs au centre de l'image
          // et normalisés à scale=1, donc multiplier par le scale
          if (imageCalib.points.size > 0 && selectedImageId) {
            const img = backgroundImages.find((i) => i.id === selectedImageId);
            if (img) {
              const imgScale = img.scale || 1;
              worldPtX = img.x + point.x * imgScale;
              worldPtY = img.y + point.y * imgScale;
            }
          }

          const d = distance(worldPos, { x: worldPtX, y: worldPtY });
          if (d < tolerance && d < closestDist) {
            closestDist = d;
            closestPoint = point;
          }
        });

        if (closestPoint) {
          // Vérifier que le point n'est pas déjà sélectionné
          if (rectPoints.includes(closestPoint.id)) {
            toast.error("Point déjà sélectionné");
            return;
          }

          const newRectPoints = [...rectPoints, closestPoint.id];
          setRectPoints(newRectPoints);

          if (newRectPoints.length < 4) {
            toast.info(`Point ${closestPoint.label} sélectionné (${newRectPoints.length}/4)`);
          } else {
            toast.success("4 points sélectionnés ! Cliquez sur Calculer l'échelle.");
            setCalibrationMode("idle");
          }
        } else {
          toast.error("Cliquez sur un point de calibration (cercle rouge)");
        }
        return; // IMPORTANT: Ne pas continuer avec les autres handlers
      }

      // === Gestion de la grille A4 ===
      if (showA4Grid && e.button === 0) {
        // Vérifier si on clique sur l'origine (pour la déplacer)
        const originScreenX = a4GridOrigin.x * viewport.scale + viewport.offsetX;
        const originScreenY = a4GridOrigin.y * viewport.scale + viewport.offsetY;
        const distToOrigin = Math.sqrt((screenX - originScreenX) ** 2 + (screenY - originScreenY) ** 2);

        if (distToOrigin < 15) {
          // Commencer le drag de l'origine
          setIsDraggingA4Origin(true);
          return;
        }

        // Sinon vérifier si on clique sur une cellule
        // Avec chevauchement, utiliser les dimensions de contenu (pas fullPage)
        const contentWidthMm = (a4GridOrientation === "portrait" ? A4_WIDTH_MM : A4_HEIGHT_MM) - a4OverlapMm;
        const contentHeightMm = (a4GridOrientation === "portrait" ? A4_HEIGHT_MM : A4_WIDTH_MM) - a4OverlapMm;
        const contentWidthPx = contentWidthMm * sketch.scaleFactor;
        const contentHeightPx = contentHeightMm * sketch.scaleFactor;
        const contentWidthScreen = contentWidthPx * viewport.scale;
        const contentHeightScreen = contentHeightPx * viewport.scale;

        // Calculer la cellule cliquée
        const relX = screenX - originScreenX;
        const relY = screenY - originScreenY;

        if (relX >= 0 && relY >= 0) {
          const col = Math.floor(relX / contentWidthScreen);
          const row = Math.floor(relY / contentHeightScreen);

          if (col >= 0 && col < a4GridCols && row >= 0 && row < a4GridRows) {
            const cellKey = `${row}-${col}`;
            setSelectedA4Cells((prev) => {
              const newSet = new Set(prev);
              if (newSet.has(cellKey)) {
                newSet.delete(cellKey);
              } else {
                newSet.add(cellKey);
              }
              return newSet;
            });
            return;
          }
        }
      }

      // Pan avec clic milieu / Double-clic molette = recentrer
      if (e.button === 1) {
        const now = Date.now();
        const timeSinceLastClick = now - lastMiddleClickRef.current;
        lastMiddleClickRef.current = now;

        // Double-clic molette (< 400ms) = ajuster au contenu
        if (timeSinceLastClick < 400) {
          // Calculer les limites du contenu
          let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
          let hasContent = false;

          sketch.geometries.forEach((geo) => {
            if (geo.type === "line") {
              const line = geo as Line;
              const p1 = sketch.points.get(line.p1);
              const p2 = sketch.points.get(line.p2);
              if (p1 && p2) {
                minX = Math.min(minX, p1.x, p2.x);
                maxX = Math.max(maxX, p1.x, p2.x);
                minY = Math.min(minY, p1.y, p2.y);
                maxY = Math.max(maxY, p1.y, p2.y);
                hasContent = true;
              }
            } else if (geo.type === "circle") {
              const circle = geo as CircleType;
              const center = sketch.points.get(circle.center);
              if (center) {
                minX = Math.min(minX, center.x - circle.radius);
                maxX = Math.max(maxX, center.x + circle.radius);
                minY = Math.min(minY, center.y - circle.radius);
                maxY = Math.max(maxY, center.y + circle.radius);
                hasContent = true;
              }
            } else if (geo.type === "arc") {
              const arc = geo as Arc;
              const center = sketch.points.get(arc.center);
              const startPt = sketch.points.get(arc.startPoint);
              const endPt = sketch.points.get(arc.endPoint);
              if (center && startPt && endPt) {
                minX = Math.min(minX, startPt.x, endPt.x, center.x - arc.radius);
                maxX = Math.max(maxX, startPt.x, endPt.x, center.x + arc.radius);
                minY = Math.min(minY, startPt.y, endPt.y, center.y - arc.radius);
                maxY = Math.max(maxY, startPt.y, endPt.y, center.y + arc.radius);
                hasContent = true;
              }
            }
          });

          if (hasContent && isFinite(minX) && isFinite(maxX) && isFinite(minY) && isFinite(maxY)) {
            const rulerSize = 32;
            const contentWidth = maxX - minX;
            const contentHeight = maxY - minY;
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            const availableWidth = viewport.width - rulerSize - 40;
            const availableHeight = viewport.height - rulerSize - 40;

            const scaleX = availableWidth / Math.max(contentWidth, 1);
            const scaleY = availableHeight / Math.max(contentHeight, 1);
            const newScale = Math.min(scaleX, scaleY, 10); // Max zoom = 10

            setViewport((prev) => ({
              ...prev,
              scale: newScale,
              offsetX: (prev.width + rulerSize) / 2 - centerX * newScale,
              offsetY: (prev.height + rulerSize) / 2 - centerY * newScale,
            }));

            toast.success("Vue ajustée au contenu");
          } else {
            // Pas de contenu, reset à la vue par défaut
            const rulerSize = 32;
            setViewport((v) => ({
              ...v,
              offsetX: rulerSize,
              offsetY: rulerSize,
              scale: 4,
            }));
            toast.info("Vue réinitialisée");
          }
          return;
        }

        // Simple clic = pan
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      // Clic droit = annuler le tracé en cours et passer en sélection
      if (e.button === 2) {
        setTempPoints([]);
        setTempGeometry(null);
        // Reset de la mesure en cours
        setMeasureState({
          phase: "idle",
          start: null,
          end: null,
          result: null,
          segment1Id: null,
        });
        setMeasurePreviewEnd(null);
        // Effacer toutes les mesures
        setMeasurements([]);
        setActiveTool("select");
        return;
      }

      // À partir d'ici, c'est un clic gauche (e.button === 0)

      // === Gizmo de transformation : détection des clics sur les flèches (drag) ===
      if (showTransformGizmo && selectionGizmoData && activeTool === "select" && !transformGizmo.active && !gizmoDrag) {
        const center = selectionGizmoData.center;
        const arrowLength = 50 / viewport.scale;
        const rotationRadius = 30 / viewport.scale;
        const hitTolerance = 12 / viewport.scale;

        // Flèche X (vers la droite, commence à 8px du centre)
        if (
          worldPos.x >= center.x + 5 / viewport.scale &&
          worldPos.x <= center.x + arrowLength + 10 / viewport.scale &&
          Math.abs(worldPos.y - center.y) < hitTolerance
        ) {
          startGizmoDrag("translateX", worldPos);
          return;
        }

        // Flèche Y (vers le haut = Y négatif, commence à 8px du centre)
        if (
          worldPos.y <= center.y - 5 / viewport.scale &&
          worldPos.y >= center.y - arrowLength - 10 / viewport.scale &&
          Math.abs(worldPos.x - center.x) < hitTolerance
        ) {
          startGizmoDrag("translateY", worldPos);
          return;
        }

        // Arc de rotation (arc en haut, entre 0.15π et 0.85π)
        const distToCenter = Math.sqrt((worldPos.x - center.x) ** 2 + (worldPos.y - center.y) ** 2);
        const angleToMouse = Math.atan2(worldPos.y - center.y, worldPos.x - center.x);
        // Vérifier si on est sur l'arc (entre 0.15π et 0.85π, donc en haut)
        if (
          Math.abs(distToCenter - rotationRadius) < hitTolerance &&
          angleToMouse >= Math.PI * 0.1 &&
          angleToMouse <= Math.PI * 0.9
        ) {
          startGizmoDrag("rotate", worldPos);
          return;
        }
      }

      // === Marqueurs inter-photos ===
      if (markerMode === "addMarker" && backgroundImages.length > 0) {
        // Trouver l'image sous le curseur
        const clickedImage = findImageAtPosition(worldPos.x, worldPos.y);
        if (clickedImage) {
          // Calculer la position relative au centre de l'image
          const relativeX = worldPos.x - clickedImage.x;
          const relativeY = worldPos.y - clickedImage.y;

          // Créer un nouveau marqueur
          const markerCount = clickedImage.markers.length;
          const newMarker: ImageMarker = {
            id: generateId(),
            label: String.fromCharCode(65 + markerCount), // A, B, C, ...
            relativeX,
            relativeY,
            color: MARKER_COLORS[markerCount % MARKER_COLORS.length],
          };

          // Ajouter le marqueur à l'image
          setBackgroundImages((prev) =>
            prev.map((img) => (img.id === clickedImage.id ? { ...img, markers: [...img.markers, newMarker] } : img)),
          );

          toast.success(`Marqueur ${newMarker.label} ajouté sur ${clickedImage.name}`);
          return;
        } else {
          toast.error("Cliquez sur une photo pour ajouter un marqueur");
          return;
        }
      }

      // === Lier deux marqueurs avec distance ===
      if (markerMode === "linkMarker1" || markerMode === "linkMarker2") {
        // Trouver le marqueur sous le curseur
        const tolerance = 15 / viewport.scale;
        let foundMarker: { imageId: string; markerId: string; marker: ImageMarker } | null = null;

        for (const img of backgroundImages) {
          if (!img.visible) continue;
          for (const marker of img.markers) {
            const markerWorldX = img.x + marker.relativeX;
            const markerWorldY = img.y + marker.relativeY;
            const dist = distance(worldPos, { x: markerWorldX, y: markerWorldY });
            if (dist < tolerance) {
              foundMarker = { imageId: img.id, markerId: marker.id, marker };
              break;
            }
          }
          if (foundMarker) break;
        }

        if (foundMarker) {
          if (markerMode === "linkMarker1") {
            // Premier marqueur sélectionné
            setPendingLink({ imageId: foundMarker.imageId, markerId: foundMarker.markerId });
            setMarkerMode("linkMarker2");
            toast.info(`Marqueur ${foundMarker.marker.label} sélectionné. Cliquez sur le 2ème marqueur.`);
          } else if (markerMode === "linkMarker2" && pendingLink) {
            // Vérifier que ce n'est pas le même marqueur
            if (pendingLink.imageId === foundMarker.imageId && pendingLink.markerId === foundMarker.markerId) {
              toast.error("Sélectionnez un marqueur différent");
              return;
            }
            // Vérifier que c'est une photo différente
            if (pendingLink.imageId === foundMarker.imageId) {
              toast.error("Sélectionnez un marqueur sur une autre photo");
              return;
            }
            // Ouvrir la boîte de dialogue pour saisir la distance
            setLinkDistanceDialog({
              open: true,
              marker1: pendingLink,
              marker2: { imageId: foundMarker.imageId, markerId: foundMarker.markerId },
              distance: "",
            });
            setMarkerMode("idle");
            setPendingLink(null);
          }
          return;
        } else {
          toast.error("Cliquez sur un marqueur existant");
          return;
        }
      }

      // === Multi-photos: vérifier si on clique sur une image (en mode select) ===
      // IMPORTANT: Ne pas intercepter si on est en mode calibration actif (addPoint, selectPair, etc.)
      // Note: selectRect est déjà traité en priorité au début de handleMouseDown
      const isCalibrationActive = calibrationMode !== "idle";

      // === Sélection et drag des marqueurs ===
      if (activeTool === "select" && markerMode === "idle" && !isCalibrationActive) {
        // Chercher un marker sous le curseur
        const tolerance = 15 / viewport.scale;
        let foundMarker: { imageId: string; markerId: string; marker: ImageMarker; image: BackgroundImage } | null =
          null;

        for (const img of backgroundImages) {
          if (!img.visible) continue;
          for (const marker of img.markers) {
            const markerWorldX = img.x + marker.relativeX;
            const markerWorldY = img.y + marker.relativeY;
            const dist = distance(worldPos, { x: markerWorldX, y: markerWorldY });
            if (dist < tolerance) {
              foundMarker = { imageId: img.id, markerId: marker.id, marker, image: img };
              break;
            }
          }
          if (foundMarker) break;
        }

        if (foundMarker) {
          // Sélectionner le marker
          const markerFullId = `${foundMarker.imageId}:${foundMarker.markerId}`;
          setSelectedMarkerId(markerFullId);
          // v7.35: Changer automatiquement vers le calque de l'image
          selectImageAndSwitchLayer(foundMarker.imageId);

          // Désélectionner les entités géométriques
          setSelectedEntities(new Set());

          // Commencer le drag du marker SEULEMENT si l'image n'est pas verrouillée
          if (!foundMarker.image.locked) {
            setDraggingMarker({
              imageId: foundMarker.imageId,
              markerId: foundMarker.markerId,
              startPos: worldPos,
            });
          }

          return;
        }
      }

      if (activeTool === "select" && backgroundImages.length > 0 && markerMode === "idle" && !isCalibrationActive) {
        // IMPORTANT: Si le panneau de calibration est ouvert, vérifier d'abord les points de calibration
        // Ils ont la priorité sur tout le reste
        if (showCalibrationPanel && calibrationMode === "idle") {
          const selectedImage = getSelectedImage();
          if (selectedImage) {
            const imageCalib = selectedImage.calibrationData || { points: new Map() };
            const tolerance = 15 / viewport.scale;
            let clickedCalibPoint: CalibrationPoint | null = null;

            // FIX #85d: Convertir la position du clic en coordonnées relatives à l'image (normalisées à scale=1)
            const imgScale = selectedImage.scale || 1;
            const relativeX = (worldPos.x - selectedImage.x) / imgScale;
            const relativeY = (worldPos.y - selectedImage.y) / imgScale;
            // La tolérance doit aussi être divisée par le scale
            const toleranceNormalized = tolerance / imgScale;

            imageCalib.points.forEach((point: CalibrationPoint) => {
              const d = distance({ x: relativeX, y: relativeY }, point);
              if (d < toleranceNormalized) {
                clickedCalibPoint = point;
              }
            });

            if (clickedCalibPoint) {
              setDraggingCalibrationPoint(clickedCalibPoint.id);
              setSelectedEntities(new Set());
              return; // Ne pas continuer - drag du point de calibration
            }
          }
        }

        // PRIORITÉ 2: Vérifier d'abord les poignées des entités sélectionnées
        // Ceci permet de drag les points d'extrémité des lignes
        if (selectedEntities.size > 0) {
          const handleHit = findHandleAtPosition(worldPos.x, worldPos.y);
          if (handleHit) {
            // Vérifier si le point est verrouillé
            if (handleHit.type === "point" && lockedPoints.has(handleHit.id)) {
              toast.error("Ce point est verrouillé");
              return;
            }
            // Vérifier si l'entité est sur un calque verrouillé
            if (isEntityOnLockedLayer(handleHit.id)) {
              toast.error("Cette entité est sur un calque verrouillé");
              return;
            }
            setIsDragging(true);
            setDragTarget(handleHit);
            setDragStart(worldPos);
            setLastDragPos(worldPos);
            return;
          }
        }

        // PRIORITÉ 3: Vérifier s'il y a une entité géométrique sous le curseur
        // Les entités ont la priorité sur les photos
        const entityUnderCursor = findEntityAtPosition(worldPos.x, worldPos.y);

        if (entityUnderCursor) {
          // Il y a une entité géométrique - la sélectionner directement ici
          // au lieu de laisser le switch case le faire (pour éviter que la photo intercepte)
          if (e.shiftKey) {
            const newSelection = new Set(selectedEntities);
            if (newSelection.has(entityUnderCursor)) {
              newSelection.delete(entityUnderCursor);
            } else {
              newSelection.add(entityUnderCursor);
            }
            setSelectedEntities(newSelection);
          } else {
            setSelectedEntities(new Set([entityUnderCursor]));
          }
          // Désélectionner photo et marker
          setSelectedImageId(null);
          setSelectedMarkerId(null);
          return; // IMPORTANT: ne pas continuer vers la photo
        } else {
          const clickedImage = findImageAtPosition(worldPos.x, worldPos.y);
          if (clickedImage) {
            // MOD v80.2 + v7.32: Gestion Ctrl+clic et Shift+clic pour multi-sélection d'images
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
              // Ctrl+clic ou Shift+clic : ajouter/retirer de la multi-sélection
              setSelectedImageIds((prev) => {
                const newSet = new Set(prev);
                if (newSet.has(clickedImage.id)) {
                  newSet.delete(clickedImage.id);
                } else {
                  newSet.add(clickedImage.id);
                }
                return newSet;
              });
              // Garder aussi selectedImageId sur la dernière image cliquée
              // v7.35: Changer automatiquement vers le calque de l'image
              selectImageAndSwitchLayer(clickedImage.id);
              setSelectedMarkerId(null);
              // Pas de drag en mode multi-sélection
              setSelectedEntities(new Set());
              return;
            }

            // Clic simple : sélection unique (efface la multi-sélection)
            // v7.35: Changer automatiquement vers le calque de l'image
            selectImageAndSwitchLayer(clickedImage.id);
            setSelectedImageIds(new Set()); // Effacer la multi-sélection
            setSelectedMarkerId(null); // Désélectionner le marker

            // Préparer le drag seulement si l'image n'est pas verrouillée
            if (!clickedImage.locked) {
              // Sauvegarder l'état actuel pour undo AVANT le drag
              addToImageHistoryRef.current(backgroundImagesRef.current, markerLinksRef.current);
              setIsDraggingImage(true);
              setImageDragStart({
                x: worldPos.x,
                y: worldPos.y,
                imgX: clickedImage.x,
                imgY: clickedImage.y,
              });
            }
            // Désélectionner les entités géométriques
            setSelectedEntities(new Set());
            return;
          } else {
            // Clic en dehors des images = désélectionner l'image, le marker ET la multi-sélection
            if (selectedImageId) {
              setSelectedImageId(null);
            }
            if (selectedMarkerId) {
              setSelectedMarkerId(null);
            }
            // MOD v80.2: Effacer aussi la multi-sélection
            if (selectedImageIds.size > 0) {
              setSelectedImageIds(new Set());
            }
          }
        }
      }

      // Vérifier si on clique sur un point de mesure pour le déplacer (outil mesure actif)
      if (activeTool === "measure" && measurements.length > 0) {
        const tolerance = 12 / viewport.scale;

        for (const m of measurements) {
          const distToStart = distance(worldPos, m.start);
          const distToEnd = distance(worldPos, m.end);

          if (distToStart < tolerance) {
            setDraggingMeasurePoint({ measureId: m.id, pointType: "start" });
            return;
          }
          if (distToEnd < tolerance) {
            setDraggingMeasurePoint({ measureId: m.id, pointType: "end" });
            return;
          }
        }
      }

      // Gestion des clics en mode calibration (sur l'image sélectionnée)
      if (calibrationMode === "addPoint") {
        const selectedImage = getSelectedImage();
        if (!selectedImage) {
          toast.error("Sélectionnez une photo à calibrer");
          setCalibrationMode("idle");
          return;
        }

        // FIX #85d: Stocker les coordonnées relatives à l'image, normalisées à scale=1
        // Ainsi les points restent au bon endroit même si le scale change
        const imgScale = selectedImage.scale || 1;
        const relativeX = (worldPos.x - selectedImage.x) / imgScale;
        const relativeY = (worldPos.y - selectedImage.y) / imgScale;

        const imageCalib = getSelectedImageCalibration();
        const newPoint: CalibrationPoint = {
          id: generateId(),
          x: relativeX,
          y: relativeY,
          label: String(imageCalib.points.size + 1),
        };

        updateSelectedImageCalibration((prev) => {
          const newPoints = new Map(prev.points);
          newPoints.set(newPoint.id, newPoint);
          return { ...prev, points: newPoints };
        });
        toast.success(`Point ${newPoint.label} ajouté sur ${selectedImage.name}`);
        return;
      }

      if (calibrationMode === "selectPair1" || calibrationMode === "selectPair2") {
        const selectedImage = getSelectedImage();
        if (!selectedImage) {
          toast.error("Sélectionnez une photo à calibrer");
          setCalibrationMode("idle");
          return;
        }

        const imageCalib = getSelectedImageCalibration();
        // Trouver le point de calibration le plus proche (coordonnées relatives à l'image)
        const tolerance = 15 / viewport.scale;
        let closestPoint: CalibrationPoint | null = null;
        let closestDist = Infinity;

        // FIX #85d: Convertir la position du clic en coordonnées relatives à l'image (normalisées à scale=1)
        const imgScale = selectedImage.scale || 1;
        const relativeX = (worldPos.x - selectedImage.x) / imgScale;
        const relativeY = (worldPos.y - selectedImage.y) / imgScale;
        const toleranceNormalized = tolerance / imgScale;

        imageCalib.points.forEach((point) => {
          const d = distance({ x: relativeX, y: relativeY }, point);
          if (d < toleranceNormalized && d < closestDist) {
            closestDist = d;
            closestPoint = point;
          }
        });

        if (closestPoint) {
          if (calibrationMode === "selectPair1") {
            setSelectedCalibrationPoint(closestPoint.id);
            setCalibrationMode("selectPair2");
            toast.info(`Point ${closestPoint.label} sélectionné. Cliquez sur le 2ème point.`);
          } else if (calibrationMode === "selectPair2" && selectedCalibrationPoint) {
            if (closestPoint.id === selectedCalibrationPoint) {
              toast.error("Sélectionnez un point différent");
              return;
            }
            // Créer la paire
            const p1 = imageCalib.points.get(selectedCalibrationPoint);
            const p2 = closestPoint;
            if (p1 && p2) {
              const distPx = distance(p1, p2);

              // Calculer la distance estimée en mm
              let estimatedMm: number;
              const userInput = parseFloat(newPairDistance.replace(",", "."));

              if (!isNaN(userInput) && userInput > 0) {
                // L'utilisateur a entré une valeur
                estimatedMm = userInput;
              } else if (imageCalib.pairs.size === 0) {
                // Première paire : utiliser l'échelle du sketch (scaleFactor est en px/mm)
                estimatedMm = Math.round((distPx / sketch.scaleFactor) * 10) / 10;
              } else {
                // Paires suivantes : moyenne des échelles précédentes (en mm/px)
                let totalScale = 0;
                let count = 0;
                imageCalib.pairs.forEach((pair) => {
                  const pp1 = imageCalib.points.get(pair.point1Id);
                  const pp2 = imageCalib.points.get(pair.point2Id);
                  if (pp1 && pp2 && pair.distanceMm > 0) {
                    const pairDistPx = distance(pp1, pp2);
                    totalScale += pair.distanceMm / pairDistPx; // mm/px
                    count++;
                  }
                });
                // avgScale est en mm/px, fallback: inverser scaleFactor (px/mm → mm/px)
                const avgScale = count > 0 ? totalScale / count : 1 / sketch.scaleFactor;
                estimatedMm = Math.round(distPx * avgScale * 10) / 10;
              }

              const newPair: CalibrationPair = {
                id: generateId(),
                point1Id: p1.id,
                point2Id: p2.id,
                distanceMm: estimatedMm,
                distancePx: distPx,
                color: newPairColor,
              };
              updateSelectedImageCalibration((prev) => {
                const newPairs = new Map(prev.pairs);
                newPairs.set(newPair.id, newPair);
                return { ...prev, pairs: newPairs };
              });
              toast.success(`Paire ${p1.label}-${p2.label} créée (${estimatedMm} mm estimé)`);
              // Reset le champ pour la prochaine paire
              setNewPairDistance("");
            }
            // MOD UX: Rester en mode création de paires (selectPair1) au lieu de idle
            setCalibrationMode("selectPair1");
            setSelectedCalibrationPoint(null);
            // Passer à la couleur suivante
            const currentIndex = CALIBRATION_COLORS.indexOf(newPairColor);
            setNewPairColor(CALIBRATION_COLORS[(currentIndex + 1) % CALIBRATION_COLORS.length]);
          }
        } else {
          toast.error("Cliquez sur un point de calibration");
        }
        return;
      }

      // Mode sélection rectangle pour perspective
      // Note: Le mode selectRect est maintenant traité en priorité au début de handleMouseDown

      // Pan avec outil main
      if (activeTool === "pan") {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      // Snap
      let targetPos = worldPos;
      if (snapEnabled && currentSnapPoint) {
        targetPos = { x: currentSnapPoint.x, y: currentSnapPoint.y };
      }

      switch (activeTool) {
        case "select": {
          // Vérifier d'abord si on clique sur une poignée d'une entité sélectionnée
          const handleHit = findHandleAtPosition(worldPos.x, worldPos.y);
          if (handleHit) {
            // Vérifier si le point est verrouillé
            if (handleHit.type === "point" && lockedPoints.has(handleHit.id)) {
              toast.error("Ce point est verrouillé");
              return;
            }
            // Vérifier si l'entité est sur un calque verrouillé
            const entityIdToCheck = handleHit.type === "point" ? handleHit.id : handleHit.id; // Pour les handles, l'id est celui de la géométrie
            if (isEntityOnLockedLayer(entityIdToCheck)) {
              toast.error("Cette entité est sur un calque verrouillé");
              return;
            }
            setIsDragging(true);
            setDragTarget(handleHit);
            setDragStart(worldPos);
            setLastDragPos(worldPos);
            return;
          }

          const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
          if (entityId) {
            // Si on clique sur une entité déjà sélectionnée, préparer le drag de la sélection
            if (selectedEntities.has(entityId) && selectedEntities.size > 0) {
              // Vérifier si une entité de la sélection est sur un calque verrouillé
              let hasLockedEntity = false;
              for (const id of selectedEntities) {
                if (isEntityOnLockedLayer(id)) {
                  hasLockedEntity = true;
                  break;
                }
              }
              if (hasLockedEntity) {
                toast.error("Une ou plusieurs entités sont sur un calque verrouillé");
                return;
              }
              // Préparer le drag de toute la sélection
              setSelectionDragStart(worldPos);
              setPotentialSelectionDrag(true);
              // Le drag commencera vraiment quand on bougera la souris
              return;
            }

            if (e.shiftKey) {
              // Toggle selection
              const newSelection = new Set(selectedEntities);
              if (newSelection.has(entityId)) {
                newSelection.delete(entityId);
              } else {
                newSelection.add(entityId);
              }
              setSelectedEntities(newSelection);
            } else {
              // Nouvelle sélection - pas de drag immédiat
              setSelectedEntities(new Set([entityId]));
              setPotentialSelectionDrag(false);
            }
            // Désélectionner photo et marker quand on sélectionne une entité géométrique
            setSelectedImageId(null);
            setSelectedMarkerId(null);
          } else {
            // Clic dans le vide : commencer une sélection rectangulaire
            if (!e.shiftKey) {
              setSelectedEntities(new Set());
              setReferenceHighlight(null); // Réinitialiser le highlight vert
            }
            setPotentialSelectionDrag(false);
            setSelectionBox({ start: worldPos, end: worldPos });
          }
          break;
        }

        case "line": {
          if (tempPoints.length === 0) {
            // Premier point - utiliser sketchRef.current pour éviter les closures stales
            const currentSketch = sketchRef.current;
            const newSketch = { ...currentSketch };
            newSketch.points = new Map(currentSketch.points);
            newSketch.geometries = new Map(currentSketch.geometries);

            let p: Point;

            // Si on snap sur un segment (pas une extrémité), le couper
            if (
              currentSnapPoint &&
              (currentSnapPoint.type === "nearest" || currentSnapPoint.type === "perpendicular") &&
              currentSnapPoint.entityId
            ) {
              const geo = currentSketch.geometries.get(currentSnapPoint.entityId);
              if (geo && geo.type === "line") {
                const splitPoint = splitLineAtPoint(currentSnapPoint.entityId, targetPos, newSketch);
                if (splitPoint) {
                  p = splitPoint;
                  setSketch(newSketch);
                } else {
                  p = getOrCreatePoint(targetPos, currentSnapPoint);
                }
              } else {
                p = getOrCreatePoint(targetPos, currentSnapPoint);
              }
            } else {
              p = getOrCreatePoint(targetPos, currentSnapPoint);
            }

            setTempPoints([p]);
            setTempGeometry({ type: "line", points: [p] });
          } else {
            // Deuxième point - créer la ligne - utiliser sketchRef.current
            const p1 = tempPoints[0];

            // Ajouter les points
            const currentSketch = sketchRef.current;
            const newSketch = { ...currentSketch };
            newSketch.points = new Map(currentSketch.points);
            newSketch.geometries = new Map(currentSketch.geometries);

            let p2: Point;

            // Si on snap sur un segment (pas une extrémité), le couper
            if (
              currentSnapPoint &&
              (currentSnapPoint.type === "nearest" || currentSnapPoint.type === "perpendicular") &&
              currentSnapPoint.entityId
            ) {
              const geo = currentSketch.geometries.get(currentSnapPoint.entityId);
              if (geo && geo.type === "line") {
                const splitPoint = splitLineAtPoint(currentSnapPoint.entityId, targetPos, newSketch);
                if (splitPoint) {
                  p2 = splitPoint;
                } else {
                  p2 = getOrCreatePoint(targetPos, currentSnapPoint);
                }
              } else {
                p2 = getOrCreatePoint(targetPos, currentSnapPoint);
              }
            } else {
              p2 = getOrCreatePoint(targetPos, currentSnapPoint);
            }

            // N'ajouter que si c'est un nouveau point (pas déjà dans le sketch)
            if (!newSketch.points.has(p1.id)) {
              newSketch.points.set(p1.id, p1);
            }
            if (!newSketch.points.has(p2.id)) {
              newSketch.points.set(p2.id, p2);
            }

            // Ajouter la ligne avec le calque actif
            const line: Line = {
              id: generateId(),
              type: "line",
              p1: p1.id,
              p2: p2.id,
              layerId: currentSketch.activeLayerId,
              strokeWidth: defaultStrokeWidthRef.current,
              strokeColor: defaultStrokeColorRef.current,
              isConstruction: isConstructionModeRef.current,
            };
            newSketch.geometries.set(line.id, line);

            // Détecter et créer les points d'intersection avec les segments existants
            createIntersectionPoints(line.id, newSketch);

            setSketch(newSketch);
            // NE PAS appeler solveSketch ici car il "corrige" les contraintes H/V
            // et annule les modifications manuelles de dimensions
            // solveSketch(newSketch);
            addToHistory(newSketch, "Ligne");

            // Reset pour une nouvelle ligne (continuer depuis p2)
            setTempPoints([p2]);
            setTempGeometry({ type: "line", points: [p2] });
          }
          break;
        }

        case "circle": {
          if (tempPoints.length === 0) {
            // Centre
            const center: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };
            setTempPoints([center]);
            setTempGeometry({ type: "circle", center, radius: 0 });
          } else {
            // Rayon défini
            const center = tempPoints[0];
            const radius = distance(center, targetPos);

            // Utiliser sketchRef.current pour éviter les closures stales
            const currentSketch = sketchRef.current;
            const newSketch = { ...currentSketch };
            newSketch.points = new Map(currentSketch.points);
            newSketch.geometries = new Map(currentSketch.geometries);

            newSketch.points.set(center.id, center);

            const circle: CircleType = {
              id: generateId(),
              type: "circle",
              center: center.id,
              radius,
              layerId: currentSketch.activeLayerId,
              strokeWidth: defaultStrokeWidthRef.current,
              strokeColor: defaultStrokeColorRef.current,
              isConstruction: isConstructionModeRef.current,
            };
            newSketch.geometries.set(circle.id, circle);

            // Créer les intersections avec les segments existants (coupe le cercle en arcs si nécessaire)
            createCircleIntersections(circle.id, center, center.id, radius, currentSketch.activeLayerId, newSketch);

            setSketch(newSketch);
            // NE PAS appeler solveSketch - évite de "corriger" les contraintes
            // solveSketch(newSketch);
            const radiusMm = radius / (currentSketch.scaleFactor || 1);
            addToHistory(newSketch, `Cercle R${radiusMm.toFixed(1)}mm`);

            setTempPoints([]);
            setTempGeometry(null);
          }
          break;
        }

        case "arc3points": {
          // Arc par 3 points: cliquer 3 points, l'arc passe par ces 3 points
          const newPoint: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };
          const newArc3Points = [...arc3Points, newPoint];
          setArc3Points(newArc3Points);

          if (newArc3Points.length === 3) {
            // Calculer le cercle passant par les 3 points
            const [p1, p2, p3] = newArc3Points;

            // Calcul du centre du cercle circonscrit
            const ax = p1.x,
              ay = p1.y;
            const bx = p2.x,
              by = p2.y;
            const cx = p3.x,
              cy = p3.y;

            const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

            if (Math.abs(d) < 0.0001) {
              // Points alignés - pas d'arc possible
              toast.error("Les 3 points sont alignés, impossible de créer un arc");
              setArc3Points([]);
              setTempGeometry(null);
              break;
            }

            const ux =
              ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
            const uy =
              ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
            const radius = Math.sqrt((ax - ux) * (ax - ux) + (ay - uy) * (ay - uy));

            const center: Point = { id: generateId(), x: ux, y: uy };

            // Calculer les angles de début et fin
            const startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
            const midAngle = Math.atan2(p2.y - center.y, p2.x - center.x);
            const endAngle = Math.atan2(p3.y - center.y, p3.x - center.x);

            // Déterminer la direction (sens horaire ou anti-horaire)
            // Le point milieu doit être sur l'arc
            let counterClockwise = false;

            // Normaliser les angles
            const normalizeAngle = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            const nStart = normalizeAngle(startAngle);
            const nMid = normalizeAngle(midAngle);
            const nEnd = normalizeAngle(endAngle);

            // Vérifier si le point milieu est dans le sens direct (anti-horaire)
            if (nStart < nEnd) {
              counterClockwise = nMid > nStart && nMid < nEnd;
            } else {
              counterClockwise = nMid > nStart || nMid < nEnd;
            }

            // Créer les points et l'arc
            const currentSketch = sketchRef.current;
            const newSketch = { ...currentSketch };
            newSketch.points = new Map(currentSketch.points);
            newSketch.geometries = new Map(currentSketch.geometries);

            // Points de l'arc
            const startPt: Point = { id: generateId(), x: p1.x, y: p1.y };
            const endPt: Point = { id: generateId(), x: p3.x, y: p3.y };

            newSketch.points.set(center.id, center);
            newSketch.points.set(startPt.id, startPt);
            newSketch.points.set(endPt.id, endPt);

            const arc: Arc = {
              id: generateId(),
              type: "arc",
              center: center.id,
              startPoint: startPt.id,
              endPoint: endPt.id,
              radius,
              counterClockwise,
              layerId: currentSketch.activeLayerId,
              strokeWidth: defaultStrokeWidthRef.current,
              strokeColor: defaultStrokeColorRef.current,
              isConstruction: isConstructionModeRef.current,
            };
            newSketch.geometries.set(arc.id, arc);

            setSketch(newSketch);
            const radiusMm = radius / (currentSketch.scaleFactor || 1);
            addToHistory(newSketch, `Arc 3pts R${radiusMm.toFixed(1)}mm`);
            setArc3Points([]);
            setTempGeometry(null);
            toast.success("Arc créé");
          } else {
            // Mettre à jour la prévisualisation
            setTempGeometry({ type: "arc3points", points: newArc3Points });
          }
          break;
        }

        case "rectangle": {
          if (tempPoints.length === 0) {
            const p1: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };
            setTempPoints([p1]);
            // Stocker le mode dans tempGeometry pour le rendu
            setTempGeometry({ type: "rectangle", p1, mode: rectangleMode });
            // Initialiser les inputs avec valeurs vides
            setRectInputs({
              active: true,
              widthValue: "",
              heightValue: "",
              activeField: "width",
              editingWidth: false,
              editingHeight: false,
              widthInputPos: { x: 0, y: 0 },
              heightInputPos: { x: 0, y: 0 },
            });
          } else {
            // Créer le rectangle avec les dimensions (inputs ou position du clic)
            // IMPORTANT: Passer worldPos (sans snap grille) pour être cohérent avec le tracé
            createRectangleFromInputs(worldPos);
          }
          break;
        }

        case "bezier": {
          if (tempPoints.length === 0) {
            // Point de départ - réutiliser si snap sur endpoint existant
            const p1 = getOrCreatePoint(targetPos, currentSnapPoint);
            setTempPoints([p1]);
            setTempGeometry({ type: "bezier", points: [p1] });
          } else if (tempPoints.length === 1) {
            // Point d'arrivée - réutiliser si snap sur endpoint existant
            const p2 = getOrCreatePoint(targetPos, currentSnapPoint);
            setTempPoints([...tempPoints, p2]);
            setTempGeometry({ type: "bezier", points: [...tempPoints, p2] });
          } else if (tempPoints.length === 2) {
            // Point de contrôle 1 - toujours nouveau
            const cp1: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };
            setTempPoints([...tempPoints, cp1]);
            setTempGeometry({ type: "bezier", points: [...tempPoints, cp1] });
          } else if (tempPoints.length === 3) {
            // Point de contrôle 2 - créer la courbe
            const [p1, p2, cp1] = tempPoints;
            const cp2: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };

            // Utiliser sketchRef.current pour éviter les closures stales
            const currentSketch = sketchRef.current;
            const newSketch = { ...currentSketch };
            newSketch.points = new Map(currentSketch.points);
            newSketch.geometries = new Map(currentSketch.geometries);

            // N'ajouter que les points qui n'existent pas déjà
            if (!currentSketch.points.has(p1.id)) {
              newSketch.points.set(p1.id, p1);
            }
            if (!currentSketch.points.has(p2.id)) {
              newSketch.points.set(p2.id, p2);
            }
            newSketch.points.set(cp1.id, cp1);
            newSketch.points.set(cp2.id, cp2);

            const bezier: Bezier = {
              id: generateId(),
              type: "bezier",
              p1: p1.id,
              p2: p2.id,
              cp1: cp1.id,
              cp2: cp2.id,
              layerId: currentSketch.activeLayerId,
            };
            newSketch.geometries.set(bezier.id, bezier);

            setSketch(newSketch);
            // NE PAS appeler solveSketch - évite de "corriger" les contraintes
            // solveSketch(newSketch);
            addToHistory(newSketch, "Courbe Bézier");

            setTempPoints([]);
            setTempGeometry(null);
            toast.success("Courbe de Bézier créée");
          }
          break;
        }

        case "spline": {
          // Outil spline : ajouter des points jusqu'à double-clic pour terminer
          const newPoint = getOrCreatePoint(targetPos, currentSnapPoint);
          const newTempPoints = [...tempPoints, newPoint];
          setTempPoints(newTempPoints);
          setTempGeometry({ type: "spline", points: newTempPoints });
          break;
        }

        case "polygon": {
          // Outil polygone régulier : centre puis rayon
          if (tempPoints.length === 0) {
            // Premier clic : définir le centre
            const center: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };
            setTempPoints([center]);
            setTempGeometry({ type: "polygon", center, radius: 0, sides: polygonSides });
          } else {
            // Deuxième clic : définir le rayon et créer le polygone
            const center = tempPoints[0];
            const radius = distance(center, targetPos);

            if (radius < 1) {
              toast.error("Rayon trop petit");
              setTempPoints([]);
              setTempGeometry(null);
              break;
            }

            const currentSketch = sketchRef.current;
            const newSketch = { ...currentSketch };
            newSketch.points = new Map(currentSketch.points);
            newSketch.geometries = new Map(currentSketch.geometries);

            // Calculer l'angle vers le point cliqué pour orienter le polygone
            const baseAngle = Math.atan2(targetPos.y - center.y, targetPos.x - center.x);

            // Créer les sommets du polygone
            const vertices: Point[] = [];
            for (let i = 0; i < polygonSides; i++) {
              const angle = baseAngle + (i * 2 * Math.PI) / polygonSides;
              const vertex: Point = {
                id: generateId(),
                x: center.x + radius * Math.cos(angle),
                y: center.y + radius * Math.sin(angle),
              };
              vertices.push(vertex);
              newSketch.points.set(vertex.id, vertex);
            }

            // Créer les lignes entre les sommets
            for (let i = 0; i < polygonSides; i++) {
              const nextI = (i + 1) % polygonSides;
              const line: Line = {
                id: generateId(),
                type: "line",
                p1: vertices[i].id,
                p2: vertices[nextI].id,
                layerId: currentSketch.activeLayerId,
                strokeWidth: defaultStrokeWidthRef.current,
                strokeColor: defaultStrokeColorRef.current,
                isConstruction: isConstructionModeRef.current,
              };
              newSketch.geometries.set(line.id, line);
            }

            setSketch(newSketch);
            const radiusMm = radius / (currentSketch.scaleFactor || 1);
            addToHistory(newSketch, `Polygone ${polygonSides} côtés R${radiusMm.toFixed(1)}mm`);

            setTempPoints([]);
            setTempGeometry(null);
            toast.success(`Polygone régulier à ${polygonSides} côtés créé`);
          }
          break;
        }

        case "dimension": {
          const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
          if (entityId) {
            // Vérifier le type d'entité
            const geo = sketch.geometries.get(entityId);
            if (geo?.type === "line") {
              const line = geo as Line;
              const p1 = sketch.points.get(line.p1);
              const p2 = sketch.points.get(line.p2);
              if (p1 && p2) {
                const dist = distance(p1, p2) / sketch.scaleFactor;
                setDimensionDialog({
                  open: true,
                  type: "distance",
                  entities: [line.p1, line.p2],
                  initialValue: Math.round(dist * 100) / 100,
                });
              }
            } else if (geo?.type === "circle") {
              const circle = geo as CircleType;
              setDimensionDialog({
                open: true,
                type: "radius",
                entities: [entityId],
                initialValue: Math.round((circle.radius / sketch.scaleFactor) * 100) / 100,
              });
            }
          }
          break;
        }

        case "measure": {
          // Chercher un point de calibration proche pour snap
          let snapPos = worldPos;
          const snapTolerance = 25 / viewport.scale; // Augmenté pour meilleur snap

          // MOD UX: Snap sur les points de calibration de l'image sélectionnée
          const imageCalibPoints = selectedImageId
            ? backgroundImages.find((img) => img.id === selectedImageId)?.calibrationData?.points
            : null;
          const calibPoints = imageCalibPoints || calibrationData.points;

          if (showCalibrationPanel || calibPoints.size > 0) {
            let closestCalibPoint: CalibrationPoint | null = null;
            let closestDist = Infinity;

            calibPoints.forEach((point) => {
              const d = distance(worldPos, point);
              if (d < snapTolerance && d < closestDist) {
                closestDist = d;
                closestCalibPoint = point;
              }
            });

            if (closestCalibPoint) {
              snapPos = { x: closestCalibPoint.x, y: closestCalibPoint.y };
            }
          }

          // Détecter le segment sous le clic
          const clickedSegmentId = findEntityAtPosition(worldPos.x, worldPos.y);
          const clickedGeo = clickedSegmentId ? sketch.geometries.get(clickedSegmentId) : null;
          const isClickedLine = clickedGeo?.type === "line";

          if (measureState.phase === "idle" || measureState.phase === "complete") {
            // Premier point - commence une nouvelle mesure
            setMeasureState({
              phase: "waitingSecond",
              start: snapPos,
              end: null,
              result: null,
              segment1Id: isClickedLine ? clickedSegmentId : null,
            });
            setMeasurePreviewEnd(null);
          } else if (measureState.phase === "waitingSecond" && measureState.start) {
            // Deuxième point - calculer, ajouter au tableau et permettre nouvelle mesure
            const distPx = distance(measureState.start, snapPos);
            // calibrationData.scale est en mm/px, sketch.scaleFactor est en px/mm
            const distMm = calibrationData.scale ? distPx * calibrationData.scale : distPx / sketch.scaleFactor;

            // Calculer l'angle si les 2 points sont sur des segments différents
            let angleDeg: number | undefined = undefined;
            const segment1Id = measureState.segment1Id;
            const segment2Id = isClickedLine ? clickedSegmentId : null;

            if (segment1Id && segment2Id && segment1Id !== segment2Id) {
              const line1 = sketch.geometries.get(segment1Id) as Line;
              const line2 = sketch.geometries.get(segment2Id) as Line;

              if (line1 && line2) {
                const p1a = sketch.points.get(line1.p1);
                const p1b = sketch.points.get(line1.p2);
                const p2a = sketch.points.get(line2.p1);
                const p2b = sketch.points.get(line2.p2);

                if (p1a && p1b && p2a && p2b) {
                  // Vecteurs directionnels des 2 lignes
                  const v1 = { x: p1b.x - p1a.x, y: p1b.y - p1a.y };
                  const v2 = { x: p2b.x - p2a.x, y: p2b.y - p2a.y };

                  // Normaliser
                  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
                  const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

                  if (len1 > 0 && len2 > 0) {
                    v1.x /= len1;
                    v1.y /= len1;
                    v2.x /= len2;
                    v2.y /= len2;

                    // Produit scalaire pour l'angle
                    const dot = v1.x * v2.x + v1.y * v2.y;
                    // Clamp pour éviter les erreurs d'arrondi
                    const clampedDot = Math.max(-1, Math.min(1, dot));
                    angleDeg = Math.acos(Math.abs(clampedDot)) * (180 / Math.PI);
                  }
                }
              }
            }

            // Ajouter la mesure au tableau
            setMeasurements((prev) => {
              const measureIndex = prev.length + 1;
              const newMeasure: Measurement = {
                id: generateId(),
                name: `M${measureIndex}`,
                start: measureState.start!,
                end: snapPos,
                px: distPx,
                mm: distMm,
                angle: angleDeg,
                segment1Id: segment1Id || undefined,
                segment2Id: segment2Id || undefined,
                visible: true,
              };
              return [...prev, newMeasure];
            });

            // Reset pour nouvelle mesure
            setMeasureState({
              phase: "idle",
              start: null,
              end: null,
              result: null,
              segment1Id: null,
            });
            setMeasurePreviewEnd(null);

            // Toast avec distance et angle si disponible
            if (angleDeg !== undefined) {
              toast.success(`Mesure: ${distMm.toFixed(1)} mm | Angle: ${angleDeg.toFixed(1)}°`);
            } else {
              toast.success(`Mesure: ${distPx.toFixed(1)} px = ${distMm.toFixed(1)} mm`);
            }
          }
          break;
        }

        case "fillet": {
          // Mode outil: clic sur lignes pour sélectionner puis ouvrir modale
          const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
          if (entityId) {
            const geo = sketch.geometries.get(entityId);
            if (geo && geo.type === "line") {
              if (!filletFirstLine) {
                setFilletFirstLine(entityId);
                setSelectedEntities(new Set([entityId]));
                toast.info("Sélectionnez la deuxième ligne");
              } else if (entityId !== filletFirstLine) {
                // Calculer les paramètres du coin
                const params = calculateCornerParams(filletFirstLine, entityId);
                if (!params) {
                  toast.error("Les lignes doivent partager un point commun");
                  setFilletFirstLine(null);
                  return;
                }
                // Trouver le point partagé
                const line1 = sketch.geometries.get(filletFirstLine) as Line;
                const line2 = sketch.geometries.get(entityId) as Line;
                const shared = findSharedPoint(line1, line2);
                if (!shared) {
                  toast.error("Les lignes doivent partager un point commun");
                  setFilletFirstLine(null);
                  return;
                }
                const maxRadiusMm = params.maxRadius / sketch.scaleFactor;
                const len1Mm = params.len1 / sketch.scaleFactor;
                const len2Mm = params.len2 / sketch.scaleFactor;
                const suggestedRadius = Math.min(filletRadius, Math.floor(maxRadiusMm));
                // Ouvrir la modale
                setFilletDialog({
                  open: true,
                  corners: [
                    {
                      pointId: shared.sharedPointId,
                      maxRadius: maxRadiusMm,
                      angleDeg: params.angleDeg,
                      radius: suggestedRadius > 0 ? suggestedRadius : 1,
                      dist1: suggestedRadius > 0 ? suggestedRadius : 1,
                      dist2: suggestedRadius > 0 ? suggestedRadius : 1,
                      maxDist1: len1Mm * 0.9,
                      maxDist2: len2Mm * 0.9,
                      line1Id: filletFirstLine,
                      line2Id: entityId,
                    },
                  ],
                  globalRadius: suggestedRadius > 0 ? suggestedRadius : 1,
                  minMaxRadius: maxRadiusMm,
                  hoveredCornerIdx: null,
                  asymmetric: false,
                  addDimension: false,
                  repeatMode: false,
                });
                setFilletFirstLine(null);
              }
            }
          }
          break;
        }

        case "chamfer": {
          // Mode outil: clic sur lignes pour sélectionner puis appliquer
          const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
          if (entityId) {
            const geo = sketch.geometries.get(entityId);
            if (geo && geo.type === "line") {
              if (!filletFirstLine) {
                setFilletFirstLine(entityId);
                setSelectedEntities(new Set([entityId]));
                toast.info("Sélectionnez la deuxième ligne");
              } else if (entityId !== filletFirstLine) {
                // Calculer les paramètres du coin
                const params = calculateCornerParams(filletFirstLine, entityId);
                if (!params) {
                  toast.error("Les lignes doivent partager un point commun");
                  setFilletFirstLine(null);
                  return;
                }
                // Trouver le point partagé
                const line1 = sketch.geometries.get(filletFirstLine) as Line;
                const line2 = sketch.geometries.get(entityId) as Line;
                const shared = findSharedPoint(line1, line2);
                if (!shared) {
                  toast.error("Les lignes doivent partager un point commun");
                  setFilletFirstLine(null);
                  return;
                }
                const maxDistanceMm = params.maxDistance / sketch.scaleFactor;
                const len1Mm = params.len1 / sketch.scaleFactor;
                const len2Mm = params.len2 / sketch.scaleFactor;
                const suggestedDistance = Math.min(chamferDistance, Math.floor(maxDistanceMm));
                // Ouvrir la modale
                setChamferDialog({
                  open: true,
                  corners: [
                    {
                      pointId: shared.sharedPointId,
                      maxDistance: maxDistanceMm,
                      angleDeg: params.angleDeg,
                      distance: suggestedDistance > 0 ? suggestedDistance : 1,
                      dist1: suggestedDistance > 0 ? suggestedDistance : 1,
                      dist2: suggestedDistance > 0 ? suggestedDistance : 1,
                      maxDist1: len1Mm * 0.9,
                      maxDist2: len2Mm * 0.9,
                      line1Id: filletFirstLine,
                      line2Id: entityId,
                    },
                  ],
                  globalDistance: suggestedDistance > 0 ? suggestedDistance : 1,
                  minMaxDistance: maxDistanceMm,
                  hoveredCornerIdx: null,
                  asymmetric: false,
                  addDimension: false,
                  repeatMode: false,
                });
                setFilletFirstLine(null);
                setSelectedEntities(new Set());
              }
            }
          }
          break;
        }

        case "offset": {
          // Si la modale est ouverte, gérer la sélection
          if (offsetDialog?.open) {
            const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
            if (entityId) {
              const geo = sketch.geometries.get(entityId);
              if (geo && (geo.type === "line" || geo.type === "circle" || geo.type === "arc")) {
                toggleOffsetSelection(entityId);
              }
            }
          }
          break;
        }

        case "mirror": {
          // Outil symétrie : définir l'axe puis dupliquer en miroir
          // IMPORTANT: Utiliser worldPos (pas targetPos) pour éviter le snap grille
          const mirrorClickPos = worldPos;

          if (mirrorState.phase === "idle" || mirrorState.entitiesToMirror.size === 0) {
            // Pas de sélection capturée - demander de sélectionner d'abord
            toast.error("Sélectionnez d'abord les entités à symétriser");
            setActiveTool("select");
            break;
          } else if (mirrorState.phase === "waitingAxis1") {
            // Vérifier si on clique sur un segment existant (non sélectionné) pour l'utiliser comme axe
            const clickedEntity = findEntityAtPosition(mirrorClickPos.x, mirrorClickPos.y);
            if (clickedEntity && !mirrorState.entitiesToMirror.has(clickedEntity)) {
              const geo = sketch.geometries.get(clickedEntity);
              if (geo && geo.type === "line") {
                // Utiliser ce segment comme axe de symétrie
                const line = geo as Line;
                const p1 = sketch.points.get(line.p1);
                const p2 = sketch.points.get(line.p2);
                if (p1 && p2) {
                  const axis1: Point = { id: generateId(), x: p1.x, y: p1.y };
                  const axis2: Point = { id: generateId(), x: p2.x, y: p2.y };

                  // Appliquer directement la symétrie avec ce segment comme axe
                  applyMirrorWithAxis(axis1, axis2);
                  toast.success("Symétrie appliquée (axe = segment sélectionné)");
                  break;
                }
              }
            }

            // Sinon, premier point de l'axe libre
            const axisPoint1: Point = { id: generateId(), x: mirrorClickPos.x, y: mirrorClickPos.y };
            setMirrorState((prev) => ({
              ...prev,
              phase: "waitingAxis2",
              axisPoint1,
            }));
            // Inclure selectionCenter pour l'affichage des infos
            setTempGeometry({
              type: "mirrorAxis",
              p1: axisPoint1,
              selectionCenter: mirrorSelectionData?.center || null,
            });
            toast.info("Cliquez le second point ou sur un segment pour l'utiliser comme axe");
          } else if (mirrorState.phase === "waitingAxis2" && mirrorState.axisPoint1) {
            // Vérifier si on clique sur un segment existant
            const clickedEntity = findEntityAtPosition(mirrorClickPos.x, mirrorClickPos.y);
            if (clickedEntity && !mirrorState.entitiesToMirror.has(clickedEntity)) {
              const geo = sketch.geometries.get(clickedEntity);
              if (geo && geo.type === "line") {
                const line = geo as Line;
                const p1 = sketch.points.get(line.p1);
                const p2 = sketch.points.get(line.p2);
                if (p1 && p2) {
                  const axis1: Point = { id: generateId(), x: p1.x, y: p1.y };
                  const axis2: Point = { id: generateId(), x: p2.x, y: p2.y };
                  applyMirrorWithAxis(axis1, axis2);
                  toast.success("Symétrie appliquée (axe = segment)");
                  break;
                }
              }
            }

            // Second point de l'axe - appliquer la symétrie
            // Appliquer le snap H/V/45° pour le second point
            let finalPos = mirrorClickPos;
            const axis1 = mirrorState.axisPoint1;
            const dx = mirrorClickPos.x - axis1.x;
            const dy = mirrorClickPos.y - axis1.y;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            // Snap horizontal (tolérance 5°)
            if (Math.abs(angle) < 5 || Math.abs(Math.abs(angle) - 180) < 5) {
              finalPos = { x: mirrorClickPos.x, y: axis1.y };
            }
            // Snap vertical
            else if (Math.abs(Math.abs(angle) - 90) < 5) {
              finalPos = { x: axis1.x, y: mirrorClickPos.y };
            }
            // Snap 45°
            else if (Math.abs(Math.abs(angle) - 45) < 5 || Math.abs(Math.abs(angle) - 135) < 5) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              const sign45X = dx >= 0 ? 1 : -1;
              const sign45Y = dy >= 0 ? 1 : -1;
              finalPos = {
                x: axis1.x + sign45X * dist * Math.cos(Math.PI / 4),
                y: axis1.y + sign45Y * dist * Math.sin(Math.PI / 4),
              };
            }

            const axisPoint2: Point = { id: generateId(), x: finalPos.x, y: finalPos.y };
            applyMirrorWithAxis(axis1, axisPoint2);
          }
          break;
        }

        case "text": {
          // Si un input est déjà ouvert
          if (textInput?.active) {
            // Si l'input a du contenu, le valider d'abord
            if (textInput.content.trim()) {
              commitTextInput();
            }
            // Fermer l'input actuel
            setTextInput(null);
          }

          // Outil texte : vérifier si on clique sur un texte existant
          const clickedEntity = findEntityAtPosition(worldPos.x, worldPos.y);
          if (clickedEntity) {
            const geo = sketch.geometries.get(clickedEntity);
            if (geo?.type === "text") {
              // Clic sur un texte existant → le sélectionner
              setSelectedEntities(new Set([clickedEntity]));
              // Charger ses paramètres
              const textGeo = geo as TextAnnotation;
              setTextFontSize(textGeo.fontSize);
              setTextColor(textGeo.color || "#000000");
              setTextAlignment(textGeo.alignment || "left");
              break;
            }
          }
          // Clic ailleurs → créer un nouveau texte
          setTextInput({
            active: true,
            position: worldPos,
            screenPos: { x: e.clientX, y: e.clientY },
            content: "",
            editingId: null,
          });
          // Focus sur l'input après le render - plusieurs tentatives
          const focusInput = () => {
            if (textInputRef.current) {
              textInputRef.current.focus();
            } else {
              setTimeout(focusInput, 50);
            }
          };
          setTimeout(focusInput, 50);
          break;
        }
      }
    },
    [
      activeTool,
      viewport,
      tempPoints,
      sketch,
      currentSnapPoint,
      snapEnabled,
      selectedEntities,
      findEntityAtPosition,
      findHandleAtPosition,
      isEntityOnLockedLayer,
      screenToWorld,
      solveSketch,
      addToHistory,
      getOrCreatePoint,
      splitLineAtPoint,
      calculateCornerParams,
      createIntersectionPoints,
      createCircleIntersections,
      calibrationMode,
      calibrationData,
      selectedCalibrationPoint,
      newPairDistance,
      newPairColor,
      measureState,
      measurements,
      showCalibrationPanel,
      filletFirstLine,
      filletRadius,
      chamferDistance,
      applyChamfer,
      offsetDialog,
      toggleOffsetSelection,
      // Multi-photos
      backgroundImages,
      selectedImageId,
      findImageAtPosition,
      selectImageAndSwitchLayer,
      // Nouveaux outils
      arc3Points,
      mirrorState,
      applyMirrorWithAxis,
      mirrorSelectionData,
      // Gizmo de transformation
      showTransformGizmo,
      selectionGizmoData,
      transformGizmo,
      gizmoDrag,
      startGizmoDrag,
      // Grille A4
      showA4Grid,
      a4GridOrigin,
      a4GridOrientation,
      a4GridRows,
      a4GridCols,
      selectedA4Cells,
      // Note: isDraggingRevealRef.current utilisé directement (pas dans deps)
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Ignorer si on est en train de drag le rideau reveal (utiliser ref pour éviter stale closure)
      if (isDraggingRevealRef.current) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = screenToWorld(screenX, screenY);

      // Mettre à jour la position de la souris pour l'effet hover des formes fermées
      setMouseWorldPos(worldPos);

      // Pan
      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        setViewport((v) => ({
          ...v,
          offsetX: v.offsetX + dx,
          offsetY: v.offsetY + dy,
        }));
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      // === Drag de l'origine de la grille A4 ===
      if (isDraggingA4Origin) {
        setA4GridOrigin({ x: worldPos.x, y: worldPos.y });
        return;
      }

      // === Drag du gizmo de transformation ===
      if (gizmoDrag) {
        updateGizmoDrag(worldPos);
        return;
      }

      // === Multi-photos: drag d'une image ===
      if (isDraggingImage && imageDragStart && selectedImageId) {
        const dx = worldPos.x - imageDragStart.x;
        const dy = worldPos.y - imageDragStart.y;

        setBackgroundImages((prev) =>
          prev.map((img) =>
            img.id === selectedImageId ? { ...img, x: imageDragStart.imgX + dx, y: imageDragStart.imgY + dy } : img,
          ),
        );
        return;
      }

      // === Drag d'un marker ===
      if (draggingMarker) {
        setBackgroundImages((prev) =>
          prev.map((img) => {
            if (img.id !== draggingMarker.imageId) return img;
            return {
              ...img,
              markers: img.markers.map((m) => {
                if (m.id !== draggingMarker.markerId) return m;
                // Calculer la nouvelle position relative au centre de l'image
                const newRelativeX = worldPos.x - img.x;
                const newRelativeY = worldPos.y - img.y;
                return {
                  ...m,
                  relativeX: newRelativeX,
                  relativeY: newRelativeY,
                };
              }),
            };
          }),
        );
        return;
      }

      // Drag d'un point de calibration
      if (draggingCalibrationPoint) {
        const selectedImage = getSelectedImage();
        if (selectedImage) {
          // FIX #85d: Convertir en coordonnées relatives à l'image (normalisées à scale=1)
          const imgScale = selectedImage.scale || 1;
          const relativeX = (worldPos.x - selectedImage.x) / imgScale;
          const relativeY = (worldPos.y - selectedImage.y) / imgScale;

          updateSelectedImageCalibration((prev) => {
            const newPoints = new Map(prev.points);
            const point = newPoints.get(draggingCalibrationPoint);
            if (point) {
              newPoints.set(draggingCalibrationPoint, {
                ...point,
                x: relativeX,
                y: relativeY,
              });
            }
            return { ...prev, points: newPoints };
          });
        }
        return;
      }

      // Drag d'un point de mesure
      if (draggingMeasurePoint) {
        // Utiliser le snap si activé
        let targetPos = worldPos;
        if (snapEnabled) {
          const snap = snapSystemRef.current.findSnapPoint(
            screenX,
            screenY,
            sketchRef.current,
            viewport,
            [],
            markerSnapPoints,
            { activeLayerOnly: snapToActiveLayerOnly, activeLayerId: sketchRef.current.activeLayerId },
          );
          if (snap) {
            targetPos = { x: snap.x, y: snap.y };
            setCurrentSnapPoint(snap);
          } else {
            setCurrentSnapPoint(null);
          }
        }

        setMeasurements((prev) =>
          prev.map((m) => {
            if (m.id === draggingMeasurePoint.measureId) {
              const newStart = draggingMeasurePoint.pointType === "start" ? targetPos : m.start;
              const newEnd = draggingMeasurePoint.pointType === "end" ? targetPos : m.end;
              const distPx = distance(newStart, newEnd);
              const distMm = calibrationData.scale ? distPx * calibrationData.scale : distPx / sketch.scaleFactor;
              return {
                ...m,
                start: newStart,
                end: newEnd,
                px: distPx,
                mm: distMm,
              };
            }
            return m;
          }),
        );
        return;
      }

      // Drag de sélection (déplacement de formes entières)
      // Ne démarre que si on a cliqué sur une entité déjà sélectionnée (potentialSelectionDrag)
      if (
        activeTool === "select" &&
        selectedEntities.size > 0 &&
        e.buttons === 1 &&
        !selectionBox &&
        (potentialSelectionDrag || isDraggingSelection)
      ) {
        const dist = Math.sqrt((worldPos.x - selectionDragStart.x) ** 2 + (worldPos.y - selectionDragStart.y) ** 2);

        // Démarrer le drag si on a bougé suffisamment
        if (dist > 3 / viewport.scale || isDraggingSelection) {
          if (!isDraggingSelection) {
            setIsDraggingSelection(true);
          }

          // Calculer le déplacement
          const dx = worldPos.x - selectionDragStart.x;
          const dy = worldPos.y - selectionDragStart.y;

          // Collecter tous les points des géométries sélectionnées
          // Utiliser sketchRef.current pour éviter les closures stales
          const currentSketch = sketchRef.current;
          const pointsToMove = new Set<string>();
          selectedEntities.forEach((geoId) => {
            const geo = currentSketch.geometries.get(geoId);
            if (geo) {
              if (geo.type === "line") {
                const line = geo as Line;
                pointsToMove.add(line.p1);
                pointsToMove.add(line.p2);
              } else if (geo.type === "circle") {
                const circle = geo as CircleType;
                pointsToMove.add(circle.center);
              } else if (geo.type === "arc") {
                const arc = geo as Arc;
                pointsToMove.add(arc.center);
                pointsToMove.add(arc.startPoint);
                pointsToMove.add(arc.endPoint);
              } else if (geo.type === "bezier") {
                const bezier = geo as Bezier;
                pointsToMove.add(bezier.p1);
                pointsToMove.add(bezier.p2);
                pointsToMove.add(bezier.cp1);
                pointsToMove.add(bezier.cp2);
              } else if (geo.type === "text") {
                const text = geo as TextAnnotation;
                pointsToMove.add(text.position);
              }
            }
          });

          // Vérifier si des points verrouillés sont dans la sélection
          const lockedInSelection = Array.from(pointsToMove).filter((pid) => lockedPoints.has(pid));
          if (lockedInSelection.length > 0) {
            // Exclure les points verrouillés du déplacement
            lockedInSelection.forEach((pid) => pointsToMove.delete(pid));
            // Afficher un message une seule fois au début du drag
            if (!isDraggingSelection) {
              toast.warning(`${lockedInSelection.length} point(s) verrouillé(s) non déplacé(s)`);
            }
          }

          // Déplacer tous les points (sauf les verrouillés)
          const newSketch = { ...currentSketch };
          newSketch.points = new Map(currentSketch.points);

          pointsToMove.forEach((pointId) => {
            const point = newSketch.points.get(pointId);
            if (point) {
              newSketch.points.set(pointId, {
                ...point,
                x: point.x + dx,
                y: point.y + dy,
              });
            }
          });

          setSketch(newSketch);
          setSelectionDragStart(worldPos);
          return;
        }
      }

      // Démarrer le drag si on a un target et qu'on a bougé d'au moins 3 pixels
      if (!isDragging && dragTarget && e.buttons === 1) {
        const dist = Math.sqrt((worldPos.x - dragStart.x) ** 2 + (worldPos.y - dragStart.y) ** 2);
        if (dist > 3 / viewport.scale) {
          setIsDragging(true);
        }
      }

      // Drag de point/poignée
      if (isDragging && dragTarget) {
        let targetPos = worldPos;

        // Snap pendant le drag (désactivé si Alt est maintenu)
        if (snapEnabled && !e.altKey) {
          const snap = snapSystemRef.current.findSnapPoint(
            screenX,
            screenY,
            sketchRef.current,
            viewport,
            [dragTarget.id],
            markerSnapPoints,
            { activeLayerOnly: snapToActiveLayerOnly, activeLayerId: sketchRef.current.activeLayerId },
          );
          if (snap) {
            targetPos = { x: snap.x, y: snap.y };
            setCurrentSnapPoint(snap);
          } else {
            setCurrentSnapPoint(null);
          }
        } else {
          // Alt maintenu ou snap désactivé = mouvement libre
          setCurrentSnapPoint(null);
        }

        // Mettre à jour la position du point - utiliser sketchRef.current pour éviter closures stales
        const currentSketch = sketchRef.current;
        if (dragTarget.type === "point") {
          const newSketch = { ...currentSketch };
          newSketch.points = new Map(currentSketch.points);
          const point = newSketch.points.get(dragTarget.id);
          if (point) {
            newSketch.points.set(dragTarget.id, {
              ...point,
              x: targetPos.x,
              y: targetPos.y,
            });
            setSketch(newSketch);
          }
        } else if (dragTarget.type === "handle" && dragTarget.handleType === "circleResize") {
          // Redimensionnement du cercle
          const newSketch = { ...currentSketch };
          newSketch.geometries = new Map(currentSketch.geometries);
          const circle = newSketch.geometries.get(dragTarget.id) as CircleType | undefined;
          if (circle && circle.type === "circle") {
            const center = currentSketch.points.get(circle.center);
            if (center) {
              const newRadius = distance(center, targetPos);
              newSketch.geometries.set(dragTarget.id, {
                ...circle,
                radius: newRadius,
              });
              setSketch(newSketch);
            }
          }
        } else if (dragTarget.type === "handle" && dragTarget.handleType === "lineMove") {
          // Déplacement de la ligne entière via la poignée du milieu
          const newSketch = { ...currentSketch };
          newSketch.points = new Map(currentSketch.points);
          const line = currentSketch.geometries.get(dragTarget.id) as Line | undefined;
          if (line && line.type === "line") {
            const p1 = newSketch.points.get(line.p1);
            const p2 = newSketch.points.get(line.p2);
            if (p1 && p2) {
              // Calculer le delta de mouvement
              const deltaX = targetPos.x - lastDragPos.x;
              const deltaY = targetPos.y - lastDragPos.y;

              // Déplacer les deux extrémités
              newSketch.points.set(line.p1, {
                ...p1,
                x: p1.x + deltaX,
                y: p1.y + deltaY,
              });
              newSketch.points.set(line.p2, {
                ...p2,
                x: p2.x + deltaX,
                y: p2.y + deltaY,
              });

              setSketch(newSketch);
              setLastDragPos(targetPos);
            }
          }
        }
        return;
      }

      // Snap (désactivé si Alt est maintenu)
      if (snapEnabled && !e.altKey) {
        const snap = snapSystemRef.current.findSnapPoint(
          screenX,
          screenY,
          sketchRef.current,
          viewport,
          [],
          markerSnapPoints,
          { activeLayerOnly: snapToActiveLayerOnly, activeLayerId: sketchRef.current.activeLayerId },
        );
        setCurrentSnapPoint(snap);
      } else {
        setCurrentSnapPoint(null);
      }

      // Hover
      const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
      setHoveredEntity(entityId);

      // Mise à jour géométrie temporaire
      if (tempGeometry) {
        let targetPos = worldPos;
        if (snapEnabled && currentSnapPoint) {
          targetPos = { x: currentSnapPoint.x, y: currentSnapPoint.y };
        }

        if (tempGeometry.type === "line" && tempPoints.length > 0) {
          const startPoint = tempPoints[0];

          // IMPORTANT: Pour la ligne, NE PAS utiliser le snap grille (évite les sauts de 10mm)
          // On garde le snap sur les points existants (endpoint, midpoint, etc.) mais pas la grille
          let lineTargetPos = worldPos;
          if (snapEnabled && currentSnapPoint && currentSnapPoint.type !== "grid") {
            // Garder le snap sur les points existants (pas la grille)
            lineTargetPos = { x: currentSnapPoint.x, y: currentSnapPoint.y };
          }

          // Détecter la perpendicularité avec les segments existants
          let perpInfo: typeof perpendicularInfo = null;
          const perpTolerance = 1.5; // degrés de tolérance (plus précis)
          const perpSnapDistance = 8 / viewport.scale; // distance de snap en monde (plus proche)

          // Direction de la ligne en cours (utiliser lineTargetPos sans snap grille)
          const lineDir = {
            x: lineTargetPos.x - startPoint.x,
            y: lineTargetPos.y - startPoint.y,
          };
          const lineLen = Math.sqrt(lineDir.x * lineDir.x + lineDir.y * lineDir.y);

          if (lineLen > 5) {
            // Minimum de longueur pour détecter
            const lineDirNorm = { x: lineDir.x / lineLen, y: lineDir.y / lineLen };

            // Parcourir les segments existants - utiliser sketchRef.current pour éviter closure stale
            const currentSketch = sketchRef.current;
            currentSketch.geometries.forEach((geo, geoId) => {
              if (geo.type !== "line" || perpInfo) return;

              const line = geo as Line;
              const p1 = currentSketch.points.get(line.p1);
              const p2 = currentSketch.points.get(line.p2);
              if (!p1 || !p2) return;

              // Direction du segment existant
              const segDir = { x: p2.x - p1.x, y: p2.y - p1.y };
              const segLen = Math.sqrt(segDir.x * segDir.x + segDir.y * segDir.y);
              if (segLen < 1) return;

              const segDirNorm = { x: segDir.x / segLen, y: segDir.y / segLen };

              // Produit scalaire pour vérifier la perpendicularité
              const dot = lineDirNorm.x * segDirNorm.x + lineDirNorm.y * segDirNorm.y;
              const angleDeg = (Math.acos(Math.abs(dot)) * 180) / Math.PI;

              // Si proche de 90° (dot proche de 0)
              if (angleDeg > 90 - perpTolerance && angleDeg < 90 + perpTolerance) {
                // Calculer le point d'intersection entre la ligne en cours et le segment
                // Ligne en cours: startPoint + t * lineDir
                // Segment: p1 + s * segDir

                const denom = lineDir.x * segDir.y - lineDir.y * segDir.x;
                if (Math.abs(denom) > 0.001) {
                  const t = ((p1.x - startPoint.x) * segDir.y - (p1.y - startPoint.y) * segDir.x) / denom;
                  const s = ((p1.x - startPoint.x) * lineDir.y - (p1.y - startPoint.y) * lineDir.x) / denom;

                  // Vérifier si l'intersection est sur le segment (0 <= s <= 1)
                  if (s >= -0.1 && s <= 1.1 && t > 0) {
                    const intersectionPoint = {
                      x: startPoint.x + t * lineDir.x,
                      y: startPoint.y + t * lineDir.y,
                    };

                    // Calculer le point snappé exactement perpendiculaire
                    // La direction perpendiculaire au segment
                    const perpDir = { x: -segDirNorm.y, y: segDirNorm.x };

                    // Projeter le curseur sur la direction perpendiculaire depuis startPoint
                    const toIntersection = {
                      x: intersectionPoint.x - startPoint.x,
                      y: intersectionPoint.y - startPoint.y,
                    };
                    const projLen = toIntersection.x * perpDir.x + toIntersection.y * perpDir.y;

                    const snappedCursor = {
                      x: startPoint.x + perpDir.x * projLen,
                      y: startPoint.y + perpDir.y * projLen,
                    };

                    // Distance entre curseur et position snappée
                    const snapDist = Math.sqrt(
                      (lineTargetPos.x - snappedCursor.x) ** 2 + (lineTargetPos.y - snappedCursor.y) ** 2,
                    );

                    // Si assez proche, activer le snap
                    if (snapDist < perpSnapDistance) {
                      perpInfo = {
                        isActive: true,
                        lineId: geoId,
                        intersectionPoint: intersectionPoint,
                        snappedCursor: snappedCursor,
                      };

                      // Appliquer le snap perpendiculaire
                      lineTargetPos = snappedCursor;
                    }
                  }
                }
              }
            });
          }

          setPerpendicularInfo(perpInfo);

          setTempGeometry({
            ...tempGeometry,
            cursor: lineTargetPos,
          });
        } else if (tempGeometry.type === "circle" && tempPoints.length > 0) {
          setPerpendicularInfo(null);
          // IMPORTANT: Pour le cercle, NE PAS utiliser le snap grille (évite les sauts de 10mm)
          let circleTargetPos = worldPos;
          if (snapEnabled && currentSnapPoint && currentSnapPoint.type !== "grid") {
            circleTargetPos = { x: currentSnapPoint.x, y: currentSnapPoint.y };
          }
          const radius = distance(tempPoints[0], circleTargetPos);
          setTempGeometry({
            ...tempGeometry,
            radius,
          });
        } else if (tempGeometry.type === "rectangle") {
          // OPTIMISATION: Utiliser callback pour éviter re-render si déjà null
          setPerpendicularInfo((prev) => (prev === null ? prev : null));

          // IMPORTANT: Pour le rectangle, NE PAS utiliser le snap (évite les sauts de 10mm sur la grille)
          // On utilise worldPos directement (position brute de la souris)
          let rectTargetX = worldPos.x;
          let rectTargetY = worldPos.y;

          // v7.31: Verrouiller les axes si des valeurs sont saisies
          const p1 = tempGeometry.p1;
          if (p1) {
            const lockedWidthVal = rectInputs.widthValue ? parseFloat(rectInputs.widthValue.replace(",", ".")) : 0;
            const lockedHeightVal = rectInputs.heightValue ? parseFloat(rectInputs.heightValue.replace(",", ".")) : 0;
            const isCenter = tempGeometry.mode === "center";

            // Si largeur verrouillée, contraindre X
            if (lockedWidthVal > 0) {
              const widthPx = lockedWidthVal * sketch.scaleFactor;
              const dirX = worldPos.x >= p1.x ? 1 : -1;
              rectTargetX = isCenter ? p1.x + (widthPx / 2) * dirX : p1.x + widthPx * dirX;
            }

            // Si hauteur verrouillée, contraindre Y
            if (lockedHeightVal > 0) {
              const heightPx = lockedHeightVal * sketch.scaleFactor;
              const dirY = worldPos.y >= p1.y ? 1 : -1;
              rectTargetY = isCenter ? p1.y + (heightPx / 2) * dirY : p1.y + heightPx * dirY;
            }
          }

          // Utiliser callback pour éviter re-render si curseur identique
          setTempGeometry((prev: any) => {
            if (!prev) return prev;
            // Comparaison avec tolérance pour éviter les micro-mises à jour
            const dx = Math.abs((prev.cursor?.x || 0) - rectTargetX);
            const dy = Math.abs((prev.cursor?.y || 0) - rectTargetY);
            if (dx < 0.5 && dy < 0.5) {
              return prev; // Pas de changement significatif
            }
            return {
              ...prev,
              cursor: { x: rectTargetX, y: rectTargetY },
            };
          });

          // Activer les inputs une seule fois (callback retourne même obj si déjà actif)
          setRectInputs((prev) => (prev.active ? prev : { ...prev, active: true }));
        } else if (tempGeometry.type === "bezier") {
          setPerpendicularInfo(null);
          // IMPORTANT: Pour Bézier, NE PAS utiliser le snap grille
          let bezierTargetPos = worldPos;
          if (snapEnabled && currentSnapPoint && currentSnapPoint.type !== "grid") {
            bezierTargetPos = { x: currentSnapPoint.x, y: currentSnapPoint.y };
          }
          setTempGeometry({
            ...tempGeometry,
            cursor: bezierTargetPos,
          });
        } else if (tempGeometry.type === "arc3points") {
          setPerpendicularInfo(null);
          // IMPORTANT: Pour arc 3 points, NE PAS utiliser le snap grille
          let arc3TargetPos = worldPos;
          if (snapEnabled && currentSnapPoint && currentSnapPoint.type !== "grid") {
            arc3TargetPos = { x: currentSnapPoint.x, y: currentSnapPoint.y };
          }
          setTempGeometry({
            ...tempGeometry,
            cursor: arc3TargetPos,
          });
        } else if (tempGeometry.type === "polygon" && tempPoints.length > 0) {
          setPerpendicularInfo(null);
          // Pour le polygone, utiliser worldPos sans snap grille
          let polygonTargetPos = worldPos;
          if (snapEnabled && currentSnapPoint && currentSnapPoint.type !== "grid") {
            polygonTargetPos = { x: currentSnapPoint.x, y: currentSnapPoint.y };
          }
          setTempGeometry({
            ...tempGeometry,
            cursor: polygonTargetPos,
            scaleFactor: sketchRef.current.scaleFactor,
          });
        } else if (tempGeometry.type === "spline") {
          setPerpendicularInfo(null);
          // Pour la spline, mettre à jour le curseur
          let splineTargetPos = worldPos;
          if (snapEnabled && currentSnapPoint && currentSnapPoint.type !== "grid") {
            splineTargetPos = { x: currentSnapPoint.x, y: currentSnapPoint.y };
          }
          setTempGeometry({
            ...tempGeometry,
            cursor: splineTargetPos,
          });
        } else if (tempGeometry.type === "mirrorAxis" && tempGeometry.p1) {
          setPerpendicularInfo(null);

          // IMPORTANT: Utiliser worldPos (pas targetPos) pour éviter le snap grille
          const mirrorTarget = worldPos;
          const p1 = tempGeometry.p1;
          const dx = mirrorTarget.x - p1.x;
          const dy = mirrorTarget.y - p1.y;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);

          // Snap à horizontal/vertical/45° (tolérance de 5°)
          let finalTarget = mirrorTarget;

          // Snap horizontal
          if (Math.abs(angle) < 5 || Math.abs(Math.abs(angle) - 180) < 5) {
            finalTarget = { x: mirrorTarget.x, y: p1.y };
          }
          // Snap vertical
          else if (Math.abs(Math.abs(angle) - 90) < 5) {
            finalTarget = { x: p1.x, y: mirrorTarget.y };
          }
          // Snap 45°
          else if (Math.abs(Math.abs(angle) - 45) < 5 || Math.abs(Math.abs(angle) - 135) < 5) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            const sign45X = dx >= 0 ? 1 : -1;
            const sign45Y = dy >= 0 ? 1 : -1;
            finalTarget = {
              x: p1.x + sign45X * dist * Math.cos(Math.PI / 4),
              y: p1.y + sign45Y * dist * Math.sin(Math.PI / 4),
            };
          }

          // Calculer la preview des entités miroir
          const mirrorPreview = calculateMirrorPreview(p1, finalTarget);

          setTempGeometry({
            ...tempGeometry,
            p2: finalTarget,
            selectionCenter: mirrorSelectionData?.center || null,
            mirrorPreview,
          });
        }
      } else {
        setPerpendicularInfo(null);
      }

      // Mise à jour mesure en cours (preview)
      if (activeTool === "measure" && measureState.phase === "waitingSecond" && measureState.start) {
        setMeasurePreviewEnd(worldPos);
      }

      // Mise à jour de la sélection rectangulaire
      if (selectionBox) {
        setSelectionBox((prev) => (prev ? { ...prev, end: worldPos } : null));
      }
    },
    [
      isPanning,
      isDragging,
      isDraggingSelection,
      potentialSelectionDrag,
      panStart,
      dragTarget,
      dragStart,
      lastDragPos,
      selectionDragStart,
      sketch,
      viewport,
      snapEnabled,
      tempGeometry,
      tempPoints,
      currentSnapPoint,
      findEntityAtPosition,
      screenToWorld,
      activeTool,
      measureState,
      draggingCalibrationPoint,
      draggingMeasurePoint,
      calibrationData,
      selectionBox,
      selectedEntities,
      // Multi-photos
      isDraggingImage,
      imageDragStart,
      selectedImageId,
      markerSnapPoints,
      draggingMarker,
      // Gizmo drag
      gizmoDrag,
      updateGizmoDrag,
      // Mirror preview
      calculateMirrorPreview,
      mirrorSelectionData,
      // Grille A4
      isDraggingA4Origin,
      // Note: isDraggingRevealRef.current utilisé directement (pas dans deps)
    ],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      const screenX = rect ? e.clientX - rect.left : 0;
      const screenY = rect ? e.clientY - rect.top : 0;
      const worldPos = screenToWorld(screenX, screenY);

      // Fin du pan
      if (isPanning) {
        setIsPanning(false);
      }

      // === Fin du drag de l'origine de la grille A4 ===
      if (isDraggingA4Origin) {
        setIsDraggingA4Origin(false);
        return;
      }

      // === Gizmo drag: bouton droit = annuler, bouton gauche = valider ===
      if (gizmoDrag) {
        if (e.button === 2) {
          // Clic droit: ANNULER et restaurer les positions initiales
          setSketch((prev) => {
            const newSketch = { ...prev };
            newSketch.points = new Map(prev.points);

            for (const [pointId, initialPos] of gizmoDrag.initialPositions) {
              newSketch.points.set(pointId, { id: pointId, x: initialPos.x, y: initialPos.y });
            }

            return newSketch;
          });
          setGizmoDrag(null);
          setShowTransformGizmo(false);
          toast.info("Transformation annulée");
        } else {
          // Clic gauche: VALIDER
          endGizmoDrag();
        }
        return;
      }

      // === Multi-photos: fin du drag d'une image ===
      if (isDraggingImage) {
        // Vérifier si l'image a vraiment bougé
        if (imageDragStart && selectedImageId) {
          const movedImage = backgroundImages.find((img) => img.id === selectedImageId);
          if (movedImage) {
            const hasMoved = movedImage.x !== imageDragStart.imgX || movedImage.y !== imageDragStart.imgY;
            if (!hasMoved) {
              // Pas de déplacement réel - retirer le dernier état de l'historique
              setImageHistory((prev) => prev.slice(0, -1));
            }
          }
        }
        setIsDraggingImage(false);
        setImageDragStart(null);
        return;
      }

      // === Fin du drag d'un marker ===
      if (draggingMarker) {
        setDraggingMarker(null);
        return;
      }

      // Fin du drag d'un point de mesure
      if (draggingMeasurePoint) {
        setDraggingMeasurePoint(null);
        setCurrentSnapPoint(null);
        return;
      }

      // Fin de la sélection rectangulaire
      if (selectionBox) {
        const box = selectionBox;
        const minX = Math.min(box.start.x, box.end.x);
        const maxX = Math.max(box.start.x, box.end.x);
        const minY = Math.min(box.start.y, box.end.y);
        const maxY = Math.max(box.start.y, box.end.y);

        // Détecter le mode de sélection
        // Gauche → Droite = mode "fenêtre" (éléments entièrement contenus)
        // Droite → Gauche = mode "capture" (éléments qui touchent)
        const isWindowMode = box.end.x >= box.start.x;

        // Sélectionner toutes les géométries selon le mode
        const newSelection = e.shiftKey ? new Set(selectedEntities) : new Set<string>();

        sketch.geometries.forEach((geo, id) => {
          // Vérifier la visibilité du calque
          const layerId = geo.layerId || "trace";
          const layer = sketch.layers.get(layerId);
          if (layer?.visible === false) return;

          let isSelected = false;

          if (geo.type === "line") {
            const line = geo as Line;
            const p1 = sketch.points.get(line.p1);
            const p2 = sketch.points.get(line.p2);
            if (p1 && p2) {
              const p1InBox = p1.x >= minX && p1.x <= maxX && p1.y >= minY && p1.y <= maxY;
              const p2InBox = p2.x >= minX && p2.x <= maxX && p2.y >= minY && p2.y <= maxY;

              if (isWindowMode) {
                // Mode Fenêtre : les DEUX points doivent être dans la zone
                isSelected = p1InBox && p2InBox;
              } else {
                // Mode Capture : AU MOINS UN point dans la zone OU la ligne traverse la zone
                isSelected = p1InBox || p2InBox || lineIntersectsBox(p1, p2, minX, minY, maxX, maxY);
              }
            }
          } else if (geo.type === "circle") {
            const circle = geo as CircleType;
            const center = sketch.points.get(circle.center);
            if (center) {
              if (isWindowMode) {
                // Mode Fenêtre : le cercle entier doit être dans la zone
                isSelected =
                  center.x - circle.radius >= minX &&
                  center.x + circle.radius <= maxX &&
                  center.y - circle.radius >= minY &&
                  center.y + circle.radius <= maxY;
              } else {
                // Mode Capture : le cercle touche la zone
                const centerInBox = center.x >= minX && center.x <= maxX && center.y >= minY && center.y <= maxY;
                const circleIntersects = circleIntersectsBox(center, circle.radius, minX, minY, maxX, maxY);
                isSelected = centerInBox || circleIntersects;
              }
            }
          } else if (geo.type === "bezier") {
            const bezier = geo as Bezier;
            const p1 = sketch.points.get(bezier.p1);
            const p2 = sketch.points.get(bezier.p2);
            if (p1 && p2) {
              const p1InBox = p1.x >= minX && p1.x <= maxX && p1.y >= minY && p1.y <= maxY;
              const p2InBox = p2.x >= minX && p2.x <= maxX && p2.y >= minY && p2.y <= maxY;

              if (isWindowMode) {
                isSelected = p1InBox && p2InBox;
              } else {
                isSelected = p1InBox || p2InBox;
              }
            }
          } else if (geo.type === "arc") {
            // Gérer les arcs (congés, chanfreins)
            const arc = geo as Arc;
            const center = sketch.points.get(arc.center);
            const startPt = sketch.points.get(arc.startPoint);
            const endPt = sketch.points.get(arc.endPoint);
            if (center && startPt && endPt) {
              const startInBox = startPt.x >= minX && startPt.x <= maxX && startPt.y >= minY && startPt.y <= maxY;
              const endInBox = endPt.x >= minX && endPt.x <= maxX && endPt.y >= minY && endPt.y <= maxY;
              const centerInBox = center.x >= minX && center.x <= maxX && center.y >= minY && center.y <= maxY;

              if (isWindowMode) {
                // Mode Fenêtre : les deux extrémités doivent être dans la zone
                isSelected = startInBox && endInBox;
              } else {
                // Mode Capture : au moins une extrémité dans la zone ou l'arc touche la zone
                isSelected =
                  startInBox ||
                  endInBox ||
                  centerInBox ||
                  arcIntersectsBox(center, arc.radius, startPt, endPt, minX, minY, maxX, maxY);
              }
            }
          } else if (geo.type === "text") {
            // Texte : vérifier si la bounding box du texte intersecte la zone de sélection
            const text = geo as TextAnnotation;
            const position = sketch.points.get(text.position);
            if (position) {
              // Estimer la taille du texte
              const charWidth = text.fontSize * 0.6;
              const textWidth = text.content.length * charWidth;
              const textHeight = text.fontSize * 1.2;

              // Bounding box du texte selon l'alignement
              let textMinX: number, textMaxX: number;
              if (text.alignment === "center") {
                textMinX = position.x - textWidth / 2;
                textMaxX = position.x + textWidth / 2;
              } else if (text.alignment === "right") {
                textMinX = position.x - textWidth;
                textMaxX = position.x;
              } else {
                // left
                textMinX = position.x;
                textMaxX = position.x + textWidth;
              }
              const textMinY = position.y - textHeight;
              const textMaxY = position.y + textHeight / 2;

              if (isWindowMode) {
                // Mode Fenêtre : le texte entier doit être dans la zone
                isSelected = textMinX >= minX && textMaxX <= maxX && textMinY >= minY && textMaxY <= maxY;
              } else {
                // Mode Capture : le texte touche la zone (intersection des bounding boxes)
                isSelected = !(textMaxX < minX || textMinX > maxX || textMaxY < minY || textMinY > maxY);
              }
            }
          }

          if (isSelected) {
            newSelection.add(id);
          }
        });

        // v7.32: Sélection des photos par rectangle
        const newImageSelection = e.shiftKey ? new Set(selectedImageIds) : new Set<string>();
        backgroundImages.forEach((img) => {
          // Vérifier la visibilité
          if (!img.visible) return;
          const layer = sketch.layers.get(img.layerId || "");
          if (layer?.visible === false) return;

          // Calculer la bounding box de l'image en coordonnées monde
          const imgWidth = (img.image?.width || 100) * img.scale;
          const imgHeight = (img.image?.height || 100) * img.scale;
          const imgMinX = img.x - imgWidth / 2;
          const imgMaxX = img.x + imgWidth / 2;
          const imgMinY = img.y - imgHeight / 2;
          const imgMaxY = img.y + imgHeight / 2;

          let isSelected = false;
          if (isWindowMode) {
            // Mode Fenêtre : l'image entière doit être dans la zone
            isSelected = imgMinX >= minX && imgMaxX <= maxX && imgMinY >= minY && imgMaxY <= maxY;
          } else {
            // Mode Capture : l'image touche la zone
            isSelected = !(imgMaxX < minX || imgMinX > maxX || imgMaxY < minY || imgMinY > maxY);
          }

          if (isSelected) {
            newImageSelection.add(img.id);
          }
        });

        // Mettre à jour les sélections
        if (newSelection.size > 0) {
          setSelectedEntities(newSelection);
        }
        if (newImageSelection.size > 0) {
          setSelectedImageIds(newImageSelection);
          // Sélectionner aussi la première image pour les outils
          if (newImageSelection.size === 1) {
            setSelectedImageId(Array.from(newImageSelection)[0]);
          }
        }

        const totalSelected = newSelection.size + newImageSelection.size;
        if (totalSelected > 0) {
          const modeText = isWindowMode ? "fenêtre" : "capture";
          const details: string[] = [];
          if (newSelection.size > 0) details.push(`${newSelection.size} entité(s)`);
          if (newImageSelection.size > 0) details.push(`${newImageSelection.size} photo(s)`);
          toast.success(`${details.join(" + ")} sélectionné(s) (mode ${modeText})`);
        }

        setSelectionBox(null);
        return;
      }

      // Fin du drag d'un point de calibration
      if (draggingCalibrationPoint) {
        setDraggingCalibrationPoint(null);
        // Recalculer les distances en pixels des paires
        setCalibrationData((prev) => {
          const newPairs = new Map(prev.pairs);
          newPairs.forEach((pair, id) => {
            const p1 = prev.points.get(pair.point1Id);
            const p2 = prev.points.get(pair.point2Id);
            if (p1 && p2) {
              newPairs.set(id, { ...pair, distancePx: distance(p1, p2) });
            }
          });
          return { ...prev, pairs: newPairs };
        });
        return;
      }

      // Fin du drag de sélection
      if (isDraggingSelection) {
        addToHistory(sketchRef.current);
        // NE PAS appeler solveSketch - évite de "corriger" les contraintes H/V
        // solveSketch(sketchRef.current);
        setIsDraggingSelection(false);
        setPotentialSelectionDrag(false);
        return;
      }

      // Reset du flag potentiel drag même si on n'a pas bougé
      if (potentialSelectionDrag) {
        setPotentialSelectionDrag(false);
      }

      // Fin du drag - sauvegarder dans l'historique
      if (isDragging && dragTarget) {
        addToHistory(sketchRef.current);
        // NE PAS appeler solveSketch - évite de "corriger" les contraintes H/V
        // solveSketch(sketchRef.current);
        setIsDragging(false);
        setDragTarget(null);
      } else if (dragTarget) {
        // Clic simple sur un point sans bouger - juste nettoyer
        setDragTarget(null);
      }
    },
    [
      isPanning,
      isDragging,
      isDraggingSelection,
      potentialSelectionDrag,
      dragTarget,
      sketch,
      addToHistory,
      solveSketch,
      draggingCalibrationPoint,
      draggingMeasurePoint,
      selectionBox,
      selectedEntities,
      screenToWorld,
      // Multi-photos
      isDraggingImage,
      imageDragStart,
      selectedImageId,
      backgroundImages,
      draggingMarker,
      // Gizmo drag
      gizmoDrag,
      endGizmoDrag,
      // Grille A4
      isDraggingA4Origin,
    ],
  );

  // v7.31: Fonction pour trouver une cotation (dimension text) à une position écran
  const findDimensionAtScreenPos = useCallback(
    (
      screenX: number,
      screenY: number,
    ): { dimensionId: string; entityId: string; type: "line" | "circle"; value: number } | null => {
      const currentSketch = sketchRef.current;

      // Parcourir les dimensions existantes
      for (const [dimId, dimension] of currentSketch.dimensions) {
        if (dimension.type === "horizontal" || dimension.type === "vertical" || dimension.type === "linear") {
          if (dimension.entities.length < 2) continue;

          const p1 = currentSketch.points.get(dimension.entities[0]);
          const p2 = currentSketch.points.get(dimension.entities[1]);
          if (!p1 || !p2) continue;

          const offset = 20 / viewport.scale;

          // Calculer la position de la ligne de cote (comme dans drawLinearDimension)
          let dimLine1: { x: number; y: number };
          let dimLine2: { x: number; y: number };

          if (dimension.type === "horizontal") {
            dimLine1 = { x: p1.x, y: Math.min(p1.y, p2.y) - offset };
            dimLine2 = { x: p2.x, y: Math.min(p1.y, p2.y) - offset };
          } else if (dimension.type === "vertical") {
            dimLine1 = { x: Math.max(p1.x, p2.x) + offset, y: p1.y };
            dimLine2 = { x: Math.max(p1.x, p2.x) + offset, y: p2.y };
          } else {
            // Linear - perpendiculaire
            const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x) + Math.PI / 2;
            dimLine1 = { x: p1.x + Math.cos(ang) * offset, y: p1.y + Math.sin(ang) * offset };
            dimLine2 = { x: p2.x + Math.cos(ang) * offset, y: p2.y + Math.sin(ang) * offset };
          }

          // Position du texte (milieu de la ligne de cote)
          const textWorldX = (dimLine1.x + dimLine2.x) / 2;
          const textWorldY = (dimLine1.y + dimLine2.y) / 2;
          const textScreenX = textWorldX * viewport.scale + viewport.offsetX;
          const textScreenY = textWorldY * viewport.scale + viewport.offsetY;

          // Zone de hit pour la cotation
          const hitWidth = 70;
          const hitHeight = 25;
          if (
            screenX >= textScreenX - hitWidth / 2 &&
            screenX <= textScreenX + hitWidth / 2 &&
            screenY >= textScreenY - hitHeight / 2 &&
            screenY <= textScreenY + hitHeight / 2
          ) {
            // Chercher la ligne qui utilise ces deux points
            let foundLineId = "";
            for (const [geoId, geo] of currentSketch.geometries) {
              if (geo.type === "line") {
                const line = geo as Line;
                if (
                  (line.p1 === dimension.entities[0] && line.p2 === dimension.entities[1]) ||
                  (line.p1 === dimension.entities[1] && line.p2 === dimension.entities[0])
                ) {
                  foundLineId = geoId;
                  break;
                }
              }
            }
            return { dimensionId: dimId, entityId: foundLineId, type: "line", value: dimension.value };
          }
        }
      }
      return null;
    },
    [viewport],
  );

  // Double-clic pour éditer un arc OU sélectionner une figure entière
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = screenToWorld(screenX, screenY);

      // v7.31: Vérifier d'abord si on double-clic sur une cotation existante
      if (activeTool === "select" && showDimensions) {
        const dimHit = findDimensionAtScreenPos(screenX, screenY);
        if (dimHit) {
          setEditingDimension({
            dimensionId: dimHit.dimensionId,
            entityId: dimHit.entityId,
            type: dimHit.type,
            currentValue: dimHit.value,
            screenPos: { x: screenX, y: screenY },
          });
          return;
        }
      }

      // Double-clic pour terminer la spline
      if (activeTool === "spline" && tempPoints.length >= 2) {
        // Créer la spline avec les points collectés
        const currentSketch = sketchRef.current;
        const newSketch = { ...currentSketch };
        newSketch.points = new Map(currentSketch.points);
        newSketch.geometries = new Map(currentSketch.geometries);

        const pointIds: string[] = [];
        for (const pt of tempPoints) {
          if (!currentSketch.points.has(pt.id)) {
            newSketch.points.set(pt.id, pt);
          }
          pointIds.push(pt.id);
        }

        const spline: SplineType = {
          id: generateId(),
          type: "spline",
          points: pointIds,
          closed: false,
          tension: 0.5,
          layerId: currentSketch.activeLayerId,
        };
        newSketch.geometries.set(spline.id, spline);

        setSketch(newSketch);
        addToHistory(newSketch, "Spline");
        setTempPoints([]);
        setTempGeometry(null);
        toast.success(`Spline créée (${pointIds.length} points)`);
        return;
      }

      // Vérifier d'abord si on a cliqué sur un point (coin potentiel)
      const pointId = findPointAtPosition(worldPos.x, worldPos.y);
      if (pointId) {
        // Vérifier si c'est un coin (2 lignes connectées)
        const connectedLines = findLinesConnectedToPoint(pointId);
        if (connectedLines.length === 2) {
          // C'est un coin ! Ouvrir le panneau congé
          openFilletDialogForPoint(pointId);
          return;
        }
      }

      const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
      if (entityId) {
        const geo = sketch.geometries.get(entityId);
        if (geo) {
          // Si la modale offset est ouverte, double-clic = sélectionner le contour
          if (offsetDialog?.open) {
            selectContourForOffset(entityId);
            toast.success("Contour sélectionné");
            return;
          }

          if (geo.type === "text") {
            // Double-clic sur texte → ouvrir l'édition inline
            const textGeo = geo as TextAnnotation;
            const position = sketch.points.get(textGeo.position);
            if (position) {
              const rect = canvasRef.current?.getBoundingClientRect();
              if (rect) {
                const screenPos = worldToScreen(position.x, position.y);
                // Convertir en coordonnées fixed (relatives à la fenêtre)
                setTextInput({
                  active: true,
                  position: { x: position.x, y: position.y },
                  screenPos: { x: rect.left + screenPos.x, y: rect.top + screenPos.y },
                  content: textGeo.content,
                  editingId: entityId,
                });
                // Charger les paramètres du texte existant
                setTextFontSize(textGeo.fontSize);
                setTextColor(textGeo.color || "#000000");
                setTextAlignment(textGeo.alignment || "left");
                setTimeout(() => {
                  textInputRef.current?.focus();
                  textInputRef.current?.select();
                }, 10);
              }
            }
            return;
          }

          if (geo.type === "arc" || geo.type === "line" || geo.type === "bezier") {
            // Double-clic → sélectionner toute la figure connectée
            const connectedGeos = findConnectedGeometries(entityId);

            // Si Shift est enfoncé, AJOUTER à la sélection existante
            if (e.shiftKey) {
              setSelectedEntities((prev) => {
                const newSelection = new Set(prev);
                connectedGeos.forEach((id) => newSelection.add(id));
                return newSelection;
              });
              toast.success(`${connectedGeos.size} élément(s) ajouté(s) à la sélection`);
            } else {
              // Sans Shift, REMPLACER la sélection
              setSelectedEntities(connectedGeos);
              setReferenceHighlight(null); // Reset le highlight vert
              if (connectedGeos.size > 1) {
                toast.success(`${connectedGeos.size} élément(s) sélectionné(s)`);
              }
            }
          }
        }
      }
    },
    [
      screenToWorld,
      worldToScreen,
      findEntityAtPosition,
      findPointAtPosition,
      sketch.geometries,
      sketch.points,
      findConnectedGeometries,
      offsetDialog,
      selectContourForOffset,
      findLinesConnectedToPoint,
      openFilletDialogForPoint,
      activeTool,
      addToHistory,
      tempPoints,
      findDimensionAtScreenPos,
      showDimensions,
    ],
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(viewport.scale * zoomFactor, 0.001), 5000);

      // Zoom vers la position de la souris
      const worldPos = screenToWorld(mouseX, mouseY);
      const newOffsetX = mouseX - worldPos.x * newScale;
      const newOffsetY = mouseY - worldPos.y * newScale;

      setViewport((v) => ({
        ...v,
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      }));
    },
    [viewport.scale, screenToWorld],
  );

  // Attacher l'événement wheel avec passive: false pour bloquer le scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  // Supprimer les entités sélectionnées
  const deleteSelectedEntities = useCallback(() => {
    // Vérifier si une entité est sur un calque verrouillé
    for (const id of selectedEntities) {
      if (isEntityOnLockedLayer(id)) {
        toast.error("Impossible de supprimer : une ou plusieurs entités sont sur un calque verrouillé");
        return;
      }
    }

    const newSketch = { ...sketch };
    newSketch.points = new Map(sketch.points);
    newSketch.geometries = new Map(sketch.geometries);
    newSketch.constraints = new Map(sketch.constraints);

    // Traiter chaque entité sélectionnée
    selectedEntities.forEach((id) => {
      const geo = newSketch.geometries.get(id);

      // Si c'est un arc CONGÉ (isFillet === true), restaurer le coin
      if (geo && geo.type === "arc" && (geo as Arc).isFillet === true) {
        const arc = geo as Arc;
        const startPt = newSketch.points.get(arc.startPoint);
        const endPt = newSketch.points.get(arc.endPoint);

        if (startPt && endPt) {
          // Trouver les lignes connectées aux points de tangence
          const linesAtStart: Line[] = [];
          const linesAtEnd: Line[] = [];

          newSketch.geometries.forEach((g) => {
            if (g.type === "line") {
              const line = g as Line;
              if (line.p1 === arc.startPoint || line.p2 === arc.startPoint) {
                linesAtStart.push(line);
              }
              if (line.p1 === arc.endPoint || line.p2 === arc.endPoint) {
                linesAtEnd.push(line);
              }
            }
          });

          // Si c'est un congé valide (une ligne à chaque extrémité)
          if (linesAtStart.length === 1 && linesAtEnd.length === 1) {
            const line1 = linesAtStart[0];
            const line2 = linesAtEnd[0];

            const other1Id = line1.p1 === arc.startPoint ? line1.p2 : line1.p1;
            const other2Id = line2.p1 === arc.endPoint ? line2.p2 : line2.p1;

            const other1 = newSketch.points.get(other1Id);
            const other2 = newSketch.points.get(other2Id);

            if (other1 && other2) {
              // Calculer l'intersection (le coin)
              const corner = lineIntersection(startPt, other1, endPt, other2);

              if (corner) {
                // Créer le point de coin
                const cornerId = generateId();
                newSketch.points.set(cornerId, { id: cornerId, x: corner.x, y: corner.y });

                // Modifier les lignes pour pointer vers le coin
                const updatedLine1: Line = {
                  ...line1,
                  p1: line1.p1 === arc.startPoint ? cornerId : line1.p1,
                  p2: line1.p2 === arc.startPoint ? cornerId : line1.p2,
                };
                const updatedLine2: Line = {
                  ...line2,
                  p1: line2.p1 === arc.endPoint ? cornerId : line2.p1,
                  p2: line2.p2 === arc.endPoint ? cornerId : line2.p2,
                };

                newSketch.geometries.set(line1.id, updatedLine1);
                newSketch.geometries.set(line2.id, updatedLine2);

                // Supprimer les points de l'arc
                newSketch.points.delete(arc.startPoint);
                newSketch.points.delete(arc.endPoint);
                newSketch.points.delete(arc.center);
              }
            }
          }
        }

        // Supprimer l'arc
        newSketch.geometries.delete(id);
      } else if (geo && geo.type === "arc") {
        // Arc normal (pas un congé) - supprimer simplement sans restaurer de coin
        newSketch.geometries.delete(id);
        // Ne pas supprimer les points car ils peuvent être partagés avec d'autres géométries
      } else {
        // Supprimer normalement les autres entités
        newSketch.points.delete(id);
        newSketch.geometries.delete(id);
        newSketch.constraints.delete(id);
      }
    });

    // Nettoyer les points orphelins (non utilisés par aucune géométrie)
    const usedPointIds = new Set<string>();
    newSketch.geometries.forEach((geo) => {
      if (geo.type === "line") {
        const line = geo as Line;
        usedPointIds.add(line.p1);
        usedPointIds.add(line.p2);
      } else if (geo.type === "circle") {
        usedPointIds.add((geo as CircleType).center);
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        usedPointIds.add(arc.center);
        usedPointIds.add(arc.startPoint);
        usedPointIds.add(arc.endPoint);
      } else if (geo.type === "rectangle") {
        const rect = geo as Rectangle;
        usedPointIds.add(rect.p1);
        usedPointIds.add(rect.p2);
        usedPointIds.add(rect.p3);
        usedPointIds.add(rect.p4);
      } else if (geo.type === "bezier") {
        const bezier = geo as Bezier;
        usedPointIds.add(bezier.p1);
        usedPointIds.add(bezier.p2);
        usedPointIds.add(bezier.cp1);
        usedPointIds.add(bezier.cp2);
      }
    });

    // Supprimer les points orphelins
    const orphanPoints: string[] = [];
    newSketch.points.forEach((_, id) => {
      if (!usedPointIds.has(id)) {
        orphanPoints.push(id);
      }
    });
    orphanPoints.forEach((id) => newSketch.points.delete(id));

    setSketch(newSketch);
    setSelectedEntities(new Set());
    const count = selectedEntities.size;
    addToHistory(newSketch, `Suppression (${count})`);
    solveSketch(newSketch);
  }, [sketch, selectedEntities, solveSketch, addToHistory, lineIntersection, isEntityOnLockedLayer]);

  // Undo/Redo
  // MOD v7.12: Comparaison chronologique des historiques sketch et image
  const undo = useCallback(() => {
    const branch = branches.find((b) => b.id === activeBranchId);
    const sketchCanUndo = branch && branch.historyIndex > 0;
    const imageCanUndo = imageHistory.length > 0;

    // Si aucun des deux ne peut annuler, on sort
    if (!sketchCanUndo && !imageCanUndo) {
      return;
    }

    // Récupérer les timestamps pour comparer
    let sketchTimestamp = 0;
    let imageTimestamp = 0;

    if (sketchCanUndo && branch) {
      // Le timestamp de l'entrée ACTUELLE (celle qu'on va annuler)
      const currentEntry = branch.history[branch.historyIndex];
      sketchTimestamp = currentEntry?.timestamp || 0;
    }

    if (imageCanUndo) {
      const lastImageState = imageHistory[imageHistory.length - 1];
      imageTimestamp = lastImageState.timestamp || 0;
    }

    // Annuler la modification la plus récente (timestamp le plus élevé)
    if (imageCanUndo && (!sketchCanUndo || imageTimestamp >= sketchTimestamp)) {
      // Annuler la modification d'image
      const lastState = imageHistory[imageHistory.length - 1];
      setBackgroundImages(lastState.backgroundImages);
      setMarkerLinks(lastState.markerLinks);
      setImageHistory((prev) => prev.slice(0, -1));
      toast.success("Photo restaurée");
      return;
    }

    if (sketchCanUndo && branch) {
      // Annuler la modification du sketch
      const newIndex = branch.historyIndex - 1;
      const prevEntry = branch.history[newIndex];
      loadSketchData(prevEntry.sketch);

      // Mettre à jour la branche
      const branchIndex = branches.findIndex((b) => b.id === activeBranchId);
      const updatedBranch = { ...branch, historyIndex: newIndex };
      const newBranches = [...branches];
      newBranches[branchIndex] = updatedBranch;
      setBranches(newBranches);
      branchesRef.current = { branches: newBranches, activeBranchId };
      historyRef.current = { history: branch.history, index: newIndex };
      setPreviewHistoryIndex(null);
    }
  }, [branches, activeBranchId, loadSketchData, imageHistory]);

  const redo = useCallback(() => {
    const branch = branches.find((b) => b.id === activeBranchId);
    const sketchCanRedo = branch && branch.historyIndex < branch.history.length - 1;

    if (sketchCanRedo && branch) {
      const newIndex = branch.historyIndex + 1;
      const nextEntry = branch.history[newIndex];
      loadSketchData(nextEntry.sketch);

      // Mettre à jour la branche
      const branchIndex = branches.findIndex((b) => b.id === activeBranchId);
      const updatedBranch = { ...branch, historyIndex: newIndex };
      const newBranches = [...branches];
      newBranches[branchIndex] = updatedBranch;
      setBranches(newBranches);
      branchesRef.current = { branches: newBranches, activeBranchId };
      historyRef.current = { history: branch.history, index: newIndex };
      setPreviewHistoryIndex(null);
    }
  }, [branches, activeBranchId, loadSketchData]);

  // Aller à une version spécifique de l'historique
  const goToHistoryIndex = useCallback(
    (targetIndex: number) => {
      const branch = branches.find((b) => b.id === activeBranchId);
      if (!branch || targetIndex < 0 || targetIndex >= branch.history.length) return;

      const entry = branch.history[targetIndex];
      loadSketchData(entry.sketch);

      // Mettre à jour la branche
      const branchIndex = branches.findIndex((b) => b.id === activeBranchId);
      const updatedBranch = { ...branch, historyIndex: targetIndex };
      const newBranches = [...branches];
      newBranches[branchIndex] = updatedBranch;
      setBranches(newBranches);
      branchesRef.current = { branches: newBranches, activeBranchId };
      historyRef.current = { history: branch.history, index: targetIndex };
      setPreviewHistoryIndex(null);
      toast.success(`Retour à: ${entry.description}`);
    },
    [branches, activeBranchId, loadSketchData],
  );

  // Créer une nouvelle branche à partir d'un point de l'historique
  const createBranchFromHistoryIndex = useCallback(
    (targetIndex: number, branchName?: string) => {
      const parentBranch = branches.find((b) => b.id === activeBranchId);
      if (!parentBranch || targetIndex < 0 || targetIndex >= parentBranch.history.length) return;

      // Vérifier la limite de 10 branches
      if (branches.length >= 10) {
        toast.error("Maximum 10 branches atteint");
        return;
      }

      const entry = parentBranch.history[targetIndex];

      // Trouver la prochaine couleur disponible
      const usedColors = new Set(branches.map((b) => b.color));
      const nextColor =
        BRANCH_COLORS.find((c) => !usedColors.has(c)) || BRANCH_COLORS[branches.length % BRANCH_COLORS.length];

      // Générer un nom unique pour la branche
      let branchNumber = branches.length + 1;
      const existingNames = new Set(branches.map((b) => b.name));
      while (existingNames.has(`Branche ${branchNumber}`)) {
        branchNumber++;
      }

      // Créer la nouvelle branche
      const newBranchId = generateId();
      const newBranch: Branch = {
        id: newBranchId,
        name: branchName || `Branche ${branchNumber}`,
        color: nextColor,
        history: parentBranch.history.slice(0, targetIndex + 1), // Copier l'historique jusqu'au point de branchement
        historyIndex: targetIndex,
        parentBranchId: activeBranchId,
        parentHistoryIndex: targetIndex,
        createdAt: Date.now(),
      };

      // Charger l'état
      loadSketchData(entry.sketch);

      // Ajouter la branche et la rendre active
      const newBranches = [...branches, newBranch];
      setBranches(newBranches);
      setActiveBranchId(newBranchId);
      setVisibleBranches((prev) => new Set([...prev, newBranchId]));
      branchesRef.current = { branches: newBranches, activeBranchId: newBranchId };
      historyRef.current = { history: newBranch.history, index: targetIndex };
      setPreviewHistoryIndex(null);

      toast.success(`Nouvelle branche créée: ${newBranch.name}`);
    },
    [branches, activeBranchId, loadSketchData],
  );

  // Supprimer l'historique après un point (garde l'état cliqué, supprime ce qui est après)
  const truncateHistoryAtIndex = useCallback(
    (targetIndex: number) => {
      const branch = branches.find((b) => b.id === activeBranchId);
      if (!branch || targetIndex < 0 || targetIndex >= branch.history.length) return;

      const entry = branch.history[targetIndex];
      loadSketchData(entry.sketch);

      // Couper l'historique
      const newHistory = branch.history.slice(0, targetIndex + 1);
      const deletedCount = branch.history.length - targetIndex - 1;

      // Mettre à jour la branche
      const branchIndex = branches.findIndex((b) => b.id === activeBranchId);
      const updatedBranch = { ...branch, history: newHistory, historyIndex: targetIndex };
      const newBranches = [...branches];
      newBranches[branchIndex] = updatedBranch;
      setBranches(newBranches);
      branchesRef.current = { branches: newBranches, activeBranchId };
      historyRef.current = { history: newHistory, index: targetIndex };
      setPreviewHistoryIndex(null);

      toast.success(`Historique tronqué: ${deletedCount} entrée(s) supprimée(s)`);
    },
    [branches, activeBranchId, loadSketchData],
  );

  // Supprimer un état ET tout ce qui suit (revient à l'état précédent)
  const deleteStateAndAfter = useCallback(
    (targetIndex: number) => {
      const branch = branches.find((b) => b.id === activeBranchId);
      if (!branch || targetIndex <= 0 || targetIndex >= branch.history.length) return;

      // Revenir à l'état précédent
      const previousIndex = targetIndex - 1;
      const entry = branch.history[previousIndex];
      loadSketchData(entry.sketch);

      // Couper l'historique (garder jusqu'à l'état précédent)
      const newHistory = branch.history.slice(0, targetIndex);
      const deletedCount = branch.history.length - targetIndex;

      // Mettre à jour la branche
      const branchIndex = branches.findIndex((b) => b.id === activeBranchId);
      const updatedBranch = { ...branch, history: newHistory, historyIndex: previousIndex };
      const newBranches = [...branches];
      newBranches[branchIndex] = updatedBranch;
      setBranches(newBranches);
      branchesRef.current = { branches: newBranches, activeBranchId };
      historyRef.current = { history: newHistory, index: previousIndex };
      setPreviewHistoryIndex(null);

      toast.success(`${deletedCount} état(s) supprimé(s)`);
    },
    [branches, activeBranchId, loadSketchData],
  );

  // Switcher vers une autre branche
  const switchToBranch = useCallback(
    (branchId: string) => {
      const branch = branches.find((b) => b.id === branchId);
      if (!branch) return;

      // Charger l'état actuel de la branche
      const entry = branch.history[branch.historyIndex];
      loadSketchData(entry.sketch);

      setActiveBranchId(branchId);
      branchesRef.current = { ...branchesRef.current, activeBranchId: branchId };
      historyRef.current = { history: branch.history, index: branch.historyIndex };
      setPreviewHistoryIndex(null);

      toast.success(`Branche active: ${branch.name}`);
    },
    [branches, loadSketchData],
  );

  // Supprimer une branche
  const deleteBranch = useCallback(
    (branchId: string) => {
      if (branches.length <= 1) {
        toast.error("Impossible de supprimer la dernière branche");
        return;
      }

      const branchIndex = branches.findIndex((b) => b.id === branchId);
      if (branchIndex === -1) return;

      const branchName = branches[branchIndex].name;
      const newBranches = branches.filter((b) => b.id !== branchId);

      // Si c'était la branche active, switcher vers la première
      let newActiveBranchId = activeBranchId;
      if (activeBranchId === branchId) {
        newActiveBranchId = newBranches[0].id;
        const newActiveBranch = newBranches[0];
        loadSketchData(newActiveBranch.history[newActiveBranch.historyIndex].sketch);
      }

      setBranches(newBranches);
      setActiveBranchId(newActiveBranchId);
      setVisibleBranches((prev) => {
        const newSet = new Set(prev);
        newSet.delete(branchId);
        return newSet;
      });
      branchesRef.current = { branches: newBranches, activeBranchId: newActiveBranchId };

      toast.success(`Branche supprimée: ${branchName}`);
    },
    [branches, activeBranchId, loadSketchData],
  );

  // Toggle visibilité d'une branche en mode comparaison
  const toggleBranchVisibility = useCallback(
    (branchId: string) => {
      setVisibleBranches((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(branchId)) {
          // Ne pas permettre de cacher la branche active
          if (branchId !== activeBranchId) {
            newSet.delete(branchId);
          }
        } else {
          newSet.add(branchId);
        }
        return newSet;
      });
    },
    [activeBranchId],
  );

  // Renommer une branche
  const renameBranch = useCallback((branchId: string, newName: string) => {
    if (!newName.trim()) {
      toast.error("Le nom ne peut pas être vide");
      return;
    }

    setBranches((prev) => prev.map((b) => (b.id === branchId ? { ...b, name: newName.trim() } : b)));
    toast.success(`Branche renommée: ${newName.trim()}`);
  }, []);

  // Fusionner deux branches (copier les géométries de la source vers la cible)
  const mergeBranches = useCallback(
    (sourceBranchId: string, targetBranchId: string) => {
      const sourceBranch = branches.find((b) => b.id === sourceBranchId);
      const targetBranch = branches.find((b) => b.id === targetBranchId);

      if (!sourceBranch || !targetBranch) {
        toast.error("Branches invalides");
        return;
      }

      // Récupérer le sketch de la source (dernier état)
      const sourceSketch = deserializeSketch(sourceBranch.history[sourceBranch.historyIndex].sketch);

      // Récupérer le sketch de la cible (dernier état)
      const targetSketchData = targetBranch.history[targetBranch.historyIndex].sketch;
      const targetSketch = deserializeSketch(targetSketchData);

      // Créer une map pour reindexer les points de la source
      const pointIdMap = new Map<string, string>();
      let newPointIndex = targetSketch.points.size;

      // Copier les points de la source vers la cible
      sourceSketch.points.forEach((point, oldId) => {
        const newId = `p${newPointIndex++}`;
        pointIdMap.set(oldId, newId);
        targetSketch.points.set(newId, { ...point, id: newId });
      });

      // Copier les géométries avec les nouveaux IDs de points
      let newGeoIndex = targetSketch.geometries.size;
      sourceSketch.geometries.forEach((geo) => {
        const newGeoId = `g${newGeoIndex++}`;
        let newGeo: Geometry;

        if (geo.type === "line") {
          const line = geo as Line;
          newGeo = {
            ...line,
            id: newGeoId,
            p1: pointIdMap.get(line.p1) || line.p1,
            p2: pointIdMap.get(line.p2) || line.p2,
          };
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          newGeo = {
            ...circle,
            id: newGeoId,
            center: pointIdMap.get(circle.center) || circle.center,
          };
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          newGeo = {
            ...arc,
            id: newGeoId,
            center: pointIdMap.get(arc.center) || arc.center,
            startPoint: pointIdMap.get(arc.startPoint) || arc.startPoint,
            endPoint: pointIdMap.get(arc.endPoint) || arc.endPoint,
          };
        } else if (geo.type === "bezier") {
          const bezier = geo as Bezier;
          newGeo = {
            ...bezier,
            id: newGeoId,
            p1: pointIdMap.get(bezier.p1) || bezier.p1,
            p2: pointIdMap.get(bezier.p2) || bezier.p2,
            cp1: pointIdMap.get(bezier.cp1) || bezier.cp1,
            cp2: pointIdMap.get(bezier.cp2) || bezier.cp2,
          };
        } else {
          newGeo = { ...geo, id: newGeoId };
        }

        targetSketch.geometries.set(newGeoId, newGeo);
      });

      // Serialiser le sketch fusionné
      const mergedSketchData = serializeSketch(targetSketch);

      // Créer une nouvelle entrée d'historique pour la branche cible
      const newEntry: HistoryEntry = {
        sketch: mergedSketchData,
        description: `Fusion avec ${sourceBranch.name}`,
        timestamp: Date.now(),
      };

      // Mettre à jour les branches
      setBranches((prev) =>
        prev.map((b) => {
          if (b.id === targetBranchId) {
            const newHistory = [...b.history.slice(0, b.historyIndex + 1), newEntry];
            return {
              ...b,
              history: newHistory,
              historyIndex: newHistory.length - 1,
            };
          }
          return b;
        }),
      );

      // Si la cible est la branche active, charger le sketch fusionné
      if (targetBranchId === activeBranchId) {
        loadSketchData(mergedSketchData);
      }

      toast.success(`Branches fusionnées: ${sourceBranch.name} → ${targetBranch.name}`);
    },
    [branches, activeBranchId, loadSketchData],
  );

  // Prévisualiser une version (sans modifier l'index)
  const previewHistoryEntry = useCallback(
    (targetIndex: number | null) => {
      const branch = branches.find((b) => b.id === activeBranchId);
      if (!branch) return;

      if (targetIndex === null) {
        // Restaurer l'état actuel
        if (branch.historyIndex >= 0 && branch.historyIndex < branch.history.length) {
          const currentEntry = branch.history[branch.historyIndex];
          loadSketchData(currentEntry.sketch);
        }
        setPreviewHistoryIndex(null);
      } else if (targetIndex >= 0 && targetIndex < branch.history.length) {
        const entry = branch.history[targetIndex];
        loadSketchData(entry.sketch);
        setPreviewHistoryIndex(targetIndex);
      }
    },
    [branches, activeBranchId, loadSketchData],
  );

  // === COPIER / COLLER / DUPLIQUER ===

  // Copier les entités sélectionnées
  const copySelectedEntities = useCallback(() => {
    if (selectedEntities.size === 0) {
      toast.info("Aucune entité sélectionnée");
      return;
    }

    const copiedPoints = new Map<string, Point>();
    const copiedGeometries = new Map<string, Geometry>();
    const pointsUsed = new Set<string>();

    // Copier les géométries sélectionnées et identifier les points utilisés
    selectedEntities.forEach((id) => {
      const geo = sketch.geometries.get(id);
      if (geo) {
        copiedGeometries.set(id, { ...geo });
        // Identifier les points utilisés par cette géométrie
        if (geo.type === "line") {
          const line = geo as Line;
          pointsUsed.add(line.p1);
          pointsUsed.add(line.p2);
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          pointsUsed.add(circle.center);
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          pointsUsed.add(arc.center);
          pointsUsed.add(arc.startPoint);
          pointsUsed.add(arc.endPoint);
        } else if (geo.type === "rectangle") {
          const rect = geo as Rectangle;
          [rect.p1, rect.p2, rect.p3, rect.p4].forEach((pid) => pointsUsed.add(pid));
        } else if (geo.type === "bezier") {
          const bezier = geo as Bezier;
          [bezier.p1, bezier.p2, bezier.cp1, bezier.cp2].forEach((pid) => pointsUsed.add(pid));
        } else if (geo.type === "text") {
          const text = geo as TextAnnotation;
          pointsUsed.add(text.position);
        }
      }
      // Copier aussi les points sélectionnés directement
      const point = sketch.points.get(id);
      if (point) {
        copiedPoints.set(id, { ...point });
      }
    });

    // Copier les points utilisés par les géométries
    pointsUsed.forEach((pointId) => {
      const point = sketch.points.get(pointId);
      if (point) {
        copiedPoints.set(pointId, { ...point });
      }
    });

    // Calculer le centre des entités copiées
    let sumX = 0,
      sumY = 0,
      count = 0;
    copiedPoints.forEach((point) => {
      sumX += point.x;
      sumY += point.y;
      count++;
    });
    const center = count > 0 ? { x: sumX / count, y: sumY / count } : { x: 0, y: 0 };

    setClipboard({
      points: copiedPoints,
      geometries: copiedGeometries,
      center,
    });

    toast.success(`${copiedGeometries.size} géométrie(s) et ${copiedPoints.size} point(s) copiés`);
  }, [selectedEntities, sketch]);

  // Coller les entités du presse-papier
  const pasteEntities = useCallback(
    (offset = { x: 0, y: 0 }) => {
      if (!clipboard) {
        toast.info("Presse-papier vide");
        return;
      }

      // Créer un mapping ancien ID -> nouveau ID
      const pointIdMapping = new Map<string, string>();
      const newSketch = { ...sketch };
      newSketch.points = new Map(sketch.points);
      newSketch.geometries = new Map(sketch.geometries);

      // Coller les points avec nouveaux IDs et décalage
      clipboard.points.forEach((point, oldId) => {
        const newId = generateId();
        pointIdMapping.set(oldId, newId);
        newSketch.points.set(newId, {
          ...point,
          id: newId,
          x: point.x + offset.x,
          y: point.y + offset.y,
        });
      });

      // Coller les géométries avec nouveaux IDs et références mises à jour
      // IMPORTANT: Assigner le calque actif aux éléments collés
      const newSelectedEntities = new Set<string>();
      clipboard.geometries.forEach((geo) => {
        const newId = generateId();
        newSelectedEntities.add(newId);

        if (geo.type === "line") {
          const line = geo as Line;
          newSketch.geometries.set(newId, {
            ...line,
            id: newId,
            layerId: sketch.activeLayerId, // Assigner au calque actif
            p1: pointIdMapping.get(line.p1) || line.p1,
            p2: pointIdMapping.get(line.p2) || line.p2,
          });
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          newSketch.geometries.set(newId, {
            ...circle,
            id: newId,
            layerId: sketch.activeLayerId, // Assigner au calque actif
            center: pointIdMapping.get(circle.center) || circle.center,
          });
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          newSketch.geometries.set(newId, {
            ...arc,
            id: newId,
            layerId: sketch.activeLayerId, // Assigner au calque actif
            center: pointIdMapping.get(arc.center) || arc.center,
            startPoint: pointIdMapping.get(arc.startPoint) || arc.startPoint,
            endPoint: pointIdMapping.get(arc.endPoint) || arc.endPoint,
          });
        } else if (geo.type === "rectangle") {
          const rect = geo as Rectangle;
          newSketch.geometries.set(newId, {
            ...rect,
            id: newId,
            layerId: sketch.activeLayerId, // Assigner au calque actif
            p1: pointIdMapping.get(rect.p1) || rect.p1,
            p2: pointIdMapping.get(rect.p2) || rect.p2,
            p3: pointIdMapping.get(rect.p3) || rect.p3,
            p4: pointIdMapping.get(rect.p4) || rect.p4,
          });
        } else if (geo.type === "bezier") {
          const bezier = geo as Bezier;
          newSketch.geometries.set(newId, {
            ...bezier,
            id: newId,
            layerId: sketch.activeLayerId, // Assigner au calque actif
            p1: pointIdMapping.get(bezier.p1) || bezier.p1,
            p2: pointIdMapping.get(bezier.p2) || bezier.p2,
            cp1: pointIdMapping.get(bezier.cp1) || bezier.cp1,
            cp2: pointIdMapping.get(bezier.cp2) || bezier.cp2,
          });
        } else if (geo.type === "text") {
          const text = geo as TextAnnotation;
          newSketch.geometries.set(newId, {
            ...text,
            id: newId,
            layerId: sketch.activeLayerId, // Assigner au calque actif
            position: pointIdMapping.get(text.position) || text.position,
          });
        }
      });

      setSketch(newSketch);
      setSelectedEntities(newSelectedEntities);
      addToHistory(newSketch);

      toast.success(`${clipboard.geometries.size} géométrie(s) collées`);
    },
    [clipboard, sketch, addToHistory],
  );

  // Dupliquer les entités sélectionnées (copier + coller en une fois)
  const duplicateSelectedEntities = useCallback(() => {
    if (selectedEntities.size === 0) {
      toast.info("Aucune entité sélectionnée");
      return;
    }

    // Copier dans un presse-papier temporaire
    const copiedPoints = new Map<string, Point>();
    const copiedGeometries = new Map<string, Geometry>();
    const pointsUsed = new Set<string>();

    selectedEntities.forEach((id) => {
      const geo = sketch.geometries.get(id);
      if (geo) {
        copiedGeometries.set(id, { ...geo });
        if (geo.type === "line") {
          const line = geo as Line;
          pointsUsed.add(line.p1);
          pointsUsed.add(line.p2);
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          pointsUsed.add(circle.center);
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          pointsUsed.add(arc.center);
          pointsUsed.add(arc.startPoint);
          pointsUsed.add(arc.endPoint);
        } else if (geo.type === "rectangle") {
          const rect = geo as Rectangle;
          [rect.p1, rect.p2, rect.p3, rect.p4].forEach((pid) => pointsUsed.add(pid));
        } else if (geo.type === "bezier") {
          const bezier = geo as Bezier;
          [bezier.p1, bezier.p2, bezier.cp1, bezier.cp2].forEach((pid) => pointsUsed.add(pid));
        } else if (geo.type === "text") {
          const text = geo as TextAnnotation;
          pointsUsed.add(text.position);
        }
      }
    });

    pointsUsed.forEach((pointId) => {
      const point = sketch.points.get(pointId);
      if (point) {
        copiedPoints.set(pointId, { ...point });
      }
    });

    // Coller directement avec décalage
    const offset = { x: 20, y: 20 };
    const pointIdMapping = new Map<string, string>();
    const newSketch = { ...sketch };
    newSketch.points = new Map(sketch.points);
    newSketch.geometries = new Map(sketch.geometries);

    copiedPoints.forEach((point, oldId) => {
      const newId = generateId();
      pointIdMapping.set(oldId, newId);
      newSketch.points.set(newId, {
        ...point,
        id: newId,
        x: point.x + offset.x,
        y: point.y + offset.y,
      });
    });

    const newSelectedEntities = new Set<string>();
    copiedGeometries.forEach((geo) => {
      const newId = generateId();
      newSelectedEntities.add(newId);

      if (geo.type === "line") {
        const line = geo as Line;
        newSketch.geometries.set(newId, {
          ...line,
          id: newId,
          p1: pointIdMapping.get(line.p1) || line.p1,
          p2: pointIdMapping.get(line.p2) || line.p2,
        });
      } else if (geo.type === "circle") {
        const circle = geo as CircleType;
        newSketch.geometries.set(newId, {
          ...circle,
          id: newId,
          center: pointIdMapping.get(circle.center) || circle.center,
        });
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        newSketch.geometries.set(newId, {
          ...arc,
          id: newId,
          center: pointIdMapping.get(arc.center) || arc.center,
          startPoint: pointIdMapping.get(arc.startPoint) || arc.startPoint,
          endPoint: pointIdMapping.get(arc.endPoint) || arc.endPoint,
        });
      } else if (geo.type === "rectangle") {
        const rect = geo as Rectangle;
        newSketch.geometries.set(newId, {
          ...rect,
          id: newId,
          p1: pointIdMapping.get(rect.p1) || rect.p1,
          p2: pointIdMapping.get(rect.p2) || rect.p2,
          p3: pointIdMapping.get(rect.p3) || rect.p3,
          p4: pointIdMapping.get(rect.p4) || rect.p4,
        });
      } else if (geo.type === "bezier") {
        const bezier = geo as Bezier;
        newSketch.geometries.set(newId, {
          ...bezier,
          id: newId,
          p1: pointIdMapping.get(bezier.p1) || bezier.p1,
          p2: pointIdMapping.get(bezier.p2) || bezier.p2,
          cp1: pointIdMapping.get(bezier.cp1) || bezier.cp1,
          cp2: pointIdMapping.get(bezier.cp2) || bezier.cp2,
        });
      } else if (geo.type === "text") {
        const text = geo as TextAnnotation;
        newSketch.geometries.set(newId, {
          ...text,
          id: newId,
          position: pointIdMapping.get(text.position) || text.position,
        });
      }
    });

    setSketch(newSketch);
    setSelectedEntities(newSelectedEntities);
    addToHistory(newSketch);

    toast.success(`${copiedGeometries.size} géométrie(s) dupliquées`);
  }, [selectedEntities, sketch, addToHistory]);

  // Ajuster la vue pour voir tout le contenu
  const fitToContent = useCallback(() => {
    if (sketch.geometries.size === 0) {
      toast.info("Aucun contenu à afficher");
      return;
    }

    // Calculer les bounds de tout le contenu
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    sketch.points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });

    // Prendre en compte les cercles
    sketch.geometries.forEach((geo) => {
      if (geo.type === "circle") {
        const circle = geo as CircleType;
        const center = sketch.points.get(circle.center);
        if (center) {
          minX = Math.min(minX, center.x - circle.radius);
          minY = Math.min(minY, center.y - circle.radius);
          maxX = Math.max(maxX, center.x + circle.radius);
          maxY = Math.max(maxY, center.y + circle.radius);
        }
      }
    });

    if (minX === Infinity) {
      toast.info("Aucun contenu à afficher");
      return;
    }

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setViewport((prev) => {
      // Calculer le scale optimal avec une marge de 20%
      const margin = 0.8;
      const scaleX = (prev.width * margin) / contentWidth;
      const scaleY = (prev.height * margin) / contentHeight;
      const optimalScale = Math.min(scaleX, scaleY);

      // Scale minimum de 3 pour que les petits dessins soient visibles
      const minScale = 3;
      const newScale = Math.max(minScale, Math.min(5000, optimalScale));

      return {
        ...prev,
        scale: newScale,
        offsetX: prev.width / 2 - centerX * newScale,
        offsetY: prev.height / 2 - centerY * newScale,
      };
    });
  }, [sketch]);

  // === GROUPES === (déplacé avant useEffect clavier car utilisé dedans)

  // Grouper les entités sélectionnées
  const handleGroupSelection = useCallback(() => {
    if (selectedEntities.size < 2) {
      toast.error("Sélectionnez au moins 2 éléments à grouper");
      return;
    }

    const groupId = generateId();
    const groupName = `Groupe ${sketch.groups.size + 1}`;

    const newGroup: GeometryGroup = {
      id: groupId,
      name: groupName,
      entityIds: Array.from(selectedEntities),
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    };

    const newSketch = { ...sketch };
    newSketch.groups = new Map(sketch.groups);
    newSketch.groups.set(groupId, newGroup);

    setSketch(newSketch);
    addToHistory(newSketch);
    toast.success(`${selectedEntities.size} éléments groupés`);
  }, [sketch, selectedEntities, addToHistory]);

  // Dégrouper (dissoudre le groupe des entités sélectionnées)
  const handleUngroupSelection = useCallback(() => {
    if (selectedEntities.size === 0) {
      toast.error("Sélectionnez des éléments à dégrouper");
      return;
    }

    // Trouver les groupes qui contiennent des éléments sélectionnés
    const groupsToRemove: string[] = [];
    sketch.groups.forEach((group, groupId) => {
      const hasSelectedEntity = group.entityIds.some((id) => selectedEntities.has(id));
      if (hasSelectedEntity) {
        groupsToRemove.push(groupId);
      }
    });

    if (groupsToRemove.length === 0) {
      toast.warning("Les éléments sélectionnés ne font partie d'aucun groupe");
      return;
    }

    const newSketch = { ...sketch };
    newSketch.groups = new Map(sketch.groups);
    groupsToRemove.forEach((id) => newSketch.groups.delete(id));

    setSketch(newSketch);
    addToHistory(newSketch);
    toast.success(`${groupsToRemove.length} groupe(s) dissous`);
  }, [sketch, selectedEntities, addToHistory]);

  // === RÉPÉTITION/ARRAY ===

  // Ouvrir la modale de répétition
  const openArrayDialog = useCallback(
    (forceCheckerboard = false) => {
      // Si pas de sélection, basculer automatiquement en mode damier
      const noSelection = selectedEntities.size === 0;
      const useCheckerboard = forceCheckerboard || noSelection;

      // Calculer le centre de la sélection pour le mode circulaire
      let sumX = 0,
        sumY = 0,
        count = 0;
      selectedEntities.forEach((id) => {
        const geo = sketch.geometries.get(id);
        if (geo) {
          if (geo.type === "line") {
            const line = geo as Line;
            const p1 = sketch.points.get(line.p1);
            const p2 = sketch.points.get(line.p2);
            if (p1 && p2) {
              sumX += (p1.x + p2.x) / 2;
              sumY += (p1.y + p2.y) / 2;
              count++;
            }
          } else if (geo.type === "circle") {
            const circle = geo as CircleType;
            const center = sketch.points.get(circle.center);
            if (center) {
              sumX += center.x;
              sumY += center.y;
              count++;
            }
          } else if (geo.type === "arc") {
            const arc = geo as Arc;
            const center = sketch.points.get(arc.center);
            if (center) {
              sumX += center.x;
              sumY += center.y;
              count++;
            }
          }
        }
      });

      const selectionCenter = count > 0 ? { x: sumX / count, y: sumY / count } : { x: 0, y: 0 };

      setArrayDialog({
        open: true,
        type: useCheckerboard ? "checkerboard" : "linear",
        // Linéaire
        linearCount: 3,
        linearSpacing: "50",
        linearSpacingMode: "spacing",
        linearDirection: "x",
        linearAngle: "0",
        // Grille
        countX: 3,
        spacingX: "50",
        spacingModeX: "spacing",
        countY: 3,
        spacingY: "50",
        spacingModeY: "spacing",
        // Circulaire
        circularCount: 6,
        circularAngle: "360",
        circularCenter: selectionCenter,
        // Damier
        checkerCountX: "8",
        checkerCountY: "6",
        checkerSize: "20",
        checkerColor: "#000000",
        // Général
        includeOriginal: true,
        createIntersections: true,
      });
    },
    [selectedEntities, sketch],
  );

  // Exécuter la répétition
  const executeArray = useCallback(() => {
    if (!arrayDialog) return;

    // Le mode checkerboard ne nécessite pas de sélection
    if (arrayDialog.type !== "checkerboard" && selectedEntities.size === 0) return;

    const {
      type,
      linearCount,
      linearSpacing,
      linearSpacingMode,
      linearDirection,
      linearAngle,
      countX,
      spacingX,
      spacingModeX,
      countY,
      spacingY,
      spacingModeY,
      circularCount,
      circularAngle,
      circularCenter,
      includeOriginal,
      createIntersections,
    } = arrayDialog;

    // Parser les valeurs
    const linearSpacingStr = typeof linearSpacing === "string" ? linearSpacing : String(linearSpacing || "50");
    const spacingXStr = typeof spacingX === "string" ? spacingX : String(spacingX || "50");
    const spacingYStr = typeof spacingY === "string" ? spacingY : String(spacingY || "50");
    const circularAngleStr = typeof circularAngle === "string" ? circularAngle : String(circularAngle || "360");
    const linearAngleStr = typeof linearAngle === "string" ? linearAngle : String(linearAngle || "0");

    const linearSpacingNum = parseFloat(linearSpacingStr.replace(",", ".")) || 0;
    const spacingXNum = parseFloat(spacingXStr.replace(",", ".")) || 0;
    const spacingYNum = parseFloat(spacingYStr.replace(",", ".")) || 0;
    const circularAngleNum = parseFloat(circularAngleStr.replace(",", ".")) || 360;
    const linearAngleNum = parseFloat(linearAngleStr.replace(",", ".")) || 0;

    // Calculer l'espacement réel selon le mode
    const count = linearCount || 3;
    const realLinearSpacing =
      linearSpacingMode === "distance" && count > 1 ? linearSpacingNum / (count - 1) : linearSpacingNum;
    const realSpacingX = spacingModeX === "distance" && countX > 1 ? spacingXNum / (countX - 1) : spacingXNum;
    const realSpacingY = spacingModeY === "distance" && countY > 1 ? spacingYNum / (countY - 1) : spacingYNum;

    // Collecter les points et géométries sélectionnés
    const copiedPoints = new Map<string, Point>();
    const copiedGeometries = new Map<string, Geometry>();
    const pointsUsed = new Set<string>();

    selectedEntities.forEach((id) => {
      const geo = sketch.geometries.get(id);
      if (geo) {
        copiedGeometries.set(id, { ...geo });
        if (geo.type === "line") {
          const line = geo as Line;
          pointsUsed.add(line.p1);
          pointsUsed.add(line.p2);
        } else if (geo.type === "circle") {
          pointsUsed.add((geo as CircleType).center);
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          pointsUsed.add(arc.center);
          pointsUsed.add(arc.startPoint);
          pointsUsed.add(arc.endPoint);
        } else if (geo.type === "rectangle") {
          const rect = geo as Rectangle;
          [rect.p1, rect.p2, rect.p3, rect.p4].forEach((pid) => pointsUsed.add(pid));
        } else if (geo.type === "bezier") {
          const bezier = geo as Bezier;
          [bezier.p1, bezier.p2, bezier.cp1, bezier.cp2].forEach((pid) => pointsUsed.add(pid));
        } else if (geo.type === "text") {
          const text = geo as TextAnnotation;
          pointsUsed.add(text.position);
        }
      }
    });

    pointsUsed.forEach((pointId) => {
      const point = sketch.points.get(pointId);
      if (point) {
        copiedPoints.set(pointId, { ...point });
      }
    });

    // Calculer le centre de la sélection pour la rotation
    let centerX = 0,
      centerY = 0;
    copiedPoints.forEach((p) => {
      centerX += p.x;
      centerY += p.y;
    });
    centerX /= copiedPoints.size || 1;
    centerY /= copiedPoints.size || 1;

    // Utiliser le centre personnalisé pour circulaire
    if (type === "circular" && circularCenter) {
      centerX = circularCenter.x;
      centerY = circularCenter.y;
    }

    const newSketch = { ...sketch };
    newSketch.points = new Map(sketch.points);
    newSketch.geometries = new Map(sketch.geometries);

    // Liste des nouvelles géométries créées (pour les intersections)
    const newGeometryIds: string[] = [];

    // Fonction pour créer une copie avec offset/rotation
    const createCopy = (offsetX: number, offsetY: number, rotation: number = 0) => {
      const pointIdMapping = new Map<string, string>();

      copiedPoints.forEach((point, oldId) => {
        const newId = generateId();
        pointIdMapping.set(oldId, newId);

        let newX = point.x;
        let newY = point.y;

        if (rotation !== 0) {
          // Rotation autour du centre
          const dx = point.x - centerX;
          const dy = point.y - centerY;
          const cos = Math.cos(rotation);
          const sin = Math.sin(rotation);
          newX = centerX + dx * cos - dy * sin;
          newY = centerY + dx * sin + dy * cos;
        }

        newSketch.points.set(newId, {
          ...point,
          id: newId,
          x: newX + offsetX,
          y: newY + offsetY,
          fixed: false,
        });
      });

      copiedGeometries.forEach((geo) => {
        const newId = generateId();
        newGeometryIds.push(newId);

        if (geo.type === "line") {
          const line = geo as Line;
          newSketch.geometries.set(newId, {
            ...line,
            id: newId,
            p1: pointIdMapping.get(line.p1) || line.p1,
            p2: pointIdMapping.get(line.p2) || line.p2,
          });
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          newSketch.geometries.set(newId, {
            ...circle,
            id: newId,
            center: pointIdMapping.get(circle.center) || circle.center,
          });
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          newSketch.geometries.set(newId, {
            ...arc,
            id: newId,
            center: pointIdMapping.get(arc.center) || arc.center,
            startPoint: pointIdMapping.get(arc.startPoint) || arc.startPoint,
            endPoint: pointIdMapping.get(arc.endPoint) || arc.endPoint,
          });
        } else if (geo.type === "rectangle") {
          const rect = geo as Rectangle;
          newSketch.geometries.set(newId, {
            ...rect,
            id: newId,
            p1: pointIdMapping.get(rect.p1) || rect.p1,
            p2: pointIdMapping.get(rect.p2) || rect.p2,
            p3: pointIdMapping.get(rect.p3) || rect.p3,
            p4: pointIdMapping.get(rect.p4) || rect.p4,
          });
        } else if (geo.type === "bezier") {
          const bezier = geo as Bezier;
          newSketch.geometries.set(newId, {
            ...bezier,
            id: newId,
            p1: pointIdMapping.get(bezier.p1) || bezier.p1,
            p2: pointIdMapping.get(bezier.p2) || bezier.p2,
            cp1: pointIdMapping.get(bezier.cp1) || bezier.cp1,
            cp2: pointIdMapping.get(bezier.cp2) || bezier.cp2,
          });
        } else if (geo.type === "text") {
          const text = geo as TextAnnotation;
          newSketch.geometries.set(newId, {
            ...text,
            id: newId,
            position: pointIdMapping.get(text.position) || text.position,
          });
        }
      });
    };

    let totalCopies = 0;

    if (type === "linear") {
      // Calculer la direction en radians
      let dirAngle = 0;
      if (linearDirection === "y") {
        dirAngle = Math.PI / 2; // 90°
      } else if (linearDirection === "custom") {
        dirAngle = (linearAngleNum * Math.PI) / 180;
      }

      const dirX = Math.cos(dirAngle);
      const dirY = Math.sin(dirAngle);

      const startIdx = includeOriginal ? 1 : 0;
      for (let i = startIdx; i < count; i++) {
        const dist = i * realLinearSpacing * sketch.scaleFactor;
        createCopy(dist * dirX, dist * dirY);
        totalCopies++;
      }
    } else if (type === "grid") {
      // Répétition en grille
      for (let row = 0; row < countY; row++) {
        for (let col = 0; col < countX; col++) {
          if (row === 0 && col === 0 && includeOriginal) continue;
          createCopy(col * realSpacingX * sketch.scaleFactor, row * realSpacingY * sketch.scaleFactor);
          totalCopies++;
        }
      }
    } else if (type === "circular") {
      // Répétition circulaire
      const angleStep = (circularAngleNum * Math.PI) / 180 / circularCount;
      const startIdx = includeOriginal ? 1 : 0;
      for (let i = startIdx; i < circularCount; i++) {
        const rotation = angleStep * i;
        createCopy(0, 0, rotation);
        totalCopies++;
      }
    } else if (type === "checkerboard") {
      // Mode damier - création spéciale (ne nécessite pas de sélection)
      const { checkerCountX, checkerCountY, checkerSize, checkerColor } = arrayDialog;

      // Parser les valeurs (peuvent être string ou number)
      const countXStr = typeof checkerCountX === "string" ? checkerCountX : String(checkerCountX || "8");
      const countYStr = typeof checkerCountY === "string" ? checkerCountY : String(checkerCountY || "6");
      const sizeStr = typeof checkerSize === "string" ? checkerSize : String(checkerSize || "20");

      const cX = Math.max(1, parseInt(countXStr) || 8);
      const cY = Math.max(1, parseInt(countYStr) || 6);
      const sizePx = (parseFloat(sizeStr.replace(",", ".")) || 20) * sketch.scaleFactor;

      // Point de départ (centre du viewport ou origine)
      const startX = 0;
      const startY = 0;

      // Créer les points de la grille
      const pointGrid: string[][] = [];
      for (let row = 0; row <= cY; row++) {
        pointGrid[row] = [];
        for (let col = 0; col <= cX; col++) {
          const pointId = generateId();
          newSketch.points.set(pointId, {
            id: pointId,
            x: startX + col * sizePx,
            y: startY + row * sizePx,
          });
          pointGrid[row][col] = pointId;
        }
      }

      // Créer les lignes horizontales
      for (let row = 0; row <= cY; row++) {
        for (let col = 0; col < cX; col++) {
          const lineId = generateId();
          newSketch.geometries.set(lineId, {
            id: lineId,
            type: "line",
            p1: pointGrid[row][col],
            p2: pointGrid[row][col + 1],
            layerId: sketch.activeLayerId,
            strokeWidth: defaultStrokeWidthRef.current,
            strokeColor: defaultStrokeColorRef.current,
          });
          newGeometryIds.push(lineId);
        }
      }

      // Créer les lignes verticales
      for (let col = 0; col <= cX; col++) {
        for (let row = 0; row < cY; row++) {
          const lineId = generateId();
          newSketch.geometries.set(lineId, {
            id: lineId,
            type: "line",
            p1: pointGrid[row][col],
            p2: pointGrid[row + 1][col],
            layerId: sketch.activeLayerId,
            strokeWidth: defaultStrokeWidthRef.current,
            strokeColor: defaultStrokeColorRef.current,
          });
          newGeometryIds.push(lineId);
        }
      }

      // Créer les remplissages pour les cases noires (pattern damier)
      // Initialiser shapeFills si nécessaire
      if (!newSketch.shapeFills) {
        newSketch.shapeFills = new Map();
      } else {
        newSketch.shapeFills = new Map(newSketch.shapeFills);
      }

      for (let row = 0; row < cY; row++) {
        for (let col = 0; col < cX; col++) {
          // Case noire si (row + col) est pair
          if ((row + col) % 2 === 0) {
            // Trouver les 4 lignes qui forment cette case
            // Lignes horizontales: row à col et row+1 à col
            // Lignes verticales: col à row et col+1 à row

            // On va identifier les geoIds des 4 côtés de la case
            const topLineIdx = row * cX + col;
            const bottomLineIdx = (row + 1) * cX + col;
            const leftLineIdx = cX * (cY + 1) + col * cY + row;
            const rightLineIdx = cX * (cY + 1) + (col + 1) * cY + row;

            // Récupérer les IDs depuis newGeometryIds
            const geoIds = new Set<string>();
            if (newGeometryIds[topLineIdx]) geoIds.add(newGeometryIds[topLineIdx]);
            if (newGeometryIds[bottomLineIdx]) geoIds.add(newGeometryIds[bottomLineIdx]);
            if (newGeometryIds[leftLineIdx]) geoIds.add(newGeometryIds[leftLineIdx]);
            if (newGeometryIds[rightLineIdx]) geoIds.add(newGeometryIds[rightLineIdx]);

            if (geoIds.size === 4) {
              const fillId = generateId();
              newSketch.shapeFills.set(fillId, {
                id: fillId,
                geoIds: Array.from(geoIds),
                fillType: "solid",
                color: checkerColor || "#000000",
                opacity: 1,
              });
            }
          }
        }
      }

      totalCopies = cX * cY;
    }

    // Créer les points d'intersection si demandé
    if (createIntersections) {
      // Collecter toutes les géométries (originales + nouvelles)
      const allLineIds = [...Array.from(selectedEntities), ...newGeometryIds].filter((id) => {
        const geo = newSketch.geometries.get(id);
        return geo && geo.type === "line";
      });

      // Créer les intersections pour chaque nouvelle géométrie
      for (const geoId of newGeometryIds) {
        createIntersectionPoints(geoId, newSketch);
      }
    }

    setSketch(newSketch);
    addToHistory(newSketch, `Répétition ${type} (${totalCopies} copies)`);
    setArrayDialog(null);
    toast.success(`${totalCopies} copie(s) créée(s)`);
  }, [arrayDialog, selectedEntities, sketch, addToHistory, createIntersectionPoints]);

  // Créer ou modifier un texte/annotation
  const commitTextInput = useCallback(() => {
    if (!textInput || !textInput.content.trim()) {
      setTextInput(null);
      return;
    }

    const newSketch = { ...sketch };
    newSketch.points = new Map(sketch.points);
    newSketch.geometries = new Map(sketch.geometries);

    if (textInput.editingId) {
      // Mode édition : mettre à jour le texte existant
      const existingText = sketch.geometries.get(textInput.editingId) as TextAnnotation;
      if (existingText) {
        newSketch.geometries.set(textInput.editingId, {
          ...existingText,
          content: textInput.content,
          fontSize: textFontSize,
          color: textColor,
          alignment: textAlignment,
        });
        toast.success("Texte modifié");
      }
    } else {
      // Mode création : nouveau texte
      const pointId = generateId();
      newSketch.points.set(pointId, {
        id: pointId,
        x: textInput.position.x,
        y: textInput.position.y,
      });

      const textId = generateId();
      const textGeo: TextAnnotation = {
        id: textId,
        type: "text",
        position: pointId,
        content: textInput.content,
        fontSize: textFontSize,
        color: textColor,
        alignment: textAlignment,
        layerId: sketch.activeLayerId,
      };
      newSketch.geometries.set(textId, textGeo);
      toast.success("Texte ajouté");
    }

    setSketch(newSketch);
    addToHistory(newSketch);
    setTextInput(null);
  }, [textInput, sketch, addToHistory, textFontSize, textColor, textAlignment]);

  // Gestion clavier (DOIT être après les fonctions copySelectedEntities, pasteEntities, duplicateSelectedEntities)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // MODIFICATION v7.11: Ignorer les raccourcis si le focus est sur un input/textarea
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true";

      // Pour les touches de saisie (Delete, Backspace, lettres), ne pas interférer avec les inputs
      if (isInputFocused && e.key !== "Escape") {
        return;
      }

      // Echap - annuler l'action en cours
      if (e.key === "Escape") {
        // Fermer l'input texte en premier
        if (textInput?.active) {
          setTextInput(null);
          return;
        }
        // Annuler le drag du gizmo
        if (gizmoDrag) {
          // Restaurer les positions initiales
          setSketch((prev) => {
            const newSketch = { ...prev };
            newSketch.points = new Map(prev.points);

            for (const [pointId, initialPos] of gizmoDrag.initialPositions) {
              newSketch.points.set(pointId, { id: pointId, x: initialPos.x, y: initialPos.y });
            }

            return newSketch;
          });
          setGizmoDrag(null);
          setShowTransformGizmo(false); // Désactiver le gizmo aussi
          toast.info("Transformation annulée");
          return;
        }
        // Si gizmo affiché mais pas en train de drag, le désactiver
        if (showTransformGizmo) {
          setShowTransformGizmo(false);
          return;
        }
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          setTempPoints([]);
          setTempGeometry(null);
          setActiveTool("select");
        }
      }

      // Supprimer
      if (e.key === "Delete" || e.key === "Backspace") {
        // PRIORITÉ 1: Entités géométriques sélectionnées
        if (selectedEntities.size > 0) {
          deleteSelectedEntities();
          return;
        }
        // PRIORITÉ 2: Marker sélectionné
        if (selectedMarkerId) {
          // Sauvegarder l'état actuel dans l'historique AVANT de supprimer
          addToImageHistoryRef.current(backgroundImagesRef.current, markerLinksRef.current);

          const [imageId, markerId] = selectedMarkerId.split(":");
          setBackgroundImages((prev) =>
            prev.map((img) => {
              if (img.id !== imageId) return img;
              return {
                ...img,
                markers: img.markers.filter((m) => m.id !== markerId),
              };
            }),
          );
          // Supprimer les liens qui référencent ce marker
          setMarkerLinks((links) =>
            links.filter(
              (link) =>
                !(link.marker1.imageId === imageId && link.marker1.markerId === markerId) &&
                !(link.marker2.imageId === imageId && link.marker2.markerId === markerId),
            ),
          );
          setSelectedMarkerId(null);
          toast.success("Marqueur supprimé");
          return;
        }
        // v7.32: PRIORITÉ 3: Photos multi-sélectionnées
        if (selectedImageIds.size > 0) {
          // Sauvegarder l'état actuel dans l'historique AVANT de supprimer
          addToImageHistoryRef.current(backgroundImagesRef.current, markerLinksRef.current);

          const idsToDelete = new Set(selectedImageIds);
          setBackgroundImages((prev) => {
            const newImages = prev.filter((img) => !idsToDelete.has(img.id));
            // Aussi supprimer les liens qui référencent ces images
            setMarkerLinks((links) =>
              links.filter((link) => !idsToDelete.has(link.marker1.imageId) && !idsToDelete.has(link.marker2.imageId)),
            );
            return newImages;
          });
          const count = selectedImageIds.size;
          setSelectedImageIds(new Set());
          setSelectedImageId(null);
          toast.success(`${count} photo(s) supprimée(s)`);
          return;
        }
        // PRIORITÉ 4: Photo unique sélectionnée
        if (selectedImageId) {
          // Sauvegarder l'état actuel dans l'historique AVANT de supprimer
          addToImageHistoryRef.current(backgroundImagesRef.current, markerLinksRef.current);

          setBackgroundImages((prev) => {
            const newImages = prev.filter((img) => img.id !== selectedImageId);
            // Aussi supprimer les liens qui référencent cette image
            setMarkerLinks((links) =>
              links.filter(
                (link) => link.marker1.imageId !== selectedImageId && link.marker2.imageId !== selectedImageId,
              ),
            );
            return newImages;
          });
          setSelectedImageId(null);
          toast.success("Photo supprimée");
          return;
        }
      }

      // Raccourcis outils
      if (!e.ctrlKey && !e.metaKey) {
        const resetMarkerMode = () => {
          setMarkerMode("idle");
          setPendingLink(null);
        };
        switch (e.key.toLowerCase()) {
          case "v":
            setActiveTool("select");
            resetMarkerMode();
            break;
          case "h":
            setActiveTool("pan");
            resetMarkerMode();
            break;
          case "l":
            setActiveTool("line");
            resetMarkerMode();
            break;
          case "c":
            setActiveTool("circle");
            resetMarkerMode();
            break;
          case "a":
            setActiveTool("arc3points");
            resetMarkerMode();
            break;
          case "r":
            setActiveTool("rectangle");
            resetMarkerMode();
            break;
          case "b":
            setActiveTool("bezier");
            resetMarkerMode();
            break;
          case "s":
            // S pour symétrie seulement si des entités sont sélectionnées
            if (selectedEntities.size > 0) {
              setActiveTool("mirror");
              resetMarkerMode();
            }
            break;
          case "S":
            // Shift+S pour l'outil spline
            if (e.shiftKey) {
              setActiveTool("spline");
              resetMarkerMode();
            }
            break;
          case "p":
            // P pour l'outil polygone
            setActiveTool("polygon");
            resetMarkerMode();
            break;
          case "t":
            // T pour activer/désactiver le gizmo de transformation
            if (!showTransformGizmo) {
              // Activer le gizmo = passer en mode select
              setActiveTool("select");
              resetMarkerMode();
            }
            setShowTransformGizmo(!showTransformGizmo);
            break;
          case "T":
            // Shift+T pour l'outil texte
            if (e.shiftKey) {
              setActiveTool("text");
              resetMarkerMode();
            }
            break;
          case "d":
            setActiveTool("dimension");
            resetMarkerMode();
            break;
          case "m":
            setActiveTool("measure");
            setShowMeasurePanel(true); // MOD v7.16: Ouvrir automatiquement le panneau
            resetMarkerMode();
            break;
          case "f":
            fitToContent();
            break;
        }
      }

      // Ctrl+Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }

      // Ctrl+Y - Redo
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }

      // Ctrl+S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveSketch();
      }

      // Ctrl+A - Sélectionner tout (figures ET photos)
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        e.stopPropagation();
        const currentSketch = sketchRef.current;

        // Sélectionner toutes les géométries
        const allGeoIds = new Set<string>();
        currentSketch.geometries.forEach((_, id) => allGeoIds.add(id));
        setSelectedEntities(allGeoIds);

        // v7.32: Sélectionner aussi toutes les photos visibles
        const currentImages = backgroundImagesRef.current;
        const allImageIds = new Set<string>();
        currentImages.forEach((img) => {
          if (img.visible) {
            const layer = currentSketch.layers.get(img.layerId || "");
            if (!layer || layer.visible !== false) {
              allImageIds.add(img.id);
            }
          }
        });
        setSelectedImageIds(allImageIds);
        if (allImageIds.size > 0 && currentImages.length > 0) {
          setSelectedImageId(currentImages[0].id);
        }

        // Toast avec le résumé
        const details: string[] = [];
        if (allGeoIds.size > 0) details.push(`${allGeoIds.size} figure(s)`);
        if (allImageIds.size > 0) details.push(`${allImageIds.size} photo(s)`);
        if (details.length > 0) {
          toast.success(`${details.join(" + ")} sélectionnée(s)`);
        }
      }

      // Ctrl+C - Copier
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        copySelectedEntities();
      }

      // Ctrl+V - Coller
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        pasteEntities();
      }

      // Ctrl+D - Dupliquer
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        duplicateSelectedEntities();
      }

      // Ctrl+G - Grouper
      if ((e.ctrlKey || e.metaKey) && e.key === "g" && !e.shiftKey) {
        e.preventDefault();
        if (selectedEntities.size >= 2) {
          handleGroupSelection();
        }
      }

      // Ctrl+Shift+G - Dégrouper
      if ((e.ctrlKey || e.metaKey) && e.key === "G" && e.shiftKey) {
        e.preventDefault();
        if (selectedEntities.size > 0) {
          handleUngroupSelection();
        }
      }

      // ? ou F1 - Afficher les raccourcis clavier
      if (e.key === "?" || e.key === "F1") {
        e.preventDefault();
        setShowShortcutsPanel(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isFullscreen,
    selectedEntities,
    selectedImageId, // v7.32: Pour la suppression des photos
    selectedImageIds, // v7.32: Pour la suppression multi-photos
    selectedMarkerId, // v7.32: Pour la suppression des markers
    saveSketch,
    copySelectedEntities,
    pasteEntities,
    duplicateSelectedEntities,
    deleteSelectedEntities,
    handleGroupSelection,
    handleUngroupSelection,
    undo,
    redo,
    fitToContent,
    showTransformGizmo,
    gizmoDrag, // Ajouté pour s'assurer que handleKeyDown est à jour
    textInput, // Pour fermer l'input texte avec Echap
    // Note: gizmoDragRef utilisé aussi pour éviter stale closure
  ]);

  // === FONCTIONS DE CALIBRATION ===

  // Supprimer un point de calibration
  // FIX v7.35: Utiliser updateSelectedImageCalibration pour modifier backgroundImages[].calibrationData
  const deleteCalibrationPoint = useCallback(
    (pointId: string) => {
      updateSelectedImageCalibration((prev) => {
        const newPoints = new Map(prev.points);
        const newPairs = new Map(prev.pairs);

        // Supprimer les paires qui utilisent ce point
        newPairs.forEach((pair, pairId) => {
          if (pair.point1Id === pointId || pair.point2Id === pointId) {
            newPairs.delete(pairId);
          }
        });

        newPoints.delete(pointId);

        // Réassigner les labels
        let index = 1;
        newPoints.forEach((point) => {
          point.label = String(index++);
        });

        return { ...prev, points: newPoints, pairs: newPairs };
      });
      toast.success("Point supprimé");
    },
    [updateSelectedImageCalibration],
  );

  // Supprimer une paire (utilise l'image sélectionnée)
  const deleteCalibrationPair = useCallback(
    (pairId: string) => {
      updateSelectedImageCalibration((prev) => {
        const newPairs = new Map(prev.pairs);
        newPairs.delete(pairId);
        return { ...prev, pairs: newPairs };
      });
      toast.success("Paire supprimée");
    },
    [updateSelectedImageCalibration],
  );

  // Réinitialiser la calibration
  // MOD #85: Restaure les points originaux et l'échelle de l'image

  // === REMPLISSAGES / HACHURES ===

  // Générer une clé unique pour une forme basée sur ses geoIds triés
  const getShapeFillKey = useCallback((geoIds: string[]): string => {
    return [...geoIds].sort().join("-");
  }, []);

  // Ajouter ou mettre à jour un remplissage
  const addOrUpdateShapeFill = useCallback(
    (
      geoIds: string[],
      options: {
        fillType: "solid" | "hatch";
        color: string;
        opacity: number;
        hatchPattern?: HatchPattern;
        hatchAngle?: number;
        hatchSpacing?: number;
      },
    ) => {
      const key = getShapeFillKey(geoIds);
      const existingFill = sketch.shapeFills.get(key);

      const fill: ShapeFill = {
        id: existingFill?.id || generateId(),
        geoIds: [...geoIds].sort(),
        fillType: options.fillType,
        color: options.color,
        opacity: options.opacity,
        hatchPattern: options.hatchPattern,
        hatchAngle: options.hatchAngle,
        hatchSpacing: options.hatchSpacing,
      };

      const newSketch = { ...sketch };
      newSketch.shapeFills = new Map(sketch.shapeFills);
      newSketch.shapeFills.set(key, fill);

      setSketch(newSketch);
      addToHistory(newSketch, existingFill ? "Modifier remplissage" : "Ajouter remplissage");
      toast.success(existingFill ? "Remplissage modifié" : "Remplissage ajouté");
    },
    [sketch, getShapeFillKey, addToHistory],
  );

  // Supprimer un remplissage
  const removeShapeFill = useCallback(
    (geoIds: string[]) => {
      const key = getShapeFillKey(geoIds);
      if (!sketch.shapeFills.has(key)) return;

      const newSketch = { ...sketch };
      newSketch.shapeFills = new Map(sketch.shapeFills);
      newSketch.shapeFills.delete(key);

      setSketch(newSketch);
      addToHistory(newSketch, "Supprimer remplissage");
      toast.success("Remplissage supprimé");
    },
    [sketch, getShapeFillKey, addToHistory],
  );

  // Ouvrir le dialogue de remplissage pour une forme
  const openFillDialog = useCallback(
    (geoIds: string[], path: Path2D) => {
      // Fermer les autres panneaux d'édition
      closeAllEditPanels("fill");

      // Vérifier si un remplissage existe déjà
      const key = getShapeFillKey(geoIds);
      const existingFill = sketch.shapeFills.get(key);

      if (existingFill) {
        // Charger les paramètres existants
        setFillColor(existingFill.color);
        setFillOpacity(existingFill.opacity);
        setFillType(existingFill.fillType);
        setHatchPattern(existingFill.hatchPattern || "lines");
        setHatchAngle(existingFill.hatchAngle ?? 45);
        setHatchSpacing(existingFill.hatchSpacing || 5);
      } else {
        // Valeurs par défaut
        setFillColor("#3B82F6");
        setFillOpacity(0.3);
        setFillType("solid");
        setHatchPattern("lines");
        setHatchAngle(45);
        setHatchSpacing(5);
      }

      setFillDialogTarget({ geoIds, path });
      setFillDialogOpen(true);
    },
    [sketch.shapeFills, getShapeFillKey, closeAllEditPanels],
  );

  // Confirmer le remplissage depuis le dialogue
  const confirmFillDialog = useCallback(() => {
    if (!fillDialogTarget) return;

    addOrUpdateShapeFill(fillDialogTarget.geoIds, {
      fillType,
      color: fillColor,
      opacity: fillOpacity,
      hatchPattern: fillType === "hatch" ? hatchPattern : undefined,
      hatchAngle: fillType === "hatch" ? hatchAngle : undefined,
      hatchSpacing: fillType === "hatch" ? hatchSpacing : undefined,
    });

    setFillDialogOpen(false);
    setFillDialogTarget(null);
  }, [
    fillDialogTarget,
    fillType,
    fillColor,
    fillOpacity,
    hatchPattern,
    hatchAngle,
    hatchSpacing,
    addOrUpdateShapeFill,
  ]);

  // Ajouter contrainte
  const addConstraint = useCallback(
    async (type: Constraint["type"], entities: string[], value?: number) => {
      const constraint: Constraint = {
        id: generateId(),
        type,
        entities,
        value,
        driving: true,
      };

      const newSketch = { ...sketch };
      newSketch.constraints = new Map(sketch.constraints);
      newSketch.constraints.set(constraint.id, constraint);

      setSketch(newSketch);
      await solveSketch(newSketch);
      addToHistory(newSketch);

      // Message spécial pour la contrainte "equal"
      if (type === "equal" && entities.length === 2) {
        const refGeo = sketch.geometries.get(entities[0]);
        if (refGeo && refGeo.type === "line") {
          const line = refGeo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (p1 && p2) {
            const refLength = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
            // Mettre en évidence la ligne de référence en vert
            setReferenceHighlight(entities[0]);
            toast.success(`Contrainte "égal" : longueur de référence = ${refLength.toFixed(1)} mm`);
            return;
          }
        }
      }

      toast.success(`Contrainte "${type}" ajoutée`);
    },
    [sketch, solveSketch, addToHistory],
  );

  // Sélectionner tout le groupe quand on clique sur un élément du groupe
  const selectGroup = useCallback(
    (entityId: string) => {
      // Trouver le groupe qui contient cette entité
      let groupEntityIds: string[] | null = null;
      sketch.groups.forEach((group) => {
        if (group.entityIds.includes(entityId)) {
          groupEntityIds = group.entityIds;
        }
      });

      if (groupEntityIds) {
        setSelectedEntities(new Set(groupEntityIds));
        toast.info(`Groupe sélectionné (${groupEntityIds.length} éléments)`);
        return true;
      }
      return false;
    },
    [sketch.groups],
  );

  // === CONTRAINTE D'ANGLE ===

  // Calculer l'angle entre 2 lignes (en degrés)
  const calculateAngleBetweenLines = useCallback(
    (line1Id: string, line2Id: string): number | null => {
      const line1 = sketch.geometries.get(line1Id) as Line | undefined;
      const line2 = sketch.geometries.get(line2Id) as Line | undefined;

      if (!line1 || !line2 || line1.type !== "line" || line2.type !== "line") {
        return null;
      }

      const p1Start = sketch.points.get(line1.p1);
      const p1End = sketch.points.get(line1.p2);
      const p2Start = sketch.points.get(line2.p1);
      const p2End = sketch.points.get(line2.p2);

      if (!p1Start || !p1End || !p2Start || !p2End) {
        return null;
      }

      // Vecteurs directeurs
      const v1 = { x: p1End.x - p1Start.x, y: p1End.y - p1Start.y };
      const v2 = { x: p2End.x - p2Start.x, y: p2End.y - p2Start.y };

      // Produit scalaire et normes
      const dot = v1.x * v2.x + v1.y * v2.y;
      const norm1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const norm2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

      if (norm1 === 0 || norm2 === 0) {
        return null;
      }

      // Angle en radians puis degrés
      const cosAngle = Math.max(-1, Math.min(1, dot / (norm1 * norm2)));
      const angleRad = Math.acos(cosAngle);
      const angleDeg = (angleRad * 180) / Math.PI;

      return Math.round(angleDeg * 100) / 100; // Arrondi à 2 décimales
    },
    [sketch],
  );

  // Ouvrir le dialog de contrainte d'angle
  const openAngleConstraintDialog = useCallback(() => {
    if (selectedEntities.size !== 2) {
      toast.error("Sélectionnez exactement 2 lignes");
      return;
    }

    const ids = Array.from(selectedEntities);
    const geo1 = sketch.geometries.get(ids[0]);
    const geo2 = sketch.geometries.get(ids[1]);

    if (!geo1 || !geo2 || geo1.type !== "line" || geo2.type !== "line") {
      toast.error("Sélectionnez 2 lignes (pas des cercles ou autres)");
      return;
    }

    const currentAngle = calculateAngleBetweenLines(ids[0], ids[1]);
    if (currentAngle === null) {
      toast.error("Impossible de calculer l'angle");
      return;
    }

    setAngleConstraintDialog({
      open: true,
      entities: ids,
      currentAngle,
    });
  }, [selectedEntities, sketch, calculateAngleBetweenLines]);

  // Appliquer la contrainte d'angle
  const applyAngleConstraint = useCallback(
    (angleDeg: number) => {
      if (!angleConstraintDialog) return;

      addConstraint("angle", angleConstraintDialog.entities, angleDeg);
      setAngleConstraintDialog(null);
      toast.success(`Contrainte d'angle ${angleDeg}° ajoutée`);
    },
    [angleConstraintDialog, addConstraint],
  );

  // Appliquer la contrainte tangente (ligne + cercle/arc)
  const applyTangentConstraint = useCallback(() => {
    if (selectedEntities.size !== 2) {
      toast.error("Sélectionnez une ligne et un cercle/arc");
      return;
    }

    const ids = Array.from(selectedEntities);
    const geo1 = sketch.geometries.get(ids[0]);
    const geo2 = sketch.geometries.get(ids[1]);

    if (!geo1 || !geo2) {
      toast.error("Géométries non trouvées");
      return;
    }

    // Identifier la ligne et le cercle/arc
    let line: Line | null = null;
    let circleOrArc: CircleType | Arc | null = null;
    let lineId: string = "";
    let circleId: string = "";

    if (geo1.type === "line" && (geo2.type === "circle" || geo2.type === "arc")) {
      line = geo1 as Line;
      circleOrArc = geo2 as CircleType | Arc;
      lineId = ids[0];
      circleId = ids[1];
    } else if (geo2.type === "line" && (geo1.type === "circle" || geo1.type === "arc")) {
      line = geo2 as Line;
      circleOrArc = geo1 as CircleType | Arc;
      lineId = ids[1];
      circleId = ids[0];
    } else {
      toast.error("Sélectionnez une ligne et un cercle/arc");
      return;
    }

    const p1 = sketch.points.get(line.p1);
    const p2 = sketch.points.get(line.p2);
    const centerPoint = sketch.points.get(circleOrArc.center);

    if (!p1 || !p2 || !centerPoint) {
      toast.error("Points non trouvés");
      return;
    }

    const radius = circleOrArc.radius;

    // Calculer la projection du centre sur la ligne
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lineLength = Math.sqrt(dx * dx + dy * dy);
    if (lineLength < 1e-10) {
      toast.error("Ligne trop courte");
      return;
    }

    // Vecteur unitaire de la ligne
    const ux = dx / lineLength;
    const uy = dy / lineLength;

    // Vecteur du point P1 vers le centre
    const fx = centerPoint.x - p1.x;
    const fy = centerPoint.y - p1.y;

    // Projection du centre sur la ligne (paramètre t)
    const t = fx * ux + fy * uy;

    // Point projeté sur la ligne
    const projX = p1.x + t * ux;
    const projY = p1.y + t * uy;

    // Direction perpendiculaire (du projeté vers le centre)
    let perpX = centerPoint.x - projX;
    let perpY = centerPoint.y - projY;
    const perpLen = Math.sqrt(perpX * perpX + perpY * perpY);

    if (perpLen < 1e-10) {
      // Le centre est sur la ligne, choisir une direction perpendiculaire arbitraire
      perpX = -uy;
      perpY = ux;
    } else {
      perpX /= perpLen;
      perpY /= perpLen;
    }

    // Nouvelle position du centre pour être tangent
    const newCenterX = projX + perpX * radius;
    const newCenterY = projY + perpY * radius;

    // Appliquer le déplacement
    const newSketch = { ...sketch };
    newSketch.points = new Map(sketch.points);
    newSketch.points.set(circleOrArc.center, {
      ...centerPoint,
      x: newCenterX,
      y: newCenterY,
    });

    // Ajouter la contrainte
    const constraint: Constraint = {
      id: generateId(),
      type: "tangent",
      entities: [lineId, circleId],
      driving: true,
    };
    newSketch.constraints = new Map(sketch.constraints);
    newSketch.constraints.set(constraint.id, constraint);

    setSketch(newSketch);
    addToHistory(newSketch, "Contrainte tangente");
    toast.success("Cercle rendu tangent à la ligne");
  }, [selectedEntities, sketch, addToHistory]);

  // Ajouter cotation
  const addDimension = useCallback(
    (type: Dimension["type"], entities: string[], value: number) => {
      const dimension: Dimension = {
        id: generateId(),
        type,
        entities,
        value,
        position: { x: 0, y: 0 },
      };

      // Créer aussi la contrainte
      let constraintType: Constraint["type"] = "distance";
      if (type === "radius") constraintType = "radius";
      else if (type === "angle") constraintType = "angle";

      const constraint: Constraint = {
        id: generateId(),
        type: constraintType,
        entities,
        value: value * sketch.scaleFactor, // Convertir mm en px
        driving: true,
      };

      dimension.constraintId = constraint.id;

      const newSketch = { ...sketch };
      newSketch.dimensions = new Map(sketch.dimensions);
      newSketch.constraints = new Map(sketch.constraints);

      newSketch.dimensions.set(dimension.id, dimension);
      newSketch.constraints.set(constraint.id, constraint);

      setSketch(newSketch);
      solveSketch(newSketch);
      addToHistory(newSketch);

      toast.success(`Cotation ajoutée: ${value}mm`);
    },
    [sketch, solveSketch, addToHistory],
  );

  // MOD v7.12: Ouvrir la modale d'export DXF
  const handleExportDXF = useCallback(() => {
    setDxfExportDialog({
      open: true,
      filename: `gabarit-${templateId || "export"}`,
      position: { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 80 },
    });
  }, [templateId]);

  // MOD v7.12: Effectuer l'export DXF avec le nom choisi
  const confirmExportDXF = useCallback(() => {
    if (!dxfExportDialog) return;

    const dxfContent = exportToDXF(sketch);
    const blob = new Blob([dxfContent], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    // Ajouter .dxf si pas déjà présent
    const filename = dxfExportDialog.filename.endsWith(".dxf")
      ? dxfExportDialog.filename
      : `${dxfExportDialog.filename}.dxf`;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    setDxfExportDialog(null);
    toast.success(`DXF exporté: ${filename}`);
  }, [sketch, dxfExportDialog]);

  // Export SVG
  const handleExportSVG = useCallback(() => {
    const svgContent = exportToSVG(sketch);
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `gabarit-${templateId}.svg`;
    a.click();

    URL.revokeObjectURL(url);
    toast.success("SVG exporté !");
  }, [sketch, templateId]);

  // Export PNG
  const handleExportPNG = useCallback(
    (transparent: boolean = false) => {
      if (!canvasRef.current) {
        toast.error("Canvas non disponible");
        return;
      }

      // Créer un canvas temporaire pour l'export
      const tempCanvas = document.createElement("canvas");
      const padding = 20; // Padding en pixels (réduit)

      // Filtrer les géométries (exclure construction)
      const exportGeometries: Geometry[] = [];
      sketch.geometries.forEach((geo) => {
        if (!(geo as any).isConstruction) {
          exportGeometries.push(geo);
        }
      });

      if (exportGeometries.length === 0) {
        toast.error("Aucune géométrie à exporter (hors construction)");
        return;
      }

      // Calculer les bounds (uniquement sur géométries exportables)
      let minX = Infinity,
        minY = Infinity;
      let maxX = -Infinity,
        maxY = -Infinity;

      exportGeometries.forEach((geo) => {
        if (geo.type === "line") {
          const line = geo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (p1 && p2) {
            minX = Math.min(minX, p1.x, p2.x);
            minY = Math.min(minY, p1.y, p2.y);
            maxX = Math.max(maxX, p1.x, p2.x);
            maxY = Math.max(maxY, p1.y, p2.y);
          }
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          const center = sketch.points.get(circle.center);
          if (center) {
            minX = Math.min(minX, center.x - circle.radius);
            minY = Math.min(minY, center.y - circle.radius);
            maxX = Math.max(maxX, center.x + circle.radius);
            maxY = Math.max(maxY, center.y + circle.radius);
          }
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          const center = sketch.points.get(arc.center);
          if (center) {
            minX = Math.min(minX, center.x - arc.radius);
            minY = Math.min(minY, center.y - arc.radius);
            maxX = Math.max(maxX, center.x + arc.radius);
            maxY = Math.max(maxY, center.y + arc.radius);
          }
        }
      });

      if (!isFinite(minX)) {
        toast.error("Aucune géométrie à exporter");
        return;
      }

      // Dimensions en mm (sketch units sont en pixels, diviser par scaleFactor)
      const widthMm = (maxX - minX) / sketch.scaleFactor;
      const heightMm = (maxY - minY) / sketch.scaleFactor;

      // 300 DPI pour impression de qualité
      // 300 pixels/inch ÷ 25.4 mm/inch = 11.811 pixels/mm
      const DPI = 300;
      const pixelsPerMm = DPI / 25.4;

      // Calculer la taille en pixels pour 300 DPI
      const canvasWidth = Math.ceil(widthMm * pixelsPerMm) + padding * 2;
      const canvasHeight = Math.ceil(heightMm * pixelsPerMm) + padding * 2;

      tempCanvas.width = Math.max(100, canvasWidth);
      tempCanvas.height = Math.max(100, canvasHeight);

      const ctx = tempCanvas.getContext("2d");
      if (!ctx) return;

      // Fond blanc ou transparent
      if (!transparent) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      }

      // Échelle pour convertir des coordonnées sketch vers pixels canvas
      // sketch coords → mm → pixels
      const scale = pixelsPerMm / sketch.scaleFactor;

      // Dessiner les géométries (sans construction)
      ctx.save();
      ctx.translate(padding - minX * scale, padding - minY * scale);
      ctx.scale(scale, scale);

      // Dessiner les remplissages (shapeFills) AVANT les lignes
      if (sketch.shapeFills) {
        sketch.shapeFills.forEach((fill) => {
          if (!fill.geoIds || fill.geoIds.length === 0) return;

          const allPoints: { x: number; y: number }[] = [];
          const processedPoints = new Set<string>();

          for (const geoId of fill.geoIds) {
            const geo = sketch.geometries.get(geoId);
            if (geo && geo.type === "line") {
              const line = geo as Line;
              const p1 = sketch.points.get(line.p1);
              const p2 = sketch.points.get(line.p2);
              if (p1 && !processedPoints.has(line.p1)) {
                allPoints.push({ x: p1.x, y: p1.y });
                processedPoints.add(line.p1);
              }
              if (p2 && !processedPoints.has(line.p2)) {
                allPoints.push({ x: p2.x, y: p2.y });
                processedPoints.add(line.p2);
              }
            }
          }

          if (allPoints.length < 3) return;

          // Trier les points pour former un polygone
          const fillCx = allPoints.reduce((s, p) => s + p.x, 0) / allPoints.length;
          const fillCy = allPoints.reduce((s, p) => s + p.y, 0) / allPoints.length;

          allPoints.sort((a, b) => {
            const angleA = Math.atan2(a.y - fillCy, a.x - fillCx);
            const angleB = Math.atan2(b.y - fillCy, b.x - fillCx);
            return angleA - angleB;
          });

          ctx.fillStyle = fill.color || "#000000";
          ctx.beginPath();
          allPoints.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.fill();
        });
      }

      // Lignes
      exportGeometries.forEach((geo) => {
        ctx.strokeStyle = (geo as any).strokeColor || "#000000";
        ctx.lineWidth = ((geo as any).strokeWidth || 1) / scale;
        ctx.beginPath();

        if (geo.type === "line") {
          const line = geo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (p1 && p2) {
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
          }
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          const center = sketch.points.get(circle.center);
          if (center) {
            ctx.arc(center.x, center.y, circle.radius, 0, Math.PI * 2);
          }
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          const center = sketch.points.get(arc.center);
          const startPt = sketch.points.get(arc.startPoint);
          const endPt = sketch.points.get(arc.endPoint);
          if (center && startPt && endPt) {
            const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
            const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);
            ctx.arc(center.x, center.y, arc.radius, startAngle, endAngle, arc.counterClockwise);
          }
        }
        ctx.stroke();
      });

      ctx.restore();

      // Fonction pour ajouter les métadonnées pHYs (DPI) au PNG
      const addPngDpiMetadata = async (dataUrl: string, dpi: number): Promise<string> => {
        // Convertir dataURL en ArrayBuffer
        const base64 = dataUrl.split(",")[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        // Calculer pixels par mètre (DPI * 39.3701)
        const pixelsPerMeter = Math.round(dpi * 39.3701);

        // Créer le chunk pHYs
        // Structure: [length (4)] [type "pHYs" (4)] [x pixels/unit (4)] [y pixels/unit (4)] [unit (1)] [CRC (4)]
        const pHYsData = new Uint8Array(21);
        const dataView = new DataView(pHYsData.buffer);

        // Length = 9 (données seulement)
        dataView.setUint32(0, 9, false);

        // Type = "pHYs"
        pHYsData[4] = 0x70; // p
        pHYsData[5] = 0x48; // H
        pHYsData[6] = 0x59; // Y
        pHYsData[7] = 0x73; // s

        // X pixels per unit
        dataView.setUint32(8, pixelsPerMeter, false);

        // Y pixels per unit
        dataView.setUint32(12, pixelsPerMeter, false);

        // Unit = 1 (meter)
        pHYsData[16] = 1;

        // Calculer CRC32 sur type + data
        const crcData = pHYsData.slice(4, 17);
        let crc = 0xffffffff;
        const crcTable: number[] = [];
        for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
          }
          crcTable[n] = c;
        }
        for (let i = 0; i < crcData.length; i++) {
          crc = crcTable[(crc ^ crcData[i]) & 0xff] ^ (crc >>> 8);
        }
        crc = (crc ^ 0xffffffff) >>> 0;
        dataView.setUint32(17, crc, false);

        // Trouver la position après IHDR (signature PNG = 8 bytes, IHDR = 25 bytes)
        // Le chunk pHYs doit être inséré après IHDR
        const insertPos = 33; // 8 (signature) + 25 (IHDR chunk complet)

        // Créer le nouveau PNG avec pHYs inséré
        const newPng = new Uint8Array(bytes.length + 21);
        newPng.set(bytes.slice(0, insertPos), 0);
        newPng.set(pHYsData, insertPos);
        newPng.set(bytes.slice(insertPos), insertPos + 21);

        // Convertir en blob et retourner l'URL
        const blob = new Blob([newPng], { type: "image/png" });
        return URL.createObjectURL(blob);
      };

      // Ajouter les métadonnées DPI et télécharger
      const dataUrl = tempCanvas.toDataURL("image/png");

      addPngDpiMetadata(dataUrl, DPI)
        .then((blobUrl) => {
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = `gabarit-${templateId}${transparent ? "-transparent" : ""}-${widthMm.toFixed(0)}x${heightMm.toFixed(0)}mm.png`;
          a.click();
          URL.revokeObjectURL(blobUrl);

          toast.success(`PNG exporté à 300 DPI (${widthMm.toFixed(1)} × ${heightMm.toFixed(1)} mm)`);
          setShowExportDialog(null);
        })
        .catch(() => {
          // Fallback si l'ajout des métadonnées échoue
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = `gabarit-${templateId}${transparent ? "-transparent" : ""}.png`;
          a.click();
          toast.success(`PNG exporté${transparent ? " (fond transparent)" : ""} !`);
          setShowExportDialog(null);
        });
    },
    [sketch, templateId],
  );

  // Export PDF
  const handleExportPDF = useCallback(async () => {
    if (!canvasRef.current) {
      toast.error("Canvas non disponible");
      return;
    }

    // Calculer les bounds
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    sketch.points.forEach((pt) => {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    });

    if (!isFinite(minX)) {
      toast.error("Aucune géométrie à exporter");
      return;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const padding = 20;
    const scale = 2.83465; // 72 DPI / 25.4 mm par inch

    // Créer le SVG pour le PDF
    const svgWidth = width * scale + padding * 2;
    const svgHeight = height * scale + padding * 2;

    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <rect width="100%" height="100%" fill="white"/>
  <g transform="translate(${padding - minX * scale}, ${padding - minY * scale}) scale(${scale})">`;

    // Ajouter les géométries
    sketch.geometries.forEach((geo) => {
      const color = (geo as any).strokeColor || "#000000";
      const strokeWidth = (geo as any).strokeWidth || 1;

      if (geo.type === "line") {
        const line = geo as Line;
        const p1 = sketch.points.get(line.p1);
        const p2 = sketch.points.get(line.p2);
        if (p1 && p2) {
          svgContent += `\n    <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="${strokeWidth / scale}" fill="none"/>`;
        }
      } else if (geo.type === "circle") {
        const circle = geo as CircleType;
        const center = sketch.points.get(circle.center);
        if (center) {
          svgContent += `\n    <circle cx="${center.x}" cy="${center.y}" r="${circle.radius}" stroke="${color}" stroke-width="${strokeWidth / scale}" fill="none"/>`;
        }
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        const center = sketch.points.get(arc.center);
        const startPt = sketch.points.get(arc.startPoint);
        const endPt = sketch.points.get(arc.endPoint);
        if (center && startPt && endPt) {
          const largeArc = 0;
          const sweep = arc.counterClockwise ? 0 : 1;
          svgContent += `\n    <path d="M ${startPt.x} ${startPt.y} A ${arc.radius} ${arc.radius} 0 ${largeArc} ${sweep} ${endPt.x} ${endPt.y}" stroke="${color}" stroke-width="${strokeWidth / scale}" fill="none"/>`;
        }
      }
    });

    svgContent += `\n  </g>\n</svg>`;

    // Pour un vrai PDF, on utilise le SVG comme base
    // On pourrait utiliser jsPDF mais pour simplifier, on exporte en SVG avec extension .pdf
    // L'utilisateur peut l'ouvrir avec un viewer PDF ou le convertir

    const blob = new Blob([svgContent], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gabarit-${templateId}.svg`; // SVG car on n'a pas jsPDF
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Plan exporté en SVG (ouvrir avec un viewer pour convertir en PDF)");
    setShowExportDialog(null);
  }, [sketch, templateId]);

  // Export des cellules A4 sélectionnées en PDF (échelle 1:1, sans marge)
  const exportA4GridToPDF = useCallback(async () => {
    if (selectedA4Cells.size === 0) {
      toast.error("Aucune cellule sélectionnée");
      return;
    }

    // Dimensions A4 en mm (avec chevauchement)
    const basePageWidthMm = a4GridOrientation === "portrait" ? A4_WIDTH_MM : A4_HEIGHT_MM;
    const basePageHeightMm = a4GridOrientation === "portrait" ? A4_HEIGHT_MM : A4_WIDTH_MM;

    // La zone de contenu est réduite par le chevauchement (sauf pour les bords)
    const contentWidthMm = basePageWidthMm - a4OverlapMm;
    const contentHeightMm = basePageHeightMm - a4OverlapMm;

    // Créer le PDF
    const doc = new jsPDF({
      orientation: a4GridOrientation,
      unit: "mm",
      format: "a4",
    });

    // Trier les cellules par ordre (haut→bas, gauche→droite)
    const sortedCells = Array.from(selectedA4Cells).sort((a, b) => {
      const [rowA, colA] = a.split("-").map(Number);
      const [rowB, colB] = b.split("-").map(Number);
      if (rowA !== rowB) return rowA - rowB;
      return colA - colB;
    });

    // Pour chaque cellule, créer une page
    for (let index = 0; index < sortedCells.length; index++) {
      const cellKey = sortedCells[index];
      if (index > 0) doc.addPage();

      const [row, col] = cellKey.split("-").map(Number);

      // Calculer les bounds de cette cellule en coordonnées sketch
      // Avec chevauchement: chaque cellule commence a4OverlapMm plus tôt (sauf première ligne/colonne)
      const cellWidthPx = contentWidthMm * sketch.scaleFactor;
      const cellHeightPx = contentHeightMm * sketch.scaleFactor;

      const cellMinX = a4GridOrigin.x + col * cellWidthPx;
      const cellMinY = a4GridOrigin.y + row * cellHeightPx;
      // La zone exportée inclut le chevauchement
      const exportMinX = cellMinX - (col > 0 ? a4OverlapMm * sketch.scaleFactor : 0);
      const exportMinY = cellMinY - (row > 0 ? a4OverlapMm * sketch.scaleFactor : 0);
      const exportMaxX = cellMinX + basePageWidthMm * sketch.scaleFactor;
      const exportMaxY = cellMinY + basePageHeightMm * sketch.scaleFactor;

      // Fonction pour convertir coordonnées sketch → PDF
      const toPage = (x: number, y: number) => ({
        x: (x - exportMinX) / sketch.scaleFactor,
        y: (y - exportMinY) / sketch.scaleFactor,
      });

      // Dessiner les images de fond (si pas en mode plan de coupe)
      if (!a4CutMode) {
        for (const img of backgroundImages) {
          if (!img.visible) continue;
          // FIX #85c: Vérifier que l'image existe
          if (!img.image) continue;

          // Vérifier si l'image intersecte cette cellule
          const imgWidth = img.image.width * img.scale;
          const imgHeight = img.image.height * img.scale;
          const imgMinX = img.x - imgWidth / 2;
          const imgMaxX = img.x + imgWidth / 2;
          const imgMinY = img.y - imgHeight / 2;
          const imgMaxY = img.y + imgHeight / 2;

          if (imgMaxX < exportMinX || imgMinX > exportMaxX || imgMaxY < exportMinY || imgMinY > exportMaxY) {
            continue; // Pas d'intersection
          }

          try {
            // Convertir l'image en base64
            const canvas = document.createElement("canvas");
            canvas.width = img.image.width;
            canvas.height = img.image.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img.image, 0, 0);
              const base64 = canvas.toDataURL("image/jpeg", 0.8);

              // Position et dimensions dans le PDF
              const imgPos = toPage(imgMinX, imgMinY);
              const imgWidthMm = imgWidth / sketch.scaleFactor;
              const imgHeightMm = imgHeight / sketch.scaleFactor;

              // Ajouter l'image au PDF avec opacité
              doc.setGState(new (doc as any).GState({ opacity: img.opacity }));
              doc.addImage(base64, "JPEG", imgPos.x, imgPos.y, imgWidthMm, imgHeightMm);
              doc.setGState(new (doc as any).GState({ opacity: 1 }));
            }
          } catch (e) {
            console.warn("Impossible d'exporter l'image:", e);
          }
        }
      }

      // Dessiner les remplissages (shapeFills) AVANT les lignes
      if (sketch.shapeFills) {
        sketch.shapeFills.forEach((fill) => {
          if (!fill.geoIds || fill.geoIds.length === 0) return;

          // Collecter tous les points qui forment cette forme
          const allPoints: { x: number; y: number }[] = [];
          const processedPoints = new Set<string>();

          for (const geoId of fill.geoIds) {
            const geo = sketch.geometries.get(geoId);
            if (geo && geo.type === "line") {
              const line = geo as Line;
              const p1 = sketch.points.get(line.p1);
              const p2 = sketch.points.get(line.p2);
              if (p1 && !processedPoints.has(line.p1)) {
                allPoints.push({ x: p1.x, y: p1.y });
                processedPoints.add(line.p1);
              }
              if (p2 && !processedPoints.has(line.p2)) {
                allPoints.push({ x: p2.x, y: p2.y });
                processedPoints.add(line.p2);
              }
            }
          }

          if (allPoints.length < 3) return;

          // Vérifier si la forme intersecte la cellule
          const fillMinX = Math.min(...allPoints.map((p) => p.x));
          const fillMaxX = Math.max(...allPoints.map((p) => p.x));
          const fillMinY = Math.min(...allPoints.map((p) => p.y));
          const fillMaxY = Math.max(...allPoints.map((p) => p.y));

          if (fillMaxX < exportMinX || fillMinX > exportMaxX || fillMaxY < exportMinY || fillMinY > exportMaxY) {
            return;
          }

          // Trier les points pour former un polygone convexe (pour un rectangle)
          // Calculer le centre
          const fillCx = allPoints.reduce((s, p) => s + p.x, 0) / allPoints.length;
          const fillCy = allPoints.reduce((s, p) => s + p.y, 0) / allPoints.length;

          // Trier par angle
          allPoints.sort((a, b) => {
            const angleA = Math.atan2(a.y - fillCy, a.x - fillCx);
            const angleB = Math.atan2(b.y - fillCy, b.x - fillCx);
            return angleA - angleB;
          });

          // Convertir en coordonnées PDF
          const pdfPoints = allPoints.map((p) => toPage(p.x, p.y));

          // Définir la couleur de remplissage
          const fillColor = fill.color || "#000000";
          const fillR = parseInt(fillColor.slice(1, 3), 16);
          const fillG = parseInt(fillColor.slice(3, 5), 16);
          const fillB = parseInt(fillColor.slice(5, 7), 16);

          doc.setFillColor(fillR, fillG, fillB);

          // Dessiner le polygone rempli
          if (pdfPoints.length >= 3) {
            // Construire le path
            const pathData: number[][] = pdfPoints.map((p) => [p.x, p.y]);

            // Utiliser la méthode polygon de jsPDF
            (doc as any).polygon(pathData, "F"); // 'F' = Fill only
          }
        });
      }

      // Dessiner les géométries
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);

      sketch.geometries.forEach((geo) => {
        // En mode plan de coupe, ignorer les lignes de construction
        if (a4CutMode && (geo as any).isConstruction) return;

        if (geo.type === "line") {
          const line = geo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (p1 && p2) {
            // Vérifier si la ligne intersecte la cellule
            const lineMinX = Math.min(p1.x, p2.x);
            const lineMaxX = Math.max(p1.x, p2.x);
            const lineMinY = Math.min(p1.y, p2.y);
            const lineMaxY = Math.max(p1.y, p2.y);

            if (lineMaxX < exportMinX || lineMinX > exportMaxX || lineMaxY < exportMinY || lineMinY > exportMaxY) {
              return;
            }

            const pp1 = toPage(p1.x, p1.y);
            const pp2 = toPage(p2.x, p2.y);
            doc.line(pp1.x, pp1.y, pp2.x, pp2.y);
          }
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          const center = sketch.points.get(circle.center);
          if (center) {
            const radiusMm = circle.radius / sketch.scaleFactor;
            const cp = toPage(center.x, center.y);

            // Vérifier si le cercle intersecte la cellule
            if (
              cp.x + radiusMm < 0 ||
              cp.x - radiusMm > basePageWidthMm ||
              cp.y + radiusMm < 0 ||
              cp.y - radiusMm > basePageHeightMm
            ) {
              return;
            }

            doc.circle(cp.x, cp.y, radiusMm);
          }
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          const center = sketch.points.get(arc.center);
          const startPt = sketch.points.get(arc.startPoint);
          const endPt = sketch.points.get(arc.endPoint);
          if (center && startPt && endPt) {
            const cp = toPage(center.x, center.y);
            const radiusMm = arc.radius / sketch.scaleFactor;

            // Vérifier si l'arc intersecte la cellule
            if (
              cp.x + radiusMm < 0 ||
              cp.x - radiusMm > basePageWidthMm ||
              cp.y + radiusMm < 0 ||
              cp.y - radiusMm > basePageHeightMm
            ) {
              return;
            }

            // Calculer les angles à partir des points
            let startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
            let endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);

            // Dessiner l'arc (approximation avec des segments)
            const steps = 32;

            if (arc.counterClockwise) {
              [startAngle, endAngle] = [endAngle, startAngle];
            }

            // Normaliser pour que endAngle > startAngle
            while (endAngle <= startAngle) endAngle += 2 * Math.PI;

            const angleStep = (endAngle - startAngle) / steps;
            for (let i = 0; i < steps; i++) {
              const a1 = startAngle + i * angleStep;
              const a2 = startAngle + (i + 1) * angleStep;
              const x1 = cp.x + radiusMm * Math.cos(a1);
              const y1 = cp.y + radiusMm * Math.sin(a1);
              const x2 = cp.x + radiusMm * Math.cos(a2);
              const y2 = cp.y + radiusMm * Math.sin(a2);
              doc.line(x1, y1, x2, y2);
            }
          }
        }
      });

      // === Numéro de page en haut à droite ===
      const pageLabel = `${row + 1}-${col + 1}`;
      const labelX = basePageWidthMm - 5;
      const labelY = 8;

      // Fond blanc pour lisibilité
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(labelX - 12, labelY - 5, 14, 8, 1, 1, "F");

      // Bordure
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.2);
      doc.roundedRect(labelX - 12, labelY - 5, 14, 8, 1, 1, "S");

      // Texte
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text(pageLabel, labelX - 5, labelY + 1, { align: "center" });

      // Indicateur de chevauchement (petites marques aux bords)
      if (a4OverlapMm > 0) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.setLineDashPattern([1, 1], 0);

        // Marques de chevauchement
        if (col > 0) {
          // Ligne verticale à gauche indiquant la zone de chevauchement
          doc.line(a4OverlapMm, 0, a4OverlapMm, basePageHeightMm);
        }
        if (row > 0) {
          // Ligne horizontale en haut
          doc.line(0, a4OverlapMm, basePageWidthMm, a4OverlapMm);
        }
        doc.setLineDashPattern([], 0);
      }
    }

    // Sauvegarder
    const filename = a4CutMode ? "gabarit-decoupe" : "gabarit-a4";
    doc.save(`${filename}-${sortedCells.length}pages.pdf`);
    toast.success(
      `PDF exporté: ${sortedCells.length} pages A4${a4OverlapMm > 0 ? ` (chevauchement ${a4OverlapMm}mm)` : ""}`,
    );
  }, [selectedA4Cells, a4GridOrientation, a4GridOrigin, sketch, backgroundImages, a4OverlapMm, a4CutMode]);

  // Export par lot - un fichier PDF par cellule
  const exportA4GridByLot = useCallback(async () => {
    if (selectedA4Cells.size === 0) {
      toast.error("Aucune cellule sélectionnée");
      return;
    }

    // Dimensions A4 en mm
    const basePageWidthMm = a4GridOrientation === "portrait" ? A4_WIDTH_MM : A4_HEIGHT_MM;
    const basePageHeightMm = a4GridOrientation === "portrait" ? A4_HEIGHT_MM : A4_WIDTH_MM;
    const contentWidthMm = basePageWidthMm - a4OverlapMm;
    const contentHeightMm = basePageHeightMm - a4OverlapMm;

    // Trier les cellules
    const sortedCells = Array.from(selectedA4Cells).sort((a, b) => {
      const [rowA, colA] = a.split("-").map(Number);
      const [rowB, colB] = b.split("-").map(Number);
      if (rowA !== rowB) return rowA - rowB;
      return colA - colB;
    });

    toast.info(`Export de ${sortedCells.length} fichiers...`);

    // Exporter chaque cellule dans un fichier séparé
    for (let index = 0; index < sortedCells.length; index++) {
      const cellKey = sortedCells[index];
      const [row, col] = cellKey.split("-").map(Number);

      // Créer un PDF pour cette cellule
      const doc = new jsPDF({
        orientation: a4GridOrientation,
        unit: "mm",
        format: "a4",
      });

      // Calculer les bounds
      const cellWidthPx = contentWidthMm * sketch.scaleFactor;
      const cellHeightPx = contentHeightMm * sketch.scaleFactor;

      const cellMinX = a4GridOrigin.x + col * cellWidthPx;
      const cellMinY = a4GridOrigin.y + row * cellHeightPx;
      const exportMinX = cellMinX - (col > 0 ? a4OverlapMm * sketch.scaleFactor : 0);
      const exportMinY = cellMinY - (row > 0 ? a4OverlapMm * sketch.scaleFactor : 0);
      const exportMaxX = cellMinX + basePageWidthMm * sketch.scaleFactor;
      const exportMaxY = cellMinY + basePageHeightMm * sketch.scaleFactor;

      const toPage = (x: number, y: number) => ({
        x: (x - exportMinX) / sketch.scaleFactor,
        y: (y - exportMinY) / sketch.scaleFactor,
      });

      // Dessiner les images (si pas mode découpe)
      if (!a4CutMode) {
        for (const img of backgroundImages) {
          if (!img.visible) continue;
          // FIX #85c: Vérifier que l'image existe
          if (!img.image) continue;

          const imgWidth = img.image.width * img.scale;
          const imgHeight = img.image.height * img.scale;
          const imgMinX = img.x - imgWidth / 2;
          const imgMaxX = img.x + imgWidth / 2;
          const imgMinY = img.y - imgHeight / 2;
          const imgMaxY = img.y + imgHeight / 2;

          if (imgMaxX < exportMinX || imgMinX > exportMaxX || imgMaxY < exportMinY || imgMinY > exportMaxY) continue;

          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.image.width;
            canvas.height = img.image.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img.image, 0, 0);
              const base64 = canvas.toDataURL("image/jpeg", 0.8);
              const imgPos = toPage(imgMinX, imgMinY);
              const imgWidthMm = imgWidth / sketch.scaleFactor;
              const imgHeightMm = imgHeight / sketch.scaleFactor;
              doc.setGState(new (doc as any).GState({ opacity: img.opacity }));
              doc.addImage(base64, "JPEG", imgPos.x, imgPos.y, imgWidthMm, imgHeightMm);
              doc.setGState(new (doc as any).GState({ opacity: 1 }));
            }
          } catch (e) {
            console.warn("Erreur image:", e);
          }
        }
      }

      // Dessiner les remplissages (shapeFills) AVANT les lignes
      if (sketch.shapeFills) {
        sketch.shapeFills.forEach((fill) => {
          if (!fill.geoIds || fill.geoIds.length === 0) return;

          const allPoints: { x: number; y: number }[] = [];
          const processedPoints = new Set<string>();

          for (const geoId of fill.geoIds) {
            const geo = sketch.geometries.get(geoId);
            if (geo && geo.type === "line") {
              const line = geo as Line;
              const p1 = sketch.points.get(line.p1);
              const p2 = sketch.points.get(line.p2);
              if (p1 && !processedPoints.has(line.p1)) {
                allPoints.push({ x: p1.x, y: p1.y });
                processedPoints.add(line.p1);
              }
              if (p2 && !processedPoints.has(line.p2)) {
                allPoints.push({ x: p2.x, y: p2.y });
                processedPoints.add(line.p2);
              }
            }
          }

          if (allPoints.length < 3) return;

          const fillMinX = Math.min(...allPoints.map((p) => p.x));
          const fillMaxX = Math.max(...allPoints.map((p) => p.x));
          const fillMinY = Math.min(...allPoints.map((p) => p.y));
          const fillMaxY = Math.max(...allPoints.map((p) => p.y));

          if (fillMaxX < exportMinX || fillMinX > exportMaxX || fillMaxY < exportMinY || fillMinY > exportMaxY) {
            return;
          }

          const fillCx = allPoints.reduce((s, p) => s + p.x, 0) / allPoints.length;
          const fillCy = allPoints.reduce((s, p) => s + p.y, 0) / allPoints.length;

          allPoints.sort((a, b) => {
            const angleA = Math.atan2(a.y - fillCy, a.x - fillCx);
            const angleB = Math.atan2(b.y - fillCy, b.x - fillCx);
            return angleA - angleB;
          });

          const pdfPoints = allPoints.map((p) => toPage(p.x, p.y));

          const fillColor = fill.color || "#000000";
          const fillR = parseInt(fillColor.slice(1, 3), 16);
          const fillG = parseInt(fillColor.slice(3, 5), 16);
          const fillB = parseInt(fillColor.slice(5, 7), 16);

          doc.setFillColor(fillR, fillG, fillB);

          if (pdfPoints.length >= 3) {
            const pathData: number[][] = pdfPoints.map((p) => [p.x, p.y]);
            (doc as any).polygon(pathData, "F");
          }
        });
      }

      // Dessiner les géométries
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);

      sketch.geometries.forEach((geo) => {
        if (a4CutMode && (geo as any).isConstruction) return;

        if (geo.type === "line") {
          const line = geo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (p1 && p2) {
            const lineMinX = Math.min(p1.x, p2.x);
            const lineMaxX = Math.max(p1.x, p2.x);
            const lineMinY = Math.min(p1.y, p2.y);
            const lineMaxY = Math.max(p1.y, p2.y);
            if (lineMaxX < exportMinX || lineMinX > exportMaxX || lineMaxY < exportMinY || lineMinY > exportMaxY)
              return;
            const pp1 = toPage(p1.x, p1.y);
            const pp2 = toPage(p2.x, p2.y);
            doc.line(pp1.x, pp1.y, pp2.x, pp2.y);
          }
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          const center = sketch.points.get(circle.center);
          if (center) {
            const radiusMm = circle.radius / sketch.scaleFactor;
            const cp = toPage(center.x, center.y);
            if (
              cp.x + radiusMm >= 0 &&
              cp.x - radiusMm <= basePageWidthMm &&
              cp.y + radiusMm >= 0 &&
              cp.y - radiusMm <= basePageHeightMm
            ) {
              doc.circle(cp.x, cp.y, radiusMm);
            }
          }
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          const center = sketch.points.get(arc.center);
          const startPt = sketch.points.get(arc.startPoint);
          const endPt = sketch.points.get(arc.endPoint);
          if (center && startPt && endPt) {
            const cp = toPage(center.x, center.y);
            const radiusMm = arc.radius / sketch.scaleFactor;
            if (
              cp.x + radiusMm >= 0 &&
              cp.x - radiusMm <= basePageWidthMm &&
              cp.y + radiusMm >= 0 &&
              cp.y - radiusMm <= basePageHeightMm
            ) {
              let startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
              let endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);
              if (arc.counterClockwise) [startAngle, endAngle] = [endAngle, startAngle];
              while (endAngle <= startAngle) endAngle += 2 * Math.PI;
              const steps = 32;
              const angleStep = (endAngle - startAngle) / steps;
              for (let i = 0; i < steps; i++) {
                const a1 = startAngle + i * angleStep;
                const a2 = startAngle + (i + 1) * angleStep;
                doc.line(
                  cp.x + radiusMm * Math.cos(a1),
                  cp.y + radiusMm * Math.sin(a1),
                  cp.x + radiusMm * Math.cos(a2),
                  cp.y + radiusMm * Math.sin(a2),
                );
              }
            }
          }
        }
      });

      // Numéro en haut à droite
      const pageLabel = `${row + 1}-${col + 1}`;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(basePageWidthMm - 17, 3, 14, 8, 1, 1, "F");
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.2);
      doc.roundedRect(basePageWidthMm - 17, 3, 14, 8, 1, 1, "S");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text(pageLabel, basePageWidthMm - 10, 8, { align: "center" });

      // Sauvegarder ce fichier
      const filename = a4CutMode ? "decoupe" : "page";
      doc.save(`${filename}-${row + 1}-${col + 1}.pdf`);

      // Petit délai pour éviter surcharge navigateur
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    toast.success(`${sortedCells.length} fichiers PDF exportés !`);
  }, [selectedA4Cells, a4GridOrientation, a4GridOrigin, sketch, backgroundImages, a4OverlapMm, a4CutMode]);

  // Calcul automatique de la grille A4 pour couvrir tout le contenu
  const autoFitA4Grid = useCallback(() => {
    // Calculer les bounds du contenu (géométries + images)
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;
    let hasContent = false;

    // Parcourir les géométries
    sketch.geometries.forEach((geo) => {
      if (geo.type === "line") {
        const line = geo as Line;
        const p1 = sketch.points.get(line.p1);
        const p2 = sketch.points.get(line.p2);
        if (p1 && p2) {
          minX = Math.min(minX, p1.x, p2.x);
          maxX = Math.max(maxX, p1.x, p2.x);
          minY = Math.min(minY, p1.y, p2.y);
          maxY = Math.max(maxY, p1.y, p2.y);
          hasContent = true;
        }
      } else if (geo.type === "circle") {
        const circle = geo as CircleType;
        const center = sketch.points.get(circle.center);
        if (center) {
          minX = Math.min(minX, center.x - circle.radius);
          maxX = Math.max(maxX, center.x + circle.radius);
          minY = Math.min(minY, center.y - circle.radius);
          maxY = Math.max(maxY, center.y + circle.radius);
          hasContent = true;
        }
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        const center = sketch.points.get(arc.center);
        if (center) {
          minX = Math.min(minX, center.x - arc.radius);
          maxX = Math.max(maxX, center.x + arc.radius);
          minY = Math.min(minY, center.y - arc.radius);
          maxY = Math.max(maxY, center.y + arc.radius);
          hasContent = true;
        }
      }
    });

    // Parcourir les images de fond
    backgroundImages.forEach((img) => {
      if (!img.visible) return;
      // FIX #85c: Vérifier que l'image existe
      if (!img.image) return;

      const imgWidth = img.image.width * img.scale;
      const imgHeight = img.image.height * img.scale;
      minX = Math.min(minX, img.x - imgWidth / 2);
      maxX = Math.max(maxX, img.x + imgWidth / 2);
      minY = Math.min(minY, img.y - imgHeight / 2);
      maxY = Math.max(maxY, img.y + imgHeight / 2);
      hasContent = true;
    });

    if (!hasContent || !isFinite(minX)) {
      toast.error("Aucun contenu à couvrir");
      return;
    }

    // Dimensions du contenu en mm
    const contentWidthMm = (maxX - minX) / sketch.scaleFactor;
    const contentHeightMm = (maxY - minY) / sketch.scaleFactor;

    // Dimensions d'une cellule A4 (avec chevauchement)
    const cellWidthMm = (a4GridOrientation === "portrait" ? A4_WIDTH_MM : A4_HEIGHT_MM) - a4OverlapMm;
    const cellHeightMm = (a4GridOrientation === "portrait" ? A4_HEIGHT_MM : A4_WIDTH_MM) - a4OverlapMm;

    // Calculer le nombre de cellules nécessaires
    const cols = Math.max(1, Math.ceil(contentWidthMm / cellWidthMm));
    const rows = Math.max(1, Math.ceil(contentHeightMm / cellHeightMm));

    // Positionner l'origine au coin supérieur gauche du contenu (avec petite marge)
    const marginPx = 5 * sketch.scaleFactor; // 5mm de marge

    setA4GridOrigin({ x: minX - marginPx, y: minY - marginPx });
    setA4GridCols(cols);
    setA4GridRows(rows);

    // Sélectionner toutes les cellules
    const allCells = new Set<string>();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        allCells.add(`${r}-${c}`);
      }
    }
    setSelectedA4Cells(allCells);

    toast.success(`Grille auto: ${cols}×${rows} = ${cols * rows} pages A4`);
  }, [sketch, backgroundImages, a4GridOrientation, a4OverlapMm]);

  // Reset view - origine en bas à gauche
  const resetView = useCallback(() => {
    const rulerSize = 32;
    setViewport((v) => ({
      ...v,
      offsetX: rulerSize,
      offsetY: v.height - rulerSize,
      scale: 4, // ~1mm = 4px, proche de la taille réelle sur écran
    }));
  }, []);

  // Générer une miniature du canvas actuel (pour les templates)
  const generateThumbnail = useCallback((): string | null => {
    if (!canvasRef.current) return null;

    try {
      // Créer un canvas temporaire plus petit
      const tempCanvas = document.createElement("canvas");
      const size = 200;
      tempCanvas.width = size;
      tempCanvas.height = size;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return null;

      // Fond blanc
      tempCtx.fillStyle = "#ffffff";
      tempCtx.fillRect(0, 0, size, size);

      // Calculer les bounds des géométries
      let minX = Infinity,
        minY = Infinity;
      let maxX = -Infinity,
        maxY = -Infinity;

      sketch.points.forEach((pt) => {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      });

      if (minX === Infinity) return null;

      // Ajouter une marge
      const margin = 20;
      const width = maxX - minX;
      const height = maxY - minY;
      const scale = Math.min((size - 2 * margin) / width, (size - 2 * margin) / height);
      const offsetX = (size - width * scale) / 2 - minX * scale;
      const offsetY = (size - height * scale) / 2 - minY * scale;

      // Dessiner les remplissages (shapeFills) AVANT les lignes
      if (sketch.shapeFills) {
        sketch.shapeFills.forEach((fill) => {
          if (!fill.geoIds || fill.geoIds.length === 0) return;

          const allPoints: { x: number; y: number }[] = [];
          const processedPoints = new Set<string>();

          for (const geoId of fill.geoIds) {
            const geo = sketch.geometries.get(geoId);
            if (geo && geo.type === "line") {
              const line = geo as Line;
              const p1 = sketch.points.get(line.p1);
              const p2 = sketch.points.get(line.p2);
              if (p1 && !processedPoints.has(line.p1)) {
                allPoints.push({ x: p1.x, y: p1.y });
                processedPoints.add(line.p1);
              }
              if (p2 && !processedPoints.has(line.p2)) {
                allPoints.push({ x: p2.x, y: p2.y });
                processedPoints.add(line.p2);
              }
            }
          }

          if (allPoints.length < 3) return;

          // Trier les points pour former un polygone
          const fillCx = allPoints.reduce((s, p) => s + p.x, 0) / allPoints.length;
          const fillCy = allPoints.reduce((s, p) => s + p.y, 0) / allPoints.length;

          allPoints.sort((a, b) => {
            const angleA = Math.atan2(a.y - fillCy, a.x - fillCx);
            const angleB = Math.atan2(b.y - fillCy, b.x - fillCx);
            return angleA - angleB;
          });

          tempCtx.fillStyle = fill.color || "#000000";
          tempCtx.beginPath();
          allPoints.forEach((p, i) => {
            const px = p.x * scale + offsetX;
            const py = p.y * scale + offsetY;
            if (i === 0) tempCtx.moveTo(px, py);
            else tempCtx.lineTo(px, py);
          });
          tempCtx.closePath();
          tempCtx.fill();
        });
      }

      // Dessiner les géométries
      tempCtx.strokeStyle = "#374151";
      tempCtx.lineWidth = 1.5;

      sketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const line = geo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (p1 && p2) {
            tempCtx.beginPath();
            tempCtx.moveTo(p1.x * scale + offsetX, p1.y * scale + offsetY);
            tempCtx.lineTo(p2.x * scale + offsetX, p2.y * scale + offsetY);
            tempCtx.stroke();
          }
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          const center = sketch.points.get(circle.center);
          if (center) {
            tempCtx.beginPath();
            tempCtx.arc(center.x * scale + offsetX, center.y * scale + offsetY, circle.radius * scale, 0, Math.PI * 2);
            tempCtx.stroke();
          }
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          const center = sketch.points.get(arc.center);
          const startPt = sketch.points.get(arc.startPoint);
          const endPt = sketch.points.get(arc.endPoint);
          if (center && startPt && endPt) {
            const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
            const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);
            tempCtx.beginPath();
            tempCtx.arc(
              center.x * scale + offsetX,
              center.y * scale + offsetY,
              arc.radius * scale,
              startAngle,
              endAngle,
              arc.counterClockwise,
            );
            tempCtx.stroke();
          }
        }
      });

      return tempCanvas.toDataURL("image/png", 0.8);
    } catch (err) {
      console.error("Erreur génération miniature:", err);
      return null;
    }
  }, [sketch]);

  // Charger un template
  const handleLoadTemplate = useCallback(
    (templateSketch: Sketch, mode: "replace" | "merge") => {
      if (mode === "replace") {
        // Remplacer complètement le sketch
        setSketch(templateSketch);
        addToHistory(templateSketch, "Chargement template");
      } else {
        // Déjà mergé par la bibliothèque
        setSketch(templateSketch);
        addToHistory(templateSketch, "Ajout template");
      }
      setSelectedEntities(new Set());
      setTempGeometry(null);
    },
    [addToHistory],
  );

  // Bouton outil
  const ToolButton = ({
    tool,
    icon: Icon,
    label,
    shortcut,
  }: {
    tool: ToolType;
    icon: any;
    label: string;
    shortcut: string;
  }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={activeTool === tool ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setActiveTool(tool);
              setTempPoints([]);
              setTempGeometry(null);
              setFilletFirstLine(null); // Reset fillet/chamfer selection
              // Désactiver le mode marqueur quand on clique sur un outil
              setMarkerMode("idle");
              setPendingLink(null);
            }}
            className="h-9 w-9 p-0"
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {label} ({shortcut})
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // ============================================
  // WRAPPER DE GROUPE POUR MODE ÉDITION (v7.12)
  // Ajoute drag & drop + menu contextuel aux groupes
  // ============================================

  // État pour le drag des groupes
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null);
  // v1.1: Nouveaux états pour drop entre groupes
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [dropTargetLineIndex, setDropTargetLineIndex] = useState<number | null>(null);

  // Gestionnaires de drag pour les groupes
  const handleGroupDragStart = useCallback(
    (e: React.DragEvent, groupId: string, lineIndex: number) => {
      if (!toolbarEditMode) return;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify({ groupId, lineIndex }));
      setDraggedGroupId(groupId);
    },
    [toolbarEditMode],
  );

  // v1.1: Handler pour les zones de drop ENTRE les groupes
  const handleDropZoneDragOver = useCallback(
    (e: React.DragEvent, targetIndex: number, targetLineIndex: number) => {
      if (!toolbarEditMode || !draggedGroupId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTargetIndex(targetIndex);
      setDropTargetLineIndex(targetLineIndex);
    },
    [toolbarEditMode, draggedGroupId],
  );

  const handleDropZoneDragLeave = useCallback(() => {
    setDropTargetIndex(null);
    setDropTargetLineIndex(null);
  }, []);

  const handleGroupDragEnd = useCallback(() => {
    setDraggedGroupId(null);
    setDropTargetGroupId(null);
    setDropTargetIndex(null);
    setDropTargetLineIndex(null);
  }, []);

  // v1.1: Nouveau handler pour drop entre groupes
  const handleDropZoneDrop = useCallback(
    (e: React.DragEvent, targetIndex: number, targetLineIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      const data = e.dataTransfer.getData("text/plain");
      if (!data) {
        handleGroupDragEnd();
        return;
      }

      let sourceGroupId: string;

      try {
        const parsed = JSON.parse(data);
        sourceGroupId = parsed.groupId;
      } catch {
        sourceGroupId = data;
      }

      if (!sourceGroupId) {
        handleGroupDragEnd();
        return;
      }

      // Réorganiser les groupes dans la config
      updateToolbarConfig(
        (() => {
          const newConfig = JSON.parse(JSON.stringify(newToolbarConfig));

          // Trouver et retirer le groupe de sa position actuelle (chercher dans TOUTES les lignes)
          let movedItem: any = null;
          let sourceLineIdx = -1;
          let sourceItemIdx = -1;

          for (let lineIdx = 0; lineIdx < newConfig.lines.length; lineIdx++) {
            const line = newConfig.lines[lineIdx];
            const idx = line.items.findIndex((item: any) => item.id === sourceGroupId);
            if (idx !== -1) {
              sourceLineIdx = lineIdx;
              sourceItemIdx = idx;
              [movedItem] = line.items.splice(idx, 1);
              break;
            }
          }

          if (!movedItem) {
            console.warn("[Drop] Groupe non trouvé:", sourceGroupId);
            return newConfig;
          }

          // Mapper lineIndex JSX vers la vraie ligne dans la config
          // lineIndex 0 = ligne 0 (Fichiers), lineIndex 1 = on fusionne lignes 1-3 (Outils)
          let realTargetLineIdx = targetLineIndex;
          if (targetLineIndex === 1) {
            // Pour lineIndex 1 du JSX, on met tout dans la ligne 1 de la config
            realTargetLineIdx = 1;
          }

          // S'assurer que la ligne cible existe
          while (newConfig.lines.length <= realTargetLineIdx) {
            newConfig.lines.push({
              id: `line_${newConfig.lines.length + 1}`,
              name: `Ligne ${newConfig.lines.length + 1}`,
              items: [],
            });
          }

          const targetLine = newConfig.lines[realTargetLineIdx];

          // Calculer l'index ajusté
          let adjustedIndex = Math.min(targetIndex, targetLine.items.length);

          // Si on déplace dans la même ligne et la source était avant la cible
          if (sourceLineIdx === realTargetLineIdx && sourceItemIdx < targetIndex) {
            adjustedIndex = Math.max(0, adjustedIndex);
          }

          targetLine.items.splice(adjustedIndex, 0, movedItem);

          console.log("[Drop] Groupe déplacé:", sourceGroupId, "vers ligne", realTargetLineIdx, "index", adjustedIndex);

          return newConfig;
        })(),
      );

      handleGroupDragEnd();
      toast.success("Groupe déplacé");
    },
    [newToolbarConfig, updateToolbarConfig, handleGroupDragEnd],
  );

  // v1.1: Composant zone de drop entre les groupes
  // v1.2: Composant zone de drop entre les groupes - toujours visible en mode édition
  const DropZoneBetweenGroups = useCallback(
    ({ targetIndex, lineIndex }: { targetIndex: number; lineIndex: number }) => {
      if (!toolbarEditMode) return null;

      const isActive = draggedGroupId && dropTargetIndex === targetIndex && dropTargetLineIndex === lineIndex;
      const isDragging = !!draggedGroupId;

      return (
        <div
          className={`
            flex items-center justify-center
            transition-all duration-150
            ${
              isDragging
                ? `min-w-[20px] min-h-[40px] mx-1 border-2 border-dashed rounded-md ${
                    isActive
                      ? "border-blue-500 bg-blue-100 min-w-[32px]"
                      : "border-gray-400 bg-gray-100 hover:border-blue-400 hover:bg-blue-50"
                  }`
                : "min-w-[8px] min-h-[40px] mx-0.5 opacity-30 hover:opacity-60"
            }
          `}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDropZoneDragOver(e, targetIndex, lineIndex);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragLeave={handleDropZoneDragLeave}
          onDrop={(e) => handleDropZoneDrop(e, targetIndex, lineIndex)}
        >
          <div
            className={`
            w-1 rounded-full transition-all
            ${isDragging ? `h-6 ${isActive ? "bg-blue-500" : "bg-gray-400"}` : "h-4 bg-gray-300"}
          `}
          />
        </div>
      );
    },
    [
      toolbarEditMode,
      draggedGroupId,
      dropTargetIndex,
      dropTargetLineIndex,
      handleDropZoneDragOver,
      handleDropZoneDragLeave,
      handleDropZoneDrop,
    ],
  );

  // Composant wrapper pour les groupes en mode édition
  // v1.1: Retrait des handlers drop du conteneur - les drops se font sur les DropZoneBetweenGroups
  const ToolbarGroupWrapper = useCallback(
    ({
      groupId,
      groupName,
      groupColor = "#3B82F6",
      lineIndex,
      children,
    }: {
      groupId: string;
      groupName: string;
      groupColor?: string;
      lineIndex: number;
      children: React.ReactNode;
    }) => {
      const isDragging = draggedGroupId === groupId;

      // Trouver le groupe dans la config
      const group = newToolbarConfig.groups.find((g) => g.id === groupId);

      return (
        <div
          className={`
          relative flex items-center gap-1 bg-white rounded-md p-1 shadow-sm transition-all
          ${isDragging ? "opacity-50 scale-95" : ""}
          ${toolbarEditMode ? "cursor-grab active:cursor-grabbing ring-1 ring-gray-200 hover:ring-blue-300" : ""}
        `}
          style={{
            borderLeft: toolbarEditMode ? `3px solid ${groupColor}` : undefined,
          }}
          draggable={toolbarEditMode}
          onDragStart={(e) => handleGroupDragStart(e, groupId, lineIndex)}
          onDragEnd={handleGroupDragEnd}
        >
          {/* Poignée de drag en mode édition */}
          {toolbarEditMode && (
            <div className="flex items-center pr-1 border-r border-gray-200 mr-1">
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
          )}

          {/* Contenu du groupe */}
          {children}

          {/* Menu 3 points en mode édition */}
          {toolbarEditMode && group && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 ml-1 flex-shrink-0">
                  <MoreVertical className="h-4 w-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 flex items-center gap-2 border-b">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: groupColor }} />
                  <span className="font-medium text-sm truncate">{groupName}</span>
                </div>

                <DropdownMenuSeparator />

                {/* Liste des outils du groupe */}
                <div className="px-2 py-1 text-xs text-gray-500">Outils ({group.items.length})</div>
                <div className="max-h-48 overflow-y-auto">
                  {/* MOD: Menu amélioré avec option "Déplacer vers" */}
                  {group.items.map((toolId) => {
                    const def = toolDefinitions.get(toolId);
                    const otherGroups = newToolbarConfig.groups.filter((g) => g.id !== groupId);
                    return (
                      <DropdownMenuSub key={toolId}>
                        <DropdownMenuSubTrigger className="flex items-center gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <span>{def?.label || toolId}</span>
                          </div>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48">
                          {/* Masquer l'outil */}
                          <DropdownMenuItem
                            onClick={() => {
                              updateToolbarConfig({
                                ...newToolbarConfig,
                                groups: newToolbarConfig.groups.map((g) => {
                                  if (g.id !== groupId) return g;
                                  return { ...g, items: g.items.filter((id) => id !== toolId) };
                                }),
                                hidden: [...newToolbarConfig.hidden, toolId],
                              });
                              toast.success(`"${def?.label || toolId}" masqué`);
                            }}
                          >
                            <EyeOff className="h-4 w-4 mr-2" />
                            Masquer
                          </DropdownMenuItem>

                          {otherGroups.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <div className="px-2 py-1 text-xs text-gray-500">Déplacer vers</div>
                              {otherGroups.map((targetGroup) => (
                                <DropdownMenuItem
                                  key={targetGroup.id}
                                  onClick={() => {
                                    updateToolbarConfig({
                                      ...newToolbarConfig,
                                      groups: newToolbarConfig.groups.map((g) => {
                                        if (g.id === groupId) {
                                          return { ...g, items: g.items.filter((id) => id !== toolId) };
                                        }
                                        if (g.id === targetGroup.id) {
                                          return { ...g, items: [...g.items, toolId] };
                                        }
                                        return g;
                                      }),
                                    });
                                    toast.success(`"${def?.label || toolId}" déplacé vers "${targetGroup.name}"`);
                                  }}
                                >
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  {targetGroup.name}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  })}
                </div>

                {/* Outils masqués disponibles */}
                {newToolbarConfig.hidden.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1 text-xs text-gray-500">Ajouter un outil masqué</div>
                    <div className="max-h-32 overflow-y-auto">
                      {newToolbarConfig.hidden.slice(0, 8).map((toolId) => {
                        const def = toolDefinitions.get(toolId);
                        return (
                          <DropdownMenuItem
                            key={toolId}
                            onClick={() => {
                              // Ajouter l'outil au groupe
                              updateToolbarConfig({
                                ...newToolbarConfig,
                                groups: newToolbarConfig.groups.map((g) => {
                                  if (g.id !== groupId) return g;
                                  return { ...g, items: [...g.items, toolId] };
                                }),
                                hidden: newToolbarConfig.hidden.filter((id) => id !== toolId),
                              });
                            }}
                          >
                            <Plus className="h-3 w-3 mr-2" />
                            {def?.label || toolId}
                          </DropdownMenuItem>
                        );
                      })}
                      {newToolbarConfig.hidden.length > 8 && (
                        <div className="px-2 py-1 text-xs text-gray-400">
                          +{newToolbarConfig.hidden.length - 8} autres...
                        </div>
                      )}
                    </div>
                  </>
                )}

                <DropdownMenuSeparator />

                {/* Supprimer le groupe */}
                <DropdownMenuItem
                  onClick={() => {
                    // Déplacer tous les outils vers masqués et supprimer le groupe
                    updateToolbarConfig({
                      ...newToolbarConfig,
                      groups: newToolbarConfig.groups.filter((g) => g.id !== groupId),
                      lines: newToolbarConfig.lines.map((line) => ({
                        ...line,
                        items: line.items.filter((item) => !(item.type === "group" && item.id === groupId)),
                      })),
                      hidden: [...newToolbarConfig.hidden, ...group.items],
                    });
                    toast.success(`Groupe "${groupName}" supprimé`);
                  }}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer le groupe
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      );
    },
    [
      toolbarEditMode,
      draggedGroupId,
      newToolbarConfig,
      toolDefinitions,
      handleGroupDragStart,
      handleGroupDragEnd,
      updateToolbarConfig,
    ],
  );

  // FIX #92: Sauvegarde d'état pour HMR (Hot Module Replacement)
  // Sauvegarde l'état dans window pour le restaurer après un rechargement de module en dev
  useEffect(() => {
    // Sauvegarder l'état toutes les 5 secondes dans window pour HMR
    const saveInterval = setInterval(() => {
      if (sketch.geometries.size > 0 || backgroundImages.length > 0) {
        window.__CAD_HMR_STATE__ = {
          sketch: serializeSketch(sketch),
          backgroundImages: backgroundImages.map((img) => ({
            ...img,
            image: undefined, // On ne peut pas sérialiser HTMLImageElement
            src: img.src || img.image?.src,
          })),
          markerLinks,
          timestamp: Date.now(),
        };
      }
    }, 5000);

    // Au montage, vérifier si on a un état HMR à restaurer
    const hmrState = window.__CAD_HMR_STATE__;
    if (hmrState && Date.now() - hmrState.timestamp < 60000) {
      // Max 1 minute
      console.log("[FIX #92] Restauration état HMR détectée");
      // Ne restaurer que si le sketch actuel est vide
      if (sketch.geometries.size === 0 && backgroundImages.length === 0) {
        console.log("[FIX #92] Restauration de l'état HMR...");
        if (hmrState.sketch) {
          loadSketchData(hmrState.sketch);
        }
        if (hmrState.backgroundImages && hmrState.backgroundImages.length > 0) {
          // Recharger les images avec leurs HTMLImageElement
          Promise.all(
            hmrState.backgroundImages.map(async (imgData: any) => {
              if (!imgData.src) return null;
              try {
                const img = new Image();
                await new Promise((resolve, reject) => {
                  img.onload = resolve;
                  img.onerror = reject;
                  img.src = imgData.src;
                });
                return { ...imgData, image: img };
              } catch {
                return null;
              }
            }),
          ).then((loadedImages) => {
            const validImages = loadedImages.filter(Boolean);
            if (validImages.length > 0) {
              setBackgroundImages(validImages as BackgroundImage[]);
            }
          });
        }
        if (hmrState.markerLinks) {
          setMarkerLinks(hmrState.markerLinks);
        }
        toast.info("État restauré après rechargement du module");
      }
    }

    return () => clearInterval(saveInterval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className={`flex flex-col overflow-hidden ${isFullscreen ? "fixed inset-0 z-50 bg-white" : "h-[700px]"}`}
    >
      {/* Toolbar Ligne 1 - Fichiers */}
      <div className="flex items-center gap-0 p-2 bg-gray-100 border-b flex-shrink-0">
        {/* Zone de drop au début */}
        <DropZoneBetweenGroups targetIndex={0} lineIndex={0} />

        {/* Sauvegarder */}
        {toolbarConfig.line1.save && (
          <>
            <ToolbarGroupWrapper groupId="grp_save" groupName="Sauvegarde" groupColor="#3B82F6" lineIndex={0}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={saveSketch} className="h-9 w-9 p-0">
                      <Save className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sauvegarder (Ctrl+S)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* MOD v7.14: Indicateur Auto-backup Supabase */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      {autoBackupIsRestoring ? (
                        <RefreshCw className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                      ) : autoBackupLastTime ? (
                        <Cloud className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <CloudOff className="h-3.5 w-3.5 text-gray-400" />
                      )}
                      {autoBackupFormatted && <span className="text-[10px] text-gray-500">{autoBackupFormatted}</span>}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <p className="font-medium">Auto-backup Supabase</p>
                      {autoBackupIsRestoring ? (
                        <p className="text-amber-500">Restauration en cours...</p>
                      ) : autoBackupLastTime ? (
                        <>
                          <p className="text-green-500">Dernière sauvegarde: {autoBackupFormatted}</p>
                          <p className="text-gray-400">{autoBackupCount} backups cette session</p>
                        </>
                      ) : (
                        <p className="text-gray-400">En attente de contenu...</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Bouton restauration manuelle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => autoBackupRestore(true)}
                      disabled={autoBackupIsRestoring || !autoBackupLastTime}
                      className="h-7 w-7 p-0"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${autoBackupIsRestoring ? "animate-spin" : ""}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Restaurer dernière sauvegarde</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Separator orientation="vertical" className="h-6 mx-1" />

              {/* v7.37: Sauvegarde locale (fichier JSON) */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveLocalBackup}
                      className="h-9 w-9 p-0 border-green-300 hover:bg-green-50"
                    >
                      <Download className="h-4 w-4 text-green-600" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Télécharger sauvegarde locale (avec photos)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* v7.37: Charger sauvegarde locale */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label className="cursor-pointer">
                      <input type="file" accept=".json" onChange={loadLocalBackup} className="hidden" />
                      <div className="h-9 w-9 p-0 border rounded-md flex items-center justify-center border-blue-300 hover:bg-blue-50 transition-colors">
                        <Upload className="h-4 w-4 text-blue-600" />
                      </div>
                    </label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Charger sauvegarde locale</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </ToolbarGroupWrapper>
            <DropZoneBetweenGroups targetIndex={1} lineIndex={0} />
          </>
        )}

        {toolbarConfig.line1.save && !toolbarEditMode && <Separator orientation="vertical" className="h-6" />}

        {/* Import/Export fichiers */}
        <ToolbarGroupWrapper groupId="grp_import_export" groupName="Import/Export" groupColor="#10B981" lineIndex={0}>
          {/* v7.21: Import unifié - un seul bouton qui ouvre l'explorateur (DXF + images) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-2 relative"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp className="h-4 w-4 mr-1" />
                  <span className="text-xs">Importer</span>
                  {backgroundImages.length > 0 && (
                    <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-xs">
                      {backgroundImages.length}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Importer fichiers (DXF, images)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* v7.20: Export unifié - un seul bouton avec menu déroulant */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="h-9 px-2">
                <Download className="h-4 w-4 mr-1" />
                <span className="text-xs">Exporter</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {/* DXF - Format CAO */}
              <DropdownMenuItem onClick={handleExportDXF}>
                <Download className="h-4 w-4 mr-2" />
                DXF (CAO/CNC)
              </DropdownMenuItem>

              {/* PDF Professionnel */}
              <DropdownMenuItem onClick={() => setPdfPlanEditorOpen(true)}>
                <FileDown className="h-4 w-4 mr-2 text-red-500" />
                PDF (plans)
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* SVG */}
              <DropdownMenuItem onClick={handleExportSVG}>
                <FileDown className="h-4 w-4 mr-2" />
                SVG (vectoriel)
              </DropdownMenuItem>

              {/* PNG options */}
              <DropdownMenuItem onClick={() => handleExportPNG(false)}>
                <FileImage className="h-4 w-4 mr-2" />
                PNG (fond blanc)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportPNG(true)}>
                <FileImage className="h-4 w-4 mr-2 opacity-50" />
                PNG (transparent)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* MOD v80.14: Bouton impression directe avec duplication */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setShowPrintDialog(true)} className="h-9 w-9 p-0">
                  <Printer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Imprimer</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Bibliothèque de templates */}
          {toolbarConfig.line1.templates && (
            <Button variant="outline" size="sm" onClick={() => setShowTemplateLibrary(true)} className="h-9 px-2">
              <Library className="h-4 w-4 mr-1" />
              <span className="text-xs">Templates</span>
            </Button>
          )}
        </ToolbarGroupWrapper>

        {/* Zone de drop après Import/Export */}
        <DropZoneBetweenGroups targetIndex={2} lineIndex={0} />

        {/* Bouton raccourcis clavier */}
        {toolbarConfig.line1.help && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setShowShortcutsPanel(true)} className="h-9 w-9 p-0">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Raccourcis clavier</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="flex-1" />

        {/* Status */}
        <Badge
          variant={
            sketch.status === "fully-constrained"
              ? "default"
              : sketch.status === "under-constrained"
                ? "secondary"
                : "destructive"
          }
        >
          {sketch.status === "fully-constrained" && "✓ Contraint"}
          {sketch.status === "under-constrained" && `DOF: ${sketch.dof}`}
          {sketch.status === "over-constrained" && "⚠ Sur-contraint"}
          {sketch.status === "conflicting" && "✕ Conflit"}
        </Badge>

        <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>

        {/* Bouton configuration toolbar (mode édition inline) */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={toolbarEditMode ? "default" : "ghost"}
                size="sm"
                className={`h-9 w-9 p-0 ${toolbarEditMode ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                onClick={() => setToolbarEditMode(!toolbarEditMode)}
              >
                <Settings
                  className={`h-4 w-4 ${toolbarEditMode ? "animate-spin" : ""}`}
                  style={{ animationDuration: toolbarEditMode ? "3s" : "0s" }}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{toolbarEditMode ? "Quitter le mode édition" : "Éditer la toolbar (drag & drop)"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Bandeau mode édition */}
      {toolbarEditMode && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 border-b border-blue-300 text-blue-800 text-sm">
          <Settings className="h-4 w-4" />
          <span className="font-medium">Mode édition</span>
          <span className="text-blue-600">
            — Glissez les groupes pour les réorganiser, cliquez sur ⋮ pour gérer les outils
          </span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-white"
            onClick={() => setToolbarEditorOpen(true)}
          >
            Éditeur avancé
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={() => setToolbarEditMode(false)}>
            Terminer
          </Button>
        </div>
      )}

      {/* Toolbar Ligne 2 - Outils */}
      <div className="flex items-center gap-0 p-2 bg-gray-100 border-b flex-wrap flex-shrink-0">
        {/* Zone de drop au début */}
        <DropZoneBetweenGroups targetIndex={0} lineIndex={1} />

        {/* Outils de sélection/navigation */}
        {toolbarConfig.line2.selectPan && (
          <>
            <ToolbarGroupWrapper groupId="grp_select" groupName="Sélection" groupColor="#3B82F6" lineIndex={1}>
              <ToolButton tool="select" icon={MousePointer} label="Sélection" shortcut="V" />
              <ToolButton tool="pan" icon={Hand} label="Déplacer" shortcut="H" />
            </ToolbarGroupWrapper>
            <DropZoneBetweenGroups targetIndex={1} lineIndex={1} />
            {!toolbarEditMode && <Separator orientation="vertical" className="h-6" />}
          </>
        )}

        {/* Outil Symétrie + Transformation */}
        {toolbarConfig.line2.transform && (
          <>
            <ToolbarGroupWrapper groupId="grp_transform" groupName="Transformation" groupColor="#F59E0B" lineIndex={1}>
              <ToolButton tool="mirror" icon={FlipHorizontal2} label="Symétrie" shortcut="S" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showTransformGizmo ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (!showTransformGizmo) {
                          setActiveTool("select");
                          setMarkerMode("idle");
                        }
                        setShowTransformGizmo(!showTransformGizmo);
                      }}
                      className={`h-9 w-9 p-0 ${showTransformGizmo ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
                    >
                      <Move className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Déplacer / Rotation (T)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </ToolbarGroupWrapper>
          </>
        )}

        <DropZoneBetweenGroups targetIndex={2} lineIndex={1} />

        {/* Outils de dessin */}
        {toolbarConfig.line2.drawBasic && (
          <ToolbarGroupWrapper groupId="grp_draw" groupName="Dessin" groupColor="#10B981" lineIndex={1}>
            <ToolButton tool="line" icon={Minus} label="Ligne" shortcut="L" />
            <ToolButton tool="circle" icon={Circle} label="Cercle" shortcut="C" />
            <ToolButton tool="arc3points" icon={CircleDot} label="Arc 3 points" shortcut="A" />

            {/* Rectangle avec dropdown pour le mode */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={activeTool === "rectangle" ? "default" : "outline"}
                  size="sm"
                  className="h-9 w-9 p-0 relative"
                >
                  <Square className="h-4 w-4" />
                  {rectangleMode === "center" && (
                    <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    setRectangleMode("corner");
                    setActiveTool("rectangle");
                    setTempPoints([]);
                    setTempGeometry(null);
                    setMarkerMode("idle");
                  }}
                  className="flex items-center gap-2"
                >
                  <Square className="h-4 w-4" />
                  <span>Depuis le coin</span>
                  {rectangleMode === "corner" && <Check className="h-4 w-4 ml-auto text-green-600" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setRectangleMode("center");
                    setActiveTool("rectangle");
                    setTempPoints([]);
                    setTempGeometry(null);
                    setMarkerMode("idle");
                  }}
                  className="flex items-center gap-2"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="14" rx="1" />
                    <circle cx="12" cy="12" r="2" fill="currentColor" />
                  </svg>
                  <span>Depuis le centre</span>
                  {rectangleMode === "center" && <Check className="h-4 w-4 ml-auto text-green-600" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ToolButton tool="bezier" icon={Spline} label="Courbe Bézier" shortcut="B" />

            {/* Outil Spline (courbe libre) */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTool === "spline" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setActiveTool("spline");
                      setTempPoints([]);
                      setTempGeometry(null);
                      setFilletFirstLine(null);
                    }}
                    className="h-9 w-9 p-0"
                  >
                    {/* Icône spline: courbe passant par plusieurs points */}
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M4 18 Q 8 6, 12 12 T 20 6" />
                      <circle cx="4" cy="18" r="1.5" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="20" cy="6" r="1.5" fill="currentColor" />
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Spline (S) - Double-clic pour terminer</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Outil Polygone régulier */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTool === "polygon" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setActiveTool("polygon");
                      setTempPoints([]);
                      setTempGeometry(null);
                      setFilletFirstLine(null);
                    }}
                    className="h-9 w-9 p-0"
                  >
                    {/* Icône polygone: hexagone */}
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" />
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Polygone régulier (P) - {polygonSides} côtés</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-9 w-5 p-0 ${activeTool === "polygon" ? "bg-emerald-100" : ""}`}
                  title="Nombre de côtés"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 p-2">
                <div className="space-y-2">
                  <Label className="text-xs">Nombre de côtés:</Label>
                  <div className="flex gap-1 flex-wrap">
                    {[3, 4, 5, 6, 8, 10, 12].map((n) => (
                      <Button
                        key={n}
                        variant={polygonSides === n ? "default" : "outline"}
                        size="sm"
                        className="h-7 w-8 p-0 text-xs"
                        onClick={() => {
                          setPolygonSides(n);
                          setActiveTool("polygon");
                        }}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      type="number"
                      min={3}
                      max={100}
                      value={polygonSides}
                      onChange={(e) => {
                        const n = Math.max(3, Math.min(100, parseInt(e.target.value) || 6));
                        setPolygonSides(n);
                      }}
                      className="h-7 w-14 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">côtés</span>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Outil Texte avec paramètres */}
            <ToolButton tool="text" icon={Type} label="Texte / Annotation" shortcut="Shift+T" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-9 w-5 p-0 ${activeTool === "text" ? "bg-emerald-100" : ""}`}
                  title="Paramètres texte"
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 p-2">
                <div className="space-y-2">
                  {/* Taille */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-14">Taille:</Label>
                    <Input
                      type="number"
                      value={textFontSize}
                      onChange={(e) => {
                        const newSize = Math.max(1, parseFloat(e.target.value) || 5);
                        setTextFontSize(newSize);
                        // Appliquer aux textes sélectionnés
                        const selectedTexts = Array.from(selectedEntities).filter((id) => {
                          const geo = sketch.geometries.get(id);
                          return geo?.type === "text";
                        });
                        if (selectedTexts.length > 0) {
                          const newGeometries = new Map(sketch.geometries);
                          selectedTexts.forEach((id) => {
                            const geo = newGeometries.get(id) as TextAnnotation;
                            if (geo) {
                              newGeometries.set(id, { ...geo, fontSize: newSize });
                            }
                          });
                          const newSketch = { ...sketch, geometries: newGeometries };
                          setSketch(newSketch);
                          addToHistory(newSketch, `Taille texte → ${newSize}mm`);
                        }
                      }}
                      className="h-7 w-16 text-xs"
                      min="1"
                      max="100"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <span className="text-xs text-gray-500">mm</span>
                  </div>

                  {/* Couleur */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-14">Couleur:</Label>
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => {
                        const newColor = e.target.value;
                        setTextColor(newColor);
                        // Appliquer aux textes sélectionnés
                        const selectedTexts = Array.from(selectedEntities).filter((id) => {
                          const geo = sketch.geometries.get(id);
                          return geo?.type === "text";
                        });
                        if (selectedTexts.length > 0) {
                          const newGeometries = new Map(sketch.geometries);
                          selectedTexts.forEach((id) => {
                            const geo = newGeometries.get(id) as TextAnnotation;
                            if (geo) {
                              newGeometries.set(id, { ...geo, color: newColor });
                            }
                          });
                          const newSketch = { ...sketch, geometries: newGeometries };
                          setSketch(newSketch);
                          addToHistory(newSketch, `Couleur texte → ${newColor}`);
                        }
                      }}
                      className="h-7 w-8 cursor-pointer rounded border"
                    />
                    <span className="text-[10px] text-gray-500 font-mono">{textColor}</span>
                  </div>

                  {/* Alignement */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-14">Align:</Label>
                    <div className="flex gap-0.5">
                      <Button
                        variant={textAlignment === "left" ? "default" : "outline"}
                        size="sm"
                        className="h-6 w-6 p-0 text-xs"
                        onClick={() => {
                          setTextAlignment("left");
                          // Appliquer aux textes sélectionnés
                          const selectedTexts = Array.from(selectedEntities).filter((id) => {
                            const geo = sketch.geometries.get(id);
                            return geo?.type === "text";
                          });
                          if (selectedTexts.length > 0) {
                            const newGeometries = new Map(sketch.geometries);
                            selectedTexts.forEach((id) => {
                              const geo = newGeometries.get(id) as TextAnnotation;
                              if (geo) {
                                newGeometries.set(id, { ...geo, alignment: "left" });
                              }
                            });
                            const newSketch = { ...sketch, geometries: newGeometries };
                            setSketch(newSketch);
                            addToHistory(newSketch, "Alignement texte → gauche");
                          }
                        }}
                      >
                        ←
                      </Button>
                      <Button
                        variant={textAlignment === "center" ? "default" : "outline"}
                        size="sm"
                        className="h-6 w-6 p-0 text-xs"
                        onClick={() => {
                          setTextAlignment("center");
                          // Appliquer aux textes sélectionnés
                          const selectedTexts = Array.from(selectedEntities).filter((id) => {
                            const geo = sketch.geometries.get(id);
                            return geo?.type === "text";
                          });
                          if (selectedTexts.length > 0) {
                            const newGeometries = new Map(sketch.geometries);
                            selectedTexts.forEach((id) => {
                              const geo = newGeometries.get(id) as TextAnnotation;
                              if (geo) {
                                newGeometries.set(id, { ...geo, alignment: "center" });
                              }
                            });
                            const newSketch = { ...sketch, geometries: newGeometries };
                            setSketch(newSketch);
                            addToHistory(newSketch, "Alignement texte → centré");
                          }
                        }}
                      >
                        ↔
                      </Button>
                      <Button
                        variant={textAlignment === "right" ? "default" : "outline"}
                        size="sm"
                        className="h-6 w-6 p-0 text-xs"
                        onClick={() => {
                          setTextAlignment("right");
                          // Appliquer aux textes sélectionnés
                          const selectedTexts = Array.from(selectedEntities).filter((id) => {
                            const geo = sketch.geometries.get(id);
                            return geo?.type === "text";
                          });
                          if (selectedTexts.length > 0) {
                            const newGeometries = new Map(sketch.geometries);
                            selectedTexts.forEach((id) => {
                              const geo = newGeometries.get(id) as TextAnnotation;
                              if (geo) {
                                newGeometries.set(id, { ...geo, alignment: "right" });
                              }
                            });
                            const newSketch = { ...sketch, geometries: newGeometries };
                            setSketch(newSketch);
                            addToHistory(newSketch, "Alignement texte → droite");
                          }
                        }}
                      >
                        →
                      </Button>
                    </div>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </ToolbarGroupWrapper>
        )}

        <DropZoneBetweenGroups targetIndex={3} lineIndex={1} />

        <Separator orientation="vertical" className="h-6" />

        {/* Inputs cachés pour import de fichiers */}
        <input ref={dxfInputRef} type="file" accept=".dxf" onChange={handleDXFImport} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* v7.32: Outils photos - TOUJOURS VISIBLE avec bouton charger + menu outils si photos */}
        {toolbarConfig.line2.photoTools && (
          <ToolbarGroupWrapper groupId="grp_photo" groupName="Photos" groupColor="#EC4899" lineIndex={1}>
            {/* Bouton charger photo - toujours visible */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 px-2 relative"
                  >
                    <Image className="h-4 w-4 mr-1" />
                    <span className="text-xs">Photo</span>
                    {backgroundImages.length > 0 && (
                      <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-xs">
                        {backgroundImages.length}
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Charger une photo de référence</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Toggle afficher/masquer - seulement si photos chargées */}
            {backgroundImages.length > 0 && (
              <Button
                variant={showBackgroundImage ? "default" : "outline"}
                size="sm"
                onClick={() => setShowBackgroundImage(!showBackgroundImage)}
                className="h-9 w-9 p-0"
                title={showBackgroundImage ? "Masquer photos" : "Afficher photos"}
              >
                {showBackgroundImage ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            )}

            {/* Menu déroulant avec tous les outils photos - seulement si photos chargées */}
            {backgroundImages.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 px-2 relative">
                    <Settings className="h-4 w-4 mr-1" />
                    <span className="text-xs">Outils</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                    {selectedImageId && <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {/* Opacité - photo(s) sélectionnée(s) ou globale */}
                  <div className="px-2 py-2">
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {selectedImageId || selectedImageIds.size > 0
                        ? `Opacité ${selectedImageIds.size > 1 ? `(${selectedImageIds.size} photos)` : "photo"}: ${Math.round(
                            (selectedImageId
                              ? (backgroundImages.find((img) => img.id === selectedImageId)?.opacity ?? imageOpacity)
                              : (backgroundImages.find((img) => selectedImageIds.has(img.id))?.opacity ??
                                imageOpacity)) * 100,
                          )}%`
                        : `Opacité (par défaut): ${Math.round(imageOpacity * 100)}%`}
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={
                        selectedImageId
                          ? (backgroundImages.find((img) => img.id === selectedImageId)?.opacity ?? imageOpacity)
                          : selectedImageIds.size > 0
                            ? (backgroundImages.find((img) => selectedImageIds.has(img.id))?.opacity ?? imageOpacity)
                            : imageOpacity
                      }
                      onChange={(e) => {
                        const newOpacity = parseFloat(e.target.value);
                        if (selectedImageId || selectedImageIds.size > 0) {
                          // FIX: Appliquer uniquement aux photos sélectionnées
                          const idsToUpdate = selectedImageId
                            ? new Set([selectedImageId, ...selectedImageIds])
                            : selectedImageIds;
                          setBackgroundImages((prev) =>
                            prev.map((img) => (idsToUpdate.has(img.id) ? { ...img, opacity: newOpacity } : img)),
                          );
                        } else {
                          // Aucune sélection: changer l'opacité par défaut pour les nouvelles images
                          setImageOpacity(newOpacity);
                        }
                      }}
                      className="w-full h-2"
                    />
                  </div>

                  <DropdownMenuSeparator />

                  {/* Rotation (si image sélectionnée) */}
                  {(selectedImageId || selectedImageIds.size > 0) && (
                    <>
                      <div className="px-2 py-2">
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Rotation {selectedImageIds.size > 0 && `(${selectedImageIds.size} photos)`}
                        </label>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => updateSelectedImageRotation(getSelectedImageRotation() - 90)}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-1"
                            onClick={() => updateSelectedImageRotation(getSelectedImageRotation() - 1)}
                          >
                            <span className="text-xs">-1°</span>
                          </Button>
                          <input
                            type="number"
                            value={Math.round(getSelectedImageRotation() * 10) / 10}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) updateSelectedImageRotation(val);
                            }}
                            className="h-7 w-12 text-xs text-center border rounded"
                            step="0.1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-1"
                            onClick={() => updateSelectedImageRotation(getSelectedImageRotation() + 1)}
                          >
                            <span className="text-xs">+1°</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => updateSelectedImageRotation(getSelectedImageRotation() + 90)}
                          >
                            <RotateCw className="h-3 w-3" />
                          </Button>
                          {getSelectedImageRotation() !== 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500"
                              onClick={() => updateSelectedImageRotation(0)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {/* Actions sur image sélectionnée */}
                  <DropdownMenuItem
                    onClick={() => {
                      if (!selectedImageId) {
                        toast.error("Sélectionnez d'abord une photo");
                        return;
                      }
                      setShowAdjustmentsDialog(true);
                    }}
                    disabled={!selectedImageId}
                  >
                    <Contrast className="h-4 w-4 mr-2" />
                    Ajuster les contours
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      if (!selectedImageId) {
                        toast.error("Sélectionnez d'abord une photo");
                        return;
                      }
                      openCropDialog();
                    }}
                    disabled={!selectedImageId}
                  >
                    <Crop className="h-4 w-4 mr-2" />
                    Recadrer
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      if (!showCalibrationPanel && backgroundImages.length > 0 && !selectedImageId) {
                        toast.error("Sélectionnez d'abord une photo à calibrer");
                        return;
                      }
                      setShowCalibrationPanel(!showCalibrationPanel);
                    }}
                  >
                    <Ruler className="h-4 w-4 mr-2" />
                    Calibration
                    {showCalibrationPanel && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Marqueurs */}
                  <DropdownMenuItem
                    onClick={() => {
                      if (markerMode === "addMarker") {
                        setMarkerMode("idle");
                      } else {
                        setMarkerMode("addMarker");
                        toast.info("Cliquez sur une photo pour ajouter un marqueur");
                      }
                    }}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Ajouter un marqueur
                    {markerMode === "addMarker" && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      if (markerMode === "linkMarker1" || markerMode === "linkMarker2") {
                        setMarkerMode("idle");
                        setPendingLink(null);
                      } else {
                        const imagesWithMarkers = backgroundImages.filter((img) => img.markers.length > 0);
                        if (imagesWithMarkers.length < 2) {
                          toast.error("Ajoutez au moins 1 marqueur sur 2 photos différentes");
                          return;
                        }
                        setMarkerMode("linkMarker1");
                        toast.info("Cliquez sur le premier marqueur");
                      }
                    }}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Lier deux marqueurs
                    {(markerMode === "linkMarker1" || markerMode === "linkMarker2") && (
                      <Check className="h-4 w-4 ml-auto" />
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* v7.34: Générer équerre de calibration */}
                  <DropdownMenuItem onClick={() => setShowCalibrationRulerGenerator(true)}>
                    <Ruler className="h-4 w-4 mr-2" />
                    Générer équerre de calibration
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Détacher le menu en modale flottante */}
                  <DropdownMenuItem
                    onClick={() => {
                      setImageToolsModalPos({ x: 100, y: 100 });
                      setShowImageToolsModal(true);
                    }}
                    className="text-blue-600 focus:text-blue-600"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Détacher le menu
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Supprimer */}
                  <DropdownMenuItem
                    onClick={() => {
                      addToImageHistory(backgroundImages, markerLinks);
                      setBackgroundImages([]);
                      setMarkerLinks([]);
                      setSelectedImageId(null);
                      setSelectedMarkerId(null);
                      toast.success("Toutes les photos supprimées");
                    }}
                    className="text-red-500 focus:text-red-500"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer toutes les photos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </ToolbarGroupWrapper>
        )}

        <DropZoneBetweenGroups targetIndex={4} lineIndex={1} />

        <Separator orientation="vertical" className="h-6" />

        {/* Cotations et contraintes */}
        <ToolbarGroupWrapper groupId="grp_dimension" groupName="Cotations" groupColor="#06B6D4" lineIndex={1}>
          {/* Cotation avec icône personnalisée */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activeTool === "dimension" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setActiveTool("dimension");
                    setTempPoints([]);
                    setTempGeometry(null);
                    setFilletFirstLine(null);
                  }}
                  className="h-9 w-9 p-0"
                >
                  {/* Icône cotation: trait horizontal avec traits verticaux aux extrémités */}
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <line x1="4" y1="8" x2="4" y2="16" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="20" y1="8" x2="20" y2="16" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Cotation (D)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* MOD v7.16: Outil mesure avec bouton historique intégré */}
          <div className="flex items-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTool === "measure" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setActiveTool("measure");
                      setTempPoints([]);
                      setTempGeometry(null);
                      setFilletFirstLine(null);
                      setMarkerMode("idle");
                      setPendingLink(null);
                      // Ouvrir automatiquement le panneau de mesure
                      setShowMeasurePanel(true);
                    }}
                    className="h-9 w-9 p-0 rounded-r-none border-r-0"
                  >
                    <Ruler className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Mesurer (M)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {/* Bouton historique des mesures */}
            <Button
              variant={showMeasurePanel ? "default" : "outline"}
              size="sm"
              onClick={() => setShowMeasurePanel(!showMeasurePanel)}
              className="h-9 px-1.5 rounded-l-none"
              title="Historique des mesures"
            >
              <span className="text-xs font-medium">{measurements.length > 0 ? measurements.length : "∅"}</span>
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-2">
                <Link className="h-4 w-4 mr-1" />
                <span className="text-xs">Contraintes</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 1) {
                    const id = Array.from(selectedEntities)[0];
                    if (sketch.geometries.has(id)) {
                      addConstraint("horizontal", [id]);
                    }
                  }
                }}
              >
                ─ Horizontal
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 1) {
                    const id = Array.from(selectedEntities)[0];
                    if (sketch.geometries.has(id)) {
                      addConstraint("vertical", [id]);
                    }
                  }
                }}
              >
                │ Vertical
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 2) {
                    addConstraint("perpendicular", Array.from(selectedEntities));
                  }
                }}
              >
                ⊥ Perpendiculaire
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 2) {
                    addConstraint("parallel", Array.from(selectedEntities));
                  }
                }}
              >
                ∥ Parallèle
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 2) {
                    addConstraint("equal", Array.from(selectedEntities));
                  }
                }}
              >
                = Égal
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 2) {
                    addConstraint("coincident", Array.from(selectedEntities));
                  }
                }}
              >
                ● Coïncident
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 1) {
                    addConstraint("fixed", Array.from(selectedEntities));
                  }
                }}
              >
                ⚓ Fixe
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 2) {
                    openAngleConstraintDialog();
                  }
                }}
              >
                ∠ Angle entre 2 lignes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 2) {
                    applyTangentConstraint();
                  } else {
                    toast.error("Sélectionnez une ligne et un cercle/arc");
                  }
                }}
              >
                ○ Tangent (ligne + cercle)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Grouper / Dégrouper */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={handleGroupSelection}
                  disabled={selectedEntities.size < 2}
                >
                  <Group className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Grouper (Ctrl+G)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={handleUngroupSelection}
                  disabled={selectedEntities.size === 0}
                >
                  <Ungroup className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Dégrouper (Ctrl+Shift+G)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Répétition / Array */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => openArrayDialog()}>
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Répétition / Array</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </ToolbarGroupWrapper>

        <DropZoneBetweenGroups targetIndex={5} lineIndex={1} />

        <Separator orientation="vertical" className="h-6" />

        {/* v7.32: Modifications regroupées - Congé/Chanfrein dans un dropdown + Offset */}
        <ToolbarGroupWrapper groupId="grp_modify" groupName="Modifications" groupColor="#EF4444" lineIndex={1}>
          {/* Menu déroulant Congé/Chanfrein */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-2">
                {/* Icône combinée congé/chanfrein */}
                <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 20 L4 12 Q4 4 12 4 L20 4" strokeLinecap="round" />
                </svg>
                <span className="text-xs">
                  R{filletRadius}/{chamferDistance}
                </span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {/* Congé */}
              <DropdownMenuItem onClick={openFilletDialog}>
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 20 L4 12 Q4 4 12 4 L20 4" strokeLinecap="round" />
                </svg>
                Congé (R{filletRadius})
              </DropdownMenuItem>

              {/* Chanfrein */}
              <DropdownMenuItem onClick={openChamferDialog}>
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 20 L4 10 L10 4 L20 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Chanfrein ({chamferDistance})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Bouton paramètres unique pour Congé ET Chanfrein */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-6 p-0">
                <Settings className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <div className="p-2 space-y-3">
                <div>
                  <Label className="text-xs font-medium">Rayon congé (mm)</Label>
                  <Input
                    type="number"
                    value={filletRadius}
                    onChange={(e) => setFilletRadius(Math.max(1, parseFloat(e.target.value) || 1))}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full h-7 mt-1"
                    min="1"
                    step="1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Distance chanfrein (mm)</Label>
                  <Input
                    type="number"
                    value={chamferDistance}
                    onChange={(e) => setChamferDistance(Math.max(1, parseFloat(e.target.value) || 1))}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full h-7 mt-1"
                    min="1"
                    step="1"
                  />
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Offset */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={offsetDialog?.open ? "default" : "outline"}
                  size="sm"
                  className="h-9 px-2"
                  onClick={openOffsetDialog}
                >
                  {/* Icône offset: deux rectangles décalés */}
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="12" height="12" rx="1" />
                    <rect x="9" y="9" width="12" height="12" rx="1" strokeDasharray="3 2" />
                  </svg>
                  <span className="text-xs">{offsetDistance}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Offset - Copie parallèle à distance</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Épaisseur de trait */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 px-2 gap-1">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={defaultStrokeWidth * 1.5}
                        >
                          <line x1="4" y1="12" x2="20" y2="12" />
                        </svg>
                        <span className="text-xs">{defaultStrokeWidth}</span>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <div className="p-1">
                        <div className="text-xs text-gray-500 px-2 py-1 mb-1">Épaisseur du trait</div>
                        {STROKE_WIDTH_OPTIONS.map((width) => (
                          <DropdownMenuItem
                            key={width}
                            onClick={() => {
                              console.log("[CAD] StrokeWidth dropdown clicked:", width);
                              setDefaultStrokeWidth(width);
                              defaultStrokeWidthRef.current = width; // Mettre à jour la ref immédiatement
                              console.log("[CAD] defaultStrokeWidthRef.current now:", defaultStrokeWidthRef.current);
                              // Si des figures sont sélectionnées, les mettre à jour
                              if (selectedEntities.size > 0) {
                                console.log("[CAD] Updating selected entities:", Array.from(selectedEntities));
                                const currentSketch = sketchRef.current;
                                const newGeometries = new Map(currentSketch.geometries);
                                selectedEntities.forEach((id) => {
                                  const geo = newGeometries.get(id);
                                  // Ne pas appliquer strokeWidth aux textes
                                  if (geo && geo.type !== "text") {
                                    console.log("[CAD] Updating geo", id.slice(0, 8), "strokeWidth to", width);
                                    newGeometries.set(id, { ...geo, strokeWidth: width } as typeof geo);
                                  }
                                });
                                const newSketch = { ...currentSketch, geometries: newGeometries };
                                setSketch(newSketch);
                                addToHistory(newSketch, `Épaisseur → ${width}px`);
                                // DEBUG: Vérifier les strokeWidth après mise à jour
                                console.log("[CAD] After update - checking strokeWidths:");
                                newGeometries.forEach((geo, id) => {
                                  if ((geo as any).strokeWidth !== undefined) {
                                    console.log(
                                      `  Geo ${id.slice(0, 8)} type=${geo.type} strokeWidth=${(geo as any).strokeWidth}`,
                                    );
                                  }
                                });
                              }
                            }}
                            className="flex items-center gap-2"
                          >
                            <svg className="w-8 h-4" viewBox="0 0 32 16">
                              <line x1="2" y1="8" x2="30" y2="8" stroke="currentColor" strokeWidth={width * 2} />
                            </svg>
                            <span className={`text-sm ${defaultStrokeWidth === width ? "font-bold" : ""}`}>
                              {width}px
                            </span>
                            {defaultStrokeWidth === width && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Épaisseur du trait {selectedEntities.size > 0 ? "(modifie la sélection)" : "(pour nouvelles figures)"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Couleur du trait */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <input
                    type="color"
                    value={defaultStrokeColor}
                    onChange={(e) => {
                      const newColor = e.target.value;
                      setDefaultStrokeColor(newColor);
                      // Si des figures sont sélectionnées, les mettre à jour
                      if (selectedEntities.size > 0) {
                        const currentSketch = sketchRef.current;
                        const newGeometries = new Map(currentSketch.geometries);
                        selectedEntities.forEach((id) => {
                          const geo = newGeometries.get(id);
                          if (geo) {
                            // Pour les textes, utiliser 'color', pour les autres 'strokeColor'
                            if (geo.type === "text") {
                              newGeometries.set(id, { ...geo, color: newColor } as typeof geo);
                            } else {
                              newGeometries.set(id, { ...geo, strokeColor: newColor } as typeof geo);
                            }
                          }
                        });
                        const newSketch = { ...currentSketch, geometries: newGeometries };
                        setSketch(newSketch);
                        addToHistory(newSketch, `Couleur → ${newColor}`);
                      }
                    }}
                    className="w-9 h-9 p-1 rounded border border-gray-300 cursor-pointer"
                    title="Couleur du trait"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Couleur du trait {selectedEntities.size > 0 ? "(modifie la sélection)" : "(pour nouvelles figures)"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </ToolbarGroupWrapper>

        <DropZoneBetweenGroups targetIndex={6} lineIndex={1} />

        <Separator orientation="vertical" className="h-6" />
        <ToolbarGroupWrapper groupId="grp_view" groupName="Vue" groupColor="#8B5CF6" lineIndex={1}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewport((v) => ({ ...v, scale: v.scale * 0.8 }))}
            className="h-8 w-8 p-0"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono w-14 text-center" title={`1mm = ${viewport.scale.toFixed(1)}px`}>
            {viewport.scale >= 10 ? `${Math.round(viewport.scale)}x` : `${viewport.scale.toFixed(1)}x`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewport((v) => ({ ...v, scale: v.scale * 1.2 }))}
            className="h-8 w-8 p-0"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={fitToContent} title="Ajuster au contenu" className="h-8 w-8 p-0">
            <Scan className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetView} title="Reset vue">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </ToolbarGroupWrapper>

        <DropZoneBetweenGroups targetIndex={7} lineIndex={1} />

        <Separator orientation="vertical" className="h-6" />

        {/* Undo/Redo + Dropdown Historique */}
        <ToolbarGroupWrapper groupId="grp_history" groupName="Historique" groupColor="#F59E0B" lineIndex={1}>
          <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0} className="h-8 w-8 p-0">
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="h-8 w-8 p-0"
          >
            <Redo className="h-4 w-4" />
          </Button>

          {/* Sélecteur de branche active + Nouvelle branche */}
          <div className="flex items-center gap-0.5 ml-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2 gap-1.5" title="Branche active">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: branches.find((b) => b.id === activeBranchId)?.color || "#3B82F6" }}
                  />
                  <span className="text-xs font-medium max-w-[100px] truncate">
                    {branches.find((b) => b.id === activeBranchId)?.name || "Principal"}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  Branches ({branches.length}/10)
                </div>
                <DropdownMenuSeparator />
                {branches.map((branch, index) => (
                  <DropdownMenuItem key={branch.id} onClick={() => setActiveBranchId(branch.id)} className="gap-2 pr-1">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: branch.color }} />
                    <span className="truncate flex-1">{branch.name}</span>
                    {branch.id === activeBranchId && <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />}
                    {/* Bouton supprimer - pas sur la branche Principal (index 0) */}
                    {index > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 ml-1 hover:bg-red-100 hover:text-red-600 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Si on supprime la branche active, basculer sur Principal
                          if (branch.id === activeBranchId) {
                            setActiveBranchId(branches[0].id);
                          }
                          setBranches((prev) => prev.filter((b) => b.id !== branch.id));
                          toast.success(`Branche "${branch.name}" supprimée`);
                        }}
                        title={`Supprimer "${branch.name}"`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => createBranchFromHistoryIndex(historyIndex)}
                    disabled={branches.length >= 10}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Nouvelle branche ({branches.length}/10)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Dropdown Historique & Branches */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={showHistoryPanel || comparisonMode ? "default" : "outline"}
                size="sm"
                className="h-8 px-2 gap-1"
                title="Historique et branches"
              >
                <History className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {/* Historique */}
              <DropdownMenuItem onClick={() => setShowHistoryPanel(true)} className="gap-2">
                <History className="h-4 w-4" />
                <span>Historique des états</span>
                {showHistoryPanel && <Check className="h-4 w-4 ml-auto text-blue-500" />}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Mode Superposition */}
              <DropdownMenuItem
                onClick={() => {
                  setShowComparisonModal(true);
                  setComparisonMode(true);
                  setComparisonStyle("overlay");
                  setVisibleBranches(new Set(branches.map((b) => b.id)));
                }}
                className="gap-2"
                disabled={branches.length <= 1}
              >
                <Layers className="h-4 w-4" />
                <span>Mode Superposition</span>
                {comparisonMode && comparisonStyle === "overlay" && <Check className="h-4 w-4 ml-auto text-blue-500" />}
              </DropdownMenuItem>

              {/* Mode Rideau */}
              <DropdownMenuItem
                onClick={() => {
                  setShowComparisonModal(true);
                  setComparisonMode(true);
                  setComparisonStyle("reveal");
                  const otherBranch = branches.find((b) => b.id !== activeBranchId);
                  if (otherBranch) setRevealBranchId(otherBranch.id);
                }}
                className="gap-2"
                disabled={branches.length <= 1}
              >
                <SplitSquareVertical className="h-4 w-4" />
                <span>Mode Rideau</span>
                {comparisonMode && comparisonStyle === "reveal" && <Check className="h-4 w-4 ml-auto text-blue-500" />}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Nouvelle branche */}
              <DropdownMenuItem
                onClick={() => createBranchFromHistoryIndex(historyIndex)}
                className="gap-2"
                disabled={branches.length >= 10}
              >
                <Plus className="h-4 w-4" />
                <span>Nouvelle branche</span>
                <span className="text-xs text-gray-400 ml-auto">{branches.length}/10</span>
              </DropdownMenuItem>

              {/* Vue d'ensemble */}
              <DropdownMenuItem onClick={() => setShowOverviewModal(true)} className="gap-2">
                <GitBranch className="h-4 w-4" />
                <span>Vue d'ensemble</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ToolbarGroupWrapper>

        <DropZoneBetweenGroups targetIndex={8} lineIndex={1} />

        <Separator orientation="vertical" className="h-6" />

        {/* Toggles */}
        <ToolbarGroupWrapper groupId="grp_display" groupName="Affichage" groupColor="#06B6D4" lineIndex={1}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showGrid ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowGrid(!showGrid)}
                  className="h-8 px-2"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Grille</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Grille A4 pour export panoramique */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showA4Grid ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowA4Grid(!showA4Grid)}
                  className={`h-8 px-2 ${showA4Grid ? "bg-blue-500 hover:bg-blue-600" : ""}`}
                >
                  <FileDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Grille A4 (export PDF)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={snapEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSnapEnabled(!snapEnabled)}
                  className="h-8 px-2"
                >
                  <Magnet className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Snap (aimantation)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Toggle snap calque actif uniquement */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={snapToActiveLayerOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSnapToActiveLayerOnly(!snapToActiveLayerOnly)}
                  className={`h-8 px-2 ${snapToActiveLayerOnly ? "bg-purple-500 hover:bg-purple-600" : ""}`}
                >
                  <Layers className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Snap calque actif uniquement</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Toggle mode construction */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isConstructionMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsConstructionMode(!isConstructionMode)}
                  className={`h-8 px-2 ${isConstructionMode ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  >
                    <line x1="4" y1="20" x2="20" y2="4" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mode construction (lignes pointillées)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Toggle afficher/masquer construction */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showConstruction ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowConstruction(!showConstruction)}
                  className="h-8 px-2"
                >
                  {showConstruction ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{showConstruction ? "Masquer" : "Afficher"} lignes construction</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* MOD v7.31: Toggle cotations automatiques */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={autoDimensionsEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoDimensionsEnabled(!autoDimensionsEnabled)}
                  className={`h-8 px-2 ${autoDimensionsEnabled ? "bg-cyan-500 hover:bg-cyan-600" : ""}`}
                >
                  <Sliders className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Cotations auto {autoDimensionsEnabled ? "(actif)" : "(inactif)"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Slider opacité surbrillance */}
          <div className="flex items-center gap-1 ml-2 px-2 py-1 bg-blue-50 rounded">
            <span className="text-xs text-blue-600" title="Surbrillance formes fermées">
              🔹
            </span>
            <input
              type="range"
              min="0"
              max="0.3"
              step="0.02"
              value={highlightOpacity}
              onChange={(e) => setHighlightOpacity(parseFloat(e.target.value))}
              className="w-14 h-1 accent-blue-500"
              title={`Opacité surbrillance: ${Math.round(highlightOpacity * 100)}%`}
            />
            <span className="text-xs text-blue-500 w-6">{Math.round(highlightOpacity * 100)}%</span>
          </div>
        </ToolbarGroupWrapper>

        <DropZoneBetweenGroups targetIndex={9} lineIndex={1} />
      </div>

      {/* Zone principale avec Canvas + Panneau latéral */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas + Onglets calques */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* MOD v7.29: Composant LayerTabs avec gestion avancée */}
          <LayerTabs sketch={sketch} setSketch={setSketch} />

          {/* Canvas */}
          <div className="flex-1 relative overflow-hidden">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 cursor-crosshair"
              style={{
                cursor: isDraggingSelection
                  ? "move"
                  : draggingMeasurePoint || draggingCalibrationPoint
                    ? "move"
                    : activeTool === "pan" || isPanning
                      ? "grab"
                      : "crosshair",
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDoubleClick={handleDoubleClick}
              onContextMenu={(e) => {
                e.preventDefault();

                // === PRIORITÉ 0: Fermer l'input texte ===
                if (textInput?.active) {
                  setTextInput(null);
                  return;
                }

                // === PRIORITÉ 1: Annuler le drag du gizmo en cours ===
                // Utiliser la ref pour éviter stale closure
                const currentGizmoDrag = gizmoDragRef.current;
                if (currentGizmoDrag) {
                  // Restaurer les positions initiales
                  setSketch((prev) => {
                    const newSketch = { ...prev };
                    newSketch.points = new Map(prev.points);

                    for (const [pointId, initialPos] of currentGizmoDrag.initialPositions) {
                      newSketch.points.set(pointId, { id: pointId, x: initialPos.x, y: initialPos.y });
                    }

                    return newSketch;
                  });
                  setGizmoDrag(null);
                  setShowTransformGizmo(false);
                  toast.info("Transformation annulée");
                  return;
                }

                // === PRIORITÉ 2: Désactiver le gizmo si affiché ===
                if (showTransformGizmo) {
                  setShowTransformGizmo(false);
                  return;
                }

                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;

                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                const worldPos = screenToWorld(screenX, screenY);
                const tolerance = 10 / viewport.scale;

                // D'abord chercher si on est sur un point (coin potentiel ou point simple)
                for (const [pointId, point] of sketch.points) {
                  if (distance(worldPos, point) < tolerance) {
                    // Compter les lignes connectées à ce point
                    const connectedLines: Line[] = [];
                    sketch.geometries.forEach((geo) => {
                      if (geo.type === "line") {
                        const line = geo as Line;
                        if (line.p1 === pointId || line.p2 === pointId) {
                          connectedLines.push(line);
                        }
                      }
                    });

                    // Si au moins 2 lignes connectées, c'est un coin/angle
                    if (connectedLines.length >= 2) {
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        entityId: pointId,
                        entityType: "corner",
                      });
                      return;
                    }

                    // Sinon c'est un point simple (on peut le verrouiller)
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      entityId: pointId,
                      entityType: "point",
                    });
                    return;
                  }
                }

                // FIX #90: D'abord chercher si on clique sur une image
                // v7.35: includeLocked=true pour permettre déverrouillage via menu contextuel
                const clickedImage = findImageAtPosition(worldPos.x, worldPos.y, true);
                if (clickedImage) {
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    entityId: clickedImage.id,
                    entityType: "image",
                  });
                  return;
                }

                // Sinon chercher une entité géométrique
                const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
                if (entityId) {
                  const geo = sketch.geometries.get(entityId);
                  if (geo) {
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      entityId,
                      entityType: geo.type,
                    });
                  }
                } else {
                  // Chercher une forme fermée (pour remplissage)
                  const closedShape = findClosedShapeAtPosition(worldPos.x, worldPos.y);
                  if (closedShape) {
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      entityId: closedShape.geoIds[0], // Premier geoId comme référence
                      entityType: "closedShape",
                      shapeGeoIds: closedShape.geoIds,
                      shapePath: closedShape.path,
                    });
                  } else {
                    setContextMenu(null);
                  }
                }
              }}
            />

            {/* Poignée du mode reveal (rideau) */}
            {comparisonMode && comparisonStyle === "reveal" && revealBranchData && (
              <div
                className="absolute inset-0 pointer-events-none z-40"
                style={{ left: "32px" }} // Décalage pour la règle
              >
                {/* Ligne de division */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
                  style={{
                    left: `${revealPosition}%`,
                    boxShadow: "0 0 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.3)",
                  }}
                />

                {/* Poignée draggable */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-auto cursor-ew-resize z-50"
                  style={{ left: `${revealPosition}%` }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    isDraggingRevealRef.current = true;
                    setIsDraggingReveal(true);

                    const container = e.currentTarget.parentElement;
                    if (!container) return;

                    const rect = container.getBoundingClientRect();

                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      moveEvent.preventDefault();
                      const x = moveEvent.clientX - rect.left;
                      const percentage = Math.round(Math.max(5, Math.min(95, (x / rect.width) * 100)));
                      setRevealPosition(percentage);
                    };

                    const handleMouseUp = () => {
                      isDraggingRevealRef.current = false;
                      setIsDraggingReveal(false);
                      document.removeEventListener("mousemove", handleMouseMove);
                      document.removeEventListener("mouseup", handleMouseUp);
                    };

                    document.addEventListener("mousemove", handleMouseMove);
                    document.addEventListener("mouseup", handleMouseUp);
                  }}
                >
                  {/* Poignée visuelle */}
                  <div className="w-8 h-12 bg-white rounded-lg shadow-lg border border-gray-300 flex flex-col items-center justify-center gap-0.5">
                    <div className="flex gap-0.5">
                      <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
                      <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
                    </div>
                    {/* Flèches */}
                    <div className="flex items-center text-gray-500 text-[8px] font-bold">◀ ▶</div>
                  </div>
                </div>

                {/* Labels des branches */}
                <div
                  className="absolute top-2 px-2 py-1 rounded text-[10px] font-medium text-white shadow-md pointer-events-none"
                  style={{
                    left: `calc(${revealPosition}% - 60px)`,
                    backgroundColor: activeBranchColor,
                  }}
                >
                  {branches.find((b) => b.id === activeBranchId)?.name || "Active"}
                </div>
                <div
                  className="absolute top-2 px-2 py-1 rounded text-[10px] font-medium text-white shadow-md pointer-events-none"
                  style={{
                    left: `calc(${revealPosition}% + 8px)`,
                    backgroundColor: revealBranchData.color,
                  }}
                >
                  {revealBranchData.branchName}
                </div>
              </div>
            )}

            {/* v7.31: Inputs inline sur le rectangle temporaire (style épuré) */}
            {rectInputs.active &&
              tempGeometry?.type === "rectangle" &&
              tempGeometry.p1 &&
              tempGeometry.cursor &&
              (() => {
                const p1 = tempGeometry.p1;
                const p2 = tempGeometry.cursor;
                const isCenter = tempGeometry.mode === "center";

                // Calculer les coordonnées du rectangle
                const topY = isCenter ? p1.y - Math.abs(p2.y - p1.y) : Math.min(p1.y, p2.y);
                const leftX = isCenter ? p1.x - Math.abs(p2.x - p1.x) : Math.min(p1.x, p2.x);
                const rightX = isCenter ? p1.x + Math.abs(p2.x - p1.x) : Math.max(p1.x, p2.x);
                const bottomY = isCenter ? p1.y + Math.abs(p2.y - p1.y) : Math.max(p1.y, p2.y);

                // Positions écran pour les inputs
                const widthScreenX = ((leftX + rightX) / 2) * viewport.scale + viewport.offsetX;
                const widthScreenY = topY * viewport.scale + viewport.offsetY - 18;
                const heightScreenX = leftX * viewport.scale + viewport.offsetX - 32;
                const heightScreenY = ((topY + bottomY) / 2) * viewport.scale + viewport.offsetY;

                // Valeurs actuelles en mm
                const widthPx = isCenter ? Math.abs(p2.x - p1.x) * 2 : Math.abs(p2.x - p1.x);
                const heightPx = isCenter ? Math.abs(p2.y - p1.y) * 2 : Math.abs(p2.y - p1.y);
                const widthMm = widthPx / sketch.scaleFactor;
                const heightMm = heightPx / sketch.scaleFactor;

                // Valeurs verrouillées (saisies par l'utilisateur)
                const lockedWidth = rectInputs.widthValue && parseFloat(rectInputs.widthValue.replace(",", ".")) > 0;
                const lockedHeight = rectInputs.heightValue && parseFloat(rectInputs.heightValue.replace(",", ".")) > 0;

                return (
                  <>
                    {/* Input Largeur (en haut du rectangle) - style épuré */}
                    <input
                      ref={widthInputRef}
                      type="text"
                      inputMode="decimal"
                      value={rectInputs.editingWidth || lockedWidth ? rectInputs.widthValue : widthMm.toFixed(1)}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".");
                        setRectInputs((prev) => ({ ...prev, widthValue: val, editingWidth: true }));
                      }}
                      onFocus={(e) => {
                        setRectInputs((prev) => ({ ...prev, activeField: "width", editingWidth: true }));
                        e.target.select();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Tab") {
                          e.preventDefault();
                          setRectInputs((prev) => ({ ...prev, activeField: "height" }));
                          heightInputRef.current?.focus();
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          createRectangleFromInputs(undefined, {
                            width: widthInputRef.current?.value || "",
                            height: heightInputRef.current?.value || "",
                          });
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setTempPoints([]);
                          setTempGeometry(null);
                          setRectInputs({
                            active: false,
                            widthValue: "",
                            heightValue: "",
                            activeField: "width",
                            editingWidth: false,
                            editingHeight: false,
                            widthInputPos: { x: 0, y: 0 },
                            heightInputPos: { x: 0, y: 0 },
                          });
                        }
                      }}
                      onBlur={() => {
                        // v7.32: Quand on quitte le champ, si vide, désactiver le mode édition
                        if (!rectInputs.widthValue) {
                          setRectInputs((prev) => ({ ...prev, editingWidth: false }));
                        }
                      }}
                      className={`absolute z-50 pointer-events-auto w-14 h-5 px-1 text-xs font-mono text-center rounded-sm outline-none
                      ${lockedWidth ? "bg-green-100 text-green-700 font-bold" : "bg-blue-50/95 text-blue-600"}
                      ${rectInputs.activeField === "width" ? "ring-2 ring-blue-400" : ""}`}
                      style={{
                        left: `${widthScreenX}px`,
                        top: `${widthScreenY}px`,
                        transform: "translate(-50%, -50%)",
                      }}
                    />

                    {/* Input Hauteur (à gauche du rectangle) - style épuré */}
                    <input
                      ref={heightInputRef}
                      type="text"
                      inputMode="decimal"
                      value={rectInputs.editingHeight || lockedHeight ? rectInputs.heightValue : heightMm.toFixed(1)}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".");
                        setRectInputs((prev) => ({ ...prev, heightValue: val, editingHeight: true }));
                      }}
                      onFocus={(e) => {
                        setRectInputs((prev) => ({ ...prev, activeField: "height", editingHeight: true }));
                        e.target.select();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Tab") {
                          e.preventDefault();
                          setRectInputs((prev) => ({ ...prev, activeField: "width" }));
                          widthInputRef.current?.focus();
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          createRectangleFromInputs(undefined, {
                            width: widthInputRef.current?.value || "",
                            height: heightInputRef.current?.value || "",
                          });
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setTempPoints([]);
                          setTempGeometry(null);
                          setRectInputs({
                            active: false,
                            widthValue: "",
                            heightValue: "",
                            activeField: "width",
                            editingWidth: false,
                            editingHeight: false,
                            widthInputPos: { x: 0, y: 0 },
                            heightInputPos: { x: 0, y: 0 },
                          });
                        }
                      }}
                      onBlur={() => {
                        // v7.32: Quand on quitte le champ, si vide, désactiver le mode édition
                        if (!rectInputs.heightValue) {
                          setRectInputs((prev) => ({ ...prev, editingHeight: false }));
                        }
                      }}
                      className={`absolute z-50 pointer-events-auto w-14 h-5 px-1 text-xs font-mono text-center rounded-sm outline-none
                      ${lockedHeight ? "bg-green-100 text-green-700 font-bold" : "bg-blue-50/95 text-blue-600"}
                      ${rectInputs.activeField === "height" ? "ring-2 ring-blue-400" : ""}`}
                      style={{
                        left: `${heightScreenX}px`,
                        top: `${heightScreenY}px`,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  </>
                );
              })()}

            {/* Input inline pour le gizmo de transformation */}
            {transformGizmo.active && selectionGizmoData && (
              <div
                className="absolute z-50 flex items-center gap-1"
                style={{
                  left: `${selectionGizmoData.center.x * viewport.scale + viewport.offsetX + (transformGizmo.mode === "translateX" ? 70 : transformGizmo.mode === "rotate" ? 0 : 0)}px`,
                  top: `${selectionGizmoData.center.y * viewport.scale + viewport.offsetY + (transformGizmo.mode === "translateY" ? -70 : transformGizmo.mode === "rotate" ? 45 : 0)}px`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <input
                  ref={transformInputRef}
                  type="text"
                  inputMode="decimal"
                  value={transformGizmo.inputValue}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.,-]/g, "").replace(",", ".");
                    applyGizmoTransform(val);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmGizmoTransform();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelGizmoTransform();
                    }
                    e.stopPropagation();
                  }}
                  className={`w-20 h-8 px-2 text-center text-sm font-bold rounded border-2 shadow-lg outline-none ${
                    transformGizmo.mode === "translateX"
                      ? "border-red-500 bg-red-50 text-red-700"
                      : transformGizmo.mode === "translateY"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-blue-500 bg-blue-50 text-blue-700"
                  }`}
                  placeholder="0"
                  autoFocus
                />
                <span
                  className={`text-xs font-bold px-1 rounded ${
                    transformGizmo.mode === "translateX"
                      ? "text-red-600 bg-red-100"
                      : transformGizmo.mode === "translateY"
                        ? "text-green-600 bg-green-100"
                        : "text-blue-600 bg-blue-100"
                  }`}
                >
                  {transformGizmo.mode === "rotate" ? "°" : "mm"}
                </span>
              </div>
            )}

            {/* Indicateur discret pour l'outil de mesure - sous la toolbar */}
            {activeTool === "measure" && (
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-green-50 border border-green-200 rounded px-3 py-1 flex items-center gap-2 text-sm shadow-sm z-10">
                <Ruler className="h-4 w-4 text-green-600" />
                <span className="text-green-700">
                  {measureState.phase === "idle"
                    ? "Cliquez 1er point"
                    : measureState.phase === "waitingSecond"
                      ? "Cliquez 2ème point"
                      : ""}
                </span>
                {/* MOD v7.16: Bouton pour masquer/afficher le panneau */}
                <button
                  className="text-green-600 font-medium hover:text-green-800 hover:underline text-xs"
                  onClick={() => setShowMeasurePanel(!showMeasurePanel)}
                  title={showMeasurePanel ? "Masquer le panneau" : "Afficher le panneau"}
                >
                  [{measurements.length}] {showMeasurePanel ? "▼" : "▲"}
                </button>
              </div>
            )}

            {/* Indicateur de longueur des segments sélectionnés - coin supérieur droit */}
            {selectedLength && (
              <div className="absolute top-2 right-2 bg-gray-100/90 border border-gray-300 rounded px-2 py-1 text-xs text-gray-600 shadow-sm z-10 flex flex-col gap-0.5">
                <div>
                  <span className="font-medium">{selectedLength.mm.toFixed(1)} mm</span>
                  {selectedLength.count > 1 && <span className="text-gray-400 ml-1">({selectedLength.count})</span>}
                </div>
                {selectedLength.internalAngle !== null && (
                  <div className="text-orange-600 font-medium">∠ {selectedLength.internalAngle.toFixed(1)}°</div>
                )}
              </div>
            )}

            {/* Overlay pour arc sélectionné */}
            {selectedEntities.size === 1 &&
              (() => {
                const entityId = Array.from(selectedEntities)[0];
                const geo = sketch.geometries.get(entityId);
                if (geo && geo.type === "arc") {
                  const arc = geo as Arc;
                  return (
                    <div
                      className="absolute bottom-4 right-4 bg-white/95 rounded-lg shadow-lg p-3 border border-blue-300 cursor-pointer hover:bg-blue-50"
                      onDoubleClick={() => {
                        setArcEditDialog({
                          open: true,
                          arcId: entityId,
                          currentRadius: arc.radius,
                        });
                      }}
                    >
                      <div className="flex items-center gap-2 text-blue-700 font-medium">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 20 L4 12 Q4 4 12 4 L20 4" strokeLinecap="round" />
                        </svg>
                        <span>Arc</span>
                      </div>
                      <p className="text-lg font-bold text-blue-800 mt-1">R{arc.radius.toFixed(1)} mm</p>
                      <p className="text-xs text-gray-400">Double-clic pour modifier</p>
                    </div>
                  );
                }
                return null;
              })()}
          </div>
        </div>

        {/* Panneau de calibration - Composant externe */}
        {showCalibrationPanel && (
          <CalibrationPanel
            position={calibrationPanelPos}
            setPosition={setCalibrationPanelPos}
            onClose={() => {
              setShowCalibrationPanel(false);
              setCalibrationMode("idle");
              setSelectedCalibrationPoint(null);
            }}
            selectedImageId={selectedImageId}
            backgroundImages={backgroundImages}
            getSelectedImage={getSelectedImage}
            setBackgroundImages={setBackgroundImages}
            calibrationData={calibrationData}
            setCalibrationData={setCalibrationData}
            getSelectedImageCalibration={getSelectedImageCalibration}
            updateSelectedImageCalibration={updateSelectedImageCalibration}
            calibrationMode={calibrationMode}
            setCalibrationMode={setCalibrationMode}
            selectedCalibrationPoint={selectedCalibrationPoint}
            setSelectedCalibrationPoint={setSelectedCalibrationPoint}
            newPairDistance={newPairDistance}
            setNewPairDistance={setNewPairDistance}
            newPairColor={newPairColor}
            setNewPairColor={setNewPairColor}
            calculateCalibration={calculateCalibration}
            applyCalibration={applyCalibration}
            resetCalibration={resetCalibration}
            updatePairDistance={updatePairDistance}
            deleteCalibrationPair={deleteCalibrationPair}
            deleteCalibrationPoint={deleteCalibrationPoint}
            perspectiveMethod={perspectiveMethod}
            setPerspectiveMethod={setPerspectiveMethod}
            rectPoints={rectPoints}
            setRectPoints={setRectPoints}
            rectWidth={rectWidth}
            setRectWidth={setRectWidth}
            rectHeight={rectHeight}
            setRectHeight={setRectHeight}
            checkerCornersX={checkerCornersX}
            setCheckerCornersX={setCheckerCornersX}
            checkerCornersY={checkerCornersY}
            setCheckerCornersY={setCheckerCornersY}
            checkerSquareSize={checkerSquareSize}
            setCheckerSquareSize={setCheckerSquareSize}
            sketch={sketch}
          />
        )}

        {/* MOD v7.16: Panneau d'historique des mesures - Composant externe */}
        {showMeasurePanel && (
          <MeasurePanel
            position={measurePanelPos}
            setPosition={setMeasurePanelPos}
            onClose={() => setShowMeasurePanel(false)}
            measurements={measurements}
            setMeasurements={setMeasurements}
            measurePhase={measureState.phase}
            hasCalibration={!!calibrationData.scale || !!getSelectedImageCalibration().scale}
          />
        )}

        {/* v7.34: Générateur d'équerre de calibration */}
        <CalibrationRulerGenerator
          open={showCalibrationRulerGenerator}
          onOpenChange={setShowCalibrationRulerGenerator}
        />

        {/* v7.36: Modale flottante pour outils photo */}
        <ImageToolsModal
          isOpen={showImageToolsModal}
          onClose={() => setShowImageToolsModal(false)}
          selectedImageId={selectedImageId}
          selectedImageIds={selectedImageIds}
          backgroundImages={backgroundImages}
          setBackgroundImages={setBackgroundImages}
          layers={sketch.layers}
          setSketch={setSketch}
          onCalibrate={(imageId) => {
            setSelectedImageId(imageId);
            setSelectedImageIds(new Set([imageId]));
            setShowCalibrationPanel(true);
          }}
          onMoveToNewLayer={moveImageToNewLayer}
          onMoveToLayer={(imageId, layerId) => {
            setBackgroundImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, layerId } : img)));
            const layer = sketch.layers.get(layerId);
            toast.success(`→ "${layer?.name || layerId}"`, { duration: 1500 });
          }}
          onDelete={(imageId) => {
            addToImageHistory(backgroundImages, markerLinks);
            setBackgroundImages((prev) => prev.filter((img) => img.id !== imageId));
            setMarkerLinks((links) =>
              links.filter((link) => link.marker1.imageId !== imageId && link.marker2.imageId !== imageId),
            );
            if (selectedImageId === imageId) setSelectedImageId(null);
            const newSelectedIds = new Set(selectedImageIds);
            newSelectedIds.delete(imageId);
            setSelectedImageIds(newSelectedIds);
            toast.success("Supprimée", { duration: 1500 });
          }}
          onAdjustContours={() => {
            if (!selectedImageId) {
              toast.error("Sélectionnez d'abord une photo");
              return;
            }
            setShowAdjustmentsDialog(true);
          }}
          onCrop={() => {
            if (!selectedImageId) {
              toast.error("Sélectionnez d'abord une photo");
              return;
            }
            openCropDialog();
          }}
          onAddMarker={() => {
            if (markerMode === "addMarker") {
              setMarkerMode("idle");
            } else {
              setMarkerMode("addMarker");
              toast.info("Cliquez sur une photo pour ajouter un marqueur");
            }
          }}
          onLinkMarkers={() => {
            if (markerMode === "linkMarker1" || markerMode === "linkMarker2") {
              setMarkerMode("idle");
              setPendingLink(null);
            } else {
              const imagesWithMarkers = backgroundImages.filter((img) => img.markers.length > 0);
              if (imagesWithMarkers.length < 2) {
                toast.error("Ajoutez au moins 1 marqueur sur 2 photos différentes");
                return;
              }
              setMarkerMode("linkMarker1");
              toast.info("Cliquez sur le premier marqueur");
            }
          }}
          getSelectedImageRotation={getSelectedImageRotation}
          updateSelectedImageRotation={updateSelectedImageRotation}
          highlightedPairId={highlightedPairId}
          setHighlightedPairId={setHighlightedPairId}
          onUpdatePairDistance={(pairId, distanceMm) => {
            if (!selectedImageId) return;
            setBackgroundImages((prev) =>
              prev.map((img) => {
                if (img.id !== selectedImageId || !img.calibrationData?.pairs) return img;
                const newPairs = new Map(img.calibrationData.pairs);
                const pair = newPairs.get(pairId);
                if (pair) {
                  newPairs.set(pairId, { ...pair, distanceMm });
                }
                return {
                  ...img,
                  calibrationData: { ...img.calibrationData, pairs: newPairs },
                };
              }),
            );
          }}
          initialPosition={imageToolsModalPos}
        />

        {/* v7.37: Modale de calibration au drop d'image */}
        <ImageCalibrationModal
          isOpen={showCalibrationModal}
          onClose={() => {
            setShowCalibrationModal(false);
            setPendingCalibrationImage(null);
          }}
          image={pendingCalibrationImage}
          onSkip={() => {
            // Ajouter l'image sans calibration
            if (pendingCalibrationImage) {
              addImageWithLayer(pendingCalibrationImage);
              toast.success("Image ajoutée sans calibration");
            }
            setShowCalibrationModal(false);
            setPendingCalibrationImage(null);
          }}
          onCalibrate={(calibrationData) => {
            // Ajouter l'image avec la calibration
            if (pendingCalibrationImage) {
              addImageWithLayer({ ...pendingCalibrationImage, calibrationData });
              if (calibrationData?.applied) {
                toast.success("Image ajoutée avec calibration !");
              } else {
                toast.success("Image ajoutée (calibration partielle)");
              }
            }
            setShowCalibrationModal(false);
            setPendingCalibrationImage(null);
          }}
        />
      </div>

      {/* Dialog cotation */}
      {dimensionDialog && (
        <Dialog open={dimensionDialog.open} onOpenChange={() => setDimensionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dimensionDialog.type === "distance" && "Distance"}
                {dimensionDialog.type === "radius" && "Rayon"}
                {dimensionDialog.type === "angle" && "Angle"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dimension-value" className="text-right">
                  Valeur
                </Label>
                <Input
                  id="dimension-value"
                  type="number"
                  defaultValue={dimensionDialog.initialValue}
                  className="col-span-3"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const value = parseFloat((e.target as HTMLInputElement).value);
                      if (!isNaN(value)) {
                        addDimension(
                          dimensionDialog.type === "distance" ? "linear" : dimensionDialog.type,
                          dimensionDialog.entities,
                          value,
                        );
                        setDimensionDialog(null);
                      }
                    }
                  }}
                />
                <span className="text-sm text-muted-foreground">{dimensionDialog.type === "angle" ? "°" : "mm"}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDimensionDialog(null)}>
                Annuler
              </Button>
              <Button
                onClick={() => {
                  const input = document.getElementById("dimension-value") as HTMLInputElement;
                  const value = parseFloat(input.value);
                  if (!isNaN(value)) {
                    addDimension(
                      dimensionDialog.type === "distance" ? "linear" : dimensionDialog.type,
                      dimensionDialog.entities,
                      value,
                    );
                    setDimensionDialog(null);
                  }
                }}
              >
                Appliquer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* v7.31: Input inline pour édition de dimension existante (double-clic sur cotation) */}
      {editingDimension && (
        <div
          className="fixed z-[9999] pointer-events-auto"
          style={{
            left: `${editingDimension.screenPos.x + (canvasRef.current?.getBoundingClientRect().left || 0)}px`,
            top: `${editingDimension.screenPos.y + (canvasRef.current?.getBoundingClientRect().top || 0)}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="flex items-center gap-0.5 bg-amber-100 border-2 border-amber-500 rounded px-1.5 py-0.5 shadow-lg">
            <span className="text-xs text-amber-600">✏️</span>
            {editingDimension.type === "circle" && <span className="text-sm text-amber-700 font-bold">R</span>}
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              defaultValue={editingDimension.currentValue.toFixed(1)}
              onFocus={(e) => e.target.select()}
              onBlur={() => setEditingDimension(null)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditingDimension(null);
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const newValue = parseFloat((e.target as HTMLInputElement).value.replace(",", ".")) || 0;
                  if (newValue > 0 && editingDimension.entityId) {
                    const scaleFactor = sketchRef.current.scaleFactor || 1;
                    const newValuePx = newValue * scaleFactor;
                    const geo = sketchRef.current.geometries.get(editingDimension.entityId);
                    if (geo) {
                      const newSketch = { ...sketchRef.current };
                      newSketch.points = new Map(sketchRef.current.points);
                      newSketch.geometries = new Map(sketchRef.current.geometries);
                      newSketch.dimensions = new Map(sketchRef.current.dimensions);

                      if (editingDimension.type === "line" && geo.type === "line") {
                        const line = geo as Line;
                        const p1 = newSketch.points.get(line.p1);
                        const p2 = newSketch.points.get(line.p2);
                        if (p1 && p2) {
                          const dx = p2.x - p1.x;
                          const dy = p2.y - p1.y;
                          const currentLen = Math.sqrt(dx * dx + dy * dy);
                          if (currentLen > 0) {
                            // Garder p1 fixe, déplacer p2
                            const newP2 = {
                              ...p2,
                              x: p1.x + (dx / currentLen) * newValuePx,
                              y: p1.y + (dy / currentLen) * newValuePx,
                            };
                            newSketch.points.set(line.p2, newP2);
                          }
                        }
                      } else if (editingDimension.type === "circle" && geo.type === "circle") {
                        const circle = geo as CircleType;
                        const newCircle = { ...circle, radius: newValuePx };
                        newSketch.geometries.set(circle.id, newCircle);
                      }

                      // Mettre à jour la dimension
                      if (editingDimension.dimensionId) {
                        const dim = newSketch.dimensions.get(editingDimension.dimensionId);
                        if (dim) {
                          newSketch.dimensions.set(editingDimension.dimensionId, { ...dim, value: newValue });
                        }
                      }

                      setSketch(newSketch);
                      addToHistory(newSketch, `Dimension modifiée: ${newValue.toFixed(1)} mm`);
                    }
                  }
                  setEditingDimension(null);
                }
              }}
              className="w-16 px-1 py-0.5 text-sm font-mono bg-white border border-amber-400 rounded text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <span className="text-xs text-amber-600 ml-0.5">mm</span>
          </div>
        </div>
      )}

      {/* Dialog contrainte d'angle */}
      {angleConstraintDialog && (
        <Dialog open={angleConstraintDialog.open} onOpenChange={() => setAngleConstraintDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Contrainte d'angle entre 2 lignes</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="p-3 bg-gray-50 rounded text-sm">
                <span className="text-muted-foreground">Angle actuel : </span>
                <span className="font-mono font-bold">{angleConstraintDialog.currentAngle}°</span>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="angle-value" className="text-right">
                  Angle désiré
                </Label>
                <Input
                  id="angle-value"
                  type="number"
                  min="0"
                  max="180"
                  step="0.1"
                  defaultValue={angleConstraintDialog.currentAngle}
                  className="col-span-2"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const value = parseFloat((e.target as HTMLInputElement).value);
                      if (!isNaN(value) && value >= 0 && value <= 180) {
                        applyAngleConstraint(value);
                      }
                    }
                  }}
                />
                <span className="text-sm text-muted-foreground">°</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    (document.getElementById("angle-value") as HTMLInputElement).value = "90";
                  }}
                >
                  90°
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    (document.getElementById("angle-value") as HTMLInputElement).value = "45";
                  }}
                >
                  45°
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    (document.getElementById("angle-value") as HTMLInputElement).value = "30";
                  }}
                >
                  30°
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    (document.getElementById("angle-value") as HTMLInputElement).value = "60";
                  }}
                >
                  60°
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    (document.getElementById("angle-value") as HTMLInputElement).value = "0";
                  }}
                >
                  0° (parallèles)
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAngleConstraintDialog(null)}>
                Annuler
              </Button>
              <Button
                onClick={() => {
                  const input = document.getElementById("angle-value") as HTMLInputElement;
                  const value = parseFloat(input.value);
                  if (!isNaN(value) && value >= 0 && value <= 180) {
                    applyAngleConstraint(value);
                  } else {
                    toast.error("L'angle doit être entre 0° et 180°");
                  }
                }}
              >
                Appliquer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Panneau Congé flottant draggable */}
      {filletDialog?.open &&
        (() => {
          const cornerCount = filletDialog.corners.length;
          const allValid = filletDialog.corners.every((c) => c.radius > 0 && c.radius <= c.maxRadius);
          return (
            <div
              className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
              style={{
                left: filletPanelPos.x,
                top: filletPanelPos.y,
                width: 240,
              }}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "BUTTON")
                  return;
                setFilletPanelDragging(true);
                setFilletPanelDragStart({ x: e.clientX - filletPanelPos.x, y: e.clientY - filletPanelPos.y });
              }}
              onMouseMove={(e) => {
                if (filletPanelDragging) {
                  setFilletPanelPos({
                    x: e.clientX - filletPanelDragStart.x,
                    y: e.clientY - filletPanelDragStart.y,
                  });
                }
              }}
              onMouseUp={() => setFilletPanelDragging(false)}
              onMouseLeave={() => setFilletPanelDragging(false)}
            >
              {/* Header avec switch */}
              <div className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-t-lg cursor-move border-b">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Congé {cornerCount > 1 ? `(${cornerCount})` : ""}</span>
                  <button
                    className="text-xs px-1.5 py-0.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded"
                    onClick={switchFilletToChamfer}
                    title="Passer en chanfrein"
                  >
                    → Chanfrein
                  </button>
                </div>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setFilletDialog(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Options */}
              <div className="px-2 py-1.5 border-b flex items-center gap-3 text-[10px]">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filletDialog.addDimension}
                    onChange={(e) => setFilletDialog({ ...filletDialog, addDimension: e.target.checked })}
                    className="h-3 w-3"
                  />
                  Cotation
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filletDialog.repeatMode}
                    onChange={(e) => setFilletDialog({ ...filletDialog, repeatMode: e.target.checked })}
                    className="h-3 w-3"
                  />
                  Répéter
                </label>
              </div>

              {/* Contenu */}
              <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto">
                {/* Rayon global si plusieurs coins */}
                {cornerCount > 1 && (
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <span className="text-xs">Tous:</span>
                    <Input
                      type="number"
                      value={filletDialog.globalRadius}
                      onChange={(e) => {
                        const newRadius = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                        setFilletDialog({
                          ...filletDialog,
                          globalRadius: newRadius,
                          corners: filletDialog.corners.map((c) => ({
                            ...c,
                            radius: Math.min(newRadius, c.maxRadius),
                            dist1: Math.min(newRadius, c.maxDist1),
                            dist2: Math.min(newRadius, c.maxDist2),
                          })),
                        });
                      }}
                      className="h-7 w-16 text-xs"
                      min="0.1"
                      step="1"
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter" && allValid) applyFilletFromDialog();
                      }}
                    />
                    <span className="text-xs text-gray-500">mm</span>
                  </div>
                )}

                {/* Liste des coins */}
                {filletDialog.corners.map((corner, idx) => {
                  const isValid = corner.radius > 0 && corner.radius <= corner.maxRadius;
                  const isHovered = filletDialog.hoveredCornerIdx === idx;
                  return (
                    <div
                      key={corner.pointId}
                      className={`p-1.5 rounded text-xs transition-colors ${
                        isHovered ? "bg-blue-100 ring-1 ring-blue-400" : "bg-gray-50 hover:bg-gray-100"
                      }`}
                      onMouseEnter={() => setFilletDialog({ ...filletDialog, hoveredCornerIdx: idx })}
                      onMouseLeave={() => setFilletDialog({ ...filletDialog, hoveredCornerIdx: null })}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0">
                          <span className="font-medium">#{idx + 1}</span>
                          <span className="text-gray-500 ml-1">({corner.angleDeg.toFixed(0)}°)</span>
                        </div>
                        <div className="flex items-center gap-1 flex-1 justify-end">
                          <Input
                            type="number"
                            value={corner.radius}
                            onChange={(e) => {
                              const newRadius = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                              const newCorners = [...filletDialog.corners];
                              newCorners[idx] = { ...corner, radius: newRadius };
                              setFilletDialog({ ...filletDialog, corners: newCorners });
                            }}
                            className={`h-6 w-14 text-xs ${!isValid ? "border-red-500" : ""}`}
                            min="0.1"
                            step="1"
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter" && allValid) applyFilletFromDialog();
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-[10px] text-gray-400">/{corner.maxRadius.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-2 border-t">
                <Button size="sm" className="w-full h-7 text-xs" onClick={applyFilletFromDialog} disabled={!allValid}>
                  <Check className="h-3 w-3 mr-1" />
                  Appliquer
                </Button>
              </div>
            </div>
          );
        })()}

      {/* Panneau Chanfrein flottant draggable */}
      {chamferDialog?.open &&
        (() => {
          const cornerCount = chamferDialog.corners.length;
          const allValid = chamferDialog.asymmetric
            ? chamferDialog.corners.every(
                (c) => c.dist1 > 0 && c.dist1 <= c.maxDist1 && c.dist2 > 0 && c.dist2 <= c.maxDist2,
              )
            : chamferDialog.corners.every((c) => c.distance > 0 && c.distance <= c.maxDistance);
          return (
            <div
              className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
              style={{
                left: chamferPanelPos.x,
                top: chamferPanelPos.y,
                width: chamferDialog.asymmetric ? 320 : 240,
              }}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "BUTTON")
                  return;
                setChamferPanelDragging(true);
                setChamferPanelDragStart({ x: e.clientX - chamferPanelPos.x, y: e.clientY - chamferPanelPos.y });
              }}
              onMouseMove={(e) => {
                if (chamferPanelDragging) {
                  setChamferPanelPos({
                    x: e.clientX - chamferPanelDragStart.x,
                    y: e.clientY - chamferPanelDragStart.y,
                  });
                }
              }}
              onMouseUp={() => setChamferPanelDragging(false)}
              onMouseLeave={() => setChamferPanelDragging(false)}
            >
              {/* Header avec switch */}
              <div className="flex items-center justify-between px-3 py-2 bg-orange-50 rounded-t-lg cursor-move border-b">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Chanfrein {cornerCount > 1 ? `(${cornerCount})` : ""}</span>
                  <button
                    className="text-xs px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                    onClick={switchChamferToFillet}
                    title="Passer en congé"
                  >
                    → Congé
                  </button>
                </div>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setChamferDialog(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Options */}
              <div className="px-2 py-1.5 border-b flex items-center gap-3 text-[10px]">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chamferDialog.asymmetric}
                    onChange={(e) => setChamferDialog({ ...chamferDialog, asymmetric: e.target.checked })}
                    className="h-3 w-3"
                  />
                  Asymétrique
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chamferDialog.repeatMode}
                    onChange={(e) => setChamferDialog({ ...chamferDialog, repeatMode: e.target.checked })}
                    className="h-3 w-3"
                  />
                  Répéter
                </label>
              </div>

              {/* Contenu */}
              <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto">
                {/* Distance globale si plusieurs coins et mode symétrique */}
                {cornerCount > 1 && !chamferDialog.asymmetric && (
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <span className="text-xs">Tous:</span>
                    <Input
                      type="number"
                      value={chamferDialog.globalDistance}
                      onChange={(e) => {
                        const newDistance = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                        setChamferDialog({
                          ...chamferDialog,
                          globalDistance: newDistance,
                          corners: chamferDialog.corners.map((c) => ({
                            ...c,
                            distance: Math.min(newDistance, c.maxDistance),
                            dist1: Math.min(newDistance, c.maxDist1),
                            dist2: Math.min(newDistance, c.maxDist2),
                          })),
                        });
                      }}
                      className="h-7 w-16 text-xs"
                      min="0.1"
                      step="1"
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter" && allValid) applyChamferFromDialog();
                      }}
                    />
                    <span className="text-xs text-gray-500">mm</span>
                  </div>
                )}

                {/* Liste des coins */}
                {chamferDialog.corners.map((corner, idx) => {
                  const isValid = chamferDialog.asymmetric
                    ? corner.dist1 > 0 &&
                      corner.dist1 <= corner.maxDist1 &&
                      corner.dist2 > 0 &&
                      corner.dist2 <= corner.maxDist2
                    : corner.distance > 0 && corner.distance <= corner.maxDistance;
                  const isHovered = chamferDialog.hoveredCornerIdx === idx;
                  return (
                    <div
                      key={corner.pointId}
                      className={`p-1.5 rounded text-xs transition-colors ${
                        isHovered ? "bg-orange-100 ring-1 ring-orange-400" : "bg-gray-50 hover:bg-gray-100"
                      }`}
                      onMouseEnter={() => setChamferDialog({ ...chamferDialog, hoveredCornerIdx: idx })}
                      onMouseLeave={() => setChamferDialog({ ...chamferDialog, hoveredCornerIdx: null })}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0">
                          <span className="font-medium">#{idx + 1}</span>
                          <span className="text-gray-500 ml-1">({corner.angleDeg.toFixed(0)}°)</span>
                        </div>
                        {chamferDialog.asymmetric ? (
                          <div className="flex items-center gap-1 flex-1">
                            <Input
                              type="number"
                              value={corner.dist1}
                              onChange={(e) => {
                                const newDist = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                                const newCorners = [...chamferDialog.corners];
                                newCorners[idx] = { ...corner, dist1: newDist };
                                setChamferDialog({ ...chamferDialog, corners: newCorners });
                              }}
                              className={`h-6 w-16 text-xs ${corner.dist1 > corner.maxDist1 ? "border-red-500" : ""}`}
                              min="0.1"
                              step="1"
                              onKeyDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-gray-400">×</span>
                            <Input
                              type="number"
                              value={corner.dist2}
                              onChange={(e) => {
                                const newDist = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                                const newCorners = [...chamferDialog.corners];
                                newCorners[idx] = { ...corner, dist2: newDist };
                                setChamferDialog({ ...chamferDialog, corners: newCorners });
                              }}
                              className={`h-6 w-16 text-xs ${corner.dist2 > corner.maxDist2 ? "border-red-500" : ""}`}
                              min="0.1"
                              step="1"
                              onKeyDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-[10px] text-gray-400">mm</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 flex-1 justify-end">
                            <Input
                              type="number"
                              value={corner.distance}
                              onChange={(e) => {
                                const newDistance = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                                const newCorners = [...chamferDialog.corners];
                                newCorners[idx] = {
                                  ...corner,
                                  distance: newDistance,
                                  dist1: newDistance,
                                  dist2: newDistance,
                                };
                                setChamferDialog({ ...chamferDialog, corners: newCorners });
                              }}
                              className={`h-6 w-14 text-xs ${!isValid ? "border-red-500" : ""}`}
                              min="0.1"
                              step="1"
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter" && allValid) applyChamferFromDialog();
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-[10px] text-gray-400">/{corner.maxDistance.toFixed(0)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-2 border-t">
                <Button size="sm" className="w-full h-7 text-xs" onClick={applyChamferFromDialog} disabled={!allValid}>
                  <Check className="h-3 w-3 mr-1" />
                  Appliquer
                </Button>
              </div>
            </div>
          );
        })()}

      {/* Panneau Offset flottant draggable */}
      {offsetDialog?.open && (
        <div
          className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
          style={{
            left: offsetPanelPos.x,
            top: offsetPanelPos.y,
            width: 200,
          }}
          onMouseDown={(e) => {
            // Ne pas démarrer le drag si on clique sur un input ou bouton
            if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "BUTTON") return;
            setOffsetPanelDragging(true);
            setOffsetPanelDragStart({ x: e.clientX - offsetPanelPos.x, y: e.clientY - offsetPanelPos.y });
          }}
          onMouseMove={(e) => {
            if (offsetPanelDragging) {
              setOffsetPanelPos({
                x: e.clientX - offsetPanelDragStart.x,
                y: e.clientY - offsetPanelDragStart.y,
              });
            }
          }}
          onMouseUp={() => setOffsetPanelDragging(false)}
          onMouseLeave={() => setOffsetPanelDragging(false)}
        >
          {/* Header draggable */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-100 rounded-t-lg cursor-move border-b">
            <span className="text-sm font-medium">Offset</span>
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={() => {
                setOffsetDialog(null);
                setOffsetPreview([]);
                setActiveTool("select");
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Contenu */}
          <div className="p-3 space-y-3">
            {/* Distance + Direction sur une ligne */}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={offsetDistance}
                onChange={(e) => setOffsetDistance(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="h-8 w-20 text-sm"
                min="0.1"
                step="1"
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" && offsetDialog.selectedEntities.size > 0) {
                    applyOffsetToSelection();
                  }
                }}
              />
              <span className="text-xs text-gray-500">mm</span>

              {/* Toggle direction avec flèches */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 ml-auto"
                onClick={() => setOffsetDirection(offsetDirection === "outside" ? "inside" : "outside")}
                title={offsetDirection === "outside" ? "Extérieur" : "Intérieur"}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {offsetDirection === "outside" ? (
                    <>
                      <path d="M7 12 L4 12 M4 9 L4 15" strokeLinecap="round" />
                      <path d="M4 12 L1 9 M4 12 L1 15" strokeLinecap="round" />
                      <path d="M17 12 L20 12 M20 9 L20 15" strokeLinecap="round" />
                      <path d="M20 12 L23 9 M20 12 L23 15" strokeLinecap="round" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12 L4 12 M4 9 L4 15" strokeLinecap="round" />
                      <path d="M4 12 L7 9 M4 12 L7 15" strokeLinecap="round" />
                      <path d="M23 12 L20 12 M20 9 L20 15" strokeLinecap="round" />
                      <path d="M20 12 L17 9 M20 12 L17 15" strokeLinecap="round" />
                    </>
                  )}
                </svg>
              </Button>
            </div>

            {/* Compteur sélection */}
            <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
              {offsetDialog.selectedEntities.size} sélectionné(s)
            </div>

            {/* Bouton valider */}
            <Button
              size="sm"
              className="w-full h-8"
              onClick={applyOffsetToSelection}
              disabled={offsetDialog.selectedEntities.size === 0}
            >
              <Check className="h-3 w-3 mr-1" />
              Valider
            </Button>
          </div>
        </div>
      )}

      {/* MOD v7.12: Modale d'export DXF avec nom de fichier */}
      {dxfExportDialog?.open && (
        <div
          className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
          style={{
            left: dxfExportDialog.position.x,
            top: dxfExportDialog.position.y,
            width: 300,
          }}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "BUTTON") return;
            const startX = e.clientX - dxfExportDialog.position.x;
            const startY = e.clientY - dxfExportDialog.position.y;
            const onMouseMove = (ev: MouseEvent) => {
              setDxfExportDialog({
                ...dxfExportDialog,
                position: { x: ev.clientX - startX, y: ev.clientY - startY },
              });
            };
            const onMouseUp = () => {
              document.removeEventListener("mousemove", onMouseMove);
              document.removeEventListener("mouseup", onMouseUp);
            };
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
          }}
        >
          {/* Header draggable */}
          <div className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-t-lg cursor-move border-b">
            <span className="text-sm font-medium">Export DXF</span>
            <button className="text-gray-500 hover:text-gray-700" onClick={() => setDxfExportDialog(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Contenu */}
          <div className="p-3 space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-600">Nom du fichier</label>
              <Input
                type="text"
                value={dxfExportDialog.filename}
                onChange={(e) => setDxfExportDialog({ ...dxfExportDialog, filename: e.target.value })}
                className="h-8 text-sm"
                placeholder="nom-du-fichier"
                autoFocus
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" && dxfExportDialog.filename.trim()) {
                    confirmExportDXF();
                  }
                  if (e.key === "Escape") {
                    setDxfExportDialog(null);
                  }
                }}
              />
              <p className="text-[10px] text-gray-400">.dxf sera ajouté automatiquement</p>
            </div>

            <div className="text-[10px] text-gray-500 bg-gray-50 px-2 py-1.5 rounded">
              📁 Le fichier sera téléchargé dans votre dossier de téléchargements
            </div>

            {/* Boutons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => setDxfExportDialog(null)}>
                Annuler
              </Button>
              <Button
                size="sm"
                className="flex-1 h-8"
                onClick={confirmExportDXF}
                disabled={!dxfExportDialog.filename.trim()}
              >
                <Check className="h-3 w-3 mr-1" />
                Exporter
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogue modification arc */}
      {arcEditDialog && (
        <Dialog open={arcEditDialog.open} onOpenChange={() => setArcEditDialog(null)}>
          <DialogContent className="sm:max-w-[280px]">
            <DialogHeader>
              <DialogTitle>Modifier l'arc</DialogTitle>
              <DialogDescription>Changer le rayon de l'arc</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="arc-radius">Rayon (mm)</Label>
              <Input
                id="arc-radius"
                type="number"
                defaultValue={arcEditDialog.currentRadius}
                className="mt-2"
                min="1"
                step="1"
                autoFocus
                onKeyDown={(e) => {
                  e.stopPropagation(); // Empêcher Delete de supprimer les entités
                  if (e.key === "Enter") {
                    const input = document.getElementById("arc-radius") as HTMLInputElement;
                    const value = parseFloat(input.value);
                    if (!isNaN(value) && value > 0) {
                      updateArcRadius(arcEditDialog.arcId, value);
                      setArcEditDialog(null);
                    }
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  const input = document.getElementById("arc-radius") as HTMLInputElement;
                  const value = parseFloat(input.value);
                  if (!isNaN(value) && value > 0) {
                    updateArcRadius(arcEditDialog.arcId, value);
                    setArcEditDialog(null);
                  }
                }}
                className="w-full"
              >
                <Check className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialogue remplissage / hachures */}
      {fillDialogOpen && fillDialogTarget && (
        <Dialog
          open={fillDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setFillDialogOpen(false);
              setFillDialogTarget(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[360px]">
            <DialogHeader>
              <DialogTitle>Remplissage de forme</DialogTitle>
              <DialogDescription>Choisissez le type de remplissage et les paramètres</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {/* Type de remplissage */}
              <div className="space-y-2">
                <Label>Type de remplissage</Label>
                <div className="flex gap-2">
                  <Button
                    variant={fillType === "solid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFillType("solid")}
                    className="flex-1"
                  >
                    Solide
                  </Button>
                  <Button
                    variant={fillType === "hatch" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFillType("hatch")}
                    className="flex-1"
                  >
                    Hachures
                  </Button>
                </div>
              </div>

              {/* Couleur */}
              <div className="space-y-2">
                <Label htmlFor="fill-color">Couleur</Label>
                <div className="flex gap-2 items-center">
                  <input
                    id="fill-color"
                    type="color"
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                {/* Couleurs prédéfinies */}
                <div className="flex gap-1 flex-wrap">
                  {["#3B82F6", "#EF4444", "#22C55E", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#6B7280"].map((c) => (
                    <button
                      key={c}
                      className={`w-6 h-6 rounded border-2 ${fillColor === c ? "border-gray-800" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setFillColor(c)}
                    />
                  ))}
                </div>
              </div>

              {/* Opacité */}
              <div className="space-y-2">
                <Label>Opacité: {Math.round(fillOpacity * 100)}%</Label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={fillOpacity * 100}
                  onChange={(e) => setFillOpacity(parseInt(e.target.value) / 100)}
                  className="w-full"
                />
              </div>

              {/* Options hachures */}
              {fillType === "hatch" && (
                <>
                  <div className="space-y-2">
                    <Label>Motif</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={hatchPattern === "lines" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setHatchPattern("lines")}
                        className="flex-1"
                      >
                        Lignes
                      </Button>
                      <Button
                        variant={hatchPattern === "cross" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setHatchPattern("cross")}
                        className="flex-1"
                      >
                        Croisé
                      </Button>
                      <Button
                        variant={hatchPattern === "dots" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setHatchPattern("dots")}
                        className="flex-1"
                      >
                        Points
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hatch-angle">Angle (°)</Label>
                      <Input
                        id="hatch-angle"
                        type="number"
                        value={hatchAngle}
                        onChange={(e) => setHatchAngle(parseInt(e.target.value) || 0)}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hatch-spacing">Espacement (mm)</Label>
                      <Input
                        id="hatch-spacing"
                        type="number"
                        value={hatchSpacing}
                        onChange={(e) => setHatchSpacing(parseFloat(e.target.value) || 5)}
                        min="1"
                        step="0.5"
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Aperçu */}
              <div className="space-y-2">
                <Label>Aperçu</Label>
                <div
                  className="w-full h-16 rounded border"
                  style={{
                    backgroundColor: fillType === "solid" ? fillColor : "transparent",
                    opacity: fillOpacity,
                    backgroundImage:
                      fillType === "hatch" && hatchPattern === "lines"
                        ? `repeating-linear-gradient(${hatchAngle}deg, ${fillColor} 0px, ${fillColor} 1px, transparent 1px, transparent ${hatchSpacing}px)`
                        : fillType === "hatch" && hatchPattern === "cross"
                          ? `repeating-linear-gradient(${hatchAngle}deg, ${fillColor} 0px, ${fillColor} 1px, transparent 1px, transparent ${hatchSpacing}px), repeating-linear-gradient(${hatchAngle + 90}deg, ${fillColor} 0px, ${fillColor} 1px, transparent 1px, transparent ${hatchSpacing}px)`
                          : fillType === "hatch" && hatchPattern === "dots"
                            ? `radial-gradient(circle, ${fillColor} 1px, transparent 1px)`
                            : "none",
                    backgroundSize:
                      fillType === "hatch" && hatchPattern === "dots"
                        ? `${hatchSpacing}px ${hatchSpacing}px`
                        : undefined,
                  }}
                />
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setFillDialogOpen(false);
                  setFillDialogTarget(null);
                }}
              >
                Annuler
              </Button>
              <Button onClick={confirmFillDialog}>
                <Check className="h-4 w-4 mr-2" />
                Appliquer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Éditeur de mise en plan PDF */}
      <PDFPlanEditor sketch={sketch} isOpen={pdfPlanEditorOpen} onClose={() => setPdfPlanEditorOpen(false)} />

      {/* Dialogue distance entre marqueurs de photos */}
      {linkDistanceDialog && (
        <Dialog open={linkDistanceDialog.open} onOpenChange={() => setLinkDistanceDialog(null)}>
          <DialogContent className="sm:max-w-[320px]">
            <DialogHeader>
              <DialogTitle>Distance entre marqueurs</DialogTitle>
              <DialogDescription>Entrez la distance réelle entre les deux points de référence</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="link-distance">Distance (mm)</Label>
              <Input
                id="link-distance"
                type="number"
                value={linkDistanceDialog.distance}
                onChange={(e) => setLinkDistanceDialog({ ...linkDistanceDialog, distance: e.target.value })}
                className="mt-2"
                min="1"
                step="1"
                placeholder="ex: 2300"
                autoFocus
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    const value = parseFloat(linkDistanceDialog.distance);
                    if (!isNaN(value) && value > 0) {
                      // Créer le lien
                      const newLink: ImageMarkerLink = {
                        id: generateId(),
                        marker1: linkDistanceDialog.marker1,
                        marker2: linkDistanceDialog.marker2,
                        distanceMm: value,
                        color: MARKER_COLORS[markerLinks.length % MARKER_COLORS.length],
                      };
                      setMarkerLinks([...markerLinks, newLink]);
                      toast.success(`Lien créé: ${value} mm`);
                      setLinkDistanceDialog(null);
                    }
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLinkDistanceDialog(null)}>
                Annuler
              </Button>
              <Button
                onClick={() => {
                  const value = parseFloat(linkDistanceDialog.distance);
                  if (!isNaN(value) && value > 0) {
                    // Créer le lien
                    const newLink: ImageMarkerLink = {
                      id: generateId(),
                      marker1: linkDistanceDialog.marker1,
                      marker2: linkDistanceDialog.marker2,
                      distanceMm: value,
                      color: MARKER_COLORS[markerLinks.length % MARKER_COLORS.length],
                    };
                    setMarkerLinks([...markerLinks, newLink]);
                    toast.success(`Lien créé: ${value} mm`);
                    setLinkDistanceDialog(null);
                  } else {
                    toast.error("Entrez une distance valide");
                  }
                }}
              >
                <Check className="h-4 w-4 mr-1" />
                Valider
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Panneau des raccourcis clavier */}
      {showShortcutsPanel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-500" />
                Raccourcis clavier
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowShortcutsPanel(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-6">
                {/* Outils */}
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1">
                    <MousePointer className="h-4 w-4" /> Outils
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Sélection</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">V</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Déplacer (Pan)</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">H</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Ligne</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">L</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Cercle</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">C</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Arc 3 points</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">A</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Rectangle</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">R</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Courbe Bézier</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">B</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Symétrie</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">S</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Mesurer</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">M</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Transformation</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">T</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Texte / Annotation</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Shift+T</kbd>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1">
                    <Settings className="h-4 w-4" /> Actions
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Sauvegarder</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+S</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Annuler</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+Z</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Rétablir</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+Y</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Copier</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+C</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Coller</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+V</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Grouper</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+G</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Dégrouper</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+Shift+G</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Supprimer</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Suppr / Backspace</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Tout sélectionner</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+A</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Annuler action</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Echap</kbd>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1">
                    <ZoomIn className="h-4 w-4" /> Navigation
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Zoom avant/arrière</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Molette</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Déplacer la vue</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Clic molette</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Reset vue</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">0</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Ajuster au contenu</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">F</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Plein écran</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+F</kbd>
                    </div>
                  </div>
                </div>

                {/* Modificateurs */}
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1">
                    <Grid3X3 className="h-4 w-4" /> Modificateurs
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Désactiver le snap</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl (maintenu)</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Contrainte horizontale</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Shift (maintenu)</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Contrainte verticale</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Shift (maintenu)</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Multi-sélection</span>
                      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+Clic</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3 border-t bg-gray-50 text-center text-xs text-gray-500">
              Appuyez sur <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">?</kbd> ou{" "}
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">F1</kbd> pour afficher ce panneau
            </div>
          </div>
        </div>
      )}

      {/* Panneau flottant ajustements d'image */}
      {showAdjustmentsDialog && selectedImageData && (
        <div
          className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
          style={{
            left: adjustmentsPanelPos.x,
            top: adjustmentsPanelPos.y,
            width: 280,
          }}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "BUTTON") return;
            setAdjustmentsPanelDragging(true);
            setAdjustmentsPanelDragStart({
              x: e.clientX - adjustmentsPanelPos.x,
              y: e.clientY - adjustmentsPanelPos.y,
            });
          }}
          onMouseMove={(e) => {
            if (adjustmentsPanelDragging) {
              setAdjustmentsPanelPos({
                x: e.clientX - adjustmentsPanelDragStart.x,
                y: e.clientY - adjustmentsPanelDragStart.y,
              });
            }
          }}
          onMouseUp={() => setAdjustmentsPanelDragging(false)}
          onMouseLeave={() => setAdjustmentsPanelDragging(false)}
        >
          {/* Header draggable - violet pour ajustements */}
          <div className="flex items-center justify-between px-3 py-2 bg-purple-500 text-white rounded-t-lg cursor-move">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              <span className="text-sm font-medium">Ajustements image</span>
            </div>
            <button className="text-white/80 hover:text-white" onClick={() => setShowAdjustmentsDialog(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Contenu - utiliser selectedImageData */}
          <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
            {/* Contraste */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Contraste</Label>
                <span className="text-xs text-muted-foreground">{selectedImageData.adjustments.contrast}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="200"
                value={selectedImageData.adjustments.contrast}
                onChange={(e) => updateSelectedImageAdjustments({ contrast: parseInt(e.target.value) })}
                className="w-full h-1.5 accent-purple-500"
                onMouseDown={(e) => e.stopPropagation()}
              />
            </div>

            {/* Luminosité */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Luminosité</Label>
                <span className="text-xs text-muted-foreground">{selectedImageData.adjustments.brightness}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="200"
                value={selectedImageData.adjustments.brightness}
                onChange={(e) => updateSelectedImageAdjustments({ brightness: parseInt(e.target.value) })}
                className="w-full h-1.5 accent-purple-500"
                onMouseDown={(e) => e.stopPropagation()}
              />
            </div>

            {/* Netteté */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Netteté</Label>
                <span className="text-xs text-muted-foreground">{selectedImageData.adjustments.sharpen}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={selectedImageData.adjustments.sharpen}
                onChange={(e) => updateSelectedImageAdjustments({ sharpen: parseInt(e.target.value) })}
                className="w-full h-1.5 accent-purple-500"
                onMouseDown={(e) => e.stopPropagation()}
              />
            </div>

            {/* Saturation */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Saturation</Label>
                <span className="text-xs text-muted-foreground">{selectedImageData.adjustments.saturate}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={selectedImageData.adjustments.saturate}
                onChange={(e) => updateSelectedImageAdjustments({ saturate: parseInt(e.target.value) })}
                className="w-full h-1.5 accent-purple-500"
                onMouseDown={(e) => e.stopPropagation()}
              />
            </div>

            <Separator className="my-2" />

            {/* Options binaires compactes */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">Noir et blanc</Label>
              <Switch
                checked={selectedImageData.adjustments.grayscale}
                onCheckedChange={(checked) => updateSelectedImageAdjustments({ grayscale: checked })}
                className="scale-75"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Négatif</Label>
              <Switch
                checked={selectedImageData.adjustments.invert}
                onCheckedChange={(checked) => updateSelectedImageAdjustments({ invert: checked })}
                className="scale-75"
              />
            </div>

            <Separator className="my-2" />

            {/* Presets rapides */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Presets</Label>
              <div className="grid grid-cols-3 gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() =>
                    updateSelectedImageAdjustments({
                      contrast: 140,
                      brightness: 110,
                      sharpen: 30,
                      saturate: 100,
                      grayscale: false,
                      invert: false,
                    })
                  }
                >
                  Contours+
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() =>
                    updateSelectedImageAdjustments({
                      contrast: 180,
                      brightness: 100,
                      sharpen: 50,
                      saturate: 0,
                      grayscale: true,
                      invert: false,
                    })
                  }
                >
                  N&B
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() =>
                    updateSelectedImageAdjustments({
                      contrast: 150,
                      brightness: 120,
                      sharpen: 40,
                      saturate: 100,
                      grayscale: false,
                      invert: true,
                    })
                  }
                >
                  Négatif
                </Button>
              </div>
            </div>

            {/* Bouton reset */}
            <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={resetImageAdjustments}>
              <RotateCw className="h-3 w-3 mr-1" />
              Réinitialiser
            </Button>
          </div>
        </div>
      )}

      {/* Dialogue de crop - draggable */}
      {showCropDialog && selectedImageData && (
        <div
          className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
          style={{
            left: cropPanelPos.x,
            top: cropPanelPos.y,
            width: 400,
          }}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest(".crop-canvas-container")) return;
            if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "BUTTON") return;
            setCropPanelDragging(true);
            setCropPanelDragStart({
              x: e.clientX - cropPanelPos.x,
              y: e.clientY - cropPanelPos.y,
            });
          }}
          onMouseMove={(e) => {
            if (cropPanelDragging) {
              setCropPanelPos({
                x: e.clientX - cropPanelDragStart.x,
                y: e.clientY - cropPanelDragStart.y,
              });
            }
          }}
          onMouseUp={() => setCropPanelDragging(false)}
          onMouseLeave={() => setCropPanelDragging(false)}
        >
          {/* Header draggable - vert pour crop */}
          <div className="flex items-center justify-between px-3 py-2 bg-green-600 text-white rounded-t-lg cursor-move">
            <div className="flex items-center gap-2">
              <Crop className="h-4 w-4" />
              <span className="text-sm font-medium">Recadrer l'image</span>
            </div>
            <button className="text-white/80 hover:text-white" onClick={() => setShowCropDialog(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Contenu */}
          <div className="p-3 space-y-3">
            {/* Canvas de preview avec zone de crop */}
            <div className="crop-canvas-container relative bg-gray-100 rounded overflow-hidden" style={{ height: 280 }}>
              <canvas
                ref={(canvas) => {
                  if (!canvas || !selectedImageData) return;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) return;

                  // selectedImageData.image est un BackgroundImage, .image.image est le HTMLImageElement
                  const sourceImage = selectedImageData.image.image;
                  if (!sourceImage || !sourceImage.complete || sourceImage.naturalWidth === 0) {
                    console.warn("Image not loaded yet");
                    return;
                  }

                  const aspectRatio = sourceImage.width / sourceImage.height;

                  // Calculer la taille du canvas pour afficher l'image
                  const maxWidth = 376;
                  const maxHeight = 260;
                  let canvasWidth, canvasHeight;

                  if (aspectRatio > maxWidth / maxHeight) {
                    canvasWidth = maxWidth;
                    canvasHeight = maxWidth / aspectRatio;
                  } else {
                    canvasHeight = maxHeight;
                    canvasWidth = maxHeight * aspectRatio;
                  }

                  canvas.width = canvasWidth;
                  canvas.height = canvasHeight;

                  // Dessiner l'image avec overlay sombre
                  ctx.drawImage(sourceImage, 0, 0, canvasWidth, canvasHeight);

                  // Overlay sombre sur toute l'image
                  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
                  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

                  // Zone de crop (claire)
                  const cropX = (cropSelection.x / 100) * canvasWidth;
                  const cropY = (cropSelection.y / 100) * canvasHeight;
                  const cropW = (cropSelection.width / 100) * canvasWidth;
                  const cropH = (cropSelection.height / 100) * canvasHeight;

                  // Effacer la zone de crop pour montrer l'image originale
                  ctx.save();
                  ctx.beginPath();
                  ctx.rect(cropX, cropY, cropW, cropH);
                  ctx.clip();
                  ctx.drawImage(sourceImage, 0, 0, canvasWidth, canvasHeight);
                  ctx.restore();

                  // Bordure de la zone de crop
                  ctx.strokeStyle = "#22c55e";
                  ctx.lineWidth = 2;
                  ctx.setLineDash([]);
                  ctx.strokeRect(cropX, cropY, cropW, cropH);

                  // Poignées de redimensionnement
                  const handleSize = 8;
                  ctx.fillStyle = "#22c55e";

                  // Coins
                  ctx.fillRect(cropX - handleSize / 2, cropY - handleSize / 2, handleSize, handleSize); // NW
                  ctx.fillRect(cropX + cropW - handleSize / 2, cropY - handleSize / 2, handleSize, handleSize); // NE
                  ctx.fillRect(cropX - handleSize / 2, cropY + cropH - handleSize / 2, handleSize, handleSize); // SW
                  ctx.fillRect(cropX + cropW - handleSize / 2, cropY + cropH - handleSize / 2, handleSize, handleSize); // SE

                  // Milieux
                  ctx.fillRect(cropX + cropW / 2 - handleSize / 2, cropY - handleSize / 2, handleSize, handleSize); // N
                  ctx.fillRect(
                    cropX + cropW / 2 - handleSize / 2,
                    cropY + cropH - handleSize / 2,
                    handleSize,
                    handleSize,
                  ); // S
                  ctx.fillRect(cropX - handleSize / 2, cropY + cropH / 2 - handleSize / 2, handleSize, handleSize); // W
                  ctx.fillRect(
                    cropX + cropW - handleSize / 2,
                    cropY + cropH / 2 - handleSize / 2,
                    handleSize,
                    handleSize,
                  ); // E
                }}
                onMouseDown={(e) => {
                  const canvas = e.currentTarget;
                  const rect = canvas.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  const canvasWidth = canvas.width;
                  const canvasHeight = canvas.height;

                  // Convertir en coordonnées de crop (%)
                  const cropX = (cropSelection.x / 100) * canvasWidth;
                  const cropY = (cropSelection.y / 100) * canvasHeight;
                  const cropW = (cropSelection.width / 100) * canvasWidth;
                  const cropH = (cropSelection.height / 100) * canvasHeight;

                  const handleSize = 12;

                  // Déterminer quelle partie est cliquée
                  let handle: typeof cropDragging = null;

                  // Coins
                  if (Math.abs(x - cropX) < handleSize && Math.abs(y - cropY) < handleSize) handle = "nw";
                  else if (Math.abs(x - (cropX + cropW)) < handleSize && Math.abs(y - cropY) < handleSize)
                    handle = "ne";
                  else if (Math.abs(x - cropX) < handleSize && Math.abs(y - (cropY + cropH)) < handleSize)
                    handle = "sw";
                  else if (Math.abs(x - (cropX + cropW)) < handleSize && Math.abs(y - (cropY + cropH)) < handleSize)
                    handle = "se";
                  // Milieux
                  else if (Math.abs(x - (cropX + cropW / 2)) < handleSize && Math.abs(y - cropY) < handleSize)
                    handle = "n";
                  else if (Math.abs(x - (cropX + cropW / 2)) < handleSize && Math.abs(y - (cropY + cropH)) < handleSize)
                    handle = "s";
                  else if (Math.abs(x - cropX) < handleSize && Math.abs(y - (cropY + cropH / 2)) < handleSize)
                    handle = "w";
                  else if (Math.abs(x - (cropX + cropW)) < handleSize && Math.abs(y - (cropY + cropH / 2)) < handleSize)
                    handle = "e";
                  // Déplacement
                  else if (x >= cropX && x <= cropX + cropW && y >= cropY && y <= cropY + cropH) handle = "move";

                  if (handle) {
                    setCropDragging(handle);
                    setCropDragStart({ x, y, crop: { ...cropSelection } });
                  }
                }}
                onMouseMove={(e) => {
                  if (!cropDragging) return;

                  const canvas = e.currentTarget;
                  const rect = canvas.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  const canvasWidth = canvas.width;
                  const canvasHeight = canvas.height;

                  const dx = ((x - cropDragStart.x) / canvasWidth) * 100;
                  const dy = ((y - cropDragStart.y) / canvasHeight) * 100;

                  let newCrop = { ...cropDragStart.crop };

                  switch (cropDragging) {
                    case "move":
                      newCrop.x = Math.max(0, Math.min(100 - newCrop.width, cropDragStart.crop.x + dx));
                      newCrop.y = Math.max(0, Math.min(100 - newCrop.height, cropDragStart.crop.y + dy));
                      break;
                    case "nw":
                      newCrop.x = Math.max(
                        0,
                        Math.min(cropDragStart.crop.x + cropDragStart.crop.width - 5, cropDragStart.crop.x + dx),
                      );
                      newCrop.y = Math.max(
                        0,
                        Math.min(cropDragStart.crop.y + cropDragStart.crop.height - 5, cropDragStart.crop.y + dy),
                      );
                      newCrop.width = cropDragStart.crop.width - (newCrop.x - cropDragStart.crop.x);
                      newCrop.height = cropDragStart.crop.height - (newCrop.y - cropDragStart.crop.y);
                      break;
                    case "ne":
                      newCrop.y = Math.max(
                        0,
                        Math.min(cropDragStart.crop.y + cropDragStart.crop.height - 5, cropDragStart.crop.y + dy),
                      );
                      newCrop.width = Math.max(5, Math.min(100 - newCrop.x, cropDragStart.crop.width + dx));
                      newCrop.height = cropDragStart.crop.height - (newCrop.y - cropDragStart.crop.y);
                      break;
                    case "sw":
                      newCrop.x = Math.max(
                        0,
                        Math.min(cropDragStart.crop.x + cropDragStart.crop.width - 5, cropDragStart.crop.x + dx),
                      );
                      newCrop.width = cropDragStart.crop.width - (newCrop.x - cropDragStart.crop.x);
                      newCrop.height = Math.max(5, Math.min(100 - newCrop.y, cropDragStart.crop.height + dy));
                      break;
                    case "se":
                      newCrop.width = Math.max(5, Math.min(100 - newCrop.x, cropDragStart.crop.width + dx));
                      newCrop.height = Math.max(5, Math.min(100 - newCrop.y, cropDragStart.crop.height + dy));
                      break;
                    case "n":
                      newCrop.y = Math.max(
                        0,
                        Math.min(cropDragStart.crop.y + cropDragStart.crop.height - 5, cropDragStart.crop.y + dy),
                      );
                      newCrop.height = cropDragStart.crop.height - (newCrop.y - cropDragStart.crop.y);
                      break;
                    case "s":
                      newCrop.height = Math.max(5, Math.min(100 - newCrop.y, cropDragStart.crop.height + dy));
                      break;
                    case "w":
                      newCrop.x = Math.max(
                        0,
                        Math.min(cropDragStart.crop.x + cropDragStart.crop.width - 5, cropDragStart.crop.x + dx),
                      );
                      newCrop.width = cropDragStart.crop.width - (newCrop.x - cropDragStart.crop.x);
                      break;
                    case "e":
                      newCrop.width = Math.max(5, Math.min(100 - newCrop.x, cropDragStart.crop.width + dx));
                      break;
                  }

                  setCropSelection(newCrop);
                }}
                onMouseUp={() => setCropDragging(null)}
                onMouseLeave={() => setCropDragging(null)}
                style={{ display: "block", margin: "auto", cursor: cropDragging ? "grabbing" : "crosshair" }}
              />
            </div>

            {/* Valeurs numériques */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <Label className="text-xs text-muted-foreground">X</Label>
                <Input
                  type="number"
                  min="0"
                  max="95"
                  value={cropSelection.x.toFixed(0)}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(100 - cropSelection.width, parseFloat(e.target.value) || 0));
                    setCropSelection((c) => ({ ...c, x: val }));
                  }}
                  className="h-7 text-xs"
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Y</Label>
                <Input
                  type="number"
                  min="0"
                  max="95"
                  value={cropSelection.y.toFixed(0)}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(100 - cropSelection.height, parseFloat(e.target.value) || 0));
                    setCropSelection((c) => ({ ...c, y: val }));
                  }}
                  className="h-7 text-xs"
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Largeur %</Label>
                <Input
                  type="number"
                  min="5"
                  max="100"
                  value={cropSelection.width.toFixed(0)}
                  onChange={(e) => {
                    const val = Math.max(5, Math.min(100 - cropSelection.x, parseFloat(e.target.value) || 5));
                    setCropSelection((c) => ({ ...c, width: val }));
                  }}
                  className="h-7 text-xs"
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Hauteur %</Label>
                <Input
                  type="number"
                  min="5"
                  max="100"
                  value={cropSelection.height.toFixed(0)}
                  onChange={(e) => {
                    const val = Math.max(5, Math.min(100 - cropSelection.y, parseFloat(e.target.value) || 5));
                    setCropSelection((c) => ({ ...c, height: val }));
                  }}
                  className="h-7 text-xs"
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => setCropSelection({ x: 0, y: 0, width: 100, height: 100 })}
              >
                <Maximize2 className="h-3 w-3 mr-1" />
                100%
              </Button>
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={resetCrop}>
                <RotateCw className="h-3 w-3 mr-1" />
                Reset
              </Button>
              <Button size="sm" className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700" onClick={applyCrop}>
                <Check className="h-3 w-3 mr-1" />
                Appliquer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Panneau modifier longueur - draggable */}
      {lineLengthDialog?.open &&
        (() => {
          const line = sketch.geometries.get(lineLengthDialog.lineId) as Line | undefined;
          const p1 = line ? sketch.points.get(line.p1) : undefined;
          const p2 = line ? sketch.points.get(line.p2) : undefined;

          return (
            <div
              className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
              style={{
                left: lineLengthPanelPos.x,
                top: lineLengthPanelPos.y,
                width: 220,
              }}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "BUTTON")
                  return;
                setLineLengthPanelDragging(true);
                setLineLengthPanelDragStart({
                  x: e.clientX - lineLengthPanelPos.x,
                  y: e.clientY - lineLengthPanelPos.y,
                });
              }}
              onMouseMove={(e) => {
                if (lineLengthPanelDragging) {
                  setLineLengthPanelPos({
                    x: e.clientX - lineLengthPanelDragStart.x,
                    y: e.clientY - lineLengthPanelDragStart.y,
                  });
                }
              }}
              onMouseUp={() => setLineLengthPanelDragging(false)}
              onMouseLeave={() => setLineLengthPanelDragging(false)}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-blue-500 text-white rounded-t-lg cursor-move">
                <span className="text-sm font-medium">📏 Longueur</span>
                <button
                  onClick={() => {
                    // Restaurer le sketch original
                    if (lineLengthDialog.originalSketch) {
                      setSketch(lineLengthDialog.originalSketch);
                    }
                    setLineLengthDialog(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Contenu */}
              <div className="p-2 space-y-2">
                {/* Longueur actuelle */}
                <div className="text-xs text-gray-500">Actuel: {lineLengthDialog.currentLength.toFixed(1)} mm</div>

                {/* Input nouvelle longueur */}
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={lineLengthDialog.newLength}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      const value = parseFloat(newValue);
                      // Appliquer en temps réel si valeur valide
                      if (!isNaN(value) && value > 0) {
                        applyLineLengthChange(lineLengthDialog.lineId, value, lineLengthDialog.anchorMode, false);
                      }
                      setLineLengthDialog({ ...lineLengthDialog, newLength: newValue });
                    }}
                    className="h-8 flex-1 text-sm"
                    min="0.1"
                    step="0.1"
                    autoFocus
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        const value = parseFloat(lineLengthDialog.newLength);
                        if (!isNaN(value) && value > 0) {
                          // Valider: ajouter à l'historique (utiliser sketchRef pour éviter closure stale)
                          addToHistory(sketchRef.current);
                          toast.success(`Longueur modifiée: ${value.toFixed(1)} mm`);
                          setLineLengthDialog(null);
                        }
                      }
                      if (e.key === "Escape") {
                        // Restaurer le sketch original
                        if (lineLengthDialog.originalSketch) {
                          setSketch(lineLengthDialog.originalSketch);
                        }
                        setLineLengthDialog(null);
                      }
                    }}
                  />
                  <span className="text-xs text-gray-500">mm</span>
                </div>

                {/* Boutons P1 / Centre / P2 */}
                <div className="flex gap-1">
                  <Button
                    variant={lineLengthDialog.anchorMode === "p1" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-7 text-xs px-1"
                    style={
                      lineLengthDialog.anchorMode === "p1"
                        ? { backgroundColor: "#10B981", borderColor: "#10B981" }
                        : { borderColor: "#10B981", color: "#10B981" }
                    }
                    onClick={() => {
                      const value = parseFloat(lineLengthDialog.newLength);
                      // Restaurer puis appliquer avec le nouveau mode
                      if (lineLengthDialog.originalSketch) {
                        setSketch(lineLengthDialog.originalSketch);
                        if (!isNaN(value) && value > 0) {
                          setTimeout(() => {
                            applyLineLengthChange(lineLengthDialog.lineId, value, "p1", false);
                          }, 0);
                        }
                      }
                      setLineLengthDialog({ ...lineLengthDialog, anchorMode: "p1" });
                    }}
                  >
                    P1 fixe
                  </Button>
                  <Button
                    variant={lineLengthDialog.anchorMode === "center" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-7 text-xs px-1"
                    onClick={() => {
                      const value = parseFloat(lineLengthDialog.newLength);
                      if (lineLengthDialog.originalSketch) {
                        setSketch(lineLengthDialog.originalSketch);
                        if (!isNaN(value) && value > 0) {
                          setTimeout(() => {
                            applyLineLengthChange(lineLengthDialog.lineId, value, "center", false);
                          }, 0);
                        }
                      }
                      setLineLengthDialog({ ...lineLengthDialog, anchorMode: "center" });
                    }}
                  >
                    Centre
                  </Button>
                  <Button
                    variant={lineLengthDialog.anchorMode === "p2" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-7 text-xs px-1"
                    style={
                      lineLengthDialog.anchorMode === "p2"
                        ? { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" }
                        : { borderColor: "#8B5CF6", color: "#8B5CF6" }
                    }
                    onClick={() => {
                      const value = parseFloat(lineLengthDialog.newLength);
                      if (lineLengthDialog.originalSketch) {
                        setSketch(lineLengthDialog.originalSketch);
                        if (!isNaN(value) && value > 0) {
                          setTimeout(() => {
                            applyLineLengthChange(lineLengthDialog.lineId, value, "p2", false);
                          }, 0);
                        }
                      }
                      setLineLengthDialog({ ...lineLengthDialog, anchorMode: "p2" });
                    }}
                  >
                    P2 fixe
                  </Button>
                </div>

                {/* Bouton valider */}
                <Button
                  size="sm"
                  className="w-full h-7"
                  onClick={() => {
                    const value = parseFloat(lineLengthDialog.newLength);
                    if (!isNaN(value) && value > 0) {
                      // Valider: ajouter à l'historique (utiliser sketchRef pour éviter closure stale)
                      addToHistory(sketchRef.current);
                      toast.success(`Longueur modifiée: ${value.toFixed(1)} mm`);
                      setLineLengthDialog(null);
                    }
                  }}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Appliquer
                </Button>
              </div>
            </div>
          );
        })()}

      {/* Panneau modifier angle - draggable */}
      {angleEditDialog?.open && (
        <div
          className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
          style={{
            left: anglePanelPos.x,
            top: anglePanelPos.y,
            width: 220,
          }}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "BUTTON") return;
            setAnglePanelDragging(true);
            setAnglePanelDragStart({ x: e.clientX - anglePanelPos.x, y: e.clientY - anglePanelPos.y });
          }}
          onMouseMove={(e) => {
            if (anglePanelDragging) {
              setAnglePanelPos({
                x: e.clientX - anglePanelDragStart.x,
                y: e.clientY - anglePanelDragStart.y,
              });
            }
          }}
          onMouseUp={() => setAnglePanelDragging(false)}
          onMouseLeave={() => setAnglePanelDragging(false)}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-orange-500 text-white rounded-t-lg cursor-move">
            <span className="text-sm font-medium">📐 Angle</span>
            <button
              onClick={() => {
                // Restaurer le sketch original
                if (angleEditDialog.originalSketch) {
                  setSketch(angleEditDialog.originalSketch);
                }
                setAngleEditDialog(null);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Contenu */}
          <div className="p-2 space-y-2">
            {/* Angle actuel */}
            <div className="text-xs text-gray-500">Actuel: {angleEditDialog.currentAngle.toFixed(1)}°</div>

            {/* Input nouvel angle */}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={angleEditDialog.newAngle}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const value = parseFloat(newValue);
                  // Appliquer en temps réel si valeur valide
                  if (!isNaN(value) && value > 0 && value < 180) {
                    applyAngleChange(
                      angleEditDialog.pointId,
                      angleEditDialog.line1Id,
                      angleEditDialog.line2Id,
                      value,
                      angleEditDialog.anchorMode,
                      false,
                    );
                  }
                  setAngleEditDialog({ ...angleEditDialog, newAngle: newValue });
                }}
                className="h-8 flex-1 text-sm"
                min="1"
                max="179"
                step="0.1"
                autoFocus
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    const value = parseFloat(angleEditDialog.newAngle);
                    if (!isNaN(value) && value > 0 && value < 180) {
                      // Valider: ajouter à l'historique (utiliser sketchRef pour éviter closure stale)
                      addToHistory(sketchRef.current);
                      toast.success(`Angle modifié: ${value.toFixed(1)}°`);
                      setAngleEditDialog(null);
                    }
                  }
                  if (e.key === "Escape") {
                    // Restaurer le sketch original
                    if (angleEditDialog.originalSketch) {
                      setSketch(angleEditDialog.originalSketch);
                    }
                    setAngleEditDialog(null);
                  }
                }}
              />
              <span className="text-xs text-gray-500">°</span>
            </div>

            {/* Boutons S1 / Sym / S2 */}
            <div className="flex gap-1">
              <Button
                variant={angleEditDialog.anchorMode === "line1" ? "default" : "outline"}
                size="sm"
                className="flex-1 h-7 text-xs px-1"
                style={
                  angleEditDialog.anchorMode === "line1"
                    ? { backgroundColor: "#10B981", borderColor: "#10B981" }
                    : { borderColor: "#10B981", color: "#10B981" }
                }
                onClick={() => {
                  const value = parseFloat(angleEditDialog.newAngle);
                  if (angleEditDialog.originalSketch) {
                    setSketch(angleEditDialog.originalSketch);
                    if (!isNaN(value) && value > 0 && value < 180) {
                      setTimeout(() => {
                        applyAngleChange(
                          angleEditDialog.pointId,
                          angleEditDialog.line1Id,
                          angleEditDialog.line2Id,
                          value,
                          "line1",
                          false,
                        );
                      }, 0);
                    }
                  }
                  setAngleEditDialog({ ...angleEditDialog, anchorMode: "line1" });
                }}
              >
                S1 fixe
              </Button>
              <Button
                variant={angleEditDialog.anchorMode === "symmetric" ? "default" : "outline"}
                size="sm"
                className="flex-1 h-7 text-xs px-1"
                onClick={() => {
                  const value = parseFloat(angleEditDialog.newAngle);
                  if (angleEditDialog.originalSketch) {
                    setSketch(angleEditDialog.originalSketch);
                    if (!isNaN(value) && value > 0 && value < 180) {
                      setTimeout(() => {
                        applyAngleChange(
                          angleEditDialog.pointId,
                          angleEditDialog.line1Id,
                          angleEditDialog.line2Id,
                          value,
                          "symmetric",
                          false,
                        );
                      }, 0);
                    }
                  }
                  setAngleEditDialog({ ...angleEditDialog, anchorMode: "symmetric" });
                }}
              >
                Sym
              </Button>
              <Button
                variant={angleEditDialog.anchorMode === "line2" ? "default" : "outline"}
                size="sm"
                className="flex-1 h-7 text-xs px-1"
                style={
                  angleEditDialog.anchorMode === "line2"
                    ? { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" }
                    : { borderColor: "#8B5CF6", color: "#8B5CF6" }
                }
                onClick={() => {
                  const value = parseFloat(angleEditDialog.newAngle);
                  if (angleEditDialog.originalSketch) {
                    setSketch(angleEditDialog.originalSketch);
                    if (!isNaN(value) && value > 0 && value < 180) {
                      setTimeout(() => {
                        applyAngleChange(
                          angleEditDialog.pointId,
                          angleEditDialog.line1Id,
                          angleEditDialog.line2Id,
                          value,
                          "line2",
                          false,
                        );
                      }, 0);
                    }
                  }
                  setAngleEditDialog({ ...angleEditDialog, anchorMode: "line2" });
                }}
              >
                S2 fixe
              </Button>
            </div>

            {/* Bouton valider */}
            <Button
              size="sm"
              className="w-full h-7"
              onClick={() => {
                const value = parseFloat(angleEditDialog.newAngle);
                if (!isNaN(value) && value > 0 && value < 180) {
                  // Valider: ajouter à l'historique (utiliser sketchRef pour éviter closure stale)
                  addToHistory(sketchRef.current);
                  toast.success(`Angle modifié: ${value.toFixed(1)}°`);
                  setAngleEditDialog(null);
                }
              }}
            >
              <Check className="h-3 w-3 mr-1" />
              Appliquer
            </Button>
          </div>
        </div>
      )}

      {/* Panneau Répétition / Array - draggable */}
      {arrayDialog?.open && (
        <div
          className="fixed bg-white rounded-lg shadow-xl border z-50 select-none"
          style={{
            left: arrayPanelPos.x,
            top: arrayPanelPos.y,
            width: 280,
          }}
          onMouseDown={(e) => {
            if (
              (e.target as HTMLElement).tagName === "INPUT" ||
              (e.target as HTMLElement).tagName === "BUTTON" ||
              (e.target as HTMLElement).tagName === "SELECT"
            )
              return;
            setArrayPanelDragging(true);
            setArrayPanelDragStart({ x: e.clientX - arrayPanelPos.x, y: e.clientY - arrayPanelPos.y });
          }}
          onMouseMove={(e) => {
            if (arrayPanelDragging) {
              setArrayPanelPos({
                x: e.clientX - arrayPanelDragStart.x,
                y: e.clientY - arrayPanelDragStart.y,
              });
            }
          }}
          onMouseUp={() => setArrayPanelDragging(false)}
          onMouseLeave={() => setArrayPanelDragging(false)}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-purple-500 text-white rounded-t-lg cursor-move">
            <span className="text-sm font-medium">
              <Grid3X3 className="h-4 w-4 inline mr-2" />
              Répétition / Array
            </span>
            <button onClick={() => setArrayDialog(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Type de répétition */}
          <div className="px-3 py-2 border-b">
            <div className="flex gap-1 flex-wrap">
              <Button
                variant={arrayDialog.type === "linear" ? "default" : "outline"}
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => setArrayDialog({ ...arrayDialog, type: "linear" })}
              >
                Linéaire
              </Button>
              <Button
                variant={arrayDialog.type === "grid" ? "default" : "outline"}
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => setArrayDialog({ ...arrayDialog, type: "grid" })}
              >
                Grille
              </Button>
              <Button
                variant={arrayDialog.type === "circular" ? "default" : "outline"}
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => setArrayDialog({ ...arrayDialog, type: "circular" })}
              >
                Circulaire
              </Button>
              <Button
                variant={arrayDialog.type === "checkerboard" ? "default" : "outline"}
                size="sm"
                className="flex-1 h-7 text-xs bg-gradient-to-r from-black via-white to-black bg-[length:20px_20px]"
                onClick={() => setArrayDialog({ ...arrayDialog, type: "checkerboard" })}
              >
                🏁 Damier
              </Button>
            </div>
          </div>

          {/* Contenu selon le type */}
          <div className="p-3 space-y-3">
            {arrayDialog.type === "linear" && (
              <>
                {/* Nombre de copies */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs w-20">Nombre :</Label>
                  <Input
                    type="number"
                    value={arrayDialog.linearCount ?? 3}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1) {
                        setArrayDialog({ ...arrayDialog, linearCount: val });
                      }
                    }}
                    className="h-7 flex-1 text-xs"
                    min="2"
                    max="100"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Direction */}
                <div className="space-y-1">
                  <Label className="text-xs">Direction :</Label>
                  <div className="flex gap-1 bg-gray-100 p-1 rounded">
                    <button
                      className={`flex-1 text-xs py-1.5 px-2 rounded transition-colors ${
                        (arrayDialog.linearDirection ?? "x") === "x"
                          ? "bg-white shadow text-purple-600 font-medium"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                      onClick={() => setArrayDialog({ ...arrayDialog, linearDirection: "x" })}
                    >
                      → Horizontal (X)
                    </button>
                    <button
                      className={`flex-1 text-xs py-1.5 px-2 rounded transition-colors ${
                        (arrayDialog.linearDirection ?? "x") === "y"
                          ? "bg-white shadow text-purple-600 font-medium"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                      onClick={() => setArrayDialog({ ...arrayDialog, linearDirection: "y" })}
                    >
                      ↓ Vertical (Y)
                    </button>
                    <button
                      className={`flex-1 text-xs py-1.5 px-2 rounded transition-colors ${
                        (arrayDialog.linearDirection ?? "x") === "custom"
                          ? "bg-white shadow text-purple-600 font-medium"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                      onClick={() => setArrayDialog({ ...arrayDialog, linearDirection: "custom" })}
                    >
                      ∠ Angle
                    </button>
                  </div>
                </div>

                {/* Angle personnalisé */}
                {(arrayDialog.linearDirection ?? "x") === "custom" && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-20">Angle :</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={arrayDialog.linearAngle ?? "0"}
                      onChange={(e) =>
                        setArrayDialog({ ...arrayDialog, linearAngle: e.target.value.replace(/[^0-9.,\-]/g, "") })
                      }
                      className="h-7 flex-1 text-xs"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <span className="text-xs text-gray-500">°</span>
                  </div>
                )}

                {/* Toggle espacement / distance */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded">
                  <button
                    className={`flex-1 text-xs py-1 px-2 rounded transition-colors ${
                      (arrayDialog.linearSpacingMode ?? "spacing") === "spacing"
                        ? "bg-white shadow text-purple-600 font-medium"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setArrayDialog({ ...arrayDialog, linearSpacingMode: "spacing" })}
                  >
                    Espacement
                  </button>
                  <button
                    className={`flex-1 text-xs py-1 px-2 rounded transition-colors ${
                      (arrayDialog.linearSpacingMode ?? "spacing") === "distance"
                        ? "bg-white shadow text-purple-600 font-medium"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setArrayDialog({ ...arrayDialog, linearSpacingMode: "distance" })}
                  >
                    Distance totale
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs w-20">
                    {(arrayDialog.linearSpacingMode ?? "spacing") === "spacing" ? "Espacement :" : "Distance :"}
                  </Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={arrayDialog.linearSpacing ?? "50"}
                    onChange={(e) =>
                      setArrayDialog({ ...arrayDialog, linearSpacing: e.target.value.replace(/[^0-9.,\-]/g, "") })
                    }
                    className="h-7 flex-1 text-xs"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <span className="text-xs text-gray-500">mm</span>
                </div>

                {/* Info calculée */}
                {(arrayDialog.linearSpacingMode ?? "spacing") === "distance" && (arrayDialog.linearCount ?? 3) > 1 && (
                  <div className="text-xs text-gray-500 text-center bg-gray-50 py-1 rounded">
                    Espacement réel :{" "}
                    {(
                      (parseFloat(String(arrayDialog.linearSpacing ?? "50").replace(",", ".")) || 0) /
                      ((arrayDialog.linearCount ?? 3) - 1)
                    ).toFixed(1)}{" "}
                    mm
                  </div>
                )}

                {(arrayDialog.linearSpacingMode ?? "spacing") === "spacing" && (arrayDialog.linearCount ?? 3) > 1 && (
                  <div className="text-xs text-gray-500 text-center bg-gray-50 py-1 rounded">
                    Distance totale :{" "}
                    {(
                      (parseFloat(String(arrayDialog.linearSpacing ?? "50").replace(",", ".")) || 0) *
                      ((arrayDialog.linearCount ?? 3) - 1)
                    ).toFixed(1)}{" "}
                    mm
                  </div>
                )}
              </>
            )}

            {arrayDialog.type === "grid" && (
              <>
                {/* Colonnes (X) */}
                <div className="space-y-2 p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-20">Colonnes :</Label>
                    <Input
                      type="number"
                      value={arrayDialog.countX}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1) {
                          setArrayDialog({ ...arrayDialog, countX: val });
                        }
                      }}
                      className="h-7 w-16 text-xs"
                      min="1"
                      max="50"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-1 flex-1">
                      <button
                        className={`flex-1 text-[10px] py-0.5 px-1 rounded ${
                          arrayDialog.spacingModeX === "spacing" ? "bg-purple-500 text-white" : "bg-gray-200"
                        }`}
                        onClick={() => setArrayDialog({ ...arrayDialog, spacingModeX: "spacing" })}
                      >
                        Esp.
                      </button>
                      <button
                        className={`flex-1 text-[10px] py-0.5 px-1 rounded ${
                          arrayDialog.spacingModeX === "distance" ? "bg-purple-500 text-white" : "bg-gray-200"
                        }`}
                        onClick={() => setArrayDialog({ ...arrayDialog, spacingModeX: "distance" })}
                      >
                        Dist.
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-20">
                      {arrayDialog.spacingModeX === "spacing" ? "Esp. X :" : "Dist. X :"}
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={arrayDialog.spacingX}
                      onChange={(e) =>
                        setArrayDialog({ ...arrayDialog, spacingX: e.target.value.replace(/[^0-9.,\-]/g, "") })
                      }
                      className="h-7 flex-1 text-xs"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <span className="text-xs text-gray-500">mm</span>
                  </div>
                </div>

                {/* Lignes (Y) */}
                <div className="space-y-2 p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-20">Lignes :</Label>
                    <Input
                      type="number"
                      value={arrayDialog.countY}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1) {
                          setArrayDialog({ ...arrayDialog, countY: val });
                        }
                      }}
                      className="h-7 w-16 text-xs"
                      min="1"
                      max="50"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-1 flex-1">
                      <button
                        className={`flex-1 text-[10px] py-0.5 px-1 rounded ${
                          arrayDialog.spacingModeY === "spacing" ? "bg-purple-500 text-white" : "bg-gray-200"
                        }`}
                        onClick={() => setArrayDialog({ ...arrayDialog, spacingModeY: "spacing" })}
                      >
                        Esp.
                      </button>
                      <button
                        className={`flex-1 text-[10px] py-0.5 px-1 rounded ${
                          arrayDialog.spacingModeY === "distance" ? "bg-purple-500 text-white" : "bg-gray-200"
                        }`}
                        onClick={() => setArrayDialog({ ...arrayDialog, spacingModeY: "distance" })}
                      >
                        Dist.
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-20">
                      {arrayDialog.spacingModeY === "spacing" ? "Esp. Y :" : "Dist. Y :"}
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={arrayDialog.spacingY}
                      onChange={(e) =>
                        setArrayDialog({ ...arrayDialog, spacingY: e.target.value.replace(/[^0-9.,\-]/g, "") })
                      }
                      className="h-7 flex-1 text-xs"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <span className="text-xs text-gray-500">mm</span>
                  </div>
                </div>

                <div className="text-xs text-gray-500 text-center bg-purple-50 py-1 rounded">
                  Total: {arrayDialog.countX * arrayDialog.countY} éléments
                </div>
              </>
            )}

            {arrayDialog.type === "circular" && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-xs w-20">Nombre :</Label>
                  <Input
                    type="number"
                    value={arrayDialog.circularCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 2) {
                        setArrayDialog({ ...arrayDialog, circularCount: val });
                      }
                    }}
                    className="h-7 flex-1 text-xs"
                    min="2"
                    max="100"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs w-20">Angle total :</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={arrayDialog.circularAngle}
                    onChange={(e) =>
                      setArrayDialog({ ...arrayDialog, circularAngle: e.target.value.replace(/[^0-9.,\-]/g, "") })
                    }
                    className="h-7 flex-1 text-xs"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <span className="text-xs text-gray-500">°</span>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 py-1 px-2 rounded">
                  Pas angulaire:{" "}
                  {(
                    (parseFloat(String(arrayDialog.circularAngle).replace(",", ".")) || 360) / arrayDialog.circularCount
                  ).toFixed(1)}
                  °
                </div>
                {arrayDialog.circularCenter && (
                  <div className="text-xs text-gray-400">
                    Centre: ({arrayDialog.circularCenter.x.toFixed(0)}, {arrayDialog.circularCenter.y.toFixed(0)})
                  </div>
                )}
              </>
            )}

            {/* Mode Damier (Mire de calibrage) */}
            {arrayDialog.type === "checkerboard" && (
              <>
                <div className="bg-purple-50 border border-purple-200 rounded p-2 mb-2">
                  <div className="text-xs text-purple-700 font-medium flex items-center gap-1">
                    🏁 Mire de calibrage
                  </div>
                  <div className="text-[10px] text-purple-600 mt-1">Crée un damier pour la calibration photo</div>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs w-24">Cases en X :</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={arrayDialog.checkerCountX ?? "8"}
                    onChange={(e) =>
                      setArrayDialog({ ...arrayDialog, checkerCountX: e.target.value.replace(/[^0-9]/g, "") })
                    }
                    className="h-7 flex-1 text-xs"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs w-24">Cases en Y :</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={arrayDialog.checkerCountY ?? "6"}
                    onChange={(e) =>
                      setArrayDialog({ ...arrayDialog, checkerCountY: e.target.value.replace(/[^0-9]/g, "") })
                    }
                    className="h-7 flex-1 text-xs"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs w-24">Taille case :</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={arrayDialog.checkerSize ?? "20"}
                    onChange={(e) =>
                      setArrayDialog({ ...arrayDialog, checkerSize: e.target.value.replace(/[^0-9.,]/g, "") })
                    }
                    className="h-7 flex-1 text-xs"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <span className="text-xs text-gray-500">mm</span>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs w-24">Couleur :</Label>
                  <input
                    type="color"
                    value={arrayDialog.checkerColor ?? "#000000"}
                    onChange={(e) => setArrayDialog({ ...arrayDialog, checkerColor: e.target.value })}
                    className="h-7 w-10 rounded cursor-pointer"
                  />
                  <span className="text-xs text-gray-500 flex-1">{arrayDialog.checkerColor ?? "#000000"}</span>
                </div>

                {/* Dimensions totales calculées */}
                <div className="bg-gray-50 rounded p-2 space-y-1">
                  <div className="text-xs text-gray-600 font-medium">Dimensions totales :</div>
                  <div className="text-xs text-gray-500">
                    {(
                      (parseInt(String(arrayDialog.checkerCountX ?? "8")) || 8) *
                      (parseFloat(String(arrayDialog.checkerSize ?? "20").replace(",", ".")) || 20)
                    ).toFixed(1)}{" "}
                    ×{" "}
                    {(
                      (parseInt(String(arrayDialog.checkerCountY ?? "6")) || 6) *
                      (parseFloat(String(arrayDialog.checkerSize ?? "20").replace(",", ".")) || 20)
                    ).toFixed(1)}{" "}
                    mm
                  </div>
                  <div className="text-xs text-gray-400">
                    Points intérieurs: {Math.max(0, (parseInt(String(arrayDialog.checkerCountX ?? "8")) || 8) - 1)} ×{" "}
                    {Math.max(0, (parseInt(String(arrayDialog.checkerCountY ?? "6")) || 6) - 1)} ={" "}
                    {Math.max(0, (parseInt(String(arrayDialog.checkerCountX ?? "8")) || 8) - 1) *
                      Math.max(0, (parseInt(String(arrayDialog.checkerCountY ?? "6")) || 6) - 1)}
                  </div>
                </div>
              </>
            )}

            {/* Option: inclure l'original (masqué pour damier) */}
            {arrayDialog.type !== "checkerboard" && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={arrayDialog.includeOriginal}
                  onChange={(e) => setArrayDialog({ ...arrayDialog, includeOriginal: e.target.checked })}
                  className="h-3 w-3"
                />
                Inclure l'original dans le compte
              </label>
            )}

            {/* Option: créer les intersections */}
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={arrayDialog.createIntersections ?? true}
                onChange={(e) => setArrayDialog({ ...arrayDialog, createIntersections: e.target.checked })}
                className="h-3 w-3"
              />
              Créer les points d'intersection
            </label>

            {/* Boutons */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => setArrayDialog(null)}>
                Annuler
              </Button>
              <Button size="sm" className="flex-1 h-8 bg-purple-500 hover:bg-purple-600" onClick={executeArray}>
                <Check className="h-3 w-3 mr-1" />
                Appliquer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Input texte inline sur le canvas */}
      {textInput?.active && (
        <input
          ref={textInputRef}
          type="text"
          value={textInput.content}
          onChange={(e) => setTextInput({ ...textInput, content: e.target.value })}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              if (textInput.content.trim()) {
                commitTextInput();
              } else {
                setTextInput(null);
              }
            } else if (e.key === "Escape") {
              setTextInput(null);
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="fixed bg-white border-2 border-emerald-500 rounded px-2 py-1 text-sm shadow-lg z-[9999] min-w-[150px] outline-none"
          style={{
            left: textInput.screenPos.x,
            top: textInput.screenPos.y,
            fontSize: `${Math.max(14, textFontSize * viewport.scale)}px`,
            color: textColor,
          }}
          placeholder="Texte... (Entrée pour valider)"
        />
      )}

      {/* Menu contextuel */}
      {contextMenu &&
        (() => {
          // v7.35: Calculer la position ajustée pour éviter le débordement hors écran
          const menuWidth = 180; // Largeur estimée du menu (réduit)
          const menuHeight = contextMenu.entityType === "image" ? 280 : 150; // Hauteur estimée (menu compact)
          const padding = 10; // Marge par rapport aux bords

          let adjustedX = contextMenu.x;
          let adjustedY = contextMenu.y;

          // Ajuster horizontalement si le menu dépasse à droite
          if (contextMenu.x + menuWidth > window.innerWidth - padding) {
            adjustedX = window.innerWidth - menuWidth - padding;
          }
          // Ajuster horizontalement si le menu dépasse à gauche
          if (adjustedX < padding) {
            adjustedX = padding;
          }

          // Ajuster verticalement si le menu dépasse en bas
          if (contextMenu.y + menuHeight > window.innerHeight - padding) {
            adjustedY = window.innerHeight - menuHeight - padding;
          }
          // Ajuster verticalement si le menu dépasse en haut
          if (adjustedY < padding) {
            adjustedY = padding;
          }

          return (
            <div
              className="fixed bg-white rounded-lg shadow-xl border z-[100] py-1 min-w-[160px] max-h-[90vh] overflow-y-auto"
              style={{ left: adjustedX, top: adjustedY }}
              onClick={() => setContextMenu(null)}
            >
              {contextMenu.entityType === "arc" &&
                (() => {
                  const arc = sketch.geometries.get(contextMenu.entityId) as Arc | undefined;
                  const isFillet = arc?.isFillet === true;
                  return (
                    <>
                      {isFillet ? (
                        <button
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                          onClick={() => {
                            removeFilletFromArc(contextMenu.entityId);
                            setContextMenu(null);
                          }}
                        >
                          <RotateCcw className="h-4 w-4 text-red-500" />
                          Supprimer le congé
                        </button>
                      ) : (
                        <button
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                          onClick={() => {
                            // Supprimer simplement l'arc sans restaurer de coin
                            const newSketch: Sketch = {
                              ...sketch,
                              points: new Map(sketch.points),
                              geometries: new Map(sketch.geometries),
                              layers: new Map(sketch.layers),
                              constraints: new Map(sketch.constraints),
                            };
                            newSketch.geometries.delete(contextMenu.entityId);
                            // Ne pas supprimer les points car ils peuvent être utilisés par d'autres géométries
                            setSketch(newSketch);
                            addToHistory(newSketch);
                            toast.success("Arc supprimé");
                            setContextMenu(null);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                          Supprimer
                        </button>
                      )}
                      <button
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => {
                          setArcEditDialog({
                            open: true,
                            arcId: contextMenu.entityId,
                            currentRadius: arc?.radius || 0,
                          });
                          setContextMenu(null);
                        }}
                      >
                        <Settings className="h-4 w-4 text-blue-500" />
                        Modifier le rayon
                      </button>
                    </>
                  );
                })()}
              {contextMenu.entityType === "line" &&
                (() => {
                  // Utiliser sketchRef.current pour éviter les closures stales
                  const currentSketch = sketchRef.current;
                  const line = currentSketch.geometries.get(contextMenu.entityId) as Line | undefined;
                  const p1 = line ? currentSketch.points.get(line.p1) : undefined;
                  const p2 = line ? currentSketch.points.get(line.p2) : undefined;
                  const currentLength = p1 && p2 ? distance(p1, p2) / currentSketch.scaleFactor : 0;

                  return (
                    <>
                      <button
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => {
                          setSelectedEntities(new Set([contextMenu.entityId]));
                          setContextMenu(null);
                        }}
                      >
                        <MousePointer className="h-4 w-4" />
                        Sélectionner
                      </button>
                      <button
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => {
                          // Fermer les autres panneaux d'édition
                          closeAllEditPanels("lineLength");
                          setLineLengthPanelPos({ x: contextMenu.x + 10, y: contextMenu.y });
                          setLineLengthDialog({
                            open: true,
                            lineId: contextMenu.entityId,
                            currentLength: currentLength,
                            newLength: currentLength.toFixed(1),
                            anchorMode: "center",
                            // Utiliser sketchRef.current pour éviter les closures stales
                            originalSketch: {
                              ...sketchRef.current,
                              points: new Map(sketchRef.current.points),
                              geometries: new Map(sketchRef.current.geometries),
                              layers: new Map(sketchRef.current.layers),
                              constraints: new Map(sketchRef.current.constraints),
                            },
                          });
                          setContextMenu(null);
                        }}
                      >
                        <Ruler className="h-4 w-4 text-blue-500" />
                        Modifier la longueur
                      </button>
                      <button
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
                        onClick={() => {
                          setSelectedEntities(new Set([contextMenu.entityId]));
                          deleteSelectedEntities();
                          setContextMenu(null);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                      </button>
                    </>
                  );
                })()}
              {(contextMenu.entityType === "circle" || contextMenu.entityType === "bezier") && (
                <button
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
                  onClick={() => {
                    setSelectedEntities(new Set([contextMenu.entityId]));
                    deleteSelectedEntities();
                    setContextMenu(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              )}
              {/* FIX #90: Menu contextuel pour les images - v7.35: version compacte */}
              {contextMenu.entityType === "image" &&
                (() => {
                  const image = backgroundImages.find((img) => img.id === contextMenu.entityId);
                  if (!image) return null;
                  const currentLayer = sketch.layers.get(image.layerId || "");
                  const multiCount = selectedImageIds.size > 1 ? selectedImageIds.size : 0;
                  const imagesToUpdate = multiCount > 0 ? selectedImageIds : new Set([contextMenu.entityId]);

                  return (
                    <>
                      {/* Bouton détacher en haut */}
                      <button
                        className="w-full px-2 py-1 text-left text-xs hover:bg-blue-50 flex items-center gap-1.5 text-blue-600 border-b"
                        onClick={() => {
                          setImageToolsModalPos({ x: contextMenu.x, y: contextMenu.y });
                          setShowImageToolsModal(true);
                          setContextMenu(null);
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Détacher le menu
                      </button>
                      {/* Ligne d'actions rapides groupées */}
                      <div className="flex items-center justify-around px-2 py-1 border-b">
                        <button
                          className="p-1.5 rounded hover:bg-gray-100"
                          title={image.locked ? "Déverrouiller" : "Verrouiller"}
                          onClick={() => {
                            setBackgroundImages((prev) =>
                              prev.map((img) =>
                                img.id === contextMenu.entityId ? { ...img, locked: !img.locked } : img,
                              ),
                            );
                            toast.success(image.locked ? "Déverrouillée" : "Verrouillée");
                            setContextMenu(null);
                          }}
                        >
                          {image.locked ? (
                            <Unlock className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Lock className="h-3.5 w-3.5 text-orange-500" />
                          )}
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-gray-100"
                          title={image.visible ? "Masquer" : "Afficher"}
                          onClick={() => {
                            setBackgroundImages((prev) =>
                              prev.map((img) =>
                                img.id === contextMenu.entityId ? { ...img, visible: !img.visible } : img,
                              ),
                            );
                            toast.success(image.visible ? "Masquée" : "Affichée");
                            setContextMenu(null);
                          }}
                        >
                          {image.visible ? (
                            <EyeOff className="h-3.5 w-3.5 text-gray-500" />
                          ) : (
                            <Eye className="h-3.5 w-3.5 text-blue-500" />
                          )}
                        </button>
                        <button
                          className={`p-1.5 rounded hover:bg-gray-100 ${currentLayer?.solo ? "bg-yellow-100" : ""}`}
                          title={currentLayer?.solo ? "Désactiver solo" : "Isoler (Solo)"}
                          onClick={() => {
                            if (!currentLayer) return;
                            setSketch((prev) => {
                              const newLayers = new Map(prev.layers);
                              const isCurrentlySolo = currentLayer.solo;
                              newLayers.forEach((l, id) => {
                                newLayers.set(id, { ...l, solo: isCurrentlySolo ? false : id === currentLayer.id });
                              });
                              return { ...prev, layers: newLayers };
                            });
                            toast.success(currentLayer.solo ? "Solo désactivé" : `"${currentLayer.name}" isolé`);
                            setContextMenu(null);
                          }}
                        >
                          <Focus
                            className={`h-3.5 w-3.5 ${currentLayer?.solo ? "text-yellow-600" : "text-yellow-500"}`}
                          />
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-gray-100"
                          title="Premier plan"
                          onClick={() => {
                            setBackgroundImages((prev) => {
                              const maxOrder = Math.max(...prev.map((img) => img.order), 0);
                              let nextOrder = maxOrder + 1;
                              return prev.map((img) =>
                                imagesToUpdate.has(img.id) ? { ...img, order: nextOrder++ } : img,
                              );
                            });
                            toast.success(multiCount > 0 ? `${multiCount} photos ↑` : "↑ Premier plan");
                            setContextMenu(null);
                          }}
                        >
                          <ArrowUpToLine className="h-3.5 w-3.5 text-blue-500" />
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-gray-100"
                          title="Arrière-plan"
                          onClick={() => {
                            setBackgroundImages((prev) => {
                              const minOrder = Math.min(...prev.map((img) => img.order), 0);
                              let nextOrder = minOrder - imagesToUpdate.size;
                              return prev.map((img) =>
                                imagesToUpdate.has(img.id) ? { ...img, order: nextOrder++ } : img,
                              );
                            });
                            toast.success(multiCount > 0 ? `${multiCount} photos ↓` : "↓ Arrière-plan");
                            setContextMenu(null);
                          }}
                        >
                          <ArrowDownToLine className="h-3.5 w-3.5 text-orange-500" />
                        </button>
                        <button
                          className={`p-1.5 rounded hover:bg-gray-100 ${image.blendMode === "stripes" ? "bg-cyan-100" : ""}`}
                          title={image.blendMode === "stripes" ? "Mode normal" : "Mode rayures (alignement)"}
                          onClick={() => {
                            setBackgroundImages((prev) =>
                              prev.map((img) =>
                                imagesToUpdate.has(img.id)
                                  ? { ...img, blendMode: img.blendMode === "stripes" ? "normal" : "stripes" }
                                  : img,
                              ),
                            );
                            toast.success(image.blendMode === "stripes" ? "Mode normal" : "Mode rayures");
                            setContextMenu(null);
                          }}
                        >
                          <SlidersHorizontal
                            className={`h-3.5 w-3.5 ${image.blendMode === "stripes" ? "text-cyan-600" : "text-cyan-500"}`}
                          />
                        </button>
                      </div>
                      {/* Opacité compacte */}
                      <div className="px-2 py-1 flex items-center gap-2">
                        <Contrast className="h-3 w-3 text-purple-500 flex-shrink-0" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round(image.opacity * 100)}
                          onChange={(e) => {
                            const newOpacity = parseInt(e.target.value) / 100;
                            setBackgroundImages((prev) =>
                              prev.map((img) => (imagesToUpdate.has(img.id) ? { ...img, opacity: newOpacity } : img)),
                            );
                          }}
                          className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-[10px] text-gray-500 w-7 text-right">
                          {Math.round(image.opacity * 100)}%
                        </span>
                        <button
                          className="p-0.5 rounded hover:bg-gray-200"
                          title="Réinitialiser opacité"
                          onClick={() => {
                            setBackgroundImages((prev) =>
                              prev.map((img) => (imagesToUpdate.has(img.id) ? { ...img, opacity: 1 } : img)),
                            );
                            toast.success("Opacité: 100%");
                            setContextMenu(null);
                          }}
                        >
                          <RotateCcw className="h-3 w-3 text-gray-400" />
                        </button>
                      </div>
                      <div className="border-t my-0.5" />
                      {/* Actions principales */}
                      <button
                        className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 flex items-center gap-1.5"
                        onClick={() => {
                          setSelectedImageId(contextMenu.entityId);
                          setSelectedImageIds(new Set([contextMenu.entityId]));
                          setShowCalibrationPanel(true);
                          setContextMenu(null);
                        }}
                      >
                        <Ruler className="h-3 w-3 text-cyan-500" />
                        Calibrer
                      </button>
                      <button
                        className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 flex items-center gap-1.5"
                        onClick={() => {
                          moveImageToNewLayer(contextMenu.entityId);
                          setContextMenu(null);
                        }}
                      >
                        <Layers className="h-3 w-3 text-blue-500" />
                        Nouveau calque
                      </button>
                      {/* Sous-menu calques - utilise un state pour afficher/masquer */}
                      {sketch.layers.size > 1 && (
                        <div
                          className="relative"
                          onMouseEnter={(e) => {
                            const submenu = e.currentTarget.querySelector("[data-submenu]") as HTMLElement;
                            if (submenu) submenu.style.display = "block";
                          }}
                          onMouseLeave={(e) => {
                            const submenu = e.currentTarget.querySelector("[data-submenu]") as HTMLElement;
                            if (submenu) submenu.style.display = "none";
                          }}
                        >
                          <button className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 flex items-center gap-1.5 justify-between">
                            <span className="flex items-center gap-1.5">
                              <ArrowRight className="h-3 w-3 text-gray-500" />
                              Vers calque
                            </span>
                            <ChevronRight className="h-2.5 w-2.5" />
                          </button>
                          <div
                            data-submenu
                            className="fixed bg-white rounded shadow-xl border py-0.5 min-w-[100px] z-[10001]"
                            style={{
                              display: "none",
                              left: contextMenu.x + 180,
                              top: contextMenu.y + 80,
                            }}
                          >
                            {Array.from(sketch.layers.values())
                              .filter((layer) => layer.id !== image.layerId)
                              .map((layer) => (
                                <button
                                  key={layer.id}
                                  className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 flex items-center gap-1.5 whitespace-nowrap"
                                  onClick={() => {
                                    setBackgroundImages((prev) =>
                                      prev.map((img) =>
                                        img.id === contextMenu.entityId ? { ...img, layerId: layer.id } : img,
                                      ),
                                    );
                                    toast.success(`→ "${layer.name}"`);
                                    setContextMenu(null);
                                  }}
                                >
                                  <div
                                    className="w-2 h-2 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: layer.color }}
                                  />
                                  {layer.name}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                      <div className="border-t my-0.5" />
                      <button
                        className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 flex items-center gap-1.5 text-red-600"
                        onClick={() => {
                          addToImageHistory(backgroundImages, markerLinks);
                          const imageIdToDelete = contextMenu.entityId;
                          setBackgroundImages((prev) => prev.filter((img) => img.id !== imageIdToDelete));
                          setMarkerLinks((links) =>
                            links.filter(
                              (link) =>
                                link.marker1.imageId !== imageIdToDelete && link.marker2.imageId !== imageIdToDelete,
                            ),
                          );
                          if (selectedImageId === imageIdToDelete) setSelectedImageId(null);
                          const newSelectedIds = new Set(selectedImageIds);
                          newSelectedIds.delete(imageIdToDelete);
                          setSelectedImageIds(newSelectedIds);
                          toast.success("Supprimée");
                          setContextMenu(null);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                        Supprimer
                      </button>
                      {/* Info calque compact */}
                      {currentLayer && (
                        <div className="px-2 py-0.5 text-[10px] text-gray-400 border-t flex items-center gap-1">
                          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: currentLayer.color }} />
                          {currentLayer.name}
                        </div>
                      )}
                    </>
                  );
                })()}
              {contextMenu.entityType === "point" && (
                <button
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => {
                    const pointId = contextMenu.entityId;
                    setLockedPoints((prev) => {
                      const newSet = new Set(prev);
                      if (newSet.has(pointId)) {
                        newSet.delete(pointId);
                        toast.success("Point déverrouillé");
                      } else {
                        newSet.add(pointId);
                        toast.success("Point verrouillé");
                      }
                      return newSet;
                    });
                    setContextMenu(null);
                  }}
                >
                  {lockedPoints.has(contextMenu.entityId) ? (
                    <>
                      <Unlock className="h-4 w-4 text-green-500" />
                      Déverrouiller le point
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 text-orange-500" />
                      Verrouiller le point
                    </>
                  )}
                </button>
              )}
              {contextMenu.entityType === "corner" &&
                (() => {
                  // Trouver les lignes connectées à ce point - utiliser sketchRef.current
                  const currentSketch = sketchRef.current;
                  const pointId = contextMenu.entityId;
                  const point = currentSketch.points.get(pointId);
                  const connectedLines: Line[] = [];
                  currentSketch.geometries.forEach((geo) => {
                    if (geo.type === "line") {
                      const line = geo as Line;
                      if (line.p1 === pointId || line.p2 === pointId) {
                        connectedLines.push(line);
                      }
                    }
                  });

                  if (connectedLines.length < 2 || !point) return null;

                  // Calculer l'angle entre les deux premières lignes
                  const line1 = connectedLines[0];
                  const line2 = connectedLines[1];
                  const other1Id = line1.p1 === pointId ? line1.p2 : line1.p1;
                  const other2Id = line2.p1 === pointId ? line2.p2 : line2.p1;
                  const other1 = currentSketch.points.get(other1Id);
                  const other2 = currentSketch.points.get(other2Id);

                  if (!other1 || !other2) return null;

                  const dir1 = { x: other1.x - point.x, y: other1.y - point.y };
                  const dir2 = { x: other2.x - point.x, y: other2.y - point.y };
                  const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
                  const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);
                  const dot = (dir1.x * dir2.x + dir1.y * dir2.y) / (len1 * len2);
                  const currentAngle = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;

                  return (
                    <>
                      {/* Option verrouillage du point */}
                      <button
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => {
                          setLockedPoints((prev) => {
                            const newSet = new Set(prev);
                            if (newSet.has(pointId)) {
                              newSet.delete(pointId);
                              toast.success("Point déverrouillé");
                            } else {
                              newSet.add(pointId);
                              toast.success("Point verrouillé");
                            }
                            return newSet;
                          });
                          setContextMenu(null);
                        }}
                      >
                        {lockedPoints.has(pointId) ? (
                          <>
                            <Unlock className="h-4 w-4 text-green-500" />
                            Déverrouiller le point
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4 text-orange-500" />
                            Verrouiller le point
                          </>
                        )}
                      </button>
                      {/* Option modifier l'angle */}
                      <button
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => {
                          // Fermer les autres panneaux d'édition
                          closeAllEditPanels("angle");
                          setAnglePanelPos({ x: contextMenu.x + 10, y: contextMenu.y });
                          setAngleEditDialog({
                            open: true,
                            pointId: pointId,
                            line1Id: line1.id,
                            line2Id: line2.id,
                            currentAngle: currentAngle,
                            newAngle: currentAngle.toFixed(1),
                            anchorMode: "symmetric",
                            // Utiliser sketchRef.current pour éviter les closures stales
                            originalSketch: {
                              ...sketchRef.current,
                              points: new Map(sketchRef.current.points),
                              geometries: new Map(sketchRef.current.geometries),
                              layers: new Map(sketchRef.current.layers),
                              constraints: new Map(sketchRef.current.constraints),
                            },
                          });
                          setContextMenu(null);
                        }}
                      >
                        <Sliders className="h-4 w-4 text-orange-500" />
                        Modifier l'angle ({currentAngle.toFixed(1)}°)
                      </button>
                    </>
                  );
                })()}
              {/* Menu pour formes fermées (remplissage/hachures) */}
              {contextMenu.entityType === "closedShape" && contextMenu.shapeGeoIds && contextMenu.shapePath && (
                <>
                  <button
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    onClick={() => {
                      if (contextMenu.shapeGeoIds && contextMenu.shapePath) {
                        openFillDialog(contextMenu.shapeGeoIds, contextMenu.shapePath);
                      }
                      setContextMenu(null);
                    }}
                  >
                    <PaintBucket className="h-4 w-4 text-blue-500" />
                    Remplir / Hachurer
                  </button>
                  {/* Option pour supprimer le remplissage si existant */}
                  {(() => {
                    const key = [...contextMenu.shapeGeoIds].sort().join("-");
                    const existingFill = sketch.shapeFills.get(key);
                    if (existingFill) {
                      return (
                        <button
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                          onClick={() => {
                            if (contextMenu.shapeGeoIds) {
                              removeShapeFill(contextMenu.shapeGeoIds);
                            }
                            setContextMenu(null);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                          Supprimer le remplissage
                        </button>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
            </div>
          );
        })()}
      {/* Fermer le menu contextuel en cliquant ailleurs */}
      {contextMenu && <div className="fixed inset-0 z-[99]" onClick={() => setContextMenu(null)} />}

      {/* ============================================ */}
      {/* SIDEBAR HISTORIQUE (restaurée) */}
      {/* ============================================ */}
      <div
        className={`fixed inset-0 z-[100] pointer-events-none transition-opacity duration-150 ${
          showHistoryPanel ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ visibility: showHistoryPanel ? "visible" : "hidden" }}
      >
        <div
          className={`absolute right-0 top-[88px] bottom-0 w-72 flex flex-col transition-transform duration-150 ${
            showHistoryPanel ? "translate-x-0 pointer-events-auto" : "translate-x-full"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-l rounded-tl-lg shadow-sm">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Historique</span>
            </div>
            <button
              className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded"
              onClick={() => {
                setShowHistoryPanel(false);
                setComparisonMode(false);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Barre d'outils branches */}
          <div className="px-2 py-2 bg-gray-50 border-l border-b space-y-2">
            {/* Sélecteur de branche active */}
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-gray-500" />
              <select
                className="flex-1 text-xs border rounded px-2 py-1 bg-white"
                value={activeBranchId}
                onChange={(e) => switchToBranch(e.target.value)}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.history.length})
                  </option>
                ))}
              </select>
              <button
                className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-green-600"
                title="Nouvelle branche depuis l'état actuel"
                onClick={() => createBranchFromHistoryIndex(historyIndex)}
                disabled={branches.length >= 10}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Boutons rapides */}
            <div className="flex items-center gap-1">
              <button
                className={`flex-1 px-2 py-1 text-xs rounded flex items-center justify-center gap-1 ${
                  comparisonMode && comparisonStyle === "overlay"
                    ? "bg-blue-500 text-white"
                    : "bg-white border hover:bg-gray-100"
                }`}
                onClick={() => {
                  if (branches.length > 1) {
                    setComparisonMode(true);
                    setComparisonStyle("overlay");
                    setVisibleBranches(new Set(branches.map((b) => b.id)));
                    setShowComparisonModal(true);
                  }
                }}
                disabled={branches.length <= 1}
                title="Mode superposition"
              >
                <Layers className="h-3 w-3" />
              </button>
              <button
                className={`flex-1 px-2 py-1 text-xs rounded flex items-center justify-center gap-1 ${
                  comparisonMode && comparisonStyle === "reveal"
                    ? "bg-blue-500 text-white"
                    : "bg-white border hover:bg-gray-100"
                }`}
                onClick={() => {
                  if (branches.length > 1) {
                    setComparisonMode(true);
                    setComparisonStyle("reveal");
                    const otherBranch = branches.find((b) => b.id !== activeBranchId);
                    if (otherBranch) setRevealBranchId(otherBranch.id);
                    setShowComparisonModal(true);
                  }
                }}
                disabled={branches.length <= 1}
                title="Mode rideau"
              >
                <SplitSquareVertical className="h-3 w-3" />
              </button>
              <button
                className="flex-1 px-2 py-1 text-xs rounded bg-white border hover:bg-gray-100 flex items-center justify-center gap-1"
                onClick={() => setShowOverviewModal(true)}
                title="Vue d'ensemble"
              >
                <GitBranch className="h-3 w-3" />
              </button>
              {comparisonMode && (
                <button
                  className="px-2 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                  onClick={() => setComparisonMode(false)}
                  title="Désactiver comparaison"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Info branche active */}
          {(() => {
            const activeBranch = branches.find((b) => b.id === activeBranchId);
            if (!activeBranch) return null;
            return (
              <div className="px-2 py-1.5 bg-white border-l border-b flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activeBranch.color }} />
                <span className="font-medium truncate">{activeBranch.name}</span>
                <span className="text-gray-400">({activeBranch.history.length} états)</span>
                {branches.length > 1 && (
                  <button
                    className="ml-auto p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                    title="Supprimer cette branche"
                    onClick={() => deleteBranch(activeBranchId)}
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })()}

          {/* Liste historique */}
          <div className="flex-1 overflow-y-auto border-l bg-transparent">
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 italic p-3 bg-white/80">Aucun historique</p>
            ) : (
              <div className="space-y-1 p-1">
                {[...history].reverse().map((entry, reverseIdx) => {
                  const idx = history.length - 1 - reverseIdx;
                  const isActive = idx === historyIndex;
                  const isPreviewing = idx === previewHistoryIndex;
                  const isFuture = idx > historyIndex;
                  const date = new Date(entry.timestamp);
                  const timeStr = date.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });
                  const activeBranch = branches.find((b) => b.id === activeBranchId);
                  const branchColor = activeBranch?.color || "#3B82F6";

                  return (
                    <div
                      key={idx}
                      className={`
                        px-2 py-1.5 cursor-pointer transition-all text-xs rounded
                        ${
                          isActive
                            ? "text-white shadow-md"
                            : isPreviewing
                              ? "bg-yellow-400 text-gray-900 shadow-md"
                              : isFuture
                                ? "bg-white/60 text-gray-400"
                                : "bg-white/90 hover:bg-white hover:shadow-sm text-gray-700"
                        }
                      `}
                      style={isActive ? { backgroundColor: branchColor } : undefined}
                      onClick={() => goToHistoryIndex(idx)}
                      onMouseEnter={() => {
                        if (idx !== historyIndex) {
                          previewHistoryEntry(idx);
                        }
                      }}
                      onMouseLeave={() => {
                        if (previewHistoryIndex !== null) {
                          previewHistoryEntry(null);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-medium truncate ${isActive ? "text-white" : ""}`}>
                          {entry.description}
                        </span>
                        <span className={`text-[10px] ml-1 ${isActive ? "opacity-70" : "text-gray-400"}`}>
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className={`h-2.5 w-2.5 ${isActive ? "opacity-70" : "text-gray-400"}`} />
                        <span className={`text-[10px] ${isActive ? "opacity-70" : "text-gray-400"}`}>{timeStr}</span>
                        {isActive && <span className="text-[10px] opacity-80">● actuel</span>}
                        {isPreviewing && <span className="text-[10px] text-gray-900">● aperçu</span>}

                        {/* Boutons d'action */}
                        {idx < history.length - 1 && (
                          <div className="ml-auto flex items-center gap-0.5">
                            <button
                              className={`p-0.5 rounded transition-colors ${
                                isActive
                                  ? "opacity-70 hover:opacity-100 hover:bg-white/20"
                                  : isPreviewing
                                    ? "text-yellow-700 hover:text-green-700 hover:bg-yellow-300"
                                    : "text-gray-400 hover:text-green-600 hover:bg-green-100"
                              }`}
                              title="Créer une branche ici"
                              onClick={(e) => {
                                e.stopPropagation();
                                createBranchFromHistoryIndex(idx);
                              }}
                              disabled={branches.length >= 10}
                            >
                              <GitBranch className="h-3 w-3" />
                            </button>
                            <button
                              className={`p-0.5 rounded transition-colors ${
                                isActive
                                  ? "opacity-70 hover:opacity-100 hover:bg-white/20"
                                  : isPreviewing
                                    ? "text-yellow-700 hover:text-red-700 hover:bg-yellow-300"
                                    : "text-gray-400 hover:text-red-600 hover:bg-red-100"
                              }`}
                              title="Tronquer l'historique ici"
                              onClick={(e) => {
                                e.stopPropagation();
                                truncateHistoryAtIndex(idx);
                              }}
                            >
                              <Scissors className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer légende */}
          <div className="px-2 py-1.5 bg-white border-l border-t rounded-bl-lg text-[10px] text-gray-500 flex flex-col gap-0.5">
            <span>👆 Survoler = aperçu | Cliquer = revenir</span>
            <span>🔀 Branche | ✂️ Tronquer</span>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* MODALE FLOTTANTE PARAMÉTRAGE COMPARAISON */}
      {/* ============================================ */}
      {showComparisonModal && (
        <>
          {/* Modale flottante */}
          <div
            className="fixed z-[200] bg-white rounded-lg shadow-xl border"
            style={{
              left: comparisonModalPos.x,
              top: comparisonModalPos.y,
              width: 280,
            }}
          >
            {/* Header draggable */}
            <div
              className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg cursor-move select-none"
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                const startX = e.clientX - comparisonModalPos.x;
                const startY = e.clientY - comparisonModalPos.y;

                const handleMouseMove = (moveEvent: MouseEvent) => {
                  setComparisonModalPos({
                    x: Math.max(0, Math.min(moveEvent.clientX - startX, window.innerWidth - 280)),
                    y: Math.max(0, Math.min(moveEvent.clientY - startY, window.innerHeight - 200)),
                  });
                };

                const handleMouseUp = () => {
                  document.removeEventListener("mousemove", handleMouseMove);
                  document.removeEventListener("mouseup", handleMouseUp);
                };

                document.addEventListener("mousemove", handleMouseMove);
                document.addEventListener("mouseup", handleMouseUp);
              }}
            >
              <div className="flex items-center gap-2">
                {comparisonStyle === "overlay" ? (
                  <Layers className="h-4 w-4" />
                ) : (
                  <SplitSquareVertical className="h-4 w-4" />
                )}
                <span className="font-medium text-sm">
                  {comparisonStyle === "overlay" ? "Superposition" : "Rideau"}
                </span>
              </div>
              <button className="p-1 hover:bg-white/20 rounded" onClick={() => setShowComparisonModal(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Contenu */}
            <div className="p-3 space-y-3">
              {/* Toggle mode */}
              <div className="flex gap-1">
                <button
                  className={`flex-1 px-2 py-1.5 text-xs rounded flex items-center justify-center gap-1 ${
                    comparisonStyle === "overlay" ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"
                  }`}
                  onClick={() => {
                    setComparisonStyle("overlay");
                    setVisibleBranches(new Set(branches.map((b) => b.id)));
                  }}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Superpos.
                </button>
                <button
                  className={`flex-1 px-2 py-1.5 text-xs rounded flex items-center justify-center gap-1 ${
                    comparisonStyle === "reveal" ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"
                  }`}
                  onClick={() => {
                    setComparisonStyle("reveal");
                    const otherBranch = branches.find((b) => b.id !== activeBranchId);
                    if (otherBranch) setRevealBranchId(otherBranch.id);
                  }}
                >
                  <SplitSquareVertical className="h-3.5 w-3.5" />
                  Rideau
                </button>
              </div>

              {/* Options Superposition */}
              {comparisonStyle === "overlay" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-14">Opacité</span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={comparisonOpacity}
                      onChange={(e) => setComparisonOpacity(parseInt(e.target.value))}
                      className="flex-1 h-1.5"
                    />
                    <span className="text-xs w-10 text-right">{comparisonOpacity}%</span>
                  </div>

                  <div className="border rounded p-2 space-y-1 max-h-32 overflow-y-auto bg-gray-50">
                    {branches.map((branch) => (
                      <label key={branch.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibleBranches.has(branch.id)}
                          onChange={() => toggleBranchVisibility(branch.id)}
                          disabled={branch.id === activeBranchId}
                          className="rounded w-3 h-3"
                        />
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: branch.color }} />
                        <span className={`truncate ${branch.id === activeBranchId ? "font-medium" : ""}`}>
                          {branch.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Options Rideau */}
              {comparisonStyle === "reveal" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-14">Branche</span>
                    <select
                      className="flex-1 text-xs border rounded px-2 py-1 bg-white"
                      value={revealBranchId || ""}
                      onChange={(e) => setRevealBranchId(e.target.value)}
                    >
                      {branches
                        .filter((b) => b.id !== activeBranchId)
                        .map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs py-1 bg-gray-50 rounded">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activeBranchColor }} />
                      <span>◀</span>
                    </div>
                    <span className="text-gray-300">|</span>
                    <div className="flex items-center gap-1">
                      <span>▶</span>
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: revealBranchData?.color || "#888" }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-14">Position</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={revealPosition}
                      onChange={(e) => setRevealPosition(parseInt(e.target.value))}
                      className="flex-1 h-1.5"
                    />
                    <span className="text-xs w-10 text-right">{Math.round(revealPosition)}%</span>
                  </div>
                </div>
              )}

              {/* Bouton désactiver */}
              <button
                className="w-full px-3 py-1.5 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-600"
                onClick={() => {
                  setComparisonMode(false);
                  setShowComparisonModal(false);
                }}
              >
                Désactiver la comparaison
              </button>
            </div>
          </div>
        </>
      )}

      {/* ============================================ */}
      {/* MODALE VUE D'ENSEMBLE - FLOWCHART VERTICAL */}
      {/* ============================================ */}
      <Dialog open={showOverviewModal} onOpenChange={setShowOverviewModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Vue d'ensemble des branches
            </DialogTitle>
            <DialogDescription>
              Flowchart de l'historique. Cliquez sur un état pour y revenir, double-cliquez sur un nom de branche pour
              le modifier.
            </DialogDescription>
          </DialogHeader>

          <div
            ref={flowchartContainerRef}
            className={`flex-1 overflow-auto py-4 ${isGrabbing ? "cursor-grabbing" : "cursor-grab"}`}
            style={{ maxHeight: "calc(90vh - 200px)" }}
            onMouseDown={(e) => {
              // Ne pas activer le grab si on clique sur un élément interactif
              if ((e.target as HTMLElement).closest('button, input, [role="button"]')) return;
              setIsGrabbing(true);
              setGrabStart({
                x: e.clientX,
                y: e.clientY,
                scrollLeft: flowchartContainerRef.current?.scrollLeft || 0,
                scrollTop: flowchartContainerRef.current?.scrollTop || 0,
              });
            }}
            onMouseMove={(e) => {
              if (!isGrabbing || !flowchartContainerRef.current) return;
              const dx = e.clientX - grabStart.x;
              const dy = e.clientY - grabStart.y;
              flowchartContainerRef.current.scrollLeft = grabStart.scrollLeft - dx;
              flowchartContainerRef.current.scrollTop = grabStart.scrollTop - dy;
            }}
            onMouseUp={() => setIsGrabbing(false)}
            onMouseLeave={() => setIsGrabbing(false)}
          >
            {/* Flowchart vertical */}
            {(() => {
              // === Construire l'arbre de nœuds ===
              interface FlowNode {
                id: string;
                type: "branch-start" | "state";
                branchId: string;
                branchName: string;
                branchColor: string;
                stateIndex?: number;
                description: string;
                timestamp: number;
                isActive: boolean;
                isCurrent: boolean;
                nextState: FlowNode | null; // État suivant dans la même branche
                childBranches: FlowNode[]; // Branches qui partent de cet état
                x: number;
                y: number;
                width: number;
                height: number;
              }

              // Trouver la branche racine (sans parent)
              const rootBranch = branches.find((b) => !b.parentBranchId) || branches[0];
              if (!rootBranch) return <div className="text-center text-gray-500 py-8">Aucune branche</div>;

              // Fonction pour extraire les détails d'une description
              const parseDescription = (desc: string): { icon: string; label: string; details: string } => {
                const lower = desc.toLowerCase();
                if (lower.includes("rectangle")) {
                  const match = desc.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
                  return { icon: "▭", label: "Rectangle", details: match ? `${match[1]}×${match[2]}mm` : "" };
                }
                if (lower.includes("ligne") || lower.includes("line")) {
                  const match = desc.match(/L\s*=?\s*(\d+(?:\.\d+)?)/i);
                  return { icon: "╱", label: "Ligne", details: match ? `L=${match[1]}mm` : "" };
                }
                if (lower.includes("cercle") || lower.includes("circle")) {
                  const match = desc.match(/R\s*=?\s*(\d+(?:\.\d+)?)/i);
                  return { icon: "○", label: "Cercle", details: match ? `R=${match[1]}mm` : "" };
                }
                if (lower.includes("arc")) {
                  return { icon: "⌒", label: "Arc", details: "" };
                }
                if (lower.includes("polyligne") || lower.includes("polyline")) {
                  return { icon: "⟋", label: "Polyligne", details: "" };
                }
                if (lower.includes("bézier") || lower.includes("bezier") || lower.includes("courbe")) {
                  return { icon: "∿", label: "Courbe", details: "" };
                }
                if (lower.includes("annotation") || lower.includes("texte") || lower.includes("text")) {
                  return { icon: "T", label: "Annotation", details: "" };
                }
                if (lower.includes("dimension") || lower.includes("cote")) {
                  return { icon: "↔", label: "Dimension", details: "" };
                }
                if (lower.includes("fusion")) {
                  return { icon: "⊕", label: "Fusion", details: "" };
                }
                if (lower.includes("initial")) {
                  return { icon: "◉", label: "Initial", details: "État initial" };
                }
                if (lower.includes("suppression") || lower.includes("delete")) {
                  return { icon: "✕", label: "Suppression", details: "" };
                }
                if (lower.includes("déplacement") || lower.includes("move")) {
                  return { icon: "↗", label: "Déplacement", details: "" };
                }
                return { icon: "●", label: desc.slice(0, 20), details: "" };
              };

              // Constantes de dimensions
              const NODE_WIDTH = 220;
              const NODE_HEIGHT_STATE = 70;
              const NODE_HEIGHT_BRANCH = 50;
              const VERTICAL_GAP = 25;
              const HORIZONTAL_GAP = 50;
              const PADDING = 30;

              // Construire l'arbre d'une branche (chaînage linéaire avec branches enfants)
              // startIndex permet de ne pas afficher les états hérités de la branche parente
              const buildBranchTree = (branch: typeof rootBranch, startIndex: number = 0): FlowNode | null => {
                if (branch.history.length === 0 || startIndex >= branch.history.length) return null;

                let firstNode: FlowNode | null = null;
                let prevNode: FlowNode | null = null;

                for (let i = startIndex; i < branch.history.length; i++) {
                  const entry = branch.history[i];

                  const node: FlowNode = {
                    id: `${branch.id}-state-${i}`,
                    type: "state",
                    branchId: branch.id,
                    branchName: branch.name,
                    branchColor: branch.color,
                    stateIndex: i,
                    description: entry.description,
                    timestamp: entry.timestamp,
                    isActive: branch.id === activeBranchId,
                    isCurrent: branch.id === activeBranchId && i === branch.historyIndex,
                    nextState: null,
                    childBranches: [],
                    x: 0,
                    y: 0,
                    width: NODE_WIDTH,
                    height: NODE_HEIGHT_STATE,
                  };

                  // Chercher les branches enfants qui partent de cet état
                  const childBranchesData = branches.filter(
                    (b) => b.parentBranchId === branch.id && b.parentHistoryIndex === i,
                  );

                  // Créer les nœuds de départ pour chaque branche enfant
                  childBranchesData.forEach((childBranch) => {
                    // Pour les branches enfants, commencer APRÈS le point de branchement
                    const childStartIndex = (childBranch.parentHistoryIndex ?? -1) + 1;
                    const branchStartNode: FlowNode = {
                      id: `${childBranch.id}-start`,
                      type: "branch-start",
                      branchId: childBranch.id,
                      branchName: childBranch.name,
                      branchColor: childBranch.color,
                      description: childBranch.name,
                      timestamp: childBranch.createdAt,
                      isActive: childBranch.id === activeBranchId,
                      isCurrent: false,
                      nextState: buildBranchTree(childBranch, childStartIndex),
                      childBranches: [],
                      x: 0,
                      y: 0,
                      width: NODE_WIDTH,
                      height: NODE_HEIGHT_BRANCH,
                    };
                    node.childBranches.push(branchStartNode);
                  });

                  // Chaîner avec le nœud précédent
                  if (prevNode) {
                    prevNode.nextState = node;
                  } else {
                    firstNode = node;
                  }
                  prevNode = node;
                }

                return firstNode;
              };

              // Créer le nœud racine
              const rootNode: FlowNode = {
                id: `${rootBranch.id}-start`,
                type: "branch-start",
                branchId: rootBranch.id,
                branchName: rootBranch.name,
                branchColor: rootBranch.color,
                description: rootBranch.name,
                timestamp: rootBranch.createdAt,
                isActive: rootBranch.id === activeBranchId,
                isCurrent: false,
                nextState: buildBranchTree(rootBranch),
                childBranches: [],
                x: 0,
                y: 0,
                width: NODE_WIDTH,
                height: NODE_HEIGHT_BRANCH,
              };

              // === Calculer le layout ===
              let totalWidth = 0;
              let totalHeight = 0;

              // Calculer la largeur totale d'un sous-arbre à partir d'un nœud
              const calculateSubtreeWidth = (node: FlowNode | null): number => {
                if (!node) return 0;

                // Si pas de branches enfants, la largeur est juste celle du nœud
                if (node.childBranches.length === 0) {
                  // Mais il faut aussi considérer les états suivants
                  const nextWidth = node.nextState ? calculateSubtreeWidth(node.nextState) : NODE_WIDTH;
                  return Math.max(NODE_WIDTH, nextWidth);
                }

                // Calculer la largeur de la continuation + des branches enfants
                let totalW = 0;

                // Largeur de la continuation (états suivants de cette branche)
                if (node.nextState) {
                  totalW += calculateSubtreeWidth(node.nextState);
                }

                // Largeur des branches enfants
                node.childBranches.forEach((childBranch, idx) => {
                  if (node.nextState || idx > 0) {
                    totalW += HORIZONTAL_GAP;
                  }
                  totalW += calculateSubtreeWidth(childBranch);
                });

                return Math.max(NODE_WIDTH, totalW);
              };

              // Positionner les nœuds récursivement
              const layoutNode = (node: FlowNode | null, x: number, y: number): void => {
                if (!node) return;

                node.x = x;
                node.y = y;
                node.height = node.type === "branch-start" ? NODE_HEIGHT_BRANCH : NODE_HEIGHT_STATE;

                totalWidth = Math.max(totalWidth, x + NODE_WIDTH);
                totalHeight = Math.max(totalHeight, y + node.height);

                const nextY = y + node.height + VERTICAL_GAP;

                // Si ce nœud a des branches enfants
                if (node.childBranches.length > 0) {
                  // D'abord, positionner la continuation (nextState) à la même colonne
                  if (node.nextState) {
                    layoutNode(node.nextState, x, nextY);
                  }

                  // Les branches enfants sont TOUJOURS décalées à droite
                  // Calculer le X de départ pour les branches enfants
                  let branchX = x + NODE_WIDTH + HORIZONTAL_GAP;

                  // Si il y a une continuation, les branches sont à droite de tout le sous-arbre de continuation
                  if (node.nextState) {
                    branchX = x + calculateSubtreeWidth(node.nextState) + HORIZONTAL_GAP;
                  }

                  // Positionner les branches enfants à droite
                  node.childBranches.forEach((childBranch) => {
                    layoutNode(childBranch, branchX, nextY);
                    branchX += calculateSubtreeWidth(childBranch) + HORIZONTAL_GAP;
                  });
                } else {
                  // Pas de branches enfants, juste continuer vers le bas
                  if (node.nextState) {
                    layoutNode(node.nextState, x, nextY);
                  }
                }
              };

              layoutNode(rootNode, PADDING, PADDING);

              // Collecter tous les nœuds et connexions pour le rendu
              const allNodes: FlowNode[] = [];
              const connections: { from: FlowNode; to: FlowNode; type: "next" | "branch" }[] = [];

              const collectNodes = (node: FlowNode | null) => {
                if (!node) return;
                allNodes.push(node);

                if (node.nextState) {
                  connections.push({ from: node, to: node.nextState, type: "next" });
                  collectNodes(node.nextState);
                }

                node.childBranches.forEach((childBranch) => {
                  connections.push({ from: node, to: childBranch, type: "branch" });
                  collectNodes(childBranch);
                });
              };
              collectNodes(rootNode);

              // Rendu
              const svgWidth = totalWidth + PADDING * 2;
              const svgHeight = totalHeight + PADDING * 2;

              return (
                <div className="relative" style={{ minWidth: svgWidth, minHeight: svgHeight }}>
                  {/* SVG pour les connexions */}
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    width={svgWidth}
                    height={svgHeight}
                    style={{ overflow: "visible" }}
                  >
                    {connections.map((conn, idx) => {
                      const fromX = conn.from.x + NODE_WIDTH / 2;
                      const fromY = conn.from.y + conn.from.height;
                      const toX = conn.to.x + NODE_WIDTH / 2;
                      const toY = conn.to.y;

                      // Ligne en L si décalage horizontal
                      const midY = fromY + (toY - fromY) / 2;

                      let path: string;
                      if (Math.abs(fromX - toX) < 5) {
                        // Ligne droite
                        path = `M ${fromX} ${fromY} L ${toX} ${toY - 6}`;
                      } else {
                        // Ligne en L
                        path = `M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY - 6}`;
                      }

                      return (
                        <g key={idx}>
                          <path d={path} fill="none" stroke={conn.to.branchColor} strokeWidth="2" />
                          {/* Flèche */}
                          <polygon
                            points={`${toX},${toY} ${toX - 5},${toY - 8} ${toX + 5},${toY - 8}`}
                            fill={conn.to.branchColor}
                          />
                          {/* Point de départ */}
                          <circle cx={fromX} cy={fromY} r="4" fill={conn.from.branchColor} />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Nœuds */}
                  {allNodes.map((node) => {
                    const parsed = parseDescription(node.description);
                    const timeStr = new Date(node.timestamp).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    if (node.type === "branch-start") {
                      // Carte de branche
                      return (
                        <div
                          key={node.id}
                          className={`absolute rounded-lg border-2 bg-white shadow-sm cursor-pointer transition-all hover:shadow-md`}
                          style={{
                            left: node.x,
                            top: node.y,
                            width: NODE_WIDTH,
                            height: node.height,
                            borderColor: node.branchColor,
                            boxShadow: node.isActive ? `0 0 0 2px white, 0 0 0 4px ${node.branchColor}` : undefined,
                          }}
                          onClick={() => switchToBranch(node.branchId)}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setRenamingBranchId(node.branchId);
                            setRenamingValue(node.branchName);
                          }}
                        >
                          <div
                            className="flex items-center gap-2 px-3 py-2 h-full"
                            style={{ backgroundColor: `${node.branchColor}15` }}
                          >
                            <div
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: node.branchColor }}
                            />
                            {renamingBranchId === node.branchId ? (
                              <Input
                                value={renamingValue}
                                onChange={(e) => setRenamingValue(e.target.value)}
                                className="h-6 text-sm flex-1"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    renameBranch(node.branchId, renamingValue);
                                    setRenamingBranchId(null);
                                  } else if (e.key === "Escape") {
                                    setRenamingBranchId(null);
                                  }
                                }}
                                onBlur={() => {
                                  renameBranch(node.branchId, renamingValue);
                                  setRenamingBranchId(null);
                                }}
                              />
                            ) : (
                              <span className="font-medium text-sm truncate flex-1">{node.branchName}</span>
                            )}
                            {node.isActive && (
                              <Badge className="text-xs px-1.5 py-0" style={{ backgroundColor: node.branchColor }}>
                                Active
                              </Badge>
                            )}
                            {branches.length > 1 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 opacity-50 hover:opacity-100 hover:text-red-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteBranch(node.branchId);
                                }}
                                title="Supprimer la branche"
                              >
                                <TrashIcon className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Carte d'état
                    return (
                      <div
                        key={node.id}
                        className={`absolute rounded-lg border bg-white shadow-sm cursor-pointer transition-all hover:shadow-md group`}
                        style={{
                          left: node.x,
                          top: node.y,
                          width: NODE_WIDTH,
                          height: node.height,
                          borderColor: node.isCurrent ? node.branchColor : "#e5e7eb",
                          boxShadow: node.isCurrent ? `0 0 0 1px white, 0 0 0 3px ${node.branchColor}` : undefined,
                        }}
                        onClick={() => {
                          if (node.branchId !== activeBranchId) {
                            switchToBranch(node.branchId);
                          }
                          if (node.stateIndex !== undefined) {
                            goToHistoryIndex(node.stateIndex);
                          }
                        }}
                        title={`${node.description}\n${new Date(node.timestamp).toLocaleString("fr-FR")}\nCliquez pour revenir à cet état`}
                      >
                        {/* Barre de couleur en haut */}
                        <div className="h-1 rounded-t-lg" style={{ backgroundColor: node.branchColor }} />

                        <div className="px-3 py-2 flex flex-col justify-between h-[calc(100%-4px)]">
                          {/* Ligne 1: Icône + Label */}
                          <div className="flex items-center gap-2">
                            <span className="text-lg" style={{ color: node.branchColor }}>
                              {parsed.icon}
                            </span>
                            <span className="font-medium text-sm truncate flex-1">{parsed.label}</span>
                            {node.isCurrent && (
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: node.branchColor }} />
                            )}
                          </div>

                          {/* Ligne 2: Détails + Heure */}
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{parsed.details || node.description.slice(0, 25)}</span>
                            <span>{timeStr}</span>
                          </div>

                          {/* Actions au survol */}
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (node.branchId !== activeBranchId) {
                                  switchToBranch(node.branchId);
                                }
                                if (node.stateIndex !== undefined) {
                                  createBranchFromHistoryIndex(node.stateIndex);
                                }
                              }}
                              title="Créer une branche ici"
                              disabled={branches.length >= 10}
                            >
                              <GitBranch className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0 hover:text-red-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (node.branchId !== activeBranchId) {
                                  switchToBranch(node.branchId);
                                }
                                if (node.stateIndex !== undefined && node.stateIndex > 0) {
                                  deleteStateAndAfter(node.stateIndex);
                                }
                              }}
                              title="Supprimer cet état et les suivants"
                              disabled={node.stateIndex === 0}
                            >
                              <TrashIcon className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Section Fusion */}
          {branches.length > 1 && (
            <div className="border-t pt-4 mt-2">
              <div className="flex items-center gap-3 px-1">
                <GitMerge className="h-4 w-4 text-purple-600 flex-shrink-0" />
                <div className="flex items-center gap-2 flex-1">
                  <select
                    className="text-sm border rounded px-2 py-1.5 bg-white flex-1"
                    value={mergeBranchIds.source || ""}
                    onChange={(e) => setMergeBranchIds((prev) => ({ ...prev, source: e.target.value || null }))}
                  >
                    <option value="">Source...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-gray-400">→</span>
                  <select
                    className="text-sm border rounded px-2 py-1.5 bg-white flex-1"
                    value={mergeBranchIds.target || ""}
                    onChange={(e) => setMergeBranchIds((prev) => ({ ...prev, target: e.target.value || null }))}
                  >
                    <option value="">Cible...</option>
                    {branches
                      .filter((b) => b.id !== mergeBranchIds.source)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={!mergeBranchIds.source || !mergeBranchIds.target}
                    onClick={() => {
                      if (mergeBranchIds.source && mergeBranchIds.target) {
                        mergeBranches(mergeBranchIds.source, mergeBranchIds.target);
                        setMergeBranchIds({ source: null, target: null });
                      }
                    }}
                  >
                    Fusionner
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowOverviewModal(false)}>
              Fermer
            </Button>
            <Button onClick={() => createBranchFromHistoryIndex(historyIndex)} disabled={branches.length >= 10}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle branche ({branches.length}/10)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Panneau de contrôle de la grille A4 */}
      {showA4Grid && (
        <div
          className="fixed bottom-4 left-4 bg-white rounded-lg shadow-xl border p-4 z-50 w-80"
          style={{ cursor: "default" }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <FileDown className={`h-4 w-4 ${a4CutMode ? "text-red-500" : "text-blue-500"}`} />
              Grille A4 Export
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setShowA4Grid(false)} className="h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Orientation */}
          <div className="flex items-center gap-2 mb-2">
            <Label className="text-xs w-20">Orientation:</Label>
            <Select value={a4GridOrientation} onValueChange={(v: "portrait" | "landscape") => setA4GridOrientation(v)}>
              <SelectTrigger className="h-8 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait (210×297)</SelectItem>
                <SelectItem value="landscape">Paysage (297×210)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lignes et colonnes */}
          <div className="flex items-center gap-2 mb-2">
            <Label className="text-xs w-20">Taille:</Label>
            <Input
              type="number"
              min="1"
              max="20"
              value={a4GridCols}
              onChange={(e) => setA4GridCols(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              className="h-8 w-14 text-center"
            />
            <span className="text-xs">×</span>
            <Input
              type="number"
              min="1"
              max="20"
              value={a4GridRows}
              onChange={(e) => setA4GridRows(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              className="h-8 w-14 text-center"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={autoFitA4Grid}
              className="h-8 px-2"
              title="Ajuster automatiquement au contenu"
            >
              <Target className="h-4 w-4" />
            </Button>
          </div>

          {/* Chevauchement */}
          <div className="flex items-center gap-2 mb-2">
            <Label className="text-xs w-20">Chevauche.:</Label>
            <Input
              type="number"
              min="0"
              max="30"
              value={a4OverlapMm}
              onChange={(e) => setA4OverlapMm(Math.max(0, Math.min(30, parseInt(e.target.value) || 0)))}
              className="h-8 w-14 text-center"
            />
            <span className="text-xs text-gray-500">mm</span>
            <div className="flex-1 flex gap-1">
              {[0, 5, 10, 15].map((v) => (
                <Button
                  key={v}
                  variant={a4OverlapMm === v ? "default" : "outline"}
                  size="sm"
                  onClick={() => setA4OverlapMm(v)}
                  className="h-6 px-1 text-xs flex-1"
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>

          {/* Mode plan de coupe */}
          <div className="flex items-center gap-2 mb-3">
            <Label className="text-xs w-20">Mode:</Label>
            <Button
              variant={!a4CutMode ? "default" : "outline"}
              size="sm"
              onClick={() => setA4CutMode(false)}
              className={`h-7 flex-1 text-xs ${!a4CutMode ? "bg-blue-500 hover:bg-blue-600" : ""}`}
            >
              📷 Avec photos
            </Button>
            <Button
              variant={a4CutMode ? "default" : "outline"}
              size="sm"
              onClick={() => setA4CutMode(true)}
              className={`h-7 flex-1 text-xs ${a4CutMode ? "bg-red-500 hover:bg-red-600" : ""}`}
            >
              ✂️ Découpe
            </Button>
          </div>

          {/* Info dimensions */}
          <div className="text-xs text-gray-500 mb-3 p-2 bg-gray-50 rounded">
            <div className="flex justify-between">
              <span>
                Grille: {a4GridCols} × {a4GridRows}
              </span>
              <span className="font-medium">{a4GridCols * a4GridRows} pages</span>
            </div>
            <div className="flex justify-between">
              <span>Couverture:</span>
              <span>
                {Math.round(
                  a4GridCols * ((a4GridOrientation === "portrait" ? A4_WIDTH_MM : A4_HEIGHT_MM) - a4OverlapMm) +
                    a4OverlapMm,
                )}{" "}
                ×{" "}
                {Math.round(
                  a4GridRows * ((a4GridOrientation === "portrait" ? A4_HEIGHT_MM : A4_WIDTH_MM) - a4OverlapMm) +
                    a4OverlapMm,
                )}{" "}
                mm
              </span>
            </div>
            {a4OverlapMm > 0 && (
              <div className="text-amber-600 mt-1">⚠️ Zones jaunes = chevauchement {a4OverlapMm}mm</div>
            )}
            <div className="mt-1 text-blue-600">🎯 Drag le point rouge pour positionner</div>
          </div>

          {/* Sélection */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs">
              {selectedA4Cells.size} cellule{selectedA4Cells.size > 1 ? "s" : ""} sélectionnée
              {selectedA4Cells.size > 1 ? "s" : ""}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Sélectionner toutes les cellules
                  const allCells = new Set<string>();
                  for (let r = 0; r < a4GridRows; r++) {
                    for (let c = 0; c < a4GridCols; c++) {
                      allCells.add(`${r}-${c}`);
                    }
                  }
                  setSelectedA4Cells(allCells);
                }}
                className="h-7 text-xs px-2"
              >
                Tout
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedA4Cells(new Set())}
                className="h-7 text-xs px-2"
              >
                Aucun
              </Button>
            </div>
          </div>

          {/* Export */}
          <div className="flex gap-2">
            <Button
              onClick={exportA4GridToPDF}
              disabled={selectedA4Cells.size === 0}
              className={`flex-1 ${a4CutMode ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"}`}
            >
              <Download className="h-4 w-4 mr-1" />
              PDF unique
            </Button>
            <Button
              onClick={exportA4GridByLot}
              disabled={selectedA4Cells.size === 0}
              variant="outline"
              className="flex-1"
              title="Exporter chaque page dans un fichier séparé"
            >
              <FileDown className="h-4 w-4 mr-1" />
              Par fichier
            </Button>
          </div>

          <p className="text-xs text-gray-400 mt-2 text-center">
            {selectedA4Cells.size} page{selectedA4Cells.size > 1 ? "s" : ""} • A4 sans marge • échelle 1:1
          </p>
        </div>
      )}

      {/* Bibliothèque de templates */}
      <TemplateLibrary
        isOpen={showTemplateLibrary}
        onClose={() => setShowTemplateLibrary(false)}
        currentSketch={sketch}
        onLoadTemplate={handleLoadTemplate}
        onGenerateThumbnail={generateThumbnail}
      />

      {/* MOD v80.15: Modale d'impression avec duplication de motifs */}
      <PrintPreviewModal
        isOpen={showPrintDialog}
        onClose={() => setShowPrintDialog(false)}
        canvasRef={canvasRef}
        contentWidth={canvasRef.current ? canvasRef.current.width / viewport.scale / sketch.scaleFactor : 100}
        contentHeight={canvasRef.current ? canvasRef.current.height / viewport.scale / sketch.scaleFactor : 100}
        showGrid={showGrid}
        showDimensions={showDimensions}
      />

      {/* Éditeur de toolbar configurable (drag & drop) */}
      <ToolbarEditor
        isOpen={isToolbarEditorOpen}
        onClose={() => setToolbarEditorOpen(false)}
        config={newToolbarConfig}
        onConfigChange={updateToolbarConfig}
      />
    </div>
  );
}

// Utilitaires
function distanceToLine(
  p: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len2 = dx * dx + dy * dy;

  if (len2 < 1e-10) return distance(p, p1);

  let t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  return distance(p, { x: p1.x + t * dx, y: p1.y + t * dy });
}

// Calcul de la distance à une courbe de Bézier cubique
function distanceToBezier(
  p: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  cp1: { x: number; y: number },
  cp2: { x: number; y: number },
): number {
  // Échantillonner la courbe et trouver la distance minimale
  const samples = 20;
  let minDist = Infinity;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    // Formule de Bézier cubique
    const x = mt3 * p1.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p2.x;
    const y = mt3 * p1.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p2.y;

    const d = distance(p, { x, y });
    if (d < minDist) {
      minDist = d;
    }
  }

  return minDist;
}

function serializeSketch(sketch: Sketch): any {
  return {
    id: sketch.id,
    name: sketch.name,
    points: Object.fromEntries(sketch.points),
    geometries: Object.fromEntries(sketch.geometries),
    constraints: Object.fromEntries(sketch.constraints),
    dimensions: Object.fromEntries(sketch.dimensions),
    scaleFactor: sketch.scaleFactor,
    layers: sketch.layers ? Object.fromEntries(sketch.layers) : undefined,
    layerGroups: sketch.layerGroups ? Object.fromEntries(sketch.layerGroups) : undefined,
    groups: sketch.groups ? Object.fromEntries(sketch.groups) : undefined,
    shapeFills: sketch.shapeFills ? Object.fromEntries(sketch.shapeFills) : undefined,
    activeLayerId: sketch.activeLayerId,
    dof: sketch.dof,
    status: sketch.status,
  };
}

// Sérialiser les images de fond (sans l'objet Image qui ne peut pas être cloné)
function serializeBackgroundImages(images: BackgroundImage[]): any[] {
  return images.map((img) => ({
    id: img.id,
    name: img.name,
    src: img.src,
    x: img.x,
    y: img.y,
    scale: img.scale,
    rotation: img.rotation,
    opacity: img.opacity,
    visible: img.visible,
    locked: img.locked,
    markers: img.markers,
    adjustments: img.adjustments,
    calibrationData: img.calibrationData
      ? {
          points: Object.fromEntries(img.calibrationData.points || new Map()),
          pairs: Object.fromEntries(img.calibrationData.pairs || new Map()),
          scale: img.calibrationData.scale,
          error: img.calibrationData.error,
          applied: img.calibrationData.applied,
          mode: img.calibrationData.mode,
        }
      : undefined,
  }));
}

function deserializeSketch(data: any): Sketch {
  return {
    id: data.id || "sketch-1",
    name: data.name || "Sketch",
    points: new Map(Object.entries(data.points || {})),
    geometries: new Map(Object.entries(data.geometries || {})),
    constraints: new Map(Object.entries(data.constraints || {})),
    dimensions: new Map(Object.entries(data.dimensions || {})),
    scaleFactor: data.scaleFactor || 1,
    layers: data.layers ? new Map(Object.entries(data.layers)) : new Map(),
    layerGroups: data.layerGroups ? new Map(Object.entries(data.layerGroups)) : new Map(),
    groups: data.groups ? new Map(Object.entries(data.groups)) : new Map(),
    shapeFills: data.shapeFills ? new Map(Object.entries(data.shapeFills)) : new Map(),
    activeLayerId: data.activeLayerId || "trace",
    dof: data.dof ?? 0,
    status: data.status || "under-constrained",
  };
}

function exportToSVG(sketch: Sketch): string {
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-500 -500 1000 1000">
<g stroke="black" stroke-width="1" fill="none">
`;

  sketch.geometries.forEach((geo) => {
    if (geo.type === "line") {
      const line = geo as Line;
      const p1 = sketch.points.get(line.p1);
      const p2 = sketch.points.get(line.p2);
      if (p1 && p2) {
        svg += `  <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"/>\n`;
      }
    } else if (geo.type === "circle") {
      const circle = geo as CircleType;
      const center = sketch.points.get(circle.center);
      if (center) {
        svg += `  <circle cx="${center.x}" cy="${center.y}" r="${circle.radius}"/>\n`;
      }
    }
  });

  svg += `</g>
</svg>`;

  return svg;
}

export default CADGabaritCanvas;
