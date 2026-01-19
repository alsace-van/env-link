// ============================================
// HOOK: useCalibration
// Gestion de la calibration des images CAD
// VERSION: 1.1 - Correction mode anisotrope + logs debug
// ============================================
//
// CHANGELOG v1.1 (17/01/2026):
// - Correction du bug mode anisotrope (condition mode === "anisotrope" manquante)
// - Correction formule stretchX/stretchY (referenceScale = 1 mm/px)
// - Ajout de 21 console.log pour debug détaillé
// - Message toast amélioré avec scaleX/scaleY séparés
// - Classification des paires par orientation (dx > dy = X)
//
// CHANGELOG v1.0:
// - Extraction depuis CADGabaritCanvas.tsx (~850 lignes)
// ============================================

import { useCallback } from "react";
import { toast } from "sonner";
import {
  CalibrationData,
  CalibrationPoint,
  CalibrationPair,
  BackgroundImage,
  Sketch,
  HomographyMatrix,
  DistortionCoefficients,
  CALIBRATION_COLORS,
  distance,
  generateId,
} from "./types";
import {
  createRectifyingHomography,
  calibrateWithCheckerboard,
  computeTransformedBounds,
  warpImage,
  undistortImage,
  undistortPoint,
  transformPoint,
} from "./homography";

// ============================================
// TYPES
// ============================================

export interface UseCalibrationProps {
  // États
  selectedImageId: string | null;
  backgroundImages: BackgroundImage[];
  calibrationData: CalibrationData;
  sketch: Sketch;
  sketchRef: React.MutableRefObject<Sketch>;
  backgroundImageRef: React.MutableRefObject<HTMLImageElement | null>;

  // Mode perspective
  rectPoints: string[];
  rectWidth: string;
  rectHeight: string;
  perspectiveMethod: "rectangle" | "checkerboard";
  checkerCornersX: string;
  checkerCornersY: string;
  checkerSquareSize: string;

  // Setters
  setBackgroundImages: React.Dispatch<React.SetStateAction<BackgroundImage[]>>;
  setCalibrationData: React.Dispatch<React.SetStateAction<CalibrationData>>;
  setSketch: React.Dispatch<React.SetStateAction<Sketch>>;
  setCalibrationMode: React.Dispatch<
    React.SetStateAction<"idle" | "addPoint" | "selectPair1" | "selectPair2" | "selectRect">
  >;
  setSelectedCalibrationPoint: React.Dispatch<React.SetStateAction<string | null>>;
  setRectPoints: React.Dispatch<React.SetStateAction<string[]>>;
  setRectWidth: React.Dispatch<React.SetStateAction<string>>;
  setRectHeight: React.Dispatch<React.SetStateAction<string>>;
  setImageScale: React.Dispatch<React.SetStateAction<number>>;
  setTransformedImage: React.Dispatch<React.SetStateAction<HTMLCanvasElement | null>>;
}

export interface UseCalibrationReturn {
  getSelectedImage: () => BackgroundImage | null;
  getSelectedImageCalibration: () => CalibrationData;
  updateSelectedImageCalibration: (updater: (prev: CalibrationData) => CalibrationData) => void;
  calculateCalibration: () => void;
  applyCalibration: () => Promise<void>;
  resetCalibration: () => void;
  addCalibrationPoint: (x: number, y: number) => CalibrationPoint;
  removeCalibrationPoint: (pointId: string) => void;
  addCalibrationPair: (point1Id: string, point2Id: string, distanceMm: number) => CalibrationPair | null;
  removeCalibrationPair: (pairId: string) => void;
  updatePairDistance: (pairId: string, distanceMm: number) => void;
}

// ============================================
// HOOK
// ============================================

export function useCalibration({
  selectedImageId,
  backgroundImages,
  calibrationData,
  sketch,
  sketchRef,
  backgroundImageRef,
  rectPoints,
  rectWidth,
  rectHeight,
  perspectiveMethod,
  checkerCornersX,
  checkerCornersY,
  checkerSquareSize,
  setBackgroundImages,
  setCalibrationData,
  setSketch,
  setCalibrationMode,
  setSelectedCalibrationPoint,
  setRectPoints,
  setRectWidth,
  setRectHeight,
  setImageScale,
  setTransformedImage,
}: UseCalibrationProps): UseCalibrationReturn {
  // ============================================
  // GETTERS
  // ============================================

  const getSelectedImage = useCallback((): BackgroundImage | null => {
    if (!selectedImageId) return null;
    return backgroundImages.find((img) => img.id === selectedImageId) || null;
  }, [selectedImageId, backgroundImages]);

  const getSelectedImageCalibration = useCallback((): CalibrationData => {
    const selectedImage = getSelectedImage();
    if (selectedImage?.calibrationData) {
      return selectedImage.calibrationData;
    }
    // Retourner les données par défaut
    return {
      points: new Map(),
      pairs: new Map(),
      applied: false,
      mode: "simple",
    };
  }, [getSelectedImage]);

  const updateSelectedImageCalibration = useCallback(
    (updater: (prev: CalibrationData) => CalibrationData) => {
      if (!selectedImageId) return;
      setBackgroundImages((prev) =>
        prev.map((img) => {
          if (img.id !== selectedImageId) return img;
          const currentCalib = img.calibrationData || {
            points: new Map(),
            pairs: new Map(),
            applied: false,
            mode: "simple" as const,
          };
          return { ...img, calibrationData: updater(currentCalib) };
        }),
      );
    },
    [selectedImageId, setBackgroundImages],
  );

  // ============================================
  // GESTION DES POINTS
  // ============================================

  const addCalibrationPoint = useCallback(
    (x: number, y: number): CalibrationPoint => {
      const imgCalib = getSelectedImageCalibration();
      const pointNumber = imgCalib.points.size + 1;

      const newPoint: CalibrationPoint = {
        id: generateId(),
        x,
        y,
        label: `${pointNumber}`,
      };

      updateSelectedImageCalibration((prev) => {
        const newPoints = new Map(prev.points);
        newPoints.set(newPoint.id, newPoint);
        return { ...prev, points: newPoints };
      });

      return newPoint;
    },
    [getSelectedImageCalibration, updateSelectedImageCalibration],
  );

  const removeCalibrationPoint = useCallback(
    (pointId: string) => {
      updateSelectedImageCalibration((prev) => {
        const newPoints = new Map(prev.points);
        newPoints.delete(pointId);

        // Supprimer aussi les paires qui utilisent ce point
        const newPairs = new Map(prev.pairs);
        newPairs.forEach((pair, pairId) => {
          if (pair.point1Id === pointId || pair.point2Id === pointId) {
            newPairs.delete(pairId);
          }
        });

        return { ...prev, points: newPoints, pairs: newPairs };
      });
    },
    [updateSelectedImageCalibration],
  );

  // ============================================
  // GESTION DES PAIRES
  // ============================================

  const addCalibrationPair = useCallback(
    (point1Id: string, point2Id: string, distanceMm: number): CalibrationPair | null => {
      const imgCalib = getSelectedImageCalibration();

      const p1 = imgCalib.points.get(point1Id);
      const p2 = imgCalib.points.get(point2Id);

      if (!p1 || !p2) {
        toast.error("Points invalides");
        return null;
      }

      // Vérifier si cette paire existe déjà
      let pairExists = false;
      imgCalib.pairs.forEach((pair) => {
        if (
          (pair.point1Id === point1Id && pair.point2Id === point2Id) ||
          (pair.point1Id === point2Id && pair.point2Id === point1Id)
        ) {
          pairExists = true;
        }
      });

      if (pairExists) {
        toast.error("Cette paire existe déjà");
        return null;
      }

      const distPx = distance(p1, p2);
      const colorIndex = imgCalib.pairs.size % CALIBRATION_COLORS.length;

      const newPair: CalibrationPair = {
        id: generateId(),
        point1Id,
        point2Id,
        distanceMm,
        distancePx: distPx,
        color: CALIBRATION_COLORS[colorIndex],
      };

      updateSelectedImageCalibration((prev) => {
        const newPairs = new Map(prev.pairs);
        newPairs.set(newPair.id, newPair);
        return { ...prev, pairs: newPairs };
      });

      return newPair;
    },
    [getSelectedImageCalibration, updateSelectedImageCalibration],
  );

  const removeCalibrationPair = useCallback(
    (pairId: string) => {
      updateSelectedImageCalibration((prev) => {
        const newPairs = new Map(prev.pairs);
        newPairs.delete(pairId);
        return { ...prev, pairs: newPairs };
      });
    },
    [updateSelectedImageCalibration],
  );

  const updatePairDistance = useCallback(
    (pairId: string, distanceMm: number) => {
      updateSelectedImageCalibration((prev) => {
        const newPairs = new Map(prev.pairs);
        const pair = newPairs.get(pairId);
        if (pair) {
          newPairs.set(pairId, { ...pair, distanceMm });
        }
        return { ...prev, pairs: newPairs };
      });
    },
    [updateSelectedImageCalibration],
  );

  // ============================================
  // CALCUL DE CALIBRATION
  // MOD: Calibration anisotrope - calcule scaleX et scaleY séparément
  // ============================================

  const calculateCalibration = useCallback(() => {
    const imgCalib = getSelectedImageCalibration();

    if (imgCalib.pairs.size === 0) {
      toast.error("Ajoutez au moins une paire de calibration");
      return;
    }

    // Séparer les paires par orientation
    let totalScaleX = 0;
    let countX = 0;
    let totalScaleY = 0;
    let countY = 0;

    console.log("[calculateCalibration] Analyse des paires:");
    imgCalib.pairs.forEach((pair, pairId) => {
      const p1 = imgCalib.points.get(pair.point1Id);
      const p2 = imgCalib.points.get(pair.point2Id);
      if (p1 && p2 && pair.distanceMm > 0) {
        const dx = Math.abs(p2.x - p1.x);
        const dy = Math.abs(p2.y - p1.y);
        const distPx = distance(p1, p2);
        const scale = pair.distanceMm / distPx;

        const direction = dx > dy ? "HORIZONTAL (X)" : "VERTICAL (Y)";
        console.log(
          `  Paire ${pairId.slice(0, 6)}: dx=${dx.toFixed(1)}, dy=${dy.toFixed(1)} → ${direction}, scale=${scale.toFixed(4)}`,
        );

        // Paire horizontale si |Δx| > |Δy|, sinon verticale
        if (dx > dy) {
          totalScaleX += scale;
          countX++;
        } else {
          totalScaleY += scale;
          countY++;
        }
      }
    });

    console.log(`[calculateCalibration] Résumé: ${countX} paires X, ${countY} paires Y`);

    if (countX === 0 && countY === 0) {
      toast.error("Aucune paire valide");
      return;
    }

    // Calculer les échelles (fallback sur l'autre axe si pas de paires)
    const scaleX = countX > 0 ? totalScaleX / countX : countY > 0 ? totalScaleY / countY : 1 / sketch.scaleFactor;
    const scaleY = countY > 0 ? totalScaleY / countY : countX > 0 ? totalScaleX / countX : 1 / sketch.scaleFactor;
    const avgScale = (scaleX + scaleY) / 2;

    // Calculer les erreurs par axe
    let totalErrorX = 0;
    let totalErrorY = 0;
    let errorCountX = 0;
    let errorCountY = 0;

    imgCalib.pairs.forEach((pair) => {
      const p1 = imgCalib.points.get(pair.point1Id);
      const p2 = imgCalib.points.get(pair.point2Id);
      if (p1 && p2 && pair.distanceMm > 0) {
        const dx = Math.abs(p2.x - p1.x);
        const dy = Math.abs(p2.y - p1.y);
        const distPx = distance(p1, p2);

        if (dx > dy) {
          const calculatedMm = distPx * scaleX;
          const error = (Math.abs(calculatedMm - pair.distanceMm) / pair.distanceMm) * 100;
          totalErrorX += error;
          errorCountX++;
        } else {
          const calculatedMm = distPx * scaleY;
          const error = (Math.abs(calculatedMm - pair.distanceMm) / pair.distanceMm) * 100;
          totalErrorY += error;
          errorCountY++;
        }
      }
    });

    const errorX = errorCountX > 0 ? totalErrorX / errorCountX : 0;
    const errorY = errorCountY > 0 ? totalErrorY / errorCountY : 0;
    const avgError = (errorX * errorCountX + errorY * errorCountY) / (errorCountX + errorCountY || 1);

    // Mettre à jour la calibration de l'image
    updateSelectedImageCalibration((prev) => ({
      ...prev,
      scale: avgScale,
      scaleX: scaleX,
      scaleY: scaleY,
      error: avgError,
      errorX: errorX,
      errorY: errorY,
    }));

    // Aussi mettre à jour calibrationData global pour activer le bouton "Appliquer"
    setCalibrationData((prev) => ({
      ...prev,
      scale: avgScale,
      scaleX: scaleX,
      scaleY: scaleY,
      error: avgError,
      errorX: errorX,
      errorY: errorY,
    }));

    // MOD: Toujours afficher les échelles X et Y séparément
    // Même si la différence est faible, c'est utile pour le diagnostic
    const diffPercent = (Math.abs(scaleX - scaleY) / avgScale) * 100;
    toast.success(
      `Échelle X=${scaleX.toFixed(4)} mm/px (${countX} paires), Y=${scaleY.toFixed(4)} mm/px (${countY} paires). Diff: ${diffPercent.toFixed(1)}%`,
      { duration: 2000 }, // 2 secondes au lieu de la durée par défaut
    );

    console.log("[calculateCalibration] scaleX:", scaleX, "scaleY:", scaleY, "diff:", diffPercent.toFixed(2) + "%");
  }, [getSelectedImageCalibration, updateSelectedImageCalibration, sketch.scaleFactor, setCalibrationData]);

  // ============================================
  // APPLICATION DE LA CALIBRATION
  // MOD: Toujours étirer l'image pour correspondre aux mesures réelles
  // ============================================

  const applyCalibration = useCallback(async () => {
    const imgCalib = getSelectedImageCalibration();
    const selectedImage = getSelectedImage();

    console.log("[applyCalibration] Début");
    console.log("[applyCalibration] imgCalib:", imgCalib);
    console.log("[applyCalibration] calibrationData:", calibrationData);

    // FIX v7.34: Empêcher l'application multiple de la calibration
    if (imgCalib.applied || selectedImage?.calibrationData?.applied) {
      toast.warning("La calibration a déjà été appliquée. Réinitialisez d'abord pour recalibrer.");
      console.log("[applyCalibration] Calibration déjà appliquée, abandon");
      return;
    }

    // Mode simple ou anisotrope : échelle uniforme ou anisotrope
    if (calibrationData.mode === "simple" || calibrationData.mode === "anisotrope" || !calibrationData.mode) {
      const scaleX = imgCalib.scaleX || imgCalib.scale || calibrationData.scaleX || calibrationData.scale;
      const scaleY = imgCalib.scaleY || imgCalib.scale || calibrationData.scaleY || calibrationData.scale;

      console.log("[applyCalibration] scaleX:", scaleX, "scaleY:", scaleY);
      console.log(
        "[applyCalibration] Sources - imgCalib.scaleX:",
        imgCalib.scaleX,
        "imgCalib.scaleY:",
        imgCalib.scaleY,
      );
      console.log(
        "[applyCalibration] Sources - calibrationData.scaleX:",
        calibrationData.scaleX,
        "calibrationData.scaleY:",
        calibrationData.scaleY,
      );

      if (!scaleX || !scaleY) {
        toast.error("Calculez d'abord la calibration");
        return;
      }

      if (!selectedImage) {
        toast.error("Sélectionnez d'abord une image");
        return;
      }

      const currentSketch = sketchRef.current;
      const oldImageScale = selectedImage.scale || 1;
      const originalPoints = new Map(imgCalib.points);

      console.log("[applyCalibration] Échelle actuelle du sketch:", currentSketch.scaleFactor, "px/mm");
      console.log("[applyCalibration] Nouvelles échelles - scaleX:", scaleX, "mm/px, scaleY:", scaleY, "mm/px");

      // L'échelle de référence sera 1 mm/px (échelle standard)
      // Si scaleX = 1.08 mm/px (500px = 540mm), pour afficher 540mm avec scaleFactor=1,
      // il faut étirer l'image de 1.08x (500px → 540px)
      const referenceScaleMmPerPx = 1; // 1 mm = 1 px comme référence

      // Calculer le ratio d'étirement pour chaque axe
      // stretchX = scaleX (car on étire pour que distance_px × scaleX = distance_mm)
      // Exemple : 500px × 1.08 = 540mm, donc stretch de 1.08x → 540px
      const stretchX = scaleX / referenceScaleMmPerPx;
      const stretchY = scaleY / referenceScaleMmPerPx;

      // Le nouveau scaleFactor sera 1 px/mm (car on a étiré l'image pour correspondre)
      const newScaleFactor = 1 / referenceScaleMmPerPx; // = 1 px/mm

      console.log("[applyCalibration] stretchX:", stretchX, "(image ×", stretchX.toFixed(2), ")");
      console.log("[applyCalibration] stretchY:", stretchY, "(image ×", stretchY.toFixed(2), ")");
      console.log("[applyCalibration] newScaleFactor:", newScaleFactor, "px/mm");

      // MOD: Toujours créer un canvas transformé pour appliquer l'étirement
      let transformedCanvas: HTMLCanvasElement | null = null;

      const sourceImage = selectedImage.croppedCanvas || selectedImage.image;
      console.log(
        "[applyCalibration] sourceImage:",
        sourceImage ? `${sourceImage.width}x${sourceImage.height}` : "null",
      );

      if (sourceImage) {
        const srcWidth = sourceImage instanceof HTMLCanvasElement ? sourceImage.width : sourceImage.width;
        const srcHeight = sourceImage instanceof HTMLCanvasElement ? sourceImage.height : sourceImage.height;

        // Nouvelles dimensions après étirement
        const newWidth = Math.round(srcWidth * stretchX);
        const newHeight = Math.round(srcHeight * stretchY);

        console.log("[applyCalibration] Dimensions:", srcWidth, "x", srcHeight, "→", newWidth, "x", newHeight);

        transformedCanvas = document.createElement("canvas");
        transformedCanvas.width = newWidth;
        transformedCanvas.height = newHeight;
        const tctx = transformedCanvas.getContext("2d");
        if (tctx) {
          tctx.drawImage(sourceImage, 0, 0, newWidth, newHeight);
          console.log("[applyCalibration] Canvas créé:", newWidth, "x", newHeight);
        } else {
          console.error("[applyCalibration] Impossible de créer le contexte 2D");
        }
      } else {
        console.error("[applyCalibration] Pas d'image source");
      }

      // Transformer les points de calibration pour suivre l'étirement de l'image
      const transformedPoints = new Map<string, CalibrationPoint>();
      imgCalib.points.forEach((point, id) => {
        transformedPoints.set(id, {
          ...point,
          x: point.x * stretchX,
          y: point.y * stretchY,
        });
      });

      // Mettre à jour le sketch avec le nouveau scaleFactor
      setSketch((prev) => ({
        ...prev,
        scaleFactor: newScaleFactor,
      }));

      // Mettre à jour l'image avec le canvas transformé
      console.log(
        "[applyCalibration] Mise à jour backgroundImages avec transformedCanvas:",
        transformedCanvas ? "OUI" : "NON",
      );

      setBackgroundImages((prev) =>
        prev.map((img) => {
          if (img.id !== selectedImage.id) return img;
          return {
            ...img,
            scale: 1,
            transformedCanvas: transformedCanvas || img.transformedCanvas,
            calibrationData: {
              ...(img.calibrationData || { points: new Map(), pairs: new Map(), mode: "simple" as const }),
              points: transformedPoints,
              scale: referenceScaleMmPerPx,
              scaleX: scaleX,
              scaleY: scaleY,
              stretchX: stretchX,
              stretchY: stretchY,
              originalPoints: originalPoints,
              originalImageScale: oldImageScale,
              originalScaleFactor: currentSketch.scaleFactor,
              applied: true as const,
            },
          };
        }),
      );

      // Mettre à jour calibrationData avec les points transformés
      setCalibrationData((prev) => ({
        ...prev,
        points: transformedPoints,
        originalPoints: originalPoints,
        originalImageScale: oldImageScale,
        originalScaleFactor: currentSketch.scaleFactor,
        scale: referenceScaleMmPerPx,
        scaleX: scaleX,
        scaleY: scaleY,
        stretchX: stretchX,
        stretchY: stretchY,
        applied: true,
      }));

      // Message de succès avec détails sur l'étirement
      const hasStretch = stretchX !== 1 || stretchY !== 1;
      if (hasStretch) {
        toast.success(`Calibration appliquée ! Photo étirée (X×${stretchX.toFixed(2)}, Y×${stretchY.toFixed(2)})`);
      } else {
        toast.success(`Calibration appliquée ! Pas d'étirement nécessaire (échelle = 1 mm/px)`);
      }

      console.log(
        "[applyCalibration] SUCCÈS - Canvas transformé:",
        transformedCanvas ? `${transformedCanvas.width}x${transformedCanvas.height}` : "non créé",
      );
      return;
    }

    // Mode perspective : correction de déformation
    if (calibrationData.mode === "perspective") {
      if (rectPoints.length !== 4) {
        toast.error("Sélectionnez 4 points pour la référence");
        return;
      }

      const perspectiveImage = selectedImage?.image || backgroundImageRef.current;
      if (!perspectiveImage) {
        toast.error("Aucune image de fond chargée");
        return;
      }

      const quadPoints = rectPoints.map((id) => {
        const point = calibrationData.points.get(id);
        if (!point) throw new Error(`Point ${id} non trouvé`);
        return { x: point.x, y: point.y };
      });

      try {
        let H: HomographyMatrix;
        let mmPerPx: number;
        let distortion: DistortionCoefficients | undefined;

        if (perspectiveMethod === "rectangle") {
          const widthMm = parseFloat(rectWidth.replace(",", "."));
          const heightMm = parseFloat(rectHeight.replace(",", "."));

          if (isNaN(widthMm) || widthMm <= 0 || isNaN(heightMm) || heightMm <= 0) {
            toast.error("Entrez les dimensions du rectangle (largeur et hauteur en mm)");
            return;
          }

          const result = createRectifyingHomography(
            quadPoints,
            widthMm,
            heightMm,
            perspectiveImage.width,
            perspectiveImage.height,
          );
          H = result.H;
          mmPerPx = 1 / result.scale;
        } else {
          const cornersX = parseInt(checkerCornersX);
          const cornersY = parseInt(checkerCornersY);
          const squareSize = parseFloat(checkerSquareSize.replace(",", "."));

          if (isNaN(cornersX) || cornersX < 2 || isNaN(cornersY) || cornersY < 2) {
            toast.error("Configuration du damier invalide");
            return;
          }
          if (isNaN(squareSize) || squareSize <= 0) {
            toast.error("Entrez la taille d'une case en mm");
            return;
          }

          const result = calibrateWithCheckerboard(
            quadPoints,
            cornersX,
            cornersY,
            squareSize,
            perspectiveImage.width,
            perspectiveImage.height,
          );
          H = result.homography;
          mmPerPx = result.scale;
          distortion = result.distortion;
        }

        const bounds = computeTransformedBounds(H, perspectiveImage.width, perspectiveImage.height);

        let finalImageData: ImageData;

        if (distortion && (Math.abs(distortion.k1) > 0.001 || Math.abs(distortion.k2) > 0.001)) {
          const undistorted = undistortImage(perspectiveImage, distortion);

          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = undistorted.width;
          tempCanvas.height = undistorted.height;
          const tempCtx = tempCanvas.getContext("2d")!;
          tempCtx.putImageData(undistorted, 0, 0);

          const tempImage = document.createElement("img") as HTMLImageElement;
          tempImage.src = tempCanvas.toDataURL();
          await new Promise<void>((resolve) => {
            tempImage.onload = () => resolve();
          });

          finalImageData = warpImage(
            tempImage,
            H,
            Math.ceil(bounds.width),
            Math.ceil(bounds.height),
            Math.ceil(bounds.width / 2),
            Math.ceil(bounds.height / 2),
          );
        } else {
          finalImageData = warpImage(
            perspectiveImage,
            H,
            Math.ceil(bounds.width),
            Math.ceil(bounds.height),
            Math.ceil(bounds.width / 2),
            Math.ceil(bounds.height / 2),
          );
        }

        const warpedCanvas = document.createElement("canvas");
        warpedCanvas.width = finalImageData.width;
        warpedCanvas.height = finalImageData.height;
        const ctx = warpedCanvas.getContext("2d")!;
        ctx.putImageData(finalImageData, 0, 0);

        setTransformedImage(warpedCanvas);

        // Transformer les points de calibration
        const newCalibPoints = new Map<string, CalibrationPoint>();
        calibrationData.points.forEach((point, id) => {
          let srcX = point.x - perspectiveImage.width / 2;
          let srcY = point.y - perspectiveImage.height / 2;

          if (distortion) {
            const undist = undistortPoint(
              { x: srcX, y: srcY },
              distortion,
              perspectiveImage.width,
              perspectiveImage.height,
            );
            srcX = undist.x;
            srcY = undist.y;
          }

          const transformed = transformPoint(H, { x: srcX, y: srcY });
          newCalibPoints.set(id, {
            ...point,
            x: transformed.x * mmPerPx,
            y: transformed.y * mmPerPx,
          });
        });

        // Transformer les points du sketch
        const newSketchPoints = new Map(sketch.points);
        newSketchPoints.forEach((point, id) => {
          let srcX = point.x - perspectiveImage.width / 2;
          let srcY = point.y - perspectiveImage.height / 2;

          if (distortion) {
            const undist = undistortPoint(
              { x: srcX, y: srcY },
              distortion,
              perspectiveImage.width,
              perspectiveImage.height,
            );
            srcX = undist.x;
            srcY = undist.y;
          }

          const transformed = transformPoint(H, { x: srcX, y: srcY });
          newSketchPoints.set(id, {
            ...point,
            x: transformed.x * mmPerPx,
            y: transformed.y * mmPerPx,
          });
        });

        // Convertir les géométries avec rayon
        const newGeometries = new Map(sketch.geometries);
        newGeometries.forEach((geo, id) => {
          if (geo.type === "circle") {
            const circle = geo as any;
            newGeometries.set(id, {
              ...circle,
              radius: circle.radius * mmPerPx,
            });
          }
        });

        setImageScale(mmPerPx);

        setCalibrationData((prev) => ({
          ...prev,
          points: newCalibPoints,
          applied: true,
          perspectiveMethod,
          homography: H,
          distortion,
          referenceRect:
            perspectiveMethod === "rectangle"
              ? {
                  pointIds: rectPoints,
                  widthMm: parseFloat(rectWidth.replace(",", ".")),
                  heightMm: parseFloat(rectHeight.replace(",", ".")),
                }
              : undefined,
          checkerboard:
            perspectiveMethod === "checkerboard"
              ? {
                  cornersX: parseInt(checkerCornersX),
                  cornersY: parseInt(checkerCornersY),
                  squareSizeMm: parseFloat(checkerSquareSize.replace(",", ".")),
                  cornerPointIds: rectPoints,
                }
              : undefined,
        }));

        setSketch((prev) => ({
          ...prev,
          points: newSketchPoints,
          geometries: newGeometries,
          scaleFactor: 1,
        }));

        const methodLabel =
          perspectiveMethod === "rectangle"
            ? `Rectangle ${rectWidth}×${rectHeight} mm`
            : `Damier ${parseInt(checkerCornersX) + 1}×${parseInt(checkerCornersY) + 1} cases`;
        toast.success(`Correction de perspective appliquée ! ${methodLabel}`);

        if (distortion && (Math.abs(distortion.k1) > 0.01 || Math.abs(distortion.k2) > 0.01)) {
          toast.info(`Distorsion radiale corrigée (k1=${distortion.k1.toFixed(4)}, k2=${distortion.k2.toFixed(4)})`);
        }
      } catch (error) {
        console.error("Erreur calibration:", error);
        toast.error(`Erreur: ${error instanceof Error ? error.message : "Calcul impossible"}`);
      }
    }
  }, [
    calibrationData,
    sketch,
    rectPoints,
    rectWidth,
    rectHeight,
    perspectiveMethod,
    checkerCornersX,
    checkerCornersY,
    checkerSquareSize,
    getSelectedImageCalibration,
    getSelectedImage,
    updateSelectedImageCalibration,
    sketchRef,
    backgroundImageRef,
    setBackgroundImages,
    setCalibrationData,
    setSketch,
    setImageScale,
    setTransformedImage,
  ]);

  // ============================================
  // RESET CALIBRATION
  // MOD: Restaure les points originaux et l'échelle de l'image
  // ============================================

  const resetCalibration = useCallback(() => {
    const imgCalib = getSelectedImageCalibration();
    const selectedImage = getSelectedImage();

    if (imgCalib.applied && imgCalib.originalPoints && imgCalib.originalImageScale !== undefined && selectedImage) {
      const originalPoints = imgCalib.originalPoints;
      const originalImageScale = imgCalib.originalImageScale;

      setBackgroundImages((prev) =>
        prev.map((img) => {
          if (img.id !== selectedImage.id) return img;
          return {
            ...img,
            scale: originalImageScale,
            transformedCanvas: undefined, // Supprimer le canvas transformé
            calibrationData: {
              ...(img.calibrationData || { points: new Map(), pairs: new Map(), mode: "simple" as const }),
              points: originalPoints,
              scale: undefined,
              scaleX: undefined,
              scaleY: undefined,
              stretchX: undefined,
              stretchY: undefined,
              originalPoints: undefined,
              originalImageScale: undefined,
              applied: false,
            },
          };
        }),
      );

      setCalibrationData((prev) => ({
        ...prev,
        points: originalPoints,
        scale: undefined,
        scaleX: undefined,
        scaleY: undefined,
        stretchX: undefined,
        stretchY: undefined,
        originalPoints: undefined,
        originalImageScale: undefined,
        applied: false,
      }));

      toast.success("Calibration annulée - image et points restaurés");
    } else {
      setCalibrationData({
        points: new Map(),
        pairs: new Map(),
        applied: false,
        mode: "simple",
      });
      toast.success("Points de calibration supprimés");
    }

    setCalibrationMode("idle");
    setSelectedCalibrationPoint(null);
    setRectPoints([]);
    setRectWidth("");
    setRectHeight("");
    setImageScale(1);
    setTransformedImage(null);
  }, [
    getSelectedImageCalibration,
    getSelectedImage,
    setBackgroundImages,
    setCalibrationData,
    setCalibrationMode,
    setSelectedCalibrationPoint,
    setRectPoints,
    setRectWidth,
    setRectHeight,
    setImageScale,
    setTransformedImage,
  ]);

  // ============================================
  // RETURN
  // ============================================

  return {
    getSelectedImage,
    getSelectedImageCalibration,
    updateSelectedImageCalibration,
    calculateCalibration,
    applyCalibration,
    resetCalibration,
    addCalibrationPoint,
    removeCalibrationPoint,
    addCalibrationPair,
    removeCalibrationPair,
    updatePairDistance,
  };
}
