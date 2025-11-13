-- Fonction pour synchroniser les modifications d'accessoires vers les dépenses
CREATE OR REPLACE FUNCTION sync_accessory_updates_to_expenses()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour les project_expenses qui référencent cet accessoire
  UPDATE project_expenses
  SET 
    nom_accessoire = NEW.nom,
    marque = NEW.marque,
    prix = NEW.prix_reference,
    fournisseur = NEW.fournisseur,
    type_electrique = NEW.type_electrique,
    prix_vente_ttc = NEW.prix_vente_ttc,
    poids_kg = NEW.poids_kg,
    puissance_watts = NEW.puissance_watts,
    intensite_amperes = NEW.intensite_amperes,
    longueur_mm = NEW.longueur_mm,
    largeur_mm = NEW.largeur_mm,
    hauteur_mm = NEW.hauteur_mm
  WHERE accessory_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger sur la table accessories_catalog
CREATE TRIGGER sync_accessory_to_expenses_on_update
AFTER UPDATE ON accessories_catalog
FOR EACH ROW
EXECUTE FUNCTION sync_accessory_updates_to_expenses();