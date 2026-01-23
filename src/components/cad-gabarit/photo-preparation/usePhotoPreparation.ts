// ============================================
// HOOK: usePhotoPreparation
// Gestion de l'état principal pour la préparation des photos
// VERSION: 1.0.0
// ============================================
//
// Changelog (3 dernières versions) :
// - v1.0.0 (2025-01-23) : Création initiale
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
      return {
        ...state,
        photos: state.photos.map((p) => {
          if (p.id !== action.photoId) return p;
          const rotations: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
          const currentIndex = rotations.indexOf(p.rotation);
          const newIndex =
            action.direction === "cw"
              ? (currentIndex + 1) % 4
              : (currentIndex + 3) % 4;
          return { ...p, rotation: rotations[newIndex] };
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
  setCrop: (crop: ImageCropData | null) => void;
  setStretch: (stretchX: number, stretchY: number) => void;
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
  clearMeasurements: () => void;
  
  // Calculs
  calculateDistanceMm: (p1: MeasurePoint, p2: MeasurePoint) => number;
  getDimensionsMm: (photo: PhotoToProcess) => { widthMm: number; heightMm: number };
  
  // Export final
  getValidatedPhotos: () => PhotoToProcess[];
  prepareForExport: () => Promise<PreparedPhoto[]>;
  
  // Raccourcis clavier
  handleKeyDown: (e: KeyboardEvent) => void;
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

  const clearMeasurements = useCallback(() => {
    dispatch({ type: "CLEAR_MEASUREMENTS" });
  }, []);

  // === CALCULS ===

  const calculateDistanceMm = useCallback(
    (p1: MeasurePoint, p2: MeasurePoint): number => {
      const photo = stateRef.current.photos[stateRef.current.currentPhotoIndex];
      if (!photo) return 0;

      // Convertir % en pixels
      const x1 = (p1.xPercent / 100) * photo.currentWidth * photo.stretchX;
      const y1 = (p1.yPercent / 100) * photo.currentHeight * photo.stretchY;
      const x2 = (p2.xPercent / 100) * photo.currentWidth * photo.stretchX;
      const y2 = (p2.yPercent / 100) * photo.currentHeight * photo.stretchY;

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

  const prepareForExport = useCallback(async (): Promise<PreparedPhoto[]> => {
    const validatedPhotos = getValidatedPhotos();
    const results: PreparedPhoto[] = [];

    for (const photo of validatedPhotos) {
      if (!photo.image) continue;

      // Créer le canvas final avec toutes les transformations
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      // Calculer les dimensions finales
      let width = photo.currentWidth * photo.stretchX;
      let height = photo.currentHeight * photo.stretchY;

      // Gérer la rotation
      if (photo.rotation === 90 || photo.rotation === 270) {
        [width, height] = [height, width];
      }

      canvas.width = width;
      canvas.height = height;

      // Appliquer les transformations
      ctx.save();
      
      if (photo.rotation !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((photo.rotation * Math.PI) / 180);
        if (photo.rotation === 90 || photo.rotation === 270) {
          ctx.translate(-canvas.height / 2, -canvas.width / 2);
        } else {
          ctx.translate(-canvas.width / 2, -canvas.height / 2);
        }
      }

      // Dessiner avec étirement
      ctx.drawImage(
        photo.image,
        0,
        0,
        photo.currentWidth * photo.stretchX,
        photo.currentHeight * photo.stretchY
      );
      
      ctx.restore();

      const { widthMm, heightMm } = getDimensionsMm(photo);
      const scale = photo.arucoScaleX || stateRef.current.scaleFactor;

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
    setCrop,
    setStretch,
    adjustStretchX,
    adjustStretchY,
    validatePhoto,
    skipPhoto,
    setActiveTool,
    addMeasurePoint,
    removeMeasurement,
    clearMeasurements,
    calculateDistanceMm,
    getDimensionsMm,
    getValidatedPhotos,
    prepareForExport,
    handleKeyDown,
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
