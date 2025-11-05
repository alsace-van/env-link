import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Trash2, Edit, Search, Euro } from "lucide-react";
import { toast } from "sonner";
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
import ExpenseFormDialog from "./ExpenseFormDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ExpenseOption {
  id: string;
  option_id: string;
  nom: string;
  prix_vente: number;
  accessories_options?: {
    nom: string;
  };
}

interface Expense {
  id: string;
  nom_accessoire: string;
  marque: string | null;
  categorie: string;
  quantite: number;
  prix_achat_unitaire: number;
  prix_vente_unitaire: number;
  prix_achat_total: number;
  prix_vente_total: number;
  fournisseur: string | null;
  date_achat: string | null;
  garantie_mois: number | null;
  url_fiche_produit: string | null;
  notes: string | null;
  created_at: string;
  expense_options?: ExpenseOption[];
}

interface ExpensesListProps {
  projectId: string;
  refreshTrigger?: number;
}

const ExpensesList = ({ projectId, refreshTrigger }: ExpensesListProps) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (projectId) {
      loadExpenses();
    }
  }, [projectId, refreshTrigger]);

  useEffect(() => {
    filterExpenses();
  }, [expenses, searchTerm, categoryFilter]);

  const loadExpenses = async () => {
    try {
      setLoading(true);

      // Load expenses with their selected options
      const { data: expensesData, error: expensesError } = await supabase
        .from("project_expenses")
        .select(
          `
          *,
          expense_options:expense_selected_options(
            id,
            option_id,
            nom,
            prix_vente,
            accessories_options(nom)
          )
        `,
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (expensesError) throw expensesError;

      const expensesWithOptions = (expensesData || []).map((expense) => ({
        ...expense,
        expense_options: expense.expense_options || [],
      }));

      setExpenses(expensesWithOptions);

      // Extract unique categories
      const uniqueCategories = [...new Set(expensesWithOptions.map((e) => e.categorie))];
      setCategories(uniqueCategories);
    } catch (error: any) {
      console.error("Error loading expenses:", error);
      toast.error("Erreur lors du chargement des dépenses");
    } finally {
      setLoading(false);
    }
  };

  const filterExpenses = () => {
    let filtered = expenses;

    if (searchTerm) {
      filtered = filtered.filter(
        (expense) =>
          expense.nom_accessoire.toLowerCase().includes(searchTerm.toLowerCase()) ||
          expense.marque?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          expense.fournisseur?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((expense) => expense.categorie === categoryFilter);
    }

    setFilteredExpenses(filtered);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("project_expenses").delete().eq("id", id);

      if (error) throw error;

      toast.success("Dépense supprimée");
      loadExpenses();
    } catch (error: any) {
      console.error("Error deleting expense:", error);
      toast.error("Erreur lors de la suppression");
    }
    setDeleteId(null);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredExpenses.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm || categoryFilter !== "all"
            ? "Aucune dépense trouvée avec ces filtres"
            : "Aucune dépense pour ce projet"}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExpenses.map((expense) => (
            <Card key={expense.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-semibold">{expense.nom_accessoire}</h4>
                    <Badge variant="outline" className="text-xs">
                      {expense.categorie}
                    </Badge>
                    {expense.marque && (
                      <Badge variant="secondary" className="text-xs">
                        {expense.marque}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs block">Quantité</span>
                      <span className="font-medium">{expense.quantite}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-xs block">Prix d'achat (unitaire)</span>
                      <span className="text-sm">{formatPrice(expense.prix_achat_unitaire)}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-xs block">Prix de vente</span>
                      <span className="text-2xl font-bold text-green-600">{formatPrice(expense.prix_vente_total)}</span>
                    </div>
                  </div>

                  {expense.expense_options && expense.expense_options.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <span className="text-xs text-muted-foreground">Options sélectionnées:</span>
                      <div className="flex flex-wrap gap-1">
                        {expense.expense_options.map((option) => (
                          <Badge key={option.id} variant="outline" className="text-xs">
                            {option.nom} (+{formatPrice(option.prix_vente)})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {expense.fournisseur && (
                    <div className="text-xs text-muted-foreground">Fournisseur: {expense.fournisseur}</div>
                  )}

                  {expense.notes && <div className="text-xs text-muted-foreground italic">{expense.notes}</div>}
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setEditExpense(expense)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(expense.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editExpense && (
        <ExpenseFormDialog
          open={!!editExpense}
          onOpenChange={(open) => !open && setEditExpense(null)}
          projectId={projectId}
          expense={editExpense}
          onSuccess={() => {
            setEditExpense(null);
            loadExpenses();
          }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette dépense ? Cette action est irréversible.
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
    </div>
  );
};

export default ExpensesList;
