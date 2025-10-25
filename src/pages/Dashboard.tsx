import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import ProjectsList from "@/components/ProjectsList";
import ProjectForm from "@/components/ProjectForm";

const Dashboard = () => {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
    } else {
      setUser(session.user);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleProjectCreated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleProjectSelect = (projectId: string) => {
    // TODO: Navigate to project detail page
    console.log("Selected project:", projectId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Suivi Aménagement Fourgon
            </h1>
            <p className="text-sm text-muted-foreground">
              Gérez vos projets d'aménagement
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-1">Mes Projets</h2>
              <p className="text-sm text-muted-foreground">
                Sélectionnez un projet pour voir les détails
              </p>
            </div>
            <ProjectsList refresh={refreshKey} onProjectSelect={handleProjectSelect} />
          </div>

          <div className="lg:col-span-1">
            <ProjectForm onProjectCreated={handleProjectCreated} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
