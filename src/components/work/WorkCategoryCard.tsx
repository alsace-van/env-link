import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { WorkTaskItem } from "./WorkTaskItem";

interface WorkCategoryCardProps {
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  tasks: Array<any>;
  showCompleted: boolean;
  onToggleComplete: (taskId: string, actualHours: number | null) => void;
  onEditTime: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onAddTask: () => void;
}

export const WorkCategoryCard = ({
  category,
  tasks,
  showCompleted,
  onToggleComplete,
  onEditTime,
  onDelete,
  onDeleteCategory,
  onAddTask,
}: WorkCategoryCardProps) => {
  const [collapsed, setCollapsed] = useState(false);

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
  const totalActual = tasks
    .filter((t) => t.completed && t.actual_hours)
    .reduce((sum, t) => sum + (t.actual_hours || 0), 0);

  const hasTimeData = tasks.some((t) => t.completed && t.actual_hours);
  
  // Filter tasks based on showCompleted
  const visibleTasks = showCompleted ? tasks : tasks.filter((t) => !t.completed);

  return (
    <Card className="border-l-4" style={{ borderLeftColor: category.color }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCollapsed(!collapsed)}
                className="h-auto p-1"
              >
                {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {category.icon} {category.name}
                <span className="text-sm text-muted-foreground">
                  ({completedCount}/{totalCount} - {Math.round(progress)}%)
                </span>
              </h3>
            </div>

            {!collapsed && (
              <div className="mt-2 space-y-2">
                <Progress value={progress} className="h-2" />
                {hasTimeData && (
                  <p className="text-xs text-muted-foreground">
                    ⏱️ {totalEstimated}h estimées / {totalActual.toFixed(1)}h réelles
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={onAddTask} variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => onDeleteCategory(category.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-2">
          {visibleTasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              {showCompleted 
                ? "Aucune tâche dans cette catégorie" 
                : "Aucune tâche en cours dans cette catégorie"}
            </p>
          ) : (
            visibleTasks.map((task) => (
            <WorkTaskItem
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
              onEditTime={onEditTime}
              onDelete={onDelete}
            />
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
};