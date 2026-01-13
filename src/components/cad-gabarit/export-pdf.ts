// ============================================
// EXPORT PDF: Générateur de plans professionnels
// VERSION: 1.0 - Cartouche, échelle, cotations
// ============================================

import { jsPDF } from "jspdf";
import {
  Sketch,
  Point,
  Line,
  Circle,
  Arc,
  Bezier,
  Spline,
  Dimension,
} from "./types";

// Types pour les options d'export
export interface PDFExportOptions {
  format: "a4" | "a3";
  orientation: "portrait" | "landscape";
  scale: number; // Échelle du dessin (ex: 10 = 1:10)
  title: string;
  projectName?: string;
  author?: string;
  date?: string;
  revision?: string;
  showDimensions: boolean;
  showGrid: boolean;
  showScale: boolean;
  margin: number; // Marge en mm
  lineWidth: number; // Épaisseur des traits en mm
}

// Options par défaut
export const DEFAULT_PDF_OPTIONS: PDFExportOptions = {
  format: "a4",
  orientation: "landscape",
  scale: 1,
  title: "Plan",
  projectName: "",
  author: "",
  date: new Date().toLocaleDateString("fr-FR"),
  revision: "A",
  showDimensions: true,
  showGrid: false,
  showScale: true,
  margin: 10,
  lineWidth: 0.3,
};

// Dimensions des formats en mm
const PAGE_SIZES = {
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
};

// Hauteur du cartouche en mm
const CARTOUCHE_HEIGHT = 30;

/**
 * Exporte le sketch en PDF professionnel
 */
export function exportToPDF(
  sketch: Sketch,
  options: Partial<PDFExportOptions> = {}
): void {
  const opts: PDFExportOptions = { ...DEFAULT_PDF_OPTIONS, ...options };
  
  // Dimensions de la page
  const pageSize = PAGE_SIZES[opts.format];
  const pageWidth = opts.orientation === "landscape" ? pageSize.height : pageSize.width;
  const pageHeight = opts.orientation === "landscape" ? pageSize.width : pageSize.height;
  
  // Créer le document PDF
  const doc = new jsPDF({
    orientation: opts.orientation,
    unit: "mm",
    format: opts.format,
  });
  
  // Zone de dessin (sans marges ni cartouche)
  const drawingArea = {
    x: opts.margin,
    y: opts.margin,
    width: pageWidth - 2 * opts.margin,
    height: pageHeight - 2 * opts.margin - CARTOUCHE_HEIGHT,
  };
  
  // Calculer les bounds du sketch
  const bounds = calculateSketchBounds(sketch);
  if (!bounds) {
    console.warn("Sketch vide, rien à exporter");
    return;
  }
  
  // Calculer l'échelle pour que le dessin tienne dans la zone
  const sketchWidth = bounds.maxX - bounds.minX;
  const sketchHeight = bounds.maxY - bounds.minY;
  
  // Appliquer l'échelle utilisateur
  const scaledWidth = sketchWidth / opts.scale;
  const scaledHeight = sketchHeight / opts.scale;
  
  // Calculer le ratio pour centrer
  const scaleX = drawingArea.width / scaledWidth;
  const scaleY = drawingArea.height / scaledHeight;
  const fitScale = Math.min(scaleX, scaleY) * 0.9; // 90% pour laisser de l'espace
  
  // Centre du dessin
  const centerX = drawingArea.x + drawingArea.width / 2;
  const centerY = drawingArea.y + drawingArea.height / 2;
  const sketchCenterX = (bounds.minX + bounds.maxX) / 2;
  const sketchCenterY = (bounds.minY + bounds.maxY) / 2;
  
  // Fonction de transformation des coordonnées
  const transform = (x: number, y: number): { x: number; y: number } => {
    return {
      x: centerX + ((x - sketchCenterX) / opts.scale) * fitScale,
      y: centerY + ((y - sketchCenterY) / opts.scale) * fitScale,
    };
  };
  
  // 1. Dessiner le cadre
  drawFrame(doc, pageWidth, pageHeight, opts.margin);
  
  // 2. Dessiner la grille (optionnel)
  if (opts.showGrid) {
    drawGrid(doc, drawingArea, 10);
  }
  
  // 3. Dessiner les géométries
  doc.setLineWidth(opts.lineWidth);
  doc.setDrawColor(0, 0, 0);
  
  drawGeometries(doc, sketch, transform, opts);
  
  // 4. Dessiner les cotations
  if (opts.showDimensions) {
    drawDimensions(doc, sketch, transform, opts, fitScale);
  }
  
  // 5. Dessiner l'échelle graphique
  if (opts.showScale) {
    drawScaleBar(doc, drawingArea, opts.scale, fitScale);
  }
  
  // 6. Dessiner le cartouche
  drawCartouche(doc, pageWidth, pageHeight, opts);
  
  // Sauvegarder le PDF
  const filename = `${opts.title.replace(/[^a-zA-Z0-9]/g, "_")}_${opts.date?.replace(/\//g, "-")}.pdf`;
  doc.save(filename);
}

/**
 * Calcule les bounds du sketch
 */
function calculateSketchBounds(sketch: Sketch): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let hasPoints = false;
  
  sketch.points.forEach((point) => {
    hasPoints = true;
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  });
  
  // Inclure les cercles (rayon)
  sketch.geometries.forEach((geo) => {
    if (geo.type === "circle") {
      const circle = geo as Circle;
      const center = sketch.points.get(circle.center);
      if (center) {
        minX = Math.min(minX, center.x - circle.radius);
        maxX = Math.max(maxX, center.x + circle.radius);
        minY = Math.min(minY, center.y - circle.radius);
        maxY = Math.max(maxY, center.y + circle.radius);
      }
    } else if (geo.type === "arc") {
      const arc = geo as Arc;
      const center = sketch.points.get(arc.center);
      if (center) {
        minX = Math.min(minX, center.x - arc.radius);
        maxX = Math.max(maxX, center.x + arc.radius);
        minY = Math.min(minY, center.y - arc.radius);
        maxY = Math.max(maxY, center.y + arc.radius);
      }
    }
  });
  
  if (!hasPoints) return null;
  
  // Ajouter une marge
  const padding = Math.max(maxX - minX, maxY - minY) * 0.05;
  return {
    minX: minX - padding,
    maxX: maxX + padding,
    minY: minY - padding,
    maxY: maxY + padding,
  };
}

/**
 * Dessine le cadre extérieur
 */
function drawFrame(doc: jsPDF, width: number, height: number, margin: number): void {
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);
  doc.rect(margin, margin, width - 2 * margin, height - 2 * margin);
  
  // Cadre intérieur (double trait)
  doc.setLineWidth(0.2);
  doc.rect(margin + 2, margin + 2, width - 2 * margin - 4, height - 2 * margin - 4);
}

/**
 * Dessine une grille de fond
 */
function drawGrid(doc: jsPDF, area: { x: number; y: number; width: number; height: number }, spacing: number): void {
  doc.setLineWidth(0.1);
  doc.setDrawColor(200, 200, 200);
  
  // Lignes verticales
  for (let x = area.x; x <= area.x + area.width; x += spacing) {
    doc.line(x, area.y, x, area.y + area.height);
  }
  
  // Lignes horizontales
  for (let y = area.y; y <= area.y + area.height; y += spacing) {
    doc.line(area.x, y, area.x + area.width, y);
  }
}

/**
 * Dessine les géométries du sketch
 */
function drawGeometries(
  doc: jsPDF,
  sketch: Sketch,
  transform: (x: number, y: number) => { x: number; y: number },
  opts: PDFExportOptions
): void {
  doc.setDrawColor(0, 0, 0);
  
  sketch.geometries.forEach((geo) => {
    // Ignorer les lignes de construction
    if ((geo as any).isConstruction) {
      doc.setDrawColor(128, 128, 128);
      doc.setLineDashPattern([2, 2], 0);
    } else {
      doc.setDrawColor(0, 0, 0);
      doc.setLineDashPattern([], 0);
    }
    
    // Épaisseur personnalisée
    const strokeWidth = (geo as any).strokeWidth || opts.lineWidth;
    doc.setLineWidth(strokeWidth * 0.3);
    
    if (geo.type === "line") {
      const line = geo as Line;
      const p1 = sketch.points.get(line.p1);
      const p2 = sketch.points.get(line.p2);
      if (p1 && p2) {
        const t1 = transform(p1.x, p1.y);
        const t2 = transform(p2.x, p2.y);
        doc.line(t1.x, t1.y, t2.x, t2.y);
      }
    } else if (geo.type === "circle") {
      const circle = geo as Circle;
      const center = sketch.points.get(circle.center);
      if (center) {
        const tc = transform(center.x, center.y);
        // Calculer le rayon transformé
        const edge = transform(center.x + circle.radius, center.y);
        const radius = Math.abs(edge.x - tc.x);
        doc.circle(tc.x, tc.y, radius);
      }
    } else if (geo.type === "arc") {
      const arc = geo as Arc;
      const center = sketch.points.get(arc.center);
      const startPt = sketch.points.get(arc.startPoint);
      const endPt = sketch.points.get(arc.endPoint);
      if (center && startPt && endPt) {
        const tc = transform(center.x, center.y);
        const ts = transform(startPt.x, startPt.y);
        const te = transform(endPt.x, endPt.y);
        
        // Calculer le rayon transformé
        const edge = transform(center.x + arc.radius, center.y);
        const radius = Math.abs(edge.x - tc.x);
        
        // Calculer les angles
        let startAngle = Math.atan2(ts.y - tc.y, ts.x - tc.x) * 180 / Math.PI;
        let endAngle = Math.atan2(te.y - tc.y, te.x - tc.x) * 180 / Math.PI;
        
        // jsPDF utilise des angles en degrés, sens anti-horaire
        // Dessiner l'arc avec des segments de ligne (approximation)
        drawArcApprox(doc, tc.x, tc.y, radius, startAngle, endAngle, arc.counterClockwise);
      }
    } else if (geo.type === "bezier") {
      const bezier = geo as Bezier;
      const p1 = sketch.points.get(bezier.p1);
      const p2 = sketch.points.get(bezier.p2);
      const cp1 = sketch.points.get(bezier.cp1);
      const cp2 = sketch.points.get(bezier.cp2);
      if (p1 && p2 && cp1 && cp2) {
        const t1 = transform(p1.x, p1.y);
        const t2 = transform(p2.x, p2.y);
        const tc1 = transform(cp1.x, cp1.y);
        const tc2 = transform(cp2.x, cp2.y);
        
        // Dessiner la courbe de Bézier avec des segments
        drawBezierApprox(doc, t1, tc1, tc2, t2);
      }
    } else if (geo.type === "spline") {
      const spline = geo as Spline;
      const points: { x: number; y: number }[] = [];
      spline.points.forEach((ptId) => {
        const pt = sketch.points.get(ptId);
        if (pt) {
          points.push(transform(pt.x, pt.y));
        }
      });
      if (points.length >= 2) {
        drawSplineApprox(doc, points, spline.tension || 0.5, spline.closed || false);
      }
    }
  });
  
  // Reset
  doc.setLineDashPattern([], 0);
  doc.setLineWidth(opts.lineWidth);
}

/**
 * Approximation d'un arc avec des segments
 */
function drawArcApprox(
  doc: jsPDF,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  counterClockwise?: boolean
): void {
  const segments = 32;
  
  // Normaliser les angles
  let start = startAngle * Math.PI / 180;
  let end = endAngle * Math.PI / 180;
  
  // Calculer le sweep
  let sweep = end - start;
  if (counterClockwise) {
    if (sweep > 0) sweep -= 2 * Math.PI;
  } else {
    if (sweep < 0) sweep += 2 * Math.PI;
  }
  
  // Dessiner les segments
  let prevX = cx + radius * Math.cos(start);
  let prevY = cy + radius * Math.sin(start);
  
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const angle = start + sweep * t;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    doc.line(prevX, prevY, x, y);
    prevX = x;
    prevY = y;
  }
}

/**
 * Approximation d'une courbe de Bézier
 */
function drawBezierApprox(
  doc: jsPDF,
  p1: { x: number; y: number },
  cp1: { x: number; y: number },
  cp2: { x: number; y: number },
  p2: { x: number; y: number }
): void {
  const segments = 20;
  let prevX = p1.x;
  let prevY = p1.y;
  
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    
    const x = mt3 * p1.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p2.x;
    const y = mt3 * p1.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p2.y;
    
    doc.line(prevX, prevY, x, y);
    prevX = x;
    prevY = y;
  }
}

/**
 * Approximation d'une spline Catmull-Rom
 */
function drawSplineApprox(
  doc: jsPDF,
  points: { x: number; y: number }[],
  tension: number,
  closed: boolean
): void {
  if (points.length < 2) return;
  
  const segments = 10;
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(points.length - 1, i + 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    
    let prevX = p1.x;
    let prevY = p1.y;
    
    for (let j = 1; j <= segments; j++) {
      const t = j / segments;
      const t2 = t * t;
      const t3 = t2 * t;
      
      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      );
      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      );
      
      doc.line(prevX, prevY, x, y);
      prevX = x;
      prevY = y;
    }
  }
}

/**
 * Dessine les cotations
 */
function drawDimensions(
  doc: jsPDF,
  sketch: Sketch,
  transform: (x: number, y: number) => { x: number; y: number },
  opts: PDFExportOptions,
  fitScale: number
): void {
  doc.setDrawColor(0, 100, 200);
  doc.setTextColor(0, 100, 200);
  doc.setFontSize(8);
  doc.setLineWidth(0.15);
  
  sketch.dimensions.forEach((dim) => {
    if (dim.type === "length") {
      const geo = sketch.geometries.get(dim.entityId);
      if (geo?.type === "line") {
        const line = geo as Line;
        const p1 = sketch.points.get(line.p1);
        const p2 = sketch.points.get(line.p2);
        if (p1 && p2) {
          const t1 = transform(p1.x, p1.y);
          const t2 = transform(p2.x, p2.y);
          drawLengthDimension(doc, t1, t2, dim.value, opts.scale);
        }
      }
    } else if (dim.type === "radius") {
      const geo = sketch.geometries.get(dim.entityId);
      if (geo?.type === "circle") {
        const circle = geo as Circle;
        const center = sketch.points.get(circle.center);
        if (center) {
          const tc = transform(center.x, center.y);
          const edge = transform(center.x + circle.radius, center.y);
          const radius = Math.abs(edge.x - tc.x);
          drawRadiusDimension(doc, tc, radius, dim.value);
        }
      }
    }
  });
  
  // Reset
  doc.setDrawColor(0, 0, 0);
  doc.setTextColor(0, 0, 0);
}

/**
 * Dessine une cotation de longueur
 */
function drawLengthDimension(
  doc: jsPDF,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  value: number,
  scale: number
): void {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  
  // Direction perpendiculaire
  const perpX = -dy / len;
  const perpY = dx / len;
  const offset = 5;
  
  // Points de la ligne de cote
  const d1 = { x: p1.x + perpX * offset, y: p1.y + perpY * offset };
  const d2 = { x: p2.x + perpX * offset, y: p2.y + perpY * offset };
  
  // Lignes d'attache
  doc.line(p1.x, p1.y, d1.x + perpX * 1, d1.y + perpY * 1);
  doc.line(p2.x, p2.y, d2.x + perpX * 1, d2.y + perpY * 1);
  
  // Ligne de cote
  doc.line(d1.x, d1.y, d2.x, d2.y);
  
  // Flèches
  const arrowLen = 2;
  const arrowAngle = Math.PI / 6;
  const angle = Math.atan2(dy, dx);
  
  // Flèche 1
  doc.line(d1.x, d1.y, 
    d1.x + arrowLen * Math.cos(angle + arrowAngle),
    d1.y + arrowLen * Math.sin(angle + arrowAngle));
  doc.line(d1.x, d1.y,
    d1.x + arrowLen * Math.cos(angle - arrowAngle),
    d1.y + arrowLen * Math.sin(angle - arrowAngle));
  
  // Flèche 2
  doc.line(d2.x, d2.y,
    d2.x - arrowLen * Math.cos(angle + arrowAngle),
    d2.y - arrowLen * Math.sin(angle + arrowAngle));
  doc.line(d2.x, d2.y,
    d2.x - arrowLen * Math.cos(angle - arrowAngle),
    d2.y - arrowLen * Math.sin(angle - arrowAngle));
  
  // Texte
  const midX = (d1.x + d2.x) / 2;
  const midY = (d1.y + d2.y) / 2;
  const realValue = value * scale;
  const text = `${realValue.toFixed(1)}`;
  doc.text(text, midX, midY - 1, { align: "center" });
}

/**
 * Dessine une cotation de rayon
 */
function drawRadiusDimension(
  doc: jsPDF,
  center: { x: number; y: number },
  radius: number,
  value: number
): void {
  // Ligne du centre vers le bord à 45°
  const angle = Math.PI / 4;
  const endX = center.x + radius * Math.cos(angle);
  const endY = center.y + radius * Math.sin(angle);
  
  doc.line(center.x, center.y, endX, endY);
  
  // Texte
  const text = `R${value.toFixed(1)}`;
  doc.text(text, endX + 2, endY - 1);
}

/**
 * Dessine l'échelle graphique
 */
function drawScaleBar(
  doc: jsPDF,
  area: { x: number; y: number; width: number; height: number },
  scale: number,
  fitScale: number
): void {
  const barY = area.y + area.height + 5;
  const barX = area.x;
  
  // Déterminer une longueur "ronde" pour l'échelle
  const targetLengthMm = 50; // 50mm sur le papier
  const realLength = targetLengthMm * scale / fitScale;
  
  // Arrondir à une valeur "propre"
  const roundedLength = roundToNice(realLength);
  const barWidth = (roundedLength / scale) * fitScale;
  
  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(0, 0, 0);
  
  // Barre principale
  doc.rect(barX, barY, barWidth, 2);
  
  // Alternance noir/blanc
  const segments = 5;
  const segmentWidth = barWidth / segments;
  for (let i = 0; i < segments; i++) {
    if (i % 2 === 0) {
      doc.rect(barX + i * segmentWidth, barY, segmentWidth, 2, "F");
    }
  }
  
  // Graduations et texte
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  
  doc.text("0", barX, barY + 5, { align: "center" });
  doc.text(`${roundedLength} mm`, barX + barWidth, barY + 5, { align: "center" });
  
  // Indication de l'échelle
  const scaleText = scale === 1 ? "Échelle 1:1" : `Échelle 1:${scale}`;
  doc.text(scaleText, barX + barWidth / 2, barY + 8, { align: "center" });
}

/**
 * Arrondit à une valeur "propre" (10, 20, 50, 100, etc.)
 */
function roundToNice(value: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  
  if (normalized < 1.5) return magnitude;
  if (normalized < 3.5) return 2 * magnitude;
  if (normalized < 7.5) return 5 * magnitude;
  return 10 * magnitude;
}

/**
 * Dessine le cartouche professionnel
 */
function drawCartouche(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  opts: PDFExportOptions
): void {
  const margin = opts.margin;
  const cartoucheY = pageHeight - margin - CARTOUCHE_HEIGHT;
  const cartoucheWidth = pageWidth - 2 * margin;
  
  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0);
  
  // Cadre principal du cartouche
  doc.rect(margin, cartoucheY, cartoucheWidth, CARTOUCHE_HEIGHT);
  
  // Séparation horizontale (haut du cartouche)
  doc.line(margin, cartoucheY, margin + cartoucheWidth, cartoucheY);
  
  // Colonnes du cartouche
  // | Logo/Entreprise | Titre du plan | Échelle | Rév | Date |
  const col1 = margin;
  const col2 = margin + 50;
  const col3 = pageWidth - margin - 80;
  const col4 = pageWidth - margin - 50;
  const col5 = pageWidth - margin - 25;
  
  // Lignes verticales
  doc.line(col2, cartoucheY, col2, pageHeight - margin);
  doc.line(col3, cartoucheY, col3, pageHeight - margin);
  doc.line(col4, cartoucheY, col4, pageHeight - margin);
  doc.line(col5, cartoucheY, col5, pageHeight - margin);
  
  // Ligne horizontale milieu
  const midY = cartoucheY + CARTOUCHE_HEIGHT / 2;
  doc.line(col2, midY, pageWidth - margin, midY);
  
  // Textes
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  
  // Labels (petits)
  doc.text("PROJET", col2 + 2, cartoucheY + 4);
  doc.text("TITRE", col2 + 2, midY + 4);
  doc.text("ÉCHELLE", col3 + 2, cartoucheY + 4);
  doc.text("RÉV.", col4 + 2, cartoucheY + 4);
  doc.text("DATE", col5 + 2, cartoucheY + 4);
  doc.text("DESSINÉ PAR", col3 + 2, midY + 4);
  
  // Valeurs (plus grandes)
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  // Zone entreprise/logo
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("VAN PROJECT", col1 + 25, cartoucheY + 12, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("BUDDY", col1 + 25, cartoucheY + 18, { align: "center" });
  doc.text("Alsace Van Création", col1 + 25, cartoucheY + 24, { align: "center" });
  
  // Projet
  doc.setFontSize(9);
  if (opts.projectName) {
    doc.text(opts.projectName, col2 + 2, cartoucheY + 11);
  }
  
  // Titre
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title, col2 + 2, midY + 12);
  doc.setFont("helvetica", "normal");
  
  // Échelle
  doc.setFontSize(10);
  const scaleText = opts.scale === 1 ? "1:1" : `1:${opts.scale}`;
  doc.text(scaleText, col3 + 14, cartoucheY + 11, { align: "center" });
  
  // Révision
  doc.text(opts.revision || "A", col4 + 12.5, cartoucheY + 11, { align: "center" });
  
  // Date
  doc.setFontSize(8);
  doc.text(opts.date || "", col5 + 12.5, cartoucheY + 11, { align: "center" });
  
  // Auteur
  doc.setFontSize(9);
  doc.text(opts.author || "", col3 + 2, midY + 12);
}
