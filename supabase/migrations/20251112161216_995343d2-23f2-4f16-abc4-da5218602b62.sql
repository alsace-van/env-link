-- Créer la table pour les catégories de documents officiels
CREATE TABLE IF NOT EXISTS public.official_document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT 'gray',
  icon text NOT NULL DEFAULT '📄',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.official_document_categories ENABLE ROW LEVEL SECURITY;

-- Policy pour que tout le monde puisse lire les catégories
CREATE POLICY "Everyone can view categories"
ON public.official_document_categories
FOR SELECT
TO authenticated
USING (true);

-- Policy pour que seuls les admins puissent gérer les catégories
CREATE POLICY "Admins can manage categories"
ON public.official_document_categories
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insérer les catégories par défaut
INSERT INTO public.official_document_categories (name, color, icon, display_order) VALUES
  ('Homologation', 'blue', '🚐', 1),
  ('Administratif', 'green', '📋', 2),
  ('Technique', 'purple', '🔧', 3),
  ('Certificat', 'orange', '✅', 4)
ON CONFLICT (name) DO NOTHING;