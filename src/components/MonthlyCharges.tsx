import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface MonthlyCharge {
  id: string;
  nom_charge: string;
  montant: number;
  date_echeance: string;
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
    date_echeance: "",
  });

  useEffect(() => {
    loadCharges();
  }, [projectId]);

  const loadCharges = async () => {
    const { data, error } = await supabase
      .from("project_monthly_charges")
      .select("*")
      .eq("project_id", projectId)
      .order("date_echeance", { ascending: true });

    if (error) {
      console.error("Error loading charges:", error);
      return;
    }

    setCharges(data || []);
  };

  const handleSave = async () => {
    if (!formData.nom_charge || !formData.montant || !formData.date_echeance) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    const chargeData = {
      project_id: projectId,
      nom_charge: formData.nom_charge,
      montant: parseFloat(formData.montant),
      date_echeance: formData.date_echeance,
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
      date_echeance: charge.date_echeance,
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
      date_echeance: "",
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const totalCharges = charges.reduce((sum, charge) => sum + charge.montant, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Charges Mensuelles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {charges.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 px-1">Charge</th>
                  <th className="text-left py-1 px-1">Échéance</th>
                  <th className="text-right py-1 px-1">Montant</th>
                  <th className="text-center py-1 px-1 w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((charge) => (
                  <tr key={charge.id} className="border-b hover:bg-muted/50">
                    <td className="py-1 px-1 font-medium">{charge.nom_charge}</td>
                    <td className="py-1 px-1 text-muted-foreground">
                      {format(new Date(charge.date_echeance), "dd/MM/yyyy")}
                    </td>
                    <td className="py-1 px-1 text-right font-medium">
                      {charge.montant.toFixed(2)} €
                    </td>
                    <td className="py-1 px-1">
                      <div className="flex justify-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(charge)}
                          className="h-5 w-5"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(charge.id)}
                          className="h-5 w-5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold border-t-2">
                  <td colSpan={2} className="py-2 px-1 text-right">
                    Total :
                  </td>
                  <td className="py-2 px-1 text-right text-destructive">
                    {totalCharges.toFixed(2)} €
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
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
                <Label htmlFor="date_echeance" className="text-xs">Échéance</Label>
                <Input
                  id="date_echeance"
                  type="date"
                  value={formData.date_echeance}
                  onChange={(e) => setFormData({ ...formData, date_echeance: e.target.value })}
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
