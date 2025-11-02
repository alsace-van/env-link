// 🆕 EXEMPLE: ProjectDataContext.tsx adapté pour charger les tâches GLOBALES + PROJET

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Todo {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  completed: boolean;
  priority?: string;
  project_id?: string | null; // null pour les tâches globales
  is_global?: boolean; // Marqueur pour identifier les tâches globales
  task_type?: string; // 'delivery', 'appointment', 'reminder', 'other'
  accessory_id?: string | null; // Lien vers l'accessoire
  created_at?: string;
  updated_at?: string;
}

interface ProjectDataContextType {
  todos: Todo[];
  // ... autres données (appointments, expenses, etc.)
  refreshData: () => void;
  setCurrentProjectId: (id: string | null) => void;
}

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(undefined);

export const ProjectDataProvider = ({ children }: { children: ReactNode }) => {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  // ... autres états

  const loadTodos = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Charger les tâches de projet (si un projet est sélectionné)
      let projectTodos: Todo[] = [];
      if (currentProjectId) {
        const { data, error } = await supabase
          .from("project_todos")
          .select("*")
          .eq("project_id", currentProjectId)
          .order("due_date", { ascending: true });

        if (error) {
          console.error("Erreur chargement project_todos:", error);
        } else {
          projectTodos = (data || []).map((todo) => ({
            ...todo,
            is_global: false,
          }));
        }
      }

      // 2. 🆕 Charger les tâches GLOBALES (toujours, peu importe le projet)
      const { data: globalData, error: globalError } = await supabase
        .from("global_todos")
        .select("*")
        .order("due_date", { ascending: true });

      if (globalError) {
        console.error("Erreur chargement global_todos:", globalError);
      }

      const globalTodos: Todo[] = (globalData || []).map((todo) => ({
        ...todo,
        project_id: null, // Les tâches globales n'ont pas de projet
        is_global: true, // Marquer comme global
      }));

      // 3. 🆕 Fusionner les deux listes
      const allTodos = [...projectTodos, ...globalTodos];

      // 4. Trier par date
      allTodos.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });

      setTodos(allTodos);
    } catch (error) {
      console.error("Erreur lors du chargement des tâches:", error);
    }
  };

  const refreshData = () => {
    loadTodos();
    // ... charger autres données
  };

  useEffect(() => {
    loadTodos();
  }, [currentProjectId]);

  // 🆕 S'abonner aux changements en temps réel
  useEffect(() => {
    const {
      data: { user },
    } = supabase.auth.getUser();

    // Écouter les changements sur project_todos
    const projectChannel = supabase
      .channel("project_todos_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "project_todos" }, () => loadTodos())
      .subscribe();

    // 🆕 Écouter les changements sur global_todos
    const globalChannel = supabase
      .channel("global_todos_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "global_todos" }, () => loadTodos())
      .subscribe();

    return () => {
      projectChannel.unsubscribe();
      globalChannel.unsubscribe();
    };
  }, [currentProjectId]);

  return (
    <ProjectDataContext.Provider value={{ todos, refreshData, setCurrentProjectId }}>
      {children}
    </ProjectDataContext.Provider>
  );
};

export const useProjectData = () => {
  const context = useContext(ProjectDataContext);
  if (!context) {
    throw new Error("useProjectData must be used within ProjectDataProvider");
  }
  return context;
};
