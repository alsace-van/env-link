// ============================================
// PDF PLAN EDITOR: Éditeur de mise en plan interactif
// VERSION: 1.0 - Aperçu plein écran, cotations interactives
// ============================================

import React, { useRef, useEffect, useState, useCallback } from "react";
import { X, ZoomIn, ZoomOut, Move, Ruler, Circle, RotateCcw, Download, MousePointer, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Sketch,
  Point,
  Line,
  Circle as CircleType,
  Arc,
  Bezier,
  Spline,
} from "./types";
import { jsPDF } from "jspdf";

// Types pour les cotations du plan
export interface PlanDimension {
  id: string;
  type: "length" | "radius" | "diameter" | "angle";
  // Pour length: référence à 2 points ou 1 ligne
  entityId?: string; // ID de la géométrie (ligne, cercle, arc)
  p1Id?: string; // Point 1 pour cotation entre 2 points
  p2Id?: string; // Point 2
  // Valeur en mm (calculée automatiquement)
  value: number;
  // Position de la cotation (offset par rapport à la géométrie)
  offset: number; // Distance perpendiculaire pour les longueurs
  position?: { x: number; y: number }; // Position absolue pour rayon/diamètre
  // Style
  color: string;
  fontSize: number;
  showValue: boolean;
  prefix?: string; // "R" pour rayon, "Ø" pour diamètre
}

// Options d'export PDF
export interface PDFExportOptions {
  format: "a4" | "a3";
  orientation: "portrait" | "landscape";
  scale: number;
  title: string;
  projectName: string;
  author: string;
  date: string;
  revision: string;
  showGrid: boolean;
  showFrame: boolean;
  lineWidth: number;
  margin: number;
}

interface PDFPlanEditorProps {
  sketch: Sketch;
  isOpen: boolean;
  onClose: () => void;
  initialOptions?: Partial<PDFExportOptions>;
}

// Dimensions des formats en mm
const PAGE_SIZES = {
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
};

const CARTOUCHE_HEIGHT = 30;

// Génère un ID unique
const generateId = () => `dim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export default function PDFPlanEditor({ sketch, isOpen, onClose, initialOptions }: PDFPlanEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Options PDF
  const [options, setOptions] = useState<PDFExportOptions>({
    format: "a4",
    orientation: "landscape",
    scale: 1,
    title: sketch.name || "Plan",
    projectName: "",
    author: "",
    date: new Date().toLocaleDateString("fr-FR"),
    revision: "A",
    showGrid: false,
    showFrame: true,
    lineWidth: 0.5,
    margin: 10,
    ...initialOptions,
  });
  
  // Cotations du plan
  const [dimensions, setDimensions] = useState<PlanDimension[]>([]);
  
  // Outil actif
  const [activeTool, setActiveTool] = useState<"select" | "dimension" | "radius" | "pan">("select");
  
  // Viewport pour le canvas
  const [viewport, setViewport] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  
  // État de la souris
  const [mouseState, setMouseState] = useState({
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    lastPos: { x: 0, y: 0 },
  });
  
  // Élément survolé
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  
  // Cotation en cours de déplacement
  const [draggingDimension, setDraggingDimension] = useState<string | null>(null);
  
  // Sélection pour cotation entre 2 points
  const [dimensionSelection, setDimensionSelection] = useState<{
    p1Id: string | null;
    p1Pos: { x: number; y: number } | null;
  }>({ p1Id: null, p1Pos: null });
  
  // Panneau latéral ouvert
  const [showOptionsPanel, setShowOptionsPanel] = useState(true);

  // Calculer les bounds du sketch
  const calculateBounds = useCallback(() => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let hasContent = false;
    
    sketch.points.forEach((point) => {
      hasContent = true;
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });
    
    sketch.geometries.forEach((geo) => {
      if (geo.type === "circle") {
        const circle = geo as CircleType;
        const center = sketch.points.get(circle.center);
        if (center) {
          minX = Math.min(minX, center.x - circle.radius);
          maxX = Math.max(maxX, center.x + circle.radius);
          minY = Math.min(minY, center.y - circle.radius);
          maxY = Math.max(maxY, center.y + circle.radius);
        }
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        const center = sketch.points.get(arc.center);
        if (center) {
          minX = Math.min(minX, center.x - arc.radius);
          maxX = Math.max(maxX, center.x + arc.radius);
          minY = Math.min(minY, center.y - arc.radius);
          maxY = Math.max(maxY, center.y + arc.radius);
        }
      }
    });
    
    if (!hasContent) return null;
    
    const padding = Math.max(maxX - minX, maxY - minY) * 0.1;
    return { minX: minX - padding, maxX: maxX + padding, minY: minY - padding, maxY: maxY + padding };
  }, [sketch]);

  // Initialiser le viewport pour centrer le dessin
  const initViewport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const bounds = calculateBounds();
    if (!bounds) return;
    
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Réserver de l'espace pour le cartouche (en bas)
    const drawingHeight = canvasHeight * 0.85;
    
    const sketchWidth = bounds.maxX - bounds.minX;
    const sketchHeight = bounds.maxY - bounds.minY;
    
    const scaleX = (canvasWidth * 0.8) / sketchWidth;
    const scaleY = (drawingHeight * 0.8) / sketchHeight;
    const scale = Math.min(scaleX, scaleY);
    
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    setViewport({
      scale,
      offsetX: canvasWidth / 2 - centerX * scale,
      offsetY: drawingHeight / 2 - centerY * scale,
    });
  }, [calculateBounds]);

  // Conversion coordonnées
  const worldToScreen = useCallback((x: number, y: number) => ({
    x: x * viewport.scale + viewport.offsetX,
    y: y * viewport.scale + viewport.offsetY,
  }), [viewport]);

  const screenToWorld = useCallback((x: number, y: number) => ({
    x: (x - viewport.offsetX) / viewport.scale,
    y: (y - viewport.offsetY) / viewport.scale,
  }), [viewport]);

  // Trouver l'entité sous le curseur
  const findEntityAtPosition = useCallback((worldX: number, worldY: number): string | null => {
    const tolerance = 8 / viewport.scale;
    
    // Chercher d'abord les lignes
    for (const [id, geo] of sketch.geometries) {
      if (geo.type === "line") {
        const line = geo as Line;
        const p1 = sketch.points.get(line.p1);
        const p2 = sketch.points.get(line.p2);
        if (p1 && p2) {
          const dist = distanceToSegment(worldX, worldY, p1.x, p1.y, p2.x, p2.y);
          if (dist < tolerance) return id;
        }
      } else if (geo.type === "circle") {
        const circle = geo as CircleType;
        const center = sketch.points.get(circle.center);
        if (center) {
          const dist = Math.abs(Math.sqrt((worldX - center.x) ** 2 + (worldY - center.y) ** 2) - circle.radius);
          if (dist < tolerance) return id;
        }
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        const center = sketch.points.get(arc.center);
        if (center) {
          const dist = Math.abs(Math.sqrt((worldX - center.x) ** 2 + (worldY - center.y) ** 2) - arc.radius);
          if (dist < tolerance) return id;
        }
      }
    }
    return null;
  }, [sketch, viewport.scale]);

  // Trouver le point sous le curseur
  const findPointAtPosition = useCallback((worldX: number, worldY: number): string | null => {
    const tolerance = 10 / viewport.scale;
    
    for (const [id, point] of sketch.points) {
      const dist = Math.sqrt((worldX - point.x) ** 2 + (worldY - point.y) ** 2);
      if (dist < tolerance) return id;
    }
    return null;
  }, [sketch, viewport.scale]);

  // Distance point à segment
  function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    
    if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    
    const nearX = x1 + t * dx;
    const nearY = y1 + t * dy;
    
    return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
  }

  // Ajouter une cotation de longueur sur une ligne
  const addLengthDimension = useCallback((lineId: string) => {
    const geo = sketch.geometries.get(lineId);
    if (!geo || geo.type !== "line") return;
    
    const line = geo as Line;
    const p1 = sketch.points.get(line.p1);
    const p2 = sketch.points.get(line.p2);
    if (!p1 || !p2) return;
    
    const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2) / sketch.scaleFactor;
    
    // Vérifier si une cotation existe déjà pour cette ligne
    const existing = dimensions.find(d => d.entityId === lineId && d.type === "length");
    if (existing) {
      toast.info("Cette ligne est déjà cotée");
      return;
    }
    
    const newDim: PlanDimension = {
      id: generateId(),
      type: "length",
      entityId: lineId,
      value: length,
      offset: 15 / viewport.scale,
      color: "#0066CC",
      fontSize: 10,
      showValue: true,
    };
    
    setDimensions(prev => [...prev, newDim]);
    toast.success(`Cotation ajoutée: ${length.toFixed(1)} mm`);
  }, [sketch, dimensions, viewport.scale]);

  // Ajouter une cotation de rayon sur un cercle/arc
  const addRadiusDimension = useCallback((entityId: string, isDiameter: boolean = false) => {
    const geo = sketch.geometries.get(entityId);
    if (!geo) return;
    
    let radius = 0;
    let centerPos: { x: number; y: number } | null = null;
    
    if (geo.type === "circle") {
      const circle = geo as CircleType;
      radius = circle.radius / sketch.scaleFactor;
      const center = sketch.points.get(circle.center);
      if (center) centerPos = { x: center.x, y: center.y };
    } else if (geo.type === "arc") {
      const arc = geo as Arc;
      radius = arc.radius / sketch.scaleFactor;
      const center = sketch.points.get(arc.center);
      if (center) centerPos = { x: center.x, y: center.y };
    }
    
    if (!centerPos) return;
    
    // Vérifier si une cotation existe déjà
    const existing = dimensions.find(d => d.entityId === entityId && (d.type === "radius" || d.type === "diameter"));
    if (existing) {
      toast.info("Ce cercle est déjà coté");
      return;
    }
    
    const value = isDiameter ? radius * 2 : radius;
    
    const newDim: PlanDimension = {
      id: generateId(),
      type: isDiameter ? "diameter" : "radius",
      entityId,
      value,
      offset: 0,
      position: {
        x: centerPos.x + radius * 0.7,
        y: centerPos.y - radius * 0.7,
      },
      color: "#0066CC",
      fontSize: 10,
      showValue: true,
      prefix: isDiameter ? "Ø" : "R",
    };
    
    setDimensions(prev => [...prev, newDim]);
    toast.success(`Cotation ajoutée: ${newDim.prefix}${value.toFixed(1)} mm`);
  }, [sketch, dimensions]);

  // Ajouter une cotation entre 2 points
  const addPointToPointDimension = useCallback((p1Id: string, p2Id: string) => {
    const p1 = sketch.points.get(p1Id);
    const p2 = sketch.points.get(p2Id);
    if (!p1 || !p2) return;
    
    const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2) / sketch.scaleFactor;
    
    const newDim: PlanDimension = {
      id: generateId(),
      type: "length",
      p1Id,
      p2Id,
      value: length,
      offset: 15 / viewport.scale,
      color: "#0066CC",
      fontSize: 10,
      showValue: true,
    };
    
    setDimensions(prev => [...prev, newDim]);
    toast.success(`Cotation ajoutée: ${length.toFixed(1)} mm`);
  }, [sketch, viewport.scale]);

  // Coter automatiquement toutes les lignes
  const autoAddAllDimensions = useCallback(() => {
    let count = 0;
    
    sketch.geometries.forEach((geo, id) => {
      if (geo.type === "line") {
        const existing = dimensions.find(d => d.entityId === id);
        if (!existing) {
          const line = geo as Line;
          const p1 = sketch.points.get(line.p1);
          const p2 = sketch.points.get(line.p2);
          if (p1 && p2) {
            const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2) / sketch.scaleFactor;
            
            const newDim: PlanDimension = {
              id: generateId(),
              type: "length",
              entityId: id,
              value: length,
              offset: 15 / viewport.scale,
              color: "#0066CC",
              fontSize: 10,
              showValue: true,
            };
            
            setDimensions(prev => [...prev, newDim]);
            count++;
          }
        }
      } else if (geo.type === "circle") {
        const existing = dimensions.find(d => d.entityId === id);
        if (!existing) {
          const circle = geo as CircleType;
          const center = sketch.points.get(circle.center);
          if (center) {
            const radius = circle.radius / sketch.scaleFactor;
            
            const newDim: PlanDimension = {
              id: generateId(),
              type: "radius",
              entityId: id,
              value: radius,
              offset: 0,
              position: {
                x: center.x + circle.radius * 0.7,
                y: center.y - circle.radius * 0.7,
              },
              color: "#0066CC",
              fontSize: 10,
              showValue: true,
              prefix: "R",
            };
            
            setDimensions(prev => [...prev, newDim]);
            count++;
          }
        }
      }
    });
    
    if (count > 0) {
      toast.success(`${count} cotation(s) ajoutée(s)`);
    } else {
      toast.info("Toutes les géométries sont déjà cotées");
    }
  }, [sketch, dimensions, viewport.scale]);

  // Supprimer une cotation
  const removeDimension = useCallback((dimId: string) => {
    setDimensions(prev => prev.filter(d => d.id !== dimId));
  }, []);

  // Supprimer toutes les cotations
  const clearAllDimensions = useCallback(() => {
    setDimensions([]);
    toast.success("Toutes les cotations supprimées");
  }, []);

  // Gestion des événements souris
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);
    
    if (activeTool === "pan" || e.button === 1) {
      // Pan avec le bouton du milieu ou outil pan
      setMouseState({
        isDragging: true,
        dragStart: { x: screenX, y: screenY },
        lastPos: { x: screenX, y: screenY },
      });
      return;
    }
    
    if (activeTool === "select") {
      // Vérifier si on clique sur une cotation pour la déplacer
      const clickedDim = findDimensionAtPosition(screenX, screenY);
      if (clickedDim) {
        setDraggingDimension(clickedDim);
        setMouseState({
          isDragging: true,
          dragStart: { x: screenX, y: screenY },
          lastPos: { x: screenX, y: screenY },
        });
        return;
      }
    }
    
    if (activeTool === "dimension") {
      // Ajouter une cotation sur une ligne
      const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
      if (entityId) {
        const geo = sketch.geometries.get(entityId);
        if (geo?.type === "line") {
          addLengthDimension(entityId);
          return;
        }
      }
      
      // Sinon, cotation entre 2 points
      const pointId = findPointAtPosition(worldPos.x, worldPos.y);
      if (pointId) {
        if (!dimensionSelection.p1Id) {
          const pt = sketch.points.get(pointId);
          if (pt) {
            setDimensionSelection({ p1Id: pointId, p1Pos: { x: pt.x, y: pt.y } });
            toast.info("Cliquez sur le 2ème point");
          }
        } else {
          addPointToPointDimension(dimensionSelection.p1Id, pointId);
          setDimensionSelection({ p1Id: null, p1Pos: null });
        }
      }
    }
    
    if (activeTool === "radius") {
      const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
      if (entityId) {
        const geo = sketch.geometries.get(entityId);
        if (geo?.type === "circle" || geo?.type === "arc") {
          // Shift = diamètre, sinon rayon
          addRadiusDimension(entityId, e.shiftKey);
        }
      }
    }
  }, [activeTool, screenToWorld, findEntityAtPosition, findPointAtPosition, dimensionSelection, addLengthDimension, addRadiusDimension, addPointToPointDimension, sketch]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);
    
    // Pan
    if (mouseState.isDragging && (activeTool === "pan" || draggingDimension === null)) {
      if (draggingDimension) {
        // Déplacer la cotation
        const dim = dimensions.find(d => d.id === draggingDimension);
        if (dim) {
          const deltaX = (screenX - mouseState.lastPos.x) / viewport.scale;
          const deltaY = (screenY - mouseState.lastPos.y) / viewport.scale;
          
          if (dim.type === "length") {
            // Calculer la nouvelle distance perpendiculaire
            const newOffset = dim.offset + deltaY * 0.5;
            setDimensions(prev => prev.map(d => 
              d.id === draggingDimension ? { ...d, offset: newOffset } : d
            ));
          } else if (dim.position) {
            setDimensions(prev => prev.map(d => 
              d.id === draggingDimension && d.position ? {
                ...d,
                position: {
                  x: d.position.x + deltaX,
                  y: d.position.y + deltaY,
                }
              } : d
            ));
          }
        }
      } else if (activeTool === "pan") {
        // Pan du viewport
        setViewport(prev => ({
          ...prev,
          offsetX: prev.offsetX + (screenX - mouseState.lastPos.x),
          offsetY: prev.offsetY + (screenY - mouseState.lastPos.y),
        }));
      }
      
      setMouseState(prev => ({ ...prev, lastPos: { x: screenX, y: screenY } }));
      return;
    }
    
    // Hover
    const entityId = findEntityAtPosition(worldPos.x, worldPos.y);
    setHoveredEntity(entityId);
  }, [mouseState, activeTool, viewport.scale, draggingDimension, dimensions, screenToWorld, findEntityAtPosition]);

  const handleMouseUp = useCallback(() => {
    setMouseState(prev => ({ ...prev, isDragging: false }));
    setDraggingDimension(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = viewport.scale * zoomFactor;
    
    // Zoom centré sur la souris
    setViewport(prev => ({
      scale: Math.max(0.1, Math.min(10, newScale)),
      offsetX: mouseX - (mouseX - prev.offsetX) * zoomFactor,
      offsetY: mouseY - (mouseY - prev.offsetY) * zoomFactor,
    }));
  }, [viewport.scale]);

  // Trouver une cotation à une position écran
  const findDimensionAtPosition = useCallback((screenX: number, screenY: number): string | null => {
    const tolerance = 15;
    
    for (const dim of dimensions) {
      if (dim.type === "length") {
        // Position du texte de la cotation
        let p1: Point | undefined;
        let p2: Point | undefined;
        
        if (dim.entityId) {
          const geo = sketch.geometries.get(dim.entityId);
          if (geo?.type === "line") {
            const line = geo as Line;
            p1 = sketch.points.get(line.p1);
            p2 = sketch.points.get(line.p2);
          }
        } else if (dim.p1Id && dim.p2Id) {
          p1 = sketch.points.get(dim.p1Id);
          p2 = sketch.points.get(dim.p2Id);
        }
        
        if (p1 && p2) {
          const t1 = worldToScreen(p1.x, p1.y);
          const t2 = worldToScreen(p2.x, p2.y);
          const midX = (t1.x + t2.x) / 2;
          const midY = (t1.y + t2.y) / 2;
          
          // Offset perpendiculaire
          const dx = t2.x - t1.x;
          const dy = t2.y - t1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            const perpX = -dy / len;
            const perpY = dx / len;
            const textX = midX + perpX * dim.offset * viewport.scale;
            const textY = midY + perpY * dim.offset * viewport.scale;
            
            if (Math.abs(screenX - textX) < tolerance * 2 && Math.abs(screenY - textY) < tolerance) {
              return dim.id;
            }
          }
        }
      } else if (dim.position) {
        const screenPos = worldToScreen(dim.position.x, dim.position.y);
        if (Math.abs(screenX - screenPos.x) < tolerance * 2 && Math.abs(screenY - screenPos.y) < tolerance) {
          return dim.id;
        }
      }
    }
    
    return null;
  }, [dimensions, sketch, worldToScreen, viewport.scale]);

  // Dessiner le canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Effacer
    ctx.fillStyle = "#F8F9FA";
    ctx.fillRect(0, 0, width, height);
    
    // Grille optionnelle
    if (options.showGrid) {
      ctx.strokeStyle = "#E5E7EB";
      ctx.lineWidth = 1;
      const gridSize = 50;
      
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
    
    // Zone de la page (aperçu du format)
    const pageWidth = options.orientation === "landscape" 
      ? PAGE_SIZES[options.format].height 
      : PAGE_SIZES[options.format].width;
    const pageHeight = options.orientation === "landscape"
      ? PAGE_SIZES[options.format].width
      : PAGE_SIZES[options.format].height;
    
    // Dessiner le cadre de page en arrière-plan
    const pageScale = Math.min((width * 0.9) / pageWidth, (height * 0.9) / pageHeight);
    const pageScreenWidth = pageWidth * pageScale;
    const pageScreenHeight = pageHeight * pageScale;
    const pageX = (width - pageScreenWidth) / 2;
    const pageY = (height - pageScreenHeight) / 2;
    
    // Ombre de la page
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(pageX + 5, pageY + 5, pageScreenWidth, pageScreenHeight);
    
    // Page blanche
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(pageX, pageY, pageScreenWidth, pageScreenHeight);
    
    // Cadre de page
    if (options.showFrame) {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.strokeRect(pageX, pageY, pageScreenWidth, pageScreenHeight);
      
      // Cadre intérieur (marge)
      const marginPx = options.margin * pageScale;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(pageX + marginPx, pageY + marginPx, 
        pageScreenWidth - 2 * marginPx, pageScreenHeight - 2 * marginPx);
    }
    
    // Cartouche
    const cartoucheH = CARTOUCHE_HEIGHT * pageScale;
    const cartoucheY = pageY + pageScreenHeight - cartoucheH - options.margin * pageScale;
    ctx.fillStyle = "#F5F5F5";
    ctx.fillRect(pageX + options.margin * pageScale, cartoucheY, 
      pageScreenWidth - 2 * options.margin * pageScale, cartoucheH);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(pageX + options.margin * pageScale, cartoucheY, 
      pageScreenWidth - 2 * options.margin * pageScale, cartoucheH);
    
    // Texte du cartouche
    ctx.fillStyle = "#333333";
    ctx.font = `bold ${12 * pageScale / 3}px Arial`;
    ctx.textAlign = "left";
    ctx.fillText("VAN PROJECT BUDDY", pageX + options.margin * pageScale + 5, cartoucheY + cartoucheH * 0.4);
    ctx.font = `${10 * pageScale / 3}px Arial`;
    ctx.fillText(options.title, pageX + options.margin * pageScale + 60 * pageScale, cartoucheY + cartoucheH * 0.4);
    ctx.fillText(`Échelle 1:${options.scale}`, pageX + pageScreenWidth - options.margin * pageScale - 50 * pageScale, cartoucheY + cartoucheH * 0.4);
    ctx.fillText(options.date, pageX + pageScreenWidth - options.margin * pageScale - 50 * pageScale, cartoucheY + cartoucheH * 0.75);
    
    // ===== DESSINER LES GÉOMÉTRIES =====
    ctx.save();
    
    // Lignes
    sketch.geometries.forEach((geo, id) => {
      const isHovered = hoveredEntity === id;
      const isConstruction = (geo as any).isConstruction;
      
      ctx.strokeStyle = isHovered ? "#FF6600" : (isConstruction ? "#9CA3AF" : "#000000");
      ctx.lineWidth = isHovered ? 2.5 : (isConstruction ? 1 : 1.5);
      
      if (isConstruction) {
        ctx.setLineDash([5, 5]);
      } else {
        ctx.setLineDash([]);
      }
      
      if (geo.type === "line") {
        const line = geo as Line;
        const p1 = sketch.points.get(line.p1);
        const p2 = sketch.points.get(line.p2);
        if (p1 && p2) {
          const t1 = worldToScreen(p1.x, p1.y);
          const t2 = worldToScreen(p2.x, p2.y);
          ctx.beginPath();
          ctx.moveTo(t1.x, t1.y);
          ctx.lineTo(t2.x, t2.y);
          ctx.stroke();
        }
      } else if (geo.type === "circle") {
        const circle = geo as CircleType;
        const center = sketch.points.get(circle.center);
        if (center) {
          const tc = worldToScreen(center.x, center.y);
          const radius = circle.radius * viewport.scale;
          ctx.beginPath();
          ctx.arc(tc.x, tc.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        const center = sketch.points.get(arc.center);
        const startPt = sketch.points.get(arc.startPoint);
        const endPt = sketch.points.get(arc.endPoint);
        if (center && startPt && endPt) {
          const tc = worldToScreen(center.x, center.y);
          const radius = arc.radius * viewport.scale;
          const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
          const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);
          ctx.beginPath();
          ctx.arc(tc.x, tc.y, radius, startAngle, endAngle, arc.counterClockwise);
          ctx.stroke();
        }
      } else if (geo.type === "bezier") {
        const bezier = geo as Bezier;
        const p1 = sketch.points.get(bezier.p1);
        const p2 = sketch.points.get(bezier.p2);
        const cp1 = sketch.points.get(bezier.cp1);
        const cp2 = sketch.points.get(bezier.cp2);
        if (p1 && p2 && cp1 && cp2) {
          const t1 = worldToScreen(p1.x, p1.y);
          const t2 = worldToScreen(p2.x, p2.y);
          const tc1 = worldToScreen(cp1.x, cp1.y);
          const tc2 = worldToScreen(cp2.x, cp2.y);
          ctx.beginPath();
          ctx.moveTo(t1.x, t1.y);
          ctx.bezierCurveTo(tc1.x, tc1.y, tc2.x, tc2.y, t2.x, t2.y);
          ctx.stroke();
        }
      }
    });
    
    ctx.setLineDash([]);
    
    // Points (petits cercles)
    ctx.fillStyle = "#3B82F6";
    sketch.points.forEach((point) => {
      const tp = worldToScreen(point.x, point.y);
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // ===== DESSINER LES COTATIONS =====
    dimensions.forEach((dim) => {
      const isDragging = draggingDimension === dim.id;
      ctx.strokeStyle = isDragging ? "#FF0000" : dim.color;
      ctx.fillStyle = isDragging ? "#FF0000" : dim.color;
      ctx.lineWidth = 1;
      ctx.font = `bold ${dim.fontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      if (dim.type === "length") {
        let p1: Point | undefined;
        let p2: Point | undefined;
        
        if (dim.entityId) {
          const geo = sketch.geometries.get(dim.entityId);
          if (geo?.type === "line") {
            const line = geo as Line;
            p1 = sketch.points.get(line.p1);
            p2 = sketch.points.get(line.p2);
          }
        } else if (dim.p1Id && dim.p2Id) {
          p1 = sketch.points.get(dim.p1Id);
          p2 = sketch.points.get(dim.p2Id);
        }
        
        if (p1 && p2) {
          const t1 = worldToScreen(p1.x, p1.y);
          const t2 = worldToScreen(p2.x, p2.y);
          
          // Direction et perpendiculaire
          const dx = t2.x - t1.x;
          const dy = t2.y - t1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return;
          
          const perpX = -dy / len;
          const perpY = dx / len;
          const offset = dim.offset * viewport.scale;
          
          // Points de la ligne de cote
          const d1 = { x: t1.x + perpX * offset, y: t1.y + perpY * offset };
          const d2 = { x: t2.x + perpX * offset, y: t2.y + perpY * offset };
          
          // Lignes d'attache
          ctx.beginPath();
          ctx.moveTo(t1.x, t1.y);
          ctx.lineTo(d1.x + perpX * 3, d1.y + perpY * 3);
          ctx.moveTo(t2.x, t2.y);
          ctx.lineTo(d2.x + perpX * 3, d2.y + perpY * 3);
          ctx.stroke();
          
          // Ligne de cote
          ctx.beginPath();
          ctx.moveTo(d1.x, d1.y);
          ctx.lineTo(d2.x, d2.y);
          ctx.stroke();
          
          // Flèches
          const arrowLen = 8;
          const arrowAngle = Math.PI / 6;
          const angle = Math.atan2(dy, dx);
          
          ctx.beginPath();
          ctx.moveTo(d1.x, d1.y);
          ctx.lineTo(d1.x + arrowLen * Math.cos(angle + arrowAngle), d1.y + arrowLen * Math.sin(angle + arrowAngle));
          ctx.moveTo(d1.x, d1.y);
          ctx.lineTo(d1.x + arrowLen * Math.cos(angle - arrowAngle), d1.y + arrowLen * Math.sin(angle - arrowAngle));
          ctx.moveTo(d2.x, d2.y);
          ctx.lineTo(d2.x - arrowLen * Math.cos(angle + arrowAngle), d2.y - arrowLen * Math.sin(angle + arrowAngle));
          ctx.moveTo(d2.x, d2.y);
          ctx.lineTo(d2.x - arrowLen * Math.cos(angle - arrowAngle), d2.y - arrowLen * Math.sin(angle - arrowAngle));
          ctx.stroke();
          
          // Texte
          const midX = (d1.x + d2.x) / 2;
          const midY = (d1.y + d2.y) / 2;
          const text = `${dim.value.toFixed(1)}`;
          
          // Fond blanc
          const textWidth = ctx.measureText(text).width;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(midX - textWidth / 2 - 4, midY - dim.fontSize / 2 - 2, textWidth + 8, dim.fontSize + 4);
          
          ctx.fillStyle = isDragging ? "#FF0000" : dim.color;
          ctx.fillText(text, midX, midY);
        }
      } else if ((dim.type === "radius" || dim.type === "diameter") && dim.position) {
        const geo = sketch.geometries.get(dim.entityId || "");
        if (!geo) return;
        
        let centerX = 0, centerY = 0, radius = 0;
        
        if (geo.type === "circle") {
          const circle = geo as CircleType;
          const center = sketch.points.get(circle.center);
          if (center) {
            centerX = center.x;
            centerY = center.y;
            radius = circle.radius;
          }
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          const center = sketch.points.get(arc.center);
          if (center) {
            centerX = center.x;
            centerY = center.y;
            radius = arc.radius;
          }
        }
        
        const tc = worldToScreen(centerX, centerY);
        const tp = worldToScreen(dim.position.x, dim.position.y);
        
        // Ligne du centre vers le texte
        ctx.beginPath();
        ctx.moveTo(tc.x, tc.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.stroke();
        
        // Texte
        const text = `${dim.prefix || ""}${dim.value.toFixed(1)}`;
        const textWidth = ctx.measureText(text).width;
        
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(tp.x - textWidth / 2 - 4, tp.y - dim.fontSize / 2 - 2, textWidth + 8, dim.fontSize + 4);
        
        ctx.fillStyle = isDragging ? "#FF0000" : dim.color;
        ctx.fillText(text, tp.x, tp.y);
      }
    });
    
    // Ligne de sélection en cours (cotation entre 2 points)
    if (dimensionSelection.p1Pos) {
      const t1 = worldToScreen(dimensionSelection.p1Pos.x, dimensionSelection.p1Pos.y);
      ctx.fillStyle = "#FF6600";
      ctx.beginPath();
      ctx.arc(t1.x, t1.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }, [sketch, viewport, options, dimensions, hoveredEntity, draggingDimension, dimensionSelection, worldToScreen]);

  // Export PDF
  const handleExportPDF = useCallback(() => {
    const pageWidth = options.orientation === "landscape" 
      ? PAGE_SIZES[options.format].height 
      : PAGE_SIZES[options.format].width;
    const pageHeight = options.orientation === "landscape"
      ? PAGE_SIZES[options.format].width
      : PAGE_SIZES[options.format].height;
    
    const doc = new jsPDF({
      orientation: options.orientation,
      unit: "mm",
      format: options.format,
    });
    
    // Calculer la zone de dessin
    const drawingArea = {
      x: options.margin,
      y: options.margin,
      width: pageWidth - 2 * options.margin,
      height: pageHeight - 2 * options.margin - CARTOUCHE_HEIGHT,
    };
    
    // Calculer les bounds
    const bounds = calculateBounds();
    if (!bounds) {
      toast.error("Aucune géométrie à exporter");
      return;
    }
    
    const sketchWidth = bounds.maxX - bounds.minX;
    const sketchHeight = bounds.maxY - bounds.minY;
    
    const scaleX = drawingArea.width / (sketchWidth / options.scale);
    const scaleY = drawingArea.height / (sketchHeight / options.scale);
    const fitScale = Math.min(scaleX, scaleY) * 0.85;
    
    const centerX = drawingArea.x + drawingArea.width / 2;
    const centerY = drawingArea.y + drawingArea.height / 2;
    const sketchCenterX = (bounds.minX + bounds.maxX) / 2;
    const sketchCenterY = (bounds.minY + bounds.maxY) / 2;
    
    const transform = (x: number, y: number) => ({
      x: centerX + ((x - sketchCenterX) / options.scale) * fitScale,
      y: centerY + ((y - sketchCenterY) / options.scale) * fitScale,
    });
    
    // Cadre
    if (options.showFrame) {
      doc.setLineWidth(0.5);
      doc.setDrawColor(0, 0, 0);
      doc.rect(options.margin, options.margin, pageWidth - 2 * options.margin, pageHeight - 2 * options.margin);
    }
    
    // Géométries
    doc.setLineWidth(options.lineWidth);
    doc.setDrawColor(0, 0, 0);
    
    sketch.geometries.forEach((geo) => {
      if ((geo as any).isConstruction) {
        doc.setDrawColor(150, 150, 150);
        doc.setLineDashPattern([2, 2], 0);
      } else {
        doc.setDrawColor(0, 0, 0);
        doc.setLineDashPattern([], 0);
      }
      
      if (geo.type === "line") {
        const line = geo as Line;
        const p1 = sketch.points.get(line.p1);
        const p2 = sketch.points.get(line.p2);
        if (p1 && p2) {
          const t1 = transform(p1.x, p1.y);
          const t2 = transform(p2.x, p2.y);
          doc.line(t1.x, t1.y, t2.x, t2.y);
        }
      } else if (geo.type === "circle") {
        const circle = geo as CircleType;
        const center = sketch.points.get(circle.center);
        if (center) {
          const tc = transform(center.x, center.y);
          const edge = transform(center.x + circle.radius, center.y);
          const radius = Math.abs(edge.x - tc.x);
          doc.circle(tc.x, tc.y, radius);
        }
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        const center = sketch.points.get(arc.center);
        const startPt = sketch.points.get(arc.startPoint);
        const endPt = sketch.points.get(arc.endPoint);
        if (center && startPt && endPt) {
          const tc = transform(center.x, center.y);
          const edge = transform(center.x + arc.radius, center.y);
          const radius = Math.abs(edge.x - tc.x);
          
          // Approximation de l'arc
          const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
          const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);
          
          let sweep = endAngle - startAngle;
          if (arc.counterClockwise) {
            if (sweep > 0) sweep -= 2 * Math.PI;
          } else {
            if (sweep < 0) sweep += 2 * Math.PI;
          }
          
          const segments = 32;
          let prevX = tc.x + radius * Math.cos(startAngle);
          let prevY = tc.y + radius * Math.sin(startAngle);
          
          for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const angle = startAngle + sweep * t;
            const x = tc.x + radius * Math.cos(angle);
            const y = tc.y + radius * Math.sin(angle);
            doc.line(prevX, prevY, x, y);
            prevX = x;
            prevY = y;
          }
        }
      }
    });
    
    doc.setLineDashPattern([], 0);
    
    // Cotations
    doc.setDrawColor(0, 100, 200);
    doc.setTextColor(0, 100, 200);
    doc.setFontSize(8);
    doc.setLineWidth(0.15);
    
    dimensions.forEach((dim) => {
      if (dim.type === "length") {
        let p1: Point | undefined;
        let p2: Point | undefined;
        
        if (dim.entityId) {
          const geo = sketch.geometries.get(dim.entityId);
          if (geo?.type === "line") {
            const line = geo as Line;
            p1 = sketch.points.get(line.p1);
            p2 = sketch.points.get(line.p2);
          }
        } else if (dim.p1Id && dim.p2Id) {
          p1 = sketch.points.get(dim.p1Id);
          p2 = sketch.points.get(dim.p2Id);
        }
        
        if (p1 && p2) {
          const t1 = transform(p1.x, p1.y);
          const t2 = transform(p2.x, p2.y);
          
          const dx = t2.x - t1.x;
          const dy = t2.y - t1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return;
          
          const perpX = -dy / len;
          const perpY = dx / len;
          const offset = dim.offset * fitScale / viewport.scale;
          
          const d1 = { x: t1.x + perpX * offset, y: t1.y + perpY * offset };
          const d2 = { x: t2.x + perpX * offset, y: t2.y + perpY * offset };
          
          // Lignes d'attache
          doc.line(t1.x, t1.y, d1.x + perpX * 1, d1.y + perpY * 1);
          doc.line(t2.x, t2.y, d2.x + perpX * 1, d2.y + perpY * 1);
          
          // Ligne de cote
          doc.line(d1.x, d1.y, d2.x, d2.y);
          
          // Flèches
          const arrowLen = 2;
          const arrowAngle = Math.PI / 6;
          const angle = Math.atan2(dy, dx);
          
          doc.line(d1.x, d1.y, d1.x + arrowLen * Math.cos(angle + arrowAngle), d1.y + arrowLen * Math.sin(angle + arrowAngle));
          doc.line(d1.x, d1.y, d1.x + arrowLen * Math.cos(angle - arrowAngle), d1.y + arrowLen * Math.sin(angle - arrowAngle));
          doc.line(d2.x, d2.y, d2.x - arrowLen * Math.cos(angle + arrowAngle), d2.y - arrowLen * Math.sin(angle + arrowAngle));
          doc.line(d2.x, d2.y, d2.x - arrowLen * Math.cos(angle - arrowAngle), d2.y - arrowLen * Math.sin(angle - arrowAngle));
          
          // Texte
          const midX = (d1.x + d2.x) / 2;
          const midY = (d1.y + d2.y) / 2;
          doc.text(`${dim.value.toFixed(1)}`, midX, midY - 1, { align: "center" });
        }
      } else if ((dim.type === "radius" || dim.type === "diameter") && dim.position) {
        const geo = sketch.geometries.get(dim.entityId || "");
        if (!geo) return;
        
        let centerX = 0, centerY = 0;
        
        if (geo.type === "circle") {
          const circle = geo as CircleType;
          const center = sketch.points.get(circle.center);
          if (center) { centerX = center.x; centerY = center.y; }
        } else if (geo.type === "arc") {
          const arc = geo as Arc;
          const center = sketch.points.get(arc.center);
          if (center) { centerX = center.x; centerY = center.y; }
        }
        
        const tc = transform(centerX, centerY);
        const tp = transform(dim.position.x, dim.position.y);
        
        doc.line(tc.x, tc.y, tp.x, tp.y);
        doc.text(`${dim.prefix || ""}${dim.value.toFixed(1)}`, tp.x + 2, tp.y);
      }
    });
    
    // Cartouche
    const cartoucheY = pageHeight - options.margin - CARTOUCHE_HEIGHT;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(options.margin, cartoucheY, pageWidth - 2 * options.margin, CARTOUCHE_HEIGHT);
    
    // Colonnes
    const col1 = options.margin;
    const col2 = options.margin + 50;
    const col3 = pageWidth - options.margin - 80;
    const col4 = pageWidth - options.margin - 50;
    const col5 = pageWidth - options.margin - 25;
    
    doc.line(col2, cartoucheY, col2, pageHeight - options.margin);
    doc.line(col3, cartoucheY, col3, pageHeight - options.margin);
    doc.line(col4, cartoucheY, col4, pageHeight - options.margin);
    doc.line(col5, cartoucheY, col5, pageHeight - options.margin);
    
    const midY = cartoucheY + CARTOUCHE_HEIGHT / 2;
    doc.line(col2, midY, pageWidth - options.margin, midY);
    
    // Textes
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("VAN PROJECT", col1 + 25, cartoucheY + 12, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("BUDDY", col1 + 25, cartoucheY + 18, { align: "center" });
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("PROJET", col2 + 2, cartoucheY + 4);
    doc.text("TITRE", col2 + 2, midY + 4);
    doc.text("ÉCHELLE", col3 + 2, cartoucheY + 4);
    doc.text("RÉV.", col4 + 2, cartoucheY + 4);
    doc.text("DATE", col5 + 2, cartoucheY + 4);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(options.projectName || "", col2 + 2, cartoucheY + 11);
    doc.setFont("helvetica", "bold");
    doc.text(options.title, col2 + 2, midY + 12);
    doc.setFont("helvetica", "normal");
    doc.text(`1:${options.scale}`, col3 + 14, cartoucheY + 11, { align: "center" });
    doc.text(options.revision || "A", col4 + 12.5, cartoucheY + 11, { align: "center" });
    doc.setFontSize(8);
    doc.text(options.date || "", col5 + 12.5, cartoucheY + 11, { align: "center" });
    
    // Sauvegarder
    const filename = `${options.title.replace(/[^a-zA-Z0-9]/g, "_")}_${options.date?.replace(/\//g, "-")}.pdf`;
    doc.save(filename);
    
    toast.success("PDF exporté avec succès");
  }, [sketch, dimensions, options, calculateBounds, viewport.scale]);

  // Initialiser
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (canvas && container) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
          initViewport();
        }
      }, 100);
    }
  }, [isOpen, initViewport]);

  // Redessiner
  useEffect(() => {
    draw();
  }, [draw]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        draw();
      }
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex">
      {/* Panneau latéral des options */}
      {showOptionsPanel && (
        <div className="w-80 bg-white border-r flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-lg">Export PDF</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowOptionsPanel(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Format */}
            <div className="space-y-2">
              <Label>Format</Label>
              <div className="flex gap-2">
                <Button
                  variant={options.format === "a4" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOptions(o => ({ ...o, format: "a4" }))}
                  className="flex-1"
                >
                  A4
                </Button>
                <Button
                  variant={options.format === "a3" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOptions(o => ({ ...o, format: "a3" }))}
                  className="flex-1"
                >
                  A3
                </Button>
              </div>
            </div>
            
            {/* Orientation */}
            <div className="space-y-2">
              <Label>Orientation</Label>
              <div className="flex gap-2">
                <Button
                  variant={options.orientation === "landscape" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOptions(o => ({ ...o, orientation: "landscape" }))}
                  className="flex-1"
                >
                  Paysage
                </Button>
                <Button
                  variant={options.orientation === "portrait" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOptions(o => ({ ...o, orientation: "portrait" }))}
                  className="flex-1"
                >
                  Portrait
                </Button>
              </div>
            </div>
            
            {/* Titre */}
            <div className="space-y-2">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                value={options.title}
                onChange={(e) => setOptions(o => ({ ...o, title: e.target.value }))}
              />
            </div>
            
            {/* Projet */}
            <div className="space-y-2">
              <Label htmlFor="project">Projet</Label>
              <Input
                id="project"
                value={options.projectName}
                onChange={(e) => setOptions(o => ({ ...o, projectName: e.target.value }))}
              />
            </div>
            
            {/* Auteur / Date / Révision */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="author" className="text-xs">Auteur</Label>
                <Input
                  id="author"
                  value={options.author}
                  onChange={(e) => setOptions(o => ({ ...o, author: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="date" className="text-xs">Date</Label>
                <Input
                  id="date"
                  value={options.date}
                  onChange={(e) => setOptions(o => ({ ...o, date: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="revision" className="text-xs">Rév.</Label>
                <Input
                  id="revision"
                  value={options.revision}
                  onChange={(e) => setOptions(o => ({ ...o, revision: e.target.value }))}
                  className="h-8 text-sm"
                  maxLength={3}
                />
              </div>
            </div>
            
            {/* Échelle */}
            <div className="space-y-2">
              <Label>Échelle 1:</Label>
              <div className="flex gap-1 flex-wrap">
                {[1, 2, 5, 10, 20, 50].map((s) => (
                  <Button
                    key={s}
                    variant={options.scale === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOptions(o => ({ ...o, scale: s }))}
                    className="px-3"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Options */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label>Afficher le cadre</Label>
                <Switch
                  checked={options.showFrame}
                  onCheckedChange={(c) => setOptions(o => ({ ...o, showFrame: c }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Afficher la grille</Label>
                <Switch
                  checked={options.showGrid}
                  onCheckedChange={(c) => setOptions(o => ({ ...o, showGrid: c }))}
                />
              </div>
            </div>
            
            {/* Cotations */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="font-semibold">Cotations ({dimensions.length})</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={autoAddAllDimensions} className="flex-1">
                  <Ruler className="h-4 w-4 mr-1" />
                  Auto
                </Button>
                <Button size="sm" variant="outline" onClick={clearAllDimensions} className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Effacer
                </Button>
              </div>
              
              {/* Liste des cotations */}
              <div className="max-h-40 overflow-y-auto space-y-1">
                {dimensions.map((dim) => (
                  <div key={dim.id} className="flex items-center justify-between text-sm bg-gray-50 px-2 py-1 rounded">
                    <span>
                      {dim.prefix || ""}{dim.value.toFixed(1)} mm
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeDimension(dim.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Bouton Export */}
          <div className="p-4 border-t">
            <Button onClick={handleExportPDF} className="w-full bg-red-600 hover:bg-red-700">
              <Download className="h-4 w-4 mr-2" />
              Exporter PDF
            </Button>
          </div>
        </div>
      )}
      
      {/* Zone principale */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white border-b p-2 flex items-center gap-2">
          {!showOptionsPanel && (
            <Button variant="outline" size="sm" onClick={() => setShowOptionsPanel(true)}>
              <Maximize2 className="h-4 w-4 mr-1" />
              Options
            </Button>
          )}
          
          <div className="h-6 w-px bg-gray-300 mx-2" />
          
          {/* Outils */}
          <Button
            variant={activeTool === "select" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTool("select")}
          >
            <MousePointer className="h-4 w-4 mr-1" />
            Sélection
          </Button>
          <Button
            variant={activeTool === "pan" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTool("pan")}
          >
            <Move className="h-4 w-4 mr-1" />
            Pan
          </Button>
          <Button
            variant={activeTool === "dimension" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setActiveTool("dimension");
              setDimensionSelection({ p1Id: null, p1Pos: null });
            }}
          >
            <Ruler className="h-4 w-4 mr-1" />
            Cotation
          </Button>
          <Button
            variant={activeTool === "radius" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTool("radius")}
          >
            <Circle className="h-4 w-4 mr-1" />
            Rayon
          </Button>
          
          <div className="h-6 w-px bg-gray-300 mx-2" />
          
          {/* Zoom */}
          <Button variant="outline" size="sm" onClick={() => setViewport(v => ({ ...v, scale: v.scale * 1.2 }))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setViewport(v => ({ ...v, scale: v.scale / 1.2 }))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={initViewport}>
            Recadrer
          </Button>
          
          <div className="flex-1" />
          
          {/* Info outil */}
          <div className="text-sm text-gray-500">
            {activeTool === "dimension" && "Cliquez sur une ligne ou 2 points"}
            {activeTool === "radius" && "Cliquez sur un cercle (Shift = diamètre)"}
            {activeTool === "select" && "Glissez les cotations pour les repositionner"}
          </div>
          
          <div className="flex-1" />
          
          {/* Fermer */}
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Fermer
          </Button>
        </div>
        
        {/* Canvas */}
        <div ref={containerRef} className="flex-1 bg-gray-200 overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            style={{
              cursor: activeTool === "pan" ? "grab" : 
                      activeTool === "dimension" || activeTool === "radius" ? "crosshair" : 
                      draggingDimension ? "grabbing" : "default"
            }}
          />
        </div>
      </div>
    </div>
  );
}
