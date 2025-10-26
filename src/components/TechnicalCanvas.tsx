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

      canvas.on("mouse:down", (event) => {
        if (!mounted) return;
        if (activeTool === "line" || activeTool === "arrow") {
          // Ne pas dessiner si on clique sur un objet existant
          if (event.target) return;

          const pointer = canvas.getPointer(event.e);
          isDrawingLineRef.current = true;
          startPointRef.current = { x: pointer.x, y: pointer.y };

          const line = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: color,
            strokeWidth: strokeWidth,
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
        if (!mounted || !isDrawingLineRef.current || !lineRef.current) return;
        const pointer = canvas.getPointer(event.e);
        lineRef.current.set({ x2: pointer.x, y2: pointer.y });
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

        if (activeTool === "arrow") {
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLength = 15;

          const arrowLine = new Line([x1, y1, x2, y2], {
            stroke: color,
            strokeWidth: strokeWidth,
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
            fill: color,
            stroke: color,
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
              positionHandler: (dim: any, finalMatrix: any, fabricObject: any) => {
                const group = fabricObject as Group;
                const line = group.getObjects()[0] as Line;
                const x = line.x1 || 0;
                const y = line.y1 || 0;
                return fabric.util.transformPoint(
                  { x: x, y: y },
                  fabric.util.multiplyTransformMatrices(
                    fabricObject.canvas!.viewportTransform!,
                    fabricObject.calcTransformMatrix(),
                  ),
                );
              },
              actionHandler: (eventData: any, transform: any) => {
                const group = transform.target as Group;
                const line = group.getObjects()[0] as Line;
                const head = group.getObjects()[1] as Triangle;

                const pointer = canvas.getPointer(eventData.e);
                const localPointer = fabric.util.transformPoint(
                  pointer,
                  fabric.util.invertTransform(group.calcTransformMatrix()),
                );

                const x2 = line.x2 || 0;
                const y2 = line.y2 || 0;

                line.set({ x1: localPointer.x, y1: localPointer.y });

                // Recalculer l'angle et la position de la tête de flèche
                const angle = Math.atan2(y2 - localPointer.y, x2 - localPointer.x);
                const headLength = 15;

                head.set({
                  left: x2 - Math.cos(angle) * (headLength / 2),
                  top: y2 - Math.sin(angle) * (headLength / 2),
                  angle: (angle * 180) / Math.PI + 90,
                });

                group.addWithUpdate();
                return true;
              },
              cursorStyle: "move",
              render: (
                ctx: CanvasRenderingContext2D,
                left: number,
                top: number,
                styleOverride: any,
                fabricObject: any,
              ) => {
                const size = 8;
                ctx.save();
                ctx.fillStyle = "#2196F3";
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
              },
            }),
            p2: new Control({
              positionHandler: (dim: any, finalMatrix: any, fabricObject: any) => {
                const group = fabricObject as Group;
                const line = group.getObjects()[0] as Line;
                const x = line.x2 || 0;
                const y = line.y2 || 0;
                return fabric.util.transformPoint(
                  { x: x, y: y },
                  fabric.util.multiplyTransformMatrices(
                    fabricObject.canvas!.viewportTransform!,
                    fabricObject.calcTransformMatrix(),
                  ),
                );
              },
              actionHandler: (eventData: any, transform: any) => {
                const group = transform.target as Group;
                const line = group.getObjects()[0] as Line;
                const head = group.getObjects()[1] as Triangle;

                const pointer = canvas.getPointer(eventData.e);
                const localPointer = fabric.util.transformPoint(
                  pointer,
                  fabric.util.invertTransform(group.calcTransformMatrix()),
                );

                const x1 = line.x1 || 0;
                const y1 = line.y1 || 0;

                line.set({ x2: localPointer.x, y2: localPointer.y });

                // Recalculer l'angle et la position de la tête de flèche
                const angle = Math.atan2(localPointer.y - y1, localPointer.x - x1);
                const headLength = 15;

                head.set({
                  left: localPointer.x - Math.cos(angle) * (headLength / 2),
                  top: localPointer.y - Math.sin(angle) * (headLength / 2),
                  angle: (angle * 180) / Math.PI + 90,
                });

                group.addWithUpdate();
                return true;
              },
              cursorStyle: "move",
              render: (
                ctx: CanvasRenderingContext2D,
                left: number,
                top: number,
                styleOverride: any,
                fabricObject: any,
              ) => {
                const size = 8;
                ctx.save();
                ctx.fillStyle = "#FF5722";
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
              },
            }),
          };

          canvas.add(arrow);
        } else {
          const finalLine = new Line([x1, y1, x2, y2], {
            stroke: color,
            strokeWidth: strokeWidth,
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
              positionHandler: (dim: any, finalMatrix: any, fabricObject: any) => {
                const line = fabricObject as Line;
                const x = line.x1 || 0;
                const y = line.y1 || 0;
                return fabric.util.transformPoint(
                  { x: x, y: y },
                  fabric.util.multiplyTransformMatrices(
                    fabricObject.canvas!.viewportTransform!,
                    fabricObject.calcTransformMatrix(),
                  ),
                );
              },
              actionHandler: (eventData: any, transform: any, x: number, y: number) => {
                const line = transform.target as Line;
                const pointer = canvas.getPointer(eventData.e);
                const localPointer = fabric.util.transformPoint(
                  pointer,
                  fabric.util.invertTransform(line.calcTransformMatrix()),
                );
                line.set({ x1: localPointer.x, y1: localPointer.y });
                return true;
              },
              cursorStyle: "move",
              render: (
                ctx: CanvasRenderingContext2D,
                left: number,
                top: number,
                styleOverride: any,
                fabricObject: any,
              ) => {
                const size = 8;
                ctx.save();
                ctx.fillStyle = "#2196F3";
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
              },
            }),
            p2: new Control({
              positionHandler: (dim: any, finalMatrix: any, fabricObject: any) => {
                const line = fabricObject as Line;
                const x = line.x2 || 0;
                const y = line.y2 || 0;
                return fabric.util.transformPoint(
                  { x: x, y: y },
                  fabric.util.multiplyTransformMatrices(
                    fabricObject.canvas!.viewportTransform!,
                    fabricObject.calcTransformMatrix(),
                  ),
                );
              },
              actionHandler: (eventData: any, transform: any, x: number, y: number) => {
                const line = transform.target as Line;
                const pointer = canvas.getPointer(eventData.e);
                const localPointer = fabric.util.transformPoint(
                  pointer,
                  fabric.util.invertTransform(line.calcTransformMatrix()),
                );
                line.set({ x2: localPointer.x, y2: localPointer.y });
                return true;
              },
              cursorStyle: "move",
              render: (
                ctx: CanvasRenderingContext2D,
                left: number,
                top: number,
                styleOverride: any,
                fabricObject: any,
              ) => {
                const size = 8;
                ctx.save();
                ctx.fillStyle = "#FF5722";
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
              },
            }),
          };

          canvas.add(finalLine);
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
  }, [isCanvasReady, activeTool, color, strokeWidth]);

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
        >
          <Minus className="h-4 w-4 mr-2" />
          Ligne
        </Button>
        <Button
          variant={activeTool === "arrow" ? "default" : "outline"}
          size="sm"
          onClick={() => handleToolClick("arrow")}
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

      <div className="border border-border rounded-lg overflow-hidden shadow-lg bg-white">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};
