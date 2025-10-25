-- Add new columns to project_expenses for pricing calculations
ALTER TABLE public.project_expenses 
ADD COLUMN IF NOT EXISTS prix_vente_ttc numeric,
ADD COLUMN IF NOT EXISTS marge_pourcent numeric,
ADD COLUMN IF NOT EXISTS marque text;