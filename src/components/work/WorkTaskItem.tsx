import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, User, Calendar, BookOpen, AlertCircle, Trash2, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CompleteTaskDialog } from "./CompleteTaskDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  display_order: number;
}

interface WorkTaskItemProps {
  task: {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    completed_at?: string;
    completed_by?: string;
    estimated_hours?: number;
    actual_hours?: number;
    scheduled_date?: string;
    template_id?: string;
    blocked_reason?: string;
  };
  onToggleComplete: (taskId: string, actualHours: number | null) => void;
  onEditTime: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export const WorkTaskItem = ({ task, onToggleComplete, onEditTime, onDelete }: WorkTaskItemProps) => {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);

  useEffect(() => {
    loadSubtasks();
  }, [task.id]);

  const loadSubtasks = async () => {
    const { data, error } = await supabase
      .from("project_todo_subtasks")
      .select("*")
      .eq("todo_id", task.id)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error loading subtasks:", error);
    } else {
      setSubtasks(data || []);
    }
  };

  const addSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;

    const { error } = await supabase
      .from("project_todo_subtasks")
      .insert({
        todo_id: task.id,
        title: newSubtaskTitle,
        display_order: subtasks.length,
      });

    if (error) {
      toast.error("Erreur lors de l'ajout de la sous-tâche");
    } else {
      setNewSubtaskTitle("");
      setShowSubtaskInput(false);
      loadSubtasks();
    }
  };

  const toggleSubtask = async (subtaskId: string, completed: boolean) => {
    const { error } = await supabase
      .from("project_todo_subtasks")
      .update({ completed: !completed })
      .eq("id", subtaskId);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      loadSubtasks();
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    const { error } = await supabase
      .from("project_todo_subtasks")
      .delete()
      .eq("id", subtaskId);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      loadSubtasks();
    }
  };

  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const totalSubtasks = subtasks.length;

  const handleCheckChange = (checked: boolean) => {
    if (checked && !task.completed) {
      setShowCompleteDialog(true);
    } else if (!checked && task.completed) {
      // Uncheck - just toggle back
      onToggleComplete(task.id, null);
    }
  };

  const handleComplete = (actualHours: number | null) => {
    onToggleComplete(task.id, actualHours);
  };

  const isOverdue = task.scheduled_date && !task.completed && 
    new Date(task.scheduled_date) < new Date();

  return (
    <>
      <div
        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
          task.completed ? "bg-muted/50 border-muted" : "bg-background hover:border-primary/50"
        }`}
      >
        <Checkbox
          checked={task.completed}
          onCheckedChange={handleCheckChange}
          className="mt-1"
        />

        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className={`font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                {task.title}
              </h4>
              {task.description && (
                <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
              )}
            </div>
            
            {task.completed && (
              <Badge variant="default" className="bg-green-600">
                ✓ Terminé
              </Badge>
            )}
            {isOverdue && (
              <Badge variant="destructive">
                ⏰ En retard
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {task.template_id && (
              <Badge variant="outline" className="gap-1">
                <BookOpen className="h-3 w-3" />
                Template
              </Badge>
            )}

            {task.completed ? (
              <>
                {task.actual_hours !== null && task.actual_hours !== undefined ? (
                  <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    <Clock className="h-3 w-3" />
                    {task.actual_hours}h réelles
                    {task.estimated_hours && ` (estimé: ${task.estimated_hours}h)`}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 bg-gray-100 text-gray-800 dark:bg-gray-800">
                    <Clock className="h-3 w-3" />
                    Temps non renseigné
                  </Badge>
                )}
                {task.completed_at && (
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(task.completed_at), "dd MMM yyyy", { locale: fr })}
                  </Badge>
                )}
              </>
            ) : (
              <>
                {task.estimated_hours && (
                  <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                    <Clock className="h-3 w-3" />
                    {task.estimated_hours}h estimées
                  </Badge>
                )}
                {task.scheduled_date && (
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(task.scheduled_date), "dd MMM yyyy", { locale: fr })}
                  </Badge>
                )}
              </>
            )}

            {task.blocked_reason && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                📦 Attend livraison
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {task.completed && task.actual_hours === null && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEditTime(task.id)}
              className="text-xs"
            >
              Ajouter le temps
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(task.id)}
            className="text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CompleteTaskDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        taskTitle={task.title}
        estimatedHours={task.estimated_hours}
        onComplete={handleComplete}
      />
    </>
  );
};