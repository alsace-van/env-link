import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Shield } from "lucide-react";
import { toast } from "sonner";

interface UserData {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  is_admin: boolean;
}

const Admin = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/");
      return;
    }

    setCurrentUser(user);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      toast.error("Accès non autorisé");
      navigate("/dashboard");
      return;
    }

    loadUsers();
  };

  const loadUsers = async () => {
    setIsLoading(true);

    // Get all users from profiles (which mirrors auth.users via trigger)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, created_at");

    if (profilesError) {
      toast.error("Erreur lors du chargement des utilisateurs");
      console.error(profilesError);
      setIsLoading(false);
      return;
    }

    // Get roles for all users
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    // Get last login for each user
    const { data: logins } = await supabase
      .from("user_logins")
      .select("user_id, login_at")
      .order("login_at", { ascending: false });

    // Get auth data for emails (Note: admin.listUsers may not be available)
    // We'll need to implement this differently or use an edge function
    const usersData: UserData[] = await Promise.all(
      profiles.map(async (profile) => {
        const userRoles = roles?.filter((r) => r.user_id === profile.id) || [];
        const lastLogin = logins?.find((l) => l.user_id === profile.id);

        // Get email from auth metadata via RPC or edge function
        // For now, we'll show the user ID
        return {
          id: profile.id,
          email: profile.id.substring(0, 8) + "...", // Placeholder
          created_at: profile.created_at,
          last_sign_in_at: lastLogin?.login_at || profile.created_at,
          is_admin: userRoles.some((r) => r.role === "admin"),
        };
      })
    );

    setUsers(usersData.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour au tableau de bord
        </Button>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Administration</h1>
              <p className="text-muted-foreground">
                Gestion des utilisateurs et de la plateforme
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total des utilisateurs
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
                <p className="text-xs text-muted-foreground">
                  Comptes enregistrés
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Administrateurs
                </CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users.filter((u) => u.is_admin).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Comptes avec privilèges admin
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Liste des utilisateurs</CardTitle>
              <CardDescription>
                Vue d'ensemble de tous les comptes utilisateurs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Chargement...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Date de création</TableHead>
                      <TableHead>Dernière connexion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          {user.is_admin ? (
                            <Badge variant="default">
                              <Shield className="h-3 w-3 mr-1" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Utilisateur</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString("fr-FR", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          {new Date(user.last_sign_in_at).toLocaleDateString("fr-FR", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Admin;
