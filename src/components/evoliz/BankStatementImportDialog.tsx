// ============================================
// DIALOG IMPORT RELEVÉ BANCAIRE PDF
// Upload PDF + OCR Gemini → Lignes à valider
// ============================================

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Import,
  FileText,
  TrendingUp,
  TrendingDown,
  Building,
  Calendar,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Types
interface BankLine {
  id: string;
  date: string;
  label: string;
  amount: number;
  type: "debit" | "credit";
  selected: boolean;
  // Pour liaison avec facture
  linkedInvoiceId?: string;
}

interface BankStatementInfo {
  bank_name?: string;
  account_number?: string;
  period_start?: string;
  period_end?: string;
  opening_balance?: number;
  closing_balance?: number;
}

type Step = "upload" | "analyzing" | "validation" | "importing" | "success" | "error";

interface BankStatementImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinesImported: (lines: Array<{
    id: string;
    type: "entree" | "sortie";
    date: string;
    label: string;
    amount: number;
    bankLineId: string;
  }>) => void;
}

export function BankStatementImportDialog({
  open,
  onOpenChange,
  onLinesImported,
}: BankStatementImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  
  // Données extraites
  const [bankInfo, setBankInfo] = useState<BankStatementInfo | null>(null);
  const [lines, setLines] = useState<BankLine[]>([]);
  
  // Sélection
  const [selectAll, setSelectAll] = useState(true);

  // Reset
  const handleClose = () => {
    setStep("upload");
    setError(null);
    setFileName("");
    setBankInfo(null);
    setLines([]);
    setSelectAll(true);
    onOpenChange(false);
  };

  // Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    if (file.type !== "application/pdf") {
      toast.error("Seuls les fichiers PDF sont acceptés");
      return;
    }
    
    setFileName(file.name);
    analyzeStatement(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    maxSize: 15 * 1024 * 1024, // 15 MB
  });

  // Analyser le relevé avec Gemini
  const analyzeStatement = async (file: File) => {
    setStep("analyzing");
    setError(null);
    
    try {
      // Convertir en base64
      const base64 = await fileToBase64(file);
      
      // Appeler l'edge function
      const { data, error } = await supabase.functions.invoke("gemini-bank-statement-ocr", {
        body: {
          image: base64,
          mimeType: "application/pdf",
          fileName: file.name,
        },
      });
      
      if (error) throw error;
      
      if (!data || !data.success) {
        throw new Error(data?.error || "Erreur lors de l'extraction");
      }
      
      // Stocker les infos du relevé
      setBankInfo({
        bank_name: data.bank_name,
        account_number: data.account_number,
        period_start: data.period_start,
        period_end: data.period_end,
        opening_balance: data.opening_balance,
        closing_balance: data.closing_balance,
      });
      
      // Préparer les lignes avec ID et sélection
      const extractedLines: BankLine[] = (data.lines || []).map((line: any, index: number) => ({
        id: `bank-${Date.now()}-${index}`,
        date: line.date,
        label: line.label,
        amount: line.amount,
        type: line.type,
        selected: true,
      }));
      
      setLines(extractedLines);
      setStep("validation");
      
      toast.success(`${extractedLines.length} opérations extraites`);
    } catch (err) {
      console.error("Erreur extraction:", err);
      setError(err instanceof Error ? err.message : "Erreur lors de l'extraction");
      setStep("error");
    }
  };

  // Toggle sélection d'une ligne
  const toggleLine = (id: string) => {
    setLines(prev => prev.map(line => 
      line.id === id ? { ...line, selected: !line.selected } : line
    ));
  };

  // Toggle tout sélectionner
  const toggleSelectAll = () => {
    const newValue = !selectAll;
    setSelectAll(newValue);
    setLines(prev => prev.map(line => ({ ...line, selected: newValue })));
  };

  // Importer les lignes sélectionnées
  const importLines = () => {
    const selectedLines = lines.filter(l => l.selected);
    
    if (selectedLines.length === 0) {
      toast.error("Sélectionnez au moins une ligne");
      return;
    }
    
    // Convertir pour le parent
    const importedLines = selectedLines.map(line => ({
      id: crypto.randomUUID(),
      type: line.type === "credit" ? "entree" as const : "sortie" as const,
      date: line.date,
      label: line.label,
      amount: Math.abs(line.amount),
      bankLineId: line.id,
    }));
    
    onLinesImported(importedLines);
    toast.success(`${importedLines.length} lignes importées`);
    setStep("success");
  };

  // Helper
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  // Formater la date pour affichage
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("fr-FR");
    } catch {
      return dateStr;
    }
  };

  // Formater le montant
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  // Stats
  const selectedCount = lines.filter(l => l.selected).length;
  const totalDebits = lines.filter(l => l.selected && l.type === "debit").reduce((sum, l) => sum + Math.abs(l.amount), 0);
  const totalCredits = lines.filter(l => l.selected && l.type === "credit").reduce((sum, l) => sum + l.amount, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            Importer un relevé bancaire PDF
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Déposez votre relevé bancaire au format PDF"}
            {step === "analyzing" && "Extraction des opérations en cours..."}
            {step === "validation" && "Sélectionnez les opérations à importer"}
            {step === "importing" && "Import en cours..."}
            {step === "success" && "Import terminé !"}
            {step === "error" && "Une erreur est survenue"}
          </DialogDescription>
        </DialogHeader>

        {/* ÉTAPE: Upload */}
        {step === "upload" && (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-10 text-center cursor-pointer
              transition-colors duration-200
              ${isDragActive 
                ? "border-blue-500 bg-blue-50" 
                : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
              }
            `}
          >
            <input {...getInputProps()} />
            <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            {isDragActive ? (
              <p className="text-blue-600 font-medium text-lg">Déposez le fichier ici...</p>
            ) : (
              <div className="space-y-2">
                <p className="font-medium text-lg">Glissez-déposez votre relevé bancaire</p>
                <p className="text-sm text-muted-foreground">
                  Format PDF uniquement • Max 15 Mo
                </p>
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE: Analyse */}
        {step === "analyzing" && (
          <div className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-blue-500 mb-4" />
            <p className="text-lg font-medium">Analyse du relevé...</p>
            <p className="text-sm text-muted-foreground mt-2">{fileName}</p>
          </div>
        )}

        {/* ÉTAPE: Validation */}
        {step === "validation" && (
          <div className="space-y-4">
            {/* Infos du relevé */}
            {bankInfo && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted rounded-lg text-sm">
                {bankInfo.bank_name && (
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{bankInfo.bank_name}</span>
                  </div>
                )}
                {bankInfo.period_start && bankInfo.period_end && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(bankInfo.period_start)} → {formatDate(bankInfo.period_end)}</span>
                  </div>
                )}
                {bankInfo.opening_balance !== undefined && (
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                    <span>Solde initial: {formatAmount(bankInfo.opening_balance)}</span>
                  </div>
                )}
                {bankInfo.closing_balance !== undefined && (
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                    <span>Solde final: {formatAmount(bankInfo.closing_balance)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Stats de sélection */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectAll}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm font-medium">Tout sélectionner</span>
                </label>
                <Badge variant="outline">{selectedCount} / {lines.length} sélectionnées</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  +{formatAmount(totalCredits)}
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <TrendingDown className="h-4 w-4" />
                  -{formatAmount(totalDebits)}
                </span>
              </div>
            </div>

            {/* Table des lignes */}
            <ScrollArea className="h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="w-[100px]">Date</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="w-[120px] text-right">Montant</TableHead>
                    <TableHead className="w-[80px] text-center">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow 
                      key={line.id}
                      className={`cursor-pointer ${!line.selected ? "opacity-50" : ""}`}
                      onClick={() => toggleLine(line.id)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={line.selected}
                          onCheckedChange={() => toggleLine(line.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDate(line.date)}
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-1" title={line.label}>
                          {line.label}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${line.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                        {line.type === "credit" ? "+" : "-"}{formatAmount(Math.abs(line.amount))}
                      </TableCell>
                      <TableCell className="text-center">
                        {line.type === "credit" ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Entrée
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Sortie
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button
                onClick={importLines}
                disabled={selectedCount === 0}
                className="gap-2"
              >
                <Import className="h-4 w-4" />
                Importer {selectedCount} ligne{selectedCount > 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {/* ÉTAPE: Succès */}
        {step === "success" && (
          <div className="py-10 text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 mx-auto text-green-500" />
            <div>
              <p className="font-semibold text-lg">Import terminé !</p>
              <p className="text-sm text-muted-foreground">
                Les lignes ont été ajoutées au tableau
              </p>
            </div>
            <Button onClick={handleClose}>
              Fermer
            </Button>
          </div>
        )}

        {/* ÉTAPE: Erreur */}
        {step === "error" && (
          <div className="py-10 text-center space-y-4">
            <AlertCircle className="h-14 w-14 mx-auto text-red-500" />
            <div>
              <p className="font-semibold text-lg">Erreur d'extraction</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={() => setStep("upload")}>
              Réessayer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
