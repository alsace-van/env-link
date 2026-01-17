// ============================================
// VERSION 1.2.0 - ExpenseTableForm.tsx
// ============================================
// Modifications v1.2.0:
// - Projet optionnel pour les entrées (ne bloque plus la sauvegarde)
// - Ajout indicateur orange si entrée sans projet associé
// - Fix SelectItem: utilisation de "none" au lieu de valeur vide
//
// Modifications v1.1.0:
// - Fix format date import bancaire: ajout T12:00 pour datetime-local
// ============================================

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
  CircleAlert,
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

// Import lazy pour isoler les erreurs de chargement
const IncomingInvoicesList = lazy(() =>
  import("@/components/IncomingInvoicesList")
    .then((module) => {
      console.log("[DEBUG] ✅ IncomingInvoicesList chargé avec succès");
      return { default: module.IncomingInvoicesList };
    })
    .catch((err) => {
      console.error("[DEBUG] ❌ Erreur chargement IncomingInvoicesList:", err);
      return {
        default: ({ trigger }: any) => (
          <Button
            variant="outline"
            className="gap-2 border-orange-300 text-orange-600"
            onClick={() => {
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
    console.log("[DEBUG] 🚀 ExpenseTableForm monté");
    return () => console.log("[DEBUG] 💀 ExpenseTableForm démonté");
  }, []);

  useEffect(() => {
    loadFournisseurs();
    loadProjects();
    // Ajouter une ligne vide au démarrage pour permettre la saisie immédiate
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
    // S'assurer qu'il reste toujours au moins une ligne vide
    if (filteredRows.length === 0) {
      addNewRow();
    } else {
      setRows(filteredRows);
    }
  };

  const updateRow = (id: string, field: keyof BankLineRow, value: string | File) => {
    const updatedRows = rows.map((row) => (row.id === id ? { ...row, [field]: value } : row));
    setRows(updatedRows);

    // Vérifier si la dernière ligne a été modifiée et contient suffisamment de données
    const lastRow = updatedRows[updatedRows.length - 1];
    if (lastRow && lastRow.id === id) {
      // Ajouter une nouvelle ligne seulement si les champs essentiels sont remplis
      const hasEssentialData =
        lastRow.nom_accessoire.trim() !== "" &&
        lastRow.fournisseur.trim() !== "" &&
        lastRow.prix_vente_ttc.trim() !== "";

      if (hasEssentialData) {
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
    // Filtrer les lignes vides
    const rowsToSave = rows.filter(
      (row) => row.nom_accessoire.trim() || row.fournisseur.trim() || row.project_id || row.prix_vente_ttc,
    );

    if (rowsToSave.length === 0) {
      toast.error("Aucune ligne à enregistrer");
      return;
    }

    // Validation
    // v1.2.0: Compteur pour les entrées sans projet (warning au lieu de bloquer)
    let entreesWithoutProject = 0;

    for (const row of rowsToSave) {
      if (!row.nom_accessoire.trim()) {
        toast.error("Le nom/description est requis pour toutes les lignes");
        return;
      }
      if (row.type === "sortie" && !row.fournisseur.trim()) {
        toast.error("Le fournisseur est requis pour les sorties d'argent");
        return;
      }
      // v1.2.0: Ne plus bloquer si entrée sans projet, juste compter
      if (row.type === "entree" && !row.project_id) {
        entreesWithoutProject++;
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

    // Séparer les entrées et sorties
    const entries = rowsWithUrls.filter((row) => row.type === "entree");
    const expenses = rowsWithUrls.filter((row) => row.type === "sortie");

    // Insérer les entrées d'argent (paiements)
    // v1.2.0: Séparer les entrées avec et sans projet
    const entriesWithProject = entries.filter((row) => row.project_id);
    const entriesWithoutProject = entries.filter((row) => !row.project_id);

    if (entriesWithProject.length > 0) {
      const paymentsToInsert = entriesWithProject.map((row) => ({
        project_id: row.project_id!,
        user_id: user.id,
        montant: parseFloat(row.prix_vente_ttc),
        date_paiement: row.date_achat.split("T")[0], // Prendre seulement la date
        type_paiement: row.type_paiement || "acompte",
        mode_paiement: "virement",
        notes: row.nom_accessoire,
      }));

      const { error: paymentError } = await supabase.from("project_payment_transactions").insert(paymentsToInsert);

      if (paymentError) {
        toast.error("Erreur lors de l'enregistrement des entrées d'argent");
        console.error(paymentError);
        return;
      }
    }

    // v1.2.0: Stocker les entrées sans projet dans project_expenses avec type spécial
    if (entriesWithoutProject.length > 0) {
      const unassignedEntries = entriesWithoutProject.map((row) => ({
        project_id: null,
        user_id: user.id,
        nom_accessoire: row.nom_accessoire,
        fournisseur: "ENTRÉE NON ASSIGNÉE",
        date_achat: row.date_achat,
        date_paiement: row.date_achat.split("T")[0],
        statut_paiement: "paye",
        delai_paiement: "immediat",
        prix: -parseFloat(row.prix_vente_ttc), // Négatif pour différencier des dépenses
        prix_vente_ttc: -parseFloat(row.prix_vente_ttc),
        quantite: 1,
        categorie: "Entrée non assignée",
        statut_livraison: "livre",
      }));

      const { error: unassignedError } = await supabase.from("project_expenses").insert(unassignedEntries);

      if (unassignedError) {
        toast.error("Erreur lors de l'enregistrement des entrées non assignées");
        console.error(unassignedError);
        return;
      }
    }

    // Insérer les sorties d'argent (dépenses)
    if (expenses.length > 0) {
      const expensesToInsert = expenses.map((row) => ({
        project_id: null, // Dépenses fournisseurs globales, pas liées à un projet
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

      const { data: insertedExpenses, error: expenseError } = await supabase
        .from("project_expenses")
        .insert(expensesToInsert)
        .select();

      if (expenseError) {
        toast.error("Erreur lors de l'enregistrement des sorties d'argent");
        console.error(expenseError);
        return;
      }

      // Créer automatiquement une tâche pour chaque sortie non payée
      if (insertedExpenses) {
        const todosToCreate = insertedExpenses
          .filter((expense: any) => expense.statut_paiement !== "paye")
          .map((expense: any) => ({
            user_id: user.id,
            project_id: projectId,
            title: `Payer: ${expense.nom_accessoire}`,
            description: `Fournisseur: ${expense.fournisseur}\nMontant: ${expense.prix.toFixed(2)} €`,
            priority: "high",
            completed: false,
          }));

        if (todosToCreate.length > 0) {
          const { data: createdTodos } = await supabase.from("project_todos").insert(todosToCreate).select();

          // Mettre à jour les dépenses avec l'ID de la tâche
          if (createdTodos) {
            for (let i = 0; i < createdTodos.length; i++) {
              const expense = insertedExpenses.filter((e: any) => e.statut_paiement !== "paye")[i];
              await supabase.from("project_expenses").update({ todo_id: createdTodos[i].id }).eq("id", expense.id);
            }
          }
        }
      }
    }

    // v1.2.0: Message de succès avec warning si entrées sans projet
    if (entreesWithoutProject > 0) {
      toast.warning(
        `${rowsToSave.length} ligne(s) enregistrée(s). ⚠️ ${entreesWithoutProject} entrée(s) sans projet assigné.`,
      );
    } else {
      toast.success(`${rowsToSave.length} ligne(s) bancaire(s) ajoutée(s) avec succès`);
    }

    // Réinitialiser avec une ligne vide
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
    onSuccess();
  };

  // Removed automatic row creation on mount to show empty table with headers

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveRows();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // Fonction désactivée pour les lignes bancaires - utiliser le formulaire
    e.preventDefault();
    toast.info("Utilisez le formulaire pour saisir les lignes bancaires");
  };

  // Callback quand une facture est scannée et envoyée vers Evoliz
  const handleInvoiceScanned = (invoiceData: {
    supplier_name: string;
    total_ttc: number | null;
    total_ht: number | null;
    invoice_number?: string | null;
    invoice_date?: string | null;
  }) => {
    // Ajouter une ligne dans le tableau avec les données scannées
    const newRow: BankLineRow = {
      id: crypto.randomUUID(),
      type: "sortie",
      nom_accessoire: `Facture ${invoiceData.invoice_number || invoiceData.supplier_name}`,
      fournisseur: invoiceData.supplier_name,
      date_achat: invoiceData.invoice_date || new Date().toISOString().split("T")[0],
      date_paiement: "",
      statut_paiement: "non_paye",
      delai_paiement: "immediat",
      prix_vente_ttc: (invoiceData.total_ttc || 0).toFixed(2),
    };

    setRows((prev) => [...prev, newRow]);
    toast.success("Facture ajoutée à la liste");
  };

  // Callback quand des lignes sont importées depuis un relevé bancaire
  // v1.1.0: Fix format date - ajout T12:00 pour compatibilité datetime-local
  const handleBankLinesImported = (
    importedLines: Array<{
      id: string;
      type: "entree" | "sortie";
      date: string;
      label: string;
      amount: number;
      bankLineId: string;
    }>,
  ) => {
    const newRows: BankLineRow[] = importedLines.map((line) => ({
      id: line.id,
      type: line.type,
      nom_accessoire: line.label,
      fournisseur: line.type === "sortie" ? extractSupplierFromLabel(line.label) : "",
      // v1.1.0: Ajout T12:00 pour format datetime-local (YYYY-MM-DDTHH:MM)
      date_achat: line.date ? `${line.date}T12:00` : new Date().toISOString().slice(0, 16),
      date_paiement: line.date ? `${line.date}T12:00` : new Date().toISOString().slice(0, 16),
      statut_paiement: "paye",
      delai_paiement: "immediat",
      prix_vente_ttc: line.amount.toFixed(2),
    }));

    setRows((prev) => [...prev, ...newRows]);
    setShowBankImportDialog(false);
  };

  // Extraire un nom de fournisseur depuis le libellé bancaire
  const extractSupplierFromLabel = (label: string): string => {
    // Nettoyer les préfixes courants
    let cleaned = label
      .replace(/^(CB|VIR|VIREMENT|PRLV|PRELEVEMENT|CHQ|CHEQUE)\s*/i, "")
      .replace(/^\d{2}\/\d{2}\s*/, "") // Enlever les dates DD/MM
      .replace(/\s+\d{2}\/\d{2}.*$/, "") // Enlever les dates à la fin
      .replace(/\s+CARTE\s+\d+.*$/i, "") // Enlever numéro de carte
      .trim();

    // Prendre les premiers mots significatifs
    const words = cleaned.split(/\s+/).filter((w) => w.length > 2);
    return words.slice(0, 3).join(" ");
  };

  // DEBUG: Log au rendu
  console.log("[DEBUG] 🔄 ExpenseTableForm rendu");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Ajouter des lignes bancaires</CardTitle>
          <div className="flex gap-2">
            {/* DEBUG: Bouton Factures reçues avec Error Boundary + Suspense */}
            <ComponentErrorBoundary
              componentName="IncomingInvoicesList"
              fallback={
                <Button
                  variant="outline"
                  className="gap-2 border-red-300 text-red-600"
                  onClick={() => {
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
            {/* Boutons toujours visibles */}
            <Button variant="outline" onClick={() => setShowBankImportDialog(true)} className="gap-2">
              <FileUp className="h-4 w-4" />
              Importer relevé PDF
            </Button>
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
                <TableHead className="min-w-[180px] font-semibold border-r-2 border-gray-400">Description</TableHead>
                <TableHead className="min-w-[140px] font-semibold border-r-2 border-gray-400">
                  Projet / Fournisseur
                </TableHead>
                <TableHead className="min-w-[120px] font-semibold border-r-2 border-gray-400">Type paiement</TableHead>
                <TableHead className="min-w-[150px] font-semibold border-r-2 border-gray-400">Date</TableHead>
                <TableHead className="min-w-[100px] font-semibold border-r-2 border-gray-400">Montant</TableHead>
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
                        // v1.2.0: Indicateur orange si pas de projet + option "Aucun projet"
                        <div className="flex items-center gap-1">
                          {!row.project_id && (
                            <CircleAlert
                              className="h-4 w-4 text-orange-500 flex-shrink-0"
                              title="Aucun projet assigné"
                            />
                          )}
                          <Select
                            value={row.project_id || "none"}
                            onValueChange={(value) => updateRow(row.id, "project_id", value === "none" ? "" : value)}
                          >
                            <SelectTrigger className={`h-9 ${!row.project_id ? "border-orange-400" : ""}`}>
                              <SelectValue placeholder="Sélectionner projet..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                <span className="text-orange-600">⚠️ Aucun projet</span>
                              </SelectItem>
                              {projects.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                  {project.nom}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
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
