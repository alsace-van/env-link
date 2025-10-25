-- Add prix_vente_ttc and marge_pourcent columns to accessories_catalog
ALTER TABLE public.accessories_catalog 
ADD COLUMN prix_vente_ttc NUMERIC,
ADD COLUMN marge_pourcent NUMERIC;