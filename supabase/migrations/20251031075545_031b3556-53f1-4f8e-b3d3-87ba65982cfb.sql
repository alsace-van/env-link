-- Create shop_customers table
CREATE TABLE IF NOT EXISTS public.shop_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  has_project_subscription BOOLEAN DEFAULT false,
  company_name TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  billing_address TEXT NOT NULL,
  billing_postal_code TEXT NOT NULL,
  billing_city TEXT NOT NULL,
  billing_country TEXT NOT NULL DEFAULT 'France',
  vat_number TEXT,
  shipping_same_as_billing BOOLEAN DEFAULT true,
  shipping_recipient_name TEXT,
  shipping_address TEXT,
  shipping_postal_code TEXT,
  shipping_city TEXT,
  shipping_country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create shop_orders table
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.shop_customers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  added_to_expenses BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create shop_order_items table
CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  configuration JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create supplier_expenses table
CREATE TABLE IF NOT EXISTS public.supplier_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  order_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.shop_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shop_customers
CREATE POLICY "Users can view own customer info"
  ON public.shop_customers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customer info"
  ON public.shop_customers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customer info"
  ON public.shop_customers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own customer info"
  ON public.shop_customers FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for suppliers
CREATE POLICY "Users can view own suppliers"
  ON public.suppliers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own suppliers"
  ON public.suppliers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suppliers"
  ON public.suppliers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own suppliers"
  ON public.suppliers FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for shop_orders
CREATE POLICY "Users can view own orders"
  ON public.shop_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
  ON public.shop_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
  ON public.shop_orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own orders"
  ON public.shop_orders FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for shop_order_items
CREATE POLICY "Users can view own order items"
  ON public.shop_order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.shop_orders
    WHERE shop_orders.id = shop_order_items.order_id
    AND shop_orders.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own order items"
  ON public.shop_order_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shop_orders
    WHERE shop_orders.id = shop_order_items.order_id
    AND shop_orders.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own order items"
  ON public.shop_order_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.shop_orders
    WHERE shop_orders.id = shop_order_items.order_id
    AND shop_orders.user_id = auth.uid()
  ));

-- RLS Policies for supplier_expenses
CREATE POLICY "Users can view own supplier expenses"
  ON public.supplier_expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own supplier expenses"
  ON public.supplier_expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own supplier expenses"
  ON public.supplier_expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own supplier expenses"
  ON public.supplier_expenses FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to generate order numbers
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  -- Get the count of orders today
  SELECT COUNT(*) INTO counter
  FROM shop_orders
  WHERE DATE(created_at) = CURRENT_DATE;
  
  -- Generate order number: ORD-YYYYMMDD-XXX
  new_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((counter + 1)::TEXT, 3, '0');
  
  RETURN new_number;
END;
$$;

-- Create trigger to update updated_at
CREATE TRIGGER update_shop_customers_updated_at
  BEFORE UPDATE ON public.shop_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shop_orders_updated_at
  BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_expenses_updated_at
  BEFORE UPDATE ON public.supplier_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();