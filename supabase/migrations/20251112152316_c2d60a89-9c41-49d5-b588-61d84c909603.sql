-- Désactiver les documents avec URLs externes pour éviter les erreurs CORS
-- Ces documents devront être re-uploadés via l'interface admin

UPDATE official_documents
SET is_active = false,
    description = COALESCE(description, '') || E'\n\n⚠️ Ce document doit être uploadé via l''interface admin pour fonctionner correctement (problème CORS avec les URLs externes).'
WHERE file_url NOT LIKE '%supabase.co/storage%'
  AND is_active = true;