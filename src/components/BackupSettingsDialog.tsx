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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Download, Upload, Database, HardDrive, Cloud } from "lucide-react";
import { useBackupSync, BackupSettings } from "@/hooks/useBackupSync";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BackupSettingsDialogProps {
  userId: string | undefined;
}

export const BackupSettingsDialog = ({ userId }: BackupSettingsDialogProps) => {
  const {
    settings,
    updateSettings,
    exportLocalBackup,
    importLocalBackup,
  } = useBackupSync(userId);
  const [open, setOpen] = useState(false);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importLocalBackup(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Sauvegardes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paramètres de sauvegarde</DialogTitle>
          <DialogDescription>
            Choisissez où sauvegarder vos données. Plusieurs options peuvent être activées simultanément.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Supabase Backup */}
          <div className="flex items-start justify-between space-x-4">
            <div className="flex items-start space-x-3 flex-1">
              <Database className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="supabase-backup" className="text-base">
                  Sauvegarde Backend
                </Label>
                <p className="text-sm text-muted-foreground">
                  Synchronisation automatique avec le backend. Accessible depuis tous vos appareils.
                </p>
              </div>
            </div>
            <Switch
              id="supabase-backup"
              checked={settings.supabase}
              onCheckedChange={(checked) =>
                updateSettings({ supabase: checked })
              }
            />
          </div>

          <Separator />

          {/* Local Backup */}
          <div className="space-y-4">
            <div className="flex items-start justify-between space-x-4">
              <div className="flex items-start space-x-3 flex-1">
                <HardDrive className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="local-backup" className="text-base">
                    Sauvegarde locale
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportLocalBackup}
                >
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

          {/* Cloud Backup */}
          <div className="space-y-4">
            <div className="flex items-start justify-between space-x-4">
              <div className="flex items-start space-x-3 flex-1">
                <Cloud className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="cloud-backup" className="text-base">
                    Cloud personnel
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Sauvegarde sur votre propre service cloud (Google Drive, Dropbox, etc.)
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
              <div className="space-y-3 pl-8">
                <Alert>
                  <AlertDescription>
                    La connexion à un cloud personnel nécessite une configuration API. Cette fonctionnalité sera disponible prochainement.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="cloud-provider">Fournisseur cloud</Label>
                  <Select
                    value={settings.cloudProvider}
                    onValueChange={(value) =>
                      updateSettings({
                        cloudProvider: value as BackupSettings["cloudProvider"],
                      })
                    }
                  >
                    <SelectTrigger id="cloud-provider">
                      <SelectValue placeholder="Sélectionner un fournisseur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google-drive">Google Drive</SelectItem>
                      <SelectItem value="dropbox">Dropbox</SelectItem>
                      <SelectItem value="onedrive">OneDrive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settings.cloudProvider && (
                  <div className="space-y-2">
                    <Label htmlFor="cloud-token">Token d'accès API</Label>
                    <Input
                      id="cloud-token"
                      type="password"
                      placeholder="Entrez votre token API"
                      value={settings.cloudToken || ""}
                      onChange={(e) =>
                        updateSettings({ cloudToken: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          <Alert>
            <AlertDescription className="text-sm">
              <strong>Recommandation:</strong> Activez au minimum la sauvegarde Backend pour ne pas perdre vos données.
              La sauvegarde locale est un complément utile pour un accès hors ligne.
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
};
