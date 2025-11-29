// components/scenarios/ExpenseCard.tsx
// Carte de dépense compacte optimisée pour les colonnes de scénarios (450px)

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, FileText, Trash2, Copy } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExpenseCardProps {
  expense: any;
  categoryIcon?: string;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onQuantityChange: (newQuantity: number) => void;
  onNotice?: () => void;
  isLocked?: boolean;
}

const ExpenseCard = ({ 
  expense, 
  categoryIcon = '📦',
  onEdit, 
  onDelete,
  onDuplicate,
  onQuantityChange,
  onNotice,
  isLocked = false
}: ExpenseCardProps) => {
  // Calculs
  const optionsTotal = (expense.selectedOptions || []).reduce(
    (sum: number, opt: any) => sum + opt.prix_reference,
    0
  );
  const totalAchat = expense.prix + optionsTotal;
  const totalAchatHT = totalAchat * expense.quantite;

  const optionsVenteTotal = (expense.selectedOptions || []).reduce(
    (sum: number, opt: any) => sum + opt.prix_vente_ttc,
    0
  );
  const totalVente = (expense.prix_vente_ttc || 0) + optionsVenteTotal;
  const totalVenteTTC = totalVente * expense.quantite;

  return (
    <Card className="p-3">
      {/* Ligne 1: Nom + Prix vente */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate" title={expense.nom_accessoire}>
            {expense.nom_accessoire}
          </h4>
          {expense.marque && (
            <Badge variant="secondary" className="text-xs mt-1">
              {expense.marque}
            </Badge>
          )}
        </div>
        
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">Prix vente TTC</p>
          <p className="font-bold text-lg text-green-600 dark:text-green-400">
            {totalVente.toFixed(2)} €
          </p>
        </div>
      </div>

      {/* Ligne 2: Détails sur 2 colonnes */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-2">
        <div>
          <span className="text-muted-foreground">Prix achat:</span>
          <p className="font-medium">{expense.prix.toFixed(2)} € ×</p>
        </div>
        
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min="1"
            value={expense.quantite}
            onChange={(e) => onQuantityChange(parseInt(e.target.value) || 1)}
            className="h-6 w-14 text-center text-xs p-1"
            disabled={isLocked}
          />
        </div>

        <div className="col-span-2">
          <span className="text-muted-foreground">Prix vente TTC:</span>
          <span className="ml-1 font-medium">{expense.prix_vente_ttc?.toFixed(2) || '0.00'} €</span>
        </div>

        {expense.date_achat && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Date:</span>
            <span className="ml-1">{new Date(expense.date_achat).toLocaleDateString('fr-FR')}</span>
          </div>
        )}

        {expense.fournisseur && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Fournisseur:</span>
            <span className="ml-1">{expense.fournisseur}</span>
          </div>
        )}
      </div>

      {/* Options si présentes */}
      {expense.selectedOptions && expense.selectedOptions.length > 0 && (
        <div className="text-xs mb-2 p-2 bg-muted/50 rounded">
          <span className="font-medium">Options:</span>
          <ul className="ml-2 mt-1 space-y-0.5">
            {expense.selectedOptions.map((opt: any, idx: number) => (
              <li key={idx} className="truncate">• {opt.nom}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Ligne 3: Totaux + Actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t">
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-x-2 text-xs">
            <div>
              <span className="text-muted-foreground">Total achat HT</span>
              <p className="font-semibold">{totalAchatHT.toFixed(2)} €</p>
            </div>
            <div>
              <span className="text-muted-foreground">Total vente TTC</span>
              <p className="font-semibold text-green-600">{totalVenteTTC.toFixed(2)} €</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1 shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onEdit}
                  disabled={isLocked}
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Modifier</p></TooltipContent>
            </Tooltip>

            {expense.accessory_id && onNotice && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onNotice}
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Notice</p></TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onDuplicate}
                  disabled={isLocked}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Dupliquer</p></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={onDelete}
                  disabled={isLocked}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Supprimer</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </Card>
  );
};

export default ExpenseCard;
