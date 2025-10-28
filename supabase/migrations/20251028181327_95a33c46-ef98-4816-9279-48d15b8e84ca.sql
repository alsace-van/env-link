-- Create a table for bank balance tracking
CREATE TABLE public.project_bank_balance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  solde_depart NUMERIC NOT NULL DEFAULT 0,
  date_heure_depart TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.project_bank_balance ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view balance of own projects" 
ON public.project_bank_balance 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = project_bank_balance.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create balance for own projects" 
ON public.project_bank_balance 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = project_bank_balance.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update balance of own projects" 
ON public.project_bank_balance 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = project_bank_balance.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete balance of own projects" 
ON public.project_bank_balance 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = project_bank_balance.project_id 
  AND projects.user_id = auth.uid()
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_project_bank_balance_updated_at
BEFORE UPDATE ON public.project_bank_balance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();