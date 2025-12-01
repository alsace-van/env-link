import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Package, Star, ExternalLink, FileText, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface DownloadItem {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  platform: string;
  file_url: string;
  file_name: string;
  file_size: number;
  changelog: string;
  requirements: string;
  documentation_url: string;
  download_count: number;
  is_featured: boolean;
  updated_at: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  extension: '🌐',
  plugin: '🔧',
  template: '📄',
  document: '📋',
  other: '📦',
};

const CATEGORY_LABELS: Record<string, string> = {
  extension: 'Extension',
  plugin: 'Plugin',
  template: 'Template',
  document: 'Document',
  other: 'Autre',
};

export function DownloadsWidget() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedChangelog, setExpandedChangelog] = useState<string | null>(null);

  useEffect(() => {
    loadDownloads();
  }, []);

  const loadDownloads = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await (supabase as any)
        .from('downloads')
        .select('*')
        .eq('is_active', true)
        .order('is_featured', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setDownloads((data || []) as DownloadItem[]);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (item: DownloadItem) => {
    try {
      // Incrémenter le compteur
      await (supabase as any).rpc('increment_download_count', { download_id: item.id }).catch(() => {});
      
      // Télécharger le fichier
      const link = document.createElement('a');
      link.href = item.file_url;
      link.download = item.file_name;
      link.click();
      
      toast.success(`Téléchargement de ${item.name} démarré`);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Aucun téléchargement disponible</h3>
        <p className="text-muted-foreground">
          Les outils et extensions seront affichés ici quand ils seront disponibles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Outils & Téléchargements
          </h2>
          <p className="text-muted-foreground mt-1">
            Extensions, plugins et outils pour améliorer votre expérience
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {downloads.map((item) => (
          <Card 
            key={item.id} 
            className={`hover:shadow-lg transition-shadow ${item.is_featured ? 'border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent' : ''}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{CATEGORY_ICONS[item.category] || '📦'}</div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate flex items-center gap-2">
                    {item.name}
                    {item.is_featured && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </Badge>
                    {item.platform && (
                      <Badge variant="secondary" className="text-xs">
                        {item.platform}
                      </Badge>
                    )}
                    {item.version && (
                      <span className="text-xs text-muted-foreground font-mono">
                        v{item.version}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              {item.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {item.description}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {item.file_size > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {formatFileSize(item.file_size)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  {item.download_count || 0} DL
                </span>
                <span>Maj: {formatDate(item.updated_at)}</span>
              </div>
              {item.requirements && (
                <p className="text-xs text-muted-foreground mt-2">
                  ⚙️ {item.requirements}
                </p>
              )}
              {item.changelog && (
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 h-auto text-xs"
                    onClick={() => setExpandedChangelog(expandedChangelog === item.id ? null : item.id)}
                  >
                    {expandedChangelog === item.id ? (
                      <ChevronUp className="w-3 h-3 mr-1" />
                    ) : (
                      <ChevronDown className="w-3 h-3 mr-1" />
                    )}
                    Notes de version
                  </Button>
                  {expandedChangelog === item.id && (
                    <pre className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {item.changelog}
                    </pre>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-0 gap-2">
              <Button 
                onClick={() => handleDownload(item)} 
                variant={item.is_featured ? "default" : "outline"}
                size="sm" 
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Télécharger
              </Button>
              {item.documentation_url && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={item.documentation_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Section d'aide */}
      <div className="p-4 bg-muted/50 rounded-lg border">
        <h3 className="text-sm font-semibold mb-2">💡 Installation des extensions</h3>
        <p className="text-xs text-muted-foreground">
          Pour installer une extension navigateur : téléchargez le ZIP, extrayez-le, 
          puis chargez-le en mode développeur dans votre navigateur (chrome://extensions ou opera://extensions).
        </p>
      </div>
    </div>
  );
}
