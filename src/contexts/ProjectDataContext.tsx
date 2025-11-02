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

interface SupplierExpense {
  id: string;
  product_name: string;
  order_date?: string;
  total_amount: number;
  suppliers?: { name: string };
}

interface MonthlyCharge {
  id: string;
  nom_charge: string;
  montant: number;
  jour_mois: number;
}

interface Appointment {
  id: string;
  client_name: string;
  appointment_date: string;
  duration_minutes: number;
  status: string;
  description?: string;
}

interface ProjectDataContextType {
  todos: Todo[];
  supplierExpenses: SupplierExpense[];
  monthlyCharges: MonthlyCharge[];
  appointments: Appointment[];
  refreshData: () => void;
  setCurrentProjectId: (id: string | null) => void;
}

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(undefined);

export const ProjectDataProvider = ({ children }: { children: ReactNode }) => {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [supplierExpenses, setSupplierExpenses] = useState<SupplierExpense[]>([]);
  const [monthlyCharges, setMonthlyCharges] = useState<MonthlyCharge[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const loadTodos = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Charger les tâches de projet (si un projet est sélectionné)
      if (currentProjectId) {
        const { data, error } = await supabase
          .from("project_todos")
          .select("*")
          .eq("project_id", currentProjectId)
          .order("due_date", { ascending: true });

        if (error) {
          console.error("Erreur chargement project_todos:", error);
        } else {
          setTodos(data || []);
        }
      } else {
        setTodos([]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des tâches:", error);
    }
  };

  const loadSupplierExpenses = async () => {
    if (!currentProjectId) {
      setSupplierExpenses([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("project_expenses")
        .select("id, nom_accessoire, date_achat, prix, fournisseur")
        .eq("project_id", currentProjectId)
        .order("date_achat", { ascending: true });

      if (error) {
        console.error("Erreur chargement expenses:", error);
      } else {
        const mappedExpenses = (data || []).map((expense) => ({
          id: expense.id,
          product_name: expense.nom_accessoire,
          order_date: expense.date_achat,
          total_amount: expense.prix,
          suppliers: expense.fournisseur ? { name: expense.fournisseur } : undefined,
        }));
        setSupplierExpenses(mappedExpenses);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des dépenses:", error);
    }
  };

  const loadMonthlyCharges = async () => {
    if (!currentProjectId) {
      setMonthlyCharges([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("project_monthly_charges")
        .select("*")
        .eq("project_id", currentProjectId)
        .order("jour_mois", { ascending: true });

      if (error) {
        console.error("Erreur chargement charges:", error);
      } else {
        setMonthlyCharges(data || []);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des charges:", error);
    }
  };

  const loadAppointments = async () => {
    if (!currentProjectId) {
      setAppointments([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("client_appointments")
        .select("*")
        .eq("project_id", currentProjectId)
        .order("appointment_date", { ascending: true });

      if (error) {
        console.error("Erreur chargement appointments:", error);
      } else {
        setAppointments(data || []);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des rendez-vous:", error);
    }
  };

  const refreshData = () => {
    loadTodos();
    loadSupplierExpenses();
    loadMonthlyCharges();
    loadAppointments();
  };

  useEffect(() => {
    loadTodos();
    loadSupplierExpenses();
    loadMonthlyCharges();
    loadAppointments();
  }, [currentProjectId]);

  // S'abonner aux changements en temps réel
  useEffect(() => {
    // Écouter les changements sur project_todos
    const projectChannel = supabase
      .channel("project_todos_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "project_todos" }, () => loadTodos())
      .subscribe();

    // Écouter les changements sur les dépenses
    const expensesChannel = supabase
      .channel("project_expenses_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "project_expenses" }, () => loadSupplierExpenses())
      .subscribe();

    // Écouter les changements sur les charges
    const chargesChannel = supabase
      .channel("project_monthly_charges_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "project_monthly_charges" }, () => loadMonthlyCharges())
      .subscribe();

    // Écouter les changements sur les rendez-vous
    const appointmentsChannel = supabase
      .channel("client_appointments_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "client_appointments" }, () => loadAppointments())
      .subscribe();

    return () => {
      projectChannel.unsubscribe();
      expensesChannel.unsubscribe();
      chargesChannel.unsubscribe();
      appointmentsChannel.unsubscribe();
    };
  }, [currentProjectId]);

  return (
    <ProjectDataContext.Provider 
      value={{ 
        todos, 
        supplierExpenses, 
        monthlyCharges, 
        appointments, 
        refreshData, 
        setCurrentProjectId 
      }}
    >
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
