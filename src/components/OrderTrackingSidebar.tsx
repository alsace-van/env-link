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
import { X, ShoppingCart, Truck, PackageCheck, Calendar, Building2, Package, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface OrderItem {
  id: string;
  nom_accessoire: string;
  marque?: string;
  prix: number;
  quantite: number;
  categorie: string;
  fournisseur?: string;
  statut_livraison: "commande" | "en_livraison" | "livre";
  date_achat: string;
  expected_delivery_date?: string;
  project_id: string;
  project_name?: string;
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
    const { data: projects } = await supabase.from("projects").select("id, name").eq("user_id", userData.user.id);

    const projectMap = new Map(projects?.map((p) => [p.id, p.name]) || []);
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

    setIsLoading(false);
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

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className="fixed right-0 top-0 h-full w-[500px] bg-background shadow-xl animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Suivi des Commandes</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
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
          <TabsContent value="shopping" className="flex-1 p-0 m-0">
            <div className="p-4 border-b bg-muted/30">
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
            <ScrollArea className="h-[calc(100vh-200px)]">
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
              <div className="p-4 border-t bg-muted/30">
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
          <TabsContent value="inprogress" className="flex-1 p-0 m-0">
            <ScrollArea className="h-[calc(100vh-160px)]">
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
                        </Card>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Received Orders Tab */}
          <TabsContent value="received" className="flex-1 p-0 m-0">
            <ScrollArea className="h-[calc(100vh-160px)]">
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
                            <div className="text-right">
                              <p className="font-medium">{(item.prix * item.quantite).toFixed(2)} €</p>
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
              <div className="p-4 border-t bg-green-50/50">
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
  );
};

export default OrderTrackingSidebar;
