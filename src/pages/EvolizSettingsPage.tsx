// ============================================
// PAGE CONFIGURATION EVOLIZ
// Saisie et test des clés API
// ============================================

import React, { useState, useEffect } from "react";
import { useEvolizConfig } from "@/hooks/useEvolizConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "lucide-react";

export default function EvolizSettingsPage() {
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

  // Charger les credentials existants
  useEffect(() => {
    if (credentials) {
      setCompanyId(credentials.company_id);
      setPublicKey(credentials.public_key);
      // Ne pas afficher le secret key existant pour des raisons de sécurité
      setSecretKey("");
    }
  }, [credentials]);

  const handleSave = async () => {
    if (!companyId || !publicKey || (!secretKey && !credentials)) {
      return;
    }

    setIsSaving(true);
    const success = await saveCredentials({
      company_id: companyId,
      public_key: publicKey,
      secret_key: secretKey || credentials?.secret_key || "",
    });

    if (success) {
      // Tester automatiquement après sauvegarde
      await testConnection();
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    await deleteCredentials();
    setCompanyId("");
    setPublicKey("");
    setSecretKey("");
    setShowDeleteDialog(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="h-8 w-8" />
          Configuration Evoliz
        </h1>
        <p className="text-muted-foreground mt-2">
          Connectez votre compte Evoliz pour synchroniser vos devis et clients.
        </p>
      </div>

      {/* Statut actuel */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Statut de connexion</CardTitle>
            <Badge variant={isConfigured ? "default" : "secondary"}>
              {isConfigured ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Configuré
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Non configuré
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        {isConfigured && credentials && (
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Company ID:</span> {credentials.company_id}
              </p>
              {credentials.last_test_at && (
                <p>
                  <span className="font-medium">Dernier test:</span>{" "}
                  {new Date(credentials.last_test_at).toLocaleString("fr-FR")}
                  {credentials.last_test_success ? (
                    <CheckCircle2 className="h-4 w-4 inline ml-2 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 inline ml-2 text-red-500" />
                  )}
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Formulaire */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Clés API Evoliz
          </CardTitle>
          <CardDescription>Récupérez vos clés API depuis votre espace Evoliz → Paramètres → API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyId">Company ID</Label>
            <Input
              id="companyId"
              placeholder="Ex: 12345"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="publicKey">Public Key</Label>
            <Input
              id="publicKey"
              placeholder="Votre clé publique"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="secretKey">
              Secret Key
              {credentials && (
                <span className="text-muted-foreground font-normal ml-2">(laisser vide pour conserver l'actuel)</span>
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

          {/* Résultat du test */}
          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving || !companyId || !publicKey || (!secretKey && !credentials)}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>

            {isConfigured && (
              <>
                <Button variant="outline" onClick={testConnection} disabled={isTesting}>
                  {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>

                <Button variant="destructive" size="icon" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Comment obtenir vos clés API ?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <ol className="list-decimal list-inside space-y-2">
            <li>Connectez-vous à votre compte Evoliz</li>
            <li>Allez dans Paramètres → API</li>
            <li>Cliquez sur "Créer une nouvelle clé API"</li>
            <li>Nommez-la "Van Project Buddy"</li>
            <li>Copiez le Company ID, la Public Key et la Secret Key</li>
          </ol>
          <div className="pt-4">
            <Button variant="outline" size="sm" asChild>
              <a href="https://www.evoliz.com/connexion" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ouvrir Evoliz
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la configuration ?</DialogTitle>
            <DialogDescription>
              Cette action supprimera définitivement vos clés API Evoliz. Vous devrez les saisir à nouveau pour utiliser
              l'intégration.
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
