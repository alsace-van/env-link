// supabase/functions/generate-rti/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateRTIRequest {
  projectData: {
    client: any;
    project_id: string;
  };
  vehicleData: any;
  chargesData: any;
  equipementsData: any[];
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    // Parse request
    const { projectData, vehicleData, chargesData, equipementsData }: GenerateRTIRequest = await req.json()

    console.log('🚐 Génération RTI pour projet:', projectData.project_id)
    console.log('📋 Client:', projectData.client)
    console.log('🚗 Véhicule:', vehicleData)
    console.log('⚖️ Charges:', chargesData)
    console.log('🔧 Équipements:', equipementsData)

    // Construire le prompt pour Gemini
    const prompt = `Tu es un expert en homologation VASP pour les véhicules aménagés en France.
Tu dois générer le contenu complet et professionnel pour le formulaire RTI 03.5.1 (Réception à Titre Isolé - Aménagement en autocaravane).

**DONNÉES DU PROJET :**

**CLIENT/DEMANDEUR :**
${JSON.stringify(projectData.client, null, 2)}

**VÉHICULE :**
${JSON.stringify(vehicleData, null, 2)}

**RÉPARTITION DES CHARGES :**
${JSON.stringify(chargesData, null, 2)}

**ÉQUIPEMENTS INSTALLÉS :**
${JSON.stringify(equipementsData, null, 2)}

**INSTRUCTIONS :**

Tu dois générer un objet JSON complet avec les sections suivantes :

1. **annexe1** : Demande de réception à titre isolé
   - Récapituler les informations du demandeur
   - Informations du véhicule à transformer
   
2. **annexe2** : Calcul de répartition des charges
   - PTAC et poids à vide
   - Calcul de la charge utile
   - Masse en ordre de marche (PV + carburant ~90kg + conducteur 75kg)
   - Répartition des charges par essieu
   - Explication détaillée du calcul

3. **annexe3** : Attestation de transformation
   - Transformateur : ALSACE VAN CRÉATION
   - Description PROFESSIONNELLE et DÉTAILLÉE des travaux effectués (minimum 300 mots)
   - Liste complète des équipements installés avec :
     * Nom de l'équipement
     * Quantité
     * Normes de conformité (R10, EN 1949, EN 721, etc.)
     * Emplacement dans le véhicule
   - Mention des modifications structurelles (découpes, renforcements, etc.)
   - Conformité aux normes applicables

4. **annexe4** : Prescriptions réglementaires
   - Liste des normes respectées
   - Checklist de conformité (portes, fenêtres, ventilation, gaz, électricité)

5. **annexe5** : Plaque de transformation
   - Transformateur : ALSACE VAN CRÉATION
   - Numéro d'identification (VIN)
   - Motif RTI : VASP CARAVANE

**RÈGLES IMPORTANTES :**

1. Le ton doit être **PROFESSIONNEL** et **TECHNIQUE** adapté à une administration (DREAL)
2. La description des travaux doit être **COMPLÈTE** mais **CONCISE**
3. Utilise le vocabulaire technique officiel (genre VASP, CTTE, autocaravane, etc.)
4. Cite les normes applicables (EN 1949, EN 721, R10, R14, R16, R17)
5. Sois précis sur les dimensions et poids
6. Respecte le format JSON strict

**FORMAT DE RÉPONSE :**

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après. Format :

{
  "annexe1": {
    "motifReception": "Aménagement en Autocaravane",
    "demandeur": {
      "nom": "...",
      "prenom": "...",
      "adresse": "...",
      "telephone": "...",
      "email": "..."
    },
    "vehicule": {
      "vin": "...",
      "marque": "...",
      "type": "...",
      "immatriculation": "...",
      "datePremiereMiseEnCirculation": "...",
      "genre": "CTTE",
      "carrosserie": "FOURGON"
    }
  },
  "annexe2": {
    "ptac": 3500,
    "poidsVide": 2000,
    "chargeUtile": 1500,
    "masseOrdreMarche": 2165,
    "repartitionCharges": {
      "essieu1Kg": 1100,
      "essieu1Pourcentage": 55,
      "essieu2Kg": 900,
      "essieu2Pourcentage": 45
    },
    "explication": "Explication détaillée du calcul de répartition des charges, tenant compte du poids des équipements installés et de leur emplacement dans le véhicule..."
  },
  "annexe3": {
    "transformateur": "ALSACE VAN CRÉATION",
    "adresseTransformateur": "Strasbourg, France",
    "descriptionTravaux": "Description professionnelle et exhaustive des travaux effectués pour l'aménagement du véhicule en autocaravane. Inclure : découpes éventuelles, isolation, revêtements, installations électriques (batterie auxiliaire, convertisseur, prises), installation gaz (bouteille, détendeur, tuyauterie rigide cuivre conforme EN 1949), plomberie (réservoir eau propre XXL, pompe immergée, robinetterie), meubles et rangements (bois contreplaqué marine, fixations renforcées), couchage (dimensions du lit), cuisine (réchaud gaz 2 feux, évier inox), chauffage (webasto/truma diesel), fenêtres et lanterneaux (conformes R43), ventilation (grilles haute et basse conformes EN 721), etc. Minimum 300 mots.",
    "equipementsListe": [
      {
        "nom": "Batterie auxiliaire",
        "quantite": 1,
        "specifications": "Lithium 200Ah",
        "norme": "Conforme R10",
        "emplacement": "Sous siège passager"
      }
    ],
    "modificationsStructurelles": [
      "Découpe pour installation fenêtre latérale droite",
      "Découpe pour lanterneau toit",
      "Renforcement chassis pour support réservoir d'eau"
    ],
    "conformiteNormes": [
      "EN 1949 : Installation gaz",
      "EN 721 : Ventilation",
      "R10 : Compatibilité électromagnétique",
      "R43 : Vitrages de sécurité"
    ]
  },
  "annexe4": {
    "prescriptionsReglementaires": [
      "Portes d'accès : minimum 550mm de largeur, hauteur 1300mm",
      "Issue de secours : conforme aux dimensions réglementaires",
      "Ventilation : grilles hautes et basses conformes EN 721",
      "Installation gaz : tuyauterie rigide cuivre, conformité EN 1949",
      "Installation électrique : protection différentielle, conforme R10",
      "Vitrages : verre trempé ou feuilleté, conforme R43"
    ],
    "checklistConformite": {
      "portes": true,
      "issuesSecours": true,
      "ventilation": true,
      "gaz": true,
      "electricite": true,
      "vitrages": true,
      "couchages": true,
      "equipementsCuisine": true
    }
  },
  "annexe5": {
    "plaqueTransformation": {
      "transformateur": "ALSACE VAN CRÉATION",
      "numeroIdentification": "[VIN du véhicule]",
      "motifRTI": "VASP CARAVANE",
      "dimensionsCaracteres": "Hauteur minimale 4mm",
      "support": "Plaque gravée métallique rivetée sur châssis",
      "emplacement": "Montant de porte conducteur ou embase siège"
    }
  },
  "resume": {
    "pointsCles": [
      "Transformation de CTTE en VASP Autocaravane",
      "Conformité aux normes EN 1949 et EN 721",
      "Installation gaz et électrique certifiée",
      "Aménagement complet avec couchage, cuisine, rangements"
    ],
    "documentsPieces": [
      "Pièce 1 : Demande de réception (Annexe 1)",
      "Pièce 2 : Carte grise du véhicule",
      "Pièce 4 : Plans côtés de l'aménagement",
      "Pièce 5 : Calcul de répartition des charges (Annexe 2)",
      "Pièce 6 : Bulletins de pesée (3 pesées)",
      "Pièce 8 : Attestation de transformation (Annexe 3)",
      "Pièce 9 : Certificat Qualigaz/Bureau Veritas (EN 1949 + EN 721)",
      "Pièce 10 : Certificats de conformité équipements (chauffage, etc.)",
      "Pièce 12 : Contrôle technique valide"
    ]
  }
}

**GÉNÈRE MAINTENANT LE JSON COMPLET :**`

    console.log('🤖 Appel à Gemini AI...')

    // Appeler Gemini
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          }
        })
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`)
    }

    const geminiData = await geminiResponse.json()
    console.log('✅ Réponse Gemini reçue')

    // Extraire le texte de la réponse
    const generatedText = geminiData.candidates[0].content.parts[0].text
    
    // Parser le JSON (enlever les balises markdown si présentes)
    let cleanedText = generatedText.trim()
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/g, '')
    }

    let rtiData
    try {
      rtiData = JSON.parse(cleanedText)
    } catch (parseError) {
      console.error('❌ Erreur parsing JSON:', parseError)
      console.error('Texte reçu:', cleanedText)
      throw new Error('Failed to parse Gemini response as JSON')
    }

    // Calculer l'usage des tokens (estimation)
    const usageData = {
      inputTokens: geminiData.usageMetadata?.promptTokenCount || 0,
      outputTokens: geminiData.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: geminiData.usageMetadata?.totalTokenCount || 0,
      estimatedCost: (geminiData.usageMetadata?.totalTokenCount || 0) * 0.00000015 // ~$0.15 per 1M tokens
    }

    console.log('📊 Usage:', usageData)
    console.log('✨ Document RTI généré avec succès')

    // Sauvegarder dans Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error: insertError } = await supabase
      .from('rti_submissions')
      .insert({
        project_id: projectData.project_id,
        form_data: rtiData,
        status: 'draft'
      })

    if (insertError) {
      console.error('⚠️ Erreur sauvegarde Supabase:', insertError)
      // Ne pas bloquer la réponse si l'insertion échoue
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: rtiData,
        usage: usageData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Erreur:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
