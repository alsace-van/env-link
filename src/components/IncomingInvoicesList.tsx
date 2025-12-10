import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  FileText,
  RefreshCw,
  ExternalLink,
  Trash2,
  Check,
  AlertCircle,
  Clock,
  Loader2,
  Receipt,
  Calendar,
  Building2,
  Link,
  Eye,
  Hash,
  Euro,
  Percent,
  FileSearch,
  Send,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface IncomingInvoice {
  id: string;
  file_name: string;
  file_path: string;
  file_url: string | null;
  mime_type: string | null;
  supplier_name: string | null;
  supplier_siret: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total_ht: number | null;
  total_ttc: number | null;
  tva_amount: number | null;
  tva_rate: number | null;
  description: string | null;
  status: string;
  confidence: number | null;
  ocr_result: any;
  ocr_error: string | null;
  created_at: string;
  updated_at: string;
  evoliz_status: string | null;
  evoliz_expense_id: string | null;
  evoliz_sent_at: string | null;
  evoliz_error: string | null;
  tokens_used: number | null;
  source: string | null;
  // Champs calculés pour la liaison
  linked_payments_count?: number;
  amount_linked?: number;
}

interface IncomingInvoicesListProps {
  asDialog?: boolean;
  trigger?: React.ReactNode;
}

export function IncomingInvoicesList({ asDialog = false, trigger }: IncomingInvoicesListProps) {
  const [invoices, setInvoices] = useState<IncomingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<IncomingInvoice | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingMultiple, setDeletingMultiple] = useState(false);

  useEffect(() => {
    if (!asDialog || dialogOpen) {
      loadInvoices();
    }
  }, [dialogOpen, asDialog]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase as any)
        .from("incoming_invoices")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Pour chaque facture, compter les paiements liés
      const invoicesWithPayments = await Promise.all(
        (data || []).map(async (invoice: IncomingInvoice) => {
          const { count, data: expenses } = await (supabase as any)
            .from("project_expenses")
            .select("id, prix, quantite", { count: "exact" })
            .eq("incoming_invoice_id", invoice.id);

          const amountLinked = expenses?.reduce((sum: number, e: any) => sum + (e.prix * e.quantite || 0), 0) || 0;

          return {
            ...invoice,
            linked_payments_count: count || 0,
            amount_linked: amountLinked,
          };
        }),
      );

      setInvoices(invoicesWithPayments);
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Erreur chargement factures:", err);
      toast.error("Erreur lors du chargement des factures");
    } finally {
      setLoading(false);
    }
  };

  const deleteInvoice = async (invoice: IncomingInvoice) => {
    setDeleting(invoice.id);
    try {
      // Supprimer le fichier du storage
      if (invoice.file_path) {
        await supabase.storage.from("incoming-invoices").remove([invoice.file_path]);
      }

      // Supprimer l'enregistrement
      const { error } = await (supabase as any).from("incoming_invoices").delete().eq("id", invoice.id);

      if (error) throw error;

      setInvoices(invoices.filter((i) => i.id !== invoice.id));
      toast.success("Facture supprimée");
    } catch (err) {
      console.error("Erreur suppression:", err);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(null);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeletingMultiple(true);

    try {
      const toDelete = invoices.filter((i) => selectedIds.has(i.id));

      // Supprimer les fichiers du storage
      const filePaths = toDelete.map((i) => i.file_path).filter(Boolean);
      if (filePaths.length > 0) {
        await supabase.storage.from("incoming-invoices").remove(filePaths);
      }

      // Supprimer les enregistrements
      const { error } = await (supabase as any).from("incoming_invoices").delete().in("id", Array.from(selectedIds));

      if (error) throw error;

      setInvoices(invoices.filter((i) => !selectedIds.has(i.id)));
      setSelectedIds(new Set());
      toast.success(`${toDelete.length} facture(s) supprimée(s)`);
    } catch (err) {
      console.error("Erreur suppression multiple:", err);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeletingMultiple(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((i) => i.id)));
    }
  };

  const openFile = async (filePath: string) => {
    try {
      const { data } = await supabase.storage.from("incoming-invoices").createSignedUrl(filePath, 3600);

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err) {
      console.error("Erreur ouverture fichier:", err);
      toast.error("Impossible d'ouvrir le fichier");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
        return (
          <Badge className="bg-green-100 text-green-800">
            <Check className="h-3 w-3 mr-1" /> Traité
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" /> Erreur
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" /> En attente
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> En cours
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLinkBadge = (invoice: IncomingInvoice) => {
    const count = invoice.linked_payments_count || 0;
    const amountLinked = invoice.amount_linked || 0;
    const totalTtc = invoice.total_ttc || 0;

    if (count === 0) {
      return (
        <Badge variant="outline">
          <Clock className="h-3 w-3 mr-1" /> Non lié
        </Badge>
      );
    }

    if (totalTtc > 0 && amountLinked >= totalTtc) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <Link className="h-3 w-3 mr-1" /> Payé ({count})
        </Badge>
      );
    }

    return (
      <Badge className="bg-yellow-100 text-yellow-800">
        <Link className="h-3 w-3 mr-1" /> Partiel ({count})
      </Badge>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("fr-FR");
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("fr-FR");
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) return "-";
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
  };

  // Panneau de détails
  const renderDetailsSheet = () => {
    if (!selectedInvoice) return null;

    return (
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Détails de la facture
            </SheetTitle>
            <SheetDescription>Informations extraites par OCR (Gemini)</SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
            <div className="space-y-6">
              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openFile(selectedInvoice.file_path)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Voir le PDF
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
                      <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          deleteInvoice(selectedInvoice);
                          setDetailsOpen(false);
                        }}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <Separator />

              {/* Statuts */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Statuts
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">OCR</p>
                    {getStatusBadge(selectedInvoice.status)}
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Evoliz</p>
                    {selectedInvoice.evoliz_status === "sent" ? (
                      <Badge className="bg-blue-100 text-blue-800">
                        <Send className="h-3 w-3 mr-1" /> Envoyé
                      </Badge>
                    ) : selectedInvoice.evoliz_status === "error" ? (
                      <Badge variant="destructive">Erreur</Badge>
                    ) : (
                      <Badge variant="outline">En attente</Badge>
                    )}
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Confiance OCR</p>
                    <p className="font-semibold">
                      {selectedInvoice.confidence ? `${Math.round(selectedInvoice.confidence * 100)}%` : "-"}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Liaison</p>
                    {getLinkBadge(selectedInvoice)}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Infos Fournisseur - Ce qu'Evoliz reçoit */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Fournisseur (→ Evoliz)
                </h4>
                <div className="space-y-2">
                  <DetailRow
                    label="Nom"
                    value={selectedInvoice.supplier_name}
                    icon={<Building2 className="h-3 w-3" />}
                    important
                  />
                  <DetailRow label="SIRET" value={selectedInvoice.supplier_siret} icon={<Hash className="h-3 w-3" />} />
                </div>
              </div>

              <Separator />

              {/* Infos Facture - Ce qu'Evoliz reçoit */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Facture (→ Evoliz)
                </h4>
                <div className="space-y-2">
                  <DetailRow
                    label="N° Facture"
                    value={selectedInvoice.invoice_number}
                    icon={<Hash className="h-3 w-3" />}
                    important
                  />
                  <DetailRow
                    label="Date facture"
                    value={formatDate(selectedInvoice.invoice_date)}
                    icon={<Calendar className="h-3 w-3" />}
                    important
                  />
                  <DetailRow
                    label="Date échéance"
                    value={formatDate(selectedInvoice.due_date)}
                    icon={<Calendar className="h-3 w-3" />}
                  />
                  <DetailRow
                    label="Description"
                    value={selectedInvoice.description}
                    icon={<FileText className="h-3 w-3" />}
                  />
                </div>
              </div>

              <Separator />

              {/* Montants - Ce qu'Evoliz reçoit */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Euro className="h-4 w-4" />
                  Montants (→ Evoliz)
                </h4>
                <div className="space-y-2">
                  <DetailRow
                    label="Total HT"
                    value={formatAmount(selectedInvoice.total_ht)}
                    icon={<Euro className="h-3 w-3" />}
                    important
                  />
                  <DetailRow
                    label="TVA"
                    value={formatAmount(selectedInvoice.tva_amount)}
                    icon={<Percent className="h-3 w-3" />}
                  />
                  <DetailRow
                    label="Taux TVA"
                    value={selectedInvoice.tva_rate ? `${selectedInvoice.tva_rate}%` : "-"}
                    icon={<Percent className="h-3 w-3" />}
                  />
                  <DetailRow
                    label="Total TTC"
                    value={formatAmount(selectedInvoice.total_ttc)}
                    icon={<Euro className="h-3 w-3" />}
                    important
                    highlight
                  />
                </div>
              </div>

              <Separator />

              {/* Métadonnées */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Métadonnées
                </h4>
                <div className="space-y-2 text-xs">
                  <DetailRow label="Fichier" value={selectedInvoice.file_name} />
                  <DetailRow label="Source" value={selectedInvoice.source || "shortcut"} />
                  <DetailRow label="Reçu le" value={formatDateTime(selectedInvoice.created_at)} />
                  <DetailRow label="Mis à jour" value={formatDateTime(selectedInvoice.updated_at)} />
                  <DetailRow label="Tokens IA" value={selectedInvoice.tokens_used?.toString() || "0"} />
                </div>
              </div>

              {/* Erreurs */}
              {(selectedInvoice.ocr_error || selectedInvoice.evoliz_error) && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-destructive flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Erreurs
                    </h4>
                    {selectedInvoice.ocr_error && (
                      <div className="p-3 bg-destructive/10 rounded-lg mb-2">
                        <p className="text-xs font-medium text-destructive mb-1">Erreur OCR :</p>
                        <p className="text-xs">{selectedInvoice.ocr_error}</p>
                      </div>
                    )}
                    {selectedInvoice.evoliz_error && (
                      <div className="p-3 bg-destructive/10 rounded-lg">
                        <p className="text-xs font-medium text-destructive mb-1">Erreur Evoliz :</p>
                        <p className="text-xs">{selectedInvoice.evoliz_error}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Données brutes OCR */}
              {selectedInvoice.ocr_result && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileSearch className="h-4 w-4" />
                      Données brutes OCR
                    </h4>
                    <pre className="p-3 bg-muted rounded-lg text-xs overflow-auto max-h-[200px]">
                      {JSON.stringify(selectedInvoice.ocr_result, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  };

  const content = (
    <>
      {/* Barre d'actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 mb-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} facture(s) sélectionnée(s)</span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deletingMultiple}>
                {deletingMultiple ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Supprimer la sélection
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer {selectedIds.size} facture(s) ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Tous les fichiers et données seront supprimés.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteSelected}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Supprimer {selectedIds.size} facture(s)
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement des factures...
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Aucune facture reçue</p>
          <p className="text-sm mt-2">Utilisez le raccourci macOS pour envoyer des factures</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedIds.size === invoices.length && invoices.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>N° Facture</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">HT</TableHead>
              <TableHead className="text-right">TTC</TableHead>
              <TableHead>OCR</TableHead>
              <TableHead>Liaison</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow
                key={invoice.id}
                className={`${invoice.linked_payments_count && invoice.linked_payments_count > 0 ? "bg-green-50/50 dark:bg-green-950/10" : ""} ${selectedIds.has(invoice.id) ? "bg-primary/5" : ""}`}
              >
                <TableCell>
                  <Checkbox checked={selectedIds.has(invoice.id)} onCheckedChange={() => toggleSelect(invoice.id)} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium block truncate max-w-[150px]">
                        {invoice.supplier_name || invoice.file_name}
                      </span>
                      {invoice.confidence && (
                        <span className="text-xs text-muted-foreground">{Math.round(invoice.confidence * 100)}%</span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{invoice.invoice_number || "-"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {formatDate(invoice.invoice_date)}
                  </div>
                </TableCell>
                <TableCell className="text-right">{formatAmount(invoice.total_ht)}</TableCell>
                <TableCell className="text-right font-medium">{formatAmount(invoice.total_ttc)}</TableCell>
                <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                <TableCell>{getLinkBadge(invoice)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setDetailsOpen(true);
                      }}
                      title="Voir les détails"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openFile(invoice.file_path)}
                      title="Voir le fichier"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      disabled={deleting === invoice.id}
                      onClick={() => deleteInvoice(invoice)}
                    >
                      {deleting === invoice.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {renderDetailsSheet()}
    </>
  );

  // Mode Dialog
  if (asDialog) {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline">
              <Receipt className="h-4 w-4 mr-2" />
              Factures reçues
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Factures reçues ({invoices.length})
            </DialogTitle>
            <DialogDescription>
              Factures envoyées via le raccourci macOS • Cliquez sur 👁️ pour voir les détails OCR
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={loadInvoices}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  // Mode Card
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Factures reçues ({invoices.length})
            </CardTitle>
            <CardDescription>Factures envoyées via le raccourci macOS</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadInvoices}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

// Composant helper pour les lignes de détail
function DetailRow({
  label,
  value,
  icon,
  important = false,
  highlight = false,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
  important?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-2 rounded ${highlight ? "bg-primary/10" : "bg-muted/50"}`}>
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className={`text-sm ${important ? "font-semibold" : ""} ${highlight ? "text-primary font-bold" : ""}`}>
        {value || <span className="text-muted-foreground">-</span>}
      </span>
    </div>
  );
}
