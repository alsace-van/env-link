import { useState } from "react";
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
import { Plus } from "lucide-react";

interface AddZoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (zoneName: string) => void;
}

export const AddZoneDialog = ({ open, onOpenChange, onAdd }: AddZoneDialogProps) => {
  const [zoneName, setZoneName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (zoneName.trim()) {
      onAdd(zoneName.trim());
      setZoneName("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ajouter une zone personnalisée</DialogTitle>
            <DialogDescription>
              Créez une zone pour documenter une partie spécifique du véhicule
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="zoneName">Nom de la zone</Label>
            <Input
              id="zoneName"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="Ex: Toit, Roue avant droite, Coffre..."
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!zoneName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
