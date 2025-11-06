import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SummarizeRequest {
  noticeId: string;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Créer le client Supabase avec le JWT de l'utilisateur
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Vérifier l'authentification
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    // Parser la requête
    const { noticeId } = await req.json() as SummarizeRequest

    if (!noticeId) {
      return new Response(
        JSON.stringify({ error: 'noticeId requis' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Récupérer la notice
    const { data: notice, error: noticeError } = await supabaseClient
      .from('notices_database')
      .select('*')
      .eq('id', noticeId)
      .single()

    if (noticeError || !notice) {
      return new Response(
        JSON.stringify({ error: 'Notice non trouvée' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      )
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Vérifier les limites de l'utilisateur
    const { data: usageData, error: usageError } = await supabaseClient
      .rpc('get_user_ai_usage', {
        p_feature: 'pdf_summary',
        p_user_id: user.id,
      })

    if (usageError) {
      console.error('Erreur lors de la vérification des limites:', usageError)
    }

    const usage = usageData?.[0]
    if (usage && usage.remaining_today !== null && usage.remaining_today <= 0) {
      return new Response(
        JSON.stringify({
          error: 'Limite journalière atteinte',
          limit: usage.limit_per_day,
          resetAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        }
      )
    }

    // Télécharger le PDF depuis Supabase Storage
    console.log('Téléchargement du PDF:', notice.url_notice)
    
    // Créer un client avec service_role pour accéder au storage
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: fileData, error: fileError } = await supabaseAdmin.storage
      .from('notice-files')
      .download(notice.url_notice)

    if (fileError || !fileData) {
      console.error('Erreur téléchargement PDF:', fileError)
      return new Response(
        JSON.stringify({ error: 'Impossible de télécharger le PDF' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // Convertir le fichier en base64
    const arrayBuffer = await fileData.arrayBuffer()
    const base64Data = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )

    // Appeler l'API Gemini
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Clé API Gemini non configurée' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`

    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              text: `Tu es un assistant spécialisé dans l'analyse de notices techniques de produits pour véhicules aménagés et camping-cars.

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
Sois concis mais précis. Maximum 500 mots.`
            },
            {
              inlineData: {
                mimeType: 'application/pdf',
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
    }

    console.log('Appel à Gemini API...')
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiPayload),
    })

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Erreur Gemini API:', geminiResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la génération du résumé', details: errorText }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const geminiData = await geminiResponse.json() as GeminiResponse

    if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      return new Response(
        JSON.stringify({ error: 'Réponse invalide de Gemini' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const summary = geminiData.candidates[0].content.parts[0].text
    const tokensUsed = geminiData.usageMetadata?.totalTokenCount || 0

    console.log('Résumé généré, tokens utilisés:', tokensUsed)

    // Sauvegarder le résumé dans la notice
    const { error: updateError } = await supabaseAdmin
      .from('notices_database')
      .update({
        summary: summary,
        summary_generated_at: new Date().toISOString(),
        tokens_used: tokensUsed,
      })
      .eq('id', noticeId)

    if (updateError) {
      console.error('Erreur sauvegarde résumé:', updateError)
    }

    // Logger l'usage
    await supabaseAdmin.from('ai_usage').insert({
      user_id: user.id,
      feature: 'pdf_summary',
      tokens_used: tokensUsed,
      cost_estimate: tokensUsed * 0.00001, // Estimation du coût
    })

    // Incrémenter les quotas API
    await supabaseAdmin.rpc('increment_api_quota', {
      p_provider: 'gemini',
      p_date: new Date().toISOString().split('T')[0],
      p_tokens: tokensUsed,
      p_cost: tokensUsed * 0.00001,
    })

    return new Response(
      JSON.stringify({
        summary: summary,
        fromCache: false,
        tokens: tokensUsed,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erreur dans summarize-notice:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
