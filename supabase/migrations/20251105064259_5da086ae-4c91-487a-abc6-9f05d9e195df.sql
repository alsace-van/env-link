-- Créer les politiques RLS pour le bucket notice-files (en ignorant celles qui existent déjà)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Anyone can view notice files'
  ) THEN
    CREATE POLICY "Anyone can view notice files"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'notice-files');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload notice files'
  ) THEN
    CREATE POLICY "Authenticated users can upload notice files"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'notice-files' 
      AND auth.role() = 'authenticated'
    );
  END IF;
END $$;