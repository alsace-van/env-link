import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { FolderOpen, Building2, X } from "lucide-react";

interface AddToProjectExpensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onConfirm: (expenseType: "general" | "supplier" | null) => void;
}

export const AddToProjectExpensesDialog = ({
  open,
  onOpenChange,
  projectName,
  onConfirm,
}: AddToProjectExpensesDialogProps) => {
  const [selectedType, setSelectedType] = useState<"general" | "supplier">("general");

  const handleConfirm = () => {
    onConfirm(selectedType);
    onOpenChange(false);
  };

  const handleSkip = () => {
    onConfirm(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter au projet ?</DialogTitle>
          <DialogDescription>
            Voulez-vous ajouter ces achats au suivi des dépenses de votre projet "{projectName}" ?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={selectedType} onValueChange={(value: "general" | "supplier") => setSelectedType(value)}>
            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="general" id="general" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="general" className="cursor-pointer font-medium flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  Dépenses générales
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Ajouter à la liste générale des dépenses du projet
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="supplier" id="supplier" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="supplier" className="cursor-pointer font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Dépenses fournisseur
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Ajouter aux dépenses du fournisseur "Alsace Van Creation"
                </p>
              </div>
            </div>
          </RadioGroup>

          <div className="bg-muted/30 border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Note :</strong> Vous pourrez toujours ajouter ces achats à votre projet plus tard depuis
              l'onglet "Mes commandes" si vous sautez cette étape.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleSkip} className="w-full sm:w-auto">
            <X className="h-4 w-4 mr-2" />
            Non, juste commander
          </Button>
          <Button onClick={handleConfirm} className="w-full sm:w-auto">
            Oui, ajouter aux dépenses
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
