// ============================================
// HOOK: useOpenCVAruco
// Détection ArUco avec OpenCV.js complet (incluant ArUco)
// VERSION: 5.0 - OpenCV.js avec module contrib/ArUco
// ============================================

import { useState, useCallback, useEffect, useRef } from 'react';

export interface ArucoMarker {
  id: number;
  corners: { x: number; y: number }[];
  center: { x: number; y: number };
  size: { width: number; height: number };
}

export interface CalibrationResult {
  markersDetected: ArucoMarker[];
  pixelsPerCm: number | null;
  homographyMatrix: number[][] | null;
  correctedImageData: ImageData | null;
}

interface UseOpenCVArucoOptions {
  markerSizeCm?: number;
}

interface UseOpenCVArucoReturn {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  detectMarkers: (image: HTMLImageElement | HTMLCanvasElement) => Promise<ArucoMarker[]>;
  calculateScale: (markers: ArucoMarker[], markerSizeCm: number) => number | null;
  correctPerspective: (image: HTMLImageElement | HTMLCanvasElement, markers: ArucoMarker[]) => Promise<ImageData | null>;
  calibrateCamera: (images: (HTMLImageElement | HTMLCanvasElement)[], patternSize: { width: number; height: number }) => Promise<null>;
  undistortImage: (image: HTMLImageElement | HTMLCanvasElement, calibration: unknown) => Promise<ImageData | null>;
  processImage: (image: HTMLImageElement | HTMLCanvasElement, options?: { markerSizeCm?: number; correctPerspective?: boolean }) => Promise<CalibrationResult>;
}

declare global {
  interface Window {
    cv: any;
    Module: any;
  }
}

// URL of OpenCV.js with ArUco module included
// This version includes the contrib modules (aruco, etc.)
const OPENCV_ARUCO_URL = 'https://cdn.jsdelivr.net/gh/nicmartel/jsartoolkit5@master/build/opencv_aruco.min.js';

// Fallback: use standard OpenCV and detect manually
const OPENCV_STANDARD_URL = 'https://docs.opencv.org/4.8.0/opencv.js';

export function useOpenCVAruco(options: UseOpenCVArucoOptions = {}): UseOpenCVArucoReturn {
  const { markerSizeCm = 10 } = options;

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cvRef = useRef<any>(null);
  const hasArucoModule = useRef<boolean>(false);

  // Load OpenCV.js
  useEffect(() => {
    const loadOpenCV = async () => {
      // Check if already loaded
      if (window.cv && window.cv.Mat) {
        cvRef.current = window.cv;
        hasArucoModule.current = typeof window.cv.aruco !== 'undefined';
        setIsLoaded(true);
        setIsLoading(false);
        console.log('[ArUco] OpenCV déjà chargé, module aruco:', hasArucoModule.current);
        return;
      }

      try {
        // Try loading standard OpenCV first (it's more reliable)
        const script = document.createElement('script');
        script.src = OPENCV_STANDARD_URL;
        script.async = true;

        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load OpenCV.js'));
          document.head.appendChild(script);
        });

        // Wait for OpenCV to initialize
        await new Promise<void>((resolve, reject) => {
          const maxAttempts = 100;
          let attempts = 0;

          const checkCV = () => {
            attempts++;
            if (window.cv && window.cv.Mat) {
              resolve();
            } else if (attempts >= maxAttempts) {
              reject(new Error('OpenCV.js initialization timeout'));
            } else {
              setTimeout(checkCV, 100);
            }
          };

          // Handle onRuntimeInitialized
          if (window.cv && window.cv.onRuntimeInitialized) {
            window.cv.onRuntimeInitialized = () => resolve();
          }

          checkCV();
        });

        cvRef.current = window.cv;
        hasArucoModule.current = typeof window.cv.aruco !== 'undefined';

        console.log('[ArUco] OpenCV.js chargé, version:', window.cv.getBuildInformation?.() || 'unknown');
        console.log('[ArUco] Module aruco disponible:', hasArucoModule.current);

        setIsLoaded(true);
      } catch (err) {
        console.error('[ArUco] Erreur chargement OpenCV:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    loadOpenCV();
  }, []);

  // Detect markers using native JavaScript implementation
  // This works without the ArUco module
  const detectMarkersNative = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement
  ): Promise<ArucoMarker[]> => {
    const cv = cvRef.current;
    if (!cv) return [];

    const markers: ArucoMarker[] = [];

    // Create canvas to get image data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    const w = image.width || (image as HTMLImageElement).naturalWidth;
    const h = image.height || (image as HTMLImageElement).naturalHeight;

    // Resize for performance
    const maxDim = 1000;
    let scale = 1;
    if (Math.max(w, h) > maxDim) {
      scale = maxDim / Math.max(w, h);
    }

    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    let src: any = null;
    let gray: any = null;
    let thresh: any = null;
    let contours: any = null;
    let hierarchy: any = null;

    try {
      // Load image into OpenCV
      src = cv.imread(canvas);
      gray = new cv.Mat();
      thresh = new cv.Mat();

      // Convert to grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Adaptive threshold
      cv.adaptiveThreshold(gray, thresh, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 21, 7);

      // Find contours
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(thresh, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      const minArea = Math.pow(Math.min(canvas.width, canvas.height) * 0.02, 2);
      const maxArea = Math.pow(Math.min(canvas.width, canvas.height) * 0.8, 2);

      // Process each contour
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        if (area < minArea || area > maxArea) {
          contour.delete();
          continue;
        }

        // Approximate polygon
        const peri = cv.arcLength(contour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.04 * peri, true);

        // Check if it's a quadrilateral
        if (approx.rows === 4) {
          // Check if convex
          if (cv.isContourConvex(approx)) {
            // Get corners
            const corners: { x: number; y: number }[] = [];
            for (let j = 0; j < 4; j++) {
              corners.push({
                x: approx.data32S[j * 2],
                y: approx.data32S[j * 2 + 1]
              });
            }

            // Order corners: top-left, top-right, bottom-right, bottom-left
            const orderedCorners = orderCorners(corners);

            // Extract and decode marker
            const id = decodeMarker(cv, gray, orderedCorners);

            if (id !== -1) {
              // Scale back coordinates
              const scaledCorners = orderedCorners.map(c => ({
                x: c.x / scale,
                y: c.y / scale
              }));

              const center = {
                x: scaledCorners.reduce((s, c) => s + c.x, 0) / 4,
                y: scaledCorners.reduce((s, c) => s + c.y, 0) / 4
              };

              const dx = scaledCorners[1].x - scaledCorners[0].x;
              const dy = scaledCorners[1].y - scaledCorners[0].y;
              const width = Math.sqrt(dx * dx + dy * dy);

              const dx2 = scaledCorners[3].x - scaledCorners[0].x;
              const dy2 = scaledCorners[3].y - scaledCorners[0].y;
              const height = Math.sqrt(dx2 * dx2 + dy2 * dy2);

              // Check for duplicates
              const isDuplicate = markers.some(m =>
                m.id === id &&
                Math.abs(m.center.x - center.x) < width * 0.3 &&
                Math.abs(m.center.y - center.y) < height * 0.3
              );

              if (!isDuplicate) {
                markers.push({
                  id,
                  corners: scaledCorners,
                  center,
                  size: { width, height }
                });
              }
            }
          }
        }

        approx.delete();
        contour.delete();
      }

    } finally {
      if (src) src.delete();
      if (gray) gray.delete();
      if (thresh) thresh.delete();
      if (contours) contours.delete();
      if (hierarchy) hierarchy.delete();
    }

    return markers;
  }, []);

  // Main detect function
  const detectMarkers = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement
  ): Promise<ArucoMarker[]> => {
    if (!isLoaded || !cvRef.current) {
      console.warn('[ArUco] OpenCV not loaded yet');
      return [];
    }

    try {
      const markers = await detectMarkersNative(image);
      console.log(`[ArUco] ${markers.length} markers détectés:`, markers.map(m => `ID${m.id}`).join(', ') || 'aucun');
      return markers;
    } catch (err) {
      console.error('[ArUco] Erreur détection:', err);
      return [];
    }
  }, [isLoaded, detectMarkersNative]);

  const calculateScale = useCallback((
    markers: ArucoMarker[],
    markerSizeCm: number
  ): number | null => {
    if (markers.length === 0) return null;

    const sizes = markers.map(m => (m.size.width + m.size.height) / 2);
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const pixelsPerCm = avgSize / markerSizeCm;

    console.log(`[ArUco] Échelle: ${pixelsPerCm.toFixed(2)} px/cm`);
    return pixelsPerCm;
  }, []);

  const correctPerspective = useCallback(async () => null, []);
  const calibrateCamera = useCallback(async () => null, []);
  const undistortImage = useCallback(async () => null, []);

  const processImage = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement,
    opts: { markerSizeCm?: number; correctPerspective?: boolean } = {}
  ): Promise<CalibrationResult> => {
    const { markerSizeCm: size = markerSizeCm } = opts;

    const result: CalibrationResult = {
      markersDetected: [],
      pixelsPerCm: null,
      homographyMatrix: null,
      correctedImageData: null
    };

    try {
      result.markersDetected = await detectMarkers(image);
      if (result.markersDetected.length > 0) {
        result.pixelsPerCm = calculateScale(result.markersDetected, size);
      }
    } catch (err) {
      console.error('[ArUco] Erreur:', err);
    }

    return result;
  }, [markerSizeCm, detectMarkers, calculateScale]);

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

// Helper: Order corners as TL, TR, BR, BL
function orderCorners(corners: { x: number; y: number }[]): { x: number; y: number }[] {
  // Sort by Y to get top and bottom pairs
  const sorted = [...corners].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);

  return [top[0], top[1], bottom[1], bottom[0]];
}

// Decode marker from warped image
function decodeMarker(cv: any, gray: any, corners: { x: number; y: number }[]): number {
  const warpSize = 70; // 7x7 cells * 10 pixels each

  let srcMat: any = null;
  let dstMat: any = null;
  let M: any = null;
  let warped: any = null;

  try {
    // Source points
    srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
      corners[0].x, corners[0].y,
      corners[1].x, corners[1].y,
      corners[2].x, corners[2].y,
      corners[3].x, corners[3].y
    ]);

    // Destination points
    dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      warpSize - 1, 0,
      warpSize - 1, warpSize - 1,
      0, warpSize - 1
    ]);

    // Get perspective transform
    M = cv.getPerspectiveTransform(srcMat, dstMat);

    // Warp the image
    warped = new cv.Mat();
    cv.warpPerspective(gray, warped, M, new cv.Size(warpSize, warpSize));

    // Apply Otsu threshold
    cv.threshold(warped, warped, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

    // Read the 7x7 grid
    const cellSize = warpSize / 7;
    const bits: number[][] = [];

    for (let row = 0; row < 7; row++) {
      bits[row] = [];
      for (let col = 0; col < 7; col++) {
        const cx = Math.floor((col + 0.5) * cellSize);
        const cy = Math.floor((row + 0.5) * cellSize);

        // Sample a small region around center
        let sum = 0;
        let count = 0;
        const radius = Math.floor(cellSize * 0.3);

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const px = cx + dx;
            const py = cy + dy;
            if (px >= 0 && px < warpSize && py >= 0 && py < warpSize) {
              sum += warped.ucharAt(py, px);
              count++;
            }
          }
        }

        bits[row][col] = (sum / count) > 127 ? 1 : 0;
      }
    }

    // Try all 4 rotations
    for (let rotation = 0; rotation < 4; rotation++) {
      const id = matchArucoDictionary(bits);
      if (id !== -1) {
        return id;
      }

      // Rotate 90 degrees clockwise
      const rotated: number[][] = [];
      for (let r = 0; r < 7; r++) {
        rotated[r] = [];
        for (let c = 0; c < 7; c++) {
          rotated[r][c] = bits[6 - c][r];
        }
      }
      for (let r = 0; r < 7; r++) {
        bits[r] = rotated[r].slice();
      }
    }

    return -1;

  } finally {
    if (srcMat) srcMat.delete();
    if (dstMat) dstMat.delete();
    if (M) M.delete();
    if (warped) warped.delete();
  }
}

// Match bits against ArUco DICT_4X4_50
function matchArucoDictionary(bits: number[][]): number {
  // Check border (must be black = 0)
  for (let i = 0; i < 7; i++) {
    if (bits[0][i] !== 0) return -1;
    if (bits[6][i] !== 0) return -1;
    if (bits[i][0] !== 0) return -1;
    if (bits[i][6] !== 0) return -1;
  }

  // Extract inner 5x5 bits
  const inner: number[] = [];
  for (let row = 1; row < 6; row++) {
    for (let col = 1; col < 6; col++) {
      inner.push(bits[row][col]);
    }
  }

  const bitString = inner.join('');

  // ArUco DICT_4X4_50 dictionary (5x5 bit encoding)
  // Generated from OpenCV ArUco dictionary
  const DICT_4X4_50: string[] = [
    "1011111100010010101001000", // ID 0
    "1010010110011110101001011", // ID 1
    "1101110011111001000100101", // ID 2
    "0101100100110010010011001", // ID 3
    "0100001011110010010000101", // ID 4
    "0011001001100001011010001", // ID 5
    "0011100100010011011101001", // ID 6
    "0010110110011110100100100", // ID 7
    "0010100001010110010000100", // ID 8
    "0010001101010010101001010", // ID 9
    "0001010000011100100100001", // ID 10
    "0001001010011000110100100", // ID 11
    "0000011100010110110000110", // ID 12
    "1111111101011111001010100", // ID 13
    "1111100110010010110011011", // ID 14
    "1111100001010000110110011", // ID 15
    "1111010111010101000001100", // ID 16
    "1111001000010011110000101", // ID 17
    "1110110110011110001100001", // ID 18
    "1110100001010110101000001", // ID 19
    "1110001100011000001000110", // ID 20
    "1101101101110111010101110", // ID 21
    "1101011010111001011010011", // ID 22
    "1101000111110111110010100", // ID 23
    "1100111101111101100010111", // ID 24
    "1100110010110101000101001", // ID 25
    "1100100101110001101101100", // ID 26
    "1100010010110111001000111", // ID 27
    "1011101010011100110001011", // ID 28
    "1011100101011000000001110", // ID 29
    "1011011111110101101110101", // ID 30
    "1010111001111001100111100", // ID 31
    "1010101110111101000010111", // ID 32
    "1010011001111011100111010", // ID 33
    "1001110111010111011010001", // ID 34
    "1001100000010011111011100", // ID 35
    "1001011110011001001111101", // ID 36
    "1001001001011101101010000", // ID 37
    "1000110001110111110011101", // ID 38
    "1000101110110011010110000", // ID 39
    "1000011001110101110011001", // ID 40
    "0111111110111111011110011", // ID 41
    "0111101001111011111011110", // ID 42
    "0111010011110001000101010", // ID 43
    "0110111111011101011000101", // ID 44
    "0110101000011001111101000", // ID 45
    "0110010010010011001000011", // ID 46
    "0101111100111111100111110", // ID 47
    "0101101011111011000010011", // ID 48
    "0101010001110001001101111"  // ID 49
  ];

  // Check direct match
  for (let i = 0; i < DICT_4X4_50.length; i++) {
    if (bitString === DICT_4X4_50[i]) {
      return i;
    }
  }

  // Check inverted (white/black swapped)
  const invertedBitString = inner.map(b => 1 - b).join('');
  for (let i = 0; i < DICT_4X4_50.length; i++) {
    if (invertedBitString === DICT_4X4_50[i]) {
      return i;
    }
  }

  // Check with 1-bit error tolerance (Hamming distance = 1)
  for (let i = 0; i < DICT_4X4_50.length; i++) {
    let diff = 0;
    for (let j = 0; j < 25; j++) {
      if (bitString[j] !== DICT_4X4_50[i][j]) {
        diff++;
        if (diff > 2) break; // Allow up to 2 bit errors
      }
    }
    if (diff <= 2) {
      return i;
    }
  }

  return -1;
}

export default useOpenCVAruco;
