// ============================================================================
// FICHIER CORRIGÉ : ProjectDataContext.tsx
// EMPLACEMENT : src/contexts/ProjectDataContext.tsx
// ACTION : REMPLACER le fichier existant par celui-ci
// CORRECTION : Charge maintenant les tâches globales (livraisons) en plus des tâches du projet
// ============================================================================

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  scheduled_date?: string | null; // Date planifiée pour les travaux
  project_id?: string | null;
  created_at: string;
  updated_at: string;
  priority: string;
  is_global?: boolean; // Marqueur pour identifier les tâches globales
  task_type?: string; // Type de tâche (delivery, appointment, etc.)
  accessory_id?: string | null; // Lien vers accessoire (pour les livraisons)
  description?: string | null;
  category_id?: string | null; // Catégorie de travail
}

interface ProjectNote {
  id: string;
  title: string;
  content: string | null;
  project_id: string;
  user_id: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

interface SupplierExpense {
  id: string;
  project_id: string;
  user_id: string;
  accessory_id: string | null;
  nom_accessoire: string | null;
  marque: string | null;
  fournisseur: string | null;
  categorie: string | null;
  description: string | null;
  quantite: number | null;
  prix_unitaire: number | null;
  prix_vente_ttc: number | null;
  date_achat: string | null;
  date_paiement: string | null;
  delai_paiement: string | null;
  statut_paiement: string | null;
  statut_livraison: string | null;
  facture_url: string | null;
  amount: number | null;
  expense_date: string | null;
  // New fields added to DB
  product_name: string | null;
  total_amount: number | null;
  order_date: string | null;
  quantity: number | null;
  unit_price: number | null;
  supplier_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

interface AccessoryDelivery {
  id: string;
  nom: string;
  delivery_date: string;
  fournisseur: string | null;
  stock_status: string | null;
  tracking_number: string | null;
}

interface ProjectDataContextType {
  todos: Todo[];
  notes: ProjectNote[];
  supplierExpenses: SupplierExpense[];
  monthlyCharges: MonthlyCharge[];
  appointments: ClientAppointment[];
  accessoryDeliveries: AccessoryDelivery[];
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
  const [accessoryDeliveries, setAccessoryDeliveries] = useState<AccessoryDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Channels pour les subscriptions
  const [todosChannel, setTodosChannel] = useState<RealtimeChannel | null>(null);
  const [globalTodosChannel, setGlobalTodosChannel] = useState<RealtimeChannel | null>(null);
  const [notesChannel, setNotesChannel] = useState<RealtimeChannel | null>(null);
  const [expensesChannel, setExpensesChannel] = useState<RealtimeChannel | null>(null);
  const [chargesChannel, setChargesChannel] = useState<RealtimeChannel | null>(null);
  const [appointmentsChannel, setAppointmentsChannel] = useState<RealtimeChannel | null>(null);
  const [accessoriesChannel, setAccessoriesChannel] = useState<RealtimeChannel | null>(null);

  // Chargement des données
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadTodos(),
        loadNotes(),
        loadSupplierExpenses(),
        loadMonthlyCharges(),
        loadAppointments(),
        loadAccessoryDeliveries(),
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 CORRECTION : Charge maintenant les tâches du projet ET les tâches globales
  // Si aucun projet n'est sélectionné, charge TOUTES les tâches pour le planning mensuel
  const loadTodos = async () => {
    // Récupérer l'utilisateur
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    if (!currentProjectId) {
      // Aucun projet sélectionné → charger TOUTES les tâches de l'utilisateur
      const { data: allTodos, error } = await supabase
        .from("project_todos")
        .select("*")
        .eq("user_id", user.user.id)
        .order("due_date", { ascending: true });

      if (error) {
        console.error("Error loading all todos:", error);
        setTodos([]);
        return;
      }

      setTodos((allTodos || []).map((todo) => ({ ...todo, is_global: !todo.project_id })));
      return;
    }

    // 1. Charger les tâches du projet
    const { data: projectTodos, error: projectError } = await supabase
      .from("project_todos")
      .select("*")
      .eq("project_id", currentProjectId)
      .order("due_date", { ascending: true });

    if (projectError) {
      console.error("Error loading project todos:", projectError);
      return;
    }

    // 2. Charger les tâches globales (project_id = null)
    const { data: globalTodos, error: globalError } = await supabase
      .from("project_todos")
      .select("*")
      .is("project_id", null)
      .eq("user_id", user.user.id)
      .order("due_date", { ascending: true });

    if (globalError) {
      console.error("Error loading global todos:", globalError);
    }

    // 3. Combiner les deux listes et marquer les tâches globales
    const projectTodosWithFlag = (projectTodos || []).map((todo) => ({
      ...todo,
      is_global: false,
    }));

    const globalTodosWithFlag = (globalTodos || []).map((todo) => ({
      ...todo,
      is_global: true,
    }));

    // 4. Fusionner et trier par date
    const allTodos = [...projectTodosWithFlag, ...globalTodosWithFlag].sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    setTodos(allTodos);
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
      .from("project_expenses")
      .select("*")
      .eq("user_id", user.user.id)
      .order("expense_date", { ascending: false });

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

  const loadAccessoryDeliveries = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const { data, error } = await supabase
      .from("accessories_catalog")
      .select("id, nom, delivery_date, fournisseur, stock_status, tracking_number")
      .eq("user_id", user.user.id)
      .not("delivery_date", "is", null)
      .order("delivery_date", { ascending: true });

    if (error) {
      console.error("Error loading accessory deliveries:", error);
    } else {
      setAccessoryDeliveries(data || []);
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
    accessoriesChannel?.unsubscribe();

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

    // 🔥 NOUVEAU : Subscription pour les tâches globales (tous les projets)
    let globalTodosSubscription: RealtimeChannel | null = null;
    const setupGlobalTodosSubscription = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      globalTodosSubscription = supabase
        .channel(`global-todos-${user.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "project_todos",
            filter: `user_id=eq.${user.user.id}`,
          },
          (payload) => {
            console.log("Global todos change:", payload);
            // Vérifier si c'est une tâche globale (project_id = null)
            const record = payload.new as any;
            if (!record.project_id || record.project_id === null) {
              loadTodos();
            }
          },
        )
        .subscribe();
      setGlobalTodosChannel(globalTodosSubscription);
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

    // Subscription pour les accessoires avec date de livraison
    let accessoriesSubscription: RealtimeChannel | null = null;
    const setupAccessoriesSubscription = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      accessoriesSubscription = supabase
        .channel(`accessories-${user.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "accessories_catalog",
            filter: `user_id=eq.${user.user.id}`,
          },
          (payload) => {
            console.log("Accessories change:", payload);
            loadAccessoryDeliveries();
          },
        )
        .subscribe();
      setAccessoriesChannel(accessoriesSubscription);
    };

    setupAccessoriesSubscription();

    // Cleanup
    return () => {
      todosSubscription?.unsubscribe();
      globalTodosSubscription?.unsubscribe();
      notesSubscription?.unsubscribe();
      chargesSubscription?.unsubscribe();
      appointmentsSubscription?.unsubscribe();
      accessoriesSubscription?.unsubscribe();
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
            table: "project_expenses",
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
    accessoryDeliveries,
    isLoading,
    refreshData,
    currentProjectId,
    setCurrentProjectId,
  };

  return <ProjectDataContext.Provider value={value}>{children}</ProjectDataContext.Provider>;
};
