import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2 } from "lucide-react";
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {notices.map((notice) => (
        <Card key={notice.id}>
          <CardHeader>
            <CardTitle className="text-lg">{notice.titre}</CardTitle>
            {(notice.marque || notice.modele) && (
              <CardDescription>
                {notice.marque} {notice.modele}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {notice.categorie && (
              <div className="text-sm">
                <span className="font-medium">Catégorie:</span> {notice.categorie}
              </div>
            )}
            {notice.description && (
              <p className="text-sm text-muted-foreground">{notice.description}</p>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => window.open(notice.url_notice, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ouvrir
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
