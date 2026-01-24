// ============================================
// COMPOSANT: PhotoPreviewEditor
// Preview individuelle avec outils de transformation
// VERSION: 1.0.7
// ============================================
//
// Changelog (3 dernières versions) :
// - v1.0.7 (2025-01-24) : Suppression zoom minimum artificiel
//   - Le zoom min de 25% causait une désynchronisation image/marqueurs
//   - Laisser le zoom calculé naturellement (~15-20% pour grandes images)
// - v1.0.6 (2025-01-24) : Fix calcul position marqueurs - scale depuis le centre
// - v1.0.4 (2025-01-24) : Zoom initial, marqueurs après fitToView
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
  STRETCH_INCREMENT_NORMAL,
  STRETCH_INCREMENT_FINE,
  STRETCH_INCREMENT_FAST,
  generateId,
  getNextMeasureColor,
} from "./types";
import { useOpenCVAruco } from "../useOpenCVAruco";

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
  onClose: () => void; // Fermer la modale
  
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
  onClose,
  getDimensionsMm,
  calculateDistanceMm,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // État local
  // v1.0.7: Zoom initial à 0.15 (valeur typique pour grandes images en attendant fitToView)
  const [zoom, setZoom] = useState(0.15);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Inputs pour dimensions
  const { widthMm, heightMm } = getDimensionsMm(photo);
  const [targetWidthMm, setTargetWidthMm] = useState(widthMm.toFixed(1));
  const [targetHeightMm, setTargetHeightMm] = useState(heightMm.toFixed(1));
  
  // ArUco - Utilise le détecteur JS existant qui fonctionne
  const { isLoaded: isArucoLoaded, detectMarkers } = useOpenCVAruco({ markerSizeCm: 5 });
  const [arucoProcessed, setArucoProcessed] = useState(false);
  // v1.0.1: Stocker les marqueurs détectés pour les afficher
  const [detectedMarkers, setDetectedMarkers] = useState<Array<{
    id: number;
    corners: { x: number; y: number }[];
    center: { x: number; y: number };
  }>>([]);

  // État pour tracker si on a déjà fait le fit initial
  const [initialFitDone, setInitialFitDone] = useState(false);

  // DEBUG: Log tous les changements d'état importants
  useEffect(() => {
    console.log("[DEBUG] Component state:", {
      photoId: photo.id,
      hasImage: !!photo.image,
      initialFitDone,
      zoom,
      arucoProcessed,
      arucoDetected: photo.arucoDetected,
    });
  });

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

  // v1.0.1: Référence stable pour l'image (évite les re-renders)
  const imageRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    imageRef.current = photo.image;
  }, [photo.image]);

  // Fit to view - v1.0.2: Corrigé pour utiliser containerSize du ResizeObserver
  const fitToView = useCallback(() => {
    const image = imageRef.current;
    if (!image) {
      console.log("[DEBUG] fitToView SKIP - no image");
      return;
    }

    // v1.0.2: Utiliser containerSize de l'état (mis à jour par ResizeObserver)
    // C'est plus fiable que getBoundingClientRect() qui peut retourner 0 au premier render
    const containerWidth = containerSize.width;
    const containerHeight = containerSize.height;

    // Vérifier que le container a des dimensions valides
    if (containerWidth < 200 || containerHeight < 200) {
      console.log("[DEBUG] fitToView SKIP - container too small:", containerWidth, containerHeight);
      return;
    }

    const padding = 40;
    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;

    // Dimensions naturelles de l'image
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;

    if (naturalWidth === 0 || naturalHeight === 0) {
      console.log("[DEBUG] fitToView SKIP - image dimensions zero");
      return;
    }

    // Calculer le zoom pour que l'image tienne dans le container
    const currentStretchX = photo.stretchX;
    const currentStretchY = photo.stretchY;

    const scaleX = availableWidth / (naturalWidth * currentStretchX);
    const scaleY = availableHeight / (naturalHeight * currentStretchY);
    let newZoom = Math.min(scaleX, scaleY);

    // v1.0.7: Pas de zoom minimum artificiel - laisser le calcul naturel
    // Sinon les marqueurs et l'image sont désynchronisés
    const MAX_ZOOM = 2;
    if (newZoom > MAX_ZOOM) {
      newZoom = MAX_ZOOM;
    }

    console.log("[DEBUG] fitToView APPLYING zoom:", (newZoom * 100).toFixed(1) + "%",
      "container:", containerWidth, "x", containerHeight,
      "image:", naturalWidth, "x", naturalHeight);
    setZoom(newZoom);
    setPan({ x: 0, y: 0 });
  }, [photo.stretchX, photo.stretchY, containerSize]); // v1.0.2: Ajout containerSize

  // Fit to view UNIQUEMENT au chargement initial de la photo
  // v1.0.2: Utilise containerSize comme déclencheur pour s'assurer que le layout est prêt
  const fitDoneForPhotoRef = useRef<string | null>(null);

  useEffect(() => {
    // Ne faire le fit que si c'est une nouvelle photo
    if (fitDoneForPhotoRef.current === photo.id) return;
    if (!photo.image) return;
    // v1.0.2: Attendre que le container ait des dimensions valides
    if (containerSize.width < 200 || containerSize.height < 200) {
      console.log("[DEBUG] fitToView useEffect - waiting for container size:", containerSize);
      return;
    }

    console.log("[DEBUG] fitToView useEffect - NEW photo:", photo.id, "container ready:", containerSize);

    // Petit délai pour stabilisation finale
    const timer = setTimeout(() => {
      console.log("[DEBUG] fitToView useEffect - CALLING fitToView for:", photo.id);
      fitToView();
      fitDoneForPhotoRef.current = photo.id;
      setInitialFitDone(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [photo.id, photo.image, fitToView, containerSize]); // v1.0.2: Ajout containerSize

  // Reset initialFitDone quand on change de photo
  useEffect(() => {
    console.log("[DEBUG] Reset useEffect - photo.id changed:", photo.id);
    setInitialFitDone(false);
    setPan({ x: 0, y: 0 });
    setZoom(0.15); // v1.0.7: Reset zoom à valeur typique
  }, [photo.id]);

  // Détection ArUco - DOIT être défini AVANT le useEffect qui l'utilise
  // Taille des marqueurs ArUco en mm
  const ARUCO_MARKER_SIZE_MM = 50;
  
  const runArucoDetection = useCallback(async () => {
    if (!photo.image) return;

    setArucoProcessed(true);

    // useOpenCVAruco.detectMarkers retourne directement ArucoMarker[]
    const markers = await detectMarkers(photo.image);

    if (markers.length > 0) {
      // v1.0.1: Stocker les marqueurs pour affichage visuel
      setDetectedMarkers(markers.map(m => ({
        id: m.id,
        corners: m.corners,
        center: m.center,
      })));

      // Calculer le scale X et Y séparément à partir des tailles des marqueurs
      let totalScaleX = 0;
      let totalScaleY = 0;

      for (const marker of markers) {
        // marker.size.width et marker.size.height sont en pixels
        totalScaleX += marker.size.width / ARUCO_MARKER_SIZE_MM;
        totalScaleY += marker.size.height / ARUCO_MARKER_SIZE_MM;
      }

      const scaleX = totalScaleX / markers.length;
      const scaleY = totalScaleY / markers.length;

      onUpdatePhoto({
        arucoDetected: true,
        arucoScaleX: scaleX,
        arucoScaleY: scaleY,
      });

      toast.success(
        `${markers.length} marqueur(s) ArUco détecté(s)`,
        { duration: 2000 }
      );
    } else {
      setDetectedMarkers([]);
    }
  }, [photo.image, detectMarkers, onUpdatePhoto]);

  // Détection ArUco automatique
  useEffect(() => {
    if (
      photo.image &&
      isArucoLoaded &&
      !arucoProcessed &&
      !photo.arucoDetected &&
      !photo.arucoScaleX
    ) {
      runArucoDetection();
    }
  }, [photo.id, photo.image, isArucoLoaded, arucoProcessed, runArucoDetection]);

  // Reset arucoProcessed et marqueurs quand on change de photo
  useEffect(() => {
    setArucoProcessed(false);
    setDetectedMarkers([]); // v1.0.1: Reset les marqueurs aussi
  }, [photo.id]);

  // Gestion du zoom - bloquer wheel sur tout le composant racine
  useEffect(() => {
    const root = rootRef.current;
    const container = containerRef.current;
    if (!root) return;

    const handleWheel = (e: WheelEvent) => {
      // TOUJOURS bloquer le wheel
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      // Si la souris est sur le canvas (container), faire le zoom
      if (container && container.contains(e.target as Node)) {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom((z) => Math.max(0.1, Math.min(5, z * delta)));
      }
      
      return false;
    };

    // Attacher sur le root avec capture pour intercepter en premier
    root.addEventListener("wheel", handleWheel, { passive: false, capture: true });

    return () => {
      root.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, []);

  // Gestion du pan
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === "measure") {
        // Mode mesure : ajouter un point
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || !photo.image) return;
        
        // Dimensions naturelles
        const naturalWidth = photo.image.naturalWidth || photo.image.width;
        const naturalHeight = photo.image.naturalHeight || photo.image.height;
        
        // Dimensions affichées (avec zoom et stretch)
        const displayWidth = naturalWidth * zoom * photo.stretchX;
        const displayHeight = naturalHeight * zoom * photo.stretchY;
        
        // Position de l'image dans le container
        const imgX = (containerSize.width - displayWidth) / 2 + pan.x;
        const imgY = (containerSize.height - displayHeight) / 2 + pan.y;
        
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        // Vérifier si le clic est sur l'image
        if (
          clickX >= imgX &&
          clickX <= imgX + displayWidth &&
          clickY >= imgY &&
          clickY <= imgY + displayHeight
        ) {
          const xPercent = ((clickX - imgX) / displayWidth) * 100;
          const yPercent = ((clickY - imgY) / displayHeight) * 100;
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
      if (!photo.image) return { x: 0, y: 0 };
      
      // Dimensions naturelles
      const naturalWidth = photo.image.naturalWidth || photo.image.width;
      const naturalHeight = photo.image.naturalHeight || photo.image.height;
      
      // Dimensions affichées (avec zoom et stretch)
      const displayWidth = naturalWidth * zoom * photo.stretchX;
      const displayHeight = naturalHeight * zoom * photo.stretchY;
      
      // Position de l'image dans le container
      const imgX = (containerSize.width - displayWidth) / 2 + pan.x;
      const imgY = (containerSize.height - displayHeight) / 2 + pan.y;
      
      return {
        x: imgX + (point.xPercent / 100) * displayWidth,
        y: imgY + (point.yPercent / 100) * displayHeight,
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

    // Calculer le scale total (zoom + stretch)
    const totalScaleX = zoom * photo.stretchX;
    const totalScaleY = zoom * photo.stretchY;

    return (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
          pointerEvents: "none",
        }}
      >
        <img
          src={photo.imageDataUrl || ""}
          alt={photo.name}
          style={{
            // NE PAS définir width/height - laisser l'image à sa taille naturelle
            // Appliquer zoom ET stretch via transform
            transform: `scale(${totalScaleX}, ${totalScaleY}) rotate(${photo.rotation}deg)`,
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

  // v1.0.1: Render des marqueurs ArUco détectés
  // v1.0.4: Ne pas afficher avant que le fitToView initial soit fait
  // v1.0.6: Fix calcul position - prendre en compte que scale() est sur l'img, pas le div
  const renderArucoMarkers = () => {
    if (detectedMarkers.length === 0 || !photo.image || !initialFitDone) return null;

    const elements: React.ReactNode[] = [];

    // Dimensions naturelles de l'image
    const naturalWidth = photo.image.naturalWidth || photo.image.width;
    const naturalHeight = photo.image.naturalHeight || photo.image.height;

    // Scale total appliqué à l'image via CSS transform
    const totalScaleX = zoom * photo.stretchX;
    const totalScaleY = zoom * photo.stretchY;

    // L'image est positionnée ainsi:
    // 1. Le div parent est à left:50%, top:50% du container
    // 2. Le div parent est translaté de (-50%, -50%) de SA PROPRE TAILLE (= taille naturelle de l'img)
    // 3. Le div parent est translaté de (pan.x, pan.y)
    // 4. L'img à l'intérieur est scalée avec transformOrigin:center
    //
    // Le centre du div parent (et donc de l'image non-scalée) est à:
    const divCenterX = containerSize.width / 2 + pan.x;
    const divCenterY = containerSize.height / 2 + pan.y;

    for (const marker of detectedMarkers) {
      // corner.x/y sont en pixels de l'image originale (0 à naturalWidth/Height)
      // On doit:
      // 1. Trouver la position du coin dans le div (= position dans l'image non-scalée)
      // 2. Appliquer la transformation scale() avec origin au centre de l'image
      const screenCorners = marker.corners.map(corner => {
        // Position relative au centre de l'image (en pixels originaux)
        const relX = corner.x - naturalWidth / 2;
        const relY = corner.y - naturalHeight / 2;

        // Appliquer le scale (depuis le centre)
        const scaledRelX = relX * totalScaleX;
        const scaledRelY = relY * totalScaleY;

        // Position finale = centre du div + position relative scalée
        return {
          x: divCenterX + scaledRelX,
          y: divCenterY + scaledRelY,
        };
      });

      // Dessiner le contour du marqueur
      const pathData = screenCorners
        .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
        .join(' ') + ' Z';

      elements.push(
        <path
          key={`marker-outline-${marker.id}`}
          d={pathData}
          fill="rgba(0, 255, 0, 0.15)"
          stroke="#00FF00"
          strokeWidth={2}
        />
      );

      // Dessiner les coins
      for (let i = 0; i < screenCorners.length; i++) {
        const corner = screenCorners[i];
        elements.push(
          <circle
            key={`marker-${marker.id}-corner-${i}`}
            cx={corner.x}
            cy={corner.y}
            r={4}
            fill={i === 0 ? "#FF0000" : "#00FF00"} // Premier coin en rouge
            stroke="white"
            strokeWidth={1}
          />
        );
      }

      // Afficher l'ID du marqueur au centre (même calcul que pour les coins)
      const centerRelX = marker.center.x - naturalWidth / 2;
      const centerRelY = marker.center.y - naturalHeight / 2;
      const centerX = divCenterX + centerRelX * totalScaleX;
      const centerY = divCenterY + centerRelY * totalScaleY;

      elements.push(
        <g key={`marker-label-${marker.id}`}>
          <rect
            x={centerX - 16}
            y={centerY - 10}
            width={32}
            height={20}
            rx={4}
            fill="rgba(0, 0, 0, 0.7)"
          />
          <text
            x={centerX}
            y={centerY + 5}
            textAnchor="middle"
            fill="#00FF00"
            fontSize={12}
            fontWeight="bold"
          >
            {marker.id}
          </text>
        </g>
      );
    }

    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ overflow: "visible" }}
      >
        {elements}
      </svg>
    );
  };

  return (
    <div
      ref={rootRef}
      className="flex flex-col h-full bg-gray-900 min-h-0"
      style={{ touchAction: "none", overflow: "hidden" }}
    >
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
          
          <Separator orientation="vertical" className="h-6 bg-gray-600 mx-2" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-300 hover:text-white hover:bg-red-500/20"
            title="Fermer"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Zone de preview - hauteur calculée pour remplir l'espace */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {/* Canvas principal - positionnement absolu pour contrôler la taille exacte */}
        <div
          ref={containerRef}
          className={`absolute inset-0 ${
            activeTool === "measure" ? "cursor-crosshair" : "cursor-grab"
          } ${isPanning ? "cursor-grabbing" : ""}`}
          style={{ 
            touchAction: "none",
            overflow: "hidden",
            // Laisser de la place pour le panneau latéral
            right: "288px", // w-72 = 18rem = 288px
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {renderImage()}
          {renderArucoMarkers()} {/* v1.0.1: Affichage des marqueurs ArUco */}
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

        {/* Panneau latéral - positionné en absolu à droite */}
        <div 
          className="absolute top-0 right-0 bottom-0 w-72 bg-gray-800 border-l border-gray-700 p-4 flex flex-col gap-4 overflow-y-auto"
          onWheel={(e) => e.stopPropagation()}
        >
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
                  onWheel={(e) => e.currentTarget.blur()}
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
                  onWheel={(e) => e.currentTarget.blur()}
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
