import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Trash2, FileText, Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { RTIAutoFillModal } from "./RTIAutoFillModal";

interface OfficialDocument {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

const CATEGORIES = [
  "Administratif",
  "Assurance",
  "Technique",
  "Homologation",
  "Garantie",
  "Autre",
];

export const OfficialDocumentsManager = () => {
  const { projectId } = useParams();
  const [documents, setDocuments] = useState<OfficialDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rtiModalOpen, setRtiModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    file: null as File | null,
  });

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("official_documents")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error("Erreur chargement documents:", error);
      // Silent fail - la table peut ne pas exister encore
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Seuls les fichiers PDF sont acceptés");
        return;
      }
      setFormData({ ...formData, file });
    }
  };

  const handleUpload = async () => {
    if (!formData.name || !formData.file) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setUploading(true);

    try {
      // Upload file to storage
      const fileName = `${Date.now()}_${formData.file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("official-documents")
        .upload(fileName, formData.file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("official-documents")
        .getPublicUrl(fileName);

      // Insert into database
      const { error: dbError } = await supabase
        .from("official_documents")
        .insert({
          name: formData.name,
          description: formData.description || null,
          category: formData.category || null,
          file_url: urlData.publicUrl,
        });

      if (dbError) throw dbError;

      toast.success("Document officiel ajouté avec succès");
      setUploadDialogOpen(false);
      setFormData({ name: "", description: "", category: "", file: null });
      loadDocuments();
    } catch (error: any) {
      console.error("Erreur lors de l'upload:", error);
      toast.error("Erreur lors de l'upload du document");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (doc: OfficialDocument) => {
    const { error } = await supabase
      .from("official_documents")
      .update({ is_active: !doc.is_active })
      .eq("id", doc.id);

    if (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success(doc.is_active ? "Document désactivé" : "Document activé");
      loadDocuments();
    }
  };

  const handleDelete = async (doc: OfficialDocument) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${doc.name}" ?`)) return;

    try {
      // Extract file path from URL
      const filePath = doc.file_url.split("/official-documents/")[1];
      
      // Delete from storage
      if (filePath) {
        await supabase.storage
          .from("official-documents")
          .remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from("official_documents")
        .delete()
        .eq("id", doc.id);

      if (error) throw error;

      toast.success("Document supprimé");
      loadDocuments();
    } catch (error: any) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Documents Officiels</CardTitle>
              <CardDescription>
                Formulaires DREAL, CERFA et documents administratifs
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {projectId && (
                <Button
                  onClick={() => setRtiModalOpen(true)}
                  variant="default"
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Remplissage Auto RTI
                </Button>
              )}
              <Button onClick={() => setUploadDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un document
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Aucun document officiel disponible.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Le formulaire RTI 03.5.1 sera automatiquement ajouté lors du premier remplissage.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-red-500" />
                        {doc.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {doc.category && (
                        <Badge variant="outline">{doc.category}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {doc.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={doc.is_active ? "default" : "secondary"}>
                        {doc.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(doc)}
                          title={doc.is_active ? "Désactiver" : "Activer"}
                        >
                          {doc.is_active ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(doc.file_url, "_blank")}
                          title="Voir le PDF"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(doc)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ajouter un document officiel</DialogTitle>
              <DialogDescription>
                Ce document sera disponible pour tous les utilisateurs
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du document *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Certificat de conformité"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Catégorie</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description du document..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Fichier PDF *</Label>
                <Input
                  id="file"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                />
                {formData.file && (
                  <p className="text-sm text-muted-foreground">
                    Fichier sélectionné : {formData.file.name}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setUploadDialogOpen(false)}
                  disabled={uploading}
                >
                  Annuler
                </Button>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-spin" />
                      Upload en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Ajouter
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </Card>

      {/* RTI Auto Fill Modal */}
      {projectId && (
        <RTIAutoFillModal
          open={rtiModalOpen}
          onOpenChange={setRtiModalOpen}
          projectId={projectId}
        />
      )}
    </>
  );
};
