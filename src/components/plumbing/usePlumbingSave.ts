// ============================================
// HOOK: usePlumbingSave
// Sauvegarde persistante du schéma plomberie
// VERSION: 1.0a - Fix erreur 406 avec maybeSingle()
// ============================================

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PlumbingSchemaState, PlumbingNodeType, PlumbingEdgeType } from "./types";

interface UsePlumbingSaveOptions {
  projectId?: string | null;
  enabled?: boolean;
  autoSaveEnabled?: boolean;
  autoSaveDelayMs?: number;
}

export function usePlumbingSave(
  nodes: PlumbingNodeType[],
  edges: PlumbingEdgeType[],
  options: UsePlumbingSaveOptions = {}
) {
  const {
    projectId,
    enabled = true,
    autoSaveEnabled = true,
    autoSaveDelayMs = 3000,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedHashRef = useRef<string>("");

  const getLocalStorageKey = useCallback(() => {
    return `plumbing_schema_${projectId || "default"}`;
  }, [projectId]);

  const computeHash = useCallback((n: PlumbingNodeType[], e: PlumbingEdgeType[]): string => {
    return `${n.length}-${e.length}-${JSON.stringify(n.map((x) => x.id))}-${JSON.stringify(e.map((x) => x.id))}`;
  }, []);

  // ============================================
  // SAUVEGARDE
  // ============================================

  const saveToProject = useCallback(async (): Promise<boolean> => {
    if (!enabled || !projectId || isSaving) return false;

    setIsSaving(true);
    setSaveError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non connecté");

      const schemaData: PlumbingSchemaState = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      };

      console.log(`[PlumbingSave v1.0] Sauvegarde: ${nodes.length} nodes, ${edges.length} edges`);

      const { error } = await (supabase as any).from("plumbing_schemas").upsert(
        {
          project_id: projectId,
          user_id: user.id,
          schema_data: schemaData,
          nodes_count: nodes.length,
          edges_count: edges.length,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id" }
      );

      // Fallback localStorage
      const localData = {
        schema_data: schemaData,
        nodes_count: nodes.length,
        edges_count: edges.length,
        timestamp: Date.now(),
      };
      localStorage.setItem(getLocalStorageKey(), JSON.stringify(localData));

      if (error) {
        console.error("[PlumbingSave] Erreur Supabase:", error);
        toast.warning("Sauvegarde locale uniquement");
      } else {
        console.log("[PlumbingSave] ✓ Sauvegarde réussie");
        toast.success("Schéma plomberie sauvegardé");
      }

      lastSavedHashRef.current = computeHash(nodes, edges);
      setLastSaveTime(Date.now());
      setHasUnsavedChanges(false);
      setIsSaving(false);
      return true;
    } catch (err: any) {
      console.error("[PlumbingSave] Erreur:", err);
      setSaveError(err.message);
      setIsSaving(false);
      toast.error("Erreur de sauvegarde");
      return false;
    }
  }, [enabled, projectId, isSaving, nodes, edges, computeHash, getLocalStorageKey]);

  // ============================================
  // CHARGEMENT
  // ============================================

  const loadFromProject = useCallback(async (): Promise<PlumbingSchemaState | null> => {
    if (!enabled || !projectId) return null;

    setIsLoading(true);
    setLoadError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non connecté");

      console.log("[PlumbingSave] Chargement projet:", projectId);

      // Utiliser maybeSingle pour éviter erreur 406 si pas de données
      const { data, error } = await (supabase as any)
        .from("plumbing_schemas")
        .select("schema_data, nodes_count, edges_count")
        .eq("project_id", projectId)
        .maybeSingle();

      let schemaData: PlumbingSchemaState | null = null;

      if (data && !error) {
        schemaData = data.schema_data;
        console.log(`[PlumbingSave] Données Supabase: ${data.nodes_count} nodes`);
      } else {
        // Fallback localStorage
        const localStr = localStorage.getItem(getLocalStorageKey());
        if (localStr) {
          try {
            const localData = JSON.parse(localStr);
            schemaData = localData.schema_data;
            console.log("[PlumbingSave] Données localStorage trouvées");
          } catch (e) {
            console.warn("[PlumbingSave] Erreur parsing localStorage");
          }
        }
      }

      if (schemaData) {
        lastSavedHashRef.current = computeHash(schemaData.nodes || [], schemaData.edges || []);
        setHasUnsavedChanges(false);
        toast.success("Schéma plomberie chargé");
      }

      setIsLoading(false);
      return schemaData;
    } catch (err: any) {
      console.error("[PlumbingSave] Erreur chargement:", err);
      setLoadError(err.message);
      setIsLoading(false);
      return null;
    }
  }, [enabled, projectId, computeHash, getLocalStorageKey]);

  // ============================================
  // SUPPRESSION
  // ============================================

  const clearProjectData = useCallback(async (): Promise<boolean> => {
    if (!projectId) return false;
    try {
      await (supabase as any).from("plumbing_schemas").delete().eq("project_id", projectId);
      localStorage.removeItem(getLocalStorageKey());
      return true;
    } catch (err) {
      console.error("[PlumbingSave] Erreur suppression:", err);
      return false;
    }
  }, [projectId, getLocalStorageKey]);

  // ============================================
  // DÉTECTION CHANGEMENTS
  // ============================================

  const markAsChanged = useCallback(() => {
    setHasUnsavedChanges(true);
    if (autoSaveEnabled && projectId) {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = setTimeout(() => saveToProject(), autoSaveDelayMs);
    }
  }, [autoSaveEnabled, projectId, autoSaveDelayMs, saveToProject]);

  const markAsSaved = useCallback(() => {
    setHasUnsavedChanges(false);
    lastSavedHashRef.current = computeHash(nodes, edges);
  }, [computeHash, nodes, edges]);

  // Sauvegarde avant fermeture
  useEffect(() => {
    if (!enabled || !projectId) return;
    const handleBeforeUnload = () => {
      if (hasUnsavedChanges) {
        const schemaData = { nodes, edges };
        localStorage.setItem(getLocalStorageKey(), JSON.stringify({
          schema_data: schemaData,
          timestamp: Date.now(),
        }));
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, projectId, hasUnsavedChanges, nodes, edges, getLocalStorageKey]);

  // Nettoyage
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, []);

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
    markAsChanged,
    markAsSaved,
  };
}

export default usePlumbingSave;
