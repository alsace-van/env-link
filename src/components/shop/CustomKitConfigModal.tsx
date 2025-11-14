import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Plus, Minus, ShoppingCart, Package, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import { useAccessoryTieredPricing } from "@/hooks/useAccessoryTieredPricing";

interface Accessory {
  id: string;
  nom: string;
  prix_vente_ttc: number;
  marque?: string;
  couleur?: string;
  description?: string;
  image_url?: string;
  category_id?: string;
}

interface AccessoryOption {
  id: string;
  nom: string;
  prix_vente_ttc: number;
}

interface CategoryConfig {
  id: string;
  category_id: string;
  category_name: string;
  selected_accessory_id?: string;
  quantity: number;
  selected_color?: string;
  selected_options: string[];
}

interface CustomKitConfigModalProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  basePrice: number;
}

export const CustomKitConfigModal = ({
  open,
  onClose,
  productId,
  productName,
  basePrice,
}: CustomKitConfigModalProps) => {
  const { addToCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<{ id: string; nom: string }[]>([]);
  const [categoryConfigs, setCategoryConfigs] = useState<CategoryConfig[]>([]);
  const [accessories, setAccessories] = useState<Record<string, Accessory[]>>({});
  const [accessoryOptions, setAccessoryOptions] = useState<Record<string, AccessoryOption[]>>({});

  useEffect(() => {
    if (open) {
      loadKitConfiguration();
    }
  }, [open, productId]);

  const loadKitConfiguration = async () => {
    setLoading(true);

    try {
      // Load product items with categories
      const { data: productItems } = await supabase
        .from("shop_product_items" as any)
        .select(`
          *,
          accessory:accessories_catalog(category_id, categories(nom))
        `)
        .eq("shop_product_id", productId);

      if (productItems && productItems.length > 0) {
        // Extract unique categories
        const uniqueCategories = new Map();
        productItems.forEach((item: any) => {
          const catId = item.accessory?.category_id;
          const catName = item.accessory?.categories?.nom;
          if (catId && catName && !uniqueCategories.has(catId)) {
            uniqueCategories.set(catId, { id: catId, nom: catName });
          }
        });

        const cats = Array.from(uniqueCategories.values());
        setCategories(cats);

        // Initialize category configs
        const configs = cats.map((cat, index) => ({
          id: `cat-${index}`,
          category_id: cat.id,
          category_name: cat.nom,
          quantity: 1,
          selected_options: [],
        }));
        setCategoryConfigs(configs);

        // Load accessories for each category
        const accessoriesMap: Record<string, Accessory[]> = {};
        for (const cat of cats) {
          const { data: catAccessories } = await supabase
            .from("accessories_catalog" as any)
            .select("id, nom, prix_vente_ttc, marque, couleur, description, image_url, category_id")
            .eq("category_id", cat.id)
            .eq("available_in_shop", true);

          if (catAccessories) {
            accessoriesMap[cat.id] = catAccessories as any;
          }
        }
        setAccessories(accessoriesMap);
      }
    } catch (error) {
      console.error("Error loading kit configuration:", error);
      toast.error("Erreur lors du chargement de la configuration");
    } finally {
      setLoading(false);
    }
  };

  const loadAccessoryOptions = async (accessoryId: string) => {
    const { data } = await supabase
      .from("accessory_options" as any)
      .select("id, nom, prix_vente_ttc")
      .eq("accessory_id", accessoryId);

    if (data) {
      setAccessoryOptions((prev) => ({
        ...prev,
        [accessoryId]: data as any,
      }));
    }
  };

  const updateCategoryConfig = (id: string, updates: Partial<CategoryConfig>) => {
    setCategoryConfigs((prev) =>
      prev.map((config) => (config.id === id ? { ...config, ...updates } : config))
    );
  };

  const duplicateCategory = (config: CategoryConfig) => {
    const newConfig: CategoryConfig = {
      ...config,
      id: `cat-${Date.now()}`,
      selected_options: [],
    };
    setCategoryConfigs((prev) => [...prev, newConfig]);
  };

  const removeCategory = (id: string) => {
    if (categoryConfigs.length <= 1) {
      toast.error("Vous devez garder au moins une catégorie");
      return;
    }
    setCategoryConfigs((prev) => prev.filter((c) => c.id !== id));
  };

  const calculateTotal = () => {
    let total = basePrice;

    categoryConfigs.forEach((config) => {
      if (!config.selected_accessory_id) return;

      const accessory = accessories[config.category_id]?.find(
        (a) => a.id === config.selected_accessory_id
      );
      if (accessory) {
        total += accessory.prix_vente_ttc * config.quantity;
      }

      // Add options price
      const options = accessoryOptions[config.selected_accessory_id] || [];
      config.selected_options.forEach((optionId) => {
        const option = options.find((o) => o.id === optionId);
        if (option) {
          total += option.prix_vente_ttc * config.quantity;
        }
      });
    });

    return total;
  };

  const handleAddToCart = () => {
    const configuration = {
      categories: categoryConfigs.map((config) => ({
        category_name: config.category_name,
        accessory_id: config.selected_accessory_id,
        accessory_name: accessories[config.category_id]?.find(
          (a) => a.id === config.selected_accessory_id
        )?.nom,
        quantity: config.quantity,
        color: config.selected_color,
        options: config.selected_options,
      })),
    };

    const totalPrice = calculateTotal();
    addToCart(productId, 1, configuration, totalPrice);
    onClose();
  };

  const isConfigValid = categoryConfigs.every((c) => c.selected_accessory_id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {productName}
          </DialogTitle>
          <DialogDescription>
            Configurez votre kit en choisissant des accessoires. Vous pouvez dupliquer une
            catégorie pour ajouter plusieurs articles différents.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6">
          {/* Configuration */}
          <div className="col-span-2">
            <ScrollArea className="h-[500px] pr-4">
              {loading ? (
                <div className="text-center py-12">Chargement...</div>
              ) : (
                <Accordion type="multiple" className="space-y-2">
                  {categoryConfigs.map((config, index) => {
                    const categoryAccessories = accessories[config.category_id] || [];
                    const selectedAccessory = categoryAccessories.find(
                      (a) => a.id === config.selected_accessory_id
                    );
                    const options = config.selected_accessory_id
                      ? accessoryOptions[config.selected_accessory_id] || []
                      : [];

                    return (
                      <AccordionItem key={config.id} value={config.id} className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-2">
                              <Badge>{config.category_name}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {categoryConfigs.filter((c) => c.category_id === config.category_id).length} accessoire(s)
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateCategory(config);
                                }}
                                title="Dupliquer"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              {categoryConfigs.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeCategory(config.id);
                                  }}
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent className="space-y-4 pt-4">
                          {/* Accessory selection */}
                          <div className="space-y-2">
                            <Label>Accessoire *</Label>
                            <Select
                              value={config.selected_accessory_id}
                              onValueChange={(value) => {
                                updateCategoryConfig(config.id, { selected_accessory_id: value });
                                loadAccessoryOptions(value);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choisir un accessoire..." />
                              </SelectTrigger>
                              <SelectContent>
                                {categoryAccessories.map((acc) => (
                                  <SelectItem key={acc.id} value={acc.id}>
                                    <div className="flex items-center justify-between w-full">
                                      <span>{acc.nom}</span>
                                      <span className="text-muted-foreground ml-4">
                                        {acc.prix_vente_ttc?.toFixed(2)} €
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {selectedAccessory && (
                            <>
                              {/* Quantity */}
                              <div className="space-y-2">
                                <Label>Quantité</Label>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() =>
                                      updateCategoryConfig(config.id, {
                                        quantity: Math.max(1, config.quantity - 1),
                                      })
                                    }
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={config.quantity}
                                    onChange={(e) =>
                                      updateCategoryConfig(config.id, {
                                        quantity: parseInt(e.target.value) || 1,
                                      })
                                    }
                                    className="w-20 text-center"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() =>
                                      updateCategoryConfig(config.id, {
                                        quantity: config.quantity + 1,
                                      })
                                    }
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              {/* Color */}
                              {selectedAccessory.couleur && (
                                <div className="space-y-2">
                                  <Label>Couleur</Label>
                                  <Select
                                    value={config.selected_color}
                                    onValueChange={(value) =>
                                      updateCategoryConfig(config.id, { selected_color: value })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Choisir une couleur..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {selectedAccessory.couleur.split(",").map((color) => (
                                        <SelectItem key={color.trim()} value={color.trim()}>
                                          {color.trim()}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* Options */}
                              {options.length > 0 && (
                                <div className="space-y-2">
                                  <Label>Options</Label>
                                  <div className="space-y-2">
                                    {options.map((option) => (
                                      <div key={option.id} className="flex items-center justify-between p-2 border rounded">
                                        <div className="flex items-center gap-2">
                                          <Checkbox
                                            checked={config.selected_options.includes(option.id)}
                                            onCheckedChange={(checked) => {
                                              const newOptions = checked
                                                ? [...config.selected_options, option.id]
                                                : config.selected_options.filter((id) => id !== option.id);
                                              updateCategoryConfig(config.id, {
                                                selected_options: newOptions,
                                              });
                                            }}
                                          />
                                          <span className="text-sm">{option.nom}</span>
                                        </div>
                                        <span className="text-sm font-medium">
                                          +{option.prix_vente_ttc.toFixed(2)} €
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Price for this item */}
                              <div className="flex items-center justify-between pt-2 border-t">
                                <span className="text-sm text-muted-foreground">Prix de cet article</span>
                                <span className="font-semibold">
                                  {(
                                    (selectedAccessory.prix_vente_ttc +
                                      config.selected_options.reduce((sum, optId) => {
                                        const opt = options.find((o) => o.id === optId);
                                        return sum + (opt?.prix_vente_ttc || 0);
                                      }, 0)) *
                                    config.quantity
                                  ).toFixed(2)}{" "}
                                  €
                                </span>
                              </div>
                            </>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </ScrollArea>
          </div>

          {/* Summary */}
          <div className="border-l pl-6">
            <div className="sticky top-0">
              <h3 className="font-semibold mb-4">Récapitulatif</h3>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prix de base du kit</span>
                  <span>{basePrice.toFixed(2)} €</span>
                </div>

                {categoryConfigs.map((config) => {
                  const accessory = accessories[config.category_id]?.find(
                    (a) => a.id === config.selected_accessory_id
                  );
                  if (!accessory) return null;

                  return (
                    <div key={config.id} className="text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {accessory.nom} x{config.quantity}
                        </span>
                        <span>{(accessory.prix_vente_ttc * config.quantity).toFixed(2)} €</span>
                      </div>
                      {config.selected_options.length > 0 && (
                        <div className="ml-4 text-xs text-muted-foreground">
                          {config.selected_options.map((optId) => {
                            const option = accessoryOptions[config.selected_accessory_id!]?.find(
                              (o) => o.id === optId
                            );
                            if (!option) return null;
                            return (
                              <div key={optId} className="flex justify-between">
                                <span>+ {option.nom}</span>
                                <span>{(option.prix_vente_ttc * config.quantity).toFixed(2)} €</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                <Separator />

                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{calculateTotal().toFixed(2)} €</span>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <Button
                  className="w-full gap-2"
                  size="lg"
                  disabled={!isConfigValid}
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="h-5 w-5" />
                  Ajouter au panier
                </Button>
                <Button variant="outline" className="w-full" onClick={onClose}>
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
