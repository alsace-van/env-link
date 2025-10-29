import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Category {
  id: string;
  nom: string;
}

interface Accessory {
  id: string;
  nom: string;
  marque?: string;
  prix_vente_ttc?: number;
  category_id: string;
}

interface CustomKitConfigDialogProps {
  productId: string;
  productName: string;
  basePrice: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CustomKitConfigDialog = ({
  productId,
  productName,
  basePrice,
  open,
  onOpenChange,
}: CustomKitConfigDialogProps) => {
  const [allowedCategories, setAllowedCategories] = useState<Category[]>([]);
  const [accessoriesByCategory, setAccessoriesByCategory] = useState<Map<string, Accessory[]>>(new Map());
  const [selectedAccessories, setSelectedAccessories] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadKitConfiguration();
    }
  }, [open, productId]);

  const loadKitConfiguration = async () => {
    setLoading(true);

    // Charger la configuration du kit
    const { data: kitData, error: kitError } = await supabase
      .from("shop_custom_kits")
      .select("allowed_category_ids")
      .eq("product_id", productId)
      .single();

    if (kitError) {
      console.error("Erreur lors du chargement du kit:", kitError);
      toast.error("Erreur lors du chargement de la configuration");
      setLoading(false);
      return;
    }

    const categoryIds = kitData?.allowed_category_ids || [];

    if (categoryIds.length === 0) {
      toast.error("Aucune catégorie configurée pour ce kit");
      setLoading(false);
      return;
    }

    // Charger les catégories autorisées
    const { data: categoriesData, error: categoriesError } = await supabase
      .from("categories")
      .select("id, nom")
      .in("id", categoryIds);

    if (categoriesError) {
      console.error("Erreur lors du chargement des catégories:", categoriesError);
      toast.error("Erreur lors du chargement des catégories");
      setLoading(false);
      return;
    }

    setAllowedCategories(categoriesData || []);

    // Charger les accessoires disponibles pour chaque catégorie
    const { data: accessoriesData, error: accessoriesError } = await supabase
      .from("accessories_catalog")
      .select("id, nom, marque, prix_vente_ttc, category_id")
      .in("category_id", categoryIds)
      .eq("available_in_shop", true);

    if (accessoriesError) {
      console.error("Erreur lors du chargement des accessoires:", accessoriesError);
      toast.error("Erreur lors du chargement des accessoires");
      setLoading(false);
      return;
    }

    // Regrouper les accessoires par catégorie
    const accessoriesMap = new Map<string, Accessory[]>();
    (accessoriesData || []).forEach((accessory) => {
      const categoryId = accessory.category_id;
      if (!accessoriesMap.has(categoryId)) {
        accessoriesMap.set(categoryId, []);
      }
      accessoriesMap.get(categoryId)!.push(accessory);
    });

    setAccessoriesByCategory(accessoriesMap);
    setLoading(false);
  };

  const handleSelectAccessory = (categoryId: string, accessoryId: string) => {
    setSelectedAccessories((prev) => {
      const newMap = new Map(prev);
      if (newMap.get(categoryId) === accessoryId) {
        newMap.delete(categoryId);
      } else {
        newMap.set(categoryId, accessoryId);
      }
      return newMap;
    });
  };

  const calculateTotalPrice = () => {
    let total = basePrice;
    selectedAccessories.forEach((accessoryId) => {
      // Trouver l'accessoire dans toutes les catégories
      for (const accessories of accessoriesByCategory.values()) {
        const accessory = accessories.find((a) => a.id === accessoryId);
        if (accessory && accessory.prix_vente_ttc) {
          total += accessory.prix_vente_ttc;
          break;
        }
      }
    });
    return total;
  };

  const handleAddToCart = () => {
    // TODO: Implémenter l'ajout au panier
    toast.success("Fonctionnalité panier à venir");
    onOpenChange(false);
  };

  const allCategoriesSelected = allowedCategories.every((category) =>
    selectedAccessories.has(category.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{productName}</DialogTitle>
          <DialogDescription>
            Configurez votre kit en sélectionnant un accessoire par catégorie
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Chargement de la configuration...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <ScrollArea className="h-[50vh]">
              <div className="space-y-6 pr-4">
                {allowedCategories.map((category) => {
                  const accessories = accessoriesByCategory.get(category.id) || [];
                  const selectedId = selectedAccessories.get(category.id);

                  return (
                    <div key={category.id}>
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-semibold">{category.nom}</h3>
                        {selectedId && (
                          <Badge variant="secondary">1 sélectionné</Badge>
                        )}
                      </div>

                      {accessories.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          Aucun accessoire disponible dans cette catégorie
                        </p>
                      ) : (
                        <div className="grid gap-2 md:grid-cols-2">
                          {accessories.map((accessory) => {
                            const isSelected = selectedId === accessory.id;
                            return (
                              <Card
                                key={accessory.id}
                                className={`cursor-pointer transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : "hover:border-primary/50"
                                }`}
                                onClick={() =>
                                  handleSelectAccessory(category.id, accessory.id)
                                }
                              >
                                <CardHeader className="p-4">
                                  <CardTitle className="text-sm flex items-start justify-between">
                                    <div>
                                      <div>{accessory.nom}</div>
                                      {accessory.marque && (
                                        <div className="text-xs text-muted-foreground font-normal mt-1">
                                          {accessory.marque}
                                        </div>
                                      )}
                                    </div>
                                    {accessory.prix_vente_ttc && (
                                      <div className="text-sm font-semibold">
                                        {accessory.prix_vente_ttc.toFixed(2)} €
                                      </div>
                                    )}
                                  </CardTitle>
                                </CardHeader>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                      <Separator className="mt-4" />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Total:</span>
                <span className="text-2xl text-primary">
                  {calculateTotalPrice().toFixed(2)} €
                </span>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={!allCategoriesSelected}
                onClick={handleAddToCart}
              >
                {allCategoriesSelected
                  ? "Ajouter au panier"
                  : "Sélectionnez un accessoire par catégorie"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CustomKitConfigDialog;
