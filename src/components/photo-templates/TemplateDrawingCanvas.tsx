import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Line, Circle, Rect, Textbox, FabricImage, Path } from "fabric";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Pencil,
  Square,
  Circle as CircleIcon,
  Minus,
  Type,
  Hand,
  ZoomIn,
  ZoomOut,
  Trash2,
  Undo,
  Download,
  Waves,
  Workflow,
  CircleDot,
  RectangleHorizontal,
  Ruler,
} from "lucide-react";
import { toast } from "sonner";

interface TemplateDrawingCanvasProps {
  imageUrl: string;
  scaleFactor: number; // pixels per mm
  onDrawingsChanged?: (drawingsData: any) => void;
  initialDrawings?: any;
}

export function TemplateDrawingCanvas({
  imageUrl,
  scaleFactor,
  onDrawingsChanged,
  initialDrawings,
}: TemplateDrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<
    "select" | "line" | "rectangle" | "circle" | "pencil" | "text" | "bezier" | "spline" | "arc3points" | "fillet" | "dimension"
  >("select");
  const [tempPoints, setTempPoints] = useState<{ x: number; y: number }[]>([]);
  const [strokeColor, setStrokeColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 1000,
      height: 700,
      backgroundColor: "#f5f5f5",
    });

    // Charger l'image de fond
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      
      // Ajuster les dimensions du canvas à l'image
      const maxWidth = 1000;
      const maxHeight = 700;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      
      canvas.setWidth(img.width * scale);
      canvas.setHeight(img.height * scale);
      canvas.backgroundColor = "#f5f5f5";
      
      // Ajouter l'image comme objet de fond non sélectionnable
      FabricImage.fromURL(imageUrl).then((fabricImg) => {
        fabricImg.set({
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
        });
        canvas.backgroundImage = fabricImg;
        canvas.renderAll();
      });

      canvas.renderAll();
    };
    img.src = imageUrl;

    setFabricCanvas(canvas);
    toast.success("Canevas de traçage prêt !");

    return () => {
      canvas.dispose();
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = activeTool === "pencil";
    fabricCanvas.selection = activeTool === "select";

    if (activeTool === "pencil" && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = strokeColor;
      fabricCanvas.freeDrawingBrush.width = strokeWidth;
    }

    // Gérer les autres outils
    if (activeTool !== "select" && activeTool !== "pencil") {
      fabricCanvas.off("mouse:down");
      fabricCanvas.off("mouse:move");
      fabricCanvas.off("mouse:up");

      let isDrawing = false;
      let startPoint: { x: number; y: number } | null = null;
      let activeObject: any = null;

      fabricCanvas.on("mouse:down", (e) => {
        if (!e.pointer) return;
        
        // Outils multi-points (bezier, spline, arc3points)
        if (activeTool === "bezier" || activeTool === "spline" || activeTool === "arc3points") {
          const newPoint = { x: e.pointer.x, y: e.pointer.y };
          const updatedPoints = [...tempPoints, newPoint];
          setTempPoints(updatedPoints);
          
          // Afficher les points temporaires avec des lignes de connexion
          const marker = new Circle({
            left: newPoint.x - 4,
            top: newPoint.y - 4,
            radius: 4,
            fill: strokeColor,
            selectable: false,
            originX: 'center',
            originY: 'center',
          });
          fabricCanvas.add(marker);
          
          // Dessiner une ligne de prévisualisation entre les points
          if (updatedPoints.length > 1) {
            const prevPoint = updatedPoints[updatedPoints.length - 2];
            const previewLine = new Line(
              [prevPoint.x, prevPoint.y, newPoint.x, newPoint.y],
              {
                stroke: strokeColor,
                strokeWidth: 1,
                strokeDashArray: [5, 5],
                selectable: false,
              }
            );
            fabricCanvas.add(previewLine);
          }
          
          // Créer la courbe si suffisamment de points
          if ((activeTool === "bezier" && updatedPoints.length === 4) ||
              (activeTool === "arc3points" && updatedPoints.length === 3)) {
            
            if (activeTool === "bezier") {
              // Courbe de Bézier cubique
              const [p0, p1, p2, p3] = updatedPoints;
              const pathData = `M ${p0.x},${p0.y} C ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
              const bezierPath = new Path(pathData, {
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                fill: 'transparent',
                strokeLineCap: 'round',
                strokeLineJoin: 'round',
              });
              fabricCanvas.add(bezierPath);
            } else if (activeTool === "arc3points") {
              // Arc par 3 points (quadratique)
              const [p1, p2, p3] = updatedPoints;
              const pathData = `M ${p1.x},${p1.y} Q ${p2.x},${p2.y} ${p3.x},${p3.y}`;
              const arcPath = new Path(pathData, {
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                fill: 'transparent',
                strokeLineCap: 'round',
                strokeLineJoin: 'round',
              });
              fabricCanvas.add(arcPath);
            }
            
            // Nettoyer les marqueurs et lignes temporaires
            fabricCanvas.getObjects().forEach((obj) => {
              if ((obj instanceof Circle && obj.radius === 4) || 
                  (obj instanceof Line && obj.strokeDashArray)) {
                fabricCanvas.remove(obj);
              }
            });
            
            setTempPoints([]);
            fabricCanvas.renderAll();
            saveDrawings();
            toast.success(`${activeTool === "bezier" ? "Courbe de Bézier" : "Arc"} créé(e)`);
          } else if (activeTool === "spline" && updatedPoints.length >= 3) {
            // Pour la spline, double-clic pour terminer (on vérifie si le dernier point est proche du précédent)
            if (updatedPoints.length >= 4) {
              const lastTwo = updatedPoints.slice(-2);
              const distance = Math.sqrt(
                Math.pow(lastTwo[1].x - lastTwo[0].x, 2) + 
                Math.pow(lastTwo[1].y - lastTwo[0].y, 2)
              );
              
              if (distance < 10) {
                // Double-clic détecté - créer la spline
                updatedPoints.pop(); // Retirer le dernier point dupliqué
                
                // Créer une courbe de Catmull-Rom qui passe par tous les points
                let pathData = `M ${updatedPoints[0].x},${updatedPoints[0].y}`;
                
                for (let i = 1; i < updatedPoints.length; i++) {
                  if (i === 1) {
                    pathData += ` L ${updatedPoints[i].x},${updatedPoints[i].y}`;
                  } else {
                    // Utiliser des courbes quadratiques pour lisser
                    const prevPoint = updatedPoints[i - 1];
                    const currentPoint = updatedPoints[i];
                    const controlX = (prevPoint.x + currentPoint.x) / 2;
                    const controlY = (prevPoint.y + currentPoint.y) / 2;
                    pathData += ` Q ${prevPoint.x},${prevPoint.y} ${controlX},${controlY}`;
                  }
                }
                
                // Ajouter le dernier segment
                const lastPoint = updatedPoints[updatedPoints.length - 1];
                pathData += ` L ${lastPoint.x},${lastPoint.y}`;
                
                const splinePath = new Path(pathData, {
                  stroke: strokeColor,
                  strokeWidth: strokeWidth,
                  fill: 'transparent',
                  strokeLineCap: 'round',
                  strokeLineJoin: 'round',
                });
                fabricCanvas.add(splinePath);
                
                // Nettoyer
                fabricCanvas.getObjects().forEach((obj) => {
                  if ((obj instanceof Circle && obj.radius === 4) || 
                      (obj instanceof Line && obj.strokeDashArray)) {
                    fabricCanvas.remove(obj);
                  }
                });
                
                setTempPoints([]);
                fabricCanvas.renderAll();
                saveDrawings();
                toast.success("Spline créée");
              }
            }
          }
          
          fabricCanvas.renderAll();
          return;
        }
        
        // Outil congé
        if (activeTool === "fillet") {
          const newPoint = { x: e.pointer.x, y: e.pointer.y };
          const updatedPoints = [...tempPoints, newPoint];
          setTempPoints(updatedPoints);
          
          const marker = new Circle({
            left: newPoint.x,
            top: newPoint.y,
            radius: 4,
            fill: strokeColor,
            selectable: false,
          });
          fabricCanvas.add(marker);
          
          if (updatedPoints.length === 3) {
            // Créer un congé (arc de cercle entre 3 points)
            const [p1, p2, p3] = updatedPoints;
            const radius = 20; // Rayon du congé
            const path = `M ${p1.x} ${p1.y} Q ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;
            const filletPath = new Path(path, {
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              fill: "",
            });
            fabricCanvas.add(filletPath);
            
            // Nettoyer les marqueurs temporaires (sans toucher à l'image de fond)
            const backgroundImg = fabricCanvas.backgroundImage;
            fabricCanvas.getObjects().forEach((obj) => {
              if (obj instanceof Circle && obj.radius === 4 && obj !== backgroundImg) {
                fabricCanvas.remove(obj);
              }
            });
            
            setTempPoints([]);
            fabricCanvas.renderAll();
            saveDrawings();
            toast.success("Congé créé");
          }
          
          fabricCanvas.renderAll();
          return;
        }
        
        // Outil cote/dimension
        if (activeTool === "dimension") {
          const newPoint = { x: e.pointer.x, y: e.pointer.y };
          const updatedPoints = [...tempPoints, newPoint];
          setTempPoints(updatedPoints);
          
          if (updatedPoints.length === 2) {
            const [p1, p2] = updatedPoints;
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const realDistance = (distance / scaleFactor).toFixed(2);
            
            // Ligne de cote
            const dimensionLine = new Line([p1.x, p1.y, p2.x, p2.y], {
              stroke: strokeColor,
              strokeWidth: strokeWidth,
            });
            fabricCanvas.add(dimensionLine);
            
            // Flèches aux extrémités
            const arrowSize = 8;
            const angle = Math.atan2(dy, dx);
            
            const arrow1 = new Path(
              `M ${p1.x} ${p1.y} L ${p1.x + arrowSize * Math.cos(angle + 0.5)} ${p1.y + arrowSize * Math.sin(angle + 0.5)} M ${p1.x} ${p1.y} L ${p1.x + arrowSize * Math.cos(angle - 0.5)} ${p1.y + arrowSize * Math.sin(angle - 0.5)}`,
              { stroke: strokeColor, strokeWidth: strokeWidth, fill: "" }
            );
            
            const arrow2 = new Path(
              `M ${p2.x} ${p2.y} L ${p2.x - arrowSize * Math.cos(angle + 0.5)} ${p2.y - arrowSize * Math.sin(angle + 0.5)} M ${p2.x} ${p2.y} L ${p2.x - arrowSize * Math.cos(angle - 0.5)} ${p2.y - arrowSize * Math.sin(angle - 0.5)}`,
              { stroke: strokeColor, strokeWidth: strokeWidth, fill: "" }
            );
            
            fabricCanvas.add(arrow1, arrow2);
            
            // Texte de la cote
            const text = new Textbox(`${realDistance} mm`, {
              left: (p1.x + p2.x) / 2,
              top: (p1.y + p2.y) / 2 - 15,
              fill: strokeColor,
              fontSize: 14,
              backgroundColor: "white",
            });
            fabricCanvas.add(text);
            
            setTempPoints([]);
            fabricCanvas.renderAll();
            saveDrawings();
            toast.success(`Cote ajoutée: ${realDistance} mm`);
          }
          
          return;
        }
        
        // Outils standards
        isDrawing = true;
        startPoint = { x: e.pointer.x, y: e.pointer.y };

        if (activeTool === "line") {
          activeObject = new Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
          });
          fabricCanvas.add(activeObject);
        } else if (activeTool === "rectangle") {
          activeObject = new Rect({
            left: startPoint.x,
            top: startPoint.y,
            width: 0,
            height: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: "transparent",
          });
          fabricCanvas.add(activeObject);
        } else if (activeTool === "circle") {
          activeObject = new Circle({
            left: startPoint.x,
            top: startPoint.y,
            radius: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: "transparent",
          });
          fabricCanvas.add(activeObject);
        } else if (activeTool === "text") {
          const text = new Textbox("Texte", {
            left: startPoint.x,
            top: startPoint.y,
            fill: strokeColor,
            fontSize: 20,
          });
          fabricCanvas.add(text);
          fabricCanvas.setActiveObject(text);
          text.enterEditing();
          isDrawing = false;
        }
      });

      fabricCanvas.on("mouse:move", (e) => {
        if (!isDrawing || !startPoint || !e.pointer || !activeObject) return;

        if (activeTool === "line") {
          activeObject.set({
            x2: e.pointer.x,
            y2: e.pointer.y,
          });
        } else if (activeTool === "rectangle") {
          const width = e.pointer.x - startPoint.x;
          const height = e.pointer.y - startPoint.y;
          activeObject.set({
            width: Math.abs(width),
            height: Math.abs(height),
            left: width > 0 ? startPoint.x : e.pointer.x,
            top: height > 0 ? startPoint.y : e.pointer.y,
          });
        } else if (activeTool === "circle") {
          const dx = e.pointer.x - startPoint.x;
          const dy = e.pointer.y - startPoint.y;
          const radius = Math.sqrt(dx * dx + dy * dy);
          activeObject.set({
            radius: radius,
          });
        }

        fabricCanvas.renderAll();
      });

      fabricCanvas.on("mouse:up", () => {
        isDrawing = false;
        startPoint = null;
        activeObject = null;
        saveDrawings();
      });
    }

    return () => {
      fabricCanvas.off("mouse:down");
      fabricCanvas.off("mouse:move");
      fabricCanvas.off("mouse:up");
    };
  }, [activeTool, strokeColor, strokeWidth, fabricCanvas]);

  const saveDrawings = () => {
    if (!fabricCanvas) return;
    // Sauvegarder seulement les objets dessinés, pas l'image de fond
    const json = fabricCanvas.toJSON();
    onDrawingsChanged?.(json);
    // S'assurer que l'image de fond est toujours présente
    fabricCanvas.renderAll();
  };

  const handleClear = () => {
    if (!fabricCanvas) return;
    const backgroundImg = fabricCanvas.backgroundImage;
    const objects = fabricCanvas.getObjects();
    objects.forEach((obj) => {
      fabricCanvas.remove(obj);
    });
    // Restaurer l'image de fond
    if (backgroundImg) {
      fabricCanvas.backgroundImage = backgroundImg;
    }
    fabricCanvas.renderAll();
    saveDrawings();
    toast.success("Dessins effacés");
  };

  const handleDeleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((obj) => fabricCanvas.remove(obj));
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
      saveDrawings();
      toast.success("Objet(s) supprimé(s)");
    }
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(3, z + 0.25));
    if (fabricCanvas) {
      const newZoom = Math.min(3, zoom + 0.25);
      fabricCanvas.setZoom(newZoom);
      fabricCanvas.renderAll();
    }
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.5, z - 0.25));
    if (fabricCanvas) {
      const newZoom = Math.max(0.5, zoom - 0.25);
      fabricCanvas.setZoom(newZoom);
      fabricCanvas.renderAll();
    }
  };

  const tools = [
    { id: "select", icon: Hand, label: "Sélection" },
    { id: "line", icon: Minus, label: "Ligne" },
    { id: "rectangle", icon: Square, label: "Rectangle" },
    { id: "circle", icon: CircleIcon, label: "Cercle" },
    { id: "pencil", icon: Pencil, label: "Crayon libre" },
    { id: "bezier", icon: Waves, label: "Courbe de Bézier (4 pts)" },
    { id: "spline", icon: Workflow, label: "Spline (4+ pts)" },
    { id: "arc3points", icon: CircleDot, label: "Arc 3 points" },
    { id: "fillet", icon: RectangleHorizontal, label: "Congé (3 pts)" },
    { id: "dimension", icon: Ruler, label: "Cote" },
    { id: "text", icon: Type, label: "Texte" },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
        {tempPoints.length > 0 && (
          <Badge variant="secondary" className="animate-pulse">
            {activeTool === "bezier" ? `Bézier: ${tempPoints.length}/4 points` :
             activeTool === "spline" ? `Spline: ${tempPoints.length} points (double-clic pour terminer)` :
             activeTool === "arc3points" ? `Arc: ${tempPoints.length}/3 points` :
             activeTool === "fillet" ? `Congé: ${tempPoints.length}/3 points` :
             activeTool === "dimension" ? `Cote: ${tempPoints.length}/2 points` : ""}
          </Badge>
        )}
        <div className="flex gap-1">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              variant={activeTool === tool.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTool(tool.id as any)}
              title={tool.label}
            >
              <tool.icon className="h-4 w-4" />
            </Button>
          ))}
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-2">
          <Label className="text-sm">Couleur:</Label>
          <Input
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            className="w-16 h-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm">Épaisseur:</Label>
          <Input
            type="number"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseInt(e.target.value) || 2)}
            className="w-16"
          />
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Badge variant="outline" className="px-3">
            {Math.round(zoom * 100)}%
          </Badge>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={handleDeleteSelected}>
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            Effacer tout
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="text-sm text-muted-foreground">
        <p>
          Échelle: 1 pixel = {(1 / scaleFactor).toFixed(3)} mm • Tracez les contours et
          annotations sur le gabarit
        </p>
      </div>

      {/* Canvas */}
      <div className="border rounded-lg overflow-auto bg-muted" style={{ maxHeight: "600px" }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
