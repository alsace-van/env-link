import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  configuration: any;
  price_at_addition: number;
  product?: {
    nom: string;
    image_url?: string;
    product_type: string;
  };
}

export const useCart = (userId?: string) => {
  const [cartId, setCartId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (userId) {
      loadCart();
    }
  }, [userId]);

  const loadCart = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get or create cart
      let { data: cart } = await supabase
        .from("carts" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!cart) {
        const { data: newCart } = await supabase
          .from("carts" as any)
          .insert({ user_id: user.id })
          .select("id")
          .single();
        cart = newCart;
      }

      if (cart && 'id' in cart) {
        setCartId(cart.id as string);
        await loadCartItems(cart.id as string);
      }
    } catch (error) {
      console.error("Error loading cart:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCartItems = async (id: string) => {
    const { data } = await supabase
      .from("cart_items" as any)
      .select(`
        *,
        product:shop_products(nom, image_url, product_type)
      `)
      .eq("cart_id", id);

    if (data) {
      setItems(data as any);
    }
  };

  const addToCart = async (productId: string, quantity: number, configuration: any, price: number) => {
    if (!cartId) {
      toast.error("Panier non initialisé");
      return;
    }

    try {
      // Check if item already exists
      const existingItem = items.find(
        (item) => item.product_id === productId && 
        JSON.stringify(item.configuration) === JSON.stringify(configuration)
      );

      if (existingItem) {
        await updateQuantity(existingItem.id, existingItem.quantity + quantity);
      } else {
        const { error } = await supabase
          .from("cart_items" as any)
          .insert({
            cart_id: cartId,
            product_id: productId,
            quantity,
            configuration,
            price_at_addition: price,
          });

        if (error) throw error;
        await loadCartItems(cartId);
        toast.success("Ajouté au panier");
        setIsOpen(true);
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      toast.error("Erreur lors de l'ajout au panier");
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeItem(itemId);
      return;
    }

    try {
      const { error } = await supabase
        .from("cart_items" as any)
        .update({ quantity })
        .eq("id", itemId);

      if (error) throw error;
      if (cartId) await loadCartItems(cartId);
    } catch (error) {
      console.error("Error updating quantity:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("cart_items" as any)
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      if (cartId) await loadCartItems(cartId);
      toast.success("Article retiré du panier");
    } catch (error) {
      console.error("Error removing item:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const clearCart = async () => {
    if (!cartId) return;

    try {
      const { error } = await supabase
        .from("cart_items" as any)
        .delete()
        .eq("cart_id", cartId);

      if (error) throw error;
      setItems([]);
      toast.success("Panier vidé");
    } catch (error) {
      console.error("Error clearing cart:", error);
      toast.error("Erreur lors du vidage du panier");
    }
  };

  const total = items.reduce((sum, item) => sum + item.price_at_addition * item.quantity, 0);

  return {
    items,
    loading,
    isOpen,
    setIsOpen,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    total,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
};
