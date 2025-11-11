-- Supprimer le trigger problématique
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;

-- Remplir user_id avec created_by pour les projets existants
UPDATE projects 
SET user_id = created_by 
WHERE user_id IS NULL AND created_by IS NOT NULL;

-- Simplifier les politiques RLS pour utiliser uniquement created_by
DROP POLICY IF EXISTS "Users can manage own projects" ON projects;

-- Créer une politique DELETE spécifique et cohérente
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
CREATE POLICY "Users can delete own projects" 
ON projects 
FOR DELETE 
USING (auth.uid() = created_by);