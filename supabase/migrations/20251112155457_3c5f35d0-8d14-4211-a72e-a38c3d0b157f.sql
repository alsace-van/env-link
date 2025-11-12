-- Créer la fonction has_role si elle n'existe pas déjà
-- Cette fonction est utilisée pour vérifier les rôles dans les policies RLS

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Supprimer l'ancienne politique qui utilise JWT
DROP POLICY IF EXISTS "Seuls les admins modifient les documents" ON official_documents;

-- Créer la nouvelle politique pour les admins utilisant has_role
CREATE POLICY "Admins can manage official documents"
ON official_documents
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));