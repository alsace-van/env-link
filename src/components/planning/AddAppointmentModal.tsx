import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, setHours, setMinutes } from "date-fns";

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string | null;
  selectedDate: Date;
  selectedHour: number;
}

export const AddAppointmentModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  projectId, 
  selectedDate, 
  selectedHour 
}: AddAppointmentModalProps) => {
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("60");
  const [status, setStatus] = useState("pending");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectId || !clientName.trim()) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Créer la date et l'heure séparément
      const appointmentTime = `${selectedHour.toString().padStart(2, '0')}:00:00`;

      const { error } = await supabase
        .from("client_appointments")
        .insert([
          {
            user_id: user.id,
            project_id: projectId,
            client_name: clientName.trim(),
            description: description.trim() || null,
            appointment_date: format(selectedDate, "yyyy-MM-dd"),
            appointment_time: appointmentTime,
            duration_minutes: parseInt(duration),
            status: status,
          },
        ]);

      if (error) throw error;

      toast.success("Rendez-vous ajouté avec succès");
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error adding appointment:", error);
      toast.error("Erreur lors de l'ajout du rendez-vous");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setClientName("");
    setDescription("");
    setDuration("60");
    setStatus("pending");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Ajouter un rendez-vous client</DialogTitle>
          <p className="text-sm text-gray-500">
            {format(selectedDate, "d MMMM yyyy")} à {selectedHour}h00
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">
              Nom du client <span className="text-red-500">*</span>
            </Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex: Jean Dupont"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objet du rendez-vous, points à discuter..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">
                Durée (minutes) <span className="text-red-500">*</span>
              </Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 heure</SelectItem>
                  <SelectItem value="90">1h30</SelectItem>
                  <SelectItem value="120">2 heures</SelectItem>
                  <SelectItem value="180">3 heures</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
