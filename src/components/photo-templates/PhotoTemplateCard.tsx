import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate, useParams } from "react-router-dom";

interface PhotoTemplateCardProps {
  template: any;
}

export function PhotoTemplateCard({ template }: PhotoTemplateCardProps) {
  const navigate = useNavigate();
  const { id: projectId } = useParams();

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-video bg-muted relative overflow-hidden">
        {template.corrected_image_url ? (
          <img
            src={template.corrected_image_url}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            Aucune image
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-2">
          {template.markers_detected > 0 && (
            <Badge variant="secondary" className="bg-background/80 backdrop-blur">
              {template.markers_detected}/9 marqueurs
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="pt-4 space-y-2">
        <h3 className="font-semibold text-lg truncate">{template.name}</h3>
        {template.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {template.description}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          {template.accuracy_mm && (
            <Badge variant="outline">±{template.accuracy_mm.toFixed(1)}mm</Badge>
          )}
          {template.scale_factor && (
            <Badge variant="outline">
              1px = {(1 / template.scale_factor).toFixed(3)}mm
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t pt-4">
        <span className="text-xs text-muted-foreground">
          {format(new Date(template.created_at), "d MMM yyyy", { locale: fr })}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/project/${projectId}/template/${template.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
