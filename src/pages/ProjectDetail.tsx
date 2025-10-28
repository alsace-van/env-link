import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Image, Euro, FileText, Package, BookOpen, PanelRightOpen, Wrench, Edit } from "lucide-react";
import { toast } from "sonner";
import PhotosTab from "@/components/PhotosTab";
import UserMenu from "@/components/UserMenu";
import ExpensesList from "@/components/ExpensesList";
import ExpensesSummary from "@/components/ExpensesSummary";
import AccessoriesCatalogView from "@/components/AccessoriesCatalogView";
import { NoticeUploadDialog } from "@/components/NoticeUploadDialog";
import { NoticesList } from "@/components/NoticesList";
import { TechnicalCanvas } from "@/components/TechnicalCanvas";
import { CableSectionCalculator } from "@/components/CableSectionCalculator";
import { EnergyBalance } from "@/components/EnergyBalance";
import { LayoutCanvas } from "@/components/LayoutCanvas";
import { Layout3DView } from "@/components/Layout3DView";
import { User } from "@supabase/supabase-js";

interface Project {
  id: string;
  nom_proprietaire: string;
  adresse_proprietaire?: string;
  telephone_proprietaire?: string;
  email_proprietaire?: string;
  longueur_mm?: number;
  largeur_mm?: number;
  hauteur_mm?: number;
  longueur_chargement_mm?: number;
  largeur_chargement_mm?: number;
  poids_vide_kg?: number;
  charge_utile_kg?: number;
  ptac_kg?: number;
  vehicles_catalog?: {
    marque: string;
    modele: string;
  };
}


const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [photoRefresh, setPhotoRefresh] = useState(0);
  const [expenseRefresh, setExpenseRefresh] = useState(0);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isEditDimensionsOpen, setIsEditDimensionsOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    longueur_mm: "",
    largeur_mm: "",
    hauteur_mm: "",
    longueur_chargement_mm: "",
    largeur_chargement_mm: "",
  });

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

    setUser(user);

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

  const handleEditDimensions = () => {
    if (project) {
      setEditFormData({
        longueur_mm: project.longueur_mm?.toString() || "",
        largeur_mm: project.largeur_mm?.toString() || "",
        hauteur_mm: project.hauteur_mm?.toString() || "",
        longueur_chargement_mm: project.longueur_chargement_mm?.toString() || "",
        largeur_chargement_mm: project.largeur_chargement_mm?.toString() || "",
      });
      setIsEditDimensionsOpen(true);
    }
  };

  const handleSaveDimensions = async () => {
    if (!project) return;

    const { error } = await supabase
      .from("projects")
      .update({
        longueur_mm: editFormData.longueur_mm ? parseInt(editFormData.longueur_mm) : null,
        largeur_mm: editFormData.largeur_mm ? parseInt(editFormData.largeur_mm) : null,
        hauteur_mm: editFormData.hauteur_mm ? parseInt(editFormData.hauteur_mm) : null,
        longueur_chargement_mm: editFormData.longueur_chargement_mm ? parseInt(editFormData.longueur_chargement_mm) : null,
        largeur_chargement_mm: editFormData.largeur_chargement_mm ? parseInt(editFormData.largeur_chargement_mm) : null,
      })
      .eq("id", project.id);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
    } else {
      toast.success("Dimensions mises à jour");
      setIsEditDimensionsOpen(false);
      loadProject();
    }
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
            {user && <UserMenu user={user} />}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <Card className="lg:col-span-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Informations du Projet</CardTitle>
                <Button variant="outline" size="sm" onClick={handleEditDimensions}>
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier dimensions
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
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
              </div>
              
              {/* Dimensions du véhicule */}
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Dimensions totales du véhicule</h4>
                <div className="grid grid-cols-3 gap-3 text-xs">
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
                </div>
              </div>

              {/* Dimensions de la surface utile de chargement */}
              {(project.longueur_chargement_mm || project.largeur_chargement_mm) && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-xs font-semibold text-primary mb-2">Surface utile de chargement</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {project.longueur_chargement_mm && (
                      <div>
                        <span className="text-muted-foreground">Longueur utile :</span>
                        <p className="font-medium">{project.longueur_chargement_mm} mm</p>
                      </div>
                    )}
                    {project.largeur_chargement_mm && (
                      <div>
                        <span className="text-muted-foreground">Largeur utile :</span>
                        <p className="font-medium">{project.largeur_chargement_mm} mm</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Poids */}
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Poids et charges</h4>
                <div className="grid grid-cols-3 gap-3 text-xs">
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
              <span className="hidden sm:inline">Catalogue</span>
            </TabsTrigger>
            <TabsTrigger value="notices" className="gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Notices</span>
            </TabsTrigger>
            <TabsTrigger value="technical" className="gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Technique</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="photos">
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
                <CardDescription>Gérez vos photos de projet et d'inspiration</CardDescription>
              </CardHeader>
              <CardContent>
                <PhotosTab projectId={project.id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses">
            <div className="flex gap-6">
              <div className="flex-1">
                <Card>
                  <CardContent className="pt-6">
                    <ExpensesList
                      projectId={project.id}
                      onExpenseChange={() => setExpenseRefresh(prev => prev + 1)}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className={`transition-all duration-300 ${isSummaryOpen ? 'w-[500px]' : 'w-0'} overflow-hidden`}>
                <div className="w-[500px]">
                  <ExpensesSummary
                    projectId={project.id}
                    refreshTrigger={expenseRefresh}
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={() => setIsSummaryOpen(!isSummaryOpen)}
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
              size="icon"
            >
              <PanelRightOpen className={`h-6 w-6 transition-transform ${isSummaryOpen ? 'rotate-180' : ''}`} />
            </Button>
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
            <AccessoriesCatalogView />
          </TabsContent>

          <TabsContent value="notices">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Base de Notices</CardTitle>
                  <CardDescription>Notices partagées entre tous les utilisateurs</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <NoticeUploadDialog onSuccess={() => setPhotoRefresh(prev => prev + 1)} />
                <NoticesList refreshTrigger={photoRefresh} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="technical">
            <Tabs defaultValue="layout" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="layout">Aménagement</TabsTrigger>
                <TabsTrigger value="3d">Vue 3D</TabsTrigger>
                <TabsTrigger value="schema">Schémas</TabsTrigger>
                <TabsTrigger value="electrical">Câbles & Énergie</TabsTrigger>
              </TabsList>

              <TabsContent value="layout">
                <Card>
                  <CardHeader>
                    <CardTitle>Aménagement et Poids</CardTitle>
                    <CardDescription>Planifiez votre aménagement et suivez la charge du véhicule</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <LayoutCanvas
                      projectId={project.id}
                      vehicleLength={project.longueur_mm}
                      vehicleWidth={project.largeur_mm}
                      loadAreaLength={project.longueur_chargement_mm}
                      loadAreaWidth={project.largeur_chargement_mm}
                      maxLoad={project.charge_utile_kg}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="3d">
                <Layout3DView
                  projectId={project.id}
                  loadAreaLength={project.longueur_chargement_mm || 3000}
                  loadAreaWidth={project.largeur_chargement_mm || 1800}
                  loadAreaHeight={project.hauteur_mm || 1800}
                />
              </TabsContent>

              <TabsContent value="schema">
                <Card>
                  <CardHeader>
                    <CardTitle>Canevas de Schémas Techniques</CardTitle>
                    <CardDescription>Créez vos schémas électriques et techniques</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TechnicalCanvas 
                      projectId={project.id} 
                      onExpenseAdded={() => setExpenseRefresh(prev => prev + 1)}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="electrical">
                <div className="space-y-6">
                  <CableSectionCalculator />
                  <EnergyBalance projectId={project.id} refreshTrigger={expenseRefresh} />
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </main>

      {/* Dialog de modification des dimensions */}
      <Dialog open={isEditDimensionsOpen} onOpenChange={setIsEditDimensionsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier les dimensions du véhicule</DialogTitle>
            <DialogDescription>
              Ajustez les dimensions totales et la surface utile de chargement
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Dimensions totales */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Dimensions totales du véhicule</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="longueur_mm">Longueur (mm)</Label>
                  <Input
                    id="longueur_mm"
                    type="number"
                    value={editFormData.longueur_mm}
                    onChange={(e) => setEditFormData({ ...editFormData, longueur_mm: e.target.value })}
                    placeholder="5000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="largeur_mm">Largeur (mm)</Label>
                  <Input
                    id="largeur_mm"
                    type="number"
                    value={editFormData.largeur_mm}
                    onChange={(e) => setEditFormData({ ...editFormData, largeur_mm: e.target.value })}
                    placeholder="2000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hauteur_mm">Hauteur (mm)</Label>
                  <Input
                    id="hauteur_mm"
                    type="number"
                    value={editFormData.hauteur_mm}
                    onChange={(e) => setEditFormData({ ...editFormData, hauteur_mm: e.target.value })}
                    placeholder="2500"
                  />
                </div>
              </div>
            </div>

            {/* Surface utile de chargement */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold text-primary">Surface utile de chargement</h3>
              <p className="text-xs text-muted-foreground">
                Ces dimensions représentent l'espace réellement utilisable pour l'aménagement, 
                sans les passages de roues, la cabine, etc.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="longueur_chargement_mm">Longueur utile (mm)</Label>
                  <Input
                    id="longueur_chargement_mm"
                    type="number"
                    value={editFormData.longueur_chargement_mm}
                    onChange={(e) => setEditFormData({ ...editFormData, longueur_chargement_mm: e.target.value })}
                    placeholder="3000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="largeur_chargement_mm">Largeur utile (mm)</Label>
                  <Input
                    id="largeur_chargement_mm"
                    type="number"
                    value={editFormData.largeur_chargement_mm}
                    onChange={(e) => setEditFormData({ ...editFormData, largeur_chargement_mm: e.target.value })}
                    placeholder="1800"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditDimensionsOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveDimensions}>
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetail;
