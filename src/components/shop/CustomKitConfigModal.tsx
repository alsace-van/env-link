import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, X, Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCartContext } from "@/contexts/CartContext";
import { toast } from "sonner";

interface CustomKitConfigModalProps {
  productId: string | null;
  onClose: () => void;
}

interface Accessory {
  id: string;
  nom: string;
  marque: string;
  prix_vente_ttc: number;
  description: string;
  image_url: string;
  category_id: string;
}

interface CategorySection {
  id: string;
  categoryId: string;
  categoryName: string;
  selectedAccessoryId: string | null;
  accessories: Accessory[];
}

export const CustomKitConfigModal = ({ productId, onClose }: CustomKitConfigModalProps) => {
  const { addToCart } = useCartContext();
  const [product, setProduct] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [sections, setSections] = useState<CategorySection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productId) {
      loadProductAndAccessories();
    }
  }, [productId]);

  const loadProductAndAccessories = async () => {
    if (!productId) return;

    setLoading(true);

    // Charger le produit
    const { data: productData } = await supabase
      .from("shop_products" as any)
      .select("*")
      .eq("id", productId)
      .single();

    if (productData) {
      setProduct(productData);

      // Charger les accessoires du kit
      const { data: kitAccessories } = await supabase
        .from("shop_product_items" as any)
        .select("accessory_id")
        .eq("shop_product_id", productId);

      if (kitAccessories && kitAccessories.length > 0) {
        const accessoryIds = kitAccessories.map((ka: any) => ka.accessory_id);

        // Charger les accessoires avec leurs catégories
        const { data: accessoriesData } = await supabase
          .from("accessories_catalog" as any)
          .select("id, nom, marque, prix_vente_ttc, description, image_url, category_id")
          .in("id", accessoryIds);

        if (accessoriesData) {
          setAccessories(accessoriesData);

          // Charger les catégories uniques
          const categoryIds = [...new Set(accessoriesData.map((a: any) => a.category_id).filter(Boolean))];

          if (categoryIds.length > 0) {
            const { data: categoriesData } = await supabase
              .from("categories" as any)
              .select("id, nom")
              .in("id", categoryIds);

            if (categoriesData) {
              setCategories(categoriesData);

              // Créer une section initiale pour chaque catégorie
              const initialSections = categoriesData.map((cat: any, index: number) => ({
                id: `section-${index}-${Date.now()}`,
                categoryId: cat.id,
                categoryName: cat.nom,
                selectedAccessoryId: null,
                accessories: accessoriesData.filter((acc: any) => acc.category_id === cat.id),
              }));

              setSections(initialSections);
            }
          }
        }
      }
    }

    setLoading(false);
  };

  const duplicateSection = (sectionId: string) => {
    const sectionToDuplicate = sections.find((s) => s.id === sectionId);
    if (!sectionToDuplicate) return;

    const newSection: CategorySection = {
      ...sectionToDuplicate,
      id: `section-${sections.length}-${Date.now()}`,
      selectedAccessoryId: null,
    };

    setSections([...sections, newSection]);
  };

  const removeSection = (sectionId: string) => {
    // Ne pas permettre de supprimer s'il ne reste qu'une section
    if (sections.length <= 1) {
      toast.error("Au moins une catégorie doit être présente");
      return;
    }
    setSections(sections.filter((s) => s.id !== sectionId));
  };

  const updateSectionAccessory = (sectionId: string, accessoryId: string) => {
    setSections(sections.map((s) => (s.id === sectionId ? { ...s, selectedAccessoryId: accessoryId } : s)));
  };

  const calculateTotal = () => {
    const basePrice = product?.prix_base || 0;
    const accessoriesTotal = sections.reduce((total, section) => {
      if (section.selectedAccessoryId) {
        const accessory = section.accessories.find((a) => a.id === section.selectedAccessoryId);
        return total + (accessory?.prix_vente_ttc || 0);
      }
      return total;
    }, 0);

    return basePrice + accessoriesTotal;
  };

  const getSelectedAccessoryDetails = (section: CategorySection) => {
    if (!section.selectedAccessoryId) return null;
    return section.accessories.find((a) => a.id === section.selectedAccessoryId);
  };

  const handleAddToCart = () => {
    const selectedCount = sections.filter((s) => s.selectedAccessoryId).length;

    if (selectedCount === 0) {
      toast.error("Veuillez sélectionner au moins un accessoire");
      return;
    }

    const configuration = {
      customKit: true,
      sections: sections
        .map((s) => ({
          categoryId: s.categoryId,
          categoryName: s.categoryName,
          accessoryId: s.selectedAccessoryId,
        }))
        .filter((s) => s.accessoryId),
    };

    addToCart(product.id, calculateTotal(), 1, configuration);
    toast.success("Kit ajouté au panier");
    onClose();
  };

  if (!productId) return null;

  return (
    <Dialog open={!!productId} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        {loading ? (
          <div className="text-center py-12">Chargement...</div>
        ) : product ? (
          <div className="flex h-full">
            {/* Panneau gauche - Configuration */}
            <div className="flex-1 flex flex-col">
              <DialogHeader className="px-6 py-4 border-b">
                <DialogTitle className="text-xl">{product.nom}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Configurez votre kit en choisissant des accessoires. Vous pouvez dupliquer une catégorie pour ajouter
                  plusieurs articles différents.
                </p>
              </DialogHeader>

              <ScrollArea className="flex-1 px-6">
                <div className="py-4 space-y-4">
                  {sections.map((section, index) => {
                    const selectedAccessory = getSelectedAccessoryDetails(section);

                    return (
                      <div key={section.id} className="border rounded-lg p-4 bg-card">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{section.categoryName}</h3>
                            <Badge variant="secondary" className="text-xs">
                              {section.accessories.length} accessoires
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => duplicateSection(section.id)}
                              className="gap-2"
                            >
                              <Copy className="h-3 w-3" />
                              Dupliquer
                            </Button>
                            {sections.length > 1 && (
                              <Button variant="ghost" size="sm" onClick={() => removeSection(section.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium mb-2 block">Choix {index + 1}</label>
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground block">Accessoire</label>
                              <Select
                                value={section.selectedAccessoryId || ""}
                                onValueChange={(value) => updateSectionAccessory(section.id, value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  {section.accessories.map((accessory) => (
                                    <SelectItem key={accessory.id} value={accessory.id}>
                                      {accessory.nom} {accessory.marque ? `- ${accessory.marque}` : ""} (
                                      {(accessory.prix_vente_ttc || 0).toFixed(2)} €)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Afficher les détails de l'accessoire sélectionné */}
                          {selectedAccessory && (
                            <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                              {selectedAccessory.image_url && (
                                <img
                                  src={selectedAccessory.image_url}
                                  alt={selectedAccessory.nom}
                                  className="w-16 h-16 object-cover rounded"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{selectedAccessory.nom}</p>
                                {selectedAccessory.marque && (
                                  <p className="text-xs text-muted-foreground">{selectedAccessory.marque}</p>
                                )}
                                {selectedAccessory.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {selectedAccessory.description}
                                  </p>
                                )}
                                <p className="text-sm font-semibold text-primary mt-1">
                                  {(selectedAccessory.prix_vente_ttc || 0).toFixed(2)} €
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Panneau droit - Récapitulatif */}
            <div className="w-80 border-l bg-muted/20 flex flex-col">
              <div className="p-6">
                <h3 className="font-semibold mb-4">Récapitulatif</h3>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prix de base du kit</span>
                    <span className="font-medium">{(product.prix_base || 0).toFixed(2)} €</span>
                  </div>

                  <Separator />

                  {sections.filter((s) => s.selectedAccessoryId).length > 0 && (
                    <div className="space-y-2">
                      {sections.map((section) => {
                        const accessory = getSelectedAccessoryDetails(section);
                        if (!accessory) return null;

                        return (
                          <div key={section.id} className="text-sm">
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-muted-foreground flex-1 line-clamp-1">{accessory.nom}</span>
                              <span className="font-medium whitespace-nowrap">
                                {(accessory.prix_vente_ttc || 0).toFixed(2)} €
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {sections.filter((s) => s.selectedAccessoryId).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucun accessoire configuré</p>
                  )}
                </div>
              </div>

              <div className="mt-auto border-t p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-2xl font-bold text-primary">{calculateTotal().toFixed(2)} €</span>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handleAddToCart}
                    size="lg"
                    className="w-full gap-2"
                    disabled={sections.filter((s) => s.selectedAccessoryId).length === 0}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    Ajouter au panier
                  </Button>
                  <Button onClick={onClose} variant="outline" size="lg" className="w-full">
                    Annuler
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">Produit non trouvé</div>
        )}
      </DialogContent>
    </Dialog>
  );
};
