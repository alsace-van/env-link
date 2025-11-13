-- Mettre à jour les policies RLS de project_todos pour gérer les tâches globales (project_id NULL)
-- Les tâches globales appartiennent à l'utilisateur mais ne sont pas liées à un projet spécifique

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "Users can create their own project todos" ON project_todos;
DROP POLICY IF EXISTS "Users can view their own project todos" ON project_todos;
DROP POLICY IF EXISTS "Users can update their own project todos" ON project_todos;
DROP POLICY IF EXISTS "Users can delete their own project todos" ON project_todos;

-- Créer de nouvelles policies qui gèrent les tâches globales (project_id NULL)
CREATE POLICY "Users can create their own todos"
ON project_todos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own todos"
ON project_todos
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own todos"
ON project_todos
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own todos"
ON project_todos
FOR DELETE
USING (auth.uid() = user_id);