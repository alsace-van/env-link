// ============================================
// HOMOGRAPHY: Calcul de transformation perspective
// Correction de déformation d'image
// VERSION: 1.0
// ============================================

import { HomographyMatrix } from './types';

/**
 * Calcule la matrice d'homographie à partir de 4 points source et destination
 * 
 * @param srcPoints - 4 points sur l'image originale (pixels)
 * @param dstPoints - 4 points de destination (mm ou pixels corrigés)
 * @returns Matrice 3x3 de transformation
 */
export function computeHomography(
  srcPoints: Array<{ x: number; y: number }>,
  dstPoints: Array<{ x: number; y: number }>
): HomographyMatrix {
  if (srcPoints.length !== 4 || dstPoints.length !== 4) {
    throw new Error('Exactement 4 points requis');
  }

  // Construire le système d'équations linéaires Ax = b
  // Pour chaque paire de points (src -> dst), on a 2 équations:
  // x'(h31*x + h32*y + h33) = h11*x + h12*y + h13
  // y'(h31*x + h32*y + h33) = h21*x + h22*y + h23
  
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = srcPoints[i].x;
    const sy = srcPoints[i].y;
    const dx = dstPoints[i].x;
    const dy = dstPoints[i].y;

    // Équation pour x'
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);

    // Équation pour y'
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  // Résoudre le système par élimination de Gauss
  const h = solveLinearSystem(A, b);

  // Construire la matrice 3x3
  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1],
  ];
}

/**
 * Résout un système linéaire Ax = b par élimination de Gauss avec pivot partiel
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented: number[][] = A.map((row, i) => [...row, b[i]]);

  // Élimination vers l'avant avec pivot partiel
  for (let col = 0; col < n; col++) {
    // Trouver le pivot max
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }

    // Échanger les lignes
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    // Vérifier si le pivot est nul
    if (Math.abs(augmented[col][col]) < 1e-10) {
      throw new Error('Matrice singulière - points colinéaires?');
    }

    // Éliminer
    for (let row = col + 1; row < n; row++) {
      const factor = augmented[row][col] / augmented[col][col];
      for (let j = col; j <= n; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  // Substitution arrière
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = augmented[row][n];
    for (let col = row + 1; col < n; col++) {
      sum -= augmented[row][col] * x[col];
    }
    x[row] = sum / augmented[row][row];
  }

  return x;
}

/**
 * Calcule la matrice inverse d'une homographie
 */
export function invertHomography(H: HomographyMatrix): HomographyMatrix {
  const [[a, b, c], [d, e, f], [g, h, i]] = H;

  // Déterminant
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

  if (Math.abs(det) < 1e-10) {
    throw new Error('Matrice non inversible');
  }

  // Matrice des cofacteurs transposée divisée par le déterminant
  return [
    [
      (e * i - f * h) / det,
      (c * h - b * i) / det,
      (b * f - c * e) / det,
    ],
    [
      (f * g - d * i) / det,
      (a * i - c * g) / det,
      (c * d - a * f) / det,
    ],
    [
      (d * h - e * g) / det,
      (b * g - a * h) / det,
      (a * e - b * d) / det,
    ],
  ];
}

/**
 * Applique une transformation homographique à un point
 */
export function transformPoint(
  H: HomographyMatrix,
  point: { x: number; y: number }
): { x: number; y: number } {
  const [[h11, h12, h13], [h21, h22, h23], [h31, h32, h33]] = H;

  const w = h31 * point.x + h32 * point.y + h33;
  
  return {
    x: (h11 * point.x + h12 * point.y + h13) / w,
    y: (h21 * point.x + h22 * point.y + h23) / w,
  };
}

/**
 * Applique une transformation homographique à une image
 * Utilise une interpolation bilinéaire pour la qualité
 * 
 * @param srcImage - Image source (HTMLImageElement ou ImageData)
 * @param H - Matrice d'homographie (transforme dst -> src pour le mapping inverse)
 * @param outputWidth - Largeur de l'image de sortie
 * @param outputHeight - Hauteur de l'image de sortie
 * @param offsetX - Décalage X de l'origine dans l'image de sortie
 * @param offsetY - Décalage Y de l'origine dans l'image de sortie
 */
export function warpImage(
  srcImage: HTMLImageElement,
  H: HomographyMatrix,
  outputWidth: number,
  outputHeight: number,
  offsetX: number = 0,
  offsetY: number = 0
): ImageData {
  // Créer un canvas pour lire les pixels source
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcImage.width;
  srcCanvas.height = srcImage.height;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.drawImage(srcImage, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, srcImage.width, srcImage.height);

  // Créer l'image de sortie
  const dstData = new ImageData(outputWidth, outputHeight);

  // Inverser la matrice pour le mapping inverse (dst -> src)
  const Hinv = invertHomography(H);

  // Pour chaque pixel de destination, trouver le pixel source correspondant
  for (let dy = 0; dy < outputHeight; dy++) {
    for (let dx = 0; dx < outputWidth; dx++) {
      // Position dans le système de coordonnées centré
      const dstX = dx - offsetX;
      const dstY = dy - offsetY;

      // Transformer vers les coordonnées source
      const src = transformPoint(Hinv, { x: dstX, y: dstY });

      // Convertir en coordonnées image (origine en haut-gauche)
      const srcX = src.x + srcImage.width / 2;
      const srcY = src.y + srcImage.height / 2;

      // Interpolation bilinéaire
      const pixel = bilinearInterpolate(srcData, srcX, srcY);

      // Écrire le pixel
      const dstIdx = (dy * outputWidth + dx) * 4;
      dstData.data[dstIdx] = pixel.r;
      dstData.data[dstIdx + 1] = pixel.g;
      dstData.data[dstIdx + 2] = pixel.b;
      dstData.data[dstIdx + 3] = pixel.a;
    }
  }

  return dstData;
}

/**
 * Interpolation bilinéaire pour échantillonner une image
 */
function bilinearInterpolate(
  imageData: ImageData,
  x: number,
  y: number
): { r: number; g: number; b: number; a: number } {
  const w = imageData.width;
  const h = imageData.height;

  // Vérifier les bornes
  if (x < 0 || x >= w - 1 || y < 0 || y >= h - 1) {
    return { r: 0, g: 0, b: 0, a: 0 }; // Transparent si hors bornes
  }

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const dx = x - x0;
  const dy = y - y0;

  // Récupérer les 4 pixels voisins
  const getPixel = (px: number, py: number) => {
    const idx = (py * w + px) * 4;
    return {
      r: imageData.data[idx],
      g: imageData.data[idx + 1],
      b: imageData.data[idx + 2],
      a: imageData.data[idx + 3],
    };
  };

  const p00 = getPixel(x0, y0);
  const p10 = getPixel(x1, y0);
  const p01 = getPixel(x0, y1);
  const p11 = getPixel(x1, y1);

  // Interpolation bilinéaire
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  return {
    r: Math.round(lerp(lerp(p00.r, p10.r, dx), lerp(p01.r, p11.r, dx), dy)),
    g: Math.round(lerp(lerp(p00.g, p10.g, dx), lerp(p01.g, p11.g, dx), dy)),
    b: Math.round(lerp(lerp(p00.b, p10.b, dx), lerp(p01.b, p11.b, dx), dy)),
    a: Math.round(lerp(lerp(p00.a, p10.a, dx), lerp(p01.a, p11.a, dx), dy)),
  };
}

/**
 * Calcule les dimensions de l'image après transformation
 * pour s'assurer que toute l'image transformée est visible
 */
export function computeTransformedBounds(
  H: HomographyMatrix,
  srcWidth: number,
  srcHeight: number
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  // Transformer les 4 coins de l'image source
  const corners = [
    { x: -srcWidth / 2, y: -srcHeight / 2 },
    { x: srcWidth / 2, y: -srcHeight / 2 },
    { x: srcWidth / 2, y: srcHeight / 2 },
    { x: -srcWidth / 2, y: srcHeight / 2 },
  ];

  const transformedCorners = corners.map((c) => transformPoint(H, c));

  const xs = transformedCorners.map((c) => c.x);
  const ys = transformedCorners.map((c) => c.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Crée une homographie à partir d'un quadrilatère source vers un rectangle destination
 * 
 * @param quadPoints - 4 points du quadrilatère sur l'image (dans l'ordre: TL, TR, BR, BL)
 * @param widthMm - Largeur du rectangle réel en mm
 * @param heightMm - Hauteur du rectangle réel en mm
 * @param imageWidth - Largeur de l'image source
 * @param imageHeight - Hauteur de l'image source
 */
export function createRectifyingHomography(
  quadPoints: Array<{ x: number; y: number }>,
  widthMm: number,
  heightMm: number,
  imageWidth: number,
  imageHeight: number
): { H: HomographyMatrix; scale: number } {
  if (quadPoints.length !== 4) {
    throw new Error('Exactement 4 points requis');
  }

  // Convertir les points image (origine top-left) en coordonnées centrées
  const srcPoints = quadPoints.map((p) => ({
    x: p.x - imageWidth / 2,
    y: p.y - imageHeight / 2,
  }));

  // Calculer l'échelle : on veut que le rectangle destination soit dans les mêmes
  // proportions de pixels que l'image source
  // On calcule la diagonale du quadrilatère et on la compare à la diagonale réelle
  const diag1 = Math.sqrt(
    Math.pow(quadPoints[2].x - quadPoints[0].x, 2) +
    Math.pow(quadPoints[2].y - quadPoints[0].y, 2)
  );
  const realDiag = Math.sqrt(widthMm * widthMm + heightMm * heightMm);
  const scale = diag1 / realDiag; // pixels par mm

  // Rectangle destination centré (en pixels)
  const halfW = (widthMm * scale) / 2;
  const halfH = (heightMm * scale) / 2;
  const dstPoints = [
    { x: -halfW, y: -halfH }, // Top-Left
    { x: halfW, y: -halfH },  // Top-Right
    { x: halfW, y: halfH },   // Bottom-Right
    { x: -halfW, y: halfH },  // Bottom-Left
  ];

  // Calculer l'homographie qui transforme srcPoints -> dstPoints
  const H = computeHomography(srcPoints, dstPoints);

  return { H, scale };
}
