// ============================================
// CAD RENDERER: Rendu Canvas professionnel
// Dessin de la géométrie, contraintes et cotations
// VERSION: 3.19 - Plus de graduations intermédiaires sur les règles
// ============================================

import {
  Point,
  Geometry,
  Line,
  Circle,
  Arc,
  Rectangle,
  Bezier,
  Constraint,
  Dimension,
  Sketch,
  Viewport,
  SnapPoint,
  RenderStyles,
  DEFAULT_STYLES,
  CalibrationData,
  CalibrationPoint,
  CalibrationPair,
  distance,
  midpoint,
  angle,
} from "./types";
import { SnapSystem } from "./snap-system";

export class CADRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private styles: RenderStyles;
  private viewport: Viewport;
  private dpr: number; // Device pixel ratio
  private currentScaleFactor: number = 1; // px/mm pour les règles

  constructor(canvas: HTMLCanvasElement, styles: Partial<RenderStyles> = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cannot get 2D context");
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
      transformedImage?: HTMLCanvasElement | null;
      imageOpacity?: number;
      imageScale?: number;
      calibrationData?: CalibrationData | null;
      showCalibration?: boolean;
      measureData?: {
        start: { x: number; y: number } | null;
        end: { x: number; y: number } | null;
        scale?: number;
      } | null;
      measurements?: Array<{
        id: string;
        start: { x: number; y: number };
        end: { x: number; y: number };
        px: number;
        mm: number;
      }>;
      measureScale?: number;
      scaleFactor?: number; // px/mm pour convertir les coordonnées en mm sur les règles
    } = {},
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
      transformedImage = null,
      imageOpacity = 0.5,
      imageScale = 1,
      calibrationData = null,
      showCalibration = true,
      measureData = null,
      measurements = [],
      measureScale = 1,
      scaleFactor = 1, // Par défaut 1 (coordonnées = mm)
    } = options;

    // Stocker scaleFactor pour drawRulers
    this.currentScaleFactor = scaleFactor;

    const rulerSize = 25;

    // Clear - fond complet
    this.ctx.fillStyle = this.styles.backgroundColor;
    this.ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);

    // Dessiner les fonds des règles EN PREMIER (avant le clip)
    this.ctx.fillStyle = "#f0f0f0";
    // Règle du HAUT (horizontale)
    this.ctx.fillRect(rulerSize, 0, this.viewport.width - rulerSize, rulerSize);
    // Règle de GAUCHE (verticale)
    this.ctx.fillRect(0, rulerSize, rulerSize, this.viewport.height - rulerSize);
    // Coin supérieur gauche
    this.ctx.fillStyle = "#e8e8e8";
    this.ctx.fillRect(0, 0, rulerSize, rulerSize);

    this.ctx.save();

    // Clip: zone de dessin (hors règles - coin supérieur gauche exclu)
    this.ctx.beginPath();
    this.ctx.rect(rulerSize, rulerSize, this.viewport.width - rulerSize, this.viewport.height - rulerSize);
    this.ctx.clip();

    // Apply viewport transform
    // offsetX, offsetY = position écran de l'origine monde (0,0)
    // Y canvas augmente vers le bas (système standard)
    this.ctx.translate(this.viewport.offsetX, this.viewport.offsetY);
    this.ctx.scale(this.viewport.scale, this.viewport.scale);

    // 1. Background image (utiliser l'image transformée si disponible)
    if (transformedImage) {
      this.drawTransformedImage(transformedImage, imageOpacity, imageScale);
    } else if (backgroundImage) {
      this.drawBackgroundImage(backgroundImage, imageOpacity, imageScale);
    }

    // 1.5. Calibration (sous la grille et le dessin)
    if (showCalibration && calibrationData) {
      this.drawCalibration(calibrationData);
    }

    // 2. Grid
    if (showGrid) {
      this.drawGrid(sketch.scaleFactor);
    }

    // 3. Geometries (filtrer par visibilité du calque)
    // OPTIMISATION: Batch des lignes non-sélectionnées pour réduire les appels draw
    const normalLines: { p1: Point; p2: Point }[] = [];
    const selectedLines: { p1: Point; p2: Point }[] = [];

    // Viewport bounds pour culling
    const cullLeft = (rulerSize - this.viewport.offsetX) / this.viewport.scale;
    const cullRight = (this.viewport.width - this.viewport.offsetX) / this.viewport.scale;
    const cullTop = (rulerSize - this.viewport.offsetY) / this.viewport.scale;
    const cullBottom = (this.viewport.height - this.viewport.offsetY) / this.viewport.scale;

    sketch.geometries.forEach((geo, id) => {
      // Vérifier si le calque est visible
      const layerId = geo.layerId || "trace";
      const layer = sketch.layers.get(layerId);
      // Si le calque existe et n'est pas visible, ne pas dessiner
      if (layer?.visible === false) return;

      const isSelected = selectedEntities.has(id);
      const isHovered = hoveredEntity === id;

      // Pour les lignes, utiliser le batching
      if (geo.type === "line") {
        const line = geo as Line;
        const p1 = sketch.points.get(line.p1);
        const p2 = sketch.points.get(line.p2);
        if (p1 && p2) {
          // Viewport culling
          const minX = Math.min(p1.x, p2.x);
          const maxX = Math.max(p1.x, p2.x);
          const minY = Math.min(p1.y, p2.y);
          const maxY = Math.max(p1.y, p2.y);

          if (maxX >= cullLeft && minX <= cullRight && maxY >= cullTop && minY <= cullBottom) {
            if (isSelected || isHovered) {
              selectedLines.push({ p1, p2 });
            } else {
              normalLines.push({ p1, p2 });
            }
          }
        }
      } else {
        // Autres géométries: dessin individuel
        this.drawGeometry(geo, sketch, isSelected, isHovered);
      }
    });

    // Dessiner les lignes normales en batch
    if (normalLines.length > 0) {
      this.ctx.strokeStyle = this.styles.lineColor;
      this.ctx.lineWidth = this.styles.lineWidth / this.viewport.scale;
      this.ctx.lineCap = "round";
      this.ctx.beginPath();
      for (const { p1, p2 } of normalLines) {
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
      }
      this.ctx.stroke();
    }

    // Dessiner les lignes sélectionnées en batch
    if (selectedLines.length > 0) {
      this.ctx.strokeStyle = this.styles.selectedColor;
      this.ctx.lineWidth = this.styles.selectedWidth / this.viewport.scale;
      this.ctx.lineCap = "round";
      this.ctx.beginPath();
      for (const { p1, p2 } of selectedLines) {
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
      }
      this.ctx.stroke();
    }

    // 3.5 Marqueurs géométriques (milieux et angles droits) - seulement pour éléments sélectionnés
    this.drawMidpointMarkers(sketch, selectedEntities);
    this.drawRightAngleMarkers(sketch, selectedEntities);

    // 4. Points (filtrer par calques visibles - un point est visible si au moins une de ses géométries l'est)
    const visiblePointIds = new Set<string>();
    sketch.geometries.forEach((geo) => {
      const layerId = geo.layerId || "trace";
      const layer = sketch.layers.get(layerId);
      if (layer?.visible === false) return;

      // Collecter les points de cette géométrie
      if (geo.type === "line") {
        visiblePointIds.add((geo as Line).p1);
        visiblePointIds.add((geo as Line).p2);
      } else if (geo.type === "circle") {
        visiblePointIds.add((geo as Circle).center);
      } else if (geo.type === "bezier") {
        visiblePointIds.add((geo as Bezier).p1);
        visiblePointIds.add((geo as Bezier).p2);
        visiblePointIds.add((geo as Bezier).cp1);
        visiblePointIds.add((geo as Bezier).cp2);
      } else if (geo.type === "arc") {
        visiblePointIds.add((geo as Arc).center);
        visiblePointIds.add((geo as Arc).startPoint);
        visiblePointIds.add((geo as Arc).endPoint);
      }
    });

    // Ne dessiner les points QUE pour les géométries sélectionnées ou survolées
    // Cela évite de polluer l'affichage avec tous les points
    const pointsToShow = new Set<string>();

    // Ajouter les points des géométries sélectionnées
    selectedEntities.forEach((entityId) => {
      const geo = sketch.geometries.get(entityId);
      if (geo) {
        if (geo.type === "line") {
          pointsToShow.add((geo as Line).p1);
          pointsToShow.add((geo as Line).p2);
        } else if (geo.type === "circle") {
          pointsToShow.add((geo as Circle).center);
        } else if (geo.type === "bezier") {
          pointsToShow.add((geo as Bezier).p1);
          pointsToShow.add((geo as Bezier).p2);
          pointsToShow.add((geo as Bezier).cp1);
          pointsToShow.add((geo as Bezier).cp2);
        } else if (geo.type === "arc") {
          pointsToShow.add((geo as Arc).center);
          pointsToShow.add((geo as Arc).startPoint);
          pointsToShow.add((geo as Arc).endPoint);
        }
      }
      // Si c'est un point lui-même qui est sélectionné
      if (sketch.points.has(entityId)) {
        pointsToShow.add(entityId);
      }
    });

    // Ajouter les points de la géométrie survolée
    if (hoveredEntity) {
      const geo = sketch.geometries.get(hoveredEntity);
      if (geo) {
        if (geo.type === "line") {
          pointsToShow.add((geo as Line).p1);
          pointsToShow.add((geo as Line).p2);
        } else if (geo.type === "circle") {
          pointsToShow.add((geo as Circle).center);
        } else if (geo.type === "bezier") {
          pointsToShow.add((geo as Bezier).p1);
          pointsToShow.add((geo as Bezier).p2);
          pointsToShow.add((geo as Bezier).cp1);
          pointsToShow.add((geo as Bezier).cp2);
        } else if (geo.type === "arc") {
          pointsToShow.add((geo as Arc).center);
          pointsToShow.add((geo as Arc).startPoint);
          pointsToShow.add((geo as Arc).endPoint);
        }
      }
      // Si c'est un point lui-même qui est survolé
      if (sketch.points.has(hoveredEntity)) {
        pointsToShow.add(hoveredEntity);
      }
    }

    // Ne dessiner que les points qui doivent être visibles
    sketch.points.forEach((point, id) => {
      // Vérifier que le point appartient à une géométrie visible
      if (!visiblePointIds.has(id)) return;
      // Ne dessiner que les points sélectionnés/survolés
      if (!pointsToShow.has(id)) return;

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

    // 8. Poignées des entités sélectionnées
    if (selectedEntities.size > 0) {
      this.drawHandles(sketch, selectedEntities);
    }

    // 8.5. Mesures persistantes
    if (measurements.length > 0) {
      measurements.forEach((m) => {
        this.drawMeasure(m.start, m.end, measureScale, m.mm);
      });
    }

    // 8.6. Mesure en cours (preview)
    if (measureData?.start) {
      this.drawMeasure(measureData.start, measureData.end, measureData.scale);
    }

    this.ctx.restore();

    // 9. Snap indicator (in screen coords)
    if (currentSnapPoint) {
      this.drawSnapIndicator(currentSnapPoint);
    }

    // 10. Status bar info
    this.drawStatusBar(sketch);

    // 11. Règles graduées (TOUJOURS par-dessus tout, en coordonnées écran)
    this.drawRulers();
  }

  /**
   * Dessine l'image de fond
   */
  private drawBackgroundImage(image: HTMLImageElement, opacity: number = 0.5, imageScale: number = 1): void {
    this.ctx.globalAlpha = opacity;
    // Centrer l'image sur l'origine, mise à l'échelle
    const scaledWidth = image.width * imageScale;
    const scaledHeight = image.height * imageScale;
    this.ctx.drawImage(image, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
    this.ctx.globalAlpha = 1;
  }

  /**
   * Dessine l'image transformée (après correction de perspective)
   */
  private drawTransformedImage(canvas: HTMLCanvasElement, opacity: number = 0.5, imageScale: number = 1): void {
    this.ctx.globalAlpha = opacity;
    // L'image transformée est déjà centrée sur l'origine dans son canvas
    // On applique l'échelle mm/px
    const scaledWidth = canvas.width * imageScale;
    const scaledHeight = canvas.height * imageScale;
    this.ctx.drawImage(canvas, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
    this.ctx.globalAlpha = 1;
  }

  /**
   * Dessine la grille
   */
  private drawGrid(scaleFactor: number): void {
    // Adapter la grille au niveau de zoom pour éviter trop de lignes
    let gridSize = this.styles.gridSpacing;
    let majorGridSize = this.styles.gridMajorSpacing;

    // Calculer la taille de grille visible en pixels
    const gridSizeOnScreen = gridSize * this.viewport.scale;

    // Si la grille est trop fine (< 10px), on augmente l'espacement
    if (gridSizeOnScreen < 10) {
      const factor = Math.ceil(10 / gridSizeOnScreen);
      gridSize *= factor;
      majorGridSize *= factor;
    }

    // Si la grille est trop large (> 100px), on réduit l'espacement
    if (gridSizeOnScreen > 100) {
      const factor = Math.floor(gridSizeOnScreen / 50);
      if (factor > 0) {
        gridSize /= factor;
        majorGridSize /= factor;
      }
    }

    // Calculer les limites visibles en coordonnées monde
    const rulerSize = 25;
    const left = (rulerSize - this.viewport.offsetX) / this.viewport.scale;
    const right = (this.viewport.width - this.viewport.offsetX) / this.viewport.scale;
    const top = (rulerSize - this.viewport.offsetY) / this.viewport.scale;
    const bottom = (this.viewport.height - this.viewport.offsetY) / this.viewport.scale;

    // Limiter le nombre de lignes (max 200 dans chaque direction)
    const maxLines = 200;
    const horizontalLines = Math.abs(right - left) / gridSize;
    const verticalLines = Math.abs(bottom - top) / gridSize;

    if (horizontalLines > maxLines || verticalLines > maxLines) {
      // Grille trop dense, on n'affiche que la grille majeure
      gridSize = majorGridSize;
    }

    // Vérifier que gridSize est valide
    if (gridSize <= 0 || !isFinite(gridSize)) {
      gridSize = 10;
      majorGridSize = 50;
    }

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
  }

  /**
   * Dessine les règles graduées en mm sur les bords haut et gauche
   */
  private drawRulers(): void {
    const ctx = this.ctx;
    const w = this.viewport.width;
    const h = this.viewport.height;
    const sf = this.currentScaleFactor; // px/mm

    // Vérifier que les dimensions sont valides
    if (!w || !h || w <= 0 || h <= 0) {
      return;
    }

    // Sauvegarder et reset le contexte en coordonnées écran
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const rulerSize = 25;
    const tickSmall = 4;
    const tickMedium = 7;
    const tickLarge = 10;

    // Échelle effective en mm: combien de mm par pixel écran
    // viewport.scale = zoom (px écran par px monde)
    // sf = px monde par mm
    // => mm par px écran = 1 / (viewport.scale * sf)
    const mmPerScreenPx = 1 / (this.viewport.scale * sf);

    // Espacement adaptatif en mm (viser ~35-50 px entre graduations)
    const spacingsMm = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    let spacingMm = 50;
    for (const s of spacingsMm) {
      // s mm * sf px/mm * scale = pixels écran
      if (s * sf * this.viewport.scale >= 35) {
        spacingMm = s;
        break;
      }
    }

    // ===== FOND DES RÈGLES =====
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(rulerSize, 0, w - rulerSize, rulerSize);
    ctx.fillRect(0, rulerSize, rulerSize, h - rulerSize);
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(0, 0, rulerSize, rulerSize);

    // Bordures
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rulerSize, rulerSize);
    ctx.lineTo(w, rulerSize);
    ctx.moveTo(rulerSize, rulerSize);
    ctx.lineTo(rulerSize, h);
    ctx.stroke();

    // Config pour les graduations
    ctx.fillStyle = "#333";
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;

    // ===== RÈGLE HORIZONTALE (HAUT) - Axe X en mm =====
    // Position monde (px) du bord gauche et droit de la règle
    const leftWorldPx = (rulerSize - this.viewport.offsetX) / this.viewport.scale;
    const rightWorldPx = (w - this.viewport.offsetX) / this.viewport.scale;
    // Convertir en mm
    const leftMm = leftWorldPx / sf;
    const rightMm = rightWorldPx / sf;
    const startXmm = Math.floor(leftMm / spacingMm) * spacingMm;
    const endXmm = Math.ceil(rightMm / spacingMm) * spacingMm;

    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    for (let xMm = startXmm; xMm <= endXmm; xMm += spacingMm) {
      // Convertir mm en position écran
      const worldPx = xMm * sf; // mm -> px monde
      const screenX = worldPx * this.viewport.scale + this.viewport.offsetX;
      if (screenX < rulerSize || screenX > w) continue;

      const idx = Math.round(Math.abs(xMm) / spacingMm);
      // Major = tous les 5, ou si spacing >= 50
      const isMajor = idx % 5 === 0 || spacingMm >= 50;
      // Semi-major = tous les autres pairs
      const isSemiMajor = idx % 2 === 0 && !isMajor;
      // Minor avec chiffre = tous les impairs si spacing <= 10
      const isMinorWithLabel = spacingMm <= 10 && idx % 2 !== 0;

      const tickH = isMajor ? tickLarge : isSemiMajor ? tickMedium : tickSmall;

      ctx.beginPath();
      ctx.moveTo(screenX, rulerSize);
      ctx.lineTo(screenX, rulerSize - tickH);
      ctx.stroke();

      // Afficher les chiffres
      if (isMajor) {
        ctx.font = "9px Arial, sans-serif";
        ctx.fillStyle = "#333";
        ctx.fillText(`${xMm}`, screenX, rulerSize - tickLarge - 1);
      } else if (isSemiMajor && spacingMm <= 20) {
        ctx.font = "7px Arial, sans-serif";
        ctx.fillStyle = "#888";
        ctx.fillText(`${xMm}`, screenX, rulerSize - tickMedium - 1);
      } else if (isMinorWithLabel) {
        ctx.font = "6px Arial, sans-serif";
        ctx.fillStyle = "#aaa";
        ctx.fillText(`${xMm}`, screenX, rulerSize - tickSmall - 1);
      }
    }

    // ===== RÈGLE VERTICALE (GAUCHE) - Axe Y en mm =====
    const topWorldPx = (rulerSize - this.viewport.offsetY) / this.viewport.scale;
    const bottomWorldPx = (h - this.viewport.offsetY) / this.viewport.scale;
    const topMm = topWorldPx / sf;
    const bottomMm = bottomWorldPx / sf;
    const startYmm = Math.floor(topMm / spacingMm) * spacingMm;
    const endYmm = Math.ceil(bottomMm / spacingMm) * spacingMm;

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let yMm = startYmm; yMm <= endYmm; yMm += spacingMm) {
      const worldPx = yMm * sf;
      const screenY = worldPx * this.viewport.scale + this.viewport.offsetY;
      if (screenY < rulerSize || screenY > h) continue;

      const idx = Math.round(Math.abs(yMm) / spacingMm);
      const isMajor = idx % 5 === 0 || spacingMm >= 50;
      const isSemiMajor = idx % 2 === 0 && !isMajor;
      const isMinorWithLabel = spacingMm <= 10 && idx % 2 !== 0;

      const tickW = isMajor ? tickLarge : isSemiMajor ? tickMedium : tickSmall;

      ctx.beginPath();
      ctx.moveTo(rulerSize, screenY);
      ctx.lineTo(rulerSize - tickW, screenY);
      ctx.stroke();

      if (isMajor) {
        ctx.font = "9px Arial, sans-serif";
        ctx.fillStyle = "#333";
        ctx.fillText(`${yMm}`, rulerSize - tickW - 2, screenY);
      } else if (isSemiMajor && spacingMm <= 20) {
        ctx.font = "7px Arial, sans-serif";
        ctx.fillStyle = "#888";
        ctx.fillText(`${yMm}`, rulerSize - tickW - 2, screenY);
      } else if (isMinorWithLabel) {
        ctx.font = "6px Arial, sans-serif";
        ctx.fillStyle = "#aaa";
        ctx.fillText(`${yMm}`, rulerSize - tickW - 2, screenY);
      }
    }

    // ===== UNITÉ DANS LE COIN =====
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 8px Arial, sans-serif";
    ctx.fillStyle = "#666";
    ctx.fillText("mm", rulerSize / 2, rulerSize / 2);

    ctx.restore();
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
      this.ctx.strokeStyle = "#000000";
      this.ctx.lineWidth = 1 / this.viewport.scale;
      this.ctx.strokeRect(point.x - radius * 1.5, point.y - radius * 1.5, radius * 3, radius * 3);
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
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    switch (geo.type) {
      case "line":
        this.drawLine(geo as Line, sketch);
        break;
      case "circle":
        this.drawCircle(geo as Circle, sketch);
        break;
      case "arc":
        this.drawArc(geo as Arc, sketch);
        break;
      case "rectangle":
        this.drawRectangle(geo as Rectangle, sketch);
        break;
      case "bezier":
        this.drawBezier(geo as Bezier, sketch, isSelected);
        break;
    }
  }

  private drawLine(line: Line, sketch: Sketch): void {
    const p1 = sketch.points.get(line.p1);
    const p2 = sketch.points.get(line.p2);
    if (!p1 || !p2) return;

    // Viewport culling - ne pas dessiner les lignes hors écran
    const left = -this.viewport.offsetX / this.viewport.scale;
    const top = -this.viewport.offsetY / this.viewport.scale;
    const right = left + this.viewport.width / this.viewport.scale;
    const bottom = top + this.viewport.height / this.viewport.scale;

    // Vérifier si la ligne est complètement hors écran
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    if (maxX < left || minX > right || maxY < top || minY > bottom) {
      return; // Ligne hors écran, ne pas dessiner
    }

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
    let endAngle = angle(center, endPt);

    // Déterminer si on doit dessiner dans le sens horaire ou antihoraire
    // On veut toujours dessiner le petit arc (< 180°)
    let deltaAngle = endAngle - startAngle;

    // Normaliser deltaAngle entre -PI et PI
    while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    // Si deltaAngle > 0, on dessine dans le sens antihoraire (par défaut)
    // Si deltaAngle < 0, on dessine dans le sens horaire
    const counterClockwise = deltaAngle < 0;

    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, arc.radius, startAngle, endAngle, counterClockwise);
    this.ctx.stroke();
  }

  private drawRectangle(rect: Rectangle, sketch: Sketch): void {
    const corners = [rect.p1, rect.p2, rect.p3, rect.p4].map((id) => sketch.points.get(id)).filter(Boolean) as Point[];

    if (corners.length !== 4) return;

    this.ctx.beginPath();
    this.ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) {
      this.ctx.lineTo(corners[i].x, corners[i].y);
    }
    this.ctx.closePath();
    this.ctx.stroke();
  }

  private drawBezier(bezier: Bezier, sketch: Sketch, isSelected: boolean): void {
    const p1 = sketch.points.get(bezier.p1);
    const p2 = sketch.points.get(bezier.p2);
    const cp1 = sketch.points.get(bezier.cp1);
    const cp2 = sketch.points.get(bezier.cp2);

    if (!p1 || !p2 || !cp1 || !cp2) return;

    // Dessiner la courbe
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
    this.ctx.stroke();

    // Si sélectionné, afficher les points de contrôle
    if (isSelected) {
      const handleSize = 5 / this.viewport.scale;

      // Lignes de contrôle (pointillés)
      this.ctx.strokeStyle = "#888888";
      this.ctx.lineWidth = 1 / this.viewport.scale;
      this.ctx.setLineDash([3 / this.viewport.scale, 3 / this.viewport.scale]);

      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(cp1.x, cp1.y);
      this.ctx.moveTo(p2.x, p2.y);
      this.ctx.lineTo(cp2.x, cp2.y);
      this.ctx.stroke();

      this.ctx.setLineDash([]);

      // Points de contrôle (cercles)
      this.ctx.fillStyle = "#FF6600";
      this.ctx.beginPath();
      this.ctx.arc(cp1.x, cp1.y, handleSize, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(cp2.x, cp2.y, handleSize, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  /**
   * Dessine les poignées de manipulation pour les entités sélectionnées
   */
  drawHandles(sketch: Sketch, selectedEntities: Set<string>): void {
    const handleSize = 6 / this.viewport.scale;

    selectedEntities.forEach((entityId) => {
      // Vérifier si c'est un point
      const point = sketch.points.get(entityId);
      if (point) {
        // Vérifier si ce point appartient à une géométrie visible
        let pointVisible = false;
        sketch.geometries.forEach((geo) => {
          const layerId = geo.layerId || "trace";
          const layer = sketch.layers.get(layerId);
          if (layer?.visible === false) return;

          if (geo.type === "line") {
            const line = geo as Line;
            if (line.p1 === entityId || line.p2 === entityId) pointVisible = true;
          } else if (geo.type === "circle") {
            if ((geo as Circle).center === entityId) pointVisible = true;
          } else if (geo.type === "bezier") {
            const b = geo as Bezier;
            if (b.p1 === entityId || b.p2 === entityId || b.cp1 === entityId || b.cp2 === entityId) pointVisible = true;
          }
        });

        if (!pointVisible && sketch.geometries.size > 0) return;

        this.drawHandle(point.x, point.y, handleSize, "move");
        return;
      }

      // Vérifier si c'est une géométrie
      const geo = sketch.geometries.get(entityId);
      if (geo) {
        // Vérifier la visibilité du calque
        const layerId = geo.layerId || "trace";
        const layer = sketch.layers.get(layerId);
        if (layer?.visible === false) return;

        switch (geo.type) {
          case "line": {
            const line = geo as Line;
            const p1 = sketch.points.get(line.p1);
            const p2 = sketch.points.get(line.p2);
            if (p1 && p2) {
              // Poignées aux extrémités
              this.drawHandle(p1.x, p1.y, handleSize, "resize");
              this.drawHandle(p2.x, p2.y, handleSize, "resize");
              // Poignée au milieu pour déplacer
              const mid = midpoint(p1, p2);
              this.drawHandle(mid.x, mid.y, handleSize, "move");
            }
            break;
          }
          case "circle": {
            const circle = geo as Circle;
            const center = sketch.points.get(circle.center);
            if (center) {
              // Poignée au centre
              this.drawHandle(center.x, center.y, handleSize, "move");
              // Poignées sur les quadrants pour redimensionner
              this.drawHandle(center.x + circle.radius, center.y, handleSize, "resize");
              this.drawHandle(center.x - circle.radius, center.y, handleSize, "resize");
              this.drawHandle(center.x, center.y + circle.radius, handleSize, "resize");
              this.drawHandle(center.x, center.y - circle.radius, handleSize, "resize");
            }
            break;
          }
          case "bezier": {
            const bezier = geo as Bezier;
            const p1 = sketch.points.get(bezier.p1);
            const p2 = sketch.points.get(bezier.p2);
            const cp1 = sketch.points.get(bezier.cp1);
            const cp2 = sketch.points.get(bezier.cp2);
            if (p1 && p2 && cp1 && cp2) {
              this.drawHandle(p1.x, p1.y, handleSize, "resize");
              this.drawHandle(p2.x, p2.y, handleSize, "resize");
              this.drawHandle(cp1.x, cp1.y, handleSize, "control");
              this.drawHandle(cp2.x, cp2.y, handleSize, "control");
            }
            break;
          }
        }
      }
    });
  }

  private drawHandle(x: number, y: number, size: number, type: "move" | "resize" | "control" | "rotate"): void {
    // Style moderne avec des ronds et des couleurs douces
    this.ctx.lineWidth = 1.5 / this.viewport.scale;

    if (type === "control") {
      // Cercle orange pour points de contrôle Bézier
      this.ctx.fillStyle = "#FF9500";
      this.ctx.strokeStyle = "#CC7700";
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    } else if (type === "rotate") {
      // Cercle vert pour rotation
      this.ctx.fillStyle = "#34C759";
      this.ctx.strokeStyle = "#248A3D";
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    } else if (type === "move") {
      // Cercle bleu pour déplacement
      this.ctx.fillStyle = "#007AFF";
      this.ctx.strokeStyle = "#0055CC";
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    } else {
      // Cercle blanc avec bordure bleue pour resize (extrémités)
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.strokeStyle = "#007AFF";
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }
  }

  /**
   * Dessine les marqueurs de milieu de segment (petite croix X)
   */
  drawMidpointMarkers(sketch: Sketch, selectedEntities: Set<string>): void {
    // Ne rien dessiner si aucune sélection
    if (selectedEntities.size === 0) return;

    const markerSize = 4 / this.viewport.scale;

    sketch.geometries.forEach((geo, geoId) => {
      // Ne dessiner que pour les éléments sélectionnés
      if (!selectedEntities.has(geoId)) return;

      // Vérifier la visibilité du calque
      const layerId = geo.layerId || "trace";
      const layer = sketch.layers.get(layerId);
      if (layer?.visible === false) return;

      if (geo.type === "line") {
        const line = geo as Line;
        const p1 = sketch.points.get(line.p1);
        const p2 = sketch.points.get(line.p2);
        if (!p1 || !p2) return;

        const mid = midpoint(p1, p2);

        // Dessiner une petite croix X (diagonale)
        this.ctx.strokeStyle = "#10B981"; // Vert émeraude
        this.ctx.lineWidth = 1.5 / this.viewport.scale;

        this.ctx.beginPath();
        // Diagonale \
        this.ctx.moveTo(mid.x - markerSize, mid.y - markerSize);
        this.ctx.lineTo(mid.x + markerSize, mid.y + markerSize);
        // Diagonale /
        this.ctx.moveTo(mid.x + markerSize, mid.y - markerSize);
        this.ctx.lineTo(mid.x - markerSize, mid.y + markerSize);
        this.ctx.stroke();
      }
    });
  }

  /**
   * Dessine les marqueurs d'angle droit (petit carré dans le coin)
   */
  drawRightAngleMarkers(sketch: Sketch, selectedEntities: Set<string>): void {
    // Ne rien dessiner si aucune sélection
    if (selectedEntities.size === 0) return;

    const markerSize = 8 / this.viewport.scale;
    const lines: Array<{ p1: Point; p2: Point; geoId: string }> = [];

    // Collecter les lignes SELECTIONNÉES et visibles
    sketch.geometries.forEach((geo, geoId) => {
      // Ne considérer que les éléments sélectionnés
      if (!selectedEntities.has(geoId)) return;

      // Vérifier la visibilité du calque
      const layerId = geo.layerId || "trace";
      const layer = sketch.layers.get(layerId);
      if (layer?.visible === false) return;

      if (geo.type === "line") {
        const line = geo as Line;
        const p1 = sketch.points.get(line.p1);
        const p2 = sketch.points.get(line.p2);
        if (p1 && p2) {
          lines.push({ p1, p2, geoId });
        }
      }
    });

    // Chercher les angles droits entre segments qui partagent un point
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const l1 = lines[i];
        const l2 = lines[j];

        // Trouver le point commun
        let sharedPoint: Point | null = null;
        let other1: Point | null = null;
        let other2: Point | null = null;

        if (l1.p1.id === l2.p1.id) {
          sharedPoint = l1.p1;
          other1 = l1.p2;
          other2 = l2.p2;
        } else if (l1.p1.id === l2.p2.id) {
          sharedPoint = l1.p1;
          other1 = l1.p2;
          other2 = l2.p1;
        } else if (l1.p2.id === l2.p1.id) {
          sharedPoint = l1.p2;
          other1 = l1.p1;
          other2 = l2.p2;
        } else if (l1.p2.id === l2.p2.id) {
          sharedPoint = l1.p2;
          other1 = l1.p1;
          other2 = l2.p1;
        }

        if (sharedPoint && other1 && other2) {
          // Calculer l'angle entre les deux segments
          const ang1 = angle(sharedPoint, other1);
          const ang2 = angle(sharedPoint, other2);
          let angleDiff = Math.abs(ang1 - ang2);

          // Normaliser l'angle
          if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

          // Vérifier si c'est un angle droit (90° ± 2°)
          const tolerance = (2 * Math.PI) / 180; // 2 degrés
          if (Math.abs(angleDiff - Math.PI / 2) < tolerance) {
            // Dessiner le symbole d'angle droit
            this.ctx.strokeStyle = "#6366F1"; // Indigo
            this.ctx.lineWidth = 1.5 / this.viewport.scale;

            // Direction vers chaque segment
            const dir1 = { x: Math.cos(ang1), y: Math.sin(ang1) };
            const dir2 = { x: Math.cos(ang2), y: Math.sin(ang2) };

            // Points du carré d'angle droit
            const corner1 = {
              x: sharedPoint.x + dir1.x * markerSize,
              y: sharedPoint.y + dir1.y * markerSize,
            };
            const corner2 = {
              x: sharedPoint.x + dir2.x * markerSize,
              y: sharedPoint.y + dir2.y * markerSize,
            };
            const corner3 = {
              x: sharedPoint.x + dir1.x * markerSize + dir2.x * markerSize,
              y: sharedPoint.y + dir1.y * markerSize + dir2.y * markerSize,
            };

            this.ctx.beginPath();
            this.ctx.moveTo(corner1.x, corner1.y);
            this.ctx.lineTo(corner3.x, corner3.y);
            this.ctx.lineTo(corner2.x, corner2.y);
            this.ctx.stroke();
          }
        }
      }
    }
  }

  /**
   * Dessine les éléments de calibration (points et paires)
   */
  private drawCalibration(calibration: CalibrationData): void {
    const pointSize = 8 / this.viewport.scale;
    const fontSize = 14 / this.viewport.scale;

    // Dessiner les lignes de paires EN PREMIER (sous les points)
    calibration.pairs.forEach((pair) => {
      const p1 = calibration.points.get(pair.point1Id);
      const p2 = calibration.points.get(pair.point2Id);

      if (p1 && p2) {
        // Ligne pointillée
        this.ctx.strokeStyle = pair.color;
        this.ctx.lineWidth = 2 / this.viewport.scale;
        this.ctx.setLineDash([8 / this.viewport.scale, 4 / this.viewport.scale]);

        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();

        this.ctx.setLineDash([]);

        // Afficher la distance au milieu
        const mid = midpoint(p1, p2);
        const distPx = distance(p1, p2);
        const text = `${pair.distanceMm} mm`;

        // Fond pour le texte
        this.ctx.font = `bold ${fontSize}px Arial`;
        const textWidth = this.ctx.measureText(text).width;
        const padding = 4 / this.viewport.scale;

        this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        this.ctx.fillRect(
          mid.x - textWidth / 2 - padding,
          mid.y - fontSize / 2 - padding,
          textWidth + padding * 2,
          fontSize + padding * 2,
        );

        // Texte
        this.ctx.fillStyle = pair.color;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(text, mid.x, mid.y);
      }
    });

    // Dessiner les points de calibration PAR-DESSUS
    calibration.points.forEach((point) => {
      // Croix de visée fine
      this.ctx.strokeStyle = "#FF0000";
      this.ctx.lineWidth = 1.5 / this.viewport.scale;

      const crossSize = pointSize * 1.2;
      const innerGap = pointSize * 0.3;

      // Lignes horizontales (avec gap au centre)
      this.ctx.beginPath();
      this.ctx.moveTo(point.x - crossSize, point.y);
      this.ctx.lineTo(point.x - innerGap, point.y);
      this.ctx.moveTo(point.x + innerGap, point.y);
      this.ctx.lineTo(point.x + crossSize, point.y);

      // Lignes verticales (avec gap au centre)
      this.ctx.moveTo(point.x, point.y - crossSize);
      this.ctx.lineTo(point.x, point.y - innerGap);
      this.ctx.moveTo(point.x, point.y + innerGap);
      this.ctx.lineTo(point.x, point.y + crossSize);
      this.ctx.stroke();

      // Petit point central
      this.ctx.fillStyle = "#FF0000";
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 2 / this.viewport.scale, 0, Math.PI * 2);
      this.ctx.fill();

      // Label (numéro du point)
      this.ctx.font = `bold ${fontSize}px Arial`;
      this.ctx.fillStyle = "#FF0000";
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "bottom";
      this.ctx.fillText(point.label, point.x + crossSize + 2 / this.viewport.scale, point.y - 2 / this.viewport.scale);
    });
  }

  /**
   * Dessine la ligne de mesure avec les distances
   */
  private drawMeasure(
    start: { x: number; y: number },
    end: { x: number; y: number } | null,
    scale?: number,
    precomputedMm?: number,
  ): void {
    if (!end) return;

    const distPx = distance(start, end);
    const distMm = precomputedMm !== undefined ? precomputedMm : scale ? distPx * scale : distPx;

    // Ligne de mesure
    this.ctx.strokeStyle = "#00AA00";
    this.ctx.lineWidth = 1.5 / this.viewport.scale;
    this.ctx.setLineDash([6 / this.viewport.scale, 3 / this.viewport.scale]);

    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Croix de visée aux extrémités (plus précis que des cercles)
    const crossSize = 8 / this.viewport.scale;
    const innerCircle = 2 / this.viewport.scale;

    // Fonction pour dessiner une croix de visée
    const drawCrosshair = (x: number, y: number) => {
      this.ctx.strokeStyle = "#00AA00";
      this.ctx.lineWidth = 1.5 / this.viewport.scale;

      // Croix
      this.ctx.beginPath();
      this.ctx.moveTo(x - crossSize, y);
      this.ctx.lineTo(x - innerCircle, y);
      this.ctx.moveTo(x + innerCircle, y);
      this.ctx.lineTo(x + crossSize, y);
      this.ctx.moveTo(x, y - crossSize);
      this.ctx.lineTo(x, y - innerCircle);
      this.ctx.moveTo(x, y + innerCircle);
      this.ctx.lineTo(x, y + crossSize);
      this.ctx.stroke();

      // Petit cercle central
      this.ctx.beginPath();
      this.ctx.arc(x, y, innerCircle, 0, Math.PI * 2);
      this.ctx.stroke();
    };

    drawCrosshair(start.x, start.y);
    drawCrosshair(end.x, end.y);

    // Texte avec les distances
    const mid = midpoint(start, end);
    const fontSize = 14 / this.viewport.scale;
    const textPx = `${distPx.toFixed(1)} px`;
    const textMm = `${distMm.toFixed(1)} mm`;

    // Fond pour le texte
    this.ctx.font = `bold ${fontSize}px Arial`;
    const textWidth = Math.max(this.ctx.measureText(textPx).width, this.ctx.measureText(textMm).width);
    const padding = 4 / this.viewport.scale;
    const lineHeight = fontSize * 1.2;

    // Calculer l'angle de la ligne pour orienter le texte
    const ang = Math.atan2(end.y - start.y, end.x - start.x);
    const offset = 15 / this.viewport.scale;
    const textX = mid.x + Math.cos(ang + Math.PI / 2) * offset;
    const textY = mid.y + Math.sin(ang + Math.PI / 2) * offset;

    // Fond blanc
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    this.ctx.fillRect(
      textX - textWidth / 2 - padding,
      textY - lineHeight - padding,
      textWidth + padding * 2,
      lineHeight * 2 + padding * 2,
    );

    // Bordure
    this.ctx.strokeStyle = "#00AA00";
    this.ctx.lineWidth = 1 / this.viewport.scale;
    this.ctx.strokeRect(
      textX - textWidth / 2 - padding,
      textY - lineHeight - padding,
      textWidth + padding * 2,
      lineHeight * 2 + padding * 2,
    );

    // Texte
    this.ctx.fillStyle = "#00AA00";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(textPx, textX, textY - lineHeight / 2);
    this.ctx.fillStyle = "#006600";
    this.ctx.fillText(textMm, textX, textY + lineHeight / 2);
  }

  /**
   * Dessine la géométrie temporaire (pendant le dessin)
   */
  private drawTempGeometry(temp: any): void {
    this.ctx.strokeStyle = this.styles.selectedColor;
    this.ctx.lineWidth = this.styles.lineWidth / this.viewport.scale;
    this.ctx.setLineDash([5 / this.viewport.scale, 5 / this.viewport.scale]);

    if (temp.type === "line" && temp.points?.length >= 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(temp.points[0].x, temp.points[0].y);
      if (temp.points.length > 1) {
        this.ctx.lineTo(temp.points[1].x, temp.points[1].y);
      } else if (temp.cursor) {
        this.ctx.lineTo(temp.cursor.x, temp.cursor.y);
      }
      this.ctx.stroke();
    } else if (temp.type === "circle" && temp.center) {
      this.ctx.beginPath();
      this.ctx.arc(temp.center.x, temp.center.y, temp.radius || 0, 0, Math.PI * 2);
      this.ctx.stroke();
    } else if (temp.type === "rectangle" && temp.p1) {
      const p1 = temp.p1;
      const p2 = temp.cursor || temp.p2;
      if (p2) {
        this.ctx.beginPath();
        this.ctx.rect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        this.ctx.stroke();
      }
    } else if (temp.type === "bezier" && temp.points?.length >= 1) {
      // Aperçu Bézier
      if (temp.points.length === 1 && temp.cursor) {
        // Juste une ligne pour commencer
        this.ctx.beginPath();
        this.ctx.moveTo(temp.points[0].x, temp.points[0].y);
        this.ctx.lineTo(temp.cursor.x, temp.cursor.y);
        this.ctx.stroke();
      } else if (temp.points.length >= 2) {
        const p1 = temp.points[0];
        const p2 = temp.points[1];
        const cp1 = temp.points[2] || temp.cursor || midpoint(p1, p2);
        const cp2 = temp.points[3] || temp.cursor || midpoint(p1, p2);

        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
        this.ctx.stroke();

        // Lignes de contrôle
        this.ctx.strokeStyle = "#888888";
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(cp1.x, cp1.y);
        this.ctx.moveTo(p2.x, p2.y);
        this.ctx.lineTo(cp2.x, cp2.y);
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
    let symbol = "";

    switch (constraint.type) {
      case "horizontal":
        symbol = "─";
        pos = this.getConstraintPosition(constraint, sketch);
        break;
      case "vertical":
        symbol = "│";
        pos = this.getConstraintPosition(constraint, sketch);
        break;
      case "perpendicular":
        symbol = "⊥";
        pos = this.getConstraintPosition(constraint, sketch);
        break;
      case "parallel":
        symbol = "∥";
        pos = this.getConstraintPosition(constraint, sketch);
        break;
      case "coincident":
        symbol = "●";
        pos = this.getConstraintPosition(constraint, sketch);
        break;
      case "tangent":
        symbol = "○";
        pos = this.getConstraintPosition(constraint, sketch);
        break;
      case "equal":
        symbol = "=";
        pos = this.getConstraintPosition(constraint, sketch);
        break;
      case "fixed":
        symbol = "⚓";
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
      if (geo.type === "line") {
        const p1 = sketch.points.get((geo as Line).p1);
        const p2 = sketch.points.get((geo as Line).p2);
        if (p1 && p2) return midpoint(p1, p2);
      } else if (geo.type === "circle") {
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
      case "linear":
      case "horizontal":
      case "vertical":
        this.drawLinearDimension(dimension, sketch);
        break;
      case "radius":
      case "diameter":
        this.drawRadialDimension(dimension, sketch);
        break;
      case "angle":
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

    if (dimension.type === "horizontal") {
      dimLine1 = { x: p1.x, y: Math.min(p1.y, p2.y) - offset };
      dimLine2 = { x: p2.x, y: Math.min(p1.y, p2.y) - offset };
    } else if (dimension.type === "vertical") {
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
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "bottom";
    this.ctx.fillText(text, 0, -3 / this.viewport.scale);
    this.ctx.restore();
  }

  private drawRadialDimension(dimension: Dimension, sketch: Sketch): void {
    const geo = sketch.geometries.get(dimension.entities[0]) as Circle | undefined;
    if (!geo || geo.type !== "circle") return;

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
    if (dimension.type === "diameter") {
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
    const prefix = dimension.type === "diameter" ? "Ø" : "R";
    const text = `${prefix}${dimension.value.toFixed(2)}`;

    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "bottom";
    this.ctx.fillText(text, endPoint.x + 5 / this.viewport.scale, endPoint.y);
  }

  private drawAngularDimension(dimension: Dimension, sketch: Sketch): void {
    // TODO: Implement angular dimension
  }

  private drawArrow(from: { x: number; y: number }, to: { x: number; y: number }, size: number): void {
    const ang = angle(from, to);

    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(from.x + Math.cos(ang + Math.PI * 0.85) * size, from.y + Math.sin(ang + Math.PI * 0.85) * size);
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(from.x + Math.cos(ang - Math.PI * 0.85) * size, from.y + Math.sin(ang - Math.PI * 0.85) * size);
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

    // Juste le label du type de snap, pas de forme (le curseur fait déjà croix)
    this.ctx.fillStyle = this.styles.snapColor;
    this.ctx.font = "9px Arial";
    this.ctx.textAlign = "left";
    this.ctx.fillText(SnapSystem.getSnapName(snapPoint.type), screenPos.x + 12, screenPos.y + 3);
  }

  /**
   * Dessine la barre de statut
   */
  private drawStatusBar(sketch: Sketch): void {
    const barHeight = 24;
    const y = this.viewport.height - barHeight;

    // Fond
    this.ctx.fillStyle = "#F5F5F5";
    this.ctx.fillRect(0, y, this.viewport.width, barHeight);

    // Bordure
    this.ctx.strokeStyle = "#CCCCCC";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, y);
    this.ctx.lineTo(this.viewport.width, y);
    this.ctx.stroke();

    // Texte
    this.ctx.fillStyle = "#333333";
    this.ctx.font = "12px Arial";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "middle";

    // DOF
    let statusColor = "#00AA00";
    let statusText = "Fully constrained";

    if (sketch.status === "under-constrained") {
      statusColor = "#FF8800";
      statusText = `DOF: ${sketch.dof}`;
    } else if (sketch.status === "over-constrained") {
      statusColor = "#FF0000";
      statusText = "Over-constrained";
    } else if (sketch.status === "conflicting") {
      statusColor = "#FF0000";
      statusText = "Conflicting constraints";
    }

    this.ctx.fillStyle = statusColor;
    this.ctx.fillText(`● ${statusText}`, 10, y + barHeight / 2);

    // Zoom
    this.ctx.fillStyle = "#666666";
    this.ctx.textAlign = "right";
    this.ctx.fillText(`Zoom: ${Math.round(this.viewport.scale * 100)}%`, this.viewport.width - 10, y + barHeight / 2);

    // Scale
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      `Scale: 1px = ${(1 / sketch.scaleFactor).toFixed(2)}mm`,
      this.viewport.width / 2,
      y + barHeight / 2,
    );
  }
}
