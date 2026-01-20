// ============================================
// HOOK: useOpenCVAruco
// Détection ArUco 100% JavaScript (sans OpenCV)
// VERSION: 11.0 - Strict marker validation
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

// Known ArUco DICT_5X5_50 patterns (IDs 0-19)
// Each pattern is the 5x5 inner bits as a 25-character string
const ARUCO_5X5_50_PATTERNS: { [key: string]: number } = {
  "1010100001100100011111011": 0,
  "1101011101111011010001000": 1,
  "0011100101100111100010110": 2,
  "0100111001111110101000101": 3,
  "1110001011010011101101100": 4,
  "1001010111001010100111111": 5,
  "0111011111010010111001010": 6,
  "0000000011001011110011001": 7,
  "1010111001000011000100110": 8,
  "1101100101011010001110101": 9,
  "0011001101000110110100000": 10,
  "0100010001011111111110011": 11,
  "1110110011110110100010010": 12,
  "1001101111101111101000001": 13,
  "0111000111100111010110100": 14,
  "0000011011111110011100111": 15,
  "1111000100001100010011011": 16,
  "1000011000010101011001000": 17,
  "0110010000001101100011110": 18,
  "0001001100010100101001101": 19,
};

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
      console.log("[ArUco v11] Pure JS detector ready (strict mode)");
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

      console.log(`[ArUco v11] Detecting in ${w}x${h} image`);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return [];

      // Process at good resolution
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

      console.log(`[ArUco v11] Found ${markers.length} valid markers`);
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

  // Integral image for fast mean calculation
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
        if (contour.length >= 40) {
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

  // Threshold strategies focused on high contrast markers
  const strategies = [
    { blockSize: 25, C: 10 },
    { blockSize: 35, C: 12 },
    { blockSize: 45, C: 15 },
    { blockSize: 55, C: 18 },
  ];

  const minDim = Math.min(width, height);
  // ArUco markers should be reasonably sized
  const minArea = Math.pow(minDim * 0.03, 2);
  const maxArea = Math.pow(minDim * 0.25, 2);

  console.log(`[ArUco v11] Area range: ${minArea.toFixed(0)} - ${maxArea.toFixed(0)}`);

  for (const { blockSize, C } of strategies) {
    const binary = adaptiveThreshold(gray, width, height, blockSize, C);
    const contours = findContours(binary, width, height);

    console.log(`[ArUco v11] blockSize=${blockSize}, C=${C}: ${contours.length} contours`);

    for (const contour of contours) {
      const area = contourArea(contour);
      if (area < minArea || area > maxArea) continue;

      const perimeter = contour.reduce((sum, p, i, arr) => {
        return sum + distance(p, arr[(i + 1) % arr.length]);
      }, 0);

      // Check if roughly square (perimeter² / area ≈ 16)
      const squareness = (perimeter * perimeter) / area;
      if (squareness < 14 || squareness > 22) continue;

      const epsilon = 0.03 * perimeter;
      const approx = approxPolyDP(contour, epsilon);

      if (approx.length !== 4) continue;
      if (!isConvex(approx)) continue;

      const ordered = orderCorners(approx);

      // Check aspect ratio
      const side1 = distance(ordered[0], ordered[1]);
      const side2 = distance(ordered[1], ordered[2]);
      const side3 = distance(ordered[2], ordered[3]);
      const side4 = distance(ordered[3], ordered[0]);

      const sides = [side1, side2, side3, side4];
      const minSide = Math.min(...sides);
      const maxSide = Math.max(...sides);
      const sideRatio = minSide / maxSide;

      if (sideRatio < 0.7) continue;

      // Try to decode marker (STRICT validation)
      const result = decodeMarkerStrict(gray, width, height, ordered);

      if (result !== null) {
        const center = {
          x: ordered.reduce((s, c) => s + c.x, 0) / 4,
          y: ordered.reduce((s, c) => s + c.y, 0) / 4,
        };

        // Check for duplicates
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
            `[ArUco v11] ✓ Marker ID=${result.id} (confidence=${result.confidence.toFixed(2)})`
          );
        }
      }
    }

    if (markers.length >= 6) break;
  }

  return markers;
}

function decodeMarkerStrict(
  gray: Uint8Array,
  width: number,
  height: number,
  corners: Point[]
): { id: number; confidence: number } | null {
  const gridSize = 7; // 5x5 data + border
  const cellValues: number[][] = [];

  // Sample each cell with multiple points
  for (let row = 0; row < gridSize; row++) {
    cellValues[row] = [];
    for (let col = 0; col < gridSize; col++) {
      const samples: number[] = [];

      // Sample 7x7 points within each cell
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

  // Otsu threshold on cell values
  const allValues = cellValues.flat();
  const threshold = otsuThreshold(allValues);

  // Convert to binary
  const bits: number[][] = [];
  for (let row = 0; row < gridSize; row++) {
    bits[row] = [];
    for (let col = 0; col < gridSize; col++) {
      bits[row][col] = cellValues[row][col] > threshold ? 1 : 0;
    }
  }

  // Check border - MUST be black
  let borderBlackCount = 0;
  let borderTotal = 0;

  for (let i = 0; i < gridSize; i++) {
    borderTotal += 4;
    if (bits[0][i] === 0) borderBlackCount++;
    if (bits[gridSize - 1][i] === 0) borderBlackCount++;
    if (i > 0 && i < gridSize - 1) {
      if (bits[i][0] === 0) borderBlackCount++;
      if (bits[i][gridSize - 1] === 0) borderBlackCount++;
    } else {
      borderTotal -= 2;
    }
  }

  let borderScore = borderBlackCount / borderTotal;

  // Try inverted if border is white
  if (borderScore < 0.85) {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        bits[r][c] = 1 - bits[r][c];
      }
    }

    borderBlackCount = 0;
    for (let i = 0; i < gridSize; i++) {
      if (bits[0][i] === 0) borderBlackCount++;
      if (bits[gridSize - 1][i] === 0) borderBlackCount++;
      if (i > 0 && i < gridSize - 1) {
        if (bits[i][0] === 0) borderBlackCount++;
        if (bits[i][gridSize - 1] === 0) borderBlackCount++;
      }
    }

    borderScore = borderBlackCount / borderTotal;

    if (borderScore < 0.85) {
      return null; // No solid black border
    }
  }

  // Extract inner 5x5 pattern
  let pattern = "";
  for (let row = 1; row <= 5; row++) {
    for (let col = 1; col <= 5; col++) {
      pattern += bits[row][col];
    }
  }

  // Check all 4 rotations against known patterns
  let matchedId = -1;
  let currentPattern = pattern;

  for (let rot = 0; rot < 4; rot++) {
    if (ARUCO_5X5_50_PATTERNS[currentPattern] !== undefined) {
      matchedId = ARUCO_5X5_50_PATTERNS[currentPattern];
      break;
    }
    currentPattern = rotate5x5(currentPattern);
  }

  // Try with 1-bit error tolerance if no exact match
  if (matchedId === -1) {
    currentPattern = pattern;
    for (let rot = 0; rot < 4; rot++) {
      const match = findClosestPattern(currentPattern, 1);
      if (match !== null) {
        matchedId = match.id;
        break;
      }
      currentPattern = rotate5x5(currentPattern);
    }
  }

  if (matchedId === -1) {
    return null;
  }

  // Check contrast
  const innerValues: number[] = [];
  for (let row = 1; row <= 5; row++) {
    for (let col = 1; col <= 5; col++) {
      innerValues.push(cellValues[row][col]);
    }
  }

  const minInner = Math.min(...innerValues);
  const maxInner = Math.max(...innerValues);
  const contrast = (maxInner - minInner) / 255;

  if (contrast < 0.3) {
    return null;
  }

  const confidence = borderScore * (0.5 + contrast * 0.5);

  return { id: matchedId, confidence };
}

function findClosestPattern(
  pattern: string,
  maxErrors: number
): { id: number; errors: number } | null {
  let bestMatch: { id: number; errors: number } | null = null;

  for (const [knownPattern, id] of Object.entries(ARUCO_5X5_50_PATTERNS)) {
    let errors = 0;
    for (let i = 0; i < 25; i++) {
      if (pattern[i] !== knownPattern[i]) errors++;
      if (errors > maxErrors) break;
    }

    if (errors <= maxErrors) {
      if (bestMatch === null || errors < bestMatch.errors) {
        bestMatch = { id, errors };
      }
    }
  }

  return bestMatch;
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

function rotate5x5(pattern: string): string {
  const size = 5;
  const matrix: number[][] = [];

  for (let i = 0; i < size; i++) {
    matrix[i] = [];
    for (let j = 0; j < size; j++) {
      matrix[i][j] = parseInt(pattern[i * size + j]);
    }
  }

  const rotated: number[][] = [];
  for (let i = 0; i < size; i++) {
    rotated[i] = [];
    for (let j = 0; j < size; j++) {
      rotated[i][j] = matrix[size - 1 - j][i];
    }
  }

  return rotated.flat().join("");
}

export default useOpenCVAruco;
