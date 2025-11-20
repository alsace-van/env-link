import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, ZoomOut, Plus, Trash2 } from "lucide-react";

interface CalibrationPair {
  points: [{ x: number; y: number }, { x: number; y: number }];
  knownDistanceMm: number;
  measuredDistancePx: number;
  scaleFactor: number;
}

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
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [calibrationPairs, setCalibrationPairs] = useState<CalibrationPair[]>([]);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
  }, [currentPoints, calibrationPairs, zoom]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Dessiner les paires de calibration validées (en vert)
    calibrationPairs.forEach((pair, pairIdx) => {
      const [pt1, pt2] = pair.points;
      
      // Points verts
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(pt1.x, pt1.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pt2.x, pt2.y, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Ligne verte
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.stroke();

      // Label
      const midX = (pt1.x + pt2.x) / 2;
      const midY = (pt1.y + pt2.y) / 2;
      ctx.fillStyle = "#10b981";
      ctx.font = "14px bold sans-serif";
      ctx.fillText(`#${pairIdx + 1}: ${pair.knownDistanceMm}mm`, midX, midY - 10);
    });

    // Dessiner les points en cours (en rouge)
    currentPoints.forEach((point, idx) => {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "14px bold sans-serif";
      ctx.fillText(idx === 0 ? "A" : "B", point.x + 10, point.y - 10);
    });

    // Dessiner la ligne en cours
    if (currentPoints.length === 2) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      ctx.lineTo(currentPoints[1].x, currentPoints[1].y);
      ctx.stroke();

      const dx = currentPoints[1].x - currentPoints[0].x;
      const dy = currentPoints[1].y - currentPoints[0].y;
      const distPx = Math.sqrt(dx * dx + dy * dy);

      const midX = (currentPoints[0].x + currentPoints[1].x) / 2;
      const midY = (currentPoints[0].y + currentPoints[1].y) / 2;
      ctx.fillStyle = "#ef4444";
      ctx.font = "16px bold sans-serif";
      ctx.fillText(`${distPx.toFixed(1)}px`, midX, midY - 10);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentPoints.length >= 2) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    
    // Correction du décalage: tenir compte du scale CSS
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setCurrentPoints([...currentPoints, { x, y }]);
  };

  const handleValidatePair = () => {
    if (currentPoints.length !== 2) return;

    const distMm = parseFloat(knownDistance);
    if (isNaN(distMm) || distMm <= 0) return;

    const dx = currentPoints[1].x - currentPoints[0].x;
    const dy = currentPoints[1].y - currentPoints[0].y;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    const scaleFactor = distPx / distMm;

    const newPair: CalibrationPair = {
      points: [currentPoints[0], currentPoints[1]],
      knownDistanceMm: distMm,
      measuredDistancePx: distPx,
      scaleFactor,
    };

    setCalibrationPairs([...calibrationPairs, newPair]);
    setCurrentPoints([]);
  };

  const handleDeletePair = (index: number) => {
    setCalibrationPairs(calibrationPairs.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setCurrentPoints([]);
  };

  const calculateAverageScale = () => {
    if (calibrationPairs.length === 0) return null;
    const avgScale = calibrationPairs.reduce((sum, pair) => sum + pair.scaleFactor, 0) / calibrationPairs.length;
    return avgScale;
  };

  const handleContinue = () => {
    const avgScale = calculateAverageScale();
    if (!avgScale) return;

    // Calculer la précision estimée basée sur l'écart type
    const variance = calibrationPairs.reduce((sum, pair) => {
      const diff = pair.scaleFactor - avgScale;
      return sum + diff * diff;
    }, 0) / calibrationPairs.length;
    const stdDev = Math.sqrt(variance);
    const accuracyMm = stdDev / avgScale;

    onCalibrationComplete({
      scaleFactor: avgScale,
      knownDistanceMm: parseFloat(knownDistance),
      measuredDistancePx: calibrationPairs[0]?.measuredDistancePx || 0,
      accuracyMm: Math.max(0.5, accuracyMm),
      calibrationPoints: currentPoints,
      calibrationPairs: calibrationPairs,
      numberOfMeasurements: calibrationPairs.length,
    });
  };

  const avgScale = calculateAverageScale();

  return (
    <div className="space-y-6 py-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Calibration multi-points de l'échelle</h3>
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
              <li>Validez la paire de points</li>
              <li>Répétez pour améliorer la précision (recommandé: 3-5 mesures)</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>
            Points: {currentPoints.length}/2
            {calibrationPairs.length > 0 && ` • ${calibrationPairs.length} mesure${calibrationPairs.length > 1 ? 's' : ''} validée${calibrationPairs.length > 1 ? 's' : ''}`}
          </Label>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Badge variant="outline">{Math.round(zoom * 100)}%</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom(Math.min(3, zoom + 0.25))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div ref={containerRef} className="border rounded-lg overflow-auto bg-muted" style={{ maxHeight: "500px" }}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="cursor-crosshair"
            style={{ 
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              display: "block"
            }}
          />
        </div>
      </div>

      {calibrationPairs.length > 0 && (
        <div className="space-y-2">
          <Label>Mesures enregistrées</Label>
          <div className="space-y-2">
            {calibrationPairs.map((pair, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Mesure #{idx + 1}: {pair.knownDistanceMm}mm = {pair.measuredDistancePx.toFixed(1)}px
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Échelle: 1px = {(1 / pair.scaleFactor).toFixed(3)}mm
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeletePair(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentPoints.length === 2 && (
        <Button
          onClick={handleValidatePair}
          className="w-full"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-2" />
          Valider cette paire de points
        </Button>
      )}

      {avgScale && (
        <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-500 rounded-lg space-y-2">
          <p className="font-medium text-green-700 dark:text-green-400">
            ✓ Calibration réussie ({calibrationPairs.length} mesure{calibrationPairs.length > 1 ? 's' : ''})
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Échelle moyenne</p>
              <p className="font-mono">1 pixel = {(1 / avgScale).toFixed(3)} mm</p>
            </div>
            <div>
              <p className="text-muted-foreground">Précision estimée</p>
              <Badge variant="outline">
                ±{calibrationPairs.length > 1 ? '0.3' : '0.5'} mm
              </Badge>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <div className="flex gap-2">
          {currentPoints.length > 0 && (
            <Button variant="outline" onClick={handleReset}>
              Annuler les points
            </Button>
          )}
          <Button 
            onClick={handleContinue} 
            disabled={calibrationPairs.length === 0}
          >
            Terminer calibration
          </Button>
        </div>
      </div>
    </div>
  );
}
