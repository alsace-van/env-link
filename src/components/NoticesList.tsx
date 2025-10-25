import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Notice {
  id: string;
  titre: string;
  marque?: string;
  modele?: string;
  categorie?: string;
  description?: string;
  url_notice: string;
  created_at: string;
}

interface NoticesListProps {
  refreshTrigger?: number;
}

export const NoticesList = ({ refreshTrigger }: NoticesListProps) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotices();
  }, [refreshTrigger]);

  const loadNotices = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("notices_database")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading notices:", error);
        toast.error("Erreur lors du chargement des notices");
        return;
      }

      setNotices(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du chargement des notices");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // First, unlink any accessories
      await supabase
        .from("accessories_catalog")
        .update({ notice_id: null })
        .eq("notice_id", id);

      // Then delete the notice
      const { error } = await supabase
        .from("notices_database")
        .delete()
        .eq("id", id);

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

  const handleDownload = async (url: string, titre: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${titre}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Téléchargement lancé");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du téléchargement");
    }
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

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Titre</TableHead>
            <TableHead className="min-w-[150px]">Marque / Modèle</TableHead>
            <TableHead className="min-w-[120px]">Catégorie</TableHead>
            <TableHead className="min-w-[200px]">Description</TableHead>
            <TableHead className="min-w-[150px]">Date d'ajout</TableHead>
            <TableHead className="w-[180px] text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {notices.map((notice) => (
            <TableRow key={notice.id}>
              <TableCell className="font-medium">{notice.titre}</TableCell>
              <TableCell>
                {notice.marque || notice.modele ? (
                  <div className="text-sm">
                    {notice.marque && <div>{notice.marque}</div>}
                    {notice.modele && <div className="text-muted-foreground">{notice.modele}</div>}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </TableCell>
              <TableCell>
                {notice.categorie || <span className="text-muted-foreground text-xs">-</span>}
              </TableCell>
              <TableCell>
                {notice.description ? (
                  <span className="text-sm line-clamp-2">{notice.description}</span>
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {new Date(notice.created_at).toLocaleDateString("fr-FR")}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(notice.url_notice, notice.titre)}
                    title="Télécharger"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(notice.url_notice, "_blank")}
                    title="Ouvrir dans un nouvel onglet"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
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
                        <AlertDialogAction onClick={() => handleDelete(notice.id)}>
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
