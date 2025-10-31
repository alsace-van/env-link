import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Package, 
  PackageX, 
  Truck,
  Edit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type StockStatus = 'in_stock' | 'on_order' | 'out_of_stock';

interface StockStatusManagerProps {
  accessoryId: string;
  currentStatus: StockStatus;
  currentQuantity: number | null;
  deliveryDate?: string | null;
  trackingNumber?: string | null;
  onStatusChange?: () => void;
}

const stockStatusConfig = {
  in_stock: {
    icon: Package,
    label: "En stock",
    color: "bg-green-500 hover:bg-green-600",
    textColor: "text-green-700",
    badgeVariant: "default" as const,
  },
  on_order: {
    icon: Truck,
    label: "En commande",
    color: "bg-blue-500 hover:bg-blue-600",
    textColor: "text-blue-700",
    badgeVariant: "secondary" as const,
  },
  out_of_stock: {
    icon: PackageX,
    label: "Rupture de stock",
    color: "bg-red-500 hover:bg-red-600",
    textColor: "text-red-700",
    badgeVariant: "destructive" as const,
  },
};

export default function StockStatusManager({
  accessoryId,
  currentStatus,
  currentQuantity,
  deliveryDate,
  trackingNumber,
  onStatusChange,
}: StockStatusManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<StockStatus>(currentStatus);
  const [quantity, setQuantity] = useState(currentQuantity?.toString() || "0");
  const [newDeliveryDate, setNewDeliveryDate] = useState(deliveryDate || "");
  const [newTrackingNumber, setNewTrackingNumber] = useState(trackingNumber || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const currentConfig = stockStatusConfig[currentStatus];
  const CurrentIcon = currentConfig.icon;

  const handleQuickStatusChange = async (newStatus: StockStatus) => {
    if (newStatus === currentStatus) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('accessories_catalog')
        .update({ stock_status: newStatus })
        .eq('id', accessoryId);

      if (error) throw error;

      toast.success(`Statut changé en "${stockStatusConfig[newStatus].label}"`);
      onStatusChange?.();
    } catch (error: any) {
      console.error('Erreur lors du changement de statut:', error);
      toast.error("Erreur lors du changement de statut");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDetailedUpdate = async () => {
    setIsUpdating(true);
    try {
      const updateData: any = {
        stock_status: selectedStatus,
        stock_quantity: parseInt(quantity) || 0,
      };

      // Ajouter les champs conditionnels selon le statut
      if (selectedStatus === 'on_order') {
        updateData.delivery_date = newDeliveryDate || null;
        updateData.tracking_number = newTrackingNumber || null;
      }

      const { error } = await supabase
        .from('accessories_catalog')
        .update(updateData)
        .eq('id', accessoryId);

      if (error) throw error;

      toast.success("Stock mis à jour avec succès");
      setIsDialogOpen(false);
      onStatusChange?.();
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setIsUpdating(false);
    }
  };

  const openDialog = () => {
    setSelectedStatus(currentStatus);
    setQuantity(currentQuantity?.toString() || "0");
    setNewDeliveryDate(deliveryDate || "");
    setNewTrackingNumber(trackingNumber || "");
    setIsDialogOpen(true);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <div className="flex items-center gap-1 rounded-lg border p-1">
            {(Object.keys(stockStatusConfig) as StockStatus[]).map((status) => {
              const config = stockStatusConfig[status];
              const Icon = config.icon;
              const isActive = status === currentStatus;
              
              return (
                <Tooltip key={status}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={`h-8 w-8 p-0 ${isActive ? config.color : ''}`}
                      onClick={() => handleQuickStatusChange(status)}
                      disabled={isUpdating || isActive}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{config.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={openDialog}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Gestion avancée</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-2">
          <Badge variant={currentConfig.badgeVariant} className="whitespace-nowrap">
            {currentConfig.label}
          </Badge>
          {currentQuantity !== null && (
            <Badge variant="outline" className="whitespace-nowrap">
              Qté: {currentQuantity}
            </Badge>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestion avancée du stock</DialogTitle>
            <DialogDescription>
              Modifiez le statut et les détails de suivi pour cet accessoire
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Sélection du statut */}
            <div className="space-y-2">
              <Label>Statut du stock</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(stockStatusConfig) as StockStatus[]).map((status) => {
                  const config = stockStatusConfig[status];
                  const Icon = config.icon;
                  const isSelected = status === selectedStatus;
                  
                  return (
                    <Button
                      key={status}
                      variant={isSelected ? "default" : "outline"}
                      className={`justify-start ${isSelected ? config.color : ''}`}
                      onClick={() => setSelectedStatus(status)}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {config.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Quantité */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantité en stock</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            {/* Champs conditionnels pour commande */}
            {selectedStatus === 'on_order' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="deliveryDate">Date de livraison</Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={newDeliveryDate}
                    onChange={(e) => setNewDeliveryDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trackingNumber">Numéro de suivi</Label>
                  <Input
                    id="trackingNumber"
                    placeholder="Ex: 1Z999AA10123456784"
                    value={newTrackingNumber}
                    onChange={(e) => setNewTrackingNumber(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Affichage des informations actuelles */}
            {(deliveryDate || trackingNumber) && (
              <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                <p className="font-semibold">Informations actuelles :</p>
                {deliveryDate && (
                  <p className="text-muted-foreground">
                    Date de livraison : {new Date(deliveryDate).toLocaleDateString('fr-FR')}
                  </p>
                )}
                {trackingNumber && (
                  <p className="text-muted-foreground">
                    Suivi : {trackingNumber}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleDetailedUpdate} disabled={isUpdating}>
              {isUpdating ? "Mise à jour..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
