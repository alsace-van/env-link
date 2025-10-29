-- Ajouter un champ pour marquer les accessoires disponibles dans la boutique
ALTER TABLE public.accessories_catalog
ADD COLUMN available_in_shop BOOLEAN NOT NULL DEFAULT false;

-- Créer la table des produits de la boutique
CREATE TABLE IF NOT EXISTS public.shop_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('simple', 'composed', 'custom_kit')),
  price NUMERIC NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Créer la table pour les items des produits composés
CREATE TABLE IF NOT EXISTS public.shop_product_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  accessory_id UUID NOT NULL REFERENCES public.accessories_catalog(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Créer la table pour les kits sur-mesure (template)
CREATE TABLE IF NOT EXISTS public.shop_custom_kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  min_items INTEGER NOT NULL DEFAULT 1,
  max_items INTEGER,
  base_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Créer la table pour les accessoires disponibles dans les kits sur-mesure
CREATE TABLE IF NOT EXISTS public.shop_custom_kit_available_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kit_id UUID NOT NULL REFERENCES public.shop_custom_kits(id) ON DELETE CASCADE,
  accessory_id UUID NOT NULL REFERENCES public.accessories_catalog(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(kit_id, accessory_id)
);

-- Enable RLS
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_product_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_custom_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_custom_kit_available_items ENABLE ROW LEVEL SECURITY;

-- RLS policies pour shop_products
CREATE POLICY "Users can view all active products"
  ON public.shop_products
  FOR SELECT
  USING (is_active = true OR auth.uid() = user_id);

CREATE POLICY "Users can create their own products"
  ON public.shop_products
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products"
  ON public.shop_products
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products"
  ON public.shop_products
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies pour shop_product_items
CREATE POLICY "Anyone can view product items"
  ON public.shop_product_items
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create items for their products"
  ON public.shop_product_items
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shop_products
    WHERE id = product_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete items from their products"
  ON public.shop_product_items
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.shop_products
    WHERE id = product_id AND user_id = auth.uid()
  ));

-- RLS policies pour shop_custom_kits
CREATE POLICY "Anyone can view custom kits"
  ON public.shop_custom_kits
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create kits for their products"
  ON public.shop_custom_kits
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shop_products
    WHERE id = product_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can update kits for their products"
  ON public.shop_custom_kits
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.shop_products
    WHERE id = product_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete kits for their products"
  ON public.shop_custom_kits
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.shop_products
    WHERE id = product_id AND user_id = auth.uid()
  ));

-- RLS policies pour shop_custom_kit_available_items
CREATE POLICY "Anyone can view kit available items"
  ON public.shop_custom_kit_available_items
  FOR SELECT
  USING (true);

CREATE POLICY "Users can add items to their kits"
  ON public.shop_custom_kit_available_items
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shop_custom_kits ck
    JOIN public.shop_products sp ON sp.id = ck.product_id
    WHERE ck.id = kit_id AND sp.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete items from their kits"
  ON public.shop_custom_kit_available_items
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.shop_custom_kits ck
    JOIN public.shop_products sp ON sp.id = ck.product_id
    WHERE ck.id = kit_id AND sp.user_id = auth.uid()
  ));

-- Trigger pour updated_at
CREATE TRIGGER update_shop_products_updated_at
  BEFORE UPDATE ON public.shop_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();