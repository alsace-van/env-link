import { PhotoDrawingModalAdvanced } from "./PhotoDrawingModalAdvanced";

interface Photo {
  id: string;
  photo_url: string;
  description?: string;
  comment?: string;
  annotations?: any;
}

interface PhotoAnnotationModalProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const PhotoAnnotationModal = ({ photo, isOpen, onClose, onSave }: PhotoAnnotationModalProps) => {
  // Simply use PhotoDrawingModalAdvanced which has all the drawing tools
  return (
    <PhotoDrawingModalAdvanced
      photo={photo}
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
    />
  );
};

export default PhotoAnnotationModal;
