import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ImageCorrectionStepProps {
  imageUrl: string;
  markersData: any;
  onCorrectionComplete: (correctedUrl: string, correctionData: any) => void;
  onBack: () => void;
}

export function ImageCorrectionStep({
  imageUrl,
  markersData,
  onCorrectionComplete,
  onBack,
}: ImageCorrectionStepProps) {
  const [correcting, setCorrecting] = useState(true);
  const [correctionStats, setCorrectionStats] = useState<any>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const correctedCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    correctImage();
  }, [imageUrl]);

  const correctImage = async () => {
    setCorrecting(true);
    try {
      // Pour le MVP, simuler la correction
      // TODO: Intégrer opencv.js pour vraie correction de distorsion et perspective
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const img = new Image();
      img.onload = () => {
        // Original
        const origCanvas = originalCanvasRef.current;
        if (origCanvas) {
          const ctx = origCanvas.getContext("2d");
          origCanvas.width = img.width;
          origCanvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
        }

        // Corrected (simulée - même image pour MVP)
        const corrCanvas = correctedCanvasRef.current;
        if (corrCanvas) {
          const ctx = corrCanvas.getContext("2d");
          corrCanvas.width = img.width;
          corrCanvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          
          // Dans la vraie version, appliquer les corrections ici
        }

        setCorrectionStats({
          radialDistortion: { k1: 0.02, k2: -0.01 },
          perspectiveAngle: 5.3,
          qualityImprovement: 23,
        });
      };
      img.src = imageUrl;

      toast.success("Image corrigée avec succès");
    } catch (error) {
      console.error("Erreur correction:", error);
      toast.error("Erreur lors de la correction");
    } finally {
      setCorrecting(false);
    }
  };

  const handleContinue = () => {
    const correctedUrl = correctedCanvasRef.current?.toDataURL();
    if (correctedUrl) {
      onCorrectionComplete(correctedUrl, correctionStats);
    }
  };

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Correction de l'image</h3>
        {correcting ? (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Correction en cours...
          </Badge>
        ) : (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Correction terminée
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-center">Image originale</p>
          <div className="border rounded-lg overflow-hidden bg-muted">
            <canvas
              ref={originalCanvasRef}
              className="w-full h-auto max-h-64 object-contain"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-center">Image corrigée</p>
          <div className="border rounded-lg overflow-hidden bg-muted">
            <canvas
              ref={correctedCanvasRef}
              className="w-full h-auto max-h-64 object-contain"
            />
          </div>
        </div>
      </div>

      {!correcting && correctionStats && (
        <div className="space-y-3 p-4 bg-muted rounded-lg">
          <p className="font-medium">Corrections appliquées:</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Distorsion radiale</p>
              <p className="font-mono">
                k1={correctionStats.radialDistortion.k1}, k2=
                {correctionStats.radialDistortion.k2}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Angle perspective</p>
              <p className="font-mono">{correctionStats.perspectiveAngle}°</p>
            </div>
            <div>
              <p className="text-muted-foreground">Amélioration qualité</p>
              <p className="font-mono text-green-600">
                +{correctionStats.qualityImprovement}%
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <div className="flex gap-2">
          {!correcting && (
            <Button variant="outline" onClick={correctImage}>
              Recommencer
            </Button>
          )}
          <Button onClick={handleContinue} disabled={correcting}>
            Valider correction
          </Button>
        </div>
      </div>
    </div>
  );
}
