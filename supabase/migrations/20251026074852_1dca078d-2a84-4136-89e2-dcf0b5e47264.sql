-- Add more vehicle models
INSERT INTO public.vehicles_catalog (marque, modele, longueur_mm, largeur_mm, hauteur_mm, ptac_kg, charge_utile_kg, poids_vide_kg) VALUES
-- More Volkswagen variants
('Volkswagen', 'Crafter L1H1', 5986, 2040, 2280, 3500, 1300, 2200),
('Volkswagen', 'Crafter L2H2', 6836, 2040, 2595, 3500, 1500, 2000),
('Volkswagen', 'Crafter L3H2', 7391, 2040, 2595, 3500, 1600, 1900),
('Volkswagen', 'Crafter L4H3', 7391, 2040, 2780, 3500, 1700, 1800),

-- More Mercedes variants
('Mercedes', 'Vito L3H1', 5370, 1928, 1910, 3200, 1500, 1700),
('Mercedes', 'Sprinter L4H3', 7340, 1993, 2755, 3500, 1700, 1800),

-- More Fiat variants
('Fiat', 'Talento L1H1', 4999, 1956, 1967, 2900, 1200, 1700),
('Fiat', 'Talento L2H1', 5399, 1956, 1967, 3100, 1400, 1700),

-- More Ford variants
('Ford', 'Transit L4H3', 7339, 2474, 2779, 3500, 1800, 1700),
('Ford', 'Transit Connect', 4826, 1835, 1861, 2300, 900, 1400),

-- More Renault variants
('Renault', 'Master L1H1', 4999, 2070, 2526, 3300, 1300, 2000),
('Renault', 'Master L2H2', 5499, 2070, 2526, 3500, 1500, 2000),
('Renault', 'Master L3H2', 6198, 2070, 2526, 3500, 1600, 1900),
('Renault', 'Master L4H2', 6898, 2070, 2526, 3500, 1700, 1800),

-- Iveco
('Iveco', 'Daily L1H1', 5085, 2050, 2250, 3300, 1300, 2000),
('Iveco', 'Daily L2H2', 5585, 2050, 2520, 3500, 1500, 2000),
('Iveco', 'Daily L3H2', 6285, 2050, 2520, 3500, 1600, 1900),

-- Toyota
('Toyota', 'Proace L1H1', 4609, 1920, 1895, 2600, 1000, 1600),
('Toyota', 'Proace L2H1', 4959, 1920, 1895, 2800, 1200, 1600),
('Toyota', 'Proace L3H1', 5309, 1920, 1895, 3000, 1400, 1600),

-- Nissan
('Nissan', 'NV400 L1H1', 4999, 2070, 2526, 3300, 1300, 2000),
('Nissan', 'NV400 L2H2', 5499, 2070, 2526, 3500, 1500, 2000)
ON CONFLICT DO NOTHING;