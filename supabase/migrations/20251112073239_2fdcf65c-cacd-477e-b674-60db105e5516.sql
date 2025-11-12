-- Create RLS policies for expense_selected_options table
DROP POLICY IF EXISTS "Users can view their expense options" ON expense_selected_options;
DROP POLICY IF EXISTS "Users can insert their expense options" ON expense_selected_options;
DROP POLICY IF EXISTS "Users can update their expense options" ON expense_selected_options;
DROP POLICY IF EXISTS "Users can delete their expense options" ON expense_selected_options;

-- Allow users to view expense options for their expenses
CREATE POLICY "Users can view their expense options"
ON expense_selected_options
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM expenses e
    JOIN projects p ON e.project_id = p.id
    WHERE e.id = expense_selected_options.expense_id
    AND p.user_id = auth.uid()
  )
);

-- Allow users to insert expense options for their expenses
CREATE POLICY "Users can insert their expense options"
ON expense_selected_options
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM expenses e
    JOIN projects p ON e.project_id = p.id
    WHERE e.id = expense_selected_options.expense_id
    AND p.user_id = auth.uid()
  )
);

-- Allow users to update their expense options
CREATE POLICY "Users can update their expense options"
ON expense_selected_options
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM expenses e
    JOIN projects p ON e.project_id = p.id
    WHERE e.id = expense_selected_options.expense_id
    AND p.user_id = auth.uid()
  )
);

-- Allow users to delete their expense options
CREATE POLICY "Users can delete their expense options"
ON expense_selected_options
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM expenses e
    JOIN projects p ON e.project_id = p.id
    WHERE e.id = expense_selected_options.expense_id
    AND p.user_id = auth.uid()
  )
);