// ============================================
// TYPES: Photo Preparation System
// Types pour la modale de préparation des photos
// VERSION: 1.0.0
// ============================================
//
// Changelog (3 dernières versions) :
// - v1.0.0 (2025-01-23) : Création initiale
//
// Historique complet : voir REFACTORING_PHOTO_PREPARATION.md
// ============================================

// === ÉTATS DE LA MODALE ===

export type PreparationStep = "grid" | "preview" | "summary";

export type PreparationStatus = "pending" | "validated" | "skipped";

// === PHOTO EN PRÉPARATION ===

export interface PhotoToProcess {
  id: string;
  file: File;
  name: string;
  
  // Image chargée
  image: HTMLImageElement | null;
  imageDataUrl: string | null;
  
  // Dimensions originales (pixels)
  originalWidth: number;
  originalHeight: number;
  
  // Dimensions après traitement (pixels)
  currentWidth: number;
  currentHeight: number;
  
  // Transformations appliquées
  rotation: 0 | 90 | 180 | 270;
  crop: ImageCropData | null;
  stretchX: number; // Ratio (1 = pas d'étirement)
  stretchY: number;
  
  // Calibration ArUco
  arucoDetected: boolean;
  arucoScaleX: number | null; // px/mm détecté
  arucoScaleY: number | null;
  
  // Statut
  status: PreparationStatus;
  
  // Hash pour détection doublons
  hash: string;
  isDuplicate: boolean;
  duplicateOf: string | null; // ID de la photo originale
  
  // Canvas de travail (pour preview)
  workCanvas: HTMLCanvasElement | null;
}

// === CROP ===

export interface ImageCropData {
  // Coordonnées en pourcentage de l'image (0-100)
  x: number;
  y: number;
  width: number;
  height: number;
}

// === MESURES ===

export interface MeasurePoint {
  id: string;
  // Position en % de l'image (suit l'étirement)
  xPercent: number;
  yPercent: number;
  // Label optionnel
  label?: string;
}

export interface Measurement {
  id: string;
  point1: MeasurePoint;
  point2: MeasurePoint;
  // Distance calculée en mm (mise à jour en temps réel)
  distanceMm: number;
  // Couleur pour différencier plusieurs mesures
  color: string;
  // Visible ou masquée
  visible: boolean;
}

// === POIGNÉES D'ÉTIREMENT ===

export type StretchHandleType = "left" | "right" | "top" | "bottom";

export interface StretchHandleState {
  type: StretchHandleType;
  isDragging: boolean;
  startValue: number; // Valeur au début du drag
  startMousePos: number; // Position souris au début
}

// === ARUCO ===

export interface ArucoMarkerDetected {
  id: number;
  corners: { x: number; y: number }[];
  center: { x: number; y: number };
  sizePixels: number; // Taille moyenne en pixels
}

export interface ArucoDetectionResult {
  markers: ArucoMarkerDetected[];
  scaleX: number | null; // px/mm (null si pas assez de markers)
  scaleY: number | null;
  confidence: number; // 0-1
  error: string | null;
}

// === ÉTAT PRINCIPAL ===

export interface PhotoPreparationState {
  // Étape courante
  step: PreparationStep;
  
  // Photos à traiter
  photos: PhotoToProcess[];
  
  // Index de la photo en cours de preview
  currentPhotoIndex: number;
  
  // Outil actif dans la preview
  activeTool: "none" | "measure" | "crop";
  
  // Mesures de la photo en cours
  currentMeasurements: Measurement[];
  
  // Point de mesure en cours de placement (premier point placé, en attente du second)
  pendingMeasurePoint: MeasurePoint | null;
  
  // Scale factor global (px/mm) - utilisé pour calculer les dimensions en mm
  scaleFactor: number;
  
  // Chargement en cours
  isLoading: boolean;
  loadingMessage: string;
}

// === ACTIONS ===

export type PhotoPreparationAction =
  | { type: "SET_STEP"; step: PreparationStep }
  | { type: "ADD_PHOTOS"; files: Array<{ file: File; id: string }> }
  | { type: "REMOVE_PHOTO"; photoId: string }
  | { type: "REMOVE_DUPLICATES" }
  | { type: "SET_CURRENT_INDEX"; index: number }
  | { type: "SET_PHOTO_STATUS"; photoId: string; status: PreparationStatus }
  | { type: "ROTATE_PHOTO"; photoId: string; direction: "cw" | "ccw" }
  | { type: "SET_CROP"; photoId: string; crop: ImageCropData | null }
  | { type: "SET_STRETCH"; photoId: string; stretchX: number; stretchY: number }
  | { type: "SET_ARUCO_RESULT"; photoId: string; result: ArucoDetectionResult }
  | { type: "SET_ACTIVE_TOOL"; tool: "none" | "measure" | "crop" }
  | { type: "ADD_MEASUREMENT"; measurement: Measurement }
  | { type: "REMOVE_MEASUREMENT"; measurementId: string }
  | { type: "UPDATE_MEASUREMENT_POINT"; measurementId: string; pointIndex: 1 | 2; xPercent: number; yPercent: number }
  | { type: "CLEAR_MEASUREMENTS" }
  | { type: "SET_PENDING_MEASURE_POINT"; point: MeasurePoint | null }
  | { type: "UPDATE_PHOTO"; photoId: string; updates: Partial<PhotoToProcess> }
  | { type: "SET_LOADING"; isLoading: boolean; message?: string }
  | { type: "RESET" };

// === RÉSULTAT FINAL ===

export interface PreparedPhoto {
  id: string;
  name: string;
  
  // Image finale (canvas avec toutes les transformations)
  canvas: HTMLCanvasElement;
  
  // Dimensions en mm
  widthMm: number;
  heightMm: number;
  
  // Scale final (px/mm)
  scale: number;
  
  // Source pour restauration
  dataUrl: string;
}

// === CONSTANTES ===

export const MEASURE_COLORS = [
  "#E74C3C", // Rouge
  "#3498DB", // Bleu
  "#2ECC71", // Vert
  "#F39C12", // Orange
  "#9B59B6", // Violet
  "#1ABC9C", // Turquoise
];

export const DEFAULT_CROP: ImageCropData = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
};

// Incréments pour les raccourcis clavier (en mm)
export const STRETCH_INCREMENT_NORMAL = 1; // Flèches seules
export const STRETCH_INCREMENT_FINE = 0.1; // SHIFT + flèches
export const STRETCH_INCREMENT_FAST = 5; // CTRL + flèches

// === UTILITAIRES ===

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createEmptyPhoto(file: File, id?: string): PhotoToProcess {
  return {
    id: id || generateId(),
    file,
    name: file.name,
    image: null,
    imageDataUrl: null,
    originalWidth: 0,
    originalHeight: 0,
    currentWidth: 0,
    currentHeight: 0,
    rotation: 0,
    crop: null,
    stretchX: 1,
    stretchY: 1,
    arucoDetected: false,
    arucoScaleX: null,
    arucoScaleY: null,
    status: "pending",
    hash: "",
    isDuplicate: false,
    duplicateOf: null,
    workCanvas: null,
  };
}

export function getNextMeasureColor(existingMeasurements: Measurement[]): string {
  const usedColors = new Set(existingMeasurements.map((m) => m.color));
  for (const color of MEASURE_COLORS) {
    if (!usedColors.has(color)) {
      return color;
    }
  }
  // Si toutes les couleurs sont utilisées, recommencer
  return MEASURE_COLORS[existingMeasurements.length % MEASURE_COLORS.length];
}
