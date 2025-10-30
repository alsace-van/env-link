-- Drop the restrictive read policy
DROP POLICY IF EXISTS "Users can view their own shop config" ON shop_welcome_config;

-- Create a public read policy for shop_welcome_config
-- This is needed because the auth page is public and needs to display the shop config
CREATE POLICY "Anyone can view shop welcome config"
ON shop_welcome_config
FOR SELECT
USING (true);