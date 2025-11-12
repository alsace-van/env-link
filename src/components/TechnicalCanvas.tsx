import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AccessorySelector } from "./AccessorySelector";
import paper from "paper";
import { supabase } from "@/integrations/supabase/client";

interface TechnicalCanvasProps {
  projectId: string;
  onExpenseAdded?: () => void;
}

interface CanvasInstanceProps {
  projectId: string;
  schemaNumber: number;
  onExpenseAdded?: () => void;
  onSchemaDeleted?: () => void;
}

// Constantes pour le snapping
const SNAP_ANGLE_THRESHOLD = 15;
const SNAP_DISTANCE = 10;

const CanvasInstance = ({ projectId, schemaNumber, onExpenseAdded, onSchemaDeleted }: CanvasInstanceProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const paperScopeRef = useRef<paper.PaperScope | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "draw" | "rectangle" | "circle" | "text" | "line" | "arrow">(
    "select",
  );
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isEditingText, setIsEditingText] = useState(false);
  const [textInputPosition, setTextInputPosition] = useState({ x: 0, y: 0 });
  const [editingTextItem, setEditingTextItem] = useState<any | null>(null);
  const [schemaId, setSchemaId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });

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

  // Ajuster la taille du canvas à la taille de l'écran
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = Math.min(window.innerHeight - 300, containerWidth * 0.6); // Ratio 16:10 max
        setCanvasSize({
          width: Math.max(800, containerWidth - 32), // Min 800px, -32px pour le padding
          height: Math.max(500, containerHeight)
        });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Créer un PaperScope unique pour ce canvas
    const scope = new paper.PaperScope();
    scope.setup(canvasRef.current);
    paperScopeRef.current = scope;

    // Redimensionner le view pour correspondre au canvas
    scope.view.viewSize = new scope.Size(canvasSize.width, canvasSize.height);

    console.log("Paper.js initialized", scope.project, "Schema:", schemaNumber);

    // Charger les dessins depuis la base de données
    const loadDrawings = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("technical_schemas")
          .select("*")
          .eq("project_id", projectId)
          .eq("schema_number", schemaNumber)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setSchemaId((data as any).id);
          if ((data as any).canvas_data) {
            scope.project.activeLayer.importJSON((data as any).canvas_data);
            scope.view.update();
            console.log("Dessins chargés pour schéma", schemaNumber);
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement des dessins:", error);
      }
    };

    loadDrawings();

    // Variables pour le dessin
    let currentPath: any = null;
    let selectedItem: any = null;
    let handles: any[] = [];
    let draggedHandle: any = null;
    let lastClickTime = 0;
    let lastClickItem: any = null;

    // Fonction pour créer des poignées
    const createHandles = (item: any) => {
      // Supprimer les anciennes poignées
      handles.forEach((h) => h.remove());
      handles = [];

      if (item instanceof scope.Path && item.segments.length === 2) {
        // Poignées pour les lignes/flèches
        item.segments.forEach((segment: any, index: number) => {
          const handle = new scope.Path.Circle({
            center: segment.point,
            radius: 8, // Augmenté de 5 à 8 pour une meilleure prise
            fillColor: item.strokeColor,
            strokeColor: "white",
            strokeWidth: 3, // Augmenté pour plus de visibilité
          });
          handle.data.isHandle = true;
          handle.data.segmentIndex = index;
          handle.data.parentPath = item;
          handle.data.handleType = "line";
          handles.push(handle);
        });
      } else if (item instanceof scope.Path || item instanceof scope.Shape) {
        // Poignées pour les rectangles et cercles (4 coins + 4 bords)
        const bounds = item.bounds;
        const corners = [bounds.topLeft, bounds.topRight, bounds.bottomRight, bounds.bottomLeft];

        corners.forEach((corner: any, index: number) => {
          const handle = new scope.Path.Circle({
            center: corner,
            radius: 10, // Augmenté de 6 à 10 pour une meilleure prise
            fillColor: "#2196F3",
            strokeColor: "white",
            strokeWidth: 3, // Augmenté pour plus de visibilité
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
    const updateHandles = (item: any) => {
      if (item instanceof scope.Path && item.segments.length === 2 && handles.length === 2) {
        // Poignées de ligne
        handles[0].position = item.segments[0].point;
        handles[1].position = item.segments[1].point;
      } else if (handles.length === 4 && (item instanceof scope.Path || item instanceof scope.Shape)) {
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
    const snapToHV = (from: any, to: any): any => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);

      if (angle < SNAP_ANGLE_THRESHOLD || angle > 180 - SNAP_ANGLE_THRESHOLD) {
        return new scope.Point(to.x, from.y);
      }
      if (Math.abs(angle - 90) < SNAP_ANGLE_THRESHOLD) {
        return new scope.Point(from.x, to.y);
      }
      return to;
    };

    // Fonction pour créer une tête de flèche
    const createArrowHead = (path: any): any => {
      if (path.segments.length < 2) return path;

      const lastPoint = path.segments[1].point;
      const firstPoint = path.segments[0].point;
      const vector = lastPoint.subtract(firstPoint);
      const angle = vector.angle;
      const headLength = 15;

      const arrowHead = new scope.Path([
        lastPoint.add(new scope.Point({ angle: angle + 150, length: headLength })),
        lastPoint,
        lastPoint.add(new scope.Point({ angle: angle - 150, length: headLength })),
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
    const updateArrowHead = (path: any) => {
      if (path.segments.length < 2) return;

      // Trouver et supprimer l'ancienne tête
      scope.project.activeLayer.children.forEach((item: any) => {
        if (item.data.isArrowHead && item.data.parentId === path.id) {
          item.remove();
        }
      });

      // Créer une nouvelle tête
      createArrowHead(path);
    };

    // Créer le tool
    const tool = new scope.Tool();

    tool.onMouseDown = (event: any) => {
      console.log("Mouse down", activeToolRef.current, event.point);

      // Vérifier si on clique sur une poignée avec une tolérance élargie
      const hitHandle = handles.find((h) => {
        const distance = h.position.getDistance(event.point);
        return distance <= 15; // Tolérance de 15 pixels pour faciliter la saisie
      });
      if (hitHandle) {
        draggedHandle = hitHandle;
        return;
      }

      // Vérifier si on clique sur un objet
      const hitResult = scope.project.activeLayer.hitTest(event.point, {
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
      if (isDoubleClick && hitResult && hitResult.item instanceof scope.PointText) {
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
          if (hitResult.item.parent instanceof scope.Group && hitResult.item.parent.data.isAccessory) {
            selectedItem = hitResult.item.parent;
          } else {
            selectedItem = hitResult.item;
          }

          selectedItem.selected = true;

          // Créer des poignées pour les lignes/flèches
          if (selectedItem instanceof scope.Path && selectedItem.segments.length === 2) {
            createHandles(selectedItem);
          }
          // Créer des poignées pour les rectangles et cercles
          else if (selectedItem instanceof scope.Path || selectedItem instanceof scope.Shape) {
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
        currentPath = new scope.Path({
          segments: [event.point, event.point],
          strokeColor: colorRef.current,
          strokeWidth: strokeWidthRef.current,
          strokeCap: "round",
        });
        currentPath.data.type = activeToolRef.current;
        console.log("Created path", currentPath);
      } else if (activeToolRef.current === "draw") {
        currentPath = new scope.Path({
          strokeColor: colorRef.current,
          strokeWidth: strokeWidthRef.current,
          strokeCap: "round",
          strokeJoin: "round",
        });
        currentPath.add(event.point);
      }
    };

    tool.onMouseDrag = (event: any) => {
      // Déplacer une poignée
      if (draggedHandle) {
        if (draggedHandle.data.handleType === "line" && draggedHandle.data.parentPath) {
          // Poignée de ligne/flèche
          const path = draggedHandle.data.parentPath;
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
            newBounds = new scope.Rectangle(event.point, bounds.bottomRight);
          } else if (cornerIndex === 1) {
            // Top Right
            newBounds = new scope.Rectangle(
              new scope.Point(bounds.left, event.point.y),
              new scope.Point(event.point.x, bounds.bottom),
            );
          } else if (cornerIndex === 2) {
            // Bottom Right
            newBounds = new scope.Rectangle(bounds.topLeft, event.point);
          } else {
            // Bottom Left
            newBounds = new scope.Rectangle(
              new scope.Point(event.point.x, bounds.top),
              new scope.Point(bounds.right, event.point.y),
            );
          }

          // Appliquer les nouvelles dimensions
          if (item instanceof scope.Shape.Circle) {
            // Pour un cercle, garder le ratio et utiliser le plus grand côté
            const width = Math.abs(newBounds.width);
            const height = Math.abs(newBounds.height);
            const size = Math.max(width, height);
            const squareBounds = new scope.Rectangle(
              newBounds.center.subtract(new scope.Point(size / 2, size / 2)),
              new scope.Size(size, size),
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
        if (selectedItem instanceof scope.Path && selectedItem.data.type === "arrow") {
          updateArrowHead(selectedItem);
        }

        // Mettre à jour les handles pour tous les types d'objets
        updateHandles(selectedItem);
      }
    };

    tool.onMouseUp = (event: any) => {
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

        if (selectedItem instanceof scope.Path && selectedItem.segments.length === 2) {
          createHandles(selectedItem);
        }

        currentPath = null;

        console.log("Active layer children:", scope.project.activeLayer.children.length);
        
        // Forcer le rendu du canvas
        scope.view.update();
      }
    };

    // Cleanup
    return () => {
      tool.remove();
    };
  }, [projectId, schemaNumber, canvasSize]); // Ajouter canvasSize pour recréer le canvas quand la taille change

  const handleTextSubmit = () => {
    if (!textInputRef.current || !paperScopeRef.current) return;
    
    const scope = paperScopeRef.current;

    const text = textInputRef.current.value.trim();

    if (text) {
      if (editingTextItem) {
        // Modifier le texte existant
        editingTextItem.content = text;
      } else {
        // Créer un nouveau texte
        new scope.PointText({
          point: [textInputPosition.x, textInputPosition.y],
          content: text,
          fillColor: colorRef.current,
          fontSize: 20,
        });
      }
      scope.view.update();
    } else if (editingTextItem && !text) {
      // Si le texte est vide lors de l'édition, supprimer l'élément
      editingTextItem.remove();
      scope.view.update();
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
    if (!paperScopeRef.current) return;
    
    const scope = paperScopeRef.current;

    // Trouver l'élément sélectionné
    let itemToDelete: any = null;

    scope.project.activeLayer.children.forEach((item: any) => {
      if (item.selected && !item.data.isHandle) {
        itemToDelete = item;
      }
    });

    if (itemToDelete) {
      // Si c'est une flèche, supprimer aussi sa tête
      if (itemToDelete.data.type === "arrow") {
        scope.project.activeLayer.children.forEach((item: any) => {
          if (item.data.isArrowHead && item.data.parentId === itemToDelete.id) {
            item.remove();
          }
        });
      }

      // Si c'est un groupe (comme un accessoire), supprimer tout le groupe
      if (itemToDelete instanceof scope.Group) {
        itemToDelete.removeChildren();
      }

      // Supprimer l'élément
      itemToDelete.remove();

      // Supprimer les poignées
      scope.project.activeLayer.children.forEach((item: any) => {
        if (item.data.isHandle) {
          item.remove();
        }
      });

      scope.view.update();
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
    if (!paperScopeRef.current) return;
    const scope = paperScopeRef.current;
    scope.project.activeLayer.removeChildren();
    scope.view.update();
    toast.success("Canevas effacé");
  };

  const handleSave = async () => {
    if (!paperScopeRef.current) return;
    
    const scope = paperScopeRef.current;

    try {
      const json = scope.project.activeLayer.exportJSON();

      if (schemaId) {
        // Update existing schema
        const { error } = await (supabase as any)
          .from("technical_schemas")
          .update({ canvas_data: json })
          .eq("id", schemaId);

        if (error) throw error;
      } else {
        // Create new schema
        const { data, error } = await (supabase as any)
          .from("technical_schemas")
          .insert({
            project_id: projectId,
            schema_number: schemaNumber,
            canvas_data: json,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setSchemaId((data as any).id);
      }

      toast.success("Schéma sauvegardé");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const dataURL = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = `schema-technique-${schemaNumber}-${Date.now()}.png`;
    link.click();
    toast.success("Schéma téléchargé");
  };

  const handleToolClick = (tool: typeof activeTool) => {
    setActiveTool(tool);

    if (!paperScopeRef.current) return;
    const scope = paperScopeRef.current;

    if (tool === "rectangle") {
      new scope.Shape.Rectangle({
        point: [100, 100],
        size: [150, 100],
        strokeColor: colorRef.current,
        strokeWidth: strokeWidthRef.current,
      });
      scope.view.update();
    } else if (tool === "circle") {
      new scope.Shape.Circle({
        center: [150, 150],
        radius: 50,
        strokeColor: colorRef.current,
        strokeWidth: strokeWidthRef.current,
      });
      scope.view.update();
    }
    // Note: le texte est maintenant créé via un clic sur le canvas
  };

  const handleSelectAccessory = (accessory: any, source: "expense" | "catalog") => {
    if (!paperScopeRef.current) return;
    
    const scope = paperScopeRef.current;

    const name = accessory.nom_accessoire || accessory.nom || "Accessoire";
    const details = [accessory.marque, accessory.categorie || accessory.categories?.nom, accessory.type_electrique]
      .filter(Boolean)
      .join(" | ");

    // Créer le texte
    const text = new scope.PointText({
      point: [100, 100],
      content: `📦 ${name}\n${details}`,
      fillColor: colorRef.current,
      fontSize: 14,
    });

    // Créer le cadre qui entoure le texte
    const background = new scope.Path.Rectangle({
      rectangle: text.bounds.expand(8),
      fillColor: "white",
      strokeColor: colorRef.current,
      strokeWidth: 1,
    });

    // Créer un groupe avec le cadre d'abord, puis le texte (ordre important pour le z-index)
    const group = new scope.Group([background, text]);

    // Marquer le groupe comme un accessoire pour le déplacement unifié
    group.data.isAccessory = true;
    group.data.accessoryName = name;

    scope.view.update();
    toast.success(`${name} ajouté au schéma`);
  };

  return (
    <div className="space-y-4" key={`canvas-${schemaNumber}`}>
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

        <Button variant="default" size="sm" onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Sauvegarder
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
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
        <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} className="w-full" style={{ display: "block" }} />
      </div>
    </div>
  );
};

export const TechnicalCanvas = ({ projectId, onExpenseAdded }: TechnicalCanvasProps) => {
  const [schemas, setSchemas] = useState<number[]>([1]);
  const [activeTab, setActiveTab] = useState("canvas1");
  const [isLoading, setIsLoading] = useState(true);

  // Charger les schémas existants
  useEffect(() => {
    const loadSchemas = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("technical_schemas")
          .select("schema_number")
          .eq("project_id", projectId)
          .order("schema_number");

        if (error) throw error;

        if (data && data.length > 0) {
          const schemaNumbers = (data as any).map((s: any) => s.schema_number);
          setSchemas(schemaNumbers);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des schémas:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSchemas();
  }, [projectId]);

  const handleAddCanvas = () => {
    const nextNumber = Math.max(...schemas) + 1;
    setSchemas(prev => [...prev, nextNumber]);
    setActiveTab(`canvas${nextNumber}`);
    toast.success(`Schéma ${nextNumber} ajouté`);
  };

  const handleRemoveCanvas = async (schemaNumber: number) => {
    if (schemaNumber === 1 && schemas.length === 1) {
      toast.error("Impossible de supprimer le dernier schéma");
      return;
    }

    try {
      const result: any = supabase
        .from("technical_schemas")
        .delete()
        .eq("project_id", projectId)
        .eq("schema_number", schemaNumber);
      await result;

      setSchemas(prev => prev.filter(s => s !== schemaNumber));
      
      // Revenir au premier schéma si on supprime le schéma actif
      if (activeTab === `canvas${schemaNumber}`) {
        const remainingSchemas = schemas.filter(s => s !== schemaNumber);
        setActiveTab(`canvas${remainingSchemas[0]}`);
      }
      
      toast.success(`Schéma ${schemaNumber} supprimé`);
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression du schéma");
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Chargement des schémas...</div>;
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center gap-2 mb-4">
          <TabsList className="flex-1">
            {schemas.map((schemaNum) => (
              <div key={schemaNum} className="relative inline-flex items-center">
                <TabsTrigger value={`canvas${schemaNum}`} className="pr-8">
                  Schéma {schemaNum}
                </TabsTrigger>
                {schemas.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 h-5 w-5 p-0 hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCanvas(schemaNum);
                    }}
                  >
                    <X className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </TabsList>
          <Button onClick={handleAddCanvas} size="sm" variant="outline">
            + Ajouter un schéma
          </Button>
        </div>
        {schemas.map((schemaNum) => (
          <TabsContent key={schemaNum} value={`canvas${schemaNum}`}>
            <CanvasInstance 
              projectId={projectId} 
              schemaNumber={schemaNum}
              onExpenseAdded={onExpenseAdded}
              onSchemaDeleted={() => handleRemoveCanvas(schemaNum)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
