import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { ShoppingCart, Package } from "lucide-react";
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

    const { data: productData } = await supabase
      .from("shop_products" as any)
      .select("*")
      .eq("id", productId)
      .single();

    if (productData) {
      setProduct(productData);

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
          const { data: optionsData, error: optionsError } = await supabase
            .from("accessory_options")
            .select("id, nom, prix_vente_ttc, accessory_id")
            .in("accessory_id", accessoryIds);

          if (optionsError) {
            console.error("Error loading options:", optionsError);
          }

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

  const toggleOption = (sectionId: string, accessoryId: string, optionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    const currentOptions = section.selectedOptions[accessoryId] || [];
    const newOptions = currentOptions.includes(optionId)
      ? currentOptions.filter((id) => id !== optionId)
      : [...currentOptions, optionId];

    updateSectionOptions(sectionId, accessoryId, newOptions);
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
    if (!product) return;

    const hasSelections = sections.some((s) => s.selectedAccessoryId);
    if (!hasSelections) {
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
      <DialogContent className="max-w-7xl max-h-[95vh] p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Chargement des accessoires...</p>
            </div>
          </div>
        ) : product ? (
          <div className="flex h-full max-h-[95vh]">
            <div className="flex-1 flex flex-col min-w-0">
              <DialogHeader className="px-6 py-5 border-b bg-muted/20">
                <DialogTitle className="text-2xl font-bold">{product.nom}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Personnalisez votre kit en sélectionnant les accessoires de votre choix dans chaque catégorie.
                </p>
              </DialogHeader>

              <ScrollArea className="flex-1">
                <div className="px-6 py-5">
                  <h3 className="text-lg font-semibold mb-4">Accessoires disponibles</h3>
                  <Accordion type="multiple" className="space-y-3">
                    {sections.map((section) => {
                      const selectedAccessory = getSelectedAccessoryDetails(section);
                      const selectedCount = section.selectedAccessoryId ? 1 : 0;

                      return (
                        <AccordionItem 
                          key={section.id} 
                          value={section.id}
                          className="rounded-xl border-2 border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden"
                        >
                          <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Package className="h-5 w-5 text-primary" />
                                </div>
                                <div className="text-left">
                                  <h3 className="font-bold text-base">{section.categoryName}</h3>
                                  <p className="text-xs text-muted-foreground">
                                    {section.accessories.length} accessoire{section.accessories.length > 1 ? 's' : ''} disponible{section.accessories.length > 1 ? 's' : ''}
                                  </p>
                                </div>
                              </div>
                              {selectedCount > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                  {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                          </AccordionTrigger>
                          
                          <AccordionContent className="px-5 pb-5 pt-2">
                            <div className="space-y-4">
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
                                          <div className="text-lg font-bold text-primary">
                                            {(() => {
                                              const price = getAccessoryPrice(selectedAccessory);
                                              const isPromo = selectedAccessory.promo_active && price < selectedAccessory.prix_vente_ttc;
                                              return (
                                                <>
                                                  {isPromo && (
                                                    <Badge variant="destructive" className="mr-2 text-xs">PROMO</Badge>
                                                  )}
                                                  {isPromo && (
                                                    <span className="line-through text-muted-foreground text-sm mr-2">
                                                      {selectedAccessory.prix_vente_ttc.toFixed(2)} €
                                                    </span>
                                                  )}
                                                  {price.toFixed(2)} €
                                                </>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {selectedAccessory.options && selectedAccessory.options.length > 0 && (
                                    <div className="space-y-3 bg-muted/30 rounded-lg p-4">
                                      <h4 className="font-semibold text-sm">Options disponibles</h4>
                                      {selectedAccessory.options.map((option) => {
                                        const isSelected = (section.selectedOptions[section.selectedAccessoryId!] || []).includes(option.id);
                                        return (
                                          <div key={option.id} className="flex items-center justify-between p-3 rounded-lg border bg-background hover:border-primary/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                              <Checkbox
                                                id={`option-${section.id}-${option.id}`}
                                                checked={isSelected}
                                                onCheckedChange={() => toggleOption(section.id, section.selectedAccessoryId!, option.id)}
                                              />
                                              <label
                                                htmlFor={`option-${section.id}-${option.id}`}
                                                className="text-sm font-medium cursor-pointer"
                                              >
                                                {option.nom}
                                              </label>
                                            </div>
                                            <span className="text-sm font-semibold text-primary">
                                              +{option.prix_vente_ttc.toFixed(2)} €
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </ScrollArea>
            </div>

            <div className="w-96 border-l bg-gradient-to-b from-muted/30 to-background flex flex-col">
              <div className="px-6 py-5 border-b">
                <h3 className="font-bold text-lg mb-1">Récapitulatif</h3>
                <p className="text-xs text-muted-foreground">Votre configuration personnalisée</p>
              </div>

              <ScrollArea className="flex-1 px-6 py-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-start pb-3 border-b">
                    <span className="text-sm font-medium">Prix de base</span>
                    <span className="font-bold">{(product.prix_base || 0).toFixed(2)} €</span>
                  </div>

                  {sections.map((section) => {
                    const selectedAccessory = getSelectedAccessoryDetails(section);
                    if (!selectedAccessory) return null;

                    const accessoryPrice = getAccessoryPrice(selectedAccessory);
                    const selectedOptions = section.selectedOptions[section.selectedAccessoryId!] || [];
                    const optionsTotal = selectedOptions.reduce((total, optId) => {
                      const option = selectedAccessory.options?.find((o) => o.id === optId);
                      return total + (option?.prix_vente_ttc || 0);
                    }, 0);

                    return (
                      <div key={section.id} className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">{section.categoryName}</p>
                            <p className="text-sm font-semibold truncate">{selectedAccessory.nom}</p>
                          </div>
                          <span className="font-semibold text-sm ml-2">{accessoryPrice.toFixed(2)} €</span>
                        </div>
                        {selectedOptions.length > 0 && (
                          <div className="pl-3 space-y-1">
                            {selectedOptions.map((optId) => {
                              const option = selectedAccessory.options?.find((o) => o.id === optId);
                              if (!option) return null;
                              return (
                                <div key={optId} className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">• {option.nom}</span>
                                  <span className="font-medium">+{option.prix_vente_ttc.toFixed(2)} €</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="px-6 py-5 border-t bg-muted/30 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-3xl font-bold text-primary">{calculateTotal().toFixed(2)} €</span>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Button
                    onClick={handleAddToCart}
                    className="w-full h-12 text-base font-semibold shadow-lg"
                    size="lg"
                  >
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Configurer le kit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="w-full"
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Produit introuvable</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
