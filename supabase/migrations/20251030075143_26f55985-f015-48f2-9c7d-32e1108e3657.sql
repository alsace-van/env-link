-- Créer un bucket pour les images de la boutique
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-assets', 'shop-assets', true);

-- Créer une table pour la configuration de l'encart boutique
CREATE TABLE IF NOT EXISTS public.shop_welcome_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Boutique en ligne',
  description TEXT NOT NULL DEFAULT 'Découvrez notre catalogue de produits et accessoires pour l''aménagement de votre fourgon',
  button_text TEXT NOT NULL DEFAULT 'Accéder à la boutique',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shop_welcome_config ENABLE ROW LEVEL SECURITY;

-- Policies pour shop_welcome_config
CREATE POLICY "Users can view their own shop config"
ON public.shop_welcome_config
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shop config"
ON public.shop_welcome_config
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shop config"
ON public.shop_welcome_config
FOR UPDATE
USING (auth.uid() = user_id);

-- Policies pour le bucket shop-assets
CREATE POLICY "Shop images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'shop-assets');

CREATE POLICY "Users can upload shop images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'shop-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their shop images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'shop-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their shop images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'shop-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_shop_welcome_config_updated_at
BEFORE UPDATE ON public.shop_welcome_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();