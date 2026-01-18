// ============================================
// TYPES: CAD Gabarit Types
// Types pour le système CAO
// VERSION: 3.3 - Ajout src et rotation pour BackgroundImage
// ============================================

// === GÉOMÉTRIE DE BASE ===

export interface Point {
  id: string;
  x: number;
  y: number;
  fixed?: boolean;
}

export interface Line {
  id: string;
  type: "line";
  p1: string; // ID du point de départ
  p2: string; // ID du point d'arrivée
  layerId?: string; // Calque (défaut: 'default')
  strokeWidth?: number; // Épaisseur du trait (défaut: styles.lineWidth)
  strokeColor?: string; // Couleur du trait (défaut: styles.lineColor)
  isConstruction?: boolean; // Ligne de construction (non exportée, style pointillé)
}

export interface Circle {
  id: string;
  type: "circle";
  center: string; // ID du point central
  radius: number;
  layerId?: string;
  strokeWidth?: number; // Épaisseur du trait
  strokeColor?: string; // Couleur du trait
  isConstruction?: boolean; // Ligne de construction
}

export interface Arc {
  id: string;
  type: "arc";
  center: string;
  startPoint: string;
  endPoint: string;
  radius: number;
  layerId?: string;
  counterClockwise?: boolean; // Si true, dessiner dans le sens anti-horaire (grand arc si nécessaire)
  isFillet?: boolean; // Si true, cet arc est un congé (peut être supprimé pour restaurer le coin)
  strokeWidth?: number; // Épaisseur du trait
  strokeColor?: string; // Couleur du trait
  isConstruction?: boolean; // Ligne de construction
}

export interface Rectangle {
  id: string;
  type: "rectangle";
  p1: string; // coin supérieur gauche
  p2: string; // coin supérieur droit
  p3: string; // coin inférieur droit
  p4: string; // coin inférieur gauche
  layerId?: string;
  strokeWidth?: number; // Épaisseur du trait
  strokeColor?: string; // Couleur du trait
  isConstruction?: boolean; // Ligne de construction
}

export interface Bezier {
  id: string;
  type: "bezier";
  p1: string; // Point de départ
  p2: string; // Point d'arrivée
  cp1: string; // Point de contrôle 1
  cp2: string; // Point de contrôle 2
  layerId?: string;
  strokeWidth?: number; // Épaisseur du trait
  strokeColor?: string; // Couleur du trait
  isConstruction?: boolean; // Ligne de construction
}

export interface Spline {
  id: string;
  type: "spline";
  points: string[]; // IDs des points de passage (minimum 2)
  closed: boolean; // Spline fermée ou ouverte
  tension?: number; // Tension de la courbe (0-1, défaut 0.5)
  layerId?: string;
  strokeWidth?: number; // Épaisseur du trait
  strokeColor?: string; // Couleur du trait
  isConstruction?: boolean; // Ligne de construction
}

export interface TextAnnotation {
  id: string;
  type: "text";
  position: string; // ID du point d'ancrage
  content: string; // Texte à afficher
  fontSize: number; // Taille en mm
  fontFamily?: string; // Police (défaut: Arial)
  color?: string; // Couleur du texte
  rotation?: number; // Rotation en degrés
  alignment?: "left" | "center" | "right"; // Alignement horizontal
  layerId?: string;
}

export type Geometry = Line | Circle | Arc | Rectangle | Bezier | Spline | TextAnnotation;

// === GROUPES ===

export interface GeometryGroup {
  id: string;
  name: string;
  entityIds: string[]; // IDs des géométries dans ce groupe
  color?: string; // Couleur optionnelle pour identifier le groupe
  locked?: boolean; // Groupe verrouillé (ne peut pas être modifié)
  visible?: boolean; // Visibilité du groupe (défaut: true)
}

// === HANDLES (Poignées de manipulation) ===

export type HandleType =
  | "move" // Déplacer
  | "resize" // Redimensionner
  | "rotate" // Pivoter
  | "control"; // Point de contrôle (Bézier)

export interface Handle {
  id: string;
  type: HandleType;
  x: number;
  y: number;
  entityId: string;
  pointId?: string; // Pour les handles liés à un point spécifique
  cursor: string;
}

// === CONTRAINTES ===

export type ConstraintType =
  | "coincident" // Points superposés
  | "horizontal" // Ligne horizontale
  | "vertical" // Ligne verticale
  | "parallel" // Lignes parallèles
  | "perpendicular" // Lignes perpendiculaires
  | "tangent" // Tangence
  | "equal" // Longueurs/rayons égaux
  | "concentric" // Cercles concentriques
  | "distance" // Distance fixe
  | "angle" // Angle fixe
  | "radius" // Rayon fixe
  | "diameter" // Diamètre fixe
  | "midpoint" // Point au milieu
  | "symmetric" // Symétrie
  | "fixed"; // Point fixe

export interface Constraint {
  id: string;
  type: ConstraintType;
  entities: string[]; // IDs des entités concernées
  value?: number; // Valeur pour distance, angle, radius, etc.
  driving?: boolean; // Si false, c'est une contrainte de référence
}

// === COTATIONS ===

export interface Dimension {
  id: string;
  type: "linear" | "horizontal" | "vertical" | "radius" | "diameter" | "angle";
  entities: string[];
  value: number;
  position: { x: number; y: number }; // Position du texte
  constraintId?: string; // ID de la contrainte liée
}

// === SNAP ===

export type SnapType =
  | "endpoint"
  | "midpoint"
  | "center"
  | "intersection"
  | "quadrant"
  | "tangent"
  | "perpendicular"
  | "nearest"
  | "grid"
  | "marker";

export interface SnapPoint {
  x: number;
  y: number;
  type: SnapType;
  entityId?: string;
  priority: number;
}

export interface SnapSettings {
  enabled: boolean;
  types: Set<SnapType>;
  tolerance: number; // Distance en pixels
  gridSize: number; // Taille de la grille
  showGrid: boolean;
}

// === OUTILS ===

export type ToolType =
  | "select"
  | "pan"
  | "line"
  | "rectangle"
  | "circle"
  | "arc"
  | "arc3points"
  | "bezier"
  | "spline"
  | "polygon"
  | "text"
  | "dimension"
  | "constraint"
  | "measure"
  | "trim"
  | "extend"
  | "fillet"
  | "chamfer"
  | "offset"
  | "mirror";

export interface Tool {
  type: ToolType;
  cursor: string;
  onMouseDown?: (e: MouseEvent, ctx: ToolContext) => void;
  onMouseMove?: (e: MouseEvent, ctx: ToolContext) => void;
  onMouseUp?: (e: MouseEvent, ctx: ToolContext) => void;
  onKeyDown?: (e: KeyboardEvent, ctx: ToolContext) => void;
  render?: (ctx: CanvasRenderingContext2D, toolCtx: ToolContext) => void;
}

export interface ToolContext {
  canvas: HTMLCanvasElement;
  sketch: Sketch;
  viewport: Viewport;
  snap: SnapSettings;
  tempPoints: Point[];
  selectedEntities: string[];
  hoveredEntity: string | null;
  currentSnapPoint: SnapPoint | null;
}

// === VIEWPORT ===

export interface Viewport {
  offsetX: number;
  offsetY: number;
  scale: number;
  width: number;
  height: number;
}

// === CALQUES ===

export interface Layer {
  id: string;
  name: string;
  color: string; // Couleur des entités du calque
  visible: boolean;
  locked: boolean; // Si verrouillé, pas de modification
  order: number; // Ordre d'affichage (0 = fond)
  opacity?: number; // Opacité du calque (0-1, défaut: 1)
}

export const DEFAULT_LAYERS: Layer[] = [
  { id: "modele", name: "Modèle", color: "#9CA3AF", visible: true, locked: false, order: 0, opacity: 1 },
  { id: "trace", name: "Tracé", color: "#EF4444", visible: true, locked: false, order: 1, opacity: 1 },
];

// === REMPLISSAGES DE FORMES FERMÉES ===

export type HatchPattern = "lines" | "cross" | "dots";

export interface ShapeFill {
  id: string;
  geoIds: string[]; // IDs des géométries formant la forme (triés pour identification unique)
  fillType: "solid" | "hatch"; // Type de remplissage
  color: string; // Couleur du remplissage
  opacity: number; // Opacité (0-1)
  hatchPattern?: HatchPattern; // Motif de hachures (si type = hatch)
  hatchAngle?: number; // Angle des hachures en degrés (défaut 45)
  hatchSpacing?: number; // Espacement des hachures en mm (défaut 5)
}

// === SKETCH (Document) ===

export interface Sketch {
  id: string;
  name: string;
  points: Map<string, Point>;
  geometries: Map<string, Geometry>;
  constraints: Map<string, Constraint>;
  dimensions: Map<string, Dimension>;
  layers: Map<string, Layer>;
  groups: Map<string, GeometryGroup>; // Groupes de géométries
  shapeFills: Map<string, ShapeFill>; // Remplissages des formes fermées
  activeLayerId: string; // Calque actif pour les nouvelles entités
  scaleFactor: number; // px to mm
  dof: number; // Degrees of Freedom
  status: "under-constrained" | "fully-constrained" | "over-constrained" | "conflicting";
}

// === SOLVEUR ===

export interface SolverResult {
  success: boolean;
  dof: number;
  status: Sketch["status"];
  conflicting?: string[];
  redundant?: string[];
}

// === HISTORIQUE (Undo/Redo) ===

export interface HistoryState {
  points: Map<string, Point>;
  geometries: Map<string, Geometry>;
  constraints: Map<string, Constraint>;
  dimensions: Map<string, Dimension>;
}

// === EXPORT ===

export interface ExportOptions {
  format: "dxf" | "svg";
  scale: number;
  includeConstraints: boolean;
  includeDimensions: boolean;
  layers: {
    geometry: string;
    construction: string;
    dimensions: string;
  };
}

// === STYLES ===

export interface RenderStyles {
  // Géométrie
  lineColor: string;
  lineWidth: number;
  selectedColor: string;
  selectedWidth: number;
  constructionColor: string;
  constructionStyle: number[]; // dash pattern

  // Points
  pointColor: string;
  pointRadius: number;
  pointSelectedColor: string;

  // Contraintes
  constraintColor: string;
  constraintFont: string;

  // Cotations
  dimensionColor: string;
  dimensionFont: string;
  dimensionArrowSize: number;

  // Snap
  snapColor: string;
  snapRadius: number;

  // Grille
  gridColor: string;
  gridMajorColor: string;
  gridSpacing: number;
  gridMajorSpacing: number;

  // Fond
  backgroundColor: string;
}

export const DEFAULT_STYLES: RenderStyles = {
  lineColor: "#000000",
  lineWidth: 1,
  selectedColor: "#0066FF",
  selectedWidth: 2,
  constructionColor: "#888888",
  constructionStyle: [5, 5],

  pointColor: "#0066FF",
  pointRadius: 4,
  pointSelectedColor: "#FF6600",

  constraintColor: "#00AA00",
  constraintFont: "12px Arial",

  dimensionColor: "#CC0000",
  dimensionFont: "11px Arial",
  dimensionArrowSize: 8,

  snapColor: "#FF00FF",
  snapRadius: 6,

  gridColor: "#E8E8E8",
  gridMajorColor: "#CCCCCC",
  gridSpacing: 10,
  gridMajorSpacing: 50,

  backgroundColor: "#FFFFFF",
};

// === UTILITAIRES ===

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

export function midpoint(p1: { x: number; y: number }, p2: { x: number; y: number }): { x: number; y: number } {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

export function angle(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

export function normalizeAngle(angle: number): number {
  while (angle < 0) angle += Math.PI * 2;
  while (angle >= Math.PI * 2) angle -= Math.PI * 2;
  return angle;
}

// === CALIBRATION ===

export interface CalibrationPoint {
  id: string;
  x: number; // Position sur l'image (pixels)
  y: number;
  label: string; // "1", "2", "3", etc.
}

export interface CalibrationPair {
  id: string;
  point1Id: string;
  point2Id: string;
  distanceMm: number; // Distance réelle en mm
  distancePx?: number; // Distance mesurée en pixels (calculée)
  color: string; // Couleur de la ligne
}

// Matrice 3x3 pour transformation homographique
export type HomographyMatrix = [[number, number, number], [number, number, number], [number, number, number]];

// Matrice 2x3 pour transformation affine (6 paramètres)
// [[a, b, tx], [c, d, ty]] où:
// - a, d: échelle
// - b, c: cisaillement/rotation
// - tx, ty: translation
export type AffineMatrix = [[number, number, number], [number, number, number]];

// Rectangle de référence pour correction de perspective
export interface ReferenceRectangle {
  // 4 points dans l'ordre (sens horaire à partir du coin supérieur gauche)
  pointIds: string[]; // IDs des 4 points dans l'ordre
  widthMm: number; // Largeur réelle en mm
  heightMm: number; // Hauteur réelle en mm
}

// Damier pour correction de distorsion
export interface CheckerboardConfig {
  cornersX: number; // Nombre de coins intérieurs en X (cases - 1)
  cornersY: number; // Nombre de coins intérieurs en Y (cases - 1)
  squareSizeMm: number; // Taille d'une case en mm
  // 4 coins extérieurs du damier (TL, TR, BR, BL)
  cornerPointIds: string[];
}

// Coefficients de distorsion radiale et tangentielle
export interface DistortionCoefficients {
  k1: number; // Distorsion radiale
  k2: number;
  k3: number;
  p1: number; // Distorsion tangentielle
  p2: number;
  cx: number; // Centre optique X
  cy: number; // Centre optique Y
}

export interface CalibrationData {
  points: Map<string, CalibrationPoint>;
  pairs: Map<string, CalibrationPair>;
  scale?: number; // mm par pixel (calculé) - moyenne pour rétrocompatibilité
  error?: number; // Erreur moyenne en %
  // MOD #85: Calibration anisotrope (scaleX et scaleY séparés)
  scaleX?: number; // mm par pixel horizontal (paires où |Δx| > |Δy|)
  scaleY?: number; // mm par pixel vertical (paires où |Δy| > |Δx|)
  errorX?: number; // Erreur X en %
  errorY?: number; // Erreur Y en %
  // MOD #85: Étirements calculés après calibration
  stretchX?: number; // Ratio d'étirement X appliqué
  stretchY?: number; // Ratio d'étirement Y appliqué
  // MOD v7.15: Étirement manuel
  manualStretchX?: number; // Étirement manuel cumulatif X
  manualStretchY?: number; // Étirement manuel cumulatif Y
  // MOD #85: Points originaux pour reset
  originalPoints?: Map<string, CalibrationPoint>;
  originalImageScale?: number; // Échelle image avant calibration
  originalScaleFactor?: number; // ScaleFactor sketch avant calibration
  applied: boolean; // Si la calibration a été appliquée
  // Mode de calibration
  mode: "simple" | "anisotrope" | "affine" | "perspective" | "checkerboard";
  perspectiveMethod?: "rectangle" | "checkerboard";
  referenceRect?: ReferenceRectangle;
  checkerboard?: CheckerboardConfig;
  homography?: HomographyMatrix;
  affineMatrix?: AffineMatrix; // Matrice affine calculée
  affineError?: number; // Erreur RMS en mm
  affinePointErrors?: Map<string, number>; // Erreur par point pour visualisation
  distortion?: DistortionCoefficients;
  transformedImageData?: ImageData; // Image déformée en cache
}

export const CALIBRATION_COLORS = [
  "#FF6B6B", // Rouge
  "#4ECDC4", // Turquoise
  "#45B7D1", // Bleu clair
  "#96CEB4", // Vert menthe
  "#FFEAA7", // Jaune
  "#DDA0DD", // Violet clair
  "#98D8C8", // Vert eau
  "#F7DC6F", // Or
  "#BB8FCE", // Mauve
  "#85C1E9", // Bleu ciel
];

// === IMAGES DE FOND (Multi-photos) ===

// Point de référence sur une image (pour alignement inter-photos)
export interface ImageMarker {
  id: string;
  label: string; // "A", "B", "1", "2", etc.
  // Position relative à l'image (en pixels depuis le centre de l'image)
  relativeX: number;
  relativeY: number;
  color: string;
}

// Lien entre deux marqueurs de photos différentes avec distance connue
export interface ImageMarkerLink {
  id: string;
  marker1: {
    imageId: string;
    markerId: string;
  };
  marker2: {
    imageId: string;
    markerId: string;
  };
  distanceMm: number; // Distance réelle en mm entre les deux points
  color: string;
}

// VERSION 3.3: Ajout de src et rotation
export interface BackgroundImage {
  id: string;
  name: string; // Nom du fichier ou label
  src?: string; // URL source de l'image (data URL ou URL externe)
  image: HTMLImageElement;
  x: number; // Position X en coordonnées monde (centre de l'image)
  y: number; // Position Y en coordonnées monde (centre de l'image)
  scale: number; // Échelle individuelle (1 = taille originale)
  rotation?: number; // Rotation de l'image en degrés (défaut: 0)
  opacity: number; // Opacité (0-1)
  visible: boolean;
  locked: boolean; // Si verrouillé, ne peut pas être déplacé
  order: number; // Ordre d'affichage (0 = fond)
  layerId?: string; // Calque associé (optionnel, pour filtrer l'affichage)
  // Points de référence pour alignement
  markers: ImageMarker[];
  // Transformation optionnelle (après calibration)
  transformedCanvas?: HTMLCanvasElement;
  calibrationData?: CalibrationData;
  // Ajustements d'image pour améliorer les contours
  adjustments?: ImageAdjustments;
  // Canvas avec les ajustements appliqués (cache)
  adjustedCanvas?: HTMLCanvasElement;
  // Données de recadrage (crop)
  crop?: ImageCrop;
  // Canvas avec le crop appliqué (cache)
  croppedCanvas?: HTMLCanvasElement;
}

// Données de recadrage d'image
export interface ImageCrop {
  // Coordonnées en pourcentage de l'image originale (0-100)
  x: number; // Position X du coin supérieur gauche
  y: number; // Position Y du coin supérieur gauche
  width: number; // Largeur du crop
  height: number; // Hauteur du crop
}

// Ajustements d'image pour améliorer la visibilité des contours
export interface ImageAdjustments {
  contrast: number; // 0-200, 100 = normal
  brightness: number; // 0-200, 100 = normal
  saturate: number; // 0-200, 100 = normal
  sharpen: number; // 0-100, 0 = pas de netteté
  invert: boolean; // Inverser les couleurs
  grayscale: boolean; // Noir et blanc
}

export const DEFAULT_IMAGE_ADJUSTMENTS: ImageAdjustments = {
  contrast: 100,
  brightness: 100,
  saturate: 100,
  sharpen: 0,
  invert: false,
  grayscale: false,
};

// Couleurs pour les marqueurs
export const MARKER_COLORS = [
  "#E74C3C", // Rouge
  "#3498DB", // Bleu
  "#2ECC71", // Vert
  "#F39C12", // Orange
  "#9B59B6", // Violet
  "#1ABC9C", // Turquoise
  "#E91E63", // Rose
  "#00BCD4", // Cyan
];
