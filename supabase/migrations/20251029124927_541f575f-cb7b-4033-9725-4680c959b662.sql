-- Add financial fields to accessory_options table
ALTER TABLE accessory_options 
  DROP COLUMN prix,
  ADD COLUMN prix_reference numeric DEFAULT 0,
  ADD COLUMN prix_vente_ttc numeric DEFAULT 0,
  ADD COLUMN marge_pourcent numeric DEFAULT 0,
  ADD COLUMN marge_nette numeric DEFAULT 0;