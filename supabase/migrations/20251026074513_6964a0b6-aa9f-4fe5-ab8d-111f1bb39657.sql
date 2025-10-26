-- Add project name and photo fields to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS nom_projet text,
ADD COLUMN IF NOT EXISTS photo_url text;