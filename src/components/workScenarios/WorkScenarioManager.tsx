// components/workScenarios/WorkScenarioManager.tsx
// Gestionnaire des scénarios de travaux avec vue en colonnes

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Plus, Table2, Lock, ChevronLeft, ChevronRight, Eye, 
  Library, ClipboardList, Euro, Clock, CheckCircle2 
} from "lucide-react";
import { useWorkScenarios, WorkScenarioStats } from "@/hooks/useWorkScenarios";
import { useScenarios } from "@/hooks/useScenarios";
import WorkScenarioColumn from "./WorkScenarioColumn";
import CreateScenarioDialog from "@/components/scenarios/CreateScenarioDialog";
import { TaskTemplatesLibrary } from "@/components/work/TaskTemplatesLibrary";
import type { ProjectWithStatus } from "@/types/scenarios";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkScenarioManagerProps {
  projectId: string;
  project: ProjectWithStatus;
  onTaskChange?: () => void;
  onProjectChange?: () => void;
}

const WorkScenarioManager = ({ 
  projectId, 
  project, 
  onTaskChange,
  onProjectChange 
}: WorkScenarioManagerProps) => {
  const { 
    scenarios, 
    principalScenario, 
    isLoading: scenariosLoading,
    reloadScenarios 
  } = useScenarios(projectId);
  
  const {
    tasks,
    isLoading: tasksLoading,
    getTasksForScenario,
    getScenarioStats,
    getPrincipalStats,
    reloadAll,
  } = useWorkScenarios(projectId);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [visibleScenarios, setVisibleScenarios] = useState<Record<string, boolean>>({});
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isLocked =
    project?.statut_financier === "devis_accepte" ||
    project?.statut_financier === "en_cours" ||
    project?.statut_financier === "termine";

  // Initialiser la visibilité des scénarios
  useEffect(() => {
    if (scenarios.length > 0) {
      setVisibleScenarios((prev) => {
        const newVisibility = { ...prev };
        scenarios.forEach((s) => {
          if (!(s.id in newVisibility)) {
            newVisibility[s.id] = true;
          }
        });
        return newVisibility;
      });
    }
  }, [scenarios]);

  // Navigation carrousel
  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -470, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 470, behavior: "smooth" });
  };

  const toggleVisibility = (scenarioId: string) => {
    setVisibleScenarios((prev) => ({
      ...prev,
      [scenarioId]: !prev[scenarioId],
    }));
  };

  const handleTaskChange = () => {
    reloadAll();
    onTaskChange?.();
  };

  const displayedScenarios = scenarios.filter((s) => visibleScenarios[s.id] !== false);
  const principalStats = getPrincipalStats();
  const isLoading = scenariosLoading || tasksLoading;

  // Formater les montants
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2 
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header avec statistiques globales et actions */}
      <div className="flex justify-between items-start gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Fiche de travaux
          </h3>

          {isLocked && principalScenario && (
            <Badge variant="secondary" className="gap-2">
              <Lock className="h-3 w-3" />
              Devis verrouillé
            </Badge>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Bouton visibilité des scénarios */}
          {scenarios.length > 1 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Affichage ({displayedScenarios.length}/{scenarios.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Scénarios visibles</h4>
                  <div className="space-y-3">
                    {scenarios.map((scenario) => (
                      <div key={scenario.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`work-visible-${scenario.id}`}
                          checked={visibleScenarios[scenario.id] !== false}
                          onCheckedChange={() => toggleVisibility(scenario.id)}
                          disabled={scenario.est_principal}
                        />
                        <Label
                          htmlFor={`work-visible-${scenario.id}`}
                          className="flex items-center gap-2 cursor-pointer flex-1"
                        >
                          <span className="text-lg">{scenario.icone}</span>
                          <span className="flex-1">{scenario.nom}</span>
                          {scenario.est_principal && (
                            <Badge variant="outline" className="text-xs">
                              Principal
                            </Badge>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Button onClick={() => setShowLibrary(true)} variant="outline" size="sm">
            <Library className="h-4 w-4 mr-2" />
            Bibliothèque
          </Button>

          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau scénario
          </Button>
        </div>
      </div>

      {/* Résumé financier global (scénario principal) */}
      {principalScenario && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Euro className="h-4 w-4 text-blue-600" />
              Récapitulatif - {principalScenario.nom}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Progression */}
              <div className="col-span-2 md:col-span-1">
                <p className="text-xs text-muted-foreground mb-1">Progression</p>
                <div className="space-y-1">
                  <Progress 
                    value={principalStats.totalTasks > 0 
                      ? (principalStats.completedTasks / principalStats.totalTasks) * 100 
                      : 0
                    } 
                    className="h-2"
                  />
                  <p className="text-sm font-medium">
                    {principalStats.completedTasks}/{principalStats.totalTasks} tâches
                  </p>
                </div>
              </div>

              {/* Total HT */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total HT</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
                  {formatCurrency(principalStats.totalHT)}
                </p>
              </div>

              {/* Total TTC */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total TTC</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(principalStats.totalTTC)}
                </p>
              </div>

              {/* Heures estimées */}
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Estimé
                </p>
                <p className="text-lg font-semibold">
                  {principalStats.totalEstimatedHours.toFixed(1)}h
                </p>
              </div>

              {/* Heures réelles */}
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Réalisé
                </p>
                <p className="text-lg font-semibold">
                  {principalStats.totalActualHours.toFixed(1)}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vue en carrousel */}
      <div className="relative">
        {displayedScenarios.length > 2 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 shadow-lg"
              onClick={scrollLeft}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 shadow-lg"
              onClick={scrollRight}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        <div 
          ref={scrollContainerRef} 
          className="overflow-x-auto pb-4 scroll-smooth" 
          style={{ scrollbarWidth: "thin" }}
        >
          <div className="flex gap-4" style={{ minWidth: "min-content" }}>
            {displayedScenarios.map((scenario) => (
              <div key={scenario.id} style={{ minWidth: "450px", maxWidth: "450px" }}>
                <WorkScenarioColumn
                  scenario={scenario}
                  projectId={projectId}
                  tasks={getTasksForScenario(scenario.id)}
                  stats={getScenarioStats(scenario.id)}
                  isLocked={isLocked && scenario.est_principal}
                  onTaskChange={handleTaskChange}
                  onScenarioChange={() => {
                    reloadScenarios();
                    onProjectChange?.();
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Message si aucun scénario */}
      {displayedScenarios.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="mb-4">Aucun scénario de travaux créé</p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Créer un scénario
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <CreateScenarioDialog
        projectId={projectId}
        scenarios={scenarios}
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreated={() => {
          reloadScenarios();
          reloadAll();
        }}
      />

      <TaskTemplatesLibrary
        open={showLibrary}
        onOpenChange={setShowLibrary}
        projectId={projectId}
        onUseTemplate={() => handleTaskChange()}
      />
    </div>
  );
};

export default WorkScenarioManager;
