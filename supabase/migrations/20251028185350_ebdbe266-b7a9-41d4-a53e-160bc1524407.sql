-- Create storage bucket for invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-invoices', 'project-invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Add invoice URL column to project_expenses
ALTER TABLE project_expenses 
ADD COLUMN IF NOT EXISTS facture_url text;

-- Create RLS policies for invoice uploads
CREATE POLICY "Users can upload invoices for own projects"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-invoices' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view invoices for own projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-invoices' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete invoices for own projects"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-invoices' AND
  auth.uid()::text = (storage.foldername(name))[1]
);