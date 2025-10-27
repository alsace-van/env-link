import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Square, Trash2, Undo, Redo, Download, Save, Upload, Ruler } from "lucide-react";
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
  });

  const activeToolRef = useRef(activeTool);
  const colorRef = useRef(color);
  const strokeWidthRef = useRef(strokeWidth);
  const furnitureItemsRef = useRef(furnitureItems);

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

  // Charger le poids des accessoires depuis les dépenses
  useEffect(() => {
    const loadAccessoriesWeight = async () => {
      const { data, error } = await supabase
        .from("project_expenses")
        .select("poids_kg, quantite")
        .eq("project_id", projectId)
        .not("poids_kg", "is", null);

      if (!error && data) {
        const total = data.reduce((sum, item) => {
          return sum + (item.poids_kg || 0) * (item.quantite || 1);
        }, 0);
        setAccessoriesWeight(total);
      }
    };

    loadAccessoriesWeight();
  }, [projectId]);

  // Charger les données des meubles au montage
  useEffect(() => {
    const loadFurnitureData = async () => {
      try {
        const { data, error } = await supabase.from("projects").select("furniture_data").eq("id", projectId).single();

        if (error) throw error;

        if (data?.furniture_data && Array.isArray(data.furniture_data)) {
          const newMap = new Map<string, FurnitureData>();
          data.furniture_data.forEach((item: any) => {
            newMap.set(item.id, {
              id: item.id,
              longueur_mm: item.longueur_mm,
              largeur_mm: item.largeur_mm,
              hauteur_mm: item.hauteur_mm,
              poids_kg: item.poids_kg,
            });
          });
          setFurnitureItems(newMap);
        }
      } catch (error) {
        console.error("Error loading furniture data:", error);
      }
    };

    loadFurnitureData();
  }, [projectId]);

  // Calculer le poids total
  useEffect(() => {
    const furnitureWeight = Array.from(furnitureItems.values()).reduce((sum, item) => sum + item.poids_kg, 0);
    setTotalWeight(furnitureWeight + accessoriesWeight);
  }, [furnitureItems, accessoriesWeight]);

  // Calcul de l'échelle pour adapter la zone de chargement au canvas (avec marge)
  const scale = Math.min((CANVAS_WIDTH - 100) / loadAreaLength, (CANVAS_HEIGHT - 100) / loadAreaWidth);

  const scaledLoadAreaLength = loadAreaLength * scale;
  const scaledLoadAreaWidth = loadAreaWidth * scale;

  useEffect(() => {
    if (!canvasRef.current) return;

    // Setup Paper.js
    paper.setup(canvasRef.current);

    // Dessiner le contour de la zone de chargement
    const loadAreaOutline = new paper.Path.Rectangle({
      point: [(CANVAS_WIDTH - scaledLoadAreaLength) / 2, (CANVAS_HEIGHT - scaledLoadAreaWidth) / 2],
      size: [scaledLoadAreaLength, scaledLoadAreaWidth],
      strokeColor: new paper.Color("#3b82f6"),
      strokeWidth: 3,
      dashArray: [10, 5],
      locked: true,
    });

    loadAreaOutline.sendToBack();

    let currentPath: paper.Path.Rectangle | null = null;
    let selectedItem: paper.Item | null = null;
    let handles: paper.Path.Circle[] = [];
    let draggedHandle: paper.Path.Circle | null = null;
    let currentMeasureLine: paper.Path.Line | null = null;
    let currentMeasureText: paper.PointText | null = null;
    const history: string[] = [];
    let historyIndex = -1;

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
      const furnitureData = furnitureItems.get(furnitureId);
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
      text.locked = true;
    };

    const tool = new paper.Tool();

    tool.onMouseDown = (event: paper.ToolEvent) => {
      // Fermer le menu contextuel
      setContextMenu(null);

      const hitResult = paper.project.hitTest(event.point, {
        fill: true,
        stroke: true,
        tolerance: 5,
      });

      if (activeToolRef.current === "select") {
        if (hitResult?.item.data.isHandle) {
          draggedHandle = hitResult.item as paper.Path.Circle;
        } else if (hitResult?.item && !hitResult.item.locked) {
          clearSelection();

          // Si l'élément fait partie d'un groupe de meuble, sélectionner le groupe
          if (hitResult.item.parent instanceof paper.Group && hitResult.item.parent.data.isFurniture) {
            selectedItem = hitResult.item.parent;
          } else {
            selectedItem = hitResult.item;
          }

          selectedItem.selected = true;

          // Créer des poignées sur le rectangle du groupe (premier enfant)
          if (
            selectedItem instanceof paper.Group &&
            selectedItem.data.isFurniture &&
            selectedItem.children.length > 0
          ) {
            const rect = selectedItem.children[0];
            if (rect instanceof paper.Path.Rectangle) {
              createHandles(rect);
            }
          } else if (selectedItem instanceof paper.Path.Rectangle) {
            createHandles(selectedItem);
          }
        } else {
          clearSelection();
        }
      } else if (activeToolRef.current === "rectangle") {
        clearSelection();
        currentPath = new paper.Path.Rectangle({
          from: event.point,
          to: event.point,
          strokeColor: new paper.Color(colorRef.current),
          strokeWidth: strokeWidthRef.current,
          fillColor: new paper.Color(colorRef.current + "40"),
        });
        currentPath.data.isFurniture = true;
      } else if (activeToolRef.current === "measure") {
        if (currentMeasureLine) currentMeasureLine.remove();
        if (currentMeasureText) currentMeasureText.remove();

        currentMeasureLine = new paper.Path.Line({
          from: event.point,
          to: event.point,
          strokeColor: new paper.Color("#ff0000"),
          strokeWidth: 2,
          dashArray: [5, 3],
        });
        currentMeasureLine.data.isMeasure = true;
      }
    };

    tool.onMouseDrag = (event: paper.ToolEvent) => {
      if (draggedHandle) {
        // Récupérer le rectangle à redimensionner
        let rectToResize: paper.Path.Rectangle | null = null;
        let textToUpdate: paper.PointText | null = null;
        let furnitureId: string | null = null;

        if (selectedItem instanceof paper.Group && selectedItem.data.isFurniture) {
          // Si c'est un groupe de meuble, récupérer le rectangle et le texte
          rectToResize = selectedItem.children[0] as paper.Path.Rectangle;
          textToUpdate = selectedItem.children[1] as paper.PointText;
          furnitureId = selectedItem.data.furnitureId;
        } else if (selectedItem instanceof paper.Path.Rectangle) {
          rectToResize = selectedItem;
        }

        if (rectToResize) {
          const handleIndex = handles.indexOf(draggedHandle);
          const bounds = rectToResize.bounds;

          let newBounds = bounds.clone();

          switch (handleIndex) {
            case 0: // Top-left
              newBounds.topLeft = event.point;
              break;
            case 1: // Top-right
              newBounds.topRight = event.point;
              break;
            case 2: // Bottom-right
              newBounds.bottomRight = event.point;
              break;
            case 3: // Bottom-left
              newBounds.bottomLeft = event.point;
              break;
          }

          rectToResize.bounds = newBounds;

          // Calculer les nouvelles dimensions réelles en mm
          const newWidthMm = Math.round(newBounds.width / scale);
          const newHeightMm = Math.round(newBounds.height / scale);

          // Mettre à jour les données du meuble
          if (furnitureId) {
            const furnitureData = furnitureItemsRef.current.get(furnitureId);
            if (furnitureData) {
              const updatedData = {
                ...furnitureData,
                longueur_mm: newWidthMm,
                largeur_mm: newHeightMm,
              };
              setFurnitureItems((prev) => {
                const newMap = new Map(prev);
                newMap.set(furnitureId!, updatedData);
                return newMap;
              });

              // Mettre à jour le texte avec les nouvelles dimensions
              if (textToUpdate) {
                textToUpdate.content = `${newWidthMm}x${newHeightMm}x${furnitureData.hauteur_mm}mm\n${furnitureData.poids_kg}kg`;
                textToUpdate.position = rectToResize.bounds.center;
              }
            }
          }

          createHandles(rectToResize);
        }
      } else if (activeToolRef.current === "rectangle" && currentPath) {
        currentPath.remove();
        currentPath = new paper.Path.Rectangle({
          from: event.downPoint,
          to: event.point,
          strokeColor: new paper.Color(colorRef.current),
          strokeWidth: strokeWidthRef.current,
          fillColor: new paper.Color(colorRef.current + "40"),
        });
        currentPath.data.isFurniture = true;
      } else if (activeToolRef.current === "measure" && currentMeasureLine) {
        currentMeasureLine.removeSegments();
        currentMeasureLine.add(event.downPoint);
        currentMeasureLine.add(event.point);

        if (currentMeasureText) currentMeasureText.remove();

        const distance = event.point.subtract(event.downPoint).length;
        const realDistance = (distance / scale).toFixed(0);
        const midPoint = event.downPoint.add(event.point).divide(2);

        currentMeasureText = new paper.PointText({
          point: midPoint.add(new paper.Point(0, -10)),
          content: `${realDistance} mm`,
          fillColor: new paper.Color("#ff0000"),
          fontSize: 14,
          fontWeight: "bold",
        });
        currentMeasureText.data.isMeasure = true;
      } else if (activeToolRef.current === "select" && selectedItem && !draggedHandle) {
        if (!selectedItem.locked && !selectedItem.data.isHandle) {
          selectedItem.position = selectedItem.position.add(event.delta);

          // Mettre à jour les poignées
          if (
            selectedItem instanceof paper.Group &&
            selectedItem.data.isFurniture &&
            selectedItem.children.length > 0
          ) {
            const rect = selectedItem.children[0];
            if (rect instanceof paper.Path.Rectangle) {
              createHandles(rect);
            }
          } else {
            createHandles(selectedItem);
          }
        }
      }
    };

    tool.onMouseUp = (event: paper.ToolEvent) => {
      if (draggedHandle) {
        draggedHandle = null;
        saveState();
      } else if (activeToolRef.current === "rectangle" && currentPath) {
        // Ouvrir le dialogue pour renseigner les dimensions
        setPendingRectangle(currentPath);
        setShowFurnitureDialog(true);
      } else if (activeToolRef.current === "measure" && currentMeasureLine) {
        // La mesure est maintenant permanente, réinitialiser pour la prochaine
        currentMeasureLine = null;
        currentMeasureText = null;
      } else if (activeToolRef.current === "select" && selectedItem) {
        saveState();
      }

      currentPath = null;
    };

    // Gestionnaire clic droit
    canvasRef.current.addEventListener("contextmenu", (e) => {
      e.preventDefault();

      if (activeToolRef.current === "measure") {
        clearAllMeasures();
        return;
      }

      // Fermer le menu existant
      setContextMenu(null);

      // Vérifier si on clique sur un meuble
      const point = new paper.Point(e.offsetX || e.layerX, e.offsetY || e.layerY);

      const hitResult = paper.project.hitTest(point, {
        fill: true,
        stroke: true,
        tolerance: 5,
      });

      if (hitResult?.item) {
        let furnitureId: string | null = null;

        // Trouver le furnitureId
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
      const furnitureData = Array.from(furnitureItemsRef.current.entries()).map(([id, data]) => ({
        id,
        ...data,
      }));

      console.log("🔍 Sauvegarde - Nombre de meubles:", furnitureData.length);
      console.log("Détails meubles:", furnitureData);

      try {
        const { error } = await supabase
          .from("projects")
          .update({
            layout_canvas_data: json,
            furniture_data: furnitureData,
          })
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
        
        selectedItem.remove();
        removeHandles();
        selectedItem = null;
        
        // Supprimer du state local
        if (itemId) {
          setFurnitureItems((prev) => {
            const newMap = new Map(prev);
            newMap.delete(itemId);
            return newMap;
          });
        }
        
        saveState();
        
        // Sauvegarder automatiquement après suppression
        await handleSave();
        
        toast.success("Élément supprimé");
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
          .select("layout_canvas_data, furniture_data")
          .eq("id", projectId)
          .single();

        if (error) throw error;

        if (data?.layout_canvas_data) {
          paper.project.clear();
          const canvasData =
            typeof data.layout_canvas_data === "string"
              ? data.layout_canvas_data
              : JSON.stringify(data.layout_canvas_data);
          paper.project.importJSON(canvasData);

          // Re-synchroniser les données des meubles après l'import du canvas
          if (data?.furniture_data && Array.isArray(data.furniture_data)) {
            const newMap = new Map<string, FurnitureData>();
            data.furniture_data.forEach((item: any) => {
              newMap.set(item.id, {
                id: item.id,
                longueur_mm: item.longueur_mm,
                largeur_mm: item.largeur_mm,
                hauteur_mm: item.hauteur_mm,
                poids_kg: item.poids_kg,
              });
            });
            setFurnitureItems(newMap);
            furnitureItemsRef.current = newMap;

            console.log("✅ Chargement - Nombre de meubles:", newMap.size);
            console.log("Détails:", Array.from(newMap.values()));
          }

          toast.success("Plan d'aménagement chargé");
        }
      } catch (error) {
        console.error("Error loading layout:", error);
        toast.error("Erreur lors du chargement");
      }
    };

    // Exposer les fonctions via window pour les boutons
    (window as any).layoutCanvasUndo = handleUndo;
    (window as any).layoutCanvasRedo = handleRedo;
    (window as any).layoutCanvasDelete = handleDelete;
    (window as any).layoutCanvasExport = handleExport;
    (window as any).layoutCanvasSave = handleSave;
    (window as any).layoutCanvasLoad = handleLoad;

    saveState();

    // Charger automatiquement les données sauvegardées au montage
    handleLoad();

    return () => {
      tool.remove();
      paper.project.clear();
      delete (window as any).layoutCanvasUndo;
      delete (window as any).layoutCanvasRedo;
      delete (window as any).layoutCanvasDelete;
      delete (window as any).layoutCanvasExport;
      delete (window as any).layoutCanvasSave;
      delete (window as any).layoutCanvasLoad;
    };
  }, [projectId]);

  const handleSaveDimensions = async () => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          longueur_chargement_mm: loadAreaLength,
          largeur_chargement_mm: loadAreaWidth,
        })
        .eq("id", projectId);

      if (error) throw error;
      setIsEditingDimensions(false);
      toast.success("Dimensions sauvegardées");
    } catch (error) {
      console.error("Error saving dimensions:", error);
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  const handleFurnitureSubmit = () => {
    if (editingFurnitureId) {
      // Mode édition
      const newFurnitureData = {
        id: editingFurnitureId,
        ...furnitureForm,
      };

      setFurnitureItems((prev) => {
        const newMap = new Map(prev);
        newMap.set(editingFurnitureId, newFurnitureData);
        return newMap;
      });

      // Trouver et mettre à jour le groupe de meuble dans le canvas
      paper.project.activeLayer.children.forEach((child) => {
        if (child instanceof paper.Group && child.data.furnitureId === editingFurnitureId) {
          const rect = child.children[0] as paper.Path.Rectangle;
          const text = child.children[1] as paper.PointText;

          if (rect && text) {
            // Calculer les nouvelles dimensions à l'échelle
            const scaledWidth = furnitureForm.longueur_mm * scale;
            const scaledHeight = furnitureForm.largeur_mm * scale;

            // Obtenir le centre actuel
            const center = rect.bounds.center;

            // Redimensionner le rectangle avec les nouvelles dimensions
            const newBounds = new paper.Rectangle(
              center.subtract(new paper.Point(scaledWidth / 2, scaledHeight / 2)),
              new paper.Size(scaledWidth, scaledHeight),
            );
            rect.bounds = newBounds;

            // Mettre à jour le texte et le recentrer
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
      });
      toast.success("Meuble modifié");

      // Sauvegarder automatiquement après la modification
      setTimeout(() => {
        (window as any).layoutCanvasSave?.();
      }, 100);
    } else if (pendingRectangle) {
      // Mode création
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

      // Créer le label sur le meuble
      setTimeout(() => {
        // Redimensionner le rectangle selon les dimensions réelles
        const scaledWidth = furnitureForm.longueur_mm * scale;
        const scaledHeight = furnitureForm.largeur_mm * scale;

        // Obtenir le centre actuel avant le redimensionnement
        const center = pendingRectangle!.bounds.center;

        // Créer un nouveau rectangle avec les bonnes dimensions
        const newBounds = new paper.Rectangle(
          center.subtract(new paper.Point(scaledWidth / 2, scaledHeight / 2)),
          new paper.Size(scaledWidth, scaledHeight),
        );
        pendingRectangle!.bounds = newBounds;

        const text = new paper.PointText({
          point: pendingRectangle!.bounds.center,
          content: `${furnitureForm.longueur_mm}x${furnitureForm.largeur_mm}x${furnitureForm.hauteur_mm}mm\n${furnitureForm.poids_kg}kg`,
          fillColor: new paper.Color("#000"),
          fontSize: 12,
          justification: "center",
        });
        text.data.isFurnitureLabel = true;
        text.data.furnitureId = furnitureId;

        // Créer un groupe avec le rectangle et le texte
        const group = new paper.Group([pendingRectangle!, text]);
        group.data.isFurniture = true;
        group.data.furnitureId = furnitureId;

        // Transférer les données du rectangle au groupe
        pendingRectangle!.data = {};

        // Sauvegarder automatiquement après la création
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
      });
      setShowFurnitureDialog(true);
      setContextMenu(null);
    }
  };

  const weightPercentage = (totalWeight / maxLoad) * 100;
  const remainingWeight = maxLoad - totalWeight;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Jauge de Poids</h3>
            <div className="text-sm text-muted-foreground">
              Véhicule : {vehicleLength}mm x {vehicleWidth}mm
            </div>
          </div>

          <Progress value={Math.min(weightPercentage, 100)} className="h-4" />

          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Charge utile max</p>
              <p className="font-bold text-lg">{maxLoad} kg</p>
            </div>
            <div>
              <p className="text-muted-foreground">Meubles</p>
              <p className="font-bold text-lg">{(totalWeight - accessoriesWeight).toFixed(1)} kg</p>
            </div>
            <div>
              <p className="text-muted-foreground">Accessoires</p>
              <p className="font-bold text-lg">{accessoriesWeight.toFixed(1)} kg</p>
            </div>
            <div>
              <p className="text-muted-foreground">Restant</p>
              <p className={`font-bold text-lg ${remainingWeight < 0 ? "text-destructive" : "text-primary"}`}>
                {remainingWeight.toFixed(1)} kg
              </p>
            </div>
          </div>

          {weightPercentage > 100 && (
            <div className="bg-destructive/10 text-destructive p-2 rounded text-sm">
              ⚠️ Attention : La charge utile est dépassée de {(totalWeight - maxLoad).toFixed(1)} kg
            </div>
          )}
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium">Zone de chargement :</span>
            {isEditingDimensions ? (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={loadAreaLength}
                    onChange={(e) => setLoadAreaLength(Number(e.target.value))}
                    className="w-24 h-8"
                  />
                  <span className="text-muted-foreground">x</span>
                  <Input
                    type="number"
                    value={loadAreaWidth}
                    onChange={(e) => setLoadAreaWidth(Number(e.target.value))}
                    className="w-24 h-8"
                  />
                  <span className="text-muted-foreground">mm</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLoadAreaLength(initialLoadAreaLength || Math.round(vehicleLength * 0.7));
                      setLoadAreaWidth(initialLoadAreaWidth || Math.round(vehicleWidth * 0.9));
                      setIsEditingDimensions(false);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button size="sm" onClick={handleSaveDimensions}>
                    Sauvegarder
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className="font-mono">
                  {loadAreaLength} x {loadAreaWidth} mm
                </span>
                <span className="text-muted-foreground">
                  ({((loadAreaLength * loadAreaWidth) / 1000000).toFixed(2)} m²)
                </span>
                <Button variant="ghost" size="sm" onClick={() => setIsEditingDimensions(true)}>
                  Modifier
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
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
          Échelle : 1:{Math.round(1 / scale)} • Zone en pointillés bleus = zone de chargement utile ({loadAreaLength} x{" "}
          {loadAreaWidth} mm)
        </div>
      </div>

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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleFurnitureCancel}>
              Annuler
            </Button>
            <Button onClick={handleFurnitureSubmit}>{editingFurnitureId ? "Modifier" : "Valider"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Menu contextuel */}
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