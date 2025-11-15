import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Eye, Package } from "lucide-react";

interface ProductCardProps {
  product: any;
  onAddToCart: (productId: string, price: number) => void;
  onViewDetails: (productId: string) => void;
  onConfigureKit?: (productId: string) => void;
  viewMode: "grid" | "list";
}

export const ProductCard = ({ product, onAddToCart, onViewDetails, onConfigureKit, viewMode }: ProductCardProps) => {
  if (viewMode === "list") {
    return (
      <Card className="p-4 hover:shadow-lg transition-shadow">
        <div className="flex gap-4">
          <div className="w-32 h-32 bg-muted rounded flex-shrink-0 overflow-hidden">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.nom}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => {
                  if (product.product_type === "custom_kit" && onConfigureKit) {
                    onConfigureKit(product.id);
                  } else {
                    onViewDetails(product.id);
                  }
                }}
              />
            ) : (
              <div 
                className="w-full h-full flex items-center justify-center cursor-pointer" 
                onClick={() => {
                  if (product.product_type === "custom_kit" && onConfigureKit) {
                    onConfigureKit(product.id);
                  } else {
                    onViewDetails(product.id);
                  }
                }}
              >
                <Package className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{product.nom}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {product.description || "Aucune description"}
                </p>
                <div className="flex gap-2 mb-2">
                  <Badge variant="outline" className="capitalize">
                    {product.product_type === "custom_kit"
                      ? "Kit sur-mesure"
                      : product.product_type === "bundle"
                      ? "Bundle"
                      : "Simple"}
                  </Badge>
                  {product.stock_quantity > 0 && (
                    <Badge variant="secondary">En stock</Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary mb-2">
                  {product.product_type === "custom_kit" ? "À partir de " : ""}
                  {product.prix_base.toFixed(2)} €
                </div>
                <div className="flex gap-2">
                  {product.product_type !== "custom_kit" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewDetails(product.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Détails
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => {
                      if (product.product_type === "custom_kit" && onConfigureKit) {
                        onConfigureKit(product.id);
                      } else {
                        onAddToCart(product.id, product.prix_base);
                      }
                    }}
                    disabled={!product.is_active}
                  >
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    {product.product_type === "custom_kit" ? "Configurer le kit" : "Ajouter"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div
        className="aspect-square bg-muted cursor-pointer overflow-hidden"
        onClick={() => {
          if (product.product_type === "custom_kit" && onConfigureKit) {
            onConfigureKit(product.id);
          } else {
            onViewDetails(product.id);
          }
        }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.nom}
            className="w-full h-full object-cover hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-24 w-24 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold line-clamp-2 flex-1">{product.nom}</h3>
          <Badge variant="outline" className="capitalize shrink-0">
            {product.product_type === "custom_kit"
              ? "Kit"
              : product.product_type === "bundle"
              ? "Bundle"
              : "Simple"}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {product.description || "Aucune description"}
        </p>

        <div className="flex items-center justify-between gap-2">
          <div className="text-xl font-bold text-primary">
            {product.product_type === "custom_kit" && "Dès "}
            {product.prix_base.toFixed(2)} €
          </div>
          <Button
            size="sm"
            onClick={() => {
              if (product.product_type === "custom_kit" && onConfigureKit) {
                onConfigureKit(product.id);
              } else {
                onAddToCart(product.id, product.prix_base);
              }
            }}
            disabled={!product.is_active}
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            {product.product_type === "custom_kit" ? "Configurer le kit" : "Ajouter"}
          </Button>
        </div>
      </div>
    </Card>
  );
};
