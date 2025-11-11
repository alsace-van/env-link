-- Table pour l'historique de connexion
CREATE TABLE IF NOT EXISTS public.user_logins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  login_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_logins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all logins" ON public.user_logins;
CREATE POLICY "Admins can view all logins"
  ON public.user_logins FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Table pour les frais d'expédition
CREATE TABLE IF NOT EXISTS public.shipping_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  montant NUMERIC NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.shipping_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view active shipping fees" ON public.shipping_fees;
DROP POLICY IF EXISTS "Admins can manage shipping fees" ON public.shipping_fees;

CREATE POLICY "Everyone can view active shipping fees"
  ON public.shipping_fees FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage shipping fees"
  ON public.shipping_fees FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Table pour associer les frais d'expédition aux accessoires
CREATE TABLE IF NOT EXISTS public.accessory_shipping_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  accessory_id UUID NOT NULL REFERENCES public.accessories_catalog(id) ON DELETE CASCADE,
  shipping_fee_id UUID NOT NULL REFERENCES public.shipping_fees(id) ON DELETE CASCADE,
  visible_boutique BOOLEAN DEFAULT true,
  visible_depenses BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(accessory_id, shipping_fee_id)
);

ALTER TABLE public.accessory_shipping_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view shipping fees for accessories" ON public.accessory_shipping_fees;
DROP POLICY IF EXISTS "Admins can insert accessory shipping fees" ON public.accessory_shipping_fees;
DROP POLICY IF EXISTS "Admins can update accessory shipping fees" ON public.accessory_shipping_fees;
DROP POLICY IF EXISTS "Admins can delete accessory shipping fees" ON public.accessory_shipping_fees;

CREATE POLICY "Users can view shipping fees for accessories"
  ON public.accessory_shipping_fees FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert accessory shipping fees"
  ON public.accessory_shipping_fees FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can update accessory shipping fees"
  ON public.accessory_shipping_fees FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can delete accessory shipping fees"
  ON public.accessory_shipping_fees FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));