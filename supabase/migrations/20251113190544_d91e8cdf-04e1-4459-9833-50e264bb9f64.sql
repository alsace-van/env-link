-- Créer une table pour les accessoires d'un kit sur mesure
CREATE TABLE IF NOT EXISTS public.shop_custom_kit_accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_kit_id UUID NOT NULL REFERENCES public.shop_custom_kits(id) ON DELETE CASCADE,
  accessory_id UUID NOT NULL REFERENCES public.accessories_catalog(id) ON DELETE CASCADE,
  default_quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(custom_kit_id, accessory_id)
);

-- Activer RLS
ALTER TABLE public.shop_custom_kit_accessories ENABLE ROW LEVEL SECURITY;

-- Politique pour voir les accessoires des kits
CREATE POLICY "Users can view custom kit accessories"
  ON public.shop_custom_kit_accessories
  FOR SELECT
  USING (true);

-- Politique pour que les admins puissent gérer les accessoires des kits
CREATE POLICY "Admins can manage custom kit accessories"
  ON public.shop_custom_kit_accessories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Créer un index pour améliorer les performances
CREATE INDEX idx_shop_custom_kit_accessories_kit_id ON public.shop_custom_kit_accessories(custom_kit_id);