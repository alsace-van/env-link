// ============================================
// PAGE DEVIS EVOLIZ - VERSION CORRIGÉE
// Gestion correcte des montants
// ============================================

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

// Helper pour formater les montants de façon sécurisée
function formatAmount(value: any, currency = "EUR"): string {
  // Essayer de convertir en nombre
  let num = 0;

  if (typeof value === "number" && !isNaN(value)) {
    num = value;
  } else if (typeof value === "string") {
    // Nettoyer la chaîne et convertir
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".");
    num = parseFloat(cleaned) || 0;
  } else if (value === null || value === undefined) {
    num = 0;
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
  }).format(num);
}

// Helper pour extraire le montant total d'un devis
function getQuoteTotal(quote: any): { ht: number; ttc: number; tva: number } {
  // Structure possible 1: quote.total.totalht / quote.total.totalttc
  if (quote.total && typeof quote.total === "object") {
    return {
      ht: parseFloat(quote.total.totalht) || parseFloat(quote.total.total_ht) || 0,
      ttc: parseFloat(quote.total.totalttc) || parseFloat(quote.total.total_ttc) || 0,
      tva: parseFloat(quote.total.totaltax) || parseFloat(quote.total.total_tax) || 0,
    };
  }

  // Structure possible 2: quote.totalht / quote.totalttc
  if (quote.totalht !== undefined || quote.totalttc !== undefined) {
    return {
      ht: parseFloat(quote.totalht) || parseFloat(quote.total_ht) || 0,
      ttc: parseFloat(quote.totalttc) || parseFloat(quote.total_ttc) || 0,
      tva: parseFloat(quote.totaltax) || parseFloat(quote.total_tax) || 0,
    };
  }

  // Structure possible 3: directement des champs
  return {
    ht: parseFloat(quote.amount_ht) || parseFloat(quote.amount) || 0,
    ttc: parseFloat(quote.amount_ttc) || 0,
    tva: parseFloat(quote.tax_amount) || 0,
  };
}

// Helper pour extraire les montants d'une ligne
function getLineAmount(line: any): { unitPrice: number; total: number } {
  return {
    unitPrice: parseFloat(line.unit_price_ht) || parseFloat(line.unitprice) || parseFloat(line.price) || 0,
    total: parseFloat(line.total_ht) || parseFloat(line.totalht) || parseFloat(line.total) || 0,
  };
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

// Badge de statut
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> =
    {
      draft: { label: "Brouillon", variant: "secondary" },
      pending: { label: "En attente", variant: "outline" },
      sent: { label: "Envoyé", variant: "default" },
      accepted: { label: "Accepté", variant: "default" },
      refused: { label: "Refusé", variant: "destructive" },
      invoiced: { label: "Facturé", variant: "default" },
    };

  const config = statusConfig[status?.toLowerCase()] || { label: status || "Inconnu", variant: "secondary" as const };

  return (
    <Badge variant={config.variant} className={status?.toLowerCase() === "accepted" ? "bg-green-500 text-white" : ""}>
      {config.label}
    </Badge>
  );
}

export default function EvolizQuotesPage() {
  const navigate = useNavigate();
  const { isConfigured, isLoading: configLoading } = useEvolizConfig();
  const { quotes, isLoading, error, fetchQuotes } = useEvolizQuotes();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);
  const [showDebug, setShowDebug] = useState(false);

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
      quote.documentid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.object?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.client?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || quote.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Calculer les stats
  const stats = {
    total: quotes.length,
    accepted: quotes.filter((q) => q.status?.toLowerCase() === "accepted").length,
    pending: quotes.filter((q) => ["pending", "sent"].includes(q.status?.toLowerCase())).length,
    totalAmount: quotes.reduce((sum, q) => sum + getQuoteTotal(q).ttc, 0),
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
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDebug(!showDebug)}>
            {showDebug ? "Masquer debug" : "Debug"}
          </Button>
          <Button onClick={() => fetchQuotes()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Actualiser
          </Button>
        </div>
      </div>

      {/* Debug */}
      {showDebug && quotes.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm">Debug - Structure du premier devis</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-64">
              {JSON.stringify(quotes[0], null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

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
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="sent">Envoyé</SelectItem>
                <SelectItem value="accepted">Accepté</SelectItem>
                <SelectItem value="refused">Refusé</SelectItem>
                <SelectItem value="invoiced">Facturé</SelectItem>
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
                  <TableHead className="text-right">Montant HT</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((quote) => {
                  const totals = getQuoteTotal(quote);
                  return (
                    <TableRow key={quote.quoteid}>
                      <TableCell className="font-medium">{quote.documentid || quote.quoteid}</TableCell>
                      <TableCell>{quote.client?.name || quote.clientname || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">{quote.object || quote.label || "-"}</TableCell>
                      <TableCell>{formatDate(quote.documentdate || quote.date)}</TableCell>
                      <TableCell>
                        <StatusBadge status={quote.status} />
                      </TableCell>
                      <TableCell className="text-right">{formatAmount(totals.ht, quote.currency)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatAmount(totals.ttc, quote.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedQuote(quote)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog détail devis */}
      <Dialog open={!!selectedQuote} onOpenChange={() => setSelectedQuote(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Devis {selectedQuote?.documentid || selectedQuote?.quoteid}</DialogTitle>
            <DialogDescription>{selectedQuote?.client?.name || selectedQuote?.clientname}</DialogDescription>
          </DialogHeader>

          {selectedQuote && (
            <div className="space-y-6">
              {/* Infos générales */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Date :</span>{" "}
                  {formatDate(selectedQuote.documentdate || selectedQuote.date)}
                </div>
                <div>
                  <span className="text-muted-foreground">Validité :</span>{" "}
                  {formatDate(selectedQuote.duedate || selectedQuote.validity_date)}
                </div>
                <div>
                  <span className="text-muted-foreground">Statut :</span> <StatusBadge status={selectedQuote.status} />
                </div>
              </div>

              {/* Objet */}
              {(selectedQuote.object || selectedQuote.label) && (
                <div>
                  <h4 className="font-medium mb-2">Objet</h4>
                  <p className="text-sm text-muted-foreground">{selectedQuote.object || selectedQuote.label}</p>
                </div>
              )}

              {/* Lignes du devis */}
              {selectedQuote.items && selectedQuote.items.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Lignes du devis</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Désignation</TableHead>
                        <TableHead className="text-right">Qté</TableHead>
                        <TableHead className="text-right">Prix unit.</TableHead>
                        <TableHead className="text-right">Total HT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedQuote.items.map((item: any, index: number) => {
                        const amounts = getLineAmount(item);
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: (item.designation || item.label || item.description || "-").replace(
                                    /<br\s*\/?>/gi,
                                    "<br/>",
                                  ),
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity || item.qty || 1} {item.unit || ""}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatAmount(amounts.unitPrice, selectedQuote.currency)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatAmount(amounts.total, selectedQuote.currency)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Totaux */}
              <div className="border-t pt-4">
                {(() => {
                  const totals = getQuoteTotal(selectedQuote);
                  return (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total HT</span>
                        <span>{formatAmount(totals.ht, selectedQuote.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">TVA</span>
                        <span>{formatAmount(totals.tva, selectedQuote.currency)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total TTC</span>
                        <span>{formatAmount(totals.ttc, selectedQuote.currency)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" asChild className="flex-1">
                  <a
                    href={`https://www.evoliz.io/quotes/${selectedQuote.quoteid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Voir dans Evoliz
                  </a>
                </Button>
              </div>

              {/* Debug du devis sélectionné */}
              {showDebug && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2 text-sm">Debug - Données brutes</h4>
                  <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-48">
                    {JSON.stringify(selectedQuote, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
