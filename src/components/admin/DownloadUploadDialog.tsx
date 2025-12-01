import React, { useState, useEffect } from 'react';
import { Upload, Loader2, X, FileIcon, Link } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

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
}

interface DownloadUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingItem?: DownloadItem | null;
}

const CATEGORIES = [
  { value: 'extension', label: 'Extension navigateur', icon: '🌐' },
  { value: 'plugin', label: 'Plugin Fusion 360', icon: '🔧' },
  { value: 'template', label: 'Template', icon: '📄' },
  { value: 'document', label: 'Document', icon: '📋' },
  { value: 'other', label: 'Autre', icon: '📦' },
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

export function DownloadUploadDialog({ open, onOpenChange, onSuccess, editingItem }: DownloadUploadDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    version: '',
    category: 'extension',
    platform: '',
    changelog: '',
    requirements: '',
    documentation_url: '',
    is_active: true,
    is_featured: false,
    sort_order: 0,
  });

  useEffect(() => {
    if (editingItem) {
      setFormData({
        name: editingItem.name || '',
        description: editingItem.description || '',
        version: editingItem.version || '',
        category: editingItem.category || 'extension',
        platform: editingItem.platform || '',
        changelog: editingItem.changelog || '',
        requirements: editingItem.requirements || '',
        documentation_url: editingItem.documentation_url || '',
        is_active: editingItem.is_active ?? true,
        is_featured: editingItem.is_featured ?? false,
        sort_order: editingItem.sort_order || 0,
      });
      setSelectedFile(null);
    } else {
      setFormData({
        name: '',
        description: '',
        version: '1.0.0',
        category: 'extension',
        platform: '',
        changelog: '',
        requirements: '',
        documentation_url: '',
        is_active: true,
        is_featured: false,
        sort_order: 0,
      });
      setSelectedFile(null);
    }
  }, [editingItem, open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-remplir le nom si vide
      if (!formData.name) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setFormData(prev => ({ ...prev, name: nameWithoutExt }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Le nom est obligatoire');
      return;
    }

    if (!editingItem && !selectedFile) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    setIsLoading(true);

    try {
      let fileUrl = editingItem?.file_url || '';
      let fileName = editingItem?.file_name || '';
      let fileSize = editingItem?.file_size || 0;
      let fileType = editingItem?.file_type || '';

      // Upload du nouveau fichier si sélectionné
      if (selectedFile) {
        // Générer un nom unique
        const timestamp = Date.now();
        const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${timestamp}_${cleanName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('downloads')
          .upload(storagePath, selectedFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Obtenir l'URL publique
        const { data: { publicUrl } } = supabase.storage
          .from('downloads')
          .getPublicUrl(storagePath);

        fileUrl = publicUrl;
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
        fileType = selectedFile.name.split('.').pop()?.toLowerCase() || '';

        // Supprimer l'ancien fichier si édition
        if (editingItem?.file_url && editingItem.file_url !== fileUrl) {
          const oldPath = editingItem.file_url.split('/').pop();
          if (oldPath) {
            await supabase.storage.from('downloads').remove([oldPath]);
          }
        }
      }

      const downloadData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        version: formData.version.trim(),
        category: formData.category,
        platform: formData.platform || null,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType,
        changelog: formData.changelog.trim(),
        requirements: formData.requirements.trim(),
        documentation_url: formData.documentation_url.trim() || null,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        sort_order: formData.sort_order,
        updated_at: new Date().toISOString(),
      };

      if (editingItem) {
        // Mise à jour
        const { error } = await (supabase as any)
          .from('downloads')
          .update(downloadData)
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success('Téléchargement mis à jour');
      } else {
        // Création
        const { error } = await (supabase as any)
          .from('downloads')
          .insert(downloadData);

        if (error) throw error;
        toast.success('Téléchargement ajouté');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erreur:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? 'Modifier le téléchargement' : 'Ajouter un téléchargement'}
          </DialogTitle>
          <DialogDescription>
            {editingItem 
              ? 'Modifiez les informations du fichier' 
              : 'Ajoutez une extension, un plugin ou tout autre fichier à télécharger'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Fichier */}
          <div className="space-y-2">
            <Label>Fichier {!editingItem && '*'}</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                accept=".zip,.exe,.msi,.pdf,.doc,.docx,.xls,.xlsx,.py,.js"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileIcon className="w-8 h-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.preventDefault(); setSelectedFile(null); }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Cliquez pour sélectionner un fichier
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ZIP, EXE, PDF, DOC, XLS, PY, JS...
                    </p>
                    {editingItem && (
                      <p className="text-xs text-primary mt-2">
                        Fichier actuel : {editingItem.file_name}
                      </p>
                    )}
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Nom et version */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Van Price Buddy"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                placeholder="1.0.0"
              />
            </div>
          </div>

          {/* Catégorie et plateforme */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plateforme</Label>
              <Select
                value={formData.platform}
                onValueChange={(value) => setFormData({ ...formData, platform: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((plat) => (
                    <SelectItem key={plat.value} value={plat.value}>
                      {plat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description du fichier, ses fonctionnalités..."
              rows={3}
            />
          </div>

          {/* Prérequis */}
          <div className="space-y-2">
            <Label htmlFor="requirements">Prérequis</Label>
            <Input
              id="requirements"
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              placeholder="Opera 90+, Fusion 360 2024..."
            />
          </div>

          {/* Changelog */}
          <div className="space-y-2">
            <Label htmlFor="changelog">Notes de version / Changelog</Label>
            <Textarea
              id="changelog"
              value={formData.changelog}
              onChange={(e) => setFormData({ ...formData, changelog: e.target.value })}
              placeholder="- Nouvelle fonctionnalité X&#10;- Correction du bug Y&#10;- Amélioration de Z"
              rows={3}
            />
          </div>

          {/* Documentation URL */}
          <div className="space-y-2">
            <Label htmlFor="documentation_url">Lien documentation</Label>
            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="documentation_url"
                value={formData.documentation_url}
                onChange={(e) => setFormData({ ...formData, documentation_url: e.target.value })}
                placeholder="https://docs.example.com"
                className="pl-10"
              />
            </div>
          </div>

          {/* Ordre d'affichage */}
          <div className="space-y-2">
            <Label htmlFor="sort_order">Ordre d'affichage</Label>
            <Input
              id="sort_order"
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">Plus petit = affiché en premier</p>
          </div>

          {/* Options */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Actif</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_featured"
                checked={formData.is_featured}
                onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
              />
              <Label htmlFor="is_featured">Mis en avant</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingItem ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
