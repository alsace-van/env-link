import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ScrollArea } from "@/components/ui/scroll-area";
import PaymentTransactions from "./PaymentTransactions";

interface ExpensesSummaryProps {
  projectId: string;
  refreshTrigger: number;
}

interface CategoryTotal {
  name: string;
  value: number;
  achats: number;
  ventes: number;
  marge: number;
}


const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1"];

const ExpensesSummary = ({ projectId, refreshTrigger }: ExpensesSummaryProps) => {
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalMargin, setTotalMargin] = useState(0);
  const [paymentRefresh, setPaymentRefresh] = useState(0);

  useEffect(() => {
    loadExpensesData();
  }, [projectId, refreshTrigger]);

  const loadExpensesData = async () => {
    const { data, error } = await supabase
      .from("project_expenses")
      .select("categorie, prix, quantite, prix_vente_ttc")
      .eq("project_id", projectId);

    if (error) {
      console.error(error);
      return;
    }

    // Calculate totals by category for purchases and sales
    const categoryMap = new Map<string, { achats: number; ventes: number }>();
    let total = 0;

    data?.forEach((expense) => {
      const amount = expense.prix * expense.quantite;
      total += amount;
      
      const current = categoryMap.get(expense.categorie) || { achats: 0, ventes: 0 };
      current.achats += amount;
      
      if (expense.prix_vente_ttc) {
        const venteTTC = expense.prix_vente_ttc * expense.quantite;
        current.ventes += venteTTC / 1.20; // Convert to HT
      }
      
      categoryMap.set(expense.categorie, current);
    });

    const chartData = Array.from(categoryMap.entries()).map(([name, values]) => ({
      name,
      value: Math.round(values.achats * 100) / 100,
      achats: Math.round(values.achats * 100) / 100,
      ventes: Math.round(values.ventes * 100) / 100,
      marge: Math.round((values.ventes - values.achats) * 100) / 100,
    }));

    setCategoryTotals(chartData);
    setTotalExpenses(Math.round(total * 100) / 100);

    // Calculate total sales and net margin (excluding 20% VAT)
    let totalVentes = 0;
    let totalVentesHT = 0;
    data?.forEach((expense) => {
      if (expense.prix_vente_ttc) {
        const venteTTC = expense.prix_vente_ttc * expense.quantite;
        totalVentes += venteTTC;
        // Convert TTC to HT by dividing by 1.20 (20% VAT)
        totalVentesHT += venteTTC / 1.20;
      }
    });
    setTotalSales(Math.round(totalVentes * 100) / 100);
    // Net margin = Sales HT - Purchase HT
    setTotalMargin(Math.round((totalVentesHT - total) * 100) / 100);
  };


  return (
    <ScrollArea className="h-[calc(100vh-2rem)] pr-4">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Achats (HT)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {totalExpenses.toFixed(2)} €
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Ventes (TTC)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {totalSales.toFixed(2)} €
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marge Nette (HT)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {totalMargin.toFixed(2)} €
            </div>
            {totalExpenses > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                {((totalMargin / totalExpenses) * 100).toFixed(1)}% de marge
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-2">
              TVA 20% déduite
            </div>
          </CardContent>
        </Card>
      </div>

      <PaymentTransactions 
        projectId={projectId} 
        totalSales={totalSales}
        onPaymentChange={() => setPaymentRefresh(prev => prev + 1)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Analyse par Catégorie</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryTotals.length > 0 ? (
            <Carousel className="w-full">
              <CarouselContent>
                {categoryTotals.map((category, index) => (
                  <CarouselItem key={category.name}>
                    <div className="space-y-4">
                      <div className="text-center">
                        <h3 className="text-xl font-bold">{category.name}</h3>
                        <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Achats HT</p>
                            <p className="text-lg font-bold text-red-600">{category.achats.toFixed(2)} €</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Ventes HT</p>
                            <p className="text-lg font-bold text-green-600">{category.ventes.toFixed(2)} €</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Marge Nette</p>
                            <p className="text-lg font-bold text-blue-600">{category.marge.toFixed(2)} €</p>
                          </div>
                        </div>
                      </div>
                      
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Achats HT", value: category.achats },
                              { name: "Marge", value: category.marge },
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => `${entry.value.toFixed(0)}€`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            <Cell fill="#ef4444" />
                            <Cell fill="#10b981" />
                          </Pie>
                          <Tooltip formatter={(value: number) => `${value.toFixed(2)}€`} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="h-12 w-12" />
              <CarouselNext className="h-12 w-12" />
            </Carousel>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Aucune catégorie disponible
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vue d'ensemble par Catégorie</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryTotals.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={categoryTotals}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value.toFixed(0)}€`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryTotals.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toFixed(2)}€`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Aucune donnée disponible
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </ScrollArea>
  );
};

export default ExpensesSummary;
