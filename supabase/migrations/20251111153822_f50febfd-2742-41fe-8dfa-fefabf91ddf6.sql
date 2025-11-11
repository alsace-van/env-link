-- Add missing columns to project_expenses table
ALTER TABLE public.project_expenses 
ADD COLUMN IF NOT EXISTS prix_vente_ttc numeric,
ADD COLUMN IF NOT EXISTS quantite integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS user_id uuid;

-- Update user_id for existing records based on project_id
UPDATE public.project_expenses 
SET user_id = projects.created_by
FROM public.projects
WHERE project_expenses.project_id = projects.id
AND project_expenses.user_id IS NULL;