// ============================================
// HOOK: useDuplicateDetection
// Détection des photos en doublon par hash
// VERSION: 1.0.0
// ============================================
//
// Changelog (3 dernières versions) :
// - v1.0.0 (2025-01-23) : Création initiale
//
// Historique complet : voir REFACTORING_PHOTO_PREPARATION.md
// ============================================

import { useCallback, useMemo } from "react";
import { PhotoToProcess } from "./types";

export interface DuplicateGroup {
  hash: string;
  photos: PhotoToProcess[];
  originalId: string; // ID de la première photo (l'originale)
  duplicateIds: string[]; // IDs des doublons
}

export interface UseDuplicateDetectionReturn {
  // Groupes de doublons détectés
  duplicateGroups: DuplicateGroup[];
  
  // Nombre total de doublons
  duplicateCount: number;
  
  // Vérifier si une photo est un doublon
  isDuplicate: (photoId: string) => boolean;
  
  // Obtenir l'original d'un doublon
  getOriginalOf: (photoId: string) => PhotoToProcess | null;
  
  // Obtenir tous les IDs de doublons
  getAllDuplicateIds: () => string[];
}

export function useDuplicateDetection(
  photos: PhotoToProcess[]
): UseDuplicateDetectionReturn {
  
  // Regrouper les photos par hash
  const duplicateGroups = useMemo((): DuplicateGroup[] => {
    const hashMap = new Map<string, PhotoToProcess[]>();
    
    // Grouper par hash (ignorer les photos sans hash)
    for (const photo of photos) {
      if (!photo.hash || photo.hash === "") continue;
      
      const existing = hashMap.get(photo.hash) || [];
      existing.push(photo);
      hashMap.set(photo.hash, existing);
    }
    
    // Ne garder que les groupes avec plus d'une photo (doublons)
    const groups: DuplicateGroup[] = [];
    
    hashMap.forEach((groupPhotos, hash) => {
      if (groupPhotos.length > 1) {
        // Trier par ordre d'ajout (le premier est l'original)
        const sorted = [...groupPhotos].sort((a, b) => {
          // Comparer par ID (contient le timestamp)
          const timeA = parseInt(a.id.split("-")[0]) || 0;
          const timeB = parseInt(b.id.split("-")[0]) || 0;
          return timeA - timeB;
        });
        
        groups.push({
          hash,
          photos: sorted,
          originalId: sorted[0].id,
          duplicateIds: sorted.slice(1).map((p) => p.id),
        });
      }
    });
    
    return groups;
  }, [photos]);

  // Nombre total de doublons
  const duplicateCount = useMemo(() => {
    return duplicateGroups.reduce(
      (total, group) => total + group.duplicateIds.length,
      0
    );
  }, [duplicateGroups]);

  // Vérifier si une photo est un doublon
  const isDuplicate = useCallback(
    (photoId: string): boolean => {
      return duplicateGroups.some((group) =>
        group.duplicateIds.includes(photoId)
      );
    },
    [duplicateGroups]
  );

  // Obtenir l'original d'un doublon
  const getOriginalOf = useCallback(
    (photoId: string): PhotoToProcess | null => {
      for (const group of duplicateGroups) {
        if (group.duplicateIds.includes(photoId)) {
          return group.photos.find((p) => p.id === group.originalId) || null;
        }
      }
      return null;
    },
    [duplicateGroups]
  );

  // Obtenir tous les IDs de doublons
  const getAllDuplicateIds = useCallback((): string[] => {
    return duplicateGroups.flatMap((group) => group.duplicateIds);
  }, [duplicateGroups]);

  return {
    duplicateGroups,
    duplicateCount,
    isDuplicate,
    getOriginalOf,
    getAllDuplicateIds,
  };
}

export default useDuplicateDetection;
