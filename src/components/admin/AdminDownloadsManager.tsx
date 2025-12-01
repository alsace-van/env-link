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

      const { data, error: fetchError } = await (supabase as any)
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
      if (itemToDelete.file_url?.includes('downloads')) {
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
      const { error: dbError } = await (supabase as any)
        .from('downloads')
        .delete()
        .eq('id', deleteItemId);

      if (dbError) throw dbError;

      toast.success('Téléchargement supprimé');
      setDeleteItemId(null);
      loadDownloads();
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const toggleFeatured = async (item: DownloadItem) => {
    try {
      const { error } = await (supabase as any)
        .from('downloads')
        .update({ is_featured: !item.is_featured })
        .eq('id', item.id);

      if (error) throw error;

      toast.success(item.is_featured ? 'Retiré des favoris' : 'Ajouté aux favoris');
      loadDownloads();
    } catch (err) {
      console.error('Erreur:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const toggleActive = async (item: DownloadItem) => {
    try {
      const { error } = await (supabase as any)
        .from('downloads')
        .update({ is_active: !item.is_active })
        .eq('id', item.id);

      if (error) throw error;

      toast.success(item.is_active ? 'Désactivé' : 'Activé');
      loadDownloads();
    } catch (err) {
      console.error('Erreur:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat?.icon || '📦';
  };

  const getPlatformLabel = (platform: string) => {
    const plat = PLATFORMS.find(p => p.value === platform);
    return plat?.label || platform;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        <AlertCircle className="h-5 w-5 mr-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm bg-background"
          >
            <option value="all">Toutes les catégories</option>
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => { setEditingItem(null); setUploadDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </div>

      <div className="grid gap-4">
        {filteredDownloads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucun téléchargement trouvé
          </div>
        ) : (
          filteredDownloads.map(item => (
            <div
              key={item.id}
              className={`border rounded-lg p-4 ${!item.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{getCategoryIcon(item.category)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{item.name}</h3>
                      <Badge variant="outline">{item.version}</Badge>
                      {item.is_featured && (
                        <Badge className="bg-yellow-500">Favoris</Badge>
                      )}
                      {!item.is_active && (
                        <Badge variant="secondary">Inactif</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{getPlatformLabel(item.platform)}</span>
                      <span>{formatFileSize(item.file_size)}</span>
                      <span>{item.download_count} téléchargements</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleFeatured(item)}
                    title={item.is_featured ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    {item.is_featured ? (
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    ) : (
                      <StarOff className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleActive(item)}
                    title={item.is_active ? 'Désactiver' : 'Activer'}
                  >
                    <Eye className={`h-4 w-4 ${item.is_active ? '' : 'text-muted-foreground'}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setEditingItem(item); setUploadDialogOpen(true); }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteItemId(item.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <DownloadUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        editingItem={editingItem}
        onSuccess={() => {
          setUploadDialogOpen(false);
          setEditingItem(null);
          loadDownloads();
        }}
      />

      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le fichier et toutes les données associées seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
