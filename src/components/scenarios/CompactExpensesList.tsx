// components/scenarios/CompactExpensesList.tsx
// Liste compacte des dépenses pour un scénario - optimisée pour 450px
// VERSION: 2.8 - Barre sélection compacte sur 2 lignes
// ✅ MODIFIÉ: Groupement par catégorie avec séparateurs + décodage HTML

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Edit,
  Trash2,
  Package,
  Truck,
  ArrowRight,
  RefreshCw,
  Zap,
  Battery,
  Sun,
  Check,
  Maximize2,
  PackageCheck,
  Clock,
  CheckSquare,
  Square,
  X,
  Circle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import ExpenseFormDialog from "@/components/ExpenseFormDialog";

interface CompactExpensesListProps {
  projectId: string;
  scenarioId: string;
  isLocked: boolean;
  onExpenseChange: () => void;
}

interface Expense {
  id: string;
  nom_accessoire: string;
  marque?: string;
  prix: number;
  prix_vente_ttc?: number;
  marge_pourcent?: number;
  quantite: number;
  date_achat: string;
  categorie: string;
  statut_paiement: "non_paye" | "paye" | "acompte";
  statut_livraison: "commande" | "en_livraison" | "livre";
  fournisseur?: string;
  notes?: string;
  accessory_id?: string;
  type_electrique?: string;
  poids_kg?: number;
  longueur_mm?: number;
  largeur_mm?: number;
  hauteur_mm?: number;
  puissance_watts?: number;
  intensite_amperes?: number;
}

// Interface pour les données du catalogue
interface CatalogItem {
  id: string;
  type_electrique?: string;
  puissance_watts?: number;
  intensite_amperes?: number;
  poids_kg?: number;
  longueur_mm?: number;
  largeur_mm?: number;
  hauteur_mm?: number;
}

const CompactExpensesList = ({ projectId, scenarioId, isLocked, onExpenseChange }: CompactExpensesListProps) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]); // Catégories unifiées pour le formulaire
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryIcons, setCategoryIcons] = useState<Record<string, string>>({});

  // VERSION 2.5: Filtre par statut de livraison + modale plein écran
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState<Expense["statut_livraison"] | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  // VERSION 2.6: Mode sélection multiple
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

  // Ref pour tracker si on a des changements non synchronisés
  const hasUnsyncedChanges = useRef(false);

  // Charger les catégories depuis la table categories (catalogue)
  const loadAllCategories = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Charger depuis la table categories du catalogue
    const { data, error } = await supabase
      .from("categories")
      .select("id, nom, parent_id")
      .eq("user_id", userData.user.id)
      .order("nom");

    if (data && !error) {
      // Construire la liste avec les sous-catégories indentées
      const rootCats = data.filter((c) => !c.parent_id);
      const subCats = data.filter((c) => c.parent_id);

      const result: string[] = [];
      rootCats.forEach((root) => {
        result.push(root.nom);
        // Ajouter les sous-catégories de cette racine
        subCats
          .filter((sub) => sub.parent_id === root.id)
          .forEach((sub) => {
            result.push(sub.nom);
          });
      });

      setAllCategories(result);
    }
  };

  useEffect(() => {
    loadExpenses();
    loadAllCategories();
  }, [scenarioId]);

  const loadExpenses = async () => {
    setIsLoading(true);

    // Charger les icônes des catégories
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("nom, icon")
        .eq("user_id", userData.user.id);

      if (categoriesData) {
        const iconsMap: Record<string, string> = {};
        categoriesData.forEach((cat: any) => {
          iconsMap[cat.nom] = cat.icon || "📦";
        });
        setCategoryIcons(iconsMap);
      }
    }

    try {
      const result: any = await (supabase as any)
        .from("project_expenses")
        .select("*")
        .eq("scenario_id", scenarioId)
        .order("date_achat", { ascending: false });

      const { data, error } = result;

      if (error) {
        console.error("Erreur chargement dépenses:", error);
        toast.error("Erreur lors du chargement des dépenses");
      } else {
        const filteredData = (data || []).filter((e: any) => e.est_archive !== true);
        setExpenses(filteredData);

        // Extraire les catégories uniques
        const uniqueCategories = Array.from(
          new Set(
            filteredData.map((e: any) => (e.categorie && e.categorie.trim() !== "" ? e.categorie : "Non catégorisé")),
          ),
        ) as string[];
        setCategories(uniqueCategories);
      }
    } catch (err) {
      console.error("Erreur:", err);
    }

    setIsLoading(false);
  };

  // ✅ NOUVELLE FONCTION: Synchroniser les données techniques depuis le catalogue
  const syncFromCatalog = async () => {
    setIsSyncing(true);

    try {
      // Récupérer les dépenses avec accessory_id
      const expensesWithAccessoryId = expenses.filter((e) => e.accessory_id);

      if (expensesWithAccessoryId.length === 0) {
        toast.info("Aucun article n'est lié au catalogue. Utilisez la sélection catalogue lors de l'ajout.");
        setIsSyncing(false);
        return;
      }

      // Récupérer les données du catalogue
      const accessoryIds = expensesWithAccessoryId.map((e) => e.accessory_id!);
      const { data: catalogData, error: catalogError } = await (supabase as any)
        .from("accessories_catalog")
        .select(
          "id, type_electrique, puissance_watts, intensite_amperes, poids_kg, longueur_mm, largeur_mm, hauteur_mm",
        )
        .in("id", accessoryIds);

      if (catalogError) {
        console.error("Erreur chargement catalogue:", catalogError);
        toast.error("Erreur lors de la récupération du catalogue");
        setIsSyncing(false);
        return;
      }

      // Créer un map pour accès rapide
      const catalogMap = new Map<string, CatalogItem>(catalogData.map((item: CatalogItem) => [item.id, item]));

      // Compter les mises à jour
      let updatedCount = 0;
      let skippedCount = 0;

      // Mettre à jour chaque dépense
      for (const expense of expensesWithAccessoryId) {
        const catalogItem = catalogMap.get(expense.accessory_id!);

        if (!catalogItem) {
          skippedCount++;
          continue;
        }

        // Vérifier si au moins un champ technique est rempli dans le catalogue
        const hasData = catalogItem.type_electrique || catalogItem.puissance_watts || catalogItem.intensite_amperes;

        if (!hasData) {
          skippedCount++;
          continue;
        }

        // Mettre à jour la dépense avec les données du catalogue
        const { error: updateError } = await supabase
          .from("project_expenses")
          .update({
            type_electrique: catalogItem.type_electrique,
            puissance_watts: catalogItem.puissance_watts,
            intensite_amperes: catalogItem.intensite_amperes,
            poids_kg: catalogItem.poids_kg,
            longueur_mm: catalogItem.longueur_mm,
            largeur_mm: catalogItem.largeur_mm,
            hauteur_mm: catalogItem.hauteur_mm,
          })
          .eq("id", expense.id);

        if (!updateError) {
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        toast.success(`${updatedCount} article(s) synchronisé(s) depuis le catalogue`);
        loadExpenses();
        onExpenseChange();
      } else if (skippedCount > 0) {
        toast.warning(
          `Aucune donnée technique trouvée dans le catalogue. Remplissez d'abord les champs techniques dans le catalogue.`,
        );
      } else {
        toast.info("Tous les articles sont déjà à jour");
      }
    } catch (err) {
      console.error("Erreur sync catalogue:", err);
      toast.error("Erreur lors de la synchronisation");
    }

    setIsSyncing(false);
  };

  const deleteExpense = async (id: string) => {
    if (isLocked) {
      toast.error("Le devis est verrouillé");
      return;
    }

    if (!confirm("Êtes-vous sûr de vouloir supprimer cette dépense ?")) {
      return;
    }

    const { error } = await supabase.from("project_expenses").delete().eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Dépense supprimée");

      // VERSION 2.6: Mise à jour locale uniquement
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      hasUnsyncedChanges.current = true;
    }
  };

  const cycleDeliveryStatus = async (expense: Expense) => {
    if (isLocked) {
      toast.error("Le devis est verrouillé");
      return;
    }

    const statusOrder: Expense["statut_livraison"][] = ["commande", "en_livraison", "livre"];
    const currentIndex = statusOrder.indexOf(expense.statut_livraison);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];

    const { error } = await supabase
      .from("project_expenses")
      .update({ statut_livraison: nextStatus })
      .eq("id", expense.id);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success("Statut mis à jour");

      // VERSION 2.6: Mise à jour locale uniquement (pas de refresh)
      setExpenses((prev) => prev.map((e) => (e.id === expense.id ? { ...e, statut_livraison: nextStatus } : e)));
      hasUnsyncedChanges.current = true;
    }
  };

  // VERSION 2.6: Changer le statut de plusieurs articles en même temps
  const bulkChangeDeliveryStatus = async (newStatus: Expense["statut_livraison"]) => {
    if (isLocked) {
      toast.error("Le devis est verrouillé");
      return;
    }

    if (selectedExpenseIds.size === 0) {
      toast.error("Aucun article sélectionné");
      return;
    }

    const ids = Array.from(selectedExpenseIds);

    const { error } = await supabase.from("project_expenses").update({ statut_livraison: newStatus }).in("id", ids);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success(`${ids.length} article(s) mis à jour`);

      // Mise à jour locale
      setExpenses((prev) =>
        prev.map((e) => (selectedExpenseIds.has(e.id) ? { ...e, statut_livraison: newStatus } : e)),
      );

      // Désélectionner et quitter le mode sélection
      setSelectedExpenseIds(new Set());
      setIsSelectionMode(false);
      hasUnsyncedChanges.current = true;
    }
  };

  // VERSION 2.6: Toggle sélection d'un article
  const toggleExpenseSelection = (expenseId: string) => {
    setSelectedExpenseIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(expenseId)) {
        newSet.delete(expenseId);
      } else {
        newSet.add(expenseId);
      }
      return newSet;
    });
  };

  // VERSION 2.6: Sélectionner/Désélectionner tout
  const toggleSelectAll = () => {
    if (selectedExpenseIds.size === filteredExpenses.length) {
      setSelectedExpenseIds(new Set());
    } else {
      setSelectedExpenseIds(new Set(filteredExpenses.map((e) => e.id)));
    }
  };

  // VERSION 2.6: Synchroniser avec le parent quand on quitte le mode sélection
  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedExpenseIds(new Set());
    if (hasUnsyncedChanges.current) {
      onExpenseChange();
      hasUnsyncedChanges.current = false;
    }
  };

  const updateQuantity = async (expenseId: string, newQuantity: number) => {
    if (isLocked) {
      toast.error("Le devis est verrouillé");
      return;
    }

    if (newQuantity < 1) {
      toast.error("La quantité doit être au moins 1");
      return;
    }

    const { error } = await supabase.from("project_expenses").update({ quantite: newQuantity }).eq("id", expenseId);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      loadExpenses();
      onExpenseChange();
    }
  };

  const getDeliveryInfo = (status: Expense["statut_livraison"] | null | undefined) => {
    switch (status) {
      case "commande":
        return {
          color: "border-orange-500 text-orange-500 bg-orange-50",
          label: "Commandé",
          icon: <Package className="h-3 w-3" />,
        };
      case "en_livraison":
        return {
          color: "border-blue-500 text-blue-500 bg-blue-50",
          label: "En livraison",
          icon: <ArrowRight className="h-3 w-3" />,
        };
      case "livre":
        return {
          color: "border-green-500 text-green-500 bg-green-50",
          label: "Livré",
          icon: <Truck className="h-3 w-3" />,
        };
      default:
        return {
          color: "border-gray-300 text-gray-500 bg-gray-50",
          label: "Non défini",
          icon: <Package className="h-3 w-3" />,
        };
    }
  };

  // ✅ NOUVELLE FONCTION: Obtenir le badge du type électrique
  const getElectricTypeBadge = (expense: Expense) => {
    if (!expense.type_electrique) return null;

    const typeConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      producteur: {
        color: "bg-yellow-100 text-yellow-700 border-yellow-300",
        icon: <Sun className="h-3 w-3" />,
        label: "Prod",
      },
      stockage: {
        color: "bg-blue-100 text-blue-700 border-blue-300",
        icon: <Battery className="h-3 w-3" />,
        label: "Stock",
      },
      consommateur: {
        color: "bg-red-100 text-red-700 border-red-300",
        icon: <Zap className="h-3 w-3" />,
        label: "Conso",
      },
      convertisseur: {
        color: "bg-purple-100 text-purple-700 border-purple-300",
        icon: <RefreshCw className="h-3 w-3" />,
        label: "Conv",
      },
    };

    const config = typeConfig[expense.type_electrique];
    if (!config) return null;

    return (
      <Badge variant="outline" className={`text-[10px] px-1 py-0 gap-0.5 ${config.color}`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  // Grouper par catégorie
  const groupedByCategory = categories.reduce(
    (acc, cat) => {
      acc[cat] = expenses.filter((e) => {
        const expenseCategory = e.categorie && e.categorie.trim() !== "" ? e.categorie : "Non catégorisé";
        return expenseCategory === cat;
      });
      return acc;
    },
    {} as Record<string, Expense[]>,
  );

  // VERSION 2.4: Filtrage combiné (catégorie + statut livraison)
  const filteredExpenses = expenses.filter((e) => {
    // Filtre par catégorie
    if (selectedCategory) {
      const expenseCategory = e.categorie && e.categorie.trim() !== "" ? e.categorie : "Non catégorisé";
      if (expenseCategory !== selectedCategory) return false;
    }
    // Filtre par statut de livraison
    if (selectedDeliveryStatus) {
      if (e.statut_livraison !== selectedDeliveryStatus) return false;
    }
    return true;
  });

  // VERSION 2.4: Compteurs par statut de livraison
  const deliveryStatusCounts = {
    commande: expenses.filter((e) => e.statut_livraison === "commande").length,
    en_livraison: expenses.filter((e) => e.statut_livraison === "en_livraison").length,
    livre: expenses.filter((e) => e.statut_livraison === "livre").length,
  };

  // Compter les articles avec/sans données techniques
  const articlesWithTechData = expenses.filter((e) => e.type_electrique || e.puissance_watts).length;
  const articlesWithAccessoryId = expenses.filter((e) => e.accessory_id).length;

  // Fonction pour décoder les entités HTML
  const decodeHtml = (text: string) => {
    if (!text) return text;
    return text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/<[^>]*>/g, "") // Enlever les balises HTML
      .replace(/\s+/g, " ")
      .trim();
  };

  // Fonction pour rendre une carte d'expense (évite la duplication)
  const renderExpenseCard = (expense: Expense) => (
    <Card
      key={expense.id}
      className={`p-2.5 ${isSelectionMode && selectedExpenseIds.has(expense.id) ? "ring-2 ring-blue-500 bg-blue-50/50" : ""}`}
      onClick={isSelectionMode ? () => toggleExpenseSelection(expense.id) : undefined}
      style={isSelectionMode ? { cursor: "pointer" } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        {/* VERSION 2.6: Cercle de sélection + badge statut en mode sélection */}
        {isSelectionMode && (
          <div className="shrink-0 pt-0.5 flex items-center gap-2">
            {selectedExpenseIds.has(expense.id) ? (
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
            ) : (
              <Circle className="h-5 w-5 text-gray-400" />
            )}
            {/* Badge statut de livraison visible en mode sélection */}
            <div
              className={`px-1.5 py-0.5 rounded text-xs flex items-center gap-1 ${getDeliveryInfo(expense.statut_livraison).color}`}
            >
              {getDeliveryInfo(expense.statut_livraison).icon}
            </div>
          </div>
        )}

        {/* Infos principales */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5 mb-1">
            <span className="text-sm shrink-0">{categoryIcons[expense.categorie] || "📦"}</span>
            <h4 className="text-sm font-medium leading-tight flex items-center gap-1">
              {decodeHtml(expense.nom_accessoire)}
              {expense.accessory_id && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Lié au catalogue</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </h4>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {expense.marque && (
              <Badge variant="secondary" className="text-xs py-0 px-1.5">
                {expense.marque}
              </Badge>
            )}

            {getElectricTypeBadge(expense)}

            <span>{(expense.prix || 0).toFixed(2)} € × </span>
            <Input
              type="number"
              min="1"
              value={expense.quantite}
              onChange={(e) => updateQuantity(expense.id, parseInt(e.target.value) || 1)}
              className="h-5 w-10 text-center text-xs p-0.5"
              disabled={isLocked || isSelectionMode}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {(expense.puissance_watts || expense.intensite_amperes) && (
            <div className="flex items-center gap-2 mt-1 text-xs">
              {expense.puissance_watts && (
                <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-0.5">
                  <Zap className="h-3 w-3" />
                  {expense.puissance_watts}W
                </span>
              )}
              {expense.intensite_amperes && (
                <span className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                  <Battery className="h-3 w-3" />
                  {expense.intensite_amperes}Ah
                </span>
              )}
            </div>
          )}

          {expense.prix_vente_ttc && (
            <div className="text-xs mt-1">
              <span className="text-muted-foreground">Vente: </span>
              <span className="font-semibold text-green-600">
                {((expense.prix_vente_ttc || 0) * (expense.quantite || 1)).toFixed(2)} €
              </span>
            </div>
          )}
        </div>

        {/* Actions - masquées en mode sélection */}
        {!isSelectionMode && (
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={`h-6 w-6 ${getDeliveryInfo(expense.statut_livraison).color}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      cycleDeliveryStatus(expense);
                    }}
                    disabled={isLocked}
                  >
                    {getDeliveryInfo(expense.statut_livraison).icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{getDeliveryInfo(expense.statut_livraison).label}</p>
                </TooltipContent>
              </Tooltip>

              {!isLocked && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingExpense(expense);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Modifier</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteExpense(expense.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Supprimer</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </TooltipProvider>
          </div>
        )}
      </div>
    </Card>
  );

  if (isLoading) {
    return <div className="text-center py-4 text-sm text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Boutons d'action */}
      {!isLocked && (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un article
          </Button>

          {/* ✅ NOUVEAU: Bouton synchronisation catalogue */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={syncFromCatalog}
                  disabled={isSyncing || articlesWithAccessoryId === 0}
                  className="gap-1"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                  Sync
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Synchroniser les données techniques depuis le catalogue</p>
                <p className="text-xs text-muted-foreground">
                  {articlesWithAccessoryId} article(s) lié(s) au catalogue
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* VERSION 2.6: Bouton mode sélection */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={isSelectionMode ? "default" : "outline"}
                  onClick={() => (isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true))}
                  className="gap-1"
                >
                  <CheckSquare className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isSelectionMode ? "Quitter le mode sélection" : "Mode sélection multiple"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* VERSION 2.4: Bouton plein écran */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => setIsFullscreenOpen(true)} className="gap-1">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ouvrir en plein écran</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* VERSION 2.7: Barre d'actions mode sélection - compacte sur 2 lignes */}
      {isSelectionMode && (
        <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
          {/* Ligne 1: Sélection + compteur + fermer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={toggleSelectAll} className="gap-1 text-xs h-7 px-2">
                {selectedExpenseIds.size === filteredExpenses.length ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                Tout
              </Button>

              <Badge variant="secondary" className="text-xs">
                {selectedExpenseIds.size} sélectionné(s)
              </Badge>
            </div>

            <Button size="sm" variant="ghost" onClick={exitSelectionMode} className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Ligne 2: Boutons de changement de statut */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Changer en :</span>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkChangeDeliveryStatus("commande")}
                    disabled={selectedExpenseIds.size === 0}
                    className="gap-1 text-xs h-7 px-2 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Commandé
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Marquer comme commandé</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkChangeDeliveryStatus("en_livraison")}
                    disabled={selectedExpenseIds.size === 0}
                    className="gap-1 text-xs h-7 px-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    En cours
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Marquer comme en livraison</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkChangeDeliveryStatus("livre")}
                    disabled={selectedExpenseIds.size === 0}
                    className="gap-1 text-xs h-7 px-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                  >
                    <PackageCheck className="h-3.5 w-3.5" />
                    Livré
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Marquer comme livré</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}

      {/* ✅ NOUVEAU: Indicateur données techniques */}
      {expenses.length > 0 && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Zap className="h-3 w-3" />
          <span>
            {articlesWithTechData}/{expenses.length} articles avec données techniques
          </span>
        </div>
      )}

      {/* Filtres par catégorie */}
      {categories.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          <Badge
            variant={selectedCategory === null ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setSelectedCategory(null)}
          >
            Tous ({expenses.length})
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setSelectedCategory(cat)}
            >
              <span className="mr-1">{categoryIcons[cat] || "📦"}</span>
              {cat} ({groupedByCategory[cat]?.length || 0})
            </Badge>
          ))}
        </div>
      )}

      {/* VERSION 2.4: Filtres par statut de livraison */}
      {expenses.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <Badge
            variant={selectedDeliveryStatus === null ? "secondary" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setSelectedDeliveryStatus(null)}
          >
            <Truck className="h-3 w-3 mr-1" />
            Tous ({expenses.length})
          </Badge>
          <Badge
            variant={selectedDeliveryStatus === "commande" ? "secondary" : "outline"}
            className={`cursor-pointer text-xs ${selectedDeliveryStatus === "commande" ? "bg-orange-100 text-orange-700 border-orange-300" : ""}`}
            onClick={() => setSelectedDeliveryStatus(selectedDeliveryStatus === "commande" ? null : "commande")}
          >
            <Clock className="h-3 w-3 mr-1" />
            Commandé ({deliveryStatusCounts.commande})
          </Badge>
          <Badge
            variant={selectedDeliveryStatus === "en_livraison" ? "secondary" : "outline"}
            className={`cursor-pointer text-xs ${selectedDeliveryStatus === "en_livraison" ? "bg-blue-100 text-blue-700 border-blue-300" : ""}`}
            onClick={() => setSelectedDeliveryStatus(selectedDeliveryStatus === "en_livraison" ? null : "en_livraison")}
          >
            <Truck className="h-3 w-3 mr-1" />
            En livraison ({deliveryStatusCounts.en_livraison})
          </Badge>
          <Badge
            variant={selectedDeliveryStatus === "livre" ? "secondary" : "outline"}
            className={`cursor-pointer text-xs ${selectedDeliveryStatus === "livre" ? "bg-green-100 text-green-700 border-green-300" : ""}`}
            onClick={() => setSelectedDeliveryStatus(selectedDeliveryStatus === "livre" ? null : "livre")}
          >
            <PackageCheck className="h-3 w-3 mr-1" />
            Livré ({deliveryStatusCounts.livre})
          </Badge>
        </div>
      )}

      {/* Liste des dépenses - groupées par catégorie */}
      {filteredExpenses.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          {expenses.length === 0
            ? "Aucun article dans ce scénario"
            : "Aucun article ne correspond aux filtres sélectionnés"}
        </div>
      ) : selectedCategory || selectedDeliveryStatus ? (
        // Mode filtre : affichage simple (catégorie ou livraison sélectionnée)
        <div className="space-y-2">{filteredExpenses.map((expense) => renderExpenseCard(expense))}</div>
      ) : (
        // Mode groupé : afficher toutes les catégories avec séparateurs
        <div className="space-y-3">
          {categories.map((cat) => {
            const catExpenses = groupedByCategory[cat] || [];
            if (catExpenses.length === 0) return null;

            const catTotal = catExpenses.reduce((sum, e) => sum + (e.prix_vente_ttc || e.prix || 0) * e.quantite, 0);

            return (
              <div key={cat} className="space-y-2">
                {/* Séparateur catégorie */}
                <div className="flex items-center gap-2 py-1 px-2 bg-muted/50 rounded-md sticky top-0 z-10">
                  <span className="text-sm">{categoryIcons[cat] || "📦"}</span>
                  <span className="text-xs font-medium text-muted-foreground flex-1">{cat}</span>
                  <Badge variant="secondary" className="text-xs">
                    {catExpenses.length} • {catTotal.toFixed(0)} €
                  </Badge>
                </div>
                {/* Articles de cette catégorie */}
                {catExpenses.map((expense) => renderExpenseCard(expense))}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog pour ajouter/modifier */}
      <ExpenseFormDialog
        isOpen={isDialogOpen || editingExpense !== null}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingExpense(null);
        }}
        projectId={projectId}
        existingCategories={allCategories}
        expense={editingExpense}
        scenarioId={scenarioId}
        isLocked={isLocked}
        onSuccess={() => {
          loadExpenses();
          onExpenseChange();
          setIsDialogOpen(false);
          setEditingExpense(null);
        }}
      />

      {/* VERSION 2.6: Modale plein écran */}
      <Dialog
        open={isFullscreenOpen}
        onOpenChange={(open) => {
          setIsFullscreenOpen(open);
          // Synchroniser les changements à la fermeture
          if (!open && hasUnsyncedChanges.current) {
            onExpenseChange();
            hasUnsyncedChanges.current = false;
          }
        }}
      >
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Liste des articles ({expenses.length})</span>
              <div className="flex gap-2 text-sm font-normal">
                <Badge variant="outline" className="bg-orange-50">
                  <Clock className="h-3 w-3 mr-1" />
                  Commandé: {deliveryStatusCounts.commande}
                </Badge>
                <Badge variant="outline" className="bg-blue-50">
                  <Truck className="h-3 w-3 mr-1" />
                  En livraison: {deliveryStatusCounts.en_livraison}
                </Badge>
                <Badge variant="outline" className="bg-green-50">
                  <PackageCheck className="h-3 w-3 mr-1" />
                  Livré: {deliveryStatusCounts.livre}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Filtres dans la modale */}
          <div className="flex gap-2 flex-wrap border-b pb-3">
            {/* Filtres catégorie */}
            <div className="flex gap-1.5 flex-wrap">
              <Badge
                variant={selectedCategory === null ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setSelectedCategory(null)}
              >
                Toutes catégories ({expenses.length})
              </Badge>
              {categories.map((cat) => (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span className="mr-1">{categoryIcons[cat] || "📦"}</span>
                  {cat} ({groupedByCategory[cat]?.length || 0})
                </Badge>
              ))}
            </div>

            {/* Séparateur */}
            <div className="w-px h-6 bg-border self-center" />

            {/* Filtres livraison */}
            <div className="flex gap-1.5 flex-wrap">
              <Badge
                variant={selectedDeliveryStatus === null ? "secondary" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setSelectedDeliveryStatus(null)}
              >
                Tous statuts
              </Badge>
              <Badge
                variant={selectedDeliveryStatus === "commande" ? "secondary" : "outline"}
                className={`cursor-pointer text-xs ${selectedDeliveryStatus === "commande" ? "bg-orange-100 text-orange-700" : ""}`}
                onClick={() => setSelectedDeliveryStatus(selectedDeliveryStatus === "commande" ? null : "commande")}
              >
                <Clock className="h-3 w-3 mr-1" />
                Commandé
              </Badge>
              <Badge
                variant={selectedDeliveryStatus === "en_livraison" ? "secondary" : "outline"}
                className={`cursor-pointer text-xs ${selectedDeliveryStatus === "en_livraison" ? "bg-blue-100 text-blue-700" : ""}`}
                onClick={() =>
                  setSelectedDeliveryStatus(selectedDeliveryStatus === "en_livraison" ? null : "en_livraison")
                }
              >
                <Truck className="h-3 w-3 mr-1" />
                En livraison
              </Badge>
              <Badge
                variant={selectedDeliveryStatus === "livre" ? "secondary" : "outline"}
                className={`cursor-pointer text-xs ${selectedDeliveryStatus === "livre" ? "bg-green-100 text-green-700" : ""}`}
                onClick={() => setSelectedDeliveryStatus(selectedDeliveryStatus === "livre" ? null : "livre")}
              >
                <PackageCheck className="h-3 w-3 mr-1" />
                Livré
              </Badge>
            </div>
          </div>

          {/* Liste scrollable */}
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 gap-3 p-1">
              {filteredExpenses.map((expense) => (
                <Card key={expense.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <span className="text-lg shrink-0">{categoryIcons[expense.categorie] || "📦"}</span>
                        <div>
                          <h4 className="font-medium leading-tight">{decodeHtml(expense.nom_accessoire)}</h4>
                          {expense.marque && <p className="text-sm text-muted-foreground">{expense.marque}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-sm mt-2">
                        <span className="text-muted-foreground">
                          {expense.prix?.toFixed(2)} € × {expense.quantite}
                        </span>
                        {expense.prix_vente_ttc && (
                          <span className="text-green-600 font-medium">
                            Vente: {(expense.prix_vente_ttc * expense.quantite).toFixed(2)} €
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1">
                      {/* Statut livraison */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cycleDeliveryStatus(expense)}
                              disabled={isLocked}
                              className={`h-8 px-2 ${getDeliveryInfo(expense.statut_livraison).color}`}
                            >
                              {getDeliveryInfo(expense.statut_livraison).icon}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{getDeliveryInfo(expense.statut_livraison).label}</p>
                            <p className="text-xs text-muted-foreground">Cliquer pour changer</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {/* Boutons éditer/supprimer */}
                      {!isLocked && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingExpense(expense)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteExpense(expense.id)}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompactExpensesList;
