import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, ZoomOut } from "lucide-react";

interface ScaleCalibrationStepProps {
  imageUrl: string;
  markersData: any;
  onCalibrationComplete: (data: any) => void;
  onBack: () => void;
}

export function ScaleCalibrationStep({
  imageUrl,
  markersData,
  onCalibrationComplete,
  onBack,
}: ScaleCalibrationStepProps) {
  const [knownDistance, setKnownDistance] = useState("40");
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [scaleFactor, setScaleFactor] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      canvas.width = img.width;
      canvas.height = img.height;
      drawCanvas();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    drawCanvas();
  }, [points, zoom]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Dessiner les points
    points.forEach((point, idx) => {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5 / zoom, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `${14 / zoom}px bold sans-serif`;
      ctx.fillText(idx === 0 ? "A" : "B", point.x + 10 / zoom, point.y - 10 / zoom);
    });

    // Dessiner la ligne
    if (points.length === 2) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();

      // Calculer la distance en pixels
      const dx = points[1].x - points[0].x;
      const dy = points[1].y - points[0].y;
      const distPx = Math.sqrt(dx * dx + dy * dy);

      // Afficher la distance
      const midX = (points[0].x + points[1].x) / 2;
      const midY = (points[0].y + points[1].y) / 2;
      ctx.fillStyle = "#ef4444";
      ctx.font = `${16 / zoom}px bold sans-serif`;
      ctx.fillText(`${distPx.toFixed(1)}px`, midX, midY - 10 / zoom);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (points.length >= 2) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const newPoints = [...points, { x, y }];
    setPoints(newPoints);

    if (newPoints.length === 2) {
      calculateScale(newPoints);
    }
  };

  const calculateScale = (pts: { x: number; y: number }[]) => {
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    const distMm = parseFloat(knownDistance);

    if (!isNaN(distMm) && distMm > 0) {
      const scale = distPx / distMm;
      setScaleFactor(scale);
    }
  };

  const handleReset = () => {
    setPoints([]);
    setScaleFactor(null);
  };

  const handleContinue = () => {
    if (scaleFactor) {
      const dx = points[1].x - points[0].x;
      const dy = points[1].y - points[0].y;
      const distPx = Math.sqrt(dx * dx + dy * dy);

      onCalibrationComplete({
        scaleFactor,
        knownDistanceMm: parseFloat(knownDistance),
        measuredDistancePx: distPx,
        accuracyMm: 0.5, // Estimation
        calibrationPoints: points,
      });
    }
  };

  return (
    <div className="space-y-6 py-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Calibration de l'échelle</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="distance">Distance connue (mm)</Label>
            <Input
              id="distance"
              type="number"
              value={knownDistance}
              onChange={(e) => setKnownDistance(e.target.value)}
              placeholder="40"
            />
            <p className="text-xs text-muted-foreground">
              Par exemple: 40mm (taille marqueur ArUco standard)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Instructions</Label>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Cliquez sur le premier point (A)</li>
              <li>Cliquez sur le deuxième point (B)</li>
              <li>L'échelle sera calculée automatiquement</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>Cliquez sur 2 points espacés de {knownDistance}mm</Label>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom(Math.min(3, zoom + 0.25))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden bg-muted">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-full h-auto max-h-96 object-contain cursor-crosshair"
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          />
        </div>
      </div>

      {scaleFactor && (
        <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-500 rounded-lg space-y-2">
          <p className="font-medium text-green-700 dark:text-green-400">
            ✓ Calibration réussie
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Échelle</p>
              <p className="font-mono">1 pixel = {(1 / scaleFactor).toFixed(3)} mm</p>
            </div>
            <div>
              <p className="text-muted-foreground">Précision estimée</p>
              <Badge variant="outline">±0.5 mm</Badge>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <div className="flex gap-2">
          {points.length > 0 && (
            <Button variant="outline" onClick={handleReset}>
              Recalibrer
            </Button>
          )}
          <Button onClick={handleContinue} disabled={!scaleFactor}>
            Terminer calibration
          </Button>
        </div>
      </div>
    </div>
  );
}
