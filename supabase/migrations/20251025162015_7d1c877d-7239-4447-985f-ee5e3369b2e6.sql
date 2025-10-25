-- Add new columns to project_expenses table for enhanced expense tracking
ALTER TABLE public.project_expenses 
ADD COLUMN IF NOT EXISTS categorie text,
ADD COLUMN IF NOT EXISTS statut_paiement text DEFAULT 'non_paye' CHECK (statut_paiement IN ('non_paye', 'paye')),
ADD COLUMN IF NOT EXISTS statut_livraison text DEFAULT 'commande' CHECK (statut_livraison IN ('commande', 'en_livraison', 'livre')),
ADD COLUMN IF NOT EXISTS accessory_id uuid REFERENCES public.accessories_catalog(id) ON DELETE SET NULL;

-- Create a new table for project payment tracking
CREATE TABLE IF NOT EXISTS public.project_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  acompte numeric DEFAULT 0,
  acompte_paye boolean DEFAULT false,
  solde numeric DEFAULT 0,
  solde_paye boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for project_payments
CREATE POLICY "Users can view payments of own projects"
ON public.project_payments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = project_payments.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create payments for own projects"
ON public.project_payments
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = project_payments.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update payments of own projects"
ON public.project_payments
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = project_payments.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete payments of own projects"
ON public.project_payments
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = project_payments.project_id
  AND projects.user_id = auth.uid()
));

-- Add trigger for updated_at
CREATE TRIGGER update_project_payments_updated_at
BEFORE UPDATE ON public.project_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();