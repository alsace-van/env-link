import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ExpenseFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  existingCategories: string[];
  onSuccess: () => void;
}

const ExpenseFormDialog = ({ isOpen, onClose, projectId, existingCategories, onSuccess }: ExpenseFormDialogProps) => {
  const [formData, setFormData] = useState({
    nom_accessoire: "",
    prix: "",
    quantite: "1",
    date_achat: new Date().toISOString().split("T")[0],
    categorie: "",
    fournisseur: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNewCategory, setIsNewCategory] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase
      .from("project_expenses")
      .insert({
        project_id: projectId,
        nom_accessoire: formData.nom_accessoire,
        prix: parseFloat(formData.prix),
        quantite: parseInt(formData.quantite),
        date_achat: formData.date_achat,
        categorie: formData.categorie,
        fournisseur: formData.fournisseur || null,
        notes: formData.notes || null,
        statut_paiement: "non_paye",
        statut_livraison: "commande",
      });

    if (error) {
      toast.error("Erreur lors de l'ajout de la dépense");
      console.error(error);
    } else {
      toast.success("Dépense ajoutée avec succès");
      setFormData({
        nom_accessoire: "",
        prix: "",
        quantite: "1",
        date_achat: new Date().toISOString().split("T")[0],
        categorie: "",
        fournisseur: "",
        notes: "",
      });
      setIsNewCategory(false);
      onSuccess();
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajouter une dépense</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom de l'accessoire *</Label>
              <Input
                id="nom"
                required
                value={formData.nom_accessoire}
                onChange={(e) => setFormData({ ...formData, nom_accessoire: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categorie">Catégorie *</Label>
              {isNewCategory ? (
                <div className="flex gap-2">
                  <Input
                    id="categorie"
                    required
                    placeholder="Nom de la catégorie"
                    value={formData.categorie}
                    onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsNewCategory(false);
                      setFormData({ ...formData, categorie: "" });
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={formData.categorie}
                    onValueChange={(value) => {
                      if (value === "__new__") {
                        setIsNewCategory(true);
                        setFormData({ ...formData, categorie: "" });
                      } else {
                        setFormData({ ...formData, categorie: value });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner ou créer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__new__">+ Nouvelle catégorie</SelectItem>
                      {existingCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prix">Prix unitaire (€) *</Label>
              <Input
                id="prix"
                type="number"
                step="0.01"
                required
                value={formData.prix}
                onChange={(e) => setFormData({ ...formData, prix: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantite">Quantité *</Label>
              <Input
                id="quantite"
                type="number"
                min="1"
                required
                value={formData.quantite}
                onChange={(e) => setFormData({ ...formData, quantite: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date d'achat</Label>
              <Input
                id="date"
                type="date"
                value={formData.date_achat}
                onChange={(e) => setFormData({ ...formData, date_achat: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fournisseur">Fournisseur</Label>
              <Input
                id="fournisseur"
                value={formData.fournisseur}
                onChange={(e) => setFormData({ ...formData, fournisseur: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Ajout..." : "Ajouter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseFormDialog;
