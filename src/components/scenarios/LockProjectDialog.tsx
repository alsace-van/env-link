// components/scenarios/LockProjectDialog.tsx
// Dialog pour verrouiller un projet et créer un snapshot du devis

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SnapshotContent } from "@/types/scenarios";

interface LockProjectDialogProps {
  projectId: string;
  scenarioId: string;
  onClose: () => void;
  onLocked: () => void;
}

const LockProjectDialog = ({ projectId, scenarioId, onClose, onLocked }: LockProjectDialogProps) => {
  const [montantAcompte, setMontantAcompte] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLock = async () => {
    if (!montantAcompte || parseFloat(montantAcompte) <= 0) {
      toast.error("Veuillez saisir un montant d'acompte valide");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Récupérer les données du projet
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      // 2. Récupérer toutes les dépenses du scénario
      const expensesResult: any = await (supabase as any)
        .from("project_expenses")
        .select("*")
        .eq("scenario_id", scenarioId);

      const expenses = expensesResult.data;
      const expensesError = expensesResult.error;

      if (expensesError) throw expensesError;

      // Filtrer les dépenses archivées
      const activeExpenses = (expenses || []).filter((e: any) => e.est_archive !== true);

      // 3. Calculer les totaux
      const total_achat = activeExpenses.reduce((sum: number, e: any) => sum + e.prix * e.quantite, 0);
      const total_vente = activeExpenses.reduce((sum: number, e: any) => sum + (e.prix_vente_ttc || 0) * e.quantite, 0);
      const marge = total_achat > 0 ? ((total_vente - total_achat) / total_achat) * 100 : 0;

      // 4. Calculer le bilan énergétique
      const production = activeExpenses
        .filter((e: any) => e.nom_accessoire?.toLowerCase().includes("panneau"))
        .reduce((sum: number, e: any) => {
          const match = e.nom_accessoire?.match(/(\d+)\s*w/i);
          return match ? sum + parseInt(match[1]) * e.quantite : sum;
        }, 0);

      const stockage_ah = activeExpenses
        .filter((e: any) => e.nom_accessoire?.toLowerCase().includes("batterie"))
        .reduce((sum: number, e: any) => {
          const match = e.nom_accessoire?.match(/(\d+)\s*ah/i);
          return match ? sum + parseInt(match[1]) * e.quantite : sum;
        }, 0);

      // 5. Créer le contenu du snapshot
      const vehicule = [
        (project as any).marque_officielle || (project as any).marque_vehicule || (project as any).marque_custom || "",
        (project as any).modele_officiel || (project as any).modele_vehicule || (project as any).modele_custom || "",
      ]
        .filter(Boolean)
        .join(" ");

      const snapshotContent: SnapshotContent = {
        version: 1,
        date: new Date().toISOString(),
        nom: "Devis validé",
        projet: {
          nom_proprietaire: project.nom_proprietaire,
          vehicule: vehicule,
          ...project,
        },
        depenses: activeExpenses,
        totaux: {
          total_achat_ht: total_achat,
          total_vente_ttc: total_vente,
          marge_totale: total_vente - total_achat,
          marge_pourcentage: marge,
        },
        bilan_energie:
          production > 0 || stockage_ah > 0
            ? {
                production_w: production,
                stockage_ah: stockage_ah,
                stockage_wh: stockage_ah * 12,
                autonomie_jours:
                  production > 0 && stockage_ah > 0 ? Math.round(((stockage_ah * 12) / (production * 5)) * 10) / 10 : 0,
              }
            : undefined,
        metadata: {
          nombre_articles: activeExpenses.length,
          categories_utilisees: [...new Set(activeExpenses.map((e: any) => e.categorie).filter(Boolean))] as string[],
          date_validation: new Date().toISOString(),
          montant_acompte: parseFloat(montantAcompte),
        },
      };

      // 6. Créer le snapshot
      const { error: snapshotError } = await supabase.from("devis_snapshots" as any).insert({
        project_id: projectId,
        scenario_id: scenarioId,
        version_numero: 1,
        nom_snapshot: "Devis validé",
        contenu_complet: snapshotContent,
        notes,
      });

      if (snapshotError) throw snapshotError;

      // 7. Mettre à jour le projet
      const { error: updateError } = await supabase
        .from("projects")
        .update({
          statut_financier: "devis_accepte",
          date_validation_devis: new Date().toISOString(),
          date_encaissement_acompte: new Date().toISOString(),
          montant_acompte: parseFloat(montantAcompte),
        } as any)
        .eq("id", projectId);

      if (updateError) throw updateError;

      // 8. Verrouiller le scénario
      const { error: lockError } = await (supabase
        .from("project_scenarios" as any)
        .update({ is_locked: true })
        .eq("id", scenarioId) as any);

      if (lockError) throw lockError;

      // 9. Ajouter l'acompte comme paiement
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { error: paymentError } = await supabase.from("project_payment_transactions").insert({
          project_id: projectId,
          user_id: userData.user.id,
          type_paiement: "acompte",
          montant: parseFloat(montantAcompte),
          date_paiement: new Date().toISOString().split("T")[0],
          notes: "Acompte à la signature du devis",
        } as any);

        if (paymentError) {
          console.error("Erreur ajout paiement:", paymentError);
        }
      }

      // 10. Mettre toutes les dépenses du scénario en statut "commande" (shopping list)
      const { error: expensesUpdateError } = await supabase
        .from("project_expenses")
        .update({ statut_livraison: "commande" })
        .eq("scenario_id", scenarioId);

      if (expensesUpdateError) {
        console.error("Erreur mise à jour statut dépenses:", expensesUpdateError);
      }

      toast.success("Devis verrouillé avec succès !");
      onLocked();
    } catch (error) {
      console.error("Erreur verrouillage:", error);
      toast.error("Erreur lors du verrouillage");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Verrouiller le devis
          </DialogTitle>
          <DialogDescription>
            Cette action va créer un snapshot du devis actuel et activer le suivi des modifications.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Avertissement */}
          <div className="flex gap-3 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-orange-900 dark:text-orange-100">Après verrouillage :</p>
              <ul className="list-disc list-inside text-orange-800 dark:text-orange-200 space-y-1">
                <li>Toute modification sera tracée dans l'historique</li>
                <li>Un snapshot du devis sera créé</li>
                <li>Vous devrez justifier chaque changement</li>
              </ul>
            </div>
          </div>

          {/* Montant acompte */}
          <div className="space-y-2">
            <Label htmlFor="acompte">Montant de l'acompte (€) *</Label>
            <Input
              id="acompte"
              type="number"
              step="0.01"
              value={montantAcompte}
              onChange={(e) => setMontantAcompte(e.target.value)}
              placeholder="Ex: 3000.00"
              required
            />
            <p className="text-xs text-muted-foreground">Montant encaissé à la signature du devis</p>
          </div>

          {/* Notes optionnelles */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Remarques sur la validation du devis..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleLock} disabled={isLoading}>
            {isLoading ? "Verrouillage..." : "Verrouiller le devis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LockProjectDialog;
