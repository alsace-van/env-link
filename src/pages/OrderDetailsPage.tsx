import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Package, MapPin, CreditCard, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";
import logo from "@/assets/logo.png";

interface OrderDetails {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  shipping_cost: number;
  shipping_address: string;
  shipping_postal_code: string;
  shipping_city: string;
  shipping_country: string;
  notes?: string;
  shop_customers: {
    company_name?: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    billing_address: string;
    billing_postal_code: string;
    billing_city: string;
    billing_country: string;
  };
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    configuration?: any;
    shop_products: {
      name: string;
      type: string;
    };
  }>;
  shipping_fees?: {
    nom: string;
    description?: string;
  };
}

const OrderDetailsPage = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      loadOrderDetails(orderId);
    }
  }, [orderId]);

  const loadOrderDetails = async (id: string) => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("shop_orders")
        .select(
          `
          *,
          shop_customers(
            company_name,
            first_name,
            last_name,
            email,
            phone,
            billing_address,
            billing_postal_code,
            billing_city,
            billing_country
          ),
          order_items:shop_order_items(
            id,
            quantity,
            unit_price,
            total_price,
            configuration,
            shop_products(name, type)
          ),
          shipping_fees(nom, description)
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;

      setOrder(data as OrderDetails);
    } catch (error) {
      console.error("Erreur lors du chargement de la commande:", error);
      toast.error("Erreur lors du chargement de la commande");
      navigate("/orders");
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

  const getStatusSteps = () => {
    const steps = [
      { key: "pending", label: "Commandé", icon: Package },
      { key: "confirmed", label: "Confirmée", icon: CreditCard },
      { key: "processing", label: "Préparation", icon: Package },
      { key: "shipped", label: "Expédiée", icon: Truck },
      { key: "delivered", label: "Livrée", icon: MapPin },
    ];

    const statusOrder = ["pending", "confirmed", "processing", "shipped", "delivered"];
    const currentIndex = statusOrder.indexOf(order?.status || "pending");

    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
      current: index === currentIndex,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Logo" className="h-10" />
              <h1 className="text-xl font-bold">Détails de la commande</h1>
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">Chargement...</div>
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Logo" className="h-10" />
              <h1 className="text-xl font-bold">Commande introuvable</h1>
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-4">Cette commande n'existe pas</p>
              <Button onClick={() => navigate("/orders")}>Retour aux commandes</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const statusSteps = getStatusSteps();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Logo" className="h-10" />
            <h1 className="text-xl font-bold">Commande #{order.id.slice(0, 8)}</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* En-tête de commande */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Commande #{order.id.slice(0, 8)}</CardTitle>
                  <CardDescription>Passée le {new Date(order.created_at).toLocaleDateString("fr-FR")}</CardDescription>
                </div>
                <Badge variant={getStatusVariant(order.status)} className="text-sm px-3 py-1">
                  {getStatusLabel(order.status)}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Suivi de commande */}
          {order.status !== "cancelled" && (
            <Card>
              <CardHeader>
                <CardTitle>Suivi de commande</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  {statusSteps.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.key} className="flex items-center">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              step.completed ? "bg-primary text-primary-foreground" : "bg-gray-200 text-gray-500"
                            }`}
                          >
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className={`mt-2 text-xs font-medium ${step.completed ? "text-primary" : "text-gray-500"}`}>
                            {step.label}
                          </div>
                        </div>
                        {index < statusSteps.length - 1 && (
                          <div className={`flex-1 h-1 mx-4 ${step.completed ? "bg-primary" : "bg-gray-200"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Articles commandés */}
          <Card>
            <CardHeader>
              <CardTitle>Articles commandés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.order_items.map((item) => (
                  <div key={item.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold">{item.shop_products.name}</div>
                        {item.configuration && (
                          <div className="text-sm text-muted-foreground mt-1">Configuration personnalisée</div>
                        )}
                        <div className="text-sm text-muted-foreground mt-1">Quantité : {item.quantity}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{item.total_price.toFixed(2)} €</div>
                        <div className="text-sm text-muted-foreground">{item.unit_price.toFixed(2)} € / unité</div>
                      </div>
                    </div>
                    <Separator className="mt-4" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Adresses */}
            <Card>
              <CardHeader>
                <CardTitle>Informations de livraison</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="font-semibold mb-2">Adresse de livraison</div>
                  <div className="text-sm text-muted-foreground">
                    <p>{order.shipping_address}</p>
                    <p>
                      {order.shipping_postal_code} {order.shipping_city}
                    </p>
                    <p>{order.shipping_country}</p>
                  </div>
                </div>
                {order.shipping_fees && (
                  <div>
                    <div className="font-semibold mb-2">Mode de livraison</div>
                    <div className="text-sm text-muted-foreground">
                      <p>{order.shipping_fees.nom}</p>
                      {order.shipping_fees.description && <p className="text-xs">{order.shipping_fees.description}</p>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Résumé */}
            <Card>
              <CardHeader>
                <CardTitle>Résumé de la commande</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span>{(order.total_amount - order.shipping_cost).toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Livraison</span>
                    <span>{order.shipping_cost.toFixed(2)} €</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">{order.total_amount.toFixed(2)} €</span>
                  </div>
                  <p className="text-xs text-muted-foreground">TVA incluse</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Informations client */}
          <Card>
            <CardHeader>
              <CardTitle>Informations client</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="font-semibold mb-2">Contact</div>
                  <div className="text-sm text-muted-foreground">
                    {order.shop_customers.company_name && <p>{order.shop_customers.company_name}</p>}
                    <p>
                      {order.shop_customers.first_name} {order.shop_customers.last_name}
                    </p>
                    <p>{order.shop_customers.email}</p>
                    <p>{order.shop_customers.phone}</p>
                  </div>
                </div>
                <div>
                  <div className="font-semibold mb-2">Adresse de facturation</div>
                  <div className="text-sm text-muted-foreground">
                    <p>{order.shop_customers.billing_address}</p>
                    <p>
                      {order.shop_customers.billing_postal_code} {order.shop_customers.billing_city}
                    </p>
                    <p>{order.shop_customers.billing_country}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default OrderDetailsPage;
