// ============================================
// GESTION DES TOKENS D'UPLOAD
// Permet à l'utilisateur de générer un token
// pour envoyer des factures depuis le raccourci macOS
// ============================================

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Key,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Eye,
  EyeOff,
  Smartphone,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface UploadToken {
  id: string;
  name: string;
  token: string;
  is_active: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export function UploadTokenManager() {
  const [tokens, setTokens] = useState<UploadToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState("Raccourci macOS");
  
  // Dialog pour afficher le nouveau token
  const [showNewToken, setShowNewToken] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Charger les tokens
  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("user_upload_tokens")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTokens(data || []);
    } catch (err) {
      console.error("Erreur chargement tokens:", err);
    } finally {
      setLoading(false);
    }
  };

  // Générer un nouveau token
  const generateToken = async () => {
    setCreating(true);
    try {
      // Générer le token côté client (même format que la fonction SQL)
      const randomBytes = new Uint8Array(24);
      crypto.getRandomValues(randomBytes);
      const base64 = btoa(String.fromCharCode(...randomBytes));
      const token = "vpb_" + base64.replace(/\+/g, "x").replace(/\//g, "y").replace(/=/g, "").substring(0, 32);

      const { data, error } = await (supabase as any)
        .from("user_upload_tokens")
        .insert({
          name: newTokenName,
          token: token,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Un token avec ce nom existe déjà");
          return;
        }
        throw error;
      }

      setNewToken(token);
      setShowNewToken(true);
      setNewTokenName("Raccourci macOS");
      await loadTokens();
      toast.success("Token créé !");
    } catch (err) {
      console.error("Erreur création token:", err);
      toast.error("Erreur lors de la création du token");
    } finally {
      setCreating(false);
    }
  };

  // Copier le token
  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success("Token copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  // Désactiver/Activer un token
  const toggleToken = async (id: string, currentState: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("user_upload_tokens")
        .update({ is_active: !currentState })
        .eq("id", id);

      if (error) throw error;
      await loadTokens();
      toast.success(currentState ? "Token désactivé" : "Token réactivé");
    } catch (err) {
      toast.error("Erreur");
    }
  };

  // Supprimer un token
  const deleteToken = async (id: string) => {
    if (!confirm("Supprimer ce token ? Les raccourcis utilisant ce token ne fonctionneront plus.")) {
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from("user_upload_tokens")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await loadTokens();
      toast.success("Token supprimé");
    } catch (err) {
      toast.error("Erreur");
    }
  };

  // Masquer partiellement le token
  const maskToken = (token: string) => {
    return token.substring(0, 8) + "••••••••••••" + token.substring(token.length - 4);
  };

  // Formater la date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Jamais";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-2" />
          Chargement...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Tokens d'upload
          </CardTitle>
          <CardDescription>
            Créez un token pour envoyer des factures depuis le raccourci macOS ou d'autres applications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info */}
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertTitle>Comment ça marche ?</AlertTitle>
            <AlertDescription className="text-sm">
              <ol className="list-decimal list-inside space-y-1 mt-2">
                <li>Créez un token ci-dessous</li>
                <li>Copiez-le dans votre raccourci macOS</li>
                <li>Envoyez vos factures PDF en un clic depuis Mail ou le Finder</li>
                <li>Elles seront analysées avec votre clé Gemini et apparaîtront ici</li>
              </ol>
            </AlertDescription>
          </Alert>

          {/* Créer un nouveau token */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="token-name" className="sr-only">Nom du token</Label>
              <Input
                id="token-name"
                placeholder="Nom du token (ex: MacBook Pro)"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
              />
            </div>
            <Button onClick={generateToken} disabled={creating || !newTokenName.trim()}>
              {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              <span className="ml-2">Générer</span>
            </Button>
          </div>

          {/* Liste des tokens */}
          {tokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Aucun token créé</p>
              <p className="text-sm">Créez votre premier token pour commencer</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className={`p-3 border rounded-lg ${!token.is_active ? "opacity-60 bg-muted" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{token.name}</span>
                        {!token.is_active && (
                          <Badge variant="secondary" className="text-xs">Désactivé</Badge>
                        )}
                      </div>
                      <code className="text-xs text-muted-foreground font-mono">
                        {maskToken(token.token)}
                      </code>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleToken(token.id, token.is_active)}
                        title={token.is_active ? "Désactiver" : "Réactiver"}
                      >
                        {token.is_active ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteToken(token.id)}
                        className="text-destructive hover:text-destructive"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Utilisé {token.use_count} fois</span>
                    <span>•</span>
                    <span>Dernier usage : {formatDate(token.last_used_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog pour afficher le nouveau token */}
      <Dialog open={showNewToken} onOpenChange={setShowNewToken}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Token créé !
            </DialogTitle>
            <DialogDescription>
              Copiez ce token maintenant. Il ne sera plus affiché en entier après fermeture.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive" className="bg-orange-50 border-orange-200">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <AlertDescription className="text-orange-700">
              Conservez ce token en lieu sûr. Vous ne pourrez plus le voir en entier.
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <code className="flex-1 text-sm font-mono break-all">{newToken}</code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => newToken && copyToken(newToken)}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowNewToken(false)}>
              J'ai copié mon token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
