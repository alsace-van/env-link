import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { toast } from "sonner";

interface Accessory {
  id: string;
  nom: string;
  marque: string | null;
  prix_vente: number | null;
  has_shipping_fee: boolean;
}

interface ShippingFee {
  id: string;
  nom: string;
  type: string;
}

interface AccessorySelection {
  accessoryId: string;
  visibleBoutique: boolean;
  visibleDepenses: boolean;
}

interface ShippingFeeAssignDialogProps {
  open: boolean;
  onClose: () => void;
  fee: ShippingFee | null;
}

export const ShippingFeeAssignDialog = ({ open, onClose, fee }: ShippingFeeAssignDialogProps) => {
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [filteredAccessories, setFilteredAccessories] = useState<Accessory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selections, setSelections] = useState<Map<string, AccessorySelection>>(new Map());

  useEffect(() => {
    if (open && fee) {
      loadAccessories();
      setSearchTerm("");
      setSelections(new Map());
    }
  }, [open, fee]);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredAccessories(accessories);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredAccessories(
        accessories.filter(
          (acc) =>
            acc.nom.toLowerCase().includes(term) ||
            acc.marque?.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, accessories]);

  const loadAccessories = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: accessoriesData, error: accessoriesError } = await supabase
        .from("accessories_catalog")
        .select("id, nom, marque, prix_vente")
        .eq("user_id", user.id)
        .order("nom");

      if (accessoriesError) throw accessoriesError;

      const { data: existingShipping, error: shippingError } = await supabase
        .from("accessory_shipping_fees")
        .select("accessory_id");

      if (shippingError) throw shippingError;

      const accessoriesWithShipping = (accessoriesData || []).map((acc) => ({
        ...acc,
        has_shipping_fee: existingShipping?.some((s) => s.accessory_id === acc.id) || false,
      }));

      setAccessories(accessoriesWithShipping);
      setFilteredAccessories(accessoriesWithShipping);
    } catch (error: any) {
      console.error("Erreur lors du chargement des accessoires:", error);
      toast.error("Erreur lors du chargement des accessoires");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (accessoryId: string) => {
    const newSelections = new Map(selections);
    if (newSelections.has(accessoryId)) {
      newSelections.delete(accessoryId);
    } else {
      newSelections.set(accessoryId, {
        accessoryId,
        visibleBoutique: true,
        visibleDepenses: true,
      });
    }
    setSelections(newSelections);
  };

  const updateVisibility = (accessoryId: string, field: 'visibleBoutique' | 'visibleDepenses', value: boolean) => {
    const newSelections = new Map(selections);
    const current = newSelections.get(accessoryId);
    if (current) {
      newSelections.set(accessoryId, { ...current, [field]: value });
      setSelections(newSelections);
    }
  };

  const selectAllBoutique = () => {
    const newSelections = new Map(selections);
    filteredAccessories.forEach((acc) => {
      if (!acc.has_shipping_fee) {
        const current = newSelections.get(acc.id) || {
          accessoryId: acc.id,
          visibleBoutique: false,
          visibleDepenses: false,
        };
        newSelections.set(acc.id, { ...current, visibleBoutique: true });
      }
    });
    setSelections(newSelections);
  };

  const selectAllDepenses = () => {
    const newSelections = new Map(selections);
    filteredAccessories.forEach((acc) => {
      if (!acc.has_shipping_fee) {
        const current = newSelections.get(acc.id) || {
          accessoryId: acc.id,
          visibleBoutique: false,
          visibleDepenses: false,
        };
        newSelections.set(acc.id, { ...current, visibleDepenses: true });
      }
    });
    setSelections(newSelections);
  };

  const handleSave = async () => {
    if (selections.size === 0) {
      toast.error("Veuillez sélectionner au moins un accessoire");
      return;
    }

    if (!fee) return;

    setSaving(true);

    try {
      const assignmentsData = Array.from(selections.values()).map((sel) => ({
        accessory_id: sel.accessoryId,
        shipping_fee_id: fee.id,
        visible_boutique: sel.visibleBoutique,
        visible_depenses: sel.visibleDepenses,
      }));

      const { error } = await supabase
        .from("accessory_shipping_fees")
        .insert(assignmentsData);

      if (error) throw error;

      toast.success(`${selections.size} accessoire(s) assigné(s)`);
      onClose();
    } catch (error: any) {
      console.error("Erreur lors de l'assignation:", error);
      toast.error("Erreur lors de l'assignation");
    } finally {
      setSaving(false);
    }
  };

  if (!fee) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Assigner "{fee.nom}" aux accessoires</DialogTitle>
          <DialogDescription>
            Sélectionnez les accessoires et définissez où les frais doivent apparaître
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un accessoire..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAllBoutique}
            >
              Tout cocher - Boutique
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAllDepenses}
            >
              Tout cocher - Dépenses
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement...
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden flex-1 flex flex-col">
              <div className="bg-muted px-4 py-2 font-medium text-sm grid grid-cols-[auto_1fr_100px_100px_100px] gap-4 items-center">
                <div></div>
                <div>Accessoire</div>
                <div className="text-center">🏪 Boutique</div>
                <div className="text-center">👁️ Dépenses</div>
                <div className="text-right">Prix</div>
              </div>
              <div className="overflow-y-auto flex-1">
                {filteredAccessories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "Aucun accessoire trouvé" : "Tous les accessoires ont déjà des frais de port"}
                  </div>
                ) : (
                  filteredAccessories.map((acc) => {
                    const isSelected = selections.has(acc.id);
                    const selection = selections.get(acc.id);
                    const isDisabled = acc.has_shipping_fee;

                    return (
                      <div
                        key={acc.id}
                        className={`px-4 py-3 grid grid-cols-[auto_1fr_100px_100px_100px] gap-4 items-center border-b hover:bg-muted/50 ${
                          isDisabled ? "opacity-50" : ""
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => !isDisabled && toggleSelection(acc.id)}
                          disabled={isDisabled}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{acc.nom}</span>
                          {acc.marque && (
                            <span className="text-xs text-muted-foreground">
                              {acc.marque}
                            </span>
                          )}
                          {isDisabled && (
                            <Badge variant="outline" className="w-fit mt-1 text-xs">
                              Déjà assigné
                            </Badge>
                          )}
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={selection?.visibleBoutique || false}
                            onCheckedChange={(checked) =>
                              updateVisibility(acc.id, 'visibleBoutique', checked as boolean)
                            }
                            disabled={!isSelected || isDisabled}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={selection?.visibleDepenses || false}
                            onCheckedChange={(checked) =>
                              updateVisibility(acc.id, 'visibleDepenses', checked as boolean)
                            }
                            disabled={!isSelected || isDisabled}
                          />
                        </div>
                        <div className="text-right text-sm">
                          {acc.prix_vente ? `${acc.prix_vente.toFixed(2)} €` : "-"}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            {selections.size} accessoire(s) sélectionné(s)
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || selections.size === 0}>
            {saving ? "Assignation..." : `Assigner aux ${selections.size} sélectionnés`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
