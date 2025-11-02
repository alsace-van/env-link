-- Migration: Création de la table global_todos pour les tâches partagées entre tous les projets
-- (livraisons, commandes, rappels généraux, etc.)

-- Créer la table global_todos
CREATE TABLE IF NOT EXISTS public.global_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Informations de la tâche
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  
  -- Type de tâche pour catégorisation
  task_type TEXT CHECK (task_type IN ('delivery', 'appointment', 'reminder', 'other')) DEFAULT 'other',
  
  -- Lien optionnel vers un accessoire (pour les livraisons)
  accessory_id UUID REFERENCES public.accessories_catalog(id) ON DELETE SET NULL,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_global_todos_user_id ON public.global_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_global_todos_due_date ON public.global_todos(due_date);
CREATE INDEX IF NOT EXISTS idx_global_todos_accessory_id ON public.global_todos(accessory_id);
CREATE INDEX IF NOT EXISTS idx_global_todos_completed ON public.global_todos(completed);
CREATE INDEX IF NOT EXISTS idx_global_todos_task_type ON public.global_todos(task_type);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_global_todos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_global_todos_updated_at
  BEFORE UPDATE ON public.global_todos
  FOR EACH ROW
  EXECUTE FUNCTION update_global_todos_updated_at();

-- RLS (Row Level Security)
ALTER TABLE public.global_todos ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs peuvent voir leurs propres tâches globales
CREATE POLICY "Users can view their own global todos"
  ON public.global_todos FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent créer leurs propres tâches globales
CREATE POLICY "Users can create their own global todos"
  ON public.global_todos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent mettre à jour leurs propres tâches globales
CREATE POLICY "Users can update their own global todos"
  ON public.global_todos FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent supprimer leurs propres tâches globales
CREATE POLICY "Users can delete their own global todos"
  ON public.global_todos FOR DELETE
  USING (auth.uid() = user_id);

-- Commentaires pour documentation
COMMENT ON TABLE public.global_todos IS 'Tâches globales partagées entre tous les projets (livraisons, rendez-vous, rappels)';
COMMENT ON COLUMN public.global_todos.task_type IS 'Type de tâche: delivery (livraison), appointment (RDV), reminder (rappel), other (autre)';
COMMENT ON COLUMN public.global_todos.accessory_id IS 'Lien optionnel vers un accessoire du catalogue (pour les tâches de livraison)';
