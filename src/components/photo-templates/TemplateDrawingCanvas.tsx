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

  // Créer les poignées de contrôle visuelles
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

    // Poignées (cercles)
    const handleStart = new Circle({
      left: this.controlPoints.start.x,
      top: this.controlPoints.start.y,
      radius: 6,
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
      radius: 8,
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
      radius: 6,
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

      canvas.renderAll();
    },
    [showGrid, gridSize],
  );

  // Sauvegarder l'état pour undo/redo
  const saveState = useCallback(
    (canvas: FabricCanvas) => {
      const objects = canvas
        .getObjects()
        .filter(
          (obj) =>
            (!gridLinesRef.current.includes(obj) && !(obj as any).curvePointType && obj.type !== "line") ||
            (obj.type === "line" && !(obj as any).strokeDashArray),
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

      canvas.setWidth(finalWidth);
      canvas.setHeight(finalHeight);

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

  // Gérer la sélection des courbes éditables
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
        curve.createHandles(fabricCanvas, strokeColor);
        activeCurveRef.current = curve;
      }
    };

    const handleDeselection = () => {
      if (activeCurveRef.current) {
        activeCurveRef.current.removeHandles(fabricCanvas);
        activeCurveRef.current = null;
      }
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

    // Gestion du pan avec le bouton du milieu (molette)
    let isPanningWithMiddleButton = false;
    let lastPanPos: { x: number; y: number } | null = null;

    fabricCanvas.on("mouse:down", (opt) => {
      const evt = opt.e;
      if (evt instanceof MouseEvent && evt.button === 1) {
        // Bouton du milieu (molette)
        isPanningWithMiddleButton = true;
        fabricCanvas.selection = false;
        lastPanPos = { x: evt.clientX, y: evt.clientY };
        evt.preventDefault();
        evt.stopPropagation();
      }
    });

    fabricCanvas.on("mouse:move", (opt) => {
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
      }
    });

    fabricCanvas.on("mouse:up", (opt) => {
      const evt = opt.e;
      if (evt instanceof MouseEvent && evt.button === 1) {
        isPanningWithMiddleButton = false;
        fabricCanvas.selection = true;
        lastPanPos = null;
        evt.preventDefault();
        evt.stopPropagation();
      }
    });

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
              vpt[4] += evt.clientX - lastPosRef.current.x;
              vpt[5] += evt.clientY - lastPosRef.current.y;
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

    // === OUTIL COURBE ÉDITABLE (le nouveau !) ===
    if (activeTool === "editableCurve") {
      fabricCanvas.on("mouse:down", (e) => {
        if (!e.pointer) return;

        const snappedPoint = snapPoint(e.pointer);
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
          toast.info("Deuxième extrémité placée. Déplacez la souris pour ajuster la courbure");

          // Créer un point de contrôle initial au milieu
          const [start, end] = updatedPoints;
          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;
          const initialControl = { x: midX, y: midY };

          // Créer la courbe immédiatement avec le point de contrôle au milieu
          const curve = new EditableCurve(
            new Point(start.x, start.y),
            new Point(initialControl.x, initialControl.y),
            new Point(end.x, end.y),
            {
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              fill: "transparent",
              strokeLineCap: "round",
              strokeLineJoin: "round",
            },
          );

          fabricCanvas.add(curve);
          setTempObjects((prev) => [...prev, curve]);
        } else if (updatedPoints.length === 3) {
          // Troisième point = ajustement final du point de contrôle
          const [start, end, control] = updatedPoints;

          // Supprimer la courbe temporaire
          const tempCurve = tempObjects.find((obj) => obj instanceof EditableCurve);
          if (tempCurve) {
            fabricCanvas.remove(tempCurve);
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

          cleanTempObjects();
          if (previewCurve) {
            fabricCanvas.remove(previewCurve);
            setPreviewCurve(null);
          }
          setTempPoints([]);
          saveState(fabricCanvas);
          toast.success("Courbe créée ! Sélectionnez-la pour la modifier");
        }

        fabricCanvas.renderAll();
      });

      fabricCanvas.on("mouse:move", (e) => {
        if (!e.pointer || tempPoints.length === 0) return;

        const snappedPoint = snapPoint(e.pointer);

        // Supprimer l'ancien aperçu
        if (previewObject) {
          fabricCanvas.remove(previewObject);
          previewObject = null;
        }
        if (previewCurve) {
          fabricCanvas.remove(previewCurve);
        }

        if (tempPoints.length === 1) {
          // Aperçu ligne droite vers la deuxième extrémité
          const lastPoint = tempPoints[0];
          previewObject = new Line([lastPoint.x, lastPoint.y, snappedPoint.x, snappedPoint.y], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            opacity: 0.7,
          });
          fabricCanvas.add(previewObject);
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

          setTempObjects((prev) => {
            // Garder seulement les marqueurs et la courbe temporaire
            const filtered = prev.filter((obj) => obj instanceof Circle || obj instanceof EditableCurve);
            return [...filtered, line1, line2];
          });
        }

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
          if (previewCurve) {
            fabricCanvas.remove(previewCurve);
            setPreviewCurve(null);
          }
          fabricCanvas.renderAll();
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
        if (!e.pointer) return;

        const snappedPoint = snapPoint(e.pointer);
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
            });
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
        if (!e.pointer || tempPoints.length === 0) return;

        const snappedPoint = snapPoint(e.pointer);

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
        if (!e.pointer) return;

        const snappedPoint = snapPoint(e.pointer);
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
          const realDistance = (distance / scaleFactor).toFixed(1);

          const dimensionLine = new Line([p1.x, p1.y, p2.x, p2.y], {
            stroke: "#3b82f6",
            strokeWidth: 2,
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
          });

          const arrow2Path = `M ${p2.x} ${p2.y} 
                             L ${p2.x - arrowSize * Math.cos(angle + 2.8)} ${p2.y - arrowSize * Math.sin(angle + 2.8)} 
                             L ${p2.x - arrowSize * Math.cos(angle - 2.8)} ${p2.y - arrowSize * Math.sin(angle - 2.8)} Z`;
          const arrow2 = new Path(arrow2Path, {
            fill: "#3b82f6",
            stroke: "#3b82f6",
            strokeWidth: 1,
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
          });

          const dimensionGroup = new Group([dimensionLine, arrow1, arrow2, text]);
          fabricCanvas.add(dimensionGroup);

          cleanTempObjects();
          setTempPoints([]);
          saveState(fabricCanvas);
          fabricCanvas.renderAll();
          toast.success(`Cote ajoutée: ${realDistance} mm`);
        }
      });

      fabricCanvas.on("mouse:move", (e) => {
        if (!e.pointer || tempPoints.length !== 1) return;

        const snappedPoint = snapPoint(e.pointer);

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
        if (!e.pointer) return;

        const snappedPoint = snapPoint(e.pointer);
        isDrawing = true;
        startPoint = { x: snappedPoint.x, y: snappedPoint.y };

        if (activeTool === "line") {
          activeObject = new Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeLineCap: "round",
          });
        } else if (activeTool === "rectangle") {
          activeObject = new Rect({
            left: startPoint.x,
            top: startPoint.y,
            width: 0,
            height: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: "transparent",
          });
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
          });
        } else if (activeTool === "ellipse") {
          activeObject = new Ellipse({
            left: startPoint.x,
            top: startPoint.y,
            rx: 0,
            ry: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: "transparent",
          });
        }

        fabricCanvas.add(activeObject);
      });

      fabricCanvas.on("mouse:move", (e) => {
        if (!isDrawing || !startPoint || !e.pointer || !activeObject) return;

        const snappedPoint = snapPoint(e.pointer);

        if (activeTool === "line") {
          activeObject.set({
            x2: snappedPoint.x,
            y2: snappedPoint.y,
          });
        } else if (activeTool === "rectangle") {
          const width = snappedPoint.x - startPoint.x;
          const height = snappedPoint.y - startPoint.y;
          activeObject.set({
            width: Math.abs(width),
            height: Math.abs(height),
            left: width > 0 ? startPoint.x : snappedPoint.x,
            top: height > 0 ? startPoint.y : snappedPoint.y,
          });
        } else if (activeTool === "circle") {
          const dx = snappedPoint.x - startPoint.x;
          const dy = snappedPoint.y - startPoint.y;
          const radius = Math.sqrt(dx * dx + dy * dy);
          activeObject.set({ radius: radius });
        } else if (activeTool === "ellipse") {
          const rx = Math.abs(snappedPoint.x - startPoint.x);
          const ry = Math.abs(snappedPoint.y - startPoint.y);
          activeObject.set({
            rx: rx,
            ry: ry,
            left: snappedPoint.x > startPoint.x ? startPoint.x : snappedPoint.x,
            top: snappedPoint.y > startPoint.y ? startPoint.y : snappedPoint.y,
          });
        }

        fabricCanvas.renderAll();
      });

      fabricCanvas.on("mouse:up", () => {
        if (isDrawing) {
          isDrawing = false;
          startPoint = null;
          activeObject = null;
          saveState(fabricCanvas);
        }
      });
    }

    // === OUTIL TEXTE ===
    if (activeTool === "text") {
      fabricCanvas.on("mouse:down", (e) => {
        if (!e.pointer) return;

        const snappedPoint = snapPoint(e.pointer);
        const text = new Textbox("Double-clic pour éditer", {
          left: snappedPoint.x,
          top: snappedPoint.y,
          fill: strokeColor,
          fontSize: 20,
          fontFamily: "Arial",
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        text.enterEditing();
        saveState(fabricCanvas);
      });
    }

    return () => {
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
          (obj as EditableCurve).removeHandles(fabricCanvas);
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

                {showGrid && (
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Taille:</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="10"
                        max="100"
                        value={gridSize}
                        onChange={(e) => setGridSize(parseInt(e.target.value) || 50)}
                        className="w-16 h-7 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">px</span>
                    </div>
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
            : "border rounded-lg overflow-auto bg-white shadow-lg"
        }
        style={isFullscreen ? {} : { maxHeight: "600px" }}
      >
        <canvas ref={canvasRef} className={isFullscreen ? "max-w-full max-h-full" : ""} />
      </div>

      {!isFullscreen && (
        <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
          <p>
            <strong>Échelle:</strong> 1 pixel = {(1 / scaleFactor).toFixed(3)} mm •{" "}
            <strong className="ml-2">Résolution:</strong> {scaleFactor.toFixed(2)} pixels/mm •
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
