import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Plus } from "lucide-react";

interface NoticeUploadDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  preselectedAccessoryId?: string;
}

export const NoticeUploadDialog = ({ trigger, onSuccess, preselectedAccessoryId }: NoticeUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [titre, setTitre] = useState("");
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [categorie, setCategorie] = useState("");
  const [description, setDescription] = useState("");
  const [urlNotice, setUrlNotice] = useState("");
  const [accessories, setAccessories] = useState<Array<{ id: string; nom: string; marque?: string }>>([]);
  const [selectedAccessoryId, setSelectedAccessoryId] = useState<string>("");

  // Auto-open when preselectedAccessoryId changes
  useEffect(() => {
    if (preselectedAccessoryId) {
      setOpen(true);
      setSelectedAccessoryId(preselectedAccessoryId);
    }
  }, [preselectedAccessoryId]);

  useEffect(() => {
    if (open) {
      loadAccessories();
    }
  }, [open]);

  const loadAccessories = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("accessories_catalog")
      .select("id, nom, marque")
      .eq("user_id", user.id)
      .order("nom");

    if (error) {
      console.error("Error loading accessories:", error);
      return;
    }

    setAccessories(data || []);
  };

  const handleSubmit = async () => {
    if (!titre || !urlNotice) {
      toast.error("Le titre et l'URL de la notice sont requis");
      return;
    }

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      // Insert notice
      const { data: notice, error: noticeError } = await supabase
        .from("notices_database")
        .insert({
          titre,
          marque,
          modele,
          categorie,
          description,
          url_notice: urlNotice,
          created_by: user.id,
        })
        .select()
        .single();

      if (noticeError) {
        toast.error("Erreur lors de l'ajout de la notice");
        console.error(noticeError);
        return;
      }

      // Link accessory to notice if selected
      if (selectedAccessoryId && notice) {
        const { error: linkError } = await supabase
          .from("accessories_catalog")
          .update({ notice_id: notice.id })
          .eq("id", selectedAccessoryId);

        if (linkError) {
          console.error("Error linking accessory:", linkError);
          toast.warning("Notice créée mais non liée à l'accessoire");
        }
      }

      toast.success("Notice ajoutée avec succès !");
      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'ajout de la notice");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
    onSuccess?.(); // Call onSuccess to clear preselectedAccessoryId in parent
  };

  const resetForm = () => {
    setTitre("");
    setMarque("");
    setModele("");
    setCategorie("");
    setDescription("");
    setUrlNotice("");
    setSelectedAccessoryId("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {!preselectedAccessoryId && (
        <DialogTrigger asChild>
          {trigger || (
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une notice
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajouter une notice</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Titre de la notice"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="marque">Marque</Label>
              <Input
                id="marque"
                value={marque}
                onChange={(e) => setMarque(e.target.value)}
                placeholder="Marque"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="modele">Modèle</Label>
              <Input
                id="modele"
                value={modele}
                onChange={(e) => setModele(e.target.value)}
                placeholder="Modèle"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="categorie">Catégorie</Label>
            <Input
              id="categorie"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              placeholder="Catégorie"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description de la notice"
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="url">URL de la notice *</Label>
            <Input
              id="url"
              value={urlNotice}
              onChange={(e) => setUrlNotice(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="accessory">Lier à un accessoire (optionnel)</Label>
            <Select value={selectedAccessoryId} onValueChange={setSelectedAccessoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un accessoire" />
              </SelectTrigger>
              <SelectContent>
                {accessories.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.nom} {acc.marque ? `(${acc.marque})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSubmit} disabled={isUploading} className="w-full">
            {isUploading ? (
              "Ajout en cours..."
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Ajouter la notice
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
