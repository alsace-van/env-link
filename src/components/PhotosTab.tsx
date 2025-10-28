import { useState } from "react";
import PhotoUpload from "./PhotoUpload";
import PhotoGallery from "./PhotoGallery";
import PhotoAnnotationModal from "./PhotoAnnotationModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Photo {
  id: string;
  url: string;
  description?: string;
  comment?: string;
  annotations?: any;
}

interface PhotosTabProps {
  projectId: string;
}

const PhotosTab = ({ projectId }: PhotosTabProps) => {
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handlePhotoClick = (photo: Photo) => {
    console.log("📸 Photo clicked:", photo);
    setSelectedPhoto(photo);
    console.log("📸 Setting modal to open...");
    setIsModalOpen(true);
    console.log("📸 Modal state:", { selectedPhoto: photo, isModalOpen: true });
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedPhoto(null);
  };

  const handleModalSave = () => {
    setRefreshCounter((prev) => prev + 1);
  };

  const handleUploadComplete = () => {
    setRefreshCounter((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="projet" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="projet">Photos du projet</TabsTrigger>
          <TabsTrigger value="inspiration">Photos d'inspiration</TabsTrigger>
        </TabsList>

        <TabsContent value="projet" className="space-y-4">
          <PhotoUpload
            projectId={projectId}
            type="projet"
            onUploadComplete={handleUploadComplete}
          />
          <PhotoGallery
            projectId={projectId}
            type="projet"
            refresh={refreshCounter}
            onPhotoClick={handlePhotoClick}
          />
        </TabsContent>

        <TabsContent value="inspiration" className="space-y-4">
          <PhotoUpload
            projectId={projectId}
            type="inspiration"
            onUploadComplete={handleUploadComplete}
          />
          <PhotoGallery
            projectId={projectId}
            type="inspiration"
            refresh={refreshCounter}
            onPhotoClick={handlePhotoClick}
          />
        </TabsContent>
      </Tabs>

      <PhotoAnnotationModal
        photo={selectedPhoto}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleModalSave}
      />
    </div>
  );
};

export default PhotosTab;
