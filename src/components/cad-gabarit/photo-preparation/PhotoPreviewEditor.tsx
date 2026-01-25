// ============================================
// COMPOSANT: PhotoPreviewEditor
// Preview individuelle avec outils de transformation
// VERSION: 1.2.4c
// ============================================
//
// Changelog (3 dernières versions) :
// - v1.2.4c (2025-01-25) : FIX rendu skewX+skewY avec 2 passes séquentielles (pas grille)
// - v1.2.4b (2025-01-25) : FIX rendu grille skewX+skewY (formule position correcte)
// - v1.2.4 (2025-01-25) : Support complet skewY (rendu, conversion coords, calcul, affichage)
//
// Historique complet : voir REFACTORING_PHOTO_PREPARATION.md
// ============================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RotateCcw,
  RotateCw,
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
  Grid3X3,
  RotateCcwSquare,
  Columns,
} from "lucide-react";
import { toast } from "sonner";
import {
  PhotoToProcess,
  Measurement,
  MeasurePoint,
  ImageCropData,
  GridOverlayType,
  STRETCH_INCREMENT_NORMAL,
  STRETCH_INCREMENT_FINE,
  STRETCH_INCREMENT_FAST,
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
  onSetRotation: (rotation: number) => void; // v1.1.0: Rotation libre
  onSetCrop: (crop: ImageCropData | null) => void;
  onSetStretch: (stretchX: number, stretchY: number) => void;
  onSetSkew: (skewX: number, skewY: number) => void; // v1.2.0: Correction perspective
  onAdjustStretchX: (deltaMm: number) => void;
  onAdjustStretchY: (deltaMm: number) => void;
  onSetActiveTool: (tool: "none" | "measure" | "crop") => void;
  onAddMeasurePoint: (xPercent: number, yPercent: number) => void;
  onRemoveMeasurement: (id: string) => void;
  onUpdateMeasurementPoint: (measurementId: string, pointIndex: 1 | 2, xPercent: number, yPercent: number) => void;
  onSetMeasurementTarget: (measurementId: string, targetValueMm: number | undefined) => void; // v1.2.0
  onClearMeasurements: () => void;
  onUpdatePhoto: (updates: Partial<PhotoToProcess>) => void;

  // Navigation
  onPrev: () => void;
  onNext: () => void;
  onValidate: () => void;
  onSkip: () => void;
  onBackToGrid: () => void;
  onClose: () => void;

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
  onSetRotation,
  onSetCrop,
  onSetStretch,
  onSetSkew,
  onAdjustStretchX,
  onAdjustStretchY,
  onSetActiveTool,
  onAddMeasurePoint,
  onRemoveMeasurement,
  onUpdateMeasurementPoint,
  onSetMeasurementTarget,
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
  // v1.2.0: Debug
  console.log("[PhotoPreviewEditor v1.2.0] Props received:", {
    hasOnSetSkew: typeof onSetSkew === 'function',
    hasOnSetMeasurementTarget: typeof onSetMeasurementTarget === 'function',
    skewX: photo.skewX,
    skewY: photo.skewY,
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // v1.0.18: Viewport simplifié comme ImageCalibrationModal
  // scale = facteur de zoom, offsetX/Y = position du coin supérieur gauche de l'image
  const [viewport, setViewport] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panStartOffset, setPanStartOffset] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // v1.0.19: État pour le drag des poignées de mesure
  const [draggingHandle, setDraggingHandle] = useState<{
    measurementId: string;
    pointIndex: 1 | 2;
  } | null>(null);

  // Inputs pour dimensions
  const { widthMm, heightMm } = getDimensionsMm(photo);
  const [targetWidthMm, setTargetWidthMm] = useState(widthMm.toFixed(1));
  const [targetHeightMm, setTargetHeightMm] = useState(heightMm.toFixed(1));

  // ArUco
  const { isLoaded: isArucoLoaded, detectMarkers } = useOpenCVAruco({ markerSizeCm: 5 });
  const [arucoProcessed, setArucoProcessed] = useState(false);
  const [detectedMarkers, setDetectedMarkers] = useState<Array<{
    id: number;
    corners: { x: number; y: number }[];
    center: { x: number; y: number };
  }>>([]);
  const [initialFitDone, setInitialFitDone] = useState(false);

  // Taille des marqueurs ArUco en mm
  const ARUCO_MARKER_SIZE_MM = 50;

  // v1.1.0: Grille de cadrage
  const [gridOverlay, setGridOverlay] = useState<GridOverlayType>("none");
  
  // v1.1.0: Input pour rotation (synchronisé avec photo.rotation)
  const [rotationInput, setRotationInput] = useState(photo.rotation.toFixed(1));

  // Mettre à jour les inputs quand les dimensions changent
  useEffect(() => {
    setTargetWidthMm(widthMm.toFixed(1));
    setTargetHeightMm(heightMm.toFixed(1));
  }, [widthMm, heightMm]);

  // v1.1.0: Synchroniser rotationInput avec photo.rotation
  useEffect(() => {
    setRotationInput(photo.rotation.toFixed(1));
  }, [photo.rotation]);

  // v1.1.1: Compenser le changement de bounding box lors de la rotation
  // pour garder le centre de l'image au même endroit
  const prevRotationRef = useRef(photo.rotation);
  useEffect(() => {
    if (!photo.image) return;
    if (prevRotationRef.current === photo.rotation) return;
    
    const imgWidth = photo.image.naturalWidth || photo.image.width;
    const imgHeight = photo.image.naturalHeight || photo.image.height;
    const stretchedWidth = imgWidth * photo.stretchX;
    const stretchedHeight = imgHeight * photo.stretchY;
    
    // Calculer l'ancien et le nouveau bounding box
    const oldRadians = (prevRotationRef.current * Math.PI) / 180;
    const newRadians = (photo.rotation * Math.PI) / 180;
    
    const oldCos = Math.abs(Math.cos(oldRadians));
    const oldSin = Math.abs(Math.sin(oldRadians));
    const newCos = Math.abs(Math.cos(newRadians));
    const newSin = Math.abs(Math.sin(newRadians));
    
    const oldBoundingWidth = stretchedWidth * oldCos + stretchedHeight * oldSin;
    const oldBoundingHeight = stretchedWidth * oldSin + stretchedHeight * oldCos;
    const newBoundingWidth = stretchedWidth * newCos + stretchedHeight * newSin;
    const newBoundingHeight = stretchedWidth * newSin + stretchedHeight * newCos;
    
    // Ajuster le viewport pour garder le centre au même endroit
    setViewport(v => {
      // Centre actuel de l'image dans le canvas
      const centerX = v.offsetX + (oldBoundingWidth * v.scale) / 2;
      const centerY = v.offsetY + (oldBoundingHeight * v.scale) / 2;
      
      // Nouveaux offsets pour garder le même centre
      return {
        ...v,
        offsetX: centerX - (newBoundingWidth * v.scale) / 2,
        offsetY: centerY - (newBoundingHeight * v.scale) / 2,
      };
    });
    
    prevRotationRef.current = photo.rotation;
  }, [photo.rotation, photo.image, photo.stretchX, photo.stretchY]);

  // Observer la taille du container pour le canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = Math.floor(entry.contentRect.width);
        const height = Math.floor(entry.contentRect.height);
        if (width > 0 && height > 0) {
          setCanvasSize({ width, height });
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // v1.0.20: Ref stable pour fitToView afin d'éviter les re-triggers
  const fitToViewRef = useRef<() => void>(() => { });

  // v1.1.0: Fit to view - calculer scale et offset pour centrer l'image (avec rotation)
  fitToViewRef.current = () => {
    if (!photo.image) return;

    const padding = 40;
    const imgWidth = photo.image.naturalWidth || photo.image.width;
    const imgHeight = photo.image.naturalHeight || photo.image.height;

    if (imgWidth === 0 || imgHeight === 0) return;
    if (canvasSize.width < 200 || canvasSize.height < 200) return;

    // Prendre en compte le stretch
    const stretchedWidth = imgWidth * photo.stretchX;
    const stretchedHeight = imgHeight * photo.stretchY;

    // v1.1.0: Calculer le bounding box après rotation
    const radians = (photo.rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const effectiveWidth = stretchedWidth * cos + stretchedHeight * sin;
    const effectiveHeight = stretchedWidth * sin + stretchedHeight * cos;

    const scaleX = (canvasSize.width - padding * 2) / effectiveWidth;
    const scaleY = (canvasSize.height - padding * 2) / effectiveHeight;
    const scale = Math.min(scaleX, scaleY, 2); // Max zoom 200%

    // Centrer l'image
    const offsetX = (canvasSize.width - effectiveWidth * scale) / 2;
    const offsetY = (canvasSize.height - effectiveHeight * scale) / 2;

    console.log("[fitToView v1.1.0] Setting viewport:", { scale, offsetX, offsetY, effectiveWidth, effectiveHeight, rotation: photo.rotation });
    setViewport({ scale, offsetX, offsetY });
    setInitialFitDone(true);
  };

  // Wrapper stable pour les appels externes (bouton zoom fit, etc.)
  const fitToView = useCallback(() => {
    fitToViewRef.current();
  }, []);

  // v1.0.20: Fit initial au chargement - SANS fitToView dans les dépendances
  // On utilise le ref pour éviter que les changements de stretch/scale re-déclenchent l'init
  const fitDoneForPhotoRef = useRef<string | null>(null);
  useEffect(() => {
    // Guard: ne pas re-fit si déjà fait pour cette photo
    if (fitDoneForPhotoRef.current === photo.id) {
      console.log("[INIT] Already fit for photo:", photo.id);
      return;
    }
    if (!photo.image) return;
    if (canvasSize.width < 200 || canvasSize.height < 200) return;

    console.log("[INIT] Initial fit for new photo:", photo.id);
    const timer = setTimeout(() => {
      // Double-check le guard au moment de l'exécution
      if (fitDoneForPhotoRef.current === photo.id) return;
      fitToViewRef.current();
      fitDoneForPhotoRef.current = photo.id;
    }, 100);

    return () => clearTimeout(timer);
  }, [photo.id, photo.image, canvasSize.width, canvasSize.height]); // PAS de fitToView ici!

  // Reset quand on change de photo
  useEffect(() => {
    setInitialFitDone(false);
    setArucoProcessed(false);
    setDetectedMarkers([]);
  }, [photo.id]);


  // Détection ArUco
  const runArucoDetection = useCallback(async () => {
    if (!photo.image) return;
    setArucoProcessed(true);

    const markers = await detectMarkers(photo.image);
    if (markers.length > 0) {
      setDetectedMarkers(markers.map(m => ({
        id: m.id,
        corners: m.corners,
        center: m.center,
      })));

      let totalScaleX = 0;
      let totalScaleY = 0;
      for (const marker of markers) {
        totalScaleX += marker.size.width / ARUCO_MARKER_SIZE_MM;
        totalScaleY += marker.size.height / ARUCO_MARKER_SIZE_MM;
      }

      onUpdatePhoto({
        arucoDetected: true,
        arucoScaleX: totalScaleX / markers.length,
        arucoScaleY: totalScaleY / markers.length,
      });

      toast.success(`${markers.length} marqueur(s) ArUco détecté(s)`, { duration: 2000 });
    } else {
      setDetectedMarkers([]);
    }
  }, [photo.image, detectMarkers, onUpdatePhoto]);

  useEffect(() => {
    if (photo.image && isArucoLoaded && !arucoProcessed && !photo.arucoDetected && !photo.arucoScaleX) {
      runArucoDetection();
    }
  }, [photo.id, photo.image, isArucoLoaded, arucoProcessed, runArucoDetection]);

  // v1.2.4: Convertir coordonnées image -> écran (avec rotation, skewX et skewY)
  const imageToScreen = useCallback((imgX: number, imgY: number) => {
    const { scale, offsetX, offsetY } = viewport;
    
    // Dimensions de l'image
    const imgWidth = photo.image?.naturalWidth || photo.image?.width || 1;
    const imgHeight = photo.image?.naturalHeight || photo.image?.height || 1;
    
    // Dimensions avec stretch
    const stretchedWidth = imgWidth * photo.stretchX;
    const stretchedHeight = imgHeight * photo.stretchY;
    
    // Bounding box après rotation
    const radians = (photo.rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const boundingWidth = stretchedWidth * cos + stretchedHeight * sin;
    const boundingHeight = stretchedWidth * sin + stretchedHeight * cos;
    
    // Centre du bounding box
    const centerX = offsetX + (boundingWidth * scale) / 2;
    const centerY = offsetY + (boundingHeight * scale) / 2;
    
    // Prendre en compte le skewX et skewY (étirement local selon position)
    const skewX = photo.skewX || 0;
    const skewY = photo.skewY || 0;
    const xRel = imgX / imgWidth;
    const yRel = imgY / imgHeight;
    const localStretchX = photo.stretchX * (1 + skewX * (yRel - 0.5));
    const localStretchY = photo.stretchY * (1 + skewY * (xRel - 0.5));
    
    // Position relative au centre avec rotation
    const relX = (imgX - imgWidth / 2) * localStretchX * scale;
    const relY = (imgY - imgHeight / 2) * localStretchY * scale;
    
    // Appliquer la rotation
    const cosR = Math.cos(radians);
    const sinR = Math.sin(radians);
    const rotX = relX * cosR - relY * sinR;
    const rotY = relX * sinR + relY * cosR;
    
    return {
      x: centerX + rotX,
      y: centerY + rotY,
    };
  }, [viewport, photo.stretchX, photo.stretchY, photo.rotation, photo.skewX, photo.skewY, photo.image]);

  // v1.2.4: Convertir coordonnées écran -> image (avec rotation, skewX et skewY)
  const screenToImage = useCallback((screenX: number, screenY: number) => {
    const { scale, offsetX, offsetY } = viewport;
    
    // Dimensions de l'image
    const imgWidth = photo.image?.naturalWidth || photo.image?.width || 1;
    const imgHeight = photo.image?.naturalHeight || photo.image?.height || 1;
    
    // Dimensions avec stretch
    const stretchedWidth = imgWidth * photo.stretchX;
    const stretchedHeight = imgHeight * photo.stretchY;
    
    // Bounding box après rotation
    const radians = (photo.rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const boundingWidth = stretchedWidth * cos + stretchedHeight * sin;
    const boundingHeight = stretchedWidth * sin + stretchedHeight * cos;
    
    // Centre du bounding box
    const centerX = offsetX + (boundingWidth * scale) / 2;
    const centerY = offsetY + (boundingHeight * scale) / 2;
    
    // Position relative au centre (en pixels écran)
    const relScreenX = screenX - centerX;
    const relScreenY = screenY - centerY;
    
    // Rotation inverse
    const cosR = Math.cos(-radians);
    const sinR = Math.sin(-radians);
    const unrotatedX = relScreenX * cosR - relScreenY * sinR;
    const unrotatedY = relScreenX * sinR + relScreenY * cosR;
    
    const skewX = photo.skewX || 0;
    const skewY = photo.skewY || 0;
    
    // v1.2.4: Résolution itérative pour skewX et skewY
    // Approximation initiale sans skew
    let imgX = (unrotatedX / (scale * photo.stretchX)) + imgWidth / 2;
    let imgY = (unrotatedY / (scale * photo.stretchY)) + imgHeight / 2;
    
    // Quelques itérations pour converger (skew crée une dépendance circulaire)
    for (let iter = 0; iter < 3; iter++) {
      const xRel = imgX / imgWidth;
      const yRel = imgY / imgHeight;
      
      const localStretchX = photo.stretchX * (1 + skewX * (yRel - 0.5));
      const localStretchY = photo.stretchY * (1 + skewY * (xRel - 0.5));
      
      imgX = (unrotatedX / (scale * localStretchX)) + imgWidth / 2;
      imgY = (unrotatedY / (scale * localStretchY)) + imgHeight / 2;
    }
    
    return { x: imgX, y: imgY };
  }, [viewport, photo.stretchX, photo.stretchY, photo.rotation, photo.skewX, photo.skewY, photo.image]);

  // v1.1.0: Dessiner le canvas - IMAGE + ROTATION + GRILLE + MARQUEURS + MESURES
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photo.image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { scale, offsetX, offsetY } = viewport;
    const imgWidth = photo.image.naturalWidth || photo.image.width;
    const imgHeight = photo.image.naturalHeight || photo.image.height;
    
    // Dimensions avec stretch
    const stretchedWidth = imgWidth * photo.stretchX;
    const stretchedHeight = imgHeight * photo.stretchY;

    // v1.1.0: Calculer le bounding box après rotation
    const radians = (photo.rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const boundingWidth = stretchedWidth * cos + stretchedHeight * sin;
    const boundingHeight = stretchedWidth * sin + stretchedHeight * cos;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // v1.2.1: Draw image avec stretch, rotation ET correction perspective (skewX)
    ctx.save();
    
    // Translater au centre du bounding box dans le canvas
    const centerX = offsetX + (boundingWidth * scale) / 2;
    const centerY = offsetY + (boundingHeight * scale) / 2;
    ctx.translate(centerX, centerY);
    
    // Appliquer la rotation
    ctx.rotate(radians);
    
    // v1.2.4c: Dessiner avec correction de perspective
    const skewX = photo.skewX || 0;
    const skewY = photo.skewY || 0;
    const hasSkewX = Math.abs(skewX) > 0.001;
    const hasSkewY = Math.abs(skewY) > 0.001;
    
    if (hasSkewX && hasSkewY) {
      // v1.2.4c: Les deux skew → 2 passes séquentielles
      // Passe 1: Appliquer skewX sur l'image source → canvas temporaire
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;
      
      // Le canvas temporaire a la taille de l'image après skewX (stretch appliqué)
      tempCanvas.width = Math.ceil(stretchedWidth * scale);
      tempCanvas.height = Math.ceil(stretchedHeight * scale);
      
      // Dessiner avec skewX (bandes horizontales)
      const numBandsX = 80;
      const bandHeight = imgHeight / numBandsX;
      
      for (let i = 0; i < numBandsX; i++) {
        const yRel = (i + 0.5) / numBandsX;
        const localStretchX = photo.stretchX * (1 + skewX * (yRel - 0.5));
        
        const srcY = i * bandHeight;
        const srcHeight = bandHeight + 1;
        
        const destWidth = imgWidth * localStretchX * scale;
        const destHeight = (bandHeight * photo.stretchY * scale) + 0.5;
        
        // Centrer horizontalement dans le canvas temp
        const destX = (tempCanvas.width - destWidth) / 2;
        const destY = i * bandHeight * photo.stretchY * scale;
        
        tempCtx.drawImage(
          photo.image,
          0, srcY, imgWidth, srcHeight,
          destX, destY, destWidth, destHeight
        );
      }
      
      // Passe 2: Appliquer skewY sur le canvas temporaire → canvas final
      const tempWidth = tempCanvas.width;
      const tempHeight = tempCanvas.height;
      const numBandsY = 80;
      const bandWidth = tempWidth / numBandsY;
      
      for (let i = 0; i < numBandsY; i++) {
        const xRel = (i + 0.5) / numBandsY;
        // skewY appliqué comme ratio sur la hauteur
        const localStretchYRatio = 1 + skewY * (xRel - 0.5);
        
        const srcX = i * bandWidth;
        const srcWidth = bandWidth + 1;
        
        const destBandWidth = bandWidth + 0.5;
        const destBandHeight = tempHeight * localStretchYRatio;
        
        // Position X: distribuer uniformément sur la largeur
        const destX = -tempWidth / 2 + i * bandWidth;
        // Position Y: centrer verticalement
        const destY = -destBandHeight / 2;
        
        ctx.drawImage(
          tempCanvas,
          srcX, 0, srcWidth, tempHeight,
          destX, destY, destBandWidth, destBandHeight
        );
      }
    } else if (hasSkewX) {
      // Correction de perspective horizontale: dessiner par bandes horizontales
      const numBands = 80;
      const bandHeight = imgHeight / numBands;
      
      for (let i = 0; i < numBands; i++) {
        const yRel = (i + 0.5) / numBands;
        const localStretchX = photo.stretchX * (1 + skewX * (yRel - 0.5));
        
        const srcY = i * bandHeight;
        const srcHeight = bandHeight + 1;
        
        const destWidth = imgWidth * localStretchX * scale;
        const destHeight = (bandHeight * photo.stretchY * scale) + 0.5;
        
        const destX = -destWidth / 2;
        const destY = -stretchedHeight * scale / 2 + (i * bandHeight * photo.stretchY * scale);
        
        ctx.drawImage(
          photo.image,
          0, srcY, imgWidth, srcHeight,
          destX, destY, destWidth, destHeight
        );
      }
    } else if (hasSkewY) {
      // v1.2.4: Correction de perspective verticale: dessiner par bandes verticales
      const numBands = 80;
      const bandWidth = imgWidth / numBands;
      
      for (let i = 0; i < numBands; i++) {
        const xRel = (i + 0.5) / numBands;
        const localStretchY = photo.stretchY * (1 + skewY * (xRel - 0.5));
        
        const srcX = i * bandWidth;
        const srcWidth = bandWidth + 1;
        
        const destWidth = (bandWidth * photo.stretchX * scale) + 0.5;
        const destHeight = imgHeight * localStretchY * scale;
        
        const destX = -stretchedWidth * scale / 2 + (i * bandWidth * photo.stretchX * scale);
        const destY = -destHeight / 2;
        
        ctx.drawImage(
          photo.image,
          srcX, 0, srcWidth, imgHeight,
          destX, destY, destWidth, destHeight
        );
      }
    } else {
      // Pas de correction de perspective: dessin normal
      ctx.drawImage(
        photo.image,
        -(stretchedWidth * scale) / 2,
        -(stretchedHeight * scale) / 2,
        stretchedWidth * scale,
        stretchedHeight * scale
      );
    }
    
    ctx.restore();

    // v1.1.3: Dessiner la grille de cadrage FIXE
    // - Reste horizontale/verticale (pas de rotation)
    // - Taille fixe basée sur l'image (pas le bounding box qui grandit)
    // - Centrée sur le centre de l'image
    if (gridOverlay !== "none") {
      // Dimensions fixes basées sur l'image stretchée (pas le bounding box)
      const gridWidth = stretchedWidth * scale;
      const gridHeight = stretchedHeight * scale;
      const gridLeft = centerX - gridWidth / 2;
      const gridTop = centerY - gridHeight / 2;
      
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1;
      
      if (gridOverlay === "thirds") {
        // Règle des tiers
        const thirdW = gridWidth / 3;
        const thirdH = gridHeight / 3;
        ctx.beginPath();
        // Lignes verticales
        ctx.moveTo(gridLeft + thirdW, gridTop);
        ctx.lineTo(gridLeft + thirdW, gridTop + gridHeight);
        ctx.moveTo(gridLeft + thirdW * 2, gridTop);
        ctx.lineTo(gridLeft + thirdW * 2, gridTop + gridHeight);
        // Lignes horizontales
        ctx.moveTo(gridLeft, gridTop + thirdH);
        ctx.lineTo(gridLeft + gridWidth, gridTop + thirdH);
        ctx.moveTo(gridLeft, gridTop + thirdH * 2);
        ctx.lineTo(gridLeft + gridWidth, gridTop + thirdH * 2);
        ctx.stroke();
        
        // Points d'intersection
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        for (let i = 1; i <= 2; i++) {
          for (let j = 1; j <= 2; j++) {
            ctx.beginPath();
            ctx.arc(gridLeft + thirdW * i, gridTop + thirdH * j, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (gridOverlay === "grid") {
        // Grille 6x6
        ctx.beginPath();
        const cellW = gridWidth / 6;
        const cellH = gridHeight / 6;
        for (let i = 1; i < 6; i++) {
          ctx.moveTo(gridLeft + cellW * i, gridTop);
          ctx.lineTo(gridLeft + cellW * i, gridTop + gridHeight);
          ctx.moveTo(gridLeft, gridTop + cellH * i);
          ctx.lineTo(gridLeft + gridWidth, gridTop + cellH * i);
        }
        ctx.stroke();
      } else if (gridOverlay === "cross") {
        // Croix centrale
        ctx.beginPath();
        ctx.moveTo(centerX, gridTop);
        ctx.lineTo(centerX, gridTop + gridHeight);
        ctx.moveTo(gridLeft, centerY);
        ctx.lineTo(gridLeft + gridWidth, centerY);
        ctx.stroke();
        // Cercle central
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.min(gridWidth, gridHeight) / 10, 0, Math.PI * 2);
        ctx.stroke();
      } else if (gridOverlay === "diagonal") {
        // Diagonales
        ctx.beginPath();
        ctx.moveTo(gridLeft, gridTop);
        ctx.lineTo(gridLeft + gridWidth, gridTop + gridHeight);
        ctx.moveTo(gridLeft + gridWidth, gridTop);
        ctx.lineTo(gridLeft, gridTop + gridHeight);
        ctx.stroke();
        // Centre
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fill();
      }
    }

    // Draw ArUco markers (coordonnées de l'image source, avec rotation et skewX)
    if (detectedMarkers.length > 0 && initialFitDone) {
      const skewX = photo.skewX || 0;
      const skewY = photo.skewY || 0;
      
      for (const marker of detectedMarkers) {
        // v1.2.4: Convertir les coins en coordonnées écran (avec rotation, skewX et skewY)
        const screenCorners = marker.corners.map(c => {
          const xRel = c.x / imgWidth;
          const yRel = c.y / imgHeight;
          const localStretchX = photo.stretchX * (1 + skewX * (yRel - 0.5));
          const localStretchY = photo.stretchY * (1 + skewY * (xRel - 0.5));
          
          // Position relative au centre de l'image source
          const relX = (c.x - imgWidth / 2) * localStretchX * scale;
          const relY = (c.y - imgHeight / 2) * localStretchY * scale;
          // Appliquer la rotation
          const rotX = relX * Math.cos(radians) - relY * Math.sin(radians);
          const rotY = relX * Math.sin(radians) + relY * Math.cos(radians);
          // Position finale dans le canvas
          return {
            x: centerX + rotX,
            y: centerY + rotY,
          };
        });

        // Dessiner le polygone
        ctx.beginPath();
        ctx.moveTo(screenCorners[0].x, screenCorners[0].y);
        for (let i = 1; i < screenCorners.length; i++) {
          ctx.lineTo(screenCorners[i].x, screenCorners[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(0, 255, 0, 0.15)";
        ctx.fill();
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Dessiner les coins
        for (let i = 0; i < screenCorners.length; i++) {
          const corner = screenCorners[i];
          ctx.beginPath();
          ctx.arc(corner.x, corner.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = i === 0 ? "#FF0000" : "#00FF00";
          ctx.fill();
          ctx.strokeStyle = "white";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Label ID
        const markerCenterX = screenCorners.reduce((sum, c) => sum + c.x, 0) / 4;
        const markerCenterY = screenCorners.reduce((sum, c) => sum + c.y, 0) / 4;
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(markerCenterX - 16, markerCenterY - 10, 32, 20);
        ctx.fillStyle = "#00FF00";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(marker.id), markerCenterX, markerCenterY);
      }
    }

    // Draw measurements
    for (const measurement of measurements) {
      if (!measurement.visible) continue;

      // v1.1.0: Conversion avec rotation
      const p1Img = {
        x: (measurement.point1.xPercent / 100) * imgWidth,
        y: (measurement.point1.yPercent / 100) * imgHeight,
      };
      const p2Img = {
        x: (measurement.point2.xPercent / 100) * imgWidth,
        y: (measurement.point2.yPercent / 100) * imgHeight,
      };

      // v1.2.4: Conversion en coordonnées écran avec rotation, skewX ET skewY
      const imageToScreenWithRotation = (ix: number, iy: number) => {
        const skewX = photo.skewX || 0;
        const skewY = photo.skewY || 0;
        const xRel = ix / imgWidth;
        const yRel = iy / imgHeight;
        const localStretchX = photo.stretchX * (1 + skewX * (yRel - 0.5));
        const localStretchY = photo.stretchY * (1 + skewY * (xRel - 0.5));
        
        const relX = (ix - imgWidth / 2) * localStretchX * scale;
        const relY = (iy - imgHeight / 2) * localStretchY * scale;
        const rotX = relX * Math.cos(radians) - relY * Math.sin(radians);
        const rotY = relX * Math.sin(radians) + relY * Math.cos(radians);
        return { x: centerX + rotX, y: centerY + rotY };
      };

      const p1Screen = imageToScreenWithRotation(p1Img.x, p1Img.y);
      const p2Screen = imageToScreenWithRotation(p2Img.x, p2Img.y);

      // Ligne
      ctx.beginPath();
      ctx.moveTo(p1Screen.x, p1Screen.y);
      ctx.lineTo(p2Screen.x, p2Screen.y);
      ctx.strokeStyle = measurement.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Points - Croix de ciblage précises
      const crossSize = 12; // Taille de la croix
      const crossGap = 3;   // Espace au centre
      for (const p of [p1Screen, p2Screen]) {
        ctx.strokeStyle = measurement.color;
        ctx.lineWidth = 2;

        // Ligne horizontale (avec gap au centre)
        ctx.beginPath();
        ctx.moveTo(p.x - crossSize, p.y);
        ctx.lineTo(p.x - crossGap, p.y);
        ctx.moveTo(p.x + crossGap, p.y);
        ctx.lineTo(p.x + crossSize, p.y);
        ctx.stroke();

        // Ligne verticale (avec gap au centre)
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - crossSize);
        ctx.lineTo(p.x, p.y - crossGap);
        ctx.moveTo(p.x, p.y + crossGap);
        ctx.lineTo(p.x, p.y + crossSize);
        ctx.stroke();

        // Petit cercle central pour marquer le point exact
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = measurement.color;
        ctx.fill();
      }

      // Label distance
      const midX = (p1Screen.x + p2Screen.x) / 2;
      const midY = (p1Screen.y + p2Screen.y) / 2;
      const distance = calculateDistanceMm(measurement.point1, measurement.point2);
      const label = `${distance.toFixed(1)} mm`;

      ctx.fillStyle = measurement.color;
      ctx.fillRect(midX - 40, midY - 12, 80, 24);
      ctx.fillStyle = "white";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, midX, midY);
    }

    // v1.2.4: Point en attente - Croix de ciblage (avec rotation, skewX et skewY)
    if (pendingMeasurePoint && photo.image) {
      const imgPos = {
        x: (pendingMeasurePoint.xPercent / 100) * imgWidth,
        y: (pendingMeasurePoint.yPercent / 100) * imgHeight,
      };
      
      const skewX = photo.skewX || 0;
      const skewY = photo.skewY || 0;
      const xRel = imgPos.x / imgWidth;
      const yRel = imgPos.y / imgHeight;
      const localStretchX = photo.stretchX * (1 + skewX * (yRel - 0.5));
      const localStretchY = photo.stretchY * (1 + skewY * (xRel - 0.5));
      
      const relX = (imgPos.x - imgWidth / 2) * localStretchX * scale;
      const relY = (imgPos.y - imgHeight / 2) * localStretchY * scale;
      const rotX = relX * Math.cos(radians) - relY * Math.sin(radians);
      const rotY = relX * Math.sin(radians) + relY * Math.cos(radians);
      const p = { x: centerX + rotX, y: centerY + rotY };

      const crossSize = 14;
      const crossGap = 4;
      ctx.strokeStyle = "#E74C3C";
      ctx.lineWidth = 2;

      // Ligne horizontale
      ctx.beginPath();
      ctx.moveTo(p.x - crossSize, p.y);
      ctx.lineTo(p.x - crossGap, p.y);
      ctx.moveTo(p.x + crossGap, p.y);
      ctx.lineTo(p.x + crossSize, p.y);
      ctx.stroke();

      // Ligne verticale
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - crossSize);
      ctx.lineTo(p.x, p.y - crossGap);
      ctx.moveTo(p.x, p.y + crossGap);
      ctx.lineTo(p.x, p.y + crossSize);
      ctx.stroke();

      // Petit cercle central
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#E74C3C";
      ctx.fill();
    }

  }, [photo.image, photo.stretchX, photo.stretchY, photo.rotation, photo.skewX, photo.skewY, viewport, detectedMarkers, initialFitDone, measurements, pendingMeasurePoint, calculateDistanceMm, gridOverlay]);

  // Gestion du zoom avec la molette - useEffect avec addEventListener pour pouvoir preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log("[WHEEL] No canvas ref");
      return;
    }

    console.log("[WHEEL] Attaching wheel listener to canvas");

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      console.log("[WHEEL] Wheel event detected, deltaY:", e.deltaY);

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setViewport(v => {
        const newScale = Math.max(0.05, Math.min(5, v.scale * delta));
        const scaleChange = newScale / v.scale;
        const newOffsetX = mouseX - (mouseX - v.offsetX) * scaleChange;
        const newOffsetY = mouseY - (mouseY - v.offsetY) * scaleChange;
        console.log("[WHEEL] New scale:", newScale);
        return { scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
      });
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      console.log("[WHEEL] Removing wheel listener");
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [photo.image, canvasSize]); // Re-bindé quand l'image ou la taille du canvas change

  // v1.0.19: Trouver si un clic est proche d'une poignée de mesure
  const findHandleAtPosition = useCallback((clickX: number, clickY: number): { measurementId: string; pointIndex: 1 | 2 } | null => {
    if (!photo.image) return null;

    const imgWidth = photo.image.naturalWidth || photo.image.width;
    const imgHeight = photo.image.naturalHeight || photo.image.height;
    const hitRadius = 15; // Rayon de détection en pixels écran

    for (const measurement of measurements) {
      // Point 1
      const p1Img = {
        x: (measurement.point1.xPercent / 100) * imgWidth,
        y: (measurement.point1.yPercent / 100) * imgHeight,
      };
      const p1Screen = imageToScreen(p1Img.x, p1Img.y);
      const dist1 = Math.sqrt((clickX - p1Screen.x) ** 2 + (clickY - p1Screen.y) ** 2);
      if (dist1 < hitRadius) {
        return { measurementId: measurement.id, pointIndex: 1 };
      }

      // Point 2
      const p2Img = {
        x: (measurement.point2.xPercent / 100) * imgWidth,
        y: (measurement.point2.yPercent / 100) * imgHeight,
      };
      const p2Screen = imageToScreen(p2Img.x, p2Img.y);
      const dist2 = Math.sqrt((clickX - p2Screen.x) ** 2 + (clickY - p2Screen.y) ** 2);
      if (dist2 < hitRadius) {
        return { measurementId: measurement.id, pointIndex: 2 };
      }
    }

    return null;
  }, [photo.image, measurements, imageToScreen]);

  // v1.0.20: Gestion du pan, clic mesure et drag poignées
  // - Clic molette (button 1) : TOUJOURS pan, quel que soit l'outil
  // - Clic gauche sur poignée : TOUJOURS drag de la poignée
  // - Clic gauche ailleurs : dépend de l'outil (mesure ou pan)
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Clic molette (bouton du milieu) = TOUJOURS pan
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setPanStartOffset({ x: viewport.offsetX, y: viewport.offsetY });
      return;
    }

    // Clic gauche
    if (e.button === 0) {
      // 1. Vérifier d'abord si on clique sur une poignée existante (prioritaire)
      const handle = findHandleAtPosition(clickX, clickY);
      console.log("[MOUSEDOWN] Handle found:", handle);
      if (handle) {
        console.log("[MOUSEDOWN] Setting draggingHandle:", handle);
        setDraggingHandle(handle);
        return;
      }

      // 2. Mode mesure : ajouter un nouveau point
      if (activeTool === "measure" && photo.image) {
        const imgPos = screenToImage(clickX, clickY);
        const imgWidth = photo.image.naturalWidth || photo.image.width;
        const imgHeight = photo.image.naturalHeight || photo.image.height;

        if (imgPos.x >= 0 && imgPos.x <= imgWidth && imgPos.y >= 0 && imgPos.y <= imgHeight) {
          const xPercent = (imgPos.x / imgWidth) * 100;
          const yPercent = (imgPos.y / imgHeight) * 100;
          onAddMeasurePoint(xPercent, yPercent);
        }
        return;
      }

      // 3. Pan uniquement avec clic molette (pas de pan sur clic gauche)
    }
  }, [activeTool, photo.image, viewport, screenToImage, onAddMeasurePoint, findHandleAtPosition]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // v1.0.19: Drag d'une poignée de mesure
    if (draggingHandle && photo.image) {
      const imgPos = screenToImage(mouseX, mouseY);
      const imgWidth = photo.image.naturalWidth || photo.image.width;
      const imgHeight = photo.image.naturalHeight || photo.image.height;

      // Contraindre aux limites de l'image
      const clampedX = Math.max(0, Math.min(imgWidth, imgPos.x));
      const clampedY = Math.max(0, Math.min(imgHeight, imgPos.y));

      const xPercent = (clampedX / imgWidth) * 100;
      const yPercent = (clampedY / imgHeight) * 100;

      console.log("[DRAG] Updating point:", draggingHandle.measurementId, draggingHandle.pointIndex, xPercent, yPercent);
      if (typeof onUpdateMeasurementPoint === 'function') {
        onUpdateMeasurementPoint(draggingHandle.measurementId, draggingHandle.pointIndex, xPercent, yPercent);
      } else {
        console.error("[DRAG] onUpdateMeasurementPoint is not a function!", onUpdateMeasurementPoint);
      }
      return;
    }

    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setViewport(v => ({
        ...v,
        offsetX: panStartOffset.x + dx,
        offsetY: panStartOffset.y + dy,
      }));
    }
  }, [isPanning, panStart, panStartOffset, draggingHandle, photo.image, screenToImage, onUpdateMeasurementPoint]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingHandle(null);
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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

  // Zoom percentage pour l'affichage
  const zoomPercent = Math.round(viewport.scale * 100);

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

      {/* Zone de preview */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {/* Container du canvas */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ right: "288px" }}
        >
          {!photo.image ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className={`${activeTool === "measure" ? "cursor-crosshair" : "cursor-grab"} ${isPanning ? "cursor-grabbing" : ""} ${draggingHandle ? "cursor-move" : ""}`}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onContextMenu={(e) => e.preventDefault()}
              onAuxClick={(e) => e.preventDefault()}
            />
          )}

          {/* Indicateur de mode */}
          {activeTool === "measure" && (
            <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              Cliquez pour mesurer
              {pendingMeasurePoint && " (2eme point)"}
            </div>
          )}

          {/* Controles de zoom */}
          <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-black/50 rounded-lg p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => setViewport(v => ({ ...v, scale: Math.max(0.05, v.scale * 0.8) }))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-white text-xs w-12 text-center">
              {zoomPercent}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => setViewport(v => ({ ...v, scale: Math.min(5, v.scale * 1.2) }))}
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

        {/* Panneau lateral */}
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
                Deplacer
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

          {/* v1.1.0: Rotation précise */}
          <div>
            <Label className="text-gray-400 text-xs mb-2 block">ROTATION</Label>
            
            {/* Slider */}
            <div className="mb-3">
              <Slider
                value={[photo.rotation]}
                onValueChange={([value]) => onSetRotation(value)}
                min={-180}
                max={180}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Input + Boutons ±90° */}
            <div className="flex gap-2 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRotate("ccw")}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                title="-90°"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              
              <div className="flex-1 relative">
                <Input
                  type="text"
                  value={rotationInput}
                  onChange={(e) => setRotationInput(e.target.value)}
                  onBlur={() => {
                    const value = parseFloat(rotationInput);
                    if (!isNaN(value)) {
                      onSetRotation(Math.max(-180, Math.min(180, value)));
                    } else {
                      setRotationInput(photo.rotation.toFixed(1));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const value = parseFloat(rotationInput);
                      if (!isNaN(value)) {
                        onSetRotation(Math.max(-180, Math.min(180, value)));
                      }
                    }
                  }}
                  className="h-8 bg-gray-700 border-gray-600 text-white text-sm text-center pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">°</span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRotate("cw")}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                title="+90°"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Boutons d'incrément fin */}
            <div className="flex gap-1 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSetRotation(photo.rotation - 1)}
                className="flex-1 h-7 text-xs text-gray-400 hover:text-white hover:bg-gray-700"
              >
                -1°
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSetRotation(photo.rotation - 0.1)}
                className="flex-1 h-7 text-xs text-gray-400 hover:text-white hover:bg-gray-700"
              >
                -0.1°
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSetRotation(0)}
                className="flex-1 h-7 text-xs text-gray-400 hover:text-white hover:bg-gray-700 font-bold"
                title="Remettre à 0°"
              >
                0°
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSetRotation(photo.rotation + 0.1)}
                className="flex-1 h-7 text-xs text-gray-400 hover:text-white hover:bg-gray-700"
              >
                +0.1°
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSetRotation(photo.rotation + 1)}
                className="flex-1 h-7 text-xs text-gray-400 hover:text-white hover:bg-gray-700"
              >
                +1°
              </Button>
            </div>

            {/* Bouton Réinitialiser */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetRotation(0)}
              className="w-full h-7 text-xs border-gray-600 text-gray-300 hover:bg-gray-700"
              disabled={photo.rotation === 0}
            >
              <RotateCcwSquare className="h-3 w-3 mr-1" />
              Réinitialiser (0°)
            </Button>

            <p className="text-gray-500 text-[10px]">
              Valeur actuelle: {photo.rotation.toFixed(1)}°
            </p>
          </div>

          <Separator className="bg-gray-700" />

          {/* v1.1.0: Grille de cadrage */}
          <div>
            <Label className="text-gray-400 text-xs mb-2 block">GRILLE DE CADRAGE</Label>
            <Select value={gridOverlay} onValueChange={(value) => setGridOverlay(value as GridOverlayType)}>
              <SelectTrigger className="h-8 bg-gray-700 border-gray-600 text-white text-sm">
                <Grid3X3 className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="none" className="text-gray-300">Aucune</SelectItem>
                <SelectItem value="thirds" className="text-gray-300">Règle des tiers</SelectItem>
                <SelectItem value="grid" className="text-gray-300">Grille 6×6</SelectItem>
                <SelectItem value="cross" className="text-gray-300">Croix centrale</SelectItem>
                <SelectItem value="diagonal" className="text-gray-300">Diagonales</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-gray-700" />

          {/* Dimensions */}
          <div>
            <Label className="text-gray-400 text-xs mb-2 block">
              DIMENSIONS (mm)
            </Label>

            <div className="space-y-2">
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

            {(photo.stretchX !== 1 || photo.stretchY !== 1) && (
              <div className="mt-2 p-2 bg-blue-900/30 rounded text-xs text-blue-300">
                <p>Etirement X: x{photo.stretchX.toFixed(4)}</p>
                <p>Etirement Y: x{photo.stretchY.toFixed(4)}</p>
              </div>
            )}

            <p className="text-gray-500 text-[10px] mt-2">
              Raccourcis: gauche/droite = X +/-1mm, haut/bas = Y +/-1mm
              <br />
              SHIFT = +/-0.1mm, CTRL = +/-5mm
            </p>
          </div>

          <Separator className="bg-gray-700" />

          {/* Mesures + Correction de perspective */}
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
              <div className="space-y-2">
                {measurements.map((m) => {
                  const measuredValue = calculateDistanceMm(m.point1, m.point2);
                  return (
                    <div
                      key={m.id}
                      className="p-2 bg-gray-700 rounded text-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: m.color }}
                          />
                          <span className="text-gray-400 text-xs">Mesuré:</span>
                          <span className="text-white font-medium">
                            {measuredValue.toFixed(1)} mm
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
                      {/* v1.2.0: Input pour valeur réelle */}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs">Réel:</span>
                        <Input
                          type="number"
                          step="0.1"
                          value={m.targetValueMm ?? ""}
                          placeholder={measuredValue.toFixed(1)}
                          onChange={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : undefined;
                            onSetMeasurementTarget(m.id, val);
                          }}
                          className="h-6 w-20 bg-gray-600 border-gray-500 text-white text-xs px-2"
                        />
                        <span className="text-gray-400 text-xs">mm</span>
                        {m.targetValueMm && m.targetValueMm !== measuredValue && (
                          <span className="text-yellow-400 text-xs">
                            ({((m.targetValueMm / measuredValue - 1) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* v1.2.4: Bouton Corriger perspective avec skewX ET skewY */}
              {measurements.some(m => m.targetValueMm !== undefined) && (
                <div className="mt-3 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Fonction locale pour calculer la distance BRUTE (sans stretch ni skew)
                      const calculateRawDistanceMm = (p1: MeasurePoint, p2: MeasurePoint): number => {
                        if (!photo.image) return 0;
                        const imgWidth = photo.image.naturalWidth || photo.image.width;
                        const imgHeight = photo.image.naturalHeight || photo.image.height;
                        
                        const x1 = (p1.xPercent / 100) * imgWidth;
                        const y1 = (p1.yPercent / 100) * imgHeight;
                        const x2 = (p2.xPercent / 100) * imgWidth;
                        const y2 = (p2.yPercent / 100) * imgHeight;
                        
                        const distancePx = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                        const scaleX = photo.arucoScaleX || 1;
                        const scaleY = photo.arucoScaleY || 1;
                        const avgScale = (scaleX + scaleY) / 2;
                        
                        return distancePx / avgScale;
                      };

                      // Séparer les mesures horizontales et verticales
                      const horizontalMeasures = measurements.filter(m => {
                        if (m.targetValueMm === undefined) return false;
                        const dx = Math.abs(m.point2.xPercent - m.point1.xPercent);
                        const dy = Math.abs(m.point2.yPercent - m.point1.yPercent);
                        return dx > dy * 2;
                      });

                      const verticalMeasures = measurements.filter(m => {
                        if (m.targetValueMm === undefined) return false;
                        const dx = Math.abs(m.point2.xPercent - m.point1.xPercent);
                        const dy = Math.abs(m.point2.yPercent - m.point1.yPercent);
                        return dy > dx * 2;
                      });

                      let newSkewX = 0;
                      let newStretchX = photo.stretchX;
                      let newSkewY = 0;
                      let newStretchY = photo.stretchY;
                      let correctionApplied = false;

                      // === CORRECTION HORIZONTALE (skewX) ===
                      if (horizontalMeasures.length >= 2) {
                        const sorted = [...horizontalMeasures].sort((a, b) => {
                          const ya = (a.point1.yPercent + a.point2.yPercent) / 2;
                          const yb = (b.point1.yPercent + b.point2.yPercent) / 2;
                          return ya - yb;
                        });

                        const topMeasure = sorted[0];
                        const bottomMeasure = sorted[sorted.length - 1];

                        const topY = (topMeasure.point1.yPercent + topMeasure.point2.yPercent) / 200;
                        const bottomY = (bottomMeasure.point1.yPercent + bottomMeasure.point2.yPercent) / 200;

                        const Mt = calculateRawDistanceMm(topMeasure.point1, topMeasure.point2);
                        const Mb = calculateRawDistanceMm(bottomMeasure.point1, bottomMeasure.point2);
                        const Tt = topMeasure.targetValueMm!;
                        const Tb = bottomMeasure.targetValueMm!;

                        const a = topY - 0.5;
                        const b = bottomY - 0.5;

                        if (Math.abs(b - a) > 0.01) {
                          const R = (Tt * Mb) / (Tb * Mt);
                          const denominator = a - R * b;
                          if (Math.abs(denominator) > 0.0001) {
                            newSkewX = (R - 1) / denominator;
                            const factor = 1 + newSkewX * a;
                            if (Math.abs(factor) > 0.0001) {
                              newStretchX = Tt / (Mt * factor);
                              correctionApplied = true;
                            }
                          }
                        }
                      }

                      // === CORRECTION VERTICALE (skewY) ===
                      if (verticalMeasures.length >= 2) {
                        const sorted = [...verticalMeasures].sort((a, b) => {
                          const xa = (a.point1.xPercent + a.point2.xPercent) / 2;
                          const xb = (b.point1.xPercent + b.point2.xPercent) / 2;
                          return xa - xb;
                        });

                        const leftMeasure = sorted[0];
                        const rightMeasure = sorted[sorted.length - 1];

                        const leftX = (leftMeasure.point1.xPercent + leftMeasure.point2.xPercent) / 200;
                        const rightX = (rightMeasure.point1.xPercent + rightMeasure.point2.xPercent) / 200;

                        const Ml = calculateRawDistanceMm(leftMeasure.point1, leftMeasure.point2);
                        const Mr = calculateRawDistanceMm(rightMeasure.point1, rightMeasure.point2);
                        const Tl = leftMeasure.targetValueMm!;
                        const Tr = rightMeasure.targetValueMm!;

                        const a = leftX - 0.5;
                        const b = rightX - 0.5;

                        if (Math.abs(b - a) > 0.01) {
                          const R = (Tl * Mr) / (Tr * Ml);
                          const denominator = a - R * b;
                          if (Math.abs(denominator) > 0.0001) {
                            newSkewY = (R - 1) / denominator;
                            const factor = 1 + newSkewY * a;
                            if (Math.abs(factor) > 0.0001) {
                              newStretchY = Tl / (Ml * factor);
                              correctionApplied = true;
                            }
                          }
                        }
                      }

                      // Appliquer les corrections
                      if (correctionApplied) {
                        onSetSkew(newSkewX, newSkewY);
                        onSetStretch(newStretchX, newStretchY);
                        
                        const messages: string[] = [];
                        if (Math.abs(newSkewX) > 0.001) messages.push(`skewX=${newSkewX.toFixed(4)}`);
                        if (Math.abs(newSkewY) > 0.001) messages.push(`skewY=${newSkewY.toFixed(4)}`);
                        toast.success(`Perspective corrigée: ${messages.join(", ")}`);
                        
                        console.log("[v1.2.4] Correction perspective:", {
                          newSkewX, newStretchX, newSkewY, newStretchY
                        });
                      } else {
                        // Fallback: correction simple par stretch
                        const measuresWithTarget = measurements.filter(m => m.targetValueMm !== undefined);
                        if (measuresWithTarget.length === 0) return;

                        let totalRatioX = 0, totalRatioY = 0, countX = 0, countY = 0;
                        for (const m of measuresWithTarget) {
                          const measured = calculateDistanceMm(m.point1, m.point2);
                          const target = m.targetValueMm!;
                          const ratio = target / measured;
                          const dx = Math.abs(m.point2.xPercent - m.point1.xPercent);
                          const dy = Math.abs(m.point2.yPercent - m.point1.yPercent);

                          if (dx > dy * 2) { totalRatioX += ratio; countX++; }
                          else if (dy > dx * 2) { totalRatioY += ratio; countY++; }
                          else { totalRatioX += ratio; totalRatioY += ratio; countX++; countY++; }
                        }

                        const avgRatioX = countX > 0 ? totalRatioX / countX : 1;
                        const avgRatioY = countY > 0 ? totalRatioY / countY : 1;
                        onSetStretch(photo.stretchX * avgRatioX, photo.stretchY * avgRatioY);
                        toast.success(`Étirement corrigé: X×${avgRatioX.toFixed(3)}, Y×${avgRatioY.toFixed(3)}`);
                      }
                    }}
                    className="w-full border-yellow-600 text-yellow-400 hover:bg-yellow-900/30"
                  >
                    <Columns className="h-4 w-4 mr-2" />
                    Corriger perspective
                  </Button>
                  
                  {/* Afficher skewX et skewY si != 0 */}
                  {(Math.abs(photo.skewX || 0) > 0.001 || Math.abs(photo.skewY || 0) > 0.001) && (
                    <div className="space-y-1">
                      {Math.abs(photo.skewX || 0) > 0.001 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">Skew X: {(photo.skewX || 0).toFixed(4)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSetSkew(0, photo.skewY)}
                            className="h-5 text-xs text-gray-400 hover:text-white px-2"
                          >
                            Reset
                          </Button>
                        </div>
                      )}
                      {Math.abs(photo.skewY || 0) > 0.001 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">Skew Y: {(photo.skewY || 0).toFixed(4)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSetSkew(photo.skewX, 0)}
                            className="h-5 text-xs text-gray-400 hover:text-white px-2"
                          >
                            Reset
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <p className="text-gray-500 text-[10px]">
                    2 mesures horizontales → skewX | 2 verticales → skewY
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <div className="space-y-2">
            {/* v1.2.2b: Bouton Réinitialiser tout */}
            <Button
              variant="outline"
              className="w-full border-orange-600 text-orange-400 hover:bg-orange-900/30"
              onClick={() => {
                // Réinitialiser toutes les transformations
                onSetRotation(0);
                onSetStretch(1, 1);
                onSetSkew(0, 0);
                onClearMeasurements();
                toast.success("Transformations réinitialisées");
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Réinitialiser tout
            </Button>

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
