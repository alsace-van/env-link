// ============================================
// HOOK: useOpenCVAruco
// Détection de markers ArUco et calibration avec OpenCV.js
// VERSION: 1.0
// ============================================

import { useState, useCallback, useRef, useEffect } from 'react';

// Types pour OpenCV.js (chargé dynamiquement)
declare global {
  interface Window {
    cv: any;
  }
}

export interface ArucoMarker {
  id: number;
  corners: { x: number; y: number }[];
  center: { x: number; y: number };
}

export interface CalibrationResult {
  markersDetected: ArucoMarker[];
  pixelsPerCm: number | null;
  homographyMatrix: number[][] | null;
  correctedImageData: ImageData | null;
}

export interface CameraCalibration {
  cameraMatrix: number[][];
  distCoeffs: number[];
  calibrated: boolean;
}

interface UseOpenCVArucoOptions {
  markerSizeCm?: number; // Taille réelle du marker en cm (défaut: 10)
  dictionaryType?: number; // Type de dictionnaire ArUco (défaut: DICT_4X4_50)
}

interface UseOpenCVArucoReturn {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;

  // Détection de markers
  detectMarkers: (image: HTMLImageElement | HTMLCanvasElement) => Promise<ArucoMarker[]>;

  // Calibration d'échelle automatique
  calculateScale: (markers: ArucoMarker[], markerSizeCm: number) => number | null;

  // Correction de perspective (si 4 markers détectés en carré)
  correctPerspective: (
    image: HTMLImageElement | HTMLCanvasElement,
    markers: ArucoMarker[]
  ) => Promise<ImageData | null>;

  // Calibration de caméra (correction de distorsion)
  calibrateCamera: (
    images: (HTMLImageElement | HTMLCanvasElement)[],
    patternSize: { width: number; height: number }
  ) => Promise<CameraCalibration | null>;

  // Correction de distorsion avec calibration existante
  undistortImage: (
    image: HTMLImageElement | HTMLCanvasElement,
    calibration: CameraCalibration
  ) => Promise<ImageData | null>;

  // Pipeline complet: détection + correction + échelle
  processImage: (
    image: HTMLImageElement | HTMLCanvasElement,
    options?: { markerSizeCm?: number; correctPerspective?: boolean }
  ) => Promise<CalibrationResult>;
}

const OPENCV_JS_URL = 'https://docs.opencv.org/4.8.0/opencv.js';

export function useOpenCVAruco(options: UseOpenCVArucoOptions = {}): UseOpenCVArucoReturn {
  const { markerSizeCm = 10, dictionaryType = 1 } = options; // 1 = DICT_4X4_50

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cvRef = useRef<any>(null);

  // Charger OpenCV.js dynamiquement
  useEffect(() => {
    if (window.cv && window.cv.Mat) {
      cvRef.current = window.cv;
      setIsLoaded(true);
      return;
    }

    if (isLoading) return;

    const loadOpenCV = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Vérifier si le script est déjà en cours de chargement
        const existingScript = document.querySelector(`script[src="${OPENCV_JS_URL}"]`);
        if (existingScript) {
          // Attendre que OpenCV soit prêt
          await waitForOpenCV();
          cvRef.current = window.cv;
          setIsLoaded(true);
          setIsLoading(false);
          return;
        }

        // Créer et ajouter le script
        const script = document.createElement('script');
        script.src = OPENCV_JS_URL;
        script.async = true;

        const loadPromise = new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Échec du chargement de OpenCV.js'));
        });

        document.head.appendChild(script);
        await loadPromise;

        // Attendre que OpenCV soit initialisé
        await waitForOpenCV();

        cvRef.current = window.cv;
        setIsLoaded(true);
        console.log('[OpenCV] Chargé avec succès');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        setError(message);
        console.error('[OpenCV] Erreur de chargement:', message);
      } finally {
        setIsLoading(false);
      }
    };

    loadOpenCV();
  }, [isLoading]);

  // Attendre que OpenCV soit complètement initialisé
  const waitForOpenCV = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const maxAttempts = 50;
      let attempts = 0;

      const check = () => {
        attempts++;
        if (window.cv && window.cv.Mat) {
          // OpenCV est prêt
          if (window.cv.onRuntimeInitialized) {
            window.cv.onRuntimeInitialized = () => resolve();
          } else {
            resolve();
          }
        } else if (attempts >= maxAttempts) {
          reject(new Error('Timeout: OpenCV.js non initialisé'));
        } else {
          setTimeout(check, 100);
        }
      };

      check();
    });
  };

  // Détecter les markers ArUco dans une image
  const detectMarkers = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement
  ): Promise<ArucoMarker[]> => {
    const cv = cvRef.current;
    if (!cv) {
      throw new Error('OpenCV non chargé');
    }

    const markers: ArucoMarker[] = [];
    let src: any = null;
    let gray: any = null;
    let corners: any = null;
    let ids: any = null;

    try {
      // Charger l'image dans OpenCV
      src = cv.imread(image);
      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Créer le dictionnaire ArUco
      const dictionary = cv.aruco.getPredefinedDictionary(dictionaryType);

      // Détecter les markers
      corners = new cv.MatVector();
      ids = new cv.Mat();

      cv.aruco.detectMarkers(gray, dictionary, corners, ids);

      // Extraire les résultats
      const numMarkers = ids.rows;

      for (let i = 0; i < numMarkers; i++) {
        const markerId = ids.intAt(i, 0);
        const cornerMat = corners.get(i);

        const markerCorners: { x: number; y: number }[] = [];
        for (let j = 0; j < 4; j++) {
          markerCorners.push({
            x: cornerMat.floatAt(0, j * 2),
            y: cornerMat.floatAt(0, j * 2 + 1)
          });
        }

        // Calculer le centre
        const center = {
          x: markerCorners.reduce((sum, c) => sum + c.x, 0) / 4,
          y: markerCorners.reduce((sum, c) => sum + c.y, 0) / 4
        };

        markers.push({
          id: markerId,
          corners: markerCorners,
          center
        });
      }

      console.log(`[OpenCV] ${markers.length} markers détectés`);
      return markers;

    } finally {
      // Libérer la mémoire
      if (src) src.delete();
      if (gray) gray.delete();
      if (corners) corners.delete();
      if (ids) ids.delete();
    }
  }, [dictionaryType]);

  // Calculer l'échelle (pixels par cm) à partir des markers
  const calculateScale = useCallback((
    markers: ArucoMarker[],
    markerSizeCm: number
  ): number | null => {
    if (markers.length === 0) return null;

    // Calculer la taille moyenne des markers en pixels
    const markerSizes: number[] = [];

    for (const marker of markers) {
      // Distance entre coins opposés (diagonale du carré)
      const diagonal1 = Math.sqrt(
        Math.pow(marker.corners[2].x - marker.corners[0].x, 2) +
        Math.pow(marker.corners[2].y - marker.corners[0].y, 2)
      );
      const diagonal2 = Math.sqrt(
        Math.pow(marker.corners[3].x - marker.corners[1].x, 2) +
        Math.pow(marker.corners[3].y - marker.corners[1].y, 2)
      );

      // Côté du carré = diagonale / sqrt(2)
      const sidePixels = (diagonal1 + diagonal2) / 2 / Math.sqrt(2);
      markerSizes.push(sidePixels);
    }

    // Moyenne des tailles
    const avgSizePixels = markerSizes.reduce((a, b) => a + b, 0) / markerSizes.length;
    const pixelsPerCm = avgSizePixels / markerSizeCm;

    console.log(`[OpenCV] Échelle calculée: ${pixelsPerCm.toFixed(2)} pixels/cm`);
    return pixelsPerCm;
  }, []);

  // Corriger la perspective si on a au moins 4 markers formant un quadrilatère
  const correctPerspective = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement,
    markers: ArucoMarker[]
  ): Promise<ImageData | null> => {
    const cv = cvRef.current;
    if (!cv || markers.length < 4) {
      return null;
    }

    let src: any = null;
    let dst: any = null;
    let srcPoints: any = null;
    let dstPoints: any = null;
    let M: any = null;

    try {
      // Trier les markers par position pour former un rectangle
      // (haut-gauche, haut-droit, bas-droit, bas-gauche)
      const sorted = [...markers].sort((a, b) => {
        const rowA = Math.floor(a.center.y / 100);
        const rowB = Math.floor(b.center.y / 100);
        if (rowA !== rowB) return rowA - rowB;
        return a.center.x - b.center.x;
      });

      const fourMarkers = sorted.slice(0, 4);

      // Points source (centres des markers)
      const srcPts = fourMarkers.map(m => [m.center.x, m.center.y]).flat();

      // Calculer les dimensions du rectangle de destination
      const width = Math.max(
        Math.abs(fourMarkers[1].center.x - fourMarkers[0].center.x),
        Math.abs(fourMarkers[3].center.x - fourMarkers[2].center.x)
      );
      const height = Math.max(
        Math.abs(fourMarkers[2].center.y - fourMarkers[0].center.y),
        Math.abs(fourMarkers[3].center.y - fourMarkers[1].center.y)
      );

      // Points destination (rectangle parfait)
      const dstPts = [
        0, 0,
        width, 0,
        width, height,
        0, height
      ];

      src = cv.imread(image);
      dst = new cv.Mat();

      srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, srcPts);
      dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, dstPts);

      M = cv.getPerspectiveTransform(srcPoints, dstPoints);
      cv.warpPerspective(src, dst, M, new cv.Size(width, height));

      // Convertir en ImageData
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      cv.imshow(canvas, dst);

      const ctx = canvas.getContext('2d');
      return ctx?.getImageData(0, 0, width, height) || null;

    } finally {
      if (src) src.delete();
      if (dst) dst.delete();
      if (srcPoints) srcPoints.delete();
      if (dstPoints) dstPoints.delete();
      if (M) M.delete();
    }
  }, []);

  // Calibrer la caméra avec plusieurs images d'un damier
  const calibrateCamera = useCallback(async (
    images: (HTMLImageElement | HTMLCanvasElement)[],
    patternSize: { width: number; height: number }
  ): Promise<CameraCalibration | null> => {
    const cv = cvRef.current;
    if (!cv || images.length < 3) {
      console.warn('[OpenCV] Besoin d\'au moins 3 images pour calibrer');
      return null;
    }

    const objectPoints: any[] = [];
    const imagePoints: any[] = [];
    let imageSize: any = null;

    try {
      // Points 3D du damier (Z=0 pour tous)
      const objp: number[] = [];
      for (let i = 0; i < patternSize.height; i++) {
        for (let j = 0; j < patternSize.width; j++) {
          objp.push(j, i, 0);
        }
      }

      for (const image of images) {
        let src: any = null;
        let gray: any = null;
        let corners: any = null;

        try {
          src = cv.imread(image);
          gray = new cv.Mat();
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

          if (!imageSize) {
            imageSize = new cv.Size(src.cols, src.rows);
          }

          corners = new cv.Mat();
          const found = cv.findChessboardCorners(
            gray,
            new cv.Size(patternSize.width, patternSize.height),
            corners
          );

          if (found) {
            // Affiner les coins
            cv.cornerSubPix(
              gray,
              corners,
              new cv.Size(11, 11),
              new cv.Size(-1, -1),
              new cv.TermCriteria(cv.TERM_CRITERIA_EPS + cv.TERM_CRITERIA_MAX_ITER, 30, 0.001)
            );

            objectPoints.push(cv.matFromArray(
              patternSize.width * patternSize.height, 1, cv.CV_32FC3, objp
            ));
            imagePoints.push(corners.clone());
          }
        } finally {
          if (src) src.delete();
          if (gray) gray.delete();
          // corners est utilisé dans imagePoints, ne pas supprimer
        }
      }

      if (objectPoints.length < 3) {
        console.warn('[OpenCV] Pas assez de damiers détectés');
        return null;
      }

      // Calibrer
      const cameraMatrix = new cv.Mat();
      const distCoeffs = new cv.Mat();
      const rvecs = new cv.MatVector();
      const tvecs = new cv.MatVector();

      cv.calibrateCamera(
        objectPoints,
        imagePoints,
        imageSize,
        cameraMatrix,
        distCoeffs,
        rvecs,
        tvecs
      );

      // Extraire les résultats
      const camMatrixData: number[][] = [];
      for (let i = 0; i < 3; i++) {
        camMatrixData.push([]);
        for (let j = 0; j < 3; j++) {
          camMatrixData[i].push(cameraMatrix.doubleAt(i, j));
        }
      }

      const distCoeffsData: number[] = [];
      for (let i = 0; i < distCoeffs.cols; i++) {
        distCoeffsData.push(distCoeffs.doubleAt(0, i));
      }

      // Nettoyer
      cameraMatrix.delete();
      distCoeffs.delete();
      rvecs.delete();
      tvecs.delete();
      objectPoints.forEach(m => m.delete());
      imagePoints.forEach(m => m.delete());

      console.log('[OpenCV] Calibration réussie');

      return {
        cameraMatrix: camMatrixData,
        distCoeffs: distCoeffsData,
        calibrated: true
      };

    } catch (err) {
      console.error('[OpenCV] Erreur de calibration:', err);
      return null;
    }
  }, []);

  // Corriger la distorsion avec une calibration existante
  const undistortImage = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement,
    calibration: CameraCalibration
  ): Promise<ImageData | null> => {
    const cv = cvRef.current;
    if (!cv || !calibration.calibrated) {
      return null;
    }

    let src: any = null;
    let dst: any = null;
    let cameraMatrix: any = null;
    let distCoeffs: any = null;

    try {
      src = cv.imread(image);
      dst = new cv.Mat();

      // Reconstruire les matrices
      cameraMatrix = cv.matFromArray(3, 3, cv.CV_64FC1, calibration.cameraMatrix.flat());
      distCoeffs = cv.matFromArray(1, calibration.distCoeffs.length, cv.CV_64FC1, calibration.distCoeffs);

      cv.undistort(src, dst, cameraMatrix, distCoeffs);

      // Convertir en ImageData
      const canvas = document.createElement('canvas');
      canvas.width = dst.cols;
      canvas.height = dst.rows;
      cv.imshow(canvas, dst);

      const ctx = canvas.getContext('2d');
      return ctx?.getImageData(0, 0, dst.cols, dst.rows) || null;

    } finally {
      if (src) src.delete();
      if (dst) dst.delete();
      if (cameraMatrix) cameraMatrix.delete();
      if (distCoeffs) distCoeffs.delete();
    }
  }, []);

  // Pipeline complet
  const processImage = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement,
    options: { markerSizeCm?: number; correctPerspective?: boolean } = {}
  ): Promise<CalibrationResult> => {
    const { markerSizeCm: size = markerSizeCm, correctPerspective: correct = false } = options;

    const result: CalibrationResult = {
      markersDetected: [],
      pixelsPerCm: null,
      homographyMatrix: null,
      correctedImageData: null
    };

    try {
      // Détecter les markers
      result.markersDetected = await detectMarkers(image);

      if (result.markersDetected.length > 0) {
        // Calculer l'échelle
        result.pixelsPerCm = calculateScale(result.markersDetected, size);

        // Corriger la perspective si demandé et possible
        if (correct && result.markersDetected.length >= 4) {
          result.correctedImageData = await correctPerspective(image, result.markersDetected);
        }
      }
    } catch (err) {
      console.error('[OpenCV] Erreur de traitement:', err);
    }

    return result;
  }, [markerSizeCm, detectMarkers, calculateScale, correctPerspective]);

  return {
    isLoaded,
    isLoading,
    error,
    detectMarkers,
    calculateScale,
    correctPerspective,
    calibrateCamera,
    undistortImage,
    processImage
  };
}

export default useOpenCVAruco;
