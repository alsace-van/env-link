-- Création de la table profiles pour les informations utilisateurs
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger pour créer automatiquement un profil lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Catalogue de véhicules avec modèles prédéfinis
CREATE TABLE public.vehicles_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marque TEXT NOT NULL,
  modele TEXT NOT NULL,
  longueur_mm INTEGER NOT NULL,
  largeur_mm INTEGER,
  hauteur_mm INTEGER,
  poids_vide_kg INTEGER,
  charge_utile_kg INTEGER,
  ptac_kg INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(marque, modele)
);

ALTER TABLE public.vehicles_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view vehicles catalog"
  ON public.vehicles_catalog FOR SELECT
  USING (true);

-- Insertion de quelques véhicules populaires
INSERT INTO public.vehicles_catalog (marque, modele, longueur_mm, largeur_mm, hauteur_mm, poids_vide_kg, charge_utile_kg, ptac_kg) VALUES
  ('Citroën', 'Jumper L2H2', 5413, 2050, 2524, 1950, 1050, 3000),
  ('Citroën', 'Jumper L3H2', 5998, 2050, 2524, 2000, 1000, 3000),
  ('Citroën', 'Jumper L4H3', 6363, 2050, 2764, 2050, 950, 3000),
  ('Peugeot', 'Boxer L2H2', 5413, 2050, 2524, 1950, 1050, 3000),
  ('Peugeot', 'Boxer L3H2', 5998, 2050, 2524, 2000, 1000, 3000),
  ('Renault', 'Master L2H2', 5483, 2073, 2524, 1980, 1020, 3000),
  ('Renault', 'Master L3H2', 6198, 2073, 2524, 2020, 980, 3000),
  ('Fiat', 'Ducato L2H2', 5413, 2050, 2524, 1950, 1050, 3000),
  ('Fiat', 'Ducato L3H2', 5998, 2050, 2524, 2000, 1000, 3000),
  ('Mercedes', 'Sprinter 314 L2H2', 5932, 2020, 2460, 2080, 920, 3000),
  ('Mercedes', 'Sprinter 314 L3H2', 6940, 2020, 2460, 2130, 870, 3000),
  ('Volkswagen', 'Crafter L3H3', 6836, 2040, 2595, 2150, 850, 3000);

-- Table des projets d'aménagement
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Informations propriétaire
  nom_proprietaire TEXT NOT NULL,
  adresse_proprietaire TEXT,
  telephone_proprietaire TEXT,
  email_proprietaire TEXT,
  
  -- Informations véhicule
  vehicle_catalog_id UUID REFERENCES public.vehicles_catalog(id),
  marque_custom TEXT,
  modele_custom TEXT,
  longueur_mm INTEGER,
  largeur_mm INTEGER,
  hauteur_mm INTEGER,
  poids_vide_kg INTEGER,
  charge_utile_kg INTEGER,
  ptac_kg INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table pour les photos du projet
CREATE TABLE public.project_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('inspiration', 'projet')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view photos of own projects"
  ON public.project_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_photos.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create photos for own projects"
  ON public.project_photos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_photos.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update photos of own projects"
  ON public.project_photos FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_photos.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete photos of own projects"
  ON public.project_photos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_photos.project_id
    AND projects.user_id = auth.uid()
  ));

-- Table pour le suivi financier par projet
CREATE TABLE public.project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  nom_accessoire TEXT NOT NULL,
  prix DECIMAL(10, 2) NOT NULL,
  quantite INTEGER NOT NULL DEFAULT 1,
  date_achat DATE,
  fournisseur TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view expenses of own projects"
  ON public.project_expenses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_expenses.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create expenses for own projects"
  ON public.project_expenses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_expenses.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update expenses of own projects"
  ON public.project_expenses FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_expenses.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete expenses of own projects"
  ON public.project_expenses FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_expenses.project_id
    AND projects.user_id = auth.uid()
  ));

-- Table pour les documents administratifs par projet
CREATE TABLE public.project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  nom_document TEXT NOT NULL,
  url TEXT NOT NULL,
  type_document TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view documents of own projects"
  ON public.project_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_documents.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create documents for own projects"
  ON public.project_documents FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_documents.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update documents of own projects"
  ON public.project_documents FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_documents.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete documents of own projects"
  ON public.project_documents FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_documents.project_id
    AND projects.user_id = auth.uid()
  ));

-- Catalogue d'accessoires partagé entre projets d'un utilisateur
CREATE TABLE public.accessories_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  description TEXT,
  prix_reference DECIMAL(10, 2),
  fournisseur TEXT,
  url_produit TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.accessories_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accessories catalog"
  ON public.accessories_catalog FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own accessories"
  ON public.accessories_catalog FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accessories"
  ON public.accessories_catalog FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accessories"
  ON public.accessories_catalog FOR DELETE
  USING (auth.uid() = user_id);

-- Base de données de notices partagée entre tous les utilisateurs
CREATE TABLE public.notices_database (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  marque TEXT,
  modele TEXT,
  categorie TEXT,
  url_notice TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notices_database ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view notices"
  ON public.notices_database FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create notices"
  ON public.notices_database FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own notices"
  ON public.notices_database FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own notices"
  ON public.notices_database FOR DELETE
  USING (auth.uid() = created_by);