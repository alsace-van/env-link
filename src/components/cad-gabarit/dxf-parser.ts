// ============================================
// DXF PARSER: Import de fichiers DXF
// Parse les fichiers DXF et convertit en format interne
// VERSION: 3.4 - Résolution dynamique améliorée (4-16 segments selon taille)
// ============================================

import { Point, Line, Circle, Geometry, TextAnnotation, generateId } from "./types";

// Types DXF internes
interface DXFEntity {
  type: string;
  layer?: string;
  // Stocker TOUTES les valeurs pour chaque code (pas juste la dernière)
  values: Map<number, number[]>;
  strings: Map<number, string[]>;
}

interface DXFParseResult {
  points: Map<string, Point>;
  geometries: Map<string, Geometry>;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  layers: string[];
  entityCount: number;
}

// Nombre de segments pour approximer les courbes
// Résolution dynamique selon la taille
const SPLINE_RESOLUTION_MIN = 4; // Petites splines (texte)
const SPLINE_RESOLUTION_MAX = 16; // Grandes splines (contours)
const ARC_SEGMENTS = 12;

/**
 * Parse un fichier DXF et retourne les entités géométriques
 */
export function parseDXF(content: string): DXFParseResult {
  const lines = content.split(/\r?\n/);
  const entities: DXFEntity[] = [];
  const layersSet = new Set<string>();

  let i = 0;
  let inEntitiesSection = false;
  let currentPolyline: DXFEntity | null = null; // Pour collecter les VERTEX des anciennes POLYLINE

  // Parcourir le fichier DXF
  while (i < lines.length) {
    const code = parseInt(lines[i]?.trim() || "0", 10);
    const value = lines[i + 1]?.trim() || "";

    // Détecter la section ENTITIES
    if (code === 2 && value === "ENTITIES") {
      inEntitiesSection = true;
      i += 2;
      continue;
    }

    // Fin de section
    if (code === 0 && value === "ENDSEC") {
      inEntitiesSection = false;
      // Finaliser la polyline en cours si existante
      if (currentPolyline) {
        entities.push(currentPolyline);
        currentPolyline = null;
      }
      i += 2;
      continue;
    }

    // Parser les entités
    if (inEntitiesSection && code === 0) {
      const entityType = value;

      // Gérer SEQEND (fin de POLYLINE avec VERTEX)
      if (entityType === "SEQEND") {
        if (currentPolyline) {
          entities.push(currentPolyline);
          currentPolyline = null;
        }
        i += 2;
        continue;
      }

      // Gérer VERTEX (points d'une POLYLINE classique)
      if (entityType === "VERTEX" && currentPolyline) {
        i += 2;
        // Lire les attributs du VERTEX
        while (i < lines.length) {
          const attrCode = parseInt(lines[i]?.trim() || "0", 10);
          const attrValue = lines[i + 1]?.trim() || "";
          if (attrCode === 0) break;

          const numValue = parseFloat(attrValue);
          if (!isNaN(numValue)) {
            // Code 10 = X, 20 = Y, 42 = bulge
            const existing = currentPolyline.values.get(attrCode) || [];
            existing.push(numValue);
            currentPolyline.values.set(attrCode, existing);
          }
          i += 2;
        }
        continue;
      }

      // Si on rencontre une autre entité alors qu'on collectait une POLYLINE, la finaliser
      if (currentPolyline && entityType !== "VERTEX") {
        entities.push(currentPolyline);
        currentPolyline = null;
      }

      // Entités supportées (géométrie + texte)
      const supportedTypes = ["LINE", "CIRCLE", "ARC", "LWPOLYLINE", "POLYLINE", "SPLINE", "ELLIPSE", "TEXT", "MTEXT"];

      if (supportedTypes.includes(entityType)) {
        const entity: DXFEntity = {
          type: entityType,
          values: new Map(),
          strings: new Map(),
        };

        i += 2;

        // Lire les attributs de l'entité jusqu'à la prochaine entité ou fin de section
        while (i < lines.length) {
          const attrCode = parseInt(lines[i]?.trim() || "0", 10);
          const attrValue = lines[i + 1]?.trim() || "";

          // Nouvelle entité ou fin de section
          if (attrCode === 0) {
            break;
          }

          // Calque
          if (attrCode === 8) {
            entity.layer = attrValue;
            layersSet.add(attrValue);
          }

          // Stocker les données - TOUJOURS ajouter au tableau
          const numValue = parseFloat(attrValue);
          if (!isNaN(numValue)) {
            const existing = entity.values.get(attrCode) || [];
            existing.push(numValue);
            entity.values.set(attrCode, existing);
          } else {
            const existing = entity.strings.get(attrCode) || [];
            existing.push(attrValue);
            entity.strings.set(attrCode, existing);
          }

          i += 2;
        }

        // Pour les anciennes POLYLINE (pas LWPOLYLINE), les coordonnées sont dans les VERTEX qui suivent
        if (entityType === "POLYLINE") {
          currentPolyline = entity;
          // Ne pas ajouter tout de suite, on attend les VERTEX
        } else {
          entities.push(entity);
        }
        continue;
      } else if (entityType !== "ENDSEC" && entityType !== "SEQEND" && entityType !== "VERTEX") {
        // Log les entités non supportées (ignorer les types de contrôle)
        console.warn(`[DXF Parser] Entité non supportée ignorée: ${entityType}`);
      }
    }

    i += 2;
  }

  // Convertir les entités DXF en format interne
  return convertDXFEntities(entities, Array.from(layersSet));
}

/**
 * Algorithme de De Boor pour évaluer une B-spline
 * @param t - Paramètre (0 à 1 normalisé)
 * @param degree - Degré de la spline
 * @param knots - Vecteur de noeuds
 * @param controlPoints - Points de contrôle
 */
function deBoor(
  t: number,
  degree: number,
  knots: number[],
  controlPoints: { x: number; y: number }[],
): { x: number; y: number } {
  const n = controlPoints.length - 1;

  // Trouver l'intervalle de knot
  let k = degree;
  while (k < n && knots[k + 1] <= t) {
    k++;
  }

  // Copier les points de contrôle pertinents
  const d: { x: number; y: number }[] = [];
  for (let j = 0; j <= degree; j++) {
    const idx = Math.max(0, Math.min(n, k - degree + j));
    d.push({ x: controlPoints[idx].x, y: controlPoints[idx].y });
  }

  // Algorithme de De Boor
  for (let r = 1; r <= degree; r++) {
    for (let j = degree; j >= r; j--) {
      const i = k - degree + j;
      const knotLeft = knots[i] || 0;
      const knotRight = knots[i + degree - r + 1] || 1;

      let alpha = 0;
      if (Math.abs(knotRight - knotLeft) > 1e-10) {
        alpha = (t - knotLeft) / (knotRight - knotLeft);
      }

      d[j] = {
        x: (1 - alpha) * d[j - 1].x + alpha * d[j].x,
        y: (1 - alpha) * d[j - 1].y + alpha * d[j].y,
      };
    }
  }

  return d[degree];
}

/**
 * Génère des points uniformes sur une B-spline
 */
function evaluateBSpline(
  degree: number,
  knots: number[],
  controlPoints: { x: number; y: number }[],
  numPoints: number,
): { x: number; y: number }[] {
  if (controlPoints.length < 2) return controlPoints;
  if (knots.length === 0) {
    // Générer des knots uniformes si absents
    const n = controlPoints.length;
    const numKnots = n + degree + 1;
    knots = [];
    for (let i = 0; i < numKnots; i++) {
      if (i <= degree) knots.push(0);
      else if (i >= numKnots - degree - 1) knots.push(1);
      else knots.push((i - degree) / (numKnots - 2 * degree - 1));
    }
  }

  const result: { x: number; y: number }[] = [];
  const tMin = knots[degree] || 0;
  const tMax = knots[knots.length - degree - 1] || 1;

  for (let i = 0; i <= numPoints; i++) {
    const t = tMin + (tMax - tMin) * (i / numPoints);
    // Éviter les valeurs exactement sur les knots de fin
    const tClamped = Math.min(t, tMax - 1e-10);
    result.push(deBoor(tClamped, degree, knots, controlPoints));
  }

  return result;
}

/**
 * Calcule les points d'un arc à partir du bulge (polyline)
 * bulge = tan(angle/4)
 */
function arcFromBulge(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  bulge: number,
  numSegments: number,
): { x: number; y: number }[] {
  if (Math.abs(bulge) < 0.0001) {
    return [];
  }

  const points: { x: number; y: number }[] = [];

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.0001) return [];

  // Angle de l'arc
  const angle = 4 * Math.atan(Math.abs(bulge));

  // Rayon
  const radius = dist / (2 * Math.sin(angle / 2));

  // Centre de l'arc
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;

  const perpX = -dy / dist;
  const perpY = dx / dist;

  const h = Math.sqrt(Math.max(0, radius * radius - (dist / 2) * (dist / 2)));

  const sign = bulge > 0 ? 1 : -1;
  const cx = mx + sign * h * perpX;
  const cy = my + sign * h * perpY;

  // Angles
  const startAngle = Math.atan2(p1.y - cy, p1.x - cx);
  const endAngle = Math.atan2(p2.y - cy, p2.x - cx);

  // Générer les points
  for (let i = 1; i < numSegments; i++) {
    const t = i / numSegments;
    let currentAngle;

    if (bulge > 0) {
      let delta = endAngle - startAngle;
      if (delta < 0) delta += 2 * Math.PI;
      currentAngle = startAngle + delta * t;
    } else {
      let delta = startAngle - endAngle;
      if (delta < 0) delta += 2 * Math.PI;
      currentAngle = startAngle - delta * t;
    }

    points.push({
      x: cx + radius * Math.cos(currentAngle),
      y: cy + radius * Math.sin(currentAngle),
    });
  }

  return points;
}

/**
 * Convertit les entités DXF en format interne
 */
function convertDXFEntities(entities: DXFEntity[], layers: string[]): DXFParseResult {
  const points = new Map<string, Point>();
  const geometries = new Map<string, Geometry>();

  // Index spatial pour recherche rapide O(1) au lieu de O(n)
  const pointIndex = new Map<string, string>();

  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;

  // Helper pour créer ou récupérer un point (Y inversé)
  // Optimisé avec index spatial
  const getOrCreatePoint = (x: number, y: number): string => {
    const rx = Math.round(x * 100) / 100; // Réduit précision pour moins de points
    const ry = Math.round(-y * 100) / 100; // Y inversé

    // Clé spatiale pour recherche O(1)
    const key = `${rx},${ry}`;
    const existingId = pointIndex.get(key);
    if (existingId) {
      return existingId;
    }

    const id = generateId();
    points.set(id, { id, x: rx, y: ry });
    pointIndex.set(key, id);

    minX = Math.min(minX, rx);
    minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx);
    maxY = Math.max(maxY, ry);

    return id;
  };

  // Helper pour créer une ligne
  const createLine = (x1: number, y1: number, x2: number, y2: number, layer: string): void => {
    // Éviter les lignes de longueur nulle
    if (Math.abs(x1 - x2) < 0.0001 && Math.abs(y1 - y2) < 0.0001) return;

    const p1Id = getOrCreatePoint(x1, y1);
    const p2Id = getOrCreatePoint(x2, y2);

    const lineId = generateId();
    const line: Line = {
      id: lineId,
      type: "line",
      p1: p1Id,
      p2: p2Id,
      layerId: layer,
    };
    geometries.set(lineId, line);
  };

  // Helper pour obtenir la première valeur d'un code
  const getVal = (entity: DXFEntity, code: number): number | undefined => {
    const arr = entity.values.get(code);
    return arr && arr.length > 0 ? arr[0] : undefined;
  };

  // Helper pour obtenir toutes les valeurs d'un code
  const getAllVals = (entity: DXFEntity, code: number): number[] => {
    return entity.values.get(code) || [];
  };

  for (const entity of entities) {
    const layerId = entity.layer || "trace";

    switch (entity.type) {
      case "LINE": {
        const x1 = getVal(entity, 10);
        const y1 = getVal(entity, 20);
        const x2 = getVal(entity, 11);
        const y2 = getVal(entity, 21);

        if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
          createLine(x1, y1, x2, y2, layerId);
        }
        break;
      }

      case "CIRCLE": {
        const cx = getVal(entity, 10);
        const cy = getVal(entity, 20);
        const radius = getVal(entity, 40);

        if (cx !== undefined && cy !== undefined && radius !== undefined) {
          const centerId = getOrCreatePoint(cx, cy);

          const cyInverted = -cy;
          minX = Math.min(minX, cx - radius);
          minY = Math.min(minY, cyInverted - radius);
          maxX = Math.max(maxX, cx + radius);
          maxY = Math.max(maxY, cyInverted + radius);

          const circleId = generateId();
          const circle: Circle = {
            id: circleId,
            type: "circle",
            center: centerId,
            radius: radius,
            layerId: layerId,
          };
          geometries.set(circleId, circle);
        }
        break;
      }

      case "ARC": {
        const cx = getVal(entity, 10);
        const cy = getVal(entity, 20);
        const radius = getVal(entity, 40);
        const startAngleDeg = getVal(entity, 50) || 0;
        const endAngleDeg = getVal(entity, 51) || 360;

        if (cx !== undefined && cy !== undefined && radius !== undefined) {
          const startAngle = (startAngleDeg * Math.PI) / 180;
          const endAngle = (endAngleDeg * Math.PI) / 180;

          let angle = endAngle - startAngle;
          if (angle < 0) angle += 2 * Math.PI;

          const numSegments = Math.max(8, Math.ceil(angle / (Math.PI / 12)));

          let prevX = cx + radius * Math.cos(startAngle);
          let prevY = cy + radius * Math.sin(startAngle);

          for (let i = 1; i <= numSegments; i++) {
            const t = i / numSegments;
            const currentAngle = startAngle + angle * t;
            const currX = cx + radius * Math.cos(currentAngle);
            const currY = cy + radius * Math.sin(currentAngle);

            createLine(prevX, prevY, currX, currY, layerId);

            prevX = currX;
            prevY = currY;
          }
        }
        break;
      }

      case "LWPOLYLINE": {
        const xs = getAllVals(entity, 10);
        const ys = getAllVals(entity, 20);
        const bulges = getAllVals(entity, 42);
        const flags = getVal(entity, 70) || 0;

        if (xs.length >= 2 && xs.length === ys.length) {
          for (let j = 0; j < xs.length - 1; j++) {
            const p1 = { x: xs[j], y: ys[j] };
            const p2 = { x: xs[j + 1], y: ys[j + 1] };
            const bulge = bulges[j] || 0;

            if (Math.abs(bulge) > 0.0001) {
              const arcPoints = arcFromBulge(p1, p2, bulge, ARC_SEGMENTS);

              let prevPoint = p1;
              for (const arcPoint of arcPoints) {
                createLine(prevPoint.x, prevPoint.y, arcPoint.x, arcPoint.y, layerId);
                prevPoint = arcPoint;
              }
              createLine(prevPoint.x, prevPoint.y, p2.x, p2.y, layerId);
            } else {
              createLine(p1.x, p1.y, p2.x, p2.y, layerId);
            }
          }

          // Fermer si flag 1
          if (flags & 1 && xs.length > 2) {
            const p1 = { x: xs[xs.length - 1], y: ys[ys.length - 1] };
            const p2 = { x: xs[0], y: ys[0] };
            const bulge = bulges[xs.length - 1] || 0;

            if (Math.abs(bulge) > 0.0001) {
              const arcPoints = arcFromBulge(p1, p2, bulge, ARC_SEGMENTS);
              let prevPoint = p1;
              for (const arcPoint of arcPoints) {
                createLine(prevPoint.x, prevPoint.y, arcPoint.x, arcPoint.y, layerId);
                prevPoint = arcPoint;
              }
              createLine(prevPoint.x, prevPoint.y, p2.x, p2.y, layerId);
            } else {
              createLine(p1.x, p1.y, p2.x, p2.y, layerId);
            }
          }
        }
        break;
      }

      case "SPLINE": {
        // Codes DXF pour SPLINE:
        // 71 = degré
        // 72 = nombre de knots
        // 73 = nombre de points de contrôle
        // 74 = nombre de fit points
        // 40 = valeurs des knots (multiples)
        // 10, 20 = points de contrôle (multiples)
        // 11, 21 = fit points (multiples, optionnel)

        const degree = getVal(entity, 71) || 3;
        const knots = getAllVals(entity, 40);
        const ctrlXs = getAllVals(entity, 10);
        const ctrlYs = getAllVals(entity, 20);
        const fitXs = getAllVals(entity, 11);
        const fitYs = getAllVals(entity, 21);

        // Utiliser les fit points s'ils existent (ils sont SUR la courbe)
        if (fitXs.length >= 2 && fitXs.length === fitYs.length) {
          // Les fit points sont directement sur la courbe
          for (let i = 0; i < fitXs.length - 1; i++) {
            createLine(fitXs[i], fitYs[i], fitXs[i + 1], fitYs[i + 1], layerId);
          }
        }
        // Sinon utiliser l'algorithme B-spline avec les points de contrôle
        else if (ctrlXs.length >= 2 && ctrlXs.length === ctrlYs.length) {
          const controlPoints = ctrlXs.map((x, i) => ({ x, y: ctrlYs[i] }));

          // Calcul dynamique de la résolution basé sur la taille de la spline
          const splineMinX = Math.min(...ctrlXs);
          const splineMaxX = Math.max(...ctrlXs);
          const splineMinY = Math.min(...ctrlYs);
          const splineMaxY = Math.max(...ctrlYs);
          const splineSize = Math.max(splineMaxX - splineMinX, splineMaxY - splineMinY);

          // Résolution proportionnelle à la taille:
          // < 3mm = 4 segments (petits détails, texte cursif)
          // 3-10mm = 6 segments
          // 10-30mm = 10 segments
          // > 30mm = 16 segments (grandes courbes comme contour van)
          let resolution: number;
          if (splineSize < 3) resolution = SPLINE_RESOLUTION_MIN;
          else if (splineSize < 10) resolution = 6;
          else if (splineSize < 30) resolution = 10;
          else resolution = SPLINE_RESOLUTION_MAX;

          // Évaluer la B-spline
          const curvePoints = evaluateBSpline(degree, knots, controlPoints, resolution);

          // Créer les segments
          for (let i = 0; i < curvePoints.length - 1; i++) {
            createLine(curvePoints[i].x, curvePoints[i].y, curvePoints[i + 1].x, curvePoints[i + 1].y, layerId);
          }
        }
        break;
      }

      case "ELLIPSE": {
        const cx = getVal(entity, 10);
        const cy = getVal(entity, 20);
        const majorX = getVal(entity, 11);
        const majorY = getVal(entity, 21);
        const ratio = getVal(entity, 40) || 1;
        const startParam = getVal(entity, 41) || 0;
        const endParam = getVal(entity, 42) || 2 * Math.PI;

        if (cx !== undefined && cy !== undefined && majorX !== undefined && majorY !== undefined) {
          const majorRadius = Math.sqrt(majorX * majorX + majorY * majorY);
          const minorRadius = majorRadius * ratio;
          const rotation = Math.atan2(majorY, majorX);

          const numSegments = 24; // Réduit de 48
          let angle = endParam - startParam;
          if (angle < 0) angle += 2 * Math.PI;

          let prevX =
            cx +
            majorRadius * Math.cos(startParam) * Math.cos(rotation) -
            minorRadius * Math.sin(startParam) * Math.sin(rotation);
          let prevY =
            cy +
            majorRadius * Math.cos(startParam) * Math.sin(rotation) +
            minorRadius * Math.sin(startParam) * Math.cos(rotation);

          for (let i = 1; i <= numSegments; i++) {
            const t = i / numSegments;
            const param = startParam + angle * t;
            const currX =
              cx +
              majorRadius * Math.cos(param) * Math.cos(rotation) -
              minorRadius * Math.sin(param) * Math.sin(rotation);
            const currY =
              cy +
              majorRadius * Math.cos(param) * Math.sin(rotation) +
              minorRadius * Math.sin(param) * Math.cos(rotation);

            createLine(prevX, prevY, currX, currY, layerId);

            prevX = currX;
            prevY = currY;
          }
        }
        break;
      }

      case "TEXT":
      case "MTEXT": {
        // DXF TEXT: 10=x, 20=y, 40=height, 1=content, 50=rotation
        // DXF MTEXT: 10=x, 20=y, 40=height, 1=content (peut contenir formatage)
        const x = getVal(entity, 10);
        const y = getVal(entity, 20);
        const height = getVal(entity, 40) || 3; // Hauteur par défaut 3mm
        const rotation = getVal(entity, 50) || 0;

        // Le texte est stocké en code 1 (peut y avoir plusieurs lignes pour MTEXT)
        const textParts = entity.strings.get(1) || [];
        let content = textParts.join("");

        // Nettoyer le formatage MTEXT (\\P = saut de ligne, {\\f...} = police, etc.)
        content = content
          .replace(/\\P/g, "\n")
          .replace(/\{\\[^}]+\}/g, "")
          .replace(/\\[A-Za-z][^;]*;/g, "")
          .trim();

        if (x !== undefined && y !== undefined && content) {
          // Créer un point d'ancrage pour le texte
          const positionId = getOrCreatePoint(x, y);

          const textId = generateId();
          const textAnnotation: TextAnnotation = {
            id: textId,
            type: "text",
            position: positionId,
            content,
            fontSize: height,
            rotation: -rotation, // Inverser car Y est inversé
            layerId: layerId,
            alignment: "left",
          };
          geometries.set(textId, textAnnotation);

          console.log(`[DXF] Texte importé: "${content}" à (${x}, ${y}), hauteur=${height}mm`);
        }
        break;
      }
    }
  }

  // Log un résumé des entités traitées
  console.log(`[DXF Parser] Résumé: ${geometries.size} géométries, ${points.size} points importés`);

  return {
    points,
    geometries,
    bounds: {
      minX: minX === Infinity ? 0 : minX,
      minY: minY === Infinity ? 0 : minY,
      maxX: maxX === -Infinity ? 100 : maxX,
      maxY: maxY === -Infinity ? 100 : maxY,
    },
    layers,
    entityCount: geometries.size,
  };
}

/**
 * Charge un fichier DXF depuis un File
 */
export async function loadDXFFile(file: File): Promise<DXFParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const result = parseDXF(content);
        resolve(result);
      } catch (error) {
        reject(new Error(`Erreur lors du parsing DXF: ${error}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("Erreur lors de la lecture du fichier"));
    };

    reader.readAsText(file);
  });
}

export type { DXFParseResult };
