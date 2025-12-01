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
import { AlertTriangle } from "lucide-react";

interface AIQuotaConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isOverLimit?: boolean; // true = limite atteinte, false = juste avertissement
}

export function AIQuotaConfirmDialog({
  open,
  onOpenChange,
  message,
  onConfirm,
  onCancel,
  isOverLimit = false,
}: AIQuotaConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${isOverLimit ? 'text-red-500' : 'text-yellow-500'}`} />
            {isOverLimit ? "Limite de tokens atteinte" : "Avertissement quota"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Continuer quand même
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
