import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Save, X, Upload, FileText, Trash2 } from "lucide-react";
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
  facture_file?: File;
  facture_url?: string;
}

const ExpenseTableForm = ({ projectId, onSuccess }: ExpenseTableFormProps) => {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [fournisseurs, setFournisseurs] = useState<string[]>([]);
  const [uploading, setUploading] = useState<Set<string>>(new Set());
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    loadFournisseurs();
  }, [projectId]);

  const loadFournisseurs = async () => {
    const { data } = await supabase
      .from("project_expenses")
      .select("fournisseur")
      .is("project_id", null)
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
        date_achat: new Date().toISOString().slice(0, 16),
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

  const updateRow = (id: string, field: keyof ExpenseRow, value: string | File) => {
    setRows(
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleFileSelect = async (rowId: string, file: File | null) => {
    if (!file) return;

    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    // Store file temporarily in row
    updateRow(rowId, "facture_file", file);
  };

  const removeInvoice = (rowId: string) => {
    setRows(rows.map(row => 
      row.id === rowId 
        ? { ...row, facture_file: undefined, facture_url: undefined }
        : row
    ));
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
      if (!row.fournisseur.trim()) {
        toast.error("Le fournisseur est requis pour toutes les dépenses fournisseurs");
        return;
      }
      if (!row.prix_vente_ttc || parseFloat(row.prix_vente_ttc) <= 0) {
        toast.error("Le montant TTC est requis et doit être positif");
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Vous devez être connecté");
      return;
    }

    // Upload invoices first
    const rowsWithUrls = await Promise.all(
      rows.map(async (row) => {
        if (row.facture_file) {
          const fileExt = row.facture_file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError, data } = await supabase.storage
            .from('project-invoices')
            .upload(fileName, row.facture_file);

          if (uploadError) {
            console.error("Upload error:", uploadError);
            return row;
          }

          // Use signed URL with 1 hour expiration for sensitive invoice data
          const { data: signedUrlData, error: urlError } = await supabase.storage
            .from('project-invoices')
            .createSignedUrl(fileName, 3600); // 1 hour

          if (urlError || !signedUrlData) {
            console.error("Error creating signed URL:", urlError);
            return row;
          }

          return { ...row, facture_url: signedUrlData.signedUrl };
        }
        return row;
      })
    );

    const expensesToInsert = rowsWithUrls.map((row) => ({
      project_id: null,
      nom_accessoire: row.nom_accessoire,
      fournisseur: row.fournisseur,
      date_achat: row.date_achat,
      date_paiement: row.date_paiement || null,
      statut_paiement: row.statut_paiement,
      delai_paiement: row.delai_paiement,
      prix: parseFloat(row.prix_vente_ttc),
      prix_vente_ttc: parseFloat(row.prix_vente_ttc),
      quantite: 1,
      categorie: "Fournisseur",
      statut_livraison: "commande",
      facture_url: row.facture_url || null,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveRows();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajouter des dépenses fournisseurs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto" onKeyDown={handleKeyDown}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Nom de la dépense</TableHead>
                <TableHead className="min-w-[150px]">Fournisseur</TableHead>
                <TableHead className="min-w-[180px]">Date et heure de la dépense</TableHead>
                <TableHead className="min-w-[180px]">Date et heure de paiement</TableHead>
                <TableHead className="min-w-[140px]">Statut de paiement</TableHead>
                <TableHead className="min-w-[160px]">Délai de paiement</TableHead>
                <TableHead className="min-w-[120px]">Montant TTC (€)</TableHead>
                <TableHead className="min-w-[120px]">Facture</TableHead>
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
                      type="datetime-local"
                      value={row.date_achat}
                      onChange={(e) =>
                        updateRow(row.id, "date_achat", e.target.value)
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="datetime-local"
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
                    <div className="flex items-center gap-1">
                      {row.facture_file || row.facture_url ? (
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4 text-green-600" />
                          <span className="text-xs text-muted-foreground truncate max-w-[60px]">
                            {row.facture_file?.name || "Facture"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeInvoice(row.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <input
                            ref={(el) => (fileInputRefs.current[row.id] = el)}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => handleFileSelect(row.id, e.target.files?.[0] || null)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => fileInputRefs.current[row.id]?.click()}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Joindre
                          </Button>
                        </>
                      )}
                    </div>
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
