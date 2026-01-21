// ============================================
// COMPONENT: ArucoStitcher
// Assemblage de photos via markers ArUco partagés
// VERSION: 3.4
// ============================================
//
// CHANGELOG v3.4 (21/01/2026):
// - FIX CRITIQUE: Utilise pxPerMmX et pxPerMmY séparément
// - Conversion pixels→mm avec échelles X et Y distinctes
// - Corrige le décalage de 50-60mm lors de l'assemblage
//
// CHANGELOG v3.3 (21/01/2026):
// - FIX: Rotation auto OFF = toutes les photos à rotation 0
// - Pas de cumul de rotation quand désactivé
//
// CHANGELOG v3.2 (20/01/2026):
// - Toggle "Rotation auto" (désactivé par défaut)
// - Choix de la photo de référence (⭐)
//
// CHANGELOG v3.1 (20/01/2026):
// - scaleX et scaleY séparés pour corriger distorsions
// ============================================

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Images,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  Bug,
  RotateCw,
  RefreshCw,
  Star,
  Move,
} from "lucide-react";
import { toast } from "sonner";
import { useOpenCVAruco, ArucoMarker } from "./useOpenCVAruco";

// v2.1: Interface avec rotation
export interface StitchedImage {
  image: HTMLImageElement;
  imageUrl: string;
  position: { x: number; y: number }; // Position en mm (coin supérieur gauche après rotation)
  scale: number; // Facteur d'échelle uniforme (rétrocompatibilité)
  scaleX?: number; // v3.1: Facteur d'échelle horizontal
  scaleY?: number; // v3.1: Facteur d'échelle vertical
  rotation: number; // v2.1: Rotation en degrés (sens horaire)
  originalFile: File;
  markers: ArucoMarker[];
}

interface ArucoStitcherProps {
  isOpen: boolean;
  onClose: () => void;
  onStitched: (images: StitchedImage[], pixelsPerCm: number) => void;
  markerSizeMm: number;
}

interface PhotoWithMarkers {
  id: string;
  file: File;
  image: HTMLImageElement;
  imageUrl: string;
  markers: ArucoMarker[];
  isProcessing: boolean;
  error?: string;
  pixelsPerMm: number; // Moyenne (rétrocompatibilité)
  pixelsPerMmX: number; // v3.4: Échelle horizontale
  pixelsPerMmY: number; // v3.4: Échelle verticale
}

interface MarkerMatch {
  markerId: number;
  photo1Index: number;
  photo2Index: number;
  pos1: { x: number; y: number };
  pos2: { x: number; y: number };
}

interface PositionResult {
  images: StitchedImage[];
  pixelsPerCm: number;
  totalWidthMm: number;
  totalHeightMm: number;
}

export function ArucoStitcher({ isOpen, onClose, onStitched, markerSizeMm = 100 }: ArucoStitcherProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<PhotoWithMarkers[]>([]);
  const [isStitching, setIsStitching] = useState(false);
  const [positionResult, setPositionResult] = useState<PositionResult | null>(null);
  const [markerSize, setMarkerSize] = useState<string>(markerSizeMm.toString());
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  
  // v3.0: Tolérance paramétrable et détection doublons
  const [tolerance, setTolerance] = useState<number>(0); // v3.0: défaut 0 (strict)
  const [isRedetecting, setIsRedetecting] = useState(false);
  const [duplicatePhotoIds, setDuplicatePhotoIds] = useState<Set<string>>(new Set());
  
  // v3.2: Nouvelles options
  const [autoRotation, setAutoRotation] = useState<boolean>(false); // Rotation auto désactivée par défaut
  const [referencePhotoId, setReferencePhotoId] = useState<string | null>(null); // Photo de référence (null = première)
  const [perspectiveCorrection, setPerspectiveCorrection] = useState<boolean>(true); // Correction perspective activée

  const { isLoaded, isLoading, error: opencvError, detectMarkers } = useOpenCVAruco();

  const addDebugLog = useCallback((msg: string) => {
    console.log(`[ArucoStitcher v2.1] ${msg}`);
    setDebugLogs(prev => [...prev.slice(-30), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

  useEffect(() => {
    return () => {
      photos.forEach(p => URL.revokeObjectURL(p.imageUrl));
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPositionResult(null);
    }
  }, [isOpen]);

  // v3.4: Calculer les échelles X et Y séparément
  const calculatePhotoScale = (markers: ArucoMarker[], markerSizeMm: number): { 
    pixelsPerMm: number; 
    pixelsPerMmX: number; 
    pixelsPerMmY: number; 
  } => {
    if (markers.length === 0) return { pixelsPerMm: 0, pixelsPerMmX: 0, pixelsPerMmY: 0 };

    let totalPxPerMmX = 0;
    let totalPxPerMmY = 0;
    for (const marker of markers) {
      // v3.4: Utiliser width pour X et height pour Y
      totalPxPerMmX += marker.size.width / markerSizeMm;
      totalPxPerMmY += marker.size.height / markerSizeMm;
    }
    const pixelsPerMmX = totalPxPerMmX / markers.length;
    const pixelsPerMmY = totalPxPerMmY / markers.length;
    const pixelsPerMm = (pixelsPerMmX + pixelsPerMmY) / 2; // Moyenne pour rétrocompatibilité
    
    return { pixelsPerMm, pixelsPerMmX, pixelsPerMmY };
  };

  // v2.2: Détecter les doublons (100% markers identiques + positions similaires)
  const detectDuplicates = useCallback((photosList: PhotoWithMarkers[]) => {
    const duplicates = new Set<string>();
    const POSITION_TOLERANCE = 15; // pixels d'écart max pour considérer comme doublon

    for (let i = 0; i < photosList.length; i++) {
      for (let j = i + 1; j < photosList.length; j++) {
        const photo1 = photosList[i];
        const photo2 = photosList[j];

        // Ignorer si pas de markers
        if (photo1.markers.length === 0 || photo2.markers.length === 0) continue;

        // Vérifier si tous les markers de photo1 sont dans photo2
        const ids1 = new Set(photo1.markers.map(m => m.id));
        const ids2 = new Set(photo2.markers.map(m => m.id));

        // Doivent avoir exactement les mêmes IDs
        if (ids1.size !== ids2.size) continue;
        
        let allMatch = true;
        for (const id of ids1) {
          if (!ids2.has(id)) {
            allMatch = false;
            break;
          }
        }
        if (!allMatch) continue;

        // Vérifier les positions relatives
        let positionsMatch = true;
        for (const m1 of photo1.markers) {
          const m2 = photo2.markers.find(m => m.id === m1.id);
          if (!m2) {
            positionsMatch = false;
            break;
          }
          
          // Comparer les positions relatives (normalisées par le premier marker)
          const ref1 = photo1.markers[0];
          const ref2 = photo2.markers[0];
          
          const relX1 = m1.center.x - ref1.center.x;
          const relY1 = m1.center.y - ref1.center.y;
          const relX2 = m2.center.x - ref2.center.x;
          const relY2 = m2.center.y - ref2.center.y;
          
          const dx = Math.abs(relX1 - relX2);
          const dy = Math.abs(relY1 - relY2);
          
          if (dx > POSITION_TOLERANCE || dy > POSITION_TOLERANCE) {
            positionsMatch = false;
            break;
          }
        }

        if (positionsMatch) {
          // Marquer la seconde photo comme doublon
          duplicates.add(photo2.id);
          addDebugLog(`⚠️ Doublon détecté: Photo ${j + 1} ≈ Photo ${i + 1}`);
        }
      }
    }

    setDuplicatePhotoIds(duplicates);
    return duplicates;
  }, [addDebugLog]);

  // v2.2: Relancer la détection sur toutes les photos
  const redetectAllPhotos = useCallback(async () => {
    if (!isLoaded || photos.length === 0) return;

    setIsRedetecting(true);
    setPositionResult(null);
    addDebugLog(`🔄 Relancer détection (tolérance=${tolerance})...`);

    const markerSizeNum = parseFloat(markerSize) || 100;

    for (const photo of photos) {
      try {
        addDebugLog(`Détection sur ${photo.file.name}...`);
        const startTime = performance.now();
        const markers = await detectMarkers(photo.image, { tolerance });
        const elapsed = performance.now() - startTime;
        const scales = calculatePhotoScale(markers, markerSizeNum);

        addDebugLog(`${photo.file.name}: ${markers.length} markers en ${elapsed.toFixed(0)}ms`);
        if (markers.length > 0) {
          addDebugLog(`  IDs: ${markers.map(m => `#${m.id}`).join(', ')}`);
          // v3.4: Log si distorsion détectée
          const distortion = Math.abs(scales.pixelsPerMmX - scales.pixelsPerMmY) / scales.pixelsPerMm * 100;
          if (distortion > 1) {
            addDebugLog(`  ⚠️ Distorsion ${distortion.toFixed(1)}% (X=${scales.pixelsPerMmX.toFixed(2)}, Y=${scales.pixelsPerMmY.toFixed(2)})`);
          }
        }

        setPhotos(prev => prev.map(p =>
          p.id === photo.id
            ? { ...p, markers, isProcessing: false, ...scales, error: undefined }
            : p
        ));
      } catch (err) {
        addDebugLog(`ERREUR sur ${photo.file.name}: ${err}`);
        setPhotos(prev => prev.map(p =>
          p.id === photo.id
            ? { ...p, isProcessing: false, error: "Erreur détection" }
            : p
        ));
      }
    }

    // Détecter les doublons après re-détection
    setTimeout(() => {
      setPhotos(current => {
        detectDuplicates(current);
        return current;
      });
    }, 100);

    setIsRedetecting(false);
    toast.success(`Détection relancée (tolérance=${tolerance})`);
  }, [isLoaded, photos, tolerance, markerSize, detectMarkers, addDebugLog, calculatePhotoScale, detectDuplicates]);

  // v3.4: Calculer l'angle de rotation entre deux photos avec échelles X/Y séparées
  // - Seuil minimum: si < 2°, considéré comme 0 (pas de rotation)
  // - Cohérence: si écart-type > 5°, rotation ignorée (données incohérentes)
  // - Limite max: ±15°
  const calculateRotation = (
    photo1Markers: ArucoMarker[],
    photo2Markers: ArucoMarker[],
    photo1PxPerMmX: number,
    photo1PxPerMmY: number,
    photo2PxPerMmX: number,
    photo2PxPerMmY: number
  ): number => {
    const MAX_ROTATION = 15; // Limite max
    const MIN_ROTATION = 2; // Seuil minimum (en dessous = 0)
    const MAX_STD_DEV = 5; // Écart-type max autorisé

    // Trouver les markers communs
    const commonMarkers: { id: number; p1: { x: number; y: number }; p2: { x: number; y: number } }[] = [];
    
    for (const m1 of photo1Markers) {
      const m2 = photo2Markers.find(m => m.id === m1.id);
      if (m2) {
        // v3.4: Utiliser échelles X et Y séparées
        commonMarkers.push({
          id: m1.id,
          p1: { x: m1.center.x / photo1PxPerMmX, y: m1.center.y / photo1PxPerMmY },
          p2: { x: m2.center.x / photo2PxPerMmX, y: m2.center.y / photo2PxPerMmY },
        });
      }
    }

    if (commonMarkers.length < 2) {
      // Pas assez de markers pour calculer une rotation fiable
      return 0;
    }

    // Calculer l'angle entre chaque paire de markers
    const angles: number[] = [];

    for (let i = 0; i < commonMarkers.length; i++) {
      for (let j = i + 1; j < commonMarkers.length; j++) {
        const m1 = commonMarkers[i];
        const m2 = commonMarkers[j];

        // Vecteur dans photo1
        const v1 = {
          x: m2.p1.x - m1.p1.x,
          y: m2.p1.y - m1.p1.y,
        };

        // Vecteur dans photo2
        const v2 = {
          x: m2.p2.x - m1.p2.x,
          y: m2.p2.y - m1.p2.y,
        };

        // Angle de chaque vecteur
        const angle1 = Math.atan2(v1.y, v1.x);
        const angle2 = Math.atan2(v2.y, v2.x);

        // Différence d'angle (photo2 par rapport à photo1)
        let angleDiff = (angle2 - angle1) * 180 / Math.PI;
        
        // Normaliser entre -180 et 180
        while (angleDiff > 180) angleDiff -= 360;
        while (angleDiff < -180) angleDiff += 360;

        angles.push(angleDiff);
      }
    }

    if (angles.length === 0) return 0;

    // Moyenne circulaire
    let sumSin = 0;
    let sumCos = 0;
    for (const angle of angles) {
      const rad = angle * Math.PI / 180;
      sumSin += Math.sin(rad);
      sumCos += Math.cos(rad);
    }
    let avgAngle = Math.atan2(sumSin, sumCos) * 180 / Math.PI;

    // v3.1: Calculer l'écart-type pour vérifier la cohérence
    if (angles.length > 1) {
      const variance = angles.reduce((sum, a) => {
        let diff = a - avgAngle;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        return sum + diff * diff;
      }, 0) / angles.length;
      const stdDev = Math.sqrt(variance);
      
      if (stdDev > MAX_STD_DEV) {
        addDebugLog(`⚠️ Rotation ignorée: écart-type ${stdDev.toFixed(1)}° > ${MAX_STD_DEV}° (données incohérentes)`);
        return 0;
      }
    }

    // v3.1: Seuil minimum - si très petit, considérer comme 0
    if (Math.abs(avgAngle) < MIN_ROTATION) {
      return 0;
    }

    // v3.0: Limiter à ±MAX_ROTATION
    if (avgAngle > MAX_ROTATION) {
      addDebugLog(`⚠️ Rotation ${avgAngle.toFixed(1)}° limitée à ${MAX_ROTATION}°`);
      avgAngle = MAX_ROTATION;
    } else if (avgAngle < -MAX_ROTATION) {
      addDebugLog(`⚠️ Rotation ${avgAngle.toFixed(1)}° limitée à -${MAX_ROTATION}°`);
      avgAngle = -MAX_ROTATION;
    }

    return avgAngle;
  };

  // v2.1: Calculer la position après rotation
  const rotatePoint = (
    x: number,
    y: number,
    cx: number,
    cy: number,
    angleDeg: number
  ): { x: number; y: number } => {
    const angleRad = angleDeg * Math.PI / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    
    const dx = x - cx;
    const dy = y - cy;
    
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  };

  const handleAddPhotos = useCallback(async (files: FileList | null) => {
    if (!files || !isLoaded) {
      addDebugLog(`Ajout impossible: files=${!!files}, isLoaded=${isLoaded}`);
      return;
    }

    addDebugLog(`Ajout de ${files.length} fichier(s)...`);
    const markerSizeNum = parseFloat(markerSize) || 100;
    const newPhotos: PhotoWithMarkers[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        addDebugLog(`Fichier ignoré (pas une image): ${file.name}`);
        continue;
      }

      const imageUrl = URL.createObjectURL(file);
      const image = new Image();

      await new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
        image.src = imageUrl;
      });

      if (image.width === 0) {
        addDebugLog(`Image non chargée: ${file.name}`);
        continue;
      }

      addDebugLog(`Image chargée: ${file.name} (${image.width}x${image.height})`);

      newPhotos.push({
        id: `photo-${Date.now()}-${i}`,
        file,
        image,
        imageUrl,
        markers: [],
        isProcessing: true,
        pixelsPerMm: 0,
        pixelsPerMmX: 0, // v3.4
        pixelsPerMmY: 0, // v3.4
      });
    }

    setPhotos(prev => [...prev, ...newPhotos]);

    for (const photo of newPhotos) {
      try {
        addDebugLog(`Détection sur ${photo.file.name}...`);
        const startTime = performance.now();
        // v2.2: Utiliser la tolérance configurée
        const markers = await detectMarkers(photo.image, { tolerance });
        const elapsed = performance.now() - startTime;
        const scales = calculatePhotoScale(markers, markerSizeNum);

        addDebugLog(`${photo.file.name}: ${markers.length} markers en ${elapsed.toFixed(0)}ms`);
        if (markers.length > 0) {
          addDebugLog(`  IDs: ${markers.map(m => `#${m.id}`).join(', ')}`);
          // v3.4: Log si distorsion détectée
          const distortion = Math.abs(scales.pixelsPerMmX - scales.pixelsPerMmY) / scales.pixelsPerMm * 100;
          if (distortion > 1) {
            addDebugLog(`  ⚠️ Distorsion ${distortion.toFixed(1)}% (X=${scales.pixelsPerMmX.toFixed(2)}, Y=${scales.pixelsPerMmY.toFixed(2)})`);
          }
        }

        setPhotos(prev => prev.map(p =>
          p.id === photo.id
            ? { ...p, markers, isProcessing: false, ...scales }
            : p
        ));
      } catch (err) {
        addDebugLog(`ERREUR sur ${photo.file.name}: ${err}`);
        setPhotos(prev => prev.map(p =>
          p.id === photo.id
            ? { ...p, isProcessing: false, error: "Erreur détection" }
            : p
        ));
      }
    }

    // v2.2: Détecter les doublons après ajout
    setTimeout(() => {
      setPhotos(current => {
        detectDuplicates(current);
        return current;
      });
    }, 100);
  }, [isLoaded, detectMarkers, markerSize, tolerance, addDebugLog, detectDuplicates]);

  const handleRemovePhoto = useCallback((id: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo) URL.revokeObjectURL(photo.imageUrl);
      return prev.filter(p => p.id !== id);
    });
    setPositionResult(null);
    // v2.2: Recalculer les doublons après suppression
    setTimeout(() => {
      setPhotos(current => {
        detectDuplicates(current);
        return current;
      });
    }, 50);
  }, [detectDuplicates]);

  const findMarkerMatches = useCallback((): MarkerMatch[] => {
    const matches: MarkerMatch[] = [];

    for (let i = 0; i < photos.length; i++) {
      for (let j = i + 1; j < photos.length; j++) {
        const photo1 = photos[i];
        const photo2 = photos[j];

        for (const m1 of photo1.markers) {
          const m2 = photo2.markers.find(m => m.id === m1.id);
          if (m2) {
            matches.push({
              markerId: m1.id,
              photo1Index: i,
              photo2Index: j,
              pos1: m1.center,
              pos2: m2.center,
            });
          }
        }
      }
    }

    return matches;
  }, [photos]);

  // v2.1: Calculer les positions ET rotations
  const handleCalculatePositions = useCallback(async () => {
    if (photos.length < 2) {
      toast.error("Il faut au moins 2 photos");
      return;
    }

    const matches = findMarkerMatches();
    if (matches.length === 0) {
      toast.error("Aucun marker commun trouvé entre les photos");
      return;
    }

    const photosWithMarkers = photos.filter(p => p.markers.length > 0 && p.pixelsPerMm > 0);
    if (photosWithMarkers.length < 2) {
      toast.error("Au moins 2 photos doivent avoir des markers détectés");
      return;
    }

    setIsStitching(true);

    try {
      const markerSizeNum = parseFloat(markerSize) || 100;

      // v3.1: Calculer les échelles X et Y séparément basé sur la taille des markers
      const photoScales = photos.map(p => {
        if (p.markers.length === 0) return { scaleX: 1, scaleY: 1, avgPixelsPerMm: 0 };
        
        let totalPxPerMmX = 0;
        let totalPxPerMmY = 0;
        for (const marker of p.markers) {
          // Taille du marker en pixels
          totalPxPerMmX += marker.size.width / markerSizeNum;
          totalPxPerMmY += marker.size.height / markerSizeNum;
        }
        const avgPxPerMmX = totalPxPerMmX / p.markers.length;
        const avgPxPerMmY = totalPxPerMmY / p.markers.length;
        const avgPixelsPerMm = (avgPxPerMmX + avgPxPerMmY) / 2;
        
        return { 
          pxPerMmX: avgPxPerMmX, 
          pxPerMmY: avgPxPerMmY, 
          avgPixelsPerMm,
          // Ratio d'aspect du marker (1 = carré parfait)
          aspectRatio: avgPxPerMmX / avgPxPerMmY
        };
      });

      // Échelle cible (basée sur la meilleure résolution)
      const targetPixelsPerMm = Math.max(...photoScales.filter(s => s.avgPixelsPerMm > 0).map(s => s.avgPixelsPerMm));
      const targetPixelsPerCm = targetPixelsPerMm * 10;

      addDebugLog(`Échelle cible: ${targetPixelsPerMm.toFixed(2)} px/mm`);

      // v3.1: Facteurs d'échelle X et Y séparés
      const scaleFactorsXY = photos.map((p, i) => {
        const scales = photoScales[i];
        if (scales.avgPixelsPerMm === 0) return { scaleX: 1, scaleY: 1 };
        
        // Calculer le scale pour que les markers aient la même taille
        const scaleX = targetPixelsPerMm / (scales.pxPerMmX || scales.avgPixelsPerMm);
        const scaleY = targetPixelsPerMm / (scales.pxPerMmY || scales.avgPixelsPerMm);
        
        // Log si différence significative entre X et Y
        if (Math.abs(scaleX - scaleY) > 0.02) {
          addDebugLog(`Photo ${i + 1}: scaleX=${scaleX.toFixed(3)}, scaleY=${scaleY.toFixed(3)} (distorsion détectée)`);
        }
        
        return { scaleX, scaleY };
      });

      // v3.1: Structure avec position, rotation, ET scales séparés
      interface PhotoTransform {
        x: number; // mm
        y: number; // mm
        rotation: number; // degrés
        scaleX: number;
        scaleY: number;
      }

      const photoTransforms: PhotoTransform[] = photos.map((_, i) => ({
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: scaleFactorsXY[i].scaleX,
        scaleY: scaleFactorsXY[i].scaleY
      }));

      // v3.2: Déterminer l'index de la photo de référence
      let refIndex = 0;
      if (referencePhotoId) {
        const foundIdx = photos.findIndex(p => p.id === referencePhotoId);
        if (foundIdx !== -1) {
          refIndex = foundIdx;
          addDebugLog(`Photo de référence: #${refIndex + 1} (${photos[refIndex].file.name})`);
        }
      }

      // BFS pour positionner toutes les photos (démarrer de la référence)
      const processed = new Set<number>([refIndex]);
      const queue = [refIndex];

      while (queue.length > 0) {
        const currentIdx = queue.shift()!;
        const currentPhoto = photos[currentIdx];
        const currentTransform = photoTransforms[currentIdx];

        for (let otherIdx = 0; otherIdx < photos.length; otherIdx++) {
          if (processed.has(otherIdx)) continue;

          const otherPhoto = photos[otherIdx];

          // Trouver les markers communs
          const commonMatches = matches.filter(
            m => (m.photo1Index === currentIdx && m.photo2Index === otherIdx) ||
                 (m.photo1Index === otherIdx && m.photo2Index === currentIdx)
          );

          if (commonMatches.length === 0) continue;

          // v3.3: Rotation simplifiée
          // - Si autoRotation OFF → rotation = 0 (photos droites)
          // - Si autoRotation ON → calculer la rotation par rapport à la référence
          let rotation = 0;
          if (autoRotation) {
            // v3.4: Calculer la rotation avec échelles X/Y séparées
            rotation = calculateRotation(
              currentPhoto.markers,
              otherPhoto.markers,
              currentPhoto.pixelsPerMmX,
              currentPhoto.pixelsPerMmY,
              otherPhoto.pixelsPerMmX,
              otherPhoto.pixelsPerMmY
            );
            addDebugLog(`Rotation photo ${otherIdx + 1} vs photo ${currentIdx + 1}: ${rotation.toFixed(1)}°`);
          }

          // v3.3: Rotation finale = rotation courante + rotation calculée
          // Si autoRotation OFF, tout reste à 0
          const finalRotation = autoRotation ? (currentTransform.rotation + rotation) : 0;

          // Calculer le décalage moyen en mm (en tenant compte de la rotation)
          let totalDxMm = 0;
          let totalDyMm = 0;

          for (const match of commonMatches) {
            let pos1InCurrent: { x: number; y: number };
            let pos2InOther: { x: number; y: number };

            if (match.photo1Index === currentIdx) {
              pos1InCurrent = match.pos1;
              pos2InOther = match.pos2;
            } else {
              pos1InCurrent = match.pos2;
              pos2InOther = match.pos1;
            }

            // v3.4: Convertir en mm avec échelles X et Y SÉPARÉES
            const pos1Mm = {
              x: pos1InCurrent.x / currentPhoto.pixelsPerMmX,
              y: pos1InCurrent.y / currentPhoto.pixelsPerMmY
            };
            let pos2Mm = {
              x: pos2InOther.x / otherPhoto.pixelsPerMmX,
              y: pos2InOther.y / otherPhoto.pixelsPerMmY
            };

            // v3.4: Centre de rotation avec échelles X et Y séparées
            const otherCenterMm = {
              x: (otherPhoto.image.width / otherPhoto.pixelsPerMmX) / 2,
              y: (otherPhoto.image.height / otherPhoto.pixelsPerMmY) / 2
            };

            // v3.3: Utiliser rotation locale (pas finalRotation) pour le calcul de position
            const rotatedPos2 = rotatePoint(
              pos2Mm.x,
              pos2Mm.y,
              otherCenterMm.x,
              otherCenterMm.y,
              rotation // rotation locale entre les 2 photos
            );

            // Position globale du marker dans le référentiel current
            const globalPos1 = {
              x: currentTransform.x + pos1Mm.x,
              y: currentTransform.y + pos1Mm.y
            };

            // Position de other pour que le marker rotated coïncide
            totalDxMm += globalPos1.x - rotatedPos2.x;
            totalDyMm += globalPos1.y - rotatedPos2.y;
          }

          const avgDxMm = totalDxMm / commonMatches.length;
          const avgDyMm = totalDyMm / commonMatches.length;

          // v3.3: Stocker avec finalRotation (0 si autoRotation OFF)
          photoTransforms[otherIdx] = {
            x: avgDxMm,
            y: avgDyMm,
            rotation: finalRotation,
            scaleX: scaleFactorsXY[otherIdx].scaleX,
            scaleY: scaleFactorsXY[otherIdx].scaleY
          };

          addDebugLog(`Photo ${otherIdx + 1}: pos=(${avgDxMm.toFixed(0)}, ${avgDyMm.toFixed(0)})mm, rot=${finalRotation.toFixed(1)}°`);

          processed.add(otherIdx);
          queue.push(otherIdx);
        }
      }

      if (processed.size < photos.length) {
        const unconnected = photos.length - processed.size;
        toast.error(`${unconnected} photo(s) non connectée(s) par des markers`);
        setIsStitching(false);
        return;
      }

      // Calculer les bounds en tenant compte des rotations
      let minXmm = Infinity, minYmm = Infinity, maxXmm = -Infinity, maxYmm = -Infinity;

      for (let i = 0; i < photos.length; i++) {
        const transform = photoTransforms[i];
        const photo = photos[i];
        // v3.4: Utiliser échelles X et Y séparées pour les dimensions
        const widthMm = photo.image.width / photo.pixelsPerMmX;
        const heightMm = photo.image.height / photo.pixelsPerMmY;

        // Les 4 coins de l'image
        const corners = [
          { x: 0, y: 0 },
          { x: widthMm, y: 0 },
          { x: widthMm, y: heightMm },
          { x: 0, y: heightMm },
        ];

        // Rotation autour du centre de l'image
        const centerX = widthMm / 2;
        const centerY = heightMm / 2;

        for (const corner of corners) {
          const rotated = rotatePoint(corner.x, corner.y, centerX, centerY, transform.rotation);
          const globalX = transform.x + rotated.x;
          const globalY = transform.y + rotated.y;

          minXmm = Math.min(minXmm, globalX);
          minYmm = Math.min(minYmm, globalY);
          maxXmm = Math.max(maxXmm, globalX);
          maxYmm = Math.max(maxYmm, globalY);
        }
      }

      // Normaliser les positions
      const stitchedImages: StitchedImage[] = photos.map((photo, i) => {
        const transform = photoTransforms[i];
        
        // v3.4: Position du coin (0,0) après rotation - utiliser échelles X/Y séparées
        const widthMm = photo.image.width / photo.pixelsPerMmX;
        const heightMm = photo.image.height / photo.pixelsPerMmY;
        const centerX = widthMm / 2;
        const centerY = heightMm / 2;
        
        // Le coin (0,0) rotated
        const rotatedOrigin = rotatePoint(0, 0, centerX, centerY, transform.rotation);
        
        // v3.1: Scale uniforme moyen pour rétrocompatibilité
        const avgScale = (transform.scaleX + transform.scaleY) / 2;
        
        return {
          image: photo.image,
          imageUrl: photo.imageUrl,
          position: {
            x: transform.x + rotatedOrigin.x - minXmm,
            y: transform.y + rotatedOrigin.y - minYmm
          },
          scale: avgScale, // Rétrocompatibilité
          scaleX: transform.scaleX,
          scaleY: transform.scaleY,
          rotation: transform.rotation,
          originalFile: photo.file,
          markers: photo.markers,
        };
      });

      const totalWidthMm = maxXmm - minXmm;
      const totalHeightMm = maxYmm - minYmm;

      addDebugLog(`Dimensions totales: ${totalWidthMm.toFixed(0)} x ${totalHeightMm.toFixed(0)} mm`);

      setPositionResult({
        images: stitchedImages,
        pixelsPerCm: targetPixelsPerCm,
        totalWidthMm,
        totalHeightMm,
      });

      toast.success(`Positions calculées ! ${totalWidthMm.toFixed(0)}×${totalHeightMm.toFixed(0)}mm`);

    } catch (err) {
      console.error("Erreur calcul positions:", err);
      toast.error("Erreur lors du calcul: " + (err as Error).message);
    } finally {
      setIsStitching(false);
    }
  }, [photos, findMarkerMatches, markerSize, addDebugLog, referencePhotoId, autoRotation]);

  const handleConfirm = useCallback(() => {
    if (!positionResult) return;
    onStitched(positionResult.images, positionResult.pixelsPerCm);
    onClose();
  }, [positionResult, onStitched, onClose]);

  // Preview fusionné avec rotation
  const handleDownloadPreview = useCallback(() => {
    if (!positionResult) return;

    const { images, pixelsPerCm, totalWidthMm, totalHeightMm } = positionResult;
    const targetPixelsPerMm = pixelsPerCm / 10;

    const maxDimension = 4000;
    let outputScale = 1;
    const finalWidthPx = totalWidthMm * targetPixelsPerMm;
    const finalHeightPx = totalHeightMm * targetPixelsPerMm;
    
    if (finalWidthPx > maxDimension || finalHeightPx > maxDimension) {
      outputScale = maxDimension / Math.max(finalWidthPx, finalHeightPx);
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(finalWidthPx * outputScale);
    canvas.height = Math.ceil(finalHeightPx * outputScale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dessiner chaque image avec rotation
    for (const img of images) {
      const widthMm = img.image.width / (targetPixelsPerMm / img.scale);
      const heightMm = img.image.height / (targetPixelsPerMm / img.scale);
      
      const drawWidth = img.image.width * img.scale * outputScale;
      const drawHeight = img.image.height * img.scale * outputScale;

      // Centre de l'image pour la rotation
      const centerXpx = (img.position.x + widthMm / 2) * targetPixelsPerMm * outputScale;
      const centerYpx = (img.position.y + heightMm / 2) * targetPixelsPerMm * outputScale;

      ctx.save();
      ctx.translate(centerXpx, centerYpx);
      ctx.rotate(img.rotation * Math.PI / 180);
      ctx.drawImage(img.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();
    }

    const link = document.createElement("a");
    link.download = `preview_${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [positionResult]);

  const totalMarkers = photos.reduce((sum, p) => sum + p.markers.length, 0);
  const matches = findMarkerMatches();
  const uniqueMatchedIds = new Set(matches.map(m => m.markerId)).size;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            Assemblage par markers ArUco
          </DialogTitle>
          <DialogDescription>
            Photos positionnées et tournées automatiquement (ajustables après import)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-2 rounded">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          )}

          {opencvError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              <AlertCircle className="h-4 w-4" />
              Erreur: {opencvError}
            </div>
          )}

          {isLoaded && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
              <CheckCircle2 className="h-4 w-4" />
              Détecteur ArUco v17 (mode équilibré + rotation)
            </div>
          )}

          <div className="flex items-center gap-4">
            <Label htmlFor="markerSizeInput" className="text-sm whitespace-nowrap">
              Taille markers:
            </Label>
            <Input
              id="markerSizeInput"
              type="number"
              value={markerSize}
              onChange={(e) => setMarkerSize(e.target.value)}
              className="w-24"
              min="10"
              max="500"
            />
            <span className="text-sm text-muted-foreground">mm ({(parseFloat(markerSize) || 100) / 10}cm)</span>
          </div>

          {/* v2.2: Slider tolérance + bouton relancer */}
          <div className="flex items-center gap-4 p-2 bg-muted/50 rounded">
            <div className="flex items-center gap-2 flex-1">
              <Label htmlFor="toleranceSlider" className="text-xs whitespace-nowrap">
                Tolérance:
              </Label>
              <Slider
                id="toleranceSlider"
                value={[tolerance]}
                onValueChange={(v) => setTolerance(v[0])}
                min={0}
                max={2}
                step={1}
                className="w-20"
              />
              <span className="text-xs font-mono w-12">{tolerance} bit{tolerance > 1 ? "s" : ""}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={redetectAllPhotos}
              disabled={!isLoaded || photos.length === 0 || isRedetecting}
              className="h-7 text-xs"
            >
              {isRedetecting ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Relancer
            </Button>
          </div>

          {/* v3.2: Options rotation et perspective */}
          <div className="flex items-center gap-4 p-2 bg-muted/50 rounded text-xs">
            <div className="flex items-center gap-2">
              <Switch
                id="autoRotation"
                checked={autoRotation}
                onCheckedChange={setAutoRotation}
              />
              <Label htmlFor="autoRotation" className="cursor-pointer">
                <RotateCw className="h-3 w-3 inline mr-1" />
                Rotation auto
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="perspectiveCorrection"
                checked={perspectiveCorrection}
                onCheckedChange={setPerspectiveCorrection}
              />
              <Label htmlFor="perspectiveCorrection" className="cursor-pointer">
                <Move className="h-3 w-3 inline mr-1" />
                Corr. perspective
              </Label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isLoaded}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter des photos
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDebug(!showDebug)}
              title="Debug"
            >
              <Bug className={`h-4 w-4 ${showDebug ? "text-yellow-500" : ""}`} />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleAddPhotos(e.target.files)}
            />
          </div>

          {showDebug && (
            <div className="p-3 bg-gray-900 text-green-400 font-mono text-xs rounded-lg max-h-48 overflow-y-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="text-yellow-400">🐛 Debug Logs</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-xs text-gray-400 hover:text-white"
                  onClick={() => setDebugLogs([])}
                >
                  Clear
                </Button>
              </div>
              {debugLogs.length === 0 ? (
                <div className="text-gray-500">Aucun log.</div>
              ) : (
                debugLogs.map((log, i) => (
                  <div key={i} className="border-b border-gray-700 py-1">{log}</div>
                ))
              )}
            </div>
          )}

          {photos.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium flex justify-between">
                <span>Photos ({photos.length}) - {totalMarkers} markers</span>
                <span className="text-muted-foreground">{uniqueMatchedIds} communs</span>
              </div>
              {/* v2.2: Alerte doublons */}
              {duplicatePhotoIds.size > 0 && (
                <div className="text-xs text-orange-600 bg-orange-100 p-2 rounded flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {duplicatePhotoIds.size} doublon(s) détecté(s) (cadre orange)
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                {photos.map((photo, idx) => {
                  const isDuplicate = duplicatePhotoIds.has(photo.id);
                  const isReference = referencePhotoId === photo.id || (!referencePhotoId && idx === 0);
                  return (
                    <div 
                      key={photo.id} 
                      className={`relative rounded p-2 bg-muted/50 ${
                        isReference
                          ? "border-2 border-blue-500 ring-2 ring-blue-300"
                          : isDuplicate 
                            ? "border-2 border-orange-500 ring-2 ring-orange-300" 
                            : "border"
                      }`}
                    >
                      <img
                        src={photo.imageUrl}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-24 object-contain rounded bg-gray-200"
                      />
                      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1 rounded flex items-center gap-1">
                        #{idx + 1}
                        {isReference && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                      </div>
                      {isDuplicate && !isReference && (
                        <div className="absolute top-1 left-10 bg-orange-500 text-white text-xs px-1 rounded">
                          Doublon?
                        </div>
                      )}
                      <div className="absolute top-1 right-1 flex gap-1">
                        {photo.isProcessing ? (
                          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                        ) : photo.error ? (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <span className="bg-green-500 text-white text-xs px-1 rounded flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {photo.markers.length}
                          </span>
                        )}
                      </div>
                      {/* v3.2: Bouton définir comme référence */}
                      <Button
                        variant={isReference ? "default" : "outline"}
                        size="icon"
                        className="absolute bottom-1 left-1 h-6 w-6"
                        onClick={() => setReferencePhotoId(isReference ? null : photo.id)}
                        title={isReference ? "Photo de référence" : "Définir comme référence"}
                      >
                        <Star className={`h-3 w-3 ${isReference ? "fill-yellow-400" : ""}`} />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute bottom-1 right-1 h-6 w-6"
                        onClick={() => handleRemovePhoto(photo.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <div className="text-xs mt-1 text-muted-foreground truncate">
                        IDs: {photo.markers.map(m => m.id).join(", ") || "aucun"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* v2.1: Aperçu avec rotation */}
          {positionResult && (
            <div className="border rounded-lg p-3 bg-blue-50">
              <div className="text-sm font-medium mb-2 flex justify-between items-center">
                <span className="text-blue-700 flex items-center gap-1">
                  <RotateCw className="h-4 w-4" />
                  Positions + Rotations calculées
                </span>
                <span className="text-muted-foreground">
                  {positionResult.totalWidthMm.toFixed(0)}×{positionResult.totalHeightMm.toFixed(0)}mm
                </span>
              </div>
              <div className="text-xs text-blue-600 space-y-1 max-h-32 overflow-y-auto">
                {positionResult.images.map((img, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span>Photo {i + 1}:</span>
                    <span className="font-mono">
                      ({img.position.x.toFixed(0)}, {img.position.y.toFixed(0)})mm
                      {img.rotation !== 0 && (
                        <span className="ml-2 text-orange-600">
                          ⟳ {img.rotation.toFixed(1)}°
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-blue-500">
                Échelle: {positionResult.pixelsPerCm.toFixed(1)} px/cm
              </div>
            </div>
          )}

          {photos.length === 0 && (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-medium mb-2">Mode v2.1 avec rotation :</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Place des markers ArUco (≥2 communs entre photos adjacentes)</li>
                <li>Les photos seront <strong>positionnées ET tournées</strong> automatiquement</li>
                <li>Tu pourras ajuster manuellement après import</li>
              </ol>
            </div>
          )}

          {photos.length >= 2 && uniqueMatchedIds === 0 && (
            <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Aucun marker commun trouvé.</span>
            </div>
          )}

          {photos.length >= 2 && uniqueMatchedIds > 0 && uniqueMatchedIds < 2 && (
            <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>1 seul marker commun → rotation non calculable (il en faut ≥2)</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>

          {positionResult && (
            <>
              <Button variant="outline" onClick={handleDownloadPreview}>
                <Download className="h-4 w-4 mr-2" />
                Aperçu
              </Button>
              <Button onClick={handleConfirm}>
                <Eye className="h-4 w-4 mr-2" />
                Importer ({positionResult.images.length} images)
              </Button>
            </>
          )}

          {!positionResult && (
            <Button
              onClick={handleCalculatePositions}
              disabled={photos.length < 2 || isStitching || uniqueMatchedIds === 0}
            >
              {isStitching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Images className="h-4 w-4 mr-2" />
              )}
              Calculer ({photos.length} photos)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ArucoStitcher;
