import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, ExternalLink, Package, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface QuickViewModalProps {
  productId: string | null;
  onClose: () => void;
  onAddToCart: (productId: string, price: number) => void;
  onViewFull?: (productId: string) => void;
}

export const QuickViewModal = ({
  productId,
  onClose,
  onAddToCart,
  onViewFull,
}: QuickViewModalProps) => {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  const loadProduct = async () => {
    if (!productId) return;

    setLoading(true);
    const { data } = await supabase
      .from("shop_products" as any)
      .select(`
        *,
        category:shop_categories(nom)
      `)
      .eq("id", productId)
      .single();

    if (data) {
      setProduct(data);
    }
    setLoading(false);
  };

  const handleAddToCart = () => {
    if (product) {
      onAddToCart(product.id, product.prix_base);
      onClose();
    }
  };

  if (!productId) return null;

  return (
    <Dialog open={!!productId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : product ? (
          <div className="space-y-6">
            {/* Header */}
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <DialogTitle className="text-2xl mb-2">{product.nom}</DialogTitle>
                  <DialogDescription className="text-base">
                    Aperçu rapide du produit
                  </DialogDescription>
                </div>
                {onViewFull && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onViewFull(product.id);
                      onClose();
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Voir tous les détails
                  </Button>
                )}
              </div>
            </DialogHeader>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Image */}
              <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.nom}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-32 w-32 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-4">
                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">
                    {product.product_type === "custom_kit"
                      ? "Kit sur-mesure"
                      : product.product_type === "bundle"
                      ? "Bundle"
                      : "Produit simple"}
                  </Badge>
                  {product.category?.nom && (
                    <Badge variant="secondary">{product.category.nom}</Badge>
                  )}
                  {product.stock_quantity > 0 ? (
                    <Badge variant="outline" className="text-green-600">
                      ✓ En stock
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Rupture de stock</Badge>
                  )}
                </div>

                {/* Price */}
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-primary">
                      {product.product_type === "custom_kit" && "Dès "}
                      {product.prix_base.toFixed(2)} €
                    </span>
                  </div>
                  {product.prix_original && product.prix_original > product.prix_base && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg text-muted-foreground line-through">
                        {product.prix_original.toFixed(2)} €
                      </span>
                      <Badge variant="destructive">
                        -{Math.round((1 - product.prix_base / product.prix_original) * 100)}%
                      </Badge>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Description */}
                <div>
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {product.description || "Aucune description disponible"}
                  </p>
                </div>

                {/* Stock */}
                {product.stock_quantity > 0 && product.stock_quantity <= 10 && (
                  <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                    <p className="text-sm text-orange-800 dark:text-orange-200">
                      ⚠️ Plus que {product.stock_quantity} article{product.stock_quantity > 1 ? "s" : ""} en stock
                    </p>
                  </div>
                )}

                <Separator />

                {/* Quantity selector (for simple products) */}
                {product.product_type === "simple" && product.stock_quantity > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Quantité</label>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      >
                        -
                      </Button>
                      <span className="w-12 text-center font-semibold">{quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                        disabled={quantity >= product.stock_quantity}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    className="flex-1"
                    size="lg"
                    onClick={handleAddToCart}
                    disabled={!product.is_active || (product.product_type === "simple" && product.stock_quantity === 0)}
                  >
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    {product.product_type === "custom_kit"
                      ? "Configurer le kit"
                      : "Ajouter au panier"}
                  </Button>
                  {onViewFull && (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => {
                        onViewFull(product.id);
                        onClose();
                      }}
                    >
                      <ExternalLink className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Additional info */}
            {product.caracteristiques && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-3">Caractéristiques</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(product.caracteristiques).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="font-medium">{value as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Produit introuvable</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
