import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Download, Eye, Pencil, Shield, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PdfViewerModal } from "./PdfViewerModalWithAI";
import { NoticeEditDialog } from "./NoticeEditDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

interface Notice {
  id: string;
  titre: string;
  marque?: string;
  modele?: string;
  categorie?: string;
  description?: string;
  notice_url: string;
  created_at: string;
  is_admin_notice?: boolean;
  user_id?: string;
  ai_summary?: string | null;
  ai_summary_generated_at?: string | null;
  ai_summary_tokens_used?: number;
}

interface NoticesListProps {
  refreshTrigger?: number;
}

export const NoticesList = ({ refreshTrigger }: NoticesListProps) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<{
    url: string;
    title: string;
    id: string;
    summary?: string | null;
  } | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [noticeToEdit, setNoticeToEdit] = useState<Notice | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Onglet actif (marque)
  const [activeBrandTab, setActiveBrandTab] = useState<string>("__all__");

  // Recherche
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    checkAdminRole();
    loadNotices();

    const channel = supabase
      .channel("notices-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notices_database",
        },
        () => {
          loadNotices();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshTrigger]);

  const checkAdminRole = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setCurrentUserId(user.id);

    const { data: roleData } = (await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()) as any;

    setIsAdmin(!!roleData);
  };

  const loadNotices = async () => {
    setIsLoading(true);
    try {
      const { data, error } = (await supabase
        .from("notices_database")
        .select("*")
        .order("marque", { ascending: true })
        .order("titre", { ascending: true })) as any;

      if (error) {
        console.error("Error loading notices:", error);
        toast.error("Erreur lors du chargement des notices");
        return;
      }

      setNotices((data || []) as any);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du chargement des notices");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result1: any = await (supabase as any)
        .from("accessories_catalog")
        .update({ notice_id: null })
        .eq("notice_id", id);

      const result2: any = await supabase.from("notices_database").delete().eq("id", id);
      const { error } = result2;

      if (error) {
        toast.error("Erreur lors de la suppression");
        console.error(error);
        return;
      }

      toast.success("Notice supprimée");
      loadNotices();
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const getPublicUrl = async (filePath: string): Promise<string | null> => {
    if (filePath.startsWith("http")) {
      return filePath;
    }

    const { data, error } = await supabase.storage.from("notice-files").createSignedUrl(filePath, 3600);

    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }

    return data.signedUrl;
  };

  const handleDownload = async (filePath: string, titre: string) => {
    try {
      const url = await getPublicUrl(filePath);

      if (!url) {
        toast.error("Fichier non trouvé dans le stockage");
        return;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${titre}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Téléchargement lancé");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Erreur lors du téléchargement");
    }
  };

  const handleOpenNotice = async (notice: Notice) => {
    try {
      const url = await getPublicUrl(notice.notice_url);

      if (!url) {
        toast.error("Fichier non trouvé dans le stockage");
        return;
      }

      setSelectedNotice({
        url,
        title: notice.titre,
        id: notice.id,
        summary: notice.ai_summary,
      });
      setViewerOpen(true);
    } catch (error) {
      console.error("Open error:", error);
      toast.error("Erreur lors de l'ouverture de la notice");
    }
  };

  const handleCloseViewer = () => {
    setViewerOpen(false);
    setSelectedNotice(null);
  };

  const handleEdit = (notice: Notice) => {
    setNoticeToEdit(notice);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setNoticeToEdit(null);
  };

  const handleEditSuccess = () => {
    loadNotices();
  };

  // Grouper les notices par marque
  const groupedByBrand = () => {
    const groups = new Map<string, Notice[]>();

    notices.forEach((notice) => {
      const brand = notice.marque || "Sans marque";
      if (!groups.has(brand)) {
        groups.set(brand, []);
      }
      groups.get(brand)!.push(notice);
    });

    // Trier les marques alphabétiquement, mais "Sans marque" à la fin
    const sortedEntries = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "Sans marque") return 1;
      if (b[0] === "Sans marque") return -1;
      return a[0].localeCompare(b[0]);
    });

    return new Map(sortedEntries);
  };

  // Filtrer les notices par recherche
  const filterNotices = (noticesList: Notice[]) => {
    if (!searchQuery) return noticesList;

    const query = searchQuery.toLowerCase();
    return noticesList.filter(
      (notice) =>
        notice.titre.toLowerCase().includes(query) ||
        notice.marque?.toLowerCase().includes(query) ||
        notice.modele?.toLowerCase().includes(query) ||
        notice.description?.toLowerCase().includes(query) ||
        notice.categorie?.toLowerCase().includes(query),
    );
  };

  // Obtenir les notices à afficher selon l'onglet actif
  const getDisplayedNotices = () => {
    const grouped = groupedByBrand();

    if (activeBrandTab === "__all__") {
      return filterNotices(notices);
    }

    const brandNotices = grouped.get(activeBrandTab) || [];
    return filterNotices(brandNotices);
  };

  const displayedNotices = getDisplayedNotices();

  // Rendu d'une carte notice
  const renderNoticeCard = (notice: Notice) => {
    const canModify = isAdmin || (!notice.is_admin_notice && notice.user_id === currentUserId);
    const canDelete = isAdmin || (!notice.is_admin_notice && notice.user_id === currentUserId);

    return (
      <div key={notice.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium truncate">{notice.titre}</h4>
              {notice.is_admin_notice && (
                <Badge className="bg-primary flex-shrink-0">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin
                </Badge>
              )}
              {notice.ai_summary && (
                <Badge
                  variant="secondary"
                  className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 flex-shrink-0"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  IA
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {notice.modele && <span>Modèle: {notice.modele}</span>}
              {notice.categorie && (
                <Badge variant="outline" className="text-xs">
                  {notice.categorie}
                </Badge>
              )}
            </div>
            {notice.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{notice.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Ajouté le {new Date(notice.created_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleOpenNotice(notice)}
              title="Voir la notice"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {canModify && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleEdit(notice)}
                title="Modifier"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleDownload(notice.notice_url, notice.titre)}
              title="Télécharger"
            >
              <Download className="h-4 w-4" />
            </Button>
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer la notice ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. La notice sera dissociée des accessoires liés.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(notice.id)}>Supprimer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  if (notices.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Aucune notice disponible. Ajoutez-en une pour commencer.
        </CardContent>
      </Card>
    );
  }

  const grouped = groupedByBrand();

  return (
    <>
      <PdfViewerModal
        isOpen={viewerOpen}
        onClose={handleCloseViewer}
        pdfUrl={selectedNotice?.url || null}
        title={selectedNotice?.title || ""}
        noticeId={selectedNotice?.id}
        existingSummary={selectedNotice?.summary}
      />

      <NoticeEditDialog
        isOpen={editDialogOpen}
        onClose={handleCloseEditDialog}
        notice={noticeToEdit}
        onSuccess={handleEditSuccess}
      />

      {/* Barre de recherche */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par titre, marque, modèle, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Conteneur avec onglets style Excel */}
      <div className="border rounded-lg overflow-hidden">
        {/* Barre d'onglets */}
        <div className="bg-gray-100 dark:bg-gray-800 border-b overflow-x-auto">
          <div className="flex items-stretch min-w-max">
            {/* Onglet Toutes */}
            <button
              onClick={() => setActiveBrandTab("__all__")}
              className={`
                px-4 py-2.5 text-sm font-medium border-r transition-all flex items-center gap-2
                ${
                  activeBrandTab === "__all__"
                    ? "bg-white dark:bg-gray-900 text-primary border-b-2 border-b-primary"
                    : "hover:bg-gray-200 dark:hover:bg-gray-700 text-muted-foreground"
                }
              `}
            >
              📋 Toutes
              <Badge variant="secondary" className="text-xs">
                {notices.length}
              </Badge>
            </button>

            {/* Onglets par marque */}
            {Array.from(grouped.entries()).map(([brand, brandNotices]) => {
              const isActive = activeBrandTab === brand;

              return (
                <button
                  key={brand}
                  onClick={() => setActiveBrandTab(brand)}
                  className={`
                    px-4 py-2.5 text-sm font-medium border-r transition-all whitespace-nowrap flex items-center gap-2
                    ${
                      isActive
                        ? "bg-white dark:bg-gray-900 text-primary border-b-2 border-b-primary"
                        : "hover:bg-gray-200 dark:hover:bg-gray-700 text-muted-foreground"
                    }
                  `}
                >
                  {brand}
                  <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                    {brandNotices.length}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu de l'onglet */}
        <div className="p-4 bg-white dark:bg-gray-900 min-h-[300px]">
          {displayedNotices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "Aucune notice ne correspond à la recherche." : "Aucune notice dans cette catégorie."}
            </div>
          ) : (
            <div className="space-y-3">
              {activeBrandTab === "__all__" ? (
                // Afficher groupé par marque
                Array.from(grouped.entries()).map(([brand, brandNotices]) => {
                  const filteredBrandNotices = filterNotices(brandNotices);
                  if (filteredBrandNotices.length === 0) return null;

                  return (
                    <div key={brand} className="mb-6">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-primary/30">
                        <h3 className="text-lg font-semibold text-primary">{brand}</h3>
                        <Badge variant="outline">{filteredBrandNotices.length} notice(s)</Badge>
                      </div>
                      <div className="space-y-2">{filteredBrandNotices.map((notice) => renderNoticeCard(notice))}</div>
                    </div>
                  );
                })
              ) : (
                // Afficher seulement la marque sélectionnée
                <div className="space-y-2">{displayedNotices.map((notice) => renderNoticeCard(notice))}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Compteur */}
      <div className="mt-2 text-sm text-muted-foreground">
        {displayedNotices.length} notice{displayedNotices.length > 1 ? "s" : ""} affichée
        {displayedNotices.length > 1 ? "s" : ""}
        {searchQuery &&
          ` sur ${activeBrandTab === "__all__" ? notices.length : grouped.get(activeBrandTab)?.length || 0}`}
      </div>
    </>
  );
};
