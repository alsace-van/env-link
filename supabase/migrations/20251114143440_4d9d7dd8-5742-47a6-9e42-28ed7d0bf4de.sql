-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_technical_schemas_updated_at ON public.technical_schemas;

-- Create technical_schemas table for storing canvas drawings
CREATE TABLE IF NOT EXISTS public.technical_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_number INTEGER NOT NULL,
  schema_data TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id, schema_number)
);

-- Enable RLS
ALTER TABLE public.technical_schemas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own technical schemas" ON public.technical_schemas;
DROP POLICY IF EXISTS "Users can insert their own technical schemas" ON public.technical_schemas;
DROP POLICY IF EXISTS "Users can update their own technical schemas" ON public.technical_schemas;
DROP POLICY IF EXISTS "Users can delete their own technical schemas" ON public.technical_schemas;

-- Create policies for technical_schemas
CREATE POLICY "Users can view their own technical schemas"
  ON public.technical_schemas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = technical_schemas.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own technical schemas"
  ON public.technical_schemas
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = technical_schemas.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own technical schemas"
  ON public.technical_schemas
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = technical_schemas.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own technical schemas"
  ON public.technical_schemas
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = technical_schemas.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_technical_schemas_project_id ON public.technical_schemas(project_id);
CREATE INDEX IF NOT EXISTS idx_technical_schemas_user_id ON public.technical_schemas(user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_technical_schemas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_technical_schemas_updated_at
  BEFORE UPDATE ON public.technical_schemas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_technical_schemas_updated_at();