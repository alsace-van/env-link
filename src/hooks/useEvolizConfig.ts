// ============================================
// HOOK useEvolizConfig
// Gestion des credentials Evoliz (localStorage)
// ============================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { evolizApi, initializeEvolizApi } from "@/services/evolizService";
import type { EvolizCredentials, EvolizCredentialsInput } from "@/types/evoliz.types";
import { useToast } from "@/hooks/use-toast";

interface UseEvolizConfigReturn {
  credentials: EvolizCredentials | null;
  isLoading: boolean;
  isConfigured: boolean;
  isTesting: boolean;
  testResult: { success: boolean; message: string } | null;
  saveCredentials: (input: EvolizCredentialsInput) => Promise<boolean>;
  testConnection: () => Promise<boolean>;
  deleteCredentials: () => Promise<boolean>;
  refreshCredentials: () => Promise<void>;
}

// LocalStorage key
const CREDENTIALS_STORAGE_KEY = "evoliz_credentials";

const loadCredentialsFromStorage = (userId: string): EvolizCredentials | null => {
  try {
    const stored = localStorage.getItem(`${CREDENTIALS_STORAGE_KEY}_${userId}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const saveCredentialsToStorage = (userId: string, credentials: EvolizCredentials) => {
  localStorage.setItem(`${CREDENTIALS_STORAGE_KEY}_${userId}`, JSON.stringify(credentials));
};

const deleteCredentialsFromStorage = (userId: string) => {
  localStorage.removeItem(`${CREDENTIALS_STORAGE_KEY}_${userId}`);
};

export function useEvolizConfig(): UseEvolizConfigReturn {
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<EvolizCredentials | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Récupérer l'utilisateur connecté
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Charger les credentials au montage
  const loadCredentials = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      const storedCredentials = loadCredentialsFromStorage(userId);

      if (storedCredentials) {
        setCredentials(storedCredentials);
        // Initialiser le service API
        initializeEvolizApi(storedCredentials);
      }
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadCredentials();
    } else {
      setIsLoading(false);
    }
  }, [userId, loadCredentials]);

  // Sauvegarder les credentials
  const saveCredentials = useCallback(
    async (input: EvolizCredentialsInput): Promise<boolean> => {
      if (!userId) {
        toast({
          title: "Erreur",
          description: "Vous devez être connecté",
          variant: "destructive",
        });
        return false;
      }

      setIsLoading(true);

      try {
        const newCredentials: EvolizCredentials = {
          id: `${userId}_credentials`,
          user_id: userId,
          company_id: input.company_id,
          public_key: input.public_key,
          secret_key: input.secret_key,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        saveCredentialsToStorage(userId, newCredentials);
        setCredentials(newCredentials);
        initializeEvolizApi(newCredentials);

        toast({
          title: "Succès",
          description: "Configuration Evoliz enregistrée",
        });

        return true;
      } catch (err) {
        console.error("Erreur sauvegarde credentials:", err);
        toast({
          title: "Erreur",
          description: "Impossible de sauvegarder la configuration",
          variant: "destructive",
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, toast],
  );

  // Tester la connexion
  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!evolizApi.hasConfig()) {
      setTestResult({ success: false, message: "Configuration manquante" });
      return false;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await evolizApi.testConnection();
      setTestResult(result);

      // Mettre à jour le statut du test en localStorage
      if (credentials && userId) {
        const updatedCredentials = {
          ...credentials,
          last_test_at: new Date().toISOString(),
          last_test_success: result.success,
        };
        saveCredentialsToStorage(userId, updatedCredentials);
        setCredentials(updatedCredentials);
      }

      if (result.success) {
        toast({
          title: "Connexion réussie",
          description: "La connexion à Evoliz fonctionne correctement",
        });
      } else {
        toast({
          title: "Échec de connexion",
          description: result.message,
          variant: "destructive",
        });
      }

      return result.success;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setTestResult({ success: false, message });
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsTesting(false);
    }
  }, [credentials, userId, toast]);

  // Supprimer les credentials
  const deleteCredentials = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    try {
      deleteCredentialsFromStorage(userId);
      setCredentials(null);
      evolizApi.clearConfig();
      setTestResult(null);

      toast({
        title: "Succès",
        description: "Configuration Evoliz supprimée",
      });

      return true;
    } catch (err) {
      console.error("Erreur suppression credentials:", err);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la configuration",
        variant: "destructive",
      });
      return false;
    }
  }, [userId, toast]);

  return {
    credentials,
    isLoading,
    isConfigured: credentials !== null,
    isTesting,
    testResult,
    saveCredentials,
    testConnection,
    deleteCredentials,
    refreshCredentials: loadCredentials,
  };
}
