import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trash2, Plus, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: string;
  due_date: string | null;
  created_at: string;
}

interface ProjectTodoListProps {
  projectId: string | null;
}

export const ProjectTodoList = ({ projectId }: ProjectTodoListProps) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [dueDate, setDueDate] = useState<Date>();

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
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
    });

    if (error) {
      toast.error("Erreur lors de l'ajout");
    } else {
      setNewTodo("");
      setDueDate(undefined);
      loadTodos();
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    const { error } = await supabase.from("project_todos").update({ completed: !completed }).eq("id", id);

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
    <div className="space-y-2">
      <div className="space-y-2">
        <Input
          placeholder="Nouvelle tâche..."
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && addTodo()}
        />
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("flex-1 justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {dueDate ? format(dueDate, "PPP", { locale: fr }) : "Date limite"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={setDueDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button size="icon" onClick={addTodo}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {todos.map((todo) => (
            <div key={todo.id} className="flex flex-col gap-1 p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Checkbox checked={todo.completed} onCheckedChange={() => toggleTodo(todo.id, todo.completed)} />
                <span className={`flex-1 text-sm ${todo.completed ? "line-through text-muted-foreground" : ""}`}>
                  {todo.title}
                </span>
                <Button variant="ghost" size="sm" onClick={() => deleteTodo(todo.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 ml-6 text-xs text-muted-foreground">
                {todo.due_date && (
                  <Badge variant={new Date(todo.due_date) < new Date() && !todo.completed ? "destructive" : "outline"}>
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {format(new Date(todo.due_date), "dd MMM yyyy", { locale: fr })}
                  </Badge>
                )}
                <span>Créé le {format(new Date(todo.created_at), "dd/MM/yyyy à HH:mm", { locale: fr })}</span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
