import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Save, X, Upload, FileText, Trash2, HelpCircle, Clipboard } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [showHelp, setShowHelp] = useState(false);
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
      const uniqueFournisseurs = Array.from(new Set(data.map((d) => d.fournisseur).filter(Boolean)));
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
    setRows(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const handleFileSelect = async (rowId: string, file: File | null) => {
    if (!file) return;

    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    // Store file temporarily in row
    updateRow(rowId, "facture_file", file);
  };

  const removeInvoice = (rowId: string) => {
    setRows(rows.map((row) => (row.id === rowId ? { ...row, facture_file: undefined, facture_url: undefined } : row)));
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Vous devez être connecté");
      return;
    }

    // Upload invoices first
    const rowsWithUrls = await Promise.all(
      rows.map(async (row) => {
        if (row.facture_file) {
          const fileExt = row.facture_file.name.split(".").pop();
          const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError, data } = await supabase.storage
            .from("project-invoices")
            .upload(fileName, row.facture_file);

          if (uploadError) {
            console.error("Upload error:", uploadError);
            return row;
          }

          // Use public URL (permanent, no expiration)
          const { data: publicUrlData } = supabase.storage.from("project-invoices").getPublicUrl(fileName);

          if (!publicUrlData) {
            console.error("Error creating public URL");
            return row;
          }

          return { ...row, facture_url: publicUrlData.publicUrl };
        }
        return row;
      }),
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

    const { error } = await supabase.from("project_expenses").insert(expensesToInsert);

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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveRows();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    
    if (!pastedData.trim()) {
      toast.error("Aucune donnée à coller");
      return;
    }

    // Parse TSV data (Tab-separated values from Excel)
    const lines = pastedData.trim().split("\n");
    const newRows: ExpenseRow[] = [];
    
    lines.forEach((line) => {
      const columns = line.split("\t").map(col => col.trim());
      
      // Expected format: Nom | Fournisseur | Date achat | Date paiement | Statut | Délai | Montant
      if (columns.length >= 2) {
        const [nom, fournisseur, dateAchat, datePaiement, statut, delai, montant] = columns;
        
        // Parse dates - handle various formats
        const parseDateAchat = () => {
          if (!dateAchat) return new Date().toISOString().slice(0, 16);
          try {
            // Try to parse DD/MM/YYYY HH:mm or DD/MM/YYYY
            const dateParts = dateAchat.split(/[/ :]/);
            if (dateParts.length >= 3) {
              const day = dateParts[0].padStart(2, '0');
              const month = dateParts[1].padStart(2, '0');
              const year = dateParts[2];
              const hour = dateParts[3]?.padStart(2, '0') || '12';
              const minute = dateParts[4]?.padStart(2, '0') || '00';
              return `${year}-${month}-${day}T${hour}:${minute}`;
            }
            return new Date().toISOString().slice(0, 16);
          } catch {
            return new Date().toISOString().slice(0, 16);
          }
        };

        const parseDatePaiement = () => {
          if (!datePaiement) return "";
          try {
            const dateParts = datePaiement.split(/[/ :]/);
            if (dateParts.length >= 3) {
              const day = dateParts[0].padStart(2, '0');
              const month = dateParts[1].padStart(2, '0');
              const year = dateParts[2];
              const hour = dateParts[3]?.padStart(2, '0') || '12';
              const minute = dateParts[4]?.padStart(2, '0') || '30';
              return `${year}-${month}-${day}T${hour}:${minute}`;
            }
            return "";
          } catch {
            return "";
          }
        };

        // Parse statut
        const parseStatut = () => {
          if (!statut) return "non_paye";
          const lower = statut.toLowerCase();
          if (lower.includes("payé") || lower.includes("paye")) return "paye";
          return "non_paye";
        };

        // Parse délai
        const parseDelai = () => {
          if (!delai) return "commande";
          const lower = delai.toLowerCase();
          if (lower.includes("30") || lower.includes("jours")) return "30_jours";
          return "commande";
        };

        // Parse montant - remove spaces and replace comma with dot
        const parseMontant = () => {
          if (!montant) return "";
          return montant.replace(/\s/g, "").replace(",", ".");
        };

        newRows.push({
          id: crypto.randomUUID(),
          nom_accessoire: nom || "",
          fournisseur: fournisseur || "",
          date_achat: parseDateAchat(),
          date_paiement: parseDatePaiement(),
          statut_paiement: parseStatut(),
          delai_paiement: parseDelai(),
          prix_vente_ttc: parseMontant(),
        });
      }
    });

    if (newRows.length === 0) {
      toast.error("Aucune ligne valide trouvée dans les données collées");
      return;
    }

    // Add parsed rows to existing rows
    setRows([...rows, ...newRows]);
    toast.success(`${newRows.length} ligne(s) ajoutée(s) depuis Excel`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Ajouter des dépenses fournisseurs</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
            className="gap-2"
          >
            <Clipboard className="h-4 w-4" />
            Coller depuis Excel
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
        
        {showHelp && (
          <Alert className="mt-4">
            <Clipboard className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Comment coller depuis Excel :</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Copiez vos lignes depuis Excel (Ctrl+C / Cmd+C)</li>
                  <li>Cliquez dans le tableau ci-dessous</li>
                  <li>Collez avec Ctrl+V / Cmd+V</li>
                </ol>
                <p className="text-sm font-medium mt-3">Format attendu (colonnes séparées par tabulation) :</p>
                <code className="block bg-muted p-2 rounded text-xs mt-1">
                  Nom | Fournisseur | Date achat | Date paiement | Statut | Délai | Montant
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  • Les dates peuvent être au format DD/MM/YYYY ou DD/MM/YYYY HH:mm<br/>
                  • Le statut peut être "Payé" ou "Non payé"<br/>
                  • Le délai peut être "À la commande" ou "30 jours"<br/>
                  • Seules les 2 premières colonnes (Nom et Fournisseur) sont obligatoires
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto" onKeyDown={handleKeyDown} onPaste={handlePaste} tabIndex={0}>
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
                      onChange={(e) => updateRow(row.id, "nom_accessoire", e.target.value)}
                      placeholder="Nom de l'article"
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.fournisseur}
                      onChange={(e) => updateRow(row.id, "fournisseur", e.target.value)}
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
                      onChange={(e) => updateRow(row.id, "date_achat", e.target.value)}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="datetime-local"
                      value={row.date_paiement}
                      onChange={(e) => updateRow(row.id, "date_paiement", e.target.value)}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.statut_paiement}
                      onValueChange={(value) => updateRow(row.id, "statut_paiement", value)}
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
                      onValueChange={(value) => updateRow(row.id, "delai_paiement", value)}
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
                      onChange={(e) => updateRow(row.id, "prix_vente_ttc", e.target.value)}
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
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeInvoice(row.id)}>
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRow(row.id)}>
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