-- Ajouter le champ image_url à la table shop_categories si elle existe
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shop_categories') THEN
    -- Ajouter la colonne image_url si elle n'existe pas
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'shop_categories' 
      AND column_name = 'image_url'
    ) THEN
      ALTER TABLE public.shop_categories ADD COLUMN image_url TEXT;
    END IF;
  END IF;
END $$;

-- Créer un bucket de stockage pour les images de la boutique si pas déjà existant
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO NOTHING;

-- Créer les politiques de stockage pour le bucket shop-images
DO $$
BEGIN
  -- Politique de lecture publique
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Shop images are publicly accessible'
  ) THEN
    CREATE POLICY "Shop images are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'shop-images');
  END IF;

  -- Politique d'upload pour utilisateurs authentifiés
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload shop images'
  ) THEN
    CREATE POLICY "Authenticated users can upload shop images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'shop-images' AND auth.role() = 'authenticated');
  END IF;

  -- Politique de suppression pour utilisateurs authentifiés
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can delete shop images'
  ) THEN
    CREATE POLICY "Authenticated users can delete shop images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'shop-images' AND auth.role() = 'authenticated');
  END IF;
END $$;