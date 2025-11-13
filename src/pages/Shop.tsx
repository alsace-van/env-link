import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AccessoiresShopList } from "@/components/AccessoiresShopList";
import { ShopProductFormDialog } from "@/components/ShopProductFormDialog";
import CustomKitConfigDialog from "@/components/CustomKitConfigDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ShoppingBag, Settings, Package, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

interface Project {
  id: string;
  nom: string;
}

interface ShopProduct {
  id: string;
  name: string;
  description: string | null;
  type: "simple" | "composed" | "custom_kit";
  price: number;
  is_active: boolean;
  base_price?: number;
}

const Shop = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([]);
  const [refreshProducts, setRefreshProducts] = useState(0);
  const [selectedKit, setSelectedKit] = useState<ShopProduct | null>(null);
  const [isKitDialogOpen, setIsKitDialogOpen] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadShopProducts();
    }
  }, [user, refreshProducts]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
    } else {
      setUser(session.user);
      await loadProjects(session.user.id);
      await checkAdminStatus(session.user.id);
    }
    setLoading(false);
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

  const loadShopProducts = async () => {
    try {
      // Charger les produits simples et composés
      const { data: productsData, error: productsError } = await supabase
        .from("shop_products" as any)
        .select("*")
        .eq("is_active", true)
        .order("name") as any;

      if (productsError) throw productsError;

      // Charger les kits sur-mesure
      const { data: kitsData, error: kitsError } = await supabase
        .from("shop_custom_kits")
        .select("*")
        .eq("is_active", true)
        .order("nom");

      if (kitsError) throw kitsError;

      // Fusionner les deux listes
      const allProducts: ShopProduct[] = [
        ...(productsData || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          type: p.type,
          price: p.price || 0,
          is_active: p.is_active,
        })),
        ...(kitsData || []).map((k: any) => ({
          id: k.id,
          name: k.nom,
          description: k.description,
          type: "custom_kit" as const,
          price: 0,
          is_active: k.is_active,
          base_price: k.prix_base,
        })),
      ];

      setShopProducts(allProducts);
    } catch (error) {
      console.error("Erreur chargement produits:", error);
    }
  };

  const loadProjects = async (userId: string) => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, nom")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement des projets:", error);
      toast.error("Erreur lors du chargement des projets");
      return;
    }

    setProjects(data || []);
    if (data && data.length > 0) {
      setSelectedProjectId(data[0].id);
    }
  };

  const handleAddToProject = async (items: any[]) => {
    if (!selectedProjectId) {
      toast.error("Veuillez sélectionner un projet");
      return;
    }

    try {
      const expenses = items.map((item) => ({
        project_id: selectedProjectId,
        user_id: user.id,
        accessory_id: item.accessory_id,
        nom_accessoire: item.nom,
        marque: item.marque,
        quantite: item.quantity,
        prix_unitaire: item.prix_unitaire,
        prix_vente_ttc: item.prix_vente_ttc,
        total_amount: item.total,
        fournisseur: item.fournisseur,
        categorie: "Accessoires",
        expense_date: new Date().toISOString().split('T')[0],
        statut_livraison: "commande",
        statut_paiement: "pending",
      }));

      const { error } = await supabase
        .from("project_expenses")
        .insert(expenses);

      if (error) throw error;

      toast.success(`${items.length} article(s) ajouté(s) au projet`);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'ajout au projet");
    }
  };

  const handleDeleteKit = async (kitId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce kit sur-mesure ?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("shop_custom_kits")
        .delete()
        .eq("id", kitId);

      if (error) throw error;

      toast.success("Kit sur-mesure supprimé avec succès");
      setRefreshProducts(prev => prev + 1);
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression du kit");
    }
  };

  const handleEditKit = (kit: ShopProduct) => {
    // Pour l'instant, on affiche simplement un toast
    // À développer: ouvrir un dialog d'édition
    toast.info("Fonctionnalité d'édition en développement");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <img 
              src={logo} 
              alt="Alsace Van Création" 
              className="h-16 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Boutique</h1>
            {isAdmin && (
              <ShopProductFormDialog
                trigger={
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Gérer les produits
                  </Button>
                }
                onSuccess={() => setRefreshProducts(prev => prev + 1)}
              />
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {projects.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              Vous devez créer un projet avant de pouvoir faire des achats dans la boutique.
            </p>
            <Button onClick={() => navigate("/dashboard")}>
              Créer un projet
            </Button>
          </Card>
        ) : (
          <>
            <div className="mb-6">
              <label className="text-sm font-medium mb-2 block">
                Sélectionnez le projet pour vos achats
              </label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Choisir un projet" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProjectId && (
              <Tabs defaultValue="products" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="products">Produits configurés</TabsTrigger>
                  <TabsTrigger value="accessories">Accessoires simples</TabsTrigger>
                </TabsList>
                
                <TabsContent value="products" className="space-y-4 mt-6">
                  {shopProducts.length === 0 ? (
                    <Card>
                      <CardContent className="pt-6 text-center">
                        <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          Aucun produit configuré pour le moment.
                        </p>
                        {isAdmin && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Utilisez le bouton "Gérer les produits" pour créer des articles, bundles ou kits sur-mesure.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {shopProducts.map((product) => (
                        <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-lg">{product.name}</CardTitle>
                                {product.type === "custom_kit" && (
                                  <Badge variant="secondary" className="mt-1">
                                    Kit sur-mesure
                                  </Badge>
                                )}
                                {product.type === "composed" && (
                                  <Badge variant="secondary" className="mt-1">
                                    Bundle
                                  </Badge>
                                )}
                              </div>
                              {product.type !== "custom_kit" && (
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-primary">
                                    {product.price.toFixed(2)} €
                                  </p>
                                </div>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            {product.description && (
                              <CardDescription className="mb-4">
                                {product.description}
                              </CardDescription>
                            )}
                            <div className="space-y-2">
                              <Button 
                                className="w-full"
                                onClick={() => {
                                  if (product.type === "custom_kit") {
                                    setSelectedKit(product);
                                    setIsKitDialogOpen(true);
                                  } else {
                                    toast.info("Fonctionnalité en développement");
                                  }
                                }}
                              >
                                <ShoppingBag className="h-4 w-4 mr-2" />
                                {product.type === "custom_kit" ? "Configurer" : "Ajouter au panier"}
                              </Button>
                              
                              {isAdmin && product.type === "custom_kit" && (
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleEditKit(product)}
                                  >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Modifier
                                  </Button>
                                  <Button 
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleDeleteKit(product.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Supprimer
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="accessories" className="mt-6">
                  <AccessoiresShopList
                    projectId={selectedProjectId}
                    onAddToProject={handleAddToProject}
                  />
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </main>

      {selectedKit && (
        <CustomKitConfigDialog
          productId={selectedKit.id}
          productName={selectedKit.name}
          basePrice={selectedKit.base_price || 0}
          open={isKitDialogOpen}
          onOpenChange={setIsKitDialogOpen}
          onAddToCart={(config, totalPrice) => {
            toast.success(`Kit ajouté : ${totalPrice.toFixed(2)} €`);
            setIsKitDialogOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default Shop;
