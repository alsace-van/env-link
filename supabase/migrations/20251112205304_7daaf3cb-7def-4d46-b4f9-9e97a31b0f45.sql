-- Permettre les valeurs NULL pour project_id afin de supporter les dépenses fournisseurs globales
ALTER TABLE project_expenses 
ALTER COLUMN project_id DROP NOT NULL;