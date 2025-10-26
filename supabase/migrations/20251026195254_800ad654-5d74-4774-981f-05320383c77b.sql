-- Ajouter les colonnes pour le canevas d'aménagement
ALTER TABLE public.projects
ADD COLUMN layout_canvas_data jsonb,
ADD COLUMN furniture_data jsonb;