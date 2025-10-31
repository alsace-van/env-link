-- ============================================
-- AUDIT & AJOUT DES COLONNES MANQUANTES
-- ============================================

-- 1. Ajouter expense_type à shop_orders
ALTER TABLE public.shop_orders 
ADD COLUMN IF NOT EXISTS expense_type TEXT DEFAULT 'purchase' CHECK (expense_type IN ('purchase', 'service', 'subscription', 'other'));

-- 2. Ajouter colonnes manquantes à projects
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS budget NUMERIC,
ADD COLUMN IF NOT EXISTS date_debut DATE,
ADD COLUMN IF NOT EXISTS date_fin DATE,
ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'en_cours' CHECK (statut IN ('nouveau', 'en_cours', 'en_attente', 'termine', 'annule'));

-- 3. Créer la table project_accessories (relation many-to-many)
CREATE TABLE IF NOT EXISTS public.project_accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  accessory_id UUID NOT NULL REFERENCES public.accessories_catalog(id) ON DELETE CASCADE,
  quantite INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
  prix_unitaire NUMERIC NOT NULL DEFAULT 0 CHECK (prix_unitaire >= 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, accessory_id)
);

-- Enable RLS sur project_accessories
ALTER TABLE public.project_accessories ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour project_accessories
CREATE POLICY "Users can view accessories of their own projects"
ON public.project_accessories
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = project_accessories.project_id
    AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create accessories for their own projects"
ON public.project_accessories
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = project_accessories.project_id
    AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update accessories of their own projects"
ON public.project_accessories
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = project_accessories.project_id
    AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete accessories from their own projects"
ON public.project_accessories
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = project_accessories.project_id
    AND projects.user_id = auth.uid()
));

-- 4. Créer des index pour project_accessories
CREATE INDEX IF NOT EXISTS idx_project_accessories_project_id ON public.project_accessories(project_id);
CREATE INDEX IF NOT EXISTS idx_project_accessories_accessory_id ON public.project_accessories(accessory_id);

-- 5. Ajouter trigger updated_at pour project_accessories
CREATE TRIGGER update_project_accessories_updated_at
BEFORE UPDATE ON public.project_accessories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Index supplémentaires manquants
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON public.calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_project_id ON public.calendar_events(project_id);

CREATE INDEX IF NOT EXISTS idx_shop_orders_user_id ON public.shop_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_customer_id ON public.shop_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON public.shop_orders(status);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_statut ON public.projects(statut);

CREATE INDEX IF NOT EXISTS idx_accessories_catalog_user_id ON public.accessories_catalog(user_id);
CREATE INDEX IF NOT EXISTS idx_accessories_catalog_category_id ON public.accessories_catalog(category_id);
CREATE INDEX IF NOT EXISTS idx_accessories_catalog_available_in_shop ON public.accessories_catalog(available_in_shop);
CREATE INDEX IF NOT EXISTS idx_accessories_catalog_stock_status ON public.accessories_catalog(stock_status);

-- 7. Commentaires sur les colonnes pour documentation
COMMENT ON COLUMN public.shop_orders.expense_type IS 'Type de dépense : purchase (achat), service, subscription (abonnement), other';
COMMENT ON COLUMN public.projects.statut IS 'Statut du projet : nouveau, en_cours, en_attente, termine, annule';
COMMENT ON COLUMN public.projects.budget IS 'Budget total prévu pour le projet';
COMMENT ON COLUMN public.projects.date_debut IS 'Date de début prévue du projet';
COMMENT ON COLUMN public.projects.date_fin IS 'Date de fin prévue du projet';
COMMENT ON TABLE public.project_accessories IS 'Table de liaison entre projets et accessoires du catalogue';