// ============================================
// COMPONENT: ArucoStitcher
// Assemblage de photos via markers ArUco partagés
// VERSION: 2.1 - Images séparées avec ROTATION
// ============================================
// MODIFICATIONS v2.1:
// - Calcul de la rotation entre photos via markers communs
// - Nouveau champ `rotation` (degrés) dans StitchedImage
// - Affichage de la rotation dans le preview
// - Support de 2+ markers pour un calcul précis
// ============================================

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { toast } from "sonner";
import { useOpenCVAruco, ArucoMarker } from "./useOpenCVAruco";

// v2.1: Interface avec rotation
export interface StitchedImage {
  image: HTMLImageElement;
  imageUrl: string;
  position: { x: number; y: number }; // Position en mm (coin supérieur gauche après rotation)
  scale: number; // Facteur d'échelle à appliquer
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
  pixelsPerMm: number;
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

  const calculatePhotoScale = (markers: ArucoMarker[], markerSizeMm: number): number => {
    if (markers.length === 0) return 0;

    let totalPixelsPerMm = 0;
    for (const marker of markers) {
      const sizePixels = (marker.size.width + marker.size.height) / 2;
      totalPixelsPerMm += sizePixels / markerSizeMm;
    }
    return totalPixelsPerMm / markers.length;
  };

  // v2.1: Calculer l'angle de rotation entre deux photos
  const calculateRotation = (
    photo1Markers: ArucoMarker[],
    photo2Markers: ArucoMarker[],
    photo1PixelsPerMm: number,
    photo2PixelsPerMm: number
  ): number => {
    // Trouver les markers communs
    const commonMarkers: { id: number; p1: { x: number; y: number }; p2: { x: number; y: number } }[] = [];
    
    for (const m1 of photo1Markers) {
      const m2 = photo2Markers.find(m => m.id === m1.id);
      if (m2) {
        commonMarkers.push({
          id: m1.id,
          p1: { x: m1.center.x / photo1PixelsPerMm, y: m1.center.y / photo1PixelsPerMm },
          p2: { x: m2.center.x / photo2PixelsPerMm, y: m2.center.y / photo2PixelsPerMm },
        });
      }
    }

    if (commonMarkers.length < 2) {
      // Pas assez de markers pour calculer une rotation
      return 0;
    }

    // Calculer l'angle moyen entre les paires de markers
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

    // Moyenne des angles (attention aux wrapping)
    // Utiliser la moyenne circulaire
    let sumSin = 0;
    let sumCos = 0;
    for (const angle of angles) {
      const rad = angle * Math.PI / 180;
      sumSin += Math.sin(rad);
      sumCos += Math.cos(rad);
    }
    const avgAngle = Math.atan2(sumSin, sumCos) * 180 / Math.PI;

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
      });
    }

    setPhotos(prev => [...prev, ...newPhotos]);

    for (const photo of newPhotos) {
      try {
        addDebugLog(`Détection sur ${photo.file.name}...`);
        const startTime = performance.now();
        const markers = await detectMarkers(photo.image);
        const elapsed = performance.now() - startTime;
        const pixelsPerMm = calculatePhotoScale(markers, markerSizeNum);

        addDebugLog(`${photo.file.name}: ${markers.length} markers en ${elapsed.toFixed(0)}ms`);
        if (markers.length > 0) {
          addDebugLog(`  IDs: ${markers.map(m => `#${m.id}`).join(', ')}`);
        }

        setPhotos(prev => prev.map(p =>
          p.id === photo.id
            ? { ...p, markers, isProcessing: false, pixelsPerMm }
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
  }, [isLoaded, detectMarkers, markerSize, addDebugLog]);

  const handleRemovePhoto = useCallback((id: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo) URL.revokeObjectURL(photo.imageUrl);
      return prev.filter(p => p.id !== id);
    });
    setPositionResult(null);
  }, []);

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

      // Échelle cible
      const targetPixelsPerMm = Math.max(...photosWithMarkers.map(p => p.pixelsPerMm));
      const targetPixelsPerCm = targetPixelsPerMm * 10;

      addDebugLog(`Échelle cible: ${targetPixelsPerMm.toFixed(2)} px/mm`);

      // Facteurs d'échelle
      const scaleFactors = photos.map(p => {
        if (p.pixelsPerMm === 0) return 1;
        return targetPixelsPerMm / p.pixelsPerMm;
      });

      // v2.1: Structure avec position ET rotation
      interface PhotoTransform {
        x: number; // mm
        y: number; // mm
        rotation: number; // degrés
        scale: number;
      }

      const photoTransforms: PhotoTransform[] = photos.map((_, i) => ({
        x: 0,
        y: 0,
        rotation: 0,
        scale: scaleFactors[i]
      }));

      // BFS pour positionner toutes les photos
      const processed = new Set<number>([0]);
      const queue = [0];

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

          // v2.1: Calculer la rotation
          const rotation = calculateRotation(
            currentPhoto.markers,
            otherPhoto.markers,
            currentPhoto.pixelsPerMm,
            otherPhoto.pixelsPerMm
          );

          addDebugLog(`Rotation photo ${otherIdx + 1} vs photo ${currentIdx + 1}: ${rotation.toFixed(1)}°`);

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

            // Convertir en mm
            const pos1Mm = {
              x: pos1InCurrent.x / currentPhoto.pixelsPerMm,
              y: pos1InCurrent.y / currentPhoto.pixelsPerMm
            };
            let pos2Mm = {
              x: pos2InOther.x / otherPhoto.pixelsPerMm,
              y: pos2InOther.y / otherPhoto.pixelsPerMm
            };

            // v2.1: Appliquer la rotation au point de la photo other
            // Le centre de rotation est le centre de l'image other
            const otherCenterMm = {
              x: (otherPhoto.image.width / otherPhoto.pixelsPerMm) / 2,
              y: (otherPhoto.image.height / otherPhoto.pixelsPerMm) / 2
            };

            const rotatedPos2 = rotatePoint(
              pos2Mm.x,
              pos2Mm.y,
              otherCenterMm.x,
              otherCenterMm.y,
              rotation
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

          // v2.1: Stocker position ET rotation (cumulée)
          photoTransforms[otherIdx] = {
            x: avgDxMm,
            y: avgDyMm,
            rotation: currentTransform.rotation + rotation,
            scale: scaleFactors[otherIdx]
          };

          addDebugLog(`Photo ${otherIdx + 1}: pos=(${avgDxMm.toFixed(0)}, ${avgDyMm.toFixed(0)})mm, rot=${(currentTransform.rotation + rotation).toFixed(1)}°`);

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
        const widthMm = photo.image.width / photo.pixelsPerMm;
        const heightMm = photo.image.height / photo.pixelsPerMm;

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
        
        // Position du coin (0,0) après rotation
        const widthMm = photo.image.width / photo.pixelsPerMm;
        const heightMm = photo.image.height / photo.pixelsPerMm;
        const centerX = widthMm / 2;
        const centerY = heightMm / 2;
        
        // Le coin (0,0) rotated
        const rotatedOrigin = rotatePoint(0, 0, centerX, centerY, transform.rotation);
        
        return {
          image: photo.image,
          imageUrl: photo.imageUrl,
          position: {
            x: transform.x + rotatedOrigin.x - minXmm,
            y: transform.y + rotatedOrigin.y - minYmm
          },
          scale: transform.scale,
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
  }, [photos, findMarkerMatches, markerSize, addDebugLog]);

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
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                {photos.map((photo, idx) => (
                  <div key={photo.id} className="relative border rounded p-2 bg-muted/50">
                    <img
                      src={photo.imageUrl}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-24 object-contain rounded bg-gray-200"
                    />
                    <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                      #{idx + 1}
                    </div>
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
                ))}
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
