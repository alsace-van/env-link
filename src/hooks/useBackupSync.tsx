// ============================================
// useBackupSync.tsx
// Hook pour la gestion des sauvegardes multi-destinations
// VERSION: 2.0 - Ajout dossier local + cloud personnel
// ============================================

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type BackupProvider = "supabase" | "local" | "cloud" | "filesystem";

export interface BackupSettings {
  supabase: boolean;
  local: boolean;
  cloud: boolean;
  filesystem: boolean;
  cloudProvider?: "google-drive" | "dropbox" | "onedrive" | "webdav" | "custom";
  cloudUrl?: string;
  cloudToken?: string;
  cloudUsername?: string;
  cloudPassword?: string;
  filesystemPath?: string;
  autoBackupInterval?: number; // en minutes, 0 = désactivé
  lastBackup?: string;
}

const BACKUP_SETTINGS_KEY = "backup_settings";
const LOCAL_BACKUP_PREFIX = "local_backup_";

export const useBackupSync = (userId: string | undefined) => {
  const [settings, setSettings] = useState<BackupSettings>({
    supabase: true,
    local: true,
    cloud: false,
    filesystem: false,
  });
  const [loading, setLoading] = useState(false);
  const [filesystemHandle, setFilesystemHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const autoBackupRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadSettings();
    return () => {
      if (autoBackupRef.current) {
        clearInterval(autoBackupRef.current);
      }
    };
  }, []);

  // Configurer la sauvegarde automatique
  useEffect(() => {
    if (autoBackupRef.current) {
      clearInterval(autoBackupRef.current);
    }

    if (settings.autoBackupInterval && settings.autoBackupInterval > 0) {
      autoBackupRef.current = setInterval(
        () => {
          exportFullBackup();
        },
        settings.autoBackupInterval * 60 * 1000,
      );
    }
  }, [settings.autoBackupInterval]);

  const loadSettings = () => {
    const saved = localStorage.getItem(BACKUP_SETTINGS_KEY);
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  };

  const updateSettings = (newSettings: Partial<BackupSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(updated));
    toast.success("Paramètres de sauvegarde mis à jour");
  };

  // ============================================
  // DOSSIER LOCAL (File System Access API)
  // ============================================

  const selectLocalFolder = async (): Promise<boolean> => {
    try {
      // Vérifier si l'API est supportée
      if (!("showDirectoryPicker" in window)) {
        toast.error("Votre navigateur ne supporte pas cette fonctionnalité. Utilisez Chrome ou Edge.");
        return false;
      }

      const handle = await (window as any).showDirectoryPicker({
        mode: "readwrite",
        startIn: "documents",
      });

      setFilesystemHandle(handle);
      updateSettings({
        filesystem: true,
        filesystemPath: handle.name,
      });
      toast.success(`Dossier "${handle.name}" sélectionné`);
      return true;
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Erreur sélection dossier:", error);
        toast.error("Erreur lors de la sélection du dossier");
      }
      return false;
    }
  };

  const saveToFilesystem = async (filename: string, data: any): Promise<boolean> => {
    if (!filesystemHandle) {
      toast.error("Aucun dossier sélectionné");
      return false;
    }

    try {
      const fileHandle = await filesystemHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      return true;
    } catch (error) {
      console.error("Erreur écriture fichier:", error);
      toast.error("Erreur lors de l'écriture du fichier");
      return false;
    }
  };

  // ============================================
  // CLOUD PERSONNEL
  // ============================================

  const saveToCloud = async (filename: string, data: any): Promise<boolean> => {
    if (!settings.cloud || !settings.cloudProvider) return false;

    try {
      switch (settings.cloudProvider) {
        case "webdav":
          return await saveToWebDAV(filename, data);
        case "custom":
          return await saveToCustomEndpoint(filename, data);
        default:
          // Google Drive, Dropbox, OneDrive nécessitent OAuth
          toast.info(`${settings.cloudProvider} nécessite une configuration OAuth`);
          return false;
      }
    } catch (error) {
      console.error("Erreur sauvegarde cloud:", error);
      return false;
    }
  };

  const saveToWebDAV = async (filename: string, data: any): Promise<boolean> => {
    if (!settings.cloudUrl) {
      toast.error("URL WebDAV non configurée");
      return false;
    }

    try {
      const url = `${settings.cloudUrl.replace(/\/$/, "")}/${filename}`;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (settings.cloudUsername && settings.cloudPassword) {
        const auth = btoa(`${settings.cloudUsername}:${settings.cloudPassword}`);
        headers["Authorization"] = `Basic ${auth}`;
      }

      const response = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(data, null, 2),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error("Erreur WebDAV:", error);
      toast.error("Erreur de connexion WebDAV");
      return false;
    }
  };

  const saveToCustomEndpoint = async (filename: string, data: any): Promise<boolean> => {
    if (!settings.cloudUrl) {
      toast.error("URL du endpoint non configurée");
      return false;
    }

    try {
      const response = await fetch(settings.cloudUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(settings.cloudToken ? { Authorization: `Bearer ${settings.cloudToken}` } : {}),
        },
        body: JSON.stringify({
          filename,
          data,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error("Erreur endpoint:", error);
      toast.error("Erreur de connexion au serveur");
      return false;
    }
  };

  // ============================================
  // SAUVEGARDE LOCALE (localStorage)
  // ============================================

  const saveToLocal = async (table: string, data: any) => {
    if (!settings.local) return;

    try {
      const key = `${LOCAL_BACKUP_PREFIX}${table}`;
      const existing = localStorage.getItem(key);
      const existingData = existing ? JSON.parse(existing) : [];

      localStorage.setItem(
        key,
        JSON.stringify([
          ...existingData,
          {
            ...data,
            _backup_timestamp: new Date().toISOString(),
          },
        ]),
      );
    } catch (error) {
      console.error("Erreur sauvegarde locale:", error);
    }
  };

  // ============================================
  // SAUVEGARDE SUPABASE
  // ============================================

  const saveToSupabase = async (table: string, data: any) => {
    if (!settings.supabase || !userId) return;

    try {
      const { error } = await supabase.from(table as any).insert({ ...data, user_id: userId });

      if (error) throw error;
    } catch (error) {
      console.error("Erreur sauvegarde Supabase:", error);
      throw error;
    }
  };

  // ============================================
  // SYNCHRONISATION MULTI-DESTINATIONS
  // ============================================

  const syncData = async (table: string, data: any) => {
    setLoading(true);
    const errors: string[] = [];
    const successes: string[] = [];

    // Supabase
    if (settings.supabase) {
      try {
        await saveToSupabase(table, data);
        successes.push("Backend");
      } catch (error) {
        errors.push("Backend");
      }
    }

    // Local (localStorage)
    if (settings.local) {
      try {
        await saveToLocal(table, data);
        successes.push("Navigateur");
      } catch (error) {
        errors.push("Navigateur");
      }
    }

    // Dossier local (File System)
    if (settings.filesystem && filesystemHandle) {
      const filename = `${table}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      const success = await saveToFilesystem(filename, data);
      if (success) {
        successes.push("Dossier local");
      } else {
        errors.push("Dossier local");
      }
    }

    // Cloud personnel
    if (settings.cloud && settings.cloudProvider) {
      const filename = `${table}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      const success = await saveToCloud(filename, data);
      if (success) {
        successes.push("Cloud");
      } else {
        errors.push("Cloud");
      }
    }

    setLoading(false);
    updateSettings({ lastBackup: new Date().toISOString() });

    if (errors.length === 0 && successes.length > 0) {
      toast.success(`Sauvegardé: ${successes.join(", ")}`);
    } else if (errors.length > 0 && successes.length > 0) {
      toast.warning(`Partiel - OK: ${successes.join(", ")} | Erreurs: ${errors.join(", ")}`);
    } else if (errors.length > 0) {
      toast.error(`Erreurs: ${errors.join(", ")}`);
    }
  };

  // ============================================
  // EXPORT/IMPORT COMPLET
  // ============================================

  const exportFullBackup = async () => {
    const allBackups: Record<string, any> = {};

    // Collecter les données du localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LOCAL_BACKUP_PREFIX)) {
        const tableName = key.replace(LOCAL_BACKUP_PREFIX, "");
        allBackups[tableName] = JSON.parse(localStorage.getItem(key) || "[]");
      }
    }

    const backupData = {
      version: "2.0",
      timestamp: new Date().toISOString(),
      userId,
      data: allBackups,
    };

    // Sauvegarder dans le dossier local si configuré
    if (settings.filesystem && filesystemHandle) {
      const filename = `backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      await saveToFilesystem(filename, backupData);
    }

    // Sauvegarder dans le cloud si configuré
    if (settings.cloud && settings.cloudProvider) {
      const filename = `backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      await saveToCloud(filename, backupData);
    }

    // Toujours proposer le téléchargement
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vpb-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Sauvegarde complète exportée");
  };

  const exportLocalBackup = () => {
    exportFullBackup();
  };

  const importLocalBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const data = parsed.data || parsed; // Support ancien et nouveau format

        Object.entries(data).forEach(([table, records]) => {
          localStorage.setItem(`${LOCAL_BACKUP_PREFIX}${table}`, JSON.stringify(records));
        });
        toast.success("Sauvegarde importée avec succès");
      } catch (error) {
        toast.error("Erreur lors de l'import");
      }
    };
    reader.readAsText(file);
  };

  // ============================================
  // TEST DE CONNEXION
  // ============================================

  const testCloudConnection = async (): Promise<boolean> => {
    if (!settings.cloudProvider || !settings.cloudUrl) {
      toast.error("Configuration cloud incomplète");
      return false;
    }

    try {
      const testData = { test: true, timestamp: new Date().toISOString() };
      const success = await saveToCloud("_connection_test.json", testData);

      if (success) {
        toast.success("Connexion cloud réussie !");
      }
      return success;
    } catch (error) {
      toast.error("Échec du test de connexion");
      return false;
    }
  };

  return {
    settings,
    updateSettings,
    syncData,
    exportLocalBackup,
    exportFullBackup,
    importLocalBackup,
    loading,
    // Nouvelles fonctions
    selectLocalFolder,
    filesystemHandle,
    testCloudConnection,
  };
};
