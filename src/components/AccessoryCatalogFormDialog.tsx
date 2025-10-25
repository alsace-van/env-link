import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Category {
  id: string;
  nom: string;
  parent_id: string | null;
}

interface AccessoryCatalogFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accessory?: {
    id: string;
    nom: string;
    category_id?: string | null;
    prix_reference?: number;
    prix_vente_ttc?: number;
    marge_pourcent?: number;
    fournisseur?: string;
    description?: string;
    url_produit?: string;
    type_electrique?: string | null;
    poids_kg?: number | null;
    longueur_mm?: number | null;
    largeur_mm?: number | null;
    hauteur_mm?: number | null;
  } | null;
}

const AccessoryCatalogFormDialog = ({ isOpen, onClose, onSuccess, accessory }: AccessoryCatalogFormDialogProps) => {
  const [formData, setFormData] = useState({
    nom: "",
    category_id: "",
    prix_reference: "",
    prix_vente_ttc: "",
    marge_pourcent: "",
    fournisseur: "",
    description: "",
    url_produit: "",
    type_electrique: "",
    poids_kg: "",
    longueur_mm: "",
    largeur_mm: "",
    hauteur_mm: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParent, setNewCategoryParent] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      
      if (accessory) {
        // Mode édition
        setFormData({
          nom: accessory.nom,
          category_id: accessory.category_id || "",
          prix_reference: accessory.prix_reference?.toString() || "",
          prix_vente_ttc: accessory.prix_vente_ttc?.toString() || "",
          marge_pourcent: accessory.marge_pourcent?.toString() || "",
          fournisseur: accessory.fournisseur || "",
          description: accessory.description || "",
          url_produit: accessory.url_produit || "",
          type_electrique: accessory.type_electrique || "",
          poids_kg: accessory.poids_kg?.toString() || "",
          longueur_mm: accessory.longueur_mm?.toString() || "",
          largeur_mm: accessory.largeur_mm?.toString() || "",
          hauteur_mm: accessory.hauteur_mm?.toString() || "",
        });
      } else {
        // Mode création
        setFormData({
          nom: "",
          category_id: "",
          prix_reference: "",
          prix_vente_ttc: "",
          marge_pourcent: "",
          fournisseur: "",
          description: "",
          url_produit: "",
          type_electrique: "",
          poids_kg: "",
          longueur_mm: "",
          largeur_mm: "",
          hauteur_mm: "",
        });
      }
    }
  }, [isOpen, accessory]);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("nom");

    if (!error && data) {
      setCategories(data);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Veuillez entrer un nom de catégorie");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Vous devez être connecté");
      return;
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({
        nom: newCategoryName.trim(),
        parent_id: newCategoryParent,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error("Erreur lors de la création de la catégorie");
      console.error(error);
    } else {
      toast.success("Catégorie créée");
      setFormData({ ...formData, category_id: data.id });
      setIsCreatingCategory(false);
      setNewCategoryName("");
      setNewCategoryParent(null);
      loadCategories();
    }
  };

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
          category_id: formData.category_id || null,
          prix_reference: formData.prix_reference ? parseFloat(formData.prix_reference) : null,
          prix_vente_ttc: formData.prix_vente_ttc ? parseFloat(formData.prix_vente_ttc) : null,
          marge_pourcent: formData.marge_pourcent ? parseFloat(formData.marge_pourcent) : null,
          fournisseur: formData.fournisseur || null,
          description: formData.description || null,
          url_produit: formData.url_produit || null,
          type_electrique: formData.type_electrique || null,
          poids_kg: formData.poids_kg ? parseFloat(formData.poids_kg) : null,
          longueur_mm: formData.longueur_mm ? parseInt(formData.longueur_mm) : null,
          largeur_mm: formData.largeur_mm ? parseInt(formData.largeur_mm) : null,
          hauteur_mm: formData.hauteur_mm ? parseInt(formData.hauteur_mm) : null,
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
          category_id: formData.category_id || null,
          prix_reference: formData.prix_reference ? parseFloat(formData.prix_reference) : null,
          prix_vente_ttc: formData.prix_vente_ttc ? parseFloat(formData.prix_vente_ttc) : null,
          marge_pourcent: formData.marge_pourcent ? parseFloat(formData.marge_pourcent) : null,
          fournisseur: formData.fournisseur || null,
          description: formData.description || null,
          url_produit: formData.url_produit || null,
          type_electrique: formData.type_electrique || null,
          poids_kg: formData.poids_kg ? parseFloat(formData.poids_kg) : null,
          longueur_mm: formData.longueur_mm ? parseInt(formData.longueur_mm) : null,
          largeur_mm: formData.largeur_mm ? parseInt(formData.largeur_mm) : null,
          hauteur_mm: formData.hauteur_mm ? parseInt(formData.hauteur_mm) : null,
        });

      if (error) {
        toast.error("Erreur lors de l'ajout au catalogue");
        console.error(error);
      } else {
        toast.success("Article ajouté au catalogue");
        
        // Chercher et lier les dépenses correspondantes
        const { data: newAccessory } = await supabase
          .from("accessories_catalog")
          .select("id")
          .eq("user_id", user.id)
          .eq("nom", formData.nom)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (newAccessory) {
          // Trouver les dépenses qui correspondent
          const { data: matchingExpenses } = await supabase
            .from("project_expenses")
            .select("id, nom_accessoire, prix, fournisseur")
            .is("accessory_id", null);

          if (matchingExpenses && matchingExpenses.length > 0) {
            let linkedCount = 0;
            
            for (const expense of matchingExpenses) {
              const nameMatch = formData.nom.toLowerCase().includes(expense.nom_accessoire.toLowerCase()) ||
                               expense.nom_accessoire.toLowerCase().includes(formData.nom.toLowerCase());
              const priceMatch = formData.prix_reference && 
                                Math.abs(parseFloat(formData.prix_reference) - expense.prix) < 0.01;
              const supplierMatch = formData.fournisseur && expense.fournisseur && 
                                   formData.fournisseur.toLowerCase() === expense.fournisseur.toLowerCase();
              
              if (nameMatch || priceMatch || supplierMatch) {
                const { error: linkError } = await supabase
                  .from("project_expenses")
                  .update({ accessory_id: newAccessory.id })
                  .eq("id", expense.id);

                if (!linkError) {
                  linkedCount++;
                }
              }
            }

            if (linkedCount > 0) {
              toast.success(`Article ajouté et ${linkedCount} dépense(s) liée(s)`);
            }
          }
        }

        setFormData({
          nom: "",
          category_id: "",
          prix_reference: "",
          prix_vente_ttc: "",
          marge_pourcent: "",
          fournisseur: "",
          description: "",
          url_produit: "",
          type_electrique: "",
          poids_kg: "",
          longueur_mm: "",
          largeur_mm: "",
          hauteur_mm: "",
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

          <div className="space-y-2">
            <Label htmlFor="category_id">Catégorie</Label>
            {isCreatingCategory ? (
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="new-category-name">Nom de la catégorie</Label>
                  <Input
                    id="new-category-name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Ex: Électronique"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-category-parent">Catégorie parente (optionnel)</Label>
                  <Select
                    value={newCategoryParent || "none"}
                    onValueChange={(value) => setNewCategoryParent(value === "none" ? null : value)}
                  >
                    <SelectTrigger id="new-category-parent">
                      <SelectValue placeholder="Aucune" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune (catégorie principale)</SelectItem>
                      {categories
                        .filter(cat => cat.parent_id === null)
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nom}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleCreateCategory}
                    className="flex-1"
                  >
                    Créer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreatingCategory(false);
                      setNewCategoryName("");
                      setNewCategoryParent(null);
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Select
                  value={formData.category_id || "none"}
                  onValueChange={(value) => {
                    if (value === "__create__") {
                      setIsCreatingCategory(true);
                    } else {
                      setFormData({ ...formData, category_id: value === "none" ? "" : value });
                    }
                  }}
                >
                  <SelectTrigger id="category_id">
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__create__">+ Créer une nouvelle catégorie</SelectItem>
                    <SelectItem value="none">Aucune catégorie</SelectItem>
                    {categories
                      .filter(cat => cat.parent_id === null)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nom}
                        </SelectItem>
                      ))}
                    {categories
                      .filter(cat => cat.parent_id !== null)
                      .map((cat) => {
                        const parent = categories.find(p => p.id === cat.parent_id);
                        return (
                          <SelectItem key={cat.id} value={cat.id}>
                            {parent?.nom} → {cat.nom}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />
          
          <div className="space-y-2">
            <Label className="text-base font-semibold">Calcul de prix (remplir 2 sur 3)</Label>
            <div className="grid grid-cols-4 gap-4">
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

              <div className="space-y-2">
                <Label htmlFor="marge_euros">Marge nette (€)</Label>
                <Input
                  id="marge_euros"
                  type="text"
                  value={
                    formData.prix_reference && formData.prix_vente_ttc
                      ? ((parseFloat(formData.prix_vente_ttc) / 1.20) - parseFloat(formData.prix_reference)).toFixed(2)
                      : ""
                  }
                  readOnly
                  disabled
                  placeholder="Auto"
                  className="bg-muted"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type_electrique">Type électrique</Label>
              <Select
                value={formData.type_electrique || "none"}
                onValueChange={(value) => setFormData({ ...formData, type_electrique: value === "none" ? "" : value })}
              >
                <SelectTrigger id="type_electrique">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non applicable</SelectItem>
                  <SelectItem value="consommateur">Consommateur</SelectItem>
                  <SelectItem value="producteur">Producteur</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="poids">Poids (kg)</Label>
              <Input
                id="poids"
                type="number"
                step="0.01"
                value={formData.poids_kg}
                onChange={(e) => setFormData({ ...formData, poids_kg: e.target.value })}
                placeholder="Ex: 12.5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dimensions (mm)</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="longueur" className="text-xs text-muted-foreground">Longueur</Label>
                <Input
                  id="longueur"
                  type="number"
                  value={formData.longueur_mm}
                  onChange={(e) => setFormData({ ...formData, longueur_mm: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="largeur" className="text-xs text-muted-foreground">Largeur</Label>
                <Input
                  id="largeur"
                  type="number"
                  value={formData.largeur_mm}
                  onChange={(e) => setFormData({ ...formData, largeur_mm: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hauteur" className="text-xs text-muted-foreground">Hauteur</Label>
                <Input
                  id="hauteur"
                  type="number"
                  value={formData.hauteur_mm}
                  onChange={(e) => setFormData({ ...formData, hauteur_mm: e.target.value })}
                  placeholder="0"
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
