-- Ajouter les champs pour gérer les notices admin et la détection de doublons
ALTER TABLE public.notices_database 
ADD COLUMN IF NOT EXISTS is_admin_notice BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Index pour les notices admin
CREATE INDEX IF NOT EXISTS idx_notices_admin ON notices_database(is_admin_notice);

-- Index unique pour la détection de doublons (nom + taille pour les notices actives)
-- Uniquement pour les notices non-admin (les admins peuvent contourner)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notices_unique 
  ON notices_database(LOWER(titre), file_size) 
  WHERE file_size IS NOT NULL AND is_admin_notice = false;

-- Supprimer les anciennes policies de suppression et modification
DROP POLICY IF EXISTS "Users can delete own notices" ON public.notices_database;
DROP POLICY IF EXISTS "Users can update own notices" ON public.notices_database;

-- Nouvelle policy : les admins peuvent tout supprimer/modifier
CREATE POLICY "Admins can delete any notice"
  ON public.notices_database FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update any notice"
  ON public.notices_database FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Policy : les utilisateurs peuvent supprimer/modifier leurs propres notices NON-ADMIN
CREATE POLICY "Users can delete own non-admin notices"
  ON public.notices_database FOR DELETE
  USING (
    auth.uid() = created_by 
    AND is_admin_notice = false
  );

CREATE POLICY "Users can update own non-admin notices"
  ON public.notices_database FOR UPDATE
  USING (
    auth.uid() = created_by 
    AND is_admin_notice = false
  );

-- Policy : les admins peuvent créer des notices admin
CREATE POLICY "Admins can create admin notices"
  ON public.notices_database FOR INSERT
  WITH CHECK (
    is_admin_notice = false 
    OR (
      is_admin_notice = true 
      AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
      )
    )
  );

-- Mettre à jour la politique d'insertion existante pour les utilisateurs normaux
DROP POLICY IF EXISTS "Authenticated users can create notices" ON public.notices_database;

CREATE POLICY "Authenticated users can create non-admin notices"
  ON public.notices_database FOR INSERT
  WITH CHECK (
    auth.uid() = created_by 
    AND (is_admin_notice = false OR is_admin_notice IS NULL)
  );
