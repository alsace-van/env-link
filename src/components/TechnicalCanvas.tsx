import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
const SNAP_ANGLE_THRESHOLD = 15; // Degrés pour snapper à l'horizontal/vertical
const SNAP_DISTANCE = 10; // Pixels pour le magnétisme des poignées

export const TechnicalCanvas = ({ projectId, onExpenseAdded }: TechnicalCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scopeRef = useRef<paper.PaperScope | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "draw" | "rectangle" | "circle" | "text" | "line" | "arrow">(
    "select",
  );
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  const currentPathRef = useRef<paper.Path | null>(null);
  const handlesLayerRef = useRef<paper.Layer | null>(null);
  const selectedItemRef = useRef<paper.Item | null>(null);

  // Fonction pour snapper à l'horizontal ou vertical
  const snapToHorizontalOrVertical = (from: paper.Point, to: paper.Point): paper.Point => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);

    // Snapper à l'horizontal (0° ou 180°)
    if (angle < SNAP_ANGLE_THRESHOLD || angle > 180 - SNAP_ANGLE_THRESHOLD) {
      return new paper.Point(to.x, from.y);
    }

    // Snapper à la vertical (90°)
    if (Math.abs(angle - 90) < SNAP_ANGLE_THRESHOLD) {
      return new paper.Point(from.x, to.y);
    }

    return to;
  };

  // Fonction pour trouver les points de snapping magnétique
  const findSnapPoint = (point: paper.Point, excludeItem?: paper.Item): { point: paper.Point; snapped: boolean } => {
    if (!scopeRef.current) return { point, snapped: false };

    let closestPoint = point;
    let minDistance = Infinity;

    // Chercher dans la couche principale (pas dans la couche des poignées)
    scopeRef.current.project.layers[0].children.forEach((item) => {
      if (item === excludeItem || item.data.isArrowHead) return;

      const points: paper.Point[] = [];

      if (item instanceof paper.Path && !item.closed) {
        // Pour les lignes et flèches - utiliser les extrémités
        if (item.segments.length >= 2) {
          points.push(item.segments[0].point);
          points.push(item.segments[item.segments.length - 1].point);
        }
      } else if (item.bounds) {
        // Pour les autres objets (rectangles, cercles) - utiliser les coins
        points.push(item.bounds.topLeft, item.bounds.topRight, item.bounds.bottomLeft, item.bounds.bottomRight);
      }

      points.forEach((p) => {
        const distance = point.getDistance(p);
        if (distance < minDistance && distance < SNAP_DISTANCE) {
          minDistance = distance;
          closestPoint = p;
        }
      });
    });

    return { point: closestPoint, snapped: minDistance < SNAP_DISTANCE };
  };

  // Fonction pour créer/mettre à jour toutes les poignées
  const updateAllHandles = () => {
    if (!scopeRef.current || !handlesLayerRef.current) return;

    // Effacer toutes les poignées existantes
    handlesLayerRef.current.removeChildren();

    // Si rien n'est sélectionné, ne rien faire
    if (!selectedItemRef.current) return;

    const item = selectedItemRef.current;

    // Créer des poignées seulement pour les lignes et flèches
    if (item instanceof paper.Path && !item.closed && item.segments.length === 2) {
      item.segments.forEach((segment, index) => {
        const handle = new paper.Path.Circle({
          center: segment.point,
          radius: 5,
          fillColor: index === 0 ? "#2196F3" : "#FF5722",
          strokeColor: "white",
          strokeWidth: 2,
        });

        handle.data = {
          isHandle: true,
          segmentIndex: index,
          parentPath: item,
        };

        handlesLayerRef.current?.addChild(handle);
      });
    }
  };

  // Fonction pour mettre à jour la tête de flèche
  const updateArrowHead = (path: paper.Path) => {
    if (!scopeRef.current || path.segments.length < 2) return;

    // Trouver la tête de flèche existante
    let arrowHead: paper.Path | null = null;
    scopeRef.current.project.layers[0].children.forEach((item) => {
      if (item.data.isArrowHead && item.data.parentId === path.id) {
        arrowHead = item as paper.Path;
      }
    });

    const lastSegment = path.segments[path.segments.length - 1];
    const secondLastSegment = path.segments[path.segments.length - 2];
    const vector = lastSegment.point.subtract(secondLastSegment.point);
    const angle = vector.angle;
    const headLength = 15;

    if (!arrowHead) {
      // Créer une nouvelle tête de flèche
      arrowHead = new paper.Path([
        lastSegment.point.add(new paper.Point({ angle: angle + 150, length: headLength })),
        lastSegment.point,
        lastSegment.point.add(new paper.Point({ angle: angle - 150, length: headLength })),
      ]);

      arrowHead.strokeColor = path.strokeColor;
      arrowHead.strokeWidth = path.strokeWidth;
      arrowHead.fillColor = path.strokeColor;
      arrowHead.strokeCap = "round";
      arrowHead.strokeJoin = "round";
      arrowHead.data = { isArrowHead: true, parentId: path.id };
    } else {
      // Mettre à jour la tête existante
      arrowHead.segments[0].point = lastSegment.point.add(new paper.Point({ angle: angle + 150, length: headLength }));
      arrowHead.segments[1].point = lastSegment.point;
      arrowHead.segments[2].point = lastSegment.point.add(new paper.Point({ angle: angle - 150, length: headLength }));
    }
  };

  // Initialize canvas
  useLayoutEffect(() => {
    setIsCanvasReady(false);
    const timer = setTimeout(() => {
      setIsCanvasReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isCanvasReady || !canvasRef.current) return;

    // Setup Paper.js
    const scope = new paper.PaperScope();
    scope.setup(canvasRef.current);
    scopeRef.current = scope;

    // Set canvas size
    scope.view.viewSize = new paper.Size(1200, 800);

    // Créer une couche séparée pour les poignées
    const handlesLayer = new paper.Layer();
    handlesLayerRef.current = handlesLayer;

    // Revenir à la couche principale
    scope.project.layers[0].activate();

    // Create tool
    const tool = new paper.Tool();

    let draggedHandle: any = null;
    let draggedItem: paper.Item | null = null;

    tool.onMouseDown = (event: paper.ToolEvent) => {
      // Vérifier d'abord si on clique sur une poignée
      const handleHit = handlesLayer.hitTest(event.point, {
        fill: true,
        tolerance: 5,
      });

      if (handleHit?.item?.data?.isHandle) {
        draggedHandle = handleHit.item;
        return;
      }

      // Sinon, tester la couche principale
      const hitResult = scope.project.layers[0].hitTest(event.point, {
        segments: false,
        stroke: true,
        fill: true,
        tolerance: 5,
      });

      if (activeTool === "select") {
        // Désélectionner l'élément précédent
        if (selectedItemRef.current) {
          selectedItemRef.current.selected = false;
        }

        // Ignorer les têtes de flèches
        if (hitResult && hitResult.item && !hitResult.item.data.isArrowHead) {
          selectedItemRef.current = hitResult.item;
          selectedItemRef.current.selected = true;
          draggedItem = selectedItemRef.current;
        } else {
          selectedItemRef.current = null;
          draggedItem = null;
        }

        updateAllHandles();
      } else if (activeTool === "draw") {
        currentPathRef.current = new paper.Path({
          strokeColor: color,
          strokeWidth: strokeWidth,
          strokeCap: "round",
          strokeJoin: "round",
        });
        currentPathRef.current.add(event.point);
      } else if (activeTool === "line" || activeTool === "arrow") {
        const snapped = findSnapPoint(event.point);
        const startPoint = snapped.snapped ? snapped.point : event.point;

        currentPathRef.current = new paper.Path.Line({
          from: startPoint,
          to: startPoint,
          strokeColor: color,
          strokeWidth: strokeWidth,
          strokeCap: "round",
          data: { type: activeTool },
        });
      }
    };

    tool.onMouseDrag = (event: paper.ToolEvent) => {
      // Déplacer une poignée
      if (draggedHandle) {
        const parentPath = draggedHandle.data.parentPath as paper.Path;
        const segmentIndex = draggedHandle.data.segmentIndex;

        if (parentPath && parentPath.segments[segmentIndex]) {
          let newPoint = event.point;

          // Appliquer le snapping magnétique
          if (!event.modifiers.shift) {
            const snapped = findSnapPoint(event.point, parentPath);
            if (snapped.snapped) {
              newPoint = snapped.point;
            } else {
              // Snapping horizontal/vertical
              const otherIndex = segmentIndex === 0 ? 1 : 0;
              if (parentPath.segments[otherIndex]) {
                newPoint = snapToHorizontalOrVertical(parentPath.segments[otherIndex].point, newPoint);
              }
            }
          }

          // Mettre à jour le point du segment
          parentPath.segments[segmentIndex].point = newPoint;

          // Mettre à jour la flèche si c'est une flèche
          if (parentPath.data.type === "arrow") {
            updateArrowHead(parentPath);
          }

          // Mettre à jour les poignées
          updateAllHandles();
        }
        return;
      }

      // Dessiner à main levée
      if (activeTool === "draw" && currentPathRef.current) {
        currentPathRef.current.add(event.point);
      }
      // Dessiner ligne/flèche
      else if ((activeTool === "line" || activeTool === "arrow") && currentPathRef.current) {
        const from = currentPathRef.current.segments[0].point;
        let to = event.point;

        // Appliquer le snapping magnétique
        if (!event.modifiers.shift) {
          const snapped = findSnapPoint(to, currentPathRef.current);
          if (snapped.snapped) {
            to = snapped.point;
          } else {
            to = snapToHorizontalOrVertical(from, to);
          }
        }

        currentPathRef.current.segments[1].point = to;
      }
      // Déplacer un objet
      else if (draggedItem && activeTool === "select") {
        draggedItem.position = draggedItem.position.add(event.delta);

        // Si c'est une ligne/flèche, mettre à jour la tête de flèche
        if (draggedItem instanceof paper.Path && draggedItem.data.type === "arrow") {
          updateArrowHead(draggedItem);
        }

        updateAllHandles();
      }
    };

    tool.onMouseUp = (event: paper.ToolEvent) => {
      draggedHandle = null;
      draggedItem = null;

      if (activeTool === "draw" && currentPathRef.current) {
        currentPathRef.current.simplify(10);
        currentPathRef.current = null;
        saveToHistory();
      } else if (activeTool === "line" && currentPathRef.current) {
        currentPathRef.current = null;
        updateAllHandles();
        saveToHistory();
      } else if (activeTool === "arrow" && currentPathRef.current) {
        updateArrowHead(currentPathRef.current);
        currentPathRef.current = null;
        updateAllHandles();
        saveToHistory();
      } else if (draggedItem) {
        saveToHistory();
      }
    };

    const saveToHistory = () => {
      if (!scopeRef.current) return;
      // Sauvegarder uniquement la couche principale
      const json = scopeRef.current.project.layers[0].exportJSON();
      const newHistory = history.slice(0, historyStep + 1);
      newHistory.push(json);
      setHistory(newHistory);
      setHistoryStep(newHistory.length - 1);
    };

    // Sauvegarder l'état initial
    saveToHistory();

    return () => {
      tool.remove();
      scopeRef.current = null;
    };
  }, [isCanvasReady, activeTool, color, strokeWidth]);

  const handleUndo = () => {
    if (historyStep <= 0 || !scopeRef.current) return;
    const step = historyStep - 1;
    setHistoryStep(step);

    // Effacer et recharger la couche principale
    scopeRef.current.project.layers[0].removeChildren();
    scopeRef.current.project.layers[0].importJSON(history[step]);

    // Désélectionner
    selectedItemRef.current = null;
    updateAllHandles();
  };

  const handleRedo = () => {
    if (historyStep >= history.length - 1 || !scopeRef.current) return;
    const step = historyStep + 1;
    setHistoryStep(step);

    // Effacer et recharger la couche principale
    scopeRef.current.project.layers[0].removeChildren();
    scopeRef.current.project.layers[0].importJSON(history[step]);

    // Désélectionner
    selectedItemRef.current = null;
    updateAllHandles();
  };

  const handleDelete = () => {
    if (!scopeRef.current || !selectedItemRef.current) return;

    const itemToDelete = selectedItemRef.current;

    // Si c'est une ligne/flèche, supprimer aussi la tête de flèche
    if (itemToDelete instanceof paper.Path && itemToDelete.data.type === "arrow") {
      scopeRef.current.project.layers[0].children.forEach((item) => {
        if (item.data.isArrowHead && item.data.parentId === itemToDelete.id) {
          item.remove();
        }
      });
    }

    itemToDelete.remove();
    selectedItemRef.current = null;
    updateAllHandles();
    saveToHistory();
  };

  const handleToolClick = (tool: typeof activeTool) => {
    setActiveTool(tool);
    if (!scopeRef.current) return;

    if (tool === "rectangle") {
      const rect = new paper.Path.Rectangle({
        point: [100, 100],
        size: [150, 100],
        strokeColor: color,
        strokeWidth: strokeWidth,
      });
      saveToHistory();
    } else if (tool === "circle") {
      const circle = new paper.Path.Circle({
        center: [150, 150],
        radius: 50,
        strokeColor: color,
        strokeWidth: strokeWidth,
      });
      saveToHistory();
    } else if (tool === "text") {
      const text = new paper.PointText({
        point: [100, 100],
        content: "Texte",
        fillColor: color,
        fontSize: 20,
      });
      saveToHistory();
    }
  };

  const handleClear = () => {
    if (!scopeRef.current) return;
    scopeRef.current.project.layers[0].removeChildren();
    selectedItemRef.current = null;
    updateAllHandles();
    setHistory([]);
    setHistoryStep(-1);
    saveToHistory();
    toast.success("Canevas effacé");
  };

  const handleDownload = () => {
    if (!canvasRef.current || !scopeRef.current) return;

    // Cacher temporairement les poignées
    if (handlesLayerRef.current) {
      handlesLayerRef.current.visible = false;
    }

    // Exporter
    const dataURL = canvasRef.current.toDataURL("image/png");

    // Réafficher les poignées
    if (handlesLayerRef.current) {
      handlesLayerRef.current.visible = true;
    }

    const link = document.createElement("a");
    link.href = dataURL;
    link.download = `schema-technique-${Date.now()}.png`;
    link.click();
    toast.success("Schéma téléchargé");
  };

  const saveToHistory = () => {
    if (!scopeRef.current) return;
    const json = scopeRef.current.project.layers[0].exportJSON();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(json);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const handleSelectAccessory = (accessory: any, source: "expense" | "catalog") => {
    if (!scopeRef.current) return;

    const name = accessory.nom_accessoire || accessory.nom || "Accessoire";
    const details = [accessory.marque, accessory.categorie || accessory.categories?.nom, accessory.type_electrique]
      .filter(Boolean)
      .join(" | ");

    const text = new paper.PointText({
      point: [100, 100],
      content: `📦 ${name}\n${details}`,
      fillColor: color,
      fontSize: 14,
    });

    const background = new paper.Path.Rectangle({
      rectangle: text.bounds.expand(8),
      fillColor: "white",
      strokeColor: color,
      strokeWidth: 1,
    });

    const group = new paper.Group([background, text]);
    group.data = { isAccessory: true };

    toast.success(`${name} ajouté au schéma`);
    saveToHistory();
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
          onClick={() => handleToolClick("line")}
          title="Ligne (se snape automatiquement à l'horizontal/vertical, maintenez Shift pour désactiver)"
        >
          <Minus className="h-4 w-4 mr-2" />
          Ligne
        </Button>
        <Button
          variant={activeTool === "arrow" ? "default" : "outline"}
          size="sm"
          onClick={() => handleToolClick("arrow")}
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

        <Button variant="outline" size="sm" onClick={handleUndo} disabled={historyStep <= 0}>
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleRedo} disabled={historyStep >= history.length - 1}>
          <Redo className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete}>
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
          <strong>💡 Aide :</strong> Les traits se positionnent automatiquement à l'horizontal ou à la vertical. Les
          poignées s'accrochent magnétiquement aux autres éléments (distance : {SNAP_DISTANCE}px).
          <strong> Maintenez Shift</strong> pour désactiver temporairement le snapping.
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden shadow-lg bg-white">
        <canvas ref={canvasRef} style={{ width: "1200px", height: "800px" }} />
      </div>
    </div>
  );
};
