-- Add foreign key constraint between accessories_catalog and categories
ALTER TABLE accessories_catalog
ADD CONSTRAINT fk_accessories_catalog_category
FOREIGN KEY (category_id) 
REFERENCES categories(id)
ON DELETE SET NULL;