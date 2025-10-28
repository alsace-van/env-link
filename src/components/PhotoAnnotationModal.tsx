import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Square, ArrowRight, Save, Pencil, Type, CircleIcon, Minus, Trash2, Undo, Redo } from "lucide-react";
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

/**
 * VERSION HYBRIDE - Affiche l'image directement, Paper.js optionnel
 */
const PhotoAnnotationModal = ({ photo, isOpen, onClose, onSave }: PhotoAnnotationModalProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [activeTool, setActiveTool] = useState<"select" | "draw" | "rectangle" | "arrow" | "circle" | "line" | "text">(
    "select",
  );
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [paperInitialized, setPaperInitialized] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [isEditingText, setIsEditingText] = useState(false);
  const [textInputPosition, setTextInputPosition] = useState({ x: 0, y: 0 });

  const activeToolRef = useRef(activeTool);
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);

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
      setImageLoaded(false);
      setPaperInitialized(false);
    }
  }, [photo]);

  // Initialiser Paper.js seulement après que l'image soit chargée
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imageRef.current || paperInitialized) {
      return;
    }

    const initPaper = async () => {
      try {
        const paper = await import("paper");
        const canvasElement = canvasRef.current;
        const img = imageRef.current;

        if (!canvasElement || !img) return;

        // Nettoyer avant setup
        try {
          if (paper.project) paper.project.remove();
          if (paper.view) paper.view.remove();
        } catch (e) {}

        // Setup Paper.js
        paper.setup(canvasElement);

        // Obtenir les dimensions du conteneur
        const rect = canvasElement.getBoundingClientRect();
        paper.view.viewSize = new paper.Size(rect.width, rect.height);

        // Créer le raster depuis l'image déjà chargée
        const raster = new paper.Raster(img);

        // Attendre que le raster soit prêt
        if (!raster.loaded) {
          await new Promise<void>((resolve) => {
            raster.onLoad = () => resolve();
          });
        }

        // Adapter au canvas
        const scale = Math.min(
          (paper.view.viewSize.width - 40) / raster.width,
          (paper.view.viewSize.height - 40) / raster.height,
          1,
        );

        raster.scale(scale);
        raster.position = paper.view.center;
        raster.locked = true;

        paper.view.update();

        // Sauvegarder l'état initial
        saveToHistory(paper);

        // Charger les annotations si présentes
        if (photo?.annotations) {
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

        // Setup des event handlers
        setupDrawingHandlers(paper);

        setPaperInitialized(true);
        console.log("✅ Paper.js initialized successfully");
      } catch (error) {
        console.error("❌ Error initializing Paper.js:", error);
        toast.error("Les outils d'annotation ne sont pas disponibles");
      }
    };

    initPaper();
  }, [imageLoaded, paperInitialized, photo]);

  const setupDrawingHandlers = (paper: any) => {
    let currentPath: any = null;
    let selectedItem: any = null;

    const tool = new paper.Tool();

    tool.onMouseDown = (event: any) => {
      const toolType = activeToolRef.current;

      if (toolType === "select") {
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
      } else if (toolType === "draw") {
        currentPath = new paper.Path({
          strokeColor: new paper.Color(strokeColorRef.current),
          strokeWidth: strokeWidthRef.current,
          strokeCap: "round",
          strokeJoin: "round",
        });
        currentPath.add(event.point);
      } else if (toolType === "line" || toolType === "arrow") {
        currentPath = new paper.Path({
          strokeColor: new paper.Color(strokeColorRef.current),
          strokeWidth: strokeWidthRef.current,
          strokeCap: "round",
        });
        currentPath.add(event.point);
        currentPath.data.type = toolType;
      } else if (toolType === "rectangle") {
        currentPath = new paper.Path.Rectangle({
          from: event.point,
          to: event.point,
          strokeColor: new paper.Color(strokeColorRef.current),
          strokeWidth: strokeWidthRef.current,
        });
      } else if (toolType === "circle") {
        currentPath = new paper.Path.Circle({
          center: event.point,
          radius: 1,
          strokeColor: new paper.Color(strokeColorRef.current),
          strokeWidth: strokeWidthRef.current,
        });
        currentPath.data.startPoint = event.point;
      } else if (toolType === "text") {
        setTextInputPosition({ x: event.point.x, y: event.point.y });
        setIsEditingText(true);
      }
    };

    tool.onMouseDrag = (event: any) => {
      const toolType = activeToolRef.current;

      if (toolType === "draw" && currentPath) {
        currentPath.add(event.point);
      } else if (toolType === "line" || toolType === "arrow") {
        if (currentPath && currentPath.segments.length === 2) {
          currentPath.segments[1].point = event.point;
        } else if (currentPath) {
          currentPath.add(event.point);
        }
      } else if (toolType === "rectangle" && currentPath) {
        currentPath.remove();
        currentPath = new paper.Path.Rectangle({
          from: event.downPoint,
          to: event.point,
          strokeColor: new paper.Color(strokeColorRef.current),
          strokeWidth: strokeWidthRef.current,
        });
      } else if (toolType === "circle" && currentPath) {
        const radius = event.point.getDistance(currentPath.data.startPoint);
        currentPath.remove();
        currentPath = new paper.Path.Circle({
          center: currentPath.data.startPoint,
          radius: radius,
          strokeColor: new paper.Color(strokeColorRef.current),
          strokeWidth: strokeWidthRef.current,
        });
        currentPath.data.startPoint = event.downPoint;
      } else if (toolType === "select" && selectedItem && !selectedItem.locked) {
        selectedItem.position = selectedItem.position.add(event.delta);
      }
    };

    tool.onMouseUp = (event: any) => {
      const toolType = activeToolRef.current;

      if (toolType === "arrow" && currentPath) {
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
        saveToHistory(paper);
      }
      currentPath = null;
    };
  };

  const saveToHistory = async (paperInstance?: any) => {
    try {
      const paper = paperInstance || (await import("paper"));
      if (!paper.project) return;
      const json = paper.project.exportJSON();
      setHistory((prev) => [...prev.slice(0, historyStep + 1), json]);
      setHistoryStep((prev) => prev + 1);
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  };

  const handleUndo = async () => {
    if (historyStep <= 0) return;
    try {
      const paper = await import("paper");
      if (!paper.project) return;
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      paper.project.clear();
      paper.project.importJSON(history[newStep]);
      paper.view.update();
    } catch (error) {
      console.error("Error undoing:", error);
    }
  };

  const handleRedo = async () => {
    if (historyStep >= history.length - 1) return;
    try {
      const paper = await import("paper");
      if (!paper.project) return;
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      paper.project.clear();
      paper.project.importJSON(history[newStep]);
      paper.view.update();
    } catch (error) {
      console.error("Error redoing:", error);
    }
  };

  const handleTextSubmit = async () => {
    if (!textInputRef.current) return;

    const text = textInputRef.current.value.trim();

    if (text) {
      try {
        const paper = await import("paper");
        new paper.PointText({
          point: [textInputPosition.x, textInputPosition.y],
          content: text,
          fillColor: new paper.Color(strokeColorRef.current),
          fontSize: 20,
        });
        saveToHistory(paper);
      } catch (error) {
        console.error("Error adding text:", error);
      }
    }

    setIsEditingText(false);
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleTextSubmit();
    } else if (e.key === "Escape") {
      setIsEditingText(false);
    }
  };

  const handleDelete = async () => {
    try {
      const paper = await import("paper");
      if (!paper.project) return;

      const selectedItems = paper.project.activeLayer.children.filter((item: any) => item.selected && !item.locked);

      if (selectedItems.length > 0) {
        selectedItems.forEach((item: any) => {
          if (item instanceof paper.Path && item.data.type === "arrow") {
            paper.project.activeLayer.children.forEach((child: any) => {
              if (child.data.isArrowHead && child.data.parentId === item.id) {
                child.remove();
              }
            });
          }
          item.remove();
        });
        saveToHistory(paper);
        toast.success("Élément supprimé");
      }
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  const handleSave = async () => {
    if (!photo) return;

    setIsSaving(true);

    try {
      let annotationsJSON = null;

      if (paperInitialized) {
        const paper = await import("paper");
        if (paper.project) {
          annotationsJSON = paper.project.exportJSON();
        }
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
          <DialogTitle>Photo - {photo.description || photo.id}</DialogTitle>
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
                  disabled={!paperInitialized}
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
                disabled={!paperInitialized}
              />
              <input
                type="range"
                min="1"
                max="10"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-24"
                title={`Épaisseur: ${strokeWidth}px`}
                disabled={!paperInitialized}
              />
            </div>

            <Separator orientation="vertical" className="h-8" />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={historyStep <= 0 || !paperInitialized}
              className="h-8 w-8 p-0"
              title="Annuler"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={historyStep >= history.length - 1 || !paperInitialized}
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
              disabled={!paperInitialized}
            >
              <Trash2 className="h-4 w-4" />
            </Button>

            {!paperInitialized && imageLoaded && (
              <span className="text-xs text-muted-foreground ml-2">Chargement des outils...</span>
            )}
          </div>

          {/* Image Container */}
          <div ref={containerRef} className="flex-1 relative bg-muted rounded-lg overflow-hidden min-h-[500px]">
            {/* Image de base - toujours visible */}
            <img
              ref={imageRef}
              src={photo.url}
              alt={photo.description || "Photo"}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ display: paperInitialized ? "none" : "block" }}
              onLoad={() => {
                console.log("✅ Image loaded");
                setIsLoadingImage(false);
                setImageLoaded(true);
              }}
              onError={(e) => {
                console.error("❌ Image error:", e);
                toast.error("Erreur de chargement de l'image");
                setIsLoadingImage(false);
              }}
            />

            {/* Canvas Paper.js - par-dessus l'image */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{
                display: paperInitialized ? "block" : "none",
                cursor: activeTool === "select" ? "default" : "crosshair",
              }}
            />

            {isLoadingImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                <div className="text-muted-foreground">Chargement...</div>
              </div>
            )}

            {isEditingText && (
              <input
                ref={textInputRef}
                type="text"
                className="absolute border-2 border-primary bg-background px-2 py-1 rounded z-10"
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
