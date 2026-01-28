// ============================================
// HOOK: useCADProjectSave
// Sauvegarde persistante des sketches CAD liés aux projets
// VERSION: 1.0
// ============================================
// CHANGELOG:
// v1.0 - Sauvegarde/chargement des sketches CAD par projet
//      - Auto-load au montage si projectId fourni
//      - Sauvegarde manuelle avec saveToProject()
//      - Auto-save optionnel avec debounce
//      - Fallback localStorage si Supabase échoue
// ============================================

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Sketch } from "./types";

// Types pour les images de fond (simplifié)
interface BackgroundImageData {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  skewX: number;
  skewY: number;
  locked: boolean;
  visible: boolean;
  name: string;
  calibrationData?: any;
  cropData?: any;
  adjustments?: any;
}

interface MarkerLink {
  markerId: string;
  accessoryId: string;
}

interface UseCADProjectSaveOptions {
  projectId?: string | null;
  enabled?: boolean;
  autoSaveEnabled?: boolean;
  autoSaveDelayMs?: number;
}

interface UseCADProjectSaveReturn {
  // États
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSaveTime: number | null;
  loadError: string | null;
  saveError: string | null;
  
  // Actions
  saveToProject: () => Promise<boolean>;
  loadFromProject: () => Promise<boolean>;
  clearProjectData: () => Promise<boolean>;
  
  // Pour le composant parent
  onSketchChange: (sketch: Sketch, backgroundImages: BackgroundImageData[], markerLinks: MarkerLink[]) => void;
}

// Sérialiser le sketch pour stockage JSON
function serializeSketch(sketch: Sketch): Record<string, any> {
  return {
    points: Array.from(sketch.points.entries()),
    geometries: Array.from(sketch.geometries.entries()),
    constraints: Array.from(sketch.constraints.entries()),
    dimensions: Array.from(sketch.dimensions.entries()),
    layers: Array.from(sketch.layers.entries()),
    activeLayerId: sketch.activeLayerId,
    scaleFactor: sketch.scaleFactor,
    origin: sketch.origin,
    gridSize: sketch.gridSize,
    showGrid: sketch.showGrid,
  };
}

// Désérialiser le sketch depuis JSON
function deserializeSketch(data: Record<string, any>): Partial<Sketch> {
  return {
    points: new Map(data.points || []),
    geometries: new Map(data.geometries || []),
    constraints: new Map(data.constraints || []),
    dimensions: new Map(data.dimensions || []),
    layers: new Map(data.layers || []),
    activeLayerId: data.activeLayerId || "default",
    scaleFactor: data.scaleFactor || 2.5,
    origin: data.origin || { x: 0, y: 0 },
    gridSize: data.gridSize || 10,
    showGrid: data.showGrid ?? true,
  };
}

// Sérialiser les images (sans l'objet Image qui n'est pas sérialisable)
function serializeBackgroundImages(images: BackgroundImageData[]): any[] {
  return images.map((img) => ({
    id: img.id,
    src: img.src,
    x: img.x,
    y: img.y,
    width: img.width,
    height: img.height,
    opacity: img.opacity,
    rotation: img.rotation,
    flipH: img.flipH,
    flipV: img.flipV,
    skewX: img.skewX,
    skewY: img.skewY,
    locked: img.locked,
    visible: img.visible,
    name: img.name,
    calibrationData: img.calibrationData,
    cropData: img.cropData,
    adjustments: img.adjustments,
  }));
}

export function useCADProjectSave(
  sketch: Sketch,
  backgroundImages: BackgroundImageData[],
  markerLinks: MarkerLink[],
  loadSketchData: (data: any) => void,
  setBackgroundImages: (images: BackgroundImageData[]) => void,
  setMarkerLinks: (links: MarkerLink[]) => void,
  options: UseCADProjectSaveOptions = {}
): UseCADProjectSaveReturn {
  const {
    projectId,
    enabled = true,
    autoSaveEnabled = false,
    autoSaveDelayMs = 5000,
  } = options;

  // États
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs
  const hasLoadedRef = useRef(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedHashRef = useRef<string>("");

  // Clé localStorage pour fallback
  const getLocalStorageKey = useCallback(() => {
    return `cad_project_sketch_${projectId || "default"}`;
  }, [projectId]);

  // Calculer un hash simple pour détecter les changements
  const computeHash = useCallback((s: Sketch, imgs: BackgroundImageData[]): string => {
    return `${s.geometries.size}-${s.points.size}-${imgs.length}-${Date.now()}`;
  }, []);

  // ============================================
  // SAUVEGARDE
  // ============================================
  const saveToProject = useCallback(async (): Promise<boolean> => {
    if (!enabled || !projectId) {
      console.log("[CADProjectSave] Sauvegarde ignorée: pas de projectId");
      return false;
    }

    if (isSaving) {
      console.log("[CADProjectSave] Sauvegarde déjà en cours");
      return false;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Utilisateur non connecté");
      }

      const serializedSketch = serializeSketch(sketch);
      const serializedImages = serializeBackgroundImages(backgroundImages);
      const geometryCount = sketch.geometries.size;
      const pointCount = sketch.points.size;

      console.log(`[CADProjectSave] Sauvegarde: ${geometryCount} géométries, ${pointCount} points, ${backgroundImages.length} images`);

      // Tenter la sauvegarde Supabase avec UPSERT
      const { error } = await (supabase as any).from("cad_project_sketches").upsert(
        {
          project_id: projectId,
          user_id: user.id,
          sketch_data: serializedSketch,
          background_images: serializedImages,
          marker_links: markerLinks,
          geometry_count: geometryCount,
          point_count: pointCount,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "project_id",
        }
      );

      if (error) {
        console.error("[CADProjectSave] Erreur Supabase:", error);
        
        // Fallback localStorage
        const localData = {
          sketch_data: serializedSketch,
          background_images: serializedImages,
          marker_links: markerLinks,
          geometry_count: geometryCount,
          point_count: pointCount,
          timestamp: Date.now(),
        };
        localStorage.setItem(getLocalStorageKey(), JSON.stringify(localData));
        console.log("[CADProjectSave] Fallback localStorage réussi");
        
        setSaveError("Sauvegarde cloud échouée, données sauvegardées localement");
        toast.warning("Sauvegarde locale uniquement", {
          description: "La connexion cloud a échoué. Vos données sont sauvegardées localement.",
        });
      } else {
        // Succès Supabase - aussi sauvegarder en local pour accès rapide
        const localData = {
          sketch_data: serializedSketch,
          background_images: serializedImages,
          marker_links: markerLinks,
          geometry_count: geometryCount,
          point_count: pointCount,
          timestamp: Date.now(),
        };
        localStorage.setItem(getLocalStorageKey(), JSON.stringify(localData));
        
        console.log("[CADProjectSave] ✓ Sauvegarde réussie (Supabase + localStorage)");
      }

      lastSavedHashRef.current = computeHash(sketch, backgroundImages);
      setLastSaveTime(Date.now());
      setHasUnsavedChanges(false);
      setIsSaving(false);
      return true;

    } catch (err: any) {
      console.error("[CADProjectSave] Erreur:", err);
      setSaveError(err.message || "Erreur de sauvegarde");
      setIsSaving(false);
      
      toast.error("Erreur de sauvegarde", {
        description: err.message || "Une erreur est survenue",
      });
      return false;
    }
  }, [enabled, projectId, isSaving, sketch, backgroundImages, markerLinks, computeHash, getLocalStorageKey]);

  // ============================================
  // CHARGEMENT
  // ============================================
  const loadFromProject = useCallback(async (): Promise<boolean> => {
    if (!enabled || !projectId) {
      console.log("[CADProjectSave] Chargement ignoré: pas de projectId");
      return false;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Utilisateur non connecté");
      }

      console.log("[CADProjectSave] Chargement depuis Supabase pour projet:", projectId);

      // Essayer Supabase d'abord
      const { data, error } = await (supabase as any)
        .from("cad_project_sketches")
        .select("sketch_data, background_images, marker_links, geometry_count, updated_at")
        .eq("project_id", projectId)
        .single();

      let sketchData = null;
      let imagesData = null;
      let linksData = null;
      let source = "none";

      if (data && !error) {
        sketchData = data.sketch_data;
        imagesData = data.background_images;
        linksData = data.marker_links;
        source = "supabase";
        console.log(`[CADProjectSave] Données Supabase trouvées: ${data.geometry_count} géométries`);
      } else {
        // Fallback localStorage
        const localStr = localStorage.getItem(getLocalStorageKey());
        if (localStr) {
          try {
            const localData = JSON.parse(localStr);
            sketchData = localData.sketch_data;
            imagesData = localData.background_images;
            linksData = localData.marker_links;
            source = "localStorage";
            console.log(`[CADProjectSave] Données localStorage trouvées: ${localData.geometry_count} géométries`);
          } catch (e) {
            console.warn("[CADProjectSave] Erreur parsing localStorage:", e);
          }
        }
      }

      if (sketchData) {
        // Charger le sketch
        const deserializedSketch = deserializeSketch(sketchData);
        loadSketchData({
          ...deserializedSketch,
          _source: source,
        });

        // Charger les images de fond
        if (imagesData && Array.isArray(imagesData)) {
          // Les images doivent être rechargées avec leur objet Image
          // Le composant parent gèrera la reconstruction des objets Image
          setBackgroundImages(imagesData);
        }

        // Charger les liens marqueurs
        if (linksData && Array.isArray(linksData)) {
          setMarkerLinks(linksData);
        }

        lastSavedHashRef.current = computeHash(sketch, backgroundImages);
        setHasUnsavedChanges(false);
        setIsLoading(false);
        
        toast.success("Gabarit chargé", {
          description: `Depuis ${source === "supabase" ? "le cloud" : "le stockage local"}`,
          duration: 3000,
        });
        
        return true;
      } else {
        console.log("[CADProjectSave] Aucune donnée trouvée pour ce projet");
        setIsLoading(false);
        return false;
      }

    } catch (err: any) {
      console.error("[CADProjectSave] Erreur chargement:", err);
      setLoadError(err.message || "Erreur de chargement");
      setIsLoading(false);
      return false;
    }
  }, [enabled, projectId, loadSketchData, setBackgroundImages, setMarkerLinks, computeHash, getLocalStorageKey, sketch, backgroundImages]);

  // ============================================
  // SUPPRESSION
  // ============================================
  const clearProjectData = useCallback(async (): Promise<boolean> => {
    if (!projectId) return false;

    try {
      // Supprimer de Supabase
      await (supabase as any)
        .from("cad_project_sketches")
        .delete()
        .eq("project_id", projectId);

      // Supprimer de localStorage
      localStorage.removeItem(getLocalStorageKey());

      console.log("[CADProjectSave] Données projet supprimées");
      return true;
    } catch (err) {
      console.error("[CADProjectSave] Erreur suppression:", err);
      return false;
    }
  }, [projectId, getLocalStorageKey]);

  // ============================================
  // DÉTECTION DES CHANGEMENTS
  // ============================================
  const onSketchChange = useCallback((
    newSketch: Sketch,
    newImages: BackgroundImageData[],
    newLinks: MarkerLink[]
  ) => {
    const currentHash = computeHash(newSketch, newImages);
    if (currentHash !== lastSavedHashRef.current) {
      setHasUnsavedChanges(true);

      // Auto-save avec debounce si activé
      if (autoSaveEnabled && projectId) {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        autoSaveTimeoutRef.current = setTimeout(() => {
          console.log("[CADProjectSave] Auto-save déclenché");
          saveToProject();
        }, autoSaveDelayMs);
      }
    }
  }, [computeHash, autoSaveEnabled, projectId, autoSaveDelayMs, saveToProject]);

  // ============================================
  // CHARGEMENT AUTOMATIQUE AU MONTAGE
  // ============================================
  useEffect(() => {
    if (!enabled || !projectId || hasLoadedRef.current) return;

    // Attendre un peu pour laisser le composant s'initialiser
    const timer = setTimeout(async () => {
      console.log("[CADProjectSave] Chargement automatique au montage...");
      hasLoadedRef.current = true;
      await loadFromProject();
    }, 500);

    return () => clearTimeout(timer);
  }, [enabled, projectId, loadFromProject]);

  // Nettoyage
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // ============================================
  // SAUVEGARDE AVANT FERMETURE
  // ============================================
  useEffect(() => {
    if (!enabled || !projectId) return;

    const handleBeforeUnload = () => {
      if (hasUnsavedChanges) {
        // Sauvegarde synchrone en localStorage uniquement (pas le temps pour Supabase)
        const serializedSketch = serializeSketch(sketch);
        const serializedImages = serializeBackgroundImages(backgroundImages);
        const localData = {
          sketch_data: serializedSketch,
          background_images: serializedImages,
          marker_links: markerLinks,
          geometry_count: sketch.geometries.size,
          point_count: sketch.points.size,
          timestamp: Date.now(),
        };
        localStorage.setItem(getLocalStorageKey(), JSON.stringify(localData));
        console.log("[CADProjectSave] Sauvegarde localStorage avant fermeture");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, projectId, hasUnsavedChanges, sketch, backgroundImages, markerLinks, getLocalStorageKey]);

  return {
    isLoading,
    isSaving,
    hasUnsavedChanges,
    lastSaveTime,
    loadError,
    saveError,
    saveToProject,
    loadFromProject,
    clearProjectData,
    onSketchChange,
  };
}

export default useCADProjectSave;
