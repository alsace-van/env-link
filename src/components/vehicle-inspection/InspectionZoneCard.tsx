import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Camera, Eye, Edit3, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageZoneSelector } from "@/components/ImageZoneSelector";

interface Photo {
  id: string;
  photo_url: string;
  annotated_photo_url?: string;
}

interface InspectionZoneCardProps {
  zone: {
    id: string;
    zone_name: string;
    zone_type: string;
    photos: Photo[];
  };
  projectId: string;
  onDelete?: () => void;
  onPhotoAdded: () => void;
}

export const InspectionZoneCard = ({
  zone,
  projectId,
  onDelete,
  onPhotoAdded,
}: InspectionZoneCardProps) => {
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);
  const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null);
  const [annotatePhotoId, setAnnotatePhotoId] = useState<string | null>(null);
  const [annotatePhotoUrl, setAnnotatePhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          const maxWidth = 1920;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name, { type: "image/jpeg" }));
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            0.85
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} est trop volumineux (max 10MB)`);
          continue;
        }

        // Compress image if > 2MB
        const processedFile = file.size > 2 * 1024 * 1024 
          ? await compressImage(file) 
          : file;

        const fileExt = processedFile.name.split(".").pop();
        const fileName = `${user.id}/${projectId}/zones/${zone.id}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("vehicle-inspections")
          .upload(fileName, processedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("vehicle-inspections")
          .getPublicUrl(fileName);

        const { error: dbError } = await supabase
          .from("inspection_photos")
          .insert({
            zone_id: zone.id,
            photo_url: publicUrl,
          });

        if (dbError) throw dbError;
      }

      toast.success("Photo(s) ajoutée(s)");
      onPhotoAdded();
    } catch (error: any) {
      console.error("Erreur upload:", error);
      toast.error(error.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeletePhoto = async () => {
    if (!deletePhotoId) return;

    try {
      const photo = zone.photos.find((p) => p.id === deletePhotoId);
      if (!photo) return;

      // Delete from storage
      const filePath = photo.photo_url.split("/vehicle-inspections/").pop();
      if (filePath) {
        await supabase.storage.from("vehicle-inspections").remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from("inspection_photos")
        .delete()
        .eq("id", deletePhotoId);

      if (error) throw error;

      toast.success("Photo supprimée");
      onPhotoAdded();
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleteDialogOpen(false);
      setDeletePhotoId(null);
    }
  };

  const handleAnnotationSave = async (canvas: HTMLCanvasElement) => {
    if (!annotatePhotoId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9);
      });
      
      const fileName = `${user.id}/${projectId}/zones/${zone.id}/annotated-${annotatePhotoId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("vehicle-inspections")
        .upload(fileName, blob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("vehicle-inspections")
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from("inspection_photos")
        .update({ annotated_photo_url: publicUrl })
        .eq("id", annotatePhotoId);

      if (dbError) throw dbError;

      toast.success("Annotation enregistrée");
      onPhotoAdded();
      setAnnotatePhotoId(null);
      setAnnotatePhotoUrl(null);
    } catch (error: any) {
      console.error("Erreur annotation:", error);
      toast.error("Erreur lors de l'annotation");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">
            {zone.zone_name}
            <Badge variant="secondary" className="ml-2">
              {zone.photos.length} photo{zone.photos.length !== 1 ? "s" : ""}
            </Badge>
          </CardTitle>
          {zone.zone_type === "custom" && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {uploading ? (
              <Skeleton className="aspect-video rounded-lg" />
            ) : null}
            {zone.photos.map((photo) => (
              <div key={photo.id} className="group relative aspect-video rounded-lg overflow-hidden border">
                <img
                  src={photo.annotated_photo_url || photo.photo_url}
                  alt={zone.zone_name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setViewPhotoUrl(photo.annotated_photo_url || photo.photo_url)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setAnnotatePhotoId(photo.id);
                      setAnnotatePhotoUrl(photo.photo_url);
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setDeletePhotoId(photo.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          <Button
            onClick={handleUploadClick}
            disabled={uploading}
            variant="outline"
            className="w-full"
          >
            {uploading ? (
              <Upload className="h-4 w-4 mr-2 animate-pulse" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            Ajouter une photo
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette photo ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePhoto}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewPhotoUrl} onOpenChange={() => setViewPhotoUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{zone.zone_name}</DialogTitle>
          </DialogHeader>
          <img src={viewPhotoUrl || ""} alt={zone.zone_name} className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>

      {annotatePhotoUrl && (
        <Dialog open={!!annotatePhotoId} onOpenChange={() => {
          setAnnotatePhotoId(null);
          setAnnotatePhotoUrl(null);
        }}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Annoter la photo</DialogTitle>
            </DialogHeader>
            <ImageZoneSelector
              imageUrl={annotatePhotoUrl}
              onZoneSelected={handleAnnotationSave}
              onCancel={() => {
                setAnnotatePhotoId(null);
                setAnnotatePhotoUrl(null);
              }}
              title="Dessinez une zone sur la photo"
              hint="Cliquez et glissez pour dessiner un rectangle"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
