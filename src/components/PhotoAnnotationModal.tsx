import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Square,
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

// Constantes pour le snapping
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
  
  // Refs pour éviter la réinitialisation
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

  // Gestion de la touche Suppr/Delete
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

  // Initialisation du canvas avec Paper.js
  useEffect(() => {
    if (!isOpen || !photo || !canvasRef.current || !containerRef.current) {
      return;
    }

    let mounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const initCanvas = async () => {
      if (!mounted || !canvasRef.current || !containerRef.current) return;

      setIsLoadingImage(true);
      console.log("Starting canvas initialization...");

      try {
        const container = containerRef.current;
        const canvasElement = canvasRef.current;

        // Setup Paper.js
        paper.setup(canvasElement);

        const containerWidth = container.clientWidth || 800;
        const containerHeight = container.clientHeight || 600;

        // Redimensionner le canvas
        paper.view.viewSize = new paper.Size(containerWidth, containerHeight);

        console.log("Canvas initialized, loading image from:", photo.url);

        // Le bucket est public, pas besoin de signed URL
        const imageUrl = photo.url;
        console.log("Loading image from URL:", imageUrl);

        // Charger l'image avec Paper.js - utiliser crossOrigin pour éviter les problèmes CORS
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
          img.onload = () => {
            console.log("Image loaded successfully via Image element");
            resolve(img);
          };
          img.onerror = (error) => {
            console.error("Error loading image via Image element:", error);
            reject(error);
          };
          img.src = imageUrl;
        });

        const loadedImg = await loadPromise;
        const raster = new paper.Raster(loadedImg);
        
        // Fonction pour initialiser le raster une fois qu'il est chargé
        const initializeRaster = () => {
          if (!mounted) {
            raster.remove();
            return;
          }

          console.log("Image loaded successfully:", {
            width: raster.width,
            height: raster.height,
          });

          // Adapter l'image au canvas
          const scale = Math.min(
            (paper.view.viewSize.width - 40) / raster.width,
            (paper.view.viewSize.height - 40) / raster.height,
            1,
          );

          raster.scale(scale);
          raster.position = paper.view.center;
          raster.locked = true; // Verrouiller l'image de fond

          backgroundRasterRef.current = raster;

          console.log("Canvas rendered with image");

          if (mounted) {
            setIsLoadingImage(false);
            saveToHistory();
          }

          // Charger les annotations sauvegardées
          if (photo.annotations && mounted) {
            try {
              console.log("Loading saved annotations");
              paper.project.importJSON(photo.annotations);
              
              // Verrouiller l'image de fond après import
              paper.project.activeLayer.children.forEach((item) => {
                if (item instanceof paper.Raster) {
                  item.locked = true;
                }
              });
              
              paper.view.update();
              console.log("Annotations loaded successfully");
            } catch (error) {
              console.error("Error loading annotations:", error);
            }
          }
        };
        
        // Si l'image est déjà chargée (loaded=true), exécuter immédiatement
        // Sinon attendre l'événement onLoad
        if (raster.loaded) {
          console.log("Image already loaded, initializing immediately");
          initializeRaster();
        } else {
          raster.onLoad = initializeRaster;
          
          raster.onError = () => {
            console.error("Error loading image in raster");
            if (mounted) {
              toast.error("Erreur lors du chargement de l'image");
              setIsLoadingImage(false);
            }
          };
        }

        // Variables pour le dessin
        let currentPath: paper.Item | null = null;
        let selectedItem: paper.Item | null = null;
        let handles: paper.Path.Circle[] = [];
        let draggedHandle: paper.Path.Circle | null = null;
        let lastClickTime = 0;
        let lastClickItem: paper.Item | null = null;

        // Fonction pour créer des poignées
        const createHandles = (item: paper.Item) => {
          // Supprimer les anciennes poignées
          handles.forEach((h) => h.remove());
          handles = [];

          if (item instanceof paper.Path && item.segments.length === 2) {
            // Poignées pour les lignes/flèches
            item.segments.forEach((segment, index) => {
              const handle = new paper.Path.Circle({
                center: segment.point,
                radius: 5,
                fillColor: item.strokeColor,
                strokeColor: new paper.Color("white"),
                strokeWidth: 2,
              });
              handle.data.isHandle = true;
              handle.data.segmentIndex = index;
              handle.data.parentPath = item;
              handle.data.handleType = "line";
              handles.push(handle);
            });
          } else if (item instanceof paper.Path || item instanceof paper.Shape) {
            // Poignées pour les rectangles et cercles
            const bounds = item.bounds;
            const corners = [bounds.topLeft, bounds.topRight, bounds.bottomRight, bounds.bottomLeft];

            corners.forEach((corner, index) => {
              const handle = new paper.Path.Circle({
                center: corner,
                radius: 6,
                fillColor: new paper.Color("#2196F3"),
                strokeColor: new paper.Color("white"),
                strokeWidth: 2,
              });
              handle.data.isHandle = true;
              handle.data.cornerIndex = index;
              handle.data.parentItem = item;
              handle.data.handleType = "corner";
              handles.push(handle);
            });
          }
        };

        // Fonction pour mettre à jour les poignées
        const updateHandles = (item: paper.Item) => {
          if (item instanceof paper.Path && item.segments.length === 2 && handles.length === 2) {
            // Poignées de ligne
            handles[0].position = item.segments[0].point;
            handles[1].position = item.segments[1].point;
          } else if (handles.length === 4 && (item instanceof paper.Path || item instanceof paper.Shape)) {
            // Poignées de rectangle/cercle
            const bounds = item.bounds;
            handles[0].position = bounds.topLeft;
            handles[1].position = bounds.topRight;
            handles[2].position = bounds.bottomRight;
            handles[3].position = bounds.bottomLeft;
          }
        };

        // Fonction pour supprimer les poignées
        const removeHandles = () => {
          handles.forEach((h) => h.remove());
          handles = [];
        };

        // Fonction pour snapper horizontal/vertical
        const snapToHV = (from: paper.Point, to: paper.Point): paper.Point => {
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);

          if (angle < SNAP_ANGLE_THRESHOLD || angle > 180 - SNAP_ANGLE_THRESHOLD) {
            return new paper.Point(to.x, from.y);
          }
          if (Math.abs(angle - 90) < SNAP_ANGLE_THRESHOLD) {
            return new paper.Point(from.x, to.y);
          }
          return to;
        };

        // Fonction pour créer une tête de flèche
        const createArrowHead = (path: paper.Path): paper.Path => {
          if (path.segments.length < 2) return path;

          const lastPoint = path.segments[1].point;
          const firstPoint = path.segments[0].point;
          const vector = lastPoint.subtract(firstPoint);
          const angle = vector.angle;
          const headLength = 15;

          const arrowHead = new paper.Path([
            lastPoint.add(new paper.Point({ angle: angle + 150, length: headLength })),
            lastPoint,
            lastPoint.add(new paper.Point({ angle: angle - 150, length: headLength })),
          ]);

          arrowHead.strokeColor = path.strokeColor;
          arrowHead.strokeWidth = path.strokeWidth;
          arrowHead.fillColor = path.strokeColor;
          arrowHead.closed = true;
          arrowHead.data.isArrowHead = true;
          arrowHead.data.parentId = path.id;

          return arrowHead;
        };

        // Fonction pour mettre à jour la tête de flèche
        const updateArrowHead = (path: paper.Path) => {
          if (path.segments.length < 2) return;

          // Trouver et supprimer l'ancienne tête
          paper.project.activeLayer.children.forEach((item) => {
            if (item.data.isArrowHead && item.data.parentId === path.id) {
              item.remove();
            }
          });

          // Créer une nouvelle tête
          createArrowHead(path);
        };

        // Créer le tool
        const tool = new paper.Tool();

        tool.onMouseDown = (event: paper.ToolEvent) => {
          console.log("Mouse down", activeToolRef.current, event.point);

          // Vérifier si on clique sur une poignée
          const hitHandle = handles.find((h) => h.contains(event.point));
          if (hitHandle) {
            draggedHandle = hitHandle;
            return;
          }

          // Vérifier si on clique sur un objet
          const hitResult = paper.project.activeLayer.hitTest(event.point, {
            fill: true,
            stroke: true,
            tolerance: 5,
          });

          // Détecter le double-clic manuellement
          const currentTime = Date.now();
          const isDoubleClick = hitResult && lastClickItem === hitResult.item && currentTime - lastClickTime < 300;

          lastClickTime = currentTime;
          lastClickItem = hitResult?.item || null;

          // Double-clic sur un texte = édition
          if (isDoubleClick && hitResult && hitResult.item instanceof paper.PointText) {
            const textItem = hitResult.item;
            const canvasRect = canvasRef.current?.getBoundingClientRect();
            if (canvasRect) {
              setTextInputPosition({ x: textItem.point.x, y: textItem.point.y });
              setEditingTextItem(textItem);
              setIsEditingText(true);

              setTimeout(() => {
                if (textInputRef.current) {
                  textInputRef.current.value = textItem.content;
                  textInputRef.current.focus();
                  textInputRef.current.select();
                }
              }, 0);
            }
            return;
          }

          if (activeToolRef.current === "select") {
            // Désélectionner l'ancien
            if (selectedItem) {
              selectedItem.selected = false;
            }
            removeHandles();

            // Sélectionner le nouveau (sauf les poignées, têtes de flèches et image de fond)
            if (hitResult && !hitResult.item.data.isHandle && !hitResult.item.data.isArrowHead && !hitResult.item.locked) {
              selectedItem = hitResult.item;
              selectedItem.selected = true;

              // Créer des poignées pour les lignes/flèches
              if (selectedItem instanceof paper.Path && selectedItem.segments.length === 2) {
                createHandles(selectedItem);
              }
              // Créer des poignées pour les rectangles et cercles
              else if (selectedItem instanceof paper.Path || selectedItem instanceof paper.Shape) {
                createHandles(selectedItem);
              }
            } else {
              selectedItem = null;
            }
          } else if (activeToolRef.current === "text") {
            // Mode texte : créer un input temporaire
            const canvasRect = canvasRef.current?.getBoundingClientRect();
            if (canvasRect) {
              setTextInputPosition({ x: event.point.x, y: event.point.y });
              setEditingTextItem(null);
              setIsEditingText(true);

              setTimeout(() => {
                textInputRef.current?.focus();
              }, 0);
            }
          } else if (activeToolRef.current === "line" || activeToolRef.current === "arrow") {
            currentPath = new paper.Path({
              segments: [event.point, event.point],
              strokeColor: new paper.Color(strokeColorRef.current),
              strokeWidth: strokeWidthRef.current,
              strokeCap: "round",
            });
            currentPath.data.type = activeToolRef.current;
            console.log("Created path", currentPath);
          } else if (activeToolRef.current === "draw") {
            const path = new paper.Path({
              strokeColor: new paper.Color(strokeColorRef.current),
              strokeWidth: strokeWidthRef.current,
              strokeCap: "round",
              strokeJoin: "round",
            });
            path.add(event.point);
            currentPath = path;
          } else if (activeToolRef.current === "rectangle") {
            currentPath = new paper.Path.Rectangle({
              from: event.point,
              to: event.point,
              strokeColor: new paper.Color(strokeColorRef.current),
              strokeWidth: strokeWidthRef.current,
              fillColor: null, // Pas de remplissage, seulement le contour
            });
          } else if (activeToolRef.current === "circle") {
            currentPath = new paper.Shape.Circle({
              center: event.point,
              radius: 1,
              strokeColor: new paper.Color(strokeColorRef.current),
              strokeWidth: strokeWidthRef.current,
              fillColor: null, // Pas de remplissage, seulement le contour
            });
            currentPath.data.startPoint = event.point;
          }
        };

        tool.onMouseDrag = (event: paper.ToolEvent) => {
          // Déplacer une poignée
          if (draggedHandle) {
            if (draggedHandle.data.handleType === "line" && draggedHandle.data.parentPath) {
              // Poignée de ligne/flèche
              const path = draggedHandle.data.parentPath as paper.Path;
              const index = draggedHandle.data.segmentIndex;

              let newPoint = event.point;

              // Snapping horizontal/vertical
              if (!event.modifiers.shift) {
                const otherIndex = index === 0 ? 1 : 0;
                newPoint = snapToHV(path.segments[otherIndex].point, newPoint);
              }

              path.segments[index].point = newPoint;

              // Mettre à jour la tête de flèche si nécessaire
              if (path.data.type === "arrow") {
                updateArrowHead(path);
              }

              updateHandles(path);
            } else if (draggedHandle.data.handleType === "corner" && draggedHandle.data.parentItem) {
              // Poignée de rectangle/cercle
              const item = draggedHandle.data.parentItem;
              const cornerIndex = draggedHandle.data.cornerIndex;
              const bounds = item.bounds;

              // Calculer les nouvelles dimensions selon le coin déplacé
              let newBounds;
              if (cornerIndex === 0) {
                newBounds = new paper.Rectangle(event.point, bounds.bottomRight);
              } else if (cornerIndex === 1) {
                newBounds = new paper.Rectangle(
                  new paper.Point(bounds.left, event.point.y),
                  new paper.Point(event.point.x, bounds.bottom),
                );
              } else if (cornerIndex === 2) {
                newBounds = new paper.Rectangle(bounds.topLeft, event.point);
              } else {
                newBounds = new paper.Rectangle(
                  new paper.Point(event.point.x, bounds.top),
                  new paper.Point(bounds.right, event.point.y),
                );
              }

              // Appliquer les nouvelles dimensions
              if (item instanceof paper.Shape.Circle) {
                const width = Math.abs(newBounds.width);
                const height = Math.abs(newBounds.height);
                const size = Math.max(width, height);
                const squareBounds = new paper.Rectangle(
                  newBounds.center.subtract(new paper.Point(size / 2, size / 2)),
                  new paper.Size(size, size),
                );
                item.bounds = squareBounds;
              } else {
                item.bounds = newBounds;
              }

              updateHandles(item);
            }
            return;
          }

          // Dessiner
          if (currentPath) {
            if (activeToolRef.current === "draw" && currentPath instanceof paper.Path) {
              currentPath.add(event.point);
            } else if ((activeToolRef.current === "line" || activeToolRef.current === "arrow") && currentPath instanceof paper.Path) {
              let newPoint = event.point;

              // Snapping
              if (!event.modifiers.shift) {
                newPoint = snapToHV(currentPath.segments[0].point, newPoint);
              }

              currentPath.segments[1].point = newPoint;
            } else if (activeToolRef.current === "rectangle" && currentPath instanceof paper.Path) {
              const rect = currentPath as paper.Path;
              const start = rect.segments[0].point;
              const bounds = new paper.Rectangle(start, event.point);
              rect.bounds = bounds;
            } else if (activeToolRef.current === "circle" && currentPath instanceof paper.Shape.Circle) {
              const startPoint = currentPath.data.startPoint;
              const radius = startPoint.getDistance(event.point);
              currentPath.radius = radius;
            }
          }

          // Déplacer un objet sélectionné
          if (selectedItem && activeToolRef.current === "select" && !draggedHandle) {
            selectedItem.position = selectedItem.position.add(event.delta);

            // Mettre à jour la tête de flèche si c'est une flèche
            if (selectedItem instanceof paper.Path && selectedItem.data.type === "arrow") {
              updateArrowHead(selectedItem);
            }

            updateHandles(selectedItem);
          }
        };

        tool.onMouseUp = (event: paper.ToolEvent) => {
          console.log("Mouse up", currentPath);

          draggedHandle = null;

          if (currentPath) {
            if (activeToolRef.current === "draw" && currentPath instanceof paper.Path) {
              currentPath.simplify(10);
            } else if (activeToolRef.current === "arrow" && currentPath instanceof paper.Path) {
              createArrowHead(currentPath);
            }

            // Sélectionner le path créé
            if (selectedItem) {
              selectedItem.selected = false;
            }
            removeHandles();

            selectedItem = currentPath;
            selectedItem.selected = true;

            if (selectedItem instanceof paper.Path && selectedItem.segments.length === 2) {
              createHandles(selectedItem);
            }

            currentPath = null;
            saveToHistory();

            console.log("Active layer children:", paper.project.activeLayer.children.length);
          }
        };

      } catch (error) {
        console.error("Failed to initialize canvas:", error);
        if (mounted) {
          toast.error("Impossible de charger l'image");
          setIsLoadingImage(false);
        }
      }
    };

    timeoutId = setTimeout(initCanvas, 50);

    return () => {
      mounted = false;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Nettoyer paper.js complètement
      if (paper.project) {
        const allLayers = paper.project.layers.slice();
        allLayers.forEach(layer => layer.remove());
        paper.project.clear();
      }
      
      if (paper.view) {
        paper.view.remove();
      }
    };
  }, [isOpen, photo]);

  const saveToHistory = () => {
    if (!paper.project) return;
    
    const json = paper.project.exportJSON();
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyStep + 1);
      newHistory.push(json);
      return newHistory;
    });
    setHistoryStep((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      paper.project.clear();
      paper.project.importJSON(history[newStep]);
      paper.view.update();
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
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
        // Supprimer aussi les têtes de flèches associées
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
      // Exporter les annotations
      const annotationsJSON = paper.project.exportJSON();

      // Sauvegarder les annotations et le commentaire
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

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-8 w-8 p-0"
              title="Supprimer (Suppr)"
            >
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
