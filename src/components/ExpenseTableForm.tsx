import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Save, X } from "lucide-react";
import { toast } from "sonner";

interface ExpenseTableFormProps {
  projectId: string;
  onSuccess: () => void;
}

interface ExpenseRow {
  id: string;
  nom_accessoire: string;
  fournisseur: string;
  date_achat: string;
  date_paiement: string;
  statut_paiement: string;
  delai_paiement: string;
  prix_vente_ttc: string;
}

const ExpenseTableForm = ({ projectId, onSuccess }: ExpenseTableFormProps) => {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [fournisseurs, setFournisseurs] = useState<string[]>([]);

  useEffect(() => {
    loadFournisseurs();
  }, [projectId]);

  const loadFournisseurs = async () => {
    const { data } = await supabase
      .from("project_expenses")
      .select("fournisseur")
      .eq("project_id", projectId)
      .not("fournisseur", "is", null);

    if (data) {
      const uniqueFournisseurs = Array.from(new Set(data.map(d => d.fournisseur).filter(Boolean)));
      setFournisseurs(uniqueFournisseurs as string[]);
    }
  };

  const addNewRow = () => {
    setRows([
      ...rows,
      {
        id: crypto.randomUUID(),
        nom_accessoire: "",
        fournisseur: "",
        date_achat: new Date().toISOString().split("T")[0],
        date_paiement: "",
        statut_paiement: "non_paye",
        delai_paiement: "commande",
        prix_vente_ttc: "",
      },
    ]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter((row) => row.id !== id));
  };

  const updateRow = (id: string, field: keyof ExpenseRow, value: string) => {
    setRows(
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const saveRows = async () => {
    if (rows.length === 0) {
      toast.error("Aucune ligne à enregistrer");
      return;
    }

    // Validation
    for (const row of rows) {
      if (!row.nom_accessoire.trim()) {
        toast.error("Le nom de la dépense est requis pour toutes les lignes");
        return;
      }
      if (!row.prix_vente_ttc || parseFloat(row.prix_vente_ttc) <= 0) {
        toast.error("Le montant TTC est requis et doit être positif");
        return;
      }
    }

    const expensesToInsert = rows.map((row) => ({
      project_id: projectId,
      nom_accessoire: row.nom_accessoire,
      fournisseur: row.fournisseur || null,
      date_achat: row.date_achat,
      date_paiement: row.date_paiement || null,
      statut_paiement: row.statut_paiement,
      delai_paiement: row.delai_paiement,
      prix: parseFloat(row.prix_vente_ttc),
      prix_vente_ttc: parseFloat(row.prix_vente_ttc),
      quantite: 1,
      categorie: "",
      statut_livraison: "commande",
    }));

    const { error } = await supabase
      .from("project_expenses")
      .insert(expensesToInsert);

    if (error) {
      toast.error("Erreur lors de l'enregistrement des dépenses");
      console.error(error);
    } else {
      toast.success(`${rows.length} dépense(s) ajoutée(s) avec succès`);
      setRows([]);
      onSuccess();
    }
  };

  useEffect(() => {
    if (rows.length === 0) {
      addNewRow();
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajouter des dépenses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Nom de la dépense</TableHead>
                <TableHead className="min-w-[150px]">Fournisseur</TableHead>
                <TableHead className="min-w-[140px]">Jour de la dépense</TableHead>
                <TableHead className="min-w-[140px]">Date de paiement</TableHead>
                <TableHead className="min-w-[140px]">Statut de paiement</TableHead>
                <TableHead className="min-w-[160px]">Délai de paiement</TableHead>
                <TableHead className="min-w-[120px]">Montant TTC (€)</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Input
                      value={row.nom_accessoire}
                      onChange={(e) =>
                        updateRow(row.id, "nom_accessoire", e.target.value)
                      }
                      placeholder="Nom de l'article"
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.fournisseur}
                      onChange={(e) =>
                        updateRow(row.id, "fournisseur", e.target.value)
                      }
                      placeholder="Fournisseur"
                      className="h-8"
                      list={`fournisseurs-${row.id}`}
                    />
                    <datalist id={`fournisseurs-${row.id}`}>
                      {fournisseurs.map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={row.date_achat}
                      onChange={(e) =>
                        updateRow(row.id, "date_achat", e.target.value)
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={row.date_paiement}
                      onChange={(e) =>
                        updateRow(row.id, "date_paiement", e.target.value)
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.statut_paiement}
                      onValueChange={(value) =>
                        updateRow(row.id, "statut_paiement", value)
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="non_paye">Non payé</SelectItem>
                        <SelectItem value="paye">Payé</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.delai_paiement}
                      onValueChange={(value) =>
                        updateRow(row.id, "delai_paiement", value)
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="commande">À la commande</SelectItem>
                        <SelectItem value="30_jours">Sous 30 jours</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.prix_vente_ttc}
                      onChange={(e) =>
                        updateRow(row.id, "prix_vente_ttc", e.target.value)
                      }
                      placeholder="0.00"
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeRow(row.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={addNewRow} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une ligne
          </Button>
          <Button onClick={saveRows} size="sm" disabled={rows.length === 0}>
            <Save className="h-4 w-4 mr-2" />
            Enregistrer tout ({rows.length})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpenseTableForm;
