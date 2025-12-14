import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ClipboardList, Clock, CheckCircle2, Wrench } from "lucide-react";
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

interface WorkStats {
  totalTasks: number;
  completedTasks: number;
  totalHT: number;
  totalTTC: number;
  totalEstimatedHours: number;
  totalActualHours: number;
}

const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1"];

const ExpensesSummary = ({ projectId, refreshTrigger }: ExpensesSummaryProps) => {
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalMargin, setTotalMargin] = useState(0);
  const [paymentRefresh, setPaymentRefresh] = useState(0);

  // 🔥 Statistiques des travaux
  const [workStats, setWorkStats] = useState<WorkStats>({
    totalTasks: 0,
    completedTasks: 0,
    totalHT: 0,
    totalTTC: 0,
    totalEstimatedHours: 0,
    totalActualHours: 0,
  });

  useEffect(() => {
    loadExpensesData();
    loadWorkStats();
  }, [projectId, refreshTrigger, paymentRefresh]);

  // 🔥 Charger les statistiques des travaux
  const loadWorkStats = async () => {
    // Trouver le scénario principal
    const { data: scenario } = await (supabase as any)
      .from("project_scenarios")
      .select("id")
      .eq("project_id", projectId)
      .eq("est_principal", true)
      .single();

    // Charger les tâches (avec ou sans scénario)
    let query = supabase.from("project_todos").select("*").eq("project_id", projectId).not("category_id", "is", null); // Seulement les tâches de la fiche de travaux

    if (scenario?.id) {
      query = query.eq("work_scenario_id" as any, scenario.id);
    }

    const { data: tasks, error } = await query;

    if (error) {
      console.error("Erreur chargement tâches:", error);
      return;
    }

    const stats: WorkStats = {
      totalTasks: tasks?.length || 0,
      completedTasks: tasks?.filter((t: any) => t.completed).length || 0,
      totalHT: tasks?.reduce((sum: number, t: any) => sum + (t.forfait_ht || 0), 0) || 0,
      totalTTC: tasks?.reduce((sum: number, t: any) => sum + (t.forfait_ttc || 0), 0) || 0,
      totalEstimatedHours: tasks?.reduce((sum: number, t: any) => sum + (t.estimated_hours || 0), 0) || 0,
      totalActualHours:
        tasks?.filter((t: any) => t.completed).reduce((sum: number, t: any) => sum + (t.actual_hours || 0), 0) || 0,
    };

    setWorkStats(stats);
  };

  const loadExpensesData = async () => {
    // D'abord, trouver le scénario principal du projet
    const { data: scenarios, error: scenarioError } = await (supabase as any)
      .from("project_scenarios")
      .select("id")
      .eq("project_id", projectId)
      .eq("est_principal", true)
      .single();

    console.log("📊 Scénario principal trouvé:", scenarios, "Erreur:", scenarioError);

    if (!scenarios) {
      // Pas de scénario principal, charger toutes les dépenses du projet (fallback)
      console.log("⚠️ Pas de scénario principal, fallback sur project_id");
      const { data, error } = await (supabase as any).from("project_expenses").select("*").eq("project_id", projectId);
      if (error) {
        console.error(error);
        return;
      }
      await processExpenses(data || []);
      return;
    }

    // Charger uniquement les dépenses du scénario principal
    console.log("✅ Chargement dépenses du scénario:", scenarios.id);
    const { data, error } = await (supabase as any)
      .from("project_expenses")
      .select("*")
      .eq("scenario_id", scenarios.id);

    if (error) {
      console.error(error);
      return;
    }

    console.log("📊 Dépenses chargées:", data?.length, "articles");
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
      {/* 🔥 Section Travaux */}
      {workStats.totalTasks > 0 && (
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border-indigo-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4 text-indigo-600" />
              Travaux (Main d'œuvre)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progression */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-medium">
                  {workStats.completedTasks}/{workStats.totalTasks} tâches
                </span>
              </div>
              <Progress
                value={workStats.totalTasks > 0 ? (workStats.completedTasks / workStats.totalTasks) * 100 : 0}
                className="h-2"
              />
            </div>

            {/* Totaux financiers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-lg">
                <p className="text-xs text-muted-foreground">Total HT</p>
                <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400">
                  {workStats.totalHT.toFixed(2)} €
                </p>
              </div>
              <div className="p-3 bg-white/60 dark:bg-black/20 rounded-lg">
                <p className="text-xs text-muted-foreground">Total TTC</p>
                <p className="text-lg font-bold text-green-700 dark:text-green-400">
                  {workStats.totalTTC.toFixed(2)} €
                </p>
              </div>
            </div>

            {/* Heures */}
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Estimé: {workStats.totalEstimatedHours.toFixed(1)}h
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" />
                Réel: {workStats.totalActualHours.toFixed(1)}h
              </span>
            </div>

            {/* Taux horaire moyen */}
            {workStats.totalActualHours > 0 && workStats.totalTTC > 0 && (
              <div className="text-center pt-2 border-t">
                <p className="text-xs text-muted-foreground">Taux horaire moyen</p>
                <p className="text-xl font-bold text-purple-600">
                  {(workStats.totalTTC / workStats.totalActualHours).toFixed(2)} €/h TTC
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section Dépenses matériel */}
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

      {/* 🔥 Total général du devis (Matériel + Travaux) */}
      {(totalSales > 0 || workStats.totalTTC > 0) && (
        <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-emerald-800 dark:text-emerald-300">📋 Total Devis Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Détail */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Matériel (TTC)</span>
                  <span className="font-medium">{totalSales.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Travaux (TTC)</span>
                  <span className="font-medium">{workStats.totalTTC.toFixed(2)} €</span>
                </div>
              </div>

              {/* Total */}
              <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">TOTAL TTC</span>
                  <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {(totalSales + workStats.totalTTC).toFixed(2)} €
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1 text-sm text-muted-foreground">
                  <span>dont TVA 20%</span>
                  <span>{(totalSales + workStats.totalTTC - (totalSales / 1.2 + workStats.totalHT)).toFixed(2)} €</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
