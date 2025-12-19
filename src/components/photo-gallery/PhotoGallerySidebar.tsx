// ============================================
// PhotoGallerySidebar.tsx
// VERSION: 2.2 - Click outside to close modal
// Auteur: Claude - VPB Project
// Date: 2025-12-19
// Description: Sidebar transparente pour upload et sélection de photos
// ============================================

import { useState, useCallback, useRef, useEffect } from "react";
import {
  X,
  Upload,
  Search,
  Image,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronLeft,
  FolderOpen,
  Grid3X3,
  List,
  Check,
  CheckCircle2,
  Images,
  StopCircle,
  Loader2,
  ZoomIn,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Photo {
  id: string;
  url: string;
  name: string;
  created_at: string;
  size?: number;
}

interface PhotoGallerySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhoto: (photoUrl: string, photoName: string) => void;
  onSelectMultiplePhotos?: (photos: { url: string; name: string }[]) => void;
  projectId?: string;
  bucketName?: string;
}

// 🔥 Configuration de la compression
const COMPRESSION_CONFIG = {
  maxWidth: 1920, // Largeur max en pixels
  maxHeight: 1920, // Hauteur max en pixels
  quality: 0.8, // Qualité JPEG (0-1)
  maxSizeKB: 500, // Taille max cible en KB
};

// 🔥 Fonction de compression d'image
async function compressImage(file: File): Promise<{ blob: Blob; originalSize: number; compressedSize: number }> {
  return new Promise((resolve, reject) => {
    const originalSize = file.size;

    // Si ce n'est pas une image, retourner tel quel
    if (!file.type.startsWith("image/")) {
      resolve({ blob: file, originalSize, compressedSize: originalSize });
      return;
    }

    const img = new window.Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      let { width, height } = img;

      // Calculer les nouvelles dimensions
      if (width > COMPRESSION_CONFIG.maxWidth || height > COMPRESSION_CONFIG.maxHeight) {
        const ratio = Math.min(COMPRESSION_CONFIG.maxWidth / width, COMPRESSION_CONFIG.maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Dessiner l'image redimensionnée
      ctx?.drawImage(img, 0, 0, width, height);

      // Compresser en JPEG
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              originalSize,
              compressedSize: blob.size,
            });
          } else {
            // Fallback si la compression échoue
            resolve({ blob: file, originalSize, compressedSize: originalSize });
          }
        },
        "image/jpeg",
        COMPRESSION_CONFIG.quality,
      );
    };

    img.onerror = () => {
      // En cas d'erreur, retourner le fichier original
      resolve({ blob: file, originalSize, compressedSize: originalSize });
    };

    // Charger l'image
    img.src = URL.createObjectURL(file);
  });
}

// Formater la taille de fichier
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PhotoGallerySidebar({
  isOpen,
  onClose,
  onSelectPhoto,
  onSelectMultiplePhotos,
  projectId,
  bucketName = "mechanical-photos",
}: PhotoGallerySidebarProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, fileName: "" });
  const [uploadStats, setUploadStats] = useState({ saved: 0, uploaded: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Charger les photos au montage
  useEffect(() => {
    if (isOpen) {
      loadPhotos();
    }
  }, [isOpen, projectId]);

  // Réinitialiser la sélection quand on ferme
  useEffect(() => {
    if (!isOpen) {
      setSelectedPhotos(new Set());
      setIsSelectionMode(false);
    }
  }, [isOpen]);

  // Cleanup à la fermeture
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const loadPhotos = async () => {
    try {
      const folderPath = projectId ? `${projectId}/` : "";
      console.log("📷 Chargement photos depuis:", bucketName, folderPath);

      const { data, error } = await supabase.storage.from(bucketName).list(folderPath, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

      if (error) {
        console.error("❌ Erreur liste photos:", error);
        throw error;
      }

      console.log("📷 Fichiers trouvés:", data?.length, data);

      const photoFiles =
        data?.filter(
          (file) => file.name && !file.name.startsWith(".") && file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i),
        ) || [];

      console.log("📷 Photos filtrées:", photoFiles.length);

      const photosWithUrls = photoFiles.map((file) => {
        const filePath = `${folderPath}${file.name}`;
        const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);

        console.log("📷 URL générée:", file.name, urlData.publicUrl);

        return {
          id: file.id || file.name,
          url: urlData.publicUrl,
          name: file.name,
          created_at: file.created_at || new Date().toISOString(),
          size: file.metadata?.size,
        };
      });

      setPhotos(photosWithUrls);
    } catch (error) {
      console.error("❌ Erreur chargement photos:", error);
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger les photos. Vérifiez que le bucket existe.",
        variant: "destructive",
      });
    }
  };

  // 🔥 Upload avec compression et possibilité d'annulation
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Créer un nouveau AbortController pour cet upload
    abortControllerRef.current = new AbortController();

    setIsUploading(true);
    setUploadProgress({ current: 0, total: files.length, fileName: "" });
    setUploadStats({ saved: 0, uploaded: 0 });

    const folderPath = projectId ? `${projectId}/` : "";
    let totalSaved = 0;
    let successCount = 0;

    try {
      const fileArray = Array.from(files);

      for (let i = 0; i < fileArray.length; i++) {
        // Vérifier si l'upload a été annulé
        if (abortControllerRef.current?.signal.aborted) {
          toast({
            title: "Upload annulé",
            description: `${successCount} photo(s) uploadée(s) sur ${files.length}`,
          });
          break;
        }

        const file = fileArray[i];

        if (!file.type.startsWith("image/")) {
          toast({
            title: "Format non supporté",
            description: `${file.name} n'est pas une image`,
            variant: "destructive",
          });
          continue;
        }

        setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });

        // 🔥 Compresser l'image
        const { blob, originalSize, compressedSize } = await compressImage(file);
        totalSaved += originalSize - compressedSize;

        // Générer le nom du fichier
        const extension = file.type === "image/png" ? "png" : "jpg";
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9.-]/g, "_");
        const fileName = `${Date.now()}_${baseName}.${extension}`;
        const filePath = `${folderPath}${fileName}`;

        // Upload le fichier compressé
        const { error } = await supabase.storage.from(bucketName).upload(filePath, blob, {
          upsert: true,
          contentType: "image/jpeg",
        });

        if (error) throw error;

        successCount++;
        setUploadStats({ saved: totalSaved, uploaded: successCount });
      }

      if (successCount > 0 && !abortControllerRef.current?.signal.aborted) {
        const savedMB = (totalSaved / (1024 * 1024)).toFixed(1);
        toast({
          title: "Upload réussi",
          description: `${successCount} photo(s) • ${savedMB} MB économisés`,
        });
      }

      loadPhotos();
    } catch (error: any) {
      if (error.name !== "AbortError") {
        toast({
          title: "Erreur d'upload",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0, fileName: "" });
      abortControllerRef.current = null;
      setIsDragOver(false);
    }
  };

  // 🔥 Annuler l'upload en cours
  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleDelete = async (photo: Photo) => {
    try {
      const folderPath = projectId ? `${projectId}/` : "";
      const { error } = await supabase.storage.from(bucketName).remove([`${folderPath}${photo.name}`]);

      if (error) throw error;

      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setSelectedPhotos((prev) => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });
      toast({ title: "Photo supprimée" });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleUpload(e.dataTransfer.files);
  }, []);

  // Toggle sélection d'une photo
  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      // Activer le mode sélection si au moins une photo sélectionnée
      if (next.size > 0) {
        setIsSelectionMode(true);
      }
      return next;
    });
  };

  // Annuler la sélection
  const clearSelection = () => {
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

  // Drag start pour photos sélectionnées (multiple)
  const handlePhotoDragStart = (e: React.DragEvent, photo: Photo) => {
    // Si la photo draggée fait partie de la sélection, on drag toutes les sélectionnées
    if (selectedPhotos.has(photo.id) && selectedPhotos.size > 1) {
      const selectedPhotosList = filteredPhotos
        .filter((p) => selectedPhotos.has(p.id))
        .map((p) => ({ url: p.url, name: p.name }));

      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({
          type: "photos",
          photos: selectedPhotosList,
        }),
      );
    } else {
      // Sinon, on drag juste cette photo
      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({
          type: "photo",
          url: photo.url,
          name: photo.name,
        }),
      );
    }
    e.dataTransfer.effectAllowed = "copy";
  };

  // Ajouter les photos sélectionnées au canvas
  const handleAddSelectedToCanvas = () => {
    if (selectedPhotos.size === 0) return;

    const selectedPhotosList = filteredPhotos
      .filter((p) => selectedPhotos.has(p.id))
      .map((p) => ({ url: p.url, name: p.name }));

    if (onSelectMultiplePhotos) {
      onSelectMultiplePhotos(selectedPhotosList);
    } else {
      // Fallback: ajouter une par une
      selectedPhotosList.forEach((p) => onSelectPhoto(p.url, p.name));
    }

    clearSelection();
    onClose();
  };

  const filteredPhotos = photos.filter((photo) => photo.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <>
      {/* Overlay backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity" onClick={onClose} />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full z-50 transition-all duration-300 ease-out",
          "w-80 md:w-96",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Container principal avec effet glassmorphism */}
        <div className="h-full flex flex-col bg-background/80 backdrop-blur-xl border-l border-border/50 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Image className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">Pellicule Photos</h2>
                <p className="text-xs text-muted-foreground">{photos.length} photos</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              >
                {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Barre de sélection - compteur */}
          {selectedPhotos.size > 0 && (
            <div className="px-3 py-2 bg-primary/10 border-b border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{selectedPhotos.size} sélectionnée(s)</span>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
                Annuler
              </Button>
            </div>
          )}

          {/* Zone de recherche + boutons sélection */}
          <div className="p-3 border-b border-border/30 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une photo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 bg-muted/30 border-border/30 focus:bg-background/50"
              />
            </div>

            {/* Boutons Tout sélectionner / Tout désélectionner */}
            {filteredPhotos.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={() => {
                    setSelectedPhotos(new Set(filteredPhotos.map((p) => p.id)));
                    setIsSelectionMode(true);
                  }}
                >
                  <CheckSquare className="h-3 w-3 mr-1" />
                  Tout sélectionner
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={() => {
                    setSelectedPhotos(new Set());
                    setIsSelectionMode(false);
                  }}
                  disabled={selectedPhotos.size === 0}
                >
                  <Square className="h-3 w-3 mr-1" />
                  Tout désélectionner
                </Button>
              </div>
            )}
          </div>

          {/* Zone d'upload drag & drop */}
          <div className="p-3">
            <div
              className={cn(
                "relative border-2 border-dashed rounded-xl p-6 text-center transition-all",
                !isUploading && "cursor-pointer hover:border-primary/50 hover:bg-primary/5",
                isDragOver ? "border-primary bg-primary/10 scale-[1.02]" : "border-border/50 bg-muted/20",
                isUploading && "pointer-events-none",
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />

              {isUploading ? (
                // 🔥 Affichage pendant l'upload
                <div className="space-y-3">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      Upload {uploadProgress.current}/{uploadProgress.total}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">{uploadProgress.fileName}</p>
                    {uploadStats.saved > 0 && (
                      <p className="text-xs text-green-600 mt-1">💾 {formatSize(uploadStats.saved)} économisés</p>
                    )}
                  </div>

                  {/* Barre de progression */}
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    />
                  </div>

                  {/* 🔥 Bouton annuler */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-destructive border-destructive/50 hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelUpload();
                    }}
                  >
                    <StopCircle className="h-4 w-4 mr-1" />
                    Annuler l'upload
                  </Button>
                </div>
              ) : (
                <div className={cn("transition-transform duration-200", isDragOver && "scale-110")}>
                  <Upload
                    className={cn(
                      "h-8 w-8 mx-auto mb-2 transition-colors",
                      isDragOver ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <p className="text-sm font-medium">Glissez vos photos ici</p>
                  <p className="text-xs text-muted-foreground mt-1">ou cliquez pour parcourir</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-2">
                    📦 Compression automatique (max {COMPRESSION_CONFIG.maxWidth}px)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Galerie de photos */}
          <ScrollArea className="flex-1 px-3">
            {filteredPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{searchQuery ? "Aucune photo trouvée" : "Aucune photo"}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {searchQuery ? "Essayez un autre terme" : "Uploadez des photos pour commencer"}
                </p>
              </div>
            ) : viewMode === "grid" ? (
              // Vue grille
              <div className="grid grid-cols-2 gap-2 pb-4">
                {filteredPhotos.map((photo) => {
                  const isSelected = selectedPhotos.has(photo.id);
                  return (
                    <div
                      key={photo.id}
                      className={cn(
                        "group relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer",
                        "border-2 transition-all duration-200 bg-muted/30",
                        "hover:scale-[1.02] hover:shadow-lg hover:z-10",
                        isSelected
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent hover:border-primary/30",
                      )}
                      draggable
                      onDragStart={(e) => handlePhotoDragStart(e, photo)}
                      onClick={() => {
                        // 🔥 Click = toujours sélectionner/désélectionner
                        togglePhotoSelection(photo.id);
                      }}
                      onDoubleClick={() => {
                        // 🔥 Double-click = envoyer directement au canvas
                        onSelectPhoto(photo.url, photo.name);
                      }}
                    >
                      <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                        <img
                          src={photo.url}
                          alt={photo.name}
                          className="max-w-full max-h-full object-contain"
                          loading="lazy"
                        />
                      </div>

                      {/* Checkbox de sélection - toujours visible */}
                      <div
                        className={cn(
                          "absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center transition-all",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-black/40 text-white opacity-0 group-hover:opacity-100",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePhotoSelection(photo.id);
                        }}
                      >
                        {isSelected ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-white" />
                        )}
                      </div>

                      {/* Overlay au survol */}
                      <div
                        className={cn(
                          "absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity",
                          isSelected ? "opacity-30" : "opacity-0 group-hover:opacity-100",
                        )}
                      >
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-[10px] text-white truncate font-medium">{photo.name}</p>
                        </div>

                        {/* Boutons en haut à droite */}
                        <div className="absolute top-1 right-1 flex items-center gap-1">
                          {/* Bouton loupe / aperçu */}
                          <button
                            className="p-1.5 rounded-md bg-black/50 hover:bg-primary text-white transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewPhoto(photo);
                            }}
                            title="Aperçu"
                          >
                            <ZoomIn className="h-3 w-3" />
                          </button>

                          {/* Bouton supprimer */}
                          <button
                            className="p-1.5 rounded-md bg-black/50 hover:bg-destructive text-white transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(photo);
                            }}
                            title="Supprimer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Badge sélectionné */}
                      {isSelected && <div className="absolute inset-0 bg-primary/20 pointer-events-none" />}
                    </div>
                  );
                })}
              </div>
            ) : (
              // Vue liste
              <div className="space-y-1 pb-4">
                {filteredPhotos.map((photo) => {
                  const isSelected = selectedPhotos.has(photo.id);
                  return (
                    <div
                      key={photo.id}
                      className={cn(
                        "group flex items-center gap-3 p-2 rounded-lg cursor-pointer",
                        "border transition-all duration-200",
                        "hover:bg-muted/50",
                        isSelected ? "border-primary bg-primary/5" : "border-transparent",
                      )}
                      draggable
                      onDragStart={(e) => handlePhotoDragStart(e, photo)}
                      onClick={() => {
                        // 🔥 Click = toujours sélectionner/désélectionner
                        togglePhotoSelection(photo.id);
                      }}
                      onDoubleClick={() => {
                        // 🔥 Double-click = envoyer directement au canvas
                        onSelectPhoto(photo.url, photo.name);
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted border border-border",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePhotoSelection(photo.id);
                        }}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>

                      <div className="w-16 h-12 rounded-md overflow-hidden flex-shrink-0 border border-border/30 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                        <img
                          src={photo.url}
                          alt={photo.name}
                          className="max-w-full max-h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{photo.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(photo.size || 0)} • {new Date(photo.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>

                      {/* Boutons actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          className="p-1.5 rounded hover:bg-primary/10 hover:text-primary transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewPhoto(photo);
                          }}
                          title="Aperçu"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(photo);
                          }}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer avec bouton d'ajout groupé */}
          <div className="p-3 border-t border-border/30 bg-muted/20">
            {selectedPhotos.size > 0 ? (
              <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleAddSelectedToCanvas}>
                <Images className="h-4 w-4 mr-2" />
                Ajouter {selectedPhotos.size} photo(s) au canvas
              </Button>
            ) : (
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3" />
                  <span>Cliquez pour sélectionner</span>
                </div>
                <div className="flex items-center gap-2">
                  <GripVertical className="h-3 w-3" />
                  <span>Glissez vers le canvas ou double-cliquez</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Handle pour ouvrir/fermer depuis le bord */}
        <button
          className={cn(
            "absolute top-1/2 -translate-y-1/2 -left-8 w-8 h-20 rounded-l-lg",
            "bg-background/80 backdrop-blur-md border border-r-0 border-border/50",
            "flex items-center justify-center transition-all hover:bg-muted/80",
            "shadow-lg",
          )}
          onClick={onClose}
        >
          <ChevronRight className={cn("h-4 w-4 transition-transform", !isOpen && "rotate-180")} />
        </button>
      </div>

      {/* 🔥 Modale de prévisualisation avancée */}
      {previewPhoto && (
        <PhotoPreviewModal
          photo={previewPhoto}
          photos={filteredPhotos}
          onClose={() => setPreviewPhoto(null)}
          onNavigate={(photo) => setPreviewPhoto(photo)}
          onAddToCanvas={(photo) => {
            onSelectPhoto(photo.url, photo.name);
            setPreviewPhoto(null);
          }}
        />
      )}
    </>
  );
}

// 🔥 Composant Modale de prévisualisation avec zoom et navigation
function PhotoPreviewModal({
  photo,
  photos,
  onClose,
  onNavigate,
  onAddToCanvas,
}: {
  photo: Photo;
  photos: Photo[];
  onClose: () => void;
  onNavigate: (photo: Photo) => void;
  onAddToCanvas: (photo: Photo) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const currentIndex = photos.findIndex((p) => p.id === photo.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  // Navigation
  const goToPrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(photos[currentIndex - 1]);
      resetZoom();
    }
  }, [currentIndex, hasPrev, photos, onNavigate]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      onNavigate(photos[currentIndex + 1]);
      resetZoom();
    }
  }, [currentIndex, hasNext, photos, onNavigate]);

  // Reset zoom et position
  const resetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    positionRef.current = { x: 0, y: 0 };
  };

  // Zoom
  const zoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.5, 5));
  };

  const zoomOut = () => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) {
        setPosition({ x: 0, y: 0 });
        positionRef.current = { x: 0, y: 0 };
      }
      return newZoom;
    });
  };

  // Gestion du drag pour déplacement - optimisé
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      e.preventDefault();
      setIsDragging(true);
      hasDraggedRef.current = false;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      positionRef.current = { ...position };
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && zoom > 1) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;

        // Marquer qu'on a bougé si déplacement > 5px
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
          hasDraggedRef.current = true;
        }

        const newPosition = {
          x: positionRef.current.x + deltaX,
          y: positionRef.current.y + deltaY,
        };

        setPosition(newPosition);

        // Mise à jour directe du style pour fluidité maximale
        if (imageRef.current) {
          imageRef.current.style.transform = `scale(${zoom}) translate(${newPosition.x / zoom}px, ${newPosition.y / zoom}px)`;
        }
      }
    },
    [isDragging, zoom],
  );

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      positionRef.current = { ...position };
    }
  };

  // Gérer le click sur le fond pour fermer
  const handleBackgroundClick = (e: React.MouseEvent) => {
    // Ne pas fermer si on vient de drag ou si le click est sur l'image
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    // Le click doit être sur le conteneur, pas sur l'image
    if (e.target === containerRef.current) {
      onClose();
    }
  };

  // Zoom avec la molette
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    setZoom((prev) => {
      const newZoom = Math.max(1, Math.min(5, prev + delta));
      if (newZoom === 1) {
        setPosition({ x: 0, y: 0 });
        positionRef.current = { x: 0, y: 0 };
      }
      return newZoom;
    });
  }, []);

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          goToPrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          goToNext();
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          break;
        case "-":
          e.preventDefault();
          zoomOut();
          break;
        case "0":
          e.preventDefault();
          resetZoom();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrev, goToNext, onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col" onClick={onClose}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 bg-black/50 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Image className="h-5 w-5 text-white/70 flex-shrink-0" />
          <span className="text-sm font-medium text-white truncate">{photo.name}</span>
          <span className="text-xs text-white/50">
            {currentIndex + 1} / {photos.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Contrôles de zoom */}
          <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={zoomOut}
              disabled={zoom <= 1}
            >
              <span className="text-lg font-bold">−</span>
            </Button>
            <span className="text-xs text-white min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={zoomIn}
              disabled={zoom >= 5}
            >
              <span className="text-lg font-bold">+</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={resetZoom}
              title="Réinitialiser (0)"
            >
              <span className="text-xs">1:1</span>
            </Button>
          </div>

          {/* Bouton ajouter au canvas */}
          <Button size="sm" className="h-8 bg-primary hover:bg-primary/90" onClick={() => onAddToCanvas(photo)}>
            <Images className="h-4 w-4 mr-1" />
            Ajouter
          </Button>

          {/* Bouton fermer */}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Zone image avec navigation */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        onClick={handleBackgroundClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        {/* Bouton précédent */}
        {hasPrev && (
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all hover:scale-110"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            title="Photo précédente (←)"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
        )}

        {/* Bouton suivant */}
        {hasNext && (
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all hover:scale-110"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            title="Photo suivante (→)"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        )}

        {/* Image */}
        <img
          ref={imageRef}
          src={photo.url}
          alt={photo.name}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            willChange: isDragging ? "transform" : "auto",
            transition: isDragging ? "none" : "transform 0.1s ease-out",
          }}
          draggable={false}
        />
      </div>

      {/* Footer avec raccourcis */}
      <div
        className="p-2 bg-black/50 backdrop-blur-sm flex items-center justify-center gap-6 text-xs text-white/50"
        onClick={(e) => e.stopPropagation()}
      >
        <span>← → Navigation</span>
        <span>+ − Zoom</span>
        <span>0 Reset</span>
        <span>Molette Zoom</span>
        <span>Glisser Déplacer</span>
        <span>Esc Fermer</span>
      </div>
    </div>
  );
}

// Bouton flottant pour ouvrir la sidebar
export function PhotoGalleryToggle({
  isOpen,
  onToggle,
  photoCount = 0,
}: {
  isOpen: boolean;
  onToggle: () => void;
  photoCount?: number;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "fixed right-4 top-1/2 -translate-y-1/2 z-30",
        "bg-background/80 backdrop-blur-md border-border/50 shadow-lg",
        "hover:bg-primary/10 hover:border-primary/50 transition-all",
        isOpen && "opacity-0 pointer-events-none",
      )}
      onClick={onToggle}
    >
      <Image className="h-4 w-4 mr-2" />
      Photos
      {photoCount > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary/20 text-xs">{photoCount}</span>}
    </Button>
  );
}

export default PhotoGallerySidebar;
