-- Synchroniser les valeurs électriques manquantes depuis le catalogue vers les dépenses
UPDATE project_expenses pe
SET 
  puissance_watts = COALESCE(pe.puissance_watts, ac.puissance_watts),
  intensite_amperes = COALESCE(pe.intensite_amperes, ac.intensite_amperes)
FROM accessories_catalog ac
WHERE pe.accessory_id = ac.id
  AND pe.accessory_id IS NOT NULL
  AND (pe.puissance_watts IS NULL OR pe.intensite_amperes IS NULL);