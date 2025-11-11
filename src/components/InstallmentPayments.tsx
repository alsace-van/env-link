import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [isExpanded, setIsExpanded] = useState(false);
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
      .from("project_installment_payments" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("date_debut", { ascending: true });

    if (error) {
      console.error("Error loading installments:", error);
      return;
    }

    setInstallments((data || []) as any);
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
        .from("project_installment_payments" as any)
        .update(installmentData as any)
        .eq("id", editingId);

      if (error) {
        toast.error("Erreur lors de la modification");
        console.error(error);
        return;
      }
      toast.success("Paiement échelonné modifié");
    } else {
      const { error } = await supabase
        .from("project_installment_payments" as any)
        .insert([installmentData as any]);

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
      .from("project_installment_payments" as any)
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

  const InstallmentsContent = () => (
    <>
      {installments.length > 0 && (
        <div className="space-y-0.5">
          {installments.map((installment) => (
            <div key={installment.id} className="border rounded p-1.5 hover:bg-muted/50 text-xs space-y-0.5">
              <div className="flex items-start justify-between">
                <div className="font-medium truncate flex-1">{installment.nom_paiement}</div>
                <div className="flex gap-0.5 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(installment)}
                    className="h-5 w-5"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(installment.id)}
                    className="h-5 w-5"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                <div>Total: <span className="font-medium text-foreground">{installment.montant_total.toFixed(0)}€</span></div>
                <div>Mens.: <span className="font-medium text-foreground">{installment.montant_mensualite.toFixed(0)}€</span></div>
                <div>Total: <span className="font-medium text-foreground">{installment.nombre_mensualites_total}</span></div>
                <div>Rest.: <span className="font-medium text-orange-600">{installment.nombre_mensualites_restantes}</span></div>
              </div>
            </div>
          ))}
          <div className="flex justify-between pt-1.5 border-t-2 font-bold text-xs">
            <span>Total restant :</span>
            <span className="text-orange-600">{totalRestant.toFixed(2)} €</span>
          </div>
        </div>
      )}

      {!isAdding ? (
        <Button onClick={() => setIsAdding(true)} className="w-full h-7 text-xs" variant="outline">
          <Plus className="h-3 w-3 mr-1" />
          Ajouter
        </Button>
      ) : (
        <div className="border rounded-lg p-3 space-y-2">
          <h4 className="font-semibold text-xs">
            {editingId ? "Modifier" : "Ajouter un paiement"}
          </h4>

          <div className="space-y-1">
            <Label htmlFor="nom_paiement" className="text-xs">Nom</Label>
            <Input
              id="nom_paiement"
              value={formData.nom_paiement}
              onChange={(e) => setFormData({ ...formData, nom_paiement: e.target.value })}
              placeholder="Crédit, leasing..."
              className="h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="montant_total" className="text-xs">Total (€)</Label>
              <Input
                id="montant_total"
                type="number"
                step="0.01"
                value={formData.montant_total}
                onChange={(e) => setFormData({ ...formData, montant_total: e.target.value })}
                placeholder="0"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="montant_mensualite" className="text-xs">Mensualité</Label>
              <Input
                id="montant_mensualite"
                type="number"
                step="0.01"
                value={formData.montant_mensualite}
                onChange={(e) =>
                  setFormData({ ...formData, montant_mensualite: e.target.value })
                }
                placeholder="0"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="nombre_mensualites_total" className="text-xs">Total</Label>
              <Input
                id="nombre_mensualites_total"
                type="number"
                value={formData.nombre_mensualites_total}
                onChange={(e) =>
                  setFormData({ ...formData, nombre_mensualites_total: e.target.value })
                }
                placeholder="12"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="nombre_mensualites_restantes" className="text-xs">Restantes</Label>
              <Input
                id="nombre_mensualites_restantes"
                type="number"
                value={formData.nombre_mensualites_restantes}
                onChange={(e) =>
                  setFormData({ ...formData, nombre_mensualites_restantes: e.target.value })
                }
                placeholder="8"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="date_debut" className="text-xs">Début</Label>
              <Input
                id="date_debut"
                type="date"
                value={formData.date_debut}
                onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
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

      {installments.length === 0 && !isAdding && (
        <p className="text-center py-2 text-xs text-muted-foreground">
          Aucun paiement échelonné
        </p>
      )}
    </>
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Paiements Échelonnés</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(true)}
              className="h-8 w-8"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <InstallmentsContent />
        </CardContent>
      </Card>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Paiements Échelonnés</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[calc(90vh-100px)] pr-4">
            <div className="space-y-1.5">
              <InstallmentsContent />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
