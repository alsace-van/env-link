import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, ListTodo, Eye, EyeOff } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

export const AllProjectsTasksSidebar = () => {
  const [open, setOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Toggle task completion mutation
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("project_todos")
        .update({
          completed: !completed,
          completed_at: !completed ? new Date().toISOString() : null,
          completed_by: !completed ? user?.id : null,
        })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-work-tasks-sidebar"] });
      toast({ 
        title: "✓ Statut mis à jour",
        duration: 2000,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut",
        variant: "destructive",
      });
    },
  });

  // Fetch all projects
  const { data: projects } = useQuery({
    queryKey: ["all-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, nom_projet, nom_proprietaire")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch all work tasks (only those with work categories)
  const { data: allWorkTasks } = useQuery({
    queryKey: ["all-work-tasks-sidebar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_todos")
        .select(`
          *,
          work_categories!inner (
            name,
            icon,
            color
          )
        `)
        .not("category_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Group work tasks by project
  const tasksByProject = projects?.map((project) => {
    const projectWorkTasks = allWorkTasks?.filter((task) => task.project_id === project.id) || [];
    const filteredTasks = showCompleted 
      ? projectWorkTasks 
      : projectWorkTasks.filter((task) => !task.completed);
    
    return {
      project,
      tasks: filteredTasks,
      completedCount: projectWorkTasks.filter((t) => t.completed).length,
      totalCount: projectWorkTasks.length,
    };
  }).filter((group) => group.tasks.length > 0);

  const totalWorkTasks = allWorkTasks?.length || 0;
  const completedWorkTasks = allWorkTasks?.filter((t) => t.completed).length || 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed left-4 top-20 z-50 shadow-lg bg-background/80 backdrop-blur-sm"
        >
          <ListTodo className="h-4 w-4 mr-2" />
          Tous les travaux
          {totalWorkTasks > 0 && (
            <Badge variant="secondary" className="ml-2">
              {completedWorkTasks}/{totalWorkTasks}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent 
        side="left" 
        className="w-[400px] sm:w-[500px] bg-background/95 backdrop-blur-sm"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>🔨 Tous les travaux</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCompleted(!showCompleted)}
              className="text-xs"
            >
              {showCompleted ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {showCompleted ? "Masquer" : "Afficher"} terminés
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 mb-4">
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{completedWorkTasks} terminés</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-muted-foreground" />
              <span>{totalWorkTasks - completedWorkTasks} en cours</span>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="space-y-6 pr-4">
            {tasksByProject && tasksByProject.length > 0 ? (
              tasksByProject.map((group) => (
                <Card key={group.project.id} className="p-4">
                  <div className="mb-3">
                    <h3 className="font-semibold text-base">
                      {group.project.nom_projet || group.project.nom_proprietaire}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {group.completedCount}/{group.totalCount} travaux terminés
                    </p>
                  </div>

                  <Separator className="mb-3" />

                  <div className="space-y-2">
                    {group.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={() => 
                            toggleTaskMutation.mutate({ 
                              taskId: task.id, 
                              completed: task.completed 
                            })
                          }
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {task.work_categories && (
                              <span className="text-xs" title={task.work_categories.name}>
                                {task.work_categories.icon}
                              </span>
                            )}
                            <p
                              className={`text-sm ${
                                task.completed
                                  ? "line-through text-muted-foreground"
                                  : "text-foreground"
                              }`}
                            >
                              {task.title}
                            </p>
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            {task.estimated_hours && (
                              <span>⏱️ {task.estimated_hours}h</span>
                            )}
                            {task.completed && task.actual_hours && (
                              <span className="text-green-600">
                                ✓ {task.actual_hours}h réelles
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  {showCompleted
                    ? "Aucun travail trouvé"
                    : "Aucun travail en cours"}
                </p>
              </Card>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
