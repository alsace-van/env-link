-- Rendre le bucket notice-files public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'notice-files';