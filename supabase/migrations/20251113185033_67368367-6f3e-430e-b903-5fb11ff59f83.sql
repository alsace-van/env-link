-- Créer la table shop_products pour les produits simples et composés
CREATE TABLE IF NOT EXISTS public.shop_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('simple', 'composed')),
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;

-- Politique pour que les utilisateurs puissent voir les produits actifs
CREATE POLICY "Users can view active shop products"
  ON public.shop_products
  FOR SELECT
  USING (is_active = true);

-- Politique pour que les admins puissent créer des produits
CREATE POLICY "Admins can create shop products"
  ON public.shop_products
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Politique pour que les admins puissent modifier des produits
CREATE POLICY "Admins can update shop products"
  ON public.shop_products
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Politique pour que les admins puissent supprimer des produits
CREATE POLICY "Admins can delete shop products"
  ON public.shop_products
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Table pour les accessoires associés aux produits composés
CREATE TABLE IF NOT EXISTS public.shop_product_accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  accessory_id UUID NOT NULL REFERENCES public.accessories_catalog(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id, accessory_id)
);

-- Activer RLS sur la table des accessoires de produits
ALTER TABLE public.shop_product_accessories ENABLE ROW LEVEL SECURITY;

-- Politique pour voir les accessoires des produits
CREATE POLICY "Users can view product accessories"
  ON public.shop_product_accessories
  FOR SELECT
  USING (true);

-- Politique pour que les admins puissent gérer les accessoires de produits
CREATE POLICY "Admins can manage product accessories"
  ON public.shop_product_accessories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );