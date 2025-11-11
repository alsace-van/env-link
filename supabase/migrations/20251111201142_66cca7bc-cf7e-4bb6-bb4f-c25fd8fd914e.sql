-- Table pour les paliers de frais d'expédition
CREATE TABLE IF NOT EXISTS public.shipping_fee_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipping_fee_id UUID NOT NULL REFERENCES public.shipping_fees(id) ON DELETE CASCADE,
  quantity_from INTEGER NOT NULL,
  quantity_to INTEGER,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.shipping_fee_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view shipping fee tiers" ON public.shipping_fee_tiers;
DROP POLICY IF EXISTS "Admins can manage shipping fee tiers" ON public.shipping_fee_tiers;

CREATE POLICY "Everyone can view shipping fee tiers"
  ON public.shipping_fee_tiers FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage shipping fee tiers"
  ON public.shipping_fee_tiers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Table pour les fournisseurs
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own suppliers" ON public.suppliers;
CREATE POLICY "Users can manage their own suppliers"
  ON public.suppliers FOR ALL
  USING (user_id = auth.uid());