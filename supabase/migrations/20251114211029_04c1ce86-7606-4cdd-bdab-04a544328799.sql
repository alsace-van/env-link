-- Créer la table shop_categories pour les catégories de produits
CREATE TABLE IF NOT EXISTS public.shop_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Activer RLS sur shop_categories
ALTER TABLE public.shop_categories ENABLE ROW LEVEL SECURITY;

-- Politique pour que tout le monde puisse voir les catégories actives
CREATE POLICY "Users can view active shop categories"
  ON public.shop_categories
  FOR SELECT
  USING (is_active = true);

-- Politique pour que les admins puissent créer des catégories
CREATE POLICY "Admins can create shop categories"
  ON public.shop_categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Politique pour que les admins puissent modifier des catégories
CREATE POLICY "Admins can update shop categories"
  ON public.shop_categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Politique pour que les admins puissent supprimer des catégories
CREATE POLICY "Admins can delete shop categories"
  ON public.shop_categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Ajouter le champ category_id à shop_products
ALTER TABLE public.shop_products 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.shop_categories(id) ON DELETE SET NULL;

-- Ajouter le champ stock_quantity à shop_products
ALTER TABLE public.shop_products
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_shop_products_category_id ON public.shop_products(category_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_is_active ON public.shop_products(is_active);
CREATE INDEX IF NOT EXISTS idx_shop_categories_is_active ON public.shop_categories(is_active);

-- Trigger pour mettre à jour updated_at sur shop_categories
CREATE TRIGGER update_shop_categories_updated_at
  BEFORE UPDATE ON public.shop_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Renommer les colonnes de shop_products pour correspondre au code
-- (name -> nom, type -> product_type, price -> prix_base)
DO $$ 
BEGIN
  -- Renommer 'name' en 'nom' si nécessaire
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shop_products' 
    AND column_name = 'name'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shop_products' 
    AND column_name = 'nom'
  ) THEN
    ALTER TABLE public.shop_products RENAME COLUMN name TO nom;
  END IF;

  -- Renommer 'type' en 'product_type' si nécessaire
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shop_products' 
    AND column_name = 'type'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shop_products' 
    AND column_name = 'product_type'
  ) THEN
    ALTER TABLE public.shop_products RENAME COLUMN type TO product_type;
  END IF;

  -- Renommer 'price' en 'prix_base' si nécessaire
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shop_products' 
    AND column_name = 'price'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shop_products' 
    AND column_name = 'prix_base'
  ) THEN
    ALTER TABLE public.shop_products RENAME COLUMN price TO prix_base;
  END IF;
END $$;

-- Recréer la contrainte CHECK avec le nouveau nom de colonne
ALTER TABLE public.shop_products DROP CONSTRAINT IF EXISTS shop_products_type_check;
ALTER TABLE public.shop_products DROP CONSTRAINT IF EXISTS shop_products_product_type_check;

ALTER TABLE public.shop_products 
  ADD CONSTRAINT shop_products_product_type_check 
  CHECK (product_type IN ('simple', 'bundle', 'custom_kit'));

-- Renommer shop_product_accessories en shop_product_items si nécessaire
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'shop_product_accessories'
  ) AND NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'shop_product_items'
  ) THEN
    ALTER TABLE public.shop_product_accessories RENAME TO shop_product_items;
  END IF;
END $$;

-- Renommer product_id en shop_product_id dans shop_product_items
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shop_product_items' 
    AND column_name = 'product_id'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shop_product_items' 
    AND column_name = 'shop_product_id'
  ) THEN
    ALTER TABLE public.shop_product_items RENAME COLUMN product_id TO shop_product_id;
  END IF;
END $$;

-- Ajouter les champs manquants dans shop_product_items
ALTER TABLE public.shop_product_items
ADD COLUMN IF NOT EXISTS default_quantity INTEGER DEFAULT 1;

ALTER TABLE public.shop_product_items
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT true;

-- Renommer quantity en default_quantity si nécessaire
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shop_product_items' 
    AND column_name = 'quantity'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shop_product_items' 
    AND column_name = 'default_quantity'
  ) THEN
    ALTER TABLE public.shop_product_items RENAME COLUMN quantity TO default_quantity;
  END IF;
END $$;