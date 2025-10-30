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
import { ArrowLeft, Users, Shield, Trash2, Activity } from "lucide-react";
import { toast } from "sonner";
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
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { SendMessageDialog } from "@/components/admin/SendMessageDialog";
import { AdminActionsLog } from "@/components/admin/AdminActionsLog";
import { LoginHistoryCard } from "@/components/admin/LoginHistoryCard";
import { ShopWelcomeConfigDialog } from "@/components/admin/ShopWelcomeConfigDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserData {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  is_admin: boolean;
  project_count: number;
  display_name: string | null;
}

const Admin = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
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

      if (!response.ok) {
        throw new Error(result.error);
      }

      setUsers(result.users);
    } catch (error: any) {
      toast.error("Erreur lors du chargement des utilisateurs");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ userId: deleteUserId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error);
      }

      toast.success("Utilisateur supprimé avec succès");
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la suppression");
      console.error(error);
    } finally {
      setDeleteUserId(null);
    }
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Administration</h1>
                <p className="text-muted-foreground">
                  Gestion des utilisateurs et de la plateforme
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <CreateUserDialog onUserCreated={loadUsers} />
              <SendMessageDialog />
              <ShopWelcomeConfigDialog />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
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

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total des projets
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users.reduce((sum, u) => sum + u.project_count, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Projets créés
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="users" className="space-y-4">
            <TabsList>
              <TabsTrigger value="users">Utilisateurs</TabsTrigger>
              <TabsTrigger value="logins">Connexions</TabsTrigger>
              <TabsTrigger value="actions">Journal d'activité</TabsTrigger>
            </TabsList>

            <TabsContent value="users">
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
                          <TableHead>Nom</TableHead>
                          <TableHead>Rôle</TableHead>
                          <TableHead>Projets</TableHead>
                          <TableHead>Date de création</TableHead>
                          <TableHead>Dernière connexion</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.email}
                            </TableCell>
                            <TableCell>
                              {user.display_name || "-"}
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
                              <Badge variant="outline">{user.project_count}</Badge>
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
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <SendMessageDialog 
                                  recipientId={user.id} 
                                  recipientEmail={user.email}
                                />
                                {user.id !== currentUser?.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteUserId(user.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logins">
              <LoginHistoryCard />
            </TabsContent>

            <TabsContent value="actions">
              <AdminActionsLog />
            </TabsContent>
          </Tabs>
        </div>

        <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible
                et supprimera également tous ses projets et données associées.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Admin;
