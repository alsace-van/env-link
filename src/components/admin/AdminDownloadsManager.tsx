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

      if (dbError) thro