import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingCart, Package, Edit, Trash2, Eye } from "lucide-react";
import UserMenu from "@/components/UserMenu";
import { ShopProductFormDialog } from "@/components/ShopProductFormDialog";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

interface ShopProduct {
  id: string;
  name: string;
  description: string;
  type: string;
  price: number;
  is_active: boolean;
  created_at: string;
}

const Shop = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadUser();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadProducts();
    }
  }, [user, refreshKey]);

  const loadUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/auth");
      return;
    }

    setUser(user);
  };

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shop_products")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement des produits:", error);
      toast.error("Erreur lors du chargement des produits");
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) return;

    const { error } = await supabase
      .from("shop_products")
      .delete()
      .eq("id", productId);

    if (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Produit supprimé");
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleToggleActive = async (productId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("shop_products")
      .update({ is_active: !currentStatus })
      .eq("id", productId);

    if (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success(currentStatus ? "Produit masqué" : "Produit activé");
      setRefreshKey(prev => prev + 1);
    }
  };

  const getTypeLabel = (type: string) => {
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case "simple":
        return "default";
      case "composed":
        return "secondary";
      case "custom_kit":
        return "outline";
      default:
        return "default";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <img
              src={logo}
              alt="Alsace Van Création"
              className="h-20 w-auto object-contain"
            />
            <div className="flex-1">
              <h1 className="text-xl font-bold">Boutique</h1>
              <p className="text-sm text-muted-foreground">
                Gérez vos produits en vente
              </p>
            </div>
            {user && (
              <div className="flex items-center gap-2">
                <UserMenu user={user} />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="products" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="products">
                <Package className="h-4 w-4 mr-2" />
                Mes Produits
              </TabsTrigger>
              <TabsTrigger value="catalog">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Catalogue Public
              </TabsTrigger>
            </TabsList>

            <ShopProductFormDialog
              onSuccess={() => setRefreshKey(prev => prev + 1)}
            />
          </div>

          <TabsContent value="products" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Chargement...</p>
              </div>
            ) : products.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">
                    Vous n'avez pas encore créé de produits
                  </p>
                  <ShopProductFormDialog
                    trigger={<Button>Créer votre premier produit</Button>}
                    onSuccess={() => setRefreshKey(prev => prev + 1)}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <Card key={product.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-lg">{product.name}</CardTitle>
                            {!product.is_active && (
                              <Badge variant="secondary">Inactif</Badge>
                            )}
                          </div>
                          <div className="flex gap-2 mb-2">
                            <Badge variant={getTypeColor(product.type) as any}>
                              {getTypeLabel(product.type)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {product.description && (
                        <CardDescription className="line-clamp-2">
                          {product.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Prix:</span>
                          <span className="text-lg font-semibold">
                            {product.price.toFixed(2)} €
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleToggleActive(product.id, product.is_active)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {product.is_active ? "Masquer" : "Activer"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="catalog" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Catalogue public</CardTitle>
                <CardDescription>
                  Les produits actifs visibles par vos clients
                </CardDescription>
              </CardHeader>
              <CardContent>
                {products.filter(p => p.is_active).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Aucun produit actif dans votre boutique
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {products
                      .filter(p => p.is_active)
                      .map((product) => (
                        <Card key={product.id}>
                          <CardHeader>
                            <CardTitle className="text-lg">{product.name}</CardTitle>
                            <Badge variant={getTypeColor(product.type) as any}>
                              {getTypeLabel(product.type)}
                            </Badge>
                            {product.description && (
                              <CardDescription className="line-clamp-3">
                                {product.description}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-primary">
                              {product.price.toFixed(2)} €
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Shop;
