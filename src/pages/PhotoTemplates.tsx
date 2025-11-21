import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PhotoTemplatesContent } from "@/components/photo-templates/PhotoTemplatesContent";

export default function PhotoTemplates() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Bouton retour */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => navigate(`/project/${projectId}`)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Retour au projet
      </Button>

      <PhotoTemplatesContent projectId={projectId!} />
    </div>
  );
}
