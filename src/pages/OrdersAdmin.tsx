import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Package, Eye, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";
import logo from "@/assets/logo.png";

interface Order {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  shop_customers: {
    company_name?: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  _count?: {
    items: number;
  };
}

const OrdersAdmin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customerFilter = searchParams.get("customer");

  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [customerFilter]);

  useEffect(() => {
    filterOrders();
  }, [searchQuery, statusFilter, orders]);

  const loadOrders = async () => {
    setLoading(true);

    try {
      let query = supabase
        .from("shop_orders")
        .select(
          `
          *,
          shop_customers(
            company_name,
            first_name,
            last_name,
            email
          )
        `
        )
        .order("created_at", { ascending: false });

      // Filtrer par client si spécifié
      if (customerFilter) {
        query = query.eq("customer_id", customerFilter);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) throw ordersError;

      // Pour chaque commande, compter le nombre d'articles
      const ordersWithCount = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { count } = await supabase
            .from("shop_order_items")
            .select("*", { count: "exact", head: true })
            .eq("order_id", order.id);

          return {
            ...order,
            _count: {
              items: count || 0,
            },
          };
        })
      );

      setOrders(ordersWithCount as Order[]);
    } catch (error) {
      console.error("Erreur lors du chargement des commandes:", error);
      toast.error("Erreur lors du chargement des commandes");
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    // Filtre par statut
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.id.toLowerCase().includes(query) ||
          order.shop_customers.email.toLowerCase().includes(query) ||
          order.shop_customers.first_name.toLowerCase().includes(query) ||
          order.shop_customers.last_name.toLowerCase().includes(query) ||
          order.shop_customers.company_name?.toLowerCase().includes(query)
      );
    }

    setFilteredOrders(filtered);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "En attente",
      confirmed: "Confirmée",
      processing: "En préparation",
      shipped: "Expédiée",
      delivered: "Livrée",
      cancelled: "Annulée",
    };
    return labels[status] || status;
  };

  const getStatusVariant = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      confirmed: "default",
      processing: "default",
      shipped: "default",
      delivered: "outline",
      cancelled: "destructive",
    };
    return variants[status] || "default";
  };

  const getCustomerName = (order: Order) => {
    if (order.shop_customers.company_name) {
      return `${order.shop_customers.company_name} (${order.shop_customers.first_name} ${order.shop_customers.last_name})`;
    }
    return `${order.shop_customers.first_name} ${order.shop_customers.last_name}`;
  };

  const handleChangeStatus = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return;

    setUpdating(true);

    try {
      const { error } = await supabase
        .from("shop_orders")
        .update({ status: newStatus })
        .eq("id", selectedOrder.id);

      if (error) throw error;

      toast.success("Statut mis à jour");
      setStatusDialogOpen(false);
      await loadOrders();
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      toast.error("Erreur lors de la mise à jour du statut");
    } finally {
      setUpdating(false);
    }
  };

  const getOrderStats = () => {
    const stats = {
      total: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      processing: orders.filter((o) => o.status === "processing" || o.status === "confirmed").length,
      shipped: orders.filter((o) => o.status === "shipped").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
      totalRevenue: orders.reduce((sum, o) => sum + o.total_amount, 0),
    };
    return stats;
  };

  const stats = getOrderStats();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Logo" className="h-10" />
              <h1 className="text-xl font-bold">Gestion des Commandes</h1>
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">Chargement des commandes...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Logo" className="h-10" />
            <h1 className="text-xl font-bold">Gestion des Commandes</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Statistiques */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total commandes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>En attente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>En traitement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.processing}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Expédiées</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.shipped}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Chiffre d'affaires</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRevenue.toFixed(2)} €</div>
            </CardContent>
          </Card>
        </div>

        {/* Liste des commandes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Commandes
                </CardTitle>
                <CardDescription>Gérez toutes les commandes de la boutique</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="confirmed">Confirmée</SelectItem>
                    <SelectItem value="processing">En préparation</SelectItem>
                    <SelectItem value="shipped">Expédiée</SelectItem>
                    <SelectItem value="delivered">Livrée</SelectItem>
                    <SelectItem value="cancelled">Annulée</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={loadOrders}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== "all" ? "Aucune commande trouvée" : "Aucune commande enregistrée"}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Commande</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Articles</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-sm">#{order.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-semibold">{getCustomerName(order)}</div>
                            <div className="text-sm text-muted-foreground">{order.shop_customers.email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(order.created_at).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{order._count?.items || 0}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {order.total_amount.toFixed(2)} €
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(order.status)}>{getStatusLabel(order.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/admin/orders/${order.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Voir
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleChangeStatus(order)}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Statut
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Dialog de changement de statut */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le statut de la commande</DialogTitle>
            <DialogDescription>
              Commande #{selectedOrder?.id.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="confirmed">Confirmée</SelectItem>
                <SelectItem value="processing">En préparation</SelectItem>
                <SelectItem value="shipped">Expédiée</SelectItem>
                <SelectItem value="delivered">Livrée</SelectItem>
                <SelectItem value="cancelled">Annulée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateStatus} disabled={updating}>
              {updating ? "Mise à jour..." : "Mettre à jour"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersAdmin;
