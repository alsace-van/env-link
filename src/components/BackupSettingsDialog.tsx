// ============================================
// BackupSettingsDialog.tsx
// Dialog de configuration des sauvegardes multi-destinations
// VERSION: 2.0 - Ajout dossier local + cloud personnel (WebDAV, custom)
// ============================================

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Settings,
  Download,
  Upload,
  Database,
  HardDrive,
  Cloud,
  FolderOpen,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { useBackupSync, BackupSettings } from "@/hooks/useBackupSync";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface BackupSettingsDialogProps {
  userId: string | undefined;
}

export const BackupSettingsDialog = ({ userId }: BackupSettingsDialogProps) => {
  const {
    settings,
    updateSettings,
    exportLocalBackup,
    exportFullBackup,
    importLocalBackup,
    selectLocalFolder,
    filesystemHandle,
    testCloudConnection,
    loading,
  } = useBackupSync(userId);

  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importLocalBackup(file);
    }
  };

  const handleSelectFolder = async () => {
    await selectLocalFolder();
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    await testCloudConnection();
    setTestingConnection(false);
  };

  const formatLastBackup = (date?: string) => {
    if (!date) return "Jamais";
    return new Date(date).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Sauvegardes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paramètres de sauvegarde</DialogTitle>
          <DialogDescription>
            Configurez plusieurs destinations de sauvegarde pour vos données.
            {settings.lastBackup && (
              <span className="block mt-1 text-xs">Dernière sauvegarde : {formatLastBackup(settings.lastBackup)}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* ============================================ */}
          {/* SAUVEGARDE BACKEND (Supabase) */}
          {/* ============================================ */}
          <div className="flex items-start justify-between space-x-4">
            <div className="flex items-start space-x-3 flex-1">
              <Database className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="supabase-backup" className="text-base">
                  Sauvegarde Backend
                </Label>
                <p className="text-sm text-muted-foreground">
                  Synchronisation automatique avec le serveur. Accessible depuis tous vos appareils.
                </p>
              </div>
            </div>
            <Switch
              id="supabase-backup"
              checked={settings.supabase}
              onCheckedChange={(checked) => updateSettings({ supabase: checked })}
            />
          </div>

          <Separator />

          {/* ============================================ */}
          {/* SAUVEGARDE NAVIGATEUR (localStorage) */}
          {/* ============================================ */}
          <div className="space-y-4">
            <div className="flex items-start justify-between space-x-4">
              <div className="flex items-start space-x-3 flex-1">
                <HardDrive className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="local-backup" className="text-base">
                    Sauvegarde navigateur
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Stockage dans le navigateur. Uniquement sur cet appareil.
                  </p>
                </div>
              </div>
              <Switch
                id="local-backup"
                checked={settings.local}
                onCheckedChange={(checked) => updateSettings({ local: checked })}
              />
            </div>

            {settings.local && (
              <div className="flex gap-2 pl-8">
                <Button variant="outline" size="sm" onClick={exportLocalBackup}>
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <label htmlFor="import-backup" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Importer
                    <input
                      id="import-backup"
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleFileImport}
                    />
                  </label>
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* ============================================ */}
          {/* DOSSIER LOCAL (File System Access API) */}
          {/* ============================================ */}
          <div className="space-y-4">
            <div className="flex items-start justify-between space-x-4">
              <div className="flex items-start space-x-3 flex-1">
                <FolderOpen className="h-5 w-5 text-orange-500 mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="filesystem-backup" className="text-base">
                    Dossier sur l'ordinateur
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Sauvegarde automatique dans un dossier de votre choix sur votre ordinateur.
                  </p>
                </div>
              </div>
              <Switch
                id="filesystem-backup"
                checked={settings.filesystem}
                onCheckedChange={(checked) => updateSettings({ filesystem: checked })}
              />
            </div>

            {settings.filesystem && (
              <div className="space-y-3 pl-8">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectFolder}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Choisir un dossier
                  </Button>
                  {filesystemHandle && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {settings.filesystemPath}
                    </Badge>
                  )}
                </div>
                {!filesystemHandle && settings.filesystemPath && (
                  <Alert>
                    <AlertDescription className="text-sm">
                      Le dossier "{settings.filesystemPath}" était sélectionné. Veuillez le sélectionner à nouveau (le
                      navigateur ne conserve pas l'accès entre les sessions).
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-muted-foreground">
                  💡 Fonctionne avec Chrome, Edge. Le dossier doit être resélectionné à chaque session.
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* ============================================ */}
          {/* CLOUD PERSONNEL */}
          {/* ============================================ */}
          <div className="space-y-4">
            <div className="flex items-start justify-between space-x-4">
              <div className="flex items-start space-x-3 flex-1">
                <Cloud className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="cloud-backup" className="text-base">
                    Cloud personnel
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Sauvegarde sur votre propre serveur cloud (NAS, WebDAV, endpoint personnalisé).
                  </p>
                </div>
              </div>
              <Switch
                id="cloud-backup"
                checked={settings.cloud}
                onCheckedChange={(checked) => updateSettings({ cloud: checked })}
              />
            </div>

            {settings.cloud && (
              <div className="space-y-4 pl-8">
                {/* Type de cloud */}
                <div className="space-y-2">
                  <Label htmlFor="cloud-provider">Type de service</Label>
                  <Select
                    value={settings.cloudProvider || ""}
                    onValueChange={(value) =>
                      updateSettings({
                        cloudProvider: value as BackupSettings["cloudProvider"],
                      })
                    }
                  >
                    <SelectTrigger id="cloud-provider">
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="webdav">WebDAV (Nextcloud, Synology, etc.)</SelectItem>
                      <SelectItem value="custom">Endpoint personnalisé (API REST)</SelectItem>
                      <SelectItem value="google-drive" disabled>
                        Google Drive (bientôt)
                      </SelectItem>
                      <SelectItem value="dropbox" disabled>
                        Dropbox (bientôt)
                      </SelectItem>
                      <SelectItem value="onedrive" disabled>
                        OneDrive (bientôt)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Configuration WebDAV */}
                {settings.cloudProvider === "webdav" && (
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                    <div className="space-y-2">
                      <Label htmlFor="webdav-url">URL WebDAV</Label>
                      <Input
                        id="webdav-url"
                        placeholder="https://mon-nas.local/webdav/sauvegardes"
                        value={settings.cloudUrl || ""}
                        onChange={(e) => updateSettings({ cloudUrl: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Ex: https://cloud.exemple.com/remote.php/dav/files/utilisateur/Sauvegardes
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="webdav-user">Utilisateur</Label>
                        <Input
                          id="webdav-user"
                          placeholder="utilisateur"
                          value={settings.cloudUsername || ""}
                          onChange={(e) => updateSettings({ cloudUsername: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="webdav-pass">Mot de passe</Label>
                        <div className="relative">
                          <Input
                            id="webdav-pass"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={settings.cloudPassword || ""}
                            onChange={(e) => updateSettings({ cloudPassword: e.target.value })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Configuration Endpoint personnalisé */}
                {settings.cloudProvider === "custom" && (
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                    <div className="space-y-2">
                      <Label htmlFor="custom-url">URL de l'endpoint</Label>
                      <Input
                        id="custom-url"
                        placeholder="https://mon-serveur.com/api/backup"
                        value={settings.cloudUrl || ""}
                        onChange={(e) => updateSettings({ cloudUrl: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom-token">Token d'authentification (optionnel)</Label>
                      <div className="relative">
                        <Input
                          id="custom-token"
                          type={showPassword ? "text" : "password"}
                          placeholder="Bearer token ou API key"
                          value={settings.cloudToken || ""}
                          onChange={(e) => updateSettings({ cloudToken: e.target.value })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Alert>
                      <AlertDescription className="text-xs">
                        L'endpoint doit accepter une requête POST avec le body :{" "}
                        <code className="bg-muted px-1 rounded">{`{ filename, data, timestamp }`}</code>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {/* Bouton test de connexion */}
                {settings.cloudProvider && settings.cloudUrl && (
                  <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testingConnection}>
                    {testingConnection ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Tester la connexion
                  </Button>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* ============================================ */}
          {/* SAUVEGARDE AUTOMATIQUE */}
          {/* ============================================ */}
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <RefreshCw className="h-5 w-5 text-green-500 mt-0.5" />
              <div className="space-y-1 flex-1">
                <Label className="text-base">Sauvegarde automatique</Label>
                <p className="text-sm text-muted-foreground">
                  Exporter automatiquement une sauvegarde complète à intervalle régulier.
                </p>
              </div>
            </div>
            <div className="pl-8">
              <Select
                value={settings.autoBackupInterval?.toString() || "0"}
                onValueChange={(value) => updateSettings({ autoBackupInterval: parseInt(value) })}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Fréquence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Désactivé</SelectItem>
                  <SelectItem value="30">Toutes les 30 minutes</SelectItem>
                  <SelectItem value="60">Toutes les heures</SelectItem>
                  <SelectItem value="240">Toutes les 4 heures</SelectItem>
                  <SelectItem value="1440">Tous les jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* ============================================ */}
          {/* ACTIONS GLOBALES */}
          {/* ============================================ */}
          <div className="flex items-center justify-between">
            <Button variant="default" onClick={exportFullBackup} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              Exporter sauvegarde complète
            </Button>
          </div>

          <Alert>
            <AlertDescription className="text-sm">
              <strong>Recommandation :</strong> Activez au minimum la sauvegarde Backend. Pour une protection maximale,
              combinez plusieurs destinations.
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
};
