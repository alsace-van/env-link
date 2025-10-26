-- Insert popular utility vehicles into the catalog
INSERT INTO public.vehicles_catalog (marque, modele, longueur_mm, largeur_mm, hauteur_mm, ptac_kg, charge_utile_kg, poids_vide_kg) VALUES
-- Citroën
('Citroën', 'Jumpy L1H1', 4609, 1920, 1895, 2600, 1000, 1600),
('Citroën', 'Jumpy L2H1', 4959, 1920, 1895, 2800, 1200, 1600),
('Citroën', 'Jumpy L3H1', 5309, 1920, 1895, 3000, 1400, 1600),
('Citroën', 'Berlingo', 4403, 1848, 1797, 1950, 800, 1150),

-- Renault
('Renault', 'Trafic L1H1', 4999, 1956, 1967, 2900, 1200, 1700),
('Renault', 'Trafic L2H1', 5399, 1956, 1967, 3100, 1400, 1700),
('Renault', 'Kangoo', 4486, 1829, 1838, 2100, 650, 1450),

-- Volkswagen
('Volkswagen', 'Transporter T6.1 L1H1', 4904, 1904, 1990, 3000, 1200, 1800),
('Volkswagen', 'Transporter T6.1 L2H1', 5304, 1904, 1990, 3200, 1400, 1800),
('Volkswagen', 'Caddy', 4500, 1793, 1819, 2100, 800, 1300),

-- Mercedes
('Mercedes', 'Vito L1H1', 4895, 1928, 1910, 3050, 1200, 1850),
('Mercedes', 'Vito L2H1', 5140, 1928, 1910, 3200, 1400, 1800),
('Mercedes', 'Sprinter L2H2', 5932, 1993, 2426, 3500, 1400, 2100),
('Mercedes', 'Sprinter L3H2', 6940, 1993, 2426, 3500, 1600, 1900),
('Mercedes', 'Citan', 4498, 1829, 1811, 2100, 650, 1450),

-- Peugeot
('Peugeot', 'Expert L1H1', 4609, 1920, 1895, 2600, 1000, 1600),
('Peugeot', 'Expert L2H1', 4959, 1920, 1895, 2800, 1200, 1600),
('Peugeot', 'Partner', 4403, 1848, 1797, 1950, 800, 1150),

-- Fiat
('Fiat', 'Ducato L1H1', 4963, 2050, 2254, 3300, 1350, 1950),
('Fiat', 'Ducato L2H2', 5413, 2050, 2524, 3500, 1500, 2000),
('Fiat', 'Ducato L3H2', 5998, 2050, 2524, 3500, 1700, 1800),
('Fiat', 'Ducato L4H2', 6363, 2050, 2524, 3500, 1800, 1700),
('Fiat', 'Doblo', 4390, 1832, 1850, 2000, 800, 1200),

-- Ford
('Ford', 'Transit Custom L1H1', 4972, 2059, 1974, 3000, 1200, 1800),
('Ford', 'Transit Custom L2H1', 5339, 2059, 1974, 3100, 1400, 1700),
('Ford', 'Transit L2H2', 5531, 2474, 2471, 3500, 1400, 2100),
('Ford', 'Transit L3H2', 6704, 2474, 2471, 3500, 1600, 1900),

-- Opel
('Opel', 'Vivaro L1H1', 4999, 1956, 1967, 2900, 1200, 1700),
('Opel', 'Vivaro L2H1', 5399, 1956, 1967, 3100, 1400, 1700),
('Opel', 'Combo', 4403, 1848, 1797, 1950, 800, 1150),

-- Nissan
('Nissan', 'NV300 L1H1', 4999, 1956, 1967, 2900, 1200, 1700),
('Nissan', 'NV300 L2H1', 5399, 1956, 1967, 3100, 1400, 1700)
ON CONFLICT DO NOTHING;