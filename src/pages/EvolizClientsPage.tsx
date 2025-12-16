// ============================================
// PAGE CLIENTS EVOLIZ
// Synchro bidirectionnelle avec VPB
// ============================================

import React, { useEffect, useState } from "react";
import { useEvolizConfig } from "@/hooks/useEvolizConfig";
import { useEvolizClients } from "@/hooks/useEvolizClients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Link2,
  Unlink,
  Settings,
  AlertCircle,
  Search,
  Download,
  Upload,
  MoreHorizontal,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Check,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { EvolizClient } from "@/types/evoliz.types";
import { Link } from "react-router-dom";

export default function EvolizClientsPage() {
  const { isConfigured, isLoading: configLoading } = useEvolizConfig();
  const {
    clients,
    mappings,
    isLoading,
    isSyncing,
    error,
    fetchClients,
    getMappings,
    importClientFromEvoliz,
    unlinkClient,
  } = useEvolizClients();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<EvolizClient | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [importingClientId, setImportingClientId] = useState<number | null>(null);

  // Charger au montage
  useEffect(() => {
    if (isConfigured && !configLoading) {
      fetchClients();
      getMappings();
    }
  }, [isConfigured, configLoading]);

  // Filtrer les clients
  const filteredClients = clients.filter((client) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      client.name?.toLowerCase().includes(search) ||
      client.email?.toLowerCase().includes(search) ||
      client.address?.town?.toLowerCase().includes(search)
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
              placeholder="Rechercher par nom, email, ville..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
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

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{clients.length}</div>
            <div className="text-sm text-muted-foreground">Clients Evoliz</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{mappings.length}</div>
            <div className="text-sm text-muted-foreground">Liés à VPB</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{clients.filter((c) => c.type === "Professionnel").length}</div>
            <div className="text-sm text-muted-foreground">Professionnels</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{clients.filter((c) => c.type === "Particulier").length}</div>
            <div className="text-sm text-muted-foreground">Particuliers</div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau des clients */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun client trouvé</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>VPB</TableHead>
                  <TableHead className="w-12"></TableHead>
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
                          <span className="font-medium">{client.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={client.type === "Professionnel" ? "default" : "secondary"}>{client.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{client.email || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{client.address?.town || "-"}</TableCell>
                      <TableCell>
                        {isLinked ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
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

      {/* Dialog Détail Client */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
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
                </DialogTitle>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant={selectedClient.type === "Professionnel" ? "default" : "secondary"}>
                    {selectedClient.type}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* Contact */}
                <div className="space-y-2">
                  {selectedClient.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${selectedClient.email}`} className="text-primary hover:underline">
                        {selectedClient.email}
                      </a>
                    </div>
                  )}
                  {(selectedClient.phone || selectedClient.mobile) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedClient.phone || selectedClient.mobile}</span>
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

                {/* Infos pro */}
                {selectedClient.type === "Professionnel" && (
                  <div className="border-t pt-4 space-y-2">
                    {selectedClient.siret && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">SIRET</span>
                        <span className="font-mono">{selectedClient.siret}</span>
                      </div>
                    )}
                    {selectedClient.vat_number && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">N° TVA</span>
                        <span className="font-mono">{selectedClient.vat_number}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Statut liaison */}
                <div className="border-t pt-4">
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

              <DialogFooter>
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
