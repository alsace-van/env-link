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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShoppingBag,
  Package,
  TrendingUp,
  Menu,
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
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Gauche : Menu projets + Logo */}
          <div className="flex items-center gap-4">
            <Sheet open={leftSidebarOpen} onOpenChange={setLeftSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                  <FolderOpen className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <div className="p-4 border-b">
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <FolderOpen className="h-5 w-5" />
                    Mes Projets
                  </h2>
                </div>
                <ScrollArea className="h-[calc(100vh-80px)]">
                  <div className="p-4">
                    <ProjectsList refresh={refreshKey} onProjectSelect={handleProjectSelect} />
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <img
              src={logo}
              alt="Alsace Van Création"
              className="h-16 md:h-20 w-auto object-contain cursor-pointer"
              onClick={() => navigate("/dashboard")}
            />
          </div>

          {/* Centre : Titre (mobile) */}
          <h1 className="text-lg font-semibold md:hidden">VPB</h1>

          {/* Droite : Actions */}
          <div className="flex items-center gap-2">
            {/* Boutons visibles sur desktop */}
            <div className="hidden md:flex items-center gap-2">
              <BackupSettingsDialog userId={user?.id} />
              <WishlistWidget />
              <AIUsageWidget />
            </div>

            {/* Menu outils (sidebar droite) */}
            <Sheet open={rightSidebarOpen} onOpenChange={setRightSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <LayoutGrid className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <div className="p-4 border-b">
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5" />
                    Outils & Navigation
                  </h2>
                </div>
                <ScrollArea className="h-[calc(100vh-80px)]">
                  <div className="p-4 space-y-2">
                    {/* Section Navigation */}
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Navigation
                    </p>

                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12"
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
                      className="w-full justify-start gap-3 h-12"
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
                      className="w-full justify-start gap-3 h-12"
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
                      className="w-full justify-start gap-3 h-12"
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

                    {/* Section Outils */}
                    <div className="pt-4 border-t mt-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Outils</p>

                      <div className="space-y-2">
                        <div className="md:hidden">
                          <WishlistWidget variant="ghost" size="default" />
                        </div>
                        <div className="md:hidden">
                          <BackupSettingsDialog userId={user?.id} />
                        </div>
                      </div>
                    </div>

                    {/* Section Compte */}
                    <div className="pt-4 border-t mt-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Compte</p>

                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 h-12"
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
              </SheetContent>
            </Sheet>

            {user && (
              <>
                <AdminMessagesNotification />
                <UserMenu user={user} />
              </>
            )}
          </div>
        </div>
      </header>

      {/* Layout principal avec sidebars */}
      <div className="flex">
        {/* Sidebar gauche - Projets (desktop) */}
        <aside className="hidden lg:block w-80 border-r bg-card/30 min-h-[calc(100vh-73px)] sticky top-[73px]">
          <div className="p-4 border-b bg-muted/30">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Mes Projets
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Sélectionnez un projet</p>
          </div>
          <ScrollArea className="h-[calc(100vh-150px)]">
            <div className="p-4">
              <ProjectsList refresh={refreshKey} onProjectSelect={handleProjectSelect} />
            </div>
          </ScrollArea>
        </aside>

        {/* Contenu principal */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Nouveau Projet</h2>
              <p className="text-muted-foreground">Créez un nouveau projet d'aménagement de véhicule</p>
            </div>
            <ProjectForm onProjectCreated={handleProjectCreated} />
          </div>
        </main>

        {/* Sidebar droite - Navigation rapide (desktop) */}
        <aside className="hidden xl:block w-64 border-l bg-card/30 min-h-[calc(100vh-73px)] sticky top-[73px]">
          <div className="p-4 border-b bg-muted/30">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" />
              Accès rapide
            </h2>
          </div>
          <div className="p-4 space-y-2">
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => navigate("/catalog")}>
              <Package className="h-4 w-4 text-blue-500" />
              Catalogue
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => navigate("/shop")}>
              <ShoppingBag className="h-4 w-4 text-green-500" />
              Boutique
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => navigate("/bilan-comptable")}>
              <TrendingUp className="h-4 w-4 text-purple-500" />
              Bilan Comptable
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => navigate("/downloads")}>
              <Download className="h-4 w-4 text-orange-500" />
              Téléchargements
            </Button>

            <div className="pt-4 border-t mt-4">
              <WishlistWidget variant="outline" size="sm" />
            </div>
          </div>
        </aside>
      </div>

      {/* Chatbot IA flottant */}
      <AIChatAssistant />
    </div>
  );
};

export default Dashboard;
