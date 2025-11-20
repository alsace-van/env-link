import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MarkerDetectionStepProps {
  imageUrl: string;
  onMarkersDetected: (data: any) => void;
  onBack: () => void;
}

export function MarkerDetectionStep({
  imageUrl,
  onMarkersDetected,
  onBack,
}: MarkerDetectionStepProps) {
  const [detecting, setDetecting] = useState(true);
  const [markerCount, setMarkerCount] = useState(0);
  const [detectedIds, setDetectedIds] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    detectMarkers();
  }, [imageUrl]);

  const detectMarkers = async () => {
    setDetecting(true);
    try {
      // Pour le MVP, simuler la détection
      // TODO: Intégrer opencv.js pour vraie détection ArUco
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Simulation: détection de 7 marqueurs sur 9
      const simDetectedIds = [0, 1, 2, 3, 4, 6, 8];
      setDetectedIds(simDetectedIds);
      setMarkerCount(simDetectedIds.length);

      // Dessiner l'image avec marqueurs simulés
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);

          // Dessiner des carrés verts pour simuler les marqueurs détectés
          ctx!.strokeStyle = "#10b981";
          ctx!.lineWidth = 4;
          simDetectedIds.forEach((id, idx) => {
            const x = ((id % 3) * img.width) / 3 + img.width / 6;
            const y = (Math.floor(id / 3) * img.height) / 3 + img.height / 6;
            const size = 60;
            ctx!.strokeRect(x - size / 2, y - size / 2, size, size);
            ctx!.fillStyle = "#10b981";
            ctx!.font = "20px bold sans-serif";
            ctx!.fillText(`#${id}`, x - 10, y + 5);
          });
        };
        img.src = imageUrl;
      }

      toast.success(`${simDetectedIds.length} marqueurs détectés`);
    } catch (error) {
      console.error("Erreur détection:", error);
      toast.error("Erreur lors de la détection des marqueurs");
    } finally {
      setDetecting(false);
    }
  };

  const handleContinue = () => {
    onMarkersDetected({
      markerCount,
      detectedIds,
      markersImageUrl: canvasRef.current?.toDataURL(),
    });
  };

  return (
    <div className="space-y-6 py-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Détection des marqueurs ArUco</h3>
          {detecting ? (
            <Badge variant="secondary">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Détection en cours...
            </Badge>
          ) : (
            <Badge
              variant={markerCount >= 6 ? "default" : "destructive"}
              className={markerCount >= 6 ? "bg-green-500" : ""}
            >
              {markerCount >= 6 ? (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              ) : (
                <AlertTriangle className="h-3 w-3 mr-1" />
              )}
              {markerCount}/9 marqueurs
            </Badge>
          )}
        </div>

        {!detecting && markerCount < 6 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Détection partielle. Pour une meilleure précision, assurez-vous que:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>L'éclairage est uniforme</li>
                <li>La photo est nette (pas de flou)</li>
                <li>L'angle de prise de vue est correct</li>
                <li>Tous les marqueurs sont visibles</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {!detecting && markerCount >= 6 && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              Excellente détection ! La calibration sera précise.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden bg-muted">
        <canvas
          ref={canvasRef}
          className="w-full h-auto max-h-[500px] object-contain"
        />
      </div>

      {!detecting && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Marqueurs détectés:</p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 9 }).map((_, idx) => (
              <Badge
                key={idx}
                variant={detectedIds.includes(idx) ? "default" : "outline"}
                className={
                  detectedIds.includes(idx)
                    ? "bg-green-500"
                    : "opacity-50"
                }
              >
                #{idx}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <div className="flex gap-2">
          {!detecting && (
            <Button variant="outline" onClick={detectMarkers}>
              Re-détecter
            </Button>
          )}
          <Button
            onClick={handleContinue}
            disabled={detecting || markerCount === 0}
          >
            Continuer la correction
          </Button>
        </div>
      </div>
    </div>
  );
}
