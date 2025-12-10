// ============================================
// DIALOG SCANNER FACTURES FOURNISSEURS EN MASSE
// Upload multiple + OCR Gemini parallèle + Validation tableau + Envoi groupé Evoliz
// ============================================

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FileUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Send,
  X,
  FileText,
  Image,
  Sparkles,
  Building2,
  Plus,
  Trash2,
  Eye,
  RotateCcw,
  Upload,
  Check,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { evolizApi, initializeEvolizApi } from "@/services/evolizService";
import { useEvolizConfig } from "@/hooks/useEvolizConfig";
import { useAIConfig } from "@/hooks/useAIConfig";
import type { EvolizSupplier, EvolizPurchaseClassification } from "@/types/evoliz.types";

// ============================================
// TYPES
// ============================================

interface ExtractedInvoice {
  supplier_name: string;
  invoice_number: string | null;
  invoice_date: string | null;
  total_ht: number | null;
  total_ttc: number | null;
  tva_amount: number | null;
  tva_rate: number | null;
  confidence: number;
}

interface QueuedFile {
  id: string;
  file: File;
  preview: string;
  type: "pdf" | "image";
  status: "pending" | "analyzing" | "ready" | "sending" | "success" | "error";
  extractedData: ExtractedInvoice | null;
  editedData: ExtractedInvoice | null;
  error: string | null;
  selected: boolean;
  matchedSupplierId: string | null;
  isNewSupplier: boolean;
  classificationId: string | null;
  evolizBuyId: number | null;
}

type GlobalStep = "upload" | "processing" | "validation" | "sending" | "done";

interface BatchInvoiceScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (count: number) => void;
}

// ============================================
// CONSTANTS
// ============================================

const MAX_CONCURRENT_OCR = 3;
const MAX_FILES = 50;

// ============================================
// COMPONENT
// ============================================

export function BatchInvoiceScannerDialog({ open, onOpenChange, onComplete }: BatchInvoiceScannerDialogProps) {
  const { isConfigured: isEvolizConfigured, credentials } = useEvolizConfig();
  const { isConfigured: isAIConfigured, provider, apiKey } = useAIConfig();

  // État global
  const [globalStep, setGlobalStep] = useState<GlobalStep>("upload");
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [sendingProgress, setSendingProgress] = useState(0);

  // Données Evoliz
  const [suppliers, setSuppliers] = useState<EvolizSupplier[]>([]);
  const [classifications, setClassifications] = useState<EvolizPurchaseClassification[]>([]);
  const [loadingEvoliz, setLoadingEvoliz] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    errors: 0,
    newSuppliers: 0,
  });

  // Vérifications de configuration
  const isGeminiConfigured = isAIConfigured && provider === "gemini" && apiKey?.startsWith("AIza");

  // ============================================
  // RESET
  // ============================================

  const handleClose = () => {
    if (globalStep === "processing" || globalStep === "sending") {
      if (!confirm("Traitement en cours. Voulez-vous vraiment fermer ?")) {
        return;
      }
    }
    resetAll();
    onOpenChange(false);
  };

  const resetAll = () => {
    // Libérer les URL de preview
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setGlobalStep("upload");
    setProcessingProgress(0);
    setSendingProgress(0);
    setStats({ total: 0, success: 0, errors: 0, newSuppliers: 0 });
  };

  // ============================================
  // LOAD EVOLIZ DATA
  // ============================================

  const loadEvolizData = async () => {
    if (!isEvolizConfigured || !credentials) return;

    setLoadingEvoliz(true);
    try {
      initializeEvolizApi(credentials);

      const [suppliersRes, classifRes] = await Promise.all([
        evolizApi.getSuppliers({ per_page: 100 }),
        evolizApi.getPurchaseClassifications(),
      ]);

      setSuppliers(suppliersRes.data || []);
      setClassifications(classifRes.data || []);
    } catch (err) {
      console.error("Erreur chargement données Evoliz:", err);
      toast.error("Impossible de charger les données Evoliz");
    } finally {
      setLoadingEvoliz(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadEvolizData();
    }
  }, [open, isEvolizConfigured]);

  // ============================================
  // DROPZONE
  // ============================================

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (files.length + acceptedFiles.length > MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} fichiers autorisés`);
        return;
      }

      const newFiles: QueuedFile[] = acceptedFiles.map((file) => {
        const isPdf = file.type === "application/pdf";
        const isImage = file.type.startsWith("image/");

        return {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview: URL.createObjectURL(file),
          type: isPdf ? "pdf" : "image",
          status: "pending",
          extractedData: null,
          editedData: null,
          error: null,
          selected: true,
          matchedSupplierId: null,
          isNewSupplier: false,
          classificationId: null,
          evolizBuyId: null,
        };
      });

      setFiles((prev) => [...prev, ...newFiles]);
    },
    [files.length],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxFiles: MAX_FILES,
    maxSize: 10 * 1024 * 1024,
  });

  // ============================================
  // REMOVE FILE
  // ============================================

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  // ============================================
  // OCR PROCESSING
  // ============================================

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Retirer le préfixe data:xxx;base64,
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const analyzeFile = async (fileItem: QueuedFile): Promise<QueuedFile> => {
    try {
      const base64 = await fileToBase64(fileItem.file);

      // Appeler l'edge function OCR
      const { data, error } = await supabase.functions.invoke("gemini-invoice-ocr", {
        body: {
          image: base64,
          mimeType: fileItem.file.type,
          fileName: fileItem.file.name,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "OCR échoué");
      }

      const extracted: ExtractedInvoice = {
        supplier_name: data.supplier_name || "",
        invoice_number: data.invoice_number || null,
        invoice_date: data.invoice_date || null,
        total_ht: data.total_ht || null,
        total_ttc: data.total_ttc || null,
        tva_amount: data.tva_amount || null,
        tva_rate: data.tva_rate || null,
        confidence: data.confidence || 0,
      };

      // Auto-match supplier
      const { matchedId, isNew } = matchSupplier(extracted.supplier_name);

      return {
        ...fileItem,
        status: "ready",
        extractedData: extracted,
        editedData: { ...extracted },
        error: null,
        matchedSupplierId: matchedId,
        isNewSupplier: isNew,
      };
    } catch (err) {
      console.error(`Erreur OCR ${fileItem.file.name}:`, err);
      return {
        ...fileItem,
        status: "error",
        error: err instanceof Error ? err.message : "Erreur OCR",
      };
    }
  };

  const matchSupplier = (supplierName: string): { matchedId: string | null; isNew: boolean } => {
    if (!supplierName || suppliers.length === 0) {
      return { matchedId: null, isNew: true };
    }

    const nameLower = supplierName.toLowerCase().trim();

    // Match exact
    const exactMatch = suppliers.find((s) => s.name.toLowerCase().trim() === nameLower);
    if (exactMatch) {
      return { matchedId: exactMatch.supplierid.toString(), isNew: false };
    }

    // Match partiel (contient)
    const partialMatch = suppliers.find(
      (s) => s.name.toLowerCase().includes(nameLower) || nameLower.includes(s.name.toLowerCase()),
    );
    if (partialMatch) {
      return { matchedId: partialMatch.supplierid.toString(), isNew: false };
    }

    // Match par mots clés
    const words = nameLower.split(/\s+/).filter((w) => w.length > 3);
    for (const word of words) {
      const wordMatch = suppliers.find((s) => s.name.toLowerCase().includes(word));
      if (wordMatch) {
        return { matchedId: wordMatch.supplierid.toString(), isNew: false };
      }
    }

    return { matchedId: null, isNew: true };
  };

  const startProcessing = async () => {
    if (files.length === 0) return;

    setGlobalStep("processing");
    setProcessingProgress(0);

    const pendingFiles = files.filter((f) => f.status === "pending");
    let processed = 0;

    // Traitement par lots parallèles
    for (let i = 0; i < pendingFiles.length; i += MAX_CONCURRENT_OCR) {
      const batch = pendingFiles.slice(i, i + MAX_CONCURRENT_OCR);

      // Marquer comme "analyzing"
      setFiles((prev) => prev.map((f) => (batch.find((b) => b.id === f.id) ? { ...f, status: "analyzing" } : f)));

      // Traiter en parallèle
      const results = await Promise.all(batch.map(analyzeFile));

      // Mettre à jour les résultats
      setFiles((prev) =>
        prev.map((f) => {
          const result = results.find((r) => r.id === f.id);
          return result || f;
        }),
      );

      processed += batch.length;
      setProcessingProgress(Math.round((processed / pendingFiles.length) * 100));
    }

    setGlobalStep("validation");
  };

  // ============================================
  // VALIDATION HELPERS
  // ============================================

  const toggleSelectAll = (selected: boolean) => {
    setFiles((prev) => prev.map((f) => (f.status === "ready" ? { ...f, selected } : f)));
  };

  const toggleSelect = (id: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f)));
  };

  const updateFileData = (id: string, field: keyof ExtractedInvoice, value: string | number | null) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== id || !f.editedData) return f;
        return {
          ...f,
          editedData: { ...f.editedData, [field]: value },
        };
      }),
    );
  };

  const updateSupplier = (id: string, supplierId: string | null, isNew: boolean) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, matchedSupplierId: supplierId, isNewSupplier: isNew } : f)),
    );
  };

  const updateClassification = (id: string, classificationId: string | null) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, classificationId } : f)));
  };

  // ============================================
  // SEND TO EVOLIZ
  // ============================================

  const sendToEvoliz = async () => {
    const selectedFiles = files.filter((f) => f.selected && f.status === "ready" && f.editedData);

    if (selectedFiles.length === 0) {
      toast.error("Aucune facture sélectionnée");
      return;
    }

    if (!isEvolizConfigured || !credentials) {
      toast.error("Evoliz non configuré");
      return;
    }

    setGlobalStep("sending");
    setSendingProgress(0);

    initializeEvolizApi(credentials);

    let successCount = 0;
    let errorCount = 0;
    let newSuppliersCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const fileItem = selectedFiles[i];

      // Marquer comme "sending"
      setFiles((prev) => prev.map((f) => (f.id === fileItem.id ? { ...f, status: "sending" } : f)));

      try {
        let supplierId = fileItem.matchedSupplierId;

        // Créer le fournisseur si nécessaire
        if (fileItem.isNewSupplier && fileItem.editedData?.supplier_name) {
          const newSupplier = await evolizApi.createSupplier({
            name: fileItem.editedData.supplier_name,
          });
          supplierId = newSupplier.supplierid.toString();
          newSuppliersCount++;

          // Ajouter à la liste locale
          setSuppliers((prev) => [...prev, newSupplier]);
        }

        if (!supplierId) {
          throw new Error("Fournisseur requis");
        }

        // Créer l'achat dans Evoliz
        const buyData = {
          supplierid: parseInt(supplierId),
          documentdate: fileItem.editedData?.invoice_date || new Date().toISOString().split("T")[0],
          external_document_number: fileItem.editedData?.invoice_number || undefined,
          term: {
            paytermid: 1, // À définir
          },
          items: [
            {
              designation: `Facture ${fileItem.editedData?.invoice_number || fileItem.file.name}`,
              unit_price_vat_exclude: fileItem.editedData?.total_ht || 0,
              quantity: 1,
              vat: fileItem.editedData?.tva_rate || 20,
              purchase_classificationid: fileItem.classificationId ? parseInt(fileItem.classificationId) : undefined,
            },
          ],
        };

        const result = await evolizApi.createBuy(buyData);

        setFiles((prev) =>
          prev.map((f) => (f.id === fileItem.id ? { ...f, status: "success", evolizBuyId: result.buyid } : f)),
        );

        successCount++;
      } catch (err) {
        console.error(`Erreur envoi ${fileItem.file.name}:`, err);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? {
                  ...f,
                  status: "error",
                  error: err instanceof Error ? err.message : "Erreur envoi",
                }
              : f,
          ),
        );
        errorCount++;
      }

      setSendingProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
    }

    setStats({
      total: selectedFiles.length,
      success: successCount,
      errors: errorCount,
      newSuppliers: newSuppliersCount,
    });

    setGlobalStep("done");

    if (successCount > 0) {
      toast.success(`${successCount} facture(s) envoyée(s) vers Evoliz`);
      onComplete?.(successCount);
    }
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const readyFiles = files.filter((f) => f.status === "ready");
  const selectedCount = files.filter((f) => f.selected && f.status === "ready").length;
  const lowConfidenceCount = files.filter(
    (f) => f.status === "ready" && (f.extractedData?.confidence || 0) < 0.7,
  ).length;
  const newSuppliersPreview = files.filter((f) => f.selected && f.status === "ready" && f.isNewSupplier).length;

  // ============================================
  // RENDER
  // ============================================

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <FileUp className="h-5 w-5" />
                Import factures fournisseurs en masse
              </DialogTitle>
              <DialogDescription className="mt-1">
                Scannez plusieurs factures avec OCR et envoyez-les vers Evoliz
              </DialogDescription>
            </div>
            {files.length > 0 && globalStep !== "done" && (
              <Badge variant="outline" className="text-sm">
                {files.length} fichier{files.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* STEP: Upload */}
          {globalStep === "upload" && (
            <div className="p-6">
              {/* Alertes de configuration */}
              {!isGeminiConfigured && (
                <div className="mb-4 p-4 rounded-lg bg-orange-50 border border-orange-200 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-800">Clé Gemini non configurée</p>
                    <p className="text-sm text-orange-600 mt-1">
                      L'OCR nécessite une clé API Gemini. Configurez-la dans{" "}
                      <span className="font-medium">Paramètres → Configuration IA</span>.
                    </p>
                  </div>
                </div>
              )}

              {!isEvolizConfigured && (
                <div className="mb-4 p-4 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800">Evoliz non configuré</p>
                    <p className="text-sm text-blue-600 mt-1">
                      Configurez vos identifiants Evoliz dans <span className="font-medium">Paramètres → Evoliz</span>{" "}
                      pour envoyer les factures.
                    </p>
                  </div>
                </div>
              )}

              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                  <p className="text-lg font-medium text-primary">Déposez les fichiers ici...</p>
                ) : (
                  <>
                    <p className="text-lg font-medium">Glissez-déposez vos factures ici</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ou cliquez pour sélectionner (PDF, JPG, PNG - max {MAX_FILES} fichiers)
                    </p>
                  </>
                )}
              </div>

              {/* Liste des fichiers en attente */}
              {files.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">Fichiers à traiter ({files.length})</h3>
                    <Button variant="ghost" size="sm" onClick={resetAll} className="text-muted-foreground">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Tout supprimer
                    </Button>
                  </div>

                  <ScrollArea className="h-[200px] rounded-lg border">
                    <div className="p-2 space-y-1">
                      {files.map((f) => (
                        <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                          {f.type === "pdf" ? (
                            <FileText className="h-5 w-5 text-red-500 shrink-0" />
                          ) : (
                            <Image className="h-5 w-5 text-blue-500 shrink-0" />
                          )}
                          <span className="flex-1 truncate text-sm">{f.file.name}</span>
                          <span className="text-xs text-muted-foreground">{(f.file.size / 1024).toFixed(0)} Ko</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeFile(f.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="flex justify-end mt-4">
                    <Button onClick={startProcessing} className="gap-2" disabled={!isGeminiConfigured}>
                      <Sparkles className="h-4 w-4" />
                      Analyser {files.length} facture{files.length > 1 ? "s" : ""}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP: Processing */}
          {globalStep === "processing" && (
            <div className="p-6">
              <div className="text-center py-8">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
                <h3 className="text-lg font-medium mb-2">Analyse en cours...</h3>
                <p className="text-muted-foreground mb-6">Extraction des données avec l'OCR Gemini</p>
                <Progress value={processingProgress} className="w-64 mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">
                  {processingProgress}% (
                  {files.filter((f) => f.status !== "pending" && f.status !== "analyzing").length}/{files.length})
                </p>
              </div>

              {/* Mini liste de progression */}
              <ScrollArea className="h-[200px] mt-4">
                <div className="space-y-1">
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                      {f.status === "pending" && (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      {f.status === "analyzing" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                      {f.status === "ready" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                      {f.status === "error" && <XCircle className="h-5 w-5 text-red-500" />}
                      <span className="flex-1 truncate text-sm">{f.file.name}</span>
                      {f.status === "ready" && f.extractedData && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(f.extractedData.confidence * 100)}%
                        </Badge>
                      )}
                      {f.status === "error" && <span className="text-xs text-red-500">{f.error}</span>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* STEP: Validation */}
          {globalStep === "validation" && (
            <div className="flex flex-col h-[calc(90vh-180px)]">
              {/* Toolbar */}
              <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedCount === readyFiles.length && readyFiles.length > 0}
                    onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                  />
                  <span className="text-sm">
                    {selectedCount} sélectionnée{selectedCount > 1 ? "s" : ""} sur {readyFiles.length}
                  </span>

                  {lowConfidenceCount > 0 && (
                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {lowConfidenceCount} à vérifier
                    </Badge>
                  )}

                  {newSuppliersPreview > 0 && (
                    <Badge variant="outline" className="text-blue-600 border-blue-300">
                      <Plus className="h-3 w-3 mr-1" />
                      {newSuppliersPreview} nouveau{newSuppliersPreview > 1 ? "x" : ""} fournisseur
                      {newSuppliersPreview > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setGlobalStep("upload")}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Retour
                  </Button>
                </div>
              </div>

              {/* Table */}
              <ScrollArea className="flex-1">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-10">⚡</TableHead>
                      <TableHead>Fichier</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>N° Facture</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">HT</TableHead>
                      <TableHead className="text-right">TVA</TableHead>
                      <TableHead className="text-right">TTC</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((f) => {
                      if (f.status === "error") {
                        return (
                          <TableRow key={f.id} className="bg-red-50/50">
                            <TableCell></TableCell>
                            <TableCell>
                              <XCircle className="h-4 w-4 text-red-500" />
                            </TableCell>
                            <TableCell className="font-medium">{f.file.name}</TableCell>
                            <TableCell colSpan={7} className="text-red-600 text-sm">
                              {f.error}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFile(f.id)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      if (f.status !== "ready" || !f.editedData) return null;

                      const lowConfidence = (f.extractedData?.confidence || 0) < 0.7;

                      return (
                        <TableRow
                          key={f.id}
                          className={`${lowConfidence ? "bg-orange-50/50" : ""} ${!f.selected ? "opacity-50" : ""}`}
                        >
                          <TableCell>
                            <Checkbox checked={f.selected} onCheckedChange={() => toggleSelect(f.id)} />
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  {lowConfidence ? (
                                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                                  ) : (
                                    <Sparkles className="h-4 w-4 text-green-500" />
                                  )}
                                </TooltipTrigger>
                                <TooltipContent>
                                  Confiance: {Math.round((f.extractedData?.confidence || 0) * 100)}%
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {f.type === "pdf" ? (
                                <FileText className="h-4 w-4 text-red-500 shrink-0" />
                              ) : (
                                <Image className="h-4 w-4 text-blue-500 shrink-0" />
                              )}
                              <span className="truncate max-w-[150px] text-sm">{f.file.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {f.isNewSupplier ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={f.editedData.supplier_name}
                                    onChange={(e) => updateFileData(f.id, "supplier_name", e.target.value)}
                                    className="h-7 text-sm w-32"
                                    placeholder="Nouveau"
                                  />
                                  <Badge variant="outline" className="text-xs text-blue-600 shrink-0">
                                    <Plus className="h-3 w-3" />
                                  </Badge>
                                </div>
                              ) : (
                                <Select
                                  value={f.matchedSupplierId || ""}
                                  onValueChange={(v) => {
                                    if (v === "__new__") {
                                      updateSupplier(f.id, null, true);
                                    } else {
                                      updateSupplier(f.id, v, false);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-sm w-40">
                                    <SelectValue placeholder="Sélectionner" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__new__">
                                      <span className="flex items-center gap-1 text-blue-600">
                                        <Plus className="h-3 w-3" /> Nouveau
                                      </span>
                                    </SelectItem>
                                    {suppliers.map((s) => (
                                      <SelectItem key={s.supplierid} value={s.supplierid.toString()}>
                                        {s.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={f.editedData.invoice_number || ""}
                              onChange={(e) => updateFileData(f.id, "invoice_number", e.target.value || null)}
                              className="h-7 text-sm w-24"
                              placeholder="N°"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={f.editedData.invoice_date || ""}
                              onChange={(e) => updateFileData(f.id, "invoice_date", e.target.value || null)}
                              className="h-7 text-sm w-32"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              value={f.editedData.total_ht || ""}
                              onChange={(e) =>
                                updateFileData(f.id, "total_ht", e.target.value ? parseFloat(e.target.value) : null)
                              }
                              className="h-7 text-sm w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              value={f.editedData.tva_amount || ""}
                              onChange={(e) =>
                                updateFileData(f.id, "tva_amount", e.target.value ? parseFloat(e.target.value) : null)
                              }
                              className="h-7 text-sm w-16 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <Input
                              type="number"
                              step="0.01"
                              value={f.editedData.total_ttc || ""}
                              onChange={(e) =>
                                updateFileData(f.id, "total_ttc", e.target.value ? parseFloat(e.target.value) : null)
                              }
                              className="h-7 text-sm w-20 text-right font-medium"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={f.classificationId || ""}
                              onValueChange={(v) => updateClassification(f.id, v || null)}
                            >
                              <SelectTrigger className="h-7 text-sm w-32">
                                <SelectValue placeholder="Classification" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Aucune</SelectItem>
                                {classifications.map((c) => (
                                  <SelectItem
                                    key={c.purchaseclassificationid || c.id}
                                    value={(c.purchaseclassificationid || c.id)?.toString() || ""}
                                  >
                                    {c.code} - {c.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFile(f.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Footer */}
              <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Total sélectionné:{" "}
                  <span className="font-medium text-foreground">
                    {files
                      .filter((f) => f.selected && f.status === "ready")
                      .reduce((sum, f) => sum + (f.editedData?.total_ttc || 0), 0)
                      .toFixed(2)}{" "}
                    € TTC
                  </span>
                </div>
                <Button onClick={sendToEvoliz} disabled={selectedCount === 0} className="gap-2">
                  <Send className="h-4 w-4" />
                  Envoyer {selectedCount} facture{selectedCount > 1 ? "s" : ""} vers Evoliz
                </Button>
              </div>
            </div>
          )}

          {/* STEP: Sending */}
          {globalStep === "sending" && (
            <div className="p-6">
              <div className="text-center py-8">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
                <h3 className="text-lg font-medium mb-2">Envoi vers Evoliz...</h3>
                <p className="text-muted-foreground mb-6">Création des achats dans votre comptabilité</p>
                <Progress value={sendingProgress} className="w-64 mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">{sendingProgress}%</p>
              </div>
            </div>
          )}

          {/* STEP: Done */}
          {globalStep === "done" && (
            <div className="p-6">
              <div className="text-center py-8">
                {stats.errors === 0 ? (
                  <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                ) : stats.success === 0 ? (
                  <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
                ) : (
                  <AlertCircle className="h-16 w-16 mx-auto text-orange-500 mb-4" />
                )}

                <h3 className="text-xl font-semibold mb-2">
                  {stats.errors === 0
                    ? "Import terminé avec succès !"
                    : stats.success === 0
                      ? "Échec de l'import"
                      : "Import partiellement réussi"}
                </h3>

                <div className="flex justify-center gap-6 my-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{stats.success}</p>
                    <p className="text-sm text-muted-foreground">Envoyée{stats.success > 1 ? "s" : ""}</p>
                  </div>
                  {stats.errors > 0 && (
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-600">{stats.errors}</p>
                      <p className="text-sm text-muted-foreground">Erreur{stats.errors > 1 ? "s" : ""}</p>
                    </div>
                  )}
                  {stats.newSuppliers > 0 && (
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-600">{stats.newSuppliers}</p>
                      <p className="text-sm text-muted-foreground">
                        Fournisseur{stats.newSuppliers > 1 ? "s" : ""} créé{stats.newSuppliers > 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={resetAll}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Nouvel import
                  </Button>
                  <Button onClick={handleClose}>
                    <Check className="h-4 w-4 mr-2" />
                    Terminé
                  </Button>
                </div>
              </div>

              {/* Résumé détaillé */}
              {stats.errors > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-2 text-red-600">Erreurs :</h4>
                  <ScrollArea className="h-[150px] rounded-lg border border-red-200 bg-red-50/50">
                    <div className="p-2 space-y-1">
                      {files
                        .filter((f) => f.status === "error")
                        .map((f) => (
                          <div key={f.id} className="flex items-center gap-2 p-2 text-sm">
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                            <span className="font-medium">{f.file.name}</span>
                            <span className="text-red-600">{f.error}</span>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
