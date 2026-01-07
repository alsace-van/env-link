// ============================================
// CAD GABARIT - Index
// Export de tous les modules
// VERSION: 2.4 - Ajout calibration damier
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
} from "./types";

export { generateId, distance, midpoint, angle, normalizeAngle, DEFAULT_STYLES, CALIBRATION_COLORS } from "./types";

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

// Composant principal
export { default as CADGabaritCanvas } from "./CADGabaritCanvas";
