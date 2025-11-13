-- Modifier la contrainte CHECK pour accepter 'custom_kit'
ALTER TABLE public.shop_products DROP CONSTRAINT IF EXISTS shop_products_type_check;

ALTER TABLE public.shop_products 
  ADD CONSTRAINT shop_products_type_check 
  CHECK (type IN ('simple', 'composed', 'custom_kit'));