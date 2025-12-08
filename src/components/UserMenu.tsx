import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User as UserIcon, Settings, LogOut, Shield, Moon, Sun, Monitor, FileText, Users, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";

interface UserMenuProps {
  user: User;
}

const UserMenu = ({ user }: UserMenuProps) => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    checkAdminStatus();
    loadUserProfile();
  }, [user]);

  const checkAdminStatus = async () => {
    const { data } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    setIsAdmin(!!data);
  };

  const loadUserProfile = async () => {
    const { data } = await (supabase as any).from("profiles").select("display_name").eq("id", user.id).maybeSingle();

    if ((data as any)?.display_name) {
      setDisplayName((data as any).display_name);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erreur lors de la déconnexion");
      return;
    }
    navigate("/");
    toast.success("Déconnexion réussie");
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.")) {
      return;
    }

    // Note: Account deletion would typically be handled by an edge function
    // for security reasons to properly clean up all user data
    toast.error("La suppression de compte nécessite une confirmation par email. Contactez l'administrateur.");
  };

  const getInitials = () => {
    if (displayName) {
      return displayName.substring(0, 2).toUpperCase();
    }
    return user.email?.substring(0, 2).toUpperCase() || "U";
  };

  const getThemeIcon = () => {
    switch (theme) {
      case "dark":
        return <Moon className="h-4 w-4 mr-2" />;
      case "light":
        return <Sun className="h-4 w-4 mr-2" />;
      default:
        return <Monitor className="h-4 w-4 mr-2" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar>
            <AvatarFallback className="bg-primary text-primary-foreground">{getInitials()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName || "Utilisateur"}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => navigate("/account")}>
          <UserIcon className="h-4 w-4 mr-2" />
          Mon Compte
        </DropdownMenuItem>

        {isAdmin && (
          <DropdownMenuItem onClick={() => navigate("/admin")}>
            <Shield className="h-4 w-4 mr-2" />
            Administration
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Sous-menu Evoliz */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Link2 className="h-4 w-4 mr-2" />
            Evoliz
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => navigate("/settings/evoliz")}>
              <Settings className="h-4 w-4 mr-2" />
              Configuration
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/evoliz/quotes")}>
              <FileText className="h-4 w-4 mr-2" />
              Devis
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/evoliz/clients")}>
              <Users className="h-4 w-4 mr-2" />
              Clients
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs text-muted-foreground">Thème</DropdownMenuLabel>

        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="h-4 w-4 mr-2" />
          Clair
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="h-4 w-4 mr-2" />
          Sombre
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="h-4 w-4 mr-2" />
          Système
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleDeleteAccount} className="text-destructive">
          <Settings className="h-4 w-4 mr-2" />
          Supprimer le compte
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
