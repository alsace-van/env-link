-- Add archived field to project_notes
ALTER TABLE project_notes ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- Add fields to project_expenses for supplier expenses
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS total_amount numeric;
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS order_date timestamp with time zone;
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS quantity numeric;
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS unit_price numeric;
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS notes text;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_notes_archived ON project_notes(archived);
CREATE INDEX IF NOT EXISTS idx_project_expenses_supplier_id ON project_expenses(supplier_id);