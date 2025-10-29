import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  configuration?: any;
  price_at_addition: number;
  product?: {
    name: string;
    type: string;
  };
}

export const useCart = (userId: string | undefined) => {
  const [cartId, setCartId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadCart();
    }
  }, [userId]);

  const loadCart = async () => {
    if (!userId) return;

    setLoading(true);

    // Charger ou créer le panier de l'utilisateur
    let { data: cart, error: cartError } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (cartError && cartError.code === "PGRST116") {
      // Le panier n'existe pas, le créer
      const { data: newCart, error: createError } = await supabase
        .from("carts")
        .insert({ user_id: userId })
        .select("id")
        .single();

      if (createError) {
        console.error("Erreur lors de la création du panier:", createError);
        setLoading(false);
        return;
      }

      cart = newCart;
    } else if (cartError) {
      console.error("Erreur lors du chargement du panier:", cartError);
      setLoading(false);
      return;
    }

    if (cart) {
      setCartId(cart.id);
      await loadCartItems(cart.id);
    }

    setLoading(false);
  };

  const loadCartItems = async (cartId: string) => {
    const { data, error } = await supabase
      .from("cart_items")
      .select(`
        id,
        product_id,
        quantity,
        configuration,
        price_at_addition,
        product:shop_products(name, type)
      `)
      .eq("cart_id", cartId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement des articles:", error);
    } else {
      setCartItems(data || []);
    }
  };

  const addToCart = async (
    productId: string,
    price: number,
    quantity: number = 1,
    configuration?: any
  ) => {
    if (!cartId) {
      toast.error("Panier non initialisé");
      return false;
    }

    try {
      // Vérifier si l'article existe déjà avec la même configuration
      const existingItem = cartItems.find(
        (item) =>
          item.product_id === productId &&
          JSON.stringify(item.configuration) === JSON.stringify(configuration)
      );

      if (existingItem) {
        // Mettre à jour la quantité
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existingItem.quantity + quantity })
          .eq("id", existingItem.id);

        if (error) throw error;
      } else {
        // Ajouter un nouvel article
        const { error } = await supabase.from("cart_items").insert({
          cart_id: cartId,
          product_id: productId,
          quantity,
          configuration,
          price_at_addition: price,
        });

        if (error) throw error;
      }

      await loadCartItems(cartId);
      toast.success("Article ajouté au panier");
      return true;
    } catch (error) {
      console.error("Erreur lors de l'ajout au panier:", error);
      toast.error("Erreur lors de l'ajout au panier");
      return false;
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) {
      await removeFromCart(itemId);
      return;
    }

    try {
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity })
        .eq("id", itemId);

      if (error) throw error;

      if (cartId) await loadCartItems(cartId);
      toast.success("Quantité mise à jour");
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      if (cartId) await loadCartItems(cartId);
      toast.success("Article retiré du panier");
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const clearCart = async () => {
    if (!cartId) return;

    try {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("cart_id", cartId);

      if (error) throw error;

      setCartItems([]);
      toast.success("Panier vidé");
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du vidage du panier");
    }
  };

  const getTotalPrice = () => {
    return cartItems.reduce(
      (total, item) => total + item.price_at_addition * item.quantity,
      0
    );
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  return {
    cartItems,
    loading,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getTotalPrice,
    getTotalItems,
    refresh: () => cartId && loadCartItems(cartId),
  };
};
