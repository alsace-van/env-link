import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Package, Users, ShoppingCart, Eye, Edit, Trash2, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";
import { ShopProductFormDialog } from "@/components/ShopProductFormDialog";
import logo from "@/assets/logo.png";

interface ShopProduct {
  id: string;
  name: string;
  description: string;
  type: string;
  price: number;
  is_active: boolean;
  created_at: string;
  promo_active?: boolean;
  promo_price?: number;
  image_url?: string;
}

const ShopAdmin = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadProducts();
  }, [refreshKey]);

  const loadProducts = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("shop_products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setProducts(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des produits:", error);
      toast.error("Erreur lors du chargement des produits");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) return;

    try {
      const { error } = await supabase.from("shop_products").delete().eq("id", productId);

      if (error) throw error;

      toast.success("Produit supprimé");
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleToggleActive = async (productId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("shop_products")
        .update({ is_active: !currentStatus })
        .eq("id", productId);

      if (error) throw error;

      toast.success(currentStatus ? "Produit masqué" : "Produit activé");
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      simple: "Simple",
      custom_kit: "Kit personnalisé",
      bundle: "Bundle",
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      simple: "default",
      custom_kit: "secondary",
      bundle: "outline",
    };
    return colors[type] || "default";
  };

  const getStats = () => {
    return {
      total: products.length,
      active: products.filter((p) => p.is_active).length,
      inactive: products.filter((p) => !p.is_active).length,
      promo: products.filter((p) => p.promo_active).length,
    };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Logo" className="h-10" />
              <h1 className="text-xl font-bold">Gestion de la Boutique</h1>
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">Chargement...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Logo" className="h-10" />
            <h1 className="text-xl font-bold">Gestion de la Boutique</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Statistiques */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total produits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Produits actifs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Produits inactifs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-500">{stats.inactive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>En promotion</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.promo}</div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation rapide */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/admin/orders")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Commandes
              </CardTitle>
              <CardDescription>Gérer toutes les commandes</CardDescription>
            </CardHeader>
          </Card>
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/admin/customers")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Clients
              </CardTitle>
              <CardDescription>Voir tous les clients</CardDescription>
            </CardHeader>
          </Card>
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/shop")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Voir la boutique
              </CardTitle>
              <CardDescription>Aperçu côté client</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Gestion des produits */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Produits
                </CardTitle>
                <CardDescription>Gérez votre catalogue de produits</CardDescription>
              </div>
              <Button onClick={() => { setSelectedProduct(null); setProductFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau produit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">Tous ({products.length})</TabsTrigger>
                <TabsTrigger value="active">Actifs ({stats.active})</TabsTrigger>
                <TabsTrigger value="inactive">Inactifs ({stats.inactive})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="mt-6">
                <ProductsTable 
                  products={products} 
                  onEdit={(product) => { setSelectedProduct(product); setProductFormOpen(true); }}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                  getTypeLabel={getTypeLabel}
                  getTypeColor={getTypeColor}
                />
              </TabsContent>
              
              <TabsContent value="active" className="mt-6">
                <ProductsTable 
                  products={products.filter(p => p.is_active)} 
                  onEdit={(product) => { setSelectedProduct(product); setProductFormOpen(true); }}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                  getTypeLabel={getTypeLabel}
                  getTypeColor={getTypeColor}
                />
              </TabsContent>
              
              <TabsContent value="inactive" className="mt-6">
                <ProductsTable 
                  products={products.filter(p => !p.is_active)} 
                  onEdit={(product) => { setSelectedProduct(product); setProductFormOpen(true); }}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                  getTypeLabel={getTypeLabel}
                  getTypeColor={getTypeColor}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      <ShopProductFormDialog
        open={productFormOpen}
        onOpenChange={setProductFormOpen}
        product={selectedProduct}
        onSuccess={() => {
          setProductFormOpen(false);
          setRefreshKey((prev) => prev + 1);
        }}
      />
    </div>
  );
};

// Composant de table réutilisable
interface ProductsTableProps {
  products: ShopProduct[];
  onEdit: (product: ShopProduct) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, currentStatus: boolean) => void;
  getTypeLabel: (type: string) => string;
  getTypeColor: (type: string) => string;
}

const ProductsTable = ({ products, onEdit, onDelete, onToggleActive, getTypeLabel, getTypeColor }: ProductsTableProps) => {
  if (products.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Aucun produit dans cette catégorie</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produit</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Prix</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  {product.image_url && (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-10 w-10 object-cover rounded"
                    />
                  )}
                  <div>
                    <div className="font-semibold">{product.name}</div>
                    {product.description && (
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {product.description}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={getTypeColor(product.type) as any}>
                  {getTypeLabel(product.type)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div>
                  {product.promo_active && product.promo_price ? (
                    <>
                      <div className="font-bold text-orange-600">{product.promo_price.toFixed(2)} €</div>
                      <div className="text-sm text-muted-foreground line-through">
                        {product.price.toFixed(2)} €
                      </div>
                      <Badge variant="destructive" className="text-xs mt-1">
                        <Percent className="h-3 w-3 mr-1" />
                        PROMO
                      </Badge>
                    </>
                  ) : (
                    <div className="font-semibold">{product.price.toFixed(2)} €</div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={product.is_active ? "default" : "secondary"}>
                  {product.is_active ? "Actif" : "Inactif"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(product)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleActive(product.id, product.is_active)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(product.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ShopAdmin;
