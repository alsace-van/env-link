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
import { Plus, X } from "lucide-react";

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
    marque?: string;
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
    puissance_watts?: number | null;
    intensite_amperes?: number | null;
    couleur?: string | null;
  } | null;
}

const AccessoryCatalogFormDialog = ({ isOpen, onClose, onSuccess, accessory }: AccessoryCatalogFormDialogProps) => {
  const [formData, setFormData] = useState({
    nom: "",
    marque: "",
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
    puissance_watts: "",
    intensite_amperes: "",
    couleur: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParent, setNewCategoryParent] = useState<string | null>(null);
  const [parentCategoryId, setParentCategoryId] = useState<string>("");
  
  // Options payantes
  const [options, setOptions] = useState<Array<{ id?: string; nom: string; prix: string }>>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Charger les catégories et options quand le dialogue s'ouvre
  useEffect(() => {
    if (isOpen) {
      setCategoriesLoaded(false);
      loadCategories();
      if (accessory) {
        loadOptions(accessory.id);
      } else {
        setOptions([]);
      }
    }
  }, [isOpen, accessory?.id]);

  // Initialiser le formulaire une fois les catégories chargées
  useEffect(() => {
    if (isOpen && categoriesLoaded) {
      if (accessory) {
        // Mode édition - utiliser ?? pour préserver les valeurs null
        setFormData({
          nom: accessory.nom,
          marque: accessory.marque ?? "",
          category_id: accessory.category_id ?? "",
          prix_reference: accessory.prix_reference?.toString() ?? "",
          prix_vente_ttc: accessory.prix_vente_ttc?.toString() ?? "",
          marge_pourcent: accessory.marge_pourcent?.toString() ?? "",
          fournisseur: accessory.fournisseur ?? "",
          description: accessory.description ?? "",
          url_produit: accessory.url_produit ?? "",
          type_electrique: accessory.type_electrique ?? "",
          poids_kg: accessory.poids_kg?.toString() ?? "",
          longueur_mm: accessory.longueur_mm?.toString() ?? "",
          largeur_mm: accessory.largeur_mm?.toString() ?? "",
          hauteur_mm: accessory.hauteur_mm?.toString() ?? "",
          puissance_watts: accessory.puissance_watts?.toString() ?? "",
          intensite_amperes: accessory.intensite_amperes?.toString() ?? "",
          couleur: accessory.couleur ?? "",
        });
        
        // Initialiser la catégorie parente si l'accessoire a une catégorie
        if (accessory.category_id) {
          const selectedCategory = categories.find(c => c.id === accessory.category_id);
          if (selectedCategory?.parent_id) {
            // C'est une sous-catégorie
            setParentCategoryId(selectedCategory.parent_id);
          } else if (selectedCategory) {
            // C'est une catégorie principale
            setParentCategoryId("");
          }
        }
      } else {
        // Mode création
        setFormData({
          nom: "",
          marque: "",
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
          puissance_watts: "",
          intensite_amperes: "",
          couleur: "",
        });
        setParentCategoryId("");
      }
    }
  }, [isOpen, categoriesLoaded, accessory?.id, categories]);

  const loadCategories = async () => {
    const { data, error } = await supabase.from("categories").select("*").order("nom");

    if (!error && data) {
      setCategories(data);
      setCategoriesLoaded(true);
    }
  };

  const loadOptions = async (accessoryId: string) => {
    setLoadingOptions(true);
    const { data, error } = await supabase
      .from("accessory_options")
      .select("*")
      .eq("accessory_id", accessoryId)
      .order("created_at");

    if (!error && data) {
      setOptions(data.map(opt => ({ id: opt.id, nom: opt.nom, prix: opt.prix.toString() })));
    }
    setLoadingOptions(false);
  };

  const handleAddOption = () => {
    setOptions([...options, { nom: "", prix: "" }]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, field: "nom" | "prix", value: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setOptions(newOptions);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Veuillez entrer un nom de catégorie");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
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

  const handleElectricalChange = (field: "puissance_watts" | "intensite_amperes", value: string) => {
    const newFormData = { ...formData, [field]: value };
    const voltage = 12; // 12V system

    if (field === "puissance_watts" && value) {
      // Calculate intensity from power: I = P / U
      const power = parseFloat(value);
      if (!isNaN(power) && power > 0) {
        newFormData.intensite_amperes = (power / voltage).toFixed(2);
      }
    } else if (field === "intensite_amperes" && value) {
      // Calculate power from intensity: P = U × I
      const intensity = parseFloat(value);
      if (!isNaN(intensity) && intensity > 0) {
        newFormData.puissance_watts = (intensity * voltage).toFixed(1);
      }
    }

    setFormData(newFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Vous devez être connecté");
      setIsSubmitting(false);
      return;
    }

    let savedAccessoryId = accessory?.id;

    if (accessory) {
      // Mode édition
      const { error } = await supabase
        .from("accessories_catalog")
        .update({
          nom: formData.nom,
          marque: formData.marque || null,
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
          puissance_watts: formData.puissance_watts ? parseFloat(formData.puissance_watts) : null,
          intensite_amperes: formData.intensite_amperes ? parseFloat(formData.intensite_amperes) : null,
          couleur: formData.couleur || null,
        })
        .eq("id", accessory.id);

      if (error) {
        toast.error("Erreur lors de la modification");
        console.error(error);
        setIsSubmitting(false);
        return;
      }
    } else {
      // Mode création
      const { data: newAccessory, error } = await supabase
        .from("accessories_catalog")
        .insert({
          nom: formData.nom,
          marque: formData.marque || null,
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
          puissance_watts: formData.puissance_watts ? parseFloat(formData.puissance_watts) : null,
          intensite_amperes: formData.intensite_amperes ? parseFloat(formData.intensite_amperes) : null,
          couleur: formData.couleur || null,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        toast.error("Erreur lors de l'ajout");
        console.error(error);
        setIsSubmitting(false);
        return;
      }
      
      savedAccessoryId = newAccessory.id;
    }

    // Gérer les options
    if (savedAccessoryId) {
      // Supprimer les options existantes qui ne sont plus dans la liste
      const existingOptionIds = options.filter(opt => opt.id).map(opt => opt.id!);
      if (accessory) {
        const { error: deleteError } = await supabase
          .from("accessory_options")
          .delete()
          .eq("accessory_id", savedAccessoryId)
          .not("id", "in", `(${existingOptionIds.length > 0 ? existingOptionIds.join(",") : "'none'"})`);

        if (deleteError) {
          console.error("Erreur lors de la suppression des options:", deleteError);
        }
      }

      // Ajouter ou mettre à jour les options
      for (const option of options) {
        if (option.nom && option.prix) {
          if (option.id) {
            // Mettre à jour l'option existante
            const { error: updateError } = await supabase
              .from("accessory_options")
              .update({
                nom: option.nom,
                prix: parseFloat(option.prix),
              })
              .eq("id", option.id);

            if (updateError) {
              console.error("Erreur lors de la mise à jour d'une option:", updateError);
            }
          } else {
            // Créer une nouvelle option
            const { error: insertError } = await supabase
              .from("accessory_options")
              .insert({
                accessory_id: savedAccessoryId,
                nom: option.nom,
                prix: parseFloat(option.prix),
              });

            if (insertError) {
              console.error("Erreur lors de l'ajout d'une option:", insertError);
            }
          }
        }
      }
    }

    toast.success(accessory ? "Accessoire modifié" : "Accessoire ajouté au catalogue");
    onSuccess();
    onClose();

    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{accessory ? "Modifier l'accessoire" : "Ajouter un accessoire au catalogue"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nom">
                Nom <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nom"
                type="text"
                required
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Ex: Panneau solaire 400W"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="marque">Marque</Label>
              <Input
                id="marque"
                type="text"
                value={formData.marque}
                onChange={(e) => setFormData({ ...formData, marque: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Ex: Victron Energy"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            {isCreatingCategory ? (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Nouvelle catégorie</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsCreatingCategory(false);
                      setNewCategoryName("");
                      setNewCategoryParent(null);
                    }}
                  >
                    Annuler
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_category_name">Nom de la catégorie</Label>
                  <Input
                    id="new_category_name"
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => {
                      // Force la mise à jour du state
                      setNewCategoryName(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      // Permettre Enter pour créer la catégorie
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateCategory();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setIsCreatingCategory(false);
                        setNewCategoryName("");
                        setNewCategoryParent(null);
                      }
                    }}
                    placeholder="Ex: Panneaux solaires"
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category_parent">Catégorie parente (optionnel)</Label>
                  <Select
                    value={newCategoryParent || "none"}
                    onValueChange={(value) => setNewCategoryParent(value === "none" ? null : value)}
                  >
                    <SelectTrigger id="category_parent">
                      <SelectValue placeholder="Aucune (catégorie principale)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune (catégorie principale)</SelectItem>
                      {categories
                        .filter((cat) => cat.parent_id === null)
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nom}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="button" onClick={handleCreateCategory} className="w-full">
                  Créer la catégorie
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="parent_category_id">Catégorie principale</Label>
                  <Select
                    value={parentCategoryId || "none"}
                    onValueChange={(value) => {
                      if (value === "__create__") {
                        setIsCreatingCategory(true);
                      } else {
                        setParentCategoryId(value === "none" ? "" : value);
                        // Réinitialiser la sous-catégorie quand on change de catégorie principale
                        setFormData({ ...formData, category_id: "" });
                      }
                    }}
                  >
                    <SelectTrigger id="parent_category_id">
                      <SelectValue placeholder="Sélectionner une catégorie principale" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="__create__">+ Créer une nouvelle catégorie</SelectItem>
                      <SelectItem value="none">Aucune catégorie</SelectItem>
                      {categories
                        .filter((cat) => cat.parent_id === null)
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nom}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {parentCategoryId && (
                  <div className="space-y-2">
                    <Label htmlFor="subcategory_id">Sous-catégorie</Label>
                    <Select
                      value={formData.category_id || "none"}
                      onValueChange={(value) => {
                        setFormData({ ...formData, category_id: value === "none" ? "" : value });
                      }}
                    >
                      <SelectTrigger id="subcategory_id">
                        <SelectValue placeholder="Sélectionner une sous-catégorie" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="none">Aucune sous-catégorie</SelectItem>
                        {categories
                          .filter((cat) => cat.parent_id === parentCategoryId)
                          .map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.nom}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-base font-semibold">Calcul de prix (remplir 2 sur 3)</Label>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prix_reference">Prix d'achat HT (€)</Label>
                <Input
                  id="prix_reference"
                  type="number"
                  step="0.01"
                  value={formData.prix_reference}
                  onChange={(e) => handlePricingChange("prix_reference", e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Prix d'achat HT"
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
                  onKeyDown={(e) => e.stopPropagation()}
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
                  onKeyDown={(e) => e.stopPropagation()}
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
                      ? (parseFloat(formData.prix_vente_ttc) / 1.2 - parseFloat(formData.prix_reference)).toFixed(2)
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

          <div className="grid grid-cols-4 gap-4">
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
                  <SelectItem value="stockage">Stockage</SelectItem>
                  <SelectItem value="convertisseur">Convertisseur</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="puissance">Puissance (W) - 12V</Label>
              <Input
                id="puissance"
                type="number"
                step="0.1"
                value={formData.puissance_watts}
                onChange={(e) => handleElectricalChange("puissance_watts", e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Ex: 400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="intensite">Intensité (A) - 12V</Label>
              <Input
                id="intensite"
                type="number"
                step="0.1"
                value={formData.intensite_amperes}
                onChange={(e) => handleElectricalChange("intensite_amperes", e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Ex: 33.3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="poids">Poids (kg)</Label>
              <Input
                id="poids"
                type="number"
                step="0.01"
                value={formData.poids_kg}
                onChange={(e) => setFormData({ ...formData, poids_kg: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Ex: 12.5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dimensions (mm)</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="longueur" className="text-xs text-muted-foreground">
                  Longueur
                </Label>
                <Input
                  id="longueur"
                  type="number"
                  value={formData.longueur_mm}
                  onChange={(e) => setFormData({ ...formData, longueur_mm: e.target.value })}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="largeur" className="text-xs text-muted-foreground">
                  Largeur
                </Label>
                <Input
                  id="largeur"
                  type="number"
                  value={formData.largeur_mm}
                  onChange={(e) => setFormData({ ...formData, largeur_mm: e.target.value })}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hauteur" className="text-xs text-muted-foreground">
                  Hauteur
                </Label>
                <Input
                  id="hauteur"
                  type="number"
                  value={formData.hauteur_mm}
                  onChange={(e) => setFormData({ ...formData, hauteur_mm: e.target.value })}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="couleur">Couleur disponible</Label>
            <Select
              value={formData.couleur || "none"}
              onValueChange={(value) => setFormData({ ...formData, couleur: value === "none" ? "" : value })}
            >
              <SelectTrigger id="couleur">
                <SelectValue placeholder="Sélectionner une couleur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                <SelectItem value="noir">Noir</SelectItem>
                <SelectItem value="blanc">Blanc</SelectItem>
                <SelectItem value="gris">Gris</SelectItem>
                <SelectItem value="rouge">Rouge</SelectItem>
                <SelectItem value="bleu">Bleu</SelectItem>
                <SelectItem value="vert">Vert</SelectItem>
                <SelectItem value="jaune">Jaune</SelectItem>
                <SelectItem value="orange">Orange</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Si une couleur est définie, elle sera proposée lors de la configuration du kit
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Options payantes</Label>
              <Button type="button" onClick={handleAddOption} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Ajouter une option
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ajoutez des options supplémentaires que les clients pourront sélectionner pour ce produit
            </p>
            {loadingOptions ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : options.length > 0 ? (
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`option-nom-${index}`} className="text-xs">
                        Nom de l'option
                      </Label>
                      <Input
                        id={`option-nom-${index}`}
                        value={option.nom}
                        onChange={(e) => handleOptionChange(index, "nom", e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder="Ex: Câble de 5m supplémentaire"
                      />
                    </div>
                    <div className="w-32 space-y-1">
                      <Label htmlFor={`option-prix-${index}`} className="text-xs">
                        Prix (€)
                      </Label>
                      <Input
                        id={`option-prix-${index}`}
                        type="number"
                        step="0.01"
                        value={option.prix}
                        onChange={(e) => handleOptionChange(index, "prix", e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder="0.00"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune option ajoutée</p>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fournisseur">Fournisseur</Label>
              <Input
                id="fournisseur"
                type="text"
                value={formData.fournisseur}
                onChange={(e) => setFormData({ ...formData, fournisseur: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Nom du fournisseur"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url_produit">URL du produit</Label>
              <Input
                id="url_produit"
                type="url"
                value={formData.url_produit}
                onChange={(e) => setFormData({ ...formData, url_produit: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
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
              onKeyDown={(e) => e.stopPropagation()}
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
