// ============================================
// EXPORT DXF: Export au format AutoCAD
// Compatible Fusion 360 et autres logiciels CAO
// VERSION: 1.0
// ============================================

import {
  Sketch,
  Line,
  Circle as CircleType,
  Arc,
  Rectangle,
} from './types';

/**
 * Exporte un sketch au format DXF (AutoCAD 2000)
 */
export function exportToDXF(sketch: Sketch): string {
  const scale = 1 / sketch.scaleFactor; // Convertir px en mm
  
  let dxf = generateHeader();
  dxf += generateTables();
  dxf += generateBlocks();
  dxf += generateEntitiesStart();
  
  // Exporter les géométries
  sketch.geometries.forEach((geo, id) => {
    switch (geo.type) {
      case 'line':
        dxf += exportLine(geo as Line, sketch, scale);
        break;
      case 'circle':
        dxf += exportCircle(geo as CircleType, sketch, scale);
        break;
      case 'arc':
        dxf += exportArc(geo as Arc, sketch, scale);
        break;
    }
  });
  
  dxf += generateEntitiesEnd();
  dxf += generateFooter();
  
  return dxf;
}

function generateHeader(): string {
  return `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
9
$INSBASE
10
0.0
20
0.0
30
0.0
9
$EXTMIN
10
-1000.0
20
-1000.0
30
0.0
9
$EXTMAX
10
1000.0
20
1000.0
30
0.0
9
$LIMMIN
10
0.0
20
0.0
9
$LIMMAX
10
1000.0
20
1000.0
9
$INSUNITS
70
4
9
$MEASUREMENT
70
1
0
ENDSEC
`;
}

function generateTables(): string {
  return `0
SECTION
2
TABLES
0
TABLE
2
VPORT
5
8
100
AcDbSymbolTable
70
1
0
VPORT
5
30
100
AcDbSymbolTableRecord
100
AcDbViewportTableRecord
2
*ACTIVE
70
0
10
0.0
20
0.0
11
1.0
21
1.0
12
0.0
22
0.0
13
0.0
23
0.0
14
10.0
24
10.0
15
10.0
25
10.0
16
0.0
26
0.0
36
1.0
17
0.0
27
0.0
37
0.0
40
1000.0
41
1.0
42
50.0
43
0.0
44
0.0
50
0.0
51
0.0
71
0
72
100
73
1
74
3
75
0
76
0
77
0
78
0
0
ENDTAB
0
TABLE
2
LTYPE
5
5
100
AcDbSymbolTable
70
3
0
LTYPE
5
14
100
AcDbSymbolTableRecord
100
AcDbLinetypeTableRecord
2
BYBLOCK
70
0
3

72
65
73
0
40
0.0
0
LTYPE
5
15
100
AcDbSymbolTableRecord
100
AcDbLinetypeTableRecord
2
BYLAYER
70
0
3

72
65
73
0
40
0.0
0
LTYPE
5
16
100
AcDbSymbolTableRecord
100
AcDbLinetypeTableRecord
2
CONTINUOUS
70
0
3
Solid line
72
65
73
0
40
0.0
0
ENDTAB
0
TABLE
2
LAYER
5
2
100
AcDbSymbolTable
70
2
0
LAYER
5
10
100
AcDbSymbolTableRecord
100
AcDbLayerTableRecord
2
0
70
0
62
7
6
CONTINUOUS
0
LAYER
5
11
100
AcDbSymbolTableRecord
100
AcDbLayerTableRecord
2
GEOMETRY
70
0
62
7
6
CONTINUOUS
0
LAYER
5
12
100
AcDbSymbolTableRecord
100
AcDbLayerTableRecord
2
DIMENSIONS
70
0
62
1
6
CONTINUOUS
0
LAYER
5
13
100
AcDbSymbolTableRecord
100
AcDbLayerTableRecord
2
CONSTRAINTS
70
0
62
3
6
CONTINUOUS
0
ENDTAB
0
TABLE
2
STYLE
5
3
100
AcDbSymbolTable
70
1
0
STYLE
5
11
100
AcDbSymbolTableRecord
100
AcDbTextStyleTableRecord
2
STANDARD
70
0
40
0.0
41
1.0
50
0.0
71
0
42
2.5
3
txt
4

0
ENDTAB
0
ENDSEC
`;
}

function generateBlocks(): string {
  return `0
SECTION
2
BLOCKS
0
BLOCK
5
20
100
AcDbEntity
8
0
100
AcDbBlockBegin
2
*MODEL_SPACE
70
0
10
0.0
20
0.0
30
0.0
3
*MODEL_SPACE
1

0
ENDBLK
5
21
100
AcDbEntity
8
0
100
AcDbBlockEnd
0
BLOCK
5
1C
100
AcDbEntity
67
1
8
0
100
AcDbBlockBegin
2
*PAPER_SPACE
70
0
10
0.0
20
0.0
30
0.0
3
*PAPER_SPACE
1

0
ENDBLK
5
1D
100
AcDbEntity
67
1
8
0
100
AcDbBlockEnd
0
ENDSEC
`;
}

function generateEntitiesStart(): string {
  return `0
SECTION
2
ENTITIES
`;
}

function generateEntitiesEnd(): string {
  return `0
ENDSEC
`;
}

function generateFooter(): string {
  return `0
SECTION
2
OBJECTS
0
DICTIONARY
5
C
100
AcDbDictionary
281
1
3
ACAD_GROUP
350
D
3
ACAD_MLINESTYLE
350
17
0
DICTIONARY
5
D
100
AcDbDictionary
281
1
0
DICTIONARY
5
17
100
AcDbDictionary
281
1
0
ENDSEC
0
EOF
`;
}

function exportLine(line: Line, sketch: Sketch, scale: number): string {
  const p1 = sketch.points.get(line.p1);
  const p2 = sketch.points.get(line.p2);
  
  if (!p1 || !p2) return '';
  
  // Inverser Y pour DXF (système de coordonnées différent)
  const x1 = p1.x * scale;
  const y1 = -p1.y * scale;
  const x2 = p2.x * scale;
  const y2 = -p2.y * scale;
  
  return `0
LINE
5
${generateHandle()}
100
AcDbEntity
8
GEOMETRY
100
AcDbLine
10
${x1.toFixed(6)}
20
${y1.toFixed(6)}
30
0.0
11
${x2.toFixed(6)}
21
${y2.toFixed(6)}
31
0.0
`;
}

function exportCircle(circle: CircleType, sketch: Sketch, scale: number): string {
  const center = sketch.points.get(circle.center);
  
  if (!center) return '';
  
  const cx = center.x * scale;
  const cy = -center.y * scale;
  const r = circle.radius * scale;
  
  return `0
CIRCLE
5
${generateHandle()}
100
AcDbEntity
8
GEOMETRY
100
AcDbCircle
10
${cx.toFixed(6)}
20
${cy.toFixed(6)}
30
0.0
40
${r.toFixed(6)}
`;
}

function exportArc(arc: Arc, sketch: Sketch, scale: number): string {
  const center = sketch.points.get(arc.center);
  const startPt = sketch.points.get(arc.startPoint);
  const endPt = sketch.points.get(arc.endPoint);
  
  if (!center || !startPt || !endPt) return '';
  
  const cx = center.x * scale;
  const cy = -center.y * scale;
  const r = arc.radius * scale;
  
  // Calculer les angles (en degrés pour DXF)
  // Note: Y est inversé, donc les angles aussi
  let startAngle = Math.atan2(-(startPt.y - center.y), startPt.x - center.x) * 180 / Math.PI;
  let endAngle = Math.atan2(-(endPt.y - center.y), endPt.x - center.x) * 180 / Math.PI;
  
  // Normaliser les angles
  while (startAngle < 0) startAngle += 360;
  while (endAngle < 0) endAngle += 360;
  
  return `0
ARC
5
${generateHandle()}
100
AcDbEntity
8
GEOMETRY
100
AcDbCircle
10
${cx.toFixed(6)}
20
${cy.toFixed(6)}
30
0.0
40
${r.toFixed(6)}
100
AcDbArc
50
${startAngle.toFixed(6)}
51
${endAngle.toFixed(6)}
`;
}

// Générateur de handles uniques pour DXF
let handleCounter = 100;
function generateHandle(): string {
  return (handleCounter++).toString(16).toUpperCase();
}

/**
 * Export LWPOLYLINE pour les rectangles et polygones
 */
export function exportPolyline(points: { x: number; y: number }[], closed: boolean, scale: number): string {
  if (points.length < 2) return '';
  
  let dxf = `0
LWPOLYLINE
5
${generateHandle()}
100
AcDbEntity
8
GEOMETRY
100
AcDbPolyline
90
${points.length}
70
${closed ? 1 : 0}
43
0.0
`;
  
  for (const p of points) {
    dxf += `10
${(p.x * scale).toFixed(6)}
20
${(-p.y * scale).toFixed(6)}
`;
  }
  
  return dxf;
}

/**
 * Export avec cotations
 */
export function exportDimension(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  value: number,
  scale: number
): string {
  const x1 = p1.x * scale;
  const y1 = -p1.y * scale;
  const x2 = p2.x * scale;
  const y2 = -p2.y * scale;
  
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  
  return `0
DIMENSION
5
${generateHandle()}
100
AcDbEntity
8
DIMENSIONS
100
AcDbDimension
2
*D0
10
${mx.toFixed(6)}
20
${(my - 10).toFixed(6)}
30
0.0
11
${mx.toFixed(6)}
21
${(my - 10).toFixed(6)}
31
0.0
70
0
1
${value.toFixed(2)}
3
STANDARD
100
AcDbAlignedDimension
13
${x1.toFixed(6)}
23
${y1.toFixed(6)}
33
0.0
14
${x2.toFixed(6)}
24
${y2.toFixed(6)}
34
0.0
`;
}

export default exportToDXF;
