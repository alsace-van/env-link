import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-upload-token",
};

// Décoder la clé API stockée (même logique que le front)
function decodeKey(encoded: string): string {
  try {
    return decodeURIComponent(atob(encoded));
  } catch {
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Client Supabase admin
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // =========================================
    // 1. VÉRIFIER LE TOKEN D'UPLOAD
    // =========================================
    const uploadToken = req.headers.get("x-upload-token");
    
    if (!uploadToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Token d'upload requis (header x-upload-token)" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chercher le token dans la base
    const { data: tokenData, error: tokenError } = await supabase
      .from("user_upload_tokens")
      .select("id, user_id, is_active, expires_at")
      .eq("token", uploadToken)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token invalide:", uploadToken.substring(0, 10) + "...");
      return new Response(
        JSON.stringify({ success: false, error: "Token d'upload invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Vérifier si actif et non expiré
    if (!tokenData.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Token désactivé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Token expiré" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = tokenData.user_id;
    const tokenId = tokenData.id;
    console.log("✅ Token valide pour user:", userId);

    // Mettre à jour last_used_at et use_count
    await supabase
      .from("user_upload_tokens")
      .update({ 
        last_used_at: new Date().toISOString(),
        use_count: (tokenData as any).use_count + 1 || 1
      })
      .eq("id", tokenId);

    // =========================================
    // 2. RÉCUPÉRER LA CLÉ GEMINI DE L'UTILISATEUR
    // =========================================
    const { data: aiConfig, error: aiConfigError } = await supabase
      .from("user_ai_config")
      .select("provider, encrypted_api_key")
      .eq("user_id", userId)
      .single();

    if (aiConfigError || !aiConfig?.encrypted_api_key) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Clé API IA non configurée. Configurez votre clé Gemini dans les paramètres de l'application." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiApiKey = decodeKey(aiConfig.encrypted_api_key);
    
    if (!geminiApiKey || !geminiApiKey.startsWith("AIza")) {
      return new Response(
        JSON.stringify({ success: false, error: "Clé API Gemini invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Clé Gemini récupérée pour user:", userId);

    // =========================================
    // 3. RÉCUPÉRER LE FICHIER
    // =========================================
    const { file, fileName, mimeType } = await req.json();

    if (!file || !fileName) {
      throw new Error("file et fileName sont requis");
    }

    // Nettoyer le base64
    const base64Data = file.replace(/^data:[^;]+;base64,/, "");
    const detectedMimeType = mimeType || (fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");

    // =========================================
    // 4. STOCKER LE FICHIER
    // =========================================
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    // Organiser par utilisateur
    const storagePath = `${userId}/${timestamp}_${cleanFileName}`;

    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from("incoming-invoices")
      .upload(storagePath, binaryData, {
        contentType: detectedMimeType,
        upsert: false,
      });

    if (uploadError) {
      // Créer le bucket s'il n'existe pas
      if (uploadError.message?.includes("not found") || uploadError.message?.includes("does not exist")) {
        console.log("📦 Creating bucket incoming-invoices...");
        await supabase.storage.createBucket("incoming-invoices", {
          public: false,
          fileSizeLimit: 10485760,
        });
        
        const { error: retryError } = await supabase.storage
          .from("incoming-invoices")
          .upload(storagePath, binaryData, {
            contentType: detectedMimeType,
            upsert: false,
          });
        
        if (retryError) throw retryError;
      } else {
        throw uploadError;
      }
    }

    console.log("✅ Fichier stocké:", storagePath);

    // =========================================
    // 5. OCR AVEC GEMINI (CLÉ DE L'UTILISATEUR)
    // =========================================
    const invoicePrompt = `Tu es un expert en lecture de factures fournisseurs françaises.

Analyse cette image/document et extrait les informations de facturation.

RÈGLES :
1. Si un champ n'est PAS clairement visible → retourne null
2. Les montants doivent être des nombres (pas de symboles € ou espaces)
3. La date doit être au format YYYY-MM-DD

CHAMPS À EXTRAIRE :
{
  "supplier_name": "Nom du fournisseur",
  "supplier_siret": "SIRET si visible ou null",
  "invoice_number": "Numéro de facture ou null",
  "invoice_date": "YYYY-MM-DD ou null",
  "due_date": "YYYY-MM-DD ou null",
  "total_ht": nombre ou null,
  "total_ttc": nombre ou null,
  "tva_amount": nombre ou null,
  "tva_rate": nombre ou null,
  "description": "Description courte ou null",
  "confidence": 0.0-1.0
}

Retourne UNIQUEMENT le JSON sans backticks ni texte.`;

    let ocrResult = null;
    let ocrError = null;
    let tokensUsed = 0;

    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: invoicePrompt },
                { inline_data: { mime_type: detectedMimeType, data: base64Data } },
              ],
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 4096 },
          }),
        }
      );

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        
        // Récupérer les tokens utilisés
        tokensUsed = geminiData.usageMetadata?.totalTokenCount || 0;
        
        const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (generatedText) {
          let cleanedText = generatedText.trim()
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "");
          
          const firstBrace = cleanedText.indexOf("{");
          const lastBrace = cleanedText.lastIndexOf("}");
          if (firstBrace >= 0 && lastBrace > firstBrace) {
            cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
          }
          
          ocrResult = JSON.parse(cleanedText);
          console.log("✅ OCR réussi:", ocrResult.supplier_name, ocrResult.total_ttc, `(${tokensUsed} tokens)`);
        }
      } else {
        const errorText = await geminiResponse.text();
        ocrError = `Gemini API error: ${geminiResponse.status} - ${errorText}`;
        console.error(ocrError);
      }
    } catch (parseErr) {
      ocrError = `OCR parse error: ${parseErr instanceof Error ? parseErr.message : "Unknown"}`;
      console.error(ocrError);
    }

    // =========================================
    // 6. ENREGISTRER DANS LA BASE
    // =========================================
    const invoiceRecord = {
      file_path: storagePath,
      file_name: fileName,
      mime_type: detectedMimeType,
      user_id: userId,
      status: ocrResult ? "processed" : (ocrError ? "error" : "pending"),
      ocr_result: ocrResult,
      ocr_error: ocrError,
      supplier_name: ocrResult?.supplier_name || null,
      invoice_number: ocrResult?.invoice_number || null,
      invoice_date: ocrResult?.invoice_date || null,
      total_ht: ocrResult?.total_ht || null,
      total_ttc: ocrResult?.total_ttc || null,
      tva_amount: ocrResult?.tva_amount || null,
      confidence: ocrResult?.confidence || null,
      tokens_used: tokensUsed,
      source: "shortcut",
      upload_token_id: tokenId,
      evoliz_status: "pending",
    };

    const { data: insertData, error: insertError } = await supabase
      .from("incoming_invoices")
      .insert(invoiceRecord)
      .select("id")
      .single();

    if (insertError) {
      console.warn("⚠️ Insert error:", insertError.message);
    }

    // =========================================
    // 7. METTRE À JOUR LE QUOTA TOKENS (optionnel)
    // =========================================
    if (tokensUsed > 0) {
      // Incrémenter le compteur de tokens de l'utilisateur
      await supabase.rpc("increment_user_ai_usage", {
        p_user_id: userId,
        p_tokens: tokensUsed,
      }).catch(() => {
        // La fonction RPC n'existe peut-être pas encore
        console.log("Note: increment_user_ai_usage RPC not available");
      });
    }

    // =========================================
    // 8. RÉPONSE
    // =========================================
    return new Response(
      JSON.stringify({
        success: true,
        message: ocrResult 
          ? `✅ ${ocrResult.supplier_name || fileName} - ${ocrResult.total_ttc ? ocrResult.total_ttc + "€" : "?"} (${Math.round((ocrResult.confidence || 0) * 100)}%)`
          : ocrError 
            ? `⚠️ Fichier reçu mais OCR échoué`
            : `📁 ${fileName} en attente de traitement`,
        invoice_id: insertData?.id || null,
        ocr_result: ocrResult,
        tokens_used: tokensUsed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in receive-invoice:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
