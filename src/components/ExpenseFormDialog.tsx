import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus } from "lucide-react";

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
    marque: "",
    prix_achat: "",
    prix_vente_ttc: "",
    marge_pourcent: "",
    quantite: "1",
    date_achat: new Date().toISOString().split("T")[0],
    categorie: "",
    fournisseur: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [existingMarques, setExistingMarques] = useState<string[]>([]);
  const [showMarqueList, setShowMarqueList] = useState(false);
  const [filteredMarques, setFilteredMarques] = useState<string[]>([]);
  
  const [catalogCategories, setCatalogCategories] = useState<string[]>([]);
  const [isNewCatalogCategory, setIsNewCatalogCategory] = useState(false);
  const [catalogCategory, setCatalogCategory] = useState("");
  const [showAddToCatalog, setShowAddToCatalog] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadExistingMarques();
      loadCatalogCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.marque) {
      const filtered = existingMarques.filter(m => 
        m.toLowerCase().includes(formData.marque.toLowerCase())
      );
      setFilteredMarques(filtered);
    } else {
      setFilteredMarques([]);
    }
  }, [formData.marque, existingMarques]);

  const loadExistingMarques = async () => {
    const { data: expensesData } = await supabase
      .from("project_expenses")
      .select("marque")
      .not("marque", "is", null);

    const { data: catalogData } = await supabase
      .from("accessories_catalog")
      .select("nom")
      .not("nom", "is", null);

    const marques = new Set<string>();
    expensesData?.forEach(e => e.marque && marques.add(e.marque));
    catalogData?.forEach(c => {
      const match = c.nom.match(/^([A-Z][a-zA-Z0-9]*)/);
      if (match) marques.add(match[1]);
    });

    setExistingMarques(Array.from(marques).sort());
  };

  const loadCatalogCategories = async () => {
    const { data } = await supabase
      .from("accessories_catalog")
      .select("nom");

    if (data) {
      const categories = Array.from(new Set(data.map(item => {
        const parts = item.nom.split(" - ");
        return parts.length > 1 ? parts[0] : "Autre";
      })));
      setCatalogCategories(categories.sort());
    }
  };

  const handlePricingChange = (field: "prix_achat" | "prix_vente_ttc" | "marge_pourcent", value: string) => {
    const newFormData = { ...formData, [field]: value };
    
    // Déterminer quels champs sont remplis (non vides et non zéro)
    const hasPrixAchat = newFormData.prix_achat && parseFloat(newFormData.prix_achat) > 0;
    const hasPrixVente = newFormData.prix_vente_ttc && parseFloat(newFormData.prix_vente_ttc) > 0;
    const hasMarge = newFormData.marge_pourcent && parseFloat(newFormData.marge_pourcent) !== 0;

    // Si on a 2 champs remplis, calculer le 3ème
    if (hasPrixAchat && hasPrixVente && field !== "marge_pourcent") {
      // Prix HT + Prix TTC remplis → calculer la marge
      const prixAchat = parseFloat(newFormData.prix_achat);
      const prixVenteTTC = parseFloat(newFormData.prix_vente_ttc);
      newFormData.marge_pourcent = (((prixVenteTTC - prixAchat) / prixAchat) * 100).toFixed(2);
    } else if (hasPrixVente && hasMarge && field !== "prix_achat") {
      // Prix TTC + Marge remplis → calculer le prix HT
      const prixVenteTTC = parseFloat(newFormData.prix_vente_ttc);
      const margePourcent = parseFloat(newFormData.marge_pourcent);
      newFormData.prix_achat = (prixVenteTTC / (1 + margePourcent / 100)).toFixed(2);
    } else if (hasPrixAchat && hasMarge && field !== "prix_vente_ttc") {
      // Prix HT + Marge remplis → calculer le prix TTC
      const prixAchat = parseFloat(newFormData.prix_achat);
      const margePourcent = parseFloat(newFormData.marge_pourcent);
      newFormData.prix_vente_ttc = (prixAchat * (1 + margePourcent / 100)).toFixed(2);
    }

    setFormData(newFormData);
  };

  const handleAddToCatalog = async () => {
    if (!formData.nom_accessoire || !formData.prix_achat) {
      toast.error("Le nom et le prix d'achat sont requis");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Vous devez être connecté");
      return;
    }

    const catalogName = catalogCategory 
      ? `${catalogCategory} - ${formData.nom_accessoire}`
      : formData.nom_accessoire;

    const { error } = await supabase
      .from("accessories_catalog")
      .insert({
        nom: catalogName,
        prix_reference: parseFloat(formData.prix_achat),
        description: formData.notes || null,
        fournisseur: formData.fournisseur || null,
        user_id: user.id,
      });

    if (error) {
      toast.error("Erreur lors de l'ajout au catalogue");
      console.error(error);
    } else {
      toast.success("Accessoire ajouté au catalogue");
      setShowAddToCatalog(false);
      setCatalogCategory("");
      setIsNewCatalogCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase
      .from("project_expenses")
      .insert({
        project_id: projectId,
        nom_accessoire: formData.nom_accessoire,
        marque: formData.marque || null,
        prix: parseFloat(formData.prix_achat),
        prix_vente_ttc: formData.prix_vente_ttc ? parseFloat(formData.prix_vente_ttc) : null,
        marge_pourcent: formData.marge_pourcent ? parseFloat(formData.marge_pourcent) : null,
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
        marque: "",
        prix_achat: "",
        prix_vente_ttc: "",
        marge_pourcent: "",
        quantite: "1",
        date_achat: new Date().toISOString().split("T")[0],
        categorie: "",
        fournisseur: "",
        notes: "",
      });
      setIsNewCategory(false);
      setShowAddToCatalog(false);
      onSuccess();
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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

            <div className="space-y-2 relative">
              <Label htmlFor="marque">Marque</Label>
              <Input
                id="marque"
                value={formData.marque}
                onChange={(e) => {
                  setFormData({ ...formData, marque: e.target.value });
                  setShowMarqueList(true);
                }}
                onFocus={() => setShowMarqueList(true)}
                onBlur={() => setTimeout(() => setShowMarqueList(false), 200)}
              />
              {showMarqueList && filteredMarques.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredMarques.map((marque) => (
                    <button
                      key={marque}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFormData({ ...formData, marque });
                        setShowMarqueList(false);
                      }}
                    >
                      {marque}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Separator />
          
          <div className="space-y-2">
            <Label className="text-base font-semibold">Calcul de prix (remplir 2 sur 3)</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prix_achat">Prix d'achat (€) *</Label>
                <Input
                  id="prix_achat"
                  type="number"
                  step="0.01"
                  required
                  value={formData.prix_achat}
                  onChange={(e) => handlePricingChange("prix_achat", e.target.value)}
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
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
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
              )}
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

          {showAddToCatalog && (
            <>
              <Separator />
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold">Ajouter au catalogue d'accessoires</h3>
                <div className="space-y-2">
                  <Label>Catégorie du catalogue</Label>
                  {isNewCatalogCategory ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nom de la catégorie"
                        value={catalogCategory}
                        onChange={(e) => setCatalogCategory(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsNewCatalogCategory(false);
                          setCatalogCategory("");
                        }}
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={catalogCategory}
                      onValueChange={(value) => {
                        if (value === "__new__") {
                          setIsNewCatalogCategory(true);
                          setCatalogCategory("");
                        } else {
                          setCatalogCategory(value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner ou créer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new__">+ Nouvelle catégorie</SelectItem>
                        {catalogCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={handleAddToCatalog}>
                    Confirmer l'ajout au catalogue
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddToCatalog(false);
                      setCatalogCategory("");
                      setIsNewCatalogCategory(false);
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-between gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddToCatalog(!showAddToCatalog)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {showAddToCatalog ? "Masquer" : "Ajouter au catalogue"}
            </Button>
            
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Ajout..." : "Ajouter"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseFormDialog;
