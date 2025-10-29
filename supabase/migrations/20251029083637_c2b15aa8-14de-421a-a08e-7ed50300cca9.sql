-- Modifier les colonnes de date pour inclure l'heure dans project_expenses
ALTER TABLE project_expenses 
  ALTER COLUMN date_achat TYPE timestamp with time zone USING date_achat::timestamp with time zone,
  ALTER COLUMN date_paiement TYPE timestamp with time zone USING date_paiement::timestamp with time zone;