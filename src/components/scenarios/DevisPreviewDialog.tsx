// components/scenarios/DevisPreviewDialog.tsx
// Aperçu complet du devis (matériel + travaux)
// ✅ Drag & Drop pour réorganiser les articles

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Printer, Package, Wrench, Euro, User, Car, Building2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface DevisPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  scenarioId: string;
}

interface ProjectInfo {
  nom_proprietaire: string;
  prenom_proprietaire?: string;
  adresse_proprietaire?: string;
  code_postal_proprietaire?: string;
  ville_proprietaire?: string;
  telephone_proprietaire?: string;
  email_proprietaire?: string;
  nom_projet?: string;
  marque_vehicule?: string;
  modele_vehicule?: string;
  immatriculation?: string;
}

interface Expense {
  id: string;
  nom_accessoire: string;
  categorie: string;
  quantite: number;
  prix: number;
  prix_vente_ttc: number;
  reference?: string;
  marque?: string;
}

interface WorkTask {
  id: string;
  title: string;
  description?: string;
  forfait_ht: number;
  forfait_ttc: number;
  tva_rate: number;
  estimated_hours?: number;
  work_categories?: {
    name: string;
    icon: string;
  };
}

// Composant pour une ligne draggable de matériel
const SortableExpenseRow = ({ item, formatCurrency }: { item: Expense; formatCurrency: (n: number) => string }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? "var(--accent)" : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-8">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{item.nom_accessoire}</p>
          {item.reference && <p className="text-xs text-muted-foreground">Réf: {item.reference}</p>}
        </div>
      </TableCell>
      <TableCell className="text-center">{item.quantite || 1}</TableCell>
      <TableCell className="text-right">{formatCurrency(item.prix_vente_ttc || 0)}</TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency((item.prix_vente_ttc || 0) * (item.quantite || 1))}
      </TableCell>
    </TableRow>
  );
};

// Composant pour une ligne draggable de travaux
const SortableTaskRow = ({ task, formatCurrency }: { task: WorkTask; formatCurrency: (n: number) => string }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? "var(--accent)" : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-8">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{task.title}</p>
          {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
        </div>
      </TableCell>
      <TableCell className="text-right">{task.estimated_hours ? `${task.estimated_hours}h` : "-"}</TableCell>
      <TableCell className="text-right">{formatCurrency(task.forfait_ht || 0)}</TableCell>
      <TableCell className="text-right font-medium">{formatCurrency(task.forfait_ttc || 0)}</TableCell>
    </TableRow>
  );
};

const DevisPreviewDialog = ({ open, onOpenChange, projectId, scenarioId }: DevisPreviewDialogProps) => {
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Sensors pour le drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Charger les données
  useEffect(() => {
    if (open && projectId && scenarioId) {
      loadAllData();
    }
  }, [open, projectId, scenarioId]);

  const loadAllData = async () => {
    setIsLoading(true);
    await Promise.all([loadProjectInfo(), loadExpenses(), loadWorkTasks(), loadCompanyInfo()]);
    setIsLoading(false);
  };

  const loadProjectInfo = async () => {
    const { data } = await (supabase as any).from("projects").select("*").eq("id", projectId).single();

    if (data) setProjectInfo(data as ProjectInfo);
  };

  const loadExpenses = async () => {
    const { data } = await (supabase as any)
      .from("project_expenses")
      .select("*")
      .eq("scenario_id", scenarioId)
      .neq("est_archive", true)
      .order("categorie");

    if (data) setExpenses(data);
  };

  const loadWorkTasks = async () => {
    const { data } = await (supabase as any)
      .from("project_todos")
      .select(
        `
        *,
        work_categories (
          name,
          icon
        )
      `,
      )
      .eq("work_scenario_id", scenarioId)
      .not("category_id", "is", null)
      .order("display_order");

    if (data) setWorkTasks(data as any);
  };

  const loadCompanyInfo = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await (supabase as any).from("user_settings").select("*").eq("user_id", user.id).single();

      if (data) setCompanyInfo(data);
    }
  };

  // Gestion du drag & drop pour les dépenses
  const handleExpenseDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setExpenses((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Gestion du drag & drop pour les travaux
  const handleTaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setWorkTasks((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Calculs des totaux
  const materialsTotal = {
    ht: expenses.reduce((sum, e) => sum + ((e.prix_vente_ttc || 0) / 1.2) * (e.quantite || 1), 0),
    ttc: expenses.reduce((sum, e) => sum + (e.prix_vente_ttc || 0) * (e.quantite || 1), 0),
  };

  const workTotal = {
    ht: workTasks.reduce((sum, t) => sum + (t.forfait_ht || 0), 0),
    ttc: workTasks.reduce((sum, t) => sum + (t.forfait_ttc || 0), 0),
  };

  const grandTotal = {
    ht: materialsTotal.ht + workTotal.ht,
    ttc: materialsTotal.ttc + workTotal.ttc,
    tva: materialsTotal.ttc + workTotal.ttc - (materialsTotal.ht + workTotal.ht),
  };

  // Format monétaire
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Impression
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Devis - ${projectInfo?.nom_projet || projectInfo?.nom_proprietaire}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
            h1 { font-size: 24px; margin-bottom: 20px; }
            h2 { font-size: 16px; margin: 20px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #333; }
            h3 { font-size: 14px; margin: 15px 0 8px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f5f5f5; font-weight: bold; }
            .text-right { text-align: right; }
            .total-row { font-weight: bold; background: #f0f0f0; }
            .grand-total { font-size: 16px; background: #e8f5e9; }
            .header-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .client-info, .company-info { width: 45%; }
            .vehicle-info { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
            .grip-cell { display: none; }
            @media print {
              body { padding: 0; }
              button { display: none; }
              .grip-cell { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <div className="flex items-center justify-center py-12">Chargement du devis...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-5 w-5" />
              Aperçu du Devis
            </DialogTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">
                <GripVertical className="h-3 w-3 mr-1" />
                Glisser pour réorganiser
              </Badge>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <div ref={printRef} className="p-6 space-y-6">
            {/* En-tête avec infos entreprise et client */}
            <div className="grid grid-cols-2 gap-6">
              {/* Entreprise */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Émetteur
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-bold">{companyInfo?.company_name || "Votre entreprise"}</p>
                  {companyInfo?.company_address && <p>{companyInfo.company_address}</p>}
                  {companyInfo?.company_phone && <p>Tél: {companyInfo.company_phone}</p>}
                  {companyInfo?.company_email && <p>Email: {companyInfo.company_email}</p>}
                  {companyInfo?.company_siret && <p>SIRET: {companyInfo.company_siret}</p>}
                </CardContent>
              </Card>

              {/* Client */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Client
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-bold">
                    {projectInfo?.prenom_proprietaire} {projectInfo?.nom_proprietaire}
                  </p>
                  {projectInfo?.adresse_proprietaire && <p>{projectInfo.adresse_proprietaire}</p>}
                  {(projectInfo?.code_postal_proprietaire || projectInfo?.ville_proprietaire) && (
                    <p>
                      {projectInfo.code_postal_proprietaire} {projectInfo.ville_proprietaire}
                    </p>
                  )}
                  {projectInfo?.telephone_proprietaire && <p>Tél: {projectInfo.telephone_proprietaire}</p>}
                  {projectInfo?.email_proprietaire && <p>Email: {projectInfo.email_proprietaire}</p>}
                </CardContent>
              </Card>
            </div>

            {/* Infos véhicule */}
            {(projectInfo?.marque_vehicule || projectInfo?.immatriculation) && (
              <Card className="bg-slate-50 dark:bg-slate-900">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <Car className="h-8 w-8 text-slate-500" />
                    <div>
                      <p className="font-bold text-lg">
                        {projectInfo.marque_vehicule} {projectInfo.modele_vehicule}
                      </p>
                      {projectInfo.immatriculation && (
                        <p className="text-muted-foreground">Immatriculation: {projectInfo.immatriculation}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">DEVIS N° {format(new Date(), "yyyyMMdd")}-001</h2>
                <p className="text-sm text-muted-foreground">
                  Date: {format(new Date(), "dd MMMM yyyy", { locale: fr })}
                </p>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-2">
                Validité: 30 jours
              </Badge>
            </div>

            <Separator />

            {/* Section Matériel avec Drag & Drop */}
            {expenses.length > 0 && (
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Package className="h-5 w-5" />
                  Matériel & Fournitures
                </h2>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleExpenseDragEnd}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8 grip-cell"></TableHead>
                        <TableHead className="w-[50%]">Désignation</TableHead>
                        <TableHead className="text-center">Qté</TableHead>
                        <TableHead className="text-right">P.U. TTC</TableHead>
                        <TableHead className="text-right">Total TTC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SortableContext items={expenses.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                        {expenses.map((item) => (
                          <SortableExpenseRow key={item.id} item={item} formatCurrency={formatCurrency} />
                        ))}
                      </SortableContext>
                    </TableBody>
                  </Table>
                </DndContext>

                <div className="flex justify-end mt-4">
                  <Card className="w-64 bg-blue-50 dark:bg-blue-950/30">
                    <CardContent className="py-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Sous-total HT:</span>
                        <span className="font-medium">{formatCurrency(materialsTotal.ht)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold">
                        <span>Sous-total TTC:</span>
                        <span>{formatCurrency(materialsTotal.ttc)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Section Travaux avec Drag & Drop */}
            {workTasks.length > 0 && (
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Wrench className="h-5 w-5" />
                  Main d'œuvre & Prestations
                </h2>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8 grip-cell"></TableHead>
                        <TableHead className="w-[50%]">Prestation</TableHead>
                        <TableHead className="text-right">Durée est.</TableHead>
                        <TableHead className="text-right">Montant HT</TableHead>
                        <TableHead className="text-right">Montant TTC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SortableContext items={workTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                        {workTasks.map((task) => (
                          <SortableTaskRow key={task.id} task={task} formatCurrency={formatCurrency} />
                        ))}
                      </SortableContext>
                    </TableBody>
                  </Table>
                </DndContext>

                <div className="flex justify-end mt-4">
                  <Card className="w-64 bg-indigo-50 dark:bg-indigo-950/30">
                    <CardContent className="py-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Sous-total HT:</span>
                        <span className="font-medium">{formatCurrency(workTotal.ht)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold">
                        <span>Sous-total TTC:</span>
                        <span>{formatCurrency(workTotal.ttc)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            <Separator />

            {/* Total général */}
            <div className="flex justify-end">
              <Card className="w-80 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-300">
                <CardContent className="py-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total HT:</span>
                    <span className="font-medium">{formatCurrency(grandTotal.ht)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>TVA (20%):</span>
                    <span className="font-medium">{formatCurrency(grandTotal.tva)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>TOTAL TTC:</span>
                    <span className="text-emerald-700 dark:text-emerald-400">{formatCurrency(grandTotal.ttc)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Conditions */}
            <Card className="bg-muted/30">
              <CardContent className="py-4 text-xs text-muted-foreground space-y-2">
                <p>
                  <strong>Conditions de règlement:</strong> 30% à la commande, solde à la livraison.
                </p>
                <p>
                  <strong>Délai de réalisation:</strong> À définir selon planning.
                </p>
                <p>
                  <strong>Validité du devis:</strong> 30 jours à compter de la date d'émission.
                </p>
                <p className="pt-2">Bon pour accord, date et signature du client:</p>
                <div className="h-16 border border-dashed border-muted-foreground/30 rounded mt-2"></div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default DevisPreviewDialog;
