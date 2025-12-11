-- Script pour nettoyer les entités HTML dans project_todos
-- Exécuter dans Supabase SQL Editor

-- Nettoyer les titres
UPDATE project_todos
SET title = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(title, '&nbsp;', ' '),
          '&amp;', '&'
        ),
        '&lt;', '<'
      ),
      '&gt;', '>'
    ),
    '&quot;', '"'
  ),
  '&#39;', ''''
)
WHERE title LIKE '%&%';

-- Nettoyer les descriptions
UPDATE project_todos
SET description = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(description, '&nbsp;', ' '),
          '&amp;', '&'
        ),
        '&lt;', '<'
      ),
      '&gt;', '>'
    ),
    '&quot;', '"'
  ),
  '&#39;', ''''
)
WHERE description LIKE '%&%';

-- Supprimer les espaces multiples dans les titres
UPDATE project_todos
SET title = REGEXP_REPLACE(title, '\s+', ' ', 'g')
WHERE title ~ '\s{2,}';

-- Trim des titres et descriptions
UPDATE project_todos
SET 
  title = TRIM(title),
  description = TRIM(description)
WHERE title != TRIM(title) OR description != TRIM(description);