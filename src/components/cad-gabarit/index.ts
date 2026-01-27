// ============================================
// CAD GABARIT - Index
// Export de tous les modules
// VERSION: 3.2 - Ajout useMeasurement et useContextMenu
// ============================================

// Types
export type {
  Point,
  Line,
  Circle,
  Arc,
  Rectangle,
  Bezier,
  Geometry,
  Constraint,
  ConstraintType,
  Dimension,
  Layer,
  Sketch,
  Viewport,
  SnapPoint,
  SnapType,
  SnapSettings,
  ToolType,
  Tool,
  ToolContext,
  RenderStyles,
  CalibrationPoint,
  CalibrationPair,
  CalibrationData,
  ReferenceRectangle,
  HomographyMatrix,
  CheckerboardConfig,
  DistortionCoefficients,
  BackgroundImage,
  ImageMarker,
  ImageMarkerLink,
  ImageAdjustments,
} from "./types";

export {
  generateId,
  distance,
  midpoint,
  angle,
  normalizeAngle,
  DEFAULT_STYLES,
  CALIBRATION_COLORS,
  DEFAULT_LAYERS,
  MARKER_COLORS,
  DEFAULT_IMAGE_ADJUSTMENTS,
} from "./types";

// Homography (correction de perspective et distorsion)
export {
  computeHomography,
  invertHomography,
  transformPoint,
  warpImage,
  computeTransformedBounds,
  createRectifyingHomography,
  interpolateCheckerboardCorners,
  generateIdealCheckerboardCorners,
  computeDistortionCoefficients,
  undistortPoint,
  distortPoint,
  undistortImage,
  calibrateWithCheckerboard,
} from "./homography";

// Snap system
export { SnapSystem, DEFAULT_SNAP_SETTINGS } from "./snap-system";

// Solver
export { CADSolver } from "./cad-solver";

// Renderer
export { CADRenderer } from "./cad-renderer";

// Export DXF
export { exportToDXF } from "./export-dxf";

// Import DXF
export { parseDXF, loadDXFFile } from "./dxf-parser";
export type { DXFParseResult } from "./dxf-parser";

// Composant principal
export { CADGabaritCanvas } from "./CADGabaritCanvas";

// ============================================
// HOOKS DE REFACTORISATION
// ============================================

// Hook historique et branches
export { useSketchHistory } from "./useSketchHistory";
export type {
  HistoryEntry,
  Branch,
  ImageHistoryState,
  UseSketchHistoryProps,
  UseSketchHistoryReturn,
} from "./useSketchHistory";

// Hook outils de modification (fillet, chamfer, offset)
export { useModificationTools } from "./useModificationTools";
export type {
  OffsetPreviewItem,
  FilletPreviewItem,
  ChamferPreviewItem,
  FilletCorner,
  FilletDialogState,
  ChamferCorner,
  ChamferDialogState,
  OffsetDialogState,
  SharedPointResult,
  FilletGeometry,
  ChamferGeometry,
  UseModificationToolsProps,
  UseModificationToolsReturn,
} from "./useModificationTools";

// Hook états de dessin
export { useDrawingState } from "./useDrawingState";
export type {
  TempGeometry,
  RectInputs,
  PerpendicularInfo,
  TextInputState,
  UseDrawingStateProps,
  UseDrawingStateReturn,
} from "./useDrawingState";

// Hook sélection
export { useSelection } from "./useSelection";
export type {
  SelectionBounds,
  SelectRectState,
  TransformGizmoState,
  UseSelectionProps,
  UseSelectionReturn,
} from "./useSelection";

// Hook gestion des images
export { useImageManagement } from "./useImageManagement";
export type {
  ImageDragState,
  MarkerDragState,
  LinkDistanceDialogState,
  StretchingHandleState,
  StretchKeyIndicator,
  CropSelection,
  CropDragHandle,
  MarkerMode,
  UseImageManagementProps,
  UseImageManagementReturn,
} from "./useImageManagement";

// Hook mesures et cotations
export { useMeasurement } from "./useMeasurement";
export type {
  Measurement,
  MeasureState,
  DraggingMeasurePoint,
  UseMeasurementProps,
  UseMeasurementReturn,
} from "./useMeasurement";

// Hook menu contextuel
export { useContextMenu } from "./useContextMenu";
export type {
  ContextMenuState,
  ArcEditDialogState,
  LineLengthDialogState,
  UseContextMenuReturn,
} from "./useContextMenu";

// ============================================
// TOOLBAR CONFIGURABLE
// ============================================

export type {
  ToolDefinition,
  ToolbarConfig,
  ToolbarGroup,
  ToolbarItem,
  ToolCategory,
  ToolRenderType,
  DragState,
  ToolbarEditorProps,
  ToolbarPreferences,
} from "./toolbar-types";

export {
  TOOLBAR_CONFIG_KEY,
  TOOLBAR_PREFERENCES_KEY,
  GROUP_COLORS,
  generateToolbarId,
  isValidToolbarConfig,
} from "./toolbar-types";

export {
  ALL_TOOL_DEFINITIONS,
  DEFAULT_GROUPS,
  DEFAULT_TOOLBAR_CONFIG,
  createToolDefinitionsMap,
  getDefaultToolbarConfig,
  createNewGroup,
  mergeWithDefaults,
  CATEGORY_LABELS,
} from "./toolbar-defaults";

export { ToolbarEditor } from "./ToolbarEditor";
export { useToolbarConfig } from "./useToolbarConfig";
export type { UseToolbarConfigReturn, ResolvedToolbarItem, ResolvedTool, ResolvedLine } from "./useToolbarConfig";
