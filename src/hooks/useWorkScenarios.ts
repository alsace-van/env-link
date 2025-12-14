// hooks/useWorkScenarios.ts
// Hook pour gérer les scénarios de travaux d'un projet

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Scenario } from "@/types/scenarios";

export interface WorkTask {
  id: string;
  title: string;
  description?: string | null;
  category_id?: string | null;
  work_scenario_id?: string | null;
  forfait_ht?: number | null;
  forfait_ttc?: number | null;
  tva_rate?: number | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  completed?: boolean | null;
  completed_at?: string | null;
  scheduled_date?: string | null;
  display_order?: number | null;
  project_id?: string | null;
  user_id: string;
  // Relations
  work_categories?: {
    id: string;
    name: string;
    color: string;
    icon: string;
  };
}

export interface WorkScenarioStats {
  totalTasks: number;
  completedTasks: number;
  totalHT: number;
  totalTTC: number;
  totalEstimatedHours: number;
  totalActualHours: number;
}

export const useWorkScenarios = (projectId: string) => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [principalScenario, setPrincipalScenario] = useState<Scenario | null>(null);

  // Charger les scénarios
  const loadScenarios = useCallback(async () => {
    if (!projectId) return;

    const { data, error } = await (supabase
      .from("project_scenarios" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("ordre", { ascending: true }) as any);

    if (error) {
      console.error("Erreur chargement scénarios:", error);
      return [];
    }

    const scenariosData = (data || []) as Scenario[];
    setScenarios(scenariosData);
    const principal = scenariosData.find((s) => s.est_principal);
    setPrincipalScenario(principal || null);
    return scenariosData;
  }, [projectId]);

  // Charger les tâches avec leurs catégories
  const loadTasks = useCallback(async () => {
    if (!projectId) return;

    const { data, error } = await supabase
      .from("project_todos")
      .select(`
        *,
        work_categories (
          id,
          name,
          color,
          icon
        )
      `)
      .eq("project_id", projectId)
      .not("category_id", "is", null) // Seulement les tâches de la fiche de travaux
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Erreur chargement tâches:", error);
      return;
    }

    setTasks((data || []) as WorkTask[]);
  }, [projectId]);

  // Chargement initial
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([loadScenarios(), loadTasks()]);
      setIsLoading(false);
    };
    loadAll();
  }, [loadScenarios, loadTasks]);

  // Obtenir les tâches d'un scénario
  const getTasksForScenario = useCallback((scenarioId: string) => {
    return tasks.filter(t => t.work_scenario_id === scenarioId);
  }, [tasks]);

  // Calculer les stats d'un scénario
  const getScenarioStats = useCallback((scenarioId: string): WorkScenarioStats => {
    const scenarioTasks = getTasksForScenario(scenarioId);
    return {
      totalTasks: scenarioTasks.length,
      completedTasks: scenarioTasks.filter(t => t.completed).length,
      totalHT: scenarioTasks.reduce((sum, t) => sum + (t.forfait_ht || 0), 0),
      totalTTC: scenarioTasks.reduce((sum, t) => sum + (t.forfait_ttc || 0), 0),
      totalEstimatedHours: scenarioTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0),
      totalActualHours: scenarioTasks.filter(t => t.completed).reduce((sum, t) => sum + (t.actual_hours || 0), 0),
    };
  }, [getTasksForScenario]);

  // Obtenir les stats globales (scénario principal)
  const getPrincipalStats = useCallback((): WorkScenarioStats => {
    if (!principalScenario) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        totalHT: 0,
        totalTTC: 0,
        totalEstimatedHours: 0,
        totalActualHours: 0,
      };
    }
    return getScenarioStats(principalScenario.id);
  }, [principalScenario, getScenarioStats]);

  // Assigner une tâche à un scénario
  const assignTaskToScenario = async (taskId: string, scenarioId: string | null) => {
    const { error } = await supabase
      .from("project_todos")
      .update({ work_scenario_id: scenarioId } as any)
      .eq("id", taskId);

    if (error) {
      toast.error("Erreur lors de l'assignation");
      console.error(error);
      return false;
    }

    await loadTasks();
    return true;
  };

  // Mettre à jour le forfait d'une tâche
  const updateTaskForfait = async (taskId: string, forfaitHT: number | null, tvaRate: number = 20) => {
    const forfaitTTC = forfaitHT ? Math.round(forfaitHT * (1 + tvaRate / 100) * 100) / 100 : null;
    
    const { error } = await supabase
      .from("project_todos")
      .update({ 
        forfait_ht: forfaitHT,
        forfait_ttc: forfaitTTC,
        tva_rate: tvaRate
      } as any)
      .eq("id", taskId);

    if (error) {
      toast.error("Erreur lors de la mise à jour du forfait");
      console.error(error);
      return false;
    }

    await loadTasks();
    toast.success("Forfait mis à jour");
    return true;
  };

  // Créer une nouvelle tâche dans un scénario
  const createTask = async (data: {
    title: string;
    description?: string;
    categoryId: string;
    scenarioId: string;
    forfaitHT?: number;
    tvaRate?: number;
    estimatedHours?: number;
  }) => {
    const { data: userData } = await supabase.auth.getUser();
    const tvaRate = data.tvaRate || 20;
    const forfaitTTC = data.forfaitHT ? Math.round(data.forfaitHT * (1 + tvaRate / 100) * 100) / 100 : null;

    const { error } = await supabase.from("project_todos").insert({
      title: data.title,
      description: data.description,
      category_id: data.categoryId,
      project_id: projectId,
      user_id: userData?.user?.id,
      work_scenario_id: data.scenarioId,
      forfait_ht: data.forfaitHT,
      forfait_ttc: forfaitTTC,
      tva_rate: tvaRate,
      estimated_hours: data.estimatedHours,
      display_order: tasks.length + 1,
    } as any);

    if (error) {
      toast.error("Erreur lors de la création de la tâche");
      console.error(error);
      return false;
    }

    await loadTasks();
    toast.success("Tâche créée");
    return true;
  };

  // Dupliquer les tâches d'un scénario vers un autre
  const duplicateTasksToScenario = async (fromScenarioId: string, toScenarioId: string) => {
    const tasksToClone = getTasksForScenario(fromScenarioId);
    
    if (tasksToClone.length === 0) {
      toast.info("Aucune tâche à dupliquer");
      return true;
    }

    const { data: userData } = await supabase.auth.getUser();

    const newTasks = tasksToClone.map(task => ({
      title: task.title,
      description: task.description,
      category_id: task.category_id,
      project_id: projectId,
      user_id: userData?.user?.id,
      work_scenario_id: toScenarioId,
      forfait_ht: task.forfait_ht,
      forfait_ttc: task.forfait_ttc,
      tva_rate: task.tva_rate,
      estimated_hours: task.estimated_hours,
      display_order: task.display_order,
    }));

    const { error } = await supabase.from("project_todos").insert(newTasks as any);

    if (error) {
      toast.error("Erreur lors de la duplication");
      console.error(error);
      return false;
    }

    await loadTasks();
    toast.success(`${tasksToClone.length} tâche(s) dupliquée(s)`);
    return true;
  };

  // Supprimer une tâche
  const deleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from("project_todos")
      .delete()
      .eq("id", taskId);

    if (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
      return false;
    }

    await loadTasks();
    toast.success("Tâche supprimée");
    return true;
  };

  // Mettre à jour une tâche
  const updateTask = async (taskId: string, updates: Partial<WorkTask>) => {
    // Si on met à jour le forfait HT, recalculer le TTC
    if (updates.forfait_ht !== undefined) {
      const task = tasks.find(t => t.id === taskId);
      const tvaRate = updates.tva_rate ?? task?.tva_rate ?? 20;
      updates.forfait_ttc = updates.forfait_ht 
        ? Math.round(updates.forfait_ht * (1 + tvaRate / 100) * 100) / 100 
        : null;
    }

    const { error } = await supabase
      .from("project_todos")
      .update(updates as any)
      .eq("id", taskId);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
      return false;
    }

    await loadTasks();
    return true;
  };

  // Toggle complétion d'une tâche
  const toggleTaskComplete = async (taskId: string, actualHours?: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return false;

    const isCompleting = !task.completed;
    
    const { error } = await supabase
      .from("project_todos")
      .update({
        completed: isCompleting,
        completed_at: isCompleting ? new Date().toISOString() : null,
        actual_hours: isCompleting ? actualHours : null,
      })
      .eq("id", taskId);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
      return false;
    }

    await loadTasks();
    return true;
  };

  return {
    scenarios,
    tasks,
    principalScenario,
    isLoading,
    getTasksForScenario,
    getScenarioStats,
    getPrincipalStats,
    assignTaskToScenario,
    updateTaskForfait,
    createTask,
    duplicateTasksToScenario,
    deleteTask,
    updateTask,
    toggleTaskComplete,
    reloadTasks: loadTasks,
    reloadScenarios: loadScenarios,
    reloadAll: async () => {
      await Promise.all([loadScenarios(), loadTasks()]);
    },
  };
};
