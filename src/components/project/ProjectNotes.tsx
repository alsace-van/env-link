import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Save, CheckCircle2, History, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Note {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at?: string;
  archived: boolean;
}

interface ProjectNotesProps {
  projectId: string | null;
}

export const ProjectNotes = ({ projectId }: ProjectNotesProps) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState({ title: "", content: "" });
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadNotes();
    }
  }, [projectId, showArchived]);

  const loadNotes = async () => {
    if (!projectId) return;

    const { data, error } = await supabase
      .from("project_notes")
      .select("*")
      .eq("project_id", projectId)
      .eq("archived", showArchived)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setNotes(data || []);
    }
  };

  const addNote = async () => {
    if (!newNote.title.trim() || !projectId) return;

    const { error } = await supabase.from("project_notes").insert({
      project_id: projectId,
      title: newNote.title,
      content: newNote.content,
      archived: false,
    });

    if (error) {
      toast.error("Erreur lors de l'ajout");
    } else {
      setNewNote({ title: "", content: "" });
      loadNotes();
      toast.success("Note ajoutée");
    }
  };

  const updateNote = async () => {
    if (!editingNote) return;

    const { error } = await supabase
      .from("project_notes")
      .update({
        title: editingNote.title,
        content: editingNote.content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingNote.id);

    if (!error) {
      setEditingNote(null);
      loadNotes();
      toast.success("Note modifiée");
    }
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

  if (!projectId) {
    return <p className="text-sm text-muted-foreground p-4">Sélectionnez un projet</p>;
  }

  return (
    <div className="space-y-3">
      {/* Bouton pour afficher/masquer l'historique */}
      <div className="flex items-center justify-between">
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

      {/* Formulaire d'ajout (seulement pour notes actives) */}
      {!showArchived && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Nouvelle note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              placeholder="Titre..."
              value={newNote.title}
              onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
            />
            <Textarea
              placeholder="Contenu..."
              value={newNote.content}
              onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
              rows={2}
            />
            <Button size="sm" onClick={addNote} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Liste des notes */}
      <div className="space-y-2">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {showArchived ? "Aucune note archivée" : "Aucune note"}
          </p>
        ) : (
          notes.map((note) => (
            <Card key={note.id} className={showArchived ? "opacity-60" : ""}>
              <CardHeader className="pb-2 space-y-1">
                {editingNote?.id === note.id ? (
                  <Input
                    value={editingNote.title}
                    onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  />
                ) : (
                  <>
                    <CardTitle className="text-sm flex justify-between items-start">
                      <span className="flex-1">{note.title}</span>
                      <div className="flex gap-1">
                        {!showArchived && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => archiveNote(note.id)} title="Solder">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditingNote(note)}>
                              Modifier
                            </Button>
                          </>
                        )}
                        {showArchived && (
                          <Button variant="ghost" size="sm" onClick={() => restoreNote(note.id)} title="Restaurer">
                            Restaurer
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => deleteNote(note.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardTitle>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(note.updated_at || note.created_at)}</span>
                    </div>
                  </>
                )}
              </CardHeader>
              <CardContent className="pt-2">
                {editingNote?.id === note.id ? (
                  <>
                    <Textarea
                      value={editingNote.content || ""}
                      onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                      rows={3}
                    />
                    <Button size="sm" onClick={updateNote} className="mt-2">
                      <Save className="h-4 w-4 mr-2" />
                      Enregistrer
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
