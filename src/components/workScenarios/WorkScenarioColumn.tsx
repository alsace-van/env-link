// components/workScenarios/WorkScenarioColumn.tsx
// Colonne d'un scénario de travaux avec ses tâches

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, Lock, MoreVertical, Copy, Trash2, Star, 
  Euro, Clock, CheckCircle2, Edit2, Eye, EyeOff
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useScenarios } from "@/hooks/useScenarios";
import { useWorkScenarios, WorkTask, WorkScenarioStats } from "@/hooks/useWorkScenarios";
import WorkTaskCard from "./WorkTaskCard";
import AddWorkTaskDialog from "./AddWorkTaskDialog";
import type { Scenario } from "@/types/scenarios";
import { toast } from "sonner";

interface WorkScenarioColumnProps {
  scenario: Scenario;
  projectId: string;
  tasks: WorkTask[];
  stats: WorkScenarioStats;
  isLocked: boolean;
  onTaskChange: () => void;
  onScenarioChange: () => void;
}

const WorkScenarioColumn = ({
  scenario,
  projectId,
  tasks,
  stats,
  isLocked,
  onTaskChange,
  onScenarioChange,
}: WorkScenarioColumnProps) => {
  const [showAddTask, setShowAddTask] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  
  const { deleteScenario, duplicateScenario, promoteScenario } = useScenarios(projectId);
  const { duplicateTasksToScenario, createTask } = useWorkScenarios(projectId);

  const progress = stats.totalTasks > 0 
    ? (stats.completedTasks / stats.totalTasks) * 100 
    : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2 
    }).format(amount);
  };

  const handleDuplicate = async () => {
    const newName = `${scenario.nom} (copie)`;
    const newScenario = await duplicateScenario(scenario.id, newName);
    if (newScenario) {
      // Dupliquer aussi les tâches
      await duplicateTasksToScenario(scenario.id, newScenario.id);
      onScenarioChange();
    }
  };

  const handleDelete = async () => {
    if (scenario.est_principal) {
      toast.error("Impossible de supprimer le scénario principal");
      return;
    }
    if (confirm("Supprimer ce scénario et toutes ses tâches ?")) {
      await deleteScenario(scenario.id);
      onScenarioChange();
    }
  };

  const handlePromote = async () => {
    if (confirm("Promouvoir ce scénario en scénario principal ?")) {
      await promoteScenario(scenario.id);
      onScenarioChange();
    }
  };

  // Filtrer les tâches à afficher
  const visibleTasks = showCompleted 
    ? tasks 
    : tasks.filter(t => !t.completed);

  // Grouper par catégorie
  const tasksByCategory = visibleTasks.reduce((acc, task) => {
    const catId = task.category_id || 'uncategorized';
    if (!acc[catId]) {
      acc[catId] = {
        category: task.work_categories,
        tasks: []
      };
    }
    acc[catId].tasks.push(task);
    return acc;
  }, {} as Record<string, { category: any; tasks: WorkTask[] }>);

  return (
    <Card className={`h-full flex flex-col ${scenario.est_principal ? 'border-blue-300 border-2' : ''}`}>
      {/* Header du scénario */}
      <CardHeader className="pb-2 space-y-2" style={{ backgroundColor: `${scenario.couleur}15` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{scenario.icone}</span>
            <h3 className="font-semibold">{scenario.nom}</h3>
            {scenario.est_principal && (
              <Badge variant="default" className="text-xs">Principal</Badge>
            )}
            {isLocked && (
              <Lock className="h-4 w-4 text-amber-600" />
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowCompleted(!showCompleted)}>
                {showCompleted ? (
                  <><EyeOff className="h-4 w-4 mr-2" /> Masquer terminées</>
                ) : (
                  <><Eye className="h-4 w-4 mr-2" /> Afficher terminées</>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-2" /> Dupliquer
              </DropdownMenuItem>
              {!scenario.est_principal && (
                <>
                  <DropdownMenuItem onClick={handlePromote}>
                    <Star className="h-4 w-4 mr-2" /> Définir comme principal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleDelete}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats du scénario */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {stats.completedTasks}/{stats.totalTasks} tâches
            </span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
          
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="text-center p-2 bg-white/50 dark:bg-black/20 rounded">
              <p className="text-xs text-muted-foreground">HT</p>
              <p className="font-bold text-blue-700 dark:text-blue-400">
                {formatCurrency(stats.totalHT)}
              </p>
            </div>
            <div className="text-center p-2 bg-white/50 dark:bg-black/20 rounded">
              <p className="text-xs text-muted-foreground">TTC</p>
              <p className="font-bold text-green-700 dark:text-green-400">
                {formatCurrency(stats.totalTTC)}
              </p>
            </div>
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Estimé: {stats.totalEstimatedHours.toFixed(1)}h
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Réel: {stats.totalActualHours.toFixed(1)}h
            </span>
          </div>
        </div>
      </CardHeader>

      {/* Liste des tâches */}
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-[400px]">
          <div className="p-3 space-y-4">
            {Object.entries(tasksByCategory).map(([catId, { category, tasks: catTasks }]) => (
              <div key={catId} className="space-y-2">
                {/* En-tête de catégorie */}
                {category && (
                  <div 
                    className="flex items-center gap-2 px-2 py-1 rounded text-sm font-medium"
                    style={{ backgroundColor: `${category.color}20`, color: category.color }}
                  >
                    <span>{category.icon}</span>
                    <span>{category.name}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {catTasks.length}
                    </Badge>
                  </div>
                )}
                
                {/* Tâches de cette catégorie */}
                <div className="space-y-2 pl-2">
                  {catTasks.map((task) => (
                    <WorkTaskCard
                      key={task.id}
                      task={task}
                      isLocked={isLocked}
                      onUpdate={onTaskChange}
                    />
                  ))}
                </div>
              </div>
            ))}

            {visibleTasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {showCompleted 
                  ? "Aucune tâche dans ce scénario"
                  : "Toutes les tâches sont terminées"
                }
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Footer - Bouton ajouter */}
      {!isLocked && (
        <div className="p-3 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => setShowAddTask(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une tâche
          </Button>
        </div>
      )}

      {/* Dialog ajout tâche */}
      <AddWorkTaskDialog
        open={showAddTask}
        onOpenChange={setShowAddTask}
        projectId={projectId}
        scenarioId={scenario.id}
        onCreated={onTaskChange}
      />
    </Card>
  );
};

export default WorkScenarioColumn;
