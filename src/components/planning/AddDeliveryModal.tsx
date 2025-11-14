import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { getErrorMessage } from "@/lib/utils";

interface AddDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDate: Date;
  projectId: string | null;
}

interface Accessory {
  id: string;
  nom: string;
  fournisseur: string | null;
}

export const AddDeliveryModal = ({ isOpen, onClose, onSuccess, selectedDate, projectId }: AddDeliveryModalProps) => {
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [selectedAccessoryId, setSelectedAccessoryId] = useState<string>("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAccessories();
    }
  }, [isOpen]);

  const loadAccessories = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const { data, error } = await supabase
      .from("accessories_catalog")
      .select("id, nom, fournisseur")
      .eq("user_id", user.user.id)
      .order("nom");

    if (error) {
      console.error("Error loading accessories:", error);
      toast.error(`Erreur lors du chargement des accessoires: ${getErrorMessage(error)}`);
    } else {
      setAccessories(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAccessoryId) {
      toast.error("Veuillez sélectionner un accessoire");
      return;
    }

    setIsLoading(true);

    try {
      const deliveryDate = format(selectedDate, "yyyy-MM-dd");

      const updateData: any = {
        delivery_date: deliveryDate,
      };

      if (trackingNumber.trim()) {
        updateData.tracking_number = trackingNumber.trim();
      }

      const { error } = await supabase
        .from("accessories_catalog")
        .update(updateData)
        .eq("id", selectedAccessoryId);

      if (error) throw error;

      toast.success("Livraison programmée avec succès");
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error scheduling delivery:", error);
      toast.error(`Erreur lors de la programmation de la livraison: ${getErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedAccessoryId("");
    setTrackingNumber("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter une livraison</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(selectedDate, "d MMMM yyyy")}
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accessory">
              Accessoire <span className="text-destructive">*</span>
            </Label>
            <Select value={selectedAccessoryId} onValueChange={setSelectedAccessoryId}>
              <SelectTrigger id="accessory">
                <SelectValue placeholder="Sélectionner un accessoire" />
              </SelectTrigger>
              <SelectContent>
                {accessories.map((accessory) => (
                  <SelectItem key={accessory.id} value={accessory.id}>
                    {accessory.nom} {accessory.fournisseur && `(${accessory.fournisseur})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tracking">Numéro de suivi (optionnel)</Label>
            <Input
              id="tracking"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Ex: 1234567890"
            />
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
