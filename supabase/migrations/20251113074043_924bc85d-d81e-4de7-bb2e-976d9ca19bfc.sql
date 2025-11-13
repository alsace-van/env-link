-- Ajouter une colonne todo_id à project_expenses pour lier aux tâches
ALTER TABLE project_expenses
ADD COLUMN todo_id UUID REFERENCES project_todos(id) ON DELETE SET NULL;