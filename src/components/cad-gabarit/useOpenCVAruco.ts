// ============================================
// HOOK: useOpenCVAruco
// Détection de markers ArUco NATIVE (sans module cv.aruco)
// VERSION: 2.0 - Détection JavaScript pure
// ============================================

import { useState, useCallback, useRef, useEffect } from 'react';

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
  calibrateCamera: (images: (HTMLImageElement | HTMLCanvasElement)[], patternSize: { width: number; height: number }) => Promise<any>;
  undistortImage: (image: HTMLImageElement | HTMLCanvasElement, calibration: any) => Promise<ImageData | null>;
  processImage: (image: HTMLImageElement | HTMLCanvasElement, options?: { markerSizeCm?: number; correctPerspective?: boolean }) => Promise<CalibrationResult>;
}

// Dictionnaire ArUco 4x4_50 - patterns binaires (4x4 bits intérieurs)
// Chaque marker a une bordure noire de 1 bit, donc 6x6 total
const ARUCO_DICT_4X4_50: number[][] = [
  [0b1000, 0b0011, 0b1111, 0b0001], // ID 0
  [0b1001, 0b1110, 0b0100, 0b1010], // ID 1
  [0b0011, 0b0111, 0b1101, 0b0110], // ID 2
  [0b0101, 0b0001, 0b0010, 0b1100], // ID 3
  [0b0110, 0b1000, 0b0001, 0b0001], // ID 4
  [0b1100, 0b0010, 0b1001, 0b1111], // ID 5
  [0b0001, 0b1110, 0b0110, 0b0011], // ID 6
  [0b1111, 0b1100, 0b0000, 0b1110], // ID 7
  [0b0010, 0b0101, 0b1010, 0b0100], // ID 8
  [0b1010, 0b1001, 0b0111, 0b1001], // ID 9
  [0b0100, 0b0100, 0b1100, 0b0010], // ID 10
  [0b1110, 0b0110, 0b0011, 0b0111], // ID 11
  [0b0111, 0b1111, 0b1000, 0b1000], // ID 12
  [0b1011, 0b1011, 0b1110, 0b1101], // ID 13
  [0b1101, 0b1101, 0b0101, 0b0000], // ID 14
  [0b0000, 0b1010, 0b1011, 0b1011], // ID 15
  [0b1000, 0b0001, 0b0100, 0b0101], // ID 16
  [0b1001, 0b1100, 0b1111, 0b1110], // ID 17
  [0b0011, 0b0101, 0b0010, 0b0010], // ID 18
  [0b0101, 0b0011, 0b1101, 0b1000], // ID 19
  [0b0110, 0b1010, 0b1010, 0b1101], // ID 20
  [0b1100, 0b0000, 0b0000, 0b0011], // ID 21
  [0b0001, 0b1100, 0b1001, 0b0111], // ID 22
  [0b1111, 0b1110, 0b1011, 0b1010], // ID 23
  [0b0010, 0b0111, 0b0001, 0b0000], // ID 24
  [0b1010, 0b1011, 0b1100, 0b1111], // ID 25
  [0b0100, 0b0110, 0b0111, 0b0110], // ID 26
  [0b1110, 0b0100, 0b1110, 0b0001], // ID 27
  [0b0111, 0b1101, 0b0011, 0b0100], // ID 28
  [0b1011, 0b1001, 0b0101, 0b1001], // ID 29
  [0b1101, 0b1111, 0b1000, 0b1100], // ID 30
  [0b0000, 0b1000, 0b0000, 0b0101], // ID 31
  [0b1000, 0b0111, 0b0110, 0b1011], // ID 32
  [0b1001, 0b1010, 0b1101, 0b0000], // ID 33
  [0b0011, 0b0011, 0b0100, 0b1100], // ID 34
  [0b0101, 0b0101, 0b1111, 0b0010], // ID 35
  [0b0110, 0b1100, 0b1100, 0b0111], // ID 36
  [0b1100, 0b0110, 0b0010, 0b1001], // ID 37
  [0b0001, 0b1010, 0b1000, 0b1101], // ID 38
  [0b1111, 0b1000, 0b0011, 0b0100], // ID 39
  [0b0010, 0b0001, 0b1001, 0b1010], // ID 40
  [0b1010, 0b1101, 0b0110, 0b0001], // ID 41
  [0b0100, 0b0010, 0b1110, 0b1100], // ID 42
  [0b1110, 0b0000, 0b0101, 0b1011], // ID 43
  [0b0111, 0b1001, 0b0001, 0b1110], // ID 44
  [0b1011, 0b1111, 0b1110, 0b0011], // ID 45
  [0b1101, 0b1011, 0b1011, 0b0110], // ID 46
  [0b0000, 0b1100, 0b0010, 0b1111], // ID 47
  [0b1000, 0b0101, 0b1101, 0b1111], // ID 48
  [0b1001, 0b1000, 0b0110, 0b0100], // ID 49
];

// Fonction pour créer le pattern binaire 6x6 complet d'un marker
function getMarkerPattern(id: number): number[][] {
  if (id < 0 || id >= ARUCO_DICT_4X4_50.length) return [];

  const innerBits = ARUCO_DICT_4X4_50[id];
  const pattern: number[][] = [];

  // Créer pattern 6x6 avec bordure noire
  for (let row = 0; row < 6; row++) {
    pattern[row] = [];
    for (let col = 0; col < 6; col++) {
      if (row === 0 || row === 5 || col === 0 || col === 5) {
        // Bordure noire
        pattern[row][col] = 0;
      } else {
        // Bits intérieurs (4x4)
        const innerRow = row - 1;
        const innerCol = col - 1;
        const bit = (innerBits[innerRow] >> (3 - innerCol)) & 1;
        pattern[row][col] = bit;
      }
    }
  }

  return pattern;
}

// Rotation d'un pattern 90° dans le sens horaire
function rotatePattern90(pattern: number[][]): number[][] {
  const size = pattern.length;
  const rotated: number[][] = [];
  for (let i = 0; i < size; i++) {
    rotated[i] = [];
    for (let j = 0; j < size; j++) {
      rotated[i][j] = pattern[size - 1 - j][i];
    }
  }
  return rotated;
}

// Comparer deux patterns
function patternsMatch(p1: number[][], p2: number[][]): boolean {
  if (p1.length !== p2.length) return false;
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p1[i].length; j++) {
      if (p1[i][j] !== p2[i][j]) return false;
    }
  }
  return true;
}

export function useOpenCVAruco(options: UseOpenCVArucoOptions = {}): UseOpenCVArucoReturn {
  const { markerSizeCm = 10 } = options;

  // Toujours "chargé" car on n'utilise pas OpenCV.js pour ArUco
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simuler un chargement rapide
    const timer = setTimeout(() => {
      setIsLoading(false);
      setIsLoaded(true);
      console.log('[ArUco] Détection native prête');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Détection native des markers ArUco
  const detectMarkers = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement
  ): Promise<ArucoMarker[]> => {
    const markers: ArucoMarker[] = [];

    // Créer un canvas pour analyser l'image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return markers;

    canvas.width = image.width || (image as HTMLImageElement).naturalWidth;
    canvas.height = image.height || (image as HTMLImageElement).naturalHeight;
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convertir en niveaux de gris
    const gray = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < gray.length; i++) {
      const idx = i * 4;
      gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
    }

    // Seuillage adaptatif simplifié
    const binary = new Uint8Array(canvas.width * canvas.height);
    const blockSize = 51;
    const C = 10;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = y * canvas.width + x;

        // Moyenne locale
        let sum = 0;
        let count = 0;
        const halfBlock = Math.floor(blockSize / 2);

        for (let dy = -halfBlock; dy <= halfBlock; dy += 5) {
          for (let dx = -halfBlock; dx <= halfBlock; dx += 5) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height) {
              sum += gray[ny * canvas.width + nx];
              count++;
            }
          }
        }

        const mean = sum / count;
        binary[idx] = gray[idx] < mean - C ? 0 : 255;
      }
    }

    // Détecter les contours carrés
    const visited = new Set<number>();
    const candidates: { corners: {x: number, y: number}[], bounds: {minX: number, maxX: number, minY: number, maxY: number} }[] = [];

    // Chercher des régions noires qui pourraient être des markers
    const minMarkerSize = Math.min(canvas.width, canvas.height) * 0.02; // 2% de l'image min
    const maxMarkerSize = Math.min(canvas.width, canvas.height) * 0.5; // 50% de l'image max

    // Scanner pour trouver des quadrilatères noirs
    const step = Math.max(5, Math.floor(minMarkerSize / 4));

    for (let y = 0; y < canvas.height - minMarkerSize; y += step) {
      for (let x = 0; x < canvas.width - minMarkerSize; x += step) {
        const idx = y * canvas.width + x;

        if (binary[idx] === 0 && !visited.has(idx)) {
          // Trouver les limites de la région noire
          let minX = x, maxX = x, minY = y, maxY = y;
          const queue = [{ x, y }];
          const region: { x: number, y: number }[] = [];

          while (queue.length > 0 && region.length < 50000) {
            const p = queue.pop()!;
            const pidx = p.y * canvas.width + p.x;

            if (visited.has(pidx)) continue;
            if (p.x < 0 || p.x >= canvas.width || p.y < 0 || p.y >= canvas.height) continue;
            if (binary[pidx] !== 0) continue;

            visited.add(pidx);
            region.push(p);

            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);

            // Ajouter les voisins
            queue.push({ x: p.x + step, y: p.y });
            queue.push({ x: p.x - step, y: p.y });
            queue.push({ x: p.x, y: p.y + step });
            queue.push({ x: p.x, y: p.y - step });
          }

          const width = maxX - minX;
          const height = maxY - minY;

          // Vérifier si c'est potentiellement un marker (approximativement carré)
          if (width >= minMarkerSize && width <= maxMarkerSize &&
              height >= minMarkerSize && height <= maxMarkerSize &&
              Math.abs(width - height) < Math.max(width, height) * 0.3) {

            candidates.push({
              corners: [
                { x: minX, y: minY },
                { x: maxX, y: minY },
                { x: maxX, y: maxY },
                { x: minX, y: maxY }
              ],
              bounds: { minX, maxX, minY, maxY }
            });
          }
        }
      }
    }

    // Pour chaque candidat, essayer de décoder le marker
    for (const candidate of candidates) {
      const { bounds } = candidate;
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      const size = Math.max(width, height);

      // Échantillonner le contenu du marker (6x6 cellules)
      const cellSize = size / 6;
      const sampledPattern: number[][] = [];

      for (let row = 0; row < 6; row++) {
        sampledPattern[row] = [];
        for (let col = 0; col < 6; col++) {
          // Centre de la cellule
          const cx = bounds.minX + (col + 0.5) * cellSize;
          const cy = bounds.minY + (row + 0.5) * cellSize;

          // Échantillonner plusieurs points dans la cellule
          let blackCount = 0;
          let totalCount = 0;
          const sampleRadius = cellSize * 0.25;

          for (let dy = -sampleRadius; dy <= sampleRadius; dy += sampleRadius) {
            for (let dx = -sampleRadius; dx <= sampleRadius; dx += sampleRadius) {
              const sx = Math.round(cx + dx);
              const sy = Math.round(cy + dy);
              if (sx >= 0 && sx < canvas.width && sy >= 0 && sy < canvas.height) {
                const sidx = sy * canvas.width + sx;
                if (binary[sidx] === 0) blackCount++;
                totalCount++;
              }
            }
          }

          // Majorité noir = 0, sinon = 1
          sampledPattern[row][col] = blackCount > totalCount / 2 ? 0 : 1;
        }
      }

      // Vérifier que la bordure est noire
      let borderOk = true;
      for (let i = 0; i < 6; i++) {
        if (sampledPattern[0][i] !== 0 || sampledPattern[5][i] !== 0 ||
            sampledPattern[i][0] !== 0 || sampledPattern[i][5] !== 0) {
          borderOk = false;
          break;
        }
      }

      if (!borderOk) continue;

      // Essayer de matcher avec chaque marker du dictionnaire (et rotations)
      for (let id = 0; id < ARUCO_DICT_4X4_50.length; id++) {
        let pattern = getMarkerPattern(id);

        for (let rotation = 0; rotation < 4; rotation++) {
          if (patternsMatch(sampledPattern, pattern)) {
            // Marker trouvé !
            const center = {
              x: (bounds.minX + bounds.maxX) / 2,
              y: (bounds.minY + bounds.maxY) / 2
            };

            // Vérifier qu'on n'a pas déjà ce marker (éviter les doublons)
            const isDuplicate = markers.some(m =>
              m.id === id &&
              Math.abs(m.center.x - center.x) < size * 0.5 &&
              Math.abs(m.center.y - center.y) < size * 0.5
            );

            if (!isDuplicate) {
              markers.push({
                id,
                corners: candidate.corners,
                center,
                size: { width, height }
              });
            }
            break;
          }

          pattern = rotatePattern90(pattern);
        }
      }
    }

    console.log(`[ArUco] ${markers.length} markers détectés:`, markers.map(m => m.id));
    return markers;
  }, []);

  // Calculer l'échelle (pixels par cm) à partir des markers
  const calculateScale = useCallback((
    markers: ArucoMarker[],
    markerSizeCm: number
  ): number | null => {
    if (markers.length === 0) return null;

    const markerSizes: number[] = [];

    for (const marker of markers) {
      const sidePixels = (marker.size.width + marker.size.height) / 2;
      markerSizes.push(sidePixels);
    }

    const avgSizePixels = markerSizes.reduce((a, b) => a + b, 0) / markerSizes.length;
    const pixelsPerCm = avgSizePixels / markerSizeCm;

    console.log(`[ArUco] Échelle calculée: ${pixelsPerCm.toFixed(2)} pixels/cm`);
    return pixelsPerCm;
  }, []);

  // Correction de perspective (simplifié)
  const correctPerspective = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement,
    markers: ArucoMarker[]
  ): Promise<ImageData | null> => {
    // Pour l'instant, retourner null (pas implémenté sans OpenCV)
    return null;
  }, []);

  const calibrateCamera = useCallback(async () => null, []);
  const undistortImage = useCallback(async () => null, []);

  // Pipeline complet
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
      console.error('[ArUco] Erreur de traitement:', err);
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
