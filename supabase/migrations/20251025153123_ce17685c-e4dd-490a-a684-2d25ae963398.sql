-- Créer le bucket pour les photos de projets
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-photos', 'project-photos', true);

-- Politique pour voir les photos (tout le monde peut voir si publique)
CREATE POLICY "Public can view project photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-photos');

-- Politique pour uploader des photos (utilisateur authentifié peut uploader)
CREATE POLICY "Authenticated users can upload project photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-photos' 
  AND auth.role() = 'authenticated'
);

-- Politique pour mettre à jour ses propres photos
CREATE POLICY "Users can update own project photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Politique pour supprimer ses propres photos
CREATE POLICY "Users can delete own project photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Ajouter colonne pour les annotations et commentaires
ALTER TABLE public.project_photos
ADD COLUMN annotations JSONB,
ADD COLUMN comment TEXT;