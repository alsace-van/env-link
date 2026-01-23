// ============================================
// INDEX: Photo Preparation Module
// Exports du système de préparation des photos
// VERSION: 1.0.0
// ============================================

// Types
export type {
  PreparationStep,
  PreparationStatus,
  PhotoToProcess,
  ImageCropData,
  MeasurePoint,
  Measurement,
  StretchHandleType,
  StretchHandleState,
  ArucoMarkerDetected,
  ArucoDetectionResult,
  PhotoPreparationState,
  PhotoPreparationAction,
  PreparedPhoto,
} from "./types";

// Constantes et utilitaires
export {
  MEASURE_COLORS,
  DEFAULT_CROP,
  STRETCH_INCREMENT_NORMAL,
  STRETCH_INCREMENT_FINE,
  STRETCH_INCREMENT_FAST,
  generateId,
  createEmptyPhoto,
  getNextMeasureColor,
} from "./types";

// Hook principal
export { usePhotoPreparation } from "./usePhotoPreparation";
export type { UsePhotoPreparationReturn } from "./usePhotoPreparation";

// Hook détection doublons
export { useDuplicateDetection } from "./useDuplicateDetection";
export type { DuplicateGroup, UseDuplicateDetectionReturn } from "./useDuplicateDetection";

// Hook détection ArUco
export { useArucoDetection } from "./useArucoDetection";
export type { UseArucoDetectionReturn } from "./useArucoDetection";

// Composants
export { PhotoPreparationModal } from "./PhotoPreparationModal";
export { PhotoGridView } from "./PhotoGridView";
export { PhotoPreviewEditor } from "./PhotoPreviewEditor";
export { StretchHandles } from "./StretchHandles";
