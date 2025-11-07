-- Create categories table for organizing accessories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for categories
CREATE POLICY "Users can manage their own categories"
ON public.categories
FOR ALL
USING (auth.uid() = user_id);

-- Create accessories_catalog table
CREATE TABLE IF NOT EXISTS public.accessories_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nom TEXT NOT NULL,
  marque TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  prix_reference NUMERIC,
  prix_vente_ttc NUMERIC,
  marge_pourcent NUMERIC,
  marge_nette NUMERIC,
  fournisseur TEXT,
  description TEXT,
  url_produit TEXT,
  type_electrique TEXT,
  poids_kg NUMERIC,
  longueur_mm INTEGER,
  largeur_mm INTEGER,
  hauteur_mm INTEGER,
  puissance_watts NUMERIC,
  intensite_amperes NUMERIC,
  available_in_shop BOOLEAN DEFAULT false,
  image_url TEXT,
  stock_status TEXT DEFAULT 'in_stock',
  stock_quantity INTEGER,
  delivery_date DATE,
  tracking_number TEXT,
  expected_delivery_date DATE,
  stock_notes TEXT,
  supplier_order_ref TEXT,
  last_stock_update TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on accessories_catalog
ALTER TABLE public.accessories_catalog ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for accessories_catalog
CREATE POLICY "Users can manage their own accessories"
ON public.accessories_catalog
FOR ALL
USING (auth.uid() = user_id);

-- Create accessory_options table
CREATE TABLE IF NOT EXISTS public.accessory_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  accessory_id UUID NOT NULL REFERENCES public.accessories_catalog(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prix_reference NUMERIC,
  prix_vente_ttc NUMERIC,
  marge_pourcent NUMERIC,
  marge_nette NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on accessory_options
ALTER TABLE public.accessory_options ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for accessory_options (inherit from accessories_catalog)
CREATE POLICY "Users can manage their own accessory options"
ON public.accessory_options
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.accessories_catalog
    WHERE accessories_catalog.id = accessory_options.accessory_id
    AND accessories_catalog.user_id = auth.uid()
  )
);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_accessories_catalog_updated_at
BEFORE UPDATE ON public.accessories_catalog
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();