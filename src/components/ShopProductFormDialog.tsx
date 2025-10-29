import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, X, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Accessory {
  id: string;
  nom: string;
  marque?: string;
  prix_reference?: number;
  category_id?: string;
}

interface ProductFormDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  editProduct?: any;
}

export const ShopProductFormDialog = ({
  trigger,
  onSuccess,
  editProduct,
}: ProductFormDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productType, setProductType] = useState<"simple" | "composed" | "custom_kit">("simple");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);
  
  // Pour produits simples et composés
  const [selectedAccessories, setSelectedAccessories] = useState<Array<{ id: string; quantity: number }>>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  
  // Pour kits sur-mesure
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categories, setCategories] = useState<{ id: string; nom: string }[]>([]);

  useEffect(() => {
    if (open) {
      loadAccessories();
      loadCategories();
      if (editProduct) {
        populateForm();
      } else {
        resetForm();
      }
    }
  }, [open, editProduct]);

  const loadAccessories = async () => {
    const { data, error } = await supabase
      .from("accessories_catalog")
      .select("id, nom, marque, prix_reference, category_id, categories(nom)")
      .eq("available_in_shop", true)
      .order("nom");

    if (error) {
      console.error("Erreur lors du chargement des accessoires:", error);
      return;
    }

    setAccessories(data || []);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, nom")
      .order("nom");

    if (error) {
      console.error("Erreur lors du chargement des catégories:", error);
      return;
    }

    setCategories(data || []);
  };

  const populateForm = async () => {
    if (!editProduct) return;

    setName(editProduct.name);
    setDescription(editProduct.description || "");
    setPrice(editProduct.price?.toString() || "");
    setIsActive(editProduct.is_active);
    setProductType(editProduct.type);

    // Charger les accessoires ou catégories selon le type
    if (editProduct.type === "custom_kit") {
      const { data, error } = await supabase
        .from("shop_custom_kits")
        .select("allowed_category_ids")
        .eq("product_id", editProduct.id)
        .single();

      if (!error && data) {
        setSelectedCategories(data.allowed_category_ids || []);
      }
    } else {
      const { data, error } = await supabase
        .from("shop_product_items")
        .select("accessory_id, quantity")
        .eq("product_id", editProduct.id);

      if (!error && data) {
        setSelectedAccessories(data.map(item => ({
          id: item.accessory_id,
          quantity: item.quantity
        })));
      }
    }
  };

  const handleAddAccessory = (accessoryId: string) => {
    if (!selectedAccessories.find(a => a.id === accessoryId)) {
      setSelectedAccessories([...selectedAccessories, { id: accessoryId, quantity: 1 }]);
    }
  };

  const handleRemoveAccessory = (accessoryId: string) => {
    setSelectedAccessories(selectedAccessories.filter(a => a.id !== accessoryId));
  };

  const handleQuantityChange = (accessoryId: string, quantity: number) => {
    setSelectedAccessories(
      selectedAccessories.map(a =>
        a.id === accessoryId ? { ...a, quantity: Math.max(1, quantity) } : a
      )
    );
  };

  const handleSubmit = async () => {
    // Pour les produits simples, utiliser le nom de l'accessoire
    let productName = name;
    if (productType === "simple" && selectedAccessories.length === 1) {
      const selectedAcc = accessories.find(a => a.id === selectedAccessories[0].id);
      if (selectedAcc) {
        productName = selectedAcc.nom;
      }
    }

    // Validation du nom du produit
    if (productType === "simple") {
      // Pour un produit simple, vérifier qu'un accessoire est sélectionné
      if (selectedAccessories.length !== 1) {
        toast.error("Un produit simple doit contenir exactement un accessoire");
        return;
      }
      // Vérifier que le nom peut être récupéré
      const selectedAcc = accessories.find(a => a.id === selectedAccessories[0].id);
      if (!selectedAcc) {
        toast.error("Erreur lors de la récupération de l'accessoire");
        return;
      }
    } else {
      // Pour les autres types, le nom est obligatoire
      if (!productName) {
        toast.error("Veuillez remplir tous les champs obligatoires");
        return;
      }
    }

    if (productType !== "custom_kit" && !price) {
      toast.error("Veuillez indiquer un prix");
      return;
    }


    if (productType === "composed" && selectedAccessories.length === 0) {
      toast.error("Un produit composé doit contenir au moins un accessoire");
      return;
    }

    if (productType === "custom_kit" && selectedCategories.length === 0) {
      toast.error("Un kit sur-mesure doit proposer au moins une catégorie");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      if (editProduct) {
        // Mode édition
        const { error: productError } = await supabase
          .from("shop_products")
          .update({
            name: productName,
            description,
            price: productType === "custom_kit" ? 0 : parseFloat(price),
            is_active: isActive,
          })
          .eq("id", editProduct.id);

        if (productError) throw productError;

        // Supprimer les anciens items/kit
        if (productType === "simple" || productType === "composed") {
          await supabase.from("shop_product_items").delete().eq("product_id", editProduct.id);
          
          const items = selectedAccessories.map(acc => ({
            product_id: editProduct.id,
            accessory_id: acc.id,
            quantity: acc.quantity,
          }));

          const { error: itemsError } = await supabase
            .from("shop_product_items")
            .insert(items);

          if (itemsError) throw itemsError;
        } else if (productType === "custom_kit") {
          const { error: kitError } = await supabase
            .from("shop_custom_kits")
            .update({ allowed_category_ids: selectedCategories })
            .eq("product_id", editProduct.id);

          if (kitError) throw kitError;
        }

        toast.success("Produit modifié avec succès");
      } else {
        // Mode création
        const { data: product, error: productError } = await supabase
          .from("shop_products")
          .insert({
            user_id: user.id,
            name: productName,
            description,
            type: productType,
            price: productType === "custom_kit" ? 0 : parseFloat(price),
            is_active: isActive,
          })
          .select()
          .single();

        if (productError) throw productError;

        // Ajouter les items selon le type
        if (productType === "simple" || productType === "composed") {
          const items = selectedAccessories.map(acc => ({
            product_id: product.id,
            accessory_id: acc.id,
            quantity: acc.quantity,
          }));

          const { error: itemsError } = await supabase
            .from("shop_product_items")
            .insert(items);

          if (itemsError) throw itemsError;
        } else if (productType === "custom_kit") {
          // Créer le kit sur-mesure avec les catégories
          const { error: kitError } = await supabase
            .from("shop_custom_kits")
            .insert({
              product_id: product.id,
              allowed_category_ids: selectedCategories,
            });

          if (kitError) throw kitError;
        }

        toast.success("Produit créé avec succès");
      }
      
      handleClose();
      onSuccess?.();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error(`Erreur lors de ${editProduct ? 'la modification' : 'la création'} du produit`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setIsActive(true);
    setProductType("simple");
    setSelectedAccessories([]);
    setSelectedCategories([]);
    setSelectedCategoryFilter("all");
    setSearchValue("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau produit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editProduct ? "Modifier le produit" : "Créer un produit"}</DialogTitle>
          <DialogDescription>
            {editProduct ? "Modifiez les informations du produit" : "Ajoutez un nouveau produit à votre boutique"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="type">Type de produit</Label>
            <Select value={productType} onValueChange={(value: any) => setProductType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Produit simple</SelectItem>
                <SelectItem value="composed">Produit composé</SelectItem>
                <SelectItem value="custom_kit">Kit sur-mesure</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {productType === "simple" && "Un seul accessoire"}
              {productType === "composed" && "Plusieurs accessoires pré-sélectionnés"}
              {productType === "custom_kit" && "L'utilisateur compose son kit"}
            </p>
          </div>

          {(productType === "simple" || productType === "composed") && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="category-filter">Catégorie</Label>
                <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                  <SelectTrigger id="category-filter">
                    <SelectValue placeholder="Toutes les catégories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>
                  {productType === "simple" ? "Sélectionner l'accessoire" : "Accessoires du produit"}
                </Label>
                
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className="w-full justify-between"
                    >
                      <span className="text-muted-foreground">Rechercher un accessoire...</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Rechercher un accessoire..." 
                        value={searchValue}
                        onValueChange={setSearchValue}
                      />
                      <CommandList>
                        <CommandEmpty>Aucun accessoire trouvé.</CommandEmpty>
                        <CommandGroup>
                          {accessories
                            .filter(acc => !selectedAccessories.find(s => s.id === acc.id))
                            .filter(acc => selectedCategoryFilter === "all" || acc.category_id === selectedCategoryFilter)
                            .map((acc) => (
                              <CommandItem
                                key={acc.id}
                                value={`${acc.nom} ${acc.marque || ""}`}
                                onSelect={() => {
                                  handleAddAccessory(acc.id);
                                  setComboboxOpen(false);
                                  setSearchValue("");
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{acc.nom}</span>
                                  {acc.marque && <span className="text-xs text-muted-foreground">{acc.marque}</span>}
                                </div>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <div className="mt-3 space-y-2">
                  {selectedAccessories.map((selected) => {
                    const acc = accessories.find(a => a.id === selected.id);
                    if (!acc) return null;

                    return (
                      <Card key={selected.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{acc.nom}</p>
                              {acc.marque && <p className="text-xs text-muted-foreground">{acc.marque}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="1"
                                value={selected.quantity}
                                onChange={(e) => handleQuantityChange(selected.id, parseInt(e.target.value) || 1)}
                                className="w-20"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveAccessory(selected.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {productType !== "simple" && (
            <div>
              <Label htmlFor="name">Nom du produit *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Kit électrique complet"
              />
            </div>
          )}

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du produit..."
              rows={3}
            />
          </div>

          {productType !== "custom_kit" && (
            <div>
              <Label htmlFor="price">Prix TTC (€) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}

          {productType === "custom_kit" && (
            <div>
              <Label>Catégories d'accessoires disponibles dans le kit *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Le client pourra composer son kit en choisissant des accessoires parmi ces catégories. 
                Le prix sera calculé automatiquement.
              </p>
              <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedCategories.includes(cat.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCategories([...selectedCategories, cat.id]);
                        } else {
                          setSelectedCategories(selectedCategories.filter(id => id !== cat.id));
                        }
                      }}
                    />
                    <span className="text-sm">{cat.nom}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked as boolean)}
            />
            <label
              htmlFor="isActive"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Produit actif (visible dans la boutique)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editProduct ? "Modifier le produit" : "Créer le produit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};