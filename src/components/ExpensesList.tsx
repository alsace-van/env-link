import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, CreditCard, Package, ArrowRight, Truck } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

interface PaymentInfo {
  acompte: number;
  acompte_paye: boolean;
  solde: number;
  solde_paye: boolean;
}

const ExpensesList = ({ projectId, onExpenseChange }: ExpensesListProps) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    acompte: 0,
    acompte_paye: false,
    solde: 0,
    solde_paye: false,
  });
  const [totalSales, setTotalSales] = useState(0);

  useEffect(() => {
    loadExpenses();
    loadPaymentInfo();
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

      // Calculate total sales
      let total = 0;
      expensesData.forEach((expense) => {
        if (expense.prix_vente_ttc) {
          total += expense.prix_vente_ttc * expense.quantite;
        }
      });
      setTotalSales(total);
    }
    setIsLoading(false);
  };

  const loadPaymentInfo = async () => {
    const { data, error } = await supabase
      .from("project_payments")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      setPaymentInfo({
        acompte: data.acompte,
        acompte_paye: data.acompte_paye,
        solde: data.solde,
        solde_paye: data.solde_paye,
      });
    }
  };

  const getPaymentStatus = () => {
    const totalPaid = paymentInfo.acompte + paymentInfo.solde;
    
    if (totalPaid === 0) {
      return {
        color: "border-red-500 text-red-500 bg-red-50",
        label: "Aucun paiement"
      };
    } else if (totalPaid >= totalSales) {
      return {
        color: "border-green-500 text-green-500 bg-green-50",
        label: "Entièrement payé"
      };
    } else {
      return {
        color: "border-orange-500 text-orange-500 bg-orange-50",
        label: "Acompte versé"
      };
    }
  };

  const cycleDeliveryStatus = async (expense: Expense) => {
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

  const getDeliveryInfo = (status: Expense["statut_livraison"]) => {
    switch (status) {
      case "commande":
        return { 
          color: "border-orange-500 text-orange-500 bg-orange-50",
          label: "Commandé",
          icon: <Package className="h-4 w-4" />
        };
      case "en_livraison":
        return {
          color: "border-blue-500 text-blue-500 bg-blue-50",
          label: "En livraison",
          icon: <ArrowRight className="h-4 w-4" />
        };
      case "livre":
        return {
          color: "border-green-500 text-green-500 bg-green-50",
          label: "Livré",
          icon: <Truck className="h-4 w-4" />
        };
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
            <Card key={expense.id} className="p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">{expense.nom_accessoire}</h4>
                    <Badge variant="outline" className="text-xs">{expense.categorie}</Badge>
                    {expense.marque && <Badge variant="secondary" className="text-xs">{expense.marque}</Badge>}
                  </div>
                  
                  <div className="text-xs text-muted-foreground space-y-0.5">
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

                <div className="flex flex-col gap-1.5">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-8 w-8 ${getPaymentStatus().color}`}
                          onClick={() => {}}
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{getPaymentStatus().label}</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-8 w-8 ${getDeliveryInfo(expense.statut_livraison).color}`}
                          onClick={() => cycleDeliveryStatus(expense)}
                        >
                          {getDeliveryInfo(expense.statut_livraison).icon}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{getDeliveryInfo(expense.statut_livraison).label}</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => deleteExpense(expense.id)}
                        >
                          <span className="text-xs font-bold">×</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Supprimer</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
