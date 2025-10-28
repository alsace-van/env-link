-- Create table for monthly charges
CREATE TABLE public.project_monthly_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  nom_charge TEXT NOT NULL,
  montant NUMERIC NOT NULL DEFAULT 0,
  date_echeance DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.project_monthly_charges ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view charges of own projects" 
ON public.project_monthly_charges 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = project_monthly_charges.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create charges for own projects" 
ON public.project_monthly_charges 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = project_monthly_charges.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update charges of own projects" 
ON public.project_monthly_charges 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = project_monthly_charges.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete charges of own projects" 
ON public.project_monthly_charges 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = project_monthly_charges.project_id 
  AND projects.user_id = auth.uid()
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_project_monthly_charges_updated_at
BEFORE UPDATE ON public.project_monthly_charges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for installment payments
CREATE TABLE public.project_installment_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  nom_paiement TEXT NOT NULL,
  montant_total NUMERIC NOT NULL DEFAULT 0,
  montant_mensualite NUMERIC NOT NULL DEFAULT 0,
  nombre_mensualites_total INTEGER NOT NULL DEFAULT 1,
  nombre_mensualites_restantes INTEGER NOT NULL DEFAULT 1,
  date_debut DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.project_installment_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view installments of own projects" 
ON public.project_installment_payments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = project_installment_payments.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create installments for own projects" 
ON public.project_installment_payments 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = project_installment_payments.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update installments of own projects" 
ON public.project_installment_payments 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = project_installment_payments.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete installments of own projects" 
ON public.project_installment_payments 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = project_installment_payments.project_id 
  AND projects.user_id = auth.uid()
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_project_installment_payments_updated_at
BEFORE UPDATE ON public.project_installment_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();