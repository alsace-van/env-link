// ============================================
// HOOK: useOpenCVAruco
// Détection ArUco 100% JavaScript (sans OpenCV)
// VERSION: 14.0 - More aggressive detection, don't stop early
// ============================================

import { useState, useCallback, useEffect } from "react";

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
  detectMarkers: (
    image: HTMLImageElement | HTMLCanvasElement
  ) => Promise<ArucoMarker[]>;
  calculateScale: (markers: ArucoMarker[], markerSizeCm: number) => number | null;
  correctPerspective: (
    image: HTMLImageElement | HTMLCanvasElement,
    markers: ArucoMarker[]
  ) => Promise<ImageData | null>;
  calibrateCamera: (
    images: (HTMLImageElement | HTMLCanvasElement)[],
    patternSize: { width: number; height: number }
  ) => Promise<null>;
  undistortImage: (
    image: HTMLImageElement | HTMLCanvasElement,
    calibration: unknown
  ) => Promise<ImageData | null>;
  processImage: (
    image: HTMLImageElement | HTMLCanvasElement,
    options?: { markerSizeCm?: number; correctPerspective?: boolean }
  ) => Promise<CalibrationResult>;
}

// ArUco DICT_4X4_50 - Exact patterns from generator
// Each entry: [row0, row1, row2, row3] where each row is 4 bits
const ARUCO_DICT_4X4_50: number[][] = [
  [0b0111, 0b1001, 0b0010, 0b1111], // ID 0
  [0b1010, 0b0011, 0b0111, 0b0100], // ID 1
  [0b1000, 0b1100, 0b0011, 0b1111], // ID 2
  [0b0010, 0b1101, 0b1000, 0b0110], // ID 3
  [0b0010, 0b0110, 0b1110, 0b0001], // ID 4
  [0b0010, 0b1111, 0b1100, 0b1100], // ID 5
  [0b1100, 0b1100, 0b1011, 0b0001], // ID 6
  [0b1101, 0b0010, 0b1100, 0b0111], // ID 7
  [0b0111, 0b0001, 0b1110, 0b0011], // ID 8
  [0b1011, 0b1011, 0b0100, 0b0110], // ID 9
  [0b0001, 0b0100, 0b0101, 0b1110], // ID 10
  [0b1010, 0b0100, 0b1100, 0b1001], // ID 11
  [0b0111, 0b1111, 0b0100, 0b0001], // ID 12
  [0b1100, 0b0101, 0b0001, 0b1110], // ID 13
  [0b0101, 0b0110, 0b0001, 0b0111], // ID 14
  [0b0110, 0b1010, 0b0011, 0b0010], // ID 15
  [0b1110, 0b0101, 0b1100, 0b0101], // ID 16
  [0b0100, 0b0100, 0b1111, 0b1011], // ID 17
  [0b1001, 0b0010, 0b0001, 0b0101], // ID 18
  [0b0001, 0b1011, 0b0010, 0b0011], // ID 19
  [0b1111, 0b1100, 0b1111, 0b0100], // ID 20
  [0b1010, 0b1111, 0b1001, 0b0010], // ID 21
  [0b0011, 0b0111, 0b1010, 0b1001], // ID 22
  [0b1000, 0b1101, 0b1111, 0b0011], // ID 23
  [0b1011, 0b0111, 0b1011, 0b0011], // ID 24
  [0b0000, 0b0100, 0b0010, 0b1000], // ID 25
  [0b1100, 0b0011, 0b1101, 0b1101], // ID 26
  [0b1110, 0b1001, 0b1010, 0b0001], // ID 27
  [0b1111, 0b0110, 0b1101, 0b1010], // ID 28
  [0b1101, 0b1001, 0b1001, 0b1111], // ID 29
  [0b0101, 0b1000, 0b0110, 0b1001], // ID 30
  [0b0011, 0b1110, 0b1110, 0b0110], // ID 31
  [0b0110, 0b0000, 0b1011, 0b1110], // ID 32
  [0b0101, 0b0001, 0b0100, 0b0000], // ID 33
  [0b1001, 0b1111, 0b0110, 0b0000], // ID 34
  [0b1001, 0b0110, 0b0000, 0b0111], // ID 35
  [0b0100, 0b1110, 0b1000, 0b0100], // ID 36
  [0b0000, 0b1001, 0b1100, 0b1110], // ID 37
  [0b1110, 0b0000, 0b0110, 0b1100], // ID 38
  [0b1100, 0b1000, 0b0101, 0b0110], // ID 39
  [0b1010, 0b1000, 0b1110, 0b1111], // ID 40
  [0b0100, 0b0010, 0b1010, 0b0110], // ID 41
  [0b1001, 0b1000, 0b1000, 0b1000], // ID 42
  [0b0110, 0b0101, 0b1111, 0b0000], // ID 43
  [0b0100, 0b1011, 0b0110, 0b1101], // ID 44
  [0b0000, 0b0000, 0b0100, 0b0101], // ID 45
  [0b1000, 0b0111, 0b0111, 0b1001], // ID 46
  [0b0011, 0b0010, 0b1000, 0b1100], // ID 47
  [0b1011, 0b0000, 0b0001, 0b1010], // ID 48
  [0b0001, 0b0111, 0b1101, 0b1000], // ID 49
];

export function useOpenCVAruco(
  options: UseOpenCVArucoOptions = {}
): UseOpenCVArucoReturn {
  const { markerSizeCm = 10 } = options;

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
      setIsLoading(false);
      console.log("[ArUco v14] Pure JS detector ready (DICT_4X4_50)");
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const detectMarkers = useCallback(
    async (
      image: HTMLImageElement | HTMLCanvasElement
    ): Promise<ArucoMarker[]> => {
      if (!isLoaded) return [];

      const w = image.width || (image as HTMLImageElement).naturalWidth;
      const h = image.height || (image as HTMLImageElement).naturalHeight;

      console.log(`[ArUco v14] Detecting in ${w}x${h} image`);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return [];

      const maxDim = 1400;
      let scale = 1;
      if (Math.max(w, h) > maxDim) {
        scale = maxDim / Math.max(w, h);
      }

      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const gray = toGrayscale(imageData);

      const markers = findMarkersInImage(gray, canvas.width, canvas.height, scale);

      console.log(`[ArUco v14] Found ${markers.length} valid markers`);
      return markers;
    },
    [isLoaded]
  );

  const calculateScale = useCallback(
    (markers: ArucoMarker[], markerSizeCm: number): number | null => {
      if (markers.length === 0) return null;
      const sizes = markers.map((m) => (m.size.width + m.size.height) / 2);
      const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      return avgSize / markerSizeCm;
    },
    []
  );

  const correctPerspective = useCallback(async () => null, []);
  const calibrateCamera = useCallback(async () => null, []);
  const undistortImage = useCallback(async () => null, []);

  const processImage = useCallback(
    async (
      image: HTMLImageElement | HTMLCanvasElement,
      opts: { markerSizeCm?: number } = {}
    ): Promise<CalibrationResult> => {
      const { markerSizeCm: size = markerSizeCm } = opts;
      const result: CalibrationResult = {
        markersDetected: [],
        pixelsPerCm: null,
        homographyMatrix: null,
        correctedImageData: null,
      };

      result.markersDetected = await detectMarkers(image);
      if (result.markersDetected.length > 0) {
        result.pixelsPerCm = calculateScale(result.markersDetected, size);
      }

      return result;
    },
    [markerSizeCm, detectMarkers, calculateScale]
  );

  return {
    isLoaded,
    isLoading,
    error,
    detectMarkers,
    calculateScale,
    correctPerspective,
    calibrateCamera,
    undistortImage,
    processImage,
  };
}

// ====== IMAGE PROCESSING ======

function toGrayscale(imageData: ImageData): Uint8Array {
  const gray = new Uint8Array(imageData.width * imageData.height);
  const data = imageData.data;

  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = Math.round(
      0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
    );
  }

  return gray;
}

function adaptiveThreshold(
  gray: Uint8Array,
  width: number,
  height: number,
  blockSize: number,
  C: number
): Uint8Array {
  const result = new Uint8Array(gray.length);
  const halfBlock = Math.floor(blockSize / 2);

  const integral = new Float64Array((width + 1) * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * (width + 1) + (x + 1)] =
        integral[y * (width + 1) + (x + 1)] + rowSum;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - halfBlock);
      const y1 = Math.max(0, y - halfBlock);
      const x2 = Math.min(width - 1, x + halfBlock);
      const y2 = Math.min(height - 1, y + halfBlock);

      const area = (x2 - x1 + 1) * (y2 - y1 + 1);

      const sum =
        integral[(y2 + 1) * (width + 1) + (x2 + 1)] -
        integral[y1 * (width + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (width + 1) + x1] +
        integral[y1 * (width + 1) + x1];

      const mean = sum / area;
      const idx = y * width + x;

      result[idx] = gray[idx] < mean - C ? 255 : 0;
    }
  }

  return result;
}

// ====== CONTOUR DETECTION ======

interface Point {
  x: number;
  y: number;
}

function findContours(
  binary: Uint8Array,
  width: number,
  height: number
): Point[][] {
  const contours: Point[][] = [];
  const visited = new Uint8Array(binary.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      if (binary[idx] === 255 && binary[idx - 1] === 0 && !visited[idx]) {
        const contour = traceContour(binary, width, height, x, y, visited);
        if (contour.length >= 30) {
          contours.push(contour);
        }
      }
    }
  }

  return contours;
}

function traceContour(
  binary: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Uint8Array
): Point[] {
  const contour: Point[] = [];
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  let x = startX;
  let y = startY;
  let dir = 0;

  const maxSteps = 50000;
  let steps = 0;

  do {
    contour.push({ x, y });
    visited[y * width + x] = 1;

    let found = false;
    const searchStart = (dir + 5) % 8;

    for (let i = 0; i < 8; i++) {
      const newDir = (searchStart + i) % 8;
      const nx = x + dx[newDir];
      const ny = y + dy[newDir];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (binary[ny * width + nx] === 255) {
          x = nx;
          y = ny;
          dir = newDir;
          found = true;
          break;
        }
      }
    }

    if (!found) break;
    steps++;
  } while (steps < maxSteps && !(x === startX && y === startY && contour.length > 4));

  return contour;
}

// ====== POLYGON APPROXIMATION ======

function approxPolyDP(contour: Point[], epsilon: number): Point[] {
  if (contour.length < 4) return contour;

  let maxDist = 0;
  let idx1 = 0;
  let idx2 = 0;

  for (let i = 0; i < contour.length; i++) {
    for (let j = i + 1; j < contour.length; j++) {
      const d = distance(contour[i], contour[j]);
      if (d > maxDist) {
        maxDist = d;
        idx1 = i;
        idx2 = j;
      }
    }
  }

  const part1 = contour.slice(idx1, idx2 + 1);
  const part2 = [...contour.slice(idx2), ...contour.slice(0, idx1 + 1)];

  const simp1 = douglasPeucker(part1, epsilon);
  const simp2 = douglasPeucker(part2, epsilon);

  return [...simp1.slice(0, -1), ...simp2.slice(0, -1)];
}

function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;

  let maxDist = 0;
  let maxIdx = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return distance(p, a);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.sqrt((p.x - (a.x + t * dx)) ** 2 + (p.y - (a.y + t * dy)) ** 2);
}

function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// ====== QUAD VALIDATION ======

function isConvex(quad: Point[]): boolean {
  if (quad.length !== 4) return false;

  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p1 = quad[i];
    const p2 = quad[(i + 1) % 4];
    const p3 = quad[(i + 2) % 4];

    const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);

    if (Math.abs(cross) < 1e-6) continue;

    const s = cross > 0 ? 1 : -1;
    if (sign === 0) {
      sign = s;
    } else if (s !== sign) {
      return false;
    }
  }

  return sign !== 0;
}

function contourArea(contour: Point[]): number {
  let area = 0;
  for (let i = 0; i < contour.length; i++) {
    const j = (i + 1) % contour.length;
    area += contour[i].x * contour[j].y;
    area -= contour[j].x * contour[i].y;
  }
  return Math.abs(area) / 2;
}

function orderCorners(corners: Point[]): Point[] {
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

  const result: Point[] = [];
  for (let i = 0; i < 4; i++) {
    result.push(sorted[(tlIdx + i) % 4]);
  }

  return result;
}

// ====== MARKER DETECTION ======

function findMarkersInImage(
  gray: Uint8Array,
  width: number,
  height: number,
  scale: number
): ArucoMarker[] {
  const markers: ArucoMarker[] = [];
  const foundCenters: { x: number; y: number }[] = [];

  // Reset debug counter
  debugCounter = 0;

  // More threshold strategies for different lighting conditions
  const strategies = [
    { blockSize: 15, C: 5 },
    { blockSize: 21, C: 7 },
    { blockSize: 31, C: 10 },
    { blockSize: 41, C: 12 },
    { blockSize: 51, C: 15 },
    { blockSize: 61, C: 18 },
  ];

  const minDim = Math.min(width, height);
  // More permissive area range
  const minArea = Math.pow(minDim * 0.015, 2);  // Smaller minimum
  const maxArea = Math.pow(minDim * 0.4, 2);    // Larger maximum

  console.log(`[ArUco v14] Area range: ${minArea.toFixed(0)} - ${maxArea.toFixed(0)}`);

  for (const { blockSize, C } of strategies) {
    const binary = adaptiveThreshold(gray, width, height, blockSize, C);
    const contours = findContours(binary, width, height);

    console.log(`[ArUco v14] blockSize=${blockSize}, C=${C}: ${contours.length} contours`);

    for (const contour of contours) {
      const area = contourArea(contour);
      if (area < minArea || area > maxArea) continue;

      const perimeter = contour.reduce((sum, p, i, arr) => {
        return sum + distance(p, arr[(i + 1) % arr.length]);
      }, 0);

      const squareness = (perimeter * perimeter) / area;
      // More permissive squareness (perfect square = 16)
      if (squareness < 12 || squareness > 25) continue;

      const epsilon = 0.03 * perimeter;
      const approx = approxPolyDP(contour, epsilon);

      if (approx.length !== 4) continue;
      if (!isConvex(approx)) continue;

      const ordered = orderCorners(approx);

      const side1 = distance(ordered[0], ordered[1]);
      const side2 = distance(ordered[1], ordered[2]);
      const side3 = distance(ordered[2], ordered[3]);
      const side4 = distance(ordered[3], ordered[0]);

      const sides = [side1, side2, side3, side4];
      const minSide = Math.min(...sides);
      const maxSide = Math.max(...sides);
      const sideRatio = minSide / maxSide;

      // More permissive side ratio
      if (sideRatio < 0.4) continue;

      // Debug: log quad candidates
      if (debugCounter < MAX_DEBUG) {
        const avgSide = (side1 + side2 + side3 + side4) / 4;
        console.log(`[ArUco v14] Quad candidate: area=${area.toFixed(0)}, avgSide=${avgSide.toFixed(1)}, ratio=${sideRatio.toFixed(2)}`);
      }

      // Decode as 4x4 marker (6x6 grid with border)
      const result = decodeMarker4x4(gray, width, height, ordered);

      if (result !== null) {
        const center = {
          x: ordered.reduce((s, c) => s + c.x, 0) / 4,
          y: ordered.reduce((s, c) => s + c.y, 0) / 4,
        };

        const isDuplicate = foundCenters.some(
          (fc) =>
            Math.abs(fc.x - center.x) < minSide * 0.3 &&
            Math.abs(fc.y - center.y) < minSide * 0.3
        );

        if (!isDuplicate) {
          foundCenters.push(center);

          const scaledCorners = ordered.map((c) => ({
            x: c.x / scale,
            y: c.y / scale,
          }));

          const scaledCenter = {
            x: center.x / scale,
            y: center.y / scale,
          };

          const markerSize = ((side1 + side2 + side3 + side4) / 4) / scale;

          markers.push({
            id: result.id,
            corners: scaledCorners,
            center: scaledCenter,
            size: { width: markerSize, height: markerSize },
            confidence: result.confidence,
          });

          console.log(
            `[ArUco v14] ✓ Marker ID=${result.id} (confidence=${result.confidence.toFixed(2)})`
          );
        }
      }
    }

    // Don't stop early - continue searching through all strategies
    // if (markers.length >= 8) break;
  }

  console.log(`[ArUco v14] Total markers found: ${markers.length}`);
  return markers;
}

// Counter for debug logging (limit output)
let debugCounter = 0;
const MAX_DEBUG = 5;

function decodeMarker4x4(
  gray: Uint8Array,
  width: number,
  height: number,
  corners: Point[]
): { id: number; confidence: number } | null {
  // 4x4 marker has 6x6 grid (1 cell border on each side)
  const gridSize = 6;
  const cellValues: number[][] = [];

  // Sample each cell using perspective transform
  for (let row = 0; row < gridSize; row++) {
    cellValues[row] = [];
    for (let col = 0; col < gridSize; col++) {
      const samples: number[] = [];

      // Sample 7x7 points within each cell for better accuracy
      for (let sy = 0; sy < 7; sy++) {
        for (let sx = 0; sx < 7; sx++) {
          const u = (col + (sx + 0.5) / 7) / gridSize;
          const v = (row + (sy + 0.5) / 7) / gridSize;

          const x = bilinearInterp(corners, u, v, "x");
          const y = bilinearInterp(corners, u, v, "y");

          const px = Math.round(x);
          const py = Math.round(y);

          if (px >= 0 && px < width && py >= 0 && py < height) {
            samples.push(gray[py * width + px]);
          }
        }
      }

      if (samples.length > 0) {
        samples.sort((a, b) => a - b);
        cellValues[row][col] = samples[Math.floor(samples.length / 2)];
      } else {
        cellValues[row][col] = 128;
      }
    }
  }

  // Otsu threshold
  const allValues = cellValues.flat();
  const threshold = otsuThreshold(allValues);

  // Convert to binary (white = 1, black = 0)
  const bits: number[][] = [];
  for (let row = 0; row < gridSize; row++) {
    bits[row] = [];
    for (let col = 0; col < gridSize; col++) {
      bits[row][col] = cellValues[row][col] > threshold ? 1 : 0;
    }
  }

  // Check border (should be black = 0)
  let borderBlackCount = 0;
  let borderTotal = 0;

  for (let i = 0; i < gridSize; i++) {
    if (bits[0][i] === 0) borderBlackCount++;
    borderTotal++;
    if (bits[gridSize - 1][i] === 0) borderBlackCount++;
    borderTotal++;
  }
  for (let i = 1; i < gridSize - 1; i++) {
    if (bits[i][0] === 0) borderBlackCount++;
    borderTotal++;
    if (bits[i][gridSize - 1] === 0) borderBlackCount++;
    borderTotal++;
  }

  let borderScore = borderBlackCount / borderTotal;
  let inverted = false;

  // Try inverted if border is mostly white (relaxed to 50%)
  if (borderScore < 0.5) {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        bits[r][c] = 1 - bits[r][c];
      }
    }
    inverted = true;

    borderBlackCount = 0;
    for (let i = 0; i < gridSize; i++) {
      if (bits[0][i] === 0) borderBlackCount++;
      if (bits[gridSize - 1][i] === 0) borderBlackCount++;
    }
    for (let i = 1; i < gridSize - 1; i++) {
      if (bits[i][0] === 0) borderBlackCount++;
      if (bits[i][gridSize - 1] === 0) borderBlackCount++;
    }

    borderScore = borderBlackCount / borderTotal;

    // Relaxed threshold (50%)
    if (borderScore < 0.5) {
      return null;
    }
  }

  // Extract inner 4x4 pattern
  const innerBits: number[] = [];
  for (let row = 1; row <= 4; row++) {
    for (let col = 1; col <= 4; col++) {
      innerBits.push(bits[row][col]);
    }
  }

  // Debug: log first few candidates
  if (debugCounter < MAX_DEBUG) {
    console.log(`[ArUco v14 DEBUG] Candidate quad - borderScore=${borderScore.toFixed(2)}, inverted=${inverted}`);
    console.log(`[ArUco v14 DEBUG] Inner bits: ${innerBits.join('')}`);
    debugCounter++;
  }

  // Try all 4 rotations with exact match
  for (let rotation = 0; rotation < 4; rotation++) {
    const rotatedBits = rotatePattern4x4(innerBits, rotation);
    const matchedId = matchPattern4x4(rotatedBits);

    if (matchedId !== -1) {
      const innerValues: number[] = [];
      for (let row = 1; row <= 4; row++) {
        for (let col = 1; col <= 4; col++) {
          innerValues.push(cellValues[row][col]);
        }
      }
      const minInner = Math.min(...innerValues);
      const maxInner = Math.max(...innerValues);
      const contrast = (maxInner - minInner) / 255;

      // Relaxed contrast threshold
      if (contrast < 0.15) {
        return null;
      }

      const confidence = borderScore * (0.5 + contrast * 0.5);
      console.log(`[ArUco v14] EXACT MATCH: ID=${matchedId}, rotation=${rotation}, contrast=${contrast.toFixed(2)}`);
      return { id: matchedId, confidence };
    }
  }

  // Try with 1-bit error tolerance
  for (let rotation = 0; rotation < 4; rotation++) {
    const rotatedBits = rotatePattern4x4(innerBits, rotation);
    const matchedId = matchPattern4x4WithTolerance(rotatedBits, 1);

    if (matchedId !== -1) {
      const innerValues: number[] = [];
      for (let row = 1; row <= 4; row++) {
        for (let col = 1; col <= 4; col++) {
          innerValues.push(cellValues[row][col]);
        }
      }
      const minInner = Math.min(...innerValues);
      const maxInner = Math.max(...innerValues);
      const contrast = (maxInner - minInner) / 255;

      if (contrast < 0.15) {
        return null;
      }

      const confidence = borderScore * (0.4 + contrast * 0.4);
      console.log(`[ArUco v14] 1-BIT MATCH: ID=${matchedId}, rotation=${rotation}, contrast=${contrast.toFixed(2)}`);
      return { id: matchedId, confidence };
    }
  }

  // Try with 2-bit error tolerance (more permissive)
  for (let rotation = 0; rotation < 4; rotation++) {
    const rotatedBits = rotatePattern4x4(innerBits, rotation);
    const matchedId = matchPattern4x4WithTolerance(rotatedBits, 2);

    if (matchedId !== -1) {
      const innerValues: number[] = [];
      for (let row = 1; row <= 4; row++) {
        for (let col = 1; col <= 4; col++) {
          innerValues.push(cellValues[row][col]);
        }
      }
      const minInner = Math.min(...innerValues);
      const maxInner = Math.max(...innerValues);
      const contrast = (maxInner - minInner) / 255;

      if (contrast < 0.15) {
        return null;
      }

      const confidence = borderScore * (0.3 + contrast * 0.3);
      console.log(`[ArUco v14] 2-BIT MATCH: ID=${matchedId}, rotation=${rotation}, contrast=${contrast.toFixed(2)}`);
      return { id: matchedId, confidence };
    }
  }

  // Try with 3-bit error tolerance (very permissive - use with caution)
  for (let rotation = 0; rotation < 4; rotation++) {
    const rotatedBits = rotatePattern4x4(innerBits, rotation);
    const matchedId = matchPattern4x4WithTolerance(rotatedBits, 3);

    if (matchedId !== -1) {
      const innerValues: number[] = [];
      for (let row = 1; row <= 4; row++) {
        for (let col = 1; col <= 4; col++) {
          innerValues.push(cellValues[row][col]);
        }
      }
      const minInner = Math.min(...innerValues);
      const maxInner = Math.max(...innerValues);
      const contrast = (maxInner - minInner) / 255;

      // Require higher contrast for 3-bit tolerance
      if (contrast < 0.25) {
        return null;
      }

      const confidence = borderScore * (0.2 + contrast * 0.2);
      console.log(`[ArUco v14] 3-BIT MATCH: ID=${matchedId}, rotation=${rotation}, contrast=${contrast.toFixed(2)}`);
      return { id: matchedId, confidence };
    }
  }

  return null;
}

function rotatePattern4x4(bits: number[], rotations: number): number[] {
  let result = [...bits];

  for (let r = 0; r < rotations; r++) {
    const rotated: number[] = new Array(16);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        rotated[col * 4 + (3 - row)] = result[row * 4 + col];
      }
    }
    result = rotated;
  }

  return result;
}

function matchPattern4x4(bits: number[]): number {
  for (let id = 0; id < 50; id++) {
    const pattern = ARUCO_DICT_4X4_50[id];
    let matches = true;

    for (let row = 0; row < 4 && matches; row++) {
      for (let col = 0; col < 4 && matches; col++) {
        const expectedBit = (pattern[row] >> (3 - col)) & 1;
        const actualBit = bits[row * 4 + col];
        if (expectedBit !== actualBit) {
          matches = false;
        }
      }
    }

    if (matches) {
      return id;
    }
  }

  return -1;
}

function matchPattern4x4WithTolerance(bits: number[], maxErrors: number): number {
  let bestId = -1;
  let bestErrors = maxErrors + 1;

  for (let id = 0; id < 50; id++) {
    const pattern = ARUCO_DICT_4X4_50[id];
    let errors = 0;

    for (let row = 0; row < 4 && errors <= maxErrors; row++) {
      for (let col = 0; col < 4 && errors <= maxErrors; col++) {
        const expectedBit = (pattern[row] >> (3 - col)) & 1;
        const actualBit = bits[row * 4 + col];
        if (expectedBit !== actualBit) {
          errors++;
        }
      }
    }

    if (errors < bestErrors) {
      bestErrors = errors;
      bestId = id;
    }
  }

  return bestErrors <= maxErrors ? bestId : -1;
}

function otsuThreshold(values: number[]): number {
  const hist = new Uint32Array(256);
  for (const v of values) {
    hist[Math.round(v)]++;
  }

  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;

    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];

    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const varBetween = wB * wF * (mB - mF) * (mB - mF);

    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }

  return threshold;
}

function bilinearInterp(
  corners: Point[],
  u: number,
  v: number,
  coord: "x" | "y"
): number {
  const tl = corners[0][coord];
  const tr = corners[1][coord];
  const br = corners[2][coord];
  const bl = corners[3][coord];

  const top = tl * (1 - u) + tr * u;
  const bottom = bl * (1 - u) + br * u;

  return top * (1 - v) + bottom * v;
}

export default useOpenCVAruco;
