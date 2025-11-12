-- Create project-photos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-photos', 'project-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Ensure project_photos table exists and has proper RLS policies
ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on project_photos to recreate them
DROP POLICY IF EXISTS "Users can view their own project photos" ON project_photos;
DROP POLICY IF EXISTS "Users can insert their own project photos" ON project_photos;
DROP POLICY IF EXISTS "Users can update their own project photos" ON project_photos;
DROP POLICY IF EXISTS "Users can delete their own project photos" ON project_photos;

-- Allow users to view photos from their projects
CREATE POLICY "Users can view their own project photos"
ON project_photos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_photos.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Allow users to insert photos to their projects
CREATE POLICY "Users can insert their own project photos"
ON project_photos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_photos.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Allow users to update photos from their projects
CREATE POLICY "Users can update their own project photos"
ON project_photos
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_photos.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Allow users to delete photos from their projects
CREATE POLICY "Users can delete their own project photos"
ON project_photos
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_photos.project_id
    AND projects.user_id = auth.uid()
  )
);