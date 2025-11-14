import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, Euro, Package, StickyNote, UserCircle, Truck } from "lucide-react";
import { format, addDays, isSameDay, parseISO, setHours, getHours } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { AddTaskModal } from "./planning/AddTaskModal";
import { AddNoteModal } from "./planning/AddNoteModal";
import { AddSupplierExpenseModal } from "./planning/AddSupplierExpenseModal";
import { AddAppointmentModal } from "./planning/AddAppointmentModal";
import { AddDeliveryModal } from "./planning/AddDeliveryModal";
import { useProjectData } from "@/contexts/ProjectDataContext";

interface ProjectPlanningProps {
  projectId: string | null;
}

export const ProjectPlanning = ({ projectId }: ProjectPlanningProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // États pour les modales
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddAppointmentModal, setShowAddAppointmentModal] = useState(false);
  const [showAddDeliveryModal, setShowAddDeliveryModal] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number>(9);

  // Utiliser le contexte pour les données synchronisées en temps réel
  const { 
    todos, 
    supplierExpenses, 
    monthlyCharges, 
    appointments,
    accessoryDeliveries,
    setCurrentProjectId 
  } = useProjectData();

  // Mettre à jour le projectId dans le contexte quand il change
  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId, setCurrentProjectId]);

  // Heures de travail (8h à 20h)
  const workingHours = Array.from({ length: 13 }, (_, i) => i + 8);

  const toggleTodoComplete = async (todoId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("project_todos")
      .update({ completed: !currentStatus })
      .eq("id", todoId);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success(currentStatus ? "Tâche réactivée" : "Tâche terminée");
      // Pas besoin de recharger manuellement, la subscription le fait automatiquement !
    }
  };

  const getItemsForDateAndHour = (date: Date, hour: number) => {
    const todosForHour = todos.filter(
      (todo) => {
        if (!todo.due_date) return false;
        const todoDate = parseISO(todo.due_date);
        return isSameDay(todoDate, date) && getHours(todoDate) === hour;
      }
    );

    const expensesForDay = supplierExpenses.filter(
      (expense) => expense.order_date && isSameDay(parseISO(expense.order_date), date)
    );

    const chargesForDay = monthlyCharges.filter(
      (charge) => charge.jour_mois === date.getDate()
    );

    const appointmentsForHour = appointments.filter(
      (appointment) => {
        const appointmentDate = parseISO(appointment.appointment_date);
        return isSameDay(appointmentDate, date) && getHours(appointmentDate) === hour;
      }
    );

    const deliveriesForDay = accessoryDeliveries.filter(
      (delivery) => delivery.delivery_date && isSameDay(parseISO(delivery.delivery_date), date)
    );

    return { 
      todos: todosForHour, 
      expenses: hour === 8 ? expensesForDay : [], // Afficher les dépenses uniquement à 8h
      charges: hour === 8 ? chargesForDay : [], // Afficher les charges uniquement à 8h
      appointments: appointmentsForHour,
      deliveries: hour === 9 ? deliveriesForDay : [] // Afficher les livraisons à 9h
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

  const handleContextMenuOpen = (hour: number) => {
    setSelectedHour(hour);
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

  const getAppointmentStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Confirmé";
      case "pending":
        return "En attente";
      case "cancelled":
        return "Annulé";
      default:
        return status;
    }
  };

  const isToday = isSameDay(currentDate, new Date());

  return (
    <>
      <Card className="w-[400px] backdrop-blur-xl bg-white/90 border-gray-200/50 shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Planning Journalier</h3>
              <span className="text-xs text-green-500 font-medium animate-pulse">● En direct</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Aujourd'hui
              </Button>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-3">
                  {format(currentDate, "d MMM", { locale: fr })}
                </span>
                <Button variant="ghost" size="icon" onClick={goToNextDay}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* En-tête du jour */}
          <div
            className={`text-center py-3 rounded-lg mb-3 ${
              isToday
                ? "bg-blue-500/10 border border-blue-500/30"
                : "bg-gray-50"
            }`}
          >
            <div
              className={`text-sm uppercase font-medium ${
                isToday ? "text-blue-700" : "text-gray-500"
              }`}
            >
              {format(currentDate, "EEEE", { locale: fr })}
            </div>
            <div
              className={`text-3xl font-bold ${
                isToday ? "text-blue-600" : "text-gray-900"
              }`}
            >
              {format(currentDate, "d MMMM yyyy", { locale: fr })}
            </div>
          </div>

          {/* Planning par heure */}
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {workingHours.map((hour) => {
              const { todos: todosForHour, expenses, charges, appointments: appointmentsForHour, deliveries } = 
                getItemsForDateAndHour(currentDate, hour);

              return (
                <ContextMenu key={hour}>
                  <ContextMenuTrigger
                    onContextMenu={() => handleContextMenuOpen(hour)}
                  >
                    <div
                      className={`p-3 rounded-lg border-2 hover:border-blue-300 transition-all min-h-[60px] ${
                        todosForHour.length > 0 || expenses.length > 0 || charges.length > 0 || appointmentsForHour.length > 0 || deliveries.length > 0
                          ? "bg-white border-gray-200"
                          : "bg-gray-50/50 border-gray-100"
                      }`}
                    >
                      {/* Heure */}
                      <div className="flex items-start gap-3">
                        <div className="text-sm font-semibold text-gray-500 min-w-[50px]">
                          {`${hour}h00`}
                        </div>
                        
                        <div className="flex-1 space-y-2">
                          {/* Tâches */}
                          {todosForHour.map((todo) => (
                            <div
                              key={todo.id}
                              className={`group p-2 rounded-lg backdrop-blur-sm bg-white border shadow-sm hover:shadow-md transition-all cursor-pointer ${
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

                          {/* Dépenses fournisseurs */}
                          {expenses.map((expense) => (
                            <div
                              key={expense.id}
                              className="p-2 rounded-lg backdrop-blur-sm bg-white border border-orange-200 shadow-sm hover:shadow-md transition-all"
                            >
                              <div className="flex items-start gap-2">
                                <Package className="h-4 w-4 mt-0.5 text-orange-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-900 leading-tight">
                                    {expense.product_name}
                                  </p>
                                  {expense.suppliers && (
                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                      {expense.suppliers.name}
                                    </p>
                                  )}
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
                          {charges.map((charge) => (
                            <div
                              key={charge.id}
                              className="p-2 rounded-lg backdrop-blur-sm bg-white border border-red-200 shadow-sm hover:shadow-md transition-all"
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
                                      Charge mensuelle
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* Rendez-vous */}
                          {appointmentsForHour.map((appointment) => (
                            <div
                              key={appointment.id}
                              className="p-2 rounded-lg backdrop-blur-sm bg-white border border-blue-200 shadow-sm hover:shadow-md transition-all"
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
                                      {getAppointmentStatusLabel(appointment.status)}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* Livraisons d'accessoires */}
                          {deliveries.map((delivery) => (
                            <div
                              key={delivery.id}
                              className="p-2 rounded-lg backdrop-blur-sm bg-white border border-emerald-200 shadow-sm hover:shadow-md transition-all"
                            >
                              <div className="flex items-start gap-2">
                                <Truck className="h-4 w-4 mt-0.5 text-emerald-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-900 leading-tight">
                                    {delivery.nom}
                                  </p>
                                  {delivery.fournisseur && (
                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                      {delivery.fournisseur}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-1 mt-1">
                                    {delivery.tracking_number && (
                                      <span className="text-[10px] text-gray-600">
                                        Suivi: {delivery.tracking_number}
                                      </span>
                                    )}
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200"
                                    >
                                      Livraison
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => setShowAddTaskModal(true)}>
                      <CheckCircle2 className="mr-2 h-4 w-4 text-purple-600" />
                      <span>Ajouter une tâche</span>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => setShowAddNoteModal(true)}>
                      <StickyNote className="mr-2 h-4 w-4 text-yellow-600" />
                      <span>Ajouter une note</span>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => setShowAddExpenseModal(true)}>
                      <Package className="mr-2 h-4 w-4 text-orange-600" />
                      <span>Ajouter une dépense fournisseur</span>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => setShowAddAppointmentModal(true)}>
                      <UserCircle className="mr-2 h-4 w-4 text-blue-600" />
                      <span>Ajouter un rendez-vous</span>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => setShowAddDeliveryModal(true)}>
                      <Truck className="mr-2 h-4 w-4 text-emerald-600" />
                      <span>Ajouter une livraison</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>

          {/* Légende */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-gray-600">Tâches</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-600" />
              <span className="text-xs text-gray-600">Dép. Fournisseur</span>
            </div>
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-red-600" />
              <span className="text-xs text-gray-600">Charges</span>
            </div>
            <div className="flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-gray-600">Rendez-vous</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-gray-600">Livraisons</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modales - Les callbacks ne rechargent plus, la subscription le fait ! */}
      <AddTaskModal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        onSuccess={() => {}} // Plus besoin de recharger manuellement
        projectId={projectId}
        selectedDate={currentDate}
        selectedHour={selectedHour}
      />

      <AddNoteModal
        isOpen={showAddNoteModal}
        onClose={() => setShowAddNoteModal(false)}
        projectId={projectId}
      />

      <AddSupplierExpenseModal
        isOpen={showAddExpenseModal}
        onClose={() => setShowAddExpenseModal(false)}
        onSuccess={() => {}} // Plus besoin de recharger manuellement
        selectedDate={currentDate}
        projectId={projectId}
      />

      <AddAppointmentModal
        isOpen={showAddAppointmentModal}
        onClose={() => setShowAddAppointmentModal(false)}
        onSuccess={() => {}} // Plus besoin de recharger manuellement
        projectId={projectId}
        selectedDate={currentDate}
        selectedHour={selectedHour}
      />

      <AddDeliveryModal
        isOpen={showAddDeliveryModal}
        onClose={() => setShowAddDeliveryModal(false)}
        onSuccess={() => {}} // Plus besoin de recharger manuellement
        projectId={projectId}
        selectedDate={currentDate}
      />
    </>
  );
};
