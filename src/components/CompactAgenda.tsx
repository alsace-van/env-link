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

export const CompactAgenda = ({ projectId }: CompactAgendaProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isExpanded, setIsExpanded] = useState(false); // Mode réduit (4h) vs journée complète (13h)
  const [isMonthViewOpen, setIsMonthViewOpen] = useState(false);
  const [monthCellSize, setMonthCellSize] = useState<"normal" | "large">("normal"); // Taille des cases du mois
  const [currentTime, setCurrentTime] = useState(new Date()); // Pour rafraîchir l'heure actuelle

  // États pour les modales
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddAppointmentOpen, setIsAddAppointmentOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number>(9);

  // Utiliser le contexte pour les données synchronisées
  const { todos, supplierExpenses, monthlyCharges, appointments, setCurrentProjectId, refreshData } = useProjectData();

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
    const hasItems = items.todos.length > 0 || items.expenses.length > 0 || items.appointments.length > 0;
    const totalItems = items.todos.length + items.expenses.length + items.appointments.length;
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
                  : "hover:bg-accent/50 border border-transparent"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`text-xs font-medium mb-1 ${isCurrentHour ? "text-blue-600 dark:text-blue-400 font-bold" : "text-muted-foreground"}`}
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
                    <UserCircle className="h-2.5 w-2.5 text-blue-600" />
                    <span className="text-[10px] text-foreground truncate">{apt.client_name}</span>
                  </div>
                ))}

                {items.expenses.slice(0, 1).map((exp) => (
                  <div key={exp.id} className="flex items-center gap-1">
                    <Package className="h-2.5 w-2.5 text-orange-600" />
                    <span className="text-[10px] text-foreground truncate">{exp.product_name}</span>
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
            <Package className="mr-2 h-4 w-4 text-orange-600" />
            <span>Ajouter une dépense fournisseur</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleContextMenu(hour, "appointment")}>
            <UserCircle className="mr-2 h-4 w-4 text-blue-600" />
            <span>Ajouter un rendez-vous</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
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
            const totalEvents = dayItems.todos.length + dayItems.expenses.length + dayItems.appointments.length;

            return (
              <div
                key={day.toISOString()}
                className={`border rounded-lg transition-all cursor-pointer ${cellClass} ${
                  isCurrentDay
                    ? "border-blue-600 dark:border-blue-500 bg-blue-500/10 dark:bg-blue-500/20 shadow-md"
                    : isSelectedDay
                      ? "border-purple-500 dark:border-purple-600 bg-purple-500/10 dark:bg-purple-500/20"
                      : "border-gray-200 bg-card hover:border-gray-300 hover:shadow"
                }`}
                onClick={() => {
                  setCurrentDate(day);
                  setIsMonthViewOpen(false);
                  setIsExpanded(true); // Ouvrir en mode étendu
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
                            className="flex items-center gap-1.5 text-xs bg-purple-500/20 dark:bg-purple-500/30 text-purple-800 px-2 py-1 rounded"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span className="truncate">{todo.title}</span>
                          </div>
                        ))}
                        {dayItems.appointments.slice(0, 2).map((apt) => (
                          <div
                            key={apt.id}
                            className="flex items-center gap-1.5 text-xs bg-blue-500/20 dark:bg-blue-500/30 text-blue-800 px-2 py-1 rounded"
                          >
                            <UserCircle className="h-3 w-3" />
                            <span className="truncate">{apt.client_name}</span>
                          </div>
                        ))}
                        {dayItems.expenses.slice(0, 2).map((exp) => (
                          <div
                            key={exp.id}
                            className="flex items-center gap-1.5 text-xs bg-orange-500/20 dark:bg-orange-500/30 text-orange-800 px-2 py-1 rounded"
                          >
                            <Package className="h-3 w-3" />
                            <span className="truncate">{exp.product_name}</span>
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
                            className="flex items-center gap-1.5 text-xs bg-purple-500/20 dark:bg-purple-500/30 text-purple-800 px-2 py-1 rounded"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span className="truncate">{todo.title}</span>
                          </div>
                        ))}
                        {dayItems.appointments.slice(0, 1).map((apt) => (
                          <div
                            key={apt.id}
                            className="flex items-center gap-1.5 text-xs bg-blue-500/20 dark:bg-blue-500/30 text-blue-800 px-2 py-1 rounded"
                          >
                            <UserCircle className="h-3 w-3" />
                            <span className="truncate">{apt.client_name}</span>
                          </div>
                        ))}
                        {dayItems.expenses.slice(0, 1).map((exp) => (
                          <div
                            key={exp.id}
                            className="flex items-center gap-1.5 text-xs bg-orange-500/20 dark:bg-orange-500/30 text-orange-800 px-2 py-1 rounded"
                          >
                            <Package className="h-3 w-3" />
                            <span className="truncate">{exp.product_name}</span>
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
            );
          })}
        </div>
      </div>
    );
  };

  const { charges: chargesForDay } = getItemsForDate(currentDate);

  return (
    <>
      <Card className="w-full max-w-md shadow-lg hover:shadow-xl transition-all backdrop-blur-xl bg-white/90 border-border/50">
        <CardHeader className="pb-3 cursor-pointer hover:bg-accent/50 transition-colors" onClick={handleCardClick}>
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
              className="h-7 text-xs"
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
            <div className={`text-sm font-semibold ${isToday ? "text-blue-600" : "text-foreground"}`}>
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

          {/* Légende */}
          <div className="flex items-center justify-center gap-2 pt-2 border-t text-[9px] text-muted-foreground">
            <div className="flex items-center gap-0.5">
              <div className="h-1.5 w-1.5 bg-purple-400 rounded-full" />
              <span>Tâches</span>
            </div>
            <div className="flex items-center gap-0.5">
              <div className="h-1.5 w-1.5 bg-blue-600 rounded-full" />
              <span>RDV</span>
            </div>
            <div className="flex items-center gap-0.5">
              <div className="h-1.5 w-1.5 bg-orange-600 rounded-full" />
              <span>Dép.</span>
            </div>
            <div className="flex items-center gap-0.5">
              <div className="h-1.5 w-1.5 bg-red-600 rounded-full" />
              <span>Charges</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Vue Mensuelle */}
      <Dialog open={isMonthViewOpen} onOpenChange={setIsMonthViewOpen}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              📅 Planning Mensuel - {format(currentDate, "MMMM yyyy", { locale: fr })}
            </DialogTitle>
          </DialogHeader>
          <MonthView />
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
