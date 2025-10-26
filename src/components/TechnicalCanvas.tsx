import { useEffect, useRef, useState } from "react";
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
import paper from "paper";

interface TechnicalCanvasProps {
  projectId: string;
  onExpenseAdded?: () => void;
}

// Constantes pour le snapping
const SNAP_ANGLE_THRESHOLD = 15;
const SNAP_DISTANCE = 10;

export const TechnicalCanvas = ({ projectId, onExpenseAdded }: TechnicalCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [activeTool, setActiveTool] = useState<"select" | "draw" | "rectangle" | "circle" | "text" | "line" | "arrow">(
    "select",
  );
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isEditingText, setIsEditingText] = useState(false);
  const [textInputPosition, setTextInputPosition] = useState({ x: 0, y: 0 });
  const [editingTextItem, setEditingTextItem] = useState<paper.PointText | null>(null);

  // Refs pour éviter la réinitialisation du canvas
  const activeToolRef = useRef(activeTool);
  const colorRef = useRef(color);
  const strokeWidthRef = useRef(strokeWidth);

  // Mettre à jour les refs quand les états changent
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);

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

  useEffect(() => {
    if (!canvasRef.current) return;

    // Setup Paper.js - IMPORTANT: ne pas utiliser new PaperScope()
    paper.setup(canvasRef.current);

    console.log("Paper.js initialized", paper.project);

    // Variables pour le dessin
    let currentPath: paper.Path | null = null;
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
            fillColor: item.strokeColor, // Utiliser la couleur de la ligne
            strokeColor: "white",
            strokeWidth: 2,
          });
          handle.data.isHandle = true;
          handle.data.segmentIndex = index;
          handle.data.parentPath = item;
          handle.data.handleType = "line";
          handles.push(handle);
        });
      } else if (item instanceof paper.Path || item instanceof paper.Shape) {
        // Poignées pour les rectangles et cercles (4 coins + 4 bords)
        const bounds = item.bounds;
        const corners = [bounds.topLeft, bounds.topRight, bounds.bottomRight, bounds.bottomLeft];

        corners.forEach((corner, index) => {
          const handle = new paper.Path.Circle({
            center: corner,
            radius: 6,
            fillColor: "#2196F3",
            strokeColor: "white",
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
      const isDoubleClick = hitResult && lastClickItem === hitResult.item && currentTime - lastClickTime < 300; // 300ms pour le double-clic

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

          // Focus sur l'input au prochain render
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

        // Sélectionner le nouveau (sauf les poignées et têtes de flèches)
        if (hitResult && !hitResult.item.data.isHandle && !hitResult.item.data.isArrowHead) {
          // Si l'élément fait partie d'un groupe, sélectionner le groupe entier
          if (hitResult.item.parent instanceof paper.Group && hitResult.item.parent.data.isAccessory) {
            selectedItem = hitResult.item.parent;
          } else {
            selectedItem = hitResult.item;
          }

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

          // Focus sur l'input au prochain render
          setTimeout(() => {
            textInputRef.current?.focus();
          }, 0);
        }
      } else if (activeToolRef.current === "line" || activeToolRef.current === "arrow") {
        currentPath = new paper.Path({
          segments: [event.point, event.point],
          strokeColor: colorRef.current,
          strokeWidth: strokeWidthRef.current,
          strokeCap: "round",
        });
        currentPath.data.type = activeToolRef.current;
        console.log("Created path", currentPath);
      } else if (activeToolRef.current === "draw") {
        currentPath = new paper.Path({
          strokeColor: colorRef.current,
          strokeWidth: strokeWidthRef.current,
          strokeCap: "round",
          strokeJoin: "round",
        });
        currentPath.add(event.point);
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
            // Top Left
            newBounds = new paper.Rectangle(event.point, bounds.bottomRight);
          } else if (cornerIndex === 1) {
            // Top Right
            newBounds = new paper.Rectangle(
              new paper.Point(bounds.left, event.point.y),
              new paper.Point(event.point.x, bounds.bottom),
            );
          } else if (cornerIndex === 2) {
            // Bottom Right
            newBounds = new paper.Rectangle(bounds.topLeft, event.point);
          } else {
            // Bottom Left
            newBounds = new paper.Rectangle(
              new paper.Point(event.point.x, bounds.top),
              new paper.Point(bounds.right, event.point.y),
            );
          }

          // Appliquer les nouvelles dimensions
          if (item instanceof paper.Shape.Circle) {
            // Pour un cercle, garder le ratio et utiliser le plus grand côté
            const width = Math.abs(newBounds.width);
            const height = Math.abs(newBounds.height);
            const size = Math.max(width, height);
            const squareBounds = new paper.Rectangle(
              newBounds.center.subtract(new paper.Point(size / 2, size / 2)),
              new paper.Size(size, size),
            );
            item.bounds = squareBounds;
          } else {
            // Pour un rectangle
            item.bounds = newBounds;
          }

          updateHandles(item);
        }
        return;
      }

      // Dessiner
      if (currentPath) {
        if (activeToolRef.current === "draw") {
          currentPath.add(event.point);
        } else if (activeToolRef.current === "line" || activeToolRef.current === "arrow") {
          let newPoint = event.point;

          // Snapping
          if (!event.modifiers.shift) {
            newPoint = snapToHV(currentPath.segments[0].point, newPoint);
          }

          currentPath.segments[1].point = newPoint;
        }
      }

      // Déplacer un objet sélectionné
      if (selectedItem && activeToolRef.current === "select" && !draggedHandle) {
        selectedItem.position = selectedItem.position.add(event.delta);

        // Mettre à jour la tête de flèche si c'est une flèche (uniquement pour les Path)
        if (selectedItem instanceof paper.Path && selectedItem.data.type === "arrow") {
          updateArrowHead(selectedItem);
        }

        // Mettre à jour les handles pour tous les types d'objets
        updateHandles(selectedItem);
      }
    };

    tool.onMouseUp = (event: paper.ToolEvent) => {
      console.log("Mouse up", currentPath);

      draggedHandle = null;

      if (currentPath) {
        if (activeToolRef.current === "draw") {
          currentPath.simplify(10);
        } else if (activeToolRef.current === "arrow") {
          createArrowHead(currentPath);
        }

        // Sélectionner le path créé
        if (selectedItem) {
          selectedItem.selected = false;
        }
        removeHandles();

        selectedItem = currentPath;
        selectedItem.selected = true;

        if (selectedItem.segments.length === 2) {
          createHandles(selectedItem);
        }

        currentPath = null;

        console.log("Active layer children:", paper.project.activeLayer.children.length);
      }
    };

    // Cleanup
    return () => {
      tool.remove();
    };
  }, []); // ✅ Tableau vide = ne s'exécute qu'une seule fois au montage

  const handleTextSubmit = () => {
    if (!textInputRef.current || !paper.project) return;

    const text = textInputRef.current.value.trim();

    if (text) {
      if (editingTextItem) {
        // Modifier le texte existant
        editingTextItem.content = text;
      } else {
        // Créer un nouveau texte
        new paper.PointText({
          point: [textInputPosition.x, textInputPosition.y],
          content: text,
          fillColor: colorRef.current,
          fontSize: 20,
        });
      }
    } else if (editingTextItem && !text) {
      // Si le texte est vide lors de l'édition, supprimer l'élément
      editingTextItem.remove();
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

    // Trouver l'élément sélectionné
    let itemToDelete: paper.Item | null = null;

    paper.project.activeLayer.children.forEach((item) => {
      if (item.selected && !item.data.isHandle) {
        itemToDelete = item;
      }
    });

    if (itemToDelete) {
      // Si c'est une flèche, supprimer aussi sa tête
      if (itemToDelete.data.type === "arrow") {
        paper.project.activeLayer.children.forEach((item) => {
          if (item.data.isArrowHead && item.data.parentId === itemToDelete.id) {
            item.remove();
          }
        });
      }

      // Si c'est un groupe (comme un accessoire), supprimer tout le groupe
      if (itemToDelete instanceof paper.Group) {
        itemToDelete.removeChildren();
      }

      // Supprimer l'élément
      itemToDelete.remove();

      // Supprimer les poignées
      paper.project.activeLayer.children.forEach((item) => {
        if (item.data.isHandle) {
          item.remove();
        }
      });

      toast.success("Élément supprimé");
    } else {
      toast.info("Aucun élément sélectionné");
    }
  };

  const handleUndo = () => {
    console.log("Undo");
  };

  const handleRedo = () => {
    console.log("Redo");
  };

  const handleClear = () => {
    if (!paper.project) return;
    paper.project.activeLayer.removeChildren();
    toast.success("Canevas effacé");
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const dataURL = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = `schema-technique-${Date.now()}.png`;
    link.click();
    toast.success("Schéma téléchargé");
  };

  const handleToolClick = (tool: typeof activeTool) => {
    setActiveTool(tool);

    if (tool === "rectangle" && paper.project) {
      new paper.Shape.Rectangle({
        point: [100, 100],
        size: [150, 100],
        strokeColor: colorRef.current,
        strokeWidth: strokeWidthRef.current,
      });
    } else if (tool === "circle" && paper.project) {
      new paper.Shape.Circle({
        center: [150, 150],
        radius: 50,
        strokeColor: colorRef.current,
        strokeWidth: strokeWidthRef.current,
      });
    }
    // Note: le texte est maintenant créé via un clic sur le canvas
  };

  const handleSelectAccessory = (accessory: any, source: "expense" | "catalog") => {
    if (!paper.project) return;

    const name = accessory.nom_accessoire || accessory.nom || "Accessoire";
    const details = [accessory.marque, accessory.categorie || accessory.categories?.nom, accessory.type_electrique]
      .filter(Boolean)
      .join(" | ");

    // Créer le texte
    const text = new paper.PointText({
      point: [100, 100],
      content: `📦 ${name}\n${details}`,
      fillColor: colorRef.current,
      fontSize: 14,
    });

    // Créer le cadre qui entoure le texte
    const background = new paper.Path.Rectangle({
      rectangle: text.bounds.expand(8),
      fillColor: "white",
      strokeColor: colorRef.current,
      strokeWidth: 1,
    });

    // Créer un groupe avec le cadre d'abord, puis le texte (ordre important pour le z-index)
    const group = new paper.Group([background, text]);

    // Marquer le groupe comme un accessoire pour le déplacement unifié
    group.data.isAccessory = true;
    group.data.accessoryName = name;

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
          onClick={() => setActiveTool("line")}
          title="Ligne (se snape automatiquement à l'horizontal/vertical, maintenez Shift pour désactiver)"
        >
          <Minus className="h-4 w-4 mr-2" />
          Ligne
        </Button>
        <Button
          variant={activeTool === "arrow" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTool("arrow")}
          title="Flèche (se snape automatiquement à l'horizontal/vertical, maintenez Shift pour désactiver)"
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

        <Button variant="outline" size="sm" onClick={handleUndo} disabled={true}>
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleRedo} disabled={true}>
          <Redo className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete} title="Supprimer l'élément sélectionné (Suppr)">
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

      {(activeTool === "line" || activeTool === "arrow") && (
        <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <strong>💡 Aide :</strong> Les traits se positionnent automatiquement à l'horizontal ou à la vertical.
          <strong> Maintenez Shift</strong> pour désactiver temporairement le snapping.
        </div>
      )}

      {activeTool === "text" && (
        <div className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
          <strong>💡 Aide :</strong> Cliquez sur le canvas pour ajouter du texte. Pour modifier un texte : passez en
          mode <strong>Sélection</strong> puis double-cliquez sur le texte.
        </div>
      )}

      <div ref={containerRef} className="border border-border rounded-lg overflow-hidden shadow-lg bg-white relative">
        {isEditingText && (
          <input
            ref={textInputRef}
            type="text"
            className="absolute z-10 px-2 py-1 border-2 border-blue-500 rounded bg-white text-black"
            style={{
              left: `${textInputPosition.x}px`,
              top: `${textInputPosition.y}px`,
              fontSize: "20px",
              minWidth: "200px",
            }}
            onKeyDown={handleTextKeyDown}
            onBlur={handleTextSubmit}
            autoFocus
          />
        )}
        <canvas ref={canvasRef} width={1200} height={800} style={{ display: "block" }} />
      </div>
    </div>
  );
};
