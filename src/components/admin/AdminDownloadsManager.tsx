import React, { useState, useEffect } from 'react';
import { Download, Eye, Filter, Loader2, AlertCircle, Plus, Trash2, Edit, Upload, Package, Puzzle, FileCode, Star, StarOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DownloadUploadDialog } from './DownloadUploadDialog';

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
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'extension', label: 'Extensions navigateur', icon: '🌐' },
  { value: 'plugin', label: 'Plugins Fusion 360', icon: '🔧' },
  { value: 'template', label: 'Templates', icon: '📄' },
  { value: 'document', label: 'Documents', icon: '📋' },
  { value: 'other', label: 'Autres', icon: '📦' },
];

const PLATFORMS = [
  { value: 'chrome', label: 'Chrome' },
  { value: 'opera', label: 'Opera' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'edge', label: 'Edge' },
  { value: 'fusion360', label: 'Fusion 360' },
  { value: 'freecad', label: 'FreeCAD' },
  { value: 'all', label: 'Toutes plateformes' },
];

export function AdminDownloadsManager() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [filteredDownloads, setFilteredDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DownloadItem | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  useEffect(() => {
    loadDownloads();
  }, []);

  useEffect(() => {
    filterDownloads();
  }, [selectedCategory, downloads]);

  const loadDownloads = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('downloads')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      setDownloads((data || []) as DownloadItem[]);
    } catch (err) {
      console.error('Erreur lors du chargement des téléchargements:', err);
      setError('Impossible de charger les téléchargements');
    } finally {
      setLoading(false);
    }
  };

  const filterDownloads = () => {
    if (selectedCategory === 'all') {
      setFilteredDownloads(downloads);
    } else {
      setFilteredDownloads(downloads.filter(d => d.category === selectedCategory));
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemId) return;

    try {
      const itemToDelete = downloads.find(d => d.id === deleteItemId);
      if (!itemToDelete) return;

      // Supprimer le fichier du storage
      if (itemToDelete.file_url.includes('downloads')) {
        const urlParts = itemToDelete.file_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        const { error: storageError } = await supabase.storage
          .from('downloads')
          .remove([fileName]);

        if (storageError) {
          console.error('Erreur lors de la suppression du fichier:', storageError);
        }
      }

      // Supprimer l'entrée de la base de données
      const { error: dbError } = await supabase
        .from('downloads')
        .delete()
        .eq('id', deleteItemId);

      if (dbError) throw dbError;

      toast.success('Téléchargement supprimé avec succès');
      loadDownloads();
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setDeleteItemId(null);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('downloads')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast.success(currentStatus ? 'Téléchargement désactivé' : 'Téléchargement activé');
      loadDownloads();
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const toggleFeatured = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('downloads')
        .update({ is_featured: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast.success(currentStatus ? 'Retiré des favoris' : 'Ajouté aux favoris');
      loadDownloads();
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryInfo = (category: string) => {
    return CATEGORIES.find(c => c.value === category) || { label: category, icon: '📦' };
  };

  const getPlatformLabel = (platform: string) => {
    return PLATFORMS.find(p => p.value === platform)?.label || platform;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Chargement des téléchargements...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">Erreur</p>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
            <button
              onClick={loadDownloads}
              className="mt-3 text-sm text-destructive underline hover:text-destructive/80"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec boutons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Téléchargements</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestion des extensions, plugins et fichiers à télécharger
          </p>
        </div>

        <Button onClick={() => { setEditingItem(null); setUploadDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un fichier
        </Button>
      </div>

      {/* Filtres par catégorie */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filtrer :</span>
        </div>
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
        >
          Tous
          <span className="ml-2">{downloads.length}</span>
        </Button>
        {CATEGORIES.map((category) => (
          <Button
            key={category.value}
            variant={selectedCategory === category.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category.value)}
          >
            <span className="mr-1">{category.icon}</span>
            {category.label}
            <span className="ml-2">
              {downloads.filter(d => d.category === category.value).length}
            </span>
          </Button>
        ))}
      </div>

      {/* Liste des téléchargements */}
      {filteredDownloads.length === 0 ? (
        <div className="text-center py-12 bg-muted/50 rounded-lg border-2 border-dashed border-border">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">Aucun téléchargement trouvé</p>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedCategory === 'all'
              ? 'Aucun fichier disponible au téléchargement'
              : `Aucun fichier dans la catégorie "${getCategoryInfo(selectedCategory).label}"`}
          </p>
          <Button className="mt-4" onClick={() => { setEditingItem(null); setUploadDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un fichier
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDownloads.map((item) => (
            <div
              key={item.id}
              className={`bg-card border rounded-lg p-5 hover:shadow-lg transition-all hover:border-primary/50 ${!item.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* Icône */}
                  <div className="text-4xl">
                    {getCategoryInfo(item.category).icon}
                  </div>

                  {/* Informations */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        {item.name}
                        {item.is_featured && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </h3>
                      <Badge variant="secondary">
                        {getCategoryInfo(item.category).label}
                      </Badge>
                      {item.platform && (
                        <Badge variant="outline">
                          {getPlatformLabel(item.platform)}
                        </Badge>
                      )}
                      {item.version && (
                        <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs font-mono">
                          v{item.version}
                        </span>
                      )}
                      {!item.is_active && (
                        <Badge variant="destructive">Désactivé</Badge>
                      )}
                    </div>

                    {item.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                        {item.description.length > 200
                          ? item.description.substring(0, 200) + '...'
                          : item.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>📁 {item.file_name}</span>
                      <span>💾 {formatFileSize(item.file_size)}</span>
                      <span>📥 {item.download_count} téléchargements</span>
                      {item.requirements && (
                        <span>⚙️ {item.requirements}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFeatured(item.id, item.is_featured)}
                    title={item.is_featured ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    {item.is_featured ? (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    ) : (
                      <StarOff className="w-4 h-4" />
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingItem(item); setUploadDialogOpen(true); }}
                    title="Modifier"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a
                      href={item.file_url}
                      download
                      title="Télécharger"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>

                  <Button
                    variant={item.is_active ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => toggleActive(item.id, item.is_active)}
                    title={item.is_active ? 'Désactiver' : 'Activer'}
                  >
                    {item.is_active ? 'Actif' : 'Inactif'}
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteItemId(item.id)}
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statistiques */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">
                {filteredDownloads.length} fichier{filteredDownloads.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Total téléchargements : {downloads.reduce((sum, d) => sum + (d.download_count || 0), 0)}
            </div>
          </div>
          {selectedCategory !== 'all' && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setSelectedCategory('all')}
            >
              Voir tous ({downloads.length})
            </Button>
          )}
        </div>
      </div>

      {/* Dialog d'upload/édition */}
      <DownloadUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={loadDownloads}
        editingItem={editingItem}
      />

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce fichier ? Cette action est irréversible
              et supprimera également le fichier du stockage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
