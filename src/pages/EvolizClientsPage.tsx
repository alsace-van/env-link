// ============================================
// PAGE CLIENTS EVOLIZ
// Synchro bidirectionnelle avec VPB
// Avec onglet Factures et Contacts
// VERSION: 2.3 - Fix bouton Retour onClick
// ============================================

import React, { useEffect, useState } from "react";
import { useEvolizConfig } from "@/hooks/useEvolizConfig";
import { useEvolizClients } from "@/hooks/useEvolizClients";
import { evolizApi } from "@/services/evolizService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  RefreshCw,
  Users,
  ExternalLink,
  Unlink,
  Settings,
  AlertCircle,
  Search,
  Download,
  MoreHorizontal,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Check,
  Receipt,
  Calendar,
  Euro,
  FileText,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { EvolizClient, EvolizInvoice, EvolizContactClient } from "@/types/evoliz.types";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Helper pour formater les montants
const formatAmount = (amount: number | undefined): string => {
  if (amount === undefined || amount === null) return "0,00 €";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
};

// Helper pour formater les dates
const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
};

// Helper pour le statut des factures
const getInvoiceStatusBadge = (status: string | undefined) => {
  const labels: Record<string, string> = {
    filled: "Brouillon",
    create: "Créée",
    sent: "Envoyée",
    inpayment: "En cours",
    paid: "Payée",
    match: "Lettrée",
    unpaid: "Impayée",
    nopaid: "Non payée",
  };
  const colors: Record<string, string> = {
    filled: "bg-gray-100 text-gray-700",
    create: "bg-blue-100 text-blue-700",
    sent: "bg-cyan-100 text-cyan-700",
    inpayment: "bg-orange-100 text-orange-700",
    paid: "bg-green-100 text-green-700",
    match: "bg-green-100 text-green-700",
    unpaid: "bg-red-100 text-red-700",
    nopaid: "bg-yellow-100 text-yellow-700",
  };
  const label = labels[status || ""] || status || "Inconnu";
  const colorClass = colors[status || ""] || "bg-gray-100 text-gray-700";
  return <Badge className={colorClass}>{label}</Badge>;
};

// Helper pour extraire le status string depuis l'objet invoice
const getInvoiceStatusString = (invoice: EvolizInvoice): string | undefined => {
  if (!invoice.status) return undefined;
  if (typeof invoice.status === "string") return invoice.status;
  return invoice.status.label;
};

export default function EvolizClientsPage() {
  const { isConfigured, isLoading: configLoading } = useEvolizConfig();
  const { clients, mappings, isLoading, fetchClients, getMappings, importClientFromEvoliz, unlinkClient } =
    useEvolizClients();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<EvolizClient | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [importingClientId, setImportingClientId] = useState<number | null>(null);

  // États pour les factures
  const [clientInvoices, setClientInvoices] = useState<EvolizInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // États pour les contacts
  const [clientContacts, setClientContacts] = useState<EvolizContactClient[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const [activeTab, setActiveTab] = useState("infos");

  // Charger au montage
  useEffect(() => {
    if (isConfigured && !configLoading) {
      fetchClients();
      getMappings();
    }
  }, [isConfigured, configLoading]);

  // Charger les données quand on sélectionne un client
  useEffect(() => {
    if (selectedClient && showDetailDialog) {
      loadClientContacts(selectedClient.clientid);
      loadClientInvoices(selectedClient.clientid);
    }
  }, [selectedClient, showDetailDialog]);

  // Charger les contacts d'un client
  const loadClientContacts = async (clientId: number) => {
    setLoadingContacts(true);
    setClientContacts([]);
    try {
      const response = await evolizApi.getClientContacts(clientId);
      setClientContacts(response.data || []);
    } catch (err) {
      console.error("Erreur chargement contacts:", err);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Charger les factures d'un client
  const loadClientInvoices = async (clientId: number) => {
    setLoadingInvoices(true);
    setClientInvoices([]);
    try {
      // Calculer les dates pour récupérer TOUTES les factures
      // date_min: 2015-01-01 (assez ancien pour tout couvrir)
      // date_max: aujourd'hui + 1 mois (pour inclure les factures futures éventuelles)
      const today = new Date();
      const dateMax = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const dateMaxStr = dateMax.toISOString().split("T")[0];

      // Charger toutes les factures du client avec période personnalisée
      const response = await evolizApi.getInvoices({
        clientid: clientId,
        status: "all",
        per_page: 100,
        period: "custom",
        date_min: "2015-01-01",
        date_max: dateMaxStr,
      });

      setClientInvoices(response.data || []);
    } catch (err) {
      console.error("Erreur chargement factures:", err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Obtenir l'email du contact principal (favori ou premier)
  const getPrimaryContactEmail = (): string | null => {
    if (clientContacts.length === 0) return null;
    const favorite = clientContacts.find((c) => c.favorite);
    if (favorite?.email) return favorite.email;
    const withEmail = clientContacts.find((c) => c.email);
    return withEmail?.email || null;
  };

  // Obtenir le contact principal
  const getPrimaryContact = (): EvolizContactClient | null => {
    if (clientContacts.length === 0) return null;
    return clientContacts.find((c) => c.favorite) || clientContacts[0];
  };

  // Filtrer les clients
  const filteredClients = clients.filter((client) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      client.name?.toLowerCase().includes(search) ||
      client.address?.town?.toLowerCase().includes(search) ||
      client.code?.toLowerCase().includes(search)
    );
  });

  // Vérifier si un client est lié
  const isClientLinked = (clientId: number) => {
    return mappings.some((m) => m.evoliz_client_id === clientId);
  };

  // Importer un client
  const handleImport = async (clientId: number) => {
    setImportingClientId(clientId);
    await importClientFromEvoliz(clientId);
    setImportingClientId(null);
  };

  // Ouvrir le PDF dans un nouvel onglet
  const openInvoicePdf = (invoice: EvolizInvoice) => {
    // Priorité : webdoc (lien public) > document_link > file (nécessite auth)
    const pdfUrl = invoice.webdoc || invoice.document_link || invoice.file;
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    } else {
      console.warn("Aucun lien PDF disponible pour cette facture", invoice.invoiceid);
    }
  };

  // Réinitialiser quand on ferme la modale
  const handleCloseDialog = (open: boolean) => {
    if (!open) {
      setActiveTab("infos");
      setClientInvoices([]);
      setClientContacts([]);
    }
    setShowDetailDialog(open);
  };

  // Si chargement de la config en cours
  if (configLoading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Chargement de la configuration Evoliz...</p>
        </div>
      </div>
    );
  }

  // Si pas configuré
  if (!isConfigured) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Evoliz n'est pas configuré. Configurez vos clés API pour accéder à vos clients.</span>
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

  const primaryContact = getPrimaryContact();
  const primaryEmail = getPrimaryContactEmail();

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Clients Evoliz
          </h1>
          <p className="text-muted-foreground">
            {clients.length} clients • {mappings.length} liés à VPB
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              fetchClients();
              getMappings();
            }}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Actualiser</span>
          </Button>
        </div>
      </div>

      {/* Recherche */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, code, ville..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table clients */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? "Aucun client trouvé" : "Aucun client dans Evoliz"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="hidden lg:table-cell">Ville</TableHead>
                  <TableHead>VPB</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => {
                  const isLinked = isClientLinked(client.clientid);
                  const isImporting = importingClientId === client.clientid;

                  return (
                    <TableRow
                      key={client.clientid}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedClient(client);
                        setShowDetailDialog(true);
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {client.type === "Professionnel" ? (
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <span className="font-medium">{client.name}</span>
                            {client.code && <span className="text-xs text-muted-foreground ml-2">({client.code})</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={client.type === "Professionnel" ? "default" : "secondary"}>{client.type}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {client.address?.town || "-"}
                      </TableCell>
                      <TableCell>
                        {isLinked ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <Check className="h-3 w-3 mr-1" />
                            Lié
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Non lié
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!isLinked ? (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleImport(client.clientid);
                                }}
                                disabled={isImporting}
                              >
                                {isImporting ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4 mr-2" />
                                )}
                                Importer dans VPB
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unlinkClient(client.clientid);
                                }}
                              >
                                <Unlink className="h-4 w-4 mr-2" />
                                Délier
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <a
                                href={`https://www.evoliz.com/clients/${client.clientid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Voir dans Evoliz
                              </a>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Détail Client avec Onglets */}
      <Dialog open={showDetailDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          {selectedClient ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedClient.type === "Professionnel" ? (
                    <Building2 className="h-5 w-5" />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                  {selectedClient.name}
                  {selectedClient.code && (
                    <span className="text-sm font-normal text-muted-foreground">({selectedClient.code})</span>
                  )}
                </DialogTitle>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant={selectedClient.type === "Professionnel" ? "default" : "secondary"}>
                    {selectedClient.type}
                  </Badge>
                  {isClientLinked(selectedClient.clientid) && (
                    <Badge className="bg-green-100 text-green-700">Lié à VPB</Badge>
                  )}
                </div>
              </DialogHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="infos" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Informations
                  </TabsTrigger>
                  <TabsTrigger value="factures" className="flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Factures
                    {clientInvoices.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                        {clientInvoices.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Onglet Informations */}
                <TabsContent value="infos" className="flex-1 overflow-auto mt-4">
                  <div className="space-y-6">
                    {/* Contact principal */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                        Contact {loadingContacts && <Loader2 className="h-3 w-3 inline animate-spin ml-1" />}
                      </h4>

                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {loadingContacts ? (
                          <span className="text-muted-foreground">Chargement...</span>
                        ) : primaryEmail ? (
                          <a href={`mailto:${primaryEmail}`} className="text-primary hover:underline">
                            {primaryEmail}
                          </a>
                        ) : (
                          <span className="text-muted-foreground italic">Aucun contact avec email</span>
                        )}
                      </div>

                      {primaryContact &&
                        (primaryContact.tel_primary || selectedClient.phone || selectedClient.mobile) && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{primaryContact.tel_primary || selectedClient.phone || selectedClient.mobile}</span>
                          </div>
                        )}

                      {selectedClient.address && (
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            {selectedClient.address.addr && <p>{selectedClient.address.addr}</p>}
                            <p>
                              {selectedClient.address.postcode} {selectedClient.address.town}
                            </p>
                            {selectedClient.address.country && (
                              <p className="text-muted-foreground">
                                {typeof selectedClient.address.country === "object"
                                  ? (selectedClient.address.country as any).label
                                  : selectedClient.address.country}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Liste des contacts */}
                    {clientContacts.length > 1 && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                          Tous les contacts ({clientContacts.length})
                        </h4>
                        <div className="space-y-2">
                          {clientContacts.map((contact) => (
                            <div
                              key={contact.contactid}
                              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                            >
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">
                                    {contact.firstname} {contact.lastname}
                                    {contact.favorite && (
                                      <Badge variant="secondary" className="ml-2 text-xs">
                                        Principal
                                      </Badge>
                                    )}
                                  </p>
                                  {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                                </div>
                              </div>
                              {contact.profil && (
                                <span className="text-xs text-muted-foreground">{contact.profil}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Infos pro */}
                    {selectedClient.type === "Professionnel" && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                          Informations légales
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {selectedClient.business_number && (
                            <>
                              <span className="text-muted-foreground">SIRET</span>
                              <span className="font-mono">{selectedClient.business_number}</span>
                            </>
                          )}
                          {selectedClient.vat_number && (
                            <>
                              <span className="text-muted-foreground">N° TVA</span>
                              <span className="font-mono">{selectedClient.vat_number}</span>
                            </>
                          )}
                          {selectedClient.legalform && (
                            <>
                              <span className="text-muted-foreground">Forme juridique</span>
                              <span>{selectedClient.legalform}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-4 border-t">
                      {isClientLinked(selectedClient.clientid) ? (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-700 flex items-center gap-1">
                            <Check className="h-4 w-4" />
                            Lié à un client VPB
                          </span>
                          <Button variant="outline" size="sm" onClick={() => unlinkClient(selectedClient.clientid)}>
                            <Unlink className="h-4 w-4 mr-1" />
                            Délier
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() => handleImport(selectedClient.clientid)}
                          disabled={importingClientId === selectedClient.clientid}
                        >
                          {importingClientId === selectedClient.clientid ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Importer dans VPB
                        </Button>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Onglet Factures */}
                <TabsContent value="factures" className="flex-1 overflow-auto mt-4">
                  {loadingInvoices ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : clientInvoices.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Receipt className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Aucune facture pour ce client</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {clientInvoices.map((invoice) => (
                          <div
                            key={invoice.invoiceid}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="h-8 w-8 text-muted-foreground" />
                              <div>
                                <p className="font-medium">
                                  {invoice.document_number || `Facture #${invoice.invoiceid}`}
                                </p>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDate(invoice.documentdate)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Euro className="h-3 w-3" />
                                    {formatAmount(invoice.total?.vat_include)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getInvoiceStatusBadge(getInvoiceStatusString(invoice))}
                              {(invoice.webdoc || invoice.file || invoice.document_link) && (
                                <Button variant="outline" size="sm" onClick={() => openInvoicePdf(invoice)}>
                                  <Eye className="h-4 w-4 mr-1" />
                                  PDF
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex justify-between sm:justify-between">
                <Button variant="ghost" onClick={() => handleCloseDialog(false)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href={`https://www.evoliz.com/clients/${selectedClient.clientid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Voir dans Evoliz
                  </a>
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground">Chargement...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
