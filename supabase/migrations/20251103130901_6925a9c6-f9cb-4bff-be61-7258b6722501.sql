-- Add user_id column to project_todos for global todos
ALTER TABLE project_todos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Make project_id nullable for global todos
ALTER TABLE project_todos ALTER COLUMN project_id DROP NOT NULL;

-- Create index for better performance on user_id queries
CREATE INDEX IF NOT EXISTS idx_project_todos_user_id ON project_todos(user_id);

-- Update RLS policies to handle both project-level and global todos
DROP POLICY IF EXISTS "Users can view todos of own projects" ON project_todos;
DROP POLICY IF EXISTS "Users can create todos for own projects" ON project_todos;
DROP POLICY IF EXISTS "Users can update todos of own projects" ON project_todos;
DROP POLICY IF EXISTS "Users can delete todos of own projects" ON project_todos;

-- New RLS policies that handle both cases
CREATE POLICY "Users can view their todos"
ON project_todos FOR SELECT
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_todos.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their todos"
ON project_todos FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_todos.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their todos"
ON project_todos FOR UPDATE
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_todos.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their todos"
ON project_todos FOR DELETE
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_todos.project_id 
    AND projects.user_id = auth.uid()
  )
);