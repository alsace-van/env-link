// ============================================
// COMPOSANT: LayoutCanvas
// Canvas 2D pour aménagement de véhicule avec fonctionnalités VASP
// VERSION: 4.2 - Plein écran avec scale dynamique
// ============================================

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Square,
  Trash2,
  Undo,
  Redo,
  Download,
  Save,
  Upload,
  Ruler,
  Package,
  RefreshCw,
  Edit,
  Crosshair,
  Armchair,
  AlignHorizontalJustifyCenter,
  Magnet,
  ZoomIn,
  ZoomOut,
  Hand,
  Maximize,
  Minimize,
} from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FurnitureWeightCalculator } from "@/components/FurnitureWeightCalculator";

interface LayoutCanvasProps {
  projectId: string;
  vehicleLength?: number; // longueur totale en mm
  vehicleWidth?: number; // largeur totale en mm
  loadAreaLength?: number; // longueur zone de chargement en mm
  loadAreaWidth?: number; // largeur zone de chargement en mm
  loadAreaOffsetX?: number; // distance entre l'avant du véhicule et le début de la zone de chargement en mm
  maxLoad?: number; // charge utile en kg
  // Props VASP
  empattement?: number; // empattement en mm (distance entre essieux)
  porteFauxAvant?: number; // porte-à-faux avant en mm
  porteFauxArriere?: number; // porte-à-faux arrière en mm
  onElementPositionChange?: (elementId: string, distanceAv: number) => void; // callback pour position
  // Rangées de sièges VASP
  rangeesSieges?: Array<{
    id: string;
    numero_rangee: number;
    nombre_places: number;
    distance_essieu_av_mm: number;
  }>;
}

interface FurnitureData {
  id: string;
  longueur_mm: number;
  largeur_mm: number;
  hauteur_mm: number;
  poids_kg: number;
  hauteur_sol_mm: number;
  wood_type?: "okoume" | "bouleau" | "peuplier";
  thickness?: number; // en mm: 5, 8, 10, 12, 15
  surface?: number; // en m²
  masse_contenu_kg?: number; // Masse max du contenu pour VASP
  distance_essieu_av_mm?: number; // Distance calculée à l'essieu AV
}

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 700;

export const LayoutCanvas = ({
  projectId,
  vehicleLength = 3000,
  vehicleWidth = 1800,
  loadAreaLength: initialLoadAreaLength,
  loadAreaWidth: initialLoadAreaWidth,
  loadAreaOffsetX: initialLoadAreaOffsetX,
  maxLoad = 500,
  empattement,
  porteFauxAvant,
  porteFauxArriere,
  onElementPositionChange,
  rangeesSieges = [],
}: LayoutCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<
    "select" | "rectangle" | "measure" | "cotation" | "align" | "snap" | "pan"
  >("select");
  const [showVASPOverlay, setShowVASPOverlay] = useState(true); // Afficher les éléments VASP
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

  // État pour l'offset de la zone de chargement (par défaut alignée à l'arrière du véhicule)
  const [loadAreaOffsetX, setLoadAreaOffsetX] = useState(
    initialLoadAreaOffsetX ?? vehicleLength - (initialLoadAreaLength || Math.round(vehicleLength * 0.7)),
  );

  // États pour la cotation intelligente
  const [cotationStep, setCotationStep] = useState<0 | 1 | 2>(0); // 0: aucun, 1: référence sélectionnée, 2: cible sélectionnée
  const [cotationReference, setCotationReference] = useState<{ x: number; type: string; label: string } | null>(null);
  const [cotationTarget, setCotationTarget] = useState<{
    x: number;
    type: string;
    label: string;
    itemId?: string;
  } | null>(null);
  const [cotationCurrentDistance, setCotationCurrentDistance] = useState<number>(0);
  const [cotationNewDistance, setCotationNewDistance] = useState<string>("");
  const [showCotationDialog, setShowCotationDialog] = useState(false);
  const [cotationLine, setCotationLine] = useState<paper.Path.Line | null>(null);

  // États pour l'outil Aligner (aligner deux façades sur le même plan)
  type FurnitureSide = "left" | "right" | "top" | "bottom";
  interface AlignSelection {
    furnitureId: string;
    side: FurnitureSide;
    position: number; // position X ou Y du côté
    item: paper.Group;
  }
  const [alignStep, setAlignStep] = useState<0 | 1>(0); // 0: aucun, 1: meuble 1 sélectionné
  const [alignSource, setAlignSource] = useState<AlignSelection | null>(null);
  const [alignHighlight, setAlignHighlight] = useState<paper.Path.Line | null>(null);

  // États pour l'outil Coller (coller deux meubles l'un contre l'autre)
  const [snapStep, setSnapStep] = useState<0 | 1>(0); // 0: aucun, 1: meuble 1 sélectionné
  const [snapSource, setSnapSource] = useState<AlignSelection | null>(null);
  const [snapHighlight, setSnapHighlight] = useState<paper.Path.Line | null>(null);

  // États pour le zoom et pan
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const lastPanPoint = useRef<{ x: number; y: number } | null>(null);

  // États pour le plein écran
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenScale, setFullscreenScale] = useState(1);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [furnitureForm, setFurnitureForm] = useState({
    longueur_mm: 0,
    largeur_mm: 0,
    hauteur_mm: 0,
    poids_kg: 0,
    hauteur_sol_mm: 0,
    wood_type: "okoume" as "okoume" | "bouleau" | "peuplier",
    thickness: 15,
    surface: 0,
    masse_contenu_kg: 0, // Masse max du contenu pour VASP
  });

  // Masses volumiques des contreplaqués (kg/m³)
  const WOOD_DENSITIES = {
    okoume: 420,
    bouleau: 680,
    peuplier: 475,
  };

  // Calcul automatique du poids basé sur le bois, épaisseur et surface
  const calculateWeight = (woodType: string, thickness: number, surface: number): number => {
    const density = WOOD_DENSITIES[woodType as keyof typeof WOOD_DENSITIES] || 420;
    // Poids (kg) = surface (m²) × épaisseur (m) × masse volumique (kg/m³)
    return surface * (thickness / 1000) * density;
  };

  // Calcul de l'échelle basée sur le VÉHICULE complet (pas la zone de chargement)
  // Marge de 120px pour les labels et cotes
  const scale = Math.min((CANVAS_WIDTH - 120) / vehicleLength, (CANVAS_HEIGHT - 120) / vehicleWidth);

  const scaledLoadAreaLength = loadAreaLength * scale;
  const scaledLoadAreaWidth = loadAreaWidth * scale;

  const activeToolRef = useRef(activeTool);
  const colorRef = useRef(color);
  const strokeWidthRef = useRef(strokeWidth);
  const furnitureItemsRef = useRef(furnitureItems);
  const scaleRef = useRef(scale);
  const loadAreaLengthRef = useRef(loadAreaLength);
  const loadAreaWidthRef = useRef(loadAreaWidth);
  const loadAreaOffsetXRef = useRef(loadAreaOffsetX);
  const vehicleLengthRef = useRef(vehicleLength);
  const vehicleWidthRef = useRef(vehicleWidth);
  const cotationStepRef = useRef(cotationStep);
  const cotationReferenceRef = useRef(cotationReference);
  const empattementRef = useRef(empattement);
  const porteFauxAvantRef = useRef(porteFauxAvant);
  const porteFauxArriereRef = useRef(porteFauxArriere);

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
    loadAreaOffsetXRef.current = loadAreaOffsetX;
  }, [loadAreaLength, loadAreaWidth, loadAreaOffsetX]);

  useEffect(() => {
    vehicleLengthRef.current = vehicleLength;
    vehicleWidthRef.current = vehicleWidth;
  }, [vehicleLength, vehicleWidth]);

  useEffect(() => {
    cotationStepRef.current = cotationStep;
  }, [cotationStep]);

  useEffect(() => {
    cotationReferenceRef.current = cotationReference;
  }, [cotationReference]);

  useEffect(() => {
    empattementRef.current = empattement;
    porteFauxAvantRef.current = porteFauxAvant;
    porteFauxArriereRef.current = porteFauxArriere;
  }, [empattement, porteFauxAvant, porteFauxArriere]);

  // Refs pour align et snap
  const alignStepRef = useRef(alignStep);
  const alignSourceRef = useRef(alignSource);
  const snapStepRef = useRef(snapStep);
  const snapSourceRef = useRef(snapSource);

  useEffect(() => {
    alignStepRef.current = alignStep;
    alignSourceRef.current = alignSource;
  }, [alignStep, alignSource]);

  useEffect(() => {
    snapStepRef.current = snapStep;
    snapSourceRef.current = snapSource;
  }, [snapStep, snapSource]);

  // Réinitialiser la cotation quand on change d'outil
  useEffect(() => {
    if (activeTool !== "cotation") {
      setCotationStep(0);
      setCotationReference(null);
      setCotationTarget(null);
      // Nettoyer les éléments temporaires de cotation
      if (paper.project && paper.project.activeLayer) {
        const toRemove: paper.Item[] = [];
        paper.project.activeLayer.children.forEach((child) => {
          if (child.data.isCotationIndicator || child.data.isCotationLine || child.data.isCotationText) {
            toRemove.push(child);
          }
        });
        toRemove.forEach((item) => item.remove());
      }
      if (cotationLine) {
        cotationLine.remove();
        setCotationLine(null);
      }
    }
  }, [activeTool]);

  // Réinitialiser l'outil Aligner quand on change d'outil
  useEffect(() => {
    if (activeTool !== "align") {
      setAlignStep(0);
      setAlignSource(null);
      if (alignHighlight) {
        alignHighlight.remove();
        setAlignHighlight(null);
      }
      // Nettoyer les indicateurs visuels
      if (paper.project && paper.project.activeLayer) {
        const toRemove: paper.Item[] = [];
        paper.project.activeLayer.children.forEach((child) => {
          if (child.data.isAlignIndicator) {
            toRemove.push(child);
          }
        });
        toRemove.forEach((item) => item.remove());
      }
    }
  }, [activeTool, alignHighlight]);

  // Réinitialiser l'outil Coller quand on change d'outil
  useEffect(() => {
    if (activeTool !== "snap") {
      setSnapStep(0);
      setSnapSource(null);
      if (snapHighlight) {
        snapHighlight.remove();
        setSnapHighlight(null);
      }
      // Nettoyer les indicateurs visuels
      if (paper.project && paper.project.activeLayer) {
        const toRemove: paper.Item[] = [];
        paper.project.activeLayer.children.forEach((child) => {
          if (child.data.isSnapIndicator) {
            toRemove.push(child);
          }
        });
        toRemove.forEach((item) => item.remove());
      }
    }
  }, [activeTool, snapHighlight]);

  // Fonction pour calculer la position X de l'essieu AV
  const getEssieuAvX = useCallback(() => {
    const currentScale = scaleRef.current;
    const currentVehicleLength = vehicleLengthRef.current;
    const scaledVehicleLength = currentVehicleLength * currentScale;
    const vehicleLeft = (CANVAS_WIDTH - scaledVehicleLength) / 2;
    const currentPorteFauxAvant = porteFauxAvantRef.current;
    const calculatedPorteFauxAvant = currentPorteFauxAvant || Math.round(currentVehicleLength * 0.15);
    const scaledPorteFauxAvant = calculatedPorteFauxAvant * currentScale;
    return vehicleLeft + scaledPorteFauxAvant;
  }, []);

  // Fonction pour détecter le côté le plus proche d'un meuble par rapport au point cliqué
  const getClosestSide = useCallback((item: paper.Group, clickPoint: paper.Point): FurnitureSide => {
    const bounds = item.bounds;

    // Distances aux 4 côtés
    const distances = {
      left: Math.abs(clickPoint.x - bounds.left),
      right: Math.abs(clickPoint.x - bounds.right),
      top: Math.abs(clickPoint.y - bounds.top),
      bottom: Math.abs(clickPoint.y - bounds.bottom),
    };

    // Trouver le côté le plus proche
    let minDist = Infinity;
    let closest: FurnitureSide = "left";
    (Object.keys(distances) as FurnitureSide[]).forEach((side) => {
      if (distances[side] < minDist) {
        minDist = distances[side];
        closest = side;
      }
    });

    return closest;
  }, []);

  // Fonction pour obtenir la position (X ou Y) d'un côté
  const getSidePosition = useCallback((item: paper.Group, side: FurnitureSide): number => {
    const bounds = item.bounds;
    switch (side) {
      case "left":
        return bounds.left;
      case "right":
        return bounds.right;
      case "top":
        return bounds.top;
      case "bottom":
        return bounds.bottom;
    }
  }, []);

  // Fonction pour créer une ligne de surbrillance sur un côté
  const createSideHighlight = useCallback(
    (item: paper.Group, side: FurnitureSide, color: string, dataFlag: string): paper.Path.Line => {
      const bounds = item.bounds;
      let from: paper.Point, to: paper.Point;

      switch (side) {
        case "left":
          from = new paper.Point(bounds.left, bounds.top);
          to = new paper.Point(bounds.left, bounds.bottom);
          break;
        case "right":
          from = new paper.Point(bounds.right, bounds.top);
          to = new paper.Point(bounds.right, bounds.bottom);
          break;
        case "top":
          from = new paper.Point(bounds.left, bounds.top);
          to = new paper.Point(bounds.right, bounds.top);
          break;
        case "bottom":
          from = new paper.Point(bounds.left, bounds.bottom);
          to = new paper.Point(bounds.right, bounds.bottom);
          break;
      }

      const highlight = new paper.Path.Line(from, to);
      highlight.strokeColor = new paper.Color(color);
      highlight.strokeWidth = 4;
      highlight.data[dataFlag] = true;
      return highlight;
    },
    [],
  );

  // Fonction pour appliquer l'alignement (aligner les côtés sur le même plan)
  const applyAlign = useCallback(
    (source: AlignSelection, target: AlignSelection) => {
      const sourcePos = getSidePosition(source.item, source.side);
      const targetPos = getSidePosition(target.item, target.side);

      // Calculer le déplacement nécessaire
      let delta: paper.Point;
      if (source.side === "left" || source.side === "right") {
        // Alignement horizontal (même X)
        delta = new paper.Point(targetPos - sourcePos, 0);
      } else {
        // Alignement vertical (même Y)
        delta = new paper.Point(0, targetPos - sourcePos);
      }

      // Déplacer le meuble source
      source.item.position = source.item.position.add(delta);

      const currentScale = scaleRef.current;
      const deltaMm = Math.round(Math.sqrt(delta.x * delta.x + delta.y * delta.y) / currentScale);
      toast.success(`Meuble aligné (déplacement: ${deltaMm} mm)`);

      // Nettoyer les highlights
      if (paper.project && paper.project.activeLayer) {
        const toRemove: paper.Item[] = [];
        paper.project.activeLayer.children.forEach((child) => {
          if (child.data.isAlignIndicator) {
            toRemove.push(child);
          }
        });
        toRemove.forEach((item) => item.remove());
      }

      // Réinitialiser l'outil
      setAlignStep(0);
      setAlignSource(null);
      setAlignHighlight(null);
    },
    [getSidePosition],
  );

  // Fonction pour appliquer le collage (coller deux meubles l'un contre l'autre)
  const applySnap = useCallback(
    (source: AlignSelection, target: AlignSelection) => {
      const sourceBounds = source.item.bounds;
      const targetBounds = target.item.bounds;

      // Calculer le déplacement pour coller les côtés
      let delta: paper.Point;

      // Selon les côtés sélectionnés, on calcule le déplacement
      if (source.side === "right" && target.side === "left") {
        // Coller le côté droit de source contre le côté gauche de target
        delta = new paper.Point(targetBounds.left - sourceBounds.right, 0);
      } else if (source.side === "left" && target.side === "right") {
        // Coller le côté gauche de source contre le côté droit de target
        delta = new paper.Point(targetBounds.right - sourceBounds.left, 0);
      } else if (source.side === "bottom" && target.side === "top") {
        // Coller le côté bas de source contre le côté haut de target
        delta = new paper.Point(0, targetBounds.top - sourceBounds.bottom);
      } else if (source.side === "top" && target.side === "bottom") {
        // Coller le côté haut de source contre le côté bas de target
        delta = new paper.Point(0, targetBounds.bottom - sourceBounds.top);
      } else if (source.side === "left" && target.side === "left") {
        // Les deux côtés gauches → coller sur le même X
        delta = new paper.Point(targetBounds.left - sourceBounds.left, 0);
      } else if (source.side === "right" && target.side === "right") {
        // Les deux côtés droits → coller sur le même X
        delta = new paper.Point(targetBounds.right - sourceBounds.right, 0);
      } else if (source.side === "top" && target.side === "top") {
        // Les deux côtés hauts → coller sur le même Y
        delta = new paper.Point(0, targetBounds.top - sourceBounds.top);
      } else if (source.side === "bottom" && target.side === "bottom") {
        // Les deux côtés bas → coller sur le même Y
        delta = new paper.Point(0, targetBounds.bottom - sourceBounds.bottom);
      } else {
        // Cas par défaut: coller les centres des côtés
        const sourcePos = getSidePosition(source.item, source.side);
        const targetPos = getSidePosition(target.item, target.side);
        if (source.side === "left" || source.side === "right") {
          delta = new paper.Point(targetPos - sourcePos, 0);
        } else {
          delta = new paper.Point(0, targetPos - sourcePos);
        }
      }

      // Déplacer le meuble source
      source.item.position = source.item.position.add(delta);

      const currentScale = scaleRef.current;
      const deltaMm = Math.round(Math.sqrt(delta.x * delta.x + delta.y * delta.y) / currentScale);
      toast.success(`Meuble collé (déplacement: ${deltaMm} mm)`);

      // Nettoyer les highlights
      if (paper.project && paper.project.activeLayer) {
        const toRemove: paper.Item[] = [];
        paper.project.activeLayer.children.forEach((child) => {
          if (child.data.isSnapIndicator) {
            toRemove.push(child);
          }
        });
        toRemove.forEach((item) => item.remove());
      }

      // Réinitialiser l'outil
      setSnapStep(0);
      setSnapSource(null);
      setSnapHighlight(null);
    },
    [getSidePosition],
  );

  // Fonctions de zoom
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 4;
  const ZOOM_STEP = 0.1;

  const handleZoom = useCallback(
    (delta: number, centerX?: number, centerY?: number) => {
      if (!paper.view) return;

      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));

      if (newZoom !== zoomLevel) {
        // Si on a un point de centre (position de la souris), zoomer vers ce point
        if (centerX !== undefined && centerY !== undefined) {
          const viewPosition = new paper.Point(centerX, centerY);
          const viewCenter = paper.view.center;

          // Calculer le nouveau centre pour zoomer vers le point de la souris
          const zoomFactor = newZoom / zoomLevel;
          const newCenter = viewCenter.add(viewPosition.subtract(viewCenter).multiply(1 - 1 / zoomFactor));

          paper.view.zoom = newZoom;
          paper.view.center = newCenter;
        } else {
          paper.view.zoom = newZoom;
        }

        setZoomLevel(newZoom);
      }
    },
    [zoomLevel],
  );

  const handleZoomIn = useCallback(() => {
    handleZoom(ZOOM_STEP);
  }, [handleZoom]);

  const handleZoomOut = useCallback(() => {
    handleZoom(-ZOOM_STEP);
  }, [handleZoom]);

  const handleZoomReset = useCallback(() => {
    if (!paper.view) return;
    paper.view.zoom = 1;
    paper.view.center = new paper.Point(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    setZoomLevel(1);
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();

      // Récupérer la position de la souris relative au canvas
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Convertir en coordonnées Paper.js
      const viewPoint = paper.view?.viewToProject(new paper.Point(mouseX, mouseY));

      // Delta négatif = scroll vers le haut = zoom in
      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;

      handleZoom(delta, viewPoint?.x, viewPoint?.y);
    },
    [handleZoom],
  );

  // Gestion du pan (déplacement) avec l'outil Main
  const handleMouseDownForPan = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      // Clic gauche quand l'outil pan est actif
      if (event.button === 0 && activeTool === "pan") {
        event.preventDefault();
        event.stopPropagation();
        setIsPanning(true);
        setPanStart({ x: event.clientX, y: event.clientY });
        lastPanPoint.current = { x: event.clientX, y: event.clientY };
      }
    },
    [activeTool],
  );

  const handleMouseMoveForPan = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (isPanning && lastPanPoint.current && paper.view) {
        event.preventDefault();
        const deltaX = event.clientX - lastPanPoint.current.x;
        const deltaY = event.clientY - lastPanPoint.current.y;

        // Déplacer la vue dans la direction opposée au mouvement de la souris
        const currentCenter = paper.view.center;
        paper.view.center = new paper.Point(
          currentCenter.x - deltaX / paper.view.zoom,
          currentCenter.y - deltaY / paper.view.zoom,
        );

        lastPanPoint.current = { x: event.clientX, y: event.clientY };
      }
    },
    [isPanning],
  );

  const handleMouseUpForPan = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (isPanning) {
        event.preventDefault();
        setIsPanning(false);
        setPanStart(null);
        lastPanPoint.current = null;
      }
    },
    [isPanning],
  );

  // Fonctions pour le plein écran
  const calculateFullscreenScale = useCallback(() => {
    // Calculer le scale pour remplir l'écran tout en gardant le ratio
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const padding = 40; // Marge pour les contrôles

    const scaleX = (screenWidth - padding) / CANVAS_WIDTH;
    const scaleY = (screenHeight - padding) / CANVAS_HEIGHT;

    // Prendre le plus petit pour garder tout visible
    return Math.min(scaleX, scaleY, 2); // Max 2x pour éviter le flou
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!canvasContainerRef.current) return;

    if (!document.fullscreenElement) {
      canvasContainerRef.current
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
          setFullscreenScale(calculateFullscreenScale());
        })
        .catch((err) => {
          console.error("Erreur plein écran:", err);
          toast.error("Impossible de passer en plein écran");
        });
    } else {
      document
        .exitFullscreen()
        .then(() => {
          setIsFullscreen(false);
          setFullscreenScale(1);
        })
        .catch((err) => {
          console.error("Erreur sortie plein écran:", err);
        });
    }
  }, [calculateFullscreenScale]);

  // Écouter les changements de plein écran (ex: touche Échap)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      if (isNowFullscreen) {
        setFullscreenScale(calculateFullscreenScale());
      } else {
        setFullscreenScale(1);
      }
    };

    const handleResize = () => {
      if (isFullscreen) {
        setFullscreenScale(calculateFullscreenScale());
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("resize", handleResize);
    };
  }, [isFullscreen, calculateFullscreenScale]);

  // Fonction pour appliquer la nouvelle distance de cotation
  const applyCotation = useCallback(() => {
    if (!cotationReference || !cotationTarget) return;

    const newDistanceMm = Number(cotationNewDistance);
    if (isNaN(newDistanceMm) || newDistanceMm < 0) {
      toast.error("Distance invalide");
      return;
    }

    const currentScale = scaleRef.current;
    const newDistancePx = newDistanceMm * currentScale;
    const newX = cotationReference.x + newDistancePx;

    // Cas 1: Repositionner un meuble
    if (cotationTarget.type === "furniture" && cotationTarget.itemId && paper.project && paper.project.activeLayer) {
      paper.project.activeLayer.children.forEach((child) => {
        if (child instanceof paper.Group && child.data.furnitureId === cotationTarget.itemId) {
          const deltaX = newX - child.bounds.center.x;
          child.position = child.position.add(new paper.Point(deltaX, 0));

          // Mettre à jour le label de distance AV dans le meuble
          const distanceAV = Math.round((newX - getEssieuAvX()) / currentScale);
          console.log("📏 Nouvelle distance essieu AV:", distanceAV, "mm");

          toast.success(`Meuble repositionné à ${newDistanceMm} mm de la référence`);
        }
      });
    }

    // Cas 2: Repositionner la zone de chargement
    if (cotationTarget.type === "load_area") {
      const currentVehicleLength = vehicleLengthRef.current;
      const scaledVehicleLength = currentVehicleLength * currentScale;
      const vehicleLeft = (CANVAS_WIDTH - scaledVehicleLength) / 2;

      // Calculer le nouvel offset (en mm)
      const newLoadAreaLeftPx = newX;
      const newOffsetPx = newLoadAreaLeftPx - vehicleLeft;
      const newOffsetMm = Math.round(newOffsetPx / currentScale);

      // Vérifier que l'offset est valide (entre 0 et vehicleLength - loadAreaLength)
      const maxOffset = currentVehicleLength - loadAreaLengthRef.current;
      const clampedOffset = Math.max(0, Math.min(maxOffset, newOffsetMm));

      console.log("📐 Nouvel offset zone chargement:", clampedOffset, "mm");
      setLoadAreaOffsetX(clampedOffset);

      toast.success(`Zone de chargement repositionnée à ${newDistanceMm} mm de ${cotationReference.label}`);
    }

    // Fermer le dialogue et réinitialiser
    setShowCotationDialog(false);
    setCotationStep(0);
    setCotationReference(null);
    setCotationTarget(null);
    setCotationNewDistance("");

    // Supprimer tous les éléments temporaires de cotation
    if (paper.project && paper.project.activeLayer) {
      const toRemove: paper.Item[] = [];
      paper.project.activeLayer.children.forEach((child) => {
        if (child.data.isCotationIndicator || child.data.isCotationLine || child.data.isCotationText) {
          toRemove.push(child);
        }
      });
      toRemove.forEach((item) => item.remove());
    }
    if (cotationLine) {
      cotationLine.remove();
      setCotationLine(null);
    }

    // Sauvegarder automatiquement
    setTimeout(() => {
      (window as any).layoutCanvasSave?.();
    }, 100);
  }, [cotationReference, cotationTarget, cotationNewDistance, cotationLine, getEssieuAvX]);

  // Fonction pour nettoyer tous les éléments temporaires de cotation
  const cleanupCotationElements = useCallback(() => {
    if (paper.project && paper.project.activeLayer) {
      const toRemove: paper.Item[] = [];
      paper.project.activeLayer.children.forEach((child) => {
        if (child.data.isCotationIndicator || child.data.isCotationLine || child.data.isCotationText) {
          toRemove.push(child);
        }
      });
      toRemove.forEach((item) => item.remove());
    }
    if (cotationLine) {
      cotationLine.remove();
      setCotationLine(null);
    }
  }, [cotationLine]);

  // Fonction pour annuler la cotation
  const cancelCotation = useCallback(() => {
    setShowCotationDialog(false);
    setCotationStep(0);
    setCotationReference(null);
    setCotationTarget(null);
    setCotationNewDistance("");
    cleanupCotationElements();
  }, [cleanupCotationElements]);

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
      // Supprimer les anciens rectangles s'ils existent
      paper.project.activeLayer.children.forEach((child) => {
        if (child.data?.isLoadAreaOutline || child.data?.isVehicleOutline) {
          child.remove();
        }
      });

      const currentScale = scaleRef.current;
      const currentLength = loadAreaLengthRef.current;
      const currentWidth = loadAreaWidthRef.current;
      const currentOffsetX = loadAreaOffsetXRef.current;
      const currentVehicleLength = vehicleLengthRef.current;
      const currentVehicleWidth = vehicleWidthRef.current;

      const scaledLength = currentLength * currentScale;
      const scaledWidth = currentWidth * currentScale;
      const scaledOffsetX = currentOffsetX * currentScale;

      // Calculer les dimensions du véhicule complet
      const scaledVehicleLength = currentVehicleLength * currentScale;
      const scaledVehicleWidth = currentVehicleWidth * currentScale;

      // Position du véhicule (centré dans le canvas)
      const vehicleLeft = (CANVAS_WIDTH - scaledVehicleLength) / 2;
      const vehicleTop = (CANVAS_HEIGHT - scaledVehicleWidth) / 2;

      // Position de la zone de chargement (avec offset depuis l'avant du véhicule)
      const loadAreaLeft = vehicleLeft + scaledOffsetX;
      const loadAreaTop = vehicleTop + (scaledVehicleWidth - scaledWidth) / 2; // Centré verticalement

      console.log("🚐 Dessin contours:", {
        vehicule: { longueur: currentVehicleLength, largeur: currentVehicleWidth },
        zoneChargement: { longueur: currentLength, largeur: currentWidth, offsetX: currentOffsetX },
        echelle: currentScale,
      });

      // 1. Contour GRIS = Véhicule complet (dimensions totales)
      const vehicleOutline = new paper.Path.Rectangle({
        point: [vehicleLeft, vehicleTop],
        size: [scaledVehicleLength, scaledVehicleWidth],
        strokeColor: new paper.Color("#6b7280"),
        strokeWidth: 2,
        fillColor: new paper.Color("#f3f4f6"),
        locked: true,
      });
      vehicleOutline.fillColor!.alpha = 0.3;
      vehicleOutline.data.isVehicleOutline = true;
      vehicleOutline.sendToBack();

      // Label dimensions véhicule
      const vehicleLabelTop = new paper.PointText({
        point: [CANVAS_WIDTH / 2, vehicleTop - 8],
        content: `Véhicule: ${currentVehicleLength} x ${currentVehicleWidth} mm`,
        fillColor: new paper.Color("#6b7280"),
        fontSize: 10,
        justification: "center",
      });
      vehicleLabelTop.data.isVehicleOutline = true;
      vehicleLabelTop.locked = true;

      // 2. Contour BLEU pointillé = Zone de chargement (positionnée avec offset)
      const loadAreaOutline = new paper.Path.Rectangle({
        point: [loadAreaLeft, loadAreaTop],
        size: [scaledLength, scaledWidth],
        strokeColor: new paper.Color("#3b82f6"),
        strokeWidth: 3,
        dashArray: [10, 5],
        fillColor: new paper.Color("#dbeafe"),
        locked: true,
      });
      loadAreaOutline.fillColor!.alpha = 0.4;
      loadAreaOutline.data.isLoadAreaOutline = true;

      // Label zone de chargement
      const loadAreaLabel = new paper.PointText({
        point: [loadAreaLeft + scaledLength / 2, loadAreaTop + scaledWidth + 15],
        content: `Zone chargement: ${currentLength} x ${currentWidth} mm`,
        fillColor: new paper.Color("#3b82f6"),
        fontSize: 10,
        justification: "center",
      });
      loadAreaLabel.data.isLoadAreaOutline = true;
      loadAreaLabel.locked = true;

      // Afficher l'échelle en bas à gauche
      const scaleRatio = Math.round(1 / currentScale);
      const scaleLabel = new paper.PointText({
        point: [10, CANVAS_HEIGHT - 10],
        content: `Échelle : 1:${scaleRatio}`,
        fillColor: new paper.Color("#6b7280"),
        fontSize: 11,
        fontWeight: "bold",
        justification: "left",
      });
      scaleLabel.data.isLoadAreaOutline = true;
      scaleLabel.locked = true;
    };

    // Fonction pour dessiner les éléments VASP (essieux, contour véhicule)
    const drawVASPElements = () => {
      // Supprimer les anciens éléments VASP
      paper.project.activeLayer.children.forEach((child) => {
        if (child.data?.isVASPElement) {
          child.remove();
        }
      });

      const currentScale = scaleRef.current;
      const currentVehicleLength = vehicleLengthRef.current;
      const currentVehicleWidth = vehicleWidthRef.current;
      const scaledVehicleLength = currentVehicleLength * currentScale;
      const scaledVehicleWidth = currentVehicleWidth * currentScale;

      // Position du véhicule (centré dans le canvas)
      const vehicleLeft = (CANVAS_WIDTH - scaledVehicleLength) / 2;
      const vehicleTop = (CANVAS_HEIGHT - scaledVehicleWidth) / 2;

      // Utiliser les refs pour les valeurs COC
      const currentEmpattement = empattementRef.current;
      const currentPorteFauxAvant = porteFauxAvantRef.current;

      // Calculer les positions des essieux si empattement est fourni
      if (currentEmpattement && currentEmpattement > 0) {
        const scaledEmpattement = currentEmpattement * currentScale;
        const calculatedPorteFauxAvant = currentPorteFauxAvant || Math.round(currentVehicleLength * 0.15);
        const scaledPorteFauxAvant = calculatedPorteFauxAvant * currentScale;

        // Position de l'essieu avant (à partir du bord gauche du véhicule + porte-à-faux)
        const essieuAvX = vehicleLeft + scaledPorteFauxAvant;

        // Ligne essieu avant (pointillés verts)
        const essieuAv = new paper.Path.Line({
          from: [essieuAvX, vehicleTop - 20],
          to: [essieuAvX, vehicleTop + scaledVehicleWidth + 20],
          strokeColor: new paper.Color("#22c55e"),
          strokeWidth: 2,
          dashArray: [8, 4],
        });
        essieuAv.data.isVASPElement = true;
        essieuAv.data.elementType = "essieu_av";
        essieuAv.locked = true;

        // Label essieu avant
        const labelAv = new paper.PointText({
          point: [essieuAvX, vehicleTop - 25],
          content: "Essieu AV",
          fillColor: new paper.Color("#22c55e"),
          fontSize: 10,
          fontWeight: "bold",
          justification: "center",
        });
        labelAv.data.isVASPElement = true;
        labelAv.locked = true;

        // Position de l'essieu arrière
        const essieuArX = essieuAvX + scaledEmpattement;

        // Ligne essieu arrière (pointillés verts)
        const essieuAr = new paper.Path.Line({
          from: [essieuArX, vehicleTop - 20],
          to: [essieuArX, vehicleTop + scaledVehicleWidth + 20],
          strokeColor: new paper.Color("#22c55e"),
          strokeWidth: 2,
          dashArray: [8, 4],
        });
        essieuAr.data.isVASPElement = true;
        essieuAr.data.elementType = "essieu_ar";
        essieuAr.locked = true;

        // Label essieu arrière
        const labelAr = new paper.PointText({
          point: [essieuArX, vehicleTop - 25],
          content: "Essieu AR",
          fillColor: new paper.Color("#22c55e"),
          fontSize: 10,
          fontWeight: "bold",
          justification: "center",
        });
        labelAr.data.isVASPElement = true;
        labelAr.locked = true;

        // Côte d'empattement (flèche horizontale entre les essieux)
        const coteY = vehicleTop + scaledVehicleWidth + 35;
        const coteLine = new paper.Path();
        coteLine.add(new paper.Point(essieuAvX, coteY));
        coteLine.add(new paper.Point(essieuArX, coteY));
        coteLine.strokeColor = new paper.Color("#22c55e");
        coteLine.strokeWidth = 1;
        coteLine.data.isVASPElement = true;
        coteLine.locked = true;

        // Flèches aux extrémités
        const arrowSize = 6;
        const arrowLeft = new paper.Path();
        arrowLeft.add(new paper.Point(essieuAvX + arrowSize, coteY - arrowSize / 2));
        arrowLeft.add(new paper.Point(essieuAvX, coteY));
        arrowLeft.add(new paper.Point(essieuAvX + arrowSize, coteY + arrowSize / 2));
        arrowLeft.strokeColor = new paper.Color("#22c55e");
        arrowLeft.strokeWidth = 1;
        arrowLeft.data.isVASPElement = true;
        arrowLeft.locked = true;

        const arrowRight = new paper.Path();
        arrowRight.add(new paper.Point(essieuArX - arrowSize, coteY - arrowSize / 2));
        arrowRight.add(new paper.Point(essieuArX, coteY));
        arrowRight.add(new paper.Point(essieuArX - arrowSize, coteY + arrowSize / 2));
        arrowRight.strokeColor = new paper.Color("#22c55e");
        arrowRight.strokeWidth = 1;
        arrowRight.data.isVASPElement = true;
        arrowRight.locked = true;

        // Texte de la cote
        const coteText = new paper.PointText({
          point: [(essieuAvX + essieuArX) / 2, coteY - 5],
          content: `${currentEmpattement} mm`,
          fillColor: new paper.Color("#22c55e"),
          fontSize: 11,
          fontWeight: "bold",
          justification: "center",
        });
        coteText.data.isVASPElement = true;
        coteText.locked = true;

        // Dessiner les rangées de sièges
        if (rangeesSieges && rangeesSieges.length > 0) {
          rangeesSieges.forEach((rangee) => {
            const siegeX = essieuAvX + rangee.distance_essieu_av_mm * currentScale;

            // Ligne horizontale pour la rangée de sièges (orange)
            const siegeLine = new paper.Path.Line({
              from: [siegeX, vehicleTop + 10],
              to: [siegeX, vehicleTop + scaledVehicleWidth - 10],
              strokeColor: new paper.Color("#f97316"),
              strokeWidth: 3,
              dashArray: [4, 2],
            });
            siegeLine.data.isVASPElement = true;
            siegeLine.data.elementType = "rangee_siege";
            siegeLine.data.rangeeId = rangee.id;
            siegeLine.locked = true;

            // Icônes de sièges
            const siegeIconSize = 12;
            const siegeSpacing = scaledVehicleWidth / (rangee.nombre_places + 1);

            for (let i = 1; i <= rangee.nombre_places; i++) {
              const siegeY = vehicleTop + siegeSpacing * i;

              // Rectangle représentant un siège
              const siegeRect = new paper.Path.Rectangle({
                point: [siegeX - siegeIconSize / 2, siegeY - siegeIconSize / 2],
                size: [siegeIconSize, siegeIconSize],
                fillColor: new paper.Color("#f97316"),
                strokeColor: new paper.Color("#ea580c"),
                strokeWidth: 1,
                radius: 2,
              });
              siegeRect.data.isVASPElement = true;
              siegeRect.locked = true;
            }

            // Label de la rangée
            const siegeLabel = new paper.PointText({
              point: [siegeX, vehicleTop - 5],
              content: `R${rangee.numero_rangee} (${rangee.nombre_places}p)`,
              fillColor: new paper.Color("#f97316"),
              fontSize: 9,
              fontWeight: "bold",
              justification: "center",
            });
            siegeLabel.data.isVASPElement = true;
            siegeLabel.locked = true;

            // Cote de distance à l'essieu AV
            const coteSiegeY = vehicleTop + scaledVehicleWidth + 55;
            const coteSiegeLine = new paper.Path.Line({
              from: [essieuAvX, coteSiegeY],
              to: [siegeX, coteSiegeY],
              strokeColor: new paper.Color("#f97316"),
              strokeWidth: 1,
            });
            coteSiegeLine.data.isVASPElement = true;
            coteSiegeLine.locked = true;

            const coteSiegeText = new paper.PointText({
              point: [(essieuAvX + siegeX) / 2, coteSiegeY - 3],
              content: `${rangee.distance_essieu_av_mm} mm`,
              fillColor: new paper.Color("#f97316"),
              fontSize: 9,
              justification: "center",
            });
            coteSiegeText.data.isVASPElement = true;
            coteSiegeText.locked = true;
          });
        }

        console.log("🚗 Dessin éléments VASP:", {
          empattement: currentEmpattement,
          essieuAvX,
          essieuArX,
          rangeesSieges: rangeesSieges?.length || 0,
        });
      }
    };

    // Fonction pour afficher la distance à l'essieu AV pour les meubles
    const drawFurnitureDistances = () => {
      const currentEmpattement = empattementRef.current;
      const currentPorteFauxAvant = porteFauxAvantRef.current;

      if (!showVASPOverlay || !currentEmpattement || currentEmpattement <= 0) return;

      const currentScale = scaleRef.current;
      const currentVehicleLength = vehicleLengthRef.current;
      const scaledVehicleLength = currentVehicleLength * currentScale;
      const vehicleLeft = (CANVAS_WIDTH - scaledVehicleLength) / 2;
      const calculatedPorteFauxAvant = currentPorteFauxAvant || Math.round(currentVehicleLength * 0.15);
      const scaledPorteFauxAvant = calculatedPorteFauxAvant * currentScale;
      const essieuAvX = vehicleLeft + scaledPorteFauxAvant;

      // Parcourir tous les meubles et afficher leur distance
      paper.project.activeLayer.children.forEach((child) => {
        if (child instanceof paper.Group && child.data.isFurniture && child.data.furnitureId) {
          const furnitureX = child.bounds.center.x;
          const distanceMm = Math.round((furnitureX - essieuAvX) / currentScale);

          // Supprimer l'ancien label de distance s'il existe
          paper.project.activeLayer.children.forEach((label) => {
            if (label.data.isDistanceLabel && label.data.forFurnitureId === child.data.furnitureId) {
              label.remove();
            }
          });

          // Afficher la distance sous le meuble
          const distanceLabel = new paper.PointText({
            point: [child.bounds.center.x, child.bounds.bottom + 12],
            content: `↔ ${distanceMm} mm`,
            fillColor: new paper.Color("#8b5cf6"),
            fontSize: 9,
            fontWeight: "bold",
            justification: "center",
          });
          distanceLabel.data.isDistanceLabel = true;
          distanceLabel.data.forFurnitureId = child.data.furnitureId;
          distanceLabel.data.isVASPElement = true;
          distanceLabel.locked = true;

          // Mettre à jour la distance dans les données du meuble
          const furnitureData = furnitureItemsRef.current.get(child.data.furnitureId);
          if (furnitureData) {
            furnitureData.distance_essieu_av_mm = distanceMm;
          }
        }
      });
    };

    // Dessiner le contour initial
    drawLoadAreaOutline();

    // Toujours dessiner les éléments VASP (la visibilité est gérée par un useEffect séparé)
    drawVASPElements();

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
      // Mode cotation intelligente
      if (activeToolRef.current === "cotation") {
        const hitResult = paper.project.hitTest(event.point, {
          fill: true,
          stroke: true,
          tolerance: 10,
        });

        const currentScale = scaleRef.current;
        const currentVehicleLength = vehicleLengthRef.current;
        const currentVehicleWidth = vehicleWidthRef.current;
        const scaledVehicleLength = currentVehicleLength * currentScale;
        const scaledVehicleWidth = currentVehicleWidth * currentScale;
        const vehicleLeft = (CANVAS_WIDTH - scaledVehicleLength) / 2;
        const vehicleTop = (CANVAS_HEIGHT - scaledVehicleWidth) / 2;

        // Utiliser les refs pour les valeurs COC
        const currentEmpattement = empattementRef.current;
        const currentPorteFauxAvant = porteFauxAvantRef.current;

        // Calculer la position de l'essieu AV
        const calculatedPorteFauxAvant = currentPorteFauxAvant || Math.round(currentVehicleLength * 0.15);
        const scaledPorteFauxAvant = calculatedPorteFauxAvant * currentScale;
        const essieuAvX = vehicleLeft + scaledPorteFauxAvant;

        // Calculer la position de la zone de chargement
        const currentOffsetX = loadAreaOffsetXRef.current;
        const currentLoadLength = loadAreaLengthRef.current;
        const currentLoadWidth = loadAreaWidthRef.current;
        const scaledOffsetX = currentOffsetX * currentScale;
        const scaledLoadLength = currentLoadLength * currentScale;
        const scaledLoadWidth = currentLoadWidth * currentScale;
        const loadAreaLeft = vehicleLeft + scaledOffsetX;
        const loadAreaTop = vehicleTop + (scaledVehicleWidth - scaledLoadWidth) / 2;

        // Vérifier si on clique sur un essieu VASP
        let clickedOnEssieuAv = false;
        let clickedOnEssieuAr = false;
        let clickedOnLoadAreaLeft = false; // Bord gauche de la zone de chargement
        let clickedItem: paper.Item | null = null;
        let clickedFurnitureId: string | null = null;

        if (hitResult?.item) {
          if (hitResult.item.data.elementType === "essieu_av") {
            clickedOnEssieuAv = true;
          } else if (hitResult.item.data.elementType === "essieu_ar") {
            clickedOnEssieuAr = true;
          } else if (hitResult.item.parent instanceof paper.Group && hitResult.item.parent.data.isFurniture) {
            clickedItem = hitResult.item.parent;
            clickedFurnitureId = hitResult.item.parent.data.furnitureId;
          } else if (hitResult.item instanceof paper.Group && hitResult.item.data.isFurniture) {
            clickedItem = hitResult.item;
            clickedFurnitureId = hitResult.item.data.furnitureId;
          } else if (hitResult.item.data.isLoadAreaOutline) {
            // Vérifier si on clique sur le bord gauche de la zone de chargement
            const tolerance = 15;
            if (Math.abs(event.point.x - loadAreaLeft) < tolerance) {
              clickedOnLoadAreaLeft = true;
            }
          }
        }

        // Si on a cliqué sur l'essieu AV/AR, on peut aussi vérifier par la position X
        if (!clickedOnEssieuAv && currentEmpattement && currentEmpattement > 0) {
          const tolerance = 15;
          if (Math.abs(event.point.x - essieuAvX) < tolerance) {
            clickedOnEssieuAv = true;
          }
          const essieuArX = essieuAvX + currentEmpattement * currentScale;
          if (Math.abs(event.point.x - essieuArX) < tolerance) {
            clickedOnEssieuAr = true;
          }
        }

        // Vérifier si on clique sur le bord gauche de la zone de chargement par position
        if (!clickedOnLoadAreaLeft) {
          const tolerance = 15;
          if (
            Math.abs(event.point.x - loadAreaLeft) < tolerance &&
            event.point.y >= loadAreaTop &&
            event.point.y <= loadAreaTop + scaledLoadWidth
          ) {
            clickedOnLoadAreaLeft = true;
          }
        }

        const step = cotationStepRef.current;

        if (step === 0) {
          // Première sélection (référence)
          let reference: { x: number; type: string; label: string } | null = null;

          if (clickedOnEssieuAv) {
            reference = { x: essieuAvX, type: "essieu_av", label: "Essieu AV" };
          } else if (clickedOnEssieuAr) {
            const essieuArX = essieuAvX + (currentEmpattement || 0) * currentScale;
            reference = { x: essieuArX, type: "essieu_ar", label: "Essieu AR" };
          } else if (clickedItem) {
            reference = {
              x: clickedItem.bounds.center.x,
              type: "furniture",
              label: `Meuble ${clickedFurnitureId?.slice(-4) || ""}`,
            };
          }

          if (reference) {
            setCotationReference(reference);
            setCotationStep(1);
            toast.info(`Référence: ${reference.label}. Cliquez sur un meuble ou le bord de la zone de chargement.`);

            // Créer un indicateur visuel sur l'élément de référence
            const indicator = new paper.Path.Circle({
              center: [reference.x, event.point.y],
              radius: 8,
              fillColor: new paper.Color("#8b5cf6"),
              strokeColor: new paper.Color("#6d28d9"),
              strokeWidth: 2,
            });
            indicator.data.isCotationIndicator = true;
          } else {
            toast.warning("Cliquez sur un essieu ou un meuble pour définir la référence");
          }
        } else if (step === 1 && cotationReferenceRef.current) {
          // Deuxième sélection (cible) - meuble OU zone de chargement
          let targetX: number | null = null;
          let targetType: string = "";
          let targetLabel: string = "";
          let targetItemId: string | undefined = undefined;

          if (clickedItem && clickedFurnitureId) {
            targetX = clickedItem.bounds.center.x;
            targetType = "furniture";
            targetLabel = `Meuble ${clickedFurnitureId.slice(-4)}`;
            targetItemId = clickedFurnitureId;
          } else if (clickedOnLoadAreaLeft) {
            targetX = loadAreaLeft;
            targetType = "load_area";
            targetLabel = "Zone de chargement";
            targetItemId = "load_area";
          }

          if (targetX !== null) {
            const referenceX = cotationReferenceRef.current.x;
            const distancePx = Math.abs(targetX - referenceX);
            const distanceMm = Math.round(distancePx / currentScale);

            setCotationTarget({
              x: targetX,
              type: targetType,
              label: targetLabel,
              itemId: targetItemId,
            });
            setCotationCurrentDistance(distanceMm);
            setCotationNewDistance(distanceMm.toString());
            setCotationStep(2);

            // Dessiner une ligne de cotation temporaire
            const cotLine = new paper.Path.Line({
              from: [referenceX, event.point.y],
              to: [targetX, event.point.y],
              strokeColor: new paper.Color("#8b5cf6"),
              strokeWidth: 2,
              dashArray: [8, 4],
            });
            cotLine.data.isCotationLine = true;
            setCotationLine(cotLine);

            // Ajouter le texte de distance
            const midX = (referenceX + targetX) / 2;
            const cotText = new paper.PointText({
              point: [midX, event.point.y - 10],
              content: `${distanceMm} mm`,
              fillColor: new paper.Color("#8b5cf6"),
              fontSize: 12,
              fontWeight: "bold",
              justification: "center",
            });
            cotText.data.isCotationText = true;

            // Afficher le dialogue
            setShowCotationDialog(true);
          } else {
            toast.warning("Cliquez sur un meuble pour définir la cible");
          }
        }

        return;
      }

      // Mode Aligner (align)
      if (activeToolRef.current === "align") {
        const hitResult = paper.project.hitTest(event.point, {
          fill: true,
          stroke: true,
          tolerance: 10,
        });

        // Chercher un meuble
        let clickedFurniture: paper.Group | null = null;
        if (hitResult?.item) {
          if (hitResult.item.parent instanceof paper.Group && hitResult.item.parent.data.isFurniture) {
            clickedFurniture = hitResult.item.parent as paper.Group;
          } else if (hitResult.item instanceof paper.Group && hitResult.item.data.isFurniture) {
            clickedFurniture = hitResult.item as paper.Group;
          }
        }

        if (!clickedFurniture) {
          toast.warning("Cliquez sur un meuble");
          return;
        }

        const currentAlignStep = alignStepRef.current;
        const currentAlignSource = alignSourceRef.current;

        if (currentAlignStep === 0) {
          // Première sélection - meuble source
          const side = getClosestSide(clickedFurniture, event.point);
          const position = getSidePosition(clickedFurniture, side);

          // Supprimer les anciens highlights
          if (paper.project && paper.project.activeLayer) {
            paper.project.activeLayer.children.forEach((child) => {
              if (child.data.isAlignIndicator) child.remove();
            });
          }

          // Créer le highlight bleu
          const highlight = createSideHighlight(clickedFurniture, side, "#3b82f6", "isAlignIndicator");
          setAlignHighlight(highlight);

          setAlignSource({
            furnitureId: clickedFurniture.data.furnitureId,
            side,
            position,
            item: clickedFurniture,
          });
          setAlignStep(1);

          const sideLabels = { left: "gauche", right: "droit", top: "haut", bottom: "bas" };
          toast.info(`Meuble 1 sélectionné (côté ${sideLabels[side]}). Cliquez sur le côté du meuble 2 pour aligner.`);
        } else if (currentAlignStep === 1 && currentAlignSource) {
          // Deuxième sélection - meuble cible
          if (clickedFurniture.data.furnitureId === currentAlignSource.furnitureId) {
            toast.warning("Sélectionnez un autre meuble");
            return;
          }

          const side = getClosestSide(clickedFurniture, event.point);

          // Vérifier que les côtés sont compatibles (même orientation)
          const sourceIsHorizontal = currentAlignSource.side === "left" || currentAlignSource.side === "right";
          const targetIsHorizontal = side === "left" || side === "right";

          if (sourceIsHorizontal !== targetIsHorizontal) {
            toast.warning("Les côtés doivent être de même orientation (gauche/droit ou haut/bas)");
            return;
          }

          // Créer le highlight vert pour la cible
          const highlight2 = createSideHighlight(clickedFurniture, side, "#22c55e", "isAlignIndicator");

          const target: AlignSelection = {
            furnitureId: clickedFurniture.data.furnitureId,
            side,
            position: getSidePosition(clickedFurniture, side),
            item: clickedFurniture,
          };

          // Appliquer l'alignement
          setTimeout(() => {
            applyAlign(currentAlignSource, target);
          }, 200);
        }

        return;
      }

      // Mode Coller (snap)
      if (activeToolRef.current === "snap") {
        const hitResult = paper.project.hitTest(event.point, {
          fill: true,
          stroke: true,
          tolerance: 15,
        });

        const currentScale = scaleRef.current;
        const currentVehicleLength = vehicleLengthRef.current;
        const currentVehicleWidth = vehicleWidthRef.current;
        const scaledVehicleLength = currentVehicleLength * currentScale;
        const scaledVehicleWidth = currentVehicleWidth * currentScale;
        const vehicleLeft = (CANVAS_WIDTH - scaledVehicleLength) / 2;
        const vehicleRight = vehicleLeft + scaledVehicleLength;
        const vehicleTop = (CANVAS_HEIGHT - scaledVehicleWidth) / 2;
        const vehicleBottom = vehicleTop + scaledVehicleWidth;

        // Zone de chargement
        const currentOffsetX = loadAreaOffsetXRef.current;
        const currentLoadLength = loadAreaLengthRef.current;
        const currentLoadWidth = loadAreaWidthRef.current;
        const scaledOffsetX = currentOffsetX * currentScale;
        const scaledLoadLength = currentLoadLength * currentScale;
        const scaledLoadWidth = currentLoadWidth * currentScale;
        const loadAreaLeft = vehicleLeft + scaledOffsetX;
        const loadAreaRight = loadAreaLeft + scaledLoadLength;
        const loadAreaTop = vehicleTop + (scaledVehicleWidth - scaledLoadWidth) / 2;
        const loadAreaBottom = loadAreaTop + scaledLoadWidth;

        // Chercher un meuble
        let clickedFurniture: paper.Group | null = null;
        if (hitResult?.item) {
          if (hitResult.item.parent instanceof paper.Group && hitResult.item.parent.data.isFurniture) {
            clickedFurniture = hitResult.item.parent as paper.Group;
          } else if (hitResult.item instanceof paper.Group && hitResult.item.data.isFurniture) {
            clickedFurniture = hitResult.item as paper.Group;
          }
        }

        const currentSnapStep = snapStepRef.current;
        const currentSnapSource = snapSourceRef.current;

        if (currentSnapStep === 0) {
          // Première sélection - meuble source (obligatoirement un meuble)
          if (!clickedFurniture) {
            toast.warning("Cliquez sur un meuble pour le sélectionner");
            return;
          }

          const side = getClosestSide(clickedFurniture, event.point);
          const position = getSidePosition(clickedFurniture, side);

          // Supprimer les anciens highlights
          if (paper.project && paper.project.activeLayer) {
            paper.project.activeLayer.children.forEach((child) => {
              if (child.data.isSnapIndicator) child.remove();
            });
          }

          // Créer le highlight orange
          const highlight = createSideHighlight(clickedFurniture, side, "#f97316", "isSnapIndicator");
          setSnapHighlight(highlight);

          setSnapSource({
            furnitureId: clickedFurniture.data.furnitureId,
            side,
            position,
            item: clickedFurniture,
          });
          setSnapStep(1);

          const sideLabels = { left: "gauche", right: "droit", top: "haut", bottom: "bas" };
          toast.info(
            `Meuble sélectionné (côté ${sideLabels[side]}). Cliquez sur un meuble, la zone de chargement ou la carrosserie.`,
          );
        } else if (currentSnapStep === 1 && currentSnapSource) {
          // Deuxième sélection - cible (meuble, zone de chargement ou carrosserie)

          // Vérifier si on clique sur le même meuble
          if (clickedFurniture && clickedFurniture.data.furnitureId === currentSnapSource.furnitureId) {
            toast.warning("Sélectionnez une autre cible");
            return;
          }

          const tolerance = 20;
          let targetType: "furniture" | "load_area" | "vehicle" | null = null;
          let targetSide: FurnitureSide | null = null;
          let targetPosition: number = 0;

          if (clickedFurniture) {
            // Cible = un autre meuble
            targetType = "furniture";
            targetSide = getClosestSide(clickedFurniture, event.point);
            targetPosition = getSidePosition(clickedFurniture, targetSide);

            // Créer le highlight rouge
            createSideHighlight(clickedFurniture, targetSide, "#ef4444", "isSnapIndicator");
          } else {
            // Vérifier si on clique sur la zone de chargement
            const distToLoadLeft = Math.abs(event.point.x - loadAreaLeft);
            const distToLoadRight = Math.abs(event.point.x - loadAreaRight);
            const distToLoadTop = Math.abs(event.point.y - loadAreaTop);
            const distToLoadBottom = Math.abs(event.point.y - loadAreaBottom);
            const inLoadYRange =
              event.point.y >= loadAreaTop - tolerance && event.point.y <= loadAreaBottom + tolerance;
            const inLoadXRange =
              event.point.x >= loadAreaLeft - tolerance && event.point.x <= loadAreaRight + tolerance;

            // Vérifier si on clique sur la carrosserie
            const distToVehicleLeft = Math.abs(event.point.x - vehicleLeft);
            const distToVehicleRight = Math.abs(event.point.x - vehicleRight);
            const distToVehicleTop = Math.abs(event.point.y - vehicleTop);
            const distToVehicleBottom = Math.abs(event.point.y - vehicleBottom);
            const inVehicleYRange =
              event.point.y >= vehicleTop - tolerance && event.point.y <= vehicleBottom + tolerance;
            const inVehicleXRange =
              event.point.x >= vehicleLeft - tolerance && event.point.x <= vehicleRight + tolerance;

            // Priorité : zone de chargement > carrosserie
            if (distToLoadLeft < tolerance && inLoadYRange) {
              targetType = "load_area";
              targetSide = "left";
              targetPosition = loadAreaLeft;
            } else if (distToLoadRight < tolerance && inLoadYRange) {
              targetType = "load_area";
              targetSide = "right";
              targetPosition = loadAreaRight;
            } else if (distToLoadTop < tolerance && inLoadXRange) {
              targetType = "load_area";
              targetSide = "top";
              targetPosition = loadAreaTop;
            } else if (distToLoadBottom < tolerance && inLoadXRange) {
              targetType = "load_area";
              targetSide = "bottom";
              targetPosition = loadAreaBottom;
            } else if (distToVehicleLeft < tolerance && inVehicleYRange) {
              targetType = "vehicle";
              targetSide = "left";
              targetPosition = vehicleLeft;
            } else if (distToVehicleRight < tolerance && inVehicleYRange) {
              targetType = "vehicle";
              targetSide = "right";
              targetPosition = vehicleRight;
            } else if (distToVehicleTop < tolerance && inVehicleXRange) {
              targetType = "vehicle";
              targetSide = "top";
              targetPosition = vehicleTop;
            } else if (distToVehicleBottom < tolerance && inVehicleXRange) {
              targetType = "vehicle";
              targetSide = "bottom";
              targetPosition = vehicleBottom;
            }

            if (targetType && targetSide) {
              // Créer une ligne de highlight pour la cible non-meuble
              let from: paper.Point, to: paper.Point;
              if (targetSide === "left" || targetSide === "right") {
                const yStart = targetType === "load_area" ? loadAreaTop : vehicleTop;
                const yEnd = targetType === "load_area" ? loadAreaBottom : vehicleBottom;
                from = new paper.Point(targetPosition, yStart);
                to = new paper.Point(targetPosition, yEnd);
              } else {
                const xStart = targetType === "load_area" ? loadAreaLeft : vehicleLeft;
                const xEnd = targetType === "load_area" ? loadAreaRight : vehicleRight;
                from = new paper.Point(xStart, targetPosition);
                to = new paper.Point(xEnd, targetPosition);
              }
              const highlightLine = new paper.Path.Line(from, to);
              highlightLine.strokeColor = new paper.Color("#ef4444");
              highlightLine.strokeWidth = 4;
              highlightLine.data.isSnapIndicator = true;
            }
          }

          if (!targetType || !targetSide) {
            toast.warning("Cliquez sur un meuble, la zone de chargement ou la carrosserie");
            return;
          }

          // Appliquer le collage
          const sourceBounds = currentSnapSource.item.bounds;
          let delta: paper.Point;

          // Calculer le déplacement selon les côtés
          if (targetType === "furniture" && clickedFurniture) {
            // Coller contre un autre meuble
            const targetBounds = clickedFurniture.bounds;
            if (currentSnapSource.side === "right" && targetSide === "left") {
              delta = new paper.Point(targetBounds.left - sourceBounds.right, 0);
            } else if (currentSnapSource.side === "left" && targetSide === "right") {
              delta = new paper.Point(targetBounds.right - sourceBounds.left, 0);
            } else if (currentSnapSource.side === "bottom" && targetSide === "top") {
              delta = new paper.Point(0, targetBounds.top - sourceBounds.bottom);
            } else if (currentSnapSource.side === "top" && targetSide === "bottom") {
              delta = new paper.Point(0, targetBounds.bottom - sourceBounds.top);
            } else {
              // Même côté = alignement
              if (currentSnapSource.side === "left" || currentSnapSource.side === "right") {
                delta = new paper.Point(
                  targetPosition - getSidePosition(currentSnapSource.item, currentSnapSource.side),
                  0,
                );
              } else {
                delta = new paper.Point(
                  0,
                  targetPosition - getSidePosition(currentSnapSource.item, currentSnapSource.side),
                );
              }
            }
          } else {
            // Coller contre zone de chargement ou carrosserie
            if (currentSnapSource.side === "right" && targetSide === "left") {
              delta = new paper.Point(targetPosition - sourceBounds.right, 0);
            } else if (currentSnapSource.side === "left" && targetSide === "right") {
              delta = new paper.Point(targetPosition - sourceBounds.left, 0);
            } else if (currentSnapSource.side === "left" && targetSide === "left") {
              delta = new paper.Point(targetPosition - sourceBounds.left, 0);
            } else if (currentSnapSource.side === "right" && targetSide === "right") {
              delta = new paper.Point(targetPosition - sourceBounds.right, 0);
            } else if (currentSnapSource.side === "bottom" && targetSide === "top") {
              delta = new paper.Point(0, targetPosition - sourceBounds.bottom);
            } else if (currentSnapSource.side === "top" && targetSide === "bottom") {
              delta = new paper.Point(0, targetPosition - sourceBounds.top);
            } else if (currentSnapSource.side === "top" && targetSide === "top") {
              delta = new paper.Point(0, targetPosition - sourceBounds.top);
            } else if (currentSnapSource.side === "bottom" && targetSide === "bottom") {
              delta = new paper.Point(0, targetPosition - sourceBounds.bottom);
            } else {
              // Cas par défaut
              if (currentSnapSource.side === "left" || currentSnapSource.side === "right") {
                delta = new paper.Point(
                  targetPosition - getSidePosition(currentSnapSource.item, currentSnapSource.side),
                  0,
                );
              } else {
                delta = new paper.Point(
                  0,
                  targetPosition - getSidePosition(currentSnapSource.item, currentSnapSource.side),
                );
              }
            }
          }

          // Déplacer le meuble source
          currentSnapSource.item.position = currentSnapSource.item.position.add(delta);

          const deltaMm = Math.round(Math.sqrt(delta.x * delta.x + delta.y * delta.y) / currentScale);
          const targetLabels = {
            furniture: "meuble",
            load_area: "zone de chargement",
            vehicle: "carrosserie",
          };
          toast.success(`Meuble collé contre ${targetLabels[targetType]} (déplacement: ${deltaMm} mm)`);

          // Nettoyer les highlights
          if (paper.project && paper.project.activeLayer) {
            const toRemove: paper.Item[] = [];
            paper.project.activeLayer.children.forEach((child) => {
              if (child.data.isSnapIndicator) {
                toRemove.push(child);
              }
            });
            toRemove.forEach((item) => item.remove());
          }

          // Réinitialiser l'outil
          setSnapStep(0);
          setSnapSource(null);
          setSnapHighlight(null);
        }

        return;
      }

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

          // Obtenir les limites de la zone de chargement avec offset
          const currentScale = scaleRef.current;
          const currentLength = loadAreaLengthRef.current;
          const currentWidth = loadAreaWidthRef.current;
          const currentOffsetX = loadAreaOffsetXRef.current;
          const currentVehicleLength = vehicleLengthRef.current;
          const currentVehicleWidth = vehicleWidthRef.current;

          const scaledLength = currentLength * currentScale;
          const scaledWidth = currentWidth * currentScale;
          const scaledOffsetX = currentOffsetX * currentScale;
          const scaledVehicleLength = currentVehicleLength * currentScale;
          const scaledVehicleWidth = currentVehicleWidth * currentScale;

          // Position du véhicule et de la zone de chargement
          const vehicleLeft = (CANVAS_WIDTH - scaledVehicleLength) / 2;
          const vehicleTop = (CANVAS_HEIGHT - scaledVehicleWidth) / 2;
          const loadAreaLeft = vehicleLeft + scaledOffsetX;
          const loadAreaTop = vehicleTop + (scaledVehicleWidth - scaledWidth) / 2;
          const loadAreaRight = loadAreaLeft + scaledLength;
          const loadAreaBottom = loadAreaTop + scaledWidth;

          // Obtenir les limites de l'objet sélectionné
          const itemBounds = selectedItem.bounds;
          const halfWidth = itemBounds.width / 2;
          const halfHeight = itemBounds.height / 2;

          // Contraindre la position pour rester dans la zone de chargement
          const constrainedX = Math.max(loadAreaLeft + halfWidth, Math.min(loadAreaRight - halfWidth, newPosition.x));
          const constrainedY = Math.max(loadAreaTop + halfHeight, Math.min(loadAreaBottom - halfHeight, newPosition.y));

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
          // Mettre à jour les distances à l'essieu AV
          if (showVASPOverlay) {
            drawFurnitureDistances();
          }
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
      const currentScale = scaleRef.current;

      // Calculer la position du véhicule pour convertir les positions
      const currentVehicleLength = vehicleLengthRef.current;
      const currentVehicleWidth = vehicleWidthRef.current;
      const scaledVehicleLength = currentVehicleLength * currentScale;
      const scaledVehicleWidth = currentVehicleWidth * currentScale;
      const vehicleLeft = (CANVAS_WIDTH - scaledVehicleLength) / 2;
      const vehicleTop = (CANVAS_HEIGHT - scaledVehicleWidth) / 2;

      // Extraire les IDs et positions des meubles présents sur le canvas
      const canvasFurniture = new Map<string, { x: number; y: number }>();
      paper.project.activeLayer.children.forEach((child) => {
        if (child instanceof paper.Group && child.data.isFurniture && child.data.furnitureId) {
          // Convertir la position du centre en mm (par rapport au coin avant-gauche du véhicule)
          const centerX = child.bounds.center.x;
          const centerY = child.bounds.center.y;
          const positionXmm = Math.round((centerX - vehicleLeft) / currentScale);
          const positionYmm = Math.round((centerY - vehicleTop) / currentScale);
          canvasFurniture.set(child.data.furnitureId, { x: positionXmm, y: positionYmm });
        }
      });

      // Ne sauvegarder que les meubles qui sont sur le canvas, avec leur position
      const furnitureData = Array.from(furnitureItemsRef.current.entries())
        .filter(([id]) => canvasFurniture.has(id))
        .map(([id, data]) => {
          const position = canvasFurniture.get(id)!;
          return {
            id,
            ...data,
            position_x_mm: position.x,
            position_y_mm: position.y,
          };
        });

      console.log("🔍 Sauvegarde - Nombre de meubles sur le canvas:", canvasFurniture.size);
      console.log("🔍 Sauvegarde - Nombre de meubles dans les données:", furnitureData.length);
      console.log(
        "🔍 Dimensions zone de chargement:",
        loadAreaLength,
        "×",
        loadAreaWidth,
        "mm, offset:",
        loadAreaOffsetXRef.current,
        "mm",
      );
      console.log("Détails meubles:", furnitureData);

      // Synchroniser furnitureItems avec le canvas
      setFurnitureItems((prev) => {
        const newMap = new Map<string, FurnitureData>();
        canvasFurniture.forEach((_, id) => {
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
            offset_zone_chargement_mm: loadAreaOffsetXRef.current,
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
        const { data, error } = (await supabase
          .from("projects")
          .select(
            "layout_canvas_data, furniture_data, longueur_chargement_mm, largeur_chargement_mm, offset_zone_chargement_mm",
          )
          .eq("id", projectId)
          .single()) as any;

        if (error) throw error;

        // Charger les dimensions de la zone de chargement
        if (data?.longueur_chargement_mm && data?.largeur_chargement_mm) {
          console.log("📐 Dimensions chargées:", {
            longueur: data.longueur_chargement_mm,
            largeur: data.largeur_chargement_mm,
            offset: data.offset_zone_chargement_mm,
          });
          setLoadAreaLength(data.longueur_chargement_mm);
          setLoadAreaWidth(data.largeur_chargement_mm);
        }

        // Charger l'offset de la zone de chargement
        if (data?.offset_zone_chargement_mm !== null && data?.offset_zone_chargement_mm !== undefined) {
          setLoadAreaOffsetX(data.offset_zone_chargement_mm);
        }

        // Calculer l'échelle actuelle et la position du véhicule
        const currentScale = scaleRef.current;
        const currentVehicleLength = vehicleLengthRef.current;
        const currentVehicleWidth = vehicleWidthRef.current;
        const scaledVehicleLength = currentVehicleLength * currentScale;
        const scaledVehicleWidth = currentVehicleWidth * currentScale;
        const vehicleLeft = (CANVAS_WIDTH - scaledVehicleLength) / 2;
        const vehicleTop = (CANVAS_HEIGHT - scaledVehicleWidth) / 2;

        // Charger les données des meubles
        const furnitureMap = new Map<string, FurnitureData>();
        const furniturePositions = new Map<string, { x: number; y: number }>();

        if (data?.furniture_data && Array.isArray(data.furniture_data)) {
          data.furniture_data.forEach((item: any) => {
            furnitureMap.set(item.id, {
              id: item.id,
              longueur_mm: item.longueur_mm,
              largeur_mm: item.largeur_mm,
              hauteur_mm: item.hauteur_mm,
              poids_kg: item.poids_kg,
              hauteur_sol_mm: item.hauteur_sol_mm || 0,
              masse_contenu_kg: item.masse_contenu_kg || 0,
            });
            // Sauvegarder la position si elle existe
            if (item.position_x_mm !== undefined && item.position_y_mm !== undefined) {
              furniturePositions.set(item.id, { x: item.position_x_mm, y: item.position_y_mm });
            }
          });
          setFurnitureItems(furnitureMap);
        }

        // Importer le JSON du canvas (sans les meubles, on va les recréer)
        if (data?.layout_canvas_data && typeof data.layout_canvas_data === "string") {
          paper.project.clear();
          paper.project.importJSON(data.layout_canvas_data);

          // Supprimer tous les meubles importés (on va les recréer)
          const toRemove: paper.Item[] = [];
          paper.project.activeLayer.children.forEach((child) => {
            if (child instanceof paper.Group && child.data.isFurniture) {
              toRemove.push(child);
            }
          });
          toRemove.forEach((item) => item.remove());
        } else {
          paper.project.clear();
        }

        // Redessiner les contours et les éléments VASP
        drawLoadAreaOutline();
        drawVASPElements();

        // Recréer les meubles avec la bonne échelle et position
        furnitureMap.forEach((furnitureData, id) => {
          const scaledWidth = furnitureData.longueur_mm * currentScale;
          const scaledHeight = furnitureData.largeur_mm * currentScale;

          // Calculer la position du centre
          let centerX: number;
          let centerY: number;

          const position = furniturePositions.get(id);
          if (position) {
            // Position sauvegardée en mm, convertir en pixels
            centerX = vehicleLeft + position.x * currentScale;
            centerY = vehicleTop + position.y * currentScale;
          } else {
            // Pas de position sauvegardée, centrer dans la zone de chargement
            const loadOffsetX = loadAreaOffsetXRef.current;
            const loadLength = loadAreaLengthRef.current;
            const loadWidth = loadAreaWidthRef.current;
            const loadAreaLeft = vehicleLeft + loadOffsetX * currentScale;
            const loadAreaTop = vehicleTop + ((currentVehicleWidth - loadWidth) / 2) * currentScale;
            centerX = loadAreaLeft + (loadLength * currentScale) / 2;
            centerY = loadAreaTop + (loadWidth * currentScale) / 2;
          }

          // Créer le rectangle du meuble
          const rect = new paper.Path.Rectangle({
            point: [centerX - scaledWidth / 2, centerY - scaledHeight / 2],
            size: [scaledWidth, scaledHeight],
            strokeColor: new paper.Color("#3b82f6"),
            strokeWidth: 2,
            fillColor: new paper.Color("#3b82f6"),
          });
          rect.fillColor!.alpha = 0.3;

          // Créer le texte
          const text = new paper.PointText({
            point: [centerX, centerY],
            content: `${furnitureData.longueur_mm}x${furnitureData.largeur_mm}x${furnitureData.hauteur_mm}mm\n${furnitureData.poids_kg}kg`,
            fillColor: new paper.Color("#000"),
            fontSize: 12,
            justification: "center",
          });
          text.data.isFurnitureLabel = true;
          text.data.furnitureId = id;

          // Créer le groupe
          const group = new paper.Group([rect, text]);
          group.data.isFurniture = true;
          group.data.furnitureId = id;

          console.log("📦 Meuble recréé:", {
            id,
            longueur_mm: furnitureData.longueur_mm,
            largeur_mm: furnitureData.largeur_mm,
            scaledWidth,
            scaledHeight,
            centerX,
            centerY,
            echelle: currentScale,
          });
        });

        saveState();
        if (furnitureMap.size > 0 || data?.layout_canvas_data) {
          toast.success("Plan d'aménagement chargé");
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
      // Afficher les distances à l'essieu AV pour les meubles
      if (showVASPOverlay) {
        drawFurnitureDistances();
      }
    };

    (window as any).layoutCanvasLoad = loadAndReactivateTool;

    // Charger automatiquement les données sauvegardées au montage du canvas
    loadAndReactivateTool();

    return () => {
      paper.project.clear();
    };
  }, [
    projectId,
    loadAreaLength,
    loadAreaWidth,
    loadAreaOffsetX,
    empattement,
    porteFauxAvant,
    vehicleLength,
    vehicleWidth,
  ]);

  // useEffect séparé pour gérer le toggle VASP (afficher/masquer les éléments)
  useEffect(() => {
    if (!paper.project || !paper.project.activeLayer) return;

    paper.project.activeLayer.children.forEach((child) => {
      if (child.data?.isVASPElement || child.data?.isDistanceLabel) {
        child.visible = showVASPOverlay;
      }
    });
  }, [showVASPOverlay]);

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
              echelle: currentScale,
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
        wood_type: "okoume",
        thickness: 15,
        surface: 0,
        masse_contenu_kg: 0,
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

        // Calculer le centre de la zone de chargement avec offset
        const currentOffsetX = loadAreaOffsetXRef.current;
        const currentVehicleLength = vehicleLengthRef.current;
        const currentVehicleWidth = vehicleWidthRef.current;
        const scaledOffsetX = currentOffsetX * currentScale;
        const scaledVehicleLength = currentVehicleLength * currentScale;
        const scaledVehicleWidth = currentVehicleWidth * currentScale;
        const scaledLoadLength = loadAreaLengthRef.current * currentScale;
        const scaledLoadWidth = loadAreaWidthRef.current * currentScale;

        const vehicleLeft = (CANVAS_WIDTH - scaledVehicleLength) / 2;
        const vehicleTop = (CANVAS_HEIGHT - scaledVehicleWidth) / 2;
        const loadAreaLeft = vehicleLeft + scaledOffsetX;
        const loadAreaTop = vehicleTop + (scaledVehicleWidth - scaledLoadWidth) / 2;

        const loadAreaCenterX = loadAreaLeft + scaledLoadLength / 2;
        const loadAreaCenterY = loadAreaTop + scaledLoadWidth / 2;
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
          zone_largeur_mm: loadAreaWidthRef.current,
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
        wood_type: "okoume",
        thickness: 15,
        surface: 0,
        masse_contenu_kg: 0,
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
      wood_type: "okoume",
      thickness: 15,
      surface: 0,
      masse_contenu_kg: 0,
    });
  };

  const handleContextMenuEdit = (furnitureId?: string) => {
    const id = furnitureId || contextMenu?.furnitureId;
    if (!id) return;

    const furnitureData = furnitureItemsRef.current.get(id);

    if (furnitureData) {
      setEditingFurnitureId(id);
      setFurnitureForm({
        longueur_mm: furnitureData.longueur_mm,
        largeur_mm: furnitureData.largeur_mm,
        hauteur_mm: furnitureData.hauteur_mm,
        poids_kg: furnitureData.poids_kg,
        hauteur_sol_mm: furnitureData.hauteur_sol_mm || 0,
        wood_type: furnitureData.wood_type || "okoume",
        thickness: furnitureData.thickness || 15,
        surface: furnitureData.surface || 0,
        masse_contenu_kg: furnitureData.masse_contenu_kg || 0,
      });
      setShowFurnitureDialog(true);
      setContextMenu(null);
    }
  };

  // Calculer le poids total des meubles
  useEffect(() => {
    const furnitureWeight = Array.from(furnitureItems.values()).reduce((sum, item) => sum + (item.poids_kg || 0), 0);

    // Récupérer le poids des accessoires depuis les dépenses du projet
    // ✅ CORRIGÉ: Filtre les articles archivés et ne prend que les scénarios existants
    const fetchAccessoriesWeight = async () => {
      try {
        // D'abord récupérer les IDs des scénarios actifs du projet
        const { data: scenarios, error: scenarioError } = await supabase
          .from("project_scenarios")
          .select("id")
          .eq("project_id", projectId);

        if (scenarioError) throw scenarioError;

        const activeScenarioIds = scenarios?.map((s) => s.id) || [];

        if (activeScenarioIds.length === 0) {
          setAccessoriesWeight(0);
          setTotalWeight(furnitureWeight);
          return;
        }

        // Récupérer les dépenses des scénarios actifs, non archivées
        const { data, error } = await supabase
          .from("project_expenses")
          .select("poids_kg, quantite, scenario_id")
          .eq("project_id", projectId)
          .in("scenario_id", activeScenarioIds)
          .or("est_archive.is.null,est_archive.eq.false");

        if (error) throw error;

        const accessoriesTotal =
          data?.reduce((sum, expense) => sum + (expense.poids_kg || 0) * (expense.quantite || 1), 0) || 0;

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
    <>
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
              <Button
                variant={activeTool === "cotation" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTool("cotation")}
                title="Cotation intelligente - Cliquez sur une référence puis sur un meuble"
                className={activeTool === "cotation" ? "bg-purple-600 hover:bg-purple-700" : ""}
              >
                <Crosshair className="h-4 w-4 mr-2" />
                Cotation
                {cotationStep > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded">{cotationStep}/2</span>
                )}
              </Button>
              <Button
                variant={activeTool === "align" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTool("align")}
                title="Aligner - Aligne deux façades de meubles sur le même plan"
                className={activeTool === "align" ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                <AlignHorizontalJustifyCenter className="h-4 w-4 mr-2" />
                Aligner
                {alignStep > 0 && <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded">1/2</span>}
              </Button>
              <Button
                variant={activeTool === "snap" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTool("snap")}
                title="Coller - Colle un meuble contre un autre, la zone de chargement ou la carrosserie"
                className={activeTool === "snap" ? "bg-orange-600 hover:bg-orange-700" : ""}
              >
                <Magnet className="h-4 w-4 mr-2" />
                Coller
                {snapStep > 0 && <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded">1/2</span>}
              </Button>
              <Button
                variant={activeTool === "pan" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTool("pan")}
                title="Main - Déplacer la vue (clic + glisser)"
                className={activeTool === "pan" ? "bg-slate-600 hover:bg-slate-700" : ""}
              >
                <Hand className="h-4 w-4 mr-2" />
                Main
              </Button>

              <Separator orientation="vertical" className="h-6" />

              <Button
                variant={showVASPOverlay ? "default" : "outline"}
                size="sm"
                onClick={() => setShowVASPOverlay(!showVASPOverlay)}
                className={showVASPOverlay ? "bg-green-600 hover:bg-green-700" : ""}
                title="Afficher/masquer les éléments VASP (essieux)"
              >
                <Armchair className="h-4 w-4 mr-2" />
                VASP
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

            {/* Guide mode cotation */}
            {activeTool === "cotation" && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center gap-3">
                <Crosshair className="h-5 w-5 text-purple-600 flex-shrink-0" />
                <div className="flex-1">
                  {cotationStep === 0 && (
                    <p className="text-sm text-purple-700">
                      <span className="font-medium">Étape 1/2 :</span> Cliquez sur la{" "}
                      <span className="font-bold">référence</span> (essieu AV, essieu AR ou meuble)
                    </p>
                  )}
                  {cotationStep === 1 && (
                    <p className="text-sm text-purple-700">
                      <span className="font-medium">Étape 2/2 :</span> Cliquez sur le{" "}
                      <span className="font-bold">meuble à repositionner</span>
                      <span className="ml-2 text-xs text-purple-500">Référence: {cotationReference?.label}</span>
                    </p>
                  )}
                  {cotationStep === 2 && (
                    <p className="text-sm text-purple-700">Définissez la nouvelle distance dans le dialogue</p>
                  )}
                </div>
                {cotationStep > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelCotation}
                    className="text-purple-600 hover:text-purple-700"
                  >
                    Annuler
                  </Button>
                )}
              </div>
            )}

            <div
              ref={canvasContainerRef}
              className={`bg-muted/30 rounded-lg p-2 relative ${
                isFullscreen ? "fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden" : ""
              }`}
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className={`border rounded bg-white ${
                  isPanning ? "cursor-grabbing" : activeTool === "pan" ? "cursor-grab" : "cursor-crosshair"
                }`}
                style={
                  isFullscreen
                    ? {
                        transform: `scale(${fullscreenScale})`,
                        transformOrigin: "center center",
                      }
                    : undefined
                }
                onWheel={handleWheel}
                onMouseDown={handleMouseDownForPan}
                onMouseMove={handleMouseMoveForPan}
                onMouseUp={handleMouseUpForPan}
                onMouseLeave={handleMouseUpForPan}
              />

              {/* Contrôles de zoom et plein écran */}
              <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= MIN_ZOOM}
                  className="h-8 w-8 p-0"
                  title="Zoom arrière"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomReset}
                  className="h-8 px-2 text-xs font-mono"
                  title="Réinitialiser le zoom"
                >
                  {Math.round(zoomLevel * 100)}%
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= MAX_ZOOM}
                  className="h-8 w-8 p-0"
                  title="Zoom avant"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="h-8 w-8 p-0"
                  title={isFullscreen ? "Quitter le plein écran (Échap)" : "Plein écran"}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </div>

              {/* Indication en mode plein écran */}
              {isFullscreen && (
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-md px-3 py-1.5 text-sm text-gray-600">
                  Appuyez sur <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">Échap</kbd> pour
                  quitter
                </div>
              )}
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              Échelle : 1:{Math.round(1 / scale)} • Zoom: {Math.round(zoomLevel * 100)}% • Zone en pointillés bleus =
              zone de chargement utile ({loadAreaLength} x {loadAreaWidth} mm) • Molette: zoom • Outil Main: déplacer la
              vue
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
                              {furniture.wood_type && (
                                <p>
                                  🌳{" "}
                                  {furniture.wood_type === "okoume"
                                    ? "Okoumé"
                                    : furniture.wood_type === "bouleau"
                                      ? "Bouleau"
                                      : "Peuplier"}{" "}
                                  - {furniture.thickness}mm
                                </p>
                              )}
                              {furniture.surface && furniture.surface > 0 && (
                                <p>📐 Surface: {furniture.surface.toFixed(2)} m²</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => handleContextMenuEdit(furniture.id)}
                              title="Modifier"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteFromList(furniture.id)}
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
                    value={furnitureForm.longueur_mm || ""}
                    onChange={(e) =>
                      setFurnitureForm((prev) => ({
                        ...prev,
                        longueur_mm: Number(e.target.value) || 0,
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="largeur">Largeur (mm)</Label>
                  <Input
                    id="largeur"
                    type="number"
                    value={furnitureForm.largeur_mm || ""}
                    onChange={(e) =>
                      setFurnitureForm((prev) => ({
                        ...prev,
                        largeur_mm: Number(e.target.value) || 0,
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
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hauteur">Hauteur (mm)</Label>
                  <Input
                    id="hauteur"
                    type="number"
                    value={furnitureForm.hauteur_mm || ""}
                    onChange={(e) =>
                      setFurnitureForm((prev) => ({
                        ...prev,
                        hauteur_mm: Number(e.target.value) || 0,
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="poids">Poids structure (kg)</Label>
                  <Input
                    id="poids"
                    type="number"
                    step="0.1"
                    value={furnitureForm.poids_kg || ""}
                    onChange={(e) =>
                      setFurnitureForm((prev) => ({
                        ...prev,
                        poids_kg: Number(e.target.value) || 0,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleFurnitureSubmit();
                      }
                      e.stopPropagation();
                    }}
                    placeholder="0.0"
                  />
                  <p className="text-xs text-muted-foreground">Poids du meuble vide (inclus dans la pesée)</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hauteur_sol">Hauteur par rapport au sol (mm)</Label>
                <Input
                  id="hauteur_sol"
                  type="number"
                  value={furnitureForm.hauteur_sol_mm || ""}
                  onChange={(e) =>
                    setFurnitureForm((prev) => ({
                      ...prev,
                      hauteur_sol_mm: Number(e.target.value) || 0,
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

              {/* Masse du contenu pour VASP */}
              <div className="space-y-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <Label htmlFor="masse_contenu" className="text-purple-700 dark:text-purple-400 font-medium">
                  Masse contenu (kg) - VASP
                </Label>
                <Input
                  id="masse_contenu"
                  type="number"
                  step="0.1"
                  value={furnitureForm.masse_contenu_kg || ""}
                  onChange={(e) =>
                    setFurnitureForm((prev) => ({
                      ...prev,
                      masse_contenu_kg: Number(e.target.value) || 0,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleFurnitureSubmit();
                    }
                    e.stopPropagation();
                  }}
                  placeholder="0.0"
                  className="border-purple-300"
                />
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Chargement prévu après pesée (le meuble vide est déjà inclus dans la pesée)
                </p>
              </div>

              {/* Champs pour le bois */}
              <Separator />
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Caractéristiques du bois</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wood_type">Type de bois</Label>
                    <Select
                      value={furnitureForm.wood_type}
                      onValueChange={(value: "okoume" | "bouleau" | "peuplier") =>
                        setFurnitureForm((prev) => {
                          const newForm = { ...prev, wood_type: value };
                          // Recalculer le poids si surface et épaisseur sont définis
                          if (newForm.surface && newForm.surface > 0) {
                            newForm.poids_kg = calculateWeight(value, newForm.thickness, newForm.surface);
                          }
                          return newForm;
                        })
                      }
                    >
                      <SelectTrigger id="wood_type">
                        <SelectValue placeholder="Choisir..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="okoume">Okoumé (420 kg/m³)</SelectItem>
                        <SelectItem value="bouleau">Bouleau (680 kg/m³)</SelectItem>
                        <SelectItem value="peuplier">Peuplier (475 kg/m³)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="thickness">Épaisseur (mm)</Label>
                    <Select
                      value={furnitureForm.thickness.toString()}
                      onValueChange={(value) =>
                        setFurnitureForm((prev) => {
                          const newForm = { ...prev, thickness: Number(value) };
                          // Recalculer le poids si surface est définie
                          if (newForm.surface && newForm.surface > 0) {
                            newForm.poids_kg = calculateWeight(newForm.wood_type, Number(value), newForm.surface);
                          }
                          return newForm;
                        })
                      }
                    >
                      <SelectTrigger id="thickness">
                        <SelectValue placeholder="Choisir..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 mm</SelectItem>
                        <SelectItem value="8">8 mm</SelectItem>
                        <SelectItem value="10">10 mm</SelectItem>
                        <SelectItem value="12">12 mm</SelectItem>
                        <SelectItem value="15">15 mm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="surface">Surface de bois utilisé (m²)</Label>
                  <Input
                    id="surface"
                    type="number"
                    step="0.01"
                    value={furnitureForm.surface || ""}
                    onChange={(e) => {
                      const surface = Number(e.target.value) || 0;
                      setFurnitureForm((prev) => ({
                        ...prev,
                        surface,
                        // Recalculer le poids automatiquement
                        poids_kg:
                          surface > 0 ? calculateWeight(prev.wood_type, prev.thickness, surface) : prev.poids_kg,
                      }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleFurnitureSubmit();
                      }
                      e.stopPropagation();
                    }}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Le poids sera calculé automatiquement selon le type de bois et l'épaisseur
                  </p>
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

      {/* Dialogue de cotation intelligente */}
      <Dialog
        open={showCotationDialog}
        onOpenChange={(open) => {
          if (!open) cancelCotation();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-purple-600" />
              Cotation intelligente
            </DialogTitle>
            <DialogDescription>Définissez la distance entre les deux éléments sélectionnés</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Éléments sélectionnés */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Référence</p>
                <p className="font-medium text-purple-600">{cotationReference?.label || "-"}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Cible</p>
                <p className="font-medium text-blue-600">{cotationTarget?.label || "-"}</p>
              </div>
            </div>

            {/* Distance actuelle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-muted-foreground">Distance actuelle :</span>
              <span className="font-semibold">{cotationCurrentDistance} mm</span>
            </div>

            {/* Nouvelle distance */}
            <div className="space-y-2">
              <Label htmlFor="new_distance">Nouvelle distance (mm)</Label>
              <Input
                id="new_distance"
                type="number"
                value={cotationNewDistance}
                onChange={(e) => setCotationNewDistance(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    applyCotation();
                  }
                }}
                placeholder="Entrez la distance souhaitée"
                className="text-lg font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Le meuble cible sera repositionné à cette distance de la référence
              </p>
            </div>

            {/* Raccourcis */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setCotationNewDistance("0")}>
                0 mm
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCotationNewDistance("500")}>
                500 mm
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCotationNewDistance("1000")}>
                1000 mm
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCotationNewDistance("1500")}>
                1500 mm
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelCotation}>
              Annuler
            </Button>
            <Button onClick={applyCotation} className="bg-purple-600 hover:bg-purple-700">
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calculateur de poids de meuble */}
      <FurnitureWeightCalculator />
    </>
  );
};
