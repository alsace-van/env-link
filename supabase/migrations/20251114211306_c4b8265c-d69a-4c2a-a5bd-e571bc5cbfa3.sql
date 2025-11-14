-- Ajouter la colonne image_url manquante à shop_products
ALTER TABLE public.shop_products
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Ajouter une colonne description si elle n'existe pas
ALTER TABLE public.shop_products
ADD COLUMN IF NOT EXISTS description TEXT;

-- Vérifier et corriger les politiques RLS pour shop_products
-- D'abord, supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can view their own products" ON public.shop_products;
DROP POLICY IF EXISTS "Users can create their own products" ON public.shop_products;
DROP POLICY IF EXISTS "Users can update their own products" ON public.shop_products;
DROP POLICY IF EXISTS "Users can delete their own products" ON public.shop_products;

-- Politique pour voir les produits actifs (pour la boutique publique)
DROP POLICY IF EXISTS "Users can view active products" ON public.shop_products;
CREATE POLICY "Users can view active products"
  ON public.shop_products
  FOR SELECT
  USING (is_active = true);

-- Politique pour que les utilisateurs voient leurs propres produits (admin)
CREATE POLICY "Users can view their own products"
  ON public.shop_products
  FOR SELECT
  USING (auth.uid() = user_id);

-- Politique pour créer des produits
CREATE POLICY "Users can create their own products"
  ON public.shop_products
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Politique pour mettre à jour ses propres produits
CREATE POLICY "Users can update their own products"
  ON public.shop_products
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Politique pour supprimer ses propres produits
CREATE POLICY "Users can delete their own products"
  ON public.shop_products
  FOR DELETE
  USING (auth.uid() = user_id);