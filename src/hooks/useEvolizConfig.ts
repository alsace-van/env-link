// ============================================
// HOOK useEvolizConfig
// Gestion des credentials Evoliz
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { evolizApi, initializeEvolizApi } from '@/services/evolizService';
import type { EvolizCredentials, EvolizCredentialsInput } from '@/types/evoliz.types';
import { useToast } from '@/hooks/use-toast';

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

export function useEvolizConfig(): UseEvolizConfigReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [credentials, setCredentials] = useState<EvolizCredentials | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Charger les credentials au montage
  const loadCredentials = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('evoliz_credentials')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found, c'est OK
        console.error('Erreur chargement credentials Evoliz:', error);
      }

      if (data) {
        setCredentials(data as EvolizCredentials);
        // Initialiser le service API
        initializeEvolizApi(data as EvolizCredentials);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  // Sauvegarder les credentials
  const saveCredentials = useCallback(async (input: EvolizCredentialsInput): Promise<boolean> => {
    if (!user?.id) {
      toast({
        title: 'Erreur',
        description: 'Vous devez être connecté',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);

    try {
      // Désactiver les anciens credentials
      await supabase
        .from('evoliz_credentials')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Créer les nouveaux
      const { data, error } = await supabase
        .from('evoliz_credentials')
        .insert({
          user_id: user.id,
          company_id: input.company_id,
          public_key: input.public_key,
          secret_key: input.secret_key,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setCredentials(data as EvolizCredentials);
      initializeEvolizApi(data as EvolizCredentials);

      toast({
        title: 'Succès',
        description: 'Configuration Evoliz enregistrée',
      });

      return true;
    } catch (err) {
      console.error('Erreur sauvegarde credentials:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder la configuration',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast]);

  // Tester la connexion
  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!evolizApi.hasConfig()) {
      setTestResult({ success: false, message: 'Configuration manquante' });
      return false;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await evolizApi.testConnection();
      setTestResult(result);

      // Mettre à jour le statut du test en base
      if (credentials?.id) {
        await supabase
          .from('evoliz_credentials')
          .update({
            last_test_at: new Date().toISOString(),
            last_test_success: result.success,
          })
          .eq('id', credentials.id);
      }

      if (result.success) {
        toast({
          title: 'Connexion réussie',
          description: 'La connexion à Evoliz fonctionne correctement',
        });
      } else {
        toast({
          title: 'Échec de connexion',
          description: result.message,
          variant: 'destructive',
        });
      }

      return result.success;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setTestResult({ success: false, message });
      toast({
        title: 'Erreur',
        description: message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsTesting(false);
    }
  }, [credentials?.id, toast]);

  // Supprimer les credentials
  const deleteCredentials = useCallback(async (): Promise<boolean> => {
    if (!credentials?.id) return false;

    try {
      const { error } = await supabase
        .from('evoliz_credentials')
        .delete()
        .eq('id', credentials.id);

      if (error) throw error;

      setCredentials(null);
      evolizApi.clearConfig();
      setTestResult(null);

      toast({
        title: 'Succès',
        description: 'Configuration Evoliz supprimée',
      });

      return true;
    } catch (err) {
      console.error('Erreur suppression credentials:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la configuration',
        variant: 'destructive',
      });
      return false;
    }
  }, [credentials?.id, toast]);

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
