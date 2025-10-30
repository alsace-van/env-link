-- Ajouter la colonne image_url à la table accessories_catalog
ALTER TABLE accessories_catalog 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Créer un bucket pour les images d'accessoires
INSERT INTO storage.buckets (id, name, public)
VALUES ('accessory-images', 'accessory-images', true)
ON CONFLICT (id) DO NOTHING;

-- Politiques pour le bucket accessory-images
CREATE POLICY "Images d'accessoires publiquement accessibles"
ON storage.objects FOR SELECT
USING (bucket_id = 'accessory-images');

CREATE POLICY "Utilisateurs peuvent uploader leurs images d'accessoires"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'accessory-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Utilisateurs peuvent mettre à jour leurs images d'accessoires"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'accessory-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Utilisateurs peuvent supprimer leurs images d'accessoires"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'accessory-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);