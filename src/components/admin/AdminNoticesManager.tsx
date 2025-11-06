import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Upload, 
  Trash2, 
  FileText, 
  Download,
  AlertCircle,
  Eye,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

interface AdminNotice {
  id: string;
  titre: string;
  marque: string | null;
  modele: string | null;
  categorie: string | null;
  description: string | null;
  url_notice: string;
  created_by: string | null;
  created_at: string;
  file_size?: number;
  is_admin_notice?: boolean;
}

export const AdminNoticesManager = () => {
  const [notices, setNotices] = useState<AdminNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteNoticeId, setDeleteNoticeId] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    categorie: "",
    marque: "",
    modele: "",
    file: null as File | null,
  });

  useEffect(() => {
    loadNotices();
    loadExistingCategories();
  }, []);

  const loadNotices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notices_database")
      .select("*")
      .order("is_admin_notice", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement des notices:", error);
      toast.error("Erreur lors du chargement des notices");
    } else {
      setNotices(data || []);
    }
    setLoading(false);
  };

  const loadExistingCategories = async () => {
    const { data, error } = await supabase
      .from("notices_database")
      .select("categorie")
      .not("categorie", "is", null);

    if (error) {
      console.error("Erreur lors du chargement des catégories:", error);
      return;
    }

    // Extraire les catégories uniques et les trier
    const categories = [...new Set(data.map(item => item.categorie).filter(Boolean))].sort();
    setExistingCategories(categories as string[]);
  };

  const checkForDuplicate = async (titre: string, fileSize: number): Promise<boolean> => {
    const { data, error } = await supabase
      .from("notices_database")
      .select("id, titre, marque, modele")
      .ilike("titre", titre)
      .eq("file_size", fileSize)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Erreur lors de la vérification des doublons:", error);
      return false;
    }

    if (data) {
      const existingInfo = data.marque && data.modele 
        ? `${data.marque} ${data.modele}` 
        : data.titre;
      setDuplicateWarning(
        `Une notice similaire existe déjà : "${existingInfo}". ` +
        `En tant qu'administrateur, vous pouvez quand même l'ajouter si nécessaire.`
      );
      return true;
    }

    return false;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Seuls les fichiers PDF sont acceptés");
        return;
      }
      
      setFormData({ ...formData, file });
      setDuplicateWarning(null);

      if (formData.titre) {
        await checkForDuplicate(formData.titre, file.size);
      }
    }
  };

  const handleTitreChange = async (titre: string) => {
    setFormData({ ...formData, titre });
    setDuplicateWarning(null);

    if (formData.file && titre.trim()) {
      await checkForDuplicate(titre, formData.file.size);
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "-";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleUpload = async () => {
    if (!formData.titre || !formData.file) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setUploading(true);

    try {
      // Upload file to storage
      const fileName = `${Date.now()}_${formData.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("notice-files")
        .upload(fileName, formData.file);

      if (uploadError) throw uploadError;

      // Get the user
      const { data: { user } } = await supabase.auth.getUser();

      // Insert into database as admin notice
      const { error: dbError } = await supabase
        .from("notices_database")
        .insert({
          titre: formData.titre.trim(),
          description: formData.description.trim() || null,
          categorie: formData.categorie || null,
          marque: formData.marque.trim() || null,
          modele: formData.modele.trim() || null,
          url_notice: fileName,
          file_size: formData.file.size,
          is_admin_notice: true,
          created_by: user?.id,
        });

      if (dbError) {
        await supabase.storage
          .from("notice-files")
          .remove([fileName]);
        
        throw dbError;
      }

      toast.success("Notice permanente ajoutée avec succès");
      setUploadDialogOpen(false);
      setFormData({ 
        titre: "", 
        description: "", 
        categorie: "", 
        marque: "", 
        modele: "", 
        file: null 
      });
      setDuplicateWarning(null);
      loadNotices();
      loadExistingCategories();
    } catch (error: any) {
      console.error("Erreur lors de l'upload:", error);
      toast.error("Erreur lors de l'upload de la notice");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteNoticeId) return;

    const notice = notices.find(n => n.id === deleteNoticeId);
    if (!notice) return;

    try {
      if (!notice.url_notice.startsWith("http")) {
        await supabase.storage
          .from("notice-files")
          .remove([notice.url_notice]);
      }

      await supabase
        .from("accessories_catalog")
        .update({ notice_id: null })
        .eq("notice_id", notice.id);

      const { error } = await supabase
        .from("notices_database")
        .delete()
        .eq("id", notice.id);

      if (error) throw error;

      toast.success("Notice supprimée");
      loadNotices();
    } catch (error: any) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleteNoticeId(null);
    }
  };

  const getPublicUrl = async (filePath: string): Promise<string | null> => {
    if (filePath.startsWith("http")) {
      return filePath;
    }

    const { data, error } = await supabase.storage
      .from("notice-files")
      .createSignedUrl(filePath, 3600);

    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }

    return data.signedUrl;
  };

  const handleView = async (filePath: string) => {
    const url = await getPublicUrl(filePath);
    if (url) {
      window.open(url, "_blank");
    } else {
      toast.error("Impossible d'ouvrir la notice");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Notices Permanentes
              </CardTitle>
              <CardDescription>
                Gérer les notices qui ne peuvent être supprimées que par les administrateurs
              </CardDescription>
            </div>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une notice
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre / Produit</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notices.map((notice) => (
                  <TableRow key={notice.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-red-500" />
                          <span>{notice.titre}</span>
                        </div>
                        {(notice.marque || notice.modele) && (
                          <span className="text-sm text-muted-foreground ml-6">
                            {[notice.marque, notice.modele].filter(Boolean).join(" ")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {notice.categorie && (
                        <Badge variant="outline">{notice.categorie}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatFileSize(notice.file_size)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {notice.is_admin_notice ? (
                        <Badge className="bg-primary">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Utilisateur</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(notice.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(notice.url_notice)}
                          title="Voir la notice"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteNoticeId(notice.id)}
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
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Ajouter une notice permanente
            </DialogTitle>
            <DialogDescription>
              Cette notice sera accessible à tous et ne pourra être supprimée que par un administrateur. 
              Les doublons sont détectés automatiquement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {duplicateWarning && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{duplicateWarning}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="titre">Titre de la notice *</Label>
              <Input
                id="titre"
                value={formData.titre}
                onChange={(e) => handleTitreChange(e.target.value)}
                placeholder="Ex: Notice pompe à eau Shurflo 2088"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="marque">Marque</Label>
                <Input
                  id="marque"
                  value={formData.marque}
                  onChange={(e) => setFormData({ ...formData, marque: e.target.value })}
                  placeholder="Ex: Shurflo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modele">Modèle</Label>
                <Input
                  id="modele"
                  value={formData.modele}
                  onChange={(e) => setFormData({ ...formData, modele: e.target.value })}
                  placeholder="Ex: 2088-403-144"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categorie">Catégorie</Label>
              <Input
                id="categorie"
                value={formData.categorie}
                onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                placeholder="Saisissez ou créez une catégorie"
              />
              {existingCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">Suggestions :</span>
                  {existingCategories.map((cat) => (
                    <Badge
                      key={cat}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => setFormData({ ...formData, categorie: cat })}
                    >
                      {cat}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description du produit ou de la notice..."
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
                  Fichier sélectionné : {formData.file.name} ({formatFileSize(formData.file.size)})
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setUploadDialogOpen(false);
                  setDuplicateWarning(null);
                }}
                disabled={uploading}
              >
                Annuler
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={uploading}
              >
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteNoticeId} onOpenChange={() => setDeleteNoticeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette notice ? 
              Cette action est irréversible et la notice sera dissociée de tous les accessoires liés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
