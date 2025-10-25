-- Create storage bucket for notice files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('notice-files', 'notice-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their notices
CREATE POLICY "Users can upload notice files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'notice-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow everyone to view notice files (they are public)
CREATE POLICY "Notice files are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'notice-files');

-- Allow users to delete their own notice files
CREATE POLICY "Users can delete their own notice files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'notice-files' AND auth.uid()::text = (storage.foldername(name))[1]);