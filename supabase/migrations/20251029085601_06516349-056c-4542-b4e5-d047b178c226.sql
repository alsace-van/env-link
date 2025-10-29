-- Create table for administrative documents
CREATE TABLE IF NOT EXISTS public.administrative_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.administrative_documents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own documents"
  ON public.administrative_documents
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upload their own documents"
  ON public.administrative_documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
  ON public.administrative_documents
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('administrative-documents', 'administrative-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can view their own documents"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'administrative-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'administrative-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own documents"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'administrative-documents' AND auth.uid()::text = (storage.foldername(name))[1]);