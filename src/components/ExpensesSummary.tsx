import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
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
  }, [projectId, refreshTrigger, paymentRefresh]);

  const loadExpensesData = async () => {
    // D'abord, trouver le scénario principal du projet
    const { data: scenarios } = await (supabase as any)
      .from("project_scenarios")
      .select("id")
      .eq("project_id", projectId)
      .eq("is_principal", true)
      .single();

    if (!scenarios) {
      // Pas de scénario principal, charger toutes les dépenses du projet (fallback)
      const { data, error } = await (supabase as any).from("project_expenses").select("*").eq("project_id", projectId);
      if (error) {
        console.error(error);
        return;
      }
      await processExpenses(data || []);
      return;
    }

    // Charger uniquement les dépenses du scénario principal
    const { data, error } = await (supabase as any).from("project_expenses").select("*").eq("scenario_id", scenarios.id);

    if (error) {
      console.error(error);
      return;
    }

    await processExpenses(data || []);
  };

  const processExpenses = async (data: any[]) => {
    const expensesWithOptions = await Promise.all(
      (data || []).map(async (expense: any) => {
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

    // Calculate totals by category for purchases and sales INCLUDING OPTIONS
    const categoryMap = new Map<string, { achats: number; ventes: number }>();
    let total = 0;

    expensesWithOptions.forEach((expense) => {
      // Calculate total purchase price INCLUDING options
      const optionsPrixTotal = (expense.selectedOptions || []).reduce(
        (sum: number, opt: any) => sum + opt.prix_reference,
        0,
      );
      const totalAchat = (expense.prix + optionsPrixTotal) * expense.quantite;
      total += totalAchat;

      const current = categoryMap.get(expense.categorie) || { achats: 0, ventes: 0 };
      current.achats += totalAchat;

      if (expense.prix_vente_ttc) {
        // Calculate total sale price INCLUDING options
        const optionsVenteTotal = (expense.selectedOptions || []).reduce(
          (sum: number, opt: any) => sum + opt.prix_vente_ttc,
          0,
        );
        const totalVenteTTC = (expense.prix_vente_ttc + optionsVenteTotal) * expense.quantite;
        current.ventes += totalVenteTTC / 1.2; // Convert to HT
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

    // Calculate total sales and net margin (excluding 20% VAT) INCLUDING OPTIONS
    let totalVentes = 0;
    let totalVentesHT = 0;
    expensesWithOptions.forEach((expense) => {
      if (expense.prix_vente_ttc) {
        // Include options in sale price
        const optionsVenteTotal = (expense.selectedOptions || []).reduce(
          (sum: number, opt: any) => sum + opt.prix_vente_ttc,
          0,
        );
        const totalVenteTTC = (expense.prix_vente_ttc + optionsVenteTotal) * expense.quantite;
        totalVentes += totalVenteTTC;
        // Convert TTC to HT by dividing by 1.20 (20% VAT)
        totalVentesHT += totalVenteTTC / 1.2;
      }
    });
    setTotalSales(Math.round(totalVentes * 100) / 100);
    // Net margin = Sales HT - Purchase HT
    setTotalMargin(Math.round((totalVentesHT - total) * 100) / 100);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <span style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Total Achats (HT)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold text-red-600">{totalExpenses.toFixed(2)} €</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <span style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Total Ventes (TTC)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold text-green-600">{totalSales.toFixed(2)} €</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <span style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Marge Nette (HT)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold text-blue-600">{totalMargin.toFixed(2)} €</div>
            {totalExpenses > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {((totalMargin / totalExpenses) * 100).toFixed(1)}% de marge
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">TVA 20% déduite</div>
          </CardContent>
        </Card>
      </div>

      <PaymentTransactions
        currentProjectId={projectId}
        totalSales={totalSales}
        onPaymentChange={() => setPaymentRefresh((prev) => prev + 1)}
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
            <div className="text-center py-12 text-muted-foreground">Aucune catégorie disponible</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vue d'ensemble par Catégorie</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryTotals.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryTotals}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={(entry) => {
                    const maxLength = 12;
                    const name =
                      entry.name.length > maxLength ? entry.name.substring(0, maxLength) + "..." : entry.name;
                    return `${name}: ${entry.value.toFixed(0)}€`;
                  }}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                  style={{ fontSize: "11px" }}
                >
                  {categoryTotals.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: "12px" }}
                  formatter={(value: number, name: string, props: any) => [`${value.toFixed(2)}€`, props.payload.name]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px" }}
                  formatter={(value: string) => {
                    const maxLength = 15;
                    return value.length > maxLength ? value.substring(0, maxLength) + "..." : value;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-muted-foreground">Aucune donnée disponible</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpensesSummary;
