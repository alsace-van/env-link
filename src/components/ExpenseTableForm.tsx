import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Save, X, Upload, FileText, Trash2, RotateCcw } from "lucide-react";
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
    // Ajouter une ligne vide au démarrage pour permettre la saisie immédiate
    if (rows.length === 0) {
      addNewRow();
    }
  }, [projectId]);

  const loadFournisseurs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("project_expenses")
      .select("fournisseur")
      .eq("user_id", user.id)
      .not("fournisseur", "is", null) as any;

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
    const filteredRows = rows.filter((row) => row.id !== id);
    // S'assurer qu'il reste toujours au moins une ligne vide
    if (filteredRows.length === 0) {
      addNewRow();
    } else {
      setRows(filteredRows);
    }
  };

  const updateRow = (id: string, field: keyof ExpenseRow, value: string | File) => {
    const updatedRows = rows.map((row) => (row.id === id ? { ...row, [field]: value } : row));
    setRows(updatedRows);

    // Vérifier si la dernière ligne a été modifiée et contient des données
    const lastRow = updatedRows[updatedRows.length - 1];
    if (lastRow && lastRow.id === id) {
      // Si on modifie la dernière ligne et qu'elle a au moins un champ rempli, ajouter une nouvelle ligne vide
      const hasData =
        lastRow.nom_accessoire.trim() !== "" ||
        lastRow.fournisseur.trim() !== "" ||
        lastRow.prix_vente_ttc.trim() !== "";

      if (hasData) {
        // Vérifier qu'il n'y a pas déjà une ligne vide à la fin
        addNewRow();
      }
    }
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

  const resetTable = () => {
    setRows([
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
    toast.success("Tableau réinitialisé");
  };

  const saveRows = async () => {
    // Filtrer les lignes vides
    const rowsToSave = rows.filter((row) => row.nom_accessoire.trim() || row.fournisseur.trim() || row.prix_vente_ttc);

    if (rowsToSave.length === 0) {
      toast.error("Aucune ligne à enregistrer");
      return;
    }

    // Validation
    for (const row of rowsToSave) {
      if (!row.nom_accessoire.trim()) {
        toast.error("Le nom de la dépense est requis pour toutes les lignes");
        return;
      }
      if (!row.fournisseur.trim()) {
        toast.error("Le fournisseur est requis pour toutes les factures fournisseurs");
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
      rowsToSave.map(async (row) => {
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
      project_id: projectId,
      user_id: user.id,
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
      toast.success(`${rowsToSave.length} dépense(s) ajoutée(s) avec succès`);
      // Réinitialiser avec une ligne vide
      setRows([
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
      onSuccess();
    }
  };

  // Removed automatic row creation on mount to show empty table with headers

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
      const columns = line.split("\t").map((col) => col.trim());

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
              const day = dateParts[0].padStart(2, "0");
              const month = dateParts[1].padStart(2, "0");
              const year = dateParts[2];
              const hour = dateParts[3]?.padStart(2, "0") || "12";
              const minute = dateParts[4]?.padStart(2, "0") || "00";
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
              const day = dateParts[0].padStart(2, "0");
              const month = dateParts[1].padStart(2, "0");
              const year = dateParts[2];
              const hour = dateParts[3]?.padStart(2, "0") || "12";
              const minute = dateParts[4]?.padStart(2, "0") || "30";
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

    // Add pasted rows to existing rows
    setRows([...rows, ...newRows]);

    toast.success(`${newRows.length} ligne(s) ajoutée(s) depuis Excel`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajouter des factures fournisseurs</CardTitle>
        <div className="bg-muted p-3 rounded-lg mt-3 space-y-2">
          <p className="text-sm font-medium">📋 Comment ça marche ?</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Créez votre tableau Excel avec les mêmes colonnes que ci-dessous</li>
            <li>Remplissez vos données dans Excel</li>
            <li>Sélectionnez tout (en-têtes + données) et copiez (Ctrl+C ou Cmd+C)</li>
            <li>Cliquez dans le tableau ci-dessous et collez (Ctrl+V ou Cmd+V)</li>
            <li>Cliquez sur "Enregistrer tout"</li>
          </ol>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="border-2 border-gray-400 rounded-lg overflow-x-auto bg-background"
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          tabIndex={0}
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/80 border-b-2 border-gray-400">
                <TableHead className="min-w-[180px] font-semibold border-r-2 border-gray-400">Nom</TableHead>
                <TableHead className="min-w-[140px] font-semibold border-r-2 border-gray-400">Fournisseur</TableHead>
                <TableHead className="min-w-[150px] font-semibold border-r-2 border-gray-400">Date dépense</TableHead>
                <TableHead className="min-w-[150px] font-semibold border-r-2 border-gray-400">Date paiement</TableHead>
                <TableHead className="min-w-[120px] font-semibold border-r-2 border-gray-400">Statut</TableHead>
                <TableHead className="min-w-[130px] font-semibold border-r-2 border-gray-400">Délai</TableHead>
                <TableHead className="min-w-[100px] font-semibold border-r-2 border-gray-400">Montant TTC</TableHead>
                <TableHead className="min-w-[100px] font-semibold border-r-2 border-gray-400">Facture</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Commencez à saisir dans les champs ci-dessus ou collez vos données (Ctrl+V ou Cmd+V)
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="border-b border-gray-300">
                    <TableCell className="border-r-2 border-gray-300">
                      <Input
                        value={row.nom_accessoire}
                        onChange={(e) => updateRow(row.id, "nom_accessoire", e.target.value)}
                        placeholder="Article..."
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell className="border-r-2 border-gray-300">
                      <Input
                        value={row.fournisseur}
                        onChange={(e) => updateRow(row.id, "fournisseur", e.target.value)}
                        placeholder="Fournisseur..."
                        className="h-9"
                        list={`fournisseurs-${row.id}`}
                      />
                      <datalist id={`fournisseurs-${row.id}`}>
                        {fournisseurs.map((f) => (
                          <option key={f} value={f} />
                        ))}
                      </datalist>
                    </TableCell>
                    <TableCell className="border-r-2 border-gray-300">
                      <Input
                        type="datetime-local"
                        value={row.date_achat}
                        onChange={(e) => updateRow(row.id, "date_achat", e.target.value)}
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell className="border-r-2 border-gray-300">
                      <Input
                        type="datetime-local"
                        value={row.date_paiement}
                        onChange={(e) => updateRow(row.id, "date_paiement", e.target.value)}
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell className="border-r-2 border-gray-300">
                      <Select
                        value={row.statut_paiement}
                        onValueChange={(value) => updateRow(row.id, "statut_paiement", value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="non_paye">Non payé</SelectItem>
                          <SelectItem value="paye">Payé</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="border-r-2 border-gray-300">
                      <Select
                        value={row.delai_paiement}
                        onValueChange={(value) => updateRow(row.id, "delai_paiement", value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="commande">À la commande</SelectItem>
                          <SelectItem value="30_jours">30 jours</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="border-r-2 border-gray-300">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.prix_vente_ttc}
                        onChange={(e) => updateRow(row.id, "prix_vente_ttc", e.target.value)}
                        placeholder="0.00"
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell className="border-r-2 border-gray-300">
                      <div className="flex items-center gap-1">
                        {row.facture_file || row.facture_url ? (
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4 text-green-600" />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeInvoice(row.id)}
                            >
                              <X className="h-3 w-3" />
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
                              className="h-9 px-2"
                              onClick={() => fileInputRefs.current[row.id]?.click()}
                            >
                              <Upload className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeRow(row.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            onClick={resetTable}
            variant="outline"
            size="sm"
            disabled={rows.length === 1 && !rows[0].nom_accessoire && !rows[0].fournisseur && !rows[0].prix_vente_ttc}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Réinitialiser
          </Button>
          <Button
            onClick={saveRows}
            size="sm"
            disabled={rows.every((row) => !row.nom_accessoire && !row.fournisseur && !row.prix_vente_ttc)}
          >
            <Save className="h-4 w-4 mr-2" />
            Enregistrer tout ({rows.filter((row) => row.nom_accessoire || row.fournisseur || row.prix_vente_ttc).length}
            )
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpenseTableForm;
