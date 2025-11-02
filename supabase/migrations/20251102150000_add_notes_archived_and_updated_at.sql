-- Migration: Ajouter les colonnes archived et updated_at à project_notes
-- Date: 2025-11-02
-- Description: Permet de solder les notes et suivre les modifications

-- 1. Ajouter la colonne archived (booléen, false par défaut)
ALTER TABLE project_notes 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- 2. Ajouter la colonne updated_at (timestamp avec timezone)
ALTER TABLE project_notes 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

-- 3. Initialiser updated_at avec la valeur de created_at pour les enregistrements existants
UPDATE project_notes 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 4. Créer ou remplacer la fonction de mise à jour automatique
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS update_project_notes_updated_at ON project_notes;

-- 6. Créer le trigger pour mettre à jour automatiquement updated_at
CREATE TRIGGER update_project_notes_updated_at 
    BEFORE UPDATE ON project_notes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Créer un index sur archived pour améliorer les performances des filtres
CREATE INDEX IF NOT EXISTS idx_project_notes_archived 
ON project_notes(archived);

-- 8. Créer un index composite sur project_id et archived
CREATE INDEX IF NOT EXISTS idx_project_notes_project_archived 
ON project_notes(project_id, archived);

-- 9. Créer un index sur updated_at pour le tri
CREATE INDEX IF NOT EXISTS idx_project_notes_updated_at 
ON project_notes(updated_at DESC);

-- Commentaires pour documentation
COMMENT ON COLUMN project_notes.archived IS 'Indique si la note a été soldée (archivée)';
COMMENT ON COLUMN project_notes.updated_at IS 'Date de dernière modification de la note';
