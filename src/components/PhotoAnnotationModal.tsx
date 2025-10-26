import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, FabricImage, Rect, Line, Triangle, Circle, Textbox, PencilBrush, Group } from "fabric";
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
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [isDrawingArrow, setIsDrawingArrow] = useState(false);
  
  // Utiliser des refs pour éviter les problèmes de closure
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentLineRef = useRef<Line | Group | null>(null);
  const isDraggingRef = useRef(false);
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);
  
  // Mettre à jour les refs quand les valeurs changent
  useEffect(() => {
    strokeColorRef.current = strokeColor;
    strokeWidthRef.current = strokeWidth;
  }, [strokeColor, strokeWidth]);

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

    setFabricCanvas(canvas);

    // Load image with better error handling
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      FabricImage.fromObject({
        type: 'image',
        version: '5.3.0',
        originX: 'left',
        originY: 'top',
        left: 0,
        top: 0,
        width: img.width,
        height: img.height,
        fill: 'rgb(0,0,0)',
        stroke: null,
        strokeWidth: 0,
        strokeDashArray: null,
        strokeLineCap: 'butt',
        strokeDashOffset: 0,
        strokeLineJoin: 'miter',
        strokeUniform: false,
        strokeMiterLimit: 4,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        flipX: false,
        flipY: false,
        opacity: 1,
        shadow: null,
        visible: true,
        backgroundColor: '',
        fillRule: 'nonzero',
        paintFirst: 'fill',
        globalCompositeOperation: 'source-over',
        skewX: 0,
        skewY: 0,
        cropX: 0,
        cropY: 0,
        src: img.src,
      }).then((fabricImg) => {
        if (!fabricImg || !fabricImg.width || !fabricImg.height) {
          toast.error("Erreur lors du chargement de l'image");
          return;
        }

        // Scale image to fit canvas while maintaining aspect ratio
        const scale = Math.min(
          canvas.width! / fabricImg.width,
          canvas.height! / fabricImg.height,
          1
        );
        
        fabricImg.scale(scale);
        fabricImg.set({
          left: (canvas.width! - fabricImg.width * scale) / 2,
          top: (canvas.height! - fabricImg.height * scale) / 2,
          selectable: false,
          evented: false,
        });
        
        canvas.add(fabricImg);
        canvas.sendObjectToBack(fabricImg);
        canvas.renderAll();

        // Load saved annotations if they exist
        if (photo.annotations && photo.annotations.objects) {
          try {
            // Ne charger que les objets qui ne sont pas des images
            const annotationObjects = photo.annotations.objects.filter((obj: any) => obj.type !== 'image');
            
            // Charger tous les objets d'annotation en une seule fois
            if (annotationObjects.length > 0) {
              annotationObjects.forEach((objData: any) => {
                // Recréer l'objet selon son type sans utiliser loadFromJSON
                if (objData.type === 'rect') {
                  const rect = new Rect(objData);
                  canvas.add(rect);
                } else if (objData.type === 'circle') {
                  const circle = new Circle(objData);
                  canvas.add(circle);
                } else if (objData.type === 'line') {
                  const line = new Line(objData.points, objData);
                  canvas.add(line);
                } else if (objData.type === 'triangle') {
                  const triangle = new Triangle(objData);
                  canvas.add(triangle);
                } else if (objData.type === 'textbox' || objData.type === 'text') {
                  const text = new Textbox(objData.text || '', objData);
                  canvas.add(text);
                } else if (objData.type === 'group') {
                  // Pour les groupes (flèches), on les recrée manuellement
                  Group.fromObject(objData).then((group) => {
                    canvas.add(group);
                    canvas.renderAll();
                  });
                }
              });
              canvas.renderAll();
            }
          } catch (error) {
            console.error("Error loading annotations:", error);
          }
        }
      }).catch((error) => {
        console.error("Error creating fabric image:", error);
        toast.error("Impossible de charger l'image");
      });
    };

    img.onerror = () => {
      console.error("Failed to load image from:", photo.url);
      toast.error("Impossible de charger l'image. Vérifiez l'URL.");
    };

    // Try to load the image
    img.src = photo.url;

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

  // Gestionnaire séparé pour le dessin de lignes et flèches avec drag
  useEffect(() => {
    if (!fabricCanvas || (!isDrawingLine && !isDrawingArrow)) return;

    const handleMouseDown = (event: any) => {
      if (!event.pointer) return;

      if (isDrawingLine || isDrawingArrow) {
        const pointer = event.pointer;
        startPointRef.current = { x: pointer.x, y: pointer.y };
        isDraggingRef.current = true;

        if (isDrawingLine) {
          // Créer une ligne temporaire
          const line = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: strokeColorRef.current,
            strokeWidth: strokeWidthRef.current,
            selectable: false,
          });
          fabricCanvas.add(line);
          currentLineRef.current = line;
        } else if (isDrawingArrow) {
          // Créer une flèche temporaire
          const line = new Line([0, 0, 0, 0], {
            stroke: strokeColorRef.current,
            strokeWidth: strokeWidthRef.current,
            originX: "left",
            originY: "center",
          });

          const arrowHead = new Triangle({
            left: 0,
            top: 0,
            width: 15,
            height: 15,
            fill: strokeColorRef.current,
            angle: 90,
            originX: "center",
            originY: "center",
          });

          const arrowGroup = new Group([line, arrowHead], {
            left: pointer.x,
            top: pointer.y,
            angle: 0,
            originX: "left",
            originY: "center",
            selectable: false,
          });

          fabricCanvas.add(arrowGroup);
          currentLineRef.current = arrowGroup;
        }
        fabricCanvas.renderAll();
      }
    };

    const handleMouseMove = (event: any) => {
      if (!isDraggingRef.current || !startPointRef.current || !currentLineRef.current || !event.pointer) return;

      const pointer = event.pointer;

      if (isDrawingLine && currentLineRef.current instanceof Line) {
        // Mettre à jour la ligne pendant le drag
        currentLineRef.current.set({
          x2: pointer.x,
          y2: pointer.y,
        });
      } else if (isDrawingArrow && currentLineRef.current instanceof Group) {
        // Calculer l'angle et la distance pour la flèche
        const dx = pointer.x - startPointRef.current.x;
        const dy = pointer.y - startPointRef.current.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const objects = currentLineRef.current.getObjects();
        const line = objects[0] as Line;
        const arrowHead = objects[1] as Triangle;

        line.set({ x2: distance, y2: 0 });
        arrowHead.set({ left: distance, top: 0 });

        currentLineRef.current.set({
          angle: angle,
          dirty: true,
        });
        currentLineRef.current.setCoords();
      }

      fabricCanvas.renderAll();
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current && currentLineRef.current) {
        // Rendre la ligne/flèche sélectionnable et ajouter les contrôles
        currentLineRef.current.set({
          selectable: true,
          hasControls: true,
          hasBorders: true,
          lockRotation: false,
        });

        // Pour les lignes, activer les contrôles aux extrémités
        if (currentLineRef.current instanceof Line) {
          currentLineRef.current.setControlsVisibility({
            mt: false,
            mb: false,
            ml: true,
            mr: true,
            mtr: false,
          });
        }

        fabricCanvas.setActiveObject(currentLineRef.current);
        fabricCanvas.renderAll();
        saveToHistory();

        // Réinitialiser
        isDraggingRef.current = false;
        startPointRef.current = null;
        currentLineRef.current = null;
        setIsDrawingLine(false);
        setIsDrawingArrow(false);
        setActiveTool("select");
      }
    };

    fabricCanvas.on("mouse:down", handleMouseDown);
    fabricCanvas.on("mouse:move", handleMouseMove);
    fabricCanvas.on("mouse:up", handleMouseUp);

    return () => {
      fabricCanvas.off("mouse:down", handleMouseDown);
      fabricCanvas.off("mouse:move", handleMouseMove);
      fabricCanvas.off("mouse:up", handleMouseUp);
    };
  }, [fabricCanvas, isDrawingLine, isDrawingArrow]);

  // Gestionnaire pour la touche Suppr
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fabricCanvas]);

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
    
    setActiveTool("rectangle");

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
    fabricCanvas.renderAll();
    saveToHistory();
    
    // Revenir en mode sélection après un court délai
    setTimeout(() => setActiveTool("select"), 100);
  };

  const addArrow = () => {
    if (!fabricCanvas) return;
    
    setActiveTool("arrow");
    setIsDrawingArrow(true);
    setIsDrawingLine(false);
    startPointRef.current = null;
    isDraggingRef.current = false;
    currentLineRef.current = null;
    toast.info("Cliquez et faites glisser pour dessiner la flèche");
  };

  const addCircle = () => {
    if (!fabricCanvas) return;
    
    setActiveTool("circle");

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
    fabricCanvas.renderAll();
    saveToHistory();
    
    setTimeout(() => setActiveTool("select"), 100);
  };

  const addLine = () => {
    if (!fabricCanvas) return;
    
    setActiveTool("line");
    setIsDrawingLine(true);
    setIsDrawingArrow(false);
    startPointRef.current = null;
    isDraggingRef.current = false;
    currentLineRef.current = null;
    toast.info("Cliquez et faites glisser pour dessiner la ligne");
  };

  const addText = () => {
    if (!fabricCanvas) return;
    
    setActiveTool("text");

    const text = new Textbox("Texte", {
      left: 100,
      top: 100,
      fontSize: 20,
      fill: strokeColor,
      width: 200,
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
    saveToHistory();
    
    setTimeout(() => setActiveTool("select"), 100);
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
