import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Line, Circle, Rect, Textbox, FabricImage } from "fabric";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  Download,
} from "lucide-react";
import { toast } from "sonner";

interface TemplateDrawingCanvasProps {
  imageUrl: string;
  scaleFactor: number; // pixels per mm
  onDrawingsChanged?: (drawingsData: any) => void;
  initialDrawings?: any;
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
    "select" | "line" | "rectangle" | "circle" | "pencil" | "text"
  >("select");
  const [strokeColor, setStrokeColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 1000,
      height: 700,
      backgroundColor: "#f5f5f5",
    });

    // Charger l'image de fond
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      
      // Ajuster les dimensions du canvas à l'image
      const maxWidth = 1000;
      const maxHeight = 700;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      
      canvas.setWidth(img.width * scale);
      canvas.setHeight(img.height * scale);
      canvas.backgroundColor = "#f5f5f5";
      
      // Ajouter l'image comme objet de fond non sélectionnable
      FabricImage.fromURL(imageUrl).then((fabricImg) => {
        fabricImg.set({
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
        });
        canvas.backgroundImage = fabricImg;
        canvas.renderAll();
      });

      canvas.renderAll();
    };
    img.src = imageUrl;

    setFabricCanvas(canvas);
    toast.success("Canevas de traçage prêt !");

    return () => {
      canvas.dispose();
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = activeTool === "pencil";
    fabricCanvas.selection = activeTool === "select";

    if (activeTool === "pencil" && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = strokeColor;
      fabricCanvas.freeDrawingBrush.width = strokeWidth;
    }

    // Gérer les autres outils
    if (activeTool !== "select" && activeTool !== "pencil") {
      fabricCanvas.off("mouse:down");
      fabricCanvas.off("mouse:move");
      fabricCanvas.off("mouse:up");

      let isDrawing = false;
      let startPoint: { x: number; y: number } | null = null;
      let activeObject: any = null;

      fabricCanvas.on("mouse:down", (e) => {
        if (!e.pointer) return;
        isDrawing = true;
        startPoint = { x: e.pointer.x, y: e.pointer.y };

        if (activeTool === "line") {
          activeObject = new Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
          });
          fabricCanvas.add(activeObject);
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
          fabricCanvas.add(activeObject);
        } else if (activeTool === "circle") {
          activeObject = new Circle({
            left: startPoint.x,
            top: startPoint.y,
            radius: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: "transparent",
          });
          fabricCanvas.add(activeObject);
        } else if (activeTool === "text") {
          const text = new Textbox("Texte", {
            left: startPoint.x,
            top: startPoint.y,
            fill: strokeColor,
            fontSize: 20,
          });
          fabricCanvas.add(text);
          fabricCanvas.setActiveObject(text);
          text.enterEditing();
          isDrawing = false;
        }
      });

      fabricCanvas.on("mouse:move", (e) => {
        if (!isDrawing || !startPoint || !e.pointer || !activeObject) return;

        if (activeTool === "line") {
          activeObject.set({
            x2: e.pointer.x,
            y2: e.pointer.y,
          });
        } else if (activeTool === "rectangle") {
          const width = e.pointer.x - startPoint.x;
          const height = e.pointer.y - startPoint.y;
          activeObject.set({
            width: Math.abs(width),
            height: Math.abs(height),
            left: width > 0 ? startPoint.x : e.pointer.x,
            top: height > 0 ? startPoint.y : e.pointer.y,
          });
        } else if (activeTool === "circle") {
          const dx = e.pointer.x - startPoint.x;
          const dy = e.pointer.y - startPoint.y;
          const radius = Math.sqrt(dx * dx + dy * dy);
          activeObject.set({
            radius: radius,
          });
        }

        fabricCanvas.renderAll();
      });

      fabricCanvas.on("mouse:up", () => {
        isDrawing = false;
        startPoint = null;
        activeObject = null;
        saveDrawings();
      });
    }

    return () => {
      fabricCanvas.off("mouse:down");
      fabricCanvas.off("mouse:move");
      fabricCanvas.off("mouse:up");
    };
  }, [activeTool, strokeColor, strokeWidth, fabricCanvas]);

  const saveDrawings = () => {
    if (!fabricCanvas) return;
    const json = fabricCanvas.toJSON();
    onDrawingsChanged?.(json);
  };

  const handleClear = () => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects();
    objects.forEach((obj) => {
      if (obj !== fabricCanvas.backgroundImage) {
        fabricCanvas.remove(obj);
      }
    });
    fabricCanvas.renderAll();
    saveDrawings();
    toast.success("Dessins effacés");
  };

  const handleDeleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((obj) => fabricCanvas.remove(obj));
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
      saveDrawings();
      toast.success("Objet(s) supprimé(s)");
    }
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(3, z + 0.25));
    if (fabricCanvas) {
      const newZoom = Math.min(3, zoom + 0.25);
      fabricCanvas.setZoom(newZoom);
      fabricCanvas.renderAll();
    }
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.5, z - 0.25));
    if (fabricCanvas) {
      const newZoom = Math.max(0.5, zoom - 0.25);
      fabricCanvas.setZoom(newZoom);
      fabricCanvas.renderAll();
    }
  };

  const tools = [
    { id: "select", icon: Hand, label: "Sélection" },
    { id: "line", icon: Minus, label: "Ligne" },
    { id: "rectangle", icon: Square, label: "Rectangle" },
    { id: "circle", icon: CircleIcon, label: "Cercle" },
    { id: "pencil", icon: Pencil, label: "Crayon" },
    { id: "text", icon: Type, label: "Texte" },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
        <div className="flex gap-1">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              variant={activeTool === tool.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTool(tool.id as any)}
              title={tool.label}
            >
              <tool.icon className="h-4 w-4" />
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
          <Input
            type="number"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseInt(e.target.value) || 2)}
            className="w-16"
          />
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Badge variant="outline" className="px-3">
            {Math.round(zoom * 100)}%
          </Badge>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={handleDeleteSelected}>
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            Effacer tout
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="text-sm text-muted-foreground">
        <p>
          Échelle: 1 pixel = {(1 / scaleFactor).toFixed(3)} mm • Tracez les contours et
          annotations sur le gabarit
        </p>
      </div>

      {/* Canvas */}
      <div className="border rounded-lg overflow-auto bg-muted" style={{ maxHeight: "600px" }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
