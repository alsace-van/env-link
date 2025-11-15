import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageData } = await req.json();

    if (!imageData) {
      throw new Error("Image data is required");
    }

    // Récupérer la clé API Gemini depuis les secrets Supabase
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Convertir l'image base64 en format accepté par Gemini
    const base64Image = imageData.replace(/^data:image\/\w+;base64,/, "");

    // Détecter le type MIME de l'image
    const mimeMatch = imageData.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    // Prompt amélioré pour Gemini
    const improvedPrompt = `Tu es un expert en lecture de cartes grises françaises (certificat d'immatriculation français).

Analyse cette image et extrait UNIQUEMENT les informations VISIBLES et LISIBLES.

RÈGLES CRITIQUES :
1. Si un champ n'est PAS clairement visible → retourne null (pas de valeur inventée)
2. Si tu hésites sur un caractère → retourne null pour ce champ
3. Ne devine JAMAIS - mieux vaut null qu'une erreur
4. Pour le VIN : fais TRÈS attention aux confusions O/0, I/1, Z/2, S/5, B/8
5. L'immatriculation française a le format : AA-123-BB (2 lettres, tiret, 3 chiffres, tiret, 2 lettres)

CHAMPS À EXTRAIRE (codes officiels entre parenthèses) :

{
  "E": "Numéro VIN - 17 caractères EXACTS (exemple: VF1ZB6HE1HG123456) OU null si illisible",
  "A": "Immatriculation (format AA-123-BB) OU null si illisible",
  "D1": "Marque du véhicule (exemple: FIAT) OU null",
  "D2": "Type/variante (exemple: 250 L1H1 2.3 MJET 130) OU null",
  "D3": "Dénomination commerciale (exemple: DUCATO) OU null",
  "J": "Genre (CTTE, VP, VASP, etc) OU null",
  "J1": "Carrosserie (FOURGON, BERLINE, etc) OU null",
  "K": "Numéro de réception par type OU null",
  "P3": "Type de carburant (GO, ES, EE, etc) OU null",
  "P6": "Puissance fiscale en CV (chiffre seul) OU null",
  "P1": "Cylindrée en cm³ (chiffre seul) OU null",
  "G": "Masse en ordre de marche en kg (chiffre seul) OU null",
  "F1": "PTAC en kg (chiffre seul) OU null",
  "F2": "PTRA en kg (chiffre seul) OU null",
  "U1": "Niveau sonore en dB (chiffre seul) OU null",
  "U2": "Vitesse rotation moteur en tr/min (chiffre seul) OU null",
  "V7": "CO2 en g/km (chiffre seul) OU null",
  "S1": "Nombre de places assises (chiffre seul) OU null",
  "L": "Longueur en mm (chiffre seul) OU null",
  "B": "Largeur en mm (chiffre seul) OU null",
  "H": "Hauteur en mm (chiffre seul) OU null",
  "B1": "Date 1ère immatriculation (format JJ/MM/AAAA) OU null",
  "confidence": 0-100
}

INSTRUCTIONS FINALES :
- Retourne UNIQUEMENT le JSON, sans texte avant/après, sans backticks markdown
- Pour les nombres : pas d'unités, juste le chiffre
- confidence = ton niveau de confiance global (0-100) basé sur la lisibilité de l'image
- Si l'image est floue ou de mauvaise qualité → confidence < 60 et beaucoup de null

EXEMPLE DE RÉPONSE ATTENDUE :
{
  "E": "VF1ZB6HE1HG123456",
  "A": "AB-123-CD",
  "D1": "FIAT",
  "D2": "250 L1H1 2.3 MJET 130",
  "D3": "DUCATO",
  "J": "CTTE",
  "J1": "FOURGON",
  "K": null,
  "P3": "GO",
  "P6": "7",
  "P1": "2287",
  "G": "1950",
  "F1": "3500",
  "F2": null,
  "U1": "72",
  "U2": "3500",
  "V7": "189",
  "S1": "3",
  "L": "5413",
  "B": "2050",
  "H": "2524",
  "B1": "15/03/2020",
  "confidence": 92
}`;

    // Appel à l'API Gemini Vision avec le modèle 2.5 Flash (quota gratuit pour développeurs)
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: improvedPrompt,
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            topK: 1,
            topP: 1,
            maxOutputTokens: 8192,
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`Gemini API error: ${geminiResponse.statusText}`);
    }

    const geminiData = await geminiResponse.json();
    console.log("Gemini response:", JSON.stringify(geminiData, null, 2));

    // Vérifier si la réponse a été tronquée
    const finishReason = geminiData.candidates?.[0]?.finishReason;
    if (finishReason === "MAX_TOKENS") {
      console.error("⚠️ Réponse tronquée par Gemini (MAX_TOKENS atteint)");
      throw new Error("La réponse AI a été tronquée. L'image est peut-être trop complexe ou de mauvaise qualité. Veuillez réessayer avec une image plus claire.");
    }

    // Extraire le texte de la réponse
    const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error("No text generated by Gemini");
    }

    console.log("📝 Texte brut de Gemini:", generatedText);

    // Nettoyage robuste du JSON
    let cleanedText = generatedText.trim();
    
    // Enlever les backticks markdown
    cleanedText = cleanedText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
    
    // Enlever tout texte avant le premier {
    const firstBrace = cleanedText.indexOf("{");
    if (firstBrace > 0) {
      cleanedText = cleanedText.substring(firstBrace);
    }
    
    // Enlever tout texte après le dernier }
    const lastBrace = cleanedText.lastIndexOf("}");
    if (lastBrace >= 0 && lastBrace < cleanedText.length - 1) {
      cleanedText = cleanedText.substring(0, lastBrace + 1);
    }
    
    cleanedText = cleanedText.trim();
    
    console.log("🧹 JSON nettoyé:", cleanedText.substring(0, 200));

    const vehicleData = JSON.parse(cleanedText);

    // ✅ CONVERTIR LES DATES DD/MM/YYYY → YYYY-MM-DD
    if (vehicleData.B1 && typeof vehicleData.B1 === "string") {
      // Si format DD/MM/YYYY
      const match = vehicleData.B1.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (match) {
        const [, day, month, year] = match;
        vehicleData.B1 = `${year}-${month}-${day}`; // Convertir en YYYY-MM-DD
        console.log(`✅ Date convertie: ${match[0]} → ${vehicleData.B1}`);
      }
    }

    // Validation améliorée - Accepter si au moins QUELQUES champs sont détectés
    const detectedFields = Object.keys(vehicleData).filter(
      (key) =>
        key !== "confidence" && vehicleData[key] !== null && vehicleData[key] !== undefined && vehicleData[key] !== "",
    );

    console.log(`✅ ${detectedFields.length} champs détectés sur la carte grise`);
    console.log("Champs détectés:", detectedFields);

    if (detectedFields.length === 0) {
      throw new Error("Aucune donnée lisible sur l'image. Vérifiez la qualité de la photo.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: vehicleData,
        raw_text: generatedText,
        detected_fields_count: detectedFields.length,
        detected_fields: detectedFields,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in scan-carte-grise:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
