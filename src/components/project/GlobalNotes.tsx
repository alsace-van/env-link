import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NoteWithProject {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  projects: { nom_projet: string } | null;
}

export const GlobalNotes = () => {
  const [notes, setNotes] = useState<NoteWithProject[]>([]);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id);

    if (!projects) return;

    const projectIds = projects.map((p) => p.id);

    const { data } = await supabase
      .from("project_notes")
      .select("id, title, content, created_at, project_id, projects(nom_projet)")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
      .limit(20);

    setNotes((data as any) || []);
  };

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune note</p>
        ) : (
          notes.map((note) => (
            <Card key={note.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex justify-between items-start">
                  <span>{note.title}</span>
                  <Badge variant="outline" className="text-xs">
                    {note.projects?.nom_projet || "Projet"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {note.content}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </ScrollArea>
  );
};