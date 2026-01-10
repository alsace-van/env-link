// ============================================
// COMPOSANT: CADGabaritCanvas
// Canvas CAO professionnel pour gabarits CNC
// VERSION: 6.17 - Fix: markerMode se désactive quand on change d'outil (boutons et raccourcis)
// ============================================

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
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
} from "lucide-react";

import {
  Point,
  Geometry,
  Line,
  Circle as CircleType,
  Arc,
  Rectangle,
  Bezier,
  Constraint,
  Dimension,
  Sketch,
  Viewport,
  SnapPoint,
  SnapType,
  ToolType,
  Layer,
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
import { CADRenderer } from "./cad-renderer";
import { SnapSystem, DEFAULT_SNAP_SETTINGS, AdditionalSnapPoint } from "./snap-system";
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

// Import DXF
import { loadDXFFile, DXFParseResult } from "./dxf-parser";

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
  const snapSystemRef = useRef<SnapSystem>(new SnapSystem());
  const solverRef = useRef<CADSolver>(new CADSolver());
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dxfInputRef = useRef<HTMLInputElement>(null);
  const lastMiddleClickRef = useRef<number>(0); // Pour détecter le double-clic molette

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
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  const [currentSnapPoint, setCurrentSnapPoint] = useState<SnapPoint | null>(null);

  const [tempGeometry, setTempGeometry] = useState<any>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);

  // Saisie des dimensions du rectangle (style Fusion 360)
  const [rectInputs, setRectInputs] = useState<{
    active: boolean;
    widthValue: string;
    heightValue: string;
    activeField: "width" | "height";
    // Position écran pour afficher les inputs
    widthInputPos: { x: number; y: number };
    heightInputPos: { x: number; y: number };
  }>({
    active: false,
    widthValue: "",
    heightValue: "",
    activeField: "width",
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

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showConstraints, setShowConstraints] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showBackgroundImage, setShowBackgroundImage] = useState(true);
  const [imageOpacity, setImageOpacity] = useState(0.5);

  // === Multi-photos ===
  const [backgroundImages, setBackgroundImages] = useState<BackgroundImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [imageDragStart, setImageDragStart] = useState<{ x: number; y: number; imgX: number; imgY: number } | null>(
    null,
  );

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

  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef<{ history: any[]; index: number }>({ history: [], index: -1 });

  // Synchroniser la ref avec l'état
  useEffect(() => {
    historyRef.current = { history, index: historyIndex };
  }, [history, historyIndex]);

  // Sauvegarder l'état initial au montage
  const historyInitializedRef = useRef(false);
  useEffect(() => {
    if (!historyInitializedRef.current) {
      historyInitializedRef.current = true;
      const initialState = serializeSketch(sketch);
      setHistory([initialState]);
      setHistoryIndex(0);
      historyRef.current = { history: [initialState], index: 0 };
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
  const [showAdjustmentsDialog, setShowAdjustmentsDialog] = useState(false);
  const [adjustmentsPanelPos, setAdjustmentsPanelPos] = useState({ x: 100, y: 100 });
  const [adjustmentsPanelDragging, setAdjustmentsPanelDragging] = useState(false);
  const [adjustmentsPanelDragStart, setAdjustmentsPanelDragStart] = useState({ x: 0, y: 0 });
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

  // Tableau des mesures persistantes
  const [measurements, setMeasurements] = useState<
    Array<{
      id: string;
      start: { x: number; y: number };
      end: { x: number; y: number };
      px: number;
      mm: number;
      // Optionnel: si les 2 points sont sur des segments, stocker l'angle
      angle?: number; // en degrés
      segment1Id?: string;
      segment2Id?: string;
    }>
  >([]);

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

  // Calcul de la longueur totale des segments sélectionnés (en mm)
  const selectedLength = useMemo(() => {
    if (selectedEntities.size === 0) return null;

    let totalPx = 0;
    let count = 0;

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
    return { mm: totalMm, count };
  }, [selectedEntities, sketch]);

  // Rendu
  const render = useCallback(() => {
    if (!rendererRef.current) return;

    rendererRef.current.setViewport(viewport);
    rendererRef.current.render(sketch, {
      selectedEntities,
      hoveredEntity,
      currentSnapPoint,
      tempGeometry,
      showGrid,
      showConstraints,
      showDimensions,
      // Multi-photos
      backgroundImages: showBackgroundImage ? backgroundImages : [],
      selectedImageId,
      markerLinks,
      selectedMarkerId,
      // Legacy single image (rétrocompatibilité)
      backgroundImage: showBackgroundImage && backgroundImages.length === 0 ? backgroundImageRef.current : null,
      transformedImage: showBackgroundImage && backgroundImages.length === 0 ? transformedImage : null,
      imageOpacity,
      imageScale,
      calibrationData,
      showCalibration: showCalibrationPanel, // Afficher uniquement si panneau ouvert
      // Mesure en cours (preview)
      measureData: measureStart
        ? {
            start: measureStart,
            end: measureEnd,
            // calibrationData.scale est en mm/px, sketch.scaleFactor est en px/mm (inverser)
            scale: calibrationData.scale || 1 / sketch.scaleFactor,
          }
        : null,
      // Tableau des mesures terminées
      measurements: measurements,
      // measureScale en mm/px pour le renderer
      measureScale: calibrationData.scale || 1 / sketch.scaleFactor,
      // scaleFactor en px/mm pour les règles
      scaleFactor: sketch.scaleFactor,
      // Surbrillance des formes fermées
      highlightOpacity,
      mouseWorldPos,
    });

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

            let deltaAngle = endAngle - startAngle;
            while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
            while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
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
  }, [
    sketch,
    viewport,
    selectedEntities,
    hoveredEntity,
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
  ]);

  useEffect(() => {
    render();
  }, [render]);

  // Vider la sélection quand on change d'outil (sauf pour select)
  useEffect(() => {
    if (activeTool !== "select") {
      setSelectedEntities(new Set());
      // Désactiver le mode marqueur quand on change d'outil
      setMarkerMode("idle");
      setPendingLink(null);
      setSelectedMarkerId(null);
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
        widthInputPos: { x: 0, y: 0 },
        heightInputPos: { x: 0, y: 0 },
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

      setSketch(newSketch);
      // NE PAS appeler solveSketch ici - on veut restaurer l'état exact de l'historique
      // sans que le solver "corrige" les contraintes H/V
      // solveSketch(newSketch);
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
    };

    if (onSave) {
      onSave(data);
      toast.success("Gabarit sauvegardé !");
    }

    return data;
  }, [sketch, onSave]);

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
  const addToHistory = useCallback((newSketch: Sketch) => {
    const { history: currentHistory, index: currentIndex } = historyRef.current;
    const serialized = serializeSketch(newSketch);
    // Couper l'historique au point actuel et ajouter le nouvel état
    const newHistory = [...currentHistory.slice(0, currentIndex + 1), serialized];
    const newIndex = currentIndex + 1;

    setHistory(newHistory);
    setHistoryIndex(newIndex);
    historyRef.current = { history: newHistory, index: newIndex };
  }, []);

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
      const tolerance = 10 / viewport.scale;
      const pointTolerance = 8 / viewport.scale; // Tolérance plus stricte pour les points

      // PRIORITÉ 1: Vérifier les points de COIN en premier (pour congé/chanfrein)
      // Un coin est un point connecté à exactement 2 lignes
      for (const [id, point] of sketch.points) {
        if (distance({ x: worldX, y: worldY }, point) < pointTolerance) {
          // Compter les lignes connectées à ce point
          let connectedLines = 0;
          for (const geo of sketch.geometries.values()) {
            if (geo.type === "line") {
              const line = geo as Line;
              if (line.p1 === id || line.p2 === id) {
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
                x: position.x,
                y: position.y,
                scale: 1,
                opacity: imageOpacity,
                visible: true,
                locked: false,
                order: currentLength + index,
                markers: [],
              };

              return [...prev, newImage];
            });

            loadedCount++;

            if (loadedCount === fileArray.length) {
              setShowBackgroundImage(true);
              toast.success(fileArray.length === 1 ? "Photo chargée !" : `${fileArray.length} photos chargées !`);
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      });

      // Reset l'input pour permettre de re-sélectionner les mêmes fichiers
      e.target.value = "";
    },
    [imageOpacity, viewport],
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
      const newLine: Line = {
        id: generateId(),
        type: "line",
        p1: newPoint.id,
        p2: line.p2,
        layerId: line.layerId,
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
        addToHistory(newSketch);
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
        addToHistory(newSketch);
        toast.success(`Chanfrein ${dist}mm appliqué`);
      }
    },
    [sketch, applyChamferToSketch, addToHistory],
  );

  // Trouver les lignes connectées à un point
  const findLinesConnectedToPoint = useCallback(
    (pointId: string): Line[] => {
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
    [sketch.scaleFactor, filletRadius, findLinesConnectedToPoint, calculateCornerParams],
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
      const connectedLines: Line[] = [];
      currentSketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const line = geo as Line;
          if (line.p1 === corner.pointId || line.p2 === corner.pointId) {
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
      const connectedLines: Line[] = [];
      currentSketch.geometries.forEach((geo) => {
        if (geo.type === "line") {
          const line = geo as Line;
          if (line.p1 === corner.pointId || line.p2 === corner.pointId) {
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
          const newExistingLine: Line = {
            id: generateId(),
            type: "line",
            p1: intersectPoint.id,
            p2: existingLine.p2,
            layerId: existingLine.layerId,
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
          const newNewLine: Line = {
            id: generateId(),
            type: "line",
            p1: intersectPoint.id,
            p2: currentNewLine.p2,
            layerId: currentNewLine.layerId,
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
  const createRectangleFromInputs = useCallback(() => {
    if (tempPoints.length === 0 || !tempGeometry?.p1) return;

    const p1 = tempPoints[0];
    const currentSketch = sketchRef.current;

    // Déterminer les dimensions
    let width: number;
    let height: number;

    // Si des valeurs sont saisies, les utiliser
    const inputWidth = parseFloat(rectInputs.widthValue);
    const inputHeight = parseFloat(rectInputs.heightValue);

    if (!isNaN(inputWidth) && inputWidth > 0) {
      width = inputWidth * currentSketch.scaleFactor; // Convertir mm en px
    } else if (tempGeometry.cursor) {
      width = Math.abs(tempGeometry.cursor.x - p1.x);
    } else {
      return; // Pas de dimension valide
    }

    if (!isNaN(inputHeight) && inputHeight > 0) {
      height = inputHeight * currentSketch.scaleFactor; // Convertir mm en px
    } else if (tempGeometry.cursor) {
      height = Math.abs(tempGeometry.cursor.y - p1.y);
    } else {
      return; // Pas de dimension valide
    }

    // Déterminer la direction (basée sur le curseur ou par défaut vers le bas-droite)
    let dirX = 1;
    let dirY = 1;
    if (tempGeometry.cursor) {
      dirX = tempGeometry.cursor.x >= p1.x ? 1 : -1;
      dirY = tempGeometry.cursor.y >= p1.y ? 1 : -1;
    }

    // Calculer les 4 coins
    const p3 = { x: p1.x + width * dirX, y: p1.y + height * dirY };
    const p2: Point = { id: generateId(), x: p3.x, y: p1.y };
    const p4: Point = { id: generateId(), x: p1.x, y: p3.y };
    const p3Pt: Point = { id: generateId(), x: p3.x, y: p3.y };

    // Créer le sketch
    const newSketch = { ...currentSketch };
    newSketch.points = new Map(currentSketch.points);
    newSketch.geometries = new Map(currentSketch.geometries);
    newSketch.constraints = new Map(currentSketch.constraints);

    newSketch.points.set(p1.id, p1);
    newSketch.points.set(p2.id, p2);
    newSketch.points.set(p3Pt.id, p3Pt);
    newSketch.points.set(p4.id, p4);

    // Créer les 4 lignes avec le calque actif
    const lines = [
      { id: generateId(), type: "line" as const, p1: p1.id, p2: p2.id, layerId: currentSketch.activeLayerId },
      { id: generateId(), type: "line" as const, p1: p2.id, p2: p3Pt.id, layerId: currentSketch.activeLayerId },
      { id: generateId(), type: "line" as const, p1: p3Pt.id, p2: p4.id, layerId: currentSketch.activeLayerId },
      { id: generateId(), type: "line" as const, p1: p4.id, p2: p1.id, layerId: currentSketch.activeLayerId },
    ];

    lines.forEach((l) => newSketch.geometries.set(l.id, l));

    // Détecter et créer les points d'intersection
    for (const line of lines) {
      createIntersectionPoints(line.id, newSketch);
    }

    // Ajouter contraintes horizontales/verticales
    newSketch.constraints.set(generateId(), { id: generateId(), type: "horizontal", entities: [lines[0].id] });
    newSketch.constraints.set(generateId(), { id: generateId(), type: "horizontal", entities: [lines[2].id] });
    newSketch.constraints.set(generateId(), { id: generateId(), type: "vertical", entities: [lines[1].id] });
    newSketch.constraints.set(generateId(), { id: generateId(), type: "vertical", entities: [lines[3].id] });

    setSketch(newSketch);
    solveSketch(newSketch);
    addToHistory(newSketch);

    // Reset
    setTempPoints([]);
    setTempGeometry(null);
    setRectInputs({
      active: false,
      widthValue: "",
      heightValue: "",
      activeField: "width",
      widthInputPos: { x: 0, y: 0 },
      heightInputPos: { x: 0, y: 0 },
    });

    const wMm = width / currentSketch.scaleFactor;
    const hMm = height / currentSketch.scaleFactor;
    toast.success(`Rectangle ${wMm.toFixed(1)} × ${hMm.toFixed(1)} mm`);
  }, [tempPoints, tempGeometry, rectInputs, createIntersectionPoints, solveSketch, addToHistory]);

  // === Multi-photos: détection de clic sur une image ===
  const findImageAtPosition = useCallback(
    (worldX: number, worldY: number): BackgroundImage | null => {
      // Chercher dans l'ordre inverse (les images du dessus d'abord)
      const sortedImages = [...backgroundImages]
        .filter((img) => img.visible && !img.locked)
        .sort((a, b) => b.order - a.order);

      for (const bgImage of sortedImages) {
        const imageToDraw = bgImage.transformedCanvas || bgImage.image;
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
    [backgroundImages],
  );

  // === Helpers pour calibration de l'image sélectionnée ===
  const getSelectedImage = useCallback(() => {
    if (!selectedImageId) return null;
    return backgroundImages.find((img) => img.id === selectedImageId) || null;
  }, [backgroundImages, selectedImageId]);

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

  const getSelectedImageCalibration = useCallback((): CalibrationData => {
    const selectedImage = getSelectedImage();
    if (selectedImage?.calibrationData) {
      return selectedImage.calibrationData;
    }
    // Retourner les données par défaut
    return {
      points: new Map(),
      pairs: new Map(),
      applied: false,
      mode: "simple",
    };
  }, [getSelectedImage]);

  const updateSelectedImageCalibration = useCallback(
    (updater: (prev: CalibrationData) => CalibrationData) => {
      if (!selectedImageId) return;
      setBackgroundImages((prev) =>
        prev.map((img) => {
          if (img.id !== selectedImageId) return img;
          const currentCalib = img.calibrationData || {
            points: new Map(),
            pairs: new Map(),
            applied: false,
            mode: "simple" as const,
          };
          return { ...img, calibrationData: updater(currentCalib) };
        }),
      );
    },
    [selectedImageId],
  );

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

          // Utiliser l'image transformée si elle existe, sinon l'originale
          const sourceImage = img.transformedCanvas || img.image;

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

  // Gestion de la souris
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = screenToWorld(screenX, screenY);

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
      const isCalibrationActive = calibrationMode !== "idle" && calibrationMode !== "selectRect";

      // === Sélection et drag des marqueurs ===
      if (activeTool === "select" && markerMode === "idle" && !isCalibrationActive) {
        // Chercher un marker sous le curseur
        const tolerance = 15 / viewport.scale;
        let foundMarker: { imageId: string; markerId: string; marker: ImageMarker; image: BackgroundImage } | null =
          null;

        for (const img of backgroundImages) {
          if (!img.visible || img.locked) continue;
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
          setSelectedImageId(foundMarker.imageId);

          // Désélectionner les entités géométriques
          setSelectedEntities(new Set());

          // Commencer le drag du marker
          setDraggingMarker({
            imageId: foundMarker.imageId,
            markerId: foundMarker.markerId,
            startPos: worldPos,
          });

          return;
        }
      }

      if (activeTool === "select" && backgroundImages.length > 0 && markerMode === "idle" && !isCalibrationActive) {
        const clickedImage = findImageAtPosition(worldPos.x, worldPos.y);
        if (clickedImage) {
          // Sélectionner l'image et préparer le drag
          setSelectedImageId(clickedImage.id);
          setSelectedMarkerId(null); // Désélectionner le marker
          setIsDraggingImage(true);
          setImageDragStart({
            x: worldPos.x,
            y: worldPos.y,
            imgX: clickedImage.x,
            imgY: clickedImage.y,
          });
          // Désélectionner les entités géométriques
          setSelectedEntities(new Set());
          return;
        } else {
          // Clic en dehors des images = désélectionner l'image et le marker
          if (selectedImageId) {
            setSelectedImageId(null);
          }
          if (selectedMarkerId) {
            setSelectedMarkerId(null);
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

      // Vérifier si on clique sur un point de calibration pour le déplacer
      if (showCalibrationPanel && calibrationMode === "idle") {
        const tolerance = 15 / viewport.scale;
        let clickedPoint: CalibrationPoint | null = null;

        calibrationData.points.forEach((point) => {
          const d = distance(worldPos, point);
          if (d < tolerance) {
            clickedPoint = point;
          }
        });

        if (clickedPoint) {
          setDraggingCalibrationPoint(clickedPoint.id);
          return;
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

        // Stocker les coordonnées relatives à l'image
        const relativeX = worldPos.x - selectedImage.x;
        const relativeY = worldPos.y - selectedImage.y;

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

        // Convertir la position du clic en coordonnées relatives à l'image
        const relativeX = worldPos.x - selectedImage.x;
        const relativeY = worldPos.y - selectedImage.y;

        imageCalib.points.forEach((point) => {
          const d = distance({ x: relativeX, y: relativeY }, point);
          if (d < tolerance && d < closestDist) {
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
            setCalibrationMode("idle");
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
      if (calibrationMode === "selectRect") {
        const tolerance = 15 / viewport.scale;
        let closestPoint: CalibrationPoint | null = null;
        let closestDist = Infinity;

        calibrationData.points.forEach((point) => {
          const d = distance(worldPos, point);
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
            toast.success("4 points sélectionnés ! Entrez les dimensions du rectangle.");
            setCalibrationMode("idle");
          }
        } else {
          toast.error("Cliquez sur un point de calibration");
        }
        return;
      }

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
          } else {
            // Clic dans le vide : commencer une sélection rectangulaire
            if (!e.shiftKey) {
              setSelectedEntities(new Set());
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
            };
            newSketch.geometries.set(line.id, line);

            // Détecter et créer les points d'intersection avec les segments existants
            createIntersectionPoints(line.id, newSketch);

            setSketch(newSketch);
            // NE PAS appeler solveSketch ici car il "corrige" les contraintes H/V
            // et annule les modifications manuelles de dimensions
            // solveSketch(newSketch);
            addToHistory(newSketch);

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
            };
            newSketch.geometries.set(circle.id, circle);

            // Créer les intersections avec les segments existants (coupe le cercle en arcs si nécessaire)
            createCircleIntersections(circle.id, center, center.id, radius, currentSketch.activeLayerId, newSketch);

            setSketch(newSketch);
            // NE PAS appeler solveSketch - évite de "corriger" les contraintes
            // solveSketch(newSketch);
            addToHistory(newSketch);

            setTempPoints([]);
            setTempGeometry(null);
          }
          break;
        }

        case "rectangle": {
          if (tempPoints.length === 0) {
            const p1: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };
            setTempPoints([p1]);
            setTempGeometry({ type: "rectangle", p1 });
            // Initialiser les inputs avec valeurs vides
            setRectInputs({
              active: true,
              widthValue: "",
              heightValue: "",
              activeField: "width",
              widthInputPos: { x: 0, y: 0 },
              heightInputPos: { x: 0, y: 0 },
            });
          } else {
            // Créer le rectangle avec les dimensions (inputs ou curseur)
            createRectangleFromInputs();
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
            addToHistory(newSketch);

            setTempPoints([]);
            setTempGeometry(null);
            toast.success("Courbe de Bézier créée");
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

          if (showCalibrationPanel || calibrationData.points.size > 0) {
            let closestCalibPoint: CalibrationPoint | null = null;
            let closestDist = Infinity;

            calibrationData.points.forEach((point) => {
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
            setMeasurements((prev) => [
              ...prev,
              {
                id: generateId(),
                start: measureState.start!,
                end: snapPos,
                px: distPx,
                mm: distMm,
                angle: angleDeg,
                segment1Id: segment1Id || undefined,
                segment2Id: segment2Id || undefined,
              },
            ]);

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
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

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
        setCalibrationData((prev) => {
          const newPoints = new Map(prev.points);
          const point = newPoints.get(draggingCalibrationPoint);
          if (point) {
            newPoints.set(draggingCalibrationPoint, {
              ...point,
              x: worldPos.x,
              y: worldPos.y,
            });
          }
          return { ...prev, points: newPoints };
        });
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
              }
            }
          });

          // Déplacer tous les points
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

        // Snap pendant le drag
        if (snapEnabled) {
          const snap = snapSystemRef.current.findSnapPoint(
            screenX,
            screenY,
            sketchRef.current,
            viewport,
            [dragTarget.id],
            markerSnapPoints,
          );
          if (snap) {
            targetPos = { x: snap.x, y: snap.y };
            setCurrentSnapPoint(snap);
          } else {
            setCurrentSnapPoint(null);
          }
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

      // Snap
      if (snapEnabled) {
        const snap = snapSystemRef.current.findSnapPoint(
          screenX,
          screenY,
          sketchRef.current,
          viewport,
          [],
          markerSnapPoints,
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

          // Détecter la perpendicularité avec les segments existants
          let perpInfo: typeof perpendicularInfo = null;
          const perpTolerance = 1.5; // degrés de tolérance (plus précis)
          const perpSnapDistance = 8 / viewport.scale; // distance de snap en monde (plus proche)

          // Direction de la ligne en cours
          const lineDir = {
            x: targetPos.x - startPoint.x,
            y: targetPos.y - startPoint.y,
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
                      (targetPos.x - snappedCursor.x) ** 2 + (targetPos.y - snappedCursor.y) ** 2,
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
                      targetPos = snappedCursor;
                    }
                  }
                }
              }
            });
          }

          setPerpendicularInfo(perpInfo);

          setTempGeometry({
            ...tempGeometry,
            cursor: targetPos,
          });
        } else if (tempGeometry.type === "circle" && tempPoints.length > 0) {
          setPerpendicularInfo(null);
          const radius = distance(tempPoints[0], targetPos);
          setTempGeometry({
            ...tempGeometry,
            radius,
          });
        } else if (tempGeometry.type === "rectangle") {
          setPerpendicularInfo(null);

          // Calculer les positions des inputs en coordonnées écran (mais ne pas modifier les valeurs)
          const p1 = tempGeometry.p1;

          // Calculer les positions des inputs en coordonnées écran
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            // Position du milieu du côté supérieur (pour largeur)
            const midTopX = (p1.x + targetPos.x) / 2;
            const topY = Math.min(p1.y, targetPos.y);
            const widthScreenPos = {
              x: midTopX * viewport.scale + viewport.offsetX,
              y: topY * viewport.scale + viewport.offsetY - 35,
            };

            // Position du milieu du côté gauche (pour hauteur)
            const leftX = Math.min(p1.x, targetPos.x);
            const midLeftY = (p1.y + targetPos.y) / 2;
            const heightScreenPos = {
              x: leftX * viewport.scale + viewport.offsetX - 75,
              y: midLeftY * viewport.scale + viewport.offsetY - 12,
            };

            setRectInputs((prev) => ({
              ...prev,
              active: true,
              widthInputPos: widthScreenPos,
              heightInputPos: heightScreenPos,
            }));
          }

          setTempGeometry({
            ...tempGeometry,
            cursor: targetPos,
          });
        } else if (tempGeometry.type === "bezier") {
          setPerpendicularInfo(null);
          setTempGeometry({
            ...tempGeometry,
            cursor: targetPos,
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

      // === Multi-photos: fin du drag d'une image ===
      if (isDraggingImage) {
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
          }

          if (isSelected) {
            newSelection.add(id);
          }
        });

        if (newSelection.size > 0) {
          setSelectedEntities(newSelection);
          const modeText = isWindowMode ? "fenêtre" : "capture";
          toast.success(`${newSelection.size} élément(s) sélectionné(s) (mode ${modeText})`);
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
      draggingMarker,
    ],
  );

  // Double-clic pour éditer un arc OU sélectionner une figure entière
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = screenToWorld(screenX, screenY);

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

          if (geo.type === "arc") {
            // Double-clic sur arc → sélectionner toute la figure connectée (comme les lignes)
            const connectedGeos = findConnectedGeometries(entityId);
            setSelectedEntities(connectedGeos);
            if (connectedGeos.size > 1) {
              toast.success(`${connectedGeos.size} élément(s) sélectionné(s)`);
            }
          } else if (geo.type === "line" || geo.type === "bezier") {
            // Double-clic sur ligne/bezier → sélectionner toute la figure connectée
            const connectedGeos = findConnectedGeometries(entityId);
            setSelectedEntities(connectedGeos);
            toast.success(`${connectedGeos.size} élément(s) sélectionné(s)`);
          }
        }
      }
    },
    [
      screenToWorld,
      findEntityAtPosition,
      findPointAtPosition,
      sketch.geometries,
      findConnectedGeometries,
      offsetDialog,
      selectContourForOffset,
      findLinesConnectedToPoint,
      openFilletDialogForPoint,
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
    addToHistory(newSketch);
    solveSketch(newSketch);
  }, [sketch, selectedEntities, solveSketch, addToHistory, lineIntersection]);

  // Undo/Redo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      const newIndex = historyIndex - 1;
      loadSketchData(prevState);
      setHistoryIndex(newIndex);
      historyRef.current = { ...historyRef.current, index: newIndex };
    }
  }, [history, historyIndex, loadSketchData]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      const newIndex = historyIndex + 1;
      loadSketchData(nextState);
      setHistoryIndex(newIndex);
      historyRef.current = { ...historyRef.current, index: newIndex };
    }
  }, [history, historyIndex, loadSketchData]);

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
    (offset = { x: 20, y: 20 }) => {
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
      const newSelectedEntities = new Set<string>();
      clipboard.geometries.forEach((geo) => {
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

  // Gestion clavier (DOIT être après les fonctions copySelectedEntities, pasteEntities, duplicateSelectedEntities)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Echap - annuler l'action en cours
      if (e.key === "Escape") {
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
        // D'abord vérifier si un marker est sélectionné
        if (selectedMarkerId) {
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
        // Supprimer l'image sélectionnée si elle existe
        if (selectedImageId) {
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
        // Sinon supprimer les entités géométriques sélectionnées
        if (selectedEntities.size > 0) {
          deleteSelectedEntities();
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
          case "r":
            setActiveTool("rectangle");
            resetMarkerMode();
            break;
          case "b":
            setActiveTool("bezier");
            resetMarkerMode();
            break;
          case "d":
            setActiveTool("dimension");
            resetMarkerMode();
            break;
          case "m":
            setActiveTool("measure");
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isFullscreen,
    selectedEntities,
    saveSketch,
    copySelectedEntities,
    pasteEntities,
    duplicateSelectedEntities,
    deleteSelectedEntities,
    undo,
    redo,
    fitToContent,
  ]);

  // === FONCTIONS DE CALIBRATION ===

  // Supprimer un point de calibration
  const deleteCalibrationPoint = useCallback((pointId: string) => {
    setCalibrationData((prev) => {
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
  }, []);

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

  // Mettre à jour la distance d'une paire (utilise l'image sélectionnée)
  const updatePairDistance = useCallback(
    (pairId: string, distanceMm: number) => {
      updateSelectedImageCalibration((prev) => {
        const newPairs = new Map(prev.pairs);
        const pair = newPairs.get(pairId);
        if (pair) {
          newPairs.set(pairId, { ...pair, distanceMm });
        }
        return { ...prev, pairs: newPairs };
      });
    },
    [updateSelectedImageCalibration],
  );

  // Mettre à jour la couleur d'une paire (utilise l'image sélectionnée)
  const updatePairColor = useCallback(
    (pairId: string, color: string) => {
      updateSelectedImageCalibration((prev) => {
        const newPairs = new Map(prev.pairs);
        const pair = newPairs.get(pairId);
        if (pair) {
          newPairs.set(pairId, { ...pair, color });
        }
        return { ...prev, pairs: newPairs };
      });
    },
    [updateSelectedImageCalibration],
  );

  // Calculer l'échelle à partir des paires (utilise l'image sélectionnée)
  const calculateCalibration = useCallback(() => {
    const imgCalib = getSelectedImageCalibration();
    if (imgCalib.pairs.size === 0) {
      toast.error("Ajoutez au moins une paire de calibration");
      return;
    }

    let totalScale = 0;
    let count = 0;

    imgCalib.pairs.forEach((pair) => {
      const p1 = imgCalib.points.get(pair.point1Id);
      const p2 = imgCalib.points.get(pair.point2Id);
      if (p1 && p2 && pair.distanceMm > 0) {
        const distPx = distance(p1, p2);
        const scale = pair.distanceMm / distPx;
        totalScale += scale;
        count++;
      }
    });

    if (count === 0) {
      toast.error("Aucune paire valide");
      return;
    }

    const avgScale = totalScale / count;

    // Calculer l'erreur moyenne
    let totalError = 0;
    imgCalib.pairs.forEach((pair) => {
      const p1 = imgCalib.points.get(pair.point1Id);
      const p2 = imgCalib.points.get(pair.point2Id);
      if (p1 && p2) {
        const distPx = distance(p1, p2);
        const calculatedMm = distPx * avgScale;
        const error = (Math.abs(calculatedMm - pair.distanceMm) / pair.distanceMm) * 100;
        totalError += error;
      }
    });
    const avgError = totalError / count;

    updateSelectedImageCalibration((prev) => ({
      ...prev,
      scale: avgScale,
      error: avgError,
    }));

    toast.success(`Échelle calculée : ${avgScale.toFixed(4)} mm/px (erreur : ${avgError.toFixed(1)}%)`);
  }, [getSelectedImageCalibration, updateSelectedImageCalibration]);

  // Appliquer la calibration au sketch
  const applyCalibration = useCallback(async () => {
    // Mode simple : échelle uniforme
    if (calibrationData.mode === "simple" || !calibrationData.mode) {
      if (!calibrationData.scale) {
        toast.error("Calculez d'abord la calibration");
        return;
      }

      const scale = calibrationData.scale; // mm/px

      // Convertir les points de calibration existants en mm
      const newCalibPoints = new Map<string, CalibrationPoint>();
      calibrationData.points.forEach((point, id) => {
        newCalibPoints.set(id, {
          ...point,
          x: point.x * scale,
          y: point.y * scale,
        });
      });

      // Convertir les points du sketch en mm
      const newSketchPoints = new Map(sketch.points);
      newSketchPoints.forEach((point, id) => {
        newSketchPoints.set(id, {
          ...point,
          x: point.x * scale,
          y: point.y * scale,
        });
      });

      // Convertir les géométries avec rayon (cercles)
      const newGeometries = new Map(sketch.geometries);
      newGeometries.forEach((geo, id) => {
        if (geo.type === "circle") {
          const circle = geo as any;
          newGeometries.set(id, {
            ...circle,
            radius: circle.radius * scale,
          });
        }
      });

      // Mettre à jour l'échelle de l'image
      setImageScale(scale);

      // Mettre à jour les points de calibration convertis
      setCalibrationData((prev) => ({
        ...prev,
        points: newCalibPoints,
        applied: true,
      }));

      // Mettre à jour le sketch avec scaleFactor = 1 (tout est en mm maintenant)
      setSketch((prev) => ({
        ...prev,
        points: newSketchPoints,
        geometries: newGeometries,
        scaleFactor: 1, // Coordonnées maintenant en mm
      }));

      toast.success(`Calibration appliquée ! Image mise à l'échelle (${scale.toFixed(4)} mm/px)`);
      return;
    }

    // Mode perspective : correction de déformation
    if (calibrationData.mode === "perspective") {
      // Vérifier qu'on a les 4 points
      if (rectPoints.length !== 4) {
        toast.error("Sélectionnez 4 points pour la référence");
        return;
      }

      if (!backgroundImageRef.current) {
        toast.error("Aucune image de fond chargée");
        return;
      }

      // Récupérer les coordonnées des 4 points
      const quadPoints = rectPoints.map((id) => {
        const point = calibrationData.points.get(id);
        if (!point) throw new Error(`Point ${id} non trouvé`);
        return { x: point.x, y: point.y };
      });

      try {
        let H: HomographyMatrix;
        let mmPerPx: number;
        let distortion: DistortionCoefficients | undefined;

        if (perspectiveMethod === "rectangle") {
          // Mode Rectangle
          const widthMm = parseFloat(rectWidth.replace(",", "."));
          const heightMm = parseFloat(rectHeight.replace(",", "."));

          if (isNaN(widthMm) || widthMm <= 0 || isNaN(heightMm) || heightMm <= 0) {
            toast.error("Entrez les dimensions du rectangle (largeur et hauteur en mm)");
            return;
          }

          // Calculer l'homographie
          const result = createRectifyingHomography(
            quadPoints,
            widthMm,
            heightMm,
            backgroundImageRef.current.width,
            backgroundImageRef.current.height,
          );
          H = result.H;
          mmPerPx = 1 / result.scale;
        } else {
          // Mode Damier
          const cornersX = parseInt(checkerCornersX);
          const cornersY = parseInt(checkerCornersY);
          const squareSize = parseFloat(checkerSquareSize.replace(",", "."));

          if (isNaN(cornersX) || cornersX < 2 || isNaN(cornersY) || cornersY < 2) {
            toast.error("Configuration du damier invalide");
            return;
          }
          if (isNaN(squareSize) || squareSize <= 0) {
            toast.error("Entrez la taille d'une case en mm");
            return;
          }

          // Calibration par damier (homographie + distorsion)
          const result = calibrateWithCheckerboard(
            quadPoints,
            cornersX,
            cornersY,
            squareSize,
            backgroundImageRef.current.width,
            backgroundImageRef.current.height,
          );
          H = result.homography;
          mmPerPx = result.scale;
          distortion = result.distortion;

          // Log pour debug
          console.log("Distorsion calculée:", distortion);
        }

        // Calculer les dimensions de l'image transformée
        const bounds = computeTransformedBounds(H, backgroundImageRef.current.width, backgroundImageRef.current.height);

        // Créer l'image déformée (avec correction de distorsion si damier)
        let finalImageData: ImageData;

        if (distortion && (Math.abs(distortion.k1) > 0.001 || Math.abs(distortion.k2) > 0.001)) {
          // D'abord corriger la distorsion radiale
          const undistorted = undistortImage(backgroundImageRef.current, distortion);

          // Créer un canvas temporaire
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = undistorted.width;
          tempCanvas.height = undistorted.height;
          const tempCtx = tempCanvas.getContext("2d")!;
          tempCtx.putImageData(undistorted, 0, 0);

          // Puis appliquer l'homographie
          const tempImage = document.createElement("img") as HTMLImageElement;
          tempImage.src = tempCanvas.toDataURL();
          await new Promise<void>((resolve) => {
            tempImage.onload = () => resolve();
          });

          finalImageData = warpImage(
            tempImage,
            H,
            Math.ceil(bounds.width),
            Math.ceil(bounds.height),
            Math.ceil(bounds.width / 2),
            Math.ceil(bounds.height / 2),
          );
        } else {
          // Seulement l'homographie
          finalImageData = warpImage(
            backgroundImageRef.current,
            H,
            Math.ceil(bounds.width),
            Math.ceil(bounds.height),
            Math.ceil(bounds.width / 2),
            Math.ceil(bounds.height / 2),
          );
        }

        // Créer un canvas pour l'image déformée
        const warpedCanvas = document.createElement("canvas");
        warpedCanvas.width = finalImageData.width;
        warpedCanvas.height = finalImageData.height;
        const ctx = warpedCanvas.getContext("2d")!;
        ctx.putImageData(finalImageData, 0, 0);

        setTransformedImage(warpedCanvas);

        // Transformer les points de calibration vers le nouveau système de coordonnées
        const newCalibPoints = new Map<string, CalibrationPoint>();
        calibrationData.points.forEach((point, id) => {
          // Convertir en coordonnées centrées
          let srcX = point.x - backgroundImageRef.current!.width / 2;
          let srcY = point.y - backgroundImageRef.current!.height / 2;

          // Corriger la distorsion si nécessaire
          if (distortion) {
            const undist = undistortPoint(
              { x: srcX, y: srcY },
              distortion,
              backgroundImageRef.current!.width,
              backgroundImageRef.current!.height,
            );
            srcX = undist.x;
            srcY = undist.y;
          }

          // Appliquer la transformation
          const transformed = transformPoint(H, { x: srcX, y: srcY });
          // Convertir en mm
          newCalibPoints.set(id, {
            ...point,
            x: transformed.x * mmPerPx,
            y: transformed.y * mmPerPx,
          });
        });

        // Transformer les points du sketch
        const newSketchPoints = new Map(sketch.points);
        newSketchPoints.forEach((point, id) => {
          let srcX = point.x - backgroundImageRef.current!.width / 2;
          let srcY = point.y - backgroundImageRef.current!.height / 2;

          if (distortion) {
            const undist = undistortPoint(
              { x: srcX, y: srcY },
              distortion,
              backgroundImageRef.current!.width,
              backgroundImageRef.current!.height,
            );
            srcX = undist.x;
            srcY = undist.y;
          }

          const transformed = transformPoint(H, { x: srcX, y: srcY });
          newSketchPoints.set(id, {
            ...point,
            x: transformed.x * mmPerPx,
            y: transformed.y * mmPerPx,
          });
        });

        // Convertir les géométries avec rayon (cercles) - approximation
        const newGeometries = new Map(sketch.geometries);
        newGeometries.forEach((geo, id) => {
          if (geo.type === "circle") {
            const circle = geo as any;
            newGeometries.set(id, {
              ...circle,
              radius: circle.radius * mmPerPx,
            });
          }
        });

        // Mettre à jour l'échelle pour le rendu
        setImageScale(mmPerPx);

        // Mettre à jour les données de calibration
        setCalibrationData((prev) => ({
          ...prev,
          points: newCalibPoints,
          applied: true,
          perspectiveMethod,
          homography: H,
          distortion,
          referenceRect:
            perspectiveMethod === "rectangle"
              ? {
                  pointIds: rectPoints,
                  widthMm: parseFloat(rectWidth.replace(",", ".")),
                  heightMm: parseFloat(rectHeight.replace(",", ".")),
                }
              : undefined,
          checkerboard:
            perspectiveMethod === "checkerboard"
              ? {
                  cornersX: parseInt(checkerCornersX),
                  cornersY: parseInt(checkerCornersY),
                  squareSizeMm: parseFloat(checkerSquareSize.replace(",", ".")),
                  cornerPointIds: rectPoints,
                }
              : undefined,
        }));

        // Mettre à jour le sketch
        setSketch((prev) => ({
          ...prev,
          points: newSketchPoints,
          geometries: newGeometries,
          scaleFactor: 1,
        }));

        const methodLabel =
          perspectiveMethod === "rectangle"
            ? `Rectangle ${rectWidth}×${rectHeight} mm`
            : `Damier ${parseInt(checkerCornersX) + 1}×${parseInt(checkerCornersY) + 1} cases`;
        toast.success(`Correction de perspective appliquée ! ${methodLabel}`);

        if (distortion && (Math.abs(distortion.k1) > 0.01 || Math.abs(distortion.k2) > 0.01)) {
          toast.info(`Distorsion radiale corrigée (k1=${distortion.k1.toFixed(4)}, k2=${distortion.k2.toFixed(4)})`);
        }
      } catch (error) {
        console.error("Erreur calibration:", error);
        toast.error(`Erreur: ${error instanceof Error ? error.message : "Calcul impossible"}`);
      }
    }
  }, [
    calibrationData,
    sketch,
    rectPoints,
    rectWidth,
    rectHeight,
    perspectiveMethod,
    checkerCornersX,
    checkerCornersY,
    checkerSquareSize,
  ]);

  // Réinitialiser la calibration
  const resetCalibration = useCallback(() => {
    if (calibrationData.applied) {
      toast.info("Les coordonnées ont été converties. Suppression des points de calibration uniquement.");
    }
    setCalibrationData({
      points: new Map(),
      pairs: new Map(),
      applied: calibrationData.applied, // Garder le flag applied si déjà appliqué
      mode: "simple",
    });
    setCalibrationMode("idle");
    setSelectedCalibrationPoint(null);
    // Reset du mode perspective
    setRectPoints([]);
    setRectWidth("");
    setRectHeight("");
    // Ne pas reset imageScale si déjà appliqué pour ne pas casser l'échelle
    if (!calibrationData.applied) {
      setImageScale(1);
      setTransformedImage(null);
    }
    toast.success("Points de calibration supprimés");
  }, [calibrationData.applied]);

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

      toast.success(`Contrainte "${type}" ajoutée`);
    },
    [sketch, solveSketch, addToHistory],
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

  // Export DXF
  const handleExportDXF = useCallback(() => {
    const dxfContent = exportToDXF(sketch);
    const blob = new Blob([dxfContent], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `gabarit-${templateId}.dxf`;
    a.click();

    URL.revokeObjectURL(url);
    toast.success("DXF exporté pour Fusion 360 !");
  }, [sketch, templateId]);

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

  return (
    <div ref={containerRef} className={`flex flex-col ${isFullscreen ? "fixed inset-0 z-50 bg-white" : "h-[700px]"}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-gray-100 border-b flex-wrap">
        {/* Outils de sélection/navigation */}
        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
          <ToolButton tool="select" icon={MousePointer} label="Sélection" shortcut="V" />
          <ToolButton tool="pan" icon={Hand} label="Déplacer" shortcut="H" />
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Outils de dessin */}
        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
          <ToolButton tool="line" icon={Minus} label="Ligne" shortcut="L" />
          <ToolButton tool="circle" icon={Circle} label="Cercle" shortcut="C" />
          <ToolButton tool="rectangle" icon={Square} label="Rectangle" shortcut="R" />
          <ToolButton tool="bezier" icon={Spline} label="Courbe Bézier" shortcut="B" />
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Import DXF */}
        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
          <input ref={dxfInputRef} type="file" accept=".dxf" onChange={handleDXFImport} className="hidden" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => dxfInputRef.current?.click()} className="h-9 px-2">
                  <FileUp className="h-4 w-4 mr-1" />
                  <span className="text-xs">Import DXF</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Importer un fichier DXF</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Image de fond (Multi-photos) */}
        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-9 px-2">
                  <Image className="h-4 w-4 mr-1" />
                  <span className="text-xs">Photos</span>
                  {backgroundImages.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                      {backgroundImages.length}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Charger une ou plusieurs photos (multi-sélection possible)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {backgroundImages.length > 0 && (
            <>
              <Button
                variant={showBackgroundImage ? "default" : "outline"}
                size="sm"
                onClick={() => setShowBackgroundImage(!showBackgroundImage)}
                className="h-9 w-9 p-0"
              >
                {showBackgroundImage ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>

              {/* Menu de gestion des photos */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 px-2">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Photos ({backgroundImages.length})
                  </div>
                  <DropdownMenuSeparator />
                  {backgroundImages.map((img) => (
                    <DropdownMenuItem
                      key={img.id}
                      className={`flex items-center justify-between ${selectedImageId === img.id ? "bg-blue-50" : ""}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedImageId(img.id === selectedImageId ? null : img.id);
                      }}
                    >
                      <span className="text-xs truncate max-w-[140px]">{img.name}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBackgroundImages((prev) =>
                              prev.map((i) => (i.id === img.id ? { ...i, visible: !i.visible } : i)),
                            );
                          }}
                        >
                          {img.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBackgroundImages((prev) => prev.filter((i) => i.id !== img.id));
                            if (selectedImageId === img.id) setSelectedImageId(null);
                            toast.success("Photo supprimée");
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-500"
                    onClick={() => {
                      setBackgroundImages([]);
                      setSelectedImageId(null);
                      toast.success("Toutes les photos supprimées");
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer toutes les photos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-1 ml-1">
                <span className="text-xs text-muted-foreground">Opacité:</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={imageOpacity}
                  onChange={(e) => {
                    const newOpacity = parseFloat(e.target.value);
                    setImageOpacity(newOpacity);
                    // Appliquer l'opacité à toutes les images
                    setBackgroundImages((prev) => prev.map((img) => ({ ...img, opacity: newOpacity })));
                  }}
                  className="w-16 h-1"
                />
              </div>

              {/* Marqueurs inter-photos */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={markerMode === "addMarker" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (markerMode === "addMarker") {
                          setMarkerMode("idle");
                        } else {
                          setMarkerMode("addMarker");
                          toast.info("Cliquez sur une photo pour ajouter un marqueur");
                        }
                      }}
                      className="h-9 px-2"
                    >
                      <MapPin className="h-4 w-4 mr-1" />
                      <span className="text-xs">Marqueur</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ajouter un point de référence sur une photo</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={markerMode === "linkMarker1" || markerMode === "linkMarker2" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (markerMode === "linkMarker1" || markerMode === "linkMarker2") {
                          setMarkerMode("idle");
                          setPendingLink(null);
                        } else {
                          // Vérifier qu'il y a au moins 2 marqueurs sur des photos différentes
                          const imagesWithMarkers = backgroundImages.filter((img) => img.markers.length > 0);
                          if (imagesWithMarkers.length < 2) {
                            toast.error("Ajoutez au moins 1 marqueur sur 2 photos différentes");
                            return;
                          }
                          setMarkerMode("linkMarker1");
                          toast.info("Cliquez sur le 1er marqueur");
                        }
                      }}
                      className="h-9 px-2"
                    >
                      <Link2 className="h-4 w-4 mr-1" />
                      <span className="text-xs">Lier</span>
                      {markerLinks.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                          {markerLinks.length}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Lier 2 marqueurs avec une distance connue</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Separator orientation="vertical" className="h-6 mx-1" />

              {/* Bouton Calibration */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showCalibrationPanel ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (!showCalibrationPanel && backgroundImages.length > 0 && !selectedImageId) {
                          toast.error("Sélectionnez d'abord une photo à calibrer");
                          return;
                        }
                        setShowCalibrationPanel(!showCalibrationPanel);
                      }}
                      className="h-9 px-2"
                    >
                      <Target className="h-4 w-4 mr-1" />
                      <span className="text-xs">Calibrer</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Calibration multi-points (sélectionnez une photo)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Cotations et contraintes */}
        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
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
          <ToolButton tool="measure" icon={Ruler} label="Mesurer" shortcut="M" />

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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Modifications: Fillet et Chamfer */}
        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2" onClick={openFilletDialog}>
                  {/* Icône congé: angle arrondi */}
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 20 L4 12 Q4 4 12 4 L20 4" strokeLinecap="round" />
                  </svg>
                  <span className="text-xs">R{filletRadius}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Congé - Sélectionnez 2 lignes, 1 coin, ou une figure entière</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Réglage rayon congé */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-5 p-0">
                <Settings className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <div className="p-2">
                <Label className="text-xs">Rayon congé (mm)</Label>
                <Input
                  type="number"
                  value={filletRadius}
                  onChange={(e) => setFilletRadius(Math.max(1, parseFloat(e.target.value) || 1))}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="w-20 h-7 mt-1"
                  min="1"
                  step="1"
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6 mx-1" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2" onClick={openChamferDialog}>
                  {/* Icône chanfrein: angle coupé */}
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 20 L4 10 L10 4 L20 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-xs">{chamferDistance}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Chanfrein - Sélectionnez 2 lignes, 1 coin, ou une figure entière</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Réglage distance chanfrein */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-5 p-0">
                <Settings className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <div className="p-2">
                <Label className="text-xs">Distance chanfrein (mm)</Label>
                <Input
                  type="number"
                  value={chamferDistance}
                  onChange={(e) => setChamferDistance(Math.max(1, parseFloat(e.target.value) || 1))}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="w-20 h-7 mt-1"
                  min="1"
                  step="1"
                />
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
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Zoom */}
        <div className="flex items-center gap-1">
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
            <Maximize className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetView} title="Reset vue">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
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
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Toggles */}
        <div className="flex items-center gap-1">
          <Button
            variant={showGrid ? "default" : "outline"}
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
            className="h-8 px-2"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={snapEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setSnapEnabled(!snapEnabled)}
            className="h-8 px-2"
          >
            <Magnet className="h-4 w-4" />
          </Button>

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
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Actions */}
        <Button variant="outline" size="sm" onClick={saveSketch}>
          <Save className="h-4 w-4 mr-1" />
          Sauver
        </Button>

        <Button variant="outline" size="sm" onClick={handleExportSVG}>
          <FileDown className="h-4 w-4 mr-1" />
          SVG
        </Button>

        <Button variant="default" size="sm" onClick={handleExportDXF}>
          <Download className="h-4 w-4 mr-1" />
          DXF
        </Button>

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
      </div>

      {/* Zone principale avec Canvas + Panneau latéral */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas + Onglets calques */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Barre d'onglets des calques EN HAUT (style Excel) */}
          <div className="h-8 border-b bg-gray-100 flex items-end px-1 gap-0.5 overflow-x-auto">
            {Array.from(sketch.layers.values())
              .sort((a, b) => a.order - b.order)
              .map((layer) => (
                <div
                  key={layer.id}
                  className={`
                    flex items-center gap-1.5 px-3 h-7 rounded-t-md cursor-pointer select-none
                    transition-all duration-150 text-xs font-medium border border-b-0
                    ${
                      layer.id === sketch.activeLayerId
                        ? "bg-white border-blue-400 text-blue-700 mb-[-1px] z-10 shadow-sm"
                        : "bg-gray-200 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                    }
                  `}
                  onClick={() => setSketch((prev) => ({ ...prev, activeLayerId: layer.id }))}
                >
                  {/* Indicateur de couleur */}
                  <div
                    className="w-2.5 h-2.5 rounded-sm border border-gray-400/50"
                    style={{ backgroundColor: layer.color }}
                  />
                  {/* Nom du calque */}
                  <span className="whitespace-nowrap">{layer.name}</span>
                  {/* Bouton visibilité */}
                  <button
                    className={`p-0.5 rounded hover:bg-blue-100 ${!layer.visible ? "opacity-40" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSketch((prev) => {
                        const newLayers = new Map(prev.layers);
                        const l = newLayers.get(layer.id);
                        if (l) {
                          newLayers.set(layer.id, { ...l, visible: !l.visible });
                        }
                        return { ...prev, layers: newLayers };
                      });
                    }}
                    title={layer.visible ? "Masquer le calque" : "Afficher le calque"}
                  >
                    {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </button>
                  {/* Bouton supprimer (seulement si plus d'un calque) */}
                  {sketch.layers.size > 1 && (
                    <button
                      className="p-0.5 rounded hover:bg-red-100 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSketch((prev) => {
                          const newLayers = new Map(prev.layers);
                          newLayers.delete(layer.id);
                          // Si on supprime le calque actif, sélectionner le premier restant
                          let newActiveLayerId = prev.activeLayerId;
                          if (prev.activeLayerId === layer.id) {
                            newActiveLayerId = Array.from(newLayers.keys())[0];
                          }
                          return { ...prev, layers: newLayers, activeLayerId: newActiveLayerId };
                        });
                        toast.success(`Calque "${layer.name}" supprimé`);
                      }}
                      title="Supprimer le calque"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}

            {/* Bouton + pour ajouter un calque */}
            <button
              className="flex items-center justify-center w-7 h-7 rounded-t-md border border-b-0 border-dashed border-gray-300 
                         text-gray-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all"
              onClick={() => {
                const layerColors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];
                const newLayerId = generateId();
                const layerCount = sketch.layers.size;
                const newLayer: Layer = {
                  id: newLayerId,
                  name: `Calque ${layerCount + 1}`,
                  color: layerColors[layerCount % layerColors.length],
                  visible: true,
                  locked: false,
                  order: layerCount,
                };
                setSketch((prev) => {
                  const newLayers = new Map(prev.layers);
                  newLayers.set(newLayerId, newLayer);
                  return { ...prev, layers: newLayers, activeLayerId: newLayerId };
                });
                toast.success(`Calque "${newLayer.name}" créé`);
              }}
              title="Ajouter un calque"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

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
                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;

                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                const worldPos = screenToWorld(screenX, screenY);
                const tolerance = 10 / viewport.scale;

                // D'abord chercher si on est sur un point (coin potentiel)
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
                  }
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
                  setContextMenu(null);
                }
              }}
            />

            {/* Inputs de saisie rectangle (style Fusion 360) */}
            {rectInputs.active && tempGeometry?.type === "rectangle" && tempGeometry.cursor && (
              <>
                {/* Input largeur (horizontal - en haut) */}
                <div
                  className="absolute z-50 flex items-center"
                  style={{
                    left: `${rectInputs.widthInputPos.x}px`,
                    top: `${rectInputs.widthInputPos.y}px`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <input
                    ref={widthInputRef}
                    type="text"
                    inputMode="decimal"
                    value={rectInputs.widthValue}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".");
                      setRectInputs((prev) => ({ ...prev, widthValue: val }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        setRectInputs((prev) => ({ ...prev, activeField: "height" }));
                        heightInputRef.current?.focus();
                        heightInputRef.current?.select();
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        createRectangleFromInputs();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setTempPoints([]);
                        setTempGeometry(null);
                        setRectInputs({
                          active: false,
                          widthValue: "",
                          heightValue: "",
                          activeField: "width",
                          widthInputPos: { x: 0, y: 0 },
                          heightInputPos: { x: 0, y: 0 },
                        });
                      }
                    }}
                    className={`w-16 h-7 px-2 text-center text-sm font-medium rounded border-2 shadow-lg outline-none ${
                      rectInputs.activeField === "width"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-300 bg-white text-gray-700"
                    }`}
                    placeholder="L"
                    autoFocus={rectInputs.activeField === "width"}
                  />
                  <span className="ml-1 text-xs text-gray-500 font-medium bg-white/80 px-1 rounded">mm</span>
                </div>

                {/* Input hauteur (vertical - à gauche) */}
                <div
                  className="absolute z-50 flex items-center"
                  style={{
                    left: `${rectInputs.heightInputPos.x}px`,
                    top: `${rectInputs.heightInputPos.y}px`,
                  }}
                >
                  <input
                    ref={heightInputRef}
                    type="text"
                    inputMode="decimal"
                    value={rectInputs.heightValue}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".");
                      setRectInputs((prev) => ({ ...prev, heightValue: val }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        setRectInputs((prev) => ({ ...prev, activeField: "width" }));
                        widthInputRef.current?.focus();
                        widthInputRef.current?.select();
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        createRectangleFromInputs();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setTempPoints([]);
                        setTempGeometry(null);
                        setRectInputs({
                          active: false,
                          widthValue: "",
                          heightValue: "",
                          activeField: "width",
                          widthInputPos: { x: 0, y: 0 },
                          heightInputPos: { x: 0, y: 0 },
                        });
                      }
                    }}
                    className={`w-16 h-7 px-2 text-center text-sm font-medium rounded border-2 shadow-lg outline-none ${
                      rectInputs.activeField === "height"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-300 bg-white text-gray-700"
                    }`}
                    placeholder="H"
                  />
                  <span className="ml-1 text-xs text-gray-500 font-medium bg-white/80 px-1 rounded">mm</span>
                </div>
              </>
            )}

            {/* Indicateur discret pour l'outil de mesure - sous la toolbar */}
            {activeTool === "measure" && (
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-green-50 border border-green-200 rounded px-3 py-1 flex items-center gap-2 text-sm shadow-sm z-10">
                <Ruler className="h-4 w-4 text-green-600" />
                <span className="text-green-700">
                  {measureState.phase === "idle"
                    ? "1er point"
                    : measureState.phase === "waitingSecond"
                      ? "2ème point"
                      : ""}
                </span>
                {measurements.length > 0 && (
                  <span className="text-green-600 font-medium ml-1">({measurements.length})</span>
                )}
              </div>
            )}

            {/* Indicateur de longueur des segments sélectionnés - coin supérieur droit */}
            {selectedLength && (
              <div className="absolute top-2 right-2 bg-gray-100/90 border border-gray-300 rounded px-2 py-1 text-xs text-gray-600 shadow-sm z-10">
                <span className="font-medium">{selectedLength.mm.toFixed(1)} mm</span>
                {selectedLength.count > 1 && <span className="text-gray-400 ml-1">({selectedLength.count})</span>}
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

        {/* Panneau de calibration */}
        {showCalibrationPanel && (
          <div className="w-80 border-l bg-white flex flex-col">
            {/* En-tête */}
            <div className="p-3 border-b flex flex-col gap-1 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-red-500" />
                  <span className="font-semibold">Calibration</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCalibrationPanel(false);
                    setCalibrationMode("idle");
                    setSelectedCalibrationPoint(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Photo sélectionnée */}
              {selectedImageId && getSelectedImage() ? (
                <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded truncate">
                  📷 {getSelectedImage()?.name}
                </div>
              ) : backgroundImages.length > 0 ? (
                <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">⚠️ Sélectionnez une photo</div>
              ) : null}
            </div>

            {/* Contenu */}
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                {/* Actions */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant={calibrationMode === "addPoint" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setCalibrationMode(calibrationMode === "addPoint" ? "idle" : "addPoint")}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter point
                    </Button>
                    <Button
                      variant={
                        calibrationMode === "selectPair1" || calibrationMode === "selectPair2" ? "default" : "outline"
                      }
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const imgCalib = getSelectedImageCalibration();
                        if (imgCalib.points.size < 2) {
                          toast.error("Ajoutez au moins 2 points");
                          return;
                        }
                        setCalibrationMode("selectPair1");
                        setSelectedCalibrationPoint(null);
                      }}
                    >
                      <Link className="h-4 w-4 mr-1" />
                      Créer paire
                    </Button>
                  </div>

                  {/* Mode actif */}
                  {calibrationMode !== "idle" && calibrationMode !== "selectRect" && (
                    <div className="p-2 bg-blue-50 rounded text-sm text-blue-700">
                      {calibrationMode === "addPoint" && "📍 Cliquez sur l'image pour placer un point"}
                      {calibrationMode === "selectPair1" && "1️⃣ Cliquez sur le 1er point"}
                      {calibrationMode === "selectPair2" && "2️⃣ Cliquez sur le 2ème point"}
                    </div>
                  )}

                  {/* Configuration nouvelle paire */}
                  {(calibrationMode === "selectPair1" || calibrationMode === "selectPair2") && (
                    <div className="space-y-2 p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs w-20">Distance:</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={newPairDistance}
                          onChange={(e) => {
                            // Accepter chiffres, point et virgule
                            const val = e.target.value.replace(/[^0-9.,]/g, "");
                            setNewPairDistance(val);
                          }}
                          onFocus={(e) => {
                            if (e.target.value === "0") {
                              setNewPairDistance("");
                            }
                          }}
                          placeholder="auto"
                          className="h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">mm</span>
                      </div>
                      <p className="text-xs text-muted-foreground italic">Laissez vide pour estimation auto</p>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs w-20">Couleur:</Label>
                        <div className="flex gap-1 flex-wrap">
                          {CALIBRATION_COLORS.map((color) => (
                            <button
                              key={color}
                              className={`w-5 h-5 rounded-full border-2 ${newPairColor === color ? "border-gray-800" : "border-transparent"}`}
                              style={{ backgroundColor: color }}
                              onClick={() => setNewPairColor(color)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Points de calibration - utilise l'image sélectionnée */}
                {(() => {
                  const imgCalib = getSelectedImageCalibration();
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Points ({imgCalib.points.size})</span>
                        {imgCalib.points.size > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              updateSelectedImageCalibration(() => ({
                                points: new Map(),
                                pairs: new Map(),
                                applied: false,
                                mode: "simple",
                              }));
                              toast.success("Calibration réinitialisée");
                            }}
                            className="h-6 text-xs text-red-500 hover:text-red-700"
                          >
                            Tout supprimer
                          </Button>
                        )}
                      </div>

                      {imgCalib.points.size === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Aucun point</p>
                      ) : (
                        <div className="space-y-1">
                          {Array.from(imgCalib.points.values()).map((point) => (
                            <div
                              key={point.id}
                              className="flex items-center justify-between p-1.5 bg-gray-50 rounded text-sm"
                            >
                              <span>
                                <span className="font-medium text-red-500">Point {point.label}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({point.x.toFixed(0)}, {point.y.toFixed(0)})
                                </span>
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  updateSelectedImageCalibration((prev) => {
                                    const newPoints = new Map(prev.points);
                                    newPoints.delete(point.id);
                                    // Supprimer aussi les paires qui utilisent ce point
                                    const newPairs = new Map(prev.pairs);
                                    prev.pairs.forEach((pair, id) => {
                                      if (pair.point1Id === point.id || pair.point2Id === point.id) {
                                        newPairs.delete(id);
                                      }
                                    });
                                    return { ...prev, points: newPoints, pairs: newPairs };
                                  });
                                }}
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <Separator />

                {/* Paires de calibration - utilise l'image sélectionnée */}
                {(() => {
                  const imgCalib = getSelectedImageCalibration();
                  return (
                    <div>
                      <span className="text-sm font-medium">Paires ({imgCalib.pairs.size})</span>

                      {imgCalib.pairs.size === 0 ? (
                        <p className="text-xs text-muted-foreground italic mt-2">Aucune paire</p>
                      ) : (
                        <div className="space-y-2 mt-2">
                          {Array.from(imgCalib.pairs.values()).map((pair) => {
                            const p1 = imgCalib.points.get(pair.point1Id);
                            const p2 = imgCalib.points.get(pair.point2Id);
                            const distPx = p1 && p2 ? distance(p1, p2) : 0;
                            const pairScale = distPx > 0 ? pair.distanceMm / distPx : 0;
                            const measuredWithAvgScale = imgCalib.scale ? distPx * imgCalib.scale : 0;
                            const errorMm = measuredWithAvgScale - pair.distanceMm;

                            return (
                              <div key={pair.id} className="p-2 bg-gray-50 rounded space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: pair.color }} />
                                    <span className="font-medium text-sm">
                                      {p1?.label} ↔ {p2?.label}
                                    </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteCalibrationPair(pair.id)}
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={pair.distanceMm}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
                                      updatePairDistance(pair.id, parseFloat(val) || 0);
                                    }}
                                    onFocus={(e) => {
                                      if (e.target.value === "0") {
                                        e.target.select();
                                      }
                                    }}
                                    className="h-7 text-sm flex-1"
                                  />
                                  <span className="text-xs text-muted-foreground">mm</span>
                                </div>
                                <div className="text-xs space-y-0.5">
                                  <p className="text-muted-foreground">
                                    Mesuré: {distPx.toFixed(1)} px = {pair.distanceMm} mm
                                  </p>
                                  <p className="text-muted-foreground">Échelle: {pairScale.toFixed(4)} mm/px</p>
                                  {imgCalib.scale && (
                                    <p
                                      className={`font-medium ${Math.abs(errorMm) < 0.5 ? "text-green-600" : Math.abs(errorMm) < 2 ? "text-orange-500" : "text-red-500"}`}
                                    >
                                      → Estimé: {measuredWithAvgScale.toFixed(1)} mm ({errorMm >= 0 ? "+" : ""}
                                      {errorMm.toFixed(1)} mm)
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex gap-1">
                                    {CALIBRATION_COLORS.slice(0, 5).map((color) => (
                                      <button
                                        key={color}
                                        className={`w-3 h-3 rounded-full border ${pair.color === color ? "border-gray-800 border-2" : "border-gray-300"}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => updatePairColor(pair.id, color)}
                                      />
                                    ))}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-xs px-2"
                                    onClick={() => {
                                      updateSelectedImageCalibration((prev) => ({
                                        ...prev,
                                        scale: pairScale,
                                        error: 0,
                                      }));
                                      toast.success(
                                        `Échelle définie: ${pairScale.toFixed(4)} mm/px (paire ${p1?.label}-${p2?.label})`,
                                      );
                                    }}
                                  >
                                    Utiliser
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <Separator />

                {/* Mode de calibration */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Mode</span>
                  <div className="flex gap-2">
                    <Button
                      variant={calibrationData.mode === "simple" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setCalibrationData((prev) => ({ ...prev, mode: "simple" }))}
                    >
                      Échelle
                    </Button>
                    <Button
                      variant={calibrationData.mode === "perspective" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setCalibrationData((prev) => ({ ...prev, mode: "perspective" }))}
                    >
                      Perspective
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {calibrationData.mode === "simple"
                      ? "Zoom uniforme basé sur les distances"
                      : "Déforme l'image pour corriger la perspective"}
                  </p>
                </div>

                {/* Mode Perspective - Choix méthode */}
                {calibrationData.mode === "perspective" && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <span className="text-sm font-medium">Méthode de correction</span>
                      <div className="flex gap-2">
                        <Button
                          variant={perspectiveMethod === "rectangle" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          onClick={() => setPerspectiveMethod("rectangle")}
                        >
                          Rectangle
                        </Button>
                        <Button
                          variant={perspectiveMethod === "checkerboard" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          onClick={() => setPerspectiveMethod("checkerboard")}
                        >
                          Damier
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {perspectiveMethod === "rectangle"
                          ? "Corrige la perspective (pas la distorsion de l'objectif)"
                          : "Corrige perspective + distorsion radiale (barrel)"}
                      </p>
                    </div>

                    <Separator />

                    {/* Mode Rectangle */}
                    {perspectiveMethod === "rectangle" && (
                      <div className="space-y-3">
                        <span className="text-sm font-medium">Rectangle de référence</span>
                        <p className="text-xs text-muted-foreground">
                          Sélectionnez 4 points formant un rectangle réel (sens horaire à partir du coin supérieur
                          gauche)
                        </p>

                        {/* Points sélectionnés */}
                        <div className="flex gap-1 flex-wrap">
                          {[0, 1, 2, 3].map((idx) => {
                            const pointId = rectPoints[idx];
                            const point = pointId ? calibrationData.points.get(pointId) : null;
                            return (
                              <div
                                key={idx}
                                className={`w-8 h-8 rounded border-2 flex items-center justify-center text-xs font-bold ${
                                  point
                                    ? "bg-blue-100 border-blue-500 text-blue-700"
                                    : "bg-gray-100 border-gray-300 text-gray-400"
                                }`}
                              >
                                {point ? point.label : idx + 1}
                              </div>
                            );
                          })}
                          <Button
                            variant={calibrationMode === "selectRect" ? "default" : "outline"}
                            size="sm"
                            className="ml-2"
                            onClick={() => {
                              if (calibrationData.points.size < 4) {
                                toast.error("Ajoutez au moins 4 points");
                                return;
                              }
                              setCalibrationMode("selectRect");
                              setRectPoints([]);
                            }}
                          >
                            {rectPoints.length === 4 ? "Modifier" : "Sélectionner"}
                          </Button>
                        </div>

                        {calibrationMode === "selectRect" && (
                          <div className="p-2 bg-blue-50 rounded text-sm text-blue-700">
                            {rectPoints.length < 4
                              ? `Point ${rectPoints.length + 1}/4 - Cliquez sur un point`
                              : "4 points sélectionnés ✓"}
                          </div>
                        )}

                        {/* Dimensions du rectangle */}
                        {rectPoints.length === 4 && (
                          <div className="space-y-2 p-2 bg-gray-50 rounded">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs w-16">Largeur:</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={rectWidth}
                                onChange={(e) => setRectWidth(e.target.value.replace(/[^0-9.,]/g, ""))}
                                placeholder="ex: 500"
                                className="h-8 text-sm flex-1"
                              />
                              <span className="text-xs text-muted-foreground">mm</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs w-16">Hauteur:</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={rectHeight}
                                onChange={(e) => setRectHeight(e.target.value.replace(/[^0-9.,]/g, ""))}
                                placeholder="ex: 300"
                                className="h-8 text-sm flex-1"
                              />
                              <span className="text-xs text-muted-foreground">mm</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mode Damier */}
                    {perspectiveMethod === "checkerboard" && (
                      <div className="space-y-3">
                        <span className="text-sm font-medium">Damier de calibration</span>
                        <p className="text-xs text-muted-foreground">
                          Placez les 4 coins extérieurs du damier (sens horaire à partir du coin supérieur gauche)
                        </p>

                        {/* Configuration du damier */}
                        <div className="space-y-2 p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs w-20">Cases X:</Label>
                            <Input
                              type="number"
                              min="2"
                              max="20"
                              value={checkerCornersX}
                              onChange={(e) => setCheckerCornersX(e.target.value)}
                              className="h-8 text-sm w-16"
                            />
                            <Label className="text-xs w-20 ml-2">Cases Y:</Label>
                            <Input
                              type="number"
                              min="2"
                              max="20"
                              value={checkerCornersY}
                              onChange={(e) => setCheckerCornersY(e.target.value)}
                              className="h-8 text-sm w-16"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs w-20">Taille case:</Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={checkerSquareSize}
                              onChange={(e) => setCheckerSquareSize(e.target.value.replace(/[^0-9.,]/g, ""))}
                              placeholder="30"
                              className="h-8 text-sm flex-1"
                            />
                            <span className="text-xs text-muted-foreground">mm</span>
                          </div>
                          <p className="text-xs text-muted-foreground italic">
                            Damier {parseInt(checkerCornersX) + 1}×{parseInt(checkerCornersY) + 1} cases ={" "}
                            {(
                              (parseInt(checkerCornersX) + 1) * parseFloat(checkerSquareSize.replace(",", ".")) || 0
                            ).toFixed(0)}
                            ×
                            {(
                              (parseInt(checkerCornersY) + 1) * parseFloat(checkerSquareSize.replace(",", ".")) || 0
                            ).toFixed(0)}{" "}
                            mm
                          </p>
                        </div>

                        {/* Points sélectionnés */}
                        <div className="flex gap-1 flex-wrap items-center">
                          {["TL", "TR", "BR", "BL"].map((label, idx) => {
                            const pointId = rectPoints[idx];
                            const point = pointId ? calibrationData.points.get(pointId) : null;
                            return (
                              <div
                                key={idx}
                                className={`w-10 h-8 rounded border-2 flex items-center justify-center text-xs font-bold ${
                                  point
                                    ? "bg-purple-100 border-purple-500 text-purple-700"
                                    : "bg-gray-100 border-gray-300 text-gray-400"
                                }`}
                                title={["Haut-Gauche", "Haut-Droit", "Bas-Droit", "Bas-Gauche"][idx]}
                              >
                                {point ? point.label : label}
                              </div>
                            );
                          })}
                          <Button
                            variant={calibrationMode === "selectRect" ? "default" : "outline"}
                            size="sm"
                            className="ml-2"
                            onClick={() => {
                              if (calibrationData.points.size < 4) {
                                toast.error("Ajoutez au moins 4 points");
                                return;
                              }
                              setCalibrationMode("selectRect");
                              setRectPoints([]);
                            }}
                          >
                            {rectPoints.length === 4 ? "Modifier" : "Sélectionner"}
                          </Button>
                        </div>

                        {calibrationMode === "selectRect" && (
                          <div className="p-2 bg-purple-50 rounded text-sm text-purple-700">
                            {rectPoints.length < 4
                              ? `Coin ${["Haut-Gauche", "Haut-Droit", "Bas-Droit", "Bas-Gauche"][rectPoints.length]} (${rectPoints.length + 1}/4)`
                              : "4 coins sélectionnés ✓"}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                <Separator />

                {/* Résultats et actions */}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={calculateCalibration}
                    disabled={calibrationData.pairs.size === 0}
                  >
                    Calculer l'échelle
                  </Button>

                  {calibrationData.scale && (
                    <div className="p-2 bg-green-50 rounded space-y-1">
                      <p className="text-sm font-medium text-green-700">
                        Échelle: {calibrationData.scale.toFixed(4)} mm/px
                      </p>
                      {calibrationData.error !== undefined && (
                        <p className="text-xs text-green-600">Erreur moyenne: {calibrationData.error.toFixed(1)}%</p>
                      )}
                    </div>
                  )}

                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={applyCalibration}
                    disabled={!calibrationData.scale}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Appliquer la calibration
                  </Button>

                  {calibrationData.applied && (
                    <p className="text-xs text-center text-green-600 font-medium">✓ Calibration appliquée</p>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
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

      {/* Menu contextuel */}
      {contextMenu && (
        <div
          className="fixed bg-white rounded-lg shadow-xl border z-[100] py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
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
                <button
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => {
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
              );
            })()}
        </div>
      )}
      {/* Fermer le menu contextuel en cliquant ailleurs */}
      {contextMenu && <div className="fixed inset-0 z-[99]" onClick={() => setContextMenu(null)} />}
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
    points: Object.fromEntries(sketch.points),
    geometries: Object.fromEntries(sketch.geometries),
    constraints: Object.fromEntries(sketch.constraints),
    dimensions: Object.fromEntries(sketch.dimensions),
    scaleFactor: sketch.scaleFactor,
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
