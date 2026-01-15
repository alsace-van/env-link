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
    // FIX #86b: Utiliser img.src ou img.image.src comme fallback
    src: img.src || img.image?.src || null,
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
    order: img.order,
    crop: img.crop,
    // FIX #86: Sérialiser calibrationData (Map → Array pour JSON)
    calibrationData: img.calibrationData
      ? {
          mode: img.calibrationData.mode,
          scale: img.calibrationData.scale,
          scaleX: img.calibrationData.scaleX,
          scaleY: img.calibrationData.scaleY,
          error: img.calibrationData.error,
          errorX: img.calibrationData.errorX,
          errorY: img.calibrationData.errorY,
          applied: img.calibrationData.applied,
          // Convertir les Map en tableaux pour la sérialisation JSON
          points: img.calibrationData.points ? Array.from(img.calibrationData.points.entries()) : [],
          pairs: img.calibrationData.pairs ? Array.from(img.calibrationData.pairs.entries()) : [],
        }
      : undefined,
    // Exclure img.image (HTMLImageElement non sérialisable)
  }));
}

// FIX #86: Désérialiser les images de fond (reconvertir Arrays en Maps)
// FIX #86b: Charger les HTMLImageElement de façon asynchrone
async function deserializeBackgroundImages(images: unknown[]): Promise<BackgroundImage[]> {
  const loadedImages: BackgroundImage[] = [];

  for (const imgData of images) {
    const img = imgData as Record<string, unknown>;
    const calibData = img.calibrationData as Record<string, unknown> | undefined;

    // Charger l'HTMLImageElement depuis le src
    const src = img.src as string | undefined;
    let htmlImage: HTMLImageElement | null = null;

    if (src) {
      try {
        htmlImage = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`Failed to load image: ${img.name}`));
          image.src = src;
        });
      } catch (error) {
        console.error("[AutoBackup] Failed to load image:", img.name, error);
        // Continuer sans cette image
        continue;
      }
    } else {
      console.warn("[AutoBackup] Image without src, skipping:", img.name);
      continue;
    }

    loadedImages.push({
      ...img,
      image: htmlImage,
      src: src,
      // Reconvertir calibrationData si présent
      calibrationData: calibData
        ? {
            mode: calibData.mode as "simple" | "perspective" | undefined,
            scale: calibData.scale as number | undefined,
            scaleX: calibData.scaleX as number | undefined,
            scaleY: calibData.scaleY as number | undefined,
            error: calibData.error as number | undefined,
            errorX: calibData.errorX as number | undefined,
            errorY: calibData.errorY as number | undefined,
            applied: calibData.applied as boolean | undefined,
            // Reconvertir les tableaux en Maps
            points:
              calibData.points && Array.isArray(calibData.points)
                ? new Map(calibData.points as [string, unknown][])
                : new Map(),
            pairs:
              calibData.pairs && Array.isArray(calibData.pairs)
                ? new Map(calibData.pairs as [string, unknown][])
                : new Map(),
          }
        : undefined,
    } as BackgroundImage);
  }

  return loadedImages;
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
  options: UseCADAutoBackupOptions = {},
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
  // FIX #86: Inclure aussi les images de fond et les points de calibration
  const computeHash = useCallback((sketch: Sketch, images: BackgroundImage[]): string => {
    const geoCount = sketch.geometries.size;
    const pointCount = sketch.points.size;
    const geoIds = Array.from(sketch.geometries.keys()).sort().join(",");

    // Ajouter les infos des images et calibration au hash
    const imageHash = images
      .map((img) => {
        const calibPointCount = img.calibrationData?.points?.size || 0;
        const calibPairCount = img.calibrationData?.pairs?.size || 0;
        const calibApplied = img.calibrationData?.applied ? 1 : 0;
        return `${img.id}:${img.scale.toFixed(2)}:${calibPointCount}:${calibPairCount}:${calibApplied}`;
      })
      .join("|");

    return `${geoCount}:${pointCount}:${geoIds.slice(0, 100)}|img:${imageHash}`;
  }, []);

  // Logger un événement dans Supabase (pour debug)
  const logEvent = useCallback(async (eventType: string, details: Record<string, unknown>) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
  const saveBackup = useCallback(
    async (force = false): Promise<boolean> => {
      if (!enabled || isRestoringRef.current) return false;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          console.log("[AutoBackup] No user logged in, skipping backup");
          return false;
        }

        const geometryCount = sketch.geometries.size;
        const pointCount = sketch.points.size;

        // FIX #86: Compter aussi les images de fond et les points de calibration
        const imageCount = backgroundImages.length;
        const calibrationPointCount = backgroundImages.reduce((acc, img) => {
          return acc + (img.calibrationData?.points?.size || 0);
        }, 0);
        const hasSignificantContent = geometryCount >= minGeometryCount || imageCount > 0 || calibrationPointCount > 0;

        // Ne pas sauvegarder si pas de contenu significatif (sauf si forcé)
        if (!force && !hasSignificantContent) {
          console.log(
            `[AutoBackup] Skipping - only ${geometryCount} geometries, ${imageCount} images, ${calibrationPointCount} calib points`,
          );
          return false;
        }

        // Vérifier si quelque chose a changé
        const currentHash = computeHash(sketch, backgroundImages);
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

        setState((prev) => ({
          ...prev,
          lastBackupTime: Date.now(),
          backupCount: prev.backupCount + 1,
        }));

        // FIX #86: Log amélioré avec images et calibration
        console.log(
          `[AutoBackup] Saved successfully: ${geometryCount} geometries, ${pointCount} points, ${imageCount} images, ${calibrationPointCount} calib points`,
        );

        await logEvent("backup_created", {
          geometryCount,
          pointCount,
          imageCount,
          calibrationPointCount,
          hash: currentHash,
        });

        return true;
      } catch (error) {
        console.error("[AutoBackup] Error saving backup:", error);
        return false;
      }
    },
    [enabled, sketch, backgroundImages, markerLinks, templateId, minGeometryCount, computeHash, logEvent],
  );

  // Récupérer le dernier backup valide
  const getLatestBackup = useCallback(async (): Promise<CADAutoBackupRow | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
  const restoreFromBackup = useCallback(
    async (showToast = true): Promise<boolean> => {
      if (isRestoringRef.current) return false;

      isRestoringRef.current = true;
      setState((prev) => ({ ...prev, isRestoring: true }));

      try {
        const backup = await getLatestBackup();

        if (!backup || !backup.sketch_data) {
          console.log("[AutoBackup] No valid backup to restore");
          if (showToast) toast.error("Aucune sauvegarde disponible");
          return false;
        }

        // FIX #86: Vérifier que le backup a du contenu (géométries OU images OU points de calibration)
        const backupGeoCount = backup.geometry_count || 0;
        // FIX #86b: Désérialiser les images de façon asynchrone (charge les HTMLImageElement)
        const backupImages =
          backup.background_images && Array.isArray(backup.background_images)
            ? await deserializeBackgroundImages(backup.background_images)
            : [];
        const backupImageCount = backupImages.length;
        const backupCalibPointCount = backupImages.reduce((acc, img) => {
          return acc + (img.calibrationData?.points?.size || 0);
        }, 0);

        const hasContent = backupGeoCount >= minGeometryCount || backupImageCount > 0 || backupCalibPointCount > 0;

        if (!hasContent) {
          console.log("[AutoBackup] Backup has no significant content");
          if (showToast) toast.error("La sauvegarde est vide");
          return false;
        }

        console.log(
          `[AutoBackup] Restoring backup: ${backupGeoCount} geometries, ${backupImageCount} images, ${backupCalibPointCount} calib points`,
        );

        // Restaurer le sketch
        loadSketchData(backup.sketch_data);

        // FIX #86: Restaurer les images de fond avec calibrationData désérialisé
        if (backupImages.length > 0) {
          setBackgroundImages(backupImages);
        }

        // Restaurer les liens de marqueurs
        if (backup.marker_links && Array.isArray(backup.marker_links)) {
          setMarkerLinks(backup.marker_links as ImageMarkerLink[]);
        }

        // FIX #86: Mettre à jour les refs pour éviter de re-sauvegarder immédiatement
        lastSavedHashRef.current = computeHash(sketch, backupImages);
        previousGeometryCountRef.current = backupGeoCount;

        setState((prev) => ({
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
        setState((prev) => ({ ...prev, isRestoring: false }));
      }
    },
    [
      getLatestBackup,
      loadSketchData,
      setBackgroundImages,
      setMarkerLinks,
      minGeometryCount,
      computeHash,
      logEvent,
      sketch,
    ],
  );

  // FIX #86b: Désactivé - la restauration automatique causait des problèmes
  // quand l'utilisateur supprimait volontairement des éléments
  // La restauration manuelle reste disponible via le bouton
  /*
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
  */

  // Simplement mettre à jour le compteur sans restauration automatique
  useEffect(() => {
    if (!enabled || isRestoringRef.current) return;
    previousGeometryCountRef.current = sketch.geometries.size;
  }, [enabled, sketch.geometries.size]);

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
      await new Promise((resolve) => setTimeout(resolve, 1000));

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
    formattedLastBackup: state.lastBackupTime ? new Date(state.lastBackupTime).toLocaleTimeString("fr-FR") : null,
  };
}

export default useCADAutoBackup;
