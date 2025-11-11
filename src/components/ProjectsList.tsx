import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Truck, Calendar, Trash2, Edit } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface VehicleCatalog {
  id: string;
  marque: string;
  modele: string;
  longueur_mm: number;
  largeur_mm?: number;
  hauteur_mm?: number;
  poids_vide_kg?: number;
  charge_utile_kg?: number;
  ptac_kg?: number;
}

interface Project {
  id: string;
  nom_projet: string | null;
  nom_proprietaire: string;
  adresse_proprietaire: string | null;
  telephone_proprietaire: string | null;
  email_proprietaire: string | null;
  immatriculation: string | null;
  numero_chassis: string | null;
  date_premiere_circulation: string | null;
  type_mine: string | null;
  photo_url: string | null;
  vehicle_catalog_id: string | null;
  longueur_mm: number | null;
  largeur_mm: number | null;
  hauteur_mm: number | null;
  poids_vide_kg: number | null;
  charge_utile_kg: number | null;
  ptac_kg: number | null;
  created_at: string;
  vehicles_catalog?: {
    marque: string;
    modele: string;
  } | null;
}

interface ProjectsListProps {
  refresh: number;
  onProjectSelect: (projectId: string) => void;
}

const ProjectsList = ({ refresh, onProjectSelect }: ProjectsListProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<VehicleCatalog[]>([]);
  const [selectedMarque, setSelectedMarque] = useState<string>("");
  const [selectedModele, setSelectedModele] = useState<string>("");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleCatalog | null>(null);
  const [customPoidsVide, setCustomPoidsVide] = useState<string>("");
  const [customPtac, setCustomPtac] = useState<string>("");

  const availableMarques = Array.from(new Set(vehicles.map((v) => v.marque))).sort();

  const availableModeles = selectedMarque
    ? Array.from(new Set(vehicles.filter((v) => v.marque === selectedMarque).map((v) => v.modele))).sort()
    : [];

  const availableDimensions =
    selectedMarque && selectedModele
      ? vehicles.filter((v) => v.marque === selectedMarque && v.modele === selectedModele)
      : [];

  useEffect(() => {
    loadProjects();
    loadVehicles();
  }, [refresh]);

  const loadVehicles = async () => {
    const { data, error } = await supabase
      .from("vehicles_catalog")
      .select("*")
      .order("marque", { ascending: true })
      .order("modele", { ascending: true });

    if (error) {
      toast.error("Erreur lors du chargement des véhicules");
      return;
    }

    setVehicles(data || []);
  };

  const loadProjects = async () => {
    setIsLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .select(
        `
        id,
        nom_projet,
        nom_proprietaire,
        adresse_proprietaire,
        telephone_proprietaire,
        email_proprietaire,
        immatriculation,
        numero_chassis,
        date_premiere_circulation,
        type_mine,
        photo_url,
        vehicle_catalog_id,
        longueur_mm,
        largeur_mm,
        hauteur_mm,
        poids_vide_kg,
        charge_utile_kg,
        ptac_kg,
        created_at,
        vehicles_catalog (
          marque,
          modele
        )
      `,
      )
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    setIsLoading(false);

    if (error) {
      toast.error("Erreur lors du chargement des projets");
      console.error(error);
      return;
    }

    setProjects(data || []);
  };

  const handleEdit = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(project);
    setPhotoPreview(project.photo_url);

    // Initialize vehicle selection if project has a vehicle
    if (project.vehicles_catalog) {
      setSelectedMarque(project.vehicles_catalog.marque);
      setSelectedModele(project.vehicles_catalog.modele);

      // Find and set the selected vehicle
      const vehicle = vehicles.find((v) => v.id === project.vehicle_catalog_id);
      if (vehicle) {
        setSelectedVehicle(vehicle);
      }
    }

    setCustomPoidsVide(project.poids_vide_kg?.toString() || "");
    setCustomPtac(project.ptac_kg?.toString() || "");
    setEditDialogOpen(true);
  };

  const handleMarqueChange = (marque: string) => {
    setSelectedMarque(marque);
    setSelectedModele("");
    setSelectedVehicle(null);
  };

  const handleModeleChange = (modele: string) => {
    setSelectedModele(modele);
    setSelectedVehicle(null);
  };

  const handleDimensionChange = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    setSelectedVehicle(vehicle || null);
    if (vehicle) {
      setCustomPoidsVide(vehicle.poids_vide_kg?.toString() || "");
      setCustomPtac(vehicle.ptac_kg?.toString() || "");
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProject) return;

    const formData = new FormData(e.currentTarget);
    let photoUrl = editingProject.photo_url;

    // Upload new photo if selected
    if (photoFile) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = photoFile.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from("project-photos").upload(filePath, photoFile);

      if (uploadError) {
        toast.error("Erreur lors de l'upload de la photo");
        return;
      }

      // Use public URL (permanent, no expiration)
      const { data: publicUrlData } = supabase.storage.from("project-photos").getPublicUrl(filePath);

      if (!publicUrlData) {
        toast.error("Erreur lors de la création de l'URL de la photo");
        return;
      }

      photoUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabase
      .from("projects")
      .update({
        nom: (formData.get("nom_projet") as string) || null,
        nom_proprietaire: formData.get("nom_proprietaire") as string,
        adresse_proprietaire: (formData.get("adresse_proprietaire") as string) || null,
        telephone_proprietaire: (formData.get("telephone_proprietaire") as string) || null,
        email_proprietaire: (formData.get("email_proprietaire") as string) || null,
        immatriculation: (formData.get("immatriculation") as string) || null,
        numero_chassis: (formData.get("numero_chassis") as string) || null,
        date_premiere_circulation: (formData.get("date_mise_circulation") as string) || null,
        type_mine: (formData.get("type_mine") as string) || null,
        photo_url: photoUrl,
        vehicle_catalog_id: selectedVehicle?.id || null,
        longueur_mm: selectedVehicle?.longueur_mm || null,
        largeur_mm: selectedVehicle?.largeur_mm || null,
        hauteur_mm: selectedVehicle?.hauteur_mm || null,
        poids_vide_kg: customPoidsVide ? parseInt(customPoidsVide) : selectedVehicle?.poids_vide_kg || null,
        charge_utile_kg: selectedVehicle?.charge_utile_kg || null,
        ptac_kg: customPtac ? parseInt(customPtac) : selectedVehicle?.ptac_kg || null,
      })
      .eq("id", editingProject.id);

    if (error) {
      toast.error("Erreur lors de la modification");
      return;
    }

    toast.success("Projet modifié");
    setEditDialogOpen(false);
    setEditingProject(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setSelectedMarque("");
    setSelectedModele("");
    setSelectedVehicle(null);
    setCustomPoidsVide("");
    setCustomPtac("");
    loadProjects();
  };

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm("Êtes-vous sûr de vouloir supprimer ce projet ?")) {
      return;
    }

    const { error } = await supabase.from("projects").delete().eq("id", projectId);

    if (error) {
      toast.error("Erreur lors de la suppression");
      return;
    }

    toast.success("Projet supprimé");
    loadProjects();
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-24 bg-muted/50" />
          </Card>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aucun projet pour le moment.</p>
          <p className="text-sm text-muted-foreground mt-2">Créez votre premier projet avec le formulaire ci-contre.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <Card
          key={project.id}
          className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
          onClick={() => onProjectSelect(project.id)}
        >
          <CardHeader>
            <div className="flex items-start gap-4">
              {project.photo_url && (
                <img
                  src={project.photo_url}
                  alt={project.nom_projet || "Photo du projet"}
                  className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="truncate">{project.nom_projet || project.nom_proprietaire}</span>
                </CardTitle>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {project.vehicles_catalog && (
                    <div>
                      <Badge variant="secondary">
                        {project.vehicles_catalog.marque} {project.vehicles_catalog.modele}
                      </Badge>
                    </div>
                  )}
                  {project.immatriculation && (
                    <div className="text-xs">
                      <span className="font-medium">Immat:</span> {project.immatriculation}
                    </div>
                  )}
                  {project.numero_chassis && (
                    <div className="text-xs">
                      <span className="font-medium">Châssis:</span> {project.numero_chassis}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleEdit(project, e)}
                  className="text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDelete(project.id, e)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <Calendar className="h-3 w-3" />
              {format(new Date(project.created_at), "dd MMMM yyyy", { locale: fr })}
            </div>
          </CardHeader>
        </Card>
      ))}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le projet</DialogTitle>
            <DialogDescription>Modifiez toutes les informations du projet</DialogDescription>
          </DialogHeader>
          {editingProject && (
            <form onSubmit={handleUpdateProject} className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                {/* Colonne 1: Informations Projet */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground">Informations Projet</h3>

                  <div className="space-y-2">
                    <Label htmlFor="edit_nom_projet">Nom du projet</Label>
                    <Input
                      id="edit_nom_projet"
                      name="nom_projet"
                      defaultValue={editingProject.nom_projet || ""}
                      placeholder="Aménagement camping-car"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_photo">Photo du projet</Label>
                    <Input id="edit_photo" type="file" accept="image/*" onChange={handlePhotoChange} />
                    {photoPreview && (
                      <div className="mt-2">
                        <img src={photoPreview} alt="Aperçu" className="w-full h-32 object-cover rounded-lg" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Colonne 2: Informations Propriétaire */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground">Informations Propriétaire</h3>

                  <div className="space-y-2">
                    <Label htmlFor="edit_nom_proprietaire">Nom du propriétaire *</Label>
                    <Input
                      id="edit_nom_proprietaire"
                      name="nom_proprietaire"
                      defaultValue={editingProject.nom_proprietaire}
                      required
                      placeholder="Jean Dupont"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_adresse_proprietaire">Adresse</Label>
                    <Input
                      id="edit_adresse_proprietaire"
                      name="adresse_proprietaire"
                      defaultValue={editingProject.adresse_proprietaire || ""}
                      placeholder="123 rue de la Paix, 75000 Paris"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_telephone_proprietaire">Téléphone</Label>
                    <Input
                      id="edit_telephone_proprietaire"
                      name="telephone_proprietaire"
                      type="tel"
                      defaultValue={editingProject.telephone_proprietaire || ""}
                      placeholder="06 12 34 56 78"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_email_proprietaire">Email</Label>
                    <Input
                      id="edit_email_proprietaire"
                      name="email_proprietaire"
                      type="email"
                      defaultValue={editingProject.email_proprietaire || ""}
                      placeholder="contact@example.com"
                    />
                  </div>
                </div>

                {/* Colonne 3: Informations Véhicule */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground">Informations Véhicule</h3>

                  <div className="space-y-2">
                    <Label htmlFor="edit_marque">Marque</Label>
                    <Select value={selectedMarque} onValueChange={handleMarqueChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez une marque" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMarques.map((marque) => (
                          <SelectItem key={marque} value={marque}>
                            {marque}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedMarque && (
                    <div className="space-y-2">
                      <Label htmlFor="edit_modele">Modèle</Label>
                      <Select value={selectedModele} onValueChange={handleModeleChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un modèle" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableModeles.map((modele) => (
                            <SelectItem key={modele} value={modele}>
                              {modele}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedMarque && selectedModele && availableDimensions.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="edit_dimension">Dimensions</Label>
                      <Select value={selectedVehicle?.id} onValueChange={handleDimensionChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez les dimensions" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDimensions.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              L: {vehicle.longueur_mm}mm × l: {vehicle.largeur_mm}mm × H: {vehicle.hauteur_mm}mm
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="edit_numero_chassis">Numéro de chassis</Label>
                    <Input
                      id="edit_numero_chassis"
                      name="numero_chassis"
                      defaultValue={editingProject.numero_chassis || ""}
                      placeholder="VF1234567890ABCDE"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_immatriculation">Immatriculation</Label>
                    <Input
                      id="edit_immatriculation"
                      name="immatriculation"
                      defaultValue={editingProject.immatriculation || ""}
                      placeholder="AB-123-CD"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_date_mise_circulation">Date de mise en circulation</Label>
                    <Input
                      id="edit_date_mise_circulation"
                      name="date_mise_circulation"
                      type="date"
                      defaultValue={editingProject.date_premiere_circulation || ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_type_mine">Type mine</Label>
                    <Input
                      id="edit_type_mine"
                      name="type_mine"
                      defaultValue={editingProject.type_mine || ""}
                      placeholder="CTTE, VASP, Ambulance..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit_poids_vide">Poids à vide (kg)</Label>
                      <Input
                        id="edit_poids_vide"
                        type="number"
                        value={customPoidsVide}
                        onChange={(e) => setCustomPoidsVide(e.target.value)}
                        placeholder="1800"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit_ptac">PTAC (kg)</Label>
                      <Input
                        id="edit_ptac"
                        type="number"
                        value={customPtac}
                        onChange={(e) => setCustomPtac(e.target.value)}
                        placeholder="3000"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditingProject(null);
                    setPhotoFile(null);
                    setPhotoPreview(null);
                    setSelectedMarque("");
                    setSelectedModele("");
                    setSelectedVehicle(null);
                    setCustomPoidsVide("");
                    setCustomPtac("");
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit">Enregistrer</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsList;
