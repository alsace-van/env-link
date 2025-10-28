-- Supprimer les triggers qui causent une boucle infinie
DROP TRIGGER IF EXISTS on_expense_update ON project_expenses;
DROP TRIGGER IF EXISTS on_catalog_update ON accessories_catalog;

-- Supprimer les fonctions associées
DROP FUNCTION IF EXISTS sync_expense_to_catalog();
DROP FUNCTION IF EXISTS sync_catalog_to_expenses();