import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  project_id: string;
  created_at: string;
  updated_at: string;
  priority: string;
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
  const [notesChannel, setNotesChannel] = useState<RealtimeChannel | null>(null);
  const [expensesChannel, setExpensesChannel] = useState<RealtimeChannel | null>(null);
  const [chargesChannel, setChargesChannel] = useState<RealtimeChannel | null>(null);
  const [appointmentsChannel, setAppointmentsChannel] = useState<RealtimeChannel | null>(null);

  // Chargement des données
  const loadAllData = async () => {
    if (!currentProjectId) {
      setTodos([]);
      setNotes([]);
      setMonthlyCharges([]);
      setAppointments([]);
      return;
    }

    setIsLoading(true);
    try {
      await Promise.all([
        loadTodos(),
        loadNotes(),
        loadSupplierExpenses(),
        loadMonthlyCharges(),
        loadAppointments(),
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setIsLoading(false);
    }
  };

  const loadTodos = async () => {
    if (!currentProjectId) return;

    const { data, error } = await supabase
      .from("project_todos")
      .select("*")
      .eq("project_id", currentProjectId)
      .order("due_date", { ascending: true });

    if (error) {
      console.error("Error loading todos:", error);
    } else {
      setTodos(data || []);
    }
  };

  const loadNotes = async () => {
    if (!currentProjectId) return;

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
      .select(`
        *,
        suppliers (
          name
        )
      `)
      .eq("user_id", user.user.id)
      .order("order_date", { ascending: false });

    if (error) {
      console.error("Error loading supplier expenses:", error);
    } else {
      setSupplierExpenses(data || []);
    }
  };

  const loadMonthlyCharges = async () => {
    if (!currentProjectId) return;

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
    if (!currentProjectId) return;

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
    if (!currentProjectId) {
      // Nettoyer les subscriptions si pas de projet
      todosChannel?.unsubscribe();
      notesChannel?.unsubscribe();
      chargesChannel?.unsubscribe();
      appointmentsChannel?.unsubscribe();
      return;
    }

    // Charger les données initiales
    loadAllData();

    // Subscription pour les todos
    const todosSubscription = supabase
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
          console.log("Todos change:", payload);
          loadTodos();
        }
      )
      .subscribe();

    // Subscription pour les notes
    const notesSubscription = supabase
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
        }
      )
      .subscribe();

    // Subscription pour les charges mensuelles
    const chargesSubscription = supabase
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
        }
      )
      .subscribe();

    // Subscription pour les rendez-vous
    const appointmentsSubscription = supabase
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
        }
      )
      .subscribe();

    setTodosChannel(todosSubscription);
    setNotesChannel(notesSubscription);
    setChargesChannel(chargesSubscription);
    setAppointmentsChannel(appointmentsSubscription);

    // Cleanup
    return () => {
      todosSubscription.unsubscribe();
      notesSubscription.unsubscribe();
      chargesSubscription.unsubscribe();
      appointmentsSubscription.unsubscribe();
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
          }
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

  return (
    <ProjectDataContext.Provider value={value}>
      {children}
    </ProjectDataContext.Provider>
  );
};
