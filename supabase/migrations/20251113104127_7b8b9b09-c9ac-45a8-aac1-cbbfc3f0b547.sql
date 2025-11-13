-- Compléter les dimensions manquantes pour Mercedes, Renault, VW

-- MERCEDES SPRINTER (tous modèles)
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2600, largeur_chargement_mm = 1780
WHERE marque = 'MERCEDES' AND modele LIKE 'Sprinter%L1%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3260, largeur_chargement_mm = 1780
WHERE marque = 'MERCEDES' AND modele LIKE 'Sprinter%L2%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 4300, largeur_chargement_mm = 1780
WHERE marque = 'MERCEDES' AND modele LIKE 'Sprinter%L3%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 4300, largeur_chargement_mm = 1780
WHERE marque = 'MERCEDES' AND modele LIKE 'Sprinter%L4%';

-- MERCEDES VITO
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2280, largeur_chargement_mm = 1544
WHERE marque = 'MERCEDES' AND modele = 'Vito L1H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2650, largeur_chargement_mm = 1544
WHERE marque = 'MERCEDES' AND modele = 'Vito L2H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3030, largeur_chargement_mm = 1544
WHERE marque = 'MERCEDES' AND modele = 'Vito L3H1';

-- MERCEDES CITAN
UPDATE vehicles_catalog
SET longueur_chargement_mm = 1539, largeur_chargement_mm = 1524
WHERE marque = 'MERCEDES' AND modele = 'Citan L1H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2233, largeur_chargement_mm = 1524
WHERE marque = 'MERCEDES' AND modele = 'Citan Long L2H1';

-- RENAULT MASTER (même plateforme que Opel Movano)
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2600, largeur_chargement_mm = 1742
WHERE marque = 'RENAULT' AND modele LIKE 'Master L1%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3099, largeur_chargement_mm = 1742
WHERE marque = 'RENAULT' AND modele LIKE 'Master L2%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3684, largeur_chargement_mm = 1742
WHERE marque = 'RENAULT' AND modele LIKE 'Master L3%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 4049, largeur_chargement_mm = 1742
WHERE marque = 'RENAULT' AND modele LIKE 'Master L4%';

-- RENAULT KANGOO
UPDATE vehicles_catalog
SET longueur_chargement_mm = 1800, largeur_chargement_mm = 1210
WHERE marque = 'RENAULT' AND modele = 'Kangoo L1H1';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2150, largeur_chargement_mm = 1210
WHERE marque = 'RENAULT' AND modele = 'Kangoo Maxi L2H1';

-- RENAULT TRAFIC H2
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2490, largeur_chargement_mm = 1562
WHERE marque = 'RENAULT' AND modele = 'Trafic L1H2';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2940, largeur_chargement_mm = 1562
WHERE marque = 'RENAULT' AND modele = 'Trafic L2H2';

-- VOLKSWAGEN CRAFTER (même plateforme que Sprinter)
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2600, largeur_chargement_mm = 1780
WHERE marque = 'VOLKSWAGEN' AND modele LIKE 'Crafter L1%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3260, largeur_chargement_mm = 1780
WHERE marque = 'VOLKSWAGEN' AND modele LIKE 'Crafter L2%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 4300, largeur_chargement_mm = 1780
WHERE marque = 'VOLKSWAGEN' AND modele LIKE 'Crafter L3%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 4300, largeur_chargement_mm = 1780
WHERE marque = 'VOLKSWAGEN' AND modele LIKE 'Crafter L4%';

-- OPEL MOVANO (même plateforme que Master)
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2600, largeur_chargement_mm = 1742
WHERE marque = 'OPEL' AND modele LIKE 'Movano L1%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3099, largeur_chargement_mm = 1742
WHERE marque = 'OPEL' AND modele LIKE 'Movano L2%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3684, largeur_chargement_mm = 1742
WHERE marque = 'OPEL' AND modele LIKE 'Movano L3%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 4049, largeur_chargement_mm = 1742
WHERE marque = 'OPEL' AND modele LIKE 'Movano L4%';

-- OPEL COMBO
UPDATE vehicles_catalog
SET longueur_chargement_mm = 1800, largeur_chargement_mm = 1210
WHERE marque = 'OPEL' AND modele LIKE 'Combo%L1%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2150, largeur_chargement_mm = 1210
WHERE marque = 'OPEL' AND modele LIKE 'Combo%L2%';

-- NISSAN NV400 (même plateforme que Master)
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2600, largeur_chargement_mm = 1742
WHERE marque = 'NISSAN' AND modele LIKE 'NV400 L1%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3099, largeur_chargement_mm = 1742
WHERE marque = 'NISSAN' AND modele LIKE 'NV400 L2%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 3684, largeur_chargement_mm = 1742
WHERE marque = 'NISSAN' AND modele LIKE 'NV400 L3%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 4049, largeur_chargement_mm = 1742
WHERE marque = 'NISSAN' AND modele LIKE 'NV400 L4%';

-- NISSAN NV300 (même plateforme que Trafic)
UPDATE vehicles_catalog
SET longueur_chargement_mm = 2490, largeur_chargement_mm = 1562
WHERE marque = 'NISSAN' AND modele LIKE 'NV300 L1%';

UPDATE vehicles_catalog
SET longueur_chargement_mm = 2940, largeur_chargement_mm = 1562
WHERE marque = 'NISSAN' AND modele LIKE 'NV300 L2%';

-- NISSAN NV200
UPDATE vehicles_catalog
SET longueur_chargement_mm = 1800, largeur_chargement_mm = 1210
WHERE marque = 'NISSAN' AND modele LIKE 'NV200%';