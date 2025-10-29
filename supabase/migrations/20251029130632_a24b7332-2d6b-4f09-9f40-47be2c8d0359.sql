-- Drop the old foreign key constraint
ALTER TABLE accessories_catalog
DROP CONSTRAINT IF EXISTS accessories_catalog_category_id_fkey;