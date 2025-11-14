-- Add schema_name column to technical_schemas table
ALTER TABLE public.technical_schemas 
ADD COLUMN IF NOT EXISTS schema_name TEXT NOT NULL DEFAULT '';