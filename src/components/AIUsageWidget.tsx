import { useState } from "react";
import { Sparkles, ExternalLink, ChevronUp, ChevronDown, RotateCcw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAIConfig, AI_PROVIDERS } from "@/hooks/useAIConfig";
import { getAIUsageStats, resetAIUsageStats } from "@/services/aiService";
import { AIConfigDialog } from "@/components/AIConfigDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// URLs des dashboards par fournisseur
const DASHBOARD_URLS = {
  gemini: "https://aistudio.google.com/apikey",
  openai: "https://platform.openai.com/usage",
  anthropic: "https://console.anthropic.com/settings/billing",
  mistral: "https://console.mistral.ai/usage",
};

interface AIUsageWidgetProps {
  variant?: "compact" | "expanded";
  className?: string;
}

export function AIUsageWidget({ variant = "compact", className = "" }: AIUsageWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(variant === "expanded");
  const [showConfig, setShowConfig] = useState(false);
  const { provider, isConfigured, providerInfo, dailyLimit } = useAIConfig();
  const stats = getAIUsageStats();
  const dashboardUrl = DASHBOARD_URLS[provider];

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
    return tokens.toString();
  };

  // Calcul du pourcentage pour la jauge (seulement si l'utilisateur a configuré une limite)
  const percentUsed = dailyLimit ? Math.min((stats.todayTokens / dailyLimit) * 100, 100) : null;

  const getBarColor = (percent: number | null): string => {
    if (percent === null) return "bg-purple-500";
    if (percent < 50) return "bg-green-500";
    if (percent < 80) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (!isConfigured) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowConfig(true)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${className}`}
              >
                <Sparkles className="h-3 w-3" />
                <span>IA</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Configurer l'IA</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <AIConfigDialog open={showConfig} onOpenChange={setShowConfig} />
      </>
    );
  }

  return (
    <>
      <div className={`${className}`}>
        {/* Version compacte */}
        {!isExpanded ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsExpanded(true)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-50 dark:bg-purple-950/30 text-xs hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-colors"
                >
                  <Sparkles className="h-3 w-3 text-purple-600" />
                  <span className="font-medium">{formatTokens(stats.todayTokens)}</span>
                  {percentUsed !== null && (
                    <div className="w-8 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getBarColor(percentUsed)} transition-all`}
                        style={{ width: `${percentUsed}%` }}
                      />
                    </div>
                  )}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tokens IA consommés aujourd'hui</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          /* Version expandue */
          <div className="bg-white dark:bg-gray-900 border rounded-lg shadow-lg p-3 min-w-[220px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">{providerInfo.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setShowConfig(true)}
                        className="text-muted-foreground hover:text-foreground p-1"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Configurer</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Jauge */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Aujourd'hui</span>
                <span>
                  {formatTokens(stats.todayTokens)}
                  {dailyLimit && ` / ${formatTokens(dailyLimit)}`}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getBarColor(percentUsed)} transition-all`}
                  style={{ width: percentUsed !== null ? `${percentUsed}%` : "0%" }}
                />
              </div>
              {!dailyLimit && <p className="text-[10px] text-muted-foreground mt-1">Pas de limite configurée</p>}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                <div className="text-muted-foreground">Requêtes</div>
                <div className="font-medium">{stats.todayRequests}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                <div className="text-muted-foreground">Total</div>
                <div className="font-medium">{formatTokens(stats.totalTokens)}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <a
                href={dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1 text-xs text-purple-600 hover:text-purple-700 hover:underline"
              >
                Voir mon solde réel
                <ExternalLink className="h-3 w-3" />
              </a>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        resetAIUsageStats();
                        window.location.reload();
                      }}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Réinitialiser les stats</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Note */}
            <p className="text-[10px] text-muted-foreground mt-2 text-center">Stats de ce site uniquement</p>
          </div>
        )}
      </div>

      <AIConfigDialog open={showConfig} onOpenChange={setShowConfig} />
    </>
  );
}
