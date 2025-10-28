-- Mettre à jour les politiques RLS pour project_expenses pour supporter les dépenses fournisseurs globales

-- Politique SELECT : permettre de voir ses propres dépenses projet ET les dépenses fournisseurs globales
DROP POLICY IF EXISTS "Users can view expenses of own projects" ON project_expenses;
CREATE POLICY "Users can view expenses of own projects or global supplier expenses"
ON project_expenses FOR SELECT
USING (
  (project_id IS NULL AND fournisseur IS NOT NULL) -- Dépenses fournisseurs globales
  OR 
  (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_expenses.project_id 
    AND projects.user_id = auth.uid()
  )) -- Dépenses de leurs propres projets
);

-- Politique INSERT : permettre de créer des dépenses pour ses projets ET des dépenses fournisseurs globales
DROP POLICY IF EXISTS "Users can create expenses for own projects" ON project_expenses;
CREATE POLICY "Users can create expenses for own projects or global supplier expenses"
ON project_expenses FOR INSERT
WITH CHECK (
  (project_id IS NULL AND fournisseur IS NOT NULL) -- Dépenses fournisseurs globales
  OR
  (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_expenses.project_id 
    AND projects.user_id = auth.uid()
  )) -- Dépenses de leurs propres projets
);

-- Politique UPDATE : permettre de modifier ses propres dépenses projet ET les dépenses fournisseurs globales qu'on a créées
DROP POLICY IF EXISTS "Users can update expenses of own projects" ON project_expenses;
CREATE POLICY "Users can update expenses of own projects or global supplier expenses"
ON project_expenses FOR UPDATE
USING (
  (project_id IS NULL AND fournisseur IS NOT NULL) -- Dépenses fournisseurs globales
  OR
  (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_expenses.project_id 
    AND projects.user_id = auth.uid()
  )) -- Dépenses de leurs propres projets
);

-- Politique DELETE : permettre de supprimer ses propres dépenses projet ET les dépenses fournisseurs globales
DROP POLICY IF EXISTS "Users can delete expenses of own projects" ON project_expenses;
CREATE POLICY "Users can delete expenses of own projects or global supplier expenses"
ON project_expenses FOR DELETE
USING (
  (project_id IS NULL AND fournisseur IS NOT NULL) -- Dépenses fournisseurs globales
  OR
  (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_expenses.project_id 
    AND projects.user_id = auth.uid()
  )) -- Dépenses de leurs propres projets
);