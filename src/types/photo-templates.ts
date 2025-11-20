// Types locaux pour la table photo_templates
export interface PhotoTemplate {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  description: string | null;
  type: string | null;
  material: string | null;
  thickness_mm: number | null;
  tags: string[];
  original_image_url: string;
  markers_image_url: string | null;
  corrected_image_url: string | null;
  markers_detected: number;
  marker_ids: number[];
  scale_factor: number | null;
  accuracy_mm: number | null;
  calibration_data: any | null;
  drawings_data: any | null;
  export_count: number;
  last_exported_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhotoTemplateInsert {
  id?: string;
  project_id: string;
  user_id: string;
  name: string;
  description?: string | null;
  type?: string | null;
  material?: string | null;
  thickness_mm?: number | null;
  tags?: string[];
  original_image_url: string;
  markers_image_url?: string | null;
  corrected_image_url?: string | null;
  markers_detected?: number;
  marker_ids?: number[];
  scale_factor?: number | null;
  accuracy_mm?: number | null;
  calibration_data?: any | null;
  drawings_data?: any | null;
  export_count?: number;
  last_exported_at?: string | null;
  created_at?: string;
  updated_at?: string;
}
