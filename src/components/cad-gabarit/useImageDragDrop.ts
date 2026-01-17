// ============================================
// HOOK: useImageDragDrop
// Gestion du drag & drop d'images sur le canvas
// VERSION: 1.0
// ============================================
// CHANGELOG:
// v1.0 - Drag & drop d'images directement sur le canvas
// ============================================

import { useCallback, useEffect, useState } from "react";
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

interface DragDropState {
  isDraggingOver: boolean;
  dragCounter: number;
}

export function useImageDragDrop({
  containerRef,
  viewport,
  imageOpacity,
  activeLayerId,
  onImagesAdded,
  setShowBackgroundImage,
}: UseImageDragDropOptions) {
  const [state, setState] = useState<DragDropState>({
    isDraggingOver: false,
    dragCounter: 0,
  });

  // Calculer la position pour une nouvelle image
  const getNextPosition = useCallback(
    (currentLength: number, totalIndex: number) => {
      // Centre visible du canvas en coordonnées monde
      const centerX = (viewport.width / 2 - viewport.offsetX) / viewport.scale;
      const centerY = (viewport.height / 2 - viewport.offsetY) / viewport.scale;

      // Décalage en spirale pour éviter superposition
      const offset = 150;
      const angle = ((currentLength + totalIndex) * 60 * Math.PI) / 180;
      const radius = offset * (Math.floor((currentLength + totalIndex) / 6) + 1);

      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    },
    [viewport]
  );

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

      const newImages: BackgroundImage[] = [];
      let loadedCount = 0;

      // Si on a une position de drop, l'utiliser pour la première image
      const getImagePosition = (index: number, currentLength: number) => {
        if (dropPosition && index === 0) {
          // Convertir la position écran en coordonnées monde
          return {
            x: (dropPosition.x - viewport.offsetX) / viewport.scale,
            y: (dropPosition.y - viewport.offsetY) / viewport.scale,
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
              opacity: imageOpacity,
              visible: true,
              locked: false,
              order: newImages.length + index,
              markers: [],
              layerId: activeLayerId,
            };

            newImages.push(newImage);
            loadedCount++;

            // Quand toutes les images sont chargées
            if (loadedCount === imageFiles.length) {
              onImagesAdded(newImages);
              setShowBackgroundImage(true);
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
    [viewport, imageOpacity, activeLayerId, getNextPosition, onImagesAdded, setShowBackgroundImage]
  );

  // Handlers pour le drag & drop
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setState((prev) => ({
      ...prev,
      dragCounter: prev.dragCounter + 1,
      isDraggingOver: true,
    }));
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setState((prev) => {
      const newCounter = prev.dragCounter - 1;
      return {
        ...prev,
        dragCounter: newCounter,
        isDraggingOver: newCounter > 0,
      };
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Indiquer qu'on accepte le drop
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setState({
        isDraggingOver: false,
        dragCounter: 0,
      });

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        // Obtenir la position du drop relative au container
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const dropPosition = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          };
          processFiles(files, dropPosition);
        } else {
          processFiles(files);
        }
      }
    },
    [containerRef, processFiles]
  );

  // Attacher les event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("dragenter", handleDragEnter);
    container.addEventListener("dragleave", handleDragLeave);
    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("drop", handleDrop);

    return () => {
      container.removeEventListener("dragenter", handleDragEnter);
      container.removeEventListener("dragleave", handleDragLeave);
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("drop", handleDrop);
    };
  }, [containerRef, handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return {
    isDraggingOver: state.isDraggingOver,
    processFiles, // Pour permettre l'utilisation programmatique
  };
}

export default useImageDragDrop;
