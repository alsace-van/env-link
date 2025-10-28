-- Modifier la colonne project_id pour qu'elle accepte NULL
-- Cela permet d'avoir des dépenses fournisseurs globales (non liées à un projet)
ALTER TABLE project_expenses 
ALTER COLUMN project_id DROP NOT NULL;