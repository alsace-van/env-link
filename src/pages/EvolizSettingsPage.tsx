// ============================================
// PAGE CONFIGURATION EVOLIZ
// Paramètres et test de connexion API
// ============================================

import React, { useState, useEffect } from 'react';
import { useEvolizConfig } from '@/hooks/useEvolizConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  Check, 
  X, 
  Eye, 
  EyeOff, 
  Link2, 
  Unlink, 
  ExternalLink,
  Shield,
  RefreshCw,
  Trash2,
  Info
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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

  // Form state
  const [companyId, setCompanyId] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Pré-remplir si credentials existants (masqués)
  useEffect(() => {
    if (credentials) {
      setCompanyId(credentials.company_id);
      setPublicKey(credentials.public_key);
      // Ne pas pré-remplir la secret key pour sécurité
      setSecretKey('');
    }
  }, [credentials]);

  const handleSave = async () => {
    if (!companyId || !publicKey || (!secretKey && !credentials)) {
      return;
    }

    const success = await saveCredentials({
      company_id: companyId,
      public_key: publicKey,
      secret_key: secretKey || credentials?.secret_key || '',
    });

    if (success) {
      // Test automatique après sauvegarde
      setTimeout(() => {
        testConnection();
      }, 500);
    }
  };

  const handleDelete = async () => {
    const success = await deleteCredentials();
    if (success) {
      setCompanyId('');
      setPublicKey('');
      setSecretKey('');
      setShowDeleteDialog(false);
    }
  };

  const canSave = companyId && publicKey && (secretKey || credentials);

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Configuration Evoliz</h1>
        <p className="text-muted-foreground">
          Connectez votre compte Evoliz pour synchroniser devis, clients et factures
        </p>
      </div>

      {/* Status Card */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              État de la connexion
            </CardTitle>
            {isConfigured ? (
              <Badge variant="default" className="bg-green-600">
                <Check className="h-3 w-3 mr-1" />
                Configuré
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Unlink className="h-3 w-3 mr-1" />
                Non configuré
              </Badge>
            )}
          </div>
        </CardHeader>
        {isConfigured && credentials && (
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Company ID: <code className="bg-muted px-1 rounded">{credentials.company_id}</code></p>
              {credentials.last_test_at && (
                <p>
                  Dernier test: {new Date(credentials.last_test_at).toLocaleString('fr-FR')}
                  {credentials.last_test_success ? (
                    <Check className="inline h-4 w-4 text-green-600 ml-1" />
                  ) : (
                    <X className="inline h-4 w-4 text-red-600 ml-1" />
                  )}
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Clés API
          </CardTitle>
          <CardDescription>
            Obtenez vos clés depuis{' '}
            <a 
              href="https://www.evoliz.com/parametres/api" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Evoliz → Paramètres → API
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Company ID */}
          <div className="space-y-2">
            <Label htmlFor="companyId">Company ID</Label>
            <Input
              id="companyId"
              type="text"
              placeholder="12345"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Identifiant numérique de votre société Evoliz
            </p>
          </div>

          {/* Public Key */}
          <div className="space-y-2">
            <Label htmlFor="publicKey">Public Key</Label>
            <Input
              id="publicKey"
              type="text"
              placeholder="pk_xxxxxxxxxxxxx"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
            />
          </div>

          {/* Secret Key */}
          <div className="space-y-2">
            <Label htmlFor="secretKey">
              Secret Key
              {credentials && (
                <span className="text-muted-foreground font-normal ml-2">
                  (laisser vide pour garder l'actuelle)
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="secretKey"
                type={showSecretKey ? 'text' : 'password'}
                placeholder={credentials ? '••••••••••••••••' : 'sk_xxxxxxxxxxxxx'}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowSecretKey(!showSecretKey)}
              >
                {showSecretKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Info Box */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Vos clés sont stockées de manière sécurisée et ne sont jamais partagées. 
              Elles sont utilisées uniquement pour communiquer avec l'API Evoliz.
            </AlertDescription>
          </Alert>

          {/* Test Result */}
          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              {testResult.success ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={!canSave || isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>

            {isConfigured && (
              <>
                <Button
                  variant="outline"
                  onClick={() => testConnection()}
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>

                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Supprimer la configuration ?</DialogTitle>
                      <DialogDescription>
                        Cette action supprimera vos clés API Evoliz. 
                        Vous devrez les saisir à nouveau pour utiliser l'intégration.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowDeleteDialog(false)}
                      >
                        Annuler
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDelete}
                      >
                        Supprimer
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Comment obtenir vos clés API ?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal list-inside space-y-2">
            <li>Connectez-vous à votre compte <strong>Evoliz</strong></li>
            <li>Allez dans <strong>Paramètres → API</strong> (ou Applications → Evoliz API)</li>
            <li>Cliquez sur <strong>"Créer une clé API"</strong></li>
            <li>Nommez-la <code className="bg-muted px-1 rounded">Van Project Buddy</code></li>
            <li>Copiez le <strong>Company ID</strong>, <strong>Public Key</strong> et <strong>Secret Key</strong></li>
            <li>Collez-les dans le formulaire ci-dessus</li>
          </ol>
          <p className="text-muted-foreground mt-4">
            💡 La Secret Key n'est affichée qu'une seule fois lors de la création. 
            Si vous l'avez perdue, vous devrez créer une nouvelle clé.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
