import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move,
  Square,
  Check,
  X,
  Loader2,
  FileText,
  Building2,
  Hash,
  Euro,
  Calendar,
  Percent,
  AlertCircle,
} from "lucide-react";

// Types
interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
  raw_text?: string;
  confidence?: number;
  label_found?: string;
}

interface DetectedZone {
  zone: BoundingBox;
  value: string | number | null;
  raw_text?: string;
  confidence?: number;
  label_found?: string;
}

interface InvoiceData {
  id: string;
  file_path: string;
  supplier_name: string | null;
  supplier_siret: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total_ht: number | null;
  total_ttc: number | null;
  tva_amount: number | null;
  tva_rate: number | null;
  description: string | null;
  detected_zones?: { [key: string]: DetectedZone } | null;
  zones_validated?: boolean | null;
  template_id?: string | null;
}

interface OCRAnnotatorProps {
  invoice: InvoiceData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

// Couleurs par type de champ
const FIELD_COLORS: { [key: string]: string } = {
  supplier_name: "#3b82f6", // blue
  supplier_siret: "#6366f1", // indigo
  invoice_number: "#8b5cf6", // violet
  invoice_date: "#a855f7", // purple
  due_date: "#d946ef", // fuchsia
  total_ht: "#22c55e", // green
  tva_amount: "#84cc16", // lime
  tva_rate: "#eab308", // yellow
  total_ttc: "#ef4444", // red (important!)
  description: "#64748b", // slate
};

const FIELD_LABELS: { [key: string]: string } = {
  supplier_name: "Fournisseur",
  supplier_siret: "SIRET",
  invoice_number: "N° Facture",
  invoice_date: "Date facture",
  due_date: "Échéance",
  total_ht: "Total HT",
  tva_amount: "TVA",
  tva_rate: "Taux TVA",
  total_ttc: "Total TTC",
  description: "Description",
};

const FIELD_ICONS: { [key: string]: React.ReactNode } = {
  supplier_name: <Building2 className="h-3 w-3" />,
  supplier_siret: <Hash className="h-3 w-3" />,
  invoice_number: <FileText className="h-3 w-3" />,
  invoice_date: <Calendar className="h-3 w-3" />,
  due_date: <Calendar className="h-3 w-3" />,
  total_ht: <Euro className="h-3 w-3" />,
  tva_amount: <Euro className="h-3 w-3" />,
  tva_rate: <Percent className="h-3 w-3" />,
  total_ttc: <Euro className="h-3 w-3" />,
  description: <FileText className="h-3 w-3" />,
};

export function OCRAnnotator({ invoice, open, onOpenChange, onSave }: OCRAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showZones, setShowZones] = useState(true);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [tempZone, setTempZone] = useState<BoundingBox | null>(null);

  // Zones éditables
  const [zones, setZones] = useState<{ [key: string]: DetectedZone }>({});
  const [values, setValues] = useState<{ [key: string]: string }>({});

  // Charger le PDF et les zones
  useEffect(() => {
    if (open && invoice) {
      loadPdf();
      initializeZones();
    }
  }, [open, invoice]);

  const loadPdf = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.storage.from("incoming-invoices").createSignedUrl(invoice.file_path, 3600);

      if (data?.signedUrl) {
        setPdfUrl(data.signedUrl);
      }
    } catch (err) {
      console.error("Erreur chargement PDF:", err);
      toast.error("Impossible de charger le PDF");
    } finally {
      setLoading(false);
    }
  };

  const initializeZones = () => {
    // Initialiser les zones à partir des données détectées
    const detectedZones = invoice.detected_zones || {};
    setZones(detectedZones);

    // Initialiser les valeurs
    const initialValues: { [key: string]: string } = {};
    Object.keys(FIELD_LABELS).forEach((field) => {
      const value = (invoice as any)[field];
      initialValues[field] = value !== null && value !== undefined ? String(value) : "";
    });
    setValues(initialValues);
  };

  // Gestion du dessin de zone
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!selectedField || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setIsDrawing(true);
    setDrawStart({ x, y });
    setTempZone({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !drawStart || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / rect.width;
    const currentY = (e.clientY - rect.top) / rect.height;

    const x = Math.min(drawStart.x, currentX);
    const y = Math.min(drawStart.y, currentY);
    const width = Math.abs(currentX - drawStart.x);
    const height = Math.abs(currentY - drawStart.y);

    setTempZone({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !tempZone || !selectedField) {
      setIsDrawing(false);
      return;
    }

    // Valider la zone (minimum 1% de taille)
    if (tempZone.width > 0.01 && tempZone.height > 0.01) {
      setZones((prev) => ({
        ...prev,
        [selectedField]: {
          zone: tempZone,
          value: values[selectedField] || null,
          confidence: 1, // Défini manuellement = 100% confiance
          label_found: "Défini manuellement",
        },
      }));
      toast.success(`Zone "${FIELD_LABELS[selectedField]}" définie`);
    }

    setIsDrawing(false);
    setDrawStart(null);
    setTempZone(null);
  };

  // Supprimer une zone
  const removeZone = (field: string) => {
    setZones((prev) => {
      const newZones = { ...prev };
      delete newZones[field];
      return newZones;
    });
    toast.success(`Zone "${FIELD_LABELS[field]}" supprimée`);
  };

  // Sauvegarder les modifications
  const handleSave = async (createTemplate: boolean = false) => {
    setSaving(true);
    try {
      // Mettre à jour les zones détectées
      const { error: updateError } = await (supabase as any)
        .from("incoming_invoices")
        .update({
          detected_zones: zones,
          zones_validated: true,
          // Mettre à jour les valeurs aussi
          supplier_name: values.supplier_name || null,
          supplier_siret: values.supplier_siret || null,
          invoice_number: values.invoice_number || null,
          invoice_date: values.invoice_date || null,
          due_date: values.due_date || null,
          total_ht: values.total_ht ? parseFloat(values.total_ht) : null,
          total_ttc: values.total_ttc ? parseFloat(values.total_ttc) : null,
          tva_amount: values.tva_amount ? parseFloat(values.tva_amount) : null,
          tva_rate: values.tva_rate ? parseFloat(values.tva_rate) : null,
          description: values.description || null,
        })
        .eq("id", invoice.id);

      if (updateError) throw updateError;

      // Créer un template si demandé
      if (createTemplate && values.supplier_name) {
        await saveAsTemplate();
      }

      toast.success("Modifications enregistrées");
      onSave();
      onOpenChange(false);
    } catch (err) {
      console.error("Erreur sauvegarde:", err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  // Sauvegarder comme template fournisseur
  const saveAsTemplate = async () => {
    if (!values.supplier_name) {
      toast.error("Nom du fournisseur requis pour créer un template");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      // Préparer les zones du template
      const fieldZones: any = {};
      Object.entries(zones).forEach(([field, data]) => {
        fieldZones[field] = {
          zone: {
            x: data.zone.x,
            y: data.zone.y,
            width: data.zone.width,
            height: data.zone.height,
          },
          label_patterns: data.label_found ? [data.label_found] : [],
          value_format: getValueFormat(field),
          confidence: data.confidence || 1,
        };
      });

      // Patterns d'identification
      const patterns = [values.supplier_name];
      if (values.supplier_siret) patterns.push(values.supplier_siret);

      // Upsert le template
      const { error } = await (supabase as any).from("supplier_ocr_templates").upsert(
        {
          user_id: user.id,
          supplier_name: values.supplier_name,
          supplier_siret: values.supplier_siret || null,
          field_zones: fieldZones,
          identification_patterns: patterns,
        },
        {
          onConflict: "user_id,supplier_name_normalized",
        },
      );

      if (error) throw error;
      toast.success(`Template "${values.supplier_name}" sauvegardé`);
    } catch (err) {
      console.error("Erreur création template:", err);
      toast.error("Erreur lors de la création du template");
    }
  };

  const getValueFormat = (field: string): string => {
    switch (field) {
      case "invoice_date":
      case "due_date":
        return "date";
      case "total_ht":
      case "total_ttc":
      case "tva_amount":
        return "currency";
      case "tva_rate":
        return "currency";
      case "supplier_siret":
        return "siret";
      case "invoice_number":
        return "alphanumeric";
      default:
        return "text";
    }
  };

  // Rendu des zones
  const renderZones = () => {
    if (!showZones) return null;

    return (
      <>
        {/* Zones existantes */}
        {Object.entries(zones).map(([field, data]) => (
          <div
            key={field}
            className="absolute border-2 pointer-events-none"
            style={{
              left: `${data.zone.x * 100}%`,
              top: `${data.zone.y * 100}%`,
              width: `${data.zone.width * 100}%`,
              height: `${data.zone.height * 100}%`,
              borderColor: FIELD_COLORS[field] || "#888",
              backgroundColor: `${FIELD_COLORS[field]}20` || "#88888820",
            }}
          >
            <span
              className="absolute -top-5 left-0 text-[10px] px-1 rounded text-white whitespace-nowrap"
              style={{ backgroundColor: FIELD_COLORS[field] || "#888" }}
            >
              {FIELD_LABELS[field]}
            </span>
          </div>
        ))}

        {/* Zone en cours de dessin */}
        {tempZone && (
          <div
            className="absolute border-2 border-dashed pointer-events-none"
            style={{
              left: `${tempZone.x * 100}%`,
              top: `${tempZone.y * 100}%`,
              width: `${tempZone.width * 100}%`,
              height: `${tempZone.height * 100}%`,
              borderColor: selectedField ? FIELD_COLORS[selectedField] : "#888",
              backgroundColor: selectedField ? `${FIELD_COLORS[selectedField]}30` : "#88888830",
            }}
          />
        )}
      </>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[95vw] sm:max-w-[95vw] p-0" side="bottom" style={{ height: "90vh" }}>
        <div className="flex h-full">
          {/* Panel gauche - PDF avec annotations */}
          <div className="flex-1 flex flex-col bg-muted/50">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 border-b bg-background">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <Button variant={showZones ? "default" : "outline"} size="sm" onClick={() => setShowZones(!showZones)}>
                  {showZones ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
                  Zones
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {selectedField && (
                  <Badge style={{ backgroundColor: FIELD_COLORS[selectedField] }}>
                    <Square className="h-3 w-3 mr-1" />
                    Dessiner: {FIELD_LABELS[selectedField]}
                  </Badge>
                )}
              </div>
            </div>

            {/* Zone PDF */}
            <div className="flex-1 overflow-hidden p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : pdfUrl ? (
                <div
                  ref={containerRef}
                  className={`relative mx-auto bg-white shadow-lg h-full ${selectedField ? "cursor-crosshair" : "cursor-default"}`}
                  style={{
                    width: `${zoom * 100}%`,
                    maxWidth: `${zoom * 800}px`,
                  }}
                  onMouseDown={selectedField ? handleMouseDown : undefined}
                  onMouseMove={selectedField ? handleMouseMove : undefined}
                  onMouseUp={selectedField ? handleMouseUp : undefined}
                  onMouseLeave={selectedField ? handleMouseUp : undefined}
                >
                  {/* PDF viewer - interactif seulement quand on n'est pas en mode dessin */}
                  <iframe
                    src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                    className={`w-full h-full border-0 ${selectedField ? "pointer-events-none" : ""}`}
                    style={{ minHeight: "calc(90vh - 180px)" }}
                    title="PDF Preview"
                  />

                  {/* Overlay pour les zones - seulement en mode dessin ou si zones visibles */}
                  {(selectedField || showZones) && (
                    <div className="absolute inset-0 pointer-events-none">{renderZones()}</div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mr-2" />
                  Impossible de charger le PDF
                </div>
              )}
            </div>
          </div>

          {/* Panel droit - Champs et valeurs */}
          <div className="w-[400px] border-l bg-background flex flex-col">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>Annotation OCR</SheetTitle>
              <SheetDescription>Cliquez sur un champ puis dessinez sa zone sur le PDF</SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {Object.entries(FIELD_LABELS).map(([field, label]) => {
                  const zone = zones[field];
                  const hasZone = !!zone;
                  const isSelected = selectedField === field;

                  return (
                    <div
                      key={field}
                      className={`p-3 rounded-lg border-2 transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : hasZone
                            ? "border-green-500/50 bg-green-50/50"
                            : "border-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: FIELD_COLORS[field] }} />
                          <span className="text-sm font-medium flex items-center gap-1">
                            {FIELD_ICONS[field]}
                            {label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {hasZone && (
                            <>
                              <Badge variant="outline" className="text-xs">
                                {Math.round((zone.confidence || 0) * 100)}%
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive"
                                onClick={() => removeZone(field)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => setSelectedField(isSelected ? null : field)}
                          >
                            <Square className="h-3 w-3 mr-1" />
                            {isSelected ? "Annuler" : "Dessiner"}
                          </Button>
                        </div>
                      </div>

                      <Input
                        value={values[field] || ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field]: e.target.value }))}
                        placeholder={`Valeur ${label.toLowerCase()}`}
                        className="h-8 text-sm"
                      />

                      {zone?.raw_text && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">Texte brut: {zone.raw_text}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <SheetFooter className="p-4 border-t">
              <div className="flex flex-col gap-2 w-full">
                <Button onClick={() => handleSave(false)} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Enregistrer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSave(true)}
                  disabled={saving || !values.supplier_name}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer + Créer Template
                </Button>
              </div>
            </SheetFooter>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
