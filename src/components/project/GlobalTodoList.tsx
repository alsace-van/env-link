import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface TodoWithProject {
  id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  created_at: string;
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
      .select("id, title, completed, due_date, created_at, project_id, projects(nom_projet)")
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
            <div key={todo.id} className="flex flex-col gap-1 p-3 rounded-lg border">
              <div className="flex items-center gap-2">
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
              {todo.due_date && (
                <div className="ml-6">
                  <Badge 
                    variant={
                      new Date(todo.due_date) < new Date() && !todo.completed
                        ? "destructive"
                        : "outline"
                    }
                    className="text-xs"
                  >
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {format(new Date(todo.due_date), "dd MMM yyyy", { locale: fr })}
                  </Badge>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
};