import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { toast } from "sonner";

interface ExpensesSummaryProps {
  projectId: string;
  refreshTrigger: number;
}

interface CategoryTotal {
  name: string;
  value: number;
}

interface PaymentInfo {
  id?: string;
  acompte: number;
  acompte_paye: boolean;
  solde: number;
  solde_paye: boolean;
}

const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1"];

const ExpensesSummary = ({ projectId, refreshTrigger }: ExpensesSummaryProps) => {
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    acompte: 0,
    acompte_paye: false,
    solde: 0,
    solde_paye: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadExpensesData();
    loadPaymentInfo();
  }, [projectId, refreshTrigger]);

  const loadExpensesData = async () => {
    const { data, error } = await supabase
      .from("project_expenses")
      .select("categorie, prix, quantite")
      .eq("project_id", projectId);

    if (error) {
      console.error(error);
      return;
    }

    // Calculate totals by category
    const categoryMap = new Map<string, number>();
    let total = 0;

    data?.forEach((expense) => {
      const amount = expense.prix * expense.quantite;
      total += amount;
      const current = categoryMap.get(expense.categorie) || 0;
      categoryMap.set(expense.categorie, current + amount);
    });

    const chartData = Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
    }));

    setCategoryTotals(chartData);
    setTotalExpenses(Math.round(total * 100) / 100);
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
        id: data.id,
        acompte: data.acompte,
        acompte_paye: data.acompte_paye,
        solde: data.solde,
        solde_paye: data.solde_paye,
      });
    }
  };

  const savePaymentInfo = async () => {
    setIsSaving(true);

    if (paymentInfo.id) {
      // Update existing
      const { error } = await supabase
        .from("project_payments")
        .update({
          acompte: paymentInfo.acompte,
          acompte_paye: paymentInfo.acompte_paye,
          solde: paymentInfo.solde,
          solde_paye: paymentInfo.solde_paye,
        })
        .eq("id", paymentInfo.id);

      if (error) {
        toast.error("Erreur lors de la sauvegarde");
        console.error(error);
      } else {
        toast.success("Informations de paiement sauvegardées");
      }
    } else {
      // Create new
      const { error } = await supabase
        .from("project_payments")
        .insert({
          project_id: projectId,
          acompte: paymentInfo.acompte,
          acompte_paye: paymentInfo.acompte_paye,
          solde: paymentInfo.solde,
          solde_paye: paymentInfo.solde_paye,
        });

      if (error) {
        toast.error("Erreur lors de la sauvegarde");
        console.error(error);
      } else {
        toast.success("Informations de paiement sauvegardées");
        loadPaymentInfo();
      }
    }

    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Total des dépenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-primary">
            {totalExpenses.toFixed(2)} €
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Répartition par catégorie</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryTotals.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryTotals}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.value.toFixed(0)}€`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryTotals.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toFixed(2)}€`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Aucune dépense pour le moment
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suivi des paiements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="acompte">Montant de l'acompte (€)</Label>
            <Input
              id="acompte"
              type="number"
              step="0.01"
              value={paymentInfo.acompte}
              onChange={(e) =>
                setPaymentInfo({ ...paymentInfo, acompte: parseFloat(e.target.value) || 0 })
              }
            />
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id="acompte_paye"
                checked={paymentInfo.acompte_paye}
                onCheckedChange={(checked) =>
                  setPaymentInfo({ ...paymentInfo, acompte_paye: checked as boolean })
                }
              />
              <Label htmlFor="acompte_paye" className="cursor-pointer">
                Acompte payé
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="solde">Montant du solde (€)</Label>
            <Input
              id="solde"
              type="number"
              step="0.01"
              value={paymentInfo.solde}
              onChange={(e) =>
                setPaymentInfo({ ...paymentInfo, solde: parseFloat(e.target.value) || 0 })
              }
            />
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id="solde_paye"
                checked={paymentInfo.solde_paye}
                onCheckedChange={(checked) =>
                  setPaymentInfo({ ...paymentInfo, solde_paye: checked as boolean })
                }
              />
              <Label htmlFor="solde_paye" className="cursor-pointer">
                Solde payé
              </Label>
            </div>
          </div>

          <Button onClick={savePaymentInfo} disabled={isSaving} className="w-full">
            {isSaving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>

          <div className="pt-4 border-t">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total des dépenses:</span>
                <span className="font-semibold">{totalExpenses.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span>Acompte versé:</span>
                <span className="font-semibold">{paymentInfo.acompte.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span>Solde versé:</span>
                <span className="font-semibold">{paymentInfo.solde.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t">
                <span>Reste à payer:</span>
                <span className="text-primary">
                  {(totalExpenses - paymentInfo.acompte - paymentInfo.solde).toFixed(2)} €
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpensesSummary;
