import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Notice {
  id: string;
  titre: string;
  marque?: string;
  modele?: string;
  categorie?: string;
  description?: string;
  url_notice: string;
}

interface NoticeEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notice: Notice | null;
  onSuccess: () => void;
}

export const NoticeEditDialog = ({ isOpen, onClose, notice, onSuccess }: NoticeEditDialogProps) => {
  const [formData, setFormData] = useState({
    titre: "",
    marque: "",
    modele: "",
    categorie: "",
    description: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (notice) {
      setFormData({
        titre: notice.titre || "",
        marque: notice.marque || "",
        modele: notice.modele || "",
        categorie: notice.categorie || "",
        description: notice.description || "",
      });
    }
  }, [notice]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!notice) return;
    
    if (!formData.titre.trim()) {
      toast.error("Le titre est obligatoire");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("notices_database")
        .update({
          titre: formData.titre.trim(),
          marque: formData.marque.trim() || null,
          modele: formData.modele.trim() || null,
          categorie: formData.categorie.trim() || null,
          description: formData.description.trim() || null,
        })
        .eq("id", notice.id);

      if (error) {
        console.error("Error updating notice:", error);
        toast.error("Erreur lors de la modification");
        return;
      }

      toast.success("Notice modifiée avec succès");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erreur lors de la modification");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier la notice</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titre">
              Titre <span className="text-red-500">*</span>
            </Label>
            <Input
              id="titre"
              value={formData.titre}
              onChange={(e) => handleChange("titre", e.target.value)}
              placeholder="Titre de la notice"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="marque">Marque</Label>
              <Input
                id="marque"
                value={formData.marque}
                onChange={(e) => handleChange("marque", e.target.value)}
                placeholder="Marque (optionnel)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modele">Modèle</Label>
              <Input
                id="modele"
                value={formData.modele}
                onChange={(e) => handleChange("modele", e.target.value)}
                placeholder="Modèle (optionnel)"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="categorie">Catégorie</Label>
            <Input
              id="categorie"
              value={formData.categorie}
              onChange={(e) => handleChange("categorie", e.target.value)}
              placeholder="Catégorie (optionnel)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Description de la notice (optionnel)"
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
