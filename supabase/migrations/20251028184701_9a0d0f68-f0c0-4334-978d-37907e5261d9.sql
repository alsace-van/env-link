-- Add payment related fields to project_expenses table
ALTER TABLE project_expenses 
ADD COLUMN IF NOT EXISTS date_paiement date,
ADD COLUMN IF NOT EXISTS delai_paiement text CHECK (delai_paiement IN ('commande', '30_jours'));