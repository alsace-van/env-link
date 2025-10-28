-- Fonction pour synchroniser les modifications du catalogue vers les dépenses
CREATE OR REPLACE FUNCTION sync_catalog_to_expenses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mettre à jour toutes les dépenses qui référencent cet accessoire du catalogue
  UPDATE project_expenses
  SET
    nom_accessoire = NEW.nom,
    marque = NEW.marque,
    prix = COALESCE(NEW.prix_reference, prix),
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
  WHERE accessory_id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger sur la table accessories_catalog
DROP TRIGGER IF EXISTS on_catalog_update ON accessories_catalog;

CREATE TRIGGER on_catalog_update
  AFTER UPDATE ON accessories_catalog
  FOR EACH ROW
  EXECUTE FUNCTION sync_catalog_to_expenses();