// ============================================
// COMPOSANT: PhotoPreparationModal
// Modale principale orchestrant la préparation des photos
// VERSION: 1.0.0
// ============================================
//
// Changelog (3 dernières versions) :
// - v1.0.0 (2025-01-23) : Création initiale
//
// Historique complet : voir REFACTORING_PHOTO_PREPARATION.md
// ============================================

import React, { useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  SkipForward,
  Clock,
  ArrowRight,
  X,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { usePhotoPreparation } from "./usePhotoPreparation";
import { PhotoGridView } from "./PhotoGridView";
import { PhotoPreviewEditor } from "./PhotoPreviewEditor";
import { PreparedPhoto } from "./types";

interface PhotoPreparationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (photos: PreparedPhoto[]) => void;
  initialScaleFactor?: number;
}

export const PhotoPreparationModal: React.FC<PhotoPreparationModalProps> = ({
  isOpen,
  onClose,
  onImport,
  initialScaleFactor = 1,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const {
    state,
    currentPhoto,
    setStep,
    goToPhoto,
    nextPhoto,
    prevPhoto,
    addPhotos,
    removePhoto,
    removeDuplicates,
    rotatePhoto,
    setCrop,
    setStretch,
    adjustStretchX,
    adjustStretchY,
    validatePhoto,
    skipPhoto,
    setActiveTool,
    addMeasurePoint,
    removeMeasurement,
    clearMeasurements,
    calculateDistanceMm,
    getDimensionsMm,
    getValidatedPhotos,
    prepareForExport,
    handleKeyDown,
  } = usePhotoPreparation();

  // Bloquer le wheel globalement quand la modale est ouverte en mode preview
  // pour éviter les conflits avec le canvas principal de CAD
  useEffect(() => {
    if (!isOpen) return;

    const blockGlobalWheel = (e: WheelEvent) => {
      // Bloquer le wheel au niveau du document pour empêcher
      // tout comportement indésirable du canvas CAD derrière
      const modal = modalRef.current;
      if (modal && modal.contains(e.target as Node)) {
        // L'événement est dans la modale, ne pas bloquer ici
        // (le composant enfant gère le zoom)
        return;
      }
      // Bloquer les événements wheel en dehors de la modale
      e.preventDefault();
      e.stopPropagation();
    };

    // Note: on n'ajoute plus le listener keydown ici car PhotoPreviewEditor
    // a déjà son propre handler qui fonctionne mieux

    document.addEventListener("wheel", blockGlobalWheel, { passive: false, capture: true });
    
    return () => {
      document.removeEventListener("wheel", blockGlobalWheel, { capture: true });
    };
  }, [isOpen]);

  // Commencer la préparation (passer à la preview)
  const handleStartPreparation = useCallback(() => {
    const validPhotos = state.photos.filter(
      (p) => p.image && !p.isDuplicate
    );
    
    if (validPhotos.length === 0) {
      toast.error("Aucune photo valide à préparer");
      return;
    }
    
    // Trouver le premier index valide
    const firstValidIndex = state.photos.findIndex(
      (p) => p.image && !p.isDuplicate
    );
    
    goToPhoto(firstValidIndex);
    setStep("preview");
  }, [state.photos, goToPhoto, setStep]);

  // Passer au résumé
  const handleGoToSummary = useCallback(() => {
    setStep("summary");
  }, [setStep]);

  // Valider et passer à la suivante (ou au résumé si c'est la dernière)
  const handleValidatePhoto = useCallback(() => {
    validatePhoto();
    
    // Vérifier s'il reste des photos à traiter
    const remainingPhotos = state.photos.filter(
      (p, i) => i > state.currentPhotoIndex && p.image && !p.isDuplicate && p.status === "pending"
    );
    
    if (remainingPhotos.length === 0) {
      // Toutes les photos ont été traitées
      setStep("summary");
    }
  }, [validatePhoto, state.photos, state.currentPhotoIndex, setStep]);

  // Mettre à jour une photo
  const handleUpdatePhoto = useCallback(
    (updates: Partial<typeof currentPhoto>) => {
      if (!currentPhoto) return;
      
      // Le hook usePhotoPreparation a une action UPDATE_PHOTO
      // On doit l'appeler via dispatch, mais comme on n'expose pas dispatch,
      // on utilise les setters individuels si nécessaire
      
      if (updates.arucoDetected !== undefined || updates.arucoScaleX !== undefined || updates.arucoScaleY !== undefined) {
        // Ces updates sont gérés par le hook via SET_ARUCO_RESULT
        // Pour l'instant on ne fait rien car useArucoDetection les gère dans PhotoPreviewEditor
      }
    },
    [currentPhoto]
  );

  // Finaliser l'import
  const handleFinalImport = useCallback(async () => {
    const validatedPhotos = getValidatedPhotos();
    
    if (validatedPhotos.length === 0) {
      toast.error("Aucune photo validée à importer");
      return;
    }
    
    toast.loading("Préparation des photos...", { id: "export" });
    
    try {
      const preparedPhotos = await prepareForExport();
      toast.success(`${preparedPhotos.length} photo(s) prête(s) à importer`, { id: "export" });
      onImport(preparedPhotos);
      onClose();
    } catch (error) {
      console.error("Erreur export:", error);
      toast.error("Erreur lors de la préparation", { id: "export" });
    }
  }, [getValidatedPhotos, prepareForExport, onImport, onClose]);

  // Retour à la grille
  const handleBackToGrid = useCallback(() => {
    setStep("grid");
  }, [setStep]);

  // Render selon l'étape
  const renderContent = () => {
    switch (state.step) {
      case "grid":
        return (
          <PhotoGridView
            photos={state.photos}
            onPhotoClick={(index) => {
              goToPhoto(index);
              setStep("preview");
            }}
            onRemovePhoto={removePhoto}
            onRemoveDuplicates={removeDuplicates}
            onAddPhotos={(files) => addPhotos(files)}
            onStartPreparation={handleStartPreparation}
          />
        );

      case "preview":
        if (!currentPhoto) {
          return (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Aucune photo sélectionnée</p>
            </div>
          );
        }
        
        return (
          <PhotoPreviewEditor
            photo={currentPhoto}
            photoIndex={state.currentPhotoIndex}
            totalPhotos={state.photos.filter((p) => p.image && !p.isDuplicate).length}
            measurements={state.currentMeasurements}
            pendingMeasurePoint={state.pendingMeasurePoint}
            activeTool={state.activeTool}
            scaleFactor={state.scaleFactor}
            onRotate={rotatePhoto}
            onSetCrop={setCrop}
            onSetStretch={setStretch}
            onAdjustStretchX={adjustStretchX}
            onAdjustStretchY={adjustStretchY}
            onSetActiveTool={setActiveTool}
            onAddMeasurePoint={addMeasurePoint}
            onRemoveMeasurement={removeMeasurement}
            onClearMeasurements={clearMeasurements}
            onUpdatePhoto={handleUpdatePhoto}
            onPrev={prevPhoto}
            onNext={nextPhoto}
            onValidate={handleValidatePhoto}
            onSkip={skipPhoto}
            onBackToGrid={handleBackToGrid}
            onClose={onClose}
            getDimensionsMm={getDimensionsMm}
            calculateDistanceMm={calculateDistanceMm}
          />
        );

      case "summary":
        return (
          <SummaryView
            photos={state.photos}
            onBack={() => setStep("grid")}
            onEditPhoto={(index) => {
              goToPhoto(index);
              setStep("preview");
            }}
            onImport={handleFinalImport}
            getDimensionsMm={getDimensionsMm}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[95vw] w-[1400px] p-0 flex flex-col overflow-hidden [&>button.absolute]:hidden"
        style={{ height: "90vh", minHeight: 0 }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onWheel={(e) => {
          // Bloquer le wheel sur toute la modale pour éviter les effets de bord
          e.stopPropagation();
        }}
      >
        {/* Header minimal pour grid et summary */}
        {state.step !== "preview" && (
          <DialogHeader className="p-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Préparation des photos
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
        )}
        
        {/* Contenu principal - DOIT avoir h-full pour propager la hauteur */}
        <div className="flex-1 overflow-hidden min-h-0 h-full">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// === SOUS-COMPOSANT: Vue Résumé ===

interface SummaryViewProps {
  photos: ReturnType<typeof usePhotoPreparation>["state"]["photos"];
  onBack: () => void;
  onEditPhoto: (index: number) => void;
  onImport: () => void;
  getDimensionsMm: ReturnType<typeof usePhotoPreparation>["getDimensionsMm"];
}

const SummaryView: React.FC<SummaryViewProps> = ({
  photos,
  onBack,
  onEditPhoto,
  onImport,
  getDimensionsMm,
}) => {
  const validatedPhotos = photos.filter((p) => p.status === "validated");
  const skippedPhotos = photos.filter((p) => p.status === "skipped");
  const pendingPhotos = photos.filter((p) => p.status === "pending" && p.image && !p.isDuplicate);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold">Résumé de la préparation</h2>
        <p className="text-sm text-gray-600">
          Vérifiez les photos avant de les importer dans le canvas
        </p>
      </div>

      {/* Liste des photos */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {photos
            .filter((p) => p.image && !p.isDuplicate)
            .map((photo, index) => {
              const dims = getDimensionsMm(photo);
              const originalIndex = photos.findIndex((p) => p.id === photo.id);
              
              return (
                <div
                  key={photo.id}
                  className={`
                    flex items-center gap-4 p-3 rounded-lg border
                    ${photo.status === "validated"
                      ? "bg-green-50 border-green-200"
                      : photo.status === "skipped"
                      ? "bg-gray-50 border-gray-200"
                      : "bg-yellow-50 border-yellow-200"
                    }
                  `}
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded overflow-hidden bg-gray-200 shrink-0">
                    {photo.imageDataUrl && (
                      <img
                        src={photo.imageDataUrl}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{photo.name}</p>
                    <p className="text-sm text-gray-600">
                      {dims.widthMm.toFixed(1)} × {dims.heightMm.toFixed(1)} mm
                    </p>
                    {photo.rotation !== 0 && (
                      <p className="text-xs text-gray-500">
                        Rotation: {photo.rotation}°
                      </p>
                    )}
                  </div>

                  {/* Statut */}
                  <div className="shrink-0">
                    {photo.status === "validated" ? (
                      <Badge className="bg-green-500">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Validée
                      </Badge>
                    ) : photo.status === "skipped" ? (
                      <Badge variant="secondary">
                        <SkipForward className="h-3 w-3 mr-1" />
                        Passée
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-yellow-400 text-yellow-700">
                        <Clock className="h-3 w-3 mr-1" />
                        En attente
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditPhoto(originalIndex)}
                  >
                    Modifier
                  </Button>
                </div>
              );
            })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-green-600 font-medium">
              {validatedPhotos.length} validée(s)
            </span>
            {skippedPhotos.length > 0 && (
              <span className="text-gray-500">
                {skippedPhotos.length} passée(s)
              </span>
            )}
            {pendingPhotos.length > 0 && (
              <span className="text-yellow-600">
                {pendingPhotos.length} en attente
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onBack}>
              Retour
            </Button>
            <Button
              onClick={onImport}
              disabled={validatedPhotos.length === 0}
              className="gap-2"
            >
              Importer {validatedPhotos.length} photo(s)
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoPreparationModal;
