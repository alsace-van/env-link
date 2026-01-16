// ============================================
// HOMOGRAPHY: Calcul de transformation perspective et affine
// Correction de déformation d'image + distorsion radiale
// VERSION: 1.2 - Ajout transformation affine avec preview live
// ============================================

import { HomographyMatrix, AffineMatrix } from "./types";

// ============================================
// TRANSFORMATION AFFINE (6 paramètres)
// Gère: translation, rotation, échelle, cisaillement
// Minimum: 3 paires de points non-colinéaires
// ============================================

export interface AffineResult {
  matrix: AffineMatrix;
  error: number; // Erreur RMS en pixels
  errorMm: number; // Erreur RMS en mm
  pointErrors: Map<string, number>; // Erreur par point (pour visualisation)
  isValid: boolean;
  warnings: string[];
}

/**
 * Calcule la transformation affine par moindres carrés
 * 
 * @param srcPoints - Points source (image, en pixels)
 * @param dstPoints - Points destination (monde réel, en mm)
 * @param pointIds - IDs des points pour le mapping d'erreur
 * @returns Résultat avec matrice, erreurs et warnings
 */
export function computeAffineTransform(
  srcPoints: Array<{ x: number; y: number }>,
  dstPoints: Array<{ x: number; y: number }>,
  pointIds?: string[],
): AffineResult {
  const n = srcPoints.length;
  const warnings: string[] = [];

  // Vérification minimum 3 points
  if (n < 3) {
    return {
      matrix: [[1, 0, 0], [0, 1, 0]],
      error: Infinity,
      errorMm: Infinity,
      pointErrors: new Map(),
      isValid: false,
      warnings: ["Minimum 3 paires de points requis"],
    };
  }

  // Vérifier la colinéarité des points source
  if (arePointsCollinear(srcPoints)) {
    warnings.push("Points sources colinéaires - résultat peut être instable");
  }

  // Vérifier la répartition spatiale
  const coverage = computeSpatialCoverage(srcPoints);
  if (coverage < 0.3) {
    warnings.push("Points trop concentrés - meilleure répartition recommandée");
  }

  // Construction du système Ax = b pour les moindres carrés
  // Pour chaque point: [x' = a*x + b*y + c, y' = d*x + e*y + f]
  // Donc: A = [[x1, y1, 1, 0, 0, 0], [0, 0, 0, x1, y1, 1], ...]
  //       b = [x'1, y'1, x'2, y'2, ...]
  
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < n; i++) {
    const sx = srcPoints[i].x;
    const sy = srcPoints[i].y;
    const dx = dstPoints[i].x;
    const dy = dstPoints[i].y;

    A.push([sx, sy, 1, 0, 0, 0]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1]);
    b.push(dy);
  }

  // Résoudre par moindres carrés (A^T * A * x = A^T * b)
  const params = solveAffineSystem(A, b);

  const matrix: AffineMatrix = [
    [params[0], params[1], params[2]],
    [params[3], params[4], params[5]],
  ];

  // Calculer les erreurs par point
  const pointErrors = new Map<string, number>();
  let totalErrorSq = 0;

  for (let i = 0; i < n; i++) {
    const transformed = applyAffine(matrix, srcPoints[i]);
    const errX = transformed.x - dstPoints[i].x;
    const errY = transformed.y - dstPoints[i].y;
    const errDist = Math.sqrt(errX * errX + errY * errY);
    
    if (pointIds && pointIds[i]) {
      pointErrors.set(pointIds[i], errDist);
    }
    totalErrorSq += errDist * errDist;
  }

  const errorMm = Math.sqrt(totalErrorSq / n);
  
  // Estimer l'échelle moyenne pour convertir l'erreur en pixels
  const scaleX = Math.sqrt(matrix[0][0] * matrix[0][0] + matrix[0][1] * matrix[0][1]);
  const scaleY = Math.sqrt(matrix[1][0] * matrix[1][0] + matrix[1][1] * matrix[1][1]);
  const avgScale = (scaleX + scaleY) / 2;
  const errorPx = errorMm / avgScale;

  // Détecter les outliers (erreur > 3x la moyenne)
  const avgPointError = errorMm;
  pointErrors.forEach((err, id) => {
    if (err > avgPointError * 3) {
      warnings.push(`Point ${id} semble mal placé (erreur: ${err.toFixed(2)}mm)`);
    }
  });

  return {
    matrix,
    error: errorPx,
    errorMm,
    pointErrors,
    isValid: true,
    warnings,
  };
}

/**
 * Applique une transformation affine à un point
 */
export function applyAffine(M: AffineMatrix, point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: M[0][0] * point.x + M[0][1] * point.y + M[0][2],
    y: M[1][0] * point.x + M[1][1] * point.y + M[1][2],
  };
}

/**
 * Inverse une matrice affine
 */
export function invertAffine(M: AffineMatrix): AffineMatrix {
  const [[a, b, c], [d, e, f]] = M;
  const det = a * e - b * d;

  if (Math.abs(det) < 1e-10) {
    throw new Error("Matrice affine non inversible");
  }

  return [
    [e / det, -b / det, (b * f - c * e) / det],
    [-d / det, a / det, (c * d - a * f) / det],
  ];
}

/**
 * Décompose une matrice affine en ses composants
 */
export function decomposeAffine(M: AffineMatrix): {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotation: number; // en radians
  shearX: number;
} {
  const [[a, b, c], [d, e, f]] = M;

  const translateX = c;
  const translateY = f;
  const scaleX = Math.sqrt(a * a + d * d);
  const rotation = Math.atan2(d, a);
  const sin = Math.sin(rotation);
  const cos = Math.cos(rotation);
  const scaleY = (a * e - b * d) / scaleX;
  const shearX = (a * b + d * e) / (a * e - b * d);

  return { translateX, translateY, scaleX, scaleY, rotation, shearX };
}

/**
 * Applique une transformation affine à une image
 */
export function warpImageAffine(
  srcImage: HTMLImageElement,
  M: AffineMatrix,
  outputWidth: number,
  outputHeight: number,
  offsetX: number = 0,
  offsetY: number = 0,
): ImageData {
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = srcImage.width;
  srcCanvas.height = srcImage.height;
  const srcCtx = srcCanvas.getContext("2d")!;
  srcCtx.drawImage(srcImage, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, srcImage.width, srcImage.height);

  const dstData = new ImageData(outputWidth, outputHeight);
  const Minv = invertAffine(M);

  for (let dy = 0; dy < outputHeight; dy++) {
    for (let dx = 0; dx < outputWidth; dx++) {
      const dstX = dx - offsetX;
      const dstY = dy - offsetY;

      const src = applyAffine(Minv, { x: dstX, y: dstY });
      const srcX = src.x + srcImage.width / 2;
      const srcY = src.y + srcImage.height / 2;

      const pixel = bilinearInterpolateData(srcData, srcX, srcY);
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
 * Vérifie si les points sont colinéaires
 */
function arePointsCollinear(points: Array<{ x: number; y: number }>): boolean {
  if (points.length < 3) return true;

  const [p1, p2, ...rest] = points;
  const dx12 = p2.x - p1.x;
  const dy12 = p2.y - p1.y;

  for (const p3 of rest) {
    const dx13 = p3.x - p1.x;
    const dy13 = p3.y - p1.y;
    const cross = Math.abs(dx12 * dy13 - dy12 * dx13);
    if (cross > 1e-6) return false;
  }
  return true;
}

/**
 * Calcule la couverture spatiale des points (0-1)
 */
function computeSpatialCoverage(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const rangeX = maxX - minX;
  const rangeY = maxY - minY;

  // Estimer la taille de l'image à partir de l'étendue des points
  const estimatedSize = Math.max(rangeX, rangeY) * 1.5;
  if (estimatedSize === 0) return 0;

  const area = rangeX * rangeY;
  const fullArea = estimatedSize * estimatedSize;

  return Math.min(1, area / fullArea);
}

/**
 * Résout le système par moindres carrés
 */
function solveAffineSystem(A: number[][], b: number[]): number[] {
  const n = A[0].length; // 6 paramètres
  const m = A.length; // 2 * nombre de points

  // Calculer A^T * A
  const AtA: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < m; k++) {
        AtA[i][j] += A[k][i] * A[k][j];
      }
    }
  }

  // Calculer A^T * b
  const Atb: number[] = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < m; k++) {
      Atb[i] += A[k][i] * b[k];
    }
  }

  // Résoudre AtA * x = Atb par Gauss
  return solveByGauss(AtA, Atb);
}

function solveByGauss(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    if (Math.abs(augmented[col][col]) < 1e-10) {
      continue; // Skip near-zero pivot
    }

    for (let row = col + 1; row < n; row++) {
      const factor = augmented[row][col] / augmented[col][col];
      for (let j = col; j <= n; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = augmented[row][n];
    for (let col = row + 1; col < n; col++) {
      sum -= augmented[row][col] * x[col];
    }
    x[row] = Math.abs(augmented[row][row]) > 1e-10 ? sum / augmented[row][row] : 0;
  }

  return x;
}

/**
 * Interpolation bilinéaire pour ImageData
 */
function bilinearInterpolateData(
  imageData: ImageData,
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number } {
  const w = imageData.width;
  const h = imageData.height;

  if (x < 0 || x >= w - 1 || y < 0 || y >= h - 1) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const dx = x - x0;
  const dy = y - y0;

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

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  return {
    r: Math.round(lerp(lerp(p00.r, p10.r, dx), lerp(p01.r, p11.r, dx), dy)),
    g: Math.round(lerp(lerp(p00.g, p10.g, dx), lerp(p01.g, p11.g, dx), dy)),
    b: Math.round(lerp(lerp(p00.b, p10.b, dx), lerp(p01.b, p11.b, dx), dy)),
    a: Math.round(lerp(lerp(p00.a, p10.a, dx), lerp(p01.a, p11.a, dx), dy)),
  };
}

/**
 * Calcule toutes les paires de distances (y compris diagonales)
 * Retourne un tableau de { srcDist, dstDist, weight } pour chaque paire
 */
function computeAllPairDistances(
  srcPoints: Array<{ x: number; y: number }>,
  dstPoints: Array<{ x: number; y: number }>,
): Array<{ srcDist: number; dstDist: number; srcDx: number; srcDy: number; dstDx: number; dstDy: number; weight: number }> {
  const pairs: Array<{ srcDist: number; dstDist: number; srcDx: number; srcDy: number; dstDx: number; dstDy: number; weight: number }> = [];
  const n = srcPoints.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const srcDx = srcPoints[j].x - srcPoints[i].x;
      const srcDy = srcPoints[j].y - srcPoints[i].y;
      const dstDx = dstPoints[j].x - dstPoints[i].x;
      const dstDy = dstPoints[j].y - dstPoints[i].y;

      const srcDist = Math.sqrt(srcDx * srcDx + srcDy * srcDy);
      const dstDist = Math.sqrt(dstDx * dstDx + dstDy * dstDy);

      if (srcDist > 1e-6) {
        // Pondérer par la distance (les grandes distances sont plus fiables)
        pairs.push({
          srcDist,
          dstDist,
          srcDx,
          srcDy,
          dstDx,
          dstDy,
          weight: srcDist, // Plus la distance est grande, plus le poids est élevé
        });
      }
    }
  }

  return pairs;
}

/**
 * Compare les résultats de différentes méthodes de calibration
 * UTILISE TOUTES LES PAIRES DE POINTS (y compris diagonales) pour une meilleure précision
 */
export function compareCalibrationMethods(
  srcPoints: Array<{ x: number; y: number }>,
  dstPoints: Array<{ x: number; y: number }>,
  pointIds?: string[],
): {
  simple: { error: number; scaleX: number; scaleY: number; pairCount: number };
  anisotrope: { error: number; scaleX: number; scaleY: number; pairCount: number };
  affine: AffineResult;
  recommended: "simple" | "anisotrope" | "affine";
  diagnostics: {
    totalPairs: number;
    diagonalPairs: number;
    maxDistance: number;
    minDistance: number;
  };
} {
  const n = srcPoints.length;
  const pairs = computeAllPairDistances(srcPoints, dstPoints);
  const totalPairs = pairs.length;
  const diagonalPairs = totalPairs - Math.max(0, n - 1); // Paires non-consécutives

  // Statistiques des distances
  const distances = pairs.map(p => p.srcDist);
  const maxDistance = distances.length > 0 ? Math.max(...distances) : 0;
  const minDistance = distances.length > 0 ? Math.min(...distances) : 0;

  // ============================================
  // CALCUL SIMPLE: échelle uniforme pondérée
  // ============================================
  let sumWeightedScale = 0;
  let sumWeights = 0;

  for (const pair of pairs) {
    const scale = pair.dstDist / pair.srcDist;
    sumWeightedScale += scale * pair.weight;
    sumWeights += pair.weight;
  }

  const simpleScale = sumWeights > 0 ? sumWeightedScale / sumWeights : 1;

  // ============================================
  // CALCUL ANISOTROPE: échelles X et Y séparées (pondérées)
  // Utilise la projection des vecteurs sur les axes
  // ============================================
  let sumWeightedScaleX = 0;
  let sumWeightsX = 0;
  let sumWeightedScaleY = 0;
  let sumWeightsY = 0;

  for (const pair of pairs) {
    const absSrcDx = Math.abs(pair.srcDx);
    const absSrcDy = Math.abs(pair.srcDy);
    const absDstDx = Math.abs(pair.dstDx);
    const absDstDy = Math.abs(pair.dstDy);

    // Contribution X (pondérée par la composante X relative)
    if (absSrcDx > 1e-6) {
      const scaleX = absDstDx / absSrcDx;
      const weightX = absSrcDx; // Poids = importance de la composante X
      sumWeightedScaleX += scaleX * weightX;
      sumWeightsX += weightX;
    }

    // Contribution Y (pondérée par la composante Y relative)
    if (absSrcDy > 1e-6) {
      const scaleY = absDstDy / absSrcDy;
      const weightY = absSrcDy;
      sumWeightedScaleY += scaleY * weightY;
      sumWeightsY += weightY;
    }
  }

  const anisotropeScaleX = sumWeightsX > 0 ? sumWeightedScaleX / sumWeightsX : simpleScale;
  const anisotropeScaleY = sumWeightsY > 0 ? sumWeightedScaleY / sumWeightsY : simpleScale;

  // ============================================
  // CALCUL AFFINE: transformation complète
  // ============================================
  const affine = computeAffineTransform(srcPoints, dstPoints, pointIds);

  // ============================================
  // CALCUL DES ERREURS (sur toutes les paires, y compris diagonales)
  // ============================================
  let simpleErrorSum = 0;
  let anisoErrorSum = 0;

  for (const pair of pairs) {
    // Erreur simple: distance transformée vs distance réelle
    const simpleTransformedDist = pair.srcDist * simpleScale;
    const simpleErr = Math.abs(simpleTransformedDist - pair.dstDist);
    simpleErrorSum += simpleErr * simpleErr;

    // Erreur anisotrope: utilise les composantes X et Y séparément
    const anisoTransformedDx = pair.srcDx * anisotropeScaleX;
    const anisoTransformedDy = pair.srcDy * anisotropeScaleY;
    const anisoTransformedDist = Math.sqrt(anisoTransformedDx * anisoTransformedDx + anisoTransformedDy * anisoTransformedDy);
    const anisoErr = Math.abs(anisoTransformedDist - pair.dstDist);
    anisoErrorSum += anisoErr * anisoErr;
  }

  const simpleError = totalPairs > 0 ? Math.sqrt(simpleErrorSum / totalPairs) : 0;
  const anisoError = totalPairs > 0 ? Math.sqrt(anisoErrorSum / totalPairs) : 0;

  // ============================================
  // RECOMMANDATION basée sur l'amélioration relative
  // ============================================
  let recommended: "simple" | "anisotrope" | "affine" = "simple";

  // Anisotrope recommandé si amélioration > 20%
  if (anisoError < simpleError * 0.8) {
    recommended = "anisotrope";
  }

  // Affine recommandé si amélioration > 30% par rapport à anisotrope ET valide
  if (affine.isValid && affine.errorMm < anisoError * 0.7) {
    recommended = "affine";
  }

  return {
    simple: { error: simpleError, scaleX: simpleScale, scaleY: simpleScale, pairCount: totalPairs },
    anisotrope: { error: anisoError, scaleX: anisotropeScaleX, scaleY: anisotropeScaleY, pairCount: totalPairs },
    affine,
    recommended,
    diagnostics: {
      totalPairs,
      diagonalPairs,
      maxDistance,
      minDistance,
    },
  };
}

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
