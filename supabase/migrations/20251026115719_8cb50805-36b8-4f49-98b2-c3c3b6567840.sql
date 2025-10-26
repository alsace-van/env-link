-- Ajouter les colonnes pour le temps d'utilisation des consommateurs et le temps de production des producteurs
ALTER TABLE public.project_expenses 
ADD COLUMN temps_utilisation_heures numeric CHECK (temps_utilisation_heures >= 0 AND temps_utilisation_heures <= 24),
ADD COLUMN temps_production_heures numeric CHECK (temps_production_heures >= 0 AND temps_production_heures <= 24);

COMMENT ON COLUMN public.project_expenses.temps_utilisation_heures IS 'Temps d''utilisation par jour en heures (0-24h) pour les consommateurs';
COMMENT ON COLUMN public.project_expenses.temps_production_heures IS 'Temps de production par jour en heures (0-24h) pour les producteurs';