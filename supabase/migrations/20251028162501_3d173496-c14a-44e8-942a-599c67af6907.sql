-- Create table for technical schemas
CREATE TABLE IF NOT EXISTS public.technical_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  schema_number INTEGER NOT NULL,
  canvas_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(project_id, schema_number)
);

-- Enable RLS
ALTER TABLE public.technical_schemas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view schemas of own projects"
  ON public.technical_schemas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = technical_schemas.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create schemas for own projects"
  ON public.technical_schemas
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = technical_schemas.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update schemas of own projects"
  ON public.technical_schemas
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = technical_schemas.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete schemas of own projects"
  ON public.technical_schemas
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = technical_schemas.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_technical_schemas_updated_at
  BEFORE UPDATE ON public.technical_schemas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data from projects table
INSERT INTO public.technical_schemas (project_id, schema_number, canvas_data)
SELECT 
  id as project_id,
  1 as schema_number,
  technical_canvas_data as canvas_data
FROM public.projects
WHERE technical_canvas_data IS NOT NULL
ON CONFLICT (project_id, schema_number) DO NOTHING;

INSERT INTO public.technical_schemas (project_id, schema_number, canvas_data)
SELECT 
  id as project_id,
  2 as schema_number,
  technical_canvas_data_2 as canvas_data
FROM public.projects
WHERE technical_canvas_data_2 IS NOT NULL
ON CONFLICT (project_id, schema_number) DO NOTHING;