-- Corriger les URLs des documents officiels pour pointer vers des PDFs valides

-- CERFA 13750*07 - URL correcte du PDF
UPDATE official_documents
SET file_url = 'https://www.formulaires.service-public.fr/gf/cerfa_13750.do',
    description = 'Formulaire officiel CERFA 13750*07 pour demander un certificat d''immatriculation (carte grise) suite à l''homologation VASP. Ce formulaire doit être rempli et envoyé avec le dossier RTI.'
WHERE id = '065a7180-11ca-43df-b4f9-00d8c8da15f6';

-- Désactiver les notices AFNOR (liens commerciaux, pas de PDF public)
UPDATE official_documents
SET is_active = false,
    description = description || E'\n\n⚠️ Ce document est disponible uniquement à l''achat sur le site de l''AFNOR. Consultez le lien pour plus d''informations.'
WHERE id IN ('b6225668-303c-4da4-a845-133c1f5a54cc', '26e67419-96a0-477a-b584-506b5b6e5632');