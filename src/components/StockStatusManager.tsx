// ============================================================================
// FICHIER 2 : StockStatusManager.tsx
// EMPLACEMENT : src/components/StockStatusManager.tsx
// ACTION : REMPLACER le fichier existant par celui-ci
// ============================================================================

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, PackageX, Truck, Edit, Calendar, Clipboard } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type StockStatus = "in_stock" | "on_order" | "out_of_stock";

interface StockStatusManagerProps {
  accessoryId: string;
  accessoryName: string;
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
  accessoryName,
  currentStatus,
  currentQuantity,
  deliveryDate,
  trackingNumber,
  onStatusChange,
}: StockStatusManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<StockStatus>(currentStatus);
  const [quantity, setQuantity] = useState(currentQuantity?.toString() || "0");
  const [newDeliveryDate, setNewDeliveryDate] = useState(deliveryDate || "");
  const [newTrackingNumber, setNewTrackingNumber] = useState(trackingNumber || "");
  const [orderNotes, setOrderNotes] = useState("");
  const [addToPlanning, setAddToPlanning] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const currentConfig = stockStatusConfig[currentStatus];
  const CurrentIcon = currentConfig.icon;

  // Ouvrir automatiquement la modal quand on passe en "commande"
  const handleQuickStatusChange = async (newStatus: StockStatus) => {
    if (newStatus === currentStatus) return;

    // Si on passe en "commande", ouvrir la modal spécifique
    if (newStatus === "on_order") {
      setSelectedStatus(newStatus);
      setNewDeliveryDate("");
      setNewTrackingNumber("");
      setOrderNotes("");
      setAddToPlanning(true);
      setIsOrderModalOpen(true);
      return;
    }

    // Pour les autres statuts, changement direct
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("accessories_catalog")
        .update({
          stock_status: newStatus,
          delivery_date: null,
          tracking_number: null,
        })
        .eq("id", accessoryId);

      if (error) throw error;

      toast.success(`Statut changé en "${stockStatusConfig[newStatus].label}"`);
      onStatusChange?.();
    } catch (error: any) {
      console.error("Erreur lors du changement de statut:", error);
      toast.error("Erreur lors du changement de statut");
    } finally {
      setIsUpdating(false);
    }
  };

  // Gérer la validation de la modal de commande
  const handleOrderConfirm = async () => {
    setIsUpdating(true);
    try {
      // 1. Mettre à jour le statut de l'accessoire
      const updateData: any = {
        stock_status: "on_order",
        delivery_date: newDeliveryDate || null,
        tracking_number: newTrackingNumber || null,
      };

      const { error: accessoryError } = await supabase
        .from("accessories_catalog")
        .update(updateData)
        .eq("id", accessoryId);

      if (accessoryError) throw accessoryError;

      // 2. Créer une tâche GLOBALE dans le planning si demandé
      if (addToPlanning && newDeliveryDate) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          toast.error("Utilisateur non connecté");
          return;
        }

        const deliveryDateTime = new Date(newDeliveryDate);
        deliveryDateTime.setHours(14, 0, 0, 0); // Par défaut à 14h

        const taskData = {
          user_id: user.id,
          title: `📦 Livraison : ${accessoryName}`,
          description: orderNotes
            ? `${orderNotes}${newTrackingNumber ? `\n\nSuivi: ${newTrackingNumber}` : ""}`
            : newTrackingNumber
              ? `Numéro de suivi: ${newTrackingNumber}`
              : "",
          due_date: deliveryDateTime.toISOString(),
          completed: false,
          priority: "medium",
          task_type: "delivery",
          accessory_id: accessoryId,
        };

        const { error: todoError } = await supabase.from("global_todos").insert(taskData);

        if (todoError) {
          console.error("Erreur lors de la création de la tâche:", todoError);
          toast.warning("Accessoire mis à jour mais erreur lors de la création de la tâche planning");
        } else {
          toast.success("Commande enregistrée et ajoutée au planning global !");
        }
      } else {
        toast.success("Commande enregistrée !");
      }

      setIsOrderModalOpen(false);
      onStatusChange?.();
    } catch (error: any) {
      console.error("Erreur lors de la mise à jour:", error);
      toast.error("Erreur lors de l'enregistrement");
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
      if (selectedStatus === "on_order") {
        updateData.delivery_date = newDeliveryDate || null;
        updateData.tracking_number = newTrackingNumber || null;
      } else {
        updateData.delivery_date = null;
        updateData.tracking_number = null;
      }

      const { error } = await supabase.from("accessories_catalog").update(updateData).eq("id", accessoryId);

      if (error) throw error;

      toast.success("Stock mis à jour avec succès");
      setIsDialogOpen(false);
      onStatusChange?.();
    } catch (error: any) {
      console.error("Erreur lors de la mise à jour:", error);
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
                      className={`h-8 w-8 p-0 ${isActive ? config.color : ""}`}
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
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={openDialog}>
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
          {deliveryDate && currentStatus === "on_order" && (
            <Badge variant="outline" className="whitespace-nowrap bg-blue-50 text-blue-700 border-blue-300">
              <Calendar className="h-3 w-3 mr-1" />
              {new Date(deliveryDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </Badge>
          )}
        </div>
      </div>

      {/* MODAL COMMANDE */}
      <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>📦 Commande en cours</DialogTitle>
            <DialogDescription>
              Renseignez les informations de livraison pour <strong>{accessoryName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="orderDeliveryDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date de livraison estimée
              </Label>
              <Input
                id="orderDeliveryDate"
                type="date"
                value={newDeliveryDate}
                onChange={(e) => setNewDeliveryDate(e.target.value)}
                placeholder="Laisser vide si inconnue"
              />
              <p className="text-xs text-muted-foreground">
                Vous pourrez renseigner cette date plus tard via le bouton ⚙️
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderTrackingNumber" className="flex items-center gap-2">
                <Clipboard className="h-4 w-4" />
                Numéro de suivi (optionnel)
              </Label>
              <Input
                id="orderTrackingNumber"
                placeholder="Ex: 1Z999AA10123456784"
                value={newTrackingNumber}
                onChange={(e) => setNewTrackingNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderNotes">Notes (optionnelles)</Label>
              <Textarea
                id="orderNotes"
                placeholder="Informations supplémentaires sur la commande..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* CHECKBOX PLANNING GLOBAL */}
            {newDeliveryDate && (
              <div className="flex items-start space-x-2 rounded-lg border p-3 bg-blue-50">
                <Checkbox
                  id="addToPlanning"
                  checked={addToPlanning}
                  onCheckedChange={(checked) => setAddToPlanning(checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="addToPlanning"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Ajouter au planning global
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Crée une tâche "📦 Livraison : {accessoryName}" dans le planning partagé entre tous vos projets
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOrderModalOpen(false)} disabled={isUpdating}>
              Annuler
            </Button>
            <Button onClick={handleOrderConfirm} disabled={isUpdating}>
              {isUpdating ? "Enregistrement..." : "Confirmer la commande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL GESTION AVANCÉE */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestion avancée du stock</DialogTitle>
            <DialogDescription>Modifiez le statut et les détails de suivi pour cet accessoire</DialogDescription>
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
                      className={`justify-start ${isSelected ? config.color : ""}`}
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
            {selectedStatus === "on_order" && (
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
                    Date de livraison : {new Date(deliveryDate).toLocaleDateString("fr-FR")}
                  </p>
                )}
                {trackingNumber && <p className="text-muted-foreground">Suivi : {trackingNumber}</p>}
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
