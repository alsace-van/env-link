import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Image,
  Euro,
  FileText,
  Package,
  BookOpen,
  PanelRightOpen,
  Wrench,
  Edit,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import PhotosTab from "@/components/PhotosTab";
import UserMenu from "@/components/UserMenu";
import ExpensesList from "@/components/ExpensesList";
import ExpensesSummary from "@/components/ExpensesSummary";
import AccessoriesCatalogView from "@/components/AccessoriesCatalogView";
import { BilanComptable } from "@/components/BilanComptable";
import { NoticeUploadDialog } from "@/components/NoticeUploadDialog";
import { NoticesList } from "@/components/NoticesList";
import { TechnicalCanvas } from "@/components/TechnicalCanvas";
import { CableSectionCalculator } from "@/components/CableSectionCalculator";
import { EnergyBalance } from "@/components/EnergyBalance";
import { LayoutCanvas } from "@/components/LayoutCanvas";
import { Layout3DView } from "@/components/Layout3DView";
import { User } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";

interface Project {
  id: string;
  nom_proprietaire: string;
  nom_projet?: string;
  adresse_proprietaire?: string;
  telephone_proprietaire?: string;
  email_proprietaire?: string;
  numero_chassis?: string;
  immatriculation?: string;
  type_mine?: string;
  date_mise_circulation?: string;
  marque_custom?: string;
  modele_custom?: string;
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
  const [isProjectInfoCollapsed, setIsProjectInfoCollapsed] = useState(false);
  const [layout3DKey, setLayout3DKey] = useState(0);
  const [layoutCanvasKey, setLayoutCanvasKey] = useState(0);
  const [editFormData, setEditFormData] = useState({
    nom_projet: "",
    numero_chassis: "",
    immatriculation: "",
    type_mine: "",
    date_mise_circulation: "",
    marque_custom: "",
    modele_custom: "",
    nom_proprietaire: "",
    adresse_proprietaire: "",
    telephone_proprietaire: "",
    email_proprietaire: "",
    longueur_mm: "",
    largeur_mm: "",
    hauteur_mm: "",
    longueur_chargement_mm: "",
    largeur_chargement_mm: "",
    poids_vide_kg: "",
    charge_utile_kg: "",
    ptac_kg: "",
  });

  useEffect(() => {
    if (id) {
      loadProject();
    }

    // Écouter les changements en temps réel sur la table projects
    const channel = supabase
      .channel("project-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          console.log("🔄 Changement détecté dans le projet:", payload);
          // Recharger les données du projet quand il y a un changement
          loadProject();
          // Forcer le rechargement du canvas 2D
          setLayoutCanvasKey((prev) => prev + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const loadProject = async () => {
    if (!id) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    setUser(user);

    const { data, error } = await supabase
      .from("projects")
      .select(
        `
        *,
        vehicles_catalog (
          marque,
          modele
        )
      `,
      )
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
        nom_projet: project.nom_projet || "",
        numero_chassis: project.numero_chassis || "",
        immatriculation: project.immatriculation || "",
        type_mine: project.type_mine || "",
        date_mise_circulation: project.date_mise_circulation || "",
        marque_custom: project.marque_custom || project.vehicles_catalog?.marque || "",
        modele_custom: project.modele_custom || project.vehicles_catalog?.modele || "",
        nom_proprietaire: project.nom_proprietaire || "",
        adresse_proprietaire: project.adresse_proprietaire || "",
        telephone_proprietaire: project.telephone_proprietaire || "",
        email_proprietaire: project.email_proprietaire || "",
        longueur_mm: project.longueur_mm?.toString() || "",
        largeur_mm: project.largeur_mm?.toString() || "",
        hauteur_mm: project.hauteur_mm?.toString() || "",
        longueur_chargement_mm: project.longueur_chargement_mm?.toString() || "",
        largeur_chargement_mm: project.largeur_chargement_mm?.toString() || "",
        poids_vide_kg: project.poids_vide_kg?.toString() || "",
        charge_utile_kg: project.charge_utile_kg?.toString() || "",
        ptac_kg: project.ptac_kg?.toString() || "",
      });
      setIsEditDimensionsOpen(true);
    }
  };

  const handleSaveDimensions = async () => {
    if (!project) return;

    const { error } = await supabase
      .from("projects")
      .update({
        nom_projet: editFormData.nom_projet || null,
        numero_chassis: editFormData.numero_chassis || null,
        immatriculation: editFormData.immatriculation || null,
        type_mine: editFormData.type_mine || null,
        date_mise_circulation: editFormData.date_mise_circulation || null,
        marque_custom: editFormData.marque_custom || null,
        modele_custom: editFormData.modele_custom || null,
        nom_proprietaire: editFormData.nom_proprietaire,
        adresse_proprietaire: editFormData.adresse_proprietaire || null,
        telephone_proprietaire: editFormData.telephone_proprietaire || null,
        email_proprietaire: editFormData.email_proprietaire || null,
        longueur_mm: editFormData.longueur_mm ? parseInt(editFormData.longueur_mm) : null,
        largeur_mm: editFormData.largeur_mm ? parseInt(editFormData.largeur_mm) : null,
        hauteur_mm: editFormData.hauteur_mm ? parseInt(editFormData.hauteur_mm) : null,
        longueur_chargement_mm: editFormData.longueur_chargement_mm
          ? parseInt(editFormData.longueur_chargement_mm)
          : null,
        largeur_chargement_mm: editFormData.largeur_chargement_mm ? parseInt(editFormData.largeur_chargement_mm) : null,
        poids_vide_kg: editFormData.poids_vide_kg ? parseInt(editFormData.poids_vide_kg) : null,
        charge_utile_kg: editFormData.charge_utile_kg ? parseInt(editFormData.charge_utile_kg) : null,
        ptac_kg: editFormData.ptac_kg ? parseInt(editFormData.ptac_kg) : null,
      })
      .eq("id", project.id);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
    } else {
      toast.success("Informations mises à jour");
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
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <img 
              src={logo} 
              alt="Alsace Van Création" 
              className="h-20 w-auto object-contain"
            />
            <div className="flex-1">
              <h1 className="text-xl font-bold">{project.nom_proprietaire}</h1>
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
        <div className="mb-6">
          <Card className="w-fit">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-8">
                <CardTitle className="text-base">Informations du Projet</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleEditDimensions}>
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsProjectInfoCollapsed(!isProjectInfoCollapsed)}
                    className="h-8 w-8 p-0"
                  >
                    {isProjectInfoCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {!isProjectInfoCollapsed && (
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Informations générales */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-3">Informations générales</h4>
                    {project.nom_projet && (
                      <div className="flex gap-2 text-xs">
                        <span className="text-muted-foreground w-32">Nom du projet :</span>
                        <p className="font-medium">{project.nom_projet}</p>
                      </div>
                    )}
                    {project.numero_chassis && (
                      <div className="flex gap-2 text-xs">
                        <span className="text-muted-foreground w-32">N° de châssis :</span>
                        <p className="font-medium">{project.numero_chassis}</p>
                      </div>
                    )}
                    {project.immatriculation && (
                      <div className="flex gap-2 text-xs">
                        <span className="text-muted-foreground w-32">Immatriculation :</span>
                        <p className="font-medium">{project.immatriculation}</p>
                      </div>
                    )}
                    {project.type_mine && (
                      <div className="flex gap-2 text-xs">
                        <span className="text-muted-foreground w-32">Type mine :</span>
                        <p className="font-medium">{project.type_mine}</p>
                      </div>
                    )}
                    {project.date_mise_circulation && (
                      <div className="flex gap-2 text-xs">
                        <span className="text-muted-foreground w-32">Date de circulation :</span>
                        <p className="font-medium">{new Date(project.date_mise_circulation).toLocaleDateString('fr-FR')}</p>
                      </div>
                    )}
                    {(project.marque_custom || project.modele_custom) && (
                      <div className="flex gap-2 text-xs">
                        <span className="text-muted-foreground w-32">Véhicule :</span>
                        <p className="font-medium">{project.marque_custom} {project.modele_custom}</p>
                      </div>
                    )}
                  </div>

                  {/* Contact */}
                  {(project.adresse_proprietaire || project.telephone_proprietaire || project.email_proprietaire) && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-3">Contact</h4>
                      {project.adresse_proprietaire && (
                        <div className="flex gap-2 text-xs">
                          <span className="text-muted-foreground w-32">Adresse :</span>
                          <p className="font-medium">{project.adresse_proprietaire}</p>
                        </div>
                      )}
                      {project.telephone_proprietaire && (
                        <div className="flex gap-2 text-xs">
                          <span className="text-muted-foreground w-32">Téléphone :</span>
                          <p className="font-medium">{project.telephone_proprietaire}</p>
                        </div>
                      )}
                      {project.email_proprietaire && (
                        <div className="flex gap-2 text-xs">
                          <span className="text-muted-foreground w-32">Email :</span>
                          <p className="font-medium">{project.email_proprietaire}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dimensions totales */}
                  {(project.longueur_mm || project.largeur_mm || project.hauteur_mm) && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-3">Dimensions totales</h4>
                      <div className="space-y-1">
                        {project.longueur_mm && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">L :</span>
                            <p className="font-medium">{project.longueur_mm} mm</p>
                          </div>
                        )}
                        {project.largeur_mm && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">l :</span>
                            <p className="font-medium">{project.largeur_mm} mm</p>
                          </div>
                        )}
                        {project.hauteur_mm && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">H :</span>
                            <p className="font-medium">{project.hauteur_mm} mm</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Surface utile */}
                  {(project.longueur_chargement_mm || project.largeur_chargement_mm) && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-primary mb-3">Surface utile</h4>
                      <div className="space-y-1">
                        {project.longueur_chargement_mm && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">L utile :</span>
                            <p className="font-medium">{project.longueur_chargement_mm} mm</p>
                          </div>
                        )}
                        {project.largeur_chargement_mm && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">l utile :</span>
                            <p className="font-medium">{project.largeur_chargement_mm} mm</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Poids */}
                  {(project.poids_vide_kg || project.charge_utile_kg || project.ptac_kg) && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-3">Poids</h4>
                      <div className="space-y-1">
                        {project.poids_vide_kg && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Vide :</span>
                            <p className="font-medium">{project.poids_vide_kg} kg</p>
                          </div>
                        )}
                        {project.charge_utile_kg && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Charge :</span>
                            <p className="font-medium">{project.charge_utile_kg} kg</p>
                          </div>
                        )}
                        {project.ptac_kg && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">PTAC :</span>
                            <p className="font-medium">{project.ptac_kg} kg</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
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
            <Tabs defaultValue="liste" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="liste">Liste des Dépenses</TabsTrigger>
                <TabsTrigger value="bilan">Bilan Comptable</TabsTrigger>
              </TabsList>

              <TabsContent value="liste">
                <div className="flex gap-6">
                  <div className="flex-1">
                    <Card>
                      <CardContent className="pt-6">
                        <ExpensesList
                          projectId={project.id}
                          onExpenseChange={() => setExpenseRefresh((prev) => prev + 1)}
                        />
                      </CardContent>
                    </Card>
                  </div>

                  <div className={`transition-all duration-300 ${isSummaryOpen ? "w-[500px]" : "w-0"} overflow-hidden`}>
                    <div className="w-[500px]">
                      <ExpensesSummary projectId={project.id} refreshTrigger={expenseRefresh} />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setIsSummaryOpen(!isSummaryOpen)}
                  className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
                  size="icon"
                >
                  <PanelRightOpen className={`h-6 w-6 transition-transform ${isSummaryOpen ? "rotate-180" : ""}`} />
                </Button>
              </TabsContent>

              <TabsContent value="bilan">
                <BilanComptable projectId={project.id} projectName={project.nom_projet || project.nom_proprietaire} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Documents Administratifs</CardTitle>
                <CardDescription>Certificats, factures et documents du projet</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-12">Fonctionnalité à venir</p>
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
                <NoticeUploadDialog onSuccess={() => setPhotoRefresh((prev) => prev + 1)} />
                <NoticesList refreshTrigger={photoRefresh} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="technical">
            <Tabs
              defaultValue="layout"
              className="w-full"
              onValueChange={(value) => {
                // Force le rechargement de la vue 3D quand on y accède
                if (value === "3d") {
                  setLayout3DKey((prev) => prev + 1);
                }
              }}
            >
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
                      key={layoutCanvasKey}
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
                  key={layout3DKey}
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
                      onExpenseAdded={() => setExpenseRefresh((prev) => prev + 1)}
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

      {/* Dialog de modification des informations du projet */}
      <Dialog open={isEditDimensionsOpen} onOpenChange={setIsEditDimensionsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier les informations du projet</DialogTitle>
            <DialogDescription>Modifiez toutes les informations relatives au projet et au véhicule</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Informations générales du projet */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Informations générales</h3>
              <div className="space-y-2">
                <Label htmlFor="nom_projet">Nom du projet</Label>
                <Input
                  id="nom_projet"
                  value={editFormData.nom_projet}
                  onChange={(e) => setEditFormData({ ...editFormData, nom_projet: e.target.value })}
                  placeholder="Nom du projet"
                />
              </div>
            </div>

            {/* Informations du véhicule */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold">Informations du véhicule</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="marque_custom">Marque</Label>
                  <Input
                    id="marque_custom"
                    value={editFormData.marque_custom}
                    onChange={(e) => setEditFormData({ ...editFormData, marque_custom: e.target.value })}
                    placeholder="Marque"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modele_custom">Modèle</Label>
                  <Input
                    id="modele_custom"
                    value={editFormData.modele_custom}
                    onChange={(e) => setEditFormData({ ...editFormData, modele_custom: e.target.value })}
                    placeholder="Modèle"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero_chassis">N° de châssis</Label>
                  <Input
                    id="numero_chassis"
                    value={editFormData.numero_chassis}
                    onChange={(e) => setEditFormData({ ...editFormData, numero_chassis: e.target.value })}
                    placeholder="VF1XXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="immatriculation">Immatriculation</Label>
                  <Input
                    id="immatriculation"
                    value={editFormData.immatriculation}
                    onChange={(e) => setEditFormData({ ...editFormData, immatriculation: e.target.value })}
                    placeholder="AA-123-BB"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type_mine">Type mine</Label>
                  <Input
                    id="type_mine"
                    value={editFormData.type_mine}
                    onChange={(e) => setEditFormData({ ...editFormData, type_mine: e.target.value })}
                    placeholder="Type mine"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_mise_circulation">Date de mise en circulation</Label>
                  <Input
                    id="date_mise_circulation"
                    type="date"
                    value={editFormData.date_mise_circulation}
                    onChange={(e) => setEditFormData({ ...editFormData, date_mise_circulation: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Informations du propriétaire */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold">Informations du propriétaire</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nom_proprietaire">Nom du propriétaire *</Label>
                  <Input
                    id="nom_proprietaire"
                    value={editFormData.nom_proprietaire}
                    onChange={(e) => setEditFormData({ ...editFormData, nom_proprietaire: e.target.value })}
                    placeholder="Nom complet"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adresse_proprietaire">Adresse</Label>
                  <Input
                    id="adresse_proprietaire"
                    value={editFormData.adresse_proprietaire}
                    onChange={(e) => setEditFormData({ ...editFormData, adresse_proprietaire: e.target.value })}
                    placeholder="Adresse complète"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="telephone_proprietaire">Téléphone</Label>
                    <Input
                      id="telephone_proprietaire"
                      value={editFormData.telephone_proprietaire}
                      onChange={(e) => setEditFormData({ ...editFormData, telephone_proprietaire: e.target.value })}
                      placeholder="06 12 34 56 78"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email_proprietaire">Email</Label>
                    <Input
                      id="email_proprietaire"
                      type="email"
                      value={editFormData.email_proprietaire}
                      onChange={(e) => setEditFormData({ ...editFormData, email_proprietaire: e.target.value })}
                      placeholder="email@exemple.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dimensions totales */}
            <div className="space-y-4 pt-4 border-t">
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
                Ces dimensions représentent l'espace réellement utilisable pour l'aménagement, sans les passages de
                roues, la cabine, etc.
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

            {/* Poids */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold">Poids du véhicule</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="poids_vide_kg">Poids à vide (kg)</Label>
                  <Input
                    id="poids_vide_kg"
                    type="number"
                    value={editFormData.poids_vide_kg}
                    onChange={(e) => setEditFormData({ ...editFormData, poids_vide_kg: e.target.value })}
                    placeholder="2000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="charge_utile_kg">Charge utile (kg)</Label>
                  <Input
                    id="charge_utile_kg"
                    type="number"
                    value={editFormData.charge_utile_kg}
                    onChange={(e) => setEditFormData({ ...editFormData, charge_utile_kg: e.target.value })}
                    placeholder="1000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ptac_kg">PTAC (kg)</Label>
                  <Input
                    id="ptac_kg"
                    type="number"
                    value={editFormData.ptac_kg}
                    onChange={(e) => setEditFormData({ ...editFormData, ptac_kg: e.target.value })}
                    placeholder="3000"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditDimensionsOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveDimensions}>Enregistrer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetail;
