import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { History, Clock, CheckCircle2, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface NoteWithProject {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at?: string;
  archived: boolean;
  project_id: string;
  projects: { id: string; nom_projet: string } | null;
}

interface Project {
  id: string;
  nom_projet: string;
}

export const GlobalNotes = () => {
  const [notes, setNotes] = useState<NoteWithProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    loadProjects();
    loadNotes();
  }, [selectedProject, showArchived]);

  const loadProjects = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("projects")
      .select("id, nom_projet")
      .eq("user_id", user.id)
      .order("nom_projet");

    setProjects(data || []);
  };

  const loadNotes = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: projectsData } = await supabase.from("projects").select("id").eq("user_id", user.id);

    if (!projectsData) return;

    const projectIds = projectsData.map((p) => p.id);

    let query = supabase
      .from("project_notes")
      .select("id, title, content, created_at, updated_at, archived, project_id, projects(id, nom_projet)")
      .in("project_id", projectIds)
      .eq("archived", showArchived)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (selectedProject !== "all") {
      query = query.eq("project_id", selectedProject);
    }

    const { data } = await query;
    setNotes((data as any) || []);
  };

  const archiveNote = async (id: string) => {
    const { error } = await supabase
      .from("project_notes")
      .update({ archived: true, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      loadNotes();
      toast.success("Note soldée");
    }
  };

  const restoreNote = async (id: string) => {
    const { error } = await supabase
      .from("project_notes")
      .update({ archived: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      loadNotes();
      toast.success("Note restaurée");
    }
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from("project_notes").delete().eq("id", id);
    if (!error) {
      loadNotes();
      toast.success("Note supprimée");
    }
  };

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: fr,
    });
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Filtres */}
      <div className="space-y-2">
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Tous les projets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les projets</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.nom_projet}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={showArchived ? "default" : "outline"}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
          className="w-full"
        >
          <History className="h-4 w-4 mr-2" />
          {showArchived ? "Notes actives" : "Historique"}
        </Button>
      </div>

      {/* Liste des notes */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-4">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {showArchived ? "Aucune note archivée" : "Aucune note"}
            </p>
          ) : (
            notes.map((note) => (
              <Card key={note.id} className={showArchived ? "opacity-60" : ""}>
                <CardHeader className="pb-2 space-y-1">
                  <CardTitle className="text-sm flex justify-between items-start">
                    <span className="flex-1 line-clamp-1">{note.title}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {note.projects?.nom_projet || "Projet"}
                      </Badge>
                      {!showArchived && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => archiveNote(note.id)}
                          title="Solder"
                          className="h-6 w-6 p-0"
                        >
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        </Button>
                      )}
                      {showArchived && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => restoreNote(note.id)}
                          title="Restaurer"
                          className="h-6 w-6 p-0 text-xs"
                        >
                          ↻
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => deleteNote(note.id)} className="h-6 w-6 p-0">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardTitle>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(note.updated_at || note.created_at)}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <p className="text-xs text-muted-foreground line-clamp-2">{note.content}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
