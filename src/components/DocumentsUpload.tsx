import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, X, FileText, Download, Loader2, Edit2, Check, Eye } from "lucide-react";
import { toast } from "sonner";
import { PdfViewerModal } from "./PdfViewerModal";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState<string>("");
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

        const { error: uploadError } = await supabase.storage.from("administrative-documents").upload(filePath, file);

        if (uploadError) throw uploadError;

        // Obtenir l'URL publique
        const { data: urlData } = supabase.storage.from("administrative-documents").getPublicUrl(filePath);

        // Enregistrer dans la base de données
        const { error: dbError } = await supabase.from("administrative_documents").insert({
          project_id: projectId,
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
      const { error: storageError } = await supabase.storage.from("administrative-documents").remove([filePath]);

      if (storageError) throw storageError;

      // Supprimer de la base de données
      const { error: dbError } = await supabase.from("administrative_documents").delete().eq("id", doc.id);

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

  const startEdit = (doc: Document) => {
    setEditingId(doc.id);
    setEditingName(doc.file_name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async (docId: string) => {
    if (!editingName.trim()) {
      toast.error("Le nom ne peut pas être vide");
      return;
    }

    try {
      const { error } = await supabase
        .from("administrative_documents")
        .update({ file_name: editingName.trim() })
        .eq("id", docId);

      if (error) throw error;

      toast.success("Nom modifié avec succès");
      setEditingId(null);
      setEditingName("");
      loadDocuments();
    } catch (error) {
      console.error("Erreur lors de la modification:", error);
      toast.error("Erreur lors de la modification");
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <h3 className="font-semibold text-lg">Documents uploadés</h3>

        {/* Zone de drop compacte */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          }`}
        >
          <div className="flex items-center justify-center gap-4">
            <Upload className={`h-8 w-8 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            <div className="text-left">
              <p className="font-medium text-sm">Glissez-déposez vos documents ici</p>
              <p className="text-xs text-muted-foreground">ou cliquez pour sélectionner (max 10MB)</p>
            </div>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} variant="outline" size="sm">
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Upload...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Sélectionner
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Liste des documents */}
        {documents.length > 0 && (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {editingId === doc.id ? (
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(doc.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : (
                        <p className="font-medium truncate text-sm">{doc.file_name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(doc.file_size)} • {new Date(doc.uploaded_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {editingId === doc.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => saveEdit(doc.id)}
                          title="Enregistrer"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEdit} title="Annuler">
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {doc.mime_type === "application/pdf" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setPreviewPdfUrl(doc.file_url);
                              setPreviewPdfTitle(doc.file_name);
                            }}
                            title="Prévisualiser"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEdit(doc)}
                          title="Modifier le nom"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => window.open(doc.file_url, "_blank")}
                          title="Télécharger"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDelete(doc)}
                          title="Supprimer"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {documents.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun document uploadé</p>
        )}
      </CardContent>

      {previewPdfUrl && (
        <PdfViewerModal
          isOpen={!!previewPdfUrl}
          onClose={() => {
            setPreviewPdfUrl(null);
            setPreviewPdfTitle("");
          }}
          pdfUrl={previewPdfUrl}
          title={previewPdfTitle}
        />
      )}
    </Card>
  );
};
