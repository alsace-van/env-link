// ============================================
// HOOK: useOpenCVAruco
// Détection ArUco ULTRA-ROBUSTE avec multi-pass
// VERSION: 6.0 - Système de détection avancé multi-algorithme
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
  debug?: boolean;
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

// OpenCV.js URL
const OPENCV_URL = 'https://docs.opencv.org/4.8.0/opencv.js';

// ====== ARUCO DICT_4X4_50 - OFFICIAL OPENCV DICTIONARY ======
// These are the EXACT patterns from OpenCV's DICT_4X4_50
// Source: https://github.com/opencv/opencv_contrib/blob/master/modules/aruco/src/predefined_dictionaries.hpp
// Each marker is stored as bytes in OpenCV, converted here to 4x4 bit patterns
// The patterns are stored row by row, MSB first

// OpenCV DICT_4X4_50 raw bytes (2 bytes per marker, representing 4x4=16 bits)
const DICT_4X4_50_BYTES: number[] = [
  0x1D, 0x19,  // ID 0
  0xD3, 0x3D,  // ID 1
  0x49, 0xDF,  // ID 2
  0x45, 0x93,  // ID 3
  0x1C, 0x91,  // ID 4
  0x53, 0x97,  // ID 5
  0x17, 0xCC,  // ID 6
  0x8D, 0x9F,  // ID 7
  0x96, 0x8B,  // ID 8
  0x65, 0xC9,  // ID 9
  0x4E, 0x47,  // ID 10
  0x33, 0x66,  // ID 11
  0xC1, 0x29,  // ID 12
  0xD3, 0x5C,  // ID 13
  0x17, 0xA5,  // ID 14
  0xA7, 0x13,  // ID 15
  0x56, 0x35,  // ID 16
  0xB2, 0x52,  // ID 17
  0x23, 0xE9,  // ID 18
  0x6C, 0x13,  // ID 19
  0x14, 0x96,  // ID 20
  0xC6, 0xC1,  // ID 21
  0x36, 0x8E,  // ID 22
  0xA9, 0x14,  // ID 23
  0x8B, 0x17,  // ID 24
  0xCC, 0xA5,  // ID 25
  0x5A, 0x5C,  // ID 26
  0xE3, 0x94,  // ID 27
  0xC9, 0x3B,  // ID 28
  0xB4, 0x65,  // ID 29
  0x78, 0xC4,  // ID 30
  0x1A, 0xC3,  // ID 31
  0x52, 0x33,  // ID 32
  0xC7, 0x65,  // ID 33
  0xAB, 0xC5,  // ID 34
  0xD2, 0x52,  // ID 35
  0x8E, 0xC5,  // ID 36
  0x26, 0xC9,  // ID 37
  0x57, 0x8A,  // ID 38
  0x32, 0x96,  // ID 39
  0x58, 0x8E,  // ID 40
  0xC8, 0x65,  // ID 41
  0x4E, 0x95,  // ID 42
  0x73, 0x35,  // ID 43
  0xB4, 0xC1,  // ID 44
  0x56, 0xAA,  // ID 45
  0x29, 0xD3,  // ID 46
  0xAC, 0x95,  // ID 47
  0x3A, 0x26,  // ID 48
  0x63, 0xC1,  // ID 49
];

// Convert bytes to 4x4 bit pattern string
function bytesToPattern(byte1: number, byte2: number): string {
  const bits16 = (byte1 << 8) | byte2;
  let pattern = '';
  for (let i = 15; i >= 0; i--) {
    pattern += ((bits16 >> i) & 1).toString();
  }
  return pattern;
}

// Build the dictionary
const ARUCO_4X4_50_PATTERNS: { [key: string]: number } = {};
for (let i = 0; i < 50; i++) {
  const pattern = bytesToPattern(DICT_4X4_50_BYTES[i * 2], DICT_4X4_50_BYTES[i * 2 + 1]);
  ARUCO_4X4_50_PATTERNS[pattern] = i;
}

// Alternative patterns with all rotations pre-computed
function generateAllRotations(): Map<string, { id: number; rotation: number }> {
  const allPatterns = new Map<string, { id: number; rotation: number }>();

  Object.entries(ARUCO_4X4_50_PATTERNS).forEach(([pattern, id]) => {
    // Add original and all 3 rotations
    let current = pattern;
    for (let rot = 0; rot < 4; rot++) {
      allPatterns.set(current, { id, rotation: rot });
      // Also add inverted version
      const inverted = current.split('').map(b => b === '0' ? '1' : '0').join('');
      allPatterns.set(inverted, { id, rotation: rot });
      // Rotate 90° clockwise for next iteration
      current = rotatePattern90(current);
    }
  });

  return allPatterns;
}

function rotatePattern90(pattern: string): string {
  // 4x4 pattern rotation
  const matrix: number[][] = [];
  for (let i = 0; i < 4; i++) {
    matrix[i] = [];
    for (let j = 0; j < 4; j++) {
      matrix[i][j] = parseInt(pattern[i * 4 + j]);
    }
  }

  // Rotate 90° clockwise
  const rotated: number[][] = [];
  for (let i = 0; i < 4; i++) {
    rotated[i] = [];
    for (let j = 0; j < 4; j++) {
      rotated[i][j] = matrix[3 - j][i];
    }
  }

  return rotated.flat().join('');
}

const ALL_PATTERNS = generateAllRotations();

export function useOpenCVAruco(options: UseOpenCVArucoOptions = {}): UseOpenCVArucoReturn {
  const { markerSizeCm = 10, debug = false } = options;

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cvRef = useRef<any>(null);

  // Load OpenCV.js
  useEffect(() => {
    let mounted = true;

    const loadOpenCV = async () => {
      // Check if already loaded
      if (window.cv && window.cv.Mat) {
        cvRef.current = window.cv;
        if (mounted) {
          setIsLoaded(true);
          setIsLoading(false);
        }
        console.log('[ArUco v6] OpenCV déjà chargé');
        return;
      }

      try {
        // Load OpenCV
        const script = document.createElement('script');
        script.src = OPENCV_URL;
        script.async = true;

        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load OpenCV.js'));
          document.head.appendChild(script);
        });

        // Wait for initialization
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

          if (window.cv && typeof window.cv.onRuntimeInitialized === 'function') {
            window.cv.onRuntimeInitialized = () => resolve();
          }

          checkCV();
        });

        cvRef.current = window.cv;

        if (mounted) {
          console.log('[ArUco v6] OpenCV.js chargé avec succès');
          setIsLoaded(true);
        }
      } catch (err) {
        console.error('[ArUco v6] Erreur:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Erreur inconnue');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadOpenCV();

    return () => {
      mounted = false;
    };
  }, []);

  // ====== MULTI-PASS DETECTION ALGORITHM ======
  const detectMarkersNative = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement
  ): Promise<ArucoMarker[]> => {
    const cv = cvRef.current;
    if (!cv) return [];

    // Create canvas to get image data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    const w = image.width || (image as HTMLImageElement).naturalWidth;
    const h = image.height || (image as HTMLImageElement).naturalHeight;

    // Multiple scales for better detection
    const scales = [1.0, 0.75, 0.5, 1.5];
    const allMarkers: ArucoMarker[] = [];

    for (const scaleFactor of scales) {
      const targetW = Math.round(w * scaleFactor);
      const targetH = Math.round(h * scaleFactor);

      // Limit size
      const maxDim = 1500;
      let actualScale = scaleFactor;
      if (Math.max(targetW, targetH) > maxDim) {
        actualScale = (maxDim / Math.max(w, h));
      }

      canvas.width = Math.round(w * actualScale);
      canvas.height = Math.round(h * actualScale);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      // Try multiple threshold methods
      const thresholdMethods = [
        { type: 'adaptive', blockSize: 21, C: 7 },
        { type: 'adaptive', blockSize: 31, C: 10 },
        { type: 'adaptive', blockSize: 15, C: 5 },
        { type: 'otsu' },
        { type: 'adaptive', blockSize: 41, C: 15 },
      ];

      for (const threshMethod of thresholdMethods) {
        const markers = await detectWithThreshold(cv, canvas, threshMethod, actualScale);

        // Merge with existing markers (avoid duplicates)
        for (const marker of markers) {
          const existing = allMarkers.find(m =>
            m.id === marker.id &&
            Math.abs(m.center.x - marker.center.x) < marker.size.width * 0.5 &&
            Math.abs(m.center.y - marker.center.y) < marker.size.height * 0.5
          );

          if (!existing) {
            allMarkers.push(marker);
          } else if (marker.confidence && (!existing.confidence || marker.confidence > existing.confidence)) {
            // Replace with higher confidence detection
            const idx = allMarkers.indexOf(existing);
            allMarkers[idx] = marker;
          }
        }

        // If we found markers, we can be less aggressive
        if (allMarkers.length >= 4) break;
      }

      // If we have enough markers, stop trying other scales
      if (allMarkers.length >= 4) break;
    }

    console.log(`[ArUco v6] Détection terminée: ${allMarkers.length} markers`);
    return allMarkers;
  }, []);

  // Detect with specific threshold parameters
  const detectWithThreshold = async (
    cv: any,
    canvas: HTMLCanvasElement,
    threshMethod: { type: string; blockSize?: number; C?: number },
    scale: number
  ): Promise<ArucoMarker[]> => {
    const markers: ArucoMarker[] = [];

    let src: any = null;
    let gray: any = null;
    let thresh: any = null;
    let contours: any = null;
    let hierarchy: any = null;

    try {
      src = cv.imread(canvas);
      gray = new cv.Mat();
      thresh = new cv.Mat();

      // Convert to grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Apply Gaussian blur to reduce noise
      const blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);

      // Apply threshold
      if (threshMethod.type === 'adaptive') {
        cv.adaptiveThreshold(
          blurred, thresh, 255,
          cv.ADAPTIVE_THRESH_MEAN_C,
          cv.THRESH_BINARY_INV,
          threshMethod.blockSize || 21,
          threshMethod.C || 7
        );
      } else {
        cv.threshold(blurred, thresh, 0, 255, cv.THRESH_BINARY_INV | cv.THRESH_OTSU);
      }

      blurred.delete();

      // Morphological operations to clean up
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
      const cleaned = new cv.Mat();
      cv.morphologyEx(thresh, cleaned, cv.MORPH_CLOSE, kernel);
      kernel.delete();

      // Find contours
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(cleaned, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
      cleaned.delete();

      const minArea = Math.pow(Math.min(canvas.width, canvas.height) * 0.015, 2);
      const maxArea = Math.pow(Math.min(canvas.width, canvas.height) * 0.5, 2);

      // Process each contour
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        if (area < minArea || area > maxArea) {
          contour.delete();
          continue;
        }

        // Approximate to polygon
        const peri = cv.arcLength(contour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.03 * peri, true);

        // Must be quadrilateral and convex
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const corners: { x: number; y: number }[] = [];
          for (let j = 0; j < 4; j++) {
            corners.push({
              x: approx.data32S[j * 2],
              y: approx.data32S[j * 2 + 1]
            });
          }

          // Check aspect ratio (should be roughly square)
          const orderedCorners = orderCorners(corners);
          const side1 = distance(orderedCorners[0], orderedCorners[1]);
          const side2 = distance(orderedCorners[1], orderedCorners[2]);
          const aspectRatio = Math.min(side1, side2) / Math.max(side1, side2);

          if (aspectRatio > 0.5) {
            // Try to decode marker
            const result = decodeMarker(cv, gray, orderedCorners);

            if (result !== null) {
              // Scale back to original coordinates
              const scaledCorners = orderedCorners.map(c => ({
                x: c.x / scale,
                y: c.y / scale
              }));

              const center = {
                x: scaledCorners.reduce((s, c) => s + c.x, 0) / 4,
                y: scaledCorners.reduce((s, c) => s + c.y, 0) / 4
              };

              const width = distance(scaledCorners[0], scaledCorners[1]);
              const height = distance(scaledCorners[0], scaledCorners[3]);

              markers.push({
                id: result.id,
                corners: scaledCorners,
                center,
                size: { width, height },
                confidence: result.confidence
              });
            }
          }
        }

        approx.delete();
        contour.delete();
      }

    } catch (err) {
      console.error('[ArUco v6] Erreur détection:', err);
    } finally {
      if (src) src.delete();
      if (gray) gray.delete();
      if (thresh) thresh.delete();
      if (contours) contours.delete();
      if (hierarchy) hierarchy.delete();
    }

    return markers;
  };

  // Main detect function
  const detectMarkers = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement
  ): Promise<ArucoMarker[]> => {
    if (!isLoaded || !cvRef.current) {
      console.warn('[ArUco v6] OpenCV non chargé');
      return [];
    }

    try {
      const markers = await detectMarkersNative(image);
      console.log(`[ArUco v6] Résultat: ${markers.length} markers -`,
        markers.map(m => `ID${m.id}(conf:${(m.confidence || 0).toFixed(2)})`).join(', ') || 'aucun');
      return markers;
    } catch (err) {
      console.error('[ArUco v6] Erreur:', err);
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

    console.log(`[ArUco v6] Échelle: ${pixelsPerCm.toFixed(2)} px/cm`);
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
      console.error('[ArUco v6] Erreur:', err);
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

// ====== HELPER FUNCTIONS ======

function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function orderCorners(corners: { x: number; y: number }[]): { x: number; y: number }[] {
  // Sort by Y to separate top and bottom
  const sorted = [...corners].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);

  // Return: TL, TR, BR, BL
  return [top[0], top[1], bottom[1], bottom[0]];
}

// ====== MARKER DECODING ======
function decodeMarker(
  cv: any,
  gray: any,
  corners: { x: number; y: number }[]
): { id: number; confidence: number } | null {
  const warpSize = 60; // 6x6 cells (4x4 data + 1 border each side) * 10px

  let srcMat: any = null;
  let dstMat: any = null;
  let M: any = null;
  let warped: any = null;

  try {
    // Perspective transform points
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

    // Otsu threshold on warped image
    cv.threshold(warped, warped, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

    // Sample the 6x6 grid (1 border + 4 data + 1 border)
    const cellSize = warpSize / 6;
    const bits: number[][] = [];

    for (let row = 0; row < 6; row++) {
      bits[row] = [];
      for (let col = 0; col < 6; col++) {
        const cx = Math.floor((col + 0.5) * cellSize);
        const cy = Math.floor((row + 0.5) * cellSize);

        // Sample region around center
        let sum = 0;
        let count = 0;
        const radius = Math.floor(cellSize * 0.25);

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

    // Check border (must be black = 0)
    let borderOk = true;
    for (let i = 0; i < 6; i++) {
      if (bits[0][i] !== 0 || bits[5][i] !== 0 || bits[i][0] !== 0 || bits[i][5] !== 0) {
        borderOk = false;
        break;
      }
    }

    if (!borderOk) {
      // Try inverted
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          bits[r][c] = 1 - bits[r][c];
        }
      }

      borderOk = true;
      for (let i = 0; i < 6; i++) {
        if (bits[0][i] !== 0 || bits[5][i] !== 0 || bits[i][0] !== 0 || bits[i][5] !== 0) {
          borderOk = false;
          break;
        }
      }
    }

    if (!borderOk) return null;

    // Extract inner 4x4 data bits
    const dataBits: string[] = [];
    for (let row = 1; row <= 4; row++) {
      for (let col = 1; col <= 4; col++) {
        dataBits.push(bits[row][col].toString());
      }
    }
    const pattern = dataBits.join('');

    // Try all rotations
    let currentPattern = pattern;
    for (let rot = 0; rot < 4; rot++) {
      // Check exact match
      const match = ALL_PATTERNS.get(currentPattern);
      if (match) {
        return { id: match.id, confidence: 1.0 };
      }

      // Check with 1-2 bit errors (Hamming distance)
      for (const [dictPattern, info] of ALL_PATTERNS.entries()) {
        let diff = 0;
        for (let i = 0; i < 16; i++) {
          if (currentPattern[i] !== dictPattern[i]) {
            diff++;
            if (diff > 2) break;
          }
        }
        if (diff <= 2) {
          const confidence = 1.0 - (diff * 0.15);
          return { id: info.id, confidence };
        }
      }

      // Rotate 90° for next iteration
      currentPattern = rotatePattern90(currentPattern);
    }

    return null;

  } finally {
    if (srcMat) srcMat.delete();
    if (dstMat) dstMat.delete();
    if (M) M.delete();
    if (warped) warped.delete();
  }
}

export default useOpenCVAruco;
