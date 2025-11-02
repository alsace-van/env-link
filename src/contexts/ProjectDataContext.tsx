// ============================================================================
// FICHIER 3 : ProjectDataContext.tsx
// EMPLACEMENT : src/contexts/ProjectDataContext.tsx
// ACTION : REMPLACER le fichier existant par celui-ci
// ============================================================================

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  project_id?: string | null; // 🆕 Optionnel car les tâches globales n'ont pas de project_id
  created_at: string;
  updated_at: string;
  priority: string;
  is_global?: boolean; // 🆕 Marqueur pour identifier les tâches globales
  task_type?: string; // 🆕 Type de tâche (delivery, appointment, etc.)
  accessory_id?: string | null; // 🆕 Lien vers accessoire (pour les livraisons)
  description?: string | null; // 🆕 Description
}

interface ProjectNote {
  id: string;
  title: string;
  content: string | null;
  project_id: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

interface SupplierExpense {
  id: string;
  product_name: string;
  total_amount: number;
  order_date: string | null;
  notes: string | null;
  quantity: number;
  unit_price: number;
  supplier_id: string | null;
  user_id: string;
  created_at: string | null;
  updated_at: string | null;
  suppliers?: {
    name: string;
  };
}

interface MonthlyCharge {
  id: string;
  nom_charge: string;
  montant: number;
  jour_mois: number;
  project_id: string;
  created_at: string;
  updated_at: string;
}

interface ClientAppointment {
  id: string;
  client_name: string;
  description: string | null;
  appointment_date: string;
  duration_minutes: number;
  status: string;
  project_id: string;
  created_at: string;
  updated_at: string;
}

interface ProjectDataContextType {
  todos: Todo[];
  notes: ProjectNote[];
  supplierExpenses: SupplierExpense[];
  monthlyCharges: MonthlyCharge[];
  appointments: ClientAppointment[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
}

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(undefined);

export const useProjectData = () => {
  const context = useContext(ProjectDataContext);
  if (!context) {
    throw new Error("useProjectData must be used within a ProjectDataProvider");
  }
  return context;
};

interface ProjectDataProviderProps {
  children: ReactNode;
}

export const ProjectDataProvider: React.FC<ProjectDataProviderProps> = ({ children }) => {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [supplierExpenses, setSupplierExpenses] = useState<SupplierExpense[]>([]);
  const [monthlyCharges, setMonthlyCharges] = useState<MonthlyCharge[]>([]);
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Channels pour les subscriptions
  const [todosChannel, setTodosChannel] = useState<RealtimeChannel | null>(null);
  const [globalTodosChannel, setGlobalTodosChannel] = useState<RealtimeChannel | null>(null); // 🆕
  const [notesChannel, setNotesChannel] = useState<RealtimeChannel | null>(null);
  const [expensesChannel, setExpensesChannel] = useState<RealtimeChannel | null>(null);
  const [chargesChannel, setChargesChannel] = useState<RealtimeChannel | null>(null);
  const [appointmentsChannel, setAppointmentsChannel] = useState<RealtimeChannel | null>(null);

  // Chargement des données
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadTodos(), loadNotes(), loadSupplierExpenses(), loadMonthlyCharges(), loadAppointments()]);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setIsLoading(false);
    }
  };

  // 🆕 Chargement des tâches : FUSION project_todos + global_todos
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
          console.error("Error loading project todos:", error);
        } else {
          projectTodos = (data || []).map((todo) => ({
            ...todo,
            is_global: false,
          }));
        }
      }

      // 2. 🆕 Charger les tâches GLOBALES (toujours, pour tous les projets)
      const { data: globalData, error: globalError } = await supabase
        .from("global_todos")
        .select("*")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true });

      if (globalError) {
        console.error("Error loading global todos:", globalError);
      }

      const globalTodos: Todo[] = (globalData || []).map((todo) => ({
        ...todo,
        project_id: null, // Les tâches globales n'ont pas de project_id
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
      console.error("Error in loadTodos:", error);
    }
  };

  const loadNotes = async () => {
    if (!currentProjectId) {
      setNotes([]);
      return;
    }

    const { data, error } = await supabase
      .from("project_notes")
      .select("*")
      .eq("project_id", currentProjectId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error loading notes:", error);
    } else {
      setNotes(data || []);
    }
  };

  const loadSupplierExpenses = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const { data, error } = await supabase
      .from("supplier_expenses")
      .select(
        `
        *,
        suppliers (
          name
        )
      `,
      )
      .eq("user_id", user.user.id)
      .order("order_date", { ascending: false });

    if (error) {
      console.error("Error loading supplier expenses:", error);
    } else {
      setSupplierExpenses(data || []);
    }
  };

  const loadMonthlyCharges = async () => {
    if (!currentProjectId) {
      setMonthlyCharges([]);
      return;
    }

    const { data, error } = await supabase
      .from("project_monthly_charges")
      .select("*")
      .eq("project_id", currentProjectId)
      .order("jour_mois", { ascending: true });

    if (error) {
      console.error("Error loading monthly charges:", error);
    } else {
      setMonthlyCharges(data || []);
    }
  };

  const loadAppointments = async () => {
    if (!currentProjectId) {
      setAppointments([]);
      return;
    }

    const { data, error } = await supabase
      .from("client_appointments")
      .select("*")
      .eq("project_id", currentProjectId)
      .order("appointment_date", { ascending: true });

    if (error) {
      console.error("Error loading appointments:", error);
    } else {
      setAppointments(data || []);
    }
  };

  // Configuration des subscriptions en temps réel
  useEffect(() => {
    // Charger les données initiales
    loadAllData();

    // Nettoyer les anciennes subscriptions
    todosChannel?.unsubscribe();
    globalTodosChannel?.unsubscribe();
    notesChannel?.unsubscribe();
    chargesChannel?.unsubscribe();
    appointmentsChannel?.unsubscribe();

    // Subscription pour les todos de projet (si un projet est sélectionné)
    let todosSubscription: RealtimeChannel | null = null;
    if (currentProjectId) {
      todosSubscription = supabase
        .channel(`todos-${currentProjectId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "project_todos",
            filter: `project_id=eq.${currentProjectId}`,
          },
          (payload) => {
            console.log("Project todos change:", payload);
            loadTodos();
          },
        )
        .subscribe();
      setTodosChannel(todosSubscription);
    }

    // 🆕 Subscription pour les tâches GLOBALES (toujours actif)
    const setupGlobalTodosSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const globalSubscription = supabase
        .channel(`global-todos-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "global_todos",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("Global todos change:", payload);
            loadTodos();
          },
        )
        .subscribe();

      setGlobalTodosChannel(globalSubscription);
    };

    setupGlobalTodosSubscription();

    // Subscription pour les notes (si un projet est sélectionné)
    let notesSubscription: RealtimeChannel | null = null;
    if (currentProjectId) {
      notesSubscription = supabase
        .channel(`notes-${currentProjectId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "project_notes",
            filter: `project_id=eq.${currentProjectId}`,
          },
          (payload) => {
            console.log("Notes change:", payload);
            loadNotes();
          },
        )
        .subscribe();
      setNotesChannel(notesSubscription);
    }

    // Subscription pour les charges mensuelles (si un projet est sélectionné)
    let chargesSubscription: RealtimeChannel | null = null;
    if (currentProjectId) {
      chargesSubscription = supabase
        .channel(`charges-${currentProjectId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "project_monthly_charges",
            filter: `project_id=eq.${currentProjectId}`,
          },
          (payload) => {
            console.log("Charges change:", payload);
            loadMonthlyCharges();
          },
        )
        .subscribe();
      setChargesChannel(chargesSubscription);
    }

    // Subscription pour les rendez-vous (si un projet est sélectionné)
    let appointmentsSubscription: RealtimeChannel | null = null;
    if (currentProjectId) {
      appointmentsSubscription = supabase
        .channel(`appointments-${currentProjectId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "client_appointments",
            filter: `project_id=eq.${currentProjectId}`,
          },
          (payload) => {
            console.log("Appointments change:", payload);
            loadAppointments();
          },
        )
        .subscribe();
      setAppointmentsChannel(appointmentsSubscription);
    }

    // Cleanup
    return () => {
      todosSubscription?.unsubscribe();
      globalSubscription?.unsubscribe();
      notesSubscription?.unsubscribe();
      chargesSubscription?.unsubscribe();
      appointmentsSubscription?.unsubscribe();
    };
  }, [currentProjectId]);

  // Subscription pour les dépenses fournisseurs (par user_id)
  useEffect(() => {
    const setupExpensesSubscription = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const expensesSubscription = supabase
        .channel(`expenses-${user.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "supplier_expenses",
            filter: `user_id=eq.${user.user.id}`,
          },
          (payload) => {
            console.log("Supplier expenses change:", payload);
            loadSupplierExpenses();
          },
        )
        .subscribe();

      setExpensesChannel(expensesSubscription);

      return () => {
        expensesSubscription.unsubscribe();
      };
    };

    setupExpensesSubscription();
  }, []);

  const refreshData = async () => {
    await loadAllData();
  };

  const value: ProjectDataContextType = {
    todos,
    notes,
    supplierExpenses,
    monthlyCharges,
    appointments,
    isLoading,
    refreshData,
    currentProjectId,
    setCurrentProjectId,
  };

  return <ProjectDataContext.Provider value={value}>{children}</ProjectDataContext.Provider>;
};
