-- Modifier la policy d'insertion pour permettre les dépenses globales (project_id NULL)
DROP POLICY IF EXISTS "Users can insert project_expenses" ON project_expenses;

CREATE POLICY "Users can insert project_expenses" 
ON project_expenses 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND (
    project_id IS NULL OR 
    project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
  )
);

-- Modifier la policy de lecture pour inclure les dépenses globales
DROP POLICY IF EXISTS "Users can view project_expenses" ON project_expenses;

CREATE POLICY "Users can view project_expenses" 
ON project_expenses 
FOR SELECT 
USING (
  user_id = auth.uid() AND (
    project_id IS NULL OR 
    project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
  )
);

-- Modifier la policy de mise à jour pour inclure les dépenses globales
DROP POLICY IF EXISTS "Users can update project_expenses" ON project_expenses;

CREATE POLICY "Users can update project_expenses" 
ON project_expenses 
FOR UPDATE 
USING (
  user_id = auth.uid() AND (
    project_id IS NULL OR 
    project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
  )
);

-- Modifier la policy de suppression pour inclure les dépenses globales
DROP POLICY IF EXISTS "Users can delete project_expenses" ON project_expenses;

CREATE POLICY "Users can delete project_expenses" 
ON project_expenses 
FOR DELETE 
USING (
  user_id = auth.uid() AND (
    project_id IS NULL OR 
    project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
  )
);