import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, Package, Euro } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  created_at: string;
}

interface Expense {
  id: string;
  nom_accessoire: string;
  prix: number;
  date_achat: string;
  statut_paiement: string;
  created_at: string;
}

interface ProjectPlanningProps {
  projectId: string | null;
}

export const ProjectPlanning = ({ projectId }: ProjectPlanningProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [todos, setTodos] = useState<Todo[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [viewMode, setViewMode] = useState<"week" | "day">("week");

  useEffect(() => {
    if (projectId) {
      loadTodos();
      loadExpenses();
    }
  }, [projectId, currentDate]);

  const loadTodos = async () => {
    if (!projectId) return;

    const { data, error } = await supabase
      .from("project_todos")
      .select("*")
      .eq("project_id", projectId)
      .not("due_date", "is", null)
      .order("due_date", { ascending: true });

    if (error) {
      console.error(error);
    } else {
      setTodos(data || []);
    }
  };

  const loadExpenses = async () => {
    if (!projectId) return;

    const { data, error } = await supabase
      .from("project_expenses")
      .select("*")
      .eq("project_id", projectId)
      .order("date_achat", { ascending: true });

    if (error) {
      console.error(error);
    } else {
      setExpenses(data || []);
    }
  };

  const toggleTodoComplete = async (todoId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("project_todos")
      .update({ completed: !currentStatus })
      .eq("id", todoId);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      loadTodos();
      toast.success(currentStatus ? "Tâche réactivée" : "Tâche terminée");
    }
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  };

  const getItemsForDate = (date: Date) => {
    const todosForDate = todos.filter(
      (todo) => todo.due_date && isSameDay(parseISO(todo.due_date), date)
    );
    const expensesForDate = expenses.filter(
      (expense) => expense.date_achat && isSameDay(parseISO(expense.date_achat), date)
    );
    return { todos: todosForDate, expenses: expensesForDate };
  };

  const goToPreviousWeek = () => {
    setWeekStart(addDays(weekStart, -7));
  };

  const goToNextWeek = () => {
    setWeekStart(addDays(weekStart, 7));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-500/20 text-green-700 border-green-500/30";
      case "pending":
        return "bg-orange-500/20 text-orange-700 border-orange-500/30";
      case "overdue":
        return "bg-red-500/20 text-red-700 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-700 border-gray-500/30";
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case "paid":
        return "Payé";
      case "pending":
        return "En attente";
      case "overdue":
        return "En retard";
      default:
        return status;
    }
  };

  const weekDays = getWeekDays();

  return (
    <Card className="w-full backdrop-blur-xl bg-white/90 border-gray-200/50 shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Planning du Projet</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Aujourd'hui
            </Button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-3">
                {format(weekStart, "MMM yyyy", { locale: fr })}
              </span>
              <Button variant="ghost" size="icon" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* En-têtes des jours */}
        <div className="grid grid-cols-7 gap-2 mb-3">
          {weekDays.map((day, index) => {
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={index}
                className={`text-center py-2 rounded-lg ${
                  isToday
                    ? "bg-blue-500/10 border border-blue-500/30"
                    : "bg-gray-50"
                }`}
              >
                <div
                  className={`text-xs uppercase font-medium ${
                    isToday ? "text-blue-700" : "text-gray-500"
                  }`}
                >
                  {format(day, "EEE", { locale: fr })}
                </div>
                <div
                  className={`text-2xl font-bold ${
                    isToday ? "text-blue-600" : "text-gray-900"
                  }`}
                >
                  {format(day, "d")}
                </div>
              </div>
            );
          })}
        </div>

        {/* Grille de planning */}
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, index) => {
            const { todos: todosForDay, expenses: expensesForDay } = getItemsForDate(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={index}
                className={`min-h-[300px] p-3 rounded-lg border-2 ${
                  isToday
                    ? "bg-blue-50/50 border-blue-200"
                    : "bg-gray-50/50 border-gray-200"
                }`}
              >
                <div className="space-y-2">
                  {/* Tâches */}
                  {todosForDay.map((todo) => (
                    <div
                      key={todo.id}
                      className={`group p-2 rounded-lg backdrop-blur-sm bg-white/80 border shadow-sm hover:shadow-md transition-all cursor-pointer ${
                        todo.completed
                          ? "opacity-60 border-green-200"
                          : "border-purple-200"
                      }`}
                      onClick={() => toggleTodoComplete(todo.id, todo.completed)}
                    >
                      <div className="flex items-start gap-2">
                        <CheckCircle2
                          className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                            todo.completed
                              ? "text-green-600 fill-green-600"
                              : "text-purple-400"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs font-medium leading-tight ${
                              todo.completed
                                ? "line-through text-gray-500"
                                : "text-gray-900"
                            }`}
                          >
                            {todo.title}
                          </p>
                          <Badge
                            variant="outline"
                            className="mt-1 text-[10px] px-1 py-0 h-4 bg-purple-50 text-purple-700 border-purple-200"
                          >
                            Tâche
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Dépenses / Paiements */}
                  {expensesForDay.map((expense) => (
                    <div
                      key={expense.id}
                      className="p-2 rounded-lg backdrop-blur-sm bg-white/80 border border-emerald-200 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-2">
                        <Euro className="h-4 w-4 mt-0.5 text-emerald-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 leading-tight">
                            {expense.nom_accessoire}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs font-bold text-emerald-700">
                              {expense.prix.toFixed(2)} €
                            </span>
                            <Badge
                              className={`text-[10px] px-1 py-0 h-4 ${getPaymentStatusColor(
                                expense.statut_paiement
                              )}`}
                            >
                              {getPaymentStatusLabel(expense.statut_paiement)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Message si vide */}
                  {todosForDay.length === 0 && expensesForDay.length === 0 && (
                    <div className="text-center py-8 text-xs text-gray-400">
                      Aucun événement
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Légende */}
        <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-purple-400" />
            <span className="text-xs text-gray-600">Tâches</span>
          </div>
          <div className="flex items-center gap-2">
            <Euro className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-gray-600">Paiements</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
