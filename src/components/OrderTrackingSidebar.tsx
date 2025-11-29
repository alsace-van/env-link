import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  ShoppingCart,
  Truck,
  PackageCheck,
  Calendar,
  Building2,
  Package,
  ChevronRight,
  Undo2,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  BarChart3,
  TrendingUp,
  Trophy,
  Euro,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface OrderItem {
  id: string;
  nom_accessoire: string;
  marque?: string;
  prix: number;
  prix_vente_ttc?: number;
  quantite: number;
  categorie: string;
  fournisseur?: string;
  statut_livraison: "commande" | "en_livraison" | "livre";
  date_achat: string;
  expected_delivery_date?: string;
  project_id: string;
  project_name?: string;
}

interface MonthlyStats {
  month: string;
  monthLabel: string;
  totalAchats: number;
  totalVentes: number;
  margeNette: number;
}

interface TopAccessory {
  nom: string;
  marque?: string;
  totalQuantity: number;
  totalAmount: number;
  monthlyData: Record<string, number>;
}

interface OrderTrackingSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderChange?: () => void;
}

const OrderTrackingSidebar = ({ isOpen, onClose, onOrderChange }: OrderTrackingSidebarProps) => {
  const [shoppingList, setShoppingList] = useState<OrderItem[]>([]);
  const [ordersInProgress, setOrdersInProgress] = useState<OrderItem[]>([]);
  const [receivedOrders, setReceivedOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [hasValidScenarios, setHasValidScenarios] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // Stats pour le panneau étendu
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [topAccessories, setTopAccessories] = useState<TopAccessory[]>([]);
  const [allExpenses, setAllExpenses] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadAllOrders();
    }
  }, [isOpen]);

  const loadAllOrders = async () => {
    setIsLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setIsLoading(false);
      return;
    }

    // Charger tous les projets de l'utilisateur
    const { data: projects } = await supabase
      .from("projects")
      .select("id, nom_projet, nom_proprietaire")
      .eq("user_id", userData.user.id);

    // Utiliser nom_projet ou nom_proprietaire comme fallback
    const projectMap = new Map(
      projects?.map((p) => [p.id, p.nom_projet || p.nom_proprietaire || "Projet sans nom"]) || [],
    );
    const projectIds = projects?.map((p) => p.id) || [];

    if (projectIds.length === 0) {
      setShoppingList([]);
      setOrdersInProgress([]);
      setReceivedOrders([]);
      setIsLoading(false);
      return;
    }

    // Charger les scénarios principaux ET verrouillés
    const { data: validScenarios } = await supabase
      .from("project_scenarios")
      .select("id, project_id")
      .in("project_id", projectIds)
      .eq("est_principal", true)
      .eq("is_locked", true);

    const validScenarioIds = validScenarios?.map((s) => s.id) || [];

    if (validScenarioIds.length === 0) {
      // Aucun scénario principal verrouillé
      setHasValidScenarios(false);
      setShoppingList([]);
      setOrdersInProgress([]);
      setReceivedOrders([]);
      setIsLoading(false);
      return;
    }

    setHasValidScenarios(true);

    // Charger uniquement les dépenses des scénarios principaux verrouillés
    const { data: expenses, error } = await supabase
      .from("project_expenses")
      .select("*")
      .in("scenario_id", validScenarioIds)
      .order("date_achat", { ascending: false });

    if (error) {
      toast.error("Erreur lors du chargement des commandes");
      console.error(error);
      setIsLoading(false);
      return;
    }

    const expensesWithProjectName = (expenses || []).map((e: any) => ({
      ...e,
      project_name: projectMap.get(e.project_id) || "Projet inconnu",
    }));

    // Séparer par statut
    setShoppingList(expensesWithProjectName.filter((e: OrderItem) => e.statut_livraison === "commande"));
    setOrdersInProgress(expensesWithProjectName.filter((e: OrderItem) => e.statut_livraison === "en_livraison"));
    setReceivedOrders(expensesWithProjectName.filter((e: OrderItem) => e.statut_livraison === "livre"));

    // Stocker toutes les dépenses pour les stats
    setAllExpenses(expensesWithProjectName);

    // Calculer les stats mensuelles (6 derniers mois)
    calculateMonthlyStats(expensesWithProjectName);

    // Calculer le top accessoires
    calculateTopAccessories(expensesWithProjectName);

    setIsLoading(false);
  };

  // Calculer les statistiques mensuelles
  const calculateMonthlyStats = (expenses: OrderItem[]) => {
    const months: MonthlyStats[] = [];
    const now = new Date();

    // 6 derniers mois
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthKey = format(monthDate, "yyyy-MM");
      const monthLabel = format(monthDate, "MMM yy", { locale: fr });

      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthExpenses = expenses.filter((e) => {
        const date = new Date(e.date_achat);
        return date >= monthStart && date <= monthEnd;
      });

      // Total achats HT
      const totalAchats = monthExpenses.reduce((sum, e) => sum + e.prix * e.quantite, 0);

      // Total ventes TTC
      const totalVentes = monthExpenses.reduce((sum, e) => {
        const venteTTC = e.prix_vente_ttc || e.prix * 1.5; // Fallback si pas de prix vente
        return sum + venteTTC * e.quantite;
      }, 0);

      // Marge nette = Ventes HT - Achats HT
      // Ventes HT = Ventes TTC / 1.2 (TVA 20%)
      const ventesHT = totalVentes / 1.2;
      const margeNette = ventesHT - totalAchats;

      months.push({
        month: monthKey,
        monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        totalAchats,
        totalVentes,
        margeNette,
      });
    }

    setMonthlyStats(months);
  };

  // Calculer le top des accessoires
  const calculateTopAccessories = (expenses: OrderItem[]) => {
    const accessoryMap = new Map<string, TopAccessory>();
    const now = new Date();

    // Générer les clés des 6 derniers mois
    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      monthKeys.push(format(subMonths(now, i), "yyyy-MM"));
    }

    expenses.forEach((expense) => {
      const key = expense.nom_accessoire.toLowerCase();
      const monthKey = format(new Date(expense.date_achat), "yyyy-MM");

      if (!accessoryMap.has(key)) {
        const monthlyData: Record<string, number> = {};
        monthKeys.forEach((m) => (monthlyData[m] = 0));

        accessoryMap.set(key, {
          nom: expense.nom_accessoire,
          marque: expense.marque,
          totalQuantity: 0,
          totalAmount: 0,
          monthlyData,
        });
      }

      const acc = accessoryMap.get(key)!;
      acc.totalQuantity += expense.quantite;
      acc.totalAmount += expense.prix * expense.quantite;
      if (acc.monthlyData[monthKey] !== undefined) {
        acc.monthlyData[monthKey] += expense.quantite;
      }
    });

    // Trier par quantité totale et prendre le top 10
    const sorted = Array.from(accessoryMap.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10);

    setTopAccessories(sorted);
  };

  const updateOrderStatus = async (id: string, newStatus: "commande" | "en_livraison" | "livre") => {
    const { error } = await supabase.from("project_expenses").update({ statut_livraison: newStatus }).eq("id", id);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
      return;
    }

    toast.success("Statut mis à jour");
    loadAllOrders();
    onOrderChange?.();
  };

  const updateDeliveryDate = async (id: string, date: string) => {
    const { error } = await supabase.from("project_expenses").update({ expected_delivery_date: date }).eq("id", id);

    if (error) {
      toast.error("Erreur lors de la mise à jour de la date");
      return;
    }

    toast.success("Date de livraison mise à jour");
    loadAllOrders();
  };

  const moveSelectedToInProgress = async () => {
    if (selectedItems.size === 0) {
      toast.warning("Sélectionnez des articles à passer en commande");
      return;
    }

    const { error } = await supabase
      .from("project_expenses")
      .update({ statut_livraison: "en_livraison" })
      .in("id", Array.from(selectedItems));

    if (error) {
      toast.error("Erreur lors de la mise à jour");
      return;
    }

    toast.success(`${selectedItems.size} article(s) passé(s) en livraison`);
    setSelectedItems(new Set());
    loadAllOrders();
    onOrderChange?.();
  };

  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const selectAllShoppingList = () => {
    if (selectedItems.size === shoppingList.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(shoppingList.map((item) => item.id)));
    }
  };

  // Grouper les articles par fournisseur
  const groupBySupplier = (items: OrderItem[]) => {
    const grouped: Record<string, OrderItem[]> = {};
    items.forEach((item) => {
      const supplier = item.fournisseur || "Sans fournisseur";
      if (!grouped[supplier]) {
        grouped[supplier] = [];
      }
      grouped[supplier].push(item);
    });
    return grouped;
  };

  if (!isOpen) return null;

  // Labels des mois pour le tableau
  const monthLabels = monthlyStats.map((m) => m.monthLabel);

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className={`fixed right-0 top-0 h-full bg-background shadow-xl animate-in slide-in-from-right duration-300 transition-all flex ${
          isExpanded ? "w-[950px]" : "w-[500px]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panneau étendu - Statistiques */}
        {isExpanded && (
          <div className="w-[450px] border-r flex flex-col bg-muted/20">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Statistiques Commandes</h3>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {/* Graphique des achats HT par mois */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-red-500" />
                  Achats HT par mois
                </h4>
                <div className="h-[160px] bg-background rounded-lg p-2 border">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyStats}>
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        width={45}
                        tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value)}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(2)} €`, "Achats HT"]}
                        labelStyle={{ fontWeight: "bold" }}
                      />
                      <Bar dataKey="totalAchats" radius={[4, 4, 0, 0]}>
                        {monthlyStats.map((entry, index) => (
                          <Cell
                            key={`cell-achats-${index}`}
                            fill={index === monthlyStats.length - 1 ? "#ef4444" : "#fca5a5"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 text-center">
                  <span className="text-xs text-muted-foreground">
                    Total:{" "}
                    <span className="font-semibold text-red-600">
                      {monthlyStats.reduce((sum, m) => sum + m.totalAchats, 0).toFixed(2)} €
                    </span>
                  </span>
                </div>
              </div>

              {/* Graphique des ventes TTC par mois */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Euro className="h-4 w-4 text-blue-500" />
                  Ventes TTC par mois
                </h4>
                <div className="h-[160px] bg-background rounded-lg p-2 border">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyStats}>
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        width={45}
                        tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value)}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(2)} €`, "Ventes TTC"]}
                        labelStyle={{ fontWeight: "bold" }}
                      />
                      <Bar dataKey="totalVentes" radius={[4, 4, 0, 0]}>
                        {monthlyStats.map((entry, index) => (
                          <Cell
                            key={`cell-ventes-${index}`}
                            fill={index === monthlyStats.length - 1 ? "#3b82f6" : "#93c5fd"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 text-center">
                  <span className="text-xs text-muted-foreground">
                    Total:{" "}
                    <span className="font-semibold text-blue-600">
                      {monthlyStats.reduce((sum, m) => sum + m.totalVentes, 0).toFixed(2)} €
                    </span>
                  </span>
                </div>
              </div>

              {/* Graphique de la marge nette par mois */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Marge nette par mois (TVA déduite)
                </h4>
                <div className="h-[160px] bg-background rounded-lg p-2 border">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyStats}>
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        width={45}
                        tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value)}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(2)} €`, "Marge nette"]}
                        labelStyle={{ fontWeight: "bold" }}
                      />
                      <Bar dataKey="margeNette" radius={[4, 4, 0, 0]}>
                        {monthlyStats.map((entry, index) => (
                          <Cell
                            key={`cell-marge-${index}`}
                            fill={
                              entry.margeNette >= 0
                                ? index === monthlyStats.length - 1
                                  ? "#22c55e"
                                  : "#86efac"
                                : "#ef4444"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 text-center">
                  <span className="text-xs text-muted-foreground">
                    Total:{" "}
                    <span
                      className={`font-semibold ${monthlyStats.reduce((sum, m) => sum + m.margeNette, 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {monthlyStats.reduce((sum, m) => sum + m.margeNette, 0).toFixed(2)} €
                    </span>
                  </span>
                </div>
              </div>

              {/* Top accessoires */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  Top 10 Accessoires commandés
                </h4>

                {topAccessories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée disponible</p>
                ) : (
                  <div className="bg-background rounded-lg border overflow-hidden">
                    {/* Header du tableau */}
                    <div className="grid grid-cols-[1fr_repeat(6,40px)_50px] gap-1 p-2 bg-muted/50 text-xs font-medium border-b">
                      <div>Accessoire</div>
                      {monthLabels.map((label) => (
                        <div key={label} className="text-center">
                          {label.slice(0, 3)}
                        </div>
                      ))}
                      <div className="text-center">Total</div>
                    </div>

                    {/* Lignes du tableau */}
                    {topAccessories.map((acc, index) => (
                      <div
                        key={acc.nom}
                        className={`grid grid-cols-[1fr_repeat(6,40px)_50px] gap-1 p-2 text-xs items-center ${
                          index % 2 === 0 ? "bg-background" : "bg-muted/20"
                        }`}
                      >
                        <div className="truncate">
                          <span className="font-medium">{index + 1}. </span>
                          <span title={acc.nom}>{acc.nom}</span>
                          {acc.marque && <span className="text-muted-foreground ml-1">({acc.marque})</span>}
                        </div>
                        {monthlyStats.map((m) => (
                          <div
                            key={m.month}
                            className={`text-center ${
                              acc.monthlyData[m.month] > 0 ? "font-medium" : "text-muted-foreground"
                            }`}
                          >
                            {acc.monthlyData[m.month] || "-"}
                          </div>
                        ))}
                        <div className="text-center font-bold text-primary">{acc.totalQuantity}</div>
                      </div>
                    ))}

                    {/* Footer avec totaux */}
                    <div className="grid grid-cols-[1fr_repeat(6,40px)_50px] gap-1 p-2 bg-muted/50 text-xs font-medium border-t">
                      <div>Total mensuel</div>
                      {monthlyStats.map((m) => {
                        const monthTotal = topAccessories.reduce(
                          (sum, acc) => sum + (acc.monthlyData[m.month] || 0),
                          0,
                        );
                        return (
                          <div key={m.month} className="text-center">
                            {monthTotal || "-"}
                          </div>
                        );
                      })}
                      <div className="text-center text-primary">
                        {topAccessories.reduce((sum, acc) => sum + acc.totalQuantity, 0)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Panneau principal - Liste des commandes */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Suivi des Commandes</h2>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Réduire" : "Voir les statistiques"}
              >
                {isExpanded ? <ChevronsRight className="h-5 w-5" /> : <BarChart3 className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="shopping" className="flex-1">
            <TabsList className="w-full justify-start px-4 pt-2">
              <TabsTrigger value="shopping" className="flex items-center gap-1">
                <ShoppingCart className="h-4 w-4" />À commander
                {shoppingList.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {shoppingList.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="inprogress" className="flex items-center gap-1">
                <Truck className="h-4 w-4" />
                En cours
                {ordersInProgress.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {ordersInProgress.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="received" className="flex items-center gap-1">
                <PackageCheck className="h-4 w-4" />
                Réceptionnées
                {receivedOrders.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {receivedOrders.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Shopping List Tab */}
            <TabsContent value="shopping" className="flex-1 p-0 m-0 flex flex-col h-[calc(100vh-140px)]">
              <div className="p-4 border-b bg-muted/30 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedItems.size === shoppingList.length && shoppingList.length > 0}
                      onCheckedChange={selectAllShoppingList}
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedItems.size > 0 ? `${selectedItems.size} sélectionné(s)` : "Tout sélectionner"}
                    </span>
                  </div>
                  {selectedItems.size > 0 && (
                    <Button size="sm" onClick={moveSelectedToInProgress}>
                      <Truck className="h-4 w-4 mr-1" />
                      Passer en commande
                    </Button>
                  )}
                </div>
              </div>
              <ScrollArea className="flex-1">
                {isLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Chargement...</div>
                ) : !hasValidScenarios ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="font-medium mb-2">Aucun scénario validé</p>
                    <p className="text-sm">Verrouillez un scénario principal pour voir les articles à commander</p>
                  </div>
                ) : shoppingList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Aucun article à commander</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    {shoppingList.map((item) => (
                      <Card key={item.id} className="p-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleSelectItem(item.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{item.nom_accessoire}</span>
                              <Badge variant="outline" className="text-xs">
                                x{item.quantite}
                              </Badge>
                            </div>
                            {item.marque && <p className="text-xs text-muted-foreground">{item.marque}</p>}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {item.project_name}
                              </Badge>
                              {item.fournisseur && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {item.fournisseur}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{(item.prix * item.quantite).toFixed(2)} €</p>
                            <p className="text-xs text-muted-foreground">{item.prix.toFixed(2)} €/u</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {shoppingList.length > 0 && (
                <div className="p-4 border-t bg-muted/30 flex-shrink-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total à commander</span>
                    <span className="font-bold text-lg">
                      {shoppingList.reduce((sum, item) => sum + item.prix * item.quantite, 0).toFixed(2)} €
                    </span>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Orders In Progress Tab */}
            <TabsContent value="inprogress" className="flex-1 p-0 m-0 flex flex-col h-[calc(100vh-140px)]">
              <ScrollArea className="flex-1">
                {isLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Chargement...</div>
                ) : !hasValidScenarios ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Truck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="font-medium mb-2">Aucun scénario validé</p>
                    <p className="text-sm">Verrouillez un scénario principal pour voir les commandes</p>
                  </div>
                ) : ordersInProgress.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Truck className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Aucune commande en cours</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    {Object.entries(groupBySupplier(ordersInProgress)).map(([supplier, items]) => (
                      <div key={supplier} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          {supplier}
                          <Badge variant="outline">{items.length}</Badge>
                        </div>
                        {items.map((item) => (
                          <Card key={item.id} className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium truncate">{item.nom_accessoire}</span>
                                  <Badge variant="outline" className="text-xs">
                                    x{item.quantite}
                                  </Badge>
                                </div>
                                {item.marque && <p className="text-xs text-muted-foreground">{item.marque}</p>}
                                <Badge variant="secondary" className="text-xs mt-1">
                                  {item.project_name}
                                </Badge>
                                <div className="flex items-center gap-2 mt-2">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <Input
                                    type="date"
                                    className="h-7 text-xs w-36"
                                    value={item.expected_delivery_date || ""}
                                    onChange={(e) => updateDeliveryDate(item.id, e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <p className="font-medium">{(item.prix * item.quantite).toFixed(2)} €</p>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-muted-foreground"
                                    onClick={() => updateOrderStatus(item.id, "commande")}
                                    title="Remettre à commander"
                                  >
                                    <Undo2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => updateOrderStatus(item.id, "livre")}
                                  >
                                    <PackageCheck className="h-3 w-3 mr-1" />
                                    Réceptionner
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {ordersInProgress.length > 0 && (
                <div className="p-4 border-t bg-orange-50/50 flex-shrink-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total en cours</span>
                    <span className="font-bold text-lg text-orange-600">
                      {ordersInProgress.reduce((sum, item) => sum + item.prix * item.quantite, 0).toFixed(2)} €
                    </span>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Received Orders Tab */}
            <TabsContent value="received" className="flex-1 p-0 m-0 flex flex-col h-[calc(100vh-140px)]">
              <ScrollArea className="flex-1">
                {isLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Chargement...</div>
                ) : !hasValidScenarios ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <PackageCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="font-medium mb-2">Aucun scénario validé</p>
                    <p className="text-sm">Verrouillez un scénario principal pour voir les réceptions</p>
                  </div>
                ) : receivedOrders.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <PackageCheck className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Aucune commande réceptionnée</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    {Object.entries(groupBySupplier(receivedOrders)).map(([supplier, items]) => (
                      <div key={supplier} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          {supplier}
                          <Badge variant="outline">{items.length}</Badge>
                        </div>
                        {items.map((item) => (
                          <Card key={item.id} className="p-3 bg-green-50/50 border-green-200">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <PackageCheck className="h-4 w-4 text-green-600" />
                                  <span className="font-medium truncate">{item.nom_accessoire}</span>
                                  <Badge variant="outline" className="text-xs">
                                    x{item.quantite}
                                  </Badge>
                                </div>
                                {item.marque && <p className="text-xs text-muted-foreground ml-6">{item.marque}</p>}
                                <div className="flex items-center gap-2 ml-6 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {item.project_name}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(item.date_achat), "dd MMM yyyy", { locale: fr })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <p className="font-medium">{(item.prix * item.quantite).toFixed(2)} €</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-xs text-muted-foreground hover:text-orange-600"
                                  onClick={() => updateOrderStatus(item.id, "en_livraison")}
                                  title="Remettre en cours de livraison"
                                >
                                  <Undo2 className="h-3 w-3 mr-1" />
                                  Annuler
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {receivedOrders.length > 0 && (
                <div className="p-4 border-t bg-green-50/50 flex-shrink-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total réceptionné</span>
                    <span className="font-bold text-lg text-green-600">
                      {receivedOrders.reduce((sum, item) => sum + item.prix * item.quantite, 0).toFixed(2)} €
                    </span>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default OrderTrackingSidebar;
