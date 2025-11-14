import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";
import logo from "@/assets/logo.png";

interface Order {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  shipping_cost: number;
  order_items: Array<{
    quantity: number;
    shop_products: {
      name: string;
    };
  }>;
}

const OrdersListPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUserAndOrders();
  }, []);

  const loadUserAndOrders = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUser(user);

    if (!user) {
      navigate("/auth");
      return;
    }

    await loadOrders(user.id);
  };

  const loadOrders = async (userId: string) => {
    setLoading(true);

    try {
      // Charger le customer_id de l'utilisateur
      const { data: customer } = await supabase
        .from("shop_customers")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!customer) {
        setLoading(false);
        return;
      }

      // Charger les commandes avec les articles
      const { data, error } = await supabase
        .from("shop_orders")
        .select(
          `
          id,
          created_at,
          status,
          total_amount,
          shipping_cost,
          order_items:shop_order_items(
            quantity,
            shop_products(name)
          )
        `,
        )
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des commandes:", error);
      toast.error("Erreur lors du chargement des commandes");
    } finally {
      setLoading(false);
    }
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

  const getTotalItems = (order: Order) => {
    return order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Logo" className="h-10" />
              <h1 className="text-xl font-bold">Mes Commandes</h1>
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
            <Button variant="ghost" size="icon" onClick={() => navigate("/shop")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Logo" className="h-10" />
            <h1 className="text-xl font-bold">Mes Commandes</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {orders.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">Aucune commande</h2>
              <p className="text-muted-foreground mb-6">Vous n'avez pas encore passé de commande</p>
              <Button onClick={() => navigate("/shop")}>Découvrir la boutique</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold mb-6">Historique de vos commandes</h2>

            {orders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">Commande #{order.id.slice(0, 8)}</CardTitle>
                      <CardDescription>
                        Passée le {new Date(order.created_at).toLocaleDateString("fr-FR")} - {getTotalItems(order)} article
                        {getTotalItems(order) > 1 ? "s" : ""}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(order.status)}>{getStatusLabel(order.status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Articles</div>
                      <div className="space-y-1">
                        {order.order_items?.slice(0, 2).map((item, idx) => (
                          <div key={idx} className="text-sm">
                            {item.quantity}x {item.shop_products?.name}
                          </div>
                        ))}
                        {order.order_items && order.order_items.length > 2 && (
                          <div className="text-sm text-muted-foreground">
                            et {order.order_items.length - 2} autre{order.order_items.length - 2 > 1 ? "s" : ""}...
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div>
                        <div className="text-sm text-muted-foreground">Total</div>
                        <div className="text-2xl font-bold text-primary">{order.total_amount.toFixed(2)} €</div>
                      </div>
                      <Button size="sm" onClick={() => navigate(`/orders/${order.id}`)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Voir les détails
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default OrdersListPage;
