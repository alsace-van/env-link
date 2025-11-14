import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCartContext } from "@/contexts/CartContext";
import { useShopCustomer } from "@/hooks/useShopCustomer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";
import { CustomerFormDialog } from "@/components/CustomerFormDialog";
import logo from "@/assets/logo.png";

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cartItems, getTotalPrice, clearCart } = useCartContext();
  const [user, setUser] = useState<any>(null);
  const shopCustomer = useShopCustomer(user?.id);
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [shippingCost, setShippingCost] = useState(0);
  const [selectedShippingFee, setSelectedShippingFee] = useState<string | null>(null);
  const [shippingFees, setShippingFees] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadUser();
    loadShippingFees();
  }, []);

  useEffect(() => {
    // Rediriger vers le panier si vide
    if (cartItems.length === 0) {
      navigate("/cart");
    }
  }, [cartItems, navigate]);

  const loadUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUser(user);
  };

  const loadShippingFees = async () => {
    const { data, error } = await supabase
      .from("shipping_fees")
      .select("*")
      .order("fixed_price", { ascending: true });

    if (error) {
      console.error("Erreur chargement frais de port:", error);
    } else {
      setShippingFees(data || []);
      // Sélectionner par défaut le premier frais
      if (data && data.length > 0) {
        setSelectedShippingFee(data[0].id);
        setShippingCost(data[0].fixed_price || 0);
      }
    }
  };

  const handleShippingFeeChange = (feeId: string) => {
    setSelectedShippingFee(feeId);
    const fee = shippingFees.find((f) => f.id === feeId);
    setShippingCost(fee?.fixed_price || 0);
  };

  const handleCustomerFormSubmit = async (customerData: any) => {
    await shopCustomer.updateCustomer(customerData);
    setCustomerFormOpen(false);
  };

  const handlePlaceOrder = async () => {
    if (!shopCustomer.customer) {
      toast.error("Veuillez renseigner vos informations client");
      setCustomerFormOpen(true);
      return;
    }

    if (!selectedShippingFee) {
      toast.error("Veuillez sélectionner un mode de livraison");
      return;
    }

    setProcessing(true);

    try {
      // Créer la commande
      const { data: order, error: orderError } = await supabase
        .from("shop_orders")
        .insert({
          customer_id: shopCustomer.customer.id,
          status: "pending",
          total_amount: getTotalPrice() + shippingCost,
          shipping_cost: shippingCost,
          shipping_fee_id: selectedShippingFee,
          shipping_address: shopCustomer.customer.shipping_same_as_billing
            ? shopCustomer.customer.billing_address
            : shopCustomer.customer.shipping_address,
          shipping_postal_code: shopCustomer.customer.shipping_same_as_billing
            ? shopCustomer.customer.billing_postal_code
            : shopCustomer.customer.shipping_postal_code,
          shipping_city: shopCustomer.customer.shipping_same_as_billing
            ? shopCustomer.customer.billing_city
            : shopCustomer.customer.shipping_city,
          shipping_country: shopCustomer.customer.shipping_same_as_billing
            ? shopCustomer.customer.billing_country
            : shopCustomer.customer.shipping_country,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Ajouter les articles de commande
      const orderItems = cartItems.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.price_at_addition,
        total_price: item.price_at_addition * item.quantity,
        configuration: item.configuration,
      }));

      const { error: itemsError } = await supabase.from("shop_order_items").insert(orderItems);

      if (itemsError) throw itemsError;

      // Vider le panier
      await clearCart();

      toast.success("Commande passée avec succès !");
      navigate(`/orders/${order.id}`);
    } catch (error) {
      console.error("Erreur lors de la commande:", error);
      toast.error("Erreur lors de la création de la commande");
    } finally {
      setProcessing(false);
    }
  };

  const totalWithShipping = getTotalPrice() + shippingCost;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/cart")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Logo" className="h-10" />
            <h1 className="text-xl font-bold">Validation de la commande</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Informations de livraison et paiement */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informations client */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Informations client</CardTitle>
                    <CardDescription>Vérifiez vos coordonnées</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setCustomerFormOpen(true)}>
                    Modifier
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {shopCustomer.customer ? (
                  <div className="space-y-4">
                    <div>
                      <div className="font-semibold mb-1">Facturation</div>
                      <div className="text-sm text-muted-foreground">
                        {shopCustomer.customer.company_name && <p>{shopCustomer.customer.company_name}</p>}
                        <p>
                          {shopCustomer.customer.first_name} {shopCustomer.customer.last_name}
                        </p>
                        <p>{shopCustomer.customer.email}</p>
                        <p>{shopCustomer.customer.phone}</p>
                        <p className="mt-2">
                          {shopCustomer.customer.billing_address}
                          <br />
                          {shopCustomer.customer.billing_postal_code} {shopCustomer.customer.billing_city}
                          <br />
                          {shopCustomer.customer.billing_country}
                        </p>
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold mb-1">Livraison</div>
                      <div className="text-sm text-muted-foreground">
                        {shopCustomer.customer.shipping_same_as_billing ? (
                          <p className="italic">Identique à l'adresse de facturation</p>
                        ) : (
                          <>
                            {shopCustomer.customer.shipping_recipient_name && (
                              <p>{shopCustomer.customer.shipping_recipient_name}</p>
                            )}
                            <p>
                              {shopCustomer.customer.shipping_address}
                              <br />
                              {shopCustomer.customer.shipping_postal_code} {shopCustomer.customer.shipping_city}
                              <br />
                              {shopCustomer.customer.shipping_country}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-4">Aucune information client renseignée</p>
                    <Button onClick={() => setCustomerFormOpen(true)}>Ajouter mes informations</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mode de livraison */}
            <Card>
              <CardHeader>
                <CardTitle>Mode de livraison</CardTitle>
                <CardDescription>Sélectionnez votre mode de livraison préféré</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {shippingFees.map((fee) => (
                    <div
                      key={fee.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedShippingFee === fee.id ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => handleShippingFeeChange(fee.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              selectedShippingFee === fee.id ? "border-primary" : "border-gray-300"
                            }`}
                          >
                            {selectedShippingFee === fee.id && <Check className="h-3 w-3 text-primary" />}
                          </div>
                          <div>
                            <div className="font-semibold">{fee.nom}</div>
                            {fee.description && <div className="text-sm text-muted-foreground">{fee.description}</div>}
                          </div>
                        </div>
                        <div className="font-bold">{fee.fixed_price?.toFixed(2)} €</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Résumé de commande */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Résumé de commande</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sous-total ({cartItems.length} articles)</span>
                    <span className="font-medium">{getTotalPrice().toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Livraison</span>
                    <span className="font-medium">{shippingCost.toFixed(2)} €</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-primary">{totalWithShipping.toFixed(2)} €</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">TVA incluse</p>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handlePlaceOrder}
                  disabled={processing || !shopCustomer.customer || !selectedShippingFee}
                >
                  {processing ? "Traitement..." : "Confirmer la commande"}
                </Button>

                <div className="text-xs text-center text-muted-foreground">
                  En confirmant votre commande, vous acceptez nos conditions générales de vente
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <CustomerFormDialog
        open={customerFormOpen}
        onOpenChange={setCustomerFormOpen}
        onSubmit={handleCustomerFormSubmit}
        initialData={
          shopCustomer.customer
            ? {
                companyName: shopCustomer.customer.company_name,
                firstName: shopCustomer.customer.first_name,
                lastName: shopCustomer.customer.last_name,
                email: shopCustomer.customer.email,
                phone: shopCustomer.customer.phone,
                billingAddress: shopCustomer.customer.billing_address,
                billingPostalCode: shopCustomer.customer.billing_postal_code,
                billingCity: shopCustomer.customer.billing_city,
                billingCountry: shopCustomer.customer.billing_country,
                vatNumber: shopCustomer.customer.vat_number,
                shippingSameAsBilling: shopCustomer.customer.shipping_same_as_billing,
                shippingRecipientName: shopCustomer.customer.shipping_recipient_name,
                shippingAddress: shopCustomer.customer.shipping_address,
                shippingPostalCode: shopCustomer.customer.shipping_postal_code,
                shippingCity: shopCustomer.customer.shipping_city,
                shippingCountry: shopCustomer.customer.shipping_country,
              }
            : undefined
        }
      />
    </div>
  );
};

export default CheckoutPage;
