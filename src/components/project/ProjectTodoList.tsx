import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: string;
  due_date: string | null;
}

interface ProjectTodoListProps {
  projectId: string | null;
}

export const ProjectTodoList = ({ projectId }: ProjectTodoListProps) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");

  useEffect(() => {
    if (projectId) {
      loadTodos();
    }
  }, [projectId]);

  const loadTodos = async () => {
    if (!projectId) return;

    const { data, error } = await supabase
      .from("project_todos")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setTodos(data || []);
    }
  };

  const addTodo = async () => {
    if (!newTodo.trim() || !projectId) return;

    const { error } = await supabase.from("project_todos").insert({
      project_id: projectId,
      title: newTodo,
    });

    if (error) {
      toast.error("Erreur lors de l'ajout");
    } else {
      setNewTodo("");
      loadTodos();
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    const { error } = await supabase
      .from("project_todos")
      .update({ completed: !completed })
      .eq("id", id);

    if (!error) loadTodos();
  };

  const deleteTodo = async (id: string) => {
    const { error } = await supabase.from("project_todos").delete().eq("id", id);
    if (!error) loadTodos();
  };

  if (!projectId) {
    return <p className="text-sm text-muted-foreground p-4">Sélectionnez un projet</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Nouvelle tâche..."
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && addTodo()}
        />
        <Button size="sm" onClick={addTodo}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {todos.map((todo) => (
            <div key={todo.id} className="flex items-center gap-2 p-2 rounded-lg border">
              <Checkbox
                checked={todo.completed}
                onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
              />
              <span className={`flex-1 text-sm ${todo.completed ? "line-through text-muted-foreground" : ""}`}>
                {todo.title}
              </span>
              <Button variant="ghost" size="sm" onClick={() => deleteTodo(todo.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};