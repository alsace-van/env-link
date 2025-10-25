import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Accessory {
  id: string;
  nom: string;
  prix_reference: number | null;
  description: string | null;
  fournisseur: string | null;
  url_produit: string | null;
}

interface AccessoryEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accessory: Accessory | null;
  onSuccess: () => void;
}

const AccessoryEditDialog = ({ isOpen, onClose, accessory, onSuccess }: AccessoryEditDialogProps) => {
  const [formData, setFormData] = useState({
    nom: "",
    prix_reference: "",
    description: "",
    fournisseur: "",
    url_produit: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (accessory) {
      setFormData({
        nom: accessory.nom,
        prix_reference: accessory.prix_reference?.toString() || "",
        description: accessory.description || "",
        fournisseur: accessory.fournisseur || "",
        url_produit: accessory.url_produit || "",
      });
    }
  }, [accessory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessory) return;

    setIsSubmitting(true);

    // Update accessory in catalog
    const { error: catalogError } = await supabase
      .from("accessories_catalog")
      .update({
        nom: formData.nom,
        prix_reference: formData.prix_reference ? parseFloat(formData.prix_reference) : null,
        description: formData.description || null,
        fournisseur: formData.fournisseur || null,
        url_produit: formData.url_produit || null,
      })
      .eq("id", accessory.id);

    if (catalogError) {
      toast.error("Erreur lors de la modification");
      console.error(catalogError);
    } else {
      // Update all related expenses
      const { error: expensesError } = await supabase
        .from("project_expenses")
        .update({
          nom_accessoire: formData.nom,
          prix: formData.prix_reference ? parseFloat(formData.prix_reference) : null,
          fournisseur: formData.fournisseur || null,
        })
        .eq("accessory_id", accessory.id);

      if (expensesError) {
        console.error("Erreur lors de la mise à jour des dépenses:", expensesError);
        toast.warning("Accessoire modifié, mais erreur lors de la mise à jour des dépenses");
      } else {
        toast.success("Accessoire modifié et dépenses mises à jour");
      }

      onSuccess();
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier l'accessoire</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom *</Label>
            <Input
              id="nom"
              required
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prix_reference">Prix de référence (€)</Label>
            <Input
              id="prix_reference"
              type="number"
              step="0.01"
              value={formData.prix_reference}
              onChange={(e) => setFormData({ ...formData, prix_reference: e.target.value })}
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

          <div className="space-y-2">
            <Label htmlFor="url_produit">URL du produit</Label>
            <Input
              id="url_produit"
              type="url"
              value={formData.url_produit}
              onChange={(e) => setFormData({ ...formData, url_produit: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Modification..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AccessoryEditDialog;
