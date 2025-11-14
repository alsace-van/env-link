import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { useCart as useCartHook, CartItem } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface CartContextType {
  cartItems: CartItem[];
  loading: boolean;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (productId: string, price: number, quantity?: number, configuration?: any) => Promise<boolean>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  getTotalPrice: () => number;
  getTotalItems: () => number;
  refresh: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const cart = useCartHook(user?.id);

  const value: CartContextType = {
    cartItems: cart.cartItems,
    loading: cart.loading,
    cartOpen,
    setCartOpen,
    addToCart: cart.addToCart,
    updateQuantity: cart.updateQuantity,
    removeFromCart: cart.removeFromCart,
    clearCart: cart.clearCart,
    getTotalPrice: cart.getTotalPrice,
    getTotalItems: cart.getTotalItems,
    refresh: cart.refresh,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCartContext = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCartContext must be used within a CartProvider");
  }
  return context;
};
