import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCartContext } from "@/contexts/CartContext";
import UserMenu from "@/components/UserMenu";
import logo from "@/assets/logo.png";

const CartPage = () => {
  const navigate = useNavigate();
  const { cartItems, loading, updateQuantity, removeFromCart, clearCart, getTotalPrice, getTotalItems } =
    useCartContext();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Logo" className="h-10" />
              <h1 className="text-xl font-bold">Mon Panier</h1>
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">Chargement du panier...</div>
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
            <h1 className="text-xl font-bold">Mon Panier</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {cartItems.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">Votre panier est vide</h2>
              <p className="text-muted-foreground mb-6">Ajoutez des produits pour commencer vos achats</p>
              <Button onClick={() => navigate("/shop")}>Continuer mes achats</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Liste des articles */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  Articles ({getTotalItems()} article{getTotalItems() > 1 ? "s" : ""})
                </h2>
                <Button variant="outline" size="sm" onClick={clearCart}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Vider le panier
                </Button>
              </div>

              {cartItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="pt-6">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{item.product?.name}</h3>
                        {item.configuration && (
                          <div className="text-sm text-muted-foreground mb-2">
                            <p>Configuration personnalisée</p>
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 border rounded-md">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-12 text-center font-medium">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Retirer
                          </Button>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground mb-1">Prix unitaire</div>
                        <div className="text-lg font-semibold mb-2">{item.price_at_addition.toFixed(2)} €</div>
                        <div className="text-sm text-muted-foreground mb-1">Total</div>
                        <div className="text-xl font-bold text-primary">
                          {(item.price_at_addition * item.quantity).toFixed(2)} €
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Résumé de la commande */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Résumé de la commande</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sous-total</span>
                      <span className="font-medium">{getTotalPrice().toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Livraison</span>
                      <span className="font-medium">Calculée à l'étape suivante</span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="text-primary">{getTotalPrice().toFixed(2)} €</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">TVA incluse</p>
                    </div>
                  </div>

                  <Button className="w-full" size="lg" onClick={() => navigate("/checkout")}>
                    Passer la commande
                  </Button>

                  <Button variant="outline" className="w-full" onClick={() => navigate("/shop")}>
                    Continuer mes achats
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CartPage;
