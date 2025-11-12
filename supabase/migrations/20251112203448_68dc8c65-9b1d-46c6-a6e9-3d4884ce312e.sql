-- Add type_paiement column to project_payment_transactions table
ALTER TABLE project_payment_transactions 
ADD COLUMN IF NOT EXISTS type_paiement TEXT DEFAULT 'acompte' CHECK (type_paiement IN ('acompte', 'solde'));