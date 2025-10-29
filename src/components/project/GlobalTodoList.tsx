import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TodoWithProject {
  id: string;
  title: string;
  completed: boolean;
  project: { nom_projet: string };
}

export const GlobalTodoList = () => {
  const [todos, setTodos] = useState<TodoWithProject[]>([]);

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id);

    if (!projects) return;

    const projectIds = projects.map((p) => p.id);

    const { data } = await supabase
      .from("project_todos")
      .select("id, title, completed, project_id, projects(nom_projet)")
      .in("project_id", projectIds)
      .eq("completed", false)
      .order("created_at", { ascending: false });

    setTodos((data as any) || []);
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    const { error } = await supabase
      .from("project_todos")
      .update({ completed: !completed })
      .eq("id", id);

    if (!error) loadTodos();
  };

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2">
        {todos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune tâche en cours</p>
        ) : (
          todos.map((todo) => (
            <div key={todo.id} className="flex items-center gap-2 p-2 rounded-lg border">
              <Checkbox
                checked={todo.completed}
                onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
              />
              <div className="flex-1">
                <p className="text-sm">{todo.title}</p>
                <Badge variant="outline" className="text-xs mt-1">
                  {(todo.project as any).nom_projet || "Projet"}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
};