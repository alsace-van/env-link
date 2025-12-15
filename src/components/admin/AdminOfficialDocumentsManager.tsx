import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Eye,
  Filter,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Edit,
  Upload,
  Settings,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { OfficialDocumentUploadDialog } from "./OfficialDocumentUploadDialog";
import { PdfViewerModal } from "@/components/PdfViewerModal";
import CategoryManagementDialog from "../CategoryManagementDialog";

interface OfficialDocument {
  id: string;
  name: string;
  description: string;
  category: string;
  file_url: string;
  version: string;
  is_active: boolean;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  display_order: number;
}

export function AdminOfficialDocumentsManager() {
  const [documents, setDocuments] = useState<OfficialDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<OfficialDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [categoryManagementOpen, setCategoryManagementOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    loadDocuments();
    loadCategories();
  }, []);

  useEffect(() => {
    filterDocuments();
  }, [selectedCategory, documents]);

  const loadCategories = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("official_document_categories")
        .select("*")
        .order("display_order", { ascending: true });

      if (fetchError) throw fetchError;
      setCategories(data || []);
    } catch (err) {
      console.error("Erreur lors du chargement des catégories:", err);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("official_documents")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (fetchError) throw fetchError;

      setDocuments((data || []) as any);
    } catch (err) {
      console.error("Erreur lors du chargement des documents:", err);
      setError("Impossible de charger les documents officiels");
    } finally {
      setLoading(false);
    }
  };

  const filterDocuments = () => {
    if (selectedCategory === "all") {
      setFilteredDocuments(documents);
    } else {
      setFilteredDocuments(documents.filter((doc) => doc.category === selectedCategory));
    }
  };

  const handleDeleteDocument = async () => {
    if (!deleteDocId) return;

    try {
      const docToDelete = documents.find((d) => d.id === deleteDocId);
      if (!docToDelete) return;

      // Supprimer le fichier du storage
      if (docToDelete.file_url.includes("official-documents")) {
        const urlParts = docToDelete.file_url.split("/");
        const fileName = urlParts[urlParts.length - 1];

        const { error: storageError } = await supabase.storage.from("official-documents").remove([fileName]);

        if (storageError) {
          console.error("Erreur lors de la suppression du fichier:", storageError);
        }
      }

      // Supprimer l'entrée de la base de données
      const { error: dbError } = await supabase.from("official_documents").delete().eq("id", deleteDocId);

      if (dbError) throw dbError;

      toast.success("Document supprimé avec succès");
      loadDocuments();
    } catch (error: any) {
      console.error("Erreur lors de la suppression:", error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setDeleteDocId(null);
    }
  };

  const toggleDocumentActive = async (docId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from("official_documents").update({ is_active: !currentStatus }).eq("id", docId);

      if (error) throw error;

      toast.success(currentStatus ? "Document désactivé" : "Document activé");
      loadDocuments();
    } catch (error: any) {
      console.error("Erreur lors de la mise à jour:", error);
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const handleViewDocument = (url: string) => {
    // Si c'est un PDF, ouvrir dans le viewer intégré
    if (url.toLowerCase().endsWith(".pdf") || url.includes(".pdf")) {
      setViewingPdfUrl(url);
    } else {
      // Pour les autres types de fichiers, ouvrir dans un nouvel onglet
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find((c) => c.name === categoryName);
    if (!category) return "bg-gray-100 text-gray-800 border-gray-200";

    const colorMap: Record<string, string> = {
      blue: "bg-blue-100 text-blue-800 border-blue-200",
      green: "bg-green-100 text-green-800 border-green-200",
      purple: "bg-purple-100 text-purple-800 border-purple-200",
      orange: "bg-orange-100 text-orange-800 border-orange-200",
      red: "bg-red-100 text-red-800 border-red-200",
      yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
      pink: "bg-pink-100 text-pink-800 border-pink-200",
      gray: "bg-gray-100 text-gray-800 border-gray-200",
    };

    return colorMap[category.color] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getCategoryIcon = (categoryName: string) => {
    const category = categories.find((c) => c.name === categoryName);
    return category?.icon || "📄";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Chargement des documents officiels...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">Erreur</p>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
            <button
              onClick={loadDocuments}
              className="mt-3 text-sm text-destructive underline hover:text-destructive/80"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec boutons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Documents Officiels</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestion des formulaires DREAL, CERFA et documents techniques
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCategoryManagementOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Gérer les catégories
          </Button>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un document
          </Button>
        </div>
      </div>

      {/* Filtres par catégorie */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filtrer :</span>
        </div>
        <Button
          variant={selectedCategory === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory("all")}
        >
          Tous
          <span className="ml-2">{documents.length}</span>
        </Button>
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.name ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category.name)}
          >
            <span className="mr-1">{category.icon}</span>
            {category.name}
            <span className="ml-2">{documents.filter((d) => d.category === category.name).length}</span>
          </Button>
        ))}
      </div>

      {/* Liste des documents */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-muted/50 rounded-lg border-2 border-dashed border-border">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">Aucun document trouvé</p>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedCategory === "all"
              ? "Aucun document officiel disponible"
              : `Aucun document dans la catégorie "${selectedCategory}"`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-card border rounded-lg p-5 hover:shadow-lg transition-all hover:border-primary/50"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* Icône de catégorie */}
                  <div className="text-4xl">{getCategoryIcon(doc.category)}</div>

                  {/* Informations du document */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{doc.name}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getCategoryColor(
                          doc.category,
                        )}`}
                      >
                        {doc.category}
                      </span>
                      {doc.version && (
                        <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs font-mono">
                          v{doc.version}
                        </span>
                      )}
                      {!doc.is_active && (
                        <span className="px-2 py-1 bg-destructive/10 text-destructive rounded text-xs font-medium">
                          Désactivé
                        </span>
                      )}
                    </div>

                    {doc.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {doc.description.length > 200 ? doc.description.substring(0, 200) + "..." : doc.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDocument(doc.file_url)}
                    title="Voir le document"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>

                  <Button variant="ghost" size="sm" asChild>
                    <a href={doc.file_url} download title="Télécharger le document">
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>

                  <Button
                    variant={doc.is_active ? "outline" : "default"}
                    size="sm"
                    onClick={() => toggleDocumentActive(doc.id, doc.is_active)}
                    title={doc.is_active ? "Désactiver" : "Activer"}
                  >
                    {doc.is_active ? "Actif" : "Inactif"}
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDocId(doc.id)}
                    title="Supprimer le document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statistiques */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">
              {filteredDocuments.length} document{filteredDocuments.length > 1 ? "s" : ""} affiché
              {filteredDocuments.length > 1 ? "s" : ""}
            </span>
          </div>
          {selectedCategory !== "all" && (
            <Button variant="link" size="sm" onClick={() => setSelectedCategory("all")}>
              Voir tous les documents ({documents.length})
            </Button>
          )}
        </div>
      </div>

      {/* Dialog de gestion des catégories */}
      <CategoryManagementDialog
        open={categoryManagementOpen}
        onOpenChange={setCategoryManagementOpen}
        onCategoryUpdated={loadCategories}
      />

      {/* Dialog d'upload */}
      <OfficialDocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={loadDocuments}
        categories={categories}
      />

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce document ? Cette action est irréversible et supprimera également le
              fichier du stockage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocument}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Viewer PDF */}
      {viewingPdfUrl && (
        <PdfViewerModal
          isOpen={true}
          onClose={() => setViewingPdfUrl(null)}
          pdfUrl={viewingPdfUrl}
          title="Document officiel"
        />
      )}
    </div>
  );
}
