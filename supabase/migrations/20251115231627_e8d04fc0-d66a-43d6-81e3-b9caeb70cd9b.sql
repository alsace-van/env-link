-- Create work_categories table
CREATE TABLE work_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT DEFAULT '🔨',
  display_order INTEGER,
  is_template BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_templates table
CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES work_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  estimated_hours DECIMAL(5,2),
  user_id UUID REFERENCES auth.users(id),
  is_global BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns to project_todos
ALTER TABLE project_todos ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES work_categories(id) ON DELETE SET NULL;
ALTER TABLE project_todos ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL;
ALTER TABLE project_todos ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(5,2);
ALTER TABLE project_todos ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(5,2);
ALTER TABLE project_todos ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE project_todos ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id);
ALTER TABLE project_todos ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE project_todos ADD COLUMN IF NOT EXISTS requires_delivery_id UUID REFERENCES supplier_expenses(id);
ALTER TABLE project_todos ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE project_todos ADD COLUMN IF NOT EXISTS display_order INTEGER;
ALTER TABLE project_todos ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create indexes
CREATE INDEX idx_work_categories_project ON work_categories(project_id);
CREATE INDEX idx_work_categories_template ON work_categories(is_template);
CREATE INDEX idx_task_templates_category ON task_templates(category_id);
CREATE INDEX idx_task_templates_global ON task_templates(is_global);
CREATE INDEX idx_project_todos_category ON project_todos(category_id);
CREATE INDEX idx_project_todos_completed ON project_todos(completed);

-- Enable RLS
ALTER TABLE work_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for work_categories
CREATE POLICY "Users can view their categories and templates"
ON work_categories FOR SELECT
USING (
  (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  OR is_template = true
);

CREATE POLICY "Users can create their own categories"
ON work_categories FOR INSERT
WITH CHECK (
  (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  OR (is_template = true AND user_id = auth.uid())
);

CREATE POLICY "Users can update their own categories"
ON work_categories FOR UPDATE
USING (
  (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  OR (is_template = true AND user_id = auth.uid())
);

CREATE POLICY "Users can delete their own categories"
ON work_categories FOR DELETE
USING (
  (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  OR (is_template = true AND user_id = auth.uid())
);

-- RLS Policies for task_templates
CREATE POLICY "Users can view global templates and their own"
ON task_templates FOR SELECT
USING (is_global = true OR user_id = auth.uid());

CREATE POLICY "Users can create their own templates"
ON task_templates FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own templates"
ON task_templates FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own templates"
ON task_templates FOR DELETE
USING (user_id = auth.uid());

-- Function to increment template usage count
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.template_id IS NOT NULL THEN
    UPDATE task_templates 
    SET usage_count = usage_count + 1 
    WHERE id = NEW.template_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_increment_template_usage
AFTER INSERT ON project_todos
FOR EACH ROW
EXECUTE FUNCTION increment_template_usage();

-- Insert default template categories
INSERT INTO work_categories (name, color, icon, is_template, display_order) VALUES
  ('Préparation', '#8b5cf6', '🔨', true, 1),
  ('Électricité', '#eab308', '🔌', true, 2),
  ('Aménagement', '#3b82f6', '🛏️', true, 3),
  ('Plomberie', '#06b6d4', '💧', true, 4),
  ('Finitions', '#10b981', '🎨', true, 5),
  ('Menuiserie', '#f97316', '🪟', true, 6);

-- Insert default task templates
-- Préparation
INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Démontage habillage intérieur', 4, true FROM work_categories WHERE name = 'Préparation' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Nettoyage complet du véhicule', 2, true FROM work_categories WHERE name = 'Préparation' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Traitement antirouille', 3, true FROM work_categories WHERE name = 'Préparation' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Découpe tôle pour fenêtres', 2, true FROM work_categories WHERE name = 'Préparation' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Pose châssis fenêtres', 4, true FROM work_categories WHERE name = 'Préparation' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Protection du véhicule', 1, true FROM work_categories WHERE name = 'Préparation' AND is_template = true;

-- Électricité
INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Passage des câbles', 3, true FROM work_categories WHERE name = 'Électricité' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Installation batterie auxiliaire', 2, true FROM work_categories WHERE name = 'Électricité' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Pose panneau solaire', 4, true FROM work_categories WHERE name = 'Électricité' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Câblage convertisseur 12V/220V', 2, true FROM work_categories WHERE name = 'Électricité' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Installation prises 220V', 2, true FROM work_categories WHERE name = 'Électricité' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Installation prises USB', 1, true FROM work_categories WHERE name = 'Électricité' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Pose éclairage LED', 3, true FROM work_categories WHERE name = 'Électricité' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Test installation électrique', 2, true FROM work_categories WHERE name = 'Électricité' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Vérification consommation', 1, true FROM work_categories WHERE name = 'Électricité' AND is_template = true;

-- Aménagement
INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Pose isolation (murs)', 6, true FROM work_categories WHERE name = 'Aménagement' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Pose isolation (toit)', 4, true FROM work_categories WHERE name = 'Aménagement' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Pose isolation (plancher)', 4, true FROM work_categories WHERE name = 'Aménagement' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Pose habillage intérieur', 8, true FROM work_categories WHERE name = 'Aménagement' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Montage meubles cuisine', 6, true FROM work_categories WHERE name = 'Aménagement' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Montage meubles rangement', 4, true FROM work_categories WHERE name = 'Aménagement' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Installation lit', 4, true FROM work_categories WHERE name = 'Aménagement' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Installation table', 2, true FROM work_categories WHERE name = 'Aménagement' AND is_template = true;

-- Plomberie
INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Installation réservoir eau propre', 3, true FROM work_categories WHERE name = 'Plomberie' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Installation réservoir eau usée', 3, true FROM work_categories WHERE name = 'Plomberie' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Pose pompe à eau', 2, true FROM work_categories WHERE name = 'Plomberie' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Raccordement évier', 2, true FROM work_categories WHERE name = 'Plomberie' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Installation douche', 4, true FROM work_categories WHERE name = 'Plomberie' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Test étanchéité', 1, true FROM work_categories WHERE name = 'Plomberie' AND is_template = true;

-- Finitions
INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Pose joint silicone', 2, true FROM work_categories WHERE name = 'Finitions' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Retouches peinture', 3, true FROM work_categories WHERE name = 'Finitions' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Nettoyage final intérieur', 2, true FROM work_categories WHERE name = 'Finitions' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Nettoyage final extérieur', 1, true FROM work_categories WHERE name = 'Finitions' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Vérification générale', 2, true FROM work_categories WHERE name = 'Finitions' AND is_template = true;

-- Menuiserie
INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Découpe plans de travail', 3, true FROM work_categories WHERE name = 'Menuiserie' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Montage portes placards', 4, true FROM work_categories WHERE name = 'Menuiserie' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Pose poignées', 1, true FROM work_categories WHERE name = 'Menuiserie' AND is_template = true;

INSERT INTO task_templates (category_id, title, estimated_hours, is_global)
SELECT id, 'Ajustements menuiserie', 2, true FROM work_categories WHERE name = 'Menuiserie' AND is_template = true;