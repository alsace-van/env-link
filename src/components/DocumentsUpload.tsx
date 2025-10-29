import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Document {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

interface DocumentsUploadProps {
  projectId: string;
}

export const DocumentsUpload = ({ projectId }: DocumentsUploadProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les documents
  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from("administrative_documents")
      .select("*")
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement des documents:", error);
      return;
    }

    setDocuments(data || []);
  };

  // Charger les documents au montage
  useEffect(() => {
    loadDocuments();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      await uploadFiles(files);
    }
  };

  const uploadFiles = async (files: File[]) => {
    setIsUploading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Vous devez être connecté");
      setIsUploading(false);
      return;
    }

    for (const file of files) {
      // Vérifier la taille (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Le fichier ${file.name} est trop volumineux (max 10MB)`);
        continue;
      }

      try {
        // Upload vers Supabase Storage
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("administrative-documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Obtenir l'URL publique
        const { data: urlData } = supabase.storage
          .from("administrative-documents")
          .getPublicUrl(filePath);

        // Enregistrer dans la base de données
        const { error: dbError } = await supabase
          .from("administrative_documents")
          .insert({
            project_id: projectId,
            user_id: user.id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_size: file.size,
            mime_type: file.type || "application/octet-stream",
          });

        if (dbError) throw dbError;

        toast.success(`${file.name} uploadé avec succès`);
      } catch (error) {
        console.error("Erreur lors de l'upload:", error);
        toast.error(`Erreur lors de l'upload de ${file.name}`);
      }
    }

    setIsUploading(false);
    loadDocuments();
  };

  const handleDelete = async (doc: Document) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    try {
      // Extraire le chemin du fichier depuis l'URL
      const url = new URL(doc.file_url);
      const pathParts = url.pathname.split("/");
      const filePath = pathParts.slice(pathParts.indexOf("administrative-documents") + 1).join("/");

      // Supprimer du storage
      const { error: storageError } = await supabase.storage
        .from("administrative-documents")
        .remove([filePath]);

      if (storageError) throw storageError;

      // Supprimer de la base de données
      const { error: dbError } = await supabase
        .from("administrative_documents")
        .delete()
        .eq("id", doc.id);

      if (dbError) throw dbError;

      toast.success("Document supprimé");
      loadDocuments();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-6">
      {/* Zone de drop */}
      <Card>
        <CardContent className="p-0">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            <p className="text-lg font-medium mb-2">
              Glissez-déposez vos documents ici
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              ou cliquez pour sélectionner des fichiers (max 10MB par fichier)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              variant="outline"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Upload en cours...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Sélectionner des fichiers
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste des documents */}
      {documents.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Documents uploadés</h3>
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(doc.file_size)} • {new Date(doc.uploaded_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(doc.file_url, "_blank")}
                      title="Télécharger"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc)}
                      title="Supprimer"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
