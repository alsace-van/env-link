// ============================================
// EditTaskDialog.tsx
// Dialogue pour modifier une tâche de travail
// ============================================

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Clock, FolderOpen, Euro, Calculator } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useHourlyRate } from "@/hooks/useHourlyRate";

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  estimated_hours?: number | null;
  scheduled_date?: string | null;
  category_id?: string | null;
  forfait_ttc?: number | null;
}

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  categories: Category[];
  onSave: (taskId: string, data: {
    title: string;
    description?: string | null;
    estimated_hours?: number | null;
    scheduled_date?: string | null;
    category_id?: string | null;
    forfait_ttc?: number | null;
  }) => void;
}

export const EditTaskDialog = ({
  open,
  onOpenChange,
  task,
  categories,
  onSave,
}: EditTaskDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [categoryId, setCategoryId] = useState("");
  const [forfaitTtc, setForfaitTtc] = useState("");

  const { hourlyRateTTC, calculateForfait } = useHourlyRate();

  // Pré-remplir les champs quand la tâche change
  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setEstimatedHours(task.estimated_hours?.toString() || "");
      setScheduledDate(task.scheduled_date ? new Date(task.scheduled_date) : undefined);
      setCategoryId(task.category_id || "");
      setForfaitTtc(task.forfait_ttc?.toString() || "");
    }
  }, [task]);

  const handleSave = () => {
    if (!task || !title.trim()) return;

    onSave(task.id, {
      title: title.trim(),
      description: description.trim() || null,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
      scheduled_date: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : null,
      category_id: categoryId || null,
      forfait_ttc: forfaitTtc ? parseFloat(forfaitTtc) : null,
    });

    onOpenChange(false);
  };

  // Calcul du forfait suggéré
  const suggestedForfait = estimatedHours 
    ? calculateForfait(parseFloat(estimatedHours)) 
    : null;

  const applySuggestedForfait = () => {
    if (suggestedForfait) {
      setForfaitTtc(suggestedForfait.toString());
    }
  };

  const selectedCategory = categories.find(c => c.id === categoryId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Modifier la tâche</DialogTitle>
          <DialogDescription>
            Modifiez les informations de cette tâche de travail
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Titre */}
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la tâche"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description détaillée..."
              rows={3}
            />
          </div>

          {/* Catégorie */}
          <div className="space-y-2">
            <Label>
              <FolderOpen className="h-4 w-4 inline mr-1" />
              Catégorie
            </Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie">
                  {selectedCategory && (
                    <span className="flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: selectedCategory.color }}
                      />
                      {selectedCategory.icon} {selectedCategory.name}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <span className="flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      {category.icon} {category.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Temps estimé + Forfait */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimated_hours">
                <Clock className="h-4 w-4 inline mr-1" />
                Temps estimé (heures)
              </Label>
              <Input
                id="estimated_hours"
                type="number"
                step="0.5"
                min="0"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="Ex: 2.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="forfait_ttc">
                <Euro className="h-4 w-4 inline mr-1" />
                Forfait client (€ TTC)
              </Label>
              <Input
                id="forfait_ttc"
                type="number"
                step="1"
                min="0"
                value={forfaitTtc}
                onChange={(e) => setForfaitTtc(e.target.value)}
                placeholder="Ex: 150"
              />
            </div>
          </div>

          {/* Suggestion forfait */}
          {suggestedForfait && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={applySuggestedForfait}
            >
              <Calculator className="h-3 w-3 mr-1" />
              Forfait suggéré: {estimatedHours}h × {hourlyRateTTC}€/h = {suggestedForfait}€ TTC
            </Button>
          )}

          {/* Date planifiée */}
          <div className="space-y-2">
            <Label>
              <CalendarIcon className="h-4 w-4 inline mr-1" />
              Date planifiée
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !scheduledDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? (
                    format(scheduledDate, "PPP", { locale: fr })
                  ) : (
                    <span>Sélectionner une date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={setScheduledDate}
                  locale={fr}
                  initialFocus
                />
                {scheduledDate && (
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setScheduledDate(undefined)}
                    >
                      Effacer la date
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
