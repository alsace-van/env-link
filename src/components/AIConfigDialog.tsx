import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ExternalLink, Trash2 } from "lucide-react";
import { useAIConfig, AIProvider, AI_PROVIDERS } from "@/hooks/useAIConfig";
import { toast } from "sonner";

interface AIConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIConfigDialog({ open, onOpenChange }: AIConfigDialogProps) {
  const { provider, apiKey, saveConfig, clearConfig } = useAIConfig();
  const [tempProvider, setTempProvider] = useState<AIProvider>(provider);
  const [tempApiKey, setTempApiKey] = useState(apiKey);

  const handleSave = () => {
    if (!tempApiKey.trim()) {
      toast.error("Veuillez entrer une clé API");
      return;
    }
    saveConfig(tempProvider, tempApiKey.trim());
    toast.success("Configuration IA sauvegardée");
    onOpenChange(false);
  };

  const handleClear = () => {
    clearConfig();
    setTempProvider("gemini");
    setTempApiKey("");
    toast.success("Configuration IA supprimée");
  };

  const currentProviderInfo = AI_PROVIDERS[tempProvider];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Configuration IA
          </DialogTitle>
          <DialogDescription>
            Configurez votre fournisseur d'IA pour toutes les fonctionnalités du site
            (import PDF, lecture carte grise, résumé de notice...)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Fournisseur IA</Label>
            <Select value={tempProvider} onValueChange={(v) => setTempProvider(v as AIProvider)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un fournisseur" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AI_PROVIDERS).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <span>{info.name}</span>
                      {key === "gemini" && (
                        <Badge variant="secondary" className="text-xs">Gratuit</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{currentProviderInfo.description}</p>
          </div>

          <div className="space-y-2">
            <Label>Clé API</Label>
            <Input
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder={currentProviderInfo.placeholder}
            />
            <a
              href={currentProviderInfo.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {currentProviderInfo.helpText}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {apiKey && (
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer la configuration
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!tempApiKey.trim()}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Composant compact pour afficher le statut IA et ouvrir la config
 */
interface AIConfigBadgeProps {
  onClick: () => void;
}

export function AIConfigBadge({ onClick }: AIConfigBadgeProps) {
  const { provider, isConfigured, providerInfo } = useAIConfig();

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-colors"
    >
      <Sparkles className="w-4 h-4 text-purple-600" />
      <div className="text-left">
        <p className="text-sm font-medium">{providerInfo.name}</p>
        <p className="text-xs text-muted-foreground">
          {isConfigured ? "✓ Configuré" : "Non configuré"}
        </p>
      </div>
    </button>
  );
}
