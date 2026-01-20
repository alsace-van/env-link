// ============================================
// COMPONENT: ArucoStitcher
// Assemblage de photos via markers ArUco partagés
// VERSION: 1.1 - Avec normalisation d'échelle
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
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useOpenCVAruco, ArucoMarker } from "./useOpenCVAruco";

interface ArucoStitcherProps {
  isOpen: boolean;
  onClose: () => void;
  onStitched: (resultImage: HTMLImageElement, pixelsPerCm: number) => void;
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
  // Échelle calculée à partir des markers
  pixelsPerMm: number;
}

interface MarkerMatch {
  markerId: number;
  photo1Index: number;
  photo2Index: number;
  pos1: { x: number; y: number };
  pos2: { x: number; y: number };
}

export function ArucoStitcher({ isOpen, onClose, onStitched, markerSizeMm = 100 }: ArucoStitcherProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<PhotoWithMarkers[]>([]);
  const [isStitching, setIsStitching] = useState(false);
  const [stitchResult, setStitchResult] = useState<HTMLCanvasElement | null>(null);
  const [finalPixelsPerCm, setFinalPixelsPerCm] = useState<number>(0);
  const [markerSize, setMarkerSize] = useState<string>(markerSizeMm.toString());
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const { isLoaded, isLoading, error: opencvError, detectMarkers } = useOpenCVAruco();

  // Log debug messages
  const addDebugLog = useCallback((msg: string) => {
    console.log(`[ArucoStitcher] ${msg}`);
    setDebugLogs(prev => [...prev.slice(-20), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

  // Nettoyer les URLs au démontage
  useEffect(() => {
    return () => {
      photos.forEach(p => URL.revokeObjectURL(p.imageUrl));
    };
  }, []);

  // Réinitialiser quand on ferme
  useEffect(() => {
    if (!isOpen) {
      setStitchResult(null);
    }
  }, [isOpen]);

  // Calculer l'échelle d'une photo à partir de ses markers
  const calculatePhotoScale = (markers: ArucoMarker[], markerSizeMm: number): number => {
    if (markers.length === 0) return 0;

    let totalPixelsPerMm = 0;
    for (const marker of markers) {
      const sizePixels = (marker.size.width + marker.size.height) / 2;
      totalPixelsPerMm += sizePixels / markerSizeMm;
    }
    return totalPixelsPerMm / markers.length;
  };

  // Ajouter des photos
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

    // Détecter les markers sur chaque nouvelle photo
    for (const photo of newPhotos) {
      try {
        addDebugLog(`Détection sur ${photo.file.name}...`);
        const startTime = performance.now();
        const markers = await detectMarkers(photo.image);
        const elapsed = performance.now() - startTime;
        const pixelsPerMm = calculatePhotoScale(markers, markerSizeNum);

        addDebugLog(`${photo.file.name}: ${markers.length} markers en ${elapsed.toFixed(0)}ms`);
        if (markers.length > 0) {
          addDebugLog(`  IDs: ${markers.map(m => `#${m.id}(${((m.confidence || 1) * 100).toFixed(0)}%)`).join(', ')}`);
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

  // Supprimer une photo
  const handleRemovePhoto = useCallback((id: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo) URL.revokeObjectURL(photo.imageUrl);
      return prev.filter(p => p.id !== id);
    });
    setStitchResult(null);
  }, []);

  // Trouver les markers communs entre photos
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

  // Assembler les photos avec normalisation d'échelle
  const handleStitch = useCallback(async () => {
    if (photos.length < 2) {
      toast.error("Il faut au moins 2 photos");
      return;
    }

    const matches = findMarkerMatches();
    if (matches.length === 0) {
      toast.error("Aucun marker commun trouvé entre les photos");
      return;
    }

    // Vérifier que toutes les photos ont des markers
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
      setFinalPixelsPerCm(targetPixelsPerCm);

      console.log("Échelle cible:", targetPixelsPerMm, "px/mm =", targetPixelsPerCm, "px/cm");

      // Calculer les facteurs d'échelle pour chaque photo
      const scaleFactors = photos.map(p => {
        if (p.pixelsPerMm === 0) return 1;
        return targetPixelsPerMm / p.pixelsPerMm;
      });

      console.log("Facteurs d'échelle:", scaleFactors);

      // Calculer les positions relatives (en coordonnées normalisées)
      // Position = position du marker en mm réels
      interface PhotoPosition {
        x: number; // en mm
        y: number; // en mm
        scale: number;
      }

      const photoPositions: PhotoPosition[] = photos.map((_, i) => ({
        x: 0,
        y: 0,
        scale: scaleFactors[i]
      }));

      // Commencer par la première photo à (0, 0)
      const processed = new Set<number>([0]);
      const queue = [0];

      while (queue.length > 0) {
        const currentIdx = queue.shift()!;
        const currentPhoto = photos[currentIdx];
        const currentScale = scaleFactors[currentIdx];

        for (let otherIdx = 0; otherIdx < photos.length; otherIdx++) {
          if (processed.has(otherIdx)) continue;

          const otherPhoto = photos[otherIdx];
          const otherScale = scaleFactors[otherIdx];

          // Trouver les markers communs entre ces deux photos
          const commonMatches = matches.filter(
            m => (m.photo1Index === currentIdx && m.photo2Index === otherIdx) ||
                 (m.photo1Index === otherIdx && m.photo2Index === currentIdx)
          );

          if (commonMatches.length === 0) continue;

          // Calculer le décalage moyen en mm
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

            // Convertir les positions en mm
            const pos1Mm = {
              x: pos1InCurrent.x / currentPhoto.pixelsPerMm,
              y: pos1InCurrent.y / currentPhoto.pixelsPerMm
            };
            const pos2Mm = {
              x: pos2InOther.x / otherPhoto.pixelsPerMm,
              y: pos2InOther.y / otherPhoto.pixelsPerMm
            };

            // Le marker est au même endroit physique, donc :
            // positionPhoto1 + pos1Mm = positionPhoto2 + pos2Mm
            // positionPhoto2 = positionPhoto1 + pos1Mm - pos2Mm
            totalDxMm += pos1Mm.x - pos2Mm.x;
            totalDyMm += pos1Mm.y - pos2Mm.y;
          }

          const avgDxMm = totalDxMm / commonMatches.length;
          const avgDyMm = totalDyMm / commonMatches.length;

          photoPositions[otherIdx] = {
            x: photoPositions[currentIdx].x + avgDxMm,
            y: photoPositions[currentIdx].y + avgDyMm,
            scale: otherScale
          };

          processed.add(otherIdx);
          queue.push(otherIdx);
        }
      }

      // Vérifier que toutes les photos sont connectées
      if (processed.size < photos.length) {
        const unconnected = photos.length - processed.size;
        toast.error(`${unconnected} photo(s) non connectée(s) par des markers`);
        setIsStitching(false);
        return;
      }

      // Calculer les bounds en pixels (à l'échelle cible)
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

      // Dimensions finales en pixels
      const finalWidthPx = Math.ceil((maxXmm - minXmm) * targetPixelsPerMm);
      const finalHeightPx = Math.ceil((maxYmm - minYmm) * targetPixelsPerMm);

      console.log("Dimensions finales:", finalWidthPx, "x", finalHeightPx, "px");
      console.log("Dimensions réelles:", (maxXmm - minXmm).toFixed(0), "x", (maxYmm - minYmm).toFixed(0), "mm");

      // Limiter la taille pour éviter les problèmes de mémoire
      const maxDimension = 8000;
      let outputScale = 1;
      if (finalWidthPx > maxDimension || finalHeightPx > maxDimension) {
        outputScale = maxDimension / Math.max(finalWidthPx, finalHeightPx);
        toast.info(`Image redimensionnée à ${Math.round(outputScale * 100)}% pour éviter les problèmes de mémoire`);
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(finalWidthPx * outputScale);
      canvas.height = Math.ceil(finalHeightPx * outputScale);

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Impossible de créer le contexte canvas");

      // Fond blanc
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Dessiner chaque photo à sa position, redimensionnée
      for (let i = 0; i < photos.length; i++) {
        const pos = photoPositions[i];
        const photo = photos[i];

        // Position en pixels sur le canvas final
        const drawX = (pos.x - minXmm) * targetPixelsPerMm * outputScale;
        const drawY = (pos.y - minYmm) * targetPixelsPerMm * outputScale;

        // Taille redimensionnée
        const drawWidth = photo.image.width * scaleFactors[i] * outputScale;
        const drawHeight = photo.image.height * scaleFactors[i] * outputScale;

        ctx.drawImage(photo.image, drawX, drawY, drawWidth, drawHeight);
      }

      // Dessiner les markers détectés (debug)
      ctx.strokeStyle = "lime";
      ctx.lineWidth = 3;
      ctx.font = "bold 14px monospace";

      for (let i = 0; i < photos.length; i++) {
        const pos = photoPositions[i];
        const photo = photos[i];
        const scale = scaleFactors[i] * outputScale;

        for (const marker of photo.markers) {
          const markerXpx = (pos.x - minXmm) * targetPixelsPerMm * outputScale + marker.center.x * scale;
          const markerYpx = (pos.y - minYmm) * targetPixelsPerMm * outputScale + marker.center.y * scale;
          const markerSizePx = marker.size.width * scale;

          ctx.strokeRect(
            markerXpx - markerSizePx / 2,
            markerYpx - markerSizePx / 2,
            markerSizePx,
            markerSizePx
          );

          ctx.fillStyle = "lime";
          ctx.fillText(
            `${marker.id}`,
            markerXpx - 10,
            markerYpx - markerSizePx / 2 - 5
          );
        }
      }

      // Ajuster l'échelle finale si on a redimensionné
      const actualPixelsPerCm = targetPixelsPerCm * outputScale;
      setFinalPixelsPerCm(actualPixelsPerCm);

      setStitchResult(canvas);
      toast.success(`Assemblage réussi ! ${matches.length} markers communs, ${(maxXmm - minXmm).toFixed(0)}×${(maxYmm - minYmm).toFixed(0)}mm`);

    } catch (err) {
      console.error("Erreur stitching:", err);
      toast.error("Erreur lors de l'assemblage: " + (err as Error).message);
    } finally {
      setIsStitching(false);
    }
  }, [photos, findMarkerMatches, markerSize]);

  // Valider et envoyer le résultat
  const handleConfirm = useCallback(() => {
    if (!stitchResult) return;

    const img = new Image();
    img.onload = () => {
      onStitched(img, finalPixelsPerCm);
      onClose();
    };
    img.src = stitchResult.toDataURL("image/png");
  }, [stitchResult, finalPixelsPerCm, onStitched, onClose]);

  // Télécharger le résultat
  const handleDownload = useCallback(() => {
    if (!stitchResult) return;

    const link = document.createElement("a");
    link.download = `plancher_assemble_${Date.now()}.png`;
    link.href = stitchResult.toDataURL("image/png");
    link.click();
  }, [stitchResult]);

  // Stats
  const totalMarkers = photos.reduce((sum, p) => sum + p.markers.length, 0);
  const matches = findMarkerMatches();
  const uniqueMatchedIds = new Set(matches.map(m => m.markerId)).size;
  const avgScale = photos.length > 0
    ? photos.filter(p => p.pixelsPerMm > 0).reduce((sum, p) => sum + p.pixelsPerMm, 0) / photos.filter(p => p.pixelsPerMm > 0).length
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            Assemblage par markers ArUco
          </DialogTitle>
          <DialogDescription>
            Les photos seront redimensionnées à la même échelle et assemblées
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
              OpenCV.js v6.0 chargé - Prêt pour la détection
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
                    {/* Infos */}
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

          {/* Aperçu du résultat */}
          {stitchResult && (
            <div className="border rounded-lg p-2 bg-gray-100">
              <div className="text-sm font-medium mb-2 flex justify-between items-center">
                <span>Résultat ({stitchResult.width}×{stitchResult.height}px)</span>
                <span className="text-muted-foreground">{finalPixelsPerCm.toFixed(1)} px/cm</span>
              </div>
              <img
                src={stitchResult.toDataURL()}
                alt="Résultat"
                className="max-w-full max-h-[200px] object-contain mx-auto rounded shadow"
              />
            </div>
          )}

          {/* Instructions */}
          {photos.length === 0 && (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-medium mb-2">Comment ça marche :</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Place des markers ArUco sur la surface (même taille pour tous !)</li>
                <li>Prends plusieurs photos avec des markers <strong>en commun</strong> sur les chevauchements</li>
                <li>Les photos seront <strong>redimensionnées automatiquement</strong> à la même échelle</li>
                <li>L'image finale sera calibrée pour le tracé à taille réelle</li>
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

          {stitchResult && (
            <>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
              <Button onClick={handleConfirm}>
                <Eye className="h-4 w-4 mr-2" />
                Utiliser dans le canvas
              </Button>
            </>
          )}

          {!stitchResult && (
            <Button
              onClick={handleStitch}
              disabled={photos.length < 2 || isStitching || uniqueMatchedIds === 0}
            >
              {isStitching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Images className="h-4 w-4 mr-2" />
              )}
              Assembler ({photos.length} photos)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ArucoStitcher;
