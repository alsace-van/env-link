// Composant Admin pour gérer l'indexation des documents
// Affiche le statut d'indexation et permet d'indexer en masse

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  FileText,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Square,
  RefreshCw,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAIConfig } from "@/hooks/useAIConfig";
import {
  indexDocument,
  removeIndexation,
  getIndexationStats,
  IndexingProgress,
  SourceType,
} from "@/services/documentIndexingService";

// ============================================
// TYPES
// ============================================

interface DocumentItem {
  id: string;
  name: string;
  file_url: string;
  is_indexed: boolean;
  indexed_at: string | null;
  sourceType: SourceType;
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export const AdminDocumentIndexing = () => {
  const [notices, setNotices] = useState<DocumentItem[]>([]);
  const [officialDocs, setOfficialDocs] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    notices: { total: 0, indexed: 0 },
    officialDocs: { total: 0, indexed: 0 },
    totalChunks: 0,
  });
  
  // État indexation en cours
  const [isIndexing, setIsIndexing] = useState(false);
  const [currentDoc, setCurrentDoc] = useState<string | null>(null);
  const [progress, setProgress] = useState<IndexingProgress>({
    status: "idle",
    progress: 0,
    message: "",
  });
  const [shouldStop, setShouldStop] = useState(false);

  const { isConfigured } = useAIConfig();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Charger les notices
      const { data: noticesData } = await (supabase as any)
        .from("notices_database")
        .select("id, titre, notice_url, is_indexed, indexed_at")
        .eq("user_id", user.id)
        .order("titre");

      setNotices(
        (noticesData || []).map((n: any) => ({
          id: n.id,
          name: n.titre,
          file_url: n.notice_url,
          is_indexed: n.is_indexed || false,
          indexed_at: n.indexed_at,
          sourceType: "notice" as SourceType,
        }))
      );

      // Charger les documents officiels
      const { data: docsData } = await (supabase as any)
        .from("official_documents")
        .select("id, name, file_url, is_indexed, indexed_at")
        .order("name");

      setOfficialDocs(
        (docsData || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          file_url: d.file_url,
          is_indexed: d.is_indexed || false,
          indexed_at: d.indexed_at,
          sourceType: "official_document" as SourceType,
        }))
      );

      // Charger les stats
      const statsData = await getIndexationStats(user.id);
      setStats(statsData);
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast.error("Erreur lors du chargement des documents");
    } finally {
      setIsLoading(false);
    }
  };

  const handleIndexSingle = async (doc: DocumentItem) => {
    if (!isConfigured) {
      toast.error("Configurez votre clé API dans les paramètres IA");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsIndexing(true);
    setCurrentDoc(doc.id);

    const result = await indexDocument(
      doc.sourceType,
      doc.id,
      doc.name,
      doc.file_url,
      user.id,
      setProgress
    );

    if (result.success) {
      toast.success(`"${doc.name}" indexé (${result.chunksCreated} passages)`);
      loadDocuments(); // Recharger
    } else {
      toast.error(`Erreur: ${result.error}`);
    }

    setIsIndexing(false);
    setCurrentDoc(null);
  };

  const handleRemoveIndex = async (doc: DocumentItem) => {
    const success = await removeIndexation(doc.sourceType, doc.id);
    if (success) {
      toast.success(`Indexation supprimée pour "${doc.name}"`);
      loadDocuments();
    } else {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleIndexAll = async (sourceType: SourceType) => {
    if (!isConfigured) {
      toast.error("Configurez votre clé API dans les paramètres IA");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const docs = sourceType === "notice"
      ? notices.filter((n) => !n.is_indexed)
      : officialDocs.filter((d) => !d.is_indexed);

    if (docs.length === 0) {
      toast.info("Tous les documents sont déjà indexés");
      return;
    }

    setIsIndexing(true);
    setShouldStop(false);

    for (let i = 0; i < docs.length; i++) {
      if (shouldStop) {
        toast.info("Indexation interrompue");
        break;
      }

      const doc = docs[i];
      setCurrentDoc(doc.id);

      const result = await indexDocument(
        doc.sourceType,
        doc.id,
        doc.name,
        doc.file_url,
        user.id,
        setProgress
      );

      if (!result.success) {
        toast.error(`Erreur sur "${doc.name}": ${result.error}`);
      }

      // Mise à jour de l'état local
      if (sourceType === "notice") {
        setNotices((prev) =>
          prev.map((n) =>
            n.id === doc.id ? { ...n, is_indexed: result.success } : n
          )
        );
      } else {
        setOfficialDocs((prev) =>
          prev.map((d) =>
            d.id === doc.id ? { ...d, is_indexed: result.success } : d
          )
        );
      }

      // Pause entre chaque document
      await new Promise((r) => setTimeout(r, 1000));
    }

    setIsIndexing(false);
    setCurrentDoc(null);
    loadDocuments(); // Recharger les stats
  };

  const handleStop = () => {
    setShouldStop(true);
  };

  // ============================================
  // RENDER
  // ============================================

  const renderDocumentTable = (documents: DocumentItem[], sourceType: SourceType) => {
    const notIndexed = documents.filter((d) => !d.is_indexed).length;

    return (
      <div className="space-y-4">
        {/* Header avec stats et bouton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="secondary">
              {documents.length - notIndexed} / {documents.length} indexés
            </Badge>
            {notIndexed > 0 && (
              <span className="text-sm text-muted-foreground">
                {notIndexed} en attente
              </span>
            )}
          </div>
          
          {notIndexed > 0 && (
            <Button
              onClick={() => handleIndexAll(sourceType)}
              disabled={isIndexing || !isConfigured}
              size="sm"
            >
              {isIndexing && currentDoc && documents.some((d) => d.id === currentDoc) ? (
                <>
                  <Square className="h-4 w-4 mr-2" onClick={handleStop} />
                  Arrêter
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Indexer tout ({notIndexed})
                </>
              )}
            </Button>
          )}
        </div>

        {/* Progression si indexation en cours */}
        {isIndexing && currentDoc && documents.some((d) => d.id === currentDoc) && (
          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">
                  {documents.find((d) => d.id === currentDoc)?.name}
                </span>
              </div>
              <Progress value={progress.progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {progress.message}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tableau */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead className="w-[120px]">Statut</TableHead>
              <TableHead className="w-[150px]">Indexé le</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium truncate max-w-[300px]">
                      {doc.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {doc.is_indexed ? (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Indexé
                    </Badge>
                  ) : currentDoc === doc.id ? (
                    <Badge variant="secondary">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      En cours...
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      En attente
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {doc.indexed_at
                    ? new Date(doc.indexed_at).toLocaleDateString("fr-FR")
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {doc.is_indexed ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRemoveIndex(doc)}
                      title="Supprimer l'indexation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleIndexSingle(doc)}
                      disabled={isIndexing || !isConfigured}
                      title="Indexer"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            
            {documents.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Aucun document
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats globales */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Notices indexées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.notices.indexed} / {stats.notices.total}
            </div>
            <Progress
              value={(stats.notices.indexed / Math.max(stats.notices.total, 1)) * 100}
              className="h-1 mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Documents DREAL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.officialDocs.indexed} / {stats.officialDocs.total}
            </div>
            <Progress
              value={(stats.officialDocs.indexed / Math.max(stats.officialDocs.total, 1)) * 100}
              className="h-1 mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Passages indexés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalChunks}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Segments de texte recherchables
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerte si pas configuré */}
      {!isConfigured && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium">Configuration requise</p>
              <p className="text-sm text-muted-foreground">
                Configurez une clé API (Gemini ou OpenAI) dans l'onglet "Paramètres IA"
                pour pouvoir indexer les documents.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs Notices / Documents officiels */}
      <Tabs defaultValue="notices">
        <TabsList>
          <TabsTrigger value="notices">
            Notices ({notices.length})
          </TabsTrigger>
          <TabsTrigger value="official">
            Documents DREAL ({officialDocs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notices" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            renderDocumentTable(notices, "notice")
          )}
        </TabsContent>

        <TabsContent value="official" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            renderDocumentTable(officialDocs, "official_document")
          )}
        </TabsContent>
      </Tabs>

      {/* Bouton refresh */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={loadDocuments}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>
    </div>
  );
};

export default AdminDocumentIndexing;
