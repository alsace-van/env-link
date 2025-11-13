import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, Edit, Trash2, Settings } from "lucide-react";
import { ShopProductFormDialog } from "@/components/ShopProductFormDialog";
import CustomKitConfigDialog from "@/components/CustomKitConfigDialog";
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedKitProduct, setSelectedKitProduct] = useState<ShopProduct | null>(null);
  const [editingKit, setEditingKit] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      checkAdminStatus(user.id);
      loadProducts();
    }
  }, [user, refreshKey]);

  const loadUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/auth");
    } else {
      setUser(session.user);
    }
  };

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    setIsAdmin(!!data);
  };

  const loadProducts = async () => {
    setLoading(true);

    try {
      const { data: kitsData, error: kitsError } = await supabase
        .from("shop_custom_kits")
        .select("*")
        .eq("is_active", true)
        .order("nom");

      if (kitsError) throw kitsError;

      const uniqueKits = new Map();
      
      const kitsWithImages = (kitsData || []).map((k: any) => {
        const kit = {
          id: k.id,
          name: k.nom,
          description: k.description,
          type: "custom_kit" as const,
          price: k.prix_base || 0,
          is_active: k.is_active,
          created_at: k.created_at,
        };
        
        uniqueKits.set(k.id, kit);
        return kit;
      });

      setProducts(Array.from(uniqueKits.values()));
    } catch (error) {
      console.error("Erreur chargement produits:", error);
      toast.error("Erreur lors du chargement des produits");
    }
    setLoading(false);
  };

  const handleDeleteKit = async (kitId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce kit ?")) return;

    const { error } = await supabase.from("shop_custom_kits").delete().eq("id", kitId);

    if (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Kit supprimé");
      setRefreshKey((prev) => prev + 1);
    }
  };

  const handleToggleActiveKit = async (kitId: string, currentStatus: boolean) => {
    const { error } = await supabase.from("shop_custom_kits").update({ is_active: !currentStatus }).eq("id", kitId);

    if (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success(currentStatus ? "Kit masqué" : "Kit activé");
      setRefreshKey((prev) => prev + 1);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <img src={logo} alt="Logo" className="h-10 w-auto" />
              <h1 className="text-2xl font-bold text-foreground">Boutique</h1>
            </div>
            <div className="flex items-center gap-3">
              {isAdmin && (
                <Button
                  variant="default"
                  onClick={() => {
                    setEditingKit(null);
                    setIsEditDialogOpen(true);
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Gérer les produits
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun produit disponible pour le moment</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{product.name}</CardTitle>
                      <Badge variant="outline" className="mb-2">
                        {product.type === "custom_kit" ? "Kit sur mesure" : "Produit simple"}
                      </Badge>
                      {product.description && (
                        <CardDescription className="text-sm line-clamp-2 mt-2">
                          {product.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {product.price > 0 ? `${product.price.toFixed(2)} €` : "Sur devis"}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {isAdmin && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingKit(product);
                            setIsEditDialogOpen(true);
                          }}
                          className="flex-1"
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Modifier
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteKit(product.id)}
                          className="flex-1"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </Button>
                      </>
                    )}
                    {!isAdmin && product.type === "custom_kit" && (
                      <Button
                        variant="default"
                        onClick={() => setSelectedKitProduct(product)}
                        className="w-full"
                      >
                        <Package className="mr-2 h-4 w-4" />
                        Configurer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Dialogs */}
      <CustomKitConfigDialog
        open={!!selectedKitProduct}
        onOpenChange={(open) => !open && setSelectedKitProduct(null)}
        productId={selectedKitProduct?.id || ""}
        productName={selectedKitProduct?.name || ""}
        basePrice={selectedKitProduct?.price || 0}
        onAddToCart={(config, price) => {
          toast.success("Configuration enregistrée");
          setSelectedKitProduct(null);
        }}
      />

      <ShopProductFormDialog
        editProduct={editingKit}
        onSuccess={() => {
          setRefreshKey((prev) => prev + 1);
          setEditingKit(null);
          setIsEditDialogOpen(false);
        }}
        forceOpen={isEditDialogOpen}
        onClose={() => {
          setEditingKit(null);
          setIsEditDialogOpen(false);
        }}
      />
    </div>
  );
};

export default Shop;
