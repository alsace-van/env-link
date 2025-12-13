import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectData } from "@/contexts/ProjectDataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trash2, Plus, Calendar as CalendarIcon, History, ListTodo, CalendarX } from "lucide-react";
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
  scheduled_date: string | null;
  created_at: string;
  updated_at: string;
  projects?: {
    name?: string;
    nom?: string;
  };
}

export const GlobalTodoList = () => {
  const projectId = null; // Global todos don't need a specific project
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [showCompleted, setShowCompleted] = useState(false);
  const { refreshData } = useProjectData();

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // 🔥 Ne charger que les tâches PLANIFIÉES (avec scheduled_date)
    const { data, error } = await supabase
      .from("project_todos")
      .select("*, projects(name, nom)")
      .eq("user_id", user.id)
      .not("scheduled_date", "is", null)
      .order("scheduled_date", { ascending: true });

    if (error) {
      console.error(error);
    } else {
      setTodos(data || []);
    }
  };

  const addTodo = async () => {
    if (!newTodo.trim()) return;

    toast.error("Veuillez sélectionner un projet pour ajouter une tâche");
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    const newCompleted = !completed;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Importer dynamiquement pour éviter les dépendances circulaires
    const { syncTaskCompleted } = await import("@/utils/taskSync");

    const success = await syncTaskCompleted(id, newCompleted, user.id);

    if (success) {
      loadTodos();
      refreshData();
      toast.success(newCompleted ? "Tâche terminée" : "Tâche réactivée");
    } else {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const deleteTodo = async (id: string) => {
    // 🔥 Déplanifier au lieu de supprimer (retirer scheduled_date)
    const { error } = await supabase.from("project_todos").update({ scheduled_date: null }).eq("id", id);
    if (!error) {
      toast.success("Tâche retirée du planning");
      loadTodos();
      refreshData(); // Mettre à jour le calendrier
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Input
          placeholder="Sélectionnez un projet pour ajouter une tâche..."
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && addTodo()}
          disabled
        />
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("flex-1 justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
                disabled
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
          <Button size="icon" onClick={addTodo} disabled>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bouton pour basculer entre actives et historique */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{showCompleted ? "Tâches terminées" : "Tâches planifiées"}</h3>
        <Button variant="outline" size="sm" onClick={() => setShowCompleted(!showCompleted)} className="gap-2">
          {showCompleted ? (
            <>
              <ListTodo className="h-4 w-4" />
              Actives
            </>
          ) : (
            <>
              <History className="h-4 w-4" />
              Terminées
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2">
        {todos
          .filter((todo) => (showCompleted ? todo.completed : !todo.completed))
          .map((todo) => (
            <div key={todo.id} className="flex flex-col gap-1 p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Checkbox checked={todo.completed} onCheckedChange={() => toggleTodo(todo.id, todo.completed)} />
                <span className={`flex-1 text-sm ${todo.completed ? "line-through text-muted-foreground" : ""}`}>
                  {todo.title}
                </span>
                <Button variant="ghost" size="sm" onClick={() => deleteTodo(todo.id)} title="Retirer du planning">
                  <CalendarX className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 ml-6 text-xs text-muted-foreground flex-wrap">
                {/* Nom du projet */}
                {todo.projects && (
                  <Badge variant="secondary" className="text-xs">
                    {todo.projects.name || todo.projects.nom || "Sans projet"}
                  </Badge>
                )}
                {/* Date planifiée */}
                {todo.scheduled_date && (
                  <Badge variant="outline" className="text-xs">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {format(new Date(todo.scheduled_date), "dd MMM", { locale: fr })}
                  </Badge>
                )}
                {todo.completed && <span className="text-green-600 dark:text-green-400 font-medium">✓ Terminée</span>}
              </div>
            </div>
          ))}
        {todos.filter((todo) => (showCompleted ? todo.completed : !todo.completed)).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {showCompleted ? "Aucune tâche terminée" : "Aucune tâche planifiée"}
          </p>
        )}
      </div>
    </div>
  );
};
