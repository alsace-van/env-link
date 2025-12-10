import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2,
  Trash2,
  Loader2,
  FileText,
  Check,
  Settings,
  Eye,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface SupplierTemplate {
  id: string;
  supplier_name: string;
  supplier_siret: string | null;
  field_zones: {
    [key: string]: {
      zone: { x: number; y: number; width: number; height: number };
      label_patterns: string[];
      value_format: string;
      confidence: number;
    };
  };
  identification_patterns: string[];
  times_used: number;
  success_rate: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

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

interface SupplierTemplatesManagerProps {
  asDialog?: boolean;
  trigger?: React.ReactNode;
}

export function SupplierTemplatesManager({ asDialog = false, trigger }: SupplierTemplatesManagerProps) {
  const [templates, setTemplates] = useState<SupplierTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SupplierTemplate | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!asDialog || dialogOpen) {
      loadTemplates();
    }
  }, [dialogOpen, asDialog]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase as any)
        .from("supplier_ocr_templates")
        .select("*")
        .eq("user_id", user.id)
        .order("times_used", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error("Erreur chargement templates:", err);
      toast.error("Erreur lors du chargement des templates");
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (template: SupplierTemplate) => {
    setDeleting(template.id);
    try {
      const { error } = await (supabase as any)
        .from("supplier_ocr_templates")
        .delete()
        .eq("id", template.id);

      if (error) throw error;

      setTemplates(templates.filter(t => t.id !== template.id));
      toast.success(`Template "${template.supplier_name}" supprimé`);
    } catch (err) {
      console.error("Erreur suppression:", err);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("fr-FR");
  };

  const getZoneCount = (template: SupplierTemplate) => {
    return Object.keys(template.field_zones || {}).length;
  };

  const getSuccessColor = (rate: number) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  // Panneau de détails du template
  const renderDetailsSheet = () => {
    if (!selectedTemplate) return null;

    return (
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Template: {selectedTemplate.supplier_name}
            </SheetTitle>
            <SheetDescription>
              Configuration OCR pour ce fournisseur
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
            <div className="space-y-6">
              {/* Stats */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Statistiques
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Utilisations</p>
                    <p className="text-lg font-bold">{selectedTemplate.times_used}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Taux de succès</p>
                    <p className={`text-lg font-bold ${getSuccessColor(selectedTemplate.success_rate)}`}>
                      {selectedTemplate.success_rate.toFixed(0)}%
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Dernière utilisation</p>
                    <p className="font-medium">{formatDate(selectedTemplate.last_used_at)}</p>
                  </div>
                </div>
              </div>

              {/* Infos fournisseur */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Fournisseur
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-muted/50 rounded">
                    <span className="text-xs text-muted-foreground">Nom</span>
                    <span className="text-sm font-medium">{selectedTemplate.supplier_name}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded">
                    <span className="text-xs text-muted-foreground">SIRET</span>
                    <span className="text-sm font-mono">{selectedTemplate.supplier_siret || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Patterns d'identification */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Patterns d'identification</h4>
                <div className="flex flex-wrap gap-2">
                  {(selectedTemplate.identification_patterns || []).map((pattern, i) => (
                    <Badge key={i} variant="secondary">{pattern}</Badge>
                  ))}
                </div>
              </div>

              {/* Zones configurées */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Zones configurées ({getZoneCount(selectedTemplate)}/10)
                </h4>
                <div className="space-y-2">
                  {Object.entries(selectedTemplate.field_zones || {}).map(([field, config]) => (
                    <div key={field} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{FIELD_LABELS[field] || field}</span>
                        <Badge variant="outline">
                          {Math.round(config.confidence * 100)}%
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>
                          Position: ({(config.zone.x * 100).toFixed(0)}%, {(config.zone.y * 100).toFixed(0)}%)
                        </p>
                        <p>
                          Taille: {(config.zone.width * 100).toFixed(0)}% × {(config.zone.height * 100).toFixed(0)}%
                        </p>
                        {config.label_patterns.length > 0 && (
                          <p>Labels: {config.label_patterns.join(", ")}</p>
                        )}
                        <p>Format: {config.value_format}</p>
                      </div>
                    </div>
                  ))}

                  {getZoneCount(selectedTemplate) === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucune zone configurée
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="flex-1">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer ce template ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Le template "{selectedTemplate.supplier_name}" sera supprimé.
                        Les futures factures de ce fournisseur utiliseront l'OCR standard.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          deleteTemplate(selectedTemplate);
                          setDetailsOpen(false);
                        }}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  };

  const content = (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement des templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Settings className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Aucun template configuré</p>
          <p className="text-sm mt-2">
            Les templates sont créés automatiquement quand vous annotez une facture
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fournisseur</TableHead>
              <TableHead>SIRET</TableHead>
              <TableHead className="text-center">Zones</TableHead>
              <TableHead className="text-center">Utilisations</TableHead>
              <TableHead className="text-center">Succès</TableHead>
              <TableHead>Dernière utilisation</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{template.supplier_name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {template.supplier_siret || "-"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{getZoneCount(template)}</Badge>
                </TableCell>
                <TableCell className="text-center font-medium">
                  {template.times_used}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Progress value={template.success_rate} className="w-16 h-2" />
                    <span className={`text-sm font-medium ${getSuccessColor(template.success_rate)}`}>
                      {template.success_rate.toFixed(0)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(template.last_used_at)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setDetailsOpen(true);
                      }}
                      title="Voir les détails"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      disabled={deleting === template.id}
                      onClick={() => deleteTemplate(template)}
                    >
                      {deleting === template.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {renderDetailsSheet()}
    </>
  );

  // Mode Dialog
  if (asDialog) {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Templates OCR
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Templates OCR par fournisseur ({templates.length})
            </DialogTitle>
            <DialogDescription>
              Configurations d'extraction personnalisées pour chaque fournisseur
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={loadTemplates}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  // Mode Card
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Templates OCR ({templates.length})
            </CardTitle>
            <CardDescription>
              Configurations par fournisseur
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadTemplates}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
