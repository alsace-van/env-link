-- Add power field to accessories catalog
ALTER TABLE public.accessories_catalog
ADD COLUMN IF NOT EXISTS puissance_watts numeric;

-- Add power field to project expenses
ALTER TABLE public.project_expenses
ADD COLUMN IF NOT EXISTS puissance_watts numeric;

COMMENT ON COLUMN public.accessories_catalog.puissance_watts IS 'Puissance électrique en Watts';
COMMENT ON COLUMN public.project_expenses.puissance_watts IS 'Puissance électrique en Watts';