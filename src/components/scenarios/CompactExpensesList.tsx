// components/scenarios/CompactExpensesList.tsx
// Liste compacte de dépenses optimisée pour colonnes de scénarios

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Settings } from 'lucide-react';
import { toast } from 'sonner';
import ExpenseCard from './ExpenseCard';
import ExpenseFormDialog from '@/components/ExpenseFormDialog';
import CategoryManagementDialog from '@/components/CategoryManagementDialog';

interface CompactExpensesListProps {
  projectId: string;
  scenarioId: string;
  isLocked?: boolean;
  onExpenseChange?: () => void;
}

const CompactExpensesList = ({ 
  projectId, 
  scenarioId, 
  isLocked = false,
  onExpenseChange 
}: CompactExpensesListProps) => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [categoryIcons, setCategoryIcons] = useState<Record<string, string>>({});
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);

  const loadExpenses = async () => {
    setIsLoading(true);

    // Charger les icônes des catégories
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const categoriesResult: any = await (supabase as any)
        .from('categories')
        .select('id, nom, icon, parent_id, user_id')
        .eq('user_id', userData.user.id);

      if (categoriesResult.data) {
        const iconsMap: Record<string, string> = {};
        categoriesResult.data.forEach((cat: any) => {
          iconsMap[cat.nom] = cat.icon || '📦';
        });
        setCategoryIcons(iconsMap);
      }
    }

    // Charger les dépenses du scénario
    const expensesResult: any = await (supabase as any)
      .from('project_expenses')
      .select('*')
      .eq('scenario_id', scenarioId)
      .order('date_achat', { ascending: false });

    const { data, error } = expensesResult;

    if (error) {
      console.error('Erreur chargement dépenses:', error);
      toast.error('Erreur lors du chargement');
    } else {
      // Filtrer les dépenses archivées
      const filteredData = (data || []).filter((e: any) => e.est_archive !== true);
      setExpenses(filteredData);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadExpenses();
  }, [scenarioId]);

  const handleQuantityChange = async (expenseId: string, newQuantity: number) => {
    if (isLocked) {
      toast.error('Devis verrouillé - Modification impossible');
      return;
    }

    const { error } = await supabase
      .from('project_expenses')
      .update({ quantite: newQuantity })
      .eq('id', expenseId);

    if (error) {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    } else {
      await loadExpenses();
      onExpenseChange?.();
    }
  };

  const handleDelete = async (expenseId: string) => {
    if (isLocked) {
      toast.error('Devis verrouillé - Suppression impossible');
      return;
    }

    if (!confirm('Supprimer cette dépense ?')) return;

    const { error } = await supabase
      .from('project_expenses')
      .delete()
      .eq('id', expenseId);

    if (error) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    } else {
      toast.success('Dépense supprimée');
      await loadExpenses();
      onExpenseChange?.();
    }
  };

  const handleDuplicate = async (expense: any) => {
    if (isLocked) {
      toast.error('Devis verrouillé - Duplication impossible');
      return;
    }

    const { id, created_at, ...expenseData } = expense;
    const { error } = await supabase
      .from('project_expenses')
      .insert({
        ...expenseData,
        scenario_id: scenarioId
      });

    if (error) {
      toast.error('Erreur lors de la duplication');
      console.error(error);
    } else {
      toast.success('Dépense dupliquée');
      await loadExpenses();
      onExpenseChange?.();
    }
  };

  // Grouper par catégorie
  const groupedByCategory: Record<string, any[]> = {};
  expenses.forEach((expense) => {
    const cat = expense.categorie || 'Sans catégorie';
    if (!groupedByCategory[cat]) {
      groupedByCategory[cat] = [];
    }
    groupedByCategory[cat].push(expense);
  });

  const categories = Object.keys(groupedByCategory);

  if (isLoading) {
    return <div className="text-center py-4 text-sm">Chargement...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-sm">Liste des dépenses</h4>
        <Button 
          size="sm" 
          onClick={() => setIsDialogOpen(true)}
          disabled={isLocked}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Ajouter
        </Button>
      </div>

      {/* Filtres catégories */}
      <div className="flex gap-1.5 flex-wrap text-xs">
        <Badge variant="secondary" className="cursor-default">
          Toutes ({expenses.length})
        </Badge>
        {categories.slice(0, 3).map((cat) => (
          <Badge key={cat} variant="outline" className="cursor-default">
            <span className="mr-1">{categoryIcons[cat] || '📦'}</span>
            {cat} ({groupedByCategory[cat].length})
          </Badge>
        ))}
        {categories.length > 3 && (
          <Badge variant="outline" className="cursor-default">
            +{categories.length - 3}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-2"
          onClick={() => setIsCategoryDialogOpen(true)}
        >
          <Settings className="h-3 w-3" />
        </Button>
      </div>

      {/* Liste par catégories */}
      {expenses.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Aucune dépense
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={categories} className="space-y-2">
          {categories.map((category) => (
            <AccordionItem key={category} value={category} className="border rounded-lg">
              <AccordionTrigger className="px-3 py-2 hover:no-underline">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-lg">{categoryIcons[category] || '📦'}</span>
                  <span className="font-medium">{category}</span>
                  <Badge variant="secondary" className="text-xs">
                    {groupedByCategory[category].length} article(s)
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 space-y-2">
                {groupedByCategory[category].map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    categoryIcon={categoryIcons[category]}
                    onEdit={() => setEditingExpense(expense)}
                    onDelete={() => handleDelete(expense.id)}
                    onDuplicate={() => handleDuplicate(expense)}
                    onQuantityChange={(qty) => handleQuantityChange(expense.id, qty)}
                    isLocked={isLocked}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Dialog pour ajouter/éditer une dépense - utilise le composant existant avec les bonnes props */}
      {(isDialogOpen || editingExpense !== null) && (
        <ExpenseFormDialog
          projectId={projectId}
          isOpen={isDialogOpen || editingExpense !== null}
          onClose={() => {
            setIsDialogOpen(false);
            setEditingExpense(null);
          }}
          onSuccess={() => {
            loadExpenses();
            onExpenseChange?.();
          }}
          expense={editingExpense}
          existingCategories={Object.keys(categoryIcons)}
        />
      )}

      {/* Dialog gestion catégories - passe les props attendues */}
      {isCategoryDialogOpen && (
        <CategoryManagementDialog
          isOpen={isCategoryDialogOpen}
          onClose={() => setIsCategoryDialogOpen(false)}
          onSuccess={loadExpenses}
          categories={[]}
        />
      )}
    </div>
  );
};

export default CompactExpensesList;
