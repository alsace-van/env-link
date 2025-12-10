import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface IncomingInvoice {
  id: string;
  file_name: string;
  file_path: string;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total_ht: number | null;
  total_ttc: number | null;
  tva_amount: number | null;
  status: string;
  confidence: number | null;
  created_at: string;
  evoliz_status: string | null;
  ocr_error: string | null;
}

export function IncomingInvoicesList() {
  const [invoices, setInvoices] = useState<IncomingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase as any)
        .from("incoming_invoices")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
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
        await supabase.storage
          .from("incoming-invoices")
          .remove([invoice.file_path]);
      }

      // Supprimer l'enregistrement
      const { error } = await (supabase as any)
        .from("incoming_invoices")
        .delete()
        .eq("id", invoice.id);

      if (error) throw error;

      setInvoices(invoices.filter(i => i.id !== invoice.id));
      toast.success("Facture supprimée");
    } catch (err) {
      console.error("Erreur suppression:", err);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(null);
    }
  };

  const openFile = async (filePath: string) => {
    try {
      const { data } = await supabase.storage
        .from("incoming-invoices")
        .createSignedUrl(filePath, 3600); // 1 heure

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
        return <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" /> Traité</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Erreur</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> En attente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEvolizBadge = (status: string | null) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-blue-100 text-blue-800"><Check className="h-3 w-3 mr-1" /> Envoyé</Badge>;
      case "pending":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> À envoyer</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Erreur</Badge>;
      default:
        return null;
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

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Chargement des factures...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Factures reçues
            </CardTitle>
            <CardDescription>
              Factures envoyées via le raccourci macOS
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadInvoices}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucune facture reçue</p>
            <p className="text-sm mt-2">
              Utilisez le raccourci macOS pour envoyer des factures
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fournisseur</TableHead>
                <TableHead>N° Facture</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Montant TTC</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Evoliz</TableHead>
                <TableHead>Reçu le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {invoice.supplier_name || invoice.file_name}
                      </span>
                    </div>
                    {invoice.confidence && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(invoice.confidence * 100)}% confiance
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{invoice.invoice_number || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {formatDate(invoice.invoice_date)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(invoice.total_ttc)}
                  </TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell>{getEvolizBadge(invoice.evoliz_status)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(invoice.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openFile(invoice.file_path)}
                        title="Voir le fichier"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            disabled={deleting === invoice.id}
                          >
                            {deleting === invoice.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible. Le fichier et les données seront supprimés.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteInvoice(invoice)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
