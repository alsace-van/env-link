import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface InstallmentPayment {
  id: string;
  nom_paiement: string;
  montant_total: number;
  montant_mensualite: number;
  nombre_mensualites_total: number;
  nombre_mensualites_restantes: number;
  date_debut: string;
}

interface InstallmentPaymentsProps {
  projectId: string;
}

export const InstallmentPayments = ({ projectId }: InstallmentPaymentsProps) => {
  const [installments, setInstallments] = useState<InstallmentPayment[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nom_paiement: "",
    montant_total: "",
    montant_mensualite: "",
    nombre_mensualites_total: "",
    nombre_mensualites_restantes: "",
    date_debut: "",
  });

  useEffect(() => {
    loadInstallments();
  }, [projectId]);

  const loadInstallments = async () => {
    const { data, error } = await supabase
      .from("project_installment_payments")
      .select("*")
      .eq("project_id", projectId)
      .order("date_debut", { ascending: true });

    if (error) {
      console.error("Error loading installments:", error);
      return;
    }

    setInstallments(data || []);
  };

  const handleSave = async () => {
    if (
      !formData.nom_paiement ||
      !formData.montant_total ||
      !formData.montant_mensualite ||
      !formData.nombre_mensualites_total ||
      !formData.nombre_mensualites_restantes ||
      !formData.date_debut
    ) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    const installmentData = {
      project_id: projectId,
      nom_paiement: formData.nom_paiement,
      montant_total: parseFloat(formData.montant_total),
      montant_mensualite: parseFloat(formData.montant_mensualite),
      nombre_mensualites_total: parseInt(formData.nombre_mensualites_total),
      nombre_mensualites_restantes: parseInt(formData.nombre_mensualites_restantes),
      date_debut: formData.date_debut,
    };

    if (editingId) {
      const { error } = await supabase
        .from("project_installment_payments")
        .update(installmentData)
        .eq("id", editingId);

      if (error) {
        toast.error("Erreur lors de la modification");
        console.error(error);
        return;
      }
      toast.success("Paiement échelonné modifié");
    } else {
      const { error } = await supabase
        .from("project_installment_payments")
        .insert([installmentData]);

      if (error) {
        toast.error("Erreur lors de l'ajout");
        console.error(error);
        return;
      }
      toast.success("Paiement échelonné ajouté");
    }

    resetForm();
    loadInstallments();
  };

  const handleEdit = (installment: InstallmentPayment) => {
    setEditingId(installment.id);
    setFormData({
      nom_paiement: installment.nom_paiement,
      montant_total: installment.montant_total.toString(),
      montant_mensualite: installment.montant_mensualite.toString(),
      nombre_mensualites_total: installment.nombre_mensualites_total.toString(),
      nombre_mensualites_restantes: installment.nombre_mensualites_restantes.toString(),
      date_debut: installment.date_debut,
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce paiement échelonné ?")) {
      return;
    }

    const { error } = await supabase
      .from("project_installment_payments")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
      return;
    }

    toast.success("Paiement échelonné supprimé");
    loadInstallments();
  };

  const resetForm = () => {
    setFormData({
      nom_paiement: "",
      montant_total: "",
      montant_mensualite: "",
      nombre_mensualites_total: "",
      nombre_mensualites_restantes: "",
      date_debut: "",
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const totalRestant = installments.reduce(
    (sum, inst) => sum + inst.montant_mensualite * inst.nombre_mensualites_restantes,
    0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paiements Échelonnés</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {installments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Paiement</th>
                  <th className="text-left py-2 px-2">Début</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-right py-2 px-2">Mensualité</th>
                  <th className="text-center py-2 px-2">Total</th>
                  <th className="text-center py-2 px-2">Restantes</th>
                  <th className="text-center py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((installment) => (
                  <tr key={installment.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-medium">{installment.nom_paiement}</td>
                    <td className="py-2 px-2">
                      {format(new Date(installment.date_debut), "dd/MM/yyyy")}
                    </td>
                    <td className="py-2 px-2 text-right font-medium">
                      {installment.montant_total.toFixed(2)} €
                    </td>
                    <td className="py-2 px-2 text-right">
                      {installment.montant_mensualite.toFixed(2)} €
                    </td>
                    <td className="py-2 px-2 text-center">
                      {installment.nombre_mensualites_total}
                    </td>
                    <td className="py-2 px-2 text-center font-medium text-orange-600">
                      {installment.nombre_mensualites_restantes}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(installment)}
                          className="h-6 w-6"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(installment.id)}
                          className="h-6 w-6"
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
                  <td colSpan={2} className="py-3 px-2 text-right">
                    Total restant à payer :
                  </td>
                  <td className="py-3 px-2 text-right text-orange-600" colSpan={4}>
                    {totalRestant.toFixed(2)} €
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!isAdding ? (
          <Button onClick={() => setIsAdding(true)} className="w-full" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un paiement échelonné
          </Button>
        ) : (
          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-sm">
              {editingId ? "Modifier le paiement échelonné" : "Ajouter un paiement échelonné"}
            </h4>

            <div className="space-y-2">
              <Label htmlFor="nom_paiement">Nom du paiement</Label>
              <Input
                id="nom_paiement"
                value={formData.nom_paiement}
                onChange={(e) => setFormData({ ...formData, nom_paiement: e.target.value })}
                placeholder="Crédit, leasing..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="montant_total">Montant total (€)</Label>
                <Input
                  id="montant_total"
                  type="number"
                  step="0.01"
                  value={formData.montant_total}
                  onChange={(e) => setFormData({ ...formData, montant_total: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="montant_mensualite">Mensualité (€)</Label>
                <Input
                  id="montant_mensualite"
                  type="number"
                  step="0.01"
                  value={formData.montant_mensualite}
                  onChange={(e) =>
                    setFormData({ ...formData, montant_mensualite: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="nombre_mensualites_total">Nombre total</Label>
                <Input
                  id="nombre_mensualites_total"
                  type="number"
                  value={formData.nombre_mensualites_total}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre_mensualites_total: e.target.value })
                  }
                  placeholder="12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre_mensualites_restantes">Restantes</Label>
                <Input
                  id="nombre_mensualites_restantes"
                  type="number"
                  value={formData.nombre_mensualites_restantes}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre_mensualites_restantes: e.target.value })
                  }
                  placeholder="8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_debut">Date de début</Label>
              <Input
                id="date_debut"
                type="date"
                value={formData.date_debut}
                onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1">
                {editingId ? "Modifier" : "Enregistrer"}
              </Button>
              <Button onClick={resetForm} variant="outline" className="flex-1">
                Annuler
              </Button>
            </div>
          </div>
        )}

        {installments.length === 0 && !isAdding && (
          <p className="text-center py-4 text-muted-foreground">
            Aucun paiement échelonné enregistré
          </p>
        )}
      </CardContent>
    </Card>
  );
};
