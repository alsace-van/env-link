// ============================================
// DIALOG SCANNER FACTURES FOURNISSEURS
// Upload + OCR Gemini + Validation + Envoi Evoliz
// Version Dialog pour intégration dans ExpenseTableForm
// ============================================

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  X,
  FileText,
  Image,
  Sparkles,
  Building2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { evolizApi, initializeEvolizApi } from "@/services/evolizService";
import { useEvolizConfig } from "@/hooks/useEvolizConfig";
import type { EvolizSupplier, EvolizPurchaseClassification } from "@/types/evoliz.types";

// Types
interface ExtractedInvoice {
  supplier_name: string;
  invoice_number: string | null;
  invoice_date: string | null;
  total_ht: number | null;
  total_ttc: number | null;
  tva_amount: number | null;
  confidence: number;
}

interface UploadedFile {
  file: File;
  preview: string;
  type: "pdf" | "image";
}

type Step = "upload" | "analyzing" | "validation" | "sending" | "success" | "error";

interface SupplierInvoiceScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvoiceScanned?: (data: {
    supplier_name: string;
    total_ttc: number | null;
    total_ht: number | null;
    invoice_number?: string | null;
    invoice_date?: string | null;
  }) => void;
}

export function SupplierInvoiceScannerDialog({
  open,
  onOpenChange,
  onInvoiceScanned,
}: SupplierInvoiceScannerDialogProps) {
  const { isConfigured, credentials } = useEvolizConfig();

  // États
  const [step, setStep] = useState<Step>("upload");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [editedData, setEditedData] = useState<ExtractedInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fournisseurs Evoliz
  const [suppliers, setSuppliers] = useState<EvolizSupplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [isNewSupplier, setIsNewSupplier] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // Classifications d'achat
  const [purchaseClassifications, setPurchaseClassifications] = useState<EvolizPurchaseClassification[]>([]);
  const [selectedClassificationId, setSelectedClassificationId] = useState<string>("");

  // Reset quand on ferme
  const handleClose = () => {
    setStep("upload");
    setUploadedFile(null);
    setExtractedData(null);
    setEditedData(null);
    setError(null);
    setSelectedSupplierId("");
    setIsNewSupplier(false);
    onOpenChange(false);
  };

  // Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");

    if (!isPdf && !isImage) {
      toast.error("Format non supporté. Utilisez PDF, JPG ou PNG.");
      return;
    }

    const preview = URL.createObjectURL(file);
    setUploadedFile({
      file,
      preview,
      type: isPdf ? "pdf" : "image",
    });

    // Lancer l'analyse automatiquement
    analyzeDocument(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10 MB
  });

  // Charger les fournisseurs Evoliz
  const loadSuppliers = async () => {
    if (!isConfigured || !credentials) return;

    setLoadingSuppliers(true);
    try {
      initializeEvolizApi(credentials);
      const response = await evolizApi.getSuppliers({ per_page: 500 });
      setSuppliers(response.data || []);

      // Charger aussi les classifications d'achat
      const classifResponse = await evolizApi.getPurchaseClassifications();
      setPurchaseClassifications(classifResponse.data || []);
    } catch (err) {
      console.error("Erreur chargement fournisseurs:", err);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  // Analyser le document avec Gemini
  const analyzeDocument = async (file: File) => {
    setStep("analyzing");
    setError(null);

    try {
      // Charger les fournisseurs en parallèle
      loadSuppliers();

      // Convertir en base64
      const base64 = await fileToBase64(file);
      const mimeType = file.type;

      // Appeler l'edge function Gemini
      const { data, error } = await supabase.functions.invoke("gemini-invoice-ocr", {
        body: {
          image: base64,
          mimeType,
          fileName: file.name,
        },
      });

      if (error) throw error;

      if (!data || !data.success) {
        throw new Error(data?.error || "Erreur lors de l'analyse");
      }

      const extracted: ExtractedInvoice = {
        supplier_name: data.supplier_name || "",
        invoice_number: data.invoice_number || null,
        invoice_date: data.invoice_date || null,
        total_ht: data.total_ht || null,
        total_ttc: data.total_ttc || null,
        tva_amount: data.tva_amount || null,
        confidence: data.confidence || 0,
      };

      setExtractedData(extracted);
      setEditedData({ ...extracted });

      // Essayer de matcher le fournisseur
      matchSupplier(extracted.supplier_name);

      setStep("validation");
    } catch (err) {
      console.error("Erreur analyse:", err);
      setError(err instanceof Error ? err.message : "Erreur lors de l'analyse");
      setStep("error");
    }
  };

  // Matcher le fournisseur
  const matchSupplier = (supplierName: string) => {
    if (!supplierName || suppliers.length === 0) {
      setIsNewSupplier(true);
      return;
    }

    const nameLower = supplierName.toLowerCase().trim();

    // Chercher une correspondance exacte ou partielle
    const exactMatch = suppliers.find((s) => s.name.toLowerCase().trim() === nameLower);

    if (exactMatch) {
      setSelectedSupplierId(exactMatch.supplierid.toString());
      setIsNewSupplier(false);
      return;
    }

    // Recherche partielle (le nom extrait contient le nom Evoliz ou vice-versa)
    const partialMatch = suppliers.find((s) => {
      const evolizName = s.name.toLowerCase().trim();
      return nameLower.includes(evolizName) || evolizName.includes(nameLower);
    });

    if (partialMatch) {
      setSelectedSupplierId(partialMatch.supplierid.toString());
      setIsNewSupplier(false);
      return;
    }

    // Pas de match → nouveau fournisseur
    setIsNewSupplier(true);
    setSelectedSupplierId("");
  };

  // Envoyer vers Evoliz
  const sendToEvoliz = async () => {
    if (!editedData || !isConfigured || !credentials) return;

    setStep("sending");
    setError(null);

    try {
      initializeEvolizApi(credentials);

      let supplierId: number;

      // Créer le fournisseur si nouveau
      if (isNewSupplier || !selectedSupplierId) {
        const newSupplier = await evolizApi.createSupplier({
          name: editedData.supplier_name,
          type: "Professionnel",
        });
        supplierId = newSupplier.supplierid;
        toast.success(`Fournisseur "${editedData.supplier_name}" créé`);
      } else {
        supplierId = parseInt(selectedSupplierId);
      }

      // Calculer la TVA si manquante
      let tvaAmount = editedData.tva_amount;
      if (!tvaAmount && editedData.total_ht && editedData.total_ttc) {
        tvaAmount = editedData.total_ttc - editedData.total_ht;
      }

      // Calculer le montant HT si manquant
      let totalHT = editedData.total_ht;
      if (!totalHT && editedData.total_ttc && tvaAmount) {
        totalHT = editedData.total_ttc - tvaAmount;
      } else if (!totalHT && editedData.total_ttc) {
        // Assumer 20% de TVA
        totalHT = editedData.total_ttc / 1.2;
      }

      // Créer la dépense
      const buyInput = {
        supplierid: supplierId,
        external_document_number: editedData.invoice_number || undefined,
        documentdate: editedData.invoice_date || new Date().toISOString().split("T")[0],
        label: `Facture ${editedData.invoice_number || ""}`.trim(),
        items: [
          {
            designation: `Facture ${editedData.supplier_name}`,
            quantity: 1,
            unit_price_vat_exclude: totalHT || 0,
            vat: tvaAmount || (totalHT ? totalHT * 0.2 : 0),
            vat_rate: 20,
            ...(selectedClassificationId ? { purchaseclassificationid: parseInt(selectedClassificationId) } : {}),
          },
        ],
      };

      await evolizApi.createBuy(buyInput);

      // Callback pour ajouter la ligne dans le tableau parent
      if (onInvoiceScanned) {
        onInvoiceScanned({
          supplier_name: editedData.supplier_name,
          total_ttc: editedData.total_ttc,
          total_ht: totalHT,
          invoice_number: editedData.invoice_number,
          invoice_date: editedData.invoice_date,
        });
      }

      toast.success("Facture envoyée vers Evoliz !");
      setStep("success");
    } catch (err) {
      console.error("Erreur envoi:", err);
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi");
      setStep("error");
    }
  };

  // Helpers
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Enlever le préfixe data:...;base64,
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  // Reset pour scanner une autre facture
  const scanAnother = () => {
    setStep("upload");
    setUploadedFile(null);
    setExtractedData(null);
    setEditedData(null);
    setError(null);
    setSelectedSupplierId("");
    setIsNewSupplier(false);
  };

  // Vérifier la configuration Evoliz
  if (!isConfigured) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evoliz non configuré</DialogTitle>
            <DialogDescription>
              Configurez vos identifiants Evoliz dans les paramètres pour utiliser cette fonctionnalité.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            Scanner une facture fournisseur
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Déposez un PDF ou une photo de facture"}
            {step === "analyzing" && "Analyse en cours..."}
            {step === "validation" && "Vérifiez les informations extraites"}
            {step === "sending" && "Envoi vers Evoliz..."}
            {step === "success" && "Facture envoyée !"}
            {step === "error" && "Une erreur est survenue"}
          </DialogDescription>
        </DialogHeader>

        {/* ÉTAPE: Upload */}
        {step === "upload" && (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors duration-200
              ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"}
            `}
          >
            <input {...getInputProps()} />
            <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            {isDragActive ? (
              <p className="text-blue-600 font-medium">Déposez le fichier ici...</p>
            ) : (
              <div className="space-y-1">
                <p className="font-medium">Glissez-déposez votre facture</p>
                <p className="text-sm text-muted-foreground">PDF, JPG ou PNG • Max 10 Mo</p>
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE: Analyse en cours */}
        {step === "analyzing" && (
          <div className="py-10 text-center">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-blue-500 mb-3" />
            <p className="text-muted-foreground">Gemini analyse votre facture...</p>
          </div>
        )}

        {/* ÉTAPE: Validation */}
        {step === "validation" && editedData && (
          <div className="space-y-4">
            {/* Aperçu du fichier */}
            {uploadedFile && (
              <div className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                {uploadedFile.type === "pdf" ? (
                  <FileText className="h-6 w-6 text-red-500" />
                ) : (
                  <Image className="h-6 w-6 text-blue-500" />
                )}
                <span className="text-sm truncate flex-1">{uploadedFile.file.name}</span>
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  {Math.round((extractedData?.confidence || 0) * 100)}%
                </Badge>
              </div>
            )}

            {/* Formulaire */}
            <div className="grid gap-3">
              {/* Fournisseur */}
              <div className="space-y-1.5">
                <Label className="text-xs">Fournisseur *</Label>
                {isNewSupplier ? (
                  <div className="flex gap-2">
                    <Input
                      value={editedData.supplier_name}
                      onChange={(e) => setEditedData({ ...editedData, supplier_name: e.target.value })}
                      placeholder="Nom du fournisseur"
                      className="h-9"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsNewSupplier(false);
                        matchSupplier(editedData.supplier_name);
                      }}
                      disabled={loadingSuppliers}
                    >
                      {loadingSuppliers ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.supplierid} value={s.supplierid.toString()}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsNewSupplier(true)}
                      title="Créer un nouveau fournisseur"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {isNewSupplier && (
                  <p className="text-xs text-orange-600 flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Sera créé dans Evoliz
                  </p>
                )}
              </div>

              {/* Numéro et Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">N° Facture</Label>
                  <Input
                    value={editedData.invoice_number || ""}
                    onChange={(e) => setEditedData({ ...editedData, invoice_number: e.target.value || null })}
                    placeholder="FAC-001"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={editedData.invoice_date || ""}
                    onChange={(e) => setEditedData({ ...editedData, invoice_date: e.target.value || null })}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Montants */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Total HT *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editedData.total_ht || ""}
                    onChange={(e) => setEditedData({ ...editedData, total_ht: parseFloat(e.target.value) || null })}
                    placeholder="0.00"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">TVA</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editedData.tva_amount || ""}
                    onChange={(e) => setEditedData({ ...editedData, tva_amount: parseFloat(e.target.value) || null })}
                    placeholder="0.00"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Total TTC *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editedData.total_ttc || ""}
                    onChange={(e) => setEditedData({ ...editedData, total_ttc: parseFloat(e.target.value) || null })}
                    placeholder="0.00"
                    className="h-9"
                  />
                </div>
              </div>

              {/* Classification */}
              {purchaseClassifications.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Classification (optionnel)</Label>
                  <Select value={selectedClassificationId} onValueChange={setSelectedClassificationId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sélectionner une classification" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucune</SelectItem>
                      {purchaseClassifications.map((c) => (
                        <SelectItem
                          key={c.purchaseclassificationid || c.id}
                          value={(c.purchaseclassificationid || c.id)?.toString() || ""}
                        >
                          {c.code} - {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button
                onClick={sendToEvoliz}
                disabled={!editedData.supplier_name || (!editedData.total_ht && !editedData.total_ttc)}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Envoyer vers Evoliz
              </Button>
            </div>
          </div>
        )}

        {/* ÉTAPE: Envoi en cours */}
        {step === "sending" && (
          <div className="py-10 text-center">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-blue-500 mb-3" />
            <p className="text-muted-foreground">Création de la dépense dans Evoliz...</p>
          </div>
        )}

        {/* ÉTAPE: Succès */}
        {step === "success" && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <p className="font-semibold">Facture envoyée !</p>
              <p className="text-sm text-muted-foreground">La dépense a été créée dans Evoliz</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={scanAnother}>
                Scanner une autre
              </Button>
              <Button onClick={handleClose}>Terminé</Button>
            </div>
          </div>
        )}

        {/* ÉTAPE: Erreur */}
        {step === "error" && (
          <div className="py-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
            <div>
              <p className="font-semibold">Erreur</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={scanAnother}>Réessayer</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
