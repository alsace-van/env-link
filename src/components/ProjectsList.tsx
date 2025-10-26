import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Truck, Calendar, Trash2, Edit } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Project {
  id: string;
  nom_projet: string | null;
  nom_proprietaire: string;
  immatriculation: string | null;
  numero_chassis: string | null;
  photo_url: string | null;
  vehicle_catalog_id: string | null;
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

  useEffect(() => {
    loadProjects();
  }, [refresh]);

  const loadProjects = async () => {
    setIsLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .select(`
        id,
        nom_projet,
        nom_proprietaire,
        immatriculation,
        numero_chassis,
        photo_url,
        vehicle_catalog_id,
        created_at,
        vehicles_catalog (
          marque,
          modele
        )
      `)
      .eq("user_id", user.id)
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
    setEditDialogOpen(true);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('project-photos')
        .upload(filePath, photoFile);

      if (uploadError) {
        toast.error("Erreur lors de l'upload de la photo");
        return;
      }

      const { data: urlData } = supabase.storage
        .from('project-photos')
        .getPublicUrl(filePath);

      photoUrl = urlData.publicUrl;
    }

    const { error } = await supabase
      .from("projects")
      .update({
        nom_projet: formData.get("nom_projet") as string || null,
        nom_proprietaire: formData.get("nom_proprietaire") as string,
        immatriculation: formData.get("immatriculation") as string || null,
        numero_chassis: formData.get("numero_chassis") as string || null,
        photo_url: photoUrl,
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
    loadProjects();
  };

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce projet ?")) {
      return;
    }

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

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
          <p className="text-muted-foreground">
            Aucun projet pour le moment.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Créez votre premier projet avec le formulaire ci-contre.
          </p>
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
                  <span className="truncate">
                    {project.nom_projet || project.nom_proprietaire}
                  </span>
                </CardTitle>
                <CardDescription className="mt-2 space-y-1">
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
                </CardDescription>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le projet</DialogTitle>
            <DialogDescription>
              Modifiez les informations du projet
            </DialogDescription>
          </DialogHeader>
          {editingProject && (
            <form onSubmit={handleUpdateProject} className="space-y-4">
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
                <Input
                  id="edit_photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                />
                {photoPreview && (
                  <div className="mt-2">
                    <img
                      src={photoPreview}
                      alt="Aperçu"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>

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
                <Label htmlFor="edit_immatriculation">Immatriculation</Label>
                <Input
                  id="edit_immatriculation"
                  name="immatriculation"
                  defaultValue={editingProject.immatriculation || ""}
                  placeholder="AB-123-CD"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_numero_chassis">Numéro de châssis</Label>
                <Input
                  id="edit_numero_chassis"
                  name="numero_chassis"
                  defaultValue={editingProject.numero_chassis || ""}
                  placeholder="VF1234567890ABCDE"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditingProject(null);
                    setPhotoFile(null);
                    setPhotoPreview(null);
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit">
                  Enregistrer
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsList;
