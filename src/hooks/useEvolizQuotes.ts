// ============================================
// HOOK useEvolizQuotes
// Gestion des devis Evoliz
// ============================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { evolizApi } from "@/services/evolizService";
import type { EvolizQuote, EvolizQuoteInput, EvolizQuoteCache, EvolizApiResponse } from "@/types/evoliz.types";
import { useToast } from "@/hooks/use-toast";

interface UseEvolizQuotesReturn {
  quotes: EvolizQuote[];
  cachedQuotes: EvolizQuoteCache[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  // Actions API Evoliz
  fetchQuotes: (params?: { status?: string; clientid?: number }) => Promise<void>;
  fetchQuote: (quoteId: number) => Promise<EvolizQuote | null>;
  createQuote: (data: EvolizQuoteInput) => Promise<EvolizQuote | null>;
  sendQuote: (quoteId: number, email?: string) => Promise<boolean>;

  // Actions Cache/Sync
  syncQuotesToCache: () => Promise<void>;
  getCachedQuotes: () => Promise<void>;
  linkQuoteToProject: (quoteId: number, projectId: string) => Promise<boolean>;

  // Helpers
  getQuoteById: (quoteId: number) => EvolizQuote | undefined;
}

// LocalStorage keys
const QUOTES_CACHE_KEY = "evoliz_quotes_cache";

const loadCacheFromStorage = (userId: string): EvolizQuoteCache[] => {
  try {
    const stored = localStorage.getItem(`${QUOTES_CACHE_KEY}_${userId}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveCacheToStorage = (userId: string, cache: EvolizQuoteCache[]) => {
  localStorage.setItem(`${QUOTES_CACHE_KEY}_${userId}`, JSON.stringify(cache));
};

export function useEvolizQuotes(): UseEvolizQuotesReturn {
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<EvolizQuote[]>([]);
  const [cachedQuotes, setCachedQuotes] = useState<EvolizQuoteCache[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Récupérer les devis depuis Evoliz
  const fetchQuotes = useCallback(
    async (params?: { status?: string; clientid?: number }) => {
      if (!evolizApi.hasConfig()) {
        setError("Evoliz non configuré");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        let allQuotes: EvolizQuote[] = [];
        let page = 1;
        let hasMore = true;

        // Pagination automatique
        while (hasMore) {
          const response: EvolizApiResponse<EvolizQuote[]> = await evolizApi.getQuotes({
            ...params,
            page,
            per_page: 50,
          });

          allQuotes = [...allQuotes, ...response.data];

          if (response.meta) {
            hasMore = page < response.meta.last_page;
            page++;
          } else {
            hasMore = false;
          }

          // Sécurité : max 10 pages
          if (page > 10) hasMore = false;
        }

        setQuotes(allQuotes);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur de chargement";
        setError(message);
        toast({
          title: "Erreur",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  // Récupérer un devis spécifique
  const fetchQuote = useCallback(async (quoteId: number): Promise<EvolizQuote | null> => {
    if (!evolizApi.hasConfig()) {
      setError("Evoliz non configuré");
      return null;
    }

    try {
      const quote = await evolizApi.getQuote(quoteId);

      // Mettre à jour le cache local
      setQuotes((prev) => {
        const index = prev.findIndex((q) => q.quoteid === quoteId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = quote;
          return updated;
        }
        return [...prev, quote];
      });

      return quote;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur de chargement";
      setError(message);
      return null;
    }
  }, []);

  // Créer un devis
  const createQuote = useCallback(
    async (data: EvolizQuoteInput): Promise<EvolizQuote | null> => {
      if (!evolizApi.hasConfig()) {
        toast({
          title: "Erreur",
          description: "Evoliz non configuré",
          variant: "destructive",
        });
        return null;
      }

      setIsLoading(true);

      try {
        const quote = await evolizApi.createQuote(data);

        setQuotes((prev) => [quote, ...prev]);

        toast({
          title: "Succès",
          description: `Devis ${quote.documentid} créé`,
        });

        return quote;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur de création";
        toast({
          title: "Erreur",
          description: message,
          variant: "destructive",
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  // Envoyer un devis par email
  const sendQuote = useCallback(
    async (quoteId: number, email?: string): Promise<boolean> => {
      if (!evolizApi.hasConfig()) {
        toast({
          title: "Erreur",
          description: "Evoliz non configuré",
          variant: "destructive",
        });
        return false;
      }

      try {
        await evolizApi.sendQuote(quoteId, email);

        // Rafraîchir le devis pour avoir le nouveau statut
        await fetchQuote(quoteId);

        toast({
          title: "Succès",
          description: "Devis envoyé par email",
        });

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur d'envoi";
        toast({
          title: "Erreur",
          description: message,
          variant: "destructive",
        });
        return false;
      }
    },
    [fetchQuote, toast],
  );

  // Synchroniser les devis vers le cache localStorage
  const syncQuotesToCache = useCallback(async () => {
    if (!userId || quotes.length === 0) return;

    setIsSyncing(true);

    try {
      const cacheEntries: EvolizQuoteCache[] = quotes.map((quote) => ({
        id: `${userId}_${quote.quoteid}`,
        user_id: userId,
        evoliz_quote_id: quote.quoteid,
        evoliz_client_id: quote.clientid,
        quote_number: quote.documentid,
        title: quote.object || quote.label,
        status: quote.status,
        total_ht: quote.total.totalht,
        total_ttc: quote.total.totalttc,
        currency: quote.currency,
        issue_date: quote.documentdate,
        validity_date: quote.duedate,
        raw_data: quote,
        synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      saveCacheToStorage(userId, cacheEntries);
      setCachedQuotes(cacheEntries);

      toast({
        title: "Synchronisation terminée",
        description: `${quotes.length} devis synchronisés`,
      });
    } catch (err) {
      console.error("Erreur sync:", err);
      toast({
        title: "Erreur",
        description: "Impossible de synchroniser les devis",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [userId, quotes, toast]);

  // Récupérer les devis en cache (localStorage)
  const getCachedQuotes = useCallback(async () => {
    if (!userId) return;
    const storedCache = loadCacheFromStorage(userId);
    setCachedQuotes(storedCache);
  }, [userId]);

  // Charger le cache au démarrage
  useEffect(() => {
    if (userId) {
      getCachedQuotes();
    }
  }, [userId, getCachedQuotes]);

  // Lier un devis à un projet VPB
  const linkQuoteToProject = useCallback(
    async (quoteId: number, projectId: string): Promise<boolean> => {
      if (!userId) return false;

      try {
        const currentCache = loadCacheFromStorage(userId);
        const updatedCache = currentCache.map((q) =>
          q.evoliz_quote_id === quoteId ? { ...q, project_id: projectId } : q
        );

        saveCacheToStorage(userId, updatedCache);
        setCachedQuotes(updatedCache);

        toast({
          title: "Succès",
          description: "Devis lié au projet",
        });

        return true;
      } catch (err) {
        console.error("Erreur liaison:", err);
        toast({
          title: "Erreur",
          description: "Impossible de lier le devis",
          variant: "destructive",
        });
        return false;
      }
    },
    [userId, toast],
  );

  // Helper pour trouver un devis
  const getQuoteById = useCallback(
    (quoteId: number): EvolizQuote | undefined => {
      return quotes.find((q) => q.quoteid === quoteId);
    },
    [quotes],
  );

  return {
    quotes,
    cachedQuotes,
    isLoading,
    isSyncing,
    error,
    fetchQuotes,
    fetchQuote,
    createQuote,
    sendQuote,
    syncQuotesToCache,
    getCachedQuotes,
    linkQuoteToProject,
    getQuoteById,
  };
}
