import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, FabricImage, Rect, Line, Triangle, Circle, Textbox, PencilBrush, Group, Control } from "fabric";
import * as fabric from "fabric";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil, Square, Circle as CircleIcon, Type, Minus, ArrowRight, Trash2, Undo, Redo, Download } from "lucide-react";
import { toast } from "sonner";
import { AccessorySelector } from "./AccessorySelector";

interface TechnicalCanvasProps {
  projectId: string;
  onExpenseAdded?: () => void;
}

export const TechnicalCanvas = ({ projectId, onExpenseAdded }: TechnicalCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "draw" | "rectangle" | "circle" | "text" | "line" | "arrow">("select");
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
          });
          lineRef.current = line;
          canvas.add(line);
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
            hasControls: false,
            hasBorders: false,
            lockMovementX: false,
            lockMovementY: false,
            objectCaching: false,
          });

          const arrowHead = new Triangle({
            left: x2 - Math.cos(angle) * (headLength / 2),
            top: y2 - Math.sin(angle) * (headLength / 2),
            angle: (angle * 180) / Math.PI + 90,
            width: headLength,
            height: headLength,
            fill: color,
            originX: "center",
            originY: "center",
            selectable: false,
          });

          const arrow = new Group([arrowLine, arrowHead], {
            selectable: true,
            hasControls: false,
            hasBorders: false,
            lockScalingX: true,
            lockScalingY: true,
            lockRotation: true,
            objectCaching: false,
          });

          // Ajouter les contrôles personnalisés aux extrémités
          const controls: any = {};
          
          // Point de début (gauche)
          controls.p1 = new fabric.Control({
            positionHandler: (dim: any, finalMatrix: any, fabricObject: any) => {
              const line = (fabricObject as Group).getObjects()[0] as Line;
              return new fabric.Point(line.x1 || 0, line.y1 || 0);
            },
            actionHandler: (eventData: any, transform: any, x: number, y: number) => {
              const group = transform.target as Group;
              const line = group.getObjects()[0] as Line;
              const head = group.getObjects()[1] as Triangle;
              
              line.set({ x1: x, y1: y });
              
              // Mettre à jour la flèche
              const angle = Math.atan2((line.y2 || 0) - y, (line.x2 || 0) - x);
              const headLength = 15;
              head.set({
                left: (line.x2 || 0) - Math.cos(angle) * (headLength / 2),
                top: (line.y2 || 0) - Math.sin(angle) * (headLength / 2),
                angle: (angle * 180) / Math.PI + 90,
              });
              
              return true;
            },
            cursorStyle: 'pointer',
            render: (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: any) => {
              ctx.save();
              ctx.fillStyle = '#2196F3';
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(left, top, 6, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
              ctx.restore();
            },
          });

          // Point de fin (droite)
          controls.p2 = new fabric.Control({
            positionHandler: (dim: any, finalMatrix: any, fabricObject: any) => {
              const line = (fabricObject as Group).getObjects()[0] as Line;
              return new fabric.Point(line.x2 || 0, line.y2 || 0);
            },
            actionHandler: (eventData: any, transform: any, x: number, y: number) => {
              const group = transform.target as Group;
              const line = group.getObjects()[0] as Line;
              const head = group.getObjects()[1] as Triangle;
              
              line.set({ x2: x, y2: y });
              
              // Mettre à jour la flèche
              const angle = Math.atan2(y - (line.y1 || 0), x - (line.x1 || 0));
              const headLength = 15;
              head.set({
                left: x - Math.cos(angle) * (headLength / 2),
                top: y - Math.sin(angle) * (headLength / 2),
                angle: (angle * 180) / Math.PI + 90,
              });
              
              return true;
            },
            cursorStyle: 'pointer',
            render: (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: any) => {
              ctx.save();
              ctx.fillStyle = '#2196F3';
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(left, top, 6, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
              ctx.restore();
            },
          });

          arrow.controls = controls;
          canvas.add(arrow);
        } else {
          const finalLine = new Line([x1, y1, x2, y2], {
            stroke: color,
            strokeWidth: strokeWidth,
            selectable: true,
            hasControls: false,
            hasBorders: false,
            lockMovementX: false,
            lockMovementY: false,
            objectCaching: false,
          });

          // Ajouter les contrôles personnalisés aux extrémités
          const controls: any = {};
          
          controls.p1 = new fabric.Control({
            positionHandler: (dim: any, finalMatrix: any, fabricObject: any) => {
              const line = fabricObject as Line;
              return new fabric.Point(line.x1 || 0, line.y1 || 0);
            },
            actionHandler: (eventData: any, transform: any, x: number, y: number) => {
              const line = transform.target as Line;
              line.set({ x1: x, y1: y });
              return true;
            },
            cursorStyle: 'pointer',
            render: (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: any) => {
              ctx.save();
              ctx.fillStyle = '#2196F3';
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(left, top, 6, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
              ctx.restore();
            },
          });

          controls.p2 = new fabric.Control({
            positionHandler: (dim: any, finalMatrix: any, fabricObject: any) => {
              const line = fabricObject as Line;
              return new fabric.Point(line.x2 || 0, line.y2 || 0);
            },
            actionHandler: (eventData: any, transform: any, x: number, y: number) => {
              const line = transform.target as Line;
              line.set({ x2: x, y2: y });
              return true;
            },
            cursorStyle: 'pointer',
            render: (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: any) => {
              ctx.save();
              ctx.fillStyle = '#2196F3';
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(left, top, 6, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
              ctx.restore();
            },
          });

          finalLine.controls = controls;
          canvas.add(finalLine);
        }

        isDrawingLineRef.current = false;
        lineRef.current = null;
        startPointRef.current = null;
        canvas.renderAll();
      });
    };

    const timeoutId = setTimeout(initCanvas, 50);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [isCanvasReady]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = activeTool === "draw";

    if (activeTool === "draw" && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = strokeWidth;
    }
  }, [activeTool, color, strokeWidth]);

  const saveToHistory = () => {
    if (!fabricCanvasRef.current) return;
    const json = fabricCanvasRef.current.toJSON();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(json);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyStep > 0 && fabricCanvasRef.current) {
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      fabricCanvasRef.current.loadFromJSON(history[newStep], () => {
        fabricCanvasRef.current?.renderAll();
      });
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1 && fabricCanvasRef.current) {
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      fabricCanvasRef.current.loadFromJSON(history[newStep], () => {
        fabricCanvasRef.current?.renderAll();
      });
    }
  };

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
    const details = [
      accessory.marque,
      accessory.categorie || accessory.categories?.nom,
      accessory.type_electrique,
    ]
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
        <Button
          variant={activeTool === "draw" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTool("draw")}
        >
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

        <Button
          variant="outline"
          size="sm"
          onClick={handleUndo}
          disabled={historyStep <= 0}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRedo}
          disabled={historyStep >= history.length - 1}
        >
          <Redo className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
        >
          Effacer tout
        </Button>

        <Separator orientation="vertical" className="h-8" />

        <AccessorySelector
          projectId={projectId}
          onSelectAccessory={handleSelectAccessory}
          onAddToCatalog={onExpenseAdded}
        />

        <Button
          variant="default"
          size="sm"
          onClick={handleDownload}
        >
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
