import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, CreditCard, Package, ArrowRight, Truck, Edit, Minus } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ExpenseFormDialog from "./ExpenseFormDialog";
import { Input } from "@/components/ui/input";

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
  accessory_id?: string;
}

interface ExpensesListProps {
  projectId: string;
  onExpenseChange: () => void;
}

interface PaymentTransaction {
  id: string;
  montant: number;
}

const ExpensesList = ({ projectId, onExpenseChange }: ExpensesListProps) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [paymentTransactions, setPaymentTransactions] = useState<PaymentTransaction[]>([]);
  const [totalSales, setTotalSales] = useState(0);

  useEffect(() => {
    loadExpenses();
    loadPaymentTransactions();
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
      
      // Extract unique categories, including empty ones as "Non catégorisé"
      const uniqueCategories = Array.from(new Set(
        expensesData.map(e => e.categorie && e.categorie.trim() !== "" ? e.categorie : "Non catégorisé")
      ));
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

  const loadPaymentTransactions = async () => {
    const { data, error } = await supabase
      .from("project_payment_transactions")
      .select("id, montant")
      .eq("project_id", projectId);

    if (error) {
      console.error(error);
      return;
    }

    setPaymentTransactions(data || []);
  };

  const getPaymentStatus = () => {
    const totalPaid = paymentTransactions.reduce((sum, t) => sum + t.montant, 0);
    
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
        label: "Paiement partiel"
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
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette dépense ?")) {
      return;
    }

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

  const updateQuantity = async (expenseId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      toast.error("La quantité doit être au moins 1");
      return;
    }

    const { error } = await supabase
      .from("project_expenses")
      .update({ quantite: newQuantity })
      .eq("id", expenseId);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
    } else {
      toast.success("Quantité mise à jour");
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
    ? expenses.filter(e => {
        const expenseCategory = e.categorie && e.categorie.trim() !== "" ? e.categorie : "Non catégorisé";
        return expenseCategory === selectedCategory;
      })
    : expenses;

  const groupedByCategory = categories.reduce((acc, cat) => {
    acc[cat] = expenses.filter(e => {
      const expenseCategory = e.categorie && e.categorie.trim() !== "" ? e.categorie : "Non catégorisé";
      return expenseCategory === cat;
    });
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
        {selectedCategory ? (
          <div className="space-y-3">
            {filteredExpenses.map((expense) => (
              <Card key={expense.id} className="p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1">
                    <div className="col-span-2 flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium">{expense.nom_accessoire}</h4>
                      <Badge variant="outline" className="text-xs">{expense.categorie}</Badge>
                      {expense.marque && <Badge variant="secondary" className="text-xs">{expense.marque}</Badge>}
                    </div>
                    
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>Prix achat: {expense.prix.toFixed(2)} € × </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => updateQuantity(expense.id, expense.quantite - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={expense.quantite}
                          onChange={(e) => updateQuantity(expense.id, parseInt(e.target.value) || 1)}
                          className="h-6 w-12 text-center text-xs p-0"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => updateQuantity(expense.id, expense.quantite + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold">Total achat: {(expense.prix * expense.quantite).toFixed(2)} €</span>
                    </div>

                    {expense.prix_vente_ttc && (
                      <div className="text-xs text-muted-foreground">
                        <span>Prix vente TTC: {expense.prix_vente_ttc.toFixed(2)} €</span>
                      </div>
                    )}
                    {expense.marge_pourcent && (
                      <div className="text-xs text-muted-foreground">
                        <span>Marge: {expense.marge_pourcent.toFixed(2)} %</span>
                      </div>
                    )}

                    {expense.date_achat && (
                      <div className="text-xs text-muted-foreground">
                        <span>Date: {new Date(expense.date_achat).toLocaleDateString()}</span>
                      </div>
                    )}
                    {expense.fournisseur && (
                      <div className="text-xs text-muted-foreground">
                        <span>Fournisseur: {expense.fournisseur}</span>
                      </div>
                    )}
                    
                    {expense.notes && (
                      <div className="col-span-2 text-xs text-muted-foreground italic">
                        {expense.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingExpense(expense)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Modifier</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`h-8 w-8 border rounded-md flex items-center justify-center ${getPaymentStatus().color}`}>
                            <CreditCard className="h-4 w-4" />
                          </div>
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
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {categories.map((category) => (
              <AccordionItem key={category} value={category} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{category}</span>
                    <Badge variant="secondary">{groupedByCategory[category].length} article(s)</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {groupedByCategory[category].map((expense) => (
                      <Card key={expense.id} className="p-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1">
                            <div className="col-span-2 flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-medium">{expense.nom_accessoire}</h4>
                              {expense.marque && <Badge variant="secondary" className="text-xs">{expense.marque}</Badge>}
                            </div>
                            
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>Prix achat: {expense.prix.toFixed(2)} € × </span>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => updateQuantity(expense.id, expense.quantite - 1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number"
                                  min="1"
                                  value={expense.quantite}
                                  onChange={(e) => updateQuantity(expense.id, parseInt(e.target.value) || 1)}
                                  className="h-6 w-12 text-center text-xs p-0"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => updateQuantity(expense.id, expense.quantite + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <span className="font-semibold">Total achat: {(expense.prix * expense.quantite).toFixed(2)} €</span>
                            </div>

                            {expense.prix_vente_ttc && (
                              <div className="text-xs text-muted-foreground">
                                <span>Prix vente TTC: {expense.prix_vente_ttc.toFixed(2)} €</span>
                              </div>
                            )}
                            {expense.marge_pourcent && (
                              <div className="text-xs text-muted-foreground">
                                <span>Marge: {expense.marge_pourcent.toFixed(2)} %</span>
                              </div>
                            )}

                            {expense.date_achat && (
                              <div className="text-xs text-muted-foreground">
                                <span>Date: {new Date(expense.date_achat).toLocaleDateString()}</span>
                              </div>
                            )}
                            {expense.fournisseur && (
                              <div className="text-xs text-muted-foreground">
                                <span>Fournisseur: {expense.fournisseur}</span>
                              </div>
                            )}
                            
                            {expense.notes && (
                              <div className="col-span-2 text-xs text-muted-foreground italic">
                                {expense.notes}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-1.5">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setEditingExpense(expense)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Modifier</p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`h-8 w-8 border rounded-md flex items-center justify-center ${getPaymentStatus().color}`}>
                                    <CreditCard className="h-4 w-4" />
                                  </div>
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
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </ScrollArea>

      <ExpenseFormDialog
        isOpen={isDialogOpen || editingExpense !== null}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingExpense(null);
        }}
        projectId={projectId}
        existingCategories={categories}
        expense={editingExpense}
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

export default ExpensesList;
