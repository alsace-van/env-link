import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Square, ArrowRight, Save, Pencil, Type, CircleIcon, Minus, Trash2, Undo, Redo } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Canvas as FabricCanvas, PencilBrush, Line, Rect, Circle, Textbox, Path } from "fabric";

interface Photo {
  id: string;
  url: string;
  description?: string;
  comment?: string;
  annotations?: any;
}

interface PhotoAnnotationModalProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const PhotoAnnotationModal = ({ photo, isOpen, onClose, onSave }: PhotoAnnotationModalProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [activeTool, setActiveTool] = useState<"select" | "draw" | "rectangle" | "arrow" | "circle" | "line" | "text">(
    "select",
  );
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const [fabricInitialized, setFabricInitialized] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  const drawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentShapeRef = useRef<any>(null);

  useEffect(() => {
    if (photo) {
      setComment(photo.comment || "");
      setFabricInitialized(false);
      setIsLoadingImage(true);
    }
  }, [photo]);

  // Initialiser Fabric.js après chargement de l'image
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !imageRef.current || fabricInitialized || isLoadingImage) {
      return;
    }

    const initFabric = async () => {
      try {
        const canvas = canvasRef.current;
        const container = containerRef.current;

        if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        
        // Créer le canvas Fabric
        const fabricCanvas = new FabricCanvas(canvas, {
          width: rect.width,
          height: rect.height,
          backgroundColor: undefined,
          selection: activeTool === "select",
        });

        fabricCanvasRef.current = fabricCanvas;

        // Initialiser le brush pour le dessin libre
        if (fabricCanvas.freeDrawingBrush) {
          fabricCanvas.freeDrawingBrush.color = strokeColor;
          fabricCanvas.freeDrawingBrush.width = strokeWidth;
        }

        // Charger les annotations si présentes
        if (photo?.annotations) {
          try {
            await fabricCanvas.loadFromJSON(photo.annotations);
            fabricCanvas.renderAll();
            console.log("✅ Annotations loaded");
          } catch (error) {
            console.error("❌ Error loading annotations:", error);
          }
        }

        // Sauvegarder l'état initial
        const initialState = fabricCanvas.toJSON();
        setHistory([JSON.stringify(initialState)]);
        setHistoryStep(0);

        setFabricInitialized(true);
        toast.success("Outils d'annotation prêts!", { duration: 2000 });
      } catch (error) {
        console.error("❌ Error initializing Fabric.js:", error);
        toast.error("Les outils d'annotation ne peuvent pas être chargés");
      }
    };

    const timeoutId = setTimeout(initFabric, 100);

    return () => {
      clearTimeout(timeoutId);
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [isLoadingImage, fabricInitialized, photo, activeTool, strokeColor, strokeWidth]);

  // Gérer les outils
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;

    // Désactiver tous les modes
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.forEachObject((obj) => {
      obj.selectable = false;
      obj.evented = false;
    });

    // Nettoyer les event listeners
    canvas.off("mouse:down");
    canvas.off("mouse:move");
    canvas.off("mouse:up");

    if (activeTool === "select") {
      canvas.selection = true;
      canvas.forEachObject((obj) => {
        obj.selectable = true;
        obj.evented = true;
      });
    } else if (activeTool === "draw") {
      canvas.isDrawingMode = true;
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = strokeColor;
        canvas.freeDrawingBrush.width = strokeWidth;
      }
    } else if (["rectangle", "circle", "line", "arrow"].includes(activeTool)) {
      setupShapeDrawing();
    } else if (activeTool === "text") {
      setupTextDrawing();
    }
  }, [activeTool, strokeColor, strokeWidth, fabricInitialized]);

  const setupShapeDrawing = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.on("mouse:down", (o) => {
      drawingRef.current = true;
      const pointer = canvas.getPointer(o.e);
      startPointRef.current = { x: pointer.x, y: pointer.y };

      if (activeTool === "rectangle") {
        const rect = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: "transparent",
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        });
        canvas.add(rect);
        currentShapeRef.current = rect;
      } else if (activeTool === "circle") {
        const circle = new Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 0,
          fill: "transparent",
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        });
        canvas.add(circle);
        currentShapeRef.current = circle;
      } else if (activeTool === "line" || activeTool === "arrow") {
        const line = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        });
        canvas.add(line);
        currentShapeRef.current = line;
      }
    });

    canvas.on("mouse:move", (o) => {
      if (!drawingRef.current || !currentShapeRef.current || !startPointRef.current) return;

      const pointer = canvas.getPointer(o.e);
      const shape = currentShapeRef.current;

      if (activeTool === "rectangle") {
        const width = pointer.x - startPointRef.current.x;
        const height = pointer.y - startPointRef.current.y;
        shape.set({ width: Math.abs(width), height: Math.abs(height) });
        if (width < 0) shape.set({ left: pointer.x });
        if (height < 0) shape.set({ top: pointer.y });
      } else if (activeTool === "circle") {
        const radius = Math.sqrt(
          Math.pow(pointer.x - startPointRef.current.x, 2) + 
          Math.pow(pointer.y - startPointRef.current.y, 2)
        );
        shape.set({ radius });
      } else if (activeTool === "line" || activeTool === "arrow") {
        shape.set({ x2: pointer.x, y2: pointer.y });
      }

      canvas.renderAll();
    });

    canvas.on("mouse:up", () => {
      if (drawingRef.current && currentShapeRef.current) {
        if (activeTool === "arrow") {
          addArrowHead(currentShapeRef.current);
        }
        saveToHistory();
      }
      drawingRef.current = false;
      startPointRef.current = null;
      currentShapeRef.current = null;
    });
  };

  const addArrowHead = (line: any) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const x1 = line.x1 || 0;
    const y1 = line.y1 || 0;
    const x2 = line.x2 || 0;
    const y2 = line.y2 || 0;

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 15;
    
    const arrowHead = new Path(
      `M ${x2} ${y2} L ${x2 - headLength * Math.cos(angle - Math.PI / 6)} ${y2 - headLength * Math.sin(angle - Math.PI / 6)} M ${x2} ${y2} L ${x2 - headLength * Math.cos(angle + Math.PI / 6)} ${y2 - headLength * Math.sin(angle + Math.PI / 6)}`,
      {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: "transparent",
      }
    );

    canvas.add(arrowHead);
  };

  const setupTextDrawing = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.on("mouse:down", (o) => {
      const pointer = canvas.getPointer(o.e);
      const text = new Textbox("Texte", {
        left: pointer.x,
        top: pointer.y,
        fill: strokeColor,
        fontSize: 20,
        editable: true,
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      saveToHistory();
    });
  };

  const saveToHistory = () => {
    if (!fabricCanvasRef.current) return;
    const json = JSON.stringify(fabricCanvasRef.current.toJSON());
    setHistory((prev) => [...prev.slice(0, historyStep + 1), json]);
    setHistoryStep((prev) => prev + 1);
  };

  const handleUndo = async () => {
    if (historyStep <= 0 || !fabricCanvasRef.current) return;
    const newStep = historyStep - 1;
    setHistoryStep(newStep);
    await fabricCanvasRef.current.loadFromJSON(JSON.parse(history[newStep]));
    fabricCanvasRef.current.renderAll();
  };

  const handleRedo = async () => {
    if (historyStep >= history.length - 1 || !fabricCanvasRef.current) return;
    const newStep = historyStep + 1;
    setHistoryStep(newStep);
    await fabricCanvasRef.current.loadFromJSON(JSON.parse(history[newStep]));
    fabricCanvasRef.current.renderAll();
  };

  const handleDelete = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((obj) => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.renderAll();
      saveToHistory();
      toast.success("Élément supprimé");
    }
  };

  const handleSave = async () => {
    if (!photo) return;

    setIsSaving(true);

    try {
      let annotationsJSON = null;

      if (fabricInitialized && fabricCanvasRef.current) {
        annotationsJSON = fabricCanvasRef.current.toJSON();
      }

      const { error } = await supabase
        .from("project_photos")
        .update({
          annotations: annotationsJSON,
          comment: comment.trim() || null,
        })
        .eq("id", photo.id);

      if (error) throw error;

      toast.success("Sauvegardé");
      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const tools = [
    { name: "select", icon: null, label: "Sélection" },
    { name: "draw", icon: Pencil, label: "Dessin libre" },
    { name: "line", icon: Minus, label: "Ligne" },
    { name: "arrow", icon: ArrowRight, label: "Flèche" },
    { name: "rectangle", icon: Square, label: "Rectangle" },
    { name: "circle", icon: CircleIcon, label: "Cercle" },
    { name: "text", icon: Type, label: "Texte" },
  ] as const;

  if (!photo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Annoter la photo</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col px-6 pb-6 gap-4 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              {tools.map((tool) => (
                <Button
                  key={tool.name}
                  variant={activeTool === tool.name ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTool(tool.name as any)}
                  className="h-8 w-8 p-0"
                  title={tool.label}
                  disabled={!fabricInitialized}
                >
                  {tool.icon && <tool.icon className="h-4 w-4" />}
                  {tool.name === "select" && "↖"}
                </Button>
              ))}
            </div>

            <Separator orientation="vertical" className="h-8" />

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="h-8 w-12 rounded cursor-pointer"
                title="Couleur"
                disabled={!fabricInitialized}
              />
              <input
                type="range"
                min="1"
                max="10"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-24"
                title={`Épaisseur: ${strokeWidth}px`}
                disabled={!fabricInitialized}
              />
            </div>

            <Separator orientation="vertical" className="h-8" />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={historyStep <= 0 || !fabricInitialized}
              className="h-8 w-8 p-0"
              title="Annuler"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={historyStep >= history.length - 1 || !fabricInitialized}
              className="h-8 w-8 p-0"
              title="Rétablir"
            >
              <Redo className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-8" />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-8 w-8 p-0"
              title="Supprimer"
              disabled={!fabricInitialized}
            >
              <Trash2 className="h-4 w-4" />
            </Button>

            {fabricInitialized && <span className="text-xs text-green-600 font-semibold ml-2">✅ Outils actifs</span>}
            {!fabricInitialized && !isLoadingImage && (
              <span className="text-xs text-yellow-600 font-semibold ml-2 animate-pulse">⏳ Chargement...</span>
            )}
          </div>

          {/* Image Container */}
          <div ref={containerRef} className="flex-1 relative bg-muted rounded-lg overflow-hidden min-h-[500px]">
            {/* Image de base */}
            <img
              ref={imageRef}
              src={photo.url}
              alt={photo.description || "Photo"}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{ zIndex: 1 }}
              onLoad={() => {
                console.log("✅ Image loaded");
                setIsLoadingImage(false);
              }}
              onError={(e) => {
                console.error("❌ Image error:", e);
                toast.error("Erreur de chargement de l'image");
                setIsLoadingImage(false);
              }}
            />

            {/* Canvas Fabric.js */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              style={{ zIndex: 10 }}
            />

            {isLoadingImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-20">
                <div className="text-muted-foreground">Chargement de l'image...</div>
              </div>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Commentaire</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ajoutez un commentaire..."
              className="resize-none"
              rows={3}
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Fermer
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoAnnotationModal;
