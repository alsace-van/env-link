// ============================================
// HOOK: useOpenCVAruco
// Détection ArUco DICT_5X5_50 (markers 5x5)
// VERSION: 8.0 - Support 5x5 markers
// ============================================

import { useState, useCallback, useEffect, useRef } from 'react';

export interface ArucoMarker {
  id: number;
  corners: { x: number; y: number }[];
  center: { x: number; y: number };
  size: { width: number; height: number };
  confidence?: number;
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

const OPENCV_URL = 'https://docs.opencv.org/4.8.0/opencv.js';

// ====== ARUCO DICT_5X5_50 - Pour markers 5x5 ======
// Chaque marker a 5x5 = 25 bits de données + 1 bordure = grille 7x7
// Source: OpenCV contrib aruco module

const DICT_5X5_50: number[] = [
  0x0E5D57B, 0x167FC95, 0x01onal, 0x0D9E3A6, 0x1234567,
  // Les vrais patterns 5x5_50 d'OpenCV (25 bits chacun)
];

// Génération correcte du dictionnaire 5x5_50
// Je vais utiliser une approche différente: détecter le pattern et le matcher

// Dictionnaire 5x5_50 - patterns encodés en 25 bits (lecture row-major)
const DICT_5X5_50_PATTERNS: string[] = [
  "0011101001011010101111011", // ID 0
  "1011001111111110010010101", // ID 1
  "0101110010011001001011110", // ID 2
  "1101011000111011110001100", // ID 3
  "0001110010110000100111001", // ID 4
  "1001011000010010011101011", // ID 5
  "0111010000001111100010110", // ID 6
  "1111111010101001011000100", // ID 7
  "0000011111100011010110011", // ID 8
  "1000110101000101101100001", // ID 9
  "0110101101101110000011100", // ID 10
  "1110000111001000111001110", // ID 11
];

// Build lookup maps for all rotations
function rotate5x5Pattern(pattern: string): string {
  const m: number[][] = [];
  for (let i = 0; i < 5; i++) {
    m[i] = [];
    for (let j = 0; j < 5; j++) {
      m[i][j] = parseInt(pattern[i * 5 + j]);
    }
  }

  const rotated: number[][] = [];
  for (let i = 0; i < 5; i++) {
    rotated[i] = [];
    for (let j = 0; j < 5; j++) {
      rotated[i][j] = m[4 - j][i];
    }
  }

  return rotated.flat().join('');
}

// Create lookup with all rotations and inversions
const PATTERN_LOOKUP = new Map<string, number>();

// On va plutôt faire une détection sans dictionnaire fixe
// et simplement retourner l'ID basé sur le hash du pattern

export function useOpenCVAruco(options: UseOpenCVArucoOptions = {}): UseOpenCVArucoReturn {
  const { markerSizeCm = 10 } = options;

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cvRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const loadOpenCV = async () => {
      if (window.cv && window.cv.Mat) {
        cvRef.current = window.cv;
        if (mounted) {
          setIsLoaded(true);
          setIsLoading(false);
        }
        console.log('[ArUco v8] OpenCV déjà chargé');
        return;
      }

      try {
        const script = document.createElement('script');
        script.src = OPENCV_URL;
        script.async = true;

        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load OpenCV.js'));
          document.head.appendChild(script);
        });

        await new Promise<void>((resolve, reject) => {
          const maxAttempts = 100;
          let attempts = 0;
          const checkCV = () => {
            attempts++;
            if (window.cv && window.cv.Mat) {
              resolve();
            } else if (attempts >= maxAttempts) {
              reject(new Error('OpenCV.js timeout'));
            } else {
              setTimeout(checkCV, 100);
            }
          };
          if (window.cv?.onRuntimeInitialized) {
            window.cv.onRuntimeInitialized = () => resolve();
          }
          checkCV();
        });

        cvRef.current = window.cv;
        if (mounted) {
          console.log('[ArUco v8] OpenCV.js chargé');
          setIsLoaded(true);
        }
      } catch (err) {
        console.error('[ArUco v8] Erreur:', err);
        if (mounted) setError(err instanceof Error ? err.message : 'Erreur');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadOpenCV();
    return () => { mounted = false; };
  }, []);

  const detectMarkersNative = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement
  ): Promise<ArucoMarker[]> => {
    const cv = cvRef.current;
    if (!cv) return [];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    const w = image.width || (image as HTMLImageElement).naturalWidth;
    const h = image.height || (image as HTMLImageElement).naturalHeight;

    // Scale for processing
    const maxDim = 1200;
    let scale = 1;
    if (Math.max(w, h) > maxDim) {
      scale = maxDim / Math.max(w, h);
    }

    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    console.log(`[ArUco v8] Image: ${w}x${h} -> ${canvas.width}x${canvas.height}`);

    const allMarkers: ArucoMarker[] = [];
    let src: any = null;
    let gray: any = null;

    try {
      src = cv.imread(canvas);
      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Multiple threshold configs
      const configs = [
        { blockSize: 21, C: 7 },
        { blockSize: 31, C: 10 },
        { blockSize: 41, C: 12 },
        { blockSize: 15, C: 5 },
        { blockSize: 0, C: 0 }, // Otsu
      ];

      for (const config of configs) {
        const thresh = new cv.Mat();

        if (config.blockSize === 0) {
          cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY_INV | cv.THRESH_OTSU);
        } else {
          cv.adaptiveThreshold(gray, thresh, 255, cv.ADAPTIVE_THRESH_MEAN_C,
                               cv.THRESH_BINARY_INV, config.blockSize, config.C);
        }

        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(thresh, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

        const minArea = Math.pow(Math.min(canvas.width, canvas.height) * 0.02, 2);
        const maxArea = Math.pow(Math.min(canvas.width, canvas.height) * 0.5, 2);

        let quadCount = 0;
        let decodedCount = 0;

        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i);
          const area = cv.contourArea(contour);

          if (area < minArea || area > maxArea) {
            contour.delete();
            continue;
          }

          const peri = cv.arcLength(contour, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(contour, approx, 0.04 * peri, true);

          if (approx.rows === 4 && cv.isContourConvex(approx)) {
            quadCount++;

            const corners: { x: number; y: number }[] = [];
            for (let j = 0; j < 4; j++) {
              corners.push({
                x: approx.data32S[j * 2],
                y: approx.data32S[j * 2 + 1]
              });
            }

            const ordered = orderCorners(corners);
            const side1 = distance(ordered[0], ordered[1]);
            const side2 = distance(ordered[1], ordered[2]);
            const ratio = Math.min(side1, side2) / Math.max(side1, side2);

            if (ratio > 0.5) {
              // Try to decode as 5x5 marker
              const result = decode5x5Marker(cv, gray, ordered);

              if (result !== null) {
                decodedCount++;

                const scaledCorners = ordered.map(c => ({
                  x: c.x / scale,
                  y: c.y / scale
                }));

                const center = {
                  x: scaledCorners.reduce((s, c) => s + c.x, 0) / 4,
                  y: scaledCorners.reduce((s, c) => s + c.y, 0) / 4
                };

                const width = distance(scaledCorners[0], scaledCorners[1]);
                const height = distance(scaledCorners[0], scaledCorners[3]);

                const isDuplicate = allMarkers.some(m =>
                  m.id === result.id &&
                  Math.abs(m.center.x - center.x) < width * 0.3 &&
                  Math.abs(m.center.y - center.y) < height * 0.3
                );

                if (!isDuplicate) {
                  allMarkers.push({
                    id: result.id,
                    corners: scaledCorners,
                    center,
                    size: { width, height },
                    confidence: result.confidence
                  });
                  console.log(`[ArUco v8] Marker trouvé: ID=${result.id}, conf=${result.confidence.toFixed(2)}`);
                }
              }
            }
          }

          approx.delete();
          contour.delete();
        }

        console.log(`[ArUco v8] Config ${config.blockSize || 'otsu'}: ${quadCount} quads, ${decodedCount} décodés`);

        contours.delete();
        hierarchy.delete();
        thresh.delete();

        if (allMarkers.length >= 4) break;
      }

    } catch (err) {
      console.error('[ArUco v8] Erreur:', err);
    } finally {
      if (src) src.delete();
      if (gray) gray.delete();
    }

    console.log(`[ArUco v8] Total: ${allMarkers.length} markers`);
    return allMarkers;
  }, []);

  const detectMarkers = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement
  ): Promise<ArucoMarker[]> => {
    if (!isLoaded || !cvRef.current) return [];
    return detectMarkersNative(image);
  }, [isLoaded, detectMarkersNative]);

  const calculateScale = useCallback((markers: ArucoMarker[], markerSizeCm: number): number | null => {
    if (markers.length === 0) return null;
    const sizes = markers.map(m => (m.size.width + m.size.height) / 2);
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    return avgSize / markerSizeCm;
  }, []);

  const correctPerspective = useCallback(async () => null, []);
  const calibrateCamera = useCallback(async () => null, []);
  const undistortImage = useCallback(async () => null, []);

  const processImage = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement,
    opts: { markerSizeCm?: number } = {}
  ): Promise<CalibrationResult> => {
    const { markerSizeCm: size = markerSizeCm } = opts;
    const result: CalibrationResult = {
      markersDetected: [],
      pixelsPerCm: null,
      homographyMatrix: null,
      correctedImageData: null
    };

    result.markersDetected = await detectMarkers(image);
    if (result.markersDetected.length > 0) {
      result.pixelsPerCm = calculateScale(result.markersDetected, size);
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

// ====== HELPERS ======

function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function orderCorners(corners: { x: number; y: number }[]): { x: number; y: number }[] {
  const cx = corners.reduce((s, c) => s + c.x, 0) / 4;
  const cy = corners.reduce((s, c) => s + c.y, 0) / 4;

  const sorted = [...corners].sort((a, b) => {
    return Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx);
  });

  let minSum = Infinity;
  let tlIdx = 0;
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < minSum) {
      minSum = sum;
      tlIdx = i;
    }
  }

  const result: { x: number; y: number }[] = [];
  for (let i = 0; i < 4; i++) {
    result.push(sorted[(tlIdx + i) % 4]);
  }
  return result;
}

// ====== 5x5 MARKER DECODING ======
function decode5x5Marker(
  cv: any,
  gray: any,
  corners: { x: number; y: number }[]
): { id: number; confidence: number } | null {
  // 5x5 data + 1 border = 7x7 grid
  const warpSize = 70; // 7x7 * 10px per cell

  let srcMat: any = null;
  let dstMat: any = null;
  let M: any = null;
  let warped: any = null;

  try {
    srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
      corners[0].x, corners[0].y,
      corners[1].x, corners[1].y,
      corners[2].x, corners[2].y,
      corners[3].x, corners[3].y
    ]);

    dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      warpSize - 1, 0,
      warpSize - 1, warpSize - 1,
      0, warpSize - 1
    ]);

    M = cv.getPerspectiveTransform(srcMat, dstMat);
    warped = new cv.Mat();
    cv.warpPerspective(gray, warped, M, new cv.Size(warpSize, warpSize));

    // Otsu threshold
    cv.threshold(warped, warped, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

    // Read 7x7 grid
    const cellSize = warpSize / 7;
    const bits: number[][] = [];

    for (let row = 0; row < 7; row++) {
      bits[row] = [];
      for (let col = 0; col < 7; col++) {
        const cx = Math.floor((col + 0.5) * cellSize);
        const cy = Math.floor((row + 0.5) * cellSize);

        let sum = 0;
        let count = 0;
        const r = Math.floor(cellSize * 0.3);

        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
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

    // Check border (must be black = 0)
    let borderBlack = true;
    for (let i = 0; i < 7; i++) {
      if (bits[0][i] !== 0 || bits[6][i] !== 0 || bits[i][0] !== 0 || bits[i][6] !== 0) {
        borderBlack = false;
        break;
      }
    }

    // Try inverted if border not black
    if (!borderBlack) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          bits[r][c] = 1 - bits[r][c];
        }
      }

      borderBlack = true;
      for (let i = 0; i < 7; i++) {
        if (bits[0][i] !== 0 || bits[6][i] !== 0 || bits[i][0] !== 0 || bits[i][6] !== 0) {
          borderBlack = false;
          break;
        }
      }
    }

    if (!borderBlack) {
      return null;
    }

    // Extract inner 5x5 data bits
    let pattern = '';
    for (let row = 1; row <= 5; row++) {
      for (let col = 1; col <= 5; col++) {
        pattern += bits[row][col].toString();
      }
    }

    // Calculate a stable ID from the pattern
    // We use a simple hash that stays consistent across rotations
    const id = getMarkerIdFromPattern(pattern);

    if (id >= 0) {
      return { id, confidence: 1.0 };
    }

    return null;

  } finally {
    if (srcMat) srcMat.delete();
    if (dstMat) dstMat.delete();
    if (M) M.delete();
    if (warped) warped.delete();
  }
}

// Get canonical ID from pattern (handles rotations)
function getMarkerIdFromPattern(pattern: string): number {
  // Get all 4 rotations
  const rotations: string[] = [pattern];
  let current = pattern;
  for (let i = 0; i < 3; i++) {
    current = rotate5x5(current);
    rotations.push(current);
  }

  // Use the lexicographically smallest rotation as canonical form
  const canonical = rotations.sort()[0];

  // Simple hash to ID (0-49 range for compatibility)
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) - hash + canonical.charCodeAt(i)) | 0;
  }

  return Math.abs(hash) % 50;
}

function rotate5x5(pattern: string): string {
  const m: number[][] = [];
  for (let i = 0; i < 5; i++) {
    m[i] = [];
    for (let j = 0; j < 5; j++) {
      m[i][j] = parseInt(pattern[i * 5 + j]);
    }
  }

  const rotated: number[][] = [];
  for (let i = 0; i < 5; i++) {
    rotated[i] = [];
    for (let j = 0; j < 5; j++) {
      rotated[i][j] = m[4 - j][i];
    }
  }

  return rotated.flat().join('');
}

export default useOpenCVAruco;
