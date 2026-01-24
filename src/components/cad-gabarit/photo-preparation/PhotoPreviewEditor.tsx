// ============================================
// COMPOSANT: PhotoPreviewEditor
// Preview individuelle avec outils de transformation
// VERSION: 1.0.18
// ============================================
//
// Changelog (3 dernières versions) :
// - v1.0.18 (2025-01-24) : REFONTE CANVAS - Comme ImageCalibrationModal
//   - Utilisation d'un Canvas 2D pour dessiner l'image ET les marqueurs
//   - Plus de problèmes de synchronisation CSS/positions
//   - Système viewport simple: scale + offsetX/Y
// - v1.0.17 (2025-01-24) : Tentative SVG intégré (échec)
// - v1.0.16 (2025-01-24) : FIX - Retour au fitToView automatique
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
  onUpdateMeasurementPoint: (measurementId: string, pointIndex: 1 | 2, xPercent: number, yPercent: number) => void;
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
  onSetCrop,
  onSetStretch,
  onAdjustStretchX,
  onAdjustStretchY,
  onSetActiveTool,
  onAddMeasurePoint,
  onRemoveMeasurement,
  onUpdateMeasurementPoint,
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
  const [detectedMarkers, setDetectedMarkers] = useState<
    Array<{
      id: number;
      corners: { x: number; y: number }[];
      center: { x: number; y: number };
    }>
  >([]);
  const [initialFitDone, setInitialFitDone] = useState(false);

  // Taille des marqueurs ArUco en mm
  const ARUCO_MARKER_SIZE_MM = 50;

  // Mettre à jour les inputs quand les dimensions changent
  useEffect(() => {
    setTargetWidthMm(widthMm.toFixed(1));
    setTargetHeightMm(heightMm.toFixed(1));
  }, [widthMm, heightMm]);

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

  // v1.0.18: Fit to view - calculer scale et offset pour centrer l'image
  const fitToView = useCallback(() => {
    if (!photo.image) return;

    const padding = 40;
    const imgWidth = photo.image.naturalWidth || photo.image.width;
    const imgHeight = photo.image.naturalHeight || photo.image.height;

    if (imgWidth === 0 || imgHeight === 0) return;
    if (canvasSize.width < 200 || canvasSize.height < 200) return;

    // Prendre en compte le stretch
    const effectiveWidth = imgWidth * photo.stretchX;
    const effectiveHeight = imgHeight * photo.stretchY;

    const scaleX = (canvasSize.width - padding * 2) / effectiveWidth;
    const scaleY = (canvasSize.height - padding * 2) / effectiveHeight;
    const scale = Math.min(scaleX, scaleY, 2); // Max zoom 200%

    // Centrer l'image
    const offsetX = (canvasSize.width - effectiveWidth * scale) / 2;
    const offsetY = (canvasSize.height - effectiveHeight * scale) / 2;

    setViewport({ scale, offsetX, offsetY });
    setInitialFitDone(true);
  }, [photo.image, photo.stretchX, photo.stretchY, canvasSize]);

  // Fit initial au chargement
  const fitDoneForPhotoRef = useRef<string | null>(null);
  useEffect(() => {
    if (fitDoneForPhotoRef.current === photo.id) return;
    if (!photo.image) return;
    if (canvasSize.width < 200 || canvasSize.height < 200) return;

    const timer = setTimeout(() => {
      fitToView();
      fitDoneForPhotoRef.current = photo.id;
    }, 100);

    return () => clearTimeout(timer);
  }, [photo.id, photo.image, canvasSize, fitToView]);

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
      setDetectedMarkers(
        markers.map((m) => ({
          id: m.id,
          corners: m.corners,
          center: m.center,
        })),
      );

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

  // v1.0.18: Convertir coordonnées image -> écran (comme ImageCalibrationModal)
  const imageToScreen = useCallback(
    (imgX: number, imgY: number) => {
      const { scale, offsetX, offsetY } = viewport;
      // Prendre en compte le stretch
      const effectiveScale = scale;
      return {
        x: imgX * photo.stretchX * effectiveScale + offsetX,
        y: imgY * photo.stretchY * effectiveScale + offsetY,
      };
    },
    [viewport, photo.stretchX, photo.stretchY],
  );

  // Convertir coordonnées écran -> image
  const screenToImage = useCallback(
    (screenX: number, screenY: number) => {
      const { scale, offsetX, offsetY } = viewport;
      return {
        x: (screenX - offsetX) / (scale * photo.stretchX),
        y: (screenY - offsetY) / (scale * photo.stretchY),
      };
    },
    [viewport, photo.stretchX, photo.stretchY],
  );

  // v1.0.18: Dessiner le canvas - IMAGE + MARQUEURS + MESURES
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photo.image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { scale, offsetX, offsetY } = viewport;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw image avec stretch
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale * photo.stretchX, scale * photo.stretchY);
    ctx.drawImage(photo.image, 0, 0);
    ctx.restore();

    // Draw ArUco markers
    if (detectedMarkers.length > 0 && initialFitDone) {
      for (const marker of detectedMarkers) {
        // Convertir les coins en coordonnées écran
        const screenCorners = marker.corners.map((c) => imageToScreen(c.x, c.y));

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
        const centerScreen = imageToScreen(marker.center.x, marker.center.y);
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(centerScreen.x - 16, centerScreen.y - 10, 32, 20);
        ctx.fillStyle = "#00FF00";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(marker.id), centerScreen.x, centerScreen.y);
      }
    }

    // Draw measurements
    for (const measurement of measurements) {
      if (!measurement.visible) continue;

      const imgWidth = photo.image.naturalWidth || photo.image.width;
      const imgHeight = photo.image.naturalHeight || photo.image.height;

      const p1Img = {
        x: (measurement.point1.xPercent / 100) * imgWidth,
        y: (measurement.point1.yPercent / 100) * imgHeight,
      };
      const p2Img = {
        x: (measurement.point2.xPercent / 100) * imgWidth,
        y: (measurement.point2.yPercent / 100) * imgHeight,
      };

      const p1Screen = imageToScreen(p1Img.x, p1Img.y);
      const p2Screen = imageToScreen(p2Img.x, p2Img.y);

      // Ligne
      ctx.beginPath();
      ctx.moveTo(p1Screen.x, p1Screen.y);
      ctx.lineTo(p2Screen.x, p2Screen.y);
      ctx.strokeStyle = measurement.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Points - Croix de ciblage précises
      const crossSize = 12; // Taille de la croix
      const crossGap = 3; // Espace au centre
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

    // Point en attente - Croix de ciblage
    if (pendingMeasurePoint && photo.image) {
      const imgWidth = photo.image.naturalWidth || photo.image.width;
      const imgHeight = photo.image.naturalHeight || photo.image.height;
      const imgPos = {
        x: (pendingMeasurePoint.xPercent / 100) * imgWidth,
        y: (pendingMeasurePoint.yPercent / 100) * imgHeight,
      };
      const p = imageToScreen(imgPos.x, imgPos.y);

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
  }, [
    photo.image,
    photo.stretchX,
    photo.stretchY,
    viewport,
    detectedMarkers,
    initialFitDone,
    measurements,
    pendingMeasurePoint,
    imageToScreen,
    calculateDistanceMm,
  ]);

  // Gestion du zoom avec la molette - useEffect avec addEventListener pour pouvoir preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setViewport((v) => {
        const newScale = Math.max(0.05, Math.min(5, v.scale * delta));
        const scaleChange = newScale / v.scale;
        const newOffsetX = mouseX - (mouseX - v.offsetX) * scaleChange;
        const newOffsetY = mouseY - (mouseY - v.offsetY) * scaleChange;
        return { scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
      });
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [photo.image]); // Re-bindé quand l'image change (car le canvas peut être recréé)

  // v1.0.19: Trouver si un clic est proche d'une poignée de mesure
  const findHandleAtPosition = useCallback(
    (clickX: number, clickY: number): { measurementId: string; pointIndex: 1 | 2 } | null => {
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
    },
    [photo.image, measurements, imageToScreen],
  );

  // v1.0.20: Gestion du pan, clic mesure et drag poignées
  // - Clic molette (button 1) : TOUJOURS pan, quel que soit l'outil
  // - Clic gauche sur poignée : TOUJOURS drag de la poignée
  // - Clic gauche ailleurs : dépend de l'outil (mesure ou pan)
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
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
        if (handle) {
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
    },
    [activeTool, photo.image, viewport, screenToImage, onAddMeasurePoint, findHandleAtPosition],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
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

        console.log(
          "[DRAG] Updating point:",
          draggingHandle.measurementId,
          draggingHandle.pointIndex,
          xPercent,
          yPercent,
        );
        onUpdateMeasurementPoint(draggingHandle.measurementId, draggingHandle.pointIndex, xPercent, yPercent);
        return;
      }

      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        setViewport((v) => ({
          ...v,
          offsetX: panStartOffset.x + dx,
          offsetY: panStartOffset.y + dy,
        }));
      }
    },
    [isPanning, panStart, panStartOffset, draggingHandle, photo.image, screenToImage, onUpdateMeasurementPoint],
  );

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
          <Button variant="ghost" size="sm" onClick={onBackToGrid} className="text-gray-300 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Grille
          </Button>

          <Separator orientation="vertical" className="h-6 bg-gray-600" />

          <span className="text-white font-medium">
            Photo {photoIndex + 1} / {totalPhotos}
          </span>

          <span className="text-gray-400 text-sm truncate max-w-[200px]">{photo.name}</span>

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
        <div ref={containerRef} className="absolute inset-0" style={{ right: "288px" }}>
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
              onClick={() => setViewport((v) => ({ ...v, scale: Math.max(0.05, v.scale * 0.8) }))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-white text-xs w-12 text-center">{zoomPercent}%</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => setViewport((v) => ({ ...v, scale: Math.min(5, v.scale * 1.2) }))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={fitToView}>
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
                -90
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRotate("cw")}
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <RotateCw className="h-4 w-4 mr-1" />
                +90
              </Button>
            </div>
          </div>

          <Separator className="bg-gray-700" />

          {/* Dimensions */}
          <div>
            <Label className="text-gray-400 text-xs mb-2 block">DIMENSIONS (mm)</Label>

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
                <span className="text-gray-500 text-xs">(actuel: {widthMm.toFixed(1)})</span>
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
                <span className="text-gray-500 text-xs">(actuel: {heightMm.toFixed(1)})</span>
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
                  <div key={m.id} className="flex items-center justify-between p-2 bg-gray-700 rounded text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
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

            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={onValidate}>
              <Check className="h-4 w-4 mr-2" />
              Valider et continuer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
