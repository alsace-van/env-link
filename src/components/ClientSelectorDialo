// ============================================
// COMPOSANT: ClientSelectorDialog
// Permet de sélectionner un client existant ou d'en créer un nouveau
// Compatible avec les critères Evoliz (type, entreprise, etc.)
// VERSION: 1.0
// ============================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  UserPlus,
  Building2,
  User,
  Check,
  Loader2,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

export interface VPBClient {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name?: string | null;
  client_type?: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  siret?: string | null;
  vat_number?: string | null;
  evoliz_client_id?: number | null;
  created_at: string | null;
}

interface ClientSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientSelected: (client: VPBClient) => void;
  currentClientId?: string | null;
}

export function ClientSelectorDialog({
  open,
  onOpenChange,
  onClientSelected,
  currentClientId,
}: ClientSelectorDialogProps) {
  const [activeTab, setActiveTab] = useState<"select" | "create">("select");
  const [clients, setClients] = useState<VPBClient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(currentClientId || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Formulaire nouveau client
  const [clientType, setClientType] = useState<"particulier" | "professionnel">("particulier");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phone: "",
    address: "",
    postalCode: "",
    city: "",
    country: "France",
    siret: "",
    vatNumber: "",
  });

  // Charger les clients
  const loadClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClients((data || []) as VPBClient[]);
    } catch (err) {
      console.error("Erreur chargement clients:", err);
      toast.error("Erreur lors du chargement des clients");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadClients();
      setSelectedClientId(currentClientId || null);
    }
  }, [open, loadClients, currentClientId]);

  // Filtrer les clients
  const filteredClients = clients.filter((client) => {
    const search = searchTerm.toLowerCase();
    const fullName = `${client.first_name || ""} ${client.last_name || ""}`.toLowerCase();
    const company = (client.company_name || "").toLowerCase();
    const email = (client.email || "").toLowerCase();
    const city = (client.city || "").toLowerCase();

    return (
      fullName.includes(search) ||
      company.includes(search) ||
      email.includes(search) ||
      city.includes(search)
    );
  });

  // Obtenir le nom complet du client
  const getClientDisplayName = (client: VPBClient) => {
    if (client.client_type === "professionnel" && client.company_name) {
      return client.company_name;
    }
    return `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Client sans nom";
  };

  // Créer un nouveau client
  const handleCreateClient = async () => {
    // Validation
    if (clientType === "particulier" && !formData.firstName && !formData.lastName) {
      toast.error("Veuillez renseigner au moins le prénom ou le nom");
      return;
    }
    if (clientType === "professionnel" && !formData.companyName) {
      toast.error("Veuillez renseigner le nom de l'entreprise");
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          first_name: formData.firstName || null,
          last_name: formData.lastName || null,
          company_name: clientType === "professionnel" ? formData.companyName : null,
          client_type: clientType,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          postal_code: formData.postalCode || null,
          city: formData.city || null,
          country: formData.country || "France",
          siret: clientType === "professionnel" ? formData.siret : null,
          vat_number: clientType === "professionnel" ? formData.vatNumber : null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Client créé avec succès");
      onClientSelected(data as VPBClient);
      onOpenChange(false);

      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        companyName: "",
        email: "",
        phone: "",
        address: "",
        postalCode: "",
        city: "",
        country: "France",
        siret: "",
        vatNumber: "",
      });
    } catch (err) {
      console.error("Erreur création client:", err);
      toast.error("Erreur lors de la création du client");
    } finally {
      setIsSaving(false);
    }
  };

  // Sélectionner un client existant
  const handleSelectExisting = () => {
    const selected = clients.find((c) => c.id === selectedClientId);
    if (selected) {
      onClientSelected(selected);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Associer un client au projet
          </DialogTitle>
          <DialogDescription>
            Sélectionnez un client existant ou créez-en un nouveau
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "select" | "create")} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Client existant
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Nouveau client
            </TabsTrigger>
          </TabsList>

          {/* Onglet Sélection */}
          <TabsContent value="select" className="flex-1 flex flex-col min-h-0 mt-4">
            {/* Recherche */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, entreprise, email, ville..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Liste des clients */}
            <ScrollArea className="flex-1 border rounded-lg">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>{searchTerm ? "Aucun client trouvé" : "Aucun client enregistré"}</p>
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={() => setActiveTab("create")}
                  >
                    Créer un nouveau client
                  </Button>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredClients.map((client) => (
                    <div
                      key={client.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedClientId === client.id
                          ? "bg-primary/10 border border-primary"
                          : "hover:bg-muted/50 border border-transparent"
                      }`}
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          client.client_type === "professionnel" 
                            ? "bg-blue-100 text-blue-700" 
                            : "bg-gray-100 text-gray-700"
                        }`}>
                          {client.client_type === "professionnel" ? (
                            <Building2 className="h-4 w-4" />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{getClientDisplayName(client)}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {client.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {client.email}
                              </span>
                            )}
                            {client.city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {client.city}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {client.evoliz_client_id && (
                          <Badge variant="outline" className="text-xs">Evoliz</Badge>
                        )}
                        {selectedClientId === client.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleSelectExisting} 
                disabled={!selectedClientId}
              >
                <Check className="h-4 w-4 mr-2" />
                Sélectionner
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* Onglet Création */}
          <TabsContent value="create" className="flex-1 overflow-auto mt-4">
            <div className="space-y-6">
              {/* Type de client */}
              <div className="space-y-3">
                <Label>Type de client</Label>
                <RadioGroup
                  value={clientType}
                  onValueChange={(v) => setClientType(v as "particulier" | "professionnel")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="particulier" id="particulier" />
                    <Label htmlFor="particulier" className="flex items-center gap-2 cursor-pointer">
                      <User className="h-4 w-4" />
                      Particulier
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="professionnel" id="professionnel" />
                    <Label htmlFor="professionnel" className="flex items-center gap-2 cursor-pointer">
                      <Building2 className="h-4 w-4" />
                      Professionnel
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Champs entreprise (si professionnel) */}
              {clientType === "professionnel" && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="companyName">Nom de l'entreprise *</Label>
                      <Input
                        id="companyName"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        placeholder="Nom de l'entreprise"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="siret">SIRET</Label>
                        <Input
                          id="siret"
                          value={formData.siret}
                          onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                          placeholder="123 456 789 00001"
                        />
                      </div>
                      <div>
                        <Label htmlFor="vatNumber">N° TVA</Label>
                        <Input
                          id="vatNumber"
                          value={formData.vatNumber}
                          onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                          placeholder="FR12345678901"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Identité */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  {clientType === "professionnel" ? "Contact principal" : "Identité"}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Prénom {clientType === "particulier" && "*"}</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="Prénom"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Nom {clientType === "particulier" && "*"}</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Nom"
                    />
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Contact
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@exemple.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="06 12 34 56 78"
                    />
                  </div>
                </div>
              </div>

              {/* Adresse */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Adresse
                </h4>
                <div>
                  <Label htmlFor="address">Adresse</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Numéro et nom de rue"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="postalCode">Code postal</Label>
                    <Input
                      id="postalCode"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="75001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Paris"
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Pays</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder="France"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreateClient} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Créer et associer
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
