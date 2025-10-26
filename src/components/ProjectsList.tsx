import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Truck, Calendar, Trash2 } from "lucide-react";
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
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleDelete(project.id, e)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <Calendar className="h-3 w-3" />
              {format(new Date(project.created_at), "dd MMMM yyyy", { locale: fr })}
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
};

export default ProjectsList;
