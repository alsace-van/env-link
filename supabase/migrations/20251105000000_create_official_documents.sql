-- Créer la table pour les documents officiels (templates)
CREATE TABLE IF NOT EXISTS official_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_official_documents_active ON official_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_official_documents_category ON official_documents(category);

-- Créer la table pour les documents remplis par les utilisateurs
CREATE TABLE IF NOT EXISTS user_filled_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  official_document_id UUID REFERENCES official_documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  filled_data JSONB, -- Stocker les données du formulaire
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_user_filled_documents_user ON user_filled_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_filled_documents_project ON user_filled_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_user_filled_documents_official ON user_filled_documents(official_document_id);

-- RLS pour official_documents
ALTER TABLE official_documents ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les documents officiels actifs
CREATE POLICY "Anyone can view active official documents"
  ON official_documents
  FOR SELECT
  USING (is_active = true);

-- Seuls les admins peuvent créer/modifier/supprimer
CREATE POLICY "Admins can manage official documents"
  ON official_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS pour user_filled_documents
ALTER TABLE user_filled_documents ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leurs propres documents remplis
CREATE POLICY "Users can view their own filled documents"
  ON user_filled_documents
  FOR SELECT
  USING (user_id = auth.uid());

-- Les utilisateurs peuvent créer leurs propres documents remplis
CREATE POLICY "Users can create their own filled documents"
  ON user_filled_documents
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Les utilisateurs peuvent modifier leurs propres documents remplis
CREATE POLICY "Users can update their own filled documents"
  ON user_filled_documents
  FOR UPDATE
  USING (user_id = auth.uid());

-- Les utilisateurs peuvent supprimer leurs propres documents remplis
CREATE POLICY "Users can delete their own filled documents"
  ON user_filled_documents
  FOR DELETE
  USING (user_id = auth.uid());

-- Créer un bucket storage pour les documents officiels si pas existant
INSERT INTO storage.buckets (id, name, public)
VALUES ('official-documents', 'official-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Policies pour le bucket official-documents
CREATE POLICY "Anyone can view official documents"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'official-documents');

CREATE POLICY "Admins can upload official documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'official-documents' 
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete official documents"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'official-documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Créer un bucket pour les documents remplis par les utilisateurs
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-filled-documents', 'user-filled-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies pour le bucket user-filled-documents
CREATE POLICY "Users can view their own filled documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'user-filled-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload their own filled documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'user-filled-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own filled documents"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'user-filled-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
