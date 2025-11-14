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

interface AccessoryOption {
  id: string;
  nom: string;
  prix_vente_ttc: number;
}

interface AccessoryWithCategory {
  id: string;
  nom: string;
  marque: string;
  prix_vente_ttc: number;
  description: string;
  image_url: string;
  category_id: string;
  promo_active: boolean | null;
  promo_price: number | null;
  promo_start_date: string | null;
  promo_end_date: string | null;
  couleur: string | null;
  options?: AccessoryOption[];
}

interface CategorySection {
  id: string;
  categoryId: string;
  categoryName: string;
  selectedAccessoryId: string | null;
  selectedOptions: { [accessoryId: string]: string[] };
  accessories: AccessoryWithCategory[];
}

export const CustomKitConfigModal = ({ productId, onClose }: CustomKitConfigModalProps) => {
  const { addToCart } = useCartContext();
  const [product, setProduct] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [accessories, setAccessories] = useState<AccessoryWithCategory[]>([]);
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
      const { data: kitAccessories, error: kitError } = await supabase
        .from("shop_product_items")
        .select("accessory_id")
        .eq("shop_product_id", productId);

      if (kitError) {
        console.error("Error loading kit accessories:", kitError);
        setLoading(false);
        return;
      }

      if (kitAccessories && kitAccessories.length > 0) {
        const accessoryIds = kitAccessories.map((ka) => ka.accessory_id);

        // Charger les accessoires avec toutes leurs données
        const { data: accessoriesData, error: accessoriesError } = await supabase
          .from("accessories_catalog")
          .select("id, nom, marque, prix_vente_ttc, description, image_url, category_id, promo_active, promo_price, promo_start_date, promo_end_date, couleur")
          .in("id", accessoryIds);

        if (accessoriesError) {
          console.error("Error loading accessories:", accessoriesError);
          setLoading(false);
          return;
        }

        if (accessoriesData) {
          // Charger les options pour chaque accessoire
          const { data: optionsData, error: optionsError } = await supabase
            .from("accessory_options")
            .select("id, nom, prix_vente_ttc, accessory_id")
            .in("accessory_id", accessoryIds);

          if (optionsError) {
            console.error("Error loading options:", optionsError);
          }

          // Associer les options aux accessoires
          const accessoriesWithOptions: AccessoryWithCategory[] = accessoriesData.map((acc) => ({
            id: acc.id,
            nom: acc.nom,
            marque: acc.marque || "",
            prix_vente_ttc: acc.prix_vente_ttc || 0,
            description: acc.description || "",
            image_url: acc.image_url || "",
            category_id: acc.category_id || "",
            promo_active: acc.promo_active,
            promo_price: acc.promo_price,
            promo_start_date: acc.promo_start_date,
            promo_end_date: acc.promo_end_date,
            couleur: acc.couleur,
            options: optionsData?.filter((opt) => opt.accessory_id === acc.id).map(opt => ({
              id: opt.id,
              nom: opt.nom,
              prix_vente_ttc: opt.prix_vente_ttc || 0
            })) || [],
          }));

          setAccessories(accessoriesWithOptions);

          // Charger les catégories uniques
          const categoryIds = [...new Set(accessoriesData.map((a) => a.category_id).filter(Boolean))] as string[];

          if (categoryIds.length > 0) {
            const { data: categoriesData, error: categoriesError } = await supabase
              .from("categories")
              .select("id, nom")
              .in("id", categoryIds);

            if (categoriesError) {
              console.error("Error loading categories:", categoriesError);
              setLoading(false);
              return;
            }

            if (categoriesData) {
              setCategories(categoriesData);

              // Créer une section initiale pour chaque catégorie
              const initialSections: CategorySection[] = categoriesData.map((cat, index) => ({
                id: `section-${index}-${Date.now()}`,
                categoryId: cat.id,
                categoryName: cat.nom,
                selectedAccessoryId: null,
                selectedOptions: {},
                accessories: accessoriesWithOptions.filter((acc) => acc.category_id === cat.id),
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
      selectedOptions: {},
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

  const updateSectionOptions = (sectionId: string, accessoryId: string, optionIds: string[]) => {
    setSections(
      sections.map((s) =>
        s.id === sectionId ? { ...s, selectedOptions: { ...s.selectedOptions, [accessoryId]: optionIds } } : s
      )
    );
  };

  const getAccessoryPrice = (accessory: AccessoryWithCategory) => {
    if (accessory.promo_active && accessory.promo_price) {
      const now = new Date();
      const startDate = accessory.promo_start_date ? new Date(accessory.promo_start_date) : null;
      const endDate = accessory.promo_end_date ? new Date(accessory.promo_end_date) : null;

      if ((!startDate || now >= startDate) && (!endDate || now <= endDate)) {
        return accessory.promo_price;
      }
    }
    return accessory.prix_vente_ttc;
  };

  const calculateTotal = () => {
    const basePrice = product?.prix_base || 0;
    const accessoriesTotal = sections.reduce((total, section) => {
      if (section.selectedAccessoryId) {
        const accessory = section.accessories.find((a) => a.id === section.selectedAccessoryId);
        if (!accessory) return total;

        let accessoryPrice = getAccessoryPrice(accessory);

        // Ajouter le prix des options sélectionnées
        const selectedOptions = section.selectedOptions[section.selectedAccessoryId] || [];
        const optionsPrice = selectedOptions.reduce((optTotal, optId) => {
          const option = accessory.options?.find((o) => o.id === optId);
          return optTotal + (option?.prix_vente_ttc || 0);
        }, 0);

        return total + accessoryPrice + optionsPrice;
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
          selectedOptions: s.selectedOptions[s.selectedAccessoryId!] || [],
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
                      <div key={section.id} className="rounded-xl border-2 border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden transition-all hover:border-primary/30">
                        <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-5 py-4 flex items-center justify-between border-b">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <span className="text-xl font-bold text-primary">{index + 1}</span>
                            </div>
                            <div>
                              <h3 className="font-bold text-lg">{section.categoryName}</h3>
                              <p className="text-xs text-muted-foreground">
                                {section.accessories.length} accessoire{section.accessories.length > 1 ? 's' : ''} disponible{section.accessories.length > 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => duplicateSection(section.id)}
                              className="gap-2 hover:bg-primary/10"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Dupliquer
                            </Button>
                            {sections.length > 1 && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => removeSection(section.id)}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="p-5 space-y-4">
                          <div>
                            <label className="text-sm font-semibold mb-3 block text-foreground">
                              Sélectionnez un accessoire
                            </label>
                            <Select
                              value={section.selectedAccessoryId || ""}
                              onValueChange={(value) => updateSectionAccessory(section.id, value)}
                            >
                              <SelectTrigger className="h-12 text-base">
                                <SelectValue placeholder="Choisir un accessoire..." />
                              </SelectTrigger>
                                 <SelectContent>
                                  {section.accessories.map((accessory) => {
                                    const price = getAccessoryPrice(accessory);
                                    const isPromo = accessory.promo_active && price < accessory.prix_vente_ttc;
                                    return (
                                      <SelectItem key={accessory.id} value={accessory.id}>
                                        {accessory.nom} {accessory.marque ? `- ${accessory.marque}` : ""} (
                                        {isPromo && (
                                          <span className="line-through text-muted-foreground mr-1">
                                            {accessory.prix_vente_ttc.toFixed(2)} €
                                          </span>
                                        )}
                                        {price.toFixed(2)} €)
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Afficher les détails de l'accessoire sélectionné */}
                          {selectedAccessory && (
                            <>
                              <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4">
                                <div className="flex gap-4">
                                  {selectedAccessory.image_url && (
                                    <div className="flex-shrink-0">
                                      <img
                                        src={selectedAccessory.image_url}
                                        alt={selectedAccessory.nom}
                                        className="w-24 h-24 object-cover rounded-lg border-2 border-border shadow-sm"
                                      />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-base mb-1">{selectedAccessory.nom}</h4>
                                    {selectedAccessory.marque && (
                                      <p className="text-sm text-muted-foreground mb-2">
                                        <span className="font-medium">Marque:</span> {selectedAccessory.marque}
                                      </p>
                                    )}
                                    {selectedAccessory.description && (
                                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                        {selectedAccessory.description}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-3 mt-2">
                                      {selectedAccessory.couleur && (
                                        <div className="flex items-center gap-1.5 text-xs bg-background/50 px-2 py-1 rounded">
                                          <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: selectedAccessory.couleur }} />
                                          <span>{selectedAccessory.couleur}</span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2">
                                        {selectedAccessory.promo_active && 
                                         getAccessoryPrice(selectedAccessory) < selectedAccessory.prix_vente_ttc && (
                                          <>
                                            <span className="text-sm line-through text-muted-foreground">
                                              {selectedAccessory.prix_vente_ttc.toFixed(2)} €
                                            </span>
                                            <Badge variant="destructive" className="text-xs">PROMO</Badge>
                                          </>
                                        )}
                                        <p className="text-xl font-bold text-primary">
                                          {getAccessoryPrice(selectedAccessory).toFixed(2)} €
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Options */}
                              {selectedAccessory.options && selectedAccessory.options.length > 0 && (
                                <div className="space-y-3 bg-muted/30 rounded-lg p-4">
                                  <label className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    Options disponibles
                                  </label>
                                  <div className="space-y-2.5">
                                    {selectedAccessory.options.map((option) => (
                                      <label 
                                        key={option.id} 
                                        className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5"
                                      >
                                        <input
                                          type="checkbox"
                                          className="w-4 h-4 rounded border-2 border-primary text-primary focus:ring-2 focus:ring-primary/20"
                                          checked={
                                            section.selectedOptions[selectedAccessory.id]?.includes(option.id) || false
                                          }
                                          onChange={(e) => {
                                            const currentOptions =
                                              section.selectedOptions[selectedAccessory.id] || [];
                                            const newOptions = e.target.checked
                                              ? [...currentOptions, option.id]
                                              : currentOptions.filter((id) => id !== option.id);
                                            updateSectionOptions(section.id, selectedAccessory.id, newOptions);
                                          }}
                                        />
                                        <div className="flex-1 flex items-center justify-between">
                                          <span className="text-sm font-medium">{option.nom}</span>
                                          <span className="text-sm font-bold text-primary">
                                            +{option.prix_vente_ttc.toFixed(2)} €
                                          </span>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Panneau droit - Récapitulatif */}
            <div className="w-96 border-l bg-gradient-to-b from-muted/30 to-muted/10 flex flex-col">
              <div className="px-6 py-5 border-b bg-muted/20">
                <h3 className="font-bold text-xl text-foreground">Récapitulatif</h3>
                <p className="text-xs text-muted-foreground mt-1">Votre configuration</p>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center p-3 bg-background rounded-lg border">
                    <span className="text-sm font-medium text-muted-foreground">Prix de base du kit</span>
                    <span className="font-bold text-base">{(product.prix_base || 0).toFixed(2)} €</span>
                  </div>

                  <Separator className="my-4" />

                  {sections.filter((s) => s.selectedAccessoryId).length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Accessoires sélectionnés
                      </p>
                      {sections.map((section) => {
                        const accessory = getSelectedAccessoryDetails(section);
                        if (!accessory) return null;

                        const accessoryPrice = getAccessoryPrice(accessory);
                        const selectedOptions = section.selectedOptions[section.selectedAccessoryId!] || [];
                        const optionsPrice = selectedOptions.reduce((total, optId) => {
                          const option = accessory.options?.find((o) => o.id === optId);
                          return total + (option?.prix_vente_ttc || 0);
                        }, 0);

                        return (
                          <div key={section.id} className="bg-background rounded-lg p-3 border space-y-2">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm line-clamp-2">{accessory.nom}</p>
                                <p className="text-xs text-muted-foreground">{section.categoryName}</p>
                              </div>
                              <span className="font-bold text-base whitespace-nowrap text-primary">
                                {accessoryPrice.toFixed(2)} €
                              </span>
                            </div>
                            {selectedOptions.length > 0 && (
                              <div className="pl-3 pt-2 border-t space-y-1.5">
                                {selectedOptions.map((optId) => {
                                  const option = accessory.options?.find((o) => o.id === optId);
                                  if (!option) return null;
                                  return (
                                    <div key={optId} className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">+ {option.nom}</span>
                                      <span className="font-semibold text-primary">{option.prix_vente_ttc.toFixed(2)} €</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                        <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">Aucun accessoire sélectionné</p>
                      <p className="text-xs text-muted-foreground mt-1">Choisissez vos accessoires ci-dessus</p>
                    </div>
                  )}
                </div>
              </div>

              </ScrollArea>

              <div className="border-t bg-background/80 backdrop-blur-sm p-6 space-y-4">
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg">
                  <span className="text-base font-bold">Total TTC</span>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary">{calculateTotal().toFixed(2)} €</div>
                    {sections.filter((s) => s.selectedAccessoryId).length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {sections.filter((s) => s.selectedAccessoryId).length} accessoire(s) configuré(s)
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handleAddToCart}
                    size="lg"
                    className="w-full gap-2 h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
                    disabled={sections.filter((s) => s.selectedAccessoryId).length === 0}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    Ajouter au panier
                  </Button>
                  <Button 
                    onClick={onClose} 
                    variant="outline" 
                    size="lg" 
                    className="w-full h-11"
                  >
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
