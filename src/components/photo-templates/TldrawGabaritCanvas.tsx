// ============================================
// COMPOSANT: TldrawGabaritCanvas
// Canvas moderne pour gabarits CNC avec tldraw
// VERSION: 1.6 - Force zoom molette
// ============================================

import { useEffect, useCallback, useState, useRef } from "react";
import { Tldraw, Editor, createShapeId, TLUiOverrides, TLUiToolsContextType } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  Save,
  Ruler,
  Maximize,
  Minimize,
  FileDown,
  RotateCcw,
  MousePointer,
  Hand,
  Pencil,
  Square,
  Eraser,
  Spline,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

interface TldrawGabaritCanvasProps {
  imageUrl: string;
  scaleFactor: number;
  templateId: string;
  initialData?: any;
  onSave?: (data: any) => void;
}

// Outils à garder
const ALLOWED_TOOLS = ["select", "hand", "draw", "line", "geo", "eraser"];

// Override pour personnaliser les outils
const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    const filteredTools: TLUiToolsContextType = {};

    for (const [key, tool] of Object.entries(tools)) {
      if (ALLOWED_TOOLS.includes(key)) {
        filteredTools[key] = tool;
      }
    }

    return filteredTools;
  },
};

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
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
`;

  const processElement = (element: Element, layer: string = "CONTOURS") => {
    const tagName = element.tagName.toLowerCase();

    const transform = element.getAttribute("transform") || "";
    let translateX = 0,
      translateY = 0;
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
        if (rx === 0) break;
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
        const points = pointsStr
          .split(/\s+/)
          .map((p) => {
            const [x, y] = p.split(",").map(Number);
            return [(x + translateX) / scale, (y + translateY) / scale];
          })
          .filter((p) => !isNaN(p[0]) && !isNaN(p[1]));

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
        Array.from(element.children).forEach((child) => processElement(child, layer));
        break;
    }
  };

  const parsePathToPoints = (d: string, tx: number, ty: number, scale: number): number[][] => {
    const points: number[][] = [];
    const commands = d.match(/[MLQCZ][^MLQCZ]*/gi) || [];
    let currentX = 0,
      currentY = 0;

    commands.forEach((cmd) => {
      const type = cmd[0].toUpperCase();
      const coords = cmd
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .map(Number);

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
          const qcx = coords[0],
            qcy = coords[1];
          const qex = coords[2],
            qey = coords[3];
          for (let t = 0.1; t <= 1; t += 0.1) {
            const x = (1 - t) * (1 - t) * currentX + 2 * (1 - t) * t * qcx + t * t * qex;
            const y = (1 - t) * (1 - t) * currentY + 2 * (1 - t) * t * qcy + t * t * qey;
            points.push([(x + tx) / scale, (y + ty) / scale]);
          }
          currentX = qex;
          currentY = qey;
          break;
        case "C":
          const c1x = coords[0],
            c1y = coords[1];
          const c2x = coords[2],
            c2y = coords[3];
          const cex = coords[4],
            cey = coords[5];
          for (let t = 0.1; t <= 1; t += 0.1) {
            const x =
              Math.pow(1 - t, 3) * currentX +
              3 * Math.pow(1 - t, 2) * t * c1x +
              3 * (1 - t) * t * t * c2x +
              Math.pow(t, 3) * cex;
            const y =
              Math.pow(1 - t, 3) * currentY +
              3 * Math.pow(1 - t, 2) * t * c1y +
              3 * (1 - t) * t * t * c2y +
              Math.pow(t, 3) * cey;
            points.push([(x + tx) / scale, (y + ty) / scale]);
          }
          currentX = cex;
          currentY = cey;
          break;
        case "Z":
          if (points.length > 0) {
            points.push([...points[0]]);
          }
          break;
      }
    });

    return points;
  };

  const svg = doc.querySelector("svg");
  if (svg) {
    Array.from(svg.children).forEach((child) => {
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
  const [activeTool, setActiveTool] = useState<string>("select");
  const [zoomLevel, setZoomLevel] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Intercepter la molette pour forcer le zoom au lieu du pan
  useEffect(() => {
    if (!editor || !canvasContainerRef.current) return;

    const container = canvasContainerRef.current;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Position de la souris pour zoomer vers ce point
      const screenPoint = { x: e.clientX, y: e.clientY };

      // Scroll down = zoom out, scroll up = zoom in
      if (e.deltaY > 0) {
        editor.zoomOut(screenPoint, { duration: 0 });
      } else {
        editor.zoomIn(screenPoint, { duration: 0 });
      }

      setZoomLevel(Math.round(editor.getZoomLevel() * 100));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [editor]);

  const handleMount = useCallback(
    (editorInstance: Editor) => {
      setEditor(editorInstance);

      // Écouter les changements d'outil et de zoom
      editorInstance.on("change", () => {
        const currentTool = editorInstance.getCurrentToolId();
        setActiveTool(currentTool);
        setZoomLevel(Math.round(editorInstance.getZoomLevel() * 100));
      });

      // Charger l'image de fond
      if (imageUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const assetId = `asset:bg-${templateId}` as any;
          const shapeId = createShapeId(`bg-${templateId}`);

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
            isLocked: true,
          });

          editorInstance.zoomToFit();
          setZoomLevel(Math.round(editorInstance.getZoomLevel() * 100));
        };
        img.src = imageUrl;
      }

      // Charger les données initiales
      if (initialData?.shapes) {
        try {
          initialData.shapes.forEach((shape: any) => {
            if (shape.type !== "image") {
              editorInstance.createShape(shape);
            }
          });
        } catch (error) {
          console.error("Erreur chargement données:", error);
        }
      }
    },
    [imageUrl, templateId, initialData],
  );

  // Fonctions pour changer d'outil
  const selectTool = useCallback(
    (toolId: string) => {
      if (editor) {
        editor.setCurrentTool(toolId);
        setActiveTool(toolId);
      }
    },
    [editor],
  );

  // Fonctions de zoom manuel
  const handleZoomIn = useCallback(() => {
    if (editor) {
      editor.zoomIn();
      setZoomLevel(Math.round(editor.getZoomLevel() * 100));
    }
  }, [editor]);

  const handleZoomOut = useCallback(() => {
    if (editor) {
      editor.zoomOut();
      setZoomLevel(Math.round(editor.getZoomLevel() * 100));
    }
  }, [editor]);

  const handleSave = useCallback(() => {
    if (!editor || !onSave) return;

    const shapes = editor.getCurrentPageShapes();
    const drawingShapes = shapes.filter((s) => s.type !== "image" && !s.isLocked);

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

  const handleExportSVG = useCallback(async () => {
    if (!editor) return;

    try {
      const shapes = editor.getCurrentPageShapes();
      const drawingShapes = shapes.filter((s) => s.type !== "image" && !s.isLocked);

      if (drawingShapes.length === 0) {
        toast.error("Aucun tracé à exporter");
        return;
      }

      editor.select(...drawingShapes.map((s) => s.id));

      const svgResult = await editor.getSvgString(drawingShapes.map((s) => s.id));

      if (!svgResult || !svgResult.svg) {
        toast.error("Impossible de générer le SVG");
        return;
      }

      const blob = new Blob([svgResult.svg], { type: "image/svg+xml" });
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

  const handleExportDXF = useCallback(async () => {
    if (!editor) return;

    try {
      const shapes = editor.getCurrentPageShapes();
      const drawingShapes = shapes.filter((s) => s.type !== "image" && !s.isLocked);

      if (drawingShapes.length === 0) {
        toast.error("Aucun tracé à exporter");
        return;
      }

      editor.select(...drawingShapes.map((s) => s.id));

      const svgResult = await editor.getSvgString(drawingShapes.map((s) => s.id));

      if (!svgResult || !svgResult.svg) {
        toast.error("Impossible de générer le SVG");
        return;
      }

      const dxfContent = svgToDxf(svgResult.svg, scaleFactor);

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

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const handleResetView = useCallback(() => {
    if (editor) {
      editor.zoomToFit();
      setZoomLevel(Math.round(editor.getZoomLevel() * 100));
    }
  }, [editor]);

  // Bouton d'outil personnalisé
  const ToolButton = ({ toolId, icon: Icon, label }: { toolId: string; icon: any; label: string }) => (
    <Button
      variant={activeTool === toolId ? "default" : "outline"}
      size="sm"
      onClick={() => selectTool(toolId)}
      title={label}
      className="h-9 w-9 p-0"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );

  return (
    <div ref={containerRef} className={`flex flex-col ${isFullscreen ? "fixed inset-0 z-50 bg-white" : "h-[700px]"}`}>
      {/* Barre d'outils personnalisée */}
      <div className="flex items-center gap-2 p-2 bg-gray-100 border-b flex-wrap">
        {/* Outils de dessin */}
        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
          <ToolButton toolId="select" icon={MousePointer} label="Sélection (V)" />
          <ToolButton toolId="hand" icon={Hand} label="Main - Déplacer (H)" />
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
          <ToolButton toolId="draw" icon={Pencil} label="Courbe libre (D)" />
          <ToolButton toolId="line" icon={Spline} label="Ligne/Courbe (L)" />
          <ToolButton toolId="geo" icon={Square} label="Formes (R)" />
          <ToolButton toolId="eraser" icon={Eraser} label="Gomme (E)" />
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Contrôles de zoom */}
        <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-sm">
          <Button variant="ghost" size="sm" onClick={handleZoomOut} title="Zoom arrière" className="h-8 w-8 p-0">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono w-12 text-center">{zoomLevel}%</span>
          <Button variant="ghost" size="sm" onClick={handleZoomIn} title="Zoom avant" className="h-8 w-8 p-0">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <Badge variant="outline" className="text-xs">
          <Ruler className="h-3 w-3 mr-1" />
          1px = {(1 / scaleFactor).toFixed(2)}mm
        </Badge>

        <Separator orientation="vertical" className="h-6" />

        <Button variant="outline" size="sm" onClick={handleResetView}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset
        </Button>

        <Button variant="outline" size="sm" onClick={handleSave}>
          <Save className="h-4 w-4 mr-1" />
          Sauver
        </Button>

        <Button variant="outline" size="sm" onClick={handleExportSVG}>
          <FileDown className="h-4 w-4 mr-1" />
          SVG
        </Button>

        <Button variant="default" size="sm" onClick={handleExportDXF}>
          <Download className="h-4 w-4 mr-1" />
          DXF
        </Button>

        <div className="flex-1" />

        <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>

        {isFullscreen && (
          <Badge variant="secondary" className="text-xs">
            <kbd className="mx-1 px-1 bg-gray-300 rounded">Échap</kbd>
          </Badge>
        )}
      </div>

      {/* Canvas tldraw avec interception de la molette */}
      <div ref={canvasContainerRef} className="flex-1 relative" style={{ overflow: "hidden" }}>
        <Tldraw onMount={handleMount} overrides={uiOverrides} hideUi={false} />
      </div>

      {/* Info en bas */}
      <div className="p-2 bg-gray-50 border-t text-xs text-muted-foreground flex justify-between">
        <span>
          💡 <strong>Molette</strong>: zoom • <strong>Clic milieu / Espace+glisser</strong>: déplacer
        </span>
        <span>Ligne/Courbe: double-clic pour terminer</span>
      </div>
    </div>
  );
}

export default TldrawGabaritCanvas;
