import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PaymentTransaction {
  id: string;
  type_paiement: "acompte" | "solde";
  montant: number;
  date_paiement: string;
  notes?: string;
  project_id: string;
  project_name?: string;
}

interface PaymentTransactionsProps {
  totalSales: number;
  onPaymentChange: () => void;
  currentProjectId: string;
}

const PaymentTransactions = ({ totalSales, onPaymentChange, currentProjectId }: PaymentTransactionsProps) => {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    type_paiement: "acompte" as "acompte" | "solde",
    montant: 0,
    date_paiement: new Date().toISOString().split("T")[0],
    notes: "",
    project_id: currentProjectId,
  });

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    // Charger tous les paiements de l'utilisateur
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Récupérer les projets de l'utilisateur
    const { data: projectsData, error: projectsError } = await supabase
      .from("projects")
      .select("id, nom_projet, nom_proprietaire")
      .eq("user_id", userData.user.id);

    if (projectsError) {
      console.error("Error loading projects:", projectsError);
      return;
    }

    const projectsMap = new Map(
      (projectsData || []).map((p) => [
        p.id,
        p.nom_projet || p.nom_proprietaire || "Projet sans nom",
      ])
    );

    // Récupérer tous les paiements des projets de l'utilisateur
    const projectIds = Array.from(projectsMap.keys());
    
    const { data, error } = await supabase
      .from("project_payment_transactions")
      .select("*")
      .in("project_id", projectIds)
      .order("date_paiement", { ascending: false });

    if (error) {
      console.error("Error loading payments:", error);
    } else {
      const transactionsWithNames = (data || []).map((t: any) => ({
        ...t,
        project_name: projectsMap.get(t.project_id) || "Projet sans nom",
      }));
      setTransactions(transactionsWithNames as PaymentTransaction[]);
    }
  };

  const addOrUpdateTransaction = async () => {
    if (newTransaction.montant <= 0) {
      toast.error("Le montant doit être supérieur à 0");
      return;
    }

    // Calculer le total des paiements pour ce projet (en excluant celui en cours d'édition)
    const paymentsForProject = transactions.filter(
      (t) => t.project_id === newTransaction.project_id && t.id !== editingId
    );
    const totalPaidForProject = paymentsForProject.reduce((sum, t) => sum + t.montant, 0);
    
    // Vérifier que le nouveau total ne dépasse pas le montant des ventes TTC
    if (totalPaidForProject + newTransaction.montant > totalSales) {
      toast.error(
        `Le total des paiements (${(totalPaidForProject + newTransaction.montant).toFixed(2)}€) dépasserait le total des ventes TTC (${totalSales.toFixed(2)}€)`
      );
      return;
    }

    const transactionData = {
      project_id: newTransaction.project_id,
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
          project_id: currentProjectId,
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
          project_id: currentProjectId,
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
      project_id: transaction.project_id,
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
      project_id: currentProjectId,
    });
  };

  const handleAddNew = () => {
    setEditingId(null);
    setNewTransaction({
      type_paiement: "acompte",
      montant: 0,
      date_paiement: new Date().toISOString().split("T")[0],
      notes: "",
      project_id: currentProjectId,
    });
    setIsAdding(true);
  };

  const totalPaid = transactions.reduce((sum, t) => sum + t.montant, 0);
  const remaining = totalSales - totalPaid;

  const PaymentContent = () => (
    <>
      <div className="space-y-0.5 text-sm border-b pb-1.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total ventes TTC:</span>
          <span className="font-semibold">{totalSales.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total payé:</span>
          <span className="font-semibold text-green-600">{totalPaid.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between text-base font-bold pt-0.5 border-t">
          <span>Reste:</span>
          <span className={remaining <= 0 ? "text-green-600" : "text-primary"}>
            {remaining.toFixed(2)} €
          </span>
        </div>
      </div>

      {transactions.length > 0 && (
        <div className="space-y-0.5">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between py-0.5 px-1.5 hover:bg-muted/50 rounded text-sm border-b">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className={transaction.type_paiement === "acompte" ? "text-orange-600 font-medium" : "text-blue-600 font-medium"}>
                    {transaction.type_paiement === "acompte" ? "Acompte" : "Solde"}
                  </span>
                  <span className="font-bold">{transaction.montant.toFixed(0)}€</span>
                </div>
                <div className="text-muted-foreground truncate">
                  <span className="font-medium text-foreground">{transaction.project_name}</span>
                  {" • "}
                  {new Date(transaction.date_paiement).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  {transaction.notes && ` • ${transaction.notes}`}
                </div>
              </div>
              <div className="flex gap-0.5 flex-shrink-0">
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
            </div>
          ))}
        </div>
      )}

      {!isAdding ? (
        <Button onClick={handleAddNew} className="w-full h-8 text-sm" variant="outline">
          <Plus className="h-3 w-3 mr-1" />
          Ajouter
        </Button>
      ) : (
        <div className="border rounded-lg p-3 space-y-2">
          <h4 className="font-semibold text-sm">
            {editingId ? "Modifier" : "Ajouter un paiement"}
          </h4>
          <div className="space-y-1">
            <Label className="text-sm">Type</Label>
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
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="acompte">Acompte</SelectItem>
                <SelectItem value="solde">Solde</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-sm">Montant (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={newTransaction.montant}
                onChange={(e) =>
                  setNewTransaction({ ...newTransaction, montant: parseFloat(e.target.value) || 0 })
                }
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-sm">Date</Label>
              <Input
                type="date"
                value={newTransaction.date_paiement}
                onChange={(e) =>
                  setNewTransaction({ ...newTransaction, date_paiement: e.target.value })
                }
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Notes</Label>
            <Textarea
              value={newTransaction.notes}
              onChange={(e) =>
                setNewTransaction({ ...newTransaction, notes: e.target.value })
              }
              placeholder="Notes..."
              className="h-16 text-sm resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={addOrUpdateTransaction} className="flex-1 h-7 text-sm">
              {editingId ? "Modifier" : "OK"}
            </Button>
            <Button
              onClick={cancelEdit}
              variant="outline"
              className="flex-1 h-7 text-sm"
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Paiements</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(true)}
              className="h-8 w-8"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <PaymentContent />
        </CardContent>
      </Card>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Paiements</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[calc(90vh-100px)] pr-4">
            <div className="space-y-1.5">
              <PaymentContent />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PaymentTransactions;
