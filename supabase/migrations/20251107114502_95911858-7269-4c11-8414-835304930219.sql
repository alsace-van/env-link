-- Add vehicle-related columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_vin VARCHAR(17);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_immatriculation VARCHAR(20);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_marque VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_modele VARCHAR(150);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_type_variante_version TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_denomination_commerciale VARCHAR(200);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_genre VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_carrosserie VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_couleur VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_nombre_places INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_puissance_fiscale INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_cylindree INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_energie VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_masse_vide INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_ptac INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_ptra INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_ptr_essieu_avant INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_ptr_essieu_arriere INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_date_premiere_immatriculation DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_longueur INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_largeur INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_hauteur INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_empattement INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_scan_data JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_scan_confidence INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vehicle_scanned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_projects_vehicle_vin ON projects(vehicle_vin);
CREATE INDEX IF NOT EXISTS idx_projects_vehicle_immatriculation ON projects(vehicle_immatriculation);

COMMENT ON COLUMN projects.vehicle_scan_data IS 'Données brutes du scan Gemini';
COMMENT ON COLUMN projects.vehicle_scan_confidence IS 'Niveau de confiance (0-100)';