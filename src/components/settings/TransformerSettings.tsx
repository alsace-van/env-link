// ============================================
// TransformerSettings.tsx
// Paramètres de l'entreprise du professionnel
// Accessible via Settings > Mon entreprise
// + Taux horaire pour calcul forfaits
// ============================================

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, User, MapPin, Phone, Save, Loader2, Clock, Calculator } from "lucide-react";

interface TransformerSettingsData {
  id?: string;
  company_name: string;
  legal_form: string;
  siret: string;
  address: string;
  postal_code: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  owner_civility: string;
  owner_first_name: string;
  owner_last_name: string;
  owner_title: string;
  default_location: string;
  default_motif: string;
  ape_code: string;
  certification_number: string;
  // Nouveau : taux horaire
  hourly_rate_ttc: number;
}

const EMPTY_SETTINGS: TransformerSettingsData = {
  company_name: "",
  legal_form: "SASU",
  siret: "",
  address: "",
  postal_code: "",
  city: "",
  phone: "",
  email: "",
  website: "",
  owner_civility: "M.",
  owner_first_name: "",
  owner_last_name: "",
  owner_title: "Gérant",
  default_location: "",
  default_motif: "Transformation VASP Caravane",
  ape_code: "",
  certification_number: "",
  hourly_rate_ttc: 60,
};

const LEGAL_FORMS = [
  { value: "SASU", label: "SASU" },
  { value: "SAS", label: "SAS" },
  { value: "SARL", label: "SARL" },
  { value: "EURL", label: "EURL" },
  { value: "EI", label: "Entreprise Individuelle" },
  { value: "AE", label: "Auto-entrepreneur" },
  { value: "SA", label: "SA" },
];

const OWNER_TITLES = [
  "Gérant",
  "Président",
  "Directeur",
  "Responsable technique",
  "Artisan",
];

export default function TransformerSettings() {
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<TransformerSettingsData>(EMPTY_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        loadSettings(user.id);
      }
    };
    fetchUser();
  }, []);

  const loadSettings = async (uid: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from("transformer_settings")
        .select("*")
        .eq("user_id", uid)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setSettings({
          ...EMPTY_SETTINGS,
          ...data,
          hourly_rate_ttc: data.hourly_rate_ttc || 60,
        });
      }
    } catch (error) {
      console.error("Erreur chargement paramètres:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof TransformerSettingsData, value: string | number) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!userId) return;

    setIsSaving(true);
    try {
      const dataToSave = {
        ...settings,
        user_id: userId,
      };

      if (settings.id) {
        // Update
        const { error } = await (supabase as any)
          .from("transformer_settings")
          .update(dataToSave)
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        // Insert
        const { data, error } = await (supabase as any)
          .from("transformer_settings")
          .insert(dataToSave)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setSettings(data as TransformerSettingsData);
        }
      }

      toast.success("Paramètres enregistrés !");
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  // Formatage SIRET (14 chiffres avec espaces)
  const formatSiret = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4").trim();
  };

  // Calcul exemples tarifs
  const hourlyHT = settings.hourly_rate_ttc / 1.2;
  const halfDayTTC = settings.hourly_rate_ttc * 3.5;
  const dayTTC = settings.hourly_rate_ttc * 7;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Mon entreprise</h2>
        <p className="text-muted-foreground">
          Ces informations seront utilisées pour pré-remplir les documents DREAL
        </p>
      </div>

      {/* Tarification - NOUVEAU */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Tarification main d'œuvre
          </CardTitle>
          <CardDescription>
            Taux horaire interne pour calculer vos forfaits (non visible par le client)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="hourly_rate_ttc" className="text-base font-medium">
                Taux horaire TTC
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="hourly_rate_ttc"
                  type="number"
                  min="0"
                  step="5"
                  value={settings.hourly_rate_ttc}
                  onChange={(e) => handleChange("hourly_rate_ttc", parseFloat(e.target.value) || 0)}
                  className="w-32 text-lg font-semibold"
                />
                <span className="text-lg">€ TTC/h</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Soit {hourlyHT.toFixed(2)} € HT/h
              </p>
            </div>

            <div className="space-y-3 bg-white/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calculator className="h-4 w-4" />
                Équivalences
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span>Demi-journée (3.5h)</span>
                  <span className="font-medium">{halfDayTTC.toFixed(0)} € TTC</span>
                </div>
                <div className="flex justify-between">
                  <span>Journée (7h)</span>
                  <span className="font-medium">{dayTTC.toFixed(0)} € TTC</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-3">
            💡 <strong>Usage :</strong> Ce taux est utilisé pour calculer automatiquement 
            le forfait suggéré quand vous estimez le temps d'une tâche. 
            Seul le forfait apparaît sur le devis client, jamais les heures.
          </div>
        </CardContent>
      </Card>

      {/* Identité entreprise */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Identité de l'entreprise
          </CardTitle>
          <CardDescription>
            Raison sociale et informations légales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Raison sociale *</Label>
              <Input
                id="company_name"
                value={settings.company_name}
                onChange={(e) => handleChange("company_name", e.target.value)}
                placeholder="ALSACE VAN CREATION"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="legal_form">Forme juridique</Label>
              <Select
                value={settings.legal_form}
                onValueChange={(value) => handleChange("legal_form", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEGAL_FORMS.map((form) => (
                    <SelectItem key={form.value} value={form.value}>
                      {form.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="siret">SIRET</Label>
              <Input
                id="siret"
                value={settings.siret}
                onChange={(e) => handleChange("siret", formatSiret(e.target.value))}
                placeholder="123 456 789 00012"
                maxLength={17}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ape_code">Code APE/NAF</Label>
              <Input
                id="ape_code"
                value={settings.ape_code}
                onChange={(e) => handleChange("ape_code", e.target.value.toUpperCase())}
                placeholder="29.20Z"
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">
                29.20Z permet de certifier EN1949/EN721 vous-même
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adresse */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Adresse
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              value={settings.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="123 rue de l'Industrie"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postal_code">Code postal</Label>
              <Input
                id="postal_code"
                value={settings.postal_code}
                onChange={(e) => handleChange("postal_code", e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="68800"
                maxLength={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Ville</Label>
              <Input
                id="city"
                value={settings.city}
                onChange={(e) => handleChange("city", e.target.value)}
                placeholder="THANN"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_location">Lieu par défaut (pour "Fait à")</Label>
            <Input
              id="default_location"
              value={settings.default_location}
              onChange={(e) => handleChange("default_location", e.target.value)}
              placeholder="Thann"
            />
            <p className="text-xs text-muted-foreground">
              Utilisé pour pré-remplir "Fait à" dans les documents
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={settings.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="06 12 34 56 78"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="contact@example.fr"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="website">Site web</Label>
              <Input
                id="website"
                value={settings.website}
                onChange={(e) => handleChange("website", e.target.value)}
                placeholder="https://www.example.fr"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Responsable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Responsable / Signataire
          </CardTitle>
          <CardDescription>
            Personne qui signera les documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="owner_civility">Civilité</Label>
              <Select
                value={settings.owner_civility}
                onValueChange={(value) => handleChange("owner_civility", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M.">M.</SelectItem>
                  <SelectItem value="Mme">Mme</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner_first_name">Prénom</Label>
              <Input
                id="owner_first_name"
                value={settings.owner_first_name}
                onChange={(e) => handleChange("owner_first_name", e.target.value)}
                placeholder="Stéphane"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner_last_name">Nom</Label>
              <Input
                id="owner_last_name"
                value={settings.owner_last_name}
                onChange={(e) => handleChange("owner_last_name", e.target.value)}
                placeholder="DUPONT"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner_title">Fonction</Label>
            <Select
              value={settings.owner_title}
              onValueChange={(value) => handleChange("owner_title", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OWNER_TITLES.map((title) => (
                  <SelectItem key={title} value={title}>
                    {title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bouton sauvegarder */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
