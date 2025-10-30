import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Truck, Eye, EyeOff, ShoppingBag, ArrowRight } from "lucide-react";

const AuthPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [shopConfig, setShopConfig] = useState({
    title: "Boutique en ligne",
    description: "Découvrez notre catalogue de produits et accessoires pour l'aménagement de votre fourgon",
    button_text: "Accéder à la boutique",
    image_url: null as string | null,
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadShopConfig();
  }, []);

  const loadShopConfig = async () => {
    // Charger la configuration publique (premier utilisateur trouvé)
    const { data } = await supabase
      .from("shop_welcome_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (data) {
      setShopConfig({
        title: data.title,
        description: data.description,
        button_text: data.button_text,
        image_url: data.image_url,
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("signup-email") as string;
    const password = formData.get("signup-password") as string;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Compte créé avec succès !");
      navigate("/");
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("signin-email") as string;
    const password = formData.get("signin-password") as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Connexion réussie !");
      navigate("/");
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      toast.error("Veuillez entrer votre adresse email");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });

    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Email de réinitialisation envoyé !");
      setResetDialogOpen(false);
      setResetEmail("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-6 items-stretch">
        {/* Encart Boutique - Gauche */}
        <Card 
          className="relative overflow-hidden cursor-pointer group shadow-2xl hover:shadow-3xl transition-all duration-300 flex flex-col"
          onClick={() => navigate("/shop")}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 group-hover:from-primary/30 group-hover:via-primary/20 group-hover:to-primary/10 transition-all duration-300" />
          
          <CardContent className="relative flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
            {shopConfig.image_url ? (
              <div className="w-full h-48 rounded-xl overflow-hidden group-hover:scale-105 transition-transform duration-300">
                <img 
                  src={shopConfig.image_url} 
                  alt="Boutique" 
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="bg-primary/10 p-6 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                <ShoppingBag className="h-16 w-16 text-primary" />
              </div>
            )}
            
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tight">
                {shopConfig.title}
              </h2>
              <p className="text-muted-foreground text-lg max-w-md">
                {shopConfig.description}
              </p>
            </div>

            <Button 
              size="lg" 
              className="mt-4 group-hover:scale-105 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/shop");
              }}
            >
              {shopConfig.button_text}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <p className="text-sm text-muted-foreground">
              Aucun compte nécessaire pour consulter
            </p>
          </CardContent>
        </Card>

        {/* Fenêtre de connexion - Droite */}
        <Card className="w-full shadow-2xl flex flex-col">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-primary p-3 rounded-xl">
                <Truck className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Tableau de bord</CardTitle>
            <CardDescription>
              Connectez-vous pour gérer vos projets
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="signin-email"
                      type="email"
                      placeholder="votre@email.com"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        name="signin-password"
                        type={showSignInPassword ? "text" : "password"}
                        placeholder="••••••••"
                        required
                        disabled={isLoading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowSignInPassword(!showSignInPassword)}
                      >
                        {showSignInPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="link" className="px-0 text-sm">
                          Mot de passe oublié ?
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
                          <DialogDescription>
                            Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="reset-email">Email</Label>
                            <Input
                              id="reset-email"
                              type="email"
                              placeholder="votre@email.com"
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                              disabled={isLoading}
                            />
                          </div>
                          <Button
                            onClick={handleResetPassword}
                            className="w-full"
                            disabled={isLoading}
                          >
                            {isLoading ? "Envoi..." : "Envoyer le lien"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Connexion..." : "Se connecter"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="signup-email"
                      type="email"
                      placeholder="votre@email.com"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        name="signup-password"
                        type={showSignUpPassword ? "text" : "password"}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        disabled={isLoading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                      >
                        {showSignUpPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Création..." : "Créer un compte"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
