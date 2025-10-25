-- Add electrical type, weight and dimensions to project_expenses
ALTER TABLE public.project_expenses
ADD COLUMN type_electrique text CHECK (type_electrique IN ('consommateur', 'producteur', 'autre', NULL)),
ADD COLUMN poids_kg numeric,
ADD COLUMN longueur_mm integer,
ADD COLUMN largeur_mm integer,
ADD COLUMN hauteur_mm integer;

COMMENT ON COLUMN public.project_expenses.type_electrique IS 'Type de matériel électrique: consommateur, producteur ou autre';
COMMENT ON COLUMN public.project_expenses.poids_kg IS 'Poids en kilogrammes';
COMMENT ON COLUMN public.project_expenses.longueur_mm IS 'Longueur en millimètres';
COMMENT ON COLUMN public.project_expenses.largeur_mm IS 'Largeur en millimètres';
COMMENT ON COLUMN public.project_expenses.hauteur_mm IS 'Hauteur en millimètres';