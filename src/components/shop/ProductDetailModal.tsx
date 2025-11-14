import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, FileText, ShoppingCart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCartContext } from "@/contexts/CartContext";

interface ProductDetailModalProps {
  productId: string | null;
  onClose: () => void;
  onConfigure?: (productId: string) => void;
}

export const ProductDetailModal = ({ productId, onClose, onConfigure }: ProductDetailModalProps) => {
  const { addToCart } = useCartContext();
  const [product, setProduct] = useState<any>(null);
  const [accessories, setAccessories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  const loadProduct = async () => {
    if (!productId) return;
    
    setLoading(true);

    const { data: productData } = await supabase
      .from("shop_products" as any)
      .select("*")
      .eq("id", productId)
      .single();

    if (productData) {
      setProduct(productData);

      if ((productData as any).product_type !== "simple") {
        const { data: items } = await supabase
          .from("shop_product_items" as any)
          .select(`
            *,
            accessory:accessories_catalog(
              nom,
              marque,
              prix_vente_ttc,
              description,
              image_url
            )
          `)
          .eq("shop_product_id", productId);

        if (items) {
          setAccessories(items);
        }
      }
    }

    setLoading(false);
  };

  const handleAddToCart = () => {
    if (!product) return;

    if (product.product_type === "custom_kit" && onConfigure) {
      onConfigure(product.id);
      onClose();
    } else {
      addToCart(product.id, product.prix_base);
      onClose();
    }
  };

  if (!productId) return null;

  return (
    <Dialog open={!!productId} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        {loading ? (
          <div className="text-center py-12">Chargement...</div>
        ) : product ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {product.nom}
                </span>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.nom}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-24 w-24 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Badge variant="outline" className="capitalize">
                    {product.product_type === "custom_kit"
                      ? "Kit sur-mesure"
                      : product.product_type === "bundle"
                      ? "Bundle"
                      : "Produit simple"}
                  </Badge>
                  <Badge variant={product.is_active ? "default" : "secondary"}>
                    {product.is_active ? "Disponible" : "Indisponible"}
                  </Badge>
                </div>
              </div>

              <ScrollArea className="h-[500px]">
                <div className="space-y-6">
                  {product.description && (
                    <div>
                      <h3 className="font-semibold mb-2">Description</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {product.description}
                      </p>
                    </div>
                  )}

                  <Separator />

                  <div>
                    <h3 className="font-semibold mb-2">Prix</h3>
                    <div className="text-3xl font-bold text-primary">
                      {product.product_type === "custom_kit" ? "À partir de " : ""}
                      {product.prix_base.toFixed(2)} €
                    </div>
                  </div>

                  {accessories.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold mb-4">
                          {product.product_type === "custom_kit"
                            ? "Accessoires disponibles"
                            : "Accessoires inclus"}
                        </h3>
                        <div className="space-y-3">
                          {accessories.map((item: any) => (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 p-3 rounded-lg border"
                            >
                              <div className="w-16 h-16 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                                {item.accessory?.image_url ? (
                                  <img
                                    src={item.accessory.image_url}
                                    alt={item.accessory.nom}
                                    className="w-full h-full object-cover rounded"
                                  />
                                ) : (
                                  <Package className="h-6 w-6 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium">{item.accessory?.nom}</p>
                                {item.accessory?.marque && (
                                  <p className="text-xs text-muted-foreground">
                                    {item.accessory.marque}
                                  </p>
                                )}
                                {product.product_type !== "custom_kit" && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Quantité: {item.default_quantity}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="sticky bottom-0 bg-background pt-4 pb-2">
                    <Button
                      className="w-full gap-2"
                      size="lg"
                      onClick={handleAddToCart}
                      disabled={!product.is_active}
                    >
                      <ShoppingCart className="h-5 w-5" />
                      {product.product_type === "custom_kit"
                        ? "Configurer le kit"
                        : "Ajouter au panier"}
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </>
        ) : (
          <div className="text-center py-12">Produit introuvable</div>
        )}
      </DialogContent>
    </Dialog>
  );
};
