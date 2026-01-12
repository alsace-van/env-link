// ============================================
// HOOK: useTemplates
// Gestion des templates CAD avec Supabase
// VERSION: 1.2 - Bypass typage Supabase
// ============================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Sketch } from "@/components/cad-gabarit/types";

// Types
export interface TemplateCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface CADTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  tags: string[];
  is_public: boolean;
  is_favorite: boolean;
  thumbnail: string | null;
  sketch_data: any;
  geometry_count: number;
  point_count: number;
  created_at: string;
  updated_at: string;
  category?: TemplateCategory | null;
}

export interface TemplateFilters {
  search: string;
  categoryId: string | null;
  showFavorites: boolean;
  showPublic: boolean;
  tags: string[];
}

export interface UseTemplatesReturn {
  templates: CADTemplate[];
  categories: TemplateCategory[];
  loading: boolean;
  error: string | null;
  filters: TemplateFilters;
  saveTemplate: (
    name: string,
    sketch: Sketch,
    options?: {
      description?: string;
      categoryId?: string | null;
      tags?: string[];
      isPublic?: boolean;
      thumbnail?: string;
    },
  ) => Promise<CADTemplate | null>;
  updateTemplate: (id: string, updates: Partial<CADTemplate>) => Promise<boolean>;
  deleteTemplate: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<boolean>;
  togglePublic: (id: string) => Promise<boolean>;
  createCategory: (name: string, icon?: string, color?: string) => Promise<TemplateCategory | null>;
  updateCategory: (id: string, updates: Partial<TemplateCategory>) => Promise<boolean>;
  deleteCategory: (id: string) => Promise<boolean>;
  setFilters: (filters: Partial<TemplateFilters>) => void;
  resetFilters: () => void;
  refresh: () => Promise<void>;
}

const DEFAULT_FILTERS: TemplateFilters = {
  search: "",
  categoryId: null,
  showFavorites: false,
  showPublic: false,
  tags: [],
};

export function useTemplates(): UseTemplatesReturn {
  const [templates, setTemplates] = useState<CADTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<TemplateFilters>(DEFAULT_FILTERS);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadCategories = useCallback(async () => {
    if (!userId) return;

    try {
      // @ts-ignore - Table pas encore dans les types générés
      const { data, error: fetchError } = await supabase
        .from("cad_template_categories" as any)
        .select("*")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true });

      if (fetchError) throw fetchError;
      setCategories((data || []) as unknown as TemplateCategory[]);
    } catch (err: any) {
      console.error("Erreur chargement catégories:", err);
    }
  }, [userId]);

  const loadTemplates = useCallback(async () => {
    if (!userId) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // @ts-ignore - Table pas encore dans les types générés
      let query = supabase
        .from("cad_templates" as any)
        .select(`*, category:cad_template_categories(*)`)
        .order("updated_at", { ascending: false });

      if (filters.showPublic) {
        query = query.or(`user_id.eq.${userId},is_public.eq.true`);
      } else {
        query = query.eq("user_id", userId);
      }

      if (filters.showFavorites) {
        query = query.eq("is_favorite", true);
      }

      if (filters.categoryId) {
        query = query.eq("category_id", filters.categoryId);
      }

      if (filters.tags.length > 0) {
        query = query.contains("tags", filters.tags);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      let filteredData = (data || []) as unknown as CADTemplate[];
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter(
          (t: CADTemplate) =>
            t.name.toLowerCase().includes(searchLower) ||
            t.description?.toLowerCase().includes(searchLower) ||
            t.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower)),
        );
      }

      setTemplates(filteredData);
    } catch (err: any) {
      console.error("Erreur chargement templates:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, filters]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const saveTemplate = useCallback(
    async (
      name: string,
      sketch: Sketch,
      options?: {
        description?: string;
        categoryId?: string | null;
        tags?: string[];
        isPublic?: boolean;
        thumbnail?: string;
      },
    ): Promise<CADTemplate | null> => {
      if (!userId) {
        toast.error("Vous devez être connecté pour sauvegarder un template");
        return null;
      }

      try {
        const sketchData = {
          points: Array.from(sketch.points.entries()),
          geometries: Array.from(sketch.geometries.entries()),
          constraints: Array.from(sketch.constraints.entries()),
          dimensions: Array.from(sketch.dimensions.entries()),
          layers: Array.from(sketch.layers.entries()),
          scaleFactor: sketch.scaleFactor,
        };

        // @ts-ignore - Table pas encore dans les types générés
        const { data, error: insertError } = await supabase
          .from("cad_templates" as any)
          .insert({
            user_id: userId,
            name,
            description: options?.description || null,
            category_id: options?.categoryId || null,
            tags: options?.tags || [],
            is_public: options?.isPublic || false,
            thumbnail: options?.thumbnail || null,
            sketch_data: sketchData,
            geometry_count: sketch.geometries.size,
            point_count: sketch.points.size,
          })
          .select(`*, category:cad_template_categories(*)`)
          .single();

        if (insertError) throw insertError;

        const newTemplate = data as unknown as CADTemplate;
        setTemplates((prev) => [newTemplate, ...prev]);
        toast.success(`Template "${name}" sauvegardé`);
        return newTemplate;
      } catch (err: any) {
        console.error("Erreur sauvegarde template:", err);
        toast.error("Erreur lors de la sauvegarde");
        return null;
      }
    },
    [userId],
  );

  const updateTemplate = useCallback(
    async (id: string, updates: Partial<CADTemplate>): Promise<boolean> => {
      try {
        // @ts-ignore
        const { error: updateError } = await supabase
          .from("cad_templates" as any)
          .update(updates as any)
          .eq("id", id)
          .eq("user_id", userId);

        if (updateError) throw updateError;

        setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
        toast.success("Template mis à jour");
        return true;
      } catch (err: any) {
        console.error("Erreur mise à jour template:", err);
        toast.error("Erreur lors de la mise à jour");
        return false;
      }
    },
    [userId],
  );

  const deleteTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        // @ts-ignore
        const { error: deleteError } = await supabase
          .from("cad_templates" as any)
          .delete()
          .eq("id", id)
          .eq("user_id", userId);

        if (deleteError) throw deleteError;

        setTemplates((prev) => prev.filter((t) => t.id !== id));
        toast.success("Template supprimé");
        return true;
      } catch (err: any) {
        console.error("Erreur suppression template:", err);
        toast.error("Erreur lors de la suppression");
        return false;
      }
    },
    [userId],
  );

  const toggleFavorite = useCallback(
    async (id: string): Promise<boolean> => {
      const template = templates.find((t) => t.id === id);
      if (!template) return false;

      const newValue = !template.is_favorite;

      try {
        // @ts-ignore
        const { error: updateError } = await supabase
          .from("cad_templates" as any)
          .update({ is_favorite: newValue })
          .eq("id", id)
          .eq("user_id", userId);

        if (updateError) throw updateError;

        setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, is_favorite: newValue } : t)));
        return true;
      } catch (err: any) {
        console.error("Erreur toggle favori:", err);
        return false;
      }
    },
    [userId, templates],
  );

  const togglePublic = useCallback(
    async (id: string): Promise<boolean> => {
      const template = templates.find((t) => t.id === id);
      if (!template) return false;

      const newValue = !template.is_public;

      try {
        // @ts-ignore
        const { error: updateError } = await supabase
          .from("cad_templates" as any)
          .update({ is_public: newValue })
          .eq("id", id)
          .eq("user_id", userId);

        if (updateError) throw updateError;

        setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, is_public: newValue } : t)));
        toast.success(newValue ? "Template rendu public" : "Template rendu privé");
        return true;
      } catch (err: any) {
        console.error("Erreur toggle public:", err);
        return false;
      }
    },
    [userId, templates],
  );

  const createCategory = useCallback(
    async (name: string, icon = "folder", color = "#6B7280"): Promise<TemplateCategory | null> => {
      if (!userId) return null;

      try {
        const maxOrder = Math.max(...categories.map((c) => c.sort_order), 0);

        // @ts-ignore
        const { data, error: insertError } = await supabase
          .from("cad_template_categories" as any)
          .insert({
            user_id: userId,
            name,
            icon,
            color,
            sort_order: maxOrder + 1,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        const newCategory = data as unknown as TemplateCategory;
        setCategories((prev) => [...prev, newCategory]);
        toast.success(`Catégorie "${name}" créée`);
        return newCategory;
      } catch (err: any) {
        console.error("Erreur création catégorie:", err);
        toast.error("Erreur lors de la création");
        return null;
      }
    },
    [userId, categories],
  );

  const updateCategory = useCallback(
    async (id: string, updates: Partial<TemplateCategory>): Promise<boolean> => {
      try {
        // @ts-ignore
        const { error: updateError } = await supabase
          .from("cad_template_categories" as any)
          .update(updates as any)
          .eq("id", id)
          .eq("user_id", userId);

        if (updateError) throw updateError;

        setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
        return true;
      } catch (err: any) {
        console.error("Erreur mise à jour catégorie:", err);
        return false;
      }
    },
    [userId],
  );

  const deleteCategory = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        // @ts-ignore
        const { error: deleteError } = await supabase
          .from("cad_template_categories" as any)
          .delete()
          .eq("id", id)
          .eq("user_id", userId);

        if (deleteError) throw deleteError;

        setCategories((prev) => prev.filter((c) => c.id !== id));
        toast.success("Catégorie supprimée");
        return true;
      } catch (err: any) {
        console.error("Erreur suppression catégorie:", err);
        toast.error("Erreur lors de la suppression");
        return false;
      }
    },
    [userId],
  );

  const setFilters = useCallback((newFilters: Partial<TemplateFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadCategories(), loadTemplates()]);
  }, [loadCategories, loadTemplates]);

  return {
    templates,
    categories,
    loading,
    error,
    filters,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    toggleFavorite,
    togglePublic,
    createCategory,
    updateCategory,
    deleteCategory,
    setFilters,
    resetFilters,
    refresh,
  };
}

// Désérialiser un sketch depuis les données JSON
export function deserializeSketchData(sketchData: any): Sketch {
  return {
    id: "imported-template",
    name: "Template",
    points: new Map(sketchData.points || []),
    geometries: new Map(sketchData.geometries || []),
    constraints: new Map(sketchData.constraints || []),
    dimensions: new Map(sketchData.dimensions || []),
    layers: new Map(sketchData.layers || []),
    scaleFactor: sketchData.scaleFactor || 1,
    activeLayerId: "trace",
    dof: 0,
    status: "under-constrained",
  };
}

// Merger un template dans un sketch existant
export function mergeTemplateIntoSketch(
  currentSketch: Sketch,
  templateSketchData: any,
  offset: { x: number; y: number } = { x: 0, y: 0 },
): Sketch {
  const templateSketch = deserializeSketchData(templateSketchData);

  const newSketch: Sketch = {
    ...currentSketch,
    points: new Map(currentSketch.points),
    geometries: new Map(currentSketch.geometries),
    constraints: new Map(currentSketch.constraints),
    dimensions: new Map(currentSketch.dimensions),
  };

  const pointIdMapping = new Map<string, string>();

  templateSketch.points.forEach((point, oldId) => {
    const newId = `pt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    pointIdMapping.set(oldId, newId);
    newSketch.points.set(newId, {
      ...point,
      id: newId,
      x: point.x + offset.x,
      y: point.y + offset.y,
    });
  });

  templateSketch.geometries.forEach((geo) => {
    const newId = `geo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newGeo: any = { ...geo, id: newId };

    if (geo.type === "line") {
      newGeo.p1 = pointIdMapping.get((geo as any).p1) || (geo as any).p1;
      newGeo.p2 = pointIdMapping.get((geo as any).p2) || (geo as any).p2;
    } else if (geo.type === "circle") {
      newGeo.center = pointIdMapping.get((geo as any).center) || (geo as any).center;
    } else if (geo.type === "arc") {
      newGeo.center = pointIdMapping.get((geo as any).center) || (geo as any).center;
      newGeo.startPoint = pointIdMapping.get((geo as any).startPoint) || (geo as any).startPoint;
      newGeo.endPoint = pointIdMapping.get((geo as any).endPoint) || (geo as any).endPoint;
    } else if (geo.type === "bezier") {
      newGeo.p1 = pointIdMapping.get((geo as any).p1) || (geo as any).p1;
      newGeo.p2 = pointIdMapping.get((geo as any).p2) || (geo as any).p2;
      newGeo.cp1 = pointIdMapping.get((geo as any).cp1) || (geo as any).cp1;
      newGeo.cp2 = pointIdMapping.get((geo as any).cp2) || (geo as any).cp2;
    }

    newSketch.geometries.set(newId, newGeo);
  });

  return newSketch;
}
