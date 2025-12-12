// ============================================
// EXPORT EN LOT DES FACTURES VERS EVOLIZ
// Comparaison fournisseurs + Validation manuelle + Auto-next
// ============================================

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Building2,
  Plus,
  ArrowRight,
  FileText,
  Send,
  X,
  ChevronRight,
  RefreshCw,
  Check,
  MapPin,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { evolizApi, initializeEvolizApi } from "@/services/evolizService";
import { useEvolizConfig } from "@/hooks/useEvolizConfig";
import type { EvolizSupplier, EvolizPurchaseClassification } from "@/types/evoliz.types";

// Types
interface InvoiceToExport {
  id: string;
  supplier_name: string | null;
  supplier_siret: string | null;
  supplier_tva: string | null;
  supplier_address?: {
    addr?: string;
    postcode?: string;
    town?: string;
    country_iso2?: string;
  } | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total_ht: number | null;
  total_ttc: number | null;
  tva_amount: number | null;
  tva_rate: number | null;
  description: string | null;
  file_path: string | null;
  evoliz_status: string | null;
}

interface SupplierMatch {
  supplier: EvolizSupplier;
  matchType: "exact" | "siret" | "tva" | "partial";
  matchScore: number;
}

interface InvoiceBatchExportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: InvoiceToExport[];
  onExportComplete?: () => void;
}

export function InvoiceBatchExport({
  open,
  onOpenChange,
  invoices,
  onExportComplete,
}: InvoiceBatchExportProps) {
  const { isConfigured, credentials } = useEvolizConfig();

  // État global
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exportedCount, setExportedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fournisseurs Evoliz
  const [evolizSuppliers, setEvolizSuppliers] = useState<EvolizSupplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierMatches, setSupplierMatches] = useState<SupplierMatch[]>([]);

  // Sélection pour la facture courante
  const [selectedAction, setSelectedAction] = useState<"existing" | "create">("existing");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [newSupplierData, setNewSupplierData] = useState({
    name: "",
    business_number: "",
    vat_number: "",
    addr: "",
    postcode: "",
    town: "",
  });

  // Classifications
  const [purchaseClassifications, setPurchaseClassifications] = useState<EvolizPurchaseClassification[]>([]);
  const [selectedClassificationId, setSelectedClassificationId] = useState<string>("");

  // Vérification doublon Evoliz
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [evolizDuplicate, setEvolizDuplicate] = useState<boolean>(false);

  const currentInvoice = invoices[currentIndex];
  const progress = invoices.length > 0 ? ((exportedCount) / invoices.length) * 100 : 0;
  const isAlreadyExported = currentInvoice?.evoliz_status === "exported";

  // Charger les fournisseurs Evoliz au démarrage
  useEffect(() => {
    if (open && isConfigured && credentials) {
      loadEvolizData();
    }
  }, [open, isConfigured, credentials]);

  // Quand on change de facture, rechercher les correspondances
  useEffect(() => {
    if (currentInvoice && evolizSuppliers.length > 0) {
      findSupplierMatches(currentInvoice);
      prefillNewSupplierData(currentInvoice);
      checkEvolizDuplicate(currentInvoice);
    }
  }, [currentIndex, evolizSuppliers, currentInvoice]);

  // Vérifier si la facture existe déjà dans Evoliz
  const checkEvolizDuplicate = async (invoice: InvoiceToExport) => {
    if (!invoice.invoice_number || !credentials) {
      setEvolizDuplicate(false);
      return;
    }

    setCheckingDuplicate(true);
    try {
      initializeEvolizApi(credentials);
      const exists = await evolizApi.checkBuyExists(invoice.invoice_number);
      setEvolizDuplicate(exists);
    } catch (err) {
      console.error("Erreur vérification doublon:", err);
      setEvolizDuplicate(false);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const loadEvolizData = async () => {
    if (!credentials) return;

    setLoadingSuppliers(true);
    try {
      initializeEvolizApi(credentials);

      // Charger les fournisseurs
      const suppliersResponse = await evolizApi.getSuppliers({ per_page: 500 });
      setEvolizSuppliers(suppliersResponse.data || []);

      // Charger les classifications
      const classifResponse = await evolizApi.getPurchaseClassifications();
      setPurchaseClassifications(classifResponse.data || []);
    } catch (err) {
      console.error("Erreur chargement Evoliz:", err);
      toast.error("Erreur lors du chargement des données Evoliz");
    } finally {
      setLoadingSuppliers(false);
    }
  };

  // Trouver les correspondances de fournisseur
  const findSupplierMatches = (invoice: InvoiceToExport) => {
    const matches: SupplierMatch[] = [];

    if (!invoice.supplier_name) {
      setSupplierMatches([]);
      setSelectedAction("create");
      return;
    }

    const invoiceName = invoice.supplier_name.toLowerCase().trim();
    const invoiceSiret = invoice.supplier_siret?.replace(/\s/g, "") || "";
    const invoiceTva = invoice.supplier_tva?.replace(/\s/g, "") || "";

    evolizSuppliers.forEach((supplier) => {
      const supplierName = supplier.name.toLowerCase().trim();
      const supplierSiret = supplier.business_number?.replace(/\s/g, "") || "";
      const supplierTva = supplier.vat_number?.replace(/\s/g, "") || "";

      // Match exact sur le nom
      if (invoiceName === supplierName) {
        matches.push({ supplier, matchType: "exact", matchScore: 100 });
        return;
      }

      // Match sur SIRET
      if (invoiceSiret && supplierSiret && invoiceSiret === supplierSiret) {
        matches.push({ supplier, matchType: "siret", matchScore: 95 });
        return;
      }

      // Match sur TVA
      if (invoiceTva && supplierTva && invoiceTva === supplierTva) {
        matches.push({ supplier, matchType: "tva", matchScore: 90 });
        return;
      }

      // Match partiel sur le nom
      if (invoiceName.includes(supplierName) || supplierName.includes(invoiceName)) {
        const score = Math.min(invoiceName.length, supplierName.length) / 
                     Math.max(invoiceName.length, supplierName.length) * 80;
        matches.push({ supplier, matchType: "partial", matchScore: Math.round(score) });
      }
    });

    // Trier par score décroissant
    matches.sort((a, b) => b.matchScore - a.matchScore);

    setSupplierMatches(matches);

    // Auto-sélectionner le meilleur match si score > 90
    if (matches.length > 0 && matches[0].matchScore >= 90) {
      setSelectedAction("existing");
      setSelectedSupplierId(matches[0].supplier.supplierid.toString());
    } else if (matches.length > 0) {
      setSelectedAction("existing");
      setSelectedSupplierId(matches[0].supplier.supplierid.toString());
    } else {
      setSelectedAction("create");
      setSelectedSupplierId("");
    }
  };

  // Pré-remplir les données du nouveau fournisseur
  const prefillNewSupplierData = (invoice: InvoiceToExport) => {
    setNewSupplierData({
      name: invoice.supplier_name || "",
      business_number: invoice.supplier_siret || "",
      vat_number: invoice.supplier_tva || "",
      addr: invoice.supplier_address?.addr || "",
      postcode: invoice.supplier_address?.postcode || "",
      town: invoice.supplier_address?.town || "",
    });
  };

  // Valider et exporter la facture courante
  const validateAndExport = async () => {
    if (!currentInvoice || !credentials) return;

    setIsLoading(true);
    setError(null);

    try {
      initializeEvolizApi(credentials);

      let supplierId: number;

      // Créer ou utiliser le fournisseur
      if (selectedAction === "create") {
        // Créer le nouveau fournisseur
        const newSupplier = await evolizApi.createSupplier({
          name: newSupplierData.name,
          business_number: newSupplierData.business_number || undefined,
          vat_number: newSupplierData.vat_number || undefined,
          address: (newSupplierData.addr || newSupplierData.postcode || newSupplierData.town) ? {
            addr: newSupplierData.addr || undefined,
            postcode: newSupplierData.postcode || undefined,
            town: newSupplierData.town || undefined,
            iso2: "FR",
          } : undefined,
        });
        supplierId = newSupplier.supplierid;
        toast.success(`Fournisseur "${newSupplierData.name}" créé dans Evoliz`);

        // Ajouter aux fournisseurs locaux pour les prochaines factures
        setEvolizSuppliers((prev) => [...prev, newSupplier]);
      } else {
        supplierId = parseInt(selectedSupplierId);
      }

      // Calculer les montants
      let totalHT = currentInvoice.total_ht;
      let tvaAmount = currentInvoice.tva_amount;

      if (!totalHT && currentInvoice.total_ttc && tvaAmount) {
        totalHT = currentInvoice.total_ttc - tvaAmount;
      } else if (!totalHT && currentInvoice.total_ttc) {
        totalHT = currentInvoice.total_ttc / 1.2;
        tvaAmount = currentInvoice.total_ttc - totalHT;
      }

      // Créer l'achat dans Evoliz
      const buyInput = {
        supplierid: supplierId,
        external_document_number: currentInvoice.invoice_number || undefined,
        documentdate: currentInvoice.invoice_date || new Date().toISOString().split("T")[0],
        duedate: currentInvoice.due_date || undefined,
        label: currentInvoice.description || `Facture ${currentInvoice.invoice_number || ""}`.trim(),
        items: [
          {
            designation: currentInvoice.description || `Facture ${currentInvoice.supplier_name}`,
            quantity: 1,
            unit_price_vat_exclude: totalHT || 0,
            vat: tvaAmount || (totalHT ? totalHT * 0.2 : 0),
            vat_rate: currentInvoice.tva_rate || 20,
            ...(selectedClassificationId ? { purchaseclassificationid: parseInt(selectedClassificationId) } : {}),
          },
        ],
      };

      await evolizApi.createBuy(buyInput);

      // Mettre à jour le statut dans Supabase
      await (supabase as any)
        .from("incoming_invoices")
        .update({ evoliz_status: "exported", evoliz_exported_at: new Date().toISOString() })
        .eq("id", currentInvoice.id);

      toast.success(`Facture exportée vers Evoliz !`);
      setExportedCount((prev) => prev + 1);

      // Passer à la facture suivante
      if (currentIndex < invoices.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Toutes les factures sont exportées
        toast.success(`🎉 ${exportedCount + 1} facture(s) exportée(s) !`);
        onExportComplete?.();
        onOpenChange(false);
      }
    } catch (err) {
      console.error("Erreur export:", err);
      setError(err instanceof Error ? err.message : "Erreur lors de l'export");
      toast.error("Erreur lors de l'export");
    } finally {
      setIsLoading(false);
    }
  };

  // Skip la facture courante
  const skipInvoice = () => {
    if (currentIndex < invoices.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onOpenChange(false);
    }
  };

  const getMatchBadge = (matchType: string, score: number) => {
    switch (matchType) {
      case "exact":
        return <Badge className="bg-green-500">Match exact</Badge>;
      case "siret":
        return <Badge className="bg-blue-500">SIRET identique</Badge>;
      case "tva":
        return <Badge className="bg-purple-500">TVA identique</Badge>;
      case "partial":
        return <Badge variant="outline">{score}% similaire</Badge>;
      default:
        return null;
    }
  };

  if (!currentInvoice) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Export vers Evoliz
            <Badge variant="outline" className="ml-2">
              {currentIndex + 1} / {invoices.length}
            </Badge>
          </DialogTitle>
          <Progress value={progress} className="h-2" />
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Résumé de la facture */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Facture à exporter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Fournisseur:</span>
                    <p className="font-medium">{currentInvoice.supplier_name || "Non détecté"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">N° Facture:</span>
                    <p className="font-medium">{currentInvoice.invoice_number || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <p className="font-medium">{currentInvoice.invoice_date || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total TTC:</span>
                    <p className="font-medium text-lg">
                      {currentInvoice.total_ttc?.toFixed(2) || "-"} €
                    </p>
                  </div>
                  {currentInvoice.supplier_siret && (
                    <div>
                      <span className="text-muted-foreground">SIRET:</span>
                      <p className="font-medium font-mono text-xs">{currentInvoice.supplier_siret}</p>
                    </div>
                  )}
                  {currentInvoice.supplier_tva && (
                    <div>
                      <span className="text-muted-foreground">N° TVA:</span>
                      <p className="font-medium font-mono text-xs">{currentInvoice.supplier_tva}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Avertissements de doublons */}
            {isAlreadyExported && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Facture déjà exportée
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Cette facture a déjà été envoyée vers Evoliz. L'exporter à nouveau créera un doublon.
                  </p>
                </div>
              </div>
            )}

            {!isAlreadyExported && evolizDuplicate && (
              <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-orange-800 dark:text-orange-200">
                    Doublon potentiel dans Evoliz
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Un achat avec le numéro "{currentInvoice.invoice_number}" existe déjà dans Evoliz.
                  </p>
                </div>
              </div>
            )}

            {checkingDuplicate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Vérification des doublons dans Evoliz...
              </div>
            )}

            <Separator />

            {/* Sélection du fournisseur */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Fournisseur Evoliz
              </h3>

              {loadingSuppliers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Chargement des fournisseurs...
                </div>
              ) : (
                <RadioGroup
                  value={selectedAction}
                  onValueChange={(v) => setSelectedAction(v as "existing" | "create")}
                >
                  {/* Fournisseurs correspondants */}
                  {supplierMatches.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {supplierMatches.length} fournisseur(s) trouvé(s) :
                      </p>
                      {supplierMatches.slice(0, 5).map((match) => (
                        <div
                          key={match.supplier.supplierid}
                          className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedAction === "existing" &&
                            selectedSupplierId === match.supplier.supplierid.toString()
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => {
                            setSelectedAction("existing");
                            setSelectedSupplierId(match.supplier.supplierid.toString());
                          }}
                        >
                          <RadioGroupItem
                            value="existing"
                            id={`supplier-${match.supplier.supplierid}`}
                            checked={
                              selectedAction === "existing" &&
                              selectedSupplierId === match.supplier.supplierid.toString()
                            }
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{match.supplier.name}</span>
                              {getMatchBadge(match.matchType, match.matchScore)}
                            </div>
                            <div className="text-xs text-muted-foreground flex gap-4 mt-1">
                              {match.supplier.business_number && (
                                <span>SIRET: {match.supplier.business_number}</span>
                              )}
                              {match.supplier.vat_number && (
                                <span>TVA: {match.supplier.vat_number}</span>
                              )}
                              {match.supplier.address?.town && (
                                <span>{match.supplier.address.town}</span>
                              )}
                            </div>
                          </div>
                          {match.matchScore >= 90 && (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Option créer nouveau */}
                  <div
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedAction === "create"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedAction("create")}
                  >
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="create" id="create-new" />
                      <Plus className="h-4 w-4" />
                      <span className="font-medium">Créer un nouveau fournisseur</span>
                    </div>

                    {selectedAction === "create" && (
                      <div className="mt-4 ml-7 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="supplier-name">Nom *</Label>
                            <Input
                              id="supplier-name"
                              value={newSupplierData.name}
                              onChange={(e) =>
                                setNewSupplierData((prev) => ({ ...prev, name: e.target.value }))
                              }
                              placeholder="Nom du fournisseur"
                            />
                          </div>
                          <div>
                            <Label htmlFor="supplier-siret">SIRET</Label>
                            <Input
                              id="supplier-siret"
                              value={newSupplierData.business_number}
                              onChange={(e) =>
                                setNewSupplierData((prev) => ({
                                  ...prev,
                                  business_number: e.target.value,
                                }))
                              }
                              placeholder="12345678901234"
                            />
                          </div>
                          <div>
                            <Label htmlFor="supplier-tva">N° TVA</Label>
                            <Input
                              id="supplier-tva"
                              value={newSupplierData.vat_number}
                              onChange={(e) =>
                                setNewSupplierData((prev) => ({
                                  ...prev,
                                  vat_number: e.target.value,
                                }))
                              }
                              placeholder="FR12345678901"
                            />
                          </div>
                          <div>
                            <Label htmlFor="supplier-addr">Adresse</Label>
                            <Input
                              id="supplier-addr"
                              value={newSupplierData.addr}
                              onChange={(e) =>
                                setNewSupplierData((prev) => ({ ...prev, addr: e.target.value }))
                              }
                              placeholder="Rue..."
                            />
                          </div>
                          <div>
                            <Label htmlFor="supplier-postcode">Code postal</Label>
                            <Input
                              id="supplier-postcode"
                              value={newSupplierData.postcode}
                              onChange={(e) =>
                                setNewSupplierData((prev) => ({
                                  ...prev,
                                  postcode: e.target.value,
                                }))
                              }
                              placeholder="75001"
                            />
                          </div>
                          <div>
                            <Label htmlFor="supplier-town">Ville</Label>
                            <Input
                              id="supplier-town"
                              value={newSupplierData.town}
                              onChange={(e) =>
                                setNewSupplierData((prev) => ({ ...prev, town: e.target.value }))
                              }
                              placeholder="Paris"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </RadioGroup>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-between gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={skipInvoice} disabled={isLoading}>
            Passer cette facture
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button
              onClick={validateAndExport}
              disabled={
                isLoading ||
                checkingDuplicate ||
                (selectedAction === "existing" && !selectedSupplierId) ||
                (selectedAction === "create" && !newSupplierData.name)
              }
              className={
                (isAlreadyExported || evolizDuplicate)
                  ? "bg-amber-600 hover:bg-amber-700"
                  : ""
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Export en cours...
                </>
              ) : (isAlreadyExported || evolizDuplicate) ? (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Exporter quand même
                  {currentIndex < invoices.length - 1 && (
                    <ArrowRight className="h-4 w-4 ml-1" />
                  )}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Valider et exporter
                  {currentIndex < invoices.length - 1 && (
                    <ArrowRight className="h-4 w-4 ml-1" />
                  )}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InvoiceBatchExport;
