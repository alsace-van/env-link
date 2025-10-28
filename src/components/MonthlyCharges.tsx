import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface MonthlyCharge {
  id: string;
  nom_charge: string;
  montant: number;
  jour_mois: number;
}

interface MonthlyChargesProps {
  projectId: string;
}

export const MonthlyCharges = ({ projectId }: MonthlyChargesProps) => {
  const [charges, setCharges] = useState<MonthlyCharge[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nom_charge: "",
    montant: "",
    jour_mois: "",
  });

  useEffect(() => {
    loadCharges();
  }, [projectId]);

  const loadCharges = async () => {
    const { data, error } = await supabase
      .from("project_monthly_charges")
      .select("*")
      .eq("project_id", projectId)
      .order("jour_mois", { ascending: true });

    if (error) {
      console.error("Error loading charges:", error);
      return;
    }

    setCharges(data || []);
  };

  const handleSave = async () => {
    if (!formData.nom_charge || !formData.montant || !formData.jour_mois) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    const jourMois = parseInt(formData.jour_mois);
    if (jourMois < 1 || jourMois > 31) {
      toast.error("Le jour doit être entre 1 et 31");
      return;
    }

    const chargeData = {
      project_id: projectId,
      nom_charge: formData.nom_charge,
      montant: parseFloat(formData.montant),
      jour_mois: jourMois,
    };

    if (editingId) {
      const { error } = await supabase
        .from("project_monthly_charges")
        .update(chargeData)
        .eq("id", editingId);

      if (error) {
        toast.error("Erreur lors de la modification");
        console.error(error);
        return;
      }
      toast.success("Charge modifiée");
    } else {
      const { error } = await supabase
        .from("project_monthly_charges")
        .insert([chargeData]);

      if (error) {
        toast.error("Erreur lors de l'ajout");
        console.error(error);
        return;
      }
      toast.success("Charge ajoutée");
    }

    resetForm();
    loadCharges();
  };

  const handleEdit = (charge: MonthlyCharge) => {
    setEditingId(charge.id);
    setFormData({
      nom_charge: charge.nom_charge,
      montant: charge.montant.toString(),
      jour_mois: charge.jour_mois.toString(),
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette charge ?")) {
      return;
    }

    const { error } = await supabase
      .from("project_monthly_charges")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
      return;
    }

    toast.success("Charge supprimée");
    loadCharges();
  };

  const resetForm = () => {
    setFormData({
      nom_charge: "",
      montant: "",
      jour_mois: "",
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const totalCharges = charges.reduce((sum, charge) => sum + charge.montant, 0);

  return (
    <Card className="max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Charges Mensuelles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {charges.length > 0 && (
          <div className="space-y-1">
            {charges.map((charge) => (
              <div key={charge.id} className="flex items-center justify-between py-1 px-2 hover:bg-muted/50 rounded text-xs border-b">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{charge.nom_charge}</div>
                  <div className="text-muted-foreground">
                    Le {charge.jour_mois} du mois
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-destructive whitespace-nowrap">
                    {charge.montant.toFixed(0)}€
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(charge)}
                    className="h-6 w-6 flex-shrink-0"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(charge.id)}
                    className="h-6 w-6 flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t-2 font-bold text-xs">
              <span>Total :</span>
              <span className="text-destructive">{totalCharges.toFixed(2)} €</span>
            </div>
          </div>
        )}

        {!isAdding ? (
          <Button onClick={() => setIsAdding(true)} className="w-full h-8 text-xs" variant="outline">
            <Plus className="h-3 w-3 mr-1" />
            Ajouter
          </Button>
        ) : (
          <div className="border rounded-lg p-3 space-y-2">
            <h4 className="font-semibold text-xs">
              {editingId ? "Modifier la charge" : "Ajouter une charge"}
            </h4>

            <div className="space-y-1">
              <Label htmlFor="nom_charge" className="text-xs">Nom</Label>
              <Input
                id="nom_charge"
                value={formData.nom_charge}
                onChange={(e) => setFormData({ ...formData, nom_charge: e.target.value })}
                placeholder="Loyer, assurance..."
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="montant" className="text-xs">Montant (€)</Label>
                <Input
                  id="montant"
                  type="number"
                  step="0.01"
                  value={formData.montant}
                  onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                  placeholder="0.00"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="jour_mois" className="text-xs">Jour du mois</Label>
                <Input
                  id="jour_mois"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.jour_mois}
                  onChange={(e) => setFormData({ ...formData, jour_mois: e.target.value })}
                  placeholder="15"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1 h-7 text-xs">
                {editingId ? "Modifier" : "OK"}
              </Button>
              <Button onClick={resetForm} variant="outline" className="flex-1 h-7 text-xs">
                Annuler
              </Button>
            </div>
          </div>
        )}

        {charges.length === 0 && !isAdding && (
          <p className="text-center py-2 text-xs text-muted-foreground">Aucune charge</p>
        )}
      </CardContent>
    </Card>
  );
};
