import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Canvas as FabricCanvas,
  FabricImage,
  Rect,
  Line,
  Triangle,
  Circle,
  Textbox,
  PencilBrush,
  Group,
  Control,
} from "fabric";
import * as fabric from "fabric";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Pencil,
  Square,
  Circle as CircleIcon,
  Type,
  Minus,
  ArrowRight,
  Trash2,
  Undo,
  Redo,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { AccessorySelector } from "./AccessorySelector";

interface TechnicalCanvasProps {
  projectId: string;
  onExpenseAdded?: () => void;
}

// Constantes pour le snapping
const SNAP_ANGLE_THRESHOLD = 15; // Degrés pour snapper à l'horizontal/vertical
const SNAP_DISTANCE = 10; // Pixels pour le magnétisme des poignées

export const TechnicalCanvas = ({ projectId, onExpenseAdded }: TechnicalCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "draw" | "rectangle" | "circle" | "text" | "line" | "arrow">(
    "select",
  );
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [history, setHistory] = useState<any[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  const isDrawingLineRef = useRef(false);
  const lineRef = useRef<Line | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const activeToolRef = useRef(activeTool);
  const colorRef = useRef(color);
  const strokeWidthRef = useRef(strokeWidth);

  // Mettre à jour les refs quand les valeurs changent
  useEffect(() => {
    activeToolRef.current = activeTool;
    colorRef.current = color;
    strokeWidthRef.current = strokeWidth;
  }, [activeTool, color, strokeWidth]);

  // Fonction pour snapper à l'horizontal ou vertical
  const snapToHorizontalOrVertical = (x1: number, y1: number, x2: number, y2: number): { x2: number; y2: number } => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);

    // Snapper à l'horizontal (0° ou 180°)
    if (angle < SNAP_ANGLE_THRESHOLD || angle > 180 - SNAP_ANGLE_THRESHOLD) {
      return { x2, y2: y1 };
    }

    // Snapper à la vertical (90°)
    if (Math.abs(angle - 90) < SNAP_ANGLE_THRESHOLD) {
      return { x2: x1, y2 };
    }

    return { x2, y2 };
  };

  // Fonction pour trouver les points de snapping magnétique
  const findSnapPoint = (x: number, y: number, currentObject?: any): { x: number; y: number; snapped: boolean } => {
    if (!fabricCanvasRef.current) return { x, y, snapped: false };

    const objects = fabricCanvasRef.current.getObjects();
    let closestPoint = { x, y, distance: Infinity };

    for (const obj of objects) {
      if (obj === currentObject) continue;

      // Points à vérifier selon le type d'objet
      const points: { x: number; y: number }[] = [];

      if (obj.type === "line") {
        const line = obj as Line;
        const matrix = line.calcTransformMatrix();
        const p1 = fabric.util.transformPoint({ x: line.x1 || 0, y: line.y1 || 0 }, matrix);
        const p2 = fabric.util.transformPoint({ x: line.x2 || 0, y: line.y2 || 0 }, matrix);
        points.push(p1, p2);
      } else if (obj.type === "group") {
        // Pour les flèches (groupes)
        const group = obj as Group;
        const line = group.getObjects()[0] as Line;
        if (line) {
          const matrix = group.calcTransformMatrix();
          const p1 = fabric.util.transformPoint({ x: line.x1 || 0, y: line.y1 || 0 }, matrix);
          const p2 = fabric.util.transformPoint({ x: line.x2 || 0, y: line.y2 || 0 }, matrix);
          points.push(p1, p2);
        }
      } else {
        // Pour les autres objets (rectangles, cercles), utiliser uniquement les coins
        const bound = obj.getBoundingRect();
        points.push(
          { x: bound.left, y: bound.top },
          { x: bound.left + bound.width, y: bound.top },
          { x: bound.left, y: bound.top + bound.height },
          { x: bound.left + bound.width, y: bound.top + bound.height },
        );
      }

      // Trouver le point le plus proche
      for (const point of points) {
        const distance = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));
        if (distance < closestPoint.distance && distance < SNAP_DISTANCE) {
          closestPoint = { x: point.x, y: point.y, distance };
        }
      }
    }

    if (closestPoint.distance < SNAP_DISTANCE) {
      return { x: closestPoint.x, y: closestPoint.y, snapped: true };
    }

    return { x, y, snapped: false };
  };

  // Initialize canvas
  useLayoutEffect(() => {
    setIsCanvasReady(false);
    const timer = setTimeout(() => {
      setIsCanvasReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isCanvasReady || !canvasRef.current) return;

    let mounted = true;

    const initCanvas = () => {
      if (!mounted || !canvasRef.current) return;

      const canvas = new FabricCanvas(canvasRef.current, {
        width: 1200,
        height: 800,
        backgroundColor: "#ffffff",
      });

      canvas.freeDrawingBrush = new PencilBrush(canvas);
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = strokeWidth;

      fabricCanvasRef.current = canvas;

      canvas.on("object:added", () => {
        if (mounted) {
          saveToHistory();
        }
      });

      canvas.on("object:modified", () => {
        if (mounted) {
          saveToHistory();
        }
      });

      canvas.on("selection:created", () => {
        if (mounted) {
          canvas.requestRenderAll();
        }
      });

      canvas.on("selection:updated", () => {
        if (mounted) {
          canvas.requestRenderAll();
        }
      });

      canvas.on("mouse:down", (event) => {
        if (!mounted) return;
        if (activeToolRef.current === "line" || activeToolRef.current === "arrow") {
          // Ne pas dessiner si on clique sur un objet existant
          if (event.target) return;

          const pointer = canvas.getPointer(event.e);
          isDrawingLineRef.current = true;
          startPointRef.current = { x: pointer.x, y: pointer.y };

          const line = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: colorRef.current,
            strokeWidth: strokeWidthRef.current,
            selectable: false,
            strokeLineCap: "round",
            strokeLineJoin: "round",
            fill: "",
          });
          lineRef.current = line;
          canvas.add(line);
          canvas.renderAll();
        }
      });

      canvas.on("mouse:move", (event) => {
        if (!mounted || !isDrawingLineRef.current || !lineRef.current || !startPointRef.current) return;
        const pointer = canvas.getPointer(event.e);

        // Appliquer le snapping horizontal/vertical
        const snapped = snapToHorizontalOrVertical(
          startPointRef.current.x,
          startPointRef.current.y,
          pointer.x,
          pointer.y,
        );

        lineRef.current.set({ x2: snapped.x2, y2: snapped.y2 });
        canvas.renderAll();
      });

      canvas.on("mouse:up", () => {
        if (!mounted || !isDrawingLineRef.current || !lineRef.current || !startPointRef.current) return;

        const line = lineRef.current;
        canvas.remove(line);

        const x1 = line.x1 || 0;
        const y1 = line.y1 || 0;
        const x2 = line.x2 || 0;
        const y2 = line.y2 || 0;

        if (activeToolRef.current === "arrow") {
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLength = 15;

          const arrowLine = new Line([x1, y1, x2, y2], {
            stroke: colorRef.current,
            strokeWidth: strokeWidthRef.current,
            selectable: true,
            hasControls: true,
            hasBorders: true,
            lockMovementX: false,
            lockMovementY: false,
            strokeLineCap: "round",
            strokeLineJoin: "round",
            strokeUniform: true,
            fill: "",
          });

          const arrowHead = new Triangle({
            left: x2 - Math.cos(angle) * (headLength / 2),
            top: y2 - Math.sin(angle) * (headLength / 2),
            angle: (angle * 180) / Math.PI + 90,
            width: headLength,
            height: headLength,
            fill: colorRef.current,
            stroke: colorRef.current,
            originX: "center",
            originY: "center",
            selectable: false,
          });

          const arrow = new Group([arrowLine, arrowHead], {
            selectable: true,
            hasControls: true,
            hasBorders: false,
            lockScalingX: true,
            lockScalingY: true,
            lockRotation: true,
            lockMovementX: false,
            lockMovementY: false,
            perPixelTargetFind: true,
          });

          // Désactiver tous les contrôles par défaut
          arrow.setControlsVisibility({
            mt: false,
            mb: false,
            ml: false,
            mr: false,
            bl: false,
            br: false,
            tl: false,
            tr: false,
            mtr: false,
          });

          // Contrôles personnalisés aux extrémités de la flèche
          arrow.controls = {
            p1: new Control({
              x: 0,
              y: 0,
              offsetX: 0,
              offsetY: 0,
              cursorStyle: "move",
              sizeX: 10,
              sizeY: 10,
              touchSizeX: 20,
              touchSizeY: 20,
              actionHandler: (eventData: any, transform: any, x: number, y: number) => {
                const group = transform.target as Group;
                const line = group.getObjects()[0] as Line;
                const head = group.getObjects()[1] as Triangle;

                const pointer = canvas.getPointer(eventData.e);

                // Appliquer le snapping magnétique
                const snappedPoint = findSnapPoint(pointer.x, pointer.y, group);

                // Appliquer le snapping horizontal/vertical si Shift n'est pas enfoncé
                let finalX = snappedPoint.x;
                let finalY = snappedPoint.y;

                if (!eventData.e.shiftKey && !snappedPoint.snapped) {
                  // Obtenir la position absolue du point 2
                  const absX2 = (group.left || 0) + (line.x2 || 0);
                  const absY2 = (group.top || 0) + (line.y2 || 0);

                  const snapped = snapToHorizontalOrVertical(finalX, finalY, absX2, absY2);

                  // Inverser le snapping (on snap p1 vers p2)
                  if (snapped.y2 === absY2) {
                    finalY = absY2;
                  }
                  if (snapped.x2 === absX2) {
                    finalX = absX2;
                  }
                }

                // Mettre à jour la position
                const deltaX = finalX - ((group.left || 0) + (line.x1 || 0));
                const deltaY = finalY - ((group.top || 0) + (line.y1 || 0));

                line.set({
                  x1: (line.x1 || 0) + deltaX,
                  y1: (line.y1 || 0) + deltaY,
                });

                // Recalculer l'angle et la position de la tête de flèche
                const x1 = line.x1 || 0;
                const y1 = line.y1 || 0;
                const x2 = line.x2 || 0;
                const y2 = line.y2 || 0;
                const angle = Math.atan2(y2 - y1, x2 - x1);
                const headLength = 15;

                head.set({
                  left: x2 - Math.cos(angle) * (headLength / 2),
                  top: y2 - Math.sin(angle) * (headLength / 2),
                  angle: (angle * 180) / Math.PI + 90,
                });

                group.addWithUpdate();
                group.setCoords();
                return true;
              },
              render: (
                ctx: CanvasRenderingContext2D,
                left: number,
                top: number,
                styleOverride: any,
                fabricObject: any,
              ) => {
                const size = 5;
                const group = fabricObject as Group;
                const line = group.getObjects()[0] as Line;
                ctx.save();
                ctx.fillStyle = line.stroke?.toString() || "#000000";
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
              },
              positionHandler: (dim: any, finalMatrix: any, fabricObject: any) => {
                const group = fabricObject as Group;
                const line = group.getObjects()[0] as Line;
                return new fabric.Point(line.x1 || 0, line.y1 || 0);
              },
            }),
            p2: new Control({
              x: 0,
              y: 0,
              offsetX: 0,
              offsetY: 0,
              cursorStyle: "move",
              sizeX: 10,
              sizeY: 10,
              touchSizeX: 20,
              touchSizeY: 20,
              actionHandler: (eventData: any, transform: any, x: number, y: number) => {
                const group = transform.target as Group;
                const line = group.getObjects()[0] as Line;
                const head = group.getObjects()[1] as Triangle;

                const pointer = canvas.getPointer(eventData.e);

                // Appliquer le snapping magnétique
                const snappedPoint = findSnapPoint(pointer.x, pointer.y, group);

                // Appliquer le snapping horizontal/vertical si Shift n'est pas enfoncé
                let finalX = snappedPoint.x;
                let finalY = snappedPoint.y;

                if (!eventData.e.shiftKey && !snappedPoint.snapped) {
                  // Obtenir la position absolue du point 1
                  const absX1 = (group.left || 0) + (line.x1 || 0);
                  const absY1 = (group.top || 0) + (line.y1 || 0);

                  const snapped = snapToHorizontalOrVertical(absX1, absY1, finalX, finalY);

                  finalX = snapped.x2;
                  finalY = snapped.y2;
                }

                // Mettre à jour la position
                const deltaX = finalX - ((group.left || 0) + (line.x2 || 0));
                const deltaY = finalY - ((group.top || 0) + (line.y2 || 0));

                line.set({
                  x2: (line.x2 || 0) + deltaX,
                  y2: (line.y2 || 0) + deltaY,
                });

                // Recalculer l'angle et la position de la tête de flèche
                const x1 = line.x1 || 0;
                const y1 = line.y1 || 0;
                const x2 = line.x2 || 0;
                const y2 = line.y2 || 0;
                const angle = Math.atan2(y2 - y1, x2 - x1);
                const headLength = 15;

                head.set({
                  left: x2 - Math.cos(angle) * (headLength / 2),
                  top: y2 - Math.sin(angle) * (headLength / 2),
                  angle: (angle * 180) / Math.PI + 90,
                });

                group.addWithUpdate();
                group.setCoords();
                return true;
              },
              render: (
                ctx: CanvasRenderingContext2D,
                left: number,
                top: number,
                styleOverride: any,
                fabricObject: any,
              ) => {
                const size = 5;
                const group = fabricObject as Group;
                const line = group.getObjects()[0] as Line;
                ctx.save();
                ctx.fillStyle = line.stroke?.toString() || "#000000";
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
              },
              positionHandler: (dim: any, finalMatrix: any, fabricObject: any) => {
                const group = fabricObject as Group;
                const line = group.getObjects()[0] as Line;
                return new fabric.Point(line.x2 || 0, line.y2 || 0);
              },
            }),
          };

          arrow.setCoords();
          canvas.add(arrow);
          canvas.renderAll();
        } else {
          const finalLine = new Line([x1, y1, x2, y2], {
            stroke: colorRef.current,
            strokeWidth: strokeWidthRef.current,
            selectable: true,
            hasControls: true,
            hasBorders: false,
            lockMovementX: false,
            lockMovementY: false,
            lockScalingX: true,
            lockScalingY: true,
            lockRotation: true,
            strokeLineCap: "round",
            strokeLineJoin: "round",
            strokeUniform: true,
            fill: "",
            perPixelTargetFind: true,
          });

          // Désactiver tous les contrôles par défaut
          finalLine.setControlsVisibility({
            mt: false,
            mb: false,
            ml: false,
            mr: false,
            bl: false,
            br: false,
            tl: false,
            tr: false,
            mtr: false,
          });

          // Contrôles personnalisés aux extrémités de la ligne
          finalLine.controls = {
            p1: new Control({
              x: 0,
              y: 0,
              offsetX: 0,
              offsetY: 0,
              cursorStyle: "move",
              sizeX: 10,
              sizeY: 10,
              touchSizeX: 20,
              touchSizeY: 20,
              actionHandler: (eventData: any, transform: any, x: number, y: number) => {
                const line = transform.target as Line;
                const pointer = canvas.getPointer(eventData.e);

                // Appliquer le snapping magnétique
                const snappedPoint = findSnapPoint(pointer.x, pointer.y, line);

                // Appliquer le snapping horizontal/vertical si Shift n'est pas enfoncé
                let finalX = snappedPoint.x;
                let finalY = snappedPoint.y;

                if (!eventData.e.shiftKey && !snappedPoint.snapped) {
                  // Obtenir la position absolue du point 2
                  const absX2 = (line.left || 0) + (line.x2 || 0);
                  const absY2 = (line.top || 0) + (line.y2 || 0);

                  const snapped = snapToHorizontalOrVertical(finalX, finalY, absX2, absY2);

                  // Inverser le snapping (on snap p1 vers p2)
                  if (snapped.y2 === absY2) {
                    finalY = absY2;
                  }
                  if (snapped.x2 === absX2) {
                    finalX = absX2;
                  }
                }

                // Mettre à jour la position
                const deltaX = finalX - ((line.left || 0) + (line.x1 || 0));
                const deltaY = finalY - ((line.top || 0) + (line.y1 || 0));

                line.set({
                  x1: (line.x1 || 0) + deltaX,
                  y1: (line.y1 || 0) + deltaY,
                });
                line.setCoords();
                return true;
              },
              render: (
                ctx: CanvasRenderingContext2D,
                left: number,
                top: number,
                styleOverride: any,
                fabricObject: any,
              ) => {
                const size = 5;
                const line = fabricObject as Line;
                ctx.save();
                ctx.fillStyle = line.stroke?.toString() || "#000000";
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
              },
              positionHandler: (dim: any, finalMatrix: any, fabricObject: any) => {
                const line = fabricObject as Line;
                return new fabric.Point(line.x1 || 0, line.y1 || 0);
              },
            }),
            p2: new Control({
              x: 0,
              y: 0,
              offsetX: 0,
              offsetY: 0,
              cursorStyle: "move",
              sizeX: 10,
              sizeY: 10,
              touchSizeX: 20,
              touchSizeY: 20,
              actionHandler: (eventData: any, transform: any, x: number, y: number) => {
                const line = transform.target as Line;
                const pointer = canvas.getPointer(eventData.e);

                // Appliquer le snapping magnétique
                const snappedPoint = findSnapPoint(pointer.x, pointer.y, line);

                // Appliquer le snapping horizontal/vertical si Shift n'est pas enfoncé
                let finalX = snappedPoint.x;
                let finalY = snappedPoint.y;

                if (!eventData.e.shiftKey && !snappedPoint.snapped) {
                  // Obtenir la position absolue du point 1
                  const absX1 = (line.left || 0) + (line.x1 || 0);
                  const absY1 = (line.top || 0) + (line.y1 || 0);

                  const snapped = snapToHorizontalOrVertical(absX1, absY1, finalX, finalY);

                  finalX = snapped.x2;
                  finalY = snapped.y2;
                }

                // Mettre à jour la position
                const deltaX = finalX - ((line.left || 0) + (line.x2 || 0));
                const deltaY = finalY - ((line.top || 0) + (line.y2 || 0));

                line.set({
                  x2: (line.x2 || 0) + deltaX,
                  y2: (line.y2 || 0) + deltaY,
                });
                line.setCoords();
                return true;
              },
              render: (
                ctx: CanvasRenderingContext2D,
                left: number,
                top: number,
                styleOverride: any,
                fabricObject: any,
              ) => {
                const size = 5;
                const line = fabricObject as Line;
                ctx.save();
                ctx.fillStyle = line.stroke?.toString() || "#000000";
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
              },
              positionHandler: (dim: any, finalMatrix: any, fabricObject: any) => {
                const line = fabricObject as Line;
                return new fabric.Point(line.x2 || 0, line.y2 || 0);
              },
            }),
          };

          finalLine.setCoords();
          canvas.add(finalLine);
          canvas.renderAll();
        }

        isDrawingLineRef.current = false;
        lineRef.current = null;
        startPointRef.current = null;
        canvas.renderAll();
      });
    };

    initCanvas();

    return () => {
      mounted = false;
      fabricCanvasRef.current?.dispose();
      fabricCanvasRef.current = null;
    };
  }, [isCanvasReady]);

  const saveToHistory = () => {
    if (!fabricCanvasRef.current) return;
    const json = fabricCanvasRef.current.toJSON();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(json);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyStep <= 0 || !fabricCanvasRef.current) return;
    const step = historyStep - 1;
    setHistoryStep(step);
    fabricCanvasRef.current.loadFromJSON(history[step], () => {
      fabricCanvasRef.current?.renderAll();
    });
  };

  const handleRedo = () => {
    if (historyStep >= history.length - 1 || !fabricCanvasRef.current) return;
    const step = historyStep + 1;
    setHistoryStep(step);
    fabricCanvasRef.current.loadFromJSON(history[step], () => {
      fabricCanvasRef.current?.renderAll();
    });
  };

  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    if (activeTool === "draw") {
      fabricCanvasRef.current.isDrawingMode = true;
      fabricCanvasRef.current.freeDrawingBrush.color = color;
      fabricCanvasRef.current.freeDrawingBrush.width = strokeWidth;
    } else {
      fabricCanvasRef.current.isDrawingMode = false;
    }

    if (activeTool === "select") {
      fabricCanvasRef.current.selection = true;
      fabricCanvasRef.current.forEachObject((obj) => {
        obj.selectable = true;
        fabricCanvasRef.current?.renderAll();
      });
    }
  }, [activeTool, color, strokeWidth]);

  const handleDelete = () => {
    if (!fabricCanvasRef.current) return;
    const activeObjects = fabricCanvasRef.current.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((obj) => {
        fabricCanvasRef.current?.remove(obj);
      });
      fabricCanvasRef.current.discardActiveObject();
      fabricCanvasRef.current.renderAll();
    }
  };

  const handleToolClick = (tool: typeof activeTool) => {
    setActiveTool(tool);
    if (!fabricCanvasRef.current) return;

    if (tool === "rectangle") {
      const rect = new Rect({
        left: 100,
        top: 100,
        fill: "transparent",
        stroke: color,
        strokeWidth: strokeWidth,
        width: 150,
        height: 100,
      });
      fabricCanvasRef.current.add(rect);
    } else if (tool === "circle") {
      const circle = new Circle({
        left: 100,
        top: 100,
        fill: "transparent",
        stroke: color,
        strokeWidth: strokeWidth,
        radius: 50,
      });
      fabricCanvasRef.current.add(circle);
    } else if (tool === "text") {
      const text = new Textbox("Texte", {
        left: 100,
        top: 100,
        fontSize: 20,
        fill: color,
      });
      fabricCanvasRef.current.add(text);
    }
  };

  const handleClear = () => {
    if (!fabricCanvasRef.current) return;
    fabricCanvasRef.current.clear();
    fabricCanvasRef.current.backgroundColor = "#ffffff";
    fabricCanvasRef.current.renderAll();
    setHistory([]);
    setHistoryStep(-1);
    toast.success("Canevas effacé");
  };

  const handleDownload = () => {
    if (!fabricCanvasRef.current) return;
    const dataURL = fabricCanvasRef.current.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 1,
    });
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = `schema-technique-${Date.now()}.png`;
    link.click();
    toast.success("Schéma téléchargé");
  };

  const handleSelectAccessory = (accessory: any, source: "expense" | "catalog") => {
    if (!fabricCanvasRef.current) return;

    const name = accessory.nom_accessoire || accessory.nom || "Accessoire";
    const details = [accessory.marque, accessory.categorie || accessory.categories?.nom, accessory.type_electrique]
      .filter(Boolean)
      .join(" | ");

    const text = new Textbox(`📦 ${name}\n${details}`, {
      left: 100,
      top: 100,
      fontSize: 14,
      fill: color,
      backgroundColor: "#ffffff",
      padding: 8,
      borderColor: color,
      cornerColor: color,
      width: 200,
    });

    fabricCanvasRef.current.add(text);
    fabricCanvasRef.current.setActiveObject(text);
    fabricCanvasRef.current.renderAll();

    toast.success(`${name} ajouté au schéma`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/50 rounded-lg">
        <Button
          variant={activeTool === "select" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTool("select")}
        >
          Sélectionner
        </Button>
        <Button variant={activeTool === "draw" ? "default" : "outline"} size="sm" onClick={() => setActiveTool("draw")}>
          <Pencil className="h-4 w-4 mr-2" />
          Dessiner
        </Button>
        <Button
          variant={activeTool === "line" ? "default" : "outline"}
          size="sm"
          onClick={() => handleToolClick("line")}
          title="Ligne (se snape automatiquement à l'horizontal/vertical, maintenez Shift pour désactiver)"
        >
          <Minus className="h-4 w-4 mr-2" />
          Ligne
        </Button>
        <Button
          variant={activeTool === "arrow" ? "default" : "outline"}
          size="sm"
          onClick={() => handleToolClick("arrow")}
          title="Flèche (se snape automatiquement à l'horizontal/vertical, maintenez Shift pour désactiver)"
        >
          <ArrowRight className="h-4 w-4 mr-2" />
          Flèche
        </Button>
        <Button
          variant={activeTool === "rectangle" ? "default" : "outline"}
          size="sm"
          onClick={() => handleToolClick("rectangle")}
        >
          <Square className="h-4 w-4 mr-2" />
          Rectangle
        </Button>
        <Button
          variant={activeTool === "circle" ? "default" : "outline"}
          size="sm"
          onClick={() => handleToolClick("circle")}
        >
          <CircleIcon className="h-4 w-4 mr-2" />
          Cercle
        </Button>
        <Button
          variant={activeTool === "text" ? "default" : "outline"}
          size="sm"
          onClick={() => handleToolClick("text")}
        >
          <Type className="h-4 w-4 mr-2" />
          Texte
        </Button>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Couleur :</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Épaisseur :</label>
          <input
            type="range"
            min="1"
            max="10"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-sm w-8">{strokeWidth}px</span>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <Button variant="outline" size="sm" onClick={handleUndo} disabled={historyStep <= 0}>
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleRedo} disabled={historyStep >= history.length - 1}>
          <Redo className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleClear}>
          Effacer tout
        </Button>

        <Separator orientation="vertical" className="h-8" />

        <AccessorySelector
          projectId={projectId}
          onSelectAccessory={handleSelectAccessory}
          onAddToCatalog={onExpenseAdded}
        />

        <Button variant="default" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Télécharger
        </Button>
      </div>

      {(activeTool === "line" || activeTool === "arrow") && (
        <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <strong>💡 Aide :</strong> Les traits se positionnent automatiquement à l'horizontal ou à la vertical. Les
          poignées s'accrochent magnétiquement aux autres éléments (distance : {SNAP_DISTANCE}px).
          <strong>Maintenez Shift</strong> pour désactiver temporairement le snapping.
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden shadow-lg bg-white">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};
