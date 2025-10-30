import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Minus, ShoppingBag, TrendingDown, Tag } from "lucide-react";
import { CartItem } from "@/hooks/useCart";
import { useTieredPricing } from "@/hooks/useTieredPricing";
import { supabase } from "@/integrations/supabase/client";

interface ShoppingCartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartItems: CartItem[];
  totalPrice: number;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
}

export const ShoppingCartDialog = ({
  open,
  onOpenChange,
  cartItems,
  totalPrice,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
}: ShoppingCartDialogProps) => {
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

    // State pour les prix dégressifs des accessoires dans les kits
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
      <div className="flex gap-4 p-4 rounded-lg border bg-card">
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold">{item.product?.name || "Produit"}</h4>
              <Badge variant="secondary" className="text-xs mt-1">
                {getProductTypeLabel(item.product?.type || "")}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onRemoveItem(item.id)} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Options pour les produits simples */}
          {item.configuration?.selectedOptions && item.configuration.selectedOptions.length > 0 && (
            <div className="text-sm space-y-1 p-2 rounded bg-muted/50">
              <p className="font-medium text-xs">Options sélectionnées:</p>
              <div className="space-y-1">
                {item.configuration.selectedOptions.map((opt: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                    <span>• {opt.name}</span>
                    <span>+{opt.price?.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Configuration pour les kits */}
          {item.configuration?.items && (
            <div className="text-sm space-y-2 p-2 rounded bg-muted/50">
              <p className="font-medium text-xs">Configuration:</p>
              <div className="space-y-2">
                {item.configuration.items?.map((configItem: any, idx: number) => {
                  const discountInfo = getAccessoryDiscountInfo(configItem.accessoryId, configItem.quantity);

                  return (
                    <div key={idx} className="space-y-1 pb-2 border-b last:border-0 last:pb-0">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-xs font-medium">
                            {configItem.accessoryName} x{configItem.quantity}
                          </p>
                          {configItem.color && (
                            <p className="text-xs text-muted-foreground">Couleur: {configItem.color}</p>
                          )}
                          {discountInfo && (
                            <div className="flex items-center gap-1 mt-1">
                              <TrendingDown className="h-3 w-3 text-green-600" />
                              <span className="text-xs text-green-700 dark:text-green-400">
                                -{discountInfo.discount_percent}% à partir du {discountInfo.article_position}ème
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-medium whitespace-nowrap ml-2">
                          {configItem.itemPrice?.toFixed(2)} €
                        </span>
                      </div>
                      {configItem.selectedOptions?.length > 0 && (
                        <div className="ml-2 space-y-0.5">
                          {configItem.selectedOptions.map((opt: any, optIdx: number) => (
                            <div key={optIdx} className="flex justify-between text-xs text-muted-foreground">
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

          <div className="space-y-2">
            {applicableTier && (
              <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-md">
                <TrendingDown className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-700 dark:text-green-400">
                  Prix dégressif: -{applicableTier.discount_percent}% appliqué
                </span>
              </div>
            )}

            {nextTier && (
              <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-md">
                <Tag className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-blue-700 dark:text-blue-400">
                  Achetez {nextTier.article_position - item.quantity} de plus pour -{nextTier.discount_percent}%
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Prix unitaire:</span>
              <div className="flex items-center gap-2">
                {applicableTier && (
                  <span className="text-xs text-muted-foreground line-through">
                    {item.price_at_addition.toFixed(2)} €
                  </span>
                )}
                <span className="text-sm font-medium">{unitPrice.toFixed(2)} €</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Quantité:</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                  className="w-16 h-7 text-center"
                  min="1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Sous-total:</span>
              <span className="text-lg font-bold text-primary">{(unitPrice * item.quantity).toFixed(2)} €</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Panier ({cartItems.length})
          </DialogTitle>
          <DialogDescription>Gérez vos articles avant de passer commande</DialogDescription>
        </DialogHeader>

        {cartItems.length === 0 ? (
          <div className="py-12 text-center">
            <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">Votre panier est vide</p>
            <p className="text-sm text-muted-foreground">Ajoutez des produits depuis le catalogue</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <CartItemComponent key={item.id} item={item} />
                ))}
              </div>
            </ScrollArea>

            <Separator />

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total:</span>
                <span className="text-2xl font-bold text-primary">{totalPrice.toFixed(2)} €</span>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={onClearCart} className="w-full sm:w-auto">
                Vider le panier
              </Button>
              <Button onClick={onCheckout} className="w-full sm:w-auto" size="lg">
                Passer commande
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
