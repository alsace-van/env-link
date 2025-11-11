-- Add missing columns to existing tables
ALTER TABLE public.shop_welcome_config ADD COLUMN IF NOT EXISTS button_text TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS nom_proprietaire TEXT;

-- Create project_bank_balance table
CREATE TABLE IF NOT EXISTS public.project_bank_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  solde_depart DECIMAL(10,2) NOT NULL DEFAULT 0,
  date_heure_depart TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

-- Create expense_selected_options table
CREATE TABLE IF NOT EXISTS public.expense_selected_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.project_expenses(id) ON DELETE CASCADE,
  option_id UUID NOT NULL,
  option_name TEXT NOT NULL,
  prix_vente_ttc DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create project_todos table
CREATE TABLE IF NOT EXISTS public.project_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT false,
  due_date DATE,
  priority TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create shop_custom_kits table
CREATE TABLE IF NOT EXISTS public.shop_custom_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  description TEXT,
  prix_base DECIMAL(10,2) NOT NULL DEFAULT 0,
  allowed_category_ids UUID[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create accessory_tiered_pricing table
CREATE TABLE IF NOT EXISTS public.accessory_tiered_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessory_id UUID NOT NULL REFERENCES public.accessories_catalog(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL,
  max_quantity INTEGER,
  prix_unitaire DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_bank_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_selected_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_custom_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accessory_tiered_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_bank_balance
CREATE POLICY "Users can view their own project bank balance"
  ON public.project_bank_balance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own project bank balance"
  ON public.project_bank_balance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project bank balance"
  ON public.project_bank_balance FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project bank balance"
  ON public.project_bank_balance FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for expense_selected_options
CREATE POLICY "Users can view expense options for their projects"
  ON public.expense_selected_options FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.project_expenses pe
    WHERE pe.id = expense_selected_options.expense_id
    AND pe.user_id = auth.uid()
  ));

CREATE POLICY "Users can create expense options for their projects"
  ON public.expense_selected_options FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_expenses pe
    WHERE pe.id = expense_selected_options.expense_id
    AND pe.user_id = auth.uid()
  ));

CREATE POLICY "Users can update expense options for their projects"
  ON public.expense_selected_options FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.project_expenses pe
    WHERE pe.id = expense_selected_options.expense_id
    AND pe.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete expense options for their projects"
  ON public.expense_selected_options FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.project_expenses pe
    WHERE pe.id = expense_selected_options.expense_id
    AND pe.user_id = auth.uid()
  ));

-- RLS Policies for project_todos
CREATE POLICY "Users can view their own project todos"
  ON public.project_todos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own project todos"
  ON public.project_todos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project todos"
  ON public.project_todos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project todos"
  ON public.project_todos FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for shop_custom_kits
CREATE POLICY "Users can view their own custom kits"
  ON public.shop_custom_kits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom kits"
  ON public.shop_custom_kits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom kits"
  ON public.shop_custom_kits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom kits"
  ON public.shop_custom_kits FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for accessory_tiered_pricing
CREATE POLICY "Users can view tiered pricing for their accessories"
  ON public.accessory_tiered_pricing FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.accessories_catalog ac
    WHERE ac.id = accessory_tiered_pricing.accessory_id
    AND ac.user_id = auth.uid()
  ));

CREATE POLICY "Users can create tiered pricing for their accessories"
  ON public.accessory_tiered_pricing FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.accessories_catalog ac
    WHERE ac.id = accessory_tiered_pricing.accessory_id
    AND ac.user_id = auth.uid()
  ));

CREATE POLICY "Users can update tiered pricing for their accessories"
  ON public.accessory_tiered_pricing FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.accessories_catalog ac
    WHERE ac.id = accessory_tiered_pricing.accessory_id
    AND ac.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete tiered pricing for their accessories"
  ON public.accessory_tiered_pricing FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.accessories_catalog ac
    WHERE ac.id = accessory_tiered_pricing.accessory_id
    AND ac.user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_bank_balance_project_id ON public.project_bank_balance(project_id);
CREATE INDEX IF NOT EXISTS idx_expense_selected_options_expense_id ON public.expense_selected_options(expense_id);
CREATE INDEX IF NOT EXISTS idx_project_todos_project_id ON public.project_todos(project_id);
CREATE INDEX IF NOT EXISTS idx_shop_custom_kits_user_id ON public.shop_custom_kits(user_id);
CREATE INDEX IF NOT EXISTS idx_accessory_tiered_pricing_accessory_id ON public.accessory_tiered_pricing(accessory_id);

-- Create update triggers
CREATE TRIGGER update_project_bank_balance_updated_at
  BEFORE UPDATE ON public.project_bank_balance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_todos_updated_at
  BEFORE UPDATE ON public.project_todos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shop_custom_kits_updated_at
  BEFORE UPDATE ON public.shop_custom_kits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accessory_tiered_pricing_updated_at
  BEFORE UPDATE ON public.accessory_tiered_pricing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();