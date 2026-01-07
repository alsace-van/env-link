// ============================================
// COMPOSANT: CADGabaritCanvas
// Canvas CAO professionnel pour gabarits CNC
// VERSION: 2.0 - Bézier, Image fond, Drag poignées
// ============================================

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  MousePointer,
  Hand,
  Minus,
  Circle,
  Square,
  Ruler,
  Link,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  Download,
  FileDown,
  Maximize,
  Minimize,
  Grid3X3,
  Magnet,
  Settings,
  Undo,
  Redo,
  Trash2,
  Eye,
  EyeOff,
  Image,
  Spline,
  Move,
  Sliders,
} from "lucide-react";

import {
  Point,
  Geometry,
  Line,
  Circle as CircleType,
  Arc,
  Rectangle,
  Bezier,
  Constraint,
  Dimension,
  Sketch,
  Viewport,
  SnapPoint,
  SnapType,
  ToolType,
  generateId,
  distance,
  midpoint,
} from "./types";
import { CADRenderer } from "./cad-renderer";
import { SnapSystem, DEFAULT_SNAP_SETTINGS } from "./snap-system";
import { CADSolver } from "./cad-solver";

// Export DXF
import { exportToDXF } from "./export-dxf";

interface CADGabaritCanvasProps {
  imageUrl?: string;
  scaleFactor?: number;
  templateId?: string;
  initialData?: any;
  onSave?: (data: any) => void;
}

// Créer un sketch vide
function createEmptySketch(scaleFactor: number = 1): Sketch {
  return {
    id: generateId(),
    name: "Nouveau gabarit",
    points: new Map(),
    geometries: new Map(),
    constraints: new Map(),
    dimensions: new Map(),
    scaleFactor,
    dof: 0,
    status: "fully-constrained",
  };
}

export function CADGabaritCanvas({
  imageUrl,
  scaleFactor = 2.5, // px per mm par défaut
  templateId = "default",
  initialData,
  onSave,
}: CADGabaritCanvasProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CADRenderer | null>(null);
  const snapSystemRef = useRef<SnapSystem>(new SnapSystem());
  const solverRef = useRef<CADSolver>(new CADSolver());
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [sketch, setSketch] = useState<Sketch>(() => createEmptySketch(scaleFactor));
  const [viewport, setViewport] = useState<Viewport>({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    width: 800,
    height: 600,
  });

  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  const [currentSnapPoint, setCurrentSnapPoint] = useState<SnapPoint | null>(null);

  const [tempGeometry, setTempGeometry] = useState<any>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showConstraints, setShowConstraints] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showBackgroundImage, setShowBackgroundImage] = useState(true);
  const [imageOpacity, setImageOpacity] = useState(0.5);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Drag des poignées
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<{ type: "point" | "handle"; id: string; handleType?: string } | null>(
    null,
  );
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [dimensionDialog, setDimensionDialog] = useState<{
    open: boolean;
    type: "distance" | "radius" | "angle";
    entities: string[];
    initialValue: number;
  } | null>(null);

  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialisation
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Créer le renderer
    rendererRef.current = new CADRenderer(canvas);

    // Taille initiale
    const rect = container.getBoundingClientRect();
    rendererRef.current.resize(rect.width, rect.height);
    setViewport((v) => ({
      ...v,
      width: rect.width,
      height: rect.height,
      offsetX: rect.width / 2,
      offsetY: rect.height / 2,
    }));

    // Charger l'image de fond
    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        backgroundImageRef.current = img;
        render();
      };
      img.src = imageUrl;
    }

    // Charger les données initiales
    if (initialData) {
      loadSketchData(initialData);
    }

    // Observer de resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (rendererRef.current) {
          rendererRef.current.resize(width, height);
          setViewport((v) => ({ ...v, width, height }));
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [imageUrl]);

  // Rendu
  const render = useCallback(() => {
    if (!rendererRef.current) return;

    rendererRef.current.setViewport(viewport);
    rendererRef.current.render(sketch, {
      selectedEntities,
      hoveredEntity,
      currentSnapPoint,
      tempGeometry,
      showGrid,
      showConstraints,
      showDimensions,
      backgroundImage: showBackgroundImage ? backgroundImageRef.current : null,
      imageOpacity,
      selectedEntities,
    });

    // Dessiner les poignées pour les entités sélectionnées
    if (selectedEntities.size > 0 && rendererRef.current) {
      rendererRef.current.drawHandles(sketch, selectedEntities);
    }
  }, [
    sketch,
    viewport,
    selectedEntities,
    hoveredEntity,
    currentSnapPoint,
    tempGeometry,
    showGrid,
    showConstraints,
    showDimensions,
    showBackgroundImage,
    imageOpacity,
  ]);

  useEffect(() => {
    render();
  }, [render]);

  // Charger les données
  const loadSketchData = useCallback(
    (data: any) => {
      if (!data) return;

      const newSketch = createEmptySketch(scaleFactor);

      if (data.points) {
        for (const [id, point] of Object.entries(data.points)) {
          newSketch.points.set(id, point as Point);
        }
      }

      if (data.geometries) {
        for (const [id, geo] of Object.entries(data.geometries)) {
          newSketch.geometries.set(id, geo as Geometry);
        }
      }

      if (data.constraints) {
        for (const [id, constraint] of Object.entries(data.constraints)) {
          newSketch.constraints.set(id, constraint as Constraint);
        }
      }

      if (data.dimensions) {
        for (const [id, dim] of Object.entries(data.dimensions)) {
          newSketch.dimensions.set(id, dim as Dimension);
        }
      }

      setSketch(newSketch);
      solveSketch(newSketch);
    },
    [scaleFactor],
  );

  // Sauvegarder
  const saveSketch = useCallback(() => {
    const data = {
      points: Object.fromEntries(sketch.points),
      geometries: Object.fromEntries(sketch.geometries),
      constraints: Object.fromEntries(sketch.constraints),
      dimensions: Object.fromEntries(sketch.dimensions),
      scaleFactor: sketch.scaleFactor,
      savedAt: new Date().toISOString(),
    };

    if (onSave) {
      onSave(data);
      toast.success("Gabarit sauvegardé !");
    }

    return data;
  }, [sketch, onSave]);

  // Résoudre le sketch
  const solveSketch = useCallback(async (sketchToSolve: Sketch) => {
    const result = await solverRef.current.solve(sketchToSolve);
    setSketch((s) => ({
      ...s,
      dof: result.dof,
      status: result.status,
    }));
  }, []);

  // Historique - défini tôt car utilisé par plusieurs callbacks
  const addToHistory = useCallback(
    (newSketch: Sketch) => {
      setHistory((h) => [...h.slice(0, historyIndex + 1), serializeSketch(newSketch)]);
      setHistoryIndex((i) => i + 1);
    },
    [historyIndex],
  );

  // Conversion coordonnées
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      return {
        x: (screenX - viewport.offsetX) / viewport.scale,
        y: (screenY - viewport.offsetY) / viewport.scale,
      };
    },
    [viewport],
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number) => {
      return {
        x: worldX * viewport.scale + viewport.offsetX,
        y: worldY * viewport.scale + viewport.offsetY,
      };
    },
    [viewport],
  );

  // Trouver l'entité sous le curseur
  const findEntityAtPosition = useCallback(
    (worldX: number, worldY: number): string | null => {
      const tolerance = 10 / viewport.scale;

      // Vérifier les points
      for (const [id, point] of sketch.points) {
        if (distance({ x: worldX, y: worldY }, point) < tolerance) {
          return id;
        }
      }

      // Vérifier les géométries
      for (const [id, geo] of sketch.geometries) {
        if (geo.type === "line") {
          const line = geo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (p1 && p2) {
            const d = distanceToLine({ x: worldX, y: worldY }, p1, p2);
            if (d < tolerance) return id;
          }
        } else if (geo.type === "circle") {
          const circle = geo as CircleType;
          const center = sketch.points.get(circle.center);
          if (center) {
            const d = Math.abs(distance({ x: worldX, y: worldY }, center) - circle.radius);
            if (d < tolerance) return id;
          }
        } else if (geo.type === "bezier") {
          const bezier = geo as Bezier;
          const p1 = sketch.points.get(bezier.p1);
          const p2 = sketch.points.get(bezier.p2);
          if (p1 && p2) {
            // Approximation: check proximity to control points or endpoints
            const cp1 = sketch.points.get(bezier.cp1);
            const cp2 = sketch.points.get(bezier.cp2);
            if (
              distance({ x: worldX, y: worldY }, p1) < tolerance ||
              distance({ x: worldX, y: worldY }, p2) < tolerance ||
              (cp1 && distance({ x: worldX, y: worldY }, cp1) < tolerance) ||
              (cp2 && distance({ x: worldX, y: worldY }, cp2) < tolerance)
            ) {
              return id;
            }
          }
        }
      }

      return null;
    },
    [sketch, viewport.scale],
  );

  // Trouver une poignée sous le curseur pour les entités sélectionnées
  const findHandleAtPosition = useCallback(
    (worldX: number, worldY: number): { type: "point" | "handle"; id: string; handleType?: string } | null => {
      const tolerance = 10 / viewport.scale;

      for (const entityId of selectedEntities) {
        // Vérifier les points de la géométrie sélectionnée
        const geo = sketch.geometries.get(entityId);
        if (geo) {
          if (geo.type === "line") {
            const line = geo as Line;
            const p1 = sketch.points.get(line.p1);
            const p2 = sketch.points.get(line.p2);
            if (p1 && distance({ x: worldX, y: worldY }, p1) < tolerance) {
              return { type: "point", id: line.p1 };
            }
            if (p2 && distance({ x: worldX, y: worldY }, p2) < tolerance) {
              return { type: "point", id: line.p2 };
            }
          } else if (geo.type === "circle") {
            const circle = geo as CircleType;
            const center = sketch.points.get(circle.center);
            if (center) {
              // Poignées sur les quadrants
              const handles = [
                { x: center.x + circle.radius, y: center.y },
                { x: center.x - circle.radius, y: center.y },
                { x: center.x, y: center.y + circle.radius },
                { x: center.x, y: center.y - circle.radius },
              ];
              for (const h of handles) {
                if (distance({ x: worldX, y: worldY }, h) < tolerance) {
                  return { type: "handle", id: entityId, handleType: "resize" };
                }
              }
              // Centre
              if (distance({ x: worldX, y: worldY }, center) < tolerance) {
                return { type: "point", id: circle.center };
              }
            }
          } else if (geo.type === "bezier") {
            const bezier = geo as Bezier;
            const p1 = sketch.points.get(bezier.p1);
            const p2 = sketch.points.get(bezier.p2);
            const cp1 = sketch.points.get(bezier.cp1);
            const cp2 = sketch.points.get(bezier.cp2);
            if (p1 && distance({ x: worldX, y: worldY }, p1) < tolerance) {
              return { type: "point", id: bezier.p1 };
            }
            if (p2 && distance({ x: worldX, y: worldY }, p2) < tolerance) {
              return { type: "point", id: bezier.p2 };
            }
            if (cp1 && distance({ x: worldX, y: worldY }, cp1) < tolerance) {
              return { type: "point", id: bezier.cp1, handleType: "control" };
            }
            if (cp2 && distance({ x: worldX, y: worldY }, cp2) < tolerance) {
              return { type: "point", id: bezier.cp2, handleType: "control" };
            }
          }
        }
      }

      return null;
    },
    [sketch, viewport.scale, selectedEntities],
  );

  // Charger une image de fond
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          backgroundImageRef.current = img;
          setShowBackgroundImage(true);
          render();
          toast.success("Image chargée !");
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    [render],
  );

  // Gestion de la souris
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = screenToWorld(screenX, screenY);

      // Pan avec clic milieu ou espace
      if (e.button === 1 || (e.button === 0 && activeTool === "pan")) {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      // Snap
      let targetPos = worldPos;
      if (snapEnabled && currentSnapPoint) {
        targetPos = { x: currentSnapPoint.x, y: currentSnapPoint.y };
      }

      switch (activeTool) {
        case "select": {
          // Vérifier d'abord si on clique sur une poignée d'une entité sélectionnée
          const handleHit = findHandleAtPosition(worldPos.x, worldPos.y);
          if (handleHit) {
            setIsDragging(true);
            setDragTarget(handleHit);
            setDragStart(worldPos);
            return;
          }

          const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
          if (entityId) {
            if (e.shiftKey) {
              // Toggle selection
              const newSelection = new Set(selectedEntities);
              if (newSelection.has(entityId)) {
                newSelection.delete(entityId);
              } else {
                newSelection.add(entityId);
              }
              setSelectedEntities(newSelection);
            } else {
              setSelectedEntities(new Set([entityId]));
              // Commencer le drag si c'est un point
              if (sketch.points.has(entityId)) {
                setIsDragging(true);
                setDragTarget({ type: "point", id: entityId });
                setDragStart(worldPos);
              }
            }
          } else {
            setSelectedEntities(new Set());
          }
          break;
        }

        case "line": {
          if (tempPoints.length === 0) {
            // Premier point
            const p: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };
            setTempPoints([p]);
            setTempGeometry({ type: "line", points: [p] });
          } else {
            // Deuxième point - créer la ligne
            const p1 = tempPoints[0];
            const p2: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };

            // Ajouter les points
            const newSketch = { ...sketch };
            newSketch.points = new Map(sketch.points);
            newSketch.geometries = new Map(sketch.geometries);

            newSketch.points.set(p1.id, p1);
            newSketch.points.set(p2.id, p2);

            // Ajouter la ligne
            const line: Line = {
              id: generateId(),
              type: "line",
              p1: p1.id,
              p2: p2.id,
            };
            newSketch.geometries.set(line.id, line);

            setSketch(newSketch);
            solveSketch(newSketch);
            addToHistory(newSketch);

            // Reset pour une nouvelle ligne
            setTempPoints([p2]);
            setTempGeometry({ type: "line", points: [p2] });
          }
          break;
        }

        case "circle": {
          if (tempPoints.length === 0) {
            // Centre
            const center: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };
            setTempPoints([center]);
            setTempGeometry({ type: "circle", center, radius: 0 });
          } else {
            // Rayon défini
            const center = tempPoints[0];
            const radius = distance(center, targetPos);

            const newSketch = { ...sketch };
            newSketch.points = new Map(sketch.points);
            newSketch.geometries = new Map(sketch.geometries);

            newSketch.points.set(center.id, center);

            const circle: CircleType = {
              id: generateId(),
              type: "circle",
              center: center.id,
              radius,
            };
            newSketch.geometries.set(circle.id, circle);

            setSketch(newSketch);
            solveSketch(newSketch);
            addToHistory(newSketch);

            setTempPoints([]);
            setTempGeometry(null);
          }
          break;
        }

        case "rectangle": {
          if (tempPoints.length === 0) {
            const p1: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };
            setTempPoints([p1]);
            setTempGeometry({ type: "rectangle", p1 });
          } else {
            const p1 = tempPoints[0];
            const p3 = targetPos;

            // Créer les 4 coins
            const p2: Point = { id: generateId(), x: p3.x, y: p1.y };
            const p4: Point = { id: generateId(), x: p1.x, y: p3.y };
            const p3Pt: Point = { id: generateId(), x: p3.x, y: p3.y };

            const newSketch = { ...sketch };
            newSketch.points = new Map(sketch.points);
            newSketch.geometries = new Map(sketch.geometries);
            newSketch.constraints = new Map(sketch.constraints);

            newSketch.points.set(p1.id, p1);
            newSketch.points.set(p2.id, p2);
            newSketch.points.set(p3Pt.id, p3Pt);
            newSketch.points.set(p4.id, p4);

            // Créer les 4 lignes
            const lines = [
              { id: generateId(), type: "line" as const, p1: p1.id, p2: p2.id },
              { id: generateId(), type: "line" as const, p1: p2.id, p2: p3Pt.id },
              { id: generateId(), type: "line" as const, p1: p3Pt.id, p2: p4.id },
              { id: generateId(), type: "line" as const, p1: p4.id, p2: p1.id },
            ];

            lines.forEach((l) => newSketch.geometries.set(l.id, l));

            // Ajouter contraintes horizontales/verticales
            newSketch.constraints.set(generateId(), { id: generateId(), type: "horizontal", entities: [lines[0].id] });
            newSketch.constraints.set(generateId(), { id: generateId(), type: "horizontal", entities: [lines[2].id] });
            newSketch.constraints.set(generateId(), { id: generateId(), type: "vertical", entities: [lines[1].id] });
            newSketch.constraints.set(generateId(), { id: generateId(), type: "vertical", entities: [lines[3].id] });

            setSketch(newSketch);
            solveSketch(newSketch);
            addToHistory(newSketch);

            setTempPoints([]);
            setTempGeometry(null);
          }
          break;
        }

        case "bezier": {
          if (tempPoints.length === 0) {
            // Point de départ
            const p1: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };
            setTempPoints([p1]);
            setTempGeometry({ type: "bezier", points: [p1] });
          } else if (tempPoints.length === 1) {
            // Point d'arrivée
            const p2: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };
            setTempPoints([...tempPoints, p2]);
            setTempGeometry({ type: "bezier", points: [...tempPoints, p2] });
          } else if (tempPoints.length === 2) {
            // Point de contrôle 1
            const cp1: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };
            setTempPoints([...tempPoints, cp1]);
            setTempGeometry({ type: "bezier", points: [...tempPoints, cp1] });
          } else if (tempPoints.length === 3) {
            // Point de contrôle 2 - créer la courbe
            const [p1, p2, cp1] = tempPoints;
            const cp2: Point = { id: generateId(), x: targetPos.x, y: targetPos.y };

            const newSketch = { ...sketch };
            newSketch.points = new Map(sketch.points);
            newSketch.geometries = new Map(sketch.geometries);

            newSketch.points.set(p1.id, p1);
            newSketch.points.set(p2.id, p2);
            newSketch.points.set(cp1.id, cp1);
            newSketch.points.set(cp2.id, cp2);

            const bezier: Bezier = {
              id: generateId(),
              type: "bezier",
              p1: p1.id,
              p2: p2.id,
              cp1: cp1.id,
              cp2: cp2.id,
            };
            newSketch.geometries.set(bezier.id, bezier);

            setSketch(newSketch);
            solveSketch(newSketch);
            addToHistory(newSketch);

            setTempPoints([]);
            setTempGeometry(null);
            toast.success("Courbe de Bézier créée");
          }
          break;
        }

        case "dimension": {
          const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
          if (entityId) {
            // Vérifier le type d'entité
            const geo = sketch.geometries.get(entityId);
            if (geo?.type === "line") {
              const line = geo as Line;
              const p1 = sketch.points.get(line.p1);
              const p2 = sketch.points.get(line.p2);
              if (p1 && p2) {
                const dist = distance(p1, p2) / sketch.scaleFactor;
                setDimensionDialog({
                  open: true,
                  type: "distance",
                  entities: [line.p1, line.p2],
                  initialValue: Math.round(dist * 100) / 100,
                });
              }
            } else if (geo?.type === "circle") {
              const circle = geo as CircleType;
              setDimensionDialog({
                open: true,
                type: "radius",
                entities: [entityId],
                initialValue: Math.round((circle.radius / sketch.scaleFactor) * 100) / 100,
              });
            }
          }
          break;
        }
      }
    },
    [
      activeTool,
      viewport,
      tempPoints,
      sketch,
      currentSnapPoint,
      snapEnabled,
      selectedEntities,
      findEntityAtPosition,
      screenToWorld,
      solveSketch,
      addToHistory,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = screenToWorld(screenX, screenY);

      // Pan
      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        setViewport((v) => ({
          ...v,
          offsetX: v.offsetX + dx,
          offsetY: v.offsetY + dy,
        }));
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      // Drag de point/poignée
      if (isDragging && dragTarget) {
        let targetPos = worldPos;

        // Snap pendant le drag
        if (snapEnabled) {
          const snap = snapSystemRef.current.findSnapPoint(screenX, screenY, sketch, viewport, [dragTarget.id]);
          if (snap) {
            targetPos = { x: snap.x, y: snap.y };
            setCurrentSnapPoint(snap);
          } else {
            setCurrentSnapPoint(null);
          }
        }

        // Mettre à jour la position du point
        if (dragTarget.type === "point") {
          const newSketch = { ...sketch };
          newSketch.points = new Map(sketch.points);
          const point = newSketch.points.get(dragTarget.id);
          if (point) {
            newSketch.points.set(dragTarget.id, {
              ...point,
              x: targetPos.x,
              y: targetPos.y,
            });
            setSketch(newSketch);
          }
        }
        return;
      }

      // Snap
      if (snapEnabled) {
        const snap = snapSystemRef.current.findSnapPoint(screenX, screenY, sketch, viewport, []);
        setCurrentSnapPoint(snap);
      } else {
        setCurrentSnapPoint(null);
      }

      // Hover
      const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
      setHoveredEntity(entityId);

      // Mise à jour géométrie temporaire
      if (tempGeometry) {
        let targetPos = worldPos;
        if (snapEnabled && currentSnapPoint) {
          targetPos = { x: currentSnapPoint.x, y: currentSnapPoint.y };
        }

        if (tempGeometry.type === "line" && tempPoints.length > 0) {
          setTempGeometry({
            ...tempGeometry,
            cursor: targetPos,
          });
        } else if (tempGeometry.type === "circle" && tempPoints.length > 0) {
          const radius = distance(tempPoints[0], targetPos);
          setTempGeometry({
            ...tempGeometry,
            radius,
          });
        } else if (tempGeometry.type === "rectangle") {
          setTempGeometry({
            ...tempGeometry,
            cursor: targetPos,
          });
        }
      }
    },
    [
      isPanning,
      isDragging,
      panStart,
      dragTarget,
      sketch,
      viewport,
      snapEnabled,
      tempGeometry,
      tempPoints,
      currentSnapPoint,
      findEntityAtPosition,
      screenToWorld,
    ],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      // Fin du pan
      if (isPanning) {
        setIsPanning(false);
      }

      // Fin du drag - sauvegarder dans l'historique
      if (isDragging && dragTarget) {
        addToHistory(sketch);
        solveSketch(sketch);
        setIsDragging(false);
        setDragTarget(null);
      }
    },
    [isPanning, isDragging, dragTarget, sketch, addToHistory, solveSketch],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(viewport.scale * zoomFactor, 0.1), 10);

      // Zoom vers la position de la souris
      const worldPos = screenToWorld(mouseX, mouseY);
      const newOffsetX = mouseX - worldPos.x * newScale;
      const newOffsetY = mouseY - worldPos.y * newScale;

      setViewport((v) => ({
        ...v,
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      }));
    },
    [viewport.scale, screenToWorld],
  );

  // Gestion clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Echap - annuler l'action en cours
      if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          setTempPoints([]);
          setTempGeometry(null);
          setActiveTool("select");
        }
      }

      // Supprimer
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEntities.size > 0) {
          deleteSelectedEntities();
        }
      }

      // Raccourcis outils
      if (!e.ctrlKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "v":
            setActiveTool("select");
            break;
          case "h":
            setActiveTool("pan");
            break;
          case "l":
            setActiveTool("line");
            break;
          case "c":
            setActiveTool("circle");
            break;
          case "r":
            setActiveTool("rectangle");
            break;
          case "b":
            setActiveTool("bezier");
            break;
          case "d":
            setActiveTool("dimension");
            break;
        }
      }

      // Ctrl+Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }

      // Ctrl+Y - Redo
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }

      // Ctrl+S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveSketch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, selectedEntities, saveSketch]);

  // Supprimer les entités sélectionnées
  const deleteSelectedEntities = useCallback(() => {
    const newSketch = { ...sketch };
    newSketch.points = new Map(sketch.points);
    newSketch.geometries = new Map(sketch.geometries);
    newSketch.constraints = new Map(sketch.constraints);

    selectedEntities.forEach((id) => {
      newSketch.points.delete(id);
      newSketch.geometries.delete(id);
      newSketch.constraints.delete(id);
    });

    setSketch(newSketch);
    setSelectedEntities(new Set());
    addToHistory(newSketch);
    solveSketch(newSketch);
  }, [sketch, selectedEntities, solveSketch, addToHistory]);

  // Undo/Redo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      loadSketchData(prevState);
      setHistoryIndex((i) => i - 1);
    }
  }, [history, historyIndex, loadSketchData]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      loadSketchData(nextState);
      setHistoryIndex((i) => i + 1);
    }
  }, [history, historyIndex, loadSketchData]);

  // Ajouter contrainte
  const addConstraint = useCallback(
    async (type: Constraint["type"], entities: string[], value?: number) => {
      const constraint: Constraint = {
        id: generateId(),
        type,
        entities,
        value,
        driving: true,
      };

      const newSketch = { ...sketch };
      newSketch.constraints = new Map(sketch.constraints);
      newSketch.constraints.set(constraint.id, constraint);

      setSketch(newSketch);
      await solveSketch(newSketch);
      addToHistory(newSketch);

      toast.success(`Contrainte "${type}" ajoutée`);
    },
    [sketch, solveSketch, addToHistory],
  );

  // Ajouter cotation
  const addDimension = useCallback(
    (type: Dimension["type"], entities: string[], value: number) => {
      const dimension: Dimension = {
        id: generateId(),
        type,
        entities,
        value,
        position: { x: 0, y: 0 },
      };

      // Créer aussi la contrainte
      let constraintType: Constraint["type"] = "distance";
      if (type === "radius") constraintType = "radius";
      else if (type === "angle") constraintType = "angle";

      const constraint: Constraint = {
        id: generateId(),
        type: constraintType,
        entities,
        value: value * sketch.scaleFactor, // Convertir mm en px
        driving: true,
      };

      dimension.constraintId = constraint.id;

      const newSketch = { ...sketch };
      newSketch.dimensions = new Map(sketch.dimensions);
      newSketch.constraints = new Map(sketch.constraints);

      newSketch.dimensions.set(dimension.id, dimension);
      newSketch.constraints.set(constraint.id, constraint);

      setSketch(newSketch);
      solveSketch(newSketch);
      addToHistory(newSketch);

      toast.success(`Cotation ajoutée: ${value}mm`);
    },
    [sketch, solveSketch, addToHistory],
  );

  // Export DXF
  const handleExportDXF = useCallback(() => {
    const dxfContent = exportToDXF(sketch);
    const blob = new Blob([dxfContent], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `gabarit-${templateId}.dxf`;
    a.click();

    URL.revokeObjectURL(url);
    toast.success("DXF exporté pour Fusion 360 !");
  }, [sketch, templateId]);

  // Export SVG
  const handleExportSVG = useCallback(() => {
    const svgContent = exportToSVG(sketch);
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `gabarit-${templateId}.svg`;
    a.click();

    URL.revokeObjectURL(url);
    toast.success("SVG exporté !");
  }, [sketch, templateId]);

  // Reset view
  const resetView = useCallback(() => {
    setViewport((v) => ({
      ...v,
      offsetX: v.width / 2,
      offsetY: v.height / 2,
      scale: 1,
    }));
  }, []);

  // Bouton outil
  const ToolButton = ({
    tool,
    icon: Icon,
    label,
    shortcut,
  }: {
    tool: ToolType;
    icon: any;
    label: string;
    shortcut: string;
  }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={activeTool === tool ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setActiveTool(tool);
              setTempPoints([]);
              setTempGeometry(null);
            }}
            className="h-9 w-9 p-0"
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {label} ({shortcut})
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div ref={containerRef} className={`flex flex-col ${isFullscreen ? "fixed inset-0 z-50 bg-white" : "h-[700px]"}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-gray-100 border-b flex-wrap">
        {/* Outils de sélection/navigation */}
        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
          <ToolButton tool="select" icon={MousePointer} label="Sélection" shortcut="V" />
          <ToolButton tool="pan" icon={Hand} label="Déplacer" shortcut="H" />
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Outils de dessin */}
        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
          <ToolButton tool="line" icon={Minus} label="Ligne" shortcut="L" />
          <ToolButton tool="circle" icon={Circle} label="Cercle" shortcut="C" />
          <ToolButton tool="rectangle" icon={Square} label="Rectangle" shortcut="R" />
          <ToolButton tool="bezier" icon={Spline} label="Courbe Bézier" shortcut="B" />
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Image de fond */}
        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-9 px-2">
                  <Image className="h-4 w-4 mr-1" />
                  <span className="text-xs">Photo</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Charger une image de fond</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {backgroundImageRef.current && (
            <>
              <Button
                variant={showBackgroundImage ? "default" : "outline"}
                size="sm"
                onClick={() => setShowBackgroundImage(!showBackgroundImage)}
                className="h-9 w-9 p-0"
              >
                {showBackgroundImage ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <div className="flex items-center gap-1 ml-1">
                <span className="text-xs text-muted-foreground">Opacité:</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={imageOpacity}
                  onChange={(e) => setImageOpacity(parseFloat(e.target.value))}
                  className="w-16 h-1"
                />
              </div>
            </>
          )}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Cotations et contraintes */}
        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
          <ToolButton tool="dimension" icon={Ruler} label="Cotation" shortcut="D" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-2">
                <Link className="h-4 w-4 mr-1" />
                <span className="text-xs">Contraintes</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 1) {
                    const id = Array.from(selectedEntities)[0];
                    if (sketch.geometries.has(id)) {
                      addConstraint("horizontal", [id]);
                    }
                  }
                }}
              >
                ─ Horizontal
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 1) {
                    const id = Array.from(selectedEntities)[0];
                    if (sketch.geometries.has(id)) {
                      addConstraint("vertical", [id]);
                    }
                  }
                }}
              >
                │ Vertical
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 2) {
                    addConstraint("perpendicular", Array.from(selectedEntities));
                  }
                }}
              >
                ⊥ Perpendiculaire
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 2) {
                    addConstraint("parallel", Array.from(selectedEntities));
                  }
                }}
              >
                ∥ Parallèle
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 2) {
                    addConstraint("equal", Array.from(selectedEntities));
                  }
                }}
              >
                = Égal
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 2) {
                    addConstraint("coincident", Array.from(selectedEntities));
                  }
                }}
              >
                ● Coïncident
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (selectedEntities.size === 1) {
                    addConstraint("fixed", Array.from(selectedEntities));
                  }
                }}
              >
                ⚓ Fixe
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewport((v) => ({ ...v, scale: v.scale * 0.8 }))}
            className="h-8 w-8 p-0"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono w-12 text-center">{Math.round(viewport.scale * 100)}%</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewport((v) => ({ ...v, scale: v.scale * 1.2 }))}
            className="h-8 w-8 p-0"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetView} title="Reset vue">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0} className="h-8 w-8 p-0">
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="h-8 w-8 p-0"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Toggles */}
        <div className="flex items-center gap-1">
          <Button
            variant={showGrid ? "default" : "outline"}
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
            className="h-8 px-2"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={snapEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setSnapEnabled(!snapEnabled)}
            className="h-8 px-2"
          >
            <Magnet className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Actions */}
        <Button variant="outline" size="sm" onClick={saveSketch}>
          <Save className="h-4 w-4 mr-1" />
          Sauver
        </Button>

        <Button variant="outline" size="sm" onClick={handleExportSVG}>
          <FileDown className="h-4 w-4 mr-1" />
          SVG
        </Button>

        <Button variant="default" size="sm" onClick={handleExportDXF}>
          <Download className="h-4 w-4 mr-1" />
          DXF
        </Button>

        <div className="flex-1" />

        {/* Status */}
        <Badge
          variant={
            sketch.status === "fully-constrained"
              ? "default"
              : sketch.status === "under-constrained"
                ? "secondary"
                : "destructive"
          }
        >
          {sketch.status === "fully-constrained" && "✓ Contraint"}
          {sketch.status === "under-constrained" && `DOF: ${sketch.dof}`}
          {sketch.status === "over-constrained" && "⚠ Sur-contraint"}
          {sketch.status === "conflicting" && "✕ Conflit"}
        </Badge>

        <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair"
          style={{
            cursor: activeTool === "pan" || isPanning ? "grab" : "crosshair",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Dialog cotation */}
      {dimensionDialog && (
        <Dialog open={dimensionDialog.open} onOpenChange={() => setDimensionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dimensionDialog.type === "distance" && "Distance"}
                {dimensionDialog.type === "radius" && "Rayon"}
                {dimensionDialog.type === "angle" && "Angle"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dimension-value" className="text-right">
                  Valeur
                </Label>
                <Input
                  id="dimension-value"
                  type="number"
                  defaultValue={dimensionDialog.initialValue}
                  className="col-span-3"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const value = parseFloat((e.target as HTMLInputElement).value);
                      if (!isNaN(value)) {
                        addDimension(
                          dimensionDialog.type === "distance" ? "linear" : dimensionDialog.type,
                          dimensionDialog.entities,
                          value,
                        );
                        setDimensionDialog(null);
                      }
                    }
                  }}
                />
                <span className="text-sm text-muted-foreground">{dimensionDialog.type === "angle" ? "°" : "mm"}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDimensionDialog(null)}>
                Annuler
              </Button>
              <Button
                onClick={() => {
                  const input = document.getElementById("dimension-value") as HTMLInputElement;
                  const value = parseFloat(input.value);
                  if (!isNaN(value)) {
                    addDimension(
                      dimensionDialog.type === "distance" ? "linear" : dimensionDialog.type,
                      dimensionDialog.entities,
                      value,
                    );
                    setDimensionDialog(null);
                  }
                }}
              >
                Appliquer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Utilitaires
function distanceToLine(
  p: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len2 = dx * dx + dy * dy;

  if (len2 < 1e-10) return distance(p, p1);

  let t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  return distance(p, { x: p1.x + t * dx, y: p1.y + t * dy });
}

function serializeSketch(sketch: Sketch): any {
  return {
    points: Object.fromEntries(sketch.points),
    geometries: Object.fromEntries(sketch.geometries),
    constraints: Object.fromEntries(sketch.constraints),
    dimensions: Object.fromEntries(sketch.dimensions),
    scaleFactor: sketch.scaleFactor,
  };
}

function exportToSVG(sketch: Sketch): string {
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-500 -500 1000 1000">
<g stroke="black" stroke-width="1" fill="none">
`;

  sketch.geometries.forEach((geo) => {
    if (geo.type === "line") {
      const line = geo as Line;
      const p1 = sketch.points.get(line.p1);
      const p2 = sketch.points.get(line.p2);
      if (p1 && p2) {
        svg += `  <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"/>\n`;
      }
    } else if (geo.type === "circle") {
      const circle = geo as CircleType;
      const center = sketch.points.get(circle.center);
      if (center) {
        svg += `  <circle cx="${center.x}" cy="${center.y}" r="${circle.radius}"/>\n`;
      }
    }
  });

  svg += `</g>
</svg>`;

  return svg;
}

export default CADGabaritCanvas;
