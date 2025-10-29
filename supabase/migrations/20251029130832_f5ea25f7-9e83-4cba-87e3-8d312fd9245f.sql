-- Re-create the foreign key with the correct name
ALTER TABLE accessories_catalog
ADD CONSTRAINT accessories_catalog_category_id_fkey
FOREIGN KEY (category_id) 
REFERENCES categories(id)
ON DELETE SET NULL;