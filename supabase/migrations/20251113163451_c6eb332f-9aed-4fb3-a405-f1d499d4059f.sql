-- Ajouter les colonnes task_type et accessory_id à la table project_todos
-- pour gérer les tâches de livraison d'accessoires

ALTER TABLE project_todos 
ADD COLUMN IF NOT EXISTS task_type TEXT,
ADD COLUMN IF NOT EXISTS accessory_id UUID REFERENCES accessories_catalog(id) ON DELETE CASCADE;

-- Créer un index pour améliorer les performances des requêtes par task_type
CREATE INDEX IF NOT EXISTS idx_project_todos_task_type ON project_todos(task_type);

-- Créer un index pour améliorer les performances des requêtes par accessory_id
CREATE INDEX IF NOT EXISTS idx_project_todos_accessory_id ON project_todos(accessory_id);

-- Ajouter un commentaire pour documenter les colonnes
COMMENT ON COLUMN project_todos.task_type IS 'Type de tâche (delivery, appointment, maintenance, etc.)';
COMMENT ON COLUMN project_todos.accessory_id IS 'Référence vers un accessoire du catalogue pour les tâches de livraison';