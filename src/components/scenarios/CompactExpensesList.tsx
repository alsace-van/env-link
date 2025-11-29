// components/scenarios/CompactExpensesList.tsx
// Liste compacte des dépenses pour un scénario - optimisée pour 450px

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Edit, Trash2, Package, Truck, ArrowRight, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import ExpenseFormDialog from "@/components/ExpenseFormDialog";
import OrderTrackingSidebar from "@/components/OrderTrackingSidebar";

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryIcons, setCategoryIcons] = useState<Record<string, string>>({});
  const [isOrderTrackingOpen, setIsOrderTrackingOpen] = useState(false);

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

  const getDeliveryInfo = (status: Expense["statut_livraison"]) => {
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
    }
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

  if (isLoading) {
    return <div className="text-center py-4 text-sm text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Boutons d'action */}
      <div className="flex gap-2">
        {!isLocked && (
          <Button size="sm" className="flex-1" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un article
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setIsOrderTrackingOpen(true)}>
          <ShoppingCart className="h-4 w-4" />
        </Button>
      </div>

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

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {expense.marque && (
                      <Badge variant="secondary" className="text-xs py-0 px-1.5">
                        {expense.marque}
                      </Badge>
                    )}
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

      {/* Sidebar suivi des commandes */}
      <OrderTrackingSidebar
        isOpen={isOrderTrackingOpen}
        onClose={() => setIsOrderTrackingOpen(false)}
        onOrderChange={() => {
          loadExpenses();
          onExpenseChange();
        }}
      />
    </div>
  );
};

export default CompactExpensesList;
