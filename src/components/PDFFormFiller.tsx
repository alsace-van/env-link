import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Download, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown } from "pdf-lib";

interface PDFFormFillerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    name: string;
    file_url: string;
  };
  projectId?: string;
  onSaved?: () => void;
}

interface FormField {
  name: string;
  type: "text" | "checkbox" | "dropdown" | "textarea";
  value: string | boolean;
  options?: string[];
}

export const PDFFormFiller = ({
  open,
  onOpenChange,
  document,
  projectId,
  onSaved,
}: PDFFormFillerProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (open && document) {
      loadPDF();
    }
  }, [open, document]);

  const loadPDF = async () => {
    setLoading(true);
    try {
      // Fetch PDF
      const response = await fetch(document.file_url);
      const arrayBuffer = await response.arrayBuffer();
      
      // Load PDF document
      const pdf = await PDFDocument.load(arrayBuffer);
      setPdfDoc(pdf);

      // Get form
      const form = pdf.getForm();
      const fields = form.getFields();

      // Extract form fields
      const extractedFields: FormField[] = [];
      
      for (const field of fields) {
        const fieldName = field.getName();
        
        if (field instanceof PDFTextField) {
          const textField = field as PDFTextField;
          extractedFields.push({
            name: fieldName,
            type: textField.isMultiline() ? "textarea" : "text",
            value: textField.getText() || "",
          });
        } else if (field instanceof PDFCheckBox) {
          const checkBox = field as PDFCheckBox;
          extractedFields.push({
            name: fieldName,
            type: "checkbox",
            value: checkBox.isChecked(),
          });
        } else if (field instanceof PDFDropdown) {
          const dropdown = field as PDFDropdown;
          extractedFields.push({
            name: fieldName,
            type: "dropdown",
            value: dropdown.getSelected()?.[0] || "",
            options: dropdown.getOptions(),
          });
        }
      }

      setFormFields(extractedFields);
    } catch (error: any) {
      console.error("Erreur lors du chargement du PDF:", error);
      toast.error("Erreur lors du chargement du PDF");
    } finally {
      setLoading(false);
    }
  };

  const updateFieldValue = (fieldName: string, value: string | boolean) => {
    setFormFields(fields =>
      fields.map(field =>
        field.name === fieldName ? { ...field, value } : field
      )
    );
  };

  const fillPDF = async () => {
    if (!pdfDoc) return null;

    try {
      const form = pdfDoc.getForm();

      // Fill in all fields
      for (const field of formFields) {
        try {
          const pdfField = form.getField(field.name);
          
          if (pdfField instanceof PDFTextField) {
            pdfField.setText(field.value as string);
          } else if (pdfField instanceof PDFCheckBox) {
            if (field.value) {
              pdfField.check();
            } else {
              pdfField.uncheck();
            }
          } else if (pdfField instanceof PDFDropdown) {
            pdfField.select(field.value as string);
          }
        } catch (e) {
          console.warn(`Could not fill field ${field.name}:`, e);
        }
      }

      // Flatten form (make fields non-editable)
      form.flatten();

      // Save PDF
      const bytes = await pdfDoc.save();
      return bytes;
    } catch (error: any) {
      console.error("Erreur lors du remplissage du PDF:", error);
      throw error;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Fill PDF
      const filledPdfBytes = await fillPDF();
      if (!filledPdfBytes) {
        throw new Error("Failed to fill PDF");
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Create blob and upload
      const blob = new Blob([filledPdfBytes as any], { type: "application/pdf" });
      const fileName = `${user.id}/${Date.now()}_${document.name}.pdf`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("user-filled-documents")
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("user-filled-documents")
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from("user_filled_documents")
        .insert({
          user_id: user.id,
          project_id: projectId || null,
          official_document_id: document.id,
          name: `${document.name} (rempli)`,
          file_url: urlData.publicUrl,
          filled_data: formFields.reduce((acc, field) => ({
            ...acc,
            [field.name]: field.value
          }), {}),
        });

      if (dbError) throw dbError;

      toast.success("Document sauvegardé avec succès");
      onSaved?.();
    } catch (error: any) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde du document");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    try {
      const filledPdfBytes = await fillPDF();
      if (!filledPdfBytes) return;

      const blob = new Blob([filledPdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${document.name}_rempli.pdf`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PDF téléchargé");
    } catch (error: any) {
      console.error("Erreur lors du téléchargement:", error);
      toast.error("Erreur lors du téléchargement");
    }
  };

  const renderField = (field: FormField) => {
    switch (field.type) {
      case "textarea":
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.name}</Label>
            <Textarea
              id={field.name}
              value={field.value as string}
              onChange={(e) => updateFieldValue(field.name, e.target.value)}
              rows={4}
            />
          </div>
        );

      case "text":
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.name}</Label>
            <Input
              id={field.name}
              value={field.value as string}
              onChange={(e) => updateFieldValue(field.name, e.target.value)}
            />
          </div>
        );

      case "checkbox":
        return (
          <div key={field.name} className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={field.name}
              checked={field.value as boolean}
              onChange={(e) => updateFieldValue(field.name, e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor={field.name} className="cursor-pointer">
              {field.name}
            </Label>
          </div>
        );

      case "dropdown":
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.name}</Label>
            <select
              id={field.name}
              value={field.value as string}
              onChange={(e) => updateFieldValue(field.name, e.target.value)}
              className="w-full h-10 px-3 py-2 text-sm bg-background border rounded-md"
            >
              <option value="">Sélectionnez...</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Remplir : {document.name}</DialogTitle>
          <DialogDescription>
            Remplissez les champs ci-dessous et sauvegardez votre document
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : formFields.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Ce PDF ne contient pas de champs de formulaire à remplir.
              Vous pouvez le télécharger et le remplir manuellement.
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {formFields.map((field) => renderField(field))}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || formFields.length === 0}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
