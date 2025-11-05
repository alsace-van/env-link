import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ShippingFeesManager } from "@/components/admin/ShippingFeesManager";

interface ShippingFeesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onFeesChange?: () => void;
}

export const ShippingFeesSidebar = ({ isOpen, onClose, onFeesChange }: ShippingFeesSidebarProps) => {
  const handleClose = () => {
    onClose();
    if (onFeesChange) {
      onFeesChange();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-[900px] sm:max-w-[900px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Gestion des Frais de Port</SheetTitle>
          <SheetDescription>
            Créez et gérez les différents types de frais de port, puis assignez-les rapidement à vos accessoires
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <ShippingFeesManager />
        </div>
      </SheetContent>
    </Sheet>
  );
};
