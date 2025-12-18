// ============================================
// EvolizClientsDialog.tsx
// Modale pour consulter les clients Evoliz sans changer de page
// VERSION: 1.3 - Fix types TypeScript (type client, contacts, mappings)
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { EvolizClient, EvolizInvoice, EvolizContactClient } from "@/types/evoliz.types";
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

interface EvolizClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EvolizClientsDialog({ open, onOpenChange }: EvolizClientsDialogProps) {
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

  // État pour le PDF
  const [viewingInvoice, setViewingInvoice] = useState<EvolizInvoice | null>(null);
  const [invoicePdfUrl, setInvoicePdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Charger les données quand la modale s'ouvre
  useEffect(() => {
    if (open && isConfigured) {
      fetchClients();
      getMappings();
    }
  }, [open, isConfigured]);

  // Charger les factures et contacts quand on sélectionne un client
  useEffect(() => {
    if (selectedClient && showDetailDialog) {
      loadClientInvoices(selectedClient.clientid);
      loadClientContacts(selectedClient.clientid);
    }
  }, [selectedClient, showDetailDialog]);

  const loadClientInvoices = async (clientId: number) => {
    setLoadingInvoices(true);
    try {
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setMonth(futureDate.getMonth() + 1);

      const dateMax = futureDate.toISOString().split("T")[0];

      const response = await evolizApi.get(
        `/invoices?clientid=${clientId}&period=custom&date_min=2015-01-01&date_max=${dateMax}&per_page=50`,
      );
      if (response && Array.isArray(response)) {
        setClientInvoices(response);
      } else if (response && response.data && Array.isArray(response.data)) {
        setClientInvoices(response.data);
      } else {
        setClientInvoices([]);
      }
    } catch (error) {
      console.error("Erreur chargement factures:", error);
      setClientInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const loadClientContacts = async (clientId: number) => {
    setLoadingContacts(true);
    try {
      const response = await evolizApi.get(`/contacts-clients?clientid=${clientId}`);
      if (response && Array.isArray(response)) {
        setClientContacts(response);
      } else if (response && response.data && Array.isArray(response.data)) {
        setClientContacts(response.data);
      } else {
        setClientContacts([]);
      }
    } catch (error) {
      console.error("Erreur chargement contacts:", error);
      setClientContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const loadInvoicePdf = async (invoice: EvolizInvoice) => {
    setViewingInvoice(invoice);
    setLoadingPdf(true);
    setInvoicePdfUrl(null);

    try {
      const response = await evolizApi.get(`/invoices/${invoice.invoiceid}/document`);

      if (response && response.webdoc) {
        setInvoicePdfUrl(response.webdoc);
      } else if (response && response.file) {
        const base64 = response.file;
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setInvoicePdfUrl(url);
      }
    } catch (error) {
      console.error("Erreur chargement PDF:", error);
    } finally {
      setLoadingPdf(false);
    }
  };

  // Filtrage
  const filteredClients = clients.filter((client) => {
    const term = searchTerm.toLowerCase();
    return (
      client.name?.toLowerCase().includes(term) ||
      client.code?.toLowerCase().includes(term) ||
      client.address?.town?.toLowerCase().includes(term) ||
      client.address?.postcode?.includes(term)
    );
  });

  // Vérifier si un client est lié
  const isClientLinked = (clientId: number): boolean => {
    return mappings.some((m) => m.evoliz_client_id === clientId);
  };

  const handleImport = async (client: EvolizClient) => {
    setImportingClientId(client.clientid);
    try {
      await importClientFromEvoliz(client.clientid);
    } finally {
      setImportingClientId(null);
    }
  };

  const handleUnlink = async (clientId: number) => {
    const mapping = mappings.find((m) => m.evoliz_client_id === clientId);
    if (mapping) {
      await unlinkClient(clientId);
    }
  };

  const handleOpenDetail = (client: EvolizClient) => {
    setSelectedClient(client);
    setShowDetailDialog(true);
    setClientInvoices([]);
    setClientContacts([]);
    setViewingInvoice(null);
    setInvoicePdfUrl(null);
  };

  const handleCloseDetailDialog = () => {
    setShowDetailDialog(false);
    setSelectedClient(null);
    setViewingInvoice(null);
    if (invoicePdfUrl && invoicePdfUrl.startsWith("blob:")) {
      URL.revokeObjectURL(invoicePdfUrl);
    }
    setInvoicePdfUrl(null);
  };

  // Formater l'adresse pays
  const formatCountry = (country: any): string => {
    if (!country) return "";
    if (typeof country === "string") return country;
    if (typeof country === "object") {
      return country.label || country.iso2 || country.iso3 || "";
    }
    return "";
  };

  if (configLoading) {
    return null;
  }

  if (!isConfigured) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clients Evoliz
            </DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Evoliz n'est pas configuré. Veuillez d'abord configurer vos identifiants dans les paramètres.
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      {/* Dialog principal - Liste des clients */}
      <Dialog open={open && !showDetailDialog} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clients Evoliz
              <Badge variant="secondary" className="ml-2">
                {clients.length} clients • {mappings.length} liés
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, code, ville..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                fetchClients();
                getMappings();
              }}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(85vh - 180px)" }}>
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
                    <TableHead className="text-center">Lié</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => {
                    const linked = isClientLinked(client.clientid);
                    return (
                      <TableRow
                        key={client.clientid}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleOpenDetail(client)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {client.type === "Professionnel" ? (
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <User className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div>
                              <div className="font-medium">{client.name}</div>
                              {client.code && <div className="text-xs text-muted-foreground">{client.code}</div>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline">
                            {client.type === "Professionnel" ? "Entreprise" : "Particulier"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {client.address?.town && (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              {client.address.town}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {linked ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenDetail(client)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Voir détails
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {linked ? (
                                <DropdownMenuItem
                                  onClick={() => handleUnlink(client.clientid)}
                                  className="text-red-600"
                                >
                                  <Unlink className="h-4 w-4 mr-2" />
                                  Délier de VPB
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleImport(client)}
                                  disabled={importingClientId === client.clientid}
                                >
                                  {importingClientId === client.clientid ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Download className="h-4 w-4 mr-2" />
                                  )}
                                  Importer dans VPB
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <a
                                  href={`https://www.evoliz.com/clients/${client.clientid}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
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
          </div>

          <DialogFooter className="mt-4 flex-shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog détail client */}
      <Dialog open={showDetailDialog} onOpenChange={(open) => !open && handleCloseDetailDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
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
                  {isClientLinked(selectedClient.clientid) && (
                    <Badge className="bg-green-100 text-green-700 ml-2">Lié à VPB</Badge>
                  )}
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="infos" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="infos">Informations</TabsTrigger>
                  <TabsTrigger value="factures" className="flex items-center gap-1">
                    <Receipt className="h-4 w-4" />
                    Factures ({clientInvoices.length})
                  </TabsTrigger>
                  <TabsTrigger value="contacts" className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    Contacts ({clientContacts.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="infos" className="flex-1 overflow-auto mt-4">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Coordonnées */}
                    <Card>
                      <CardContent className="pt-4 space-y-3">
                        <h3 className="font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Coordonnées
                        </h3>
                        {selectedClient.address && (
                          <div className="text-sm space-y-1">
                            {selectedClient.address.addr && <p>{selectedClient.address.addr}</p>}
                            {(selectedClient.address.postcode || selectedClient.address.town) && (
                              <p>
                                {selectedClient.address.postcode} {selectedClient.address.town}
                              </p>
                            )}
                            {selectedClient.address.country && <p>{formatCountry(selectedClient.address.country)}</p>}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Informations légales */}
                    <Card>
                      <CardContent className="pt-4 space-y-3">
                        <h3 className="font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Informations légales
                        </h3>
                        <div className="text-sm space-y-2">
                          {selectedClient.code && (
                            <p>
                              <span className="text-muted-foreground">Code:</span> {selectedClient.code}
                            </p>
                          )}
                          {selectedClient.business_number && (
                            <p>
                              <span className="text-muted-foreground">SIRET:</span> {selectedClient.business_number}
                            </p>
                          )}
                          {selectedClient.vat_number && (
                            <p>
                              <span className="text-muted-foreground">TVA:</span> {selectedClient.vat_number}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="factures" className="flex-1 overflow-hidden mt-4">
                  {viewingInvoice ? (
                    <div className="h-full flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <Button variant="ghost" size="sm" onClick={() => setViewingInvoice(null)}>
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Retour aux factures
                        </Button>
                        <span className="text-sm font-medium">{viewingInvoice.document_number}</span>
                      </div>
                      {loadingPdf ? (
                        <div className="flex-1 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : invoicePdfUrl ? (
                        <iframe src={invoicePdfUrl} className="flex-1 w-full border rounded" title="Facture PDF" />
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                          PDF non disponible
                        </div>
                      )}
                    </div>
                  ) : loadingInvoices ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : clientInvoices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Aucune facture</div>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Numéro</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Montant TTC</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientInvoices.map((invoice) => (
                            <TableRow key={invoice.invoiceid}>
                              <TableCell className="font-medium">{invoice.document_number}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(invoice.documentdate)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Euro className="h-3 w-3" />
                                  {formatAmount(invoice.total?.vat_include)}
                                </div>
                              </TableCell>
                              <TableCell>{getInvoiceStatusBadge(getInvoiceStatusString(invoice))}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => loadInvoicePdf(invoice)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="contacts" className="flex-1 overflow-hidden mt-4">
                  {loadingContacts ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : clientContacts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Aucun contact enregistré</div>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {clientContacts.map((contact) => (
                          <Card key={contact.contactid}>
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium">
                                    {contact.civility} {contact.firstname} {contact.lastname}
                                  </p>
                                  {contact.profil && <p className="text-sm text-muted-foreground">{contact.profil}</p>}
                                </div>
                                {contact.favorite && <Badge variant="secondary">Principal</Badge>}
                              </div>
                              <div className="mt-2 space-y-1 text-sm">
                                {contact.email && (
                                  <p className="flex items-center gap-2">
                                    <Mail className="h-3 w-3" />
                                    <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                                      {contact.email}
                                    </a>
                                  </p>
                                )}
                                {contact.tel_primary && (
                                  <p className="flex items-center gap-2">
                                    <Phone className="h-3 w-3" />
                                    {contact.tel_primary}
                                  </p>
                                )}
                                {contact.tel_secondary && (
                                  <p className="flex items-center gap-2">
                                    <Phone className="h-3 w-3" />
                                    {contact.tel_secondary}
                                  </p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex justify-between sm:justify-between mt-4">
                <Button variant="ghost" onClick={handleCloseDetailDialog}>
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
    </>
  );
}

export default EvolizClientsDialog;
