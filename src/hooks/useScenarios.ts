// hooks/useScenarios.ts
// Hook pour gérer les scénarios d'un projet

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Scenario } from "@/types/scenarios";

export const useScenarios = (projectId: string) => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [principalScenario, setPrincipalScenario] = useState<Scenario | null>(null);

  const loadScenarios = async () => {
    if (!projectId) return;

    setIsLoading(true);
    const { data, error } = await (supabase
      .from("project_scenarios" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("ordre", { ascending: true }) as any);

    if (error) {
      console.error("Erreur lors du chargement des scénarios:", error);
      if (!error.message?.includes("does not exist")) {
        toast.error("Erreur lors du chargement des scénarios");
      }
    } else {
      const scenariosData = (data || []) as Scenario[];
      setScenarios(scenariosData);
      const principal = scenariosData.find((s) => s.est_principal);
      setPrincipalScenario(principal || null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadScenarios();
  }, [projectId]);

  const createScenario = async (nom: string, couleur?: string, icone?: string) => {
    const maxOrdre = Math.max(...scenarios.map((s) => s.ordre), 0);

    const { data, error } = await (supabase
      .from("project_scenarios" as any)
      .insert({
        project_id: projectId,
        nom,
        couleur: couleur || "#3B82F6",
        icone: icone || "📋",
        est_principal: scenarios.length === 0,
        ordre: maxOrdre + 1,
      })
      .select()
      .single() as any);

    if (error) {
      toast.error("Erreur lors de la création du scénario");
      console.error(error);
      return null;
    }

    toast.success(`Scénario "${nom}" créé`);
    await loadScenarios();
    return data as Scenario;
  };

  const duplicateScenario = async (scenarioId: string, nouveauNom: string) => {
    // ✅ CORRECTION : Filtrer par scenario_id au lieu de project_id
    const result: any = await (supabase as any).from("project_expenses").select("*").eq("scenario_id", scenarioId);

    const { data: expenses, error: expensesError } = result;

    if (expensesError) {
      toast.error("Erreur lors de la duplication");
      console.error(expensesError);
      return null;
    }

    // Créer le nouveau scénario
    const newScenario = await createScenario(nouveauNom);
    if (!newScenario) return null;

    // Dupliquer toutes les dépenses
    if (expenses && expenses.length > 0) {
      const newExpenses = expenses.map((expense: any) => {
        const { id, created_at, ...expenseData } = expense;
        return {
          ...expenseData,
          scenario_id: newScenario.id,
        };
      });

      const { error: insertError } = await supabase.from("project_expenses").insert(newExpenses);

      if (insertError) {
        toast.error("Erreur lors de la copie des dépenses");
        console.error(insertError);
      } else {
        toast.success(`Scénario dupliqué avec ${expenses.length} articles`);
      }
    } else {
      toast.success(`Scénario "${nouveauNom}" créé (vide)`);
    }

    return newScenario;
  };

  const updateScenario = async (scenarioId: string, updates: Partial<Scenario>) => {
    const { error } = await (supabase
      .from("project_scenarios" as any)
      .update(updates)
      .eq("id", scenarioId) as any);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
      return false;
    }

    await loadScenarios();
    return true;
  };

  const deleteScenario = async (scenarioId: string) => {
    const scenario = scenarios.find((s) => s.id === scenarioId);
    if (scenario?.est_principal) {
      toast.error("Impossible de supprimer le scénario principal");
      return false;
    }

    const { error } = await (supabase
      .from("project_scenarios" as any)
      .delete()
      .eq("id", scenarioId) as any);

    if (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
      return false;
    }

    toast.success("Scénario supprimé");
    await loadScenarios();
    return true;
  };

  const promoteScenario = async (scenarioId: string) => {
    if (!principalScenario) return false;

    // Rétrogader l'ancien principal
    await (supabase
      .from("project_scenarios" as any)
      .update({ est_principal: false })
      .eq("id", principalScenario.id) as any);

    // Promouvoir le nouveau
    const { error } = await (supabase
      .from("project_scenarios" as any)
      .update({ est_principal: true })
      .eq("id", scenarioId) as any);

    if (error) {
      toast.error("Erreur lors de la promotion");
      console.error(error);
      return false;
    }

    toast.success("Scénario promu en principal");
    await loadScenarios();
    return true;
  };

  return {
    scenarios,
    principalScenario,
    isLoading,
    createScenario,
    duplicateScenario,
    updateScenario,
    deleteScenario,
    promoteScenario,
    reloadScenarios: loadScenarios,
  };
};
