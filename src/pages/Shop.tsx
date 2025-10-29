import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ShoppingCart, Package } from "lucide-react";
import UserMenu from "@/components/UserMenu";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";

const Shop = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }
      
      setUser(user);
    };

    loadUser();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <img 
              src={logo} 
              alt="Alsace Van Création" 
              className="h-20 w-auto object-contain"
            />
            <div className="flex-1">
              <h1 className="text-xl font-bold">Boutique</h1>
              <p className="text-sm text-muted-foreground">
                Accessoires et équipements pour votre van
              </p>
            </div>
            {user && (
              <div className="flex items-center gap-2">
                <UserMenu user={user} />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-primary/10 p-6">
                  <ShoppingCart className="h-12 w-12 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl">Boutique en ligne</CardTitle>
              <CardDescription>
                Découvrez notre sélection d'accessoires et équipements pour aménager votre véhicule
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <Package className="h-8 w-8 text-primary flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold mb-2">Catalogue complet</h3>
                        <p className="text-sm text-muted-foreground">
                          Accédez à tous nos accessoires depuis le catalogue du projet
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <ShoppingCart className="h-8 w-8 text-primary flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold mb-2">Commande facilitée</h3>
                        <p className="text-sm text-muted-foreground">
                          Sélectionnez vos produits directement depuis vos projets
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-muted/50 rounded-lg p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  La boutique en ligne est en cours de développement
                </p>
                <p className="text-sm text-muted-foreground">
                  Pour le moment, vous pouvez parcourir notre catalogue d'accessoires dans vos projets
                </p>
              </div>

              <div className="flex justify-center">
                <Button onClick={() => navigate("/catalog")} size="lg">
                  <Package className="h-4 w-4 mr-2" />
                  Voir le catalogue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Shop;
