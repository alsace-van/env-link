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
import { Badge } from "@/components/ui/badge";

interface LoginHistory {
  id: string;
  user_id: string;
  login_at: string;
  user_agent: string | null;
  ip_address: string | null;
  user_email?: string;
}

export const LoginHistoryCard = () => {
  const [logins, setLogins] = useState<LoginHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLoginHistory();
  }, []);

  const loadLoginHistory = async () => {
    // Get login history
    const { data: loginsData, error: loginsError } = await supabase
      .from("user_logins")
      .select("*")
      .order("login_at", { ascending: false })
      .limit(100);

    if (loginsError) {
      console.error(loginsError);
      setLoading(false);
      return;
    }

    // Get user emails via edge function
    const { data: { session } } = await supabase.auth.getSession();
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      const result = await response.json();
      
      if (response.ok && result.users) {
        const usersMap = new Map<string, string>(
          result.users.map((u: any) => [u.id, u.email as string])
        );
        
        const loginsWithEmails: LoginHistory[] = loginsData.map(login => ({
          ...login,
          user_email: usersMap.get(login.user_id) || "Utilisateur inconnu",
        }));
        
        setLogins(loginsWithEmails);
      } else {
        setLogins(loginsData);
      }
    } catch (error) {
      console.error(error);
      setLogins(loginsData);
    }

    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des connexions</CardTitle>
        <CardDescription>100 dernières connexions à l'application</CardDescription>
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
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Navigateur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logins.map((login) => (
                  <TableRow key={login.id}>
                    <TableCell>
                      {new Date(login.login_at).toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{login.user_email || login.user_id.substring(0, 8)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {login.ip_address || "N/A"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {login.user_agent || "N/A"}
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