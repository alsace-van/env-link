import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AdminAction {
  id: string;
  action: string;
  details: any;
  created_at: string;
  admin_id: string;
}

export const AdminActionsLog = () => {
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActions();
  }, []);

  const loadActions = async () => {
    const { data, error } = await supabase
      .from("admin_actions_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
    } else {
      setActions(data || []);
    }
    setLoading(false);
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      create_user: "Création d'utilisateur",
      delete_user: "Suppression d'utilisateur",
      send_message: "Envoi de message",
    };
    return labels[action] || action;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journal des actions administratives</CardTitle>
        <CardDescription>Historique des 50 dernières actions</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Chargement...</div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell>
                      {new Date(action.created_at).toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell>{getActionLabel(action.action)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {action.details?.email && `Email: ${action.details.email}`}
                      {action.details?.subject && `Sujet: ${action.details.subject}`}
                      {action.details?.is_global && " (Global)"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};