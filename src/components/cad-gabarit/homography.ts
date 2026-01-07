// ============================================
// HOMOGRAPHY: Calcul de transformation perspective
// Correction de déformation d'image + distorsion radiale
// VERSION: 1.1 - Ajout calibration par damier
// ============================================

import { HomographyMatrix } from "./types";

/**
 * Calcule la matrice d'homographie à partir de 4 points source et destination
 *
 * @param srcPoints - 4 points sur l'image originale (pixels)
 * @param dstPoints - 4 points de destination (mm ou pixels corrigés)
 * @returns Matrice 3x3 de transformation
 */
export function computeHomography(
  srcPoints: Array<{ x: number; y: number }>,
  dstPoints: Array<{ x: number; y: number }>,
): HomographyMatrix {
  if (srcPoints.length !== 4 || dstPoints.length !== 4) {
    throw new Error("Exactement 4 points requis");
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
      throw new Error("Matrice singulière - points colinéaires?");
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
    throw new Error("Matrice non inversible");
  }

  // Matrice des cofacteurs transposée divisée par le déterminant
  return [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ];
}

/**
 * Applique une transformation homographique à un point
 */
export function transformPoint(H: HomographyMatrix, point: { x: number; y: number }): { x: number; y: number } {
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
  offsetY: number = 0,
): ImageData {
  // Créer un canvas pour lire les pixels source
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = srcImage.width;
  srcCanvas.height = srcImage.height;
  const srcCtx = srcCanvas.getContext("2d")!;
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
  y: number,
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
  srcHeight: number,
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
  imageHeight: number,
): { H: HomographyMatrix; scale: number } {
  if (quadPoints.length !== 4) {
    throw new Error("Exactement 4 points requis");
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
    Math.pow(quadPoints[2].x - quadPoints[0].x, 2) + Math.pow(quadPoints[2].y - quadPoints[0].y, 2),
  );
  const realDiag = Math.sqrt(widthMm * widthMm + heightMm * heightMm);
  const scale = diag1 / realDiag; // pixels par mm

  // Rectangle destination centré (en pixels)
  const halfW = (widthMm * scale) / 2;
  const halfH = (heightMm * scale) / 2;
  const dstPoints = [
    { x: -halfW, y: -halfH }, // Top-Left
    { x: halfW, y: -halfH }, // Top-Right
    { x: halfW, y: halfH }, // Bottom-Right
    { x: -halfW, y: halfH }, // Bottom-Left
  ];

  // Calculer l'homographie qui transforme srcPoints -> dstPoints
  const H = computeHomography(srcPoints, dstPoints);

  return { H, scale };
}

// ============================================
// CORRECTION DE DISTORSION (DAMIER)
// ============================================

import { DistortionCoefficients } from "./types";

/**
 * Interpole les coins intérieurs d'un damier à partir des 4 coins extérieurs
 * Utilise une interpolation bilinéaire
 */
export function interpolateCheckerboardCorners(
  corners: Array<{ x: number; y: number }>, // 4 coins extérieurs [TL, TR, BR, BL]
  cornersX: number, // Nombre de coins intérieurs en X
  cornersY: number, // Nombre de coins intérieurs en Y
): Array<Array<{ x: number; y: number }>> {
  const [tl, tr, br, bl] = corners;

  const grid: Array<Array<{ x: number; y: number }>> = [];

  // Nombre total de points = coins intérieurs + bords
  const totalX = cornersX + 2;
  const totalY = cornersY + 2;

  for (let j = 0; j < totalY; j++) {
    const row: Array<{ x: number; y: number }> = [];
    const v = j / (totalY - 1);

    for (let i = 0; i < totalX; i++) {
      const u = i / (totalX - 1);

      // Interpolation bilinéaire
      const x = (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x;
      const y = (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y;

      row.push({ x, y });
    }
    grid.push(row);
  }

  return grid;
}

/**
 * Génère les positions idéales (sans distorsion) des coins du damier
 */
export function generateIdealCheckerboardCorners(
  cornersX: number,
  cornersY: number,
  squareSizeMm: number,
  imageWidth: number,
  imageHeight: number,
): { grid: Array<Array<{ x: number; y: number }>>; scale: number } {
  const totalX = cornersX + 2;
  const totalY = cornersY + 2;

  // Calculer la taille totale du damier
  const totalWidthMm = (totalX - 1) * squareSizeMm;
  const totalHeightMm = (totalY - 1) * squareSizeMm;

  // Échelle pour que le damier tienne dans l'image (avec marge)
  const scaleX = (imageWidth * 0.8) / totalWidthMm;
  const scaleY = (imageHeight * 0.8) / totalHeightMm;
  const scale = Math.min(scaleX, scaleY);

  const grid: Array<Array<{ x: number; y: number }>> = [];

  // Centrer le damier
  const offsetX = -((totalX - 1) * squareSizeMm * scale) / 2;
  const offsetY = -((totalY - 1) * squareSizeMm * scale) / 2;

  for (let j = 0; j < totalY; j++) {
    const row: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < totalX; i++) {
      row.push({
        x: offsetX + i * squareSizeMm * scale,
        y: offsetY + j * squareSizeMm * scale,
      });
    }
    grid.push(row);
  }

  return { grid, scale };
}

/**
 * Calcule les coefficients de distorsion radiale à partir des points observés et idéaux
 * Utilise une régression par moindres carrés
 */
export function computeDistortionCoefficients(
  observedPoints: Array<{ x: number; y: number }>, // Points sur l'image (centrés)
  idealPoints: Array<{ x: number; y: number }>, // Points idéaux (où ils devraient être)
  imageWidth: number,
  imageHeight: number,
): DistortionCoefficients {
  // Centre optique (approximé au centre de l'image)
  const cx = 0;
  const cy = 0;

  // Normaliser les coordonnées par la taille de l'image
  const normalizer = Math.max(imageWidth, imageHeight) / 2;

  // Construire le système pour résoudre les coefficients k1, k2, k3
  // Modèle: x_distordu = x_ideal * (1 + k1*r² + k2*r⁴ + k3*r⁶)
  // On résout: x_observed = x_ideal + x_ideal * (k1*r² + k2*r⁴ + k3*r⁶)
  // Donc: (x_observed - x_ideal) / x_ideal = k1*r² + k2*r⁴ + k3*r⁶

  const A: number[][] = [];
  const bX: number[] = [];
  const bY: number[] = [];

  for (let i = 0; i < observedPoints.length; i++) {
    const obs = observedPoints[i];
    const ideal = idealPoints[i];

    // Normaliser
    const xn = ideal.x / normalizer;
    const yn = ideal.y / normalizer;
    const r2 = xn * xn + yn * yn;
    const r4 = r2 * r2;
    const r6 = r4 * r2;

    // Éviter division par zéro
    if (Math.abs(ideal.x) > 0.001) {
      A.push([xn * r2, xn * r4, xn * r6]);
      bX.push((obs.x - ideal.x) / normalizer);
    }
    if (Math.abs(ideal.y) > 0.001) {
      A.push([yn * r2, yn * r4, yn * r6]);
      bY.push((obs.y - ideal.y) / normalizer);
    }
  }

  // Résoudre par moindres carrés (pseudo-inverse)
  // Pour simplifier, on utilise seulement k1 et k2 (k3 souvent négligeable)
  const k = solveDistortionLeastSquares(A, [...bX, ...bY]);

  return {
    k1: k[0] || 0,
    k2: k[1] || 0,
    k3: k[2] || 0,
    p1: 0, // Distorsion tangentielle (non calculée pour simplifier)
    p2: 0,
    cx,
    cy,
  };
}

/**
 * Résout le système de distorsion par moindres carrés
 */
function solveDistortionLeastSquares(A: number[][], b: number[]): number[] {
  const n = A[0]?.length || 3;

  // A^T * A
  const AtA: number[][] = Array(n)
    .fill(0)
    .map(() => Array(n).fill(0));
  // A^T * b
  const Atb: number[] = Array(n).fill(0);

  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < n; j++) {
      Atb[j] += A[i][j] * b[i];
      for (let k = 0; k < n; k++) {
        AtA[j][k] += A[i][j] * A[i][k];
      }
    }
  }

  // Résoudre AtA * x = Atb par élimination de Gauss
  try {
    return solveLinearSystem(AtA, Atb);
  } catch {
    // Si le système est singulier, retourner des coefficients nuls
    return [0, 0, 0];
  }
}

/**
 * Applique la correction de distorsion à un point
 */
export function undistortPoint(
  point: { x: number; y: number },
  distortion: DistortionCoefficients,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number } {
  const { k1, k2, k3, cx, cy } = distortion;
  const normalizer = Math.max(imageWidth, imageHeight) / 2;

  // Coordonnées normalisées relatives au centre optique
  const xn = (point.x - cx) / normalizer;
  const yn = (point.y - cy) / normalizer;

  const r2 = xn * xn + yn * yn;
  const r4 = r2 * r2;
  const r6 = r4 * r2;

  // Facteur de correction
  const factor = 1 + k1 * r2 + k2 * r4 + k3 * r6;

  // Appliquer la correction inverse
  return {
    x: cx + (point.x - cx) / factor,
    y: cy + (point.y - cy) / factor,
  };
}

/**
 * Applique la distorsion inverse pour le warping
 */
export function distortPoint(
  point: { x: number; y: number },
  distortion: DistortionCoefficients,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number } {
  const { k1, k2, k3, cx, cy } = distortion;
  const normalizer = Math.max(imageWidth, imageHeight) / 2;

  const xn = (point.x - cx) / normalizer;
  const yn = (point.y - cy) / normalizer;

  const r2 = xn * xn + yn * yn;
  const r4 = r2 * r2;
  const r6 = r4 * r2;

  const factor = 1 + k1 * r2 + k2 * r4 + k3 * r6;

  return {
    x: cx + (point.x - cx) * factor,
    y: cy + (point.y - cy) * factor,
  };
}

/**
 * Corrige la distorsion d'une image complète
 */
export function undistortImage(srcImage: HTMLImageElement, distortion: DistortionCoefficients): ImageData {
  const width = srcImage.width;
  const height = srcImage.height;

  // Créer un canvas pour lire les pixels source
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = width;
  srcCanvas.height = height;
  const srcCtx = srcCanvas.getContext("2d")!;
  srcCtx.drawImage(srcImage, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, width, height);

  // Créer l'image de sortie
  const dstData = new ImageData(width, height);

  // Pour chaque pixel de destination, trouver le pixel source correspondant
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      // Coordonnées centrées
      const dstX = dx - width / 2;
      const dstY = dy - height / 2;

      // Appliquer la distorsion pour trouver où ce pixel vient dans l'image source
      const src = distortPoint({ x: dstX, y: dstY }, distortion, width, height);

      // Reconvertir en coordonnées image
      const srcX = src.x + width / 2;
      const srcY = src.y + height / 2;

      // Interpolation bilinéaire
      const pixel = bilinearInterpolate(srcData, srcX, srcY);

      // Écrire le pixel
      const dstIdx = (dy * width + dx) * 4;
      dstData.data[dstIdx] = pixel.r;
      dstData.data[dstIdx + 1] = pixel.g;
      dstData.data[dstIdx + 2] = pixel.b;
      dstData.data[dstIdx + 3] = pixel.a;
    }
  }

  return dstData;
}

/**
 * Calibration complète par damier : homographie + distorsion
 */
export function calibrateWithCheckerboard(
  cornerPoints: Array<{ x: number; y: number }>, // 4 coins extérieurs [TL, TR, BR, BL]
  cornersX: number,
  cornersY: number,
  squareSizeMm: number,
  imageWidth: number,
  imageHeight: number,
): {
  homography: HomographyMatrix;
  distortion: DistortionCoefficients;
  scale: number;
} {
  // 1. Interpoler tous les coins du damier observés
  const observedGrid = interpolateCheckerboardCorners(cornerPoints, cornersX, cornersY);

  // 2. Générer la grille idéale
  const { grid: idealGrid, scale } = generateIdealCheckerboardCorners(
    cornersX,
    cornersY,
    squareSizeMm,
    imageWidth,
    imageHeight,
  );

  // 3. Convertir en coordonnées centrées
  const observedFlat: Array<{ x: number; y: number }> = [];
  const idealFlat: Array<{ x: number; y: number }> = [];

  for (let j = 0; j < observedGrid.length; j++) {
    for (let i = 0; i < observedGrid[j].length; i++) {
      observedFlat.push({
        x: observedGrid[j][i].x - imageWidth / 2,
        y: observedGrid[j][i].y - imageHeight / 2,
      });
      idealFlat.push(idealGrid[j][i]);
    }
  }

  // 4. Calculer l'homographie avec les 4 coins
  const srcCorners = cornerPoints.map((p) => ({
    x: p.x - imageWidth / 2,
    y: p.y - imageHeight / 2,
  }));

  const totalX = cornersX + 2;
  const totalY = cornersY + 2;
  const dstCorners = [
    idealGrid[0][0],
    idealGrid[0][totalX - 1],
    idealGrid[totalY - 1][totalX - 1],
    idealGrid[totalY - 1][0],
  ];

  const homography = computeHomography(srcCorners, dstCorners);

  // 5. Appliquer l'homographie aux points observés
  const homographyCorrected = observedFlat.map((p) => transformPoint(homography, p));

  // 6. Calculer les coefficients de distorsion résiduelle
  const distortion = computeDistortionCoefficients(homographyCorrected, idealFlat, imageWidth, imageHeight);

  return {
    homography,
    distortion,
    scale: 1 / scale, // mm par pixel
  };
}
