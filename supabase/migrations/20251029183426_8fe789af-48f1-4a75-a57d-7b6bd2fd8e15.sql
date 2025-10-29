-- Ajouter les champs de promotion dans shop_products
ALTER TABLE public.shop_products
ADD COLUMN IF NOT EXISTS promo_price NUMERIC,
ADD COLUMN IF NOT EXISTS promo_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS promo_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS promo_active BOOLEAN DEFAULT false;

-- Créer la table pour les prix dégressifs
CREATE TABLE IF NOT EXISTS public.product_tiered_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL CHECK (min_quantity > 0),
  discount_percent NUMERIC NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, min_quantity)
);

-- Activer RLS sur la table
ALTER TABLE public.product_tiered_pricing ENABLE ROW LEVEL SECURITY;

-- Policies pour product_tiered_pricing
CREATE POLICY "Users can view tiered pricing for their products"
  ON public.product_tiered_pricing
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_products
      WHERE shop_products.id = product_tiered_pricing.product_id
      AND shop_products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create tiered pricing for their products"
  ON public.product_tiered_pricing
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shop_products
      WHERE shop_products.id = product_tiered_pricing.product_id
      AND shop_products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tiered pricing of their products"
  ON public.product_tiered_pricing
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_products
      WHERE shop_products.id = product_tiered_pricing.product_id
      AND shop_products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tiered pricing of their products"
  ON public.product_tiered_pricing
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_products
      WHERE shop_products.id = product_tiered_pricing.product_id
      AND shop_products.user_id = auth.uid()
    )
  );

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_product_tiered_pricing_updated_at
  BEFORE UPDATE ON public.product_tiered_pricing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index pour améliorer les performances
CREATE INDEX idx_product_tiered_pricing_product_id ON public.product_tiered_pricing(product_id);

-- Fonction pour calculer le prix avec réduction dégressive
CREATE OR REPLACE FUNCTION public.calculate_tiered_price(
  p_product_id UUID,
  p_quantity INTEGER,
  p_base_price NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_discount_percent NUMERIC := 0;
BEGIN
  -- Trouver la plus grande réduction applicable
  SELECT discount_percent INTO v_discount_percent
  FROM public.product_tiered_pricing
  WHERE product_id = p_product_id
    AND min_quantity <= p_quantity
  ORDER BY min_quantity DESC
  LIMIT 1;
  
  -- Appliquer la réduction
  IF v_discount_percent IS NOT NULL AND v_discount_percent > 0 THEN
    RETURN p_base_price * (1 - v_discount_percent / 100);
  END IF;
  
  RETURN p_base_price;
END;
$$;