import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Zone {
  id: string;
  zone_name: string;
}

interface AddDamageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionId: string;
  projectId: string;
  zones: Zone[];
  onAdded: () => void;
}

export const AddDamageDialog = ({
  open,
  onOpenChange,
  inspectionId,
  projectId,
  zones,
  onAdded,
}: AddDamageDialogProps) => {
  const [zoneId, setZoneId] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"minor" | "moderate" | "severe">("minor");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneId || !description.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      let photoUrl = null;

      if (photoFile) {
        const fileExt = photoFile.name.split(".").pop();
        const fileName = `${user.id}/${projectId}/damages/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("vehicle-inspections")
          .upload(fileName, photoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("vehicle-inspections")
          .getPublicUrl(fileName);

        photoUrl = publicUrl;
      }

      const { error: dbError } = await supabase
        .from("vehicle_damages")
        .insert({
          inspection_id: inspectionId,
          zone_id: zoneId,
          description: description.trim(),
          severity,
          photo_url: photoUrl,
        });

      if (dbError) throw dbError;

      toast.success("Dégât ajouté");
      resetForm();
      onOpenChange(false);
      onAdded();
    } catch (error: any) {
      console.error("Erreur ajout dégât:", error);
      toast.error(error.message || "Erreur lors de l'ajout");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setZoneId("");
    setDescription("");
    setSeverity("minor");
    setPhotoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ajouter un dégât constaté</DialogTitle>
            <DialogDescription>
              Documentez les dégâts visibles sur le véhicule
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="zone">Zone concernée</Label>
              <Select value={zoneId} onValueChange={setZoneId}>
                <SelectTrigger id="zone">
                  <SelectValue placeholder="Sélectionner une zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.zone_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="severity">Gravité</Label>
              <Select
                value={severity}
                onValueChange={(value: "minor" | "moderate" | "severe") =>
                  setSeverity(value)
                }
              >
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">⚠️ Mineur</SelectItem>
                  <SelectItem value="moderate">🔶 Moyen</SelectItem>
                  <SelectItem value="severe">🔴 Grave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez le dégât..."
                rows={3}
              />
            </div>

            <div>
              <Label>Photo du dégât (optionnel)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      toast.error("Fichier trop volumineux (max 10MB)");
                      return;
                    }
                    setPhotoFile(file);
                  }
                }}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {photoFile ? photoFile.name : "Choisir une photo"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? (
                <>Ajout...</>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
