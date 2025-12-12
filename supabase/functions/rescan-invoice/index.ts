// ============================================
// RESCAN INVOICE - Relancer l'OCR sur une facture existante
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer l'ID de la facture
    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ success: false, error: "invoice_id requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔄 Rescan facture: ${invoice_id}`);

    // 1. Récupérer la facture
    const { data: invoice, error: fetchError } = await supabase
      .from("incoming_invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();

    if (fetchError || !invoice) {
      return new Response(
        JSON.stringify({ success: false, error: "Facture non trouvée" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Télécharger le fichier depuis le storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("invoices")
      .download(invoice.file_path);

    if (downloadError || !fileData) {
      console.error("Erreur téléchargement:", downloadError);
      return new Response(
        JSON.stringify({ success: false, error: "Impossible de télécharger le fichier" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Convertir en base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = invoice.mime_type || "application/pdf";

    // 4. Appeler Gemini pour l'OCR
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "GEMINI_API_KEY non configurée" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invoicePrompt = `Tu es un expert en extraction de données de factures fournisseurs françaises.
Analyse cette facture et extrais les informations au format JSON.

RÈGLES :
1. Si un champ n'est PAS clairement visible → retourne null
2. Les montants doivent être des nombres (pas de symboles € ou espaces)
3. La date doit être au format YYYY-MM-DD

CHAMPS À EXTRAIRE :
{
  "supplier_name": "Nom du fournisseur",
  "supplier_siret": "SIRET si visible ou null",
  "supplier_tva": "N° TVA intracommunautaire (FRxxx) si visible ou null",
  "supplier_address": {
    "addr": "Adresse rue ou null",
    "postcode": "Code postal ou null",
    "town": "Ville ou null",
    "country_iso2": "FR par défaut"
  },
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
            contents: [
              {
                parts: [
                  { text: invoicePrompt },
                  { inline_data: { mime_type: mimeType, data: base64Data } }
                ],
              },
            ],
            generationConfig: { temperature: 0, maxOutputTokens: 4096 },
          }),
        }
      );

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        tokensUsed = geminiData.usageMetadata?.totalTokenCount || 0;

        const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText) {
          let cleanedText = generatedText
            .trim()
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "");

          const firstBrace = cleanedText.indexOf("{");
          const lastBrace = cleanedText.lastIndexOf("}");

          if (firstBrace !== -1 && lastBrace !== -1) {
            cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
            ocrResult = JSON.parse(cleanedText);
            console.log("✅ OCR réussi:", ocrResult.supplier_name);
          }
        }
      } else {
        const errorText = await geminiResponse.text();
        ocrError = `Gemini error: ${geminiResponse.status} - ${errorText}`;
        console.error(ocrError);
      }
    } catch (parseErr) {
      ocrError = `OCR parse error: ${parseErr instanceof Error ? parseErr.message : "Unknown"}`;
      console.error(ocrError);
    }

    // 5. Mettre à jour la facture
    const updateData: any = {
      status: ocrResult ? "processed" : ocrError ? "error" : invoice.status,
      ocr_result: ocrResult || invoice.ocr_result,
      ocr_error: ocrError,
      updated_at: new Date().toISOString(),
    };

    // Mettre à jour les champs si OCR réussi
    if (ocrResult) {
      updateData.supplier_name = ocrResult.supplier_name || invoice.supplier_name;
      updateData.supplier_siret = ocrResult.supplier_siret || invoice.supplier_siret;
      updateData.supplier_tva = ocrResult.supplier_tva || null;
      updateData.supplier_address = ocrResult.supplier_address || null;
      updateData.invoice_number = ocrResult.invoice_number || invoice.invoice_number;
      updateData.invoice_date = ocrResult.invoice_date || invoice.invoice_date;
      updateData.due_date = ocrResult.due_date || invoice.due_date;
      updateData.total_ht = ocrResult.total_ht ?? invoice.total_ht;
      updateData.total_ttc = ocrResult.total_ttc ?? invoice.total_ttc;
      updateData.tva_amount = ocrResult.tva_amount ?? invoice.tva_amount;
      updateData.tva_rate = ocrResult.tva_rate ?? invoice.tva_rate;
      updateData.description = ocrResult.description || invoice.description;
      updateData.confidence = ocrResult.confidence ?? invoice.confidence;
    }

    const { error: updateError } = await supabase
      .from("incoming_invoices")
      .update(updateData)
      .eq("id", invoice_id);

    if (updateError) {
      console.error("Erreur mise à jour:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur mise à jour: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Mettre à jour le quota tokens
    if (tokensUsed > 0) {
      try {
        await supabase.rpc("increment_user_ai_usage", {
          p_user_id: invoice.user_id,
          p_tokens: tokensUsed,
        });
      } catch {
        console.log("Note: increment_user_ai_usage RPC not available");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: ocrResult
          ? `✅ Rescan réussi: ${ocrResult.supplier_name || "?"} - ${ocrResult.total_ttc ? ocrResult.total_ttc + "€" : "?"}`
          : ocrError
            ? `⚠️ Rescan échoué: ${ocrError}`
            : "Rescan terminé",
        ocr_result: ocrResult,
        tokens_used: tokensUsed,
        new_fields: {
          supplier_tva: ocrResult?.supplier_tva || null,
          supplier_address: ocrResult?.supplier_address || null,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in rescan-invoice:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
