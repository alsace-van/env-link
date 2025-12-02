// Service d'indexation des documents (notices, docs DREAL)
// Extraction PDF → Découpage en chunks → Embeddings → Stockage pgvector

import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from "pdfjs-dist";

// Configurer le worker PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// ============================================
// TYPES
// ============================================

export interface IndexingProgress {
  status: "idle" | "extracting" | "chunking" | "embedding" | "storing" | "done" | "error";
  progress: number; // 0-100
  message: string;
  chunksTotal?: number;
  chunksProcessed?: number;
}

export interface DocumentChunk {
  content: string;
  chunkIndex: number;
  pageNumber?: number;
  metadata?: Record<string, any>;
}

export type SourceType = "notice" | "official_document";

// ============================================
// CONFIGURATION
// ============================================

const CHUNK_SIZE = 500; // Caractères par chunk
const CHUNK_OVERLAP = 50; // Chevauchement entre chunks
const EMBEDDING_DIMENSION = 768; // Gemini embedding dimension

// ============================================
// EXTRACTION TEXTE PDF
// ============================================

export async function extractTextFromPdf(
  pdfUrl: string,
  onProgress?: (progress: number) => void
): Promise<{ text: string; pages: { pageNumber: number; text: string }[] }> {
  try {
    // Charger le PDF
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    
    const pages: { pageNumber: number; text: string }[] = [];
    let fullText = "";
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      
      pages.push({ pageNumber: i, text: pageText });
      fullText += pageText + "\n\n";
      
      if (onProgress) {
        onProgress(Math.round((i / pdf.numPages) * 100));
      }
    }
    
    return { text: fullText.trim(), pages };
  } catch (error) {
    console.error("Erreur extraction PDF:", error);
    throw new Error("Impossible d'extraire le texte du PDF");
  }
}

// ============================================
// DÉCOUPAGE EN CHUNKS
// ============================================

export function splitIntoChunks(
  pages: { pageNumber: number; text: string }[]
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;
  
  for (const page of pages) {
    const text = page.text;
    
    if (text.length <= CHUNK_SIZE) {
      // Page courte → un seul chunk
      if (text.trim()) {
        chunks.push({
          content: text.trim(),
          chunkIndex: chunkIndex++,
          pageNumber: page.pageNumber,
        });
      }
    } else {
      // Page longue → découper avec chevauchement
      let start = 0;
      while (start < text.length) {
        let end = start + CHUNK_SIZE;
        
        // Essayer de couper à une fin de phrase
        if (end < text.length) {
          const lastPeriod = text.lastIndexOf(".", end);
          const lastNewline = text.lastIndexOf("\n", end);
          const cutPoint = Math.max(lastPeriod, lastNewline);
          
          if (cutPoint > start + CHUNK_SIZE / 2) {
            end = cutPoint + 1;
          }
        }
        
        const chunkText = text.substring(start, end).trim();
        if (chunkText) {
          chunks.push({
            content: chunkText,
            chunkIndex: chunkIndex++,
            pageNumber: page.pageNumber,
          });
        }
        
        start = end - CHUNK_OVERLAP;
        if (start < 0) start = 0;
        if (end >= text.length) break;
      }
    }
  }
  
  return chunks;
}

// ============================================
// GÉNÉRATION EMBEDDINGS
// ============================================

async function getEmbeddingProvider(): Promise<{ provider: string; apiKey: string | null }> {
  // Récupérer le provider configuré
  const { data: setting } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", "embedding_provider")
    .single();
  
  const provider = setting?.value || "gemini";
  
  // Récupérer la clé API depuis le localStorage (config utilisateur)
  const configStr = localStorage.getItem("ai_config");
  if (!configStr) {
    return { provider, apiKey: null };
  }
  
  const config = JSON.parse(configStr);
  const apiKey = provider === "gemini" ? config.geminiKey : config.openaiKey;
  
  return { provider, apiKey };
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const { provider, apiKey } = await getEmbeddingProvider();
  
  if (!apiKey) {
    throw new Error(`Clé API ${provider} non configurée. Allez dans Paramètres IA.`);
  }
  
  if (provider === "gemini") {
    return generateGeminiEmbedding(text, apiKey);
  } else if (provider === "openai") {
    return generateOpenAIEmbedding(text, apiKey);
  }
  
  throw new Error(`Provider embedding inconnu: ${provider}`);
}

async function generateGeminiEmbedding(text: string, apiKey: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Erreur Gemini embedding: ${response.status}`);
  }
  
  const data = await response.json();
  return data.embedding.values;
}

async function generateOpenAIEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Erreur OpenAI embedding: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

// ============================================
// INDEXATION COMPLÈTE D'UN DOCUMENT
// ============================================

export async function indexDocument(
  sourceType: SourceType,
  sourceId: string,
  sourceName: string,
  pdfUrl: string,
  userId: string,
  onProgress?: (progress: IndexingProgress) => void
): Promise<{ success: boolean; chunksCreated: number; error?: string }> {
  try {
    // 1. Extraction du texte
    onProgress?.({
      status: "extracting",
      progress: 0,
      message: "Extraction du texte du PDF...",
    });
    
    const { pages } = await extractTextFromPdf(pdfUrl, (p) => {
      onProgress?.({
        status: "extracting",
        progress: p * 0.3, // 0-30%
        message: `Extraction page ${Math.ceil(p / 100 * pages?.length || 1)}...`,
      });
    });
    
    if (!pages || pages.length === 0) {
      throw new Error("Aucun texte extrait du PDF");
    }
    
    // 2. Découpage en chunks
    onProgress?.({
      status: "chunking",
      progress: 30,
      message: "Découpage du texte...",
    });
    
    const chunks = splitIntoChunks(pages);
    
    if (chunks.length === 0) {
      throw new Error("Aucun chunk créé");
    }
    
    // 3. Supprimer les anciens chunks de ce document
    await (supabase as any)
      .from("document_chunks")
      .delete()
      .eq("source_type", sourceType)
      .eq("source_id", sourceId);
    
    // 4. Générer les embeddings et stocker
    onProgress?.({
      status: "embedding",
      progress: 35,
      message: `Génération des embeddings (0/${chunks.length})...`,
      chunksTotal: chunks.length,
      chunksProcessed: 0,
    });
    
    const chunkRecords = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Générer l'embedding
      const embedding = await generateEmbedding(chunk.content);
      
      chunkRecords.push({
        source_type: sourceType,
        source_id: sourceId,
        source_name: sourceName,
        content: chunk.content,
        chunk_index: chunk.chunkIndex,
        page_number: chunk.pageNumber,
        embedding: `[${embedding.join(",")}]`, // Format pgvector
        metadata: {},
        user_id: userId,
      });
      
      const progress = 35 + ((i + 1) / chunks.length) * 55; // 35-90%
      onProgress?.({
        status: "embedding",
        progress,
        message: `Génération des embeddings (${i + 1}/${chunks.length})...`,
        chunksTotal: chunks.length,
        chunksProcessed: i + 1,
      });
      
      // Petite pause pour éviter le rate limiting
      if (i % 5 === 0 && i > 0) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    
    // 5. Stocker les chunks
    onProgress?.({
      status: "storing",
      progress: 90,
      message: "Enregistrement en base de données...",
    });
    
    const { error: insertError } = await (supabase as any)
      .from("document_chunks")
      .insert(chunkRecords);
    
    if (insertError) {
      throw new Error(`Erreur stockage: ${insertError.message}`);
    }
    
    // 6. Marquer le document comme indexé
    const table = sourceType === "notice" ? "notices_database" : "official_documents";
    await (supabase as any)
      .from(table)
      .update({ is_indexed: true, indexed_at: new Date().toISOString() })
      .eq("id", sourceId);
    
    onProgress?.({
      status: "done",
      progress: 100,
      message: `Indexation terminée (${chunks.length} chunks)`,
      chunksTotal: chunks.length,
      chunksProcessed: chunks.length,
    });
    
    return { success: true, chunksCreated: chunks.length };
    
  } catch (error: any) {
    console.error("Erreur indexation:", error);
    onProgress?.({
      status: "error",
      progress: 0,
      message: error.message || "Erreur inconnue",
    });
    return { success: false, chunksCreated: 0, error: error.message };
  }
}

// ============================================
// SUPPRESSION INDEXATION
// ============================================

export async function removeIndexation(
  sourceType: SourceType,
  sourceId: string
): Promise<boolean> {
  try {
    // Supprimer les chunks
    await (supabase as any)
      .from("document_chunks")
      .delete()
      .eq("source_type", sourceType)
      .eq("source_id", sourceId);
    
    // Mettre à jour le document
    const table = sourceType === "notice" ? "notices_database" : "official_documents";
    await (supabase as any)
      .from(table)
      .update({ is_indexed: false, indexed_at: null })
      .eq("id", sourceId);
    
    return true;
  } catch (error) {
    console.error("Erreur suppression indexation:", error);
    return false;
  }
}

// ============================================
// STATISTIQUES D'INDEXATION
// ============================================

export async function getIndexationStats(userId: string): Promise<{
  notices: { total: number; indexed: number };
  officialDocs: { total: number; indexed: number };
  totalChunks: number;
}> {
  try {
    // Stats notices
    const { data: noticesData } = await (supabase as any)
      .from("notices_database")
      .select("is_indexed")
      .eq("user_id", userId);
    
    const noticesTotal = noticesData?.length || 0;
    const noticesIndexed = noticesData?.filter((n: any) => n.is_indexed).length || 0;
    
    // Stats documents officiels
    const { data: docsData } = await (supabase as any)
      .from("official_documents")
      .select("is_indexed");
    
    const docsTotal = docsData?.length || 0;
    const docsIndexed = docsData?.filter((d: any) => d.is_indexed).length || 0;
    
    // Nombre total de chunks
    const { count: totalChunks } = await (supabase as any)
      .from("document_chunks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    
    return {
      notices: { total: noticesTotal, indexed: noticesIndexed },
      officialDocs: { total: docsTotal, indexed: docsIndexed },
      totalChunks: totalChunks || 0,
    };
  } catch (error) {
    console.error("Erreur stats indexation:", error);
    return {
      notices: { total: 0, indexed: 0 },
      officialDocs: { total: 0, indexed: 0 },
      totalChunks: 0,
    };
  }
}
