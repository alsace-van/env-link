import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";

interface Photo {
  id: string;
  url: string;
  description?: string;
  comment?: string;
  annotations?: any;
  storagePath?: string; // Store original path for deletion
}

interface PhotoGalleryProps {
  projectId: string;
  type: "projet" | "inspiration";
  refresh: number;
  onPhotoClick: (photo: Photo) => void;
}

const PhotoGallery = ({ projectId, type, refresh, onPhotoClick }: PhotoGalleryProps) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPhotos();
  }, [projectId, type, refresh]);

  const loadPhotos = async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("project_photos")
      .select("*")
      .eq("project_id", projectId)
      .eq("type", type)
      .order("created_at", { ascending: false });

    setIsLoading(false);

    if (error) {
      toast.error("Erreur lors du chargement des photos");
      console.error(error);
      return;
    }

    // Generate signed URLs for private bucket photos
    if (data) {
      const photosWithSignedUrls = await Promise.all(
        data.map(async (photo) => {
          let storagePath = photo.url;
          
          // Check if URL is already a full URL (old format) or just a path
          if (photo.url.startsWith('http')) {
            // Old format with full URL - extract path and generate signed URL
            const urlParts = photo.url.split('/project-photos/');
            if (urlParts.length === 2) {
              storagePath = urlParts[1];
              const { data: signedUrlData } = await supabase.storage
                .from('project-photos')
                .createSignedUrl(storagePath, 3600); // 1 hour expiration
              return { ...photo, url: signedUrlData?.signedUrl || photo.url, storagePath };
            }
          } else {
            // New format with just path - generate signed URL
            const { data: signedUrlData } = await supabase.storage
              .from('project-photos')
              .createSignedUrl(photo.url, 3600); // 1 hour expiration
            return { ...photo, url: signedUrlData?.signedUrl || photo.url, storagePath: photo.url };
          }
          return { ...photo, storagePath };
        })
      );
      setPhotos(photosWithSignedUrls);
    } else {
      setPhotos([]);
    }
  };

  const handleDelete = async (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm("Êtes-vous sûr de vouloir supprimer cette photo ?")) {
      return;
    }

    // Use storagePath if available, otherwise extract from URL
    const filePath = photo.storagePath || (() => {
      const urlParts = photo.url.split("/project-photos/");
      return urlParts.length === 2 ? urlParts[1].split('?')[0] : null;
    })();

    if (!filePath) {
      toast.error("Impossible de déterminer le chemin du fichier");
      return;
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("project-photos")
      .remove([filePath]);

    if (storageError) {
      toast.error("Erreur lors de la suppression du fichier");
      console.error(storageError);
      return;
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("project_photos")
      .delete()
      .eq("id", photo.id);

    if (dbError) {
      toast.error("Erreur lors de la suppression");
      console.error(dbError);
      return;
    }

    toast.success("Photo supprimée");
    loadPhotos();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Aucune photo pour le moment</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="relative group cursor-pointer aspect-square overflow-hidden rounded-lg border bg-muted"
          onClick={() => onPhotoClick(photo)}
        >
          <img
            src={photo.url}
            alt={photo.description || "Photo"}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <Button
              variant="destructive"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => handleDelete(photo, e)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {photo.comment && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-2 line-clamp-2">
              {photo.comment}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PhotoGallery;
