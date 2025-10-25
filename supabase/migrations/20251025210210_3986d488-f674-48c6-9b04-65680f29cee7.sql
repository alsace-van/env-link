-- Add notice_id to accessories_catalog to link accessories to notices
ALTER TABLE public.accessories_catalog
ADD COLUMN notice_id uuid REFERENCES public.notices_database(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX idx_accessories_catalog_notice_id ON public.accessories_catalog(notice_id);