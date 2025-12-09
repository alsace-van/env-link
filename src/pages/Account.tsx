import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  Building2,
  CreditCard,
  Bot,
  Shield,
  Save,
  Upload,
  Loader2,
  Check,
  Crown,
  Calendar,
  Mail,
  Phone,
  MapPin,
  FileText,
  LogOut,
  KeyRound,
} from "lucide-react";
import logo from "@/assets/logo.png";
import UserAISettings from "@/components/UserAISettings";
import { UploadTokenManager } from "@/components/UploadTokenManager";

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url: string;
  company_name: string;
  company_siret: string;
  company_address: string;
  company_city: string;
  company_postal_code: string;
  company_country: string;
  subscription_type: "free" | "pro" | "enterprise";
  subscription_start_date: string;
  subscription_end_date: string;
  created_at: string;
  updated_at: string;
}

const Account = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  // États pour le changement de mot de passe
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/");
        return;
      }

      setUser(user);

      // Charger le profil
      const { data: profileData, error } = await (supabase as any)
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Erreur chargement profil:", error);
      }

      if (profileData) {
        setProfile(profileData);
      } else {
        // Initialiser avec des valeurs par défaut
        setProfile({
          user_id: user.id,
          first_name: "",
          last_name: "",
          phone: "",
          avatar_url: "",
          company_name: "",
          company_siret: "",
          company_address: "",
          company_city: "",
          company_postal_code: "",
          company_country: "France",
          subscription_type: "free",
        });
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      // Vérifier si un profil existe
      const { data: existing } = await (supabase as any)
        .from("user_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (existing) {
        // Mettre à jour
        const { error } = await (supabase as any)
          .from("user_profiles")
          .update({
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone,
            avatar_url: profile.avatar_url,
          })
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Créer
        const { error } = await (supabase as any).from("user_profiles").insert({
          user_id: user.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          avatar_url: profile.avatar_url,
          subscription_type: "free",
        });

        if (error) throw error;
      }

      toast.success("Profil mis à jour !");
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(`Erreur: ${error.message || "Impossible de sauvegarder"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCompany = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      const { data: existing } = await (supabase as any)
        .from("user_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      const companyData = {
        company_name: profile.company_name,
        company_siret: profile.company_siret,
        company_address: profile.company_address,
        company_city: profile.company_city,
        company_postal_code: profile.company_postal_code,
        company_country: profile.company_country,
      };

      if (existing) {
        const { error } = await (supabase as any).from("user_profiles").update(companyData).eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("user_profiles").insert({
          user_id: user.id,
          ...companyData,
          subscription_type: "free",
        });

        if (error) throw error;
      }

      toast.success("Informations entreprise mises à jour !");
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(`Erreur: ${error.message || "Impossible de sauvegarder"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      setProfile({ ...profile, avatar_url: publicUrl });

      // Sauvegarder immédiatement
      await (supabase as any).from("user_profiles").upsert(
        {
          user_id: user.id,
          avatar_url: publicUrl,
        },
        { onConflict: "user_id" },
      );

      toast.success("Photo de profil mise à jour !");
    } catch (error) {
      console.error("Erreur upload:", error);
      toast.error("Erreur lors de l'upload");
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Mot de passe modifié !");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Erreur changement mot de passe:", error);
      toast.error(`Erreur: ${error.message || "Impossible de changer le mot de passe"}`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getInitials = () => {
    const first = profile.first_name?.charAt(0) || "";
    const last = profile.last_name?.charAt(0) || "";
    if (first || last) return (first + last).toUpperCase();
    return user?.email?.charAt(0).toUpperCase() || "?";
  };

  const getSubscriptionBadge = () => {
    switch (profile.subscription_type) {
      case "pro":
        return (
          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
            <Crown className="h-3 w-3 mr-1" /> Pro
          </Badge>
        );
      case "enterprise":
        return (
          <Badge className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
            <Crown className="h-3 w-3 mr-1" /> Entreprise
          </Badge>
        );
      default:
        return <Badge variant="secondary">Gratuit</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <img src={logo} alt="Van Project Buddy" className="h-12 w-auto object-contain" />
          </div>
        </div>
      </header>

      <div className="container max-w-5xl mx-auto py-8 px-4">
        {/* En-tête du compte */}
        <div className="flex items-center gap-6 mb-8">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              <AvatarImage src={profile.avatar_url} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{getInitials()}</AvatarFallback>
            </Avatar>
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <Upload className="h-6 w-6 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </label>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">
                {profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : "Mon Compte"}
              </h1>
              {getSubscriptionBadge()}
            </div>
            <p className="text-muted-foreground">{user.email}</p>
            {profile.company_name && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Building2 className="h-3 w-3" />
                {profile.company_name}
              </p>
            )}
          </div>
        </div>

        {/* Onglets */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full mb-6">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profil</span>
            </TabsTrigger>
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Entreprise</span>
            </TabsTrigger>
            <TabsTrigger value="subscription" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Abonnement</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">IA</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Sécurité</span>
            </TabsTrigger>
          </TabsList>

          {/* Onglet Profil */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informations personnelles</CardTitle>
                <CardDescription>Vos informations de contact et d'identification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input
                      id="firstName"
                      value={profile.first_name || ""}
                      onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                      placeholder="Votre prénom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom</Label>
                    <Input
                      id="lastName"
                      value={profile.last_name || ""}
                      onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                      placeholder="Votre nom"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" value={user.email} disabled className="bg-muted pl-10" />
                  </div>
                  <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={profile.phone || ""}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="06 12 34 56 78"
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Enregistrer
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informations du compte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Date de création</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Dernière connexion</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(user.last_sign_in_at).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Entreprise */}
          <TabsContent value="company" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informations de l'entreprise</CardTitle>
                <CardDescription>Ces informations apparaîtront sur vos documents et factures</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Nom de l'entreprise</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="companyName"
                        value={profile.company_name || ""}
                        onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                        placeholder="Ma Société SARL"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="siret">SIRET</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="siret"
                        value={profile.company_siret || ""}
                        onChange={(e) => setProfile({ ...profile, company_siret: e.target.value })}
                        placeholder="123 456 789 00012"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address"
                      value={profile.company_address || ""}
                      onChange={(e) => setProfile({ ...profile, company_address: e.target.value })}
                      placeholder="123 rue de l'exemple"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Code postal</Label>
                    <Input
                      id="postalCode"
                      value={profile.company_postal_code || ""}
                      onChange={(e) => setProfile({ ...profile, company_postal_code: e.target.value })}
                      placeholder="67000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      id="city"
                      value={profile.company_city || ""}
                      onChange={(e) => setProfile({ ...profile, company_city: e.target.value })}
                      placeholder="Strasbourg"
                    />
                  </div>
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <Label htmlFor="country">Pays</Label>
                    <Input
                      id="country"
                      value={profile.company_country || "France"}
                      onChange={(e) => setProfile({ ...profile, company_country: e.target.value })}
                      placeholder="France"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveCompany} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Enregistrer
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Abonnement */}
          <TabsContent value="subscription" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Votre abonnement
                  {getSubscriptionBadge()}
                </CardTitle>
                <CardDescription>Gérez votre forfait et vos options de facturation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Forfait actuel */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">
                        Forfait{" "}
                        {profile.subscription_type === "pro"
                          ? "Pro"
                          : profile.subscription_type === "enterprise"
                            ? "Entreprise"
                            : "Gratuit"}
                      </h3>
                      {profile.subscription_end_date && (
                        <p className="text-sm text-muted-foreground">
                          Renouvellement le {new Date(profile.subscription_end_date).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </div>
                    {profile.subscription_type === "free" && (
                      <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                        <Crown className="h-4 w-4 mr-2" />
                        Passer Pro
                      </Button>
                    )}
                  </div>

                  {/* Features du forfait actuel */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {profile.subscription_type === "free" ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>3 projets maximum</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>10 clients maximum</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>20 photos par projet</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>1 gamme de montage</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Projets illimités</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Clients illimités</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Photos illimitées</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Scan carte grise IA</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Transcription audio IA</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Export RTI automatique</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Gammes illimitées</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Support prioritaire</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Message informatif */}
                <div className="text-sm text-muted-foreground">
                  <p>
                    Les fonctionnalités IA (scan carte grise, transcription audio, résumé PDF) nécessitent vos propres
                    clés API. Configurez-les dans l'onglet "IA".
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Historique de facturation - placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>Historique de facturation</CardTitle>
                <CardDescription>Vos factures et paiements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Aucune facture pour le moment</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet IA */}
          <TabsContent value="ai">
            <UserAISettings />
          </TabsContent>

          {/* Onglet Sécurité */}
          <TabsContent value="security" className="space-y-6">
            {/* Tokens d'upload pour raccourci macOS */}
            <UploadTokenManager />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  Changer le mot de passe
                </CardTitle>
                <CardDescription>
                  Mettez à jour votre mot de passe régulièrement pour sécuriser votre compte
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !newPassword || !confirmPassword}
                >
                  {isChangingPassword ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4 mr-2" />
                  )}
                  Changer le mot de passe
                </Button>
              </CardContent>
            </Card>

            <Card className="border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="text-red-600">Zone de danger</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Déconnexion</p>
                    <p className="text-sm text-muted-foreground">Se déconnecter de votre compte sur cet appareil</p>
                  </div>
                  <Button variant="outline" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Se déconnecter
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Account;
