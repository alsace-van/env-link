import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, FabricImage, Rect, Line, Triangle, Circle, Textbox, PencilBrush, Group } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Square,
  MousePointer,
  ArrowRight,
  Save,
  Pencil,
  Type,
  CircleIcon,
  Minus,
  Trash2,
  Undo,
  Redo,
} from "lucide-react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);

  const [activeTool, setActiveTool] = useState<"select" | "draw" | "rectangle" | "arrow" | "circle" | "line" | "text">(
    "select",
  );
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const [strokeColor, setStrokeColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [history, setHistory] = useState<any[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  
  // Using refs to avoid re-renders that break canvas display
  const isDrawingLineRef = useRef(false);
  const isDrawingArrowRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);

  useEffect(() => {
    if (photo) {
      setComment(photo.comment || "");
    }
  }, [photo]);

  // Initialisation du canvas
  useEffect(() => {
    if (!isOpen || !photo) {
      return;
    }

    let mounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const handleMouseDown = (event: any) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      // Get pointer coordinates using Fabric.js v6 API
      const pointer = canvas.getPointer(event.e);
      if (!pointer) return;

      if (isDrawingLineRef.current || isDrawingArrowRef.current) {
        if (!startPointRef.current) {
          // First click: set start point
          startPointRef.current = { x: pointer.x, y: pointer.y };
          toast.info("Cliquez pour le point d'arrivée (Maj pour ligne droite)");
        } else {
          // Second click: draw line or arrow
          let endX = pointer.x;
          let endY = pointer.y;

          // If Shift is pressed, constrain to horizontal or vertical
          if (event.e.shiftKey) {
            const dx = Math.abs(endX - startPointRef.current.x);
            const dy = Math.abs(endY - startPointRef.current.y);
            
            if (dx > dy) {
              // Horizontal line
              endY = startPointRef.current.y;
            } else {
              // Vertical line
              endX = startPointRef.current.x;
            }
          }

          if (isDrawingLineRef.current) {
            const line = new Line([startPointRef.current.x, startPointRef.current.y, endX, endY], {
              stroke: strokeColorRef.current,
              strokeWidth: strokeWidthRef.current,
              strokeUniform: true,
            });
            
            // Configure controls for line: only endpoints, no rotation handle
            line.setControlsVisibility({
              mtr: false, // rotation handle
              ml: false, // middle left
              mr: false, // middle right
              mt: false, // middle top
              mb: false, // middle bottom
              tl: true, // top left (start point)
              tr: false,
              bl: false,
              br: true, // bottom right (end point)
            });
            
            canvas.add(line);
            canvas.setActiveObject(line);
          } else if (isDrawingArrowRef.current) {
            const dx = endX - startPointRef.current.x;
            const dy = endY - startPointRef.current.y;
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const line = new Line([0, 0, distance, 0], {
              stroke: strokeColorRef.current,
              strokeWidth: strokeWidthRef.current,
              strokeUniform: true,
              originX: "left",
              originY: "center",
            });

            const arrowHead = new Triangle({
              left: distance,
              top: 0,
              width: 15,
              height: 15,
              fill: strokeColorRef.current,
              angle: 90,
              originX: "center",
              originY: "center",
            });

            const arrowGroup = new Group([line, arrowHead], {
              left: startPointRef.current.x,
              top: startPointRef.current.y,
              angle: angle,
              originX: "left",
              originY: "center",
              strokeUniform: true,
            });
            
            // Configure controls for arrow: only endpoints, no rotation handle
            arrowGroup.setControlsVisibility({
              mtr: false, // rotation handle
              ml: false, // middle left
              mr: false, // middle right
              mt: false, // middle top
              mb: false, // middle bottom
              tl: true, // left endpoint
              tr: false,
              bl: false,
              br: true, // right endpoint
            });

            canvas.add(arrowGroup);
            canvas.setActiveObject(arrowGroup);
          }

          canvas.renderAll();
          saveToHistory();

          // Reset state
          startPointRef.current = null;
          isDrawingLineRef.current = false;
          isDrawingArrowRef.current = false;
          setActiveTool("select");
        }
      }
    };

    const initCanvas = async () => {
      // Check if refs are available and component is still mounted
      if (!mounted) return;
      
      if (!canvasRef.current || !containerRef.current) {
        console.log("Refs not ready yet, waiting...");
        // Retry with backoff, max 5 attempts
        const retryCount = (initCanvas as any).retryCount || 0;
        if (retryCount < 5) {
          (initCanvas as any).retryCount = retryCount + 1;
          timeoutId = setTimeout(initCanvas, 150);
        } else {
          console.error("Failed to initialize canvas: refs not available after multiple retries");
          setIsLoadingImage(false);
        }
        return;
      }

      if (!mounted) return;
      
      setIsLoadingImage(true);
      console.log("Starting canvas initialization...");

      try {
        const container = containerRef.current;
        const canvasElement = canvasRef.current;

        console.log("Container dimensions:", {
          width: container.clientWidth,
          height: container.clientHeight,
        });

        // Nettoyer le canvas existant s'il y en a un
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.dispose();
          fabricCanvasRef.current = null;
        }

        const containerWidth = container.clientWidth || 800;
        const containerHeight = container.clientHeight || 600;

        console.log("Creating canvas with dimensions:", {
          width: containerWidth,
          height: containerHeight,
        });

        // Créer le nouveau canvas
        const newCanvas = new FabricCanvas(canvasElement, {
          width: containerWidth,
          height: containerHeight,
          backgroundColor: "#f5f5f5",
        });

        if (!mounted) {
          newCanvas.dispose();
          return;
        }

        fabricCanvasRef.current = newCanvas;

        // Attacher le gestionnaire d'événements pour les lignes et flèches
        newCanvas.on("mouse:down", handleMouseDown);

        console.log("Canvas initialized, loading image from:", photo.url);

        // Obtenir l'URL de l'image (avec signature si nécessaire)
        let imageUrl = photo.url;

        if (photo.url.includes("/storage/v1/object/public/project-photos/")) {
          const urlParts = photo.url.split("/project-photos/");
          if (urlParts.length >= 2) {
            const filePath = urlParts[1];
            const { data } = await supabase.storage.from("project-photos").createSignedUrl(filePath, 3600);

            if (data?.signedUrl) {
              imageUrl = data.signedUrl;
              console.log("Using signed URL");
            }
          }
        }

        console.log("Loading image from URL:", imageUrl);

        // Charger l'image
        const fabricImg = await FabricImage.fromURL(imageUrl, {
          crossOrigin: "anonymous",
        });

        if (!mounted || !fabricCanvasRef.current) {
          console.log("Canvas unmounted during image load");
          return;
        }

        if (!fabricImg || !fabricImg.width || !fabricImg.height) {
          console.error("Invalid image loaded:", fabricImg);
          if (mounted) {
            toast.error("Erreur lors du chargement de l'image");
            setIsLoadingImage(false);
          }
          return;
        }

        console.log("Image loaded successfully:", {
          width: fabricImg.width,
          height: fabricImg.height,
        });

        // Adapter l'image au canvas
        const scale = Math.min(
          (newCanvas.width! - 40) / fabricImg.width,
          (newCanvas.height! - 40) / fabricImg.height,
          1,
        );

        console.log("Image scale:", scale);

        fabricImg.scale(scale);
        fabricImg.set({
          left: (newCanvas.width! - fabricImg.width * scale) / 2,
          top: (newCanvas.height! - fabricImg.height * scale) / 2,
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockMovementY: true,
        });

        newCanvas.add(fabricImg);
        newCanvas.sendObjectToBack(fabricImg);
        newCanvas.renderAll();

        console.log("Canvas rendered with image");

        if (mounted) {
          setIsLoadingImage(false);
        }

        // Charger les annotations sauvegardées
        if (photo.annotations && photo.annotations.objects && mounted) {
          try {
            const annotationObjects = photo.annotations.objects.filter((obj: any) => obj.type !== "image");

            if (annotationObjects.length > 0) {
              console.log("Loading annotations:", annotationObjects.length);
              for (const objData of annotationObjects) {
                if (!mounted || !fabricCanvasRef.current) break;

                try {
                  if (objData.type === "rect") {
                    const rect = new Rect(objData);
                    newCanvas.add(rect);
                  } else if (objData.type === "circle") {
                    const circle = new Circle(objData);
                    newCanvas.add(circle);
                  } else if (objData.type === "line") {
                    const line = new Line(objData.points, objData);
                    // Configure controls for loaded lines
                    line.setControlsVisibility({
                      mtr: false,
                      ml: false,
                      mr: false,
                      mt: false,
                      mb: false,
                      tl: true,
                      tr: false,
                      bl: false,
                      br: true,
                    });
                    newCanvas.add(line);
                  } else if (objData.type === "triangle") {
                    const triangle = new Triangle(objData);
                    newCanvas.add(triangle);
                  } else if (objData.type === "textbox" || objData.type === "text") {
                    const text = new Textbox(objData.text || "", objData);
                    newCanvas.add(text);
                  } else if (objData.type === "group") {
                    const group = await Group.fromObject(objData);
                    if (mounted && fabricCanvasRef.current) {
                      // Configure controls for loaded groups (arrows)
                      group.setControlsVisibility({
                        mtr: false,
                        ml: false,
                        mr: false,
                        mt: false,
                        mb: false,
                        tl: true,
                        tr: false,
                        bl: false,
                        br: true,
                      });
                      newCanvas.add(group);
                    }
                  } else if (objData.type === "path") {
                    const { Path } = await import("fabric");
                    const path = await Path.fromObject(objData);
                    if (mounted && fabricCanvasRef.current) {
                      newCanvas.add(path);
                    }
                  }
                } catch (err) {
                  console.error("Error loading individual annotation:", err);
                }
              }

              if (mounted && fabricCanvasRef.current) {
                newCanvas.renderAll();
                console.log("Annotations loaded successfully");
              }
            }
          } catch (error) {
            console.error("Error loading annotations:", error);
          }
        }
      } catch (error) {
        console.error("Failed to initialize canvas:", error);
        if (mounted) {
          toast.error("Impossible de charger l'image");
          setIsLoadingImage(false);
        }
      }
    };

    setHistory([]);
    setHistoryStep(-1);
    
    // Reset retry counter
    (initCanvas as any).retryCount = 0;
    
    // Start initialization with a delay to ensure Dialog portal is mounted
    timeoutId = setTimeout(initCanvas, 300);

    return () => {
      mounted = false;
      
      // Clear any pending timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (fabricCanvasRef.current) {
        try {
          fabricCanvasRef.current.off("mouse:down", handleMouseDown);
          fabricCanvasRef.current.dispose();
        } catch (e) {
          console.error("Error disposing canvas:", e);
        }
        fabricCanvasRef.current = null;
      }
    };
  }, [isOpen, photo]);

  // Update refs when state changes
  useEffect(() => {
    strokeColorRef.current = strokeColor;
    strokeWidthRef.current = strokeWidth;
  }, [strokeColor, strokeWidth]);

  // Gestion des outils
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = activeTool === "draw";
    canvas.selection = activeTool === "select";

    if (activeTool === "draw") {
      const brush = new PencilBrush(canvas);
      brush.color = strokeColor;
      brush.width = strokeWidth;
      canvas.freeDrawingBrush = brush;
    }

    canvas.forEachObject((obj) => {
      if (obj.type !== "image") {
        obj.selectable = activeTool === "select";
        obj.evented = activeTool === "select";
      }
    });

    canvas.renderAll();
  }, [activeTool, strokeColor, strokeWidth]);


  // Gestionnaire clavier
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        const target = event.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          event.preventDefault();
          deleteSelected();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const saveToHistory = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const json = canvas.toJSON();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(json);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const handleUndo = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || historyStep <= 0) return;

    const previousState = history[historyStep - 1];
    setHistoryStep(historyStep - 1);

    canvas.loadFromJSON(previousState).then(() => {
      canvas.renderAll();
    });
  };

  const handleRedo = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || historyStep >= history.length - 1) return;

    const nextState = history[historyStep + 1];
    setHistoryStep(historyStep + 1);

    canvas.loadFromJSON(nextState).then(() => {
      canvas.renderAll();
    });
  };

  const addRectangle = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    setActiveTool("rectangle");

    const rect = new Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: "transparent",
      stroke: strokeColor,
      strokeWidth: strokeWidth,
    });

    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
    saveToHistory();

    setTimeout(() => setActiveTool("select"), 100);
  };

  const addArrow = () => {
    if (!fabricCanvasRef.current) return;

    setActiveTool("arrow");
    isDrawingArrowRef.current = true;
    isDrawingLineRef.current = false;
    startPointRef.current = null;
    toast.info("Cliquez pour le point de départ, puis pour le point d'arrivée");
  };

  const addCircle = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    setActiveTool("circle");

    const circle = new Circle({
      left: 100,
      top: 100,
      radius: 50,
      fill: "transparent",
      stroke: strokeColor,
      strokeWidth: strokeWidth,
    });

    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
    saveToHistory();

    setTimeout(() => setActiveTool("select"), 100);
  };

  const addLine = () => {
    if (!fabricCanvasRef.current) return;

    setActiveTool("line");
    isDrawingLineRef.current = true;
    isDrawingArrowRef.current = false;
    startPointRef.current = null;
    toast.info("Cliquez pour le point de départ, puis pour le point d'arrivée");
  };

  const addText = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    setActiveTool("text");

    const text = new Textbox("Texte", {
      left: 100,
      top: 100,
      fontSize: 20,
      fill: strokeColor,
      width: 200,
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    saveToHistory();

    setTimeout(() => setActiveTool("select"), 100);
  };

  const deleteSelected = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((obj) => {
        if (obj.type !== "image") {
          canvas.remove(obj);
        }
      });
      canvas.discardActiveObject();
      saveToHistory();
      canvas.renderAll();
    }
  };

  const handleSave = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !photo) return;

    setIsSaving(true);

    try {
      const annotations = canvas.toJSON();

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
      <DialogContent key={photo?.id} className="max-w-[95vw] h-[90vh] flex flex-col p-6">
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
              <Button variant={activeTool === "rectangle" ? "default" : "outline"} size="sm" onClick={addRectangle}>
                <Square className="h-4 w-4 mr-1" />
                Rectangle
              </Button>
              <Button variant={activeTool === "circle" ? "default" : "outline"} size="sm" onClick={addCircle}>
                <CircleIcon className="h-4 w-4 mr-1" />
                Cercle
              </Button>
              <Button variant={activeTool === "line" ? "default" : "outline"} size="sm" onClick={addLine}>
                <Minus className="h-4 w-4 mr-1" />
                Ligne
              </Button>
              <Button variant={activeTool === "arrow" ? "default" : "outline"} size="sm" onClick={addArrow}>
                <ArrowRight className="h-4 w-4 mr-1" />
                Flèche
              </Button>
              <Button variant={activeTool === "text" ? "default" : "outline"} size="sm" onClick={addText}>
                <Type className="h-4 w-4 mr-1" />
                Texte
              </Button>

              <Separator orientation="vertical" className="h-8" />

              <Button variant="outline" size="sm" onClick={deleteSelected}>
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer
              </Button>

              <Button variant="outline" size="sm" onClick={handleUndo} disabled={historyStep <= 0}>
                <Undo className="h-4 w-4" />
              </Button>

              <Button variant="outline" size="sm" onClick={handleRedo} disabled={historyStep >= history.length - 1}>
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

            <div
              ref={containerRef}
              className="flex-1 border rounded-lg overflow-auto bg-muted flex items-center justify-center min-h-0 relative"
            >
              {isLoadingImage && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-10">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Chargement de l'image...</p>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} />
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

            <Button onClick={handleSave} disabled={isSaving || isLoadingImage} className="w-full">
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
