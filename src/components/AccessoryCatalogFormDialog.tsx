import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface AccessoryCatalogFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accessory?: {
    id: string;
    nom: string;
    prix_reference?: number;
    fournisseur?: string;
    description?: string;
    url_produit?: string;
  } | null;
}

const AccessoryCatalogFormDialog = ({ isOpen, onClose, onSuccess, accessory }: AccessoryCatalogFormDialogProps) => {
  const [formData, setFormData] = useState({
    nom: "",
    prix_reference: "",
    prix_vente_ttc: "",
    marge_pourcent: "",
    fournisseur: "",
    description: "",
    url_produit: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (accessory) {
        // Mode édition
        setFormData({
          nom: accessory.nom,
          prix_reference: accessory.prix_reference?.toString() || "",
          prix_vente_ttc: "",
          marge_pourcent: "",
          fournisseur: accessory.fournisseur || "",
          description: accessory.description || "",
          url_produit: accessory.url_produit || "",
        });
      } else {
        // Mode création
        setFormData({
          nom: "",
          prix_reference: "",
          prix_vente_ttc: "",
          marge_pourcent: "",
          fournisseur: "",
          description: "",
          url_produit: "",
        });
      }
    }
  }, [isOpen, accessory]);

  const handlePricingChange = (field: "prix_reference" | "prix_vente_ttc" | "marge_pourcent", value: string) => {
    const newFormData = { ...formData, [field]: value };
    
    // Déterminer quels champs sont remplis (non vides et non zéro)
    const hasPrixReference = newFormData.prix_reference && parseFloat(newFormData.prix_reference) > 0;
    const hasPrixVente = newFormData.prix_vente_ttc && parseFloat(newFormData.prix_vente_ttc) > 0;
    const hasMarge = newFormData.marge_pourcent && parseFloat(newFormData.marge_pourcent) !== 0;

    // Si on a 2 champs remplis, calculer le 3ème
    if (hasPrixReference && hasPrixVente && field !== "marge_pourcent") {
      // Prix référence + Prix TTC remplis → calculer la marge
      const prixReference = parseFloat(newFormData.prix_reference);
      const prixVenteTTC = parseFloat(newFormData.prix_vente_ttc);
      newFormData.marge_pourcent = (((prixVenteTTC - prixReference) / prixReference) * 100).toFixed(2);
    } else if (hasPrixVente && hasMarge && field !== "prix_reference") {
      // Prix TTC + Marge remplis → calculer le prix référence
      const prixVenteTTC = parseFloat(newFormData.prix_vente_ttc);
      const margePourcent = parseFloat(newFormData.marge_pourcent);
      newFormData.prix_reference = (prixVenteTTC / (1 + margePourcent / 100)).toFixed(2);
    } else if (hasPrixReference && hasMarge && field !== "prix_vente_ttc") {
      // Prix référence + Marge remplis → calculer le prix TTC
      const prixReference = parseFloat(newFormData.prix_reference);
      const margePourcent = parseFloat(newFormData.marge_pourcent);
      newFormData.prix_vente_ttc = (prixReference * (1 + margePourcent / 100)).toFixed(2);
    }

    setFormData(newFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Vous devez être connecté");
      setIsSubmitting(false);
      return;
    }

    if (accessory) {
      // Mode édition
      const { error } = await supabase
        .from("accessories_catalog")
        .update({
          nom: formData.nom,
          prix_reference: formData.prix_reference ? parseFloat(formData.prix_reference) : null,
          fournisseur: formData.fournisseur || null,
          description: formData.description || null,
          url_produit: formData.url_produit || null,
        })
        .eq("id", accessory.id);

      if (error) {
        toast.error("Erreur lors de la modification");
        console.error(error);
      } else {
        // Mettre à jour toutes les dépenses liées
        const { error: expenseError } = await supabase
          .from("project_expenses")
          .update({
            nom_accessoire: formData.nom,
            prix: formData.prix_reference ? parseFloat(formData.prix_reference) : null,
            fournisseur: formData.fournisseur || null,
          })
          .eq("accessory_id", accessory.id);

        if (expenseError) {
          console.error("Erreur lors de la mise à jour des dépenses:", expenseError);
          toast.warning("Article modifié mais erreur lors de la mise à jour des dépenses");
        } else {
          toast.success("Article et dépenses liées mis à jour");
        }

        onSuccess();
      }
    } else {
      // Mode création
      const { error } = await supabase
        .from("accessories_catalog")
        .insert({
          user_id: user.id,
          nom: formData.nom,
          prix_reference: formData.prix_reference ? parseFloat(formData.prix_reference) : null,
          fournisseur: formData.fournisseur || null,
          description: formData.description || null,
          url_produit: formData.url_produit || null,
        });

      if (error) {
        toast.error("Erreur lors de l'ajout au catalogue");
        console.error(error);
      } else {
        toast.success("Article ajouté au catalogue");
        setFormData({
          nom: "",
          prix_reference: "",
          prix_vente_ttc: "",
          marge_pourcent: "",
          fournisseur: "",
          description: "",
          url_produit: "",
        });
        onSuccess();
      }
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{accessory ? "Modifier l'article" : "Ajouter un article au catalogue"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom de l'article *</Label>
            <Input
              id="nom"
              required
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              placeholder="Ex: Batterie lithium 100Ah"
            />
          </div>

          <Separator />
          
          <div className="space-y-2">
            <Label className="text-base font-semibold">Calcul de prix (remplir 2 sur 3)</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prix_reference">Prix de référence (€)</Label>
                <Input
                  id="prix_reference"
                  type="number"
                  step="0.01"
                  value={formData.prix_reference}
                  onChange={(e) => handlePricingChange("prix_reference", e.target.value)}
                  placeholder="Prix d'achat"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prix_vente">Prix de vente TTC (€)</Label>
                <Input
                  id="prix_vente"
                  type="number"
                  step="0.01"
                  value={formData.prix_vente_ttc}
                  onChange={(e) => handlePricingChange("prix_vente_ttc", e.target.value)}
                  placeholder="Prix de vente"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="marge">Marge (%)</Label>
                <Input
                  id="marge"
                  type="number"
                  step="0.01"
                  value={formData.marge_pourcent}
                  onChange={(e) => handlePricingChange("marge_pourcent", e.target.value)}
                  placeholder="% de marge"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fournisseur">Fournisseur</Label>
              <Input
                id="fournisseur"
                value={formData.fournisseur}
                onChange={(e) => setFormData({ ...formData, fournisseur: e.target.value })}
                placeholder="Nom du fournisseur"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url_produit">URL du produit</Label>
              <Input
                id="url_produit"
                type="url"
                value={formData.url_produit}
                onChange={(e) => setFormData({ ...formData, url_produit: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Caractéristiques techniques, notes..."
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "En cours..." : accessory ? "Modifier" : "Ajouter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AccessoryCatalogFormDialog;
