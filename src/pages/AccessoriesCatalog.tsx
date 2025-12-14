import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AccessoriesCatalogView from "@/components/AccessoriesCatalogView";
import SuppliersManager from "@/components/catalog/SuppliersManager";
import UserMenu from "@/components/UserMenu";
import { AdminMessagesNotification } from "@/components/AdminMessagesNotification";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Package, Store } from "lucide-react";
import logo from "@/assets/logo.png";

const AccessoriesCatalog = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("accessories");

  useEffect(() => {
    checkUser();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Alsace Van Création" className="h-24 w-auto object-contain" />
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au dashboard
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <>
                <AdminMessagesNotification />
                <UserMenu user={user} />
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Catalogue</h1>
          <p className="text-muted-foreground">Gérez vos accessoires et fournisseurs</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="accessories" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Accessoires
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Fournisseurs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accessories">
            <AccessoriesCatalogView />
          </TabsContent>

          <TabsContent value="suppliers">
            <SuppliersManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AccessoriesCatalog;
