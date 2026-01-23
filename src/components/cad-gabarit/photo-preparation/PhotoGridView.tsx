// ============================================
// COMPOSANT: PhotoGridView
// Vue grille des photos avec détection des doublons
// VERSION: 1.0.0
// ============================================
//
// Changelog (3 dernières versions) :
// - v1.0.0 (2025-01-23) : Création initiale
//
// Historique complet : voir REFACTORING_PHOTO_PREPARATION.md
// ============================================

import React, { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Trash2,
  AlertTriangle,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { PhotoToProcess } from "./types";
import { useDuplicateDetection } from "./useDuplicateDetection";

interface PhotoGridViewProps {
  photos: PhotoToProcess[];
  onPhotoClick: (index: number) => void;
  onRemovePhoto: (photoId: string) => void;
  onRemoveDuplicates: () => void;
  onAddPhotos: (files: FileList) => void;
  onStartPreparation: () => void;
}

export const PhotoGridView: React.FC<PhotoGridViewProps> = ({
  photos,
  onPhotoClick,
  onRemovePhoto,
  onRemoveDuplicates,
  onAddPhotos,
  onStartPreparation,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { duplicateGroups, duplicateCount, isDuplicate, getOriginalOf } =
    useDuplicateDetection(photos);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onAddPhotos(e.target.files);
        e.target.value = ""; // Reset pour permettre de re-sélectionner
      }
    },
    [onAddPhotos]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onAddPhotos(e.dataTransfer.files);
      }
    },
    [onAddPhotos]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const validPhotosCount = photos.filter(
    (p) => p.image && !isDuplicate(p.id)
  ).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Photos à préparer</h2>
          <Badge variant="secondary">{photos.length} photo(s)</Badge>
          {duplicateCount > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {duplicateCount} doublon(s)
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {duplicateCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRemoveDuplicates}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Supprimer les doublons
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* Grille de photos */}
      <ScrollArea className="flex-1 p-4">
        {photos.length === 0 ? (
          // Zone de drop vide
          <div
            className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <ImageIcon className="h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-600 font-medium">
              Glissez vos photos ici
            </p>
            <p className="text-gray-400 text-sm mt-1">
              ou cliquez pour sélectionner
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {photos.map((photo, index) => (
              <PhotoGridItem
                key={photo.id}
                photo={photo}
                index={index}
                isDuplicate={isDuplicate(photo.id)}
                originalPhoto={getOriginalOf(photo.id)}
                onClick={() => onPhotoClick(index)}
                onRemove={() => onRemovePhoto(photo.id)}
              />
            ))}
            
            {/* Bouton ajouter plus */}
            <div
              className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-gray-400" />
              <span className="text-xs text-gray-500 mt-1">Ajouter</span>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Footer avec bouton continuer */}
      {photos.length > 0 && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {validPhotosCount} photo(s) prête(s) pour la préparation
              {duplicateCount > 0 && (
                <span className="text-red-500 ml-2">
                  ({duplicateCount} doublon(s) à supprimer)
                </span>
              )}
            </p>
            
            <Button
              onClick={onStartPreparation}
              disabled={validPhotosCount === 0}
              className="gap-2"
            >
              Commencer la préparation
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// === SOUS-COMPOSANT : Item de la grille ===

interface PhotoGridItemProps {
  photo: PhotoToProcess;
  index: number;
  isDuplicate: boolean;
  originalPhoto: PhotoToProcess | null;
  onClick: () => void;
  onRemove: () => void;
}

const PhotoGridItem: React.FC<PhotoGridItemProps> = ({
  photo,
  index,
  isDuplicate,
  originalPhoto,
  onClick,
  onRemove,
}) => {
  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove();
    },
    [onRemove]
  );

  // Statut visuel
  const statusIcon = photo.status === "validated" ? (
    <CheckCircle2 className="h-5 w-5 text-green-500" />
  ) : photo.status === "skipped" ? (
    <XCircle className="h-5 w-5 text-gray-400" />
  ) : null;

  return (
    <div
      className={`
        relative aspect-square rounded-lg overflow-hidden cursor-pointer
        border-2 transition-all group
        ${isDuplicate
          ? "border-red-400 bg-red-50"
          : photo.status === "validated"
          ? "border-green-400"
          : "border-gray-200 hover:border-blue-400"
        }
      `}
      onClick={onClick}
    >
      {/* Image */}
      {photo.imageDataUrl ? (
        <img
          src={photo.imageDataUrl}
          alt={photo.name}
          className={`
            w-full h-full object-cover
            ${isDuplicate ? "opacity-50" : ""}
          `}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <ImageIcon className="h-8 w-8 text-gray-400" />
        </div>
      )}

      {/* Overlay de chargement */}
      {!photo.image && photo.imageDataUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Badge doublon */}
      {isDuplicate && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/20">
          <AlertTriangle className="h-8 w-8 text-red-600" />
          <span className="text-xs font-medium text-red-700 mt-1 bg-white/80 px-2 py-0.5 rounded">
            Doublon
          </span>
          {originalPhoto && (
            <span className="text-[10px] text-red-600 mt-0.5">
              de "{originalPhoto.name}"
            </span>
          )}
        </div>
      )}

      {/* Bouton supprimer */}
      <button
        className={`
          absolute top-2 right-2 p-1.5 rounded-full
          transition-opacity
          ${isDuplicate
            ? "bg-red-500 text-white opacity-100"
            : "bg-black/50 text-white opacity-0 group-hover:opacity-100"
          }
        `}
        onClick={handleRemoveClick}
        title="Supprimer"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {/* Index */}
      <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
        {index + 1}
      </div>

      {/* Statut */}
      {statusIcon && (
        <div className="absolute bottom-2 right-2">
          {statusIcon}
        </div>
      )}

      {/* Nom du fichier */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
        <p className="text-white text-xs truncate" title={photo.name}>
          {photo.name}
        </p>
        {photo.originalWidth > 0 && (
          <p className="text-white/70 text-[10px]">
            {photo.originalWidth} × {photo.originalHeight}
          </p>
        )}
      </div>
    </div>
  );
};

export default PhotoGridView;
