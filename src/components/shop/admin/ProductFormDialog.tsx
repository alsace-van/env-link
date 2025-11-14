import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccessorySelector } from "./AccessorySelector";

interface ProductFormDialogProps {
  productId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProductFormDialog = ({ productId, isOpen, onClose, onSuccess }: ProductFormDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    nom: "",
    description: "",
    product_type: "simple",
    category_id: "",
    prix_base: 0,
    image_url: "",
    is_active: true,
    stock_quantity: 0,
  });
  const [selectedAccessories, setSelectedAccessories] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      if (productId) {
        loadProduct();
      }
    }
  }, [isOpen, productId]);

  const loadCategories = async () => {
    const { data } = await supabase
      .from("shop_categories" as any)
      .select("*")
      .order("nom");
    if (data) setCategories(data);
  };

  const loadProduct = async () => {
    if (!productId) return;

    const { data: product } = await supabase
      .from("shop_products" as any)
      .select("*")
      .eq("id", productId)
      .single();

    if (product) {
      setFormData(product as any);

      const { data: items } = await supabase
        .from("shop_product_items" as any)
        .select("*, accessory:accessories_catalog(*)")
        .eq("shop_product_id", productId);

      if (items) {
        setSelectedAccessories(items);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (productId) {
        await supabase
          .from("shop_products" as any)
          .update(formData)
          .eq("id", productId);

        await supabase
          .from("shop_product_items" as any)
          .delete()
          .eq("shop_product_id", productId);
      } else {
        const { data: newProduct } = await supabase
          .from("shop_products" as any)
          .insert(formData)
          .select()
          .single();

        if (newProduct && selectedAccessories.length > 0) {
          const items = selectedAccessories.map(acc => ({
            shop_product_id: (newProduct as any).id,
            accessory_id: acc.accessory_id || acc.id,
            default_quantity: acc.default_quantity || 1,
            is_required: acc.is_required !== false,
          }));

          await supabase
            .from("shop_product_items" as any)
            .insert(items);
        }
      }

      toast.success(productId ? "Produit modifié" : "Produit créé");
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {productId ? "Modifier le produit" : "Nouveau produit"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto flex-1 px-1 py-1">
          <Tabs defaultValue="general">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="accessories">Accessoires</TabsTrigger>
              <TabsTrigger value="pricing">Tarification</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <div>
                <Label>Nom du produit</Label>
                <Input
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type de produit</Label>
                  <Select
                    value={formData.product_type}
                    onValueChange={(value) => setFormData({ ...formData, product_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Produit simple</SelectItem>
                      <SelectItem value="bundle">Bundle</SelectItem>
                      <SelectItem value="custom_kit">Kit sur-mesure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Catégorie</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prix de base (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.prix_base}
                    onChange={(e) => setFormData({ ...formData, prix_base: parseFloat(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <Label>Stock</Label>
                  <Input
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label>URL de l'image</Label>
                <Input
                  value={formData.image_url || ""}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Produit actif</Label>
              </div>
            </TabsContent>

            <TabsContent value="accessories">
              <AccessorySelector
                selectedAccessories={selectedAccessories}
                onChange={setSelectedAccessories}
                productType={formData.product_type}
              />
            </TabsContent>

            <TabsContent value="pricing">
              <div className="text-center py-8 text-muted-foreground">
                Configuration des prix dégressifs et promotions à venir
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
