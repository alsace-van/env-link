// ============================================
// PAGE CONFIGURATION EVOLIZ - VERSION AMÉLIORÉE
// Statut visible, actions claires, bouton retour
// ============================================

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEvolizConfig } from "@/hooks/useEvolizConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff,
  HelpCircle,
  ArrowLeft,
  Home,
} from "lucide-react";

export default function EvolizSettingsPage() {
  const navigate = useNavigate();

  const {
    credentials,
    isLoading,
    isConfigured,
    isTesting,
    testResult,
    saveCredentials,
    testConnection,
    deleteCredentials,
  } = useEvolizConfig();

  const [companyId, setCompanyId] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Charger les credentials existants
  useEffect(() => {
    if (credentials) {
      setCompanyId(credentials.company_id);
      setPublicKey(credentials.public_key);
      setSecretKey("");
    }
  }, [credentials]);

  const handleSave = async () => {
    setSaveError(null);

    if (!companyId.trim()) {
      setSaveError("Le Company ID est requis");
      return;
    }
    if (!publicKey.trim()) {
      setSaveError("La Public Key est requise");
      return;
    }
    if (!secretKey.trim() && !credentials) {
      setSaveError("La Secret Key est requise");
      return;
    }

    setIsSaving(true);
    try {
      const success = await saveCredentials({
        company_id: companyId.trim(),
        public_key: publicKey.trim(),
        secret_key: secretKey.trim() || credentials?.secret_key || "",
      });

      if (success) {
        // Tester automatiquement après sauvegarde
        await testConnection();
      } else {
        setSaveError("Erreur lors de la sauvegarde. Vérifiez vos informations.");
      }
    } catch (err) {
      setSaveError("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteCredentials();
    setCompanyId("");
    setPublicKey("");
    setSecretKey("");
    setShowDeleteDialog(false);
  };

  const handleTest = async () => {
    setSaveError(null);
    await testConnection();
  };

  // Déterminer le statut global
  const getConnectionStatus = () => {
    if (!isConfigured) {
      return { status: "not_configured", label: "Non configuré", color: "secondary", icon: WifiOff };
    }
    if (testResult?.success) {
      return { status: "connected", label: "Connecté", color: "default", icon: Wifi };
    }
    if (testResult?.success === false) {
      return { status: "error", label: "Erreur", color: "destructive", icon: XCircle };
    }
    return { status: "configured", label: "Configuré (non testé)", color: "outline", icon: AlertCircle };
  };

  const connectionStatus = getConnectionStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      {/* ====== BARRE DE NAVIGATION ====== */}
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
          <Home className="h-4 w-4" />
          Tableau de bord
        </Button>
      </div>

      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="h-8 w-8" />
          Configuration Evoliz
        </h1>
        <p className="text-muted-foreground mt-2">
          Connectez votre compte Evoliz pour synchroniser vos devis et clients.
        </p>
      </div>

      {/* ====== STATUT DE CONNEXION ====== */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <connectionStatus.icon
                className={`h-5 w-5 ${
                  connectionStatus.status === "connected"
                    ? "text-green-500"
                    : connectionStatus.status === "error"
                      ? "text-red-500"
                      : "text-muted-foreground"
                }`}
              />
              Statut de connexion
            </CardTitle>
            <Badge
              variant={connectionStatus.color as any}
              className={`text-sm px-3 py-1 ${
                connectionStatus.status === "connected"
                  ? "bg-green-500 text-white"
                  : connectionStatus.status === "error"
                    ? "bg-red-500 text-white"
                    : ""
              }`}
            >
              {connectionStatus.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isConfigured && credentials && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Company ID :</span> {credentials.company_id}
              </div>

              {credentials.last_test_at && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="font-medium">Dernier test :</span>
                  {new Date(credentials.last_test_at).toLocaleString("fr-FR")}
                  {credentials.last_test_success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              )}

              {/* Boutons d'action quand configuré */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={handleTest} disabled={isTesting}>
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Tester la connexion
                </Button>

                <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              </div>
            </div>
          )}

          {!isConfigured && (
            <p className="text-sm text-muted-foreground">
              Aucune configuration enregistrée. Remplissez le formulaire ci-dessous.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ====== RÉSULTAT DU TEST ====== */}
      {testResult && (
        <Alert
          variant={testResult.success ? "default" : "destructive"}
          className={`mb-6 ${testResult.success ? "border-green-500 bg-green-50 dark:bg-green-950" : ""}`}
        >
          {testResult.success ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4" />}
          <AlertTitle>{testResult.success ? "Connexion réussie !" : "Échec de connexion"}</AlertTitle>
          <AlertDescription>{testResult.message}</AlertDescription>
        </Alert>
      )}

      {/* ====== FORMULAIRE ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {isConfigured ? "Modifier les clés API" : "Saisir les clés API"}
          </CardTitle>
          <CardDescription>Récupérez vos clés depuis Evoliz → Applications → Evoliz API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Erreur de sauvegarde */}
          {saveError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          {/* Company ID */}
          <div className="space-y-2">
            <Label htmlFor="companyId" className="flex items-center gap-2">
              Company ID
              <span className="text-xs text-muted-foreground">(numéro avant le tiret dans ?)</span>
            </Label>
            <Input
              id="companyId"
              placeholder="Ex: 12345"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            />
          </div>

          {/* Public Key */}
          <div className="space-y-2">
            <Label htmlFor="publicKey">Public Key</Label>
            <Input
              id="publicKey"
              placeholder="Votre clé publique"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
            />
          </div>

          {/* Secret Key */}
          <div className="space-y-2">
            <Label htmlFor="secretKey">
              Secret Key
              {credentials && (
                <span className="text-muted-foreground font-normal ml-2">(laisser vide pour garder l'actuelle)</span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="secretKey"
                type={showSecretKey ? "text" : "password"}
                placeholder={credentials ? "••••••••••••••••" : "Votre clé secrète"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowSecretKey(!showSecretKey)}
              >
                {showSecretKey ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Bouton sauvegarder */}
          <Button
            onClick={handleSave}
            disabled={isSaving || !companyId || !publicKey || (!secretKey && !credentials)}
            className="w-full mt-4"
            size="lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Enregistrer et tester
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ====== AIDE ====== */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Comment trouver ces informations ?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-4">
          <div>
            <p className="font-medium mb-2">📍 Company ID :</p>
            <p className="text-muted-foreground">
              Dans Evoliz, cliquez sur le <strong>? (point d'interrogation)</strong> en haut à droite. Vous verrez un
              numéro comme "12345-XX". Le Company ID est la partie <strong>avant le tiret</strong> (12345).
            </p>
          </div>

          <Separator />

          <div>
            <p className="font-medium mb-2">🔑 Clés API :</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Connectez-vous à Evoliz</li>
              <li>
                Cliquez sur <strong>Applications</strong> (en haut à droite)
              </li>
              <li>
                Dans "Connecteurs disponibles", filtrez par tag <strong>API</strong>
              </li>
              <li>
                Activez <strong>Evoliz API</strong>
              </li>
              <li>
                Cliquez sur <strong>Créer une clé</strong>
              </li>
              <li>Copiez la Public Key et la Secret Key</li>
            </ol>
            <p className="text-orange-600 dark:text-orange-400 mt-2 text-xs">
              ⚠️ La Secret Key n'est affichée qu'une seule fois !
            </p>
          </div>

          <div className="pt-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://www.evoliz.com/aide/applications/624-evoliz-comment-creer-cle-api.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Voir le guide Evoliz
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ====== DIALOG SUPPRESSION ====== */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la configuration ?</DialogTitle>
            <DialogDescription>
              Cette action supprimera vos clés API Evoliz. Vous devrez les saisir à nouveau pour utiliser l'intégration.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
