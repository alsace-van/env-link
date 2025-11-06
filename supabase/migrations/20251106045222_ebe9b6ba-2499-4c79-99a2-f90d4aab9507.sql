-- Add missing columns to accessories_catalog
ALTER TABLE public.accessories_catalog
ADD COLUMN IF NOT EXISTS prix_vente numeric;

-- Create shipping_fees table
CREATE TABLE IF NOT EXISTS public.shipping_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  nom text NOT NULL,
  type text NOT NULL CHECK (type IN ('fixed', 'variable', 'free', 'pickup')),
  fixed_price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create shipping_fee_tiers table
CREATE TABLE IF NOT EXISTS public.shipping_fee_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_fee_id uuid NOT NULL REFERENCES public.shipping_fees ON DELETE CASCADE,
  quantity_from integer NOT NULL,
  quantity_to integer,
  total_price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create accessory_shipping_fees link table
CREATE TABLE IF NOT EXISTS public.accessory_shipping_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accessory_id uuid NOT NULL REFERENCES public.accessories_catalog ON DELETE CASCADE,
  shipping_fee_id uuid NOT NULL REFERENCES public.shipping_fees ON DELETE CASCADE,
  visible_boutique boolean NOT NULL DEFAULT false,
  visible_depenses boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create official_documents table
CREATE TABLE IF NOT EXISTS public.official_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  file_url text NOT NULL,
  description text,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create user_filled_documents table  
CREATE TABLE IF NOT EXISTS public.user_filled_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects ON DELETE CASCADE,
  official_document_id uuid REFERENCES public.official_documents ON DELETE CASCADE,
  name text NOT NULL,
  file_url text NOT NULL,
  filled_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shipping_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_fee_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accessory_shipping_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_filled_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for shipping_fees
CREATE POLICY "Users can view own shipping fees" ON public.shipping_fees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own shipping fees" ON public.shipping_fees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shipping fees" ON public.shipping_fees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shipping fees" ON public.shipping_fees FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for shipping_fee_tiers
CREATE POLICY "Users can view tiers" ON public.shipping_fee_tiers FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.shipping_fees WHERE id = shipping_fee_id AND user_id = auth.uid()));
CREATE POLICY "Users can create tiers" ON public.shipping_fee_tiers FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.shipping_fees WHERE id = shipping_fee_id AND user_id = auth.uid()));
CREATE POLICY "Users can update tiers" ON public.shipping_fee_tiers FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.shipping_fees WHERE id = shipping_fee_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete tiers" ON public.shipping_fee_tiers FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.shipping_fees WHERE id = shipping_fee_id AND user_id = auth.uid()));

-- RLS policies for accessory_shipping_fees
CREATE POLICY "Users can view accessory shipping fees" ON public.accessory_shipping_fees FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.accessories_catalog WHERE id = accessory_id AND user_id = auth.uid()));
CREATE POLICY "Users can create accessory shipping fees" ON public.accessory_shipping_fees FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.accessories_catalog WHERE id = accessory_id AND user_id = auth.uid()));
CREATE POLICY "Users can update accessory shipping fees" ON public.accessory_shipping_fees FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.accessories_catalog WHERE id = accessory_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete accessory shipping fees" ON public.accessory_shipping_fees FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.accessories_catalog WHERE id = accessory_id AND user_id = auth.uid()));

-- RLS policies for official_documents (public read, admin write)
CREATE POLICY "Anyone can view active official documents" ON public.official_documents FOR SELECT USING (is_active = true);

-- RLS policies for user_filled_documents
CREATE POLICY "Users can view own filled documents" ON public.user_filled_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own filled documents" ON public.user_filled_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own filled documents" ON public.user_filled_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own filled documents" ON public.user_filled_documents FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shipping_fee_tiers_shipping_fee_id ON public.shipping_fee_tiers(shipping_fee_id);
CREATE INDEX IF NOT EXISTS idx_accessory_shipping_fees_accessory_id ON public.accessory_shipping_fees(accessory_id);
CREATE INDEX IF NOT EXISTS idx_accessory_shipping_fees_shipping_fee_id ON public.accessory_shipping_fees(shipping_fee_id);
CREATE INDEX IF NOT EXISTS idx_user_filled_documents_user_id ON public.user_filled_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_filled_documents_project_id ON public.user_filled_documents(project_id);