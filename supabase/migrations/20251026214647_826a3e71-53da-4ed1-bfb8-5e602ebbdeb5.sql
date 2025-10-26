-- Add intensity field to accessories catalog and project expenses
ALTER TABLE public.accessories_catalog
ADD COLUMN IF NOT EXISTS intensite_amperes numeric;

ALTER TABLE public.project_expenses
ADD COLUMN IF NOT EXISTS intensite_amperes numeric;

COMMENT ON COLUMN public.accessories_catalog.intensite_amperes IS 'Intensité électrique en Ampères';
COMMENT ON COLUMN public.project_expenses.intensite_amperes IS 'Intensité électrique en Ampères';