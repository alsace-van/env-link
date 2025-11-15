import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SummarizeRequest {
  noticeId: string;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
  usageMetadata?: {
    totalTokenCount: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Créer le client Supabase avec le JWT de l'utilisateur
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    });

    // Vérifier l'authentification
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Parser la requête
    const { noticeId } = (await req.json()) as SummarizeRequest;

    if (!noticeId) {
      return new Response(JSON.stringify({ error: "noticeId requis" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Récupérer la notice
    const { data: notice, error: noticeError } = await supabaseClient
      .from("notices_database")
      .select("*")
      .eq("id", noticeId)
      .single();

    if (noticeError || !notice) {
      return new Response(JSON.stringify({ error: "Notice non trouvée" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Si un résumé existe déjà, le retourner
    if (notice.summary) {
      return new Response(
        JSON.stringify({
          summary: notice.summary,
          fromCache: true,
          tokens: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // Télécharger le PDF depuis Supabase Storage
    // Essayer différents champs possibles pour le chemin du fichier (notice_url est le bon champ)
    const filePath = notice.notice_url || notice.url_notice || notice.pdf_url || notice.file_url || notice.file_path;

    console.log("=== DEBUG EDGE FUNCTION ===");
    console.log("Notice ID:", noticeId);
    console.log("File path trouvé:", filePath);
    console.log("Notice complète:", JSON.stringify(notice, null, 2));
    console.log("==========================");

    if (!filePath) {
      return new Response(JSON.stringify({ error: "Chemin du fichier PDF introuvable dans la notice" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Créer un client avec service_role pour accéder au storage
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: fileData, error: fileError } = await supabaseAdmin.storage.from("notice-files").download(filePath);

    if (fileError || !fileData) {
      console.error("Erreur téléchargement PDF:", fileError);
      return new Response(JSON.stringify({ error: "Impossible de télécharger le PDF" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Convertir le fichier en base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Data = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ""));

    // Appeler Gemini AI
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "Gemini API non configurée" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const prompt = `Tu es un assistant spécialisé dans l'analyse de notices techniques de produits pour véhicules aménagés et camping-cars.

Analyse ce document PDF et génère un résumé structuré en français avec les sections suivantes:

📋 **Résumé général** (2-3 phrases sur le produit et son utilisation)

🔧 **Caractéristiques techniques principales**
- Liste les spécifications importantes (dimensions, poids, puissance, capacité, etc.)

⚡ **Installation et montage**
- Résume les étapes clés d'installation
- Points d'attention particuliers

⚠️ **Sécurité et précautions**
- Avertissements importants
- Normes et certifications

💡 **Conseils d'utilisation**
- Bonnes pratiques
- Entretien recommandé

Si certaines sections ne sont pas pertinentes pour ce document, ne les inclus pas.
Sois concis mais précis. Maximum 500 mots.`;

    const aiPayload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: "application/pdf",
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048,
      },
    };

    console.log("Appel à Gemini AI...");
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(aiPayload),
      },
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Erreur Gemini AI:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        // Retourner 200 avec un message d'erreur dans le JSON pour que le frontend puisse l'afficher
        return new Response(
          JSON.stringify({
            error:
              "⚠️ Quota Gemini AI dépassé\n\nVotre clé API Gemini gratuite a atteint sa limite. Vous devez :\n\n1. Attendre 60 secondes et réessayer\n2. Ou upgrader vers un plan payant Gemini sur https://aistudio.google.com/\n\nErreur Gemini: " +
              errorText.substring(0, 200),
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      return new Response(
        JSON.stringify({ error: "Erreur lors de la génération du résumé: " + errorText.substring(0, 300) }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const aiData = await aiResponse.json();
    console.log("Réponse Gemini:", JSON.stringify(aiData, null, 2));

    if (!aiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      return new Response(JSON.stringify({ error: "Réponse invalide de l'IA", data: aiData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const summary = aiData.candidates[0].content.parts[0].text;
    const tokensUsed = aiData.usageMetadata?.totalTokenCount || 0;

    console.log("Résumé généré, tokens utilisés:", tokensUsed);

    // Sauvegarder le résumé dans la notice
    const { error: updateError } = await supabaseAdmin
      .from("notices_database")
      .update({
        summary: summary,
        summary_generated_at: new Date().toISOString(),
        tokens_used: tokensUsed,
      })
      .eq("id", noticeId);

    if (updateError) {
      console.error("Erreur sauvegarde résumé:", updateError);
    }

    // Logger l'usage
    try {
      await supabaseAdmin.from("ai_usage").insert({
        user_id: user.id,
        feature: "pdf_summary",
        tokens_used: tokensUsed,
        cost_estimate: (tokensUsed / 1000000) * 0.15, // Gemini Flash: ~$0.15 per million tokens
      });
    } catch (err) {
      console.log("Info: ai_usage table logging skipped");
    }

    return new Response(
      JSON.stringify({
        summary: summary,
        fromCache: false,
        tokens: tokensUsed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Erreur dans summarize-notice:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
