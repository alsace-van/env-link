import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  image_url?: string;
}

interface KitSection {
  id: string;
  category_id: string;
  selected_accessory_ids: string[];
}

interface CustomKitSectionManagerProps {
  productId?: string; // Pour édition
  value: KitSection[];
  onChange: (sections: KitSection[]) => void;
}

export const CustomKitSectionManager = ({ productId, value, onChange }: CustomKitSectionManagerProps) => {
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allAccessories, setAllAccessories] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Charger TOUTES les catégories
    const { data: categoriesData, error: categoriesError } = await supabase
      .from("categories")
      .select("id, nom")
      .order("nom");

    if (categoriesError) {
      console.error("Erreur chargement catégories:", categoriesError);
      setLoading(false);
      return;
    }

    console.log("Catégories chargées:", categoriesData); // DEBUG
    setAllCategories(categoriesData || []);

    // Charger TOUS les accessoires disponibles dans la boutique
    const { data: accessoriesData, error: accessoriesError } = await supabase
      .from("accessories_catalog")
      .select("id, nom, marque, prix_vente_ttc, category_id, image_url")
      .eq("available_in_shop", true)
      .order("nom");

    if (accessoriesError) {
      console.error("Erreur chargement accessoires:", accessoriesError);
      setLoading(false);
      return;
    }

    console.log("Accessoires chargés:", accessoriesData); // DEBUG
    setAllAccessories(accessoriesData || []);

    // Si on édite un produit existant, charger sa configuration
    if (productId && value.length === 0) {
      const { data: kitItemsData } = await supabase
        .from("shop_product_items")
        .select("accessory_id, accessories_catalog(category_id)")
        .eq("shop_product_id", productId);

      if (kitItemsData && kitItemsData.length > 0) {
        // Regrouper par catégorie
        const sectionsMap = new Map<string, string[]>();

        kitItemsData.forEach((item: any) => {
          const categoryId = item.accessories_catalog?.category_id;
          if (!categoryId) return;

          if (!sectionsMap.has(categoryId)) {
            sectionsMap.set(categoryId, []);
          }
          sectionsMap.get(categoryId)!.push(item.accessory_id);
        });

        // Convertir en KitSection[]
        const loadedSections: KitSection[] = Array.from(sectionsMap.entries()).map(([categoryId, accessoryIds]) => ({
          id: `section-${categoryId}-${Date.now()}`,
          category_id: categoryId,
          selected_accessory_ids: accessoryIds,
        }));

        onChange(loadedSections);
      }
    }

    setLoading(false);
  };

  const addSection = () => {
    const newSection: KitSection = {
      id: `section-new-${Date.now()}`,
      category_id: "",
      selected_accessory_ids: [],
    };
    onChange([...value, newSection]);
  };

  const removeSection = (sectionId: string) => {
    onChange(value.filter((s) => s.id !== sectionId));
  };

  const updateSectionCategory = (sectionId: string, categoryId: string) => {
    onChange(
      value.map((section) =>
        section.id === sectionId ? { ...section, category_id: categoryId, selected_accessory_ids: [] } : section,
      ),
    );
  };

  const toggleAccessory = (sectionId: string, accessoryId: string) => {
    onChange(
      value.map((section) => {
        if (section.id !== sectionId) return section;

        const isSelected = section.selected_accessory_ids.includes(accessoryId);
        return {
          ...section,
          selected_accessory_ids: isSelected
            ? section.selected_accessory_ids.filter((id) => id !== accessoryId)
            : [...section.selected_accessory_ids, accessoryId],
        };
      }),
    );
  };

  const getAccessoriesForCategory = (categoryId: string) => {
    return allAccessories.filter((acc) => acc.category_id === categoryId);
  };

  const getCategoryName = (categoryId: string) => {
    return allCategories.find((c) => c.id === categoryId)?.nom || "";
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Configuration du kit sur-mesure</Label>
        <Button type="button" variant="outline" size="sm" onClick={addSection}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une catégorie
        </Button>
      </div>

      {allCategories.length === 0 && (
        <div className="text-sm text-muted-foreground border rounded-lg p-4 text-center">
          Aucune catégorie trouvée dans le catalogue. Créez des catégories d'abord.
        </div>
      )}

      {value.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Aucune catégorie ajoutée. Cliquez sur "Ajouter une catégorie" pour commencer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {value.map((section, index) => {
            const categoryAccessories = section.category_id ? getAccessoriesForCategory(section.category_id) : [];

            return (
              <Card key={section.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-1">
                      #{index + 1}
                    </Badge>

                    <div className="flex-1 space-y-3">
                      {/* Dropdown Catégorie */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Catégorie</Label>
                        <Select
                          value={section.category_id}
                          onValueChange={(value) => updateSectionCategory(section.id, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir une catégorie..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allCategories.map((category) => {
                              const accessories = getAccessoriesForCategory(category.id);
                              return (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.nom} ({accessories.length} article{accessories.length > 1 ? "s" : ""})
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Liste des accessoires avec checkboxes */}
                      {section.category_id && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">
                              Articles disponibles ({section.selected_accessory_ids.length} sélectionné
                              {section.selected_accessory_ids.length > 1 ? "s" : ""})
                            </Label>
                            {categoryAccessories.length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  const allIds = categoryAccessories.map((a) => a.id);
                                  const allSelected = allIds.every((id) => section.selected_accessory_ids.includes(id));
                                  onChange(
                                    value.map((s) =>
                                      s.id === section.id
                                        ? {
                                            ...s,
                                            selected_accessory_ids: allSelected ? [] : allIds,
                                          }
                                        : s,
                                    ),
                                  );
                                }}
                              >
                                {categoryAccessories.every((a) => section.selected_accessory_ids.includes(a.id))
                                  ? "Tout décocher"
                                  : "Tout cocher"}
                              </Button>
                            )}
                          </div>

                          {categoryAccessories.length === 0 ? (
                            <div className="text-xs text-muted-foreground border rounded p-3 text-center">
                              Aucun accessoire disponible dans cette catégorie
                            </div>
                          ) : (
                            <ScrollArea className="h-48 border rounded-lg">
                              <div className="p-2 space-y-1">
                                {categoryAccessories.map((accessory) => {
                                  const isChecked = section.selected_accessory_ids.includes(accessory.id);

                                  return (
                                    <div
                                      key={accessory.id}
                                      className={`flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors ${
                                        isChecked ? "bg-primary/5" : ""
                                      }`}
                                    >
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() => toggleAccessory(section.id, accessory.id)}
                                      />
                                      {accessory.image_url && (
                                        <img
                                          src={accessory.image_url}
                                          alt={accessory.nom}
                                          className="w-8 h-8 object-cover rounded border"
                                        />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{accessory.nom}</p>
                                        {accessory.marque && (
                                          <p className="text-xs text-muted-foreground">{accessory.marque}</p>
                                        )}
                                      </div>
                                      <p className="text-xs font-semibold text-primary">
                                        {(accessory.prix_vente_ttc || 0).toFixed(2)} €
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </ScrollArea>
                          )}
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeSection(section.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">
          {value.length} section{value.length > 1 ? "s" : ""}
        </Badge>
        <Badge variant="outline">
          {value.reduce((total, section) => total + section.selected_accessory_ids.length, 0)} article
          {value.reduce((total, section) => total + section.selected_accessory_ids.length, 0) > 1 ? "s" : ""}{" "}
          sélectionné{value.reduce((total, section) => total + section.selected_accessory_ids.length, 0) > 1 ? "s" : ""}
        </Badge>
      </div>
    </div>
  );
};
