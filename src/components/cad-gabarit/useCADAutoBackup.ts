// ============================================
// HOOK: useCADAutoBackup
// Sauvegarde automatique du canvas CAD sur Supabase
// Protection contre les pertes de données spontanées
// VERSION: 1.1 - Fix types Supabase
// ============================================

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Sketch } from "./types";
import type { BackgroundImage, ImageMarkerLink } from "./types";

// Générer un ID de session unique pour cette instance du navigateur
const generateSessionId = (): string => {
  const stored = sessionStorage.getItem("cad_session_id");
  if (stored) return stored;
  
  const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem("cad_session_id", newId);
  return newId;
};

// Types pour les tables Supabase (en attendant la régénération des types)
interface CADAutoBackupRow {
  id: string;
  user_id: string;
  session_id: string;
  template_id: string | null;
  sketch_data: Record<string, unknown>;
  background_images: unknown[] | null;
  marker_links: unknown[] | null;
  geometry_count: number;
  point_count: number;
  created_at: string;
}

interface AutoBackupState {
  lastBackupTime: number | null;
  backupCount: number;
  isRestoring: boolean;
  hasRestoredThisSession: boolean;
}

interface UseCADAutoBackupOptions {
  enabled?: boolean;
  intervalMs?: number; // Intervalle entre les sauvegardes (défaut: 30s)
  minGeometryCount?: number; // Nombre minimum de géométries pour sauvegarder
  templateId?: string;
}

interface SerializedSketch {
  id: string;
  name: string;
  points: Record<string, unknown>;
  geometries: Record<string, unknown>;
  constraints: Record<string, unknown>;
  dimensions: Record<string, unknown>;
  scaleFactor: number;
  layers?: Record<string, unknown>;
  groups?: Record<string, unknown>;
  shapeFills?: Record<string, unknown>;
  activeLayerId?: string;
}

// Sérialiser le sketch pour le stockage
function serializeSketchForBackup(sketch: Sketch): SerializedSketch {
  return {
    id: sketch.id,
    name: sketch.name,
    points: Object.fromEntries(sketch.points),
    geometries: Object.fromEntries(sketch.geometries),
    constraints: Object.fromEntries(sketch.constraints),
    dimensions: Object.fromEntries(sketch.dimensions),
    scaleFactor: sketch.scaleFactor,
    layers: sketch.layers ? Object.fromEntries(sketch.layers) : undefined,
    groups: sketch.groups ? Object.fromEntries(sketch.groups) : undefined,
    shapeFills: sketch.shapeFills ? Object.fromEntries(sketch.shapeFills) : undefined,
    activeLayerId: sketch.activeLayerId,
  };
}

// Sérialiser les images de fond (sans HTMLImageElement)
function serializeBackgroundImages(images: BackgroundImage[]): unknown[] {
  return images.map((img) => ({
    id: img.id,
    name: img.name,
    src: img.src,
    x: img.x,
    y: img.y,
    scale: img.scale,
    rotation: img.rotation,
    opacity: img.opacity,
    visible: img.visible,
    locked: img.locked,
    markers: img.markers,
    adjustments: img.adjustments,
    layerId: img.layerId,
    // Exclure img.image (HTMLImageElement non sérialisable)
  }));
}

// Client Supabase non typé pour les nouvelles tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabase as any;

export function useCADAutoBackup(
  sketch: Sketch,
  backgroundImages: BackgroundImage[],
  markerLinks: ImageMarkerLink[],
  loadSketchData: (data: unknown) => void,
  setBackgroundImages: (images: BackgroundImage[]) => void,
  setMarkerLinks: (links: ImageMarkerLink[]) => void,
  options: UseCADAutoBackupOptions = {}
) {
  const {
    enabled = true,
    intervalMs = 30000, // 30 secondes par défaut
    minGeometryCount = 1,
    templateId,
  } = options;

  const sessionId = useRef(generateSessionId());
  const lastSavedHashRef = useRef<string>("");
  const previousGeometryCountRef = useRef<number>(0);
  const isRestoringRef = useRef(false);
  
  const [state, setState] = useState<AutoBackupState>({
    lastBackupTime: null,
    backupCount: 0,
    isRestoring: false,
    hasRestoredThisSession: false,
  });

  // Calculer un hash simple pour détecter les changements
  const computeHash = useCallback((sketch: Sketch): string => {
    const geoCount = sketch.geometries.size;
    const pointCount = sketch.points.size;
    const geoIds = Array.from(sketch.geometries.keys()).sort().join(",");
    return `${geoCount}:${pointCount}:${geoIds.slice(0, 100)}`;
  }, []);

  // Logger un événement dans Supabase (pour debug)
  const logEvent = useCallback(async (
    eventType: string,
    details: Record<string, unknown>
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabaseAny.from("cad_autobackup_logs").insert({
        user_id: user.id,
        session_id: sessionId.current,
        event_type: eventType,
        details: {
          ...details,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
        },
      });
    } catch (error) {
      console.error("[AutoBackup] Failed to log event:", error);
    }
  }, []);

  // Sauvegarder le sketch dans Supabase
  const saveBackup = useCallback(async (force = false): Promise<boolean> => {
    if (!enabled || isRestoringRef.current) return false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("[AutoBackup] No user logged in, skipping backup");
        return false;
      }

      const geometryCount = sketch.geometries.size;
      const pointCount = sketch.points.size;

      // Ne pas sauvegarder si pas assez de géométries (sauf si forcé)
      if (!force && geometryCount < minGeometryCount) {
        console.log(`[AutoBackup] Skipping - only ${geometryCount} geometries`);
        return false;
      }

      // Vérifier si quelque chose a changé
      const currentHash = computeHash(sketch);
      if (!force && currentHash === lastSavedHashRef.current) {
        console.log("[AutoBackup] No changes detected, skipping");
        return false;
      }

      const serializedSketch = serializeSketchForBackup(sketch);
      const serializedImages = serializeBackgroundImages(backgroundImages);

      const { error } = await supabaseAny.from("cad_autobackups").insert({
        user_id: user.id,
        session_id: sessionId.current,
        template_id: templateId || null,
        sketch_data: serializedSketch,
        background_images: serializedImages,
        marker_links: markerLinks,
        geometry_count: geometryCount,
        point_count: pointCount,
      });

      if (error) {
        console.error("[AutoBackup] Failed to save:", error);
        return false;
      }

      lastSavedHashRef.current = currentHash;
      previousGeometryCountRef.current = geometryCount;
      
      setState(prev => ({
        ...prev,
        lastBackupTime: Date.now(),
        backupCount: prev.backupCount + 1,
      }));

      console.log(`[AutoBackup] Saved successfully: ${geometryCount} geometries, ${pointCount} points`);
      
      await logEvent("backup_created", {
        geometryCount,
        pointCount,
        hash: currentHash,
      });

      return true;
    } catch (error) {
      console.error("[AutoBackup] Error saving backup:", error);
      return false;
    }
  }, [enabled, sketch, backgroundImages, markerLinks, templateId, minGeometryCount, computeHash, logEvent]);

  // Récupérer le dernier backup valide
  const getLatestBackup = useCallback(async (): Promise<CADAutoBackupRow | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabaseAny
        .from("cad_autobackups")
        .select("*")
        .eq("user_id", user.id)
        .eq("session_id", sessionId.current)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.log("[AutoBackup] No backup found for this session");
        return null;
      }

      return data as CADAutoBackupRow;
    } catch (error) {
      console.error("[AutoBackup] Error fetching backup:", error);
      return null;
    }
  }, []);

  // Restaurer depuis un backup
  const restoreFromBackup = useCallback(async (showToast = true): Promise<boolean> => {
    if (isRestoringRef.current) return false;
    
    isRestoringRef.current = true;
    setState(prev => ({ ...prev, isRestoring: true }));

    try {
      const backup = await getLatestBackup();
      
      if (!backup || !backup.sketch_data) {
        console.log("[AutoBackup] No valid backup to restore");
        if (showToast) toast.error("Aucune sauvegarde disponible");
        return false;
      }

      // Vérifier que le backup a du contenu
      const backupGeoCount = backup.geometry_count || 0;
      if (backupGeoCount < minGeometryCount) {
        console.log("[AutoBackup] Backup has no significant content");
        if (showToast) toast.error("La sauvegarde est vide");
        return false;
      }

      console.log(`[AutoBackup] Restoring backup: ${backupGeoCount} geometries`);

      // Restaurer le sketch
      loadSketchData(backup.sketch_data);

      // Restaurer les images de fond (sans HTMLImageElement - sera rechargé par le composant)
      if (backup.background_images && Array.isArray(backup.background_images)) {
        setBackgroundImages(backup.background_images as BackgroundImage[]);
      }

      // Restaurer les liens de marqueurs
      if (backup.marker_links && Array.isArray(backup.marker_links)) {
        setMarkerLinks(backup.marker_links as ImageMarkerLink[]);
      }

      // Mettre à jour les refs pour éviter de re-sauvegarder immédiatement
      lastSavedHashRef.current = computeHash(sketch);
      previousGeometryCountRef.current = backupGeoCount;

      setState(prev => ({
        ...prev,
        isRestoring: false,
        hasRestoredThisSession: true,
      }));

      await logEvent("restored", {
        backupId: backup.id,
        geometryCount: backupGeoCount,
        pointCount: backup.point_count,
        backupAge: Date.now() - new Date(backup.created_at).getTime(),
      });

      if (showToast) {
        toast.success(`Canvas restauré (${backupGeoCount} éléments)`, {
          description: "Sauvegarde automatique récupérée",
          duration: 5000,
        });
      }

      return true;
    } catch (error) {
      console.error("[AutoBackup] Error restoring:", error);
      if (showToast) toast.error("Erreur lors de la restauration");
      return false;
    } finally {
      isRestoringRef.current = false;
      setState(prev => ({ ...prev, isRestoring: false }));
    }
  }, [getLatestBackup, loadSketchData, setBackgroundImages, setMarkerLinks, minGeometryCount, computeHash, logEvent, sketch]);

  // Détecter la perte de données et restaurer automatiquement
  useEffect(() => {
    if (!enabled || isRestoringRef.current || state.isRestoring) return;

    const currentGeoCount = sketch.geometries.size;
    const previousGeoCount = previousGeometryCountRef.current;

    // Détecter une perte brutale : beaucoup d'éléments -> 0
    if (previousGeoCount >= 3 && currentGeoCount === 0) {
      console.warn(`[AutoBackup] ⚠️ LOSS DETECTED: ${previousGeoCount} -> ${currentGeoCount} geometries`);
      
      // Logger l'événement de perte
      logEvent("loss_detected", {
        previousCount: previousGeoCount,
        currentCount: currentGeoCount,
        stack: new Error().stack,
      });

      // Tenter la restauration automatique
      toast.warning("Perte de données détectée, restauration en cours...", {
        duration: 3000,
      });

      restoreFromBackup(true);
      return;
    }

    // Mettre à jour le compteur précédent
    previousGeometryCountRef.current = currentGeoCount;
  }, [enabled, sketch.geometries.size, state.isRestoring, logEvent, restoreFromBackup]);

  // Sauvegarde périodique
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      saveBackup(false);
    }, intervalMs);

    // Sauvegarder immédiatement au montage si on a du contenu
    if (sketch.geometries.size >= minGeometryCount) {
      saveBackup(false);
    }

    return () => clearInterval(interval);
  }, [enabled, intervalMs, saveBackup, sketch.geometries.size, minGeometryCount]);

  // Sauvegarder avant de quitter la page
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      // Note: On ne peut pas faire d'async ici, donc on sauvegarde en sync si possible
      // La sauvegarde périodique devrait suffire dans la plupart des cas
      console.log("[AutoBackup] Page unload - last backup was at:", state.lastBackupTime);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, state.lastBackupTime]);

  // Charger le dernier backup au démarrage si le canvas est vide
  useEffect(() => {
    if (!enabled || state.hasRestoredThisSession) return;

    const checkAndRestoreOnMount = async () => {
      // Attendre un peu pour laisser le composant s'initialiser
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Si le canvas est toujours vide, vérifier s'il y a un backup récent
      if (sketch.geometries.size === 0) {
        const backup = await getLatestBackup();
        if (backup && (backup.geometry_count || 0) >= minGeometryCount) {
          const backupAge = Date.now() - new Date(backup.created_at).getTime();
          // Restaurer uniquement si le backup a moins de 5 minutes
          if (backupAge < 5 * 60 * 1000) {
            console.log("[AutoBackup] Found recent backup on mount, offering restore");
            toast.info("Sauvegarde récente trouvée", {
              description: "Cliquez pour restaurer votre travail",
              action: {
                label: "Restaurer",
                onClick: () => restoreFromBackup(true),
              },
              duration: 10000,
            });
          }
        }
      }
    };

    checkAndRestoreOnMount();
  }, [enabled, state.hasRestoredThisSession]); // Dépendances minimales pour éviter les re-runs

  return {
    // État
    lastBackupTime: state.lastBackupTime,
    backupCount: state.backupCount,
    isRestoring: state.isRestoring,
    sessionId: sessionId.current,
    
    // Actions
    saveBackup,
    restoreFromBackup,
    getLatestBackup,
    
    // Pour affichage dans l'UI
    formattedLastBackup: state.lastBackupTime
      ? new Date(state.lastBackupTime).toLocaleTimeString("fr-FR")
      : null,
  };
}

export default useCADAutoBackup;
