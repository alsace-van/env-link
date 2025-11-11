-- Add missing columns to project_expenses table
ALTER TABLE public.project_expenses 
ADD COLUMN IF NOT EXISTS prix_vente_ttc numeric,
ADD COLUMN IF NOT EXISTS quantite integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Create administrative_documents table
CREATE TABLE IF NOT EXISTS public.administrative_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  mime_type text,
  uploaded_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on administrative_documents
ALTER TABLE public.administrative_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for administrative_documents
CREATE POLICY "Users can view their own project documents"
ON public.administrative_documents
FOR SELECT
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Users can insert documents for their projects"
ON public.administrative_documents
FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM public.projects WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete their own project documents"
ON public.administrative_documents
FOR DELETE
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE created_by = auth.uid()
  )
);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_administrative_documents_project_id 
ON public.administrative_documents(project_id);

-- Create trigger for updated_at
CREATE TRIGGER update_administrative_documents_updated_at
BEFORE UPDATE ON public.administrative_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();