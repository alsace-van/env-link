import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Supplier {
  id: string;
  name: string;
}

interface AddSupplierExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDate: Date;
}

export const AddSupplierExpenseModal = ({ isOpen, onClose, onSuccess, selectedDate }: AddSupplierExpenseModalProps) => {
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
    }
  }, [isOpen]);

  const loadSuppliers = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("user_id", user.user.id)
      .order("name");

    if (error) {
      console.error("Error loading suppliers:", error);
    } else {
      setSuppliers(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!productName.trim() || !unitPrice || !quantity) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setIsLoading(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Non authentifié");

      const quantityNum = parseFloat(quantity);
      const unitPriceNum = parseFloat(unitPrice);
      const totalAmount = quantityNum * unitPriceNum;

      const { error } = await supabase
        .from("supplier_expenses")
        .insert([
          {
            user_id: user.user.id,
            product_name: productName.trim(),
            quantity: quantityNum,
            unit_price: unitPriceNum,
            total_amount: totalAmount,
            supplier_id: supplierId || null,
            order_date: selectedDate.toISOString(),
            notes: notes.trim() || null,
          },
        ]);

      if (error) throw error;

      toast.success("Dépense fournisseur ajoutée avec succès");
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error adding supplier expense:", error);
      toast.error("Erreur lors de l'ajout de la dépense");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setProductName("");
    setQuantity("1");
    setUnitPrice("");
    setSupplierId("");
    setNotes("");
    onClose();
  };

  const totalAmount = quantity && unitPrice 
    ? (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2)
    : "0.00";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Ajouter une dépense fournisseur</DialogTitle>
          <p className="text-sm text-gray-500">
            Date: {format(selectedDate, "d MMMM yyyy")}
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="productName">
              Nom du produit <span className="text-red-500">*</span>
            </Label>
            <Input
              id="productName"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ex: Panneau solaire 100W"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Quantité <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitPrice">
                Prix unitaire (€) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="unitPrice"
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Montant total</Label>
            <div className="text-2xl font-bold text-orange-600">
              {totalAmount} €
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier">Fournisseur (optionnel)</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un fournisseur" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informations supplémentaires..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
