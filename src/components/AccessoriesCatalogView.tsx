/**
 * AccessoriesCatalogView.tsx
 * Version: 1.58
 * Date: 2025-12-20
 * Description: Vue catalogue des accessoires avec onglets compacts et contraste hover amélioré
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search,
  Trash2,
  Edit,
  Plus,
  LayoutGrid,
  LayoutList,
  ChevronDown,
  ChevronRight,
  Store,
  Package,
  FileText,
  Settings,
  AlertCircle,
  CheckCircle2,
  RefreshCcw,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  // Icônes pour les catégories
  Zap,
  Battery,
  Sun,
  Lightbulb,
  Bed,
  Droplets,
  Sofa,
  Thermometer,
  Flame,
  UtensilsCrossed,
  Archive,
  Lock,
  Fan,
  Snowflake,
  Home,
  Hammer,
  Wrench,
  Car,
  Gauge,
  Cable,
  Plug,
  Grid3X3,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import StockStatusManager from "@/components/StockStatusManager";
import { useProjectData } from "@/contexts/ProjectDataContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AccessoryCatalogFormDialog from "@/components/AccessoryCatalogFormDialog";
import CategoryManagementDialog from "@/components/CategoryManagementDialog";
import AccessoryImportExportDialog from "@/components/AccessoryImportExportDialog";
import { ShippingFeesSidebar } from "@/components/ShippingFeesSidebar";
import { NoticeSearchDialog } from "@/components/NoticeSearchDialog";
import WishlistDialog from "@/components/WishlistDialog";
import { CatalogBulkManager } from "@/components/catalog/CatalogBulkManager";
import { CatalogSyncManager } from "@/components/catalog/CatalogSyncManager";

// 🔥 Fonction pour décoder les entités HTML
const decodeHtmlEntities = (text: string | null | undefined): string => {
  if (!text) return "";
  const doc = new DOMParser().parseFromString(text, "text/html");
  return doc.documentElement.textContent || text;
};

// 🎨 Fonction pour obtenir l'icône d'une catégorie
const getCategoryIcon = (categoryName: string) => {
  const name = categoryName.toLowerCase();

  // Électricité
  if (name.includes("électri") || name.includes("electri")) return Zap;
  if (name.includes("batterie")) return Battery;
  if (name.includes("solaire") || name.includes("panneau")) return Sun;
  if (name.includes("câble") || name.includes("cable")) return Cable;

  // Éclairage
  if (
    name.includes("éclairage") ||
    name.includes("eclairage") ||
    name.includes("lumière") ||
    name.includes("lumiere") ||
    name.includes("led") ||
    name.includes("spot")
  )
    return Lightbulb;

  // Couchage
  if (name.includes("couchage") || name.includes("matelas") || name.includes("lit") || name.includes("sommier"))
    return Bed;

  // Eau / Plomberie
  if (
    name.includes("eau") ||
    name.includes("plomberie") ||
    name.includes("robinet") ||
    name.includes("réservoir") ||
    name.includes("reservoir")
  )
    return Droplets;

  // Mobilier
  if (name.includes("mobilier") || name.includes("meuble") || name.includes("rangement") || name.includes("placard"))
    return Sofa;

  // Isolation
  if (name.includes("isolation") || name.includes("thermique")) return Thermometer;

  // Chauffage
  if (name.includes("chauffage") || name.includes("chauffer")) return Flame;

  // Cuisine
  if (
    name.includes("cuisine") ||
    name.includes("cuisson") ||
    name.includes("plaque") ||
    name.includes("réchaud") ||
    name.includes("rechaud")
  )
    return UtensilsCrossed;

  // Réfrigération
  if (
    name.includes("frigo") ||
    name.includes("réfrig") ||
    name.includes("refrig") ||
    name.includes("glacière") ||
    name.includes("glaciere")
  )
    return Snowflake;

  // Ventilation
  if (name.includes("ventil") || name.includes("aération") || name.includes("aeration")) return Fan;

  // Sécurité
  if (name.includes("sécurité") || name.includes("securite") || name.includes("alarme") || name.includes("serrure"))
    return Lock;

  // Aménagement / Structure
  if (name.includes("aménagement") || name.includes("amenagement") || name.includes("structure")) return Home;
  if (name.includes("outillage") || name.includes("outil")) return Hammer;
  if (name.includes("quincaillerie") || name.includes("visserie")) return Wrench;

  // Véhicule
  if (
    name.includes("véhicule") ||
    name.includes("vehicule") ||
    name.includes("carrosserie") ||
    name.includes("vitre") ||
    name.includes("fenêtre") ||
    name.includes("fenetre")
  )
    return Car;

  // Régulation / Monitoring
  if (name.includes("régul") || name.includes("regul") || name.includes("mppt") || name.includes("monitor"))
    return Gauge;

  // Branchement / Connexion
  if (name.includes("prise") || name.includes("connect") || name.includes("branch")) return Plug;

  // Consommables
  if (name.includes("consommable") || name.includes("fourniture")) return Archive;

  // Sans catégorie
  if (name.includes("sans catégorie") || name.includes("sans categorie")) return FolderOpen;

  // Par défaut
  return Package;
};

interface Category {
  id: string;
  nom: string;
  parent_id: string | null;
  user_id: string;
  icon?: string; // Emoji stocké dans la base
}

interface AccessoryOption {
  id: string;
  nom: string;
  prix_reference?: number;
  prix_vente_ttc?: number;
  marge_pourcent?: number;
  marge_nette?: number;
}

interface Accessory {
  id: string;
  nom: string;
  marque?: string;
  category_id?: string | null;
  prix_reference?: number;
  prix_vente_ttc?: number;
  marge_pourcent?: number;
  fournisseur?: string;
  description?: string;
  url_produit?: string;
  type_electrique?: string;
  poids_kg?: number;
  longueur_mm?: number;
  largeur_mm?: number;
  hauteur_mm?: number;
  puissance_watts?: number;
  intensite_amperes?: number;
  capacite_ah?: number;
  tension_volts?: number;
  volume_litres?: number;
  available_in_shop?: boolean;
  image_url?: string | null;
  categories?: Category;
  accessory_options?: AccessoryOption[];
  stock_status?: "in_stock" | "on_order" | "out_of_stock";
  stock_quantity?: number | null;
  delivery_date?: string | null;
  tracking_number?: string | null;
  expected_delivery_date?: string | null;
  stock_notes?: string | null;
  supplier_order_ref?: string | null;
  last_stock_update?: string | null;
  needs_completion?: boolean;
  imported_at?: string | null;
  last_price_check?: string | null;
  prix_public_ttc?: number;
}

const AccessoriesCatalogView = () => {
  const { refreshData } = useProjectData();
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [filteredAccessories, setFilteredAccessories] = useState<Accessory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAccessory, setSelectedAccessory] = useState<Accessory | null>(null);
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    const saved = localStorage.getItem("accessories-view-mode");
    return (saved as "list" | "grid") || "list";
  });
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());
  const [isShippingFeesOpen, setIsShippingFeesOpen] = useState(false);
  const [isNoticeDialogOpen, setIsNoticeDialogOpen] = useState(false);
  const [selectedAccessoryForNotice, setSelectedAccessoryForNotice] = useState<Accessory | null>(null);
  const [activeTab, setActiveTab] = useState<string>("__all__");
  const [showNeedsCompletion, setShowNeedsCompletion] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);

  // Compter les articles à compléter
  const needsCompletionCount = accessories.filter((a) => a.needs_completion).length;

  const handleStatusChange = () => {
    loadAccessories();
    refreshData();
  };

  const handleLinkNotice = (accessory: Accessory) => {
    setSelectedAccessoryForNotice(accessory);
    setIsNoticeDialogOpen(true);
  };

  // Ouvrir l'URL du produit pour mise à jour du prix via l'extension
  const handleUpdatePrice = (accessory: Accessory) => {
    if (accessory.url_produit) {
      window.open(accessory.url_produit, "_blank");
      toast.info("Ouvrez l'extension Van Price pour mettre à jour le prix", { duration: 5000 });
    } else {
      toast.error("Pas d'URL produit enregistrée pour cet article");
    }
  };

  useEffect(() => {
    loadAccessories();
    loadCategories();
  }, []);

  useEffect(() => {
    localStorage.setItem("accessories-view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    let filtered = accessories;

    // Filtre "À compléter"
    if (showNeedsCompletion) {
      filtered = filtered.filter((acc) => acc.needs_completion === true);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (acc) =>
          acc.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
          acc.marque?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          acc.fournisseur?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          acc.categories?.nom.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    setFilteredAccessories(filtered);
  }, [searchTerm, accessories, showNeedsCompletion]);

  // Grouper les accessoires par catégorie principale
  const groupedAccessories = () => {
    interface CategoryGroup {
      mainCategory: string;
      mainCategoryId: string | null;
      mainCategoryIcon?: string; // Emoji de la catégorie
      subGroups: Map<string, Accessory[]>;
    }

    const mainGroups = new Map<string, CategoryGroup>();

    filteredAccessories.forEach((accessory) => {
      if (!accessory.category_id) {
        if (!mainGroups.has("Sans catégorie")) {
          mainGroups.set("Sans catégorie", {
            mainCategory: "Sans catégorie",
            mainCategoryId: null,
            mainCategoryIcon: "📁",
            subGroups: new Map([["Sans catégorie", []]]),
          });
        }
        mainGroups.get("Sans catégorie")!.subGroups.get("Sans catégorie")!.push(accessory);
        return;
      }

      const category = accessory.categories;
      if (!category) return;

      const mainCategory = category.parent_id ? categories.find((c) => c.id === category.parent_id) : category;

      if (!mainCategory) return;

      const mainCategoryName = mainCategory.nom;

      if (!mainGroups.has(mainCategoryName)) {
        mainGroups.set(mainCategoryName, {
          mainCategory: mainCategoryName,
          mainCategoryId: mainCategory.id,
          mainCategoryIcon: mainCategory.icon,
          subGroups: new Map(),
        });
      }

      const group = mainGroups.get(mainCategoryName)!;
      const subCategoryName = category.parent_id ? category.nom : "Général";

      if (!group.subGroups.has(subCategoryName)) {
        group.subGroups.set(subCategoryName, []);
      }

      group.subGroups.get(subCategoryName)!.push(accessory);
    });

    return mainGroups;
  };

  const loadAccessories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("accessories_catalog")
      .select("*, categories(*), accessory_options(*)")
      .order("nom", { ascending: true });

    if (error) {
      toast.error("Erreur lors du chargement du catalogue");
      console.error(error);
    } else {
      const typedData = (data || []) as Accessory[];
      setAccessories(typedData);
      setFilteredAccessories(typedData);
    }
    setLoading(false);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase.from("categories").select("*").order("nom");

    if (error) {
      console.error("Erreur lors du chargement des catégories:", error);
    } else {
      setCategories(data || []);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("accessories_catalog").delete().eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    } else {
      toast.success("Accessoire supprimé du catalogue");
      loadAccessories();
    }
    setDeleteId(null);
  };

  const handleToggleShopAvailability = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("accessories_catalog")
      .update({ available_in_shop: !currentStatus })
      .eq("id", id);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
    } else {
      toast.success(!currentStatus ? "Ajouté à la boutique" : "Retiré de la boutique");
      loadAccessories();
    }
  };

  const handleEdit = (accessory: Accessory) => {
    setSelectedAccessory(accessory);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setSelectedAccessory(null);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedAccessory(null);
  };

  const handleFormSuccess = () => {
    loadAccessories();
    handleFormClose();
  };

  // Marquer un article comme complété (column may not be in generated types yet)
  const handleMarkAsCompleted = async (id: string) => {
    // @ts-ignore - needs_completion column exists but not in generated types
    const { error } = await supabase.from("accessories_catalog").update({ needs_completion: false }).eq("id", id);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
    } else {
      toast.success("Article marqué comme complété !");
      loadAccessories();
    }
  };

  const handleAccessoryDrop = async (accessoryId: string, categoryId: string | null) => {
    const { error } = await supabase
      .from("accessories_catalog")
      .update({ category_id: categoryId })
      .eq("id", accessoryId);

    if (error) {
      toast.error("Erreur lors du changement de catégorie");
      console.error(error);
    } else {
      toast.success("Catégorie mise à jour");
      loadAccessories();
    }
  };

  // Fonction pour rendre une carte accessoire
  const renderAccessoryCard = (accessory: Accessory) => (
    <Card
      key={accessory.id}
      className={accessory.needs_completion ? "border-orange-300 bg-orange-50/50 dark:bg-orange-950/20" : ""}
    >
      <CardContent className="p-4">
        {viewMode === "list" ? (
          <>
            {/* Bandeau "À compléter" */}
            {accessory.needs_completion && (
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-orange-200 bg-orange-100 dark:bg-orange-900/30 -mx-4 -mt-4 px-4 py-2 rounded-t-lg">
                <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Article importé - À compléter</span>
                  {accessory.imported_at && (
                    <span className="text-xs text-orange-500">
                      (importé le {new Date(accessory.imported_at).toLocaleDateString("fr-FR")})
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-green-500 text-green-600 hover:bg-green-50"
                  onClick={() => handleMarkAsCompleted(accessory.id)}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Marquer complété
                </Button>
              </div>
            )}
            <div className="flex items-start gap-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 flex-1">
                <div className="md:col-span-2">
                  <div className="font-medium">{decodeHtmlEntities(accessory.nom)}</div>
                  {accessory.marque && <div className="text-sm text-muted-foreground">{accessory.marque}</div>}
                </div>
                <div className="md:col-span-1">
                  {accessory.categories ? (
                    <Badge variant="secondary">{accessory.categories.nom}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Sans catégorie</span>
                  )}
                </div>
                <div className="md:col-span-1 text-sm">
                  {accessory.prix_reference && (
                    <div>
                      <span className="text-muted-foreground">HT: </span>
                      {accessory.prix_reference.toFixed(2)} €
                    </div>
                  )}
                  {accessory.prix_vente_ttc && (
                    <div>
                      <span className="text-muted-foreground">TTC: </span>
                      {accessory.prix_vente_ttc.toFixed(2)} €
                    </div>
                  )}
                </div>
                <div className="md:col-span-1 text-sm">
                  {accessory.puissance_watts && (
                    <div>
                      <span className="text-muted-foreground">P: </span>
                      {accessory.puissance_watts} W
                    </div>
                  )}
                  {accessory.intensite_amperes && (
                    <div>
                      <span className="text-muted-foreground">I: </span>
                      {accessory.intensite_amperes} A
                    </div>
                  )}
                </div>
                <div className="md:col-span-1 text-sm text-muted-foreground">
                  {accessory.fournisseur && <div>{accessory.fournisseur}</div>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {/* Bouton mise à jour prix */}
                {accessory.url_produit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleUpdatePrice(accessory)}
                    title={`Actualiser le prix${accessory.last_price_check ? ` (vérifié le ${new Date(accessory.last_price_check).toLocaleDateString("fr-FR")})` : ""}`}
                    className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                )}
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-500/10 cursor-pointer"
                  title={accessory.available_in_shop ? "Retirer de la boutique" : "Ajouter à la boutique"}
                  onClick={() => handleToggleShopAvailability(accessory.id, accessory.available_in_shop || false)}
                >
                  <Store
                    className={`h-4 w-4 ${accessory.available_in_shop ? "text-primary" : "text-muted-foreground"}`}
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleLinkNotice(accessory)} title="Lier une notice">
                  <FileText className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(accessory)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(accessory.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Gestion du stock */}
            <div className="mt-3 pt-3 border-t">
              <StockStatusManager
                accessoryId={accessory.id}
                accessoryName={decodeHtmlEntities(accessory.nom)}
                currentStatus={accessory.stock_status || "in_stock"}
                currentQuantity={accessory.stock_quantity || 0}
                deliveryDate={accessory.delivery_date}
                trackingNumber={accessory.tracking_number}
                onStatusChange={handleStatusChange}
              />
            </div>

            {/* Options collapsible */}
            {accessory.accessory_options && accessory.accessory_options.length > 0 && (
              <Collapsible
                open={expandedOptions.has(accessory.id)}
                onOpenChange={() => {
                  setExpandedOptions((prev) => {
                    const newSet = new Set(prev);
                    if (newSet.has(accessory.id)) {
                      newSet.delete(accessory.id);
                    } else {
                      newSet.add(accessory.id);
                    }
                    return newSet;
                  });
                }}
                className="mt-3"
              >
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {expandedOptions.has(accessory.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Package className="h-4 w-4" />
                  Options ({accessory.accessory_options.length})
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="bg-muted/30 rounded-md p-2 space-y-1.5">
                    {accessory.accessory_options.map((option) => (
                      <div
                        key={option.id}
                        className="text-xs space-y-0.5 border-b border-border/50 pb-1.5 last:border-0 last:pb-0"
                      >
                        <div className="font-medium">{option.nom}</div>
                        <div className="flex gap-3 text-muted-foreground">
                          {option.prix_reference !== null && option.prix_reference !== undefined && (
                            <span>Achat: {option.prix_reference.toFixed(2)} €</span>
                          )}
                          {option.marge_pourcent !== null && option.marge_pourcent !== undefined && (
                            <span>Marge: {option.marge_pourcent.toFixed(1)} %</span>
                          )}
                          {option.prix_vente_ttc !== null && option.prix_vente_ttc !== undefined && (
                            <span>Vente: {option.prix_vente_ttc.toFixed(2)} €</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        ) : (
          // Mode Grid
          <>
            {/* Badge "À compléter" en mode Grid */}
            {accessory.needs_completion && (
              <div className="flex items-center justify-between mb-2 p-2 bg-orange-100 dark:bg-orange-900/30 rounded-md -mx-1 -mt-1">
                <div className="flex items-center gap-1 text-orange-700 dark:text-orange-400">
                  <AlertCircle className="h-3 w-3" />
                  <span className="text-xs font-medium">À compléter</span>
                </div>
                <button
                  className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                  onClick={() => handleMarkAsCompleted(accessory.id)}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  OK
                </button>
              </div>
            )}
            <CardHeader className="p-0 mb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base mb-1">{decodeHtmlEntities(accessory.nom)}</CardTitle>
                  {accessory.marque && <div className="text-sm text-muted-foreground">{accessory.marque}</div>}
                </div>
                <div className="flex gap-1">
                  <div
                    className="p-1 rounded hover:bg-blue-500/10 cursor-pointer"
                    onClick={() => handleToggleShopAvailability(accessory.id, accessory.available_in_shop || false)}
                  >
                    <Store
                      className={`h-4 w-4 ${accessory.available_in_shop ? "text-primary" : "text-muted-foreground"}`}
                    />
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(accessory)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => setDeleteId(accessory.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <div className="space-y-2 text-sm">
              {accessory.categories && <Badge variant="secondary">{accessory.categories.nom}</Badge>}
              <div className="grid grid-cols-2 gap-2">
                {accessory.prix_reference && (
                  <div>
                    <span className="text-muted-foreground">HT: </span>
                    {accessory.prix_reference.toFixed(2)} €
                  </div>
                )}
                {accessory.prix_vente_ttc && (
                  <div>
                    <span className="text-muted-foreground">TTC: </span>
                    {accessory.prix_vente_ttc.toFixed(2)} €
                  </div>
                )}
              </div>
              {accessory.fournisseur && <div className="text-muted-foreground">{accessory.fournisseur}</div>}
            </div>

            {/* Gestion du stock */}
            <div className="pt-3 border-t mt-3">
              <StockStatusManager
                accessoryId={accessory.id}
                accessoryName={decodeHtmlEntities(accessory.nom)}
                currentStatus={accessory.stock_status || "in_stock"}
                currentQuantity={accessory.stock_quantity || 0}
                deliveryDate={accessory.delivery_date}
                trackingNumber={accessory.tracking_number}
                onStatusChange={handleStatusChange}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="relative">
      <Card>
        <CardHeader>
          <CardTitle>Catalogue d'Accessoires</CardTitle>
          <CardDescription>Votre catalogue personnel partagé entre tous vos projets</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Barre d'outils */}
          <div className="mb-4 flex gap-4 flex-wrap">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un accessoire..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-1 border rounded-md p-1">
              <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")}>
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("grid")}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            {/* Bouton filtre "À compléter" */}
            {needsCompletionCount > 0 && (
              <Button
                onClick={() => setShowNeedsCompletion(!showNeedsCompletion)}
                variant={showNeedsCompletion ? "default" : "outline"}
                className={
                  showNeedsCompletion
                    ? "bg-orange-500 hover:bg-orange-600"
                    : "border-orange-400 text-orange-600 hover:bg-orange-50"
                }
              >
                <AlertCircle className="h-4 w-4 mr-2" />À compléter
                <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-700">
                  {needsCompletionCount}
                </Badge>
              </Button>
            )}
            <Button
              onClick={() => setIsWishlistOpen(true)}
              variant="outline"
              className="border-green-400 text-green-600 hover:bg-green-50"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Liste de souhaits
            </Button>
            <CatalogBulkManager onComplete={() => loadAccessories()} />
            <CatalogSyncManager onComplete={() => loadAccessories()} />
            <Button onClick={() => setIsImportExportOpen(true)} variant="outline">
              Import/Export
            </Button>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un accessoire
            </Button>
          </div>

          {/* Onglets style moderne */}
          <div className="border rounded-xl overflow-hidden shadow-sm">
            {/* Barre d'onglets */}
            <div className="bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-850 border-b overflow-x-auto">
              <div className="flex items-stretch min-w-max gap-0.5 p-1">
                {/* Onglet Toutes */}
                <button
                  onClick={() => setActiveTab("__all__")}
                  className={`
                    px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex items-center gap-1.5
                    ${
                      activeTab === "__all__"
                        ? "bg-white dark:bg-gray-900 text-primary shadow-md ring-1 ring-primary/30"
                        : "hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300 text-muted-foreground"
                    }
                  `}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Toutes
                  <Badge
                    variant={activeTab === "__all__" ? "default" : "secondary"}
                    className={`text-[10px] px-1.5 py-0 h-4 font-semibold ${activeTab === "__all__" ? "bg-primary/90" : "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200"}`}
                  >
                    {filteredAccessories.length}
                  </Badge>
                </button>

                {/* Onglets par catégorie */}
                {Array.from(groupedAccessories()).map(([mainCategoryName, group]) => {
                  const totalCount = Array.from(group.subGroups.values()).reduce((acc, items) => acc + items.length, 0);
                  const isActive = activeTab === mainCategoryName;
                  const CategoryIcon = getCategoryIcon(mainCategoryName);
                  const hasEmoji = group.mainCategoryIcon && group.mainCategoryIcon.length > 0;

                  return (
                    <button
                      key={mainCategoryName}
                      onClick={() => setActiveTab(mainCategoryName)}
                      className={`
                        px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap flex items-center gap-1.5
                        ${
                          isActive
                            ? "bg-white dark:bg-gray-900 text-primary shadow-md ring-1 ring-primary/30"
                            : "hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300 text-muted-foreground"
                        }
                      `}
                    >
                      {hasEmoji ? (
                        <span className="text-sm">{group.mainCategoryIcon}</span>
                      ) : (
                        <CategoryIcon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : ""}`} />
                      )}
                      {mainCategoryName}
                      <Badge
                        variant={isActive ? "default" : "secondary"}
                        className={`text-[10px] px-1.5 py-0 h-4 font-semibold ${isActive ? "bg-primary/90" : "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200"}`}
                      >
                        {totalCount}
                      </Badge>
                    </button>
                  );
                })}

                {/* Bouton pour gérer les catégories */}
                <button
                  onClick={() => setIsCategoryManagementOpen(true)}
                  className="px-2 py-1.5 rounded-md text-muted-foreground hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-200 flex items-center gap-1"
                  title="Gérer les catégories"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Contenu de l'onglet */}
            <div className="p-4 bg-white dark:bg-gray-900 min-h-[400px]">
              {loading ? (
                <div className="text-center py-12">Chargement...</div>
              ) : filteredAccessories.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    {searchTerm ? "Aucun accessoire trouvé" : "Aucun accessoire dans le catalogue"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ajoutez votre premier accessoire en cliquant sur le bouton ci-dessus
                  </p>
                </div>
              ) : activeTab === "__all__" ? (
                // Afficher toutes les catégories
                <div className="space-y-6">
                  {Array.from(groupedAccessories()).map(([mainCategoryName, group]) => {
                    const CategoryIcon = getCategoryIcon(mainCategoryName);
                    const hasEmoji = group.mainCategoryIcon && group.mainCategoryIcon.length > 0;
                    return (
                      <div key={mainCategoryName}>
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-primary/30">
                          {hasEmoji ? (
                            <span className="text-xl">{group.mainCategoryIcon}</span>
                          ) : (
                            <CategoryIcon className="h-5 w-5 text-primary" />
                          )}
                          <h3 className="text-lg font-semibold text-primary">{mainCategoryName}</h3>
                          <Badge variant="outline">
                            {Array.from(group.subGroups.values()).reduce((acc, items) => acc + items.length, 0)}{" "}
                            article(s)
                          </Badge>
                        </div>

                        {Array.from(group.subGroups).map(([subCategoryName, items]) => (
                          <div key={`${mainCategoryName}-${subCategoryName}`} className="mb-4">
                            {group.subGroups.size > 1 && (
                              <div className="flex items-center gap-2 mb-2 ml-2">
                                <span className="text-sm font-medium text-muted-foreground">↳ {subCategoryName}</span>
                                <Badge variant="outline" className="text-xs">
                                  {items.length}
                                </Badge>
                              </div>
                            )}
                            <div
                              className={
                                viewMode === "grid"
                                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                                  : "space-y-3"
                              }
                            >
                              {items.map((accessory) => renderAccessoryCard(accessory))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Afficher uniquement la catégorie sélectionnée
                (() => {
                  const group = groupedAccessories().get(activeTab);
                  if (!group) return <div className="text-center py-12 text-muted-foreground">Catégorie vide</div>;

                  return (
                    <div className="space-y-4">
                      {Array.from(group.subGroups).map(([subCategoryName, items]) => (
                        <div key={`${activeTab}-${subCategoryName}`}>
                          {group.subGroups.size > 1 && (
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                              <h4 className="font-medium">{subCategoryName}</h4>
                              <Badge variant="outline">{items.length}</Badge>
                            </div>
                          )}
                          <div
                            className={
                              viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"
                            }
                          >
                            {items.map((accessory) => renderAccessoryCard(accessory))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {/* Dialogs */}
          <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir supprimer cet accessoire du catalogue ? Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteId && handleDelete(deleteId)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AccessoryCatalogFormDialog
            isOpen={isFormOpen}
            onClose={handleFormClose}
            onSuccess={handleFormSuccess}
            accessory={selectedAccessory}
          />

          <CategoryManagementDialog
            isOpen={isCategoryManagementOpen}
            onClose={() => setIsCategoryManagementOpen(false)}
            onSuccess={() => {
              loadCategories();
              loadAccessories();
            }}
            categories={categories}
          />

          <AccessoryImportExportDialog
            isOpen={isImportExportOpen}
            onClose={() => setIsImportExportOpen(false)}
            onSuccess={loadAccessories}
            categories={categories}
          />

          <ShippingFeesSidebar
            isOpen={isShippingFeesOpen}
            onClose={() => setIsShippingFeesOpen(false)}
            onFeesChange={loadAccessories}
          />

          {selectedAccessoryForNotice && (
            <NoticeSearchDialog
              isOpen={isNoticeDialogOpen}
              onClose={() => {
                setIsNoticeDialogOpen(false);
                setSelectedAccessoryForNotice(null);
              }}
              accessoryId={selectedAccessoryForNotice.id}
              accessoryMarque={selectedAccessoryForNotice.marque}
              accessoryNom={selectedAccessoryForNotice.nom}
              onSuccess={() => {
                loadAccessories();
                setIsNoticeDialogOpen(false);
                setSelectedAccessoryForNotice(null);
              }}
            />
          )}

          {/* Dialog wishlist */}
          <WishlistDialog open={isWishlistOpen} onOpenChange={setIsWishlistOpen} />

          {/* Bouton rond fixe pour les frais de port */}
          <Button
            onClick={() => setIsShippingFeesOpen(true)}
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50"
            title="Gérer les frais de port"
          >
            <Package className="h-6 w-6" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessoriesCatalogView;
