import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Trash2, Plus, Minus, ShoppingBag, TrendingDown, Tag, X, CreditCard } from "lucide-react";
import { CartItem } from "@/hooks/useCart";
import { useTieredPricing } from "@/hooks/useTieredPricing";
import { supabase } from "@/integrations/supabase/client";

interface ShoppingCartSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartItems: CartItem[];
  totalPrice: number;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
}

export const ShoppingCartSidebar = ({
  open,
  onOpenChange,
  cartItems,
  totalPrice,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
}: ShoppingCartSidebarProps) => {
  const getProductTypeLabel = (type: string) => {
    switch (type) {
      case "simple":
        return "Simple";
      case "composed":
        return "Composé";
      case "custom_kit":
        return "Kit sur-mesure";
      default:
        return type;
    }
  };

  const CartItemComponent = ({ item }: { item: CartItem }) => {
    const tieredPricing = useTieredPricing(item.product_id);
    const applicableTier = tieredPricing.getApplicableTier(item.quantity);
    const nextTier = tieredPricing.getNextTier(item.quantity);
    const unitPrice = tieredPricing.calculatePrice(item.price_at_addition, item.quantity);

    const [accessoryTieredPricing, setAccessoryTieredPricing] = useState<Map<string, any[]>>(new Map());

    useEffect(() => {
      if (item.configuration?.items) {
        loadAccessoryTieredPricing();
      }
    }, [item.configuration]);

    const loadAccessoryTieredPricing = async () => {
      if (!item.configuration?.items) return;

      const accessoryIds = item.configuration.items.map((configItem: any) => configItem.accessoryId).filter(Boolean);

      if (accessoryIds.length === 0) return;

      const { data } = await supabase
        .from("accessory_tiered_pricing")
        .select("accessory_id, article_position, discount_percent")
        .in("accessory_id", accessoryIds);

      const tieredMap = new Map<string, any[]>();
      (data || []).forEach((tier) => {
        if (!tieredMap.has(tier.accessory_id)) {
          tieredMap.set(tier.accessory_id, []);
        }
        tieredMap.get(tier.accessory_id)!.push(tier);
      });

      setAccessoryTieredPricing(tieredMap);
    };

    const getAccessoryDiscountInfo = (accessoryId: string, quantity: number) => {
      const tiers = accessoryTieredPricing.get(accessoryId) || [];
      if (tiers.length === 0) return null;

      const applicableTier = [...tiers].reverse().find((tier) => quantity >= tier.article_position);

      return applicableTier;
    };

    return (
      <div className="flex gap-3 p-3 rounded-lg border bg-card">
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm leading-tight">{item.product?.name || "Produit"}</h4>
              <Badge variant="secondary" className="text-xs mt-1">
                {getProductTypeLabel(item.product?.type || "")}
              </Badge>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-destructive shrink-0" 
              onClick={() => onRemoveItem(item.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Options pour les produits simples */}
          {item.configuration?.selectedOptions && item.configuration.selectedOptions.length > 0 && (
            <div className="text-xs space-y-1 p-2 rounded bg-muted/50">
              <p className="font-medium text-[10px] text-muted-foreground">Options:</p>
              <div className="space-y-0.5">
                {item.configuration.selectedOptions.map((opt: any, idx: number) => (
                  <div key={idx} className="flex justify-between">
                    <span>• {opt.name}</span>
                    <span>+{opt.price?.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Configuration pour les kits */}
          {item.configuration?.items && (
            <div className="text-xs space-y-1.5 p-2 rounded bg-muted/50">
              <p className="font-medium text-[10px] text-muted-foreground">Configuration:</p>
              <div className="space-y-1.5">
                {item.configuration.items?.map((configItem: any, idx: number) => {
                  const discountInfo = getAccessoryDiscountInfo(configItem.accessoryId, configItem.quantity);

                  return (
                    <div key={idx} className="space-y-0.5 pb-1.5 border-b last:border-0 last:pb-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">
                            {configItem.accessoryName} x{configItem.quantity}
                          </p>
                          {configItem.color && (
                            <p className="text-[10px] text-muted-foreground">Couleur: {configItem.color}</p>
                          )}
                          {discountInfo && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <TrendingDown className="h-2.5 w-2.5 text-green-600" />
                              <span className="text-[10px] text-green-700 dark:text-green-400">
                                -{discountInfo.discount_percent}%
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-medium whitespace-nowrap">
                          {configItem.itemPrice?.toFixed(2)} €
                        </span>
                      </div>
                      {configItem.selectedOptions?.length > 0 && (
                        <div className="ml-2 space-y-0.5">
                          {configItem.selectedOptions.map((opt: any, optIdx: number) => (
                            <div key={optIdx} className="flex justify-between text-[10px] text-muted-foreground">
                              <span>+ {opt.name}</span>
                              <span>+{opt.price?.toFixed(2)} €</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Prix dégressifs */}
          {applicableTier && (
            <div className="flex items-center gap-1.5 p-1.5 bg-green-500/10 border border-green-500/20 rounded">
              <TrendingDown className="h-3 w-3 text-green-600" />
              <span className="text-[10px] font-medium text-green-700 dark:text-green-400">
                Prix dégressif: -{applicableTier.discount_percent}%
              </span>
            </div>
          )}

          {nextTier && (
            <div className="flex items-center gap-1.5 p-1.5 bg-blue-500/10 border border-blue-500/20 rounded">
              <Tag className="h-3 w-3 text-blue-600" />
              <span className="text-[10px] text-blue-700 dark:text-blue-400">
                +{nextTier.article_position - item.quantity} pour -{nextTier.discount_percent}%
              </span>
            </div>
          )}

          {/* Prix et quantité */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Prix unitaire:</span>
              <div className="flex items-center gap-1.5">
                {applicableTier && (
                  <span className="text-[10px] text-muted-foreground line-through">
                    {item.price_at_addition.toFixed(2)} €
                  </span>
                )}
                <span className="font-medium">{unitPrice.toFixed(2)} €</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Quantité:</span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                  className="w-12 h-6 text-center text-xs p-0"
                  min="1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Sous-total:</span>
              <span className="text-sm font-bold text-primary">{(unitPrice * item.quantity).toFixed(2)} €</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Panier ({cartItems.length})
          </SheetTitle>
          <SheetDescription>Gérez vos articles avant de passer commande</SheetDescription>
        </SheetHeader>

        {cartItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <ShoppingBag className="h-16 w-16 mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2 text-center">Votre panier est vide</p>
            <p className="text-sm text-muted-foreground text-center">
              Ajoutez des produits depuis le catalogue
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <CartItemComponent key={item.id} item={item} />
                ))}
              </div>
            </ScrollArea>

            <div className="border-t">
              <div className="px-6 py-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total:</span>
                  <span className="text-2xl font-bold text-primary">{totalPrice.toFixed(2)} €</span>
                </div>

                <SheetFooter className="flex-col sm:flex-col gap-2">
                  <Button 
                    onClick={onCheckout} 
                    className="w-full" 
                    size="lg"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Valider le panier
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={onClearCart} 
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Vider le panier
                  </Button>
                </SheetFooter>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
