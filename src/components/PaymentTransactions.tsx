import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

interface PaymentTransaction {
  id: string;
  type_paiement: "acompte" | "solde";
  montant: number;
  date_paiement: string;
  notes?: string;
}

interface PaymentTransactionsProps {
  projectId: string;
  totalSales: number;
  onPaymentChange: () => void;
}

const PaymentTransactions = ({ projectId, totalSales, onPaymentChange }: PaymentTransactionsProps) => {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTransaction, setNewTransaction] = useState({
    type_paiement: "acompte" as "acompte" | "solde",
    montant: 0,
    date_paiement: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    loadTransactions();
  }, [projectId]);

  const loadTransactions = async () => {
    const { data, error } = await supabase
      .from("project_payment_transactions")
      .select("*")
      .eq("project_id", projectId)
      .order("date_paiement", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setTransactions((data || []) as PaymentTransaction[]);
    }
  };

  const addOrUpdateTransaction = async () => {
    if (newTransaction.montant <= 0) {
      toast.error("Le montant doit être supérieur à 0");
      return;
    }

    const transactionData = {
      project_id: projectId,
      type_paiement: newTransaction.type_paiement,
      montant: newTransaction.montant,
      date_paiement: newTransaction.date_paiement,
      notes: newTransaction.notes || null,
    };

    if (editingId) {
      // Update existing transaction
      const { error } = await supabase
        .from("project_payment_transactions")
        .update(transactionData)
        .eq("id", editingId);

      if (error) {
        toast.error("Erreur lors de la modification du paiement");
        console.error(error);
      } else {
        toast.success("Paiement modifié");
        setEditingId(null);
        setIsAdding(false);
        setNewTransaction({
          type_paiement: "acompte",
          montant: 0,
          date_paiement: new Date().toISOString().split("T")[0],
          notes: "",
        });
        loadTransactions();
        onPaymentChange();
      }
    } else {
      // Insert new transaction
      const { error } = await supabase
        .from("project_payment_transactions")
        .insert([transactionData]);

      if (error) {
        toast.error("Erreur lors de l'ajout du paiement");
        console.error(error);
      } else {
        toast.success("Paiement ajouté");
        setIsAdding(false);
        setNewTransaction({
          type_paiement: "acompte",
          montant: 0,
          date_paiement: new Date().toISOString().split("T")[0],
          notes: "",
        });
        loadTransactions();
        onPaymentChange();
      }
    }
  };

  const editTransaction = (transaction: PaymentTransaction) => {
    setEditingId(transaction.id);
    setNewTransaction({
      type_paiement: transaction.type_paiement,
      montant: transaction.montant,
      date_paiement: transaction.date_paiement,
      notes: transaction.notes || "",
    });
    setIsAdding(true);
  };

  const deleteTransaction = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce paiement ?")) {
      return;
    }

    const { error } = await supabase
      .from("project_payment_transactions")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    } else {
      toast.success("Paiement supprimé");
      loadTransactions();
      onPaymentChange();
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setNewTransaction({
      type_paiement: "acompte",
      montant: 0,
      date_paiement: new Date().toISOString().split("T")[0],
      notes: "",
    });
  };

  const totalPaid = transactions.reduce((sum, t) => sum + t.montant, 0);
  const remaining = totalSales - totalPaid;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des paiements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm border-b pb-4">
          <div className="flex justify-between">
            <span>Total ventes TTC:</span>
            <span className="font-semibold">{totalSales.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between">
            <span>Total payé:</span>
            <span className="font-semibold text-green-600">{totalPaid.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-2 border-t">
            <span>Reste à payer:</span>
            <span className={remaining <= 0 ? "text-green-600" : "text-primary"}>
              {remaining.toFixed(2)} €
            </span>
          </div>
        </div>

        {transactions.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="text-xs">
                    {new Date(transaction.date_paiement).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className={transaction.type_paiement === "acompte" ? "text-orange-600" : "text-blue-600"}>
                      {transaction.type_paiement === "acompte" ? "Acompte" : "Solde"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-semibold">
                    {transaction.montant.toFixed(2)} €
                  </TableCell>
                  <TableCell className="text-xs">{transaction.notes || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => editTransaction(transaction)}
                        className="h-6 w-6"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTransaction(transaction.id)}
                        className="h-6 w-6"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!isAdding ? (
          <Button onClick={() => setIsAdding(true)} className="w-full" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un paiement
          </Button>
        ) : (
          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-sm">
              {editingId ? "Modifier le paiement" : "Ajouter un paiement"}
            </h4>
            <div className="space-y-2">
              <Label>Type de paiement</Label>
              <Select
                value={newTransaction.type_paiement}
                onValueChange={(value: "acompte" | "solde") => {
                  setNewTransaction({ 
                    ...newTransaction, 
                    type_paiement: value,
                    montant: value === "solde" ? remaining : newTransaction.montant
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="acompte">Acompte</SelectItem>
                  <SelectItem value="solde">Solde</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Montant (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={newTransaction.montant}
                onChange={(e) =>
                  setNewTransaction({ ...newTransaction, montant: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Date de paiement</Label>
              <Input
                type="date"
                value={newTransaction.date_paiement}
                onChange={(e) =>
                  setNewTransaction({ ...newTransaction, date_paiement: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={newTransaction.notes}
                onChange={(e) =>
                  setNewTransaction({ ...newTransaction, notes: e.target.value })
                }
                placeholder="Notes sur ce paiement..."
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={addOrUpdateTransaction} className="flex-1">
                {editingId ? "Modifier" : "Enregistrer"}
              </Button>
              <Button
                onClick={cancelEdit}
                variant="outline"
                className="flex-1"
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaymentTransactions;
