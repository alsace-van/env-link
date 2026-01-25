// ============================================
// HOOK: usePhotoPreparation
// Gestion de l'état principal pour la préparation des photos
// VERSION: 1.2.4
// ============================================
//
// Changelog (3 dernières versions) :
// - v1.2.4 (2025-01-25) : Export avec skewX ET skewY (bandes ou grille)
// - v1.2.3 (2025-01-25) : FIX calculateDistanceMm avec skewX/skewY
// - v1.2.1 (2025-01-25) : Export avec correction perspective (skewX par bandes)
//
// Historique complet : voir REFACTORING_PHOTO_PREPARATION.md
// ============================================

import { useReducer, useCallback, useRef } from "react";
import {
  PhotoPreparationState,
  PhotoPreparationAction,
  PhotoToProcess,
  PreparedPhoto,
  Measurement,
  MeasurePoint,
  ImageCropData,
  ArucoDetectionResult,
  PreparationStep,
  PreparationStatus,
  createEmptyPhoto,
  generateId,
  getNextMeasureColor,
  STRETCH_INCREMENT_NORMAL,
  STRETCH_INCREMENT_FINE,
  STRETCH_INCREMENT_FAST,
} from "./types";

// === ÉTAT INITIAL ===

const initialState: PhotoPreparationState = {
  step: "grid",
  photos: [],
  currentPhotoIndex: 0,
  activeTool: "none",
  currentMeasurements: [],
  pendingMeasurePoint: null,
  scaleFactor: 1, // Sera mis à jour par ArUco ou manuellement
  isLoading: false,
  loadingMessage: "",
};

// === REDUCER ===

function reducer(
  state: PhotoPreparationState,
  action: PhotoPreparationAction
): PhotoPreparationState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };

    case "ADD_PHOTOS": {
      const newPhotos = action.files.map(({ file, id }) => createEmptyPhoto(file, id));
      return { ...state, photos: [...state.photos, ...newPhotos] };
    }

    case "REMOVE_PHOTO":
      return {
        ...state,
        photos: state.photos.filter((p) => p.id !== action.photoId),
        currentPhotoIndex: Math.min(
          state.currentPhotoIndex,
          Math.max(0, state.photos.length - 2)
        ),
      };

    case "REMOVE_DUPLICATES":
      return {
        ...state,
        photos: state.photos.filter((p) => !p.isDuplicate),
      };

    case "SET_CURRENT_INDEX":
      return {
        ...state,
        currentPhotoIndex: Math.max(
          0,
          Math.min(action.index, state.photos.length - 1)
        ),
        // Reset les mesures quand on change de photo
        currentMeasurements: [],
        pendingMeasurePoint: null,
        activeTool: "none",
      };

    case "SET_PHOTO_STATUS":
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.photoId ? { ...p, status: action.status } : p
        ),
      };

    case "ROTATE_PHOTO":
      // v1.1.0: Rotation par pas de 90° (maintient la compatibilité)
      return {
        ...state,
        photos: state.photos.map((p) => {
          if (p.id !== action.photoId) return p;
          const delta = action.direction === "cw" ? 90 : -90;
          // Normaliser entre -180 et 180
          let newRotation = p.rotation + delta;
          if (newRotation > 180) newRotation -= 360;
          if (newRotation <= -180) newRotation += 360;
          return { ...p, rotation: newRotation };
        }),
      };

    // v1.1.0: Rotation libre à n'importe quel angle
    case "SET_ROTATION":
      return {
        ...state,
        photos: state.photos.map((p) => {
          if (p.id !== action.photoId) return p;
          // Normaliser entre -180 et 180
          let rotation = action.rotation;
          while (rotation > 180) rotation -= 360;
          while (rotation <= -180) rotation += 360;
          return { ...p, rotation };
        }),
      };

    case "SET_CROP":
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.photoId ? { ...p, crop: action.crop } : p
        ),
      };

    case "SET_STRETCH":
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.photoId
            ? { ...p, stretchX: action.stretchX, stretchY: action.stretchY }
            : p
        ),
      };

    // v1.2.0: Correction de perspective (cisaillement)
    case "SET_SKEW":
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.photoId
            ? { ...p, skewX: action.skewX, skewY: action.skewY }
            : p
        ),
      };

    case "SET_ARUCO_RESULT":
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.photoId
            ? {
                ...p,
                arucoDetected: action.result.markers.length > 0,
                arucoScaleX: action.result.scaleX,
                arucoScaleY: action.result.scaleY,
              }
            : p
        ),
      };

    case "SET_ACTIVE_TOOL":
      return {
        ...state,
        activeTool: action.tool,
        pendingMeasurePoint: action.tool !== "measure" ? null : state.pendingMeasurePoint,
      };

    case "ADD_MEASUREMENT":
      return {
        ...state,
        currentMeasurements: [...state.currentMeasurements, action.measurement],
        pendingMeasurePoint: null,
      };

    case "REMOVE_MEASUREMENT":
      return {
        ...state,
        currentMeasurements: state.currentMeasurements.filter(
          (m) => m.id !== action.measurementId
        ),
      };

    case "UPDATE_MEASUREMENT_POINT":
      return {
        ...state,
        currentMeasurements: state.currentMeasurements.map((m) => {
          if (m.id !== action.measurementId) return m;
          if (action.pointIndex === 1) {
            return { ...m, point1: { ...m.point1, xPercent: action.xPercent, yPercent: action.yPercent } };
          } else {
            return { ...m, point2: { ...m.point2, xPercent: action.xPercent, yPercent: action.yPercent } };
          }
        }),
      };

    // v1.2.0: Définir la valeur cible d'une mesure (pour correction perspective)
    case "SET_MEASUREMENT_TARGET":
      return {
        ...state,
        currentMeasurements: state.currentMeasurements.map((m) =>
          m.id === action.measurementId
            ? { ...m, targetValueMm: action.targetValueMm }
            : m
        ),
      };

    case "CLEAR_MEASUREMENTS":
      return {
        ...state,
        currentMeasurements: [],
        pendingMeasurePoint: null,
      };

    case "SET_PENDING_MEASURE_POINT":
      return { ...state, pendingMeasurePoint: action.point };

    case "UPDATE_PHOTO":
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.photoId ? { ...p, ...action.updates } : p
        ),
      };

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.isLoading,
        loadingMessage: action.message || "",
      };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// === HOOK PRINCIPAL ===

export interface UsePhotoPreparationReturn {
  // État
  state: PhotoPreparationState;
  
  // Photo courante (raccourci)
  currentPhoto: PhotoToProcess | null;
  
  // Navigation
  setStep: (step: PreparationStep) => void;
  goToPhoto: (index: number) => void;
  nextPhoto: () => void;
  prevPhoto: () => void;
  
  // Gestion des photos
  addPhotos: (files: FileList | File[]) => Promise<void>;
  removePhoto: (photoId: string) => void;
  removeDuplicates: () => void;
  
  // Transformations
  rotatePhoto: (direction: "cw" | "ccw") => void;
  setRotation: (rotation: number) => void; // v1.1.0: Rotation libre
  setCrop: (crop: ImageCropData | null) => void;
  setStretch: (stretchX: number, stretchY: number) => void;
  setSkew: (skewX: number, skewY: number) => void; // v1.2.0: Correction perspective
  adjustStretchX: (deltaMm: number) => void;
  adjustStretchY: (deltaMm: number) => void;
  
  // Statut
  validatePhoto: () => void;
  skipPhoto: () => void;
  
  // Outils
  setActiveTool: (tool: "none" | "measure" | "crop") => void;
  
  // Mesures
  addMeasurePoint: (xPercent: number, yPercent: number) => void;
  removeMeasurement: (measurementId: string) => void;
  updateMeasurementPoint: (measurementId: string, pointIndex: 1 | 2, xPercent: number, yPercent: number) => void;
  setMeasurementTarget: (measurementId: string, targetValueMm: number | undefined) => void; // v1.2.0
  clearMeasurements: () => void;
  
  // Calculs
  calculateDistanceMm: (p1: MeasurePoint, p2: MeasurePoint) => number;
  getDimensionsMm: (photo: PhotoToProcess) => { widthMm: number; heightMm: number };

  // Export final
  getValidatedPhotos: () => PhotoToProcess[];
  prepareForExport: () => Promise<PreparedPhoto[]>;

  // Raccourcis clavier
  handleKeyDown: (e: KeyboardEvent) => void;

  // v1.0.1: ArUco
  setArucoResult: (photoId: string, result: ArucoDetectionResult) => void;
}

export function usePhotoPreparation(): UsePhotoPreparationReturn {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  // Ref pour accéder à l'état dans les callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  // === PHOTO COURANTE ===
  
  const currentPhoto = state.photos[state.currentPhotoIndex] || null;

  // === NAVIGATION ===

  const setStep = useCallback((step: PreparationStep) => {
    dispatch({ type: "SET_STEP", step });
  }, []);

  const goToPhoto = useCallback((index: number) => {
    dispatch({ type: "SET_CURRENT_INDEX", index });
  }, []);

  const nextPhoto = useCallback(() => {
    const { currentPhotoIndex, photos } = stateRef.current;
    if (currentPhotoIndex < photos.length - 1) {
      dispatch({ type: "SET_CURRENT_INDEX", index: currentPhotoIndex + 1 });
    }
  }, []);

  const prevPhoto = useCallback(() => {
    const { currentPhotoIndex } = stateRef.current;
    if (currentPhotoIndex > 0) {
      dispatch({ type: "SET_CURRENT_INDEX", index: currentPhotoIndex - 1 });
    }
  }, []);

  // === GESTION DES PHOTOS ===

  const addPhotos = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );
    
    if (fileArray.length === 0) return;

    dispatch({ type: "SET_LOADING", isLoading: true, message: "Chargement des photos..." });
    
    // Générer les IDs en amont pour pouvoir les retrouver après
    const filesWithIds = fileArray.map((file) => ({
      file,
      id: generateId(),
    }));
    
    // Ajouter les photos avec leurs IDs pré-générés
    dispatch({ type: "ADD_PHOTOS", files: filesWithIds });

    // Charger les images et calculer les hash
    for (const { file, id: photoId } of filesWithIds) {
      try {
        // Charger l'image
        const dataUrl = await readFileAsDataUrl(file);
        const image = await loadImage(dataUrl);
        
        // Calculer le hash pour détection doublons
        const hash = await calculateFileHash(file);
        
        // Vérifier si c'est un doublon
        const existingPhoto = stateRef.current.photos.find(
          (p) => p.hash === hash && p.id !== photoId && p.hash !== ""
        );

        dispatch({
          type: "UPDATE_PHOTO",
          photoId,
          updates: {
            image,
            imageDataUrl: dataUrl,
            originalWidth: image.naturalWidth,
            originalHeight: image.naturalHeight,
            currentWidth: image.naturalWidth,
            currentHeight: image.naturalHeight,
            hash,
            isDuplicate: !!existingPhoto,
            duplicateOf: existingPhoto?.id || null,
          },
        });
      } catch (error) {
        console.error("Erreur chargement photo:", file.name, error);
      }
    }

    dispatch({ type: "SET_LOADING", isLoading: false });
  }, []);

  const removePhoto = useCallback((photoId: string) => {
    dispatch({ type: "REMOVE_PHOTO", photoId });
  }, []);

  const removeDuplicates = useCallback(() => {
    dispatch({ type: "REMOVE_DUPLICATES" });
  }, []);

  // === TRANSFORMATIONS ===

  const rotatePhoto = useCallback((direction: "cw" | "ccw") => {
    const photo = stateRef.current.photos[stateRef.current.currentPhotoIndex];
    if (!photo) return;
    dispatch({ type: "ROTATE_PHOTO", photoId: photo.id, direction });
  }, []);

  // v1.1.0: Rotation libre
  const setRotation = useCallback((rotation: number) => {
    const photo = stateRef.current.photos[stateRef.current.currentPhotoIndex];
    if (!photo) return;
    dispatch({ type: "SET_ROTATION", photoId: photo.id, rotation });
  }, []);

  const setCrop = useCallback((crop: ImageCropData | null) => {
    const photo = stateRef.current.photos[stateRef.current.currentPhotoIndex];
    if (!photo) return;
    dispatch({ type: "SET_CROP", photoId: photo.id, crop });
  }, []);

  const setStretch = useCallback((stretchX: number, stretchY: number) => {
    const photo = stateRef.current.photos[stateRef.current.currentPhotoIndex];
    if (!photo) return;
    dispatch({ type: "SET_STRETCH", photoId: photo.id, stretchX, stretchY });
  }, []);

  // v1.2.0: Correction de perspective (cisaillement)
  const setSkew = useCallback((skewX: number, skewY: number) => {
    const photo = stateRef.current.photos[stateRef.current.currentPhotoIndex];
    if (!photo) return;
    dispatch({ type: "SET_SKEW", photoId: photo.id, skewX, skewY });
  }, []);

  const adjustStretchX = useCallback((deltaMm: number) => {
    const photo = stateRef.current.photos[stateRef.current.currentPhotoIndex];
    if (!photo) return;
    
    const { widthMm } = getDimensionsMm(photo);
    const newWidthMm = widthMm + deltaMm;
    const newStretchX = (newWidthMm / widthMm) * photo.stretchX;
    
    dispatch({
      type: "SET_STRETCH",
      photoId: photo.id,
      stretchX: newStretchX,
      stretchY: photo.stretchY,
    });
  }, []);

  const adjustStretchY = useCallback((deltaMm: number) => {
    const photo = stateRef.current.photos[stateRef.current.currentPhotoIndex];
    if (!photo) return;
    
    const { heightMm } = getDimensionsMm(photo);
    const newHeightMm = heightMm + deltaMm;
    const newStretchY = (newHeightMm / heightMm) * photo.stretchY;
    
    dispatch({
      type: "SET_STRETCH",
      photoId: photo.id,
      stretchX: photo.stretchX,
      stretchY: newStretchY,
    });
  }, []);

  // === STATUT ===

  const validatePhoto = useCallback(() => {
    const photo = stateRef.current.photos[stateRef.current.currentPhotoIndex];
    if (!photo) return;
    dispatch({ type: "SET_PHOTO_STATUS", photoId: photo.id, status: "validated" });
    nextPhoto();
  }, [nextPhoto]);

  const skipPhoto = useCallback(() => {
    const photo = stateRef.current.photos[stateRef.current.currentPhotoIndex];
    if (!photo) return;
    dispatch({ type: "SET_PHOTO_STATUS", photoId: photo.id, status: "skipped" });
    nextPhoto();
  }, [nextPhoto]);

  // === OUTILS ===

  const setActiveTool = useCallback((tool: "none" | "measure" | "crop") => {
    dispatch({ type: "SET_ACTIVE_TOOL", tool });
  }, []);

  // === MESURES ===

  const addMeasurePoint = useCallback((xPercent: number, yPercent: number) => {
    const { pendingMeasurePoint, currentMeasurements } = stateRef.current;
    
    const newPoint: MeasurePoint = {
      id: generateId(),
      xPercent,
      yPercent,
    };

    if (!pendingMeasurePoint) {
      // Premier point
      dispatch({ type: "SET_PENDING_MEASURE_POINT", point: newPoint });
    } else {
      // Deuxième point → créer la mesure
      const distanceMm = calculateDistanceMm(pendingMeasurePoint, newPoint);
      const measurement: Measurement = {
        id: generateId(),
        point1: pendingMeasurePoint,
        point2: newPoint,
        distanceMm,
        color: getNextMeasureColor(currentMeasurements),
        visible: true,
      };
      dispatch({ type: "ADD_MEASUREMENT", measurement });
    }
  }, []);

  const removeMeasurement = useCallback((measurementId: string) => {
    dispatch({ type: "REMOVE_MEASUREMENT", measurementId });
  }, []);

  const updateMeasurementPoint = useCallback((measurementId: string, pointIndex: 1 | 2, xPercent: number, yPercent: number) => {
    dispatch({ type: "UPDATE_MEASUREMENT_POINT", measurementId, pointIndex, xPercent, yPercent });
  }, []);

  const clearMeasurements = useCallback(() => {
    dispatch({ type: "CLEAR_MEASUREMENTS" });
  }, []);

  // v1.2.0: Définir la valeur cible d'une mesure (pour correction perspective)
  const setMeasurementTarget = useCallback((measurementId: string, targetValueMm: number | undefined) => {
    dispatch({ type: "SET_MEASUREMENT_TARGET", measurementId, targetValueMm });
  }, []);

  // === ARUCO ===

  // v1.0.1: Ajout de setArucoResult pour permettre la mise à jour depuis PhotoPreviewEditor
  const setArucoResult = useCallback((photoId: string, result: ArucoDetectionResult) => {
    dispatch({
      type: "SET_ARUCO_RESULT",
      photoId,
      result,
    });
  }, []);

  // === CALCULS ===

  // v1.2.3: Calcul de distance avec skewX/skewY
  const calculateDistanceMm = useCallback(
    (p1: MeasurePoint, p2: MeasurePoint): number => {
      const photo = stateRef.current.photos[stateRef.current.currentPhotoIndex];
      if (!photo) return 0;

      const imgWidth = photo.currentWidth;
      const imgHeight = photo.currentHeight;
      const skewX = photo.skewX || 0;
      const skewY = photo.skewY || 0;

      // Position en pixels (0-1)
      const x1Rel = p1.xPercent / 100;
      const y1Rel = p1.yPercent / 100;
      const x2Rel = p2.xPercent / 100;
      const y2Rel = p2.yPercent / 100;

      // v1.2.3: StretchX local dépend de Y, stretchY local dépend de X
      const localStretchX1 = photo.stretchX * (1 + skewX * (y1Rel - 0.5));
      const localStretchY1 = photo.stretchY * (1 + skewY * (x1Rel - 0.5));
      const localStretchX2 = photo.stretchX * (1 + skewX * (y2Rel - 0.5));
      const localStretchY2 = photo.stretchY * (1 + skewY * (x2Rel - 0.5));

      // Convertir en pixels avec le stretch local
      const x1 = x1Rel * imgWidth * localStretchX1;
      const y1 = y1Rel * imgHeight * localStretchY1;
      const x2 = x2Rel * imgWidth * localStretchX2;
      const y2 = y2Rel * imgHeight * localStretchY2;

      const distancePx = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      
      // Utiliser le scale ArUco si disponible, sinon le scale global
      const scaleX = photo.arucoScaleX || stateRef.current.scaleFactor;
      const scaleY = photo.arucoScaleY || stateRef.current.scaleFactor;
      const avgScale = (scaleX + scaleY) / 2;

      return distancePx / avgScale;
    },
    []
  );

  const getDimensionsMm = useCallback((photo: PhotoToProcess): { widthMm: number; heightMm: number } => {
    const scaleX = photo.arucoScaleX || stateRef.current.scaleFactor;
    const scaleY = photo.arucoScaleY || stateRef.current.scaleFactor;
    
    const widthPx = photo.currentWidth * photo.stretchX;
    const heightPx = photo.currentHeight * photo.stretchY;
    
    return {
      widthMm: widthPx / scaleX,
      heightMm: heightPx / scaleY,
    };
  }, []);

  // === EXPORT ===

  const getValidatedPhotos = useCallback((): PhotoToProcess[] => {
    return stateRef.current.photos.filter((p) => p.status === "validated");
  }, []);

  // v1.1.0: FIX - Calcul du scale et rotation libre
  const prepareForExport = useCallback(async (): Promise<PreparedPhoto[]> => {
    const validatedPhotos = getValidatedPhotos();
    const results: PreparedPhoto[] = [];

    console.log("[usePhotoPreparation v1.1.0] prepareForExport - photos:", validatedPhotos.length);

    for (const photo of validatedPhotos) {
      if (!photo.image) continue;

      // Créer le canvas final avec toutes les transformations
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      const imgWidth = photo.currentWidth;
      const imgHeight = photo.currentHeight;
      
      // v1.1.0: Calculer les dimensions du canvas après rotation libre
      // Pour une rotation quelconque, le bounding box change
      const radians = (photo.rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(radians));
      const sin = Math.abs(Math.sin(radians));
      
      // Dimensions avec stretch
      const stretchedWidth = imgWidth * photo.stretchX;
      const stretchedHeight = imgHeight * photo.stretchY;
      
      // Bounding box après rotation
      const rotatedWidth = stretchedWidth * cos + stretchedHeight * sin;
      const rotatedHeight = stretchedWidth * sin + stretchedHeight * cos;

      canvas.width = Math.round(rotatedWidth);
      canvas.height = Math.round(rotatedHeight);

      // Appliquer les transformations
      ctx.save();
      
      // Translater au centre du canvas
      ctx.translate(canvas.width / 2, canvas.height / 2);
      
      // Appliquer la rotation
      ctx.rotate(radians);
      
      // v1.2.4: Dessiner avec correction de perspective (skewX et skewY) si nécessaire
      const skewX = photo.skewX || 0;
      const skewY = photo.skewY || 0;
      const hasSkewX = Math.abs(skewX) > 0.001;
      const hasSkewY = Math.abs(skewY) > 0.001;
      
      if (hasSkewX && hasSkewY) {
        // Les deux skew → dessiner par grille de cellules
        const numCols = 50;
        const numRows = 50;
        const cellWidth = imgWidth / numCols;
        const cellHeight = imgHeight / numRows;
        
        for (let row = 0; row < numRows; row++) {
          for (let col = 0; col < numCols; col++) {
            const xRel = (col + 0.5) / numCols;
            const yRel = (row + 0.5) / numRows;
            
            const localStretchX = photo.stretchX * (1 + skewX * (yRel - 0.5));
            const localStretchY = photo.stretchY * (1 + skewY * (xRel - 0.5));
            
            const srcX = col * cellWidth;
            const srcY = row * cellHeight;
            const srcW = cellWidth + 1;
            const srcH = cellHeight + 1;
            
            const destW = cellWidth * localStretchX + 0.5;
            const destH = cellHeight * localStretchY + 0.5;
            
            let destX = 0;
            let destY = 0;
            
            for (let c = 0; c < col; c++) {
              const cLocalStretchX = photo.stretchX * (1 + skewX * (yRel - 0.5));
              destX += cellWidth * cLocalStretchX;
            }
            
            for (let r = 0; r < row; r++) {
              const rLocalStretchY = photo.stretchY * (1 + skewY * (xRel - 0.5));
              destY += cellHeight * rLocalStretchY;
            }
            
            const totalWidth = imgWidth * photo.stretchX;
            const totalHeight = imgHeight * photo.stretchY;
            destX -= totalWidth / 2;
            destY -= totalHeight / 2;
            
            ctx.drawImage(photo.image, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
          }
        }
      } else if (hasSkewX) {
        // Correction horizontale: dessiner par bandes horizontales
        const numBands = 100;
        const bandHeight = imgHeight / numBands;
        
        for (let i = 0; i < numBands; i++) {
          const yRel = (i + 0.5) / numBands;
          const localStretchX = photo.stretchX * (1 + skewX * (yRel - 0.5));
          
          const srcY = i * bandHeight;
          const srcHeight = bandHeight + 1;
          
          const destWidth = imgWidth * localStretchX;
          const destHeight = bandHeight * photo.stretchY + 0.5;
          
          const destX = -destWidth / 2;
          const destY = -stretchedHeight / 2 + (i * bandHeight * photo.stretchY);
          
          ctx.drawImage(photo.image, 0, srcY, imgWidth, srcHeight, destX, destY, destWidth, destHeight);
        }
      } else if (hasSkewY) {
        // Correction verticale: dessiner par bandes verticales
        const numBands = 100;
        const bandWidth = imgWidth / numBands;
        
        for (let i = 0; i < numBands; i++) {
          const xRel = (i + 0.5) / numBands;
          const localStretchY = photo.stretchY * (1 + skewY * (xRel - 0.5));
          
          const srcX = i * bandWidth;
          const srcWidth = bandWidth + 1;
          
          const destWidth = bandWidth * photo.stretchX + 0.5;
          const destHeight = imgHeight * localStretchY;
          
          const destX = -stretchedWidth / 2 + (i * bandWidth * photo.stretchX);
          const destY = -destHeight / 2;
          
          ctx.drawImage(photo.image, srcX, 0, srcWidth, imgHeight, destX, destY, destWidth, destHeight);
        }
      } else {
        // Pas de correction de perspective: dessin normal
        ctx.drawImage(
          photo.image,
          -stretchedWidth / 2,
          -stretchedHeight / 2,
          stretchedWidth,
          stretchedHeight
        );
      }
      
      ctx.restore();

      // v1.1.0: Calculer les dimensions en mm
      // Les dimensions mm sont basées sur l'image après stretch, puis la rotation crée un bounding box plus grand
      const scaleX = photo.arucoScaleX || stateRef.current.scaleFactor;
      const scaleY = photo.arucoScaleY || stateRef.current.scaleFactor;
      
      const stretchedWidthMm = stretchedWidth / scaleX;
      const stretchedHeightMm = stretchedHeight / scaleY;
      
      // Bounding box en mm après rotation
      const widthMm = stretchedWidthMm * cos + stretchedHeightMm * sin;
      const heightMm = stretchedWidthMm * sin + stretchedHeightMm * cos;

      // Calculer le scale à partir des dimensions réelles du canvas
      const finalScaleX = canvas.width / widthMm;
      const finalScaleY = canvas.height / heightMm;
      const scale = (finalScaleX + finalScaleY) / 2;

      console.log(`[usePhotoPreparation v1.2.4] Photo "${photo.name}":`, {
        originalPx: { w: imgWidth, h: imgHeight },
        stretch: { x: photo.stretchX, y: photo.stretchY },
        skew: { x: photo.skewX, y: photo.skewY },
        rotation: photo.rotation,
        canvasPx: { w: canvas.width, h: canvas.height },
        dimensionsMm: { w: widthMm, h: heightMm },
        scale: { x: finalScaleX, y: finalScaleY, avg: scale },
        arucoScale: { x: photo.arucoScaleX, y: photo.arucoScaleY },
      });

      results.push({
        id: photo.id,
        name: photo.name,
        canvas,
        widthMm,
        heightMm,
        scale,
        dataUrl: canvas.toDataURL("image/png"),
      });
    }

    return results;
  }, [getValidatedPhotos, getDimensionsMm]);

  // === RACCOURCIS CLAVIER ===

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignorer si on est dans un input
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const { step, activeTool } = stateRef.current;
    
    // Seulement en mode preview
    if (step !== "preview") return;

    // Déterminer l'incrément
    let increment = STRETCH_INCREMENT_NORMAL; // 1mm
    if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
      increment = STRETCH_INCREMENT_FINE; // 0.1mm
    } else if (e.ctrlKey || e.metaKey) {
      increment = STRETCH_INCREMENT_FAST; // 5mm
    }

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        adjustStretchX(-increment);
        break;
      case "ArrowRight":
        e.preventDefault();
        adjustStretchX(increment);
        break;
      case "ArrowUp":
        e.preventDefault();
        adjustStretchY(-increment);
        break;
      case "ArrowDown":
        e.preventDefault();
        adjustStretchY(increment);
        break;
      case "r":
      case "R":
        e.preventDefault();
        rotatePhoto(e.shiftKey ? "ccw" : "cw");
        break;
      case "m":
      case "M":
        e.preventDefault();
        setActiveTool(activeTool === "measure" ? "none" : "measure");
        break;
      case "Escape":
        e.preventDefault();
        if (activeTool !== "none") {
          setActiveTool("none");
        }
        break;
    }
  }, [adjustStretchX, adjustStretchY, rotatePhoto, setActiveTool]);

  return {
    state,
    currentPhoto,
    setStep,
    goToPhoto,
    nextPhoto,
    prevPhoto,
    addPhotos,
    removePhoto,
    removeDuplicates,
    rotatePhoto,
    setRotation, // v1.1.0: Rotation libre
    setCrop,
    setStretch,
    setSkew, // v1.2.0: Correction perspective
    adjustStretchX,
    adjustStretchY,
    validatePhoto,
    skipPhoto,
    setActiveTool,
    addMeasurePoint,
    removeMeasurement,
    updateMeasurementPoint,
    setMeasurementTarget, // v1.2.0: Valeur cible mesure
    clearMeasurements,
    calculateDistanceMm,
    getDimensionsMm,
    getValidatedPhotos,
    prepareForExport,
    handleKeyDown,
    setArucoResult, // v1.0.1: Ajout pour mise à jour ArUco depuis PhotoPreviewEditor
  };
}

// === FONCTIONS UTILITAIRES ===

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function calculateFileHash(file: File): Promise<string> {
  // Hash simple basé sur taille + premiers et derniers bytes
  const size = file.size;
  const chunkSize = 1024;
  
  const firstChunk = await readChunk(file, 0, Math.min(chunkSize, size));
  const lastChunk =
    size > chunkSize
      ? await readChunk(file, size - chunkSize, chunkSize)
      : firstChunk;

  // Combiner pour créer un hash simple
  const combined = `${size}-${hashString(firstChunk)}-${hashString(lastChunk)}`;
  return combined;
}

function readChunk(file: File, start: number, length: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file.slice(start, start + length));
  });
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export default usePhotoPreparation;
