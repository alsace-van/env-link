-- Modify monthly charges table to store only day of month (1-31)
ALTER TABLE public.project_monthly_charges 
DROP COLUMN date_echeance;

ALTER TABLE public.project_monthly_charges 
ADD COLUMN jour_mois INTEGER NOT NULL DEFAULT 1 CHECK (jour_mois >= 1 AND jour_mois <= 31);