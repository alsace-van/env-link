import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notice {
  id: string;
  titre: string;
  marque?: string;
  modele?: string;
  categorie?: string;
  description?: string;
  notice_url: string;
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

  // États pour l'autocomplétion
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [existingMarques, setExistingMarques] = useState<string[]>([]);
  const [categoriePopoverOpen, setCategoriePopoverOpen] = useState(false);
  const [marquePopoverOpen, setMarquePopoverOpen] = useState(false);

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

  // Charger les catégories et marques existantes à l'ouverture
  useEffect(() => {
    if (isOpen) {
      loadExistingData();
    }
  }, [isOpen]);

  const loadExistingData = async () => {
    try {
      const { data, error } = (await supabase.from("notices_database").select("categorie, marque")) as any;

      if (error) {
        console.error("Erreur chargement données:", error);
        return;
      }

      // Extraire les catégories uniques
      const categories = [...new Set(data.map((item: any) => item.categorie).filter(Boolean))].sort() as string[];
      setExistingCategories(categories);

      // Extraire les marques uniques
      const marques = [...new Set(data.map((item: any) => item.marque).filter(Boolean))].sort() as string[];
      setExistingMarques(marques);
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
        } as any)
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

  // Composant réutilisable pour l'autocomplétion
  const AutocompleteInput = ({
    id,
    label,
    value,
    onChange,
    placeholder,
    existingValues,
    isOpen,
    setIsOpen,
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    existingValues: string[];
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
  }) => {
    const filteredValues = existingValues.filter((v) => !value || v.toLowerCase().includes(value.toLowerCase()));

    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="relative">
          <Input
            id={id}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              setTimeout(() => setIsOpen(false), 200);
            }}
            placeholder={placeholder}
            autoComplete="off"
          />
          {isOpen && (existingValues.length > 0 || value) && (
            <div className="absolute z-[100] top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-auto">
              {filteredValues.length > 0 ? (
                filteredValues.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2",
                      value === v && "bg-accent",
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange(v);
                      setIsOpen(false);
                    }}
                  >
                    {value === v && <Check className="h-4 w-4 text-primary" />}
                    <span className={value === v ? "" : "ml-6"}>{v}</span>
                  </button>
                ))
              ) : existingValues.length > 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Aucune correspondance</div>
              ) : null}

              {value && !existingValues.some((v) => v.toLowerCase() === value.toLowerCase()) && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 border-t"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Créer "{value}"
                </button>
              )}

              {!value && existingValues.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Tapez pour créer une valeur</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
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
            <AutocompleteInput
              id="marque"
              label="Marque"
              value={formData.marque}
              onChange={(value) => handleChange("marque", value)}
              placeholder="Marque (optionnel)"
              existingValues={existingMarques}
              isOpen={marquePopoverOpen}
              setIsOpen={setMarquePopoverOpen}
            />

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

          <AutocompleteInput
            id="categorie"
            label="Catégorie"
            value={formData.categorie}
            onChange={(value) => handleChange("categorie", value)}
            placeholder="Catégorie (optionnel)"
            existingValues={existingCategories}
            isOpen={categoriePopoverOpen}
            setIsOpen={setCategoriePopoverOpen}
          />

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
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
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
