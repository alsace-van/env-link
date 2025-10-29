-- Check and drop any duplicate constraint
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_accessories_catalog_category'
    ) THEN
        ALTER TABLE accessories_catalog DROP CONSTRAINT fk_accessories_catalog_category;
    END IF;
END $$;