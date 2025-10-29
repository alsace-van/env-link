-- Fix security issue: Remove supplier expense exposure
-- This removes the ability for any authenticated user to view all supplier expenses

-- Drop and recreate all four project_expenses RLS policies to remove the global supplier exception

DROP POLICY IF EXISTS "Users can view expenses of own projects or global supplier expenses" ON project_expenses;
DROP POLICY IF EXISTS "Users can create expenses for own projects or global supplier expenses" ON project_expenses;
DROP POLICY IF EXISTS "Users can update expenses of own projects or global supplier expenses" ON project_expenses;
DROP POLICY IF EXISTS "Users can delete expenses of own projects or global supplier expenses" ON project_expenses;

-- Recreate policies with strict owner-only access
CREATE POLICY "Users can view expenses of own projects"
ON project_expenses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_expenses.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create expenses for own projects"
ON project_expenses FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_expenses.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update expenses of own projects"
ON project_expenses FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_expenses.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete expenses of own projects"
ON project_expenses FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_expenses.project_id 
    AND projects.user_id = auth.uid()
  )
);