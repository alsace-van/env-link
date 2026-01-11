// ============================================
// CAD RENDERER: Rendu Canvas professionnel
// Dessin de la géométrie, contraintes et cotations
// VERSION: 3.52 - Mode reveal (rideau avant/après)
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
  BackgroundImage,
  ImageMarkerLink,
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
      // Support multi-photos
      backgroundImages?: BackgroundImage[];
      selectedImageId?: string | null;
      markerLinks?: ImageMarkerLink[];
      selectedMarkerId?: string | null; // Marker sélectionné (format: "imageId:markerId")
      // Legacy single image (rétrocompatibilité)
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
        angle?: number; // Angle entre 2 segments en degrés
      }>;
      measureScale?: number;
      scaleFactor?: number; // px/mm pour convertir les coordonnées en mm sur les règles
      // Options de surbrillance des formes fermées
      highlightOpacity?: number; // 0-1, défaut 0.15
      hoveredShapeIndex?: number | null; // Index de la forme survolée
      mouseWorldPos?: { x: number; y: number } | null; // Position souris en coordonnées monde
      // Gizmo de transformation
      transformGizmo?: {
        active: boolean;
        mode: "idle" | "translateX" | "translateY" | "rotate";
        center: { x: number; y: number };
      } | null;
      selectionCenter?: { x: number; y: number } | null; // Centre de la sélection pour afficher le gizmo
      // Drag du gizmo (pour affichage temps réel)
      gizmoDrag?: {
        active: boolean;
        mode: "translateX" | "translateY" | "rotate";
        currentValue: number; // en mm ou degrés
        center: { x: number; y: number };
        initialPositions: Map<string, { x: number; y: number }>; // Positions initiales pour le fantôme
      } | null;
      // Entités sélectionnées pour le fantôme pendant le drag
      selectedEntitiesForGhost?: Set<string>;
      // Mode comparaison de branches
      comparisonMode?: boolean;
      comparisonStyle?: "overlay" | "reveal";
      comparisonBranches?: Array<{
        branchId: string;
        branchName: string;
        color: string;
        sketch: Sketch;
      }>;
      comparisonOpacity?: number; // 0-100
      activeBranchColor?: string;
      // Mode reveal (rideau)
      revealBranch?: {
        branchId: string;
        branchName: string;
        color: string;
        sketch: Sketch;
      } | null;
      revealPosition?: number; // 0-100
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
      // Multi-photos
      backgroundImages = [],
      selectedImageId = null,
      markerLinks = [],
      selectedMarkerId = null,
      // Legacy
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
      highlightOpacity = 0.12,
      hoveredShapeIndex = null,
      mouseWorldPos = null,
      transformGizmo = null,
      selectionCenter = null,
      gizmoDrag = null,
      selectedEntitiesForGhost = new Set<string>(),
      // Mode comparaison
      comparisonMode = false,
      comparisonStyle = "overlay",
      comparisonBranches = [],
      comparisonOpacity = 70,
      activeBranchColor = "#3B82F6",
      // Mode reveal
      revealBranch = null,
      revealPosition = 50,
    } = options;

    // Stocker scaleFactor pour drawRulers
    this.currentScaleFactor = scaleFactor;

    const rulerSize = 32;

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

    // 1. Background images (multi-photos)
    if (backgroundImages.length > 0) {
      this.drawBackgroundImages(backgroundImages, selectedImageId, markerLinks, selectedMarkerId);
    } else if (transformedImage) {
      // Legacy: image transformée unique
      this.drawTransformedImage(transformedImage, imageOpacity, imageScale);
    } else if (backgroundImage) {
      // Legacy: image simple unique
      this.drawBackgroundImage(backgroundImage, imageOpacity, imageScale);
    }

    // 1.5. Calibration legacy - DÉPLACÉ vers section 8.8 pour être par-dessus tout

    // 2. Grid
    if (showGrid) {
      this.drawGrid(sketch.scaleFactor);
    }

    // 2.5 Surbrillance des formes fermées (sans superposition, avec effet hover)
    this.drawClosedShapes(sketch, highlightOpacity, mouseWorldPos);

    // 2.6 Branches de comparaison (avant la branche active pour qu'elle soit au-dessus)
    if (comparisonMode && comparisonStyle === "overlay" && comparisonBranches.length > 0) {
      const opacity = comparisonOpacity / 100;
      comparisonBranches.forEach((branch) => {
        this.drawComparisonBranch(branch.sketch, branch.color, opacity, branch.branchName);
      });
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

    // 2.5 FANTÔME: Dessiner les positions initiales en pointillé pendant le drag du gizmo
    if (gizmoDrag && gizmoDrag.active && gizmoDrag.initialPositions && selectedEntitiesForGhost.size > 0) {
      this.drawGhostGeometries(sketch, selectedEntitiesForGhost, gizmoDrag.initialPositions);
    }

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
      this.drawTempGeometry(tempGeometry, sketch);
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

    // 7.5. Mode reveal (rideau avant/après)
    if (comparisonMode && comparisonStyle === "reveal" && revealBranch) {
      this.ctx.save();

      // Calculer la position X du clipping en coordonnées écran
      // revealPosition est en pourcentage de la largeur du canvas (après la règle)
      const canvasWidth = this.viewport.width - rulerSize;
      const clipX = rulerSize + (canvasWidth * revealPosition) / 100;

      // Reset la transformation pour le clipping en coordonnées écran
      this.ctx.restore(); // Restaurer avant le clip
      this.ctx.save();

      // Clip rectangle sur la partie droite du canvas
      this.ctx.beginPath();
      this.ctx.rect(clipX, rulerSize, this.viewport.width - clipX, this.viewport.height - rulerSize);
      this.ctx.clip();

      // Réappliquer la transformation du viewport
      this.ctx.translate(this.viewport.offsetX, this.viewport.offsetY);
      this.ctx.scale(this.viewport.scale, this.viewport.scale);

      // Dessiner un fond pour couvrir la branche active à droite
      const worldClipX = (clipX - this.viewport.offsetX) / this.viewport.scale;
      const worldRight = (this.viewport.width - this.viewport.offsetX) / this.viewport.scale;
      const worldTop = (rulerSize - this.viewport.offsetY) / this.viewport.scale;
      const worldBottom = (this.viewport.height - this.viewport.offsetY) / this.viewport.scale;

      this.ctx.fillStyle = this.styles.backgroundColor;
      this.ctx.fillRect(worldClipX, worldTop, worldRight - worldClipX, worldBottom - worldTop);

      // Redessiner la grille dans la zone reveal
      if (showGrid) {
        this.drawGrid(sketch.scaleFactor);
      }

      // Dessiner les géométries de la branche reveal
      this.drawRevealBranch(revealBranch.sketch, revealBranch.color);

      this.ctx.restore();

      // Réappliquer la transformation du viewport pour le reste du rendu
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(rulerSize, rulerSize, this.viewport.width - rulerSize, this.viewport.height - rulerSize);
      this.ctx.clip();
      this.ctx.translate(this.viewport.offsetX, this.viewport.offsetY);
      this.ctx.scale(this.viewport.scale, this.viewport.scale);
    }

    // 8. Poignées des entités sélectionnées
    if (selectedEntities.size > 0) {
      this.drawHandles(sketch, selectedEntities);
    }

    // 8.4. Gizmo de transformation (flèches X, Y, rotation)
    if (selectionCenter && selectedEntities.size > 0) {
      this.drawTransformGizmo(selectionCenter, transformGizmo, gizmoDrag);
    }

    // 8.5. Mesures persistantes
    if (measurements.length > 0) {
      measurements.forEach((m) => {
        this.drawMeasure(m.start, m.end, measureScale, m.mm, m.angle);
      });
    }

    // 8.6. Mesure en cours (preview)
    if (measureData?.start) {
      this.drawMeasure(measureData.start, measureData.end, measureData.scale);
    }

    // 8.7. Points de calibration (TOUJOURS par-dessus tout)
    // En mode multi-photos: utiliser les points de l'image sélectionnée
    // En mode legacy (sans multi-photos): utiliser calibrationData globale
    if (showCalibration) {
      if (backgroundImages.length > 0 && selectedImageId) {
        // Mode multi-photos: points stockés dans selectedImage.calibrationData
        const selectedImage = backgroundImages.find((img) => img.id === selectedImageId);
        if (selectedImage?.calibrationData && selectedImage.calibrationData.points.size > 0) {
          this.drawImageCalibrationPoints(backgroundImages, selectedImageId);
        }
      } else if (calibrationData && calibrationData.points.size > 0) {
        // Mode legacy sans multi-photos: utiliser calibrationData globale
        this.drawCalibration(calibrationData);
      }
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
   * Dessine plusieurs images de fond (multi-photos)
   * Les images sont triées par ordre et dessinées à leurs positions respectives
   */
  private drawBackgroundImages(
    images: BackgroundImage[],
    selectedImageId: string | null,
    markerLinks: ImageMarkerLink[],
    selectedMarkerId: string | null,
  ): void {
    // Trier par ordre d'affichage (0 = fond, plus élevé = devant)
    const sortedImages = [...images].filter((img) => img.visible).sort((a, b) => a.order - b.order);

    for (const bgImage of sortedImages) {
      this.ctx.save();

      // Positionner l'image à sa position (x, y)
      this.ctx.translate(bgImage.x, bgImage.y);

      // Appliquer l'opacité
      this.ctx.globalAlpha = bgImage.opacity;

      // Utiliser l'image ajustée si disponible, puis transformée, sinon l'originale
      const imageToDraw = bgImage.adjustedCanvas || bgImage.transformedCanvas || bgImage.image;
      const width = imageToDraw instanceof HTMLCanvasElement ? imageToDraw.width : imageToDraw.width;
      const height = imageToDraw instanceof HTMLCanvasElement ? imageToDraw.height : imageToDraw.height;

      // Appliquer l'échelle
      const scaledWidth = width * bgImage.scale;
      const scaledHeight = height * bgImage.scale;

      // Dessiner l'image centrée sur sa position
      this.ctx.drawImage(imageToDraw, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);

      // Dessiner le cadre de sélection si l'image est sélectionnée
      if (selectedImageId === bgImage.id) {
        this.ctx.globalAlpha = 1;
        this.ctx.strokeStyle = "#0066FF";
        this.ctx.lineWidth = 2 / this.viewport.scale;
        this.ctx.setLineDash([5 / this.viewport.scale, 5 / this.viewport.scale]);
        this.ctx.strokeRect(-scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
        this.ctx.setLineDash([]);

        // Dessiner les poignées de coin pour indiquer qu'on peut déplacer
        const handleSize = 8 / this.viewport.scale;
        this.ctx.fillStyle = "#0066FF";
        // Coin supérieur gauche
        this.ctx.fillRect(
          -scaledWidth / 2 - handleSize / 2,
          -scaledHeight / 2 - handleSize / 2,
          handleSize,
          handleSize,
        );
        // Coin supérieur droit
        this.ctx.fillRect(scaledWidth / 2 - handleSize / 2, -scaledHeight / 2 - handleSize / 2, handleSize, handleSize);
        // Coin inférieur gauche
        this.ctx.fillRect(-scaledWidth / 2 - handleSize / 2, scaledHeight / 2 - handleSize / 2, handleSize, handleSize);
        // Coin inférieur droit
        this.ctx.fillRect(scaledWidth / 2 - handleSize / 2, scaledHeight / 2 - handleSize / 2, handleSize, handleSize);
      }

      // Afficher le nom de l'image si elle est verrouillée
      if (bgImage.locked) {
        this.ctx.globalAlpha = 0.7;
        this.ctx.fillStyle = "#666666";
        const fontSize = 12 / this.viewport.scale;
        this.ctx.font = `${fontSize}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.fillText("🔒", 0, -scaledHeight / 2 - fontSize);
      }

      // Dessiner les marqueurs de l'image
      this.ctx.globalAlpha = 1;
      for (const marker of bgImage.markers) {
        const markerSize = 12 / this.viewport.scale;
        const x = marker.relativeX;
        const y = marker.relativeY;

        // Vérifier si ce marker est sélectionné
        const isSelected = selectedMarkerId === `${bgImage.id}:${marker.id}`;

        // Halo de sélection si sélectionné
        if (isSelected) {
          this.ctx.beginPath();
          this.ctx.arc(x, y, markerSize + 6 / this.viewport.scale, 0, Math.PI * 2);
          this.ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
          this.ctx.fill();
          this.ctx.strokeStyle = "#3B82F6";
          this.ctx.lineWidth = 2 / this.viewport.scale;
          this.ctx.stroke();
        }

        // Croix blanche (underlay pour contraste)
        this.ctx.strokeStyle = "#FFFFFF";
        this.ctx.lineWidth = 4 / this.viewport.scale;
        this.ctx.lineCap = "round";

        // Ligne horizontale
        this.ctx.beginPath();
        this.ctx.moveTo(x - markerSize, y);
        this.ctx.lineTo(x + markerSize, y);
        this.ctx.stroke();

        // Ligne verticale
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - markerSize);
        this.ctx.lineTo(x, y + markerSize);
        this.ctx.stroke();

        // Croix colorée (overlay)
        this.ctx.strokeStyle = marker.color;
        this.ctx.lineWidth = 2 / this.viewport.scale;

        // Ligne horizontale
        this.ctx.beginPath();
        this.ctx.moveTo(x - markerSize, y);
        this.ctx.lineTo(x + markerSize, y);
        this.ctx.stroke();

        // Ligne verticale
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - markerSize);
        this.ctx.lineTo(x, y + markerSize);
        this.ctx.stroke();

        // Point central
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3 / this.viewport.scale, 0, Math.PI * 2);
        this.ctx.fillStyle = marker.color;
        this.ctx.fill();
        this.ctx.strokeStyle = "#FFFFFF";
        this.ctx.lineWidth = 1.5 / this.viewport.scale;
        this.ctx.stroke();

        // Label (décalé vers la droite)
        const fontSize = 11 / this.viewport.scale;
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "middle";

        // Fond du label
        const labelX = x + markerSize + 4 / this.viewport.scale;
        const labelWidth = this.ctx.measureText(marker.label).width + 6 / this.viewport.scale;
        const labelHeight = fontSize + 4 / this.viewport.scale;

        this.ctx.fillStyle = marker.color;
        this.ctx.beginPath();
        this.ctx.roundRect(
          labelX - 3 / this.viewport.scale,
          y - labelHeight / 2,
          labelWidth,
          labelHeight,
          3 / this.viewport.scale,
        );
        this.ctx.fill();

        // Texte du label
        this.ctx.fillStyle = "#FFFFFF";
        this.ctx.fillText(marker.label, labelX, y);
      }

      this.ctx.restore();
    }

    // Dessiner les liens entre marqueurs (par-dessus toutes les images)
    for (const link of markerLinks) {
      // Trouver les deux images et marqueurs
      const img1 = images.find((img) => img.id === link.marker1.imageId);
      const img2 = images.find((img) => img.id === link.marker2.imageId);
      if (!img1 || !img2) continue;

      const marker1 = img1.markers.find((m) => m.id === link.marker1.markerId);
      const marker2 = img2.markers.find((m) => m.id === link.marker2.markerId);
      if (!marker1 || !marker2) continue;

      // Calculer les positions mondiales des marqueurs
      const x1 = img1.x + marker1.relativeX;
      const y1 = img1.y + marker1.relativeY;
      const x2 = img2.x + marker2.relativeX;
      const y2 = img2.y + marker2.relativeY;

      this.ctx.save();

      // Dessiner la ligne de liaison
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.strokeStyle = link.color;
      this.ctx.lineWidth = 2 / this.viewport.scale;
      this.ctx.setLineDash([8 / this.viewport.scale, 4 / this.viewport.scale]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Dessiner le label de distance au milieu
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const labelText = `${link.distanceMm} mm`;

      const fontSize = 14 / this.viewport.scale;
      this.ctx.font = `bold ${fontSize}px Arial`;
      const textWidth = this.ctx.measureText(labelText).width;
      const padding = 4 / this.viewport.scale;

      // Fond du label
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      this.ctx.fillRect(
        midX - textWidth / 2 - padding,
        midY - fontSize / 2 - padding,
        textWidth + padding * 2,
        fontSize + padding * 2,
      );

      // Bordure du label
      this.ctx.strokeStyle = link.color;
      this.ctx.lineWidth = 1 / this.viewport.scale;
      this.ctx.strokeRect(
        midX - textWidth / 2 - padding,
        midY - fontSize / 2 - padding,
        textWidth + padding * 2,
        fontSize + padding * 2,
      );

      // Texte
      this.ctx.fillStyle = link.color;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(labelText, midX, midY);

      this.ctx.restore();
    }
  }

  /**
   * Dessine les points de calibration de l'image sélectionnée
   * Appelé en dernier pour être par-dessus tout
   * Style croix de visée précis pour calibration
   */
  private drawImageCalibrationPoints(images: BackgroundImage[], selectedImageId: string): void {
    const selectedImage = images.find((img) => img.id === selectedImageId);
    if (!selectedImage?.calibrationData) return;

    const calibData = selectedImage.calibrationData;

    // Taille adaptative avec limite min/max pour rester visible mais pas énorme
    const baseSize = 6;
    const minSize = 4;
    const maxSize = 12;
    const pointSize = Math.min(maxSize, Math.max(minSize, baseSize / this.viewport.scale));
    const fontSize = Math.min(14, Math.max(10, 10 / this.viewport.scale));

    // Dessiner les paires de calibration (lignes)
    calibData.pairs.forEach((pair) => {
      const p1 = calibData.points.get(pair.point1Id);
      const p2 = calibData.points.get(pair.point2Id);
      if (!p1 || !p2) return;

      // Convertir en coordonnées monde
      const x1 = selectedImage.x + p1.x;
      const y1 = selectedImage.y + p1.y;
      const x2 = selectedImage.x + p2.x;
      const y2 = selectedImage.y + p2.y;

      this.ctx.save();

      // Ligne de fond blanche (pour contraste)
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.strokeStyle = "#FFFFFF";
      this.ctx.lineWidth = 3 / this.viewport.scale;
      this.ctx.stroke();

      // Ligne pointillée colorée par-dessus
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.strokeStyle = pair.color;
      this.ctx.lineWidth = 1.5 / this.viewport.scale;
      this.ctx.setLineDash([6 / this.viewport.scale, 3 / this.viewport.scale]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Label de distance
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      this.ctx.font = `bold ${fontSize}px Arial`;
      const labelText = `${pair.distanceMm} mm`;
      const textWidth = this.ctx.measureText(labelText).width;
      const padding = 3 / this.viewport.scale;

      this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      this.ctx.fillRect(
        midX - textWidth / 2 - padding,
        midY - fontSize / 2 - padding,
        textWidth + padding * 2,
        fontSize + padding * 2,
      );
      this.ctx.strokeStyle = pair.color;
      this.ctx.lineWidth = 1 / this.viewport.scale;
      this.ctx.strokeRect(
        midX - textWidth / 2 - padding,
        midY - fontSize / 2 - padding,
        textWidth + padding * 2,
        fontSize + padding * 2,
      );
      this.ctx.fillStyle = pair.color;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(labelText, midX, midY);
      this.ctx.restore();
    });

    // Dessiner les points de calibration - STYLE CROIX DE VISÉE PRÉCIS
    calibData.points.forEach((point) => {
      const worldX = selectedImage.x + point.x;
      const worldY = selectedImage.y + point.y;
      const crossSize = pointSize * 1.5;
      const innerGap = pointSize * 0.4;

      this.ctx.save();

      // 1. Fond blanc pour les lignes de la croix (contraste)
      this.ctx.strokeStyle = "#FFFFFF";
      this.ctx.lineWidth = 3 / this.viewport.scale;
      this.ctx.beginPath();
      // Horizontal
      this.ctx.moveTo(worldX - crossSize, worldY);
      this.ctx.lineTo(worldX - innerGap, worldY);
      this.ctx.moveTo(worldX + innerGap, worldY);
      this.ctx.lineTo(worldX + crossSize, worldY);
      // Vertical
      this.ctx.moveTo(worldX, worldY - crossSize);
      this.ctx.lineTo(worldX, worldY - innerGap);
      this.ctx.moveTo(worldX, worldY + innerGap);
      this.ctx.lineTo(worldX, worldY + crossSize);
      this.ctx.stroke();

      // 2. Croix rouge par-dessus
      this.ctx.strokeStyle = "#FF0000";
      this.ctx.lineWidth = 1.5 / this.viewport.scale;
      this.ctx.beginPath();
      // Horizontal avec gap au centre
      this.ctx.moveTo(worldX - crossSize, worldY);
      this.ctx.lineTo(worldX - innerGap, worldY);
      this.ctx.moveTo(worldX + innerGap, worldY);
      this.ctx.lineTo(worldX + crossSize, worldY);
      // Vertical avec gap au centre
      this.ctx.moveTo(worldX, worldY - crossSize);
      this.ctx.lineTo(worldX, worldY - innerGap);
      this.ctx.moveTo(worldX, worldY + innerGap);
      this.ctx.lineTo(worldX, worldY + crossSize);
      this.ctx.stroke();

      // 3. Petit point central précis
      this.ctx.fillStyle = "#FF0000";
      this.ctx.beginPath();
      this.ctx.arc(worldX, worldY, 2 / this.viewport.scale, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = "#FFFFFF";
      this.ctx.lineWidth = 1 / this.viewport.scale;
      this.ctx.stroke();

      // 4. Label compact
      const labelText = point.label;
      this.ctx.font = `bold ${fontSize}px Arial`;
      const labelWidth = this.ctx.measureText(labelText).width;
      const labelPadding = 2 / this.viewport.scale;
      const labelX = worldX + crossSize + 3 / this.viewport.scale;
      const labelY = worldY;

      // Fond du label
      this.ctx.fillStyle = "rgba(255, 0, 0, 0.85)";
      this.ctx.fillRect(
        labelX - labelPadding,
        labelY - fontSize / 2 - labelPadding,
        labelWidth + labelPadding * 2,
        fontSize + labelPadding * 2,
      );

      // Texte du label
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(labelText, labelX, labelY);

      this.ctx.restore();
    });
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
    const rulerSize = 32;
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

    const rulerSize = 32;
    const tickSmall = 5;
    const tickMedium = 9;
    const tickLarge = 13;

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
        ctx.font = "11px Arial, sans-serif";
        ctx.fillStyle = "#333";
        ctx.fillText(`${xMm}`, screenX, rulerSize - tickLarge - 2);
      } else if (isSemiMajor && spacingMm <= 20) {
        ctx.font = "9px Arial, sans-serif";
        ctx.fillStyle = "#666";
        ctx.fillText(`${xMm}`, screenX, rulerSize - tickMedium - 1);
      } else if (isMinorWithLabel) {
        ctx.font = "8px Arial, sans-serif";
        ctx.fillStyle = "#999";
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

    // Pour la règle verticale, on tourne le texte à 90° pour éviter le rognage
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

      // Texte tourné à 90° pour les valeurs
      ctx.save();
      ctx.translate(rulerSize - tickW - 3, screenY);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      if (isMajor) {
        ctx.font = "11px Arial, sans-serif";
        ctx.fillStyle = "#333";
        ctx.fillText(`${yMm}`, 0, 0);
      } else if (isSemiMajor && spacingMm <= 20) {
        ctx.font = "9px Arial, sans-serif";
        ctx.fillStyle = "#666";
        ctx.fillText(`${yMm}`, 0, 0);
      } else if (isMinorWithLabel) {
        ctx.font = "8px Arial, sans-serif";
        ctx.fillStyle = "#999";
        ctx.fillText(`${yMm}`, 0, 0);
      }
      ctx.restore();
    }

    // ===== UNITÉ DANS LE COIN =====
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 10px Arial, sans-serif";
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

    // Marqueur de centre (croix + petit cercle) - toujours visible
    this.drawCenterMarker(center.x, center.y);
  }

  private drawArc(arc: Arc, sketch: Sketch): void {
    const center = sketch.points.get(arc.center);
    const startPt = sketch.points.get(arc.startPoint);
    const endPt = sketch.points.get(arc.endPoint);
    if (!center || !startPt || !endPt) return;

    const startAngle = angle(center, startPt);
    let endAngle = angle(center, endPt);

    // Utiliser la direction stockée si elle est définie
    let counterClockwise: boolean;
    if (arc.counterClockwise !== undefined) {
      counterClockwise = arc.counterClockwise;
    } else {
      // Comportement par défaut : dessiner le petit arc (< 180°)
      let deltaAngle = endAngle - startAngle;
      while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
      while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
      counterClockwise = deltaAngle < 0;
    }

    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, arc.radius, startAngle, endAngle, counterClockwise);
    this.ctx.stroke();

    // Marqueur de centre pour les arcs (permet de snapper sur le centre)
    this.drawCenterMarker(center.x, center.y);
  }

  /**
   * Dessine un marqueur de centre (croix + petit cercle) pour les cercles et arcs
   * Permet de visualiser le point de snap "center"
   */
  private drawCenterMarker(x: number, y: number): void {
    const r = 5 / this.viewport.scale; // Taille de la croix
    const dotR = 2 / this.viewport.scale; // Rayon du petit cercle

    this.ctx.save();
    this.ctx.strokeStyle = "#6B7280"; // Gris
    this.ctx.lineWidth = 1 / this.viewport.scale;
    this.ctx.setLineDash([]);

    // Croix
    this.ctx.beginPath();
    this.ctx.moveTo(x - r, y);
    this.ctx.lineTo(x + r, y);
    this.ctx.moveTo(x, y - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.stroke();

    // Petit cercle au centre
    this.ctx.beginPath();
    this.ctx.arc(x, y, dotR, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
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
              // Poignée au centre pour déplacer
              this.drawHandle(center.x, center.y, handleSize, "move");
              // Une seule poignée sur le bord droit pour redimensionner
              this.drawHandle(center.x + circle.radius, center.y, handleSize, "resize");
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
   * Style croix de visée précis pour calibration
   */
  private drawCalibration(calibration: CalibrationData): void {
    // Taille adaptative avec limite min/max
    const baseSize = 6;
    const minSize = 4;
    const maxSize = 12;
    const pointSize = Math.min(maxSize, Math.max(minSize, baseSize / this.viewport.scale));
    const fontSize = Math.min(14, Math.max(10, 10 / this.viewport.scale));

    // Dessiner les lignes de paires EN PREMIER (sous les points)
    calibration.pairs.forEach((pair) => {
      const p1 = calibration.points.get(pair.point1Id);
      const p2 = calibration.points.get(pair.point2Id);

      if (p1 && p2) {
        // Ligne de fond blanche (pour contraste)
        this.ctx.strokeStyle = "#FFFFFF";
        this.ctx.lineWidth = 3 / this.viewport.scale;
        this.ctx.setLineDash([]);
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();

        // Ligne pointillée colorée par-dessus
        this.ctx.strokeStyle = pair.color;
        this.ctx.lineWidth = 1.5 / this.viewport.scale;
        this.ctx.setLineDash([6 / this.viewport.scale, 3 / this.viewport.scale]);

        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();

        this.ctx.setLineDash([]);

        // Afficher la distance au milieu
        const mid = midpoint(p1, p2);
        const text = `${pair.distanceMm} mm`;

        // Fond pour le texte
        this.ctx.font = `bold ${fontSize}px Arial`;
        const textWidth = this.ctx.measureText(text).width;
        const padding = 3 / this.viewport.scale;

        this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        this.ctx.fillRect(
          mid.x - textWidth / 2 - padding,
          mid.y - fontSize / 2 - padding,
          textWidth + padding * 2,
          fontSize + padding * 2,
        );

        // Bordure
        this.ctx.strokeStyle = pair.color;
        this.ctx.lineWidth = 1 / this.viewport.scale;
        this.ctx.strokeRect(
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

    // Dessiner les points de calibration - STYLE CROIX DE VISÉE PRÉCIS
    calibration.points.forEach((point) => {
      const crossSize = pointSize * 1.5;
      const innerGap = pointSize * 0.4;

      // 1. Fond blanc pour les lignes de la croix (contraste)
      this.ctx.strokeStyle = "#FFFFFF";
      this.ctx.lineWidth = 3 / this.viewport.scale;
      this.ctx.beginPath();
      // Horizontal
      this.ctx.moveTo(point.x - crossSize, point.y);
      this.ctx.lineTo(point.x - innerGap, point.y);
      this.ctx.moveTo(point.x + innerGap, point.y);
      this.ctx.lineTo(point.x + crossSize, point.y);
      // Vertical
      this.ctx.moveTo(point.x, point.y - crossSize);
      this.ctx.lineTo(point.x, point.y - innerGap);
      this.ctx.moveTo(point.x, point.y + innerGap);
      this.ctx.lineTo(point.x, point.y + crossSize);
      this.ctx.stroke();

      // 2. Croix rouge par-dessus
      this.ctx.strokeStyle = "#FF0000";
      this.ctx.lineWidth = 1.5 / this.viewport.scale;
      this.ctx.beginPath();
      this.ctx.moveTo(point.x - crossSize, point.y);
      this.ctx.lineTo(point.x - innerGap, point.y);
      this.ctx.moveTo(point.x + innerGap, point.y);
      this.ctx.lineTo(point.x + crossSize, point.y);
      this.ctx.moveTo(point.x, point.y - crossSize);
      this.ctx.lineTo(point.x, point.y - innerGap);
      this.ctx.moveTo(point.x, point.y + innerGap);
      this.ctx.lineTo(point.x, point.y + crossSize);
      this.ctx.stroke();

      // 3. Petit point central précis
      this.ctx.fillStyle = "#FF0000";
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 2 / this.viewport.scale, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = "#FFFFFF";
      this.ctx.lineWidth = 1 / this.viewport.scale;
      this.ctx.stroke();

      // 4. Label compact
      const labelText = point.label;
      this.ctx.font = `bold ${fontSize}px Arial`;
      const labelWidth = this.ctx.measureText(labelText).width;
      const labelPadding = 2 / this.viewport.scale;
      const labelX = point.x + crossSize + 3 / this.viewport.scale;
      const labelY = point.y;

      // Fond du label
      this.ctx.fillStyle = "rgba(255, 0, 0, 0.85)";
      this.ctx.fillRect(
        labelX - labelPadding,
        labelY - fontSize / 2 - labelPadding,
        labelWidth + labelPadding * 2,
        fontSize + labelPadding * 2,
      );

      // Texte du label
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(labelText, labelX, labelY);
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
    angleDeg?: number, // Angle entre 2 segments en degrés
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

    // Texte avec les distances (et angle si disponible)
    const mid = midpoint(start, end);
    const fontSize = 14 / this.viewport.scale;
    const textPx = `${distPx.toFixed(1)} px`;
    const textMm = `${distMm.toFixed(1)} mm`;
    const textAngle = angleDeg !== undefined ? `∠ ${angleDeg.toFixed(1)}°` : null;

    // Fond pour le texte
    this.ctx.font = `bold ${fontSize}px Arial`;
    const textWidthPx = this.ctx.measureText(textPx).width;
    const textWidthMm = this.ctx.measureText(textMm).width;
    const textWidthAngle = textAngle ? this.ctx.measureText(textAngle).width : 0;
    const textWidth = Math.max(textWidthPx, textWidthMm, textWidthAngle);
    const padding = 4 / this.viewport.scale;
    const lineHeight = fontSize * 1.2;
    const numLines = textAngle ? 3 : 2;

    // Calculer l'angle de la ligne pour orienter le texte
    const ang = Math.atan2(end.y - start.y, end.x - start.x);
    const offset = 15 / this.viewport.scale;
    const textX = mid.x + Math.cos(ang + Math.PI / 2) * offset;
    const textY = mid.y + Math.sin(ang + Math.PI / 2) * offset;

    // Fond blanc
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    this.ctx.fillRect(
      textX - textWidth / 2 - padding,
      textY - lineHeight * (numLines / 2) - padding,
      textWidth + padding * 2,
      lineHeight * numLines + padding * 2,
    );

    // Bordure
    this.ctx.strokeStyle = "#00AA00";
    this.ctx.lineWidth = 1 / this.viewport.scale;
    this.ctx.strokeRect(
      textX - textWidth / 2 - padding,
      textY - lineHeight * (numLines / 2) - padding,
      textWidth + padding * 2,
      lineHeight * numLines + padding * 2,
    );

    // Texte
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    if (textAngle) {
      // 3 lignes: px, mm, angle
      this.ctx.fillStyle = "#00AA00";
      this.ctx.fillText(textPx, textX, textY - lineHeight);
      this.ctx.fillStyle = "#006600";
      this.ctx.fillText(textMm, textX, textY);
      this.ctx.fillStyle = "#FF6600"; // Orange pour l'angle
      this.ctx.fillText(textAngle, textX, textY + lineHeight);
    } else {
      // 2 lignes: px, mm
      this.ctx.fillStyle = "#00AA00";
      this.ctx.fillText(textPx, textX, textY - lineHeight / 2);
      this.ctx.fillStyle = "#006600";
      this.ctx.fillText(textMm, textX, textY + lineHeight / 2);
    }
  }

  /**
   * Dessine la géométrie temporaire (pendant le dessin)
   */
  private drawTempGeometry(temp: any, sketch: Sketch): void {
    this.ctx.strokeStyle = this.styles.selectedColor;
    this.ctx.lineWidth = this.styles.lineWidth / this.viewport.scale;
    this.ctx.setLineDash([5 / this.viewport.scale, 5 / this.viewport.scale]);

    const scaleFactor = this.currentScaleFactor || 1;
    const fontSize = 12 / this.viewport.scale;

    if (temp.type === "line" && temp.points?.length >= 1) {
      const p1 = temp.points[0];
      const p2 = temp.points.length > 1 ? temp.points[1] : temp.cursor;

      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      if (p2) {
        this.ctx.lineTo(p2.x, p2.y);
      }
      this.ctx.stroke();

      // Afficher la longueur en mm
      if (p2) {
        const lengthPx = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        const lengthMm = lengthPx / scaleFactor;
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        // Offset perpendiculaire pour ne pas chevaucher la ligne
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const offsetDist = 15 / this.viewport.scale;
        const offsetX = len > 0 ? (-dy / len) * offsetDist : 0;
        const offsetY = len > 0 ? (dx / len) * offsetDist : offsetDist;

        this.ctx.save();
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = "#3B82F6";
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        // Fond blanc pour lisibilité
        const text = `${lengthMm.toFixed(1)} mm`;
        const textWidth = this.ctx.measureText(text).width;
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        this.ctx.fillRect(
          midX + offsetX - textWidth / 2 - 3 / this.viewport.scale,
          midY + offsetY - fontSize / 2 - 2 / this.viewport.scale,
          textWidth + 6 / this.viewport.scale,
          fontSize + 4 / this.viewport.scale,
        );

        this.ctx.fillStyle = "#3B82F6";
        this.ctx.fillText(text, midX + offsetX, midY + offsetY);
        this.ctx.restore();

        // Calculer l'angle si le point de départ est connecté à un segment existant
        this.drawAngleWithPreviousSegment(p1, p2, sketch, scaleFactor, fontSize);
      }
    } else if (temp.type === "circle" && temp.center) {
      const center = temp.center;
      const radius = temp.radius || 0;

      this.ctx.beginPath();
      this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      this.ctx.stroke();

      // Afficher le rayon en mm
      if (radius > 0) {
        const radiusMm = radius / scaleFactor;

        this.ctx.save();
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = "#3B82F6";
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "middle";

        const text = `R ${radiusMm.toFixed(1)} mm`;
        const textX = center.x + 10 / this.viewport.scale;
        const textY = center.y;
        const textWidth = this.ctx.measureText(text).width;

        // Fond blanc
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        this.ctx.fillRect(
          textX - 3 / this.viewport.scale,
          textY - fontSize / 2 - 2 / this.viewport.scale,
          textWidth + 6 / this.viewport.scale,
          fontSize + 4 / this.viewport.scale,
        );

        this.ctx.fillStyle = "#3B82F6";
        this.ctx.fillText(text, textX, textY);
        this.ctx.restore();
      }
    } else if (temp.type === "rectangle" && temp.p1) {
      const p1 = temp.p1;
      const p2 = temp.cursor || temp.p2;
      const isCenter = temp.mode === "center";

      if (p2) {
        let rectX: number, rectY: number, rectW: number, rectH: number;
        let widthPx: number, heightPx: number;

        if (isCenter) {
          // Mode centre: p1 est le centre
          const halfW = Math.abs(p2.x - p1.x);
          const halfH = Math.abs(p2.y - p1.y);
          widthPx = halfW * 2;
          heightPx = halfH * 2;
          rectX = p1.x - halfW;
          rectY = p1.y - halfH;
          rectW = widthPx;
          rectH = heightPx;

          // Dessiner une croix au centre
          this.ctx.save();
          this.ctx.strokeStyle = "#10B981"; // Vert
          this.ctx.lineWidth = 1.5 / this.viewport.scale;
          this.ctx.setLineDash([]);
          const crossSize = 8 / this.viewport.scale;
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x - crossSize, p1.y);
          this.ctx.lineTo(p1.x + crossSize, p1.y);
          this.ctx.moveTo(p1.x, p1.y - crossSize);
          this.ctx.lineTo(p1.x, p1.y + crossSize);
          this.ctx.stroke();
          // Petit cercle au centre
          this.ctx.beginPath();
          this.ctx.arc(p1.x, p1.y, 3 / this.viewport.scale, 0, Math.PI * 2);
          this.ctx.fillStyle = "#10B981";
          this.ctx.fill();
          this.ctx.restore();
        } else {
          // Mode coin: p1 est un coin
          widthPx = Math.abs(p2.x - p1.x);
          heightPx = Math.abs(p2.y - p1.y);
          rectX = p1.x;
          rectY = p1.y;
          rectW = p2.x - p1.x;
          rectH = p2.y - p1.y;
        }

        // Dessiner le rectangle
        this.ctx.beginPath();
        if (isCenter) {
          this.ctx.rect(rectX, rectY, rectW, rectH);
        } else {
          this.ctx.rect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        }
        this.ctx.stroke();

        const widthMm = widthPx / scaleFactor;
        const heightMm = heightPx / scaleFactor;

        this.ctx.save();
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = "#3B82F6";
        this.ctx.font = `bold ${fontSize}px Arial`;

        // Calculer les positions pour les labels
        const topY = isCenter ? p1.y - Math.abs(p2.y - p1.y) : Math.min(p1.y, p2.y);
        const leftX = isCenter ? p1.x - Math.abs(p2.x - p1.x) : Math.min(p1.x, p2.x);
        const rightX = isCenter ? p1.x + Math.abs(p2.x - p1.x) : Math.max(p1.x, p2.x);
        const bottomY = isCenter ? p1.y + Math.abs(p2.y - p1.y) : Math.max(p1.y, p2.y);

        // Largeur (en haut)
        const midX = (leftX + rightX) / 2;
        const widthText = `${widthMm.toFixed(1)} mm`;
        const widthTextWidth = this.ctx.measureText(widthText).width;

        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "bottom";

        // Fond blanc pour largeur
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        this.ctx.fillRect(
          midX - widthTextWidth / 2 - 3 / this.viewport.scale,
          topY - fontSize - 8 / this.viewport.scale,
          widthTextWidth + 6 / this.viewport.scale,
          fontSize + 4 / this.viewport.scale,
        );
        this.ctx.fillStyle = "#3B82F6";
        this.ctx.fillText(widthText, midX, topY - 5 / this.viewport.scale);

        // Hauteur (à gauche)
        const midY = (topY + bottomY) / 2;
        const heightText = `${heightMm.toFixed(1)} mm`;
        const heightTextWidth = this.ctx.measureText(heightText).width;

        this.ctx.textAlign = "right";
        this.ctx.textBaseline = "middle";

        // Fond blanc pour hauteur
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        this.ctx.fillRect(
          leftX - heightTextWidth - 8 / this.viewport.scale,
          midY - fontSize / 2 - 2 / this.viewport.scale,
          heightTextWidth + 6 / this.viewport.scale,
          fontSize + 4 / this.viewport.scale,
        );
        this.ctx.fillStyle = "#3B82F6";
        this.ctx.fillText(heightText, leftX - 5 / this.viewport.scale, midY);

        this.ctx.restore();
      }
    } else if (temp.type === "bezier" && temp.points?.length >= 1) {
      // Aperçu Bézier
      if (temp.points.length === 1 && temp.cursor) {
        // Juste une ligne pour commencer
        this.ctx.beginPath();
        this.ctx.moveTo(temp.points[0].x, temp.points[0].y);
        this.ctx.lineTo(temp.cursor.x, temp.cursor.y);
        this.ctx.stroke();

        // Afficher la longueur
        const p1 = temp.points[0];
        const p2 = temp.cursor;
        const lengthPx = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        const lengthMm = lengthPx / scaleFactor;
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        this.ctx.save();
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = "#3B82F6";
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        const text = `${lengthMm.toFixed(1)} mm`;
        const textWidth = this.ctx.measureText(text).width;
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        this.ctx.fillRect(
          midX - textWidth / 2 - 3 / this.viewport.scale,
          midY - 20 / this.viewport.scale - fontSize / 2,
          textWidth + 6 / this.viewport.scale,
          fontSize + 4 / this.viewport.scale,
        );
        this.ctx.fillStyle = "#3B82F6";
        this.ctx.fillText(text, midX, midY - 20 / this.viewport.scale);
        this.ctx.restore();
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
    } else if (temp.type === "arc" && temp.center) {
      // Arc temporaire
      const center = temp.center;
      const radius = temp.radius || 0;
      const startAngle = temp.startAngle || 0;
      const endAngle = temp.endAngle || 0;

      if (radius > 0) {
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, radius, startAngle, endAngle, temp.counterClockwise || false);
        this.ctx.stroke();

        // Afficher le rayon
        const radiusMm = radius / scaleFactor;
        this.ctx.save();
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = "#3B82F6";
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "middle";

        const text = `R ${radiusMm.toFixed(1)} mm`;
        const textX = center.x + 10 / this.viewport.scale;
        const textY = center.y;

        this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        const textWidth = this.ctx.measureText(text).width;
        this.ctx.fillRect(
          textX - 3 / this.viewport.scale,
          textY - fontSize / 2 - 2 / this.viewport.scale,
          textWidth + 6 / this.viewport.scale,
          fontSize + 4 / this.viewport.scale,
        );
        this.ctx.fillStyle = "#3B82F6";
        this.ctx.fillText(text, textX, textY);
        this.ctx.restore();
      }
    } else if (temp.type === "arc3points" && temp.points) {
      // Arc 3 points: afficher les points cliqués et la prévisualisation
      const points = temp.points;
      const cursor = temp.cursor;

      // Dessiner les points déjà cliqués
      this.ctx.save();
      this.ctx.setLineDash([]);
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        this.ctx.fillStyle = "#F97316"; // Orange
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 6 / this.viewport.scale, 0, Math.PI * 2);
        this.ctx.fill();

        // Numéro du point
        this.ctx.fillStyle = "white";
        this.ctx.font = `bold ${10 / this.viewport.scale}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(String(i + 1), p.x, p.y);
      }
      this.ctx.restore();

      // Si on a 2 points et un curseur, prévisualiser l'arc
      if (points.length === 2 && cursor) {
        const [p1, p2] = points;
        const p3 = cursor;

        // Calculer le centre du cercle passant par les 3 points
        const ax = p1.x,
          ay = p1.y;
        const bx = p2.x,
          by = p2.y;
        const cx = p3.x,
          cy = p3.y;

        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

        if (Math.abs(d) > 0.0001) {
          const ux =
            ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
          const uy =
            ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
          const radius = Math.sqrt((ax - ux) * (ax - ux) + (ay - uy) * (ay - uy));

          // Dessiner l'arc de prévisualisation
          const startAngle = Math.atan2(p1.y - uy, p1.x - ux);
          const endAngle = Math.atan2(p3.y - uy, p3.x - ux);

          this.ctx.strokeStyle = "#F97316";
          this.ctx.lineWidth = 2 / this.viewport.scale;
          this.ctx.beginPath();
          this.ctx.arc(ux, uy, radius, startAngle, endAngle);
          this.ctx.stroke();

          // Afficher le rayon
          const radiusMm = radius / scaleFactor;
          this.ctx.save();
          this.ctx.setLineDash([]);
          this.ctx.fillStyle = "#F97316";
          this.ctx.font = `bold ${fontSize}px Arial`;
          this.ctx.textAlign = "left";
          const text = `R ${radiusMm.toFixed(1)} mm`;
          this.ctx.fillText(text, ux + 10 / this.viewport.scale, uy);
          this.ctx.restore();
        }
      }
    } else if (temp.type === "mirrorAxis" && temp.p1) {
      // Axe de symétrie
      const p1 = temp.p1;
      const p2 = temp.p2 || temp.cursor;

      if (p2) {
        // Ligne d'axe en pointillés violets
        this.ctx.save();
        this.ctx.strokeStyle = "#8B5CF6"; // Violet
        this.ctx.lineWidth = 2 / this.viewport.scale;
        this.ctx.setLineDash([10 / this.viewport.scale, 5 / this.viewport.scale]);

        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();

        // Points aux extrémités
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = "#8B5CF6";
        this.ctx.beginPath();
        this.ctx.arc(p1.x, p1.y, 5 / this.viewport.scale, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(p2.x, p2.y, 5 / this.viewport.scale, 0, Math.PI * 2);
        this.ctx.fill();

        // Label "Axe de symétrie"
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "bottom";
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        const text = "Axe de symétrie";
        const textWidth = this.ctx.measureText(text).width;
        this.ctx.fillRect(
          midX - textWidth / 2 - 4 / this.viewport.scale,
          midY - 25 / this.viewport.scale - fontSize,
          textWidth + 8 / this.viewport.scale,
          fontSize + 6 / this.viewport.scale,
        );
        this.ctx.fillStyle = "#8B5CF6";
        this.ctx.fillText(text, midX, midY - 20 / this.viewport.scale);

        this.ctx.restore();
      }
    }

    this.ctx.setLineDash([]);
  }

  /**
   * Dessine l'angle entre le nouveau segment et un segment existant connecté
   */
  private drawAngleWithPreviousSegment(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    sketch: Sketch,
    scaleFactor: number,
    fontSize: number,
  ): void {
    // Chercher un point existant proche de p1
    let connectedPointId: string | null = null;
    const tolerance = 5 / this.viewport.scale;

    for (const [pointId, point] of sketch.points) {
      const dist = Math.sqrt((point.x - p1.x) ** 2 + (point.y - p1.y) ** 2);
      if (dist < tolerance) {
        connectedPointId = pointId;
        break;
      }
    }

    if (!connectedPointId) return;

    // Chercher les segments connectés à ce point
    const connectedLines: Array<{ otherPoint: { x: number; y: number } }> = [];

    sketch.geometries.forEach((geo) => {
      if (geo.type === "line") {
        const line = geo as Line;
        if (line.p1 === connectedPointId) {
          const otherPt = sketch.points.get(line.p2);
          if (otherPt) connectedLines.push({ otherPoint: otherPt });
        } else if (line.p2 === connectedPointId) {
          const otherPt = sketch.points.get(line.p1);
          if (otherPt) connectedLines.push({ otherPoint: otherPt });
        }
      }
    });

    if (connectedLines.length === 0) return;

    // Calculer l'angle avec le premier segment trouvé
    const prevLine = connectedLines[0];
    const vec1 = { x: prevLine.otherPoint.x - p1.x, y: prevLine.otherPoint.y - p1.y };
    const vec2 = { x: p2.x - p1.x, y: p2.y - p1.y };

    const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
    const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

    if (len1 < 0.001 || len2 < 0.001) return;

    const dot = vec1.x * vec2.x + vec1.y * vec2.y;
    const angleRad = Math.acos(Math.max(-1, Math.min(1, dot / (len1 * len2))));
    const angleDeg = (angleRad * 180) / Math.PI;

    // Dessiner l'arc d'angle
    const arcRadius = 20 / this.viewport.scale;
    const startAngle = Math.atan2(vec1.y, vec1.x);
    const endAngle = Math.atan2(vec2.y, vec2.x);

    this.ctx.save();
    this.ctx.setLineDash([]);
    this.ctx.strokeStyle = "#F97316"; // Orange
    this.ctx.lineWidth = 1.5 / this.viewport.scale;

    // Déterminer le sens de l'arc (le plus court)
    let deltaAngle = endAngle - startAngle;
    while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
    const counterClockwise = deltaAngle < 0;

    this.ctx.beginPath();
    this.ctx.arc(p1.x, p1.y, arcRadius, startAngle, endAngle, counterClockwise);
    this.ctx.stroke();

    // Afficher la valeur de l'angle
    const midAngle = startAngle + deltaAngle / 2;
    const textDist = arcRadius + 15 / this.viewport.scale;
    const textX = p1.x + Math.cos(midAngle) * textDist;
    const textY = p1.y + Math.sin(midAngle) * textDist;

    this.ctx.fillStyle = "#F97316";
    this.ctx.font = `bold ${fontSize}px Arial`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    const angleText = `${angleDeg.toFixed(1)}°`;
    const textWidth = this.ctx.measureText(angleText).width;

    // Fond blanc
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    this.ctx.fillRect(
      textX - textWidth / 2 - 3 / this.viewport.scale,
      textY - fontSize / 2 - 2 / this.viewport.scale,
      textWidth + 6 / this.viewport.scale,
      fontSize + 4 / this.viewport.scale,
    );

    this.ctx.fillStyle = "#F97316";
    this.ctx.fillText(angleText, textX, textY);
    this.ctx.restore();
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

  /**
   * Dessine une surbrillance pour les formes fermées
   */
  private drawClosedShapes(
    sketch: Sketch,
    highlightOpacity: number = 0.12,
    mouseWorldPos: { x: number; y: number } | null = null,
  ): void {
    // Collecter toutes les formes fermées avec leurs paths
    const closedShapes: Array<{
      type: "circle" | "arcCircle" | "polygon";
      path: Path2D;
      area: number;
      geoIds: string[];
    }> = [];

    // 1. Collecter les cercles
    sketch.geometries.forEach((geo, geoId) => {
      if (geo.type !== "circle") return;

      const circle = geo as Circle;
      const layerId = geo.layerId || "trace";
      const layer = sketch.layers.get(layerId);
      if (layer?.visible === false) return;

      const center = sketch.points.get(circle.center);
      if (!center) return;

      const path = new Path2D();
      path.arc(center.x, center.y, circle.radius, 0, Math.PI * 2);
      path.closePath();

      closedShapes.push({
        type: "circle",
        path,
        area: Math.PI * circle.radius * circle.radius,
        geoIds: [geoId],
      });
    });

    // 2. Collecter les arcs formant des cercles complets
    const arcGroups = new Map<string, Arc[]>();
    sketch.geometries.forEach((geo) => {
      if (geo.type !== "arc") return;
      const arc = geo as Arc;
      const layerId = geo.layerId || "trace";
      const layer = sketch.layers.get(layerId);
      if (layer?.visible === false) return;

      const key = `${arc.center}-${Math.round(arc.radius * 100)}`;
      if (!arcGroups.has(key)) arcGroups.set(key, []);
      arcGroups.get(key)!.push(arc);
    });

    arcGroups.forEach((arcs) => {
      if (arcs.length < 2) return;

      const firstArc = arcs[0];
      const center = sketch.points.get(firstArc.center);
      if (!center) return;

      let totalAngle = 0;
      for (const arc of arcs) {
        const startPt = sketch.points.get(arc.startPoint);
        const endPt = sketch.points.get(arc.endPoint);
        if (!startPt || !endPt) continue;

        const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
        const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);

        let sweep = endAngle - startAngle;
        if (arc.counterClockwise) {
          if (sweep > 0) sweep -= 2 * Math.PI;
        } else {
          if (sweep < 0) sweep += 2 * Math.PI;
        }
        totalAngle += Math.abs(sweep);
      }

      if (Math.abs(totalAngle - 2 * Math.PI) < 0.1) {
        const path = new Path2D();
        path.arc(center.x, center.y, firstArc.radius, 0, Math.PI * 2);
        path.closePath();

        closedShapes.push({
          type: "arcCircle",
          path,
          area: Math.PI * firstArc.radius * firstArc.radius,
          geoIds: arcs.map((a) => a.id),
        });
      }
    });

    // 3. Construire le graphe et trouver les cycles (polygones)
    const pointToGeos = new Map<string, Array<{ geoId: string; otherPointId: string }>>();

    sketch.geometries.forEach((geo, geoId) => {
      const layerId = geo.layerId || "trace";
      const layer = sketch.layers.get(layerId);
      if (layer?.visible === false) return;

      let p1Id: string | null = null;
      let p2Id: string | null = null;

      if (geo.type === "line") {
        const line = geo as Line;
        p1Id = line.p1;
        p2Id = line.p2;
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        p1Id = arc.startPoint;
        p2Id = arc.endPoint;
      }

      if (p1Id && p2Id) {
        if (!pointToGeos.has(p1Id)) pointToGeos.set(p1Id, []);
        if (!pointToGeos.has(p2Id)) pointToGeos.set(p2Id, []);
        pointToGeos.get(p1Id)!.push({ geoId, otherPointId: p2Id });
        pointToGeos.get(p2Id)!.push({ geoId, otherPointId: p1Id });
      }
    });

    const foundCycleKeys = new Set<string>();

    const getCycleKey = (cycle: string[]): string => {
      return [...cycle].sort().join(",");
    };

    const findMinimalCycle = (startPointId: string): string[] | null => {
      const conns = pointToGeos.get(startPointId) || [];
      if (conns.length < 2) return null;

      for (const firstConn of conns) {
        const queue: Array<{ pointId: string; path: string[]; visitedPoints: Set<string> }> = [
          {
            pointId: firstConn.otherPointId,
            path: [firstConn.geoId],
            visitedPoints: new Set([startPointId, firstConn.otherPointId]),
          },
        ];

        while (queue.length > 0) {
          const current = queue.shift()!;
          if (current.path.length > 20) continue;

          const nextConns = pointToGeos.get(current.pointId) || [];

          for (const conn of nextConns) {
            if (current.path.includes(conn.geoId)) continue;

            if (conn.otherPointId === startPointId && current.path.length >= 2) {
              const cycle = [...current.path, conn.geoId];
              const key = getCycleKey(cycle);
              if (!foundCycleKeys.has(key)) {
                return cycle;
              }
            }

            if (current.visitedPoints.has(conn.otherPointId)) continue;

            const newVisited = new Set(current.visitedPoints);
            newVisited.add(conn.otherPointId);

            queue.push({
              pointId: conn.otherPointId,
              path: [...current.path, conn.geoId],
              visitedPoints: newVisited,
            });
          }
        }
      }
      return null;
    };

    // Trouver tous les cycles
    for (let pass = 0; pass < 3; pass++) {
      for (const [pointId] of pointToGeos) {
        const cycle = findMinimalCycle(pointId);
        if (cycle) {
          const key = getCycleKey(cycle);
          if (!foundCycleKeys.has(key)) {
            foundCycleKeys.add(key);

            // Construire le path pour ce cycle
            const orderedPath: Array<{
              x: number;
              y: number;
              isArc?: boolean;
              arc?: Arc;
              center?: Point;
              startPt?: Point;
              endPt?: Point;
            }> = [];

            const firstGeo = sketch.geometries.get(cycle[0]);
            if (!firstGeo) continue;

            let currentPointId: string;
            if (firstGeo.type === "line") {
              currentPointId = (firstGeo as Line).p1;
            } else if (firstGeo.type === "arc") {
              currentPointId = (firstGeo as Arc).startPoint;
            } else continue;

            const remainingGeos = new Set(cycle);

            while (remainingGeos.size > 0) {
              let foundNext = false;

              for (const geoId of remainingGeos) {
                const geo = sketch.geometries.get(geoId);
                if (!geo) continue;

                if (geo.type === "line") {
                  const line = geo as Line;
                  if (line.p1 === currentPointId || line.p2 === currentPointId) {
                    const p1 = sketch.points.get(line.p1);
                    const p2 = sketch.points.get(line.p2);
                    if (!p1 || !p2) continue;

                    if (line.p1 === currentPointId) {
                      orderedPath.push({ x: p1.x, y: p1.y });
                      currentPointId = line.p2;
                    } else {
                      orderedPath.push({ x: p2.x, y: p2.y });
                      currentPointId = line.p1;
                    }

                    remainingGeos.delete(geoId);
                    foundNext = true;
                    break;
                  }
                } else if (geo.type === "arc") {
                  const arc = geo as Arc;
                  if (arc.startPoint === currentPointId || arc.endPoint === currentPointId) {
                    const center = sketch.points.get(arc.center);
                    const startPt = sketch.points.get(arc.startPoint);
                    const endPt = sketch.points.get(arc.endPoint);
                    if (!center || !startPt || !endPt) continue;

                    if (arc.startPoint === currentPointId) {
                      orderedPath.push({ x: startPt.x, y: startPt.y, isArc: true, arc, center, startPt, endPt });
                      currentPointId = arc.endPoint;
                    } else {
                      orderedPath.push({
                        x: endPt.x,
                        y: endPt.y,
                        isArc: true,
                        arc,
                        center,
                        startPt: endPt,
                        endPt: startPt,
                      });
                      currentPointId = arc.startPoint;
                    }

                    remainingGeos.delete(geoId);
                    foundNext = true;
                    break;
                  }
                }
              }

              if (!foundNext) break;
            }

            // Créer le Path2D pour ce cycle
            if (orderedPath.length >= 3) {
              const path = new Path2D();
              path.moveTo(orderedPath[0].x, orderedPath[0].y);

              for (let i = 0; i < orderedPath.length; i++) {
                const segment = orderedPath[i];
                const nextSegment = orderedPath[(i + 1) % orderedPath.length];

                if (segment.isArc && segment.arc && segment.center && segment.startPt && segment.endPt) {
                  const startAngle = Math.atan2(
                    segment.startPt.y - segment.center.y,
                    segment.startPt.x - segment.center.x,
                  );
                  const endAngle = Math.atan2(segment.endPt.y - segment.center.y, segment.endPt.x - segment.center.x);

                  let counterClockwise: boolean;
                  if (segment.arc.counterClockwise !== undefined) {
                    const isReversed = segment.startPt !== sketch.points.get(segment.arc.startPoint);
                    counterClockwise = isReversed ? !segment.arc.counterClockwise : segment.arc.counterClockwise;
                  } else {
                    let deltaAngle = endAngle - startAngle;
                    while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
                    while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
                    counterClockwise = deltaAngle < 0;
                  }

                  path.arc(
                    segment.center.x,
                    segment.center.y,
                    segment.arc.radius,
                    startAngle,
                    endAngle,
                    counterClockwise,
                  );
                } else {
                  path.lineTo(nextSegment.x, nextSegment.y);
                }
              }

              path.closePath();

              // Calculer l'aire approximative (somme des coords pour trier)
              let area = 0;
              for (let i = 0; i < orderedPath.length; i++) {
                const j = (i + 1) % orderedPath.length;
                area += orderedPath[i].x * orderedPath[j].y;
                area -= orderedPath[j].x * orderedPath[i].y;
              }
              area = Math.abs(area) / 2;

              closedShapes.push({
                type: "polygon",
                path,
                area,
                geoIds: cycle,
              });
            }
          }
        }
      }
    }

    // Si aucune forme, sortir
    if (closedShapes.length === 0) return;

    // Trier par aire décroissante (grandes formes d'abord)
    closedShapes.sort((a, b) => b.area - a.area);

    // Détecter quelle forme est survolée (la plus petite qui contient la souris)
    let hoveredShapeIndex = -1;
    if (mouseWorldPos) {
      // Sauvegarder la transformation actuelle et reset pour tester en coordonnées monde
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Parcourir du plus petit au plus grand pour trouver la forme la plus spécifique
      for (let i = closedShapes.length - 1; i >= 0; i--) {
        // Tester le point en coordonnées monde (le path est en coordonnées monde)
        if (this.ctx.isPointInPath(closedShapes[i].path, mouseWorldPos.x, mouseWorldPos.y)) {
          hoveredShapeIndex = i;
          break;
        }
      }

      this.ctx.restore();
    }

    // Créer un canvas offscreen pour éviter la superposition
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = this.canvas.width;
    offscreenCanvas.height = this.canvas.height;
    const offCtx = offscreenCanvas.getContext("2d");
    if (!offCtx) return;

    // Appliquer la même transformation que le canvas principal
    offCtx.scale(this.dpr, this.dpr);
    offCtx.translate(this.viewport.offsetX, this.viewport.offsetY);
    offCtx.scale(this.viewport.scale, this.viewport.scale);

    // Dessiner les formes sur le canvas offscreen
    // Utiliser destination-out pour "creuser" les formes intérieures

    // D'abord dessiner toutes les formes en bleu opaque
    offCtx.fillStyle = "rgb(100, 180, 255)";

    for (let i = 0; i < closedShapes.length; i++) {
      const shape = closedShapes[i];

      if (i === 0) {
        // Première forme (la plus grande): dessiner normalement
        offCtx.fill(shape.path);
      } else {
        // Formes suivantes: d'abord "creuser" la zone, puis remplir
        offCtx.globalCompositeOperation = "destination-out";
        offCtx.fill(shape.path);
        offCtx.globalCompositeOperation = "source-over";
        offCtx.fill(shape.path);
      }
    }

    // Copier le canvas offscreen sur le canvas principal avec l'opacité voulue
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform pour copier pixel par pixel
    this.ctx.globalAlpha = highlightOpacity;
    this.ctx.drawImage(offscreenCanvas, 0, 0);
    this.ctx.restore();

    // Dessiner l'effet de survol (forme survolée plus visible)
    if (hoveredShapeIndex >= 0) {
      const hoveredShape = closedShapes[hoveredShapeIndex];

      // Créer un second canvas offscreen pour le hover
      const hoverCanvas = document.createElement("canvas");
      hoverCanvas.width = this.canvas.width;
      hoverCanvas.height = this.canvas.height;
      const hoverCtx = hoverCanvas.getContext("2d");
      if (hoverCtx) {
        hoverCtx.scale(this.dpr, this.dpr);
        hoverCtx.translate(this.viewport.offsetX, this.viewport.offsetY);
        hoverCtx.scale(this.viewport.scale, this.viewport.scale);

        // Dessiner la forme survolée
        hoverCtx.fillStyle = "rgb(59, 130, 246)"; // Bleu plus vif
        hoverCtx.fill(hoveredShape.path);

        // Retirer les formes plus petites qui sont à l'intérieur
        hoverCtx.globalCompositeOperation = "destination-out";
        for (let i = hoveredShapeIndex + 1; i < closedShapes.length; i++) {
          const smallerShape = closedShapes[i];
          // Vérifier si cette forme est à l'intérieur de la forme survolée
          // (simplification: on retire toutes les formes plus petites)
          hoverCtx.fill(smallerShape.path);
        }

        // Copier sur le canvas principal
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.globalAlpha = 0.15; // Opacité supplémentaire pour le hover
        this.ctx.drawImage(hoverCanvas, 0, 0);
        this.ctx.restore();
      }

      // Dessiner un contour sur la forme survolée
      this.ctx.save();
      this.ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
      this.ctx.lineWidth = 2 / this.viewport.scale;
      this.ctx.stroke(hoveredShape.path);
      this.ctx.restore();
    }
  }

  /**
   * Dessine le gizmo de transformation (flèches X, Y, symbole rotation)
   */
  private drawTransformGizmo(
    center: { x: number; y: number },
    transformGizmo: { active: boolean; mode: string; center: { x: number; y: number } } | null,
    gizmoDrag: { active: boolean; mode: string; currentValue: number; center: { x: number; y: number } } | null = null,
  ): void {
    const arrowLength = 50 / this.viewport.scale;
    const arrowHeadLength = 14 / this.viewport.scale;
    const arrowHeadWidth = 8 / this.viewport.scale;
    const rotationRadius = 30 / this.viewport.scale;
    const lineWidth = 2.5 / this.viewport.scale;
    const outlineWidth = 4.5 / this.viewport.scale;

    // Couleurs
    const xColor = "#DC2626"; // Rouge vif
    const yColor = "#16A34A"; // Vert vif
    const rotateColor = "#2563EB"; // Bleu vif
    const activeColor = "#F59E0B"; // Orange pour l'axe actif
    const outlineColor = "rgba(255, 255, 255, 0.9)";

    this.ctx.save();
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    // Fonction pour dessiner une flèche avec contour
    const drawArrow = (
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      color: string,
      isActive: boolean,
    ) => {
      const currentColor = isActive ? activeColor : color;
      const currentWidth = isActive ? lineWidth * 1.4 : lineWidth;

      // Direction de la flèche
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / len;
      const uy = dy / len;

      // Point de base de la tête de flèche
      const headBaseX = endX - ux * arrowHeadLength;
      const headBaseY = endY - uy * arrowHeadLength;

      // Points perpendiculaires pour la tête
      const perpX = (-uy * arrowHeadWidth) / 2;
      const perpY = (ux * arrowHeadWidth) / 2;

      // Contour blanc (ombre)
      this.ctx.strokeStyle = outlineColor;
      this.ctx.lineWidth = outlineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(headBaseX, headBaseY);
      this.ctx.stroke();

      // Ligne principale
      this.ctx.strokeStyle = currentColor;
      this.ctx.lineWidth = currentWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(headBaseX, headBaseY);
      this.ctx.stroke();

      // Tête de flèche - contour
      this.ctx.fillStyle = outlineColor;
      this.ctx.beginPath();
      this.ctx.moveTo(endX + (ux * 1.5) / this.viewport.scale, endY + (uy * 1.5) / this.viewport.scale);
      this.ctx.lineTo(
        headBaseX + perpX - (ux * 1) / this.viewport.scale,
        headBaseY + perpY - (uy * 1) / this.viewport.scale,
      );
      this.ctx.lineTo(
        headBaseX - perpX - (ux * 1) / this.viewport.scale,
        headBaseY - perpY - (uy * 1) / this.viewport.scale,
      );
      this.ctx.closePath();
      this.ctx.fill();

      // Tête de flèche - remplie
      this.ctx.fillStyle = currentColor;
      this.ctx.beginPath();
      this.ctx.moveTo(endX, endY);
      this.ctx.lineTo(headBaseX + perpX, headBaseY + perpY);
      this.ctx.lineTo(headBaseX - perpX, headBaseY - perpY);
      this.ctx.closePath();
      this.ctx.fill();
    };

    // === Flèche X (rouge, vers la droite) ===
    const xActive =
      (transformGizmo?.active && transformGizmo.mode === "translateX") ||
      (gizmoDrag?.active && gizmoDrag.mode === "translateX");
    drawArrow(center.x + 8 / this.viewport.scale, center.y, center.x + arrowLength, center.y, xColor, xActive);

    // Label X
    this.ctx.fillStyle = xActive ? activeColor : xColor;
    this.ctx.font = `bold ${11 / this.viewport.scale}px Arial`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    // Fond blanc pour le label
    const labelX = center.x + arrowLength + 8 / this.viewport.scale;
    this.ctx.fillStyle = outlineColor;
    this.ctx.beginPath();
    this.ctx.arc(labelX, center.y, 7 / this.viewport.scale, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = xActive ? activeColor : xColor;
    this.ctx.fillText("X", labelX, center.y);

    // Affichage valeur X en temps réel
    if (gizmoDrag?.active && gizmoDrag.mode === "translateX") {
      const valueText = `${gizmoDrag.currentValue >= 0 ? "+" : ""}${gizmoDrag.currentValue.toFixed(1)} mm`;
      this.ctx.font = `bold ${12 / this.viewport.scale}px Arial`;
      const textWidth = this.ctx.measureText(valueText).width;
      const valuePosX = center.x + arrowLength + 25 / this.viewport.scale;
      const valuePosY = center.y;

      // Fond du badge
      this.ctx.fillStyle = "rgba(220, 38, 38, 0.95)"; // Rouge
      const padding = 4 / this.viewport.scale;
      const height = 16 / this.viewport.scale;
      this.ctx.beginPath();
      this.ctx.roundRect(
        valuePosX - padding,
        valuePosY - height / 2,
        textWidth + padding * 2,
        height,
        3 / this.viewport.scale,
      );
      this.ctx.fill();

      // Texte
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.textAlign = "left";
      this.ctx.fillText(valueText, valuePosX, valuePosY);
    }

    // === Flèche Y (vert, vers le haut) ===
    const yActive =
      (transformGizmo?.active && transformGizmo.mode === "translateY") ||
      (gizmoDrag?.active && gizmoDrag.mode === "translateY");
    drawArrow(center.x, center.y - 8 / this.viewport.scale, center.x, center.y - arrowLength, yColor, yActive);

    // Label Y
    const labelY = center.y - arrowLength - 8 / this.viewport.scale;
    this.ctx.fillStyle = outlineColor;
    this.ctx.beginPath();
    this.ctx.arc(center.x, labelY, 7 / this.viewport.scale, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = yActive ? activeColor : yColor;
    this.ctx.textAlign = "center";
    this.ctx.fillText("Y", center.x, labelY);

    // Affichage valeur Y en temps réel
    if (gizmoDrag?.active && gizmoDrag.mode === "translateY") {
      const valueText = `${gizmoDrag.currentValue >= 0 ? "+" : ""}${gizmoDrag.currentValue.toFixed(1)} mm`;
      this.ctx.font = `bold ${12 / this.viewport.scale}px Arial`;
      const textWidth = this.ctx.measureText(valueText).width;
      const valuePosX = center.x + 20 / this.viewport.scale;
      const valuePosY = center.y - arrowLength - 8 / this.viewport.scale;

      // Fond du badge
      this.ctx.fillStyle = "rgba(22, 163, 74, 0.95)"; // Vert
      const padding = 4 / this.viewport.scale;
      const height = 16 / this.viewport.scale;
      this.ctx.beginPath();
      this.ctx.roundRect(
        valuePosX - padding,
        valuePosY - height / 2,
        textWidth + padding * 2,
        height,
        3 / this.viewport.scale,
      );
      this.ctx.fill();

      // Texte
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.textAlign = "left";
      this.ctx.fillText(valueText, valuePosX, valuePosY);
    }

    // === Arc de rotation (bleu) ===
    const rotateActive =
      (transformGizmo?.active && transformGizmo.mode === "rotate") ||
      (gizmoDrag?.active && gizmoDrag.mode === "rotate");
    const rotColor = rotateActive ? activeColor : rotateColor;
    const rotWidth = rotateActive ? lineWidth * 1.4 : lineWidth;

    // Arc - contour blanc
    this.ctx.strokeStyle = outlineColor;
    this.ctx.lineWidth = outlineWidth;
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, rotationRadius, Math.PI * 0.15, Math.PI * 0.85);
    this.ctx.stroke();

    // Arc - couleur
    this.ctx.strokeStyle = rotColor;
    this.ctx.lineWidth = rotWidth;
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, rotationRadius, Math.PI * 0.15, Math.PI * 0.85);
    this.ctx.stroke();

    // Flèche au bout de l'arc (côté gauche)
    const endAngle = Math.PI * 0.85;
    const arrowX = center.x + rotationRadius * Math.cos(endAngle);
    const arrowY = center.y + rotationRadius * Math.sin(endAngle);
    const tangentAngle = endAngle + Math.PI / 2;
    const smallArrowSize = 6 / this.viewport.scale;

    // Flèche de rotation
    this.ctx.fillStyle = rotColor;
    this.ctx.beginPath();
    this.ctx.moveTo(
      arrowX + smallArrowSize * 1.2 * Math.cos(tangentAngle),
      arrowY + smallArrowSize * 1.2 * Math.sin(tangentAngle),
    );
    this.ctx.lineTo(
      arrowX + smallArrowSize * Math.cos(tangentAngle - 0.8),
      arrowY + smallArrowSize * Math.sin(tangentAngle - 0.8),
    );
    this.ctx.lineTo(
      arrowX + smallArrowSize * Math.cos(tangentAngle + 0.8),
      arrowY + smallArrowSize * Math.sin(tangentAngle + 0.8),
    );
    this.ctx.closePath();
    this.ctx.fill();

    // Affichage valeur rotation en temps réel
    if (gizmoDrag?.active && gizmoDrag.mode === "rotate") {
      const valueText = `${gizmoDrag.currentValue >= 0 ? "+" : ""}${gizmoDrag.currentValue.toFixed(1)}°`;
      this.ctx.font = `bold ${12 / this.viewport.scale}px Arial`;
      const textWidth = this.ctx.measureText(valueText).width;
      const valuePosX = center.x + rotationRadius + 15 / this.viewport.scale;
      const valuePosY = center.y + rotationRadius / 2;

      // Fond du badge
      this.ctx.fillStyle = "rgba(37, 99, 235, 0.95)"; // Bleu
      const padding = 4 / this.viewport.scale;
      const height = 16 / this.viewport.scale;
      this.ctx.beginPath();
      this.ctx.roundRect(
        valuePosX - padding,
        valuePosY - height / 2,
        textWidth + padding * 2,
        height,
        3 / this.viewport.scale,
      );
      this.ctx.fill();

      // Texte
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(valueText, valuePosX, valuePosY);
    }

    // === Point central ===
    // Cercle blanc de fond
    this.ctx.fillStyle = outlineColor;
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, 6 / this.viewport.scale, 0, Math.PI * 2);
    this.ctx.fill();

    // Cercle coloré
    this.ctx.fillStyle = "#475569";
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, 4 / this.viewport.scale, 0, Math.PI * 2);
    this.ctx.fill();

    // Point central blanc
    this.ctx.fillStyle = "#FFFFFF";
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, 1.5 / this.viewport.scale, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  /**
   * Dessine le fantôme des géométries pendant le drag (positions initiales en pointillé)
   */
  private drawGhostGeometries(
    sketch: Sketch,
    selectedEntities: Set<string>,
    initialPositions: Map<string, { x: number; y: number }>,
  ): void {
    this.ctx.save();

    // Style fantôme: gris-bleu, semi-transparent, pointillé fin
    this.ctx.strokeStyle = "rgba(100, 150, 200, 0.5)";
    this.ctx.lineWidth = 1.5 / this.viewport.scale;
    this.ctx.setLineDash([6 / this.viewport.scale, 3 / this.viewport.scale]);
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    // Helper pour obtenir la position initiale d'un point
    const getInitialPos = (pointId: string): { x: number; y: number } | null => {
      const initialPos = initialPositions.get(pointId);
      if (initialPos) return initialPos;
      // Si pas dans les positions initiales, utiliser la position actuelle
      const pt = sketch.points.get(pointId);
      return pt ? { x: pt.x, y: pt.y } : null;
    };

    // Dessiner les géométries sélectionnées avec leurs positions initiales
    selectedEntities.forEach((geoId) => {
      const geo = sketch.geometries.get(geoId);
      if (!geo) return;

      this.ctx.beginPath();

      switch (geo.type) {
        case "line": {
          const line = geo as Line;
          const p1 = getInitialPos(line.p1);
          const p2 = getInitialPos(line.p2);
          if (p1 && p2) {
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.stroke();
          }
          break;
        }

        case "circle": {
          const circle = geo as Circle;
          const center = getInitialPos(circle.center);
          if (center) {
            this.ctx.arc(center.x, center.y, circle.radius, 0, Math.PI * 2);
            this.ctx.stroke();
          }
          break;
        }

        case "arc": {
          const arc = geo as Arc;
          const center = getInitialPos(arc.center);
          const startPt = getInitialPos(arc.startPoint);
          const endPt = getInitialPos(arc.endPoint);
          if (center && startPt && endPt) {
            // Calculer les angles à partir des positions
            const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
            const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);
            this.ctx.arc(center.x, center.y, arc.radius, startAngle, endAngle, arc.counterClockwise);
            this.ctx.stroke();
          }
          break;
        }

        case "rectangle": {
          const rect = geo as Rectangle;
          const corners = [rect.p1, rect.p2, rect.p3, rect.p4];
          const positions = corners.map(getInitialPos).filter(Boolean) as { x: number; y: number }[];
          if (positions.length === 4) {
            this.ctx.moveTo(positions[0].x, positions[0].y);
            this.ctx.lineTo(positions[1].x, positions[1].y);
            this.ctx.lineTo(positions[2].x, positions[2].y);
            this.ctx.lineTo(positions[3].x, positions[3].y);
            this.ctx.closePath();
            this.ctx.stroke();
          }
          break;
        }

        case "bezier": {
          const bezier = geo as Bezier;
          const p1 = getInitialPos(bezier.p1);
          const p2 = getInitialPos(bezier.p2);
          const cp1 = getInitialPos(bezier.cp1);
          const cp2 = getInitialPos(bezier.cp2);
          if (p1 && p2 && cp1 && cp2) {
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
            this.ctx.stroke();
          }
          break;
        }
      }
    });

    // Dessiner les points fantômes (petits cercles aux positions initiales)
    this.ctx.setLineDash([]);
    this.ctx.fillStyle = "rgba(100, 150, 200, 0.4)";
    this.ctx.strokeStyle = "rgba(100, 150, 200, 0.6)";
    this.ctx.lineWidth = 1 / this.viewport.scale;
    const pointRadius = 4 / this.viewport.scale;

    initialPositions.forEach((pos) => {
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, pointRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    });

    this.ctx.restore();
  }

  /**
   * Dessine les géométries d'une branche de comparaison avec une couleur et opacité spécifiques
   */
  private drawComparisonBranch(branchSketch: Sketch, color: string, opacity: number, branchName: string): void {
    this.ctx.save();
    this.ctx.globalAlpha = opacity;

    // Style pour les géométries de comparaison
    const lineWidth = 2 / this.viewport.scale;
    const dashPattern = [6 / this.viewport.scale, 3 / this.viewport.scale];

    // Dessiner toutes les géométries de la branche
    branchSketch.geometries.forEach((geo, geoId) => {
      // Vérifier si le calque est visible
      const layerId = (geo as any).layerId || "trace";
      const layer = branchSketch.layers?.get(layerId);
      if (layer?.visible === false) return;

      if (geo.type === "line") {
        const line = geo as Line;
        const p1 = branchSketch.points.get(line.p1);
        const p2 = branchSketch.points.get(line.p2);
        if (p1 && p2) {
          this.ctx.strokeStyle = color;
          this.ctx.lineWidth = lineWidth;
          this.ctx.setLineDash(dashPattern);
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.stroke();
        }
      } else if (geo.type === "circle") {
        const circle = geo as Circle;
        const center = branchSketch.points.get(circle.center);
        if (center) {
          this.ctx.strokeStyle = color;
          this.ctx.lineWidth = lineWidth;
          this.ctx.setLineDash(dashPattern);
          this.ctx.beginPath();
          this.ctx.arc(center.x, center.y, circle.radius, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        const center = branchSketch.points.get(arc.center);
        const startPt = branchSketch.points.get(arc.startPoint);
        const endPt = branchSketch.points.get(arc.endPoint);
        if (center && startPt && endPt) {
          const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
          const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);

          this.ctx.strokeStyle = color;
          this.ctx.lineWidth = lineWidth;
          this.ctx.setLineDash(dashPattern);
          this.ctx.beginPath();
          this.ctx.arc(center.x, center.y, arc.radius, startAngle, endAngle, arc.counterClockwise);
          this.ctx.stroke();
        }
      } else if (geo.type === "bezier") {
        const bezier = geo as Bezier;
        const p1 = branchSketch.points.get(bezier.p1);
        const p2 = branchSketch.points.get(bezier.p2);
        const cp1 = branchSketch.points.get(bezier.cp1);
        const cp2 = branchSketch.points.get(bezier.cp2);
        if (p1 && p2 && cp1 && cp2) {
          this.ctx.strokeStyle = color;
          this.ctx.lineWidth = lineWidth;
          this.ctx.setLineDash(dashPattern);
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
          this.ctx.stroke();
        }
      }
    });

    // Dessiner les points de la branche (petits cercles)
    const pointRadius = 3 / this.viewport.scale;
    this.ctx.fillStyle = color;
    this.ctx.setLineDash([]);

    branchSketch.points.forEach((point) => {
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();
  }

  /**
   * Dessine les géométries d'une branche pour le mode reveal (trait plein, couleur de la branche)
   */
  private drawRevealBranch(branchSketch: Sketch, color: string): void {
    const lineWidth = 2 / this.viewport.scale;

    // Dessiner toutes les géométries de la branche
    branchSketch.geometries.forEach((geo) => {
      // Vérifier si le calque est visible
      const layerId = (geo as any).layerId || "trace";
      const layer = branchSketch.layers?.get(layerId);
      if (layer?.visible === false) return;

      if (geo.type === "line") {
        const line = geo as Line;
        const p1 = branchSketch.points.get(line.p1);
        const p2 = branchSketch.points.get(line.p2);
        if (p1 && p2) {
          this.ctx.strokeStyle = color;
          this.ctx.lineWidth = lineWidth;
          this.ctx.setLineDash([]);
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.stroke();
        }
      } else if (geo.type === "circle") {
        const circle = geo as Circle;
        const center = branchSketch.points.get(circle.center);
        if (center) {
          this.ctx.strokeStyle = color;
          this.ctx.lineWidth = lineWidth;
          this.ctx.setLineDash([]);
          this.ctx.beginPath();
          this.ctx.arc(center.x, center.y, circle.radius, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      } else if (geo.type === "arc") {
        const arc = geo as Arc;
        const center = branchSketch.points.get(arc.center);
        const startPt = branchSketch.points.get(arc.startPoint);
        const endPt = branchSketch.points.get(arc.endPoint);
        if (center && startPt && endPt) {
          const startAngle = Math.atan2(startPt.y - center.y, startPt.x - center.x);
          const endAngle = Math.atan2(endPt.y - center.y, endPt.x - center.x);

          this.ctx.strokeStyle = color;
          this.ctx.lineWidth = lineWidth;
          this.ctx.setLineDash([]);
          this.ctx.beginPath();
          this.ctx.arc(center.x, center.y, arc.radius, startAngle, endAngle, arc.counterClockwise);
          this.ctx.stroke();
        }
      } else if (geo.type === "bezier") {
        const bezier = geo as Bezier;
        const p1 = branchSketch.points.get(bezier.p1);
        const p2 = branchSketch.points.get(bezier.p2);
        const cp1 = branchSketch.points.get(bezier.cp1);
        const cp2 = branchSketch.points.get(bezier.cp2);
        if (p1 && p2 && cp1 && cp2) {
          this.ctx.strokeStyle = color;
          this.ctx.lineWidth = lineWidth;
          this.ctx.setLineDash([]);
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
          this.ctx.stroke();
        }
      }
    });

    // Dessiner les points de la branche (petits cercles)
    const pointRadius = 3 / this.viewport.scale;
    this.ctx.fillStyle = color;

    branchSketch.points.forEach((point) => {
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }
}
