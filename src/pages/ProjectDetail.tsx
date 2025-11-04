import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Image,
  Euro,
  FileText,
  Package,
  BookOpen,
  PanelRightOpen,
  Wrench,
  Edit,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Receipt,
  ShoppingBag,
  Calendar,
  Clock,
  CheckCircle2,
  UserCircle,
  Truck,
  X,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import PhotosTab from "@/components/PhotosTab";
import UserMenu from "@/components/UserMenu";
import ExpensesList from "@/components/ExpensesList";
import ExpensesSummary from "@/components/ExpensesSummary";
import AccessoriesCatalogView from "@/components/AccessoriesCatalogView";
import { BilanComptable } from "@/components/BilanComptable";
import { NoticeUploadDialog } from "@/components/NoticeUploadDialog";
import { NoticesList } from "@/components/NoticesList";
import { TechnicalCanvas } from "@/components/TechnicalCanvas";
import { CableSectionCalculator } from "@/components/CableSectionCalculator";
import { EnergyBalance } from "@/components/EnergyBalance";
import { LayoutCanvas } from "@/components/LayoutCanvas";
import { Layout3DView } from "@/components/Layout3DView";
import { User } from "@supabase/supabase-js";
import { AdminMessagesNotification } from "@/components/AdminMessagesNotification";
import { ProjectSidebar } from "@/components/project/ProjectSidebar";
import { DocumentsUpload } from "@/components/DocumentsUpload";
import logo from "@/assets/logo.png";
import {
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addDays,
  addMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useProjectData } from "@/contexts/ProjectDataContext";

interface Project {
  id: string;
  nom_proprietaire: string;
  nom_projet?: string;
  adresse_proprietaire?: string;
  telephone_proprietaire?: string;
  email_proprietaire?: string;
  numero_chassis?: string;
  immatriculation?: string;
  type_mine?: string;
  date_mise_circulation?: string;
  marque_custom?: string;
  modele_custom?: string;
  longueur_mm?: number;
  largeur_mm?: number;
  hauteur_mm?: number;
  longueur_chargement_mm?: number;
  largeur_chargement_mm?: number;
  poids_vide_kg?: number;
  charge_utile_kg?: number;
  ptac_kg?: number;
  vehicles_catalog?: {
    marque: string;
    modele: string;
  };
}

// Composant Widget Agenda Compact pour l'entête
interface AgendaWidgetProps {
  projectId: string | null;
  onClick: () => void;
  onDoubleClick: () => void;
}

const AgendaWidget = ({ projectId, onClick, onDoubleClick }: AgendaWidgetProps) => {
  const { todos, appointments, supplierExpenses, accessoryDeliveries, setCurrentProjectId } = useProjectData();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId, setCurrentProjectId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Mise à jour toutes les minutes
    return () => clearInterval(interval);
  }, []);

  // Récupérer les événements du jour
  const today = new Date();
  const todayEvents = [
    ...todos.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), today)),
    ...appointments.filter((a) => a.appointment_date && isSameDay(parseISO(a.appointment_date), today)),
    ...supplierExpenses.filter((e) => e.order_date && isSameDay(parseISO(e.order_date), today)),
    ...accessoryDeliveries.filter((d) => d.delivery_date && isSameDay(parseISO(d.delivery_date), today)),
  ].slice(0, 2); // Max 2 événements

  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors border-blue-200 dark:border-blue-800"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Date et heure */}
          <div className="flex flex-col items-center justify-center min-w-[60px]">
            <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400 mb-1" />
            <div className="text-sm font-bold text-foreground">{format(currentTime, "d MMM", { locale: fr })}</div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {format(currentTime, "HH:mm")}
            </div>
          </div>

          {/* Séparateur */}
          <div className="h-12 w-px bg-border" />

          {/* Événements du jour */}
          <div className="flex-1 min-w-[200px]">
            {todayEvents.length > 0 ? (
              <div className="space-y-1">
                {todayEvents.map((event: any, index) => {
                  const isTodo = "title" in event;
                  const isAppointment = "client_name" in event;
                  const isExpense = "product_name" in event;
                  const isDelivery = "nom" in event && "delivery_date" in event;

                  return (
                    <div key={index} className="flex items-center gap-1.5 text-sm">
                      {isTodo && (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-purple-500 flex-shrink-0" />
                          <span className="truncate">{event.title}</span>
                        </>
                      )}
                      {isAppointment && (
                        <>
                          <UserCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="truncate">{event.client_name}</span>
                        </>
                      )}
                      {isExpense && (
                        <>
                          <Package className="h-4 w-4 text-red-600 flex-shrink-0" />
                          <span className="truncate">{event.product_name}</span>
                        </>
                      )}
                      {isDelivery && (
                        <>
                          <Truck className="h-4 w-4 text-orange-600 flex-shrink-0" />
                          <span className="truncate">{event.nom}</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Aucun événement aujourd'hui</div>
            )}
          </div>

          {/* Indicateur cliquable */}
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
};

// Composant CalendarDropdown avec 2 COLONNES (8h-14h | 15h-21h)
interface CalendarDropdownProps {
  projectId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const CalendarDropdown = ({ projectId, isOpen, onClose }: CalendarDropdownProps) => {
  const { todos, appointments, supplierExpenses, accessoryDeliveries, setCurrentProjectId } = useProjectData();
  const [currentDate] = useState(new Date());

  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId, setCurrentProjectId]);

  if (!isOpen) return null;

  // Récupérer les événements du jour pour chaque heure
  const today = new Date();
  const leftColumnHours = [8, 9, 10, 11, 12, 13, 14]; // 8h-14h
  const rightColumnHours = [15, 16, 17, 18, 19, 20, 21]; // 15h-21h

  const getEventsForHour = (hour: number) => {
    const events: any[] = [];

    // Filtrer les tâches
    todos
      .filter((t) => {
        if (!t.due_date) return false;
        const date = parseISO(t.due_date);
        return isSameDay(date, today) && date.getHours() === hour;
      })
      .forEach((t) => events.push({ ...t, type: "todo" }));

    // Filtrer les rendez-vous
    appointments
      .filter((a) => {
        if (!a.appointment_date) return false;
        const date = parseISO(a.appointment_date);
        return isSameDay(date, today) && date.getHours() === hour;
      })
      .forEach((a) => events.push({ ...a, type: "appointment" }));

    // Filtrer les dépenses
    supplierExpenses
      .filter((e) => {
        if (!e.order_date) return false;
        const date = parseISO(e.order_date);
        return isSameDay(date, today) && date.getHours() === hour;
      })
      .forEach((e) => events.push({ ...e, type: "expense" }));

    // Filtrer les livraisons
    accessoryDeliveries
      .filter((d) => {
        if (!d.delivery_date) return false;
        const date = parseISO(d.delivery_date);
        return isSameDay(date, today) && date.getHours() === hour;
      })
      .forEach((d) => events.push({ ...d, type: "delivery" }));

    return events;
  };

  const HourCell = ({ hour }: { hour: number }) => {
    const events = getEventsForHour(hour);
    const currentHour = new Date().getHours();
    const isCurrentHour = hour === currentHour && isSameDay(today, new Date());

    return (
      <div
        className={`p-2 rounded-md border ${
          isCurrentHour ? "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700" : "border-border"
        }`}
      >
        <div className="flex items-start gap-2">
          <div className="font-semibold text-sm min-w-[45px]">{hour}h</div>
          <div className="flex-1">
            {events.length > 0 ? (
              <div className="space-y-1">
                {events.map((event, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-xs">
                    {event.type === "todo" && (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-purple-500 flex-shrink-0" />
                        <span className="truncate">{event.title}</span>
                      </>
                    )}
                    {event.type === "appointment" && (
                      <>
                        <UserCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                        <span className="truncate">{event.client_name}</span>
                      </>
                    )}
                    {event.type === "expense" && (
                      <>
                        <Package className="h-3 w-3 text-red-600 flex-shrink-0" />
                        <span className="truncate">{event.product_name}</span>
                      </>
                    )}
                    {event.type === "delivery" && (
                      <>
                        <Truck className="h-3 w-3 text-orange-600 flex-shrink-0" />
                        <span className="truncate">{event.nom}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">-</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute top-full right-0 mt-2 z-50 w-[600px]">
      <Card className="shadow-lg border-2 border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="font-semibold text-base">Planning du jour</div>
                <div className="text-xs text-muted-foreground">
                  {format(currentDate, "EEEE d MMMM yyyy", { locale: fr })}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ChevronUp className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          {/* 2 colonnes : 8h-14h | 15h-21h */}
          <div className="grid grid-cols-2 gap-3">
            {/* Colonne gauche : 8h-14h */}
            <div className="space-y-1">
              {leftColumnHours.map((hour) => (
                <HourCell key={hour} hour={hour} />
              ))}
            </div>
            {/* Colonne droite : 15h-21h */}
            <div className="space-y-1">
              {rightColumnHours.map((hour) => (
                <HourCell key={hour} hour={hour} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Composant Vue Mensuelle Simple pour le double-clic
interface MonthViewProps {
  projectId: string | null;
}

const SimpleMonthView = ({ projectId }: MonthViewProps) => {
  const { todos, appointments, supplierExpenses, accessoryDeliveries, setCurrentProjectId } = useProjectData();
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId, setCurrentProjectId]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Ajouter les jours du mois précédent pour compléter la première semaine
  const firstDayOfWeek = getDay(monthStart);
  const previousMonthDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const startDate = addDays(monthStart, -previousMonthDays);

  // Ajouter les jours du mois suivant pour compléter la dernière semaine
  const lastDayOfWeek = getDay(monthEnd);
  const nextMonthDays = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
  const endDate = addDays(monthEnd, nextMonthDays);

  const allDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getEventsForDate = (date: Date) => {
    const todosForDate = todos.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), date));
    const appointmentsForDate = appointments.filter(
      (a) => a.appointment_date && isSameDay(parseISO(a.appointment_date), date),
    );
    const expensesForDate = supplierExpenses.filter((e) => e.order_date && isSameDay(parseISO(e.order_date), date));
    const deliveriesForDate = accessoryDeliveries.filter(
      (d) => d.delivery_date && isSameDay(parseISO(d.delivery_date), date),
    );
    return {
      todos: todosForDate,
      appointments: appointmentsForDate,
      expenses: expensesForDate,
      deliveries: deliveriesForDate,
      total: todosForDate.length + appointmentsForDate.length + expensesForDate.length + deliveriesForDate.length,
    };
  };

  const goToPreviousMonth = () => setCurrentDate(addMonths(currentDate, -1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const isToday = (date: Date) => isSameDay(date, new Date());
  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{format(currentDate, "MMMM yyyy", { locale: fr })}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Aujourd'hui
          </Button>
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-muted-foreground p-2">
            {day}
          </div>
        ))}
      </div>

      {/* Grille des jours */}
      <div className="grid grid-cols-7 gap-2">
        {allDays.map((day, index) => {
          const events = getEventsForDate(day);
          const isCurrentMonthDay = isCurrentMonth(day);
          const isTodayDay = isToday(day);

          return (
            <div
              key={index}
              className={`min-h-[120px] p-2 border rounded-lg transition-all hover:shadow-md hover:scale-105 cursor-pointer ${
                isTodayDay
                  ? "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700"
                  : isCurrentMonthDay
                    ? "bg-card border-border hover:border-blue-200"
                    : "bg-muted/30 border-muted"
              }`}
            >
              <div
                className={`text-sm font-semibold mb-2 ${
                  isTodayDay
                    ? "text-blue-600 dark:text-blue-400"
                    : isCurrentMonthDay
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {format(day, "d")}
              </div>

              {events.total > 0 && (
                <div className="space-y-1">
                  {/* Afficher les tâches */}
                  {events.todos.slice(0, 2).map((todo, idx) => (
                    <div
                      key={`todo-${idx}`}
                      className="flex items-center gap-1 text-xs bg-purple-50 dark:bg-purple-950/30 px-1.5 py-0.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/40"
                      title={todo.title}
                    >
                      <CheckCircle2 className="h-3 w-3 text-purple-500 flex-shrink-0" />
                      <span className="truncate text-purple-700 dark:text-purple-300">{todo.title}</span>
                    </div>
                  ))}
                  {events.todos.length > 2 && (
                    <div className="text-xs text-purple-600 dark:text-purple-400 pl-4">
                      +{events.todos.length - 2} autres
                    </div>
                  )}

                  {/* Afficher les rendez-vous */}
                  {events.appointments.slice(0, 2).map((appointment, idx) => (
                    <div
                      key={`appt-${idx}`}
                      className="flex items-center gap-1 text-xs bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded hover:bg-green-100 dark:hover:bg-green-900/40"
                      title={appointment.client_name}
                    >
                      <UserCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                      <span className="truncate text-green-700 dark:text-green-300">{appointment.client_name}</span>
                    </div>
                  ))}
                  {events.appointments.length > 2 && (
                    <div className="text-xs text-green-600 dark:text-green-400 pl-4">
                      +{events.appointments.length - 2} autres
                    </div>
                  )}

                  {/* Afficher les dépenses */}
                  {events.expenses.slice(0, 2).map((expense, idx) => (
                    <div
                      key={`expense-${idx}`}
                      className="flex items-center gap-1 text-xs bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40"
                      title={expense.product_name}
                    >
                      <Package className="h-3 w-3 text-red-600 flex-shrink-0" />
                      <span className="truncate text-red-700 dark:text-red-300">{expense.product_name}</span>
                    </div>
                  ))}
                  {events.expenses.length > 2 && (
                    <div className="text-xs text-red-600 dark:text-red-400 pl-4">
                      +{events.expenses.length - 2} autres
                    </div>
                  )}

                  {/* Afficher les livraisons */}
                  {events.deliveries.slice(0, 2).map((delivery, idx) => (
                    <div
                      key={`delivery-${idx}`}
                      className="flex items-center gap-1 text-xs bg-orange-50 dark:bg-orange-950/30 px-1.5 py-0.5 rounded hover:bg-orange-100 dark:hover:bg-orange-900/40"
                      title={delivery.nom}
                    >
                      <Truck className="h-3 w-3 text-orange-600 flex-shrink-0" />
                      <span className="truncate text-orange-700 dark:text-orange-300">{delivery.nom}</span>
                    </div>
                  ))}
                  {events.deliveries.length > 2 && (
                    <div className="text-xs text-orange-600 dark:text-orange-400 pl-4">
                      +{events.deliveries.length - 2} autres
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

// Style CSS pour l'animation horizontale pure de la sidebar
const sidebarStyle = document.createElement("style");
sidebarStyle.textContent = `
  @keyframes slideInFromLeft {
    from {
      transform: translateY(-50%) translateX(-100%);
    }
    to {
      transform: translateY(-50%) translateX(0);
    }
  }
  
  @keyframes slideOutToLeft {
    from {
      transform: translateY(-50%) translateX(0);
    }
    to {
      transform: translateY(-50%) translateX(-100%);
    }
  }
  
  @keyframes slideInFromRight {
    from {
      transform: translateY(-50%) translateX(100%);
    }
    to {
      transform: translateY(-50%) translateX(0);
    }
  }
  
  @keyframes slideOutToRight {
    from {
      transform: translateY(-50%) translateX(0);
    }
    to {
      transform: translateY(-50%) translateX(100%);
    }
  }
  
  .sidebar-slide-in {
    animation: slideInFromLeft 500ms ease-out;
  }
  
  .sidebar-slide-out {
    animation: slideOutToLeft 400ms ease-in;
  }
  
  .sidebar-slide-in-right {
    animation: slideInFromRight 500ms ease-out;
  }
  
  .sidebar-slide-out-right {
    animation: slideOutToRight 400ms ease-in;
  }
`;
if (!document.head.querySelector("#sidebar-animation-style")) {
  sidebarStyle.id = "sidebar-animation-style";
  document.head.appendChild(sidebarStyle);
}

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [photoRefresh, setPhotoRefresh] = useState(0);
  const [expenseRefresh, setExpenseRefresh] = useState(0);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEditDimensionsOpen, setIsEditDimensionsOpen] = useState(false);
  const [isProjectInfoCollapsed, setIsProjectInfoCollapsed] = useState(false);
  const [isProjectInfoSidebarOpen, setIsProjectInfoSidebarOpen] = useState(false); // État pour la sidebar des infos projet
  const [isProjectInfoSidebarClosing, setIsProjectInfoSidebarClosing] = useState(false); // État pour l'animation de fermeture
  const [isExpensesSidebarOpen, setIsExpensesSidebarOpen] = useState(false); // État pour la sidebar des statistiques
  const [isExpensesSidebarClosing, setIsExpensesSidebarClosing] = useState(false); // État pour l'animation de fermeture
  const [isCalendarDropdownOpen, setIsCalendarDropdownOpen] = useState(false); // État pour le dropdown du calendrier
  const [isMonthViewOpen, setIsMonthViewOpen] = useState(false); // État pour la vue mensuelle directe
  const [layout3DKey, setLayout3DKey] = useState(0);
  const [layoutCanvasKey, setLayoutCanvasKey] = useState(0);
  const [editFormData, setEditFormData] = useState({
    nom_projet: "",
    numero_chassis: "",
    immatriculation: "",
    type_mine: "",
    date_mise_circulation: "",
    marque_custom: "",
    modele_custom: "",
    nom_proprietaire: "",
    adresse_proprietaire: "",
    telephone_proprietaire: "",
    email_proprietaire: "",
    longueur_mm: "",
    largeur_mm: "",
    hauteur_mm: "",
    longueur_chargement_mm: "",
    largeur_chargement_mm: "",
    poids_vide_kg: "",
    charge_utile_kg: "",
    ptac_kg: "",
  });

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return;

      try {
        // Récupérer le projet avec les infos du véhicule
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select(
            `
            *,
            vehicles_catalog (
              marque,
              modele
            )
          `,
          )
          .eq("id", id)
          .single();

        if (projectError) {
          console.error("Erreur lors de la récupération du projet:", projectError);
          toast.error("Erreur lors du chargement du projet");
          return;
        }

        setProject(projectData);
      } catch (error) {
        console.error("Erreur:", error);
        toast.error("Une erreur est survenue");
      } finally {
        setIsLoading(false);
      }
    };

    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    fetchProject();
    fetchUser();
  }, [id]);

  const handlePhotoUploaded = () => {
    setPhotoRefresh((prev) => prev + 1);
  };

  const handleExpenseAdded = () => {
    setExpenseRefresh((prev) => prev + 1);
  };

  // Fonction pour fermer la sidebar avec animation
  const handleCloseProjectInfoSidebar = () => {
    setIsProjectInfoSidebarClosing(true);
    setTimeout(() => {
      setIsProjectInfoSidebarOpen(false);
      setIsProjectInfoSidebarClosing(false);
    }, 400); // Durée de l'animation de sortie
  };

  // Fonction pour fermer la sidebar des statistiques avec animation
  const handleCloseExpensesSidebar = () => {
    setIsExpensesSidebarClosing(true);
    setTimeout(() => {
      setIsExpensesSidebarOpen(false);
      setIsExpensesSidebarClosing(false);
    }, 400); // Durée de l'animation de sortie
  };

  const handleEditDimensions = () => {
    if (!project) return;

    setEditFormData({
      nom_projet: project.nom_projet || "",
      numero_chassis: project.numero_chassis || "",
      immatriculation: project.immatriculation || "",
      type_mine: project.type_mine || "",
      date_mise_circulation: project.date_mise_circulation || "",
      marque_custom: project.marque_custom || "",
      modele_custom: project.modele_custom || "",
      nom_proprietaire: project.nom_proprietaire || "",
      adresse_proprietaire: project.adresse_proprietaire || "",
      telephone_proprietaire: project.telephone_proprietaire || "",
      email_proprietaire: project.email_proprietaire || "",
      longueur_mm: project.longueur_mm?.toString() || "",
      largeur_mm: project.largeur_mm?.toString() || "",
      hauteur_mm: project.hauteur_mm?.toString() || "",
      longueur_chargement_mm: project.longueur_chargement_mm?.toString() || "",
      largeur_chargement_mm: project.largeur_chargement_mm?.toString() || "",
      poids_vide_kg: project.poids_vide_kg?.toString() || "",
      charge_utile_kg: project.charge_utile_kg?.toString() || "",
      ptac_kg: project.ptac_kg?.toString() || "",
    });

    setIsEditDimensionsOpen(true);
  };

  const handleSaveDimensions = async () => {
    if (!project) return;

    try {
      const updateData: any = {
        nom_projet: editFormData.nom_projet || null,
        numero_chassis: editFormData.numero_chassis || null,
        immatriculation: editFormData.immatriculation || null,
        type_mine: editFormData.type_mine || null,
        date_mise_circulation: editFormData.date_mise_circulation || null,
        marque_custom: editFormData.marque_custom || null,
        modele_custom: editFormData.modele_custom || null,
        nom_proprietaire: editFormData.nom_proprietaire || project.nom_proprietaire,
        adresse_proprietaire: editFormData.adresse_proprietaire || null,
        telephone_proprietaire: editFormData.telephone_proprietaire || null,
        email_proprietaire: editFormData.email_proprietaire || null,
        longueur_mm: editFormData.longueur_mm ? parseInt(editFormData.longueur_mm) : null,
        largeur_mm: editFormData.largeur_mm ? parseInt(editFormData.largeur_mm) : null,
        hauteur_mm: editFormData.hauteur_mm ? parseInt(editFormData.hauteur_mm) : null,
        longueur_chargement_mm: editFormData.longueur_chargement_mm
          ? parseInt(editFormData.longueur_chargement_mm)
          : null,
        largeur_chargement_mm: editFormData.largeur_chargement_mm ? parseInt(editFormData.largeur_chargement_mm) : null,
        poids_vide_kg: editFormData.poids_vide_kg ? parseInt(editFormData.poids_vide_kg) : null,
        charge_utile_kg: editFormData.charge_utile_kg ? parseInt(editFormData.charge_utile_kg) : null,
        ptac_kg: editFormData.ptac_kg ? parseInt(editFormData.ptac_kg) : null,
      };

      const { error } = await supabase.from("projects").update(updateData).eq("id", project.id);

      if (error) throw error;

      toast.success("Informations mises à jour");
      setIsEditDimensionsOpen(false);

      // Recharger le projet
      const { data: updatedProject } = await supabase
        .from("projects")
        .select(
          `
          *,
          vehicles_catalog (
            marque,
            modele
          )
        `,
        )
        .eq("id", project.id)
        .single();

      if (updatedProject) {
        setProject(updatedProject);
        setLayout3DKey((prev) => prev + 1);
        setLayoutCanvasKey((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>

            <img src={logo} alt="Alsace Van Création" className="h-20 w-auto object-contain" />
            <div className="flex-1">
              <h1 className="text-xl font-bold">{project.nom_proprietaire}</h1>
              {project.vehicles_catalog && (
                <p className="text-sm text-muted-foreground">
                  {project.vehicles_catalog.marque} {project.vehicles_catalog.modele}
                </p>
              )}
            </div>

            {/* Widget Agenda Compact avec dropdown */}
            <div className="relative">
              <AgendaWidget
                projectId={project?.id || null}
                onClick={() => setIsCalendarDropdownOpen(!isCalendarDropdownOpen)}
                onDoubleClick={() => {
                  setIsCalendarDropdownOpen(false);
                  setIsMonthViewOpen(true);
                }}
              />

              {/* Overlay transparent pour fermer au clic extérieur */}
              {isCalendarDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsCalendarDropdownOpen(false)} />
                  <CalendarDropdown
                    projectId={project?.id || null}
                    isOpen={isCalendarDropdownOpen}
                    onClose={() => setIsCalendarDropdownOpen(false)}
                  />
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="default" size="sm" onClick={() => navigate("/shop")}>
                <ShoppingBag className="h-4 w-4 mr-2" />
                Boutique
              </Button>
              {user && (
                <>
                  <AdminMessagesNotification />
                  <UserMenu user={user} />
                  <Button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="h-10 w-10 rounded-full"
                    size="icon"
                    variant="outline"
                    title="Notes et Tâches"
                  >
                    <PanelRightOpen className={`h-5 w-5 transition-transform ${isSidebarOpen ? "rotate-180" : ""}`} />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Bouton ROND bleu Informations Projet sous l'entête */}
      <div className="container mx-auto px-4 pt-4">
        <Button
          variant="default"
          size="icon"
          className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700"
          onClick={() => {
            if (isProjectInfoSidebarOpen) {
              handleCloseProjectInfoSidebar();
            } else {
              setIsProjectInfoSidebarOpen(true);
            }
          }}
          title="Informations du Projet"
        >
          <FileText className="h-5 w-5" />
        </Button>
      </div>

      {/* Sidebar Informations Projet - glisse depuis la GAUCHE vers la DROITE */}
      {isProjectInfoSidebarOpen && (
        <>
          {/* Overlay TRANSPARENT */}
          <div className="fixed inset-0 z-40 transition-opacity" onClick={handleCloseProjectInfoSidebar} />

          {/* Sidebar à GAUCHE avec hauteur limitée - Animation horizontale pure */}
          <div
            className={`${isProjectInfoSidebarClosing ? "sidebar-slide-out" : "sidebar-slide-in"} fixed left-0 top-1/2 -translate-y-1/2 z-50 w-[500px] max-h-[85vh] bg-card border-r-2 border-blue-200 dark:border-blue-800 shadow-2xl rounded-r-xl overflow-hidden`}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b bg-blue-50 dark:bg-blue-950/30">
                <h2 className="text-lg font-semibold">Informations du Projet</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleEditDimensions}>
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleCloseProjectInfoSidebar}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Contenu scrollable */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Informations générales */}
                <div className="space-y-1.5 mb-4">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Informations générales</h4>
                  {project.nom_projet && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0">Nom du projet :</span>
                      <p className="font-medium">{project.nom_projet}</p>
                    </div>
                  )}
                  {project.numero_chassis && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0">N° de châssis :</span>
                      <p className="font-medium">{project.numero_chassis}</p>
                    </div>
                  )}
                  {project.immatriculation && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0">Immatriculation :</span>
                      <p className="font-medium">{project.immatriculation}</p>
                    </div>
                  )}
                  {project.type_mine && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0">Type mine :</span>
                      <p className="font-medium">{project.type_mine}</p>
                    </div>
                  )}
                  {project.date_mise_circulation && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0">Date de circulation :</span>
                      <p className="font-medium">
                        {new Date(project.date_mise_circulation).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  )}
                  {(project.marque_custom || project.modele_custom) && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0">Véhicule :</span>
                      <p className="font-medium">
                        {project.marque_custom} {project.modele_custom}
                      </p>
                    </div>
                  )}
                </div>

                {/* Propriétaire */}
                <div className="space-y-1.5 mb-4 pt-4 border-t">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Propriétaire</h4>
                  <div className="flex gap-2 text-xs">
                    <span className="text-muted-foreground shrink-0">Nom :</span>
                    <p className="font-medium">{project.nom_proprietaire}</p>
                  </div>
                  {project.adresse_proprietaire && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0">Adresse :</span>
                      <p className="font-medium">{project.adresse_proprietaire}</p>
                    </div>
                  )}
                  {project.telephone_proprietaire && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0">Téléphone :</span>
                      <p className="font-medium">{project.telephone_proprietaire}</p>
                    </div>
                  )}
                  {project.email_proprietaire && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0">Email :</span>
                      <p className="font-medium">{project.email_proprietaire}</p>
                    </div>
                  )}
                </div>

                {/* Dimensions et Poids */}
                {(project.longueur_mm ||
                  project.largeur_mm ||
                  project.hauteur_mm ||
                  project.longueur_chargement_mm ||
                  project.largeur_chargement_mm ||
                  project.poids_vide_kg ||
                  project.charge_utile_kg ||
                  project.ptac_kg) && (
                  <div className="grid grid-cols-1 gap-4 pt-4 border-t">
                    {/* Dimensions totales */}
                    {(project.longueur_mm || project.largeur_mm || project.hauteur_mm) && (
                      <div className="space-y-2 border-l-4 border-blue-200 dark:border-blue-800 pl-3">
                        <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400">Dimensions totales</h4>
                        {project.longueur_mm && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0">Longueur :</span>
                            <p className="font-medium">{project.longueur_mm} mm</p>
                          </div>
                        )}
                        {project.largeur_mm && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0">Largeur :</span>
                            <p className="font-medium">{project.largeur_mm} mm</p>
                          </div>
                        )}
                        {project.hauteur_mm && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0">Hauteur :</span>
                            <p className="font-medium">{project.hauteur_mm} mm</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Surface utile */}
                    {(project.longueur_chargement_mm || project.largeur_chargement_mm) && (
                      <div className="space-y-2 border-l-4 border-orange-200 dark:border-orange-800 pl-3">
                        <h4 className="text-xs font-semibold text-orange-700 dark:text-orange-400">Surface utile</h4>
                        {project.longueur_chargement_mm && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0">Longueur :</span>
                            <p className="font-medium">{project.longueur_chargement_mm} mm</p>
                          </div>
                        )}
                        {project.largeur_chargement_mm && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0">Largeur :</span>
                            <p className="font-medium">{project.largeur_chargement_mm} mm</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Poids */}
                    {(project.poids_vide_kg || project.charge_utile_kg || project.ptac_kg) && (
                      <div className="space-y-2 border-l-4 border-green-200 dark:border-green-800 pl-3">
                        <h4 className="text-xs font-semibold text-green-700 dark:text-green-400">Poids</h4>
                        {project.poids_vide_kg && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0">À vide :</span>
                            <p className="font-medium">{project.poids_vide_kg} kg</p>
                          </div>
                        )}
                        {project.charge_utile_kg && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0">Charge utile :</span>
                            <p className="font-medium">{project.charge_utile_kg} kg</p>
                          </div>
                        )}
                        {project.ptac_kg && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0">PTAC :</span>
                            <p className="font-medium">{project.ptac_kg} kg</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <main className="container mx-auto px-4 py-4">
        <div className="flex gap-6">
          {/* Contenu principal */}
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="photos" className="w-full">
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
                <TabsTrigger value="photos" className="gap-2">
                  <Image className="h-4 w-4 text-purple-600" />
                  <span className="hidden sm:inline">Photos</span>
                </TabsTrigger>
                <TabsTrigger value="expenses" className="gap-2">
                  <Euro className="h-4 w-4 text-green-600" />
                  <span className="hidden sm:inline">Dépenses</span>
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="hidden sm:inline">Documents</span>
                </TabsTrigger>
                <TabsTrigger value="catalog" className="gap-2">
                  <Package className="h-4 w-4 text-orange-600" />
                  <span className="hidden sm:inline">Catalogue</span>
                </TabsTrigger>
                <TabsTrigger value="notices" className="gap-2">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  <span className="hidden sm:inline">Notices</span>
                </TabsTrigger>
                <TabsTrigger value="technical" className="gap-2">
                  <Wrench className="h-4 w-4 text-red-600" />
                  <span className="hidden sm:inline">Technique</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="photos" className="mt-6">
                <PhotosTab projectId={project.id} />
              </TabsContent>

              <TabsContent value="expenses" className="mt-6">
                <div className="space-y-4">
                  {/* Header avec bouton Statistiques */}
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Dépenses</h2>
                    <Button onClick={() => setIsExpensesSidebarOpen(true)} className="gap-2" variant="default">
                      <BarChart3 className="h-4 w-4" />
                      📊 Voir les statistiques
                    </Button>
                  </div>

                  {/* Sous-onglets : Liste et Bilan */}
                  <Tabs defaultValue="liste" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="liste">Liste des dépenses</TabsTrigger>
                      <TabsTrigger value="bilan">Bilan comptable</TabsTrigger>
                    </TabsList>

                    <TabsContent value="liste" className="mt-4">
                      <ExpensesList
                        projectId={project.id}
                        onExpenseChange={() => setExpenseRefresh((prev) => prev + 1)}
                      />
                    </TabsContent>

                    <TabsContent value="bilan" className="mt-4">
                      <BilanComptable projectId={project.id} projectName={project.nom_projet || project.nom_proprietaire} />
                    </TabsContent>
                  </Tabs>
                </div>
              </TabsContent>

              <TabsContent value="documents" className="mt-6">
                <DocumentsUpload projectId={project.id} />
              </TabsContent>

              <TabsContent value="catalog" className="mt-6">
                <AccessoriesCatalogView />
              </TabsContent>

              <TabsContent value="notices" className="mt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Notices techniques</h2>
                    <NoticeUploadDialog />
                  </div>
                  <NoticesList />
                </div>
              </TabsContent>

              <TabsContent value="technical" className="mt-6">
                <Tabs defaultValue="electrical" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
                    <TabsTrigger value="electrical">Schéma électrique</TabsTrigger>
                    <TabsTrigger value="cable">Section de câble</TabsTrigger>
                    <TabsTrigger value="energy">Bilan énergétique</TabsTrigger>
                    <TabsTrigger value="layout">Aménagement</TabsTrigger>
                  </TabsList>

                  <TabsContent value="electrical" className="mt-6">
                    <TechnicalCanvas projectId={project.id} />
                  </TabsContent>

                  <TabsContent value="cable" className="mt-6">
                    <CableSectionCalculator />
                  </TabsContent>

                  <TabsContent value="energy" className="mt-6">
                    <EnergyBalance projectId={project.id} />
                  </TabsContent>

                  <TabsContent value="layout" className="mt-6">
                    <Tabs defaultValue="2d" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="2d">Plan 2D</TabsTrigger>
                        <TabsTrigger value="3d">Vue 3D</TabsTrigger>
                      </TabsList>

                      <TabsContent value="2d" className="mt-6">
                        <LayoutCanvas
                          key={layoutCanvasKey}
                          projectId={project.id}
                          vehicleLength={project.longueur_chargement_mm || 0}
                          vehicleWidth={project.largeur_chargement_mm || 0}
                        />
                      </TabsContent>

                      <TabsContent value="3d" className="mt-6">
                        <Layout3DView
                          key={layout3DKey}
                          projectId={project.id}
                          loadAreaLength={project.longueur_chargement_mm || 0}
                          loadAreaWidth={project.largeur_chargement_mm || 0}
                          loadAreaHeight={project.hauteur_mm || 0}
                        />
                      </TabsContent>
                    </Tabs>
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      {/* Sidebar pour les notes et tâches */}
      <ProjectSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} projectId={project?.id || null} />

      {/* Sidebar des statistiques - Glisse depuis la DROITE avec overlay transparent */}
      {isExpensesSidebarOpen && (
        <>
          {/* Overlay TRANSPARENT */}
          <div
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] transition-opacity"
            onClick={handleCloseExpensesSidebar}
          />

          {/* Sidebar à DROITE avec hauteur limitée - Animation horizontale pure */}
          <div
            className={`${isExpensesSidebarClosing ? "sidebar-slide-out-right" : "sidebar-slide-in-right"} fixed right-0 top-1/2 -translate-y-1/2 z-50 w-[600px] h-[90vh] bg-card border-l-2 border-green-200 dark:border-green-800 shadow-2xl rounded-l-xl overflow-hidden flex flex-col`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-green-50 dark:bg-green-950/30 flex-shrink-0">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold">Statistiques & Analyses</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={handleCloseExpensesSidebar}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Contenu scrollable - ExpensesSummary */}
            <div className="flex-1 overflow-y-auto p-4">
              <ExpensesSummary 
                currentProjectId={project.id} 
                onPaymentChange={() => setExpenseRefresh(prev => prev + 1)}
              />
            </div>
          </div>
        </>
      )}

      {/* Dialog pour modifier les dimensions et infos du projet */}
      <Dialog open={isEditDimensionsOpen} onOpenChange={setIsEditDimensionsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier les informations du projet</DialogTitle>
            <DialogDescription>
              Modifiez les dimensions du véhicule et les informations du propriétaire
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Section Informations générales */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Informations générales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nom_projet">Nom du projet</Label>
                  <Input
                    id="nom_projet"
                    value={editFormData.nom_projet}
                    onChange={(e) => setEditFormData({ ...editFormData, nom_projet: e.target.value })}
                    placeholder="Ex: Aménagement fourgon"
                  />
                </div>
                <div>
                  <Label htmlFor="numero_chassis">Numéro de châssis (VIN)</Label>
                  <Input
                    id="numero_chassis"
                    value={editFormData.numero_chassis}
                    onChange={(e) => setEditFormData({ ...editFormData, numero_chassis: e.target.value })}
                    placeholder="Ex: VF3LCYHZPHS123456"
                  />
                </div>
                <div>
                  <Label htmlFor="immatriculation">Immatriculation</Label>
                  <Input
                    id="immatriculation"
                    value={editFormData.immatriculation}
                    onChange={(e) => setEditFormData({ ...editFormData, immatriculation: e.target.value })}
                    placeholder="Ex: AB-123-CD"
                  />
                </div>
                <div>
                  <Label htmlFor="type_mine">Type mine</Label>
                  <Input
                    id="type_mine"
                    value={editFormData.type_mine}
                    onChange={(e) => setEditFormData({ ...editFormData, type_mine: e.target.value })}
                    placeholder="Ex: VP1234567890"
                  />
                </div>
                <div>
                  <Label htmlFor="date_mise_circulation">Date de mise en circulation</Label>
                  <Input
                    id="date_mise_circulation"
                    type="date"
                    value={editFormData.date_mise_circulation}
                    onChange={(e) => setEditFormData({ ...editFormData, date_mise_circulation: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="marque_custom">Marque (personnalisée)</Label>
                  <Input
                    id="marque_custom"
                    value={editFormData.marque_custom}
                    onChange={(e) => setEditFormData({ ...editFormData, marque_custom: e.target.value })}
                    placeholder="Ex: Citroën"
                  />
                </div>
                <div>
                  <Label htmlFor="modele_custom">Modèle (personnalisé)</Label>
                  <Input
                    id="modele_custom"
                    value={editFormData.modele_custom}
                    onChange={(e) => setEditFormData({ ...editFormData, modele_custom: e.target.value })}
                    placeholder="Ex: Jumper L3H2"
                  />
                </div>
              </div>
            </div>

            {/* Section Propriétaire */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Informations du propriétaire</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nom_proprietaire">Nom du propriétaire *</Label>
                  <Input
                    id="nom_proprietaire"
                    value={editFormData.nom_proprietaire}
                    onChange={(e) => setEditFormData({ ...editFormData, nom_proprietaire: e.target.value })}
                    placeholder="Nom complet"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="telephone_proprietaire">Téléphone</Label>
                  <Input
                    id="telephone_proprietaire"
                    value={editFormData.telephone_proprietaire}
                    onChange={(e) => setEditFormData({ ...editFormData, telephone_proprietaire: e.target.value })}
                    placeholder="Ex: 06 12 34 56 78"
                  />
                </div>
                <div>
                  <Label htmlFor="email_proprietaire">Email</Label>
                  <Input
                    id="email_proprietaire"
                    type="email"
                    value={editFormData.email_proprietaire}
                    onChange={(e) => setEditFormData({ ...editFormData, email_proprietaire: e.target.value })}
                    placeholder="email@exemple.fr"
                  />
                </div>
                <div>
                  <Label htmlFor="adresse_proprietaire">Adresse</Label>
                  <Input
                    id="adresse_proprietaire"
                    value={editFormData.adresse_proprietaire}
                    onChange={(e) => setEditFormData({ ...editFormData, adresse_proprietaire: e.target.value })}
                    placeholder="Adresse complète"
                  />
                </div>
              </div>
            </div>

            {/* Section Dimensions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Dimensions du véhicule</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="longueur">Longueur totale (mm)</Label>
                  <Input
                    id="longueur"
                    type="number"
                    value={editFormData.longueur_mm}
                    onChange={(e) => setEditFormData({ ...editFormData, longueur_mm: e.target.value })}
                    placeholder="Ex: 5413"
                  />
                </div>
                <div>
                  <Label htmlFor="largeur">Largeur totale (mm)</Label>
                  <Input
                    id="largeur"
                    type="number"
                    value={editFormData.largeur_mm}
                    onChange={(e) => setEditFormData({ ...editFormData, largeur_mm: e.target.value })}
                    placeholder="Ex: 2050"
                  />
                </div>
                <div>
                  <Label htmlFor="hauteur">Hauteur totale (mm)</Label>
                  <Input
                    id="hauteur"
                    type="number"
                    value={editFormData.hauteur_mm}
                    onChange={(e) => setEditFormData({ ...editFormData, hauteur_mm: e.target.value })}
                    placeholder="Ex: 2524"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="longueur_chargement">Longueur utile (mm)</Label>
                  <Input
                    id="longueur_chargement"
                    type="number"
                    value={editFormData.longueur_chargement_mm}
                    onChange={(e) => setEditFormData({ ...editFormData, longueur_chargement_mm: e.target.value })}
                    placeholder="Ex: 3705"
                  />
                </div>
                <div>
                  <Label htmlFor="largeur_chargement">Largeur utile (mm)</Label>
                  <Input
                    id="largeur_chargement"
                    type="number"
                    value={editFormData.largeur_chargement_mm}
                    onChange={(e) => setEditFormData({ ...editFormData, largeur_chargement_mm: e.target.value })}
                    placeholder="Ex: 1870"
                  />
                </div>
              </div>
            </div>

            {/* Section Poids */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Poids</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="poids_vide">Poids à vide (kg)</Label>
                  <Input
                    id="poids_vide"
                    type="number"
                    value={editFormData.poids_vide_kg}
                    onChange={(e) => setEditFormData({ ...editFormData, poids_vide_kg: e.target.value })}
                    placeholder="Ex: 2100"
                  />
                </div>
                <div>
                  <Label htmlFor="charge_utile">Charge utile (kg)</Label>
                  <Input
                    id="charge_utile"
                    type="number"
                    value={editFormData.charge_utile_kg}
                    onChange={(e) => setEditFormData({ ...editFormData, charge_utile_kg: e.target.value })}
                    placeholder="Ex: 1400"
                  />
                </div>
                <div>
                  <Label htmlFor="ptac">PTAC (kg)</Label>
                  <Input
                    id="ptac"
                    type="number"
                    value={editFormData.ptac_kg}
                    onChange={(e) => setEditFormData({ ...editFormData, ptac_kg: e.target.value })}
                    placeholder="Ex: 3500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDimensionsOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveDimensions}>Enregistrer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Planning Mensuel (double-clic sur le widget) */}
      <Dialog open={isMonthViewOpen} onOpenChange={setIsMonthViewOpen}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📅 Planning Mensuel</DialogTitle>
          </DialogHeader>
          <SimpleMonthView projectId={project?.id || null} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetail;
