-- Créer la table pour les paniers
CREATE TABLE IF NOT EXISTS public.carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Créer la table pour les articles du panier
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  configuration JSONB,
  price_at_addition NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cart_id, product_id, configuration)
);

-- Activer RLS sur les tables
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Policies pour la table carts
CREATE POLICY "Users can view their own cart"
  ON public.carts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cart"
  ON public.carts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cart"
  ON public.carts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cart"
  ON public.carts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policies pour la table cart_items
CREATE POLICY "Users can view their own cart items"
  ON public.cart_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
      AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create items in their own cart"
  ON public.cart_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
      AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items in their own cart"
  ON public.cart_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
      AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items from their own cart"
  ON public.cart_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
      AND carts.user_id = auth.uid()
    )
  );

-- Trigger pour mettre à jour updated_at sur carts
CREATE TRIGGER update_carts_updated_at
  BEFORE UPDATE ON public.carts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger pour mettre à jour updated_at sur cart_items
CREATE TRIGGER update_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index pour améliorer les performances
CREATE INDEX idx_carts_user_id ON public.carts(user_id);
CREATE INDEX idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON public.cart_items(product_id);