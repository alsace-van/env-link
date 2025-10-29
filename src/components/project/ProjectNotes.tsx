import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

interface Note {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
}

interface ProjectNotesProps {
  projectId: string | null;
}

export const ProjectNotes = ({ projectId }: ProjectNotesProps) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState({ title: "", content: "" });
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  useEffect(() => {
    if (projectId) {
      loadNotes();
    }
  }, [projectId]);

  const loadNotes = async () => {
    if (!projectId) return;

    const { data, error } = await supabase
      .from("project_notes")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

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
    });

    if (error) {
      toast.error("Erreur lors de l'ajout");
    } else {
      setNewNote({ title: "", content: "" });
      loadNotes();
    }
  };

  const updateNote = async () => {
    if (!editingNote) return;

    const { error } = await supabase
      .from("project_notes")
      .update({ title: editingNote.title, content: editingNote.content })
      .eq("id", editingNote.id);

    if (!error) {
      setEditingNote(null);
      loadNotes();
    }
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from("project_notes").delete().eq("id", id);
    if (!error) loadNotes();
  };

  if (!projectId) {
    return <p className="text-sm text-muted-foreground p-4">Sélectionnez un projet</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
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
            rows={3}
          />
          <Button size="sm" onClick={addNote} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </CardContent>
      </Card>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardHeader className="pb-2">
                {editingNote?.id === note.id ? (
                  <Input
                    value={editingNote.title}
                    onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  />
                ) : (
                  <CardTitle className="text-sm flex justify-between items-start">
                    <span>{note.title}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingNote(note)}>
                        Modifier
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteNote(note.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                )}
              </CardHeader>
              <CardContent>
                {editingNote?.id === note.id ? (
                  <>
                    <Textarea
                      value={editingNote.content || ""}
                      onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                      rows={4}
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
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};