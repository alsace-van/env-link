// ============================================
// COMPOSANT: PhotoPreviewEditor
// Preview individuelle avec outils de transformation
// VERSION: 1.0.0
// ============================================
//
// Changelog (3 dernières versions) :
// - v1.0.0 (2025-01-23) : Création initiale
//
// Historique complet : voir REFACTORING_PHOTO_PREPARATION.md
// ============================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  RotateCcw,
  RotateCw,
  Scissors,
  Ruler,
  ChevronLeft,
  ChevronRight,
  Check,
  SkipForward,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize,
  QrCode,
  Loader2,
  X,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  PhotoToProcess,
  Measurement,
  MeasurePoint,
  ImageCropData,
  ArucoDetectionResult,
  STRETCH_INCREMENT_NORMAL,
  STRETCH_INCREMENT_FINE,
  STRETCH_INCREMENT_FAST,
  generateId,
  getNextMeasureColor,
} from "./types";
import { useArucoDetection } from "./useArucoDetection";

interface PhotoPreviewEditorProps {
  photo: PhotoToProcess;
  photoIndex: number;
  totalPhotos: number;
  measurements: Measurement[];
  pendingMeasurePoint: MeasurePoint | null;
  activeTool: "none" | "measure" | "crop";
  scaleFactor: number;
  
  // Actions
  onRotate: (direction: "cw" | "ccw") => void;
  onSetCrop: (crop: ImageCropData | null) => void;
  onSetStretch: (stretchX: number, stretchY: number) => void;
  onAdjustStretchX: (deltaMm: number) => void;
  onAdjustStretchY: (deltaMm: number) => void;
  onSetActiveTool: (tool: "none" | "measure" | "crop") => void;
  onAddMeasurePoint: (xPercent: number, yPercent: number) => void;
  onRemoveMeasurement: (id: string) => void;
  onClearMeasurements: () => void;
  onUpdatePhoto: (updates: Partial<PhotoToProcess>) => void;
  
  // Navigation
  onPrev: () => void;
  onNext: () => void;
  onValidate: () => void;
  onSkip: () => void;
  onBackToGrid: () => void;
  
  // Calculs
  getDimensionsMm: (photo: PhotoToProcess) => { widthMm: number; heightMm: number };
  calculateDistanceMm: (p1: MeasurePoint, p2: MeasurePoint) => number;
}

export const PhotoPreviewEditor: React.FC<PhotoPreviewEditorProps> = ({
  photo,
  photoIndex,
  totalPhotos,
  measurements,
  pendingMeasurePoint,
  activeTool,
  scaleFactor,
  onRotate,
  onSetCrop,
  onSetStretch,
  onAdjustStretchX,
  onAdjustStretchY,
  onSetActiveTool,
  onAddMeasurePoint,
  onRemoveMeasurement,
  onClearMeasurements,
  onUpdatePhoto,
  onPrev,
  onNext,
  onValidate,
  onSkip,
  onBackToGrid,
  getDimensionsMm,
  calculateDistanceMm,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // État local
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Inputs pour dimensions
  const { widthMm, heightMm } = getDimensionsMm(photo);
  const [targetWidthMm, setTargetWidthMm] = useState(widthMm.toFixed(1));
  const [targetHeightMm, setTargetHeightMm] = useState(heightMm.toFixed(1));
  
  // ArUco
  const { isOpenCVLoaded, isDetecting, detectMarkers } = useArucoDetection();
  const [arucoProcessed, setArucoProcessed] = useState(false);

  // Mettre à jour les inputs quand les dimensions changent
  useEffect(() => {
    setTargetWidthMm(widthMm.toFixed(1));
    setTargetHeightMm(heightMm.toFixed(1));
  }, [widthMm, heightMm]);

  // Observer la taille du container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Fit to view au chargement
  useEffect(() => {
    if (photo.image && containerSize.width > 0) {
      fitToView();
    }
  }, [photo.id, containerSize]);

  // Détection ArUco automatique
  useEffect(() => {
    if (
      photo.image &&
      isOpenCVLoaded &&
      !arucoProcessed &&
      !photo.arucoDetected &&
      !photo.arucoScaleX
    ) {
      runArucoDetection();
    }
  }, [photo.id, photo.image, isOpenCVLoaded, arucoProcessed]);

  // Reset arucoProcessed quand on change de photo
  useEffect(() => {
    setArucoProcessed(false);
  }, [photo.id]);

  // Fit to view
  const fitToView = useCallback(() => {
    if (!photo.image || containerSize.width === 0) return;
    
    const padding = 40;
    const availableWidth = containerSize.width - padding * 2;
    const availableHeight = containerSize.height - padding * 2;
    
    const imgWidth = photo.currentWidth * photo.stretchX;
    const imgHeight = photo.currentHeight * photo.stretchY;
    
    const scaleX = availableWidth / imgWidth;
    const scaleY = availableHeight / imgHeight;
    const newZoom = Math.min(scaleX, scaleY, 1);
    
    setZoom(newZoom);
    setPan({ x: 0, y: 0 });
  }, [photo, containerSize]);

  // Détection ArUco
  const runArucoDetection = useCallback(async () => {
    if (!photo.image) return;
    
    setArucoProcessed(true);
    
    const result = await detectMarkers(photo.image);
    
    if (result.markers.length > 0 && result.scaleX && result.scaleY) {
      onUpdatePhoto({
        arucoDetected: true,
        arucoScaleX: result.scaleX,
        arucoScaleY: result.scaleY,
      });
      
      toast.success(
        `${result.markers.length} marqueur(s) ArUco détecté(s)`,
        { duration: 2000 }
      );
    }
  }, [photo.image, detectMarkers, onUpdatePhoto]);

  // Gestion du zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.1, Math.min(5, z * delta)));
  }, []);

  // Gestion du pan
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === "measure") {
        // Mode mesure : ajouter un point
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || !photo.image) return;
        
        // Convertir la position écran en % de l'image
        const imgWidth = photo.currentWidth * photo.stretchX * zoom;
        const imgHeight = photo.currentHeight * photo.stretchY * zoom;
        const imgX = (containerSize.width - imgWidth) / 2 + pan.x;
        const imgY = (containerSize.height - imgHeight) / 2 + pan.y;
        
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        // Vérifier si le clic est sur l'image
        if (
          clickX >= imgX &&
          clickX <= imgX + imgWidth &&
          clickY >= imgY &&
          clickY <= imgY + imgHeight
        ) {
          const xPercent = ((clickX - imgX) / imgWidth) * 100;
          const yPercent = ((clickY - imgY) / imgHeight) * 100;
          onAddMeasurePoint(xPercent, yPercent);
        }
        return;
      }
      
      // Mode normal : pan
      if (e.button === 0) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [activeTool, zoom, pan, containerSize, photo, onAddMeasurePoint]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      }
    },
    [isPanning, panStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Appliquer les dimensions saisies
  const applyTargetDimensions = useCallback(() => {
    const newWidth = parseFloat(targetWidthMm.replace(",", "."));
    const newHeight = parseFloat(targetHeightMm.replace(",", "."));
    
    if (isNaN(newWidth) || isNaN(newHeight) || newWidth <= 0 || newHeight <= 0) {
      toast.error("Dimensions invalides");
      return;
    }
    
    const newStretchX = (newWidth / widthMm) * photo.stretchX;
    const newStretchY = (newHeight / heightMm) * photo.stretchY;
    
    onSetStretch(newStretchX, newStretchY);
  }, [targetWidthMm, targetHeightMm, widthMm, heightMm, photo.stretchX, photo.stretchY, onSetStretch]);

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      let increment = STRETCH_INCREMENT_NORMAL;
      if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
        increment = STRETCH_INCREMENT_FINE;
      } else if (e.ctrlKey || e.metaKey) {
        increment = STRETCH_INCREMENT_FAST;
      }

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          onAdjustStretchX(-increment);
          break;
        case "ArrowRight":
          e.preventDefault();
          onAdjustStretchX(increment);
          break;
        case "ArrowUp":
          e.preventDefault();
          onAdjustStretchY(-increment);
          break;
        case "ArrowDown":
          e.preventDefault();
          onAdjustStretchY(increment);
          break;
        case "r":
        case "R":
          e.preventDefault();
          onRotate(e.shiftKey ? "ccw" : "cw");
          break;
        case "m":
        case "M":
          e.preventDefault();
          onSetActiveTool(activeTool === "measure" ? "none" : "measure");
          break;
        case "Escape":
          e.preventDefault();
          if (activeTool !== "none") {
            onSetActiveTool("none");
          }
          break;
        case "Enter":
          e.preventDefault();
          onValidate();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTool, onAdjustStretchX, onAdjustStretchY, onRotate, onSetActiveTool, onValidate]);

  // Calculer la position d'un point de mesure en pixels écran
  const getMeasurePointScreenPos = useCallback(
    (point: MeasurePoint): { x: number; y: number } => {
      const imgWidth = photo.currentWidth * photo.stretchX * zoom;
      const imgHeight = photo.currentHeight * photo.stretchY * zoom;
      const imgX = (containerSize.width - imgWidth) / 2 + pan.x;
      const imgY = (containerSize.height - imgHeight) / 2 + pan.y;
      
      return {
        x: imgX + (point.xPercent / 100) * imgWidth,
        y: imgY + (point.yPercent / 100) * imgHeight,
      };
    },
    [photo, zoom, pan, containerSize]
  );

  // Render de l'image
  const renderImage = () => {
    if (!photo.image) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    const imgWidth = photo.currentWidth * photo.stretchX * zoom;
    const imgHeight = photo.currentHeight * photo.stretchY * zoom;

    return (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
        }}
      >
        <img
          src={photo.imageDataUrl || ""}
          alt={photo.name}
          style={{
            width: imgWidth,
            height: imgHeight,
            transform: `rotate(${photo.rotation}deg)`,
            transformOrigin: "center",
          }}
          draggable={false}
        />
      </div>
    );
  };

  // Render des mesures
  const renderMeasurements = () => {
    const elements: React.ReactNode[] = [];

    // Mesures existantes
    for (const measurement of measurements) {
      if (!measurement.visible) continue;
      
      const p1Screen = getMeasurePointScreenPos(measurement.point1);
      const p2Screen = getMeasurePointScreenPos(measurement.point2);
      const distance = calculateDistanceMm(measurement.point1, measurement.point2);
      
      // Ligne
      elements.push(
        <line
          key={`line-${measurement.id}`}
          x1={p1Screen.x}
          y1={p1Screen.y}
          x2={p2Screen.x}
          y2={p2Screen.y}
          stroke={measurement.color}
          strokeWidth={2}
        />
      );
      
      // Points
      elements.push(
        <circle
          key={`p1-${measurement.id}`}
          cx={p1Screen.x}
          cy={p1Screen.y}
          r={6}
          fill={measurement.color}
          stroke="white"
          strokeWidth={2}
        />
      );
      elements.push(
        <circle
          key={`p2-${measurement.id}`}
          cx={p2Screen.x}
          cy={p2Screen.y}
          r={6}
          fill={measurement.color}
          stroke="white"
          strokeWidth={2}
        />
      );
      
      // Label avec distance
      const midX = (p1Screen.x + p2Screen.x) / 2;
      const midY = (p1Screen.y + p2Screen.y) / 2;
      elements.push(
        <g key={`label-${measurement.id}`}>
          <rect
            x={midX - 40}
            y={midY - 12}
            width={80}
            height={24}
            rx={4}
            fill={measurement.color}
          />
          <text
            x={midX}
            y={midY + 5}
            textAnchor="middle"
            fill="white"
            fontSize={14}
            fontWeight="bold"
          >
            {distance.toFixed(1)} mm
          </text>
          {/* Bouton supprimer */}
          <circle
            cx={midX + 50}
            cy={midY}
            r={10}
            fill="white"
            stroke={measurement.color}
            strokeWidth={2}
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              onRemoveMeasurement(measurement.id);
            }}
          />
          <text
            x={midX + 50}
            y={midY + 4}
            textAnchor="middle"
            fill={measurement.color}
            fontSize={12}
            fontWeight="bold"
            style={{ cursor: "pointer", pointerEvents: "none" }}
          >
            ×
          </text>
        </g>
      );
    }

    // Point en attente
    if (pendingMeasurePoint) {
      const pos = getMeasurePointScreenPos(pendingMeasurePoint);
      elements.push(
        <circle
          key="pending"
          cx={pos.x}
          cy={pos.y}
          r={8}
          fill="#E74C3C"
          stroke="white"
          strokeWidth={2}
          className="animate-pulse"
        />
      );
    }

    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ overflow: "visible" }}
      >
        <g style={{ pointerEvents: "auto" }}>{elements}</g>
      </svg>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToGrid}
            className="text-gray-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Grille
          </Button>
          
          <Separator orientation="vertical" className="h-6 bg-gray-600" />
          
          <span className="text-white font-medium">
            Photo {photoIndex + 1} / {totalPhotos}
          </span>
          
          <span className="text-gray-400 text-sm truncate max-w-[200px]">
            {photo.name}
          </span>
          
          {photo.arucoDetected && (
            <Badge variant="secondary" className="bg-green-600 text-white">
              <QrCode className="h-3 w-3 mr-1" />
              ArUco
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            disabled={photoIndex === 0}
            className="text-gray-300 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            disabled={photoIndex === totalPhotos - 1}
            className="text-gray-300 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Zone de preview */}
      <div className="flex-1 flex">
        {/* Canvas principal */}
        <div
          ref={containerRef}
          className={`flex-1 relative overflow-hidden ${
            activeTool === "measure" ? "cursor-crosshair" : "cursor-grab"
          } ${isPanning ? "cursor-grabbing" : ""}`}
          style={{ touchAction: "none" }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {renderImage()}
          {renderMeasurements()}
          
          {/* Indicateur de mode */}
          {activeTool === "measure" && (
            <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              Cliquez pour mesurer
              {pendingMeasurePoint && " (2ème point)"}
            </div>
          )}
          
          {/* Contrôles de zoom */}
          <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-black/50 rounded-lg p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => setZoom((z) => Math.max(0.1, z * 0.8))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-white text-xs w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => setZoom((z) => Math.min(5, z * 1.2))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={fitToView}
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Panneau latéral */}
        <div className="w-72 bg-gray-800 border-l border-gray-700 p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Outils */}
          <div>
            <Label className="text-gray-400 text-xs mb-2 block">OUTILS</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeTool === "none" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onSetActiveTool("none")}
                className="text-gray-300"
              >
                Déplacer
              </Button>
              <Button
                variant={activeTool === "measure" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onSetActiveTool("measure")}
                className="text-gray-300"
              >
                <Ruler className="h-4 w-4 mr-1" />
                Mesurer
              </Button>
            </div>
          </div>
          
          <Separator className="bg-gray-700" />

          {/* Rotation */}
          <div>
            <Label className="text-gray-400 text-xs mb-2 block">ROTATION</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRotate("ccw")}
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                -90°
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRotate("cw")}
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <RotateCw className="h-4 w-4 mr-1" />
                +90°
              </Button>
            </div>
          </div>

          <Separator className="bg-gray-700" />

          {/* Dimensions */}
          <div>
            <Label className="text-gray-400 text-xs mb-2 block">
              DIMENSIONS (mm)
            </Label>
            
            <div className="space-y-2">
              {/* Largeur X */}
              <div className="flex items-center gap-2">
                <Label className="text-gray-300 text-xs w-8">X:</Label>
                <Input
                  type="text"
                  value={targetWidthMm}
                  onChange={(e) => setTargetWidthMm(e.target.value)}
                  onBlur={applyTargetDimensions}
                  onKeyDown={(e) => e.key === "Enter" && applyTargetDimensions()}
                  className="flex-1 h-8 bg-gray-700 border-gray-600 text-white text-sm"
                />
                <span className="text-gray-500 text-xs">
                  (actuel: {widthMm.toFixed(1)})
                </span>
              </div>
              
              {/* Hauteur Y */}
              <div className="flex items-center gap-2">
                <Label className="text-gray-300 text-xs w-8">Y:</Label>
                <Input
                  type="text"
                  value={targetHeightMm}
                  onChange={(e) => setTargetHeightMm(e.target.value)}
                  onBlur={applyTargetDimensions}
                  onKeyDown={(e) => e.key === "Enter" && applyTargetDimensions()}
                  className="flex-1 h-8 bg-gray-700 border-gray-600 text-white text-sm"
                />
                <span className="text-gray-500 text-xs">
                  (actuel: {heightMm.toFixed(1)})
                </span>
              </div>
            </div>

            {/* Delta */}
            {(photo.stretchX !== 1 || photo.stretchY !== 1) && (
              <div className="mt-2 p-2 bg-blue-900/30 rounded text-xs text-blue-300">
                <p>Étirement X: ×{photo.stretchX.toFixed(4)}</p>
                <p>Étirement Y: ×{photo.stretchY.toFixed(4)}</p>
              </div>
            )}

            <p className="text-gray-500 text-[10px] mt-2">
              Raccourcis: ←→ = X ±1mm, ↑↓ = Y ±1mm
              <br />
              SHIFT = ±0.1mm, CTRL = ±5mm
            </p>
          </div>

          <Separator className="bg-gray-700" />

          {/* Mesures */}
          {measurements.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-gray-400 text-xs">MESURES</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearMeasurements}
                  className="h-6 text-xs text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Effacer
                </Button>
              </div>
              <div className="space-y-1">
                {measurements.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2 bg-gray-700 rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: m.color }}
                      />
                      <span className="text-white font-medium">
                        {calculateDistanceMm(m.point1, m.point2).toFixed(1)} mm
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-400 hover:text-red-400"
                      onClick={() => onRemoveMeasurement(m.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
              onClick={onSkip}
            >
              <SkipForward className="h-4 w-4 mr-2" />
              Passer cette photo
            </Button>
            
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={onValidate}
            >
              <Check className="h-4 w-4 mr-2" />
              Valider et continuer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoPreviewEditor;
