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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Plus, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  nom: string;
}

interface AccessoryOption {
  id: string;
  nom: string;
  prix: number;
}

interface Accessory {
  id: string;
  nom: string;
  marque?: string;
  prix_vente_ttc?: number;
  category_id: string;
  description?: string;
  options?: AccessoryOption[];
}

interface SelectedAccessoryItem {
  id: string;
  accessoryId: string;
  categoryId: string;
  quantity: number;
  color?: string;
  selectedOptions: string[];
}

interface CustomKitConfigDialogProps {
  productId: string;
  productName: string;
  basePrice: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
}: CustomKitConfigDialogProps) => {
  const [allowedCategories, setAllowedCategories] = useState<Category[]>([]);
  const [accessoriesByCategory, setAccessoriesByCategory] = useState<Map<string, Accessory[]>>(new Map());
  const [selectedItems, setSelectedItems] = useState<SelectedAccessoryItem[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadKitConfiguration();
    } else {
      // Reset when closing
      setSelectedItems([]);
      setExpandedCategories(new Set());
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
      .select("id, nom, marque, prix_vente_ttc, category_id, description")
      .in("category_id", categoryIds)
      .eq("available_in_shop", true);

    if (accessoriesError) {
      console.error("Erreur lors du chargement des accessoires:", accessoriesError);
      toast.error("Erreur lors du chargement des accessoires");
      setLoading(false);
      return;
    }

    // Charger les options pour tous les accessoires
    const accessoryIds = (accessoriesData || []).map(a => a.id);
    const { data: optionsData } = await supabase
      .from("accessory_options")
      .select("*")
      .in("accessory_id", accessoryIds);

    // Regrouper les options par accessoire
    const optionsByAccessory = new Map<string, AccessoryOption[]>();
    (optionsData || []).forEach((option) => {
      if (!optionsByAccessory.has(option.accessory_id)) {
        optionsByAccessory.set(option.accessory_id, []);
      }
      optionsByAccessory.get(option.accessory_id)!.push(option);
    });

    // Regrouper les accessoires par catégorie avec leurs options
    const accessoriesMap = new Map<string, Accessory[]>();
    (accessoriesData || []).forEach((accessory) => {
      const categoryId = accessory.category_id;
      if (!accessoriesMap.has(categoryId)) {
        accessoriesMap.set(categoryId, []);
      }
      accessoriesMap.get(categoryId)!.push({
        ...accessory,
        options: optionsByAccessory.get(accessory.id) || [],
      });
    });

    setAccessoriesByCategory(accessoriesMap);
    
    // Ouvrir toutes les catégories par défaut
    setExpandedCategories(new Set(categoryIds));
    setLoading(false);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const addAccessoryToKit = (categoryId: string, accessoryId: string) => {
    const newItem: SelectedAccessoryItem = {
      id: `${Date.now()}-${Math.random()}`,
      accessoryId,
      categoryId,
      quantity: 1,
      selectedOptions: [],
    };
    setSelectedItems((prev) => [...prev, newItem]);
  };

  const duplicateItem = (itemId: string) => {
    const item = selectedItems.find((i) => i.id === itemId);
    if (item) {
      const newItem: SelectedAccessoryItem = {
        ...item,
        id: `${Date.now()}-${Math.random()}`,
      };
      setSelectedItems((prev) => [...prev, newItem]);
    }
  };

  const removeItem = (itemId: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    setSelectedItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    );
  };

  const updateItemColor = (itemId: string, color: string) => {
    setSelectedItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, color } : item))
    );
  };

  const toggleOption = (itemId: string, optionId: string) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const selectedOptions = item.selectedOptions.includes(optionId)
          ? item.selectedOptions.filter((id) => id !== optionId)
          : [...item.selectedOptions, optionId];
        return { ...item, selectedOptions };
      })
    );
  };

  const calculateItemPrice = (item: SelectedAccessoryItem) => {
    const accessories = accessoriesByCategory.get(item.categoryId) || [];
    const accessory = accessories.find((a) => a.id === item.accessoryId);
    if (!accessory) return 0;

    let price = accessory.prix_vente_ttc || 0;

    // Ajouter le prix des options sélectionnées
    item.selectedOptions.forEach((optionId) => {
      const option = accessory.options?.find((o) => o.id === optionId);
      if (option) {
        price += option.prix;
      }
    });

    return price * item.quantity;
  };

  const calculateTotalPrice = () => {
    let total = basePrice;
    selectedItems.forEach((item) => {
      total += calculateItemPrice(item);
    });
    return total;
  };

  const getAccessoryById = (categoryId: string, accessoryId: string) => {
    const accessories = accessoriesByCategory.get(categoryId) || [];
    return accessories.find((a) => a.id === accessoryId);
  };

  const getCategoryItemsCount = (categoryId: string) => {
    return selectedItems.filter((item) => item.categoryId === categoryId).length;
  };

  const handleAddToCart = () => {
    if (selectedItems.length === 0) {
      toast.error("Ajoutez au moins un accessoire au kit");
      return;
    }
    // TODO: Implémenter l'ajout au panier
    toast.success("Fonctionnalité panier à venir");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{productName}</DialogTitle>
          <DialogDescription>
            Configurez votre kit en ajoutant des accessoires depuis les catégories disponibles
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Chargement de la configuration...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonne de gauche - Sélection des accessoires */}
            <div className="lg:col-span-2">
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-3">
                  {allowedCategories.map((category) => {
                    const accessories = accessoriesByCategory.get(category.id) || [];
                    const isExpanded = expandedCategories.has(category.id);
                    const itemsCount = getCategoryItemsCount(category.id);

                    return (
                      <Collapsible
                        key={category.id}
                        open={isExpanded}
                        onOpenChange={() => toggleCategory(category.id)}
                      >
                        <Card>
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <ChevronDown
                                    className={`h-5 w-5 transition-transform ${
                                      isExpanded ? "" : "-rotate-90"
                                    }`}
                                  />
                                  <CardTitle className="text-base">{category.nom}</CardTitle>
                                  <Badge variant="secondary">{accessories.length} accessoires</Badge>
                                  {itemsCount > 0 && (
                                    <Badge variant="default">{itemsCount} ajouté(s)</Badge>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="p-4 pt-0">
                              {accessories.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">
                                  Aucun accessoire disponible dans cette catégorie
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {accessories.map((accessory) => (
                                    <Card
                                      key={accessory.id}
                                      className="hover:border-primary/50 transition-colors"
                                    >
                                      <CardContent className="p-3">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm">{accessory.nom}</div>
                                            {accessory.marque && (
                                              <div className="text-xs text-muted-foreground">
                                                {accessory.marque}
                                              </div>
                                            )}
                                            {accessory.description && (
                                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                                {accessory.description}
                                              </p>
                                            )}
                                            {accessory.options && accessory.options.length > 0 && (
                                              <Badge variant="outline" className="mt-1 text-xs">
                                                {accessory.options.length} option(s)
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="flex flex-col items-end gap-2">
                                            <div className="text-sm font-semibold whitespace-nowrap">
                                              {accessory.prix_vente_ttc?.toFixed(2) || "0.00"} €
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => addAccessoryToKit(category.id, accessory.id)}
                                            >
                                              <Plus className="h-3 w-3 mr-1" />
                                              Ajouter
                                            </Button>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Colonne de droite - Récapitulatif */}
            <div className="lg:col-span-1">
              <Card className="sticky top-0">
                <CardHeader>
                  <CardTitle className="text-base">Votre configuration</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <ScrollArea className="h-[50vh]">
                    {selectedItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Aucun accessoire ajouté
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {selectedItems.map((item) => {
                          const accessory = getAccessoryById(item.categoryId, item.accessoryId);
                          if (!accessory) return null;

                          return (
                            <Card key={item.id} className="border-primary/20">
                              <CardContent className="p-3">
                                <div className="space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm">{accessory.nom}</div>
                                      {accessory.marque && (
                                        <div className="text-xs text-muted-foreground">
                                          {accessory.marque}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={() => duplicateItem(item.id)}
                                        title="Dupliquer"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 text-destructive"
                                        onClick={() => removeItem(item.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Label className="text-xs min-w-[60px]">Quantité:</Label>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) =>
                                          updateItemQuantity(item.id, parseInt(e.target.value) || 1)
                                        }
                                        className="h-7 w-20 text-xs"
                                      />
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <Label className="text-xs min-w-[60px]">Couleur:</Label>
                                      <Select
                                        value={item.color}
                                        onValueChange={(value) => updateItemColor(item.id, value)}
                                      >
                                        <SelectTrigger className="h-7 text-xs flex-1">
                                          <SelectValue placeholder="Choisir" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card z-50">
                                          {AVAILABLE_COLORS.map((color) => (
                                            <SelectItem key={color.value} value={color.value}>
                                              {color.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {accessory.options && accessory.options.length > 0 && (
                                      <div className="space-y-1">
                                        <Label className="text-xs">Options:</Label>
                                        {accessory.options.map((option) => (
                                          <div
                                            key={option.id}
                                            className="flex items-center gap-2 text-xs"
                                          >
                                            <Checkbox
                                              id={`${item.id}-${option.id}`}
                                              checked={item.selectedOptions.includes(option.id)}
                                              onCheckedChange={() =>
                                                toggleOption(item.id, option.id)
                                              }
                                            />
                                            <label
                                              htmlFor={`${item.id}-${option.id}`}
                                              className="flex-1 cursor-pointer"
                                            >
                                              {option.nom}
                                            </label>
                                            <span className="text-muted-foreground">
                                              +{option.prix.toFixed(2)} €
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <Separator />
                                    <div className="flex justify-between text-xs font-semibold">
                                      <span>Sous-total:</span>
                                      <span>{calculateItemPrice(item).toFixed(2)} €</span>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>

                  <div className="space-y-3 pt-4 border-t mt-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Prix de base:</span>
                        <span>{basePrice.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Accessoires:</span>
                        <span>
                          {selectedItems.reduce((sum, item) => sum + calculateItemPrice(item), 0).toFixed(2)} €
                        </span>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-primary">{calculateTotalPrice().toFixed(2)} €</span>
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleAddToCart}
                    >
                      Ajouter au panier
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CustomKitConfigDialog;
