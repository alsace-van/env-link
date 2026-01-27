// ============================================
// HOOK: useImageManagement
// VERSION: 1.0
// Description: Gestion des images de fond, drag/drop, calibration, opacité
// Extrait de CADGabaritCanvas.tsx pour alléger le fichier principal
// ============================================

import { useState, useCallback, useRef, useEffect } from "react";
import type { BackgroundImage, ImageMarkerLink } from "./types";
import { generateId } from "./types";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

export interface ImageDragState {
  x: number;
  y: number;
  imgX: number;
  imgY: number;
}

export interface MarkerDragState {
  imageId: string;
  markerId: string;
  startPos: { x: number; y: number };
}

export interface LinkDistanceDialogState {
  open: boolean;
  marker1: { imageId: string; markerId: string };
  marker2: { imageId: string; markerId: string };
  distance: string;
}

export interface StretchingHandleState {
  imageId: string;
  handle: "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  startX: number;
  startY: number;
  startScaleX: number;
  startScaleY: number;
  startImgX: number;
  startImgY: number;
}

export interface StretchKeyIndicator {
  action: "X" | "Y" | "XY" | "reset" | "equalize";
  direction: "+" | "-" | "";
}

export interface CropSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropDragHandle = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | null;
export type MarkerMode = "idle" | "addMarker" | "linkMarker1" | "linkMarker2";

export interface UseImageManagementProps {
  addToImageHistory?: (images: BackgroundImage[], links: ImageMarkerLink[]) => void;
}

export interface UseImageManagementReturn {
  // Images de fond
  backgroundImages: BackgroundImage[];
  setBackgroundImages: React.Dispatch<React.SetStateAction<BackgroundImage[]>>;
  backgroundImagesRef: React.MutableRefObject<BackgroundImage[]>;
  
  // Sélection d'images
  selectedImageId: string | null;
  setSelectedImageId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedImageIds: Set<string>;
  setSelectedImageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedImageIdRef: React.MutableRefObject<string | null>;
  
  // Drag d'images
  isDraggingImage: boolean;
  setIsDraggingImage: React.Dispatch<React.SetStateAction<boolean>>;
  imageDragStart: ImageDragState | null;
  setImageDragStart: React.Dispatch<React.SetStateAction<ImageDragState | null>>;
  
  // Opacité
  imageOpacity: number;
  setImageOpacity: React.Dispatch<React.SetStateAction<number>>;
  showBackgroundImage: boolean;
  setShowBackgroundImage: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Marqueurs
  markerLinks: ImageMarkerLink[];
  setMarkerLinks: React.Dispatch<React.SetStateAction<ImageMarkerLink[]>>;
  markerLinksRef: React.MutableRefObject<ImageMarkerLink[]>;
  markerMode: MarkerMode;
  setMarkerMode: React.Dispatch<React.SetStateAction<MarkerMode>>;
  pendingLink: { imageId: string; markerId: string } | null;
  setPendingLink: React.Dispatch<React.SetStateAction<{ imageId: string; markerId: string } | null>>;
  linkDistanceDialog: LinkDistanceDialogState | null;
  setLinkDistanceDialog: React.Dispatch<React.SetStateAction<LinkDistanceDialogState | null>>;
  selectedMarkerId: string | null;
  setSelectedMarkerId: React.Dispatch<React.SetStateAction<string | null>>;
  draggingMarker: MarkerDragState | null;
  setDraggingMarker: React.Dispatch<React.SetStateAction<MarkerDragState | null>>;
  
  // Crop
  cropMode: boolean;
  setCropMode: React.Dispatch<React.SetStateAction<boolean>>;
  showCropDialog: boolean;
  setShowCropDialog: React.Dispatch<React.SetStateAction<boolean>>;
  cropSelection: CropSelection;
  setCropSelection: React.Dispatch<React.SetStateAction<CropSelection>>;
  cropPanelPos: { x: number; y: number };
  setCropPanelPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  cropDragging: CropDragHandle;
  setCropDragging: React.Dispatch<React.SetStateAction<CropDragHandle>>;
  
  // Stretch mode
  stretchMode: boolean;
  setStretchMode: React.Dispatch<React.SetStateAction<boolean>>;
  stretchModeRef: React.MutableRefObject<boolean>;
  stretchingHandle: StretchingHandleState | null;
  setStretchingHandle: React.Dispatch<React.SetStateAction<StretchingHandleState | null>>;
  stretchKeyIndicator: StretchKeyIndicator | null;
  setStretchKeyIndicator: React.Dispatch<React.SetStateAction<StretchKeyIndicator | null>>;
  stretchHistorySavedRef: React.MutableRefObject<boolean>;
  
  // Calibration
  showCalibrationRulerGenerator: boolean;
  setShowCalibrationRulerGenerator: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Fonctions
  addImage: (image: BackgroundImage) => void;
  removeImage: (imageId: string) => void;
  updateImage: (imageId: string, updates: Partial<BackgroundImage>) => void;
  moveImageUp: (imageId: string) => void;
  moveImageDown: (imageId: string) => void;
  selectImage: (imageId: string, addToSelection?: boolean) => void;
  deselectAllImages: () => void;
  addMarkerToImage: (imageId: string, x: number, y: number) => string;
  removeMarker: (imageId: string, markerId: string) => void;
  createMarkerLink: (marker1: { imageId: string; markerId: string }, marker2: { imageId: string; markerId: string }, distance: number) => void;
  removeMarkerLink: (linkId: string) => void;
  getSelectedImage: () => BackgroundImage | null;
  hasImages: boolean;
  imageCount: number;
}

// ============================================
// HOOK
// ============================================

export function useImageManagement({
  addToImageHistory,
}: UseImageManagementProps = {}): UseImageManagementReturn {
  
  // === Images de fond ===
  const [backgroundImages, setBackgroundImages] = useState<BackgroundImage[]>([]);
  const backgroundImagesRef = useRef<BackgroundImage[]>([]);
  
  // === Sélection d'images ===
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const selectedImageIdRef = useRef<string | null>(null);
  
  // === Drag d'images ===
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [imageDragStart, setImageDragStart] = useState<ImageDragState | null>(null);
  
  // === Opacité ===
  const [imageOpacity, setImageOpacity] = useState(0.5);
  const [showBackgroundImage, setShowBackgroundImage] = useState(true);
  
  // === Marqueurs ===
  const [markerLinks, setMarkerLinks] = useState<ImageMarkerLink[]>([]);
  const markerLinksRef = useRef<ImageMarkerLink[]>([]);
  const [markerMode, setMarkerMode] = useState<MarkerMode>("idle");
  const [pendingLink, setPendingLink] = useState<{ imageId: string; markerId: string } | null>(null);
  const [linkDistanceDialog, setLinkDistanceDialog] = useState<LinkDistanceDialogState | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [draggingMarker, setDraggingMarker] = useState<MarkerDragState | null>(null);
  
  // === Crop ===
  const [cropMode, setCropMode] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [cropSelection, setCropSelection] = useState<CropSelection>({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const [cropPanelPos, setCropPanelPos] = useState({ x: 100, y: 100 });
  const [cropDragging, setCropDragging] = useState<CropDragHandle>(null);
  
  // === Stretch mode ===
  const [stretchMode, setStretchMode] = useState(false);
  const stretchModeRef = useRef(false);
  const [stretchingHandle, setStretchingHandle] = useState<StretchingHandleState | null>(null);
  const [stretchKeyIndicator, setStretchKeyIndicator] = useState<StretchKeyIndicator | null>(null);
  const stretchHistorySavedRef = useRef(false);
  
  // === Calibration ===
  const [showCalibrationRulerGenerator, setShowCalibrationRulerGenerator] = useState(false);
  
  // === Synchronisation des refs ===
  useEffect(() => {
    backgroundImagesRef.current = backgroundImages;
  }, [backgroundImages]);
  
  useEffect(() => {
    markerLinksRef.current = markerLinks;
  }, [markerLinks]);
  
  useEffect(() => {
    stretchModeRef.current = stretchMode;
  }, [stretchMode]);
  
  useEffect(() => {
    selectedImageIdRef.current = selectedImageId;
  }, [selectedImageId]);
  
  // === Fonctions ===
  
  const addImage = useCallback((image: BackgroundImage) => {
    setBackgroundImages(prev => [...prev, image]);
    setSelectedImageId(image.id);
    setSelectedImageIds(new Set([image.id]));
  }, []);
  
  const removeImage = useCallback((imageId: string) => {
    // Sauvegarder pour undo
    if (addToImageHistory) {
      addToImageHistory(backgroundImagesRef.current, markerLinksRef.current);
    }
    
    setBackgroundImages(prev => prev.filter(img => img.id !== imageId));
    setMarkerLinks(prev => prev.filter(link => 
      link.marker1.imageId !== imageId && link.marker2.imageId !== imageId
    ));
    
    if (selectedImageId === imageId) {
      setSelectedImageId(null);
    }
    setSelectedImageIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
    
    toast.success("Image supprimée");
  }, [selectedImageId, addToImageHistory]);
  
  const updateImage = useCallback((imageId: string, updates: Partial<BackgroundImage>) => {
    setBackgroundImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, ...updates } : img
    ));
  }, []);
  
  const moveImageUp = useCallback((imageId: string) => {
    setBackgroundImages(prev => {
      const idx = prev.findIndex(img => img.id === imageId);
      if (idx <= 0) return prev;
      const newArr = [...prev];
      [newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]];
      return newArr;
    });
  }, []);
  
  const moveImageDown = useCallback((imageId: string) => {
    setBackgroundImages(prev => {
      const idx = prev.findIndex(img => img.id === imageId);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const newArr = [...prev];
      [newArr[idx], newArr[idx + 1]] = [newArr[idx + 1], newArr[idx]];
      return newArr;
    });
  }, []);
  
  const selectImage = useCallback((imageId: string, addToSelection: boolean = false) => {
    setSelectedImageId(imageId);
    if (addToSelection) {
      setSelectedImageIds(prev => {
        const newSet = new Set(prev);
        newSet.add(imageId);
        return newSet;
      });
    } else {
      setSelectedImageIds(new Set([imageId]));
    }
  }, []);
  
  const deselectAllImages = useCallback(() => {
    setSelectedImageId(null);
    setSelectedImageIds(new Set());
  }, []);
  
  const addMarkerToImage = useCallback((imageId: string, x: number, y: number): string => {
    const markerId = generateId();
    
    setBackgroundImages(prev => prev.map(img => {
      if (img.id !== imageId) return img;
      
      const markers = img.markers || [];
      return {
        ...img,
        markers: [...markers, { id: markerId, x, y, label: `M${markers.length + 1}` }],
      };
    }));
    
    return markerId;
  }, []);
  
  const removeMarker = useCallback((imageId: string, markerId: string) => {
    setBackgroundImages(prev => prev.map(img => {
      if (img.id !== imageId) return img;
      return {
        ...img,
        markers: (img.markers || []).filter(m => m.id !== markerId),
      };
    }));
    
    // Supprimer les liens associés
    setMarkerLinks(prev => prev.filter(link =>
      !(link.marker1.imageId === imageId && link.marker1.markerId === markerId) &&
      !(link.marker2.imageId === imageId && link.marker2.markerId === markerId)
    ));
    
    if (selectedMarkerId === `${imageId}:${markerId}`) {
      setSelectedMarkerId(null);
    }
  }, [selectedMarkerId]);
  
  const createMarkerLink = useCallback((
    marker1: { imageId: string; markerId: string },
    marker2: { imageId: string; markerId: string },
    distance: number
  ) => {
    const linkId = generateId();
    
    setMarkerLinks(prev => [...prev, {
      id: linkId,
      marker1,
      marker2,
      distance,
    }]);
    
    toast.success(`Lien créé: ${distance}mm`);
  }, []);
  
  const removeMarkerLink = useCallback((linkId: string) => {
    setMarkerLinks(prev => prev.filter(link => link.id !== linkId));
  }, []);
  
  const getSelectedImage = useCallback((): BackgroundImage | null => {
    if (!selectedImageId) return null;
    return backgroundImages.find(img => img.id === selectedImageId) || null;
  }, [selectedImageId, backgroundImages]);
  
  const hasImages = backgroundImages.length > 0;
  const imageCount = backgroundImages.length;
  
  return {
    // Images de fond
    backgroundImages,
    setBackgroundImages,
    backgroundImagesRef,
    
    // Sélection d'images
    selectedImageId,
    setSelectedImageId,
    selectedImageIds,
    setSelectedImageIds,
    selectedImageIdRef,
    
    // Drag d'images
    isDraggingImage,
    setIsDraggingImage,
    imageDragStart,
    setImageDragStart,
    
    // Opacité
    imageOpacity,
    setImageOpacity,
    showBackgroundImage,
    setShowBackgroundImage,
    
    // Marqueurs
    markerLinks,
    setMarkerLinks,
    markerLinksRef,
    markerMode,
    setMarkerMode,
    pendingLink,
    setPendingLink,
    linkDistanceDialog,
    setLinkDistanceDialog,
    selectedMarkerId,
    setSelectedMarkerId,
    draggingMarker,
    setDraggingMarker,
    
    // Crop
    cropMode,
    setCropMode,
    showCropDialog,
    setShowCropDialog,
    cropSelection,
    setCropSelection,
    cropPanelPos,
    setCropPanelPos,
    cropDragging,
    setCropDragging,
    
    // Stretch mode
    stretchMode,
    setStretchMode,
    stretchModeRef,
    stretchingHandle,
    setStretchingHandle,
    stretchKeyIndicator,
    setStretchKeyIndicator,
    stretchHistorySavedRef,
    
    // Calibration
    showCalibrationRulerGenerator,
    setShowCalibrationRulerGenerator,
    
    // Fonctions
    addImage,
    removeImage,
    updateImage,
    moveImageUp,
    moveImageDown,
    selectImage,
    deselectAllImages,
    addMarkerToImage,
    removeMarker,
    createMarkerLink,
    removeMarkerLink,
    getSelectedImage,
    hasImages,
    imageCount,
  };
}

export default useImageManagement;
