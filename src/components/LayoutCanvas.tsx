import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Square, Trash2, Undo, Redo, Download, Save, Upload, Ruler, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import paper from "paper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LayoutCanvasProps {
  projectId: string;
  vehicleLength?: number; // longueur totale en mm
  vehicleWidth?: number; // largeur totale en mm
  loadAreaLength?: number; // longueur zone de chargement en mm
  loadAreaWidth?: number; // largeur zone de chargement en mm
  maxLoad?: number; // charge utile en kg
}

interface FurnitureData {
  id: string;
  longueur_mm: number;
  largeur_mm: number;
  hauteur_mm: number;
  poids_kg: number;
  hauteur_sol_mm: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export const LayoutCanvas = ({
  projectId,
  vehicleLength = 3000,
  vehicleWidth = 1800,
  loadAreaLength: initialLoadAreaLength,
  loadAreaWidth: initialLoadAreaWidth,
  maxLoad = 500,
}: LayoutCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<"select" | "rectangle" | "measure">("select");
  const [color, setColor] = useState("#3b82f6");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [totalWeight, setTotalWeight] = useState(0);
  const [accessoriesWeight, setAccessoriesWeight] = useState(0);
  const [furnitureItems, setFurnitureItems] = useState<Map<string, FurnitureData>>(new Map());
  const [showFurnitureDialog, setShowFurnitureDialog] = useState(false);
  const [pendingRectangle, setPendingRectangle] = useState<paper.Path.Rectangle | null>(null);
  const [editingFurnitureId, setEditingFurnitureId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; furnitureId: string } | null>(null);
  const [loadAreaLength, setLoadAreaLength] = useState(initialLoadAreaLength || Math.round(vehicleLength * 0.7));
  const [loadAreaWidth, setLoadAreaWidth] = useState(initialLoadAreaWidth || Math.round(vehicleWidth * 0.9));
  const [isEditingDimensions, setIsEditingDimensions] = useState(false);
  const [furnitureForm, setFurnitureForm] = useState({
    longueur_mm: 0,
    largeur_mm: 0,
    hauteur_mm: 0,
    poids_kg: 0,
    hauteur_sol_mm: 0,
  });

  // Calcul de l'échelle pour adapter la zone de chargement au canvas (avec marge)
  const scale = Math.min((CANVAS_WIDTH - 100) / loadAreaLength, (CANVAS_HEIGHT - 100) / loadAreaWidth);

  const scaledLoadAreaLength = loadAreaLength * scale;
  const scaledLoadAreaWidth = loadAreaWidth * scale;

  const activeToolRef = useRef(activeTool);
  const colorRef = useRef(color);
  const strokeWidthRef = useRef(strokeWidth);
  const furnitureItemsRef = useRef(furnitureItems);
  const scaleRef = useRef(scale);
  const loadAreaLengthRef = useRef(loadAreaLength);
  const loadAreaWidthRef = useRef(loadAreaWidth);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);

  useEffect(() => {
    furnitureItemsRef.current = furnitureItems;
  }, [furnitureItems]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    loadAreaLengthRef.current = loadAreaLength;
    loadAreaWidthRef.current = loadAreaWidth;
  }, [loadAreaLength, loadAreaWidth]);

  // Fonction pour supprimer un meuble depuis la liste
  const handleDeleteFromList = async (furnitureId: string) => {
    console.log("🗑️ Suppression du meuble depuis la liste:", furnitureId);

    // Supprimer du state
    setFurnitureItems((prev) => {
      const newMap = new Map(prev);
      newMap.delete(furnitureId);
      return newMap;
    });

    // Supprimer du canvas Paper.js
    if (paper.project && paper.project.activeLayer) {
      paper.project.activeLayer.children.forEach((child) => {
        if (child instanceof paper.Group && child.data.furnitureId === furnitureId) {
          child.remove();
        }
      });
    }

    toast.success("Meuble supprimé");

    // Sauvegarder automatiquement
    setTimeout(() => {
      (window as any).layoutCanvasSave?.();
    }, 100);
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    // Setup Paper.js
    paper.setup(canvasRef.current);

    // Fonction pour dessiner le contour de la zone de chargement
    const drawLoadAreaOutline = () => {
      // Supprimer l'ancien rectangle s'il existe
      paper.project.activeLayer.children.forEach((child) => {
        if (child.data?.isLoadAreaOutline) {
          child.remove();
        }
      });

      const currentScale = scaleRef.current;
      const currentLength = loadAreaLengthRef.current;
      const currentWidth = loadAreaWidthRef.current;
      
      const scaledLength = currentLength * currentScale;
      const scaledWidth = currentWidth * currentScale;
      
      console.log("🔵 Dessin rectangle bleu:", {
        longueur: currentLength,
        largeur: currentWidth,
        echelle: currentScale,
        scaledLength,
        scaledWidth
      });

      const loadAreaOutline = new paper.Path.Rectangle({
        point: [(CANVAS_WIDTH - scaledLength) / 2, (CANVAS_HEIGHT - scaledWidth) / 2],
        size: [scaledLength, scaledWidth],
        strokeColor: new paper.Color("#3b82f6"),
        strokeWidth: 3,
        dashArray: [10, 5],
        locked: true,
      });
      
      loadAreaOutline.data.isLoadAreaOutline = true;
      loadAreaOutline.sendToBack();
    };

    // Dessiner le contour initial
    drawLoadAreaOutline();

    let currentPath: paper.Path.Rectangle | null = null;
    let selectedItem: paper.Item | null = null;
    let handles: paper.Path.Circle[] = [];
    let draggedHandle: paper.Path.Circle | null = null;
    let currentMeasureLine: paper.Path.Line | null = null;
    let currentMeasureText: paper.PointText | null = null;
    const history: string[] = [];
    let historyIndex = -1;
    let itemWasMoved = false; // Flag pour détecter si un meuble a été déplacé

    const saveState = () => {
      const state = paper.project.exportJSON();
      if (historyIndex < history.length - 1) {
        history.splice(historyIndex + 1);
      }
      history.push(state);
      historyIndex = history.length - 1;
    };

    const createHandles = (item: paper.Item) => {
      handles.forEach((h) => h.remove());
      handles = [];

      if (item instanceof paper.Path.Rectangle) {
        const bounds = item.bounds;
        const corners = [bounds.topLeft, bounds.topRight, bounds.bottomRight, bounds.bottomLeft];

        corners.forEach((corner, index) => {
          const handle = new paper.Path.Circle({
            center: corner,
            radius: 8,
            fillColor: new paper.Color("#ffffff"),
            strokeColor: new paper.Color("#3b82f6"),
            strokeWidth: 3,
          });
          handle.data.isHandle = true;
          handle.data.handleIndex = index;
          handles.push(handle);
        });
      }
    };

    const removeHandles = () => {
      handles.forEach((h) => h.remove());
      handles = [];
    };

    const clearSelection = () => {
      if (selectedItem && !selectedItem.data.isHandle) {
        selectedItem.selected = false;
      }
      selectedItem = null;
      removeHandles();
    };

    const clearAllMeasures = () => {
      const itemsToRemove: paper.Item[] = [];
      paper.project.activeLayer.children.forEach((child) => {
        if (child.data.isMeasure) {
          itemsToRemove.push(child);
        }
      });
      itemsToRemove.forEach((item) => item.remove());
      toast.success("Mesures effacées");
    };

    const addFurnitureLabel = (rect: paper.Path.Rectangle, furnitureId: string) => {
      const furnitureData = furnitureItemsRef.current.get(furnitureId);
      if (!furnitureData) return;

      const text = new paper.PointText({
        point: rect.bounds.center,
        content: `${furnitureData.longueur_mm}x${furnitureData.largeur_mm}x${furnitureData.hauteur_mm}mm\n${furnitureData.poids_kg}kg`,
        fillColor: new paper.Color("#000"),
        fontSize: 12,
        justification: "center",
      });
      text.data.isFurnitureLabel = true;
      text.data.furnitureId = furnitureId;

      return text;
    };

    const tool = new paper.Tool();

    tool.onMouseDown = (event: paper.ToolEvent) => {
      if (activeToolRef.current === "measure") {
        if (currentMeasureLine) {
          currentMeasureLine.remove();
          currentMeasureText?.remove();
          currentMeasureLine = null;
          currentMeasureText = null;
        }

        currentMeasureLine = new paper.Path.Line({
          from: event.point,
          to: event.point,
          strokeColor: new paper.Color("#ef4444"),
          strokeWidth: 2,
          dashArray: [5, 5],
        });
        currentMeasureLine.data.isMeasure = true;

        return;
      }

      if (activeToolRef.current === "rectangle") {
        currentPath = new paper.Path.Rectangle({
          from: event.point,
          to: event.point,
          strokeColor: new paper.Color(colorRef.current),
          strokeWidth: strokeWidthRef.current,
          fillColor: new paper.Color(colorRef.current).clone(),
        });
        currentPath.fillColor.alpha = 0.3;
        return;
      }

      if (activeToolRef.current === "select") {
        const hitResult = paper.project.hitTest(event.point, {
          fill: true,
          stroke: true,
          tolerance: 5,
        });

        if (hitResult?.item.data.isHandle) {
          draggedHandle = hitResult.item as paper.Path.Circle;
        } else if (hitResult?.item) {
          clearSelection();

          let itemToSelect = hitResult.item;
          if (hitResult.item.parent instanceof paper.Group && hitResult.item.parent.data.isFurniture) {
            itemToSelect = hitResult.item.parent;
          }

          if (!itemToSelect.locked) {
            selectedItem = itemToSelect;
            selectedItem.selected = true;
            if (selectedItem instanceof paper.Path.Rectangle || selectedItem instanceof paper.Group) {
              createHandles(selectedItem.children ? selectedItem.children[0] : selectedItem);
            }
          }
        } else {
          clearSelection();
        }
      }
    };

    tool.onMouseDrag = (event: paper.ToolEvent) => {
      if (activeToolRef.current === "measure" && currentMeasureLine) {
        currentMeasureLine.segments[1].point = event.point;

        const distance = currentMeasureLine.length / scaleRef.current;

        if (currentMeasureText) {
          currentMeasureText.remove();
        }

        const midPoint = new paper.Point(
          (currentMeasureLine.segments[0].point.x + currentMeasureLine.segments[1].point.x) / 2,
          (currentMeasureLine.segments[0].point.y + currentMeasureLine.segments[1].point.y) / 2,
        );

        currentMeasureText = new paper.PointText({
          point: midPoint.add(new paper.Point(0, -10)),
          content: `${Math.round(distance)}mm`,
          fillColor: new paper.Color("#ef4444"),
          fontSize: 14,
          fontWeight: "bold",
          justification: "center",
        });
        currentMeasureText.data.isMeasure = true;

        return;
      }

      if (activeToolRef.current === "rectangle" && currentPath) {
        const rect = new paper.Rectangle(event.downPoint, event.point);
        currentPath.remove();
        currentPath = new paper.Path.Rectangle({
          rectangle: rect,
          strokeColor: new paper.Color(colorRef.current),
          strokeWidth: strokeWidthRef.current,
          fillColor: new paper.Color(colorRef.current).clone(),
        });
        currentPath.fillColor.alpha = 0.3;
        return;
      }

      if (activeToolRef.current === "select") {
        if (draggedHandle) {
          const handleIndex = draggedHandle.data.handleIndex;
          if (selectedItem instanceof paper.Group && selectedItem.children[0] instanceof paper.Path.Rectangle) {
            const rect = selectedItem.children[0] as paper.Path.Rectangle;
            const bounds = rect.bounds;

            const newBounds = new paper.Rectangle(bounds);

            switch (handleIndex) {
              case 0:
                newBounds.topLeft = event.point;
                break;
              case 1:
                newBounds.topRight = event.point;
                break;
              case 2:
                newBounds.bottomRight = event.point;
                break;
              case 3:
                newBounds.bottomLeft = event.point;
                break;
            }

            rect.bounds = newBounds;

            if (selectedItem.children[1] instanceof paper.PointText) {
              selectedItem.children[1].position = rect.bounds.center;
            }

            createHandles(rect);
          }
        } else if (selectedItem && !selectedItem.locked) {
          // Calculer la nouvelle position
          const newPosition = selectedItem.position.add(event.delta);
          
          // Obtenir les limites du rectangle bleu (zone de chargement)
          const currentScale = scaleRef.current;
          const currentLength = loadAreaLengthRef.current;
          const currentWidth = loadAreaWidthRef.current;
          const scaledLength = currentLength * currentScale;
          const scaledWidth = currentWidth * currentScale;
          
          const loadAreaLeft = (CANVAS_WIDTH - scaledLength) / 2;
          const loadAreaTop = (CANVAS_HEIGHT - scaledWidth) / 2;
          const loadAreaRight = loadAreaLeft + scaledLength;
          const loadAreaBottom = loadAreaTop + scaledWidth;
          
          // Obtenir les limites de l'objet sélectionné
          const itemBounds = selectedItem.bounds;
          const halfWidth = itemBounds.width / 2;
          const halfHeight = itemBounds.height / 2;
          
          // Contraindre la position pour rester dans la zone de chargement
          const constrainedX = Math.max(
            loadAreaLeft + halfWidth,
            Math.min(loadAreaRight - halfWidth, newPosition.x)
          );
          const constrainedY = Math.max(
            loadAreaTop + halfHeight,
            Math.min(loadAreaBottom - halfHeight, newPosition.y)
          );
          
          selectedItem.position = new paper.Point(constrainedX, constrainedY);
          itemWasMoved = true; // Marquer que l'élément a été déplacé
          
          if (handles.length > 0) {
            if (selectedItem instanceof paper.Group && selectedItem.children[0]) {
              createHandles(selectedItem.children[0]);
            } else {
              createHandles(selectedItem);
            }
          }
        }
      }
    };

    tool.onMouseUp = (event: paper.ToolEvent) => {
      if (draggedHandle) {
        draggedHandle = null;
        saveState();
      } else if (activeToolRef.current === "rectangle" && currentPath) {
        setPendingRectangle(currentPath);
        setShowFurnitureDialog(true);
      } else if (activeToolRef.current === "measure" && currentMeasureLine) {
        currentMeasureLine = null;
        currentMeasureText = null;
      } else if (activeToolRef.current === "select" && selectedItem) {
        saveState();
        // Sauvegarder automatiquement dans la base de données si un meuble a été déplacé
        if (itemWasMoved) {
          console.log("🔄 Sauvegarde automatique après déplacement du meuble");
          setTimeout(() => handleSave(), 100);
          itemWasMoved = false;
        }
      }

      currentPath = null;
    };

    canvasRef.current.addEventListener("contextmenu", (e) => {
      e.preventDefault();

      if (activeToolRef.current === "measure") {
        clearAllMeasures();
        return;
      }

      setContextMenu(null);

      const point = new paper.Point(e.offsetX || e.layerX, e.offsetY || e.layerY);

      const hitResult = paper.project.hitTest(point, {
        fill: true,
        stroke: true,
        tolerance: 5,
      });

      if (hitResult?.item) {
        let furnitureId: string | null = null;

        if (hitResult.item instanceof paper.Group && hitResult.item.data.isFurniture) {
          furnitureId = hitResult.item.data.furnitureId;
        } else if (hitResult.item.parent instanceof paper.Group && hitResult.item.parent.data.isFurniture) {
          furnitureId = hitResult.item.parent.data.furnitureId;
        } else if (hitResult.item.data.furnitureId) {
          furnitureId = hitResult.item.data.furnitureId;
        }

        if (furnitureId) {
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            furnitureId: furnitureId,
          });
        }
      }
    });

    const handleUndo = () => {
      if (historyIndex > 0) {
        historyIndex--;
        paper.project.clear();
        paper.project.importJSON(history[historyIndex]);
      }
    };

    const handleRedo = () => {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        paper.project.clear();
        paper.project.importJSON(history[historyIndex]);
      }
    };

    const handleSave = async () => {
      const json = paper.project.exportJSON();

      // Extraire les IDs des meubles présents sur le canvas
      const canvasFurnitureIds = new Set<string>();
      paper.project.activeLayer.children.forEach((child) => {
        if (child instanceof paper.Group && child.data.isFurniture && child.data.furnitureId) {
          canvasFurnitureIds.add(child.data.furnitureId);
        }
      });

      // Ne sauvegarder que les meubles qui sont sur le canvas
      const furnitureData = Array.from(furnitureItemsRef.current.entries())
        .filter(([id]) => canvasFurnitureIds.has(id))
        .map(([id, data]) => ({
          id,
          ...data,
        }));

      console.log("🔍 Sauvegarde - Nombre de meubles sur le canvas:", canvasFurnitureIds.size);
      console.log("🔍 Sauvegarde - Nombre de meubles dans les données:", furnitureData.length);
      console.log("🔍 Dimensions zone de chargement:", loadAreaLength, "×", loadAreaWidth, "mm");
      console.log("Détails meubles:", furnitureData);

      // Synchroniser furnitureItems avec le canvas
      setFurnitureItems((prev) => {
        const newMap = new Map<string, FurnitureData>();
        canvasFurnitureIds.forEach((id) => {
          const data = prev.get(id);
          if (data) {
            newMap.set(id, data);
          }
        });
        return newMap;
      });

      try {
        const { error } = await supabase
          .from("projects")
          .update({
            layout_canvas_data: json,
            furniture_data: furnitureData,
            longueur_chargement_mm: loadAreaLength,
            largeur_chargement_mm: loadAreaWidth,
          } as any)
          .eq("id", projectId);

        if (error) throw error;
        console.log("✅ Sauvegarde réussie");
        toast.success("Plan d'aménagement sauvegardé");
      } catch (error) {
        console.error("❌ Erreur lors de la sauvegarde:", error);
        toast.error("Erreur lors de la sauvegarde");
      }
    };

    const handleDelete = async () => {
      if (selectedItem && !selectedItem.locked && !selectedItem.data.isHandle) {
        const itemId = selectedItem.data.furnitureId;

        // Si c'est un groupe de meuble, récupérer l'ID depuis le groupe
        let furnitureId = itemId;
        if (selectedItem instanceof paper.Group && selectedItem.data.isFurniture) {
          furnitureId = selectedItem.data.furnitureId;
        }

        console.log("🗑️ Suppression du meuble depuis le canvas:", furnitureId);

        if (furnitureId) {
          // Supprimer du state
          setFurnitureItems((prev) => {
            const newMap = new Map(prev);
            newMap.delete(furnitureId);
            return newMap;
          });
        }

        selectedItem.remove();
        removeHandles();
        selectedItem = null;
        saveState();
        toast.success("Élément supprimé");

        // Sauvegarder automatiquement
        await handleSave();
      }
    };

    const handleExport = () => {
      if (!canvasRef.current) return;
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `amenagement-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Plan d'aménagement exporté");
    };

    const handleLoad = async () => {
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("layout_canvas_data, furniture_data, longueur_chargement_mm, largeur_chargement_mm")
          .eq("id", projectId)
          .single() as any;

        if (error) throw error;

        // Charger les dimensions de la zone de chargement
        if (data?.longueur_chargement_mm && data?.largeur_chargement_mm) {
          console.log("📐 Dimensions chargées:", {
            longueur: data.longueur_chargement_mm,
            largeur: data.largeur_chargement_mm
          });
          setLoadAreaLength(data.longueur_chargement_mm);
          setLoadAreaWidth(data.largeur_chargement_mm);
        }

        if (data?.layout_canvas_data && typeof data.layout_canvas_data === "string") {
          paper.project.clear();
          paper.project.importJSON(data.layout_canvas_data);
          
          // Redessiner le rectangle bleu après le chargement
          setTimeout(() => drawLoadAreaOutline(), 10);
          
          saveState();
          toast.success("Plan d'aménagement chargé");
        } else {
          // Pas de données sauvegardées, juste redessiner le rectangle
          drawLoadAreaOutline();
        }

        if (data?.furniture_data && Array.isArray(data.furniture_data)) {
          const newMap = new Map<string, FurnitureData>();
          data.furniture_data.forEach((item: any) => {
            newMap.set(item.id, {
              id: item.id,
              longueur_mm: item.longueur_mm,
              largeur_mm: item.largeur_mm,
              hauteur_mm: item.hauteur_mm,
              poids_kg: item.poids_kg,
              hauteur_sol_mm: item.hauteur_sol_mm || 0,
            });
          });
          setFurnitureItems(newMap);
        }
      } catch (error) {
        console.error("Error loading layout:", error);
        toast.error("Erreur lors du chargement");
      }
    };

    (window as any).layoutCanvasUndo = handleUndo;
    (window as any).layoutCanvasRedo = handleRedo;
    (window as any).layoutCanvasDelete = handleDelete;
    (window as any).layoutCanvasSave = handleSave;
    (window as any).layoutCanvasExport = handleExport;

    // Fonction de chargement modifiée pour réactiver l'outil après
    const loadAndReactivateTool = async () => {
      await handleLoad();
      // Réactiver l'outil après le chargement
      tool.activate();
    };

    (window as any).layoutCanvasLoad = loadAndReactivateTool;

    // Charger automatiquement les données sauvegardées au montage du canvas
    loadAndReactivateTool();

    return () => {
      paper.project.clear();
    };
  }, [projectId, scale, loadAreaLength, loadAreaWidth, scaledLoadAreaLength, scaledLoadAreaWidth]);

  const handleFurnitureSubmit = () => {
    if (editingFurnitureId) {
      const newFurnitureData = {
        id: editingFurnitureId,
        ...furnitureForm,
      };

      setFurnitureItems((prev) => {
        const newMap = new Map(prev);
        newMap.set(editingFurnitureId, newFurnitureData);
        return newMap;
      });

      paper.project.activeLayer.children.forEach((child) => {
        if (child instanceof paper.Group && child.data.furnitureId === editingFurnitureId) {
          const rect = child.children[0] as paper.Path.Rectangle;
          const text = child.children[1] as paper.PointText;

          if (rect && text) {
            const currentScale = scaleRef.current;
            const scaledWidth = furnitureForm.longueur_mm * currentScale;
            const scaledHeight = furnitureForm.largeur_mm * currentScale;
            
            console.log("📏 Édition meuble:", {
              longueur_mm: furnitureForm.longueur_mm,
              largeur_mm: furnitureForm.largeur_mm,
              scaledWidth,
              scaledHeight,
              echelle: currentScale
            });

            const center = rect.bounds.center;

            const newBounds = new paper.Rectangle(
              center.subtract(new paper.Point(scaledWidth / 2, scaledHeight / 2)),
              new paper.Size(scaledWidth, scaledHeight),
            );
            rect.bounds = newBounds;

            text.content = `${furnitureForm.longueur_mm}x${furnitureForm.largeur_mm}x${furnitureForm.hauteur_mm}mm\n${furnitureForm.poids_kg}kg`;
            text.position = rect.bounds.center;
          }
        }
      });

      setEditingFurnitureId(null);
      setShowFurnitureDialog(false);
      setFurnitureForm({
        longueur_mm: 0,
        largeur_mm: 0,
        hauteur_mm: 0,
        poids_kg: 0,
        hauteur_sol_mm: 0,
      });
      toast.success("Meuble modifié");

      setTimeout(() => {
        (window as any).layoutCanvasSave?.();
      }, 100);
    } else if (pendingRectangle) {
      const furnitureId = `furniture-${Date.now()}`;

      const newFurnitureData = {
        id: furnitureId,
        ...furnitureForm,
      };

      setFurnitureItems((prev) => {
        const newMap = new Map(prev);
        newMap.set(furnitureId, newFurnitureData);
        return newMap;
      });

      setTimeout(() => {
        const currentScale = scaleRef.current;
        const scaledWidth = furnitureForm.longueur_mm * currentScale;
        const scaledHeight = furnitureForm.largeur_mm * currentScale;

        // Calculer le centre de la zone de chargement
        const loadAreaCenterX = (CANVAS_WIDTH - loadAreaLengthRef.current * currentScale) / 2 + (loadAreaLengthRef.current * currentScale) / 2;
        const loadAreaCenterY = (CANVAS_HEIGHT - loadAreaWidthRef.current * currentScale) / 2 + (loadAreaWidthRef.current * currentScale) / 2;
        const center = new paper.Point(loadAreaCenterX, loadAreaCenterY);

        const newBounds = new paper.Rectangle(
          center.subtract(new paper.Point(scaledWidth / 2, scaledHeight / 2)),
          new paper.Size(scaledWidth, scaledHeight),
        );
        pendingRectangle!.bounds = newBounds;
        
        console.log("📏 Création meuble:", {
          longueur_mm: furnitureForm.longueur_mm,
          largeur_mm: furnitureForm.largeur_mm,
          scaledWidth,
          scaledHeight,
          echelle: currentScale,
          zone_longueur_mm: loadAreaLengthRef.current,
          zone_largeur_mm: loadAreaWidthRef.current
        });

        const text = new paper.PointText({
          point: pendingRectangle!.bounds.center,
          content: `${furnitureForm.longueur_mm}x${furnitureForm.largeur_mm}x${furnitureForm.hauteur_mm}mm\n${furnitureForm.poids_kg}kg`,
          fillColor: new paper.Color("#000"),
          fontSize: 12,
          justification: "center",
        });
        text.data.isFurnitureLabel = true;
        text.data.furnitureId = furnitureId;

        const group = new paper.Group([pendingRectangle!, text]);
        group.data.isFurniture = true;
        group.data.furnitureId = furnitureId;

        pendingRectangle!.data = {};

        setTimeout(() => {
          (window as any).layoutCanvasSave?.();
        }, 100);
      }, 0);

      setPendingRectangle(null);
      setShowFurnitureDialog(false);
      setFurnitureForm({
        longueur_mm: 0,
        largeur_mm: 0,
        hauteur_mm: 0,
        poids_kg: 0,
        hauteur_sol_mm: 0,
      });
      toast.success("Meuble ajouté");
    }
  };

  const handleFurnitureCancel = () => {
    if (pendingRectangle) {
      pendingRectangle.remove();
    }
    setPendingRectangle(null);
    setEditingFurnitureId(null);
    setShowFurnitureDialog(false);
    setFurnitureForm({
      longueur_mm: 0,
      largeur_mm: 0,
      hauteur_mm: 0,
      poids_kg: 0,
      hauteur_sol_mm: 0,
    });
  };

  const handleContextMenuEdit = () => {
    if (!contextMenu) return;

    const furnitureData = furnitureItemsRef.current.get(contextMenu.furnitureId);

    if (furnitureData) {
      setEditingFurnitureId(contextMenu.furnitureId);
      setFurnitureForm({
        longueur_mm: furnitureData.longueur_mm,
        largeur_mm: furnitureData.largeur_mm,
        hauteur_mm: furnitureData.hauteur_mm,
        poids_kg: furnitureData.poids_kg,
        hauteur_sol_mm: furnitureData.hauteur_sol_mm || 0,
      });
      setShowFurnitureDialog(true);
      setContextMenu(null);
    }
  };

  // Calculer le poids total des meubles
  useEffect(() => {
    const furnitureWeight = Array.from(furnitureItems.values()).reduce(
      (sum, item) => sum + (item.poids_kg || 0),
      0
    );
    
    // Récupérer le poids des accessoires depuis les dépenses du projet
    const fetchAccessoriesWeight = async () => {
      try {
        const { data, error } = await supabase
          .from("project_expenses")
          .select("poids_kg, quantite")
          .eq("project_id", projectId);

        if (error) throw error;

        const accessoriesTotal = data?.reduce(
          (sum, expense) => sum + ((expense.poids_kg || 0) * (expense.quantite || 1)),
          0
        ) || 0;

        setAccessoriesWeight(accessoriesTotal);
        setTotalWeight(furnitureWeight + accessoriesTotal);
      } catch (error) {
        console.error("Erreur lors du calcul du poids des accessoires:", error);
        setAccessoriesWeight(0);
        setTotalWeight(furnitureWeight);
      }
    };

    fetchAccessoriesWeight();
  }, [furnitureItems, projectId]);

  const weightPercentage = (totalWeight / maxLoad) * 100;
  const remainingWeight = maxLoad - totalWeight;

  // Convertir la Map en Array pour l'affichage
  const furnitureList = Array.from(furnitureItems.values());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-4">
      {/* Colonne de gauche : Canvas */}
      <div className="space-y-4">
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Jauge de Poids</h3>
              <div className="text-sm text-muted-foreground">
                Surface utile : {loadAreaLength}mm x {loadAreaWidth}mm
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Meubles : {totalWeight - accessoriesWeight} kg</span>
                <span>Accessoires : {accessoriesWeight} kg</span>
              </div>
              <Progress value={weightPercentage} className="h-3" />
              <div className="flex justify-between text-sm font-medium">
                <span>Total : {totalWeight.toFixed(1)} kg</span>
                <span className={remainingWeight < 0 ? "text-red-500" : "text-green-600"}>
                  {remainingWeight < 0 ? "Surcharge" : "Reste"} : {Math.abs(remainingWeight).toFixed(1)} kg
                </span>
              </div>
              <div className="text-xs text-muted-foreground text-center">Charge utile maximale : {maxLoad} kg</div>
            </div>
          </div>
        </Card>

        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap bg-muted/30 p-3 rounded-lg">
            <Button
              variant={activeTool === "select" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTool("select")}
            >
              Sélectionner
            </Button>
            <Button
              variant={activeTool === "rectangle" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTool("rectangle")}
            >
              <Square className="h-4 w-4 mr-2" />
              Meuble
            </Button>
            <Button
              variant={activeTool === "measure" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTool("measure")}
            >
              <Ruler className="h-4 w-4 mr-2" />
              Mesurer
            </Button>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-2">
              <Label htmlFor="color" className="text-sm">
                Couleur :
              </Label>
              <input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-8 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="strokeWidth" className="text-sm">
                Épaisseur :
              </Label>
              <Input
                id="strokeWidth"
                type="number"
                min="1"
                max="20"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-20"
              />
            </div>

            <Separator orientation="vertical" className="h-6" />

            <Button variant="outline" size="sm" onClick={() => (window as any).layoutCanvasUndo?.()}>
              <Undo className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => (window as any).layoutCanvasRedo?.()}>
              <Redo className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => (window as any).layoutCanvasDelete?.()}>
              <Trash2 className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-6" />

            <Button variant="outline" size="sm" onClick={() => (window as any).layoutCanvasSave?.()}>
              <Save className="h-4 w-4 mr-2" />
              Sauvegarder
            </Button>
            <Button variant="outline" size="sm" onClick={() => (window as any).layoutCanvasLoad?.()}>
              <Upload className="h-4 w-4 mr-2" />
              Charger
            </Button>
            <Button variant="outline" size="sm" onClick={() => (window as any).layoutCanvasLoad?.()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Rafraîchir
            </Button>
            <Button variant="outline" size="sm" onClick={() => (window as any).layoutCanvasExport?.()}>
              <Download className="h-4 w-4 mr-2" />
              Exporter
            </Button>
          </div>

          <div className="bg-muted/30 rounded-lg p-2">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="border rounded bg-white cursor-crosshair"
            />
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            Échelle : 1:{Math.round(1 / scale)} • Zone en pointillés bleus = zone de chargement utile ({loadAreaLength}{" "}
            x {loadAreaWidth} mm)
          </div>
        </div>
      </div>

      {/* Colonne de droite : Liste des meubles */}
      <Card className="p-4 h-fit lg:sticky lg:top-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Liste des meubles</h3>
            <span className="ml-auto text-sm text-muted-foreground">({furnitureList.length})</span>
          </div>

          <Separator />

          <ScrollArea className="h-[600px] pr-4">
            {furnitureList.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucun meuble</p>
                <p className="text-xs mt-1">Ajoutez un meuble sur le canvas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {furnitureList.map((furniture) => (
                  <Card key={furniture.id} className="p-3 hover:bg-muted/50 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">Meuble #{furniture.id.split("-").pop()}</p>
                          <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                            <p>
                              📏 {furniture.longueur_mm} × {furniture.largeur_mm} × {furniture.hauteur_mm} mm
                            </p>
                            <p>⚖️ {furniture.poids_kg} kg</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteFromList(furniture.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          {furnitureList.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>Poids total des meubles :</span>
                  <span className="text-primary">{(totalWeight - accessoriesWeight).toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>+ Accessoires :</span>
                  <span>{accessoriesWeight.toFixed(1)} kg</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-bold">
                  <span>Total :</span>
                  <span className={weightPercentage > 100 ? "text-red-500" : "text-green-600"}>
                    {totalWeight.toFixed(1)} kg
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Dialogues et menus contextuels */}
      <Dialog open={showFurnitureDialog} onOpenChange={setShowFurnitureDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFurnitureId ? "Modifier le meuble" : "Propriétés du meuble"}</DialogTitle>
            <DialogDescription>Renseignez les dimensions et le poids du meuble</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="longueur">Longueur (mm)</Label>
                <Input
                  id="longueur"
                  type="number"
                  value={furnitureForm.longueur_mm}
                  onChange={(e) =>
                    setFurnitureForm((prev) => ({
                      ...prev,
                      longueur_mm: Number(e.target.value),
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleFurnitureSubmit();
                    }
                    e.stopPropagation();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="largeur">Largeur (mm)</Label>
                <Input
                  id="largeur"
                  type="number"
                  value={furnitureForm.largeur_mm}
                  onChange={(e) =>
                    setFurnitureForm((prev) => ({
                      ...prev,
                      largeur_mm: Number(e.target.value),
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleFurnitureSubmit();
                    }
                    e.stopPropagation();
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hauteur">Hauteur (mm)</Label>
                <Input
                  id="hauteur"
                  type="number"
                  value={furnitureForm.hauteur_mm}
                  onChange={(e) =>
                    setFurnitureForm((prev) => ({
                      ...prev,
                      hauteur_mm: Number(e.target.value),
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleFurnitureSubmit();
                    }
                    e.stopPropagation();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="poids">Poids (kg)</Label>
                <Input
                  id="poids"
                  type="number"
                  step="0.1"
                  value={furnitureForm.poids_kg}
                  onChange={(e) =>
                    setFurnitureForm((prev) => ({
                      ...prev,
                      poids_kg: Number(e.target.value),
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleFurnitureSubmit();
                    }
                    e.stopPropagation();
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hauteur_sol">Hauteur par rapport au sol (mm)</Label>
              <Input
                id="hauteur_sol"
                type="number"
                value={furnitureForm.hauteur_sol_mm}
                onChange={(e) =>
                  setFurnitureForm((prev) => ({
                    ...prev,
                    hauteur_sol_mm: Number(e.target.value),
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleFurnitureSubmit();
                  }
                  e.stopPropagation();
                }}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Distance entre le sol et le dessous du meuble (0 = posé au sol)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleFurnitureCancel}>
              Annuler
            </Button>
            <Button onClick={handleFurnitureSubmit}>{editingFurnitureId ? "Modifier" : "Valider"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[150px]"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full px-4 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                handleContextMenuEdit();
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
              Modifier
            </button>
          </div>
        </>
      )}
    </div>
  );
};
