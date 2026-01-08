// ============================================
// DXF PARSER: Import de fichiers DXF
// Parse les fichiers DXF et convertit en format interne
// VERSION: 1.3 - Inversion axe Y pour orientation correcte
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
            // Pour les polylignes, gérer les valeurs multiples
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

  for (const entity of entities) {
    switch (entity.type) {
      case "LINE": {
        // Codes DXF: 10,20 = start point, 11,21 = end point
        const x1 = entity.numericData.get(10);
        const y1 = entity.numericData.get(20);
        const x2 = entity.numericData.get(11);
        const y2 = entity.numericData.get(21);

        if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
          const p1Id = getOrCreatePoint(x1, y1);
          const p2Id = getOrCreatePoint(x2, y2);

          const lineId = generateId();
          const line: Line = {
            id: lineId,
            type: "line",
            p1: p1Id,
            p2: p2Id,
            layerId: entity.layer || "trace",
          };
          geometries.set(lineId, line);
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
            layerId: entity.layer || "trace",
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
          const startAngle = (startAngleDeg * Math.PI) / 180;
          const endAngle = (endAngleDeg * Math.PI) / 180;

          const centerId = getOrCreatePoint(cx, cy);
          const startX = cx + radius * Math.cos(startAngle);
          const startY = cy + radius * Math.sin(startAngle);
          const endX = cx + radius * Math.cos(endAngle);
          const endY = cy + radius * Math.sin(endAngle);

          const startPtId = getOrCreatePoint(startX, startY);
          const endPtId = getOrCreatePoint(endX, endY);

          const arcId = generateId();
          const arc: Arc = {
            id: arcId,
            type: "arc",
            center: centerId,
            startPoint: startPtId,
            endPoint: endPtId,
            radius: radius,
            layerId: entity.layer || "trace",
          };
          geometries.set(arcId, arc);
        }
        break;
      }

      case "LWPOLYLINE": {
        // Les polylignes légères ont les vertices dans des codes 10/20 successifs
        const xArray = entity.arrayData.get(10);
        const yArray = entity.arrayData.get(20);
        const lastX = entity.numericData.get(10);
        const lastY = entity.numericData.get(20);

        // Construire la liste des coordonnées
        let xs: number[] = [];
        let ys: number[] = [];

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

        // Créer des lignes entre les points successifs
        if (xs.length >= 2 && xs.length === ys.length) {
          for (let j = 0; j < xs.length - 1; j++) {
            const p1Id = getOrCreatePoint(xs[j], ys[j]);
            const p2Id = getOrCreatePoint(xs[j + 1], ys[j + 1]);

            const lineId = generateId();
            const line: Line = {
              id: lineId,
              type: "line",
              p1: p1Id,
              p2: p2Id,
              layerId: entity.layer || "trace",
            };
            geometries.set(lineId, line);
          }

          // Si fermé (code 70 & 1), connecter le dernier au premier
          const flags = entity.numericData.get(70);
          if (flags !== undefined && flags & 1 && xs.length > 2) {
            const p1Id = getOrCreatePoint(xs[xs.length - 1], ys[ys.length - 1]);
            const p2Id = getOrCreatePoint(xs[0], ys[0]);

            const lineId = generateId();
            const line: Line = {
              id: lineId,
              type: "line",
              p1: p1Id,
              p2: p2Id,
              layerId: entity.layer || "trace",
            };
            geometries.set(lineId, line);
          }
        }
        break;
      }

      // SPLINE sera converti en segments
      case "SPLINE": {
        const xArray = entity.arrayData.get(10);
        const yArray = entity.arrayData.get(20);
        const lastX = entity.numericData.get(10);
        const lastY = entity.numericData.get(20);

        let xs: number[] = [];
        let ys: number[] = [];

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

        // Pour l'instant, créer des lignes entre les points
        if (xs.length >= 2 && xs.length === ys.length) {
          for (let j = 0; j < xs.length - 1; j++) {
            const p1Id = getOrCreatePoint(xs[j], ys[j]);
            const p2Id = getOrCreatePoint(xs[j + 1], ys[j + 1]);

            const lineId = generateId();
            const line: Line = {
              id: lineId,
              type: "line",
              p1: p1Id,
              p2: p2Id,
              layerId: entity.layer || "trace",
            };
            geometries.set(lineId, line);
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
