import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingCart, Package, Edit, Trash2, Eye, Settings, ShoppingBag, Percent } from "lucide-react";
import UserMenu from "@/components/UserMenu";
import { ShopProductFormDialog } from "@/components/ShopProductFormDialog";
import CustomKitConfigDialog from "@/components/CustomKitConfigDialog";
import { ShoppingCartSidebar } from "@/components/ShoppingCartSidebar";
import { ProductPricingDialog } from "@/components/ProductPricingDialog";
import { KitAccessoryPricingDialog } from "@/components/KitAccessoryPricingDialog";
import { SimpleProductDialog } from "@/components/SimpleProductDialog";
import { CustomerFormDialog } from "@/components/CustomerFormDialog";
import { AddToProjectExpensesDialog } from "@/components/AddToProjectExpensesDialog";
import { useCartContext } from "@/contexts/CartContext";
import { useShopCustomer } from "@/hooks/useShopCustomer";
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
  promo_active?: boolean;
  promo_price?: number;
  promo_start_date?: string;
  promo_end_date?: string;
  hasOptions?: boolean;
  image_url?: string;
  accessory_image?: string;
}

const Shop = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedKitProduct, setSelectedKitProduct] = useState<ShopProduct | null>(null);
  const [selectedSimpleProduct, setSelectedSimpleProduct] = useState<ShopProduct | null>(null);
  const [pricingDialogProduct, setPricingDialogProduct] = useState<ShopProduct | null>(null);
  const [kitPricingProduct, setKitPricingProduct] = useState<ShopProduct | null>(null);
  
  // Nouveaux états pour le checkout
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [addToProjectDialogOpen, setAddToProjectDialogOpen] = useState(false);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);

  // Utiliser le CartContext au lieu du hook direct
  const cart = useCartContext();
  const shopCustomer = useShopCustomer(user?.id);

  useEffect(() => {
    loadUser();
    loadProducts();
  }, [navigate]);

  useEffect(() => {
    loadProducts();
  }, [refreshKey]);

  const loadUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);
  };

  const loadProducts = async () => {
    setLoading(true);

    let query = supabase.from("shop_products").select("*");

    if (user) {
      query = query.eq("user_id", user.id);
    } else {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement des produits:", error);
      toast.error("Erreur lors du chargement des produits");
    } else {
      const productsWithOptions = await Promise.all(
        (data || []).map(async (product) => {
          const { data: productItems } = await supabase
            .from("shop_product_items")
            .select("accessories_catalog(image_url)")
            .eq("product_id", product.id)
            .limit(1)
            .maybeSingle();

          const accessoryImage = productItems?.accessories_catalog?.image_url || null;

          if (product.type === "simple") {
            const hasOptions = await checkProductHasOptions(product.id);
            return { ...product, hasOptions, accessory_image: accessoryImage };
          }
          return { ...product, accessory_image: accessoryImage };
        }),
      );
      setProducts(productsWithOptions);
    }
    setLoading(false);
  };

  const checkProductHasOptions = async (productId: string) => {
    const { data: productItems } = await supabase
      .from("shop_product_items")
      .select("accessory_id")
      .eq("product_id", productId)
      .limit(1)
      .maybeSingle();

    if (!productItems) return false;

    const { data: options } = await supabase
      .from("accessory_options")
      .select("id")
      .eq("accessory_id", productItems.accessory_id)
      .limit(1);

    return (options && options.length > 0) || false;
  };

  const getEffectivePrice = (product: ShopProduct) => {
    if (product.promo_active && product.promo_price) {
      const now = new Date();
      const start = product.promo_start_date ? new Date(product.promo_start_date) : null;
      const end = product.promo_end_date ? new Date(product.promo_end_date) : null;

      if ((!start || now >= start) && (!end || now <= end)) {
        return product.promo_price;
      }
    }
    return product.price;
  };

  const isOnPromo = (product: ShopProduct) => {
    if (!product.promo_active || !product.promo_price) return false;

    const now = new Date();
    const start = product.promo_start_date ? new Date(product.promo_start_date) : null;
    const end = product.promo_end_date ? new Date(product.promo_end_date) : null;

    return (!start || now >= start) && (!end || now <= end);
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) return;

    const { error } = await supabase.from("shop_products").delete().eq("id", productId);

    if (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Produit supprimé");
      setRefreshKey((prev) => prev + 1);
    }
  };

  const handleToggleActive = async (productId: string, currentStatus: boolean) => {
    const { error } = await supabase.from("shop_products").update({ is_active: !currentStatus }).eq("id", productId);

    if (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success(currentStatus ? "Produit masqué" : "Produit activé");
      setRefreshKey((prev) => prev + 1);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "simple":
        return "Simple";
      case "custom_kit":
        return "Kit personnalisé";
      case "bundle":
        return "Bundle";
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "simple":
        return "default";
      case "custom_kit":
        return "secondary";
      case "bundle":
        return "outline";
      default:
        return "default";
    }
  };

  const handleAddToCart = async (productId: string, price: number) => {
    const success = await cart.addToCart(productId, price);
    if (success) {
      cart.setCartOpen(true);
    }
  };

  const handleAddKitToCart = async (configuration: any, totalPrice: number) => {
    if (!selectedKitProduct) return;
    const success = await cart.addToCart(selectedKitProduct.id, totalPrice, 1, configuration);
    if (success) {
      setSelectedKitProduct(null);
      cart.setCartOpen(true);
    }
  };

  const handleAddSimpleProductToCart = async (accessoryId: string, price: number, quantity: number, selectedOptions: any) => {
    if (!selectedSimpleProduct) return;
    const configuration = { accessoryId, selectedOptions };
    const success = await cart.addToCart(selectedSimpleProduct.id, price, quantity, configuration);
    if (success) {
      setSelectedSimpleProduct(null);
      cart.setCartOpen(true);
    }
  };

  const handleCheckout = async () => {
    if (cart.cartItems.length === 0) {
      toast.error("Votre panier est vide");
      return;
    }

    // Rediriger vers la page de checkout
    navigate("/checkout");
  };

  const handleCustomerFormSubmit = async (customerData: any) => {
    await shopCustomer.updateCustomer(customerData);
    setCustomerFormOpen(false);

    // Charger les projets de l'utilisateur
    if (user) {
      const { data: projects } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setUserProjects(projects || []);

      if (projects && projects.length > 0) {
        setAddToProjectDialogOpen(true);
      } else {
        await finalizeOrder();
      }
    }
  };

  const handleAddToProjectConfirm = async () => {
    if (!selectedProject) return;

    try {
      // Ajouter les articles du panier aux dépenses du projet
      for (const item of cart.cartItems) {
        await supabase.from("project_expenses").insert({
          project_id: selectedProject.id,
          nom: item.product?.name || "Produit",
          montant: item.price_at_addition * item.quantity,
          quantity: item.quantity,
          unit_price: item.price_at_addition,
        });
      }

      toast.success("Articles ajoutés au projet");
      await finalizeOrder();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'ajout au projet");
    }
  };

  const finalizeOrder = async () => {
    // Logique de finalisation de commande
    toast.success("Commande finalisée !");
    await cart.clearCart();
    setAddToProjectDialogOpen(false);
    navigate("/orders");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Logo" className="h-10" />
            <h1 className="text-xl font-bold">Boutique</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="relative" onClick={() => cart.setCartOpen(true)}>
              <ShoppingCart className="h-5 w-5" />
              {cart.getTotalItems() > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cart.getTotalItems()}
                </span>
              )}
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="catalog" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="catalog">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Catalogue
            </TabsTrigger>
            {user && (
              <TabsTrigger value="manage">
                <Package className="h-4 w-4 mr-2" />
                Gestion
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="catalog">
            <Card>
              <CardHeader>
                <CardTitle>Produits disponibles</CardTitle>
                <CardDescription>Découvrez notre sélection</CardDescription>
              </CardHeader>
              <CardContent>
                {products.filter((p) => p.is_active).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Aucun produit actif dans la boutique</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {products
                      .filter((p) => p.is_active)
                      .map((product) => (
                        <Card key={product.id}>
                          {(product.accessory_image || product.image_url) && (
                            <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-white flex items-center justify-center p-4">
                              <img
                                src={product.accessory_image || product.image_url}
                                alt={product.name}
                                className="h-full w-full object-contain"
                              />
                            </div>
                          )}
                          <CardHeader>
                            <CardTitle className="text-lg">{product.name}</CardTitle>
                            <div className="flex gap-2 flex-wrap">
                              <Badge variant={getTypeColor(product.type) as any}>{getTypeLabel(product.type)}</Badge>
                              {product.hasOptions && (
                                <Badge variant="outline" className="text-xs">
                                  Options disponibles
                                </Badge>
                              )}
                            </div>
                            {product.description && (
                              <CardDescription className="line-clamp-3">{product.description}</CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex items-end justify-between">
                                <div>
                                  {isOnPromo(product) ? (
                                    <>
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="destructive" className="text-xs">
                                          PROMO
                                        </Badge>
                                      </div>
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-bold text-primary">
                                          {getEffectivePrice(product).toFixed(2)} €
                                        </span>
                                        <span className="text-lg text-muted-foreground line-through">
                                          {product.price.toFixed(2)} €
                                        </span>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Économisez{" "}
                                        {(((product.price - getEffectivePrice(product)) / product.price) * 100).toFixed(
                                          0,
                                        )}
                                        %
                                      </p>
                                    </>
                                  ) : (
                                    <div className="text-2xl font-bold text-primary">{product.price.toFixed(2)} €</div>
                                  )}
                                </div>
                              </div>
                              {product.type === "custom_kit" ? (
                                <Button className="w-full" onClick={() => setSelectedKitProduct(product)}>
                                  <Settings className="h-4 w-4 mr-2" />
                                  Configurer
                                </Button>
                              ) : product.type === "simple" ? (
                                <Button className="w-full" onClick={() => setSelectedSimpleProduct(product)}>
                                  <ShoppingCart className="h-4 w-4 mr-2" />
                                  Ajouter au panier
                                </Button>
                              ) : (
                                <Button
                                  className="w-full"
                                  onClick={() => handleAddToCart(product.id, getEffectivePrice(product))}
                                >
                                  <ShoppingCart className="h-4 w-4 mr-2" />
                                  Ajouter au panier
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {user && (
            <TabsContent value="manage">
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des produits</CardTitle>
                  <CardDescription>Pour une gestion complète, accédez à l'administration</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => navigate("/admin/shop")}>
                    <Package className="h-4 w-4 mr-2" />
                    Accéder à l'administration de la boutique
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {selectedKitProduct && (
        <CustomKitConfigDialog
          productId={selectedKitProduct.id}
          productName={selectedKitProduct.name}
          basePrice={selectedKitProduct.price}
          open={!!selectedKitProduct}
          onOpenChange={(open) => !open && setSelectedKitProduct(null)}
          onAddToCart={handleAddKitToCart}
        />
      )}

      {selectedSimpleProduct && (
        <SimpleProductDialog
          open={!!selectedSimpleProduct}
          onOpenChange={(open) => !open && setSelectedSimpleProduct(null)}
          productId={selectedSimpleProduct.id}
          productName={selectedSimpleProduct.name}
          basePrice={getEffectivePrice(selectedSimpleProduct)}
          onAddToCart={handleAddSimpleProductToCart}
        />
      )}

      <ShoppingCartSidebar
        open={cart.cartOpen}
        onOpenChange={cart.setCartOpen}
        cartItems={cart.cartItems}
        totalPrice={cart.getTotalPrice()}
        onUpdateQuantity={cart.updateQuantity}
        onRemoveItem={cart.removeFromCart}
        onClearCart={cart.clearCart}
        onCheckout={handleCheckout}
      />

      <CustomerFormDialog
        open={customerFormOpen}
        onOpenChange={setCustomerFormOpen}
        onSubmit={handleCustomerFormSubmit}
        initialData={
          shopCustomer.customer
            ? {
                companyName: shopCustomer.customer.company_name,
                firstName: shopCustomer.customer.first_name,
                lastName: shopCustomer.customer.last_name,
                email: shopCustomer.customer.email,
                phone: shopCustomer.customer.phone,
                billingAddress: shopCustomer.customer.billing_address,
                billingPostalCode: shopCustomer.customer.billing_postal_code,
                billingCity: shopCustomer.customer.billing_city,
                billingCountry: shopCustomer.customer.billing_country,
                vatNumber: shopCustomer.customer.vat_number,
                shippingSameAsBilling: shopCustomer.customer.shipping_same_as_billing,
                shippingRecipientName: shopCustomer.customer.shipping_recipient_name,
                shippingAddress: shopCustomer.customer.shipping_address,
                shippingPostalCode: shopCustomer.customer.shipping_postal_code,
                shippingCity: shopCustomer.customer.shipping_city,
                shippingCountry: shopCustomer.customer.shipping_country,
              }
            : undefined
        }
      />

      {selectedProject && (
        <AddToProjectExpensesDialog
          open={addToProjectDialogOpen}
          onOpenChange={setAddToProjectDialogOpen}
          projectName={selectedProject.nom_proprietaire || "votre projet"}
          onConfirm={handleAddToProjectConfirm}
        />
      )}

      {pricingDialogProduct && (
        <ProductPricingDialog
          open={!!pricingDialogProduct}
          onClose={() => {
            setPricingDialogProduct(null);
            setRefreshKey((prev) => prev + 1);
          }}
          productId={pricingDialogProduct.id}
          productName={pricingDialogProduct.name}
          basePrice={pricingDialogProduct.price}
        />
      )}

      {kitPricingProduct && (
        <KitAccessoryPricingDialog
          open={!!kitPricingProduct}
          onClose={() => {
            setKitPricingProduct(null);
            setRefreshKey((prev) => prev + 1);
          }}
          productId={kitPricingProduct.id}
          productName={kitPricingProduct.name}
        />
      )}
    </div>
  );
};

export default Shop;
