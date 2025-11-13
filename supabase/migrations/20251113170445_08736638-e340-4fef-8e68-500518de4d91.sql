-- Ajouter les colonnes de dimensions manquantes à project_expenses
-- Ces colonnes sont nécessaires pour stocker les dimensions des accessoires

ALTER TABLE project_expenses 
ADD COLUMN IF NOT EXISTS longueur_mm integer,
ADD COLUMN IF NOT EXISTS largeur_mm integer,
ADD COLUMN IF NOT EXISTS hauteur_mm integer;

-- Ajouter des commentaires pour documenter ces colonnes
COMMENT ON COLUMN project_expenses.longueur_mm IS 'Longueur de l''accessoire en millimètres';
COMMENT ON COLUMN project_expenses.largeur_mm IS 'Largeur de l''accessoire en millimètres';
COMMENT ON COLUMN project_expenses.hauteur_mm IS 'Hauteur de l''accessoire en millimètres';

-- Créer des index pour améliorer les performances si nécessaire
CREATE INDEX IF NOT EXISTS idx_project_expenses_dimensions ON project_expenses(longueur_mm, largeur_mm, hauteur_mm) WHERE longueur_mm IS NOT NULL;