import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus,
  X,
  Loader2,
  Check,
  ChevronsUpDown,
  Search,
  Eye,
  Package,
  Minus,
  ShoppingCart,
  Tag,
  Grid3x3,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface Accessory {
  id: string;
  nom: string;
  marque?: string;
  prix_vente_ttc?: number;
  category_id?: string;
  description?: string;
  puissance_watts?: number;
  poids_kg?: number;
  longueur_mm?: number;
  largeur_mm?: number;
  hauteur_mm?: number;
  couleur?: string;
  image_url?: string;
  promo_active?: boolean;
  promo_price?: number;
  categories?: { nom: string };
}

interface ProductFormDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  editProduct?: any;
  forceOpen?: boolean;
  onClose?: () => void;
}

export const ShopProductFormDialog = ({
  trigger,
  onSuccess,
  editProduct,
  forceOpen,
  onClose,
}: ProductFormDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productType, setProductType] = useState<"simple" | "composed" | "custom_kit">("simple");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Pour produits simples et composés
  const [selectedAccessories, setSelectedAccessories] = useState<Array<{ id: string; quantity: number }>>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [accessoryOptions, setAccessoryOptions] = useState<Array<{ id: string; nom: string; prix_vente_ttc: number }>>(
    [],
  );

  // Pour kits sur-mesure - interface améliorée
  const [kitAccessories, setKitAccessories] = useState<Array<{ id: string; quantity: number }>>([]);
  const [categories, setCategories] = useState<{ id: string; nom: string }[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");
  const [catalogViewMode, setCatalogViewMode] = useState<"grid" | "list">("grid");
  const [detailsAccessory, setDetailsAccessory] = useState<Accessory | null>(null);

  useEffect(() => {
    if (open) {
      loadAccessories();
      loadCategories();
      if (editProduct) {
        populateForm();
      } else {
        resetForm();
      }
    }
  }, [open, editProduct]);

  useEffect(() => {
    if (editProduct) {
      setOpen(true);
    } else if (forceOpen) {
      setOpen(true);
    }
  }, [editProduct, forceOpen]);

  const loadAccessories = async () => {
    const { data, error } = await supabase
      .from("accessories_catalog")
      .select(
        "id, nom, marque, prix_vente_ttc, category_id, categories(nom), description, puissance_watts, poids_kg, longueur_mm, largeur_mm, hauteur_mm, couleur, image_url, promo_active, promo_price",
      )
      .eq("available_in_shop", true)
      .order("nom");

    if (error) {
      console.error("Erreur lors du chargement des accessoires:", error);
      return;
    }

    setAccessories(data || []);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase.from("categories").select("id, nom").order("nom");

    if (error) {
      console.error("Erreur lors du chargement des catégories:", error);
      return;
    }

    setCategories(data || []);
  };

  const populateForm = async () => {
    if (!editProduct) return;

    setName(editProduct.name);
    setDescription(editProduct.description || "");
    setPrice(editProduct.price?.toString() || "");
    setIsActive(editProduct.is_active);
    setProductType(editProduct.type);

    // Charger les accessoires ou catégories selon le type
    if (editProduct.type === "custom_kit") {
      // Pour les kits sur-mesure, l'ID passé est l'ID du kit lui-même
      const { data, error } = await supabase
        .from("shop_custom_kits")
        .select("id, prix_base")
        .eq("id", editProduct.id)
        .maybeSingle();

      if (!error && data) {
        // Utiliser le prix_base du kit au lieu du prix du produit
        setPrice(data.prix_base?.toString() || "0");

        // Charger les accessoires du kit
        const { data: kitAccessoriesData } = await supabase
          .from("shop_custom_kit_accessories" as any)
          .select("accessory_id, default_quantity")
          .eq("custom_kit_id", data.id);

        if (kitAccessoriesData) {
          setKitAccessories(
            kitAccessoriesData.map((ka: any) => ({
              id: ka.accessory_id,
              quantity: ka.default_quantity,
            })),
          );
        }
      }
    } else {
      const { data, error } = await supabase
        .from("shop_product_items" as any)
        .select("accessory_id, quantity")
        .eq("product_id", editProduct.id);

      if (!error && data) {
        setSelectedAccessories(
          (data as any).map((item: any) => ({
            id: item.accessory_id,
            quantity: item.quantity,
          })),
        );
      }
    }
  };

  const loadAccessoryOptions = async (accessoryId: string) => {
    const { data, error } = await supabase
      .from("accessory_options")
      .select("id, nom, prix_vente_ttc")
      .eq("accessory_id", accessoryId)
      .order("nom");

    if (error) {
      console.error("Erreur lors du chargement des options:", error);
      return;
    }

    setAccessoryOptions(data || []);
  };

  const handleAddAccessory = async (accessoryId: string) => {
    if (!selectedAccessories.find((a) => a.id === accessoryId)) {
      setSelectedAccessories([...selectedAccessories, { id: accessoryId, quantity: 1 }]);

      // Pour un produit simple, remplir automatiquement le prix et charger les options
      if (productType === "simple") {
        await loadAccessoryOptions(accessoryId);

        const accessory = accessories.find((a) => a.id === accessoryId);
        if (accessory && accessory.prix_vente_ttc) {
          setPrice(accessory.prix_vente_ttc.toString());
        }
      }
    }
  };

  const handleRemoveAccessory = (accessoryId: string) => {
    setSelectedAccessories(selectedAccessories.filter((a) => a.id !== accessoryId));

    // Pour un produit simple, vider le prix et les options
    if (productType === "simple") {
      setPrice("");
      setAccessoryOptions([]);
    }
  };

  const handleQuantityChange = (accessoryId: string, quantity: number) => {
    setSelectedAccessories(
      selectedAccessories.map((a) => (a.id === accessoryId ? { ...a, quantity: Math.max(1, quantity) } : a)),
    );
  };

  // Nouvelle fonction pour ajouter un accessoire au kit depuis le catalogue
  const handleAddToKit = (accessoryId: string) => {
    if (!kitAccessories.find((ka) => ka.id === accessoryId)) {
      setKitAccessories([...kitAccessories, { id: accessoryId, quantity: 1 }]);
      toast.success("Accessoire ajouté au kit");
    } else {
      toast.info("Cet accessoire est déjà dans le kit");
    }
  };

  // Filtrer les accessoires pour le catalogue
  const filteredCatalogAccessories = accessories.filter((acc) => {
    const matchesSearch =
      catalogSearchQuery === "" ||
      acc.nom.toLowerCase().includes(catalogSearchQuery.toLowerCase()) ||
      acc.marque?.toLowerCase().includes(catalogSearchQuery.toLowerCase()) ||
      acc.description?.toLowerCase().includes(catalogSearchQuery.toLowerCase());

    const matchesCategory = selectedCategoryFilter === "all" || acc.category_id === selectedCategoryFilter;

    return matchesSearch && matchesCategory && !kitAccessories.find((ka) => ka.id === acc.id);
  });

  // Obtenir le prix affiché d'un accessoire
  const getDisplayPrice = (accessory: Accessory) => {
    if (accessory.promo_active && accessory.promo_price) {
      return accessory.promo_price;
    }
    return accessory.prix_vente_ttc || 0;
  };

  const handleSubmit = async () => {
    // Pour les produits simples, utiliser le nom de l'accessoire
    let productName = name;
    if (productType === "simple" && selectedAccessories.length === 1) {
      const selectedAcc = accessories.find((a) => a.id === selectedAccessories[0].id);
      if (selectedAcc) {
        productName = selectedAcc.nom;
      }
    }

    // Validation du nom du produit
    if (productType === "simple") {
      // Pour un produit simple, vérifier qu'un accessoire est sélectionné
      if (selectedAccessories.length !== 1) {
        toast.error("Un produit simple doit contenir exactement un accessoire");
        return;
      }
      // Vérifier que le nom peut être récupéré
      const selectedAcc = accessories.find((a) => a.id === selectedAccessories[0].id);
      if (!selectedAcc) {
        toast.error("Erreur lors de la récupération de l'accessoire");
        return;
      }
    } else {
      // Pour les autres types, le nom est obligatoire
      if (!productName) {
        toast.error("Veuillez remplir tous les champs obligatoires");
        return;
      }
    }

    if (productType !== "custom_kit" && !price) {
      toast.error("Veuillez indiquer un prix");
      return;
    }

    if (productType === "composed" && selectedAccessories.length === 0) {
      toast.error("Un produit composé doit contenir au moins un accessoire");
      return;
    }

    if (productType === "custom_kit" && kitAccessories.length === 0) {
      toast.error("Un kit sur-mesure doit contenir au moins un accessoire");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      if (editProduct) {
        // Mode édition
        if (productType === "custom_kit") {
          // Vérifier que le kit existe dans la base de données
          const { data: existingKit, error: checkError } = await supabase
            .from("shop_custom_kits")
            .select("id")
            .eq("id", editProduct.id)
            .maybeSingle();

          if (checkError) throw checkError;

          if (!existingKit) {
            throw new Error("Le kit n'existe pas dans la base de données");
          }

          // Supprimer les anciens accessoires du kit
          await supabase
            .from("shop_custom_kit_accessories" as any)
            .delete()
            .eq("custom_kit_id", editProduct.id);

          // Extraire les catégories uniques des accessoires sélectionnés
          const selectedAccessoryIds = kitAccessories.map((ka) => ka.id);
          const selectedAccessoriesData = accessories.filter((a) => selectedAccessoryIds.includes(a.id));
          const uniqueCategoryIds = [
            ...new Set(selectedAccessoriesData.map((a) => a.category_id).filter(Boolean)),
          ] as string[];

          // Mettre à jour les infos du kit avec les catégories autorisées
          const { error: kitError } = await supabase
            .from("shop_custom_kits")
            .update({
              nom: productName,
              description,
              prix_base: 0,
              is_active: isActive,
              allowed_category_ids: uniqueCategoryIds, // Mettre à jour les catégories autorisées
            })
            .eq("id", editProduct.id);

          if (kitError) throw kitError;

          // Ajouter les nouveaux accessoires
          if (kitAccessories.length > 0) {
            const kitAccessoriesData = kitAccessories.map((acc) => ({
              custom_kit_id: editProduct.id,
              accessory_id: acc.id,
              default_quantity: acc.quantity,
            }));

            const { error: kitAccessoriesError } = await supabase
              .from("shop_custom_kit_accessories" as any)
              .insert(kitAccessoriesData);

            if (kitAccessoriesError) throw kitAccessoriesError;
          }
        } else {
          // Pour les produits simples et composés, modifier dans shop_products
          const { error: productError } = await supabase
            .from("shop_products" as any)
            .update({
              name: productName,
              description,
              price: parseFloat(price) || 0,
              is_active: isActive,
            } as any)
            .eq("id", editProduct.id);

          if (productError) throw productError;

          // Supprimer les anciens items
          await supabase
            .from("shop_product_items" as any)
            .delete()
            .eq("product_id", editProduct.id);

          const items = selectedAccessories.map((acc) => ({
            product_id: editProduct.id,
            accessory_id: acc.id,
            quantity: acc.quantity,
          }));

          const { error: itemsError } = await supabase.from("shop_product_items" as any).insert(items as any);

          if (itemsError) throw itemsError;
        }

        toast.success("Produit modifié avec succès");
      } else {
        // Mode création
        if (productType === "custom_kit") {
          // Extraire les catégories uniques des accessoires sélectionnés
          const selectedAccessoryIds = kitAccessories.map((ka) => ka.id);
          const selectedAccessoriesData = accessories.filter((a) => selectedAccessoryIds.includes(a.id));
          const uniqueCategoryIds = [
            ...new Set(selectedAccessoriesData.map((a) => a.category_id).filter(Boolean)),
          ] as string[];

          // Pour les kits sur-mesure, créer directement dans shop_custom_kits
          const { data: kitData, error: kitError } = await supabase
            .from("shop_custom_kits")
            .insert({
              user_id: user.id,
              nom: productName,
              description,
              prix_base: 0,
              is_active: isActive,
              allowed_category_ids: uniqueCategoryIds, // Sauvegarder les catégories autorisées
            })
            .select()
            .maybeSingle();

          if (kitError) throw kitError;

          // Ajouter les accessoires du kit
          if (kitData && kitAccessories.length > 0) {
            const kitAccessoriesData = kitAccessories.map((acc) => ({
              custom_kit_id: kitData.id,
              accessory_id: acc.id,
              default_quantity: acc.quantity,
            }));

            const { error: kitAccessoriesError } = await supabase
              .from("shop_custom_kit_accessories" as any)
              .insert(kitAccessoriesData);

            if (kitAccessoriesError) throw kitAccessoriesError;
          }
        } else {
          // Pour les produits simples et composés, créer dans shop_products
          const { data: product, error: productError } = await supabase
            .from("shop_products" as any)
            .insert({
              user_id: user.id,
              name: productName,
              description,
              type: productType,
              price: parseFloat(price) || 0,
              is_active: isActive,
            } as any)
            .select()
            .maybeSingle();

          if (productError) throw productError;

          // Ajouter les items
          const items = selectedAccessories.map((acc) => ({
            product_id: (product as any).id,
            accessory_id: acc.id,
            quantity: acc.quantity,
          }));

          const { error: itemsError } = await supabase.from("shop_product_items" as any).insert(items as any);

          if (itemsError) throw itemsError;
        }

        toast.success("Produit créé avec succès");
      }

      handleClose();
      onSuccess?.();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error(`Erreur lors de ${editProduct ? "la modification" : "la création"} du produit`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
    onClose?.();
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setIsActive(true);
    setProductType("simple");
    setSelectedAccessories([]);
    setKitAccessories([]);
    setSelectedCategoryFilter("all");
    setSearchValue("");
    setAccessoryOptions([]);
    setShowCatalog(false);
    setCatalogSearchQuery("");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau produit
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editProduct ? "Modifier le produit" : "Créer un produit"}</DialogTitle>
            <DialogDescription>
              {editProduct ? "Modifiez les informations du produit" : "Ajoutez un nouveau produit à votre boutique"}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="type">Type de produit</Label>
                <Select value={productType} onValueChange={(value: any) => setProductType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Produit simple</SelectItem>
                    <SelectItem value="composed">Produit composé</SelectItem>
                    <SelectItem value="custom_kit">Kit sur-mesure</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {productType === "simple" && "Un produit simple est composé d'un seul accessoire"}
                  {productType === "composed" && "Un produit composé contient plusieurs accessoires à prix fixe"}
                  {productType === "custom_kit" && "Un kit sur-mesure permet au client de choisir les quantités"}
                </p>
              </div>

              {/* Sélection d'accessoires pour produits simples et composés */}
              {(productType === "simple" || productType === "composed") && (
                <div className="space-y-3">
                  <Label>Accessoires {productType === "simple" ? "(1 seul)" : ""}</Label>
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={comboboxOpen}
                        className="w-full justify-between"
                        disabled={productType === "simple" && selectedAccessories.length >= 1}
                      >
                        Sélectionner un accessoire
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Rechercher un accessoire..."
                          value={searchValue}
                          onValueChange={setSearchValue}
                        />
                        <CommandList>
                          <CommandEmpty>Aucun accessoire trouvé.</CommandEmpty>
                          <CommandGroup>
                            {accessories
                              .filter((acc) => !selectedAccessories.find((sa) => sa.id === acc.id))
                              .map((acc) => (
                                <CommandItem
                                  key={acc.id}
                                  value={acc.nom}
                                  onSelect={() => {
                                    handleAddAccessory(acc.id);
                                    setComboboxOpen(false);
                                    setSearchValue("");
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                                  <div className="flex flex-col">
                                    <span>
                                      {acc.nom} {acc.marque && `(${acc.marque})`}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {acc.prix_vente_ttc?.toFixed(2)} € {acc.categories && `• ${acc.categories.nom}`}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* Liste des accessoires sélectionnés */}
                  <div className="space-y-2">
                    {selectedAccessories.map((item) => {
                      const accessory = accessories.find((a) => a.id === item.id);
                      return (
                        <Card key={item.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              {accessory?.image_url && (
                                <div className="w-16 h-16 rounded overflow-hidden border flex-shrink-0">
                                  <img
                                    src={accessory.image_url}
                                    alt={accessory.nom}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{accessory?.nom}</p>
                                {accessory?.marque && (
                                  <p className="text-sm text-muted-foreground">{accessory.marque}</p>
                                )}
                                <Badge variant="secondary" className="mt-1">
                                  {accessory?.prix_vente_ttc?.toFixed(2)} €
                                </Badge>
                              </div>
                              {productType === "composed" && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="w-12 text-center font-medium">{item.quantity}</span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRemoveAccessory(item.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {productType === "simple" && accessoryOptions.length > 0 && (
                    <div className="mt-4">
                      <Label className="mb-2 block">Options disponibles pour le client</Label>
                      <div className="border rounded-md p-4 space-y-2 bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-2">
                          Le client pourra choisir ces options lors de l'achat
                        </p>
                        {accessoryOptions.map((option) => (
                          <div key={option.id} className="flex items-center justify-between text-sm">
                            <span>{option.nom}</span>
                            <Badge variant="outline">+{option.prix_vente_ttc?.toFixed(2) || "0.00"} €</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {productType !== "simple" && (
                <div>
                  <Label htmlFor="name">Nom du produit *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Kit électrique complet"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description du produit..."
                  rows={3}
                />
              </div>

              {/* Interface améliorée pour les kits sur-mesure */}
              {productType === "custom_kit" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-lg">Accessoires du kit</Label>
                      <p className="text-sm text-muted-foreground">
                        Sélectionnez les accessoires qui feront partie de ce kit personnalisable
                      </p>
                    </div>
                    <Button onClick={() => setShowCatalog(true)} variant="default">
                      <Package className="h-4 w-4 mr-2" />
                      Parcourir le catalogue
                    </Button>
                  </div>

                  {/* Liste des accessoires sélectionnés pour le kit */}
                  {kitAccessories.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="p-8 text-center">
                        <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-muted-foreground mb-2">Aucun accessoire sélectionné</p>
                        <p className="text-sm text-muted-foreground">
                          Cliquez sur "Parcourir le catalogue" pour ajouter des accessoires
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {kitAccessories.map((item) => {
                        const accessory = accessories.find((a) => a.id === item.id);
                        if (!accessory) return null;

                        return (
                          <Card key={item.id} className="overflow-hidden">
                            <CardContent className="p-0">
                              <div className="flex gap-3 p-3">
                                {/* Image */}
                                {accessory.image_url ? (
                                  <div className="w-20 h-20 rounded overflow-hidden border flex-shrink-0 bg-white">
                                    <img
                                      src={accessory.image_url}
                                      alt={accessory.nom}
                                      className="w-full h-full object-contain"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-20 h-20 rounded overflow-hidden border flex-shrink-0 bg-muted flex items-center justify-center">
                                    <Package className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                )}

                                {/* Infos */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <h4 className="font-medium text-sm leading-tight">{accessory.nom}</h4>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 flex-shrink-0"
                                      onClick={() => setKitAccessories(kitAccessories.filter((a) => a.id !== item.id))}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  {accessory.marque && (
                                    <p className="text-xs text-muted-foreground mb-1">{accessory.marque}</p>
                                  )}

                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-xs">
                                      {accessory.categories?.nom || "Sans catégorie"}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {getDisplayPrice(accessory).toFixed(2)} €
                                    </Badge>
                                  </div>

                                  {/* Contrôles de quantité */}
                                  <div className="flex items-center gap-1 mt-2">
                                    <span className="text-xs text-muted-foreground mr-1">Qté par défaut:</span>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        const newQuantity = Math.max(1, item.quantity - 1);
                                        setKitAccessories(
                                          kitAccessories.map((a) =>
                                            a.id === item.id ? { ...a, quantity: newQuantity } : a,
                                          ),
                                        );
                                      }}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        setKitAccessories(
                                          kitAccessories.map((a) =>
                                            a.id === item.id ? { ...a, quantity: a.quantity + 1 } : a,
                                          ),
                                        );
                                      }}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {productType !== "custom_kit" && (
                <div>
                  <Label htmlFor="price">Prix TTC (€) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked as boolean)}
                />
                <label
                  htmlFor="isActive"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Produit actif (visible dans la boutique)
                </label>
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editProduct ? "Modifier le produit" : "Créer le produit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal du catalogue d'accessoires */}
      <Dialog open={showCatalog} onOpenChange={setShowCatalog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Catalogue d'accessoires</DialogTitle>
            <DialogDescription>Parcourez et sélectionnez les accessoires à ajouter à votre kit</DialogDescription>
          </DialogHeader>

          {/* Barre de recherche et filtres */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, marque ou description..."
                  value={catalogSearchQuery}
                  onChange={(e) => setCatalogSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1 border rounded-md p-1">
                <Button
                  variant={catalogViewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setCatalogViewMode("grid")}
                  className="h-8 w-8"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={catalogViewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setCatalogViewMode("list")}
                  className="h-8 w-8"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Filtres par catégorie */}
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2 pb-2">
                <Badge
                  variant={selectedCategoryFilter === "all" ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/90"
                  onClick={() => setSelectedCategoryFilter("all")}
                >
                  Toutes ({accessories.filter((a) => !kitAccessories.find((ka) => ka.id === a.id)).length})
                </Badge>
                {categories.map((category) => {
                  const count = accessories.filter(
                    (a) => a.category_id === category.id && !kitAccessories.find((ka) => ka.id === a.id),
                  ).length;
                  return (
                    <Badge
                      key={category.id}
                      variant={selectedCategoryFilter === category.id ? "default" : "outline"}
                      className="cursor-pointer hover:bg-primary/90"
                      onClick={() => setSelectedCategoryFilter(category.id)}
                    >
                      {category.nom} ({count})
                    </Badge>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Grille d'accessoires */}
          <ScrollArea className="flex-1">
            {filteredCatalogAccessories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Aucun accessoire trouvé</p>
                <p className="text-sm text-muted-foreground mt-1">Essayez de modifier vos filtres ou votre recherche</p>
              </div>
            ) : (
              <div className={catalogViewMode === "grid" ? "grid grid-cols-2 md:grid-cols-3 gap-4" : "space-y-2"}>
                {filteredCatalogAccessories.map((accessory) => (
                  <Card
                    key={accessory.id}
                    className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                  >
                    <CardContent className="p-0">
                      {catalogViewMode === "grid" ? (
                        // Vue en grille
                        <div className="flex flex-col h-full">
                          {/* Image */}
                          <div className="aspect-square bg-white border-b flex items-center justify-center p-4">
                            {accessory.image_url ? (
                              <img
                                src={accessory.image_url}
                                alt={accessory.nom}
                                className="max-w-full max-h-full object-contain"
                              />
                            ) : (
                              <Package className="h-16 w-16 text-muted-foreground" />
                            )}
                          </div>

                          {/* Infos */}
                          <div className="p-3 flex-1 flex flex-col">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm line-clamp-2 mb-1">{accessory.nom}</h4>
                              {accessory.marque && (
                                <p className="text-xs text-muted-foreground mb-2">{accessory.marque}</p>
                              )}

                              <div className="flex items-center gap-1 flex-wrap mb-2">
                                <Badge variant="outline" className="text-xs">
                                  {accessory.categories?.nom || "Sans catégorie"}
                                </Badge>
                                {accessory.promo_active && accessory.promo_price && (
                                  <Badge variant="destructive" className="text-xs">
                                    PROMO
                                  </Badge>
                                )}
                              </div>

                              {/* Prix */}
                              <div className="flex items-baseline gap-1 mb-2">
                                <span className="font-bold text-primary">
                                  {getDisplayPrice(accessory).toFixed(2)} €
                                </span>
                                {accessory.promo_active && accessory.promo_price && (
                                  <span className="text-xs text-muted-foreground line-through">
                                    {accessory.prix_vente_ttc?.toFixed(2)} €
                                  </span>
                                )}
                              </div>

                              {/* Caractéristiques */}
                              {(accessory.puissance_watts || accessory.poids_kg) && (
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                  {accessory.puissance_watts && <p>⚡ {accessory.puissance_watts}W</p>}
                                  {accessory.poids_kg && <p>⚖️ {accessory.poids_kg}kg</p>}
                                </div>
                              )}
                            </div>

                            {/* Boutons */}
                            <div className="flex gap-2 mt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => setDetailsAccessory(accessory)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Détails
                              </Button>
                              <Button size="sm" className="flex-1" onClick={() => handleAddToKit(accessory.id)}>
                                <Plus className="h-4 w-4 mr-1" />
                                Ajouter
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Vue en liste
                        <div className="flex gap-3 p-3">
                          {/* Image */}
                          <div className="w-24 h-24 flex-shrink-0 bg-white border rounded flex items-center justify-center p-2">
                            {accessory.image_url ? (
                              <img
                                src={accessory.image_url}
                                alt={accessory.nom}
                                className="max-w-full max-h-full object-contain"
                              />
                            ) : (
                              <Package className="h-12 w-12 text-muted-foreground" />
                            )}
                          </div>

                          {/* Infos */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">{accessory.nom}</h4>
                                {accessory.marque && (
                                  <p className="text-sm text-muted-foreground">{accessory.marque}</p>
                                )}
                              </div>
                              <div className="flex items-baseline gap-1 flex-shrink-0">
                                <span className="font-bold text-primary">
                                  {getDisplayPrice(accessory).toFixed(2)} €
                                </span>
                                {accessory.promo_active && accessory.promo_price && (
                                  <span className="text-xs text-muted-foreground line-through">
                                    {accessory.prix_vente_ttc?.toFixed(2)} €
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <Badge variant="outline" className="text-xs">
                                {accessory.categories?.nom || "Sans catégorie"}
                              </Badge>
                              {accessory.promo_active && accessory.promo_price && (
                                <Badge variant="destructive" className="text-xs">
                                  PROMO
                                </Badge>
                              )}
                              {accessory.puissance_watts && (
                                <span className="text-xs text-muted-foreground">⚡ {accessory.puissance_watts}W</span>
                              )}
                              {accessory.poids_kg && (
                                <span className="text-xs text-muted-foreground">⚖️ {accessory.poids_kg}kg</span>
                              )}
                            </div>

                            {accessory.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{accessory.description}</p>
                            )}

                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => setDetailsAccessory(accessory)}>
                                <Eye className="h-4 w-4 mr-1" />
                                Voir les détails
                              </Button>
                              <Button size="sm" onClick={() => handleAddToKit(accessory.id)}>
                                <Plus className="h-4 w-4 mr-1" />
                                Ajouter au kit
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {kitAccessories.length} accessoire{kitAccessories.length > 1 ? "s" : ""} sélectionné
              {kitAccessories.length > 1 ? "s" : ""}
            </p>
            <Button onClick={() => setShowCatalog(false)}>
              <Check className="h-4 w-4 mr-2" />
              Terminé
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de détails d'accessoire */}
      {detailsAccessory && (
        <Dialog open={!!detailsAccessory} onOpenChange={(open) => !open && setDetailsAccessory(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-2xl">{detailsAccessory.nom}</DialogTitle>
              {detailsAccessory.marque && (
                <DialogDescription className="text-base">{detailsAccessory.marque}</DialogDescription>
              )}
            </DialogHeader>

            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6">
                {/* Image */}
                {detailsAccessory.image_url && (
                  <div className="w-full aspect-video rounded-lg overflow-hidden bg-white flex items-center justify-center p-8 border">
                    <img
                      src={detailsAccessory.image_url}
                      alt={detailsAccessory.nom}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}

                {/* Prix et catégorie */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Prix</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-primary">
                        {getDisplayPrice(detailsAccessory).toFixed(2)} €
                      </span>
                      {detailsAccessory.promo_active && detailsAccessory.promo_price && (
                        <span className="text-xl text-muted-foreground line-through">
                          {detailsAccessory.prix_vente_ttc?.toFixed(2)} €
                        </span>
                      )}
                    </div>
                    {detailsAccessory.promo_active && detailsAccessory.promo_price && (
                      <Badge variant="destructive" className="mt-2">
                        PROMO -
                        {(
                          (((detailsAccessory.prix_vente_ttc || 0) - detailsAccessory.promo_price) /
                            (detailsAccessory.prix_vente_ttc || 1)) *
                          100
                        ).toFixed(0)}
                        %
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {detailsAccessory.categories?.nom || "Sans catégorie"}
                  </Badge>
                </div>

                {/* Caractéristiques techniques */}
                {(detailsAccessory.puissance_watts ||
                  detailsAccessory.poids_kg ||
                  detailsAccessory.longueur_mm ||
                  detailsAccessory.couleur) && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Caractéristiques techniques</h3>
                    <div className="grid grid-cols-2 gap-4">
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
                          <p className="text-sm text-muted-foreground">Couleur(s)</p>
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
                    <p className="text-base leading-relaxed whitespace-pre-wrap">{detailsAccessory.description}</p>
                  </div>
                )}

                {!detailsAccessory.description && (
                  <div className="text-center py-6 text-muted-foreground">
                    Aucune description disponible pour cet accessoire
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" className="flex-1" onClick={() => setDetailsAccessory(null)}>
                Fermer
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  handleAddToKit(detailsAccessory.id);
                  setDetailsAccessory(null);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter au kit
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
