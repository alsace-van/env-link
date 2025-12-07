import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import ProjectsList from "@/components/ProjectsList";
import ProjectForm from "@/components/ProjectForm";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import UserMenu from "@/components/UserMenu";
import WishlistWidget from "@/components/WishlistWidget";

const Dashboard = () => {
  const navigate = useNavigate();
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [refreshProjects, setRefreshProjects] = useState(0);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    } else {
      setUser(session.user);
    }
  };

  const handleProjectCreated = () => {
    setShowProjectForm(false);
    setRefreshProjects(prev => prev + 1);
  };

  const handleProjectSelect = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
          <div className="flex items-center gap-2">
            <WishlistWidget />
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Mes projets</h2>
          <Button onClick={() => setShowProjectForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau projet
          </Button>
        </div>

        {showProjectForm && (
          <div className="mb-6">
            <ProjectForm onProjectCreated={handleProjectCreated} />
          </div>
        )}

        <ProjectsList 
          refresh={refreshProjects}
          onProjectSelect={handleProjectSelect}
        />
      </main>
    </div>
  );
};

export default Dashboard;
