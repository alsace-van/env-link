-- Ajouter une colonne pour sauvegarder les données du canvas technique
ALTER TABLE public.projects 
ADD COLUMN technical_canvas_data TEXT;