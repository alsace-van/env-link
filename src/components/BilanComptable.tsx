import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit, Plus, Euro, FileText, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import ExpenseTableForm from "@/components/ExpenseTableForm";
import { FinancialSidebar } from "@/components/FinancialSidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BankBalance {
  id: string;
  solde_depart: number;
  date_heure_depart: string;
}

interface Expense {
  id: string;
  nom_accessoire: string;
  fournisseur?: string;
  prix: number;
  quantite: number;
  date_achat?: string;
  date_paiement?: string;
  delai_paiement?: string;
  statut_paiement: string;
  facture_url?: string;
}

interface Payment {
  id: string;
  type_paiement?: string;
  mode_paiement?: string;
  montant: number;
  date_paiement: string;
  notes?: string;
}

interface BilanComptableProps {
  projectId: string;
  projectName: string;
}

export const BilanComptable = ({ projectId, projectName }: BilanComptableProps) => {
  const [paymentRefresh, setPaymentRefresh] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [bankBalance, setBankBalance] = useState<BankBalance | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isEditBalanceOpen, setIsEditBalanceOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBankBalanceExpanded, setIsBankBalanceExpanded] = useState(false);
  const [balanceForm, setBalanceForm] = useState({
    solde_depart: "",
    date_heure_depart: "",
  });
  const [isEditExpenseOpen, setIsEditExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    nom_accessoire: "",
    fournisseur: "",
    prix: "",
    quantite: "1",
    date_achat: "",
    date_paiement: "",
    delai_paiement: "commande",
    statut_paiement: "non_paye",
  });

  useEffect(() => {
    loadBankBalance();
    loadExpenses();
    loadPayments();
    loadTotalSales();
  }, [projectId, paymentRefresh]);

  const loadBankBalance = async () => {
    const { data, error } = await supabase
      .from("project_bank_balance")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) {
      console.error("Error loading bank balance:", error);
      return;
    }

    setBankBalance(data);
  };

  const loadExpenses = async () => {
    // Charger uniquement les dépenses fournisseurs globales (pas liées à un projet)
    const { data, error } = await supabase
      .from("project_expenses")
      .select("*")
      .is("project_id", null)
      .not("fournisseur", "is", null)
      .order("date_achat", { ascending: false });

    if (error) {
      console.error("Error loading expenses:", error);
      return;
    }

    setExpenses(data || []);
  };

  const loadPayments = async () => {
    const { data, error } = await supabase
      .from("project_payment_transactions")
      .select("*")
      .eq("project_id", projectId)
      .order("date_paiement", { ascending: false });

    if (error) {
      console.error("Error loading payments:", error);
      return;
    }

    setPayments(data || []);
  };

  const loadTotalSales = async () => {
    // Récupérer tous les projets de l'utilisateur
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: projectsData, error: projectsError } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", userData.user.id);

    if (projectsError) {
      console.error("Error loading projects:", projectsError);
      return;
    }

    const projectIds = (projectsData || []).map((p) => p.id);

    // Charger les dépenses de TOUS les projets avec leurs prix de vente TTC
    const { data, error } = await supabase
      .from("project_expenses")
      .select("id, prix_vente_ttc, quantite")
      .in("project_id", projectIds);

    if (error) {
      console.error("Error loading total sales:", error);
      return;
    }

    // Calculer le total des accessoires principaux
    let total = (data || []).reduce((sum, item) => {
      return sum + (item.prix_vente_ttc || 0) * item.quantite;
    }, 0);

    // Ajouter le prix des options sélectionnées pour chaque dépense
    for (const expense of data || []) {
      const { data: selectedOptions } = await supabase
        .from("expense_selected_options")
        .select(
          `
          accessory_options!inner(
            prix_vente_ttc
          )
        `,
        )
        .eq("expense_id", expense.id);

      if (selectedOptions && selectedOptions.length > 0) {
        const optionsTotal = selectedOptions.reduce((sum, opt: any) => {
          return sum + (opt.accessory_options?.prix_vente_ttc || 0);
        }, 0);
        total += optionsTotal * expense.quantite;
      }
    }

    setTotalSales(total);
  };

  const handleSaveBalance = async () => {
    if (!balanceForm.solde_depart || !balanceForm.date_heure_depart) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    const balanceData = {
      project_id: projectId,
      solde_depart: parseFloat(balanceForm.solde_depart),
      date_heure_depart: balanceForm.date_heure_depart,
    };

    if (bankBalance) {
      const { error } = await supabase.from("project_bank_balance").update(balanceData).eq("id", bankBalance.id);

      if (error) {
        toast.error("Erreur lors de la mise à jour");
        console.error(error);
        return;
      }
    } else {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const balanceDataWithUser = { ...balanceData, user_id: userData.user.id };
      const { error } = await supabase.from("project_bank_balance").insert([balanceDataWithUser]);

      if (error) {
        toast.error("Erreur lors de la création");
        console.error(error);
        return;
      }
    }

    toast.success("Solde bancaire enregistré");
    setIsEditBalanceOpen(false);
    loadBankBalance();
  };

  const openEditBalance = () => {
    setBalanceForm({
      solde_depart: bankBalance?.solde_depart.toString() || "",
      date_heure_depart: bankBalance
        ? format(new Date(bankBalance.date_heure_depart), "yyyy-MM-dd'T'HH:mm")
        : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    });
    setIsEditBalanceOpen(true);
  };

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense);

    // Format dates for datetime-local inputs
    const formatDateForInput = (dateStr: string | undefined) => {
      if (!dateStr) return "";
      const date = new Date(dateStr);
      return date.toISOString().slice(0, 16);
    };

    setExpenseForm({
      nom_accessoire: expense.nom_accessoire,
      fournisseur: expense.fournisseur || "",
      prix: expense.prix.toString(),
      quantite: expense.quantite.toString(),
      date_achat: formatDateForInput(expense.date_achat),
      date_paiement: formatDateForInput(expense.date_paiement),
      delai_paiement: expense.delai_paiement || "commande",
      statut_paiement: expense.statut_paiement,
    });
    setIsEditExpenseOpen(true);
  };

  const handleSaveExpense = async () => {
    if (!editingExpense) return;

    if (!expenseForm.nom_accessoire.trim() || !expenseForm.fournisseur.trim() || !expenseForm.prix) {
      toast.error("Veuillez remplir tous les champs requis");
      return;
    }

    const { error } = await supabase
      .from("project_expenses")
      .update({
        nom_accessoire: expenseForm.nom_accessoire,
        fournisseur: expenseForm.fournisseur,
        prix: parseFloat(expenseForm.prix),
        quantite: parseInt(expenseForm.quantite),
        date_achat: expenseForm.date_achat || null,
        date_paiement: expenseForm.date_paiement || null,
        delai_paiement: expenseForm.delai_paiement,
        statut_paiement: expenseForm.statut_paiement,
      })
      .eq("id", editingExpense.id);

    if (error) {
      toast.error("Erreur lors de la modification");
      console.error(error);
      return;
    }

    toast.success("Dépense modifiée avec succès");
    setIsEditExpenseOpen(false);
    loadExpenses();
  };

  // Afficher toutes les dépenses fournisseurs (pas de filtre par date)
  const filteredExpenses = expenses;

  const now = new Date();

  // Calculer le solde actuel :
  // Solde de départ + Paiements déjà effectués - Dépenses déjà payées
  const paidPayments = bankBalance
    ? payments.filter((payment) => {
        const paymentDate = new Date(payment.date_paiement);
        return paymentDate >= new Date(bankBalance.date_heure_depart) && paymentDate <= now;
      })
    : [];

  const paidExpenses = filteredExpenses.reduce((sum, exp) => {
    // Déduire uniquement les dépenses déjà payées ET dont la date d'achat est après le solde de départ
    if (exp.statut_paiement === "paye" && exp.date_achat && bankBalance) {
      const expenseDate = new Date(exp.date_achat);
      const balanceDate = new Date(bankBalance.date_heure_depart);
      if (expenseDate > balanceDate) {
        return sum + exp.prix * exp.quantite;
      }
    }
    return sum;
  }, 0);

  const totalPaidPayments = paidPayments.reduce((sum, pay) => sum + pay.montant, 0);
  const currentBalance = bankBalance ? bankBalance.solde_depart + totalPaidPayments - paidExpenses : 0;

  // Calculer le prévisionnel fin de mois
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Paiements à venir ce mois (date future uniquement)
  const expectedPaymentsThisMonth = payments.filter((payment) => {
    const paymentDate = new Date(payment.date_paiement);
    return paymentDate > now && paymentDate >= monthStart && paymentDate <= monthEnd;
  });
  const totalExpectedPayments = expectedPaymentsThisMonth.reduce((sum, pay) => sum + pay.montant, 0);

  // Dépenses non payées dont la date limite est ce mois
  const unpaidExpensesThisMonth = filteredExpenses.filter((exp) => {
    if (exp.statut_paiement === "paye" || !exp.date_paiement) return false;
    const paymentDate = new Date(exp.date_paiement);
    return paymentDate >= monthStart && paymentDate <= monthEnd;
  });
  const totalUnpaidExpensesThisMonth = unpaidExpensesThisMonth.reduce((sum, exp) => sum + exp.prix * exp.quantite, 0);

  const forecastEndOfMonth = currentBalance + totalExpectedPayments - totalUnpaidExpensesThisMonth;

  // Total des dépenses pour affichage dans le tableau
  const totalExpenses = filteredExpenses.reduce((sum, exp) => {
    return sum + exp.prix * exp.quantite;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Bouton flottant Gestion Financière */}
      <Button
        onClick={() => setIsSidebarOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        title="Gestion Financière"
      >
        <Euro className="h-6 w-6" />
      </Button>

      {/* Solde bancaire */}
      <Card className="py-3">
        <CardContent className="space-y-2 px-4 py-0">
          {bankBalance ? (
            <>
              {/* En-tête et bouton */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Solde Bancaire</h3>
                <div className="flex items-center gap-1">
                  <Button
                    onClick={() => setIsBankBalanceExpanded(!isBankBalanceExpanded)}
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                  >
                    {isBankBalanceExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Réduire
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Détails
                      </>
                    )}
                  </Button>
                  <Button onClick={openEditBalance} variant="ghost" size="sm" className="h-7 text-xs">
                    <Edit className="h-3 w-3 mr-1" />
                    Modifier
                  </Button>
                </div>
              </div>

              {/* Ligne compacte : Soldes principaux (toujours visible) */}
              <div className="grid grid-cols-3 gap-4 py-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Solde de départ</p>
                  <p className="text-lg font-bold text-primary">{bankBalance.solde_depart.toFixed(2)} €</p>
                  <p className="text-[9px] text-muted-foreground">
                    Au {format(new Date(bankBalance.date_heure_depart), "dd/MM/yyyy à HH:mm")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Solde actuel</p>
                  <p className={`text-lg font-bold ${currentBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {currentBalance.toFixed(2)} €
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Variation</p>
                  <p
                    className={`text-lg font-bold ${currentBalance - bankBalance.solde_depart >= 0 ? "text-green-600" : "text-destructive"}`}
                  >
                    {currentBalance - bankBalance.solde_depart >= 0 ? "+" : ""}
                    {(currentBalance - bankBalance.solde_depart).toFixed(2)} €
                  </p>
                </div>
              </div>

              {/* Section dépliable : Prévisionnel */}
              {isBankBalanceExpanded && (
                <div className="border-t pt-2 mt-2">
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-4 text-[10px]">
                      <span className="text-muted-foreground font-medium">
                        Prévisionnel fin de mois ({format(monthEnd, "dd/MM/yyyy")}):
                      </span>
                      <span className="text-muted-foreground">Paiements à venir</span>
                      <span className="font-semibold text-green-600">+{totalExpectedPayments.toFixed(2)} €</span>
                      <span className="text-muted-foreground">Dépenses à payer</span>
                      <span className="font-semibold text-destructive">
                        -{totalUnpaidExpensesThisMonth.toFixed(2)} €
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Solde prévisionnel</p>
                      <p
                        className={`text-base font-bold ${forecastEndOfMonth >= 0 ? "text-green-600" : "text-destructive"}`}
                      >
                        {forecastEndOfMonth.toFixed(2)} €
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between py-2">
              <div>
                <h3 className="text-sm font-semibold mb-1">Solde Bancaire</h3>
                <p className="text-xs text-muted-foreground">Aucun solde défini</p>
              </div>
              <Button onClick={openEditBalance} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Définir
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulaire d'ajout rapide */}
      {bankBalance && (
        <ExpenseTableForm
          projectId={projectId}
          onSuccess={() => {
            loadExpenses();
            setPaymentRefresh((prev) => prev + 1);
          }}
        />
      )}

      {/* Dépenses après la date de départ */}
      {bankBalance && (
        <Card>
          <CardHeader>
            <CardTitle>Dépenses Fournisseurs</CardTitle>
            <CardDescription>
              Toutes les dépenses fournisseurs (seules les dépenses payées sont déduites du solde actuel)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredExpenses.length > 0 ? (
              <div className="space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Date et Heure</th>
                        <th className="text-left py-2 px-2">Article</th>
                        <th className="text-left py-2 px-2">Fournisseur</th>
                        <th className="text-right py-2 px-2">Quantité</th>
                        <th className="text-right py-2 px-2">Prix Unit.</th>
                        <th className="text-right py-2 px-2">Total</th>
                        <th className="text-center py-2 px-2">Statut</th>
                        <th className="text-center py-2 px-2">Facture</th>
                        <th className="text-center py-2 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2">
                            {expense.date_achat ? format(new Date(expense.date_achat), "dd/MM/yyyy HH:mm") : "-"}
                          </td>
                          <td className="py-2 px-2 font-medium">{expense.nom_accessoire}</td>
                          <td className="py-2 px-2 text-muted-foreground">{expense.fournisseur || "-"}</td>
                          <td className="py-2 px-2 text-right">{expense.quantite}</td>
                          <td className="py-2 px-2 text-right">{expense.prix.toFixed(2)} €</td>
                          <td className="py-2 px-2 text-right font-medium">
                            {(expense.prix * expense.quantite).toFixed(2)} €
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                expense.statut_paiement === "paye"
                                  ? "bg-green-100 text-green-800"
                                  : expense.statut_paiement === "acompte"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {expense.statut_paiement === "paye"
                                ? "Payé"
                                : expense.statut_paiement === "acompte"
                                  ? "Acompte"
                                  : "Non payé"}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            {expense.facture_url ? (
                              <a
                                href={expense.facture_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-primary hover:text-primary/80"
                              >
                                <FileText className="h-4 w-4" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditExpense(expense)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold border-t-2">
                        <td colSpan={6} className="py-3 px-2 text-right">
                          Total des dépenses :
                        </td>
                        <td className="py-3 px-2 text-right text-destructive">-{totalExpenses.toFixed(2)} €</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-center py-4 text-muted-foreground">Aucune dépense enregistrée</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Financial Sidebar */}
      <FinancialSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        projectId={projectId}
        projectName={projectName}
        totalSales={totalSales}
        onPaymentChange={() => {
          setPaymentRefresh((prev) => prev + 1);
          loadPayments();
          loadBankBalance();
        }}
      />

      {/* Dialog pour modifier le solde */}
      <Dialog open={isEditBalanceOpen} onOpenChange={setIsEditBalanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bankBalance ? "Modifier le solde bancaire" : "Définir le solde bancaire"}</DialogTitle>
            <DialogDescription>Définissez le solde bancaire de départ et la date de référence</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="solde_depart">Solde de départ (€)</Label>
              <Input
                id="solde_depart"
                type="number"
                step="0.01"
                value={balanceForm.solde_depart}
                onChange={(e) => setBalanceForm({ ...balanceForm, solde_depart: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_heure_depart">Date et heure de référence</Label>
              <Input
                id="date_heure_depart"
                type="datetime-local"
                value={balanceForm.date_heure_depart}
                onChange={(e) => setBalanceForm({ ...balanceForm, date_heure_depart: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditBalanceOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveBalance}>Enregistrer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog pour modifier une dépense */}
      <Dialog open={isEditExpenseOpen} onOpenChange={setIsEditExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la dépense</DialogTitle>
            <DialogDescription>Modifiez les informations de cette dépense fournisseur</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_nom">Nom de la dépense</Label>
              <Input
                id="edit_nom"
                value={expenseForm.nom_accessoire}
                onChange={(e) => setExpenseForm({ ...expenseForm, nom_accessoire: e.target.value })}
                placeholder="Nom de l'article"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_fournisseur">Fournisseur</Label>
              <Input
                id="edit_fournisseur"
                value={expenseForm.fournisseur}
                onChange={(e) => setExpenseForm({ ...expenseForm, fournisseur: e.target.value })}
                placeholder="Fournisseur"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_prix">Prix unitaire (€)</Label>
                <Input
                  id="edit_prix"
                  type="number"
                  step="0.01"
                  value={expenseForm.prix}
                  onChange={(e) => setExpenseForm({ ...expenseForm, prix: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_quantite">Quantité</Label>
                <Input
                  id="edit_quantite"
                  type="number"
                  value={expenseForm.quantite}
                  onChange={(e) => setExpenseForm({ ...expenseForm, quantite: e.target.value })}
                  placeholder="1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_date_achat">Date et heure d'achat</Label>
                <Input
                  id="edit_date_achat"
                  type="datetime-local"
                  value={expenseForm.date_achat}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date_achat: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_date_paiement">Date et heure limite de paiement</Label>
                <Input
                  id="edit_date_paiement"
                  type="datetime-local"
                  value={expenseForm.date_paiement}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date_paiement: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_delai">Délai de paiement</Label>
                <Select
                  value={expenseForm.delai_paiement}
                  onValueChange={(value) => setExpenseForm({ ...expenseForm, delai_paiement: value })}
                >
                  <SelectTrigger id="edit_delai">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commande">À la commande</SelectItem>
                    <SelectItem value="30_jours">Sous 30 jours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_statut">Statut de paiement</Label>
                <Select
                  value={expenseForm.statut_paiement}
                  onValueChange={(value) => setExpenseForm({ ...expenseForm, statut_paiement: value })}
                >
                  <SelectTrigger id="edit_statut">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="non_paye">Non payé</SelectItem>
                    <SelectItem value="paye">Payé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditExpenseOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveExpense}>Enregistrer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
