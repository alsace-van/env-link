-- Ajouter des colonnes pour stocker les résumés IA dans notices_database
ALTER TABLE notices_database 
ADD COLUMN ai_summary TEXT,
ADD COLUMN ai_summary_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN ai_summary_tokens_used INTEGER;

-- Mettre à jour les policies RLS pour permettre à tous de lire les notices avec résumés
-- (mais seul le propriétaire peut créer/modifier)
DROP POLICY IF EXISTS "Users can manage their own notices" ON notices_database;

-- Nouvelle policy: tout le monde peut lire les notices
CREATE POLICY "Anyone can view notices"
ON notices_database FOR SELECT
USING (true);

-- Seul le propriétaire peut créer
CREATE POLICY "Users can create their own notices"
ON notices_database FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Seul le propriétaire peut modifier
CREATE POLICY "Users can update their own notices"
ON notices_database FOR UPDATE
USING (user_id = auth.uid());

-- Seul le propriétaire peut supprimer
CREATE POLICY "Users can delete their own notices"
ON notices_database FOR DELETE
USING (user_id = auth.uid());