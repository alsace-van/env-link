// ============================================
// HOOK useEvolizClients
// Gestion des clients Evoliz avec synchro bidirectionnelle
// ============================================

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { evolizApi } from '@/services/evolizService';
import type { 
  EvolizClient, 
  EvolizClientInput,
  EvolizClientMapping,
  EvolizApiResponse 
} from '@/types/evoliz.types';
import { useToast } from '@/hooks/use-toast';

interface UseEvolizClientsReturn {
  clients: EvolizClient[];
  mappings: EvolizClientMapping[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  
  // Actions API Evoliz
  fetchClients: (params?: { search?: string }) => Promise<void>;
  fetchClient: (clientId: number) => Promise<EvolizClient | null>;
  createClient: (data: EvolizClientInput) => Promise<EvolizClient | null>;
  updateClient: (clientId: number, data: Partial<EvolizClientInput>) => Promise<EvolizClient | null>;
  
  // Actions Mapping/Sync
  getMappings: () => Promise<void>;
  linkClientToVPB: (evolizClientId: number, vpbClientId: string) => Promise<boolean>;
  unlinkClient: (evolizClientId: number) => Promise<boolean>;
  syncClientToEvoliz: (vpbClientId: string) => Promise<EvolizClient | null>;
  importClientFromEvoliz: (evolizClientId: number) => Promise<string | null>;
  
  // Helpers
  getClientById: (clientId: number) => EvolizClient | undefined;
  getMappingByEvolizId: (evolizClientId: number) => EvolizClientMapping | undefined;
  getMappingByVPBId: (vpbClientId: string) => EvolizClientMapping | undefined;
}

export function useEvolizClients(): UseEvolizClientsReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [clients, setClients] = useState<EvolizClient[]>([]);
  const [mappings, setMappings] = useState<EvolizClientMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Récupérer les clients depuis Evoliz
  const fetchClients = useCallback(async (params?: { search?: string }) => {
    if (!evolizApi.hasConfig()) {
      setError('Evoliz non configuré');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let allClients: EvolizClient[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response: EvolizApiResponse<EvolizClient[]> = await evolizApi.getClients({
          ...params,
          page,
          per_page: 50,
        });

        allClients = [...allClients, ...response.data];

        if (response.meta) {
          hasMore = page < response.meta.last_page;
          page++;
        } else {
          hasMore = false;
        }

        if (page > 10) hasMore = false;
      }

      setClients(allClients);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de chargement';
      setError(message);
      toast({
        title: 'Erreur',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Récupérer un client spécifique
  const fetchClient = useCallback(async (clientId: number): Promise<EvolizClient | null> => {
    if (!evolizApi.hasConfig()) {
      setError('Evoliz non configuré');
      return null;
    }

    try {
      const client = await evolizApi.getClient(clientId);
      
      setClients(prev => {
        const index = prev.findIndex(c => c.clientid === clientId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = client;
          return updated;
        }
        return [...prev, client];
      });

      return client;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de chargement';
      setError(message);
      return null;
    }
  }, []);

  // Créer un client dans Evoliz
  const createClient = useCallback(async (data: EvolizClientInput): Promise<EvolizClient | null> => {
    if (!evolizApi.hasConfig()) {
      toast({
        title: 'Erreur',
        description: 'Evoliz non configuré',
        variant: 'destructive',
      });
      return null;
    }

    setIsLoading(true);

    try {
      const client = await evolizApi.createClient(data);
      
      setClients(prev => [client, ...prev]);
      
      toast({
        title: 'Succès',
        description: `Client "${client.name}" créé dans Evoliz`,
      });

      return client;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de création';
      toast({
        title: 'Erreur',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Mettre à jour un client dans Evoliz
  const updateClient = useCallback(async (
    clientId: number, 
    data: Partial<EvolizClientInput>
  ): Promise<EvolizClient | null> => {
    if (!evolizApi.hasConfig()) {
      toast({
        title: 'Erreur',
        description: 'Evoliz non configuré',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const client = await evolizApi.updateClient(clientId, data);
      
      setClients(prev => prev.map(c => 
        c.clientid === clientId ? client : c
      ));
      
      toast({
        title: 'Succès',
        description: 'Client mis à jour',
      });

      return client;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de mise à jour';
      toast({
        title: 'Erreur',
        description: message,
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  // Récupérer les mappings VPB <-> Evoliz
  const getMappings = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('evoliz_clients_mapping')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      setMappings((data || []) as EvolizClientMapping[]);
    } catch (err) {
      console.error('Erreur chargement mappings:', err);
    }
  }, [user?.id]);

  // Lier un client Evoliz à un client VPB existant
  const linkClientToVPB = useCallback(async (
    evolizClientId: number,
    vpbClientId: string
  ): Promise<boolean> => {
    if (!user?.id) return false;

    const evolizClient = clients.find(c => c.clientid === evolizClientId);

    try {
      const { error } = await supabase
        .from('evoliz_clients_mapping')
        .upsert({
          user_id: user.id,
          vpb_client_id: vpbClientId,
          evoliz_client_id: evolizClientId,
          evoliz_client_name: evolizClient?.name,
          evoliz_client_email: evolizClient?.email,
          sync_direction: 'both',
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,evoliz_client_id',
        });

      if (error) throw error;

      await getMappings();

      toast({
        title: 'Succès',
        description: 'Client lié',
      });

      return true;
    } catch (err) {
      console.error('Erreur liaison:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de lier le client',
        variant: 'destructive',
      });
      return false;
    }
  }, [user?.id, clients, getMappings, toast]);

  // Délier un client
  const unlinkClient = useCallback(async (evolizClientId: number): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('evoliz_clients_mapping')
        .delete()
        .eq('user_id', user.id)
        .eq('evoliz_client_id', evolizClientId);

      if (error) throw error;

      await getMappings();

      toast({
        title: 'Succès',
        description: 'Liaison supprimée',
      });

      return true;
    } catch (err) {
      console.error('Erreur suppression liaison:', err);
      return false;
    }
  }, [user?.id, getMappings, toast]);

  // Synchroniser un client VPB vers Evoliz
  const syncClientToEvoliz = useCallback(async (vpbClientId: string): Promise<EvolizClient | null> => {
    if (!user?.id) return null;

    setIsSyncing(true);

    try {
      // Récupérer le client VPB
      const { data: vpbClient, error: vpbError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', vpbClientId)
        .single();

      if (vpbError || !vpbClient) {
        throw new Error('Client VPB non trouvé');
      }

      // Vérifier si déjà mappé
      const existingMapping = mappings.find(m => m.vpb_client_id === vpbClientId);

      const evolizData: EvolizClientInput = {
        name: `${vpbClient.first_name || ''} ${vpbClient.last_name || ''}`.trim() || vpbClient.company_name || 'Client',
        type: vpbClient.company_name ? 'Professionnel' : 'Particulier',
        email: vpbClient.email || undefined,
        phone: vpbClient.phone || undefined,
        addr: vpbClient.address || undefined,
        postcode: vpbClient.postal_code || undefined,
        town: vpbClient.city || undefined,
        siret: vpbClient.siret || undefined,
      };

      let evolizClient: EvolizClient;

      if (existingMapping) {
        // Mettre à jour
        const updated = await updateClient(existingMapping.evoliz_client_id, evolizData);
        if (!updated) throw new Error('Échec mise à jour Evoliz');
        evolizClient = updated;
      } else {
        // Créer
        const created = await createClient(evolizData);
        if (!created) throw new Error('Échec création Evoliz');
        evolizClient = created;

        // Créer le mapping
        await linkClientToVPB(created.clientid, vpbClientId);
      }

      return evolizClient;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de synchronisation';
      toast({
        title: 'Erreur',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [user?.id, mappings, createClient, updateClient, linkClientToVPB, toast]);

  // Importer un client Evoliz dans VPB
  const importClientFromEvoliz = useCallback(async (evolizClientId: number): Promise<string | null> => {
    if (!user?.id) return null;

    setIsSyncing(true);

    try {
      const evolizClient = clients.find(c => c.clientid === evolizClientId) 
        || await fetchClient(evolizClientId);

      if (!evolizClient) {
        throw new Error('Client Evoliz non trouvé');
      }

      // Vérifier si déjà importé
      const existingMapping = mappings.find(m => m.evoliz_client_id === evolizClientId);
      if (existingMapping?.vpb_client_id) {
        toast({
          title: 'Info',
          description: 'Ce client est déjà importé',
        });
        return existingMapping.vpb_client_id;
      }

      // Parser le nom
      const nameParts = evolizClient.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Créer dans VPB
      const { data: vpbClient, error: vpbError } = await supabase
        .from('clients')
        .insert({
          user_id: user.id,
          first_name: firstName,
          last_name: lastName,
          company_name: evolizClient.type === 'Professionnel' ? evolizClient.name : null,
          email: evolizClient.email,
          phone: evolizClient.phone || evolizClient.mobile,
          address: evolizClient.address?.addr,
          postal_code: evolizClient.address?.postcode,
          city: evolizClient.address?.town,
          siret: evolizClient.siret,
        })
        .select()
        .single();

      if (vpbError) throw vpbError;

      // Créer le mapping
      await linkClientToVPB(evolizClientId, vpbClient.id);

      toast({
        title: 'Succès',
        description: `Client "${evolizClient.name}" importé`,
      });

      return vpbClient.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur d\'import';
      toast({
        title: 'Erreur',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [user?.id, clients, mappings, fetchClient, linkClientToVPB, toast]);

  // Helpers
  const getClientById = useCallback((clientId: number): EvolizClient | undefined => {
    return clients.find(c => c.clientid === clientId);
  }, [clients]);

  const getMappingByEvolizId = useCallback((evolizClientId: number): EvolizClientMapping | undefined => {
    return mappings.find(m => m.evoliz_client_id === evolizClientId);
  }, [mappings]);

  const getMappingByVPBId = useCallback((vpbClientId: string): EvolizClientMapping | undefined => {
    return mappings.find(m => m.vpb_client_id === vpbClientId);
  }, [mappings]);

  return {
    clients,
    mappings,
    isLoading,
    isSyncing,
    error,
    fetchClients,
    fetchClient,
    createClient,
    updateClient,
    getMappings,
    linkClientToVPB,
    unlinkClient,
    syncClientToEvoliz,
    importClientFromEvoliz,
    getClientById,
    getMappingByEvolizId,
    getMappingByVPBId,
  };
}
