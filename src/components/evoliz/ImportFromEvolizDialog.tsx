// ============================================
// ImportFromEvolizDialog.tsx
// Import d'un devis Evoliz vers le projet VPB
// - Matériel → Scénario (project_expenses)
// - Main d'œuvre → Travaux (project_todos)
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Package, Wrench, X, FileDown, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useHourlyRate } from "@/hooks/useHourlyRate";

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

  // Initialiser les lignes avec destination par défaut = scénario
  useEffect(() => {
    if (quote?.items) {
      setLines(
        quote.items.map((item) => ({
          ...item,
          destination: "scenario" as LineDestination,
        }))
      );
    }
  }, [quote]);

  // Changer la destination d'une ligne
  const setLineDestination = (itemId: string, destination: LineDestination) => {
    setLines((prev) =>
      prev.map((line) =>
        line.itemid === itemId ? { ...line, destination } : line
      )
    );
  };

  // Tout mettre dans scénario
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
      } else {
        acc.ignoreCount++;
      }
      return acc;
    },
    { scenario: 0, travaux: 0, scenarioCount: 0, travauxCount: 0, ignoreCount: 0 }
  );

  // Mutation d'import
  const importMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      const scenarioLines = lines.filter((l) => l.destination === "scenario");
      const travauxLines = lines.filter((l) => l.destination === "travaux");

      // 1. Importer les lignes matériel dans project_expenses
      if (scenarioLines.length > 0) {
        const expenses = scenarioLines.map((line) => ({
          project_id: projectId,
          scenario_id: scenarioId || null,
          user_id: user.id,
          nom_accessoire: line.designation,
          quantite: line.quantity,
          prix: line.unit_price_vat_exclude, // Prix unitaire HT
          prix_vente_ttc: line.unit_price_vat_exclude * 1.2, // Conversion TTC
          categorie: "Import Evoliz",
          statut_paiement: "payé",
          imported_from_evoliz: true,
          evoliz_item_id: line.itemid,
        }));

        const { error } = await (supabase as any)
          .from("project_expenses")
          .insert(expenses);

        if (error) throw error;
      }

      // 2. Importer les lignes MO dans project_todos
      if (travauxLines.length > 0) {
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
            title: line.designation,
            completed: false,
            display_order: index + 1,
            forfait_ttc: forfaitTTC,
            estimated_hours: estimateHours(forfaitTTC),
            imported_from_evoliz: true,
            evoliz_item_id: line.itemid,
          };
        });

        const { error } = await (supabase as any)
          .from("project_todos")
          .insert(todos);

        if (error) throw error;
      }

      // 3. Enregistrer l'import dans evoliz_imports
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
      
      toast.success(
        `Import réussi : ${result.scenarioCount} article(s) + ${result.travauxCount} tâche(s)`
      );
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

  const getDestinationLabel = (dest: LineDestination) => {
    switch (dest) {
      case "scenario":
        return "Scénario";
      case "travaux":
        return "Travaux";
      case "ignore":
        return "Ignorer";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Import devis {quote.document_number}
          </DialogTitle>
          <DialogDescription>
            Classez chaque ligne : Scénario (matériel) ou Travaux (main d'œuvre)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Actions rapides */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={setAllToScenario}>
              <Package className="h-4 w-4 mr-1" />
              Tout en Scénario
            </Button>
            <span className="text-sm text-muted-foreground">
              puis ajustez les lignes main d'œuvre
            </span>
          </div>

          {/* Liste des lignes */}
          <ScrollArea className="h-[400px] border rounded-lg">
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium">Désignation</th>
                  <th className="text-right p-3 font-medium w-20">Qté</th>
                  <th className="text-right p-3 font-medium w-28">P.U. HT</th>
                  <th className="text-right p-3 font-medium w-28">Total HT</th>
                  <th className="text-center p-3 font-medium w-36">Destination</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr
                    key={line.itemid}
                    className={`border-b hover:bg-muted/30 ${
                      line.destination === "ignore" ? "opacity-50" : ""
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {getDestinationIcon(line.destination)}
                        <span className={line.destination === "ignore" ? "line-through" : ""}>
                          {line.designation}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right text-sm">
                      {line.quantity} {line.unit || ""}
                    </td>
                    <td className="p-3 text-right text-sm">
                      {line.unit_price_vat_exclude.toFixed(2)} €
                    </td>
                    <td className="p-3 text-right font-medium">
                      {line.total_vat_exclude.toFixed(2)} €
                    </td>
                    <td className="p-3">
                      <Select
                        value={line.destination}
                        onValueChange={(v) => setLineDestination(line.itemid, v as LineDestination)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scenario">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-blue-600" />
                              Scénario
                            </div>
                          </SelectItem>
                          <SelectItem value="travaux">
                            <div className="flex items-center gap-2">
                              <Wrench className="h-4 w-4 text-orange-600" />
                              Travaux
                            </div>
                          </SelectItem>
                          <SelectItem value="ignore">
                            <div className="flex items-center gap-2">
                              <X className="h-4 w-4 text-gray-400" />
                              Ignorer
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>

          {/* Récapitulatif */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-sm text-muted-foreground">Scénario (matériel)</div>
                <div className="font-semibold">
                  {totals.scenarioCount} ligne(s) • {totals.scenario.toFixed(2)} € HT
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Wrench className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-sm text-muted-foreground">Travaux (MO)</div>
                <div className="font-semibold">
                  {totals.travauxCount} ligne(s) • {totals.travaux.toFixed(2)} € HT
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <X className="h-5 w-5 text-gray-400" />
              <div>
                <div className="text-sm text-muted-foreground">Ignoré</div>
                <div className="font-semibold">{totals.ignoreCount} ligne(s)</div>
              </div>
            </div>
          </div>

          {/* Warning si tout ignoré */}
          {totals.scenarioCount + totals.travauxCount === 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
              <AlertCircle className="h-5 w-5" />
              <span>Toutes les lignes sont ignorées. Rien ne sera importé.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending || totals.scenarioCount + totals.travauxCount === 0}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Import...
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
