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
import { Edit, Plus, Euro, FileText, Trash2, ChevronDown, ChevronUp } from "lucide-react";
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

interface BankLine {
  id: string;
  type: "entree" | "sortie";
  date: string;
  description: string;
  project_name?: string;
  fournisseur?: string;
  montant: number;
  type_paiement?: string;
  statut_paiement?: string;
  facture_url?: string;
  todo_id?: string; // ID de la tâche associée
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
  projectId?: string;
  projectName?: string;
}

export const BilanComptable = ({ projectId, projectName }: BilanComptableProps) => {
  const [paymentRefresh, setPaymentRefresh] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [bankBalance, setBankBalance] = useState<BankBalance | null>(null);
  const [bankLines, setBankLines] = useState<BankLine[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isEditBalanceOpen, setIsEditBalanceOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBankBalanceExpanded, setIsBankBalanceExpanded] = useState(false);
  const [balanceForm, setBalanceForm] = useState({
    solde_depart: "",
    date_heure_depart: "",
  });

  useEffect(() => {
    loadBankBalance();
    loadBankLines();
    loadPayments();
    loadTotalSales();
  }, [projectId, paymentRefresh]);

  const loadBankBalance = async () => {
    if (!projectId) {
      // Mode global: pas de solde bancaire spécifique à un projet
      setBankBalance(null);
      return;
    }

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

  const loadBankLines = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Charger les dépenses (sorties)
    let expensesQuery = supabase
      .from("project_expenses")
      .select("*")
      .not("fournisseur", "is", null)
      .eq("user_id", user.id);

    // En mode projet: filtrer par projet spécifique
    // En mode global: charger toutes les dépenses
    if (projectId) {
      expensesQuery = expensesQuery.eq("project_id", projectId);
    }

    const { data: expensesData, error: expensesError } = await expensesQuery.order("date_achat", { ascending: false });

    if (expensesError) {
      console.error("Error loading expenses:", expensesError);
    }

    // Charger les paiements (entrées)
    let paymentsQuery = supabase
      .from("project_payment_transactions")
      .select(`
        *,
        projects!inner(nom, user_id)
      `)
      .eq("projects.user_id", user.id);

    // En mode projet: filtrer par projet spécifique
    if (projectId) {
      paymentsQuery = paymentsQuery.eq("project_id", projectId);
    }

    const { data: paymentsData, error: paymentsError } = await paymentsQuery.order("date_paiement", { ascending: false });

    if (paymentsError) {
      console.error("Error loading payments:", paymentsError);
    }

    // Combiner les deux en lignes bancaires
    const lines: BankLine[] = [];

    // Ajouter les sorties (dépenses)
    if (expensesData) {
      expensesData.forEach((expense: any) => {
        lines.push({
          id: expense.id,
          type: "sortie",
          date: expense.date_achat || "",
          description: expense.nom_accessoire,
          fournisseur: expense.fournisseur,
          montant: expense.prix * expense.quantite,
          statut_paiement: expense.statut_paiement,
          facture_url: expense.facture_url,
          todo_id: expense.todo_id,
        });
      });
    }

    // Ajouter les entrées (paiements)
    if (paymentsData) {
      paymentsData.forEach((payment: any) => {
        lines.push({
          id: payment.id,
          type: "entree",
          date: payment.date_paiement,
          description: payment.notes || "Paiement client",
          project_name: payment.projects?.nom,
          montant: payment.montant,
          type_paiement: payment.type_paiement,
        });
      });
    }

    // Trier par date décroissante
    lines.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setBankLines(lines);
  };

  const loadPayments = async () => {
    if (!projectId) {
      // Mode global: pas de paiements spécifiques à un projet
      setPayments([]);
      return;
    }

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
    if (!projectId) {
      toast.error("Fonction disponible uniquement dans un projet");
      return;
    }

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

  // Afficher toutes les lignes bancaires (pas de filtre par date)
  const filteredBankLines = bankLines;

  const now = new Date();

  // Calculer le solde actuel :
  // Solde de départ + Paiements déjà effectués - Dépenses déjà payées
  const paidPayments = bankBalance
    ? payments.filter((payment) => {
        const paymentDate = new Date(payment.date_paiement);
        return paymentDate >= new Date(bankBalance.date_heure_depart) && paymentDate <= now;
      })
    : [];

  const paidExpenses = filteredBankLines
    .filter(line => line.type === "sortie")
    .reduce((sum, line) => {
      // Déduire uniquement les dépenses déjà payées ET dont la date est après le solde de départ
      if (line.statut_paiement === "paye" && line.date && bankBalance) {
        const expenseDate = new Date(line.date);
        const balanceDate = new Date(bankBalance.date_heure_depart);
        if (expenseDate > balanceDate) {
          return sum + line.montant;
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
  const unpaidExpensesThisMonth = filteredBankLines
    .filter(line => line.type === "sortie")
    .filter((line) => {
      if (line.statut_paiement === "paye" || !line.date) return false;
      const paymentDate = new Date(line.date);
      return paymentDate >= monthStart && paymentDate <= monthEnd;
    });
  const totalUnpaidExpensesThisMonth = unpaidExpensesThisMonth.reduce((sum, line) => sum + line.montant, 0);

  const forecastEndOfMonth = currentBalance + totalExpectedPayments - totalUnpaidExpensesThisMonth;

  // Total des sorties d'argent pour affichage
  const totalExpenses = filteredBankLines
    .filter(line => line.type === "sortie")
    .reduce((sum, line) => sum + line.montant, 0);

  const deleteBankLine = async (line: BankLine) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette ligne bancaire ?")) return;

    const table = line.type === "entree" ? "project_payment_transactions" : "project_expenses";
    const { error } = await supabase.from(table).delete().eq("id", line.id);

    if (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
      return;
    }

    // Supprimer la tâche associée si elle existe
    if (line.todo_id) {
      await supabase.from("project_todos").delete().eq("id", line.todo_id);
    }

    toast.success("Ligne bancaire supprimée");
    loadBankLines();
    setPaymentRefresh((prev) => prev + 1);
  };

  const validatePayment = async (line: BankLine) => {
    if (line.type !== "sortie") return;

    const { error } = await supabase
      .from("project_expenses")
      .update({ statut_paiement: "paye" })
      .eq("id", line.id);

    if (error) {
      toast.error("Erreur lors de la validation");
      console.error(error);
      return;
    }

    // Supprimer la tâche associée
    if (line.todo_id) {
      await supabase.from("project_todos").delete().eq("id", line.todo_id);
    }

    toast.success("Paiement validé");
    loadBankLines();
    setPaymentRefresh((prev) => prev + 1);
  };

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
      <ExpenseTableForm
        projectId={projectId}
        onSuccess={() => {
          loadBankLines();
          setPaymentRefresh((prev) => prev + 1);
        }}
      />

      {/* Sorties à payer */}
      <Card>
        <CardHeader>
          <CardTitle>Sorties à payer</CardTitle>
          <CardDescription>
            Dépenses non payées en attente de validation manuelle
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredBankLines.filter(line => line.type === "sortie" && line.statut_paiement !== "paye").length > 0 ? (
              <div className="space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="text-left py-2 px-2">Description</th>
                        <th className="text-left py-2 px-2">Fournisseur</th>
                        <th className="text-right py-2 px-2">Montant</th>
                        <th className="text-right py-2 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBankLines
                        .filter(line => line.type === "sortie" && line.statut_paiement !== "paye")
                        .map((line) => (
                          <tr key={line.id} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-2">{format(new Date(line.date), "dd/MM/yyyy")}</td>
                            <td className="py-2 px-2">{line.description}</td>
                            <td className="py-2 px-2">{line.fournisseur}</td>
                            <td className="py-2 px-2 text-right font-semibold text-destructive">
                              -{line.montant.toFixed(2)} €
                            </td>
                            <td className="py-2 px-2 text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => validatePayment(line)}
                                  className="h-7"
                                >
                                  ✓ Valider
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteBankLine(line)}
                                  className="h-7"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune sortie en attente de paiement
              </p>
          )}
        </CardContent>
      </Card>

      {/* Lignes bancaires */}
      <Card>
        <CardHeader>
          <CardTitle>Lignes bancaires</CardTitle>
          <CardDescription>
            Toutes les entrées et sorties d'argent (seules les sorties validées sont déduites du solde)
          </CardDescription>
        </CardHeader>
        <CardContent>
            {filteredBankLines.length > 0 ? (
              <div className="space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Type</th>
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="text-left py-2 px-2">Description</th>
                        <th className="text-left py-2 px-2">Projet / Fournisseur</th>
                        <th className="text-left py-2 px-2">Type</th>
                        <th className="text-right py-2 px-2">Montant</th>
                        <th className="text-center py-2 px-2">Facture</th>
                        <th className="text-center py-2 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBankLines.map((line) => (
                        <tr 
                          key={`${line.type}-${line.id}`} 
                          className={`border-b hover:bg-muted/50 ${line.type === "entree" ? "bg-green-50 dark:bg-green-950/20" : ""}`}
                        >
                          <td className="py-2 px-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              line.type === "entree" 
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            }`}>
                              {line.type === "entree" ? "💰 Entrée" : "📤 Sortie"}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            {line.date ? format(new Date(line.date), "dd/MM/yyyy HH:mm") : "-"}
                          </td>
                          <td className="py-2 px-2 font-medium">{line.description}</td>
                          <td className="py-2 px-2 text-muted-foreground">
                            {line.type === "entree" ? line.project_name : line.fournisseur || "-"}
                          </td>
                          <td className="py-2 px-2">
                            {line.type === "entree" ? (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                line.type_paiement === "solde"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              }`}>
                                {line.type_paiement === "solde" ? "Solde" : "Acompte"}
                              </span>
                            ) : line.statut_paiement ? (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                line.statut_paiement === "paye"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              }`}>
                                {line.statut_paiement === "paye" ? "Payé" : "Non payé"}
                              </span>
                            ) : "-"}
                          </td>
                          <td className={`py-2 px-2 text-right font-medium ${
                            line.type === "entree" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          }`}>
                            {line.type === "entree" ? "+" : "-"}{line.montant.toFixed(2)} €
                          </td>
                          <td className="py-2 px-2 text-center">
                            {line.facture_url ? (
                              <a
                                href={line.facture_url}
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
                              className="h-8 w-8 text-destructive hover:text-destructive/80"
                              onClick={() => deleteBankLine(line)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold border-t-2">
                        <td colSpan={5} className="py-3 px-2 text-right">
                          Total sorties :
                        </td>
                        <td className="py-3 px-2 text-right text-destructive">-{totalExpenses.toFixed(2)} €</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-center py-4 text-muted-foreground">Aucune ligne bancaire enregistrée</p>
            )}
          </CardContent>
        </Card>

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
    </div>
  );
};
