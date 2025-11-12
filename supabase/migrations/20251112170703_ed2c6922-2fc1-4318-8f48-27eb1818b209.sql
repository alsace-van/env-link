-- Ajouter une colonne icon à la table categories
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '📦';

-- Mettre à jour quelques icônes par défaut si des catégories existent déjà
UPDATE categories SET icon = '💧' WHERE LOWER(nom) LIKE '%eau%' OR LOWER(nom) LIKE '%plomb%';
UPDATE categories SET icon = '⚡' WHERE LOWER(nom) LIKE '%electric%' OR LOWER(nom) LIKE '%élec%';
UPDATE categories SET icon = '🔥' WHERE LOWER(nom) LIKE '%gaz%' OR LOWER(nom) LIKE '%chauff%';
UPDATE categories SET icon = '🪟' WHERE LOWER(nom) LIKE '%vitre%' OR LOWER(nom) LIKE '%fenêtre%';
UPDATE categories SET icon = '🔧' WHERE LOWER(nom) LIKE '%outil%' OR LOWER(nom) LIKE '%mécanique%';
UPDATE categories SET icon = '🪵' WHERE LOWER(nom) LIKE '%bois%' OR LOWER(nom) LIKE '%menuiserie%';