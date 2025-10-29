-- Drop the constraint we added (keep the original one)
ALTER TABLE accessories_catalog
DROP CONSTRAINT IF EXISTS fk_accessories_catalog_category;