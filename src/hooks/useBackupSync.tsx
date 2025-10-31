import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type BackupProvider = "supabase" | "local" | "cloud";

export interface BackupSettings {
  supabase: boolean;
  local: boolean;
  cloud: boolean;
  cloudProvider?: "google-drive" | "dropbox" | "onedrive";
  cloudToken?: string;
}

const BACKUP_SETTINGS_KEY = "backup_settings";
const LOCAL_BACKUP_PREFIX = "local_backup_";

export const useBackupSync = (userId: string | undefined) => {
  const [settings, setSettings] = useState<BackupSettings>({
    supabase: true,
    local: true,
    cloud: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

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

  const saveToLocal = async (table: string, data: any) => {
    if (!settings.local) return;
    
    try {
      const key = `${LOCAL_BACKUP_PREFIX}${table}`;
      const existing = localStorage.getItem(key);
      const existingData = existing ? JSON.parse(existing) : [];
      
      localStorage.setItem(key, JSON.stringify([...existingData, {
        ...data,
        _backup_timestamp: new Date().toISOString()
      }]));
    } catch (error) {
      console.error("Erreur sauvegarde locale:", error);
    }
  };

  const saveToSupabase = async (table: string, data: any) => {
    if (!settings.supabase || !userId) return;
    
    try {
      const { error } = await supabase
        .from(table as any)
        .insert({ ...data, user_id: userId });
      
      if (error) throw error;
    } catch (error) {
      console.error("Erreur sauvegarde Supabase:", error);
      throw error;
    }
  };

  const saveToCloud = async (table: string, data: any) => {
    if (!settings.cloud || !settings.cloudProvider) return;
    
    // Placeholder pour l'intégration cloud personnalisée
    toast.info("Sauvegarde cloud à configurer");
  };

  const syncData = async (table: string, data: any) => {
    setLoading(true);
    const errors: string[] = [];

    try {
      if (settings.supabase) {
        await saveToSupabase(table, data);
      }
    } catch (error) {
      errors.push("Supabase");
    }

    try {
      if (settings.local) {
        await saveToLocal(table, data);
      }
    } catch (error) {
      errors.push("Local");
    }

    try {
      if (settings.cloud) {
        await saveToCloud(table, data);
      }
    } catch (error) {
      errors.push("Cloud");
    }

    setLoading(false);

    if (errors.length === 0) {
      toast.success("Données sauvegardées avec succès");
    } else {
      toast.error(`Erreurs: ${errors.join(", ")}`);
    }
  };

  const exportLocalBackup = () => {
    const allBackups: Record<string, any> = {};
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LOCAL_BACKUP_PREFIX)) {
        const tableName = key.replace(LOCAL_BACKUP_PREFIX, "");
        allBackups[tableName] = JSON.parse(localStorage.getItem(key) || "[]");
      }
    }

    const blob = new Blob([JSON.stringify(allBackups, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Sauvegarde locale exportée");
  };

  const importLocalBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        Object.entries(data).forEach(([table, records]) => {
          localStorage.setItem(
            `${LOCAL_BACKUP_PREFIX}${table}`,
            JSON.stringify(records)
          );
        });
        toast.success("Sauvegarde importée avec succès");
      } catch (error) {
        toast.error("Erreur lors de l'import");
      }
    };
    reader.readAsText(file);
  };

  return {
    settings,
    updateSettings,
    syncData,
    exportLocalBackup,
    importLocalBackup,
    loading,
  };
};
