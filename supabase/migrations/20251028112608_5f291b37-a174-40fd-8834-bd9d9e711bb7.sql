-- Fonction pour synchroniser les modifications des dépenses vers le catalogue
CREATE OR REPLACE FUNCTION sync_expense_to_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si la dépense est liée à un accessoire du catalogue, le mettre à jour
  IF NEW.accessory_id IS NOT NULL THEN
    UPDATE accessories_catalog
    SET
      nom = NEW.nom_accessoire,
      marque = COALESCE(NEW.marque, marque),
      prix_reference = COALESCE(NEW.prix, prix_reference),
      prix_vente_ttc = COALESCE(NEW.prix_vente_ttc, prix_vente_ttc),
      marge_pourcent = COALESCE(NEW.marge_pourcent, marge_pourcent),
      fournisseur = COALESCE(NEW.fournisseur, fournisseur),
      type_electrique = COALESCE(NEW.type_electrique, type_electrique),
      poids_kg = COALESCE(NEW.poids_kg, poids_kg),
      longueur_mm = COALESCE(NEW.longueur_mm, longueur_mm),
      largeur_mm = COALESCE(NEW.largeur_mm, largeur_mm),
      hauteur_mm = COALESCE(NEW.hauteur_mm, hauteur_mm),
      puissance_watts = COALESCE(NEW.puissance_watts, puissance_watts),
      intensite_amperes = COALESCE(NEW.intensite_amperes, intensite_amperes)
    WHERE id = NEW.accessory_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger sur la table project_expenses
DROP TRIGGER IF EXISTS on_expense_update ON project_expenses;

CREATE TRIGGER on_expense_update
  AFTER UPDATE ON project_expenses
  FOR EACH ROW
  EXECUTE FUNCTION sync_expense_to_catalog();