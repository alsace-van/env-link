// ============================================
// ExportToEvolizDialog.tsx
// Export scénario + travaux vers devis Evoliz
// - Matériel (project_expenses) → Lignes articles
// - Travaux avec forfait (project_todos) → Lignes MO
// ============================================

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileUp, Package, Wrench, ExternalLink, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { evolizService } from "@/services/evolizService";
import type { EvolizClient } from "@/types/evoliz.types";

interface ExpenseItem {
  id: string;
  nom_accessoire: string;
  quantite: number;
  prix: number; // Prix achat HT
  prix_vente_ttc?: number;
  categorie?: string;
  selected: boolean;
}

interface WorkItem {
  id: string;
  title: string;
  category_name?: string;
  forfait_ttc?: number;
  estimated_hours?: number;
  selected: boolean;
}

interface ExportToEvolizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  scenarioId?: string;
  projectName?: string;
}

export function ExportToEvolizDialog({
  open,
  onOpenChange,
  projectId,
  scenarioId,
  projectName,
}: ExportToEvolizDialogProps) {
  const [clients, setClients] = useState<EvolizClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [quoteLabel, setQuoteLabel] = useState(projectName || "Devis aménagement");
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [includeWork, setIncludeWork] = useState(true);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [createdQuoteUrl, setCreatedQuoteUrl] = useState<string | null>(null);

  // Charger les clients Evoliz
  useEffect(() => {
    if (open) {
      loadClients();
      loadExpenses();
      loadWorkItems();
      setCreatedQuoteUrl(null);
    }
  }, [open, projectId, scenarioId]);

  const loadClients = async () => {
    setIsLoadingClients(true);
    try {
      const result = await evolizService.getClients();
      setClients(result.data || []);
    } catch (error) {
      console.error("Erreur chargement clients:", error);
      toast.error("Impossible de charger les clients Evoliz");
    } finally {
      setIsLoadingClients(false);
    }
  };

  // Charger les dépenses du scénario
  const loadExpenses = async () => {
    const query = (supabase as any)
      .from("project_expenses")
      .select("id, nom_accessoire, quantite, prix, prix_vente_ttc, categorie")
      .eq("project_id", projectId);

    if (scenarioId) {
      query.eq("scenario_id", scenarioId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Erreur chargement dépenses:", error);
      return;
    }

    setExpenses(
      (data || []).map((e: any) => ({
        ...e,
        selected: true,
      }))
    );
  };

  // Charger les travaux avec forfait
  const loadWorkItems = async () => {
    const { data, error } = await (supabase as any)
      .from("project_todos")
      .select(`
        id, 
        title, 
        forfait_ttc, 
        estimated_hours,
        work_categories (name)
      `)
      .eq("project_id", projectId)
      .not("forfait_ttc", "is", null);

    if (error) {
      console.error("Erreur chargement travaux:", error);
      return;
    }

    setWorkItems(
      (data || []).map((w: any) => ({
        id: w.id,
        title: w.title,
        category_name: w.work_categories?.name,
        forfait_ttc: w.forfait_ttc,
        estimated_hours: w.estimated_hours,
        selected: true,
      }))
    );
  };

  // Toggle sélection expense
  const toggleExpense = (id: string) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e))
    );
  };

  // Toggle sélection work
  const toggleWork = (id: string) => {
    setWorkItems((prev) =>
      prev.map((w) => (w.id === id ? { ...w, selected: !w.selected } : w))
    );
  };

  // Sélectionner/désélectionner tout
  const selectAllExpenses = (selected: boolean) => {
    setExpenses((prev) => prev.map((e) => ({ ...e, selected })));
  };

  const selectAllWork = (selected: boolean) => {
    setWorkItems((prev) => prev.map((w) => ({ ...w, selected })));
  };

  // Calculs totaux
  const selectedExpenses = expenses.filter((e) => e.selected && includeExpenses);
  const selectedWork = workItems.filter((w) => w.selected && includeWork);

  const totalExpensesHT = selectedExpenses.reduce((sum, e) => {
    const prixVenteHT = e.prix_vente_ttc ? e.prix_vente_ttc / 1.2 : e.prix;
    return sum + prixVenteHT * e.quantite;
  }, 0);

  const totalWorkHT = selectedWork.reduce((sum, w) => {
    return sum + (w.forfait_ttc || 0) / 1.2;
  }, 0);

  const totalHT = totalExpensesHT + totalWorkHT;

  // Mutation création devis
  const createQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClientId) {
        throw new Error("Veuillez sélectionner un client");
      }

      // Construire les lignes du devis
      const items: any[] = [];

      // Lignes matériel
      if (includeExpenses) {
        selectedExpenses.forEach((expense) => {
          const prixVenteHT = expense.prix_vente_ttc
            ? expense.prix_vente_ttc / 1.2
            : expense.prix;

          items.push({
            designation: expense.nom_accessoire,
            quantity: expense.quantite,
            unit: "pce",
            unit_price_vat_exclude: Math.round(prixVenteHT * 100) / 100,
            vat_rate: 20,
          });
        });
      }

      // Lignes main d'œuvre (forfaits)
      if (includeWork) {
        selectedWork.forEach((work) => {
          const forfaitHT = (work.forfait_ttc || 0) / 1.2;

          items.push({
            designation: work.title,
            quantity: 1,
            unit: "forfait",
            unit_price_vat_exclude: Math.round(forfaitHT * 100) / 100,
            vat_rate: 20,
          });
        });
      }

      if (items.length === 0) {
        throw new Error("Aucun article sélectionné");
      }

      // Créer le devis via l'API Evoliz
      const quote = await evolizService.createQuote({
        clientid: parseInt(selectedClientId),
        label: quoteLabel,
        items,
      });

      return quote;
    },
    onSuccess: (quote) => {
      toast.success(`Devis ${quote.document_number} créé !`);
      
      // Construire l'URL vers Evoliz
      const evolizUrl = `https://www.evoliz.com/devis/${quote.quoteid}`;
      setCreatedQuoteUrl(evolizUrl);
    },
    onError: (error: any) => {
      console.error("Erreur création devis:", error);
      toast.error("Erreur : " + error.message);
    },
  });

  // Si devis créé, afficher le succès
  if (createdQuoteUrl) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              Devis créé avec succès !
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-muted-foreground">
              Le devis a été créé en brouillon sur Evoliz. Vous pouvez maintenant
              le vérifier et l'envoyer à votre client.
            </p>

            <Button
              className="w-full"
              onClick={() => window.open(createdQuoteUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ouvrir dans Evoliz
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Exporter vers Evoliz
          </DialogTitle>
          <DialogDescription>
            Créer un devis Evoliz à partir du scénario et des travaux
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Sélection client + objet */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client Evoliz *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingClients ? (
                    <div className="p-2 text-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Chargement...
                    </div>
                  ) : (
                    clients.map((client) => (
                      <SelectItem key={client.clientid} value={String(client.clientid)}>
                        {client.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Objet du devis</Label>
              <Input
                value={quoteLabel}
                onChange={(e) => setQuoteLabel(e.target.value)}
                placeholder="Aménagement fourgon..."
              />
            </div>
          </div>

          {/* Section Matériel */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={includeExpenses}
                  onCheckedChange={(c) => setIncludeExpenses(!!c)}
                />
                <Label className="flex items-center gap-2 cursor-pointer">
                  <Package className="h-4 w-4 text-blue-600" />
                  Matériel (scénario)
                </Label>
                <span className="text-sm text-muted-foreground">
                  {selectedExpenses.length}/{expenses.length} articles
                </span>
              </div>
              {includeExpenses && expenses.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selectAllExpenses(true)}
                  >
                    Tout
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selectAllExpenses(false)}
                  >
                    Aucun
                  </Button>
                </div>
              )}
            </div>

            {includeExpenses && expenses.length > 0 && (
              <ScrollArea className="h-[150px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className={`flex items-center justify-between p-2 rounded hover:bg-muted/50 ${
                        expense.selected ? "" : "opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={expense.selected}
                          onCheckedChange={() => toggleExpense(expense.id)}
                        />
                        <span className="text-sm">{expense.nom_accessoire}</span>
                        {expense.quantite > 1 && (
                          <span className="text-xs text-muted-foreground">
                            ×{expense.quantite}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium">
                        {(
                          (expense.prix_vente_ttc
                            ? expense.prix_vente_ttc / 1.2
                            : expense.prix) * expense.quantite
                        ).toFixed(2)}{" "}
                        € HT
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {includeExpenses && expenses.length === 0 && (
              <div className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
                Aucun article dans le scénario
              </div>
            )}
          </div>

          {/* Section Travaux */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={includeWork}
                  onCheckedChange={(c) => setIncludeWork(!!c)}
                />
                <Label className="flex items-center gap-2 cursor-pointer">
                  <Wrench className="h-4 w-4 text-orange-600" />
                  Main d'œuvre (travaux)
                </Label>
                <span className="text-sm text-muted-foreground">
                  {selectedWork.length}/{workItems.length} forfaits
                </span>
              </div>
              {includeWork && workItems.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selectAllWork(true)}
                  >
                    Tout
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selectAllWork(false)}
                  >
                    Aucun
                  </Button>
                </div>
              )}
            </div>

            {includeWork && workItems.length > 0 && (
              <ScrollArea className="h-[150px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {workItems.map((work) => (
                    <div
                      key={work.id}
                      className={`flex items-center justify-between p-2 rounded hover:bg-muted/50 ${
                        work.selected ? "" : "opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={work.selected}
                          onCheckedChange={() => toggleWork(work.id)}
                        />
                        <span className="text-sm">{work.title}</span>
                        {work.category_name && (
                          <span className="text-xs text-muted-foreground">
                            ({work.category_name})
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium">
                        {((work.forfait_ttc || 0) / 1.2).toFixed(2)} € HT
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {includeWork && workItems.length === 0 && (
              <div className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                Aucune tâche avec forfait défini
              </div>
            )}
          </div>

          {/* Récapitulatif */}
          <div className="p-4 bg-muted/30 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                Matériel ({selectedExpenses.length} articles)
              </span>
              <span>{totalExpensesHT.toFixed(2)} € HT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-orange-600" />
                Main d'œuvre ({selectedWork.length} forfaits)
              </span>
              <span>{totalWorkHT.toFixed(2)} € HT</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total devis HT</span>
              <span>{totalHT.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Total TTC (20%)</span>
              <span>{(totalHT * 1.2).toFixed(2)} €</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => createQuoteMutation.mutate()}
            disabled={
              createQuoteMutation.isPending ||
              !selectedClientId ||
              (selectedExpenses.length === 0 && selectedWork.length === 0)
            }
          >
            {createQuoteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4 mr-2" />
                Créer le devis Evoliz
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
