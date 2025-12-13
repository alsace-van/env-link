import { useEffect, useState, useRef } from "react";
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
  ClipboardList,
  Camera,
  Ruler,
  ShoppingCart,
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
import { AIUsageWidget } from "@/components/AIUsageWidget";
import { ProjectSidebar } from "@/components/project/ProjectSidebar";
import { ProjectInfoSidebar } from "@/components/project/ProjectInfoSidebar";
import { DocumentsUpload } from "@/components/DocumentsUpload";
import { OfficialDocumentsLibrary } from "@/components/OfficialDocumentsLibrary";
import ProjectForm from "@/components/ProjectForm";
import { VehicleInspectionTab } from "@/components/vehicle-inspection/VehicleInspectionTab";
import { WorkTabMain } from "@/components/work/WorkTabMain";
import { AllProjectsTasksSidebar } from "@/components/work/AllProjectsTasksSidebar";
import { PhotoTemplatesContent } from "@/components/photo-templates/PhotoTemplatesContent";
import ScenarioManager from "@/components/scenarios/ScenarioManager";
import OrderTrackingSidebar from "@/components/OrderTrackingSidebar";
import MechanicalProcedures from "@/components/MechanicalProcedures";
import { DownloadsWidget } from "@/components/DownloadsWidget";
import logo from "@/assets/logo.png";
import AIChatAssistant from "@/components/AIChatAssistant";
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
import DailyNotesButton from "@/components/planning/DailyNotesButton";

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
  date_premiere_circulation?: string;
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
  // Informations complémentaires carte grise
  prenom_proprietaire?: string;
  ville_proprietaire?: string;
  code_postal_proprietaire?: string;
  date_premiere_immatriculation?: string;
  puissance_fiscale?: number;
  cylindree?: number;
  masse_vide?: number;
  masse_en_charge_max?: number;
  numero_chassis_vin?: string;
  vin?: string;
  denomination_commerciale?: string;
  genre_national?: string;
  carrosserie?: string;
  energie?: string;
  ptra?: number;
  masse_ordre_marche_kg?: number;
  marque_officielle?: string;
  modele_officiel?: string;
  nombre_places?: number;
  marque_vehicule?: string;
  modele_vehicule?: string;
  // Champs RTI carte grise
  categorie_international?: string;
  type_variante?: string;
  numero_reception_ce?: string;
  places_assises_origine?: number;
  puissance_kw?: number;
  co2_emission?: number;
  norme_euro?: string;
  carrosserie_ce?: string;
  carrosserie_nationale?: string;
  // Propriétés pour les scénarios
  statut_financier?: string;
  date_validation_devis?: string;
  date_encaissement_acompte?: string;
  montant_acompte?: number;
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
    }, 10000); // Mise à jour toutes les 10 secondes pour plus de précision
    return () => clearInterval(interval);
  }, []);

  // Récupérer les événements du jour
  const todayEvents = [
    ...todos.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), currentTime)),
    ...appointments.filter((a) => a.appointment_date && isSameDay(parseISO(a.appointment_date), currentTime)),
    ...supplierExpenses.filter((e) => e.order_date && isSameDay(parseISO(e.order_date), currentTime)),
    ...accessoryDeliveries.filter((d) => d.delivery_date && isSameDay(parseISO(d.delivery_date), currentTime)),
  ].slice(0, 2); // Max 2 événements

  return (
    <Card
      className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors border-blue-200 dark:border-blue-800"
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
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId, setCurrentProjectId]);

  // Mise à jour de l'heure actuelle toutes les 10 secondes
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  // Récupérer les événements du jour pour chaque heure
  const leftColumnHours = [8, 9, 10, 11, 12, 13, 14]; // 8h-14h
  const rightColumnHours = [15, 16, 17, 18, 19, 20, 21]; // 15h-21h

  const getEventsForHour = (hour: number) => {
    const events: any[] = [];

    // Filtrer les tâches
    todos
      .filter((t) => {
        if (!t.due_date) return false;
        const date = parseISO(t.due_date);
        return isSameDay(date, currentTime) && date.getHours() === hour;
      })
      .forEach((t) => events.push({ ...t, type: "todo" }));

    // Filtrer les rendez-vous
    appointments
      .filter((a) => {
        if (!a.appointment_date) return false;
        const date = parseISO(a.appointment_date);
        return isSameDay(date, currentTime) && date.getHours() === hour;
      })
      .forEach((a) => events.push({ ...a, type: "appointment" }));

    // Filtrer les dépenses
    supplierExpenses
      .filter((e) => {
        if (!e.order_date) return false;
        const date = parseISO(e.order_date);
        return isSameDay(date, currentTime) && date.getHours() === hour;
      })
      .forEach((e) => events.push({ ...e, type: "expense" }));

    // Filtrer les livraisons
    accessoryDeliveries
      .filter((d) => {
        if (!d.delivery_date) return false;
        const date = parseISO(d.delivery_date);
        return isSameDay(date, currentTime) && date.getHours() === hour;
      })
      .forEach((d) => events.push({ ...d, type: "delivery" }));

    return events;
  };

  const HourCell = ({ hour }: { hour: number }) => {
    const events = getEventsForHour(hour);
    const currentHour = currentTime.getHours();
    const isCurrentHour = hour === currentHour && isSameDay(currentTime, new Date());

    return (
      <div
        className={`p-2 rounded-md border transition-all cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-700 ${
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
            <div className="flex items-center gap-1">
              {projectId && <DailyNotesButton projectId={projectId} variant="ghost" size="icon" showLabel={false} />}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <ChevronUp className="h-5 w-5" />
              </Button>
            </div>
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [allTodos, setAllTodos] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [supplierExpenses, setSupplierExpenses] = useState<any[]>([]);
  const [accessoryDeliveries, setAccessoryDeliveries] = useState<any[]>([]);

  // Charger TOUTES les données pour le planning mensuel (tous les projets)
  useEffect(() => {
    const loadAllData = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Charger tous les projets EN PREMIER
      const { data: projectsData } = await (supabase as any)
        .from("projects")
        .select("id, name, nom")
        .eq("user_id", user.user.id);

      // 🔥 Créer un map pour les noms de projets
      const projectsWithNames = (projectsData || []).map((p: any) => ({
        id: p.id,
        name: p.name || p.nom || "Sans nom",
      }));
      console.log("📅 ProjectDetail - Projets chargés:", projectsWithNames.length, projectsWithNames);
      setProjects(projectsWithNames);

      // Charger toutes les tâches de l'utilisateur
      const { data: todosData } = await (supabase as any)
        .from("project_todos")
        .select("*")
        .eq("user_id", user.user.id)
        .order("due_date", { ascending: true });
      console.log("📅 ProjectDetail - Todos chargés:", todosData?.length);
      if (todosData) setAllTodos(todosData);

      // Charger tous les rendez-vous
      const { data: appointmentsData } = await (supabase as any)
        .from("appointments")
        .select("*")
        .eq("user_id", user.user.id);
      if (appointmentsData) setAppointments(appointmentsData);

      // Charger toutes les dépenses
      const { data: expensesData } = await (supabase as any)
        .from("project_expenses")
        .select("*")
        .eq("user_id", user.user.id);
      if (expensesData) setSupplierExpenses(expensesData);

      // Charger toutes les livraisons
      const { data: deliveriesData } = await (supabase as any)
        .from("accessories_catalog")
        .select("*")
        .eq("user_id", user.user.id)
        .not("delivery_date", "is", null);
      if (deliveriesData) setAccessoryDeliveries(deliveriesData);
    };
    loadAllData();
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Ajouter les jours du mois précédent pour compléter la première semaine
  const firstDayOfWeek = getDay(monthStart);
  const previousMonthDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const startDate = addDays(monthStart, -previousMonthDays);

  // Ajouter les jours du mois suivant pour compléter la dernière semaine
  const lastDayOfWeek = getDay(monthEnd);
  const nextMonthDays = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
  const endDate = addDays(monthEnd, nextMonthDays);

  const allDays = eachDayOfInterval({ start: startDate, end: endDate });

  // Helper pour obtenir les noms de projets ayant des travaux ce jour
  const getProjectNamesForDate = (date: Date) => {
    const todosForDate = allTodos.filter((t) => {
      if (t.due_date && isSameDay(parseISO(t.due_date), date)) return true;
      if (t.scheduled_date && isSameDay(parseISO(t.scheduled_date), date)) return true;
      return false;
    });

    // Regrouper par projet - utiliser les noms directement
    const projectNamesSet = new Set<string>();
    const tasksWithoutProject: string[] = [];

    todosForDate.forEach((todo: any) => {
      if (todo.project_id) {
        // Chercher le nom du projet
        const project = projects.find((p) => p.id === todo.project_id);
        if (project?.name) {
          projectNamesSet.add(project.name);
        } else {
          // Fallback: chercher dans les projets ou marquer comme inconnu
          console.warn("⚠️ Projet non trouvé pour ID:", todo.project_id, "- Projets disponibles:", projects.length);
          // Ne pas ajouter "Projet inconnu" si les projets ne sont pas encore chargés
          if (projects.length > 0) {
            projectNamesSet.add("Projet inconnu");
          }
        }
      } else {
        tasksWithoutProject.push(todo.title);
      }
    });

    return {
      projectNames: Array.from(projectNamesSet),
      tasksWithoutProject,
      totalTodos: todosForDate.length,
    };
  };

  const getEventsForDate = (date: Date) => {
    // Inclure due_date ET scheduled_date pour les tâches
    const todosForDate = allTodos.filter((t) => {
      if (t.due_date && isSameDay(parseISO(t.due_date), date)) return true;
      if (t.scheduled_date && isSameDay(parseISO(t.scheduled_date), date)) return true;
      return false;
    });
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
                  {/* Afficher les noms de projets et tâches sans projet */}
                  {(() => {
                    const { projectNames, tasksWithoutProject } = getProjectNamesForDate(day);
                    return (
                      <>
                        {projectNames.slice(0, 2).map((name, idx) => (
                          <div
                            key={`proj-${idx}`}
                            className="flex items-center gap-1 text-xs bg-purple-50 dark:bg-purple-950/30 px-1.5 py-0.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/40"
                            title={name}
                          >
                            <CheckCircle2 className="h-3 w-3 text-purple-500 flex-shrink-0" />
                            <span className="truncate text-purple-700 dark:text-purple-300 font-medium">{name}</span>
                          </div>
                        ))}
                        {tasksWithoutProject.slice(0, 2 - Math.min(projectNames.length, 2)).map((title, idx) => (
                          <div
                            key={`task-${idx}`}
                            className="flex items-center gap-1 text-xs bg-purple-50/50 dark:bg-purple-950/20 px-1.5 py-0.5 rounded hover:bg-purple-100/50 dark:hover:bg-purple-900/30"
                            title={title}
                          >
                            <CheckCircle2 className="h-3 w-3 text-purple-400 flex-shrink-0" />
                            <span className="truncate text-purple-600 dark:text-purple-400">{title}</span>
                          </div>
                        ))}
                        {projectNames.length + tasksWithoutProject.length > 2 && (
                          <div className="text-xs text-purple-600 dark:text-purple-400 pl-4">
                            +{projectNames.length + tasksWithoutProject.length - 2} autres
                          </div>
                        )}
                      </>
                    );
                  })()}

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
  const [noticesRefresh, setNoticesRefresh] = useState(0);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEditDimensionsOpen, setIsEditDimensionsOpen] = useState(false);
  const [isProjectInfoCollapsed, setIsProjectInfoCollapsed] = useState(false);
  const [isProjectInfoSidebarOpen, setIsProjectInfoSidebarOpen] = useState(false);
  const [isExpensesSidebarOpen, setIsExpensesSidebarOpen] = useState(false);
  const [isExpensesSidebarClosing, setIsExpensesSidebarClosing] = useState(false);
  const [isCalendarDropdownOpen, setIsCalendarDropdownOpen] = useState(false);
  const [isMonthViewOpen, setIsMonthViewOpen] = useState(false);
  const [layout3DKey, setLayout3DKey] = useState(0);
  const [layoutCanvasKey, setLayoutCanvasKey] = useState(0);

  // Position draggable du bouton sidebar Notes
  const [sidebarBtnPosition, setSidebarBtnPosition] = useState(() => {
    const saved = localStorage.getItem("projectSidebarBtnPosition");
    return saved ? JSON.parse(saved) : null;
  });
  const [isSidebarBtnDragging, setIsSidebarBtnDragging] = useState(false);
  const [sidebarBtnDragStart, setSidebarBtnDragStart] = useState({ x: 0, y: 0 });

  // Position draggable du bouton Informations Projet
  const [projectInfoBtnPosition, setProjectInfoBtnPosition] = useState(() => {
    const saved = localStorage.getItem("projectInfoBtnPosition");
    return saved ? JSON.parse(saved) : { x: 16, y: 16 };
  });
  const [isProjectInfoBtnDragging, setIsProjectInfoBtnDragging] = useState(false);
  const [projectInfoBtnDragStart, setProjectInfoBtnDragStart] = useState({ x: 0, y: 0 });

  // Position draggable du bouton Statistiques
  const [statsBtnPosition, setStatsBtnPosition] = useState(() => {
    const saved = localStorage.getItem("statsBtnPosition");
    return saved ? JSON.parse(saved) : null;
  });
  const [isStatsBtnDragging, setIsStatsBtnDragging] = useState(false);
  const [statsBtnDragStart, setStatsBtnDragStart] = useState({ x: 0, y: 0 });

  // Position draggable du bouton Suivi Commandes
  const [ordersBtnPosition, setOrdersBtnPosition] = useState(() => {
    const saved = localStorage.getItem("ordersBtnPosition");
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 120, y: 200 };
  });
  const [isOrdersBtnDragging, setIsOrdersBtnDragging] = useState(false);
  const [ordersBtnDragStart, setOrdersBtnDragStart] = useState({ x: 0, y: 0 });
  const [isOrderTrackingOpen, setIsOrderTrackingOpen] = useState(false);

  // Refs pour détecter si un drag a vraiment eu lieu
  const hasDraggedSidebarBtn = useRef(false);
  const hasDraggedProjectInfoBtn = useRef(false);
  const hasDraggedStatsBtn = useRef(false);
  const hasDraggedOrdersBtn = useRef(false);

  const [editFormData, setEditFormData] = useState({
    nom_projet: "",
    numero_chassis: "",
    immatriculation: "",
    type_mine: "",
    date_premiere_circulation: "",
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

  // Fonction pour recharger le projet (utilisée après déverrouillage)
  const reloadProject = async () => {
    if (!id) return;

    const { data: projectData, error } = await supabase
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

    if (!error && projectData) {
      setProject(projectData);
    }
  };

  const handlePhotoUploaded = () => {
    setPhotoRefresh((prev) => prev + 1);
  };

  const handleExpenseAdded = () => {
    setExpenseRefresh((prev) => prev + 1);
  };

  // Gestionnaires pour le bouton sidebar Notes draggable
  const handleSidebarBtnMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    hasDraggedSidebarBtn.current = false;
    setIsSidebarBtnDragging(true);
    const currentPos = sidebarBtnPosition || { x: e.clientX, y: e.clientY };
    setSidebarBtnDragStart({
      x: e.clientX - currentPos.x,
      y: e.clientY - currentPos.y,
    });
  };

  const handleSidebarBtnMouseMove = (e: MouseEvent) => {
    if (!isSidebarBtnDragging) return;
    hasDraggedSidebarBtn.current = true;

    const newX = Math.max(0, Math.min(e.clientX - sidebarBtnDragStart.x, window.innerWidth - 60));
    const newY = Math.max(0, Math.min(e.clientY - sidebarBtnDragStart.y, window.innerHeight - 60));

    const newPosition = { x: newX, y: newY };
    setSidebarBtnPosition(newPosition);
    localStorage.setItem("projectSidebarBtnPosition", JSON.stringify(newPosition));
  };

  const handleSidebarBtnMouseUp = () => {
    setIsSidebarBtnDragging(false);
  };

  const handleSidebarBtnClick = () => {
    if (hasDraggedSidebarBtn.current) {
      hasDraggedSidebarBtn.current = false;
      return;
    }
    setIsSidebarOpen(true);
  };

  useEffect(() => {
    if (isSidebarBtnDragging) {
      window.addEventListener("mousemove", handleSidebarBtnMouseMove);
      window.addEventListener("mouseup", handleSidebarBtnMouseUp);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      return () => {
        window.removeEventListener("mousemove", handleSidebarBtnMouseMove);
        window.removeEventListener("mouseup", handleSidebarBtnMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isSidebarBtnDragging, sidebarBtnDragStart]);

  // Gestionnaires pour le bouton Informations Projet draggable
  const handleProjectInfoBtnMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    hasDraggedProjectInfoBtn.current = false;
    setIsProjectInfoBtnDragging(true);
    setProjectInfoBtnDragStart({
      x: e.clientX - projectInfoBtnPosition.x,
      y: e.clientY - projectInfoBtnPosition.y,
    });
  };

  const handleProjectInfoBtnMouseMove = (e: MouseEvent) => {
    if (!isProjectInfoBtnDragging) return;
    hasDraggedProjectInfoBtn.current = true;

    const newX = Math.max(0, Math.min(e.clientX - projectInfoBtnDragStart.x, window.innerWidth - 60));
    const newY = Math.max(0, Math.min(e.clientY - projectInfoBtnDragStart.y, window.innerHeight - 60));

    const newPosition = { x: newX, y: newY };
    setProjectInfoBtnPosition(newPosition);
    localStorage.setItem("projectInfoBtnPosition", JSON.stringify(newPosition));
  };

  const handleProjectInfoBtnMouseUp = () => {
    setIsProjectInfoBtnDragging(false);
  };

  const handleProjectInfoBtnClick = () => {
    if (hasDraggedProjectInfoBtn.current) {
      hasDraggedProjectInfoBtn.current = false;
      return;
    }
    setIsProjectInfoSidebarOpen(true);
  };

  useEffect(() => {
    if (isProjectInfoBtnDragging) {
      window.addEventListener("mousemove", handleProjectInfoBtnMouseMove);
      window.addEventListener("mouseup", handleProjectInfoBtnMouseUp);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      return () => {
        window.removeEventListener("mousemove", handleProjectInfoBtnMouseMove);
        window.removeEventListener("mouseup", handleProjectInfoBtnMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isProjectInfoBtnDragging, projectInfoBtnDragStart]);

  // Gestionnaires pour le bouton Statistiques draggable
  const handleStatsBtnMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    hasDraggedStatsBtn.current = false;
    setIsStatsBtnDragging(true);
    const currentPos = statsBtnPosition || { x: e.clientX, y: e.clientY };
    setStatsBtnDragStart({
      x: e.clientX - currentPos.x,
      y: e.clientY - currentPos.y,
    });
  };

  const handleStatsBtnMouseMove = (e: MouseEvent) => {
    if (!isStatsBtnDragging) return;
    hasDraggedStatsBtn.current = true;

    const newX = Math.max(0, Math.min(e.clientX - statsBtnDragStart.x, window.innerWidth - 200));
    const newY = Math.max(0, Math.min(e.clientY - statsBtnDragStart.y, window.innerHeight - 60));

    const newPosition = { x: newX, y: newY };
    setStatsBtnPosition(newPosition);
    localStorage.setItem("statsBtnPosition", JSON.stringify(newPosition));
  };

  const handleStatsBtnMouseUp = () => {
    setIsStatsBtnDragging(false);
  };

  const handleStatsBtnClick = () => {
    if (hasDraggedStatsBtn.current) {
      hasDraggedStatsBtn.current = false;
      return;
    }
    setIsExpensesSidebarOpen(true);
  };

  useEffect(() => {
    if (isStatsBtnDragging) {
      window.addEventListener("mousemove", handleStatsBtnMouseMove);
      window.addEventListener("mouseup", handleStatsBtnMouseUp);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      return () => {
        window.removeEventListener("mousemove", handleStatsBtnMouseMove);
        window.removeEventListener("mouseup", handleStatsBtnMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isStatsBtnDragging, statsBtnDragStart]);

  // Gestionnaires pour le bouton Suivi Commandes draggable
  const handleOrdersBtnMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    hasDraggedOrdersBtn.current = false;
    setIsOrdersBtnDragging(true);
    setOrdersBtnDragStart({
      x: e.clientX - ordersBtnPosition.x,
      y: e.clientY - ordersBtnPosition.y,
    });
  };

  const handleOrdersBtnMouseMove = (e: MouseEvent) => {
    if (!isOrdersBtnDragging) return;
    hasDraggedOrdersBtn.current = true;

    const newX = Math.max(0, Math.min(e.clientX - ordersBtnDragStart.x, window.innerWidth - 60));
    const newY = Math.max(0, Math.min(e.clientY - ordersBtnDragStart.y, window.innerHeight - 60));

    const newPosition = { x: newX, y: newY };
    setOrdersBtnPosition(newPosition);
    localStorage.setItem("ordersBtnPosition", JSON.stringify(newPosition));
  };

  const handleOrdersBtnMouseUp = () => {
    setIsOrdersBtnDragging(false);
  };

  const handleOrdersBtnClick = () => {
    if (hasDraggedOrdersBtn.current) {
      hasDraggedOrdersBtn.current = false;
      return;
    }
    setIsOrderTrackingOpen(true);
  };

  useEffect(() => {
    if (isOrdersBtnDragging) {
      window.addEventListener("mousemove", handleOrdersBtnMouseMove);
      window.addEventListener("mouseup", handleOrdersBtnMouseUp);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      return () => {
        window.removeEventListener("mousemove", handleOrdersBtnMouseMove);
        window.removeEventListener("mouseup", handleOrdersBtnMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isOrdersBtnDragging, ordersBtnDragStart]);

  // Fonction pour fermer la sidebar des statistiques avec animation
  const handleCloseExpensesSidebar = () => {
    setIsExpensesSidebarClosing(true);
    setTimeout(() => {
      setIsExpensesSidebarOpen(false);
      setIsExpensesSidebarClosing(false);
    }, 400);
  };

  const handleEditDimensions = () => {
    if (!project) return;

    setEditFormData({
      nom_projet: project.nom_projet || "",
      numero_chassis: project.numero_chassis || "",
      immatriculation: project.immatriculation || "",
      type_mine: project.type_mine || "",
      date_premiere_circulation: project.date_premiere_circulation || "",
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
        date_premiere_circulation: editFormData.date_premiere_circulation || null,
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
              <AIUsageWidget />
              <Button variant="default" size="sm" onClick={() => navigate("/shop")}>
                <ShoppingBag className="h-4 w-4 mr-2" />
                Boutique
              </Button>
              {user && (
                <>
                  <AdminMessagesNotification />
                  <UserMenu user={user} />
                  {!sidebarBtnPosition && (
                    <Button
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                      onMouseDown={handleSidebarBtnMouseDown}
                      className="h-10 w-10 rounded-full cursor-grab active:cursor-grabbing"
                      size="icon"
                      variant="outline"
                      title="Notes et Tâches - Glisser pour détacher"
                    >
                      <PanelRightOpen className={`h-5 w-5 transition-transform ${isSidebarOpen ? "rotate-180" : ""}`} />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Bouton ROND bleu Informations Projet sous l'entête - Draggable */}
      <div className="container mx-auto px-4 pt-4">
        <Button
          variant="default"
          size="icon"
          className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 fixed shadow-lg cursor-grab active:cursor-grabbing z-40"
          style={{
            left: `${projectInfoBtnPosition.x}px`,
            top: `${projectInfoBtnPosition.y}px`,
          }}
          onClick={handleProjectInfoBtnClick}
          onMouseDown={handleProjectInfoBtnMouseDown}
          title="Informations du Projet - Glisser pour déplacer"
        >
          <FileText className="h-5 w-5" />
        </Button>
      </div>

      {/* Sidebar Informations Projet - avec double volet dépliable */}
      <ProjectInfoSidebar
        project={project}
        isOpen={isProjectInfoSidebarOpen}
        onClose={() => setIsProjectInfoSidebarOpen(false)}
        onEdit={handleEditDimensions}
      />

      <main className="container mx-auto px-4 py-4">
        {/* Sidebar pour toutes les tâches */}
        <AllProjectsTasksSidebar />

        {/* Bouton sidebar Notes draggable flottant */}
        {sidebarBtnPosition && (
          <Button
            onClick={handleSidebarBtnClick}
            onMouseDown={handleSidebarBtnMouseDown}
            className="fixed h-12 w-12 rounded-full shadow-lg cursor-grab active:cursor-grabbing z-50 bg-background/95 backdrop-blur-sm border-2"
            size="icon"
            variant="outline"
            title="Notes et Tâches - Glisser pour déplacer"
            style={{
              left: `${sidebarBtnPosition.x}px`,
              top: `${sidebarBtnPosition.y}px`,
            }}
          >
            <PanelRightOpen className={`h-5 w-5 transition-transform ${isSidebarOpen ? "rotate-180" : ""}`} />
          </Button>
        )}

        {/* Bouton Statistiques draggable flottant */}
        {statsBtnPosition && (
          <Button
            onClick={handleStatsBtnClick}
            onMouseDown={handleStatsBtnMouseDown}
            size="icon"
            className="fixed h-12 w-12 rounded-full shadow-lg cursor-grab active:cursor-grabbing z-40 bg-green-600 hover:bg-green-700"
            title="Voir les statistiques - Glisser pour déplacer"
            style={{
              left: `${statsBtnPosition.x}px`,
              top: `${statsBtnPosition.y}px`,
            }}
          >
            <BarChart3 className="h-5 w-5" />
          </Button>
        )}

        {/* Bouton Suivi Commandes draggable flottant */}
        <Button
          onClick={handleOrdersBtnClick}
          onMouseDown={handleOrdersBtnMouseDown}
          size="icon"
          className="fixed h-12 w-12 rounded-full shadow-lg cursor-grab active:cursor-grabbing z-40 bg-orange-500 hover:bg-orange-600"
          title="Suivi des commandes - Glisser pour déplacer"
          style={{
            left: `${ordersBtnPosition.x}px`,
            top: `${ordersBtnPosition.y}px`,
          }}
        >
          <ShoppingCart className="h-5 w-5" />
        </Button>

        <div className="flex gap-6">
          {/* Contenu principal */}
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="photos" className="w-full mt-8">
              <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
                <TabsTrigger value="photos" className="gap-2">
                  <Image className="h-4 w-4 text-purple-600" />
                  <span className="hidden sm:inline">Photos</span>
                </TabsTrigger>
                <TabsTrigger value="vehicle" className="gap-2">
                  <Truck className="h-4 w-4 text-cyan-600" />
                  <span className="hidden sm:inline">État véhicule</span>
                </TabsTrigger>
                <TabsTrigger value="work" className="gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                  <span className="hidden sm:inline">Travaux</span>
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

              <TabsContent value="vehicle" className="mt-6">
                <VehicleInspectionTab projectId={project.id} />
              </TabsContent>

              <TabsContent value="work" className="mt-6">
                <WorkTabMain projectId={project.id} />
              </TabsContent>

              <TabsContent value="expenses" className="mt-6">
                <div className="space-y-4">
                  {/* Header avec bouton Statistiques */}
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Dépenses</h2>
                    {!statsBtnPosition && (
                      <Button
                        onClick={handleStatsBtnClick}
                        onMouseDown={handleStatsBtnMouseDown}
                        size="icon"
                        className="h-12 w-12 rounded-full shadow-lg cursor-grab active:cursor-grabbing bg-green-600 hover:bg-green-700"
                        title="Voir les statistiques - Glisser pour détacher"
                      >
                        <BarChart3 className="h-5 w-5" />
                      </Button>
                    )}
                  </div>

                  {/* Sous-onglets : Scénarios et Bilan */}
                  <Tabs defaultValue="scenarios" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="scenarios">Scénarios & Dépenses</TabsTrigger>
                      <TabsTrigger value="bilan">Bilan Comptable</TabsTrigger>
                    </TabsList>
                    <TabsContent value="scenarios" className="mt-4">
                      <ScenarioManager
                        projectId={project.id}
                        project={project as any}
                        onExpenseChange={() => setExpenseRefresh((prev) => prev + 1)}
                        onProjectChange={reloadProject}
                      />
                    </TabsContent>
                    <TabsContent value="bilan" className="mt-4">
                      <BilanComptable
                        projectId={project.id}
                        projectName={project.nom_projet || project.nom_proprietaire}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </TabsContent>

              <TabsContent value="documents" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Colonne principale - Documents uploadés */}
                  <div className="lg:col-span-2">
                    <DocumentsUpload projectId={project.id} />
                  </div>
                  {/* Colonne secondaire - Documents officiels */}
                  <div className="lg:col-span-1">
                    <OfficialDocumentsLibrary projectId={project.id} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="catalog" className="mt-6">
                <AccessoriesCatalogView />
              </TabsContent>

              <TabsContent value="notices" className="mt-6">
                <Tabs defaultValue="notices-list" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="notices-list" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Notices techniques
                    </TabsTrigger>
                    <TabsTrigger value="mechanical" className="gap-2">
                      <Wrench className="h-4 w-4" />
                      Mécanique
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="notices-list" className="mt-4">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold">Notices techniques</h2>
                        <NoticeUploadDialog onSuccess={() => setNoticesRefresh((prev) => prev + 1)} />
                      </div>
                      <NoticesList refreshTrigger={noticesRefresh} />
                    </div>
                  </TabsContent>

                  <TabsContent value="mechanical" className="mt-4">
                    <MechanicalProcedures />
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="technical" className="mt-6">
                <Tabs defaultValue="electrical" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
                    <TabsTrigger value="electrical">Schéma électrique</TabsTrigger>
                    <TabsTrigger value="cable">Section de câble</TabsTrigger>
                    <TabsTrigger value="energy">Bilan énergétique</TabsTrigger>
                    <TabsTrigger value="layout">Aménagement</TabsTrigger>
                    <TabsTrigger value="templates">
                      <Ruler className="h-4 w-4 mr-2" />
                      Gabarits CNC
                    </TabsTrigger>
                    <TabsTrigger value="downloads">
                      <Package className="h-4 w-4 mr-2" />
                      Outils
                    </TabsTrigger>
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
                          vehicleLength={project.longueur_mm || project.longueur_chargement_mm || 3000}
                          vehicleWidth={project.largeur_mm || project.largeur_chargement_mm || 1800}
                          loadAreaLength={
                            project.longueur_chargement_mm || Math.round((project.longueur_mm || 3000) * 0.7)
                          }
                          loadAreaWidth={
                            project.largeur_chargement_mm || Math.round((project.largeur_mm || 1800) * 0.9)
                          }
                          maxLoad={
                            project.charge_utile_kg ||
                            (project.ptac_kg && project.poids_vide_kg ? project.ptac_kg - project.poids_vide_kg : 500)
                          }
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

                  <TabsContent value="templates" className="mt-6">
                    <PhotoTemplatesContent projectId={project.id} />
                  </TabsContent>

                  <TabsContent value="downloads" className="mt-6">
                    <DownloadsWidget />
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
          {/* Overlay transparent */}
          <div className="fixed inset-0 z-40 transition-opacity" onClick={handleCloseExpensesSidebar} />

          {/* Sidebar à DROITE avec hauteur limitée - Animation horizontale pure */}
          <div
            className={`${isExpensesSidebarClosing ? "sidebar-slide-out-right" : "sidebar-slide-in-right"} fixed right-0 top-1/2 -translate-y-1/2 z-50 w-[480px] h-[90vh] bg-card border-l-2 border-green-200 dark:border-green-800 shadow-2xl rounded-l-xl overflow-hidden flex flex-col`}
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
              <ExpensesSummary projectId={project.id} refreshTrigger={expenseRefresh} />
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
              Modifiez toutes les informations du projet, scannez une nouvelle carte grise si nécessaire
            </DialogDescription>
          </DialogHeader>
          <ProjectForm
            existingProject={project}
            isEditMode={true}
            onProjectCreated={async () => {
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
                .eq("id", id)
                .single();

              if (updatedProject) {
                setProject(updatedProject);
              }
              toast.success("Projet modifié avec succès");
            }}
          />
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

      {/* Sidebar Suivi des Commandes */}
      <OrderTrackingSidebar
        isOpen={isOrderTrackingOpen}
        onClose={() => setIsOrderTrackingOpen(false)}
        onOrderChange={() => setExpenseRefresh((prev) => prev + 1)}
      />

      {/* Chatbot IA flottant */}
      <AIChatAssistant projectId={project?.id} projectName={project?.nom_projet} />
    </div>
  );
};

export default ProjectDetail;
