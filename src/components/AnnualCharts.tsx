import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";

interface AnnualChartsProps {
  projectId: string;
}

interface CustomerRevenue {
  customer: string;
  amount: number;
}

interface SupplierExpense {
  supplier: string;
  amount: number;
}

interface MonthlyRevenue {
  month: string;
  amount: number;
}

const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6"];

export const AnnualCharts = ({ projectId }: AnnualChartsProps) => {
  const [customerRevenues, setCustomerRevenues] = useState<CustomerRevenue[]>([]);
  const [supplierExpenses, setSupplierExpenses] = useState<SupplierExpense[]>([]);
  const [monthlyRevenues, setMonthlyRevenues] = useState<MonthlyRevenue[]>([]);
  const [annualSupplierExpenses, setAnnualSupplierExpenses] = useState<SupplierExpense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnnualData();
  }, [projectId]);

  const loadAnnualData = async () => {
    setLoading(true);

    // Get current year date range
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).toISOString();
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59).toISOString();

    try {
      // 1. Rentrées d'argent par client (from project_payment_transactions with join to projects)
      const { data: paymentsData } = await supabase
        .from("project_payment_transactions")
        .select(
          `
          montant,
          date_paiement,
          projects!inner(nom_proprietaire)
        `,
        )
        .gte("date_paiement", startOfYear)
        .lte("date_paiement", endOfYear);

      if (paymentsData) {
        const customerMap = new Map<string, number>();
        paymentsData.forEach((payment: any) => {
          const customer = payment.projects?.nom_proprietaire || "Client inconnu";
          customerMap.set(customer, (customerMap.get(customer) || 0) + payment.montant);
        });
        const customerData = Array.from(customerMap.entries())
          .map(([customer, amount]) => ({ customer, amount: Math.round(amount * 100) / 100 }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10); // Top 10 clients
        setCustomerRevenues(customerData);
      }

      // 2. Factures fournisseurs sur l'année mensuelles (from tableau factures fournisseurs)
      const { data: supplierInvoicesMonthly } = await supabase
        .from("project_expenses")
        .select("prix, quantite, date_achat")
        .is("project_id", null)
        .eq("categorie", "Fournisseur")
        .gte("date_achat", startOfYear)
        .lte("date_achat", endOfYear);

      if (supplierInvoicesMonthly) {
        const monthMap = new Map<string, number>();
        supplierInvoicesMonthly.forEach((expense) => {
          const date = new Date(expense.date_achat);
          const monthKey = date.toLocaleDateString("fr-FR", { month: "short" });
          const total = expense.prix * expense.quantite;
          monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + total);
        });

        // Create array for all months
        const months = [
          "janv.",
          "févr.",
          "mars",
          "avr.",
          "mai",
          "juin",
          "juil.",
          "août",
          "sept.",
          "oct.",
          "nov.",
          "déc.",
        ];
        const supplierMonthlyData = months.map((month) => ({
          month,
          amount: Math.round((monthMap.get(month) || 0) * 100) / 100,
        }));
        setSupplierExpenses(supplierMonthlyData);
      }

      // 3. Rentrées d'argent sur l'année (mensuel)
      if (paymentsData) {
        const monthMap = new Map<string, number>();
        paymentsData.forEach((payment: any) => {
          const date = new Date(payment.date_paiement);
          const monthKey = date.toLocaleDateString("fr-FR", { month: "short" });
          monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + payment.montant);
        });

        const months = [
          "janv.",
          "févr.",
          "mars",
          "avr.",
          "mai",
          "juin",
          "juil.",
          "août",
          "sept.",
          "oct.",
          "nov.",
          "déc.",
        ];
        const monthlyData = months.map((month) => ({
          month,
          amount: Math.round((monthMap.get(month) || 0) * 100) / 100,
        }));
        setMonthlyRevenues(monthlyData);
      }

      // 4. Factures fournisseurs annuelles par fournisseur (pie chart)
      // Utilise uniquement les dépenses du tableau "factures fournisseurs" (project_id = null, categorie = "Fournisseur")
      const { data: supplierInvoicesData } = await supabase
        .from("project_expenses")
        .select("prix, quantite, fournisseur, date_achat")
        .is("project_id", null)
        .eq("categorie", "Fournisseur")
        .gte("date_achat", startOfYear)
        .lte("date_achat", endOfYear);

      if (supplierInvoicesData && supplierInvoicesData.length > 0) {
        const supplierMap = new Map<string, number>();
        supplierInvoicesData.forEach((expense) => {
          const supplier = expense.fournisseur || "Fournisseur inconnu";
          const total = expense.prix * expense.quantite;
          supplierMap.set(supplier, (supplierMap.get(supplier) || 0) + total);
        });
        const supplierData = Array.from(supplierMap.entries())
          .map(([supplier, amount]) => ({ supplier, amount: Math.round(amount * 100) / 100 }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 8); // Top 8 fournisseurs
        setAnnualSupplierExpenses(supplierData);
      } else {
        setAnnualSupplierExpenses([]);
      }
    } catch (error) {
      console.error("Error loading annual data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rentrées d'argent par client */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Revenus par client ({new Date().getFullYear()})</CardTitle>
        </CardHeader>
        <CardContent>
          {customerRevenues.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={customerRevenues}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="customer" angle={-45} textAnchor="end" height={80} style={{ fontSize: "10px" }} />
                <YAxis style={{ fontSize: "11px" }} />
                <Tooltip formatter={(value: number) => `${value.toFixed(2)} €`} />
                <Bar dataKey="amount" fill="#10b981" name="Montant (€)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">Aucune donnée disponible</div>
          )}
        </CardContent>
      </Card>

      {/* Factures fournisseurs mensuelles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Factures fournisseurs mensuelles ({new Date().getFullYear()})</CardTitle>
        </CardHeader>
        <CardContent>
          {supplierExpenses.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={supplierExpenses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" style={{ fontSize: "10px" }} />
                <YAxis style={{ fontSize: "11px" }} />
                <Tooltip formatter={(value: number) => `${value.toFixed(2)} €`} />
                <Bar dataKey="amount" fill="#ef4444" name="Montant (€)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">Aucune donnée disponible</div>
          )}
        </CardContent>
      </Card>

      {/* Rentrées d'argent mensuelles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Revenus mensuels ({new Date().getFullYear()})</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyRevenues.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyRevenues}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" style={{ fontSize: "10px" }} />
                <YAxis style={{ fontSize: "11px" }} />
                <Tooltip formatter={(value: number) => `${value.toFixed(2)} €`} />
                <Bar dataKey="amount" fill="#3b82f6" name="Montant (€)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">Aucune donnée disponible</div>
          )}
        </CardContent>
      </Card>

      {/* Factures par fournisseur (pie chart) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Factures par fournisseur ({new Date().getFullYear()})</CardTitle>
        </CardHeader>
        <CardContent>
          {annualSupplierExpenses.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={annualSupplierExpenses}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => {
                    const maxLength = 10;
                    const name =
                      entry.supplier.length > maxLength
                        ? entry.supplier.substring(0, maxLength) + "..."
                        : entry.supplier;
                    return `${name}: ${entry.amount.toFixed(0)}€`;
                  }}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="amount"
                  style={{ fontSize: "10px" }}
                >
                  {annualSupplierExpenses.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${value.toFixed(2)} €`,
                    props.payload.supplier,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "10px" }}
                  formatter={(value: string, entry: any) => {
                    const maxLength = 15;
                    const supplier = entry.payload.supplier;
                    return supplier.length > maxLength ? supplier.substring(0, maxLength) + "..." : supplier;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">Aucune donnée disponible</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
