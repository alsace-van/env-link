// ============================================
// DIALOG EXPORT SCÉNARIO VERS EVOLIZ
// Permet d'exporter un scénario VPB en devis Evoliz
// ============================================

import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { evolizApi, initializeEvolizApi } from "@/services/evolizService";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileText, ExternalLink, CheckCircle2, AlertCircle, Send, Users, Package, Wrench } from "lucide-react";
import { toast } from "sonner";

interface ExportToEvolizDialogProps {
  isOpen: boolean;
  onClose: () => void;
  scenarioId: string;
  scenarioName: string;
  projectId: string;
  projectName?: string;
  clientName?: string;
}

interface ExpenseItem {
  id: string;
  nom_accessoire: string;
  quantite: number;
  prix_vente_ttc: number;
  prix: number; // prix achat HT
  categorie: string;
  marque?: string;
  fournisseur?: string;
  selected: boolean;
}

interface TodoItem {
  id: string;
  title: string;
  forfait_ttc: number;
  estimated_hours: number;
  category_name?: string;
  selected: boolean;
}

interface EvolizClient {
  clientid: number;
  name: string;
  code?: string;
}

const ExportToEvolizDialog = ({
  isOpen,
  onClose,
  scenarioId,
  scenarioName,
  projectId,
  projectName,
  clientName,
}: ExportToEvolizDialogProps) => {
  // États
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [evolizClients, setEvolizClients] = useState<EvolizClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [quoteObject, setQuoteObject] = useState("");
  const [quoteComment, setQuoteComment] = useState("");
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    quoteId?: number;
    documentNumber?: string;
    webdocUrl?: string;
    message?: string;
  } | null>(null);

  // Charger la configuration Evoliz et les données
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, scenarioId]);

  const loadData = async () => {
    setIsLoading(true);
    setExportResult(null);

    try {
      // 1. Vérifier la configuration Evoliz
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      const { data: credentials } = await (supabase as any)
        .from("evoliz_credentials")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!credentials) {
        setIsConfigured(false);
        setIsLoading(false);
        return;
      }

      setIsConfigured(true);
      initializeEvolizApi(credentials);

      // 2. Charger les dépenses du scénario
      const { data: expensesData, error: expensesError } = await (supabase as any)
        .from("project_expenses")
        .select("*")
        .eq("scenario_id", scenarioId)
        .eq("est_archive", false)
        .order("categorie", { ascending: true });

      if (expensesError) {
        console.error("Erreur chargement dépenses:", expensesError);
      } else {
        const items: ExpenseItem[] = (expensesData || []).map((e: any) => ({
          id: e.id,
          nom_accessoire: e.nom_accessoire || e.product_name || "Article sans nom",
          quantite: e.quantite || e.quantity || 1,
          prix_vente_ttc: e.prix_vente_ttc || 0,
          prix: e.prix || e.unit_price || 0,
          categorie: e.categorie || e.category || "Divers",
          marque: e.marque,
          fournisseur: e.fournisseur || e.supplier,
          selected: true,
        }));
        setExpenses(items);
      }

      // 3. Charger les travaux (todos) du projet avec leur catégorie
      const { data: todosData, error: todosError } = await (supabase as any)
        .from("project_todos")
        .select(
          `
          id,
          title,
          forfait_ttc,
          estimated_hours,
          work_categories (name)
        `,
        )
        .eq("project_id", projectId)
        .order("display_order", { ascending: true });

      if (todosError) {
        console.error("Erreur chargement travaux:", todosError);
      } else {
        const todoItems: TodoItem[] = (todosData || [])
          .filter((t: any) => t.forfait_ttc && t.forfait_ttc > 0) // Seulement ceux avec un forfait
          .map((t: any) => ({
            id: t.id,
            title: t.title || "Travail sans titre",
            forfait_ttc: t.forfait_ttc || 0,
            estimated_hours: t.estimated_hours || 0,
            category_name: t.work_categories?.name || "Main d'œuvre",
            selected: true,
          }));
        setTodos(todoItems);
      }

      // 4. Charger les clients Evoliz
      try {
        const clientsResponse = await evolizApi.getClients({ per_page: 100 });
        setEvolizClients(clientsResponse.data || []);

        // Essayer de matcher le client VPB avec un client Evoliz
        if (clientName && clientsResponse.data) {
          const matchedClient = clientsResponse.data.find((c: any) =>
            c.name?.toLowerCase().includes(clientName.toLowerCase()),
          );
          if (matchedClient) {
            setSelectedClientId(matchedClient.clientid.toString());
          }
        }
      } catch (err) {
        console.error("Erreur chargement clients Evoliz:", err);
      }

      // 5. Pré-remplir l'objet du devis
      setQuoteObject(projectName || scenarioName || "Aménagement fourgon");
    } catch (err) {
      console.error("Erreur chargement données:", err);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle sélection d'un article
  const toggleExpenseSelection = (expenseId: string) => {
    setExpenses((prev) => prev.map((e) => (e.id === expenseId ? { ...e, selected: !e.selected } : e)));
  };

  // Toggle sélection d'un travail
  const toggleTodoSelection = (todoId: string) => {
    setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, selected: !t.selected } : t)));
  };

  // Sélectionner/Désélectionner tout (matériel)
  const toggleSelectAllExpenses = () => {
    const allSelected = expenses.every((e) => e.selected);
    setExpenses((prev) => prev.map((e) => ({ ...e, selected: !allSelected })));
  };

  // Sélectionner/Désélectionner tout (travaux)
  const toggleSelectAllTodos = () => {
    const allSelected = todos.every((t) => t.selected);
    setTodos((prev) => prev.map((t) => ({ ...t, selected: !allSelected })));
  };

  // Calculer les totaux matériel
  const selectedExpenses = expenses.filter((e) => e.selected);
  const totalMaterielHT = selectedExpenses.reduce((sum, e) => {
    const prixHT = e.prix_vente_ttc ? e.prix_vente_ttc / 1.2 : e.prix || 0;
    return sum + prixHT * e.quantite;
  }, 0);
  const totalMaterielTTC = selectedExpenses.reduce((sum, e) => {
    const prix = e.prix_vente_ttc || e.prix * 1.2 || 0;
    return sum + prix * e.quantite;
  }, 0);

  // Calculer les totaux travaux
  const selectedTodos = todos.filter((t) => t.selected);
  const totalTravauxTTC = selectedTodos.reduce((sum, t) => sum + (t.forfait_ttc || 0), 0);
  const totalTravauxHT = totalTravauxTTC / 1.2;

  // Totaux généraux
  const totalHT = totalMaterielHT + totalTravauxHT;
  const totalTTC = totalMaterielTTC + totalTravauxTTC;

  // Formater le montant
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  // Exporter vers Evoliz
  const handleExport = async () => {
    if (!selectedClientId) {
      toast.error("Veuillez sélectionner un client Evoliz");
      return;
    }

    if (selectedExpenses.length === 0 && selectedTodos.length === 0) {
      toast.error("Veuillez sélectionner au moins un article ou travail");
      return;
    }

    setIsExporting(true);

    try {
      // Construire les lignes du devis - MATÉRIEL
      const expenseItems = selectedExpenses.map((expense) => {
        // Prix unitaire HT (on part du TTC et on enlève 20% de TVA)
        const unitPriceHT = expense.prix_vente_ttc ? expense.prix_vente_ttc / 1.2 : expense.prix || 0;

        return {
          designation: expense.nom_accessoire,
          quantity: expense.quantite,
          unit_price_vat_exclude: Math.round(unitPriceHT * 100) / 100,
          vat: 20, // TVA 20%
          unit: "", // Unité vide par défaut
        };
      });

      // Construire les lignes du devis - TRAVAUX (MO)
      const todoItems = selectedTodos.map((todo) => {
        const unitPriceHT = (todo.forfait_ttc || 0) / 1.2;

        return {
          designation: `[MO] ${todo.title}`,
          quantity: 1,
          unit_price_vat_exclude: Math.round(unitPriceHT * 100) / 100,
          vat: 20, // TVA 20%
          unit: "forfait",
        };
      });

      // Combiner matériel + travaux
      const items = [...expenseItems, ...todoItems];

      // Créer le devis via l'API
      const quoteData = {
        clientid: parseInt(selectedClientId),
        object: quoteObject || "Aménagement fourgon",
        comment: quoteComment || undefined,
        items: items,
        // Options par défaut
        validity: 30, // 30 jours de validité
      };

      console.log("Création devis Evoliz:", quoteData);

      const result = await evolizApi.createQuote(quoteData as any);

      console.log("Devis créé:", result);

      setExportResult({
        success: true,
        quoteId: result.quoteid,
        documentNumber: result.document_number,
        webdocUrl: result.webdoc,
        message: `Devis ${result.document_number} créé avec succès !`,
      });

      toast.success(`Devis ${result.document_number} créé dans Evoliz !`);
    } catch (err: any) {
      console.error("Erreur export:", err);
      setExportResult({
        success: false,
        message: err.message || "Erreur lors de la création du devis",
      });
      toast.error("Erreur lors de la création du devis");
    } finally {
      setIsExporting(false);
    }
  };

  // Rendu si pas configuré
  if (!isConfigured && !isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export vers Evoliz</DialogTitle>
          </DialogHeader>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Evoliz n'est pas configuré. Allez dans les paramètres pour connecter votre compte.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
            <Button onClick={() => (window.location.href = "/settings/evoliz")}>Configurer Evoliz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Exporter vers Evoliz
          </DialogTitle>
          <DialogDescription>Créer un devis Evoliz à partir du scénario "{scenarioName}"</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : exportResult?.success ? (
          // Résultat succès
          <div className="space-y-6 py-4">
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{exportResult.message}</AlertDescription>
            </Alert>

            <div className="text-center space-y-4">
              <div className="text-4xl">🎉</div>
              <h3 className="text-xl font-semibold">Devis {exportResult.documentNumber}</h3>
              <p className="text-muted-foreground">Le devis a été créé avec succès dans Evoliz.</p>

              {exportResult.webdocUrl && (
                <Button asChild>
                  <a href={exportResult.webdocUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Voir le devis PDF
                  </a>
                </Button>
              )}
            </div>
          </div>
        ) : (
          // Formulaire d'export
          <div className="space-y-6 py-4">
            {/* Erreur précédente */}
            {exportResult?.success === false && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{exportResult.message}</AlertDescription>
              </Alert>
            )}

            {/* Sélection client */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Client Evoliz *
              </Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client..." />
                </SelectTrigger>
                <SelectContent>
                  {evolizClients.map((client) => (
                    <SelectItem key={client.clientid} value={client.clientid.toString()}>
                      {client.code ? `[${client.code}] ` : ""}
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientName && <p className="text-xs text-muted-foreground">Client VPB : {clientName}</p>}
            </div>

            {/* Objet du devis */}
            <div className="space-y-2">
              <Label>Objet du devis</Label>
              <Input
                value={quoteObject}
                onChange={(e) => setQuoteObject(e.target.value)}
                placeholder="Ex: Aménagement fourgon"
              />
            </div>

            {/* Commentaire */}
            <div className="space-y-2">
              <Label>Commentaire (optionnel)</Label>
              <Textarea
                value={quoteComment}
                onChange={(e) => setQuoteComment(e.target.value)}
                placeholder="Notes ou conditions particulières..."
                rows={2}
              />
            </div>

            <Separator />

            {/* Liste des articles (Matériel) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  Matériel ({selectedExpenses.length}/{expenses.length})
                </Label>
                <Button variant="ghost" size="sm" onClick={toggleSelectAllExpenses}>
                  {expenses.every((e) => e.selected) ? "Tout désélectionner" : "Tout sélectionner"}
                </Button>
              </div>

              {expenses.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                  Aucun matériel dans ce scénario
                </div>
              ) : (
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Article</TableHead>
                        <TableHead className="text-right">Qté</TableHead>
                        <TableHead className="text-right">P.U. HT</TableHead>
                        <TableHead className="text-right">Total HT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => {
                        const prixHT = expense.prix_vente_ttc ? expense.prix_vente_ttc / 1.2 : expense.prix || 0;
                        const totalLigne = prixHT * expense.quantite;

                        return (
                          <TableRow key={expense.id} className={!expense.selected ? "opacity-50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={expense.selected}
                                onCheckedChange={() => toggleExpenseSelection(expense.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{expense.nom_accessoire}</div>
                                <div className="text-xs text-muted-foreground">
                                  {expense.categorie}
                                  {expense.marque && ` • ${expense.marque}`}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{expense.quantite}</TableCell>
                            <TableCell className="text-right">{formatAmount(prixHT)}</TableCell>
                            <TableCell className="text-right">{formatAmount(totalLigne)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Liste des travaux (Main d'œuvre) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-orange-600" />
                  Main d'œuvre ({selectedTodos.length}/{todos.length})
                </Label>
                {todos.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={toggleSelectAllTodos}>
                    {todos.every((t) => t.selected) ? "Tout désélectionner" : "Tout sélectionner"}
                  </Button>
                )}
              </div>

              {todos.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                  Aucun travail avec forfait dans ce projet
                </div>
              ) : (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Travail</TableHead>
                        <TableHead className="text-right">Heures est.</TableHead>
                        <TableHead className="text-right">Forfait TTC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todos.map((todo) => (
                        <TableRow key={todo.id} className={!todo.selected ? "opacity-50" : ""}>
                          <TableCell>
                            <Checkbox checked={todo.selected} onCheckedChange={() => toggleTodoSelection(todo.id)} />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{todo.title}</div>
                              <div className="text-xs text-muted-foreground">{todo.category_name}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{todo.estimated_hours}h</TableCell>
                          <TableCell className="text-right">{formatAmount(todo.forfait_ttc)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Totaux */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              {selectedExpenses.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" /> Matériel HT
                  </span>
                  <span>{formatAmount(totalMaterielHT)}</span>
                </div>
              )}
              {selectedTodos.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Wrench className="h-3 w-3" /> Main d'œuvre HT
                  </span>
                  <span>{formatAmount(totalTravauxHT)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-sm">
                <span>Total HT</span>
                <span>{formatAmount(totalHT)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>TVA (20%)</span>
                <span>{formatAmount(totalTTC - totalHT)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total TTC</span>
                <span>{formatAmount(totalTTC)}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {exportResult?.success ? "Fermer" : "Annuler"}
          </Button>
          {!exportResult?.success && (
            <Button
              onClick={handleExport}
              disabled={
                isExporting || !selectedClientId || (selectedExpenses.length === 0 && selectedTodos.length === 0)
              }
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Créer le devis Evoliz
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportToEvolizDialog;
