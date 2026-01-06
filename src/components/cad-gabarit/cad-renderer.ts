// ============================================
// CAD RENDERER: Rendu Canvas professionnel
// Dessin de la géométrie, contraintes et cotations
// VERSION: 1.0
// ============================================

import {
  Point,
  Geometry,
  Line,
  Circle,
  Arc,
  Rectangle,
  Constraint,
  Dimension,
  Sketch,
  Viewport,
  SnapPoint,
  RenderStyles,
  DEFAULT_STYLES,
  distance,
  midpoint,
  angle,
} from './types';
import { SnapSystem } from './snap-system';

export class CADRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private styles: RenderStyles;
  private viewport: Viewport;
  private dpr: number; // Device pixel ratio
  
  constructor(canvas: HTMLCanvasElement, styles: Partial<RenderStyles> = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;
    this.styles = { ...DEFAULT_STYLES, ...styles };
    this.dpr = window.devicePixelRatio || 1;
    
    this.viewport = {
      offsetX: canvas.width / 2,
      offsetY: canvas.height / 2,
      scale: 1,
      width: canvas.width,
      height: canvas.height,
    };
  }
  
  /**
   * Redimensionne le canvas
   */
  resize(width: number, height: number): void {
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(this.dpr, this.dpr);
    
    this.viewport.width = width;
    this.viewport.height = height;
  }
  
  /**
   * Met à jour le viewport
   */
  setViewport(viewport: Partial<Viewport>): void {
    this.viewport = { ...this.viewport, ...viewport };
  }
  
  getViewport(): Viewport {
    return { ...this.viewport };
  }
  
  /**
   * Efface et redessine tout
   */
  render(
    sketch: Sketch,
    options: {
      selectedEntities?: Set<string>;
      hoveredEntity?: string | null;
      currentSnapPoint?: SnapPoint | null;
      tempGeometry?: any;
      showGrid?: boolean;
      showConstraints?: boolean;
      showDimensions?: boolean;
      backgroundImage?: HTMLImageElement | null;
    } = {}
  ): void {
    const {
      selectedEntities = new Set(),
      hoveredEntity = null,
      currentSnapPoint = null,
      tempGeometry = null,
      showGrid = true,
      showConstraints = true,
      showDimensions = true,
      backgroundImage = null,
    } = options;
    
    // Clear
    this.ctx.fillStyle = this.styles.backgroundColor;
    this.ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);
    
    this.ctx.save();
    
    // Apply viewport transform
    this.ctx.translate(this.viewport.offsetX, this.viewport.offsetY);
    this.ctx.scale(this.viewport.scale, this.viewport.scale);
    
    // 1. Background image
    if (backgroundImage) {
      this.drawBackgroundImage(backgroundImage);
    }
    
    // 2. Grid
    if (showGrid) {
      this.drawGrid(sketch.scaleFactor);
    }
    
    // 3. Geometries
    sketch.geometries.forEach((geo, id) => {
      const isSelected = selectedEntities.has(id);
      const isHovered = hoveredEntity === id;
      this.drawGeometry(geo, sketch, isSelected, isHovered);
    });
    
    // 4. Points
    sketch.points.forEach((point, id) => {
      const isSelected = selectedEntities.has(id);
      const isHovered = hoveredEntity === id;
      this.drawPoint(point, isSelected, isHovered);
    });
    
    // 5. Temp geometry (during drawing)
    if (tempGeometry) {
      this.drawTempGeometry(tempGeometry);
    }
    
    // 6. Constraints
    if (showConstraints) {
      sketch.constraints.forEach((constraint) => {
        this.drawConstraint(constraint, sketch);
      });
    }
    
    // 7. Dimensions
    if (showDimensions) {
      sketch.dimensions.forEach((dimension) => {
        this.drawDimension(dimension, sketch);
      });
    }
    
    this.ctx.restore();
    
    // 8. Snap indicator (in screen coords)
    if (currentSnapPoint) {
      this.drawSnapIndicator(currentSnapPoint);
    }
    
    // 9. Status bar info
    this.drawStatusBar(sketch);
  }
  
  /**
   * Dessine l'image de fond
   */
  private drawBackgroundImage(image: HTMLImageElement): void {
    this.ctx.globalAlpha = 0.5;
    this.ctx.drawImage(image, 0, 0);
    this.ctx.globalAlpha = 1;
  }
  
  /**
   * Dessine la grille
   */
  private drawGrid(scaleFactor: number): void {
    const gridSize = this.styles.gridSpacing * scaleFactor;
    const majorGridSize = this.styles.gridMajorSpacing * scaleFactor;
    
    // Calculer les limites visibles
    const left = -this.viewport.offsetX / this.viewport.scale;
    const right = (this.viewport.width - this.viewport.offsetX) / this.viewport.scale;
    const top = -this.viewport.offsetY / this.viewport.scale;
    const bottom = (this.viewport.height - this.viewport.offsetY) / this.viewport.scale;
    
    // Grille mineure
    this.ctx.strokeStyle = this.styles.gridColor;
    this.ctx.lineWidth = 0.5 / this.viewport.scale;
    this.ctx.beginPath();
    
    for (let x = Math.floor(left / gridSize) * gridSize; x <= right; x += gridSize) {
      if (Math.abs(x % majorGridSize) > 0.001) {
        this.ctx.moveTo(x, top);
        this.ctx.lineTo(x, bottom);
      }
    }
    
    for (let y = Math.floor(top / gridSize) * gridSize; y <= bottom; y += gridSize) {
      if (Math.abs(y % majorGridSize) > 0.001) {
        this.ctx.moveTo(left, y);
        this.ctx.lineTo(right, y);
      }
    }
    
    this.ctx.stroke();
    
    // Grille majeure
    this.ctx.strokeStyle = this.styles.gridMajorColor;
    this.ctx.lineWidth = 1 / this.viewport.scale;
    this.ctx.beginPath();
    
    for (let x = Math.floor(left / majorGridSize) * majorGridSize; x <= right; x += majorGridSize) {
      this.ctx.moveTo(x, top);
      this.ctx.lineTo(x, bottom);
    }
    
    for (let y = Math.floor(top / majorGridSize) * majorGridSize; y <= bottom; y += majorGridSize) {
      this.ctx.moveTo(left, y);
      this.ctx.lineTo(right, y);
    }
    
    this.ctx.stroke();
    
    // Axes (origine)
    this.ctx.strokeStyle = '#FF0000';
    this.ctx.lineWidth = 1.5 / this.viewport.scale;
    this.ctx.beginPath();
    this.ctx.moveTo(left, 0);
    this.ctx.lineTo(right, 0);
    this.ctx.stroke();
    
    this.ctx.strokeStyle = '#00AA00';
    this.ctx.beginPath();
    this.ctx.moveTo(0, top);
    this.ctx.lineTo(0, bottom);
    this.ctx.stroke();
  }
  
  /**
   * Dessine un point
   */
  private drawPoint(point: Point, isSelected: boolean, isHovered: boolean): void {
    const radius = this.styles.pointRadius / this.viewport.scale;
    
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    
    if (isSelected) {
      this.ctx.fillStyle = this.styles.pointSelectedColor;
    } else if (isHovered) {
      this.ctx.fillStyle = this.styles.selectedColor;
    } else {
      this.ctx.fillStyle = this.styles.pointColor;
    }
    
    this.ctx.fill();
    
    // Point fixe = carré
    if (point.fixed) {
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 1 / this.viewport.scale;
      this.ctx.strokeRect(
        point.x - radius * 1.5,
        point.y - radius * 1.5,
        radius * 3,
        radius * 3
      );
    }
  }
  
  /**
   * Dessine une géométrie
   */
  private drawGeometry(geo: Geometry, sketch: Sketch, isSelected: boolean, isHovered: boolean): void {
    this.ctx.strokeStyle = isSelected
      ? this.styles.selectedColor
      : isHovered
      ? this.styles.selectedColor
      : this.styles.lineColor;
    this.ctx.lineWidth = (isSelected ? this.styles.selectedWidth : this.styles.lineWidth) / this.viewport.scale;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    switch (geo.type) {
      case 'line':
        this.drawLine(geo as Line, sketch);
        break;
      case 'circle':
        this.drawCircle(geo as Circle, sketch);
        break;
      case 'arc':
        this.drawArc(geo as Arc, sketch);
        break;
      case 'rectangle':
        this.drawRectangle(geo as Rectangle, sketch);
        break;
    }
  }
  
  private drawLine(line: Line, sketch: Sketch): void {
    const p1 = sketch.points.get(line.p1);
    const p2 = sketch.points.get(line.p2);
    if (!p1 || !p2) return;
    
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.stroke();
  }
  
  private drawCircle(circle: Circle, sketch: Sketch): void {
    const center = sketch.points.get(circle.center);
    if (!center) return;
    
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, circle.radius, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Marqueur de centre
    const r = 3 / this.viewport.scale;
    this.ctx.beginPath();
    this.ctx.moveTo(center.x - r, center.y);
    this.ctx.lineTo(center.x + r, center.y);
    this.ctx.moveTo(center.x, center.y - r);
    this.ctx.lineTo(center.x, center.y + r);
    this.ctx.stroke();
  }
  
  private drawArc(arc: Arc, sketch: Sketch): void {
    const center = sketch.points.get(arc.center);
    const startPt = sketch.points.get(arc.startPoint);
    const endPt = sketch.points.get(arc.endPoint);
    if (!center || !startPt || !endPt) return;
    
    const startAngle = angle(center, startPt);
    const endAngle = angle(center, endPt);
    
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, arc.radius, startAngle, endAngle);
    this.ctx.stroke();
  }
  
  private drawRectangle(rect: Rectangle, sketch: Sketch): void {
    const corners = [rect.p1, rect.p2, rect.p3, rect.p4]
      .map(id => sketch.points.get(id))
      .filter(Boolean) as Point[];
    
    if (corners.length !== 4) return;
    
    this.ctx.beginPath();
    this.ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) {
      this.ctx.lineTo(corners[i].x, corners[i].y);
    }
    this.ctx.closePath();
    this.ctx.stroke();
  }
  
  /**
   * Dessine la géométrie temporaire (pendant le dessin)
   */
  private drawTempGeometry(temp: any): void {
    this.ctx.strokeStyle = this.styles.selectedColor;
    this.ctx.lineWidth = this.styles.lineWidth / this.viewport.scale;
    this.ctx.setLineDash([5 / this.viewport.scale, 5 / this.viewport.scale]);
    
    if (temp.type === 'line' && temp.points?.length >= 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(temp.points[0].x, temp.points[0].y);
      if (temp.points.length > 1) {
        this.ctx.lineTo(temp.points[1].x, temp.points[1].y);
      } else if (temp.cursor) {
        this.ctx.lineTo(temp.cursor.x, temp.cursor.y);
      }
      this.ctx.stroke();
    } else if (temp.type === 'circle' && temp.center) {
      this.ctx.beginPath();
      this.ctx.arc(temp.center.x, temp.center.y, temp.radius || 0, 0, Math.PI * 2);
      this.ctx.stroke();
    } else if (temp.type === 'rectangle' && temp.p1) {
      const p1 = temp.p1;
      const p2 = temp.cursor || temp.p2;
      if (p2) {
        this.ctx.beginPath();
        this.ctx.rect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        this.ctx.stroke();
      }
    }
    
    this.ctx.setLineDash([]);
  }
  
  /**
   * Dessine une contrainte
   */
  private drawConstraint(constraint: Constraint, sketch: Sketch): void {
    this.ctx.fillStyle = this.styles.constraintColor;
    this.ctx.font = `${12 / this.viewport.scale}px Arial`;
    
    // Position du symbole de contrainte
    let pos: { x: number; y: number } | null = null;
    let symbol = '';
    
    switch (constraint.type) {
      case 'horizontal':
        symbol = '─';
        pos = this.getConstraintPosition(constraint, sketch);
        break;
      case 'vertical':
        symbol = '│';
        pos = this.getConstraintPosition(constraint, sketch);
        break;
      case 'perpendicular':
        symbol = '⊥';
        pos = this.getConstraintPosition(constraint, sketch);
        break;
      case 'parallel':
        symbol = '∥';
        pos = this.getConstraintPosition(constraint, sketch);
        break;
      case 'coincident':
        symbol = '●';
        pos = this.getConstraintPosition(constraint, sketch);
        break;
      case 'tangent':
        symbol = '○';
        pos = this.getConstraintPosition(constraint, sketch);
        break;
      case 'equal':
        symbol = '=';
        pos = this.getConstraintPosition(constraint, sketch);
        break;
      case 'fixed':
        symbol = '⚓';
        pos = this.getConstraintPosition(constraint, sketch);
        break;
    }
    
    if (pos && symbol) {
      this.ctx.fillText(symbol, pos.x + 5 / this.viewport.scale, pos.y - 5 / this.viewport.scale);
    }
  }
  
  private getConstraintPosition(constraint: Constraint, sketch: Sketch): { x: number; y: number } | null {
    if (constraint.entities.length === 0) return null;
    
    const firstEntity = constraint.entities[0];
    
    // Essayer comme point
    const point = sketch.points.get(firstEntity);
    if (point) return { x: point.x, y: point.y };
    
    // Essayer comme géométrie
    const geo = sketch.geometries.get(firstEntity);
    if (geo) {
      if (geo.type === 'line') {
        const p1 = sketch.points.get((geo as Line).p1);
        const p2 = sketch.points.get((geo as Line).p2);
        if (p1 && p2) return midpoint(p1, p2);
      } else if (geo.type === 'circle') {
        const center = sketch.points.get((geo as Circle).center);
        if (center) return center;
      }
    }
    
    return null;
  }
  
  /**
   * Dessine une cotation
   */
  private drawDimension(dimension: Dimension, sketch: Sketch): void {
    this.ctx.strokeStyle = this.styles.dimensionColor;
    this.ctx.fillStyle = this.styles.dimensionColor;
    this.ctx.lineWidth = 1 / this.viewport.scale;
    this.ctx.font = `${this.styles.dimensionFont.replace(/\d+/, (m) => String(parseInt(m) / this.viewport.scale))}`;
    
    switch (dimension.type) {
      case 'linear':
      case 'horizontal':
      case 'vertical':
        this.drawLinearDimension(dimension, sketch);
        break;
      case 'radius':
      case 'diameter':
        this.drawRadialDimension(dimension, sketch);
        break;
      case 'angle':
        this.drawAngularDimension(dimension, sketch);
        break;
    }
  }
  
  private drawLinearDimension(dimension: Dimension, sketch: Sketch): void {
    if (dimension.entities.length < 2) return;
    
    const p1 = sketch.points.get(dimension.entities[0]);
    const p2 = sketch.points.get(dimension.entities[1]);
    if (!p1 || !p2) return;
    
    const offset = 20 / this.viewport.scale;
    const arrowSize = this.styles.dimensionArrowSize / this.viewport.scale;
    
    // Calculer la position de la ligne de cote
    let dimLine1: { x: number; y: number };
    let dimLine2: { x: number; y: number };
    
    if (dimension.type === 'horizontal') {
      dimLine1 = { x: p1.x, y: Math.min(p1.y, p2.y) - offset };
      dimLine2 = { x: p2.x, y: Math.min(p1.y, p2.y) - offset };
    } else if (dimension.type === 'vertical') {
      dimLine1 = { x: Math.max(p1.x, p2.x) + offset, y: p1.y };
      dimLine2 = { x: Math.max(p1.x, p2.x) + offset, y: p2.y };
    } else {
      // Linear - perpendiculaire à la ligne
      const ang = angle(p1, p2) + Math.PI / 2;
      dimLine1 = { x: p1.x + Math.cos(ang) * offset, y: p1.y + Math.sin(ang) * offset };
      dimLine2 = { x: p2.x + Math.cos(ang) * offset, y: p2.y + Math.sin(ang) * offset };
    }
    
    // Lignes d'attache
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(dimLine1.x, dimLine1.y);
    this.ctx.moveTo(p2.x, p2.y);
    this.ctx.lineTo(dimLine2.x, dimLine2.y);
    this.ctx.stroke();
    
    // Ligne de cote
    this.ctx.beginPath();
    this.ctx.moveTo(dimLine1.x, dimLine1.y);
    this.ctx.lineTo(dimLine2.x, dimLine2.y);
    this.ctx.stroke();
    
    // Flèches
    this.drawArrow(dimLine1, dimLine2, arrowSize);
    this.drawArrow(dimLine2, dimLine1, arrowSize);
    
    // Texte
    const textPos = midpoint(dimLine1, dimLine2);
    const text = `${dimension.value.toFixed(2)}`;
    
    this.ctx.save();
    this.ctx.translate(textPos.x, textPos.y);
    
    let textAngle = angle(dimLine1, dimLine2);
    if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) {
      textAngle += Math.PI;
    }
    
    this.ctx.rotate(textAngle);
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText(text, 0, -3 / this.viewport.scale);
    this.ctx.restore();
  }
  
  private drawRadialDimension(dimension: Dimension, sketch: Sketch): void {
    const geo = sketch.geometries.get(dimension.entities[0]) as Circle | undefined;
    if (!geo || geo.type !== 'circle') return;
    
    const center = sketch.points.get(geo.center);
    if (!center) return;
    
    const radius = geo.radius;
    const ang = Math.PI / 4; // 45°
    
    const endPoint = {
      x: center.x + Math.cos(ang) * radius,
      y: center.y + Math.sin(ang) * radius,
    };
    
    // Ligne de cote
    this.ctx.beginPath();
    if (dimension.type === 'diameter') {
      const startPoint = {
        x: center.x - Math.cos(ang) * radius,
        y: center.y - Math.sin(ang) * radius,
      };
      this.ctx.moveTo(startPoint.x, startPoint.y);
      this.ctx.lineTo(endPoint.x, endPoint.y);
    } else {
      this.ctx.moveTo(center.x, center.y);
      this.ctx.lineTo(endPoint.x, endPoint.y);
    }
    this.ctx.stroke();
    
    // Texte
    const prefix = dimension.type === 'diameter' ? 'Ø' : 'R';
    const text = `${prefix}${dimension.value.toFixed(2)}`;
    
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText(text, endPoint.x + 5 / this.viewport.scale, endPoint.y);
  }
  
  private drawAngularDimension(dimension: Dimension, sketch: Sketch): void {
    // TODO: Implement angular dimension
  }
  
  private drawArrow(from: { x: number; y: number }, to: { x: number; y: number }, size: number): void {
    const ang = angle(from, to);
    
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(
      from.x + Math.cos(ang + Math.PI * 0.85) * size,
      from.y + Math.sin(ang + Math.PI * 0.85) * size
    );
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(
      from.x + Math.cos(ang - Math.PI * 0.85) * size,
      from.y + Math.sin(ang - Math.PI * 0.85) * size
    );
    this.ctx.stroke();
  }
  
  /**
   * Dessine l'indicateur de snap
   */
  private drawSnapIndicator(snapPoint: SnapPoint): void {
    const screenPos = {
      x: snapPoint.x * this.viewport.scale + this.viewport.offsetX,
      y: snapPoint.y * this.viewport.scale + this.viewport.offsetY,
    };
    
    const radius = this.styles.snapRadius;
    
    this.ctx.strokeStyle = this.styles.snapColor;
    this.ctx.lineWidth = 2;
    
    switch (snapPoint.type) {
      case 'endpoint':
        // Carré
        this.ctx.strokeRect(screenPos.x - radius, screenPos.y - radius, radius * 2, radius * 2);
        break;
      case 'midpoint':
        // Triangle
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - radius);
        this.ctx.lineTo(screenPos.x - radius, screenPos.y + radius);
        this.ctx.lineTo(screenPos.x + radius, screenPos.y + radius);
        this.ctx.closePath();
        this.ctx.stroke();
        break;
      case 'center':
        // Cercle avec croix
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x - radius, screenPos.y);
        this.ctx.lineTo(screenPos.x + radius, screenPos.y);
        this.ctx.moveTo(screenPos.x, screenPos.y - radius);
        this.ctx.lineTo(screenPos.x, screenPos.y + radius);
        this.ctx.stroke();
        break;
      case 'intersection':
        // X
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x - radius, screenPos.y - radius);
        this.ctx.lineTo(screenPos.x + radius, screenPos.y + radius);
        this.ctx.moveTo(screenPos.x + radius, screenPos.y - radius);
        this.ctx.lineTo(screenPos.x - radius, screenPos.y + radius);
        this.ctx.stroke();
        break;
      case 'quadrant':
        // Losange
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - radius);
        this.ctx.lineTo(screenPos.x + radius, screenPos.y);
        this.ctx.lineTo(screenPos.x, screenPos.y + radius);
        this.ctx.lineTo(screenPos.x - radius, screenPos.y);
        this.ctx.closePath();
        this.ctx.stroke();
        break;
      default:
        // Cercle simple
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    // Label du type de snap
    this.ctx.fillStyle = this.styles.snapColor;
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(SnapSystem.getSnapName(snapPoint.type), screenPos.x + radius + 5, screenPos.y + 4);
  }
  
  /**
   * Dessine la barre de statut
   */
  private drawStatusBar(sketch: Sketch): void {
    const barHeight = 24;
    const y = this.viewport.height - barHeight;
    
    // Fond
    this.ctx.fillStyle = '#F5F5F5';
    this.ctx.fillRect(0, y, this.viewport.width, barHeight);
    
    // Bordure
    this.ctx.strokeStyle = '#CCCCCC';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, y);
    this.ctx.lineTo(this.viewport.width, y);
    this.ctx.stroke();
    
    // Texte
    this.ctx.fillStyle = '#333333';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    
    // DOF
    let statusColor = '#00AA00';
    let statusText = 'Fully constrained';
    
    if (sketch.status === 'under-constrained') {
      statusColor = '#FF8800';
      statusText = `DOF: ${sketch.dof}`;
    } else if (sketch.status === 'over-constrained') {
      statusColor = '#FF0000';
      statusText = 'Over-constrained';
    } else if (sketch.status === 'conflicting') {
      statusColor = '#FF0000';
      statusText = 'Conflicting constraints';
    }
    
    this.ctx.fillStyle = statusColor;
    this.ctx.fillText(`● ${statusText}`, 10, y + barHeight / 2);
    
    // Zoom
    this.ctx.fillStyle = '#666666';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`Zoom: ${Math.round(this.viewport.scale * 100)}%`, this.viewport.width - 10, y + barHeight / 2);
    
    // Scale
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Scale: 1px = ${(1 / sketch.scaleFactor).toFixed(2)}mm`, this.viewport.width / 2, y + barHeight / 2);
  }
}

export default CADRenderer;
