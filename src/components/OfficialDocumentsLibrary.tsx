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
        .from('official_documents')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      setDocuments((data || []) as OfficialDocument[]);
    } catch (err) {
      console.error('Erreur lors du chargement des documents:', err);
      toast.error('Impossible de charger les documents officiels');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFiller = (doc: OfficialDocument) => {
    setSelectedDoc(doc);
    setFillerOpen(true);
  };

  const handleDownload = (doc: OfficialDocument) => {
    const link = document.createElement("a");
    link.href = doc.file_url;
    link.download = `${doc.name}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const categories = [...new Set(documents.map(d => d.category).filter(Boolean))];
  const filteredDocs = selectedCategory
    ? documents.filter(d => d.category === selectedCategory)
    : documents;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Documents Officiels</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Documents Officiels</CardTitle>
          <CardDescription>
            Formulaires et documents à remplir pour votre projet
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucun document officiel disponible pour le moment.
            </p>
          ) : (
            <>
              {/* Filtres par catégorie */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  <Button
                    variant={selectedCategory === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                  >
                    Tous
                  </Button>
                  {categories.map((cat) => (
                    <Button
                      key={cat}
                      variant={selectedCategory === cat ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(cat as string)}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              )}

              {/* Liste des documents */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredDocs.map((doc) => (
                  <Card key={doc.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <FileText className="h-8 w-8 text-red-500 mb-2" />
                        {doc.category && (
                          <Badge variant="outline" className="text-xs">
                            {doc.category}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base">{doc.name}</CardTitle>
                      {doc.description && (
                        <CardDescription className="text-sm line-clamp-2">
                          {doc.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        className="w-full"
                        onClick={() => handleOpenFiller(doc)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Remplir le document
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger vierge
                      </Button>
                    </CardContent>
                  </Card>
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
