import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Square, ArrowRight, Save, Pencil, Type, CircleIcon, Minus, Trash2, Undo, Redo } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import paper from "paper";

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

const SNAP_ANGLE_THRESHOLD = 15;

const PhotoAnnotationModal = ({ photo, isOpen, onClose, onSave }: PhotoAnnotationModalProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [activeTool, setActiveTool] = useState<"select" | "draw" | "rectangle" | "arrow" | "circle" | "line" | "text">(
    "select",
  );
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const [strokeColor, setStrokeColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [isEditingText, setIsEditingText] = useState(false);
  const [textInputPosition, setTextInputPosition] = useState({ x: 0, y: 0 });
  const [editingTextItem, setEditingTextItem] = useState<paper.PointText | null>(null);

  const activeToolRef = useRef(activeTool);
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);
  const backgroundRasterRef = useRef<paper.Raster | null>(null);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    strokeColorRef.current = strokeColor;
  }, [strokeColor]);

  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);

  useEffect(() => {
    if (photo) {
      setComment(photo.comment || "");
    }
  }, [photo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && !isEditingText) {
        e.preventDefault();
        handleDelete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditingText]);

  // Initialisation Canvas avec Paper.js
  useEffect(() => {
    if (!isOpen || !photo || !canvasRef.current || !containerRef.current) {
      return;
    }

    let mounted = true;

    const initCanvas = async () => {
      if (!mounted || !canvasRef.current || !containerRef.current) return;

      setIsLoadingImage(true);

      try {
        const container = containerRef.current;
        const canvasElement = canvasRef.current;

        // Nettoyer Paper.js avant setup
        try {
          if (paper.project) paper.project.remove();
          if (paper.view) paper.view.remove();
        } catch (e) {
          // Ignore les erreurs de nettoyage
        }

        // Setup Paper.js
        paper.setup(canvasElement);

        const containerWidth = container.clientWidth || 800;
        const containerHeight = container.clientHeight || 600;

        paper.view.viewSize = new paper.Size(containerWidth, containerHeight);

        // Charger l'image via Image element puis Paper.js Raster
        const img = new Image();
        img.crossOrigin = "anonymous";

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = photo.url;
        });

        if (!mounted) return;

        // Créer le raster avec l'image chargée
        const raster = new paper.Raster(img);

        // Attendre que le raster soit prêt
        await new Promise<void>((resolve) => {
          if (raster.loaded) {
            resolve();
          } else {
            raster.onLoad = () => resolve();
          }
        });

        if (!mounted) return;

        // Adapter l'image au canvas
        const scale = Math.min(
          (paper.view.viewSize.width - 40) / raster.width,
          (paper.view.viewSize.height - 40) / raster.height,
          1,
        );

        raster.scale(scale);
        raster.position = paper.view.center;
        raster.locked = true;

        backgroundRasterRef.current = raster;
        paper.view.update();

        if (mounted) {
          setIsLoadingImage(false);
          saveToHistory();
        }

        // Charger les annotations
        if (photo.annotations && mounted) {
          try {
            paper.project.importJSON(photo.annotations);
            paper.project.activeLayer.children.forEach((item) => {
              if (item instanceof paper.Raster) {
                item.locked = true;
              }
            });
            paper.view.update();
          } catch (error) {
            console.error("Error loading annotations:", error);
          }
        }

        // Setup des event handlers pour le dessin
        setupDrawingHandlers();
      } catch (error) {
        console.error("Error initializing canvas:", error);
        if (mounted) {
          toast.error("Erreur lors du chargement de l'image");
          setIsLoadingImage(false);
        }
      }
    };

    const setupDrawingHandlers = () => {
      let currentPath: paper.Path | null = null;
      let selectedItem: paper.Item | null = null;

      const tool = new paper.Tool();

      tool.onMouseDown = (event: paper.ToolEvent) => {
        const tool = activeToolRef.current;

        if (tool === "select") {
          const hitResult = paper.project.hitTest(event.point, {
            segments: true,
            stroke: true,
            fill: true,
            tolerance: 5,
          });

          if (hitResult && !hitResult.item.locked) {
            if (selectedItem) selectedItem.selected = false;
            selectedItem = hitResult.item;
            selectedItem.selected = true;
          } else {
            if (selectedItem) selectedItem.selected = false;
            selectedItem = null;
          }
        } else if (tool === "draw") {
          currentPath = new paper.Path({
            strokeColor: new paper.Color(strokeColorRef.current),
            strokeWidth: strokeWidthRef.current,
            strokeCap: "round",
            strokeJoin: "round",
          });
          currentPath.add(event.point);
        } else if (tool === "line" || tool === "arrow") {
          currentPath = new paper.Path({
            strokeColor: new paper.Color(strokeColorRef.current),
            strokeWidth: strokeWidthRef.current,
            strokeCap: "round",
          });
          currentPath.add(event.point);
          currentPath.data.type = tool;
        } else if (tool === "rectangle") {
          currentPath = new paper.Path.Rectangle({
            from: event.point,
            to: event.point,
            strokeColor: new paper.Color(strokeColorRef.current),
            strokeWidth: strokeWidthRef.current,
          });
        } else if (tool === "circle") {
          currentPath = new paper.Path.Circle({
            center: event.point,
            radius: 1,
            strokeColor: new paper.Color(strokeColorRef.current),
            strokeWidth: strokeWidthRef.current,
          });
          currentPath.data.startPoint = event.point;
        } else if (tool === "text") {
          setTextInputPosition({ x: event.point.x, y: event.point.y });
          setIsEditingText(true);
        }
      };

      tool.onMouseDrag = (event: paper.ToolEvent) => {
        const tool = activeToolRef.current;

        if (tool === "draw" && currentPath) {
          currentPath.add(event.point);
        } else if (tool === "line" || tool === "arrow") {
          if (currentPath && currentPath.segments.length === 2) {
            currentPath.segments[1].point = event.point;
          } else if (currentPath) {
            currentPath.add(event.point);
          }
        } else if (tool === "rectangle" && currentPath) {
          currentPath.remove();
          currentPath = new paper.Path.Rectangle({
            from: event.downPoint,
            to: event.point,
            strokeColor: new paper.Color(strokeColorRef.current),
            strokeWidth: strokeWidthRef.current,
          });
        } else if (tool === "circle" && currentPath) {
          const radius = event.point.getDistance(currentPath.data.startPoint);
          currentPath.remove();
          currentPath = new paper.Path.Circle({
            center: currentPath.data.startPoint,
            radius: radius,
            strokeColor: new paper.Color(strokeColorRef.current),
            strokeWidth: strokeWidthRef.current,
          });
          currentPath.data.startPoint = event.downPoint;
        } else if (tool === "select" && selectedItem && !selectedItem.locked) {
          selectedItem.position = selectedItem.position.add(event.delta);
        }
      };

      tool.onMouseUp = (event: paper.ToolEvent) => {
        const tool = activeToolRef.current;

        if (tool === "arrow" && currentPath) {
          const vector = currentPath.lastSegment.point.subtract(currentPath.firstSegment.point);
          const arrowVector = vector.normalize(10);

          const arrowHead = new paper.Path([
            currentPath.lastSegment.point.add(arrowVector.rotate(150)),
            currentPath.lastSegment.point,
            currentPath.lastSegment.point.add(arrowVector.rotate(-150)),
          ]);
          arrowHead.strokeColor = currentPath.strokeColor;
          arrowHead.strokeWidth = currentPath.strokeWidth;
          arrowHead.strokeCap = "round";
          arrowHead.data.isArrowHead = true;
          arrowHead.data.parentId = currentPath.id;
        }

        if (currentPath) {
          saveToHistory();
        }
        currentPath = null;
      };
    };

    initCanvas();

    return () => {
      mounted = false;
      try {
        if (paper.project) paper.project.remove();
        if (paper.view) paper.view.remove();
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [isOpen, photo]);

  const saveToHistory = () => {
    if (!paper.project) return;
    const json = paper.project.exportJSON();
    setHistory((prev) => [...prev.slice(0, historyStep + 1), json]);
    setHistoryStep((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (historyStep > 0 && paper.project) {
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      paper.project.clear();
      paper.project.importJSON(history[newStep]);
      paper.view.update();
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1 && paper.project) {
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      paper.project.clear();
      paper.project.importJSON(history[newStep]);
      paper.view.update();
    }
  };

  const handleTextSubmit = () => {
    if (!textInputRef.current || !paper.project) return;

    const text = textInputRef.current.value.trim();

    if (text) {
      if (editingTextItem) {
        editingTextItem.content = text;
      } else {
        new paper.PointText({
          point: [textInputPosition.x, textInputPosition.y],
          content: text,
          fillColor: new paper.Color(strokeColorRef.current),
          fontSize: 20,
        });
      }
      saveToHistory();
    } else if (editingTextItem && !text) {
      editingTextItem.remove();
      saveToHistory();
    }

    setIsEditingText(false);
    setEditingTextItem(null);
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleTextSubmit();
    } else if (e.key === "Escape") {
      setIsEditingText(false);
      setEditingTextItem(null);
    }
  };

  const handleDelete = () => {
    if (!paper.project) return;

    const selectedItems = paper.project.activeLayer.children.filter((item) => item.selected && !item.locked);

    if (selectedItems.length > 0) {
      selectedItems.forEach((item) => {
        if (item instanceof paper.Path && item.data.type === "arrow") {
          paper.project.activeLayer.children.forEach((child) => {
            if (child.data.isArrowHead && child.data.parentId === item.id) {
              child.remove();
            }
          });
        }
        item.remove();
      });
      saveToHistory();
      toast.success("Élément supprimé");
    }
  };

  const handleSave = async () => {
    if (!photo || !paper.project) return;

    setIsSaving(true);

    try {
      const annotationsJSON = paper.project.exportJSON();

      const { error } = await supabase
        .from("project_photos")
        .update({
          annotations: annotationsJSON,
          comment: comment.trim() || null,
        })
        .eq("id", photo.id);

      if (error) throw error;

      toast.success("Annotations sauvegardées");
      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving annotations:", error);
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
              />
              <input
                type="range"
                min="1"
                max="10"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-24"
                title={`Épaisseur: ${strokeWidth}px`}
              />
            </div>

            <Separator orientation="vertical" className="h-8" />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={historyStep <= 0}
              className="h-8 w-8 p-0"
              title="Annuler"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={historyStep >= history.length - 1}
              className="h-8 w-8 p-0"
              title="Rétablir"
            >
              <Redo className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-8" />

            <Button variant="ghost" size="sm" onClick={handleDelete} className="h-8 w-8 p-0" title="Supprimer (Suppr)">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Canvas Container */}
          <div ref={containerRef} className="flex-1 relative bg-muted rounded-lg overflow-hidden min-h-[500px]">
            {isLoadingImage && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted/50">
                <div className="text-muted-foreground">Chargement...</div>
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ cursor: activeTool === "select" ? "default" : "crosshair" }}
            />
            {isEditingText && (
              <input
                ref={textInputRef}
                type="text"
                className="absolute border-2 border-primary bg-background px-2 py-1 rounded"
                style={{
                  left: `${textInputPosition.x}px`,
                  top: `${textInputPosition.y}px`,
                }}
                onBlur={handleTextSubmit}
                onKeyDown={handleTextKeyDown}
                autoFocus
              />
            )}
          </div>

          {/* Comment Section */}
          <div className="space-y-2">
            <Label htmlFor="comment">Commentaire</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ajoutez un commentaire sur cette photo..."
              className="resize-none"
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Annuler
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
