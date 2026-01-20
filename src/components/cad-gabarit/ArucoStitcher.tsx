// ============================================
// COMPONENT: ArucoStitcher
// Assemblage de photos via markers ArUco partagés
// VERSION: 2.0 - Images séparées positionnées (non fusionnées)
// ============================================
// MODIFICATIONS v2.0:
// - Retourne des images SÉPARÉES avec leurs positions calculées
// - Chaque image peut être ajustée individuellement après import
// - Nouveau callback: onStitched(images: StitchedImage[], pixelsPerCm)
// - Preview affiche les images positionnées mais non fusionnées
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
} from "lucide-react";
import { toast } from "sonner";
import { useOpenCVAruco, ArucoMarker } from "./useOpenCVAruco";

// v2.0: Nouvelle interface pour les images positionnées
export interface StitchedImage {
  image: HTMLImageElement;
  imageUrl: string;
  position: { x: number; y: number }; // Position en mm
  scale: number; // Facteur d'échelle à appliquer
  originalFile: File;
  markers: ArucoMarker[];
}

interface ArucoStitcherProps {
  isOpen: boolean;
  onClose: () => void;
  // v2.0: Nouveau callback avec images séparées
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

// v2.0: Résultat du calcul de positions
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
    console.log(`[ArucoStitcher v2] ${msg}`);
    setDebugLogs(prev => [...prev.slice(-20), `${new Date().toLocaleTimeString()}: ${msg}`]);
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

  // v2.0: Calculer les positions sans fusionner les images
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

      // Trouver l'échelle cible (utiliser la plus haute résolution)
      const targetPixelsPerMm = Math.max(...photosWithMarkers.map(p => p.pixelsPerMm));
      const targetPixelsPerCm = targetPixelsPerMm * 10;

      addDebugLog(`Échelle cible: ${targetPixelsPerMm.toFixed(2)} px/mm = ${targetPixelsPerCm.toFixed(1)} px/cm`);

      // Calculer les facteurs d'échelle pour chaque photo
      const scaleFactors = photos.map(p => {
        if (p.pixelsPerMm === 0) return 1;
        return targetPixelsPerMm / p.pixelsPerMm;
      });

      // Calculer les positions relatives en mm
      interface PhotoPosition {
        x: number;
        y: number;
        scale: number;
      }

      const photoPositions: PhotoPosition[] = photos.map((_, i) => ({
        x: 0,
        y: 0,
        scale: scaleFactors[i]
      }));

      // BFS pour positionner toutes les photos
      const processed = new Set<number>([0]);
      const queue = [0];

      while (queue.length > 0) {
        const currentIdx = queue.shift()!;
        const currentPhoto = photos[currentIdx];

        for (let otherIdx = 0; otherIdx < photos.length; otherIdx++) {
          if (processed.has(otherIdx)) continue;

          const otherPhoto = photos[otherIdx];

          const commonMatches = matches.filter(
            m => (m.photo1Index === currentIdx && m.photo2Index === otherIdx) ||
                 (m.photo1Index === otherIdx && m.photo2Index === currentIdx)
          );

          if (commonMatches.length === 0) continue;

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

            const pos1Mm = {
              x: pos1InCurrent.x / currentPhoto.pixelsPerMm,
              y: pos1InCurrent.y / currentPhoto.pixelsPerMm
            };
            const pos2Mm = {
              x: pos2InOther.x / otherPhoto.pixelsPerMm,
              y: pos2InOther.y / otherPhoto.pixelsPerMm
            };

            totalDxMm += pos1Mm.x - pos2Mm.x;
            totalDyMm += pos1Mm.y - pos2Mm.y;
          }

          const avgDxMm = totalDxMm / commonMatches.length;
          const avgDyMm = totalDyMm / commonMatches.length;

          photoPositions[otherIdx] = {
            x: photoPositions[currentIdx].x + avgDxMm,
            y: photoPositions[currentIdx].y + avgDyMm,
            scale: scaleFactors[otherIdx]
          };

          processed.add(otherIdx);
          queue.push(otherIdx);

          addDebugLog(`Photo ${otherIdx + 1} positionnée: (${avgDxMm.toFixed(0)}, ${avgDyMm.toFixed(0)}) mm`);
        }
      }

      if (processed.size < photos.length) {
        const unconnected = photos.length - processed.size;
        toast.error(`${unconnected} photo(s) non connectée(s) par des markers`);
        setIsStitching(false);
        return;
      }

      // Calculer les bounds
      let minXmm = Infinity, minYmm = Infinity, maxXmm = -Infinity, maxYmm = -Infinity;

      for (let i = 0; i < photos.length; i++) {
        const pos = photoPositions[i];
        const photo = photos[i];
        const widthMm = photo.image.width / photo.pixelsPerMm;
        const heightMm = photo.image.height / photo.pixelsPerMm;

        minXmm = Math.min(minXmm, pos.x);
        minYmm = Math.min(minYmm, pos.y);
        maxXmm = Math.max(maxXmm, pos.x + widthMm);
        maxYmm = Math.max(maxYmm, pos.y + heightMm);
      }

      // Normaliser les positions (décaler pour que le min soit à 0)
      const stitchedImages: StitchedImage[] = photos.map((photo, i) => ({
        image: photo.image,
        imageUrl: photo.imageUrl,
        position: {
          x: photoPositions[i].x - minXmm,
          y: photoPositions[i].y - minYmm
        },
        scale: photoPositions[i].scale,
        originalFile: photo.file,
        markers: photo.markers,
      }));

      const totalWidthMm = maxXmm - minXmm;
      const totalHeightMm = maxYmm - minYmm;

      addDebugLog(`Dimensions totales: ${totalWidthMm.toFixed(0)} x ${totalHeightMm.toFixed(0)} mm`);

      setPositionResult({
        images: stitchedImages,
        pixelsPerCm: targetPixelsPerCm,
        totalWidthMm,
        totalHeightMm,
      });

      toast.success(`Positions calculées ! ${matches.length} markers communs, ${totalWidthMm.toFixed(0)}×${totalHeightMm.toFixed(0)}mm`);

    } catch (err) {
      console.error("Erreur calcul positions:", err);
      toast.error("Erreur lors du calcul: " + (err as Error).message);
    } finally {
      setIsStitching(false);
    }
  }, [photos, findMarkerMatches, markerSize, addDebugLog]);

  // v2.0: Envoyer les images séparées au canvas
  const handleConfirm = useCallback(() => {
    if (!positionResult) return;

    onStitched(positionResult.images, positionResult.pixelsPerCm);
    onClose();
  }, [positionResult, onStitched, onClose]);

  // Télécharger un aperçu fusionné (pour debug)
  const handleDownloadPreview = useCallback(() => {
    if (!positionResult) return;

    const { images, pixelsPerCm, totalWidthMm, totalHeightMm } = positionResult;
    const targetPixelsPerMm = pixelsPerCm / 10;

    // Limiter la taille
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

    // Dessiner chaque image
    for (const img of images) {
      const drawX = img.position.x * targetPixelsPerMm * outputScale;
      const drawY = img.position.y * targetPixelsPerMm * outputScale;
      const drawWidth = img.image.width * img.scale * outputScale;
      const drawHeight = img.image.height * img.scale * outputScale;

      ctx.drawImage(img.image, drawX, drawY, drawWidth, drawHeight);
    }

    const link = document.createElement("a");
    link.download = `preview_${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [positionResult]);

  // Stats
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
            Les photos seront positionnées séparément (ajustables après import)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status OpenCV */}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-2 rounded">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement d'OpenCV.js...
            </div>
          )}

          {opencvError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              <AlertCircle className="h-4 w-4" />
              Erreur OpenCV: {opencvError}
            </div>
          )}

          {isLoaded && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
              <CheckCircle2 className="h-4 w-4" />
              Détecteur ArUco v16 chargé (mode strict)
            </div>
          )}

          {/* Taille des markers */}
          <div className="flex items-center gap-4">
            <Label htmlFor="markerSizeInput" className="text-sm whitespace-nowrap">
              Taille réelle des markers:
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

          {/* Bouton ajouter et debug */}
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
              title="Afficher les logs de debug"
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

          {/* Debug Panel */}
          {showDebug && (
            <div className="p-3 bg-gray-900 text-green-400 font-mono text-xs rounded-lg max-h-40 overflow-y-auto">
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
                <div className="text-gray-500">Aucun log. Ajoutez des photos pour voir les logs.</div>
              ) : (
                debugLogs.map((log, i) => (
                  <div key={i} className="border-b border-gray-700 py-1">{log}</div>
                ))
              )}
            </div>
          )}

          {/* Liste des photos */}
          {photos.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium flex justify-between">
                <span>Photos ({photos.length}) - {totalMarkers} markers</span>
                <span className="text-muted-foreground">{uniqueMatchedIds} markers communs</span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    className="relative border rounded p-2 bg-muted/50"
                  >
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
                    <div className="text-xs mt-1 text-muted-foreground">
                      <div className="truncate">IDs: {photo.markers.map(m => m.id).join(", ") || "aucun"}</div>
                      {photo.pixelsPerMm > 0 && (
                        <div>Échelle: {photo.pixelsPerMm.toFixed(2)} px/mm</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* v2.0: Aperçu des positions calculées */}
          {positionResult && (
            <div className="border rounded-lg p-3 bg-blue-50">
              <div className="text-sm font-medium mb-2 flex justify-between items-center">
                <span className="text-blue-700">
                  ✓ Positions calculées ({positionResult.images.length} images)
                </span>
                <span className="text-muted-foreground">
                  {positionResult.totalWidthMm.toFixed(0)}×{positionResult.totalHeightMm.toFixed(0)}mm
                </span>
              </div>
              <div className="text-xs text-blue-600 space-y-1">
                {positionResult.images.map((img, i) => (
                  <div key={i} className="flex justify-between">
                    <span>Photo {i + 1}:</span>
                    <span>
                      ({img.position.x.toFixed(0)}, {img.position.y.toFixed(0)}) mm, 
                      scale ×{img.scale.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-blue-500">
                Échelle: {positionResult.pixelsPerCm.toFixed(1)} px/cm
              </div>
            </div>
          )}

          {/* Instructions */}
          {photos.length === 0 && (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-medium mb-2">Comment ça marche :</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Place des markers ArUco sur la surface (même taille pour tous !)</li>
                <li>Prends plusieurs photos avec des markers <strong>en commun</strong> sur les chevauchements</li>
                <li>Les photos seront <strong>positionnées automatiquement</strong> mais restent séparées</li>
                <li>Tu pourras <strong>ajuster manuellement</strong> chaque image après import</li>
              </ol>
            </div>
          )}

          {/* Avertissement si pas assez de markers communs */}
          {photos.length >= 2 && uniqueMatchedIds === 0 && (
            <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Aucun marker commun. Assurez-vous que les photos se chevauchent avec le même marker visible.</span>
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
                Aperçu fusionné
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
              Calculer les positions ({photos.length} photos)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ArucoStitcher;
