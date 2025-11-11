-- Ajouter les colonnes manquantes à project_expenses pour compatibilité avec le code existant
ALTER TABLE project_expenses 
  ADD COLUMN IF NOT EXISTS nom_accessoire TEXT,
  ADD COLUMN IF NOT EXISTS marque TEXT,
  ADD COLUMN IF NOT EXISTS prix NUMERIC,
  ADD COLUMN IF NOT EXISTS fournisseur TEXT,
  ADD COLUMN IF NOT EXISTS date_achat TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS date_paiement TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS delai_paiement TEXT,
  ADD COLUMN IF NOT EXISTS statut_paiement TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS statut_livraison TEXT DEFAULT 'commande',
  ADD COLUMN IF NOT EXISTS facture_url TEXT,
  ADD COLUMN IF NOT EXISTS type_electrique TEXT,
  ADD COLUMN IF NOT EXISTS puissance_watts NUMERIC,
  ADD COLUMN IF NOT EXISTS intensite_amperes NUMERIC,
  ADD COLUMN IF NOT EXISTS temps_utilisation_heures NUMERIC,
  ADD COLUMN IF NOT EXISTS temps_production_heures NUMERIC,
  ADD COLUMN IF NOT EXISTS prix_unitaire NUMERIC,
  ADD COLUMN IF NOT EXISTS categorie TEXT,
  ADD COLUMN IF NOT EXISTS accessory_id UUID;

-- Créer un index sur accessory_id pour les jointures
CREATE INDEX IF NOT EXISTS idx_project_expenses_accessory_id ON project_expenses(accessory_id);

-- Créer un index sur type_electrique pour les filtres EnergyBalance
CREATE INDEX IF NOT EXISTS idx_project_expenses_type_electrique ON project_expenses(type_electrique) WHERE type_electrique IS NOT NULL;