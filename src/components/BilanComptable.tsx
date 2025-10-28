import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit, Plus, Trash2, Euro, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import PaymentTransactions from "@/components/PaymentTransactions";
import { MonthlyCharges } from "@/components/MonthlyCharges";
import { InstallmentPayments } from "@/components/InstallmentPayments";
import ExpenseTableForm from "@/components/ExpenseTableForm";

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
  statut_paiement: string;
  facture_url?: string;
}

interface Payment {
  id: string;
  type_paiement: string;
  montant: number;
  date_paiement: string;
  notes?: string;
}

interface BilanComptableProps {
  projectId: string;
}

export const BilanComptable = ({ projectId }: BilanComptableProps) => {
  const [paymentRefresh, setPaymentRefresh] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [bankBalance, setBankBalance] = useState<BankBalance | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isEditBalanceOpen, setIsEditBalanceOpen] = useState(false);
  const [balanceForm, setBalanceForm] = useState({
    solde_depart: "",
    date_heure_depart: "",
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
    // Charger toutes les dépenses fournisseurs (project_id null et avec fournisseur)
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
    const { data, error } = await supabase
      .from("project_expenses")
      .select("prix_vente_ttc, quantite")
      .eq("project_id", projectId);

    if (error) {
      console.error("Error loading total sales:", error);
      return;
    }

    const total = (data || []).reduce((sum, item) => {
      return sum + (item.prix_vente_ttc || 0) * item.quantite;
    }, 0);

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
      const { error } = await supabase
        .from("project_bank_balance")
        .update(balanceData)
        .eq("id", bankBalance.id);

      if (error) {
        toast.error("Erreur lors de la mise à jour");
        console.error(error);
        return;
      }
    } else {
      const { error } = await supabase
        .from("project_bank_balance")
        .insert([balanceData]);

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

  // Afficher toutes les dépenses fournisseurs (pas de filtre par date)
  const filteredExpenses = expenses;

  const filteredPayments = bankBalance
    ? payments.filter((payment) => {
        return new Date(payment.date_paiement) >= new Date(bankBalance.date_heure_depart);
      })
    : [];

  // Calculer le solde actuel : déduire uniquement les dépenses NON PAYÉES
  const totalExpenses = filteredExpenses.reduce((sum, exp) => {
    // Déduire seulement si non payé
    if (exp.statut_paiement === "non_paye") {
      return sum + exp.prix * exp.quantite;
    }
    return sum;
  }, 0);
  const totalPayments = filteredPayments.reduce((sum, pay) => sum + pay.montant, 0);
  const currentBalance = bankBalance
    ? bankBalance.solde_depart - totalExpenses + totalPayments
    : 0;

  return (
    <div className="space-y-6">
      {/* Solde bancaire */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Solde Bancaire</CardTitle>
            <Button onClick={openEditBalance} variant="outline" size="sm">
              {bankBalance ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {bankBalance ? "Modifier" : "Définir le solde"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bankBalance ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Solde de départ</p>
                <p className="text-2xl font-bold text-primary">
                  {bankBalance.solde_depart.toFixed(2)} €
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Au {format(new Date(bankBalance.date_heure_depart), "dd/MM/yyyy à HH:mm")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Solde actuel</p>
                <p className={`text-2xl font-bold ${currentBalance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {currentBalance.toFixed(2)} €
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Variation</p>
                <p className={`text-2xl font-bold ${(currentBalance - bankBalance.solde_depart) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {(currentBalance - bankBalance.solde_depart >= 0 ? '+' : '')}
                  {(currentBalance - bankBalance.solde_depart).toFixed(2)} €
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Aucun solde bancaire défini</p>
              <p className="text-sm mt-2">Cliquez sur "Définir le solde" pour commencer</p>
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
            setPaymentRefresh(prev => prev + 1);
          }}
        />
      )}

      {/* Dépenses après la date de départ */}
      {bankBalance && (
        <Card>
          <CardHeader>
            <CardTitle>Dépenses Fournisseurs</CardTitle>
            <CardDescription>
              Toutes les dépenses fournisseurs (seules les non payées sont déduites du solde)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredExpenses.length > 0 ? (
              <div className="space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="text-left py-2 px-2">Article</th>
                        <th className="text-left py-2 px-2">Fournisseur</th>
                        <th className="text-right py-2 px-2">Quantité</th>
                        <th className="text-right py-2 px-2">Prix Unit.</th>
                        <th className="text-right py-2 px-2">Total</th>
                        <th className="text-center py-2 px-2">Statut</th>
                        <th className="text-center py-2 px-2">Facture</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2">
                            {expense.date_achat
                              ? format(new Date(expense.date_achat), "dd/MM/yyyy")
                              : "-"}
                          </td>
                          <td className="py-2 px-2 font-medium">{expense.nom_accessoire}</td>
                          <td className="py-2 px-2 text-muted-foreground">
                            {expense.fournisseur || "-"}
                          </td>
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
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold border-t-2">
                        <td colSpan={6} className="py-3 px-2 text-right">
                          Total des dépenses :
                        </td>
                        <td className="py-3 px-2 text-right text-destructive">
                          -{totalExpenses.toFixed(2)} €
                        </td>
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

      {/* Gestion des paiements */}
      <PaymentTransactions 
        projectId={projectId} 
        totalSales={totalSales}
        onPaymentChange={() => {
          setPaymentRefresh(prev => prev + 1);
          loadPayments();
          loadBankBalance();
        }}
      />

      {/* Charges mensuelles */}
      <MonthlyCharges projectId={projectId} />

      {/* Paiements échelonnés */}
      <InstallmentPayments projectId={projectId} />

      {/* Dialog pour modifier le solde */}
      <Dialog open={isEditBalanceOpen} onOpenChange={setIsEditBalanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bankBalance ? "Modifier le solde bancaire" : "Définir le solde bancaire"}
            </DialogTitle>
            <DialogDescription>
              Définissez le solde bancaire de départ et la date de référence
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="solde_depart">Solde de départ (€)</Label>
              <Input
                id="solde_depart"
                type="number"
                step="0.01"
                value={balanceForm.solde_depart}
                onChange={(e) =>
                  setBalanceForm({ ...balanceForm, solde_depart: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_heure_depart">Date et heure de référence</Label>
              <Input
                id="date_heure_depart"
                type="datetime-local"
                value={balanceForm.date_heure_depart}
                onChange={(e) =>
                  setBalanceForm({ ...balanceForm, date_heure_depart: e.target.value })
                }
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
