// ============================================
// CAD GABARIT - Index
// Export de tous les modules
// VERSION: 2.8 - Ajout ImageMarker et ImageMarkerLink pour alignement multi-photos
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
export { default as CADGabaritCanvas } from "./CADGabaritCanvas";
