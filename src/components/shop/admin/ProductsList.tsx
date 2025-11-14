import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Eye, EyeOff, Package } from "lucide-react";
import { toast } from "sonner";
import { ShopProductFormDialog } from "@/components/ShopProductFormDialog";

interface Product {
  id: string;
  nom: string;
  description?: string;
  prix_base: number;
  image_url?: string;
  product_type: string;
  is_active: boolean;
}

export const ProductsList = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("shop_products" as any)
      .select("*")
      .order("nom");

    if (data) {
      setProducts(data as any);
    }
    setLoading(false);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("shop_products" as any)
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success(
        !currentStatus ? "Produit activé" : "Produit désactivé"
      );
      loadProducts();
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) return;

    try {
      const { error } = await supabase
        .from("shop_products" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Produit supprimé");
      loadProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <div className="aspect-video bg-muted relative">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.nom}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <Badge
                className="absolute top-2 right-2"
                variant={product.is_active ? "default" : "secondary"}
              >
                {product.is_active ? "Actif" : "Inactif"}
              </Badge>
            </div>

            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="truncate">{product.nom}</span>
                <Badge variant="outline" className="capitalize ml-2">
                  {product.product_type === "custom_kit"
                    ? "Kit"
                    : product.product_type === "bundle"
                    ? "Bundle"
                    : "Simple"}
                </Badge>
              </CardTitle>
              {product.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {product.description}
                </p>
              )}
            </CardHeader>

            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xl font-bold">
                  {product.prix_base.toFixed(2)} €
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleToggleActive(product.id, product.is_active)}
                  title={product.is_active ? "Désactiver" : "Activer"}
                >
                  {product.is_active ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setEditingProduct(product)}
                  title="Modifier"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDelete(product.id)}
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingProduct && (
        <ShopProductFormDialog
          editProduct={editingProduct}
          forceOpen={true}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            loadProducts();
          }}
        />
      )}
    </>
  );
};
