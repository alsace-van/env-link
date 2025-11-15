-- Create vehicle_inspections table
CREATE TABLE public.vehicle_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  inspection_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mileage INTEGER,
  fuel_level TEXT CHECK (fuel_level IN ('empty', 'quarter', 'half', 'three_quarters', 'full')),
  keys_provided BOOLEAN DEFAULT true,
  notes TEXT,
  client_signature_url TEXT,
  signed_by TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create inspection_zones table
CREATE TABLE public.inspection_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
  zone_name TEXT NOT NULL,
  zone_type TEXT NOT NULL CHECK (zone_type IN ('default', 'custom')),
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create inspection_photos table
CREATE TABLE public.inspection_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES public.inspection_zones(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  annotated_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create vehicle_damages table
CREATE TABLE public.vehicle_damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES public.inspection_zones(id),
  description TEXT NOT NULL,
  photo_url TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'severe')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-inspections', 'vehicle-inspections', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_damages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicle_inspections
CREATE POLICY "Users can view their own inspections"
ON public.vehicle_inspections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own inspections"
ON public.vehicle_inspections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inspections"
ON public.vehicle_inspections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inspections"
ON public.vehicle_inspections FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for inspection_zones
CREATE POLICY "Users can view zones of their inspections"
ON public.inspection_zones FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vehicle_inspections
    WHERE id = inspection_zones.inspection_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create zones for their inspections"
ON public.inspection_zones FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vehicle_inspections
    WHERE id = inspection_zones.inspection_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update zones of their inspections"
ON public.inspection_zones FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.vehicle_inspections
    WHERE id = inspection_zones.inspection_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete zones of their inspections"
ON public.inspection_zones FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.vehicle_inspections
    WHERE id = inspection_zones.inspection_id
    AND user_id = auth.uid()
  )
);

-- RLS Policies for inspection_photos
CREATE POLICY "Users can view photos of their inspection zones"
ON public.inspection_photos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.inspection_zones iz
    JOIN public.vehicle_inspections vi ON iz.inspection_id = vi.id
    WHERE iz.id = inspection_photos.zone_id
    AND vi.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create photos for their inspection zones"
ON public.inspection_photos FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.inspection_zones iz
    JOIN public.vehicle_inspections vi ON iz.inspection_id = vi.id
    WHERE iz.id = inspection_photos.zone_id
    AND vi.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update photos of their inspection zones"
ON public.inspection_photos FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.inspection_zones iz
    JOIN public.vehicle_inspections vi ON iz.inspection_id = vi.id
    WHERE iz.id = inspection_photos.zone_id
    AND vi.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete photos of their inspection zones"
ON public.inspection_photos FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.inspection_zones iz
    JOIN public.vehicle_inspections vi ON iz.inspection_id = vi.id
    WHERE iz.id = inspection_photos.zone_id
    AND vi.user_id = auth.uid()
  )
);

-- RLS Policies for vehicle_damages
CREATE POLICY "Users can view damages of their inspections"
ON public.vehicle_damages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vehicle_inspections
    WHERE id = vehicle_damages.inspection_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create damages for their inspections"
ON public.vehicle_damages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vehicle_inspections
    WHERE id = vehicle_damages.inspection_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update damages of their inspections"
ON public.vehicle_damages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.vehicle_inspections
    WHERE id = vehicle_damages.inspection_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete damages of their inspections"
ON public.vehicle_damages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.vehicle_inspections
    WHERE id = vehicle_damages.inspection_id
    AND user_id = auth.uid()
  )
);

-- Storage policies for vehicle-inspections bucket
CREATE POLICY "Users can upload their inspection files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vehicle-inspections'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their inspection files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'vehicle-inspections'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their inspection files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'vehicle-inspections'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their inspection files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vehicle-inspections'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create index for better performance
CREATE INDEX idx_vehicle_inspections_project_id ON public.vehicle_inspections(project_id);
CREATE INDEX idx_inspection_zones_inspection_id ON public.inspection_zones(inspection_id);
CREATE INDEX idx_inspection_photos_zone_id ON public.inspection_photos(zone_id);
CREATE INDEX idx_vehicle_damages_inspection_id ON public.vehicle_damages(inspection_id);

-- Create updated_at trigger
CREATE TRIGGER update_vehicle_inspections_updated_at
BEFORE UPDATE ON public.vehicle_inspections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();