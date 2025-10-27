-- Ajouter une colonne pour le deuxième canvas technique
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS technical_canvas_data_2 TEXT;