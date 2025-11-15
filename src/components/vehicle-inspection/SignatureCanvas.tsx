import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";

interface SignatureCanvasComponentProps {
  signedBy: string;
  onSignedByChange: (value: string) => void;
  onSignatureChange: (dataUrl: string | null) => void;
}

export const SignatureCanvasComponent = ({
  signedBy,
  onSignedByChange,
  onSignatureChange,
}: SignatureCanvasComponentProps) => {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const handleClear = () => {
    sigCanvas.current?.clear();
    onSignatureChange(null);
  };

  const handleEnd = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const dataUrl = sigCanvas.current.toDataURL("image/png");
      onSignatureChange(dataUrl);
    }
  };

  useEffect(() => {
    // Set canvas background to white
    const canvas = sigCanvas.current?.getCanvas();
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          ✍️ Signature du client
        </CardTitle>
        <CardDescription>
          Le client doit signer pour attester de l'état du véhicule
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="signedBy">Nom du signataire</Label>
          <Input
            id="signedBy"
            value={signedBy}
            onChange={(e) => onSignedByChange(e.target.value)}
            placeholder="Nom et prénom du client"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>Signature</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Effacer
            </Button>
          </div>
          <div className="border-2 border-dashed border-border rounded-lg overflow-hidden">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                className: "w-full h-[150px] bg-background cursor-crosshair",
              }}
              onEnd={handleEnd}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Date de signature : {new Date().toLocaleDateString("fr-FR")}
        </p>
      </CardContent>
    </Card>
  );
};
