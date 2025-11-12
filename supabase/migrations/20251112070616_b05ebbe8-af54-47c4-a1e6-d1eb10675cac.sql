-- Fix shipping_fees table: add user_id and fix RLS
-- Check if user_id column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipping_fees' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.shipping_fees 
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    
    -- Add index for performance
    CREATE INDEX IF NOT EXISTS idx_shipping_fees_user_id ON public.shipping_fees(user_id);
  END IF;
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own shipping fees" ON public.shipping_fees;
DROP POLICY IF EXISTS "Users can create their own shipping fees" ON public.shipping_fees;
DROP POLICY IF EXISTS "Users can update their own shipping fees" ON public.shipping_fees;
DROP POLICY IF EXISTS "Users can delete their own shipping fees" ON public.shipping_fees;

-- Enable RLS
ALTER TABLE public.shipping_fees ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for shipping_fees
CREATE POLICY "Users can view their own shipping fees"
ON public.shipping_fees FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own shipping fees"
ON public.shipping_fees FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipping fees"
ON public.shipping_fees FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipping fees"
ON public.shipping_fees FOR DELETE
USING (auth.uid() = user_id);

-- Fix technical_schemas table: rename schema_number to schema_name if needed
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'technical_schemas' 
    AND column_name = 'schema_number'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'technical_schemas' 
    AND column_name = 'schema_name'
  ) THEN
    -- Add schema_number column as integer if it doesn't exist
    ALTER TABLE public.technical_schemas 
    ADD COLUMN schema_number INTEGER NOT NULL DEFAULT 1;
    
    -- Add index
    CREATE INDEX IF NOT EXISTS idx_technical_schemas_project_schema 
    ON public.technical_schemas(project_id, schema_number);
  END IF;
END $$;