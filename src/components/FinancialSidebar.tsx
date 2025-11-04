import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import PaymentTransactions from "@/components/PaymentTransactions";
import { MonthlyCharges } from "@/components/MonthlyCharges";
import { InstallmentPayments } from "@/components/InstallmentPayments";
import { AnnualCharts } from "@/components/AnnualCharts";
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
      <SheetContent side="right" className="w-[360px] sm:w-[400px] sm:max-w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="text-base">Gestion Financière - {projectName}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 py-4">
            <PaymentTransactions
              currentProjectId={projectId}
              totalSales={totalSales}
              onPaymentChange={onPaymentChange}
            />

            <MonthlyCharges projectId={projectId} />

            <InstallmentPayments projectId={projectId} />

            <AnnualCharts projectId={projectId} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
