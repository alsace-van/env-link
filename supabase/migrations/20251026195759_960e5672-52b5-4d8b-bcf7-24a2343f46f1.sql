-- Ajouter les colonnes pour les dimensions de la zone de chargement
ALTER TABLE public.projects
ADD COLUMN longueur_chargement_mm integer,
ADD COLUMN largeur_chargement_mm integer;