import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Damage {
  id: string;
  description: string;
  severity: "minor" | "moderate" | "severe";
  photo_url?: string;
  zone_name?: string;
}

interface DamagesListProps {
  damages: Damage[];
  onUpdate: () => void;
}

export const DamagesList = ({ damages, onUpdate }: DamagesListProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDamageId, setDeleteDamageId] = useState<string | null>(null);
  const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null);

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "minor":
        return { icon: "⚠️", label: "Mineur", variant: "secondary" as const };
      case "moderate":
        return { icon: "🔶", label: "Moyen", variant: "default" as const };
      case "severe":
        return { icon: "🔴", label: "Grave", variant: "destructive" as const };
      default:
        return { icon: "⚠️", label: "Mineur", variant: "secondary" as const };
    }
  };

  const handleDelete = async () => {
    if (!deleteDamageId) return;

    try {
      const damage = damages.find((d) => d.id === deleteDamageId);
      if (damage?.photo_url) {
        const filePath = damage.photo_url.split("/vehicle-inspections/").pop();
        if (filePath) {
          await supabase.storage.from("vehicle-inspections").remove([filePath]);
        }
      }

      const { error } = await supabase
        .from("vehicle_damages")
        .delete()
        .eq("id", deleteDamageId);

      if (error) throw error;

      toast.success("Dégât supprimé");
      onUpdate();
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleteDialogOpen(false);
      setDeleteDamageId(null);
    }
  };

  if (damages.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Aucun dégât constaté pour le moment
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {damages.map((damage) => {
          const severityConfig = getSeverityConfig(damage.severity);
          return (
            <Card key={damage.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{severityConfig.icon}</span>
                      <Badge variant={severityConfig.variant}>
                        {severityConfig.label}
                      </Badge>
                      {damage.zone_name && (
                        <Badge variant="outline">{damage.zone_name}</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeleteDamageId(damage.id);
                      setDeleteDialogOpen(true);
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap mb-3">{damage.description}</p>
                {damage.photo_url && (
                  <div className="relative group w-32 h-32 rounded-lg overflow-hidden border">
                    <img
                      src={damage.photo_url}
                      alt="Photo du dégât"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setViewPhotoUrl(damage.photo_url!)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce dégât ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewPhotoUrl} onOpenChange={() => setViewPhotoUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Photo du dégât</DialogTitle>
          </DialogHeader>
          <img src={viewPhotoUrl || ""} alt="Photo du dégât" className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
};
