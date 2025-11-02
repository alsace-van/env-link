import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Euro,
  Maximize2,
  Package,
  UserCircle,
  StickyNote,
} from "lucide-react";
import { format, addDays, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useProjectData } from "@/contexts/ProjectDataContext";
import { supabase } from "@/integrations/supabase/client";
import { AddTaskModal } from "@/components/planning/AddTaskModal";
import { AddNoteModal } from "@/components/planning/AddNoteModal";
import { AddSupplierExpenseModal } from "@/components/planning/AddSupplierExpenseModal";
import { AddAppointmentModal } from "@/components/planning/AddAppointmentModal";

interface CompactAgendaProps {
  projectId: string | null;
}

export const CompactAgenda = ({ projectId }: CompactAgendaProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isMonthViewOpen, setIsMonthViewOpen] = useState(false);

  // États pour les modales
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddAppointmentOpen, setIsAddAppointmentOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number>(9);

  // Utiliser le contexte pour les données synchronisées
  const { todos, supplierExpenses, monthlyCharges, appointments, setCurrentProjectId, refreshData } = useProjectData();

  // Mettre à jour le projectId dans le contexte quand il change
  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId, setCurrentProjectId]);

  const toggleTodoComplete = async (todoId: string, currentStatus: boolean) => {
    const { error } = await supabase.from("project_todos").update({ completed: !currentStatus }).eq("id", todoId);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success(currentStatus ? "Tâche réactivée" : "Tâche terminée");
    }
  };

  const getItemsForDate = (date: Date) => {
    const todosForDate = todos.filter((todo) => todo.due_date && isSameDay(parseISO(todo.due_date), date));

    const expensesForDate = supplierExpenses.filter(
      (expense) => expense.order_date && isSameDay(parseISO(expense.order_date), date),
    );

    const chargesForDate = monthlyCharges.filter((charge) => charge.jour_mois === date.getDate());

    const appointmentsForDate = appointments.filter((appointment) =>
      isSameDay(parseISO(appointment.appointment_date), date),
    );

    return {
      todos: todosForDate,
      expenses: expensesForDate,
      charges: chargesForDate,
      appointments: appointmentsForDate,
    };
  };

  const getItemsForHour = (date: Date, hour: number) => {
    const { todos, expenses, appointments } = getItemsForDate(date);

    return {
      todos: todos.filter((todo) => {
        if (!todo.due_date) return false;
        const todoDate = parseISO(todo.due_date);
        return todoDate.getHours() === hour;
      }),
      expenses: expenses.filter((expense) => {
        if (!expense.order_date) return false;
        const expenseDate = parseISO(expense.order_date);
        return expenseDate.getHours() === hour;
      }),
      appointments: appointments.filter((appointment) => {
        const appointmentDate = parseISO(appointment.appointment_date);
        return appointmentDate.getHours() === hour;
      }),
    };
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

  const getAppointmentStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-500/20 text-green-700 border-green-500/30";
      case "pending":
        return "bg-orange-500/20 text-orange-700 border-orange-500/30";
      case "cancelled":
        return "bg-red-500/20 text-red-700 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-700 border-gray-500/30";
    }
  };

  const handleContextMenu = (hour: number, action: string) => {
    setSelectedHour(hour);
    switch (action) {
      case "task":
        setIsAddTaskOpen(true);
        break;
      case "note":
        setIsAddNoteOpen(true);
        break;
      case "expense":
        setIsAddExpenseOpen(true);
        break;
      case "appointment":
        setIsAddAppointmentOpen(true);
        break;
    }
  };

  const handleModalSuccess = () => {
    refreshData?.();
  };

  const isToday = isSameDay(currentDate, new Date());

  // Générer les heures de 7h à 22h
  const hours = Array.from({ length: 16 }, (_, i) => i + 7);

  // Vue horaire journalière
  const HourlyView = () => {
    return (
      <div className="space-y-0">
        {hours.map((hour) => {
          const itemsForHour = getItemsForHour(currentDate, hour);
          const hasItems =
            itemsForHour.todos.length > 0 || itemsForHour.expenses.length > 0 || itemsForHour.appointments.length > 0;

          return (
            <ContextMenu key={hour}>
              <ContextMenuTrigger>
                <div
                  className={`flex border-b border-gray-200 hover:bg-blue-50/30 transition-colors min-h-[60px] ${
                    hasItems ? "bg-blue-50/10" : ""
                  }`}
                >
                  {/* Colonne heure */}
                  <div className="w-16 flex-shrink-0 border-r border-gray-200 p-2 text-center">
                    <span className="text-sm font-semibold text-gray-600">{hour}:00</span>
                  </div>

                  {/* Colonne contenu */}
                  <div className="flex-1 p-2 space-y-1.5">
                    {/* Tâches */}
                    {itemsForHour.todos.map((todo) => (
                      <div
                        key={todo.id}
                        className={`group p-1.5 rounded-md bg-purple-50 border border-purple-200 hover:shadow-sm transition-all cursor-pointer ${
                          todo.completed ? "opacity-60" : ""
                        }`}
                        onClick={() => toggleTodoComplete(todo.id, todo.completed)}
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2
                            className={`h-3.5 w-3.5 flex-shrink-0 ${
                              todo.completed ? "text-green-600 fill-green-600" : "text-purple-500"
                            }`}
                          />
                          <span
                            className={`text-xs font-medium ${
                              todo.completed ? "line-through text-gray-500" : "text-gray-900"
                            }`}
                          >
                            {todo.title}
                          </span>
                          <Badge
                            variant="outline"
                            className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-purple-100 text-purple-700 border-purple-300"
                          >
                            Tâche
                          </Badge>
                        </div>
                      </div>
                    ))}

                    {/* Rendez-vous */}
                    {itemsForHour.appointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="p-1.5 rounded-md bg-blue-50 border border-blue-200 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                          <span className="text-xs font-medium text-gray-900">{appointment.client_name}</span>
                          {appointment.description && (
                            <span className="text-[10px] text-gray-500 truncate">- {appointment.description}</span>
                          )}
                          <Badge
                            className={`ml-auto text-[10px] px-1.5 py-0 h-4 ${getAppointmentStatusColor(
                              appointment.status,
                            )}`}
                          >
                            RDV
                          </Badge>
                        </div>
                      </div>
                    ))}

                    {/* Dépenses fournisseurs */}
                    {itemsForHour.expenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="p-1.5 rounded-md bg-orange-50 border border-orange-200 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="h-3.5 w-3.5 text-orange-600 flex-shrink-0" />
                          <span className="text-xs font-medium text-gray-900">{expense.product_name}</span>
                          <span className="text-xs font-bold text-orange-700">{expense.total_amount.toFixed(2)} €</span>
                          <Badge
                            variant="outline"
                            className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-orange-100 text-orange-700 border-orange-300"
                          >
                            Fournisseur
                          </Badge>
                        </div>
                      </div>
                    ))}

                    {/* Message si aucun élément */}
                    {!hasItems && (
                      <div className="text-xs text-gray-400 italic py-2 text-center">Clic droit pour ajouter</div>
                    )}
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56">
                <ContextMenuItem onClick={() => handleContextMenu(hour, "task")}>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-purple-600" />
                  <span>Ajouter une tâche</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleContextMenu(hour, "note")}>
                  <StickyNote className="mr-2 h-4 w-4 text-yellow-600" />
                  <span>Ajouter une note</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleContextMenu(hour, "expense")}>
                  <Package className="mr-2 h-4 w-4 text-orange-600" />
                  <span>Ajouter une dépense fournisseur</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleContextMenu(hour, "appointment")}>
                  <UserCircle className="mr-2 h-4 w-4 text-blue-600" />
                  <span>Ajouter un rendez-vous client</span>
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
    );
  };

  // Vue mensuelle améliorée avec cases plus grandes
  const MonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const firstDayOfWeek = getDay(monthStart);
    const startPadding = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    return (
      <div>
        <div className="grid grid-cols-7 gap-3 mb-3">
          {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((day, i) => (
            <div key={i} className="text-center text-sm font-semibold text-gray-700 bg-gray-50 py-2 rounded-lg">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`empty-${i}`} className="h-32 bg-gray-50/50 rounded-lg" />
          ))}

          {daysInMonth.map((day) => {
            const {
              todos: dayTodos,
              expenses: dayExpenses,
              charges: dayCharges,
              appointments: dayAppointments,
            } = getItemsForDate(day);
            const hasEvents =
              dayTodos.length > 0 || dayExpenses.length > 0 || dayCharges.length > 0 || dayAppointments.length > 0;
            const isDayToday = isSameDay(day, new Date());
            const totalEvents = dayTodos.length + dayExpenses.length + dayCharges.length + dayAppointments.length;

            return (
              <div
                key={day.toISOString()}
                className={`h-32 p-3 border-2 rounded-lg cursor-pointer hover:shadow-lg transition-all ${
                  isDayToday
                    ? "bg-blue-50 border-blue-400 shadow-md"
                    : hasEvents
                      ? "bg-white border-gray-300 hover:border-blue-300"
                      : "bg-gray-50/50 border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => {
                  setCurrentDate(day);
                  setIsMonthViewOpen(false);
                }}
              >
                <div className={`text-lg font-bold mb-2 ${isDayToday ? "text-blue-600" : "text-gray-900"}`}>
                  {format(day, "d")}
                </div>

                {hasEvents && (
                  <div className="space-y-1">
                    {dayTodos.slice(0, 1).map((todo) => (
                      <div
                        key={todo.id}
                        className="flex items-center gap-1.5 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded"
                      >
                        <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{todo.title}</span>
                      </div>
                    ))}

                    {dayAppointments.slice(0, 1).map((appointment) => (
                      <div
                        key={appointment.id}
                        className="flex items-center gap-1.5 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                      >
                        <UserCircle className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{appointment.client_name}</span>
                      </div>
                    ))}

                    {dayExpenses.slice(0, 1).map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center gap-1.5 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded"
                      >
                        <Package className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{expense.product_name}</span>
                      </div>
                    ))}

                    {dayCharges.slice(0, 1).map((charge) => (
                      <div
                        key={charge.id}
                        className="flex items-center gap-1.5 text-xs bg-red-100 text-red-800 px-2 py-1 rounded"
                      >
                        <Euro className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{charge.nom_charge}</span>
                      </div>
                    ))}

                    {totalEvents > 2 && (
                      <div className="text-[10px] text-center text-gray-600 bg-gray-100 rounded px-1 py-0.5">
                        +{totalEvents - 2} autre{totalEvents - 2 > 1 ? "s" : ""}
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

  const { charges: chargesForDay } = getItemsForDate(currentDate);

  return (
    <>
      <Card className="w-full shadow-lg hover:shadow-xl transition-all backdrop-blur-xl bg-white/90 border-gray-200/50">
        <CardHeader
          className="pb-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
          onClick={() => setIsMonthViewOpen(true)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-700">📅 Agenda</h3>
              <Maximize2 className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                goToToday();
              }}
            >
              Aujourd'hui
            </Button>
          </div>

          <div className="flex items-center justify-between mt-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                goToPreviousDay();
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <div className={`text-4xl font-bold ${isToday ? "text-blue-600" : "text-gray-900"}`}>
                {format(currentDate, "d")}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                {format(currentDate, "EEEE", { locale: fr })}
              </div>
              <div className="text-xs text-gray-500">{format(currentDate, "MMMM yyyy", { locale: fr })}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                goToNextDay();
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 max-h-[calc(100vh-350px)] overflow-y-auto">
          <HourlyView />

          {/* Charges mensuelles affichées en bas */}
          {chargesForDay.length > 0 && (
            <div className="border-t-2 border-red-200 bg-red-50/30 p-3 space-y-2">
              <h4 className="text-xs font-semibold text-red-700 flex items-center gap-1">
                <Euro className="h-3 w-3" />
                Charges mensuelles du jour
              </h4>
              {chargesForDay.map((charge) => (
                <div key={charge.id} className="p-2 rounded-lg bg-white border border-red-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-900">{charge.nom_charge}</span>
                    <span className="text-xs font-bold text-red-700">{charge.montant.toFixed(2)} €</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Légende */}
          <div className="flex items-center justify-center gap-3 py-3 border-t text-[10px] text-gray-500">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 bg-purple-400 rounded-full" />
              <span>Tâches</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 bg-blue-600 rounded-full" />
              <span>RDV</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 bg-orange-600 rounded-full" />
              <span>Dép.</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 bg-red-600 rounded-full" />
              <span>Charges</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Vue Mensuelle */}
      <Dialog open={isMonthViewOpen} onOpenChange={setIsMonthViewOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="text-xl">📅 Planning Mensuel - {format(currentDate, "MMMM yyyy", { locale: fr })}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(addDays(startOfMonth(currentDate), -1))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Mois précédent
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Aujourd'hui
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(endOfMonth(currentDate), 1))}>
                  Mois suivant
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <MonthView />
        </DialogContent>
      </Dialog>

      {/* Modales d'ajout - Utilise les modales existantes avec les bonnes props */}
      <AddTaskModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onSuccess={handleModalSuccess}
        projectId={projectId}
        selectedDate={currentDate}
        selectedHour={selectedHour}
      />

      <AddNoteModal
        isOpen={isAddNoteOpen}
        onClose={() => setIsAddNoteOpen(false)}
        onSuccess={handleModalSuccess}
        projectId={projectId}
        selectedDate={currentDate}
        selectedHour={selectedHour}
      />

      <AddSupplierExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onSuccess={handleModalSuccess}
        projectId={projectId}
        selectedDate={currentDate}
        selectedHour={selectedHour}
      />

      <AddAppointmentModal
        isOpen={isAddAppointmentOpen}
        onClose={() => setIsAddAppointmentOpen(false)}
        onSuccess={handleModalSuccess}
        projectId={projectId}
        selectedDate={currentDate}
        selectedHour={selectedHour}
      />
    </>
  );
};
