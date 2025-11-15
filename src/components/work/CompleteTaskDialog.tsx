import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock } from "lucide-react";

interface CompleteTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  estimatedHours?: number;
  onComplete: (actualHours: number | null) => void;
}

export const CompleteTaskDialog = ({
  open,
  onOpenChange,
  taskTitle,
  estimatedHours,
  onComplete,
}: CompleteTaskDialogProps) => {
  const [hours, setHours] = useState<string>(estimatedHours?.toString() || "");
  const [dontKnow, setDontKnow] = useState(false);

  const handleSubmit = () => {
    if (dontKnow) {
      onComplete(null);
    } else {
      const actualHours = parseFloat(hours);
      if (!isNaN(actualHours) && actualHours > 0) {
        onComplete(actualHours);
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Temps passé
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Combien de temps avez-vous passé sur la tâche "{taskTitle}" ?
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="hours">Temps (heures)</Label>
            <Input
              id="hours"
              type="number"
              step="0.5"
              min="0"
              placeholder="Ex: 3.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              disabled={dontKnow}
            />
            {estimatedHours && (
              <p className="text-xs text-muted-foreground">
                Temps estimé: {estimatedHours}h
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="dont-know"
              checked={dontKnow}
              onCheckedChange={(checked) => setDontKnow(checked as boolean)}
            />
            <label
              htmlFor="dont-know"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              🚫 Je ne sais pas
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit}>
            ✓ Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};