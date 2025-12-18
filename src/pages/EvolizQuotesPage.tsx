// ============================================
// PAGE DEVIS EVOLIZ - STRUCTURE CORRIGÉE
// Basé sur la vraie structure API Evoliz
// VERSION: 1.2 - Fix bouton Retour avec fallback intelligent
// ============================================

import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEvolizConfig } from "@/hooks/useEvolizConfig";
import { useEvolizQuotes } from "@/hooks/useEvolizQuotes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Home,
  FileText,
  RefreshCw,
  Loader2,
  ExternalLink,
  Search,
  Eye,
  AlertCircle,
  Settings,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Helper pour formater les montants
function formatAmount(value: any, currency = "EUR"): string {
  const num = typeof value === "number" ? value : parseFloat(value) || 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
  }).format(num);
}

// Helper pour formater la date
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  try {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

// Badge de statut - adapté aux vrais statuts Evoliz
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<
    string,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
  > = {
    draft: { label: "Brouillon", variant: "secondary" },
    pending: { label: "En attente", variant: "outline" },
    sent: { label: "Envoyé", variant: "default" },
    accept: { label: "Accepté", variant: "default", className: "bg-green-500 text-white" },
    accepted: { label: "Accepté", variant: "default", className: "bg-green-500 text-white" },
    wait: { label: "En attente", variant: "outline" },
    reject: { label: "Refusé", variant: "destructive" },
    refused: { label: "Refusé", variant: "destructive" },
    invoice: { label: "Facturé", variant: "default", className: "bg-blue-500 text-white" },
    invoiced: { label: "Facturé", variant: "default", className: "bg-blue-500 text-white" },
    close: { label: "Clôturé", variant: "secondary" },
    order: { label: "Commandé", variant: "default" },
  };

  const config = statusConfig[status?.toLowerCase()] || { label: status || "Inconnu", variant: "secondary" as const };

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

export default function EvolizQuotesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConfigured, isLoading: configLoading } = useEvolizConfig();
  const { quotes, isLoading, error, fetchQuotes } = useEvolizQuotes();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);

  // Navigation intelligente : retour à la page précédente ou fallback vers accueil
  const handleGoBack = () => {
    // Vérifier si on a un historique de navigation dans cette session
    if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  // Charger les devis au montage
  useEffect(() => {
    if (isConfigured) {
      fetchQuotes();
    }
  }, [isConfigured, fetchQuotes]);

  // Filtrer les devis
  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch =
      !searchTerm ||
      quote.document_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.object?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.client?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || quote.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Calculer les stats
  const stats = {
    total: quotes.length,
    accepted: quotes.filter((q) => q.status?.toLowerCase() === "accept").length,
    pending: quotes.filter((q) => ["pending", "sent", "wait"].includes(q.status?.toLowerCase())).length,
    totalAmount: quotes.reduce((sum, q) => sum + (q.total?.vat_include || 0), 0),
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Evoliz n'est pas configuré. Configurez vos clés API pour accéder aux devis.</span>
            <Button size="sm" onClick={() => navigate("/settings/evoliz")}>
              <Settings className="h-4 w-4 mr-2" />
              Configurer
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Navigation */}
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={handleGoBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
          <Home className="h-4 w-4" />
          Tableau de bord
        </Button>
      </div>

      {/* En-tête */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="h-8 w-8" />
            Devis Evoliz
          </h1>
          <p className="text-muted-foreground mt-2">{quotes.length} devis trouvés</p>
        </div>
        <Button onClick={() => fetchQuotes()} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total devis</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.accepted}</div>
            <p className="text-xs text-muted-foreground">Acceptés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-500">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">En attente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatAmount(stats.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">Montant total TTC</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par numéro, objet ou client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="sent">Envoyé</SelectItem>
                <SelectItem value="wait">En attente</SelectItem>
                <SelectItem value="accept">Accepté</SelectItem>
                <SelectItem value="reject">Refusé</SelectItem>
                <SelectItem value="invoice">Facturé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Erreur */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Liste des devis */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des devis</CardTitle>
          <CardDescription>{filteredQuotes.length} devis affichés</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Aucun devis trouvé</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Objet</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">HT</TableHead>
                  <TableHead className="text-right">TTC</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((quote) => (
                  <TableRow key={quote.quoteid}>
                    <TableCell className="font-medium">{quote.document_number || quote.quoteid}</TableCell>
                    <TableCell>{quote.client?.name || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{quote.object || "-"}</TableCell>
                    <TableCell>{formatDate(quote.documentdate)}</TableCell>
                    <TableCell>
                      <StatusBadge status={quote.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAmount(quote.total?.vat_exclude, quote.default_currency?.code)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatAmount(quote.total?.vat_include, quote.default_currency?.code)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedQuote(quote)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog détail devis */}
      <Dialog open={!!selectedQuote} onOpenChange={() => setSelectedQuote(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Devis {selectedQuote?.document_number}</DialogTitle>
            <DialogDescription>{selectedQuote?.client?.name}</DialogDescription>
          </DialogHeader>

          {selectedQuote && (
            <div className="space-y-6">
              {/* Infos générales */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Date :</span> {formatDate(selectedQuote.documentdate)}
                </div>
                <div>
                  <span className="text-muted-foreground">Validité :</span> {selectedQuote.validity} jours
                </div>
                <div>
                  <span className="text-muted-foreground">Statut :</span> <StatusBadge status={selectedQuote.status} />
                </div>
                <div>
                  <span className="text-muted-foreground">Paiement :</span> {selectedQuote.term?.payterm?.label || "-"}
                </div>
              </div>

              {/* Objet */}
              {selectedQuote.object && (
                <div>
                  <h4 className="font-medium mb-2">Objet</h4>
                  <p className="text-sm text-muted-foreground">{selectedQuote.object}</p>
                </div>
              )}

              {/* Lignes du devis */}
              {selectedQuote.items && selectedQuote.items.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Lignes du devis ({selectedQuote.items.length})</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Désignation</TableHead>
                        <TableHead className="text-right">Qté</TableHead>
                        <TableHead className="text-right">P.U. HT</TableHead>
                        <TableHead className="text-right">Total HT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedQuote.items.map((item: any, index: number) => (
                        <TableRow key={item.itemid || index}>
                          <TableCell>
                            <div
                              className="text-sm"
                              dangerouslySetInnerHTML={{
                                __html: (item.designation_clean || item.designation || "-").replace(/\n/g, "<br/>"),
                              }}
                            />
                            {item.reference && (
                              <div className="text-xs text-muted-foreground mt-1">Réf: {item.reference}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.quantity} {item.unit || ""}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(item.unit_price_vat_exclude, selectedQuote.default_currency?.code)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(item.total?.vat_exclude, selectedQuote.default_currency?.code)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Totaux */}
              <div className="border-t pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total HT</span>
                    <span>{formatAmount(selectedQuote.total?.vat_exclude, selectedQuote.default_currency?.code)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TVA</span>
                    <span>{formatAmount(selectedQuote.total?.vat, selectedQuote.default_currency?.code)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total TTC</span>
                    <span>{formatAmount(selectedQuote.total?.vat_include, selectedQuote.default_currency?.code)}</span>
                  </div>
                  {selectedQuote.total?.margin && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Marge</span>
                      <span>
                        {formatAmount(selectedQuote.total.margin.amount)} (
                        {selectedQuote.total.margin.percent?.toFixed(1)}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Commentaire */}
              {selectedQuote.comment_clean && (
                <div>
                  <h4 className="font-medium mb-2">Commentaire</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{selectedQuote.comment_clean}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" asChild className="flex-1">
                  <a href={selectedQuote.webdoc} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Voir le PDF
                  </a>
                </Button>
                <Button variant="outline" asChild className="flex-1">
                  <a
                    href={`https://www.evoliz.io/quotes/${selectedQuote.quoteid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ouvrir dans Evoliz
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
