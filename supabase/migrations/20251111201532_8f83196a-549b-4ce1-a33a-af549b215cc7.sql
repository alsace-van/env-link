-- Create storage bucket for notice files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notice-files',
  'notice-files',
  false,
  20971520, -- 20MB in bytes
  ARRAY['application/pdf']
);

-- RLS policies for notice-files bucket
CREATE POLICY "Users can upload their own notice files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'notice-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own notice files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'notice-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own notice files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'notice-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);