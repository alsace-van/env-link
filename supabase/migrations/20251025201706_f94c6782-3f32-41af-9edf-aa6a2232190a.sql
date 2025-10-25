-- Add marque column to accessories_catalog table
ALTER TABLE public.accessories_catalog ADD COLUMN IF NOT EXISTS marque text;