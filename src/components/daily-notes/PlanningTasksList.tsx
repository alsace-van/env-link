// ============================================
// PlanningTasksList.tsx
// Affiche les tâches planifiées depuis le canvas
// Lit les blocs "task" dans daily_notes
// ============================================

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectData } from "@/contexts/ProjectDataContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Wrench,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, isToday, isBefore, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

// Types pour les blocs (même structure que DailyNotesCanvas)
interface LinkedTask {
  id: string;
  title: string;
  description?: string;
  estimated_hours?: number;
  actual_hours?: number;
  completed: boolean;
  scheduled_date?: string;
  forfait_ttc?: number;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  project_id: string;
  project_name?: string;
}

interface NoteBlock {
  id: string;
  type: "text" | "checklist" | "list" | "table" | "image" | "task";
  targetDate?: string;
  sourceDate?: string;
  sourceBlockId?: string;
  rescheduledTo?: string;
  linkedTask?: LinkedTask;
  taskStatus?: "pending" | "in_progress" | "completed";
  [key: string]: any;
}

interface DailyNote {
  id: string;
  note_date: string;
  blocks_data: string | null;
}

interface PlannedTask {
  blockId: string;
  noteId: string;
  noteDate: string; // Date de la note où se trouve le bloc
  targetDate?: string; // Date cible du bloc (si définie)
  effectiveDate: string; // Date effective = targetDate || noteDate
  linkedTask: LinkedTask;
  taskStatus: "pending" | "in_progress" | "completed";
  rescheduledTo?: string;
  isOverdue: boolean;
  isToday: boolean;
}

interface PlanningTasksListProps {
  projectId: string | null;
  onNavigateToDate?: (date: string) => void;
}

export const PlanningTasksList = ({ projectId, onNavigateToDate }: PlanningTasksListProps) => {
  const { refreshData } = useProjectData();
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const loadPlannedTasks = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Charger toutes les daily_notes du projet
      const { data: notes, error } = await (supabase as any)
        .from("daily_notes")
        .select("id, note_date, blocks_data")
        .eq("project_id", projectId)
        .eq("user_id", user.id);

      if (error) throw error;

      const today = startOfDay(new Date());
      const tasks: PlannedTask[] = [];

      // Parcourir toutes les notes et extraire les blocs task
      for (const note of (notes || []) as DailyNote[]) {
        if (!note.blocks_data) continue;

        try {
          const blocks: NoteBlock[] = JSON.parse(note.blocks_data);

          for (const block of blocks) {
            // Ne garder que les blocs de type "task"
            if (block.type !== "task") continue;

            // 🔥 Supporter linkedTasks (nouveau) et linkedTask (ancien)
            const blockLinkedTasks = block.linkedTasks || (block.linkedTask ? [block.linkedTask] : []);
            if (blockLinkedTasks.length === 0) continue;

            // Calculer la date effective
            const effectiveDate = block.targetDate || note.note_date;
            const effectiveDateObj = parseISO(effectiveDate);

            // Ignorer les blocs reportés vers une date future
            if (block.rescheduledTo) {
              const rescheduledDateObj = parseISO(block.rescheduledTo);
              if (isBefore(today, rescheduledDateObj)) {
                continue; // Ce bloc a été reporté, ne pas l'afficher
              }
            }

            // Ne garder que les tâches pour aujourd'hui ou en retard
            // (effectiveDate <= aujourd'hui)
            if (isBefore(today, effectiveDateObj) && !isToday(effectiveDateObj)) {
              continue; // Date future, pas encore à afficher
            }

            // 🔥 Ajouter chaque tâche liée avec son statut individuel
            for (const linkedTask of blockLinkedTasks) {
              // Utiliser le statut de la tâche individuelle, pas celui du bloc
              const taskCompleted = linkedTask.completed === true;

              tasks.push({
                blockId: block.id,
                noteId: note.id,
                noteDate: note.note_date,
                targetDate: block.targetDate,
                effectiveDate,
                linkedTask: linkedTask,
                taskStatus: taskCompleted
                  ? "completed"
                  : block.taskStatus === "in_progress"
                    ? "in_progress"
                    : "pending",
                rescheduledTo: block.rescheduledTo,
                isOverdue: isBefore(effectiveDateObj, today) && !isToday(effectiveDateObj),
                isToday: isToday(effectiveDateObj),
              });
            }
          }
        } catch (e) {
          console.error("Erreur parsing blocks_data:", e);
        }
      }

      // Trier : aujourd'hui d'abord, puis par date (plus récent = plus en retard)
      tasks.sort((a, b) => {
        if (a.isToday && !b.isToday) return -1;
        if (!a.isToday && b.isToday) return 1;
        return parseISO(b.effectiveDate).getTime() - parseISO(a.effectiveDate).getTime();
      });

      setPlannedTasks(tasks);
    } catch (error) {
      console.error("Erreur chargement tâches planifiées:", error);
      toast.error("Erreur lors du chargement des tâches");
    } finally {
      setLoading(false);
    }
  };

  // Charger au montage et quand projectId change
  useEffect(() => {
    loadPlannedTasks();
  }, [projectId]);

  // 🔥 Subscription temps réel pour rafraîchir quand daily_notes change
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`planning-tasks-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_notes",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          console.log("📋 daily_notes modifié - rafraîchissement PlanningTasksList");
          loadPlannedTasks();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_todos",
        },
        () => {
          console.log("📋 project_todos modifié - rafraîchissement PlanningTasksList");
          loadPlannedTasks();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Mettre à jour le statut d'un bloc dans daily_notes
  const updateTaskStatus = async (task: PlannedTask, newStatus: "pending" | "in_progress" | "completed") => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const newCompleted = newStatus === "completed";

      // 🔥 Utiliser la fonction de synchronisation globale
      // Elle met à jour project_todos ET tous les daily_notes contenant cette tâche
      const { syncTaskCompleted } = await import("@/utils/taskSync");
      const success = await syncTaskCompleted(task.linkedTask.id, newCompleted, user.id);

      if (!success) {
        throw new Error("Échec de la synchronisation");
      }

      // Rafraîchir la liste ET le calendrier
      loadPlannedTasks();
      refreshData();

      if (newCompleted) {
        toast.success("Tâche terminée !");
      } else {
        toast.success("Tâche réactivée");
      }
    } catch (error) {
      console.error("Erreur mise à jour statut:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  // Filtrer selon l'onglet actif
  const filteredTasks = useMemo(() => {
    return plannedTasks.filter((task) =>
      showCompleted ? task.taskStatus === "completed" : task.taskStatus !== "completed",
    );
  }, [plannedTasks, showCompleted]);

  // Stats
  const todayCount = plannedTasks.filter((t) => t.isToday && t.taskStatus !== "completed").length;
  const overdueCount = plannedTasks.filter((t) => t.isOverdue && t.taskStatus !== "completed").length;

  if (!projectId) {
    return <p className="text-sm text-muted-foreground p-4">Sélectionnez un projet</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header avec stats */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {todayCount > 0 && (
            <Badge variant="default" className="bg-blue-600">
              {todayCount} aujourd'hui
            </Badge>
          )}
          {overdueCount > 0 && <Badge variant="destructive">{overdueCount} en retard</Badge>}
        </div>
        <Button variant="ghost" size="sm" onClick={loadPlannedTasks} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Toggle actives/terminées */}
      <div className="flex gap-2">
        <Button
          variant={!showCompleted ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setShowCompleted(false)}
        >
          <Wrench className="h-4 w-4 mr-2" />À faire ({plannedTasks.filter((t) => t.taskStatus !== "completed").length})
        </Button>
        <Button
          variant={showCompleted ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setShowCompleted(true)}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Terminées ({plannedTasks.filter((t) => t.taskStatus === "completed").length})
        </Button>
      </div>

      {/* Liste des tâches */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-4">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chargement...</p>
          ) : filteredTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {showCompleted ? "Aucune tâche terminée" : "Aucune tâche planifiée pour aujourd'hui"}
            </p>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={`${task.noteId}-${task.blockId}`}
                className={`p-3 rounded-lg border transition-colors ${
                  task.taskStatus === "completed"
                    ? "bg-muted/50 border-muted"
                    : task.isOverdue
                      ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900"
                      : "bg-background hover:border-primary/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={task.taskStatus === "completed"}
                    onCheckedChange={(checked) => {
                      updateTaskStatus(task, checked ? "completed" : "pending");
                    }}
                    className="mt-1"
                  />

                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Titre */}
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className={`font-medium text-sm ${
                          task.taskStatus === "completed" ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {task.linkedTask.title}
                      </h4>
                      {task.linkedTask.category_color && (
                        <div
                          className="w-3 h-3 rounded-full shrink-0 mt-1"
                          style={{ backgroundColor: task.linkedTask.category_color }}
                          title={task.linkedTask.category_name}
                        />
                      )}
                    </div>

                    {/* Description */}
                    {task.linkedTask.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{task.linkedTask.description}</p>
                    )}

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {/* Date */}
                      <Badge
                        variant={task.isOverdue ? "destructive" : task.isToday ? "default" : "secondary"}
                        className="text-xs gap-1"
                      >
                        {task.isOverdue && <AlertTriangle className="h-3 w-3" />}
                        <CalendarIcon className="h-3 w-3" />
                        {task.isToday ? "Aujourd'hui" : format(parseISO(task.effectiveDate), "d MMM", { locale: fr })}
                      </Badge>

                      {/* Heures estimées */}
                      {task.linkedTask.estimated_hours && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Clock className="h-3 w-3" />
                          {task.linkedTask.estimated_hours}h
                        </Badge>
                      )}

                      {/* Forfait */}
                      {task.linkedTask.forfait_ttc && (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                          {task.linkedTask.forfait_ttc}€
                        </Badge>
                      )}

                      {/* Projet */}
                      {task.linkedTask.project_name && (
                        <Badge variant="outline" className="text-xs">
                          {task.linkedTask.project_name}
                        </Badge>
                      )}
                    </div>

                    {/* Bouton pour aller au planning */}
                    {onNavigateToDate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground hover:text-foreground mt-1 -ml-2"
                        onClick={() => onNavigateToDate(task.noteDate)}
                      >
                        <ArrowRight className="h-3 w-3 mr-1" />
                        Voir dans le planning
                      </Button>
                    )}
                  </div>
                </div>

                {/* Statut en cours */}
                {task.taskStatus === "in_progress" && !showCompleted && (
                  <div className="mt-2 pt-2 border-t">
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                      En cours
                    </Badge>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
