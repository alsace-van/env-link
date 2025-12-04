import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { ShoppingCart, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  nom: string;
}

interface AccessoryOption {
  id: string;
  nom: string;
  prix_vente_ttc: number;
}

interface Accessory {
  id: string;
  nom: string;
  marque?: string;
  prix_vente_ttc?: number;
  category_id: string;
  description?: string;
  options?: AccessoryOption[];
  couleur?: string;
  image_url?: string;
}

interface SelectedAccessory {
  accessory_id: string;
  name: string;
  category_name: string;
  quantity: number;
  prix_unitaire: number;
  selected_options: string[];
  color?: string;
}

interface CustomKitConfigDialogProps {
  productId: string;
  productName: string;
  basePrice: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart?: (configuration: any, totalPrice: number) => void;
}

const AVAILABLE_COLORS = [
  { value: "noir", label: "Noir" },
  { value: "blanc", label: "Blanc" },
  { value: "gris", label: "Gris" },
  { value: "rouge", label: "Rouge" },
  { value: "bleu", label: "Bleu" },
  { value: "vert", label: "Vert" },
  { value: "jaune", label: "Jaune" },
  { value: "orange", label: "Orange" },
];

const CustomKitConfigDialog = ({
  productId,
  productName,
  basePrice,
  open,
  onOpenChange,
  onAddToCart,
}: CustomKitConfigDialogProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accessoriesByCategory, setAccessoriesByCategory] = useState<Map<string, Accessory[]>>(new Map());
  const [selectedAccessories, setSelectedAccessories] = useState<Map<string, SelectedAccessory>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadKitConfiguration();
    } else {
      setSelectedAccessories(new Map());
    }
  }, [open, productId]);

  const loadKitConfiguration = async () => {
    setLoading(true);

    // D'abord, charger les accessoires spécifiques configurés pour ce kit
    const { data: kitAccessoriesData, error: kitAccessoriesError } = await supabase
      .from("shop_custom_kit_accessories")
      .select(
        "accessory_id, accessories_catalog(id, nom, marque, prix_vente_ttc, category_id, description, couleur, image_url)",
      )
      .eq("custom_kit_id", productId);

    if (kitAccessoriesError) {
      console.error("Erreur lors du chargement des accessoires du kit:", kitAccessoriesError);
    }

    // Si on a des accessoires configurés, les utiliser
    if (kitAccessoriesData && kitAccessoriesData.length > 0) {
      // Extraire les accessoires
      const accessoriesData = kitAccessoriesData.map((ka: any) => ka.accessories_catalog).filter(Boolean);

      // Déduire les catégories uniques depuis les accessoires
      const categoryIdsFromAccessories = [...new Set(accessoriesData.map((a: any) => a.category_id).filter(Boolean))];

      // Charger les infos des catégories
      if (categoryIdsFromAccessories.length > 0) {
        const { data: categoriesData, error: categoriesError } = await supabase
          .from("categories")
          .select("id, nom")
          .in("id", categoryIdsFromAccessories);

        if (categoriesError) {
          console.error("Erreur lors du chargement des catégories:", categoriesError);
        } else {
          setCategories(categoriesData || []);
        }
      }

      // Charger les options pour tous les accessoires
      const accessoryIds = accessoriesData.map((a: any) => a.id);
      const { data: optionsData } = await supabase
        .from("accessory_options")
        .select("*")
        .in("accessory_id", accessoryIds);

      // Grouper les accessoires par catégorie
      const byCategory = new Map<string, Accessory[]>();
      accessoriesData.forEach((accessory: any) => {
        const catId = accessory.category_id;
        if (!catId) return;

        const options = (optionsData || []).filter((o: any) => o.accessory_id === accessory.id);
        const accessoryWithOptions: Accessory = {
          ...accessory,
          options: options,
        };

        if (!byCategory.has(catId)) {
          byCategory.set(catId, []);
        }
        byCategory.get(catId)!.push(accessoryWithOptions);
      });

      setAccessoriesByCategory(byCategory);
      setLoading(false);
      return;
    }

    // Fallback: utiliser allowed_category_ids si aucun accessoire n'est configuré
    const { data: kitData, error: kitError } = await supabase
      .from("shop_custom_kits")
      .select("allowed_category_ids")
      .eq("id", productId)
      .maybeSingle();

    if (kitError || !kitData) {
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

    setCategories(categoriesData || []);

    // Charger tous les accessoires des catégories autorisées
    const { data: accessoriesData, error: accessoriesError } = await supabase
      .from("accessories_catalog")
      .select("id, nom, marque, prix_vente_ttc, category_id, description, couleur, image_url")
      .in("category_id", categoryIds)
      .eq("available_in_shop", true);

    if (accessoriesError) {
      console.error("Erreur lors du chargement des accessoires:", accessoriesError);
      toast.error("Erreur lors du chargement des accessoires");
      setLoading(false);
      return;
    }

    // Charger les options pour tous les accessoires
    const accessoryIds = (accessoriesData || []).map((a: any) => a.id);
    const { data: optionsData } = await supabase.from("accessory_options").select("*").in("accessory_id", accessoryIds);

    // Grouper les accessoires par catégorie
    const byCategory = new Map<string, Accessory[]>();
    (accessoriesData || []).forEach((accessory: any) => {
      const catId = accessory.category_id;
      if (!catId) return;

      const options = (optionsData || []).filter((o: any) => o.accessory_id === accessory.id);
      const accessoryWithOptions: Accessory = {
        ...accessory,
        options: options,
      };

      if (!byCategory.has(catId)) {
        byCategory.set(catId, []);
      }
      byCategory.get(catId)!.push(accessoryWithOptions);
    });

    setAccessoriesByCategory(byCategory);
    setLoading(false);
  };

  const handleAccessorySelect = (categoryId: string, categoryName: string, accessoryId: string) => {
    const accessories = accessoriesByCategory.get(categoryId) || [];
    const accessory = accessories.find((a) => a.id === accessoryId);

    if (!accessory) return;

    const newSelected = new Map(selectedAccessories);
    const key = `${categoryId}-${accessoryId}`;

    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.set(key, {
        accessory_id: accessoryId,
        name: accessory.nom,
        category_name: categoryName,
        quantity: 1,
        prix_unitaire: accessory.prix_vente_ttc || 0,
        selected_options: [],
        color: accessory.couleur,
      });
    }

    setSelectedAccessories(newSelected);
  };

  const updateQuantity = (key: string, delta: number) => {
    const newSelected = new Map(selectedAccessories);
    const item = newSelected.get(key);

    if (item) {
      const newQuantity = Math.max(1, item.quantity + delta);
      newSelected.set(key, { ...item, quantity: newQuantity });
      setSelectedAccessories(newSelected);
    }
  };

  const toggleOption = (key: string, optionId: string) => {
    const newSelected = new Map(selectedAccessories);
    const item = newSelected.get(key);

    if (item) {
      const selected_options = item.selected_options.includes(optionId)
        ? item.selected_options.filter((id) => id !== optionId)
        : [...item.selected_options, optionId];

      newSelected.set(key, { ...item, selected_options });
      setSelectedAccessories(newSelected);
    }
  };

  const updateColor = (key: string, color: string) => {
    const newSelected = new Map(selectedAccessories);
    const item = newSelected.get(key);

    if (item) {
      newSelected.set(key, { ...item, color });
      setSelectedAccessories(newSelected);
    }
  };

  const calculateTotalPrice = () => {
    let total = 0;

    selectedAccessories.forEach((item) => {
      let itemPrice = item.prix_unitaire;

      // Ajouter le prix des options sélectionnées
      const categoryId = Array.from(selectedAccessories.entries())
        .find(([k, v]) => v === item)?.[0]
        .split("-")[0];

      if (categoryId) {
        const accessories = accessoriesByCategory.get(categoryId) || [];
        const accessory = accessories.find((a) => a.id === item.accessory_id);

        if (accessory?.options) {
          item.selected_options.forEach((optionId) => {
            const option = accessory.options?.find((o) => o.id === optionId);
            if (option) {
              itemPrice += option.prix_vente_ttc;
            }
          });
        }
      }

      total += itemPrice * item.quantity;
    });

    return total;
  };

  const handleAddToCart = () => {
    if (selectedAccessories.size === 0) {
      toast.error("Veuillez sélectionner au moins un accessoire");
      return;
    }

    const configuration = Array.from(selectedAccessories.values());
    const totalPrice = calculateTotalPrice();

    onAddToCart?.(configuration, totalPrice);
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Chargement de la configuration...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">Configurer : {productName}</DialogTitle>
          <DialogDescription>Sélectionnez les accessoires souhaités dans chaque catégorie</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            <Accordion type="multiple" className="w-full">
              {categories.map((category) => {
                const accessories = accessoriesByCategory.get(category.id) || [];

                return (
                  <AccordionItem key={category.id} value={category.id}>
                    <AccordionTrigger className="text-lg font-semibold">
                      {category.nom}
                      <Badge variant="secondary" className="ml-2">
                        {accessories.length} article{accessories.length > 1 ? "s" : ""}
                      </Badge>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        {accessories.map((accessory) => {
                          const key = `${category.id}-${accessory.id}`;
                          const isSelected = selectedAccessories.has(key);
                          const selectedItem = selectedAccessories.get(key);

                          return (
                            <div
                              key={accessory.id}
                              className={`border rounded-lg p-4 transition-all ${
                                isSelected ? "border-primary bg-primary/5" : "border-border"
                              }`}
                            >
                              <div className="flex items-start gap-4">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleAccessorySelect(category.id, category.nom, accessory.id)}
                                />

                                <div className="flex-1 space-y-3">
                                  <div>
                                    <h4 className="font-medium">{accessory.nom}</h4>
                                    {accessory.marque && (
                                      <p className="text-sm text-muted-foreground">{accessory.marque}</p>
                                    )}
                                    {accessory.description && (
                                      <p className="text-sm text-muted-foreground mt-1">{accessory.description}</p>
                                    )}
                                  </div>

                                  {isSelected && (
                                    <>
                                      {/* Quantité */}
                                      <div className="flex items-center gap-2">
                                        <Label className="text-sm">Quantité :</Label>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => updateQuantity(key, -1)}
                                        >
                                          <Minus className="h-4 w-4" />
                                        </Button>
                                        <span className="w-12 text-center">{selectedItem?.quantity}</span>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => updateQuantity(key, 1)}
                                        >
                                          <Plus className="h-4 w-4" />
                                        </Button>
                                      </div>

                                      {/* Couleur */}
                                      <div className="space-y-2">
                                        <Label className="text-sm">Couleur :</Label>
                                        <Select
                                          value={selectedItem?.color || ""}
                                          onValueChange={(value) => updateColor(key, value)}
                                        >
                                          <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Choisir une couleur" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {AVAILABLE_COLORS.map((color) => (
                                              <SelectItem key={color.value} value={color.value}>
                                                {color.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      {/* Options */}
                                      {accessory.options && accessory.options.length > 0 && (
                                        <div className="space-y-2">
                                          <Label className="text-sm">Options :</Label>
                                          <div className="space-y-2 pl-4">
                                            {accessory.options.map((option) => (
                                              <div key={option.id} className="flex items-center gap-2">
                                                <Checkbox
                                                  checked={selectedItem?.selected_options.includes(option.id)}
                                                  onCheckedChange={() => toggleOption(key, option.id)}
                                                />
                                                <Label className="text-sm cursor-pointer">
                                                  {option.nom} (+{option.prix_vente_ttc.toFixed(2)} €)
                                                </Label>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>

                                <div className="text-right">
                                  <p className="text-lg font-bold text-primary">
                                    {(accessory.prix_vente_ttc || 0).toFixed(2)} €
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              {selectedAccessories.size} article{selectedAccessories.size > 1 ? "s" : ""} sélectionné
              {selectedAccessories.size > 1 ? "s" : ""}
            </p>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Prix total :</p>
              <p className="text-2xl font-bold text-primary">{calculateTotalPrice().toFixed(2)} €</p>
            </div>
          </div>
          <Button onClick={handleAddToCart} size="lg">
            <ShoppingCart className="h-5 w-5 mr-2" />
            Ajouter au panier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomKitConfigDialog;
