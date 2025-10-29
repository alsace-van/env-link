-- Créer la table pour les options d'accessoires
CREATE TABLE IF NOT EXISTS public.accessory_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  accessory_id UUID NOT NULL REFERENCES public.accessories_catalog(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prix NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Créer la table pour stocker les options sélectionnées dans les dépenses
CREATE TABLE IF NOT EXISTS public.expense_selected_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES public.project_expenses(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.accessory_options(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(expense_id, option_id)
);

-- Modifier la table shop_custom_kits pour stocker les catégories au lieu des contraintes min/max
ALTER TABLE public.shop_custom_kits DROP COLUMN IF EXISTS min_items;
ALTER TABLE public.shop_custom_kits DROP COLUMN IF EXISTS max_items;
ALTER TABLE public.shop_custom_kits DROP COLUMN IF EXISTS base_price;
ALTER TABLE public.shop_custom_kits ADD COLUMN IF NOT EXISTS allowed_category_ids UUID[] DEFAULT '{}';

-- Supprimer la table shop_custom_kit_available_items car on va sélectionner par catégorie
DROP TABLE IF EXISTS public.shop_custom_kit_available_items;

-- RLS pour accessory_options
ALTER TABLE public.accessory_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view options of their own accessories"
  ON public.accessory_options
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.accessories_catalog
      WHERE accessories_catalog.id = accessory_options.accessory_id
      AND accessories_catalog.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create options for their own accessories"
  ON public.accessory_options
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accessories_catalog
      WHERE accessories_catalog.id = accessory_options.accessory_id
      AND accessories_catalog.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update options of their own accessories"
  ON public.accessory_options
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.accessories_catalog
      WHERE accessories_catalog.id = accessory_options.accessory_id
      AND accessories_catalog.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete options of their own accessories"
  ON public.accessory_options
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.accessories_catalog
      WHERE accessories_catalog.id = accessory_options.accessory_id
      AND accessories_catalog.user_id = auth.uid()
    )
  );

-- RLS pour expense_selected_options
ALTER TABLE public.expense_selected_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view selected options of their own expenses"
  ON public.expense_selected_options
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_expenses
      JOIN public.projects ON projects.id = project_expenses.project_id
      WHERE project_expenses.id = expense_selected_options.expense_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create selected options for their own expenses"
  ON public.expense_selected_options
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_expenses
      JOIN public.projects ON projects.id = project_expenses.project_id
      WHERE project_expenses.id = expense_selected_options.expense_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete selected options of their own expenses"
  ON public.expense_selected_options
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_expenses
      JOIN public.projects ON projects.id = project_expenses.project_id
      WHERE project_expenses.id = expense_selected_options.expense_id
      AND projects.user_id = auth.uid()
    )
  );

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_accessory_options_accessory_id ON public.accessory_options(accessory_id);
CREATE INDEX IF NOT EXISTS idx_expense_selected_options_expense_id ON public.expense_selected_options(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_selected_options_option_id ON public.expense_selected_options(option_id);