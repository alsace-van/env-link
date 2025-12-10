// components/scenarios/CompactExpensesList.tsx
// Liste compacte des dépenses pour un scénario - optimisée pour 450px
// ✅ MODIFIÉ: Ajout bouton synchronisation catalogue + affichage champs techniques

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Edit, Trash2, Package, Truck, ArrowRight, RefreshCw, Zap, Battery, Sun } from "lucide-react";
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

const CompactExpensesList = ({ projectId, scenarioId, isLocked, onExpenseChange }: CompactExpensesListProps) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryIcons, setCategoryIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    loadExpenses();
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
      const accessoryIds = expensesWithAccessoryId.map((e) => e.accessory_id);
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
      const catalogMap = new Map(catalogData.map((item: any) => [item.id, item]));

      // Compter les mises à jour
      let updatedCount = 0;
      let skippedCount = 0;

      // Mettre à jour chaque dépense
      for (const expense of expensesWithAccessoryId) {
        const catalogItem = catalogMap.get(expense.accessory_id);

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
      loadExpenses();
      onExpenseChange();
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
      toast.success("Statut de livraison mis à jour");
      loadExpenses();
      onExpenseChange();
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

  const filteredExpenses = selectedCategory
    ? expenses.filter((e) => {
        const expenseCategory = e.categorie && e.categorie.trim() !== "" ? e.categorie : "Non catégorisé";
        return expenseCategory === selectedCategory;
      })
    : expenses;

  // Compter les articles avec/sans données techniques
  const articlesWithTechData = expenses.filter((e) => e.type_electrique || e.puissance_watts).length;
  const articlesWithAccessoryId = expenses.filter((e) => e.accessory_id).length;

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

      {/* Liste des dépenses */}
      {filteredExpenses.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">Aucun article dans ce scénario</div>
      ) : (
        <div className="space-y-2">
          {filteredExpenses.map((expense) => (
            <Card key={expense.id} className="p-2.5">
              <div className="flex items-start justify-between gap-2">
                {/* Infos principales */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{categoryIcons[expense.categorie] || "📦"}</span>
                    <h4 className="text-sm font-medium truncate">{expense.nom_accessoire}</h4>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    {expense.marque && (
                      <Badge variant="secondary" className="text-xs py-0 px-1.5">
                        {expense.marque}
                      </Badge>
                    )}

                    {/* ✅ NOUVEAU: Badge type électrique */}
                    {getElectricTypeBadge(expense)}

                    <span>{expense.prix.toFixed(2)} € × </span>
                    <Input
                      type="number"
                      min="1"
                      value={expense.quantite}
                      onChange={(e) => updateQuantity(expense.id, parseInt(e.target.value) || 1)}
                      className="h-5 w-10 text-center text-xs p-0.5"
                      disabled={isLocked}
                    />
                  </div>

                  {/* ✅ NOUVEAU: Affichage puissance/intensité si disponible */}
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
                        {(expense.prix_vente_ttc * expense.quantite).toFixed(2)} €
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-6 w-6 ${getDeliveryInfo(expense.statut_livraison).color}`}
                          onClick={() => cycleDeliveryStatus(expense)}
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
                              onClick={() => setEditingExpense(expense)}
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
                              onClick={() => deleteExpense(expense.id)}
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
              </div>
            </Card>
          ))}
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
        existingCategories={categories}
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
    </div>
  );
};

export default CompactExpensesList;
