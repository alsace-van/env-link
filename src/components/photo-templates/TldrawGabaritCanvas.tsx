// ============================================
// COMPOSANT: TldrawGabaritCanvas
// Canvas moderne pour gabarits CNC avec tldraw
// VERSION: 1.0 - Prototype initial
// ============================================

import { useEffect, useCallback, useState, useRef } from "react";
import {
  Tldraw,
  Editor,
  TLShapeId,
  createShapeId,
  exportToSvg,
  TLShape,
  DefaultToolbar,
  TldrawUiMenuItem,
  useEditor,
  useTools,
  DefaultToolbarContent,
  TLUiOverrides,
  TLUiComponents,
  TLComponents,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Download,
  Save,
  Ruler,
  Grid3x3,
  Maximize,
  Minimize,
  FileDown,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

interface TldrawGabaritCanvasProps {
  imageUrl: string;
  scaleFactor: number; // pixels par mm
  templateId: string;
  initialData?: any;
  onSave?: (data: any) => void;
}

// Fonction de conversion SVG vers DXF
const svgToDxf = (svgString: string, scale: number = 1): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  
  let dxf = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
0
70
64
62
7
6
CONTINUOUS
0
LAYER
2
CONTOURS
70
64
62
5
6
CONTINUOUS
0
LAYER
2
DIMENSIONS
70
64
62
3
6
CONTINUOUS
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
`;

  // Parser les éléments SVG
  const processElement = (element: Element, layer: string = "CONTOURS") => {
    const tagName = element.tagName.toLowerCase();
    
    // Récupérer la transformation si présente
    const transform = element.getAttribute("transform") || "";
    let translateX = 0, translateY = 0;
    const translateMatch = transform.match(/translate\(([^,]+),?\s*([^)]*)\)/);
    if (translateMatch) {
      translateX = parseFloat(translateMatch[1]) || 0;
      translateY = parseFloat(translateMatch[2]) || 0;
    }

    switch (tagName) {
      case "line": {
        const x1 = (parseFloat(element.getAttribute("x1") || "0") + translateX) / scale;
        const y1 = -(parseFloat(element.getAttribute("y1") || "0") + translateY) / scale;
        const x2 = (parseFloat(element.getAttribute("x2") || "0") + translateX) / scale;
        const y2 = -(parseFloat(element.getAttribute("y2") || "0") + translateY) / scale;
        dxf += `0
LINE
8
${layer}
10
${x1.toFixed(4)}
20
${y1.toFixed(4)}
11
${x2.toFixed(4)}
21
${y2.toFixed(4)}
`;
        break;
      }
      
      case "rect": {
        const x = (parseFloat(element.getAttribute("x") || "0") + translateX) / scale;
        const y = -(parseFloat(element.getAttribute("y") || "0") + translateY) / scale;
        const width = parseFloat(element.getAttribute("width") || "0") / scale;
        const height = parseFloat(element.getAttribute("height") || "0") / scale;
        
        // Rectangle = 4 lignes (LWPOLYLINE fermée)
        dxf += `0
LWPOLYLINE
8
${layer}
90
4
70
1
10
${x.toFixed(4)}
20
${y.toFixed(4)}
10
${(x + width).toFixed(4)}
20
${y.toFixed(4)}
10
${(x + width).toFixed(4)}
20
${(y - height).toFixed(4)}
10
${x.toFixed(4)}
20
${(y - height).toFixed(4)}
`;
        break;
      }
      
      case "circle": {
        const cx = (parseFloat(element.getAttribute("cx") || "0") + translateX) / scale;
        const cy = -(parseFloat(element.getAttribute("cy") || "0") + translateY) / scale;
        const r = parseFloat(element.getAttribute("r") || "0") / scale;
        dxf += `0
CIRCLE
8
${layer}
10
${cx.toFixed(4)}
20
${cy.toFixed(4)}
40
${r.toFixed(4)}
`;
        break;
      }
      
      case "ellipse": {
        const cx = (parseFloat(element.getAttribute("cx") || "0") + translateX) / scale;
        const cy = -(parseFloat(element.getAttribute("cy") || "0") + translateY) / scale;
        const rx = parseFloat(element.getAttribute("rx") || "0") / scale;
        const ry = parseFloat(element.getAttribute("ry") || "0") / scale;
        // DXF ELLIPSE
        dxf += `0
ELLIPSE
8
${layer}
10
${cx.toFixed(4)}
20
${cy.toFixed(4)}
30
0
11
${rx.toFixed(4)}
21
0
31
0
40
${(ry / rx).toFixed(4)}
41
0
42
6.283185
`;
        break;
      }
      
      case "path": {
        // Parser le path SVG et convertir en SPLINE ou POLYLINE
        const d = element.getAttribute("d") || "";
        const points = parsePathToPoints(d, translateX, translateY, scale);
        if (points.length >= 2) {
          dxf += `0
LWPOLYLINE
8
${layer}
90
${points.length}
70
0
`;
          points.forEach(([x, y]) => {
            dxf += `10
${x.toFixed(4)}
20
${(-y).toFixed(4)}
`;
          });
        }
        break;
      }
      
      case "polyline":
      case "polygon": {
        const pointsStr = element.getAttribute("points") || "";
        const points = pointsStr.split(/\s+/).map(p => {
          const [x, y] = p.split(",").map(Number);
          return [(x + translateX) / scale, (y + translateY) / scale];
        }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));
        
        if (points.length >= 2) {
          const isClosed = tagName === "polygon" ? 1 : 0;
          dxf += `0
LWPOLYLINE
8
${layer}
90
${points.length}
70
${isClosed}
`;
          points.forEach(([x, y]) => {
            dxf += `10
${x.toFixed(4)}
20
${(-y).toFixed(4)}
`;
          });
        }
        break;
      }
      
      case "g":
        // Groupe - traiter les enfants
        Array.from(element.children).forEach(child => processElement(child, layer));
        break;
    }
  };

  // Parser un path SVG simplifié (M, L, Q, C, Z)
  const parsePathToPoints = (d: string, tx: number, ty: number, scale: number): number[][] => {
    const points: number[][] = [];
    const commands = d.match(/[MLQCZ][^MLQCZ]*/gi) || [];
    let currentX = 0, currentY = 0;
    
    commands.forEach(cmd => {
      const type = cmd[0].toUpperCase();
      const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
      
      switch (type) {
        case "M":
          currentX = coords[0];
          currentY = coords[1];
          points.push([(currentX + tx) / scale, (currentY + ty) / scale]);
          break;
        case "L":
          currentX = coords[0];
          currentY = coords[1];
          points.push([(currentX + tx) / scale, (currentY + ty) / scale]);
          break;
        case "Q":
          // Quadratic bezier - échantillonner
          const qcx = coords[0], qcy = coords[1];
          const qex = coords[2], qey = coords[3];
          for (let t = 0.25; t <= 1; t += 0.25) {
            const x = (1-t)*(1-t)*currentX + 2*(1-t)*t*qcx + t*t*qex;
            const y = (1-t)*(1-t)*currentY + 2*(1-t)*t*qcy + t*t*qey;
            points.push([(x + tx) / scale, (y + ty) / scale]);
          }
          currentX = qex;
          currentY = qey;
          break;
        case "C":
          // Cubic bezier - échantillonner
          const c1x = coords[0], c1y = coords[1];
          const c2x = coords[2], c2y = coords[3];
          const cex = coords[4], cey = coords[5];
          for (let t = 0.2; t <= 1; t += 0.2) {
            const x = Math.pow(1-t,3)*currentX + 3*Math.pow(1-t,2)*t*c1x + 3*(1-t)*t*t*c2x + Math.pow(t,3)*cex;
            const y = Math.pow(1-t,3)*currentY + 3*Math.pow(1-t,2)*t*c1y + 3*(1-t)*t*t*c2y + Math.pow(t,3)*cey;
            points.push([(x + tx) / scale, (y + ty) / scale]);
          }
          currentX = cex;
          currentY = cey;
          break;
        case "Z":
          // Fermer - retour au premier point
          if (points.length > 0) {
            points.push([...points[0]]);
          }
          break;
      }
    });
    
    return points;
  };

  // Traiter tous les éléments du SVG
  const svg = doc.querySelector("svg");
  if (svg) {
    Array.from(svg.children).forEach(child => {
      // Ignorer les images (fond)
      if (child.tagName.toLowerCase() !== "image") {
        processElement(child);
      }
    });
  }

  dxf += `0
ENDSEC
0
EOF
`;

  return dxf;
};

// Composant principal
export function TldrawGabaritCanvas({
  imageUrl,
  scaleFactor,
  templateId,
  initialData,
  onSave,
}: TldrawGabaritCanvasProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(10); // mm
  const containerRef = useRef<HTMLDivElement>(null);

  // Charger l'image de fond au montage
  const handleMount = useCallback((editorInstance: Editor) => {
    setEditor(editorInstance);

    // Charger l'image de fond
    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const assetId = `asset:bg-${templateId}` as any;
        const shapeId = createShapeId(`bg-${templateId}`);

        // Créer l'asset
        editorInstance.createAssets([
          {
            id: assetId,
            type: "image",
            typeName: "asset",
            props: {
              name: "background",
              src: imageUrl,
              w: img.width,
              h: img.height,
              mimeType: "image/jpeg",
              isAnimated: false,
            },
            meta: {},
          },
        ]);

        // Créer la shape image
        editorInstance.createShape({
          id: shapeId,
          type: "image",
          x: 0,
          y: 0,
          props: {
            assetId: assetId,
            w: img.width,
            h: img.height,
          },
          isLocked: true, // Verrouiller l'image de fond
        });

        // Centrer la vue
        editorInstance.zoomToFit();
      };
      img.src = imageUrl;
    }

    // Charger les données initiales si présentes
    if (initialData?.shapes) {
      try {
        // Restaurer les shapes sauvegardées
        initialData.shapes.forEach((shape: any) => {
          if (shape.type !== "image") {
            editorInstance.createShape(shape);
          }
        });
      } catch (error) {
        console.error("Erreur chargement données:", error);
      }
    }
  }, [imageUrl, templateId, initialData]);

  // Sauvegarder
  const handleSave = useCallback(() => {
    if (!editor || !onSave) return;

    const shapes = editor.getCurrentPageShapes();
    // Exclure l'image de fond
    const drawingShapes = shapes.filter(
      (s) => s.type !== "image" && !s.isLocked
    );

    const data = {
      shapes: drawingShapes.map((s) => ({
        id: s.id,
        type: s.type,
        x: s.x,
        y: s.y,
        rotation: s.rotation,
        props: s.props,
      })),
      scaleFactor,
      savedAt: new Date().toISOString(),
    };

    onSave(data);
    toast.success("Gabarit sauvegardé !");
  }, [editor, onSave, scaleFactor]);

  // Export SVG
  const handleExportSVG = useCallback(async () => {
    if (!editor) return;

    try {
      const shapes = editor.getCurrentPageShapes();
      const drawingShapes = shapes.filter(
        (s) => s.type !== "image" && !s.isLocked
      );

      if (drawingShapes.length === 0) {
        toast.error("Aucun tracé à exporter");
        return;
      }

      const svg = await exportToSvg(editor, drawingShapes.map((s) => s.id));
      
      // Créer le blob et télécharger
      const svgString = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `gabarit-${templateId}.svg`;
      a.click();
      
      URL.revokeObjectURL(url);
      toast.success("SVG exporté !");
    } catch (error) {
      console.error("Erreur export SVG:", error);
      toast.error("Erreur lors de l'export SVG");
    }
  }, [editor, templateId]);

  // Export DXF
  const handleExportDXF = useCallback(async () => {
    if (!editor) return;

    try {
      const shapes = editor.getCurrentPageShapes();
      const drawingShapes = shapes.filter(
        (s) => s.type !== "image" && !s.isLocked
      );

      if (drawingShapes.length === 0) {
        toast.error("Aucun tracé à exporter");
        return;
      }

      // Exporter en SVG d'abord
      const svg = await exportToSvg(editor, drawingShapes.map((s) => s.id));
      const svgString = new XMLSerializer().serializeToString(svg);

      // Convertir en DXF
      const dxfContent = svgToDxf(svgString, scaleFactor);
      
      // Télécharger
      const blob = new Blob([dxfContent], { type: "application/dxf" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `gabarit-${templateId}.dxf`;
      a.click();
      
      URL.revokeObjectURL(url);
      toast.success("DXF exporté pour Fusion 360 !");
    } catch (error) {
      console.error("Erreur export DXF:", error);
      toast.error("Erreur lors de l'export DXF");
    }
  }, [editor, templateId, scaleFactor]);

  // Plein écran
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Reset vue
  const handleResetView = useCallback(() => {
    if (editor) {
      editor.zoomToFit();
    }
  }, [editor]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-white"
          : "h-[700px]"
      }`}
    >
      {/* Barre d'outils */}
      <div className="flex items-center gap-2 p-2 bg-gray-100 border-b flex-wrap">
        <Badge variant="outline" className="text-xs">
          <Ruler className="h-3 w-3 mr-1" />
          Échelle: 1px = {(1 / scaleFactor).toFixed(2)}mm
        </Badge>

        <Separator orientation="vertical" className="h-6" />

        <Button variant="outline" size="sm" onClick={handleResetView}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset vue
        </Button>

        <Button
          variant={showGrid ? "default" : "outline"}
          size="sm"
          onClick={() => setShowGrid(!showGrid)}
        >
          <Grid3x3 className="h-4 w-4 mr-1" />
          Grille
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <Button variant="outline" size="sm" onClick={handleSave}>
          <Save className="h-4 w-4 mr-1" />
          Sauvegarder
        </Button>

        <Button variant="outline" size="sm" onClick={handleExportSVG}>
          <FileDown className="h-4 w-4 mr-1" />
          SVG
        </Button>

        <Button variant="default" size="sm" onClick={handleExportDXF}>
          <Download className="h-4 w-4 mr-1" />
          DXF (Fusion 360)
        </Button>

        <div className="flex-1" />

        <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
          {isFullscreen ? (
            <Minimize className="h-4 w-4" />
          ) : (
            <Maximize className="h-4 w-4" />
          )}
        </Button>

        {isFullscreen && (
          <Badge variant="secondary" className="text-xs">
            Appuyez sur <kbd className="mx-1 px-1 bg-gray-300 rounded">Échap</kbd> pour quitter
          </Badge>
        )}
      </div>

      {/* Canvas tldraw */}
      <div className="flex-1 relative">
        <Tldraw
          onMount={handleMount}
          options={{
            maxPages: 1,
          }}
        />
      </div>

      {/* Info en bas */}
      <div className="p-2 bg-gray-50 border-t text-xs text-muted-foreground flex items-center gap-4">
        <span>
          💡 Utilisez les outils de la barre pour tracer : lignes, rectangles, ellipses, courbes libres
        </span>
        <span className="ml-auto">
          Molette: zoom • Clic droit + glisser: déplacer la vue
        </span>
      </div>
    </div>
  );
}

export default TldrawGabaritCanvas;
