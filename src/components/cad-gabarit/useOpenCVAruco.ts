// ============================================
// HOOK: useOpenCVAruco
// Détection ArUco 100% JavaScript (sans OpenCV)
// VERSION: 10.0 - Fixed detection algorithm
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
  detectMarkers: (image: HTMLImageElement | HTMLCanvasElement) => Promise<ArucoMarker[]>;
  calculateScale: (markers: ArucoMarker[], markerSizeCm: number) => number | null;
  correctPerspective: (
    image: HTMLImageElement | HTMLCanvasElement,
    markers: ArucoMarker[],
  ) => Promise<ImageData | null>;
  calibrateCamera: (
    images: (HTMLImageElement | HTMLCanvasElement)[],
    patternSize: { width: number; height: number },
  ) => Promise<null>;
  undistortImage: (image: HTMLImageElement | HTMLCanvasElement, calibration: unknown) => Promise<ImageData | null>;
  processImage: (
    image: HTMLImageElement | HTMLCanvasElement,
    options?: { markerSizeCm?: number; correctPerspective?: boolean },
  ) => Promise<CalibrationResult>;
}

export function useOpenCVAruco(options: UseOpenCVArucoOptions = {}): UseOpenCVArucoReturn {
  const { markerSizeCm = 10 } = options;

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
      setIsLoading(false);
      console.log("[ArUco v10] Pure JS detector ready");
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const detectMarkers = useCallback(
    async (image: HTMLImageElement | HTMLCanvasElement): Promise<ArucoMarker[]> => {
      if (!isLoaded) return [];

      const w = image.width || (image as HTMLImageElement).naturalWidth;
      const h = image.height || (image as HTMLImageElement).naturalHeight;

      console.log(`[ArUco v10] Detecting in ${w}x${h} image`);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return [];

      // Process at higher resolution for better detection
      const maxDim = 1200;
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

      console.log(`[ArUco v10] Found ${markers.length} markers`);
      return markers;
    },
    [isLoaded],
  );

  const calculateScale = useCallback((markers: ArucoMarker[], markerSizeCm: number): number | null => {
    if (markers.length === 0) return null;
    const sizes = markers.map((m) => (m.size.width + m.size.height) / 2);
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    return avgSize / markerSizeCm;
  }, []);

  const correctPerspective = useCallback(async () => null, []);
  const calibrateCamera = useCallback(async () => null, []);
  const undistortImage = useCallback(async () => null, []);

  const processImage = useCallback(
    async (
      image: HTMLImageElement | HTMLCanvasElement,
      opts: { markerSizeCm?: number } = {},
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
    [markerSizeCm, detectMarkers, calculateScale],
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
    gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }

  return gray;
}

// Global threshold (Otsu-style)
function globalThreshold(gray: Uint8Array): Uint8Array {
  // Calculate histogram
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    hist[gray[i]]++;
  }

  // Otsu's method
  const total = gray.length;
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

  const result = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    result[i] = gray[i] > threshold ? 255 : 0;
  }

  return result;
}

function adaptiveThreshold(gray: Uint8Array, width: number, height: number, blockSize: number, C: number): Uint8Array {
  const result = new Uint8Array(gray.length);
  const halfBlock = Math.floor(blockSize / 2);

  // Integral image
  const integral = new Float64Array((width + 1) * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + rowSum;
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

      // White where pixel is darker than local mean minus C
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

function findContours(binary: Uint8Array, width: number, height: number): Point[][] {
  const contours: Point[][] = [];
  const visited = new Uint8Array(binary.length);

  // Moore boundary tracing
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      // Start of contour: white pixel with black to the left, not yet visited
      if (binary[idx] === 255 && binary[idx - 1] === 0 && !visited[idx]) {
        const contour = traceContourMoore(binary, width, height, x, y, visited);
        if (contour.length >= 20) {
          contours.push(contour);
        }
      }
    }
  }

  return contours;
}

function traceContourMoore(
  binary: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Uint8Array,
): Point[] {
  const contour: Point[] = [];

  // 8-connected neighbors (clockwise from right)
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  let x = startX;
  let y = startY;
  let dir = 0; // Start looking to the right

  const maxSteps = 50000;
  let steps = 0;
  let firstX = x;
  let firstY = y;
  let startDir = 0;
  let firstMove = true;

  do {
    contour.push({ x, y });
    visited[y * width + x] = 1;

    // Look for next boundary pixel (start from backtrack direction)
    let found = false;
    const searchStart = (dir + 5) % 8; // Start from dir - 3

    for (let i = 0; i < 8; i++) {
      const newDir = (searchStart + i) % 8;
      const nx = x + dx[newDir];
      const ny = y + dy[newDir];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (binary[ny * width + nx] === 255) {
          if (firstMove) {
            firstMove = false;
            startDir = newDir;
          }
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
  } while (steps < maxSteps && !(x === firstX && y === firstY && contour.length > 4));

  return contour;
}

// ====== POLYGON APPROXIMATION ======

function approxPolyDP(contour: Point[], epsilon: number): Point[] {
  if (contour.length < 3) return contour;

  // Find the two farthest points
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

  // Split contour at these points and simplify each part
  const part1 = contour.slice(idx1, idx2 + 1);
  const part2 = [...contour.slice(idx2), ...contour.slice(0, idx1 + 1)];

  const simp1 = douglasPeucker(part1, epsilon);
  const simp2 = douglasPeucker(part2, epsilon);

  // Merge results
  const result = [...simp1.slice(0, -1), ...simp2.slice(0, -1)];
  return result;
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
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;

  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
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

    if (Math.abs(cross) < 1e-6) continue; // Skip near-zero crosses

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
  // Find centroid
  const cx = corners.reduce((s, c) => s + c.x, 0) / 4;
  const cy = corners.reduce((s, c) => s + c.y, 0) / 4;

  // Sort by angle
  const sorted = [...corners].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });

  // Find top-left (smallest x + y sum)
  let minSum = Infinity;
  let tlIdx = 0;
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < minSum) {
      minSum = sum;
      tlIdx = i;
    }
  }

  // Reorder starting from top-left
  const result: Point[] = [];
  for (let i = 0; i < 4; i++) {
    result.push(sorted[(tlIdx + i) % 4]);
  }

  return result;
}

// ====== MARKER DETECTION ======

function findMarkersInImage(gray: Uint8Array, width: number, height: number, scale: number): ArucoMarker[] {
  const markers: ArucoMarker[] = [];
  const seenPatterns = new Set<string>();

  // Multiple threshold strategies
  const strategies = [
    // Adaptive thresholds
    { type: "adaptive", blockSize: 15, C: 5 },
    { type: "adaptive", blockSize: 21, C: 7 },
    { type: "adaptive", blockSize: 31, C: 10 },
    { type: "adaptive", blockSize: 45, C: 12 },
    { type: "adaptive", blockSize: 61, C: 15 },
    // Global threshold
    { type: "global" },
  ];

  const minDim = Math.min(width, height);
  const minArea = Math.pow(minDim * 0.015, 2);
  const maxArea = Math.pow(minDim * 0.4, 2);

  console.log(`[ArUco v10] Min area: ${minArea.toFixed(0)}, Max area: ${maxArea.toFixed(0)}`);

  for (const strategy of strategies) {
    let binary: Uint8Array;

    if (strategy.type === "global") {
      binary = globalThreshold(gray);
      console.log(`[ArUco v10] Global threshold`);
    } else {
      binary = adaptiveThreshold(gray, width, height, strategy.blockSize!, strategy.C!);
      console.log(`[ArUco v10] Adaptive: blockSize=${strategy.blockSize}, C=${strategy.C}`);
    }

    // Also try inverted
    const binaryInv = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      binaryInv[i] = binary[i] === 255 ? 0 : 255;
    }

    for (const bin of [binary, binaryInv]) {
      const contours = findContours(bin, width, height);
      console.log(`[ArUco v10] ${contours.length} contours found`);

      let quadCount = 0;
      let validQuadCount = 0;

      for (const contour of contours) {
        const area = contourArea(contour);
        if (area < minArea || area > maxArea) continue;

        const perimeter = contour.reduce((sum, p, i, arr) => {
          const next = arr[(i + 1) % arr.length];
          return sum + distance(p, next);
        }, 0);

        const epsilon = 0.02 * perimeter;
        const approx = approxPolyDP(contour, epsilon);

        if (approx.length === 4) {
          quadCount++;

          if (isConvex(approx)) {
            validQuadCount++;

            const ordered = orderCorners(approx);

            // Check aspect ratio
            const side1 = distance(ordered[0], ordered[1]);
            const side2 = distance(ordered[1], ordered[2]);
            const side3 = distance(ordered[2], ordered[3]);
            const side4 = distance(ordered[3], ordered[0]);

            const avgWidth = (side1 + side3) / 2;
            const avgHeight = (side2 + side4) / 2;
            const ratio = Math.min(avgWidth, avgHeight) / Math.max(avgWidth, avgHeight);

            if (ratio > 0.6) {
              // Try to decode marker
              const result = decodeMarker(gray, width, height, ordered);

              if (result !== null) {
                // Create unique key for this pattern
                const patternKey = `${result.pattern}-${Math.round(ordered[0].x / 10)}-${Math.round(ordered[0].y / 10)}`;

                if (!seenPatterns.has(patternKey)) {
                  seenPatterns.add(patternKey);

                  // Scale back to original coordinates
                  const scaledCorners = ordered.map((c) => ({
                    x: c.x / scale,
                    y: c.y / scale,
                  }));

                  const center = {
                    x: scaledCorners.reduce((s, c) => s + c.x, 0) / 4,
                    y: scaledCorners.reduce((s, c) => s + c.y, 0) / 4,
                  };

                  const markerWidth =
                    (distance(scaledCorners[0], scaledCorners[1]) + distance(scaledCorners[2], scaledCorners[3])) / 2;
                  const markerHeight =
                    (distance(scaledCorners[1], scaledCorners[2]) + distance(scaledCorners[3], scaledCorners[0])) / 2;

                  // Check for spatial duplicates
                  const isDuplicate = markers.some(
                    (m) =>
                      Math.abs(m.center.x - center.x) < markerWidth * 0.2 &&
                      Math.abs(m.center.y - center.y) < markerHeight * 0.2,
                  );

                  if (!isDuplicate) {
                    markers.push({
                      id: result.id,
                      corners: scaledCorners,
                      center,
                      size: { width: markerWidth, height: markerHeight },
                      confidence: result.confidence,
                    });

                    console.log(
                      `[ArUco v10] ✓ Marker ID=${result.id} at (${center.x.toFixed(0)}, ${center.y.toFixed(0)})`,
                    );
                  }
                }
              }
            }
          }
        }
      }

      console.log(`[ArUco v10] Quads: ${quadCount}, Valid: ${validQuadCount}`);
    }

    if (markers.length >= 4) {
      console.log(`[ArUco v10] Found enough markers, stopping early`);
      break;
    }
  }

  return markers;
}

function decodeMarker(
  gray: Uint8Array,
  width: number,
  height: number,
  corners: Point[],
): { id: number; pattern: string; confidence: number } | null {
  // Sample the marker region - 7x7 grid (5x5 data + 1px border)
  const gridSize = 7;

  const bits: number[][] = [];

  for (let row = 0; row < gridSize; row++) {
    bits[row] = [];
    for (let col = 0; col < gridSize; col++) {
      // Sample point at cell center
      const u = (col + 0.5) / gridSize;
      const v = (row + 0.5) / gridSize;

      // Bilinear interpolation for position
      const x = bilinearInterp(corners, u, v, "x");
      const y = bilinearInterp(corners, u, v, "y");

      // Sample multiple points for robustness
      let sum = 0;
      let count = 0;
      const sampleRadius = 2;

      for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
        for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
          const px = Math.round(x + dx);
          const py = Math.round(y + dy);

          if (px >= 0 && px < width && py >= 0 && py < height) {
            sum += gray[py * width + px];
            count++;
          }
        }
      }

      const avgValue = count > 0 ? sum / count : 128;
      bits[row][col] = avgValue > 127 ? 1 : 0;
    }
  }

  // Check if border is black (0)
  let borderBlackCount = 0;
  let borderTotal = 0;

  for (let i = 0; i < gridSize; i++) {
    // Top row
    if (bits[0][i] === 0) borderBlackCount++;
    borderTotal++;
    // Bottom row
    if (bits[gridSize - 1][i] === 0) borderBlackCount++;
    borderTotal++;
    // Left column (excluding corners)
    if (i > 0 && i < gridSize - 1) {
      if (bits[i][0] === 0) borderBlackCount++;
      borderTotal++;
      // Right column
      if (bits[i][gridSize - 1] === 0) borderBlackCount++;
      borderTotal++;
    }
  }

  const borderRatio = borderBlackCount / borderTotal;

  // Check inverted if border is mostly white
  if (borderRatio < 0.7) {
    // Invert bits
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        bits[r][c] = 1 - bits[r][c];
      }
    }

    // Recheck border
    borderBlackCount = 0;
    for (let i = 0; i < gridSize; i++) {
      if (bits[0][i] === 0) borderBlackCount++;
      if (bits[gridSize - 1][i] === 0) borderBlackCount++;
      if (i > 0 && i < gridSize - 1) {
        if (bits[i][0] === 0) borderBlackCount++;
        if (bits[i][gridSize - 1] === 0) borderBlackCount++;
      }
    }

    if (borderBlackCount / borderTotal < 0.7) {
      return null; // Neither orientation has black border
    }
  }

  // Extract inner 5x5 pattern
  let pattern = "";
  for (let row = 1; row <= 5; row++) {
    for (let col = 1; col <= 5; col++) {
      pattern += bits[row][col];
    }
  }

  // Generate consistent ID from pattern (rotation-invariant)
  const id = patternToId(pattern);

  return { id, pattern, confidence: borderRatio };
}

function bilinearInterp(corners: Point[], u: number, v: number, coord: "x" | "y"): number {
  // corners: [top-left, top-right, bottom-right, bottom-left]
  const tl = corners[0][coord];
  const tr = corners[1][coord];
  const br = corners[2][coord];
  const bl = corners[3][coord];

  const top = tl * (1 - u) + tr * u;
  const bottom = bl * (1 - u) + br * u;

  return top * (1 - v) + bottom * v;
}

function patternToId(pattern: string): number {
  // Get all 4 rotations
  const rotations = [pattern];
  let current = pattern;

  for (let i = 0; i < 3; i++) {
    current = rotate5x5Pattern(current);
    rotations.push(current);
  }

  // Use minimum rotation as canonical form
  const canonical = rotations.sort()[0];

  // Hash to ID (0-49 range for DICT_5X5_50)
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) - hash + canonical.charCodeAt(i)) | 0;
  }

  return Math.abs(hash) % 50;
}

function rotate5x5Pattern(pattern: string): string {
  const size = 5;
  const matrix: number[][] = [];

  for (let i = 0; i < size; i++) {
    matrix[i] = [];
    for (let j = 0; j < size; j++) {
      matrix[i][j] = parseInt(pattern[i * size + j]);
    }
  }

  // Rotate 90° clockwise
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
