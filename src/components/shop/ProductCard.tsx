import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Eye, Package, Zap, Star } from "lucide-react";
import { useState } from "react";

export interface ProductCardProps {
  product: any;
  onAddToCart: (productId: string, price: number) => void;
  onViewDetails: (productId: string) => void;
  onQuickView?: (productId: string) => void;
  onConfigureKit?: (productId: string) => void;
  viewMode: "grid" | "list";
}

export const ProductCard = ({
  product,
  onAddToCart,
  onViewDetails,
  onQuickView,
  onConfigureKit,
  viewMode,
}: ProductCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isCustomKit = product.product_type === "custom_kit";
  const isBundle = product.product_type === "bundle";
  const isInStock = product.stock_quantity > 0;
  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;

  const handleMainAction = () => {
    if (isCustomKit && onConfigureKit) {
      onConfigureKit(product.id);
    } else {
      onAddToCart(product.id, product.prix_base);
    }
  };

  if (viewMode === "list") {
    return (
      <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 group">
        <div className="flex gap-6 p-4">
          {/* Image */}
          <div className="relative w-48 h-48 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
            {product.image_url && !imageError ? (
              <>
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                )}
                <img
                  src={product.image_url}
                  alt={product.nom}
                  className={`w-full h-full object-cover transition-all duration-300 cursor-pointer ${
                    imageLoaded ? "opacity-100 group-hover:scale-105" : "opacity-0"
                  }`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  onClick={() => onViewDetails(product.id)}
                />
              </>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => onViewDetails(product.id)}
              >
                <Package className="h-16 w-16 text-muted-foreground" />
              </div>
            )}

            {/* Quick View Button */}
            {onQuickView && (
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickView(product.id);
                }}
              >
                <Zap className="h-4 w-4 mr-1" />
                Aperçu
              </Button>
            )}

            {/* Badges on image */}
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {!isInStock && (
                <Badge variant="destructive" className="shadow-lg">
                  Rupture
                </Badge>
              )}
              {isLowStock && (
                <Badge variant="default" className="bg-orange-500 shadow-lg">
                  Stock limité
                </Badge>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <div className="flex items-start gap-2 mb-2">
                  <h3
                    className="font-semibold text-xl hover:text-primary cursor-pointer transition-colors"
                    onClick={() => onViewDetails(product.id)}
                  >
                    {product.nom}
                  </h3>
                  <Badge variant="outline" className="capitalize shrink-0">
                    {isCustomKit ? "Kit sur-mesure" : isBundle ? "Bundle" : "Simple"}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                  {product.description || "Aucune description disponible"}
                </p>

                {/* Additional info */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {product.category_name && (
                    <Badge variant="secondary" className="text-xs">
                      {product.category_name}
                    </Badge>
                  )}
                  {product.stock_quantity > 5 && (
                    <Badge variant="outline" className="text-xs text-green-600">
                      ✓ En stock
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Price and actions */}
            <div className="mt-auto flex items-end justify-between gap-4">
              <div>
                <div className="text-3xl font-bold text-primary">
                  {isCustomKit && "Dès "}
                  {product.prix_base.toFixed(2)} €
                </div>
                {product.prix_original && product.prix_original > product.prix_base && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground line-through">
                      {product.prix_original.toFixed(2)} €
                    </span>
                    <Badge variant="destructive" className="text-xs">
                      -{Math.round((1 - product.prix_base / product.prix_original) * 100)}%
                    </Badge>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {!isCustomKit && (
                  <Button variant="outline" onClick={() => onViewDetails(product.id)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Voir les détails
                  </Button>
                )}
                <Button
                  onClick={handleMainAction}
                  disabled={!product.is_active || (!isCustomKit && !isInStock)}
                  size="lg"
                  className="min-w-[180px]"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {isCustomKit ? "Configurer le kit" : "Ajouter au panier"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Grid view
  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col h-full">
      {/* Image */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        {product.image_url && !imageError ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            )}
            <img
              src={product.image_url}
              alt={product.nom}
              className={`w-full h-full object-cover transition-all duration-300 cursor-pointer ${
                imageLoaded ? "opacity-100 group-hover:scale-110" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              onClick={() => onViewDetails(product.id)}
            />
          </>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
            onClick={() => onViewDetails(product.id)}
          >
            <Package className="h-24 w-24 text-muted-foreground" />
          </div>
        )}

        {/* Overlay with actions */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {onQuickView && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onQuickView(product.id);
              }}
            >
              <Zap className="h-4 w-4 mr-1" />
              Aperçu rapide
            </Button>
          )}
          {!isCustomKit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(product.id);
              }}
            >
              <Eye className="h-4 w-4 mr-1" />
              Détails
            </Button>
          )}
        </div>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {!isInStock && (
            <Badge variant="destructive" className="shadow-lg">
              Rupture
            </Badge>
          )}
          {isLowStock && (
            <Badge variant="default" className="bg-orange-500 shadow-lg">
              Stock limité
            </Badge>
          )}
        </div>

        <div className="absolute top-2 right-2">
          <Badge variant="outline" className="capitalize bg-background/90 backdrop-blur">
            {isCustomKit ? "Kit" : isBundle ? "Bundle" : "Simple"}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3
            className="font-semibold text-lg line-clamp-2 flex-1 hover:text-primary cursor-pointer transition-colors"
            onClick={() => onViewDetails(product.id)}
          >
            {product.nom}
          </h3>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">
          {product.description || "Aucune description disponible"}
        </p>

        {/* Price */}
        <div className="mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">
              {isCustomKit && "Dès "}
              {product.prix_base.toFixed(2)} €
            </span>
          </div>
          {product.prix_original && product.prix_original > product.prix_base && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground line-through">{product.prix_original.toFixed(2)} €</span>
              <Badge variant="destructive" className="text-xs">
                -{Math.round((1 - product.prix_base / product.prix_original) * 100)}%
              </Badge>
            </div>
          )}
        </div>

        {/* Stock info */}
        {isInStock && (
          <div className="text-xs text-green-600 mb-3 flex items-center gap-1">
            <span className="h-2 w-2 bg-green-600 rounded-full"></span>
            {product.stock_quantity > 5 ? "En stock" : `Plus que ${product.stock_quantity} en stock`}
          </div>
        )}

        {/* Add to cart button */}
        <Button
          className="w-full"
          onClick={handleMainAction}
          disabled={!product.is_active || (!isCustomKit && !isInStock)}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          {isCustomKit ? "Configurer" : "Ajouter au panier"}
        </Button>
      </div>
    </Card>
  );
};
