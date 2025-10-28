import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import PaymentTransactions from "@/components/PaymentTransactions";
import { MonthlyCharges } from "@/components/MonthlyCharges";
import { InstallmentPayments } from "@/components/InstallmentPayments";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FinancialSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  totalSales: number;
  onPaymentChange: () => void;
}

export const FinancialSidebar = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  totalSales,
  onPaymentChange,
}: FinancialSidebarProps) => {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[450px] sm:w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle>Gestion Financière - {projectName}</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-80px)] pr-4">
          <div className="space-y-6 mt-4">
            <PaymentTransactions 
              projectId={projectId} 
              totalSales={totalSales}
              onPaymentChange={onPaymentChange}
            />

            <MonthlyCharges projectId={projectId} />

            <InstallmentPayments projectId={projectId} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
