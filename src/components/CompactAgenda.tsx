import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, Euro, Maximize2 } from "lucide-react";
import { format, addDays, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
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
  description: string;
  amount: number;
  date: string;
  payment_status: string;
  created_at: string;
}

interface CompactAgendaProps {
  projectId: string | null;
}

export const CompactAgenda = ({ projectId }: CompactAgendaProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [todos, setTodos] = useState<Todo[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isMonthViewOpen, setIsMonthViewOpen] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadTodos();
      loadExpenses();
    }
  }, [projectId]);

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
      .from("expenses")
      .select("*")
      .eq("project_id", projectId)
      .order("date", { ascending: true });

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

  const getItemsForDate = (date: Date) => {
    const todosForDate = todos.filter(
      (todo) => todo.due_date && isSameDay(parseISO(todo.due_date), date)
    );
    const expensesForDate = expenses.filter(
      (expense) => expense.date && isSameDay(parseISO(expense.date), date)
    );
    return { todos: todosForDate, expenses: expensesForDate };
  };

  const goToPreviousDay = () => {
    setCurrentDate(addDays(currentDate, -1));
  };

  const goToNextDay = () => {
    setCurrentDate(addDays(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
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

  const { todos: todosForDay, expenses: expensesForDay } = getItemsForDate(currentDate);
  const isToday = isSameDay(currentDate, new Date());

  // Vue mensuelle
  const MonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Calculer le décalage pour commencer le mois au bon jour
    const firstDayOfWeek = getDay(monthStart);
    const startPadding = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    return (
      <div>
        <div className="grid grid-cols-7 gap-2 mb-2">
          {["L", "M", "M", "J", "V", "S", "D"].map((day, i) => (
            <div key={i} className="text-center text-xs font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`empty-${i}`} className="h-20" />
          ))}
          {daysInMonth.map((day) => {
            const { todos: dayTodos, expenses: dayExpenses } = getItemsForDate(day);
            const hasEvents = dayTodos.length > 0 || dayExpenses.length > 0;
            const isDayToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={`h-20 p-1 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                  isDayToday ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200"
                }`}
                onClick={() => {
                  setCurrentDate(day);
                  setIsMonthViewOpen(false);
                }}
              >
                <div className={`text-xs font-medium mb-1 ${isDayToday ? "text-blue-600" : ""}`}>
                  {format(day, "d")}
                </div>
                {hasEvents && (
                  <div className="space-y-0.5">
                    {dayTodos.slice(0, 2).map((todo) => (
                      <div
                        key={todo.id}
                        className="h-1 bg-purple-400 rounded-full"
                      />
                    ))}
                    {dayExpenses.slice(0, 2).map((expense) => (
                      <div
                        key={expense.id}
                        className="h-1 bg-emerald-400 rounded-full"
                      />
                    ))}
                    {(dayTodos.length + dayExpenses.length > 2) && (
                      <div className="text-[9px] text-gray-500 text-center">
                        +{dayTodos.length + dayExpenses.length - 2}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <Card 
        className="h-fit backdrop-blur-xl bg-white/90 border-gray-200/50 shadow-lg hover:shadow-xl transition-shadow"
        onDoubleClick={() => setIsMonthViewOpen(true)}
      >
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setIsMonthViewOpen(true)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold">Agenda</h3>
              <Maximize2 className="h-3 w-3 text-gray-400" />
            </div>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); goToToday(); }} className="h-7 px-2 text-xs">
              Aujourd'hui
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Navigation jour */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={goToPreviousDay} className="h-7 w-7">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <div className={`text-xl font-bold ${isToday ? "text-blue-600" : "text-gray-900"}`}>
                {format(currentDate, "d")}
              </div>
              <div className="text-[10px] uppercase text-gray-500">
                {format(currentDate, "EEEE", { locale: fr })}
              </div>
              <div className="text-xs text-gray-600">
                {format(currentDate, "MMMM yyyy", { locale: fr })}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={goToNextDay} className="h-7 w-7">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Événements du jour */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {todosForDay.length === 0 && expensesForDay.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400">
                Aucun événement
              </div>
            ) : (
              <>
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
                          {expense.description}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs font-bold text-emerald-700">
                            {expense.amount.toFixed(2)} €
                          </span>
                          <Badge
                            className={`text-[10px] px-1 py-0 h-4 ${getPaymentStatusColor(
                              expense.payment_status
                            )}`}
                          >
                            {getPaymentStatusLabel(expense.payment_status)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Légende */}
          <div className="flex items-center justify-center gap-4 pt-2 border-t text-[10px] text-gray-500">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 bg-purple-400 rounded-full" />
              <span>Tâches</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 bg-emerald-600 rounded-full" />
              <span>Paiements</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Vue Mensuelle */}
      <Dialog open={isMonthViewOpen} onOpenChange={setIsMonthViewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Planning Mensuel - {format(currentDate, "MMMM yyyy", { locale: fr })}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(addDays(startOfMonth(currentDate), -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Aujourd'hui
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(addDays(endOfMonth(currentDate), 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <MonthView />
        </DialogContent>
      </Dialog>
    </>
  );
};
