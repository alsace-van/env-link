import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Package, DollarSign } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShippingFeeDialog } from "./ShippingFeeDialog";
import { ShippingFeeAssignDialog } from "./ShippingFeeAssignDialog";

interface ShippingFeeTier {
  id: string;
  quantity_from: number;
  quantity_to: number | null;
  total_price: number;
}

interface ShippingFee {
  id: string;
  nom: string;
  type: 'fixed' | 'variable' | 'free' | 'pickup';
  fixed_price: number | null;
  description: string | null;
  message_pickup: string | null;
  created_at: string;
  tiers?: ShippingFeeTier[];
  assigned_count?: number;
}

export const ShippingFeesManager = () => {
  const [shippingFees, setShippingFees] = useState<ShippingFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<ShippingFee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [feeToDelete, setFeeToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadShippingFees();
  }, []);

  const loadShippingFees = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Charger les frais de port
      const { data: fees, error: feesError } = await supabase
        .from("shipping_fees")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (feesError) throw feesError;

      // Pour chaque frais, charger les paliers et compter les accessoires assignés
      const feesWithDetails = await Promise.all(
        (fees || []).map(async (fee) => {
          // Charger les paliers si type variable
          let tiers: ShippingFeeTier[] = [];
          if (fee.type === 'variable') {
            const { data: tiersData } = await supabase
              .from("shipping_fee_tiers")
              .select("*")
              .eq("shipping_fee_id", fee.id)
              .order("quantity_from", { ascending: true });
            
            tiers = tiersData || [];
          }

          // Compter les accessoires assignés
          const { count } = await supabase
            .from("accessory_shipping_fees")
            .select("*", { count: 'exact', head: true })
            .eq("shipping_fee_id", fee.id);

          return {
            ...fee,
            tiers,
            assigned_count: count || 0,
          };
        })
      );

      setShippingFees(feesWithDetails);
    } catch (error: any) {
      console.error("Erreur lors du chargement des frais:", error);
      toast.error("Erreur lors du chargement des frais de port");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!feeToDelete) return;

    try {
      const { error } = await supabase
        .from("shipping_fees")
        .delete()
        .eq("id", feeToDelete);

      if (error) throw error;

      toast.success("Frais de port supprimé");
      loadShippingFees();
    } catch (error: any) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleteDialogOpen(false);
      setFeeToDelete(null);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'fixed': return 'Fixe';
      case 'variable': return 'Variable';
      case 'free': return 'Gratuit';
      case 'pickup': return 'Retrait atelier';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'fixed': return 'default';
      case 'variable': return 'secondary';
      case 'free': return 'outline';
      case 'pickup': return 'destructive';
      default: return 'default';
    }
  };

  const getPriceDisplay = (fee: ShippingFee) => {
    switch (fee.type) {
      case 'fixed':
        return `${fee.fixed_price?.toFixed(2) || '0.00'} €`;
      case 'variable':
        if (fee.tiers && fee.tiers.length > 0) {
          const minPrice = Math.min(...fee.tiers.map(t => t.total_price));
          const maxPrice = Math.max(...fee.tiers.map(t => t.total_price));
          return `${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)} €`;
        }
        return 'Non configuré';
      case 'free':
        return 'Gratuit';
      case 'pickup':
        return 'Retrait';
      default:
        return '-';
    }
  };

  const handleEdit = (fee: ShippingFee) => {
    setSelectedFee(fee);
    setEditDialogOpen(true);
  };

  const handleAssign = (fee: ShippingFee) => {
    setSelectedFee(fee);
    setAssignDialogOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedFee(null);
    setEditDialogOpen(true);
  };

  const handleDialogClose = () => {
    setEditDialogOpen(false);
    setAssignDialogOpen(false);
    setSelectedFee(null);
    loadShippingFees();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Gestion des Frais de Port
              </CardTitle>
              <CardDescription>
                Configurez les différents types de frais de port et assignez-les à vos accessoires
              </CardDescription>
            </div>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau frais de port
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {shippingFees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun frais de port configuré</p>
              <p className="text-sm mt-2">Créez votre premier type de frais pour commencer</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tarif</TableHead>
                  <TableHead>Accessoires assignés</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shippingFees.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{fee.nom}</span>
                        {fee.description && (
                          <span className="text-xs text-muted-foreground">
                            {fee.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTypeColor(fee.type) as any}>
                        {getTypeLabel(fee.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span>{getPriceDisplay(fee)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {fee.assigned_count} accessoire{fee.assigned_count !== 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssign(fee)}
                          title="Assigner aux accessoires"
                        >
                          <Package className="h-4 w-4 mr-1" />
                          Assigner
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(fee)}
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFeeToDelete(fee.id);
                            setDeleteDialogOpen(true);
                          }}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de création/modification */}
      <ShippingFeeDialog
        open={editDialogOpen}
        onClose={handleDialogClose}
        fee={selectedFee}
      />

      {/* Dialog d'assignation */}
      <ShippingFeeAssignDialog
        open={assignDialogOpen}
        onClose={handleDialogClose}
        fee={selectedFee}
      />

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce frais de port ? 
              Tous les accessoires liés seront désassignés.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
```

---

## ✅ Ce que fait ce composant

### Fonctionnalités principales :

1. **Affichage de la liste** des frais de port
2. **Création** d'un nouveau frais (bouton +)
3. **Modification** d'un frais existant (icône crayon)
4. **Suppression** d'un frais (icône poubelle)
5. **Assignation** rapide aux accessoires (bouton "Assigner")

### Informations affichées :

- 📝 **Nom** du frais
- 🏷️ **Type** (Fixe, Variable, Gratuit, Retrait)
- 💰 **Tarif** (adapté selon le type)
- 📦 **Nombre d'accessoires** assignés

### Particularités :

- **Chargement des paliers** pour les frais variables
- **Comptage automatique** des accessoires liés
- **Affichage intelligent** du prix selon le type
- **Badges de couleur** selon le type de frais

---

## 🎨 Aperçu visuel
```
┌─────────────────────────────────────────────────────────────┐
│ 📦 Gestion des Frais de Port        [+ Nouveau frais de port]│
├─────────────────────────────────────────────────────────────┤
│ Configurez les différents types de frais...                │
├─────────────────────────────────────────────────────────────┤
│ Nom                │ Type     │ Tarif      │ Assignés │     │
├─────────────────────────────────────────────────────────────┤
│ Frais toit         │ Variable │ 250-500 €  │ 2 acc.   │ 📋✏️🗑│
│ relevable          │          │            │          │     │
├─────────────────────────────────────────────────────────────┤
│ Frais standard     │ Fixe     │ 30,00 €    │ 5 acc.   │ 📋✏️🗑│
├─────────────────────────────────────────────────────────────┤
│ Retrait atelier    │ Retrait  │ Retrait    │ 1 acc.   │ 📋✏️🗑│
└─────────────────────────────────────────────────────────────┘
