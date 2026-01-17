// ============================================
// HOOK: useImageDragDrop
// Gestion du drag & drop d'images sur le canvas
// VERSION: 1.1 - Fix attachement des événements
// ============================================
// CHANGELOG:
// v1.1 - Fix: utiliser useRef pour les handlers et éviter les problèmes de timing
// v1.0 - Drag & drop d'images directement sur le canvas
// ============================================

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { BackgroundImage, Viewport } from "./types";
import { generateId } from "./types";

interface UseImageDragDropOptions {
  containerRef: React.RefObject<HTMLElement>;
  viewport: Viewport;
  imageOpacity: number;
  activeLayerId: string;
  onImagesAdded: (images: BackgroundImage[]) => void;
  setShowBackgroundImage: (show: boolean) => void;
}

export function useImageDragDrop({
  containerRef,
  viewport,
  imageOpacity,
  activeLayerId,
  onImagesAdded,
  setShowBackgroundImage,
}: UseImageDragDropOptions) {
  // Utiliser des refs pour avoir toujours les valeurs à jour dans les handlers
  const viewportRef = useRef(viewport);
  const imageOpacityRef = useRef(imageOpacity);
  const activeLayerIdRef = useRef(activeLayerId);
  const onImagesAddedRef = useRef(onImagesAdded);
  const setShowBackgroundImageRef = useRef(setShowBackgroundImage);

  // Mettre à jour les refs quand les props changent
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    imageOpacityRef.current = imageOpacity;
  }, [imageOpacity]);

  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);

  useEffect(() => {
    onImagesAddedRef.current = onImagesAdded;
  }, [onImagesAdded]);

  useEffect(() => {
    setShowBackgroundImageRef.current = setShowBackgroundImage;
  }, [setShowBackgroundImage]);

  // Traiter les fichiers images
  const processFiles = useCallback(
    (files: FileList, dropPosition?: { x: number; y: number }) => {
      const imageFiles = Array.from(files).filter((file) =>
        file.type.startsWith("image/")
      );

      if (imageFiles.length === 0) {
        toast.error("Aucune image valide détectée");
        return;
      }

      console.log("[DragDrop] Processing", imageFiles.length, "image(s)");

      const newImages: BackgroundImage[] = [];
      let loadedCount = 0;

      const vp = viewportRef.current;

      // Calculer la position pour une nouvelle image
      const getNextPosition = (currentLength: number, totalIndex: number) => {
        const centerX = (vp.width / 2 - vp.offsetX) / vp.scale;
        const centerY = (vp.height / 2 - vp.offsetY) / vp.scale;
        const offset = 150;
        const angle = ((currentLength + totalIndex) * 60 * Math.PI) / 180;
        const radius = offset * (Math.floor((currentLength + totalIndex) / 6) + 1);
        return {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        };
      };

      // Si on a une position de drop, l'utiliser pour la première image
      const getImagePosition = (index: number, currentLength: number) => {
        if (dropPosition && index === 0) {
          return {
            x: (dropPosition.x - vp.offsetX) / vp.scale,
            y: (dropPosition.y - vp.offsetY) / vp.scale,
          };
        }
        return getNextPosition(currentLength, index);
      };

      imageFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const position = getImagePosition(index, newImages.length);

            const newImage: BackgroundImage = {
              id: generateId(),
              name: file.name,
              image: img,
              src: img.src,
              x: position.x,
              y: position.y,
              scale: 1,
              opacity: imageOpacityRef.current,
              visible: true,
              locked: false,
              order: newImages.length + index,
              markers: [],
              layerId: activeLayerIdRef.current,
            };

            newImages.push(newImage);
            loadedCount++;

            // Quand toutes les images sont chargées
            if (loadedCount === imageFiles.length) {
              console.log("[DragDrop] All images loaded, adding to canvas");
              onImagesAddedRef.current(newImages);
              setShowBackgroundImageRef.current(true);
              toast.success(
                imageFiles.length === 1
                  ? "Image déposée !"
                  : `${imageFiles.length} images déposées !`
              );
            }
          };
          img.onerror = () => {
            loadedCount++;
            toast.error(`Erreur lors du chargement de ${file.name}`);
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    },
    []
  );

  // Attacher les event listeners - une seule fois quand le container est disponible
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      console.log("[DragDrop] Container not ready yet");
      return;
    }

    console.log("[DragDrop] Attaching drag & drop listeners to container");

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      console.log("[DragDrop] Drop event received");

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const rect = container.getBoundingClientRect();
        const dropPosition = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        console.log("[DragDrop] Drop position:", dropPosition);
        processFiles(files, dropPosition);
      }
    };

    container.addEventListener("dragenter", handleDragEnter);
    container.addEventListener("dragleave", handleDragLeave);
    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("drop", handleDrop);

    return () => {
      console.log("[DragDrop] Removing drag & drop listeners");
      container.removeEventListener("dragenter", handleDragEnter);
      container.removeEventListener("dragleave", handleDragLeave);
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("drop", handleDrop);
    };
  }, [containerRef.current, processFiles]);

  return { processFiles };
}

export default useImageDragDrop;
