import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import ProjectsList from "@/components/ProjectsList";
import ProjectForm from "@/components/ProjectForm";
import UserMenu from "@/components/UserMenu";
import { AdminMessagesNotification } from "@/components/AdminMessagesNotification";
import { AIUsageWidget } from "@/components/AIUsageWidget";
import { BackupSettingsDialog } from "@/components/BackupSettingsDialog";
import AIChatAssistant from "@/components/AIChatAssistant";
import WishlistWidget from "@/components/WishlistWidget";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShoppingBag,
  Package,
  TrendingUp,
  LayoutGrid,
  FolderOpen,
  Settings,
  Download,
  ChevronRight,
  X,
} from "lucide-react";
import logo from "@/assets/logo.png";

const Dashboard = () => {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  useEffect(() => {
    checkUser();
    trackLogin();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const trackLogin = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      await supabase.from("user_logins").insert({
        user_id: session.user.id,
        user_email: session.user.email || "",
        ip_address: null,
        user_agent: navigator.userAgent,
      });
    }
  };

  const checkUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/auth");
    } else {
      setUser(session.user);
    }
  };

  const handleProjectCreated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleProjectSelect = (projectId: string) => {
    navigate(`/project/${projectId}`);
    setLeftSidebarOpen(false);
  };

  const closeSidebars = () => {
    setLeftSidebarOpen(false);
    setRightSidebarOpen(false);
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Gauche : Menu projets + Logo */}
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setLeftSidebarOpen(true)}>
              <FolderOpen className="h-5 w-5" />
            </Button>

            <img
              src={logo}
              alt="Alsace Van Création"
              className="h-16 md:h-20 w-auto object-contain cursor-pointer"
              onClick={() => navigate("/dashboard")}
            />
          </div>

          {/* Droite : Actions (sans Wishlist, elle est dans la sidebar) */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <BackupSettingsDialog userId={user?.id} />
              <AIUsageWidget />
            </div>

            {/* Menu outils (sidebar droite) */}
            <Button variant="outline" size="icon" onClick={() => setRightSidebarOpen(true)}>
              <LayoutGrid className="h-5 w-5" />
            </Button>

            {user && (
              <>
                <AdminMessagesNotification />
                <UserMenu user={user} />
              </>
            )}
          </div>
        </div>
      </header>

      {/* Backdrop overlay */}
      {(leftSidebarOpen || rightSidebarOpen) && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity" onClick={closeSidebars} />
      )}

      {/* Sidebar gauche - Projets (Overlay transparent) */}
      <aside
        className={`fixed top-0 left-0 h-full w-96 z-50 transform transition-transform duration-300 ease-in-out ${
          leftSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-r shadow-2xl">
          <div className="p-4 border-b bg-white/50 dark:bg-gray-900/50 flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              Mes Projets
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setLeftSidebarOpen(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="h-[calc(100vh-73px)]">
            <div className="p-4">
              <ProjectsList refresh={refreshKey} onProjectSelect={handleProjectSelect} />
            </div>
          </ScrollArea>
        </div>
      </aside>

      {/* Sidebar droite - Outils (Overlay transparent) */}
      <aside
        className={`fixed top-0 right-0 h-full w-72 z-50 transform transition-transform duration-300 ease-in-out ${
          rightSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-l shadow-2xl">
          <div className="p-4 border-b bg-white/50 dark:bg-gray-900/50 flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-primary" />
              Outils & Navigation
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setRightSidebarOpen(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="h-[calc(100vh-73px)]">
            <div className="p-4 space-y-2">
              {/* Section Navigation */}
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Navigation</p>

              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 hover:bg-white/50 dark:hover:bg-gray-800/50"
                onClick={() => {
                  navigate("/catalog");
                  setRightSidebarOpen(false);
                }}
              >
                <Package className="h-5 w-5 text-blue-500" />
                <div className="text-left">
                  <p className="font-medium">Catalogue</p>
                  <p className="text-xs text-muted-foreground">Accessoires & pièces</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 hover:bg-white/50 dark:hover:bg-gray-800/50"
                onClick={() => {
                  navigate("/shop");
                  setRightSidebarOpen(false);
                }}
              >
                <ShoppingBag className="h-5 w-5 text-green-500" />
                <div className="text-left">
                  <p className="font-medium">Boutique</p>
                  <p className="text-xs text-muted-foreground">Kits & produits</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 hover:bg-white/50 dark:hover:bg-gray-800/50"
                onClick={() => {
                  navigate("/bilan-comptable");
                  setRightSidebarOpen(false);
                }}
              >
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <div className="text-left">
                  <p className="font-medium">Bilan Comptable</p>
                  <p className="text-xs text-muted-foreground">Finances & stats</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 hover:bg-white/50 dark:hover:bg-gray-800/50"
                onClick={() => {
                  navigate("/downloads");
                  setRightSidebarOpen(false);
                }}
              >
                <Download className="h-5 w-5 text-orange-500" />
                <div className="text-left">
                  <p className="font-medium">Téléchargements</p>
                  <p className="text-xs text-muted-foreground">Fichiers & docs</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>

              {/* Section Outils - WISHLIST ICI UNIQUEMENT */}
              <div className="pt-4 border-t mt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Outils</p>

                <div className="space-y-2">
                  <WishlistWidget variant="ghost" size="default" />
                  <BackupSettingsDialog userId={user?.id} />
                  <AIUsageWidget />
                </div>
              </div>

              {/* Section Compte */}
              <div className="pt-4 border-t mt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Compte</p>

                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-12 hover:bg-white/50 dark:hover:bg-gray-800/50"
                  onClick={() => {
                    navigate("/account");
                    setRightSidebarOpen(false);
                  }}
                >
                  <Settings className="h-5 w-5 text-gray-500" />
                  <div className="text-left">
                    <p className="font-medium">Paramètres</p>
                    <p className="text-xs text-muted-foreground">Profil & préférences</p>
                  </div>
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </aside>

      {/* Contenu principal */}
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Nouveau Projet</h2>
            <p className="text-muted-foreground">Créez un nouveau projet d'aménagement de véhicule</p>
          </div>
          <ProjectForm onProjectCreated={handleProjectCreated} />
        </div>
      </main>

      {/* Chatbot IA flottant */}
      <AIChatAssistant />
    </div>
  );
};

export default Dashboard;
