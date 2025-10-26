-- Add new fields to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS numero_chassis text,
ADD COLUMN IF NOT EXISTS immatriculation text,
ADD COLUMN IF NOT EXISTS date_mise_circulation date,
ADD COLUMN IF NOT EXISTS type_mine text;

-- Insert missing vehicle models
INSERT INTO public.vehicles_catalog (marque, modele, longueur_mm, largeur_mm, hauteur_mm, ptac_kg, charge_utile_kg, poids_vide_kg) VALUES
-- Volkswagen Transporter T5 and T4
('Volkswagen', 'Transporter T5 L1H1', 4892, 1904, 1990, 3000, 1200, 1800),
('Volkswagen', 'Transporter T5 L2H1', 5292, 1904, 1990, 3200, 1400, 1800),
('Volkswagen', 'Transporter T4 L1H1', 4700, 1840, 1940, 2800, 1100, 1700),
('Volkswagen', 'Transporter T4 L2H1', 5100, 1840, 1940, 3000, 1300, 1700),

-- Peugeot Expert 3 sizes (L1, L2, L3)
('Peugeot', 'Expert L3H1', 5309, 1920, 1895, 3000, 1400, 1600),

-- Citroën Jumpy already has L1H1, L2H1, L3H1 - no need to add

-- Add more common variants
('Mercedes', 'Sprinter L1H1', 5532, 1993, 2426, 3500, 1200, 2300),
('Mercedes', 'Sprinter L1H2', 5532, 1993, 2426, 3500, 1200, 2300),
('Fiat', 'Ducato L1H2', 4963, 2050, 2524, 3300, 1400, 1900),
('Ford', 'Transit L1H1', 5339, 2474, 2256, 3500, 1300, 2200),
('Ford', 'Transit L1H2', 5339, 2474, 2471, 3500, 1300, 2200)
ON CONFLICT DO NOTHING;