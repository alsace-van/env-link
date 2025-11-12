-- Create administrative-documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('administrative-documents', 'administrative-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Ensure administrative_documents table exists and has proper RLS
ALTER TABLE administrative_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on administrative_documents to recreate them
DROP POLICY IF EXISTS "Users can view their own documents" ON administrative_documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON administrative_documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON administrative_documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON administrative_documents;

-- Allow users to view documents from their projects
CREATE POLICY "Users can view their own documents"
ON administrative_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = administrative_documents.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Allow users to insert documents to their projects
CREATE POLICY "Users can insert their own documents"
ON administrative_documents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = administrative_documents.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Allow users to update documents from their projects
CREATE POLICY "Users can update their own documents"
ON administrative_documents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = administrative_documents.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Allow users to delete documents from their projects
CREATE POLICY "Users can delete their own documents"
ON administrative_documents
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = administrative_documents.project_id
    AND projects.user_id = auth.uid()
  )
);