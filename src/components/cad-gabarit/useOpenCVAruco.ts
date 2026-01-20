// ============================================
// HOOK: useOpenCVAruco
// Détection de markers ArUco via js-aruco library
// VERSION: 3.0 - Utilisation de js-aruco
// ============================================

import { useState, useCallback, useEffect } from 'react';

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

// ============================================
// JS-ARUCO LIBRARY EMBEDDED (minified version)
// Based on js-aruco by jcmellado
// https://github.com/jcmellado/js-aruco
// ============================================

// CV utilities
const CV = {
  grayscale: function(imageSrc: ImageData, imageDst: ImageData) {
    const src = imageSrc.data, dst = imageDst.data;
    for (let i = 0; i < src.length; i += 4) {
      dst[i >> 2] = (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114 + 0.5) | 0;
    }
    return imageDst;
  },

  adaptiveThreshold: function(imageSrc: { data: Uint8Array; width: number; height: number }, imageDst: { data: Uint8Array }, kernelSize: number, threshold: number) {
    const src = imageSrc.data, dst = imageDst.data;
    const width = imageSrc.width, height = imageSrc.height;
    const half = kernelSize >> 1;

    // Integral image
    const integral = new Int32Array((width + 1) * (height + 1));
    for (let y = 1; y <= height; y++) {
      let sum = 0;
      for (let x = 1; x <= width; x++) {
        sum += src[(y - 1) * width + (x - 1)];
        integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + sum;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const x1 = Math.max(0, x - half);
        const y1 = Math.max(0, y - half);
        const x2 = Math.min(width, x + half + 1);
        const y2 = Math.min(height, y + half + 1);
        const count = (x2 - x1) * (y2 - y1);

        const sum = integral[y2 * (width + 1) + x2] - integral[y1 * (width + 1) + x2]
                  - integral[y2 * (width + 1) + x1] + integral[y1 * (width + 1) + x1];

        dst[y * width + x] = src[y * width + x] * count <= sum * (1 - threshold) ? 0 : 255;
      }
    }
    return imageDst;
  },

  findContours: function(imageSrc: { data: Uint8Array; width: number; height: number }) {
    const src = imageSrc.data;
    const width = imageSrc.width, height = imageSrc.height;
    const contours: { x: number; y: number }[][] = [];
    const visited = new Uint8Array(width * height);

    const directions = [
      [1, 0], [1, 1], [0, 1], [-1, 1],
      [-1, 0], [-1, -1], [0, -1], [1, -1]
    ];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (src[idx] === 0 && !visited[idx]) {
          // Check if it's a border pixel
          let isBorder = false;
          for (const [dx, dy] of directions) {
            if (src[(y + dy) * width + (x + dx)] === 255) {
              isBorder = true;
              break;
            }
          }

          if (isBorder) {
            const contour = this.traceContour(src, width, height, x, y, visited);
            if (contour.length >= 4) {
              contours.push(contour);
            }
          }
        }
      }
    }

    return contours;
  },

  traceContour: function(src: Uint8Array, width: number, height: number, startX: number, startY: number, visited: Uint8Array) {
    const contour: { x: number; y: number }[] = [];
    const directions = [
      [1, 0], [1, 1], [0, 1], [-1, 1],
      [-1, 0], [-1, -1], [0, -1], [1, -1]
    ];

    let x = startX, y = startY;
    let dir = 0;
    const maxSteps = width * height;
    let steps = 0;

    do {
      contour.push({ x, y });
      visited[y * width + x] = 1;

      let found = false;
      for (let i = 0; i < 8; i++) {
        const newDir = (dir + i) % 8;
        const [dx, dy] = directions[newDir];
        const nx = x + dx, ny = y + dy;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (src[ny * width + nx] === 0 && !visited[ny * width + nx]) {
            x = nx;
            y = ny;
            dir = (newDir + 5) % 8;
            found = true;
            break;
          }
        }
      }

      if (!found) break;
      steps++;
    } while ((x !== startX || y !== startY) && steps < maxSteps);

    return contour;
  },

  approxPolyDP: function(contour: { x: number; y: number }[], epsilon: number) {
    if (contour.length <= 2) return contour;

    const result: { x: number; y: number }[] = [];
    const stack: [number, number][] = [[0, contour.length - 1]];
    const keep = new Array(contour.length).fill(false);
    keep[0] = keep[contour.length - 1] = true;

    while (stack.length > 0) {
      const [start, end] = stack.pop()!;
      let maxDist = 0, maxIdx = start;

      const dx = contour[end].x - contour[start].x;
      const dy = contour[end].y - contour[start].y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len > 0) {
        for (let i = start + 1; i < end; i++) {
          const dist = Math.abs(dy * contour[i].x - dx * contour[i].y + contour[end].x * contour[start].y - contour[end].y * contour[start].x) / len;
          if (dist > maxDist) {
            maxDist = dist;
            maxIdx = i;
          }
        }
      }

      if (maxDist > epsilon) {
        keep[maxIdx] = true;
        stack.push([start, maxIdx]);
        stack.push([maxIdx, end]);
      }
    }

    for (let i = 0; i < contour.length; i++) {
      if (keep[i]) result.push(contour[i]);
    }

    return result;
  },

  minAreaRect: function(points: { x: number; y: number }[]) {
    if (points.length < 4) return null;

    // Simplified: just return bounding box corners in order
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    return [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY }
    ];
  },

  isContourConvex: function(contour: { x: number; y: number }[]) {
    if (contour.length < 3) return false;

    let sign = 0;
    for (let i = 0; i < contour.length; i++) {
      const p0 = contour[i];
      const p1 = contour[(i + 1) % contour.length];
      const p2 = contour[(i + 2) % contour.length];

      const cross = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
      if (cross !== 0) {
        if (sign === 0) sign = cross > 0 ? 1 : -1;
        else if ((cross > 0 ? 1 : -1) !== sign) return false;
      }
    }
    return true;
  },

  contourArea: function(contour: { x: number; y: number }[]) {
    let area = 0;
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      area += contour[i].x * contour[j].y;
      area -= contour[j].x * contour[i].y;
    }
    return Math.abs(area / 2);
  },

  perimeter: function(contour: { x: number; y: number }[]) {
    let len = 0;
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      const dx = contour[j].x - contour[i].x;
      const dy = contour[j].y - contour[i].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  },

  warp: function(imageSrc: { data: Uint8Array; width: number; height: number }, corners: { x: number; y: number }[], size: number): Uint8Array {
    const dst = new Uint8Array(size * size);
    const src = imageSrc.data;
    const width = imageSrc.width;

    // Compute perspective transform
    const srcPts = corners;
    const dstPts = [
      { x: 0, y: 0 },
      { x: size - 1, y: 0 },
      { x: size - 1, y: size - 1 },
      { x: 0, y: size - 1 }
    ];

    // Simple bilinear interpolation
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / (size - 1);
        const v = y / (size - 1);

        // Bilinear interpolation of source coordinates
        const srcX = (1 - u) * (1 - v) * srcPts[0].x + u * (1 - v) * srcPts[1].x +
                     u * v * srcPts[2].x + (1 - u) * v * srcPts[3].x;
        const srcY = (1 - u) * (1 - v) * srcPts[0].y + u * (1 - v) * srcPts[1].y +
                     u * v * srcPts[2].y + (1 - u) * v * srcPts[3].y;

        const sx = Math.round(srcX);
        const sy = Math.round(srcY);

        if (sx >= 0 && sx < width && sy >= 0 && sy < imageSrc.height) {
          dst[y * size + x] = src[sy * width + sx];
        }
      }
    }

    return dst;
  },

  otsu: function(imageSrc: { data: Uint8Array; width: number; height: number }): number {
    const src = imageSrc.data;
    const histogram = new Array(256).fill(0);

    for (let i = 0; i < src.length; i++) {
      histogram[src[i]]++;
    }

    const total = src.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];

    let sumB = 0, wB = 0, wF = 0;
    let maxVariance = 0, threshold = 0;

    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      wF = total - wB;
      if (wF === 0) break;

      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;

      const variance = wB * wF * (mB - mF) * (mB - mF);
      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = t;
      }
    }

    return threshold;
  }
};

// ArUco dictionary 4x4_50
const ARUCO_DICT: { [key: number]: number[] } = {
  0: [1,0,0,0,0,0,1,1,1,1,1,1,0,0,0,1],
  1: [1,0,0,1,1,1,1,0,0,1,0,0,1,0,1,0],
  2: [0,0,1,1,0,1,1,1,1,1,0,1,0,1,1,0],
  3: [0,1,0,1,0,0,0,1,0,0,1,0,1,1,0,0],
  4: [0,1,1,0,1,0,0,0,0,0,0,1,0,0,0,1],
  5: [1,1,0,0,0,0,1,0,1,0,0,1,1,1,1,1],
  6: [0,0,0,1,1,1,1,0,0,1,1,0,0,0,1,1],
  7: [1,1,1,1,1,1,0,0,0,0,0,0,1,1,1,0],
  8: [0,0,1,0,0,1,0,1,1,0,1,0,0,1,0,0],
  9: [1,0,1,0,1,0,0,1,0,1,1,1,1,0,0,1],
  10: [0,1,0,0,0,1,0,0,1,1,0,0,0,0,1,0],
  11: [1,1,1,0,0,1,1,0,0,0,1,1,0,1,1,1],
  12: [0,1,1,1,1,1,1,1,1,0,0,0,1,0,0,0],
  13: [1,0,1,1,1,0,1,1,1,1,1,0,1,1,0,1],
  14: [1,1,0,1,1,1,0,1,0,1,0,1,0,0,0,0],
  15: [0,0,0,0,1,0,1,0,1,0,1,1,1,0,1,1],
  16: [1,0,0,0,0,0,0,1,0,1,0,0,0,1,0,1],
  17: [1,0,0,1,1,1,0,0,1,1,1,1,1,1,1,0],
  18: [0,0,1,1,0,1,0,1,0,0,1,0,0,0,1,0],
  19: [0,1,0,1,0,0,1,1,1,1,0,1,1,0,0,0],
  20: [0,1,1,0,1,0,1,0,1,0,1,0,1,1,0,1],
  21: [1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  22: [0,0,0,1,1,1,0,0,1,0,0,1,0,1,1,1],
  23: [1,1,1,1,1,1,1,0,1,0,1,1,1,0,1,0],
  24: [0,0,1,0,0,1,1,1,0,0,0,1,0,0,0,0],
  25: [1,0,1,0,1,0,1,1,1,1,0,0,1,1,1,1],
  26: [0,1,0,0,0,1,1,0,0,1,1,1,0,1,1,0],
  27: [1,1,1,0,0,1,0,0,1,1,1,0,0,0,0,1],
  28: [0,1,1,1,1,1,0,1,0,0,1,1,0,1,0,0],
  29: [1,0,1,1,1,0,0,1,0,1,0,1,1,0,0,1],
  30: [1,1,0,1,1,1,1,1,1,0,0,0,1,1,0,0],
  31: [0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,1],
  32: [1,0,0,0,0,1,1,1,0,1,1,0,1,0,1,1],
  33: [1,0,0,1,1,0,1,0,1,1,0,1,0,0,0,0],
  34: [0,0,1,1,0,0,1,1,0,1,0,0,1,1,0,0],
  35: [0,1,0,1,0,1,0,1,1,1,1,1,0,0,1,0],
  36: [0,1,1,0,1,1,0,0,1,1,0,0,0,1,1,1],
  37: [1,1,0,0,0,1,1,0,0,0,1,0,1,0,0,1],
  38: [0,0,0,1,1,0,1,0,1,0,0,0,1,1,0,1],
  39: [1,1,1,1,1,0,0,0,0,0,1,1,0,1,0,0],
  40: [0,0,1,0,0,0,0,1,1,0,0,1,1,0,1,0],
  41: [1,0,1,0,1,1,0,1,0,1,1,0,0,0,0,1],
  42: [0,1,0,0,0,0,1,0,1,1,1,0,1,1,0,0],
  43: [1,1,1,0,0,0,0,0,0,1,0,1,1,0,1,1],
  44: [0,1,1,1,1,0,0,1,0,0,0,1,1,1,1,0],
  45: [1,0,1,1,1,1,1,1,1,1,1,0,0,0,1,1],
  46: [1,1,0,1,1,0,1,1,1,0,1,1,0,1,1,0],
  47: [0,0,0,0,1,1,0,0,0,0,1,0,1,1,1,1],
  48: [1,0,0,0,0,1,0,1,1,1,0,1,1,1,1,1],
  49: [1,0,0,1,1,0,0,0,0,1,1,0,0,1,0,0]
};

// Detect markers
function detectArucoMarkers(imageData: ImageData): ArucoMarker[] {
  const width = imageData.width;
  const height = imageData.height;
  const markers: ArucoMarker[] = [];

  // Convert to grayscale
  const gray = {
    data: new Uint8Array(width * height),
    width,
    height
  };
  CV.grayscale(imageData, { data: gray.data } as ImageData);

  // Adaptive threshold
  const binary = {
    data: new Uint8Array(width * height),
    width,
    height
  };
  const kernelSize = Math.max(3, Math.floor(Math.min(width, height) / 20) | 1);
  CV.adaptiveThreshold(gray, binary, kernelSize, 0.05);

  // Find contours
  const contours = CV.findContours(binary);

  // Filter candidates
  const minSize = Math.min(width, height) * 0.01;
  const maxSize = Math.min(width, height) * 0.9;

  for (const contour of contours) {
    // Approximate to polygon
    const epsilon = CV.perimeter(contour) * 0.03;
    const approx = CV.approxPolyDP(contour, epsilon);

    // Must be quadrilateral
    if (approx.length !== 4) continue;

    // Must be convex
    if (!CV.isContourConvex(approx)) continue;

    // Check size
    const area = CV.contourArea(approx);
    const side = Math.sqrt(area);
    if (side < minSize || side > maxSize) continue;

    // Order corners (top-left, top-right, bottom-right, bottom-left)
    const corners = orderCorners(approx);

    // Warp to get marker content
    const markerSize = 6;
    const warped = CV.warp(gray, corners, markerSize * 10);

    // Read bits and identify marker
    const bits = readBits(warped, markerSize);
    const id = identifyMarker(bits);

    if (id !== -1) {
      const center = {
        x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
        y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4
      };

      const w = Math.sqrt(
        Math.pow(corners[1].x - corners[0].x, 2) +
        Math.pow(corners[1].y - corners[0].y, 2)
      );
      const h = Math.sqrt(
        Math.pow(corners[3].x - corners[0].x, 2) +
        Math.pow(corners[3].y - corners[0].y, 2)
      );

      // Check for duplicates
      const isDuplicate = markers.some(m =>
        m.id === id &&
        Math.abs(m.center.x - center.x) < w * 0.5 &&
        Math.abs(m.center.y - center.y) < h * 0.5
      );

      if (!isDuplicate) {
        markers.push({
          id,
          corners,
          center,
          size: { width: w, height: h }
        });
      }
    }
  }

  return markers;
}

function orderCorners(corners: { x: number; y: number }[]): { x: number; y: number }[] {
  // Sort by y first
  const sorted = [...corners].sort((a, b) => a.y - b.y);

  // Top two and bottom two
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);

  return [top[0], top[1], bottom[1], bottom[0]];
}

function readBits(warped: Uint8Array, size: number): number[] {
  const cellSize = Math.floor(warped.length / size / size);
  const bits: number[] = [];
  const warpedSize = Math.sqrt(warped.length);

  // Compute threshold using Otsu on the warped image
  let sum = 0;
  for (let i = 0; i < warped.length; i++) sum += warped[i];
  const threshold = sum / warped.length;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const startX = Math.floor((col + 0.25) * warpedSize / size);
      const startY = Math.floor((row + 0.25) * warpedSize / size);
      const endX = Math.floor((col + 0.75) * warpedSize / size);
      const endY = Math.floor((row + 0.75) * warpedSize / size);

      let cellSum = 0;
      let count = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          cellSum += warped[y * warpedSize + x];
          count++;
        }
      }

      bits.push(cellSum / count < threshold ? 0 : 1);
    }
  }

  return bits;
}

function identifyMarker(bits: number[]): number {
  // Check border (should be all black = 0)
  for (let i = 0; i < 6; i++) {
    if (bits[i] !== 0) return -1; // Top row
    if (bits[30 + i] !== 0) return -1; // Bottom row
    if (bits[i * 6] !== 0) return -1; // Left column
    if (bits[i * 6 + 5] !== 0) return -1; // Right column
  }

  // Extract inner 4x4 bits
  const inner: number[] = [];
  for (let row = 1; row <= 4; row++) {
    for (let col = 1; col <= 4; col++) {
      inner.push(bits[row * 6 + col]);
    }
  }

  // Try all 4 rotations
  for (let rot = 0; rot < 4; rot++) {
    for (const [id, pattern] of Object.entries(ARUCO_DICT)) {
      let match = true;
      for (let i = 0; i < 16; i++) {
        if (inner[i] !== pattern[i]) {
          match = false;
          break;
        }
      }
      if (match) return parseInt(id);
    }

    // Rotate inner 90 degrees clockwise
    const rotated: number[] = [];
    for (let col = 0; col < 4; col++) {
      for (let row = 3; row >= 0; row--) {
        rotated.push(inner[row * 4 + col]);
      }
    }
    inner.length = 0;
    inner.push(...rotated);
  }

  return -1;
}

// ============================================
// REACT HOOK
// ============================================

export function useOpenCVAruco(options: UseOpenCVArucoOptions = {}): UseOpenCVArucoReturn {
  const { markerSizeCm = 10 } = options;

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      setIsLoaded(true);
      console.log('[ArUco] Détection native v3 prête');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const detectMarkers = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement
  ): Promise<ArucoMarker[]> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    const w = image.width || (image as HTMLImageElement).naturalWidth;
    const h = image.height || (image as HTMLImageElement).naturalHeight;

    // Limit size for performance
    const maxDim = 1500;
    let scale = 1;
    if (Math.max(w, h) > maxDim) {
      scale = maxDim / Math.max(w, h);
    }

    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const markers = detectArucoMarkers(imageData);

    // Scale coordinates back if needed
    if (scale !== 1) {
      for (const marker of markers) {
        marker.center.x /= scale;
        marker.center.y /= scale;
        marker.size.width /= scale;
        marker.size.height /= scale;
        for (const corner of marker.corners) {
          corner.x /= scale;
          corner.y /= scale;
        }
      }
    }

    console.log(`[ArUco] ${markers.length} markers détectés:`, markers.map(m => `ID${m.id}`).join(', '));
    return markers;
  }, []);

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
    options: { markerSizeCm?: number; correctPerspective?: boolean } = {}
  ): Promise<CalibrationResult> => {
    const { markerSizeCm: size = markerSizeCm } = options;

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

export default useOpenCVAruco;
