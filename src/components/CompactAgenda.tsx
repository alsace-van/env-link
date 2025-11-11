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
  Minimize2,
  Package,
  UserCircle,
  StickyNote,
  Calendar,
  Truck,
  HelpCircle,
} from "lucide-react";
import {
  format,
  addDays,
  isSameDay,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
} from "date-fns";
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

const CompactAgenda = ({ projectId }: CompactAgendaProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isExpanded, setIsExpanded] = useState(false); // Mode réduit (4h) vs journée complète (13h)
  const [isMonthViewOpen, setIsMonthViewOpen] = useState(false);
  const [monthCellSize, setMonthCellSize] = useState<"normal" | "large">("normal"); // Taille des cases du mois
  const [currentTime, setCurrentTime] = useState(new Date()); // Pour rafraîchir l'heure actuelle
  const [isLegendOpen, setIsLegendOpen] = useState(false); // Modal de légende des couleurs
  const [showDailyViewInModal, setShowDailyViewInModal] = useState(false); // Afficher le planning journalier dans la modal

  // États pour les modales
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddAppointmentOpen, setIsAddAppointmentOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number>(9);

  // Utiliser le contexte pour les données synchronisées
  const {
    todos,
    supplierExpenses,
    monthlyCharges,
    appointments,
    accessoryDeliveries,
    setCurrentProjectId,
    refreshData,
  } = useProjectData();

  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId, setCurrentProjectId]);

  // Rafraîchir l'heure actuelle toutes les minutes pour mettre à jour la surbrillance
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Toutes les minutes

    return () => clearInterval(interval);
  }, []);

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

    const deliveriesForDate = accessoryDeliveries.filter(
      (delivery) => delivery.delivery_date && isSameDay(parseISO(delivery.delivery_date), date),
    );

    return {
      todos: todosForDate,
      expenses: expensesForDate,
      charges: chargesForDate,
      appointments: appointmentsForDate,
      deliveries: deliveriesForDate,
    };
  };

  const getItemsForHour = (date: Date, hour: number) => {
    const { todos, expenses, appointments, deliveries } = getItemsForDate(date);

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
      deliveries: deliveries.filter((delivery) => {
        if (!delivery.delivery_date) return false;
        const deliveryDate = parseISO(delivery.delivery_date);
        return deliveryDate.getHours() === hour;
      }),
    };
  };

  const goToPreviousDay = () => setCurrentDate(addDays(currentDate, -1));
  const goToNextDay = () => setCurrentDate(addDays(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const getAppointmentStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-500/20 text-green-700";
      case "pending":
        return "bg-orange-500/20 text-orange-700";
      case "cancelled":
        return "bg-red-500/20 text-red-600 dark:text-red-400";
      default:
        return "bg-gray-500/20 text-foreground";
    }
  };

  const handleContextMenu = (hour: number, action: string, date?: Date) => {
    setSelectedHour(hour);
    if (date) {
      setCurrentDate(date);
    }
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

  const handleModalSuccess = () => refreshData?.();

  const isToday = isSameDay(currentDate, currentTime);

  // Calculer les 4 heures centrées sur l'heure actuelle (pour mode réduit)
  const getCurrentFourHours = () => {
    const currentHour = currentTime.getHours(); // Utiliser currentTime pour le rafraîchissement

    // Si on est en dehors des heures de travail (8h-21h)
    if (currentHour < 8) return [8, 9, 10, 11];
    if (currentHour > 21) return [18, 19, 20, 21]; // Après 21h, afficher fin de journée

    // Centrer sur l'heure actuelle : 2h avant et 1h après
    const startHour = Math.max(8, currentHour - 2);
    const endHour = Math.min(21, startHour + 3);

    // Ajuster si on est à la fin de la journée
    const adjustedStart = endHour === 21 ? Math.max(8, 21 - 3) : startHour;

    return [adjustedStart, adjustedStart + 1, adjustedStart + 2, adjustedStart + 3];
  };

  // Toutes les heures (8h-21h) pour le mode étendu
  const allHours = Array.from({ length: 14 }, (_, i) => i + 8); // 8h à 21h (14 heures)
  const leftColumnHours = allHours.slice(0, 7); // 8h-14h
  const rightColumnHours = allHours.slice(7); // 15h-21h

  // Choisir les heures à afficher selon le mode
  const displayHours = isExpanded ? allHours : getCurrentFourHours();

  const handleCardClick = (e: React.MouseEvent) => {
    // Vérifier si c'est un double-clic
    if (e.detail === 2) {
      setIsMonthViewOpen(true);
    } else if (e.detail === 1) {
      // Simple clic : basculer entre mode réduit et étendu
      setTimeout(() => {
        if (e.detail === 1) {
          setIsExpanded(!isExpanded);
        }
      }, 200); // Petit délai pour éviter le conflit avec le double-clic
    }
  };

  const HourCell = ({ date, hour, label }: { date: Date; hour: number; label: string }) => {
    const items = getItemsForHour(date, hour);
    const hasItems =
      items.todos.length > 0 ||
      items.expenses.length > 0 ||
      items.appointments.length > 0 ||
      items.deliveries.length > 0;
    const totalItems = items.todos.length + items.expenses.length + items.appointments.length + items.deliveries.length;
    const currentHour = currentTime.getHours(); // Utiliser currentTime
    const isCurrentHour = isToday && hour === currentHour;

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={`relative p-1.5 rounded-lg transition-all cursor-pointer min-h-[40px] ${
              isCurrentHour
                ? "bg-blue-500/20 dark:bg-blue-500/30 border-2 border-blue-600 dark:border-blue-500 dark:border-blue-600 shadow-md"
                : hasItems
                  ? "bg-blue-500/10 dark:bg-blue-500/20 border border-blue-400/50 dark:border-blue-600/50 hover:border-blue-400 dark:hover:border-blue-600"
                  : "hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-transparent"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`text-xs font-medium mb-1 ${isCurrentHour ? "text-blue-600 dark:text-blue-400 font-bold" : "text-foreground"}`}
            >
              {label}
              {isCurrentHour && <span className="ml-1 text-[9px]">●</span>}
            </div>

            {/* Événements (affichage compact) */}
            {hasItems && (
              <div className="space-y-0.5">
                {items.todos.slice(0, 1).map((todo) => (
                  <div
                    key={todo.id}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
                      todo.is_global
                        ? "bg-blue-500/15 dark:bg-blue-500/25 border border-blue-400/50 dark:border-blue-600/50"
                        : ""
                    }`}
                    onClick={() => toggleTodoComplete(todo.id, todo.completed)}
                  >
                    <CheckCircle2
                      className={`h-2.5 w-2.5 ${
                        todo.completed
                          ? "text-green-600 fill-green-600"
                          : todo.is_global
                            ? "text-blue-500"
                            : "text-purple-500"
                      }`}
                    />
                    {todo.is_global && (
                      <Badge
                        variant="outline"
                        className="h-3 text-[8px] px-1 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-300"
                      >
                        🌍
                      </Badge>
                    )}
                    <span
                      className={`text-[10px] truncate ${todo.completed ? "line-through text-muted-foreground" : "text-foreground"}`}
                    >
                      {todo.title}
                    </span>
                  </div>
                ))}

                {items.appointments.slice(0, 1).map((apt) => (
                  <div key={apt.id} className="flex items-center gap-1">
                    <UserCircle className="h-2.5 w-2.5 text-green-600" />
                    <span className="text-[10px] text-foreground truncate">{apt.client_name}</span>
                  </div>
                ))}

                {items.expenses.slice(0, 1).map((exp) => (
                  <div key={exp.id} className="flex items-center gap-1">
                    <Package className="h-2.5 w-2.5 text-red-600" />
                    <span className="text-[10px] text-foreground truncate">{exp.product_name}</span>
                  </div>
                ))}

                {items.deliveries.slice(0, 1).map((delivery) => (
                  <div key={delivery.id} className="flex items-center gap-1">
                    <Truck className="h-2.5 w-2.5 text-gray-700 dark:text-gray-300" />
                    <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-400">Livraison:</span>
                    <span className="text-[10px] text-foreground truncate">{delivery.nom || "Sans nom"}</span>
                  </div>
                ))}

                {totalItems > 2 && (
                  <div className="text-[9px] text-muted-foreground text-center">+{totalItems - 2}</div>
                )}
              </div>
            )}
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
            <Package className="mr-2 h-4 w-4 text-red-600" />
            <span>Ajouter une dépense fournisseur</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleContextMenu(hour, "appointment")}>
            <UserCircle className="mr-2 h-4 w-4 text-green-600" />
            <span>Ajouter un rendez-vous</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // Composant pour afficher le planning journalier dans la modal mensuelle
  const DailyViewInModal = () => {
    const dayItems = getItemsForDate(currentDate);
    const allHours = Array.from({ length: 14 }, (_, i) => i + 8); // 8h à 21h

    // Événements sans heure précise ou pour résumé global
    const totalEvents =
      dayItems.todos.length + dayItems.expenses.length + dayItems.appointments.length + dayItems.deliveries.length;

    return (
      <div className="space-y-4">
        {/* En-tête avec bouton retour */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setShowDailyViewInModal(false)}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Retour au mois
          </Button>

          <h3 className="text-lg font-semibold">{format(currentDate, "EEEE d MMMM yyyy", { locale: fr })}</h3>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-full"
            onClick={() => setIsLegendOpen(true)}
            title="Voir la légende des couleurs"
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Résumé des événements du jour */}
        {totalEvents > 0 && (
          <div className="bg-muted/30 dark:bg-muted/20 rounded-lg p-3 space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">
              📋 Événements de la journée ({totalEvents})
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {dayItems.todos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded bg-purple-500/20 dark:bg-purple-500/30 text-xs"
                  onClick={() => toggleTodoComplete(todo.id, todo.completed)}
                >
                  <CheckCircle2
                    className={`h-3 w-3 flex-shrink-0 ${
                      todo.completed ? "text-green-600 fill-green-600" : "text-purple-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-purple-800 dark:text-purple-400">Tâche: </span>
                    <span className={todo.completed ? "line-through text-muted-foreground" : ""}>{todo.title}</span>
                  </div>
                </div>
              ))}

              {dayItems.appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded bg-green-500/20 dark:bg-green-500/30 text-xs"
                >
                  <UserCircle className="h-3 w-3 flex-shrink-0 text-green-600" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-green-800 dark:text-green-400">RDV: </span>
                    <span>{apt.client_name}</span>
                  </div>
                </div>
              ))}

              {dayItems.expenses.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-500/20 dark:bg-red-500/30 text-xs"
                >
                  <Package className="h-3 w-3 flex-shrink-0 text-red-600" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-red-800 dark:text-red-400">Dép: </span>
                    <span>{exp.product_name}</span>
                  </div>
                </div>
              ))}

              {dayItems.deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded bg-orange-500/20 dark:bg-orange-500/30 text-xs"
                >
                  <Truck className="h-3 w-3 flex-shrink-0 text-orange-600" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-orange-800 dark:text-orange-400">Livr: </span>
                    <span>{delivery.nom || "Sans nom"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Planning journalier sur 2 colonnes */}
        <div className="grid grid-cols-2 gap-3">
          {/* Colonne gauche : 8h-14h */}
          <div className="space-y-2">
            {allHours.slice(0, 7).map((hour) => {
              const items = getItemsForHour(currentDate, hour);
              const hasItems =
                items.todos.length > 0 ||
                items.expenses.length > 0 ||
                items.appointments.length > 0 ||
                items.deliveries.length > 0;
              const isCurrentHour = isSameDay(currentDate, currentTime) && hour === currentTime.getHours();

              return (
                <ContextMenu key={hour}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isCurrentHour
                          ? "border-blue-600 dark:border-blue-500 bg-blue-500/10 dark:bg-blue-500/20"
                          : hasItems
                            ? "border-blue-400/50 dark:border-blue-600/50 bg-blue-500/5 hover:bg-blue-500/15 hover:border-blue-500"
                            : "border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-gray-400"
                      }`}
                    >
                      <div className={`font-semibold mb-2 ${isCurrentHour ? "text-blue-600 dark:text-blue-400" : ""}`}>
                        {hour}h00
                      </div>

                      {hasItems && (
                        <div className="space-y-2">
                          {items.todos.map((todo) => (
                            <div
                              key={todo.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded bg-purple-500/20 dark:bg-purple-500/30"
                              onClick={() => toggleTodoComplete(todo.id, todo.completed)}
                            >
                              <CheckCircle2
                                className={`h-4 w-4 flex-shrink-0 ${
                                  todo.completed ? "text-green-600 fill-green-600" : "text-purple-500"
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-purple-800 dark:text-purple-400">Tâche</div>
                                <div
                                  className={`text-sm truncate ${todo.completed ? "line-through text-muted-foreground" : ""}`}
                                >
                                  {todo.title}
                                </div>
                              </div>
                            </div>
                          ))}

                          {items.appointments.map((apt) => (
                            <div
                              key={apt.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded bg-green-500/20 dark:bg-green-500/30"
                            >
                              <UserCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-green-800 dark:text-green-400">
                                  Rendez-vous
                                </div>
                                <div className="text-sm truncate">{apt.client_name}</div>
                              </div>
                            </div>
                          ))}

                          {items.expenses.map((exp) => (
                            <div
                              key={exp.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-500/20 dark:bg-red-500/30"
                            >
                              <Package className="h-4 w-4 flex-shrink-0 text-red-600" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-red-800 dark:text-red-400">Dépense</div>
                                <div className="text-sm truncate">{exp.product_name}</div>
                              </div>
                            </div>
                          ))}

                          {items.deliveries.map((delivery) => (
                            <div
                              key={delivery.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded bg-orange-500/20 dark:bg-orange-500/30"
                            >
                              <Truck className="h-4 w-4 flex-shrink-0 text-orange-600" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-orange-800 dark:text-orange-400">
                                  Livraison
                                </div>
                                <div className="text-sm truncate">{delivery.nom || "Sans nom"}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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
                      <Package className="mr-2 h-4 w-4 text-red-600" />
                      <span>Ajouter une dépense fournisseur</span>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleContextMenu(hour, "appointment")}>
                      <UserCircle className="mr-2 h-4 w-4 text-green-600" />
                      <span>Ajouter un rendez-vous</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>

          {/* Colonne droite : 15h-21h */}
          <div className="space-y-2">
            {allHours.slice(7).map((hour) => {
              const items = getItemsForHour(currentDate, hour);
              const hasItems =
                items.todos.length > 0 ||
                items.expenses.length > 0 ||
                items.appointments.length > 0 ||
                items.deliveries.length > 0;
              const isCurrentHour = isSameDay(currentDate, currentTime) && hour === currentTime.getHours();

              return (
                <ContextMenu key={hour}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isCurrentHour
                          ? "border-blue-600 dark:border-blue-500 bg-blue-500/10 dark:bg-blue-500/20"
                          : hasItems
                            ? "border-blue-400/50 dark:border-blue-600/50 bg-blue-500/5 hover:bg-blue-500/15 hover:border-blue-500"
                            : "border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-gray-400"
                      }`}
                    >
                      <div className={`font-semibold mb-2 ${isCurrentHour ? "text-blue-600 dark:text-blue-400" : ""}`}>
                        {hour}h00
                      </div>

                      {hasItems && (
                        <div className="space-y-2">
                          {items.todos.map((todo) => (
                            <div
                              key={todo.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded bg-purple-500/20 dark:bg-purple-500/30"
                              onClick={() => toggleTodoComplete(todo.id, todo.completed)}
                            >
                              <CheckCircle2
                                className={`h-4 w-4 flex-shrink-0 ${
                                  todo.completed ? "text-green-600 fill-green-600" : "text-purple-500"
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-purple-800 dark:text-purple-400">Tâche</div>
                                <div
                                  className={`text-sm truncate ${todo.completed ? "line-through text-muted-foreground" : ""}`}
                                >
                                  {todo.title}
                                </div>
                              </div>
                            </div>
                          ))}

                          {items.appointments.map((apt) => (
                            <div
                              key={apt.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded bg-green-500/20 dark:bg-green-500/30"
                            >
                              <UserCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-green-800 dark:text-green-400">
                                  Rendez-vous
                                </div>
                                <div className="text-sm truncate">{apt.client_name}</div>
                              </div>
                            </div>
                          ))}

                          {items.expenses.map((exp) => (
                            <div
                              key={exp.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-500/20 dark:bg-red-500/30"
                            >
                              <Package className="h-4 w-4 flex-shrink-0 text-red-600" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-red-800 dark:text-red-400">Dépense</div>
                                <div className="text-sm truncate">{exp.product_name}</div>
                              </div>
                            </div>
                          ))}

                          {items.deliveries.map((delivery) => (
                            <div
                              key={delivery.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded bg-orange-500/20 dark:bg-orange-500/30"
                            >
                              <Truck className="h-4 w-4 flex-shrink-0 text-orange-600" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-orange-800 dark:text-orange-400">
                                  Livraison
                                </div>
                                <div className="text-sm truncate">{delivery.nom || "Sans nom"}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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
                      <Package className="mr-2 h-4 w-4 text-red-600" />
                      <span>Ajouter une dépense fournisseur</span>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleContextMenu(hour, "appointment")}>
                      <UserCircle className="mr-2 h-4 w-4 text-green-600" />
                      <span>Ajouter un rendez-vous</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        </div>

        {/* Charges mensuelles du jour */}
        {dayItems.charges.length > 0 && (
          <div className="border-t-2 border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/30 p-3 rounded-lg">
            <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2 mb-2">
              <Euro className="h-4 w-4" />
              Charges mensuelles
            </h4>
            <div className="space-y-1">
              {dayItems.charges.map((charge) => (
                <div key={charge.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground truncate">{charge.nom_charge}</span>
                  <span className="font-bold text-red-600 dark:text-red-400">{charge.montant.toFixed(2)}€</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Composant pour la vue mensuelle
  const MonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Calculer le premier jour de la semaine pour l'alignement
    const firstDayOfWeek = getDay(monthStart);
    const startDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Lundi = 0

    // Ajouter des jours vides au début
    const emptyDays = Array.from({ length: startDay }, (_, i) => i);

    const cellClass = monthCellSize === "large" ? "min-h-[180px] p-3" : "min-h-[120px] p-2";

    return (
      <div className="space-y-4">
        {/* Contrôles de navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, -1))}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Mois précédent
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Aujourd'hui
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              Mois suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full"
              onClick={() => setIsLegendOpen(true)}
              title="Voir la légende des couleurs"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonthCellSize(monthCellSize === "normal" ? "large" : "normal")}
            >
              {monthCellSize === "normal" ? (
                <>
                  <Maximize2 className="h-4 w-4 mr-2" />
                  Agrandir les cases
                </>
              ) : (
                <>
                  <Minimize2 className="h-4 w-4 mr-2" />
                  Réduire les cases
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Calendrier mensuel */}
        <div className="grid grid-cols-7 gap-2">
          {/* En-têtes des jours */}
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
            <div key={day} className="text-center text-sm font-semibold text-muted-foreground p-2">
              {day}
            </div>
          ))}

          {/* Jours vides au début */}
          {emptyDays.map((i) => (
            <div key={`empty-${i}`} className="border border-border rounded-lg bg-muted/30" />
          ))}

          {/* Jours du mois */}
          {daysInMonth.map((day) => {
            const dayItems = getItemsForDate(day);
            const isCurrentDay = isSameDay(day, currentTime);
            const isSelectedDay = isSameDay(day, currentDate);
            const totalEvents =
              dayItems.todos.length +
              dayItems.expenses.length +
              dayItems.appointments.length +
              dayItems.deliveries.length;

            return (
              <ContextMenu key={day.toISOString()}>
                <ContextMenuTrigger asChild>
                  <div
                    className={`border rounded-lg transition-all cursor-pointer ${cellClass} ${
                      isCurrentDay
                        ? "border-blue-600 dark:border-blue-500 bg-blue-500/10 dark:bg-blue-500/20 shadow-md"
                        : isSelectedDay
                          ? "border-gray-800 dark:border-gray-200 border-4 bg-card"
                          : "border-gray-200 bg-card hover:border-gray-400 dark:hover:border-gray-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:shadow-md"
                    }`}
                    onClick={() => {
                      setCurrentDate(day);
                      setShowDailyViewInModal(true); // Afficher le planning journalier
                    }}
                  >
                    <div
                      className={`text-sm font-semibold mb-2 ${isCurrentDay ? "text-blue-600 dark:text-blue-400" : "text-foreground"}`}
                    >
                      {format(day, "d")}
                    </div>

                    {totalEvents > 0 && (
                      <div className="space-y-1">
                        {monthCellSize === "large" ? (
                          // Mode agrandi : afficher les détails
                          <>
                            {dayItems.todos.slice(0, 3).map((todo) => (
                              <div
                                key={todo.id}
                                className="flex items-center gap-1.5 text-xs bg-purple-500/20 dark:bg-purple-500/30 px-2 py-1 rounded"
                              >
                                <CheckCircle2 className="h-3 w-3 text-gray-700 dark:text-gray-300" />
                                <span className="font-semibold text-purple-800 dark:text-purple-400">Tâche:</span>
                                <span className="truncate text-foreground dark:text-gray-100">{todo.title}</span>
                              </div>
                            ))}
                            {dayItems.appointments.slice(0, 2).map((apt) => (
                              <div
                                key={apt.id}
                                className="flex items-center gap-1.5 text-xs bg-green-500/20 dark:bg-green-500/30 px-2 py-1 rounded"
                              >
                                <UserCircle className="h-3 w-3 text-gray-700 dark:text-gray-300" />
                                <span className="font-semibold text-green-800 dark:text-green-400">RDV:</span>
                                <span className="truncate text-foreground dark:text-gray-100">{apt.client_name}</span>
                              </div>
                            ))}
                            {dayItems.expenses.slice(0, 2).map((exp) => (
                              <div
                                key={exp.id}
                                className="flex items-center gap-1.5 text-xs bg-red-500/20 dark:bg-red-500/30 px-2 py-1 rounded"
                              >
                                <Package className="h-3 w-3 text-gray-700 dark:text-gray-300" />
                                <span className="font-semibold text-red-800 dark:text-red-400">Dép:</span>
                                <span className="truncate text-foreground dark:text-gray-100">{exp.product_name}</span>
                              </div>
                            ))}
                            {dayItems.deliveries.slice(0, 2).map((delivery) => (
                              <div
                                key={delivery.id}
                                className="flex items-center gap-1.5 text-xs bg-orange-500/20 dark:bg-orange-500/30 px-2 py-1 rounded"
                              >
                                <Truck className="h-3 w-3 text-gray-700 dark:text-gray-300" />
                                <span className="font-semibold text-orange-800 dark:text-orange-400">Livr:</span>
                                <span className="truncate text-foreground dark:text-gray-100">
                                  {delivery.nom || "Accessoire sans nom"}
                                </span>
                              </div>
                            ))}

                            {totalEvents > 7 && (
                              <div className="text-[10px] text-center text-muted-foreground bg-gray-100 rounded px-1 py-0.5">
                                +{totalEvents - 7} événements
                              </div>
                            )}
                          </>
                        ) : (
                          // Mode normal : afficher seulement les 2 premiers
                          <>
                            {dayItems.todos.slice(0, 1).map((todo) => (
                              <div
                                key={todo.id}
                                className="flex items-center gap-1.5 text-xs bg-purple-500/20 dark:bg-purple-500/30 px-2 py-1 rounded"
                              >
                                <CheckCircle2 className="h-3 w-3 text-gray-700 dark:text-gray-300" />
                                <span className="font-semibold text-purple-800 dark:text-purple-400">Tâche:</span>
                                <span className="truncate text-foreground dark:text-gray-100">{todo.title}</span>
                              </div>
                            ))}
                            {dayItems.appointments.slice(0, 1).map((apt) => (
                              <div
                                key={apt.id}
                                className="flex items-center gap-1.5 text-xs bg-green-500/20 dark:bg-green-500/30 px-2 py-1 rounded"
                              >
                                <UserCircle className="h-3 w-3 text-gray-700 dark:text-gray-300" />
                                <span className="font-semibold text-green-800 dark:text-green-400">RDV:</span>
                                <span className="truncate text-foreground dark:text-gray-100">{apt.client_name}</span>
                              </div>
                            ))}
                            {dayItems.expenses.slice(0, 1).map((exp) => (
                              <div
                                key={exp.id}
                                className="flex items-center gap-1.5 text-xs bg-red-500/20 dark:bg-red-500/30 px-2 py-1 rounded"
                              >
                                <Package className="h-3 w-3 text-gray-700 dark:text-gray-300" />
                                <span className="font-semibold text-red-800 dark:text-red-400">Dép:</span>
                                <span className="truncate text-foreground dark:text-gray-100">{exp.product_name}</span>
                              </div>
                            ))}
                            {dayItems.deliveries.slice(0, 1).map((delivery) => (
                              <div
                                key={delivery.id}
                                className="flex items-center gap-1.5 text-xs bg-orange-500/20 dark:bg-orange-500/30 px-2 py-1 rounded"
                              >
                                <Truck className="h-3 w-3 text-gray-700 dark:text-gray-300" />
                                <span className="font-semibold text-orange-800 dark:text-orange-400">Livr:</span>
                                <span className="truncate text-foreground dark:text-gray-100">
                                  {delivery.nom || "Accessoire sans nom"}
                                </span>
                              </div>
                            ))}
                            {totalEvents > 3 && (
                              <div className="text-[10px] text-center text-muted-foreground bg-gray-100 rounded px-1 py-0.5">
                                +{totalEvents - 3}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Charges mensuelles */}
                    {dayItems.charges.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-red-400/50 dark:border-red-600/50">
                        {dayItems.charges.slice(0, monthCellSize === "large" ? 3 : 1).map((charge) => (
                          <div
                            key={charge.id}
                            className="flex items-center justify-between text-[10px] text-red-600 dark:text-red-400"
                          >
                            <span className="truncate">{charge.nom_charge}</span>
                            <span className="font-bold">{charge.montant.toFixed(0)}€</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-56">
                  <ContextMenuItem onClick={() => handleContextMenu(9, "task", day)}>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-purple-600" />
                    <span>Ajouter une tâche</span>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleContextMenu(9, "note", day)}>
                    <StickyNote className="mr-2 h-4 w-4 text-yellow-600" />
                    <span>Ajouter une note</span>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleContextMenu(9, "expense", day)}>
                    <Package className="mr-2 h-4 w-4 text-red-600" />
                    <span>Ajouter une dépense fournisseur</span>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleContextMenu(9, "appointment", day)}>
                    <UserCircle className="mr-2 h-4 w-4 text-green-600" />
                    <span>Ajouter un rendez-vous</span>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      </div>
    );
  };

  const { charges: chargesForDay } = getItemsForDate(currentDate);

  return (
    <>
      <Card className="w-full max-w-md shadow-lg hover:shadow-xl transition-all backdrop-blur-xl bg-card dark:bg-card border-border/50">
        <CardHeader
          className="pb-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
          onClick={handleCardClick}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">📅 Agenda</h3>
              {isExpanded ? (
                <Minimize2 className="h-3.5 w-3.5 text-muted-foreground/60" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5 text-muted-foreground/60" />
              )}
              <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                goToToday();
              }}
            >
              Aujourd'hui
            </Button>
          </div>

          {/* En-tête du jour */}
          <div className="text-center">
            <div
              className={`text-sm font-semibold ${isToday ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-gray-100"}`}
            >
              {format(currentDate, "EEEE d MMMM yyyy", { locale: fr })}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                goToPreviousDay();
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                goToNextDay();
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Indicateur de mode */}
          <div className="text-center text-[9px] text-gray-400 mt-2">
            {isExpanded ? "Clic pour réduire · Double-clic pour mois" : "Clic pour étendre · Double-clic pour mois"}
          </div>
        </CardHeader>

        <CardContent className="p-3 space-y-2">
          {/* Grille des heures */}
          {isExpanded ? (
            // Mode étendu : 2 colonnes
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                {leftColumnHours.map((hour) => (
                  <HourCell key={`left-${hour}`} date={currentDate} hour={hour} label={`${hour}h`} />
                ))}
              </div>
              <div className="space-y-1">
                {rightColumnHours.map((hour) => (
                  <HourCell key={`right-${hour}`} date={currentDate} hour={hour} label={`${hour}h`} />
                ))}
              </div>
            </div>
          ) : (
            // Mode réduit : 4 heures en 1 colonne
            <div className="space-y-1">
              {displayHours.map((hour) => (
                <HourCell key={hour} date={currentDate} hour={hour} label={`${hour}h`} />
              ))}
            </div>
          )}

          {/* Charges mensuelles */}
          {chargesForDay.length > 0 && (
            <div className="border-t-2 border-red-200 bg-red-50/30 p-2 space-y-1 mt-2">
              <h4 className="text-[10px] font-semibold text-red-700 flex items-center gap-1">
                <Euro className="h-2.5 w-2.5" />
                Charges mensuelles
              </h4>
              {chargesForDay.map((charge) => (
                <div key={charge.id} className="flex items-center justify-between text-[10px]">
                  <span className="text-foreground truncate">{charge.nom_charge}</span>
                  <span className="font-bold text-red-600 dark:text-red-400">{charge.montant.toFixed(2)}€</span>
                </div>
              ))}
            </div>
          )}

          {/* Bouton d'aide pour la légende */}
          <div className="flex items-center justify-center pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/30"
              onClick={(e) => {
                e.stopPropagation();
                setIsLegendOpen(true);
              }}
              title="Voir la légende des couleurs"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal Vue Mensuelle */}
      <Dialog
        open={isMonthViewOpen}
        onOpenChange={(open) => {
          setIsMonthViewOpen(open);
          if (!open) {
            // Réinitialiser la vue journalière quand on ferme la modal
            setShowDailyViewInModal(false);
          }
        }}
      >
        <DialogContent className={`${showDailyViewInModal ? "max-w-5xl" : "max-w-7xl"} max-h-[95vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle className="text-xl">
              {showDailyViewInModal
                ? `📅 Planning Journalier - ${format(currentDate, "d MMMM yyyy", { locale: fr })}`
                : `📅 Planning Mensuel - ${format(currentDate, "MMMM yyyy", { locale: fr })}`}
            </DialogTitle>
          </DialogHeader>
          {showDailyViewInModal ? <DailyViewInModal /> : <MonthView />}
        </DialogContent>
      </Dialog>

      {/* Modal Légende des couleurs */}
      <Dialog open={isLegendOpen} onOpenChange={setIsLegendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">🎨 Légende des couleurs</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-500/10 dark:bg-blue-500/20">
              <div className="h-4 w-4 bg-blue-600 rounded-full flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm">Jour actuel</div>
                <div className="text-xs text-muted-foreground">Le jour d'aujourd'hui avec fond bleu</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-lg border-4 border-gray-800 dark:border-gray-200">
              <div className="h-4 w-4 bg-gray-800 dark:bg-gray-200 rounded-full flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm">Case sélectionnée</div>
                <div className="text-xs text-muted-foreground">Contour gras noir/blanc</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-lg bg-purple-500/10 dark:bg-purple-500/20">
              <div className="h-4 w-4 bg-purple-600 rounded-full flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm">Tâche</div>
                <div className="text-xs text-muted-foreground">Tâches et actions à réaliser</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-lg bg-green-500/10 dark:bg-green-500/20">
              <div className="h-4 w-4 bg-green-600 rounded-full flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm">Rendez-vous</div>
                <div className="text-xs text-muted-foreground">Rendez-vous clients</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-lg bg-red-500/10 dark:bg-red-500/20">
              <div className="h-4 w-4 bg-red-600 rounded-full flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm">Dépense</div>
                <div className="text-xs text-muted-foreground">Dépenses fournisseurs et charges mensuelles</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-lg bg-orange-500/10 dark:bg-orange-500/20">
              <div className="h-4 w-4 bg-orange-600 rounded-full flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm">Livraison</div>
                <div className="text-xs text-muted-foreground">Livraisons d'accessoires commandés</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modales */}
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
      />
      <AddSupplierExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onSuccess={handleModalSuccess}
        selectedDate={currentDate}
        projectId={projectId}
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

export default CompactAgenda;
