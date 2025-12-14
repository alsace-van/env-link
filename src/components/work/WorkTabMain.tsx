import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Library, BarChart3, Eye, EyeOff, Layers } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WorkCategoryCard } from "./WorkCategoryCard";
import { AddCategoryDialog } from "./AddCategoryDialog";
import { AddTaskDialog } from "./AddTaskDialog";
import { TaskTemplatesLibrary } from "./TaskTemplatesLibrary";
import { EditTaskDialog } from "./EditTaskDialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkTabMainProps {
  projectId: string;
}

export const WorkTabMain = ({ projectId }: WorkTabMainProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(true);
  const [selectedCategoryForTask, setSelectedCategoryForTask] = useState<string>("");
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("all");

  // Fetch scenarios for this project
  const { data: scenarios } = useQuery({
    queryKey: ["project-scenarios", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_scenarios")
        .select("*")
        .eq("project_id", projectId)
        .order("ordre");
      if (error) throw error;
      return data as Array<{ id: string; nom: string; icone: string; couleur: string; est_principal: boolean }>;
    },
  });

  // Fetch categories for this project
  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ["work-categories", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_categories")
        .select("*")
        .eq("project_id", projectId)
        .order("display_order");

      if (error) throw error;
      return data;
    },
  });

  // Fetch tasks for this project
  const { data: tasks, isLoading: loadingTasks } = useQuery({
    queryKey: ["project-todos", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_todos")
        .select("*")
        .eq("project_id", projectId)
        .order("display_order");

      if (error) throw error;
      return data as Array<any & { work_scenario_id?: string }>;
    },
  });

  // Filtre les tâches par scénario sélectionné
  const filteredTasks =
    tasks?.filter((t) => {
      if (selectedScenarioId === "all") return true;
      if (selectedScenarioId === "none") return !t.work_scenario_id;
      return t.work_scenario_id === selectedScenarioId;
    }) || [];

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; color: string; icon: string; isTemplate: boolean }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("work_categories").insert({
        name: data.name,
        color: data.color,
        icon: data.icon,
        project_id: data.isTemplate ? null : projectId,
        is_template: data.isTemplate,
        user_id: user?.id,
        display_order: (categories?.length || 0) + 1,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-categories", projectId] });
      toast({ title: "✓ Catégorie créée" });
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      categoryId: string;
      scheduledDate?: string;
      estimatedHours?: number;
      saveAsTemplate: boolean;
      templateId?: string;
      scenarioId?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // If saving as template, create template first
      if (data.saveAsTemplate) {
        const { data: template, error: templateError } = await supabase
          .from("task_templates")
          .insert({
            title: data.title,
            description: data.description,
            category_id: data.categoryId,
            estimated_hours: data.estimatedHours,
            user_id: user?.id,
            is_global: false,
          })
          .select()
          .single();

        if (templateError) throw templateError;
        data.templateId = template.id;
      }

      const { error } = await supabase.from("project_todos").insert({
        title: data.title,
        description: data.description,
        category_id: data.categoryId,
        project_id: projectId,
        user_id: user?.id,
        scheduled_date: data.scheduledDate,
        estimated_hours: data.estimatedHours,
        template_id: data.templateId,
        work_scenario_id: data.scenarioId || null,
        display_order: (tasks?.length || 0) + 1,
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-todos", projectId] });
      toast({ title: "✓ Tâche créée" });
    },
  });

  // Use template mutation
  const useTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: template, error: fetchError } = await supabase
        .from("task_templates")
        .select("*, work_categories!inner(id, name, color, icon)")
        .eq("id", templateId)
        .single();

      if (fetchError) throw fetchError;

      // Find or create category in project
      let categoryId = template.category_id;
      const templateCategory = template.work_categories as any;

      const { data: existingCategory } = await supabase
        .from("work_categories")
        .select("id")
        .eq("project_id", projectId)
        .eq("name", templateCategory.name)
        .single();

      if (!existingCategory) {
        const { data: newCategory, error: catError } = await supabase
          .from("work_categories")
          .insert({
            name: templateCategory.name,
            color: templateCategory.color,
            icon: templateCategory.icon,
            project_id: projectId,
            user_id: user?.id,
            display_order: (categories?.length || 0) + 1,
          })
          .select()
          .single();

        if (catError) throw catError;
        categoryId = newCategory.id;
      } else {
        categoryId = existingCategory.id;
      }

      const { error } = await supabase.from("project_todos").insert({
        title: template.title,
        description: template.description,
        category_id: categoryId,
        project_id: projectId,
        user_id: user?.id,
        estimated_hours: template.estimated_hours,
        template_id: templateId,
        display_order: (tasks?.length || 0) + 1,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-todos", projectId] });
      queryClient.invalidateQueries({ queryKey: ["work-categories", projectId] });
      toast({ title: "✓ Tâche ajoutée depuis le template" });
    },
  });

  // Toggle complete mutation
  const toggleCompleteMutation = useMutation({
    mutationFn: async ({ taskId, actualHours }: { taskId: string; actualHours: number | null }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const task = tasks?.find((t) => t.id === taskId);
      const isCompleting = !task?.completed;

      const { error } = await supabase
        .from("project_todos")
        .update({
          completed: isCompleting,
          completed_at: isCompleting ? new Date().toISOString() : null,
          completed_by: isCompleting ? user?.id : null,
          actual_hours: isCompleting ? actualHours : null,
        })
        .eq("id", taskId);

      if (error) throw error;

      return { task, isCompleting, actualHours };
    },
    onSuccess: ({ task, isCompleting, actualHours }) => {
      queryClient.invalidateQueries({ queryKey: ["project-todos", projectId] });

      if (isCompleting && actualHours && task?.estimated_hours) {
        const diff = task.estimated_hours - actualHours;
        if (diff > 0) {
          toast({
            title: `✓ Tâche terminée en ${actualHours}h`,
            description: `Estimé: ${task.estimated_hours}h - Vous avez gagné ${diff.toFixed(1)}h !`,
            variant: "default",
          });
        } else if (diff < 0) {
          toast({
            title: `✓ Tâche terminée en ${actualHours}h`,
            description: `Estimé: ${task.estimated_hours}h - Dépassement de ${Math.abs(diff).toFixed(1)}h`,
          });
        } else {
          toast({
            title: `✓ Tâche terminée en ${actualHours}h pile comme prévu !`,
          });
        }
      } else if (isCompleting) {
        toast({ title: "✓ Tâche terminée" });
      } else {
        toast({ title: "Tâche remise en cours" });
      }
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("project_todos").delete().eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-todos", projectId] });
      toast({ title: "Tâche supprimée" });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la tâche",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from("work_categories")
        .delete()
        .eq("id", categoryId)
        .eq("project_id", projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-categories", projectId] });
      toast({ title: "Catégorie supprimée" });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer une catégorie contenant des tâches",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      data,
    }: {
      taskId: string;
      data: {
        title: string;
        description?: string | null;
        estimated_hours?: number | null;
        scheduled_date?: string | null;
        category_id?: string | null;
        forfait_ttc?: number | null;
        work_scenario_id?: string | null;
      };
    }) => {
      const { error } = await supabase
        .from("project_todos")
        .update({
          title: data.title,
          description: data.description,
          estimated_hours: data.estimated_hours,
          scheduled_date: data.scheduled_date,
          category_id: data.category_id,
          forfait_ttc: data.forfait_ttc,
          work_scenario_id: data.work_scenario_id,
        } as any)
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-todos", projectId] });
      toast({ title: "✓ Tâche modifiée" });
      setEditingTask(null);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier la tâche",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  const handleAddTaskForCategory = (categoryId: string) => {
    setSelectedCategoryForTask(categoryId);
    setShowAddTask(true);
  };

  // Calculate global progress (only for work tasks with categories)
  const workTasks = filteredTasks?.filter((t) => t.category_id !== null) || [];
  const completedTasks = workTasks.filter((t) => t.completed).length || 0;
  const totalTasks = workTasks.length || 0;
  const globalProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const totalEstimatedHours = workTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0) || 0;
  const totalActualHours =
    workTasks.filter((t) => t.completed && t.actual_hours).reduce((sum, t) => sum + (t.actual_hours || 0), 0) || 0;

  // Trouver le scénario par défaut (principal)
  const defaultScenarioId = scenarios?.find((s) => s.est_principal)?.id;

  if (loadingCategories || loadingTasks) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">📋 Fiche de travaux</h2>
        <div className="flex gap-2">
          {/* Filtre par scénario */}
          {scenarios && scenarios.length > 0 && (
            <Select value={selectedScenarioId} onValueChange={setSelectedScenarioId}>
              <SelectTrigger className="w-[200px]">
                <Layers className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tous les scénarios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2">📋 Tous les scénarios</span>
                </SelectItem>
                <SelectItem value="none">
                  <span className="flex items-center gap-2">❓ Sans scénario</span>
                </SelectItem>
                {scenarios.map((scenario) => (
                  <SelectItem key={scenario.id} value={scenario.id}>
                    <span className="flex items-center gap-2">
                      {scenario.icone} {scenario.nom}
                      {scenario.est_principal && (
                        <Badge variant="outline" className="text-xs ml-1">
                          Principal
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setShowCompletedTasks(!showCompletedTasks)} variant="outline" size="sm">
            {showCompletedTasks ? (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Masquer terminées
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Afficher terminées
              </>
            )}
          </Button>
          <Button onClick={() => setShowLibrary(true)} variant="outline">
            <Library className="h-4 w-4 mr-2" />
            📚 Bibliothèque
          </Button>
          <Button onClick={() => setShowAddCategory(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle catégorie
          </Button>
        </div>
      </div>

      {/* Global progress */}
      <Card>
        <CardHeader>
          <CardTitle>Vue d'ensemble</CardTitle>
          <CardDescription>Progression globale du projet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>
                {completedTasks} tâches terminées / {totalTasks} total
              </span>
              <span className="font-semibold">{Math.round(globalProgress)}%</span>
            </div>
            <Progress value={globalProgress} className="h-3" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Temps estimé total</p>
              <p className="text-2xl font-bold">{totalEstimatedHours.toFixed(1)}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">Temps réel total</p>
              <p className="text-2xl font-bold">{totalActualHours.toFixed(1)}h</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories with tasks */}
      <div className="space-y-4">
        {categories && categories.length > 0 ? (
          categories.map((category) => {
            const categoryTasks = filteredTasks?.filter((t) => t.category_id === category.id) || [];
            return (
              <WorkCategoryCard
                key={category.id}
                category={category}
                tasks={categoryTasks}
                scenarios={scenarios}
                showCompleted={showCompletedTasks}
                onToggleComplete={(taskId, actualHours) => toggleCompleteMutation.mutate({ taskId, actualHours })}
                onEditTask={(taskId) => {
                  const task = tasks?.find((t) => t.id === taskId);
                  if (task) setEditingTask(task);
                }}
                onDelete={(taskId) => {
                  if (confirm("Êtes-vous sûr de vouloir supprimer cette tâche ?")) {
                    deleteTaskMutation.mutate(taskId);
                  }
                }}
                onDeleteCategory={(categoryId) => {
                  if (confirm("Êtes-vous sûr de vouloir supprimer cette catégorie et toutes ses tâches ?")) {
                    deleteCategoryMutation.mutate(categoryId);
                  }
                }}
                onAddTask={() => handleAddTaskForCategory(category.id)}
              />
            );
          })
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Aucune catégorie créée pour ce projet</p>
              <Button onClick={() => setShowLibrary(true)}>📚 Parcourir la bibliothèque de tâches</Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <AddCategoryDialog
        open={showAddCategory}
        onOpenChange={setShowAddCategory}
        onSubmit={(data) => createCategoryMutation.mutate(data)}
      />

      <AddTaskDialog
        open={showAddTask}
        onOpenChange={setShowAddTask}
        categories={categories || []}
        scenarios={scenarios || []}
        defaultScenarioId={
          selectedScenarioId !== "all" && selectedScenarioId !== "none" ? selectedScenarioId : defaultScenarioId
        }
        onSubmit={(data) => {
          createTaskMutation.mutate({
            ...data,
            categoryId: selectedCategoryForTask || data.categoryId,
          });
        }}
      />

      <TaskTemplatesLibrary
        open={showLibrary}
        onOpenChange={setShowLibrary}
        projectId={projectId}
        onUseTemplate={(templateId) => useTemplateMutation.mutate(templateId)}
      />

      <EditTaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        categories={categories || []}
        scenarios={scenarios || []}
        onSave={(taskId, data) => updateTaskMutation.mutate({ taskId, data })}
      />
    </div>
  );
};
