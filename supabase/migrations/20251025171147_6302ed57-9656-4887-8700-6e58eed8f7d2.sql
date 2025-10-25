-- Create table for payment transactions
CREATE TABLE public.project_payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  type_paiement TEXT NOT NULL CHECK (type_paiement IN ('acompte', 'solde')),
  montant NUMERIC NOT NULL DEFAULT 0,
  date_paiement DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.project_payment_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for payment transactions
CREATE POLICY "Users can view payments of own projects"
ON public.project_payment_transactions
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = project_payment_transactions.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create payments for own projects"
ON public.project_payment_transactions
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = project_payment_transactions.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update payments of own projects"
ON public.project_payment_transactions
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = project_payment_transactions.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete payments of own projects"
ON public.project_payment_transactions
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = project_payment_transactions.project_id
  AND projects.user_id = auth.uid()
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_payment_transactions_updated_at
BEFORE UPDATE ON public.project_payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();