import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomerForm, CustomerFormData } from "@/components/CustomerForm";

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CustomerFormData) => void;
  initialData?: Partial<CustomerFormData>;
}

export const CustomerFormDialog = ({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: CustomerFormDialogProps) => {
  const handleSubmit = (data: CustomerFormData) => {
    onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Informations de facturation et livraison</DialogTitle>
          <DialogDescription>
            Veuillez compléter vos informations pour finaliser votre commande
          </DialogDescription>
        </DialogHeader>
        
        <CustomerForm
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          submitLabel="Continuer vers le paiement"
        />
      </DialogContent>
    </Dialog>
  );
};
