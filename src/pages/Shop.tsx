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
import { useCart } from "@/hooks/useCart";
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
}

const Shop = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedKitProduct, setSelectedKitProduct] = useState<ShopProduct | null>(null);
  const [selectedSimpleProduct, setSelectedSimpleProduct] = useState<ShopProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [pricingDialogProduct, setPricingDialogProduct] = useState<ShopProduct | null>(null);
  const [kitPricingProduct, setKitPricingProduct] = useState<ShopProduct | null>(null);
  
  // Nouveaux états pour le checkout
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [addToProjectDialogOpen, setAddToProjectDialogOpen] = useState(false);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);

  const cart = useCart(user?.id);
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

    // Si un utilisateur est connecté, charger ses produits
    // Sinon, charger tous les produits actifs pour le catalogue public
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
      // Pour chaque produit simple, vérifier s'il a des options
      const productsWithOptions = await Promise.all(
        (data || []).map(async (product) => {
          if (product.type === "simple") {
            const hasOptions = await checkProductHasOptions(product.id);
            return { ...product, hasOptions };
          }
          return product;
        }),
      );
      setProducts(productsWithOptions);
    }
    setLoading(false);
  };

  const checkProductHasOptions = async (productId: string) => {
    // Récupérer l'accessoire du produit
    const { data: productItems } = await supabase
      .from("shop_product_items")
      .select("accessory_id")
      .eq("product_id", productId)
      .limit(1)
      .maybeSingle();

    if (!productItems) return false;

    // Vérifier s'il y a des options
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

  const handleAddToCart = async (productId: string, price: number) => {
    const success = await cart.addToCart(productId, price, 1);
    if (success) {
      cart.refresh();
    }
  };

  const handleAddSimpleProductToCart = async (
    totalPrice: number,
    selectedOptions: string[],
    optionsDetails?: any[],
  ) => {
    if (!selectedSimpleProduct) return;

    // Si on a les détails des options, on les stocke
    const configuration =
      selectedOptions.length > 0
        ? {
            selectedOptions: optionsDetails || selectedOptions.map((id) => ({ id, name: "Option", price: 0 })),
          }
        : undefined;

    const success = await cart.addToCart(selectedSimpleProduct.id, totalPrice, 1, configuration);
    if (success) {
      cart.refresh();
      setSelectedSimpleProduct(null);
    }
  };

  const handleAddKitToCart = async (configuration: any, totalPrice: number) => {
    if (!selectedKitProduct) return;
    const success = await cart.addToCart(selectedKitProduct.id, totalPrice, 1, configuration);
    if (success) {
      cart.refresh();
    }
  };

  // Charger les projets de l'utilisateur
  const loadUserProjects = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUserProjects(data || []);
      
      // Sélectionner automatiquement le premier projet s'il existe
      if (data && data.length > 0) {
        setSelectedProject(data[0]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des projets:", error);
    }
  };

  useEffect(() => {
    if (user) {
      loadUserProjects();
    }
  }, [user]);

  // Flow de checkout
  const handleCheckout = async () => {
    if (!user) {
      toast.error("Veuillez vous connecter pour passer commande");
      return;
    }

    if (cart.items.length === 0) {
      toast.error("Votre panier est vide");
      return;
    }

    // Étape 1 : Vérifier si l'utilisateur a complété ses infos client
    if (!shopCustomer.hasCustomerInfo) {
      setCustomerFormOpen(true);
      return;
    }

    // Étape 2 : Vérifier si l'utilisateur a un projet actif
    if (userProjects.length > 0 && selectedProject) {
      setAddToProjectDialogOpen(true);
    } else {
      // Pas de projet, passer directement au paiement
      proceedToPayment(null);
    }
  };

  // Soumettre les informations client
  const handleCustomerFormSubmit = async (formData: any) => {
    const success = await shopCustomer.createOrUpdateCustomer({
      company_name: formData.companyName,
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      billing_address: formData.billingAddress,
      billing_postal_code: formData.billingPostalCode,
      billing_city: formData.billingCity,
      billing_country: formData.billingCountry,
      vat_number: formData.vatNumber,
      shipping_same_as_billing: formData.shippingSameAsBilling,
      shipping_recipient_name: formData.shippingRecipientName,
      shipping_address: formData.shippingAddress,
      shipping_postal_code: formData.shippingPostalCode,
      shipping_city: formData.shippingCity,
      shipping_country: formData.shippingCountry,
    });

    if (success) {
      setCustomerFormOpen(false);
      
      // Continuer le flow : vérifier s'il y a un projet
      if (userProjects.length > 0 && selectedProject) {
        setAddToProjectDialogOpen(true);
      } else {
        proceedToPayment(null);
      }
    }
  };

  // Gérer la réponse pour l'ajout au projet
  const handleAddToProjectConfirm = (expenseType: "general" | "supplier" | null) => {
    proceedToPayment(expenseType);
  };

  // Créer ou récupérer le fournisseur "Alsace Van Creation"
  const getOrCreateSupplier = async () => {
    if (!user || !selectedProject) return null;

    try {
      // Chercher si le fournisseur existe déjà
      const { data: existingSupplier, error: searchError } = await supabase
        .from("suppliers")
        .select("*")
        .eq("user_id", user.id)
        .eq("nom", "Alsace Van Creation")
        .maybeSingle();

      if (searchError && searchError.code !== "PGRST116") {
        console.error("Erreur recherche fournisseur:", searchError);
        return null;
      }

      if (existingSupplier) {
        return existingSupplier.id;
      }

      // Créer le fournisseur s'il n'existe pas
      const { data: newSupplier, error: createError } = await supabase
        .from("suppliers")
        .insert({
          user_id: user.id,
          nom: "Alsace Van Creation",
          email: "alsacevancreation@hotmail.com",
        })
        .select()
        .single();

      if (createError) {
        console.error("Erreur création fournisseur:", createError);
        return null;
      }

      return newSupplier.id;
    } catch (error) {
      console.error("Erreur gestion fournisseur:", error);
      return null;
    }
  };

  // Procéder au paiement et créer la commande
  const proceedToPayment = async (expenseType: "general" | "supplier" | null) => {
    try {
      // Générer un numéro de commande
      const { data: orderNumberData } = await supabase.rpc("generate_order_number");
      const orderNumber = orderNumberData || `VPB-${Date.now()}`;

      // Créer la commande
      const { data: order, error: orderError } = await supabase
        .from("shop_orders")
        .insert({
          order_number: orderNumber,
          customer_id: shopCustomer.customer!.id,
          user_id: user!.id,
          total_amount: cart.totalPrice,
          status: "pending",
          project_id: expenseType ? selectedProject?.id : null,
          added_to_expenses: false,
          expense_type: expenseType,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Créer les lignes de commande
      const orderItems = cart.items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product?.name || "Produit",
        product_type: item.product?.type || "simple",
        unit_price: item.price_at_addition,
        quantity: item.quantity,
        subtotal: item.price_at_addition * item.quantity,
        configuration: item.configuration,
      }));

      const { error: itemsError } = await supabase
        .from("shop_order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Si l'utilisateur veut ajouter aux dépenses, le faire maintenant
      if (expenseType && selectedProject) {
        await addOrderToProjectExpenses(order.id, expenseType);
      }

      // Vider le panier
      await cart.clearCart();

      // Fermer les dialogs
      setCartOpen(false);
      setAddToProjectDialogOpen(false);

      toast.success(`Commande ${orderNumber} créée avec succès !`);
      
      // TODO: Rediriger vers Stripe pour le paiement
      toast.info("Redirection vers le paiement (à venir)");
      
    } catch (error) {
      console.error("Erreur lors de la création de la commande:", error);
      toast.error("Erreur lors de la création de la commande");
    }
  };

  // Ajouter la commande aux dépenses du projet
  const addOrderToProjectExpenses = async (orderId: string, expenseType: "general" | "supplier") => {
    try {
      // Récupérer les détails de la commande
      const { data: orderItems, error: itemsError } = await supabase
        .from("shop_order_items")
        .select("*")
        .eq("order_id", orderId);

      if (itemsError) throw itemsError;

      if (expenseType === "supplier") {
        // Ajouter aux dépenses fournisseur
        const supplierId = await getOrCreateSupplier();
        
        if (supplierId && orderItems) {
          const supplierExpenses = orderItems.map((item) => ({
            project_id: selectedProject!.id,
            supplier_id: supplierId,
            nom_accessoire: item.product_name,
            prix: item.unit_price,
            quantite: item.quantity,
            date_achat: new Date().toISOString().split("T")[0],
          }));

          const { error } = await supabase
            .from("supplier_expenses")
            .insert(supplierExpenses);

          if (error) throw error;
        }
      } else {
        // Ajouter aux dépenses générales
        if (orderItems) {
          const generalExpenses = orderItems.map((item) => ({
            project_id: selectedProject!.id,
            nom_accessoire: item.product_name,
            prix: item.unit_price,
            quantite: item.quantity,
            date_achat: new Date().toISOString().split("T")[0],
            fournisseur: "Alsace Van Creation",
          }));

          const { error } = await supabase
            .from("project_expenses")
            .insert(generalExpenses);

          if (error) throw error;
        }
      }

      // Marquer la commande comme ajoutée aux dépenses
      await supabase
        .from("shop_orders")
        .update({ added_to_expenses: true })
        .eq("id", orderId);

      toast.success("Achats ajoutés aux dépenses du projet");
    } catch (error) {
      console.error("Erreur lors de l'ajout aux dépenses:", error);
      toast.error("Erreur lors de l'ajout aux dépenses");
    }
  };

  const handleCheckoutOld = () => {
    toast.info("Fonctionnalité de paiement à venir");
    // TODO: Intégrer Stripe
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(user ? "/dashboard" : "/auth")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <img src={logo} alt="Alsace Van Création" className="h-20 w-auto object-contain" />
            <div className="flex-1">
              <h1 className="text-xl font-bold">Boutique</h1>
              <p className="text-sm text-muted-foreground">
                {user ? "Gérez vos produits en vente" : "Découvrez nos produits"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setCartOpen(true)} className="relative">
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Panier
                    {cart.getTotalItems() > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      >
                        {cart.getTotalItems()}
                      </Badge>
                    )}
                  </Button>
                  <UserMenu user={user} />
                </>
              ) : (
                <Button onClick={() => navigate("/auth")}>Se connecter</Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue={user ? "products" : "catalog"} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              {user && (
                <TabsTrigger value="products">
                  <Package className="h-4 w-4 mr-2" />
                  Mes Produits
                </TabsTrigger>
              )}
              <TabsTrigger value="catalog">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Catalogue Public
              </TabsTrigger>
            </TabsList>

            {user && <ShopProductFormDialog onSuccess={() => setRefreshKey((prev) => prev + 1)} />}
          </div>

          {user && (
            <TabsContent value="products" className="space-y-4">
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Chargement...</p>
                </div>
              ) : products.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">Vous n'avez pas encore créé de produits</p>
                    <ShopProductFormDialog
                      trigger={<Button>Créer votre premier produit</Button>}
                      onSuccess={() => setRefreshKey((prev) => prev + 1)}
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
                              {!product.is_active && <Badge variant="secondary">Inactif</Badge>}
                            </div>
                            <div className="flex gap-2 mb-2">
                              <Badge variant={getTypeColor(product.type) as any}>{getTypeLabel(product.type)}</Badge>
                            </div>
                          </div>
                        </div>
                        {product.description && (
                          <CardDescription className="line-clamp-2">{product.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Prix:</span>
                            <span className="text-lg font-semibold">{product.price.toFixed(2)} €</span>
                          </div>

                          <div className="flex gap-2">
                            <ShopProductFormDialog
                              trigger={
                                <Button variant="outline" size="sm" className="flex-1">
                                  <Edit className="h-4 w-4 mr-2" />
                                  Modifier
                                </Button>
                              }
                              editProduct={product}
                              onSuccess={() => setRefreshKey((prev) => prev + 1)}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                if (product.type === "custom_kit") {
                                  setKitPricingProduct(product);
                                } else {
                                  setPricingDialogProduct(product);
                                }
                              }}
                            >
                              <Percent className="h-4 w-4 mr-2" />
                              Tarifs
                            </Button>
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
                            <Button variant="outline" size="sm" onClick={() => handleDelete(product.id)}>
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
          )}

          <TabsContent value="catalog" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Catalogue public</CardTitle>
                <CardDescription>Les produits actifs visibles par vos clients</CardDescription>
              </CardHeader>
              <CardContent>
                {products.filter((p) => p.is_active).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Aucun produit actif dans votre boutique</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {products
                      .filter((p) => p.is_active)
                      .map((product) => (
                        <Card key={product.id}>
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
        open={cartOpen}
        onOpenChange={setCartOpen}
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
