import { useEffect, useRef, useState, useCallback } from "react";
import Draggable from "react-draggable";
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

  constructor(start: Point, control: Point, end: Point, options: any = {}) {
    const pathData = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
    super(pathData, {
      ...options,
      objectCaching: false,
    });

    this.controlPoints = { start, control, end };
    this.controlHandles = [];
    this.controlLines = [];

    // Type personnalisé pour identifier cette courbe
    this.set("customType", "editableCurve");
  }

  // 🔧 BUG FIX #3 : Réduire la taille des poignées (3px au lieu de 6-8px)
  createHandles(canvas: FabricCanvas, color: string = "#3b82f6") {
    // Nettoyer les anciennes poignées
    this.removeHandles(canvas);

    // Lignes de contrôle (pointillées)
    const line1 = new Line(
      [
        this.controlPoints.start.x,
        this.controlPoints.start.y,
        this.controlPoints.control.x,
        this.controlPoints.control.y,
      ],
      {
        stroke: color,
        strokeWidth: 1,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        opacity: 0.7,
      },
    );

    const line2 = new Line(
      [this.controlPoints.control.x, this.controlPoints.control.y, this.controlPoints.end.x, this.controlPoints.end.y],
      {
        stroke: color,
        strokeWidth: 1,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        opacity: 0.7,
      },
    );

    this.controlLines = [line1, line2];

    // 🔧 BUG FIX #3 : Poignées réduites à 3-4px
    const handleStart = new Circle({
      left: this.controlPoints.start.x,
      top: this.controlPoints.start.y,
      radius: 3, // ✅ Réduit de 6 à 3
      fill: "#ffffff",
      stroke: color,
      strokeWidth: 2,
      originX: "center",
      originY: "center",
      hasBorders: false,
      hasControls: false,
    });
    (handleStart as any).curvePointType = "start";
    (handleStart as any).parentCurve = this;

    const handleControl = new Circle({
      left: this.controlPoints.control.x,
      top: this.controlPoints.control.y,
      radius: 4, // ✅ Réduit de 8 à 4
      fill: color,
      stroke: "#ffffff",
      strokeWidth: 2,
      originX: "center",
      originY: "center",
      hasBorders: false,
      hasControls: false,
    });
    (handleControl as any).curvePointType = "control";
    (handleControl as any).parentCurve = this;

    const handleEnd = new Circle({
      left: this.controlPoints.end.x,
      top: this.controlPoints.end.y,
      radius: 3, // ✅ Réduit de 6 à 3
      fill: "#ffffff",
      stroke: color,
      strokeWidth: 2,
      originX: "center",
      originY: "center",
      hasBorders: false,
      hasControls: false,
    });
    (handleEnd as any).curvePointType = "end";
    (handleEnd as any).parentCurve = this;

    this.controlHandles = [handleStart, handleControl, handleEnd];

    // Ajouter au canvas
    this.controlLines.forEach((line) => canvas.add(line));
    this.controlHandles.forEach((handle) => canvas.add(handle));

    // Event handlers pour déplacer les poignées
    this.controlHandles.forEach((handle) => {
      handle.on("moving", () => {
        this.updateCurveFromHandle(handle as Circle, canvas);
      });
    });

    canvas.renderAll();
  }

  // Mettre à jour la courbe quand une poignée bouge
  updateCurveFromHandle(handle: Circle, canvas: FabricCanvas) {
    const pointType = (handle as any).curvePointType;
    const newX = handle.left!;
    const newY = handle.top!;

    if (pointType === "start") {
      this.controlPoints.start = new Point(newX, newY);
    } else if (pointType === "control") {
      this.controlPoints.control = new Point(newX, newY);
    } else if (pointType === "end") {
      this.controlPoints.end = new Point(newX, newY);
    }

    // Recalculer le path
    const newPathData = `M ${this.controlPoints.start.x} ${this.controlPoints.start.y} Q ${this.controlPoints.control.x} ${this.controlPoints.control.y} ${this.controlPoints.end.x} ${this.controlPoints.end.y}`;
    this.set("path", (new Path(newPathData) as any).path);

    // Mettre à jour les lignes de contrôle
    if (this.controlLines[0]) {
      this.controlLines[0].set({
        x1: this.controlPoints.start.x,
        y1: this.controlPoints.start.y,
        x2: this.controlPoints.control.x,
        y2: this.controlPoints.control.y,
      });
    }
    if (this.controlLines[1]) {
      this.controlLines[1].set({
        x1: this.controlPoints.control.x,
        y1: this.controlPoints.control.y,
        x2: this.controlPoints.end.x,
        y2: this.controlPoints.end.y,
      });
    }

    canvas.renderAll();
  }

  // Supprimer les poignées
  removeHandles(canvas: FabricCanvas) {
    this.controlLines.forEach((line) => canvas.remove(line));
    this.controlHandles.forEach((handle) => canvas.remove(handle));
    this.controlLines = [];
    this.controlHandles = [];
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
  const [gridSize, setGridSize] = useState(50);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const gridLinesRef = useRef<any[]>([]);
  const activeCurveRef = useRef<EditableCurve | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const previousCanvasSizeRef = useRef<{
    width: number;
    height: number;
    viewportTransform: number[] | null;
  } | null>(null);

  // 🔧 BUG FIX #2 : États pour l'édition des propriétés de l'objet sélectionné
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [selectedStrokeWidth, setSelectedStrokeWidth] = useState(2);
  const [selectedStrokeColor, setSelectedStrokeColor] = useState("#ef4444");

  // Fonction pour obtenir les coordonnées correctes du canvas en tenant compte du zoom/pan
  const getCanvasPoint = useCallback((canvas: FabricCanvas, e: any): { x: number; y: number } => {
    if (!canvas) return { x: 0, y: 0 };

    // Obtenir la position de la souris par rapport au canvas
    const pointer = canvas.getPointer(e);
    return { x: pointer.x, y: pointer.y };
  }, []);

  // Fonction snap to grid
  const snapPoint = useCallback(
    (point: { x: number; y: number }) => {
      if (!snapToGrid) return point;
      return {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize,
      };
    },
    [snapToGrid, gridSize],
  );

  // Créer la grille limitée à l'image
  const createGrid = useCallback(
    (canvas: FabricCanvas, width: number, height: number) => {
      gridLinesRef.current.forEach((line) => canvas.remove(line));
      gridLinesRef.current = [];

      if (!showGrid) return;

      const gridColor = "#e0e0e0";
      const gridStrokeWidth = 0.5;

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
          });
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
          });
          canvas.add(line);
          canvas.sendObjectToBack(line);
          gridLinesRef.current.push(line);
        }
      }
    },
    [showGrid, gridSize],
  );

  // Fonction pour nettoyer COMPLÈTEMENT tous les objets temporaires
  const cleanAllTempObjects = useCallback(() => {
    if (!fabricCanvas) return;

    // Supprimer tous les objets temporaires (cercles, lignes, courbes preview)
    tempObjects.forEach((obj) => {
      fabricCanvas.remove(obj);
    });
    setTempObjects([]);
    setTempPoints([]);

    // Supprimer les lignes en pointillés qui peuvent traîner
    fabricCanvas.getObjects().forEach((obj) => {
      if (obj instanceof Line && (obj as any).strokeDashArray && !gridLinesRef.current.includes(obj)) {
        fabricCanvas.remove(obj);
      }
    });

    // Supprimer la preview curve si elle existe
    if (previewCurve) {
      fabricCanvas.remove(previewCurve);
      setPreviewCurve(null);
    }

    fabricCanvas.renderAll();
  }, [fabricCanvas, tempObjects, previewCurve]);

  // Sauvegarder l'état pour l'historique
  const saveState = useCallback(
    (canvas: FabricCanvas) => {
      const objects = canvas.getObjects().filter((obj) => {
        // Exclure la grille, les poignées de contrôle et les lignes de contrôle
        if (gridLinesRef.current.includes(obj)) return false;
        if ((obj as any).curvePointType) return false; // Poignées
        if (obj instanceof Line && (obj as any).strokeDashArray && !gridLinesRef.current.includes(obj)) return false; // Lignes de contrôle
        return true;
      });

      const state: HistoryState = {
        objects: objects.map((obj) => obj.toObject()),
      };

      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(state);
        return newHistory;
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex],
  );

  // Undo
  const handleUndo = useCallback(() => {
    if (!fabricCanvas || historyIndex <= 0) return;

    const newIndex = historyIndex - 1;
    const state = history[newIndex];

    fabricCanvas.clear();
    fabricCanvas.backgroundImage = imgRef.current
      ? new FabricImage(imgRef.current, {
          scaleX: fabricCanvas.width! / imgRef.current.width,
          scaleY: fabricCanvas.height! / imgRef.current.height,
          selectable: false,
          evented: false,
        })
      : undefined;

    util.enlivenObjects(state.objects).then((objs: any[]) => {
      objs.forEach((obj: any) => {
        fabricCanvas.add(obj);
      });
    });

    createGrid(fabricCanvas, fabricCanvas.width || 1000, fabricCanvas.height || 700);
    setHistoryIndex(newIndex);
    fabricCanvas.renderAll();
    toast.success("Annulation effectuée");
  }, [fabricCanvas, history, historyIndex, createGrid]);

  // Redo
  const handleRedo = useCallback(() => {
    if (!fabricCanvas || historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    const state = history[newIndex];

    fabricCanvas.clear();
    fabricCanvas.backgroundImage = imgRef.current
      ? new FabricImage(imgRef.current, {
          scaleX: fabricCanvas.width! / imgRef.current.width,
          scaleY: fabricCanvas.height! / imgRef.current.height,
          selectable: false,
          evented: false,
        })
      : undefined;

    util.enlivenObjects(state.objects).then((objs: any[]) => {
      objs.forEach((obj: any) => {
        fabricCanvas.add(obj);
      });
    });

    createGrid(fabricCanvas, fabricCanvas.width || 1000, fabricCanvas.height || 700);
    setHistoryIndex(newIndex);
    fabricCanvas.renderAll();
    toast.success("Rétablissement effectué");
  }, [fabricCanvas, history, historyIndex, createGrid]);

  // Nettoyer les objets temporaires quand on change d'outil
  useEffect(() => {
    if (!fabricCanvas) return;

    // Nettoyer tous les objets temporaires
    tempObjects.forEach((obj) => fabricCanvas.remove(obj));
    setTempObjects([]);
    setTempPoints([]);

    // Supprimer les lignes en pointillés qui traînent
    fabricCanvas.getObjects().forEach((obj) => {
      if (obj instanceof Line && (obj as any).strokeDashArray && !gridLinesRef.current.includes(obj)) {
        fabricCanvas.remove(obj);
      }
    });

    if (previewCurve) {
      fabricCanvas.remove(previewCurve);
      setPreviewCurve(null);
    }

    fabricCanvas.renderAll();
  }, [activeTool, fabricCanvas]);

  // Initialisation du canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 1000,
      height: 700,
      backgroundColor: "#ffffff",
    });

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;

      const maxWidth = 1000;
      const maxHeight = 700;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);

      const finalWidth = img.width * scale;
      const finalHeight = img.height * scale;

      // S'assurer que les dimensions sont valides
      if (finalWidth > 0 && finalHeight > 0 && isFinite(finalWidth) && isFinite(finalHeight)) {
        canvas.setDimensions({ width: finalWidth, height: finalHeight });
      }

      FabricImage.fromURL(imageUrl).then((fabricImg) => {
        fabricImg.set({
          scaleX: scale,
          scaleY: scale,
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
    createGrid(fabricCanvas, fabricCanvas.width || 1000, fabricCanvas.height || 700);
  }, [showGrid, gridSize, fabricCanvas, createGrid]);

  // 🔧 BUG FIX #2 : Gérer la sélection d'objets pour permettre l'édition
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleSelection = (e: any) => {
      const selected = e.selected?.[0];

      // Cacher les poignées de la courbe précédente
      if (activeCurveRef.current && activeCurveRef.current !== selected) {
        activeCurveRef.current.removeHandles(fabricCanvas);
        activeCurveRef.current = null;
      }

      // Si c'est une courbe éditable, montrer les poignées
      if (selected && (selected as any).customType === "editableCurve") {
        const curve = selected as EditableCurve;
        curve.createHandles(fabricCanvas, selected.stroke || strokeColor);
        activeCurveRef.current = curve;
      }

      // 🔧 BUG FIX #2 : Sauvegarder l'objet sélectionné et ses propriétés
      if (selected) {
        setSelectedObject(selected);
        setSelectedStrokeWidth(selected.strokeWidth || 2);
        setSelectedStrokeColor(selected.stroke || "#ef4444");
      } else {
        setSelectedObject(null);
      }
    };

    const handleDeselection = () => {
      // 🔧 BUG FIX #1 : Nettoyer la ref activeCurveRef lors de la désélection
      if (activeCurveRef.current) {
        activeCurveRef.current.removeHandles(fabricCanvas);
        activeCurveRef.current = null;
      }
      setSelectedObject(null);
    };

    fabricCanvas.on("selection:created", handleSelection);
    fabricCanvas.on("selection:updated", handleSelection);
    fabricCanvas.on("selection:cleared", handleDeselection);

    return () => {
      fabricCanvas.off("selection:created", handleSelection);
      fabricCanvas.off("selection:updated", handleSelection);
      fabricCanvas.off("selection:cleared", handleDeselection);
    };
  }, [fabricCanvas, strokeColor]);

  // 🔧 BUG FIX #2 : Fonction pour appliquer les modifications aux objets sélectionnés
  const applyStrokeToSelected = useCallback(() => {
    if (!fabricCanvas || !selectedObject) return;

    selectedObject.set({
      stroke: selectedStrokeColor,
      strokeWidth: selectedStrokeWidth,
    });

    // Si c'est une courbe éditable, mettre à jour les poignées
    if ((selectedObject as any).customType === "editableCurve" && activeCurveRef.current) {
      activeCurveRef.current.removeHandles(fabricCanvas);
      activeCurveRef.current.createHandles(fabricCanvas, selectedStrokeColor);
    }

    fabricCanvas.renderAll();
    saveState(fabricCanvas);
    toast.success("Propriétés modifiées !");
  }, [fabricCanvas, selectedObject, selectedStrokeColor, selectedStrokeWidth, saveState]);

  // Gérer les outils
  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = activeTool === "pencil";
    fabricCanvas.selection = activeTool === "select";

    if (activeTool === "pencil" && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = strokeColor;
      fabricCanvas.freeDrawingBrush.width = strokeWidth;
    }

    fabricCanvas.off("mouse:down");
    fabricCanvas.off("mouse:move");
    fabricCanvas.off("mouse:up");
    fabricCanvas.off("mouse:wheel");

    // 🔧 BUG FIX #4 : Améliorer la gestion du pan avec la molette
    let isPanningWithMiddleButton = false;
    let lastPanPos: { x: number; y: number } | null = null;

    // Handler pour le bouton du milieu (AVANT les autres outils)
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
        return false; // ✅ Empêcher la propagation
      }
    };

    const handleMiddleButtonMove = (opt: any) => {
      const evt = opt.e;
      if (isPanningWithMiddleButton && lastPanPos && evt instanceof MouseEvent) {
        const vpt = fabricCanvas.viewportTransform;
        if (vpt) {
          vpt[4] += evt.clientX - lastPanPos.x;
          vpt[5] += evt.clientY - lastPanPos.y;
          fabricCanvas.requestRenderAll();
          lastPanPos = { x: evt.clientX, y: evt.clientY };
        }
        evt.preventDefault();
        evt.stopPropagation();
        return false; // ✅ Empêcher la propagation
      }
    };

    const handleMiddleButtonUp = (opt: any) => {
      const evt = opt.e;
      if (evt instanceof MouseEvent && evt.button === 1) {
        isPanningWithMiddleButton = false;
        fabricCanvas.selection = activeTool === "select";
        fabricCanvas.defaultCursor = "default";
        lastPanPos = null;
        evt.preventDefault();
        evt.stopPropagation();
        return false; // ✅ Empêcher la propagation
      }
    };

    // ✅ Enregistrer les handlers en premier (priorité au pan avec molette)
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
    });

    // Gestion du pan (déplacement)
    if (activeTool === "pan") {
      let isPanning = false;
      let lastPos: { x: number; y: number } | null = null;

      fabricCanvas.on("mouse:down", (opt) => {
        const evt = opt.e;
        // ✅ Ignorer si c'est le bouton du milieu (déjà géré)
        if (evt instanceof MouseEvent && evt.button === 1) return;

        isPanning = true;
        fabricCanvas.selection = false;
        const clientX = evt instanceof MouseEvent ? evt.clientX : evt.touches?.[0]?.clientX || 0;
        const clientY = evt instanceof MouseEvent ? evt.clientY : evt.touches?.[0]?.clientY || 0;
        lastPos = { x: clientX, y: clientY };
      });

      fabricCanvas.on("mouse:move", (opt) => {
        const evt = opt.e;
        if (isPanning && lastPos) {
          const vpt = fabricCanvas.viewportTransform;
          if (vpt) {
            const clientX = evt instanceof MouseEvent ? evt.clientX : evt.touches?.[0]?.clientX || 0;
            const clientY = evt instanceof MouseEvent ? evt.clientY : evt.touches?.[0]?.clientY || 0;
            vpt[4] += clientX - lastPos.x;
            vpt[5] += clientY - lastPos.y;
            fabricCanvas.requestRenderAll();
            lastPos = { x: clientX, y: clientY };
          }
        }
      });

      fabricCanvas.on("mouse:up", () => {
        isPanning = false;
        fabricCanvas.selection = true;
        lastPos = null;
      });
    }

    // === OUTILS DE DESSIN STANDARD ===
    if (activeTool === "line" || activeTool === "rectangle" || activeTool === "circle" || activeTool === "ellipse") {
      let isDrawing = false;
      let startPoint: { x: number; y: number } | null = null;
      let currentShape: any = null;

      fabricCanvas.on("mouse:down", (opt) => {
        const evt = opt.e;
        // ✅ Ignorer si c'est le bouton du milieu
        if (evt instanceof MouseEvent && evt.button === 1) return;

        isDrawing = true;
        const canvasPoint = getCanvasPoint(fabricCanvas, evt);
        const snappedPoint = snapPoint(canvasPoint);
        startPoint = { x: snappedPoint.x, y: snappedPoint.y };
      });

      fabricCanvas.on("mouse:move", (opt) => {
        if (!isDrawing || !startPoint) return;

        const evt = opt.e;
        const canvasPoint = getCanvasPoint(fabricCanvas, evt);
        const snappedPoint = snapPoint(canvasPoint);

        if (currentShape) {
          fabricCanvas.remove(currentShape);
        }

        if (activeTool === "line") {
          currentShape = new Line([startPoint.x, startPoint.y, snappedPoint.x, snappedPoint.y], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
          });
        } else if (activeTool === "rectangle") {
          const width = snappedPoint.x - startPoint.x;
          const height = snappedPoint.y - startPoint.y;
          currentShape = new Rect({
            left: startPoint.x,
            top: startPoint.y,
            width: Math.abs(width),
            height: Math.abs(height),
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: "transparent",
          });
          if (width < 0) currentShape.set({ left: snappedPoint.x });
          if (height < 0) currentShape.set({ top: snappedPoint.y });
        } else if (activeTool === "circle" || activeTool === "ellipse") {
          const radiusX = Math.abs(snappedPoint.x - startPoint.x) / 2;
          const radiusY = Math.abs(snappedPoint.y - startPoint.y) / 2;

          if (activeTool === "circle") {
            const radius = Math.max(radiusX, radiusY);
            currentShape = new Circle({
              left: startPoint.x,
              top: startPoint.y,
              radius: radius,
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              fill: "transparent",
              originX: "center",
              originY: "center",
            });
          } else {
            currentShape = new Ellipse({
              left: startPoint.x,
              top: startPoint.y,
              rx: radiusX,
              ry: radiusY,
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              fill: "transparent",
              originX: "center",
              originY: "center",
            });
          }
        }

        if (currentShape) {
          fabricCanvas.add(currentShape);
          fabricCanvas.renderAll();
        }
      });

      fabricCanvas.on("mouse:up", () => {
        isDrawing = false;
        startPoint = null;
        if (currentShape) {
          saveState(fabricCanvas);
          currentShape = null;
        }
      });
    }

    // === TEXTE ===
    if (activeTool === "text") {
      fabricCanvas.on("mouse:down", (opt) => {
        const evt = opt.e;
        // ✅ Ignorer si c'est le bouton du milieu
        if (evt instanceof MouseEvent && evt.button === 1) return;

        const canvasPoint = getCanvasPoint(fabricCanvas, evt);
        const snappedPoint = snapPoint(canvasPoint);

        const textbox = new Textbox("Texte", {
          left: snappedPoint.x,
          top: snappedPoint.y,
          fontSize: 20,
          fill: strokeColor,
          width: 200,
        });
        fabricCanvas.add(textbox);
        fabricCanvas.setActiveObject(textbox);
        textbox.enterEditing();
        saveState(fabricCanvas);
      });
    }

    // === COTE (DIMENSION) ===
    if (activeTool === "dimension") {
      let dimensionPoints: { x: number; y: number }[] = [];

      fabricCanvas.on("mouse:down", (opt) => {
        const evt = opt.e;
        // ✅ Ignorer si c'est le bouton du milieu
        if (evt instanceof MouseEvent && evt.button === 1) return;

        const canvasPoint = getCanvasPoint(fabricCanvas, evt);
        const snappedPoint = snapPoint(canvasPoint);

        dimensionPoints.push(snappedPoint);

        if (dimensionPoints.length === 2) {
          const [p1, p2] = dimensionPoints;
          const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
          const realDistance = (distance * scaleFactor).toFixed(1);

          const line = new Line([p1.x, p1.y, p2.x, p2.y], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
          });

          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;

          const label = new Textbox(`${realDistance} mm`, {
            left: midX,
            top: midY - 15,
            fontSize: 14,
            fill: strokeColor,
            backgroundColor: "white",
            textAlign: "center",
            width: 100,
          });

          fabricCanvas.add(line);
          fabricCanvas.add(label);
          fabricCanvas.renderAll();
          saveState(fabricCanvas);

          dimensionPoints = [];
          toast.success(`Cote créée: ${realDistance} mm`);
        }
      });
    }

    // === OUTIL COURBE ÉDITABLE ===
    if (activeTool === "editableCurve") {
      // Fonction helper pour créer un marqueur bleu
      const createMarker = (point: { x: number; y: number }) => {
        return new Circle({
          left: point.x,
          top: point.y,
          radius: 3, // ✅ Réduit à 3px
          fill: "#3b82f6",
          stroke: "#ffffff",
          strokeWidth: 2,
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
        });
      };

      // Flag pour éviter la création multiple pendant la finalisation
      let isFinalizingCurve = false;

      fabricCanvas.on("mouse:down", (e) => {
        if (!e.e || isFinalizingCurve) return;

        const canvasPoint = getCanvasPoint(fabricCanvas, e.e);
        // 🔧 BUG FIX #5 : Appliquer le magnétisme aux courbes
        const snappedPoint = snapPoint(canvasPoint);
        const newPoint = { x: snappedPoint.x, y: snappedPoint.y };

        const updatedPoints = [...tempPoints, newPoint];
        setTempPoints(updatedPoints);

        const marker = createMarker(newPoint);
        fabricCanvas.add(marker);
        setTempObjects((prev) => [...prev, marker]);

        if (updatedPoints.length === 3) {
          // Finaliser la courbe
          isFinalizingCurve = true;

          const [start, end, control] = updatedPoints;

          // Nettoyer TOUT avant de créer la courbe finale
          fabricCanvas.getObjects().forEach((obj) => {
            if (obj instanceof Circle && (obj as any).fill === "#3b82f6") {
              fabricCanvas.remove(obj);
            }
            if (obj instanceof Line && (obj as any).strokeDashArray) {
              fabricCanvas.remove(obj);
            }
          });

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

          fabricCanvas.add(finalCurve);
          finalCurve.createHandles(fabricCanvas, strokeColor);

          // RÉINITIALISER COMPLÈTEMENT les états
          setTempObjects([]);
          setTempPoints([]);
          saveState(fabricCanvas);

          // Passer en mode sélection pour éviter de recréer immédiatement
          setActiveTool("select");

          toast.success("Courbe créée ! Mode sélection activé.");

          // Réinitialiser le flag après un court délai
          setTimeout(() => {
            isFinalizingCurve = false;
          }, 100);
        }

        fabricCanvas.renderAll();
      });

      fabricCanvas.on("mouse:move", (e) => {
        if (!e.e || tempPoints.length === 0 || isFinalizingCurve) return;

        const canvasPoint = getCanvasPoint(fabricCanvas, e.e);
        // 🔧 BUG FIX #5 : Appliquer le magnétisme aux courbes
        const snappedPoint = snapPoint(canvasPoint);

        // Supprimer TOUS les objets d'aperçu précédents (lignes en pointillés seulement)
        fabricCanvas.getObjects().forEach((obj) => {
          if (obj instanceof Line && (obj as any).strokeDashArray && !gridLinesRef.current.includes(obj)) {
            fabricCanvas.remove(obj);
          }
        });

        // Nettoyer aussi les objets d'aperçu dans tempObjects
        const cleanedTempObjects = tempObjects.filter((obj) => !(obj instanceof Line && (obj as any).strokeDashArray));
        setTempObjects(cleanedTempObjects);

        if (previewCurve) {
          fabricCanvas.remove(previewCurve);
          setPreviewCurve(null);
        }

        if (tempPoints.length === 1) {
          // Aperçu ligne droite vers la deuxième extrémité
          const lastPoint = tempPoints[0];
          const previewLine = new Line([lastPoint.x, lastPoint.y, snappedPoint.x, snappedPoint.y], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            opacity: 0.7,
          });
          fabricCanvas.add(previewLine);
        } else if (tempPoints.length === 2) {
          // Aperçu de la courbe avec le point de contrôle qui suit la souris
          const [start, end] = tempPoints;
          const pathData = `M ${start.x} ${start.y} Q ${snappedPoint.x} ${snappedPoint.y} ${end.x} ${end.y}`;
          const preview = new Path(pathData, {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: "transparent",
            strokeLineCap: "round",
            strokeLineJoin: "round",
            opacity: 0.7,
            selectable: false,
            evented: false,
          });
          fabricCanvas.add(preview);
          setPreviewCurve(preview);

          // Lignes pointillées pour montrer le point de contrôle
          const line1 = new Line([start.x, start.y, snappedPoint.x, snappedPoint.y], {
            stroke: "#3b82f6",
            strokeWidth: 1,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            opacity: 0.5,
          });
          fabricCanvas.add(line1);

          const line2 = new Line([snappedPoint.x, snappedPoint.y, end.x, end.y], {
            stroke: "#3b82f6",
            strokeWidth: 1,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            opacity: 0.5,
          });
          fabricCanvas.add(line2);
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
      // Fonction helper pour créer un marqueur
      const createMarker = (point: { x: number; y: number }) => {
        return new Circle({
          left: point.x,
          top: point.y,
          radius: 3, // ✅ Réduit à 3px
          fill: "#3b82f6",
          stroke: "#ffffff",
          strokeWidth: 2,
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
        });
      };

      // Fonction helper pour nettoyer les objets temporaires
      const cleanTempObjects = () => {
        tempObjects.forEach((obj) => fabricCanvas.remove(obj));
        setTempObjects([]);
      };

      fabricCanvas.on("mouse:down", (e) => {
        const evt = e.e;
        // ✅ Ignorer si c'est le bouton du milieu
        if (evt instanceof MouseEvent && evt.button === 1) return;

        if (!evt) return;

        const canvasPoint = getCanvasPoint(fabricCanvas, evt);
        const snappedPoint = snapPoint(canvasPoint);
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
              });
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
              });
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
        fabricCanvas.add(marker);

        if (updatedPoints.length > 1) {
          const lastPoint = updatedPoints[updatedPoints.length - 2];
          const line = new Line([lastPoint.x, lastPoint.y, newPoint.x, newPoint.y], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
          });
          setTempObjects((prev) => [...prev, line]);
          fabricCanvas.add(line);
        }

        if (activeTool === "bezier" && updatedPoints.length === 4) {
          const [p1, cp1, cp2, p2] = updatedPoints;
          const pathData = `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`;
          const bezier = new Path(pathData, {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: "transparent",
            strokeLineCap: "round",
            strokeLineJoin: "round",
          });
          fabricCanvas.add(bezier);
          cleanTempObjects();
          setTempPoints([]);
          saveState(fabricCanvas);
          toast.success("Courbe de Bézier créée");
        }

        fabricCanvas.renderAll();
      });

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && tempPoints.length > 0) {
          cleanTempObjects();
          setTempPoints([]);
          toast.info("Dessin annulé");
        }
      };
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [
    fabricCanvas,
    activeTool,
    strokeColor,
    strokeWidth,
    tempPoints,
    tempObjects,
    getCanvasPoint,
    snapPoint,
    saveState,
    scaleFactor,
    cleanAllTempObjects,
    previewCurve,
  ]);

  // 🔧 BUG FIX #1 : Améliorer la fonction de suppression
  const handleDeleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((obj) => {
        // Si c'est une courbe éditable, supprimer aussi ses poignées
        if ((obj as any).customType === "editableCurve") {
          (obj as EditableCurve).removeHandles(fabricCanvas);
          // ✅ BUG FIX #1 : Nettoyer la ref si c'est la courbe active
          if (activeCurveRef.current === obj) {
            activeCurveRef.current = null;
          }
        }
        fabricCanvas.remove(obj);
      });
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
      saveState(fabricCanvas);
      setSelectedObject(null); // ✅ BUG FIX #1 : Nettoyer aussi l'objet sélectionné
      toast.success("Objet(s) supprimé(s)");
    }
  };

  const adjustForFullscreen = useCallback(() => {
    if (!fabricCanvas || !imgRef.current) return;

    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;

    // Adapter la taille du canvas à la fenêtre
    if (containerWidth > 0 && containerHeight > 0 && isFinite(containerWidth) && isFinite(containerHeight)) {
      fabricCanvas.setDimensions({ width: containerWidth, height: containerHeight });
    }

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
    { id: "select", icon: Hand, label: "Sélection (V)" },
    { id: "pan", icon: Move, label: "Déplacer la vue (H)" },
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
                    if (width > 0 && height > 0 && isFinite(width) && isFinite(height)) {
                      fabricCanvas.setDimensions({ width, height });
                      fabricCanvas.setViewportTransform((viewportTransform || [1, 0, 0, 1, 0, 0]) as any);
                      createGrid(fabricCanvas, width, height);
                      fabricCanvas.renderAll();
                      setZoom(1);
                    }
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
                  <Label className="text-xs">Couleur (nouveaux)</Label>
                  <Input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                    className="w-16 h-7"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Épaisseur (nouveaux): {strokeWidth}px</Label>
                  <Slider
                    value={[strokeWidth]}
                    onValueChange={([value]) => setStrokeWidth(value)}
                    min={1}
                    max={20}
                    step={1}
                  />
                </div>
              </div>

              {/* 🔧 BUG FIX #2 : Section pour éditer l'objet sélectionné */}
              {selectedObject && (
                <>
                  <Separator />
                  <div className="space-y-2 bg-blue-50 p-2 rounded border border-blue-200">
                    <Label className="text-xs font-semibold text-blue-700">✏️ Modifier l'objet sélectionné</Label>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Couleur</Label>
                      <Input
                        type="color"
                        value={selectedStrokeColor}
                        onChange={(e) => setSelectedStrokeColor(e.target.value)}
                        className="w-16 h-7"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Épaisseur: {selectedStrokeWidth}px</Label>
                      <Slider
                        value={[selectedStrokeWidth]}
                        onValueChange={([value]) => setSelectedStrokeWidth(value)}
                        min={1}
                        max={20}
                        step={1}
                      />
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={applyStrokeToSelected}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      ✓ Appliquer
                    </Button>
                  </div>
                </>
              )}

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

                {showGrid && (
                  <div className="space-y-1">
                    <Label className="text-xs">Taille: {gridSize}px</Label>
                    <Slider
                      value={[gridSize]}
                      onValueChange={([value]) => setGridSize(value)}
                      min={10}
                      max={100}
                      step={10}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Magnet className="h-3 w-3 text-muted-foreground" />
                    <Label className="text-xs">Magnétisme</Label>
                  </div>
                  <Switch checked={snapToGrid} onCheckedChange={setSnapToGrid} />
                </div>
              </div>

              <Separator />

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
                  Rétablir
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeleteSelected} className="h-8">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Suppr
                </Button>
              </div>
            </div>
          </div>
        </Draggable>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Outils de Dessin</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (fabricCanvas) {
                  previousCanvasSizeRef.current = {
                    width: fabricCanvas.width || 1000,
                    height: fabricCanvas.height || 700,
                    viewportTransform: fabricCanvas.viewportTransform ? [...fabricCanvas.viewportTransform] : null,
                  };
                  setIsFullscreen(true);
                  setTimeout(() => adjustForFullscreen(), 100);
                }
              }}
            >
              <Maximize className="h-4 w-4 mr-2" />
              Plein écran
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-2">
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
                className={`h-10 ${tool.highlight ? "ring-2 ring-blue-500" : ""}`}
              >
                <tool.icon className="h-4 w-4" style={tool.style} />
              </Button>
            ))}
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Couleur (nouveaux)</Label>
              <Input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Épaisseur (nouveaux): {strokeWidth}px</Label>
              <Slider
                value={[strokeWidth]}
                onValueChange={([value]) => setStrokeWidth(value)}
                min={1}
                max={20}
                step={1}
              />
            </div>
          </div>

          {/* 🔧 BUG FIX #2 : Section pour éditer l'objet sélectionné */}
          {selectedObject && (
            <>
              <Separator />
              <div className="space-y-3 bg-blue-50 p-3 rounded border border-blue-200">
                <Label className="font-semibold text-blue-700">✏️ Modifier l'objet sélectionné</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Couleur</Label>
                    <Input
                      type="color"
                      value={selectedStrokeColor}
                      onChange={(e) => setSelectedStrokeColor(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Épaisseur: {selectedStrokeWidth}px</Label>
                    <Slider
                      value={[selectedStrokeWidth]}
                      onValueChange={([value]) => setSelectedStrokeWidth(value)}
                      min={1}
                      max={20}
                      step={1}
                    />
                  </div>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={applyStrokeToSelected}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  ✓ Appliquer les modifications
                </Button>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Zoom: {Math.round(zoom * 100)}%</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4 mr-2" />-
                </Button>
                <Button variant="outline" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4 mr-2" />+
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetView}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Réinitialiser
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Grid3x3 className="h-4 w-4" />
                <Label>Afficher la grille</Label>
              </div>
              <Switch checked={showGrid} onCheckedChange={setShowGrid} />
            </div>

            {showGrid && (
              <div className="space-y-2">
                <Label>Taille de la grille: {gridSize}px</Label>
                <Slider
                  value={[gridSize]}
                  onValueChange={([value]) => setGridSize(value)}
                  min={10}
                  max={100}
                  step={10}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Magnet className="h-4 w-4" />
                <Label>Magnétisme de la grille</Label>
              </div>
              <Switch checked={snapToGrid} onCheckedChange={setSnapToGrid} />
            </div>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Annuler (Ctrl+Z)"
            >
              <Undo className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Rétablir (Ctrl+Y)"
            >
              <Redo className="h-4 w-4 mr-2" />
              Rétablir
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeleteSelected} title="Supprimer (Suppr)">
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className={isFullscreen ? "absolute" : "border border-gray-300 rounded-md"} />

      {/* 🔧 BUG FIX #4 : Aide visuelle pour le pan avec molette */}
      {!isFullscreen && (
        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          💡 <strong>Astuce :</strong> Utilisez la molette de la souris pour zoomer, et maintenez le{" "}
          <strong>bouton du milieu (molette)</strong> enfoncé pour déplacer la vue !
        </div>
      )}
    </div>
  );
}
