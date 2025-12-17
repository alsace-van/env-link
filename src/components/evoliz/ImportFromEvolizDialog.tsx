// ============================================
// ImportFromEvolizDialog.tsx
// Import d'un devis Evoliz vers le projet VPB
// - Matériel → Scénario (project_expenses)
// - Main d'œuvre → Travaux (project_todos)
// VERSION: 3.0 - Ajout sélection catégorie à l'import
// ============================================

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Wrench, X, FileDown, AlertCircle, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { useHourlyRate } from "@/hooks/useHourlyRate";

// ✅ Fonction pour décoder les entités HTML
const decodeHtmlEntities = (text: string): string => {
  if (!text) return text;
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
};

type LineDestination = "scenario" | "travaux" | "ignore";

interface EvolizQuoteLine {
  itemid: string;
  designation: string;
  quantity: number;
  unit?: string;
  unit_price_vat_exclude: number;
  total_vat_exclude: number;
  vat_rate?: number;
}

interface EvolizQuoteDetail {
  quoteid: string;
  document_number: string;
  label?: string;
  items: EvolizQuoteLine[];
  total: {
    vat_exclude: number;
    vat_include: number;
  };
}

interface LineWithDestination extends EvolizQuoteLine {
  destination: LineDestination;
  category: string;
}

interface CatalogCategory {
  id: string;
  nom: string;
}

interface ImportFromEvolizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  scenarioId?: string;
  quote: EvolizQuoteDetail;
}

export function ImportFromEvolizDialog({
  open,
  onOpenChange,
  projectId,
  scenarioId,
  quote,
}: ImportFromEvolizDialogProps) {
  const queryClient = useQueryClient();
  const { hourlyRateTTC, estimateHours } = useHourlyRate();

  const [lines, setLines] = useState<LineWithDestination[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [defaultCategory, setDefaultCategory] = useState<string>("Import Evoliz");

  // Charger les catégories
  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase.from("categories").select("id, nom").order("nom");

      if (data) {
        setCategories(data);
      }
    };

    if (open) {
      loadCategories();
    }
  }, [open]);

  // Initialiser les lignes avec destination par défaut = scénario
  useEffect(() => {
    if (quote?.items) {
      setLines(
        quote.items.map((item) => ({
          ...item,
          destination: "scenario" as LineDestination,
          category: defaultCategory,
        })),
      );
    }
  }, [quote]);

  // Mettre à jour les catégories quand defaultCategory change
  const applyDefaultCategoryToAll = () => {
    setLines((prev) =>
      prev.map((line) => (line.destination === "scenario" ? { ...line, category: defaultCategory } : line)),
    );
    toast.success(`Catégorie "${defaultCategory}" appliquée à toutes les lignes Scénario`);
  };

  const setLineDestination = (itemId: string, destination: LineDestination) => {
    setLines((prev) => prev.map((line) => (line.itemid === itemId ? { ...line, destination } : line)));
  };

  const setLineCategory = (itemId: string, category: string) => {
    setLines((prev) => prev.map((line) => (line.itemid === itemId ? { ...line, category } : line)));
  };

  const setAllToScenario = () => {
    setLines((prev) => prev.map((line) => ({ ...line, destination: "scenario" })));
  };

  // Calculer les totaux par destination
  const totals = lines.reduce(
    (acc, line) => {
      if (line.destination === "scenario") {
        acc.scenario += line.total_vat_exclude;
        acc.scenarioCount++;
      } else if (line.destination === "travaux") {
        acc.travaux += line.total_vat_exclude;
        acc.travauxCount++;
      }
      return acc;
    },
    { scenario: 0, travaux: 0, scenarioCount: 0, travauxCount: 0 },
  );

  // Mutation d'import
  const importMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const scenarioLines = lines.filter((l) => l.destination === "scenario");
      const travauxLines = lines.filter((l) => l.destination === "travaux");

      // 1. Importer les lignes scénario dans project_expenses
      if (scenarioLines.length > 0) {
        const expenses = scenarioLines.map((line) => ({
          project_id: projectId,
          scenario_id: scenarioId || null,
          user_id: user.id,
          nom_accessoire: decodeHtmlEntities(line.designation),
          quantite: line.quantity,
          prix: line.unit_price_vat_exclude,
          prix_vente_ttc: line.unit_price_vat_exclude * 1.2,
          categorie: line.category,
          statut_paiement: "payé",
          imported_from_evoliz: true,
          evoliz_item_id: line.itemid,
        }));

        const { error } = await (supabase as any).from("project_expenses").insert(expenses);

        if (error) throw error;
      }

      // 2. Importer les lignes MO dans project_todos
      if (travauxLines.length > 0) {
        // Récupérer le scénario principal pour lier les tâches
        const { data: mainScenario } = await (supabase as any)
          .from("project_scenarios")
          .select("id")
          .eq("project_id", projectId)
          .eq("est_principal", true)
          .single();

        // Récupérer ou créer une catégorie "Import Evoliz"
        let categoryId: string;

        const { data: existingCat } = await (supabase as any)
          .from("work_categories")
          .select("id")
          .eq("project_id", projectId)
          .eq("name", "Import Evoliz")
          .single();

        if (existingCat) {
          categoryId = existingCat.id;
        } else {
          const { data: newCat, error: catError } = await (supabase as any)
            .from("work_categories")
            .insert({
              project_id: projectId,
              user_id: user.id,
              name: "Import Evoliz",
              color: "#6366f1",
              icon: "FileDown",
              display_order: 99,
            })
            .select()
            .single();

          if (catError) throw catError;
          categoryId = newCat.id;
        }

        const todos = travauxLines.map((line, index) => {
          const forfaitTTC = line.total_vat_exclude * 1.2;
          return {
            project_id: projectId,
            user_id: user.id,
            category_id: categoryId,
            work_scenario_id: mainScenario?.id || null,
            title: decodeHtmlEntities(line.designation),
            completed: false,
            display_order: index + 1,
            forfait_ttc: forfaitTTC,
            forfait_ht: line.total_vat_exclude,
            estimated_hours: estimateHours(forfaitTTC),
            imported_from_evoliz: true,
            evoliz_item_id: line.itemid,
          };
        });

        const { error } = await (supabase as any).from("project_todos").insert(todos);

        if (error) throw error;
      }

      // 3. Enregistrer l'import
      await (supabase as any).from("evoliz_imports").insert({
        user_id: user.id,
        project_id: projectId,
        evoliz_quote_id: quote.quoteid,
        evoliz_document_number: quote.document_number,
        total_materiel_ht: totals.scenario,
        total_mo_ht: totals.travaux,
        lignes_importees: totals.scenarioCount + totals.travauxCount,
      });

      return {
        scenarioCount: scenarioLines.length,
        travauxCount: travauxLines.length,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-todos", projectId] });
      queryClient.invalidateQueries({ queryKey: ["work-categories", projectId] });

      toast.success(`Import réussi : ${result.scenarioCount} article(s) + ${result.travauxCount} tâche(s)`);
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Erreur import:", error);
      toast.error("Erreur lors de l'import : " + error.message);
    },
  });

  const getDestinationIcon = (dest: LineDestination) => {
    switch (dest) {
      case "scenario":
        return <Package className="h-4 w-4 text-blue-600" />;
      case "travaux":
        return <Wrench className="h-4 w-4 text-orange-600" />;
      case "ignore":
        return <X className="h-4 w-4 text-gray-400" />;
    }
  };

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Import devis {quote.document_number}
          </DialogTitle>
          <DialogDescription>Classez chaque ligne et assignez une catégorie pour le matériel</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Actions rapides */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <Button variant="outline" size="sm" onClick={setAllToScenario}>
              <Package className="h-4 w-4 mr-1" />
              Tout en Scénario
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Catégorie par défaut:</span>
              <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Import Evoliz">Import Evoliz</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.nom}>
                      {cat.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={applyDefaultCategoryToAll}>
                <CheckSquare className="h-4 w-4 mr-1" />
                Appliquer à tous
              </Button>
            </div>
          </div>

          {/* Liste des lignes */}
          <ScrollArea className="h-[400px] border rounded-lg">
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium">Désignation</th>
                  <th className="text-right p-3 font-medium w-16">Qté</th>
                  <th className="text-right p-3 font-medium w-24">Total HT</th>
                  <th className="text-center p-3 font-medium w-32">Destination</th>
                  <th className="text-center p-3 font-medium w-44">Catégorie</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr
                    key={line.itemid}
                    className={`border-b hover:bg-muted/30 ${line.destination === "ignore" ? "opacity-50" : ""}`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {getDestinationIcon(line.destination)}
                        <span
                          className={`text-sm ${line.destination === "ignore" ? "line-through" : ""}`}
                          title={line.designation}
                        >
                          {line.designation.length > 60 ? line.designation.substring(0, 60) + "..." : line.designation}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right text-sm">{line.quantity}</td>
                    <td className="p-3 text-right font-medium text-sm">{line.total_vat_exclude.toFixed(2)} €</td>
                    <td className="p-3">
                      <Select
                        value={line.destination}
                        onValueChange={(v) => setLineDestination(line.itemid, v as LineDestination)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scenario">
                            <div className="flex items-center gap-2">
                              <Package className="h-3 w-3 text-blue-600" />
                              Scénario
                            </div>
                          </SelectItem>
                          <SelectItem value="travaux">
                            <div className="flex items-center gap-2">
                              <Wrench className="h-3 w-3 text-orange-600" />
                              Travaux
                            </div>
                          </SelectItem>
                          <SelectItem value="ignore">
                            <div className="flex items-center gap-2">
                              <X className="h-3 w-3 text-gray-400" />
                              Ignorer
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      {line.destination === "scenario" ? (
                        <Select value={line.category} onValueChange={(v) => setLineCategory(line.itemid, v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Import Evoliz">Import Evoliz</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.nom}>
                                {cat.nom}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>

          {/* Récapitulatif */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-sm">
                  <strong>{totals.scenarioCount}</strong> articles → Scénario
                </span>
                <Badge variant="secondary">{totals.scenario.toFixed(2)} € HT</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-orange-600" />
                <span className="text-sm">
                  <strong>{totals.travauxCount}</strong> lignes → Travaux
                </span>
                <Badge variant="secondary">{totals.travaux.toFixed(2)} € HT</Badge>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium">Total: {(totals.scenario + totals.travaux).toFixed(2)} € HT</span>
            </div>
          </div>

          {/* Avertissement si rien à importer */}
          {totals.scenarioCount === 0 && totals.travauxCount === 0 && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Aucune ligne sélectionnée pour l'import</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending || (totals.scenarioCount === 0 && totals.travauxCount === 0)}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Import en cours...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                Importer ({totals.scenarioCount + totals.travauxCount} lignes)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
