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
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Accessory {
  id: string;
  nom: string;
  marque?: string;
  prix_reference?: number;
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
  
  // Pour kits sur-mesure
  const [minItems, setMinItems] = useState("1");
  const [maxItems, setMaxItems] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [availableAccessories, setAvailableAccessories] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      loadAccessories();
      if (editProduct) {
        populateForm();
      }
    }
  }, [open, editProduct]);

  const loadAccessories = async () => {
    const { data, error } = await supabase
      .from("accessories_catalog")
      .select("id, nom, marque, prix_reference")
      .eq("available_in_shop", true)
      .order("nom");

    if (error) {
      console.error("Erreur lors du chargement des accessoires:", error);
      return;
    }

    setAccessories(data || []);
  };

  const populateForm = async () => {
    // TODO: Implémenter le chargement des données pour l'édition
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
    if (!name || !price) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (productType === "simple" && selectedAccessories.length !== 1) {
      toast.error("Un produit simple doit contenir exactement un accessoire");
      return;
    }

    if (productType === "composed" && selectedAccessories.length === 0) {
      toast.error("Un produit composé doit contenir au moins un accessoire");
      return;
    }

    if (productType === "custom_kit" && availableAccessories.length === 0) {
      toast.error("Un kit sur-mesure doit proposer au moins un accessoire");
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

      // Créer le produit
      const { data: product, error: productError } = await supabase
        .from("shop_products")
        .insert({
          user_id: user.id,
          name,
          description,
          type: productType,
          price: parseFloat(price),
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
        // Créer le kit sur-mesure
        const { data: kit, error: kitError } = await supabase
          .from("shop_custom_kits")
          .insert({
            product_id: product.id,
            min_items: parseInt(minItems),
            max_items: maxItems ? parseInt(maxItems) : null,
            base_price: parseFloat(basePrice || "0"),
          })
          .select()
          .single();

        if (kitError) throw kitError;

        // Ajouter les accessoires disponibles
        const kitItems = availableAccessories.map(accId => ({
          kit_id: kit.id,
          accessory_id: accId,
        }));

        const { error: kitItemsError } = await supabase
          .from("shop_custom_kit_available_items")
          .insert(kitItems);

        if (kitItemsError) throw kitItemsError;
      }

      toast.success("Produit créé avec succès");
      handleClose();
      onSuccess?.();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la création du produit");
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
    setAvailableAccessories([]);
    setMinItems("1");
    setMaxItems("");
    setBasePrice("");
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
          <DialogTitle>Créer un produit</DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau produit à votre boutique
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

          <div>
            <Label htmlFor="name">Nom du produit *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Kit électrique complet"
            />
          </div>

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

          {productType === "custom_kit" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minItems">Nombre min d'items *</Label>
                  <Input
                    id="minItems"
                    type="number"
                    value={minItems}
                    onChange={(e) => setMinItems(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="maxItems">Nombre max d'items</Label>
                  <Input
                    id="maxItems"
                    type="number"
                    value={maxItems}
                    onChange={(e) => setMaxItems(e.target.value)}
                    placeholder="Illimité"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="basePrice">Prix de base (€)</Label>
                <Input
                  id="basePrice"
                  type="number"
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Prix avant ajout d'accessoires
                </p>
              </div>

              <div>
                <Label>Accessoires disponibles dans le kit</Label>
                <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2">
                  {accessories.map((acc) => (
                    <div key={acc.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={availableAccessories.includes(acc.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setAvailableAccessories([...availableAccessories, acc.id]);
                          } else {
                            setAvailableAccessories(availableAccessories.filter(id => id !== acc.id));
                          }
                        }}
                      />
                      <span className="text-sm">{acc.nom}</span>
                      {acc.marque && <span className="text-xs text-muted-foreground">({acc.marque})</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {(productType === "simple" || productType === "composed") && (
            <div>
              <Label>
                {productType === "simple" ? "Sélectionner l'accessoire" : "Accessoires du produit"}
              </Label>
              
              <Select onValueChange={handleAddAccessory}>
                <SelectTrigger>
                  <SelectValue placeholder="Ajouter un accessoire" />
                </SelectTrigger>
                <SelectContent>
                  {accessories
                    .filter(acc => !selectedAccessories.find(s => s.id === acc.id))
                    .map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.nom} {acc.marque && `(${acc.marque})`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

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
              Créer le produit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
