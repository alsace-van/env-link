import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, Search, Package, Puzzle, Star, ExternalLink, FileText, Clock, Loader2, ChevronDown, ChevronUp } from "lucide-react";
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
  file_type: string;
  icon_url: string;
  changelog: string;
  requirements: string;
  documentation_url: string;
  download_count: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'all', label: 'Tous', icon: '📦' },
  { value: 'extension', label: 'Extensions', icon: '🌐' },
  { value: 'plugin', label: 'Plugins', icon: '🔧' },
  { value: 'template', label: 'Templates', icon: '📄' },
  { value: 'document', label: 'Documents', icon: '📋' },
  { value: 'other', label: 'Autres', icon: '📁' },
];

const PLATFORM_ICONS: Record<string, string> = {
  chrome: '🌐',
  opera: '🔴',
  firefox: '🦊',
  edge: '🔵',
  fusion360: '🔧',
  freecad: '⚙️',
  all: '💻',
};

const Downloads = () => {
  const navigate = useNavigate();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedChangelog, setExpandedChangelog] = useState<string | null>(null);

  useEffect(() => {
    loadDownloads();
  }, []);

  const loadDownloads = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('downloads')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('is_featured', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setDownloads(data || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des téléchargements');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (item: DownloadItem) => {
    try {
      // Incrémenter le compteur
      await supabase.rpc('increment_download_count', { download_id: item.id });
      
      // Télécharger le fichier
      const link = document.createElement('a');
      link.href = item.file_url;
      link.download = item.file_name;
      link.click();
      
      toast.success(`Téléchargement de ${item.name} démarré`);
    } catch (error) {
      console.error('Erreur:', error);
      // Le téléchargement continue même si le compteur échoue
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

  const filteredDownloads = downloads.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredDownloads = filteredDownloads.filter(d => d.is_featured);
  const regularDownloads = filteredDownloads.filter(d => !d.is_featured);

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  const getCategoryIcon = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.icon || '📦';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-3">Outils & Téléchargements</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Retrouvez ici nos extensions, plugins et outils pour améliorer votre expérience
          </p>
        </div>

        {/* Recherche et filtres */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un outil..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
                className="h-10"
              >
                <span className="mr-1">{cat.icon}</span>
                {cat.label}
                {cat.value !== 'all' && (
                  <Badge variant="secondary" className="ml-2 bg-background/50">
                    {downloads.filter(d => d.category === cat.value).length}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Chargement...</span>
          </div>
        ) : filteredDownloads.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Aucun téléchargement trouvé</h3>
            <p className="text-muted-foreground">
              {searchQuery ? 'Essayez avec d\'autres termes de recherche' : 'Aucun fichier disponible dans cette catégorie'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Section mise en avant */}
            {featuredDownloads.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  Mis en avant
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {featuredDownloads.map((item) => (
                    <Card key={item.id} className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-4xl">{getCategoryIcon(item.category)}</div>
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                {item.name}
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary">{getCategoryLabel(item.category)}</Badge>
                                {item.platform && (
                                  <Badge variant="outline">
                                    {PLATFORM_ICONS[item.platform] || '💻'} {item.platform}
                                  </Badge>
                                )}
                                {item.version && (
                                  <span className="text-xs font-mono">v{item.version}</span>
                                )}
                              </CardDescription>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {item.file_size > 0 && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {formatFileSize(item.file_size)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            {item.download_count || 0} téléchargements
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(item.updated_at)}
                          </span>
                        </div>
                        {item.requirements && (
                          <p className="text-xs text-muted-foreground mt-2">
                            ⚙️ Prérequis : {item.requirements}
                          </p>
                        )}
                        {item.changelog && (
                          <div className="mt-3">
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
                              <pre className="mt-2 p-3 bg-muted rounded-md text-xs whitespace-pre-wrap">
                                {item.changelog}
                              </pre>
                            )}
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="flex gap-2">
                        <Button onClick={() => handleDownload(item)} className="flex-1">
                          <Download className="w-4 h-4 mr-2" />
                          Télécharger
                        </Button>
                        {item.documentation_url && (
                          <Button variant="outline" asChild>
                            <a href={item.documentation_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Autres téléchargements */}
            {regularDownloads.length > 0 && (
              <div>
                {featuredDownloads.length > 0 && (
                  <h2 className="text-xl font-semibold mb-4">Tous les outils</h2>
                )}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {regularDownloads.map((item) => (
                    <Card key={item.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="text-3xl">{getCategoryIcon(item.category)}</div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate">{item.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {getCategoryLabel(item.category)}
                              </Badge>
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
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {item.file_size > 0 && <span>{formatFileSize(item.file_size)}</span>}
                          <span>{item.download_count || 0} DL</span>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0">
                        <Button 
                          onClick={() => handleDownload(item)} 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Télécharger
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section d'aide */}
        <div className="mt-12 p-6 bg-muted/50 rounded-xl border">
          <h3 className="text-lg font-semibold mb-2">💡 Besoin d'aide ?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Pour installer une extension navigateur, téléchargez le fichier ZIP, extrayez-le, 
            puis chargez-le en mode développeur dans votre navigateur.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="https://support.google.com/chrome/a/answer/2714278?hl=fr" target="_blank" rel="noopener noreferrer">
                Guide Chrome
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://help.opera.com/en/latest/customization/#extensions" target="_blank" rel="noopener noreferrer">
                Guide Opera
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Downloads;
