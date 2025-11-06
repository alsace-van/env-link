import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingCart, Package } from "lucide-react";
import { toast } from "sonner";

interface ShippingFeeInfo {
  id: string;
  nom: string;
  type: 'fixed' | 'variable' | 'free' | 'pickup';
  fixed_price: number | null;
  visible_boutique: boolean;
  tiers?: Array<{
    quantity_from: number;
    quantity_to: number | null;
    total_price: number;
  }>;
}

interface Accessory {
  id: string;
  nom: string;
  marque: string | null;
  prix_vente: number;
  description: string | null;
  image_url: string | null;
  shipping_fee?: ShippingFeeInfo | null;
}

interface CartItem {
  accessory: Accessory;
  quantity: number;
  shippingFee: number;
}

interface AccessoiresShopListProps {
  projectId: string;
  onAddToProject: (items: CartItem[]) => void;
}

export const AccessoiresShopList = ({ projectId, onAddToProject }: AccessoiresShopListProps) => {
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [filteredAccessories, setFilteredAccessories] = useState<Accessory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    loadAccessories();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredAccessories(accessories);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredAccessories(
        accessories.filter(
          (acc) =>
            acc.nom.toLowerCase().includes(term) ||
            acc.marque?.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, accessories]);

  const loadAccessories = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: accessoriesData, error: accessoriesError } = await supabase
        .from("accessories_catalog")
        .select("*")
        .eq("user_id", user.id)
        .eq("available_in_shop", true)
        .order("nom");

      if (accessoriesError) throw accessoriesError;

      const accessories = (accessoriesData || []).map(acc => ({
        ...acc,
        prix_vente: acc.prix_vente_ttc || 0,
        shipping_fee: null,
      }));

      setAccessories(accessories);
      setFilteredAccessories(accessories);
    } catch (error: any) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des accessoires");
    } finally {
      setLoading(false);
    }
  };

  const calculateShippingFee = (accessory: Accessory, quantity: number): number => {
    if (!accessory.shipping_fee) return 0;

    const fee = accessory.shipping_fee;

    switch (fee.type) {
      case 'free':
      case 'pickup':
        return 0;
      
      case 'fixed':
        return fee.fixed_price || 0;
      
      case 'variable':
        if (!fee.tiers || fee.tiers.length === 0) return 0;
        
        const applicableTier = fee.tiers.find(
          (tier) =>
            quantity >= tier.quantity_from &&
            (tier.quantity_to === null || quantity <= tier.quantity_to)
        );
        
        return applicableTier ? applicableTier.total_price : 0;
      
      default:
        return 0;
    }
  };

  const toggleCart = (accessoryId: string) => {
    const newCart = new Map(cart);
    if (newCart.has(accessoryId)) {
      newCart.delete(accessoryId);
    } else {
      newCart.set(accessoryId, 1);
    }
    setCart(newCart);
  };

  const updateQuantity = (accessoryId: string, quantity: number) => {
    if (quantity < 1) return;
    const newCart = new Map(cart);
    newCart.set(accessoryId, quantity);
    setCart(newCart);
  };

  const getCartItems = (): CartItem[] => {
    return Array.from(cart.entries()).map(([accessoryId, quantity]) => {
      const accessory = accessories.find((a) => a.id === accessoryId);
      if (!accessory) return null;
      
      return {
        accessory,
        quantity,
        shippingFee: calculateShippingFee(accessory, quantity),
      };
    }).filter((item): item is CartItem => item !== null);
  };

  const getTotalPrice = (): number => {
    return getCartItems().reduce(
      (sum, item) => sum + (item.accessory.prix_vente * item.quantity) + item.shippingFee,
      0
    );
  };

  const handleAddToProject = () => {
    const items = getCartItems();
    if (items.length === 0) {
      toast.error("Veuillez sélectionner au moins un accessoire");
      return;
    }

    onAddToProject(items);
    setCart(new Map());
    toast.success(`${items.length} article(s) ajouté(s) au projet`);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Chargement de la boutique...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Boutique d'accessoires
              </CardTitle>
              <CardDescription>
                Sélectionnez les accessoires à ajouter au projet
              </CardDescription>
            </div>
            {cart.size > 0 && (
              <Button onClick={handleAddToProject}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Ajouter au projet ({cart.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un accessoire..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredAccessories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Aucun accessoire trouvé" : "Aucun accessoire disponible"}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAccessories.map((accessory) => {
                  const isInCart = cart.has(accessory.id);
                  const quantity = cart.get(accessory.id) || 1;
                  const shippingFee = calculateShippingFee(accessory, quantity);
                  const subtotal = accessory.prix_vente * quantity;
                  const total = subtotal + shippingFee;

                  return (
                    <div
                      key={accessory.id}
                      className={`border rounded-lg p-4 ${
                        isInCart ? "bg-primary/5 border-primary" : ""
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <Checkbox
                          checked={isInCart}
                          onCheckedChange={() => toggleCart(accessory.id)}
                        />
                        
                        <div className="flex-1 space-y-2">
                          <div>
                            <div className="font-medium">{accessory.nom}</div>
                            {accessory.marque && (
                              <div className="text-sm text-muted-foreground">
                                {accessory.marque}
                              </div>
                            )}
                          </div>

                          {isInCart && (
                            <div className="flex items-center gap-2">
                              <label className="text-sm">Quantité:</label>
                              <Input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) =>
                                  updateQuantity(accessory.id, parseInt(e.target.value) || 1)
                                }
                                className="w-20"
                              />
                            </div>
                          )}

                          {accessory.shipping_fee && isInCart && (
                            <div className="text-sm space-y-1">
                              <div className="flex items-center gap-2">
                                <Package className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  {accessory.shipping_fee.nom}
                                  {accessory.shipping_fee.type === 'free' && ' (Gratuit)'}
                                  {accessory.shipping_fee.type === 'pickup' && ' (Retrait atelier)'}
                                  {shippingFee > 0 && ` : ${shippingFee.toFixed(2)} €`}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="text-right space-y-1">
                          <div className="font-medium">
                            {accessory.prix_vente.toFixed(2)} €
                          </div>
                          {isInCart && quantity > 1 && (
                            <div className="text-sm text-muted-foreground">
                              × {quantity} = {subtotal.toFixed(2)} €
                            </div>
                          )}
                          {isInCart && shippingFee > 0 && (
                            <div className="text-sm text-muted-foreground">
                              + {shippingFee.toFixed(2)} € frais
                            </div>
                          )}
                          {isInCart && (
                            <div className="text-sm font-medium text-primary">
                              Total: {total.toFixed(2)} €
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {cart.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Récapitulatif</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getCartItems().map((item) => (
                <div key={item.accessory.id} className="flex justify-between text-sm">
                  <span>
                    {item.accessory.nom} × {item.quantity}
                    {item.shippingFee > 0 && ` (+ ${item.shippingFee.toFixed(2)} € frais)`}
                  </span>
                  <span className="font-medium">
                    {((item.accessory.prix_vente * item.quantity) + item.shippingFee).toFixed(2)} €
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Total</span>
                <span className="text-primary">{getTotalPrice().toFixed(2)} €</span>
              </div>
            </div>
            <Button onClick={handleAddToProject} className="w-full mt-4">
              Ajouter au projet
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
