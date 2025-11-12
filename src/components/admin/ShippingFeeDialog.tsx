import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ShippingFeeTier {
  id?: string;
  quantity_from: number;
  quantity_to: number | null;
  total_price: number;
}

interface ShippingFee {
  id: string;
  nom: string;
  type: 'fixed' | 'variable' | 'free' | 'pickup';
  fixed_price: number | null;
  description: string | null;
  message_pickup: string | null;
  tiers?: ShippingFeeTier[];
}

interface ShippingFeeDialogProps {
  open: boolean;
  onClose: () => void;
  fee: ShippingFee | null;
}

export const ShippingFeeDialog = ({ open, onClose, fee }: ShippingFeeDialogProps) => {
  const [nom, setNom] = useState("");
  const [type, setType] = useState<'fixed' | 'variable' | 'free' | 'pickup'>('fixed');
  const [fixedPrice, setFixedPrice] = useState("");
  const [description, setDescription] = useState("");
  const [messagePickup, setMessagePickup] = useState("");
  const [tiers, setTiers] = useState<ShippingFeeTier[]>([
    { quantity_from: 1, quantity_to: 1, total_price: 0 }
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (fee) {
        setNom(fee.nom);
        setType(fee.type);
        setFixedPrice(fee.fixed_price?.toString() || "");
        setDescription(fee.description || "");
        setMessagePickup(fee.message_pickup || "");
        setTiers(fee.tiers && fee.tiers.length > 0 ? fee.tiers : [
          { quantity_from: 1, quantity_to: 1, total_price: 0 }
        ]);
      } else {
        resetForm();
      }
    }
  }, [open, fee]);

  const resetForm = () => {
    setNom("");
    setType('fixed');
    setFixedPrice("");
    setDescription("");
    setMessagePickup("");
    setTiers([{ quantity_from: 1, quantity_to: 1, total_price: 0 }]);
  };

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const newQuantityFrom = (lastTier.quantity_to || lastTier.quantity_from) + 1;
    setTiers([...tiers, {
      quantity_from: newQuantityFrom,
      quantity_to: newQuantityFrom,
      total_price: 0
    }]);
  };

  const removeTier = (index: number) => {
    if (tiers.length > 1) {
      setTiers(tiers.filter((_, i) => i !== index));
    }
  };

  const updateTier = (index: number, field: keyof ShippingFeeTier, value: any) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTiers(newTiers);
  };

  const handleSave = async () => {
    if (!nom.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }

    if (type === 'fixed' && (!fixedPrice || parseFloat(fixedPrice) < 0)) {
      toast.error("Le prix fixe doit être un montant valide");
      return;
    }

    if (type === 'variable') {
      const invalidTier = tiers.find(t => t.total_price < 0);
      if (invalidTier) {
        toast.error("Tous les prix des paliers doivent être positifs");
        return;
      }
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const feeData = {
        nom: nom.trim(),
        montant: type === 'fixed' ? parseFloat(fixedPrice) : 0,
        description: description.trim() || null,
      };

      let feeId: string;

      if (fee) {
        const { error } = await supabase
          .from("shipping_fees")
          .update(feeData)
          .eq("id", fee.id);

        if (error) throw error;
        feeId = fee.id;

        if (type === 'variable') {
          await supabase
            .from("shipping_fee_tiers")
            .delete()
            .eq("shipping_fee_id", feeId);
        }
      } else {
        const { data: newFee, error } = await supabase
          .from("shipping_fees")
          .insert(feeData)
          .select()
          .single();

        if (error) throw error;
        feeId = newFee.id;
      }

      if (type === 'variable') {
        const tiersData = tiers.map(tier => ({
          shipping_fee_id: feeId,
          quantity_from: tier.quantity_from,
          quantity_to: tier.quantity_to,
          total_price: tier.total_price,
        }));

        const { error: tiersError } = await supabase
          .from("shipping_fee_tiers")
          .insert(tiersData);

        if (tiersError) throw tiersError;
      }

      toast.success(fee ? "Frais de port modifié" : "Frais de port créé");
      onClose();
    } catch (error: any) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{fee ? "Modifier" : "Nouveau"} frais de port</DialogTitle>
          <DialogDescription>
            Configurez les paramètres du frais de port
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom du frais *</Label>
            <Input
              id="nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex: Frais de port toit relevable"
            />
          </div>

          <div className="space-y-2">
            <Label>Type de tarification *</Label>
            <RadioGroup value={type} onValueChange={(v) => setType(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fixed" id="fixed" />
                <Label htmlFor="fixed" className="cursor-pointer font-normal">
                  Fixe - Prix unique quel que soit la quantité
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="variable" id="variable" />
                <Label htmlFor="variable" className="cursor-pointer font-normal">
                  Variable - Prix selon la quantité
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="free" id="free" />
                <Label htmlFor="free" className="cursor-pointer font-normal">
                  Gratuit - Aucun frais
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pickup" id="pickup" />
                <Label htmlFor="pickup" className="cursor-pointer font-normal">
                  Retrait atelier - Sans frais de livraison
                </Label>
              </div>
            </RadioGroup>
          </div>

          {type === 'fixed' && (
            <div className="space-y-2">
              <Label htmlFor="fixedPrice">Montant (€) *</Label>
              <Input
                id="fixedPrice"
                type="number"
                step="0.01"
                min="0"
                value={fixedPrice}
                onChange={(e) => setFixedPrice(e.target.value)}
                placeholder="Ex: 50.00"
              />
            </div>
          )}

          {type === 'variable' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tarifs selon quantité</Label>
                <Button type="button" variant="outline" size="sm" onClick={addTier}>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter un palier
                </Button>
              </div>
              <div className="border rounded-lg p-4 space-y-3">
                {tiers.map((tier, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Quantité de</Label>
                      <Input
                        type="number"
                        min="1"
                        value={tier.quantity_from}
                        onChange={(e) => updateTier(index, 'quantity_from', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">à</Label>
                      <Input
                        type="number"
                        min={tier.quantity_from}
                        value={tier.quantity_to || ""}
                        onChange={(e) => updateTier(index, 'quantity_to', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="∞"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Prix total (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={tier.total_price}
                        onChange={(e) => updateTier(index, 'total_price', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    {tiers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTier(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Laissez "à" vide pour "et plus" (ex: 3 et plus)
              </p>
            </div>
          )}

          {type === 'pickup' && (
            <div className="space-y-2">
              <Label htmlFor="messagePickup">Message de retrait (optionnel)</Label>
              <Textarea
                id="messagePickup"
                value={messagePickup}
                onChange={(e) => setMessagePickup(e.target.value)}
                placeholder="Ex: À retirer à notre atelier de Cherbourg"
                rows={2}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du frais de port"
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
