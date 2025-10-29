import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

interface PhotoUploadProps {
  projectId: string;
  type: "projet" | "inspiration";
  onUploadComplete: () => void;
}

const PhotoUpload = ({ projectId, type, onUploadComplete }: PhotoUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(e.target.files);
    }
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast.error("Veuillez sélectionner au moins une photo");
      return;
    }

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${projectId}/${Date.now()}_${i}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("project-photos")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`Erreur lors de l'upload de ${file.name}`);
          continue;
        }

        // Get signed URL with 24 hour expiration for project photos
        const { data: signedUrlData, error: urlError } = await supabase.storage
          .from("project-photos")
          .createSignedUrl(fileName, 86400); // 24 hours

        if (urlError || !signedUrlData) {
          console.error("Error creating signed URL:", urlError);
          toast.error(`Erreur lors de la création de l'URL pour ${file.name}`);
          continue;
        }

        // Save to database
        const { error: dbError } = await supabase
          .from("project_photos")
          .insert({
            project_id: projectId,
            url: signedUrlData.signedUrl,
            type: type,
            description: file.name,
          });

        if (dbError) {
          console.error("Database error:", dbError);
          toast.error(`Erreur lors de l'enregistrement de ${file.name}`);
        }
      }

      toast.success("Photos uploadées avec succès !");
      setSelectedFiles(null);
      onUploadComplete();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erreur lors de l'upload");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="space-y-2">
        <Label htmlFor="photos">Sélectionner des photos</Label>
        <Input
          id="photos"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFileChange}
          disabled={isUploading}
          className="cursor-pointer"
        />
        <p className="text-xs text-muted-foreground">
          Sur mobile : prenez une photo ou choisissez dans la galerie
        </p>
      </div>

      {selectedFiles && selectedFiles.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {selectedFiles.length} photo{selectedFiles.length > 1 ? "s" : ""} sélectionnée{selectedFiles.length > 1 ? "s" : ""}
        </p>
      )}

      <Button
        onClick={handleUpload}
        disabled={isUploading || !selectedFiles}
        className="w-full"
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Upload en cours...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Uploader
          </>
        )}
      </Button>
    </div>
  );
};

export default PhotoUpload;
