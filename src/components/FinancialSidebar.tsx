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
      <SheetContent side="right" className="w-[360px] sm:w-[400px] sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-base">Gestion Financière - {projectName}</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-80px)] pr-3">
          <div className="space-y-4 mt-3">
            <PaymentTransactions 
              currentProjectId={projectId}
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
