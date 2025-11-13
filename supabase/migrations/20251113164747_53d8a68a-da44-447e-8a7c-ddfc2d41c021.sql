-- Changer le type de la colonne due_date de date à timestamp with time zone
-- Ceci permet de stocker l'heure exacte des tâches et livraisons, pas seulement le jour

ALTER TABLE project_todos 
ALTER COLUMN due_date TYPE timestamp with time zone USING due_date::timestamp with time zone;

-- Ajouter un commentaire pour documenter ce changement
COMMENT ON COLUMN project_todos.due_date IS 'Date et heure d''échéance de la tâche (peut inclure une heure spécifique pour les livraisons)';