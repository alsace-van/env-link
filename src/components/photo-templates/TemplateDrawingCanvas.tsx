import { useEffect, useRef, useState, useCallback } from "react";
import Draggable from "react-draggable";
import * as fabric from "fabric";
import {
  Canvas as FabricCanvas,
  Line,
  Circle,
  Rect,
  Textbox,
  FabricImage,
  Path,
  Polygon,
  Ellipse,
  Group,
  Control,
  Point,
  util,
  Text as FabricText,
} from "fabric";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Pencil,
  Square,
  Circle as CircleIcon,
  Minus,
  Type,
  Hand,
  ZoomIn,
  ZoomOut,
  Trash2,
  Undo,
  Redo,
  Waves,
  Workflow,
  CircleDot,
  Ruler,
  Pentagon,
  Grid3x3,
  Magnet,
  Info,
  Sparkles,
  Move,
  Maximize,
  Minimize,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TemplateDrawingCanvasProps {
  imageUrl: string;
  scaleFactor: number;
  onDrawingsChanged?: (drawingsData: any) => void;
  initialDrawings?: any;
}

interface HistoryState {
  objects: any[];
}

// Classe personnalisée pour les courbes éditables
class EditableCurve extends Path {
  public controlPoints: { start: Point; control: Point; end: Point };
  public controlHandles: Circle[];
  public controlLines: Line[];
  public canvasRef: FabricCanvas | null = null;
  private lastLeft: number = 0;
  private lastTop: number = 0;

  constructor(start: Point, control: Point, end: Point, options: any = {}) {
    const pathData = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
    super(pathData, {
      ...options,
      objectCaching: false,
      // Désactiver les contrôles de transformation pour éviter la bounding box
      hasControls: false,
      hasBorders: false,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
    });

    this.controlPoints = { start, control, end };
    this.controlHandles = [];
    this.controlLines = [];

    // Type personnalisé pour identifier cette courbe
    this.set("customType", "editableCurve");

    // Initialiser la position de référence pour le déplacement
    this.lastLeft = this.left ?? 0;
    this.lastTop = this.top ?? 0;

    // Événements : déplacement de la courbe et mise à jour des poignées après modif (ex: depuis l'UI)
    this.on("moving", () => this.handleMoving());
    this.on("modified", () => this.syncHandlesOnMove());
  }

  // Déplacement de la courbe : faire suivre les poignées et les lignes
  private handleMoving() {
    if (!this.canvasRef) return;

    const newLeft = this.left ?? 0;
    const newTop = this.top ?? 0;
    const dx = newLeft - this.lastLeft;
    const dy = newTop - this.lastTop;

    if (dx === 0 && dy === 0) return;

    // Déplacer les poignées
    this.controlHandles.forEach((handle) => {
      if (handle.left == null || handle.top == null) return;
      handle.set({ left: handle.left + dx, top: handle.top + dy });
      handle.setCoords();
    });

    // Déplacer les lignes de contrôle
    this.controlLines.forEach((line) => {
      line.set({
        x1: (line.x1 ?? 0) + dx,
        y1: (line.y1 ?? 0) + dy,
        x2: (line.x2 ?? 0) + dx,
        y2: (line.y2 ?? 0) + dy,
      });
      line.setCoords();
    });

    this.lastLeft = newLeft;
    this.lastTop = newTop;

    this.canvasRef.requestRenderAll();
  }

  // Synchroniser les poignées avec la courbe (par ex. après une modification de path)
  syncHandlesOnMove() {
    if (!this.canvasRef || this.controlHandles.length === 0) return;

    // Récupérer les points directement depuis le path actuel pour éviter tout décalage
    const path = (this.path || []) as any[];
    if (!path.length || path.length < 2) return;

    const [, startX, startY] = path[0];
    const [, controlX, controlY, endX, endY] = path[1];

    this.controlPoints.start = new Point(startX, startY);
    this.controlPoints.control = new Point(controlX, controlY);
    this.controlPoints.end = new Point(endX, endY);

    // Appliquer la transformation pour obtenir les coordonnées absolues
    const matrix = this.calcTransformMatrix();
    const startAbs = new Point(startX, startY).transform(matrix);
    const controlAbs = new Point(controlX, controlY).transform(matrix);
    const endAbs = new Point(endX, endY).transform(matrix);

    // Mettre à jour les poignées avec les coordonnées absolues
    if (this.controlHandles[0]) {
      this.controlHandles[0].set({ left: startAbs.x, top: startAbs.y });
      this.controlHandles[0].setCoords();
    }
    if (this.controlHandles[1]) {
      this.controlHandles[1].set({ left: controlAbs.x, top: controlAbs.y });
      this.controlHandles[1].setCoords();
    }
    if (this.controlHandles[2]) {
      this.controlHandles[2].set({ left: endAbs.x, top: endAbs.y });
      this.controlHandles[2].setCoords();
    }

    // Mettre à jour les lignes de contrôle avec les coordonnées absolues
    if (this.controlLines[0]) {
      this.controlLines[0].set({
        x1: startAbs.x,
        y1: startAbs.y,
        x2: controlAbs.x,
        y2: controlAbs.y,
      });
      this.controlLines[0].setCoords();
    }
    if (this.controlLines[1]) {
      this.controlLines[1].set({
        x1: controlAbs.x,
        y1: controlAbs.y,
        x2: endAbs.x,
        y2: endAbs.y,
      });
      this.controlLines[1].setCoords();
    }

    this.canvasRef.requestRenderAll();
  }

  // Créer les poignées de contrôle visuelles
  createHandles(canvas: FabricCanvas, color: string = "#3b82f6") {
    this.canvasRef = canvas;

    // Nettoyer les anciennes poignées (inclut le nettoyage des lignes orphelines)
    this.removeHandles(canvas);

    // Positions des points directement depuis controlPoints (coordonnées du path)
    const startPos = this.controlPoints.start;
    const controlPos = this.controlPoints.control;
    const endPos = this.controlPoints.end;

    // Créer les lignes de contrôle (traits en pointillés pour visualiser la relation)
    const line1 = new Line([startPos.x, startPos.y, controlPos.x, controlPos.y], {
      stroke: color,
      strokeWidth: 1,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
      opacity: 0.5,
    });
    (line1 as any).isControlLine = true;

    const line2 = new Line([controlPos.x, controlPos.y, endPos.x, endPos.y], {
      stroke: color,
      strokeWidth: 1,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
      opacity: 0.5,
    });
    (line2 as any).isControlLine = true;

    this.controlLines = [line1, line2];

    // Poignées (cercles) - taille originale
    const handleStart = new Circle({
      left: startPos.x,
      top: startPos.y,
      radius: 2,
      fill: "#ffffff",
      stroke: color,
      strokeWidth: 2,
      originX: "center",
      originY: "center",
      hasBorders: false,
      hasControls: false,
      selectable: true,
      hoverCursor: "move",
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      borderColor: "transparent",
      cornerColor: "transparent",
      transparentCorners: false,
      objectCaching: false,
    });
    (handleStart as any).curvePointType = "start";
    (handleStart as any).parentCurve = this;
    (handleStart as any).isControlHandle = true;

    const handleControl = new Circle({
      left: controlPos.x,
      top: controlPos.y,
      radius: 3,
      fill: color,
      stroke: "#ffffff",
      strokeWidth: 2,
      originX: "center",
      originY: "center",
      hasBorders: false,
      hasControls: false,
      selectable: true,
      hoverCursor: "move",
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      borderColor: "transparent",
      cornerColor: "transparent",
      transparentCorners: false,
      objectCaching: false,
    });
    (handleControl as any).curvePointType = "control";
    (handleControl as any).parentCurve = this;
    (handleControl as any).isControlHandle = true;

    const handleEnd = new Circle({
      left: endPos.x,
      top: endPos.y,
      radius: 2,
      fill: "#ffffff",
      stroke: color,
      strokeWidth: 2,
      originX: "center",
      originY: "center",
      hasBorders: false,
      hasControls: false,
      selectable: true,
      hoverCursor: "move",
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      borderColor: "transparent",
      cornerColor: "transparent",
      transparentCorners: false,
      objectCaching: false,
    });
    (handleEnd as any).curvePointType = "end";
    (handleEnd as any).parentCurve = this;
    (handleEnd as any).isControlHandle = true;

    this.controlHandles = [handleStart, handleControl, handleEnd];

    // Ajouter au canvas
    this.controlLines.forEach((line) => canvas.add(line));
    this.controlHandles.forEach((handle) => {
      canvas.add(handle);
    });

    // PERMETTRE le déplacement de la courbe (ne plus verrouiller)
    this.set({ lockMovementX: false, lockMovementY: false });

    // Event handlers pour déplacer les poignées
    this.controlHandles.forEach((handle) => {
      handle.on("moving", () => {
        this.updateCurveFromHandle(handle as Circle, canvas);
      });

      // Forcer la sélection du handle au mousedown
      handle.on("mousedown", () => {
        canvas.setActiveObject(handle);
        canvas.renderAll();
      });

      // 🔧 Nettoyage après modification
      handle.on("mouseup", () => {
        // Nettoyer les lignes de contrôle orphelines
        const objectsToRemove: any[] = [];
        canvas.getObjects().forEach((obj) => {
          if (obj instanceof Line && (obj as any).isControlLine && !this.controlLines.includes(obj)) {
            objectsToRemove.push(obj);
          }
        });
        objectsToRemove.forEach((obj) => canvas.remove(obj));
        canvas.requestRenderAll();
      });
    });

    canvas.renderAll();
  }

  // Mettre à jour la courbe quand une poignée bouge
  updateCurveFromHandle(handle: Circle, canvas: FabricCanvas) {
    const pointType = (handle as any).curvePointType;
    const newX = handle.left!;
    const newY = handle.top!;

    // Mettre à jour les points de contrôle directement en coordonnées du canevas
    if (pointType === "start") {
      this.controlPoints.start = new Point(newX, newY);
    } else if (pointType === "control") {
      this.controlPoints.control = new Point(newX, newY);
    } else if (pointType === "end") {
      this.controlPoints.end = new Point(newX, newY);
    }

    // Recalculer le path avec les nouvelles coordonnées
    const newPathData = `M ${this.controlPoints.start.x} ${this.controlPoints.start.y} Q ${this.controlPoints.control.x} ${this.controlPoints.control.y} ${this.controlPoints.end.x} ${this.controlPoints.end.y}`;
    this.set("path", (new Path(newPathData) as any).path);

    // 🔧 NETTOYAGE AGRESSIF : Supprimer toutes les anciennes lignes de contrôle orphelines
    const objectsToRemove: any[] = [];
    canvas.getObjects().forEach((obj) => {
      if (obj instanceof Line && (obj as any).isControlLine && !this.controlLines.includes(obj)) {
        objectsToRemove.push(obj);
      }
    });
    objectsToRemove.forEach((obj) => canvas.remove(obj));

    // Mettre à jour les lignes de contrôle
    const startAbs = this.controlPoints.start;
    const controlAbs = this.controlPoints.control;
    const endAbs = this.controlPoints.end;

    if (this.controlLines[0]) {
      this.controlLines[0].set({
        x1: startAbs.x,
        y1: startAbs.y,
        x2: controlAbs.x,
        y2: controlAbs.y,
      });
      this.controlLines[0].setCoords();
    }
    if (this.controlLines[1]) {
      this.controlLines[1].set({
        x1: controlAbs.x,
        y1: controlAbs.y,
        x2: endAbs.x,
        y2: endAbs.y,
      });
      this.controlLines[1].setCoords();
    }

    canvas.requestRenderAll();
  }

  // Supprimer les poignées
  removeHandles(canvas: FabricCanvas) {
    // Supprimer les lignes de contrôle de cette courbe
    this.controlLines.forEach((line) => canvas.remove(line));
    this.controlLines = [];

    // Supprimer les poignées de cette courbe
    this.controlHandles.forEach((handle) => canvas.remove(handle));
    this.controlHandles = [];

    // 🔧 Nettoyage complet : supprimer toutes les lignes de contrôle orphelines du canvas
    const linesToRemove: Line[] = [];
    canvas.getObjects().forEach((obj) => {
      if (obj instanceof Line && (obj as any).isControlLine) {
        linesToRemove.push(obj as Line);
      }
    });
    linesToRemove.forEach((line) => canvas.remove(line));

    // Réactiver le déplacement de la courbe
    this.set({ lockMovementX: false, lockMovementY: false });

    // Forcer un rafraîchissement pour bien effacer les traits
    canvas.requestRenderAll();
  }

  // Cacher/Montrer les poignées
  hideHandles() {
    this.controlLines.forEach((line) => line.set("visible", false));
    this.controlHandles.forEach((handle) => handle.set("visible", false));
  }

  showHandles() {
    this.controlLines.forEach((line) => line.set("visible", true));
    this.controlHandles.forEach((handle) => handle.set("visible", true));
  }
}

export function TemplateDrawingCanvas({
  imageUrl,
  scaleFactor,
  onDrawingsChanged,
  initialDrawings,
}: TemplateDrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<
    | "select"
    | "line"
    | "rectangle"
    | "circle"
    | "ellipse"
    | "pencil"
    | "text"
    | "bezier"
    | "spline"
    | "editableCurve"
    | "polygon"
    | "dimension"
    | "pan"
  >("select");

  const [tempPoints, setTempPoints] = useState<{ x: number; y: number }[]>([]);
  const [tempObjects, setTempObjects] = useState<any[]>([]);
  const [previewCurve, setPreviewCurve] = useState<Path | null>(null);
  const [strokeColor, setStrokeColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  // Nouvelle logique d'échelle :
  // - gridSizePx = taille FIXE de la grille en pixels (visuellement constant)
  // - scaleValuePerCell = ce que représente chaque case en mm (ajustable par l'utilisateur)
  const [gridSizePx, setGridSizePx] = useState(35); // Taille fixe de la grille en pixels
  const [scaleValuePerCell, setScaleValuePerCell] = useState(() => {
    // Initialiser avec la valeur réelle basée sur scaleFactor
    // scaleFactor = pixels par mm, donc 35px / scaleFactor = mm par case
    const realValue = 35 / scaleFactor;
    // Arrondir à une valeur pratique (10, 20, 50, 100mm...)
    if (realValue <= 5) return 5;
    if (realValue <= 10) return 10;
    if (realValue <= 20) return 20;
    if (realValue <= 50) return 50;
    if (realValue <= 100) return 100;
    return Math.round(realValue / 50) * 50;
  });
  const [snapToGrid, setSnapToGrid] = useState(false); // Désactivé par défaut - snap uniquement vers objets utilisateur
  const [showRulers, setShowRulers] = useState(true);

  // L'échelle effective : combien de mm représente 1 pixel
  // Si scaleValuePerCell = 10mm et gridSizePx = 35px, alors 1px = 10/35 = 0.286mm
  const effectiveScale = scaleValuePerCell / gridSizePx; // mm par pixel

  // Pour compatibilité avec le reste du code, on garde gridSize comme alias
  const gridSize = gridSizePx;
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const gridLinesRef = useRef<any[]>([]);
  const activeCurveRef = useRef<EditableCurve | null>(null);
  const activeLineRef = useRef<Line | null>(null);
  const lineHandlesRef = useRef<Circle[]>([]);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const previousCanvasSizeRef = useRef<{
    width: number;
    height: number;
    viewportTransform: number[] | null;
  } | null>(null);
  // Fonction pour obtenir les coordonnées correctes du canvas en tenant compte du zoom/pan
  const getCanvasPoint = useCallback((canvas: FabricCanvas, e: any): { x: number; y: number } => {
    if (!canvas) return { x: 0, y: 0 };

    // Obtenir la position de la souris par rapport au canvas
    const pointer = canvas.getPointer(e);
    return { x: pointer.x, y: pointer.y };
  }, []);

  // ✅ Fonction snap simplifiée - UNIQUEMENT vers les objets utilisateur
  const snapPoint = useCallback(
    (point: { x: number; y: number }, canvas?: FabricCanvas) => {
      // Si magnétisme désactivé, retourner le point tel quel
      if (!snapToGrid || !canvas) {
        return point;
      }

      const SNAP_DISTANCE = 15; // Distance de détection en pixels
      let minDistance = SNAP_DISTANCE;
      let targetPoint: { x: number; y: number } | null = null;

      canvas.getObjects().forEach((obj) => {
        // UNIQUEMENT les objets créés par l'utilisateur, ignorer les poignées
        if (!(obj as any).isUserDrawn || (obj as any).isLineHandle) {
          return;
        }

        let endpoints: { x: number; y: number }[] = [];

        // Lignes : extrémités
        if (obj instanceof Line) {
          const line = obj as Line;
          endpoints.push({ x: line.x1 ?? 0, y: line.y1 ?? 0 }, { x: line.x2 ?? 0, y: line.y2 ?? 0 });
        }
        // Courbes éditables : extrémités
        else if ((obj as any).customType === "editableCurve") {
          const curve = obj as unknown as EditableCurve;
          const matrix = curve.calcTransformMatrix();
          const startAbs = new Point(curve.controlPoints.start.x, curve.controlPoints.start.y).transform(matrix);
          const endAbs = new Point(curve.controlPoints.end.x, curve.controlPoints.end.y).transform(matrix);
          endpoints.push({ x: startAbs.x, y: startAbs.y }, { x: endAbs.x, y: endAbs.y });
        }
        // Rectangles : coins
        else if (obj instanceof Rect) {
          const rect = obj as Rect;
          const left = rect.left ?? 0;
          const top = rect.top ?? 0;
          const width = (rect.width ?? 0) * (rect.scaleX ?? 1);
          const height = (rect.height ?? 0) * (rect.scaleY ?? 1);
          endpoints.push(
            { x: left, y: top },
            { x: left + width, y: top },
            { x: left, y: top + height },
            { x: left + width, y: top + height },
          );
        }

        // Tester la distance vers chaque point
        endpoints.forEach((p) => {
          const distance = Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2));
          if (distance < minDistance) {
            minDistance = distance;
            targetPoint = { x: p.x, y: p.y };
          }
        });
      });

      return targetPoint || point;
    },
    [snapToGrid],
  );

  // Créer la grille limitée à l'image
  const createGrid = useCallback(
    (canvas: FabricCanvas, width: number, height: number) => {
      gridLinesRef.current.forEach((line) => canvas.remove(line));
      gridLinesRef.current = [];

      if (!showGrid) return;

      const gridColor = "#e0e0e0";
      const gridStrokeWidth = 0.5; // Trait fin pour la grille

      // Utiliser les dimensions de l'image background si disponible
      const bg = canvas.backgroundImage as FabricImage | null;
      let gridWidth = width;
      let gridHeight = height;

      if (bg && bg.width && bg.height) {
        // Dimensions réelles de l'image avec son échelle
        gridWidth = bg.width * (bg.scaleX || 1);
        gridHeight = bg.height * (bg.scaleY || 1);
      }

      // Lignes verticales
      for (let i = 0; i <= Math.ceil(gridWidth / gridSize); i++) {
        const x = i * gridSize;
        if (x <= gridWidth) {
          const line = new Line([x, 0, x, gridHeight], {
            stroke: gridColor,
            strokeWidth: gridStrokeWidth,
            selectable: false,
            evented: false,
            lockMovementX: true,
            lockMovementY: true,
            hasControls: false,
            hasBorders: false,
            objectCaching: false, // Désactiver le cache pour éviter les problèmes de rendu au zoom
            strokeUniform: true, // Épaisseur uniforme quel que soit le zoom
          });
          (line as any).isGridLine = true; // Marquer explicitement comme ligne de grille
          canvas.add(line);
          canvas.sendObjectToBack(line);
          gridLinesRef.current.push(line);
        }
      }

      // Lignes horizontales
      for (let i = 0; i <= Math.ceil(gridHeight / gridSize); i++) {
        const y = i * gridSize;
        if (y <= gridHeight) {
          const line = new Line([0, y, gridWidth, y], {
            stroke: gridColor,
            strokeWidth: gridStrokeWidth,
            selectable: false,
            evented: false,
            lockMovementX: true,
            lockMovementY: true,
            hasControls: false,
            hasBorders: false,
            objectCaching: false, // Désactiver le cache pour éviter les problèmes de rendu au zoom
            strokeUniform: true, // Épaisseur uniforme quel que soit le zoom
          });
          (line as any).isGridLine = true; // Marquer explicitement comme ligne de grille
          canvas.add(line);
          canvas.sendObjectToBack(line);
          gridLinesRef.current.push(line);
        }
      }

      canvas.renderAll();
    },
    [showGrid, gridSize],
  );

  // Sauvegarder l'état pour undo/redo (en excluant les poignées et éléments UI temporaires)
  const saveState = useCallback(
    (canvas: FabricCanvas) => {
      const objects = canvas.getObjects().filter(
        (obj) =>
          (!gridLinesRef.current.includes(obj) && // Pas la grille
            !(obj as any).curvePointType && // Pas les poignées de courbe
            !(obj as any).isRuler && // Pas les règles
            (obj.type !== "line" || !(obj as any).strokeDashArray) && // Pas les lignes de construction
            obj.selectable !== false) || // Garder les objets sélectionnables
          (obj as any).customType === "editableCurve", // Toujours garder les courbes éditables
      );
      const state: HistoryState = {
        objects: objects.map((obj) => obj.toJSON()),
      };

      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(state);

      if (newHistory.length > 50) {
        newHistory.shift();
      } else {
        setHistoryIndex(historyIndex + 1);
      }

      setHistory(newHistory);
    },
    [history, historyIndex],
  );

  // Annuler
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0 || !fabricCanvas) return;

    const newIndex = historyIndex - 1;
    const state = history[newIndex];

    const objects = fabricCanvas.getObjects();
    objects.forEach((obj) => {
      if (
        !gridLinesRef.current.includes(obj) &&
        !(obj as any).curvePointType &&
        (obj.type !== "line" || !(obj as any).strokeDashArray)
      ) {
        fabricCanvas.remove(obj);
      }
    });

    state.objects.forEach((objData: any) => {
      fabricCanvas.add(objData);
    });

    setHistoryIndex(newIndex);
    fabricCanvas.renderAll();
    onDrawingsChanged?.(fabricCanvas.toJSON());
  }, [historyIndex, history, fabricCanvas, onDrawingsChanged]);

  // Refaire
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1 || !fabricCanvas) return;

    const newIndex = historyIndex + 1;
    const state = history[newIndex];

    const objects = fabricCanvas.getObjects();
    objects.forEach((obj) => {
      if (
        !gridLinesRef.current.includes(obj) &&
        !(obj as any).curvePointType &&
        (obj.type !== "line" || !(obj as any).strokeDashArray)
      ) {
        fabricCanvas.remove(obj);
      }
    });

    state.objects.forEach((objData: any) => {
      fabricCanvas.add(objData);
    });

    setHistoryIndex(newIndex);
    fabricCanvas.renderAll();
    onDrawingsChanged?.(fabricCanvas.toJSON());
  }, [historyIndex, history, fabricCanvas, onDrawingsChanged]);

  // Nettoyer les objets temporaires quand on change d'outil
  useEffect(() => {
    if (!fabricCanvas) return;

    // Nettoyer tous les objets temporaires
    tempObjects.forEach((obj) => fabricCanvas.remove(obj));
    setTempObjects([]);
    setTempPoints([]);

    // 🧹 NETTOYAGE COMPLET : Supprimer tous les objets temporaires et lignes de construction
    const objectsToRemove: any[] = [];
    fabricCanvas.getObjects().forEach((obj) => {
      // Supprimer les lignes en pointillés (sauf la grille)
      if (obj instanceof Line && (obj as any).strokeDashArray && !(obj as any).isGridLine) {
        // Vérifier si c'est une ligne de contrôle d'une courbe active
        const isActiveControlLine = activeCurveRef.current?.controlLines.includes(obj);
        if (!isActiveControlLine) {
          objectsToRemove.push(obj);
        }
      }
      // Nettoyer TOUTES les lignes de contrôle orphelines (isControlLine)
      if (obj instanceof Line && (obj as any).isControlLine) {
        const belongsToActiveCurve = activeCurveRef.current?.controlLines.includes(obj);
        if (!belongsToActiveCurve) {
          objectsToRemove.push(obj);
        }
      }
      // Supprimer les marqueurs temporaires (cercles bleus non sélectionnables)
      if (obj instanceof Circle && !obj.selectable && (obj as any).fill === "#3b82f6") {
        objectsToRemove.push(obj);
      }
      // Supprimer les courbes de preview (paths avec opacity 0.7)
      if (obj instanceof Path && !obj.selectable && (obj as any).opacity === 0.7) {
        objectsToRemove.push(obj);
      }
    });
    objectsToRemove.forEach((obj) => fabricCanvas.remove(obj));

    if (previewCurve) {
      fabricCanvas.remove(previewCurve);
      setPreviewCurve(null);
    }

    fabricCanvas.renderAll();
  }, [activeTool, fabricCanvas]);

  // Initialisation du canvas
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    // 🔧 BUG FIX : S'assurer que l'élément canvas est valide avant d'initialiser Fabric
    if (!(canvasElement instanceof HTMLCanvasElement)) {
      console.error("Canvas element is not a valid HTMLCanvasElement");
      return;
    }

    // 🔧 BUG FIX #8 : Définir les dimensions du canvas HTML avant d'initialiser Fabric.js
    // Cela évite l'erreur "Right side of assignment cannot be destructured"
    canvasElement.width = 1400;
    canvasElement.height = 900;

    const canvas = new FabricCanvas(canvasElement, {
      backgroundColor: "#ffffff",
      selection: true,
      preserveObjectStacking: true,
    });

    // 🔧 Filtre de sélection : empêcher uniquement la sélection de la grille et des traits de construction,
    // mais laisser les poignées de courbe éditable sélectionnables pour permettre l'édition.
    const filterSelection = (e: any) => {
      const activeObject = canvas.getActiveObject();
      if (!activeObject) return;

      // Si c'est un seul objet
      if (activeObject.type !== "activeSelection") {
        // Si c'est une ligne de grille, une règle ou dans gridLinesRef, désélectionner
        if (
          (activeObject as any).isGridLine ||
          (activeObject as any).isRuler ||
          gridLinesRef.current.includes(activeObject)
        ) {
          canvas.discardActiveObject();
          canvas.renderAll();
        }
      }
      // Si c'est une sélection multiple
      else {
        const objects = (activeObject as any)._objects || [];
        const filtered = objects.filter((obj: any) => {
          return !((obj as any).isGridLine || (obj as any).isRuler || gridLinesRef.current.includes(obj));
        });

        if (filtered.length === 0) {
          // Tous les objets sont de la grille / construction, désélectionner
          canvas.discardActiveObject();
          canvas.renderAll();
        } else if (filtered.length !== objects.length) {
          // Certains objets sont à exclure, recréer la sélection sans eux
          canvas.discardActiveObject();
          if (filtered.length === 1) {
            canvas.setActiveObject(filtered[0]);
          } else {
            // Créer une nouvelle sélection avec les objets filtrés
            const sel = new fabric.ActiveSelection(filtered, { canvas });
            canvas.setActiveObject(sel);
          }
          canvas.renderAll();
        }
      }
    };

    canvas.on("selection:created", filterSelection);
    canvas.on("selection:updated", filterSelection);

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;

      const maxWidth = 1400;
      const maxHeight = 900;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);

      const finalWidth = img.width * scale;
      const finalHeight = img.height * scale;

      canvas.setWidth(finalWidth);
      canvas.setHeight(finalHeight);

      FabricImage.fromURL(imageUrl).then((fabricImg) => {
        // Centrer l'image sur le canvas
        const imgWidth = img.width * scale;
        const imgHeight = img.height * scale;
        const left = (finalWidth - imgWidth) / 2;
        const top = (finalHeight - imgHeight) / 2;

        fabricImg.set({
          scaleX: scale,
          scaleY: scale,
          left: left,
          top: top,
          selectable: false,
          evented: false,
        });
        canvas.backgroundImage = fabricImg;
        canvas.renderAll();

        createGrid(canvas, finalWidth, finalHeight);
      });

      saveState(canvas);
    };
    img.src = imageUrl;

    setFabricCanvas(canvas);
    toast.success("Canevas de traçage prêt !");

    return () => {
      canvas.dispose();
    };
  }, [imageUrl]);

  // Recréer la grille quand les paramètres changent
  useEffect(() => {
    if (!fabricCanvas || !imgRef.current) return;
    createGrid(fabricCanvas, fabricCanvas.width || 1400, fabricCanvas.height || 900);

    // Dessiner les règles graduées
    if (showRulers) {
      // Supprimer les anciennes règles
      const objects = fabricCanvas.getObjects();
      objects.forEach((obj: any) => {
        if (obj.isRuler) {
          fabricCanvas.remove(obj);
        }
      });

      const canvasWidth = fabricCanvas.width || 1400;
      const canvasHeight = fabricCanvas.height || 900;
      const rulerColor = "#000000";
      const textColor = "#000000";
      const rulerMargin = 30; // Marge pour dessiner les règles en dehors de l'image

      // Créer un fond blanc pour les règles (en dehors de l'image)
      const bottomRulerBg = new Rect({
        left: 0,
        top: canvasHeight,
        width: canvasWidth,
        height: rulerMargin,
        fill: "#ffffff",
        selectable: false,
        evented: false,
      });
      (bottomRulerBg as any).isRuler = true;
      fabricCanvas.add(bottomRulerBg);

      const leftRulerBg = new Rect({
        left: -rulerMargin,
        top: 0,
        width: rulerMargin,
        height: canvasHeight,
        fill: "#ffffff",
        selectable: false,
        evented: false,
      });
      (leftRulerBg as any).isRuler = true;
      fabricCanvas.add(leftRulerBg);

      // Règle horizontale (axe X) - chiffres basés sur scaleValuePerCell
      const numTicksX = Math.ceil(canvasWidth / gridSize);
      for (let i = 0; i <= numTicksX; i++) {
        const x = i * gridSize;
        if (x > canvasWidth) break;

        // Calculer la valeur réelle : position * mm par pixel
        const realMm = i * scaleValuePerCell;
        // Afficher en cm si >= 10mm
        const displayValue = realMm >= 10 ? (realMm / 10).toFixed(realMm % 10 === 0 ? 0 : 1) : realMm.toFixed(0);
        const unit = realMm >= 10 ? "" : ""; // On affiche juste le nombre

        // Trait vertical petit (en dehors de l'image)
        const line = new Line([x, canvasHeight, x, canvasHeight + 8], {
          stroke: rulerColor,
          strokeWidth: 1,
          selectable: false,
          evented: false,
          objectCaching: false,
          strokeUniform: true,
        });
        (line as any).isRuler = true;
        fabricCanvas.add(line);

        // Texte en bas (à chaque trait)
        const text = new FabricText(`${displayValue}`, {
          left: x - 8,
          top: canvasHeight + 12,
          fontSize: 12,
          fill: textColor,
          selectable: false,
          evented: false,
          fontWeight: "normal",
        });
        (text as any).isRuler = true;
        fabricCanvas.add(text);
      }

      // Règle verticale (axe Y) - à gauche, 0 en bas
      const numTicksY = Math.ceil(canvasHeight / gridSize);
      for (let i = 0; i <= numTicksY; i++) {
        const y = canvasHeight - i * gridSize; // Inverser l'axe Y
        if (y < 0) break;

        // Calculer la valeur réelle
        const realMm = i * scaleValuePerCell;
        const displayValue = realMm >= 10 ? (realMm / 10).toFixed(realMm % 10 === 0 ? 0 : 1) : realMm.toFixed(0);

        // Trait horizontal petit (en dehors de l'image)
        const line = new Line([-8, y, 0, y], {
          stroke: rulerColor,
          strokeWidth: 1,
          selectable: false,
          evented: false,
          objectCaching: false,
          strokeUniform: true,
        });
        (line as any).isRuler = true;
        fabricCanvas.add(line);

        // Texte à gauche (à chaque trait)
        const text = new FabricText(`${displayValue}`, {
          left: -28,
          top: y - 6,
          fontSize: 12,
          fill: textColor,
          selectable: false,
          evented: false,
          fontWeight: "normal",
        });
        (text as any).isRuler = true;
        fabricCanvas.add(text);
      }

      fabricCanvas.renderAll();
    } else {
      // Supprimer les règles si désactivées
      const objects = fabricCanvas.getObjects();
      objects.forEach((obj: any) => {
        if (obj.isRuler) {
          fabricCanvas.remove(obj);
        }
      });
      fabricCanvas.renderAll();
    }
  }, [showGrid, gridSize, fabricCanvas, createGrid, showRulers, scaleValuePerCell, effectiveScale]);

  // 🔧 BUG FIX #6 : Gérer la sélection et le déplacement des courbes éditables
  useEffect(() => {
    if (!fabricCanvas) return;

    // Fonction pour créer les poignées d'une ligne
    const createLineHandles = (line: Line) => {
      removeLineHandles();

      const x1 = line.x1 ?? 0;
      const y1 = line.y1 ?? 0;
      const x2 = line.x2 ?? 0;
      const y2 = line.y2 ?? 0;

      const handleProps = {
        radius: 6,
        fill: "#3b82f6",
        stroke: "#ffffff",
        strokeWidth: 2,
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: false,
        originX: "center" as const,
        originY: "center" as const,
        hoverCursor: "pointer",
      };

      const handle1 = new Circle({ ...handleProps, left: x1, top: y1 });
      const handle2 = new Circle({ ...handleProps, left: x2, top: y2 });

      (handle1 as any).isLineHandle = true;
      (handle1 as any).handleType = "start";
      (handle1 as any).parentLine = line;

      (handle2 as any).isLineHandle = true;
      (handle2 as any).handleType = "end";
      (handle2 as any).parentLine = line;

      // Gérer le déplacement des poignées avec magnétisme
      handle1.on("moving", () => {
        const pos = { x: handle1.left ?? 0, y: handle1.top ?? 0 };
        const snapped = snapPoint(pos, fabricCanvas);
        handle1.set({ left: snapped.x, top: snapped.y });
        line.set({ x1: snapped.x, y1: snapped.y });
        line.setCoords();
        fabricCanvas.requestRenderAll();
      });

      handle2.on("moving", () => {
        const pos = { x: handle2.left ?? 0, y: handle2.top ?? 0 };
        const snapped = snapPoint(pos, fabricCanvas);
        handle2.set({ left: snapped.x, top: snapped.y });
        line.set({ x2: snapped.x, y2: snapped.y });
        line.setCoords();
        fabricCanvas.requestRenderAll();
      });

      fabricCanvas.add(handle1);
      fabricCanvas.add(handle2);
      lineHandlesRef.current = [handle1, handle2];
    };

    // Fonction pour supprimer les poignées
    const removeLineHandles = () => {
      lineHandlesRef.current.forEach((handle) => {
        fabricCanvas.remove(handle);
      });
      lineHandlesRef.current = [];
    };

    // Synchroniser les poignées avec la position de la ligne (en tenant compte de la transformation)
    const syncLineHandles = (line: Line) => {
      if (lineHandlesRef.current.length === 2 && activeLineRef.current === line) {
        // Calculer les vraies coordonnées en tenant compte de left/top
        const matrix = line.calcTransformMatrix();
        const x1 = line.x1 ?? 0;
        const y1 = line.y1 ?? 0;
        const x2 = line.x2 ?? 0;
        const y2 = line.y2 ?? 0;

        // Appliquer la transformation
        const point1 = new Point(x1, y1).transform(matrix);
        const point2 = new Point(x2, y2).transform(matrix);

        lineHandlesRef.current[0].set({ left: point1.x, top: point1.y });
        lineHandlesRef.current[0].setCoords();
        lineHandlesRef.current[1].set({ left: point2.x, top: point2.y });
        lineHandlesRef.current[1].setCoords();
      }
    };

    const handleSelection = (e: any) => {
      const selected = e.selected?.[0];

      // Ignorer la sélection des poignées (ligne ou courbe)
      if (selected && ((selected as any).isLineHandle || (selected as any).isControlHandle)) {
        return;
      }

      // Cacher les poignées de la courbe précédente
      if (activeCurveRef.current && activeCurveRef.current !== selected) {
        activeCurveRef.current.removeHandles(fabricCanvas);
        activeCurveRef.current = null;
      }

      // Cacher les poignées de la ligne précédente
      if (activeLineRef.current && activeLineRef.current !== selected) {
        removeLineHandles();
        activeLineRef.current = null;
      }

      // Si c'est une courbe éditable, montrer les poignées
      if (selected && (selected as any).customType === "editableCurve") {
        const curve = selected as EditableCurve;
        curve.createHandles(fabricCanvas, strokeColor);
        activeCurveRef.current = curve;
      }
      // Si c'est une ligne utilisateur, montrer les poignées aux extrémités
      else if (selected && selected instanceof Line && (selected as any).isUserDrawn) {
        createLineHandles(selected);
        activeLineRef.current = selected;
      }
    };

    const handleDeselection = () => {
      if (activeCurveRef.current) {
        activeCurveRef.current.removeHandles(fabricCanvas);
        activeCurveRef.current = null;
      }
      if (activeLineRef.current) {
        removeLineHandles();
        activeLineRef.current = null;
      }
    };

    // 🔧 BUG FIX : Mettre à jour les poignées quand la courbe ou ligne bouge
    const handleObjectMoving = (e: any) => {
      const obj = e.target;

      // Synchroniser les poignées de courbe
      if (obj && (obj as any).customType === "editableCurve") {
        const curve = obj as unknown as EditableCurve;
        curve.syncHandlesOnMove();
        fabricCanvas.requestRenderAll();
      }

      // Synchroniser les poignées de ligne (ne pas si c'est une poignée qui bouge)
      if (obj && obj instanceof Line && (obj as any).isUserDrawn && !(obj as any).isLineHandle) {
        syncLineHandles(obj);
        fabricCanvas.requestRenderAll();
      }
    };

    // 🔧 BUG FIX : Mettre à jour les poignées après modification (scaling, rotation, etc.)
    const handleObjectModified = (e: any) => {
      const obj = e.target;

      // Pour les courbes
      if (obj && (obj as any).customType === "editableCurve") {
        const curve = obj as unknown as EditableCurve;

        // 🔧 NETTOYAGE AGRESSIF : Supprimer toutes les lignes de contrôle orphelines
        const objectsToRemove: any[] = [];
        fabricCanvas.getObjects().forEach((canvasObj) => {
          if (canvasObj instanceof Line && (canvasObj as any).isControlLine) {
            // Vérifier si cette ligne appartient à la courbe actuelle
            if (!curve.controlLines.includes(canvasObj)) {
              objectsToRemove.push(canvasObj);
            }
          }
        });
        objectsToRemove.forEach((toRemove) => fabricCanvas.remove(toRemove));

        // Re-synchroniser les poignées avec la courbe telle qu'elle est transformée
        curve.syncHandlesOnMove();

        // S'assurer que la courbe active garde des poignées cohérentes
        if (activeCurveRef.current === curve) {
          activeCurveRef.current = curve;
        }

        fabricCanvas.requestRenderAll();
      }

      // Pour les lignes
      if (obj && obj instanceof Line && (obj as any).isUserDrawn && !(obj as any).isLineHandle) {
        syncLineHandles(obj);
        fabricCanvas.requestRenderAll();
      }
    };

    fabricCanvas.on("selection:created", handleSelection);
    fabricCanvas.on("selection:updated", handleSelection);
    fabricCanvas.on("selection:cleared", handleDeselection);
    fabricCanvas.on("object:moving", handleObjectMoving);
    fabricCanvas.on("object:modified", handleObjectModified);

    return () => {
      fabricCanvas.off("selection:created", handleSelection);
      fabricCanvas.off("selection:updated", handleSelection);
      fabricCanvas.off("selection:cleared", handleDeselection);
      fabricCanvas.off("object:moving", handleObjectMoving);
      fabricCanvas.off("object:modified", handleObjectModified);
    };
  }, [fabricCanvas, strokeColor, snapPoint]);

  // Gérer les outils
  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = activeTool === "pencil";
    // Activer la sélection rectangulaire uniquement en mode select
    fabricCanvas.selection = activeTool === "select";

    // 🎯 Gestion du curseur selon l'outil actif
    const drawingTools = [
      "line",
      "rectangle",
      "circle",
      "ellipse",
      "editableCurve",
      "bezier",
      "spline",
      "polygon",
      "dimension",
      "text",
    ];

    if (activeTool === "pan") {
      fabricCanvas.defaultCursor = "grab";
      fabricCanvas.hoverCursor = "grab";
    } else if (activeTool === "select") {
      fabricCanvas.defaultCursor = "default";
      fabricCanvas.hoverCursor = "move";
    } else if (drawingTools.includes(activeTool)) {
      fabricCanvas.defaultCursor = "crosshair";
      fabricCanvas.hoverCursor = "crosshair";
    } else if (activeTool === "pencil") {
      fabricCanvas.defaultCursor = "crosshair";
      fabricCanvas.hoverCursor = "crosshair";
    } else {
      fabricCanvas.defaultCursor = "default";
      fabricCanvas.hoverCursor = "move";
    }

    // 🎯 S'assurer que tous les objets existants sont sélectionnables
    fabricCanvas.getObjects().forEach((obj: any) => {
      // Ne pas modifier les objets qui ne doivent pas être sélectionnables (grille, règles, etc.)
      if (
        !obj.isRuler &&
        !obj.isGridLine &&
        !obj.isControlHandle &&
        !obj.isControlLine &&
        !obj.isLineHandle &&
        !gridLinesRef.current.includes(obj)
      ) {
        obj.selectable = true;
        obj.evented = true;
        obj.setCoords(); // Mettre à jour les coordonnées pour la sélection
        // Définir le curseur de survol pour chaque objet
        if (activeTool === "select") {
          obj.hoverCursor = "move";
        }
      } else if (obj.isLineHandle || obj.isControlHandle) {
        // Les poignées ne sont actives QUE en mode sélection
        // En mode dessin, on doit pouvoir cliquer à travers elles
        if (activeTool === "select") {
          obj.selectable = true;
          obj.evented = true;
        } else {
          obj.selectable = false;
          obj.evented = false;
        }
      } else {
        // Forcer les objets non sélectionnables à le rester
        obj.selectable = false;
        obj.evented = false;
      }
    });

    fabricCanvas.renderAll();

    if (activeTool === "pencil" && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = strokeColor;
      fabricCanvas.freeDrawingBrush.width = strokeWidth;
    }

    fabricCanvas.off("mouse:down");
    fabricCanvas.off("mouse:move");
    fabricCanvas.off("mouse:up");
    fabricCanvas.off("mouse:wheel");

    // 🔧 BUG FIX #7 : Gestion améliorée du pan avec le bouton du milieu (molette)
    let isPanningWithMiddleButton = false;
    let lastPanPos: { x: number; y: number } | null = null;

    const handleMiddleButtonDown = (opt: any) => {
      const evt = opt.e;
      if (evt instanceof MouseEvent && evt.button === 1) {
        // Bouton du milieu (molette)
        isPanningWithMiddleButton = true;
        fabricCanvas.selection = false;
        fabricCanvas.defaultCursor = "grabbing";
        lastPanPos = { x: evt.clientX, y: evt.clientY };
        evt.preventDefault();
        evt.stopPropagation();
        return false;
      }
    };

    const handleMiddleButtonMove = (opt: any) => {
      const evt = opt.e;
      if (isPanningWithMiddleButton && lastPanPos && evt instanceof MouseEvent) {
        const vpt = fabricCanvas.viewportTransform;
        if (vpt) {
          const currentZoom = fabricCanvas.getZoom();
          const canvasWidth = fabricCanvas.getWidth();
          const canvasHeight = fabricCanvas.getHeight();

          // Calculer les nouvelles positions
          let newX = vpt[4] + evt.clientX - lastPanPos.x;
          let newY = vpt[5] + evt.clientY - lastPanPos.y;

          // Limiter le pan pour garder au moins 20% de l'image visible
          // minPan : l'image peut sortir vers la gauche/haut jusqu'à ce que 20% reste visible à droite/bas
          // maxPan : l'image peut sortir vers la droite/bas jusqu'à ce que 20% reste visible à gauche/haut
          const visibleRatio = 0.2;
          const minPanX = canvasWidth * visibleRatio - canvasWidth * currentZoom;
          const maxPanX = canvasWidth * (1 - visibleRatio);
          const minPanY = canvasHeight * visibleRatio - canvasHeight * currentZoom;
          const maxPanY = canvasHeight * (1 - visibleRatio);

          newX = Math.max(minPanX, Math.min(maxPanX, newX));
          newY = Math.max(minPanY, Math.min(maxPanY, newY));

          vpt[4] = newX;
          vpt[5] = newY;
          fabricCanvas.requestRenderAll();
          lastPanPos = { x: evt.clientX, y: evt.clientY };
        }
        evt.preventDefault();
        evt.stopPropagation();
        return false;
      }
    };

    const handleMiddleButtonUp = (opt: any) => {
      const evt = opt.e;
      if (evt instanceof MouseEvent && evt.button === 1) {
        isPanningWithMiddleButton = false;
        fabricCanvas.selection = activeTool === "select";

        // Remettre le curseur approprié selon l'outil actif
        const drawingTools = [
          "line",
          "rectangle",
          "circle",
          "ellipse",
          "editableCurve",
          "bezier",
          "spline",
          "polygon",
          "dimension",
          "text",
          "pencil",
        ];

        if (activeTool === "pan") {
          fabricCanvas.defaultCursor = "grab";
        } else if (drawingTools.includes(activeTool)) {
          fabricCanvas.defaultCursor = "crosshair";
        } else {
          fabricCanvas.defaultCursor = "default";
        }

        lastPanPos = null;
        evt.preventDefault();
        evt.stopPropagation();
        return false;
      }
    };

    // Attacher les événements au niveau du canvas HTML pour capturer le bouton du milieu
    const canvasElement = fabricCanvas.getElement();
    canvasElement.addEventListener("mousedown", handleMiddleButtonDown as any, true);
    canvasElement.addEventListener("mousemove", handleMiddleButtonMove as any, true);
    canvasElement.addEventListener("mouseup", handleMiddleButtonUp as any, true);

    // Également attacher aux événements Fabric pour compatibilité
    fabricCanvas.on("mouse:down", handleMiddleButtonDown);
    fabricCanvas.on("mouse:move", handleMiddleButtonMove);
    fabricCanvas.on("mouse:up", handleMiddleButtonUp);

    // Zoom avec la molette (toujours actif)
    fabricCanvas.on("mouse:wheel", (opt) => {
      const delta = opt.e.deltaY;
      const evt = opt.e;
      evt.preventDefault();
      evt.stopPropagation();

      let newZoom = fabricCanvas.getZoom();
      newZoom *= 0.999 ** delta;
      if (newZoom > 5) newZoom = 5;
      if (newZoom < 0.1) newZoom = 0.1;

      // Utiliser le centre du canvas si on ne peut pas obtenir la position de la souris
      const canvasEl = fabricCanvas.getElement();
      const rect = canvasEl.getBoundingClientRect();
      const mouseX = evt.clientX - rect.left;
      const mouseY = evt.clientY - rect.top;

      fabricCanvas.zoomToPoint(new Point(mouseX, mouseY), newZoom);
      setZoom(newZoom);
      fabricCanvas.requestRenderAll(); // Forcer le rendu après zoom
    });

    // Gestion du pan (déplacement)
    if (activeTool === "pan") {
      fabricCanvas.selection = false;
      fabricCanvas.defaultCursor = "grab";
      let panning = false;

      fabricCanvas.on("mouse:down", (opt) => {
        const evt = opt.e;
        if (evt instanceof MouseEvent || evt instanceof TouchEvent) {
          panning = true;
          fabricCanvas.selection = false;
          fabricCanvas.defaultCursor = "grabbing";
          lastPosRef.current = {
            x: (evt as MouseEvent).clientX || 0,
            y: (evt as MouseEvent).clientY || 0,
          };
        }
      });

      fabricCanvas.on("mouse:move", (opt) => {
        if (panning && lastPosRef.current) {
          const evt = opt.e;
          if (evt instanceof MouseEvent) {
            const vpt = fabricCanvas.viewportTransform;
            if (vpt) {
              const currentZoom = fabricCanvas.getZoom();
              const canvasWidth = fabricCanvas.getWidth();
              const canvasHeight = fabricCanvas.getHeight();

              // Calculer les nouvelles positions
              let newX = vpt[4] + evt.clientX - lastPosRef.current.x;
              let newY = vpt[5] + evt.clientY - lastPosRef.current.y;

              // Limiter le pan pour garder au moins 20% de l'image visible
              const visibleRatio = 0.2;
              const minPanX = canvasWidth * visibleRatio - canvasWidth * currentZoom;
              const maxPanX = canvasWidth * (1 - visibleRatio);
              const minPanY = canvasHeight * visibleRatio - canvasHeight * currentZoom;
              const maxPanY = canvasHeight * (1 - visibleRatio);

              newX = Math.max(minPanX, Math.min(maxPanX, newX));
              newY = Math.max(minPanY, Math.min(maxPanY, newY));

              vpt[4] = newX;
              vpt[5] = newY;
              fabricCanvas.requestRenderAll();
              lastPosRef.current = { x: evt.clientX, y: evt.clientY };
            }
          }
        }
      });

      fabricCanvas.on("mouse:up", () => {
        panning = false;
        fabricCanvas.defaultCursor = "grab";
        lastPosRef.current = null;
      });

      return;
    }

    if (activeTool === "select" || activeTool === "pencil") return;

    let isDrawing = false;
    let startPoint: { x: number; y: number } | null = null;
    let activeObject: any = null;
    let previewObject: any = null;

    const cleanTempObjects = () => {
      tempObjects.forEach((obj) => fabricCanvas.remove(obj));
      setTempObjects([]);
    };

    const createMarker = (point: { x: number; y: number }, color: string = strokeColor) => {
      const marker = new Circle({
        left: point.x,
        top: point.y,
        radius: 5,
        fill: color,
        stroke: "#ffffff",
        strokeWidth: 2,
        selectable: false,
        evented: false,
        originX: "center",
        originY: "center",
      });
      fabricCanvas.add(marker);
      fabricCanvas.bringObjectToFront(marker);
      return marker;
    };

    // Fonction pour nettoyer COMPLÈTEMENT tous les objets temporaires
    const cleanAllTempObjects = () => {
      tempObjects.forEach((obj) => fabricCanvas.remove(obj));
      setTempObjects([]);
      setTempPoints([]);
      if (previewCurve) {
        fabricCanvas.remove(previewCurve);
        setPreviewCurve(null);
      }

      // 🧹 NETTOYAGE COMPLET : Supprimer tous les objets temporaires
      const toRemove: any[] = [];
      fabricCanvas.getObjects().forEach((obj) => {
        // Lignes en pointillés (sauf la grille)
        if (obj instanceof Line && (obj as any).strokeDashArray && !(obj as any).isGridLine) {
          toRemove.push(obj);
        }
        // Lignes de contrôle orphelines
        if (obj instanceof Line && (obj as any).isControlLine) {
          toRemove.push(obj);
        }
        // Marqueurs temporaires
        if (obj instanceof Circle && !obj.selectable && (obj as any).fill === "#3b82f6") {
          toRemove.push(obj);
        }
        // Courbes de preview
        if (obj instanceof Path && !obj.selectable && (obj as any).opacity === 0.7) {
          toRemove.push(obj);
        }
      });
      toRemove.forEach((obj) => fabricCanvas.remove(obj));

      fabricCanvas.renderAll();
    };

    // === OUTIL COURBE ÉDITABLE (le nouveau !) ===
    if (activeTool === "editableCurve") {
      let isFinalizingCurve = false;

      fabricCanvas.on("mouse:down", (e) => {
        if (!e.e || isFinalizingCurve) return;

        // 🔧 BUG FIX #2 : Ignorer le bouton du milieu (pan)
        if (e.e instanceof MouseEvent && e.e.button === 1) return;

        // 🔧 NOUVEAU FIX : Vérifier si on clique sur une courbe existante
        const clickedObject = e.target;
        if (clickedObject && (clickedObject as any).customType === "editableCurve") {
          // On a cliqué sur une courbe existante, permettre sa sélection
          fabricCanvas.setActiveObject(clickedObject);
          fabricCanvas.renderAll();
          return; // Ne pas créer de nouveau point
        }

        // 🔧 NOUVEAU FIX : Vérifier si on clique sur une poignée de contrôle
        if (clickedObject && (clickedObject as any).isControlHandle) {
          // On a cliqué sur une poignée, la laisser être sélectionnée
          return;
        }

        const canvasPoint = getCanvasPoint(fabricCanvas, e.e);
        const snappedPoint = snapPoint(canvasPoint, fabricCanvas); // 🔧 Passer fabricCanvas pour snapping vers courbes
        const newPoint = { x: snappedPoint.x, y: snappedPoint.y };
        const updatedPoints = [...tempPoints, newPoint];
        setTempPoints(updatedPoints);

        const marker = createMarker(newPoint, "#3b82f6");
        setTempObjects((prev) => [...prev, marker]);

        if (updatedPoints.length === 1) {
          // Premier point = première extrémité
          toast.info("Première extrémité placée. Cliquez pour placer la deuxième extrémité");
        } else if (updatedPoints.length === 2) {
          // Deuxième point = deuxième extrémité
          toast.info("Deuxième extrémité placée. Déplacez la souris pour ajuster la courbure, puis cliquez");

          // 🔧 BUG FIX : NE PAS créer de courbe temporaire ici
          // On laisse uniquement l'aperçu dans mouse:move gérer l'affichage
        } else if (updatedPoints.length === 3) {
          // Troisième point = ajustement final du point de contrôle
          isFinalizingCurve = true;
          const [start, end, control] = updatedPoints;

          // NETTOYAGE COMPLET - Supprimer TOUS les objets temporaires (marqueurs)
          tempObjects.forEach((obj) => {
            fabricCanvas.remove(obj);
          });

          // 🧹 NETTOYAGE COMPLET FINAL : Supprimer TOUS les objets temporaires et lignes de construction
          const finalCleanup: any[] = [];
          fabricCanvas.getObjects().forEach((obj) => {
            // TOUTES les lignes en pointillés (sauf la grille)
            if (obj instanceof Line && (obj as any).strokeDashArray && !(obj as any).isGridLine) {
              finalCleanup.push(obj);
            }
            // TOUTES les lignes de contrôle (isControlLine)
            if (obj instanceof Line && (obj as any).isControlLine) {
              finalCleanup.push(obj);
            }
            // Cercles temporaires (marqueurs bleus)
            if (obj instanceof Circle && !obj.selectable && (obj as any).fill === "#3b82f6") {
              finalCleanup.push(obj);
            }
            // Courbes de preview
            if (obj instanceof Path && !obj.selectable && (obj as any).opacity === 0.7) {
              finalCleanup.push(obj);
            }
          });
          finalCleanup.forEach((obj) => fabricCanvas.remove(obj));

          // Supprimer la preview curve si elle existe
          if (previewCurve) {
            fabricCanvas.remove(previewCurve);
            setPreviewCurve(null);
          }

          // Créer la courbe finale
          const finalCurve = new EditableCurve(
            new Point(start.x, start.y),
            new Point(control.x, control.y),
            new Point(end.x, end.y),
            {
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              fill: "transparent",
              strokeLineCap: "round",
              strokeLineJoin: "round",
            },
          );
          (finalCurve as any).isUserDrawn = true;

          fabricCanvas.add(finalCurve);
          // Sélectionner automatiquement la courbe pour afficher ses poignées
          fabricCanvas.setActiveObject(finalCurve);

          // RÉINITIALISER COMPLÈTEMENT les états
          setTempObjects([]);
          setTempPoints([]);

          // Rendu final pour s'assurer que tout est bien nettoyé
          fabricCanvas.requestRenderAll();

          saveState(fabricCanvas);

          // NE PAS changer d'outil - rester en mode editableCurve pour tracer d'autres courbes
          // setActiveTool("select");

          toast.success("Courbe créée ! Cliquez pour tracer une nouvelle courbe.");

          // Réinitialiser le flag après un court délai
          setTimeout(() => {
            isFinalizingCurve = false;
          }, 100);
        }

        fabricCanvas.renderAll();
      });

      let previewMain: Path | null = null;
      let previewLine1: Line | null = null;
      let previewLine2: Line | null = null;

      fabricCanvas.on("mouse:move", (e) => {
        if (!e.e || tempPoints.length === 0 || isFinalizingCurve) return;

        const canvasPoint = getCanvasPoint(fabricCanvas, e.e);
        const snappedPoint = snapPoint(canvasPoint, fabricCanvas); // 🔧 Passer fabricCanvas pour snapping vers courbes

        // 🧹 Supprimer l'ancien aperçu (courbe + lignes)
        if (previewMain) {
          fabricCanvas.remove(previewMain);
          previewMain = null;
        }
        if (previewLine1) {
          fabricCanvas.remove(previewLine1);
          previewLine1 = null;
        }
        if (previewLine2) {
          fabricCanvas.remove(previewLine2);
          previewLine2 = null;
        }

        // Nettoyer aussi les objets d'aperçu dans tempObjects (anciens traits pointillés)
        const cleanedTempObjects = tempObjects.filter(
          (obj) => !(obj instanceof Line && (obj as any).strokeDashArray && !(obj as any).isGridLine),
        );
        if (cleanedTempObjects.length !== tempObjects.length) {
          tempObjects.forEach((obj) => {
            if (obj instanceof Line && (obj as any).strokeDashArray && !(obj as any).isGridLine) {
              fabricCanvas.remove(obj);
            }
          });
        }

        if (tempPoints.length === 1) {
          // Aperçu ligne droite vers la deuxième extrémité
          const lastPoint = tempPoints[0];
          previewLine1 = new Line([lastPoint.x, lastPoint.y, snappedPoint.x, snappedPoint.y], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            opacity: 0.7,
          });
          fabricCanvas.add(previewLine1);
        } else if (tempPoints.length === 2) {
          // Aperçu de la courbe avec le point de contrôle qui suit la souris
          const [start, end] = tempPoints;
          const pathData = `M ${start.x} ${start.y} Q ${snappedPoint.x} ${snappedPoint.y} ${end.x} ${end.y}`;
          previewMain = new Path(pathData, {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: "transparent",
            strokeLineCap: "round",
            strokeLineJoin: "round",
            opacity: 0.7,
            selectable: false,
            evented: false,
          });
          fabricCanvas.add(previewMain);

          // Lignes pointillées pour montrer le point de contrôle
          previewLine1 = new Line([start.x, start.y, snappedPoint.x, snappedPoint.y], {
            stroke: "#3b82f6",
            strokeWidth: 1,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            opacity: 0.5,
          });
          fabricCanvas.add(previewLine1);

          previewLine2 = new Line([snappedPoint.x, snappedPoint.y, end.x, end.y], {
            stroke: "#3b82f6",
            strokeWidth: 1,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            opacity: 0.5,
          });
          fabricCanvas.add(previewLine2);
        }

        fabricCanvas.renderAll();
      });

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && tempPoints.length > 0) {
          // Utiliser la fonction de nettoyage complet
          cleanAllTempObjects();
          toast.info("Courbe annulée");
        }
      };
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }

    // === OUTILS MULTI-POINTS (Bézier, Spline, Polygon) ===
    if (activeTool === "bezier" || activeTool === "spline" || activeTool === "polygon") {
      fabricCanvas.on("mouse:down", (e) => {
        if (!e.e) return;

        // 🔧 BUG FIX #2 : Ignorer le bouton du milieu (pan)
        if (e.e instanceof MouseEvent && e.e.button === 1) return;

        const canvasPoint = getCanvasPoint(fabricCanvas, e.e);
        const snappedPoint = snapPoint(canvasPoint, fabricCanvas); // 🔧 Passer fabricCanvas pour snapping vers courbes
        const newPoint = { x: snappedPoint.x, y: snappedPoint.y };

        if ((activeTool === "spline" || activeTool === "polygon") && tempPoints.length >= 2) {
          const lastPoint = tempPoints[tempPoints.length - 1];
          const distance = Math.sqrt(Math.pow(newPoint.x - lastPoint.x, 2) + Math.pow(newPoint.y - lastPoint.y, 2));

          if (distance < 15) {
            if (activeTool === "polygon") {
              const polygon = new Polygon(tempPoints, {
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                fill: "transparent",
                strokeLineJoin: "round",
                selectable: true,
                evented: true,
              });
              (polygon as any).isUserDrawn = true;
              fabricCanvas.add(polygon);
              toast.success("Polygone créé");
            } else if (activeTool === "spline") {
              let pathData = `M ${tempPoints[0].x},${tempPoints[0].y}`;

              for (let i = 1; i < tempPoints.length; i++) {
                if (i === 1) {
                  pathData += ` L ${tempPoints[i].x},${tempPoints[i].y}`;
                } else {
                  const prevPoint = tempPoints[i - 1];
                  const currentPoint = tempPoints[i];
                  const controlX = (prevPoint.x + currentPoint.x) / 2;
                  const controlY = (prevPoint.y + currentPoint.y) / 2;
                  pathData += ` Q ${prevPoint.x},${prevPoint.y} ${controlX},${controlY}`;
                }
              }

              const lastPoint = tempPoints[tempPoints.length - 1];
              pathData += ` L ${lastPoint.x},${lastPoint.y}`;

              const splinePath = new Path(pathData, {
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                fill: "transparent",
                strokeLineCap: "round",
                strokeLineJoin: "round",
                selectable: true,
                evented: true,
              });
              (splinePath as any).isUserDrawn = true;
              fabricCanvas.add(splinePath);
              toast.success("Spline créée");
            }

            cleanTempObjects();
            setTempPoints([]);
            saveState(fabricCanvas);
            fabricCanvas.renderAll();
            return;
          }
        }

        const updatedPoints = [...tempPoints, newPoint];
        setTempPoints(updatedPoints);

        const marker = createMarker(newPoint);
        setTempObjects((prev) => [...prev, marker]);

        if (updatedPoints.length > 1) {
          const prevPoint = updatedPoints[updatedPoints.length - 2];
          const connectionLine = new Line([prevPoint.x, prevPoint.y, newPoint.x, newPoint.y], {
            stroke: strokeColor,
            strokeWidth: 1,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
          });
          fabricCanvas.add(connectionLine);
          setTempObjects((prev) => [...prev, connectionLine]);
        }

        const requiredPoints = activeTool === "bezier" ? 4 : null;

        if (requiredPoints && updatedPoints.length === requiredPoints) {
          if (activeTool === "bezier") {
            const [p0, p1, p2, p3] = updatedPoints;
            const pathData = `M ${p0.x},${p0.y} C ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
            const bezierPath = new Path(pathData, {
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              fill: "transparent",
              strokeLineCap: "round",
              strokeLineJoin: "round",
              selectable: true,
              evented: true,
            });
            (bezierPath as any).isUserDrawn = true;
            fabricCanvas.add(bezierPath);
            toast.success("Courbe de Bézier créée");
          }

          cleanTempObjects();
          setTempPoints([]);
          saveState(fabricCanvas);
        }

        fabricCanvas.renderAll();
      });

      fabricCanvas.on("mouse:move", (e) => {
        if (!e.e || tempPoints.length === 0) return;

        const canvasPoint = getCanvasPoint(fabricCanvas, e.e);
        const snappedPoint = snapPoint(canvasPoint, fabricCanvas); // 🔧 Passer fabricCanvas pour snapping vers courbes

        if (previewObject) {
          fabricCanvas.remove(previewObject);
          previewObject = null;
        }

        const lastPoint = tempPoints[tempPoints.length - 1];
        previewObject = new Line([lastPoint.x, lastPoint.y, snappedPoint.x, snappedPoint.y], {
          stroke: strokeColor,
          strokeWidth: 1,
          strokeDashArray: [3, 3],
          selectable: false,
          evented: false,
          opacity: 0.5,
        });
        fabricCanvas.add(previewObject);
        fabricCanvas.renderAll();
      });

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && tempPoints.length > 0) {
          cleanTempObjects();
          setTempPoints([]);
          if (previewObject) {
            fabricCanvas.remove(previewObject);
            previewObject = null;
          }
          fabricCanvas.renderAll();
          toast.info("Tracé annulé");
        }
      };
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }

    // === OUTIL DIMENSION ===
    if (activeTool === "dimension") {
      fabricCanvas.on("mouse:down", (e) => {
        if (!e.e) return;

        // 🔧 BUG FIX #2 : Ignorer le bouton du milieu (pan)
        if (e.e instanceof MouseEvent && e.e.button === 1) return;

        const canvasPoint = getCanvasPoint(fabricCanvas, e.e);
        const snappedPoint = snapPoint(canvasPoint, fabricCanvas); // 🔧 Passer fabricCanvas pour snapping vers courbes
        const newPoint = { x: snappedPoint.x, y: snappedPoint.y };
        const updatedPoints = [...tempPoints, newPoint];
        setTempPoints(updatedPoints);

        const marker = createMarker(newPoint, "#3b82f6");
        setTempObjects((prev) => [...prev, marker]);

        if (updatedPoints.length === 2) {
          const [p1, p2] = updatedPoints;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          // Utiliser l'échelle effective (mm par pixel)
          const realDistance = (distance * effectiveScale).toFixed(1);

          const dimensionLine = new Line([p1.x, p1.y, p2.x, p2.y], {
            stroke: "#3b82f6",
            strokeWidth: 2,
            selectable: true,
            evented: true,
          });

          const arrowSize = 10;
          const angle = Math.atan2(dy, dx);

          const arrow1Path = `M ${p1.x} ${p1.y} 
                             L ${p1.x + arrowSize * Math.cos(angle + 2.8)} ${p1.y + arrowSize * Math.sin(angle + 2.8)} 
                             L ${p1.x + arrowSize * Math.cos(angle - 2.8)} ${p1.y + arrowSize * Math.sin(angle - 2.8)} Z`;
          const arrow1 = new Path(arrow1Path, {
            fill: "#3b82f6",
            stroke: "#3b82f6",
            strokeWidth: 1,
            selectable: true,
            evented: true,
          });

          const arrow2Path = `M ${p2.x} ${p2.y} 
                             L ${p2.x - arrowSize * Math.cos(angle + 2.8)} ${p2.y - arrowSize * Math.sin(angle + 2.8)} 
                             L ${p2.x - arrowSize * Math.cos(angle - 2.8)} ${p2.y - arrowSize * Math.sin(angle - 2.8)} Z`;
          const arrow2 = new Path(arrow2Path, {
            fill: "#3b82f6",
            stroke: "#3b82f6",
            strokeWidth: 1,
            selectable: true,
            evented: true,
          });

          const text = new Textbox(`${realDistance} mm`, {
            left: (p1.x + p2.x) / 2,
            top: (p1.y + p2.y) / 2 - 20,
            fill: "#3b82f6",
            fontSize: 16,
            fontWeight: "bold",
            backgroundColor: "white",
            padding: 4,
            textAlign: "center",
            originX: "center",
            originY: "center",
            selectable: true,
            evented: true,
          });

          const dimensionGroup = new Group([dimensionLine, arrow1, arrow2, text], {
            selectable: true,
            evented: true,
          });
          (dimensionGroup as any).isUserDrawn = true;
          fabricCanvas.add(dimensionGroup);

          cleanTempObjects();
          setTempPoints([]);
          saveState(fabricCanvas);
          fabricCanvas.renderAll();
          toast.success(`Cote ajoutée: ${realDistance} mm`);
        }
      });

      fabricCanvas.on("mouse:move", (e) => {
        if (!e.e || tempPoints.length !== 1) return;

        const canvasPoint = getCanvasPoint(fabricCanvas, e.e);
        const snappedPoint = snapPoint(canvasPoint, fabricCanvas); // 🔧 Passer fabricCanvas pour snapping vers courbes

        if (previewObject) {
          fabricCanvas.remove(previewObject);
        }

        const p1 = tempPoints[0];
        previewObject = new Line([p1.x, p1.y, snappedPoint.x, snappedPoint.y], {
          stroke: "#3b82f6",
          strokeWidth: 2,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          opacity: 0.5,
        });
        fabricCanvas.add(previewObject);
        fabricCanvas.renderAll();
      });
    }

    // === OUTILS STANDARDS ===
    if (["line", "rectangle", "circle", "ellipse"].includes(activeTool)) {
      fabricCanvas.on("mouse:down", (e) => {
        if (!e.e) return;

        // 🔧 BUG FIX #2 : Ignorer le bouton du milieu (pan)
        if (e.e instanceof MouseEvent && e.e.button === 1) return;

        const canvasPoint = getCanvasPoint(fabricCanvas, e.e);
        const snappedPoint = snapPoint(canvasPoint, fabricCanvas); // 🔧 Passer fabricCanvas pour snapping vers courbes
        isDrawing = true;
        startPoint = { x: snappedPoint.x, y: snappedPoint.y };

        if (activeTool === "line") {
          activeObject = new Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeLineCap: "round",
            selectable: true,
            evented: true,
            objectCaching: false,
            hasControls: false, // Pas de bounding box
            hasBorders: false, // Pas de bordure
            lockRotation: true,
            perPixelTargetFind: true, // Sélection précise sur le trait
          });
          (activeObject as any).isUserDrawn = true;
        } else if (activeTool === "rectangle") {
          activeObject = new Rect({
            left: startPoint.x,
            top: startPoint.y,
            width: 0,
            height: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: "transparent",
            selectable: true,
            evented: true,
            objectCaching: false,
          });
          (activeObject as any).isUserDrawn = true;
        } else if (activeTool === "circle") {
          activeObject = new Circle({
            left: startPoint.x,
            top: startPoint.y,
            radius: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: "transparent",
            originX: "center",
            originY: "center",
            selectable: true,
            evented: true,
            objectCaching: false,
          });
          (activeObject as any).isUserDrawn = true;
        } else if (activeTool === "ellipse") {
          activeObject = new Ellipse({
            left: startPoint.x,
            top: startPoint.y,
            rx: 0,
            ry: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: "transparent",
            selectable: true,
            evented: true,
            objectCaching: false,
          });
          (activeObject as any).isUserDrawn = true;
        }

        fabricCanvas.add(activeObject);
      });

      fabricCanvas.on("mouse:move", (e) => {
        if (!isDrawing || !startPoint || !e.e || !activeObject) return;

        const canvasPoint = getCanvasPoint(fabricCanvas, e.e);
        // Pas de snap pendant le tracé pour fluidité

        if (activeTool === "line") {
          activeObject.set({
            x2: canvasPoint.x,
            y2: canvasPoint.y,
          });
        } else if (activeTool === "rectangle") {
          const width = canvasPoint.x - startPoint.x;
          const height = canvasPoint.y - startPoint.y;
          activeObject.set({
            width: Math.abs(width),
            height: Math.abs(height),
            left: width > 0 ? startPoint.x : canvasPoint.x,
            top: height > 0 ? startPoint.y : canvasPoint.y,
          });
        } else if (activeTool === "circle") {
          const dx = canvasPoint.x - startPoint.x;
          const dy = canvasPoint.y - startPoint.y;
          const radius = Math.sqrt(dx * dx + dy * dy);
          activeObject.set({ radius: radius });
        } else if (activeTool === "ellipse") {
          const rx = Math.abs(canvasPoint.x - startPoint.x);
          const ry = Math.abs(canvasPoint.y - startPoint.y);
          activeObject.set({
            rx: rx,
            ry: ry,
            left: canvasPoint.x > startPoint.x ? startPoint.x : canvasPoint.x,
            top: canvasPoint.y > startPoint.y ? startPoint.y : canvasPoint.y,
          });
        }

        fabricCanvas.renderAll();
      });

      fabricCanvas.on("mouse:up", (e) => {
        if (isDrawing && activeObject) {
          // Appliquer le magnétisme uniquement au point final si activé
          if (activeTool === "line" && e.e) {
            const canvasPoint = getCanvasPoint(fabricCanvas, e.e);
            const snappedEnd = snapPoint(canvasPoint, fabricCanvas);
            activeObject.set({ x2: snappedEnd.x, y2: snappedEnd.y });
          }

          // S'assurer que l'objet est bien sélectionnable
          activeObject.setCoords();
          activeObject.set({
            selectable: true,
            evented: true,
          });
          fabricCanvas.renderAll();
          saveState(fabricCanvas);
        }
        isDrawing = false;
        startPoint = null;
        activeObject = null;
      });
    }

    // === OUTIL TEXTE ===
    if (activeTool === "text") {
      fabricCanvas.on("mouse:down", (e) => {
        if (!e.e) return;

        // 🔧 BUG FIX #2 : Ignorer le bouton du milieu (pan)
        if (e.e instanceof MouseEvent && e.e.button === 1) return;

        const canvasPoint = getCanvasPoint(fabricCanvas, e.e);
        const snappedPoint = snapPoint(canvasPoint, fabricCanvas); // 🔧 Passer fabricCanvas pour snapping vers courbes
        const text = new Textbox("Double-clic pour éditer", {
          left: snappedPoint.x,
          top: snappedPoint.y,
          fill: strokeColor,
          fontSize: 20,
          fontFamily: "Arial",
          selectable: true,
          evented: true,
        });
        (text as any).isUserDrawn = true;
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        text.enterEditing();
        saveState(fabricCanvas);
      });
    }

    return () => {
      // Nettoyer les event listeners du canvas HTML
      const canvasElement = fabricCanvas.getElement();
      canvasElement.removeEventListener("mousedown", handleMiddleButtonDown as any, true);
      canvasElement.removeEventListener("mousemove", handleMiddleButtonMove as any, true);
      canvasElement.removeEventListener("mouseup", handleMiddleButtonUp as any, true);

      fabricCanvas.off("mouse:down");
      fabricCanvas.off("mouse:move");
      fabricCanvas.off("mouse:up");
    };
  }, [
    activeTool,
    strokeColor,
    strokeWidth,
    fabricCanvas,
    tempPoints,
    snapPoint,
    saveState,
    scaleFactor,
    tempObjects,
    previewCurve,
  ]);

  const saveDrawings = () => {
    if (!fabricCanvas) return;
    const json = fabricCanvas.toJSON();
    onDrawingsChanged?.(json);
  };

  const handleClear = () => {
    if (!fabricCanvas) return;
    const backgroundImg = fabricCanvas.backgroundImage;
    const objects = fabricCanvas.getObjects();
    objects.forEach((obj) => {
      if (!gridLinesRef.current.includes(obj)) {
        fabricCanvas.remove(obj);
      }
    });
    if (backgroundImg) {
      fabricCanvas.backgroundImage = backgroundImg;
    }
    fabricCanvas.renderAll();
    saveState(fabricCanvas);
    toast.success("Dessins effacés");
  };

  const handleDeleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((obj) => {
        // Si c'est une courbe éditable, supprimer aussi ses poignées
        if ((obj as any).customType === "editableCurve") {
          (obj as unknown as EditableCurve).removeHandles(fabricCanvas);
          // 🔧 BUG FIX #1 : Nettoyer la ref si c'est la courbe active
          if (activeCurveRef.current === (obj as unknown as EditableCurve)) {
            activeCurveRef.current = null;
          }
        }
        fabricCanvas.remove(obj);
      });
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
      saveState(fabricCanvas);
      toast.success("Objet(s) supprimé(s)");
    }
  };

  const adjustForFullscreen = useCallback(() => {
    if (!fabricCanvas || !imgRef.current) return;

    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;

    // Adapter la taille du canvas à la fenêtre
    fabricCanvas.setWidth(containerWidth);
    fabricCanvas.setHeight(containerHeight);

    const bg = fabricCanvas.backgroundImage as FabricImage | null;
    if (bg && bg.width && bg.height) {
      const imgWidth = bg.width * (bg.scaleX || 1);
      const imgHeight = bg.height * (bg.scaleY || 1);

      const scale = Math.min(containerWidth / imgWidth, containerHeight / imgHeight);
      const offsetX = (containerWidth - imgWidth * scale) / 2;
      const offsetY = (containerHeight - imgHeight * scale) / 2;

      fabricCanvas.setViewportTransform([scale, 0, 0, scale, offsetX, offsetY]);
      setZoom(scale);
    } else {
      fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      setZoom(1);
    }

    createGrid(fabricCanvas, containerWidth, containerHeight);
    fabricCanvas.renderAll();
  }, [fabricCanvas, createGrid]);

  const handleZoomIn = () => {
    if (!fabricCanvas) return;
    const newZoom = Math.min(5, zoom + 0.25);
    setZoom(newZoom);
    const center = fabricCanvas.getCenter();
    fabricCanvas.zoomToPoint(new Point(center.left, center.top), newZoom);
    fabricCanvas.renderAll();
  };

  const handleZoomOut = () => {
    if (!fabricCanvas) return;
    const newZoom = Math.max(0.1, zoom - 0.25);
    setZoom(newZoom);
    const center = fabricCanvas.getCenter();
    fabricCanvas.zoomToPoint(new Point(center.left, center.top), newZoom);
    fabricCanvas.renderAll();
  };

  const handleResetView = () => {
    if (!fabricCanvas || !imgRef.current) return;
    setZoom(1);
    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    // Recentrer si on est en plein écran
    if (isFullscreen) {
      adjustForFullscreen();
      return;
    }

    fabricCanvas.renderAll();
  };

  const tools: Array<{
    id: string;
    icon: any;
    label: string;
    style?: React.CSSProperties;
    highlight?: boolean;
  }> = [
    { id: "pan", icon: Hand, label: "Déplacer la vue (H)" },
    { id: "select", icon: Move, label: "Sélection (V)" },
    { id: "line", icon: Minus, label: "Ligne (L)" },
    { id: "rectangle", icon: Square, label: "Rectangle (R)" },
    { id: "circle", icon: CircleIcon, label: "Cercle (C)" },
    {
      id: "ellipse",
      icon: CircleIcon,
      label: "Ellipse (E)",
      style: { transform: "scaleX(1.5)" },
    },
    { id: "polygon", icon: Pentagon, label: "Polygone (P)" },
    { id: "pencil", icon: Pencil, label: "Crayon libre (F)" },
    { id: "editableCurve", icon: Sparkles, label: "Courbe éditable ⭐ (NOUVEAU)", highlight: true },
    { id: "bezier", icon: Waves, label: "Courbe de Bézier (4 pts)" },
    { id: "spline", icon: Workflow, label: "Spline (4+ pts)" },
    { id: "dimension", icon: Ruler, label: "Cote (D)" },
    { id: "text", icon: Type, label: "Texte (T)" },
  ];

  const getToolInstructions = () => {
    switch (activeTool) {
      case "editableCurve":
        return "⭐ NOUVEAU : Cliquez 3 fois (1ère extrémité → 2ème extrémité → courbure). La courbe s'ajuste en temps réel ! Sélectionnez-la après pour modifier les poignées.";
      case "bezier":
        return "Cliquez 4 points : début → contrôle 1 → contrôle 2 → fin";
      case "spline":
        return "Cliquez pour ajouter des points (min 3). Double-cliquez pour terminer";
      case "polygon":
        return "Cliquez pour ajouter des sommets (min 3). Double-cliquez pour fermer";
      case "dimension":
        return "Cliquez 2 points pour créer une cote avec la distance réelle";
      case "text":
        return "Cliquez pour placer du texte";
      default:
        return null;
    }
  };

  const instructions = getToolInstructions();

  return (
    <div className={`${isFullscreen ? "fixed inset-0 z-50 bg-background" : "space-y-4"}`}>
      {!isFullscreen && instructions && (
        <Alert className={activeTool === "editableCurve" ? "border-blue-500 bg-blue-50" : ""}>
          <Info className="h-4 w-4" />
          <AlertDescription className="font-medium">{instructions}</AlertDescription>
        </Alert>
      )}

      {tempPoints.length > 0 && (
        <div className={`flex items-center gap-2 ${isFullscreen ? "fixed top-4 left-4 z-[60]" : ""}`}>
          <Badge variant="secondary" className="animate-pulse">
            {activeTool === "editableCurve"
              ? `Courbe éditable: ${tempPoints.length}/3 points`
              : activeTool === "bezier"
                ? `Bézier: ${tempPoints.length}/4 points`
                : activeTool === "spline"
                  ? `Spline: ${tempPoints.length} points`
                  : activeTool === "polygon"
                    ? `Polygone: ${tempPoints.length} sommets`
                    : activeTool === "dimension"
                      ? `Cote: ${tempPoints.length}/2 points`
                      : ""}
          </Badge>
          <span className="text-sm text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Appuyez sur <kbd className="px-2 py-1 bg-muted rounded">Échap</kbd> pour annuler
          </span>
        </div>
      )}

      {/* Toolbar - draggable en mode plein écran */}
      {isFullscreen ? (
        <Draggable handle=".drag-handle" defaultPosition={{ x: 20, y: 20 }}>
          <div className="fixed z-[60] bg-background/95 backdrop-blur-sm rounded-lg shadow-2xl border-2 border-border max-w-[350px]">
            <div className="drag-handle cursor-move bg-muted/50 p-2 rounded-t-lg border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs font-medium ml-2">Outils de Dessin</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (fabricCanvas && previousCanvasSizeRef.current) {
                    const { width, height, viewportTransform } = previousCanvasSizeRef.current;
                    fabricCanvas.setWidth(width);
                    fabricCanvas.setHeight(height);
                    fabricCanvas.setViewportTransform((viewportTransform || [1, 0, 0, 1, 0, 0]) as any);
                    createGrid(fabricCanvas, width, height);
                    fabricCanvas.renderAll();
                    setZoom(1);
                  }
                  setIsFullscreen(false);
                }}
                className="h-6 w-6 p-0"
              >
                <Minimize className="h-3 w-3" />
              </Button>
            </div>
            <div className="p-3 space-y-3 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-4 gap-1">
                {tools.map((tool) => (
                  <Button
                    key={tool.id}
                    variant={activeTool === tool.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setActiveTool(tool.id as any);
                      setTempPoints([]);
                      setTempObjects([]);
                    }}
                    title={tool.label}
                    className={`h-9 w-9 p-0 ${tool.highlight ? "ring-2 ring-blue-500" : ""}`}
                  >
                    <tool.icon className="h-4 w-4" style={tool.style} />
                  </Button>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Couleur</Label>
                  <Input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                    className="w-16 h-7"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Épaisseur: {strokeWidth}px</Label>
                  <Slider
                    value={[strokeWidth]}
                    onValueChange={([value]) => setStrokeWidth(value)}
                    min={1}
                    max={20}
                    step={1}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Zoom: {Math.round(zoom * 100)}%</Label>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={handleZoomOut} className="h-7 w-7 p-0">
                      <ZoomOut className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleZoomIn} className="h-7 w-7 p-0">
                      <ZoomIn className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleResetView} className="h-7 w-7 p-0">
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Grid3x3 className="h-3 w-3 text-muted-foreground" />
                    <Label className="text-xs">Grille</Label>
                  </div>
                  <Switch checked={showGrid} onCheckedChange={setShowGrid} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Magnet className="h-3 w-3 text-muted-foreground" />
                    <Label className="text-xs">Aimanter</Label>
                  </div>
                  <Switch checked={snapToGrid} onCheckedChange={setSnapToGrid} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ruler className="h-3 w-3 text-muted-foreground" />
                    <Label className="text-xs">Règles</Label>
                  </div>
                  <Switch checked={showRulers} onCheckedChange={setShowRulers} />
                </div>

                {showRulers && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Case =</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="1"
                          max="500"
                          value={scaleValuePerCell}
                          onChange={(e) => setScaleValuePerCell(parseInt(e.target.value) || 10)}
                          className="w-14 h-7 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">mm</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Grille:</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="10"
                          max="100"
                          value={gridSizePx}
                          onChange={(e) => setGridSizePx(parseInt(e.target.value) || 35)}
                          className="w-14 h-7 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">px</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => {
                        // Réinitialiser à l'échelle calibrée
                        const realValue = gridSizePx / scaleFactor;
                        if (realValue <= 5) setScaleValuePerCell(5);
                        else if (realValue <= 10) setScaleValuePerCell(10);
                        else if (realValue <= 20) setScaleValuePerCell(20);
                        else if (realValue <= 50) setScaleValuePerCell(50);
                        else if (realValue <= 100) setScaleValuePerCell(100);
                        else setScaleValuePerCell(Math.round(realValue / 50) * 50);
                        toast.success("Échelle recalibrée");
                      }}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Recalibrer
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex flex-col gap-1">
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="flex-1 h-8"
                  >
                    <Undo className="h-3 w-3 mr-1" />
                    Annuler
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="flex-1 h-8"
                  >
                    <Redo className="h-3 w-3 mr-1" />
                    Refaire
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-1">
                <Button variant="outline" size="sm" onClick={handleDeleteSelected} className="h-8">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Supprimer
                </Button>
                <Button variant="outline" size="sm" onClick={handleClear} className="h-8">
                  Effacer tout
                </Button>
              </div>
            </div>
          </div>
        </Draggable>
      ) : (
        <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/95 backdrop-blur-sm rounded-lg">
          <div className="flex flex-wrap gap-1">
            {tools.map((tool) => (
              <Button
                key={tool.id}
                variant={activeTool === tool.id ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setActiveTool(tool.id as any);
                  setTempPoints([]);
                  setTempObjects([]);
                }}
                title={tool.label}
                className={tool.highlight ? "ring-2 ring-blue-500 animate-pulse" : ""}
              >
                <tool.icon className="h-4 w-4" style={tool.style} />
                {tool.highlight && <span className="ml-1">⭐</span>}
              </Button>
            ))}
          </div>

          <Separator orientation="vertical" className="h-8" />

          {/* 🔧 BUG FIX #4 : Ajouter les contrôles de grille en mode normal */}
          <div className="flex items-center gap-2">
            <Grid3x3 className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">Grille:</Label>
            <Switch checked={showGrid} onCheckedChange={setShowGrid} />
          </div>

          <div className="flex items-center gap-2">
            <Magnet className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">Aimanter:</Label>
            <Switch checked={snapToGrid} onCheckedChange={setSnapToGrid} />
          </div>

          <Separator orientation="vertical" className="h-8" />

          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">Règles:</Label>
            <Switch checked={showRulers} onCheckedChange={setShowRulers} />
          </div>

          {showRulers && (
            <>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Case =</Label>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  value={scaleValuePerCell}
                  onChange={(e) => setScaleValuePerCell(parseInt(e.target.value) || 10)}
                  className="w-16 h-8"
                />
                <span className="text-sm text-muted-foreground">mm</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Grille:</Label>
                <Input
                  type="number"
                  min="10"
                  max="100"
                  value={gridSizePx}
                  onChange={(e) => setGridSizePx(parseInt(e.target.value) || 35)}
                  className="w-16 h-8"
                />
                <span className="text-sm text-muted-foreground">px</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const realValue = gridSizePx / scaleFactor;
                  if (realValue <= 5) setScaleValuePerCell(5);
                  else if (realValue <= 10) setScaleValuePerCell(10);
                  else if (realValue <= 20) setScaleValuePerCell(20);
                  else if (realValue <= 50) setScaleValuePerCell(50);
                  else if (realValue <= 100) setScaleValuePerCell(100);
                  else setScaleValuePerCell(Math.round(realValue / 50) * 50);
                  toast.success("Échelle recalibrée");
                }}
                title="Recalibrer à l'échelle de l'image"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </>
          )}

          <Separator orientation="vertical" className="h-8" />

          <div className="flex items-center gap-2">
            <Label className="text-sm">Couleur:</Label>
            <Input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              className="w-16 h-8"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm">Épaisseur:</Label>
            <div className="w-32">
              <Slider
                value={[strokeWidth]}
                onValueChange={([value]) => setStrokeWidth(value)}
                min={1}
                max={20}
                step={1}
              />
            </div>
            <Badge variant="outline">{strokeWidth}px</Badge>
          </div>

          <Separator orientation="vertical" className="h-8" />

          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={handleZoomOut} title="Zoom arrière (-)">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="px-3">
              {Math.round(zoom * 100)}%
            </Badge>
            <Button variant="outline" size="sm" onClick={handleZoomIn} title="Zoom avant (+)">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleResetView} title="Réinitialiser la vue">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-8" />

          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Annuler (Ctrl+Z)"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Refaire (Ctrl+Y)"
            >
              <Redo className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-8" />

          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={handleDeleteSelected} title="Supprimer (Suppr)">
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear}>
              Effacer tout
            </Button>
          </div>

          <Separator orientation="vertical" className="h-8" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (fabricCanvas) {
                previousCanvasSizeRef.current = {
                  width: fabricCanvas.getWidth() || 0,
                  height: fabricCanvas.getHeight() || 0,
                  viewportTransform: fabricCanvas.viewportTransform
                    ? [...fabricCanvas.viewportTransform]
                    : [1, 0, 0, 1, 0, 0],
                };
              }

              setIsFullscreen(true);
              // Ajuster l'image après un délai pour que le DOM se mette à jour
              setTimeout(() => {
                adjustForFullscreen();
              }, 150);
            }}
            title="Mode plein écran"
          >
            <Maximize className="h-4 w-4 mr-2" />
            Plein écran
          </Button>
        </div>
      )}

      {/* Canvas - unique, style adapté selon le mode */}
      <div
        className={
          isFullscreen
            ? "h-screen w-screen flex items-center justify-center overflow-hidden"
            : "border rounded-lg bg-white shadow-lg flex items-center justify-center overflow-auto"
        }
        style={isFullscreen ? {} : { height: "calc(100vh - 350px)", minHeight: "500px", maxHeight: "900px" }}
      >
        <canvas ref={canvasRef} className={isFullscreen ? "max-w-full max-h-full" : ""} />
      </div>

      {!isFullscreen && (
        <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
          <p>
            <strong>Échelle:</strong> 1 pixel = {effectiveScale.toFixed(3)} mm •{" "}
            <strong className="ml-2">Résolution:</strong> {(1 / effectiveScale).toFixed(2)} pixels/mm •
            <strong className="ml-2">Historique:</strong> {historyIndex + 1}/{history.length} états
          </p>
          <p className="mt-1 text-blue-600 font-medium">
            💡 Astuce : Utilisez la "Courbe éditable" pour ajuster vos courbes en temps réel ! Maintenez le bouton du
            milieu (molette) pour déplacer la vue, ou utilisez la molette pour zoomer.
          </p>
        </div>
      )}
    </div>
  );
}
