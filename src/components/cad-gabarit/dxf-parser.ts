// ============================================
// DXF PARSER: Import de fichiers DXF
// Parse les fichiers DXF et convertit en format interne
// VERSION: 2.0 - Support amélioré des courbes (SPLINE, ARC, LWPOLYLINE avec bulge)
// ============================================

import { Point, Line, Circle, Arc, Geometry, generateId } from "./types";

// Types DXF internes
interface DXFEntity {
  type: string;
  layer?: string;
  numericData: Map<number, number>;
  stringData: Map<number, string>;
  arrayData: Map<number, number[]>;
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
const SPLINE_SEGMENTS = 20;
const ARC_SEGMENTS = 16;

/**
 * Parse un fichier DXF et retourne les entités géométriques
 */
export function parseDXF(content: string): DXFParseResult {
  const lines = content.split(/\r?\n/);
  const entities: DXFEntity[] = [];
  const layersSet = new Set<string>();

  let i = 0;
  let inEntitiesSection = false;

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
      i += 2;
      continue;
    }

    // Parser les entités
    if (inEntitiesSection && code === 0) {
      const entityType = value;

      if (["LINE", "CIRCLE", "ARC", "LWPOLYLINE", "POLYLINE", "SPLINE", "ELLIPSE"].includes(entityType)) {
        const entity: DXFEntity = {
          type: entityType,
          numericData: new Map(),
          stringData: new Map(),
          arrayData: new Map(),
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

          // Stocker les données
          const numValue = parseFloat(attrValue);
          if (!isNaN(numValue)) {
            // Pour les polylignes et splines, gérer les valeurs multiples
            if (entity.numericData.has(attrCode)) {
              // Ajouter au tableau
              const existingArray = entity.arrayData.get(attrCode);
              if (existingArray) {
                existingArray.push(numValue);
              } else {
                const prevValue = entity.numericData.get(attrCode)!;
                entity.arrayData.set(attrCode, [prevValue, numValue]);
              }
            }
            entity.numericData.set(attrCode, numValue);
          } else {
            entity.stringData.set(attrCode, attrValue);
          }

          i += 2;
        }

        entities.push(entity);
        continue;
      }
    }

    i += 2;
  }

  // Convertir les entités DXF en format interne
  return convertDXFEntities(entities, Array.from(layersSet));
}

/**
 * Interpolation de Catmull-Rom spline
 */
function catmullRomPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/**
 * Calcule les points d'un arc à partir du bulge (polyline)
 * bulge = tan(angle/4), où angle est l'angle de l'arc
 */
function arcFromBulge(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  bulge: number,
  numSegments: number,
): { x: number; y: number }[] {
  if (Math.abs(bulge) < 0.0001) {
    return []; // Pas d'arc, juste une ligne droite
  }

  const points: { x: number; y: number }[] = [];

  // Calculer l'angle de l'arc
  const angle = 4 * Math.atan(bulge);

  // Distance entre les deux points
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.0001) return [];

  // Rayon de l'arc
  const radius = Math.abs(dist / (2 * Math.sin(angle / 2)));

  // Milieu du segment
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;

  // Direction perpendiculaire (normalisée)
  const perpX = -dy / dist;
  const perpY = dx / dist;

  // Distance du centre au milieu du segment
  const h = radius * Math.cos(angle / 2);

  // Centre de l'arc (côté dépend du signe du bulge)
  const sign = bulge > 0 ? 1 : -1;
  const cx = mx + sign * h * perpX;
  const cy = my + sign * h * perpY;

  // Angles de départ et d'arrivée
  const startAngle = Math.atan2(p1.y - cy, p1.x - cx);
  const endAngle = Math.atan2(p2.y - cy, p2.x - cx);

  // Générer les points intermédiaires
  for (let i = 1; i < numSegments; i++) {
    const t = i / numSegments;
    let currentAngle;

    if (bulge > 0) {
      // Arc anti-horaire
      let deltaAngle = endAngle - startAngle;
      if (deltaAngle < 0) deltaAngle += 2 * Math.PI;
      currentAngle = startAngle + deltaAngle * t;
    } else {
      // Arc horaire
      let deltaAngle = startAngle - endAngle;
      if (deltaAngle < 0) deltaAngle += 2 * Math.PI;
      currentAngle = startAngle - deltaAngle * t;
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
 * Note: L'axe Y est inversé car DXF utilise Y vers le haut,
 * alors que le canvas utilise Y vers le bas
 */
function convertDXFEntities(entities: DXFEntity[], layers: string[]): DXFParseResult {
  const points = new Map<string, Point>();
  const geometries = new Map<string, Geometry>();

  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;

  // Fonction helper pour créer ou récupérer un point
  // Inverse Y pour corriger l'orientation (DXF: Y vers haut, Canvas: Y vers bas)
  const getOrCreatePoint = (x: number, y: number): string => {
    // Arrondir pour éviter les doublons dus aux erreurs de précision
    // Inverser Y pour corriger l'orientation
    const rx = Math.round(x * 1000) / 1000;
    const ry = Math.round(-y * 1000) / 1000; // Y inversé

    // Chercher un point existant
    for (const [id, pt] of points) {
      if (Math.abs(pt.x - rx) < 0.001 && Math.abs(pt.y - ry) < 0.001) {
        return id;
      }
    }

    // Créer un nouveau point
    const id = generateId();
    points.set(id, { id, x: rx, y: ry });

    // Mettre à jour les bounds
    minX = Math.min(minX, rx);
    minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx);
    maxY = Math.max(maxY, ry);

    return id;
  };

  // Helper pour créer une ligne
  const createLine = (x1: number, y1: number, x2: number, y2: number, layer: string): void => {
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

  for (const entity of entities) {
    const layerId = entity.layer || "trace";

    switch (entity.type) {
      case "LINE": {
        // Codes DXF: 10,20 = start point, 11,21 = end point
        const x1 = entity.numericData.get(10);
        const y1 = entity.numericData.get(20);
        const x2 = entity.numericData.get(11);
        const y2 = entity.numericData.get(21);

        if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
          createLine(x1, y1, x2, y2, layerId);
        }
        break;
      }

      case "CIRCLE": {
        // Codes DXF: 10,20 = center, 40 = radius
        const cx = entity.numericData.get(10);
        const cy = entity.numericData.get(20);
        const radius = entity.numericData.get(40);

        if (cx !== undefined && cy !== undefined && radius !== undefined) {
          const centerId = getOrCreatePoint(cx, cy);

          // Mettre à jour bounds avec le cercle complet (Y inversé)
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
        // Codes DXF: 10,20 = center, 40 = radius, 50 = start angle, 51 = end angle
        const cx = entity.numericData.get(10);
        const cy = entity.numericData.get(20);
        const radius = entity.numericData.get(40);
        const startAngleDeg = entity.numericData.get(50) || 0;
        const endAngleDeg = entity.numericData.get(51) || 360;

        if (cx !== undefined && cy !== undefined && radius !== undefined) {
          // Convertir en radians
          const startAngle = (startAngleDeg * Math.PI) / 180;
          const endAngle = (endAngleDeg * Math.PI) / 180;

          // Approximer l'arc avec des segments
          let angle = endAngle - startAngle;
          if (angle < 0) angle += 2 * Math.PI;

          const numSegments = Math.max(8, Math.ceil(angle / (Math.PI / 8)));

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
        // Les polylignes légères avec support du bulge (arcs)
        const xArray = entity.arrayData.get(10);
        const yArray = entity.arrayData.get(20);
        const bulgeArray = entity.arrayData.get(42);
        const lastX = entity.numericData.get(10);
        const lastY = entity.numericData.get(20);
        const lastBulge = entity.numericData.get(42);

        // Construire la liste des coordonnées
        let xs: number[] = [];
        let ys: number[] = [];
        let bulges: number[] = [];

        if (xArray && xArray.length > 0) {
          xs = [...xArray];
        } else if (lastX !== undefined) {
          xs = [lastX];
        }

        if (yArray && yArray.length > 0) {
          ys = [...yArray];
        } else if (lastY !== undefined) {
          ys = [lastY];
        }

        // Bulges (peut être undefined pour certains vertices)
        if (bulgeArray && bulgeArray.length > 0) {
          bulges = [...bulgeArray];
        } else if (lastBulge !== undefined) {
          bulges = [lastBulge];
        }

        // Créer les segments/arcs entre les points successifs
        if (xs.length >= 2 && xs.length === ys.length) {
          for (let j = 0; j < xs.length - 1; j++) {
            const p1 = { x: xs[j], y: ys[j] };
            const p2 = { x: xs[j + 1], y: ys[j + 1] };
            const bulge = bulges[j] || 0;

            if (Math.abs(bulge) > 0.0001) {
              // Arc - générer des points intermédiaires
              const arcPoints = arcFromBulge(p1, p2, bulge, ARC_SEGMENTS);

              let prevPoint = p1;
              for (const arcPoint of arcPoints) {
                createLine(prevPoint.x, prevPoint.y, arcPoint.x, arcPoint.y, layerId);
                prevPoint = arcPoint;
              }
              createLine(prevPoint.x, prevPoint.y, p2.x, p2.y, layerId);
            } else {
              // Ligne droite
              createLine(p1.x, p1.y, p2.x, p2.y, layerId);
            }
          }

          // Si fermé (code 70 & 1), connecter le dernier au premier
          const flags = entity.numericData.get(70);
          if (flags !== undefined && flags & 1 && xs.length > 2) {
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
        // Les splines DXF utilisent des points de contrôle et des knots
        // Code 10,20 = points de contrôle, Code 11,21 = fit points (optionnel)
        const ctrlXArray = entity.arrayData.get(10);
        const ctrlYArray = entity.arrayData.get(20);
        const fitXArray = entity.arrayData.get(11);
        const fitYArray = entity.arrayData.get(21);
        const lastCtrlX = entity.numericData.get(10);
        const lastCtrlY = entity.numericData.get(20);
        const lastFitX = entity.numericData.get(11);
        const lastFitY = entity.numericData.get(21);

        // Préférer les fit points s'ils existent (plus précis)
        let xs: number[] = [];
        let ys: number[] = [];

        // Essayer d'abord les fit points
        if (fitXArray && fitXArray.length > 0) {
          xs = [...fitXArray];
          if (lastFitX !== undefined) xs.push(lastFitX);
        }
        if (fitYArray && fitYArray.length > 0) {
          ys = [...fitYArray];
          if (lastFitY !== undefined) ys.push(lastFitY);
        }

        // Sinon utiliser les points de contrôle
        if (xs.length === 0) {
          if (ctrlXArray && ctrlXArray.length > 0) {
            xs = [...ctrlXArray];
          } else if (lastCtrlX !== undefined) {
            xs = [lastCtrlX];
          }
        }

        if (ys.length === 0) {
          if (ctrlYArray && ctrlYArray.length > 0) {
            ys = [...ctrlYArray];
          } else if (lastCtrlY !== undefined) {
            ys = [lastCtrlY];
          }
        }

        // Interpoler avec Catmull-Rom pour des courbes lisses
        if (xs.length >= 2 && xs.length === ys.length) {
          const controlPoints = xs.map((x, i) => ({ x, y: ys[i] }));

          // Ajouter des points fantômes pour le début et la fin
          const extendedPoints = [
            { x: 2 * controlPoints[0].x - controlPoints[1].x, y: 2 * controlPoints[0].y - controlPoints[1].y },
            ...controlPoints,
            {
              x: 2 * controlPoints[controlPoints.length - 1].x - controlPoints[controlPoints.length - 2].x,
              y: 2 * controlPoints[controlPoints.length - 1].y - controlPoints[controlPoints.length - 2].y,
            },
          ];

          // Générer les points de la courbe
          const curvePoints: { x: number; y: number }[] = [];

          for (let i = 1; i < extendedPoints.length - 2; i++) {
            const p0 = extendedPoints[i - 1];
            const p1 = extendedPoints[i];
            const p2 = extendedPoints[i + 1];
            const p3 = extendedPoints[i + 2];

            for (let j = 0; j < SPLINE_SEGMENTS; j++) {
              const t = j / SPLINE_SEGMENTS;
              curvePoints.push(catmullRomPoint(p0, p1, p2, p3, t));
            }
          }

          // Ajouter le dernier point
          curvePoints.push(controlPoints[controlPoints.length - 1]);

          // Créer les segments
          for (let i = 0; i < curvePoints.length - 1; i++) {
            createLine(curvePoints[i].x, curvePoints[i].y, curvePoints[i + 1].x, curvePoints[i + 1].y, layerId);
          }
        }
        break;
      }

      case "ELLIPSE": {
        // Codes DXF: 10,20 = center, 11,21 = endpoint of major axis (relative to center)
        // 40 = ratio of minor to major axis, 41 = start param, 42 = end param
        const cx = entity.numericData.get(10);
        const cy = entity.numericData.get(20);
        const majorX = entity.numericData.get(11);
        const majorY = entity.numericData.get(21);
        const ratio = entity.numericData.get(40) || 1;
        const startParam = entity.numericData.get(41) || 0;
        const endParam = entity.numericData.get(42) || 2 * Math.PI;

        if (cx !== undefined && cy !== undefined && majorX !== undefined && majorY !== undefined) {
          const majorRadius = Math.sqrt(majorX * majorX + majorY * majorY);
          const minorRadius = majorRadius * ratio;
          const rotation = Math.atan2(majorY, majorX);

          // Approximer l'ellipse avec des segments
          const numSegments = 32;
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
    }
  }

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

/**
 * Exporte pour utilisation dans le module
 */
export type { DXFParseResult };
