// components/planning/VisualPlanningCanvas.tsx
// Planning visuel avec canvas principal (jours) et canvas par jour (tâches)
// Double-clic sur un jour = ouvre le détail
// Flèche vers autre jour = crée automatiquement la tâche

import { useState, useEffect, useCallback, memo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
  Panel,
  MarkerType,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  CalendarDays,
  Plus,
  ArrowLeft,
  GripVertical,
  X,
  Check,
  Clock,
  AlertCircle,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Calendar as CalendarIcon,
  Loader2,
  LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, isToday, isSameDay, addDays } from "date-fns";
import { fr } from "date-fns/locale";

// ============================================
// TYPES
// ============================================

interface PlanningTask {
  id: string;
  project_id: string;
  user_id: string;
  task_date: string;
  title: string;
  description?: string;
  position_x: number;
  position_y: number;
  color: string;
  width: number;
  status: "todo" | "in_progress" | "done" | "blocked";
  parent_task_id?: string;
  source_date?: string;
}

interface TaskLink {
  id: string;
  source_task_id: string;
  target_task_id: string;
  label?: string;
  animated: boolean;
}

interface DayPosition {
  id: string;
  day_date: string;
  position_x: number;
  position_y: number;
  color: string;
}

// Couleurs disponibles
const COLORS = [
  { value: "blue", class: "bg-blue-500", light: "bg-blue-100 border-blue-300" },
  { value: "green", class: "bg-green-500", light: "bg-green-100 border-green-300" },
  { value: "orange", class: "bg-orange-500", light: "bg-orange-100 border-orange-300" },
  { value: "purple", class: "bg-purple-500", light: "bg-purple-100 border-purple-300" },
  { value: "red", class: "bg-red-500", light: "bg-red-100 border-red-300" },
  { value: "yellow", class: "bg-yellow-500", light: "bg-yellow-100 border-yellow-300" },
  { value: "pink", class: "bg-pink-500", light: "bg-pink-100 border-pink-300" },
  { value: "cyan", class: "bg-cyan-500", light: "bg-cyan-100 border-cyan-300" },
];

const STATUS_CONFIG = {
  todo: { label: "À faire", icon: Clock, color: "text-gray-500" },
  in_progress: { label: "En cours", icon: Loader2, color: "text-blue-500" },
  done: { label: "Terminé", icon: Check, color: "text-green-500" },
  blocked: { label: "Bloqué", icon: AlertCircle, color: "text-red-500" },
};

// ============================================
// DAY NODE (Vue principale)
// ============================================

const DayNode = memo(({ data, selected }: NodeProps) => {
  const day = data.day as { date: string; tasks: PlanningTask[]; position: DayPosition | null };
  const onDoubleClick = data.onDoubleClick as (date: string) => void;
  const colorConfig = COLORS.find(c => c.value === (day.position?.color || "blue")) || COLORS[0];
  
  const taskCount = day.tasks.length;
  const doneCount = day.tasks.filter(t => t.status === "done").length;
  const dateObj = parseISO(day.date);
  const isCurrentDay = isToday(dateObj);

  return (
    <div
      className={`
        rounded-xl border-2 shadow-lg cursor-pointer transition-all
        ${selected ? "ring-2 ring-blue-500 shadow-xl scale-105" : "hover:shadow-xl hover:scale-102"}
        ${isCurrentDay ? "ring-2 ring-yellow-400" : ""}
        ${colorConfig.light}
      `}
      style={{ minWidth: 160 }}
      onDoubleClick={() => onDoubleClick(day.date)}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3 !h-3" />

      {/* Header avec date */}
      <div className={`px-4 py-2 rounded-t-xl ${colorConfig.class} text-white`}>
        <div className="text-xs uppercase opacity-80">
          {format(dateObj, "EEEE", { locale: fr })}
        </div>
        <div className="text-xl font-bold">
          {format(dateObj, "d MMMM", { locale: fr })}
        </div>
      </div>

      {/* Contenu */}
      <div className="p-3">
        {taskCount === 0 ? (
          <div className="text-center text-gray-400 text-sm py-2">
            Double-clic pour ajouter
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">{taskCount} tâche(s)</span>
              <Badge variant={doneCount === taskCount ? "default" : "secondary"} className="text-xs">
                {doneCount}/{taskCount}
              </Badge>
            </div>
            {/* Aperçu des 3 premières tâches */}
            <div className="space-y-0.5 mt-2">
              {day.tasks.slice(0, 3).map(task => (
                <div key={task.id} className="flex items-center gap-1 text-xs">
                  {task.status === "done" ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-gray-400" />
                  )}
                  <span className={task.status === "done" ? "line-through text-gray-400" : "text-gray-700"}>
                    {task.title.length > 20 ? task.title.substring(0, 20) + "..." : task.title}
                  </span>
                </div>
              ))}
              {taskCount > 3 && (
                <div className="text-xs text-gray-400 pl-4">
                  +{taskCount - 3} autres...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3 !h-3" />
    </div>
  );
});

DayNode.displayName = "DayNode";

// ============================================
// TASK NODE (Vue jour)
// ============================================

const TaskNode = memo(({ data, selected }: NodeProps) => {
  const task = data.task as PlanningTask;
  const onUpdate = data.onUpdate as (id: string, updates: Partial<PlanningTask>) => void;
  const onDelete = data.onDelete as (id: string) => void;
  const onCreateLinkedTask = data.onCreateLinkedTask as (sourceTaskId: string, targetDate: Date, title: string) => void;
  
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState<Date | undefined>();

  const colorConfig = COLORS.find(c => c.value === task.color) || COLORS[0];
  const statusConfig = STATUS_CONFIG[task.status];
  const StatusIcon = statusConfig.icon;

  const stopDrag = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
  };

  const handleSaveTitle = () => {
    if (editTitle.trim()) {
      onUpdate(task.id, { title: editTitle.trim() });
    }
    setIsEditing(false);
  };

  const handleCreateLink = () => {
    if (newTaskDate && newTaskTitle.trim()) {
      onCreateLinkedTask(task.id, newTaskDate, newTaskTitle.trim());
      setShowDatePicker(false);
      setNewTaskTitle("");
      setNewTaskDate(undefined);
    }
  };

  return (
    <div
      className={`
        rounded-lg border-2 shadow-md transition-all
        ${selected ? "ring-2 ring-blue-500 shadow-lg" : ""}
        ${colorConfig.light}
      `}
      style={{ width: task.width || 220, minHeight: 60 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3 !h-3" />

      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 ${colorConfig.class} text-white rounded-t-md cursor-grab`}>
        <GripVertical className="h-4 w-4 opacity-70" />
        
        {isEditing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveTitle();
              if (e.key === "Escape") setIsEditing(false);
            }}
            onPointerDown={stopDrag}
            className="flex-1 bg-white/20 border-0 rounded px-1 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-white/50 nodrag"
          />
        ) : (
          <span
            className="flex-1 text-sm font-medium truncate cursor-text"
            onDoubleClick={() => setIsEditing(true)}
          >
            {task.title}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onPointerDown={stopDrag}
              className="p-1 hover:bg-white/20 rounded"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              Renommer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => onUpdate(task.id, { status: key as PlanningTask["status"] })}
              >
                <config.icon className={`h-4 w-4 mr-2 ${config.color}`} />
                {config.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(task.id)}
              className="text-red-500"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Status + actions */}
      <div className="p-2 space-y-2 nodrag" onPointerDown={stopDrag}>
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${statusConfig.color} ${task.status === "in_progress" ? "animate-spin" : ""}`} />
          <span className={`text-xs ${statusConfig.color}`}>{statusConfig.label}</span>
        </div>

        {/* Source info si créée depuis un autre jour */}
        {task.source_date && (
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            Depuis {format(parseISO(task.source_date), "d MMM", { locale: fr })}
          </div>
        )}

        {/* Bouton pour créer une tâche liée vers un autre jour */}
        <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full text-xs h-7">
              <Plus className="h-3 w-3 mr-1" />
              Suite vers autre jour...
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Titre de la suite</label>
                <Input
                  placeholder={`Suite: ${task.title}`}
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Date</label>
                <Calendar
                  mode="single"
                  selected={newTaskDate}
                  onSelect={setNewTaskDate}
                  locale={fr}
                  className="rounded-md border mt-1"
                />
              </div>
              <Button
                onClick={handleCreateLink}
                disabled={!newTaskDate || !newTaskTitle.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Créer la suite
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3 !h-3" />
    </div>
  );
});

TaskNode.displayName = "TaskNode";

const nodeTypes = {
  dayNode: DayNode,
  taskNode: TaskNode,
};

// ============================================
// MAIN COMPONENT
// ============================================

interface VisualPlanningCanvasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const VisualPlanningCanvas = ({ open, onOpenChange, projectId }: VisualPlanningCanvasProps) => {
  // États
  const [viewMode, setViewMode] = useState<"calendar" | "day">("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tasks, setTasks] = useState<PlanningTask[]>([]);
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [dayPositions, setDayPositions] = useState<DayPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // ReactFlow
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Charger les données
  const loadData = useCallback(async () => {
    setIsLoading(true);
    
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setUserId(userData.user.id);

    // Charger les tâches
    const { data: tasksData } = await supabase
      .from("planning_tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("task_date");

    // Charger les liens
    const { data: linksData } = await supabase
      .from("planning_task_links")
      .select("*");

    // Charger les positions des jours
    const { data: positionsData } = await supabase
      .from("planning_day_positions")
      .select("*")
      .eq("project_id", projectId);

    setTasks((tasksData || []) as PlanningTask[]);
    setLinks((linksData || []) as TaskLink[]);
    setDayPositions((positionsData || []) as DayPosition[]);
    setIsLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  // Construire les nodes pour la vue calendrier
  const buildCalendarNodes = useCallback(() => {
    // Grouper les tâches par jour
    const tasksByDay = tasks.reduce((acc, task) => {
      if (!acc[task.task_date]) acc[task.task_date] = [];
      acc[task.task_date].push(task);
      return acc;
    }, {} as Record<string, PlanningTask[]>);

    // Créer un node par jour qui a des tâches
    const daysWithTasks = Object.keys(tasksByDay);
    
    const flowNodes: Node[] = daysWithTasks.map((date, index) => {
      const position = dayPositions.find(p => p.day_date === date);
      return {
        id: `day-${date}`,
        type: "dayNode",
        position: {
          x: position?.position_x || 100 + (index % 4) * 200,
          y: position?.position_y || 100 + Math.floor(index / 4) * 250,
        },
        data: {
          day: {
            date,
            tasks: tasksByDay[date],
            position,
          },
          onDoubleClick: handleDayDoubleClick,
        },
      };
    });

    // Créer les edges entre jours (basé sur les liens parent_task)
    const flowEdges: Edge[] = [];
    tasks.forEach(task => {
      if (task.parent_task_id) {
        const parentTask = tasks.find(t => t.id === task.parent_task_id);
        if (parentTask && parentTask.task_date !== task.task_date) {
          const edgeId = `day-edge-${parentTask.task_date}-${task.task_date}`;
          if (!flowEdges.find(e => e.id === edgeId)) {
            flowEdges.push({
              id: edgeId,
              source: `day-${parentTask.task_date}`,
              target: `day-${task.task_date}`,
              type: "smoothstep",
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { stroke: "#3b82f6", strokeWidth: 2 },
            });
          }
        }
      }
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [tasks, dayPositions]);

  // Construire les nodes pour la vue jour
  const buildDayNodes = useCallback(() => {
    if (!selectedDate) return;

    const dayTasks = tasks.filter(t => t.task_date === selectedDate);
    
    const flowNodes: Node[] = dayTasks.map(task => ({
      id: task.id,
      type: "taskNode",
      position: { x: task.position_x, y: task.position_y },
      data: {
        task,
        onUpdate: handleUpdateTask,
        onDelete: handleDeleteTask,
        onCreateLinkedTask: handleCreateLinkedTask,
      },
    }));

    // Edges entre tâches du même jour
    const dayLinks = links.filter(link => {
      const source = dayTasks.find(t => t.id === link.source_task_id);
      const target = dayTasks.find(t => t.id === link.target_task_id);
      return source && target;
    });

    const flowEdges: Edge[] = dayLinks.map(link => ({
      id: link.id,
      source: link.source_task_id,
      target: link.target_task_id,
      label: link.label,
      type: "smoothstep",
      animated: link.animated,
      markerEnd: { type: MarkerType.ArrowClosed },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [selectedDate, tasks, links]);

  // Effet pour construire les nodes selon le mode
  useEffect(() => {
    if (viewMode === "calendar") {
      buildCalendarNodes();
    } else {
      buildDayNodes();
    }
  }, [viewMode, buildCalendarNodes, buildDayNodes]);

  // Handlers
  const handleDayDoubleClick = (date: string) => {
    setSelectedDate(date);
    setViewMode("day");
  };

  const handleBackToCalendar = () => {
    setViewMode("calendar");
    setSelectedDate(null);
  };

  const handleAddTask = async () => {
    if (!selectedDate || !userId) return;

    const newTask = {
      user_id: userId,
      project_id: projectId,
      task_date: selectedDate,
      title: "Nouvelle tâche",
      position_x: 100 + tasks.filter(t => t.task_date === selectedDate).length * 30,
      position_y: 100 + tasks.filter(t => t.task_date === selectedDate).length * 30,
      color: "blue",
      width: 220,
      status: "todo" as const,
    };

    const { data, error } = await supabase
      .from("planning_tasks")
      .insert(newTask)
      .select()
      .single();

    if (!error && data) {
      setTasks([...tasks, data as PlanningTask]);
      toast.success("Tâche ajoutée");
    }
  };

  const handleAddDay = async (date: Date) => {
    if (!userId) return;
    
    const dateStr = format(date, "yyyy-MM-dd");
    
    // Vérifier si le jour existe déjà
    if (tasks.some(t => t.task_date === dateStr)) {
      toast.info("Ce jour a déjà des tâches");
      return;
    }

    // Créer une première tâche pour ce jour
    const newTask = {
      user_id: userId,
      project_id: projectId,
      task_date: dateStr,
      title: "Nouvelle tâche",
      position_x: 100,
      position_y: 100,
      color: "blue",
      width: 220,
      status: "todo" as const,
    };

    const { data, error } = await supabase
      .from("planning_tasks")
      .insert(newTask)
      .select()
      .single();

    if (!error && data) {
      setTasks([...tasks, data as PlanningTask]);
      toast.success(`Jour ${format(date, "d MMMM", { locale: fr })} ajouté`);
    }
  };

  const handleUpdateTask = useCallback(async (id: string, updates: Partial<PlanningTask>) => {
    await supabase.from("planning_tasks").update(updates).eq("id", id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const handleDeleteTask = useCallback(async (id: string) => {
    await supabase.from("planning_tasks").delete().eq("id", id);
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.success("Tâche supprimée");
  }, []);

  const handleCreateLinkedTask = useCallback(async (sourceTaskId: string, targetDate: Date, title: string) => {
    if (!userId) return;

    const sourceTask = tasks.find(t => t.id === sourceTaskId);
    if (!sourceTask) return;

    const dateStr = format(targetDate, "yyyy-MM-dd");
    const existingTasksForDay = tasks.filter(t => t.task_date === dateStr);

    // Créer la nouvelle tâche liée
    const newTask = {
      user_id: userId,
      project_id: projectId,
      task_date: dateStr,
      title,
      position_x: 100 + existingTasksForDay.length * 30,
      position_y: 100 + existingTasksForDay.length * 30,
      color: sourceTask.color,
      width: 220,
      status: "todo" as const,
      parent_task_id: sourceTaskId,
      source_date: sourceTask.task_date,
    };

    const { data, error } = await supabase
      .from("planning_tasks")
      .insert(newTask)
      .select()
      .single();

    if (!error && data) {
      setTasks([...tasks, data as PlanningTask]);
      
      // Créer le lien
      await supabase.from("planning_task_links").insert({
        source_task_id: sourceTaskId,
        target_task_id: data.id,
        animated: true,
      });

      toast.success(`Tâche créée pour le ${format(targetDate, "d MMMM", { locale: fr })}`);
    }
  }, [tasks, userId, projectId]);

  // Sauvegarder la position des nodes
  const onNodeDragStop = useCallback(async (_: any, node: Node) => {
    if (viewMode === "calendar") {
      // Sauvegarder position du jour
      const date = node.id.replace("day-", "");
      const existing = dayPositions.find(p => p.day_date === date);
      
      if (existing) {
        await supabase
          .from("planning_day_positions")
          .update({ position_x: node.position.x, position_y: node.position.y })
          .eq("id", existing.id);
      } else if (userId) {
        await supabase.from("planning_day_positions").insert({
          user_id: userId,
          project_id: projectId,
          day_date: date,
          position_x: node.position.x,
          position_y: node.position.y,
        });
      }
    } else {
      // Sauvegarder position de la tâche
      await supabase
        .from("planning_tasks")
        .update({ position_x: node.position.x, position_y: node.position.y })
        .eq("id", node.id);
    }
  }, [viewMode, dayPositions, userId, projectId]);

  // Connexion entre tâches
  const onConnect = useCallback(async (params: Connection) => {
    if (viewMode === "day" && params.source && params.target) {
      const { data } = await supabase
        .from("planning_task_links")
        .insert({
          source_task_id: params.source,
          target_task_id: params.target,
        })
        .select()
        .single();

      if (data) {
        setEdges(eds => addEdge({
          ...params,
          id: data.id,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
        }, eds));
      }
    }
  }, [viewMode]);

  // Auto-layout avec DAGRE
  const handleAutoLayout = useCallback(async () => {
    if (nodes.length === 0) return;

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    
    // Configuration selon le mode
    if (viewMode === "calendar") {
      // Vue calendrier : layout horizontal par date
      dagreGraph.setGraph({ rankdir: "LR", nodesep: 80, ranksep: 120 }); // LR = Left to Right
    } else {
      // Vue jour : layout vertical
      dagreGraph.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 80 }); // TB = Top to Bottom
    }

    // Ajouter les nodes avec leurs dimensions
    nodes.forEach((node) => {
      const width = viewMode === "calendar" ? 180 : 220;
      const height = viewMode === "calendar" ? 160 : 120;
      dagreGraph.setNode(node.id, { width, height });
    });

    // Ajouter les edges
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // Calculer le layout
    dagre.layout(dagreGraph);

    // Appliquer les nouvelles positions
    const updates: Promise<any>[] = [];
    const newNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      const width = viewMode === "calendar" ? 180 : 220;
      const height = viewMode === "calendar" ? 160 : 120;
      const newX = nodeWithPosition.x - width / 2;
      const newY = nodeWithPosition.y - height / 2;

      // Sauvegarder en base
      if (viewMode === "calendar") {
        const date = node.id.replace("day-", "");
        const existing = dayPositions.find(p => p.day_date === date);
        if (existing) {
          updates.push(
            supabase
              .from("planning_day_positions")
              .update({ position_x: newX, position_y: newY })
              .eq("id", existing.id)
          );
        } else if (userId) {
          updates.push(
            supabase.from("planning_day_positions").insert({
              user_id: userId,
              project_id: projectId,
              day_date: date,
              position_x: newX,
              position_y: newY,
            })
          );
        }
      } else {
        updates.push(
          supabase
            .from("planning_tasks")
            .update({ position_x: newX, position_y: newY })
            .eq("id", node.id)
        );
      }

      return {
        ...node,
        position: { x: newX, y: newY },
      };
    });

    await Promise.all(updates);
    setNodes(newNodes);
    toast.success("Layout réorganisé !");
  }, [nodes, edges, viewMode, dayPositions, userId, projectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {viewMode === "day" && (
                <Button variant="ghost" size="icon" onClick={handleBackToCalendar}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-500" />
                {viewMode === "calendar" ? (
                  "Planning Visuel"
                ) : (
                  <>Planning - {format(parseISO(selectedDate!), "EEEE d MMMM yyyy", { locale: fr })}</>
                )}
              </DialogTitle>
            </div>

            <div className="flex items-center gap-2">
              {/* Bouton Auto-layout */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoLayout}
                disabled={nodes.length === 0}
                title="Organiser automatiquement"
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Auto-layout
              </Button>

              {viewMode === "calendar" ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter un jour
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      onSelect={(date) => date && handleAddDay(date)}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <Button onClick={handleAddTask}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une tâche
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Canvas */}
        <div className="flex-1">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDragStop={onNodeDragStop}
              nodeTypes={nodeTypes}
              fitView
              snapToGrid
              snapGrid={[20, 20]}
              defaultEdgeOptions={{
                type: "smoothstep",
                markerEnd: { type: MarkerType.ArrowClosed },
              }}
            >
              <Background gap={20} />
              <Controls />
              <MiniMap 
                nodeColor={(node) => {
                  if (node.type === "dayNode") return "#3b82f6";
                  return "#10b981";
                }}
              />
              <Panel position="top-left">
                <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow text-sm space-y-1">
                  {viewMode === "calendar" ? (
                    <>
                      <div className="font-medium">Vue Calendrier</div>
                      <div className="text-gray-500 text-xs">
                        Double-clic sur un jour pour voir les détails
                      </div>
                      <div className="text-gray-500 text-xs">
                        {tasks.length} tâche(s) au total
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-medium">Vue Jour</div>
                      <div className="text-gray-500 text-xs">
                        Glissez les tâches pour les organiser
                      </div>
                      <div className="text-gray-500 text-xs">
                        Créez des liens vers d'autres jours
                      </div>
                    </>
                  )}
                </div>
              </Panel>
            </ReactFlow>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VisualPlanningCanvas;
