import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Eye, Package } from "lucide-react";
import { useState } from "react";

interface ProductCardProps {
  product: {
    id: string;
    nom: string;
    description?: string;
    prix_base: number;
    image_url?: string;
    product_type: string;
  };
  onViewDetails: (productId: string) => void;
  onAddToCart: (productId: string) => void;
}

export const ProductCard = ({ product, onViewDetails, onAddToCart }: ProductCardProps) => {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all group">
      <div
        className="aspect-video bg-muted relative cursor-pointer"
        onClick={() => onViewDetails(product.id)}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.nom}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <Badge className="absolute top-2 right-2 capitalize">
          {product.product_type === "custom_kit"
            ? "Kit sur-mesure"
            : product.product_type === "bundle"
            ? "Bundle"
            : "Simple"}
        </Badge>
      </div>

      <CardContent className="pt-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-1">{product.nom}</h3>
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {product.description}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between pt-0">
        <div className="text-2xl font-bold text-primary">
          {product.product_type === "custom_kit" ? "À partir de " : ""}
          {product.prix_base.toFixed(2)} €
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => onViewDetails(product.id)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button onClick={() => onAddToCart(product.id)}>
            {product.product_type === "custom_kit" ? "Configurer" : <ShoppingCart className="h-4 w-4" />}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
