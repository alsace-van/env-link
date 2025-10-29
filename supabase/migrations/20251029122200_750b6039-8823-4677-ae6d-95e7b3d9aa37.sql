-- Ajouter une colonne couleur à la table accessories_catalog
ALTER TABLE accessories_catalog
ADD COLUMN couleur text;

COMMENT ON COLUMN accessories_catalog.couleur IS 'Couleur disponible pour l''accessoire (noir, blanc, gris, rouge, bleu, vert, jaune, orange, etc.)';