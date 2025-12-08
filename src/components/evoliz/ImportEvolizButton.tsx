// ============================================
// ImportEvolizButton.tsx
// Bouton + Modale pour importer un devis Evoliz
// Étape 1: Choisir le devis
// Étape 2: Cocher les lignes + choisir Matériel/MO
// ============================================

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Download,
  Package,
  Wrench,
  X,
  FileText,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  AlertCircle,
  Check,
  BookPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useEvolizConfig } from "@/hooks/useEvolizConfig";
import { useEvolizQuotes } from "@/hooks/useEvolizQuotes";
import { useHourlyRate } from "@/hooks/useHourlyRate";
import { Label } from "@/components/ui/label";

type LineDestination = "scenario" | "travaux" | "ignore";

interface QuoteLine {
  itemid: string;
  designation: string;
  quantity: number;
  unit?: string;
  unit_price_vat_exclude: number;
  total_vat_exclude: number;
  selected: boolean;
  destination: LineDestination;
}

interface ImportEvolizButtonProps {
  projectId: string;
  scenarioId?: string;
  onImportComplete?: () => void;
}

// Formater montant
function formatAmount(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

// Formater date
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Badge statut
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: "Brouillon", className: "bg-gray-100 text-gray-800" },
    sent: { label: "Envoyé", className: "bg-blue-100 text-blue-800" },
    accept: { label: "Accepté", className: "bg-green-100 text-green-800" },
    reject: { label: "Refusé", className: "bg-red-100 text-red-800" },
    invoice: { label: "Facturé", className: "bg-purple-100 text-purple-800" },
  };
  const c = config[status?.toLowerCase()] || { label: status, className: "bg-gray-100" };
  return <Badge className={c.className}>{c.label}</Badge>;
}

export function ImportEvolizButton({ projectId, scenarioId, onImportComplete }: ImportEvolizButtonProps) {
  const queryClient = useQueryClient();
  const { isConfigured } = useEvolizConfig();
  const { quotes, isLoading: loadingQuotes, fetchQuotes } = useEvolizQuotes();
  const { estimateHours } = useHourlyRate();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [addToCatalog, setAddToCatalog] = useState(true); // Ajouter au catalogue par défaut

  // Charger les devis quand on ouvre
  useEffect(() => {
    if (open && isConfigured) {
      fetchQuotes();
    }
  }, [open, isConfigured]);

  // Quand on sélectionne un devis, préparer les lignes
  useEffect(() => {
    if (selectedQuote?.items) {
      setLines(
        selectedQuote.items.map((item: any) => ({
          itemid: item.itemid || crypto.randomUUID(),
          designation: item.designation || item.designation_clean || "",
          quantity: item.quantity || 1,
          unit: item.unit || "",
          unit_price_vat_exclude: item.unit_price_vat_exclude || 0,
          total_vat_exclude: item.total?.vat_exclude || item.unit_price_vat_exclude * item.quantity || 0,
          selected: true,
          destination: "scenario" as LineDestination,
        })),
      );
    }
  }, [selectedQuote]);

  // Reset quand on ferme
  const handleClose = () => {
    setOpen(false);
    setStep(1);
    setSelectedQuote(null);
    setLines([]);
  };

  // Sélectionner un devis et passer à l'étape 2
  const handleSelectQuote = (quote: any) => {
    setSelectedQuote(quote);
    setStep(2);
  };

  // Toggle sélection ligne
  const toggleLine = (itemid: string) => {
    setLines((prev) => prev.map((l) => (l.itemid === itemid ? { ...l, selected: !l.selected } : l)));
  };

  // Changer destination
  const setDestination = (itemid: string, dest: LineDestination) => {
    setLines((prev) => prev.map((l) => (l.itemid === itemid ? { ...l, destination: dest } : l)));
  };

  // Tout sélectionner/désélectionner
  const selectAll = (selected: boolean) => {
    setLines((prev) => prev.map((l) => ({ ...l, selected })));
  };

  // Tout mettre en scénario
  const setAllToScenario = () => {
    setLines((prev) => prev.map((l) => ({ ...l, destination: "scenario" })));
  };

  // Calculer totaux
  const selectedLines = lines.filter((l) => l.selected);
  const scenarioLines = selectedLines.filter((l) => l.destination === "scenario");
  const travauxLines = selectedLines.filter((l) => l.destination === "travaux");

  const totalScenario = scenarioLines.reduce((sum, l) => sum + l.total_vat_exclude, 0);
  const totalTravaux = travauxLines.reduce((sum, l) => sum + l.total_vat_exclude, 0);

  // Mutation import
  const importMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      // 1. Ajouter au catalogue si option activée (seulement les lignes matériel)
      let catalogItemsCreated = 0;
      if (addToCatalog && scenarioLines.length > 0) {
        // Récupérer les noms des articles existants dans le catalogue
        const { data: existingItems } = await (supabase as any)
          .from("accessories_catalog")
          .select("nom")
          .eq("user_id", user.id);

        const existingNames = new Set((existingItems || []).map((item: any) => item.nom.toLowerCase().trim()));

        // Filtrer les articles qui n'existent pas encore
        const newCatalogItems = scenarioLines
          .filter((line) => {
            const cleanName = line.designation.replace(/<[^>]*>/g, "").trim();
            return !existingNames.has(cleanName.toLowerCase());
          })
          .map((line) => {
            const cleanName = line.designation.replace(/<[^>]*>/g, "").trim();
            const prixVenteTTC = line.unit_price_vat_exclude * 1.2;
            return {
              user_id: user.id,
              nom: cleanName,
              prix_vente_ttc: prixVenteTTC,
              prix_reference: line.unit_price_vat_exclude, // Prix HT comme référence
              description: `Importé depuis devis Evoliz ${selectedQuote.document_number}`,
              fournisseur: "Import Evoliz",
              available_in_shop: false,
            };
          });

        if (newCatalogItems.length > 0) {
          const { error: catalogError } = await (supabase as any).from("accessories_catalog").insert(newCatalogItems);

          if (catalogError) {
            console.warn("Erreur ajout catalogue:", catalogError);
            // On continue quand même l'import
          } else {
            catalogItemsCreated = newCatalogItems.length;
          }
        }
      }

      // 2. Importer matériel dans project_expenses
      if (scenarioLines.length > 0) {
        const expenses = scenarioLines.map((line) => ({
          project_id: projectId,
          scenario_id: scenarioId || null,
          user_id: user.id,
          nom_accessoire: line.designation.replace(/<[^>]*>/g, "").trim(), // Nettoyer HTML
          quantite: line.quantity,
          prix: line.unit_price_vat_exclude,
          prix_vente_ttc: line.unit_price_vat_exclude * 1.2,
          categorie: "Import Evoliz",
          statut_paiement: "payé",
          imported_from_evoliz: true,
          evoliz_item_id: line.itemid,
        }));

        const { error } = await (supabase as any).from("project_expenses").insert(expenses);

        if (error) throw error;
      }

      // 2. Importer MO dans project_todos
      if (travauxLines.length > 0) {
        // Créer ou récupérer catégorie "Import Evoliz"
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
            title: line.designation.replace(/<[^>]*>/g, "").trim(),
            completed: false,
            display_order: index + 1,
            forfait_ttc: forfaitTTC,
            estimated_hours: estimateHours(forfaitTTC),
            imported_from_evoliz: true,
            evoliz_item_id: line.itemid,
          };
        });

        const { error } = await (supabase as any).from("project_todos").insert(todos);

        if (error) throw error;
      }

      // 3. Logger l'import
      await (supabase as any).from("evoliz_imports").insert({
        user_id: user.id,
        project_id: projectId,
        evoliz_quote_id: selectedQuote.quoteid,
        evoliz_document_number: selectedQuote.document_number,
        total_materiel_ht: totalScenario,
        total_mo_ht: totalTravaux,
        lignes_importees: selectedLines.length,
      });

      return { scenarioCount: scenarioLines.length, travauxCount: travauxLines.length, catalogItemsCreated };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-todos", projectId] });
      queryClient.invalidateQueries({ queryKey: ["work-categories", projectId] });
      queryClient.invalidateQueries({ queryKey: ["accessories-catalog"] });

      let message = `Import réussi : ${result.scenarioCount} article(s) + ${result.travauxCount} tâche(s)`;
      if (result.catalogItemsCreated > 0) {
        message += ` • ${result.catalogItemsCreated} ajouté(s) au catalogue`;
      }
      toast.success(message);

      handleClose();
      onImportComplete?.();
    },
    onError: (error: any) => {
      console.error("Erreur import:", error);
      toast.error("Erreur : " + error.message);
    },
  });

  if (!isConfigured) {
    return null; // Ne pas afficher si Evoliz pas configuré
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4 mr-2" />
        Importer devis Evoliz
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {step === 1 ? "Choisir un devis Evoliz" : `Import ${selectedQuote?.document_number}`}
            </DialogTitle>
            <DialogDescription>
              {step === 1
                ? "Sélectionnez le devis à importer dans ce projet"
                : "Cochez les lignes et choisissez leur destination"}
            </DialogDescription>
          </DialogHeader>

          {/* ÉTAPE 1 : Liste des devis */}
          {step === 1 && (
            <div className="flex-1 overflow-y-auto max-h-[500px] pr-2">
              {loadingQuotes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : quotes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun devis trouvé sur Evoliz</p>
                </div>
              ) : (
                <div className="space-y-2 p-1">
                  {quotes.map((quote) => (
                    <div
                      key={quote.quoteid}
                      onClick={() => handleSelectQuote(quote)}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{quote.document_number}</span>
                          <StatusBadge status={quote.status} />
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {quote.client?.name || "Client inconnu"} • {formatDate(quote.documentdate)}
                        </div>
                        {quote.object && (
                          <div className="text-sm text-muted-foreground truncate max-w-md">{quote.object}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold">{formatAmount(quote.total?.vat_include || 0)}</div>
                          <div className="text-xs text-muted-foreground">TTC</div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ÉTAPE 2 : Lignes du devis */}
          {step === 2 && selectedQuote && (
            <>
              <div className="flex items-center justify-between py-2">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Retour
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => selectAll(true)}>
                    Tout cocher
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => selectAll(false)}>
                    Tout décocher
                  </Button>
                  <Button variant="outline" size="sm" onClick={setAllToScenario}>
                    <Package className="h-4 w-4 mr-1" />
                    Tout → Matériel
                  </Button>
                </div>
              </div>

              {/* En-tête tableau */}
              <div className="grid grid-cols-[auto_1fr_50px_80px_80px_90px_90px_110px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border rounded-t-lg">
                <div></div>
                <div>Désignation</div>
                <div className="text-center">Qté</div>
                <div className="text-right">PU HT</div>
                <div className="text-right">PU TTC</div>
                <div className="text-right">Total HT</div>
                <div className="text-right">Total TTC</div>
                <div className="text-center">Destination</div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[300px] border border-t-0 rounded-b-lg">
                <div className="divide-y">
                  {lines.map((line) => (
                    <div
                      key={line.itemid}
                      className={`grid grid-cols-[auto_1fr_50px_80px_80px_90px_90px_110px] gap-2 items-center px-3 py-2 ${
                        !line.selected ? "opacity-50 bg-muted/30" : "hover:bg-muted/20"
                      }`}
                    >
                      <Checkbox checked={line.selected} onCheckedChange={() => toggleLine(line.itemid)} />

                      <div
                        className="text-sm truncate"
                        title={line.designation.replace(/<[^>]*>/g, "")}
                        dangerouslySetInnerHTML={{
                          __html: line.designation.replace(/\n/g, " "),
                        }}
                      />

                      <div className="text-sm text-center">{line.quantity}</div>

                      <div className="text-sm text-right">{formatAmount(line.unit_price_vat_exclude)}</div>

                      <div className="text-sm text-right text-muted-foreground">
                        {formatAmount(line.unit_price_vat_exclude * 1.2)}
                      </div>

                      <div className="text-sm text-right">{formatAmount(line.total_vat_exclude)}</div>

                      <div className="text-sm text-right font-medium">{formatAmount(line.total_vat_exclude * 1.2)}</div>

                      {line.selected ? (
                        <Select
                          value={line.destination}
                          onValueChange={(v) => setDestination(line.itemid, v as LineDestination)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scenario">
                              <div className="flex items-center gap-1">
                                <Package className="h-3 w-3 text-blue-600" />
                                Matériel
                              </div>
                            </SelectItem>
                            <SelectItem value="travaux">
                              <div className="flex items-center gap-1">
                                <Wrench className="h-3 w-3 text-orange-600" />
                                Travaux
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Récap */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">Matériel → Scénario</div>
                    <div className="font-semibold">
                      {scenarioLines.length} ligne(s) • {formatAmount(totalScenario * 1.2)} TTC
                    </div>
                    <div className="text-xs text-muted-foreground">{formatAmount(totalScenario)} HT</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Wrench className="h-5 w-5 text-orange-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">Main d'œuvre → Travaux</div>
                    <div className="font-semibold">
                      {travauxLines.length} ligne(s) • {formatAmount(totalTravaux * 1.2)} TTC
                    </div>
                    <div className="text-xs text-muted-foreground">{formatAmount(totalTravaux)} HT</div>
                  </div>
                </div>
              </div>

              {/* Option ajout au catalogue */}
              {scenarioLines.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Checkbox
                    id="add-to-catalog"
                    checked={addToCatalog}
                    onCheckedChange={(checked) => setAddToCatalog(checked as boolean)}
                  />
                  <Label htmlFor="add-to-catalog" className="flex items-center gap-2 cursor-pointer text-sm">
                    <BookPlus className="h-4 w-4 text-blue-600" />
                    <span>Ajouter les nouveaux articles au catalogue</span>
                    <span className="text-xs text-muted-foreground">(articles matériel uniquement)</span>
                  </Label>
                </div>
              )}

              {selectedLines.length === 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Aucune ligne sélectionnée
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Annuler
            </Button>
            {step === 2 && (
              <Button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending || selectedLines.length === 0}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Import...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Importer ({selectedLines.length} lignes)
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
