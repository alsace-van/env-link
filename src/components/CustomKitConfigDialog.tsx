import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Plus, Trash2, Copy, Tag, TrendingDown, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAccessoryTieredPricing } from "@/hooks/useAccessoryTieredPricing";

interface Category {
  id: string;
  nom: string;
}

interface AccessoryOption {
  id: string;
  nom: string;
  prix_vente_ttc: number;
  prix_reference?: number;
  marge_pourcent?: number;
  marge_nette?: number;
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
  puissance_watts?: number;
  poids_kg?: number;
  longueur_mm?: number;
  largeur_mm?: number;
  hauteur_mm?: number;
  promo_active?: boolean;
  promo_price?: number;
  promo_start_date?: string;
  promo_end_date?: string;
  image_url?: string;
}

interface CategoryInstance {
  id: string;
  categoryId: string;
  categoryName: string;
  accessoryId?: string;
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
  const [allowedCategories, setAllowedCategories] = useState<Category[]>([]);
  const [accessoriesByCategory, setAccessoriesByCategory] = useState<Map<string, Accessory[]>>(new Map());
  const [categoryInstances, setCategoryInstances] = useState<CategoryInstance[]>([]);
  const [accessoryTieredPricing, setAccessoryTieredPricing] = useState<Map<string, any[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [detailsAccessory, setDetailsAccessory] = useState<Accessory | null>(null);

  useEffect(() => {
    if (open) {
      loadKitConfiguration();
    } else {
      // Reset when closing
      setCategoryInstances([]);
    }
  }, [open, productId]);

  const loadKitConfiguration = async () => {
    setLoading(true);

    // Charger la configuration du kit
    // @ts-expect-error - Table shop_custom_kits not in Supabase types
    const result: any = await supabase
      .from("shop_custom_kits")
      .select("allowed_category_ids")
      .eq("product_id", productId)
      .single();
    const { data: kitData, error: kitError } = result;

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

    // Initialiser une instance par catégorie
    const initialInstances: CategoryInstance[] = (categoriesData || []).map((cat) => ({
      id: `${cat.id}-${Date.now()}-${Math.random()}`,
      categoryId: cat.id,
      categoryName: cat.nom,
      quantity: 1,
      selectedOptions: [],
    }));
    setCategoryInstances(initialInstances);

    // Charger les accessoires disponibles pour chaque catégorie
    const { data: accessoriesData, error: accessoriesError } = await supabase
      .from("accessories_catalog")
      .select(
        "id, nom, marque, prix_vente_ttc, category_id, description, couleur, puissance_watts, poids_kg, longueur_mm, largeur_mm, hauteur_mm, promo_active, promo_price, promo_start_date, promo_end_date, image_url",
      )
      .in("category_id", categoryIds)
      .eq("available_in_shop", true);

    // 🔍 LOGS DE DIAGNOSTIC
    console.log("=== DIAGNOSTIC KIT CONFIGURATION ===");
    console.log("1. Category IDs configurés:", categoryIds);
    console.log("2. Nombre d'accessoires trouvés:", accessoriesData?.length || 0);
    console.log("3. Accessoires:", accessoriesData);
    if (accessoriesData?.length === 0) {
      console.warn("⚠️ AUCUN ACCESSOIRE TROUVÉ !");
      console.warn("Vérifiez que les accessoires ont 'available_in_shop = true'");
    }
    console.log("====================================");

    if (accessoriesError) {
      console.error("Erreur lors du chargement des accessoires:", accessoriesError);
      toast.error("Erreur lors du chargement des accessoires");
      setLoading(false);
      return;
    }

    // Charger les options pour tous les accessoires
    const accessoryIds = (accessoriesData || []).map((a: any) => a.id);
    const { data: optionsData } = await supabase.from("accessory_options").select("*").in("accessory_id", accessoryIds);

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
    (accessoriesData || []).forEach((accessory: any) => {
      const categoryId = accessory.category_id;
      if (!accessoriesMap.has(categoryId)) {
        accessoriesMap.set(categoryId, []);
      }
      accessoriesMap.get(categoryId)!.push({
        ...accessory,
        options: optionsByAccessory.get(accessory.id) || [],
      } as any);
    });

    setAccessoriesByCategory(accessoriesMap);

    // Charger les prix dégressifs pour tous les accessoires
    const { data: tieredPricingData } = await supabase
      .from("accessory_tiered_pricing")
      .select("accessory_id, min_quantity as article_position, prix_unitaire as discount_percent")
      .in("accessory_id", accessoryIds)
      .order("min_quantity") as any;

    const tieredPricingMap = new Map<string, any[]>();
    (tieredPricingData || []).forEach((tier) => {
      if (!tieredPricingMap.has(tier.accessory_id)) {
        tieredPricingMap.set(tier.accessory_id, []);
      }
      tieredPricingMap.get(tier.accessory_id)!.push(tier);
    });

    setAccessoryTieredPricing(tieredPricingMap);
    setLoading(false);
  };

  const duplicateCategory = (categoryId: string) => {
    const category = allowedCategories.find((c) => c.id === categoryId);
    if (category) {
      const newInstance: CategoryInstance = {
        id: `${categoryId}-${Date.now()}-${Math.random()}`,
        categoryId: category.id,
        categoryName: category.nom,
        quantity: 1,
        selectedOptions: [],
      };
      setCategoryInstances((prev) => [...prev, newInstance]);
    }
  };

  const removeInstance = (instanceId: string) => {
    setCategoryInstances((prev) => prev.filter((inst) => inst.id !== instanceId));
  };

  const updateInstanceAccessory = (instanceId: string, accessoryId: string | undefined) => {
    setCategoryInstances((prev) =>
      prev.map((inst) =>
        inst.id === instanceId
          ? {
              ...inst,
              accessoryId,
              quantity: 1,
              selectedOptions: [],
              color: undefined, // Reset color when changing accessory
            }
          : inst,
      ),
    );
  };

  const updateInstanceQuantity = (instanceId: string, quantity: number) => {
    if (quantity < 1) return;
    setCategoryInstances((prev) => prev.map((inst) => (inst.id === instanceId ? { ...inst, quantity } : inst)));
  };

  const updateInstanceColor = (instanceId: string, color: string) => {
    setCategoryInstances((prev) => prev.map((inst) => (inst.id === instanceId ? { ...inst, color } : inst)));
  };

  const toggleInstanceOption = (instanceId: string, optionId: string) => {
    setCategoryInstances((prev) =>
      prev.map((inst) => {
        if (inst.id === instanceId) {
          const selectedOptions = inst.selectedOptions.includes(optionId)
            ? inst.selectedOptions.filter((id) => id !== optionId)
            : [...inst.selectedOptions, optionId];
          return { ...inst, selectedOptions };
        }
        return inst;
      }),
    );
  };

  const calculateInstancePrice = (instance: CategoryInstance, usePricing = true) => {
    if (!instance.accessoryId) return 0;

    const accessories = accessoriesByCategory.get(instance.categoryId) || [];
    const accessory = accessories.find((a) => a.id === instance.accessoryId);
    if (!accessory) return 0;

    let basePrice = accessory.prix_vente_ttc || 0;

    // Appliquer la promo si active
    if (usePricing && accessory.promo_active && accessory.promo_price) {
      const now = new Date();
      const start = accessory.promo_start_date ? new Date(accessory.promo_start_date) : null;
      const end = accessory.promo_end_date ? new Date(accessory.promo_end_date) : null;

      if ((!start || now >= start) && (!end || now <= end)) {
        basePrice = accessory.promo_price;
      }
    }

    // Calculer le prix avec options
    let optionsPrice = 0;
    instance.selectedOptions.forEach((optionId) => {
      const option = accessory.options?.find((o) => o.id === optionId);
      if (option) {
        optionsPrice += option.prix_vente_ttc;
      }
    });

    // Appliquer les prix dégressifs si configurés
    const tiers = accessoryTieredPricing.get(instance.accessoryId!) || [];
    if (usePricing && tiers.length > 0) {
      let totalPrice = 0;
      for (let position = 1; position <= instance.quantity; position++) {
        const applicableTier = [...tiers].reverse().find((tier) => position >= tier.article_position);

        let itemPrice = basePrice;
        if (applicableTier) {
          itemPrice = basePrice * (1 - applicableTier.discount_percent / 100);
        }
        totalPrice += itemPrice + optionsPrice;
      }
      return totalPrice;
    }

    return (basePrice + optionsPrice) * instance.quantity;
  };

  const getAccessoryPricing = (accessoryId: string, quantity: number) => {
    const tieredPricing = useAccessoryTieredPricing(accessoryId);
    return tieredPricing;
  };

  const calculateTotalPrice = () => {
    let total = basePrice;
    categoryInstances.forEach((instance) => {
      total += calculateInstancePrice(instance);
    });
    return total;
  };

  const getAccessoryById = (categoryId: string, accessoryId: string) => {
    const accessories = accessoriesByCategory.get(categoryId) || [];
    return accessories.find((a) => a.id === accessoryId);
  };

  const handleAddToCart = () => {
    const configuredInstances = categoryInstances.filter((inst) => inst.accessoryId);
    if (configuredInstances.length === 0) {
      toast.error("Configurez au moins un accessoire dans le kit");
      return;
    }

    // Préparer la configuration pour le panier
    const configuration = {
      items: configuredInstances.map((inst) => {
        const accessory = getAccessoryById(inst.categoryId, inst.accessoryId!);
        const selectedOptionsDetails = inst.selectedOptions.map((optId) => {
          const option = accessory?.options?.find((o) => o.id === optId);
          return {
            id: optId,
            name: option?.nom,
            price: option?.prix_vente_ttc,
          };
        });

        return {
          categoryName: inst.categoryName,
          accessoryId: inst.accessoryId,
          accessoryName: accessory?.nom,
          quantity: inst.quantity,
          color: inst.color,
          selectedOptions: selectedOptionsDetails,
          itemPrice: calculateInstancePrice(inst),
        };
      }),
    };

    const totalPrice = calculateTotalPrice();

    if (onAddToCart) {
      onAddToCart(configuration, totalPrice);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{productName}</DialogTitle>
          <DialogDescription>
            Configurez votre kit en choisissant des accessoires. Vous pouvez dupliquer une catégorie pour ajouter
            plusieurs articles différents.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Chargement de la configuration...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonne de gauche - Configuration des instances */}
            <div className="lg:col-span-2">
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-3">
                  {allowedCategories.map((category) => {
                    const categoryAccessories = accessoriesByCategory.get(category.id) || [];
                    const instances = categoryInstances.filter((inst) => inst.categoryId === category.id);

                    if (categoryAccessories.length === 0) return null;

                    return (
                      <Card key={category.id}>
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-sm">{category.nom}</CardTitle>
                              <Badge variant="secondary" className="text-xs">
                                {categoryAccessories.length} accessoires
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => duplicateCategory(category.id)}
                              className="h-7 text-xs px-2"
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Dupliquer
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 px-3 pb-3">
                          {instances.map((instance, idx) => {
                            const selectedAccessory = instance.accessoryId
                              ? getAccessoryById(instance.categoryId, instance.accessoryId)
                              : null;

                            return (
                              <Card key={instance.id} className="border-primary/20 bg-muted/30">
                                <CardContent className="p-3">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Badge variant="outline" className="text-xs">
                                        Choix {idx + 1}
                                      </Badge>
                                      {instances.length > 1 && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => removeInstance(instance.id)}
                                          className="text-destructive h-7 px-2"
                                        >
                                          <Trash2 className="h-3 w-3 mr-1" />
                                          Retirer
                                        </Button>
                                      )}
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-xs">Accessoire</Label>
                                      <Select
                                        value={instance.accessoryId || "none"}
                                        onValueChange={(value) =>
                                          updateInstanceAccessory(instance.id, value === "none" ? undefined : value)
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Sélectionner un accessoire..." />
                                        </SelectTrigger>
                                        <SelectContent className="max-w-[400px]">
                                          {/* Option pour désélectionner */}
                                          <SelectItem value="none">-</SelectItem>
                                          {categoryAccessories.map((accessory) => (
                                            <SelectItem
                                              key={accessory.id}
                                              value={accessory.id}
                                              className="whitespace-normal"
                                            >
                                              <div className="flex flex-col gap-0.5 py-1 w-full max-w-full">
                                                <span className="font-medium break-words whitespace-normal block">
                                                  {accessory.nom}
                                                </span>
                                                <span className="text-xs text-muted-foreground break-words whitespace-normal block">
                                                  {accessory.prix_vente_ttc?.toFixed(2)} €
                                                  {accessory.marque && ` - ${accessory.marque}`}
                                                </span>
                                                {(accessory.puissance_watts ||
                                                  accessory.poids_kg ||
                                                  accessory.longueur_mm) && (
                                                  <span className="text-xs text-muted-foreground break-words whitespace-normal block">
                                                    {accessory.puissance_watts && `${accessory.puissance_watts}W`}
                                                    {accessory.puissance_watts &&
                                                      (accessory.poids_kg || accessory.longueur_mm) &&
                                                      " • "}
                                                    {accessory.poids_kg && `${accessory.poids_kg}kg`}
                                                    {accessory.poids_kg && accessory.longueur_mm && " • "}
                                                    {accessory.longueur_mm &&
                                                      `${accessory.longueur_mm}×${accessory.largeur_mm}×${accessory.hauteur_mm}mm`}
                                                  </span>
                                                )}
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {selectedAccessory && (
                                      <div className="space-y-2">
                                        {/* Bouton Voir les détails */}
                                        <div className="flex justify-end">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setDetailsAccessory(selectedAccessory)}
                                            className="gap-2"
                                          >
                                            <Eye className="h-4 w-4" />
                                            Voir les détails
                                          </Button>
                                        </div>

                                        <div
                                          className={`grid gap-3 ${selectedAccessory.image_url ? "grid-cols-[200px,1fr]" : "grid-cols-1"}`}
                                        >
                                        {selectedAccessory.image_url && (
                                          <div className="rounded-md overflow-hidden border bg-muted/50 h-48">
                                            <img
                                              src={selectedAccessory.image_url}
                                              alt={selectedAccessory.nom}
                                              className="w-full h-full object-contain"
                                            />
                                          </div>
                                        )}

                                        <div className="space-y-2">
                                          <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                              <Label className="text-xs">Quantité</Label>
                                              <Input
                                                type="number"
                                                min="1"
                                                value={instance.quantity}
                                                onChange={(e) =>
                                                  updateInstanceQuantity(instance.id, parseInt(e.target.value))
                                                }
                                                className="h-8 text-sm"
                                              />
                                            </div>

                                            {selectedAccessory.couleur &&
                                              (() => {
                                                // Parse les couleurs depuis le JSON
                                                let availableColors: string[] = [];
                                                try {
                                                  const parsed = JSON.parse(selectedAccessory.couleur);
                                                  availableColors = Array.isArray(parsed)
                                                    ? parsed
                                                    : [selectedAccessory.couleur];
                                                } catch {
                                                  availableColors = [selectedAccessory.couleur];
                                                }

                                                // Filtrer les couleurs disponibles (insensible à la casse)
                                                const filteredColors = AVAILABLE_COLORS.filter((color) =>
                                                  availableColors.some(
                                                    (ac) => ac.toLowerCase() === color.value.toLowerCase(),
                                                  ),
                                                );

                                                if (filteredColors.length === 0) return null;

                                                return (
                                                  <div className="space-y-1">
                                                    <Label className="text-xs">Couleur</Label>
                                                    <div className="flex gap-1.5 flex-wrap">
                                                      {filteredColors.map((color) => (
                                                        <button
                                                          key={color.value}
                                                          type="button"
                                                          onClick={() => updateInstanceColor(instance.id, color.value)}
                                                          className={`w-7 h-7 rounded-full border-2 transition-all ${
                                                            instance.color === color.value
                                                              ? "border-primary ring-2 ring-primary ring-offset-2"
                                                              : "border-muted hover:border-primary/50"
                                                          }`}
                                                          style={{
                                                            backgroundColor:
                                                              color.value === "blanc"
                                                                ? "#ffffff"
                                                                : color.value === "noir"
                                                                  ? "#000000"
                                                                  : color.value === "gris"
                                                                    ? "#6b7280"
                                                                    : color.value === "rouge"
                                                                      ? "#ef4444"
                                                                      : color.value === "bleu"
                                                                        ? "#3b82f6"
                                                                        : color.value === "vert"
                                                                          ? "#22c55e"
                                                                          : color.value === "jaune"
                                                                            ? "#eab308"
                                                                            : color.value === "orange"
                                                                              ? "#f97316"
                                                                              : "#6b7280",
                                                          }}
                                                          title={color.label}
                                                        />
                                                      ))}
                                                    </div>
                                                  </div>
                                                );
                                              })()}
                                          </div>

                                          {selectedAccessory.options && selectedAccessory.options.length > 0 && (
                                            <div className="space-y-1.5">
                                              <Label className="text-xs">Options disponibles</Label>
                                              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                                {selectedAccessory.options.map((option) => (
                                                  <div
                                                    key={option.id}
                                                    className="flex items-start gap-2 p-2 rounded hover:bg-muted/50 transition-colors"
                                                  >
                                                    <Checkbox
                                                      id={`${instance.id}-${option.id}`}
                                                      checked={instance.selectedOptions.includes(option.id)}
                                                      onCheckedChange={() =>
                                                        toggleInstanceOption(instance.id, option.id)
                                                      }
                                                      className="h-4 w-4 mt-0.5 shrink-0"
                                                    />
                                                    <label
                                                      htmlFor={`${instance.id}-${option.id}`}
                                                      className="text-xs cursor-pointer flex-1 min-w-0 break-words leading-relaxed"
                                                    >
                                                      {option.nom}
                                                    </label>
                                                    <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                                                      +{option.prix_vente_ttc.toFixed(2)} €
                                                    </Badge>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* Affichage des remises actives */}
                                          {instance.accessoryId &&
                                            (() => {
                                              const tiers = accessoryTieredPricing.get(instance.accessoryId!) || [];
                                              const applicableTier = [...tiers]
                                                .reverse()
                                                .find((tier) => instance.quantity >= tier.article_position);
                                              const nextTier = tiers.find(
                                                (tier) => tier.article_position > instance.quantity,
                                              );

                                              return (
                                                <div className="space-y-2">
                                                  {applicableTier && (
                                                    <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-md">
                                                      <TrendingDown className="h-4 w-4 text-green-600" />
                                                      <span className="text-xs font-medium text-green-700 dark:text-green-400">
                                                        Prix dégressif: -{applicableTier.discount_percent}% à partir de
                                                        l'article {applicableTier.article_position}
                                                      </span>
                                                    </div>
                                                  )}

                                                  {nextTier && (
                                                    <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-md">
                                                      <Tag className="h-4 w-4 text-blue-600" />
                                                      <span className="text-xs text-blue-700 dark:text-blue-400">
                                                        Achetez {nextTier.article_position - instance.quantity} de plus
                                                        pour -{nextTier.discount_percent}%
                                                      </span>
                                                    </div>
                                                  )}

                                                  {selectedAccessory.promo_active &&
                                                    selectedAccessory.promo_price &&
                                                    (() => {
                                                      const now = new Date();
                                                      const start = selectedAccessory.promo_start_date
                                                        ? new Date(selectedAccessory.promo_start_date)
                                                        : null;
                                                      const end = selectedAccessory.promo_end_date
                                                        ? new Date(selectedAccessory.promo_end_date)
                                                        : null;

                                                      if ((!start || now >= start) && (!end || now <= end)) {
                                                        return (
                                                          <div className="flex items-center gap-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded-md">
                                                            <Tag className="h-4 w-4 text-orange-600" />
                                                            <span className="text-xs font-medium text-orange-700 dark:text-orange-400">
                                                              PROMO: {selectedAccessory.promo_price.toFixed(2)} € (au
                                                              lieu de{" "}
                                                              {(selectedAccessory.prix_vente_ttc || 0).toFixed(2)} €)
                                                            </span>
                                                          </div>
                                                        );
                                                      }
                                                      return null;
                                                    })()}
                                                </div>
                                              );
                                            })()}

                                          <div className="flex justify-between items-center pt-1.5 border-t">
                                            <span className="text-xs text-muted-foreground">Prix de cet article</span>
                                            <span className="font-semibold text-sm">
                                              {calculateInstancePrice(instance).toFixed(2)} €
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Colonne de droite - Récapitulatif */}
            <div className="lg:col-span-1">
              <Card className="sticky top-0">
                <CardHeader>
                  <CardTitle className="text-base">Récapitulatif</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <ScrollArea className="h-[50vh]">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Prix de base du kit</span>
                        <span className="font-semibold">{basePrice.toFixed(2)} €</span>
                      </div>

                      <Separator />

                      {categoryInstances.filter((inst) => inst.accessoryId).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Aucun accessoire configuré</p>
                      ) : (
                        <div className="space-y-2">
                          {categoryInstances
                            .filter((inst) => inst.accessoryId)
                            .map((instance) => {
                              const accessory = getAccessoryById(instance.categoryId, instance.accessoryId!);
                              if (!accessory) return null;

                              return (
                                <div key={instance.id} className="text-sm space-y-1 p-2 bg-muted/50 rounded">
                                  <div className="font-medium">{accessory.nom}</div>
                                  <div className="text-xs text-muted-foreground">{instance.categoryName}</div>
                                  <div className="text-xs">
                                    Qté: {instance.quantity}
                                    {instance.color && ` • Couleur: ${instance.color}`}
                                  </div>
                                  {instance.selectedOptions.length > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      {instance.selectedOptions.length} option(s)
                                    </div>
                                  )}
                                  <div className="text-right font-semibold">
                                    {calculateInstancePrice(instance).toFixed(2)} €
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}

                      <Separator />

                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>Total</span>
                        <span>{calculateTotalPrice().toFixed(2)} €</span>
                      </div>
                    </div>
                  </ScrollArea>

                  <div className="mt-4 pt-4 border-t space-y-2">
                    <Button
                      className="w-full"
                      onClick={handleAddToCart}
                      disabled={categoryInstances.filter((inst) => inst.accessoryId).length === 0}
                    >
                      Ajouter au panier
                    </Button>
                    <Button className="w-full" variant="outline" onClick={() => onOpenChange(false)}>
                      Annuler
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Modale de détails de l'accessoire */}
      {detailsAccessory && (
        <Dialog open={!!detailsAccessory} onOpenChange={(open) => !open && setDetailsAccessory(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{detailsAccessory.nom}</DialogTitle>
              {detailsAccessory.marque && (
                <DialogDescription className="text-base">{detailsAccessory.marque}</DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-6">
              {/* Image de l'accessoire */}
              {detailsAccessory.image_url && (
                <div className="w-full aspect-video rounded-lg overflow-hidden bg-white flex items-center justify-center p-8 border">
                  <img
                    src={detailsAccessory.image_url}
                    alt={detailsAccessory.nom}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}

              {/* Prix */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                {detailsAccessory.promo_active && detailsAccessory.promo_price && (() => {
                  const now = new Date();
                  const start = detailsAccessory.promo_start_date
                    ? new Date(detailsAccessory.promo_start_date)
                    : null;
                  const end = detailsAccessory.promo_end_date ? new Date(detailsAccessory.promo_end_date) : null;

                  if ((!start || now >= start) && (!end || now <= end)) {
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs">
                            PROMO
                          </Badge>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-primary">
                            {detailsAccessory.promo_price.toFixed(2)} €
                          </span>
                          <span className="text-xl text-muted-foreground line-through">
                            {(detailsAccessory.prix_vente_ttc || 0).toFixed(2)} €
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Économisez{" "}
                          {(
                            (((detailsAccessory.prix_vente_ttc || 0) - detailsAccessory.promo_price) /
                              (detailsAccessory.prix_vente_ttc || 1)) *
                            100
                          ).toFixed(0)}
                          %
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
                {(!detailsAccessory.promo_active ||
                  !detailsAccessory.promo_price ||
                  (() => {
                    const now = new Date();
                    const start = detailsAccessory.promo_start_date
                      ? new Date(detailsAccessory.promo_start_date)
                      : null;
                    const end = detailsAccessory.promo_end_date ? new Date(detailsAccessory.promo_end_date) : null;
                    return (start && now < start) || (end && now > end);
                  })()) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Prix</p>
                    <span className="text-3xl font-bold text-primary">
                      {(detailsAccessory.prix_vente_ttc || 0).toFixed(2)} €
                    </span>
                  </div>
                )}
              </div>

              {/* Caractéristiques techniques */}
              {(detailsAccessory.puissance_watts ||
                detailsAccessory.poids_kg ||
                detailsAccessory.longueur_mm ||
                detailsAccessory.couleur) && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Caractéristiques</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {detailsAccessory.puissance_watts && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Puissance</p>
                        <p className="font-medium">{detailsAccessory.puissance_watts} W</p>
                      </div>
                    )}
                    {detailsAccessory.poids_kg && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Poids</p>
                        <p className="font-medium">{detailsAccessory.poids_kg} kg</p>
                      </div>
                    )}
                    {detailsAccessory.longueur_mm && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Dimensions</p>
                        <p className="font-medium">
                          {detailsAccessory.longueur_mm} × {detailsAccessory.largeur_mm} ×{" "}
                          {detailsAccessory.hauteur_mm} mm
                        </p>
                      </div>
                    )}
                    {detailsAccessory.couleur && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Couleur</p>
                        <p className="font-medium">{detailsAccessory.couleur}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              {detailsAccessory.description && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Description</h3>
                  <DialogDescription className="text-base leading-relaxed whitespace-pre-wrap">
                    {detailsAccessory.description}
                  </DialogDescription>
                </div>
              )}

              {!detailsAccessory.description && (
                <div className="text-center py-6 text-muted-foreground">
                  Aucune description disponible pour cet accessoire
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};

export default CustomKitConfigDialog;