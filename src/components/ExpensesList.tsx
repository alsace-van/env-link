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
  selectedOptions?: Array<{
    nom: string;
    prix_reference: number;
    prix_vente_ttc: number;
    marge_pourcent: number;
  }>;
}

interface ExpensesListProps {
  projectId: string;
  onExpenseChange?: () => void;
  refreshTrigger?: number;
}

interface PaymentTransaction {
  id: string;
  montant: number;
}

const ExpensesList = ({ projectId, onExpenseChange, refreshTrigger }: ExpensesListProps) => {
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
  }, [projectId, refreshTrigger]);

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

      // Load selected options for each expense
      const expensesWithOptions = await Promise.all(
        expensesData.map(async (expense) => {
          const { data: selectedOptions } = await supabase
            .from("expense_selected_options")
            .select(
              `
              option_id,
              accessory_options!inner(
                nom,
                prix_reference,
                prix_vente_ttc,
                marge_pourcent
              )
            `,
            )
            .eq("expense_id", expense.id);

          return {
            ...expense,
            selectedOptions:
              selectedOptions?.map((opt: any) => ({
                nom: opt.accessory_options.nom,
                prix_reference: opt.accessory_options.prix_reference || 0,
                prix_vente_ttc: opt.accessory_options.prix_vente_ttc || 0,
                marge_pourcent: opt.accessory_options.marge_pourcent || 0,
              })) || [],
          };
        }),
      );

      setExpenses(expensesWithOptions);

      // Extract unique categories, including empty ones as "Non catégorisé"
      const uniqueCategories = Array.from(
        new Set(
          expensesWithOptions.map((e) => (e.categorie && e.categorie.trim() !== "" ? e.categorie : "Non catégorisé")),
        ),
      );
      setCategories(uniqueCategories);

      // Calculate total sales including options
      let total = 0;
      expensesWithOptions.forEach((expense) => {
        if (expense.prix_vente_ttc) {
          const optionsVenteTotal = (expense.selectedOptions || []).reduce((sum, opt) => sum + opt.prix_vente_ttc, 0);
          total += (expense.prix_vente_ttc + optionsVenteTotal) * expense.quantite;
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
        label: "Aucun paiement",
      };
    } else if (totalPaid >= totalSales) {
      return {
        color: "border-green-500 text-green-500 bg-green-50",
        label: "Entièrement payé",
      };
    } else {
      return {
        color: "border-orange-500 text-orange-500 bg-orange-50",
        label: "Paiement partiel",
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

    const { error } = await supabase.from("project_expenses").delete().eq("id", id);

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

    const { error } = await supabase.from("project_expenses").update({ quantite: newQuantity }).eq("id", expenseId);

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
          icon: <Package className="h-4 w-4" />,
        };
      case "en_livraison":
        return {
          color: "border-blue-500 text-blue-500 bg-blue-50",
          label: "En livraison",
          icon: <ArrowRight className="h-4 w-4" />,
        };
      case "livre":
        return {
          color: "border-green-500 text-green-500 bg-green-50",
          label: "Livré",
          icon: <Truck className="h-4 w-4" />,
        };
    }
  };

  const filteredExpenses = selectedCategory
    ? expenses.filter((e) => {
        const expenseCategory = e.categorie && e.categorie.trim() !== "" ? e.categorie : "Non catégorisé";
        return expenseCategory === selectedCategory;
      })
    : expenses;

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
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">{expense.nom_accessoire}</h4>
                      <Badge variant="outline" className="text-xs">
                        {expense.categorie}
                      </Badge>
                      {expense.marque && (
                        <Badge variant="secondary" className="text-xs">
                          {expense.marque}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span>Prix achat: {expense.prix.toFixed(2)} € × </span>
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => updateQuantity(expense.id, expense.quantite - 1)}
                          >
                            <Minus className="h-2 w-2" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            value={expense.quantite}
                            onChange={(e) => updateQuantity(expense.id, parseInt(e.target.value) || 1)}
                            className="h-5 w-10 text-center text-xs p-0"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => updateQuantity(expense.id, expense.quantite + 1)}
                          >
                            <Plus className="h-2 w-2" />
                          </Button>
                        </div>
                      </div>

                      {expense.prix_vente_ttc && (
                        <div>
                          Prix vente TTC:{" "}
                          {(() => {
                            const optionsVenteTotal = (expense.selectedOptions || []).reduce(
                              (sum, opt) => sum + opt.prix_vente_ttc,
                              0,
                            );
                            return (expense.prix_vente_ttc + optionsVenteTotal).toFixed(2);
                          })()}{" "}
                          €
                        </div>
                      )}

                      {expense.date_achat && <div>Date: {new Date(expense.date_achat).toLocaleDateString()}</div>}

                      {expense.marge_pourcent !== undefined && (
                        <div>
                          Marge:{" "}
                          {(() => {
                            const optionsTotal = (expense.selectedOptions || []).reduce(
                              (sum, opt) => sum + opt.prix_reference,
                              0,
                            );
                            const totalAchat = expense.prix + optionsTotal;
                            const optionsVenteTotal = (expense.selectedOptions || []).reduce(
                              (sum, opt) => sum + opt.prix_vente_ttc,
                              0,
                            );
                            const totalVente = (expense.prix_vente_ttc || 0) + optionsVenteTotal;
                            const marge = totalAchat > 0 ? ((totalVente - totalAchat) / totalAchat) * 100 : 0;
                            return marge.toFixed(2);
                          })()}{" "}
                          %
                        </div>
                      )}

                      {expense.fournisseur && <div>Fournisseur: {expense.fournisseur}</div>}

                      {expense.selectedOptions && expense.selectedOptions.length > 0 && (
                        <div>
                          <span className="font-medium">Options:</span>
                          <ul className="ml-4 space-y-0.5">
                            {expense.selectedOptions.map((opt, idx) => (
                              <li key={idx}>• {opt.nom}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {expense.notes && <p className="text-xs text-muted-foreground italic">{expense.notes}</p>}
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total achat</p>
                      <p className="font-semibold text-lg">
                        {(() => {
                          const optionsTotal = (expense.selectedOptions || []).reduce(
                            (sum, opt) => sum + opt.prix_reference,
                            0,
                          );
                          return ((expense.prix + optionsTotal) * expense.quantite).toFixed(2);
                        })()}{" "}
                        €
                      </p>
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
                            <div
                              className={`h-8 w-8 border rounded-md flex items-center justify-center ${getPaymentStatus().color}`}
                            >
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
                </div>
              </Card>
            ))}

            {filteredExpenses.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">Aucune dépense dans cette catégorie</div>
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
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium">{expense.nom_accessoire}</h4>
                              {expense.marque && (
                                <Badge variant="secondary" className="text-xs">
                                  {expense.marque}
                                </Badge>
                              )}
                            </div>

                            <div className="space-y-0.5 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <span>Prix achat: {expense.prix.toFixed(2)} € × </span>
                                <div className="flex items-center gap-0.5">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-4 w-4"
                                    onClick={() => updateQuantity(expense.id, expense.quantite - 1)}
                                  >
                                    <Minus className="h-2 w-2" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={expense.quantite}
                                    onChange={(e) => updateQuantity(expense.id, parseInt(e.target.value) || 1)}
                                    className="h-5 w-10 text-center text-xs p-0"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-4 w-4"
                                    onClick={() => updateQuantity(expense.id, expense.quantite + 1)}
                                  >
                                    <Plus className="h-2 w-2" />
                                  </Button>
                                </div>
                              </div>

                              {expense.prix_vente_ttc && (
                                <div>
                                  Prix vente TTC:{" "}
                                  {(() => {
                                    const optionsVenteTotal = (expense.selectedOptions || []).reduce(
                                      (sum, opt) => sum + opt.prix_vente_ttc,
                                      0,
                                    );
                                    return (expense.prix_vente_ttc + optionsVenteTotal).toFixed(2);
                                  })()}{" "}
                                  €
                                </div>
                              )}

                              {expense.date_achat && (
                                <div>Date: {new Date(expense.date_achat).toLocaleDateString()}</div>
                              )}

                              {expense.marge_pourcent !== undefined && (
                                <div>
                                  Marge:{" "}
                                  {(() => {
                                    const optionsTotal = (expense.selectedOptions || []).reduce(
                                      (sum, opt) => sum + opt.prix_reference,
                                      0,
                                    );
                                    const totalAchat = expense.prix + optionsTotal;
                                    const optionsVenteTotal = (expense.selectedOptions || []).reduce(
                                      (sum, opt) => sum + opt.prix_vente_ttc,
                                      0,
                                    );
                                    const totalVente = (expense.prix_vente_ttc || 0) + optionsVenteTotal;
                                    const marge = totalAchat > 0 ? ((totalVente - totalAchat) / totalAchat) * 100 : 0;
                                    return marge.toFixed(2);
                                  })()}{" "}
                                  %
                                </div>
                              )}

                              {expense.fournisseur && <div>Fournisseur: {expense.fournisseur}</div>}

                              {expense.selectedOptions && expense.selectedOptions.length > 0 && (
                                <div>
                                  <span className="font-medium">Options:</span>
                                  <ul className="ml-4 space-y-0.5">
                                    {expense.selectedOptions.map((opt, idx) => (
                                      <li key={idx}>• {opt.nom}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            {expense.notes && <p className="text-xs text-muted-foreground italic">{expense.notes}</p>}
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="text-right space-y-1">
                              {/* Prix vente TTC en GRAND */}
                              {expense.prix_vente_ttc && (
                                <>
                                  <p className="text-xs text-muted-foreground">Prix vente TTC</p>
                                  <p className="font-bold text-2xl text-green-600">
                                    {(() => {
                                      const optionsVenteTotal = (expense.selectedOptions || []).reduce(
                                        (sum, opt) => sum + opt.prix_vente_ttc,
                                        0,
                                      );
                                      return ((expense.prix_vente_ttc + optionsVenteTotal) * expense.quantite).toFixed(
                                        2,
                                      );
                                    })()}{" "}
                                    €
                                  </p>
                                </>
                              )}

                              {/* Total achat en petit en dessous */}
                              <div className="pt-1 border-t border-dashed">
                                <p className="text-xs text-muted-foreground">Total achat HT</p>
                                <p className="font-medium text-sm text-gray-600">
                                  {(() => {
                                    const optionsTotal = (expense.selectedOptions || []).reduce(
                                      (sum, opt) => sum + opt.prix_reference,
                                      0,
                                    );
                                    return ((expense.prix + optionsTotal) * expense.quantite).toFixed(2);
                                  })()}{" "}
                                  €
                                </p>
                              </div>
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
                                    <div
                                      className={`h-8 w-8 border rounded-md flex items-center justify-center ${getPaymentStatus().color}`}
                                    >
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
