import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ProjectsList from "@/components/ProjectsList";
import ProjectForm from "@/components/ProjectForm";
import UserMenu from "@/components/UserMenu";
import logo from "@/assets/logo.png";

const Dashboard = () => {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
    trackLogin();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const trackLogin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      // Track login
      await supabase.from("user_logins").insert({
        user_id: session.user.id,
        ip_address: null, // Would need additional setup to get IP
        user_agent: navigator.userAgent,
      });
    }
  };

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
    navigate(`/project/${projectId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src={logo} 
              alt="Alsace Van Création" 
              className="h-24 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            {user && <UserMenu user={user} />}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-1">Mes Projets</h2>
              <p className="text-sm text-muted-foreground">
                Sélectionnez un projet pour voir les détails
              </p>
            </div>
            <ProjectsList refresh={refreshKey} onProjectSelect={handleProjectSelect} />
          </div>

          <div className="lg:col-span-5">
            <ProjectForm onProjectCreated={handleProjectCreated} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
