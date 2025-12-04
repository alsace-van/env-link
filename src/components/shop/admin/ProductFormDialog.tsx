import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccessorySelector } from "./AccessorySelector";
import { Plus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProductFormDialogProps {
  productId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface KitSection {
  id: string;
  category_id: string;
  selected_accessory_ids: string[];
}

interface CatalogCategory {
  id: string;
  nom: string;
}

interface CatalogAccessory {
  id: string;
  nom: string;
  marque?: string;
  prix_vente_ttc?: number;
  category_id: string;
  image_url?: string;
}

export const ProductFormDialog = ({ productId, isOpen, onClose, onSuccess }: ProductFormDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [showNewCategoryDialog, setShowNewCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formData, setFormData] = useState({
    nom: "",
    description: "",
    product_type: "simple",
    category_id: "",
    prix_base: 0,
    image_url: "",
    is_active: true,
    stock_quantity: 0,
  });
  const [selectedAccessories, setSelectedAccessories] = useState<any[]>([]);

  // États pour les kits sur-mesure avec dropdowns en cascade
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
  const [catalogAccessories, setCatalogAccessories] = useState<CatalogAccessory[]>([]);
  const [kitSections, setKitSections] = useState<KitSection[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      loadCatalogData(); // Charger les catégories et accessoires du catalogue
      if (productId) {
        loadProduct();
      } else {
        // Reset form for new product
        setFormData({
          nom: "",
          description: "",
          product_type: "simple",
          category_id: "",
          prix_base: 0,
          image_url: "",
          is_active: true,
          stock_quantity: 0,
        });
        setSelectedAccessories([]);
        setKitSections([]);
      }
    }
  }, [isOpen, productId]);

  const loadCategories = async () => {
    const { data } = await supabase
      .from("shop_categories" as any)
      .select("*")
      .order("nom");
    if (data) setCategories(data);
  };

  // Charger les catégories et accessoires du CATALOGUE (pas de la boutique)
  const loadCatalogData = async () => {
    // Charger TOUTES les catégories du catalogue
    const { data: catData, error: catError } = await supabase.from("categories").select("id, nom").order("nom");

    if (catError) {
      console.error("Erreur chargement catégories catalogue:", catError);
    } else {
      console.log("Catégories du catalogue chargées:", catData);
      setCatalogCategories(catData || []);
    }

    // Charger TOUS les accessoires disponibles dans la boutique
    const { data: accData, error: accError } = await supabase
      .from("accessories_catalog")
      .select("id, nom, marque, prix_vente_ttc, category_id, image_url")
      .eq("available_in_shop", true)
      .order("nom");

    if (accError) {
      console.error("Erreur chargement accessoires:", accError);
    } else {
      console.log("Accessoires chargés:", accData);
      setCatalogAccessories(accData || []);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("shop_categories" as any)
      .insert({ nom: newCategoryName, user_id: userData.user?.id })
      .select()
      .single();

    if (error) {
      toast.error("Erreur lors de la création");
      return;
    }

    if (data) {
      const newCategory = data as any;
      setCategories([...categories, newCategory]);
      setFormData({ ...formData, category_id: newCategory.id });
      setNewCategoryName("");
      setShowNewCategoryDialog(false);
      toast.success("Catégorie créée");
    }
  };

  const loadProduct = async () => {
    if (!productId) return;

    const { data: product } = await supabase
      .from("shop_products" as any)
      .select("*")
      .eq("id", productId)
      .single();

    if (product) {
      setFormData(product as any);

      // Pour les kits sur-mesure, charger depuis shop_custom_kits et shop_custom_kit_accessories
      if ((product as any).product_type === "custom_kit") {
        // Charger les accessoires du kit groupés par catégorie
        const { data: kitAccessories } = await supabase
          .from("shop_custom_kit_accessories" as any)
          .select("accessory_id, accessories_catalog(category_id)")
          .eq("custom_kit_id", productId);

        if (kitAccessories && kitAccessories.length > 0) {
          // Regrouper par catégorie
          const sectionsMap = new Map<string, string[]>();

          (kitAccessories as any[]).forEach((item) => {
            const categoryId = item.accessories_catalog?.category_id;
            if (!categoryId) return;

            if (!sectionsMap.has(categoryId)) {
              sectionsMap.set(categoryId, []);
            }
            sectionsMap.get(categoryId)!.push(item.accessory_id);
          });

          const loadedSections: KitSection[] = Array.from(sectionsMap.entries()).map(
            ([categoryId, accessoryIds], index) => ({
              id: `section-${categoryId}-${index}`,
              category_id: categoryId,
              selected_accessory_ids: accessoryIds,
            }),
          );

          setKitSections(loadedSections);
        }
      } else {
        // Pour les autres types, charger depuis shop_product_items
        const { data: items } = await supabase
          .from("shop_product_items" as any)
          .select("*, accessory:accessories_catalog(*)")
          .eq("shop_product_id", productId);

        if (items) {
          setSelectedAccessories(items);
        }
      }
    }
  };

  // Fonctions pour gérer les sections du kit sur-mesure
  const addKitSection = () => {
    const newSection: KitSection = {
      id: `section-new-${Date.now()}`,
      category_id: "",
      selected_accessory_ids: [],
    };
    setKitSections([...kitSections, newSection]);
  };

  const removeKitSection = (sectionId: string) => {
    setKitSections(kitSections.filter((s) => s.id !== sectionId));
  };

  const updateKitSectionCategory = (sectionId: string, categoryId: string) => {
    setKitSections(
      kitSections.map((section) =>
        section.id === sectionId ? { ...section, category_id: categoryId, selected_accessory_ids: [] } : section,
      ),
    );
  };

  const toggleKitAccessory = (sectionId: string, accessoryId: string) => {
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
    return catalogAccessories.filter((acc) => acc.category_id === categoryId);
  };

  const getCategoryName = (categoryId: string) => {
    return catalogCategories.find((c) => c.id === categoryId)?.nom || "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      let targetProductId = productId;

      // Pour les kits sur-mesure, gérer différemment
      if (formData.product_type === "custom_kit") {
        // Extraire les catégories uniques et tous les accessoires sélectionnés
        const uniqueCategoryIds = [...new Set(kitSections.map((s) => s.category_id).filter(Boolean))];
        const allAccessoryIds = kitSections.flatMap((s) => s.selected_accessory_ids);

        if (productId) {
          // Mise à jour du kit existant
          await supabase
            .from("shop_products" as any)
            .update({
              ...formData,
              allowed_category_ids: uniqueCategoryIds,
            })
            .eq("id", productId);

          // Supprimer les anciens accessoires du kit
          await supabase
            .from("shop_custom_kit_accessories" as any)
            .delete()
            .eq("custom_kit_id", productId);

          // Mettre à jour shop_custom_kits si existe
          const { data: existingKit } = await supabase
            .from("shop_custom_kits")
            .select("id")
            .eq("id", productId)
            .maybeSingle();

          if (existingKit) {
            await supabase
              .from("shop_custom_kits")
              .update({
                nom: formData.nom,
                description: formData.description,
                prix_base: formData.prix_base,
                is_active: formData.is_active,
                allowed_category_ids: uniqueCategoryIds,
              })
              .eq("id", productId);
          }
        } else {
          // Création d'un nouveau kit
          const { data: newProduct } = await supabase
            .from("shop_products" as any)
            .insert({
              ...formData,
              user_id: userData.user?.id,
              allowed_category_ids: uniqueCategoryIds,
            })
            .select()
            .single();

          targetProductId = (newProduct as any)?.id;

          // Créer aussi dans shop_custom_kits
          if (targetProductId) {
            await supabase.from("shop_custom_kits").insert({
              id: targetProductId,
              user_id: userData.user?.id,
              nom: formData.nom,
              description: formData.description,
              prix_base: formData.prix_base,
              is_active: formData.is_active,
              allowed_category_ids: uniqueCategoryIds,
            });
          }
        }

        // Insérer les accessoires du kit
        if (targetProductId && allAccessoryIds.length > 0) {
          const kitAccessoriesData = allAccessoryIds.map((accId) => ({
            custom_kit_id: targetProductId,
            accessory_id: accId,
            default_quantity: 1,
          }));

          await supabase.from("shop_custom_kit_accessories" as any).insert(kitAccessoriesData);
        }
      } else {
        // Pour les produits simples et bundles (logique existante)
        if (productId) {
          // Mise à jour du produit existant
          await supabase
            .from("shop_products" as any)
            .update(formData)
            .eq("id", productId);

          // Supprimer les anciens accessoires
          await supabase
            .from("shop_product_items" as any)
            .delete()
            .eq("shop_product_id", productId);
        } else {
          // Création d'un nouveau produit
          const dataToSave = {
            ...formData,
            user_id: userData.user?.id,
          };

          const { data: newProduct } = await supabase
            .from("shop_products" as any)
            .insert(dataToSave)
            .select()
            .single();

          targetProductId = (newProduct as any)?.id;
        }

        // Insérer les accessoires (pour création ET modification)
        if (targetProductId && selectedAccessories.length > 0) {
          const items = selectedAccessories.map((acc) => ({
            shop_product_id: targetProductId,
            accessory_id: acc.accessory_id || acc.id,
            default_quantity: acc.default_quantity || 1,
            is_required: acc.is_required !== false,
          }));

          await supabase.from("shop_product_items" as any).insert(items);
        }
      }

      toast.success(productId ? "Produit modifié" : "Produit créé");
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{productId ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto flex-1 px-3 py-3">
          <Tabs defaultValue="general">
            <TabsList
              className={`grid w-full ${formData.product_type === "custom_kit" ? "grid-cols-2" : "grid-cols-3"}`}
            >
              <TabsTrigger value="general">Général</TabsTrigger>
              {formData.product_type !== "custom_kit" && <TabsTrigger value="accessories">Accessoires</TabsTrigger>}
              <TabsTrigger value="pricing">Tarification</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <div>
                <Label>Nom du produit</Label>
                <Input
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type de produit</Label>
                  <Select
                    value={formData.product_type}
                    onValueChange={(value) => {
                      setFormData({ ...formData, product_type: value });
                      // Reset les sections du kit si on change de type
                      if (value !== "custom_kit") {
                        setKitSections([]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Produit simple</SelectItem>
                      <SelectItem value="bundle">Bundle</SelectItem>
                      <SelectItem value="custom_kit">Kit sur-mesure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Catégorie</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowNewCategoryDialog(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {showNewCategoryDialog && (
                    <div className="mt-2 p-3 border rounded-lg space-y-2">
                      <Input
                        placeholder="Nom de la catégorie"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleCreateCategory}>
                          Créer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowNewCategoryDialog(false);
                            setNewCategoryName("");
                          }}
                        >
                          Annuler
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prix de base (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.prix_base}
                    onChange={(e) => setFormData({ ...formData, prix_base: parseFloat(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <Label>Stock</Label>
                  <Input
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label>URL de l'image</Label>
                <Input
                  value={formData.image_url || ""}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Produit actif</Label>
              </div>

              {/* Section Kit Sur-Mesure avec dropdowns en cascade */}
              {formData.product_type === "custom_kit" && (
                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Configuration du kit sur-mesure</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addKitSection}>
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter une catégorie
                    </Button>
                  </div>

                  {catalogCategories.length === 0 && (
                    <div className="text-sm text-muted-foreground border rounded-lg p-4 text-center">
                      Aucune catégorie trouvée dans le catalogue. Créez des catégories d'abord.
                    </div>
                  )}

                  {kitSections.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p className="text-sm text-muted-foreground mb-3">
                          Aucune catégorie ajoutée. Cliquez sur "Ajouter une catégorie" pour commencer.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {kitSections.map((section, index) => {
                        const categoryAccessories = section.category_id
                          ? getAccessoriesForCategory(section.category_id)
                          : [];

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
                                    <Label className="text-xs">Catégorie du catalogue</Label>
                                    <Select
                                      value={section.category_id}
                                      onValueChange={(value) => updateKitSectionCategory(section.id, value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Choisir une catégorie..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {catalogCategories.map((category) => {
                                          const accessories = getAccessoriesForCategory(category.id);
                                          return (
                                            <SelectItem key={category.id} value={category.id}>
                                              {category.nom} ({accessories.length} article
                                              {accessories.length > 1 ? "s" : ""})
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
                                              const allSelected = allIds.every((id) =>
                                                section.selected_accessory_ids.includes(id),
                                              );
                                              setKitSections(
                                                kitSections.map((s) =>
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
                                            {categoryAccessories.every((a) =>
                                              section.selected_accessory_ids.includes(a.id),
                                            )
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
                                                  className={`flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors cursor-pointer ${
                                                    isChecked ? "bg-primary/5" : ""
                                                  }`}
                                                  onClick={() => toggleKitAccessory(section.id, accessory.id)}
                                                >
                                                  <Checkbox
                                                    checked={isChecked}
                                                    onCheckedChange={() => toggleKitAccessory(section.id, accessory.id)}
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
                                                      <p className="text-xs text-muted-foreground">
                                                        {accessory.marque}
                                                      </p>
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
                                  onClick={() => removeKitSection(section.id)}
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
                      {kitSections.length} section{kitSections.length > 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline">
                      {kitSections.reduce((total, section) => total + section.selected_accessory_ids.length, 0)} article
                      {kitSections.reduce((total, section) => total + section.selected_accessory_ids.length, 0) > 1
                        ? "s"
                        : ""}{" "}
                      sélectionné
                      {kitSections.reduce((total, section) => total + section.selected_accessory_ids.length, 0) > 1
                        ? "s"
                        : ""}
                    </Badge>
                  </div>
                </div>
              )}
            </TabsContent>

            {formData.product_type !== "custom_kit" && (
              <TabsContent value="accessories">
                <AccessorySelector
                  selectedAccessories={selectedAccessories}
                  onChange={setSelectedAccessories}
                  productType={formData.product_type}
                />
              </TabsContent>
            )}

            <TabsContent value="pricing">
              <div className="text-center py-8 text-muted-foreground">
                Configuration des prix dégressifs et promotions à venir
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
