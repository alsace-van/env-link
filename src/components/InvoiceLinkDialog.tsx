import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Link,
  Unlink,
  Check,
  AlertCircle,
  ExternalLink,
  Loader2,
  Receipt,
  Calendar,
  Building2,
} from "lucide-react";

interface IncomingInvoice {
  id: string;
  file_name: string;
  file_path: string;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total_ht: number | null;
  total_ttc: number | null;
  status: string;
  confidence: number | null;
  created_at: string;
  // Champs calculés
  linked_payments_count?: number;
  amount_linked?: number;
}

interface InvoiceLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankLineId: string | null;
  bankLineDescription: string;
  bankLineMontant: number;
  currentInvoiceId?: string | null;
  onLinked: () => void;
}

export function InvoiceLinkDialog({
  open,
  onOpenChange,
  bankLineId,
  bankLineDescription,
  bankLineMontant,
  currentInvoiceId,
  onLinked,
}: InvoiceLinkDialogProps) {
  const [invoices, setInvoices] = useState<IncomingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadInvoices();
    }
  }, [open]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Charger toutes les factures avec le nombre de paiements liés
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

          const amountLinked = expenses?.reduce(
            (sum: number, e: any) => sum + (e.prix * e.quantite || 0),
            0
          ) || 0;

          return {
            ...invoice,
            linked_payments_count: count || 0,
            amount_linked: amountLinked,
          };
        })
      );

      setInvoices(invoicesWithPayments);
    } catch (err) {
      console.error("Erreur chargement factures:", err);
      toast.error("Erreur lors du chargement des factures");
    } finally {
      setLoading(false);
    }
  };

  const linkInvoice = async (invoiceId: string) => {
    if (!bankLineId) return;
    setLinking(invoiceId);

    try {
      const { error } = await (supabase as any)
        .from("project_expenses")
        .update({ incoming_invoice_id: invoiceId })
        .eq("id", bankLineId);

      if (error) throw error;

      toast.success("Facture liée avec succès");
      onLinked();
      onOpenChange(false);
    } catch (err) {
      console.error("Erreur liaison:", err);
      toast.error("Erreur lors de la liaison");
    } finally {
      setLinking(null);
    }
  };

  const unlinkInvoice = async () => {
    if (!bankLineId) return;
    setLinking("unlink");

    try {
      const { error } = await (supabase as any)
        .from("project_expenses")
        .update({ incoming_invoice_id: null })
        .eq("id", bankLineId);

      if (error) throw error;

      toast.success("Liaison supprimée");
      onLinked();
      onOpenChange(false);
    } catch (err) {
      console.error("Erreur déliaison:", err);
      toast.error("Erreur lors de la suppression de la liaison");
    } finally {
      setLinking(null);
    }
  };

  const openFile = async (filePath: string) => {
    try {
      const { data } = await supabase.storage
        .from("incoming-invoices")
        .createSignedUrl(filePath, 3600);

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err) {
      console.error("Erreur ouverture fichier:", err);
      toast.error("Impossible d'ouvrir le fichier");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("fr-FR");
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
  };

  const getPaymentStatusBadge = (invoice: IncomingInvoice) => {
    if (!invoice.total_ttc) return null;

    const amountLinked = invoice.amount_linked || 0;
    const percentage = Math.round((amountLinked / invoice.total_ttc) * 100);

    if (amountLinked >= invoice.total_ttc) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <Check className="h-3 w-3 mr-1" /> Payé 100%
        </Badge>
      );
    } else if (amountLinked > 0) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          Partiel {percentage}%
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        Non lié
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Lier une facture
          </DialogTitle>
          <DialogDescription>
            Ligne bancaire : <strong>{bankLineDescription}</strong> - {formatAmount(bankLineMontant)}
          </DialogDescription>
        </DialogHeader>

        {currentInvoiceId && (
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <span className="text-sm">Cette ligne est déjà liée à une facture</span>
            <Button
              variant="outline"
              size="sm"
              onClick={unlinkInvoice}
              disabled={linking === "unlink"}
            >
              {linking === "unlink" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Unlink className="h-4 w-4 mr-1" />
              )}
              Délier
            </Button>
          </div>
        )}

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Chargement...
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucune facture disponible</p>
              <p className="text-sm mt-2">
                Envoyez des factures via le raccourci macOS
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map((invoice) => {
                const isCurrentlyLinked = invoice.id === currentInvoiceId;
                const hasOtherLinks = (invoice.linked_payments_count || 0) > 0;

                return (
                  <div
                    key={invoice.id}
                    className={`p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
                      isCurrentlyLinked ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">
                            {invoice.supplier_name || invoice.file_name}
                          </span>
                          {isCurrentlyLinked && (
                            <Badge className="bg-primary text-primary-foreground">
                              Lié
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {invoice.invoice_number && (
                            <span>N° {invoice.invoice_number}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(invoice.invoice_date)}
                          </span>
                          <span className="font-medium text-foreground">
                            {formatAmount(invoice.total_ttc)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          {getPaymentStatusBadge(invoice)}
                          {hasOtherLinks && !isCurrentlyLinked && (
                            <span className="text-xs text-muted-foreground">
                              {invoice.linked_payments_count} paiement(s) lié(s) 
                              ({formatAmount(invoice.amount_linked || 0)})
                            </span>
                          )}
                          {invoice.confidence && (
                            <span className="text-xs text-muted-foreground">
                              OCR {Math.round(invoice.confidence * 100)}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openFile(invoice.file_path)}
                          title="Voir le fichier"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>

                        {isCurrentlyLinked ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={unlinkInvoice}
                            disabled={linking !== null}
                          >
                            {linking === "unlink" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Unlink className="h-4 w-4" />
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => linkInvoice(invoice.id)}
                            disabled={linking !== null}
                          >
                            {linking === invoice.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Link className="h-4 w-4 mr-1" />
                                Lier
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
