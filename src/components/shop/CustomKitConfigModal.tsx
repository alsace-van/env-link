import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ShoppingCart, X, Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCartContext } from "@/contexts/CartContext";
import { toast } from "sonner";
import { useAccessoryTieredPricing } from "@/hooks/useAccessoryTieredPricing";

interface CustomKitConfigModalProps {
  productId: string | null;
  onClose: () => void;
}

interface AccessoryWithCategory {
  id: string;
  nom: string;
  marque: string;
  prix_vente_ttc: number;
  description: string;
  image_url: string;
  couleur: string;
  promo_active: boolean;
  promo_price: number;
  category: {
    id: string;
    nom: string;
  };
  options: Array<{
    id: string;
    nom: string;
    prix_vente_ttc: number;
  }>;
}

interface CategoryGroup {
  name: string;
  items: AccessoryWithCategory[];
}

interface SelectedAccessory {
  accessoryId: string;
  quantity: number;
  selectedOptions: string[];
  selectedColor?: string;
}

export const CustomKitConfigModal = ({ productId, onClose }: CustomKitConfigModalProps) => {
  const { addToCart } = useCartContext();
  const [product, setProduct] = useState<any>(null);
  const [accessoriesByCategory, setAccessoriesByCategory] = useState<{ [key: string]: CategoryGroup }>({});
  const [selectedAccessories, setSelectedAccessories] = useState<{ [key: string]: SelectedAccessory }>({});
  const [loading, setLoading] = useState(true);
  const [totalPrice, setTotalPrice] = useState(0);

  useEffect(() => {
    if (productId) {
      loadProductAndAccessories();
    }
  }, [productId]);

  useEffect(() => {
    calculateTotalPrice();
  }, [selectedAccessories, accessoriesByCategory]);

  const loadProductAndAccessories = async () => {
    if (!productId) return;
    
    setLoading(true);

    // Charger le produit
    const { data: productData } = await supabase
      .from("shop_products")
      .select("*")
      .eq("id", productId)
      .single();

    if (productData) {
      setProduct(productData);

      // Charger les accessoires du kit avec leurs catégories
      const { data: kitAccessories } = await supabase
        .from("shop_custom_kit_accessories")
        .select("accessory_id, default_quantity")
        .eq("custom_kit_id", productId);

      if (kitAccessories && kitAccessories.length > 0) {
        const accessoryIds = kitAccessories.map(ka => ka.accessory_id);

        // Charger tous les accessoires avec leurs catégories et options
        const { data: accessories } = await supabase
          .from("accessories_catalog")
          .select(`
            id,
            nom,
            marque,
            prix_vente_ttc,
            description,
            image_url,
            couleur,
            promo_active,
            promo_price,
            category:categories(id, nom)
          `)
          .in("id", accessoryIds)
          .eq("available_in_shop", true);

        if (accessories) {
          // Charger les options pour chaque accessoire
          const accessoriesWithOptions = await Promise.all(
            accessories.map(async (acc: any) => {
              const { data: options } = await supabase
                .from("accessory_options")
                .select("id, nom, prix_vente_ttc")
                .eq("accessory_id", acc.id);

              return {
                ...acc,
                options: options || []
              };
            })
          );

          // Grouper par catégorie
          const grouped = accessoriesWithOptions.reduce((acc: any, item: any) => {
            const categoryId = item.category?.id || "uncategorized";
            const categoryName = item.category?.nom || "Sans catégorie";
            
            if (!acc[categoryId]) {
              acc[categoryId] = {
                name: categoryName,
                items: []
              };
            }
            
            acc[categoryId].items.push(item);
            return acc;
          }, {});

          setAccessoriesByCategory(grouped);

          // Initialiser les quantités par défaut
          const defaultSelections: { [key: string]: SelectedAccessory } = {};
          kitAccessories.forEach(ka => {
            if (ka.default_quantity > 0) {
              defaultSelections[ka.accessory_id] = {
                accessoryId: ka.accessory_id,
                quantity: ka.default_quantity,
                selectedOptions: []
              };
            }
          });
          setSelectedAccessories(defaultSelections);
        }
      }
    }

    setLoading(false);
  };

  const calculateTotalPrice = () => {
    let total = 0;

    Object.values(selectedAccessories).forEach(selected => {
      const accessory = findAccessoryById(selected.accessoryId);
      if (accessory && selected.quantity > 0) {
        const basePrice = accessory.promo_active && accessory.promo_price 
          ? accessory.promo_price 
          : accessory.prix_vente_ttc;
        
        total += basePrice * selected.quantity;

        // Ajouter le prix des options sélectionnées
        selected.selectedOptions.forEach(optionId => {
          const option = accessory.options.find(o => o.id === optionId);
          if (option) {
            total += option.prix_vente_ttc * selected.quantity;
          }
        });
      }
    });

    setTotalPrice(total);
  };

  const findAccessoryById = (id: string): AccessoryWithCategory | undefined => {
    for (const category of Object.values(accessoriesByCategory)) {
      const found = category.items.find((item) => item.id === id);
      if (found) return found;
    }
    return undefined;
  };

  const updateQuantity = (accessoryId: string, delta: number) => {
    setSelectedAccessories(prev => {
      const current = prev[accessoryId] || { accessoryId, quantity: 0, selectedOptions: [] };
      const newQuantity = Math.max(0, current.quantity + delta);

      if (newQuantity === 0) {
        const { [accessoryId]: _, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [accessoryId]: { ...current, quantity: newQuantity }
      };
    });
  };

  const toggleOption = (accessoryId: string, optionId: string) => {
    setSelectedAccessories(prev => {
      const current = prev[accessoryId] || { accessoryId, quantity: 0, selectedOptions: [] };
      const hasOption = current.selectedOptions.includes(optionId);

      return {
        ...prev,
        [accessoryId]: {
          ...current,
          selectedOptions: hasOption
            ? current.selectedOptions.filter(id => id !== optionId)
            : [...current.selectedOptions, optionId]
        }
      };
    });
  };

  const selectColor = (accessoryId: string, color: string) => {
    setSelectedAccessories(prev => {
      const current = prev[accessoryId] || { accessoryId, quantity: 0, selectedOptions: [] };
      return {
        ...prev,
        [accessoryId]: { ...current, selectedColor: color }
      };
    });
  };

  const handleAddToCart = () => {
    if (!product || Object.keys(selectedAccessories).length === 0) {
      toast.error("Veuillez sélectionner au moins un article");
      return;
    }

    const configuration = {
      customKit: true,
      accessories: selectedAccessories
    };

    addToCart(product.id, totalPrice, 1, configuration);
    toast.success("Kit ajouté au panier");
    onClose();
  };

  if (!productId) return null;

  return (
    <Dialog open={!!productId} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        {loading ? (
          <div className="text-center py-12">Chargement...</div>
        ) : product ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Configurez votre {product.nom}</span>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh] pr-4">
              <Accordion type="multiple" className="w-full">
                {Object.entries(accessoriesByCategory).map(([categoryId, category]: [string, any]) => (
                  <AccordionItem key={categoryId} value={categoryId}>
                    <AccordionTrigger className="text-lg font-semibold">
                      {category.name}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {category.items.map((accessory: AccessoryWithCategory) => {
                          const selected = selectedAccessories[accessory.id];
                          const quantity = selected?.quantity || 0;
                          const basePrice = accessory.promo_active && accessory.promo_price 
                            ? accessory.promo_price 
                            : accessory.prix_vente_ttc;

                          return (
                            <div key={accessory.id} className="border rounded-lg p-4 space-y-3">
                              <div className="flex items-start gap-4">
                                {accessory.image_url && (
                                  <img
                                    src={accessory.image_url}
                                    alt={accessory.nom}
                                    className="w-20 h-20 object-cover rounded"
                                  />
                                )}
                                <div className="flex-1">
                                  <h4 className="font-semibold">{accessory.nom}</h4>
                                  {accessory.marque && (
                                    <p className="text-sm text-muted-foreground">{accessory.marque}</p>
                                  )}
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {accessory.description}
                                  </p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="font-semibold text-primary">
                                      {basePrice.toFixed(2)} €
                                    </span>
                                    {accessory.promo_active && accessory.promo_price && (
                                      <span className="text-sm text-muted-foreground line-through">
                                        {accessory.prix_vente_ttc.toFixed(2)} €
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => updateQuantity(accessory.id, -1)}
                                    disabled={quantity === 0}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <Input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => {
                                      const newQty = parseInt(e.target.value) || 0;
                                      const delta = newQty - quantity;
                                      updateQuantity(accessory.id, delta);
                                    }}
                                    className="w-16 text-center"
                                    min="0"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => updateQuantity(accessory.id, 1)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              {/* Options */}
                              {accessory.options && accessory.options.length > 0 && quantity > 0 && (
                                <div className="space-y-2 pl-4 border-l-2">
                                  <Label className="text-sm font-semibold">Options disponibles:</Label>
                                  {accessory.options.map((option: any) => (
                                    <div key={option.id} className="flex items-center gap-2">
                                      <Checkbox
                                        id={`option-${option.id}`}
                                        checked={selected?.selectedOptions.includes(option.id) || false}
                                        onCheckedChange={() => toggleOption(accessory.id, option.id)}
                                      />
                                      <Label htmlFor={`option-${option.id}`} className="text-sm cursor-pointer">
                                        {option.nom} (+{option.prix_vente_ttc.toFixed(2)} €)
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Couleurs */}
                              {accessory.couleur && quantity > 0 && (
                                <div className="space-y-2 pl-4 border-l-2">
                                  <Label className="text-sm font-semibold">Couleur:</Label>
                                  <RadioGroup
                                    value={selected?.selectedColor}
                                    onValueChange={(value) => selectColor(accessory.id, value)}
                                  >
                                    {accessory.couleur.split(',').map((color: string) => (
                                      <div key={color.trim()} className="flex items-center space-x-2">
                                        <RadioGroupItem value={color.trim()} id={`color-${accessory.id}-${color.trim()}`} />
                                        <Label htmlFor={`color-${accessory.id}-${color.trim()}`} className="text-sm cursor-pointer capitalize">
                                          {color.trim()}
                                        </Label>
                                      </div>
                                    ))}
                                  </RadioGroup>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>

            <Separator />

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm text-muted-foreground">Prix total</p>
                <p className="text-2xl font-bold text-primary">{totalPrice.toFixed(2)} €</p>
              </div>
              <Button onClick={handleAddToCart} size="lg" className="gap-2">
                <ShoppingCart className="h-5 w-5" />
                Ajouter au panier
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-12">Produit non trouvé</div>
        )}
      </DialogContent>
    </Dialog>
  );
};
