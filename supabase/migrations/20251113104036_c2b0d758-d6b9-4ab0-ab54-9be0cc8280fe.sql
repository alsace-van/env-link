-- Mise à jour des dimensions utiles pour tous les véhicules du catalogue

-- PEUGEOT EXPERT (2016+)
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2162, largeur_chargement_mm = 1628
WHERE marque = 'PEUGEOT' AND modele = 'Expert L1H1';

-- L'utilisateur a spécifié ces dimensions pour le L2H1 2018
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2584, largeur_chargement_mm = 1600
WHERE marque = 'PEUGEOT' AND modele = 'Expert L2H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2862, largeur_chargement_mm = 1628
WHERE marque = 'PEUGEOT' AND modele = 'Expert L3H1';

-- CITROËN JUMPY (2016+)
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2162, largeur_chargement_mm = 1628
WHERE marque IN ('CITROËN', 'Citroën') AND modele = 'Jumpy L1H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2512, largeur_chargement_mm = 1628
WHERE marque IN ('CITROËN', 'Citroën') AND modele = 'Jumpy L2H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2862, largeur_chargement_mm = 1628
WHERE marque IN ('CITROËN', 'Citroën') AND modele = 'Jumpy L3H1';

-- FIAT SCUDO (même plateforme que Jumpy/Expert)
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2162, largeur_chargement_mm = 1628
WHERE marque = 'FIAT' AND modele = 'Scudo L1H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2512, largeur_chargement_mm = 1628
WHERE marque = 'FIAT' AND modele = 'Scudo L2H1';

-- FIAT DUCATO
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2670, largeur_chargement_mm = 1870
WHERE marque = 'FIAT' AND modele LIKE 'Ducato L1%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3120, largeur_chargement_mm = 1870
WHERE marque = 'FIAT' AND modele LIKE 'Ducato L2%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3705, largeur_chargement_mm = 1870
WHERE marque = 'FIAT' AND modele LIKE 'Ducato L3%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 4070, largeur_chargement_mm = 1870
WHERE marque = 'FIAT' AND modele LIKE 'Ducato L4%';

-- CITROËN JUMPER (même plateforme que Ducato)
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2670, largeur_chargement_mm = 1870
WHERE marque IN ('CITROËN', 'Citroën') AND modele LIKE 'Jumper L1%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3120, largeur_chargement_mm = 1870
WHERE marque IN ('CITROËN', 'Citroën') AND modele LIKE 'Jumper L2%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3705, largeur_chargement_mm = 1870
WHERE marque IN ('CITROËN', 'Citroën') AND modele LIKE 'Jumper L3%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 4070, largeur_chargement_mm = 1870
WHERE marque IN ('CITROËN', 'Citroën') AND modele LIKE 'Jumper L4%';

-- MERCEDES SPRINTER
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2600, largeur_chargement_mm = 1780
WHERE marque IN ('MERCEDES', 'Mercedes', 'Mercedes-Benz') AND modele LIKE 'Sprinter L1%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3260, largeur_chargement_mm = 1780
WHERE marque IN ('MERCEDES', 'Mercedes', 'Mercedes-Benz') AND modele LIKE 'Sprinter L2%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 4300, largeur_chargement_mm = 1780
WHERE marque IN ('MERCEDES', 'Mercedes', 'Mercedes-Benz') AND modele LIKE 'Sprinter L3%';

-- FORD TRANSIT CUSTOM
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2555, largeur_chargement_mm = 1392
WHERE marque = 'FORD' AND modele = 'Transit Custom L1H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2870, largeur_chargement_mm = 1392
WHERE marque = 'FORD' AND modele = 'Transit Custom L2H1';

-- FORD TRANSIT
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2472, largeur_chargement_mm = 1784
WHERE marque = 'FORD' AND modele LIKE 'Transit L2%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3057, largeur_chargement_mm = 1784
WHERE marque = 'FORD' AND modele LIKE 'Transit L3%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 4229, largeur_chargement_mm = 1784
WHERE marque = 'FORD' AND modele LIKE 'Transit L4%';

-- RENAULT TRAFIC
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2490, largeur_chargement_mm = 1562
WHERE marque = 'RENAULT' AND modele = 'Trafic L1H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2940, largeur_chargement_mm = 1562
WHERE marque = 'RENAULT' AND modele = 'Trafic L2H1';

-- VOLKSWAGEN TRANSPORTER
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2572, largeur_chargement_mm = 1700
WHERE marque IN ('VOLKSWAGEN', 'Volkswagen') AND modele LIKE 'Transporter%';

-- CITROËN BERLINGO
UPDATE vehicles_catalog
SET longueur_chargement_mm = 1817, largeur_chargement_mm = 1230
WHERE marque = 'CITROËN' AND modele = 'Berlingo L1H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2167, largeur_chargement_mm = 1230
WHERE marque = 'CITROËN' AND modele = 'Berlingo XL L2H1';

-- FIAT DOBLO
UPDATE vehicles_catalog
SET longueur_chargement_mm = 1795, largeur_chargement_mm = 1230
WHERE marque = 'FIAT' AND modele = 'Doblo L1H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2143, largeur_chargement_mm = 1230
WHERE marque = 'FIAT' AND modele = 'Doblo Maxi L2H1';

-- FIAT TALENTO (même plateforme que Trafic)
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2490, largeur_chargement_mm = 1562
WHERE marque = 'FIAT' AND modele = 'Talento L1H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2940, largeur_chargement_mm = 1562
WHERE marque = 'FIAT' AND modele = 'Talento L2H1';

-- OPEL VIVARO (même plateforme que Trafic)
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2490, largeur_chargement_mm = 1562
WHERE marque = 'OPEL' AND modele = 'Vivaro L1H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2940, largeur_chargement_mm = 1562
WHERE marque = 'OPEL' AND modele = 'Vivaro L2H1';

-- FORD TRANSIT CONNECT
UPDATE vehicles_catalog
SET longueur_chargement_mm = 1753, largeur_chargement_mm = 1226
WHERE marque = 'FORD' AND modele = 'Transit Connect L1H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2150, largeur_chargement_mm = 1226
WHERE marque = 'FORD' AND modele = 'Transit Connect L2H1';

-- VOLKSWAGEN CADDY
UPDATE vehicles_catalog
SET longueur_chargement_mm = 1913, largeur_chargement_mm = 1185
WHERE marque IN ('VOLKSWAGEN', 'Volkswagen') AND modele LIKE 'Caddy%L1%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2265, largeur_chargement_mm = 1185
WHERE marque IN ('VOLKSWAGEN', 'Volkswagen') AND modele LIKE 'Caddy%L2%';