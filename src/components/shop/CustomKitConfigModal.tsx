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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Save, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

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
  id: string; // ID local temporaire
  category_id: string;
  category_name: string;
  selected_accessory_ids: string[];
}

interface KitProductConfigAdminProps {
  productId: string;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

const KitProductConfigAdmin = ({ productId, productName, open, onOpenChange, onSave }: KitProductConfigAdminProps) => {
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allAccessories, setAllAccessories] = useState<Accessory[]>([]);
  const [kitSections, setKitSections] = useState<KitSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, productId]);

  const loadData = async () => {
    setLoading(true);

    // Charger toutes les catégories disponibles
    const { data: categoriesData, error: categoriesError } = await supabase
      .from("categories")
      .select("id, nom")
      .order("nom");

    if (categoriesError) {
      console.error("Erreur chargement catégories:", categoriesError);
      toast.error("Erreur lors du chargement des catégories");
      setLoading(false);
      return;
    }

    setAllCategories(categoriesData || []);

    // Charger tous les accessoires disponibles dans la boutique
    const { data: accessoriesData, error: accessoriesError } = await supabase
      .from("accessories_catalog")
      .select("id, nom, marque, prix_vente_ttc, category_id, image_url")
      .eq("available_in_shop", true)
      .order("nom");

    if (accessoriesError) {
      console.error("Erreur chargement accessoires:", accessoriesError);
      toast.error("Erreur lors du chargement des accessoires");
      setLoading(false);
      return;
    }

    setAllAccessories(accessoriesData || []);

    // Charger la configuration existante du kit
    const { data: kitItemsData, error: kitItemsError } = await supabase
      .from("shop_product_items")
      .select("accessory_id, accessories_catalog(category_id, categories(nom))")
      .eq("shop_product_id", productId);

    if (kitItemsError) {
      console.error("Erreur chargement configuration kit:", kitItemsError);
    }

    // Regrouper les accessoires par catégorie pour créer les sections
    if (kitItemsData && kitItemsData.length > 0) {
      const sectionsMap = new Map<string, KitSection>();

      kitItemsData.forEach((item: any) => {
        const categoryId = item.accessories_catalog?.category_id;
        const categoryName = item.accessories_catalog?.categories?.nom;

        if (!categoryId) return;

        if (!sectionsMap.has(categoryId)) {
          sectionsMap.set(categoryId, {
            id: `section-${categoryId}-${Date.now()}`,
            category_id: categoryId,
            category_name: categoryName || "",
            selected_accessory_ids: [],
          });
        }

        sectionsMap.get(categoryId)!.selected_accessory_ids.push(item.accessory_id);
      });

      setKitSections(Array.from(sectionsMap.values()));
    } else {
      // Pas de configuration existante, créer une section vide
      setKitSections([]);
    }

    setLoading(false);
  };

  const addNewSection = () => {
    const newSection: KitSection = {
      id: `section-new-${Date.now()}`,
      category_id: "",
      category_name: "",
      selected_accessory_ids: [],
    };
    setKitSections([...kitSections, newSection]);
  };

  const removeSection = (sectionId: string) => {
    setKitSections(kitSections.filter((s) => s.id !== sectionId));
  };

  const updateSectionCategory = (sectionId: string, categoryId: string) => {
    const category = allCategories.find((c) => c.id === categoryId);
    if (!category) return;

    setKitSections(
      kitSections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              category_id: categoryId,
              category_name: category.nom,
              selected_accessory_ids: [], // Réinitialiser la sélection lors du changement de catégorie
            }
          : section,
      ),
    );
  };

  const toggleAccessory = (sectionId: string, accessoryId: string) => {
    setKitSections(
      kitSections.map((section) => {
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

  const handleSave = async () => {
    // Validation
    if (kitSections.length === 0) {
      toast.error("Veuillez ajouter au moins une section");
      return;
    }

    const hasEmptySection = kitSections.some((s) => !s.category_id);
    if (hasEmptySection) {
      toast.error("Toutes les sections doivent avoir une catégorie sélectionnée");
      return;
    }

    const hasNoAccessories = kitSections.some((s) => s.selected_accessory_ids.length === 0);
    if (hasNoAccessories) {
      toast.warning("Attention : certaines sections n'ont aucun accessoire sélectionné");
    }

    setSaving(true);

    // Supprimer l'ancienne configuration
    const { error: deleteError } = await supabase.from("shop_product_items").delete().eq("shop_product_id", productId);

    if (deleteError) {
      console.error("Erreur suppression ancienne config:", deleteError);
      toast.error("Erreur lors de la sauvegarde");
      setSaving(false);
      return;
    }

    // Créer la nouvelle configuration
    const itemsToInsert = kitSections.flatMap((section) =>
      section.selected_accessory_ids.map((accessoryId) => ({
        shop_product_id: productId,
        accessory_id: accessoryId,
      })),
    );

    if (itemsToInsert.length > 0) {
      const { error: insertError } = await supabase.from("shop_product_items").insert(itemsToInsert);

      if (insertError) {
        console.error("Erreur insertion nouvelle config:", insertError);
        toast.error("Erreur lors de la sauvegarde");
        setSaving(false);
        return;
      }
    }

    toast.success("Configuration du kit sauvegardée");
    setSaving(false);
    onSave?.();
    onOpenChange(false);
  };

  const getTotalSelectedAccessories = () => {
    return kitSections.reduce((total, section) => total + section.selected_accessory_ids.length, 0);
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <PackagePlus className="h-6 w-6" />
            Configuration du kit : {productName}
          </DialogTitle>
          <DialogDescription>
            Ajoutez des catégories et sélectionnez les articles qui apparaîtront dans chaque dropdown du configurateur
            client.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2 border-y">
          <div className="flex items-center gap-4">
            <Badge variant="secondary">
              {kitSections.length} section{kitSections.length > 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline">
              {getTotalSelectedAccessories()} article{getTotalSelectedAccessories() > 1 ? "s" : ""} sélectionné
              {getTotalSelectedAccessories() > 1 ? "s" : ""}
            </Badge>
          </div>
          <Button onClick={addNewSection} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une catégorie
          </Button>
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-4">
            {kitSections.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <PackagePlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">Aucune section configurée</p>
                <Button onClick={addNewSection} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter votre première catégorie
                </Button>
              </div>
            ) : (
              <Accordion type="multiple" className="w-full space-y-3">
                {kitSections.map((section, index) => {
                  const categoryAccessories = section.category_id ? getAccessoriesForCategory(section.category_id) : [];

                  return (
                    <AccordionItem key={section.id} value={section.id} className="border-2 rounded-lg px-4">
                      <div className="flex items-center gap-3">
                        <AccordionTrigger className="flex-1 hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">Section {index + 1}</Badge>
                              <span className="font-semibold">
                                {section.category_name || "Catégorie non sélectionnée"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {section.selected_accessory_ids.length > 0 && (
                                <Badge variant="default">
                                  {section.selected_accessory_ids.length} article
                                  {section.selected_accessory_ids.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSection(section.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <AccordionContent className="pt-4">
                        <div className="space-y-4">
                          {/* Sélection de la catégorie */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Choisir la catégorie :</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {allCategories.map((category) => {
                                const isSelected = section.category_id === category.id;
                                const accessories = getAccessoriesForCategory(category.id);

                                return (
                                  <button
                                    key={category.id}
                                    onClick={() => updateSectionCategory(section.id, category.id)}
                                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                                      isSelected
                                        ? "border-primary bg-primary/10"
                                        : "border-border hover:border-primary/50"
                                    }`}
                                  >
                                    <div className="font-medium text-sm">{category.nom}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {accessories.length} article{accessories.length > 1 ? "s" : ""}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <Separator />

                          {/* Sélection des articles */}
                          {section.category_id ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Articles à afficher dans le dropdown :</label>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const allAccessoryIds = categoryAccessories.map((acc) => acc.id);
                                    const allSelected = allAccessoryIds.every((id) =>
                                      section.selected_accessory_ids.includes(id),
                                    );

                                    setKitSections(
                                      kitSections.map((s) =>
                                        s.id === section.id
                                          ? {
                                              ...s,
                                              selected_accessory_ids: allSelected ? [] : allAccessoryIds,
                                            }
                                          : s,
                                      ),
                                    );
                                  }}
                                >
                                  {categoryAccessories.every((acc) => section.selected_accessory_ids.includes(acc.id))
                                    ? "Tout décocher"
                                    : "Tout cocher"}
                                </Button>
                              </div>

                              {categoryAccessories.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                                  Aucun accessoire disponible dans cette catégorie
                                </p>
                              ) : (
                                <div className="grid gap-2 max-h-96 overflow-y-auto pr-2">
                                  {categoryAccessories.map((accessory) => {
                                    const isChecked = section.selected_accessory_ids.includes(accessory.id);

                                    return (
                                      <div
                                        key={accessory.id}
                                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                                          isChecked
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50"
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
                                            className="w-12 h-12 object-cover rounded border"
                                          />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-sm truncate">{accessory.nom}</p>
                                          {accessory.marque && (
                                            <p className="text-xs text-muted-foreground">{accessory.marque}</p>
                                          )}
                                        </div>
                                        <p className="text-sm font-semibold text-primary">
                                          {(accessory.prix_vente_ttc || 0).toFixed(2)} €
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
                              👆 Sélectionnez d'abord une catégorie ci-dessus
                            </p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Sauvegarde..." : "Sauvegarder la configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KitProductConfigAdmin;
