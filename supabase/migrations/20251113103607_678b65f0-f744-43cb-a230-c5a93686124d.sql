-- Ajouter les colonnes manquantes
ALTER TABLE vehicles_catalog
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS longueur_chargement_mm integer,
ADD COLUMN IF NOT EXISTS largeur_chargement_mm integer;

-- Créer le trigger pour updated_at si il n'existe pas déjà
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_vehicles_catalog_updated_at') THEN
        CREATE TRIGGER update_vehicles_catalog_updated_at
        BEFORE UPDATE ON vehicles_catalog
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Mettre à jour les dimensions utiles pour le Peugeot Expert L2H1
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2584,
    largeur_chargement_mm = 1600
WHERE marque = 'PEUGEOT' AND modele = 'Expert L2H1';

-- Mettre à jour aussi les dimensions du projet actuel
UPDATE projects
SET longueur_chargement_mm = 2584,
    largeur_chargement_mm = 1600
WHERE id = '2ea843a3-1e4f-454e-9266-8d7981329915';