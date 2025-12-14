// components/catalog/SuppliersManager.tsx
// Gestion des fournisseurs avec import/export Evoliz

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Store,
  Phone,
  Mail,
  Globe,
  MapPin,
  Building2,
  RefreshCw,
  Upload,
  Download,
  Loader2,
  Check,
  X,
  ExternalLink,
} from "lucide-react";

// Interface Supplier compatible Evoliz
interface Supplier {
  id: string;
  user_id: string;
  evoliz_supplier_id?: number;
  code?: string;
  name: string;
  legal_form?: string;
  business_number?: string;
  activity_number?: string;
  vat_number?: string;
  address_line1?: string;
  address_line2?: string;
  postcode?: string;
  city?: string;
  country_iso2?: string;
  country_label?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  email?: string;
  website?: string;
  bank_name?: string;
  bank_iban?: string;
  bank_bic?: string;
  default_payment_term_id?: number;
  default_payment_type_id?: number;
  comment?: string;
  enabled: boolean;
  categories?: string[];
  tags?: string[];
  created_at: string;
  updated_at: string;
  last_synced_at?: string;
}

const EMPTY_SUPPLIER: Partial<Supplier> = {
  name: "",
  code: "",
  legal_form: "",
  business_number: "",
  activity_number: "",
  vat_number: "",
  address_line1: "",
  address_line2: "",
  postcode: "",
  city: "",
  country_iso2: "FR",
  country_label: "France",
  phone: "",
  mobile: "",
  email: "",
  website: "",
  bank_name: "",
  bank_iban: "",
  bank_bic: "",
  comment: "",
  enabled: true,
  categories: [],
  tags: [],
};

export default function SuppliersManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Evoliz sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [evolizConnected, setEvolizConnected] = useState(false);

  // Charger les fournisseurs
  const loadSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase as any)
        .from("suppliers")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      // Mapper les données avec enabled par défaut à true si non défini
      const mappedData = (data || []).map((s: any) => ({
        ...s,
        enabled: s.enabled ?? true,
      }));
      setSuppliers(mappedData);
    } catch (error) {
      console.error("Erreur chargement fournisseurs:", error);
      toast.error("Erreur lors du chargement des fournisseurs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Vérifier la connexion Evoliz
  const checkEvolizConnection = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await (supabase as any)
        .from("user_integrations")
        .select("evoliz_company_id, evoliz_token_expires_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.evoliz_company_id) {
        const expiresAt = data.evoliz_token_expires_at ? new Date(data.evoliz_token_expires_at) : null;
        setEvolizConnected(expiresAt ? expiresAt > new Date() : false);
      }
    } catch (error) {
      console.error("Erreur vérification Evoliz:", error);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
    checkEvolizConnection();
  }, [loadSuppliers, checkEvolizConnection]);

  // Filtrer les fournisseurs
  useEffect(() => {
    let filtered = suppliers;

    // Filtre actif/inactif
    if (!showInactive) {
      filtered = filtered.filter((s) => s.enabled);
    }

    // Filtre recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.code?.toLowerCase().includes(query) ||
          s.city?.toLowerCase().includes(query) ||
          s.email?.toLowerCase().includes(query),
      );
    }

    setFilteredSuppliers(filtered);
  }, [suppliers, searchQuery, showInactive]);

  // Ouvrir le dialog pour créer/éditer
  const openDialog = (supplier?: Supplier) => {
    setEditingSupplier(supplier ? { ...supplier } : { ...EMPTY_SUPPLIER });
    setIsDialogOpen(true);
  };

  // Sauvegarder le fournisseur
  const handleSave = async () => {
    if (!editingSupplier?.name?.trim()) {
      toast.error("Le nom du fournisseur est obligatoire");
      return;
    }

    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      const supplierData = {
        ...editingSupplier,
        user_id: user.id,
        name: editingSupplier.name.trim(),
      };

      if (editingSupplier.id) {
        // Mise à jour
        const { error } = await (supabase as any).from("suppliers").update(supplierData).eq("id", editingSupplier.id);

        if (error) throw error;
        toast.success("Fournisseur mis à jour");
      } else {
        // Création
        const { error } = await (supabase as any).from("suppliers").insert(supplierData);

        if (error) throw error;
        toast.success("Fournisseur créé");
      }

      setIsDialogOpen(false);
      loadSuppliers();
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  // Supprimer le fournisseur
  const handleDelete = async () => {
    if (!supplierToDelete) return;

    try {
      const { error } = await (supabase as any).from("suppliers").delete().eq("id", supplierToDelete.id);

      if (error) throw error;
      toast.success("Fournisseur supprimé");
      setIsDeleteDialogOpen(false);
      loadSuppliers();
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast.error(error.message || "Erreur lors de la suppression");
    }
  };

  // Toggle actif/inactif
  const toggleEnabled = async (supplier: Supplier) => {
    try {
      const { error } = await (supabase as any)
        .from("suppliers")
        .update({ enabled: !supplier.enabled })
        .eq("id", supplier.id);

      if (error) throw error;
      loadSuppliers();
    } catch (error) {
      console.error("Erreur toggle:", error);
      toast.error("Erreur lors de la modification");
    }
  };

  // Import depuis Evoliz
  const importFromEvoliz = async () => {
    if (!evolizConnected) {
      toast.error("Veuillez d'abord connecter votre compte Evoliz");
      return;
    }

    setIsSyncing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      // Appeler la fonction edge pour importer les fournisseurs
      const { data, error } = await supabase.functions.invoke("evoliz-sync-suppliers", {
        body: { action: "import", userId: user.id },
      });

      if (error) throw error;

      toast.success(`${data.imported || 0} fournisseurs importés depuis Evoliz`);
      loadSuppliers();
    } catch (error: any) {
      console.error("Erreur import Evoliz:", error);
      toast.error(error.message || "Erreur lors de l'import Evoliz");
    } finally {
      setIsSyncing(false);
    }
  };

  // Export vers Evoliz
  const exportToEvoliz = async () => {
    if (!evolizConnected) {
      toast.error("Veuillez d'abord connecter votre compte Evoliz");
      return;
    }

    setIsSyncing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      // Appeler la fonction edge pour exporter les fournisseurs
      const { data, error } = await supabase.functions.invoke("evoliz-sync-suppliers", {
        body: { action: "export", userId: user.id },
      });

      if (error) throw error;

      toast.success(`${data.exported || 0} fournisseurs exportés vers Evoliz`);
      loadSuppliers();
    } catch (error: any) {
      console.error("Erreur export Evoliz:", error);
      toast.error(error.message || "Erreur lors de l'export Evoliz");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header avec actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un fournisseur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="show-inactive" className="text-sm text-muted-foreground">
              Afficher inactifs
            </Label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Boutons Evoliz */}
          <div className="flex items-center gap-2 mr-2">
            {evolizConnected ? (
              <Badge variant="outline" className="text-green-600 border-green-300">
                <Check className="h-3 w-3 mr-1" />
                Evoliz connecté
              </Badge>
            ) : (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                <X className="h-3 w-3 mr-1" />
                Evoliz non connecté
              </Badge>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={importFromEvoliz} disabled={isSyncing || !evolizConnected}>
            {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Importer Evoliz
          </Button>

          <Button variant="outline" size="sm" onClick={exportToEvoliz} disabled={isSyncing || !evolizConnected}>
            {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Exporter Evoliz
          </Button>

          <Button onClick={() => openDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau fournisseur
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total fournisseurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{suppliers.filter((s) => s.enabled).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Synchronisés Evoliz</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {suppliers.filter((s) => s.evoliz_supplier_id).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des fournisseurs */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Store className="h-12 w-12 mb-4" />
              <p>Aucun fournisseur trouvé</p>
              <Button variant="outline" className="mt-4" onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un fournisseur
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Evoliz</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id} className={!supplier.enabled ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="font-medium">{supplier.name}</div>
                      {supplier.legal_form && (
                        <div className="text-xs text-muted-foreground">{supplier.legal_form}</div>
                      )}
                    </TableCell>
                    <TableCell>{supplier.code && <Badge variant="outline">{supplier.code}</Badge>}</TableCell>
                    <TableCell>
                      {supplier.city && (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" />
                          {supplier.city}
                          {supplier.postcode && <span className="text-muted-foreground">({supplier.postcode})</span>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {supplier.phone && (
                          <div className="flex items-center gap-1 text-xs">
                            <Phone className="h-3 w-3" />
                            {supplier.phone}
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center gap-1 text-xs">
                            <Mail className="h-3 w-3" />
                            {supplier.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {supplier.evoliz_supplier_id ? (
                        <Badge className="bg-blue-100 text-blue-700">#{supplier.evoliz_supplier_id}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Non lié</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch checked={supplier.enabled} onCheckedChange={() => toggleEnabled(supplier)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {supplier.website && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(supplier.website, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(supplier)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                          onClick={() => {
                            setSupplierToDelete(supplier);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog création/édition */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSupplier?.id ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="address">Adresse</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="bank">Banque</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom *</Label>
                  <Input
                    id="name"
                    value={editingSupplier?.name || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                    placeholder="Nom du fournisseur"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={editingSupplier?.code || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, code: e.target.value })}
                    placeholder="Ex: F001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="legal_form">Forme juridique</Label>
                  <Input
                    id="legal_form"
                    value={editingSupplier?.legal_form || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, legal_form: e.target.value })}
                    placeholder="Ex: SAS, SARL..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business_number">SIRET</Label>
                  <Input
                    id="business_number"
                    value={editingSupplier?.business_number || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, business_number: e.target.value })}
                    placeholder="123 456 789 12345"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="activity_number">Code APE/NAF</Label>
                  <Input
                    id="activity_number"
                    value={editingSupplier?.activity_number || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, activity_number: e.target.value })}
                    placeholder="Ex: 4520A"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat_number">N° TVA intracommunautaire</Label>
                  <Input
                    id="vat_number"
                    value={editingSupplier?.vat_number || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, vat_number: e.target.value })}
                    placeholder="FR20123456789"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comment">Commentaire</Label>
                <Textarea
                  id="comment"
                  value={editingSupplier?.comment || ""}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, comment: e.target.value })}
                  placeholder="Notes sur ce fournisseur..."
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="address" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="address_line1">Adresse ligne 1</Label>
                <Input
                  id="address_line1"
                  value={editingSupplier?.address_line1 || ""}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, address_line1: e.target.value })}
                  placeholder="Numéro et rue"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_line2">Adresse ligne 2</Label>
                <Input
                  id="address_line2"
                  value={editingSupplier?.address_line2 || ""}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, address_line2: e.target.value })}
                  placeholder="Complément d'adresse"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postcode">Code postal</Label>
                  <Input
                    id="postcode"
                    value={editingSupplier?.postcode || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, postcode: e.target.value })}
                    placeholder="67000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    value={editingSupplier?.city || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, city: e.target.value })}
                    placeholder="Strasbourg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country_iso2">Pays (ISO2)</Label>
                  <Input
                    id="country_iso2"
                    value={editingSupplier?.country_iso2 || "FR"}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, country_iso2: e.target.value.toUpperCase() })
                    }
                    placeholder="FR"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country_label">Pays</Label>
                  <Input
                    id="country_label"
                    value={editingSupplier?.country_label || "France"}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, country_label: e.target.value })}
                    placeholder="France"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={editingSupplier?.phone || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                    placeholder="01 23 45 67 89"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    value={editingSupplier?.mobile || ""}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, mobile: e.target.value })}
                    placeholder="06 12 34 56 78"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editingSupplier?.email || ""}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                  placeholder="contact@fournisseur.fr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Site web</Label>
                <Input
                  id="website"
                  value={editingSupplier?.website || ""}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, website: e.target.value })}
                  placeholder="https://www.fournisseur.fr"
                />
              </div>
            </TabsContent>

            <TabsContent value="bank" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="bank_name">Nom de la banque</Label>
                <Input
                  id="bank_name"
                  value={editingSupplier?.bank_name || ""}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, bank_name: e.target.value })}
                  placeholder="Ex: Crédit Mutuel"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank_iban">IBAN</Label>
                <Input
                  id="bank_iban"
                  value={editingSupplier?.bank_iban || ""}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, bank_iban: e.target.value })}
                  placeholder="FR76 1234 5678 9012 3456 7890 123"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank_bic">BIC</Label>
                <Input
                  id="bank_bic"
                  value={editingSupplier?.bank_bic || ""}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, bank_bic: e.target.value })}
                  placeholder="CMCIFRPP"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSupplier?.id ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation suppression */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le fournisseur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer "{supplierToDelete?.name}" ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
