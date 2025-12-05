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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShoppingCart, Plus, Minus, X, Copy, Info, Package, ChevronsUpDown, Check } from "lucide-react";
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
  couleur?: string; // JSON string: ["Noir", "Rouge"]
  image_url?: string;
}

interface SelectionLine {
  id: string;
  accessory_id: string;
  quantity: number;
  color?: string;
  selected_options: string[];
}

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

// Mapping des noms de couleurs vers des codes CSS
const COLOR_MAP: { [key: string]: string } = {
  // Français
  noir: "#1a1a1a",
  blanc: "#ffffff",
  gris: "#6b7280",
  rouge: "#dc2626",
  bleu: "#2563eb",
  vert: "#16a34a",
  jaune: "#eab308",
  orange: "#ea580c",
  rose: "#ec4899",
  violet: "#8b5cf6",
  marron: "#78350f",
  beige: "#d4b896",
  turquoise: "#14b8a6",
  // English
  black: "#1a1a1a",
  white: "#ffffff",
  gray: "#6b7280",
  grey: "#6b7280",
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#eab308",
  pink: "#ec4899",
  purple: "#8b5cf6",
  brown: "#78350f",
};

// Fonction pour obtenir le code couleur CSS
const getColorCode = (colorName: string): string => {
  const normalized = colorName.toLowerCase().trim();
  return COLOR_MAP[normalized] || "#9ca3af"; // Gris par défaut
};

// Fonction pour parser les couleurs depuis le JSON
const parseColors = (couleurJson: string | undefined | null): string[] => {
  if (!couleurJson) return [];
  try {
    const parsed = JSON.parse(couleurJson);
    if (Array.isArray(parsed)) {
      return parsed.filter((c) => c && typeof c === "string" && c.trim());
    }
    return [];
  } catch {
    // Si ce n'est pas du JSON, c'est peut-être une couleur simple
    if (couleurJson.trim()) {
      return [couleurJson.trim()];
    }
    return [];
  }
};

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
  const [descriptionModal, setDescriptionModal] = useState<Accessory | null>(null);
  const [openPopovers, setOpenPopovers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      loadKitConfiguration();
    } else {
      setSelections({});
      setOpenPopovers(new Set());
    }
  }, [open, productId]);

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

    const { data: kitAccessoriesData, error: kitAccessoriesError } = await supabase
      .from("shop_custom_kit_accessories")
      .select(
        "accessory_id, accessories_catalog(id, nom, marque, prix_vente_ttc, category_id, description, couleur, image_url)",
      )
      .eq("custom_kit_id", productId);

    if (kitAccessoriesError) {
      console.error("Erreur lors du chargement des accessoires du kit:", kitAccessoriesError);
    }

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

      const accessoryIds = accessoriesData.map((a: any) => a.id);
      const { data: optionsData } = await supabase
        .from("accessory_options")
        .select("*")
        .in("accessory_id", accessoryIds);

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

  const duplicateLine = (categoryId: string) => {
    setSelections((prev) => ({
      ...prev,
      [categoryId]: [
        ...(prev[categoryId] || []),
        {
          id: crypto.randomUUID(),
          accessory_id: "",
          quantity: 1,
          selected_options: [],
        },
      ],
    }));
  };

  const removeLine = (categoryId: string, lineId: string) => {
    setSelections((prev) => {
      const lines = prev[categoryId] || [];
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

  const selectAccessory = (categoryId: string, lineId: string, accessoryId: string) => {
    updateLine(categoryId, lineId, {
      accessory_id: accessoryId,
      selected_options: [],
      color: undefined,
    });
    setOpenPopovers((prev) => {
      const newSet = new Set(prev);
      newSet.delete(lineId);
      return newSet;
    });
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

  const selectColor = (categoryId: string, lineId: string, color: string) => {
    updateLine(categoryId, lineId, { color });
  };

  const calculateTotalPrice = () => {
    let total = 0;

    Object.entries(selections).forEach(([categoryId, lines]) => {
      lines.forEach((line) => {
        if (!line.accessory_id) return;

        const accessory = getAccessory(categoryId, line.accessory_id);
        if (!accessory) return;

        let itemPrice = accessory.prix_vente_ttc || 0;

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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">Configurer : {productName}</DialogTitle>
            <DialogDescription>Sélectionnez les articles souhaités dans chaque catégorie</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex gap-4">
            {/* Colonne gauche - Sélections */}
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

                          const availableColors = selectedAccessory ? parseColors(selectedAccessory.couleur) : [];
                          const hasColors = availableColors.length > 0;
                          const hasOptions = selectedAccessory?.options && selectedAccessory.options.length > 0;
                          const isPopoverOpen = openPopovers.has(line.id);

                          return (
                            <div key={line.id} className="space-y-2">
                              {/* Ligne principale */}
                              <div className="flex items-center gap-2">
                                {/* Dropdown article avec miniatures */}
                                <Popover
                                  open={isPopoverOpen}
                                  onOpenChange={(open) => {
                                    setOpenPopovers((prev) => {
                                      const newSet = new Set(prev);
                                      if (open) {
                                        newSet.add(line.id);
                                      } else {
                                        newSet.delete(line.id);
                                      }
                                      return newSet;
                                    });
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className="flex-1 justify-between h-auto min-h-[40px] py-2"
                                    >
                                      {selectedAccessory ? (
                                        <div className="flex items-center gap-3">
                                          {selectedAccessory.image_url ? (
                                            <img
                                              src={selectedAccessory.image_url}
                                              alt={selectedAccessory.nom}
                                              className="w-8 h-8 object-cover rounded"
                                            />
                                          ) : (
                                            <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                                              <Package className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                          )}
                                          <div className="text-left">
                                            <p className="font-medium text-sm">{selectedAccessory.nom}</p>
                                            {selectedAccessory.marque && (
                                              <p className="text-xs text-muted-foreground">
                                                {selectedAccessory.marque}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground">Sélectionner un article...</span>
                                      )}
                                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 p-0" align="start">
                                    <ScrollArea className="h-72">
                                      <div className="p-1">
                                        {accessories.map((acc) => (
                                          <div
                                            key={acc.id}
                                            className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted/50 ${
                                              line.accessory_id === acc.id ? "bg-primary/10" : ""
                                            }`}
                                          >
                                            {/* Miniature */}
                                            {acc.image_url ? (
                                              <img
                                                src={acc.image_url}
                                                alt={acc.nom}
                                                className="w-12 h-12 object-cover rounded"
                                              />
                                            ) : (
                                              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                                <Package className="w-6 h-6 text-muted-foreground" />
                                              </div>
                                            )}

                                            {/* Infos - cliquable pour sélectionner */}
                                            <div
                                              className="flex-1 min-w-0"
                                              onClick={() => selectAccessory(category.id, line.id, acc.id)}
                                            >
                                              <p className="font-medium text-sm truncate">{acc.nom}</p>
                                              {acc.marque && (
                                                <p className="text-xs text-muted-foreground">{acc.marque}</p>
                                              )}
                                              <p className="text-sm font-semibold text-primary">
                                                {(acc.prix_vente_ttc || 0).toFixed(2)} €
                                              </p>
                                            </div>

                                            {/* Bouton description */}
                                            {acc.description && (
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setDescriptionModal(acc);
                                                }}
                                              >
                                                <Info className="h-4 w-4" />
                                              </Button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                  </PopoverContent>
                                </Popover>

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

                                {/* Bouton dupliquer */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-muted-foreground hover:text-primary"
                                  onClick={() => duplicateLine(category.id)}
                                  title="Ajouter une ligne"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>

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
                              {selectedAccessory && (hasColors || hasOptions) && (
                                <div className="ml-4 pl-4 border-l-2 border-muted space-y-3">
                                  {/* Couleurs en pastilles */}
                                  {hasColors && (
                                    <div className="flex items-center gap-3">
                                      <Label className="text-sm text-muted-foreground">Couleur :</Label>
                                      <div className="flex items-center gap-2">
                                        {availableColors.map((colorName) => {
                                          const isSelected = line.color === colorName;
                                          const colorCode = getColorCode(colorName);
                                          const isLight = colorCode === "#ffffff" || colorCode === "#d4b896";

                                          return (
                                            <button
                                              key={colorName}
                                              onClick={() => selectColor(category.id, line.id, colorName)}
                                              className={`
                                                relative w-8 h-8 rounded-full transition-all
                                                ${isSelected ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-110"}
                                                ${isLight ? "border border-gray-300" : ""}
                                              `}
                                              style={{ backgroundColor: colorCode }}
                                              title={colorName}
                                            >
                                              {isSelected && (
                                                <Check
                                                  className={`absolute inset-0 m-auto h-4 w-4 ${
                                                    isLight ? "text-gray-700" : "text-white"
                                                  }`}
                                                />
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {line.color && (
                                        <span className="text-sm text-muted-foreground capitalize">({line.color})</span>
                                      )}
                                    </div>
                                  )}

                                  {/* Options */}
                                  {hasOptions && (
                                    <div className="flex items-start gap-3">
                                      <Label className="text-sm text-muted-foreground pt-1">Options :</Label>
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
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Colonne droite - Récapitulatif */}
            <div className="w-72 flex-shrink-0 border-l pl-4 flex flex-col">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Récapitulatif
              </h4>

              <ScrollArea className="flex-1">
                {getSelectedCount() === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>Aucun article</p>
                    <p className="text-xs">Sélectionnez des articles à gauche</p>
                  </div>
                ) : (
                  <div className="space-y-2 pr-2">
                    {Object.entries(selections).map(([categoryId, lines]) => {
                      const category = categories.find((c) => c.id === categoryId);
                      const selectedLines = lines.filter((l) => l.accessory_id);

                      if (selectedLines.length === 0) return null;

                      return selectedLines.map((line) => {
                        const accessory = getAccessory(categoryId, line.accessory_id);
                        if (!accessory) return null;

                        let itemTotal = (accessory.prix_vente_ttc || 0) * line.quantity;

                        line.selected_options.forEach((optionId) => {
                          const option = accessory.options?.find((o) => o.id === optionId);
                          if (option) {
                            itemTotal += option.prix_vente_ttc * line.quantity;
                          }
                        });

                        const selectedOptionNames = line.selected_options
                          .map((optId) => accessory.options?.find((o) => o.id === optId)?.nom)
                          .filter(Boolean);

                        return (
                          <div key={line.id} className="bg-muted/30 rounded-lg p-2 text-sm">
                            <div className="flex items-start gap-2">
                              {/* Miniature */}
                              {accessory.image_url ? (
                                <img
                                  src={accessory.image_url}
                                  alt={accessory.nom}
                                  className="w-10 h-10 object-cover rounded flex-shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0">
                                  <Package className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{accessory.nom}</p>
                                <p className="text-xs text-muted-foreground">×{line.quantity}</p>

                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                  {line.color && (
                                    <div
                                      className="w-4 h-4 rounded-full border border-gray-300"
                                      style={{ backgroundColor: getColorCode(line.color) }}
                                      title={line.color}
                                    />
                                  )}
                                  {selectedOptionNames.length > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      {selectedOptionNames.join(", ")}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span className="font-semibold text-primary text-sm whitespace-nowrap">
                                {itemTotal.toFixed(2)} €
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })}
                  </div>
                )}
              </ScrollArea>

              {/* Total */}
              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">
                    {getSelectedCount()} article{getSelectedCount() > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total :</span>
                  <span className="text-xl font-bold text-primary">{calculateTotalPrice().toFixed(2)} €</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button onClick={handleAddToCart} size="lg" className="w-full" disabled={getSelectedCount() === 0}>
              <ShoppingCart className="h-5 w-5 mr-2" />
              Ajouter au panier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modale description */}
      <Dialog open={!!descriptionModal} onOpenChange={(open) => !open && setDescriptionModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {descriptionModal?.image_url ? (
                <img
                  src={descriptionModal.image_url}
                  alt={descriptionModal.nom}
                  className="w-16 h-16 object-cover rounded"
                />
              ) : (
                <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <p>{descriptionModal?.nom}</p>
                {descriptionModal?.marque && (
                  <p className="text-sm font-normal text-muted-foreground">{descriptionModal.marque}</p>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">{descriptionModal?.description}</p>

            {/* Afficher les couleurs disponibles dans la modale */}
            {descriptionModal && parseColors(descriptionModal.couleur).length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Couleurs disponibles :</span>
                <div className="flex gap-1">
                  {parseColors(descriptionModal.couleur).map((colorName) => (
                    <div
                      key={colorName}
                      className="w-6 h-6 rounded-full border border-gray-300"
                      style={{ backgroundColor: getColorCode(colorName) }}
                      title={colorName}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-2xl font-bold text-primary">
                {(descriptionModal?.prix_vente_ttc || 0).toFixed(2)} €
              </span>
              <Button variant="outline" onClick={() => setDescriptionModal(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CustomKitConfigDialog;
