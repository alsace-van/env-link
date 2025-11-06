import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Trash2, Filter, Package } from "lucide-react";
import { toast } from "sonner";
import AccessoryCategorySidebar from "@/components/AccessoryCategorySidebar";
import { ShippingFeesSidebar } from "@/components/ShippingFeesSidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ShippingFeeInfo {
  id: string;
  nom: string;
  type: string;
  fixed_price: number | null;
  visible_boutique: boolean;
  visible_depenses: boolean;
}

interface Accessory {
  id: string;
  nom: string;
  prix_reference: number | null;
  description: string | null;
  fournisseur: string | null;
  url_produit: string | null;
  created_at: string;
  category_id: string | null;
  shipping_fee?: ShippingFeeInfo | null;
}

const AccessoriesCatalog = () => {
  const navigate = useNavigate();
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [filteredAccessories, setFilteredAccessories] = useState<Accessory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isShippingSidebarOpen, setIsShippingSidebarOpen] = useState(false);

  useEffect(() => {
    loadAccessories();
  }, []);

  useEffect(() => {
    let filtered = accessories;

    if (searchTerm) {
      filtered = filtered.filter(
        (acc) =>
          acc.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
          acc.fournisseur?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (selectedCategories.length > 0) {
      filtered = filtered.filter((acc) => acc.category_id && selectedCategories.includes(acc.category_id));
    }

    setFilteredAccessories(filtered);
  }, [searchTerm, accessories, selectedCategories]);

  const loadAccessories = async () => {
    setLoading(true);
    try {
      const { data: accessoriesData, error: accessoriesError } = await supabase
        .from("accessories_catalog")
        .select("*")
        .order("created_at", { ascending: false });

      if (accessoriesError) throw accessoriesError;

      const accessoriesWithShipping = await Promise.all(
        (accessoriesData || []).map(async (acc) => {
          const { data: shippingLink } = await supabase
            .from("accessory_shipping_fees")
            .select(
              `
              id,
              visible_boutique,
              visible_depenses,
              shipping_fees:shipping_fee_id (
                id,
                nom,
                type,
                fixed_price
              )
            `,
            )
            .eq("accessory_id", acc.id)
            .maybeSingle();

          let shippingFee = null;
          if (shippingLink && shippingLink.shipping_fees) {
            const fee: any = shippingLink.shipping_fees;
            shippingFee = {
              id: fee.id,
              nom: fee.nom,
              type: fee.type,
              fixed_price: fee.fixed_price,
              visible_boutique: shippingLink.visible_boutique,
              visible_depenses: shippingLink.visible_depenses,
            };
          }

          return {
            ...acc,
            shipping_fee: shippingFee,
          };
        }),
      );

      setAccessories(accessoriesWithShipping);
      setFilteredAccessories(accessoriesWithShipping);
    } catch (error: any) {
      toast.error("Erreur lors du chargement du catalogue");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("accessories_catalog").delete().eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    } else {
      toast.success("Accessoire supprimé du catalogue");
      loadAccessories();
    }
    setDeleteId(null);
  };

  const getCategoryFromName = (name: string) => {
    const parts = name.split(" - ");
    return parts.length > 1 ? parts[0] : null;
  };

  const getShippingBadge = (fee: ShippingFeeInfo) => {
    if (fee.type === "free") {
      return (
        <Badge variant="outline" className="gap-1">
          <Package className="h-3 w-3" />
          Gratuit
        </Badge>
      );
    }
    if (fee.type === "pickup") {
      return (
        <Badge variant="outline" className="gap-1">
          <Package className="h-3 w-3" />
          Retrait
        </Badge>
      );
    }
    if (fee.type === "fixed" && fee.fixed_price) {
      return (
        <Badge variant="outline" className="gap-1">
          <Package className="h-3 w-3" />
          {fee.fixed_price.toFixed(2)} €
        </Badge>
      );
    }
    if (fee.type === "variable") {
      return (
        <Badge variant="outline" className="gap-1">
          <Package className="h-3 w-3" />
          Variable
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Package className="h-3 w-3" />
        Frais
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <h1 className="text-3xl font-bold">Catalogue d'accessoires</h1>
        </div>

        <div className="mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un accessoire..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={() => setIsSidebarOpen(true)} className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Catégories
            {selectedCategories.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedCategories.length}
              </Badge>
            )}
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">Chargement...</div>
        ) : filteredAccessories.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                {searchTerm || selectedCategories.length > 0
                  ? "Aucun accessoire trouvé"
                  : "Aucun accessoire dans le catalogue"}
              </p>
              <p className="text-sm text-muted-foreground">
                Ajoutez des accessoires depuis vos projets avec le bouton "Ajouter au catalogue"
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccessories.map((accessory) => {
              const category = getCategoryFromName(accessory.nom);
              return (
                <Card key={accessory.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{accessory.nom}</CardTitle>
                        <div className="flex gap-2 mb-2 flex-wrap">
                          {category && <Badge variant="secondary">{category}</Badge>}
                          {accessory.shipping_fee && getShippingBadge(accessory.shipping_fee)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(accessory.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {accessory.description && <CardDescription>{accessory.description}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {accessory.prix_reference && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Prix de référence:</span>
                          <span className="font-medium">{accessory.prix_reference.toFixed(2)} €</span>
                        </div>
                      )}
                      {accessory.fournisseur && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fournisseur:</span>
                          <span>{accessory.fournisseur}</span>
                        </div>
                      )}
                      {accessory.shipping_fee && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frais de port:</span>
                          <span className="text-xs">
                            {accessory.shipping_fee.visible_boutique && "🏪 "}
                            {accessory.shipping_fee.visible_depenses && "👁️ "}
                            {accessory.shipping_fee.nom}
                          </span>
                        </div>
                      )}
                      {accessory.url_produit && (
                        <div>
                          <a
                            href={accessory.url_produit}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Voir le produit
                          </a>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <AccessoryCategorySidebar
          selectedCategories={selectedCategories}
          onCategoryChange={setSelectedCategories}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <ShippingFeesSidebar
          isOpen={isShippingSidebarOpen}
          onClose={() => setIsShippingSidebarOpen(false)}
          onFeesChange={loadAccessories}
        />

        {/* Bouton rond fixe pour les frais de port */}
        <Button
          onClick={() => setIsShippingSidebarOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50"
          title="Gérer les frais de port"
        >
          <Package className="h-6 w-6" />
        </Button>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer cet accessoire du catalogue ? Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteId && handleDelete(deleteId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default AccessoriesCatalog;
