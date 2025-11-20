import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Upload, FileImage } from "lucide-react";
import { toast } from "sonner";

interface PhotoUploadStepProps {
  onImageUploaded: (imageUrl: string) => void;
}

export function PhotoUploadStep({ onImageUploaded }: PhotoUploadStepProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Le fichier est trop volumineux (max 20MB)");
      return;
    }

    setFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".heic", ".webp"],
    },
    maxFiles: 1,
  });

  const handleContinue = () => {
    if (preview) {
      onImageUploaded(preview);
    }
  };

  return (
    <div className="space-y-6 py-6">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors
          ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <FileImage className="h-16 w-16 mx-auto text-muted-foreground" />
          {isDragActive ? (
            <p className="text-lg font-medium">Déposez votre photo ici...</p>
          ) : (
            <>
              <p className="text-lg font-medium">
                Glissez-déposez votre photo ici
              </p>
              <p className="text-sm text-muted-foreground">
                ou cliquez pour sélectionner
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, HEIC, WEBP (max 20MB)
              </p>
            </>
          )}
        </div>
      </div>

      {preview && (
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-auto max-h-96 object-contain bg-muted"
            />
          </div>
          {file && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong>Fichier:</strong> {file.name}
              </p>
              <p>
                <strong>Taille:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPreview(null);
                setFile(null);
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleContinue}>
              Continuer
              <Upload className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
