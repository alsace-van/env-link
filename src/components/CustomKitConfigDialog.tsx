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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Plus, Minus, X } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  nom: string;
}

interface AccessoryOption {
  id: string;
  nom: string;
  prix_vente_ttc: number;
  accessory_id: string;
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

// Une ligne de sélection dans une catégorie
interface SelectionLine {
  id: string; // ID unique de la ligne
  accessory_id: string;
  quantity: number;
  color?: string;
  selected_options: string[];
}

// Sélections groupées par catégorie
interface CategorySelections {
  [categoryId: string]: SelectionLine[];
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
  const [selections, setSelections] = useState<CategorySelections>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadKitConfiguration();
    } else {
      setSelections({});
    }
  }, [open, productId]);

  // Initialiser les sélections avec une ligne vide par catégorie
  useEffect(() => {
    if (categories.length > 0 && Object.keys(selections).length === 0) {
      const initialSelections: CategorySelections = {};
      categories.forEach((cat) => {
        initialSelections[cat.id] = [{ id: crypto.randomUUID(), accessory_id: "", quantity: 1, selected_options: [] }];
      });
      setSelections(initialSelections);
    }
  }, [categories]);

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
      const accessoriesData = kitAccessoriesData.map((ka: any) => ka.accessories_catalog).filter(Boolean);

      const categoryIdsFromAccessories = [...new Set(accessoriesData.map((a: any) => a.category_id).filter(Boolean))];

      if (categoryIdsFromAccessories.length > 0) {
        const { data: categoriesData } = await supabase
          .from("categories")
          .select("id, nom")
          .in("id", categoryIdsFromAccessories);

        setCategories(categoriesData || []);
      }

      // Charger les options
      const accessoryIds = accessoriesData.map((a: any) => a.id);
      const { data: optionsData } = await supabase
        .from("accessory_options")
        .select("*")
        .in("accessory_id", accessoryIds);

      // Grouper par catégorie
      const byCategory = new Map<string, Accessory[]>();
      accessoriesData.forEach((accessory: any) => {
        const catId = accessory.category_id;
        if (!catId) return;

        const options = (optionsData || []).filter((o: any) => o.accessory_id === accessory.id);
        const accessoryWithOptions: Accessory = { ...accessory, options };

        if (!byCategory.has(catId)) {
          byCategory.set(catId, []);
        }
        byCategory.get(catId)!.push(accessoryWithOptions);
      });

      setAccessoriesByCategory(byCategory);
      setLoading(false);
      return;
    }

    // Fallback: utiliser allowed_category_ids
    const { data: kitData } = await supabase
      .from("shop_custom_kits")
      .select("allowed_category_ids")
      .eq("id", productId)
      .maybeSingle();

    const categoryIds = kitData?.allowed_category_ids || [];

    if (categoryIds.length === 0) {
      toast.error("Aucune catégorie configurée pour ce kit");
      setLoading(false);
      return;
    }

    const { data: categoriesData } = await supabase.from("categories").select("id, nom").in("id", categoryIds);

    setCategories(categoriesData || []);

    const { data: accessoriesData } = await supabase
      .from("accessories_catalog")
      .select("id, nom, marque, prix_vente_ttc, category_id, description, couleur, image_url")
      .in("category_id", categoryIds)
      .eq("available_in_shop", true);

    const accessoryIds = (accessoriesData || []).map((a: any) => a.id);
    const { data: optionsData } = await supabase.from("accessory_options").select("*").in("accessory_id", accessoryIds);

    const byCategory = new Map<string, Accessory[]>();
    (accessoriesData || []).forEach((accessory: any) => {
      const catId = accessory.category_id;
      if (!catId) return;

      const options = (optionsData || []).filter((o: any) => o.accessory_id === accessory.id);
      const accessoryWithOptions: Accessory = { ...accessory, options };

      if (!byCategory.has(catId)) {
        byCategory.set(catId, []);
      }
      byCategory.get(catId)!.push(accessoryWithOptions);
    });

    setAccessoriesByCategory(byCategory);
    setLoading(false);
  };

  const getAccessory = (categoryId: string, accessoryId: string): Accessory | undefined => {
    const accessories = accessoriesByCategory.get(categoryId) || [];
    return accessories.find((a) => a.id === accessoryId);
  };

  const addLine = (categoryId: string) => {
    setSelections((prev) => ({
      ...prev,
      [categoryId]: [
        ...(prev[categoryId] || []),
        { id: crypto.randomUUID(), accessory_id: "", quantity: 1, selected_options: [] },
      ],
    }));
  };

  const removeLine = (categoryId: string, lineId: string) => {
    setSelections((prev) => {
      const lines = prev[categoryId] || [];
      // Garder au moins une ligne vide
      if (lines.length <= 1) {
        return {
          ...prev,
          [categoryId]: [{ id: crypto.randomUUID(), accessory_id: "", quantity: 1, selected_options: [] }],
        };
      }
      return {
        ...prev,
        [categoryId]: lines.filter((l) => l.id !== lineId),
      };
    });
  };

  const updateLine = (categoryId: string, lineId: string, updates: Partial<SelectionLine>) => {
    setSelections((prev) => ({
      ...prev,
      [categoryId]: (prev[categoryId] || []).map((line) => (line.id === lineId ? { ...line, ...updates } : line)),
    }));
  };

  const updateQuantity = (categoryId: string, lineId: string, delta: number) => {
    setSelections((prev) => ({
      ...prev,
      [categoryId]: (prev[categoryId] || []).map((line) =>
        line.id === lineId ? { ...line, quantity: Math.max(1, line.quantity + delta) } : line,
      ),
    }));
  };

  const toggleOption = (categoryId: string, lineId: string, optionId: string) => {
    setSelections((prev) => ({
      ...prev,
      [categoryId]: (prev[categoryId] || []).map((line) => {
        if (line.id !== lineId) return line;
        const newOptions = line.selected_options.includes(optionId)
          ? line.selected_options.filter((id) => id !== optionId)
          : [...line.selected_options, optionId];
        return { ...line, selected_options: newOptions };
      }),
    }));
  };

  const calculateTotalPrice = () => {
    let total = 0;

    Object.entries(selections).forEach(([categoryId, lines]) => {
      lines.forEach((line) => {
        if (!line.accessory_id) return;

        const accessory = getAccessory(categoryId, line.accessory_id);
        if (!accessory) return;

        let itemPrice = accessory.prix_vente_ttc || 0;

        // Ajouter le prix des options
        line.selected_options.forEach((optionId) => {
          const option = accessory.options?.find((o) => o.id === optionId);
          if (option) {
            itemPrice += option.prix_vente_ttc;
          }
        });

        total += itemPrice * line.quantity;
      });
    });

    return total;
  };

  const getSelectedCount = () => {
    let count = 0;
    Object.values(selections).forEach((lines) => {
      lines.forEach((line) => {
        if (line.accessory_id) count++;
      });
    });
    return count;
  };

  const handleAddToCart = () => {
    const selectedCount = getSelectedCount();
    if (selectedCount === 0) {
      toast.error("Veuillez sélectionner au moins un accessoire");
      return;
    }

    const configuration: any[] = [];

    Object.entries(selections).forEach(([categoryId, lines]) => {
      const category = categories.find((c) => c.id === categoryId);

      lines.forEach((line) => {
        if (!line.accessory_id) return;

        const accessory = getAccessory(categoryId, line.accessory_id);
        if (!accessory) return;

        configuration.push({
          accessory_id: line.accessory_id,
          name: accessory.nom,
          category_name: category?.nom || "",
          quantity: line.quantity,
          prix_unitaire: accessory.prix_vente_ttc || 0,
          selected_options: line.selected_options,
          color: line.color,
        });
      });
    });

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
          <DialogDescription>Sélectionnez les articles souhaités dans chaque catégorie</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {categories.map((category) => {
              const accessories = accessoriesByCategory.get(category.id) || [];
              const lines = selections[category.id] || [];

              return (
                <div key={category.id} className="space-y-3">
                  {/* Header de catégorie */}
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <h3 className="font-semibold text-lg">{category.nom}</h3>
                    <Badge variant="secondary">
                      {accessories.length} disponible{accessories.length > 1 ? "s" : ""}
                    </Badge>
                  </div>

                  {/* Lignes de sélection */}
                  <div className="space-y-3">
                    {lines.map((line) => {
                      const selectedAccessory = line.accessory_id
                        ? getAccessory(category.id, line.accessory_id)
                        : undefined;

                      const hasColor = selectedAccessory?.couleur && selectedAccessory.couleur.trim() !== "";
                      const hasOptions = selectedAccessory?.options && selectedAccessory.options.length > 0;

                      return (
                        <div key={line.id} className="space-y-2">
                          {/* Ligne principale : dropdown + quantité + supprimer */}
                          <div className="flex items-center gap-2">
                            {/* Dropdown article */}
                            <div className="flex-1">
                              <Select
                                value={line.accessory_id}
                                onValueChange={(value) =>
                                  updateLine(category.id, line.id, {
                                    accessory_id: value,
                                    selected_options: [],
                                    color: undefined,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner un article..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {accessories.map((acc) => (
                                    <SelectItem key={acc.id} value={acc.id}>
                                      <div className="flex items-center justify-between w-full gap-4">
                                        <span>{acc.nom}</span>
                                        <span className="text-primary font-medium">
                                          {(acc.prix_vente_ttc || 0).toFixed(2)} €
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Quantité */}
                            {line.accessory_id && (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={() => updateQuantity(category.id, line.id, -1)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-8 text-center font-medium">{line.quantity}</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={() => updateQuantity(category.id, line.id, 1)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            )}

                            {/* Prix unitaire */}
                            {selectedAccessory && (
                              <span className="text-primary font-bold whitespace-nowrap min-w-[80px] text-right">
                                {(selectedAccessory.prix_vente_ttc || 0).toFixed(2)} €
                              </span>
                            )}

                            {/* Bouton supprimer */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-destructive"
                              onClick={() => removeLine(category.id, line.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Options supplémentaires si article sélectionné */}
                          {selectedAccessory && (hasColor || hasOptions) && (
                            <div className="ml-4 pl-4 border-l-2 border-muted space-y-2">
                              {/* Couleur */}
                              {hasColor && (
                                <div className="flex items-center gap-2">
                                  <Label className="text-sm text-muted-foreground w-16">Couleur :</Label>
                                  <Select
                                    value={line.color || ""}
                                    onValueChange={(value) => updateLine(category.id, line.id, { color: value })}
                                  >
                                    <SelectTrigger className="w-40 h-8">
                                      <SelectValue placeholder="Choisir..." />
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
                              )}

                              {/* Options */}
                              {hasOptions && (
                                <div className="flex items-start gap-2">
                                  <Label className="text-sm text-muted-foreground w-16 pt-1">Options :</Label>
                                  <div className="flex flex-wrap gap-1">
                                    {selectedAccessory.options?.map((option) => {
                                      const isSelected = line.selected_options.includes(option.id);
                                      return (
                                        <Badge
                                          key={option.id}
                                          variant={isSelected ? "default" : "outline"}
                                          className="cursor-pointer text-xs"
                                          onClick={() => toggleOption(category.id, line.id, option.id)}
                                        >
                                          {option.nom} (+{option.prix_vente_ttc.toFixed(2)} €)
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Bouton ajouter */}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => addLine(category.id)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un article
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              {getSelectedCount()} article{getSelectedCount() > 1 ? "s" : ""} sélectionné
              {getSelectedCount() > 1 ? "s" : ""}
            </p>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Prix total :</p>
              <p className="text-2xl font-bold text-primary">{calculateTotalPrice().toFixed(2)} €</p>
            </div>
          </div>
          <Button onClick={handleAddToCart} size="lg" disabled={getSelectedCount() === 0}>
            <ShoppingCart className="h-5 w-5 mr-2" />
            Ajouter au panier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomKitConfigDialog;
