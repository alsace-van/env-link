import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Edit, Trash2, Ruler, Camera, FileDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { PhotoTemplate } from "@/types/photo-templates";
import { TemplateDrawingCanvas } from "@/components/photo-templates/TemplateDrawingCanvas";
import { exportToDXF, exportToSVG, exportToPDF, downloadBlob } from "@/lib/exportTemplateUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PhotoTemplateDetail() {
  const { id: projectId, templateId } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<PhotoTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDrawingTools, setShowDrawingTools] = useState(false);
  const [drawingsData, setDrawingsData] = useState<any>(null);

  useEffect(() => {
    loadTemplate();
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("photo_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (error) throw error;
      setTemplate(data);
      setDrawingsData(data.drawings_data);
    } catch (error: any) {
      console.error("Erreur chargement:", error);
      toast.error("Impossible de charger le gabarit");
      navigate(`/project/${projectId}/templates`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await (supabase as any)
        .from("photo_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;

      toast.success("Gabarit supprimé avec succès");
      navigate(`/project/${projectId}/templates`);
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast.error(error.message || "Erreur lors de la suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveDrawings = async (newDrawingsData: any) => {
    setDrawingsData(newDrawingsData);
    
    try {
      const { error } = await (supabase as any)
        .from("photo_templates")
        .update({ drawings_data: newDrawingsData })
        .eq("id", templateId);
      
      if (error) throw error;
      toast.success("Dessins sauvegardés");
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde des dessins");
    }
  };

  const handleExport = async (format: "dxf" | "svg" | "pdf") => {
    if (!template) return;

    try {
      const options = {
        templateName: template.name,
        scaleFactor: template.scale_factor || 1,
        imageUrl: template.corrected_image_url || template.original_image_url,
        drawingsData: drawingsData,
        realDimensions: template.calibration_data?.realDimensions,
      };

      let blob: Blob;
      let filename: string;

      switch (format) {
        case "dxf":
          blob = await exportToDXF(options);
          filename = `${template.name}.dxf`;
          break;
        case "svg":
          blob = await exportToSVG(options);
          filename = `${template.name}.svg`;
          break;
        case "pdf":
          blob = await exportToPDF(options);
          filename = `${template.name}.pdf`;
          break;
      }

      downloadBlob(blob, filename);

      // Incrémenter le compteur d'exports
      const { error } = await (supabase as any)
        .from("photo_templates")
        .update({
          export_count: (template.export_count || 0) + 1,
          last_exported_at: new Date().toISOString(),
        })
        .eq("id", templateId);

      if (error) throw error;

      toast.success(`Gabarit exporté en ${format.toUpperCase()}`);
      loadTemplate();
    } catch (error: any) {
      console.error("Erreur export:", error);
      toast.error(`Erreur lors de l'export ${format.toUpperCase()}`);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/project/${projectId}/templates`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux gabarits
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{template.name}</h1>
            {template.description && (
              <p className="text-muted-foreground mt-1">{template.description}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowDrawingTools(!showDrawingTools)}
          >
            <Edit className="h-4 w-4 mr-2" />
            {showDrawingTools ? "Masquer outils" : "Outils de traçage"}
          </Button>
          
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("dxf")}
            >
              <Download className="h-4 w-4 mr-2" />
              DXF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("svg")}
            >
              <Download className="h-4 w-4 mr-2" />
              SVG
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-6">
        {/* Drawing Tools */}
        {showDrawingTools && template.corrected_image_url && template.scale_factor && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Outils de traçage
              </CardTitle>
              <CardDescription>
                Tracez les contours et annotations sur le gabarit calibré
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplateDrawingCanvas
                imageUrl={template.corrected_image_url}
                scaleFactor={template.scale_factor}
                onDrawingsChanged={handleSaveDrawings}
                initialDrawings={drawingsData}
              />
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Image */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Image corrigée et calibrée
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-muted">
                  {template.corrected_image_url ? (
                    <img
                      src={template.corrected_image_url}
                      alt={template.name}
                      className="w-full h-auto"
                    />
                  ) : (
                    <div className="aspect-video flex items-center justify-center text-muted-foreground">
                      Aucune image
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Original Images */}
            <div className="grid grid-cols-2 gap-4">
              {template.original_image_url && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Image originale</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <img
                      src={template.original_image_url}
                      alt="Original"
                      className="w-full h-auto rounded-lg border"
                    />
                  </CardContent>
                </Card>
              )}
              {template.markers_image_url && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Détection marqueurs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <img
                      src={template.markers_image_url}
                      alt="Marqueurs"
                      className="w-full h-auto rounded-lg border"
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-4">
            {/* Calibration Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ruler className="h-5 w-5" />
                  Calibration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Échelle</p>
                  <p className="font-mono text-lg">
                    {template.scale_factor
                      ? `1px = ${(1 / template.scale_factor).toFixed(3)}mm`
                      : "Non calibré"}
                  </p>
                </div>
                {template.calibration_data?.realDimensions && (
                  <div>
                    <p className="text-sm text-muted-foreground">Dimensions réelles</p>
                    <p className="font-mono">
                      {template.calibration_data.realDimensions.widthMm.toFixed(1)} ×{" "}
                      {template.calibration_data.realDimensions.heightMm.toFixed(1)} mm
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Précision estimée</p>
                  <Badge variant="outline">
                    ±{template.accuracy_mm?.toFixed(1) || "0.5"}mm
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Marqueurs détectés</p>
                  <Badge variant="secondary">
                    {template.markers_detected}/9 marqueurs
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Template Info */}
            <Card>
              <CardHeader>
                <CardTitle>Informations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {template.type && (
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">
                      {template.type.replace("_", " ")}
                    </p>
                  </div>
                )}
                {template.material && (
                  <div>
                    <p className="text-sm text-muted-foreground">Matériau</p>
                    <p className="font-medium">{template.material}</p>
                  </div>
                )}
                {template.thickness_mm && (
                  <div>
                    <p className="text-sm text-muted-foreground">Épaisseur</p>
                    <p className="font-medium">{template.thickness_mm}mm</p>
                  </div>
                )}
                {template.tags && template.tags.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {template.tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Créé le</p>
                  <p className="font-medium">
                    {format(new Date(template.created_at), "d MMMM yyyy 'à' HH:mm", {
                      locale: fr,
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Statistiques</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Exportations</span>
                  <span className="font-medium">{template.export_count || 0}</span>
                </div>
                {template.last_exported_at && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Dernier export</span>
                    <span className="text-sm">
                      {format(new Date(template.last_exported_at), "d MMM yyyy", {
                        locale: fr,
                      })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le gabarit ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer "{template.name}" ? Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
