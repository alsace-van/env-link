import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  configuration: any;
  price: number;
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

  useEffect(() => {
    if (userId) {
      loadCart();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const loadCart = async () => {
    try {
      if (!userId) return;

      const { data: existingCart } = await supabase
        .from("carts" as any)
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      let currentCartId = (existingCart as any)?.id;

      if (!currentCartId) {
        const { data: newCart } = await supabase
          .from("carts" as any)
          .insert({ user_id: userId })
          .select()
          .single();

        currentCartId = (newCart as any)?.id;
      }

      if (currentCartId) {
        setCartId(currentCartId);
        await loadCartItems(currentCartId);
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
      setItems(data.map((item: any) => ({
        ...item,
        price: item.price_at_addition
      })));
    }
  };

  const addToCart = async (
    productId: string,
    price: number,
    quantity: number = 1,
    configuration: any = null
  ): Promise<boolean> => {
    if (!cartId) {
      toast.error("Panier non initialisé");
      return false;
    }

    try {
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
      }

      toast.success("Ajouté au panier");
      return true;
    } catch (error) {
      console.error("Error adding to cart:", error);
      toast.error("Erreur lors de l'ajout au panier");
      return false;
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(itemId);
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
      toast.success("Produit retiré du panier");
    } catch (error) {
      console.error("Error removing from cart:", error);
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

  const getTotalPrice = () => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const refresh = () => {
    if (cartId) {
      loadCartItems(cartId);
    }
  };

  return {
    cartItems: items,
    loading,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getTotalPrice,
    getTotalItems,
    refresh,
  };
};
