-- Create categories table with hierarchical support
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nom TEXT NOT NULL,
  parent_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own categories" 
ON public.categories 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own categories" 
ON public.categories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" 
ON public.categories 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" 
ON public.categories 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add category_id to accessories_catalog
ALTER TABLE public.accessories_catalog 
ADD COLUMN category_id UUID,
ADD FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX idx_accessories_category_id ON public.accessories_catalog(category_id);