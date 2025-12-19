// ============================================
// PhotoGallerySidebar.tsx
// VERSION: 1.1 - Sélection multiple avec coches + drag groupé
// Auteur: Claude - VPB Project
// Date: 2025-12-19
// Description: Sidebar transparente pour upload et sélection de photos
// ============================================

import { useState, useCallback, useRef, useEffect } from "react";
import { X, Upload, Search, Image, Trash2, GripVertical, ChevronRight, FolderOpen, Grid3X3, List, Check, CheckCircle2, Images } from "lucide-react";
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

export function PhotoGallerySidebar({
  isOpen,
  onClose,
  onSelectPhoto,
  onSelectMultiplePhotos,
  projectId,
  bucketName = "mechanical-photos"
}: PhotoGallerySidebarProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const loadPhotos = async () => {
    try {
      const folderPath = projectId ? `${projectId}/` : "";
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(folderPath, {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" }
        });

      if (error) throw error;

      const photoFiles = data?.filter(file => 
        file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      ) || [];

      const photosWithUrls = photoFiles.map(file => {
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(`${folderPath}${file.name}`);
        
        return {
          id: file.id || file.name,
          url: urlData.publicUrl,
          name: file.name,
          created_at: file.created_at || new Date().toISOString(),
          size: file.metadata?.size
        };
      });

      setPhotos(photosWithUrls);
    } catch (error) {
      console.error("Erreur chargement photos:", error);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    const folderPath = projectId ? `${projectId}/` : "";

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast({
            title: "Format non supporté",
            description: `${file.name} n'est pas une image`,
            variant: "destructive"
          });
          continue;
        }

        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const filePath = `${folderPath}${fileName}`;

        const { error } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file, { upsert: true });

        if (error) throw error;
      }

      toast({
        title: "Upload réussi",
        description: `${files.length} photo(s) ajoutée(s)`
      });

      loadPhotos();
    } catch (error: any) {
      toast({
        title: "Erreur d'upload",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setIsDragOver(false);
    }
  };

  const handleDelete = async (photo: Photo) => {
    try {
      const folderPath = projectId ? `${projectId}/` : "";
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([`${folderPath}${photo.name}`]);

      if (error) throw error;

      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      setSelectedPhotos(prev => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });
      toast({ title: "Photo supprimée" });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
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
    setSelectedPhotos(prev => {
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

  // Sélectionner/Désélectionner tout
  const toggleSelectAll = () => {
    if (selectedPhotos.size === filteredPhotos.length) {
      setSelectedPhotos(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedPhotos(new Set(filteredPhotos.map(p => p.id)));
      setIsSelectionMode(true);
    }
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
        .filter(p => selectedPhotos.has(p.id))
        .map(p => ({ url: p.url, name: p.name }));
      
      e.dataTransfer.setData("application/json", JSON.stringify({
        type: "photos",
        photos: selectedPhotosList
      }));
    } else {
      // Sinon, on drag juste cette photo
      e.dataTransfer.setData("application/json", JSON.stringify({
        type: "photo",
        url: photo.url,
        name: photo.name
      }));
    }
    e.dataTransfer.effectAllowed = "copy";
  };

  // Ajouter les photos sélectionnées au canvas
  const handleAddSelectedToCanvas = () => {
    if (selectedPhotos.size === 0) return;

    const selectedPhotosList = filteredPhotos
      .filter(p => selectedPhotos.has(p.id))
      .map(p => ({ url: p.url, name: p.name }));

    if (onSelectMultiplePhotos) {
      onSelectMultiplePhotos(selectedPhotosList);
    } else {
      // Fallback: ajouter une par une
      selectedPhotosList.forEach(p => onSelectPhoto(p.url, p.name));
    }

    clearSelection();
    onClose();
  };

  const filteredPhotos = photos.filter(photo =>
    photo.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      {/* Overlay backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full z-50 transition-all duration-300 ease-out",
          "w-80 md:w-96",
          isOpen ? "translate-x-0" : "translate-x-full"
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

          {/* Barre de sélection */}
          {isSelectionMode && (
            <div className="px-3 py-2 bg-primary/10 border-b border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{selectedPhotos.size} sélectionnée(s)</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={toggleSelectAll}
                >
                  {selectedPhotos.size === filteredPhotos.length ? "Désélectionner tout" : "Tout sélectionner"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={clearSelection}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {/* Zone de recherche */}
          <div className="p-3 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une photo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 bg-muted/30 border-border/30 focus:bg-background/50"
              />
            </div>
          </div>

          {/* Zone d'upload drag & drop */}
          <div className="p-3">
            <div
              className={cn(
                "relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer",
                "hover:border-primary/50 hover:bg-primary/5",
                isDragOver 
                  ? "border-primary bg-primary/10 scale-[1.02]" 
                  : "border-border/50 bg-muted/20",
                isUploading && "pointer-events-none opacity-50"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
              
              <div className={cn(
                "transition-transform duration-200",
                isDragOver && "scale-110"
              )}>
                <Upload className={cn(
                  "h-8 w-8 mx-auto mb-2 transition-colors",
                  isDragOver ? "text-primary" : "text-muted-foreground"
                )} />
                <p className="text-sm font-medium">
                  {isUploading ? "Upload en cours..." : "Glissez vos photos ici"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ou cliquez pour parcourir
                </p>
              </div>

              {/* Indicateur de progression */}
              {isUploading && (
                <div className="absolute inset-x-4 bottom-3">
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-pulse w-2/3" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Galerie de photos */}
          <ScrollArea className="flex-1 px-3">
            {filteredPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "Aucune photo trouvée" : "Aucune photo"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {searchQuery ? "Essayez un autre terme" : "Uploadez des photos pour commencer"}
                </p>
              </div>
            ) : viewMode === "grid" ? (
              // Vue grille
              <div className="grid grid-cols-3 gap-2 pb-4">
                {filteredPhotos.map((photo) => {
                  const isSelected = selectedPhotos.has(photo.id);
                  return (
                    <div
                      key={photo.id}
                      className={cn(
                        "group relative aspect-square rounded-lg overflow-hidden cursor-pointer",
                        "border-2 transition-all duration-200",
                        "hover:scale-105 hover:shadow-lg hover:z-10",
                        isSelected
                          ? "border-primary ring-2 ring-primary/30" 
                          : "border-transparent hover:border-primary/30"
                      )}
                      draggable
                      onDragStart={(e) => handlePhotoDragStart(e, photo)}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey || isSelectionMode) {
                          togglePhotoSelection(photo.id);
                        } else if (selectedPhotos.size === 0) {
                          onSelectPhoto(photo.url, photo.name);
                        } else {
                          togglePhotoSelection(photo.id);
                        }
                      }}
                    >
                      <img
                        src={photo.url}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      
                      {/* Checkbox de sélection - toujours visible */}
                      <div 
                        className={cn(
                          "absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center transition-all",
                          isSelected 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-black/40 text-white opacity-0 group-hover:opacity-100"
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
                      <div className={cn(
                        "absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity",
                        isSelected ? "opacity-30" : "opacity-0 group-hover:opacity-100"
                      )}>
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-[10px] text-white truncate font-medium">
                            {photo.name}
                          </p>
                        </div>
                        
                        {/* Bouton supprimer */}
                        <button
                          className="absolute top-1 right-1 p-1.5 rounded-md bg-black/50 hover:bg-destructive text-white transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(photo);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Badge sélectionné */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 pointer-events-none" />
                      )}
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
                        isSelected 
                          ? "border-primary bg-primary/5" 
                          : "border-transparent"
                      )}
                      draggable
                      onDragStart={(e) => handlePhotoDragStart(e, photo)}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey || isSelectionMode) {
                          togglePhotoSelection(photo.id);
                        } else if (selectedPhotos.size === 0) {
                          onSelectPhoto(photo.url, photo.name);
                        } else {
                          togglePhotoSelection(photo.id);
                        }
                      }}
                    >
                      {/* Checkbox */}
                      <div 
                        className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                          isSelected 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted border border-border"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePhotoSelection(photo.id);
                        }}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>

                      <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 border border-border/30">
                        <img
                          src={photo.url}
                          alt={photo.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{photo.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(photo.size)} • {new Date(photo.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(photo);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer avec bouton d'ajout groupé */}
          <div className="p-3 border-t border-border/30 bg-muted/20">
            {selectedPhotos.size > 0 ? (
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={handleAddSelectedToCanvas}
              >
                <Images className="h-4 w-4 mr-2" />
                Ajouter {selectedPhotos.size} photo(s) au canvas
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <GripVertical className="h-4 w-4" />
                <span>Glissez une photo ou cochez pour sélectionner</span>
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
            "shadow-lg"
          )}
          onClick={onClose}
        >
          <ChevronRight className={cn(
            "h-4 w-4 transition-transform",
            !isOpen && "rotate-180"
          )} />
        </button>
      </div>
    </>
  );
}

// Bouton flottant pour ouvrir la sidebar
export function PhotoGalleryToggle({
  isOpen,
  onToggle,
  photoCount = 0
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
        isOpen && "opacity-0 pointer-events-none"
      )}
      onClick={onToggle}
    >
      <Image className="h-4 w-4 mr-2" />
      Photos
      {photoCount > 0 && (
        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary/20 text-xs">
          {photoCount}
        </span>
      )}
    </Button>
  );
}

export default PhotoGallerySidebar;
