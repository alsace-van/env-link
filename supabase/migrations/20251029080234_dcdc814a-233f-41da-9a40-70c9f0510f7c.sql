-- Table pour les todos des projets
CREATE TABLE public.project_todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table pour les notes des projets
CREATE TABLE public.project_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour project_todos
CREATE POLICY "Users can view todos of own projects"
  ON public.project_todos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_todos.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create todos for own projects"
  ON public.project_todos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_todos.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update todos of own projects"
  ON public.project_todos FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_todos.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete todos of own projects"
  ON public.project_todos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_todos.project_id 
    AND projects.user_id = auth.uid()
  ));

-- RLS Policies pour project_notes
CREATE POLICY "Users can view notes of own projects"
  ON public.project_notes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_notes.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create notes for own projects"
  ON public.project_notes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_notes.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update notes of own projects"
  ON public.project_notes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_notes.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete notes of own projects"
  ON public.project_notes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_notes.project_id 
    AND projects.user_id = auth.uid()
  ));

-- Trigger pour updated_at
CREATE TRIGGER update_project_todos_updated_at
  BEFORE UPDATE ON public.project_todos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_notes_updated_at
  BEFORE UPDATE ON public.project_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index pour les performances
CREATE INDEX idx_project_todos_project_id ON public.project_todos(project_id);
CREATE INDEX idx_project_notes_project_id ON public.project_notes(project_id);