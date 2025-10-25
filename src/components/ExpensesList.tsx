import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Check, X, Package, Truck, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import ExpenseFormDialog from "./ExpenseFormDialog";

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
  statut_paiement: "non_paye" | "paye";
  statut_livraison: "commande" | "en_livraison" | "livre";
  fournisseur?: string;
  notes?: string;
}

interface ExpensesListProps {
  projectId: string;
  onExpenseChange: () => void;
}

const ExpensesList = ({ projectId, onExpenseChange }: ExpensesListProps) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    loadExpenses();
  }, [projectId]);

  const loadExpenses = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("project_expenses")
      .select("*")
      .eq("project_id", projectId)
      .order("date_achat", { ascending: false });

    if (error) {
      toast.error("Erreur lors du chargement des dépenses");
      console.error(error);
    } else {
      const expensesData = (data || []) as Expense[];
      setExpenses(expensesData);
      
      // Extract unique categories
      const uniqueCategories = Array.from(new Set(expensesData.map(e => e.categorie).filter(Boolean)));
      setCategories(uniqueCategories);
    }
    setIsLoading(false);
  };

  const togglePaymentStatus = async (expense: Expense) => {
    const newStatus = expense.statut_paiement === "paye" ? "non_paye" : "paye";
    const { error } = await supabase
      .from("project_expenses")
      .update({ statut_paiement: newStatus })
      .eq("id", expense.id);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success("Statut de paiement mis à jour");
      loadExpenses();
      onExpenseChange();
    }
  };

  const updateDeliveryStatus = async (expense: Expense, newStatus: Expense["statut_livraison"]) => {
    const { error } = await supabase
      .from("project_expenses")
      .update({ statut_livraison: newStatus })
      .eq("id", expense.id);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success("Statut de livraison mis à jour");
      loadExpenses();
      onExpenseChange();
    }
  };

  const deleteExpense = async (id: string) => {
    const { error } = await supabase
      .from("project_expenses")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Dépense supprimée");
      loadExpenses();
      onExpenseChange();
    }
  };

  const getDeliveryIcon = (status: Expense["statut_livraison"]) => {
    switch (status) {
      case "commande":
        return <Package className="h-4 w-4" />;
      case "en_livraison":
        return <Truck className="h-4 w-4" />;
      case "livre":
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getDeliveryColor = (status: Expense["statut_livraison"]) => {
    switch (status) {
      case "commande":
        return "bg-orange-500";
      case "en_livraison":
        return "bg-blue-500";
      case "livre":
        return "bg-green-500";
    }
  };

  const filteredExpenses = selectedCategory
    ? expenses.filter(e => e.categorie === selectedCategory)
    : expenses;

  const groupedByCategory = categories.reduce((acc, cat) => {
    acc[cat] = expenses.filter(e => e.categorie === cat);
    return acc;
  }, {} as Record<string, Expense[]>);

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Liste des dépenses</h3>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une dépense
        </Button>
      </div>

      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            Toutes ({expenses.length})
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat} ({groupedByCategory[cat].length})
            </Button>
          ))}
        </div>
      )}

      <ScrollArea className="h-[600px]">
        <div className="space-y-3">
          {filteredExpenses.map((expense) => (
            <Card key={expense.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{expense.nom_accessoire}</h4>
                    <Badge variant="outline">{expense.categorie}</Badge>
                    {expense.marque && <Badge variant="secondary">{expense.marque}</Badge>}
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Prix d'achat unitaire: {expense.prix.toFixed(2)} € × {expense.quantite}</p>
                    <p className="font-semibold">Total achat: {(expense.prix * expense.quantite).toFixed(2)} €</p>
                    {expense.prix_vente_ttc && (
                      <p>Prix de vente TTC: {expense.prix_vente_ttc.toFixed(2)} €</p>
                    )}
                    {expense.marge_pourcent && (
                      <p>Marge: {expense.marge_pourcent.toFixed(2)} %</p>
                    )}
                    {expense.date_achat && (
                      <p>Date d'achat: {new Date(expense.date_achat).toLocaleDateString()}</p>
                    )}
                    {expense.fournisseur && <p>Fournisseur: {expense.fournisseur}</p>}
                    {expense.notes && <p className="italic">{expense.notes}</p>}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => togglePaymentStatus(expense)}
                    className={expense.statut_paiement === "paye" ? "bg-green-50" : "bg-red-50"}
                  >
                    {expense.statut_paiement === "paye" ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Payé
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-1" />
                        Non payé
                      </>
                    )}
                  </Button>

                  <div className="flex gap-1">
                    {(["commande", "en_livraison", "livre"] as const).map((status) => (
                      <Button
                        key={status}
                        variant="outline"
                        size="sm"
                        onClick={() => updateDeliveryStatus(expense, status)}
                        className={expense.statut_livraison === status ? getDeliveryColor(status) + " text-white" : ""}
                      >
                        {getDeliveryIcon(status)}
                      </Button>
                    ))}
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteExpense(expense.id)}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {filteredExpenses.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Aucune dépense dans cette catégorie
            </div>
          )}
        </div>
      </ScrollArea>

      <ExpenseFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        projectId={projectId}
        existingCategories={categories}
        onSuccess={() => {
          loadExpenses();
          onExpenseChange();
          setIsDialogOpen(false);
        }}
      />
    </div>
  );
};

export default ExpensesList;
