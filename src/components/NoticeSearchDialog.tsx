import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Link as LinkIcon, Plus, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Notice {
  id: string;
  titre: string;
  marque?: string;
  modele?: string;
  categorie?: string;
  description?: string;
  url_notice: string;
}

interface NoticeSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accessoryId: string;
  accessoryMarque?: string;
  accessoryNom?: string;
  onSuccess: () => void;
}

export const NoticeSearchDialog = ({ 
  isOpen, 
  onClose, 
  accessoryId,
  accessoryMarque,
  accessoryNom,
  onSuccess 
}: NoticeSearchDialogProps) => {
  const [searchMarque, setSearchMarque] = useState(accessoryMarque || "");
  const [searchModele, setSearchModele] = useState("");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [filteredNotices, setFilteredNotices] = useState<Notice[]>([]);
  const [isLinking, setIsLinking] = useState(false);
  const [showCreateNew, setShowCreateNew] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadNotices();
      setSearchMarque(accessoryMarque || "");
    }
  }, [isOpen, accessoryMarque]);

  useEffect(() => {
    filterNotices();
  }, [searchMarque, searchModele, notices]);

  const loadNotices = async () => {
    const { data, error } = await supabase
      .from("notices_database")
      .select("*")
      .order("created_at", { ascending: false }) as any;

    if (error) {
      console.error("Error loading notices:", error);
      return;
    }

    setNotices((data || []) as any);
  };

  const filterNotices = () => {
    let filtered = notices;

    if (searchMarque.trim()) {
      filtered = filtered.filter((notice) =>
        notice.marque?.toLowerCase().includes(searchMarque.toLowerCase())
      );
    }

    if (searchModele.trim()) {
      filtered = filtered.filter((notice) =>
        notice.modele?.toLowerCase().includes(searchModele.toLowerCase()) ||
        notice.titre?.toLowerCase().includes(searchModele.toLowerCase())
      );
    }

    setFilteredNotices(filtered);
  };

  const handleLinkNotice = async (noticeId: string) => {
    setIsLinking(true);

    try {
      const { error } = await supabase
        .from("accessories_catalog")
        .update({ notice_id: noticeId } as any)
        .eq("id", accessoryId);

      if (error) {
        toast.error("Erreur lors de la liaison");
        console.error(error);
        return;
      }

      toast.success("Notice liée avec succès !");
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la liaison");
    } finally {
      setIsLinking(false);
    }
  };

  const handleCreateNew = () => {
    setShowCreateNew(true);
    onClose();
    // TODO: ouvrir le dialogue de création de notice
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Rechercher et lier une notice</DialogTitle>
          <CardDescription>
            Accessoire: {accessoryNom}
          </CardDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Champs de recherche */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="search-marque">Recherche par marque</Label>
              <Input
                id="search-marque"
                value={searchMarque}
                onChange={(e) => setSearchMarque(e.target.value)}
                placeholder="Entrez une marque..."
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="search-modele">Recherche par modèle</Label>
              <Input
                id="search-modele"
                value={searchModele}
                onChange={(e) => setSearchModele(e.target.value)}
                placeholder="Entrez un modèle..."
              />
            </div>
          </div>

          <Separator />

          {/* Résultats de recherche */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base">
                Notices trouvées ({filteredNotices.length})
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateNew}
              >
                <Plus className="h-4 w-4 mr-2" />
                Créer nouvelle notice
              </Button>
            </div>

            <ScrollArea className="h-[400px] border rounded-md p-4">
              {filteredNotices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune notice trouvée</p>
                  <p className="text-sm mt-2">
                    Essayez de modifier vos critères de recherche ou créez une nouvelle notice
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredNotices.map((notice) => (
                    <div
                      key={notice.id}
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{notice.titre}</h4>
                            {notice.categorie && (
                              <Badge variant="secondary" className="text-xs">
                                {notice.categorie}
                              </Badge>
                            )}
                          </div>
                          
                          {(notice.marque || notice.modele) && (
                            <div className="text-sm text-muted-foreground">
                              {notice.marque && <span className="font-medium">{notice.marque}</span>}
                              {notice.marque && notice.modele && " - "}
                              {notice.modele && <span>{notice.modele}</span>}
                            </div>
                          )}
                          
                          {notice.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {notice.description}
                            </p>
                          )}
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleLinkNotice(notice.id)}
                          disabled={isLinking}
                        >
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Lier
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
