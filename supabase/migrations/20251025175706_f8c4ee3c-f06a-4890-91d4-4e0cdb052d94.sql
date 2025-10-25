-- Add category column to accessories_catalog
ALTER TABLE accessories_catalog 
ADD COLUMN categorie text;

-- Create index for better performance
CREATE INDEX idx_accessories_catalog_categorie ON accessories_catalog(categorie);