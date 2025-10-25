import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, FabricImage, Rect, Line, Triangle, Circle, Textbox, PencilBrush } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Square, MousePointer, ArrowRight, Save, Pencil, Type, CircleIcon, Minus, Trash2, Undo, Redo } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "draw" | "rectangle" | "arrow" | "circle" | "line" | "text">("select");
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [history, setHistory] = useState<any[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  useEffect(() => {
    if (photo) {
      setComment(photo.comment || "");
    }
  }, [photo]);

  useEffect(() => {
    if (!canvasRef.current || !isOpen || !photo) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 900,
      height: 600,
      backgroundColor: "#f5f5f5",
    });

    // Load image with better error handling
    FabricImage.fromURL(photo.url, {
      crossOrigin: "anonymous",
    }).then((img) => {
      if (!img || !img.width || !img.height) {
        toast.error("Erreur lors du chargement de l'image");
        return;
      }

      // Scale image to fit canvas while maintaining aspect ratio
      const scale = Math.min(
        canvas.width! / img.width,
        canvas.height! / img.height,
        1 // Don't scale up
      );
      
      img.scale(scale);
      img.set({
        left: (canvas.width! - img.width * scale) / 2,
        top: (canvas.height! - img.height * scale) / 2,
        selectable: false,
        evented: false,
      });
      
      canvas.add(img);
      canvas.sendObjectToBack(img);
      canvas.renderAll();

      // Load saved annotations if they exist
      if (photo.annotations) {
        try {
          canvas.loadFromJSON(photo.annotations, () => {
            // Make sure image stays in back after loading annotations
            const objects = canvas.getObjects();
            const imageObj = objects.find(obj => obj.type === 'image');
            if (imageObj) {
              canvas.sendObjectToBack(imageObj);
            }
            canvas.renderAll();
          });
        } catch (error) {
          console.error("Error loading annotations:", error);
        }
      }
    }).catch((error) => {
      console.error("Error loading image:", error);
      toast.error("Erreur lors du chargement de l'image");
    });

    setFabricCanvas(canvas);
    setHistory([]);
    setHistoryStep(-1);

    return () => {
      canvas.dispose();
    };
  }, [isOpen, photo]);

  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = activeTool === "draw";
    fabricCanvas.selection = activeTool === "select";

    if (activeTool === "draw") {
      const brush = new PencilBrush(fabricCanvas);
      brush.color = strokeColor;
      brush.width = strokeWidth;
      fabricCanvas.freeDrawingBrush = brush;
    }

    fabricCanvas.forEachObject((obj) => {
      if (obj.type !== "image") {
        obj.selectable = activeTool === "select";
        obj.evented = activeTool === "select";
      }
    });

    fabricCanvas.renderAll();
  }, [activeTool, strokeColor, strokeWidth, fabricCanvas]);

  const saveToHistory = () => {
    if (!fabricCanvas) return;
    
    const json = fabricCanvas.toJSON();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(json);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (!fabricCanvas || historyStep <= 0) return;
    
    const prevStep = historyStep - 1;
    setHistoryStep(prevStep);
    fabricCanvas.loadFromJSON(history[prevStep], () => {
      fabricCanvas.renderAll();
    });
  };

  const handleRedo = () => {
    if (!fabricCanvas || historyStep >= history.length - 1) return;
    
    const nextStep = historyStep + 1;
    setHistoryStep(nextStep);
    fabricCanvas.loadFromJSON(history[nextStep], () => {
      fabricCanvas.renderAll();
    });
  };

  const addRectangle = () => {
    if (!fabricCanvas) return;

    const rect = new Rect({
      left: 100,
      top: 100,
      width: 150,
      height: 100,
      fill: "transparent",
      stroke: strokeColor,
      strokeWidth: strokeWidth,
    });

    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
    saveToHistory();
    setActiveTool("select");
  };

  const addArrow = () => {
    if (!fabricCanvas) return;

    const line = new Line([50, 50, 200, 50], {
      stroke: strokeColor,
      strokeWidth: strokeWidth,
    });

    const triangle = new Triangle({
      left: 200,
      top: 50,
      width: 20,
      height: 20,
      fill: strokeColor,
      angle: 90,
      originX: "center",
      originY: "center",
    });

    fabricCanvas.add(line);
    fabricCanvas.add(triangle);
    saveToHistory();
    setActiveTool("select");
  };

  const addCircle = () => {
    if (!fabricCanvas) return;

    const circle = new Circle({
      left: 100,
      top: 100,
      radius: 50,
      fill: "transparent",
      stroke: strokeColor,
      strokeWidth: strokeWidth,
    });

    fabricCanvas.add(circle);
    fabricCanvas.setActiveObject(circle);
    saveToHistory();
    setActiveTool("select");
  };

  const addLine = () => {
    if (!fabricCanvas) return;

    const line = new Line([50, 50, 200, 50], {
      stroke: strokeColor,
      strokeWidth: strokeWidth,
    });

    fabricCanvas.add(line);
    fabricCanvas.setActiveObject(line);
    saveToHistory();
    setActiveTool("select");
  };

  const addText = () => {
    if (!fabricCanvas) return;

    const text = new Textbox("Texte", {
      left: 100,
      top: 100,
      fontSize: 20,
      fill: strokeColor,
      width: 200,
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    saveToHistory();
    setActiveTool("select");
  };

  const deleteSelected = () => {
    if (!fabricCanvas) return;

    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((obj) => {
        if (obj.type !== "image") {
          fabricCanvas.remove(obj);
        }
      });
      fabricCanvas.discardActiveObject();
      saveToHistory();
      fabricCanvas.renderAll();
    }
  };

  const handleSave = async () => {
    if (!fabricCanvas || !photo) return;

    setIsSaving(true);

    try {
      const annotations = fabricCanvas.toJSON();

      const { error } = await supabase
        .from("project_photos")
        .update({
          annotations: annotations,
          comment: comment,
        })
        .eq("id", photo.id);

      if (error) {
        toast.error("Erreur lors de la sauvegarde");
        console.error(error);
        return;
      }

      toast.success("Annotations sauvegardées !");
      onSave();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  if (!photo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle>Annoter la photo</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                variant={activeTool === "select" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTool("select")}
              >
                <MousePointer className="h-4 w-4 mr-1" />
                Sélectionner
              </Button>
              <Button
                variant={activeTool === "draw" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTool("draw")}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Crayon
              </Button>
              <Button
                variant={activeTool === "rectangle" ? "default" : "outline"}
                size="sm"
                onClick={addRectangle}
              >
                <Square className="h-4 w-4 mr-1" />
                Rectangle
              </Button>
              <Button
                variant={activeTool === "circle" ? "default" : "outline"}
                size="sm"
                onClick={addCircle}
              >
                <CircleIcon className="h-4 w-4 mr-1" />
                Cercle
              </Button>
              <Button
                variant={activeTool === "line" ? "default" : "outline"}
                size="sm"
                onClick={addLine}
              >
                <Minus className="h-4 w-4 mr-1" />
                Ligne
              </Button>
              <Button
                variant={activeTool === "arrow" ? "default" : "outline"}
                size="sm"
                onClick={addArrow}
              >
                <ArrowRight className="h-4 w-4 mr-1" />
                Flèche
              </Button>
              <Button
                variant={activeTool === "text" ? "default" : "outline"}
                size="sm"
                onClick={addText}
              >
                <Type className="h-4 w-4 mr-1" />
                Texte
              </Button>
              
              <Separator orientation="vertical" className="h-8" />
              
              <Button
                variant="outline"
                size="sm"
                onClick={deleteSelected}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer
              </Button>
              
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
            </div>

            <div className="flex gap-2 items-center">
              <Label className="text-sm">Couleur:</Label>
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="w-10 h-8 rounded border cursor-pointer"
              />
              
              <Separator orientation="vertical" className="h-8 mx-2" />
              
              <Label className="text-sm">Épaisseur:</Label>
              <input
                type="range"
                min="1"
                max="10"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">{strokeWidth}px</span>
            </div>

            <div className="flex-1 border rounded-lg overflow-auto bg-muted flex items-center justify-center min-h-0">
              <canvas ref={canvasRef} style={{ display: 'block' }} />
            </div>
          </div>

          <div className="w-80 flex flex-col gap-4">
            <div className="flex-1 flex flex-col gap-2">
              <Label htmlFor="comment">Commentaire</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ajoutez un commentaire sur cette photo..."
                className="flex-1 resize-none"
              />
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? (
                "Sauvegarde..."
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoAnnotationModal;
