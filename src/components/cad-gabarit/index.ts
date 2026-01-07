// ============================================
// CAD GABARIT - Index
// Export de tous les modules
// VERSION: 2.2
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
} from "./types";

export {
  generateId,
  distance,
  midpoint,
  angle,
  normalizeAngle,
  DEFAULT_STYLES,
  CALIBRATION_COLORS,
  createEmptySketch,
} from "./types";

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
