// ============================================
// WorkTaskItem.tsx
// Affichage d'une tâche de travail
// + Forfait client avec calcul suggéré
// ============================================

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, Calendar, BookOpen, AlertCircle, Trash2, Plus, X, Euro, Calculator, Pencil } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CompleteTaskDialog } from "./CompleteTaskDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useHourlyRate } from "@/hooks/useHourlyRate";
import type { ProjectTodoSubtask } from "@/types/subtasks";

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
    forfait_ttc?: number;
  };
  onToggleComplete: (taskId: string, actualHours: number | null) => void;
  onEditTask: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onForfaitChange?: (taskId: string, forfait: number | null) => void;
}

export const WorkTaskItem = ({ task, onToggleComplete, onEditTask, onDelete, onForfaitChange }: WorkTaskItemProps) => {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [subtasks, setSubtasks] = useState<ProjectTodoSubtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [showForfaitPopover, setShowForfaitPopover] = useState(false);
  const [forfaitInput, setForfaitInput] = useState<string>("");

  const { hourlyRateTTC, calculateForfait } = useHourlyRate();

  // Calcul du forfait suggéré
  const suggestedForfait = task.estimated_hours ? calculateForfait(task.estimated_hours) : null;

  useEffect(() => {
    loadSubtasks();
  }, [task.id]);

  useEffect(() => {
    setForfaitInput(task.forfait_ttc?.toString() || "");
  }, [task.forfait_ttc]);

  const loadSubtasks = async () => {
    const { data, error } = await supabase
      .from("project_todo_subtasks" as any)
      .select("*")
      .eq("todo_id", task.id)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error loading subtasks:", error);
    } else {
      setSubtasks((data || []) as unknown as ProjectTodoSubtask[]);
    }
  };

  const addSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;

    const { error } = await supabase.from("project_todo_subtasks" as any).insert({
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
      .from("project_todo_subtasks" as any)
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
      .from("project_todo_subtasks" as any)
      .delete()
      .eq("id", subtaskId);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      loadSubtasks();
    }
  };

  const saveForfait = async () => {
    const forfait = forfaitInput ? parseFloat(forfaitInput) : null;

    const { error } = await (supabase as any).from("project_todos").update({ forfait_ttc: forfait }).eq("id", task.id);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      toast.success("Forfait enregistré");
      setShowForfaitPopover(false);
      onForfaitChange?.(task.id, forfait);
    }
  };

  const applySuggestedForfait = () => {
    if (suggestedForfait) {
      setForfaitInput(suggestedForfait.toString());
    }
  };

  const completedSubtasks = subtasks.filter((s) => s.completed).length;
  const totalSubtasks = subtasks.length;

  const handleCheckChange = (checked: boolean) => {
    if (checked && !task.completed) {
      setShowCompleteDialog(true);
    } else if (!checked && task.completed) {
      onToggleComplete(task.id, null);
    }
  };

  const handleComplete = (actualHours: number | null) => {
    onToggleComplete(task.id, actualHours);
  };

  const isOverdue = task.scheduled_date && !task.completed && new Date(task.scheduled_date) < new Date();

  // Calcul rentabilité si terminé
  const rentabilite =
    task.completed && task.actual_hours && task.forfait_ttc ? task.forfait_ttc / task.actual_hours : null;

  return (
    <>
      <div
        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
          task.completed ? "bg-muted/50 border-muted" : "bg-background hover:border-primary/50"
        }`}
      >
        <Checkbox checked={task.completed} onCheckedChange={handleCheckChange} className="mt-1" />

        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className={`font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                {task.title}
              </h4>
              {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
            </div>

            {task.completed && (
              <Badge variant="default" className="bg-green-600">
                ✓ Terminé
              </Badge>
            )}
            {isOverdue && <Badge variant="destructive">⏰ En retard</Badge>}
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
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                  >
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
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                  >
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

            {/* Forfait */}
            {task.forfait_ttc ? (
              <Popover open={showForfaitPopover} onOpenChange={setShowForfaitPopover}>
                <PopoverTrigger asChild>
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 cursor-pointer hover:bg-emerald-200"
                  >
                    <Euro className="h-3 w-3" />
                    {task.forfait_ttc}€ TTC
                    {rentabilite && (
                      <span className={rentabilite >= hourlyRateTTC ? "text-green-600" : "text-orange-600"}>
                        ({rentabilite.toFixed(0)}€/h)
                      </span>
                    )}
                  </Badge>
                </PopoverTrigger>
                <PopoverContent className="w-72">
                  <div className="space-y-3">
                    <div className="font-medium">Modifier le forfait</div>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={forfaitInput}
                        onChange={(e) => setForfaitInput(e.target.value)}
                        placeholder="0"
                        className="flex-1"
                      />
                      <span className="flex items-center text-sm text-muted-foreground">€ TTC</span>
                    </div>
                    {suggestedForfait && (
                      <Button variant="outline" size="sm" className="w-full text-xs" onClick={applySuggestedForfait}>
                        <Calculator className="h-3 w-3 mr-1" />
                        Suggéré: {task.estimated_hours}h × {hourlyRateTTC}€ = {suggestedForfait}€
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveForfait} className="flex-1">
                        Enregistrer
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowForfaitPopover(false)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Popover open={showForfaitPopover} onOpenChange={setShowForfaitPopover}>
                <PopoverTrigger asChild>
                  <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted border-dashed">
                    <Euro className="h-3 w-3" />
                    Définir forfait
                  </Badge>
                </PopoverTrigger>
                <PopoverContent className="w-72">
                  <div className="space-y-3">
                    <div className="font-medium">Définir le forfait client</div>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={forfaitInput}
                        onChange={(e) => setForfaitInput(e.target.value)}
                        placeholder="0"
                        className="flex-1"
                      />
                      <span className="flex items-center text-sm text-muted-foreground">€ TTC</span>
                    </div>
                    {suggestedForfait && (
                      <Button variant="outline" size="sm" className="w-full text-xs" onClick={applySuggestedForfait}>
                        <Calculator className="h-3 w-3 mr-1" />
                        Suggéré: {task.estimated_hours}h × {hourlyRateTTC}€ = {suggestedForfait}€
                      </Button>
                    )}
                    {!task.estimated_hours && (
                      <p className="text-xs text-muted-foreground">
                        💡 Ajoutez un temps estimé pour avoir une suggestion de forfait
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveForfait} className="flex-1">
                        Enregistrer
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowForfaitPopover(false)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {task.blocked_reason && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                📦 Attend livraison
              </Badge>
            )}
          </div>

          {/* Sous-tâches */}
          {totalSubtasks > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-xs text-muted-foreground">
                {completedSubtasks}/{totalSubtasks} sous-tâches complétées
              </div>
              {subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 pl-4 py-1">
                  <Checkbox
                    checked={subtask.completed}
                    onCheckedChange={() => toggleSubtask(subtask.id, subtask.completed)}
                    className="h-3 w-3"
                  />
                  <span className={`text-sm flex-1 ${subtask.completed ? "line-through text-muted-foreground" : ""}`}>
                    {subtask.title}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteSubtask(subtask.id)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Input pour ajouter une sous-tâche */}
          {showSubtaskInput ? (
            <div className="flex gap-2 mt-2">
              <Input
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addSubtask()}
                placeholder="Titre de la sous-tâche..."
                className="h-8 text-sm"
                autoFocus
              />
              <Button size="sm" onClick={addSubtask} className="h-8">
                <Plus className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSubtaskInput(false)} className="h-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSubtaskInput(true)}
              className="mt-2 h-7 text-xs text-muted-foreground"
            >
              <Plus className="h-3 w-3 mr-1" />
              Ajouter une sous-tâche
            </Button>
          )}
        </div>

        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEditTask(task.id)}
            className="text-xs h-8 px-2"
            title="Modifier la tâche"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(task.id)}
            className="text-xs text-destructive hover:text-destructive h-8 px-2"
            title="Supprimer la tâche"
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
