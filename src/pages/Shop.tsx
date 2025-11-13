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

interface CustomKit {
  id: string;
  nom: string;
  description: string;
  prix_base: number;
  is_active: boolean;
  created_at: string;
  image_url?: string;
}

const Shop = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [customKits, setCustomKits] = useState<CustomKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedKit, setSelectedKit] = useState<CustomKit | null>(null);
  const [editingKit, setEditingKit] = useState<CustomKit | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      checkAdminStatus(user.id);
      loadCustomKits();
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

  const loadCustomKits = async () => {
    setLoading(true);

    try {
      const { data: kitsData, error: kitsError } = await supabase
        .from("shop_custom_kits")
        .select("*")
        .eq("is_active", true)
        .order("nom");

      if (kitsError) throw kitsError;

      // Utiliser une Map pour éviter les doublons
      const uniqueKits = new Map();
      (kitsData || []).forEach((kit: any) => {
        if (!uniqueKits.has(kit.id)) {
          uniqueKits.set(kit.id, {
            id: kit.id,
            nom: kit.nom,
            description: kit.description || "",
            prix_base: kit.prix_base || 0,
            is_active: kit.is_active,
            created_at: kit.created_at,
            image_url: kit.image_url,
          });
        }
      });

      setCustomKits(Array.from(uniqueKits.values()));
    } catch (error: any) {
      console.error("Erreur lors du chargement des kits:", error);
      toast.error("Erreur lors du chargement des produits");
    } finally {
      setLoading(false);
    }
  };

  const handleEditKit = (kit: CustomKit) => {
    setEditingKit(kit);
    setIsEditDialogOpen(true);
  };

  const handleDeleteKit = async (kitId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce kit ?")) return;

    try {
      const { error } = await supabase
        .from("shop_custom_kits")
        .delete()
        .eq("id", kitId);

      if (error) throw error;

      toast.success("Kit supprimé avec succès");
      setRefreshKey((prev) => prev + 1);
    } catch (error: any) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression du kit");
    }
  };

  const handleToggleActive = async (kitId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("shop_custom_kits")
        .update({ is_active: !currentStatus })
        .eq("id", kitId);

      if (error) throw error;

      toast.success(
        !currentStatus ? "Kit activé avec succès" : "Kit désactivé avec succès"
      );
      setRefreshKey((prev) => prev + 1);
    } catch (error: any) {
      console.error("Erreur lors de la mise à jour:", error);
      toast.error("Erreur lors de la mise à jour du statut");
    }
  };

  const handleKitClick = (kit: CustomKit) => {
    setSelectedKit(kit);
  };

  const handleAddToCart = (configuration: any, totalPrice: number) => {
    console.log("Configuration ajoutée au panier:", configuration, totalPrice);
    toast.success("Configuration ajoutée au panier");
    setSelectedKit(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <img src={logo} alt="Logo" className="h-10" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Boutique</h1>
                <p className="text-sm text-muted-foreground">
                  Kits électriques personnalisables
                </p>
              </div>
            </div>
            {isAdmin && (
              <Button
                onClick={() => {
                  setEditingKit(null);
                  setIsEditDialogOpen(true);
                }}
                className="gap-2"
              >
                <Package className="h-4 w-4" />
                Gérer les produits
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {customKits.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Aucun kit disponible pour le moment
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customKits.map((kit) => (
              <Card key={kit.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-video bg-muted relative">
                  {kit.image_url ? (
                    <img
                      src={kit.image_url}
                      alt={kit.nom}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <Badge className="absolute top-2 right-2">Kit sur mesure</Badge>
                </div>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{kit.nom}</span>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditKit(kit);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteKit(kit.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(kit.id, kit.is_active);
                          }}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </CardTitle>
                  <CardDescription>{kit.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">
                      À partir de {kit.prix_base.toFixed(2)} €
                    </span>
                    <Button onClick={() => handleKitClick(kit)}>
                      Configurer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ShopProductFormDialog
        editProduct={editingKit}
        onSuccess={() => {
          setRefreshKey((prev) => prev + 1);
          setEditingKit(null);
          setIsEditDialogOpen(false);
        }}
        forceOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingKit(null);
        }}
      />

      {selectedKit && (
        <CustomKitConfigDialog
          productId={selectedKit.id}
          productName={selectedKit.nom}
          basePrice={selectedKit.prix_base}
          open={!!selectedKit}
          onOpenChange={(open) => !open && setSelectedKit(null)}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  );
};

export default Shop;
