// ============================================
// ImportFromEvolizDialog.tsx
// Import d'un devis Evoliz vers le projet VPB
// - Matériel → Scénario (project_expenses)
// - Main d'œuvre → Travaux (project_todos)
// VERSION: 4.0 - Choix du scénario cible (existant ou nouveau)
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Wrench, X, FileDown, AlertCircle, CheckSquare, Plus, FolderPlus } from "lucide-react";
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

interface ProjectScenario {
  id: string;
  nom: string;
  icone: string;
  couleur: string;
  est_principal: boolean;
  statut?: string;
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

  // États pour le choix du scénario cible
  const [scenarios, setScenarios] = useState<ProjectScenario[]>([]);
  const [targetScenarioId, setTargetScenarioId] = useState<string>("__new__");
  const [newScenarioName, setNewScenarioName] = useState<string>("");

  // Charger les scénarios existants
  useEffect(() => {
    const loadScenarios = async () => {
      const { data, error } = await (supabase as any)
        .from("project_scenarios")
        .select("id, nom, icone, couleur, est_principal, statut")
        .eq("project_id", projectId)
        .order("ordre");

      if (data) {
        setScenarios(data);
        // Par défaut, proposer de créer un nouveau scénario
        setTargetScenarioId("__new__");
        // Pré-remplir le nom avec le label du devis
        setNewScenarioName(quote?.label || `Devis ${quote?.document_number || ""}`);
      }
    };

    if (open && projectId) {
      loadScenarios();
    }
  }, [open, projectId, quote]);

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

      // 0. Déterminer le scénario cible (créer si nécessaire)
      let finalScenarioId: string | null = null;

      if (targetScenarioId === "__new__") {
        // Créer un nouveau scénario
        const scenarioName = newScenarioName.trim() || `Devis ${quote.document_number}`;

        // Récupérer le prochain ordre
        const { data: existingScenarios } = await (supabase as any)
          .from("project_scenarios")
          .select("ordre")
          .eq("project_id", projectId)
          .order("ordre", { ascending: false })
          .limit(1);

        const nextOrdre = existingScenarios?.[0]?.ordre ? existingScenarios[0].ordre + 1 : 1;

        const { data: newScenario, error: createError } = await (supabase as any)
          .from("project_scenarios")
          .insert({
            project_id: projectId,
            user_id: user.id,
            nom: scenarioName,
            icone: "📄",
            couleur: "#6366f1",
            ordre: nextOrdre,
            est_principal: scenarios.length === 0, // Principal si c'est le premier
            statut: "facturé",
            evoliz_quote_id: quote.quoteid,
            evoliz_quote_number: quote.document_number,
          })
          .select()
          .single();

        if (createError) throw createError;
        finalScenarioId = newScenario.id;

        toast.success(`Scénario "${scenarioName}" créé`);
      } else {
        // Utiliser le scénario existant sélectionné
        finalScenarioId = targetScenarioId;

        // Mettre à jour le lien Evoliz sur le scénario existant
        await (supabase as any)
          .from("project_scenarios")
          .update({
            evoliz_quote_id: quote.quoteid,
            evoliz_quote_number: quote.document_number,
          })
          .eq("id", finalScenarioId);
      }

      // 1. Importer les lignes scénario dans project_expenses
      if (scenarioLines.length > 0) {
        const expenses = scenarioLines.map((line) => ({
          project_id: projectId,
          scenario_id: finalScenarioId,
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
            work_scenario_id: finalScenarioId,
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
        scenarioId: finalScenarioId,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-todos", projectId] });
      queryClient.invalidateQueries({ queryKey: ["work-categories", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-scenarios", projectId] });
      queryClient.invalidateQueries({ queryKey: ["scenarios", projectId] });

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
          {/* Choix du scénario cible */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-3">
              <FolderPlus className="h-5 w-5 text-blue-600" />
              <Label className="text-sm font-medium">Scénario cible pour l'import</Label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={targetScenarioId} onValueChange={setTargetScenarioId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__" className="text-blue-600 font-medium">
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Créer un nouveau scénario
                    </span>
                  </SelectItem>
                  {scenarios.length > 0 && <div className="h-px bg-border my-1" />}
                  {scenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span>{s.icone}</span>
                        <span>{s.nom}</span>
                        {s.est_principal && (
                          <Badge variant="secondary" className="text-xs ml-1">
                            Principal
                          </Badge>
                        )}
                        {s.statut === "facturé" && (
                          <Badge variant="outline" className="text-xs text-green-600">
                            Facturé
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {targetScenarioId === "__new__" && (
                <Input
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  placeholder="Nom du nouveau scénario..."
                  className="w-[280px]"
                />
              )}

              {targetScenarioId !== "__new__" && (
                <span className="text-sm text-amber-600">⚠️ Les articles seront ajoutés au scénario existant</span>
              )}
            </div>
          </div>

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
