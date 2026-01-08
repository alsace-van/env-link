// ============================================
// COMPOSANT: CADGabaritCanvas
// Canvas CAO professionnel pour gabarits CNC
// VERSION: 5.24 - Multi-congés/chanfreins: accumulation des changements dans un seul sketch
// ============================================

import React, { useEffect, useRef, useState, useCallback } from "react";
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
  Scaling,
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
  CALIBRATION_COLORS,
  generateId,
  distance,
  midpoint,
} from "./types";
import { CADRenderer } from "./cad-renderer";
import { SnapSystem, DEFAULT_SNAP_SETTINGS } from "./snap-system";
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

  // State
  const [sketch, setSketch] = useState<Sketch>(() => createEmptySketch(scaleFactor));
  const [viewport, setViewport] = useState<Viewport>({
    offsetX: 0,
    offsetY: 0,
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

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showConstraints, setShowConstraints] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showBackgroundImage, setShowBackgroundImage] = useState(true);
  const [imageOpacity, setImageOpacity] = useState(0.5);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Drag des poignées
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<{ type: "point" | "handle"; id: string; handleType?: string } | null>(
    null,
  );
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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
  }>({
    phase: "idle",
    start: null,
    end: null,
    result: null,
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
    }>
  >([]);

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

  // Modale pour congé
  const [filletDialog, setFilletDialog] = useState<{
    open: boolean;
    corners: Array<{ pointId: string; maxRadius: number; angleDeg: number }>;
    radius: number;
    minMaxRadius: number; // Le plus petit maxRadius parmi tous les coins
  } | null>(null);

  // Modale pour chanfrein
  const [chamferDialog, setChamferDialog] = useState<{
    open: boolean;
    corners: Array<{ pointId: string; maxDistance: number; angleDeg: number }>;
    distance: number;
    minMaxDistance: number; // Le plus petit maxDistance parmi tous les coins
  } | null>(null);

  // Modale pour modifier le rayon d'un arc existant
  const [arcEditDialog, setArcEditDialog] = useState<{
    open: boolean;
    arcId: string;
    currentRadius: number;
  } | null>(null);

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
    setViewport((v) => ({
      ...v,
      width: rect.width,
      height: rect.height,
      offsetX: rect.width / 2,
      offsetY: rect.height / 2,
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
          setViewport((v) => ({ ...v, width, height }));
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [imageUrl]);

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
      backgroundImage: showBackgroundImage ? backgroundImageRef.current : null,
      transformedImage: showBackgroundImage ? transformedImage : null,
      imageOpacity,
      imageScale,
      calibrationData,
      showCalibration: showCalibrationPanel, // Afficher uniquement si panneau ouvert
      // Mesure en cours (preview)
      measureData: measureStart
        ? {
            start: measureStart,
            end: measureEnd,
            scale: calibrationData.scale || sketch.scaleFactor,
          }
        : null,
      // Tableau des mesures terminées
      measurements: measurements,
      measureScale: calibrationData.scale || sketch.scaleFactor,
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
  ]);

  useEffect(() => {
    render();
  }, [render]);

  // Vider la sélection quand on change d'outil (sauf pour select)
  useEffect(() => {
    if (activeTool !== "select") {
      setSelectedEntities(new Set());
    }
    // Réinitialiser la mesure quand on change d'outil
    if (activeTool !== "measure") {
      setMeasureState({
        phase: "idle",
        start: null,
        end: null,
        result: null,
      });
      setMeasurePreviewEnd(null);
      // Effacer toutes les mesures quand on quitte l'outil
      setMeasurements([]);
    }
  }, [activeTool]);

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
      solveSketch(newSketch);
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

  // Conversion coordonnées
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
              // Vérifier si le point est dans la plage angulaire de l'arc
              const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
              const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);
              const pointAngle = Math.atan2(worldY - center.y, worldX - center.x);

              // Normaliser les angles
              const normalizeAngle = (a: number) => (a + 2 * Math.PI) % (2 * Math.PI);
              const sa = normalizeAngle(startAngle);
              const ea = normalizeAngle(endAngle);
              const pa = normalizeAngle(pointAngle);

              // Vérifier si l'angle est dans la plage (gérer le cas où l'arc traverse 0)
              const inRange = sa <= ea ? pa >= sa && pa <= ea : pa >= sa || pa <= ea;

              if (inRange) return id;
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
            if (p1 && distance({ x: worldX, y: worldY }, p1) < tolerance) {
              return { type: "point", id: line.p1 };
            }
            if (p2 && distance({ x: worldX, y: worldY }, p2) < tolerance) {
              return { type: "point", id: line.p2 };
            }
          } else if (geo.type === "circle") {
            const circle = geo as CircleType;
            const center = sketch.points.get(circle.center);
            if (center) {
              // Poignées sur les quadrants
              const handles = [
                { x: center.x + circle.radius, y: center.y },
                { x: center.x - circle.radius, y: center.y },
                { x: center.x, y: center.y + circle.radius },
                { x: center.x, y: center.y - circle.radius },
              ];
              for (const h of handles) {
                if (distance({ x: worldX, y: worldY }, h) < tolerance) {
                  return { type: "handle", id: entityId, handleType: "resize" };
                }
              }
              // Centre
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

  // Charger une image de fond
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          backgroundImageRef.current = img;
          setShowBackgroundImage(true);
          render();
          toast.success("Image chargée !");
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    [render],
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
  const getOrCreatePoint = useCallback(
    (targetPos: { x: number; y: number }, snapPoint: SnapPoint | null): Point => {
      // Si on snappe sur un endpoint existant, réutiliser ce point
      if (snapPoint && snapPoint.type === "endpoint" && snapPoint.entityId) {
        const existingPoint = sketch.points.get(snapPoint.entityId);
        if (existingPoint) {
          return existingPoint;
        }
      }
      // Sinon créer un nouveau point
      return { id: generateId(), x: targetPos.x, y: targetPos.y };
    },
    [sketch.points],
  );

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

      const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
      const bisLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);

      if (bisLen < 0.001) return null;

      const bisUnit = { x: bisector.x / bisLen, y: bisector.y / bisLen };
      const centerDist = radius / Math.sin(halfAngle);

      const center1 = {
        x: cornerPt.x + bisUnit.x * centerDist,
        y: cornerPt.y + bisUnit.y * centerDist,
      };
      const center2 = {
        x: cornerPt.x - bisUnit.x * centerDist,
        y: cornerPt.y - bisUnit.y * centerDist,
      };

      const t1t2 = { x: tan2.x - tan1.x, y: tan2.y - tan1.y };
      const t1Corner = { x: cornerPt.x - tan1.x, y: cornerPt.y - tan1.y };
      const t1Center1 = { x: center1.x - tan1.x, y: center1.y - tan1.y };

      const crossCorner = t1t2.x * t1Corner.y - t1t2.y * t1Corner.x;
      const crossCenter1 = t1t2.x * t1Center1.y - t1t2.y * t1Center1.x;

      const arcCenter = crossCorner * crossCenter1 < 0 ? center1 : center2;

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

      const arcId = generateId();
      const arc: Arc = {
        id: arcId,
        type: "arc",
        center: centerId,
        startPoint: tan1Id,
        endPoint: tan2Id,
        radius: radius,
        layerId: currentLine1.layerId || "trace",
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

  // Ouvrir le dialogue de congé si 2 lignes OU 1+ points (coins) sont sélectionnés
  const openFilletDialog = useCallback(() => {
    const corners: Array<{ pointId: string; maxRadius: number; angleDeg: number }> = [];

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

    if (allAreCornerPoints && selectedIds.length >= 1) {
      // Tous sont des points de coin valides
      for (const pointId of selectedIds) {
        const connectedLines = findLinesConnectedToPoint(pointId);
        const params = calculateCornerParams(connectedLines[0].id, connectedLines[1].id);
        if (params) {
          corners.push({
            pointId,
            maxRadius: params.maxRadius,
            angleDeg: params.angleDeg,
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
            corners.push({
              pointId: shared.sharedPointId,
              maxRadius: params.maxRadius,
              angleDeg: params.angleDeg,
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
    } else {
      toast.warning("Sélectionnez 2 lignes ou des points (coins)");
      return;
    }

    if (corners.length === 0) {
      toast.error("Aucun coin valide trouvé");
      return;
    }

    // Trouver le plus petit maxRadius parmi tous les coins
    const minMaxRadius = Math.min(...corners.map((c) => c.maxRadius));
    const suggestedRadius = Math.min(filletRadius, Math.floor(minMaxRadius));

    setFilletDialog({
      open: true,
      corners,
      radius: suggestedRadius > 0 ? suggestedRadius : 1,
      minMaxRadius,
    });
  }, [
    selectedEntities,
    sketch.geometries,
    sketch.points,
    findSharedPoint,
    findLinesConnectedToPoint,
    filletRadius,
    calculateCornerParams,
  ]);

  // Ouvrir le dialogue de chanfrein si 2 lignes OU 1+ points (coins) sont sélectionnés
  const openChamferDialog = useCallback(() => {
    const corners: Array<{ pointId: string; maxDistance: number; angleDeg: number }> = [];

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

    if (allAreCornerPoints && selectedIds.length >= 1) {
      // Tous sont des points de coin valides
      for (const pointId of selectedIds) {
        const connectedLines = findLinesConnectedToPoint(pointId);
        const params = calculateCornerParams(connectedLines[0].id, connectedLines[1].id);
        if (params) {
          corners.push({
            pointId,
            maxDistance: params.maxDistance,
            angleDeg: params.angleDeg,
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
            corners.push({
              pointId: shared.sharedPointId,
              maxDistance: params.maxDistance,
              angleDeg: params.angleDeg,
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
    } else {
      toast.warning("Sélectionnez 2 lignes ou des points (coins)");
      return;
    }

    if (corners.length === 0) {
      toast.error("Aucun coin valide trouvé");
      return;
    }

    // Trouver le plus petit maxDistance parmi tous les coins
    const minMaxDistance = Math.min(...corners.map((c) => c.maxDistance));
    const suggestedDistance = Math.min(chamferDistance, Math.floor(minMaxDistance));

    setChamferDialog({
      open: true,
      corners,
      distance: suggestedDistance > 0 ? suggestedDistance : 1,
      minMaxDistance,
    });
  }, [
    selectedEntities,
    sketch.geometries,
    sketch.points,
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
      constraints: [...sketch.constraints],
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
        console.log(`Point ${corner.pointId} n'a plus exactement 2 lignes connectées (${connectedLines.length})`);
        continue;
      }

      // Vérifier que le rayon ne dépasse pas le max de ce coin
      if (filletDialog.radius <= corner.maxRadius) {
        const newSketch = applyFilletToSketch(
          currentSketch,
          connectedLines[0].id,
          connectedLines[1].id,
          filletDialog.radius,
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
        toast.success(`Congé R${filletDialog.radius}mm appliqué`);
      } else {
        toast.success(`${successCount} congés R${filletDialog.radius}mm appliqués`);
      }
    }

    setFilletRadius(filletDialog.radius);
    setFilletDialog(null);
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
      constraints: [...sketch.constraints],
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

      // Vérifier que la distance ne dépasse pas le max de ce coin
      if (chamferDialog.distance <= corner.maxDistance) {
        const newSketch = applyChamferToSketch(
          currentSketch,
          connectedLines[0].id,
          connectedLines[1].id,
          chamferDialog.distance,
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
        toast.success(`Chanfrein ${chamferDialog.distance}mm appliqué`);
      } else {
        toast.success(`${successCount} chanfreins ${chamferDialog.distance}mm appliqués`);
      }
    }

    setChamferDistance(chamferDialog.distance);
    setChamferDialog(null);
    setSelectedEntities(new Set());
  }, [chamferDialog, sketch, applyChamferToSketch, addToHistory]);

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

      // Nouveau centre: sur la bissectrice de l'angle
      const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
      const bisLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);

      if (bisLen < 0.001) {
        toast.error("Impossible de recalculer le congé");
        return;
      }

      const bisUnit = { x: bisector.x / bisLen, y: bisector.y / bisLen };
      const centerDist = newRadius / Math.sin(halfAngle);

      // Deux centres possibles
      const center1 = {
        x: corner.x + bisUnit.x * centerDist,
        y: corner.y + bisUnit.y * centerDist,
      };
      const center2 = {
        x: corner.x - bisUnit.x * centerDist,
        y: corner.y - bisUnit.y * centerDist,
      };

      // Choisir le centre opposé au coin par rapport à la ligne tan1-tan2
      const t1t2 = { x: newTan2.x - newTan1.x, y: newTan2.y - newTan1.y };
      const t1Corner = { x: corner.x - newTan1.x, y: corner.y - newTan1.y };
      const t1Center1 = { x: center1.x - newTan1.x, y: center1.y - newTan1.y };

      const crossCorner = t1t2.x * t1Corner.y - t1t2.y * t1Corner.x;
      const crossCenter1 = t1t2.x * t1Center1.y - t1t2.y * t1Center1.x;

      const newCenter = crossCorner * crossCenter1 < 0 ? center1 : center2;

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

  // Gestion de la souris
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = screenToWorld(screenX, screenY);

      // Pan avec clic milieu
      if (e.button === 1) {
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
        });
        setMeasurePreviewEnd(null);
        // Effacer toutes les mesures
        setMeasurements([]);
        setActiveTool("select");
        return;
      }

      // À partir d'ici, c'est un clic gauche (e.button === 0)

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

      // Gestion des clics en mode calibration
      if (calibrationMode === "addPoint") {
        const newPoint: CalibrationPoint = {
          id: generateId(),
          x: worldPos.x,
          y: worldPos.y,
          label: String(calibrationData.points.size + 1),
        };
        setCalibrationData((prev) => {
          const newPoints = new Map(prev.points);
          newPoints.set(newPoint.id, newPoint);
          return { ...prev, points: newPoints };
        });
        toast.success(`Point ${newPoint.label} ajouté`);
        return;
      }

      if (calibrationMode === "selectPair1" || calibrationMode === "selectPair2") {
        // Trouver le point de calibration le plus proche
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
            const p1 = calibrationData.points.get(selectedCalibrationPoint);
            const p2 = closestPoint;
            if (p1 && p2) {
              const distPx = distance(p1, p2);

              // Calculer la distance estimée en mm
              let estimatedMm: number;
              const userInput = parseFloat(newPairDistance.replace(",", "."));

              if (!isNaN(userInput) && userInput > 0) {
                // L'utilisateur a entré une valeur
                estimatedMm = userInput;
              } else if (calibrationData.pairs.size === 0) {
                // Première paire : utiliser l'échelle du sketch
                estimatedMm = Math.round(distPx * sketch.scaleFactor * 10) / 10;
              } else {
                // Paires suivantes : moyenne des échelles précédentes
                let totalScale = 0;
                let count = 0;
                calibrationData.pairs.forEach((pair) => {
                  const pp1 = calibrationData.points.get(pair.point1Id);
                  const pp2 = calibrationData.points.get(pair.point2Id);
                  if (pp1 && pp2 && pair.distanceMm > 0) {
                    const pairDistPx = distance(pp1, pp2);
                    totalScale += pair.distanceMm / pairDistPx;
                    count++;
                  }
                });
                const avgScale = count > 0 ? totalScale / count : sketch.scaleFactor;
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
              setCalibrationData((prev) => {
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
            return;
          }

          const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
          if (entityId) {
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
              setSelectedEntities(new Set([entityId]));
              // Préparer le drag pour les points (commencera quand la souris bouge)
              if (sketch.points.has(entityId)) {
                setDragTarget({ type: "point", id: entityId });
                setDragStart(worldPos);
                // Note: isDragging reste false jusqu'à ce qu'on bouge la souris
              }
            }
          } else {
            // Clic dans le vide : commencer une sélection rectangulaire
            if (!e.shiftKey) {
              setSelectedEntities(new Set());
            }
            setSelectionBox({ start: worldPos, end: worldPos });
          }
          break;
        }

        case "line": {
          if (tempPoints.length === 0) {
            // Premier point
            const newSketch = { ...sketch };
            newSketch.points = new Map(sketch.points);
            newSketch.geometries = new Map(sketch.geometries);

            let p: Point;

            // Si on snap sur un segment (pas une extrémité), le couper
            if (
              currentSnapPoint &&
              (currentSnapPoint.type === "nearest" || currentSnapPoint.type === "perpendicular") &&
              currentSnapPoint.entityId
            ) {
              const geo = sketch.geometries.get(currentSnapPoint.entityId);
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
            // Deuxième point - créer la ligne
            const p1 = tempPoints[0];

            // Ajouter les points
            const newSketch = { ...sketch };
            newSketch.points = new Map(sketch.points);
            newSketch.geometries = new Map(sketch.geometries);

            let p2: Point;

            // Si on snap sur un segment (pas une extrémité), le couper
            if (
              currentSnapPoint &&
              (currentSnapPoint.type === "nearest" || currentSnapPoint.type === "perpendicular") &&
              currentSnapPoint.entityId
            ) {
              const geo = sketch.geometries.get(currentSnapPoint.entityId);
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
              layerId: sketch.activeLayerId,
            };
            newSketch.geometries.set(line.id, line);

            // Détecter et créer les points d'intersection avec les segments existants
            createIntersectionPoints(line.id, newSketch);

            setSketch(newSketch);
            solveSketch(newSketch);
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

            const newSketch = { ...sketch };
            newSketch.points = new Map(sketch.points);
            newSketch.geometries = new Map(sketch.geometries);

            newSketch.points.set(center.id, center);

            const circle: CircleType = {
              id: generateId(),
              type: "circle",
              center: center.id,
              radius,
              layerId: sketch.activeLayerId,
            };
            newSketch.geometries.set(circle.id, circle);

            setSketch(newSketch);
            solveSketch(newSketch);
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
          } else {
            const p1 = tempPoints[0];
            const p3 = targetPos;

            // Créer les 4 coins
            const p2: Point = { id: generateId(), x: p3.x, y: p1.y };
            const p4: Point = { id: generateId(), x: p1.x, y: p3.y };
            const p3Pt: Point = { id: generateId(), x: p3.x, y: p3.y };

            const newSketch = { ...sketch };
            newSketch.points = new Map(sketch.points);
            newSketch.geometries = new Map(sketch.geometries);
            newSketch.constraints = new Map(sketch.constraints);

            newSketch.points.set(p1.id, p1);
            newSketch.points.set(p2.id, p2);
            newSketch.points.set(p3Pt.id, p3Pt);
            newSketch.points.set(p4.id, p4);

            // Créer les 4 lignes avec le calque actif
            const lines = [
              { id: generateId(), type: "line" as const, p1: p1.id, p2: p2.id, layerId: sketch.activeLayerId },
              { id: generateId(), type: "line" as const, p1: p2.id, p2: p3Pt.id, layerId: sketch.activeLayerId },
              { id: generateId(), type: "line" as const, p1: p3Pt.id, p2: p4.id, layerId: sketch.activeLayerId },
              { id: generateId(), type: "line" as const, p1: p4.id, p2: p1.id, layerId: sketch.activeLayerId },
            ];

            lines.forEach((l) => newSketch.geometries.set(l.id, l));

            // Ajouter contraintes horizontales/verticales
            newSketch.constraints.set(generateId(), { id: generateId(), type: "horizontal", entities: [lines[0].id] });
            newSketch.constraints.set(generateId(), { id: generateId(), type: "horizontal", entities: [lines[2].id] });
            newSketch.constraints.set(generateId(), { id: generateId(), type: "vertical", entities: [lines[1].id] });
            newSketch.constraints.set(generateId(), { id: generateId(), type: "vertical", entities: [lines[3].id] });

            setSketch(newSketch);
            solveSketch(newSketch);
            addToHistory(newSketch);

            setTempPoints([]);
            setTempGeometry(null);
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

            const newSketch = { ...sketch };
            newSketch.points = new Map(sketch.points);
            newSketch.geometries = new Map(sketch.geometries);

            // N'ajouter que les points qui n'existent pas déjà
            if (!sketch.points.has(p1.id)) {
              newSketch.points.set(p1.id, p1);
            }
            if (!sketch.points.has(p2.id)) {
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
              layerId: sketch.activeLayerId,
            };
            newSketch.geometries.set(bezier.id, bezier);

            setSketch(newSketch);
            solveSketch(newSketch);
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
          const snapTolerance = 15 / viewport.scale;

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

          if (measureState.phase === "idle" || measureState.phase === "complete") {
            // Premier point - commence une nouvelle mesure
            setMeasureState({
              phase: "waitingSecond",
              start: snapPos,
              end: null,
              result: null,
            });
            setMeasurePreviewEnd(null);
          } else if (measureState.phase === "waitingSecond" && measureState.start) {
            // Deuxième point - calculer, ajouter au tableau et permettre nouvelle mesure
            const distPx = distance(measureState.start, snapPos);
            const distMm = calibrationData.scale ? distPx * calibrationData.scale : distPx * sketch.scaleFactor;

            // Ajouter la mesure au tableau
            setMeasurements((prev) => [
              ...prev,
              {
                id: generateId(),
                start: measureState.start!,
                end: snapPos,
                px: distPx,
                mm: distMm,
              },
            ]);

            // Reset pour nouvelle mesure
            setMeasureState({
              phase: "idle",
              start: null,
              end: null,
              result: null,
            });
            setMeasurePreviewEnd(null);

            toast.success(`Mesure: ${distPx.toFixed(1)} px = ${distMm.toFixed(1)} mm`);
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
                const suggestedRadius = Math.min(filletRadius, Math.floor(params.maxRadius));
                // Ouvrir la modale
                setFilletDialog({
                  open: true,
                  corners: [
                    {
                      pointId: shared.sharedPointId,
                      maxRadius: params.maxRadius,
                      angleDeg: params.angleDeg,
                    },
                  ],
                  radius: suggestedRadius > 0 ? suggestedRadius : 1,
                  minMaxRadius: params.maxRadius,
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
                const suggestedDistance = Math.min(chamferDistance, Math.floor(params.maxDistance));
                // Ouvrir la modale
                setChamferDialog({
                  open: true,
                  corners: [
                    {
                      pointId: shared.sharedPointId,
                      maxDistance: params.maxDistance,
                      angleDeg: params.angleDeg,
                    },
                  ],
                  distance: suggestedDistance > 0 ? suggestedDistance : 1,
                  minMaxDistance: params.maxDistance,
                });
                setFilletFirstLine(null);
                setSelectedEntities(new Set());
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
      calibrationMode,
      calibrationData,
      selectedCalibrationPoint,
      newPairDistance,
      newPairColor,
      measureState,
      showCalibrationPanel,
      filletFirstLine,
      filletRadius,
      chamferDistance,
      applyChamfer,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = screenToWorld(screenX, screenY);

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
          const snap = snapSystemRef.current.findSnapPoint(screenX, screenY, sketch, viewport, [dragTarget.id]);
          if (snap) {
            targetPos = { x: snap.x, y: snap.y };
            setCurrentSnapPoint(snap);
          } else {
            setCurrentSnapPoint(null);
          }
        }

        // Mettre à jour la position du point
        if (dragTarget.type === "point") {
          const newSketch = { ...sketch };
          newSketch.points = new Map(sketch.points);
          const point = newSketch.points.get(dragTarget.id);
          if (point) {
            newSketch.points.set(dragTarget.id, {
              ...point,
              x: targetPos.x,
              y: targetPos.y,
            });
            setSketch(newSketch);
          }
        }
        return;
      }

      // Snap
      if (snapEnabled) {
        const snap = snapSystemRef.current.findSnapPoint(screenX, screenY, sketch, viewport, []);
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
          setTempGeometry({
            ...tempGeometry,
            cursor: targetPos,
          });
        } else if (tempGeometry.type === "circle" && tempPoints.length > 0) {
          const radius = distance(tempPoints[0], targetPos);
          setTempGeometry({
            ...tempGeometry,
            radius,
          });
        } else if (tempGeometry.type === "rectangle") {
          setTempGeometry({
            ...tempGeometry,
            cursor: targetPos,
          });
        }
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
      panStart,
      dragTarget,
      dragStart,
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
      selectionBox,
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

      // Fin du drag - sauvegarder dans l'historique
      if (isDragging && dragTarget) {
        addToHistory(sketch);
        solveSketch(sketch);
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
      dragTarget,
      sketch,
      addToHistory,
      solveSketch,
      draggingCalibrationPoint,
      selectionBox,
      selectedEntities,
      screenToWorld,
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

      const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
      if (entityId) {
        const geo = sketch.geometries.get(entityId);
        if (geo) {
          if (geo.type === "arc") {
            // Double-clic sur arc → ouvrir le dialogue d'édition du rayon
            const arc = geo as Arc;
            setArcEditDialog({
              open: true,
              arcId: entityId,
              currentRadius: arc.radius,
            });
          } else if (geo.type === "line" || geo.type === "bezier") {
            // Double-clic sur ligne/bezier → sélectionner toute la figure connectée
            const connectedGeos = findConnectedGeometries(entityId);
            setSelectedEntities(connectedGeos);
            toast.success(`${connectedGeos.size} élément(s) sélectionné(s)`);
          }
        }
      }
    },
    [screenToWorld, findEntityAtPosition, sketch.geometries, findConnectedGeometries],
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

      // Si c'est un arc (potentiellement un congé), restaurer le coin
      if (geo && geo.type === "arc") {
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
        if (selectedEntities.size > 0) {
          deleteSelectedEntities();
        }
      }

      // Raccourcis outils
      if (!e.ctrlKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "v":
            setActiveTool("select");
            break;
          case "h":
            setActiveTool("pan");
            break;
          case "l":
            setActiveTool("line");
            break;
          case "c":
            setActiveTool("circle");
            break;
          case "r":
            setActiveTool("rectangle");
            break;
          case "b":
            setActiveTool("bezier");
            break;
          case "d":
            setActiveTool("dimension");
            break;
          case "m":
            setActiveTool("measure");
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

  // Supprimer une paire
  const deleteCalibrationPair = useCallback((pairId: string) => {
    setCalibrationData((prev) => {
      const newPairs = new Map(prev.pairs);
      newPairs.delete(pairId);
      return { ...prev, pairs: newPairs };
    });
    toast.success("Paire supprimée");
  }, []);

  // Mettre à jour la distance d'une paire
  const updatePairDistance = useCallback((pairId: string, distanceMm: number) => {
    setCalibrationData((prev) => {
      const newPairs = new Map(prev.pairs);
      const pair = newPairs.get(pairId);
      if (pair) {
        newPairs.set(pairId, { ...pair, distanceMm });
      }
      return { ...prev, pairs: newPairs };
    });
  }, []);

  // Mettre à jour la couleur d'une paire
  const updatePairColor = useCallback((pairId: string, color: string) => {
    setCalibrationData((prev) => {
      const newPairs = new Map(prev.pairs);
      const pair = newPairs.get(pairId);
      if (pair) {
        newPairs.set(pairId, { ...pair, color });
      }
      return { ...prev, pairs: newPairs };
    });
  }, []);

  // Calculer l'échelle à partir des paires
  const calculateCalibration = useCallback(() => {
    if (calibrationData.pairs.size === 0) {
      toast.error("Ajoutez au moins une paire de calibration");
      return;
    }

    let totalScale = 0;
    let count = 0;

    calibrationData.pairs.forEach((pair) => {
      const p1 = calibrationData.points.get(pair.point1Id);
      const p2 = calibrationData.points.get(pair.point2Id);
      if (p1 && p2 && pair.distanceMm > 0) {
        const distPx = distance(p1, p2);
        const scale = pair.distanceMm / distPx;
        totalScale += scale;
        count++;

        // Mettre à jour la distance en pixels
        pair.distancePx = distPx;
      }
    });

    if (count === 0) {
      toast.error("Aucune paire valide");
      return;
    }

    const avgScale = totalScale / count;

    // Calculer l'erreur moyenne
    let totalError = 0;
    calibrationData.pairs.forEach((pair) => {
      const p1 = calibrationData.points.get(pair.point1Id);
      const p2 = calibrationData.points.get(pair.point2Id);
      if (p1 && p2) {
        const distPx = distance(p1, p2);
        const calculatedMm = distPx * avgScale;
        const error = (Math.abs(calculatedMm - pair.distanceMm) / pair.distanceMm) * 100;
        totalError += error;
      }
    });
    const avgError = totalError / count;

    setCalibrationData((prev) => ({
      ...prev,
      scale: avgScale,
      error: avgError,
    }));

    toast.success(`Échelle calculée : ${avgScale.toFixed(4)} mm/px (erreur : ${avgError.toFixed(1)}%)`);
  }, [calibrationData]);

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

  // Reset view
  const resetView = useCallback(() => {
    setViewport((v) => ({
      ...v,
      offsetX: v.width / 2,
      offsetY: v.height / 2,
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

        {/* Image de fond */}
        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-9 px-2">
                  <Image className="h-4 w-4 mr-1" />
                  <span className="text-xs">Photo</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Charger une image de fond</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {backgroundImageRef.current && (
            <>
              <Button
                variant={showBackgroundImage ? "default" : "outline"}
                size="sm"
                onClick={() => setShowBackgroundImage(!showBackgroundImage)}
                className="h-9 w-9 p-0"
              >
                {showBackgroundImage ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <div className="flex items-center gap-1 ml-1">
                <span className="text-xs text-muted-foreground">Opacité:</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={imageOpacity}
                  onChange={(e) => setImageOpacity(parseFloat(e.target.value))}
                  className="w-16 h-1"
                />
              </div>

              <Separator orientation="vertical" className="h-6 mx-1" />

              {/* Bouton Calibration */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showCalibrationPanel ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowCalibrationPanel(!showCalibrationPanel)}
                      className="h-9 px-2"
                    >
                      <Target className="h-4 w-4 mr-1" />
                      <span className="text-xs">Calibrer</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Calibration multi-points</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Cotations et contraintes */}
        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
          <ToolButton tool="dimension" icon={Ruler} label="Cotation" shortcut="D" />
          <ToolButton tool="measure" icon={Scaling} label="Mesurer" shortcut="M" />

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
                <p>Congé - Sélectionnez 2 lignes ou 1 coin</p>
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
                <p>Chanfrein - Sélectionnez 2 lignes ou 1 coin</p>
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
                cursor: draggingCalibrationPoint ? "move" : activeTool === "pan" || isPanning ? "grab" : "crosshair",
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDoubleClick={handleDoubleClick}
              onContextMenu={(e) => e.preventDefault()}
            />

            {/* Overlay pour l'outil de mesure */}
            {activeTool === "measure" && (
              <div className="absolute bottom-4 left-4 bg-white/95 rounded-lg shadow-lg p-3 border border-green-300">
                <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                  <Scaling className="h-5 w-5" />
                  <span>Outil de mesure</span>
                </div>
                {measureState.phase === "idle" ? (
                  <p className="text-sm text-gray-600">Cliquez sur le 1er point</p>
                ) : measureState.phase === "waitingSecond" ? (
                  <p className="text-sm text-gray-600">Cliquez sur le 2ème point</p>
                ) : null}

                {measurements.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-sm font-medium text-green-700">
                      {measurements.length} mesure{measurements.length > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-gray-400">Clic droit = tout effacer</p>
                  </div>
                )}

                {calibrationData.scale && (
                  <p className="text-xs text-gray-400 mt-2">Échelle: {calibrationData.scale.toFixed(4)} mm/px</p>
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

        {/* Panneau de calibration */}
        {showCalibrationPanel && (
          <div className="w-80 border-l bg-white flex flex-col">
            {/* En-tête */}
            <div className="p-3 border-b flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-red-500" />
                <span className="font-semibold">Calibration</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowCalibrationPanel(false)}>
                <X className="h-4 w-4" />
              </Button>
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
                        if (calibrationData.points.size < 2) {
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

                {/* Points de calibration */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Points ({calibrationData.points.size})</span>
                    {calibrationData.points.size > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetCalibration}
                        className="h-6 text-xs text-red-500 hover:text-red-700"
                      >
                        Tout supprimer
                      </Button>
                    )}
                  </div>

                  {calibrationData.points.size === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Aucun point</p>
                  ) : (
                    <div className="space-y-1">
                      {Array.from(calibrationData.points.values()).map((point) => (
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
                            onClick={() => deleteCalibrationPoint(point.id)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Paires de calibration */}
                <div>
                  <span className="text-sm font-medium">Paires ({calibrationData.pairs.size})</span>

                  {calibrationData.pairs.size === 0 ? (
                    <p className="text-xs text-muted-foreground italic mt-2">Aucune paire</p>
                  ) : (
                    <div className="space-y-2 mt-2">
                      {Array.from(calibrationData.pairs.values()).map((pair) => {
                        const p1 = calibrationData.points.get(pair.point1Id);
                        const p2 = calibrationData.points.get(pair.point2Id);
                        const distPx = p1 && p2 ? distance(p1, p2) : 0;
                        const pairScale = distPx > 0 ? pair.distanceMm / distPx : 0;
                        const measuredWithAvgScale = calibrationData.scale ? distPx * calibrationData.scale : 0;
                        const errorMm = measuredWithAvgScale - pair.distanceMm;
                        const errorPercent = pair.distanceMm > 0 ? (errorMm / pair.distanceMm) * 100 : 0;

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
                              {calibrationData.scale && (
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
                                  setCalibrationData((prev) => ({
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

      {/* Dialogue Congé */}
      {filletDialog &&
        (() => {
          const isValid = filletDialog.radius > 0 && filletDialog.radius <= filletDialog.minMaxRadius;
          const cornerCount = filletDialog.corners.length;
          return (
            <Dialog open={filletDialog.open} onOpenChange={() => setFilletDialog(null)}>
              <DialogContent className="sm:max-w-[300px]">
                <DialogHeader>
                  <DialogTitle>Congé {cornerCount > 1 ? `(${cornerCount} coins)` : ""}</DialogTitle>
                  <DialogDescription>
                    {cornerCount === 1
                      ? `Angle: ${filletDialog.corners[0].angleDeg.toFixed(1)}° • Max: ${filletDialog.minMaxRadius.toFixed(1)}mm`
                      : `Max commun: ${filletDialog.minMaxRadius.toFixed(1)}mm`}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="fillet-radius">Rayon (mm)</Label>
                  <Input
                    id="fillet-radius"
                    type="number"
                    value={filletDialog.radius}
                    onChange={(e) =>
                      setFilletDialog({
                        ...filletDialog,
                        radius: Math.max(0.1, parseFloat(e.target.value) || 0.1),
                      })
                    }
                    className={`mt-2 ${!isValid ? "border-red-500 text-red-600 focus-visible:ring-red-500" : ""}`}
                    min="0.1"
                    step="1"
                    autoFocus
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter" && isValid) {
                        applyFilletFromDialog();
                      }
                    }}
                  />
                  {!isValid && (
                    <p className="text-xs text-red-500 mt-1">
                      Rayon trop grand (max: {filletDialog.minMaxRadius.toFixed(1)}mm)
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={applyFilletFromDialog} className="w-full" disabled={!isValid}>
                    <Check className="h-4 w-4" />
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        })()}

      {/* Dialogue Chanfrein */}
      {/* Dialogue Chanfrein */}
      {chamferDialog &&
        (() => {
          const isValid = chamferDialog.distance > 0 && chamferDialog.distance <= chamferDialog.minMaxDistance;
          const cornerCount = chamferDialog.corners.length;
          return (
            <Dialog open={chamferDialog.open} onOpenChange={() => setChamferDialog(null)}>
              <DialogContent className="sm:max-w-[300px]">
                <DialogHeader>
                  <DialogTitle>Chanfrein {cornerCount > 1 ? `(${cornerCount} coins)` : ""}</DialogTitle>
                  <DialogDescription>
                    {cornerCount === 1
                      ? `Angle: ${chamferDialog.corners[0].angleDeg.toFixed(1)}° • Max: ${chamferDialog.minMaxDistance.toFixed(1)}mm`
                      : `Max commun: ${chamferDialog.minMaxDistance.toFixed(1)}mm`}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="chamfer-distance">Distance (mm)</Label>
                  <Input
                    id="chamfer-distance"
                    type="number"
                    value={chamferDialog.distance}
                    onChange={(e) =>
                      setChamferDialog({
                        ...chamferDialog,
                        distance: Math.max(0.1, parseFloat(e.target.value) || 0.1),
                      })
                    }
                    className={`mt-2 ${!isValid ? "border-red-500 text-red-600 focus-visible:ring-red-500" : ""}`}
                    min="0.1"
                    step="1"
                    autoFocus
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter" && isValid) {
                        applyChamferFromDialog();
                      }
                    }}
                  />
                  {!isValid && (
                    <p className="text-xs text-red-500 mt-1">
                      Distance trop grande (max: {chamferDialog.minMaxDistance.toFixed(1)}mm)
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={applyChamferFromDialog} className="w-full" disabled={!isValid}>
                    <Check className="h-4 w-4" />
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        })()}

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
