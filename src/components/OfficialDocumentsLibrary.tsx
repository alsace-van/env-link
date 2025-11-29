import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Edit } from "lucide-react";
import { toast } from "sonner";
import { PDFFormFiller } from "./PDFFormFiller";

interface OfficialDocument {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

interface OfficialDocumentsLibraryProps {
  projectId?: string;
}

export const OfficialDocumentsLibrary = ({ projectId }: OfficialDocumentsLibraryProps) => {
  const [documents, setDocuments] = useState<OfficialDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<OfficialDocument | null>(null);
  const [fillerOpen, setFillerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("official_documents")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      setDocuments((data || []) as OfficialDocument[]);
    } catch (err) {
      console.error("Erreur lors du chargement des documents:", err);
      toast.error("Impossible de charger les documents officiels");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFiller = async (doc: OfficialDocument) => {
    try {
      // Vérifier que le fichier est bien dans le storage Supabase
      if (!doc.file_url.includes("supabase.co/storage")) {
        toast.error("Ce document doit être uploadé dans le système. Contactez un administrateur.");
        return;
      }

      setSelectedDoc(doc);
      setFillerOpen(true);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Impossible d'ouvrir le document");
    }
  };

  const handleDownload = async (doc: OfficialDocument) => {
    try {
      // Télécharger le fichier depuis Supabase Storage
      const response = await fetch(doc.file_url);
      if (!response.ok) throw new Error("Erreur de téléchargement");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${doc.name}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erreur lors du téléchargement:", error);
      toast.error("Impossible de télécharger le document");
    }
  };

  const categories = [...new Set(documents.map((d) => d.category).filter(Boolean))];
  const filteredDocs = selectedCategory ? documents.filter((d) => d.category === selectedCategory) : documents;

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Documents Officiels</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Documents Officiels</CardTitle>
          <CardDescription className="text-xs">Formulaires à remplir</CardDescription>
        </CardHeader>
        <CardContent className="p-3">
          {documents.length === 0 ? (
            <p className="text-muted-foreground text-center py-4 text-sm">Aucun document officiel disponible.</p>
          ) : (
            <>
              {/* Filtres par catégorie - version compacte */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  <Button
                    variant={selectedCategory === null ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setSelectedCategory(null)}
                  >
                    Tous
                  </Button>
                  {categories.map((cat) => (
                    <Button
                      key={cat}
                      variant={selectedCategory === cat ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setSelectedCategory(cat as string)}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              )}

              {/* Liste des documents - version compacte */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredDocs.map((doc) => (
                  <div key={doc.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start gap-2 mb-2">
                      <FileText className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-tight">{doc.name}</p>
                        {doc.category && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {doc.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => handleOpenFiller(doc)}>
                        <Edit className="h-3 w-3 mr-1" />
                        Remplir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleDownload(doc)}
                        title="Télécharger vierge"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* PDF Form Filler */}
      {selectedDoc && (
        <PDFFormFiller
          open={fillerOpen}
          onOpenChange={setFillerOpen}
          document={selectedDoc}
          projectId={projectId}
          onSaved={() => {
            toast.success("Document sauvegardé dans vos documents");
            setFillerOpen(false);
          }}
        />
      )}
    </>
  );
};
