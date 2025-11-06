import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SummarizeRequest {
  noticeId: string;
}

interface LovableAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    total_tokens: number;
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

    // Appeler Lovable AI
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'Lovable AI non configuré' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const aiPayload = {
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
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
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${base64Data}`
              }
            }
          ]
        }
      ]
    }

    console.log('Appel à Lovable AI...')
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(aiPayload),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error('Erreur Lovable AI:', aiResponse.status, errorText)
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requêtes atteinte, veuillez réessayer plus tard' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 429,
          }
        )
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Crédits insuffisants, veuillez ajouter des crédits à votre espace de travail' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 402,
          }
        )
      }
      
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la génération du résumé', details: errorText }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const aiData = await aiResponse.json() as LovableAIResponse

    if (!aiData.choices?.[0]?.message?.content) {
      return new Response(
        JSON.stringify({ error: 'Réponse invalide de l\'IA' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const summary = aiData.choices[0].message.content
    const tokensUsed = aiData.usage?.total_tokens || 0

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

    // Logger l'usage (optionnel - Lovable AI gère son propre suivi)
    try {
      await supabaseAdmin.from('ai_usage').insert({
        user_id: user.id,
        feature: 'pdf_summary',
        tokens_used: tokensUsed,
        cost_estimate: 0, // Lovable AI gère la facturation
      })
    } catch (err) {
      console.log('Info: ai_usage table logging skipped')
    }

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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur inconnue' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
