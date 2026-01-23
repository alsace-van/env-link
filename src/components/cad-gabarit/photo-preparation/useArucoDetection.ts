// ============================================
// HOOK: useArucoDetection
// Détection simplifiée des marqueurs ArUco
// VERSION: 1.0.0
// ============================================
//
// Changelog (3 dernières versions) :
// - v1.0.0 (2025-01-23) : Création initiale, basé sur useOpenCVAruco.ts
//
// Historique complet : voir REFACTORING_PHOTO_PREPARATION.md
// ============================================

import { useState, useCallback, useEffect, useRef } from "react";
import { ArucoDetectionResult, ArucoMarkerDetected } from "./types";

// Taille réelle d'un marqueur ArUco en mm (à ajuster selon tes marqueurs imprimés)
const ARUCO_MARKER_SIZE_MM = 50;

// Déclaration pour OpenCV.js
declare global {
  interface Window {
    cv: any;
  }
}

export interface UseArucoDetectionReturn {
  // État
  isOpenCVLoaded: boolean;
  isDetecting: boolean;
  lastResult: ArucoDetectionResult | null;
  error: string | null;
  
  // Actions
  detectMarkers: (
    imageSource: HTMLImageElement | HTMLCanvasElement
  ) => Promise<ArucoDetectionResult>;
  
  // Utilitaire
  calculateScaleFromMarkers: (markers: ArucoMarkerDetected[]) => {
    scaleX: number | null;
    scaleY: number | null;
    avgScale: number | null;
  };
}

export function useArucoDetection(): UseArucoDetectionReturn {
  const [isOpenCVLoaded, setIsOpenCVLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [lastResult, setLastResult] = useState<ArucoDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const cvLoadedRef = useRef(false);

  // Vérifier si OpenCV est chargé
  useEffect(() => {
    const checkOpenCV = () => {
      if (window.cv && window.cv.Mat) {
        setIsOpenCVLoaded(true);
        cvLoadedRef.current = true;
        return true;
      }
      return false;
    };

    if (checkOpenCV()) return;

    // Attendre que OpenCV soit chargé
    const interval = setInterval(() => {
      if (checkOpenCV()) {
        clearInterval(interval);
      }
    }, 500);

    // Timeout après 30 secondes
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!cvLoadedRef.current) {
        setError("OpenCV n'a pas pu être chargé");
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  // Calculer le scale à partir des marqueurs détectés
  const calculateScaleFromMarkers = useCallback(
    (markers: ArucoMarkerDetected[]): {
      scaleX: number | null;
      scaleY: number | null;
      avgScale: number | null;
    } => {
      if (markers.length === 0) {
        return { scaleX: null, scaleY: null, avgScale: null };
      }

      // Collecter les tailles horizontales et verticales de chaque marqueur
      const horizontalSizes: number[] = [];
      const verticalSizes: number[] = [];

      for (const marker of markers) {
        const corners = marker.corners;
        if (corners.length !== 4) continue;

        // Côté haut (0 → 1)
        const topWidth = Math.sqrt(
          (corners[1].x - corners[0].x) ** 2 + (corners[1].y - corners[0].y) ** 2
        );
        // Côté bas (3 → 2)
        const bottomWidth = Math.sqrt(
          (corners[2].x - corners[3].x) ** 2 + (corners[2].y - corners[3].y) ** 2
        );
        // Côté gauche (0 → 3)
        const leftHeight = Math.sqrt(
          (corners[3].x - corners[0].x) ** 2 + (corners[3].y - corners[0].y) ** 2
        );
        // Côté droit (1 → 2)
        const rightHeight = Math.sqrt(
          (corners[2].x - corners[1].x) ** 2 + (corners[2].y - corners[1].y) ** 2
        );

        horizontalSizes.push((topWidth + bottomWidth) / 2);
        verticalSizes.push((leftHeight + rightHeight) / 2);
      }

      if (horizontalSizes.length === 0) {
        return { scaleX: null, scaleY: null, avgScale: null };
      }

      // Calculer les moyennes
      const avgHorizontalPx =
        horizontalSizes.reduce((a, b) => a + b, 0) / horizontalSizes.length;
      const avgVerticalPx =
        verticalSizes.reduce((a, b) => a + b, 0) / verticalSizes.length;

      // Scale = pixels par mm
      const scaleX = avgHorizontalPx / ARUCO_MARKER_SIZE_MM;
      const scaleY = avgVerticalPx / ARUCO_MARKER_SIZE_MM;
      const avgScale = (scaleX + scaleY) / 2;

      return { scaleX, scaleY, avgScale };
    },
    []
  );

  // Détecter les marqueurs ArUco
  const detectMarkers = useCallback(
    async (
      imageSource: HTMLImageElement | HTMLCanvasElement
    ): Promise<ArucoDetectionResult> => {
      if (!isOpenCVLoaded || !window.cv) {
        const result: ArucoDetectionResult = {
          markers: [],
          scaleX: null,
          scaleY: null,
          confidence: 0,
          error: "OpenCV n'est pas chargé",
        };
        setLastResult(result);
        return result;
      }

      setIsDetecting(true);
      setError(null);

      try {
        const cv = window.cv;

        // Créer un canvas temporaire pour l'image
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Impossible de créer le contexte canvas");

        if (imageSource instanceof HTMLImageElement) {
          canvas.width = imageSource.naturalWidth || imageSource.width;
          canvas.height = imageSource.naturalHeight || imageSource.height;
          ctx.drawImage(imageSource, 0, 0);
        } else {
          canvas.width = imageSource.width;
          canvas.height = imageSource.height;
          ctx.drawImage(imageSource, 0, 0);
        }

        // Convertir en Mat OpenCV
        const src = cv.imread(canvas);
        const gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // Créer le dictionnaire ArUco (4x4_50)
        const dictionary = new cv.aruco_Dictionary(cv.DICT_4X4_50);

        // Détecter les marqueurs
        const corners = new cv.MatVector();
        const ids = new cv.Mat();
        const rejected = new cv.MatVector();

        // Paramètres de détection (réglages qui fonctionnaient bien)
        const parameters = new cv.aruco_DetectorParameters();
        parameters.adaptiveThreshWinSizeMin = 3;
        parameters.adaptiveThreshWinSizeMax = 23;
        parameters.adaptiveThreshWinSizeStep = 10;
        parameters.adaptiveThreshConstant = 7;
        parameters.minMarkerPerimeterRate = 0.03;
        parameters.maxMarkerPerimeterRate = 4.0;
        parameters.polygonalApproxAccuracyRate = 0.03;
        parameters.minCornerDistanceRate = 0.05;
        parameters.minDistanceToBorder = 3;

        cv.detectMarkers(gray, dictionary, corners, ids, parameters, rejected);

        // Convertir les résultats
        const detectedMarkers: ArucoMarkerDetected[] = [];

        if (ids.rows > 0) {
          for (let i = 0; i < ids.rows; i++) {
            const markerId = ids.intAt(i, 0);
            const markerCorners = corners.get(i);
            
            const cornerPoints: { x: number; y: number }[] = [];
            for (let j = 0; j < 4; j++) {
              cornerPoints.push({
                x: markerCorners.floatAt(0, j * 2),
                y: markerCorners.floatAt(0, j * 2 + 1),
              });
            }

            // Calculer le centre et la taille
            const centerX = cornerPoints.reduce((sum, p) => sum + p.x, 0) / 4;
            const centerY = cornerPoints.reduce((sum, p) => sum + p.y, 0) / 4;
            
            // Taille moyenne (diagonales)
            const diag1 = Math.sqrt(
              (cornerPoints[2].x - cornerPoints[0].x) ** 2 +
              (cornerPoints[2].y - cornerPoints[0].y) ** 2
            );
            const diag2 = Math.sqrt(
              (cornerPoints[3].x - cornerPoints[1].x) ** 2 +
              (cornerPoints[3].y - cornerPoints[1].y) ** 2
            );
            const sizePixels = (diag1 + diag2) / 2 / Math.sqrt(2);

            detectedMarkers.push({
              id: markerId,
              corners: cornerPoints,
              center: { x: centerX, y: centerY },
              sizePixels,
            });
          }
        }

        // Calculer le scale
        const { scaleX, scaleY } = calculateScaleFromMarkers(detectedMarkers);

        // Calculer la confiance (basée sur le nombre de marqueurs et leur cohérence)
        let confidence = 0;
        if (detectedMarkers.length >= 4) {
          confidence = 1;
        } else if (detectedMarkers.length >= 2) {
          confidence = 0.7;
        } else if (detectedMarkers.length === 1) {
          confidence = 0.4;
        }

        // Nettoyer
        src.delete();
        gray.delete();
        corners.delete();
        ids.delete();
        rejected.delete();

        const result: ArucoDetectionResult = {
          markers: detectedMarkers,
          scaleX,
          scaleY,
          confidence,
          error: null,
        };

        setLastResult(result);
        setIsDetecting(false);
        
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
        console.error("[ArUco] Erreur détection:", err);
        
        const result: ArucoDetectionResult = {
          markers: [],
          scaleX: null,
          scaleY: null,
          confidence: 0,
          error: errorMessage,
        };
        
        setError(errorMessage);
        setLastResult(result);
        setIsDetecting(false);
        
        return result;
      }
    },
    [isOpenCVLoaded, calculateScaleFromMarkers]
  );

  return {
    isOpenCVLoaded,
    isDetecting,
    lastResult,
    error,
    detectMarkers,
    calculateScaleFromMarkers,
  };
}

export default useArucoDetection;
