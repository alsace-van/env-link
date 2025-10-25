import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Image, Euro, FileText, Package, BookOpen } from "lucide-react";
import { toast } from "sonner";
import PhotoUpload from "@/components/PhotoUpload";
import PhotoGallery from "@/components/PhotoGallery";
import PhotoAnnotationModal from "@/components/PhotoAnnotationModal";

interface Project {
  id: string;
  nom_proprietaire: string;
  adresse_proprietaire?: string;
  telephone_proprietaire?: string;
  email_proprietaire?: string;
  longueur_mm?: number;
  largeur_mm?: number;
  hauteur_mm?: number;
  poids_vide_kg?: number;
  charge_utile_kg?: number;
  ptac_kg?: number;
  vehicles_catalog?: {
    marque: string;
    modele: string;
  };
}

interface SelectedPhoto {
  id: string;
  url: string;
  description?: string;
  comment?: string;
  annotations?: any;
}

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [photoRefresh, setPhotoRefresh] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadProject();
    }
  }, [id]);

  const loadProject = async () => {
    if (!id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .select(`
        *,
        vehicles_catalog (
          marque,
          modele
        )
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    setIsLoading(false);

    if (error) {
      toast.error("Erreur lors du chargement du projet");
      navigate("/dashboard");
      return;
    }

    setProject(data);
  };

  const handlePhotoClick = (photo: SelectedPhoto) => {
    setSelectedPhoto(photo);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedPhoto(null);
  };

  const handleSaveAnnotations = () => {
    setPhotoRefresh((prev) => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{project.nom_proprietaire}</h1>
              {project.vehicles_catalog && (
                <p className="text-sm text-muted-foreground">
                  {project.vehicles_catalog.marque} {project.vehicles_catalog.modele}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Informations du Projet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                {project.adresse_proprietaire && (
                  <div>
                    <span className="text-muted-foreground">Adresse :</span>
                    <p className="font-medium">{project.adresse_proprietaire}</p>
                  </div>
                )}
                {project.telephone_proprietaire && (
                  <div>
                    <span className="text-muted-foreground">Téléphone :</span>
                    <p className="font-medium">{project.telephone_proprietaire}</p>
                  </div>
                )}
                {project.email_proprietaire && (
                  <div>
                    <span className="text-muted-foreground">Email :</span>
                    <p className="font-medium">{project.email_proprietaire}</p>
                  </div>
                )}
                {project.longueur_mm && (
                  <div>
                    <span className="text-muted-foreground">Longueur :</span>
                    <p className="font-medium">{project.longueur_mm} mm</p>
                  </div>
                )}
                {project.largeur_mm && (
                  <div>
                    <span className="text-muted-foreground">Largeur :</span>
                    <p className="font-medium">{project.largeur_mm} mm</p>
                  </div>
                )}
                {project.hauteur_mm && (
                  <div>
                    <span className="text-muted-foreground">Hauteur :</span>
                    <p className="font-medium">{project.hauteur_mm} mm</p>
                  </div>
                )}
                {project.poids_vide_kg && (
                  <div>
                    <span className="text-muted-foreground">Poids vide :</span>
                    <p className="font-medium">{project.poids_vide_kg} kg</p>
                  </div>
                )}
                {project.charge_utile_kg && (
                  <div>
                    <span className="text-muted-foreground">Charge utile :</span>
                    <p className="font-medium">{project.charge_utile_kg} kg</p>
                  </div>
                )}
                {project.ptac_kg && (
                  <div>
                    <span className="text-muted-foreground">PTAC :</span>
                    <p className="font-medium">{project.ptac_kg} kg</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="photos" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="photos" className="gap-2">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Photos</span>
            </TabsTrigger>
            <TabsTrigger value="inspiration" className="gap-2">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Inspiration</span>
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2">
              <Euro className="h-4 w-4" />
              <span className="hidden sm:inline">Dépenses</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documents</span>
            </TabsTrigger>
            <TabsTrigger value="accessories" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Accessoires</span>
            </TabsTrigger>
            <TabsTrigger value="notices" className="gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Notices</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="photos">
            <Card>
              <CardHeader>
                <CardTitle>Photos du Projet</CardTitle>
                <CardDescription>Photos de l'avancement de votre aménagement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <PhotoUpload
                  projectId={project.id}
                  type="projet"
                  onUploadComplete={() => setPhotoRefresh((prev) => prev + 1)}
                />
                <PhotoGallery
                  projectId={project.id}
                  type="projet"
                  refresh={photoRefresh}
                  onPhotoClick={handlePhotoClick}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inspiration">
            <Card>
              <CardHeader>
                <CardTitle>Photos d'Inspiration</CardTitle>
                <CardDescription>Vos idées et inspirations pour l'aménagement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <PhotoUpload
                  projectId={project.id}
                  type="inspiration"
                  onUploadComplete={() => setPhotoRefresh((prev) => prev + 1)}
                />
                <PhotoGallery
                  projectId={project.id}
                  type="inspiration"
                  refresh={photoRefresh}
                  onPhotoClick={handlePhotoClick}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses">
            <Card>
              <CardHeader>
                <CardTitle>Suivi Financier</CardTitle>
                <CardDescription>Liste des accessoires et matériel installés</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-12">
                  Fonctionnalité à venir
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Documents Administratifs</CardTitle>
                <CardDescription>Certificats, factures et documents du projet</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-12">
                  Fonctionnalité à venir
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accessories">
            <Card>
              <CardHeader>
                <CardTitle>Catalogue d'Accessoires</CardTitle>
                <CardDescription>Votre catalogue personnel partagé entre tous vos projets</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-12">
                  Fonctionnalité à venir
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notices">
            <Card>
              <CardHeader>
                <CardTitle>Base de Notices</CardTitle>
                <CardDescription>Notices partagées entre tous les utilisateurs</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-12">
                  Fonctionnalité à venir
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <PhotoAnnotationModal
          photo={selectedPhoto}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSave={handleSaveAnnotations}
        />
      </main>
    </div>
  );
};

export default ProjectDetail;
