// ============================================
// HOOK: useCADAutoBackup
// Sauvegarde automatique du canvas CAD sur Supabase
// Protection contre les pertes de données spontanées
// VERSION: 1.5 - Compression images + fallback localStorage + indicateurs erreur
// ============================================
// CHANGELOG:
// v1.5 - Compression auto images >500KB, fallback localStorage, indicateurs d'erreur UI
//      - minGeometryCount = 0 par défaut (sauvegarder dès qu'il y a des images)
//      - Nouveaux états: hasError, consecutiveFailures, lastError, isSupabaseDown
//      - Restauration depuis localStorage si Supabase échoue
//      - Debug logs améliorés pour comprendre les problèmes
// v1.4 - Limite taille images (500KB), ignore backups >24h, persiste tentative restore
// v1.3 - Restaurer les géométries même si les images échouent (HEIC non supporté)
// v1.2 - Restauration automatique quand canvas vide et backup existe
// v1.1 - Fix types Supabase
// ============================================

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Sketch } from "./types";
import type { BackgroundImage, ImageMarkerLink } from "./types";

// ============================================
// CONSTANTES
// ============================================
const MAX_SRC_SIZE = 500000; // 500KB max par image src avant compression
const COMPRESSION_QUALITY = 0.8; // Qualité JPEG pour compression
const MAX_IMAGE_DIMENSION = 2000; // Dimension max en pixels
const LOCALSTORAGE_KEY_PREFIX = "cad_autobackup_";
const MAX_CONSECUTIVE_FAILURES = 3; // Après 3 échecs, marquer Supabase comme down

// ============================================
// UTILS
// ============================================

// Générer un ID de session unique - persiste dans localStorage
const generateSessionId = (): string => {
  const stored = localStorage.getItem("cad_session_id");
  if (stored) return stored;

  const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem("cad_session_id", newId);
  return newId;
};

// v1.5: Compresser une image en JPEG
async function compressImage(
  dataUrl: string,
  maxSize: number = MAX_SRC_SIZE,
  quality: number = COMPRESSION_QUALITY,
  maxDimension: number = MAX_IMAGE_DIMENSION
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Calculer les dimensions finales
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        // Créer un canvas pour la compression
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Cannot create canvas context"));
          return;
        }

        // Dessiner l'image redimensionnée
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir en JPEG compressé
        let compressed = canvas.toDataURL("image/jpeg", quality);

        // Si toujours trop gros, réduire la qualité progressivement
        let currentQuality = quality;
        while (compressed.length > maxSize && currentQuality > 0.3) {
          currentQuality -= 0.1;
          compressed = canvas.toDataURL("image/jpeg", currentQuality);
        }

        // Si toujours trop gros, réduire les dimensions
        if (compressed.length > maxSize) {
          const ratio = Math.sqrt(maxSize / compressed.length);
          canvas.width = Math.floor(width * ratio);
          canvas.height = Math.floor(height * ratio);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          compressed = canvas.toDataURL("image/jpeg", 0.7);
        }

        console.log(`[AutoBackup] Image compressed: ${(dataUrl.length / 1024).toFixed(0)}KB -> ${(compressed.length / 1024).toFixed(0)}KB`);
        resolve(compressed);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = dataUrl;
  });
}

// ============================================
// TYPES
// ============================================

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
  // v1.5: Nouveaux états pour l'UI
  hasError: boolean;
  consecutiveFailures: number;
  lastError: string | null;
  isSupabaseDown: boolean;
  lastLocalBackupTime: number | null;
}

interface UseCADAutoBackupOptions {
  enabled?: boolean;
  intervalMs?: number;
  minGeometryCount?: number; // v1.5: Défaut à 0 (sauvegarder même sans géométries)
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

interface LocalBackupData {
  timestamp: number;
  sketch_data: SerializedSketch;
  background_images: unknown[];
  marker_links: unknown[];
  geometry_count: number;
  image_count: number;
  template_id: string | null;
}

// ============================================
// SÉRIALISATION
// ============================================

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

// v1.5: Sérialiser les images avec compression automatique
async function serializeBackgroundImagesWithCompression(images: BackgroundImage[]): Promise<unknown[]> {
  let totalSize = 0;
  let compressedCount = 0;
  let skippedCount = 0;

  const serializedPromises = images.map(async (img) => {
    let src = img.src || img.image?.src || null;

    // v1.5: Compresser si trop gros au lieu d'ignorer
    if (src && src.length > MAX_SRC_SIZE) {
      try {
        const originalSize = src.length;
        src = await compressImage(src);
        compressedCount++;
        console.log(`[AutoBackup] Image "${img.name}" compressed: ${(originalSize / 1024).toFixed(0)}KB -> ${(src.length / 1024).toFixed(0)}KB`);
      } catch (err) {
        console.warn(`[AutoBackup] Failed to compress image "${img.name}", skipping src:`, err);
        skippedCount++;
        src = null;
      }
    }

    if (src) {
      totalSize += src.length;
    }

    return {
      id: img.id,
      name: img.name,
      src: src,
      x: img.x,
      y: img.y,
      scale: img.scale,
      scaleX: img.scaleX,
      scaleY: img.scaleY,
      rotation: img.rotation,
      opacity: img.opacity,
      visible: img.visible,
      locked: img.locked,
      markers: img.markers,
      adjustments: img.adjustments,
      layerId: img.layerId,
      order: img.order,
      crop: img.crop,
      originalWidth: img.image?.width,
      originalHeight: img.image?.height,
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
            points: img.calibrationData.points ? Array.from(img.calibrationData.points.entries()) : [],
            pairs: img.calibrationData.pairs ? Array.from(img.calibrationData.pairs.entries()) : [],
          }
        : undefined,
    };
  });

  const serialized = await Promise.all(serializedPromises);

  if (compressedCount > 0 || skippedCount > 0) {
    console.log(`[AutoBackup] Images: ${compressedCount} compressed, ${skippedCount} skipped. Total: ${(totalSize / 1024).toFixed(0)}KB`);
  }

  return serialized;
}

// Sérialisation synchrone (sans compression, pour localStorage rapide)
function serializeBackgroundImagesSync(images: BackgroundImage[]): unknown[] {
  return images.map((img) => {
    const src = img.src || img.image?.src || null;
    
    // Pour localStorage, on garde tout même si c'est gros
    // (localStorage a une limite de ~5-10MB par domaine)

    return {
      id: img.id,
      name: img.name,
      src: src,
      x: img.x,
      y: img.y,
      scale: img.scale,
      scaleX: img.scaleX,
      scaleY: img.scaleY,
      rotation: img.rotation,
      opacity: img.opacity,
      visible: img.visible,
      locked: img.locked,
      markers: img.markers,
      adjustments: img.adjustments,
      layerId: img.layerId,
      order: img.order,
      crop: img.crop,
      originalWidth: img.image?.width,
      originalHeight: img.image?.height,
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
            points: img.calibrationData.points ? Array.from(img.calibrationData.points.entries()) : [],
            pairs: img.calibrationData.pairs ? Array.from(img.calibrationData.pairs.entries()) : [],
          }
        : undefined,
    };
  });
}

// ============================================
// DÉSÉRIALISATION
// ============================================

interface DeserializeResult {
  images: BackgroundImage[];
  failedCount: number;
  failedNames: string[];
}

async function deserializeBackgroundImages(
  serializedImages: unknown[],
): Promise<DeserializeResult> {
  const loadedImages: BackgroundImage[] = [];
  let failedCount = 0;
  const failedNames: string[] = [];

  for (const imgData of serializedImages) {
    const data = imgData as Record<string, unknown>;
    const src = data.src as string | null;

    let imageElement: HTMLImageElement | null = null;

    if (src) {
      try {
        imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to load image`));
          img.src = src;
        });
      } catch (err) {
        console.warn(`[AutoBackup] Failed to load image "${data.name}":`, err);
        failedCount++;
        failedNames.push(data.name as string);
        // v1.3: Continuer sans l'image au lieu d'échouer complètement
      }
    }

    const calibData = data.calibrationData as Record<string, unknown> | undefined;

    loadedImages.push({
      id: data.id as string,
      name: data.name as string,
      src: src || undefined,
      image: imageElement!,
      x: data.x as number,
      y: data.y as number,
      scale: data.scale as number,
      scaleX: data.scaleX as number | undefined,
      scaleY: data.scaleY as number | undefined,
      rotation: data.rotation as number,
      opacity: data.opacity as number,
      visible: data.visible as boolean,
      locked: data.locked as boolean,
      markers: (data.markers as BackgroundImage["markers"]) || [],
      adjustments: data.adjustments as BackgroundImage["adjustments"],
      layerId: data.layerId as string | undefined,
      order: data.order as number | undefined,
      crop: data.crop as BackgroundImage["crop"],
      calibrationData: calibData
        ? {
            mode: calibData.mode as string | undefined,
            scale: calibData.scale as number | undefined,
            scaleX: calibData.scaleX as number | undefined,
            scaleY: calibData.scaleY as number | undefined,
            error: calibData.error as number | undefined,
            errorX: calibData.errorX as number | undefined,
            errorY: calibData.errorY as number | undefined,
            applied: calibData.applied as boolean | undefined,
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

  return { images: loadedImages, failedCount, failedNames };
}

// Client Supabase non typé pour les nouvelles tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabase as any;

// ============================================
// HOOK PRINCIPAL
// ============================================

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
    minGeometryCount = 0, // v1.5: 0 par défaut (sauvegarder même avec juste des images)
    templateId,
  } = options;

  const sessionId = useRef(generateSessionId());
  const lastSavedHashRef = useRef<string>("");
  const previousGeometryCountRef = useRef<number>(0);
  const isRestoringRef = useRef(false);
  const pendingSaveTimeoutRef = useRef<number | null>(null);
  const lastSeenHashRef = useRef<string>("");
  const isSavingRef = useRef(false); // v1.5: Éviter les sauvegardes concurrentes

  const [state, setState] = useState<AutoBackupState>({
    lastBackupTime: null,
    backupCount: 0,
    isRestoring: false,
    hasRestoredThisSession: false,
    // v1.5: Nouveaux états
    hasError: false,
    consecutiveFailures: 0,
    lastError: null,
    isSupabaseDown: false,
    lastLocalBackupTime: null,
  });

  // ============================================
  // HASH POUR DÉTECTER LES CHANGEMENTS
  // ============================================
  const computeHash = useCallback((sketch: Sketch, images: BackgroundImage[]): string => {
    const hashString = (input: string): string => {
      let hash = 0x811c9dc5;
      for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
      }
      return (hash >>> 0).toString(16);
    };

    const base = `${sketch.geometries.size}:${sketch.points.size}:${sketch.constraints.size}:${sketch.dimensions.size}`;

    const pointsSig = Array.from(sketch.points.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, p]) => `${id}:${p.x.toFixed(2)},${p.y.toFixed(2)},${p.fixed ? 1 : 0}`)
      .join("|");

    const geometriesSig = Array.from(sketch.geometries.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, g]) => {
        if (g.type === "line") {
          const line = g as any;
          return `${id}:line:${line.p1}:${line.p2}:${line.construction ? 1 : 0}:${line.layerId || ""}`;
        }
        if (g.type === "circle") {
          const c = g as any;
          return `${id}:circle:${c.center}:${Number(c.radius || 0).toFixed(3)}:${c.construction ? 1 : 0}:${c.layerId || ""}`;
        }
        if (g.type === "arc") {
          const a = g as any;
          return `${id}:arc:${a.center}:${a.startPoint}:${a.endPoint}:${Number(a.radius || 0).toFixed(3)}:${a.counterClockwise ? 1 : 0}:${a.construction ? 1 : 0}:${a.layerId || ""}`;
        }
        if (g.type === "rectangle") {
          const r = g as any;
          return `${id}:rect:${r.p1}:${r.p2}:${r.p3}:${r.p4}:${r.construction ? 1 : 0}:${r.layerId || ""}`;
        }
        return `${id}:${(g as any).type}`;
      })
      .join("|");

    // v1.5: Hash plus complet des images incluant scaleX/scaleY
    const imageSig = images
      .map((img) => {
        const calibPointCount = img.calibrationData?.points?.size || 0;
        const calibPairCount = img.calibrationData?.pairs?.size || 0;
        const calibApplied = img.calibrationData?.applied ? 1 : 0;
        const x = Number(img.x) || 0;
        const y = Number(img.y) || 0;
        const scale = Number(img.scale) || 1;
        const scaleX = Number(img.scaleX) || scale;
        const scaleY = Number(img.scaleY) || scale;
        const rotation = Number(img.rotation) || 0;
        const hasSrc = img.src || img.image?.src ? 1 : 0;
        return `${img.id}:${x.toFixed(2)},${y.toFixed(2)}:${scaleX.toFixed(4)},${scaleY.toFixed(4)}:${rotation.toFixed(2)}:${calibPointCount}:${calibPairCount}:${calibApplied}:${hasSrc}`;
      })
      .join("|");

    return `${base}|p:${hashString(pointsSig)}|g:${hashString(geometriesSig)}|img:${hashString(imageSig)}`;
  }, []);

  // ============================================
  // SAUVEGARDE LOCALSTORAGE (FALLBACK)
  // ============================================
  const saveToLocalStorage = useCallback((
    serializedSketch: SerializedSketch,
    serializedImages: unknown[],
    geometryCount: number,
    imageCount: number
  ): boolean => {
    try {
      const key = `${LOCALSTORAGE_KEY_PREFIX}${templateId || "default"}`;
      const data: LocalBackupData = {
        timestamp: Date.now(),
        sketch_data: serializedSketch,
        background_images: serializedImages,
        marker_links: markerLinks,
        geometry_count: geometryCount,
        image_count: imageCount,
        template_id: templateId || null,
      };

      localStorage.setItem(key, JSON.stringify(data));
      console.log(`[AutoBackup] Saved to localStorage: ${geometryCount} geometries, ${imageCount} images`);
      return true;
    } catch (err) {
      console.error("[AutoBackup] Failed to save to localStorage:", err);
      // Probablement quota exceeded - essayer de nettoyer
      try {
        // Supprimer les vieux backups localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(LOCALSTORAGE_KEY_PREFIX) && k !== `${LOCALSTORAGE_KEY_PREFIX}${templateId || "default"}`) {
            localStorage.removeItem(k);
          }
        }
        // Réessayer
        const key = `${LOCALSTORAGE_KEY_PREFIX}${templateId || "default"}`;
        const data: LocalBackupData = {
          timestamp: Date.now(),
          sketch_data: serializedSketch,
          background_images: serializedImages,
          marker_links: markerLinks,
          geometry_count: geometryCount,
          image_count: imageCount,
          template_id: templateId || null,
        };
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    }
  }, [templateId, markerLinks]);

  const getFromLocalStorage = useCallback((): LocalBackupData | null => {
    try {
      const key = `${LOCALSTORAGE_KEY_PREFIX}${templateId || "default"}`;
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      return JSON.parse(stored) as LocalBackupData;
    } catch (err) {
      console.error("[AutoBackup] Failed to read from localStorage:", err);
      return null;
    }
  }, [templateId]);

  // ============================================
  // LOGGING (SUPABASE)
  // ============================================
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
    } catch {
      // Silently fail - logging is not critical
    }
  }, []);

  // ============================================
  // SAUVEGARDE PRINCIPALE
  // ============================================
  const saveBackup = useCallback(
    async (force = false): Promise<boolean> => {
      if (!enabled || isRestoringRef.current || isSavingRef.current) return false;

      isSavingRef.current = true;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          console.log("[AutoBackup] No user logged in, skipping backup");
          isSavingRef.current = false;
          return false;
        }

        const geometryCount = sketch.geometries.size;
        const pointCount = sketch.points.size;
        const imageCount = backgroundImages.length;
        const calibrationPointCount = backgroundImages.reduce((acc, img) => {
          return acc + (img.calibrationData?.points?.size || 0);
        }, 0);

        // v1.5: Debug amélioré
        console.log(`[AutoBackup] Content check: ${geometryCount} geometries, ${imageCount} images, ${calibrationPointCount} calib points`);

        // v1.5: Condition assouplie - sauvegarder si images OU géométries OU points de calibration
        const hasSignificantContent = geometryCount >= minGeometryCount || imageCount > 0 || calibrationPointCount > 0;

        if (!force && !hasSignificantContent) {
          console.log(`[AutoBackup] Skipping - no significant content`);
          isSavingRef.current = false;
          return false;
        }

        // Vérifier si quelque chose a changé
        const currentHash = computeHash(sketch, backgroundImages);
        if (!force && currentHash === lastSavedHashRef.current) {
          console.log("[AutoBackup] No changes detected, skipping");
          isSavingRef.current = false;
          return false;
        }

        const serializedSketch = serializeSketchForBackup(sketch);
        
        // v1.5: Sauvegarder d'abord en localStorage (rapide, synchrone)
        const serializedImagesSync = serializeBackgroundImagesSync(backgroundImages);
        const localSaveSuccess = saveToLocalStorage(serializedSketch, serializedImagesSync, geometryCount, imageCount);
        
        if (localSaveSuccess) {
          setState((prev) => ({
            ...prev,
            lastLocalBackupTime: Date.now(),
          }));
        }

        // v1.5: Compresser les images pour Supabase
        const serializedImages = await serializeBackgroundImagesWithCompression(backgroundImages);

        // Tenter la sauvegarde Supabase
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
          console.error("[AutoBackup] Supabase save failed:", error);
          
          // v1.5: Incrémenter le compteur d'échecs
          setState((prev) => {
            const newFailures = prev.consecutiveFailures + 1;
            const isDown = newFailures >= MAX_CONSECUTIVE_FAILURES;
            
            if (isDown && !prev.isSupabaseDown) {
              // Premier passage en mode "down"
              toast.error("⚠️ Sauvegarde cloud indisponible", {
                description: "Vos données sont sauvegardées localement. Elles seront synchronisées quand la connexion sera rétablie.",
                duration: 10000,
              });
            }
            
            return {
              ...prev,
              hasError: true,
              consecutiveFailures: newFailures,
              lastError: error.message || "Unknown error",
              isSupabaseDown: isDown,
            };
          });

          // Même si Supabase échoue, localStorage a réussi
          if (localSaveSuccess) {
            console.log("[AutoBackup] Fallback: localStorage backup successful");
            lastSavedHashRef.current = currentHash;
            isSavingRef.current = false;
            return true; // Considérer comme succès (données sauvegardées localement)
          }

          isSavingRef.current = false;
          return false;
        }

        // Succès Supabase!
        lastSavedHashRef.current = currentHash;
        previousGeometryCountRef.current = geometryCount;

        setState((prev) => ({
          ...prev,
          lastBackupTime: Date.now(),
          backupCount: prev.backupCount + 1,
          hasError: false,
          consecutiveFailures: 0,
          lastError: null,
          isSupabaseDown: false,
        }));

        console.log(
          `[AutoBackup] ✓ Saved: ${geometryCount} geometries, ${pointCount} points, ${imageCount} images, ${calibrationPointCount} calib points`,
        );

        await logEvent("backup_created", {
          geometryCount,
          pointCount,
          imageCount,
          calibrationPointCount,
          hash: currentHash,
        });

        isSavingRef.current = false;
        return true;
      } catch (error) {
        console.error("[AutoBackup] Error saving backup:", error);
        
        setState((prev) => ({
          ...prev,
          hasError: true,
          consecutiveFailures: prev.consecutiveFailures + 1,
          lastError: error instanceof Error ? error.message : "Unknown error",
        }));
        
        isSavingRef.current = false;
        return false;
      }
    },
    [enabled, sketch, backgroundImages, markerLinks, templateId, minGeometryCount, computeHash, logEvent, saveToLocalStorage],
  );

  // ============================================
  // RÉCUPÉRATION DU DERNIER BACKUP
  // ============================================
  const getLatestBackup = useCallback(async (): Promise<CADAutoBackupRow | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      // 1. Essayer d'abord par templateId
      if (templateId) {
        const { data: byTemplate, error: templateError } = await supabaseAny
          .from("cad_autobackups")
          .select("*")
          .eq("user_id", user.id)
          .eq("template_id", templateId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!templateError && byTemplate) {
          console.log("[AutoBackup] Found backup by templateId:", templateId);
          return byTemplate as CADAutoBackupRow;
        }
      }

      // 2. Sinon essayer par session_id
      const { data: bySession, error: sessionError } = await supabaseAny
        .from("cad_autobackups")
        .select("*")
        .eq("user_id", user.id)
        .eq("session_id", sessionId.current)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sessionError && bySession) {
        console.log("[AutoBackup] Found backup by session_id");
        return bySession as CADAutoBackupRow;
      }

      // 3. En dernier recours, prendre le plus récent
      const { data: latest, error: latestError } = await supabaseAny
        .from("cad_autobackups")
        .select("*")
        .eq("user_id", user.id)
        .not("template_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestError && latest) {
        console.log("[AutoBackup] Found most recent backup");
        return latest as CADAutoBackupRow;
      }

      console.log("[AutoBackup] No Supabase backup found");
      return null;
    } catch (error) {
      console.error("[AutoBackup] Error fetching backup:", error);
      return null;
    }
  }, [templateId]);

  // ============================================
  // RESTAURATION
  // ============================================
  const restoreFromBackup = useCallback(
    async (showToast = true): Promise<boolean> => {
      if (isRestoringRef.current) return false;

      isRestoringRef.current = true;
      setState((prev) => ({ ...prev, isRestoring: true }));

      try {
        // Essayer d'abord Supabase
        let backup = await getLatestBackup();
        let source: "supabase" | "localStorage" = "supabase";

        // v1.5: Si pas de backup Supabase, essayer localStorage
        if (!backup || !backup.sketch_data) {
          console.log("[AutoBackup] No Supabase backup, checking localStorage...");
          const localBackup = getFromLocalStorage();
          
          if (localBackup && localBackup.sketch_data) {
            // Convertir le backup local en format CADAutoBackupRow
            backup = {
              id: "local",
              user_id: "local",
              session_id: sessionId.current,
              template_id: localBackup.template_id,
              sketch_data: localBackup.sketch_data as unknown as Record<string, unknown>,
              background_images: localBackup.background_images,
              marker_links: localBackup.marker_links,
              geometry_count: localBackup.geometry_count,
              point_count: 0,
              created_at: new Date(localBackup.timestamp).toISOString(),
            };
            source = "localStorage";
            console.log("[AutoBackup] Found localStorage backup");
          }
        }

        if (!backup || !backup.sketch_data) {
          console.log("[AutoBackup] No valid backup to restore");
          if (showToast) toast.error("Aucune sauvegarde disponible");
          isRestoringRef.current = false;
          setState((prev) => ({ ...prev, isRestoring: false }));
          return false;
        }

        const backupGeoCount = backup.geometry_count || 0;
        const originalImageCount = backup.background_images?.length || 0;
        const deserializeResult =
          backup.background_images && Array.isArray(backup.background_images)
            ? await deserializeBackgroundImages(backup.background_images)
            : { images: [], failedCount: 0, failedNames: [] };

        const restoredImages = deserializeResult.images;
        const restoredImageCount = restoredImages.filter((img) => img.image).length;

        // Vérifier que le backup a du contenu
        if (backupGeoCount === 0 && originalImageCount === 0) {
          console.log("[AutoBackup] Backup is empty, ignoring");
          if (showToast) toast.info("Sauvegarde vide");
          isRestoringRef.current = false;
          setState((prev) => ({ ...prev, isRestoring: false }));
          return false;
        }

        // Restaurer le sketch
        loadSketchData(backup.sketch_data);

        // Restaurer les images
        if (restoredImages.length > 0) {
          setBackgroundImages(restoredImages);
        }

        // Restaurer les marker links
        if (backup.marker_links && Array.isArray(backup.marker_links)) {
          setMarkerLinks(backup.marker_links as ImageMarkerLink[]);
        }

        // Mettre à jour le hash
        const restoredSketch = backup.sketch_data as unknown as SerializedSketch;
        const newHash = `${restoredSketch.geometries ? Object.keys(restoredSketch.geometries).length : 0}:restored`;
        lastSavedHashRef.current = newHash;

        console.log(`[AutoBackup] Restored from ${source}: ${backupGeoCount} geometries, ${restoredImageCount}/${originalImageCount} images`);

        if (showToast) {
          const sourceText = source === "localStorage" ? " (local)" : "";
          if (deserializeResult.failedCount > 0) {
            toast.warning(`Restauration partielle${sourceText}`, {
              description: `${backupGeoCount} éléments, ${restoredImageCount}/${originalImageCount} images. ${deserializeResult.failedCount} image(s) non chargée(s).`,
              duration: 8000,
            });
          } else {
            toast.success(`Sauvegarde restaurée${sourceText}`, {
              description: `${backupGeoCount} éléments, ${restoredImageCount} images`,
            });
          }
        }

        await logEvent("backup_restored", {
          geometryCount: backupGeoCount,
          imageCount: restoredImageCount,
          originalImageCount,
          failedImages: deserializeResult.failedCount,
          source,
        });

        isRestoringRef.current = false;
        setState((prev) => ({ ...prev, isRestoring: false, hasRestoredThisSession: true }));
        return true;
      } catch (error) {
        console.error("[AutoBackup] Error restoring backup:", error);
        if (showToast) toast.error("Erreur de restauration");
        isRestoringRef.current = false;
        setState((prev) => ({ ...prev, isRestoring: false }));
        return false;
      }
    },
    [getLatestBackup, getFromLocalStorage, loadSketchData, setBackgroundImages, setMarkerLinks, logEvent],
  );

  // ============================================
  // EFFETS
  // ============================================

  // Sauvegarde périodique
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const geometryCount = sketch.geometries.size;
      const imageCount = backgroundImages.length;
      const hasContent = geometryCount >= minGeometryCount || imageCount > 0;

      if (hasContent) {
        saveBackup(false);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [enabled, intervalMs, saveBackup, sketch.geometries.size, backgroundImages.length, minGeometryCount]);

  // Sauvegarde rapide (debounce) quand le contenu change
  useEffect(() => {
    if (!enabled || isRestoringRef.current) return;

    const currentHash = computeHash(sketch, backgroundImages);

    if (currentHash === lastSeenHashRef.current) return;
    lastSeenHashRef.current = currentHash;

    const geometryCount = sketch.geometries.size;
    const imageCount = backgroundImages.length;
    const calibrationPointCount = backgroundImages.reduce(
      (acc, img) => acc + (img.calibrationData?.points?.size || 0),
      0,
    );
    const hasSignificantContent = geometryCount >= minGeometryCount || imageCount > 0 || calibrationPointCount > 0;
    if (!hasSignificantContent) return;

    if (pendingSaveTimeoutRef.current) {
      window.clearTimeout(pendingSaveTimeoutRef.current);
    }

    pendingSaveTimeoutRef.current = window.setTimeout(() => {
      saveBackup(false);
    }, 1500);

    return () => {
      if (pendingSaveTimeoutRef.current) {
        window.clearTimeout(pendingSaveTimeoutRef.current);
        pendingSaveTimeoutRef.current = null;
      }
    };
  }, [enabled, computeHash, sketch, backgroundImages, minGeometryCount, saveBackup]);

  // Sauvegarder avant de quitter
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      // Sauvegarde synchrone en localStorage avant de partir
      const geometryCount = sketch.geometries.size;
      const imageCount = backgroundImages.length;
      if (geometryCount > 0 || imageCount > 0) {
        const serializedSketch = serializeSketchForBackup(sketch);
        const serializedImages = serializeBackgroundImagesSync(backgroundImages);
        saveToLocalStorage(serializedSketch, serializedImages, geometryCount, imageCount);
        console.log("[AutoBackup] Page unload - saved to localStorage");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, sketch, backgroundImages, saveToLocalStorage]);

  // Restauration automatique au chargement
  useEffect(() => {
    if (!enabled || state.hasRestoredThisSession) return;

    const restoreKey = `cad_restored_${templateId || "default"}`;
    const lastRestoreAttempt = localStorage.getItem(restoreKey);
    if (lastRestoreAttempt) {
      const lastAttemptTime = parseInt(lastRestoreAttempt, 10);
      const timeSinceLastAttempt = Date.now() - lastAttemptTime;
      if (timeSinceLastAttempt < 5 * 60 * 1000) {
        console.log("[AutoBackup] Already attempted restore recently, skipping");
        setState((prev) => ({ ...prev, hasRestoredThisSession: true }));
        return;
      }
    }

    const checkAndAutoRestoreOnMount = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const currentGeoCount = sketch.geometries.size;
      const currentImageCount = backgroundImages.length;

      if (currentGeoCount > 0 || currentImageCount > 0) {
        console.log("[AutoBackup] Canvas has content, skipping auto-restore");
        setState((prev) => ({ ...prev, hasRestoredThisSession: true }));
        return;
      }

      // Chercher un backup (Supabase ou localStorage)
      let backup = await getLatestBackup();
      let source: "supabase" | "localStorage" = "supabase";

      if (!backup) {
        const localBackup = getFromLocalStorage();
        if (localBackup && localBackup.sketch_data) {
          backup = {
            id: "local",
            user_id: "local",
            session_id: sessionId.current,
            template_id: localBackup.template_id,
            sketch_data: localBackup.sketch_data as unknown as Record<string, unknown>,
            background_images: localBackup.background_images,
            marker_links: localBackup.marker_links,
            geometry_count: localBackup.geometry_count,
            point_count: 0,
            created_at: new Date(localBackup.timestamp).toISOString(),
          };
          source = "localStorage";
        }
      }

      if (backup) {
        const backupGeoCount = backup.geometry_count || 0;
        const backupImages = backup.background_images as unknown[] | null;
        const backupImageCount = backupImages?.length || 0;

        if (backupGeoCount === 0 && backupImageCount === 0) {
          console.log("[AutoBackup] Backup is empty, ignoring");
          setState((prev) => ({ ...prev, hasRestoredThisSession: true }));
          return;
        }

        const backupAge = Date.now() - new Date(backup.created_at).getTime();
        const ageMinutes = Math.round(backupAge / 60000);
        const ageHours = ageMinutes / 60;

        // Ignorer les backups trop vieux (sauf localStorage qui peut être plus récent)
        if (ageHours > 24 && source !== "localStorage") {
          console.log(`[AutoBackup] Backup too old (${ageHours.toFixed(1)}h), skipping auto-restore`);
          toast.info("Sauvegarde automatique ignorée", {
            description: `La sauvegarde date de ${Math.round(ageHours)}h. Utilisez le menu pour restaurer manuellement.`,
            duration: 8000,
          });
          localStorage.setItem(restoreKey, Date.now().toString());
          setState((prev) => ({ ...prev, hasRestoredThisSession: true }));
          return;
        }

        console.log(
          `[AutoBackup] Found ${source} backup: ${backupGeoCount} geometries, ${backupImageCount} images, age: ${ageMinutes}min`,
        );
        console.log("[AutoBackup] Auto-restoring because canvas is empty...");

        localStorage.setItem(restoreKey, Date.now().toString());

        const success = await restoreFromBackup(false);

        if (success) {
          const ageText = ageMinutes > 60 ? `${Math.round(ageMinutes / 60)}h` : `${ageMinutes}min`;
          const sourceText = source === "localStorage" ? " (local)" : "";

          toast.success(`Canvas restauré automatiquement${sourceText}`, {
            description: `${backupGeoCount} éléments, ${backupImageCount} images (sauvegarde de ${ageText})`,
            duration: 5000,
          });
        } else {
          toast.error("Restauration échouée", {
            description: "Les images n'ont pas pu être chargées. Le backup sera ignoré.",
            duration: 8000,
          });
        }
      }

      setState((prev) => ({ ...prev, hasRestoredThisSession: true }));
    };

    checkAndAutoRestoreOnMount();
  }, [enabled]); // Dépendances minimales

  // ============================================
  // FONCTIONS UTILITAIRES
  // ============================================

  const deleteOldBackups = useCallback(async (maxAgeHours = 24): Promise<number> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return 0;

      const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabaseAny
        .from("cad_autobackups")
        .delete()
        .eq("user_id", user.id)
        .lt("created_at", cutoffDate)
        .select("id");

      if (error) {
        console.error("[AutoBackup] Failed to delete old backups:", error);
        return 0;
      }

      const count = data?.length || 0;
      if (count > 0) {
        console.log(`[AutoBackup] Deleted ${count} old backup(s)`);
        toast.success(`${count} ancienne(s) sauvegarde(s) supprimée(s)`);
      }
      return count;
    } catch (error) {
      console.error("[AutoBackup] Error deleting old backups:", error);
      return 0;
    }
  }, []);

  const resetRestoreFlag = useCallback(() => {
    const restoreKey = `cad_restored_${templateId || "default"}`;
    localStorage.removeItem(restoreKey);
    setState((prev) => ({ ...prev, hasRestoredThisSession: false }));
    console.log("[AutoBackup] Restore flag reset");
  }, [templateId]);

  // v1.5: Forcer la synchronisation localStorage -> Supabase
  const syncLocalToSupabase = useCallback(async (): Promise<boolean> => {
    const localBackup = getFromLocalStorage();
    if (!localBackup) {
      toast.info("Aucune sauvegarde locale à synchroniser");
      return false;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Non connecté");
        return false;
      }

      const { error } = await supabaseAny.from("cad_autobackups").insert({
        user_id: user.id,
        session_id: sessionId.current,
        template_id: localBackup.template_id,
        sketch_data: localBackup.sketch_data,
        background_images: localBackup.background_images,
        marker_links: localBackup.marker_links,
        geometry_count: localBackup.geometry_count,
        point_count: 0,
      });

      if (error) {
        console.error("[AutoBackup] Sync failed:", error);
        toast.error("Synchronisation échouée");
        return false;
      }

      toast.success("Sauvegarde locale synchronisée vers le cloud");
      setState((prev) => ({
        ...prev,
        hasError: false,
        consecutiveFailures: 0,
        lastError: null,
        isSupabaseDown: false,
      }));
      return true;
    } catch (error) {
      console.error("[AutoBackup] Sync error:", error);
      toast.error("Erreur de synchronisation");
      return false;
    }
  }, [getFromLocalStorage]);

  // v1.5: Effacer le backup localStorage
  const clearLocalBackup = useCallback(() => {
    const key = `${LOCALSTORAGE_KEY_PREFIX}${templateId || "default"}`;
    localStorage.removeItem(key);
    setState((prev) => ({ ...prev, lastLocalBackupTime: null }));
    console.log("[AutoBackup] Local backup cleared");
  }, [templateId]);

  // ============================================
  // RETURN
  // ============================================
  return {
    // État
    lastBackupTime: state.lastBackupTime,
    backupCount: state.backupCount,
    isRestoring: state.isRestoring,
    sessionId: sessionId.current,
    // v1.5: Nouveaux états
    hasError: state.hasError,
    consecutiveFailures: state.consecutiveFailures,
    lastError: state.lastError,
    isSupabaseDown: state.isSupabaseDown,
    lastLocalBackupTime: state.lastLocalBackupTime,

    // Actions
    saveBackup,
    restoreFromBackup,
    getLatestBackup,
    deleteOldBackups,
    resetRestoreFlag,
    // v1.5: Nouvelles actions
    syncLocalToSupabase,
    clearLocalBackup,

    // Pour affichage dans l'UI
    formattedLastBackup: state.lastBackupTime ? new Date(state.lastBackupTime).toLocaleTimeString("fr-FR") : null,
    formattedLastLocalBackup: state.lastLocalBackupTime
      ? new Date(state.lastLocalBackupTime).toLocaleTimeString("fr-FR")
      : null,
  };
}

export default useCADAutoBackup;
