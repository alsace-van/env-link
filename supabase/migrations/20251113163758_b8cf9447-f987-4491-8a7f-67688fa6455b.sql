-- Permettre les tâches globales sans projet en autorisant project_id NULL
-- Ceci permet de créer des tâches de livraison d'accessoires qui ne sont pas liées à un projet spécifique

ALTER TABLE project_todos 
ALTER COLUMN project_id DROP NOT NULL;

-- Ajouter un commentaire pour documenter ce changement
COMMENT ON COLUMN project_todos.project_id IS 'ID du projet associé. Peut être NULL pour les tâches globales (livraisons, etc.)';