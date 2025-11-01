import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";

interface ImageZoneSelectorProps {
  imageUrl: string;
  onZoneSelected: (canvas: HTMLCanvasElement) => void;
  onCancel: () => void;
  title: string;
  hint: string;
}

interface Rectangle {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export const ImageZoneSelector = ({ imageUrl, onZoneSelected, onCancel, title, hint }: ImageZoneSelectorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [rectangle, setRectangle] = useState<Rectangle | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);

  console.log("📸 ImageZoneSelector monté !", { imageUrl: imageUrl.substring(0, 50) });

  // Charger l'image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Redessiner le canvas quand le rectangle change
  useEffect(() => {
    if (imageRef.current) {
      drawCanvas();
    }
  }, [rectangle, currentPos]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Redimensionner le canvas pour s'adapter à l'image
    canvas.width = img.width;
    canvas.height = img.height;

    // Dessiner l'image
    ctx.drawImage(img, 0, 0);

    // Dessiner le rectangle de sélection
    if (rectangle || (isDrawing && currentPos)) {
      ctx.strokeStyle = "#3b82f6";
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
      ctx.lineWidth = 3;

      const rect = rectangle || {
        startX: currentPos!.x,
        startY: currentPos!.y,
        endX: currentPos!.x,
        endY: currentPos!.y,
      };

      const x = Math.min(rect.startX, rect.endX);
      const y = Math.min(rect.startY, rect.endY);
      const width = Math.abs(rect.endX - rect.startX);
      const height = Math.abs(rect.endY - rect.startY);

      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);

      // Afficher les dimensions
      if (width > 50 && height > 20) {
        ctx.fillStyle = "#3b82f6";
        ctx.font = "14px sans-serif";
        ctx.fillText(`${Math.round(width)} x ${Math.round(height)}`, x + 5, y - 5);
      }
    }
  };

  const getCanvasCoordinates = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Événements souris
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    setIsDrawing(true);
    setCurrentPos(coords);
    setRectangle({ startX: coords.x, startY: coords.y, endX: coords.x, endY: coords.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !rectangle) return;
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    setRectangle({ ...rectangle, endX: coords.x, endY: coords.y });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setCurrentPos(null);
  };

  // Événements tactiles (mobile)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
    setIsDrawing(true);
    setCurrentPos(coords);
    setRectangle({ startX: coords.x, startY: coords.y, endX: coords.x, endY: coords.y });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !rectangle) return;
    const touch = e.touches[0];
    const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
    setRectangle({ ...rectangle, endX: coords.x, endY: coords.y });
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(false);
    setCurrentPos(null);
  };

  const handleConfirm = () => {
    if (!rectangle || !imageRef.current) return;

    const img = imageRef.current;

    // Calculer les coordonnées du rectangle
    const x = Math.min(rectangle.startX, rectangle.endX);
    const y = Math.min(rectangle.startY, rectangle.endY);
    const width = Math.abs(rectangle.endX - rectangle.startX);
    const height = Math.abs(rectangle.endY - rectangle.startY);

    // Vérifier que la zone est suffisamment grande
    if (width < 50 || height < 20) {
      alert("La zone sélectionnée est trop petite. Essayez de dessiner un rectangle plus grand.");
      return;
    }

    // Créer un canvas temporaire pour extraire la zone
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext("2d");

    if (!ctx) return;

    // Copier la zone sélectionnée
    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

    // Retourner le canvas avec la zone sélectionnée
    onZoneSelected(tempCanvas);
  };

  const hasValidSelection =
    rectangle && Math.abs(rectangle.endX - rectangle.startX) > 50 && Math.abs(rectangle.endY - rectangle.startY) > 20;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground">{hint}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Canvas avec l'image */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className="border-2 border-gray-300 max-w-full h-auto cursor-crosshair"
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

        {/* Instructions et boutons */}
        <div className="p-4 border-t space-y-3">
          <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
            <p className="font-medium text-blue-900 mb-1">💡 Instructions :</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>
                <strong>Desktop :</strong> Cliquez et glissez pour dessiner un rectangle
              </li>
              <li>
                <strong>Mobile :</strong> Touchez et glissez avec votre doigt
              </li>
              <li>Sélectionnez toute la ligne avec un peu de marge</li>
              <li>
                <strong>Important :</strong> La zone sera agrandie x3 automatiquement
              </li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleConfirm} disabled={!hasValidSelection} className="flex-1">
              <Check className="h-4 w-4 mr-2" />
              Rescanner cette zone
            </Button>
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
