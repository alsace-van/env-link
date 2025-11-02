import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, Euro, Maximize2, Package, UserCircle } from "lucide-react";
import { format, addDays, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useProjectData } from "@/contexts/ProjectDataContext";
import { supabase } from "@/integrations/supabase/client";

interface CompactAgendaProps {
  projectId: string | null;
}

export const CompactAgenda = ({ projectId }: CompactAgendaProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isMonthViewOpen, setIsMonthViewOpen] = useState(false);
  
  // Utiliser le contexte pour les données synchronisées
  const { 
    todos, 
    supplierExpenses, 
    monthlyCharges, 
    appointments,
    setCurrentProjectId 
  } = useProjectData();

  // Mettre à jour le projectId dans le contexte quand il change
  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId, setCurrentProjectId]);

  const toggleTodoComplete = async (todoId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("project_todos")
      .update({ completed: !currentStatus })
      .eq("id", todoId);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success(currentStatus ? "Tâche réactivée" : "Tâche terminée");
    }
  };

  const getItemsForDate = (date: Date) => {
    const todosForDate = todos.filter(
      (todo) => todo.due_date && isSameDay(parseISO(todo.due_date), date)
    );
    
    const expensesForDate = supplierExpenses.filter(
      (expense) => expense.order_date && isSameDay(parseISO(expense.order_date), date)
    );

    const chargesForDate = monthlyCharges.filter(
      (charge) => charge.jour_mois === date.getDate()
    );

    const appointmentsForDate = appointments.filter(
      (appointment) => isSameDay(parseISO(appointment.appointment_date), date)
    );

    return { 
      todos: todosForDate, 
      expenses: expensesForDate,
      charges: chargesForDate,
      appointments: appointmentsForDate 
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

  const { todos: todosForDay, expenses: expensesForDay, charges: chargesForDay, appointments: appointmentsForDay } = getItemsForDate(currentDate);
  const isToday = isSameDay(currentDate, new Date());

  // Vue mensuelle améliorée avec cases plus grandes
  const MonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Calculer le décalage pour commencer le mois au bon jour
    const firstDayOfWeek = getDay(monthStart);
    const startPadding = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    return (
      <div>
        {/* En-têtes des jours */}
        <div className="grid grid-cols-7 gap-3 mb-3">
          {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((day, i) => (
            <div key={i} className="text-center text-sm font-semibold text-gray-700 bg-gray-50 py-2 rounded-lg">
              {day}
            </div>
          ))}
        </div>

        {/* Grille des jours */}
        <div className="grid grid-cols-7 gap-3">
          {/* Cases vides pour aligner le premier jour */}
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`empty-${i}`} className="h-32 bg-gray-50/50 rounded-lg" />
          ))}

          {/* Jours du mois */}
          {daysInMonth.map((day) => {
            const { todos: dayTodos, expenses: dayExpenses, charges: dayCharges, appointments: dayAppointments } = getItemsForDate(day);
            const hasEvents = dayTodos.length > 0 || dayExpenses.length > 0 || dayCharges.length > 0 || dayAppointments.length > 0;
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
                {/* Numéro du jour */}
                <div className={`text-lg font-bold mb-2 ${
                  isDayToday ? "text-blue-600" : "text-gray-900"
                }`}>
                  {format(day, "d")}
                </div>

                {/* Événements */}
                {hasEvents && (
                  <div className="space-y-1">
                    {/* Tâches */}
                    {dayTodos.slice(0, 1).map((todo) => (
                      <div
                        key={todo.id}
                        className="flex items-center gap-1.5 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded"
                      >
                        <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{todo.title}</span>
                      </div>
                    ))}

                    {/* Rendez-vous */}
                    {dayAppointments.slice(0, 1).map((appointment) => (
                      <div
                        key={appointment.id}
                        className="flex items-center gap-1.5 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                      >
                        <UserCircle className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{appointment.client_name}</span>
                      </div>
                    ))}

                    {/* Dépenses */}
                    {dayExpenses.slice(0, 1).map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center gap-1.5 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded"
                      >
                        <Package className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{expense.product_name}</span>
                      </div>
                    ))}

                    {/* Charges */}
                    {dayCharges.slice(0, 1).map((charge) => (
                      <div
                        key={charge.id}
                        className="flex items-center gap-1.5 text-xs bg-red-100 text-red-800 px-2 py-1 rounded"
                      >
                        <Euro className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{charge.nom_charge}</span>
                      </div>
                    ))}

                    {/* Indicateur d'événements supplémentaires */}
                    {totalEvents > 2 && (
                      <div className="text-[10px] text-gray-600 font-medium text-center bg-gray-100 px-2 py-0.5 rounded">
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
            {todosForDay.length === 0 && expensesForDay.length === 0 && chargesForDay.length === 0 && appointmentsForDay.length === 0 ? (
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

                {/* Rendez-vous */}
                {appointmentsForDay.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="p-2 rounded-lg backdrop-blur-sm bg-white/80 border border-blue-200 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <UserCircle className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 leading-tight">
                          {appointment.client_name}
                        </p>
                        {appointment.description && (
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {appointment.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-gray-600">
                            {appointment.duration_minutes} min
                          </span>
                          <Badge
                            className={`text-[10px] px-1 py-0 h-4 ${getAppointmentStatusColor(
                              appointment.status
                            )}`}
                          >
                            RDV
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Dépenses fournisseurs */}
                {expensesForDay.map((expense) => (
                  <div
                    key={expense.id}
                    className="p-2 rounded-lg backdrop-blur-sm bg-white/80 border border-orange-200 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <Package className="h-4 w-4 mt-0.5 text-orange-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 leading-tight">
                          {expense.product_name}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs font-bold text-orange-700">
                            {expense.total_amount.toFixed(2)} €
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 h-4 bg-orange-50 text-orange-700 border-orange-200"
                          >
                            Fournisseur
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Charges mensuelles */}
                {chargesForDay.map((charge) => (
                  <div
                    key={charge.id}
                    className="p-2 rounded-lg backdrop-blur-sm bg-white/80 border border-red-200 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <Euro className="h-4 w-4 mt-0.5 text-red-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 leading-tight">
                          {charge.nom_charge}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs font-bold text-red-700">
                            {charge.montant.toFixed(2)} €
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 h-4 bg-red-50 text-red-700 border-red-200"
                          >
                            Charge
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
          <div className="flex items-center justify-center gap-3 pt-2 border-t text-[10px] text-gray-500">
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

      {/* Modal Vue Mensuelle Améliorée */}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(addDays(endOfMonth(currentDate), 1))}
                >
                  Mois suivant
                  <ChevronRight className="h-4 w-4 ml-1" />
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
