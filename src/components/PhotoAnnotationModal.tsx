import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, FabricImage, Rect, Line, Triangle } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Square, MousePointer, ArrowRight, Save } from "lucide-react";

interface Photo {
  id: string;
  url: string;
  description?: string;
  comment?: string;
  annotations?: any;
}

interface PhotoAnnotationModalProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const PhotoAnnotationModal = ({ photo, isOpen, onClose, onSave }: PhotoAnnotationModalProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "rectangle" | "arrow">("select");
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (photo) {
      setComment(photo.comment || "");
    }
  }, [photo]);

  useEffect(() => {
    if (!canvasRef.current || !isOpen || !photo) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: "#f5f5f5",
    });

    // Load image
    FabricImage.fromURL(photo.url, {
      crossOrigin: "anonymous",
    }).then((img) => {
      // Scale image to fit canvas
      const scale = Math.min(
        canvas.width! / img.width!,
        canvas.height! / img.height!
      );
      img.scale(scale);
      img.set({
        left: (canvas.width! - img.width! * scale) / 2,
        top: (canvas.height! - img.height! * scale) / 2,
        selectable: false,
      });
      canvas.add(img);
      canvas.sendObjectToBack(img);

      // Load saved annotations if they exist
      if (photo.annotations) {
        canvas.loadFromJSON(photo.annotations, () => {
          canvas.renderAll();
        });
      }
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [isOpen, photo]);

  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = false;
    fabricCanvas.selection = activeTool === "select";

    fabricCanvas.forEachObject((obj) => {
      if (obj.type !== "image") {
        obj.selectable = activeTool === "select";
      }
    });
  }, [activeTool, fabricCanvas]);

  const addRectangle = () => {
    if (!fabricCanvas) return;

    const rect = new Rect({
      left: 100,
      top: 100,
      width: 150,
      height: 100,
      fill: "transparent",
      stroke: "#ef4444",
      strokeWidth: 3,
    });

    fabricCanvas.add(rect);
    setActiveTool("select");
  };

  const addArrow = () => {
    if (!fabricCanvas) return;

    const line = new Line([50, 50, 200, 50], {
      stroke: "#ef4444",
      strokeWidth: 3,
    });

    const triangle = new Triangle({
      left: 200,
      top: 50,
      width: 20,
      height: 20,
      fill: "#ef4444",
      angle: 90,
      originX: "center",
      originY: "center",
    });

    fabricCanvas.add(line);
    fabricCanvas.add(triangle);
    setActiveTool("select");
  };

  const handleSave = async () => {
    if (!fabricCanvas || !photo) return;

    setIsSaving(true);

    try {
      const annotations = fabricCanvas.toJSON();

      const { error } = await supabase
        .from("project_photos")
        .update({
          annotations: annotations,
          comment: comment,
        })
        .eq("id", photo.id);

      if (error) {
        toast.error("Erreur lors de la sauvegarde");
        console.error(error);
        return;
      }

      toast.success("Annotations sauvegardées !");
      onSave();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  if (!photo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Annoter la photo</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden">
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                variant={activeTool === "select" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTool("select")}
              >
                <MousePointer className="h-4 w-4 mr-2" />
                Sélectionner
              </Button>
              <Button
                variant={activeTool === "rectangle" ? "default" : "outline"}
                size="sm"
                onClick={addRectangle}
              >
                <Square className="h-4 w-4 mr-2" />
                Rectangle
              </Button>
              <Button
                variant={activeTool === "arrow" ? "default" : "outline"}
                size="sm"
                onClick={addArrow}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Flèche
              </Button>
            </div>

            <div className="flex-1 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              <canvas ref={canvasRef} />
            </div>
          </div>

          <div className="w-80 flex flex-col gap-4">
            <div className="flex-1 flex flex-col gap-2">
              <Label htmlFor="comment">Commentaire</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ajoutez un commentaire sur cette photo..."
                className="flex-1 resize-none"
              />
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? (
                "Sauvegarde..."
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoAnnotationModal;
