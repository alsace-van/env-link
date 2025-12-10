import { useState, useEffect, useRef, Component, ErrorInfo, ReactNode, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Save,
  X,
  Upload,
  FileText,
  Trash2,
  RotateCcw,
  ScanLine,
  FileUp,
  Receipt,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { SupplierInvoiceScannerDialog } from "@/components/evoliz/SupplierInvoiceScannerDialog";
import { BankStatementImportDialog } from "@/components/evoliz/BankStatementImportDialog";

// ============================================
// ERROR BOUNDARY POUR ISOLER LES ERREURS
// ============================================
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ComponentErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary] Erreur dans ${this.props.componentName || "composant"}:`, error);
    console.error("[ErrorBoundary] Stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <Button variant="outline" className="gap-2 border-red-300 text-red-600" disabled>
            <AlertTriangle className="h-4 w-4" />
            Erreur {this.props.componentName}
          </Button>
        )
      );
    }
    return this.props.children;
  }
}

// ============================================
// IMPORT DYNAMIQUE DE IncomingInvoicesList
// ============================================

// Import lazy pour isoler les erreurs de chargement
const IncomingInvoicesList = lazy(() =>
  import("@/components/IncomingInvoicesList")
    .then((module) => {
      console.log("[DEBUG] IncomingInvoicesList chargé avec succès");
      return { default: module.IncomingInvoicesList };
    })
    .catch((err) => {
      console.error("[DEBUG] Erreur chargement IncomingInvoicesList:", err);
      // Retourner un composant fallback
      return {
        default: ({ trigger }: any) => (
          <Button
            variant="outline"
            className="gap-2 border-orange-300 text-orange-600"
            onClick={() => {
              console.error("[DEBUG] Clic sur bouton fallback - module non chargé");
              toast.error("Module IncomingInvoicesList non disponible - voir console F12");
            }}
          >
            <AlertTriangle className="h-4 w-4" />
            Module erreur
          </Button>
        ),
      };
    }),
);

// Bouton de fallback pendant le chargement
const LoadingButton = () => (
  <Button variant="outline" className="gap-2" disabled>
    <Receipt className="h-4 w-4 animate-pulse" />
    Chargement...
  </Button>
);

interface ExpenseTableFormProps {
  projectId: string;
  onSuccess: () => void;
}

interface BankLineRow {
  id: string;
  type: "entree" | "sortie";
  nom_accessoire: string;
  fournisseur: string;
  project_id?: string;
  type_paiement?: string;
  date_achat: string;
  date_paiement: string;
  statut_paiement: string;
  delai_paiement: string;
  prix_vente_ttc: string;
  facture_file?: File;
  facture_url?: string;
}

const ExpenseTableForm = ({ projectId, onSuccess }: ExpenseTableFormProps) => {
  const [rows, setRows] = useState<BankLineRow[]>([]);
  const [fournisseurs, setFournisseurs] = useState<string[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; nom: string }>>([]);
  const [uploading, setUploading] = useState<Set<string>>(new Set());
  const [showScannerDialog, setShowScannerDialog] = useState(false);
  const [showBankImportDialog, setShowBankImportDialog] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // DEBUG: Log au montage
  useEffect(() => {
    console.log("[DEBUG] ExpenseTableForm monté");
    return () => console.log("[DEBUG] ExpenseTableForm démonté");
  }, []);

  useEffect(() => {
    loadFournisseurs();
    loadProjects();
    if (rows.length === 0) {
      addNewRow();
    }
  }, [projectId]);

  const loadProjects = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from("projects").select("id, nom").eq("user_id", user.id).order("nom");

    if (data) {
      setProjects(data);
    }
  };

  const loadFournisseurs = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = (await supabase
      .from("project_expenses")
      .select("fournisseur")
      .is("project_id", null)
      .eq("user_id", user.id)
      .not("fournisseur", "is", null)) as any;

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
        type: "sortie",
        nom_accessoire: "",
        fournisseur: "",
        project_id: "",
        type_paiement: "acompte",
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
    if (filteredRows.length === 0) {
      addNewRow();
    } else {
      setRows(filteredRows);
    }
  };

  const updateRow = (id: string, field: keyof BankLineRow, value: string | File) => {
    const updatedRows = rows.map((row) => (row.id === id ? { ...row, [field]: value } : row));
    setRows(updatedRows);

    const lastRow = updatedRows[updatedRows.length - 1];
    if (lastRow && lastRow.id === id) {
      const hasEssentialData =
        lastRow.nom_accessoire.trim() !== "" &&
        lastRow.fournisseur.trim() !== "" &&
        lastRow.prix_vente_ttc.trim() !== "";

      if (hasEssentialData) {
        addNewRow();
      }
    }
  };

  const handleFileSelect = async (rowId: string, file: File | null) => {
    if (!file) return;
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    updateRow(rowId, "facture_file", file);
  };

  const removeInvoice = (rowId: string) => {
    setRows(rows.map((row) => (row.id === rowId ? { ...row, facture_file: undefined, facture_url: undefined } : row)));
  };

  const resetTable = () => {
    setRows([
      {
        id: crypto.randomUUID(),
        type: "sortie",
        nom_accessoire: "",
        fournisseur: "",
        project_id: "",
        type_paiement: "acompte",
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
    const rowsToSave = rows.filter(
      (row) => row.nom_accessoire.trim() || row.fournisseur.trim() || row.project_id || row.prix_vente_ttc,
    );

    if (rowsToSave.length === 0) {
      toast.error("Aucune ligne à enregistrer");
      return;
    }

    for (const row of rowsToSave) {
      if (!row.nom_accessoire.trim()) {
        toast.error("Le nom/description est requis pour toutes les lignes");
        return;
      }
      if (row.type === "sortie" && !row.fournisseur.trim()) {
        toast.error("Le fournisseur est requis pour les sorties d'argent");
        return;
      }
      if (row.type === "entree" && !row.project_id) {
        toast.error("Le projet est requis pour les entrées d'argent");
        return;
      }
      if (!row.prix_vente_ttc || parseFloat(row.prix_vente_ttc) <= 0) {
        toast.error("Le montant est requis et doit être positif");
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

    const rowsWithUrls = await Promise.all(
      rowsToSave.map(async (row) => {
        if (row.facture_file) {
          setUploading((prev) => new Set(prev).add(row.id));
          try {
            const fileExt = row.facture_file.name.split(".").pop();
            const fileName = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage.from("factures").upload(fileName, row.facture_file);

            if (uploadError) throw uploadError;

            const {
              data: { publicUrl },
            } = supabase.storage.from("factures").getPublicUrl(fileName);

            return { ...row, facture_url: publicUrl };
          } catch (err) {
            console.error("Erreur upload:", err);
            toast.error(`Erreur lors de l'upload de la facture pour "${row.nom_accessoire}"`);
            return row;
          } finally {
            setUploading((prev) => {
              const newSet = new Set(prev);
              newSet.delete(row.id);
              return newSet;
            });
          }
        }
        return row;
      }),
    );

    const entrees = rowsWithUrls.filter((row) => row.type === "entree");
    const sorties = rowsWithUrls.filter((row) => row.type === "sortie");

    let savedCount = 0;

    for (const row of entrees) {
      const { error } = await supabase.from("projects_paiements").insert({
        project_id: row.project_id,
        user_id: user.id,
        date_paiement: row.date_achat ? new Date(row.date_achat).toISOString() : new Date().toISOString(),
        montant: parseFloat(row.prix_vente_ttc),
        type_paiement: row.type_paiement || "acompte",
        notes: row.nom_accessoire,
      });

      if (error) {
        console.error("Erreur sauvegarde entrée:", error);
        toast.error(`Erreur lors de l'enregistrement de "${row.nom_accessoire}"`);
      } else {
        savedCount++;
      }
    }

    for (const row of sorties) {
      const { error } = await supabase.from("project_expenses").insert({
        project_id: null,
        user_id: user.id,
        nom_accessoire: row.nom_accessoire,
        fournisseur: row.fournisseur,
        quantite: 1,
        prix: parseFloat(row.prix_vente_ttc),
        date_achat: row.date_achat ? new Date(row.date_achat).toISOString() : new Date().toISOString(),
        statut_paiement: row.statut_paiement,
        delai_paiement: row.delai_paiement,
        facture_url: row.facture_url || null,
      });

      if (error) {
        console.error("Erreur sauvegarde sortie:", error);
        toast.error(`Erreur lors de l'enregistrement de "${row.nom_accessoire}"`);
      } else {
        savedCount++;
      }
    }

    if (savedCount > 0) {
      toast.success(`${savedCount} ligne(s) enregistrée(s) avec succès`);
      resetTable();
      onSuccess();
    }
  };

  const handleInvoiceScanned = (invoiceData: {
    supplier: string;
    total: number;
    date: string;
    description: string;
  }) => {
    const newRow: BankLineRow = {
      id: crypto.randomUUID(),
      type: "sortie",
      nom_accessoire: invoiceData.description || "Facture scannée",
      fournisseur: invoiceData.supplier || "",
      project_id: "",
      type_paiement: "acompte",
      date_achat: invoiceData.date || new Date().toISOString().slice(0, 16),
      date_paiement: "",
      statut_paiement: "non_paye",
      delai_paiement: "commande",
      prix_vente_ttc: invoiceData.total?.toString() || "",
    };

    const lastRow = rows[rows.length - 1];
    if (lastRow && !lastRow.nom_accessoire && !lastRow.fournisseur && !lastRow.prix_vente_ttc) {
      setRows([
        ...rows.slice(0, -1),
        newRow,
        {
          id: crypto.randomUUID(),
          type: "sortie",
          nom_accessoire: "",
          fournisseur: "",
          project_id: "",
          type_paiement: "acompte",
          date_achat: new Date().toISOString().slice(0, 16),
          date_paiement: "",
          statut_paiement: "non_paye",
          delai_paiement: "commande",
          prix_vente_ttc: "",
        },
      ]);
    } else {
      setRows([
        ...rows,
        newRow,
        {
          id: crypto.randomUUID(),
          type: "sortie",
          nom_accessoire: "",
          fournisseur: "",
          project_id: "",
          type_paiement: "acompte",
          date_achat: new Date().toISOString().slice(0, 16),
          date_paiement: "",
          statut_paiement: "non_paye",
          delai_paiement: "commande",
          prix_vente_ttc: "",
        },
      ]);
    }

    setShowScannerDialog(false);
    toast.success("Facture analysée et ajoutée au tableau");
  };

  const handleBankLinesImported = (
    lines: Array<{
      date: string;
      description: string;
      amount: number;
      type: "entree" | "sortie";
    }>,
  ) => {
    const newRows: BankLineRow[] = lines.map((line) => ({
      id: crypto.randomUUID(),
      type: line.type,
      nom_accessoire: line.description,
      fournisseur: line.type === "sortie" ? extractSupplierName(line.description) : "",
      project_id: "",
      type_paiement: "acompte",
      date_achat: line.date,
      date_paiement: "",
      statut_paiement: "non_paye",
      delai_paiement: "commande",
      prix_vente_ttc: Math.abs(line.amount).toString(),
    }));

    const lastRow = rows[rows.length - 1];
    if (lastRow && !lastRow.nom_accessoire && !lastRow.fournisseur && !lastRow.prix_vente_ttc) {
      setRows([
        ...rows.slice(0, -1),
        ...newRows,
        {
          id: crypto.randomUUID(),
          type: "sortie",
          nom_accessoire: "",
          fournisseur: "",
          project_id: "",
          type_paiement: "acompte",
          date_achat: new Date().toISOString().slice(0, 16),
          date_paiement: "",
          statut_paiement: "non_paye",
          delai_paiement: "commande",
          prix_vente_ttc: "",
        },
      ]);
    } else {
      setRows([
        ...rows,
        ...newRows,
        {
          id: crypto.randomUUID(),
          type: "sortie",
          nom_accessoire: "",
          fournisseur: "",
          project_id: "",
          type_paiement: "acompte",
          date_achat: new Date().toISOString().slice(0, 16),
          date_paiement: "",
          statut_paiement: "non_paye",
          delai_paiement: "commande",
          prix_vente_ttc: "",
        },
      ]);
    }

    setShowBankImportDialog(false);
    toast.success(`${lines.length} ligne(s) importée(s) depuis le relevé bancaire`);
  };

  const extractSupplierName = (description: string) => {
    const cleaned = description
      .replace(/^(PAIEMENT|VIREMENT|PRELEVEMENT|CB|CARTE|VIR|SEPA|CHQ)\s*/i, "")
      .replace(/\d{2}\/\d{2}\/\d{2,4}/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const words = cleaned.split(/\s+/).filter((w) => w.length > 2);
    return words.slice(0, 3).join(" ");
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData.getData("text");
    if (!clipboardData.includes("\t") && !clipboardData.includes("\n")) return;

    e.preventDefault();

    const lines = clipboardData.split("\n").filter((line) => line.trim());

    const newRows: BankLineRow[] = lines.map((line) => {
      const cols = line.split("\t");
      return {
        id: crypto.randomUUID(),
        type:
          cols[0]?.toLowerCase().includes("entrée") || cols[0]?.toLowerCase().includes("entree")
            ? "entree"
            : ("sortie" as "entree" | "sortie"),
        nom_accessoire: cols[1]?.trim() || "",
        fournisseur: cols[2]?.trim() || "",
        project_id: "",
        type_paiement: "acompte",
        date_achat: cols[3]?.trim() || new Date().toISOString().slice(0, 16),
        date_paiement: "",
        statut_paiement: "non_paye",
        delai_paiement: "commande",
        prix_vente_ttc: cols[4]?.replace(",", ".").replace(/[^0-9.]/g, "") || "",
      };
    });

    if (newRows.length > 0) {
      const lastRow = rows[rows.length - 1];
      if (lastRow && !lastRow.nom_accessoire && !lastRow.fournisseur && !lastRow.prix_vente_ttc) {
        setRows([
          ...rows.slice(0, -1),
          ...newRows,
          {
            id: crypto.randomUUID(),
            type: "sortie",
            nom_accessoire: "",
            fournisseur: "",
            project_id: "",
            type_paiement: "acompte",
            date_achat: new Date().toISOString().slice(0, 16),
            date_paiement: "",
            statut_paiement: "non_paye",
            delai_paiement: "commande",
            prix_vente_ttc: "",
          },
        ]);
      } else {
        setRows([
          ...rows,
          ...newRows,
          {
            id: crypto.randomUUID(),
            type: "sortie",
            nom_accessoire: "",
            fournisseur: "",
            project_id: "",
            type_paiement: "acompte",
            date_achat: new Date().toISOString().slice(0, 16),
            date_paiement: "",
            statut_paiement: "non_paye",
            delai_paiement: "commande",
            prix_vente_ttc: "",
          },
        ]);
      }
      toast.success(`${newRows.length} ligne(s) collée(s) depuis le presse-papier`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      addNewRow();
    }
  };

  // DEBUG: Log au rendu
  console.log("[DEBUG] ExpenseTableForm rendu");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Ajouter des lignes bancaires</CardTitle>
          <div className="flex gap-2">
            {/* Bouton Factures reçues avec Error Boundary + Suspense */}
            <ComponentErrorBoundary
              componentName="IncomingInvoicesList"
              fallback={
                <Button
                  variant="outline"
                  className="gap-2 border-red-300 text-red-600"
                  onClick={() => {
                    console.error("[DEBUG] Bouton fallback cliqué - voir console");
                    toast.error("Module IncomingInvoicesList en erreur - voir console F12");
                  }}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Factures (erreur)
                </Button>
              }
            >
              <Suspense fallback={<LoadingButton />}>
                <IncomingInvoicesList
                  asDialog
                  trigger={
                    <Button variant="outline" className="gap-2">
                      <Receipt className="h-4 w-4" />
                      Factures reçues
                    </Button>
                  }
                />
              </Suspense>
            </ComponentErrorBoundary>

            {/* Bouton Import PDF */}
            <Button variant="outline" onClick={() => setShowBankImportDialog(true)} className="gap-2">
              <FileUp className="h-4 w-4" />
              Importer relevé PDF
            </Button>

            {/* Bouton Scanner */}
            <Button variant="outline" onClick={() => setShowScannerDialog(true)} className="gap-2">
              <ScanLine className="h-4 w-4" />
              Scanner facture
            </Button>
          </div>
        </div>
        <div className="bg-muted p-3 rounded-lg mt-3 space-y-2">
          <p className="text-sm font-medium">💰 Entrées et sorties d'argent</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>
              <strong>Entrée :</strong> Paiement client (acompte ou solde) - sélectionnez le projet concerné
            </li>
            <li>
              <strong>Sortie :</strong> Dépense fournisseur - renseignez le fournisseur et la facture
            </li>
            <li>
              <strong>Importer :</strong> Importez un relevé bancaire PDF (extraction automatique)
            </li>
            <li>
              <strong>Scanner :</strong> Analysez une facture PDF/photo et envoyez-la vers Evoliz
            </li>
          </ul>
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
                <TableHead className="min-w-[100px] font-semibold border-r-2 border-gray-400">Type</TableHead>
                <TableHead className="min-w-[200px] font-semibold border-r-2 border-gray-400">Description</TableHead>
                <TableHead className="min-w-[150px] font-semibold border-r-2 border-gray-400">
                  Projet / Fournisseur
                </TableHead>
                <TableHead className="min-w-[120px] font-semibold border-r-2 border-gray-400">Type paiement</TableHead>
                <TableHead className="min-w-[180px] font-semibold border-r-2 border-gray-400">Date</TableHead>
                <TableHead className="min-w-[120px] font-semibold border-r-2 border-gray-400">Montant</TableHead>
                <TableHead className="min-w-[100px] font-semibold border-r-2 border-gray-400">Facture</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Commencez à saisir dans les champs ci-dessous
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="border-b border-gray-300">
                    <TableCell className="border-r-2 border-gray-300">
                      <Select
                        value={row.type}
                        onValueChange={(value: "entree" | "sortie") => updateRow(row.id, "type", value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entree">💰 Entrée</SelectItem>
                          <SelectItem value="sortie">📤 Sortie</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="border-r-2 border-gray-300">
                      <Input
                        value={row.nom_accessoire}
                        onChange={(e) => updateRow(row.id, "nom_accessoire", e.target.value)}
                        placeholder={row.type === "entree" ? "Ex: Paiement client..." : "Ex: Achat matériel..."}
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell className="border-r-2 border-gray-300">
                      {row.type === "entree" ? (
                        <Select
                          value={row.project_id || ""}
                          onValueChange={(value) => updateRow(row.id, "project_id", value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Sélectionner projet..." />
                          </SelectTrigger>
                          <SelectContent>
                            {projects.map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.nom}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <>
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
                        </>
                      )}
                    </TableCell>
                    <TableCell className="border-r-2 border-gray-300">
                      {row.type === "entree" ? (
                        <Select
                          value={row.type_paiement || "acompte"}
                          onValueChange={(value) => updateRow(row.id, "type_paiement", value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="acompte">Acompte</SelectItem>
                            <SelectItem value="solde">Solde</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
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
                      )}
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
                      {row.type === "sortie" ? (
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
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
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
            disabled={rows.every(
              (row) => !row.nom_accessoire && !row.fournisseur && !row.project_id && !row.prix_vente_ttc,
            )}
          >
            <Save className="h-4 w-4 mr-2" />
            Enregistrer tout (
            {rows.filter((row) => row.nom_accessoire || row.fournisseur || row.project_id || row.prix_vente_ttc).length}
            )
          </Button>
        </div>
      </CardContent>

      {/* Dialog Scanner de factures */}
      <SupplierInvoiceScannerDialog
        open={showScannerDialog}
        onOpenChange={setShowScannerDialog}
        onInvoiceScanned={handleInvoiceScanned}
      />

      {/* Dialog Import relevé bancaire */}
      <BankStatementImportDialog
        open={showBankImportDialog}
        onOpenChange={setShowBankImportDialog}
        onLinesImported={handleBankLinesImported}
      />
    </Card>
  );
};

export default ExpenseTableForm;
