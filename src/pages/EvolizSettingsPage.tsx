// ============================================
// PAGE DEVIS EVOLIZ
// Liste, import et gestion des devis
// ============================================

import React, { useEffect, useState } from "react";
import { useEvolizConfig } from "@/hooks/useEvolizConfig";
import { useEvolizQuotes } from "@/hooks/useEvolizQuotes";
import { useEvolizClients } from "@/hooks/useEvolizClients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2,
  RefreshCw,
  FileText,
  ExternalLink,
  Link2,
  Eye,
  Settings,
  AlertCircle,
  Search,
  Download,
  Send,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatEvolizAmount, formatEvolizDate } from "@/services/evolizService";
import type {
  EvolizQuote,
  EvolizQuoteStatus,
  EVOLIZ_QUOTE_STATUS_LABELS,
  EVOLIZ_QUOTE_STATUS_COLORS,
} from "@/types/evoliz.types";
import { Link } from "react-router-dom";

const STATUS_LABELS: Record<EvolizQuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  refused: "Refusé",
  invoiced: "Facturé",
};

const STATUS_VARIANTS: Record<EvolizQuoteStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "default",
  accepted: "default",
  refused: "destructive",
  invoiced: "outline",
};

export default function EvolizQuotesPage() {
  const { isConfigured, isLoading: configLoading } = useEvolizConfig();
  const { quotes, isLoading, isSyncing, error, fetchQuotes, syncQuotesToCache, fetchQuote } = useEvolizQuotes();
  const { clients, fetchClients } = useEvolizClients();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<EvolizQuote | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Charger les devis au montage
  useEffect(() => {
    if (isConfigured && !configLoading) {
      fetchQuotes();
      fetchClients();
    }
  }, [isConfigured, configLoading]);

  // Filtrer les devis
  const filteredQuotes = quotes.filter((quote) => {
    const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
    const matchesSearch =
      !searchTerm ||
      quote.documentid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.object?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Ouvrir le détail d'un devis
  const handleViewQuote = async (quote: EvolizQuote) => {
    // Charger les détails complets si nécessaire
    const fullQuote = await fetchQuote(quote.quoteid);
    setSelectedQuote(fullQuote || quote);
    setShowDetailDialog(true);
  };

  // Si pas configuré
  if (!configLoading && !isConfigured) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Evoliz n'est pas configuré. Configurez vos clés API pour accéder à vos devis.</span>
            <Button asChild size="sm" variant="outline">
              <Link to="/settings/evoliz">
                <Settings className="h-4 w-4 mr-2" />
                Configurer
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Devis Evoliz
          </h1>
          <p className="text-muted-foreground">{quotes.length} devis trouvés</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchQuotes()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Actualiser</span>
          </Button>
          <Button onClick={() => syncQuotesToCache()} disabled={isSyncing || quotes.length === 0}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Synchroniser</span>
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par n°, client, objet..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
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

      {/* Tableau des devis */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun devis trouvé</p>
              {statusFilter !== "all" && (
                <Button variant="link" onClick={() => setStatusFilter("all")} className="mt-2">
                  Voir tous les devis
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Devis</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Objet</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((quote) => (
                  <TableRow
                    key={quote.quoteid}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewQuote(quote)}
                  >
                    <TableCell className="font-mono font-medium">{quote.documentid}</TableCell>
                    <TableCell>{quote.client?.name || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{quote.object || quote.label || "-"}</TableCell>
                    <TableCell>{formatEvolizDate(quote.documentdate)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatEvolizAmount(quote.total.totalttc, quote.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[quote.status] || "secondary"}>
                        {STATUS_LABELS[quote.status] || quote.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewQuote(quote);
                        }}
                      >
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

      {/* Dialog Détail Devis */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedQuote && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Devis {selectedQuote.documentid}
                </DialogTitle>
                <DialogDescription>{selectedQuote.object || selectedQuote.label}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Infos générales */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="font-medium">{selectedQuote.client?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Statut</p>
                    <Badge variant={STATUS_VARIANTS[selectedQuote.status]}>{STATUS_LABELS[selectedQuote.status]}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date du devis</p>
                    <p className="font-medium">{formatEvolizDate(selectedQuote.documentdate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Validité</p>
                    <p className="font-medium">
                      {selectedQuote.duedate ? formatEvolizDate(selectedQuote.duedate) : "-"}
                    </p>
                  </div>
                </div>

                {/* Lignes du devis */}
                {selectedQuote.items && selectedQuote.items.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Lignes du devis</p>
                    <div className="border rounded-lg overflow-hidden">
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
                          {selectedQuote.items.map((item, index) => (
                            <TableRow key={item.itemid || index}>
                              <TableCell>{item.designation}</TableCell>
                              <TableCell className="text-right">
                                {item.quantity} {item.unit || ""}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatEvolizAmount(item.unit_price_vat_exclude)}
                              </TableCell>
                              <TableCell className="text-right">{formatEvolizAmount(item.total_vat_exclude)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Totaux */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total HT</span>
                    <span>{formatEvolizAmount(selectedQuote.total.totalht)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TVA</span>
                    <span>{formatEvolizAmount(selectedQuote.total.totaltax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total TTC</span>
                    <span>{formatEvolizAmount(selectedQuote.total.totalttc)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" asChild>
                    <a
                      href={`https://www.evoliz.com/devis/${selectedQuote.quoteid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Voir dans Evoliz
                    </a>
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Link2 className="h-4 w-4 mr-2" />
                    Lier à un projet
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
