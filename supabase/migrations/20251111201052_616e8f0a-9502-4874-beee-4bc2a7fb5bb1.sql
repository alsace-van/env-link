-- Supprimer les politiques existantes si elles existent
DROP POLICY IF EXISTS "Users can view their own project photos" ON public.project_photos;
DROP POLICY IF EXISTS "Users can insert their own project photos" ON public.project_photos;
DROP POLICY IF EXISTS "Users can update their own project photos" ON public.project_photos;
DROP POLICY IF EXISTS "Users can delete their own project photos" ON public.project_photos;

-- Table pour les photos de projet
CREATE TABLE IF NOT EXISTS public.project_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  photo_url TEXT NOT NULL,
  type TEXT DEFAULT 'projet',
  description TEXT,
  annotations JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies pour project_photos
CREATE POLICY "Users can view their own project photos"
  ON public.project_photos FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own project photos"
  ON public.project_photos FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own project photos"
  ON public.project_photos FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own project photos"
  ON public.project_photos FOR DELETE
  USING (user_id = auth.uid());

-- Table pour les notes de projet
CREATE TABLE IF NOT EXISTS public.project_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own project notes" ON public.project_notes;
CREATE POLICY "Users can manage their own project notes"
  ON public.project_notes FOR ALL
  USING (user_id = auth.uid());

-- Table pour les charges mensuelles
CREATE TABLE IF NOT EXISTS public.project_monthly_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  nom_charge TEXT NOT NULL,
  montant NUMERIC NOT NULL,
  jour_mois INTEGER NOT NULL CHECK (jour_mois >= 1 AND jour_mois <= 31),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.project_monthly_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own monthly charges" ON public.project_monthly_charges;
CREATE POLICY "Users can manage their own monthly charges"
  ON public.project_monthly_charges FOR ALL
  USING (user_id = auth.uid());

-- Table pour les rendez-vous clients
CREATE TABLE IF NOT EXISTS public.client_appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  description TEXT,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.client_appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own appointments" ON public.client_appointments;
CREATE POLICY "Users can manage their own appointments"
  ON public.client_appointments FOR ALL
  USING (user_id = auth.uid());

-- Table pour les rôles utilisateurs
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- Table pour la base de données de notices
CREATE TABLE IF NOT EXISTS public.notices_database (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titre TEXT NOT NULL,
  marque TEXT NOT NULL,
  modele TEXT NOT NULL,
  categorie TEXT,
  annee TEXT,
  notice_url TEXT NOT NULL,
  tags TEXT[],
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.notices_database ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own notices" ON public.notices_database;
CREATE POLICY "Users can manage their own notices"
  ON public.notices_database FOR ALL
  USING (user_id = auth.uid());

-- Table pour les documents remplis
CREATE TABLE IF NOT EXISTS public.user_filled_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  filled_data JSONB NOT NULL,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_filled_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own filled documents" ON public.user_filled_documents;
CREATE POLICY "Users can manage their own filled documents"
  ON public.user_filled_documents FOR ALL
  USING (user_id = auth.uid());

-- Table pour les schémas techniques
CREATE TABLE IF NOT EXISTS public.technical_schemas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  schema_name TEXT NOT NULL,
  schema_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.technical_schemas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own technical schemas" ON public.technical_schemas;
CREATE POLICY "Users can manage their own technical schemas"
  ON public.technical_schemas FOR ALL
  USING (user_id = auth.uid());

-- Table pour le log des actions admin
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all actions" ON public.admin_actions_log;
DROP POLICY IF EXISTS "Admins can insert actions" ON public.admin_actions_log;

CREATE POLICY "Admins can view all actions"
  ON public.admin_actions_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can insert actions"
  ON public.admin_actions_log FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));