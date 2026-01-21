// ============================================
// COMPONENT: ArucoStitcher
// Assemblage de photos via markers ArUco partagés
// VERSION: 4.1
// ============================================
//
// CHANGELOG v4.1 (21/01/2026):
// - NOUVEAU: Outil de recadrage (crop) interactif
// - Dessiner un rectangle sur l'image pour recadrer
// - Prévisualisation avec zone assombrie
// - Boutons Valider/Annuler pour le crop
//
// CHANGELOG v4.0 (21/01/2026):
// - NOUVEAU: Mode édition par photo avant assemblage
// - Grande préview avec rotation et crop
// - Navigation Précédent/Suivant entre photos
// - Re-détection markers après modifications
// - Canvas interactif pour crop
//
// CHANGELOG v3.6 (21/01/2026):
// - Nouvelle prop `initialImages` pour réassembler des images existantes
//
// CHANGELOG v3.5 (21/01/2026):
// - Modale agrandie (max-w-5xl)
// - Grille 4 colonnes avec miniatures plus grandes
//
// CHANGELOG v3.4 (21/01/2026):
// - FIX CRITIQUE: Utilise pxPerMmX et pxPerMmY séparément
// ============================================

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Bug,
  RotateCw,
  RotateCcw,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Eye,
  Crop,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { useOpenCVAruco, ArucoMarker } from "./useOpenCVAruco";

// Interface d'export
export interface StitchedImage {
  image: HTMLImageElement;
  imageUrl: string;
  position: { x: number; y: number };
  scale: number;
  scaleX?: number;
  scaleY?: number;
  rotation: number;
  originalFile: File;
  markers: ArucoMarker[];
}

interface ArucoStitcherProps {
  isOpen: boolean;
  onClose: () => void;
  onStitched: (images: StitchedImage[], pixelsPerCm: number) => void;
  markerSizeMm: number;
  initialImages?: Array<{
    id: string;
    name: string;
    image: HTMLImageElement;
  }>;
}

// v4.0: Édition par photo
interface PhotoEdit {
  rotation: number;
  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  needsRedetect: boolean;
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
  pixelsPerMmX: number;
  pixelsPerMmY: number;
  edit: PhotoEdit;
  transformedImage?: HTMLImageElement;
  transformedUrl?: string;
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

export function ArucoStitcher({ isOpen, onClose, onStitched, markerSizeMm = 100, initialImages }: ArucoStitcherProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [photos, setPhotos] = useState<PhotoWithMarkers[]>([]);
  const [isStitching, setIsStitching] = useState(false);
  const [positionResult, setPositionResult] = useState<PositionResult | null>(null);
  const [markerSize, setMarkerSize] = useState<string>(markerSizeMm.toString());
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  
  const [tolerance, setTolerance] = useState<number>(0);
  const [duplicatePhotoIds, setDuplicatePhotoIds] = useState<Set<string>>(new Set());
  
  const [autoRotation, setAutoRotation] = useState<boolean>(false);
  const [referencePhotoId, setReferencePhotoId] = useState<string | null>(null);

  // v4.0: Mode édition
  const [editMode, setEditMode] = useState<boolean>(false);
  const [currentEditIndex, setCurrentEditIndex] = useState<number>(0);

  // v4.1: Mode crop interactif
  const [isCropMode, setIsCropMode] = useState<boolean>(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState<boolean>(false);

  // Pour le mapping coordonnées écran <-> image
  const [canvasMapping, setCanvasMapping] = useState<{
    offsetX: number;
    offsetY: number;
    scale: number;
    imgW: number;
    imgH: number;
  } | null>(null);

  const { isLoaded, isLoading, error: opencvError, detectMarkers } = useOpenCVAruco();

  const addDebugLog = useCallback((msg: string) => {
    console.log(`[ArucoStitcher v4.0] ${msg}`);
    setDebugLogs(prev => [...prev.slice(-30), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      photos.forEach(p => {
        if (p.imageUrl.startsWith('blob:')) URL.revokeObjectURL(p.imageUrl);
        if (p.transformedUrl?.startsWith('blob:')) URL.revokeObjectURL(p.transformedUrl);
      });
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPositionResult(null);
      setEditMode(false);
      setCurrentEditIndex(0);
    }
  }, [isOpen]);

  const createDefaultEdit = (): PhotoEdit => ({
    rotation: 0,
    crop: null,
    needsRedetect: false
  });

  const calculatePhotoScale = (markers: ArucoMarker[], markerSizeMm: number): { 
    pixelsPerMm: number; 
    pixelsPerMmX: number; 
    pixelsPerMmY: number; 
  } => {
    if (markers.length === 0) return { pixelsPerMm: 0, pixelsPerMmX: 0, pixelsPerMmY: 0 };

    let totalPxPerMmX = 0;
    let totalPxPerMmY = 0;
    for (const marker of markers) {
      totalPxPerMmX += marker.size.width / markerSizeMm;
      totalPxPerMmY += marker.size.height / markerSizeMm;
    }
    const pixelsPerMmX = totalPxPerMmX / markers.length;
    const pixelsPerMmY = totalPxPerMmY / markers.length;
    const pixelsPerMm = (pixelsPerMmX + pixelsPerMmY) / 2;
    
    return { pixelsPerMm, pixelsPerMmX, pixelsPerMmY };
  };

  const detectDuplicates = useCallback((photosList: PhotoWithMarkers[]) => {
    const duplicates = new Set<string>();
    const POSITION_TOLERANCE = 15;

    for (let i = 0; i < photosList.length; i++) {
      for (let j = i + 1; j < photosList.length; j++) {
        const photo1 = photosList[i];
        const photo2 = photosList[j];

        if (photo1.markers.length === 0 || photo2.markers.length === 0) continue;

        const ids1 = new Set(photo1.markers.map(m => m.id));
        const ids2 = new Set(photo2.markers.map(m => m.id));

        if (ids1.size !== ids2.size) continue;
        
        let allMatch = true;
        for (const id of ids1) {
          if (!ids2.has(id)) {
            allMatch = false;
            break;
          }
        }
        if (!allMatch) continue;

        let positionsMatch = true;
        for (const m1 of photo1.markers) {
          const m2 = photo2.markers.find(m => m.id === m1.id);
          if (!m2) { positionsMatch = false; break; }
          
          const ref1 = photo1.markers[0];
          const ref2 = photo2.markers[0];
          
          const dx = Math.abs((m1.center.x - ref1.center.x) - (m2.center.x - ref2.center.x));
          const dy = Math.abs((m1.center.y - ref1.center.y) - (m2.center.y - ref2.center.y));
          
          if (dx > POSITION_TOLERANCE || dy > POSITION_TOLERANCE) {
            positionsMatch = false;
            break;
          }
        }

        if (positionsMatch) {
          duplicates.add(photo2.id);
          addDebugLog(`⚠️ Doublon: Photo ${j + 1} ≈ Photo ${i + 1}`);
        }
      }
    }

    setDuplicatePhotoIds(duplicates);
    return duplicates;
  }, [addDebugLog]);

  // v4.0: Appliquer rotation à une image
  const applyTransformations = useCallback(async (photo: PhotoWithMarkers): Promise<{
    image: HTMLImageElement;
    url: string;
  }> => {
    const { edit, image } = photo;
    
    if (edit.rotation === 0 && !edit.crop) {
      return { image, url: photo.imageUrl };
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Impossible de créer le contexte canvas");

    let srcX = 0, srcY = 0, srcW = image.width, srcH = image.height;
    
    if (edit.crop) {
      srcX = Math.round(image.width * edit.crop.x / 100);
      srcY = Math.round(image.height * edit.crop.y / 100);
      srcW = Math.round(image.width * edit.crop.width / 100);
      srcH = Math.round(image.height * edit.crop.height / 100);
    }

    const isRotated90or270 = Math.abs(edit.rotation % 180) === 90;
    
    if (isRotated90or270) {
      canvas.width = srcH;
      canvas.height = srcW;
    } else {
      canvas.width = srcW;
      canvas.height = srcH;
    }

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((edit.rotation * Math.PI) / 180);
    
    if (isRotated90or270) {
      ctx.drawImage(image, srcX, srcY, srcW, srcH, -srcW / 2, -srcH / 2, srcW, srcH);
    } else {
      ctx.drawImage(image, srcX, srcY, srcW, srcH, -srcW / 2, -srcH / 2, srcW, srcH);
    }
    ctx.restore();

    const blob = await new Promise<Blob | null>(resolve => 
      canvas.toBlob(resolve, 'image/jpeg', 0.95)
    );
    if (!blob) throw new Error("Impossible de créer le blob");

    const url = URL.createObjectURL(blob);
    const newImage = new Image();
    await new Promise<void>((resolve, reject) => {
      newImage.onload = () => resolve();
      newImage.onerror = reject;
      newImage.src = url;
    });

    return { image: newImage, url };
  }, []);

  // v4.0: Dessiner la préview avec markers et crop
  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || photos.length === 0 || currentEditIndex >= photos.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const photo = photos[currentEditIndex];
    const image = photo.transformedImage || photo.image;
    const edit = photo.edit;

    const maxWidth = canvas.width;
    const maxHeight = canvas.height;
    
    let imgW = image.width;
    let imgH = image.height;
    
    // Simuler la rotation pour les dimensions
    if (!photo.transformedImage && (edit.rotation === 90 || edit.rotation === 270 || edit.rotation === -90 || edit.rotation === -270)) {
      [imgW, imgH] = [imgH, imgW];
    }

    const scale = Math.min(maxWidth / imgW, maxHeight / imgH) * 0.95;
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const offsetX = (maxWidth - drawW) / 2;
    const offsetY = (maxHeight - drawH) / 2;

    // Stocker le mapping pour les handlers de crop
    setCanvasMapping({ offsetX, offsetY, scale, imgW, imgH });

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dessiner l'image
    ctx.save();
    ctx.translate(maxWidth / 2, maxHeight / 2);
    
    if (photo.transformedImage) {
      ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      ctx.rotate((edit.rotation * Math.PI) / 180);
      const origW = photo.image.width * scale;
      const origH = photo.image.height * scale;
      ctx.drawImage(photo.image, -origW / 2, -origH / 2, origW, origH);
    }
    ctx.restore();

    // v4.1: Dessiner le crop existant ou en cours
    const cropToDraw = (isCropMode && cropStart && cropEnd) 
      ? { 
          x: Math.min(cropStart.x, cropEnd.x),
          y: Math.min(cropStart.y, cropEnd.y),
          w: Math.abs(cropEnd.x - cropStart.x),
          h: Math.abs(cropEnd.y - cropStart.y)
        }
      : edit.crop 
        ? {
            x: offsetX + (edit.crop.x / 100) * imgW * scale,
            y: offsetY + (edit.crop.y / 100) * imgH * scale,
            w: (edit.crop.width / 100) * imgW * scale,
            h: (edit.crop.height / 100) * imgH * scale
          }
        : null;

    if (cropToDraw && cropToDraw.w > 5 && cropToDraw.h > 5) {
      // Assombrir l'extérieur du crop
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      // Haut
      ctx.fillRect(offsetX, offsetY, drawW, cropToDraw.y - offsetY);
      // Bas
      ctx.fillRect(offsetX, cropToDraw.y + cropToDraw.h, drawW, (offsetY + drawH) - (cropToDraw.y + cropToDraw.h));
      // Gauche
      ctx.fillRect(offsetX, cropToDraw.y, cropToDraw.x - offsetX, cropToDraw.h);
      // Droite
      ctx.fillRect(cropToDraw.x + cropToDraw.w, cropToDraw.y, (offsetX + drawW) - (cropToDraw.x + cropToDraw.w), cropToDraw.h);

      // Bordure du crop
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(cropToDraw.x, cropToDraw.y, cropToDraw.w, cropToDraw.h);
      ctx.setLineDash([]);

      // Poignées aux coins
      const handleSize = 8;
      ctx.fillStyle = '#ff6600';
      ctx.fillRect(cropToDraw.x - handleSize/2, cropToDraw.y - handleSize/2, handleSize, handleSize);
      ctx.fillRect(cropToDraw.x + cropToDraw.w - handleSize/2, cropToDraw.y - handleSize/2, handleSize, handleSize);
      ctx.fillRect(cropToDraw.x - handleSize/2, cropToDraw.y + cropToDraw.h - handleSize/2, handleSize, handleSize);
      ctx.fillRect(cropToDraw.x + cropToDraw.w - handleSize/2, cropToDraw.y + cropToDraw.h - handleSize/2, handleSize, handleSize);
    }

    // Dessiner les markers détectés (sauf en mode crop)
    if (!isCropMode) {
      const markers = photo.markers;
      
      for (const marker of markers) {
        let mx = marker.center.x;
        let my = marker.center.y;
        
        // Transformer les coordonnées selon la rotation actuelle
        if (!photo.transformedImage) {
          const imgCx = photo.image.width / 2;
          const imgCy = photo.image.height / 2;
          const rad = (edit.rotation * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const dx = mx - imgCx;
          const dy = my - imgCy;
          mx = imgCx + dx * cos - dy * sin;
          my = imgCy + dx * sin + dy * cos;
          
          if (edit.rotation === 90 || edit.rotation === -270) {
            [mx, my] = [photo.image.height - my + (photo.image.width - photo.image.height) / 2, mx - (photo.image.width - photo.image.height) / 2];
          } else if (edit.rotation === 270 || edit.rotation === -90) {
            [mx, my] = [my - (photo.image.width - photo.image.height) / 2, photo.image.width - mx + (photo.image.width - photo.image.height) / 2];
          }
        }

        const screenX = offsetX + mx * scale;
        const screenY = offsetY + my * scale;

        ctx.beginPath();
        ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const label = `#${marker.id}`;
        const tw = ctx.measureText(label).width;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(screenX - tw / 2 - 3, screenY - 18, tw + 6, 14);
        
        ctx.fillStyle = '#00ff00';
        ctx.fillText(label, screenX, screenY - 11);
      }
    }

    // Indicateur mode crop
    if (isCropMode) {
      ctx.fillStyle = 'rgba(255, 102, 0, 0.8)';
      ctx.fillRect(10, 10, 120, 24);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('✂️ Mode Recadrage', 16, 22);
    }
  }, [photos, currentEditIndex, isCropMode, cropStart, cropEnd]);

  // v4.1: Handlers pour le crop
  const handleCropMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCropMode || !canvasMapping) return;
    
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Vérifier que le clic est dans l'image
    const { offsetX, offsetY, scale, imgW, imgH } = canvasMapping;
    if (x >= offsetX && x <= offsetX + imgW * scale && 
        y >= offsetY && y <= offsetY + imgH * scale) {
      setCropStart({ x, y });
      setCropEnd({ x, y });
      setIsDraggingCrop(true);
    }
  }, [isCropMode, canvasMapping]);

  const handleCropMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingCrop || !canvasMapping) return;
    
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const { offsetX, offsetY, scale, imgW, imgH } = canvasMapping;
    
    // Contraindre aux limites de l'image
    let x = Math.max(offsetX, Math.min(e.clientX - rect.left, offsetX + imgW * scale));
    let y = Math.max(offsetY, Math.min(e.clientY - rect.top, offsetY + imgH * scale));
    
    setCropEnd({ x, y });
  }, [isDraggingCrop, canvasMapping]);

  const handleCropMouseUp = useCallback(() => {
    setIsDraggingCrop(false);
  }, []);

  // v4.1: Confirmer le crop
  const handleConfirmCrop = useCallback(() => {
    if (!cropStart || !cropEnd || !canvasMapping) return;
    
    const { offsetX, offsetY, scale, imgW, imgH } = canvasMapping;
    
    // Convertir les coordonnées écran en pourcentages de l'image
    const x1 = Math.min(cropStart.x, cropEnd.x);
    const y1 = Math.min(cropStart.y, cropEnd.y);
    const x2 = Math.max(cropStart.x, cropEnd.x);
    const y2 = Math.max(cropStart.y, cropEnd.y);
    
    const cropX = ((x1 - offsetX) / (imgW * scale)) * 100;
    const cropY = ((y1 - offsetY) / (imgH * scale)) * 100;
    const cropW = ((x2 - x1) / (imgW * scale)) * 100;
    const cropH = ((y2 - y1) / (imgH * scale)) * 100;
    
    // Ignorer les crops trop petits
    if (cropW < 5 || cropH < 5) {
      toast.error("Zone de recadrage trop petite");
      return;
    }
    
    setPhotos(prev => prev.map((p, i) => {
      if (i !== currentEditIndex) return p;
      return {
        ...p,
        edit: {
          ...p.edit,
          crop: { x: cropX, y: cropY, width: cropW, height: cropH },
          needsRedetect: true
        },
        transformedImage: undefined,
        transformedUrl: undefined
      };
    }));
    
    setIsCropMode(false);
    setCropStart(null);
    setCropEnd(null);
    addDebugLog(`Crop: ${cropW.toFixed(0)}% × ${cropH.toFixed(0)}%`);
  }, [cropStart, cropEnd, canvasMapping, currentEditIndex, addDebugLog]);

  // v4.1: Annuler le crop
  const handleCancelCrop = useCallback(() => {
    setIsCropMode(false);
    setCropStart(null);
    setCropEnd(null);
  }, []);

  // v4.1: Supprimer le crop existant
  const handleRemoveCrop = useCallback(() => {
    setPhotos(prev => prev.map((p, i) => {
      if (i !== currentEditIndex) return p;
      return {
        ...p,
        edit: { ...p.edit, crop: null, needsRedetect: true },
        transformedImage: undefined,
        transformedUrl: undefined
      };
    }));
    addDebugLog("Crop supprimé");
  }, [currentEditIndex, addDebugLog]);

  useEffect(() => {
    if (editMode) {
      drawPreview();
    }
  }, [editMode, drawPreview, photos, currentEditIndex, isCropMode, cropStart, cropEnd]);

  // v4.0: Handlers de rotation
  const handleRotate = useCallback((degrees: number) => {
    setPhotos(prev => prev.map((p, i) => {
      if (i !== currentEditIndex) return p;
      
      let newRotation = (p.edit.rotation + degrees) % 360;
      if (newRotation < 0) newRotation += 360;
      
      return {
        ...p,
        edit: { ...p.edit, rotation: newRotation, needsRedetect: true },
        transformedImage: undefined,
        transformedUrl: undefined
      };
    }));
    
    addDebugLog(`Rotation: +${degrees}°`);
  }, [currentEditIndex, addDebugLog]);

  // v4.0: Appliquer les transformations et re-détecter
  const handleApplyAndRedetect = useCallback(async () => {
    const photo = photos[currentEditIndex];
    if (!photo) return;

    setPhotos(prev => prev.map((p, i) => 
      i === currentEditIndex ? { ...p, isProcessing: true } : p
    ));

    try {
      const { image: transformedImage, url: transformedUrl } = await applyTransformations(photo);
      
      addDebugLog(`Re-détection après transformation...`);
      const markers = await detectMarkers(transformedImage, { tolerance });
      const markerSizeNum = parseFloat(markerSize) || 100;
      const scales = calculatePhotoScale(markers, markerSizeNum);
      
      addDebugLog(`Photo ${currentEditIndex + 1}: ${markers.length} markers après transformation`);

      setPhotos(prev => prev.map((p, i) => {
        if (i !== currentEditIndex) return p;
        
        if (p.transformedUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(p.transformedUrl);
        }
        
        return {
          ...p,
          markers,
          isProcessing: false,
          transformedImage,
          transformedUrl,
          ...scales,
          edit: { ...p.edit, needsRedetect: false }
        };
      }));

      toast.success(`${markers.length} markers détectés`);
    } catch (err) {
      console.error("Erreur transformation:", err);
      toast.error("Erreur lors de la transformation");
      setPhotos(prev => prev.map((p, i) => 
        i === currentEditIndex ? { ...p, isProcessing: false } : p
      ));
    }
  }, [photos, currentEditIndex, applyTransformations, detectMarkers, tolerance, markerSize, addDebugLog]);

  const handleResetEdit = useCallback(() => {
    const photo = photos[currentEditIndex];
    if (!photo) return;

    setPhotos(prev => prev.map((p, i) => {
      if (i !== currentEditIndex) return p;
      
      if (p.transformedUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(p.transformedUrl);
      }
      
      return {
        ...p,
        edit: createDefaultEdit(),
        transformedImage: undefined,
        transformedUrl: undefined,
      };
    }));
    
    // Re-détecter sur l'image originale
    setTimeout(async () => {
      const p = photos[currentEditIndex];
      if (!p) return;
      
      setPhotos(prev => prev.map((ph, i) => 
        i === currentEditIndex ? { ...ph, isProcessing: true } : ph
      ));

      try {
        const markers = await detectMarkers(p.image, { tolerance });
        const markerSizeNum = parseFloat(markerSize) || 100;
        const scales = calculatePhotoScale(markers, markerSizeNum);
        
        setPhotos(prev => prev.map((ph, i) => 
          i === currentEditIndex ? { ...ph, markers, isProcessing: false, ...scales } : ph
        ));
      } catch {
        setPhotos(prev => prev.map((ph, i) => 
          i === currentEditIndex ? { ...ph, isProcessing: false } : ph
        ));
      }
    }, 100);
  }, [currentEditIndex, photos, detectMarkers, tolerance, markerSize]);

  const handlePrevPhoto = useCallback(() => {
    if (currentEditIndex > 0) {
      setCurrentEditIndex(prev => prev - 1);
    }
  }, [currentEditIndex]);

  const handleNextPhoto = useCallback(() => {
    if (currentEditIndex < photos.length - 1) {
      setCurrentEditIndex(prev => prev + 1);
    }
  }, [currentEditIndex, photos.length]);

  // v3.6: Charger les images existantes
  useEffect(() => {
    if (!isOpen || !initialImages || initialImages.length === 0) return;
    if (!isLoaded) return;
    
    photos.forEach(p => {
      if (p.imageUrl.startsWith('blob:')) URL.revokeObjectURL(p.imageUrl);
      if (p.transformedUrl?.startsWith('blob:')) URL.revokeObjectURL(p.transformedUrl);
    });
    
    const markerSizeMmValue = parseFloat(markerSize) || 100;
    
    const loadExistingImages = async () => {
      const newPhotos: PhotoWithMarkers[] = [];
      
      for (const img of initialImages) {
        const canvas = document.createElement('canvas');
        canvas.width = img.image.naturalWidth || img.image.width;
        canvas.height = img.image.naturalHeight || img.image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        
        ctx.drawImage(img.image, 0, 0);
        
        const blob = await new Promise<Blob | null>(resolve => 
          canvas.toBlob(resolve, 'image/jpeg', 0.95)
        );
        if (!blob) continue;
        
        const file = new File([blob], img.name || `image-${img.id}.jpg`, { type: 'image/jpeg' });
        const imageUrl = URL.createObjectURL(blob);
        
        let markers: ArucoMarker[] = [];
        try {
          markers = await detectMarkers(img.image, tolerance);
          addDebugLog(`Image ${img.name}: ${markers.length} markers`);
        } catch (e) {
          console.warn('Erreur détection:', e);
        }
        
        const scales = calculatePhotoScale(markers, markerSizeMmValue);
        
        newPhotos.push({
          id: img.id,
          file,
          image: img.image,
          imageUrl,
          markers,
          isProcessing: false,
          ...scales,
          edit: createDefaultEdit()
        });
      }
      
      setPhotos(newPhotos);
      addDebugLog(`${newPhotos.length} images chargées`);
      detectDuplicates(newPhotos);
      
      if (newPhotos.length > 0) {
        setEditMode(true);
        setCurrentEditIndex(0);
      }
    };
    
    loadExistingImages();
  }, [isOpen, initialImages, isLoaded, tolerance, detectMarkers, markerSize]);

  // Ajouter des photos
  const handleAddPhotos = useCallback(async (files: FileList | null) => {
    if (!files || !isLoaded) return;

    addDebugLog(`Ajout de ${files.length} fichier(s)...`);
    const markerSizeNum = parseFloat(markerSize) || 100;
    const newPhotos: PhotoWithMarkers[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;

      const imageUrl = URL.createObjectURL(file);
      const image = new Image();

      await new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
        image.src = imageUrl;
      });

      if (image.width === 0) continue;

      addDebugLog(`Image: ${file.name} (${image.width}x${image.height})`);

      newPhotos.push({
        id: `photo-${Date.now()}-${i}`,
        file,
        image,
        imageUrl,
        markers: [],
        isProcessing: true,
        pixelsPerMm: 0,
        pixelsPerMmX: 0,
        pixelsPerMmY: 0,
        edit: createDefaultEdit()
      });
    }

    setPhotos(prev => [...prev, ...newPhotos]);

    for (const photo of newPhotos) {
      try {
        const markers = await detectMarkers(photo.image, { tolerance });
        const scales = calculatePhotoScale(markers, markerSizeNum);

        addDebugLog(`${photo.file.name}: ${markers.length} markers`);

        setPhotos(prev => prev.map(p =>
          p.id === photo.id ? { ...p, markers, isProcessing: false, ...scales } : p
        ));
      } catch {
        setPhotos(prev => prev.map(p =>
          p.id === photo.id ? { ...p, isProcessing: false, error: "Erreur" } : p
        ));
      }
    }

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
      if (photo) {
        if (photo.imageUrl.startsWith('blob:')) URL.revokeObjectURL(photo.imageUrl);
        if (photo.transformedUrl?.startsWith('blob:')) URL.revokeObjectURL(photo.transformedUrl);
      }
      const newPhotos = prev.filter(p => p.id !== id);
      
      if (currentEditIndex >= newPhotos.length) {
        setCurrentEditIndex(Math.max(0, newPhotos.length - 1));
      }
      
      return newPhotos;
    });
  }, [currentEditIndex]);

  // Stats
  const totalMarkers = photos.reduce((sum, p) => sum + p.markers.length, 0);
  const markerIdCounts = new Map<number, number>();
  photos.forEach(p => p.markers.forEach(m => {
    markerIdCounts.set(m.id, (markerIdCounts.get(m.id) || 0) + 1);
  }));
  const uniqueMatchedIds = Array.from(markerIdCounts.entries()).filter(([_, count]) => count >= 2).length;

  const findMarkerMatches = useCallback((): MarkerMatch[] => {
    const matches: MarkerMatch[] = [];

    for (let i = 0; i < photos.length; i++) {
      for (let j = i + 1; j < photos.length; j++) {
        for (const m1 of photos[i].markers) {
          const m2 = photos[j].markers.find(m => m.id === m1.id);
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

  const calculateRotation = (
    photo1Markers: ArucoMarker[],
    photo2Markers: ArucoMarker[],
    p1PxPerMmX: number,
    p1PxPerMmY: number,
    p2PxPerMmX: number,
    p2PxPerMmY: number
  ): number => {
    const MAX_ROTATION = 15, MAX_STD_DEV = 3, MIN_ROTATION = 0.5;

    const commonMarkers: { id: number; p1: { x: number; y: number }; p2: { x: number; y: number } }[] = [];

    for (const m1 of photo1Markers) {
      const m2 = photo2Markers.find(m => m.id === m1.id);
      if (m2) {
        commonMarkers.push({
          id: m1.id,
          p1: { x: m1.center.x / p1PxPerMmX, y: m1.center.y / p1PxPerMmY },
          p2: { x: m2.center.x / p2PxPerMmX, y: m2.center.y / p2PxPerMmY },
        });
      }
    }

    if (commonMarkers.length < 2) return 0;

    const angles: number[] = [];

    for (let i = 0; i < commonMarkers.length; i++) {
      for (let j = i + 1; j < commonMarkers.length; j++) {
        const m1 = commonMarkers[i];
        const m2 = commonMarkers[j];

        const v1 = { x: m2.p1.x - m1.p1.x, y: m2.p1.y - m1.p1.y };
        const v2 = { x: m2.p2.x - m1.p2.x, y: m2.p2.y - m1.p2.y };

        let angleDiff = (Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x)) * 180 / Math.PI;
        while (angleDiff > 180) angleDiff -= 360;
        while (angleDiff < -180) angleDiff += 360;

        angles.push(angleDiff);
      }
    }

    if (angles.length === 0) return 0;

    let sumSin = 0, sumCos = 0;
    for (const angle of angles) {
      sumSin += Math.sin(angle * Math.PI / 180);
      sumCos += Math.cos(angle * Math.PI / 180);
    }
    let avgAngle = Math.atan2(sumSin, sumCos) * 180 / Math.PI;

    if (angles.length > 1) {
      const variance = angles.reduce((sum, a) => {
        let diff = a - avgAngle;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        return sum + diff * diff;
      }, 0) / angles.length;
      
      if (Math.sqrt(variance) > MAX_STD_DEV) return 0;
    }

    if (Math.abs(avgAngle) < MIN_ROTATION) return 0;
    return Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, avgAngle));
  };

  const rotatePoint = (x: number, y: number, cx: number, cy: number, angleDeg: number): { x: number; y: number } => {
    const rad = angleDeg * Math.PI / 180;
    const dx = x - cx, dy = y - cy;
    return { x: cx + dx * Math.cos(rad) - dy * Math.sin(rad), y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) };
  };

  const handleCalculatePositions = useCallback(async () => {
    if (photos.length < 2) {
      toast.error("Il faut au moins 2 photos");
      return;
    }

    const matches = findMarkerMatches();
    if (matches.length === 0) {
      toast.error("Aucun marker commun trouvé");
      return;
    }

    const photosWithMarkers = photos.filter(p => p.markers.length > 0 && p.pixelsPerMm > 0);
    if (photosWithMarkers.length < 2) {
      toast.error("Au moins 2 photos doivent avoir des markers");
      return;
    }

    setIsStitching(true);

    try {
      const markerSizeNum = parseFloat(markerSize) || 100;

      const targetPixelsPerMm = Math.max(...photos.filter(p => p.pixelsPerMm > 0).map(p => p.pixelsPerMm));
      const targetPixelsPerCm = targetPixelsPerMm * 10;

      const scaleFactorsXY = photos.map(p => {
        if (p.pixelsPerMm === 0) return { scaleX: 1, scaleY: 1 };
        return { 
          scaleX: targetPixelsPerMm / (p.pixelsPerMmX || p.pixelsPerMm),
          scaleY: targetPixelsPerMm / (p.pixelsPerMmY || p.pixelsPerMm)
        };
      });

      interface PhotoTransform { x: number; y: number; rotation: number; scaleX: number; scaleY: number; }

      const photoTransforms: PhotoTransform[] = photos.map((_, i) => ({
        x: 0, y: 0, rotation: 0,
        scaleX: scaleFactorsXY[i].scaleX,
        scaleY: scaleFactorsXY[i].scaleY
      }));

      let refIndex = referencePhotoId ? photos.findIndex(p => p.id === referencePhotoId) : 0;
      if (refIndex === -1) refIndex = 0;

      const processed = new Set<number>([refIndex]);
      const queue = [refIndex];

      while (queue.length > 0) {
        const currentIdx = queue.shift()!;
        const currentPhoto = photos[currentIdx];
        const currentTransform = photoTransforms[currentIdx];

        for (let otherIdx = 0; otherIdx < photos.length; otherIdx++) {
          if (processed.has(otherIdx)) continue;

          const otherPhoto = photos[otherIdx];

          const commonMatches = matches.filter(
            m => (m.photo1Index === currentIdx && m.photo2Index === otherIdx) ||
                 (m.photo1Index === otherIdx && m.photo2Index === currentIdx)
          );

          if (commonMatches.length === 0) continue;

          let rotation = 0;
          if (autoRotation) {
            rotation = calculateRotation(
              currentPhoto.markers, otherPhoto.markers,
              currentPhoto.pixelsPerMmX, currentPhoto.pixelsPerMmY,
              otherPhoto.pixelsPerMmX, otherPhoto.pixelsPerMmY
            );
          }

          const finalRotation = autoRotation ? (currentTransform.rotation + rotation) : 0;

          let totalDxMm = 0, totalDyMm = 0;

          for (const match of commonMatches) {
            const [pos1InCurrent, pos2InOther] = match.photo1Index === currentIdx
              ? [match.pos1, match.pos2]
              : [match.pos2, match.pos1];

            const pos1Mm = { x: pos1InCurrent.x / currentPhoto.pixelsPerMmX, y: pos1InCurrent.y / currentPhoto.pixelsPerMmY };
            const pos2Mm = { x: pos2InOther.x / otherPhoto.pixelsPerMmX, y: pos2InOther.y / otherPhoto.pixelsPerMmY };

            const img = otherPhoto.transformedImage || otherPhoto.image;
            const otherCenterMm = { x: (img.width / otherPhoto.pixelsPerMmX) / 2, y: (img.height / otherPhoto.pixelsPerMmY) / 2 };

            const rotatedPos2 = rotatePoint(pos2Mm.x, pos2Mm.y, otherCenterMm.x, otherCenterMm.y, rotation);

            totalDxMm += (currentTransform.x + pos1Mm.x) - rotatedPos2.x;
            totalDyMm += (currentTransform.y + pos1Mm.y) - rotatedPos2.y;
          }

          photoTransforms[otherIdx] = {
            x: totalDxMm / commonMatches.length,
            y: totalDyMm / commonMatches.length,
            rotation: finalRotation,
            scaleX: scaleFactorsXY[otherIdx].scaleX,
            scaleY: scaleFactorsXY[otherIdx].scaleY
          };

          processed.add(otherIdx);
          queue.push(otherIdx);
        }
      }

      if (processed.size < photos.length) {
        toast.error(`${photos.length - processed.size} photo(s) non connectée(s)`);
        setIsStitching(false);
        return;
      }

      let minXmm = Infinity, minYmm = Infinity, maxXmm = -Infinity, maxYmm = -Infinity;

      for (let i = 0; i < photos.length; i++) {
        const transform = photoTransforms[i];
        const photo = photos[i];
        const img = photo.transformedImage || photo.image;
        const widthMm = img.width / photo.pixelsPerMmX;
        const heightMm = img.height / photo.pixelsPerMmY;

        const corners = [{ x: 0, y: 0 }, { x: widthMm, y: 0 }, { x: widthMm, y: heightMm }, { x: 0, y: heightMm }];
        const centerX = widthMm / 2, centerY = heightMm / 2;

        for (const corner of corners) {
          const rotated = rotatePoint(corner.x, corner.y, centerX, centerY, transform.rotation);
          minXmm = Math.min(minXmm, transform.x + rotated.x);
          minYmm = Math.min(minYmm, transform.y + rotated.y);
          maxXmm = Math.max(maxXmm, transform.x + rotated.x);
          maxYmm = Math.max(maxYmm, transform.y + rotated.y);
        }
      }

      const stitchedImages: StitchedImage[] = photos.map((photo, i) => {
        const transform = photoTransforms[i];
        const img = photo.transformedImage || photo.image;
        const widthMm = img.width / photo.pixelsPerMmX;
        const heightMm = img.height / photo.pixelsPerMmY;
        const rotatedOrigin = rotatePoint(0, 0, widthMm / 2, heightMm / 2, transform.rotation);
        
        return {
          image: img,
          imageUrl: photo.transformedUrl || photo.imageUrl,
          position: { x: transform.x + rotatedOrigin.x - minXmm, y: transform.y + rotatedOrigin.y - minYmm },
          scale: (transform.scaleX + transform.scaleY) / 2,
          scaleX: transform.scaleX,
          scaleY: transform.scaleY,
          rotation: transform.rotation,
          originalFile: photo.file,
          markers: photo.markers,
        };
      });

      setPositionResult({
        images: stitchedImages,
        pixelsPerCm: targetPixelsPerCm,
        totalWidthMm: maxXmm - minXmm,
        totalHeightMm: maxYmm - minYmm,
      });

      toast.success(`Assemblage: ${(maxXmm - minXmm).toFixed(0)}×${(maxYmm - minYmm).toFixed(0)}mm`);
      setEditMode(false);

    } catch (err) {
      console.error("Erreur:", err);
      toast.error("Erreur: " + (err as Error).message);
    } finally {
      setIsStitching(false);
    }
  }, [photos, findMarkerMatches, markerSize, referencePhotoId, autoRotation]);

  const handleConfirm = useCallback(() => {
    if (!positionResult) return;
    onStitched(positionResult.images, positionResult.pixelsPerCm);
    onClose();
  }, [positionResult, onStitched, onClose]);

  const currentPhoto = photos[currentEditIndex];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            Assemblage ArUco v4.0
            {editMode && currentPhoto && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                — Photo {currentEditIndex + 1}/{photos.length}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {editMode ? "Ajustez rotation, puis validez" : "Ajoutez vos photos avec markers ArUco"}
          </DialogDescription>
        </DialogHeader>

        {/* Mode édition */}
        {editMode && currentPhoto ? (
          <div className="flex gap-4 flex-1 overflow-hidden">
            {/* Grande préview */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="relative flex-1 bg-gray-900 rounded-lg overflow-hidden" style={{ minHeight: 400 }}>
                <canvas
                  ref={previewCanvasRef}
                  width={700}
                  height={450}
                  className={`w-full h-full ${isCropMode ? 'cursor-crosshair' : ''}`}
                  onMouseDown={handleCropMouseDown}
                  onMouseMove={handleCropMouseMove}
                  onMouseUp={handleCropMouseUp}
                  onMouseLeave={handleCropMouseUp}
                />
                
                {currentPhoto.isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}

                <div className="absolute top-2 left-2 flex gap-2">
                  {currentPhoto.markers.length > 0 && !isCropMode && (
                    <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">
                      {currentPhoto.markers.length} markers
                    </span>
                  )}
                  {currentPhoto.edit.rotation !== 0 && !isCropMode && (
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">
                      {currentPhoto.edit.rotation}°
                    </span>
                  )}
                  {currentPhoto.edit.crop && !isCropMode && (
                    <span className="bg-orange-600 text-white text-xs px-2 py-1 rounded">
                      Crop
                    </span>
                  )}
                </div>

                {/* Boutons de confirmation crop */}
                {isCropMode && cropStart && cropEnd && Math.abs(cropEnd.x - cropStart.x) > 10 && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                    <Button size="sm" variant="default" onClick={handleConfirmCrop} className="bg-orange-600 hover:bg-orange-700">
                      <Check className="h-4 w-4 mr-1" /> Valider
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelCrop}>
                      <X className="h-4 w-4 mr-1" /> Annuler
                    </Button>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-2">
                <Button variant="outline" size="sm" onClick={handlePrevPhoto} disabled={currentEditIndex === 0}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
                </Button>
                
                <div className="flex gap-1 max-w-[400px] overflow-x-auto">
                  {photos.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => setCurrentEditIndex(i)}
                      className={`w-10 h-10 rounded border-2 overflow-hidden flex-shrink-0 ${
                        i === currentEditIndex ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300'
                      }`}
                    >
                      <img src={p.transformedUrl || p.imageUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>

                <Button variant="outline" size="sm" onClick={handleNextPhoto} disabled={currentEditIndex === photos.length - 1}>
                  Suivant <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>

            {/* Panneau de contrôles */}
            <div className="w-52 flex flex-col gap-3">
              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-xs font-medium mb-2 block">Rotation</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleRotate(-90)} disabled={isCropMode}>
                    <RotateCcw className="h-4 w-4 mr-1" /> -90°
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleRotate(90)} disabled={isCropMode}>
                    <RotateCw className="h-4 w-4 mr-1" /> +90°
                  </Button>
                </div>
                <div className="text-center text-xs text-muted-foreground mt-2">
                  Actuel: {currentPhoto.edit.rotation}°
                </div>
              </div>

              {/* v4.1: Section Recadrage */}
              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-xs font-medium mb-2 block">Recadrage</Label>
                {!isCropMode ? (
                  <div className="space-y-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setIsCropMode(true)}
                    >
                      <Crop className="h-4 w-4 mr-1" /> 
                      {currentPhoto.edit.crop ? 'Modifier' : 'Recadrer'}
                    </Button>
                    {currentPhoto.edit.crop && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="w-full text-orange-600"
                        onClick={handleRemoveCrop}
                      >
                        <X className="h-4 w-4 mr-1" /> Supprimer crop
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-orange-600">
                    Dessinez un rectangle sur l'image
                  </p>
                )}
                {currentPhoto.edit.crop && !isCropMode && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Zone: {currentPhoto.edit.crop.width.toFixed(0)}% × {currentPhoto.edit.crop.height.toFixed(0)}%
                  </div>
                )}
              </div>

              <div className="p-3 bg-muted rounded-lg space-y-2">
                <Button 
                  size="sm" variant="outline" className="w-full"
                  onClick={handleApplyAndRedetect}
                  disabled={currentPhoto.isProcessing || isCropMode || (currentPhoto.edit.rotation === 0 && !currentPhoto.edit.crop)}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${currentPhoto.isProcessing ? 'animate-spin' : ''}`} />
                  Appliquer & Détecter
                </Button>
                
                <Button size="sm" variant="ghost" className="w-full" onClick={handleResetEdit} disabled={isCropMode}>
                  <X className="h-4 w-4 mr-1" /> Réinitialiser
                </Button>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-xs font-medium mb-2 block">Markers</Label>
                {currentPhoto.markers.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {currentPhoto.markers.map(m => (
                      <span key={m.id} className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                        #{m.id}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-orange-600">Aucun marker</p>
                )}
              </div>

              <Button size="sm" variant="destructive" className="w-full" onClick={() => handleRemovePhoto(currentPhoto.id)} disabled={isCropMode}>
                <Trash2 className="h-4 w-4 mr-1" /> Supprimer
              </Button>

              <div className="p-3 bg-muted rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <Switch id="autoRot" checked={autoRotation} onCheckedChange={setAutoRotation} />
                  <Label htmlFor="autoRot" className="cursor-pointer">Rotation auto</Label>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Mode liste */
          <div className="space-y-4 overflow-y-auto flex-1">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-2 rounded">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
              </div>
            )}

            {opencvError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                <AlertCircle className="h-4 w-4" /> Erreur: {opencvError}
              </div>
            )}

            {isLoaded && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                <CheckCircle2 className="h-4 w-4" /> Détecteur ArUco prêt
              </div>
            )}

            <div className="flex items-center gap-4">
              <Label className="text-sm whitespace-nowrap">Taille markers:</Label>
              <Input type="number" value={markerSize} onChange={(e) => setMarkerSize(e.target.value)} className="w-24" min="10" max="500" />
              <span className="text-sm text-muted-foreground">mm</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!isLoaded} className="flex-1">
                <Plus className="h-4 w-4 mr-2" /> Ajouter des photos
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowDebug(!showDebug)}>
                <Bug className={`h-4 w-4 ${showDebug ? "text-yellow-500" : ""}`} />
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleAddPhotos(e.target.files)} />
            </div>

            {showDebug && (
              <div className="p-3 bg-gray-900 text-green-400 font-mono text-xs rounded-lg max-h-32 overflow-y-auto">
                {debugLogs.length === 0 ? <div className="text-gray-500">Aucun log.</div> : debugLogs.map((log, i) => <div key={i} className="py-1">{log}</div>)}
              </div>
            )}

            {photos.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium flex justify-between">
                  <span>Photos ({photos.length}) - {totalMarkers} markers</span>
                  <span className="text-muted-foreground">{uniqueMatchedIds} communs</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[300px] overflow-y-auto p-1">
                  {photos.map((photo, idx) => (
                    <div 
                      key={photo.id} 
                      className={`relative rounded p-1 bg-muted/50 border cursor-pointer hover:border-blue-400 ${duplicatePhotoIds.has(photo.id) ? "border-orange-500" : ""}`}
                      onClick={() => { setCurrentEditIndex(idx); setEditMode(true); }}
                    >
                      <img src={photo.transformedUrl || photo.imageUrl} alt="" className="w-full h-24 object-cover rounded" />
                      <div className="absolute top-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">{photo.markers.length}</div>
                      {photo.isProcessing && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        </div>
                      )}
                      <button className="absolute bottom-1 right-1 p-1 bg-red-500/80 text-white rounded hover:bg-red-600" onClick={(e) => { e.stopPropagation(); handleRemovePhoto(photo.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {positionResult && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Prêt: {positionResult.totalWidthMm.toFixed(0)} × {positionResult.totalHeightMm.toFixed(0)} mm</span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 border-t pt-4">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => setEditMode(false)}>Retour</Button>
              <Button onClick={handleCalculatePositions} disabled={photos.length < 2 || isStitching || photos.some(p => p.isProcessing)}>
                {isStitching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Assembler ({photos.length})
              </Button>
            </>
          ) : (
            <>
              {photos.length > 0 && (
                <Button variant="outline" onClick={() => { setCurrentEditIndex(0); setEditMode(true); }}>
                  <Eye className="h-4 w-4 mr-2" /> Éditer
                </Button>
              )}
              {positionResult ? (
                <Button onClick={handleConfirm}>
                  <Check className="h-4 w-4 mr-2" /> Importer ({positionResult.images.length})
                </Button>
              ) : (
                <Button onClick={handleCalculatePositions} disabled={photos.length < 2 || isStitching}>
                  {isStitching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Images className="h-4 w-4 mr-2" />}
                  Calculer
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ArucoStitcher;
