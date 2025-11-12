-- Créer un bucket pour les documents officiels
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'official-documents',
  'official-documents',
  true,
  10485760, -- 10MB max
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Politiques RLS pour le bucket official-documents

-- Les admins peuvent uploader des documents
CREATE POLICY "Admins can upload official documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'official-documents' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Les admins peuvent mettre à jour des documents
CREATE POLICY "Admins can update official documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'official-documents' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Les admins peuvent supprimer des documents
CREATE POLICY "Admins can delete official documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'official-documents' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Tout le monde peut lire les documents officiels (bucket public)
CREATE POLICY "Everyone can view official documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'official-documents');