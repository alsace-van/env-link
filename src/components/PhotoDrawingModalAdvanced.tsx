import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Pencil, Eraser, Type, Undo, Trash2, Save, X, SidebarOpen, SidebarClose, Square, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Photo {
  id: string;
  photo_url: string;
  description?: string | null;
  annotations?: any;
}

interface PhotoDrawingModalAdvancedProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface Path {
  points: Point[];
  color: string;
  lineWidth: number;
  isEraser: boolean;
}

interface TextAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

interface Shape {
  id: string;
  type: "rectangle" | "circle";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  lineWidth: number;
}

type DrawMode = "draw" | "erase" | "text" | "rectangle" | "circle";

const COLORS = [
  "#EF4444", // red
  "#F59E0B", // amber
  "#10B981", // green
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#000000", // black
  "#FFFFFF", // white
];

export const PhotoDrawingModalAdvanced = ({ photo, isOpen, onClose, onSave }: PhotoDrawingModalAdvancedProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<Path[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>("draw");
  const [drawColor, setDrawColor] = useState(COLORS[0]);
  const [lineWidth, setLineWidth] = useState(3);
  const [fontSize, setFontSize] = useState(24);
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [currentShape, setCurrentShape] = useState<{ startX: number; startY: number } | null>(null);
  const [sideNotes, setSideNotes] = useState("");
  const [comment, setComment] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Text input modal
  const [isAddingText, setIsAddingText] = useState(false);
  const [textPosition, setTextPosition] = useState<Point | null>(null);
  const [currentText, setCurrentText] = useState("");

  // Load image and existing annotations
  useEffect(() => {
    if (!photo || !isOpen) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImage(img);
      
      // Load existing annotations
      if (photo.annotations) {
        setPaths(photo.annotations.paths || []);
        setTextAnnotations(photo.annotations.textAnnotations || []);
        setShapes(photo.annotations.shapes || []);
        setSideNotes(photo.annotations.sideNotes || "");
        setComment(photo.annotations.comment || "");
      }
    };
    img.src = photo.photo_url;
  }, [photo, isOpen]);

  // Setup canvas dimensions
  useEffect(() => {
    if (!canvasRef.current || !image) return;

    const canvas = canvasRef.current;
    canvas.width = image.width;
    canvas.height = image.height;
    
    redrawCanvas();
  }, [image, paths, textAnnotations, shapes]);

  const redrawCanvas = () => {
    if (!canvasRef.current || !image) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    // Draw all paths
    paths.forEach((path) => {
      if (path.points.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (path.isEraser) {
        ctx.globalCompositeOperation = "destination-out";
      } else {
        ctx.globalCompositeOperation = "source-over";
      }

      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });

    // Reset composite operation
    ctx.globalCompositeOperation = "source-over";

    // Draw all text annotations
    textAnnotations.forEach((textAnnot) => {
      ctx.font = `${textAnnot.fontSize}px Arial`;
      ctx.fillStyle = textAnnot.color;
      
      // White outline for readability
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.strokeText(textAnnot.text, textAnnot.x, textAnnot.y);
      
      // Fill text
      ctx.fillText(textAnnot.text, textAnnot.x, textAnnot.y);
    });

    // Draw all shapes
    shapes.forEach((shape) => {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.lineWidth;

      if (shape.type === "rectangle") {
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
      } else if (shape.type === "circle") {
        ctx.beginPath();
        const radius = Math.sqrt(shape.width ** 2 + shape.height ** 2) / 2;
        const centerX = shape.x + shape.width / 2;
        const centerY = shape.y + shape.height / 2;
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });
  };

  const getCanvasCoordinates = (clientX: number, clientY: number): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e.clientX, e.clientY);

    if (drawMode === "text") {
      setTextPosition(coords);
      setIsAddingText(true);
      return;
    }

    if (drawMode === "rectangle" || drawMode === "circle") {
      setCurrentShape({ startX: coords.x, startY: coords.y });
      setIsDrawing(true);
      return;
    }

    setIsDrawing(true);
    setCurrentPath([coords]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || drawMode === "text") return;

    const coords = getCanvasCoordinates(e.clientX, e.clientY);

    if (drawMode === "rectangle" || drawMode === "circle") {
      if (!currentShape) return;
      
      // Redraw everything plus the preview shape
      redrawCanvas();
      
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;

      const width = coords.x - currentShape.startX;
      const height = coords.y - currentShape.startY;

      ctx.strokeStyle = drawColor;
      ctx.lineWidth = lineWidth;

      if (drawMode === "rectangle") {
        ctx.strokeRect(currentShape.startX, currentShape.startY, width, height);
      } else if (drawMode === "circle") {
        ctx.beginPath();
        const radius = Math.sqrt(width ** 2 + height ** 2) / 2;
        const centerX = currentShape.startX + width / 2;
        const centerY = currentShape.startY + height / 2;
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
      return;
    }

    setCurrentPath((prev) => [...prev, coords]);

    // Draw current path in real-time
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx || currentPath.length === 0) return;

    ctx.strokeStyle = drawColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (drawMode === "erase") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
    }

    const lastPoint = currentPath[currentPath.length - 1];
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    if (drawMode === "rectangle" || drawMode === "circle") {
      if (!currentShape) return;
      
      const coords = getCanvasCoordinates(e.clientX, e.clientY);
      const width = coords.x - currentShape.startX;
      const height = coords.y - currentShape.startY;

      if (Math.abs(width) > 5 || Math.abs(height) > 5) {
        setShapes((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: drawMode,
            x: currentShape.startX,
            y: currentShape.startY,
            width,
            height,
            color: drawColor,
            lineWidth: lineWidth,
          },
        ]);
      }

      setCurrentShape(null);
      setIsDrawing(false);
      return;
    }

    if (currentPath.length > 0) {
      setPaths((prev) => [
        ...prev,
        {
          points: currentPath,
          color: drawColor,
          lineWidth: lineWidth,
          isEraser: drawMode === "erase",
        },
      ]);
    }

    setIsDrawing(false);
    setCurrentPath([]);
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const coords = getCanvasCoordinates(touch.clientX, touch.clientY);

    if (drawMode === "text") {
      setTextPosition(coords);
      setIsAddingText(true);
      return;
    }

    setIsDrawing(true);
    setCurrentPath([coords]);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || drawMode === "text") return;

    const touch = e.touches[0];
    const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
    setCurrentPath((prev) => [...prev, coords]);

    // Draw current path in real-time
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx || currentPath.length === 0) return;

    ctx.strokeStyle = drawColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (drawMode === "erase") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
    }

    const lastPoint = currentPath[currentPath.length - 1];
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;

    if (drawMode === "rectangle" || drawMode === "circle") {
      if (!currentShape || e.changedTouches.length === 0) {
        setIsDrawing(false);
        return;
      }
      
      const touch = e.changedTouches[0];
      const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
      const width = coords.x - currentShape.startX;
      const height = coords.y - currentShape.startY;

      if (Math.abs(width) > 5 || Math.abs(height) > 5) {
        setShapes((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: drawMode,
            x: currentShape.startX,
            y: currentShape.startY,
            width,
            height,
            color: drawColor,
            lineWidth: lineWidth,
          },
        ]);
      }

      setCurrentShape(null);
      setIsDrawing(false);
      return;
    }

    if (currentPath.length > 0) {
      setPaths((prev) => [
        ...prev,
        {
          points: currentPath,
          color: drawColor,
          lineWidth: lineWidth,
          isEraser: drawMode === "erase",
        },
      ]);
    }

    setIsDrawing(false);
    setCurrentPath([]);
  };

  const handleAddText = () => {
    if (!textPosition || !currentText.trim()) return;

    setTextAnnotations((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        x: textPosition.x,
        y: textPosition.y,
        text: currentText,
        color: drawColor,
        fontSize: fontSize,
      },
    ]);

    setCurrentText("");
    setTextPosition(null);
    setIsAddingText(false);
  };

  const handleUndo = () => {
    if (shapes.length > 0) {
      setShapes((prev) => prev.slice(0, -1));
    } else if (textAnnotations.length > 0) {
      setTextAnnotations((prev) => prev.slice(0, -1));
    } else if (paths.length > 0) {
      setPaths((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setPaths([]);
    setTextAnnotations([]);
    setShapes([]);
  };

  const handleSave = async () => {
    if (!photo || !canvasRef.current) return;

    setIsSaving(true);

    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvasRef.current!.toBlob((b) => resolve(b!), "image/png");
      });

      // Upload annotated image
      const fileName = `annotated_${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("project_photos")
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("project_photos")
        .getPublicUrl(uploadData.path);

      // Update photo with annotations
      const { error: updateError } = await supabase
        .from("project_photos")
        .update({
          annotations: {
            paths,
            textAnnotations,
            shapes,
            sideNotes,
            comment,
            annotated_url: publicUrl,
          } as any,
        })
        .eq("id", photo.id);

      if (updateError) throw updateError;

      toast.success("Annotations sauvegardées");
      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving annotations:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  if (!photo) return null;

  const totalPaths = paths.length;
  const totalTexts = textAnnotations.length;
  const totalShapes = shapes.length;
  const notesLines = sideNotes.split("\n").length;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[98vw] max-h-[98vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Annoter la photo</DialogTitle>
          </DialogHeader>

          <div className="flex h-[calc(98vh-80px)]">
            {/* Canvas area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="sticky top-0 z-10 bg-background border-b p-4 space-y-4">
                {/* Mode buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={drawMode === "draw" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDrawMode("draw")}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Dessiner
                  </Button>
                  <Button
                    variant={drawMode === "erase" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDrawMode("erase")}
                  >
                    <Eraser className="h-4 w-4 mr-2" />
                    Gomme
                  </Button>
                  <Button
                    variant={drawMode === "text" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDrawMode("text")}
                  >
                    <Type className="h-4 w-4 mr-2" />
                    Texte
                  </Button>
                  <Button
                    variant={drawMode === "rectangle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDrawMode("rectangle")}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Rectangle
                  </Button>
                  <Button
                    variant={drawMode === "circle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDrawMode("circle")}
                  >
                    <Circle className="h-4 w-4 mr-2" />
                    Cercle
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleUndo}>
                    <Undo className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClear}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Effacer tout
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSidebar(!showSidebar)}
                  >
                    {showSidebar ? (
                      <SidebarClose className="h-4 w-4" />
                    ) : (
                      <SidebarOpen className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Color palette */}
                <div className="flex gap-2 flex-wrap items-center">
                  <Label className="text-sm">Couleur:</Label>
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor: drawColor === color ? "#000" : "#ccc",
                      }}
                      onClick={() => setDrawColor(color)}
                    />
                  ))}
                </div>

                {/* Controls based on mode */}
                {drawMode === "text" ? (
                  <div className="flex items-center gap-4">
                    <Label className="text-sm whitespace-nowrap">Taille texte:</Label>
                    <Slider
                      value={[fontSize]}
                      onValueChange={(v) => setFontSize(v[0])}
                      min={12}
                      max={72}
                      step={2}
                      className="w-48"
                    />
                    <span className="text-sm font-medium">{fontSize}px</span>
                  </div>
                ) : drawMode === "rectangle" || drawMode === "circle" ? (
                  <div className="flex items-center gap-4">
                    <Label className="text-sm whitespace-nowrap">Épaisseur contour:</Label>
                    <Slider
                      value={[lineWidth]}
                      onValueChange={(v) => setLineWidth(v[0])}
                      min={1}
                      max={20}
                      step={1}
                      className="w-48"
                    />
                    <span className="text-sm font-medium">{lineWidth}px</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <Label className="text-sm whitespace-nowrap">Épaisseur:</Label>
                    <Slider
                      value={[lineWidth]}
                      onValueChange={(v) => setLineWidth(v[0])}
                      min={1}
                      max={20}
                      step={1}
                      className="w-48"
                    />
                    <span className="text-sm font-medium">{lineWidth}px</span>
                  </div>
                )}
              </div>

              {/* Canvas */}
              <div className="flex-1 overflow-auto p-4 bg-muted/20">
                <canvas
                  ref={canvasRef}
                  className="max-w-full h-auto border shadow-lg bg-white cursor-crosshair"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  style={{ touchAction: "none" }}
                />
              </div>
            </div>

            {/* Sidebar */}
            {showSidebar && (
              <div className="w-80 border-l flex flex-col bg-background">
                <div className="flex-1 overflow-auto p-4 space-y-6">
                  {/* Notes détaillées */}
                  <div className="space-y-2">
                    <Label>Notes détaillées</Label>
                    <Textarea
                      value={sideNotes}
                      onChange={(e) => setSideNotes(e.target.value)}
                      placeholder="Ajoutez des notes détaillées..."
                      className="min-h-[150px] resize-none"
                    />
                  </div>

                  {/* Commentaire court */}
                  <div className="space-y-2">
                    <Label>Commentaire court</Label>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Commentaire rapide..."
                      className="min-h-[80px] resize-none"
                    />
                  </div>

                  {/* Stats */}
                  <div className="space-y-2">
                    <Label>Statistiques</Label>
                    <div className="text-sm text-muted-foreground space-y-1 p-3 bg-muted rounded-md">
                      <div>Traits dessinés: {totalPaths}</div>
                      <div>Formes ajoutées: {totalShapes}</div>
                      <div>Textes ajoutés: {totalTexts}</div>
                      <div>Lignes de notes: {notesLines}</div>
                    </div>
                  </div>
                </div>

                {/* Sticky buttons */}
                <div className="sticky bottom-0 border-t bg-background p-4 space-y-2">
                  <Button
                    className="w-full"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={onClose}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Text input modal */}
      <Dialog open={isAddingText} onOpenChange={setIsAddingText}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter du texte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Texte</Label>
              <Input
                value={currentText}
                onChange={(e) => setCurrentText(e.target.value)}
                placeholder="Entrez votre texte..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddText();
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddText} disabled={!currentText.trim()}>
                Ajouter
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddingText(false);
                  setCurrentText("");
                  setTextPosition(null);
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
