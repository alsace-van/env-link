// components/workScenarios/WorkTaskCard.tsx
// Carte d'une tâche de travail avec édition inline

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  MoreVertical, Edit2, Trash2, Clock, Euro, 
  CheckCircle2, Calendar, AlertCircle 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useWorkScenarios, WorkTask } from "@/hooks/useWorkScenarios";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WorkTaskCardProps {
  task: WorkTask;
  isLocked: boolean;
  onUpdate: () => void;
}

const WorkTaskCard = ({ task, isLocked, onUpdate }: WorkTaskCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [actualHours, setActualHours] = useState(task.estimated_hours?.toString() || "");
  
  // États d'édition
  const [editTitle, setEditTitle] = useState(task.title);
  const [editForfaitHT, setEditForfaitHT] = useState(task.forfait_ht?.toString() || "");
  const [editTvaRate, setEditTvaRate] = useState(task.tva_rate?.toString() || "20");
  const [editEstimatedHours, setEditEstimatedHours] = useState(task.estimated_hours?.toString() || "");

  const { deleteTask, updateTask, toggleTaskComplete } = useWorkScenarios(task.project_id || "");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2 
    }).format(amount);
  };

  const handleToggleComplete = async () => {
    if (!task.completed) {
      // Si on complète, demander les heures réelles
      setShowCompleteDialog(true);
    } else {
      // Si on décomplète
      await toggleTaskComplete(task.id);
      onUpdate();
    }
  };

  const handleConfirmComplete = async () => {
    const hours = parseFloat(actualHours) || undefined;
    await toggleTaskComplete(task.id, hours);
    setShowCompleteDialog(false);
    onUpdate();
  };

  const handleSaveEdit = async () => {
    const forfaitHT = parseFloat(editForfaitHT) || null;
    const tvaRate = parseFloat(editTvaRate) || 20;
    const estimatedHours = parseFloat(editEstimatedHours) || null;

    await updateTask(task.id, {
      title: editTitle,
      forfait_ht: forfaitHT,
      tva_rate: tvaRate,
      estimated_hours: estimatedHours,
    });
    
    setIsEditing(false);
    onUpdate();
  };

  const handleDelete = async () => {
    if (confirm("Supprimer cette tâche ?")) {
      await deleteTask(task.id);
      onUpdate();
    }
  };

  // Calcul du TTC pour l'affichage
  const calculatedTTC = task.forfait_ht 
    ? task.forfait_ht * (1 + (task.tva_rate || 20) / 100)
    : null;

  // Taux horaire si complété
  const hourlyRate = task.completed && task.actual_hours && task.forfait_ttc
    ? task.forfait_ttc / task.actual_hours
    : null;

  return (
    <>
      <div 
        className={`p-3 rounded-lg border bg-card transition-all ${
          task.completed 
            ? 'opacity-60 bg-green-50/50 dark:bg-green-950/20' 
            : 'hover:shadow-md'
        }`}
      >
        <div className="flex items-start gap-2">
          {/* Checkbox */}
          {!isLocked && (
            <Checkbox
              checked={task.completed || false}
              onCheckedChange={handleToggleComplete}
              className="mt-1"
            />
          )}

          {/* Contenu */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              // Mode édition
              <div className="space-y-3">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Titre de la tâche"
                  className="text-sm"
                />
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Forfait HT</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editForfaitHT}
                      onChange={(e) => setEditForfaitHT(e.target.value)}
                      placeholder="0.00"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">TVA %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={editTvaRate}
                      onChange={(e) => setEditTvaRate(e.target.value)}
                      placeholder="20"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Heures est.</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={editEstimatedHours}
                      onChange={(e) => setEditEstimatedHours(e.target.value)}
                      placeholder="0"
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit}>
                    Enregistrer
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              // Mode affichage
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-medium ${task.completed ? 'line-through' : ''}`}>
                    {task.title}
                  </p>
                  
                  {!isLocked && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setIsEditing(true)}>
                          <Edit2 className="h-4 w-4 mr-2" /> Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Informations financières et temps */}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {task.forfait_ht !== null && task.forfait_ht !== undefined && (
                    <Badge variant="outline" className="gap-1">
                      <Euro className="h-3 w-3" />
                      {formatCurrency(task.forfait_ht)} HT
                    </Badge>
                  )}
                  
                  {calculatedTTC !== null && (
                    <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700">
                      {formatCurrency(calculatedTTC)} TTC
                    </Badge>
                  )}

                  {task.estimated_hours && (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {task.estimated_hours}h est.
                    </Badge>
                  )}

                  {task.completed && task.actual_hours && (
                    <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {task.actual_hours}h réel
                    </Badge>
                  )}

                  {hourlyRate && (
                    <Badge variant="outline" className="gap-1 text-purple-600 border-purple-200">
                      {formatCurrency(hourlyRate)}/h
                    </Badge>
                  )}
                </div>

                {/* Date planifiée */}
                {task.scheduled_date && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(task.scheduled_date).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dialog de complétion */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Terminer la tâche</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {task.title}
            </p>
            
            <div className="space-y-2">
              <Label>Temps réel passé (heures)</Label>
              <Input
                type="number"
                step="0.5"
                value={actualHours}
                onChange={(e) => setActualHours(e.target.value)}
                placeholder={task.estimated_hours?.toString() || "0"}
              />
              {task.estimated_hours && (
                <p className="text-xs text-muted-foreground">
                  Estimation: {task.estimated_hours}h
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmComplete}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Terminer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WorkTaskCard;
