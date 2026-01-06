// ============================================
// TYPES: CAD Gabarit Types
// Types pour le système CAO
// VERSION: 1.0
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
  type: 'line';
  p1: string; // ID du point de départ
  p2: string; // ID du point d'arrivée
}

export interface Circle {
  id: string;
  type: 'circle';
  center: string; // ID du point central
  radius: number;
}

export interface Arc {
  id: string;
  type: 'arc';
  center: string;
  startPoint: string;
  endPoint: string;
  radius: number;
}

export interface Rectangle {
  id: string;
  type: 'rectangle';
  p1: string; // coin supérieur gauche
  p2: string; // coin supérieur droit
  p3: string; // coin inférieur droit
  p4: string; // coin inférieur gauche
}

export type Geometry = Line | Circle | Arc | Rectangle;

// === CONTRAINTES ===

export type ConstraintType = 
  | 'coincident'      // Points superposés
  | 'horizontal'      // Ligne horizontale
  | 'vertical'        // Ligne verticale
  | 'parallel'        // Lignes parallèles
  | 'perpendicular'   // Lignes perpendiculaires
  | 'tangent'         // Tangence
  | 'equal'           // Longueurs/rayons égaux
  | 'concentric'      // Cercles concentriques
  | 'distance'        // Distance fixe
  | 'angle'           // Angle fixe
  | 'radius'          // Rayon fixe
  | 'diameter'        // Diamètre fixe
  | 'midpoint'        // Point au milieu
  | 'symmetric'       // Symétrie
  | 'fixed';          // Point fixe

export interface Constraint {
  id: string;
  type: ConstraintType;
  entities: string[]; // IDs des entités concernées
  value?: number;     // Valeur pour distance, angle, radius, etc.
  driving?: boolean;  // Si false, c'est une contrainte de référence
}

// === COTATIONS ===

export interface Dimension {
  id: string;
  type: 'linear' | 'horizontal' | 'vertical' | 'radius' | 'diameter' | 'angle';
  entities: string[];
  value: number;
  position: { x: number; y: number }; // Position du texte
  constraintId?: string; // ID de la contrainte liée
}

// === SNAP ===

export type SnapType = 
  | 'endpoint'
  | 'midpoint'
  | 'center'
  | 'intersection'
  | 'quadrant'
  | 'tangent'
  | 'perpendicular'
  | 'nearest'
  | 'grid';

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
  gridSize: number;  // Taille de la grille
  showGrid: boolean;
}

// === OUTILS ===

export type ToolType = 
  | 'select'
  | 'pan'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'arc'
  | 'dimension'
  | 'constraint'
  | 'trim'
  | 'extend';

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

// === SKETCH (Document) ===

export interface Sketch {
  id: string;
  name: string;
  points: Map<string, Point>;
  geometries: Map<string, Geometry>;
  constraints: Map<string, Constraint>;
  dimensions: Map<string, Dimension>;
  scaleFactor: number; // px to mm
  dof: number; // Degrees of Freedom
  status: 'under-constrained' | 'fully-constrained' | 'over-constrained' | 'conflicting';
}

// === SOLVEUR ===

export interface SolverResult {
  success: boolean;
  dof: number;
  status: Sketch['status'];
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
  format: 'dxf' | 'svg';
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
  lineColor: '#000000',
  lineWidth: 1.5,
  selectedColor: '#0066FF',
  selectedWidth: 2,
  constructionColor: '#888888',
  constructionStyle: [5, 5],
  
  pointColor: '#0066FF',
  pointRadius: 4,
  pointSelectedColor: '#FF6600',
  
  constraintColor: '#00AA00',
  constraintFont: '12px Arial',
  
  dimensionColor: '#CC0000',
  dimensionFont: '11px Arial',
  dimensionArrowSize: 8,
  
  snapColor: '#FF00FF',
  snapRadius: 6,
  
  gridColor: '#E8E8E8',
  gridMajorColor: '#CCCCCC',
  gridSpacing: 10,
  gridMajorSpacing: 50,
  
  backgroundColor: '#FFFFFF',
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
